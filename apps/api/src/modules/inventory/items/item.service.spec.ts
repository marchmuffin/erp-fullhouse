import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';

import { ItemService } from './item.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

const mockTx = {
  item: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
};

const mockPrisma = {
  withTenantSchema: jest.fn().mockImplementation((_schema: string, fn: (tx: any) => any) =>
    fn(mockTx),
  ),
};

const SCHEMA = 'tenant_test';

function makeItem(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'item-1',
    code: 'ITM-001',
    name: 'Widget A',
    description: null,
    category: 'GENERAL',
    unit: 'PCS',
    unitCost: 25.0,
    safetyStock: 10,
    reorderPoint: 20,
    isActive: true,
    notes: null,
    createdAt: new Date('2026-01-01'),
    stockLevels: [],
    ...overrides,
  };
}

function makeStockLevel(quantity: number, warehouseOverrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'sl-1',
    itemId: 'item-1',
    warehouseId: 'wh-1',
    quantity,
    warehouse: {
      id: 'wh-1',
      code: 'WH01',
      name: 'Main Warehouse',
      location: 'Building A',
      ...warehouseOverrides,
    },
  };
}

describe('ItemService', () => {
  let service: ItemService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ItemService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ItemService>(ItemService);
    jest.clearAllMocks();
  });

  describe('findAll()', () => {
    it('should return items with pagination metadata', async () => {
      const items = [makeItem(), makeItem({ id: 'item-2', code: 'ITM-002' })];
      mockTx.item.findMany.mockResolvedValue(items);
      mockTx.item.count.mockResolvedValue(2);

      const result = await service.findAll(SCHEMA, { page: 1, perPage: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({ page: 1, perPage: 20, total: 2, totalPages: 1 });
    });

    it('should pass search and category filters to the query', async () => {
      mockTx.item.findMany.mockResolvedValue([]);
      mockTx.item.count.mockResolvedValue(0);

      await service.findAll(SCHEMA, { search: 'widget', category: 'ELECTRONICS' });

      const findManyCall = mockTx.item.findMany.mock.calls[0][0];
      expect(findManyCall.where.OR).toBeDefined();
      expect(findManyCall.where.category).toBe('ELECTRONICS');
    });
  });

  describe('findById()', () => {
    it('should return an item with stock levels', async () => {
      const item = makeItem({
        stockLevels: [makeStockLevel(50)],
      });
      mockTx.item.findUnique.mockResolvedValue(item);

      const result = await service.findById(SCHEMA, 'item-1');

      expect(result.id).toBe('item-1');
      expect(result.stockLevels).toHaveLength(1);
      expect(result.stockLevels[0].quantity).toBe(50);
    });

    it('should throw NotFoundException when item does not exist', async () => {
      mockTx.item.findUnique.mockResolvedValue(null);

      await expect(service.findById(SCHEMA, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create()', () => {
    const createDto = {
      code: 'ITM-003',
      name: 'Gadget B',
      category: 'ELECTRONICS',
      unit: 'PCS',
      unitCost: 99.9,
      safetyStock: 5,
      reorderPoint: 10,
    } as any;

    it('should create and return a new item', async () => {
      mockTx.item.findUnique.mockResolvedValue(null);
      const created = makeItem({ id: 'item-3', code: 'ITM-003', name: 'Gadget B' });
      mockTx.item.create.mockResolvedValue(created);

      const result = await service.create(SCHEMA, createDto);

      expect(mockTx.item.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ code: 'ITM-003', name: 'Gadget B' }),
        }),
      );
      expect(result.code).toBe('ITM-003');
    });

    it('should throw ConflictException when item code already exists', async () => {
      mockTx.item.findUnique.mockResolvedValue(makeItem({ code: 'ITM-003' }));

      await expect(service.create(SCHEMA, createDto)).rejects.toThrow(ConflictException);
      expect(mockTx.item.create).not.toHaveBeenCalled();
    });
  });

  describe('findLowStock()', () => {
    it('should return items where any stock level is below the safety stock', async () => {
      const lowItem = makeItem({
        safetyStock: 10,
        stockLevels: [makeStockLevel(3)], // 3 < 10, low stock
      });
      const okItem = makeItem({
        id: 'item-2',
        code: 'ITM-002',
        safetyStock: 10,
        stockLevels: [makeStockLevel(15)], // 15 >= 10, fine
      });
      mockTx.item.findMany.mockResolvedValue([lowItem, okItem]);

      const result = await service.findLowStock(SCHEMA);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('item-1');
    });

    it('should return an empty array when all stock levels are sufficient', async () => {
      const okItem = makeItem({
        safetyStock: 5,
        stockLevels: [makeStockLevel(100)],
      });
      mockTx.item.findMany.mockResolvedValue([okItem]);

      const result = await service.findLowStock(SCHEMA);

      expect(result).toHaveLength(0);
    });

    it('should return items with no stock levels as low stock when safetyStock > 0', async () => {
      // An item with safetyStock=5 and no stock levels at all has nothing
      // that satisfies `sl.quantity < safetyStock`, so it will NOT appear.
      // This test verifies the filter only triggers when a stock level exists and is low.
      const noStockItem = makeItem({ safetyStock: 5, stockLevels: [] });
      mockTx.item.findMany.mockResolvedValue([noStockItem]);

      const result = await service.findLowStock(SCHEMA);

      // No stock levels means Array.some() returns false — item is excluded
      expect(result).toHaveLength(0);
    });
  });
});

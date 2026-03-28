import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';

import { WarehouseService } from './warehouse.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

const mockTx = {
  warehouse: {
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

function makeWarehouse(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'wh-1',
    code: 'WH01',
    name: 'Main Warehouse',
    location: 'Building A',
    isActive: true,
    createdAt: new Date('2026-01-01'),
    stockLevels: [],
    _count: { stockLevels: 0 },
    ...overrides,
  };
}

function makeStockLevel(quantity: number, overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'sl-1',
    warehouseId: 'wh-1',
    itemId: 'item-1',
    quantity,
    item: {
      id: 'item-1',
      code: 'ITM-001',
      name: 'Widget A',
      unit: 'PCS',
      safetyStock: 10,
      reorderPoint: 20,
    },
    ...overrides,
  };
}

const createDto = {
  code: 'WH02',
  name: 'Secondary Warehouse',
  location: 'Building B',
} as any;

describe('WarehouseService', () => {
  let service: WarehouseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WarehouseService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<WarehouseService>(WarehouseService);
    jest.clearAllMocks();
  });

  describe('findAll()', () => {
    it('should return warehouses with pagination metadata', async () => {
      const warehouses = [
        makeWarehouse(),
        makeWarehouse({ id: 'wh-2', code: 'WH02', _count: { stockLevels: 5 } }),
      ];
      mockTx.warehouse.findMany.mockResolvedValue(warehouses);
      mockTx.warehouse.count.mockResolvedValue(2);

      const result = await service.findAll(SCHEMA, { page: 1, perPage: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({ page: 1, perPage: 20, total: 2, totalPages: 1 });
    });

    it('should pass search filter to the query', async () => {
      mockTx.warehouse.findMany.mockResolvedValue([]);
      mockTx.warehouse.count.mockResolvedValue(0);

      await service.findAll(SCHEMA, { search: 'main' });

      const findManyCall = mockTx.warehouse.findMany.mock.calls[0][0];
      expect(findManyCall.where.OR).toBeDefined();
    });

    it('should calculate correct totalPages for multi-page results', async () => {
      mockTx.warehouse.findMany.mockResolvedValue([makeWarehouse()]);
      mockTx.warehouse.count.mockResolvedValue(25);

      const result = await service.findAll(SCHEMA, { page: 1, perPage: 20 });

      expect(result.meta.totalPages).toBe(2);
    });
  });

  describe('findById()', () => {
    it('should return a warehouse with stock levels', async () => {
      const wh = makeWarehouse({ stockLevels: [makeStockLevel(50)] });
      mockTx.warehouse.findUnique.mockResolvedValue(wh);

      const result = await service.findById(SCHEMA, 'wh-1');

      expect(result.id).toBe('wh-1');
      expect(result.stockLevels).toHaveLength(1);
      expect(result.stockLevels[0].quantity).toBe(50);
    });

    it('should throw NotFoundException when warehouse does not exist', async () => {
      mockTx.warehouse.findUnique.mockResolvedValue(null);

      await expect(service.findById(SCHEMA, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create()', () => {
    it('should create and return a new warehouse', async () => {
      mockTx.warehouse.findUnique.mockResolvedValue(null);
      const created = makeWarehouse({ id: 'wh-2', code: 'WH02', name: 'Secondary Warehouse' });
      mockTx.warehouse.create.mockResolvedValue(created);

      const result = await service.create(SCHEMA, createDto);

      expect(mockTx.warehouse.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ code: 'WH02', name: 'Secondary Warehouse' }),
        }),
      );
      expect(result.code).toBe('WH02');
    });

    it('should throw ConflictException when warehouse code already exists', async () => {
      mockTx.warehouse.findUnique.mockResolvedValue(makeWarehouse({ code: 'WH02' }));

      await expect(service.create(SCHEMA, createDto)).rejects.toThrow(ConflictException);
      expect(mockTx.warehouse.create).not.toHaveBeenCalled();
    });
  });

  describe('update()', () => {
    it('should update and return the warehouse', async () => {
      const existing = makeWarehouse();
      const updated = makeWarehouse({ name: 'Updated Warehouse', location: 'Building C' });
      mockTx.warehouse.findUnique.mockResolvedValue(existing);
      mockTx.warehouse.update.mockResolvedValue(updated);

      const result = await service.update(SCHEMA, 'wh-1', { name: 'Updated Warehouse', location: 'Building C' });

      expect(mockTx.warehouse.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'wh-1' },
          data: expect.objectContaining({ name: 'Updated Warehouse' }),
        }),
      );
      expect(result.name).toBe('Updated Warehouse');
    });

    it('should throw NotFoundException when warehouse does not exist', async () => {
      mockTx.warehouse.findUnique.mockResolvedValue(null);

      await expect(service.update(SCHEMA, 'nonexistent', { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
      expect(mockTx.warehouse.update).not.toHaveBeenCalled();
    });

    it('should allow toggling isActive status', async () => {
      mockTx.warehouse.findUnique.mockResolvedValue(makeWarehouse());
      mockTx.warehouse.update.mockResolvedValue(makeWarehouse({ isActive: false }));

      const result = await service.update(SCHEMA, 'wh-1', { isActive: false });

      expect(mockTx.warehouse.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: false }),
        }),
      );
      expect(result.isActive).toBe(false);
    });
  });

  describe('remove()', () => {
    it('should deactivate a warehouse by setting isActive to false', async () => {
      mockTx.warehouse.findUnique.mockResolvedValue(makeWarehouse());
      mockTx.warehouse.update.mockResolvedValue(makeWarehouse({ isActive: false }));

      await service.remove(SCHEMA, 'wh-1');

      expect(mockTx.warehouse.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'wh-1' },
          data: { isActive: false },
        }),
      );
    });

    it('should throw NotFoundException when warehouse does not exist', async () => {
      mockTx.warehouse.findUnique.mockResolvedValue(null);

      await expect(service.remove(SCHEMA, 'nonexistent')).rejects.toThrow(NotFoundException);
      expect(mockTx.warehouse.update).not.toHaveBeenCalled();
    });
  });
});

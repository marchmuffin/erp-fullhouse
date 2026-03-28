import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

import { BomService } from './bom.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

const mockTx = {
  bom: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  item: {
    findUnique: jest.fn(),
  },
  workOrder: {
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
    name: 'Finished Product A',
    unit: 'PCS',
    unitCost: 100,
    ...overrides,
  };
}

function makeBom(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'bom-1',
    itemId: 'item-1',
    version: '1.0',
    description: 'Standard BOM',
    isActive: true,
    createdAt: new Date('2026-01-01'),
    item: makeItem(),
    lines: [],
    _count: { lines: 0, workOrders: 0 },
    ...overrides,
  };
}

function makeBomLine(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'bl-1',
    bomId: 'bom-1',
    lineNo: 1,
    componentId: 'item-2',
    quantity: 2,
    unit: 'PCS',
    notes: null,
    component: makeItem({ id: 'item-2', code: 'ITM-002', name: 'Component B' }),
    ...overrides,
  };
}

const createDto = {
  itemId: 'item-1',
  version: '1.0',
  description: 'Standard BOM',
  isActive: true,
  lines: [
    { lineNo: 1, componentId: 'item-2', quantity: 2, unit: 'PCS', notes: null },
  ],
} as any;

describe('BomService', () => {
  let service: BomService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BomService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<BomService>(BomService);
    jest.clearAllMocks();
  });

  describe('findAll()', () => {
    it('should return paginated BOMs with metadata', async () => {
      const boms = [makeBom(), makeBom({ id: 'bom-2', version: '2.0' })];
      mockTx.bom.findMany.mockResolvedValue(boms);
      mockTx.bom.count.mockResolvedValue(2);

      const result = await service.findAll(SCHEMA, { page: 1, perPage: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({ page: 1, perPage: 20, total: 2, totalPages: 1 });
    });

    it('should pass itemId filter to the query', async () => {
      mockTx.bom.findMany.mockResolvedValue([]);
      mockTx.bom.count.mockResolvedValue(0);

      await service.findAll(SCHEMA, { itemId: 'item-1' });

      const findManyCall = mockTx.bom.findMany.mock.calls[0][0];
      expect(findManyCall.where.itemId).toBe('item-1');
    });
  });

  describe('findById()', () => {
    it('should return a BOM with lines and item details', async () => {
      const bom = makeBom({ lines: [makeBomLine()] });
      mockTx.bom.findUnique.mockResolvedValue(bom);

      const result = await service.findById(SCHEMA, 'bom-1');

      expect(result.id).toBe('bom-1');
      expect(result.lines).toHaveLength(1);
      expect(result.lines[0].component.code).toBe('ITM-002');
    });

    it('should throw NotFoundException when BOM does not exist', async () => {
      mockTx.bom.findUnique.mockResolvedValue(null);

      await expect(service.findById(SCHEMA, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create()', () => {
    it('should create and return a BOM with lines', async () => {
      // No duplicate [itemId, version] combo
      mockTx.bom.findUnique.mockResolvedValueOnce(null);
      // Finished item exists
      mockTx.item.findUnique.mockResolvedValueOnce(makeItem());
      // Component item exists
      mockTx.item.findUnique.mockResolvedValueOnce(makeItem({ id: 'item-2', code: 'ITM-002' }));
      const created = makeBom({ lines: [makeBomLine()] });
      mockTx.bom.create.mockResolvedValue(created);

      const result = await service.create(SCHEMA, createDto);

      expect(mockTx.bom.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            itemId: 'item-1',
            version: '1.0',
          }),
        }),
      );
      expect(result.itemId).toBe('item-1');
    });

    it('should throw ConflictException when a BOM for the same item and version already exists', async () => {
      mockTx.bom.findUnique.mockResolvedValueOnce(makeBom());

      await expect(service.create(SCHEMA, createDto)).rejects.toThrow(ConflictException);
      expect(mockTx.bom.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when the finished item does not exist', async () => {
      // No duplicate
      mockTx.bom.findUnique.mockResolvedValueOnce(null);
      // Finished item not found
      mockTx.item.findUnique.mockResolvedValueOnce(null);

      await expect(service.create(SCHEMA, createDto)).rejects.toThrow(NotFoundException);
      expect(mockTx.bom.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when a component is the same as the finished item (self-reference)', async () => {
      const selfRefDto = {
        ...createDto,
        lines: [{ lineNo: 1, componentId: 'item-1', quantity: 1, unit: 'PCS', notes: null }],
      };
      // No duplicate
      mockTx.bom.findUnique.mockResolvedValueOnce(null);
      // Finished item exists
      mockTx.item.findUnique.mockResolvedValueOnce(makeItem());
      // Component is the same item
      mockTx.item.findUnique.mockResolvedValueOnce(makeItem());

      await expect(service.create(SCHEMA, selfRefDto)).rejects.toThrow(BadRequestException);
      expect(mockTx.bom.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when a component item does not exist', async () => {
      // No duplicate
      mockTx.bom.findUnique.mockResolvedValueOnce(null);
      // Finished item exists
      mockTx.item.findUnique.mockResolvedValueOnce(makeItem());
      // Component item not found
      mockTx.item.findUnique.mockResolvedValueOnce(null);

      await expect(service.create(SCHEMA, createDto)).rejects.toThrow(NotFoundException);
      expect(mockTx.bom.create).not.toHaveBeenCalled();
    });
  });
});

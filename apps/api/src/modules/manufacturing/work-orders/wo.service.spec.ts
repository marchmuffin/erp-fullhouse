import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';

import { WoService } from './wo.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

const mockTx = {
  workOrder: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  item: {
    findUnique: jest.fn(),
  },
  bom: {
    findUnique: jest.fn(),
  },
  stockLevel: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  stockTransaction: {
    create: jest.fn(),
  },
  woMaterialIssue: {
    update: jest.fn(),
  },
  woOperation: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const mockPrisma = {
  withTenantSchema: jest.fn().mockImplementation((_schema: string, fn: (tx: any) => any) =>
    fn(mockTx),
  ),
};

const SCHEMA = 'tenant_test';
const USER_ID = 'user-1';

function makeItem(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'item-1',
    code: 'FG-001',
    name: 'Finished Product',
    unit: 'pcs',
    unitCost: 100,
    ...overrides,
  };
}

function makeWorkOrder(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'wo-1',
    woNo: 'WO-202603-0001',
    itemId: 'item-1',
    bomId: null,
    plannedQty: 100,
    producedQty: 0,
    warehouseId: 'wh-1',
    status: 'draft',
    plannedStart: new Date('2026-03-01'),
    plannedEnd: new Date('2026-03-15'),
    actualStart: null,
    actualEnd: null,
    notes: null,
    createdBy: USER_ID,
    createdAt: new Date('2026-03-01'),
    item: makeItem(),
    bom: null,
    operations: [],
    materialIssues: [],
    _count: { operations: 0, materialIssues: 0 },
    ...overrides,
  };
}

const createDto = {
  woNo: 'WO-202603-0001',
  itemId: 'item-1',
  plannedQty: 100,
  warehouseId: 'wh-1',
  plannedStart: '2026-03-01',
  plannedEnd: '2026-03-15',
} as any;

describe('WoService', () => {
  let service: WoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WoService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<WoService>(WoService);
    jest.clearAllMocks();
  });

  describe('findAll()', () => {
    it('should return paginated work orders with default pagination', async () => {
      const orders = [makeWorkOrder()];
      mockTx.workOrder.findMany.mockResolvedValue(orders);
      mockTx.workOrder.count.mockResolvedValue(1);

      const result = await service.findAll(SCHEMA, {});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ page: 1, perPage: 20, total: 1, totalPages: 1 });
    });

    it('should filter by status and itemId when provided', async () => {
      mockTx.workOrder.findMany.mockResolvedValue([]);
      mockTx.workOrder.count.mockResolvedValue(0);

      await service.findAll(SCHEMA, { status: 'released', itemId: 'item-1' });

      expect(mockTx.workOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'released', itemId: 'item-1' } }),
      );
    });
  });

  describe('findById()', () => {
    it('should return a work order with operations and material issues', async () => {
      mockTx.workOrder.findUnique.mockResolvedValue(makeWorkOrder());

      const result = await service.findById(SCHEMA, 'wo-1');

      expect(mockTx.workOrder.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'wo-1' } }),
      );
      expect(result.id).toBe('wo-1');
    });

    it('should throw NotFoundException when work order does not exist', async () => {
      mockTx.workOrder.findUnique.mockResolvedValue(null);

      await expect(service.findById(SCHEMA, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create()', () => {
    it('should create a draft work order when WO number is unique and item exists', async () => {
      mockTx.workOrder.findUnique.mockResolvedValueOnce(null); // no duplicate woNo
      mockTx.item.findUnique.mockResolvedValue(makeItem());
      const created = makeWorkOrder();
      mockTx.workOrder.create.mockResolvedValue(created);

      const result = await service.create(SCHEMA, createDto, USER_ID);

      expect(mockTx.workOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            woNo: 'WO-202603-0001',
            itemId: 'item-1',
            plannedQty: 100,
            status: 'draft',
            createdBy: USER_ID,
          }),
        }),
      );
      expect(result.status).toBe('draft');
    });

    it('should throw BadRequestException when WO number already exists', async () => {
      mockTx.workOrder.findUnique.mockResolvedValueOnce(makeWorkOrder()); // duplicate

      await expect(service.create(SCHEMA, createDto, USER_ID)).rejects.toThrow(BadRequestException);
      expect(mockTx.workOrder.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when the finished item does not exist', async () => {
      mockTx.workOrder.findUnique.mockResolvedValueOnce(null);
      mockTx.item.findUnique.mockResolvedValue(null);

      await expect(service.create(SCHEMA, createDto, USER_ID)).rejects.toThrow(NotFoundException);
      expect(mockTx.workOrder.create).not.toHaveBeenCalled();
    });

    it('should auto-populate material issues when a BOM is provided', async () => {
      mockTx.workOrder.findUnique.mockResolvedValueOnce(null);
      mockTx.item.findUnique.mockResolvedValue(makeItem());
      const bom = {
        id: 'bom-1',
        version: 1,
        isActive: true,
        lines: [
          { componentId: 'comp-1', quantity: 2, component: makeItem({ id: 'comp-1', code: 'RM-001' }) },
        ],
      };
      mockTx.bom.findUnique.mockResolvedValue(bom);
      const created = makeWorkOrder({
        bomId: 'bom-1',
        materialIssues: [{ itemId: 'comp-1', requiredQty: 200, issuedQty: 0 }],
      });
      mockTx.workOrder.create.mockResolvedValue(created);

      const dtoWithBom = { ...createDto, bomId: 'bom-1' } as any;
      const result = await service.create(SCHEMA, dtoWithBom, USER_ID);

      expect(mockTx.workOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            materialIssues: expect.objectContaining({
              create: expect.arrayContaining([
                expect.objectContaining({ itemId: 'comp-1', requiredQty: 200, issuedQty: 0 }),
              ]),
            }),
          }),
        }),
      );
      expect(result.materialIssues).toHaveLength(1);
    });
  });

  describe('release()', () => {
    it('should transition a draft work order to released', async () => {
      mockTx.workOrder.findUnique.mockResolvedValue(
        makeWorkOrder({ status: 'draft', bomId: null, _count: { materialIssues: 0 } }),
      );
      const released = makeWorkOrder({ status: 'released' });
      mockTx.workOrder.update.mockResolvedValue(released);

      const result = await service.release(SCHEMA, 'wo-1');

      expect(mockTx.workOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'wo-1' },
          data: { status: 'released' },
        }),
      );
      expect(result.status).toBe('released');
    });

    it('should throw BadRequestException when releasing a non-draft work order', async () => {
      mockTx.workOrder.findUnique.mockResolvedValue(
        makeWorkOrder({ status: 'released', _count: { materialIssues: 0 } }),
      );

      await expect(service.release(SCHEMA, 'wo-1')).rejects.toThrow(BadRequestException);
      expect(mockTx.workOrder.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when BOM is set but no material issues exist', async () => {
      mockTx.workOrder.findUnique.mockResolvedValue(
        makeWorkOrder({ status: 'draft', bomId: 'bom-1', _count: { materialIssues: 0 } }),
      );

      await expect(service.release(SCHEMA, 'wo-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('complete()', () => {
    it('should complete an in_progress work order and post a stock receipt', async () => {
      mockTx.workOrder.findUnique.mockResolvedValue(
        makeWorkOrder({ status: 'in_progress', warehouseId: 'wh-1' }),
      );
      mockTx.item.findUnique.mockResolvedValue(makeItem());
      mockTx.stockLevel.findUnique.mockResolvedValue({ itemId: 'item-1', warehouseId: 'wh-1', quantity: 0, reservedQty: 0 });
      mockTx.stockLevel.update.mockResolvedValue({ quantity: 50 });
      mockTx.stockTransaction.create.mockResolvedValue({ id: 'txn-1' });
      const completed = makeWorkOrder({ status: 'completed', producedQty: 50 });
      mockTx.workOrder.update.mockResolvedValue(completed);

      const result = await service.complete(SCHEMA, 'wo-1', { producedQty: 50 } as any, USER_ID);

      expect(mockTx.workOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'wo-1' },
          data: expect.objectContaining({
            status: 'completed',
            producedQty: 50,
            actualEnd: expect.any(Date),
          }),
        }),
      );
      expect(result.status).toBe('completed');
    });

    it('should throw BadRequestException when producedQty is zero or negative', async () => {
      mockTx.workOrder.findUnique.mockResolvedValue(makeWorkOrder({ status: 'in_progress' }));

      await expect(
        service.complete(SCHEMA, 'wo-1', { producedQty: 0 } as any, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when completing a non-in_progress work order', async () => {
      mockTx.workOrder.findUnique.mockResolvedValue(makeWorkOrder({ status: 'draft' }));

      await expect(
        service.complete(SCHEMA, 'wo-1', { producedQty: 10 } as any, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('issueMaterials()', () => {
    it('should issue all pending materials and apply negative stock transactions', async () => {
      const materialIssues = [
        { id: 'mi-1', itemId: 'comp-1', warehouseId: 'wh-1', requiredQty: 50, issuedQty: 0 },
      ];
      mockTx.workOrder.findUnique.mockResolvedValue(
        makeWorkOrder({ status: 'released', materialIssues }),
      );
      mockTx.stockLevel.findUnique.mockResolvedValue({
        itemId: 'comp-1',
        warehouseId: 'wh-1',
        quantity: 100,
        reservedQty: 0,
      });
      mockTx.item.findUnique.mockResolvedValue(makeItem({ id: 'comp-1', unitCost: 20 }));
      mockTx.stockLevel.update.mockResolvedValue({ quantity: 50 });
      mockTx.stockTransaction.create.mockResolvedValue({ id: 'txn-1' });
      mockTx.woMaterialIssue.update.mockResolvedValue({ ...materialIssues[0], issuedQty: 50 });

      const result = await service.issueMaterials(SCHEMA, 'wo-1', USER_ID);

      expect(mockTx.stockTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            txnType: 'issue',
            quantity: -50,
            refDocType: 'WO',
          }),
        }),
      );
      expect(result.issued).toHaveLength(1);
    });

    it('should throw BadRequestException when there is insufficient stock', async () => {
      const materialIssues = [
        { id: 'mi-1', itemId: 'comp-1', warehouseId: 'wh-1', requiredQty: 200, issuedQty: 0 },
      ];
      mockTx.workOrder.findUnique.mockResolvedValue(
        makeWorkOrder({ status: 'released', materialIssues }),
      );
      mockTx.stockLevel.findUnique.mockResolvedValue({
        itemId: 'comp-1',
        warehouseId: 'wh-1',
        quantity: 10,
        reservedQty: 0,
      });
      mockTx.item.findUnique.mockResolvedValue(makeItem({ id: 'comp-1', code: 'RM-001' }));

      await expect(service.issueMaterials(SCHEMA, 'wo-1', USER_ID)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});

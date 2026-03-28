import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';

import { StockCountService } from './stock-count.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { StockTxnService } from '../transactions/stock-txn.service';

const mockTx = {
  stockCount: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  stockCountLine: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  warehouse: {
    findUnique: jest.fn(),
  },
  stockLevel: {
    findMany: jest.fn(),
  },
};

const mockPrisma = {
  withTenantSchema: jest.fn().mockImplementation((_schema: string, fn: (tx: any) => any) =>
    fn(mockTx),
  ),
};

const mockTxnSvc = {
  _applyTransaction: jest.fn(),
};

const SCHEMA = 'tenant_test';
const USER_ID = 'user-1';

function makeWarehouse(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'wh-1',
    code: 'WH01',
    name: 'Main Warehouse',
    ...overrides,
  };
}

function makeStockCount(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'sc-1',
    countNo: 'SC-202603-0001',
    warehouseId: 'wh-1',
    status: 'draft',
    countDate: new Date('2026-03-15'),
    notes: null,
    createdBy: USER_ID,
    completedAt: null,
    createdAt: new Date('2026-03-15'),
    warehouse: makeWarehouse(),
    lines: [],
    _count: { lines: 0 },
    ...overrides,
  };
}

function makeCountLine(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'scl-1',
    stockCountId: 'sc-1',
    itemId: 'item-1',
    systemQty: 100,
    countedQty: null,
    variance: null,
    notes: null,
    item: { id: 'item-1', code: 'ITM-001', name: 'Widget A', unit: 'PCS' },
    ...overrides,
  };
}

function makeStockLevel(itemId: string, quantity: number) {
  return {
    id: `sl-${itemId}`,
    warehouseId: 'wh-1',
    itemId,
    quantity,
    item: { id: itemId, isActive: true },
  };
}

const createDto = {
  countNo: 'SC-202603-0001',
  warehouseId: 'wh-1',
  countDate: '2026-03-15',
} as any;

describe('StockCountService', () => {
  let service: StockCountService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockCountService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StockTxnService, useValue: mockTxnSvc },
      ],
    }).compile();

    service = module.get<StockCountService>(StockCountService);
    jest.clearAllMocks();
  });

  describe('findAll()', () => {
    it('should return stock counts with pagination metadata', async () => {
      const counts = [makeStockCount(), makeStockCount({ id: 'sc-2', countNo: 'SC-202603-0002' })];
      mockTx.stockCount.findMany.mockResolvedValue(counts);
      mockTx.stockCount.count.mockResolvedValue(2);

      const result = await service.findAll(SCHEMA, { page: 1, perPage: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({ page: 1, perPage: 20, total: 2, totalPages: 1 });
    });

    it('should apply warehouseId and status filters to the query', async () => {
      mockTx.stockCount.findMany.mockResolvedValue([]);
      mockTx.stockCount.count.mockResolvedValue(0);

      await service.findAll(SCHEMA, { warehouseId: 'wh-1', status: 'draft' });

      const findManyCall = mockTx.stockCount.findMany.mock.calls[0][0];
      expect(findManyCall.where.warehouseId).toBe('wh-1');
      expect(findManyCall.where.status).toBe('draft');
    });
  });

  describe('findById()', () => {
    it('should return a stock count with warehouse and lines', async () => {
      const sc = makeStockCount({ lines: [makeCountLine()] });
      mockTx.stockCount.findUnique.mockResolvedValue(sc);

      const result = await service.findById(SCHEMA, 'sc-1');

      expect(result.id).toBe('sc-1');
      expect(result.lines).toHaveLength(1);
    });

    it('should throw NotFoundException when stock count does not exist', async () => {
      mockTx.stockCount.findUnique.mockResolvedValue(null);

      await expect(service.findById(SCHEMA, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create()', () => {
    it('should create a stock count and pre-populate lines from active stock levels', async () => {
      mockTx.stockCount.findUnique.mockResolvedValue(null);
      mockTx.warehouse.findUnique.mockResolvedValue(makeWarehouse());
      mockTx.stockLevel.findMany.mockResolvedValue([
        makeStockLevel('item-1', 100),
        makeStockLevel('item-2', 50),
      ]);
      const created = makeStockCount({
        lines: [makeCountLine(), makeCountLine({ id: 'scl-2', itemId: 'item-2', systemQty: 50 })],
      });
      mockTx.stockCount.create.mockResolvedValue(created);

      const result = await service.create(SCHEMA, createDto, USER_ID);

      expect(mockTx.stockCount.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            countNo: 'SC-202603-0001',
            warehouseId: 'wh-1',
            status: 'draft',
            createdBy: USER_ID,
            lines: expect.objectContaining({
              create: expect.arrayContaining([
                expect.objectContaining({ itemId: 'item-1', systemQty: 100 }),
                expect.objectContaining({ itemId: 'item-2', systemQty: 50 }),
              ]),
            }),
          }),
        }),
      );
      expect(result.lines).toHaveLength(2);
    });

    it('should exclude inactive items from pre-populated lines', async () => {
      mockTx.stockCount.findUnique.mockResolvedValue(null);
      mockTx.warehouse.findUnique.mockResolvedValue(makeWarehouse());
      mockTx.stockLevel.findMany.mockResolvedValue([
        makeStockLevel('item-1', 100),
        { ...makeStockLevel('item-inactive', 0), item: { id: 'item-inactive', isActive: false } },
      ]);
      mockTx.stockCount.create.mockResolvedValue(makeStockCount({ lines: [makeCountLine()] }));

      await service.create(SCHEMA, createDto, USER_ID);

      const createCall = mockTx.stockCount.create.mock.calls[0][0];
      expect(createCall.data.lines.create).toHaveLength(1);
      expect(createCall.data.lines.create[0].itemId).toBe('item-1');
    });

    it('should throw BadRequestException when count number already exists', async () => {
      mockTx.stockCount.findUnique.mockResolvedValue(makeStockCount());

      await expect(service.create(SCHEMA, createDto, USER_ID)).rejects.toThrow(BadRequestException);
      expect(mockTx.stockCount.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when warehouse does not exist', async () => {
      mockTx.stockCount.findUnique.mockResolvedValue(null);
      mockTx.warehouse.findUnique.mockResolvedValue(null);

      await expect(service.create(SCHEMA, createDto, USER_ID)).rejects.toThrow(NotFoundException);
      expect(mockTx.stockCount.create).not.toHaveBeenCalled();
    });
  });

  describe('complete()', () => {
    it('should apply count_adjust transactions for lines with non-zero variance and mark as completed', async () => {
      const lines = [
        makeCountLine({ countedQty: 90, variance: -10 }),  // deficit
        makeCountLine({ id: 'scl-2', itemId: 'item-2', systemQty: 50, countedQty: 55, variance: 5 }),  // surplus
        makeCountLine({ id: 'scl-3', itemId: 'item-3', systemQty: 30, countedQty: 30, variance: 0 }),  // no change
      ];
      const sc = makeStockCount({ status: 'draft', lines });
      mockTx.stockCount.findUnique.mockResolvedValue(sc);
      mockTx.stockCount.update.mockResolvedValue({ ...sc, status: 'completed', completedAt: new Date() });
      mockTxnSvc._applyTransaction.mockResolvedValue({});

      const result = await service.complete(SCHEMA, 'sc-1', USER_ID);

      // Two lines have non-zero variance
      expect(mockTxnSvc._applyTransaction).toHaveBeenCalledTimes(2);
      expect(mockTxnSvc._applyTransaction).toHaveBeenCalledWith(
        mockTx,
        'item-1',
        'wh-1',
        -10,
        0,
        'count_adjust',
        'SC',
        'sc-1',
        'SC-202603-0001',
        expect.any(String),
        USER_ID,
      );
      expect(mockTx.stockCount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sc-1' },
          data: expect.objectContaining({ status: 'completed', completedAt: expect.any(Date) }),
        }),
      );
      expect(result.status).toBe('completed');
    });

    it('should skip lines where countedQty is null', async () => {
      const lines = [makeCountLine({ countedQty: null, variance: null })];
      const sc = makeStockCount({ status: 'draft', lines });
      mockTx.stockCount.findUnique.mockResolvedValue(sc);
      mockTx.stockCount.update.mockResolvedValue({ ...sc, status: 'completed' });

      await service.complete(SCHEMA, 'sc-1', USER_ID);

      expect(mockTxnSvc._applyTransaction).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when count is already completed', async () => {
      mockTx.stockCount.findUnique.mockResolvedValue(makeStockCount({ status: 'completed', lines: [] }));

      await expect(service.complete(SCHEMA, 'sc-1', USER_ID)).rejects.toThrow(BadRequestException);
      expect(mockTx.stockCount.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when stock count does not exist', async () => {
      mockTx.stockCount.findUnique.mockResolvedValue(null);

      await expect(service.complete(SCHEMA, 'nonexistent', USER_ID)).rejects.toThrow(NotFoundException);
    });

    it('should allow completing an in_progress count', async () => {
      const sc = makeStockCount({ status: 'in_progress', lines: [] });
      mockTx.stockCount.findUnique.mockResolvedValue(sc);
      mockTx.stockCount.update.mockResolvedValue({ ...sc, status: 'completed' });

      const result = await service.complete(SCHEMA, 'sc-1', USER_ID);

      expect(mockTx.stockCount.update).toHaveBeenCalled();
      expect(result.status).toBe('completed');
    });
  });
});

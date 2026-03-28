import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';

import { MrpService } from './mrp.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

const mockTx = {
  mrpRun: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  workOrder: {
    findMany: jest.fn(),
  },
  stockLevel: {
    findMany: jest.fn(),
  },
  mrpRequirement: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
};

const mockPrisma = {
  withTenantSchema: jest.fn().mockImplementation((_schema: string, fn: (tx: any) => any) =>
    fn(mockTx),
  ),
};

const SCHEMA = 'tenant_test';
const USER_ID = 'user-1';

function makeMrpRun(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'mrp-1',
    runNo: 'MRP-202603-0001',
    planningDate: new Date('2026-03-01'),
    horizon: 30,
    status: 'draft',
    notes: null,
    createdBy: USER_ID,
    createdAt: new Date('2026-03-01'),
    requirements: [],
    _count: { requirements: 0 },
    ...overrides,
  };
}

function makeComponent(id: string, code: string) {
  return { id, code, name: `Component ${code}`, unit: 'pcs' };
}

function makeWorkOrderWithBom(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'wo-1',
    woNo: 'WO-202603-0001',
    plannedQty: 100,
    status: 'released',
    plannedStart: new Date('2026-03-05'),
    bom: {
      id: 'bom-1',
      lines: [
        {
          componentId: 'comp-1',
          quantity: 2,
          component: makeComponent('comp-1', 'RM-001'),
        },
      ],
    },
    ...overrides,
  };
}

const createDto = {
  planningDate: '2026-03-01',
  horizon: 30,
  notes: null,
} as any;

describe('MrpService', () => {
  let service: MrpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MrpService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<MrpService>(MrpService);
    jest.clearAllMocks();
  });

  describe('findAll()', () => {
    it('should return paginated MRP runs with default pagination', async () => {
      const runs = [makeMrpRun()];
      mockTx.mrpRun.findMany.mockResolvedValue(runs);
      mockTx.mrpRun.count.mockResolvedValue(1);

      const result = await service.findAll(SCHEMA, {});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ page: 1, perPage: 20, total: 1, totalPages: 1 });
      expect(mockTx.mrpRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20, orderBy: { createdAt: 'desc' } }),
      );
    });

    it('should compute correct skip for page 3', async () => {
      mockTx.mrpRun.findMany.mockResolvedValue([]);
      mockTx.mrpRun.count.mockResolvedValue(0);

      await service.findAll(SCHEMA, { page: 3, perPage: 10 });

      expect(mockTx.mrpRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });
  });

  describe('findById()', () => {
    it('should return an MRP run with its requirements', async () => {
      const run = makeMrpRun({
        requirements: [{ id: 'req-1', itemCode: 'RM-001', shortageQty: 50 }],
      });
      mockTx.mrpRun.findUnique.mockResolvedValue(run);

      const result = await service.findById(SCHEMA, 'mrp-1');

      expect(mockTx.mrpRun.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'mrp-1' } }),
      );
      expect(result.id).toBe('mrp-1');
      expect(result.requirements).toHaveLength(1);
    });

    it('should throw NotFoundException when MRP run does not exist', async () => {
      mockTx.mrpRun.findUnique.mockResolvedValue(null);

      await expect(service.findById(SCHEMA, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create()', () => {
    it('should create an MRP run with a draft status and auto-generated run number', async () => {
      mockTx.mrpRun.findFirst.mockResolvedValue(null); // no prior run → seq 1
      const created = makeMrpRun({ runNo: 'MRP-202603-0001' });
      mockTx.mrpRun.create.mockResolvedValue(created);

      const result = await service.create(SCHEMA, createDto, USER_ID);

      expect(mockTx.mrpRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            planningDate: expect.any(Date),
            horizon: 30,
            status: 'draft',
            createdBy: USER_ID,
          }),
        }),
      );
      expect(result.runNo).toMatch(/^MRP-\d{6}-\d{4}$/);
      expect(result.status).toBe('draft');
    });

    it('should increment run number sequence from the last existing run', async () => {
      mockTx.mrpRun.findFirst.mockResolvedValue({ runNo: 'MRP-202603-0003' });
      const created = makeMrpRun({ runNo: 'MRP-202603-0004' });
      mockTx.mrpRun.create.mockResolvedValue(created);

      const result = await service.create(SCHEMA, createDto, USER_ID);

      expect(result.runNo).toBe('MRP-202603-0004');
    });

    it('should use default horizon of 30 when not specified in dto', async () => {
      mockTx.mrpRun.findFirst.mockResolvedValue(null);
      const created = makeMrpRun({ horizon: 30 });
      mockTx.mrpRun.create.mockResolvedValue(created);

      const dtoNoHorizon = { planningDate: '2026-03-01' } as any;
      const result = await service.create(SCHEMA, dtoNoHorizon, USER_ID);

      expect(mockTx.mrpRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ horizon: 30 }),
        }),
      );
      expect(result.horizon).toBe(30);
    });
  });

  describe('run()', () => {
    it('should compute shortages from BOM and stock, then mark run as completed', async () => {
      const draftRun = makeMrpRun({ status: 'draft', planningDate: new Date('2026-03-01'), horizon: 30 });
      mockTx.mrpRun.findUnique.mockResolvedValue(draftRun);

      // Two work orders each needing 100 units of comp-1 (bom qty=1, plannedQty=100)
      const workOrders = [
        makeWorkOrderWithBom({ bom: { id: 'bom-1', lines: [{ componentId: 'comp-1', quantity: 1, component: makeComponent('comp-1', 'RM-001') }] }, plannedQty: 100 }),
        makeWorkOrderWithBom({ id: 'wo-2', bom: { id: 'bom-1', lines: [{ componentId: 'comp-1', quantity: 1, component: makeComponent('comp-1', 'RM-001') }] }, plannedQty: 100 }),
      ];
      mockTx.workOrder.findMany.mockResolvedValue(workOrders);

      // Stock: 50 available for comp-1
      mockTx.stockLevel.findMany.mockResolvedValue([
        { itemId: 'comp-1', warehouseId: 'wh-1', quantity: 50, reservedQty: 0 },
      ]);

      mockTx.mrpRun.update
        .mockResolvedValueOnce({ ...draftRun, status: 'running' }) // first update: running
        .mockResolvedValueOnce({ ...draftRun, status: 'completed', requirements: [] }); // second: completed

      mockTx.mrpRequirement.deleteMany.mockResolvedValue({ count: 0 });
      mockTx.mrpRequirement.createMany.mockResolvedValue({ count: 1 });

      const result = await service.run(SCHEMA, 'mrp-1');

      // Should mark running first
      expect(mockTx.mrpRun.update).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ data: { status: 'running' } }),
      );

      // Should create requirements with shortage = 200 - 50 = 150
      expect(mockTx.mrpRequirement.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              itemId: 'comp-1',
              requiredQty: 200,
              availableQty: 50,
              shortageQty: 150,
            }),
          ]),
        }),
      );

      // Final status should be completed
      expect(mockTx.mrpRun.update).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ data: { status: 'completed' } }),
      );
    });

    it('should skip work orders that have no BOM', async () => {
      const draftRun = makeMrpRun({ status: 'draft', planningDate: new Date('2026-03-01'), horizon: 30 });
      mockTx.mrpRun.findUnique.mockResolvedValue(draftRun);

      // Work order without a BOM
      mockTx.workOrder.findMany.mockResolvedValue([
        { ...makeWorkOrderWithBom(), bom: null },
      ]);

      mockTx.mrpRun.update.mockResolvedValue({ ...draftRun, status: 'completed', requirements: [] });
      mockTx.mrpRequirement.deleteMany.mockResolvedValue({ count: 0 });

      await service.run(SCHEMA, 'mrp-1');

      // No requirements should be created when no BOM lines exist
      expect(mockTx.mrpRequirement.createMany).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when trying to run a completed MRP run', async () => {
      mockTx.mrpRun.findUnique.mockResolvedValue(makeMrpRun({ status: 'completed' }));

      await expect(service.run(SCHEMA, 'mrp-1')).rejects.toThrow(BadRequestException);
      expect(mockTx.workOrder.findMany).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when MRP run does not exist', async () => {
      mockTx.mrpRun.findUnique.mockResolvedValue(null);

      await expect(service.run(SCHEMA, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancel()', () => {
    it('should cancel a draft MRP run', async () => {
      mockTx.mrpRun.findUnique.mockResolvedValue(makeMrpRun({ status: 'draft' }));
      const cancelled = makeMrpRun({ status: 'cancelled' });
      mockTx.mrpRun.update.mockResolvedValue(cancelled);

      const result = await service.cancel(SCHEMA, 'mrp-1');

      expect(mockTx.mrpRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mrp-1' },
          data: { status: 'cancelled' },
        }),
      );
      expect(result.status).toBe('cancelled');
    });

    it('should cancel a running MRP run', async () => {
      mockTx.mrpRun.findUnique.mockResolvedValue(makeMrpRun({ status: 'running' }));
      mockTx.mrpRun.update.mockResolvedValue(makeMrpRun({ status: 'cancelled' }));

      const result = await service.cancel(SCHEMA, 'mrp-1');

      expect(result.status).toBe('cancelled');
    });

    it('should throw BadRequestException when cancelling a completed MRP run', async () => {
      mockTx.mrpRun.findUnique.mockResolvedValue(makeMrpRun({ status: 'completed' }));

      await expect(service.cancel(SCHEMA, 'mrp-1')).rejects.toThrow(BadRequestException);
      expect(mockTx.mrpRun.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when cancelling an already-cancelled MRP run', async () => {
      mockTx.mrpRun.findUnique.mockResolvedValue(makeMrpRun({ status: 'cancelled' }));

      await expect(service.cancel(SCHEMA, 'mrp-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when MRP run does not exist', async () => {
      mockTx.mrpRun.findUnique.mockResolvedValue(null);

      await expect(service.cancel(SCHEMA, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});

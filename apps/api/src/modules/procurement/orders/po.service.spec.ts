import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

import { PurchaseOrderService, PO_STATUS } from './po.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

const mockTx = {
  purchaseOrder: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  supplier: {
    findFirst: jest.fn(),
  },
  purchaseRequisition: {
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

function makeSupplier(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'sup-1',
    code: 'SUP-001',
    name: 'Test Supplier Co.',
    currency: 'TWD',
    isActive: true,
    deletedAt: null,
    ...overrides,
  };
}

function makePO(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'po-1',
    poNo: 'PO-202603-0001',
    supplierId: 'sup-1',
    prId: null,
    status: PO_STATUS.DRAFT,
    orderDate: new Date('2026-03-01'),
    expectedDate: null,
    currency: 'TWD',
    subtotal: 1000,
    taxAmount: 50,
    total: 1050,
    notes: null,
    createdBy: USER_ID,
    approvedBy: null,
    approvedAt: null,
    deletedAt: null,
    createdAt: new Date('2026-03-01'),
    supplier: makeSupplier(),
    lines: [],
    goodsReceipts: [],
    ...overrides,
  };
}

function makePOLine(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'pol-1',
    poId: 'po-1',
    lineNo: 1,
    itemCode: 'ITM-001',
    itemName: 'Widget A',
    spec: null,
    unit: 'PCS',
    quantity: 10,
    unitPrice: 100,
    amount: 1000,
    receivedQty: 0,
    notes: null,
    ...overrides,
  };
}

const createDto = {
  poNo: 'PO-202603-0001',
  supplierId: 'sup-1',
  orderDate: '2026-03-01',
  lines: [
    { lineNo: 1, itemCode: 'ITM-001', itemName: 'Widget A', unit: 'PCS', quantity: 10, unitPrice: 100 },
  ],
} as any;

describe('PurchaseOrderService', () => {
  let service: PurchaseOrderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrderService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PurchaseOrderService>(PurchaseOrderService);
    jest.clearAllMocks();
  });

  describe('findAll()', () => {
    it('should return purchase orders with pagination metadata', async () => {
      const orders = [makePO(), makePO({ id: 'po-2', poNo: 'PO-202603-0002' })];
      mockTx.purchaseOrder.findMany.mockResolvedValue(orders);
      mockTx.purchaseOrder.count.mockResolvedValue(2);

      const result = await service.findAll(SCHEMA, { page: 1, perPage: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({ page: 1, perPage: 20, total: 2, totalPages: 1 });
    });

    it('should apply status and supplierId filters to the query', async () => {
      mockTx.purchaseOrder.findMany.mockResolvedValue([]);
      mockTx.purchaseOrder.count.mockResolvedValue(0);

      await service.findAll(SCHEMA, { status: PO_STATUS.APPROVED, supplierId: 'sup-1' });

      const findManyCall = mockTx.purchaseOrder.findMany.mock.calls[0][0];
      expect(findManyCall.where.status).toBe(PO_STATUS.APPROVED);
      expect(findManyCall.where.supplierId).toBe('sup-1');
    });
  });

  describe('findById()', () => {
    it('should return a purchase order with supplier and lines', async () => {
      const po = makePO({ lines: [makePOLine()] });
      mockTx.purchaseOrder.findFirst.mockResolvedValue(po);

      const result = await service.findById(SCHEMA, 'po-1');

      expect(result.id).toBe('po-1');
      expect(result.lines).toHaveLength(1);
    });

    it('should throw NotFoundException when PO does not exist', async () => {
      mockTx.purchaseOrder.findFirst.mockResolvedValue(null);

      await expect(service.findById(SCHEMA, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create()', () => {
    it('should create a PO in draft status with calculated totals', async () => {
      mockTx.purchaseOrder.findUnique.mockResolvedValue(null);
      mockTx.supplier.findFirst.mockResolvedValue(makeSupplier());
      const created = makePO({ subtotal: 1000, taxAmount: 50, total: 1050 });
      mockTx.purchaseOrder.create.mockResolvedValue(created);

      const result = await service.create(SCHEMA, createDto, USER_ID);

      expect(mockTx.purchaseOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: PO_STATUS.DRAFT,
            createdBy: USER_ID,
            subtotal: 1000,
            taxAmount: 50,
            total: 1050,
          }),
        }),
      );
      expect(result.status).toBe(PO_STATUS.DRAFT);
    });

    it('should throw ConflictException when PO number already exists', async () => {
      mockTx.purchaseOrder.findUnique.mockResolvedValue(makePO());

      await expect(service.create(SCHEMA, createDto, USER_ID)).rejects.toThrow(ConflictException);
      expect(mockTx.purchaseOrder.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when supplier is not found or inactive', async () => {
      mockTx.purchaseOrder.findUnique.mockResolvedValue(null);
      mockTx.supplier.findFirst.mockResolvedValue(null);

      await expect(service.create(SCHEMA, createDto, USER_ID)).rejects.toThrow(NotFoundException);
      expect(mockTx.purchaseOrder.create).not.toHaveBeenCalled();
    });

    it('should mark the source PR as converted when prId is provided', async () => {
      const dtoWithPr = { ...createDto, prId: 'pr-1' };
      mockTx.purchaseOrder.findUnique.mockResolvedValue(null);
      mockTx.supplier.findFirst.mockResolvedValue(makeSupplier());
      mockTx.purchaseOrder.create.mockResolvedValue(makePO({ prId: 'pr-1' }));
      mockTx.purchaseRequisition.update.mockResolvedValue({});

      await service.create(SCHEMA, dtoWithPr, USER_ID);

      expect(mockTx.purchaseRequisition.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pr-1' },
          data: { status: 'converted' },
        }),
      );
    });
  });

  describe('approve()', () => {
    it('should transition a pending PO to approved', async () => {
      const pendingPO = makePO({ status: PO_STATUS.PENDING_APPROVAL });
      const approvedPO = makePO({ status: PO_STATUS.APPROVED, approvedBy: USER_ID, approvedAt: new Date() });
      mockTx.purchaseOrder.findFirst.mockResolvedValue(pendingPO);
      mockTx.purchaseOrder.update.mockResolvedValue(approvedPO);

      const result = await service.approve(SCHEMA, 'po-1', USER_ID);

      expect(mockTx.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'po-1' },
          data: expect.objectContaining({
            status: PO_STATUS.APPROVED,
            approvedBy: USER_ID,
            approvedAt: expect.any(Date),
          }),
        }),
      );
      expect(result.status).toBe(PO_STATUS.APPROVED);
    });

    it('should throw BadRequestException when PO is not in pending_approval status', async () => {
      const draftPO = makePO({ status: PO_STATUS.DRAFT });
      mockTx.purchaseOrder.findFirst.mockResolvedValue(draftPO);

      await expect(service.approve(SCHEMA, 'po-1', USER_ID)).rejects.toThrow(BadRequestException);
      expect(mockTx.purchaseOrder.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when PO does not exist', async () => {
      mockTx.purchaseOrder.findFirst.mockResolvedValue(null);

      await expect(service.approve(SCHEMA, 'nonexistent', USER_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('submit()', () => {
    it('should transition a draft PO to pending_approval', async () => {
      const draftPO = makePO({ status: PO_STATUS.DRAFT });
      const pendingPO = makePO({ status: PO_STATUS.PENDING_APPROVAL });
      mockTx.purchaseOrder.findFirst.mockResolvedValue(draftPO);
      mockTx.purchaseOrder.update.mockResolvedValue(pendingPO);

      const result = await service.submit(SCHEMA, 'po-1');

      expect(mockTx.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'po-1' },
          data: { status: PO_STATUS.PENDING_APPROVAL },
        }),
      );
      expect(result.status).toBe(PO_STATUS.PENDING_APPROVAL);
    });

    it('should throw BadRequestException when PO is not in draft status', async () => {
      const approvedPO = makePO({ status: PO_STATUS.APPROVED });
      mockTx.purchaseOrder.findFirst.mockResolvedValue(approvedPO);

      await expect(service.submit(SCHEMA, 'po-1')).rejects.toThrow(BadRequestException);
    });
  });
});

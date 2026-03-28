import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

import { SalesOrderService, SO_STATUSES } from './so.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

const mockTx = {
  salesOrder: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  customer: {
    findFirst: jest.fn(),
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

function makeCustomer(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'cust-1',
    code: 'CUST-001',
    name: 'Test Customer',
    currency: 'TWD',
    creditLimit: 100000,
    creditBalance: 0,
    address: '456 Customer Ave',
    isActive: true,
    deletedAt: null,
    ...overrides,
  };
}

function makeSO(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'so-1',
    orderNo: 'SO-202603-0001',
    customerId: 'cust-1',
    status: SO_STATUSES.DRAFT,
    orderDate: new Date('2026-03-01'),
    requestedDate: null,
    shippingAddress: '456 Customer Ave',
    currency: 'TWD',
    subtotal: 1000,
    taxAmount: 50,
    total: 1050,
    creditChecked: true,
    notes: null,
    createdBy: USER_ID,
    approvedBy: null,
    approvedAt: null,
    deletedAt: null,
    createdAt: new Date('2026-03-01'),
    customer: makeCustomer(),
    lines: [],
    deliveryOrders: [],
    ...overrides,
  };
}

function makeSOLine(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'sol-1',
    salesOrderId: 'so-1',
    lineNo: 1,
    itemCode: 'ITM-001',
    itemName: 'Widget A',
    unit: 'PCS',
    quantity: 10,
    unitPrice: 100,
    discount: 0,
    amount: 1000,
    ...overrides,
  };
}

const createDto = {
  orderNo: 'SO-202603-0001',
  customerId: 'cust-1',
  orderDate: '2026-03-01',
  lines: [
    { lineNo: 1, itemCode: 'ITM-001', itemName: 'Widget A', unit: 'PCS', quantity: 10, unitPrice: 100 },
  ],
} as any;

describe('SalesOrderService', () => {
  let service: SalesOrderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesOrderService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SalesOrderService>(SalesOrderService);
    jest.clearAllMocks();
  });

  describe('findAll()', () => {
    it('should return sales orders with pagination metadata', async () => {
      const orders = [makeSO(), makeSO({ id: 'so-2', orderNo: 'SO-202603-0002' })];
      mockTx.salesOrder.findMany.mockResolvedValue(orders);
      mockTx.salesOrder.count.mockResolvedValue(2);

      const result = await service.findAll(SCHEMA, { page: 1, perPage: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({ page: 1, perPage: 20, total: 2, totalPages: 1 });
    });

    it('should apply status filter to the query', async () => {
      mockTx.salesOrder.findMany.mockResolvedValue([]);
      mockTx.salesOrder.count.mockResolvedValue(0);

      await service.findAll(SCHEMA, { status: SO_STATUSES.APPROVED });

      const findManyCall = mockTx.salesOrder.findMany.mock.calls[0][0];
      expect(findManyCall.where.status).toBe(SO_STATUSES.APPROVED);
    });

    it('should apply customerId and date range filters to the query', async () => {
      mockTx.salesOrder.findMany.mockResolvedValue([]);
      mockTx.salesOrder.count.mockResolvedValue(0);

      await service.findAll(SCHEMA, {
        customerId: 'cust-1',
        fromDate: '2026-03-01',
        toDate: '2026-03-31',
      });

      const findManyCall = mockTx.salesOrder.findMany.mock.calls[0][0];
      expect(findManyCall.where.customerId).toBe('cust-1');
      expect(findManyCall.where.orderDate.gte).toEqual(new Date('2026-03-01'));
      expect(findManyCall.where.orderDate.lte).toEqual(new Date('2026-03-31'));
    });
  });

  describe('findById()', () => {
    it('should return a sales order with customer, lines, and delivery orders', async () => {
      const so = makeSO({ lines: [makeSOLine()] });
      mockTx.salesOrder.findFirst.mockResolvedValue(so);

      const result = await service.findById(SCHEMA, 'so-1');

      expect(result.id).toBe('so-1');
      expect(result.lines).toHaveLength(1);
    });

    it('should throw NotFoundException when sales order does not exist', async () => {
      mockTx.salesOrder.findFirst.mockResolvedValue(null);

      await expect(service.findById(SCHEMA, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create()', () => {
    it('should create a SO in draft status with calculated totals', async () => {
      mockTx.salesOrder.findUnique.mockResolvedValue(null);
      mockTx.customer.findFirst.mockResolvedValue(makeCustomer());
      const created = makeSO({ subtotal: 1000, taxAmount: 50, total: 1050 });
      mockTx.salesOrder.create.mockResolvedValue(created);
      mockTx.customer.update.mockResolvedValue({});

      const result = await service.create(SCHEMA, createDto, USER_ID);

      expect(mockTx.salesOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: SO_STATUSES.DRAFT,
            createdBy: USER_ID,
            subtotal: 1000,
            taxAmount: 50,
            total: 1050,
          }),
        }),
      );
      expect(result.status).toBe(SO_STATUSES.DRAFT);
    });

    it('should update the customer credit balance after creation', async () => {
      mockTx.salesOrder.findUnique.mockResolvedValue(null);
      mockTx.customer.findFirst.mockResolvedValue(makeCustomer());
      mockTx.salesOrder.create.mockResolvedValue(makeSO({ total: 1050 }));
      mockTx.customer.update.mockResolvedValue({});

      await service.create(SCHEMA, createDto, USER_ID);

      expect(mockTx.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cust-1' },
          data: { creditBalance: { increment: 1050 } },
        }),
      );
    });

    it('should throw ConflictException when order number already exists', async () => {
      mockTx.salesOrder.findUnique.mockResolvedValue(makeSO());

      await expect(service.create(SCHEMA, createDto, USER_ID)).rejects.toThrow(ConflictException);
      expect(mockTx.salesOrder.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when customer is not found or inactive', async () => {
      mockTx.salesOrder.findUnique.mockResolvedValue(null);
      mockTx.customer.findFirst.mockResolvedValue(null);

      await expect(service.create(SCHEMA, createDto, USER_ID)).rejects.toThrow(NotFoundException);
      expect(mockTx.salesOrder.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when customer credit limit is exceeded', async () => {
      const lowCreditCustomer = makeCustomer({ creditLimit: 100, creditBalance: 99 });
      mockTx.salesOrder.findUnique.mockResolvedValue(null);
      mockTx.customer.findFirst.mockResolvedValue(lowCreditCustomer);

      await expect(service.create(SCHEMA, createDto, USER_ID)).rejects.toThrow(BadRequestException);
      expect(mockTx.salesOrder.create).not.toHaveBeenCalled();
    });
  });

  describe('approve()', () => {
    it('should transition a pending SO to approved', async () => {
      const pendingSO = makeSO({ status: SO_STATUSES.PENDING_APPROVAL });
      const approvedSO = makeSO({ status: SO_STATUSES.APPROVED, approvedBy: USER_ID, approvedAt: new Date() });
      mockTx.salesOrder.findFirst.mockResolvedValue(pendingSO);
      mockTx.salesOrder.update.mockResolvedValue(approvedSO);

      const result = await service.approve(SCHEMA, 'so-1', USER_ID);

      expect(mockTx.salesOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'so-1' },
          data: expect.objectContaining({
            status: SO_STATUSES.APPROVED,
            approvedBy: USER_ID,
            approvedAt: expect.any(Date),
          }),
        }),
      );
      expect(result.status).toBe(SO_STATUSES.APPROVED);
    });

    it('should throw BadRequestException when SO is not in pending_approval status', async () => {
      const draftSO = makeSO({ status: SO_STATUSES.DRAFT });
      mockTx.salesOrder.findFirst.mockResolvedValue(draftSO);

      await expect(service.approve(SCHEMA, 'so-1', USER_ID)).rejects.toThrow(BadRequestException);
      expect(mockTx.salesOrder.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when SO does not exist', async () => {
      mockTx.salesOrder.findFirst.mockResolvedValue(null);

      await expect(service.approve(SCHEMA, 'nonexistent', USER_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('submit()', () => {
    it('should transition a draft SO to pending_approval', async () => {
      const draftSO = makeSO({ status: SO_STATUSES.DRAFT });
      const pendingSO = makeSO({ status: SO_STATUSES.PENDING_APPROVAL });
      mockTx.salesOrder.findFirst.mockResolvedValue(draftSO);
      mockTx.salesOrder.update.mockResolvedValue(pendingSO);

      const result = await service.submit(SCHEMA, 'so-1');

      expect(mockTx.salesOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'so-1' },
          data: { status: SO_STATUSES.PENDING_APPROVAL },
        }),
      );
      expect(result.status).toBe(SO_STATUSES.PENDING_APPROVAL);
    });

    it('should throw BadRequestException when SO is not in draft status', async () => {
      const approvedSO = makeSO({ status: SO_STATUSES.APPROVED });
      mockTx.salesOrder.findFirst.mockResolvedValue(approvedSO);

      await expect(service.submit(SCHEMA, 'so-1')).rejects.toThrow(BadRequestException);
    });
  });
});

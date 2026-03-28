import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';

import { OrderService } from './order.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

const mockTx = {
  posOrder: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  posSession: {
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

function makeSession(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'sess-1',
    sessionNo: 'POS-20260328-1234',
    cashierId: 'user-1',
    cashierName: 'Bob',
    status: 'open',
    openingCash: 5000,
    totalSales: 0,
    totalOrders: 0,
    openedAt: new Date('2026-03-28T08:00:00Z'),
    closedAt: null,
    ...overrides,
  };
}

function makeOrder(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'ord-1',
    orderNo: 'ORD-20260328-11111',
    sessionId: 'sess-1',
    subtotal: 100,
    taxAmount: 5,
    discountAmount: 0,
    totalAmount: 105,
    paidAmount: 110,
    changeAmount: 5,
    paymentMethod: 'cash',
    customerId: null,
    status: 'completed',
    voidReason: null,
    createdAt: new Date('2026-03-28T09:00:00Z'),
    session: { id: 'sess-1', sessionNo: 'POS-20260328-1234', cashierName: 'Bob' },
    lines: [
      {
        id: 'line-1',
        orderId: 'ord-1',
        itemId: 'item-1',
        itemCode: 'SKU-001',
        itemName: 'Coffee',
        quantity: 2,
        unitPrice: 50,
        discount: 0,
        amount: 100,
      },
    ],
    ...overrides,
  };
}

const createDto = {
  sessionId: 'sess-1',
  paymentMethod: 'cash',
  paidAmount: 110,
  lines: [
    {
      itemId: 'item-1',
      itemCode: 'SKU-001',
      itemName: 'Coffee',
      quantity: 2,
      unitPrice: 50,
      discount: 0,
    },
  ],
} as any;

describe('OrderService', () => {
  let service: OrderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    jest.clearAllMocks();
  });

  describe('findAll()', () => {
    it('should return paginated orders with metadata', async () => {
      const orders = [makeOrder(), makeOrder({ id: 'ord-2', orderNo: 'ORD-20260328-22222' })];
      mockTx.posOrder.findMany.mockResolvedValue(orders);
      mockTx.posOrder.count.mockResolvedValue(2);

      const result = await service.findAll(SCHEMA, { page: 1, perPage: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({ page: 1, perPage: 20, total: 2, totalPages: 1 });
    });

    it('should pass sessionId filter to the query', async () => {
      mockTx.posOrder.findMany.mockResolvedValue([]);
      mockTx.posOrder.count.mockResolvedValue(0);

      await service.findAll(SCHEMA, { sessionId: 'sess-1' });

      const findManyCall = mockTx.posOrder.findMany.mock.calls[0][0];
      expect(findManyCall.where.sessionId).toBe('sess-1');
    });

    it('should pass status filter to the query', async () => {
      mockTx.posOrder.findMany.mockResolvedValue([]);
      mockTx.posOrder.count.mockResolvedValue(0);

      await service.findAll(SCHEMA, { status: 'voided' });

      const findManyCall = mockTx.posOrder.findMany.mock.calls[0][0];
      expect(findManyCall.where.status).toBe('voided');
    });
  });

  describe('findById()', () => {
    it('should return the order with lines and session when found', async () => {
      mockTx.posOrder.findUnique.mockResolvedValue(makeOrder());

      const result = await service.findById(SCHEMA, 'ord-1');

      expect(result.id).toBe('ord-1');
      expect(result.lines).toHaveLength(1);
      expect(result.session.sessionNo).toBe('POS-20260328-1234');
    });

    it('should throw NotFoundException when order does not exist', async () => {
      mockTx.posOrder.findUnique.mockResolvedValue(null);

      await expect(service.findById(SCHEMA, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create()', () => {
    it('should generate an order number and calculate totals with TAX_RATE 5%', async () => {
      mockTx.posSession.findUnique.mockResolvedValue(makeSession());
      // No duplicate order number
      mockTx.posOrder.findUnique.mockResolvedValue(null);
      const created = makeOrder();
      mockTx.posOrder.create.mockResolvedValue(created);
      mockTx.posSession.update.mockResolvedValue(makeSession());

      const result = await service.create(SCHEMA, createDto);

      const createCall = mockTx.posOrder.create.mock.calls[0][0];
      // subtotal = 2 * 50 = 100; tax = 100 * 0.05 = 5; total = 105
      expect(createCall.data.subtotal).toBe(100);
      expect(createCall.data.taxAmount).toBe(5);
      expect(createCall.data.totalAmount).toBe(105);
      expect(createCall.data.orderNo).toMatch(/^ORD-\d{8}-\d{5}$/);
      expect(result.totalAmount).toBe(105);
    });

    it('should throw NotFoundException when session does not exist', async () => {
      mockTx.posSession.findUnique.mockResolvedValue(null);

      await expect(service.create(SCHEMA, createDto)).rejects.toThrow(NotFoundException);
      expect(mockTx.posOrder.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when session is not open', async () => {
      mockTx.posSession.findUnique.mockResolvedValue(makeSession({ status: 'closed' }));

      await expect(service.create(SCHEMA, createDto)).rejects.toThrow(BadRequestException);
      expect(mockTx.posOrder.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when order has no lines', async () => {
      mockTx.posSession.findUnique.mockResolvedValue(makeSession());

      await expect(service.create(SCHEMA, { ...createDto, lines: [] })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when paidAmount is less than totalAmount', async () => {
      mockTx.posSession.findUnique.mockResolvedValue(makeSession());
      mockTx.posOrder.findUnique.mockResolvedValue(null);

      // total = 105 but paid only 100
      await expect(
        service.create(SCHEMA, { ...createDto, paidAmount: 100 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update session totalSales and totalOrders after creating order', async () => {
      mockTx.posSession.findUnique.mockResolvedValue(makeSession());
      mockTx.posOrder.findUnique.mockResolvedValue(null);
      mockTx.posOrder.create.mockResolvedValue(makeOrder());
      mockTx.posSession.update.mockResolvedValue(makeSession());

      await service.create(SCHEMA, createDto);

      expect(mockTx.posSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sess-1' },
          data: expect.objectContaining({
            totalSales: { increment: 105 },
            totalOrders: { increment: 1 },
          }),
        }),
      );
    });
  });

  describe('void()', () => {
    it('should set order status to voided and decrement session totals', async () => {
      const order = makeOrder({ totalAmount: 105, sessionId: 'sess-1' });
      mockTx.posOrder.findUnique.mockResolvedValue(order);
      const voided = makeOrder({ status: 'voided', voidReason: 'Customer request' });
      mockTx.posOrder.update.mockResolvedValue(voided);
      mockTx.posSession.update.mockResolvedValue(makeSession());

      const result = await service.void(SCHEMA, 'ord-1', 'Customer request');

      expect(mockTx.posOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ord-1' },
          data: { status: 'voided', voidReason: 'Customer request' },
        }),
      );
      expect(mockTx.posSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sess-1' },
          data: expect.objectContaining({
            totalSales: { decrement: 105 },
            totalOrders: { decrement: 1 },
          }),
        }),
      );
      expect(result.status).toBe('voided');
    });

    it('should throw BadRequestException when order is already voided', async () => {
      mockTx.posOrder.findUnique.mockResolvedValue(makeOrder({ status: 'voided' }));

      await expect(service.void(SCHEMA, 'ord-1', 'Duplicate void')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockTx.posOrder.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when order does not exist', async () => {
      mockTx.posOrder.findUnique.mockResolvedValue(null);

      await expect(service.void(SCHEMA, 'nonexistent', 'reason')).rejects.toThrow(NotFoundException);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';

import { SessionService } from './session.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

const mockTx = {
  posSession: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
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
const USER_ID = 'user-1';

function makeSession(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'sess-1',
    sessionNo: 'POS-20260328-1234',
    cashierId: USER_ID,
    cashierName: 'Bob',
    status: 'open',
    openingCash: 5000,
    closingCash: null,
    totalSales: 0,
    totalOrders: 0,
    notes: null,
    openedAt: new Date('2026-03-28T08:00:00Z'),
    closedAt: null,
    updatedAt: new Date('2026-03-28T08:00:00Z'),
    _count: { orders: 0 },
    orders: [],
    ...overrides,
  };
}

const openDto = {
  cashierName: 'Bob',
  openingCash: 5000,
} as any;

const closeDto = {
  closingCash: 5800,
  notes: 'Normal close',
} as any;

describe('SessionService', () => {
  let service: SessionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
    jest.clearAllMocks();
  });

  describe('findAll()', () => {
    it('should return paginated sessions with metadata', async () => {
      const sessions = [makeSession(), makeSession({ id: 'sess-2', sessionNo: 'POS-20260328-5678' })];
      mockTx.posSession.findMany.mockResolvedValue(sessions);
      mockTx.posSession.count.mockResolvedValue(2);

      const result = await service.findAll(SCHEMA, { page: 1, perPage: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({ page: 1, perPage: 20, total: 2, totalPages: 1 });
    });

    it('should pass status filter to the query', async () => {
      mockTx.posSession.findMany.mockResolvedValue([]);
      mockTx.posSession.count.mockResolvedValue(0);

      await service.findAll(SCHEMA, { status: 'closed' });

      const findManyCall = mockTx.posSession.findMany.mock.calls[0][0];
      expect(findManyCall.where.status).toBe('closed');
    });

    it('should return empty data with correct meta when no sessions exist', async () => {
      mockTx.posSession.findMany.mockResolvedValue([]);
      mockTx.posSession.count.mockResolvedValue(0);

      const result = await service.findAll(SCHEMA, { page: 1, perPage: 20 });

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });
  });

  describe('findById()', () => {
    it('should return the session with orders when found', async () => {
      const session = makeSession({
        orders: [
          {
            id: 'ord-1',
            orderNo: 'ORD-20260328-11111',
            totalAmount: 105,
            paymentMethod: 'cash',
            status: 'completed',
            createdAt: new Date(),
          },
        ],
        _count: { orders: 1 },
      });
      mockTx.posSession.findUnique.mockResolvedValue(session);

      const result = await service.findById(SCHEMA, 'sess-1');

      expect(result.id).toBe('sess-1');
      expect(result.orders).toHaveLength(1);
      expect(result.sessionNo).toMatch(/^POS-/);
    });

    it('should throw NotFoundException when session does not exist', async () => {
      mockTx.posSession.findUnique.mockResolvedValue(null);

      await expect(service.findById(SCHEMA, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('open()', () => {
    it('should generate a sessionNo and create the session', async () => {
      // no existing open session
      mockTx.posSession.findFirst.mockResolvedValue(null);
      // no duplicate sessionNo
      mockTx.posSession.findUnique.mockResolvedValue(null);
      const created = makeSession({ cashierName: 'Bob', openingCash: 5000 });
      mockTx.posSession.create.mockResolvedValue(created);

      const result = await service.open(SCHEMA, openDto, USER_ID);

      expect(mockTx.posSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sessionNo: expect.stringMatching(/^POS-\d{8}-\d{4}$/),
            cashierId: USER_ID,
            cashierName: 'Bob',
            openingCash: 5000,
            status: 'open',
          }),
        }),
      );
      expect(result.sessionNo).toMatch(/^POS-/);
      expect(result.status).toBe('open');
    });

    it('should throw ConflictException when the cashier already has an open session', async () => {
      mockTx.posSession.findFirst.mockResolvedValue(makeSession({ status: 'open' }));

      await expect(service.open(SCHEMA, openDto, USER_ID)).rejects.toThrow(ConflictException);
      expect(mockTx.posSession.create).not.toHaveBeenCalled();
    });
  });

  describe('close()', () => {
    it('should set status to closed, record closedAt and closingCash', async () => {
      const existing = makeSession({ status: 'open', totalSales: 800, totalOrders: 8 });
      const closed = makeSession({
        status: 'closed',
        closedAt: new Date(),
        closingCash: 5800,
        notes: 'Normal close',
      });
      mockTx.posSession.findUnique.mockResolvedValue(existing);
      mockTx.posSession.update.mockResolvedValue(closed);

      const result = await service.close(SCHEMA, 'sess-1', closeDto);

      expect(mockTx.posSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sess-1' },
          data: expect.objectContaining({
            status: 'closed',
            closedAt: expect.any(Date),
            closingCash: 5800,
            notes: 'Normal close',
          }),
        }),
      );
      expect(result.status).toBe('closed');
      expect(result.closingCash).toBe(5800);
    });

    it('should throw BadRequestException when session is already closed', async () => {
      mockTx.posSession.findUnique.mockResolvedValue(makeSession({ status: 'closed' }));

      await expect(service.close(SCHEMA, 'sess-1', closeDto)).rejects.toThrow(BadRequestException);
      expect(mockTx.posSession.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when session does not exist', async () => {
      mockTx.posSession.findUnique.mockResolvedValue(null);

      await expect(service.close(SCHEMA, 'nonexistent', closeDto)).rejects.toThrow(NotFoundException);
    });
  });
});

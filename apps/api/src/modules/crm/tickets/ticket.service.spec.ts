import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

import { TicketService } from './ticket.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

const mockTx = {
  serviceTicket: {
    findMany: jest.fn(),
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

function makeTicket(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'tkt-1',
    ticketNo: 'TKT-000001',
    title: 'Cannot login',
    description: 'User gets 403 on login page',
    type: 'incident',
    priority: 'high',
    status: 'open',
    customerId: 'cust-1',
    leadId: null,
    assignedTo: USER_ID,
    createdBy: USER_ID,
    resolvedAt: null,
    closedAt: null,
    deletedAt: null,
    createdAt: new Date('2026-03-20'),
    ...overrides,
  };
}

const createDto = {
  title: 'Printer not working',
  description: 'Office printer shows error code E01',
  type: 'incident',
  priority: 'medium',
  customerId: 'cust-2',
} as any;

describe('TicketService', () => {
  let service: TicketService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TicketService>(TicketService);
    jest.clearAllMocks();
  });

  describe('findAll()', () => {
    it('should return paginated tickets with metadata', async () => {
      const tickets = [makeTicket(), makeTicket({ id: 'tkt-2', ticketNo: 'TKT-000002' })];
      mockTx.serviceTicket.findMany.mockResolvedValue(tickets);
      mockTx.serviceTicket.count.mockResolvedValue(2);

      const result = await service.findAll(SCHEMA, { page: 1, perPage: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({ page: 1, perPage: 20, total: 2, totalPages: 1 });
    });

    it('should pass status and priority filters to the query', async () => {
      mockTx.serviceTicket.findMany.mockResolvedValue([]);
      mockTx.serviceTicket.count.mockResolvedValue(0);

      await service.findAll(SCHEMA, { status: 'open', priority: 'high' });

      const findManyCall = mockTx.serviceTicket.findMany.mock.calls[0][0];
      expect(findManyCall.where.status).toBe('open');
      expect(findManyCall.where.priority).toBe('high');
      // Soft-delete guard must always be present
      expect(findManyCall.where.deletedAt).toBeNull();
    });
  });

  describe('findById()', () => {
    it('should return the ticket when found', async () => {
      mockTx.serviceTicket.findFirst.mockResolvedValue(makeTicket());

      const result = await service.findById(SCHEMA, 'tkt-1');

      expect(result.id).toBe('tkt-1');
      expect(result.ticketNo).toBe('TKT-000001');
    });

    it('should throw NotFoundException when ticket does not exist or is soft-deleted', async () => {
      mockTx.serviceTicket.findFirst.mockResolvedValue(null);

      await expect(service.findById(SCHEMA, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create()', () => {
    it('should generate a sequential ticketNo and create the ticket', async () => {
      // count() is used to determine the next sequence number
      mockTx.serviceTicket.count.mockResolvedValue(5);
      const created = makeTicket({ id: 'tkt-6', ticketNo: 'TKT-000006', title: 'Printer not working' });
      mockTx.serviceTicket.create.mockResolvedValue(created);

      const result = await service.create(SCHEMA, createDto, USER_ID);

      expect(mockTx.serviceTicket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ticketNo: 'TKT-000006',
            title: 'Printer not working',
            createdBy: USER_ID,
          }),
        }),
      );
      expect(result.ticketNo).toBe('TKT-000006');
    });

    it('should use the creator as assignedTo when not explicitly set', async () => {
      mockTx.serviceTicket.count.mockResolvedValue(0);
      const created = makeTicket({ assignedTo: USER_ID });
      mockTx.serviceTicket.create.mockResolvedValue(created);

      await service.create(SCHEMA, createDto, USER_ID);

      expect(mockTx.serviceTicket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ assignedTo: USER_ID }),
        }),
      );
    });
  });

  describe('update()', () => {
    it('should update and return the ticket', async () => {
      const existing = makeTicket();
      const updated = makeTicket({ priority: 'low' });
      mockTx.serviceTicket.findFirst.mockResolvedValue(existing);
      mockTx.serviceTicket.update.mockResolvedValue(updated);

      const result = await service.update(SCHEMA, 'tkt-1', { priority: 'low' });

      expect(mockTx.serviceTicket.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'tkt-1' } }),
      );
      expect(result.priority).toBe('low');
    });

    it('should throw NotFoundException when ticket does not exist', async () => {
      mockTx.serviceTicket.findFirst.mockResolvedValue(null);

      await expect(service.update(SCHEMA, 'nonexistent', {})).rejects.toThrow(NotFoundException);
      expect(mockTx.serviceTicket.update).not.toHaveBeenCalled();
    });
  });

  describe('resolve()', () => {
    it('should set status to resolved and record resolvedAt timestamp', async () => {
      const existing = makeTicket({ status: 'open' });
      const resolved = makeTicket({ status: 'resolved', resolvedAt: new Date() });
      mockTx.serviceTicket.findFirst.mockResolvedValue(existing);
      mockTx.serviceTicket.update.mockResolvedValue(resolved);

      const result = await service.resolve(SCHEMA, 'tkt-1');

      expect(mockTx.serviceTicket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tkt-1' },
          data: expect.objectContaining({
            status: 'resolved',
            resolvedAt: expect.any(Date),
          }),
        }),
      );
      expect(result.status).toBe('resolved');
    });

    it('should throw NotFoundException when ticket does not exist', async () => {
      mockTx.serviceTicket.findFirst.mockResolvedValue(null);

      await expect(service.resolve(SCHEMA, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('close()', () => {
    it('should set status to closed and record closedAt timestamp', async () => {
      const existing = makeTicket({ status: 'resolved', resolvedAt: new Date('2026-03-25') });
      const closed = makeTicket({ status: 'closed', closedAt: new Date(), resolvedAt: new Date('2026-03-25') });
      mockTx.serviceTicket.findFirst.mockResolvedValue(existing);
      mockTx.serviceTicket.update.mockResolvedValue(closed);

      const result = await service.close(SCHEMA, 'tkt-1');

      expect(mockTx.serviceTicket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tkt-1' },
          data: expect.objectContaining({
            status: 'closed',
            closedAt: expect.any(Date),
          }),
        }),
      );
      expect(result.status).toBe('closed');
    });

    it('should throw NotFoundException when ticket does not exist', async () => {
      mockTx.serviceTicket.findFirst.mockResolvedValue(null);

      await expect(service.close(SCHEMA, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove()', () => {
    it('should soft-delete the ticket by setting deletedAt', async () => {
      const existing = makeTicket();
      const softDeleted = makeTicket({ deletedAt: new Date() });
      mockTx.serviceTicket.findFirst.mockResolvedValue(existing);
      mockTx.serviceTicket.update.mockResolvedValue(softDeleted);

      const result = await service.remove(SCHEMA, 'tkt-1');

      expect(mockTx.serviceTicket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tkt-1' },
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      );
      expect(result.deletedAt).not.toBeNull();
    });

    it('should throw NotFoundException when ticket does not exist', async () => {
      mockTx.serviceTicket.findFirst.mockResolvedValue(null);

      await expect(service.remove(SCHEMA, 'nonexistent')).rejects.toThrow(NotFoundException);
      expect(mockTx.serviceTicket.update).not.toHaveBeenCalled();
    });
  });
});

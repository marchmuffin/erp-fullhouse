import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';

import { LeaveService } from './leave.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

const mockTx = {
  employee: {
    findFirst: jest.fn(),
  },
  leaveRequest: {
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

function makeLeaveRequest(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'lr-1',
    employeeId: 'emp-1',
    leaveType: 'annual',
    startDate: new Date('2026-04-01'),
    endDate: new Date('2026-04-03'),
    days: 3,
    reason: 'Vacation',
    status: 'pending',
    approvedBy: null,
    approvedAt: null,
    createdAt: new Date('2026-03-20'),
    employee: {
      id: 'emp-1',
      empNo: 'EMP-001',
      firstName: 'Jane',
      lastName: 'Doe',
    },
    ...overrides,
  };
}

function makeEmployee(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'emp-1',
    empNo: 'EMP-001',
    firstName: 'Jane',
    lastName: 'Doe',
    status: 'active',
    ...overrides,
  };
}

const createDto = {
  employeeId: 'emp-1',
  leaveType: 'annual',
  startDate: '2026-04-01',
  endDate: '2026-04-03',
  days: 3,
  reason: 'Vacation',
} as any;

describe('LeaveService', () => {
  let service: LeaveService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<LeaveService>(LeaveService);
    jest.clearAllMocks();
  });

  describe('findAll()', () => {
    it('should return paginated leave requests with metadata', async () => {
      const requests = [makeLeaveRequest(), makeLeaveRequest({ id: 'lr-2' })];
      mockTx.leaveRequest.findMany.mockResolvedValue(requests);
      mockTx.leaveRequest.count.mockResolvedValue(2);

      const result = await service.findAll(SCHEMA, { page: 1, perPage: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({ page: 1, perPage: 20, total: 2, totalPages: 1 });
    });

    it('should pass employeeId and status filters to the query', async () => {
      mockTx.leaveRequest.findMany.mockResolvedValue([]);
      mockTx.leaveRequest.count.mockResolvedValue(0);

      await service.findAll(SCHEMA, { employeeId: 'emp-1', status: 'pending' });

      const findManyCall = mockTx.leaveRequest.findMany.mock.calls[0][0];
      expect(findManyCall.where.employeeId).toBe('emp-1');
      expect(findManyCall.where.status).toBe('pending');
    });
  });

  describe('create()', () => {
    it('should create and return a leave request when employee exists', async () => {
      mockTx.employee.findFirst.mockResolvedValue(makeEmployee());
      const created = makeLeaveRequest();
      mockTx.leaveRequest.create.mockResolvedValue(created);

      const result = await service.create(SCHEMA, createDto, USER_ID);

      expect(mockTx.leaveRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            employeeId: 'emp-1',
            leaveType: 'annual',
            days: 3,
          }),
        }),
      );
      expect(result.employeeId).toBe('emp-1');
    });

    it('should throw NotFoundException when employee does not exist', async () => {
      mockTx.employee.findFirst.mockResolvedValue(null);

      await expect(service.create(SCHEMA, createDto, USER_ID)).rejects.toThrow(NotFoundException);
      expect(mockTx.leaveRequest.create).not.toHaveBeenCalled();
    });
  });

  describe('approve()', () => {
    it('should transition a pending leave request to approved', async () => {
      const pending = makeLeaveRequest({ status: 'pending' });
      const approved = makeLeaveRequest({ status: 'approved', approvedBy: USER_ID, approvedAt: new Date() });
      mockTx.leaveRequest.findFirst.mockResolvedValue(pending);
      mockTx.leaveRequest.update.mockResolvedValue(approved);

      const result = await service.approve(SCHEMA, 'lr-1', USER_ID);

      expect(mockTx.leaveRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lr-1' },
          data: expect.objectContaining({
            status: 'approved',
            approvedBy: USER_ID,
            approvedAt: expect.any(Date),
          }),
        }),
      );
      expect(result.status).toBe('approved');
    });

    it('should throw NotFoundException when leave request does not exist', async () => {
      mockTx.leaveRequest.findFirst.mockResolvedValue(null);

      await expect(service.approve(SCHEMA, 'nonexistent', USER_ID)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when leave is not in pending status', async () => {
      const approved = makeLeaveRequest({ status: 'approved' });
      mockTx.leaveRequest.findFirst.mockResolvedValue(approved);

      await expect(service.approve(SCHEMA, 'lr-1', USER_ID)).rejects.toThrow(BadRequestException);
      expect(mockTx.leaveRequest.update).not.toHaveBeenCalled();
    });
  });

  describe('reject()', () => {
    it('should transition a pending leave request to rejected', async () => {
      const pending = makeLeaveRequest({ status: 'pending' });
      const rejected = makeLeaveRequest({ status: 'rejected', approvedBy: USER_ID, approvedAt: new Date() });
      mockTx.leaveRequest.findFirst.mockResolvedValue(pending);
      mockTx.leaveRequest.update.mockResolvedValue(rejected);

      const result = await service.reject(SCHEMA, 'lr-1', USER_ID);

      expect(mockTx.leaveRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lr-1' },
          data: expect.objectContaining({ status: 'rejected' }),
        }),
      );
      expect(result.status).toBe('rejected');
    });

    it('should throw BadRequestException when leave is not in pending status', async () => {
      const cancelled = makeLeaveRequest({ status: 'cancelled' });
      mockTx.leaveRequest.findFirst.mockResolvedValue(cancelled);

      await expect(service.reject(SCHEMA, 'lr-1', USER_ID)).rejects.toThrow(BadRequestException);
      expect(mockTx.leaveRequest.update).not.toHaveBeenCalled();
    });
  });

  describe('cancel()', () => {
    it('should transition a pending leave request to cancelled', async () => {
      const pending = makeLeaveRequest({ status: 'pending' });
      const cancelled = makeLeaveRequest({ status: 'cancelled' });
      mockTx.leaveRequest.findFirst.mockResolvedValue(pending);
      mockTx.leaveRequest.update.mockResolvedValue(cancelled);

      const result = await service.cancel(SCHEMA, 'lr-1');

      expect(mockTx.leaveRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lr-1' },
          data: { status: 'cancelled' },
        }),
      );
      expect(result.status).toBe('cancelled');
    });

    it('should throw BadRequestException when leave is already approved', async () => {
      const approved = makeLeaveRequest({ status: 'approved' });
      mockTx.leaveRequest.findFirst.mockResolvedValue(approved);

      await expect(service.cancel(SCHEMA, 'lr-1')).rejects.toThrow(BadRequestException);
      expect(mockTx.leaveRequest.update).not.toHaveBeenCalled();
    });
  });
});

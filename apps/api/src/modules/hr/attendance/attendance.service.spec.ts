import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';

import { AttendanceService } from './attendance.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

const mockTx = {
  attendance: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
  },
  employee: {
    findFirst: jest.fn(),
  },
};

const mockPrisma = {
  withTenantSchema: jest.fn().mockImplementation((_schema: string, fn: (tx: any) => any) =>
    fn(mockTx),
  ),
};

const SCHEMA = 'tenant_test';
const USER_ID = 'user-1';
const EMP_ID = 'emp-1';

function makeEmployee(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: EMP_ID,
    empNo: 'E001',
    firstName: '小明',
    lastName: '王',
    department: 'Engineering',
    ...overrides,
  };
}

function makeAttendance(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'att-1',
    employeeId: EMP_ID,
    date: new Date('2026-03-28'),
    checkIn: null,
    checkOut: null,
    hoursWorked: null,
    status: 'pending',
    notes: null,
    employee: makeEmployee(),
    ...overrides,
  };
}

describe('AttendanceService', () => {
  let service: AttendanceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
    jest.clearAllMocks();
  });

  describe('findAll()', () => {
    it('should return paginated attendance records with default pagination', async () => {
      const records = [makeAttendance()];
      mockTx.attendance.findMany.mockResolvedValue(records);
      mockTx.attendance.count.mockResolvedValue(1);

      const result = await service.findAll(SCHEMA, {});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ page: 1, perPage: 20, total: 1, totalPages: 1 });
      expect(mockTx.attendance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20, orderBy: { date: 'desc' } }),
      );
    });

    it('should filter by employeeId when provided', async () => {
      mockTx.attendance.findMany.mockResolvedValue([]);
      mockTx.attendance.count.mockResolvedValue(0);

      await service.findAll(SCHEMA, { employeeId: EMP_ID });

      expect(mockTx.attendance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ employeeId: EMP_ID }) }),
      );
    });

    it('should build date range filter when fromDate and toDate are provided', async () => {
      mockTx.attendance.findMany.mockResolvedValue([]);
      mockTx.attendance.count.mockResolvedValue(0);

      await service.findAll(SCHEMA, { fromDate: '2026-03-01', toDate: '2026-03-31' });

      expect(mockTx.attendance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });

    it('should filter by status when provided', async () => {
      mockTx.attendance.findMany.mockResolvedValue([]);
      mockTx.attendance.count.mockResolvedValue(0);

      await service.findAll(SCHEMA, { status: 'absent' });

      expect(mockTx.attendance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'absent' }) }),
      );
    });
  });

  describe('checkIn()', () => {
    it('should create a new attendance record when no record exists for today', async () => {
      mockTx.employee.findFirst.mockResolvedValue(makeEmployee());
      mockTx.attendance.findFirst.mockResolvedValue(null); // no existing record
      const created = makeAttendance({ checkIn: new Date(), status: 'present' });
      mockTx.attendance.create.mockResolvedValue(created);

      const result = await service.checkIn(SCHEMA, { employeeId: EMP_ID }, USER_ID);

      expect(mockTx.attendance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            employeeId: EMP_ID,
            checkIn: expect.any(Date),
            status: 'present',
          }),
        }),
      );
      expect(result.status).toBe('present');
    });

    it('should update existing record when record exists but checkIn is null', async () => {
      mockTx.employee.findFirst.mockResolvedValue(makeEmployee());
      const existingNoCheckIn = makeAttendance({ checkIn: null });
      mockTx.attendance.findFirst.mockResolvedValue(existingNoCheckIn);
      const updated = makeAttendance({ checkIn: new Date(), status: 'present' });
      mockTx.attendance.update.mockResolvedValue(updated);

      const result = await service.checkIn(SCHEMA, { employeeId: EMP_ID }, USER_ID);

      expect(mockTx.attendance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'att-1' },
          data: expect.objectContaining({ checkIn: expect.any(Date), status: 'present' }),
        }),
      );
      expect(result.status).toBe('present');
    });

    it('should throw BadRequestException when employee already checked in today', async () => {
      mockTx.employee.findFirst.mockResolvedValue(makeEmployee());
      const alreadyCheckedIn = makeAttendance({ checkIn: new Date() });
      mockTx.attendance.findFirst.mockResolvedValue(alreadyCheckedIn);

      await expect(service.checkIn(SCHEMA, { employeeId: EMP_ID }, USER_ID)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockTx.attendance.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when employee does not exist', async () => {
      mockTx.employee.findFirst.mockResolvedValue(null);

      await expect(service.checkIn(SCHEMA, { employeeId: 'unknown' }, USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('checkOut()', () => {
    it('should update attendance with checkOut time and computed hoursWorked', async () => {
      mockTx.employee.findFirst.mockResolvedValue(makeEmployee());
      const checkInTime = new Date(Date.now() - 8 * 60 * 60 * 1000); // 8 hours ago
      const checkedInRecord = makeAttendance({ checkIn: checkInTime, checkOut: null, status: 'present' });
      mockTx.attendance.findFirst.mockResolvedValue(checkedInRecord);
      const updated = makeAttendance({ checkIn: checkInTime, checkOut: new Date(), hoursWorked: 8 });
      mockTx.attendance.update.mockResolvedValue(updated);

      const result = await service.checkOut(SCHEMA, { employeeId: EMP_ID }, USER_ID);

      expect(mockTx.attendance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'att-1' },
          data: expect.objectContaining({
            checkOut: expect.any(Date),
            hoursWorked: expect.any(Number),
          }),
        }),
      );
      expect(result.hoursWorked).toBe(8);
    });

    it('should throw BadRequestException when no check-in record exists for today', async () => {
      mockTx.employee.findFirst.mockResolvedValue(makeEmployee());
      mockTx.attendance.findFirst.mockResolvedValue(null);

      await expect(service.checkOut(SCHEMA, { employeeId: EMP_ID }, USER_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when employee already checked out', async () => {
      mockTx.employee.findFirst.mockResolvedValue(makeEmployee());
      const alreadyOut = makeAttendance({ checkIn: new Date(), checkOut: new Date() });
      mockTx.attendance.findFirst.mockResolvedValue(alreadyOut);

      await expect(service.checkOut(SCHEMA, { employeeId: EMP_ID }, USER_ID)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockTx.attendance.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when employee does not exist', async () => {
      mockTx.employee.findFirst.mockResolvedValue(null);

      await expect(service.checkOut(SCHEMA, { employeeId: 'unknown' }, USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

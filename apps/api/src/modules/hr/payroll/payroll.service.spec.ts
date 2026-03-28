import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';

import { PayrollService } from './payroll.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

const mockTx = {
  payrollRun: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  employee: {
    findMany: jest.fn(),
  },
};

const mockPrisma = {
  withTenantSchema: jest.fn().mockImplementation((_schema: string, fn: (tx: any) => any) =>
    fn(mockTx),
  ),
};

const SCHEMA = 'tenant_test';
const USER_ID = 'user-1';

function makePayrollRun(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'pr-1',
    runNo: 'PR-202603-001',
    period: '2026-03',
    totalAmount: 50000,
    status: 'draft',
    paidAt: null,
    createdBy: USER_ID,
    createdAt: new Date('2026-03-01'),
    items: [],
    _count: { items: 0 },
    ...overrides,
  };
}

function makeEmployee(id: string, empNo: string, salary: number) {
  return {
    id,
    empNo,
    firstName: '員工',
    lastName: String(parseInt(empNo.replace('E', ''))),
    salary,
    status: 'active',
  };
}

const createDto = {
  period: '2026-03',
  items: [],
} as any;

describe('PayrollService', () => {
  let service: PayrollService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayrollService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PayrollService>(PayrollService);
    jest.clearAllMocks();
  });

  describe('findAll()', () => {
    it('should return paginated payroll runs with default pagination', async () => {
      const runs = [makePayrollRun()];
      mockTx.payrollRun.findMany.mockResolvedValue(runs);
      mockTx.payrollRun.count.mockResolvedValue(1);

      const result = await service.findAll(SCHEMA, {});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ page: 1, perPage: 20, total: 1, totalPages: 1 });
      expect(mockTx.payrollRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20, orderBy: { createdAt: 'desc' } }),
      );
    });

    it('should filter by status when provided', async () => {
      mockTx.payrollRun.findMany.mockResolvedValue([]);
      mockTx.payrollRun.count.mockResolvedValue(0);

      await service.findAll(SCHEMA, { status: 'approved' });

      expect(mockTx.payrollRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'approved' } }),
      );
    });
  });

  describe('findById()', () => {
    it('should return a payroll run with its items', async () => {
      const run = makePayrollRun({ items: [{ id: 'item-1', employeeId: 'emp-1', netPay: 25000 }] });
      mockTx.payrollRun.findFirst.mockResolvedValue(run);

      const result = await service.findById(SCHEMA, 'pr-1');

      expect(mockTx.payrollRun.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'pr-1' }, include: { items: true } }),
      );
      expect(result.id).toBe('pr-1');
    });

    it('should throw NotFoundException when payroll run does not exist', async () => {
      mockTx.payrollRun.findFirst.mockResolvedValue(null);

      await expect(service.findById(SCHEMA, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create()', () => {
    it('should generate a run number and create payroll items for all active employees', async () => {
      mockTx.payrollRun.count.mockResolvedValue(0); // first run → PR-2026-03-001
      const employees = [
        makeEmployee('emp-1', 'E001', 30000),
        makeEmployee('emp-2', 'E002', 20000),
      ];
      mockTx.employee.findMany.mockResolvedValue(employees);

      const created = makePayrollRun({
        runNo: 'PR-2026-03-001',
        totalAmount: 50000,
        items: [
          { employeeId: 'emp-1', baseSalary: 30000, netPay: 30000 },
          { employeeId: 'emp-2', baseSalary: 20000, netPay: 20000 },
        ],
      });
      mockTx.payrollRun.create.mockResolvedValue(created);

      const result = await service.create(SCHEMA, createDto, USER_ID);

      expect(mockTx.payrollRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            period: '2026-03',
            totalAmount: 50000,
            createdBy: USER_ID,
            items: expect.objectContaining({
              create: expect.arrayContaining([
                expect.objectContaining({ employeeId: 'emp-1', baseSalary: 30000, netPay: 30000 }),
                expect.objectContaining({ employeeId: 'emp-2', baseSalary: 20000, netPay: 20000 }),
              ]),
            }),
          }),
        }),
      );
      expect(result.totalAmount).toBe(50000);
    });

    it('should apply allowances and deductions from dto.items overrides', async () => {
      mockTx.payrollRun.count.mockResolvedValue(2);
      mockTx.employee.findMany.mockResolvedValue([makeEmployee('emp-1', 'E001', 30000)]);
      const created = makePayrollRun({
        items: [{ employeeId: 'emp-1', baseSalary: 30000, allowances: 2000, deductions: 500, netPay: 31500 }],
      });
      mockTx.payrollRun.create.mockResolvedValue(created);

      const dtoWithOverrides = {
        period: '2026-03',
        items: [{ employeeId: 'emp-1', allowances: 2000, deductions: 500 }],
      } as any;

      const result = await service.create(SCHEMA, dtoWithOverrides, USER_ID);

      expect(mockTx.payrollRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            items: expect.objectContaining({
              create: expect.arrayContaining([
                expect.objectContaining({
                  employeeId: 'emp-1',
                  allowances: 2000,
                  deductions: 500,
                  netPay: 31500,
                }),
              ]),
            }),
          }),
        }),
      );
      expect(result.items[0].netPay).toBe(31500);
    });

    it('should throw BadRequestException when there are no active employees', async () => {
      mockTx.payrollRun.count.mockResolvedValue(0);
      mockTx.employee.findMany.mockResolvedValue([]);

      await expect(service.create(SCHEMA, createDto, USER_ID)).rejects.toThrow(BadRequestException);
      expect(mockTx.payrollRun.create).not.toHaveBeenCalled();
    });
  });

  describe('approve()', () => {
    it('should transition a draft payroll run to approved', async () => {
      mockTx.payrollRun.findFirst.mockResolvedValue(makePayrollRun({ status: 'draft' }));
      const approved = makePayrollRun({ status: 'approved' });
      mockTx.payrollRun.update.mockResolvedValue(approved);

      const result = await service.approve(SCHEMA, 'pr-1', USER_ID);

      expect(mockTx.payrollRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pr-1' },
          data: { status: 'approved' },
        }),
      );
      expect(result.status).toBe('approved');
    });

    it('should throw BadRequestException when approving a non-draft payroll run', async () => {
      mockTx.payrollRun.findFirst.mockResolvedValue(makePayrollRun({ status: 'approved' }));

      await expect(service.approve(SCHEMA, 'pr-1', USER_ID)).rejects.toThrow(BadRequestException);
      expect(mockTx.payrollRun.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when payroll run does not exist', async () => {
      mockTx.payrollRun.findFirst.mockResolvedValue(null);

      await expect(service.approve(SCHEMA, 'nonexistent', USER_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('markPaid()', () => {
    it('should transition an approved payroll run to paid with paidAt timestamp', async () => {
      mockTx.payrollRun.findFirst.mockResolvedValue(makePayrollRun({ status: 'approved' }));
      const paid = makePayrollRun({ status: 'paid', paidAt: new Date() });
      mockTx.payrollRun.update.mockResolvedValue(paid);

      const result = await service.markPaid(SCHEMA, 'pr-1', USER_ID);

      expect(mockTx.payrollRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pr-1' },
          data: expect.objectContaining({ status: 'paid', paidAt: expect.any(Date) }),
        }),
      );
      expect(result.status).toBe('paid');
    });

    it('should throw BadRequestException when marking a draft run as paid', async () => {
      mockTx.payrollRun.findFirst.mockResolvedValue(makePayrollRun({ status: 'draft' }));

      await expect(service.markPaid(SCHEMA, 'pr-1', USER_ID)).rejects.toThrow(BadRequestException);
      expect(mockTx.payrollRun.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when payroll run does not exist', async () => {
      mockTx.payrollRun.findFirst.mockResolvedValue(null);

      await expect(service.markPaid(SCHEMA, 'nonexistent', USER_ID)).rejects.toThrow(NotFoundException);
    });
  });
});

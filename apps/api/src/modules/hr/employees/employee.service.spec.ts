import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';

import { EmployeeService } from './employee.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

const mockTx = {
  employee: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
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

function makeEmployee(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'emp-1',
    empNo: 'EMP-001',
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane.doe@example.com',
    phone: '0912345678',
    department: 'Engineering',
    position: 'Engineer',
    hireDate: new Date('2024-01-15'),
    terminateDate: null,
    salary: 60000,
    salaryType: 'monthly',
    status: 'active',
    notes: null,
    createdAt: new Date('2024-01-15'),
    leaveRequests: [],
    attendances: [],
    ...overrides,
  };
}

const createDto = {
  empNo: 'EMP-002',
  firstName: 'John',
  lastName: 'Smith',
  email: 'john.smith@example.com',
  phone: '0987654321',
  department: 'Sales',
  position: 'Sales Rep',
  hireDate: '2026-03-01',
  salary: 50000,
  salaryType: 'monthly',
  notes: null,
} as any;

describe('EmployeeService', () => {
  let service: EmployeeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeeService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<EmployeeService>(EmployeeService);
    jest.clearAllMocks();
  });

  describe('findAll()', () => {
    it('should return paginated employees with metadata', async () => {
      const employees = [makeEmployee(), makeEmployee({ id: 'emp-2', empNo: 'EMP-002' })];
      mockTx.employee.findMany.mockResolvedValue(employees);
      mockTx.employee.count.mockResolvedValue(2);

      const result = await service.findAll(SCHEMA, { page: 1, perPage: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({ page: 1, perPage: 20, total: 2, totalPages: 1 });
    });

    it('should pass search and status filters to the query', async () => {
      mockTx.employee.findMany.mockResolvedValue([]);
      mockTx.employee.count.mockResolvedValue(0);

      await service.findAll(SCHEMA, { search: 'jane', status: 'active' });

      const findManyCall = mockTx.employee.findMany.mock.calls[0][0];
      expect(findManyCall.where.OR).toBeDefined();
      expect(findManyCall.where.status).toBe('active');
    });
  });

  describe('findById()', () => {
    it('should return an employee with leave requests and attendances', async () => {
      const employee = makeEmployee({
        leaveRequests: [{ id: 'lr-1', leaveType: 'annual', status: 'approved' }],
        attendances: [],
      });
      mockTx.employee.findFirst.mockResolvedValue(employee);

      const result = await service.findById(SCHEMA, 'emp-1');

      expect(result.id).toBe('emp-1');
      expect(result.leaveRequests).toHaveLength(1);
    });

    it('should throw NotFoundException when employee does not exist', async () => {
      mockTx.employee.findFirst.mockResolvedValue(null);

      await expect(service.findById(SCHEMA, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create()', () => {
    it('should create and return a new employee', async () => {
      mockTx.employee.findUnique.mockResolvedValue(null);
      const created = makeEmployee({ id: 'emp-2', empNo: 'EMP-002', firstName: 'John' });
      mockTx.employee.create.mockResolvedValue(created);

      const result = await service.create(SCHEMA, createDto, USER_ID);

      expect(mockTx.employee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            empNo: 'EMP-002',
            firstName: 'John',
          }),
        }),
      );
      expect(result.empNo).toBe('EMP-002');
    });

    it('should throw ConflictException when employee number already exists', async () => {
      mockTx.employee.findUnique.mockResolvedValue(makeEmployee({ empNo: 'EMP-002' }));

      await expect(service.create(SCHEMA, createDto, USER_ID)).rejects.toThrow(ConflictException);
      expect(mockTx.employee.create).not.toHaveBeenCalled();
    });
  });

  describe('update()', () => {
    it('should update and return the employee', async () => {
      const existing = makeEmployee();
      const updated = makeEmployee({ position: 'Senior Engineer' });
      mockTx.employee.findFirst.mockResolvedValue(existing);
      mockTx.employee.update.mockResolvedValue(updated);

      const result = await service.update(SCHEMA, 'emp-1', { position: 'Senior Engineer' } as any);

      expect(mockTx.employee.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'emp-1' } }),
      );
      expect(result.position).toBe('Senior Engineer');
    });

    it('should throw NotFoundException when employee does not exist', async () => {
      mockTx.employee.findFirst.mockResolvedValue(null);

      await expect(service.update(SCHEMA, 'nonexistent', {} as any)).rejects.toThrow(NotFoundException);
      expect(mockTx.employee.update).not.toHaveBeenCalled();
    });
  });

  describe('remove()', () => {
    it('should set employee status to terminated', async () => {
      const existing = makeEmployee();
      const terminated = makeEmployee({ status: 'terminated', terminateDate: new Date() });
      mockTx.employee.findFirst.mockResolvedValue(existing);
      mockTx.employee.update.mockResolvedValue(terminated);

      const result = await service.remove(SCHEMA, 'emp-1');

      expect(mockTx.employee.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'emp-1' },
          data: expect.objectContaining({
            status: 'terminated',
            terminateDate: expect.any(Date),
          }),
        }),
      );
      expect(result.status).toBe('terminated');
    });

    it('should throw NotFoundException when employee does not exist', async () => {
      mockTx.employee.findFirst.mockResolvedValue(null);

      await expect(service.remove(SCHEMA, 'nonexistent')).rejects.toThrow(NotFoundException);
      expect(mockTx.employee.update).not.toHaveBeenCalled();
    });
  });
});

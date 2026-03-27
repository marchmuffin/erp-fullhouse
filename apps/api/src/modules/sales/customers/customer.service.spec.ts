import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';

import { CustomerService } from './customer.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

const mockTx = {
  customer: {
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

function makeCustomer(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'cust-1',
    code: 'C001',
    name: 'Acme Corp',
    nameEn: null,
    taxId: null,
    grade: 'A',
    creditLimit: 100000,
    creditBalance: 0,
    paymentTerms: 30,
    contactName: 'Alice',
    contactPhone: '0912345678',
    contactEmail: 'alice@acme.com',
    address: '123 Main St',
    city: 'Taipei',
    country: 'TW',
    currency: 'TWD',
    isActive: true,
    deletedAt: null,
    createdAt: new Date('2026-01-01'),
    salesOrders: [],
    ...overrides,
  };
}

describe('CustomerService', () => {
  let service: CustomerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CustomerService>(CustomerService);
    jest.clearAllMocks();
  });

  describe('findAll()', () => {
    it('should return a paginated list of customers', async () => {
      const customers = [makeCustomer(), makeCustomer({ id: 'cust-2', code: 'C002' })];
      mockTx.customer.findMany.mockResolvedValue(customers);
      mockTx.customer.count.mockResolvedValue(2);

      const result = await service.findAll(SCHEMA, { page: 1, perPage: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({ page: 1, perPage: 20, total: 2, totalPages: 1 });
    });

    it('should calculate totalPages correctly', async () => {
      mockTx.customer.findMany.mockResolvedValue([]);
      mockTx.customer.count.mockResolvedValue(45);

      const result = await service.findAll(SCHEMA, { page: 2, perPage: 20 });

      expect(result.meta.totalPages).toBe(3);
      expect(result.meta.page).toBe(2);
    });
  });

  describe('findById()', () => {
    it('should return a customer with their orders', async () => {
      const customer = makeCustomer({
        salesOrders: [{ id: 'so-1', orderNo: 'SO-001', status: 'confirmed', total: 5000 }],
      });
      mockTx.customer.findFirst.mockResolvedValue(customer);

      const result = await service.findById(SCHEMA, 'cust-1');

      expect(result.id).toBe('cust-1');
      expect(result.salesOrders).toHaveLength(1);
    });

    it('should throw NotFoundException when customer does not exist', async () => {
      mockTx.customer.findFirst.mockResolvedValue(null);

      await expect(service.findById(SCHEMA, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create()', () => {
    const createDto = {
      code: 'C003',
      name: 'New Customer',
      creditLimit: 50000,
      paymentTerms: 30,
    } as any;

    it('should create and return a new customer', async () => {
      mockTx.customer.findUnique.mockResolvedValue(null);
      const created = makeCustomer({ id: 'cust-3', code: 'C003', name: 'New Customer' });
      mockTx.customer.create.mockResolvedValue(created);

      const result = await service.create(SCHEMA, createDto, 'user-1');

      expect(mockTx.customer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ code: 'C003', createdBy: 'user-1' }),
        }),
      );
      expect(result.code).toBe('C003');
    });

    it('should throw ConflictException when code already exists', async () => {
      mockTx.customer.findUnique.mockResolvedValue(makeCustomer({ code: 'C003' }));

      await expect(service.create(SCHEMA, createDto, 'user-1')).rejects.toThrow(ConflictException);
      expect(mockTx.customer.create).not.toHaveBeenCalled();
    });
  });

  describe('update()', () => {
    it('should update an existing customer', async () => {
      const existing = makeCustomer();
      const updated = makeCustomer({ name: 'Acme Corp Updated', creditLimit: 200000 });
      mockTx.customer.findFirst.mockResolvedValue(existing);
      mockTx.customer.update.mockResolvedValue(updated);

      const result = await service.update(SCHEMA, 'cust-1', { name: 'Acme Corp Updated', creditLimit: 200000 } as any);

      expect(mockTx.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'cust-1' } }),
      );
      expect(result.name).toBe('Acme Corp Updated');
    });

    it('should throw NotFoundException when customer does not exist', async () => {
      mockTx.customer.findFirst.mockResolvedValue(null);

      await expect(service.update(SCHEMA, 'nonexistent', {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove()', () => {
    it('should soft-delete a customer by setting deletedAt', async () => {
      const existing = makeCustomer();
      mockTx.customer.findFirst.mockResolvedValue(existing);
      mockTx.customer.update.mockResolvedValue({ ...existing, deletedAt: new Date() });

      const result = await service.remove(SCHEMA, 'cust-1');

      expect(mockTx.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cust-1' },
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      );
      expect(result.deletedAt).toBeDefined();
    });

    it('should throw NotFoundException when customer does not exist', async () => {
      mockTx.customer.findFirst.mockResolvedValue(null);

      await expect(service.remove(SCHEMA, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';

import { SupplierService } from './supplier.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

const mockTx = {
  supplier: {
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

function makeSupplier(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'sup-1',
    code: 'SUP-001',
    name: 'Test Supplier Co.',
    nameEn: 'Test Supplier Co.',
    taxId: '12345678',
    paymentTerms: 30,
    grade: 'A',
    contactName: 'Jane Doe',
    contactPhone: '0912345678',
    contactEmail: 'jane@supplier.com',
    address: '123 Main St',
    city: 'Taipei',
    country: 'TW',
    currency: 'TWD',
    bankName: 'First Bank',
    bankAccount: '001-001-00001',
    notes: null,
    isActive: true,
    createdBy: USER_ID,
    deletedAt: null,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

const createDto = {
  code: 'SUP-002',
  name: 'New Supplier Ltd.',
  paymentTerms: 45,
  grade: 'B',
  currency: 'TWD',
  country: 'TW',
} as any;

describe('SupplierService', () => {
  let service: SupplierService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupplierService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SupplierService>(SupplierService);
    jest.clearAllMocks();
  });

  describe('findAll()', () => {
    it('should return suppliers with pagination metadata', async () => {
      const suppliers = [makeSupplier(), makeSupplier({ id: 'sup-2', code: 'SUP-002' })];
      mockTx.supplier.findMany.mockResolvedValue(suppliers);
      mockTx.supplier.count.mockResolvedValue(2);

      const result = await service.findAll(SCHEMA, { page: 1, perPage: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({ page: 1, perPage: 20, total: 2, totalPages: 1 });
    });

    it('should pass search filter to the query', async () => {
      mockTx.supplier.findMany.mockResolvedValue([]);
      mockTx.supplier.count.mockResolvedValue(0);

      await service.findAll(SCHEMA, { search: 'test' });

      const findManyCall = mockTx.supplier.findMany.mock.calls[0][0];
      expect(findManyCall.where.OR).toBeDefined();
      expect(findManyCall.where.deletedAt).toBeNull();
    });

    it('should exclude soft-deleted suppliers', async () => {
      mockTx.supplier.findMany.mockResolvedValue([]);
      mockTx.supplier.count.mockResolvedValue(0);

      await service.findAll(SCHEMA, {});

      const findManyCall = mockTx.supplier.findMany.mock.calls[0][0];
      expect(findManyCall.where.deletedAt).toBeNull();
    });
  });

  describe('findById()', () => {
    it('should return a supplier when found', async () => {
      mockTx.supplier.findFirst.mockResolvedValue(makeSupplier());

      const result = await service.findById(SCHEMA, 'sup-1');

      expect(result.id).toBe('sup-1');
      expect(result.code).toBe('SUP-001');
      expect(mockTx.supplier.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'sup-1', deletedAt: null } }),
      );
    });

    it('should throw NotFoundException when supplier does not exist', async () => {
      mockTx.supplier.findFirst.mockResolvedValue(null);

      await expect(service.findById(SCHEMA, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create()', () => {
    it('should create and return a new supplier', async () => {
      mockTx.supplier.findUnique.mockResolvedValue(null);
      const created = makeSupplier({ id: 'sup-2', code: 'SUP-002', name: 'New Supplier Ltd.' });
      mockTx.supplier.create.mockResolvedValue(created);

      const result = await service.create(SCHEMA, createDto, USER_ID);

      expect(mockTx.supplier.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            code: 'SUP-002',
            name: 'New Supplier Ltd.',
            createdBy: USER_ID,
          }),
        }),
      );
      expect(result.code).toBe('SUP-002');
    });

    it('should throw ConflictException when supplier code already exists', async () => {
      mockTx.supplier.findUnique.mockResolvedValue(makeSupplier({ code: 'SUP-002' }));

      await expect(service.create(SCHEMA, createDto, USER_ID)).rejects.toThrow(ConflictException);
      expect(mockTx.supplier.create).not.toHaveBeenCalled();
    });

    it('should apply default values for paymentTerms, grade, country, and currency', async () => {
      const minimalDto = { code: 'SUP-003', name: 'Minimal Supplier' } as any;
      mockTx.supplier.findUnique.mockResolvedValue(null);
      mockTx.supplier.create.mockResolvedValue(makeSupplier({ code: 'SUP-003' }));

      await service.create(SCHEMA, minimalDto, USER_ID);

      expect(mockTx.supplier.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paymentTerms: 30,
            grade: 'C',
            country: 'TW',
            currency: 'TWD',
          }),
        }),
      );
    });
  });

  describe('update()', () => {
    it('should update and return the supplier', async () => {
      const existing = makeSupplier();
      const updated = makeSupplier({ name: 'Updated Name' });
      mockTx.supplier.findFirst.mockResolvedValue(existing);
      mockTx.supplier.update.mockResolvedValue(updated);

      const result = await service.update(SCHEMA, 'sup-1', { name: 'Updated Name' });

      expect(mockTx.supplier.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sup-1' },
          data: expect.objectContaining({ name: 'Updated Name' }),
        }),
      );
      expect(result.name).toBe('Updated Name');
    });

    it('should throw NotFoundException when supplier does not exist', async () => {
      mockTx.supplier.findFirst.mockResolvedValue(null);

      await expect(service.update(SCHEMA, 'nonexistent', { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
      expect(mockTx.supplier.update).not.toHaveBeenCalled();
    });
  });

  describe('remove()', () => {
    it('should soft-delete the supplier by setting deletedAt', async () => {
      const existing = makeSupplier();
      mockTx.supplier.findFirst.mockResolvedValue(existing);
      mockTx.supplier.update.mockResolvedValue({ ...existing, deletedAt: new Date() });

      await service.remove(SCHEMA, 'sup-1');

      expect(mockTx.supplier.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sup-1' },
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      );
    });

    it('should throw NotFoundException when supplier does not exist', async () => {
      mockTx.supplier.findFirst.mockResolvedValue(null);

      await expect(service.remove(SCHEMA, 'nonexistent')).rejects.toThrow(NotFoundException);
      expect(mockTx.supplier.update).not.toHaveBeenCalled();
    });
  });
});

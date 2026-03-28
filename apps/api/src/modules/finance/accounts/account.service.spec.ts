import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

import { AccountService } from './account.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

const mockTx = {
  account: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  journalLine: {
    count: jest.fn(),
  },
};

const mockPrisma = {
  withTenantSchema: jest.fn().mockImplementation((_schema: string, fn: (tx: any) => any) =>
    fn(mockTx),
  ),
};

const SCHEMA = 'tenant_test';

function makeAccount(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'acct-1',
    code: '1001',
    name: 'Cash',
    type: 'asset',
    category: 'current_asset',
    isActive: true,
    notes: null,
    createdAt: new Date('2026-01-01'),
    debitLines: [],
    creditLines: [],
    ...overrides,
  };
}

const createDto = {
  code: '1001',
  name: 'Cash',
  type: 'asset',
  category: 'current_asset',
  isActive: true,
  notes: null,
} as any;

describe('AccountService', () => {
  let service: AccountService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AccountService>(AccountService);
    jest.clearAllMocks();
  });

  describe('findAll()', () => {
    it('should return paginated accounts with default pagination', async () => {
      const accounts = [makeAccount(), makeAccount({ id: 'acct-2', code: '1002', name: 'Bank' })];
      mockTx.account.findMany.mockResolvedValue(accounts);
      mockTx.account.count.mockResolvedValue(2);

      const result = await service.findAll(SCHEMA, {});

      expect(mockTx.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20, orderBy: { code: 'asc' } }),
      );
      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({ page: 1, perPage: 20, total: 2, totalPages: 1 });
    });

    it('should apply search filter using OR on code and name', async () => {
      mockTx.account.findMany.mockResolvedValue([makeAccount()]);
      mockTx.account.count.mockResolvedValue(1);

      await service.findAll(SCHEMA, { search: 'cash' });

      expect(mockTx.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { code: { contains: 'cash', mode: 'insensitive' } },
              { name: { contains: 'cash', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });

    it('should apply type filter when provided', async () => {
      mockTx.account.findMany.mockResolvedValue([]);
      mockTx.account.count.mockResolvedValue(0);

      await service.findAll(SCHEMA, { type: 'liability' });

      expect(mockTx.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { type: 'liability' },
        }),
      );
    });

    it('should compute correct skip for page 2', async () => {
      mockTx.account.findMany.mockResolvedValue([]);
      mockTx.account.count.mockResolvedValue(0);

      await service.findAll(SCHEMA, { page: 2, perPage: 10 });

      expect(mockTx.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });
  });

  describe('findById()', () => {
    it('should return an account with debit and credit lines', async () => {
      const account = makeAccount({
        debitLines: [{ id: 'jl-1', amount: 500 }],
        creditLines: [],
      });
      mockTx.account.findUnique.mockResolvedValue(account);

      const result = await service.findById(SCHEMA, 'acct-1');

      expect(mockTx.account.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'acct-1' } }),
      );
      expect(result.id).toBe('acct-1');
      expect(result.debitLines).toHaveLength(1);
    });

    it('should throw NotFoundException when account does not exist', async () => {
      mockTx.account.findUnique.mockResolvedValue(null);

      await expect(service.findById(SCHEMA, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create()', () => {
    it('should create a new account when code is unique', async () => {
      mockTx.account.findUnique.mockResolvedValue(null);
      const created = makeAccount();
      mockTx.account.create.mockResolvedValue(created);

      const result = await service.create(SCHEMA, createDto);

      expect(mockTx.account.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            code: '1001',
            name: 'Cash',
            type: 'asset',
            isActive: true,
          }),
        }),
      );
      expect(result.code).toBe('1001');
    });

    it('should throw ConflictException when account code already exists', async () => {
      mockTx.account.findUnique.mockResolvedValue(makeAccount());

      await expect(service.create(SCHEMA, createDto)).rejects.toThrow(ConflictException);
      expect(mockTx.account.create).not.toHaveBeenCalled();
    });

    it('should default isActive to true when not provided in dto', async () => {
      mockTx.account.findUnique.mockResolvedValue(null);
      const created = makeAccount();
      mockTx.account.create.mockResolvedValue(created);

      const dtoWithoutIsActive = { ...createDto, isActive: undefined } as any;
      await service.create(SCHEMA, dtoWithoutIsActive);

      expect(mockTx.account.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: true }),
        }),
      );
    });
  });

  describe('update()', () => {
    it('should update an existing account', async () => {
      mockTx.account.findUnique.mockResolvedValue(makeAccount());
      const updated = makeAccount({ name: 'Petty Cash' });
      mockTx.account.update.mockResolvedValue(updated);

      const result = await service.update(SCHEMA, 'acct-1', { name: 'Petty Cash' });

      expect(mockTx.account.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'acct-1' },
          data: { name: 'Petty Cash' },
        }),
      );
      expect(result.name).toBe('Petty Cash');
    });

    it('should throw NotFoundException when updating a non-existent account', async () => {
      mockTx.account.findUnique.mockResolvedValue(null);

      await expect(service.update(SCHEMA, 'nonexistent', { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
      expect(mockTx.account.update).not.toHaveBeenCalled();
    });
  });

  describe('remove()', () => {
    it('should soft-delete (deactivate) an account with no journal lines', async () => {
      mockTx.account.findUnique.mockResolvedValue(makeAccount());
      mockTx.journalLine.count.mockResolvedValue(0);
      const deactivated = makeAccount({ isActive: false });
      mockTx.account.update.mockResolvedValue(deactivated);

      const result = await service.remove(SCHEMA, 'acct-1');

      expect(mockTx.account.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'acct-1' },
          data: { isActive: false },
        }),
      );
      expect(result.isActive).toBe(false);
    });

    it('should throw BadRequestException when account has existing journal lines', async () => {
      mockTx.account.findUnique.mockResolvedValue(makeAccount());
      mockTx.journalLine.count.mockResolvedValue(3);

      await expect(service.remove(SCHEMA, 'acct-1')).rejects.toThrow(BadRequestException);
      expect(mockTx.account.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when removing a non-existent account', async () => {
      mockTx.account.findUnique.mockResolvedValue(null);

      await expect(service.remove(SCHEMA, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});

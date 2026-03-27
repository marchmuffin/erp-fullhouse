import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';

import { JournalService } from './journal.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

const mockTx = {
  journalEntry: {
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

function makeJournalEntry(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'je-1',
    jeNo: 'JE-202603-0001',
    jeDate: new Date('2026-03-01'),
    description: 'Test entry',
    status: 'draft',
    refDocType: null,
    refDocId: null,
    refDocNo: null,
    createdBy: USER_ID,
    postedBy: null,
    postedAt: null,
    reversedBy: null,
    reversedAt: null,
    createdAt: new Date('2026-03-01'),
    lines: [],
    ...overrides,
  };
}

function makeJeLine(lineNo: number, debitAccountId: string | null, creditAccountId: string | null, amount: number) {
  return {
    id: `jel-${lineNo}`,
    journalEntryId: 'je-1',
    lineNo,
    debitAccountId,
    creditAccountId,
    amount,
    description: null,
  };
}

// A balanced DTO: one debit line + one credit line each for 1000
const balancedDto = {
  jeDate: '2026-03-15',
  description: 'Balanced entry',
  lines: [
    { lineNo: 1, debitAccountId: 'acct-cash', creditAccountId: null, amount: 1000, description: null },
    { lineNo: 2, debitAccountId: null, creditAccountId: 'acct-revenue', amount: 1000, description: null },
  ],
} as any;

// An unbalanced DTO: debits 1000, credits 500
const unbalancedDto = {
  jeDate: '2026-03-15',
  description: 'Unbalanced entry',
  lines: [
    { lineNo: 1, debitAccountId: 'acct-cash', creditAccountId: null, amount: 1000, description: null },
    { lineNo: 2, debitAccountId: null, creditAccountId: 'acct-revenue', amount: 500, description: null },
  ],
} as any;

describe('JournalService', () => {
  let service: JournalService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JournalService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<JournalService>(JournalService);
    jest.clearAllMocks();
  });

  describe('create()', () => {
    it('should create a journal entry in draft status when debits equal credits', async () => {
      // generateJeNo calls findFirst to get the last sequence
      mockTx.journalEntry.findFirst.mockResolvedValue(null);
      const created = makeJournalEntry({
        jeNo: 'JE-202603-0001',
        lines: [
          makeJeLine(1, 'acct-cash', null, 1000),
          makeJeLine(2, null, 'acct-revenue', 1000),
        ],
      });
      mockTx.journalEntry.create.mockResolvedValue(created);

      const result = await service.create(SCHEMA, balancedDto, USER_ID);

      expect(mockTx.journalEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'draft',
            createdBy: USER_ID,
          }),
        }),
      );
      expect(result.status).toBe('draft');
    });

    it('should throw BadRequestException when total debits do not equal total credits', async () => {
      await expect(service.create(SCHEMA, unbalancedDto, USER_ID)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockTx.journalEntry.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when lines array is empty', async () => {
      const emptyLinesDto = { ...balancedDto, lines: [] };

      await expect(service.create(SCHEMA, emptyLinesDto, USER_ID)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockTx.journalEntry.create).not.toHaveBeenCalled();
    });

    it('should auto-generate a sequential jeNo', async () => {
      // Simulate an existing entry with sequence 3
      mockTx.journalEntry.findFirst.mockResolvedValue({ jeNo: 'JE-202603-0003' });
      const created = makeJournalEntry({ jeNo: 'JE-202603-0004' });
      mockTx.journalEntry.create.mockResolvedValue(created);

      const result = await service.create(SCHEMA, balancedDto, USER_ID);

      expect(result.jeNo).toBe('JE-202603-0004');
    });
  });

  describe('post()', () => {
    it('should transition a draft entry to posted', async () => {
      const draftEntry = makeJournalEntry({ status: 'draft' });
      const postedEntry = makeJournalEntry({ status: 'posted', postedBy: USER_ID, postedAt: new Date() });
      mockTx.journalEntry.findUnique.mockResolvedValue(draftEntry);
      mockTx.journalEntry.update.mockResolvedValue(postedEntry);

      const result = await service.post(SCHEMA, 'je-1', USER_ID);

      expect(mockTx.journalEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'je-1' },
          data: expect.objectContaining({
            status: 'posted',
            postedBy: USER_ID,
            postedAt: expect.any(Date),
          }),
        }),
      );
      expect(result.status).toBe('posted');
    });

    it('should throw BadRequestException when entry is already posted', async () => {
      const postedEntry = makeJournalEntry({ status: 'posted' });
      mockTx.journalEntry.findUnique.mockResolvedValue(postedEntry);

      await expect(service.post(SCHEMA, 'je-1', USER_ID)).rejects.toThrow(BadRequestException);
      expect(mockTx.journalEntry.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when entry does not exist', async () => {
      mockTx.journalEntry.findUnique.mockResolvedValue(null);

      await expect(service.post(SCHEMA, 'nonexistent', USER_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('reverse()', () => {
    it('should create a counter-entry with swapped debit/credit and mark original as reversed', async () => {
      const originalLines = [
        makeJeLine(1, 'acct-cash', null, 500),
        makeJeLine(2, null, 'acct-revenue', 500),
      ];
      const postedEntry = makeJournalEntry({
        status: 'posted',
        jeNo: 'JE-202603-0001',
        description: 'Original entry',
        lines: originalLines,
      });
      const reversalEntry = makeJournalEntry({
        id: 'je-rev-1',
        jeNo: 'JE-202603-0002',
        status: 'posted',
        description: 'Reversal of JE-202603-0001: Original entry',
        lines: [
          makeJeLine(1, null, 'acct-cash', 500),   // swapped
          makeJeLine(2, 'acct-revenue', null, 500), // swapped
        ],
      });

      mockTx.journalEntry.findUnique.mockResolvedValue(postedEntry);
      mockTx.journalEntry.update.mockResolvedValue({ ...postedEntry, status: 'reversed' });
      // generateJeNo in reverse() calls findFirst for the next sequence
      mockTx.journalEntry.findFirst.mockResolvedValue({ jeNo: 'JE-202603-0001' });
      mockTx.journalEntry.create.mockResolvedValue(reversalEntry);

      const result = await service.reverse(SCHEMA, 'je-1', USER_ID);

      // Original marked reversed
      expect(mockTx.journalEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'je-1' },
          data: { status: 'reversed' },
        }),
      );
      // Reversal entry created with swapped accounts
      expect(mockTx.journalEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'posted',
            refDocType: 'journal_entry',
            refDocId: 'je-1',
            refDocNo: 'JE-202603-0001',
            lines: expect.objectContaining({
              create: expect.arrayContaining([
                expect.objectContaining({
                  debitAccountId: null,       // original debit becomes credit
                  creditAccountId: 'acct-cash',
                }),
                expect.objectContaining({
                  debitAccountId: 'acct-revenue', // original credit becomes debit
                  creditAccountId: null,
                }),
              ]),
            }),
          }),
        }),
      );
      expect(result.id).toBe('je-rev-1');
    });

    it('should throw BadRequestException when entry is not posted', async () => {
      const draftEntry = makeJournalEntry({ status: 'draft' });
      mockTx.journalEntry.findUnique.mockResolvedValue(draftEntry);

      await expect(service.reverse(SCHEMA, 'je-1', USER_ID)).rejects.toThrow(BadRequestException);
      expect(mockTx.journalEntry.update).not.toHaveBeenCalled();
      expect(mockTx.journalEntry.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when entry does not exist', async () => {
      mockTx.journalEntry.findUnique.mockResolvedValue(null);

      await expect(service.reverse(SCHEMA, 'nonexistent', USER_ID)).rejects.toThrow(NotFoundException);
    });
  });
});

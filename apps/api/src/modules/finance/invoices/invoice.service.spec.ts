import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';

import { InvoiceService } from './invoice.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

const mockTx = {
  invoice: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  payment: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
};

const mockPrisma = {
  withTenantSchema: jest.fn().mockImplementation((_schema: string, fn: (tx: any) => any) =>
    fn(mockTx),
  ),
};

const SCHEMA = 'tenant_test';
const USER_ID = 'user-1';

function makeInvoice(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'inv-1',
    invoiceNo: 'INV-202603-0001',
    type: 'ar',
    partyId: 'party-1',
    partyName: 'ACME Corp',
    invoiceDate: new Date('2026-03-01'),
    dueDate: new Date('2026-03-31'),
    subtotal: 1000,
    taxAmount: 50,
    totalAmount: 1050,
    paidAmount: 0,
    status: 'draft',
    refDocType: null,
    refDocId: null,
    refDocNo: null,
    notes: null,
    createdBy: USER_ID,
    createdAt: new Date('2026-03-01'),
    lines: [],
    payments: [],
    _count: { payments: 0 },
    ...overrides,
  };
}

function makeInvoiceLine(lineNo: number, qty: number, unitPrice: number) {
  return {
    lineNo,
    description: `Item ${lineNo}`,
    quantity: qty,
    unitPrice,
  };
}

const createDto = {
  type: 'ar',
  partyId: 'party-1',
  partyName: 'ACME Corp',
  invoiceDate: '2026-03-01',
  dueDate: '2026-03-31',
  lines: [makeInvoiceLine(1, 10, 100)],
} as any;

describe('InvoiceService', () => {
  let service: InvoiceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<InvoiceService>(InvoiceService);
    jest.clearAllMocks();
  });

  describe('findAll()', () => {
    it('should return paginated invoices with default pagination', async () => {
      const invoices = [makeInvoice()];
      mockTx.invoice.findMany.mockResolvedValue(invoices);
      mockTx.invoice.count.mockResolvedValue(1);

      const result = await service.findAll(SCHEMA, {});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ page: 1, perPage: 20, total: 1, totalPages: 1 });
    });

    it('should filter by type and status when provided', async () => {
      mockTx.invoice.findMany.mockResolvedValue([]);
      mockTx.invoice.count.mockResolvedValue(0);

      await service.findAll(SCHEMA, { type: 'ar', status: 'issued' });

      expect(mockTx.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { type: 'ar', status: 'issued' },
        }),
      );
    });

    it('should apply partyName search when search is provided', async () => {
      mockTx.invoice.findMany.mockResolvedValue([]);
      mockTx.invoice.count.mockResolvedValue(0);

      await service.findAll(SCHEMA, { search: 'ACME' });

      expect(mockTx.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { partyName: { contains: 'ACME', mode: 'insensitive' } },
        }),
      );
    });
  });

  describe('findById()', () => {
    it('should return an invoice with lines and payments', async () => {
      const invoice = makeInvoice({ lines: [{ id: 'line-1' }] });
      mockTx.invoice.findUnique.mockResolvedValue(invoice);

      const result = await service.findById(SCHEMA, 'inv-1');

      expect(mockTx.invoice.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'inv-1' } }),
      );
      expect(result.id).toBe('inv-1');
    });

    it('should throw NotFoundException when invoice does not exist', async () => {
      mockTx.invoice.findUnique.mockResolvedValue(null);

      await expect(service.findById(SCHEMA, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create()', () => {
    it('should create invoice with correct subtotal, tax, and total', async () => {
      // 10 units * 100 = 1000 subtotal, 5% tax = 50, total = 1050
      mockTx.invoice.findFirst.mockResolvedValue(null); // no prior invoice (seq = 1)
      const created = makeInvoice({ invoiceNo: 'INV-202603-0001' });
      mockTx.invoice.create.mockResolvedValue(created);

      const result = await service.create(SCHEMA, createDto, USER_ID);

      expect(mockTx.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotal: 1000,
            taxAmount: 50,
            totalAmount: 1050,
            paidAmount: 0,
            status: 'draft',
            createdBy: USER_ID,
          }),
        }),
      );
      expect(result.status).toBe('draft');
    });

    it('should auto-generate an invoice number for AR type', async () => {
      mockTx.invoice.findFirst.mockResolvedValue(null);
      const created = makeInvoice({ invoiceNo: 'INV-202603-0001' });
      mockTx.invoice.create.mockResolvedValue(created);

      const result = await service.create(SCHEMA, createDto, USER_ID);

      expect(result.invoiceNo).toMatch(/^INV-\d{6}-\d{4}$/);
    });

    it('should generate a sequential invoice number incrementing from the last', async () => {
      mockTx.invoice.findFirst.mockResolvedValue({ invoiceNo: 'INV-202603-0005' });
      const created = makeInvoice({ invoiceNo: 'INV-202603-0006' });
      mockTx.invoice.create.mockResolvedValue(created);

      const result = await service.create(SCHEMA, createDto, USER_ID);

      expect(result.invoiceNo).toBe('INV-202603-0006');
    });

    it('should throw BadRequestException when lines array is empty', async () => {
      const dto = { ...createDto, lines: [] };

      await expect(service.create(SCHEMA, dto, USER_ID)).rejects.toThrow(BadRequestException);
      expect(mockTx.invoice.create).not.toHaveBeenCalled();
    });
  });

  describe('issue()', () => {
    it('should transition a draft invoice to issued', async () => {
      mockTx.invoice.findUnique.mockResolvedValue(makeInvoice({ status: 'draft' }));
      const issued = makeInvoice({ status: 'issued' });
      mockTx.invoice.update.mockResolvedValue(issued);

      const result = await service.issue(SCHEMA, 'inv-1');

      expect(mockTx.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1' },
          data: { status: 'issued' },
        }),
      );
      expect(result.status).toBe('issued');
    });

    it('should throw BadRequestException when issuing an already-issued invoice', async () => {
      mockTx.invoice.findUnique.mockResolvedValue(makeInvoice({ status: 'issued' }));

      await expect(service.issue(SCHEMA, 'inv-1')).rejects.toThrow(BadRequestException);
      expect(mockTx.invoice.update).not.toHaveBeenCalled();
    });
  });

  describe('recordPayment()', () => {
    const paymentDto = {
      paymentDate: '2026-03-15',
      amount: 1050,
      method: 'bank_transfer',
      reference: 'REF-001',
      notes: null,
    } as any;

    it('should create a payment record and mark invoice as paid when fully settled', async () => {
      const issuedInvoice = makeInvoice({ status: 'issued', totalAmount: 1050, paidAmount: 0 });
      mockTx.invoice.findUnique.mockResolvedValue(issuedInvoice);
      mockTx.payment.findFirst.mockResolvedValue(null);
      const createdPayment = { id: 'pay-1', paymentNo: 'PAY-202603-0001', amount: 1050 };
      mockTx.payment.create.mockResolvedValue(createdPayment);
      mockTx.invoice.update.mockResolvedValue(makeInvoice({ status: 'paid', paidAmount: 1050 }));

      const result = await service.recordPayment(SCHEMA, 'inv-1', paymentDto, USER_ID);

      expect(mockTx.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            invoiceId: 'inv-1',
            amount: 1050,
            method: 'bank_transfer',
            createdBy: USER_ID,
          }),
        }),
      );
      expect(mockTx.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'paid', paidAmount: 1050 }),
        }),
      );
      expect(result.id).toBe('pay-1');
    });

    it('should set invoice status to partial when payment is less than total', async () => {
      const issuedInvoice = makeInvoice({ status: 'issued', totalAmount: 1050, paidAmount: 0 });
      mockTx.invoice.findUnique.mockResolvedValue(issuedInvoice);
      mockTx.payment.findFirst.mockResolvedValue(null);
      mockTx.payment.create.mockResolvedValue({ id: 'pay-1', paymentNo: 'PAY-202603-0001', amount: 500 });
      mockTx.invoice.update.mockResolvedValue(makeInvoice({ status: 'partial', paidAmount: 500 }));

      const partialDto = { ...paymentDto, amount: 500 };
      await service.recordPayment(SCHEMA, 'inv-1', partialDto, USER_ID);

      expect(mockTx.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'partial', paidAmount: 500 }),
        }),
      );
    });

    it('should throw BadRequestException when payment exceeds invoice total', async () => {
      const issuedInvoice = makeInvoice({ status: 'issued', totalAmount: 1050, paidAmount: 0 });
      mockTx.invoice.findUnique.mockResolvedValue(issuedInvoice);

      const overpayDto = { ...paymentDto, amount: 2000 };
      await expect(service.recordPayment(SCHEMA, 'inv-1', overpayDto, USER_ID)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockTx.payment.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when recording payment on a draft invoice', async () => {
      mockTx.invoice.findUnique.mockResolvedValue(makeInvoice({ status: 'draft' }));

      await expect(service.recordPayment(SCHEMA, 'inv-1', paymentDto, USER_ID)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});

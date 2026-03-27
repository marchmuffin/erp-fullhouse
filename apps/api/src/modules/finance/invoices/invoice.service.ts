import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';

const TAX_RATE = 0.05;

@Injectable()
export class InvoiceService {
  constructor(private readonly prisma: PrismaService) {}

  // ── helpers ─────────────────────────────────────────────────────────────────

  private async generateInvoiceNo(tx: any, type: string): Promise<string> {
    const now = new Date();
    const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = type === 'ar' ? `INV-${yyyymm}-` : `BILL-${yyyymm}-`;
    const last = await tx.invoice.findFirst({
      where: { invoiceNo: { startsWith: prefix } },
      orderBy: { invoiceNo: 'desc' },
      select: { invoiceNo: true },
    });
    const seq = last
      ? parseInt(last.invoiceNo.slice(prefix.length), 10) + 1
      : 1;
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  private async generatePaymentNo(tx: any): Promise<string> {
    const now = new Date();
    const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `PAY-${yyyymm}-`;
    const last = await tx.payment.findFirst({
      where: { paymentNo: { startsWith: prefix } },
      orderBy: { paymentNo: 'desc' },
      select: { paymentNo: true },
    });
    const seq = last
      ? parseInt(last.paymentNo.slice(prefix.length), 10) + 1
      : 1;
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  // ── public methods ───────────────────────────────────────────────────────────

  async findAll(
    schema: string,
    query: {
      page?: number;
      perPage?: number;
      type?: string;
      status?: string;
      search?: string;
    },
  ) {
    const { page = 1, perPage = 20, type, status, search } = query;
    const skip = (page - 1) * perPage;

    return this.prisma.withTenantSchema(schema, async (tx) => {
      const where: any = {};
      if (type) where.type = type;
      if (status) where.status = status;
      if (search) where.partyName = { contains: search, mode: 'insensitive' };

      const [data, total] = await Promise.all([
        tx.invoice.findMany({
          where,
          skip,
          take: perPage,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            invoiceNo: true,
            type: true,
            partyId: true,
            partyName: true,
            invoiceDate: true,
            dueDate: true,
            subtotal: true,
            taxAmount: true,
            totalAmount: true,
            paidAmount: true,
            status: true,
            refDocNo: true,
            createdAt: true,
          },
        }),
        tx.invoice.count({ where }),
      ]);

      return {
        data,
        meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
      };
    });
  }

  async findById(schema: string, id: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id },
        include: {
          lines: { orderBy: { lineNo: 'asc' } },
          payments: { orderBy: { paymentDate: 'asc' } },
        },
      });
      if (!invoice) throw new NotFoundException('Invoice not found');
      return invoice;
    });
  }

  async create(schema: string, dto: CreateInvoiceDto, userId?: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      if (dto.lines.length === 0) {
        throw new BadRequestException('Invoice must have at least one line');
      }

      const subtotal = dto.lines.reduce(
        (sum, l) => sum + Number(l.quantity) * Number(l.unitPrice),
        0,
      );
      const taxAmount = Math.round(subtotal * TAX_RATE * 100) / 100;
      const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;

      const invoiceNo = await this.generateInvoiceNo(tx, dto.type);

      return tx.invoice.create({
        data: {
          invoiceNo,
          type: dto.type,
          partyId: dto.partyId,
          partyName: dto.partyName,
          invoiceDate: new Date(dto.invoiceDate),
          dueDate: new Date(dto.dueDate),
          subtotal,
          taxAmount,
          totalAmount,
          paidAmount: 0,
          status: 'draft',
          refDocType: dto.refDocType,
          refDocId: dto.refDocId,
          refDocNo: dto.refDocNo,
          notes: dto.notes,
          createdBy: userId,
          lines: {
            create: dto.lines.map((l) => ({
              lineNo: l.lineNo,
              description: l.description,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              amount: Math.round(Number(l.quantity) * Number(l.unitPrice) * 100) / 100,
            })),
          },
        },
        include: {
          lines: { orderBy: { lineNo: 'asc' } },
        },
      });
    });
  }

  async issue(schema: string, id: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id } });
      if (!invoice) throw new NotFoundException('Invoice not found');
      if (invoice.status !== 'draft') {
        throw new BadRequestException(
          `Cannot issue invoice with status "${invoice.status}"; only draft invoices can be issued`,
        );
      }
      return tx.invoice.update({ where: { id }, data: { status: 'issued' } });
    });
  }

  async cancel(schema: string, id: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id },
        include: { _count: { select: { payments: true } } },
      });
      if (!invoice) throw new NotFoundException('Invoice not found');
      if (!['draft', 'issued'].includes(invoice.status)) {
        throw new BadRequestException(
          `Cannot cancel invoice with status "${invoice.status}"`,
        );
      }
      if (invoice._count.payments > 0) {
        throw new BadRequestException('Cannot cancel invoice that has recorded payments');
      }
      return tx.invoice.update({ where: { id }, data: { status: 'cancelled' } });
    });
  }

  async recordPayment(
    schema: string,
    invoiceId: string,
    dto: RecordPaymentDto,
    userId?: string,
  ) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
      if (!invoice) throw new NotFoundException('Invoice not found');
      if (['draft', 'cancelled'].includes(invoice.status)) {
        throw new BadRequestException(
          `Cannot record payment on invoice with status "${invoice.status}"`,
        );
      }

      const newPaidAmount =
        Math.round((Number(invoice.paidAmount) + Number(dto.amount)) * 100) / 100;

      if (newPaidAmount > Number(invoice.totalAmount)) {
        throw new BadRequestException(
          `Payment of ${dto.amount} would exceed invoice total ${invoice.totalAmount}`,
        );
      }

      const newStatus =
        newPaidAmount >= Number(invoice.totalAmount) ? 'paid' : 'partial';

      const paymentNo = await this.generatePaymentNo(tx);

      const [payment] = await Promise.all([
        tx.payment.create({
          data: {
            paymentNo,
            invoiceId,
            paymentDate: new Date(dto.paymentDate),
            amount: dto.amount,
            method: dto.method,
            reference: dto.reference,
            notes: dto.notes,
            createdBy: userId,
          },
        }),
        tx.invoice.update({
          where: { id: invoiceId },
          data: { paidAmount: newPaidAmount, status: newStatus },
        }),
      ]);

      return payment;
    });
  }
}

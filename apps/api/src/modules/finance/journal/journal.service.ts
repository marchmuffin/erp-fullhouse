import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateJeDto } from './dto/create-je.dto';

@Injectable()
export class JournalService {
  constructor(private readonly prisma: PrismaService) {}

  // ── helpers ─────────────────────────────────────────────────────────────────

  private async generateJeNo(tx: any): Promise<string> {
    const now = new Date();
    const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `JE-${yyyymm}-`;
    const last = await tx.journalEntry.findFirst({
      where: { jeNo: { startsWith: prefix } },
      orderBy: { jeNo: 'desc' },
      select: { jeNo: true },
    });
    const seq = last
      ? parseInt(last.jeNo.slice(prefix.length), 10) + 1
      : 1;
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  // ── public methods ───────────────────────────────────────────────────────────

  async findAll(
    schema: string,
    query: {
      page?: number;
      perPage?: number;
      status?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ) {
    const { page = 1, perPage = 20, status, dateFrom, dateTo } = query;
    const skip = (page - 1) * perPage;

    return this.prisma.withTenantSchema(schema, async (tx) => {
      const where: any = {};
      if (status) where.status = status;
      if (dateFrom || dateTo) {
        where.jeDate = {};
        if (dateFrom) where.jeDate.gte = new Date(dateFrom);
        if (dateTo) where.jeDate.lte = new Date(dateTo);
      }

      const [data, total] = await Promise.all([
        tx.journalEntry.findMany({
          where,
          skip,
          take: perPage,
          orderBy: { jeDate: 'desc' },
          select: {
            id: true,
            jeNo: true,
            jeDate: true,
            description: true,
            status: true,
            refDocType: true,
            refDocNo: true,
            createdBy: true,
            postedBy: true,
            postedAt: true,
            createdAt: true,
            lines: {
              select: {
                id: true,
                lineNo: true,
                debitAccountId: true,
                creditAccountId: true,
                amount: true,
                description: true,
              },
            },
          },
        }),
        tx.journalEntry.count({ where }),
      ]);

      return {
        data,
        meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
      };
    });
  }

  async findById(schema: string, id: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const entry = await tx.journalEntry.findUnique({
        where: { id },
        include: {
          lines: {
            orderBy: { lineNo: 'asc' },
            include: {
              debitAccount: {
                select: { id: true, code: true, name: true, type: true },
              },
              creditAccount: {
                select: { id: true, code: true, name: true, type: true },
              },
            },
          },
        },
      });
      if (!entry) throw new NotFoundException('Journal entry not found');
      return entry;
    });
  }

  async create(schema: string, dto: CreateJeDto, userId?: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      // Validate: total debits must equal total credits
      const totalDebits = dto.lines.reduce(
        (sum, l) => sum + (l.debitAccountId ? Number(l.amount) : 0),
        0,
      );
      const totalCredits = dto.lines.reduce(
        (sum, l) => sum + (l.creditAccountId ? Number(l.amount) : 0),
        0,
      );

      if (Math.abs(totalDebits - totalCredits) > 0.001) {
        throw new BadRequestException(
          `Journal entry is not balanced: total debits (${totalDebits}) ≠ total credits (${totalCredits})`,
        );
      }

      if (dto.lines.length === 0) {
        throw new BadRequestException('Journal entry must have at least one line');
      }

      const jeNo = await this.generateJeNo(tx);

      return tx.journalEntry.create({
        data: {
          jeNo,
          jeDate: new Date(dto.jeDate),
          description: dto.description,
          status: 'draft',
          refDocType: dto.refDocType,
          refDocId: dto.refDocId,
          refDocNo: dto.refDocNo,
          createdBy: userId,
          lines: {
            create: dto.lines.map((l) => ({
              lineNo: l.lineNo,
              debitAccountId: l.debitAccountId,
              creditAccountId: l.creditAccountId,
              amount: l.amount,
              description: l.description,
            })),
          },
        },
        include: {
          lines: {
            orderBy: { lineNo: 'asc' },
            include: {
              debitAccount: { select: { id: true, code: true, name: true } },
              creditAccount: { select: { id: true, code: true, name: true } },
            },
          },
        },
      });
    });
  }

  async post(schema: string, id: string, userId?: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const entry = await tx.journalEntry.findUnique({ where: { id } });
      if (!entry) throw new NotFoundException('Journal entry not found');
      if (entry.status !== 'draft') {
        throw new BadRequestException(
          `Cannot post entry with status "${entry.status}"; only draft entries can be posted`,
        );
      }

      return tx.journalEntry.update({
        where: { id },
        data: {
          status: 'posted',
          postedBy: userId,
          postedAt: new Date(),
        },
      });
    });
  }

  async reverse(schema: string, id: string, userId?: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const entry = await tx.journalEntry.findUnique({
        where: { id },
        include: { lines: true },
      });
      if (!entry) throw new NotFoundException('Journal entry not found');
      if (entry.status !== 'posted') {
        throw new BadRequestException(
          `Cannot reverse entry with status "${entry.status}"; only posted entries can be reversed`,
        );
      }

      // Mark original as reversed
      await tx.journalEntry.update({ where: { id }, data: { status: 'reversed' } });

      // Create reversing entry with swapped debit/credit
      const jeNo = await this.generateJeNo(tx);
      return tx.journalEntry.create({
        data: {
          jeNo,
          jeDate: new Date(),
          description: `Reversal of ${entry.jeNo}: ${entry.description}`,
          status: 'posted',
          refDocType: 'journal_entry',
          refDocId: entry.id,
          refDocNo: entry.jeNo,
          createdBy: userId,
          postedBy: userId,
          postedAt: new Date(),
          lines: {
            create: entry.lines.map((l) => ({
              lineNo: l.lineNo,
              debitAccountId: l.creditAccountId,
              creditAccountId: l.debitAccountId,
              amount: l.amount,
              description: l.description,
            })),
          },
        },
        include: {
          lines: {
            orderBy: { lineNo: 'asc' },
            include: {
              debitAccount: { select: { id: true, code: true, name: true } },
              creditAccount: { select: { id: true, code: true, name: true } },
            },
          },
        },
      });
    });
  }
}

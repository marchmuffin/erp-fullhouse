import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreatePRDto } from './dto/create-pr.dto';

export const PR_STATUS = {
  DRAFT: 'draft',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  CONVERTED: 'converted',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
} as const;

@Injectable()
export class PurchaseRequisitionService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(schema: string, query: { page?: number; perPage?: number; search?: string; status?: string }) {
    const { page = 1, perPage = 20, search, status } = query;
    const skip = (page - 1) * perPage;
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const where: any = { deletedAt: null };
      if (search) where.OR = [{ prNo: { contains: search, mode: 'insensitive' } }, { department: { contains: search, mode: 'insensitive' } }];
      if (status) where.status = status;
      const [data, total] = await Promise.all([
        tx.purchaseRequisition.findMany({
          where, skip, take: perPage, orderBy: { createdAt: 'desc' },
          include: { lines: { select: { id: true, lineNo: true, itemCode: true, itemName: true, quantity: true, unit: true } } },
        }),
        tx.purchaseRequisition.count({ where }),
      ]);
      return { data, meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
    });
  }

  async findById(schema: string, id: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const pr = await tx.purchaseRequisition.findFirst({
        where: { id, deletedAt: null },
        include: { lines: { orderBy: { lineNo: 'asc' } } },
      });
      if (!pr) throw new NotFoundException('Purchase requisition not found');
      return pr;
    });
  }

  async create(schema: string, dto: CreatePRDto, userId: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const existing = await tx.purchaseRequisition.findUnique({ where: { prNo: dto.prNo } });
      if (existing) throw new ConflictException(`PR number ${dto.prNo} already exists`);
      return tx.purchaseRequisition.create({
        data: {
          prNo: dto.prNo, status: PR_STATUS.DRAFT,
          requestDate: new Date(dto.requestDate),
          requiredDate: dto.requiredDate ? new Date(dto.requiredDate) : null,
          department: dto.department, purpose: dto.purpose, notes: dto.notes,
          createdBy: userId,
          lines: { create: dto.lines.map((l) => ({ lineNo: l.lineNo, itemCode: l.itemCode, itemName: l.itemName, spec: l.spec, unit: l.unit, quantity: l.quantity, notes: l.notes })) },
        },
        include: { lines: { orderBy: { lineNo: 'asc' } } },
      });
    });
  }

  async submit(schema: string, id: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const pr = await tx.purchaseRequisition.findFirst({ where: { id, deletedAt: null } });
      if (!pr) throw new NotFoundException('PR not found');
      if (pr.status !== PR_STATUS.DRAFT) throw new BadRequestException('Only draft PRs can be submitted');
      return tx.purchaseRequisition.update({ where: { id }, data: { status: PR_STATUS.PENDING_APPROVAL } });
    });
  }

  async approve(schema: string, id: string, userId: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const pr = await tx.purchaseRequisition.findFirst({ where: { id, deletedAt: null } });
      if (!pr) throw new NotFoundException('PR not found');
      if (pr.status !== PR_STATUS.PENDING_APPROVAL) throw new BadRequestException('Only pending PRs can be approved');
      return tx.purchaseRequisition.update({ where: { id }, data: { status: PR_STATUS.APPROVED, approvedBy: userId, approvedAt: new Date() } });
    });
  }

  async reject(schema: string, id: string, userId: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const pr = await tx.purchaseRequisition.findFirst({ where: { id, deletedAt: null } });
      if (!pr) throw new NotFoundException('PR not found');
      if (pr.status !== PR_STATUS.PENDING_APPROVAL) throw new BadRequestException('Only pending PRs can be rejected');
      return tx.purchaseRequisition.update({ where: { id }, data: { status: PR_STATUS.REJECTED, approvedBy: userId, approvedAt: new Date() } });
    });
  }

  async cancel(schema: string, id: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const pr = await tx.purchaseRequisition.findFirst({ where: { id, deletedAt: null } });
      if (!pr) throw new NotFoundException('PR not found');
      if ([PR_STATUS.CONVERTED, PR_STATUS.CANCELLED].includes(pr.status as any)) throw new BadRequestException('Cannot cancel this PR');
      return tx.purchaseRequisition.update({ where: { id }, data: { status: PR_STATUS.CANCELLED } });
    });
  }
}

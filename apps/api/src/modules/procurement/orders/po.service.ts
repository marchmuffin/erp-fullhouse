import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreatePODto } from './dto/create-po.dto';

export const PO_STATUS = {
  DRAFT: 'draft',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  PARTIAL_RECEIVED: 'partial_received',
  RECEIVED: 'received',
  INVOICED: 'invoiced',
  CANCELLED: 'cancelled',
} as const;

@Injectable()
export class PurchaseOrderService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(schema: string, query: { page?: number; perPage?: number; search?: string; status?: string; supplierId?: string }) {
    const { page = 1, perPage = 20, search, status, supplierId } = query;
    const skip = (page - 1) * perPage;
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const where: any = { deletedAt: null };
      if (search) where.OR = [{ poNo: { contains: search, mode: 'insensitive' } }, { supplier: { name: { contains: search, mode: 'insensitive' } } }];
      if (status) where.status = status;
      if (supplierId) where.supplierId = supplierId;
      const [data, total] = await Promise.all([
        tx.purchaseOrder.findMany({
          where, skip, take: perPage, orderBy: { createdAt: 'desc' },
          include: {
            supplier: { select: { id: true, code: true, name: true } },
            lines: { select: { id: true, lineNo: true, itemCode: true, itemName: true, quantity: true, receivedQty: true, amount: true } },
          },
        }),
        tx.purchaseOrder.count({ where }),
      ]);
      return { data, meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
    });
  }

  async findById(schema: string, id: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const po = await tx.purchaseOrder.findFirst({
        where: { id, deletedAt: null },
        include: {
          supplier: true,
          lines: { orderBy: { lineNo: 'asc' } },
          goodsReceipts: { orderBy: { createdAt: 'desc' } },
        },
      });
      if (!po) throw new NotFoundException('Purchase order not found');
      return po;
    });
  }

  async create(schema: string, dto: CreatePODto, userId: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const existing = await tx.purchaseOrder.findUnique({ where: { poNo: dto.poNo } });
      if (existing) throw new ConflictException(`PO number ${dto.poNo} already exists`);
      const supplier = await tx.supplier.findFirst({ where: { id: dto.supplierId, deletedAt: null, isActive: true } });
      if (!supplier) throw new NotFoundException('Supplier not found or inactive');

      const lines = dto.lines.map((l) => ({ ...l, amount: Number((l.quantity * l.unitPrice).toFixed(2)) }));
      const subtotal = lines.reduce((s, l) => s + l.amount, 0);
      const taxAmount = Number((subtotal * 0.05).toFixed(2));
      const total = Number((subtotal + taxAmount).toFixed(2));

      const po = await tx.purchaseOrder.create({
        data: {
          poNo: dto.poNo, supplierId: dto.supplierId, prId: dto.prId ?? null,
          status: PO_STATUS.DRAFT, orderDate: new Date(dto.orderDate),
          expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
          currency: dto.currency ?? supplier.currency,
          subtotal, taxAmount, total, notes: dto.notes, createdBy: userId,
          lines: { create: lines.map((l) => ({ lineNo: l.lineNo, itemCode: l.itemCode, itemName: l.itemName, spec: l.spec, unit: l.unit, quantity: l.quantity, unitPrice: l.unitPrice, amount: l.amount, notes: l.notes })) },
        },
        include: { supplier: { select: { id: true, code: true, name: true } }, lines: { orderBy: { lineNo: 'asc' } } },
      });

      // Mark source PR as converted if provided
      if (dto.prId) {
        await tx.purchaseRequisition.update({ where: { id: dto.prId }, data: { status: 'converted' } });
      }

      return po;
    });
  }

  async submit(schema: string, id: string) {
    return this._transition(schema, id, PO_STATUS.DRAFT, PO_STATUS.PENDING_APPROVAL);
  }

  async approve(schema: string, id: string, userId: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const po = await tx.purchaseOrder.findFirst({ where: { id, deletedAt: null } });
      if (!po) throw new NotFoundException('PO not found');
      if (po.status !== PO_STATUS.PENDING_APPROVAL) throw new BadRequestException('Only pending POs can be approved');
      return tx.purchaseOrder.update({ where: { id }, data: { status: PO_STATUS.APPROVED, approvedBy: userId, approvedAt: new Date() } });
    });
  }

  async cancel(schema: string, id: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const po = await tx.purchaseOrder.findFirst({ where: { id, deletedAt: null } });
      if (!po) throw new NotFoundException('PO not found');
      if ([PO_STATUS.RECEIVED, PO_STATUS.INVOICED].includes(po.status as any)) throw new BadRequestException('Cannot cancel this PO');
      return tx.purchaseOrder.update({ where: { id }, data: { status: PO_STATUS.CANCELLED } });
    });
  }

  private async _transition(schema: string, id: string, from: string, to: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const po = await tx.purchaseOrder.findFirst({ where: { id, deletedAt: null } });
      if (!po) throw new NotFoundException('PO not found');
      if (po.status !== from) throw new BadRequestException(`Cannot transition from ${po.status} to ${to}`);
      return tx.purchaseOrder.update({ where: { id }, data: { status: to } });
    });
  }
}

import {
  Injectable, NotFoundException, BadRequestException, ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateSalesOrderDto } from './dto/create-so.dto';

export const SO_STATUSES = {
  DRAFT: 'draft',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  PROCESSING: 'processing',
  PARTIAL_SHIPPED: 'partial_shipped',
  SHIPPED: 'shipped',
  INVOICED: 'invoiced',
  CANCELLED: 'cancelled',
} as const;

@Injectable()
export class SalesOrderService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(schemaName: string, query: {
    page?: number;
    perPage?: number;
    search?: string;
    status?: string;
    customerId?: string;
    fromDate?: string;
    toDate?: string;
  }) {
    const { page = 1, perPage = 20, search, status, customerId, fromDate, toDate } = query;
    const skip = (page - 1) * perPage;

    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      const where: any = { deletedAt: null };
      if (search) {
        where.OR = [
          { orderNo: { contains: search, mode: 'insensitive' } },
          { customer: { name: { contains: search, mode: 'insensitive' } } },
        ];
      }
      if (status) where.status = status;
      if (customerId) where.customerId = customerId;
      if (fromDate || toDate) {
        where.orderDate = {};
        if (fromDate) where.orderDate.gte = new Date(fromDate);
        if (toDate) where.orderDate.lte = new Date(toDate);
      }

      const [data, total] = await Promise.all([
        tx.salesOrder.findMany({
          where,
          skip,
          take: perPage,
          orderBy: { createdAt: 'desc' },
          include: {
            customer: { select: { id: true, code: true, name: true } },
            lines: { select: { id: true, lineNo: true, itemCode: true, itemName: true, quantity: true, amount: true } },
          },
        }),
        tx.salesOrder.count({ where }),
      ]);

      return {
        data,
        meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
      };
    });
  }

  async findById(schemaName: string, id: string) {
    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      const order = await tx.salesOrder.findFirst({
        where: { id, deletedAt: null },
        include: {
          customer: true,
          lines: { orderBy: { lineNo: 'asc' } },
          deliveryOrders: { orderBy: { createdAt: 'desc' } },
        },
      });
      if (!order) throw new NotFoundException('Sales order not found');
      return order;
    });
  }

  async create(schemaName: string, dto: CreateSalesOrderDto, userId: string) {
    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      // Check order number uniqueness
      const existing = await tx.salesOrder.findUnique({ where: { orderNo: dto.orderNo } });
      if (existing) throw new ConflictException(`Order number ${dto.orderNo} already exists`);

      // Validate customer exists
      const customer = await tx.customer.findFirst({
        where: { id: dto.customerId, deletedAt: null, isActive: true },
      });
      if (!customer) throw new NotFoundException('Customer not found or inactive');

      // Calculate line amounts
      const lines = dto.lines.map((line) => {
        const discount = line.discount ?? 0;
        const amount = Number(
          (line.quantity * line.unitPrice * (1 - discount / 100)).toFixed(2),
        );
        return { ...line, amount };
      });

      const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);
      const taxAmount = Number((subtotal * 0.05).toFixed(2)); // 5% tax
      const total = Number((subtotal + taxAmount).toFixed(2));

      // Credit check
      const creditAvailable = Number(customer.creditLimit) - Number(customer.creditBalance);
      const creditChecked = creditAvailable >= total;

      if (Number(customer.creditLimit) > 0 && !creditChecked) {
        throw new BadRequestException(
          `Credit limit exceeded. Available: ${creditAvailable}, Required: ${total}`,
        );
      }

      const order = await tx.salesOrder.create({
        data: {
          orderNo: dto.orderNo,
          customerId: dto.customerId,
          status: SO_STATUSES.DRAFT,
          orderDate: new Date(dto.orderDate),
          requestedDate: dto.requestedDate ? new Date(dto.requestedDate) : null,
          shippingAddress: dto.shippingAddress ?? customer.address,
          currency: dto.currency ?? customer.currency,
          subtotal,
          taxAmount,
          total,
          creditChecked,
          notes: dto.notes,
          createdBy: userId,
          lines: {
            create: lines.map((l) => ({
              lineNo: l.lineNo,
              itemCode: l.itemCode,
              itemName: l.itemName,
              spec: l.spec,
              unit: l.unit,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              discount: l.discount ?? 0,
              amount: l.amount,
              notes: l.notes,
            })),
          },
        },
        include: {
          customer: { select: { id: true, code: true, name: true } },
          lines: { orderBy: { lineNo: 'asc' } },
        },
      });

      // Update customer credit balance
      await tx.customer.update({
        where: { id: dto.customerId },
        data: { creditBalance: { increment: total } },
      });

      return order;
    });
  }

  async submit(schemaName: string, id: string) {
    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      const order = await tx.salesOrder.findFirst({ where: { id, deletedAt: null } });
      if (!order) throw new NotFoundException('Sales order not found');
      if (order.status !== SO_STATUSES.DRAFT) {
        throw new BadRequestException(`Only draft orders can be submitted. Current status: ${order.status}`);
      }
      return tx.salesOrder.update({
        where: { id },
        data: { status: SO_STATUSES.PENDING_APPROVAL },
      });
    });
  }

  async approve(schemaName: string, id: string, userId: string) {
    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      const order = await tx.salesOrder.findFirst({ where: { id, deletedAt: null } });
      if (!order) throw new NotFoundException('Sales order not found');
      if (order.status !== SO_STATUSES.PENDING_APPROVAL) {
        throw new BadRequestException(`Only pending orders can be approved. Current status: ${order.status}`);
      }
      return tx.salesOrder.update({
        where: { id },
        data: {
          status: SO_STATUSES.APPROVED,
          approvedBy: userId,
          approvedAt: new Date(),
        },
      });
    });
  }

  async cancel(schemaName: string, id: string) {
    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      const order = await tx.salesOrder.findFirst({
        where: { id, deletedAt: null },
        select: { id: true, status: true, total: true, customerId: true },
      });
      if (!order) throw new NotFoundException('Sales order not found');
      if ([SO_STATUSES.SHIPPED, SO_STATUSES.INVOICED].includes(order.status as any)) {
        throw new BadRequestException('Cannot cancel shipped or invoiced orders');
      }

      await tx.salesOrder.update({
        where: { id },
        data: { status: SO_STATUSES.CANCELLED },
      });

      // Release credit balance
      await tx.customer.update({
        where: { id: order.customerId },
        data: { creditBalance: { decrement: Number(order.total) } },
      });

      return { message: 'Order cancelled successfully' };
    });
  }
}

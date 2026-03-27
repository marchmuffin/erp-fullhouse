import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';

const TAX_RATE = 0.05;

function buildOrderNo(): string {
  const now = new Date();
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = String(Math.floor(Math.random() * 90000) + 10000);
  return `ORD-${ymd}-${rand}`;
}

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    schema: string,
    query: { page?: number; perPage?: number; sessionId?: string; status?: string },
  ) {
    const { page = 1, perPage = 20, sessionId, status } = query;
    const skip = (page - 1) * perPage;

    return this.prisma.withTenantSchema(schema, async (tx) => {
      const where: any = {};
      if (sessionId) where.sessionId = sessionId;
      if (status) where.status = status;

      const [data, total] = await Promise.all([
        tx.posOrder.findMany({
          where,
          skip,
          take: perPage,
          orderBy: { createdAt: 'desc' },
          include: {
            session: { select: { id: true, sessionNo: true, cashierName: true } },
            lines: true,
          },
        }),
        tx.posOrder.count({ where }),
      ]);

      return {
        data,
        meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
      };
    });
  }

  async findById(schema: string, id: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const order = await tx.posOrder.findUnique({
        where: { id },
        include: {
          lines: true,
          session: { select: { id: true, sessionNo: true, cashierName: true } },
        },
      });
      if (!order) throw new NotFoundException('Order not found');
      return order;
    });
  }

  async create(schema: string, dto: CreateOrderDto) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      // validate session exists and is open
      const session = await tx.posSession.findUnique({ where: { id: dto.sessionId } });
      if (!session) throw new NotFoundException('Session not found');
      if (session.status !== 'open') {
        throw new BadRequestException('Session is not open');
      }

      if (!dto.lines || dto.lines.length === 0) {
        throw new BadRequestException('Order must have at least one line');
      }

      // compute line amounts
      const lineData = dto.lines.map((line) => {
        const discountFactor = 1 - (line.discount ?? 0) / 100;
        const amount = Number((line.quantity * line.unitPrice * discountFactor).toFixed(2));
        return { ...line, amount };
      });

      const subtotal = Number(lineData.reduce((sum, l) => sum + l.amount, 0).toFixed(2));
      const taxAmount = Number((subtotal * TAX_RATE).toFixed(2));
      const totalAmount = Number((subtotal + taxAmount).toFixed(2));
      const paidAmount = Number(dto.paidAmount);
      const changeAmount = Number((paidAmount - totalAmount).toFixed(2));

      if (paidAmount < totalAmount) {
        throw new BadRequestException('Paid amount is less than total amount');
      }

      let orderNo = buildOrderNo();
      let attempts = 0;
      while (attempts < 5) {
        const dup = await tx.posOrder.findUnique({ where: { orderNo } });
        if (!dup) break;
        orderNo = buildOrderNo();
        attempts++;
      }

      const order = await tx.posOrder.create({
        data: {
          orderNo,
          sessionId: dto.sessionId,
          subtotal,
          taxAmount,
          discountAmount: 0,
          totalAmount,
          paidAmount,
          changeAmount,
          paymentMethod: dto.paymentMethod ?? 'cash',
          customerId: dto.customerId,
          status: 'completed',
          lines: {
            create: lineData.map((line) => ({
              itemId: line.itemId,
              itemCode: line.itemCode,
              itemName: line.itemName,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              discount: line.discount ?? 0,
              amount: line.amount,
            })),
          },
        },
        include: { lines: true },
      });

      // update session totals
      await tx.posSession.update({
        where: { id: dto.sessionId },
        data: {
          totalSales: { increment: totalAmount },
          totalOrders: { increment: 1 },
          updatedAt: new Date(),
        },
      });

      return order;
    });
  }

  async void(schema: string, id: string, reason: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const order = await tx.posOrder.findUnique({ where: { id } });
      if (!order) throw new NotFoundException('Order not found');
      if (order.status === 'voided') {
        throw new BadRequestException('Order is already voided');
      }

      const updated = await tx.posOrder.update({
        where: { id },
        data: { status: 'voided', voidReason: reason },
      });

      // subtract from session totals
      await tx.posSession.update({
        where: { id: order.sessionId },
        data: {
          totalSales: { decrement: Number(order.totalAmount) },
          totalOrders: { decrement: 1 },
          updatedAt: new Date(),
        },
      });

      return updated;
    });
  }
}

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class DeliveryOrderService {
  constructor(private readonly prisma: PrismaService) {}

  async findBySalesOrder(schemaName: string, soId: string) {
    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      return tx.deliveryOrder.findMany({
        where: { soId },
        orderBy: { createdAt: 'desc' },
      });
    });
  }

  async create(schemaName: string, soId: string, data: {
    doNo: string;
    shipDate?: string;
    carrier?: string;
    trackingNo?: string;
    notes?: string;
  }, userId: string) {
    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      const order = await tx.salesOrder.findFirst({
        where: { id: soId, deletedAt: null },
      });
      if (!order) throw new NotFoundException('Sales order not found');
      if (!['approved', 'processing', 'partial_shipped'].includes(order.status)) {
        throw new BadRequestException('Sales order must be approved before creating a delivery order');
      }

      const existing = await tx.deliveryOrder.findUnique({ where: { doNo: data.doNo } });
      if (existing) throw new BadRequestException(`Delivery order number ${data.doNo} already exists`);

      return tx.deliveryOrder.create({
        data: {
          doNo: data.doNo,
          soId,
          status: 'draft',
          shipDate: data.shipDate ? new Date(data.shipDate) : null,
          carrier: data.carrier,
          trackingNo: data.trackingNo,
          notes: data.notes,
          createdBy: userId,
        },
      });
    });
  }

  async ship(schemaName: string, id: string) {
    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      const delivery = await tx.deliveryOrder.findUnique({ where: { id } });
      if (!delivery) throw new NotFoundException('Delivery order not found');
      if (delivery.status !== 'draft') {
        throw new BadRequestException('Only draft delivery orders can be shipped');
      }

      const [updated] = await Promise.all([
        tx.deliveryOrder.update({
          where: { id },
          data: { status: 'shipped', shipDate: delivery.shipDate ?? new Date() },
        }),
        tx.salesOrder.update({
          where: { id: delivery.soId },
          data: { status: 'shipped' },
        }),
      ]);

      return updated;
    });
  }
}

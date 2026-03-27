import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class GoodsReceiptService {
  constructor(private readonly prisma: PrismaService) {}

  async findByPO(schema: string, poId: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      return tx.goodsReceipt.findMany({
        where: { poId },
        include: { lines: { orderBy: { lineNo: 'asc' } } },
        orderBy: { createdAt: 'desc' },
      });
    });
  }

  async create(schema: string, poId: string, data: {
    grNo: string; receiveDate: string;
    lines: { poLineId: string; lineNo: number; itemCode: string; itemName: string; unit: string; orderedQty: number; receivedQty: number; notes?: string }[];
    notes?: string;
  }, userId: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const po = await tx.purchaseOrder.findFirst({ where: { id: poId, deletedAt: null } });
      if (!po) throw new NotFoundException('Purchase order not found');
      if (!['approved', 'partial_received'].includes(po.status)) {
        throw new BadRequestException('PO must be approved before receiving');
      }

      const gr = await tx.goodsReceipt.create({
        data: {
          grNo: data.grNo, poId, status: 'confirmed',
          receiveDate: new Date(data.receiveDate), notes: data.notes, createdBy: userId,
          lines: {
            create: data.lines.map((l) => ({
              poLineId: l.poLineId, lineNo: l.lineNo,
              itemCode: l.itemCode, itemName: l.itemName, unit: l.unit,
              orderedQty: l.orderedQty, receivedQty: l.receivedQty, notes: l.notes,
            })),
          },
        },
        include: { lines: true },
      });

      // Update PO line received quantities
      for (const line of data.lines) {
        await tx.pOLine.update({
          where: { id: line.poLineId },
          data: { receivedQty: { increment: line.receivedQty } },
        });
      }

      // Check if PO is fully received
      const allLines = await tx.pOLine.findMany({ where: { poId } });
      const allReceived = allLines.every((l) => Number(l.receivedQty) >= Number(l.quantity));
      const anyReceived = allLines.some((l) => Number(l.receivedQty) > 0);

      await tx.purchaseOrder.update({
        where: { id: poId },
        data: { status: allReceived ? 'received' : anyReceived ? 'partial_received' : po.status },
      });

      return gr;
    });
  }
}

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { StockTxnDto, AdjustTxnDto } from './dto/stock-txn.dto';

@Injectable()
export class StockTxnService {
  constructor(private readonly prisma: PrismaService) {}

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private _buildTxnNo(prefix: string): string {
    const now = new Date();
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const seq = String(Math.floor(Math.random() * 9000) + 1000);
    return `${prefix}-${ym}-${seq}`;
  }

  /**
   * Core helper: upsert StockLevel (add qty delta), then create StockTransaction.
   * qty is a signed delta (positive = in, negative = out).
   */
  async _applyTransaction(
    tx: any,
    itemId: string,
    warehouseId: string,
    qty: number,
    unitCost: number,
    txnType: string,
    refDocType?: string,
    refDocId?: string,
    refDocNo?: string,
    notes?: string,
    createdBy?: string,
  ) {
    // Upsert stock level
    const existing = await tx.stockLevel.findUnique({
      where: { itemId_warehouseId: { itemId, warehouseId } },
    });

    if (existing) {
      await tx.stockLevel.update({
        where: { itemId_warehouseId: { itemId, warehouseId } },
        data: { quantity: { increment: qty } },
      });
    } else {
      await tx.stockLevel.create({
        data: { itemId, warehouseId, quantity: qty, reservedQty: 0 },
      });
    }

    // Create transaction record
    const txnNo = this._buildTxnNo('TXN');
    return tx.stockTransaction.create({
      data: {
        txnNo,
        itemId,
        warehouseId,
        txnType,
        quantity: qty,
        unitCost: unitCost ?? 0,
        refDocType,
        refDocId,
        refDocNo,
        notes,
        createdBy,
      },
    });
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  async findAll(
    schema: string,
    query: {
      page?: number;
      perPage?: number;
      itemId?: string;
      warehouseId?: string;
      txnType?: string;
    },
  ) {
    const { page = 1, perPage = 20, itemId, warehouseId, txnType } = query;
    const skip = (page - 1) * perPage;
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const where: any = {};
      if (itemId) where.itemId = itemId;
      if (warehouseId) where.warehouseId = warehouseId;
      if (txnType) where.txnType = txnType;

      const [data, total] = await Promise.all([
        tx.stockTransaction.findMany({
          where,
          skip,
          take: perPage,
          orderBy: { createdAt: 'desc' },
          include: {
            item: { select: { id: true, code: true, name: true, unit: true } },
            warehouse: { select: { id: true, code: true, name: true } },
          },
        }),
        tx.stockTransaction.count({ where }),
      ]);

      return { data, meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
    });
  }

  async receive(schema: string, dto: StockTxnDto, userId?: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const item = await tx.item.findUnique({ where: { id: dto.itemId } });
      if (!item) throw new NotFoundException('Item not found');
      const wh = await tx.warehouse.findUnique({ where: { id: dto.warehouseId } });
      if (!wh) throw new NotFoundException('Warehouse not found');

      return this._applyTransaction(
        tx,
        dto.itemId,
        dto.warehouseId,
        dto.quantity,
        dto.unitCost ?? Number(item.unitCost),
        'receipt',
        dto.refDocType,
        dto.refDocId,
        dto.refDocNo,
        dto.notes,
        userId,
      );
    });
  }

  async issue(schema: string, dto: StockTxnDto, userId?: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const item = await tx.item.findUnique({ where: { id: dto.itemId } });
      if (!item) throw new NotFoundException('Item not found');
      const wh = await tx.warehouse.findUnique({ where: { id: dto.warehouseId } });
      if (!wh) throw new NotFoundException('Warehouse not found');

      // Check sufficient stock
      const sl = await tx.stockLevel.findUnique({
        where: { itemId_warehouseId: { itemId: dto.itemId, warehouseId: dto.warehouseId } },
      });
      const available = sl ? Number(sl.quantity) - Number(sl.reservedQty) : 0;
      if (available < dto.quantity) {
        throw new BadRequestException(
          `Insufficient stock. Available: ${available}, Requested: ${dto.quantity}`,
        );
      }

      return this._applyTransaction(
        tx,
        dto.itemId,
        dto.warehouseId,
        -dto.quantity,
        dto.unitCost ?? Number(item.unitCost),
        'issue',
        dto.refDocType,
        dto.refDocId,
        dto.refDocNo,
        dto.notes,
        userId,
      );
    });
  }

  async adjust(schema: string, dto: AdjustTxnDto, userId?: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const item = await tx.item.findUnique({ where: { id: dto.itemId } });
      if (!item) throw new NotFoundException('Item not found');
      const wh = await tx.warehouse.findUnique({ where: { id: dto.warehouseId } });
      if (!wh) throw new NotFoundException('Warehouse not found');

      const sl = await tx.stockLevel.findUnique({
        where: { itemId_warehouseId: { itemId: dto.itemId, warehouseId: dto.warehouseId } },
      });
      const currentQty = sl ? Number(sl.quantity) : 0;
      const variance = dto.newQuantity - currentQty;

      return this._applyTransaction(
        tx,
        dto.itemId,
        dto.warehouseId,
        variance,
        dto.unitCost ?? Number(item.unitCost),
        'adjustment',
        undefined,
        undefined,
        undefined,
        dto.notes,
        userId,
      );
    });
  }
}

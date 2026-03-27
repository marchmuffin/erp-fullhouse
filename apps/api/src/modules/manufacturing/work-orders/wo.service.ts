import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateWoDto } from './dto/create-wo.dto';
import { CompleteWoDto } from './dto/complete-wo.dto';

export const WO_STATUS = {
  DRAFT: 'draft',
  RELEASED: 'released',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

@Injectable()
export class WoService {
  constructor(private readonly prisma: PrismaService) {}

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private _buildTxnNo(): string {
    const now = new Date();
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const seq = String(Math.floor(Math.random() * 9000) + 1000);
    return `TXN-${ym}-${seq}`;
  }

  /**
   * Inline stock transaction helper (replicates inventory StockTxnService._applyTransaction).
   * qty is a signed delta (positive = in, negative = out).
   */
  private async _applyTransaction(
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

    const txnNo = this._buildTxnNo();
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

  async findAll(schema: string, query: { page?: number; perPage?: number; status?: string; itemId?: string }) {
    const { page = 1, perPage = 20, status, itemId } = query;
    const skip = (page - 1) * perPage;
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const where: any = {};
      if (status) where.status = status;
      if (itemId) where.itemId = itemId;
      const [data, total] = await Promise.all([
        tx.workOrder.findMany({
          where, skip, take: perPage, orderBy: { createdAt: 'desc' },
          include: {
            item: { select: { id: true, code: true, name: true, unit: true } },
            bom: { select: { id: true, version: true } },
            _count: { select: { operations: true, materialIssues: true } },
          },
        }),
        tx.workOrder.count({ where }),
      ]);
      return { data, meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
    });
  }

  async findById(schema: string, id: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const wo = await tx.workOrder.findUnique({
        where: { id },
        include: {
          item: { select: { id: true, code: true, name: true, unit: true, unitCost: true } },
          bom: { select: { id: true, version: true, description: true } },
          operations: { orderBy: { stepNo: 'asc' } },
          materialIssues: {
            include: {
              item: { select: { id: true, code: true, name: true, unit: true } },
            },
            orderBy: { id: 'asc' },
          },
        },
      });
      if (!wo) throw new NotFoundException('Work order not found');
      return wo;
    });
  }

  async create(schema: string, dto: CreateWoDto, userId: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      // Check WO number uniqueness
      const existing = await tx.workOrder.findUnique({ where: { woNo: dto.woNo } });
      if (existing) throw new BadRequestException(`Work order number ${dto.woNo} already exists`);

      const item = await tx.item.findUnique({ where: { id: dto.itemId } });
      if (!item) throw new NotFoundException('Finished item not found');

      // If bomId provided, validate it exists and belongs to the item
      let bom: any = null;
      if (dto.bomId) {
        bom = await tx.bom.findUnique({ where: { id: dto.bomId }, include: { lines: true } });
        if (!bom) throw new NotFoundException('BOM not found');
        if (!bom.isActive) throw new BadRequestException('Cannot use an inactive BOM');
      }

      // Build material issues from BOM lines if BOM provided
      const materialIssuesData: any[] = [];
      if (bom && bom.lines.length > 0) {
        if (!dto.warehouseId) throw new BadRequestException('warehouseId is required when a BOM is specified for material auto-population');
        for (const line of bom.lines) {
          const requiredQty = Number(line.quantity) * Number(dto.plannedQty);
          materialIssuesData.push({
            itemId: line.componentId,
            warehouseId: dto.warehouseId,
            requiredQty,
            issuedQty: 0,
          });
        }
      }

      return tx.workOrder.create({
        data: {
          woNo: dto.woNo,
          itemId: dto.itemId,
          bomId: dto.bomId ?? null,
          plannedQty: dto.plannedQty,
          producedQty: 0,
          warehouseId: dto.warehouseId ?? null,
          status: WO_STATUS.DRAFT,
          plannedStart: dto.plannedStart ? new Date(dto.plannedStart) : null,
          plannedEnd: dto.plannedEnd ? new Date(dto.plannedEnd) : null,
          notes: dto.notes,
          createdBy: userId,
          operations: dto.operations && dto.operations.length > 0
            ? {
                create: dto.operations.map((op) => ({
                  stepNo: op.stepNo,
                  name: op.name,
                  description: op.description,
                  plannedHours: op.plannedHours ?? null,
                  status: 'pending',
                })),
              }
            : undefined,
          materialIssues: materialIssuesData.length > 0
            ? { create: materialIssuesData }
            : undefined,
        },
        include: {
          item: { select: { id: true, code: true, name: true, unit: true } },
          operations: { orderBy: { stepNo: 'asc' } },
          materialIssues: { include: { item: { select: { id: true, code: true, name: true, unit: true } } } },
        },
      });
    });
  }

  async release(schema: string, id: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const wo = await tx.workOrder.findUnique({ where: { id }, include: { _count: { select: { materialIssues: true } } } });
      if (!wo) throw new NotFoundException('Work order not found');
      if (wo.status !== WO_STATUS.DRAFT) throw new BadRequestException(`Cannot release work order in status '${wo.status}'`);
      if (wo._count.materialIssues === 0 && wo.bomId) {
        throw new BadRequestException('Work order has a BOM but no material issues — populate material issues first');
      }
      return tx.workOrder.update({ where: { id }, data: { status: WO_STATUS.RELEASED } });
    });
  }

  async start(schema: string, id: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const wo = await tx.workOrder.findUnique({ where: { id } });
      if (!wo) throw new NotFoundException('Work order not found');
      if (wo.status !== WO_STATUS.RELEASED) throw new BadRequestException(`Cannot start work order in status '${wo.status}'`);
      return tx.workOrder.update({ where: { id }, data: { status: WO_STATUS.IN_PROGRESS, actualStart: new Date() } });
    });
  }

  async complete(schema: string, id: string, dto: CompleteWoDto, userId: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const wo = await tx.workOrder.findUnique({ where: { id } });
      if (!wo) throw new NotFoundException('Work order not found');
      if (wo.status !== WO_STATUS.IN_PROGRESS) throw new BadRequestException(`Cannot complete work order in status '${wo.status}'`);
      if (dto.producedQty <= 0) throw new BadRequestException('producedQty must be greater than 0');

      // Post finished goods receipt stock transaction if warehouseId set
      if (wo.warehouseId) {
        const item = await tx.item.findUnique({ where: { id: wo.itemId } });
        await this._applyTransaction(
          tx,
          wo.itemId,
          wo.warehouseId,
          dto.producedQty,
          item ? Number(item.unitCost) : 0,
          'receipt',
          'WO',
          id,
          wo.woNo,
          `Finished goods receipt from work order ${wo.woNo}`,
          userId,
        );
      }

      return tx.workOrder.update({
        where: { id },
        data: {
          status: WO_STATUS.COMPLETED,
          producedQty: dto.producedQty,
          actualEnd: new Date(),
        },
      });
    });
  }

  async cancel(schema: string, id: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const wo = await tx.workOrder.findUnique({ where: { id } });
      if (!wo) throw new NotFoundException('Work order not found');
      if (![WO_STATUS.DRAFT, WO_STATUS.RELEASED].includes(wo.status as any)) {
        throw new BadRequestException(`Cannot cancel work order in status '${wo.status}'`);
      }
      return tx.workOrder.update({ where: { id }, data: { status: WO_STATUS.CANCELLED } });
    });
  }

  async issueMaterials(schema: string, woId: string, userId: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const wo = await tx.workOrder.findUnique({
        where: { id: woId },
        include: { materialIssues: true },
      });
      if (!wo) throw new NotFoundException('Work order not found');
      if (![WO_STATUS.RELEASED, WO_STATUS.IN_PROGRESS].includes(wo.status as any)) {
        throw new BadRequestException(`Cannot issue materials for work order in status '${wo.status}'`);
      }
      if (wo.materialIssues.length === 0) throw new BadRequestException('No material issues found for this work order');

      const now = new Date();
      const issuedResults: any[] = [];

      for (const mi of wo.materialIssues) {
        const remaining = Number(mi.requiredQty) - Number(mi.issuedQty);
        if (remaining <= 0) continue; // already fully issued

        // Check sufficient stock
        const sl = await tx.stockLevel.findUnique({
          where: { itemId_warehouseId: { itemId: mi.itemId, warehouseId: mi.warehouseId } },
        });
        const available = sl ? Number(sl.quantity) - Number(sl.reservedQty) : 0;
        if (available < remaining) {
          const item = await tx.item.findUnique({ where: { id: mi.itemId }, select: { code: true, name: true } });
          throw new BadRequestException(
            `Insufficient stock for item ${item?.code ?? mi.itemId}. Available: ${available}, Required: ${remaining}`,
          );
        }

        // Apply stock issue
        const item = await tx.item.findUnique({ where: { id: mi.itemId } });
        await this._applyTransaction(
          tx,
          mi.itemId,
          mi.warehouseId,
          -remaining,
          item ? Number(item.unitCost) : 0,
          'issue',
          'WO',
          woId,
          wo.woNo,
          `Material issue for work order ${wo.woNo}`,
          userId,
        );

        // Update the material issue record
        const updated = await tx.woMaterialIssue.update({
          where: { id: mi.id },
          data: { issuedQty: Number(mi.issuedQty) + remaining, issuedAt: now, issuedBy: userId },
        });
        issuedResults.push(updated);
      }

      return { workOrderId: woId, issued: issuedResults };
    });
  }

  async completeOperation(schema: string, woId: string, opId: string, actualHours?: number) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const wo = await tx.workOrder.findUnique({ where: { id: woId } });
      if (!wo) throw new NotFoundException('Work order not found');

      const op = await tx.woOperation.findUnique({ where: { id: opId } });
      if (!op || op.workOrderId !== woId) throw new NotFoundException('Operation not found on this work order');
      if (op.status === 'completed') throw new BadRequestException('Operation is already completed');

      return tx.woOperation.update({
        where: { id: opId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          ...(actualHours !== undefined && { actualHours }),
        },
      });
    });
  }
}

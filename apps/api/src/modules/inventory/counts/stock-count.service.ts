import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { StockTxnService } from '../transactions/stock-txn.service';
import { CreateCountDto } from './dto/create-count.dto';

@Injectable()
export class StockCountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly txnSvc: StockTxnService,
  ) {}

  async findAll(
    schema: string,
    query: { page?: number; perPage?: number; warehouseId?: string; status?: string },
  ) {
    const { page = 1, perPage = 20, warehouseId, status } = query;
    const skip = (page - 1) * perPage;
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const where: any = {};
      if (warehouseId) where.warehouseId = warehouseId;
      if (status) where.status = status;

      const [data, total] = await Promise.all([
        tx.stockCount.findMany({
          where,
          skip,
          take: perPage,
          orderBy: { createdAt: 'desc' },
          include: {
            warehouse: { select: { id: true, code: true, name: true } },
            _count: { select: { lines: true } },
          },
        }),
        tx.stockCount.count({ where }),
      ]);

      return { data, meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
    });
  }

  async findById(schema: string, id: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const sc = await tx.stockCount.findUnique({
        where: { id },
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          lines: {
            include: {
              item: { select: { id: true, code: true, name: true, unit: true } },
            },
            orderBy: { id: 'asc' },
          },
        },
      });
      if (!sc) throw new NotFoundException('Stock count not found');
      return sc;
    });
  }

  async create(schema: string, dto: CreateCountDto, userId?: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const existing = await tx.stockCount.findUnique({ where: { countNo: dto.countNo } });
      if (existing) throw new BadRequestException(`Count number ${dto.countNo} already exists`);

      const wh = await tx.warehouse.findUnique({ where: { id: dto.warehouseId } });
      if (!wh) throw new NotFoundException('Warehouse not found');

      // Get current stock levels for the warehouse to pre-populate lines
      const stockLevels = await tx.stockLevel.findMany({
        where: { warehouseId: dto.warehouseId },
        include: { item: { select: { id: true, isActive: true } } },
      });

      const activeStockLevels = stockLevels.filter((sl) => sl.item.isActive);

      const sc = await tx.stockCount.create({
        data: {
          countNo: dto.countNo,
          warehouseId: dto.warehouseId,
          status: 'draft',
          countDate: new Date(dto.countDate),
          notes: dto.notes,
          createdBy: userId,
          lines: {
            create: activeStockLevels.map((sl) => ({
              itemId: sl.itemId,
              systemQty: sl.quantity,
            })),
          },
        },
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          lines: {
            include: {
              item: { select: { id: true, code: true, name: true, unit: true } },
            },
          },
        },
      });

      return sc;
    });
  }

  async updateLine(
    schema: string,
    countId: string,
    lineId: string,
    countedQty: number,
    notes?: string,
  ) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const sc = await tx.stockCount.findUnique({ where: { id: countId } });
      if (!sc) throw new NotFoundException('Stock count not found');
      if (sc.status === 'completed' || sc.status === 'cancelled') {
        throw new BadRequestException('Cannot update lines of a completed or cancelled count');
      }

      const line = await tx.stockCountLine.findFirst({
        where: { id: lineId, stockCountId: countId },
      });
      if (!line) throw new NotFoundException('Count line not found');

      const variance = countedQty - Number(line.systemQty);

      return tx.stockCountLine.update({
        where: { id: lineId },
        data: { countedQty, variance, notes },
      });
    });
  }

  async complete(schema: string, countId: string, userId?: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const sc = await tx.stockCount.findUnique({
        where: { id: countId },
        include: { lines: true },
      });
      if (!sc) throw new NotFoundException('Stock count not found');
      if (sc.status !== 'draft' && sc.status !== 'in_progress') {
        throw new BadRequestException('Only draft or in_progress counts can be completed');
      }

      // Apply count_adjust transactions for lines with non-zero variance
      for (const line of sc.lines) {
        if (line.countedQty === null || line.countedQty === undefined) continue;
        const variance = Number(line.variance ?? 0);
        if (variance === 0) continue;

        await this.txnSvc._applyTransaction(
          tx,
          line.itemId,
          sc.warehouseId,
          variance,
          0,
          'count_adjust',
          'SC',
          sc.id,
          sc.countNo,
          `Stock count adjustment — count: ${sc.countNo}`,
          userId,
        );
      }

      return tx.stockCount.update({
        where: { id: countId },
        data: { status: 'completed', completedAt: new Date() },
      });
    });
  }
}

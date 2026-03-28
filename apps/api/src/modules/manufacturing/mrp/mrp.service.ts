import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateMrpDto } from './dto/create-mrp.dto';

@Injectable()
export class MrpService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(schema: string, query: { page?: number; perPage?: number }) {
    const { page = 1, perPage = 20 } = query;
    const skip = (page - 1) * perPage;
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const [data, total] = await Promise.all([
        tx.mrpRun.findMany({
          skip,
          take: perPage,
          orderBy: { createdAt: 'desc' },
          include: {
            _count: { select: { requirements: true } },
          },
        }),
        tx.mrpRun.count(),
      ]);
      return { data, meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
    });
  }

  async findById(schema: string, id: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const run = await tx.mrpRun.findUnique({
        where: { id },
        include: {
          requirements: {
            orderBy: [{ shortageQty: 'desc' }, { itemCode: 'asc' }],
          },
        },
      });
      if (!run) throw new NotFoundException('MRP run not found');
      return run;
    });
  }

  async create(schema: string, dto: CreateMrpDto, userId?: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      // Generate runNo: MRP-YYYYMM-XXXX
      const now = new Date();
      const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      const prefix = `MRP-${yyyymm}-`;
      const last = await tx.mrpRun.findFirst({
        where: { runNo: { startsWith: prefix } },
        orderBy: { runNo: 'desc' },
      });
      let seq = 1;
      if (last) {
        const parts = last.runNo.split('-');
        seq = parseInt(parts[parts.length - 1], 10) + 1;
      }
      const runNo = `${prefix}${String(seq).padStart(4, '0')}`;

      return tx.mrpRun.create({
        data: {
          runNo,
          planningDate: new Date(dto.planningDate),
          horizon: dto.horizon ?? 30,
          status: 'draft',
          notes: dto.notes,
          createdBy: userId,
        },
      });
    });
  }

  async run(schema: string, id: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const mrpRun = await tx.mrpRun.findUnique({ where: { id } });
      if (!mrpRun) throw new NotFoundException('MRP run not found');
      if (!['draft', 'running'].includes(mrpRun.status)) {
        throw new BadRequestException(`Cannot execute MRP run in status: ${mrpRun.status}`);
      }

      // Set status to running
      await tx.mrpRun.update({ where: { id }, data: { status: 'running' } });

      // Find all open/in_progress work orders within the planning horizon
      const horizonEnd = new Date(mrpRun.planningDate);
      horizonEnd.setDate(horizonEnd.getDate() + mrpRun.horizon);

      const workOrders = await tx.workOrder.findMany({
        where: {
          status: { in: ['released', 'in_progress'] },
          plannedStart: { lte: horizonEnd },
        },
        include: {
          bom: {
            include: {
              lines: {
                include: {
                  component: { select: { id: true, code: true, name: true, unit: true } },
                },
              },
            },
          },
        },
      });

      // Aggregate required quantities by itemId
      const requiredMap = new Map<string, {
        itemId: string;
        itemCode: string;
        itemName: string;
        unit: string;
        requiredQty: number;
        workOrderId?: string;
      }>();

      for (const wo of workOrders) {
        if (!wo.bom) continue;
        for (const line of wo.bom.lines) {
          const qty = Number(line.quantity) * Number(wo.plannedQty);
          const existing = requiredMap.get(line.componentId);
          if (existing) {
            existing.requiredQty += qty;
          } else {
            requiredMap.set(line.componentId, {
              itemId: line.componentId,
              itemCode: line.component.code,
              itemName: line.component.name,
              unit: line.component.unit,
              requiredQty: qty,
              workOrderId: wo.id,
            });
          }
        }
      }

      // Delete any previous requirements for this run
      await tx.mrpRequirement.deleteMany({ where: { mrpRunId: id } });

      // For each required item, get available stock and calculate shortage
      const requirementsData: Array<{
        mrpRunId: string;
        itemId: string;
        itemCode: string;
        itemName: string;
        requiredQty: number;
        availableQty: number;
        shortageQty: number;
        unit: string;
        workOrderId: string | null;
      }> = [];
      for (const [itemId, req] of requiredMap.entries()) {
        const stockLevels = await tx.stockLevel.findMany({
          where: { itemId },
        });
        const availableQty = stockLevels.reduce(
          (sum, sl) => sum + Number(sl.quantity) - Number(sl.reservedQty),
          0,
        );
        const shortageQty = Math.max(0, req.requiredQty - availableQty);

        requirementsData.push({
          mrpRunId: id,
          itemId,
          itemCode: req.itemCode,
          itemName: req.itemName,
          requiredQty: req.requiredQty,
          availableQty: Math.max(0, availableQty),
          shortageQty,
          unit: req.unit,
          workOrderId: req.workOrderId ?? null,
        });
      }

      if (requirementsData.length > 0) {
        await tx.mrpRequirement.createMany({ data: requirementsData });
      }

      return tx.mrpRun.update({
        where: { id },
        data: { status: 'completed' },
        include: {
          requirements: {
            orderBy: [{ shortageQty: 'desc' }, { itemCode: 'asc' }],
          },
          _count: { select: { requirements: true } },
        },
      });
    });
  }

  async cancel(schema: string, id: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const mrpRun = await tx.mrpRun.findUnique({ where: { id } });
      if (!mrpRun) throw new NotFoundException('MRP run not found');
      if (!['draft', 'running'].includes(mrpRun.status)) {
        throw new BadRequestException(`Cannot cancel MRP run in status: ${mrpRun.status}`);
      }
      return tx.mrpRun.update({ where: { id }, data: { status: 'cancelled' } });
    });
  }
}

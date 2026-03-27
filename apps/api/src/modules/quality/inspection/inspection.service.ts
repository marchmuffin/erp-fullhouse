import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateInspectionDto } from './dto/create-inspection.dto';
import { RecordResultDto } from './dto/record-result.dto';

@Injectable()
export class InspectionService {
  constructor(private readonly prisma: PrismaService) {}

  private generateIoNo(): string {
    const now = new Date();
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const seq = String(Math.floor(Math.random() * 9000) + 1000);
    return `IO-${ym}-${seq}`;
  }

  async findAll(
    schema: string,
    query: { page?: number; perPage?: number; type?: string; status?: string; search?: string },
  ) {
    const { page = 1, perPage = 20, type, status, search } = query;
    const skip = (page - 1) * perPage;

    return this.prisma.withTenantSchema(schema, async (tx) => {
      const where: any = {};
      if (type) where.type = type;
      if (status) where.status = status;
      if (search) {
        where.OR = [
          { ioNo: { contains: search, mode: 'insensitive' } },
          { itemName: { contains: search, mode: 'insensitive' } },
          { refDocNo: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [data, total] = await Promise.all([
        tx.inspectionOrder.findMany({
          where,
          skip,
          take: perPage,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, ioNo: true, type: true, refDocType: true, refDocNo: true,
            itemId: true, itemName: true, quantity: true, status: true,
            result: true, inspector: true, inspectedAt: true, createdAt: true,
            _count: { select: { checklistItems: true, ncrs: true } },
          },
        }),
        tx.inspectionOrder.count({ where }),
      ]);

      return { data, meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
    });
  }

  async findById(schema: string, id: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const io = await tx.inspectionOrder.findUnique({
        where: { id },
        include: {
          checklistItems: { orderBy: { itemNo: 'asc' } },
          ncrs: { orderBy: { createdAt: 'desc' } },
        },
      });
      if (!io) throw new NotFoundException('Inspection order not found');
      return io;
    });
  }

  async create(schema: string, dto: CreateInspectionDto, userId: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const ioNo = this.generateIoNo();

      return tx.inspectionOrder.create({
        data: {
          ioNo,
          type: dto.type,
          refDocType: dto.refDocType,
          refDocId: dto.refDocId,
          refDocNo: dto.refDocNo,
          itemId: dto.itemId,
          itemName: dto.itemName,
          quantity: dto.quantity,
          inspector: dto.inspector,
          notes: dto.notes,
          checklistItems: dto.checklistItems?.length
            ? {
                create: dto.checklistItems.map((ci) => ({
                  itemNo: ci.itemNo,
                  checkPoint: ci.checkPoint,
                  criteria: ci.criteria,
                })),
              }
            : undefined,
        },
        include: {
          checklistItems: { orderBy: { itemNo: 'asc' } },
        },
      });
    });
  }

  async start(schema: string, id: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const io = await tx.inspectionOrder.findUnique({ where: { id } });
      if (!io) throw new NotFoundException('Inspection order not found');
      if (io.status !== 'pending') {
        throw new BadRequestException(`Cannot start inspection in status: ${io.status}`);
      }
      return tx.inspectionOrder.update({
        where: { id },
        data: { status: 'in_progress' },
      });
    });
  }

  async recordResult(schema: string, id: string, dto: RecordResultDto, userId: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const io = await tx.inspectionOrder.findUnique({ where: { id } });
      if (!io) throw new NotFoundException('Inspection order not found');
      if (io.status !== 'in_progress') {
        throw new BadRequestException(`Cannot record result for inspection in status: ${io.status}`);
      }

      const statusMap: Record<string, string> = {
        pass: 'passed',
        fail: 'failed',
        conditional: 'on_hold',
      };

      return tx.inspectionOrder.update({
        where: { id },
        data: {
          result: dto.result,
          status: statusMap[dto.result] ?? 'on_hold',
          inspectedAt: new Date(),
          inspector: io.inspector ?? userId,
          notes: dto.notes ?? io.notes,
        },
      });
    });
  }

  async updateChecklistItem(
    schema: string,
    ioId: string,
    itemId: string,
    result: string,
    actualValue?: string,
    notes?: string,
  ) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const io = await tx.inspectionOrder.findUnique({ where: { id: ioId } });
      if (!io) throw new NotFoundException('Inspection order not found');

      const ci = await tx.ioChecklistItem.findUnique({ where: { id: itemId } });
      if (!ci || ci.inspectionOrderId !== ioId) {
        throw new NotFoundException('Checklist item not found');
      }

      return tx.ioChecklistItem.update({
        where: { id: itemId },
        data: { result, actualValue, notes },
      });
    });
  }
}

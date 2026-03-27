import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateBomDto } from './dto/create-bom.dto';

@Injectable()
export class BomService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(schema: string, query: { page?: number; perPage?: number; search?: string; itemId?: string }) {
    const { page = 1, perPage = 20, search, itemId } = query;
    const skip = (page - 1) * perPage;
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const where: any = {};
      if (itemId) where.itemId = itemId;
      if (search) where.OR = [
        { item: { code: { contains: search, mode: 'insensitive' } } },
        { item: { name: { contains: search, mode: 'insensitive' } } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
      const [data, total] = await Promise.all([
        tx.bom.findMany({
          where, skip, take: perPage, orderBy: { createdAt: 'desc' },
          include: {
            item: { select: { id: true, code: true, name: true, unit: true } },
            _count: { select: { lines: true, workOrders: true } },
          },
        }),
        tx.bom.count({ where }),
      ]);
      return { data, meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
    });
  }

  async findById(schema: string, id: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const bom = await tx.bom.findUnique({
        where: { id },
        include: {
          item: { select: { id: true, code: true, name: true, unit: true, unitCost: true } },
          lines: {
            orderBy: { lineNo: 'asc' },
            include: {
              component: { select: { id: true, code: true, name: true, unit: true, unitCost: true } },
            },
          },
          _count: { select: { workOrders: true } },
        },
      });
      if (!bom) throw new NotFoundException('BOM not found');
      return bom;
    });
  }

  async create(schema: string, dto: CreateBomDto) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const version = dto.version ?? '1.0';

      // Check uniqueness [itemId, version]
      const existing = await tx.bom.findUnique({ where: { itemId_version: { itemId: dto.itemId, version } } });
      if (existing) throw new ConflictException(`BOM for item ${dto.itemId} version ${version} already exists`);

      const item = await tx.item.findUnique({ where: { id: dto.itemId } });
      if (!item) throw new NotFoundException('Item not found');

      // Validate all component items exist
      for (const line of dto.lines) {
        const component = await tx.item.findUnique({ where: { id: line.componentId } });
        if (!component) throw new NotFoundException(`Component item ${line.componentId} not found`);
        if (line.componentId === dto.itemId) throw new BadRequestException('A BOM component cannot be the same as the finished item');
      }

      return tx.bom.create({
        data: {
          itemId: dto.itemId,
          version,
          description: dto.description,
          isActive: dto.isActive ?? true,
          lines: {
            create: dto.lines.map((l) => ({
              lineNo: l.lineNo,
              componentId: l.componentId,
              quantity: l.quantity,
              unit: l.unit ?? 'PCS',
              notes: l.notes,
            })),
          },
        },
        include: {
          item: { select: { id: true, code: true, name: true, unit: true } },
          lines: { orderBy: { lineNo: 'asc' }, include: { component: { select: { id: true, code: true, name: true, unit: true } } } },
        },
      });
    });
  }

  async update(schema: string, id: string, dto: Partial<CreateBomDto>) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const bom = await tx.bom.findUnique({ where: { id } });
      if (!bom) throw new NotFoundException('BOM not found');

      // If changing version, check uniqueness
      if (dto.version && (dto.version !== bom.version || (dto.itemId && dto.itemId !== bom.itemId))) {
        const targetItemId = dto.itemId ?? bom.itemId;
        const conflict = await tx.bom.findUnique({ where: { itemId_version: { itemId: targetItemId, version: dto.version } } });
        if (conflict && conflict.id !== id) throw new ConflictException(`BOM version ${dto.version} already exists for this item`);
      }

      return tx.bom.update({
        where: { id },
        data: {
          ...(dto.version !== undefined && { version: dto.version }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          ...(dto.lines !== undefined && {
            lines: {
              deleteMany: {},
              create: dto.lines.map((l) => ({
                lineNo: l.lineNo,
                componentId: l.componentId,
                quantity: l.quantity,
                unit: l.unit ?? 'PCS',
                notes: l.notes,
              })),
            },
          }),
        },
        include: {
          item: { select: { id: true, code: true, name: true, unit: true } },
          lines: { orderBy: { lineNo: 'asc' }, include: { component: { select: { id: true, code: true, name: true, unit: true } } } },
        },
      });
    });
  }

  async remove(schema: string, id: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const bom = await tx.bom.findUnique({ where: { id }, include: { _count: { select: { workOrders: true } } } });
      if (!bom) throw new NotFoundException('BOM not found');

      // Check for active work orders
      const activeWoCount = await tx.workOrder.count({
        where: { bomId: id, status: { in: ['draft', 'released', 'in_progress'] } },
      });
      if (activeWoCount > 0) {
        throw new BadRequestException(`Cannot deactivate BOM: ${activeWoCount} active work order(s) reference this BOM`);
      }

      // Soft delete: set isActive = false
      return tx.bom.update({ where: { id }, data: { isActive: false } });
    });
  }
}

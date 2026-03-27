import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateItemDto } from './dto/create-item.dto';

@Injectable()
export class ItemService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    schema: string,
    query: { page?: number; perPage?: number; search?: string; category?: string },
  ) {
    const { page = 1, perPage = 20, search, category } = query;
    const skip = (page - 1) * perPage;
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const where: any = {};
      if (search) {
        where.OR = [
          { code: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (category) where.category = category;

      const [data, total] = await Promise.all([
        tx.item.findMany({
          where,
          skip,
          take: perPage,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, code: true, name: true, category: true, unit: true,
            unitCost: true, safetyStock: true, reorderPoint: true,
            isActive: true, createdAt: true,
          },
        }),
        tx.item.count({ where }),
      ]);

      return { data, meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
    });
  }

  async findById(schema: string, id: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const item = await tx.item.findUnique({
        where: { id },
        include: {
          stockLevels: {
            include: {
              warehouse: { select: { id: true, code: true, name: true, location: true } },
            },
          },
        },
      });
      if (!item) throw new NotFoundException('Item not found');
      return item;
    });
  }

  async findLowStock(schema: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      // Fetch items where any stock level quantity < safetyStock
      const items = await tx.item.findMany({
        where: { isActive: true },
        include: {
          stockLevels: {
            include: {
              warehouse: { select: { id: true, code: true, name: true } },
            },
          },
        },
      });

      return items.filter((item) =>
        item.stockLevels.some(
          (sl) => Number(sl.quantity) < Number(item.safetyStock),
        ),
      );
    });
  }

  async create(schema: string, dto: CreateItemDto) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const existing = await tx.item.findUnique({ where: { code: dto.code } });
      if (existing) throw new ConflictException(`Item code ${dto.code} already exists`);

      return tx.item.create({
        data: {
          code: dto.code,
          name: dto.name,
          description: dto.description,
          category: dto.category,
          unit: dto.unit ?? 'PCS',
          unitCost: dto.unitCost ?? 0,
          safetyStock: dto.safetyStock ?? 0,
          reorderPoint: dto.reorderPoint ?? 0,
          isActive: dto.isActive ?? true,
          notes: dto.notes,
        },
      });
    });
  }

  async update(schema: string, id: string, dto: Partial<CreateItemDto>) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const item = await tx.item.findUnique({ where: { id } });
      if (!item) throw new NotFoundException('Item not found');
      return tx.item.update({ where: { id }, data: { ...dto } });
    });
  }

  async remove(schema: string, id: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const item = await tx.item.findUnique({ where: { id } });
      if (!item) throw new NotFoundException('Item not found');
      return tx.item.update({ where: { id }, data: { isActive: false } });
    });
  }
}

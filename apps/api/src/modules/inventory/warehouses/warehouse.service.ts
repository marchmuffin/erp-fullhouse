import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';

@Injectable()
export class WarehouseService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    schema: string,
    query: { page?: number; perPage?: number; search?: string },
  ) {
    const { page = 1, perPage = 20, search } = query;
    const skip = (page - 1) * perPage;
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const where: any = {};
      if (search) {
        where.OR = [
          { code: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
        ];
      }
      const [data, total] = await Promise.all([
        tx.warehouse.findMany({
          where,
          skip,
          take: perPage,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, code: true, name: true, location: true,
            isActive: true, createdAt: true,
            _count: { select: { stockLevels: true } },
          },
        }),
        tx.warehouse.count({ where }),
      ]);
      return { data, meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
    });
  }

  async findById(schema: string, id: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const wh = await tx.warehouse.findUnique({
        where: { id },
        include: {
          stockLevels: {
            include: {
              item: {
                select: {
                  id: true, code: true, name: true, unit: true,
                  safetyStock: true, reorderPoint: true,
                },
              },
            },
          },
        },
      });
      if (!wh) throw new NotFoundException('Warehouse not found');
      return wh;
    });
  }

  async create(schema: string, dto: CreateWarehouseDto) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const existing = await tx.warehouse.findUnique({ where: { code: dto.code } });
      if (existing) throw new ConflictException(`Warehouse code ${dto.code} already exists`);
      return tx.warehouse.create({
        data: {
          code: dto.code,
          name: dto.name,
          location: dto.location,
        },
      });
    });
  }

  async update(schema: string, id: string, dto: Partial<CreateWarehouseDto> & { isActive?: boolean }) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const wh = await tx.warehouse.findUnique({ where: { id } });
      if (!wh) throw new NotFoundException('Warehouse not found');
      return tx.warehouse.update({ where: { id }, data: { ...dto } });
    });
  }

  async remove(schema: string, id: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const wh = await tx.warehouse.findUnique({ where: { id } });
      if (!wh) throw new NotFoundException('Warehouse not found');
      return tx.warehouse.update({ where: { id }, data: { isActive: false } });
    });
  }
}

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';

@Injectable()
export class SupplierService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(schema: string, query: { page?: number; perPage?: number; search?: string }) {
    const { page = 1, perPage = 20, search } = query;
    const skip = (page - 1) * perPage;
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const where: any = { deletedAt: null };
      if (search) {
        where.OR = [
          { code: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
        ];
      }
      const [data, total] = await Promise.all([
        tx.supplier.findMany({
          where, skip, take: perPage, orderBy: { createdAt: 'desc' },
          select: {
            id: true, code: true, name: true, grade: true,
            paymentTerms: true, contactName: true, contactPhone: true,
            currency: true, isActive: true, createdAt: true,
          },
        }),
        tx.supplier.count({ where }),
      ]);
      return { data, meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
    });
  }

  async findById(schema: string, id: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const s = await tx.supplier.findFirst({ where: { id, deletedAt: null } });
      if (!s) throw new NotFoundException('Supplier not found');
      return s;
    });
  }

  async create(schema: string, dto: CreateSupplierDto, userId: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const existing = await tx.supplier.findUnique({ where: { code: dto.code } });
      if (existing) throw new ConflictException(`Supplier code ${dto.code} already exists`);
      return tx.supplier.create({
        data: {
          code: dto.code, name: dto.name, nameEn: dto.nameEn, taxId: dto.taxId,
          paymentTerms: dto.paymentTerms ?? 30, grade: dto.grade ?? 'C',
          contactName: dto.contactName, contactPhone: dto.contactPhone,
          contactEmail: dto.contactEmail, address: dto.address, city: dto.city,
          country: dto.country ?? 'TW', currency: dto.currency ?? 'TWD',
          bankName: dto.bankName, bankAccount: dto.bankAccount,
          notes: dto.notes, createdBy: userId,
        },
      });
    });
  }

  async update(schema: string, id: string, dto: Partial<CreateSupplierDto> & { isActive?: boolean }) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const s = await tx.supplier.findFirst({ where: { id, deletedAt: null } });
      if (!s) throw new NotFoundException('Supplier not found');
      return tx.supplier.update({ where: { id }, data: { ...dto } });
    });
  }

  async remove(schema: string, id: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const s = await tx.supplier.findFirst({ where: { id, deletedAt: null } });
      if (!s) throw new NotFoundException('Supplier not found');
      return tx.supplier.update({ where: { id }, data: { deletedAt: new Date() } });
    });
  }
}

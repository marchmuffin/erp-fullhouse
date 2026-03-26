import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomerService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(schemaName: string, query: {
    page?: number;
    perPage?: number;
    search?: string;
    isActive?: boolean;
  }) {
    const { page = 1, perPage = 20, search, isActive } = query;
    const skip = (page - 1) * perPage;

    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      const where: any = { deletedAt: null };
      if (search) {
        where.OR = [
          { code: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      const [data, total] = await Promise.all([
        tx.customer.findMany({
          where,
          skip,
          take: perPage,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, code: true, name: true, grade: true,
            creditLimit: true, creditBalance: true, paymentTerms: true,
            contactName: true, contactPhone: true, contactEmail: true,
            currency: true, isActive: true, createdAt: true,
          },
        }),
        tx.customer.count({ where }),
      ]);

      return {
        data,
        meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
      };
    });
  }

  async findById(schemaName: string, id: string) {
    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      const customer = await tx.customer.findFirst({
        where: { id, deletedAt: null },
        include: {
          salesOrders: {
            where: { deletedAt: null, status: { not: 'cancelled' } },
            select: { id: true, orderNo: true, status: true, total: true, orderDate: true },
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });
      if (!customer) throw new NotFoundException('Customer not found');
      return customer;
    });
  }

  async create(schemaName: string, dto: CreateCustomerDto, userId: string) {
    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      const existing = await tx.customer.findUnique({ where: { code: dto.code } });
      if (existing) throw new ConflictException(`Customer code ${dto.code} already exists`);

      return tx.customer.create({
        data: {
          code: dto.code,
          name: dto.name,
          nameEn: dto.nameEn,
          taxId: dto.taxId,
          creditLimit: dto.creditLimit ?? 0,
          paymentTerms: dto.paymentTerms ?? 30,
          grade: dto.grade ?? 'C',
          contactName: dto.contactName,
          contactPhone: dto.contactPhone,
          contactEmail: dto.contactEmail,
          address: dto.address,
          city: dto.city,
          country: dto.country ?? 'TW',
          currency: dto.currency ?? 'TWD',
          notes: dto.notes,
          createdBy: userId,
        },
      });
    });
  }

  async update(schemaName: string, id: string, dto: UpdateCustomerDto) {
    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      const customer = await tx.customer.findFirst({ where: { id, deletedAt: null } });
      if (!customer) throw new NotFoundException('Customer not found');

      return tx.customer.update({
        where: { id },
        data: {
          name: dto.name,
          nameEn: dto.nameEn,
          taxId: dto.taxId,
          creditLimit: dto.creditLimit,
          paymentTerms: dto.paymentTerms,
          grade: dto.grade,
          contactName: dto.contactName,
          contactPhone: dto.contactPhone,
          contactEmail: dto.contactEmail,
          address: dto.address,
          city: dto.city,
          country: dto.country,
          currency: dto.currency,
          isActive: dto.isActive,
          notes: dto.notes,
        },
      });
    });
  }

  async remove(schemaName: string, id: string) {
    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      const customer = await tx.customer.findFirst({ where: { id, deletedAt: null } });
      if (!customer) throw new NotFoundException('Customer not found');
      // Soft delete
      return tx.customer.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    });
  }
}

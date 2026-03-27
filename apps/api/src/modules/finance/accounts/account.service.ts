import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';

@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    schema: string,
    query: { page?: number; perPage?: number; search?: string; type?: string },
  ) {
    const { page = 1, perPage = 20, search, type } = query;
    const skip = (page - 1) * perPage;

    return this.prisma.withTenantSchema(schema, async (tx) => {
      const where: any = {};
      if (search) {
        where.OR = [
          { code: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (type) where.type = type;

      const [data, total] = await Promise.all([
        tx.account.findMany({
          where,
          skip,
          take: perPage,
          orderBy: { code: 'asc' },
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            category: true,
            isActive: true,
            createdAt: true,
          },
        }),
        tx.account.count({ where }),
      ]);

      return {
        data,
        meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
      };
    });
  }

  async findById(schema: string, id: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const account = await tx.account.findUnique({
        where: { id },
        include: {
          debitLines: {
            orderBy: { journalEntry: { jeDate: 'desc' } },
            take: 20,
            include: {
              journalEntry: {
                select: { id: true, jeNo: true, jeDate: true, description: true, status: true },
              },
            },
          },
          creditLines: {
            orderBy: { journalEntry: { jeDate: 'desc' } },
            take: 20,
            include: {
              journalEntry: {
                select: { id: true, jeNo: true, jeDate: true, description: true, status: true },
              },
            },
          },
        },
      });
      if (!account) throw new NotFoundException('Account not found');
      return account;
    });
  }

  async create(schema: string, dto: CreateAccountDto) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const existing = await tx.account.findUnique({ where: { code: dto.code } });
      if (existing) throw new ConflictException(`Account code ${dto.code} already exists`);

      return tx.account.create({
        data: {
          code: dto.code,
          name: dto.name,
          type: dto.type,
          category: dto.category,
          isActive: dto.isActive ?? true,
          notes: dto.notes,
        },
      });
    });
  }

  async update(schema: string, id: string, dto: Partial<CreateAccountDto>) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const account = await tx.account.findUnique({ where: { id } });
      if (!account) throw new NotFoundException('Account not found');
      return tx.account.update({ where: { id }, data: { ...dto } });
    });
  }

  async remove(schema: string, id: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const account = await tx.account.findUnique({ where: { id } });
      if (!account) throw new NotFoundException('Account not found');

      const lineCount = await tx.journalLine.count({
        where: {
          OR: [{ debitAccountId: id }, { creditAccountId: id }],
        },
      });
      if (lineCount > 0) {
        throw new BadRequestException(
          'Cannot delete account that has journal lines; deactivate it instead',
        );
      }

      return tx.account.update({ where: { id }, data: { isActive: false } });
    });
  }
}

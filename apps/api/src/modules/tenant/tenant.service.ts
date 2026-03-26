import { Injectable, ConflictException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(page = 1, perPage = 20) {
    const skip = (page - 1) * perPage;
    const [data, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where: { deletedAt: null },
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, code: true, name: true, plan: true, status: true,
          contactEmail: true, country: true, createdAt: true,
          _count: { select: { users: true } },
        },
      }),
      this.prisma.tenant.count({ where: { deletedAt: null } }),
    ]);

    return {
      data,
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  async findById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id, deletedAt: null },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async create(dto: CreateTenantDto) {
    // Check uniqueness
    const existing = await this.prisma.tenant.findFirst({
      where: { OR: [{ code: dto.code }, { contactEmail: dto.contactEmail }], deletedAt: null },
    });
    if (existing) {
      throw new ConflictException('Tenant code or email already exists');
    }

    const schemaName = `tenant_${dto.code.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    // Create tenant and initial admin user in a transaction
    const tenant = await this.prisma.$transaction(async (tx) => {
      const newTenant = await tx.tenant.create({
        data: {
          code: dto.code,
          name: dto.name,
          contactEmail: dto.contactEmail,
          contactPhone: dto.contactPhone,
          plan: dto.plan as any,
          schemaName,
          modules: dto.modules || [],
          country: dto.country || 'TW',
          timezone: dto.timezone || 'Asia/Taipei',
          locale: dto.locale || 'zh-TW',
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14-day trial
        },
      });

      // Create tenant schema in PostgreSQL
      await tx.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

      // Create initial admin user
      const passwordHash = await bcrypt.hash(dto.adminPassword, 12);
      await tx.user.create({
        data: {
          tenantId: newTenant.id,
          email: dto.adminEmail,
          passwordHash,
          displayName: dto.adminName || dto.adminEmail,
          status: 'active',
          locale: dto.locale || 'zh-TW',
        },
      });

      this.logger.log(`Tenant created: ${newTenant.code} (${newTenant.id})`);
      return newTenant;
    });

    return tenant;
  }

  async suspend(id: string) {
    await this.findById(id);
    return this.prisma.tenant.update({
      where: { id },
      data: { status: 'suspended' },
    });
  }

  async activate(id: string) {
    await this.findById(id);
    return this.prisma.tenant.update({
      where: { id },
      data: { status: 'active' },
    });
  }
}

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

      // Create tenant business tables (sales module)
      await tx.$executeRawUnsafe(`
        SET LOCAL search_path TO "${schemaName}", public;

        CREATE TABLE IF NOT EXISTS customers (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          code VARCHAR(20) UNIQUE NOT NULL,
          name VARCHAR(200) NOT NULL,
          name_en VARCHAR(200),
          tax_id VARCHAR(20),
          credit_limit NUMERIC(15,2) NOT NULL DEFAULT 0,
          credit_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
          payment_terms INTEGER NOT NULL DEFAULT 30,
          grade VARCHAR(1) NOT NULL DEFAULT 'C',
          contact_name VARCHAR(100),
          contact_phone VARCHAR(50),
          contact_email VARCHAR(254),
          address TEXT,
          city VARCHAR(100),
          country VARCHAR(2) NOT NULL DEFAULT 'TW',
          currency VARCHAR(3) NOT NULL DEFAULT 'TWD',
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          notes TEXT,
          created_by UUID NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          deleted_at TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS sales_orders (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          order_no VARCHAR(30) UNIQUE NOT NULL,
          customer_id UUID NOT NULL REFERENCES "${schemaName}".customers(id),
          status VARCHAR(30) NOT NULL DEFAULT 'draft',
          order_date DATE NOT NULL,
          requested_date DATE,
          shipping_address TEXT,
          currency VARCHAR(3) NOT NULL DEFAULT 'TWD',
          exchange_rate NUMERIC(10,6) NOT NULL DEFAULT 1,
          subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
          tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
          total NUMERIC(15,2) NOT NULL DEFAULT 0,
          credit_checked BOOLEAN NOT NULL DEFAULT FALSE,
          notes TEXT,
          approved_by UUID,
          approved_at TIMESTAMPTZ,
          created_by UUID NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          deleted_at TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS so_lines (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          so_id UUID NOT NULL REFERENCES "${schemaName}".sales_orders(id) ON DELETE CASCADE,
          line_no INTEGER NOT NULL,
          item_code VARCHAR(30) NOT NULL,
          item_name VARCHAR(200) NOT NULL,
          spec VARCHAR(200),
          unit VARCHAR(20) NOT NULL,
          quantity NUMERIC(15,4) NOT NULL,
          unit_price NUMERIC(15,4) NOT NULL,
          discount NUMERIC(5,2) NOT NULL DEFAULT 0,
          amount NUMERIC(15,2) NOT NULL,
          shipped_qty NUMERIC(15,4) NOT NULL DEFAULT 0,
          notes TEXT,
          UNIQUE(so_id, line_no)
        );

        CREATE TABLE IF NOT EXISTS delivery_orders (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          do_no VARCHAR(30) UNIQUE NOT NULL,
          so_id UUID NOT NULL REFERENCES "${schemaName}".sales_orders(id),
          status VARCHAR(20) NOT NULL DEFAULT 'draft',
          ship_date DATE,
          carrier VARCHAR(100),
          tracking_no VARCHAR(100),
          notes TEXT,
          created_by UUID NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

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

import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, page = 1, perPage = 20, search?: string) {
    const skip = (page - 1) * perPage;
    const where: any = { tenantId, deletedAt: null };
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, email: true, displayName: true, avatarUrl: true,
          status: true, locale: true, lastLoginAt: true, createdAt: true,
          twoFaEnabled: true, isSuperAdmin: true,
          tenant: { select: { id: true, name: true } },
          userRoles: { include: { role: { select: { id: true, name: true } } } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { data, meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
  }

  async findAllSystem(page = 1, perPage = 20, search?: string, tenantId?: string) {
    const skip = (page - 1) * perPage;
    const where: any = { deletedAt: null };
    if (tenantId) where.tenantId = tenantId;
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, email: true, displayName: true, avatarUrl: true,
          status: true, locale: true, lastLoginAt: true, createdAt: true,
          twoFaEnabled: true, isSuperAdmin: true,
          tenant: { select: { id: true, name: true } },
          userRoles: { include: { role: { select: { id: true, name: true } } } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { data, meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
  }

  async findById(id: string, tenantId?: string) {
    const where: any = { id, deletedAt: null };
    if (tenantId) where.tenantId = tenantId;
    const user = await this.prisma.user.findFirst({
      where,
      include: {
        tenant: { select: { id: true, name: true } },
        userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(tenantId: string, data: { email: string; password: string; displayName: string; roleIds?: string[]; isSuperAdmin?: boolean }) {
    // Enforce maxUsers limit
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (tenant) {
      const currentCount = await this.prisma.user.count({ where: { tenantId, deletedAt: null } });
      if (currentCount >= (tenant.maxUsers ?? 9999)) {
        throw new BadRequestException(
          `User limit reached. Your plan allows a maximum of ${tenant.maxUsers} users.`,
        );
      }
    }

    const existing = await this.prisma.user.findFirst({
      where: { tenantId, email: data.email, deletedAt: null },
    });
    if (existing) throw new ConflictException('Email already exists in this tenant');
    const passwordHash = await bcrypt.hash(data.password, 12);
    return this.prisma.user.create({
      data: {
        tenantId,
        email: data.email,
        passwordHash,
        displayName: data.displayName,
        status: 'active',
        isSuperAdmin: data.isSuperAdmin ?? false,
        userRoles: data.roleIds
          ? { create: data.roleIds.map((roleId) => ({ roleId })) }
          : undefined,
      },
    });
  }

  async update(id: string, tenantId: string | null, dto: { displayName?: string; status?: string; isSuperAdmin?: boolean }) {
    const where: any = { id, deletedAt: null };
    if (tenantId) where.tenantId = tenantId;
    const user = await this.prisma.user.findFirst({ where });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({ where: { id }, data: { ...dto } as any });
  }

  async softDelete(id: string, tenantId: string | null) {
    const where: any = { id, deletedAt: null };
    if (tenantId) where.tenantId = tenantId;
    const user = await this.prisma.user.findFirst({ where });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({ where: { id }, data: { deletedAt: new Date(), status: 'inactive' } });
  }

  async resetTwoFa(id: string, tenantId: string | null) {
    const where: any = { id, deletedAt: null };
    if (tenantId) where.tenantId = tenantId;
    const user = await this.prisma.user.findFirst({ where });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({ where: { id }, data: { twoFaEnabled: false, twoFaSecret: null } });
  }

  async deactivate(id: string, tenantId: string) {
    return this.update(id, tenantId, { status: 'inactive' });
  }

  async activate(id: string, tenantId: string | null) {
    return this.update(id, tenantId, { status: 'active' });
  }

  async listRoles(tenantId: string) {
    return this.prisma.role.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
  }
}

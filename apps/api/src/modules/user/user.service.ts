import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, page = 1, perPage = 20) {
    const skip = (page - 1) * perPage;
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { tenantId, deletedAt: null },
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, email: true, displayName: true, avatarUrl: true,
          status: true, locale: true, lastLoginAt: true, createdAt: true,
          userRoles: { include: { role: { select: { id: true, name: true } } } },
        },
      }),
      this.prisma.user.count({ where: { tenantId, deletedAt: null } }),
    ]);

    return {
      data,
      meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    };
  }

  async findById(id: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(tenantId: string, data: { email: string; password: string; displayName: string; roleIds?: string[] }) {
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
        userRoles: data.roleIds
          ? { create: data.roleIds.map((roleId) => ({ roleId })) }
          : undefined,
      },
    });
  }

  async deactivate(id: string, tenantId: string) {
    await this.findById(id, tenantId);
    return this.prisma.user.update({
      where: { id },
      data: { status: 'inactive' },
    });
  }
}

import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../prisma/prisma.service';

export interface TenantRequest extends Request {
  tenantId?: string;
  tenantSchemaName?: string;
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: TenantRequest, res: Response, next: NextFunction) {
    // Skip tenant resolution for public routes
    const publicPaths = ['/api/v1/auth/login', '/api/v1/auth/refresh', '/api/v1/health'];
    if (publicPaths.some((path) => req.path.startsWith(path))) {
      return next();
    }

    // Tenant can be identified via header (for API clients)
    // or resolved from JWT token (handled in auth guard)
    const tenantId = req.headers['x-tenant-id'] as string;

    if (tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId, deletedAt: null },
        select: { id: true, schemaName: true, status: true },
      });

      if (!tenant) {
        throw new UnauthorizedException('Invalid tenant');
      }

      if (tenant.status === 'suspended' || tenant.status === 'cancelled') {
        throw new UnauthorizedException(`Tenant account is ${tenant.status}`);
      }

      req.tenantId = tenant.id;
      req.tenantSchemaName = tenant.schemaName;
    }

    next();
  }
}

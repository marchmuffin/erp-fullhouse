import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateNcrDto } from './dto/create-ncr.dto';
import { ResolveNcrDto } from './dto/resolve-ncr.dto';

@Injectable()
export class NcrService {
  constructor(private readonly prisma: PrismaService) {}

  private generateNcrNo(): string {
    const now = new Date();
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const seq = String(Math.floor(Math.random() * 9000) + 1000);
    return `NCR-${ym}-${seq}`;
  }

  async findAll(
    schema: string,
    query: { page?: number; perPage?: number; status?: string; severity?: string; search?: string },
  ) {
    const { page = 1, perPage = 20, status, severity, search } = query;
    const skip = (page - 1) * perPage;

    return this.prisma.withTenantSchema(schema, async (tx) => {
      const where: any = {};
      if (status) where.status = status;
      if (severity) where.severity = severity;
      if (search) {
        where.OR = [
          { ncrNo: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [data, total] = await Promise.all([
        tx.nonConformance.findMany({
          where,
          skip,
          take: perPage,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, ncrNo: true, inspectionOrderId: true, severity: true,
            description: true, status: true, rootCause: true, correctiveAction: true,
            resolvedAt: true, resolvedBy: true, createdBy: true, createdAt: true,
            inspectionOrder: { select: { id: true, ioNo: true, type: true } },
          },
        }),
        tx.nonConformance.count({ where }),
      ]);

      return { data, meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
    });
  }

  async findById(schema: string, id: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const ncr = await tx.nonConformance.findUnique({
        where: { id },
        include: {
          inspectionOrder: { select: { id: true, ioNo: true, type: true, itemName: true } },
        },
      });
      if (!ncr) throw new NotFoundException('NCR not found');
      return ncr;
    });
  }

  async create(schema: string, dto: CreateNcrDto, userId: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      if (dto.inspectionOrderId) {
        const io = await tx.inspectionOrder.findUnique({ where: { id: dto.inspectionOrderId } });
        if (!io) throw new NotFoundException('Inspection order not found');
      }

      const ncrNo = this.generateNcrNo();

      return tx.nonConformance.create({
        data: {
          ncrNo,
          inspectionOrderId: dto.inspectionOrderId,
          severity: dto.severity,
          description: dto.description,
          createdBy: userId,
        },
        include: {
          inspectionOrder: { select: { id: true, ioNo: true, type: true } },
        },
      });
    });
  }

  async resolve(schema: string, id: string, dto: ResolveNcrDto, userId: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const ncr = await tx.nonConformance.findUnique({ where: { id } });
      if (!ncr) throw new NotFoundException('NCR not found');
      if (!['open', 'in_review'].includes(ncr.status)) {
        throw new BadRequestException(`Cannot resolve NCR in status: ${ncr.status}`);
      }

      return tx.nonConformance.update({
        where: { id },
        data: {
          rootCause: dto.rootCause,
          correctiveAction: dto.correctiveAction,
          status: 'resolved',
          resolvedAt: new Date(),
          resolvedBy: userId,
        },
      });
    });
  }

  async close(schema: string, id: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const ncr = await tx.nonConformance.findUnique({ where: { id } });
      if (!ncr) throw new NotFoundException('NCR not found');
      if (ncr.status !== 'resolved') {
        throw new BadRequestException(`Cannot close NCR in status: ${ncr.status}. Must be resolved first.`);
      }

      return tx.nonConformance.update({
        where: { id },
        data: { status: 'closed' },
      });
    });
  }

  async markInReview(schema: string, id: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const ncr = await tx.nonConformance.findUnique({ where: { id } });
      if (!ncr) throw new NotFoundException('NCR not found');
      if (ncr.status !== 'open') {
        throw new BadRequestException(`Cannot mark in_review NCR in status: ${ncr.status}`);
      }
      return tx.nonConformance.update({ where: { id }, data: { status: 'in_review' } });
    });
  }
}

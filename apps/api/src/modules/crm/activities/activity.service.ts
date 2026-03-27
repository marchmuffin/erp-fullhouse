import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateActivityDto } from './dto/create-activity.dto';

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    schema: string,
    query: {
      page?: number;
      perPage?: number;
      leadId?: string;
      opportunityId?: string;
      type?: string;
      status?: string;
    },
  ) {
    const { page = 1, perPage = 20, leadId, opportunityId, type, status } = query;
    const skip = (page - 1) * perPage;

    return this.prisma.withTenantSchema(schema, async (tx) => {
      const where: any = {};
      if (leadId) where.leadId = leadId;
      if (opportunityId) where.opportunityId = opportunityId;
      if (type) where.type = type;
      if (status) where.status = status;

      const [data, total] = await Promise.all([
        tx.crmActivity.findMany({
          where,
          skip,
          take: perPage,
          orderBy: { createdAt: 'desc' },
          include: {
            lead: { select: { id: true, name: true, company: true } },
            opportunity: { select: { id: true, title: true } },
          },
        }),
        tx.crmActivity.count({ where }),
      ]);

      return { data, meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
    });
  }

  async create(schema: string, dto: CreateActivityDto, userId: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      return tx.crmActivity.create({
        data: {
          type: dto.type,
          subject: dto.subject,
          description: dto.description,
          leadId: dto.leadId,
          opportunityId: dto.opportunityId,
          scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
          createdBy: userId,
        },
      });
    });
  }

  async complete(schema: string, id: string, userId: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const activity = await tx.crmActivity.findFirst({ where: { id } });
      if (!activity) throw new NotFoundException('Activity not found');
      return tx.crmActivity.update({
        where: { id },
        data: { status: 'completed', completedAt: new Date() },
      });
    });
  }

  async cancel(schema: string, id: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const activity = await tx.crmActivity.findFirst({ where: { id } });
      if (!activity) throw new NotFoundException('Activity not found');
      return tx.crmActivity.update({
        where: { id },
        data: { status: 'cancelled' },
      });
    });
  }
}

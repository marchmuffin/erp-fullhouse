import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';

@Injectable()
export class OpportunityService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    schema: string,
    query: { page?: number; perPage?: number; search?: string; stage?: string },
  ) {
    const { page = 1, perPage = 20, search, stage } = query;
    const skip = (page - 1) * perPage;

    return this.prisma.withTenantSchema(schema, async (tx) => {
      const where: any = {};
      if (stage) where.stage = stage;
      if (search) {
        where.OR = [{ title: { contains: search, mode: 'insensitive' } }];
      }

      const [data, total] = await Promise.all([
        tx.opportunity.findMany({
          where,
          skip,
          take: perPage,
          orderBy: { createdAt: 'desc' },
          include: {
            lead: { select: { id: true, name: true, company: true } },
          },
        }),
        tx.opportunity.count({ where }),
      ]);

      return { data, meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
    });
  }

  async findById(schema: string, id: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const opp = await tx.opportunity.findFirst({
        where: { id },
        include: {
          lead: true,
          activities: { orderBy: { createdAt: 'desc' } },
        },
      });
      if (!opp) throw new NotFoundException('Opportunity not found');
      return opp;
    });
  }

  async create(schema: string, dto: CreateOpportunityDto, userId: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      return tx.opportunity.create({
        data: {
          title: dto.title,
          leadId: dto.leadId,
          customerId: dto.customerId,
          stage: dto.stage ?? 'prospecting',
          probability: dto.probability ?? 0,
          value: dto.value ?? 0,
          expectedClose: dto.expectedClose ? new Date(dto.expectedClose) : undefined,
          assignedTo: dto.assignedTo ?? userId,
          notes: dto.notes,
        },
      });
    });
  }

  async update(schema: string, id: string, dto: Partial<CreateOpportunityDto>) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const opp = await tx.opportunity.findFirst({ where: { id } });
      if (!opp) throw new NotFoundException('Opportunity not found');
      return tx.opportunity.update({
        where: { id },
        data: {
          ...dto,
          expectedClose: dto.expectedClose ? new Date(dto.expectedClose) : undefined,
        },
      });
    });
  }

  async closeWon(schema: string, id: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const opp = await tx.opportunity.findFirst({ where: { id } });
      if (!opp) throw new NotFoundException('Opportunity not found');
      return tx.opportunity.update({
        where: { id },
        data: { stage: 'closed_won', probability: 100 },
      });
    });
  }

  async closeLost(schema: string, id: string, reason?: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const opp = await tx.opportunity.findFirst({ where: { id } });
      if (!opp) throw new NotFoundException('Opportunity not found');
      return tx.opportunity.update({
        where: { id },
        data: {
          stage: 'closed_lost',
          probability: 0,
          notes: reason
            ? `[失敗原因] ${reason}${opp.notes ? '\n' + opp.notes : ''}`
            : opp.notes,
        },
      });
    });
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';

@Injectable()
export class LeadService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    schema: string,
    query: { page?: number; perPage?: number; search?: string; status?: string; source?: string },
  ) {
    const { page = 1, perPage = 20, search, status, source } = query;
    const skip = (page - 1) * perPage;

    return this.prisma.withTenantSchema(schema, async (tx) => {
      const where: any = {};
      if (status) where.status = status;
      if (source) where.source = source;
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { company: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [data, total] = await Promise.all([
        tx.lead.findMany({
          where,
          skip,
          take: perPage,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, name: true, company: true, email: true, phone: true,
            source: true, status: true, estimatedValue: true,
            assignedTo: true, createdAt: true,
          },
        }),
        tx.lead.count({ where }),
      ]);

      return { data, meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
    });
  }

  async findById(schema: string, id: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const lead = await tx.lead.findFirst({
        where: { id },
        include: {
          activities: { orderBy: { createdAt: 'desc' } },
          opportunities: { orderBy: { createdAt: 'desc' } },
        },
      });
      if (!lead) throw new NotFoundException('Lead not found');
      return lead;
    });
  }

  async create(schema: string, dto: CreateLeadDto, userId: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      return tx.lead.create({
        data: {
          name: dto.name,
          company: dto.company,
          email: dto.email,
          phone: dto.phone,
          source: dto.source,
          estimatedValue: dto.estimatedValue,
          assignedTo: dto.assignedTo ?? userId,
          notes: dto.notes,
        },
      });
    });
  }

  async update(schema: string, id: string, dto: Partial<CreateLeadDto> & { status?: string }) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const lead = await tx.lead.findFirst({ where: { id } });
      if (!lead) throw new NotFoundException('Lead not found');
      return tx.lead.update({ where: { id }, data: { ...dto } });
    });
  }

  async qualify(schema: string, id: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const lead = await tx.lead.findFirst({ where: { id } });
      if (!lead) throw new NotFoundException('Lead not found');

      const [updatedLead, opportunity] = await Promise.all([
        tx.lead.update({ where: { id }, data: { status: 'qualified' } }),
        tx.opportunity.create({
          data: {
            title: `${lead.name}${lead.company ? ' - ' + lead.company : ''} 商機`,
            leadId: id,
            stage: 'qualification',
            probability: 20,
            value: lead.estimatedValue ?? 0,
            assignedTo: lead.assignedTo,
          },
        }),
      ]);

      return { lead: updatedLead, opportunity };
    });
  }

  async disqualify(schema: string, id: string, reason?: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const lead = await tx.lead.findFirst({ where: { id } });
      if (!lead) throw new NotFoundException('Lead not found');
      return tx.lead.update({
        where: { id },
        data: {
          status: 'disqualified',
          notes: reason ? `[取消資格] ${reason}${lead.notes ? '\n' + lead.notes : ''}` : lead.notes,
        },
      });
    });
  }
}

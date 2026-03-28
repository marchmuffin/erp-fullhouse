import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';

@Injectable()
export class TicketService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    schema: string,
    query: {
      page?: number; perPage?: number; search?: string;
      status?: string; priority?: string; type?: string;
    },
  ) {
    const { page = 1, perPage = 20, search, status, priority, type } = query;
    const skip = (page - 1) * perPage;

    return this.prisma.withTenantSchema(schema, async (tx) => {
      const where: any = { deletedAt: null };
      if (status) where.status = status;
      if (priority) where.priority = priority;
      if (type) where.type = type;
      if (search) {
        where.OR = [
          { ticketNo: { contains: search, mode: 'insensitive' } },
          { title: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [data, total] = await Promise.all([
        tx.serviceTicket.findMany({
          where, skip, take: perPage, orderBy: { createdAt: 'desc' },
        }),
        tx.serviceTicket.count({ where }),
      ]);

      return { data, meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
    });
  }

  async findById(schema: string, id: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const ticket = await tx.serviceTicket.findFirst({ where: { id, deletedAt: null } });
      if (!ticket) throw new NotFoundException('Service ticket not found');
      return ticket;
    });
  }

  async create(schema: string, dto: CreateTicketDto, userId: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const count = await tx.serviceTicket.count();
      const ticketNo = `TKT-${String(count + 1).padStart(6, '0')}`;
      return tx.serviceTicket.create({
        data: {
          ticketNo,
          title: dto.title,
          description: dto.description,
          type: dto.type ?? 'inquiry',
          priority: dto.priority ?? 'medium',
          customerId: dto.customerId,
          leadId: dto.leadId,
          assignedTo: dto.assignedTo ?? userId,
          createdBy: userId,
        },
      });
    });
  }

  async update(schema: string, id: string, dto: Partial<CreateTicketDto> & { status?: string }) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const ticket = await tx.serviceTicket.findFirst({ where: { id, deletedAt: null } });
      if (!ticket) throw new NotFoundException('Service ticket not found');
      return tx.serviceTicket.update({ where: { id }, data: { ...dto } });
    });
  }

  async resolve(schema: string, id: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const ticket = await tx.serviceTicket.findFirst({ where: { id, deletedAt: null } });
      if (!ticket) throw new NotFoundException('Service ticket not found');
      return tx.serviceTicket.update({
        where: { id },
        data: { status: 'resolved', resolvedAt: new Date() },
      });
    });
  }

  async close(schema: string, id: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const ticket = await tx.serviceTicket.findFirst({ where: { id, deletedAt: null } });
      if (!ticket) throw new NotFoundException('Service ticket not found');
      return tx.serviceTicket.update({
        where: { id },
        data: {
          status: 'closed',
          closedAt: new Date(),
          resolvedAt: ticket.resolvedAt ?? new Date(),
        },
      });
    });
  }

  async remove(schema: string, id: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const ticket = await tx.serviceTicket.findFirst({ where: { id, deletedAt: null } });
      if (!ticket) throw new NotFoundException('Service ticket not found');
      return tx.serviceTicket.update({ where: { id }, data: { deletedAt: new Date() } });
    });
  }
}

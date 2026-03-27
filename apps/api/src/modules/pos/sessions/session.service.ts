import {
  Injectable, NotFoundException, BadRequestException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { OpenSessionDto } from './dto/open-session.dto';
import { CloseSessionDto } from './dto/close-session.dto';

function buildSessionNo(): string {
  const now = new Date();
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `POS-${ymd}-${rand}`;
}

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    schema: string,
    query: { page?: number; perPage?: number; status?: string },
  ) {
    const { page = 1, perPage = 20, status } = query;
    const skip = (page - 1) * perPage;

    return this.prisma.withTenantSchema(schema, async (tx) => {
      const where: any = {};
      if (status) where.status = status;

      const [data, total] = await Promise.all([
        tx.posSession.findMany({
          where,
          skip,
          take: perPage,
          orderBy: { openedAt: 'desc' },
          include: {
            _count: { select: { orders: true } },
          },
        }),
        tx.posSession.count({ where }),
      ]);

      return {
        data,
        meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
      };
    });
  }

  async findById(schema: string, id: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const session = await tx.posSession.findUnique({
        where: { id },
        include: {
          orders: {
            orderBy: { createdAt: 'desc' },
            select: {
              id: true, orderNo: true, totalAmount: true, paymentMethod: true,
              status: true, createdAt: true,
            },
          },
        },
      });
      if (!session) throw new NotFoundException('Session not found');
      return session;
    });
  }

  async open(schema: string, dto: OpenSessionDto, userId: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      // check no open session for this cashier
      const existing = await tx.posSession.findFirst({
        where: { cashierId: userId, status: 'open' },
      });
      if (existing) {
        throw new ConflictException('You already have an open session. Close it first.');
      }

      let sessionNo = buildSessionNo();
      // ensure uniqueness
      let attempts = 0;
      while (attempts < 5) {
        const dup = await tx.posSession.findUnique({ where: { sessionNo } });
        if (!dup) break;
        sessionNo = buildSessionNo();
        attempts++;
      }

      return tx.posSession.create({
        data: {
          sessionNo,
          cashierId: userId,
          cashierName: dto.cashierName,
          openingCash: dto.openingCash ?? 0,
          status: 'open',
        },
      });
    });
  }

  async close(schema: string, id: string, dto: CloseSessionDto) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const session = await tx.posSession.findUnique({ where: { id } });
      if (!session) throw new NotFoundException('Session not found');
      if (session.status === 'closed') {
        throw new BadRequestException('Session is already closed');
      }

      return tx.posSession.update({
        where: { id },
        data: {
          status: 'closed',
          closedAt: new Date(),
          closingCash: dto.closingCash,
          notes: dto.notes,
          updatedAt: new Date(),
        },
      });
    });
  }

  async getActiveSession(schema: string, userId: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      return tx.posSession.findFirst({
        where: { cashierId: userId, status: 'open' },
        orderBy: { openedAt: 'desc' },
      });
    });
  }
}

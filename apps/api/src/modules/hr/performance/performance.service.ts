import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateReviewDto, UpdateReviewDto, CompleteReviewDto } from './dto/create-review.dto';

@Injectable()
export class PerformanceService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(schemaName: string, query: {
    page?: number;
    perPage?: number;
    employeeId?: string;
    status?: string;
    period?: string;
  }) {
    const { page = 1, perPage = 20, employeeId, status, period } = query;
    const skip = (page - 1) * perPage;

    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      const where: any = {};
      if (employeeId) where.employeeId = employeeId;
      if (status) where.status = status;
      if (period) where.period = period;

      const [data, total] = await Promise.all([
        tx.performanceReview.findMany({
          where,
          skip,
          take: perPage,
          orderBy: { createdAt: 'desc' },
          include: {
            employee: {
              select: { id: true, empNo: true, firstName: true, lastName: true, department: true },
            },
          },
        }),
        tx.performanceReview.count({ where }),
      ]);

      return {
        data,
        meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
      };
    });
  }

  async findById(schemaName: string, id: string) {
    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      const review = await tx.performanceReview.findFirst({
        where: { id },
        include: {
          employee: {
            select: { id: true, empNo: true, firstName: true, lastName: true, department: true, position: true },
          },
        },
      });
      if (!review) throw new NotFoundException('Performance review not found');
      return review;
    });
  }

  async create(schemaName: string, dto: CreateReviewDto) {
    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      const employee = await tx.employee.findFirst({ where: { id: dto.employeeId } });
      if (!employee) throw new NotFoundException('Employee not found');

      const reviewNo = await this.generateReviewNo(tx);

      return tx.performanceReview.create({
        data: {
          reviewNo,
          employeeId: dto.employeeId,
          reviewerId: dto.reviewerId,
          period: dto.period,
          reviewType: dto.reviewType ?? 'annual',
          goals: dto.goals,
          comments: dto.comments,
        },
        include: {
          employee: {
            select: { id: true, empNo: true, firstName: true, lastName: true },
          },
        },
      });
    });
  }

  async update(schemaName: string, id: string, dto: UpdateReviewDto) {
    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      const review = await tx.performanceReview.findFirst({ where: { id } });
      if (!review) throw new NotFoundException('Performance review not found');
      if (review.status === 'completed' || review.status === 'cancelled') {
        throw new BadRequestException(`Cannot update review in status: ${review.status}`);
      }

      return tx.performanceReview.update({
        where: { id },
        data: {
          ...(dto.reviewerId !== undefined && { reviewerId: dto.reviewerId }),
          ...(dto.period !== undefined && { period: dto.period }),
          ...(dto.reviewType !== undefined && { reviewType: dto.reviewType }),
          ...(dto.goals !== undefined && { goals: dto.goals }),
          ...(dto.comments !== undefined && { comments: dto.comments }),
        },
      });
    });
  }

  async submit(schemaName: string, id: string) {
    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      const review = await tx.performanceReview.findFirst({ where: { id } });
      if (!review) throw new NotFoundException('Performance review not found');
      if (review.status !== 'draft') {
        throw new BadRequestException(`Cannot submit review in status: ${review.status}`);
      }

      return tx.performanceReview.update({
        where: { id },
        data: { status: 'in_review' },
      });
    });
  }

  async complete(schemaName: string, id: string, dto: CompleteReviewDto) {
    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      const review = await tx.performanceReview.findFirst({ where: { id } });
      if (!review) throw new NotFoundException('Performance review not found');
      if (review.status !== 'in_review') {
        throw new BadRequestException(`Cannot complete review in status: ${review.status}`);
      }

      return tx.performanceReview.update({
        where: { id },
        data: {
          status: 'completed',
          overallScore: dto.overallScore,
          comments: dto.comments ?? review.comments,
          reviewedAt: new Date(),
        },
      });
    });
  }

  async cancel(schemaName: string, id: string) {
    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      const review = await tx.performanceReview.findFirst({ where: { id } });
      if (!review) throw new NotFoundException('Performance review not found');
      if (review.status === 'completed' || review.status === 'cancelled') {
        throw new BadRequestException(`Cannot cancel review in status: ${review.status}`);
      }

      return tx.performanceReview.update({
        where: { id },
        data: { status: 'cancelled' },
      });
    });
  }

  private async generateReviewNo(tx: any): Promise<string> {
    const now = new Date();
    const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `PR-${yyyymm}-`;

    const last = await tx.performanceReview.findFirst({
      where: { reviewNo: { startsWith: prefix } },
      orderBy: { reviewNo: 'desc' },
    });

    let seq = 1;
    if (last) {
      const parts = last.reviewNo.split('-');
      seq = parseInt(parts[parts.length - 1], 10) + 1;
    }

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }
}

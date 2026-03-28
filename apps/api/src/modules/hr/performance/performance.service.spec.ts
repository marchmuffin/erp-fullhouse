import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';

import { PerformanceService } from './performance.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

const mockTx = {
  performanceReview: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  employee: {
    findFirst: jest.fn(),
  },
};

const mockPrisma = {
  withTenantSchema: jest.fn().mockImplementation((_schema: string, fn: (tx: any) => any) =>
    fn(mockTx),
  ),
};

const SCHEMA = 'tenant_test';
const EMP_ID = 'emp-1';
const REVIEWER_ID = 'emp-2';

function makeEmployee() {
  return {
    id: EMP_ID,
    empNo: 'E001',
    firstName: '小明',
    lastName: '王',
    department: 'Engineering',
    position: 'Engineer',
  };
}

function makeReview(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'rev-1',
    reviewNo: 'PR-202603-0001',
    employeeId: EMP_ID,
    reviewerId: REVIEWER_ID,
    period: '2026-Q1',
    reviewType: 'annual',
    status: 'draft',
    goals: null,
    comments: null,
    overallScore: null,
    reviewedAt: null,
    createdAt: new Date('2026-03-01'),
    employee: makeEmployee(),
    ...overrides,
  };
}

const createDto = {
  employeeId: EMP_ID,
  reviewerId: REVIEWER_ID,
  period: '2026-Q1',
  reviewType: 'annual',
  goals: 'Meet OKRs',
  comments: null,
} as any;

describe('PerformanceService', () => {
  let service: PerformanceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PerformanceService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PerformanceService>(PerformanceService);
    jest.clearAllMocks();
  });

  describe('findAll()', () => {
    it('should return paginated performance reviews with default pagination', async () => {
      const reviews = [makeReview()];
      mockTx.performanceReview.findMany.mockResolvedValue(reviews);
      mockTx.performanceReview.count.mockResolvedValue(1);

      const result = await service.findAll(SCHEMA, {});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ page: 1, perPage: 20, total: 1, totalPages: 1 });
    });

    it('should filter by employeeId, status, and period when provided', async () => {
      mockTx.performanceReview.findMany.mockResolvedValue([]);
      mockTx.performanceReview.count.mockResolvedValue(0);

      await service.findAll(SCHEMA, { employeeId: EMP_ID, status: 'in_review', period: '2026-Q1' });

      expect(mockTx.performanceReview.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { employeeId: EMP_ID, status: 'in_review', period: '2026-Q1' },
        }),
      );
    });
  });

  describe('findById()', () => {
    it('should return a review with employee details', async () => {
      mockTx.performanceReview.findFirst.mockResolvedValue(makeReview());

      const result = await service.findById(SCHEMA, 'rev-1');

      expect(mockTx.performanceReview.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'rev-1' } }),
      );
      expect(result.id).toBe('rev-1');
    });

    it('should throw NotFoundException when review does not exist', async () => {
      mockTx.performanceReview.findFirst.mockResolvedValue(null);

      await expect(service.findById(SCHEMA, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create()', () => {
    it('should create a review with an auto-generated PR number in draft status', async () => {
      mockTx.employee.findFirst.mockResolvedValue(makeEmployee());
      mockTx.performanceReview.findFirst.mockResolvedValue(null); // no prior review (seq = 1)
      const created = makeReview({ reviewNo: 'PR-202603-0001' });
      mockTx.performanceReview.create.mockResolvedValue(created);

      const result = await service.create(SCHEMA, createDto);

      expect(mockTx.performanceReview.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            employeeId: EMP_ID,
            reviewerId: REVIEWER_ID,
            period: '2026-Q1',
            reviewType: 'annual',
          }),
        }),
      );
      expect(result.reviewNo).toMatch(/^PR-\d{6}-\d{4}$/);
      expect(result.status).toBe('draft');
    });

    it('should increment PR sequence number from the last existing review', async () => {
      mockTx.employee.findFirst.mockResolvedValue(makeEmployee());
      mockTx.performanceReview.findFirst.mockResolvedValue({ reviewNo: 'PR-202603-0007' });
      const created = makeReview({ reviewNo: 'PR-202603-0008' });
      mockTx.performanceReview.create.mockResolvedValue(created);

      const result = await service.create(SCHEMA, createDto);

      expect(result.reviewNo).toBe('PR-202603-0008');
    });

    it('should throw NotFoundException when employee does not exist', async () => {
      mockTx.employee.findFirst.mockResolvedValue(null);

      await expect(service.create(SCHEMA, createDto)).rejects.toThrow(NotFoundException);
      expect(mockTx.performanceReview.create).not.toHaveBeenCalled();
    });
  });

  describe('submit()', () => {
    it('should transition a draft review to in_review', async () => {
      mockTx.performanceReview.findFirst.mockResolvedValue(makeReview({ status: 'draft' }));
      const submitted = makeReview({ status: 'in_review' });
      mockTx.performanceReview.update.mockResolvedValue(submitted);

      const result = await service.submit(SCHEMA, 'rev-1');

      expect(mockTx.performanceReview.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rev-1' },
          data: { status: 'in_review' },
        }),
      );
      expect(result.status).toBe('in_review');
    });

    it('should throw BadRequestException when submitting a non-draft review', async () => {
      mockTx.performanceReview.findFirst.mockResolvedValue(makeReview({ status: 'in_review' }));

      await expect(service.submit(SCHEMA, 'rev-1')).rejects.toThrow(BadRequestException);
      expect(mockTx.performanceReview.update).not.toHaveBeenCalled();
    });
  });

  describe('complete()', () => {
    const completeDto = { overallScore: 4.5, comments: 'Excellent work' } as any;

    it('should complete an in_review review with overallScore and reviewedAt timestamp', async () => {
      mockTx.performanceReview.findFirst.mockResolvedValue(makeReview({ status: 'in_review' }));
      const completed = makeReview({
        status: 'completed',
        overallScore: 4.5,
        reviewedAt: new Date(),
      });
      mockTx.performanceReview.update.mockResolvedValue(completed);

      const result = await service.complete(SCHEMA, 'rev-1', completeDto);

      expect(mockTx.performanceReview.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rev-1' },
          data: expect.objectContaining({
            status: 'completed',
            overallScore: 4.5,
            reviewedAt: expect.any(Date),
          }),
        }),
      );
      expect(result.status).toBe('completed');
      expect(result.overallScore).toBe(4.5);
    });

    it('should throw BadRequestException when completing a draft review', async () => {
      mockTx.performanceReview.findFirst.mockResolvedValue(makeReview({ status: 'draft' }));

      await expect(service.complete(SCHEMA, 'rev-1', completeDto)).rejects.toThrow(BadRequestException);
      expect(mockTx.performanceReview.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when review does not exist', async () => {
      mockTx.performanceReview.findFirst.mockResolvedValue(null);

      await expect(service.complete(SCHEMA, 'nonexistent', completeDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('cancel()', () => {
    it('should cancel a draft review', async () => {
      mockTx.performanceReview.findFirst.mockResolvedValue(makeReview({ status: 'draft' }));
      const cancelled = makeReview({ status: 'cancelled' });
      mockTx.performanceReview.update.mockResolvedValue(cancelled);

      const result = await service.cancel(SCHEMA, 'rev-1');

      expect(mockTx.performanceReview.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rev-1' },
          data: { status: 'cancelled' },
        }),
      );
      expect(result.status).toBe('cancelled');
    });

    it('should cancel an in_review review', async () => {
      mockTx.performanceReview.findFirst.mockResolvedValue(makeReview({ status: 'in_review' }));
      mockTx.performanceReview.update.mockResolvedValue(makeReview({ status: 'cancelled' }));

      const result = await service.cancel(SCHEMA, 'rev-1');

      expect(result.status).toBe('cancelled');
    });

    it('should throw BadRequestException when cancelling an already-completed review', async () => {
      mockTx.performanceReview.findFirst.mockResolvedValue(makeReview({ status: 'completed' }));

      await expect(service.cancel(SCHEMA, 'rev-1')).rejects.toThrow(BadRequestException);
      expect(mockTx.performanceReview.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when cancelling an already-cancelled review', async () => {
      mockTx.performanceReview.findFirst.mockResolvedValue(makeReview({ status: 'cancelled' }));

      await expect(service.cancel(SCHEMA, 'rev-1')).rejects.toThrow(BadRequestException);
    });
  });
});

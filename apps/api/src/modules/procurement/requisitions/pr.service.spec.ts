import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';

import { PurchaseRequisitionService, PR_STATUS } from './pr.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

const mockTx = {
  purchaseRequisition: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
};

const mockPrisma = {
  withTenantSchema: jest.fn().mockImplementation((_schema: string, fn: (tx: any) => any) =>
    fn(mockTx),
  ),
};

const SCHEMA = 'tenant_test';
const USER_ID = 'user-1';

function makePR(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'pr-1',
    prNo: 'PR-2026-0001',
    status: PR_STATUS.DRAFT,
    requestDate: new Date('2026-03-01'),
    requiredDate: null,
    department: 'Engineering',
    purpose: 'Office supplies',
    notes: null,
    createdBy: USER_ID,
    approvedBy: null,
    approvedAt: null,
    deletedAt: null,
    createdAt: new Date('2026-03-01'),
    lines: [],
    ...overrides,
  };
}

const createDto = {
  prNo: 'PR-2026-0001',
  requestDate: '2026-03-01',
  department: 'Engineering',
  purpose: 'Office supplies',
  lines: [
    { lineNo: 1, itemCode: 'ITM-001', itemName: 'Pen', unit: 'BOX', quantity: 10 },
  ],
} as any;

describe('PurchaseRequisitionService', () => {
  let service: PurchaseRequisitionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseRequisitionService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PurchaseRequisitionService>(PurchaseRequisitionService);
    jest.clearAllMocks();
  });

  describe('create()', () => {
    it('should create a PR in draft status', async () => {
      mockTx.purchaseRequisition.findUnique.mockResolvedValue(null);
      const created = makePR();
      mockTx.purchaseRequisition.create.mockResolvedValue(created);

      const result = await service.create(SCHEMA, createDto, USER_ID);

      expect(mockTx.purchaseRequisition.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: PR_STATUS.DRAFT,
            createdBy: USER_ID,
          }),
        }),
      );
      expect(result.status).toBe(PR_STATUS.DRAFT);
    });

    it('should throw ConflictException when PR number already exists', async () => {
      mockTx.purchaseRequisition.findUnique.mockResolvedValue(makePR());

      await expect(service.create(SCHEMA, createDto, USER_ID)).rejects.toThrow(ConflictException);
      expect(mockTx.purchaseRequisition.create).not.toHaveBeenCalled();
    });
  });

  describe('submit()', () => {
    it('should transition a draft PR to pending_approval', async () => {
      const draftPR = makePR({ status: PR_STATUS.DRAFT });
      const submittedPR = makePR({ status: PR_STATUS.PENDING_APPROVAL });
      mockTx.purchaseRequisition.findFirst.mockResolvedValue(draftPR);
      mockTx.purchaseRequisition.update.mockResolvedValue(submittedPR);

      const result = await service.submit(SCHEMA, 'pr-1');

      expect(mockTx.purchaseRequisition.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pr-1' },
          data: { status: PR_STATUS.PENDING_APPROVAL },
        }),
      );
      expect(result.status).toBe(PR_STATUS.PENDING_APPROVAL);
    });

    it('should throw BadRequestException if PR is not in draft status', async () => {
      const pendingPR = makePR({ status: PR_STATUS.PENDING_APPROVAL });
      mockTx.purchaseRequisition.findFirst.mockResolvedValue(pendingPR);

      await expect(service.submit(SCHEMA, 'pr-1')).rejects.toThrow(BadRequestException);
      expect(mockTx.purchaseRequisition.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when PR does not exist', async () => {
      mockTx.purchaseRequisition.findFirst.mockResolvedValue(null);

      await expect(service.submit(SCHEMA, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('approve()', () => {
    it('should transition a pending_approval PR to approved', async () => {
      const pendingPR = makePR({ status: PR_STATUS.PENDING_APPROVAL });
      const approvedPR = makePR({ status: PR_STATUS.APPROVED, approvedBy: USER_ID });
      mockTx.purchaseRequisition.findFirst.mockResolvedValue(pendingPR);
      mockTx.purchaseRequisition.update.mockResolvedValue(approvedPR);

      const result = await service.approve(SCHEMA, 'pr-1', USER_ID);

      expect(mockTx.purchaseRequisition.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: PR_STATUS.APPROVED,
            approvedBy: USER_ID,
            approvedAt: expect.any(Date),
          }),
        }),
      );
      expect(result.status).toBe(PR_STATUS.APPROVED);
    });

    it('should throw BadRequestException if PR is not pending_approval', async () => {
      const draftPR = makePR({ status: PR_STATUS.DRAFT });
      mockTx.purchaseRequisition.findFirst.mockResolvedValue(draftPR);

      await expect(service.approve(SCHEMA, 'pr-1', USER_ID)).rejects.toThrow(BadRequestException);
    });
  });

  describe('reject()', () => {
    it('should transition a pending_approval PR to rejected', async () => {
      const pendingPR = makePR({ status: PR_STATUS.PENDING_APPROVAL });
      const rejectedPR = makePR({ status: PR_STATUS.REJECTED, approvedBy: USER_ID });
      mockTx.purchaseRequisition.findFirst.mockResolvedValue(pendingPR);
      mockTx.purchaseRequisition.update.mockResolvedValue(rejectedPR);

      const result = await service.reject(SCHEMA, 'pr-1', USER_ID);

      expect(mockTx.purchaseRequisition.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: PR_STATUS.REJECTED,
            approvedBy: USER_ID,
          }),
        }),
      );
      expect(result.status).toBe(PR_STATUS.REJECTED);
    });

    it('should throw BadRequestException if PR is not pending_approval', async () => {
      const draftPR = makePR({ status: PR_STATUS.DRAFT });
      mockTx.purchaseRequisition.findFirst.mockResolvedValue(draftPR);

      await expect(service.reject(SCHEMA, 'pr-1', USER_ID)).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancel()', () => {
    it('should cancel a draft PR', async () => {
      const draftPR = makePR({ status: PR_STATUS.DRAFT });
      const cancelledPR = makePR({ status: PR_STATUS.CANCELLED });
      mockTx.purchaseRequisition.findFirst.mockResolvedValue(draftPR);
      mockTx.purchaseRequisition.update.mockResolvedValue(cancelledPR);

      const result = await service.cancel(SCHEMA, 'pr-1');

      expect(mockTx.purchaseRequisition.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: PR_STATUS.CANCELLED },
        }),
      );
      expect(result.status).toBe(PR_STATUS.CANCELLED);
    });

    it('should cancel a pending_approval PR', async () => {
      const pendingPR = makePR({ status: PR_STATUS.PENDING_APPROVAL });
      const cancelledPR = makePR({ status: PR_STATUS.CANCELLED });
      mockTx.purchaseRequisition.findFirst.mockResolvedValue(pendingPR);
      mockTx.purchaseRequisition.update.mockResolvedValue(cancelledPR);

      const result = await service.cancel(SCHEMA, 'pr-1');

      expect(result.status).toBe(PR_STATUS.CANCELLED);
    });

    it('should throw BadRequestException when trying to cancel an already-cancelled PR', async () => {
      const cancelledPR = makePR({ status: PR_STATUS.CANCELLED });
      mockTx.purchaseRequisition.findFirst.mockResolvedValue(cancelledPR);

      await expect(service.cancel(SCHEMA, 'pr-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when trying to cancel a converted PR', async () => {
      const convertedPR = makePR({ status: PR_STATUS.CONVERTED });
      mockTx.purchaseRequisition.findFirst.mockResolvedValue(convertedPR);

      await expect(service.cancel(SCHEMA, 'pr-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when PR does not exist', async () => {
      mockTx.purchaseRequisition.findFirst.mockResolvedValue(null);

      await expect(service.cancel(SCHEMA, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});

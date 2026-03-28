import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';

import { WorkflowService } from './workflow.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

const mockTx = {
  workflowDefinition: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  },
  workflowInstance: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  workflowStep: {
    create: jest.fn(),
    update: jest.fn(),
  },
};

const mockPrisma = {
  withTenantSchema: jest.fn().mockImplementation((_schema: string, fn: (tx: any) => any) =>
    fn(mockTx),
  ),
};

const SCHEMA = 'tenant_test';
const USER_ID = 'user-1';
const USER_NAME = 'Alice Wang';

function makeDefinition(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'def-1',
    code: 'PO_APPROVAL',
    name: '採購單審核',
    module: 'purchasing',
    docType: 'purchase_order',
    steps: 2,
    isActive: true,
    description: 'Two-step PO approval',
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeStep(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'step-1',
    instanceId: 'inst-1',
    stepNo: 1,
    action: null,
    actorId: null,
    actorName: null,
    comment: null,
    actedAt: null,
    ...overrides,
  };
}

function makeInstance(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'inst-1',
    definitionId: 'def-1',
    docType: 'purchase_order',
    docId: 'po-1',
    docNo: 'PO-000001',
    submittedBy: USER_ID,
    currentStep: 1,
    status: 'pending',
    submittedAt: new Date('2026-03-20'),
    completedAt: null,
    definition: makeDefinition(),
    steps: [makeStep()],
    ...overrides,
  };
}

const createDefinitionDto = {
  code: 'LEAVE_APPROVAL',
  name: '請假審核',
  module: 'hr',
  docType: 'leave_request',
  steps: 1,
  isActive: true,
} as any;

const submitDto = {
  docType: 'purchase_order',
  docId: 'po-2',
  docNo: 'PO-000002',
} as any;

describe('WorkflowService', () => {
  let service: WorkflowService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<WorkflowService>(WorkflowService);
    jest.clearAllMocks();
  });

  describe('findDefinitions()', () => {
    it('should return paginated workflow definitions with metadata', async () => {
      const defs = [makeDefinition(), makeDefinition({ id: 'def-2', code: 'LEAVE_APPROVAL' })];
      mockTx.workflowDefinition.findMany.mockResolvedValue(defs);
      mockTx.workflowDefinition.count.mockResolvedValue(2);

      const result = await service.findDefinitions(SCHEMA, { page: 1, perPage: 50 });

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({ page: 1, perPage: 50, total: 2, totalPages: 1 });
    });

    it('should pass module and isActive filters to the query', async () => {
      mockTx.workflowDefinition.findMany.mockResolvedValue([]);
      mockTx.workflowDefinition.count.mockResolvedValue(0);

      await service.findDefinitions(SCHEMA, { module: 'purchasing', isActive: true });

      const findManyCall = mockTx.workflowDefinition.findMany.mock.calls[0][0];
      expect(findManyCall.where.module).toBe('purchasing');
      expect(findManyCall.where.isActive).toBe(true);
    });
  });

  describe('createDefinition()', () => {
    it('should create and return a new workflow definition', async () => {
      mockTx.workflowDefinition.findUnique.mockResolvedValue(null); // no duplicate
      const created = makeDefinition({ id: 'def-3', code: 'LEAVE_APPROVAL', name: '請假審核' });
      mockTx.workflowDefinition.create.mockResolvedValue(created);

      const result = await service.createDefinition(SCHEMA, createDefinitionDto);

      expect(mockTx.workflowDefinition.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            code: 'LEAVE_APPROVAL',
            name: '請假審核',
            module: 'hr',
          }),
        }),
      );
      expect(result.code).toBe('LEAVE_APPROVAL');
    });

    it('should throw BadRequestException when definition code already exists', async () => {
      mockTx.workflowDefinition.findUnique.mockResolvedValue(makeDefinition({ code: 'LEAVE_APPROVAL' }));

      await expect(service.createDefinition(SCHEMA, createDefinitionDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockTx.workflowDefinition.create).not.toHaveBeenCalled();
    });
  });

  describe('findInstances()', () => {
    it('should return paginated workflow instances with metadata', async () => {
      const instances = [makeInstance(), makeInstance({ id: 'inst-2', docNo: 'PO-000002' })];
      mockTx.workflowInstance.findMany.mockResolvedValue(instances);
      mockTx.workflowInstance.count.mockResolvedValue(2);

      const result = await service.findInstances(SCHEMA, { page: 1, perPage: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({ page: 1, perPage: 20, total: 2, totalPages: 1 });
    });

    it('should pass status filter to the query', async () => {
      mockTx.workflowInstance.findMany.mockResolvedValue([]);
      mockTx.workflowInstance.count.mockResolvedValue(0);

      await service.findInstances(SCHEMA, { status: 'pending' });

      const findManyCall = mockTx.workflowInstance.findMany.mock.calls[0][0];
      expect(findManyCall.where.status).toBe('pending');
    });
  });

  describe('submit()', () => {
    it('should find the active definition by docType, create an instance and first step', async () => {
      const definition = makeDefinition();
      mockTx.workflowDefinition.findFirst.mockResolvedValue(definition);
      const createdInstance = makeInstance({ id: 'inst-3', docNo: 'PO-000002' });
      mockTx.workflowInstance.create.mockResolvedValue(createdInstance);
      mockTx.workflowStep.create.mockResolvedValue(makeStep({ instanceId: 'inst-3' }));
      const finalInstance = makeInstance({ id: 'inst-3', steps: [makeStep({ instanceId: 'inst-3' })] });
      mockTx.workflowInstance.findUnique.mockResolvedValue(finalInstance);

      const result = await service.submit(SCHEMA, submitDto, USER_ID);

      expect(mockTx.workflowInstance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            docType: 'purchase_order',
            docId: 'po-2',
            submittedBy: USER_ID,
            currentStep: 1,
            status: 'pending',
          }),
        }),
      );
      expect(mockTx.workflowStep.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ stepNo: 1 }),
        }),
      );
      expect(result!.id).toBe('inst-3');
    });

    it('should throw NotFoundException when no active definition exists for docType', async () => {
      mockTx.workflowDefinition.findFirst.mockResolvedValue(null);

      await expect(service.submit(SCHEMA, submitDto, USER_ID)).rejects.toThrow(NotFoundException);
      expect(mockTx.workflowInstance.create).not.toHaveBeenCalled();
    });
  });

  describe('approve()', () => {
    it('should record approval on current step and advance to next step when not last', async () => {
      // definition has 2 steps; instance is on step 1
      const instance = makeInstance({
        currentStep: 1,
        definition: makeDefinition({ steps: 2 }),
        steps: [makeStep({ id: 'step-1', stepNo: 1 })],
      });
      mockTx.workflowInstance.findUnique.mockResolvedValue(instance);
      mockTx.workflowStep.update.mockResolvedValue({ ...makeStep(), action: 'approved' });
      mockTx.workflowStep.create.mockResolvedValue(makeStep({ id: 'step-2', stepNo: 2 }));
      const advanced = makeInstance({ currentStep: 2 });
      mockTx.workflowInstance.update.mockResolvedValue(advanced);

      const result = await service.approve(SCHEMA, 'inst-1', USER_ID, USER_NAME, 'Looks good');

      expect(mockTx.workflowStep.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'step-1' },
          data: expect.objectContaining({ action: 'approved', actorId: USER_ID }),
        }),
      );
      expect(mockTx.workflowStep.create).toHaveBeenCalled();
      expect(result.currentStep).toBe(2);
    });

    it('should set instance status to approved on the final step', async () => {
      // definition has 1 step; instance is on step 1 (last step)
      const instance = makeInstance({
        currentStep: 1,
        definition: makeDefinition({ steps: 1 }),
        steps: [makeStep({ id: 'step-1', stepNo: 1 })],
      });
      mockTx.workflowInstance.findUnique.mockResolvedValue(instance);
      mockTx.workflowStep.update.mockResolvedValue({ ...makeStep(), action: 'approved' });
      const approved = makeInstance({ status: 'approved', completedAt: new Date() });
      mockTx.workflowInstance.update.mockResolvedValue(approved);

      const result = await service.approve(SCHEMA, 'inst-1', USER_ID, USER_NAME);

      expect(mockTx.workflowInstance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inst-1' },
          data: expect.objectContaining({
            status: 'approved',
            completedAt: expect.any(Date),
          }),
        }),
      );
      expect(result.status).toBe('approved');
    });

    it('should throw NotFoundException when instance does not exist', async () => {
      mockTx.workflowInstance.findUnique.mockResolvedValue(null);

      await expect(service.approve(SCHEMA, 'nonexistent', USER_ID, USER_NAME)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when instance is not pending', async () => {
      mockTx.workflowInstance.findUnique.mockResolvedValue(
        makeInstance({ status: 'approved' }),
      );

      await expect(service.approve(SCHEMA, 'inst-1', USER_ID, USER_NAME)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('reject()', () => {
    it('should record rejection on current step and set instance status to rejected', async () => {
      const instance = makeInstance({
        steps: [makeStep({ id: 'step-1', stepNo: 1 })],
      });
      mockTx.workflowInstance.findUnique.mockResolvedValue(instance);
      mockTx.workflowStep.update.mockResolvedValue({ ...makeStep(), action: 'rejected' });
      const rejected = makeInstance({ status: 'rejected', completedAt: new Date() });
      mockTx.workflowInstance.update.mockResolvedValue(rejected);

      const result = await service.reject(SCHEMA, 'inst-1', USER_ID, USER_NAME, 'Budget exceeded');

      expect(mockTx.workflowStep.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'step-1' },
          data: expect.objectContaining({
            action: 'rejected',
            actorId: USER_ID,
            comment: 'Budget exceeded',
          }),
        }),
      );
      expect(mockTx.workflowInstance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inst-1' },
          data: expect.objectContaining({
            status: 'rejected',
            completedAt: expect.any(Date),
          }),
        }),
      );
      expect(result.status).toBe('rejected');
    });

    it('should throw NotFoundException when instance does not exist', async () => {
      mockTx.workflowInstance.findUnique.mockResolvedValue(null);

      await expect(service.reject(SCHEMA, 'nonexistent', USER_ID, USER_NAME)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when instance is not pending', async () => {
      mockTx.workflowInstance.findUnique.mockResolvedValue(
        makeInstance({ status: 'rejected' }),
      );

      await expect(service.reject(SCHEMA, 'inst-1', USER_ID, USER_NAME)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});

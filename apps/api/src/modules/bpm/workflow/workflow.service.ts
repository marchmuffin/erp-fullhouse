import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateDefinitionDto } from './dto/create-definition.dto';
import { SubmitWorkflowDto } from './dto/submit-workflow.dto';

@Injectable()
export class WorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Definitions ──────────────────────────────────────────────────────────

  async findDefinitions(
    schema: string,
    query: { module?: string; isActive?: boolean; page?: number; perPage?: number },
  ) {
    const { module, isActive, page = 1, perPage = 50 } = query;
    const skip = (page - 1) * perPage;

    return this.prisma.withTenantSchema(schema, async (tx) => {
      const where: any = {};
      if (module) where.module = module;
      if (isActive !== undefined) where.isActive = isActive;

      const [data, total] = await Promise.all([
        tx.workflowDefinition.findMany({
          where,
          skip,
          take: perPage,
          orderBy: { createdAt: 'desc' },
        }),
        tx.workflowDefinition.count({ where }),
      ]);

      return {
        data,
        meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
      };
    });
  }

  async createDefinition(schema: string, dto: CreateDefinitionDto) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const existing = await tx.workflowDefinition.findUnique({
        where: { code: dto.code },
      });
      if (existing) {
        throw new BadRequestException(`Workflow definition code '${dto.code}' already exists`);
      }

      return tx.workflowDefinition.create({
        data: {
          code: dto.code,
          name: dto.name,
          module: dto.module,
          docType: dto.docType,
          steps: dto.steps ?? 1,
          isActive: dto.isActive ?? true,
          description: dto.description,
        },
      });
    });
  }

  // ── Instances ─────────────────────────────────────────────────────────────

  async findInstances(
    schema: string,
    query: {
      status?: string;
      docType?: string;
      submittedBy?: string;
      page?: number;
      perPage?: number;
    },
  ) {
    const { status, docType, submittedBy, page = 1, perPage = 20 } = query;
    const skip = (page - 1) * perPage;

    return this.prisma.withTenantSchema(schema, async (tx) => {
      const where: any = {};
      if (status) where.status = status;
      if (docType) where.docType = docType;
      if (submittedBy) where.submittedBy = submittedBy;

      const [data, total] = await Promise.all([
        tx.workflowInstance.findMany({
          where,
          skip,
          take: perPage,
          orderBy: { submittedAt: 'desc' },
          include: { definition: true },
        }),
        tx.workflowInstance.count({ where }),
      ]);

      return {
        data,
        meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
      };
    });
  }

  async findInstanceById(schema: string, id: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const instance = await tx.workflowInstance.findUnique({
        where: { id },
        include: {
          definition: true,
          steps: { orderBy: { stepNo: 'asc' } },
        },
      });
      if (!instance) throw new NotFoundException('Workflow instance not found');
      return instance;
    });
  }

  async submit(schema: string, dto: SubmitWorkflowDto, userId: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      // Resolve definition
      let definition: any;
      if (dto.definitionId) {
        definition = await tx.workflowDefinition.findUnique({
          where: { id: dto.definitionId },
        });
      } else {
        definition = await tx.workflowDefinition.findFirst({
          where: { docType: dto.docType, isActive: true },
        });
      }
      if (!definition) {
        throw new NotFoundException(
          `No active workflow definition found for docType '${dto.docType}'`,
        );
      }

      // Create instance
      const instance = await tx.workflowInstance.create({
        data: {
          definitionId: definition.id,
          docType: dto.docType,
          docId: dto.docId,
          docNo: dto.docNo,
          submittedBy: userId,
          currentStep: 1,
          status: 'pending',
        },
      });

      // Create first step (pending)
      await tx.workflowStep.create({
        data: {
          instanceId: instance.id,
          stepNo: 1,
        },
      });

      return tx.workflowInstance.findUnique({
        where: { id: instance.id },
        include: { definition: true, steps: { orderBy: { stepNo: 'asc' } } },
      });
    });
  }

  async approve(
    schema: string,
    instanceId: string,
    userId: string,
    userName: string,
    comment?: string,
  ) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const instance = await tx.workflowInstance.findUnique({
        where: { id: instanceId },
        include: { definition: true, steps: { orderBy: { stepNo: 'asc' } } },
      });
      if (!instance) throw new NotFoundException('Workflow instance not found');
      if (instance.status !== 'pending') {
        throw new BadRequestException(`Cannot approve instance with status '${instance.status}'`);
      }

      const currentStepRecord = instance.steps.find(
        (s: any) => s.stepNo === instance.currentStep,
      );
      if (!currentStepRecord) {
        throw new BadRequestException('Current step record not found');
      }

      // Record action on current step
      await tx.workflowStep.update({
        where: { id: currentStepRecord.id },
        data: {
          action: 'approved',
          actorId: userId,
          actorName: userName,
          comment: comment ?? null,
          actedAt: new Date(),
        },
      });

      const totalSteps = instance.definition.steps;
      const isLastStep = instance.currentStep >= totalSteps;

      if (isLastStep) {
        // Final approval
        return tx.workflowInstance.update({
          where: { id: instanceId },
          data: { status: 'approved', completedAt: new Date() },
          include: { definition: true, steps: { orderBy: { stepNo: 'asc' } } },
        });
      } else {
        // Advance to next step
        const nextStep = instance.currentStep + 1;
        await tx.workflowStep.create({
          data: { instanceId, stepNo: nextStep },
        });
        return tx.workflowInstance.update({
          where: { id: instanceId },
          data: { currentStep: nextStep },
          include: { definition: true, steps: { orderBy: { stepNo: 'asc' } } },
        });
      }
    });
  }

  async reject(
    schema: string,
    instanceId: string,
    userId: string,
    userName: string,
    comment?: string,
  ) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const instance = await tx.workflowInstance.findUnique({
        where: { id: instanceId },
        include: { steps: { orderBy: { stepNo: 'asc' } } },
      });
      if (!instance) throw new NotFoundException('Workflow instance not found');
      if (instance.status !== 'pending') {
        throw new BadRequestException(`Cannot reject instance with status '${instance.status}'`);
      }

      const currentStepRecord = instance.steps.find(
        (s: any) => s.stepNo === instance.currentStep,
      );
      if (currentStepRecord) {
        await tx.workflowStep.update({
          where: { id: currentStepRecord.id },
          data: {
            action: 'rejected',
            actorId: userId,
            actorName: userName,
            comment: comment ?? null,
            actedAt: new Date(),
          },
        });
      }

      return tx.workflowInstance.update({
        where: { id: instanceId },
        data: { status: 'rejected', completedAt: new Date() },
        include: { definition: true, steps: { orderBy: { stepNo: 'asc' } } },
      });
    });
  }

  async cancel(schema: string, instanceId: string, userId: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const instance = await tx.workflowInstance.findUnique({
        where: { id: instanceId },
      });
      if (!instance) throw new NotFoundException('Workflow instance not found');
      if (instance.submittedBy !== userId) {
        throw new ForbiddenException('Only the submitter can cancel this workflow instance');
      }
      if (instance.status !== 'pending') {
        throw new BadRequestException(`Cannot cancel instance with status '${instance.status}'`);
      }

      return tx.workflowInstance.update({
        where: { id: instanceId },
        data: { status: 'cancelled', completedAt: new Date() },
        include: { definition: true, steps: { orderBy: { stepNo: 'asc' } } },
      });
    });
  }

  async getPendingForUser(schema: string, _userId: string) {
    // Returns all pending instances (approver inbox — any authorized user can act)
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const data = await tx.workflowInstance.findMany({
        where: { status: 'pending' },
        orderBy: { submittedAt: 'desc' },
        include: { definition: true, steps: { orderBy: { stepNo: 'asc' } } },
      });
      return { data, meta: { total: data.length } };
    });
  }

  async getMySubmissions(schema: string, userId: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const data = await tx.workflowInstance.findMany({
        where: { submittedBy: userId },
        orderBy: { submittedAt: 'desc' },
        include: { definition: true, steps: { orderBy: { stepNo: 'asc' } } },
      });
      return { data, meta: { total: data.length } };
    });
  }

  async getStats(schema: string) {
    return this.prisma.withTenantSchema(schema, async (tx) => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [
        pendingCount,
        approvedThisMonth,
        rejectedThisMonth,
        totalDefinitions,
      ] = await Promise.all([
        tx.workflowInstance.count({ where: { status: 'pending' } }),
        tx.workflowInstance.count({
          where: { status: 'approved', completedAt: { gte: startOfMonth } },
        }),
        tx.workflowInstance.count({
          where: { status: 'rejected', completedAt: { gte: startOfMonth } },
        }),
        tx.workflowDefinition.count({ where: { isActive: true } }),
      ]);

      return { pendingCount, approvedThisMonth, rejectedThisMonth, totalDefinitions };
    });
  }
}

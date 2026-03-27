import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WorkflowService } from './workflow.service';
import { CreateDefinitionDto } from './dto/create-definition.dto';
import { SubmitWorkflowDto } from './dto/submit-workflow.dto';
import { ActWorkflowDto } from './dto/act-workflow.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions, TenantSchema } from '../../../common/decorators';

@ApiTags('bpm')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'bpm', version: '1' })
export class WorkflowController {
  constructor(private readonly svc: WorkflowService) {}

  // ── Definitions ──────────────────────────────────────────────────────────

  @Get('definitions')
  @RequirePermissions('workflow:view')
  @ApiOperation({ summary: 'List workflow definitions' })
  findDefinitions(
    @TenantSchema() schema: string,
    @Query('module') module?: string,
    @Query('isActive') isActive?: string,
    @Query('page') page = 1,
    @Query('perPage') perPage = 50,
  ) {
    const active = isActive !== undefined ? isActive === 'true' : undefined;
    return this.svc.findDefinitions(schema, {
      module,
      isActive: active,
      page: +page,
      perPage: +perPage,
    });
  }

  @Post('definitions')
  @RequirePermissions('workflow:view')
  @ApiOperation({ summary: 'Create a workflow definition' })
  createDefinition(
    @TenantSchema() schema: string,
    @Body() dto: CreateDefinitionDto,
  ) {
    return this.svc.createDefinition(schema, dto);
  }

  // ── Stats ────────────────────────────────────────────────────────────────

  @Get('stats')
  @RequirePermissions('workflow:view')
  @ApiOperation({ summary: 'BPM dashboard stats' })
  getStats(@TenantSchema() schema: string) {
    return this.svc.getStats(schema);
  }

  // ── Instances ─────────────────────────────────────────────────────────────

  @Get('instances/pending')
  @RequirePermissions('workflow:approve')
  @ApiOperation({ summary: "Get all pending instances (approver's inbox)" })
  getPending(@TenantSchema() schema: string, @Request() req: any) {
    return this.svc.getPendingForUser(schema, req.user.id);
  }

  @Get('instances/mine')
  @RequirePermissions('workflow:submit')
  @ApiOperation({ summary: 'Get my submitted instances' })
  getMine(@TenantSchema() schema: string, @Request() req: any) {
    return this.svc.getMySubmissions(schema, req.user.id);
  }

  @Get('instances')
  @RequirePermissions('workflow:view')
  @ApiOperation({ summary: 'List workflow instances (paginated)' })
  findInstances(
    @TenantSchema() schema: string,
    @Query('status') status?: string,
    @Query('docType') docType?: string,
    @Query('submittedBy') submittedBy?: string,
    @Query('page') page = 1,
    @Query('perPage') perPage = 20,
  ) {
    return this.svc.findInstances(schema, {
      status,
      docType,
      submittedBy,
      page: +page,
      perPage: +perPage,
    });
  }

  @Post('instances/submit')
  @RequirePermissions('workflow:submit')
  @ApiOperation({ summary: 'Submit a document for workflow approval' })
  submit(
    @TenantSchema() schema: string,
    @Body() dto: SubmitWorkflowDto,
    @Request() req: any,
  ) {
    return this.svc.submit(schema, dto, req.user.id);
  }

  @Get('instances/:id')
  @RequirePermissions('workflow:view')
  @ApiOperation({ summary: 'Get workflow instance by ID' })
  findById(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.svc.findInstanceById(schema, id);
  }

  @Patch('instances/:id/approve')
  @RequirePermissions('workflow:approve')
  @ApiOperation({ summary: 'Approve current step of a workflow instance' })
  approve(
    @TenantSchema() schema: string,
    @Param('id') id: string,
    @Body() dto: ActWorkflowDto,
    @Request() req: any,
  ) {
    const userName: string =
      req.user.displayName ?? req.user.email ?? req.user.id;
    return this.svc.approve(schema, id, req.user.id, userName, dto.comment);
  }

  @Patch('instances/:id/reject')
  @RequirePermissions('workflow:approve')
  @ApiOperation({ summary: 'Reject current step of a workflow instance' })
  reject(
    @TenantSchema() schema: string,
    @Param('id') id: string,
    @Body() dto: ActWorkflowDto,
    @Request() req: any,
  ) {
    const userName: string =
      req.user.displayName ?? req.user.email ?? req.user.id;
    return this.svc.reject(schema, id, req.user.id, userName, dto.comment);
  }

  @Patch('instances/:id/cancel')
  @RequirePermissions('workflow:submit')
  @ApiOperation({ summary: 'Cancel a pending workflow instance (submitter only)' })
  cancel(
    @TenantSchema() schema: string,
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.svc.cancel(schema, id, req.user.id);
  }
}

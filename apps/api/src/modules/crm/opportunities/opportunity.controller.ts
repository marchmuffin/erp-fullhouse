import {
  Controller, Get, Post, Put, Body, Param, Query,
  UseGuards, Patch,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OpportunityService } from './opportunity.service';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions, CurrentUser, TenantSchema } from '../../../common/decorators';

@ApiTags('crm')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'crm/opportunities', version: '1' })
export class OpportunityController {
  constructor(private readonly svc: OpportunityService) {}

  @Get()
  @RequirePermissions('opp:view')
  @ApiOperation({ summary: 'List opportunities' })
  findAll(
    @TenantSchema() schema: string,
    @Query('page') page = 1,
    @Query('perPage') perPage = 20,
    @Query('search') search?: string,
    @Query('stage') stage?: string,
  ) {
    return this.svc.findAll(schema, { page: +page, perPage: +perPage, search, stage });
  }

  @Get(':id')
  @RequirePermissions('opp:view')
  @ApiOperation({ summary: 'Get opportunity detail' })
  findById(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.svc.findById(schema, id);
  }

  @Post()
  @RequirePermissions('opp:create')
  @ApiOperation({ summary: 'Create opportunity' })
  create(
    @TenantSchema() schema: string,
    @Body() dto: CreateOpportunityDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.svc.create(schema, dto, userId);
  }

  @Put(':id')
  @RequirePermissions('opp:update')
  @ApiOperation({ summary: 'Update opportunity' })
  update(
    @TenantSchema() schema: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateOpportunityDto>,
  ) {
    return this.svc.update(schema, id, dto);
  }

  @Patch(':id/close-won')
  @RequirePermissions('opp:update')
  @ApiOperation({ summary: 'Mark opportunity as closed won' })
  closeWon(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.svc.closeWon(schema, id);
  }

  @Patch(':id/close-lost')
  @RequirePermissions('opp:update')
  @ApiOperation({ summary: 'Mark opportunity as closed lost' })
  closeLost(
    @TenantSchema() schema: string,
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.svc.closeLost(schema, id, reason);
  }
}

import {
  Controller, Get, Post, Put, Body, Param, Query,
  UseGuards, Patch, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LeadService } from './lead.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions, CurrentUser, TenantSchema } from '../../../common/decorators';

@ApiTags('crm')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'crm/leads', version: '1' })
export class LeadController {
  constructor(private readonly svc: LeadService) {}

  @Get()
  @RequirePermissions('lead:view')
  @ApiOperation({ summary: 'List leads' })
  findAll(
    @TenantSchema() schema: string,
    @Query('page') page = 1,
    @Query('perPage') perPage = 20,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('source') source?: string,
  ) {
    return this.svc.findAll(schema, { page: +page, perPage: +perPage, search, status, source });
  }

  @Get(':id')
  @RequirePermissions('lead:view')
  @ApiOperation({ summary: 'Get lead detail' })
  findById(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.svc.findById(schema, id);
  }

  @Post()
  @RequirePermissions('lead:create')
  @ApiOperation({ summary: 'Create lead' })
  create(
    @TenantSchema() schema: string,
    @Body() dto: CreateLeadDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.svc.create(schema, dto, userId);
  }

  @Put(':id')
  @RequirePermissions('lead:update')
  @ApiOperation({ summary: 'Update lead' })
  update(
    @TenantSchema() schema: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateLeadDto> & { status?: string },
  ) {
    return this.svc.update(schema, id, dto);
  }

  @Patch(':id/qualify')
  @RequirePermissions('lead:qualify')
  @ApiOperation({ summary: 'Qualify lead and create opportunity' })
  qualify(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.svc.qualify(schema, id);
  }

  @Patch(':id/disqualify')
  @RequirePermissions('lead:qualify')
  @ApiOperation({ summary: 'Disqualify lead' })
  disqualify(
    @TenantSchema() schema: string,
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.svc.disqualify(schema, id, reason);
  }
}

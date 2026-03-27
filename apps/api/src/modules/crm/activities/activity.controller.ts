import {
  Controller, Get, Post, Body, Param, Query,
  UseGuards, Patch,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ActivityService } from './activity.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions, CurrentUser, TenantSchema } from '../../../common/decorators';

@ApiTags('crm')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'crm/activities', version: '1' })
export class ActivityController {
  constructor(private readonly svc: ActivityService) {}

  @Get()
  @RequirePermissions('activity:view')
  @ApiOperation({ summary: 'List CRM activities' })
  findAll(
    @TenantSchema() schema: string,
    @Query('page') page = 1,
    @Query('perPage') perPage = 20,
    @Query('leadId') leadId?: string,
    @Query('opportunityId') opportunityId?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
  ) {
    return this.svc.findAll(schema, {
      page: +page,
      perPage: +perPage,
      leadId,
      opportunityId,
      type,
      status,
    });
  }

  @Post()
  @RequirePermissions('activity:create')
  @ApiOperation({ summary: 'Create CRM activity' })
  create(
    @TenantSchema() schema: string,
    @Body() dto: CreateActivityDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.svc.create(schema, dto, userId);
  }

  @Patch(':id/complete')
  @RequirePermissions('activity:create')
  @ApiOperation({ summary: 'Mark activity as completed' })
  complete(
    @TenantSchema() schema: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.svc.complete(schema, id, userId);
  }

  @Patch(':id/cancel')
  @RequirePermissions('activity:create')
  @ApiOperation({ summary: 'Cancel activity' })
  cancel(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.svc.cancel(schema, id);
  }
}

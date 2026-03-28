import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MrpService } from './mrp.service';
import { CreateMrpDto } from './dto/create-mrp.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions, CurrentUser, TenantSchema } from '../../../common/decorators';

@ApiTags('manufacturing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'manufacturing/mrp', version: '1' })
export class MrpController {
  constructor(private readonly svc: MrpService) {}

  @Get()
  @RequirePermissions('manufacturing:view')
  @ApiOperation({ summary: 'List MRP runs' })
  findAll(
    @TenantSchema() schema: string,
    @Query('page') page = 1,
    @Query('perPage') perPage = 20,
  ) {
    return this.svc.findAll(schema, { page: +page, perPage: +perPage });
  }

  @Get(':id')
  @RequirePermissions('manufacturing:view')
  @ApiOperation({ summary: 'Get MRP run by ID with requirements' })
  findById(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.svc.findById(schema, id);
  }

  @Post()
  @RequirePermissions('manufacturing:plan')
  @ApiOperation({ summary: 'Create MRP run (draft)' })
  create(
    @TenantSchema() schema: string,
    @Body() dto: CreateMrpDto,
    @CurrentUser() user: any,
  ) {
    return this.svc.create(schema, dto, user?.sub);
  }

  @Patch(':id/run')
  @RequirePermissions('manufacturing:plan')
  @ApiOperation({ summary: 'Execute MRP run — calculate requirements and shortages' })
  run(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.svc.run(schema, id);
  }

  @Patch(':id/cancel')
  @RequirePermissions('manufacturing:plan')
  @ApiOperation({ summary: 'Cancel MRP run' })
  cancel(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.svc.cancel(schema, id);
  }
}

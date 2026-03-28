import {
  Controller, Get, Post, Put, Patch, Body, Param, Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PerformanceService } from './performance.service';
import { CreateReviewDto, UpdateReviewDto, CompleteReviewDto } from './dto/create-review.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions, CurrentUser, TenantSchema } from '../../../common/decorators';

@ApiTags('hr')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'hr/performance-reviews', version: '1' })
export class PerformanceController {
  constructor(private readonly performanceService: PerformanceService) {}

  @Get()
  @RequirePermissions('performance:view')
  @ApiOperation({ summary: 'List performance reviews' })
  findAll(
    @TenantSchema() schema: string,
    @Query('page') page = 1,
    @Query('perPage') perPage = 20,
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: string,
    @Query('period') period?: string,
  ) {
    return this.performanceService.findAll(schema, {
      page: +page,
      perPage: +perPage,
      employeeId,
      status,
      period,
    });
  }

  @Get(':id')
  @RequirePermissions('performance:view')
  @ApiOperation({ summary: 'Get performance review by id' })
  findById(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.performanceService.findById(schema, id);
  }

  @Post()
  @RequirePermissions('performance:create')
  @ApiOperation({ summary: 'Create performance review' })
  create(
    @TenantSchema() schema: string,
    @Body() dto: CreateReviewDto,
    @CurrentUser('id') _userId: string,
  ) {
    return this.performanceService.create(schema, dto);
  }

  @Put(':id')
  @RequirePermissions('performance:update')
  @ApiOperation({ summary: 'Update performance review' })
  update(
    @TenantSchema() schema: string,
    @Param('id') id: string,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.performanceService.update(schema, id, dto);
  }

  @Patch(':id/submit')
  @RequirePermissions('performance:update')
  @ApiOperation({ summary: 'Submit performance review (draft → in_review)' })
  submit(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.performanceService.submit(schema, id);
  }

  @Patch(':id/complete')
  @RequirePermissions('performance:update')
  @ApiOperation({ summary: 'Complete performance review (in_review → completed)' })
  complete(
    @TenantSchema() schema: string,
    @Param('id') id: string,
    @Body() dto: CompleteReviewDto,
  ) {
    return this.performanceService.complete(schema, id, dto);
  }

  @Patch(':id/cancel')
  @RequirePermissions('performance:update')
  @ApiOperation({ summary: 'Cancel performance review' })
  cancel(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.performanceService.cancel(schema, id);
  }
}

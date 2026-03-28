import { Controller, Get, Post, Body, Param, Patch, Query, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TenantService } from './tenant.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { SuperAdmin, RequirePermissions } from '../../common/decorators';

@ApiTags('tenants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'tenants', version: '1' })
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get()
  @SuperAdmin()
  @ApiOperation({ summary: 'List all tenants (Super Admin only)' })
  findAll(@Query('page') page = 1, @Query('perPage') perPage = 20) {
    return this.tenantService.findAll(+page, +perPage);
  }

  @Get('export')
  @SuperAdmin()
  @ApiOperation({ summary: 'Export all tenants as CSV (Super Admin only)' })
  async exportCsv(@Res() res: any) {
    const csv = await this.tenantService.exportCsv();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="tenants.csv"');
    res.send(csv);
  }

  @Get(':id')
  @SuperAdmin()
  @ApiOperation({ summary: 'Get tenant by ID (Super Admin only)' })
  findById(@Param('id') id: string) {
    return this.tenantService.findById(id);
  }

  @Post()
  @SuperAdmin()
  @ApiOperation({ summary: 'Create a new tenant (Super Admin only)' })
  create(@Body() dto: CreateTenantDto) {
    return this.tenantService.create(dto);
  }

  @Patch(':id')
  @SuperAdmin()
  @ApiOperation({ summary: 'Update tenant details (Super Admin only)' })
  update(
    @Param('id') id: string,
    @Body() body: { name?: string; contactEmail?: string; contactPhone?: string; plan?: string; status?: string; maxUsers?: number },
  ) {
    return this.tenantService.update(id, body);
  }

  @Patch(':id/suspend')
  @SuperAdmin()
  @ApiOperation({ summary: 'Suspend a tenant (Super Admin only)' })
  suspend(@Param('id') id: string) {
    return this.tenantService.suspend(id);
  }

  @Patch(':id/activate')
  @SuperAdmin()
  @ApiOperation({ summary: 'Activate a tenant (Super Admin only)' })
  activate(@Param('id') id: string) {
    return this.tenantService.activate(id);
  }
}

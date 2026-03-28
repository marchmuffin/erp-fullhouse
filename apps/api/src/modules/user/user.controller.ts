import { Controller, Get, Post, Body, Param, Patch, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions, TenantId, SuperAdmin, CurrentUser } from '../../common/decorators';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'users', version: '1' })
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @RequirePermissions('user:view')
  @ApiOperation({ summary: 'List users in current tenant' })
  findAll(
    @TenantId() tenantId: string,
    @Query('page') page = 1,
    @Query('perPage') perPage = 20,
    @Query('search') search?: string,
  ) {
    return this.userService.findAll(tenantId, +page, +perPage, search);
  }

  @Get('system')
  @SuperAdmin()
  @ApiOperation({ summary: 'List all users across all tenants (Super Admin only)' })
  findAllSystem(
    @Query('page') page = 1,
    @Query('perPage') perPage = 20,
    @Query('search') search?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.userService.findAllSystem(+page, +perPage, search, tenantId);
  }

  @Get('roles')
  @RequirePermissions('user:view')
  @ApiOperation({ summary: 'List roles available in current tenant' })
  listRoles(@TenantId() tenantId: string) {
    return this.userService.listRoles(tenantId);
  }

  @Get(':id')
  @RequirePermissions('user:view')
  @ApiOperation({ summary: 'Get user by ID' })
  findById(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.userService.findById(id, tenantId);
  }

  @Post()
  @RequirePermissions('user:create')
  @ApiOperation({ summary: 'Create a new user in current tenant' })
  create(
    @TenantId() tenantId: string,
    @Body() body: { email: string; password: string; displayName: string; roleIds?: string[] },
  ) {
    return this.userService.create(tenantId, body);
  }

  @Patch(':id')
  @RequirePermissions('user:update')
  @ApiOperation({ summary: 'Update user details' })
  update(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() body: { displayName?: string; status?: string },
  ) {
    return this.userService.update(id, tenantId, body);
  }

  @Patch(':id/activate')
  @RequirePermissions('user:update')
  @ApiOperation({ summary: 'Activate a user' })
  activate(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.userService.activate(id, tenantId);
  }

  @Patch(':id/deactivate')
  @RequirePermissions('user:update')
  @ApiOperation({ summary: 'Deactivate a user' })
  deactivate(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.userService.deactivate(id, tenantId);
  }

  @Patch(':id/reset-2fa')
  @RequirePermissions('user:update')
  @ApiOperation({ summary: 'Reset 2FA for a user (admin action)' })
  resetTwoFa(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.userService.resetTwoFa(id, tenantId);
  }

  @Delete(':id')
  @RequirePermissions('user:delete')
  @ApiOperation({ summary: 'Soft-delete a user' })
  softDelete(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.userService.softDelete(id, tenantId);
  }
}

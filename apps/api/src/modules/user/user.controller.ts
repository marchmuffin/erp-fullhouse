import { Controller, Get, Post, Body, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions, TenantId } from '../../common/decorators';

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
  ) {
    return this.userService.findAll(tenantId, +page, +perPage);
  }

  @Get(':id')
  @RequirePermissions('user:view')
  @ApiOperation({ summary: 'Get user by ID' })
  findById(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.userService.findById(id, tenantId);
  }

  @Patch(':id/deactivate')
  @RequirePermissions('user:update')
  @ApiOperation({ summary: 'Deactivate a user' })
  deactivate(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.userService.deactivate(id, tenantId);
  }
}

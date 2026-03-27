import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AccountService } from './account.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions, TenantSchema } from '../../../common/decorators';

@ApiTags('finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'finance/accounts', version: '1' })
export class AccountController {
  constructor(private readonly svc: AccountService) {}

  @Get()
  @RequirePermissions('account:view')
  @ApiOperation({ summary: 'List chart of accounts' })
  findAll(
    @TenantSchema() schema: string,
    @Query('page') page = 1,
    @Query('perPage') perPage = 20,
    @Query('search') search?: string,
    @Query('type') type?: string,
  ) {
    return this.svc.findAll(schema, { page: +page, perPage: +perPage, search, type });
  }

  @Get(':id')
  @RequirePermissions('account:view')
  @ApiOperation({ summary: 'Get account by ID (with recent journal lines)' })
  findById(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.svc.findById(schema, id);
  }

  @Post()
  @RequirePermissions('account:create')
  @ApiOperation({ summary: 'Create account' })
  create(@TenantSchema() schema: string, @Body() dto: CreateAccountDto) {
    return this.svc.create(schema, dto);
  }

  @Put(':id')
  @RequirePermissions('account:update')
  @ApiOperation({ summary: 'Update account' })
  update(
    @TenantSchema() schema: string,
    @Param('id') id: string,
    @Body() dto: CreateAccountDto,
  ) {
    return this.svc.update(schema, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('account:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate account (soft delete — blocked if has journal lines)' })
  remove(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.svc.remove(schema, id);
  }
}

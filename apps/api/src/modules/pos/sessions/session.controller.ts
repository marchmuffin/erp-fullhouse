import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SessionService } from './session.service';
import { OpenSessionDto } from './dto/open-session.dto';
import { CloseSessionDto } from './dto/close-session.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions, TenantSchema } from '../../../common/decorators';

@ApiTags('pos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'pos/sessions', version: '1' })
export class SessionController {
  constructor(private readonly svc: SessionService) {}

  @Get()
  @RequirePermissions('pos:view')
  @ApiOperation({ summary: 'List POS sessions' })
  findAll(
    @TenantSchema() schema: string,
    @Query('page') page = 1,
    @Query('perPage') perPage = 20,
    @Query('status') status?: string,
  ) {
    return this.svc.findAll(schema, { page: +page, perPage: +perPage, status });
  }

  @Get('active')
  @RequirePermissions('pos:view')
  @ApiOperation({ summary: "Get current cashier's open session" })
  getActive(@TenantSchema() schema: string, @Request() req: any) {
    return this.svc.getActiveSession(schema, req.user.id);
  }

  @Get(':id')
  @RequirePermissions('pos:view')
  @ApiOperation({ summary: 'Get session by ID (with orders)' })
  findById(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.svc.findById(schema, id);
  }

  @Post('open')
  @RequirePermissions('pos:cashier')
  @ApiOperation({ summary: 'Open a new POS session' })
  open(
    @TenantSchema() schema: string,
    @Body() dto: OpenSessionDto,
    @Request() req: any,
  ) {
    return this.svc.open(schema, dto, req.user.id);
  }

  @Patch(':id/close')
  @RequirePermissions('pos:cashier')
  @ApiOperation({ summary: 'Close a POS session' })
  close(
    @TenantSchema() schema: string,
    @Param('id') id: string,
    @Body() dto: CloseSessionDto,
  ) {
    return this.svc.close(schema, id, dto);
  }
}

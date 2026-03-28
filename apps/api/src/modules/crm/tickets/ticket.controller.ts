import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, Patch, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TicketService } from './ticket.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions, CurrentUser, TenantSchema } from '../../../common/decorators';

@ApiTags('crm')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'crm/tickets', version: '1' })
export class TicketController {
  constructor(private readonly svc: TicketService) {}

  @Get()
  @RequirePermissions('ticket:view')
  @ApiOperation({ summary: 'List service tickets' })
  findAll(
    @TenantSchema() schema: string,
    @Query('page') page = 1,
    @Query('perPage') perPage = 20,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('type') type?: string,
  ) {
    return this.svc.findAll(schema, { page: +page, perPage: +perPage, search, status, priority, type });
  }

  @Get(':id')
  @RequirePermissions('ticket:view')
  @ApiOperation({ summary: 'Get service ticket detail' })
  findById(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.svc.findById(schema, id);
  }

  @Post()
  @RequirePermissions('ticket:create')
  @ApiOperation({ summary: 'Create service ticket' })
  create(
    @TenantSchema() schema: string,
    @Body() dto: CreateTicketDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.svc.create(schema, dto, userId);
  }

  @Put(':id')
  @RequirePermissions('ticket:update')
  @ApiOperation({ summary: 'Update service ticket' })
  update(
    @TenantSchema() schema: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateTicketDto> & { status?: string },
  ) {
    return this.svc.update(schema, id, dto);
  }

  @Patch(':id/resolve')
  @RequirePermissions('ticket:update')
  @ApiOperation({ summary: 'Mark ticket as resolved' })
  resolve(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.svc.resolve(schema, id);
  }

  @Patch(':id/close')
  @RequirePermissions('ticket:update')
  @ApiOperation({ summary: 'Close ticket' })
  close(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.svc.close(schema, id);
  }

  @Delete(':id')
  @RequirePermissions('ticket:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete service ticket' })
  remove(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.svc.remove(schema, id);
  }
}

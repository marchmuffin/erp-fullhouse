import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InvoiceService } from './invoice.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import {
  RequirePermissions,
  TenantSchema,
  CurrentUser,
} from '../../../common/decorators';

@ApiTags('finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'finance/invoices', version: '1' })
export class InvoiceController {
  constructor(private readonly svc: InvoiceService) {}

  @Get()
  @RequirePermissions('invoice:view')
  @ApiOperation({ summary: 'List invoices (AR/AP)' })
  findAll(
    @TenantSchema() schema: string,
    @Query('page') page = 1,
    @Query('perPage') perPage = 20,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.svc.findAll(schema, { page: +page, perPage: +perPage, type, status, search });
  }

  @Get(':id')
  @RequirePermissions('invoice:view')
  @ApiOperation({ summary: 'Get invoice by ID (with lines and payments)' })
  findById(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.svc.findById(schema, id);
  }

  @Post()
  @RequirePermissions('invoice:create')
  @ApiOperation({ summary: 'Create invoice (draft; auto-computes subtotal, 5% tax, total)' })
  create(
    @TenantSchema() schema: string,
    @Body() dto: CreateInvoiceDto,
    @CurrentUser() user: any,
  ) {
    return this.svc.create(schema, dto, user?.id);
  }

  @Patch(':id/issue')
  @RequirePermissions('invoice:approve')
  @ApiOperation({ summary: 'Issue invoice (draft → issued)' })
  issue(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.svc.issue(schema, id);
  }

  @Patch(':id/cancel')
  @RequirePermissions('invoice:approve')
  @ApiOperation({ summary: 'Cancel invoice (draft/issued → cancelled; blocked if has payments)' })
  cancel(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.svc.cancel(schema, id);
  }

  @Post(':id/payments')
  @RequirePermissions('payment:create')
  @ApiOperation({ summary: 'Record payment against invoice' })
  recordPayment(
    @TenantSchema() schema: string,
    @Param('id') invoiceId: string,
    @Body() dto: RecordPaymentDto,
    @CurrentUser() user: any,
  ) {
    return this.svc.recordPayment(schema, invoiceId, dto, user?.id);
  }
}

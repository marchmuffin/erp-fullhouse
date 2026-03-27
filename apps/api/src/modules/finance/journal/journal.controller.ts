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
import { JournalService } from './journal.service';
import { CreateJeDto } from './dto/create-je.dto';
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
@Controller({ path: 'finance/journal-entries', version: '1' })
export class JournalController {
  constructor(private readonly svc: JournalService) {}

  @Get()
  @RequirePermissions('je:view')
  @ApiOperation({ summary: 'List journal entries' })
  findAll(
    @TenantSchema() schema: string,
    @Query('page') page = 1,
    @Query('perPage') perPage = 20,
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.svc.findAll(schema, {
      page: +page,
      perPage: +perPage,
      status,
      dateFrom,
      dateTo,
    });
  }

  @Get(':id')
  @RequirePermissions('je:view')
  @ApiOperation({ summary: 'Get journal entry by ID (with lines and account info)' })
  findById(@TenantSchema() schema: string, @Param('id') id: string) {
    return this.svc.findById(schema, id);
  }

  @Post()
  @RequirePermissions('je:create')
  @ApiOperation({ summary: 'Create journal entry (draft; must balance)' })
  create(
    @TenantSchema() schema: string,
    @Body() dto: CreateJeDto,
    @CurrentUser() user: any,
  ) {
    return this.svc.create(schema, dto, user?.id);
  }

  @Patch(':id/post')
  @RequirePermissions('je:post')
  @ApiOperation({ summary: 'Post journal entry (draft → posted)' })
  post(
    @TenantSchema() schema: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.svc.post(schema, id, user?.id);
  }

  @Patch(':id/reverse')
  @RequirePermissions('je:post')
  @ApiOperation({ summary: 'Reverse a posted journal entry (creates counter-entry)' })
  reverse(
    @TenantSchema() schema: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.svc.reverse(schema, id, user?.id);
  }
}

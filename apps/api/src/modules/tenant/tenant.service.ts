import { Injectable, ConflictException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(page = 1, perPage = 20) {
    const skip = (page - 1) * perPage;
    const [data, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where: { deletedAt: null },
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, code: true, name: true, plan: true, status: true,
          contactEmail: true, country: true, createdAt: true,
          _count: { select: { users: true } },
        },
      }),
      this.prisma.tenant.count({ where: { deletedAt: null } }),
    ]);

    return {
      data,
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  async findById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id, deletedAt: null },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async create(dto: CreateTenantDto) {
    // Check uniqueness
    const existing = await this.prisma.tenant.findFirst({
      where: { OR: [{ code: dto.code }, { contactEmail: dto.contactEmail }], deletedAt: null },
    });
    if (existing) {
      throw new ConflictException('Tenant code or email already exists');
    }

    const schemaName = `tenant_${dto.code.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    // Create tenant and initial admin user in a transaction
    const tenant = await this.prisma.$transaction(async (tx) => {
      const newTenant = await tx.tenant.create({
        data: {
          code: dto.code,
          name: dto.name,
          contactEmail: dto.contactEmail,
          contactPhone: dto.contactPhone,
          plan: dto.plan as any,
          schemaName,
          modules: dto.modules || [],
          country: dto.country || 'TW',
          timezone: dto.timezone || 'Asia/Taipei',
          locale: dto.locale || 'zh-TW',
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14-day trial
        },
      });

      // Create tenant schema in PostgreSQL
      await tx.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

      // Create tenant business tables (sales module)
      await tx.$executeRawUnsafe(`
        SET LOCAL search_path TO "${schemaName}", public;

        CREATE TABLE IF NOT EXISTS customers (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          code VARCHAR(20) UNIQUE NOT NULL,
          name VARCHAR(200) NOT NULL,
          name_en VARCHAR(200),
          tax_id VARCHAR(20),
          credit_limit NUMERIC(15,2) NOT NULL DEFAULT 0,
          credit_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
          payment_terms INTEGER NOT NULL DEFAULT 30,
          grade VARCHAR(1) NOT NULL DEFAULT 'C',
          contact_name VARCHAR(100),
          contact_phone VARCHAR(50),
          contact_email VARCHAR(254),
          address TEXT,
          city VARCHAR(100),
          country VARCHAR(2) NOT NULL DEFAULT 'TW',
          currency VARCHAR(3) NOT NULL DEFAULT 'TWD',
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          notes TEXT,
          created_by UUID NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          deleted_at TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS sales_orders (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          order_no VARCHAR(30) UNIQUE NOT NULL,
          customer_id UUID NOT NULL REFERENCES "${schemaName}".customers(id),
          status VARCHAR(30) NOT NULL DEFAULT 'draft',
          order_date DATE NOT NULL,
          requested_date DATE,
          shipping_address TEXT,
          currency VARCHAR(3) NOT NULL DEFAULT 'TWD',
          exchange_rate NUMERIC(10,6) NOT NULL DEFAULT 1,
          subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
          tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
          total NUMERIC(15,2) NOT NULL DEFAULT 0,
          credit_checked BOOLEAN NOT NULL DEFAULT FALSE,
          notes TEXT,
          approved_by UUID,
          approved_at TIMESTAMPTZ,
          created_by UUID NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          deleted_at TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS so_lines (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          so_id UUID NOT NULL REFERENCES "${schemaName}".sales_orders(id) ON DELETE CASCADE,
          line_no INTEGER NOT NULL,
          item_code VARCHAR(30) NOT NULL,
          item_name VARCHAR(200) NOT NULL,
          spec VARCHAR(200),
          unit VARCHAR(20) NOT NULL,
          quantity NUMERIC(15,4) NOT NULL,
          unit_price NUMERIC(15,4) NOT NULL,
          discount NUMERIC(5,2) NOT NULL DEFAULT 0,
          amount NUMERIC(15,2) NOT NULL,
          shipped_qty NUMERIC(15,4) NOT NULL DEFAULT 0,
          notes TEXT,
          UNIQUE(so_id, line_no)
        );

        CREATE TABLE IF NOT EXISTS delivery_orders (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          do_no VARCHAR(30) UNIQUE NOT NULL,
          so_id UUID NOT NULL REFERENCES "${schemaName}".sales_orders(id),
          status VARCHAR(20) NOT NULL DEFAULT 'draft',
          ship_date DATE,
          carrier VARCHAR(100),
          tracking_no VARCHAR(100),
          notes TEXT,
          created_by UUID NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      // Create tenant business tables (procurement module)
      await tx.$executeRawUnsafe(`
        SET LOCAL search_path TO "${schemaName}", public;

        CREATE TABLE IF NOT EXISTS suppliers (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          code VARCHAR(20) UNIQUE NOT NULL,
          name VARCHAR(200) NOT NULL,
          name_en VARCHAR(200),
          tax_id VARCHAR(20),
          payment_terms INTEGER NOT NULL DEFAULT 30,
          grade VARCHAR(1) NOT NULL DEFAULT 'C',
          contact_name VARCHAR(100),
          contact_phone VARCHAR(50),
          contact_email VARCHAR(254),
          address TEXT,
          city VARCHAR(100),
          country VARCHAR(2) NOT NULL DEFAULT 'TW',
          currency VARCHAR(3) NOT NULL DEFAULT 'TWD',
          bank_name VARCHAR(100),
          bank_account VARCHAR(50),
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          notes TEXT,
          created_by UUID NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          deleted_at TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS purchase_requisitions (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          pr_no VARCHAR(30) UNIQUE NOT NULL,
          status VARCHAR(30) NOT NULL DEFAULT 'draft',
          request_date DATE NOT NULL,
          required_date DATE,
          department VARCHAR(100),
          purpose TEXT,
          notes TEXT,
          approved_by UUID,
          approved_at TIMESTAMPTZ,
          created_by UUID NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          deleted_at TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS pr_lines (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          pr_id UUID NOT NULL REFERENCES "${schemaName}".purchase_requisitions(id) ON DELETE CASCADE,
          line_no INTEGER NOT NULL,
          item_code VARCHAR(30) NOT NULL,
          item_name VARCHAR(200) NOT NULL,
          spec VARCHAR(200),
          unit VARCHAR(20) NOT NULL,
          quantity NUMERIC(15,4) NOT NULL,
          notes TEXT,
          UNIQUE(pr_id, line_no)
        );

        CREATE TABLE IF NOT EXISTS purchase_orders (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          po_no VARCHAR(30) UNIQUE NOT NULL,
          supplier_id UUID NOT NULL REFERENCES "${schemaName}".suppliers(id),
          pr_id UUID REFERENCES "${schemaName}".purchase_requisitions(id),
          status VARCHAR(30) NOT NULL DEFAULT 'draft',
          order_date DATE NOT NULL,
          expected_date DATE,
          currency VARCHAR(3) NOT NULL DEFAULT 'TWD',
          exchange_rate NUMERIC(10,6) NOT NULL DEFAULT 1,
          subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
          tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
          total NUMERIC(15,2) NOT NULL DEFAULT 0,
          notes TEXT,
          approved_by UUID,
          approved_at TIMESTAMPTZ,
          created_by UUID NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          deleted_at TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS po_lines (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          po_id UUID NOT NULL REFERENCES "${schemaName}".purchase_orders(id) ON DELETE CASCADE,
          line_no INTEGER NOT NULL,
          item_code VARCHAR(30) NOT NULL,
          item_name VARCHAR(200) NOT NULL,
          spec VARCHAR(200),
          unit VARCHAR(20) NOT NULL,
          quantity NUMERIC(15,4) NOT NULL,
          unit_price NUMERIC(15,4) NOT NULL,
          amount NUMERIC(15,2) NOT NULL,
          received_qty NUMERIC(15,4) NOT NULL DEFAULT 0,
          notes TEXT,
          UNIQUE(po_id, line_no)
        );

        CREATE TABLE IF NOT EXISTS goods_receipts (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          gr_no VARCHAR(30) UNIQUE NOT NULL,
          po_id UUID NOT NULL REFERENCES "${schemaName}".purchase_orders(id),
          status VARCHAR(20) NOT NULL DEFAULT 'draft',
          receive_date DATE NOT NULL,
          notes TEXT,
          created_by UUID NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS gr_lines (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          gr_id UUID NOT NULL REFERENCES "${schemaName}".goods_receipts(id) ON DELETE CASCADE,
          po_line_id UUID NOT NULL,
          line_no INTEGER NOT NULL,
          item_code VARCHAR(30) NOT NULL,
          item_name VARCHAR(200) NOT NULL,
          unit VARCHAR(20) NOT NULL,
          ordered_qty NUMERIC(15,4) NOT NULL,
          received_qty NUMERIC(15,4) NOT NULL,
          notes TEXT,
          UNIQUE(gr_id, line_no)
        );
      `);

      // Create tenant business tables (inventory module)
      await tx.$executeRawUnsafe(`
        SET LOCAL search_path TO "${schemaName}", public;

        CREATE TABLE IF NOT EXISTS items (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          code TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          category TEXT,
          unit TEXT NOT NULL DEFAULT 'PCS',
          unit_cost NUMERIC(15,4) NOT NULL DEFAULT 0,
          safety_stock NUMERIC(15,4) NOT NULL DEFAULT 0,
          reorder_point NUMERIC(15,4) NOT NULL DEFAULT 0,
          is_active BOOLEAN NOT NULL DEFAULT true,
          notes TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS warehouses (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          code TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          location TEXT,
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS stock_levels (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          item_id TEXT NOT NULL REFERENCES "${schemaName}".items(id),
          warehouse_id TEXT NOT NULL REFERENCES "${schemaName}".warehouses(id),
          quantity NUMERIC(15,4) NOT NULL DEFAULT 0,
          reserved_qty NUMERIC(15,4) NOT NULL DEFAULT 0,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(item_id, warehouse_id)
        );

        CREATE TABLE IF NOT EXISTS stock_transactions (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          txn_no TEXT UNIQUE NOT NULL,
          item_id TEXT NOT NULL REFERENCES "${schemaName}".items(id),
          warehouse_id TEXT NOT NULL REFERENCES "${schemaName}".warehouses(id),
          txn_type TEXT NOT NULL,
          quantity NUMERIC(15,4) NOT NULL,
          unit_cost NUMERIC(15,4) NOT NULL DEFAULT 0,
          ref_doc_type TEXT,
          ref_doc_id TEXT,
          ref_doc_no TEXT,
          notes TEXT,
          created_by TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS stock_counts (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          count_no TEXT UNIQUE NOT NULL,
          warehouse_id TEXT NOT NULL REFERENCES "${schemaName}".warehouses(id),
          status TEXT NOT NULL DEFAULT 'draft',
          count_date TIMESTAMPTZ NOT NULL,
          notes TEXT,
          created_by TEXT,
          completed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS stock_count_lines (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          stock_count_id TEXT NOT NULL REFERENCES "${schemaName}".stock_counts(id),
          item_id TEXT NOT NULL REFERENCES "${schemaName}".items(id),
          system_qty NUMERIC(15,4) NOT NULL,
          counted_qty NUMERIC(15,4),
          variance NUMERIC(15,4),
          notes TEXT
        );
      `);

      // Create tenant business tables (manufacturing module)
      await tx.$executeRawUnsafe(`
        SET LOCAL search_path TO "${schemaName}", public;

        CREATE TABLE IF NOT EXISTS boms (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          item_id TEXT NOT NULL REFERENCES "${schemaName}".items(id),
          version TEXT NOT NULL DEFAULT '1.0',
          is_active BOOLEAN NOT NULL DEFAULT true,
          description TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(item_id, version)
        );

        CREATE TABLE IF NOT EXISTS bom_lines (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          bom_id TEXT NOT NULL REFERENCES "${schemaName}".boms(id),
          line_no INTEGER NOT NULL,
          component_id TEXT NOT NULL REFERENCES "${schemaName}".items(id),
          quantity NUMERIC(15,4) NOT NULL,
          unit TEXT NOT NULL DEFAULT 'PCS',
          notes TEXT
        );

        CREATE TABLE IF NOT EXISTS work_orders (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          wo_no TEXT UNIQUE NOT NULL,
          bom_id TEXT REFERENCES "${schemaName}".boms(id),
          item_id TEXT NOT NULL REFERENCES "${schemaName}".items(id),
          planned_qty NUMERIC(15,4) NOT NULL,
          produced_qty NUMERIC(15,4) NOT NULL DEFAULT 0,
          warehouse_id TEXT REFERENCES "${schemaName}".warehouses(id),
          status TEXT NOT NULL DEFAULT 'draft',
          planned_start TIMESTAMPTZ,
          planned_end TIMESTAMPTZ,
          actual_start TIMESTAMPTZ,
          actual_end TIMESTAMPTZ,
          notes TEXT,
          created_by TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS wo_operations (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          work_order_id TEXT NOT NULL REFERENCES "${schemaName}".work_orders(id),
          step_no INTEGER NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          planned_hours NUMERIC(8,2),
          actual_hours NUMERIC(8,2),
          status TEXT NOT NULL DEFAULT 'pending',
          completed_at TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS wo_material_issues (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          work_order_id TEXT NOT NULL REFERENCES "${schemaName}".work_orders(id),
          item_id TEXT NOT NULL REFERENCES "${schemaName}".items(id),
          warehouse_id TEXT NOT NULL REFERENCES "${schemaName}".warehouses(id),
          required_qty NUMERIC(15,4) NOT NULL,
          issued_qty NUMERIC(15,4) NOT NULL DEFAULT 0,
          issued_at TIMESTAMPTZ,
          issued_by TEXT
        );
      `);

      // Create tenant business tables (finance module)
      await tx.$executeRawUnsafe(`
        SET LOCAL search_path TO "${schemaName}", public;

        CREATE TABLE IF NOT EXISTS accounts (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          code TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          category TEXT,
          is_active BOOLEAN NOT NULL DEFAULT true,
          notes TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS journal_entries (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          je_no TEXT UNIQUE NOT NULL,
          je_date TIMESTAMPTZ NOT NULL,
          description TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'draft',
          ref_doc_type TEXT,
          ref_doc_id TEXT,
          ref_doc_no TEXT,
          created_by TEXT,
          posted_by TEXT,
          posted_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS journal_lines (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          journal_entry_id TEXT NOT NULL REFERENCES "${schemaName}".journal_entries(id),
          line_no INTEGER NOT NULL,
          debit_account_id TEXT REFERENCES "${schemaName}".accounts(id),
          credit_account_id TEXT REFERENCES "${schemaName}".accounts(id),
          amount NUMERIC(15,2) NOT NULL,
          description TEXT
        );

        CREATE TABLE IF NOT EXISTS invoices (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          invoice_no TEXT UNIQUE NOT NULL,
          type TEXT NOT NULL,
          party_id TEXT NOT NULL,
          party_name TEXT NOT NULL,
          invoice_date TIMESTAMPTZ NOT NULL,
          due_date TIMESTAMPTZ NOT NULL,
          subtotal NUMERIC(15,2) NOT NULL,
          tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
          total_amount NUMERIC(15,2) NOT NULL,
          paid_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'draft',
          ref_doc_type TEXT,
          ref_doc_id TEXT,
          ref_doc_no TEXT,
          notes TEXT,
          created_by TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS invoice_lines (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          invoice_id TEXT NOT NULL REFERENCES "${schemaName}".invoices(id),
          line_no INTEGER NOT NULL,
          description TEXT NOT NULL,
          quantity NUMERIC(15,4) NOT NULL,
          unit_price NUMERIC(15,4) NOT NULL,
          amount NUMERIC(15,2) NOT NULL
        );

        CREATE TABLE IF NOT EXISTS payments (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          payment_no TEXT UNIQUE NOT NULL,
          invoice_id TEXT NOT NULL REFERENCES "${schemaName}".invoices(id),
          payment_date TIMESTAMPTZ NOT NULL,
          amount NUMERIC(15,2) NOT NULL,
          method TEXT NOT NULL,
          reference TEXT,
          notes TEXT,
          created_by TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      // Create tenant business tables (HR module)
      await tx.$executeRawUnsafe(`
        SET LOCAL search_path TO "${schemaName}", public;

        CREATE TABLE IF NOT EXISTS employees (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          emp_no TEXT UNIQUE NOT NULL,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          email TEXT,
          phone TEXT,
          department TEXT,
          position TEXT,
          hire_date TIMESTAMPTZ NOT NULL,
          terminate_date TIMESTAMPTZ,
          salary NUMERIC(15,2) NOT NULL DEFAULT 0,
          salary_type TEXT NOT NULL DEFAULT 'monthly',
          status TEXT NOT NULL DEFAULT 'active',
          notes TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS leave_requests (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          employee_id TEXT NOT NULL REFERENCES "${schemaName}".employees(id),
          leave_type TEXT NOT NULL,
          start_date TIMESTAMPTZ NOT NULL,
          end_date TIMESTAMPTZ NOT NULL,
          days NUMERIC(5,1) NOT NULL,
          reason TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          approved_by TEXT,
          approved_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS attendances (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          employee_id TEXT NOT NULL REFERENCES "${schemaName}".employees(id),
          date TIMESTAMPTZ NOT NULL,
          check_in TIMESTAMPTZ,
          check_out TIMESTAMPTZ,
          hours_worked NUMERIC(5,2),
          status TEXT NOT NULL DEFAULT 'present',
          notes TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(employee_id, date)
        );

        CREATE TABLE IF NOT EXISTS payroll_runs (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          run_no TEXT UNIQUE NOT NULL,
          period TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'draft',
          total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
          paid_at TIMESTAMPTZ,
          created_by TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS payroll_items (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          payroll_run_id TEXT NOT NULL REFERENCES "${schemaName}".payroll_runs(id),
          employee_id TEXT NOT NULL,
          emp_no TEXT NOT NULL,
          emp_name TEXT NOT NULL,
          base_salary NUMERIC(15,2) NOT NULL,
          allowances NUMERIC(15,2) NOT NULL DEFAULT 0,
          deductions NUMERIC(15,2) NOT NULL DEFAULT 0,
          net_pay NUMERIC(15,2) NOT NULL
        );
      `);

      // Create tenant business tables (CRM module)
      await tx.$executeRawUnsafe(`
        SET LOCAL search_path TO "${schemaName}", public;

        CREATE TABLE IF NOT EXISTS leads (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          name TEXT NOT NULL,
          company TEXT,
          email TEXT,
          phone TEXT,
          source TEXT,
          status TEXT NOT NULL DEFAULT 'new',
          estimated_value NUMERIC(15,2),
          assigned_to TEXT,
          notes TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS opportunities (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          title TEXT NOT NULL,
          lead_id TEXT REFERENCES "${schemaName}".leads(id),
          customer_id TEXT,
          stage TEXT NOT NULL DEFAULT 'prospecting',
          probability INTEGER NOT NULL DEFAULT 0,
          value NUMERIC(15,2) NOT NULL DEFAULT 0,
          expected_close TIMESTAMPTZ,
          assigned_to TEXT,
          notes TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS crm_activities (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          type TEXT NOT NULL,
          subject TEXT NOT NULL,
          description TEXT,
          lead_id TEXT REFERENCES "${schemaName}".leads(id),
          opportunity_id TEXT REFERENCES "${schemaName}".opportunities(id),
          scheduled_at TIMESTAMPTZ,
          completed_at TIMESTAMPTZ,
          status TEXT NOT NULL DEFAULT 'planned',
          created_by TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      // Create tenant business tables (quality module)
      await tx.$executeRawUnsafe(`
        SET LOCAL search_path TO "${schemaName}", public;

        CREATE TABLE IF NOT EXISTS inspection_orders (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          io_no TEXT UNIQUE NOT NULL,
          type TEXT NOT NULL,
          ref_doc_type TEXT, ref_doc_id TEXT, ref_doc_no TEXT,
          item_id TEXT, item_name TEXT,
          quantity NUMERIC(15,4) NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          result TEXT, inspector TEXT, inspected_at TIMESTAMPTZ, notes TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS io_checklist_items (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          inspection_order_id TEXT NOT NULL REFERENCES "${schemaName}".inspection_orders(id),
          item_no INTEGER NOT NULL,
          check_point TEXT NOT NULL,
          criteria TEXT, result TEXT, actual_value TEXT, notes TEXT
        );

        CREATE TABLE IF NOT EXISTS non_conformances (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          ncr_no TEXT UNIQUE NOT NULL,
          inspection_order_id TEXT REFERENCES "${schemaName}".inspection_orders(id),
          severity TEXT NOT NULL DEFAULT 'minor',
          description TEXT NOT NULL,
          root_cause TEXT, corrective_action TEXT,
          status TEXT NOT NULL DEFAULT 'open',
          resolved_at TIMESTAMPTZ, resolved_by TEXT, created_by TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      // Create tenant business tables (POS module)
      await tx.$executeRawUnsafe(`
        SET LOCAL search_path TO "${schemaName}", public;

        CREATE TABLE IF NOT EXISTS pos_sessions (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          session_no TEXT UNIQUE NOT NULL,
          cashier_id TEXT NOT NULL,
          cashier_name TEXT NOT NULL,
          opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          closed_at TIMESTAMPTZ,
          opening_cash NUMERIC(15,2) NOT NULL DEFAULT 0,
          closing_cash NUMERIC(15,2),
          total_sales NUMERIC(15,2) NOT NULL DEFAULT 0,
          total_orders INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'open',
          notes TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS pos_orders (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          order_no TEXT UNIQUE NOT NULL,
          session_id TEXT NOT NULL REFERENCES "${schemaName}".pos_sessions(id),
          subtotal NUMERIC(15,2) NOT NULL,
          tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
          discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
          total_amount NUMERIC(15,2) NOT NULL,
          paid_amount NUMERIC(15,2) NOT NULL,
          change_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
          payment_method TEXT NOT NULL DEFAULT 'cash',
          customer_id TEXT,
          status TEXT NOT NULL DEFAULT 'completed',
          void_reason TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS pos_order_lines (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          pos_order_id TEXT NOT NULL REFERENCES "${schemaName}".pos_orders(id),
          item_id TEXT,
          item_code TEXT NOT NULL,
          item_name TEXT NOT NULL,
          quantity NUMERIC(15,4) NOT NULL,
          unit_price NUMERIC(15,4) NOT NULL,
          discount NUMERIC(5,2) NOT NULL DEFAULT 0,
          amount NUMERIC(15,2) NOT NULL
        );
      `);

      // Create tenant business tables (BPM module)
      await tx.$executeRawUnsafe(`
        SET LOCAL search_path TO "${schemaName}", public;

        CREATE TABLE IF NOT EXISTS workflow_definitions (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          code TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          module TEXT NOT NULL,
          doc_type TEXT NOT NULL,
          steps INTEGER NOT NULL DEFAULT 1,
          is_active BOOLEAN NOT NULL DEFAULT true,
          description TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS workflow_instances (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          definition_id TEXT NOT NULL REFERENCES "${schemaName}".workflow_definitions(id),
          doc_type TEXT NOT NULL,
          doc_id TEXT NOT NULL,
          doc_no TEXT NOT NULL,
          submitted_by TEXT NOT NULL,
          submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          current_step INTEGER NOT NULL DEFAULT 1,
          status TEXT NOT NULL DEFAULT 'pending',
          completed_at TIMESTAMPTZ
        );
        CREATE TABLE IF NOT EXISTS workflow_steps (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          instance_id TEXT NOT NULL REFERENCES "${schemaName}".workflow_instances(id),
          step_no INTEGER NOT NULL,
          action TEXT,
          actor_id TEXT,
          actor_name TEXT,
          comment TEXT,
          acted_at TIMESTAMPTZ
        );
      `);

      // Create initial admin user
      const passwordHash = await bcrypt.hash(dto.adminPassword, 12);
      await tx.user.create({
        data: {
          tenantId: newTenant.id,
          email: dto.adminEmail,
          passwordHash,
          displayName: dto.adminName || dto.adminEmail,
          status: 'active',
          locale: dto.locale || 'zh-TW',
        },
      });

      this.logger.log(`Tenant created: ${newTenant.code} (${newTenant.id})`);
      return newTenant;
    });

    return tenant;
  }

  async suspend(id: string) {
    await this.findById(id);
    return this.prisma.tenant.update({
      where: { id },
      data: { status: 'suspended' },
    });
  }

  async activate(id: string) {
    await this.findById(id);
    return this.prisma.tenant.update({
      where: { id },
      data: { status: 'active' },
    });
  }
}

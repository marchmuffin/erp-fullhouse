import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Permission codes — aligned with init.sql + additional codes for all modules.
// ---------------------------------------------------------------------------
const permissionCodes: string[] = [
  'auth:login',
  'tenant:view', 'tenant:create', 'tenant:update', 'tenant:delete',
  'user:view', 'user:create', 'user:update', 'user:delete',
  'customer:view', 'customer:create', 'customer:update', 'customer:delete',
  'so:view', 'so:create', 'so:approve', 'so:cancel',
  'do:view', 'do:create',
  'supplier:view', 'supplier:create', 'supplier:update', 'supplier:delete',
  'pr:view', 'pr:create', 'pr:approve',
  'po:view', 'po:create', 'po:approve', 'po:update',
  'gr:view', 'gr:create',
  'item:view', 'item:create', 'item:update', 'item:delete',
  'stock:view', 'stock:adjust',
  'warehouse:view', 'warehouse:create', 'warehouse:update', 'warehouse:manage',
  'txn:view', 'txn:create',
  'count:view', 'count:create', 'count:complete',
  'bom:view', 'bom:create', 'bom:update', 'bom:delete',
  'wo:view', 'wo:create', 'wo:update', 'wo:release', 'wo:complete',
  'account:view', 'account:create', 'account:update', 'account:delete',
  'journal:view', 'journal:create', 'journal:approve',
  'invoice:view', 'invoice:create', 'invoice:approve',
  'payment:view', 'payment:create',
  'report:view', 'report:create',
  'employee:view', 'employee:create', 'employee:update', 'employee:delete',
  'leave:view', 'leave:create', 'leave:approve',
  'attendance:view', 'attendance:record',
  'payroll:view', 'payroll:create', 'payroll:approve', 'payroll:process',
  'lead:view', 'lead:create', 'lead:update', 'lead:qualify',
  'opportunity:view', 'opportunity:create', 'opportunity:update',
  'activity:view', 'activity:create',
  'ticket:view', 'ticket:create',
  'inspection:view', 'inspection:create', 'inspection:record',
  'ncr:view', 'ncr:create', 'ncr:resolve',
  'dashboard:view', 'bi:view',
  'workflow:view', 'workflow:submit', 'workflow:approve', 'workflow:manage',
  'approval:process',
  'pos:view', 'pos:cashier',
];

function getModule(resource: string): string {
  const map: Record<string, string> = {
    session: 'platform', auth: 'platform', tenant: 'platform', user: 'platform',
    customer: 'sales', so: 'sales', do: 'sales',
    supplier: 'procurement', pr: 'procurement', po: 'procurement', gr: 'procurement',
    item: 'inventory', stock: 'inventory', warehouse: 'inventory', txn: 'inventory', count: 'inventory',
    bom: 'manufacturing', wo: 'manufacturing',
    account: 'finance', journal: 'finance', invoice: 'finance', payment: 'finance', report: 'finance',
    employee: 'hr', leave: 'hr', attendance: 'hr', payroll: 'hr',
    lead: 'crm', opportunity: 'crm', activity: 'crm', ticket: 'crm',
    inspection: 'quality', ncr: 'quality',
    dashboard: 'bi', bi: 'bi',
    workflow: 'bpm', approval: 'bpm',
    pos: 'pos',
  };
  return map[resource] ?? 'system';
}

// ---------------------------------------------------------------------------
// Provision a tenant schema — creates all module tables
// ---------------------------------------------------------------------------
async function exec(sql: string) {
  await prisma.$executeRawUnsafe(sql);
}

async function provisionTenantSchema(schemaName: string) {
  const S = schemaName;
  await exec(`CREATE SCHEMA IF NOT EXISTS "${S}"`);
  await exec(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

  // Sales
  await exec(`CREATE TABLE IF NOT EXISTS "${S}".customers (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, name_en TEXT, tax_id TEXT,
    credit_limit NUMERIC(15,2) NOT NULL DEFAULT 0, credit_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
    payment_terms INTEGER NOT NULL DEFAULT 30, grade TEXT NOT NULL DEFAULT 'C',
    contact_name TEXT, contact_phone TEXT, contact_email TEXT,
    address TEXT, city TEXT, country TEXT NOT NULL DEFAULT 'TW',
    currency TEXT NOT NULL DEFAULT 'TWD', is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT, created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), deleted_at TIMESTAMPTZ
  )`);
  await exec(`CREATE TABLE IF NOT EXISTS "${S}".sales_orders (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    order_no TEXT UNIQUE NOT NULL, customer_id TEXT NOT NULL REFERENCES "${S}".customers(id),
    status TEXT NOT NULL DEFAULT 'draft', order_date DATE NOT NULL, requested_date DATE, shipping_address TEXT,
    currency TEXT NOT NULL DEFAULT 'TWD', exchange_rate NUMERIC(10,6) NOT NULL DEFAULT 1,
    subtotal NUMERIC(15,2) NOT NULL DEFAULT 0, tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    total NUMERIC(15,2) NOT NULL DEFAULT 0, credit_checked BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT, approved_by TEXT, approved_at TIMESTAMPTZ, created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), deleted_at TIMESTAMPTZ
  )`);
  await exec(`CREATE TABLE IF NOT EXISTS "${S}".so_lines (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    so_id TEXT NOT NULL REFERENCES "${S}".sales_orders(id) ON DELETE CASCADE,
    line_no INTEGER NOT NULL, item_code TEXT NOT NULL, item_name TEXT NOT NULL,
    spec TEXT, unit TEXT NOT NULL, quantity NUMERIC(15,4) NOT NULL,
    unit_price NUMERIC(15,4) NOT NULL, discount NUMERIC(5,2) NOT NULL DEFAULT 0,
    amount NUMERIC(15,2) NOT NULL, shipped_qty NUMERIC(15,4) NOT NULL DEFAULT 0,
    notes TEXT, UNIQUE(so_id, line_no)
  )`);
  await exec(`CREATE TABLE IF NOT EXISTS "${S}".delivery_orders (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    do_no TEXT UNIQUE NOT NULL, so_id TEXT NOT NULL REFERENCES "${S}".sales_orders(id),
    status TEXT NOT NULL DEFAULT 'draft', ship_date DATE,
    carrier TEXT, tracking_no TEXT, notes TEXT, created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);

  // Procurement
  await exec(`CREATE TABLE IF NOT EXISTS "${S}".suppliers (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, name_en TEXT, tax_id TEXT,
    payment_terms INTEGER NOT NULL DEFAULT 30, grade TEXT NOT NULL DEFAULT 'C',
    contact_name TEXT, contact_phone TEXT, contact_email TEXT,
    address TEXT, city TEXT, country TEXT NOT NULL DEFAULT 'TW',
    currency TEXT NOT NULL DEFAULT 'TWD', bank_name TEXT, bank_account TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE, notes TEXT, created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), deleted_at TIMESTAMPTZ
  )`);
  await exec(`CREATE TABLE IF NOT EXISTS "${S}".purchase_requisitions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    pr_no TEXT UNIQUE NOT NULL, status TEXT NOT NULL DEFAULT 'draft',
    request_date DATE NOT NULL, required_date DATE, department TEXT, purpose TEXT,
    notes TEXT, approved_by TEXT, approved_at TIMESTAMPTZ, created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), deleted_at TIMESTAMPTZ
  )`);
  await exec(`CREATE TABLE IF NOT EXISTS "${S}".pr_lines (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    pr_id TEXT NOT NULL REFERENCES "${S}".purchase_requisitions(id) ON DELETE CASCADE,
    line_no INTEGER NOT NULL, item_code TEXT NOT NULL, item_name TEXT NOT NULL,
    spec TEXT, unit TEXT NOT NULL, quantity NUMERIC(15,4) NOT NULL,
    notes TEXT, UNIQUE(pr_id, line_no)
  )`);
  await exec(`CREATE TABLE IF NOT EXISTS "${S}".purchase_orders (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    po_no TEXT UNIQUE NOT NULL, supplier_id TEXT NOT NULL REFERENCES "${S}".suppliers(id),
    pr_id TEXT REFERENCES "${S}".purchase_requisitions(id),
    status TEXT NOT NULL DEFAULT 'draft', order_date DATE NOT NULL, expected_date DATE,
    currency TEXT NOT NULL DEFAULT 'TWD', exchange_rate NUMERIC(10,6) NOT NULL DEFAULT 1,
    subtotal NUMERIC(15,2) NOT NULL DEFAULT 0, tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    total NUMERIC(15,2) NOT NULL DEFAULT 0, notes TEXT,
    approved_by TEXT, approved_at TIMESTAMPTZ, created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), deleted_at TIMESTAMPTZ
  )`);
  await exec(`CREATE TABLE IF NOT EXISTS "${S}".po_lines (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    po_id TEXT NOT NULL REFERENCES "${S}".purchase_orders(id) ON DELETE CASCADE,
    line_no INTEGER NOT NULL, item_code TEXT NOT NULL, item_name TEXT NOT NULL,
    spec TEXT, unit TEXT NOT NULL, quantity NUMERIC(15,4) NOT NULL,
    unit_price NUMERIC(15,4) NOT NULL, amount NUMERIC(15,2) NOT NULL,
    received_qty NUMERIC(15,4) NOT NULL DEFAULT 0, notes TEXT, UNIQUE(po_id, line_no)
  )`);
  await exec(`CREATE TABLE IF NOT EXISTS "${S}".goods_receipts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    gr_no TEXT UNIQUE NOT NULL, po_id TEXT NOT NULL REFERENCES "${S}".purchase_orders(id),
    status TEXT NOT NULL DEFAULT 'draft', receive_date DATE NOT NULL,
    notes TEXT, created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await exec(`CREATE TABLE IF NOT EXISTS "${S}".gr_lines (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    gr_id TEXT NOT NULL REFERENCES "${S}".goods_receipts(id) ON DELETE CASCADE,
    po_line_id TEXT NOT NULL, line_no INTEGER NOT NULL, item_code TEXT NOT NULL,
    item_name TEXT NOT NULL, unit TEXT NOT NULL,
    ordered_qty NUMERIC(15,4) NOT NULL, received_qty NUMERIC(15,4) NOT NULL,
    notes TEXT, UNIQUE(gr_id, line_no)
  )`);

  // Inventory
  await exec(`CREATE TABLE IF NOT EXISTS "${S}".items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, description TEXT, category TEXT,
    unit TEXT NOT NULL DEFAULT 'PCS', unit_cost NUMERIC(15,4) NOT NULL DEFAULT 0,
    safety_stock NUMERIC(15,4) NOT NULL DEFAULT 0, reorder_point NUMERIC(15,4) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true, notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await exec(`CREATE TABLE IF NOT EXISTS "${S}".warehouses (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, location TEXT, is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await exec(`CREATE TABLE IF NOT EXISTS "${S}".stock_levels (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    item_id TEXT NOT NULL REFERENCES "${S}".items(id),
    warehouse_id TEXT NOT NULL REFERENCES "${S}".warehouses(id),
    quantity NUMERIC(15,4) NOT NULL DEFAULT 0, reserved_qty NUMERIC(15,4) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(item_id, warehouse_id)
  )`);
  await exec(`CREATE TABLE IF NOT EXISTS "${S}".stock_transactions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    txn_no TEXT UNIQUE NOT NULL, item_id TEXT NOT NULL REFERENCES "${S}".items(id),
    warehouse_id TEXT NOT NULL REFERENCES "${S}".warehouses(id),
    txn_type TEXT NOT NULL, quantity NUMERIC(15,4) NOT NULL, unit_cost NUMERIC(15,4) NOT NULL DEFAULT 0,
    ref_doc_type TEXT, ref_doc_id TEXT, ref_doc_no TEXT, notes TEXT, created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await exec(`CREATE TABLE IF NOT EXISTS "${S}".stock_counts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    count_no TEXT UNIQUE NOT NULL, warehouse_id TEXT NOT NULL REFERENCES "${S}".warehouses(id),
    status TEXT NOT NULL DEFAULT 'draft', count_date TIMESTAMPTZ NOT NULL, notes TEXT,
    created_by TEXT, completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await exec(`CREATE TABLE IF NOT EXISTS "${S}".stock_count_lines (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    stock_count_id TEXT NOT NULL REFERENCES "${S}".stock_counts(id),
    item_id TEXT NOT NULL REFERENCES "${S}".items(id),
    system_qty NUMERIC(15,4) NOT NULL, counted_qty NUMERIC(15,4), variance NUMERIC(15,4), notes TEXT
  )`);

  // Manufacturing
  await exec(`CREATE TABLE IF NOT EXISTS "${S}".boms (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    item_id TEXT NOT NULL REFERENCES "${S}".items(id),
    version TEXT NOT NULL DEFAULT '1.0', is_active BOOLEAN NOT NULL DEFAULT true, description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(item_id, version)
  )`);
  await exec(`CREATE TABLE IF NOT EXISTS "${S}".bom_lines (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    bom_id TEXT NOT NULL REFERENCES "${S}".boms(id),
    line_no INTEGER NOT NULL, component_id TEXT NOT NULL REFERENCES "${S}".items(id),
    quantity NUMERIC(15,4) NOT NULL, unit TEXT NOT NULL DEFAULT 'PCS', notes TEXT
  )`);
  await exec(`CREATE TABLE IF NOT EXISTS "${S}".work_orders (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    wo_no TEXT UNIQUE NOT NULL, bom_id TEXT REFERENCES "${S}".boms(id),
    item_id TEXT NOT NULL REFERENCES "${S}".items(id),
    planned_qty NUMERIC(15,4) NOT NULL, produced_qty NUMERIC(15,4) NOT NULL DEFAULT 0,
    warehouse_id TEXT REFERENCES "${S}".warehouses(id),
    status TEXT NOT NULL DEFAULT 'draft',
    planned_start TIMESTAMPTZ, planned_end TIMESTAMPTZ, actual_start TIMESTAMPTZ, actual_end TIMESTAMPTZ,
    notes TEXT, created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await exec(`CREATE TABLE IF NOT EXISTS "${S}".wo_operations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    work_order_id TEXT NOT NULL REFERENCES "${S}".work_orders(id),
    step_no INTEGER NOT NULL, name TEXT NOT NULL, description TEXT,
    planned_hours NUMERIC(8,2), actual_hours NUMERIC(8,2),
    status TEXT NOT NULL DEFAULT 'pending', completed_at TIMESTAMPTZ
  )`);
  await exec(`CREATE TABLE IF NOT EXISTS "${S}".wo_material_issues (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    work_order_id TEXT NOT NULL REFERENCES "${S}".work_orders(id),
    item_id TEXT NOT NULL REFERENCES "${S}".items(id),
    warehouse_id TEXT NOT NULL REFERENCES "${S}".warehouses(id),
    required_qty NUMERIC(15,4) NOT NULL, issued_qty NUMERIC(15,4) NOT NULL DEFAULT 0,
    issued_at TIMESTAMPTZ, issued_by TEXT
  )`);

  // Finance
  await exec(`CREATE TABLE IF NOT EXISTS "${S}".accounts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL,
    category TEXT, is_active BOOLEAN NOT NULL DEFAULT true, notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await exec(`CREATE TABLE IF NOT EXISTS "${S}".journal_entries (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    je_no TEXT UNIQUE NOT NULL, je_date TIMESTAMPTZ NOT NULL,
    description TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft',
    ref_doc_type TEXT, ref_doc_id TEXT, ref_doc_no TEXT,
    created_by TEXT, posted_by TEXT, posted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await exec(`CREATE TABLE IF NOT EXISTS "${S}".journal_lines (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    journal_entry_id TEXT NOT NULL REFERENCES "${S}".journal_entries(id),
    line_no INTEGER NOT NULL,
    debit_account_id TEXT REFERENCES "${S}".accounts(id),
    credit_account_id TEXT REFERENCES "${S}".accounts(id),
    amount NUMERIC(15,2) NOT NULL, description TEXT
  )`);
  await exec(`CREATE TABLE IF NOT EXISTS "${S}".invoices (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    invoice_no TEXT UNIQUE NOT NULL, type TEXT NOT NULL, party_id TEXT NOT NULL, party_name TEXT NOT NULL,
    invoice_date TIMESTAMPTZ NOT NULL, due_date TIMESTAMPTZ NOT NULL,
    subtotal NUMERIC(15,2) NOT NULL, tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(15,2) NOT NULL, paid_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft',
    ref_doc_type TEXT, ref_doc_id TEXT, ref_doc_no TEXT, notes TEXT, created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await exec(`CREATE TABLE IF NOT EXISTS "${S}".invoice_lines (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    invoice_id TEXT NOT NULL REFERENCES "${S}".invoices(id),
    line_no INTEGER NOT NULL, description TEXT NOT NULL,
    quantity NUMERIC(15,4) NOT NULL, unit_price NUMERIC(15,4) NOT NULL, amount NUMERIC(15,2) NOT NULL
  )`);
  await exec(`CREATE TABLE IF NOT EXISTS "${S}".payments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    payment_no TEXT UNIQUE NOT NULL, invoice_id TEXT NOT NULL REFERENCES "${S}".invoices(id),
    payment_date TIMESTAMPTZ NOT NULL, amount NUMERIC(15,2) NOT NULL,
    method TEXT NOT NULL, reference TEXT, notes TEXT, created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);

  // HR
  await exec(`CREATE TABLE IF NOT EXISTS "${S}".employees (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    emp_no TEXT UNIQUE NOT NULL, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
    email TEXT, phone TEXT, department TEXT, position TEXT,
    hire_date TIMESTAMPTZ NOT NULL, terminate_date TIMESTAMPTZ,
    salary NUMERIC(15,2) NOT NULL DEFAULT 0, salary_type TEXT NOT NULL DEFAULT 'monthly',
    status TEXT NOT NULL DEFAULT 'active', notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await exec(`CREATE TABLE IF NOT EXISTS "${S}".leave_requests (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    employee_id TEXT NOT NULL REFERENCES "${S}".employees(id),
    leave_type TEXT NOT NULL, start_date TIMESTAMPTZ NOT NULL, end_date TIMESTAMPTZ NOT NULL,
    days NUMERIC(5,1) NOT NULL, reason TEXT, status TEXT NOT NULL DEFAULT 'pending',
    approved_by TEXT, approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await exec(`CREATE TABLE IF NOT EXISTS "${S}".attendances (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    employee_id TEXT NOT NULL REFERENCES "${S}".employees(id),
    date TIMESTAMPTZ NOT NULL, check_in TIMESTAMPTZ, check_out TIMESTAMPTZ,
    hours_worked NUMERIC(5,2), status TEXT NOT NULL DEFAULT 'present', notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(employee_id, date)
  )`);
  await exec(`CREATE TABLE IF NOT EXISTS "${S}".payroll_runs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    run_no TEXT UNIQUE NOT NULL, period TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft', total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    paid_at TIMESTAMPTZ, created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await exec(`CREATE TABLE IF NOT EXISTS "${S}".payroll_items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    payroll_run_id TEXT NOT NULL REFERENCES "${S}".payroll_runs(id),
    employee_id TEXT NOT NULL, emp_no TEXT NOT NULL, emp_name TEXT NOT NULL,
    base_salary NUMERIC(15,2) NOT NULL, allowances NUMERIC(15,2) NOT NULL DEFAULT 0,
    deductions NUMERIC(15,2) NOT NULL DEFAULT 0, net_pay NUMERIC(15,2) NOT NULL
  )`);

  // CRM
  await exec(`CREATE TABLE IF NOT EXISTS "${S}".leads (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL, company TEXT, email TEXT, phone TEXT, source TEXT,
    status TEXT NOT NULL DEFAULT 'new', estimated_value NUMERIC(15,2), assigned_to TEXT, notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await exec(`CREATE TABLE IF NOT EXISTS "${S}".opportunities (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title TEXT NOT NULL, lead_id TEXT REFERENCES "${S}".leads(id), customer_id TEXT,
    stage TEXT NOT NULL DEFAULT 'prospecting', probability INTEGER NOT NULL DEFAULT 0,
    value NUMERIC(15,2) NOT NULL DEFAULT 0, expected_close TIMESTAMPTZ, assigned_to TEXT, notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await exec(`CREATE TABLE IF NOT EXISTS "${S}".crm_activities (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    type TEXT NOT NULL, subject TEXT NOT NULL, description TEXT,
    lead_id TEXT REFERENCES "${S}".leads(id), opportunity_id TEXT REFERENCES "${S}".opportunities(id),
    scheduled_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'planned', created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);

  // Quality
  await exec(`CREATE TABLE IF NOT EXISTS "${S}".inspection_orders (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    io_no TEXT UNIQUE NOT NULL, type TEXT NOT NULL,
    ref_doc_type TEXT, ref_doc_id TEXT, ref_doc_no TEXT, item_id TEXT, item_name TEXT,
    quantity NUMERIC(15,4) NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
    result TEXT, inspector TEXT, inspected_at TIMESTAMPTZ, notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await exec(`CREATE TABLE IF NOT EXISTS "${S}".io_checklist_items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    inspection_order_id TEXT NOT NULL REFERENCES "${S}".inspection_orders(id),
    item_no INTEGER NOT NULL, check_point TEXT NOT NULL,
    criteria TEXT, result TEXT, actual_value TEXT, notes TEXT
  )`);
  await exec(`CREATE TABLE IF NOT EXISTS "${S}".non_conformances (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    ncr_no TEXT UNIQUE NOT NULL, inspection_order_id TEXT REFERENCES "${S}".inspection_orders(id),
    severity TEXT NOT NULL DEFAULT 'minor', description TEXT NOT NULL,
    root_cause TEXT, corrective_action TEXT, status TEXT NOT NULL DEFAULT 'open',
    resolved_at TIMESTAMPTZ, resolved_by TEXT, created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);

  // POS
  await exec(`CREATE TABLE IF NOT EXISTS "${S}".pos_sessions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    session_no TEXT UNIQUE NOT NULL, cashier_id TEXT NOT NULL, cashier_name TEXT NOT NULL,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), closed_at TIMESTAMPTZ,
    opening_cash NUMERIC(15,2) NOT NULL DEFAULT 0, closing_cash NUMERIC(15,2),
    total_sales NUMERIC(15,2) NOT NULL DEFAULT 0, total_orders INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'open', notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await exec(`CREATE TABLE IF NOT EXISTS "${S}".pos_orders (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    order_no TEXT UNIQUE NOT NULL, session_id TEXT NOT NULL REFERENCES "${S}".pos_sessions(id),
    subtotal NUMERIC(15,2) NOT NULL, tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0, total_amount NUMERIC(15,2) NOT NULL,
    paid_amount NUMERIC(15,2) NOT NULL, change_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'cash', customer_id TEXT,
    status TEXT NOT NULL DEFAULT 'completed', void_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await exec(`CREATE TABLE IF NOT EXISTS "${S}".pos_order_lines (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    pos_order_id TEXT NOT NULL REFERENCES "${S}".pos_orders(id),
    item_id TEXT, item_code TEXT NOT NULL, item_name TEXT NOT NULL,
    quantity NUMERIC(15,4) NOT NULL, unit_price NUMERIC(15,4) NOT NULL,
    discount NUMERIC(5,2) NOT NULL DEFAULT 0, amount NUMERIC(15,2) NOT NULL
  )`);

  // BPM
  await exec(`CREATE TABLE IF NOT EXISTS "${S}".workflow_definitions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, module TEXT NOT NULL,
    doc_type TEXT NOT NULL, steps INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true, description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await exec(`CREATE TABLE IF NOT EXISTS "${S}".workflow_instances (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    definition_id TEXT NOT NULL REFERENCES "${S}".workflow_definitions(id),
    doc_type TEXT NOT NULL, doc_id TEXT NOT NULL, doc_no TEXT NOT NULL,
    submitted_by TEXT NOT NULL, submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_step INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'pending', completed_at TIMESTAMPTZ
  )`);
  await exec(`CREATE TABLE IF NOT EXISTS "${S}".workflow_steps (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    instance_id TEXT NOT NULL REFERENCES "${S}".workflow_instances(id),
    step_no INTEGER NOT NULL, action TEXT, actor_id TEXT, actor_name TEXT,
    comment TEXT, acted_at TIMESTAMPTZ
  )`);
}

// ---------------------------------------------------------------------------
// Seed demo business data into tenant schema
// ---------------------------------------------------------------------------
async function seedTenantData(schemaName: string, adminUserId: string) {
  const S = schemaName;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // ── Customers ─────────────────────────────────────────────────────────────
  const customers = [
    { id: randomUUID(), code: 'C001', name: '台積電股份有限公司', grade: 'A', credit_limit: 5000000 },
    { id: randomUUID(), code: 'C002', name: '聯發科技股份有限公司', grade: 'A', credit_limit: 3000000 },
    { id: randomUUID(), code: 'C003', name: '鴻海精密工業股份有限公司', grade: 'B', credit_limit: 2000000 },
    { id: randomUUID(), code: 'C004', name: '華碩電腦股份有限公司', grade: 'B', credit_limit: 1500000 },
    { id: randomUUID(), code: 'C005', name: '宏碁股份有限公司', grade: 'C', credit_limit: 800000 },
    { id: randomUUID(), code: 'C006', name: '緯創資通股份有限公司', grade: 'B', credit_limit: 1200000 },
  ];

  for (const c of customers) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "${S}".customers (id, code, name, grade, credit_limit, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (code) DO NOTHING`,
      c.id, c.code, c.name, c.grade, c.credit_limit, adminUserId,
    );
  }

  // ── Suppliers ─────────────────────────────────────────────────────────────
  const suppliers = [
    { id: randomUUID(), code: 'S001', name: '台灣積體電路製造公司', grade: 'A', payment_terms: 60 },
    { id: randomUUID(), code: 'S002', name: '日月光半導體製造公司', grade: 'A', payment_terms: 45 },
    { id: randomUUID(), code: 'S003', name: '英業達股份有限公司', grade: 'B', payment_terms: 30 },
    { id: randomUUID(), code: 'S004', name: '廣達電腦股份有限公司', grade: 'B', payment_terms: 30 },
    { id: randomUUID(), code: 'S005', name: '和碩聯合科技股份有限公司', grade: 'C', payment_terms: 30 },
  ];

  for (const s of suppliers) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "${S}".suppliers (id, code, name, grade, payment_terms, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (code) DO NOTHING`,
      s.id, s.code, s.name, s.grade, s.payment_terms, adminUserId,
    );
  }

  // ── Warehouses ────────────────────────────────────────────────────────────
  const wh1 = randomUUID(); const wh2 = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "${S}".warehouses (id, code, name, location)
     VALUES ($1,'WH-A','主倉庫','新竹廠區 A棟'),
            ($2,'WH-B','成品倉','新竹廠區 B棟') ON CONFLICT (code) DO NOTHING`,
    wh1, wh2,
  );

  // ── Items ─────────────────────────────────────────────────────────────────
  const items = [
    { id: randomUUID(), code: 'RAW-001', name: '矽晶圓 8吋', cat: '原料', cost: 1200, safety: 500, reorder: 800 },
    { id: randomUUID(), code: 'RAW-002', name: '環氧樹脂', cat: '原料', cost: 85, safety: 200, reorder: 300 },
    { id: randomUUID(), code: 'RAW-003', name: '銅箔基板 FR4', cat: '原料', cost: 320, safety: 150, reorder: 250 },
    { id: randomUUID(), code: 'COMP-001', name: 'ARM 處理器模組', cat: '零組件', cost: 4500, safety: 50, reorder: 80 },
    { id: randomUUID(), code: 'COMP-002', name: 'DDR5 記憶體 8GB', cat: '零組件', cost: 890, safety: 100, reorder: 150 },
    { id: randomUUID(), code: 'COMP-003', name: '電源管理 IC', cat: '零組件', cost: 230, safety: 300, reorder: 500 },
    { id: randomUUID(), code: 'FG-001', name: '嵌入式控制板 V3', cat: '成品', cost: 8500, safety: 20, reorder: 40 },
    { id: randomUUID(), code: 'FG-002', name: '工業閘道器 G100', cat: '成品', cost: 15000, safety: 10, reorder: 20 },
    { id: randomUUID(), code: 'FG-003', name: '馬達驅動器 MD50', cat: '成品', cost: 6200, safety: 15, reorder: 30 },
    { id: randomUUID(), code: 'PKG-001', name: '包裝紙箱 A3', cat: '耗材', cost: 25, safety: 1000, reorder: 2000 },
  ];

  for (const it of items) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "${S}".items (id, code, name, category, unit_cost, safety_stock, reorder_point)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (code) DO NOTHING`,
      it.id, it.code, it.name, it.cat, it.cost, it.safety, it.reorder,
    );
  }

  // Stock levels (some below safety stock to show low-stock warnings)
  const stockData = [
    [items[0].id, wh1, 420],  // RAW-001 below safety 500 ← low stock
    [items[1].id, wh1, 350],
    [items[2].id, wh1, 180],  // RAW-003 above safety 150
    [items[3].id, wh2, 35],   // COMP-001 below safety 50 ← low stock
    [items[4].id, wh2, 220],
    [items[5].id, wh1, 280],
    [items[6].id, wh2, 8],    // FG-001 below safety 20 ← low stock
    [items[7].id, wh2, 12],
    [items[8].id, wh2, 22],
    [items[9].id, wh1, 3500],
  ];

  for (const [itemId, whId, qty] of stockData) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "${S}".stock_levels (item_id, warehouse_id, quantity)
       VALUES ($1,$2,$3) ON CONFLICT (item_id, warehouse_id) DO UPDATE SET quantity=$3`,
      itemId, whId, qty,
    );
  }

  // ── Employees ─────────────────────────────────────────────────────────────
  const employees = [
    { id: randomUUID(), no: 'EMP001', first: '志明', last: '陳', dept: '工程部', pos: '工程師', salary: 65000 },
    { id: randomUUID(), no: 'EMP002', first: '美玲', last: '林', dept: '業務部', pos: '業務經理', salary: 75000 },
    { id: randomUUID(), no: 'EMP003', first: '建國', last: '王', dept: '財務部', pos: '財務主任', salary: 70000 },
    { id: randomUUID(), no: 'EMP004', first: '淑芬', last: '張', dept: '人資部', pos: 'HR 專員', salary: 55000 },
    { id: randomUUID(), no: 'EMP005', first: '文雄', last: '李', dept: '採購部', pos: '採購專員', salary: 58000 },
    { id: randomUUID(), no: 'EMP006', first: '雅惠', last: '黃', dept: '品管部', pos: '品管工程師', salary: 62000 },
    { id: randomUUID(), no: 'EMP007', first: '俊賢', last: '吳', dept: '生產部', pos: '生產主管', salary: 72000 },
    { id: randomUUID(), no: 'EMP008', first: '怡君', last: '鄭', dept: '業務部', pos: '業務專員', salary: 52000 },
  ];

  for (const e of employees) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "${S}".employees (id, emp_no, first_name, last_name, department, position, salary, hire_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'2022-01-01') ON CONFLICT (emp_no) DO NOTHING`,
      e.id, e.no, e.first, e.last, e.dept, e.pos, e.salary,
    );
  }

  // Pending leave requests (for HR dashboard)
  for (let i = 0; i < 3; i++) {
    const emp = employees[i];
    const start = new Date(now.getFullYear(), now.getMonth(), 15 + i);
    const end = new Date(now.getFullYear(), now.getMonth(), 16 + i);
    await prisma.$executeRawUnsafe(
      `INSERT INTO "${S}".leave_requests (employee_id, leave_type, start_date, end_date, days, reason, status)
       VALUES ($1,'annual',$2,$3,1,'個人事務','pending') ON CONFLICT DO NOTHING`,
      emp.id, start, end,
    );
  }

  // ── Chart of Accounts ─────────────────────────────────────────────────────
  const accounts = [
    { code: '1101', name: '現金及約當現金', type: 'asset', cat: '流動資產' },
    { code: '1102', name: '應收帳款', type: 'asset', cat: '流動資產' },
    { code: '1201', name: '存貨', type: 'asset', cat: '流動資產' },
    { code: '1501', name: '機器設備', type: 'asset', cat: '非流動資產' },
    { code: '2101', name: '應付帳款', type: 'liability', cat: '流動負債' },
    { code: '2102', name: '應付薪資', type: 'liability', cat: '流動負債' },
    { code: '3101', name: '股本', type: 'equity', cat: '股東權益' },
    { code: '3201', name: '保留盈餘', type: 'equity', cat: '股東權益' },
    { code: '4101', name: '銷貨收入', type: 'revenue', cat: '營業收入' },
    { code: '5101', name: '銷貨成本', type: 'expense', cat: '營業成本' },
    { code: '5201', name: '薪資費用', type: 'expense', cat: '營業費用' },
    { code: '5301', name: '租金費用', type: 'expense', cat: '營業費用' },
  ];

  const accountIds: Record<string, string> = {};
  for (const acc of accounts) {
    const id = randomUUID();
    accountIds[acc.code] = id;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "${S}".accounts (id, code, name, type, category)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (code) DO NOTHING`,
      id, acc.code, acc.name, acc.type, acc.cat,
    );
  }

  // ── Sales Orders (6 months of data for trend chart) ───────────────────────
  const salesOrders: any[] = [];
  for (let m = 5; m >= 0; m--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const ordersThisMonth = m === 0 ? 8 : 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < ordersThisMonth; i++) {
      const dayOffset = Math.floor(Math.random() * 25);
      const orderDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), dayOffset + 1);
      const custIdx = i % customers.length;
      const total = 50000 + Math.floor(Math.random() * 200000);
      const subtotal = Math.round(total / 1.05);
      const tax = total - subtotal;
      const status = m === 0 && i < 3 ? 'pending_approval' : m === 0 && i < 6 ? 'approved' : 'shipped';
      const orderId = randomUUID();
      const orderNo = `SO-${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}-${String(i + 1).padStart(3, '0')}`;
      salesOrders.push({ id: orderId, no: orderNo, custId: customers[custIdx].id, status, subtotal, tax, total, date: orderDate });
      await prisma.$executeRawUnsafe(
        `INSERT INTO "${S}".sales_orders (id, order_no, customer_id, status, order_date, subtotal, tax_amount, total, created_by, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (order_no) DO NOTHING`,
        orderId, orderNo, customers[custIdx].id, status,
        orderDate,
        subtotal, tax, total, adminUserId, orderDate,
      );
    }
  }

  // ── Purchase Orders ────────────────────────────────────────────────────────
  const poStatuses = ['approved', 'approved', 'approved', 'pending_approval', 'pending_approval', 'received'];
  for (let i = 0; i < 6; i++) {
    const poId = randomUUID();
    const poNo = `PO-2026-${String(i + 1).padStart(4, '0')}`;
    const suppIdx = i % suppliers.length;
    const total = 30000 + Math.floor(Math.random() * 150000);
    const status = poStatuses[i] ?? 'draft';
    const poDate = new Date(now.getFullYear(), now.getMonth(), Math.max(1, now.getDate() - i * 3));
    await prisma.$executeRawUnsafe(
      `INSERT INTO "${S}".purchase_orders (id, po_no, supplier_id, status, order_date, subtotal, tax_amount, total, created_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (po_no) DO NOTHING`,
      poId, poNo, suppliers[suppIdx].id, status,
      poDate,
      Math.round(total / 1.05), total - Math.round(total / 1.05), total, adminUserId, poDate,
    );
  }

  // ── AR Invoices ────────────────────────────────────────────────────────────
  for (let i = 0; i < 5; i++) {
    const invId = randomUUID();
    const invNo = `INV-AR-2026-${String(i + 1).padStart(4, '0')}`;
    const total = 80000 + i * 30000;
    const paid = i < 2 ? total : i === 2 ? Math.round(total * 0.5) : 0;
    const status = i < 2 ? 'paid' : i === 2 ? 'partial' : 'issued';
    const dueDate = new Date(now.getFullYear(), now.getMonth(), 28 + i);
    await prisma.$executeRawUnsafe(
      `INSERT INTO "${S}".invoices (id, invoice_no, type, party_id, party_name, invoice_date, due_date, subtotal, tax_amount, total_amount, paid_amount, status)
       VALUES ($1,$2,'ar',$3,$4,NOW(),$5,$6,$7,$8,$9,$10) ON CONFLICT (invoice_no) DO NOTHING`,
      invId, invNo, customers[i % customers.length].id, customers[i % customers.length].name,
      dueDate, Math.round(total / 1.05), total - Math.round(total / 1.05), total, paid, status,
    );
  }

  // ── AP Invoices ────────────────────────────────────────────────────────────
  for (let i = 0; i < 4; i++) {
    const invId = randomUUID();
    const invNo = `INV-AP-2026-${String(i + 1).padStart(4, '0')}`;
    const total = 40000 + i * 20000;
    const paid = i < 1 ? total : 0;
    const status = i < 1 ? 'paid' : 'issued';
    const dueDate = new Date(now.getFullYear(), now.getMonth() + 1, 15 + i);
    await prisma.$executeRawUnsafe(
      `INSERT INTO "${S}".invoices (id, invoice_no, type, party_id, party_name, invoice_date, due_date, subtotal, tax_amount, total_amount, paid_amount, status)
       VALUES ($1,$2,'ap',$3,$4,NOW(),$5,$6,$7,$8,$9,$10) ON CONFLICT (invoice_no) DO NOTHING`,
      invId, invNo, suppliers[i % suppliers.length].id, suppliers[i % suppliers.length].name,
      dueDate, Math.round(total / 1.05), total - Math.round(total / 1.05), total, paid, status,
    );
  }

  // ── CRM Leads & Opportunities ──────────────────────────────────────────────
  const leads = [
    { name: '李大同', company: 'ABC 科技', source: 'referral', value: 500000 },
    { name: '周小芬', company: 'XYZ 工業', source: 'website', value: 300000 },
    { name: '趙明智', company: 'DEF 製造', source: 'exhibition', value: 800000 },
  ];
  const leadIds: string[] = [];
  for (const l of leads) {
    const id = randomUUID();
    leadIds.push(id);
    await prisma.$executeRawUnsafe(
      `INSERT INTO "${S}".leads (id, name, company, source, estimated_value, status)
       VALUES ($1,$2,$3,$4,$5,'qualified') ON CONFLICT DO NOTHING`,
      id, l.name, l.company, l.source, l.value,
    );
  }

  const oppStages = ['proposal', 'negotiation', 'closed_won'];
  for (let i = 0; i < 3; i++) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "${S}".opportunities (id, title, lead_id, stage, probability, value, expected_close)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
      randomUUID(), `${leads[i].company} 專案合作`, leadIds[i], oppStages[i],
      [40, 70, 100][i], leads[i].value,
      new Date(now.getFullYear(), now.getMonth() + 2, 15),
    );
  }

  // ── Quality Inspections ───────────────────────────────────────────────────
  const inspStatuses = ['passed', 'in_progress', 'failed'];
  for (let i = 0; i < 3; i++) {
    const ioId = randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "${S}".inspection_orders (id, io_no, type, item_id, item_name, quantity, status)
       VALUES ($1,$2,'incoming',$3,$4,100,$5) ON CONFLICT (io_no) DO NOTHING`,
      ioId, `IO-2026-${String(i + 1).padStart(4, '0')}`,
      items[i].id, items[i].name, inspStatuses[i],
    );

    if (inspStatuses[i] === 'failed') {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "${S}".non_conformances (id, ncr_no, inspection_order_id, severity, description, status)
         VALUES ($1,$2,$3,'major','來料尺寸偏差超出規格 ±0.1mm，批次 LOT-2026-031','open') ON CONFLICT (ncr_no) DO NOTHING`,
        randomUUID(), `NCR-2026-${String(i + 1).padStart(4, '0')}`, ioId,
      );
    }
  }

  // ── BPM Workflow Definitions & Pending Instances ───────────────────────────
  const wfDefs = [
    { id: randomUUID(), code: 'PR-APPROVAL', name: '採購申請審核', module: 'procurement', doc_type: 'pr', steps: 2 },
    { id: randomUUID(), code: 'PO-APPROVAL', name: '採購單審核', module: 'procurement', doc_type: 'po', steps: 2 },
    { id: randomUUID(), code: 'SO-APPROVAL', name: '銷售訂單審核', module: 'sales', doc_type: 'so', steps: 1 },
    { id: randomUUID(), code: 'LEAVE-APPROVAL', name: '請假審核', module: 'hr', doc_type: 'leave', steps: 1 },
  ];

  for (const def of wfDefs) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "${S}".workflow_definitions (id, code, name, module, doc_type, steps)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (code) DO NOTHING`,
      def.id, def.code, def.name, def.module, def.doc_type, def.steps,
    );
  }

  // Create pending workflow instances for the dashboard
  const pendingInstances = [
    { defId: wfDefs[0].id, docType: 'pr', docNo: 'PR-2026-0089', submitter: '採購部 陳志明' },
    { defId: wfDefs[2].id, docType: 'so', docNo: 'SO-2026-03-001', submitter: '業務部 林美玲' },
    { defId: wfDefs[3].id, docType: 'leave', docNo: 'LV-2026-0031', submitter: 'HR 張淑芬' },
  ];

  for (const inst of pendingInstances) {
    const instId = randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "${S}".workflow_instances (id, definition_id, doc_type, doc_id, doc_no, submitted_by, status)
       VALUES ($1,$2,$3,$4,$5,$6,'pending') ON CONFLICT DO NOTHING`,
      instId, inst.defId, inst.docType, randomUUID(), inst.docNo, inst.submitter,
    );
  }

  console.log(`✅ Demo data seeded in schema "${schemaName}"`);
  console.log(`   Customers: ${customers.length} | Suppliers: ${suppliers.length} | Items: ${items.length}`);
  console.log(`   Employees: ${employees.length} | Sales orders: ~${salesOrders.length} (6 months)`);
  console.log(`   Accounts: ${accounts.length} | AR/AP invoices: 5+4 | BPM pending: ${pendingInstances.length}`);
  console.log(`   Low-stock items: 3 | Open NCRs: 1 | CRM leads: ${leads.length}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('🌱 Seeding database...\n');

  // ─── 1. Permissions ────────────────────────────────────────────────────────
  for (const code of permissionCodes) {
    const [resource, action] = code.split(':');
    await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code, resource, action, module: getModule(resource), description: `${resource} ${action}` },
    });
  }
  console.log(`✅ ${permissionCodes.length} permissions seeded`);

  // ─── 2. System roles ────────────────────────────────────────────────────────
  async function upsertSystemRole(name: string, description: string, isSystem: boolean) {
    const existing = await prisma.role.findFirst({ where: { tenantId: null, name } });
    if (existing) return existing;
    return prisma.role.create({ data: { name, description, isSystem, tenantId: null } });
  }

  const adminRole = await upsertSystemRole('Super Admin', 'Full system access', true);
  const managerRole = await upsertSystemRole('Manager', 'Module manager with approval rights', false);
  const staffRole = await upsertSystemRole('Staff', 'Regular staff, view and create only', false);

  // ─── 3. Assign permissions to roles ────────────────────────────────────────
  const allPermissions = await prisma.permission.findMany();

  async function assignPerms(roleId: string, perms: typeof allPermissions) {
    for (const perm of perms) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId: perm.id } },
        update: {},
        create: { roleId, permissionId: perm.id },
      });
    }
  }

  await assignPerms(adminRole.id, allPermissions);
  await assignPerms(managerRole.id, allPermissions.filter(p => ['view', 'create', 'approve'].includes(p.action)));
  await assignPerms(staffRole.id, allPermissions.filter(p => ['view', 'create'].includes(p.action)));
  console.log('✅ 3 roles seeded with permissions');

  // ─── 4. Demo tenant ────────────────────────────────────────────────────────
  const demoTenant = await prisma.tenant.upsert({
    where: { code: 'DEMO' },
    update: {},
    create: {
      code: 'DEMO', name: '示範企業有限公司', nameEn: 'Demo Company Ltd.',
      plan: 'professional', status: 'active', schemaName: 'tenant_demo',
      contactEmail: 'admin@demo.erp.local', contactPhone: '+886-2-1234-5678',
      country: 'TW', timezone: 'Asia/Taipei', locale: 'zh-TW', maxUsers: 50,
      modules: ['sales','procurement','inventory','manufacturing','finance','hr','crm','quality','bi','bpm','pos'],
      trialEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });
  console.log(`✅ Demo tenant seeded: ${demoTenant.code} (${demoTenant.nameEn})`);

  // ─── 5. Users ───────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Admin@123', 12);

  const superAdmin = await prisma.user.findFirst({ where: { email: 'admin@erp.local', tenantId: null } })
    ?? await prisma.user.create({ data: { email: 'admin@erp.local', displayName: 'Super Admin', passwordHash, isSuperAdmin: true, status: 'active', emailVerifiedAt: new Date(), tenantId: null } });

  async function upsertTenantUser(params: { email: string; displayName: string; tenantId: string }) {
    const existing = await prisma.user.findFirst({ where: { tenantId: params.tenantId, email: params.email } });
    if (existing) return existing;
    return prisma.user.create({ data: { ...params, passwordHash, status: 'active', emailVerifiedAt: new Date() } });
  }

  const demoAdmin = await upsertTenantUser({ email: 'admin@demo.erp.local', displayName: 'Demo Admin', tenantId: demoTenant.id });
  const demoManager = await upsertTenantUser({ email: 'manager@demo.erp.local', displayName: 'Demo Manager', tenantId: demoTenant.id });
  const demoStaff = await upsertTenantUser({ email: 'staff@demo.erp.local', displayName: 'Demo Staff', tenantId: demoTenant.id });

  // ─── 6. Assign roles ────────────────────────────────────────────────────────
  async function assignRole(userId: string, roleId: string) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      update: {},
      create: { userId, roleId },
    });
  }

  await assignRole(superAdmin.id, adminRole.id);
  await assignRole(demoAdmin.id, adminRole.id);
  await assignRole(demoManager.id, managerRole.id);
  await assignRole(demoStaff.id, staffRole.id);
  console.log('✅ 4 users seeded');

  // ─── 7. Provision + seed tenant_demo schema ─────────────────────────────────
  console.log('\n📦 Provisioning tenant_demo schema...');
  await provisionTenantSchema('tenant_demo');
  await seedTenantData('tenant_demo', demoAdmin.id);

  // ─── Done ───────────────────────────────────────────────────────────────────
  console.log('\n🎉 Seed complete!');
  console.log('');
  console.log('Demo accounts  (password: Admin@123)');
  console.log('─────────────────────────────────────────────────────────');
  console.log('  Role          Email                         Tenant');
  console.log('  Super Admin   admin@erp.local               (platform)');
  console.log('  Demo Admin    admin@demo.erp.local           demo');
  console.log('  Demo Manager  manager@demo.erp.local         demo');
  console.log('  Demo Staff    staff@demo.erp.local           demo');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

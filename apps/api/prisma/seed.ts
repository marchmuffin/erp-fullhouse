import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Permission codes — aligned with init.sql + additional codes for all modules.
// Format: resource:action
// ---------------------------------------------------------------------------
const permissionCodes: string[] = [
  // Platform / Auth
  'auth:login',
  'tenant:view', 'tenant:create', 'tenant:update', 'tenant:delete',
  'user:view', 'user:create', 'user:update', 'user:delete',

  // Sales
  'customer:view', 'customer:create', 'customer:update', 'customer:delete',
  'so:view', 'so:create', 'so:approve', 'so:cancel',
  'do:view', 'do:create',

  // Procurement
  'supplier:view', 'supplier:create', 'supplier:update', 'supplier:delete',
  'pr:view', 'pr:create', 'pr:approve',
  'po:view', 'po:create', 'po:approve', 'po:update',
  'gr:view', 'gr:create',

  // Inventory
  'item:view', 'item:create', 'item:update', 'item:delete',
  'stock:view', 'stock:adjust',
  'warehouse:view', 'warehouse:create', 'warehouse:update', 'warehouse:manage',
  'txn:view', 'txn:create',
  'count:view', 'count:create', 'count:complete',

  // Manufacturing
  'bom:view', 'bom:create', 'bom:update', 'bom:delete',
  'wo:view', 'wo:create', 'wo:update', 'wo:release', 'wo:complete',

  // Finance
  'account:view', 'account:create', 'account:update', 'account:delete',
  'journal:view', 'journal:create', 'journal:approve',
  'invoice:view', 'invoice:create', 'invoice:approve',
  'payment:view', 'payment:create',
  'report:view', 'report:create',

  // HR
  'employee:view', 'employee:create', 'employee:update', 'employee:delete',
  'leave:view', 'leave:create', 'leave:approve',
  'attendance:view', 'attendance:record',
  'payroll:view', 'payroll:create', 'payroll:approve', 'payroll:process',

  // CRM
  'lead:view', 'lead:create', 'lead:update', 'lead:qualify',
  'opportunity:view', 'opportunity:create', 'opportunity:update',
  'activity:view', 'activity:create',
  'ticket:view', 'ticket:create',

  // Quality
  'inspection:view', 'inspection:create', 'inspection:record',
  'ncr:view', 'ncr:create', 'ncr:resolve',

  // BI
  'dashboard:view',
  'bi:view',

  // BPM
  'workflow:view', 'workflow:submit', 'workflow:approve', 'workflow:manage',
  'approval:process',

  // POS
  'pos:view', 'pos:cashier',
];

// ---------------------------------------------------------------------------
// Maps a resource name to its ERP module
// ---------------------------------------------------------------------------
function getModule(resource: string): string {
  const map: Record<string, string> = {
    // platform
    session: 'platform',
    auth: 'platform',
    tenant: 'platform',
    user: 'platform',
    // sales
    customer: 'sales',
    so: 'sales',
    do: 'sales',
    // procurement
    supplier: 'procurement',
    pr: 'procurement',
    po: 'procurement',
    gr: 'procurement',
    // inventory
    item: 'inventory',
    stock: 'inventory',
    warehouse: 'inventory',
    txn: 'inventory',
    count: 'inventory',
    // manufacturing
    bom: 'manufacturing',
    wo: 'manufacturing',
    // finance
    account: 'finance',
    journal: 'finance',
    invoice: 'finance',
    payment: 'finance',
    report: 'finance',
    // hr
    employee: 'hr',
    leave: 'hr',
    attendance: 'hr',
    payroll: 'hr',
    // crm
    lead: 'crm',
    opportunity: 'crm',
    activity: 'crm',
    ticket: 'crm',
    // quality
    inspection: 'quality',
    ncr: 'quality',
    // bi
    dashboard: 'bi',
    bi: 'bi',
    // bpm
    workflow: 'bpm',
    approval: 'bpm',
    // pos
    pos: 'pos',
  };
  return map[resource] ?? 'system';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('🌱 Seeding database...');

  // ─── 1. Permissions ────────────────────────────────────────────────────────
  for (const code of permissionCodes) {
    const [resource, action] = code.split(':');
    await prisma.permission.upsert({
      where: { code },
      update: {},
      create: {
        code,
        resource,
        action,
        module: getModule(resource),
        description: `${resource} ${action}`,
      },
    });
  }
  console.log(`✅ ${permissionCodes.length} permissions seeded`);

  // ─── 2. System roles (tenantId: null = platform-wide) ──────────────────────
  //
  // Role has a composite unique on [tenantId, name].
  // For system roles tenantId is null; null is treated as distinct by Postgres,
  // so we use findFirst + upsert-by-id pattern to stay idempotent.

  async function upsertSystemRole(
    name: string,
    description: string,
    isSystem: boolean,
  ) {
    const existing = await prisma.role.findFirst({
      where: { tenantId: null, name },
    });
    if (existing) return existing;
    return prisma.role.create({
      data: { name, description, isSystem, tenantId: null },
    });
  }

  const adminRole = await upsertSystemRole(
    'Super Admin',
    'Full system access',
    true,
  );
  const managerRole = await upsertSystemRole(
    'Manager',
    'Module manager with approval rights',
    false,
  );
  const staffRole = await upsertSystemRole(
    'Staff',
    'Regular staff, view and create only',
    false,
  );

  // ─── 3. Assign permissions to roles ────────────────────────────────────────
  const allPermissions = await prisma.permission.findMany();

  async function assignPerms(roleId: string, perms: typeof allPermissions) {
    for (const perm of perms) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId,
            permissionId: perm.id,
          },
        },
        update: {},
        create: { roleId, permissionId: perm.id },
      });
    }
  }

  // Super Admin: all permissions
  await assignPerms(adminRole.id, allPermissions);

  // Manager: view + create + approve
  const managerPerms = allPermissions.filter((p) =>
    ['view', 'create', 'approve'].includes(p.action),
  );
  await assignPerms(managerRole.id, managerPerms);

  // Staff: view + create only
  const staffPerms = allPermissions.filter((p) =>
    ['view', 'create'].includes(p.action),
  );
  await assignPerms(staffRole.id, staffPerms);

  console.log('✅ 3 roles seeded with permissions');

  // ─── 4. Demo tenant ────────────────────────────────────────────────────────
  const demoTenant = await prisma.tenant.upsert({
    where: { code: 'DEMO' },
    update: {},
    create: {
      code: 'DEMO',
      name: '示範企業有限公司',
      nameEn: 'Demo Company Ltd.',
      plan: 'professional',
      status: 'active',
      schemaName: 'tenant_demo',
      contactEmail: 'admin@demo.erp.local',
      contactPhone: '+886-2-1234-5678',
      country: 'TW',
      timezone: 'Asia/Taipei',
      locale: 'zh-TW',
      maxUsers: 50,
      modules: [
        'sales', 'procurement', 'inventory', 'manufacturing',
        'finance', 'hr', 'crm', 'quality', 'bi', 'bpm', 'pos',
      ],
      trialEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });
  console.log(`✅ Demo tenant seeded: ${demoTenant.code} (${demoTenant.nameEn})`);

  // ─── 5. Users ───────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Admin@123', 12);

  const superAdmin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: null as unknown as string, email: 'admin@erp.local' } },
    update: {},
    create: {
      email: 'admin@erp.local',
      displayName: 'Super Admin',
      passwordHash,
      isSuperAdmin: true,
      status: 'active',
      emailVerifiedAt: new Date(),
      tenantId: null,
    },
  });

  // For tenant-scoped users, tenantId is required in the composite unique key.
  async function upsertTenantUser(params: {
    email: string;
    displayName: string;
    tenantId: string;
    isSuperAdmin?: boolean;
  }) {
    const existing = await prisma.user.findFirst({
      where: { tenantId: params.tenantId, email: params.email },
    });
    if (existing) return existing;
    return prisma.user.create({
      data: {
        ...params,
        passwordHash,
        status: 'active',
        emailVerifiedAt: new Date(),
      },
    });
  }

  const demoAdmin = await upsertTenantUser({
    email: 'admin@demo.erp.local',
    displayName: 'Demo Admin',
    tenantId: demoTenant.id,
    isSuperAdmin: false,
  });

  const demoManager = await upsertTenantUser({
    email: 'manager@demo.erp.local',
    displayName: 'Demo Manager',
    tenantId: demoTenant.id,
    isSuperAdmin: false,
  });

  const demoStaff = await upsertTenantUser({
    email: 'staff@demo.erp.local',
    displayName: 'Demo Staff',
    tenantId: demoTenant.id,
    isSuperAdmin: false,
  });

  // ─── 6. Assign roles to users ───────────────────────────────────────────────
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

  // ─── Done ───────────────────────────────────────────────────────────────────
  console.log('');
  console.log('🎉 Seed complete!');
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
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

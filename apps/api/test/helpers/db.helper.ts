import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url:
        process.env.DATABASE_URL ||
        'postgresql://erp_user:erp_password@localhost:5432/erp_fullhouse_test',
    },
  },
});

export async function cleanDatabase() {
  // Delete in dependency order
  await prisma.auditLog.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.tenant.deleteMany();
}

export async function seedTestData() {
  const bcrypt = await import('bcrypt');
  const passwordHash = await bcrypt.hash('Test@123', 10);

  // Create test tenant
  const tenant = await prisma.tenant.create({
    data: {
      code: 'TEST',
      name: 'Test Company',
      plan: 'professional',
      status: 'active',
      schemaName: 'tenant_test_e2e',
      contactEmail: 'admin@test.e2e',
      trialEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });

  // Build all permission codes used across modules
  const allPermCodes = [
    'customer:view',
    'customer:create',
    'customer:update',
    'customer:delete',
    'so:view',
    'so:create',
    'so:approve',
    'supplier:view',
    'supplier:create',
    'supplier:update',
    'supplier:delete',
    'pr:view',
    'pr:create',
    'pr:approve',
    'po:view',
    'po:create',
    'po:approve',
    'item:view',
    'item:create',
    'item:update',
    'item:delete',
    'warehouse:view',
    'warehouse:create',
    'warehouse:update',
    'warehouse:delete',
    'txn:view',
    'txn:create',
    'count:view',
    'count:create',
    'count:complete',
    'bom:view',
    'bom:create',
    'bom:update',
    'bom:delete',
    'wo:view',
    'wo:create',
    'wo:release',
    'wo:complete',
    'account:view',
    'account:create',
    'account:update',
    'account:delete',
    'je:view',
    'je:create',
    'je:post',
    'invoice:view',
    'invoice:create',
    'invoice:approve',
    'payment:create',
    'employee:view',
    'employee:create',
    'employee:update',
    'employee:delete',
    'leave:view',
    'leave:create',
    'leave:approve',
    'attendance:view',
    'attendance:record',
    'payroll:view',
    'payroll:create',
    'payroll:approve',
    'lead:view',
    'lead:create',
    'lead:update',
    'lead:qualify',
    'opp:view',
    'opp:create',
    'opp:update',
    'activity:view',
    'activity:create',
    'inspection:view',
    'inspection:create',
    'inspection:record',
    'ncr:view',
    'ncr:create',
    'ncr:resolve',
    'bi:view',
    'workflow:view',
    'workflow:submit',
    'workflow:approve',
    'pos:view',
    'pos:cashier',
  ];

  const perms = await Promise.all(
    allPermCodes.map((code) => {
      const [resource, action] = code.split(':');
      return prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, name: code, resource, action, module: resource },
      });
    }),
  );

  const role = await prisma.role.create({
    data: {
      name: 'Test Admin',
      description: 'E2E test admin role with all permissions',
      isSystem: true,
      rolePermissions: {
        create: perms.map((p) => ({ permissionId: p.id })),
      },
    },
  });

  // Create test user (tenant-scoped)
  const user = await prisma.user.create({
    data: {
      email: 'test@e2e.local',
      displayName: 'Test User',
      passwordHash,
      tenantId: tenant.id,
      status: 'active',
      userRoles: { create: { roleId: role.id } },
    },
  });

  return { tenant, user, role };
}

export { prisma as testPrisma };

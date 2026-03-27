export default async function globalSetup() {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ||
    'postgresql://erp_user:erp_password@localhost:5432/erp_fullhouse_test';
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-e2e-tests';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-e2e-tests';
  process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
}

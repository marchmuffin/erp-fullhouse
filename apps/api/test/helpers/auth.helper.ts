import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export async function loginUser(
  app: INestApplication,
  email: string,
  password: string,
): Promise<AuthTokens> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);

  return {
    accessToken: res.body.data.accessToken,
    refreshToken: res.body.data.refreshToken,
  };
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export function tenantHeader(tenantId: string) {
  return { 'X-Tenant-ID': tenantId };
}

export function headers(token: string, tenantId?: string) {
  const h: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (tenantId) h['X-Tenant-ID'] = tenantId;
  return h;
}

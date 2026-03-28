import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly tenantClients = new Map<string, PrismaClient>();

  constructor() {
    super({
      log: [
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
      ],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    for (const client of this.tenantClients.values()) {
      await client.$disconnect();
    }
    this.tenantClients.clear();
    this.logger.log('Database disconnected');
  }

  /**
   * Execute queries against a specific tenant schema.
   * Prisma hardcodes the schema name in generated SQL, so we must use a per-tenant
   * PrismaClient with the correct schema in the connection URL.
   * Clients are cached per schema to avoid connection pool churn.
   */
  async withTenantSchema<T>(
    schemaName: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    if (!this.tenantClients.has(schemaName)) {
      const baseUrl = (process.env.DATABASE_URL ?? '').replace(/[?&]schema=[^&]+/, '');
      const separator = baseUrl.includes('?') ? '&' : '?';
      const tenantUrl = `${baseUrl}${separator}schema=${schemaName}`;
      const client = new PrismaClient({
        datasources: { db: { url: tenantUrl } },
      });
      await client.$connect();
      this.tenantClients.set(schemaName, client);
    }
    const client = this.tenantClients.get(schemaName)!;
    return client.$transaction(async (tx) => fn(tx));
  }
}

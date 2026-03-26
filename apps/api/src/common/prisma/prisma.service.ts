import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
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
    this.logger.log('Database disconnected');
  }

  /**
   * Execute queries in a specific tenant schema
   * Used for schema-per-tenant multi-tenancy
   */
  async withTenantSchema<T>(schemaName: string, fn: () => Promise<T>): Promise<T> {
    // Set search_path then execute the function in a transaction
    await this.$executeRawUnsafe(`SET search_path TO "${schemaName}", public`);
    return fn();
  }
}

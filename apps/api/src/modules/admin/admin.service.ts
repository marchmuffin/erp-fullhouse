import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  constructor(private readonly config: ConfigService) {}

  async createBackup(): Promise<{ filename: string; content: string }> {
    const databaseUrl = this.config.get<string>('DATABASE_URL');
    if (!databaseUrl) throw new Error('DATABASE_URL not configured');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `erp-backup-${timestamp}.sql`;
    try {
      const { stdout } = await execAsync(`pg_dump "${databaseUrl}" --no-password 2>/dev/null`, {
        maxBuffer: 200 * 1024 * 1024, // 200MB
        timeout: 120000,
      });
      return { filename, content: stdout };
    } catch (err) {
      this.logger.error('Backup failed', err);
      throw new Error('Database backup failed: ' + (err as Error).message);
    }
  }
}

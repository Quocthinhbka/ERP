import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async check() {
    const db = await this.checkDatabase();
    const redis = await this.checkRedis();

    const status = db.status === 'up' && redis.status === 'up' ? 'ok' : 'degraded';

    return {
      status,
      timestamp: new Date().toISOString(),
      services: { database: db, redis },
    };
  }

  private async checkDatabase() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'up' as const };
    } catch (error) {
      return {
        status: 'down' as const,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async checkRedis() {
    const redis = new Redis({
      host: this.config.get<string>('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6380),
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      lazyConnect: true,
    });

    try {
      await redis.connect();
      const pong = await redis.ping();
      await redis.quit();
      return { status: pong === 'PONG' ? ('up' as const) : ('down' as const) };
    } catch (error) {
      try {
        await redis.quit();
      } catch {
        // ignore
      }
      return {
        status: 'down' as const,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

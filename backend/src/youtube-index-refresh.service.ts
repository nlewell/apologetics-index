import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { YoutubeService } from './youtube.service';

@Injectable()
export class YoutubeIndexRefreshService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(YoutubeIndexRefreshService.name);
  private refreshTimer: NodeJS.Timeout | null = null;
  private startupTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly youtubeService: YoutubeService,
  ) {}

  onModuleInit() {
    const intervalMs = this.getRefreshIntervalMs();
    if (intervalMs <= 0) {
      this.logger.log('YouTube index refresh disabled');
      return;
    }

    const initialDelayMs = this.getInitialDelayMs();
    this.startupTimer = setTimeout(() => {
      void this.refreshAllIndexedQueries();
    }, initialDelayMs);

    this.refreshTimer = setInterval(() => {
      void this.refreshAllIndexedQueries();
    }, intervalMs);
  }

  onModuleDestroy() {
    if (this.startupTimer) {
      clearTimeout(this.startupTimer);
      this.startupTimer = null;
    }

    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private async refreshAllIndexedQueries(): Promise<void> {
    const queries = await this.prismaService.youtubeVideoIndex.findMany({
      select: {
        query: true,
        items: true,
      },
    });

    if (!queries.length) {
      return;
    }

    for (const row of queries) {
      const indexedItems = Array.isArray(row.items)
        ? (row.items as Array<{ videoId?: string }>)
        : [];
      const maxResults = Math.max(1, indexedItems.length || this.getDefaultRefreshSize());

      try {
        await this.youtubeService.search(row.query, maxResults, false, true);
        this.logger.debug(`Refreshed YouTube index for "${row.query}"`);
      } catch (error) {
        this.logger.warn(
          `Failed to refresh YouTube index for "${row.query}": ${this.formatError(error)}`,
        );
      }
    }
  }

  private getRefreshIntervalMs(): number {
    return this.readPositiveNumber('YOUTUBE_VIDEO_INDEX_REFRESH_INTERVAL_MS') ?? 6 * 60 * 60 * 1000;
  }

  private getInitialDelayMs(): number {
    return this.readPositiveNumber('YOUTUBE_VIDEO_INDEX_INITIAL_REFRESH_DELAY_MS') ?? 60 * 1000;
  }

  private getDefaultRefreshSize(): number {
    return this.readPositiveNumber('YOUTUBE_VIDEO_INDEX_DEFAULT_REFRESH_SIZE') ?? 5;
  }

  private readPositiveNumber(key: string): number | null {
    const raw = this.configService.get<string>(key);
    const parsed = Number(raw);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }

    return parsed;
  }

  private formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}

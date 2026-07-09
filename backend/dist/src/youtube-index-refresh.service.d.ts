import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { YoutubeService } from './youtube.service';
export declare class YoutubeIndexRefreshService implements OnModuleInit, OnModuleDestroy {
    private readonly configService;
    private readonly prismaService;
    private readonly youtubeService;
    private readonly logger;
    private refreshTimer;
    private startupTimer;
    constructor(configService: ConfigService, prismaService: PrismaService, youtubeService: YoutubeService);
    onModuleInit(): void;
    onModuleDestroy(): void;
    private refreshAllIndexedQueries;
    private getRefreshIntervalMs;
    private getInitialDelayMs;
    private getDefaultRefreshSize;
    private readPositiveNumber;
    private formatError;
}

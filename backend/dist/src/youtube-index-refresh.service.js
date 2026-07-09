"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var YoutubeIndexRefreshService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.YoutubeIndexRefreshService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("./prisma.service");
const youtube_service_1 = require("./youtube.service");
let YoutubeIndexRefreshService = YoutubeIndexRefreshService_1 = class YoutubeIndexRefreshService {
    configService;
    prismaService;
    youtubeService;
    logger = new common_1.Logger(YoutubeIndexRefreshService_1.name);
    refreshTimer = null;
    startupTimer = null;
    constructor(configService, prismaService, youtubeService) {
        this.configService = configService;
        this.prismaService = prismaService;
        this.youtubeService = youtubeService;
    }
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
    async refreshAllIndexedQueries() {
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
                ? row.items
                : [];
            const maxResults = Math.max(1, indexedItems.length || this.getDefaultRefreshSize());
            try {
                await this.youtubeService.search(row.query, maxResults, false, true);
                this.logger.debug(`Refreshed YouTube index for "${row.query}"`);
            }
            catch (error) {
                this.logger.warn(`Failed to refresh YouTube index for "${row.query}": ${this.formatError(error)}`);
            }
        }
    }
    getRefreshIntervalMs() {
        return this.readPositiveNumber('YOUTUBE_VIDEO_INDEX_REFRESH_INTERVAL_MS') ?? 6 * 60 * 60 * 1000;
    }
    getInitialDelayMs() {
        return this.readPositiveNumber('YOUTUBE_VIDEO_INDEX_INITIAL_REFRESH_DELAY_MS') ?? 60 * 1000;
    }
    getDefaultRefreshSize() {
        return this.readPositiveNumber('YOUTUBE_VIDEO_INDEX_DEFAULT_REFRESH_SIZE') ?? 5;
    }
    readPositiveNumber(key) {
        const raw = this.configService.get(key);
        const parsed = Number(raw);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            return null;
        }
        return parsed;
    }
    formatError(error) {
        if (error instanceof Error) {
            return error.message;
        }
        return String(error);
    }
};
exports.YoutubeIndexRefreshService = YoutubeIndexRefreshService;
exports.YoutubeIndexRefreshService = YoutubeIndexRefreshService = YoutubeIndexRefreshService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService,
        youtube_service_1.YoutubeService])
], YoutubeIndexRefreshService);
//# sourceMappingURL=youtube-index-refresh.service.js.map
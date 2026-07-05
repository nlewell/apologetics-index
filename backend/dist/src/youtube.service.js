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
Object.defineProperty(exports, "__esModule", { value: true });
exports.YoutubeService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
let YoutubeService = class YoutubeService {
    configService;
    channelIdCache = new Map();
    shortsMaxSeconds;
    constructor(configService) {
        this.configService = configService;
        this.shortsMaxSeconds = this.getShortsMaxSeconds();
    }
    async search(query, maxResults = 5, debug = false) {
        const apiKey = this.configService.get('YOUTUBE_API_KEY');
        if (!apiKey) {
            throw new common_1.ServiceUnavailableException('YOUTUBE_API_KEY is not configured on the server');
        }
        const whitelist = await this.loadWhitelistEntries();
        const resolvedChannelIds = await this.resolveChannelIds(whitelist, apiKey);
        const preferredEntries = await this.loadPreferredEntries();
        const preferredChannelIds = new Set(await this.resolveChannelIds(preferredEntries, apiKey));
        if (!resolvedChannelIds.length) {
            return {
                query,
                maxResults,
                whitelist: {
                    sourceFile: this.whitelistPath,
                    configuredEntries: whitelist,
                    resolvedChannelIds: [],
                },
                items: [],
            };
        }
        const perChannelMaxResults = Math.max(1, Math.min(10, Math.ceil(maxResults / resolvedChannelIds.length) + 1));
        const channelSearchResults = await Promise.all(resolvedChannelIds.map((channelId) => this.searchWithinChannel(query, channelId, perChannelMaxResults, apiKey)));
        const deduped = new Map();
        for (const item of channelSearchResults.flat()) {
            if (!deduped.has(item.videoId)) {
                deduped.set(item.videoId, item);
            }
        }
        const scoredItems = Array.from(deduped.values())
            .map((item) => ({
            ...item,
            relevanceScore: item.relevanceScore +
                (preferredChannelIds.has(item.channelId)
                    ? this.preferredChannelBonus
                    : 0),
            preferredBoostApplied: preferredChannelIds.has(item.channelId),
        }))
            .sort((a, b) => {
            if (b.relevanceScore !== a.relevanceScore) {
                return b.relevanceScore - a.relevanceScore;
            }
            return (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '');
        })
            .slice(0, maxResults);
        const items = scoredItems.map(({ relevanceScore: _relevanceScore, preferredBoostApplied: _preferredBoostApplied, ...item }) => item);
        const isDebugEnabled = debug && this.environment !== 'production';
        const response = {
            query,
            maxResults,
            whitelist: {
                sourceFile: this.whitelistPath,
                configuredEntries: whitelist,
                resolvedChannelIds,
            },
            items,
        };
        if (isDebugEnabled) {
            response.debug = {
                enabled: true,
                environment: this.environment,
                preferredChannelBonus: this.preferredChannelBonus,
                scores: scoredItems.map((item) => ({
                    videoId: item.videoId,
                    title: item.title,
                    channelTitle: item.channelTitle,
                    relevanceScore: item.relevanceScore,
                    preferredBoostApplied: item.preferredBoostApplied,
                })),
            };
        }
        return response;
    }
    async searchWithinChannel(query, channelId, maxResults, apiKey) {
        const url = new URL('https://www.googleapis.com/youtube/v3/search');
        url.searchParams.set('part', 'snippet');
        url.searchParams.set('type', 'video');
        url.searchParams.set('order', 'relevance');
        url.searchParams.set('channelId', channelId);
        url.searchParams.set('q', query);
        url.searchParams.set('maxResults', String(maxResults));
        url.searchParams.set('key', apiKey);
        const response = await fetch(url);
        if (!response.ok) {
            const text = await response.text();
            throw new common_1.BadGatewayException(`YouTube API request failed (${response.status}): ${text}`);
        }
        const payload = (await response.json());
        const mappedItems = (payload.items ?? [])
            .map((item) => {
            const videoId = item.id?.videoId;
            const snippet = item.snippet;
            if (!videoId || !snippet?.title || !snippet.channelId) {
                return null;
            }
            return {
                videoId,
                title: snippet.title,
                description: snippet.description ?? '',
                channelTitle: snippet.channelTitle ?? '',
                channelId: snippet.channelId,
                publishedAt: snippet.publishedAt ?? '',
                thumbnailUrl: snippet.thumbnails?.medium?.url ??
                    snippet.thumbnails?.high?.url ??
                    snippet.thumbnails?.default?.url ??
                    null,
                videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
                duration: '',
                durationSeconds: 0,
                isShort: false,
            };
        })
            .filter((item) => item !== null);
        if (!mappedItems.length) {
            return [];
        }
        const durationByVideoId = await this.fetchVideoDurations(mappedItems.map((item) => item.videoId), apiKey);
        return mappedItems.map((item, index) => {
            const durationRaw = durationByVideoId.get(item.videoId) ?? '';
            const durationSeconds = this.parseIso8601DurationToSeconds(durationRaw);
            const enrichedItem = {
                ...item,
                duration: this.formatDuration(durationSeconds),
                durationSeconds,
                isShort: durationSeconds > 0 && durationSeconds <= this.shortsMaxSeconds,
            };
            return {
                ...enrichedItem,
                relevanceScore: this.computeRelevanceScore(query, enrichedItem, index),
                preferredBoostApplied: false,
            };
        });
    }
    get environment() {
        return this.configService.get('NODE_ENV') ?? 'development';
    }
    computeRelevanceScore(query, item, rankIndex) {
        const normalizedQuery = this.normalizeText(query);
        const normalizedTitle = this.normalizeText(item.title);
        const normalizedDescription = this.normalizeText(item.description);
        const queryTokens = this.tokenize(normalizedQuery);
        let score = 0;
        if (!normalizedQuery) {
            return score;
        }
        if (normalizedTitle === normalizedQuery) {
            score += 160;
        }
        else if (normalizedTitle.includes(normalizedQuery)) {
            score += 120;
        }
        if (normalizedTitle.startsWith(normalizedQuery)) {
            score += 40;
        }
        if (normalizedDescription.includes(normalizedQuery)) {
            score += 25;
        }
        const titleTokens = new Set(this.tokenize(normalizedTitle));
        const descriptionTokens = new Set(this.tokenize(normalizedDescription));
        for (const token of queryTokens) {
            if (titleTokens.has(token)) {
                score += 12;
            }
            if (descriptionTokens.has(token)) {
                score += 4;
            }
        }
        score += Math.max(0, 30 - rankIndex * 2);
        return score;
    }
    normalizeText(text) {
        return text
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    tokenize(text) {
        if (!text) {
            return [];
        }
        return text.split(' ').filter((token) => token.length > 1);
    }
    async loadWhitelistEntries() {
        const raw = await node_fs_1.promises.readFile(this.whitelistPath, 'utf-8');
        return raw
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0 && !line.startsWith('#'));
    }
    async loadPreferredEntries() {
        try {
            const raw = await node_fs_1.promises.readFile(this.preferredPath, 'utf-8');
            return raw
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter((line) => line.length > 0 && !line.startsWith('#'));
        }
        catch (error) {
            if (typeof error === 'object' &&
                error !== null &&
                'code' in error &&
                error.code === 'ENOENT') {
                return [];
            }
            throw error;
        }
    }
    async resolveChannelIds(entries, apiKey) {
        const resolved = await Promise.all(entries.map(async (entry) => {
            const normalized = entry.trim();
            if (/^UC[\w-]{20,}$/.test(normalized)) {
                return normalized;
            }
            const handle = normalized.replace(/^@/, '');
            return this.resolveChannelIdFromHandle(handle, apiKey);
        }));
        return Array.from(new Set(resolved.filter((channelId) => Boolean(channelId))));
    }
    async resolveChannelIdFromHandle(handle, apiKey) {
        if (!handle) {
            return null;
        }
        const cacheKey = handle.toLowerCase();
        const cached = this.channelIdCache.get(cacheKey);
        if (cached) {
            return cached;
        }
        const url = new URL('https://www.googleapis.com/youtube/v3/channels');
        url.searchParams.set('part', 'id');
        url.searchParams.set('forHandle', handle);
        url.searchParams.set('key', apiKey);
        const response = await fetch(url);
        if (!response.ok) {
            const text = await response.text();
            throw new common_1.BadGatewayException(`YouTube channel lookup failed (${response.status}): ${text}`);
        }
        const payload = (await response.json());
        const channelId = payload.items?.[0]?.id;
        if (!channelId) {
            return null;
        }
        this.channelIdCache.set(cacheKey, channelId);
        return channelId;
    }
    get whitelistPath() {
        return (this.configService.get('YOUTUBE_CHANNEL_WHITELIST_FILE') ??
            (0, node_path_1.resolve)(process.cwd(), 'data/raw/youtube-channel-whitelist.txt'));
    }
    get preferredPath() {
        return (this.configService.get('YOUTUBE_CHANNEL_PREFERRED_FILE') ??
            (0, node_path_1.resolve)(process.cwd(), 'data/raw/youtube-channel-preferred.txt'));
    }
    get preferredChannelBonus() {
        const configuredRaw = this.configService.get('YOUTUBE_CHANNEL_PREFERRED_BONUS');
        const configured = Number(configuredRaw);
        if (Number.isFinite(configured) && configured > 0) {
            return configured;
        }
        return 35;
    }
    async fetchVideoDurations(videoIds, apiKey) {
        if (!videoIds.length) {
            return new Map();
        }
        const url = new URL('https://www.googleapis.com/youtube/v3/videos');
        url.searchParams.set('part', 'contentDetails');
        url.searchParams.set('id', videoIds.join(','));
        url.searchParams.set('key', apiKey);
        const response = await fetch(url);
        if (!response.ok) {
            const text = await response.text();
            throw new common_1.BadGatewayException(`YouTube videos lookup failed (${response.status}): ${text}`);
        }
        const payload = (await response.json());
        const result = new Map();
        for (const item of payload.items ?? []) {
            if (!item.id) {
                continue;
            }
            result.set(item.id, item.contentDetails?.duration ?? '');
        }
        return result;
    }
    parseIso8601DurationToSeconds(duration) {
        const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(duration);
        if (!match) {
            return 0;
        }
        const hours = Number(match[1] ?? 0);
        const minutes = Number(match[2] ?? 0);
        const seconds = Number(match[3] ?? 0);
        return hours * 3600 + minutes * 60 + seconds;
    }
    formatDuration(totalSeconds) {
        if (totalSeconds <= 0) {
            return '';
        }
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        if (hours > 0) {
            return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
        return `${minutes}:${String(seconds).padStart(2, '0')}`;
    }
    getShortsMaxSeconds() {
        const configuredRaw = this.configService.get('YOUTUBE_SHORTS_MAX_SECONDS');
        const configured = Number(configuredRaw);
        if (Number.isFinite(configured) && configured > 0) {
            return configured;
        }
        return 60;
    }
};
exports.YoutubeService = YoutubeService;
exports.YoutubeService = YoutubeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], YoutubeService);
//# sourceMappingURL=youtube.service.js.map
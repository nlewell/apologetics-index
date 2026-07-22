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
exports.ContentSpreadsheetService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const crypto_1 = require("crypto");
const sync_1 = require("csv-parse/sync");
const prisma_service_1 = require("./prisma.service");
const CSV_COLUMNS = [
    'generalTopic',
    'subtopic',
    'charge',
    'searchQuery',
    'videoId',
    'videoTitle',
    'videoDescription',
    'channelTitle',
    'channelId',
    'publishedAt',
    'thumbnailUrl',
    'videoUrl',
    'duration',
    'durationSeconds',
    'isShort',
    'startTimestamp',
    'keepOnRefresh',
    'pinOrder',
    'youtubeItemJson',
];
let ContentSpreadsheetService = class ContentSpreadsheetService {
    prisma;
    configService;
    constructor(prisma, configService) {
        this.prisma = prisma;
        this.configService = configService;
    }
    async exportCsv() {
        const indexRows = await this.prisma.apologeticIndexItem.findMany({
            orderBy: [{ generalTopic: 'asc' }, { subtopic: 'asc' }, { id: 'asc' }],
        });
        const indexedSearchRows = await this.prisma.youtubeVideoIndex.findMany({
            orderBy: [{ query: 'asc' }, { refreshedAt: 'desc' }],
            select: {
                query: true,
                items: true,
            },
        });
        const pinnedRows = await this.prisma.youtubeVideoMetadata.findMany({
            where: { keepOnRefresh: true },
            orderBy: [{ sourceKey: 'asc' }, { query: 'asc' }, { pinOrder: 'asc' }, { updatedAt: 'asc' }, { videoId: 'asc' }],
        });
        const indexedItemsByQuery = new Map();
        for (const row of indexedSearchRows) {
            const parsedItems = Array.isArray(row.items)
                ? row.items
                    .map((item) => this.coerceYoutubeSearchResult(item))
                    .filter((item) => item !== null)
                : [];
            indexedItemsByQuery.set(this.normalizeQueryKey(row.query), parsedItems);
        }
        const pinnedRowsByQuery = new Map();
        for (const row of pinnedRows) {
            const normalizedQuery = this.normalizeQueryKey(row.query);
            const existing = pinnedRowsByQuery.get(normalizedQuery) ?? [];
            existing.push(row);
            pinnedRowsByQuery.set(normalizedQuery, existing);
        }
        const exportRows = [];
        for (const indexRow of indexRows) {
            const searchQuery = this.buildTopicPathQuery(indexRow.generalTopic, indexRow.subtopic, indexRow.charge);
            const normalizedQuery = this.normalizeQueryKey(searchQuery);
            const pinnedForQuery = pinnedRowsByQuery.get(normalizedQuery) ?? [];
            const indexedItems = indexedItemsByQuery.get(normalizedQuery) ?? [];
            const mergedByVideoId = new Map();
            for (const item of indexedItems) {
                mergedByVideoId.set(item.videoId, { item, source: 'search_index' });
            }
            for (const pinnedRow of pinnedForQuery) {
                const pinnedItem = this.coerceYoutubeSearchResult(pinnedRow.item);
                if (!pinnedItem) {
                    continue;
                }
                const existing = mergedByVideoId.get(pinnedItem.videoId);
                mergedByVideoId.set(pinnedItem.videoId, {
                    item: {
                        ...(existing?.item ?? pinnedItem),
                        ...pinnedItem,
                        startTimestamp: pinnedRow.startTimestamp ?? pinnedItem.startTimestamp ?? null,
                        keepOnRefresh: pinnedRow.keepOnRefresh,
                        sourceKey: pinnedRow.sourceKey ?? pinnedItem.sourceKey ?? '',
                        pinOrder: pinnedRow.pinOrder ?? pinnedItem.pinOrder ?? 0,
                    },
                    source: 'pinned_override',
                });
            }
            const mergedItems = Array.from(mergedByVideoId.values()).sort((a, b) => {
                if (a.item.keepOnRefresh !== b.item.keepOnRefresh) {
                    return a.item.keepOnRefresh ? -1 : 1;
                }
                if (a.item.keepOnRefresh && b.item.keepOnRefresh && a.item.pinOrder !== b.item.pinOrder) {
                    return a.item.pinOrder - b.item.pinOrder;
                }
                return a.item.title.localeCompare(b.item.title);
            });
            if (mergedItems.length === 0) {
                exportRows.push(this.buildExportRow(indexRow, searchQuery, null, 'search_index'));
                continue;
            }
            for (const merged of mergedItems) {
                exportRows.push(this.buildExportRow(indexRow, searchQuery, merged.item, merged.source));
            }
        }
        const csv = this.stringifyCsv(exportRows);
        return {
            filename: `apologetics-index-export-${this.timestampSlug()}.csv`,
            generatedAt: new Date().toISOString(),
            rowCount: exportRows.length,
            csv,
        };
    }
    async importCsv(csv) {
        const trimmed = csv.trim();
        if (!trimmed) {
            throw new common_1.BadRequestException('CSV content is empty.');
        }
        const rows = (0, sync_1.parse)(trimmed, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
            relax_column_count: true,
        });
        if (!rows.length) {
            throw new common_1.BadRequestException('CSV content does not contain any rows.');
        }
        const normalizedRows = rows.map((row, index) => ({
            rowNumber: index + 2,
            row: this.normalizeImportRow(row),
        }));
        const validationErrors = [];
        for (const entry of normalizedRows) {
            const row = entry.row;
            const resolvedVideoId = this.extractVideoId(row.videoId, row.videoUrl);
            if (!row.videoId && !row.videoUrl) {
                validationErrors.push(`Row ${entry.rowNumber}: provide either videoId or videoUrl.`);
            }
            else if (!resolvedVideoId) {
                validationErrors.push(`Row ${entry.rowNumber}: unable to resolve a YouTube video ID from provided videoId/videoUrl.`);
            }
            const derivedQuery = this.buildTopicPathQuery(row.generalTopic, row.subtopic, row.charge);
            if (!row.searchQuery && !derivedQuery) {
                validationErrors.push(`Row ${entry.rowNumber}: provide searchQuery or topic/subtopic/charge so a query can be derived.`);
            }
        }
        if (validationErrors.length > 0) {
            throw new common_1.BadRequestException(`Import validation failed:\n${validationErrors.join('\n')}`);
        }
        const groupedRows = new Map();
        for (const entry of normalizedRows) {
            const row = entry.row;
            const groupKey = this.buildGroupKey(row.generalTopic, row.subtopic, row.charge);
            const rowsForKey = groupedRows.get(groupKey) ?? [];
            rowsForKey.push(entry);
            groupedRows.set(groupKey, rowsForKey);
        }
        let indexItemsCreated = 0;
        let indexItemsUpdated = 0;
        let pinnedRowsReplaced = 0;
        let pinnedRowsImported = 0;
        let metadataHydrated = 0;
        for (const [, rowsForKey] of groupedRows.entries()) {
            const firstRow = rowsForKey[0].row;
            const existingIndexItem = await this.prisma.apologeticIndexItem.findFirst({
                where: {
                    generalTopic: firstRow.generalTopic,
                    subtopic: firstRow.subtopic,
                    charge: firstRow.charge,
                },
                orderBy: { id: 'asc' },
            });
            const sourceKey = existingIndexItem?.sourceKey ?? `manual-${(0, crypto_1.randomUUID)()}`;
            const indexData = {
                sourceKey,
                generalTopic: firstRow.generalTopic,
                subtopic: firstRow.subtopic,
                charge: firstRow.charge,
            };
            if (existingIndexItem) {
                await this.prisma.apologeticIndexItem.update({
                    where: { id: existingIndexItem.id },
                    data: {
                        generalTopic: firstRow.generalTopic,
                        subtopic: firstRow.subtopic,
                        charge: firstRow.charge,
                    },
                });
            }
            else {
                await this.prisma.apologeticIndexItem.create({
                    data: indexData,
                });
            }
            if (existingIndexItem) {
                indexItemsUpdated += 1;
            }
            else {
                indexItemsCreated += 1;
            }
            const videoRows = rowsForKey.filter((entry) => entry.row.videoId || entry.row.videoUrl);
            const searchQuery = firstRow.searchQuery ||
                this.buildTopicPathQuery(firstRow.generalTopic, firstRow.subtopic, firstRow.charge);
            const normalizedSearchQuery = this.normalizeQueryKey(searchQuery);
            const deleted = await this.prisma.youtubeVideoMetadata.deleteMany({
                where: {
                    query: {
                        in: Array.from(new Set([searchQuery, normalizedSearchQuery])),
                    },
                },
            });
            pinnedRowsReplaced += deleted.count;
            for (const entry of videoRows) {
                const row = entry.row;
                const searchQuery = row.searchQuery ||
                    this.buildTopicPathQuery(row.generalTopic, row.subtopic, row.charge);
                const normalizedSearchQuery = this.normalizeQueryKey(searchQuery);
                const resolvedVideoId = this.extractVideoId(row.videoId, row.videoUrl);
                if (!normalizedSearchQuery || !resolvedVideoId) {
                    continue;
                }
                let hydratedVideo;
                try {
                    hydratedVideo = await this.fetchVideoMetadataById(resolvedVideoId);
                }
                catch (error) {
                    throw new common_1.BadRequestException(`Row ${entry.rowNumber}: failed to hydrate metadata for video ${resolvedVideoId}. ${this.getErrorMessage(error)}`);
                }
                const importedItem = this.rowToYoutubeSearchResult(row, hydratedVideo);
                const pinOrder = Number.isFinite(row.pinOrder ?? NaN) ? Number(row.pinOrder) : 0;
                await this.prisma.youtubeVideoMetadata.create({
                    data: {
                        sourceKey,
                        query: normalizedSearchQuery,
                        videoId: resolvedVideoId,
                        item: importedItem,
                        startTimestamp: row.startTimestamp,
                        keepOnRefresh: true,
                        pinOrder,
                    },
                });
                pinnedRowsImported += 1;
                metadataHydrated += 1;
            }
        }
        return {
            generatedAt: new Date().toISOString(),
            rowsRead: normalizedRows.length,
            indexItemsCreated,
            indexItemsUpdated,
            pinnedRowsReplaced,
            pinnedRowsImported,
            metadataHydrated,
        };
    }
    buildExportRow(indexRow, searchQuery, videoItem, _source) {
        return {
            generalTopic: indexRow.generalTopic,
            subtopic: indexRow.subtopic,
            charge: indexRow.charge,
            searchQuery,
            videoId: videoItem?.videoId ?? null,
            videoTitle: videoItem?.title ?? null,
            videoDescription: videoItem?.description ?? null,
            channelTitle: videoItem?.channelTitle ?? null,
            channelId: videoItem?.channelId ?? null,
            publishedAt: videoItem?.publishedAt ?? null,
            thumbnailUrl: videoItem?.thumbnailUrl ?? null,
            videoUrl: videoItem?.videoUrl ?? null,
            duration: videoItem?.duration ?? null,
            durationSeconds: videoItem?.durationSeconds ?? null,
            isShort: videoItem?.isShort ?? null,
            startTimestamp: videoItem?.startTimestamp ?? null,
            keepOnRefresh: videoItem?.keepOnRefresh ?? null,
            pinOrder: videoItem?.pinOrder ?? null,
            youtubeItemJson: videoItem ? JSON.stringify(videoItem) : null,
        };
    }
    normalizeImportRow(row) {
        const cleanedText = (value) => {
            const trimmed = (value ?? '').trim();
            return trimmed.length > 0 ? trimmed : null;
        };
        const cleanedBoolean = (value) => {
            if (value === undefined) {
                return null;
            }
            const normalized = value.trim().toLowerCase();
            if (!normalized) {
                return null;
            }
            if (['true', '1', 'yes', 'y'].includes(normalized)) {
                return true;
            }
            if (['false', '0', 'no', 'n'].includes(normalized)) {
                return false;
            }
            return null;
        };
        const cleanedNumber = (value) => {
            const trimmed = (value ?? '').trim();
            if (!trimmed) {
                return null;
            }
            const parsed = Number(trimmed);
            return Number.isFinite(parsed) ? parsed : null;
        };
        return {
            generalTopic: cleanedText(row.generalTopic),
            subtopic: cleanedText(row.subtopic),
            charge: cleanedText(row.charge),
            searchQuery: cleanedText(row.searchQuery) ?? '',
            videoId: cleanedText(row.videoId),
            videoTitle: cleanedText(row.videoTitle),
            videoDescription: cleanedText(row.videoDescription),
            channelTitle: cleanedText(row.channelTitle),
            channelId: cleanedText(row.channelId),
            publishedAt: cleanedText(row.publishedAt),
            thumbnailUrl: cleanedText(row.thumbnailUrl),
            videoUrl: cleanedText(row.videoUrl),
            duration: cleanedText(row.duration),
            durationSeconds: cleanedNumber(row.durationSeconds),
            isShort: cleanedBoolean(row.isShort),
            startTimestamp: cleanedText(row.startTimestamp),
            keepOnRefresh: cleanedBoolean(row.keepOnRefresh),
            pinOrder: cleanedNumber(row.pinOrder),
            youtubeItemJson: cleanedText(row.youtubeItemJson),
        };
    }
    rowToYoutubeSearchResult(row, hydratedVideo) {
        const videoId = hydratedVideo.videoId;
        const videoUrl = hydratedVideo.videoUrl;
        return {
            sourceKey: '',
            videoId,
            title: hydratedVideo.title,
            description: hydratedVideo.description,
            channelTitle: hydratedVideo.channelTitle,
            channelId: hydratedVideo.channelId,
            publishedAt: hydratedVideo.publishedAt,
            thumbnailUrl: hydratedVideo.thumbnailUrl,
            videoUrl,
            duration: hydratedVideo.duration,
            durationSeconds: hydratedVideo.durationSeconds,
            isShort: hydratedVideo.isShort,
            startTimestamp: row.startTimestamp ?? null,
            keepOnRefresh: true,
            pinOrder: row.pinOrder ?? 0,
        };
    }
    coerceYoutubeSearchResult(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return null;
        }
        const row = value;
        if (!row.videoId) {
            return null;
        }
        return {
            sourceKey: row.sourceKey ?? '',
            videoId: row.videoId,
            title: row.title ?? '',
            description: row.description ?? '',
            channelTitle: row.channelTitle ?? '',
            channelId: row.channelId ?? '',
            publishedAt: row.publishedAt ?? '',
            thumbnailUrl: row.thumbnailUrl ?? null,
            videoUrl: row.videoUrl ?? `https://www.youtube.com/watch?v=${row.videoId}`,
            duration: row.duration ?? '',
            durationSeconds: Number(row.durationSeconds ?? 0),
            isShort: Boolean(row.isShort ?? false),
            startTimestamp: row.startTimestamp ?? null,
            keepOnRefresh: Boolean(row.keepOnRefresh ?? false),
            pinOrder: Number(row.pinOrder ?? 0),
        };
    }
    stringifyCsv(rows) {
        const header = CSV_COLUMNS.join(',');
        const lines = rows.map((row) => CSV_COLUMNS.map((column) => this.escapeCsvValue(row[column])).join(','));
        return [header, ...lines].join('\n');
    }
    escapeCsvValue(value) {
        if (value === null || value === undefined) {
            return '';
        }
        const text = String(value);
        if (!/[",\n\r]/.test(text)) {
            return text;
        }
        return `"${text.replace(/"/g, '""')}"`;
    }
    buildTopicPathQuery(topicValue, subtopicValue, chargeValue) {
        const normalizeSegment = (value) => (value ?? '').replace(/\s+/g, ' ').trim();
        const topic = normalizeSegment(topicValue);
        const subtopic = normalizeSegment(subtopicValue);
        const charge = normalizeSegment(chargeValue);
        if (charge) {
            return [topic, subtopic, charge].filter(Boolean).join(' ');
        }
        if (subtopic) {
            return [topic, subtopic].filter(Boolean).join(' ');
        }
        return topic;
    }
    buildGroupKey(topicValue, subtopicValue, chargeValue) {
        const normalize = (value) => (value ?? '').trim().toLowerCase();
        return [normalize(topicValue), normalize(subtopicValue), normalize(chargeValue)].join('||');
    }
    normalizeQueryKey(query) {
        return query
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    decodeHtmlEntities(value) {
        return value
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>');
    }
    extractVideoId(videoIdValue, videoUrlValue) {
        const explicit = (videoIdValue ?? '').trim();
        if (explicit) {
            return explicit;
        }
        const rawUrl = (videoUrlValue ?? '').trim();
        if (!rawUrl) {
            return null;
        }
        try {
            const url = new URL(rawUrl);
            const host = url.hostname.toLowerCase();
            if (host.includes('youtu.be')) {
                const segment = url.pathname.split('/').filter(Boolean)[0] ?? '';
                return segment || null;
            }
            const watchId = url.searchParams.get('v');
            if (watchId) {
                return watchId;
            }
            const pathParts = url.pathname.split('/').filter(Boolean);
            const shortsIndex = pathParts.findIndex((part) => part === 'shorts');
            if (shortsIndex >= 0 && pathParts[shortsIndex + 1]) {
                return pathParts[shortsIndex + 1];
            }
            const embedIndex = pathParts.findIndex((part) => part === 'embed');
            if (embedIndex >= 0 && pathParts[embedIndex + 1]) {
                return pathParts[embedIndex + 1];
            }
            return null;
        }
        catch {
            return null;
        }
    }
    async fetchVideoMetadataById(videoId) {
        const apiKey = this.configService.get('YOUTUBE_API_KEY');
        if (!apiKey) {
            throw new common_1.BadRequestException('YOUTUBE_API_KEY is required to hydrate imported video metadata.');
        }
        const url = new URL('https://www.googleapis.com/youtube/v3/videos');
        url.searchParams.set('part', 'snippet,contentDetails');
        url.searchParams.set('id', videoId);
        url.searchParams.set('key', apiKey);
        const response = await fetch(url);
        if (!response.ok) {
            const text = await response.text();
            throw new common_1.BadRequestException(`YouTube metadata lookup failed (${response.status}) for ${videoId}: ${text}`);
        }
        const payload = (await response.json());
        const item = payload.items?.[0];
        const resolvedId = item?.id ?? videoId;
        const snippet = item?.snippet;
        const durationRaw = item?.contentDetails?.duration ?? '';
        const durationSeconds = this.parseIso8601DurationToSeconds(durationRaw);
        return {
            videoId: resolvedId,
            title: this.decodeHtmlEntities(snippet?.title ?? ''),
            description: this.decodeHtmlEntities(snippet?.description ?? ''),
            channelTitle: this.decodeHtmlEntities(snippet?.channelTitle ?? ''),
            channelId: snippet?.channelId ?? '',
            publishedAt: snippet?.publishedAt ?? '',
            thumbnailUrl: snippet?.thumbnails?.medium?.url ??
                snippet?.thumbnails?.high?.url ??
                snippet?.thumbnails?.default?.url ??
                null,
            videoUrl: `https://www.youtube.com/watch?v=${resolvedId}`,
            duration: this.formatDuration(durationSeconds),
            durationSeconds,
            isShort: durationSeconds > 0 && durationSeconds <= 60,
        };
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
    getErrorMessage(error) {
        if (error instanceof Error && error.message) {
            return error.message;
        }
        return 'Unknown error.';
    }
    timestampSlug() {
        return new Date().toISOString().replace(/[:.]/g, '-');
    }
};
exports.ContentSpreadsheetService = ContentSpreadsheetService;
exports.ContentSpreadsheetService = ContentSpreadsheetService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService])
], ContentSpreadsheetService);
//# sourceMappingURL=content-spreadsheet.service.js.map
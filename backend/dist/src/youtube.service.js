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
const prisma_service_1 = require("./prisma.service");
let YoutubeService = class YoutubeService {
    configService;
    prismaService;
    memoryChannelIdCache = new Map();
    commentsAnalysisCache = new Map();
    shortsMaxSeconds;
    cacheTtlMs = 7 * 24 * 60 * 60 * 1000;
    constructor(configService, prismaService) {
        this.configService = configService;
        this.prismaService = prismaService;
        this.shortsMaxSeconds = this.getShortsMaxSeconds();
    }
    async getCommentsAnalysis(input) {
        const videoId = input.videoId.trim();
        if (!videoId) {
            throw new common_1.BadRequestException('videoId is required.');
        }
        const boundedMaxComments = Number.isFinite(input.maxComments)
            ? Math.min(250, Math.max(10, Math.trunc(input.maxComments ?? 120)))
            : 120;
        const normalizedAuthorChannelId = input.authorChannelId?.trim() || null;
        const generateIfMissing = input.generateIfMissing ?? true;
        const cacheKey = this.buildCommentsAnalysisCacheKey(videoId, normalizedAuthorChannelId, boundedMaxComments);
        if (!input.forceRefresh) {
            const cached = await this.getCachedCommentsAnalysis(cacheKey);
            if (cached) {
                return cached;
            }
            const persisted = await this.getPersistedCommentsAnalysis(cacheKey);
            if (persisted) {
                this.setCachedCommentsAnalysis(cacheKey, persisted);
                return persisted;
            }
        }
        if (!generateIfMissing) {
            return {
                videoId,
                analyzedCommentCount: 0,
                sampleCommentCount: 0,
                authorChannelIdFilter: normalizedAuthorChannelId,
                cacheStatus: 'miss',
                cachedAt: null,
                overallSummary: 'Comment summary is not cached yet. Open this top match to generate and cache it.',
                confidenceScore: 0,
                confidenceLevel: 'low',
                disagreementScore: 1,
                arguments: [],
            };
        }
        const apiKey = this.configService.get('YOUTUBE_API_KEY');
        if (!apiKey) {
            throw new common_1.ServiceUnavailableException('YOUTUBE_API_KEY is not configured on the server');
        }
        const comments = await this.fetchVideoComments(videoId, boundedMaxComments, apiKey);
        const filteredComments = normalizedAuthorChannelId
            ? comments.filter((comment) => comment.authorChannelId === normalizedAuthorChannelId)
            : comments;
        if (!filteredComments.length) {
            const response = {
                videoId,
                analyzedCommentCount: 0,
                sampleCommentCount: comments.length,
                authorChannelIdFilter: normalizedAuthorChannelId,
                cacheStatus: 'generated',
                cachedAt: new Date().toISOString(),
                overallSummary: 'No comments matched the selected filter.',
                confidenceScore: 0,
                confidenceLevel: 'low',
                disagreementScore: 1,
                arguments: [],
            };
            this.setCachedCommentsAnalysis(cacheKey, response);
            await this.setPersistedCommentsAnalysis(cacheKey, videoId, normalizedAuthorChannelId, boundedMaxComments, response);
            return response;
        }
        const aiPayload = await this.analyzeCommentsWithAi(videoId, filteredComments);
        const response = this.buildCommentsAnalysisResponse(videoId, comments.length, normalizedAuthorChannelId, filteredComments, aiPayload);
        this.setCachedCommentsAnalysis(cacheKey, response);
        await this.setPersistedCommentsAnalysis(cacheKey, videoId, normalizedAuthorChannelId, boundedMaxComments, response);
        return response;
    }
    async precacheTopMatchComments(input) {
        const query = input.query.trim();
        if (!query) {
            throw new common_1.BadRequestException('query is required.');
        }
        const maxResults = Number.isFinite(input.maxResults)
            ? Math.min(25, Math.max(1, Math.trunc(input.maxResults ?? 5)))
            : 5;
        const maxComments = Number.isFinite(input.maxComments)
            ? Math.min(250, Math.max(10, Math.trunc(input.maxComments ?? 120)))
            : 120;
        const searchResult = await this.search(query, maxResults, false, false);
        const pinnedItems = searchResult.items
            .filter((video) => video.keepOnRefresh)
            .sort((a, b) => a.pinOrder - b.pinOrder || a.title.localeCompare(b.title));
        const topMatchItems = pinnedItems.length > 0 ? pinnedItems : searchResult.items.slice(0, 1);
        let generatedCount = 0;
        let hitCount = 0;
        for (const video of topMatchItems) {
            const analysis = await this.getCommentsAnalysis({
                videoId: video.videoId,
                maxComments,
                generateIfMissing: true,
                forceRefresh: false,
            });
            if (analysis.cacheStatus === 'generated') {
                generatedCount += 1;
            }
            else if (analysis.cacheStatus === 'hit') {
                hitCount += 1;
            }
        }
        return {
            query,
            maxResults,
            maxComments,
            topMatchVideoIds: topMatchItems.map((video) => video.videoId),
            generatedCount,
            hitCount,
        };
    }
    async getChannelCommentsSummary(input) {
        const channelId = input.channelId.trim();
        const topicQuery = input.topicQuery.trim();
        if (!channelId) {
            throw new common_1.BadRequestException('channelId is required.');
        }
        if (!topicQuery) {
            throw new common_1.BadRequestException('topicQuery is required.');
        }
        const maxVideos = Number.isFinite(input.maxVideos)
            ? Math.min(10, Math.max(1, Math.trunc(input.maxVideos ?? 3)))
            : 3;
        const maxCommentsPerVideo = Number.isFinite(input.maxCommentsPerVideo)
            ? Math.min(250, Math.max(10, Math.trunc(input.maxCommentsPerVideo ?? 100)))
            : 100;
        const apiKey = this.configService.get('YOUTUBE_API_KEY');
        if (!apiKey) {
            throw new common_1.ServiceUnavailableException('YOUTUBE_API_KEY is not configured on the server');
        }
        const videoIds = await this.fetchChannelVideoIdsForTopic(channelId, topicQuery, maxVideos, apiKey);
        if (!videoIds.length) {
            return {
                channelId,
                topicQuery,
                videosAnalyzed: 0,
                totalCommentsAnalyzed: 0,
                overallSummary: 'No matching videos found for this channel and topic query.',
                confidenceScore: 0,
                confidenceLevel: 'low',
                disagreementScore: 1,
                topArguments: [],
                videoBreakdown: [],
            };
        }
        const analyses = await Promise.all(videoIds.map((videoId) => this.getCommentsAnalysis({
            videoId,
            maxComments: maxCommentsPerVideo,
            forceRefresh: false,
        })));
        const nonEmptyAnalyses = analyses.filter((analysis) => analysis.analyzedCommentCount > 0);
        if (!nonEmptyAnalyses.length) {
            return {
                channelId,
                topicQuery,
                videosAnalyzed: analyses.length,
                totalCommentsAnalyzed: 0,
                overallSummary: 'No comments were available to analyze for the selected videos.',
                confidenceScore: 0,
                confidenceLevel: 'low',
                disagreementScore: 1,
                topArguments: [],
                videoBreakdown: analyses.map((analysis) => ({
                    videoId: analysis.videoId,
                    analyzedCommentCount: analysis.analyzedCommentCount,
                    confidenceScore: analysis.confidenceScore,
                })),
            };
        }
        const aggregateMap = new Map();
        let totalCommentsAnalyzed = 0;
        for (const analysis of nonEmptyAnalyses) {
            totalCommentsAnalyzed += analysis.analyzedCommentCount;
            for (const argument of analysis.arguments) {
                const key = this.normalizeText(argument.label);
                const entry = aggregateMap.get(key) ?? {
                    totalSupport: 0,
                    weightedStrengthSum: 0,
                    whyStrong: [],
                    whyWeak: [],
                    summaries: [],
                    examples: [],
                };
                entry.totalSupport += argument.supportCount;
                entry.weightedStrengthSum += argument.strengthScore * argument.supportCount;
                entry.whyStrong.push(...argument.whyStrong);
                entry.whyWeak.push(...argument.whyWeak);
                if (argument.summary) {
                    entry.summaries.push(argument.summary);
                }
                entry.examples.push(...argument.exampleComments);
                aggregateMap.set(key, entry);
            }
        }
        const topArguments = Array.from(aggregateMap.entries())
            .map(([key, value]) => {
            const supportPct = totalCommentsAnalyzed
                ? Number(((value.totalSupport / totalCommentsAnalyzed) * 100).toFixed(1))
                : 0;
            const strengthScore = value.totalSupport
                ? this.clamp01(value.weightedStrengthSum / value.totalSupport)
                : 0;
            return {
                label: this.restoreDisplayLabel(key),
                summary: value.summaries[0] ?? 'No summary provided.',
                supportCount: value.totalSupport,
                supportPct,
                engagementSupportScore: Number(value.totalSupport.toFixed(2)),
                strengthScore: Number(strengthScore.toFixed(2)),
                strength: strengthScore >= 0.7
                    ? 'strong'
                    : strengthScore >= 0.4
                        ? 'medium'
                        : 'weak',
                whyStrong: Array.from(new Set(value.whyStrong)).slice(0, 4),
                whyWeak: Array.from(new Set(value.whyWeak)).slice(0, 4),
                exampleComments: Array.from(new Set(value.examples)).slice(0, 3),
            };
        })
            .sort((a, b) => b.supportCount - a.supportCount)
            .slice(0, 8);
        const confidence = this.computeConfidenceMetrics(totalCommentsAnalyzed, topArguments.map((argument) => argument.supportCount));
        return {
            channelId,
            topicQuery,
            videosAnalyzed: analyses.length,
            totalCommentsAnalyzed,
            overallSummary: this.buildChannelSummaryText(topicQuery, topArguments),
            confidenceScore: confidence.confidenceScore,
            confidenceLevel: confidence.confidenceLevel,
            disagreementScore: confidence.disagreementScore,
            topArguments,
            videoBreakdown: analyses.map((analysis) => ({
                videoId: analysis.videoId,
                analyzedCommentCount: analysis.analyzedCommentCount,
                confidenceScore: analysis.confidenceScore,
            })),
        };
    }
    async listWhitelistEntries() {
        await this.ensureWhitelistSeededFromFile();
        const rows = await this.prismaService.youtubeChannelWhitelistEntry.findMany({
            orderBy: [{ isEnabled: 'desc' }, { identifier: 'asc' }],
        });
        return rows.map((row) => ({
            id: row.id,
            entry: row.identifier,
            isEnabled: row.isEnabled,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
        }));
    }
    async addWhitelistEntry(entry) {
        const normalized = this.normalizeWhitelistEntry(entry);
        if (!normalized) {
            throw new common_1.BadRequestException('Entry must be a channel ID or handle.');
        }
        const existing = await this.prismaService.youtubeChannelWhitelistEntry.findUnique({
            where: { identifier: normalized },
        });
        if (existing) {
            throw new common_1.BadRequestException('Channel is already in the whitelist.');
        }
        const row = await this.prismaService.youtubeChannelWhitelistEntry.create({
            data: { identifier: normalized, isEnabled: true },
        });
        return {
            id: row.id,
            entry: row.identifier,
            isEnabled: row.isEnabled,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
        };
    }
    async updateAllWhitelistEntries(isEnabled) {
        const result = await this.prismaService.youtubeChannelWhitelistEntry.updateMany({
            data: { isEnabled },
        });
        return { updated: result.count };
    }
    async updateWhitelistEntry(id, isEnabled) {
        try {
            const row = await this.prismaService.youtubeChannelWhitelistEntry.update({
                where: { id },
                data: { isEnabled },
            });
            return {
                id: row.id,
                entry: row.identifier,
                isEnabled: row.isEnabled,
                createdAt: row.createdAt.toISOString(),
                updatedAt: row.updatedAt.toISOString(),
            };
        }
        catch (error) {
            if (typeof error === 'object' &&
                error !== null &&
                'code' in error &&
                error.code === 'P2025') {
                throw new common_1.NotFoundException('Whitelist entry not found.');
            }
            throw error;
        }
    }
    async listRecentQueries(limit = 10) {
        const boundedLimit = Number.isFinite(limit)
            ? Math.min(25, Math.max(1, Math.trunc(limit)))
            : 10;
        const [recentVideoIndexRows, recentMetadataRows] = await Promise.all([
            this.prismaService.youtubeVideoIndex.findMany({
                orderBy: { refreshedAt: 'desc' },
                take: boundedLimit,
                select: { query: true },
            }),
            this.prismaService.youtubeVideoMetadata.findMany({
                orderBy: { updatedAt: 'desc' },
                take: boundedLimit,
                select: { query: true },
            }),
        ]);
        const uniqueQueries = new Set();
        for (const row of recentVideoIndexRows) {
            const normalized = row.query.trim();
            if (normalized) {
                uniqueQueries.add(normalized);
            }
            if (uniqueQueries.size >= boundedLimit) {
                break;
            }
        }
        if (uniqueQueries.size < boundedLimit) {
            for (const row of recentMetadataRows) {
                const normalized = row.query.trim();
                if (normalized) {
                    uniqueQueries.add(normalized);
                }
                if (uniqueQueries.size >= boundedLimit) {
                    break;
                }
            }
        }
        return {
            queries: Array.from(uniqueQueries).slice(0, boundedLimit),
        };
    }
    async search(query, maxResults = 5, debug = false, forceRefresh = false) {
        const normalizedQuery = query.trim();
        const cacheKey = this.normalizeQueryKey(query);
        if (!normalizedQuery) {
            return {
                query: normalizedQuery,
                maxResults,
                whitelist: {
                    sourceFile: this.whitelistPath,
                    configuredEntries: [],
                    resolvedChannelIds: [],
                },
                items: [],
            };
        }
        const cachedResponse = forceRefresh
            ? null
            : await this.getCachedSearchResponse(cacheKey);
        if (cachedResponse) {
            const cachedItems = await this.applySearchOverrides(cacheKey, cachedResponse.items, forceRefresh);
            return {
                ...cachedResponse,
                maxResults,
                items: cachedItems,
            };
        }
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
        const channelSearchResults = await Promise.all(resolvedChannelIds.map((channelId) => this.searchWithinChannel(query, cacheKey, channelId, perChannelMaxResults, apiKey)));
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
        const itemsWithMetadata = await this.applySearchOverrides(cacheKey, items, forceRefresh);
        const isDebugEnabled = debug && this.environment !== 'production';
        const response = {
            query: normalizedQuery,
            maxResults,
            whitelist: {
                sourceFile: this.whitelistPath,
                configuredEntries: whitelist,
                resolvedChannelIds,
            },
            items: itemsWithMetadata,
        };
        await this.saveSearchResponse(cacheKey, response);
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
    async fetchVideoComments(videoId, maxComments, apiKey) {
        const comments = [];
        let pageToken = null;
        while (comments.length < maxComments) {
            const url = new URL('https://www.googleapis.com/youtube/v3/commentThreads');
            url.searchParams.set('part', 'snippet');
            url.searchParams.set('videoId', videoId);
            url.searchParams.set('maxResults', String(Math.min(100, maxComments - comments.length)));
            url.searchParams.set('order', 'relevance');
            url.searchParams.set('textFormat', 'plainText');
            url.searchParams.set('key', apiKey);
            if (pageToken) {
                url.searchParams.set('pageToken', pageToken);
            }
            const response = await fetch(url);
            if (!response.ok) {
                const text = await response.text();
                throw new common_1.BadGatewayException(`YouTube comments request failed (${response.status}): ${text}`);
            }
            const payload = (await response.json());
            for (const item of payload.items ?? []) {
                const snippet = item.snippet?.topLevelComment?.snippet;
                if (!item.id || !snippet) {
                    continue;
                }
                const text = (snippet.textOriginal ?? snippet.textDisplay ?? '').trim();
                if (!text) {
                    continue;
                }
                comments.push({
                    id: item.id,
                    text,
                    likeCount: Number(snippet.likeCount ?? 0),
                    replyCount: Number(item.snippet?.totalReplyCount ?? 0),
                    authorDisplayName: snippet.authorDisplayName ?? 'Unknown',
                    authorChannelId: snippet.authorChannelId?.value ?? null,
                    publishedAt: snippet.publishedAt ?? '',
                });
                if (comments.length >= maxComments) {
                    break;
                }
            }
            pageToken = payload.nextPageToken ?? null;
            if (!pageToken) {
                break;
            }
        }
        return comments;
    }
    async analyzeCommentsWithAi(videoId, comments) {
        const openAiKey = this.configService.get('OPENAI_API_KEY');
        if (!openAiKey) {
            throw new common_1.ServiceUnavailableException('OPENAI_API_KEY is not configured on the server');
        }
        const model = this.configService.get('OPENAI_ANALYSIS_MODEL') ?? 'gpt-4.1-mini';
        const commentPayload = comments.map((comment) => ({
            id: comment.id,
            text: comment.text,
            likeCount: comment.likeCount,
            replyCount: comment.replyCount,
        }));
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${openAiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model,
                temperature: 0.2,
                response_format: { type: 'json_object' },
                messages: [
                    {
                        role: 'system',
                        content: 'You analyze YouTube comments and return strict JSON only. Group comments into concise argument labels, classify every comment to one label, and evaluate argument strength on a 0-1 scale.',
                    },
                    {
                        role: 'user',
                        content: [
                            `Video ID: ${videoId}`,
                            'Return JSON with keys: overallSummary (string), arguments (array), classifications (array).',
                            'arguments[] object keys: label (string), summary (string), strengthScore (number 0..1), whyStrong (string[]), whyWeak (string[]).',
                            'classifications[] object keys: commentId (string), label (string). Include one entry for each comment ID.',
                            'Keep argument labels short and specific (2-6 words).',
                            `Comments JSON: ${JSON.stringify(commentPayload)}`,
                        ].join('\n\n'),
                    },
                ],
            }),
        });
        if (!response.ok) {
            const text = await response.text();
            throw new common_1.BadGatewayException(`AI analysis request failed (${response.status}): ${text}`);
        }
        const payload = (await response.json());
        const content = payload.choices?.[0]?.message?.content;
        if (!content) {
            throw new common_1.BadGatewayException('AI analysis response was empty.');
        }
        try {
            return JSON.parse(content);
        }
        catch {
            throw new common_1.BadGatewayException('AI analysis returned invalid JSON.');
        }
    }
    buildCommentsAnalysisResponse(videoId, sampleCommentCount, authorChannelIdFilter, comments, aiPayload) {
        const fallbackLabel = 'Other';
        const commentById = new Map(comments.map((comment) => [comment.id, comment]));
        const definitionsByLabel = new Map();
        for (const argument of aiPayload.arguments ?? []) {
            const label = (argument.label ?? '').trim();
            if (!label) {
                continue;
            }
            definitionsByLabel.set(label, argument);
        }
        const countsByLabel = new Map();
        const weightedByLabel = new Map();
        const examplesByLabel = new Map();
        const seenCommentIds = new Set();
        for (const classification of aiPayload.classifications ?? []) {
            const commentId = (classification.commentId ?? '').trim();
            const mapped = commentById.get(commentId);
            if (!mapped || seenCommentIds.has(commentId)) {
                continue;
            }
            seenCommentIds.add(commentId);
            const labelCandidate = (classification.label ?? '').trim();
            const label = labelCandidate || fallbackLabel;
            countsByLabel.set(label, (countsByLabel.get(label) ?? 0) + 1);
            const weight = 1 + Math.min(20, Math.max(0, mapped.likeCount)) / 20;
            weightedByLabel.set(label, (weightedByLabel.get(label) ?? 0) + weight);
            const examples = examplesByLabel.get(label) ?? [];
            if (examples.length < 3) {
                examples.push(mapped.text);
            }
            examplesByLabel.set(label, examples);
        }
        for (const comment of comments) {
            if (seenCommentIds.has(comment.id)) {
                continue;
            }
            countsByLabel.set(fallbackLabel, (countsByLabel.get(fallbackLabel) ?? 0) + 1);
            const weight = 1 + Math.min(20, Math.max(0, comment.likeCount)) / 20;
            weightedByLabel.set(fallbackLabel, (weightedByLabel.get(fallbackLabel) ?? 0) + weight);
            const examples = examplesByLabel.get(fallbackLabel) ?? [];
            if (examples.length < 3) {
                examples.push(comment.text);
            }
            examplesByLabel.set(fallbackLabel, examples);
        }
        const analyzedCommentCount = comments.length;
        const argumentsList = Array.from(countsByLabel.entries())
            .map(([label, supportCount]) => {
            const def = definitionsByLabel.get(label);
            const strengthScore = this.clamp01(Number(def?.strengthScore ?? 0.5));
            const strength = strengthScore >= 0.7 ? 'strong' : strengthScore >= 0.4 ? 'medium' : 'weak';
            return {
                label,
                summary: def?.summary?.trim() || 'No summary provided.',
                supportCount,
                supportPct: Number(((supportCount / analyzedCommentCount) * 100).toFixed(1)),
                engagementSupportScore: Number((weightedByLabel.get(label) ?? supportCount).toFixed(2)),
                strengthScore: Number(strengthScore.toFixed(2)),
                strength,
                whyStrong: Array.isArray(def?.whyStrong)
                    ? def.whyStrong.filter((x) => typeof x === 'string').slice(0, 4)
                    : [],
                whyWeak: Array.isArray(def?.whyWeak)
                    ? def.whyWeak.filter((x) => typeof x === 'string').slice(0, 4)
                    : [],
                exampleComments: (examplesByLabel.get(label) ?? []).slice(0, 3),
            };
        })
            .sort((a, b) => b.supportCount - a.supportCount)
            .slice(0, 8);
        const confidence = this.computeConfidenceMetrics(analyzedCommentCount, argumentsList.map((argument) => argument.supportCount));
        return {
            videoId,
            analyzedCommentCount,
            sampleCommentCount,
            authorChannelIdFilter,
            cacheStatus: 'generated',
            cachedAt: new Date().toISOString(),
            overallSummary: aiPayload.overallSummary?.trim() || 'Summary unavailable.',
            confidenceScore: confidence.confidenceScore,
            confidenceLevel: confidence.confidenceLevel,
            disagreementScore: confidence.disagreementScore,
            arguments: argumentsList,
        };
    }
    clamp01(value) {
        if (!Number.isFinite(value)) {
            return 0;
        }
        return Math.max(0, Math.min(1, value));
    }
    buildCommentsAnalysisCacheKey(videoId, authorChannelId, maxComments) {
        return `${videoId}|${authorChannelId ?? 'all'}|${maxComments}`;
    }
    async getCachedCommentsAnalysis(cacheKey) {
        const entry = this.commentsAnalysisCache.get(cacheKey);
        if (!entry) {
            return null;
        }
        if (Date.now() > entry.expiresAt) {
            this.commentsAnalysisCache.delete(cacheKey);
            return null;
        }
        return {
            ...entry.response,
            cacheStatus: 'hit',
        };
    }
    setCachedCommentsAnalysis(cacheKey, response) {
        this.commentsAnalysisCache.set(cacheKey, {
            expiresAt: Date.now() + this.commentsAnalysisCacheTtlMs,
            response,
        });
    }
    async getPersistedCommentsAnalysis(cacheKey) {
        const row = await this.prismaService.youtubeCommentAnalysisCache.findUnique({
            where: { cacheKey },
        });
        if (!row) {
            return null;
        }
        const parsed = this.coerceCommentsAnalysisResponse(row.analysis);
        if (!parsed) {
            return null;
        }
        return {
            ...parsed,
            cacheStatus: 'hit',
            cachedAt: row.refreshedAt.toISOString(),
        };
    }
    async setPersistedCommentsAnalysis(cacheKey, videoId, authorChannelId, maxComments, response) {
        const refreshedAt = new Date();
        const toStore = {
            ...response,
            cacheStatus: 'generated',
            cachedAt: refreshedAt.toISOString(),
        };
        await this.prismaService.youtubeCommentAnalysisCache.upsert({
            where: { cacheKey },
            update: {
                videoId,
                authorChannelId,
                maxComments,
                analysis: toStore,
                analyzedComments: toStore.analyzedCommentCount,
                refreshedAt,
            },
            create: {
                cacheKey,
                videoId,
                authorChannelId,
                maxComments,
                analysis: toStore,
                analyzedComments: toStore.analyzedCommentCount,
                refreshedAt,
            },
        });
    }
    coerceCommentsAnalysisResponse(value) {
        if (!value || typeof value !== 'object') {
            return null;
        }
        const row = value;
        if (!row.videoId) {
            return null;
        }
        return {
            videoId: row.videoId,
            analyzedCommentCount: Number(row.analyzedCommentCount ?? 0),
            sampleCommentCount: Number(row.sampleCommentCount ?? 0),
            authorChannelIdFilter: row.authorChannelIdFilter ?? null,
            cacheStatus: row.cacheStatus ?? 'generated',
            cachedAt: row.cachedAt ?? null,
            overallSummary: row.overallSummary ?? 'Summary unavailable.',
            confidenceScore: Number(row.confidenceScore ?? 0),
            confidenceLevel: row.confidenceLevel ?? 'low',
            disagreementScore: Number(row.disagreementScore ?? 1),
            arguments: Array.isArray(row.arguments) ? row.arguments : [],
        };
    }
    async fetchChannelVideoIdsForTopic(channelId, topicQuery, maxVideos, apiKey) {
        const url = new URL('https://www.googleapis.com/youtube/v3/search');
        url.searchParams.set('part', 'snippet');
        url.searchParams.set('type', 'video');
        url.searchParams.set('order', 'relevance');
        url.searchParams.set('channelId', channelId);
        url.searchParams.set('q', topicQuery);
        url.searchParams.set('maxResults', String(maxVideos));
        url.searchParams.set('key', apiKey);
        const response = await fetch(url);
        if (!response.ok) {
            const text = await response.text();
            throw new common_1.BadGatewayException(`YouTube channel video search failed (${response.status}): ${text}`);
        }
        const payload = (await response.json());
        const ids = (payload.items ?? [])
            .map((item) => item.id?.videoId)
            .filter((videoId) => Boolean(videoId));
        return Array.from(new Set(ids));
    }
    computeConfidenceMetrics(analyzedCommentCount, supportCounts) {
        if (analyzedCommentCount <= 0 || supportCounts.length === 0) {
            return {
                confidenceScore: 0,
                confidenceLevel: 'low',
                disagreementScore: 1,
            };
        }
        const total = supportCounts.reduce((sum, value) => sum + Math.max(0, value), 0);
        const probabilities = supportCounts
            .map((value) => (total > 0 ? value / total : 0))
            .filter((p) => p > 0);
        const entropy = -probabilities.reduce((sum, p) => sum + p * Math.log2(p), 0);
        const maxEntropy = probabilities.length > 1 ? Math.log2(probabilities.length) : 1;
        const disagreementScore = this.clamp01(maxEntropy > 0 ? entropy / maxEntropy : 0);
        const agreementScore = 1 - disagreementScore;
        const sampleScore = this.clamp01(analyzedCommentCount / 120);
        const confidenceScore = this.clamp01(sampleScore * 0.65 + agreementScore * 0.35);
        const confidenceLevel = confidenceScore >= 0.75 ? 'high' : confidenceScore >= 0.45 ? 'medium' : 'low';
        return {
            confidenceScore: Number(confidenceScore.toFixed(2)),
            confidenceLevel,
            disagreementScore: Number(disagreementScore.toFixed(2)),
        };
    }
    restoreDisplayLabel(normalized) {
        return normalized
            .split(' ')
            .filter((part) => part.length > 0)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    }
    buildChannelSummaryText(topicQuery, topArguments) {
        if (!topArguments.length) {
            return `No clear argument patterns were found for "${topicQuery}".`;
        }
        const top = topArguments[0];
        const second = topArguments[1];
        if (!second) {
            return `For "${topicQuery}", the dominant argument was "${top.label}" with ${top.supportPct}% support.`;
        }
        return `For "${topicQuery}", the leading arguments were "${top.label}" (${top.supportPct}%) and "${second.label}" (${second.supportPct}%).`;
    }
    get commentsAnalysisCacheTtlMs() {
        const configuredRaw = this.configService.get('YOUTUBE_COMMENTS_ANALYSIS_CACHE_TTL_HOURS');
        const configured = Number(configuredRaw);
        if (Number.isFinite(configured) && configured > 0) {
            return configured * 60 * 60 * 1000;
        }
        return 24 * 60 * 60 * 1000;
    }
    async getCachedSearchResponse(cacheKey) {
        const cachedEntry = await this.prismaService.youtubeVideoIndex.findUnique({
            where: { query: cacheKey },
        });
        if (!cachedEntry) {
            const legacyEntry = await this.prismaService.youtubeSearchCache.findFirst({
                where: { query: cacheKey },
            });
            if (!legacyEntry) {
                return null;
            }
            const legacyItems = this.parseCachedSearchItems(legacyEntry.items);
            if (!legacyItems.length) {
                return null;
            }
            await this.saveVideoIndex(cacheKey, legacyItems).catch(() => {
            });
            return {
                query: legacyEntry.query,
                maxResults: legacyItems.length,
                whitelist: {
                    sourceFile: this.whitelistPath,
                    configuredEntries: [],
                    resolvedChannelIds: [],
                },
                items: legacyItems,
            };
        }
        const parsedItems = this.parseCachedSearchItems(cachedEntry.items);
        if (!parsedItems.length) {
            return null;
        }
        return {
            query: cachedEntry.query,
            maxResults: parsedItems.length,
            whitelist: {
                sourceFile: this.whitelistPath,
                configuredEntries: [],
                resolvedChannelIds: [],
            },
            items: parsedItems,
        };
    }
    async saveSearchResponse(cacheKey, response) {
        await this.saveVideoIndex(cacheKey, response.items.slice(0, 25));
    }
    async saveVideoIndex(cacheKey, items) {
        const normalizedItems = items
            .map((item) => this.coerceSearchResult(item))
            .filter((item) => item !== null);
        if (!normalizedItems.length) {
            return;
        }
        const itemsToStore = normalizedItems.map((item) => ({
            sourceKey: item.sourceKey,
            videoId: item.videoId,
            title: item.title,
            description: item.description,
            channelTitle: item.channelTitle,
            channelId: item.channelId,
            publishedAt: item.publishedAt,
            thumbnailUrl: item.thumbnailUrl,
            videoUrl: item.videoUrl,
            duration: item.duration,
            durationSeconds: item.durationSeconds,
            isShort: item.isShort,
            startTimestamp: item.startTimestamp,
            keepOnRefresh: item.keepOnRefresh,
            pinOrder: item.pinOrder,
        }));
        await this.prismaService.youtubeVideoIndex.upsert({
            where: { query: cacheKey },
            update: {
                items: itemsToStore,
                refreshedAt: new Date(),
            },
            create: {
                query: cacheKey,
                items: itemsToStore,
                refreshedAt: new Date(),
            },
        });
    }
    async saveSearchOverride(input) {
        const cacheKey = this.normalizeQueryKey(input.query);
        const mergedItem = this.applyOverrideToItem(input.item, {
            startTimestamp: input.startTimestamp,
            keepOnRefresh: input.keepOnRefresh,
            sourceKey: input.sourceKey ?? input.item.sourceKey ?? '',
            pinOrder: input.pinOrder ?? input.item.pinOrder ?? 0,
        });
        await this.prismaService.youtubeVideoMetadata.upsert({
            where: {
                query_videoId: {
                    query: cacheKey,
                    videoId: input.videoId,
                },
            },
            update: {
                sourceKey: input.sourceKey ?? '',
                item: input.item,
                startTimestamp: input.startTimestamp,
                keepOnRefresh: input.keepOnRefresh,
                pinOrder: input.pinOrder ?? input.item.pinOrder ?? 0,
            },
            create: {
                sourceKey: input.sourceKey ?? '',
                query: cacheKey,
                videoId: input.videoId,
                item: input.item,
                startTimestamp: input.startTimestamp,
                keepOnRefresh: input.keepOnRefresh,
                pinOrder: input.pinOrder ?? input.item.pinOrder ?? 0,
            },
        });
        return mergedItem;
    }
    async searchWithinChannel(query, cacheKey, channelId, maxResults, apiKey) {
        const cachedChannelSearch = await this.getCachedChannelSearch(cacheKey, channelId);
        if (cachedChannelSearch.length > 0) {
            return cachedChannelSearch;
        }
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
                startTimestamp: null,
                keepOnRefresh: false,
                sourceKey: '',
                pinOrder: 0,
            };
        })
            .filter((item) => item !== null);
        if (!mappedItems.length) {
            return [];
        }
        const durationByVideoId = await this.fetchVideoDurations(mappedItems.map((item) => item.videoId), apiKey);
        const scoredResults = mappedItems.map((item, index) => {
            const durationRaw = durationByVideoId.get(item.videoId) ?? '';
            const durationSeconds = this.parseIso8601DurationToSeconds(durationRaw);
            const enrichedItem = {
                ...item,
                duration: this.formatDuration(durationSeconds),
                durationSeconds,
                isShort: durationSeconds > 0 && durationSeconds <= this.shortsMaxSeconds,
                startTimestamp: item.startTimestamp ?? null,
                keepOnRefresh: item.keepOnRefresh ?? false,
                sourceKey: item.sourceKey ?? '',
                pinOrder: item.pinOrder ?? 0,
            };
            return {
                ...enrichedItem,
                relevanceScore: this.computeRelevanceScore(query, enrichedItem, index),
                preferredBoostApplied: false,
            };
        });
        await this.saveChannelSearch(cacheKey, channelId, scoredResults).catch(err => {
            console.warn(`Failed to cache channel search for query "${query}" in channel ${channelId}:`, err);
        });
        return scoredResults;
    }
    async getCachedChannelSearch(cacheKey, channelId) {
        try {
            const cached = await this.prismaService.youtubeChannelSearchCache.findUnique({
                where: {
                    query_channelId: { query: cacheKey, channelId },
                },
            });
            if (!cached) {
                return [];
            }
            if (!Array.isArray(cached.items)) {
                return [];
            }
            return cached.items
                .map((item) => this.coerceScoredSearchResult(item))
                .filter((item) => item !== null);
        }
        catch (error) {
            return [];
        }
    }
    async saveChannelSearch(cacheKey, channelId, items) {
        try {
            const validItems = items
                .map((item) => this.coerceScoredSearchResult(item))
                .filter((item) => item !== null);
            if (!validItems.length) {
                return;
            }
            await this.prismaService.youtubeChannelSearchCache.upsert({
                where: {
                    query_channelId: { query: cacheKey, channelId },
                },
                update: {
                    items: validItems,
                    updatedAt: new Date(),
                },
                create: {
                    query: cacheKey,
                    channelId,
                    items: validItems,
                },
            });
        }
        catch (error) {
        }
    }
    async applySearchOverrides(cacheKey, items, forceRefresh) {
        if (!items.length) {
            return this.loadPreservedOverrideItems(cacheKey, [], forceRefresh);
        }
        const videoIds = items.map((item) => item.videoId);
        const overrideRows = await this.prismaService.youtubeVideoMetadata.findMany({
            where: {
                query: cacheKey,
                videoId: { in: videoIds },
            },
        });
        const overridesByVideoId = new Map(overrideRows.map((row) => [row.videoId, row]));
        const mergedItems = items.map((item) => {
            const override = overridesByVideoId.get(item.videoId);
            if (!override) {
                return {
                    ...item,
                    startTimestamp: item.startTimestamp ?? null,
                    keepOnRefresh: item.keepOnRefresh ?? false,
                    sourceKey: item.sourceKey ?? '',
                    pinOrder: item.pinOrder ?? 0,
                };
            }
            return this.applyOverrideToItem(item, {
                startTimestamp: override.startTimestamp ?? null,
                keepOnRefresh: override.keepOnRefresh,
                sourceKey: override.sourceKey ?? '',
                pinOrder: override.pinOrder ?? 0,
            });
        });
        return this.loadPreservedOverrideItems(cacheKey, mergedItems, forceRefresh);
    }
    async loadPreservedOverrideItems(cacheKey, items, forceRefresh) {
        const overrideRows = await this.prismaService.youtubeVideoMetadata.findMany({
            where: {
                query: cacheKey,
                keepOnRefresh: true,
            },
        });
        if (!overrideRows.length) {
            return items;
        }
        const seenVideoIds = new Set(items.map((item) => item.videoId));
        const preservedItems = overrideRows
            .filter((row) => forceRefresh || !seenVideoIds.has(row.videoId))
            .map((row) => this.overrideRowToSearchResult(row));
        if (!preservedItems.length) {
            return items;
        }
        return [...items, ...preservedItems.filter((item) => !seenVideoIds.has(item.videoId))].sort((a, b) => {
            if (a.keepOnRefresh !== b.keepOnRefresh) {
                return a.keepOnRefresh ? -1 : 1;
            }
            if (a.keepOnRefresh && b.keepOnRefresh && a.pinOrder !== b.pinOrder) {
                return a.pinOrder - b.pinOrder;
            }
            return 0;
        });
    }
    overrideRowToSearchResult(row) {
        const snapshot = row.item;
        const item = {
            videoId: snapshot.videoId ?? '',
            title: snapshot.title ?? '',
            description: snapshot.description ?? '',
            channelTitle: snapshot.channelTitle ?? '',
            channelId: snapshot.channelId ?? '',
            publishedAt: snapshot.publishedAt ?? '',
            thumbnailUrl: snapshot.thumbnailUrl ?? null,
            videoUrl: snapshot.videoUrl ?? '',
            duration: snapshot.duration ?? '',
            durationSeconds: snapshot.durationSeconds ?? 0,
            isShort: snapshot.isShort ?? false,
            startTimestamp: row.startTimestamp ?? null,
            keepOnRefresh: row.keepOnRefresh,
            sourceKey: row.sourceKey ?? '',
            pinOrder: row.pinOrder ?? 0,
        };
        return this.applyStartTimestampToItem(item);
    }
    applyOverrideToItem(item, override) {
        const merged = {
            ...item,
            startTimestamp: override.startTimestamp,
            keepOnRefresh: override.keepOnRefresh,
            sourceKey: override.sourceKey,
            pinOrder: override.pinOrder,
        };
        return this.applyStartTimestampToItem(merged);
    }
    applyStartTimestampToItem(item) {
        if (!item.startTimestamp) {
            return item;
        }
        const startSeconds = this.parseStartTimestampToSeconds(item.startTimestamp);
        if (startSeconds === null) {
            return item;
        }
        return {
            ...item,
            videoUrl: this.appendStartSeconds(item.videoUrl, startSeconds),
        };
    }
    parseCachedSearchItems(items) {
        if (!Array.isArray(items)) {
            return [];
        }
        return items
            .map((item) => this.coerceSearchResult(item))
            .filter((item) => item !== null);
    }
    coerceSearchResult(item) {
        if (!item || typeof item !== 'object') {
            return null;
        }
        const row = item;
        if (!row.videoId || !row.title || !row.channelId) {
            return null;
        }
        const normalized = {
            videoId: row.videoId,
            title: row.title,
            description: row.description ?? '',
            channelTitle: row.channelTitle ?? '',
            channelId: row.channelId,
            publishedAt: row.publishedAt ?? '',
            thumbnailUrl: row.thumbnailUrl ?? null,
            videoUrl: row.videoUrl ?? `https://www.youtube.com/watch?v=${row.videoId}`,
            duration: row.duration ?? '',
            durationSeconds: Number(row.durationSeconds ?? 0),
            isShort: Boolean(row.isShort ?? false),
            startTimestamp: row.startTimestamp ?? null,
            keepOnRefresh: Boolean(row.keepOnRefresh ?? false),
            sourceKey: row.sourceKey ?? '',
            pinOrder: Number(row.pinOrder ?? 0),
        };
        return this.applyStartTimestampToItem(normalized);
    }
    coerceScoredSearchResult(item) {
        if (!item || typeof item !== 'object') {
            return null;
        }
        const base = this.coerceSearchResult(item);
        if (!base) {
            return null;
        }
        const scoredItem = item;
        return {
            ...base,
            relevanceScore: Number(scoredItem.relevanceScore ?? 0),
            preferredBoostApplied: Boolean(scoredItem.preferredBoostApplied ?? false),
        };
    }
    normalizeQueryKey(query) {
        return this.normalizeText(query);
    }
    parseStartTimestampToSeconds(startTimestamp) {
        const trimmed = startTimestamp.trim();
        if (!trimmed) {
            return null;
        }
        if (/^\d+$/.test(trimmed)) {
            return Number(trimmed);
        }
        const parts = trimmed.split(':').map((part) => Number(part));
        if (parts.some((part) => Number.isNaN(part))) {
            return null;
        }
        if (parts.length === 2) {
            const [minutes, seconds] = parts;
            return minutes * 60 + seconds;
        }
        if (parts.length === 3) {
            const [hours, minutes, seconds] = parts;
            return hours * 3600 + minutes * 60 + seconds;
        }
        return null;
    }
    appendStartSeconds(videoUrl, startSeconds) {
        const url = new URL(videoUrl);
        url.searchParams.set('t', String(startSeconds));
        return url.toString();
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
        await this.ensureWhitelistSeededFromFile();
        const rows = await this.prismaService.youtubeChannelWhitelistEntry.findMany({
            where: { isEnabled: true },
            orderBy: { identifier: 'asc' },
        });
        return rows.map((row) => row.identifier);
    }
    async ensureWhitelistSeededFromFile() {
        const existingCount = await this.prismaService.youtubeChannelWhitelistEntry.count();
        if (existingCount > 0) {
            return;
        }
        const fallbackEntries = await this.readWhitelistEntriesFromFile();
        if (!fallbackEntries.length) {
            return;
        }
        await this.prismaService.youtubeChannelWhitelistEntry.createMany({
            data: fallbackEntries.map((entry) => ({
                identifier: entry,
                isEnabled: true,
            })),
            skipDuplicates: true,
        });
    }
    async readWhitelistEntriesFromFile() {
        const raw = await node_fs_1.promises.readFile(this.whitelistPath, 'utf-8');
        return raw
            .split(/\r?\n/)
            .map((line) => this.normalizeWhitelistEntry(line))
            .filter((line) => Boolean(line));
    }
    normalizeWhitelistEntry(value) {
        const trimmed = value.trim();
        if (!trimmed || trimmed.startsWith('#')) {
            return null;
        }
        if (/^UC[\w-]{20,}$/.test(trimmed)) {
            return trimmed;
        }
        const handle = trimmed.replace(/^@/, '').trim().toLowerCase();
        if (!handle) {
            return null;
        }
        return `@${handle}`;
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
        const memoryCached = this.memoryChannelIdCache.get(cacheKey);
        if (memoryCached) {
            return memoryCached;
        }
        const dbCached = await this.prismaService.youtubeChannelCache.findUnique({
            where: { handle: cacheKey },
        });
        if (dbCached) {
            this.memoryChannelIdCache.set(cacheKey, dbCached.channelId);
            return dbCached.channelId;
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
        this.memoryChannelIdCache.set(cacheKey, channelId);
        await this.prismaService.youtubeChannelCache.upsert({
            where: { handle: cacheKey },
            update: { channelId },
            create: { handle: cacheKey, channelId },
        }).catch(err => {
            console.warn(`Failed to cache channel ID for ${handle}:`, err);
        });
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
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService])
], YoutubeService);
//# sourceMappingURL=youtube.service.js.map
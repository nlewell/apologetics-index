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
exports.IndexItemsService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const prisma_service_1 = require("./prisma.service");
let IndexItemsService = class IndexItemsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    normalizeNullableText(value) {
        if (value === undefined) {
            return undefined;
        }
        const trimmed = (value ?? '').trim();
        return trimmed.length > 0 ? trimmed : null;
    }
    async updateFields(id, input) {
        const data = {};
        const generalTopic = this.normalizeNullableText(input.generalTopic);
        const subtopic = this.normalizeNullableText(input.subtopic);
        const charge = this.normalizeNullableText(input.charge);
        if (generalTopic !== undefined) {
            data.generalTopic = generalTopic;
        }
        if (subtopic !== undefined) {
            data.subtopic = subtopic;
        }
        if (charge !== undefined) {
            data.charge = charge;
        }
        return this.prisma.apologeticIndexItem.update({
            where: { id },
            data,
        });
    }
    async createItem(input) {
        const generalTopic = this.normalizeNullableText(input.generalTopic);
        const subtopic = this.normalizeNullableText(input.subtopic);
        const charge = this.normalizeNullableText(input.charge);
        if (!generalTopic && !subtopic && !charge) {
            throw new common_1.BadRequestException('Provide at least one of generalTopic, subtopic, or charge.');
        }
        return this.prisma.apologeticIndexItem.create({
            data: {
                sourceKey: `manual-${(0, crypto_1.randomUUID)()}`,
                generalTopic: generalTopic ?? null,
                subtopic: subtopic ?? null,
                charge: charge ?? null,
            },
        });
    }
    async listTopicsWithSubtopics() {
        const rows = await this.prisma.apologeticIndexItem.findMany({
            where: {
                generalTopic: {
                    not: null,
                },
            },
            select: {
                generalTopic: true,
                subtopic: true,
                charge: true,
            },
        });
        const byTopic = new Map();
        for (const row of rows) {
            const topic = (row.generalTopic ?? '').trim();
            if (!topic) {
                continue;
            }
            const accumulator = byTopic.get(topic) ?? {
                topic,
                charges: new Set(),
                subtopics: new Map(),
            };
            const subtopic = (row.subtopic ?? '').trim();
            const charge = (row.charge ?? '').trim();
            if (subtopic) {
                const charges = accumulator.subtopics.get(subtopic) ?? new Set();
                if (charge) {
                    charges.add(charge);
                }
                accumulator.subtopics.set(subtopic, charges);
            }
            else if (charge) {
                accumulator.charges.add(charge);
            }
            byTopic.set(topic, accumulator);
        }
        return Array.from(byTopic.entries())
            .map(([, data]) => ({
            topic: data.topic,
            charges: Array.from(data.charges).sort((a, b) => a.localeCompare(b)),
            subtopics: Array.from(data.subtopics.entries())
                .map(([subtopic, charges]) => ({
                subtopic,
                charges: Array.from(charges).sort((a, b) => a.localeCompare(b)),
            }))
                .sort((a, b) => a.subtopic.localeCompare(b.subtopic)),
        }))
            .sort((a, b) => a.topic.localeCompare(b.topic));
    }
    async listTopicCounts() {
        const grouped = await this.prisma.apologeticIndexItem.groupBy({
            by: ['generalTopic'],
            where: {
                generalTopic: {
                    not: null,
                },
            },
            _count: {
                _all: true,
            },
        });
        return grouped
            .filter((row) => Boolean(row.generalTopic))
            .map((row) => ({
            topic: row.generalTopic,
            count: row._count._all,
        }))
            .sort((a, b) => {
            if (b.count !== a.count) {
                return b.count - a.count;
            }
            return a.topic.localeCompare(b.topic);
        });
    }
    async list(input) {
        const where = {
            AND: [
                input.generalTopic
                    ? {
                        generalTopic: {
                            contains: input.generalTopic,
                            mode: 'insensitive',
                        },
                    }
                    : {},
                input.subtopic
                    ? {
                        subtopic: {
                            contains: input.subtopic,
                            mode: 'insensitive',
                        },
                    }
                    : {},
                input.q
                    ? {
                        OR: [
                            {
                                charge: {
                                    contains: input.q,
                                    mode: 'insensitive',
                                },
                            },
                            {
                                subtopic: {
                                    contains: input.q,
                                    mode: 'insensitive',
                                },
                            },
                            {
                                generalTopic: {
                                    contains: input.q,
                                    mode: 'insensitive',
                                },
                            },
                            {
                                shortResponseAuthor: {
                                    contains: input.q,
                                    mode: 'insensitive',
                                },
                            },
                            {
                                shortResponseLength: {
                                    contains: input.q,
                                    mode: 'insensitive',
                                },
                            },
                        ],
                    }
                    : {},
            ],
        };
        const skip = (input.page - 1) * input.limit;
        const [items, total] = await this.prisma.$transaction([
            this.prisma.apologeticIndexItem.findMany({
                where,
                orderBy: [{ generalTopic: 'asc' }, { subtopic: 'asc' }, { id: 'asc' }],
                skip,
                take: input.limit,
            }),
            this.prisma.apologeticIndexItem.count({ where }),
        ]);
        const totalPages = Math.max(1, Math.ceil(total / input.limit));
        return {
            meta: {
                page: input.page,
                limit: input.limit,
                total,
                totalPages,
            },
            items,
        };
    }
};
exports.IndexItemsService = IndexItemsService;
exports.IndexItemsService = IndexItemsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], IndexItemsService);
//# sourceMappingURL=index-items.service.js.map
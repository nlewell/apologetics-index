import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from './prisma.service';

export type ListIndexItemsInput = {
  page: number;
  limit: number;
  generalTopic?: string;
  subtopic?: string;
  q?: string;
};

export type UpdateIndexItemFieldsInput = {
  generalTopic?: string | null;
  subtopic?: string | null;
  charge?: string | null;
};

export type CreateIndexItemInput = {
  generalTopic?: string | null;
  subtopic?: string | null;
  charge?: string | null;
};

export type TopicWithSubtopics = {
  topic: string;
  charges: string[];
  subtopics: TopicWithCharges[];
};

export type TopicWithCharges = {
  subtopic: string;
  charges: string[];
};

type TopicAccumulator = {
  topic: string;
  charges: Set<string>;
  subtopics: Map<string, Set<string>>;
};

@Injectable()
export class IndexItemsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeNullableText(value: string | null | undefined) {
    if (value === undefined) {
      return undefined;
    }

    const trimmed = (value ?? '').trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  async updateFields(id: number, input: UpdateIndexItemFieldsInput) {
    const data: Prisma.ApologeticIndexItemUpdateInput = {};

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

  async createItem(input: CreateIndexItemInput) {
    const generalTopic = this.normalizeNullableText(input.generalTopic);
    const subtopic = this.normalizeNullableText(input.subtopic);
    const charge = this.normalizeNullableText(input.charge);

    if (!generalTopic && !subtopic && !charge) {
      throw new BadRequestException(
        'Provide at least one of generalTopic, subtopic, or charge.',
      );
    }

    return this.prisma.apologeticIndexItem.create({
      data: {
        sourceKey: `manual-${randomUUID()}`,
        generalTopic: generalTopic ?? null,
        subtopic: subtopic ?? null,
        charge: charge ?? null,
      },
    });
  }

  async listTopicsWithSubtopics(): Promise<TopicWithSubtopics[]> {
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

    const byTopic = new Map<string, TopicAccumulator>();

    for (const row of rows) {
      const topic = (row.generalTopic ?? '').trim();
      if (!topic) {
        continue;
      }

      const accumulator =
        byTopic.get(topic) ?? {
          topic,
          charges: new Set<string>(),
          subtopics: new Map<string, Set<string>>(),
        };

      const subtopic = (row.subtopic ?? '').trim();
      const charge = (row.charge ?? '').trim();

      if (subtopic) {
        const charges = accumulator.subtopics.get(subtopic) ?? new Set<string>();
        if (charge) {
          charges.add(charge);
        }

        accumulator.subtopics.set(subtopic, charges);
      } else if (charge) {
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
      .filter(
        (
          row,
        ): row is typeof row & {
          generalTopic: string;
        } => Boolean(row.generalTopic),
      )
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

  async list(input: ListIndexItemsInput) {
    const where: Prisma.ApologeticIndexItemWhereInput = {
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
}

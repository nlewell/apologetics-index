import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

export type ListIndexItemsInput = {
  page: number;
  limit: number;
  generalTopic?: string;
  subtopic?: string;
  q?: string;
};

@Injectable()
export class IndexItemsService {
  constructor(private readonly prisma: PrismaService) {}

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

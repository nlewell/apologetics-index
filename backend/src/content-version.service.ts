import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class ContentVersionService {
  constructor(private readonly prisma: PrismaService) {}

  async getContentVersion() {
    const [count, latest] = await this.prisma.$transaction([
      this.prisma.apologeticIndexItem.count(),
      this.prisma.apologeticIndexItem.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      }),
    ]);

    const lastUpdatedAt = latest?.updatedAt?.toISOString() ?? null;
    const version = `${count}:${lastUpdatedAt ?? 'empty'}`;

    return {
      version,
      totalItems: count,
      lastUpdatedAt,
    };
  }
}

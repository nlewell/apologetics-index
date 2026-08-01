import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ContentSpreadsheetService } from './content-spreadsheet.service';
import { PrismaService } from './prisma.service';

describe('ContentSpreadsheetService', () => {
  let service: ContentSpreadsheetService;
  let prismaService: {
    apologeticIndexItem: {
      findFirst: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
    };
    youtubeVideoMetadata: {
      deleteMany: jest.Mock;
      create: jest.Mock;
    };
  };

  beforeEach(() => {
    prismaService = {
      apologeticIndexItem: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 1 }),
      },
      youtubeVideoMetadata: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn(),
        upsert: jest.fn(),
      },
    };

    service = new ContentSpreadsheetService(
      prismaService as unknown as PrismaService,
      { get: jest.fn() } as unknown as ConfigService,
    );
  });

  it('imports topic-only rows without requiring video data', async () => {
    const csv = [
      'generalTopic,subtopic,charge,searchQuery,videoId,videoUrl',
      'Book of Mormon,Anachronisms,Steel,,,',
    ].join('\n');

    const result = await service.importCsv(csv);

    expect(result.indexItemsCreated).toBe(1);
    expect(result.pinnedRowsImported).toBe(0);
    expect(prismaService.apologeticIndexItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        generalTopic: 'Book of Mormon',
        subtopic: 'Anachronisms',
        charge: 'Steel',
      }),
    });
  });

  it('rejects video rows that are not tied to a topic path', async () => {
    const csv = [
      'generalTopic,subtopic,charge,searchQuery,videoId,videoUrl',
      ',,,,abc123,https://www.youtube.com/watch?v=abc123',
    ].join('\n');

    await expect(service.importCsv(csv)).rejects.toThrow(BadRequestException);
    await expect(service.importCsv(csv)).rejects.toThrow(
      'provide at least one of generalTopic, subtopic, or charge',
    );
  });

  it('rejects rows with video metadata that omit both videoId and videoUrl', async () => {
    const csv = [
      'generalTopic,subtopic,charge,searchQuery,videoId,videoTitle,videoUrl',
      'Book of Mormon,Anachronisms,Steel,,,"A helpful clip",',
    ].join('\n');

    await expect(service.importCsv(csv)).rejects.toThrow(BadRequestException);
    await expect(service.importCsv(csv)).rejects.toThrow(
      'provide either videoId or videoUrl when importing YouTube video data',
    );
  });

  it('deduplicates repeated video rows within the same topic group during import', async () => {
    const csv = [
      'generalTopic,subtopic,charge,searchQuery,videoId,videoUrl',
      'Book of Mormon,Anachronisms,Steel,,abc123,https://www.youtube.com/watch?v=abc123',
      'Book of Mormon,Anachronisms,Steel,,abc123,https://www.youtube.com/watch?v=abc123',
    ].join('\n');

    jest.spyOn(service as never, 'fetchVideoMetadataById' as never).mockResolvedValue({
      videoId: 'abc123',
      title: 'Example title',
      description: 'Example description',
      channelTitle: 'Example channel',
      channelId: 'channel-1',
      publishedAt: '2024-01-01T00:00:00.000Z',
      thumbnailUrl: null,
      videoUrl: 'https://www.youtube.com/watch?v=abc123',
      duration: '1:23',
      durationSeconds: 83,
      isShort: false,
    });

    const result = await service.importCsv(csv);

    expect(result.pinnedRowsImported).toBe(1);
    expect(result.metadataHydrated).toBe(1);
    expect(prismaService.youtubeVideoMetadata.upsert).toHaveBeenCalledTimes(1);
  });
});
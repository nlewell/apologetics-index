import { ConfigService } from '@nestjs/config';
import { YoutubeService } from './youtube.service';
import { PrismaService } from './prisma.service';

describe('YoutubeService', () => {
  let service: YoutubeService;
  let prismaService: Pick<PrismaService, 'youtubeSearchCache'>;
  let configService: Pick<ConfigService, 'get'>;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'YOUTUBE_API_KEY') {
          return 'test-api-key';
        }

        return undefined;
      }),
    } as unknown as Pick<ConfigService, 'get'>;

    prismaService = {
      youtubeSearchCache: {
        findFirst: jest.fn(),
        upsert: jest.fn(),
      },
    } as unknown as Pick<PrismaService, 'youtubeSearchCache'>;

    service = new YoutubeService(
      configService as ConfigService,
      prismaService as PrismaService,
    );
  });

  it('returns fresh cached results without calling YouTube again', async () => {
    const cachedItems = [
      {
        videoId: 'cached-video',
        title: 'Cached result',
        description: '',
        channelTitle: 'Channel',
        channelId: 'channel-id',
        publishedAt: '2024-01-01T00:00:00.000Z',
        thumbnailUrl: null,
        videoUrl: 'https://www.youtube.com/watch?v=cached-video',
        duration: '3:14',
        durationSeconds: 194,
        isShort: false,
        startTimestamp: null,
      },
    ];

    (prismaService.youtubeSearchCache.findFirst as jest.Mock).mockResolvedValue({
      query: 'god',
      items: cachedItems,
      updatedAt: new Date(),
    });

    jest.spyOn(service as any, 'loadWhitelistEntries').mockResolvedValue([]);
    jest.spyOn(service as any, 'resolveChannelIds').mockResolvedValue([]);
    jest.spyOn(service as any, 'loadPreferredEntries').mockResolvedValue([]);
    const searchWithinChannelSpy = jest.spyOn(
      service as any,
      'searchWithinChannel',
    );

    const response = await service.search('god', 5, false);

    expect(response.items).toEqual(cachedItems);
    expect(searchWithinChannelSpy).not.toHaveBeenCalled();
  });

  it('normalizes query casing and spacing before cache lookup', async () => {
    const cachedItems = [
      {
        videoId: 'cached-video',
        title: 'Cached result',
        description: '',
        channelTitle: 'Channel',
        channelId: 'channel-id',
        publishedAt: '2024-01-01T00:00:00.000Z',
        thumbnailUrl: null,
        videoUrl: 'https://www.youtube.com/watch?v=cached-video',
        duration: '3:14',
        durationSeconds: 194,
        isShort: false,
        startTimestamp: null,
      },
    ];

    (prismaService.youtubeSearchCache.findFirst as jest.Mock).mockResolvedValue({
      query: 'god',
      items: cachedItems,
      updatedAt: new Date(),
    });

    const searchWithinChannelSpy = jest.spyOn(
      service as any,
      'searchWithinChannel',
    );

    const response = await service.search('   GoD   ', 5, false);

    expect(response.items).toEqual(cachedItems);
    expect(searchWithinChannelSpy).not.toHaveBeenCalled();
  });
});

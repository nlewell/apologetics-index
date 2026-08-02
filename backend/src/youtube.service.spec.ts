import { ConfigService } from '@nestjs/config';
import { YoutubeService } from './youtube.service';
import { PrismaService } from './prisma.service';

describe('YoutubeService', () => {
  let service: YoutubeService;
  let prismaService: {
    youtubeSearchCache: {
      findFirst: jest.Mock;
      upsert: jest.Mock;
    };
    youtubeVideoMetadata: {
      findMany: jest.Mock;
      upsert: jest.Mock;
    };
    youtubeVideoIndex: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      upsert: jest.Mock;
    };
    youtubeOfficialAnswerCache: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
    youtubeQueryInsightCache: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
  };
  let configService: Pick<ConfigService, 'get'>;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'YOUTUBE_API_KEY') {
          return 'test-api-key';
        }

        if (key === 'OPENAI_API_KEY') {
          return 'test-openai-key';
        }

        return undefined;
      }),
    } as unknown as Pick<ConfigService, 'get'>;

    prismaService = {
      youtubeSearchCache: {
        findFirst: jest.fn(),
        upsert: jest.fn(),
      },
      youtubeVideoMetadata: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(),
      },
      youtubeVideoIndex: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(),
      },
      youtubeOfficialAnswerCache: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(),
      },
      youtubeQueryInsightCache: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(),
      },
    };

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
        keepOnRefresh: false,
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

    expect(response.items).toEqual([
      expect.objectContaining(cachedItems[0]),
    ]);
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
        keepOnRefresh: false,
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

    expect(response.items).toEqual([
      expect.objectContaining(cachedItems[0]),
    ]);
    expect(searchWithinChannelSpy).not.toHaveBeenCalled();
  });

  it('returns a cache miss for official answers when generation is disabled', async () => {
    const fetchCandidatesSpy = jest.spyOn(
      service as never,
      'fetchOfficialChurchSearchCandidates' as never,
    );

    const response = await service.getOfficialChurchAnswer({
      videoId: 'video-1',
      topicQuery: 'book of mormon',
      generateIfMissing: false,
    });

    expect(response.cacheStatus).toBe('miss');
    expect(response.matchFound).toBe(false);
    expect(fetchCandidatesSpy).not.toHaveBeenCalled();
  });

  it('generates and persists an official answer when a candidate matches', async () => {
    jest.spyOn(
      service as never,
      'fetchOfficialChurchSearchCandidates' as never,
    ).mockResolvedValue([
      {
        title: 'The Book of Mormon',
        url: 'https://www.churchofjesuschrist.org/study/scriptures/bofm?lang=eng',
        source: 'ChurchofJesusChrist.org',
        snippet: 'Reference guide to the Book of Mormon.',
      },
    ]);
    jest.spyOn(
      service as never,
      'selectOfficialChurchAnswerWithAi' as never,
    ).mockResolvedValue({
      matchFound: true,
      selectedUrl: 'https://www.churchofjesuschrist.org/study/scriptures/bofm?lang=eng',
      rationale: 'This directly explains the topic from an official source.',
      confidenceScore: 0.91,
    });

    const response = await service.getOfficialChurchAnswer({
      videoId: 'video-1',
      topicQuery: 'book of mormon',
    });

    expect(response.cacheStatus).toBe('generated');
    expect(response.matchFound).toBe(true);
    expect(response.answerTitle).toBe('The Book of Mormon');
    expect(response.answerUrl).toBe(
      'https://www.churchofjesuschrist.org/study/scriptures/bofm?lang=eng',
    );
    expect(prismaService.youtubeOfficialAnswerCache.upsert).toHaveBeenCalled();
  });

  it('returns a cache miss for query insight when generation is disabled', async () => {
    const fetchCandidatesSpy = jest.spyOn(
      service as never,
      'fetchWebSearchCandidates' as never,
    );

    const response = await service.getQueryInsight({
      topicQuery: 'book of mormon',
      generateIfMissing: false,
    });

    expect(response.cacheStatus).toBe('miss');
    expect(response.answerText).toBeNull();
    expect(fetchCandidatesSpy).not.toHaveBeenCalled();
  });

  it('generates and persists query insight with a best source', async () => {
    jest.spyOn(
      service as never,
      'fetchWebSearchCandidates' as never,
    ).mockResolvedValue([
      {
        title: 'Book of Mormon Evidence',
        url: 'https://example.com/book-of-mormon-evidence',
        source: 'example.com',
        snippet: 'A detailed overview of evidences and responses.',
      },
    ]);
    jest.spyOn(
      service as never,
      'analyzeQueryInsightWithAi' as never,
    ).mockResolvedValue({
      answerText: 'A concise answer based on the available sources.',
      bestUrl: 'https://example.com/book-of-mormon-evidence',
      bestSourceRationale: 'This source most directly addresses the query.',
      confidenceScore: 0.88,
    });

    const response = await service.getQueryInsight({
      topicQuery: 'book of mormon',
    });

    expect(response.cacheStatus).toBe('generated');
    expect(response.answerText).toBe('A concise answer based on the available sources.');
    expect(response.bestSourceUrl).toBe('https://example.com/book-of-mormon-evidence');
    expect(prismaService.youtubeQueryInsightCache.upsert).toHaveBeenCalled();
  });
});

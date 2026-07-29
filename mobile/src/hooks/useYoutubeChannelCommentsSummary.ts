import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { YoutubeChannelCommentsSummaryResponse } from '../types';

type UseYoutubeChannelCommentsSummaryOptions = {
  enabled?: boolean;
  maxVideos?: number;
  maxCommentsPerVideo?: number;
};

export const useYoutubeChannelCommentsSummary = (
  channelId: string | null,
  topicQuery: string | null,
  options: UseYoutubeChannelCommentsSummaryOptions = {},
) => {
  const normalizedChannelId = (channelId ?? '').trim();
  const normalizedTopicQuery = (topicQuery ?? '').trim();
  const {
    enabled = true,
    maxVideos = 3,
    maxCommentsPerVideo = 100,
  } = options;

  return useQuery({
    queryKey: [
      'youtubeChannelCommentsSummary',
      normalizedChannelId,
      normalizedTopicQuery,
      maxVideos,
      maxCommentsPerVideo,
    ],
    queryFn: async (): Promise<YoutubeChannelCommentsSummaryResponse> => {
      const response = await apiClient.get<YoutubeChannelCommentsSummaryResponse>(
        '/youtube/channel-comments-summary',
        {
          params: {
            channelId: normalizedChannelId,
            topicQuery: normalizedTopicQuery,
            maxVideos,
            maxCommentsPerVideo,
          },
        },
      );

      return response.data;
    },
    enabled:
      enabled &&
      normalizedChannelId.length > 0 &&
      normalizedTopicQuery.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 0,
  });
};

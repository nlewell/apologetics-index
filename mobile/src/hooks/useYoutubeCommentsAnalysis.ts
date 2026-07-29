import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { YoutubeCommentsAnalysisResponse } from '../types';

type UseYoutubeCommentsAnalysisOptions = {
  enabled?: boolean;
  maxComments?: number;
  generateIfMissing?: boolean;
  forceRefresh?: boolean;
};

export const useYoutubeCommentsAnalysis = (
  videoId: string | null,
  options: UseYoutubeCommentsAnalysisOptions = {},
) => {
  const normalizedVideoId = (videoId ?? '').trim();
  const {
    enabled = true,
    maxComments = 120,
    generateIfMissing = true,
    forceRefresh = false,
  } = options;

  return useQuery({
    queryKey: [
      'youtubeCommentsAnalysis',
      normalizedVideoId,
      maxComments,
      generateIfMissing,
      forceRefresh,
    ],
    queryFn: async (): Promise<YoutubeCommentsAnalysisResponse> => {
      const response = await apiClient.get<YoutubeCommentsAnalysisResponse>(
        '/youtube/comments-analysis',
        {
          params: {
            videoId: normalizedVideoId,
            maxComments,
            generateIfMissing,
            ...(forceRefresh ? { forceRefresh: true } : {}),
          },
        },
      );

      return response.data;
    },
    enabled: enabled && normalizedVideoId.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 0,
  });
};

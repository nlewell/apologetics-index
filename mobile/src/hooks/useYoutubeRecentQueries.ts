import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { YoutubeRecentQueriesResponse } from '../types';

export const useYoutubeRecentQueries = (limit = 10) => {
  return useQuery({
    queryKey: ['youtubeRecentQueries', limit],
    queryFn: async (): Promise<YoutubeRecentQueriesResponse> => {
      const response = await apiClient.get<YoutubeRecentQueriesResponse>(
        '/youtube/recent-queries',
        {
          params: { limit },
        },
      );

      return response.data;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

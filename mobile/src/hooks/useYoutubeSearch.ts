import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { YoutubeSearchResponse } from '../types';

export const useYoutubeSearch = (
  query: string,
  maxResults = 12,
  debug = false,
) => {
  const normalizedQuery = query.trim();

  return useQuery({
    queryKey: ['youtubeSearch', normalizedQuery, maxResults, debug],
    queryFn: async (): Promise<YoutubeSearchResponse> => {
      const response = await apiClient.get<YoutubeSearchResponse>('/youtube/search', {
        params: {
          q: normalizedQuery,
          maxResults,
          ...(debug ? { debug: true } : {}),
        },
      });
      return response.data;
    },
    enabled: normalizedQuery.length > 0,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

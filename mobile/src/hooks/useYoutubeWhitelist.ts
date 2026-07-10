import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { YoutubeWhitelistEntry } from '../types';

export const useYoutubeWhitelist = () => {
  return useQuery({
    queryKey: ['youtubeWhitelist'],
    queryFn: async (): Promise<YoutubeWhitelistEntry[]> => {
      const response = await apiClient.get<YoutubeWhitelistEntry[]>('/youtube/whitelist');
      return response.data;
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

export const useAddYoutubeWhitelistEntry = () => {
  return useMutation({
    mutationFn: async (entry: string): Promise<YoutubeWhitelistEntry> => {
      const response = await apiClient.post<YoutubeWhitelistEntry>('/youtube/whitelist', {
        entry,
      });
      return response.data;
    },
  });
};

export const useUpdateYoutubeWhitelistEntry = () => {
  return useMutation({
    mutationFn: async ({
      id,
      isEnabled,
    }: {
      id: number;
      isEnabled: boolean;
    }): Promise<YoutubeWhitelistEntry> => {
      const response = await apiClient.put<YoutubeWhitelistEntry>(`/youtube/whitelist/${id}`, {
        isEnabled,
      });
      return response.data;
    },
  });
};

export const useUpdateAllYoutubeWhitelistEntries = () => {
  return useMutation({
    mutationFn: async (isEnabled: boolean): Promise<{ updated: number }> => {
      const response = await apiClient.put<{ updated: number }>('/youtube/whitelist', {
        isEnabled,
      });
      return response.data;
    },
  });
};

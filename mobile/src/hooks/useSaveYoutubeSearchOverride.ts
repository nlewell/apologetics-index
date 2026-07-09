import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { YoutubeSearchItem } from '../types';

export type SaveYoutubeSearchOverrideInput = {
  query: string;
  videoId: string;
  item: YoutubeSearchItem;
  startTimestamp: string | null;
  keepOnRefresh: boolean;
};

export const useSaveYoutubeSearchOverride = () => {
  return useMutation({
    mutationFn: async (input: SaveYoutubeSearchOverrideInput): Promise<YoutubeSearchItem> => {
      const response = await apiClient.put<YoutubeSearchItem>('/youtube/search-overrides', input);
      return response.data;
    },
  });
};
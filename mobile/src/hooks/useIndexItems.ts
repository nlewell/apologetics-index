import { useQuery } from '@tanstack/react-query';
import {
  ContentVersionResponse,
  IndexItemsResponse,
  ListIndexItemsParams,
  TopicCount,
} from '../types';
import { apiClient } from '../lib/apiClient';

export const useIndexItems = (params: ListIndexItemsParams = {}) => {
  const { page = 1, limit = 20, generalTopic, subtopic, q } = params;

  return useQuery({
    queryKey: ['indexItems', { page, limit, generalTopic, subtopic, q }],
    queryFn: async (): Promise<IndexItemsResponse> => {
      const response = await apiClient.get('/index-items', {
        params: {
          page,
          limit,
          ...(generalTopic && { generalTopic }),
          ...(subtopic && { subtopic }),
          ...(q && { q }),
        },
      });
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (previously cacheTime)
  });
};

export const useIndexItemsTopics = () => {
  return useQuery({
    queryKey: ['indexItemsTopics'],
    queryFn: async (): Promise<TopicCount[]> => {
      const response = await apiClient.get<TopicCount[]>('/index-items/topics');
      return response.data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 20 * 60 * 1000, // 20 minutes
  });
};

export const useContentVersion = () => {
  return useQuery({
    queryKey: ['contentVersion'],
    queryFn: async (): Promise<ContentVersionResponse> => {
      const response = await apiClient.get<ContentVersionResponse>(
        '/content-version',
      );
      return response.data;
    },
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

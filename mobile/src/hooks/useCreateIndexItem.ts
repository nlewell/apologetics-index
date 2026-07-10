import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { CreateIndexItemInput, IndexItem } from '../types';

export const useCreateIndexItem = () => {
  return useMutation({
    mutationFn: async (input: CreateIndexItemInput): Promise<IndexItem> => {
      const response = await apiClient.post<IndexItem>('/index-items', input);
      return response.data;
    },
  });
};

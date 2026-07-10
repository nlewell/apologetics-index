import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { IndexItem, UpdateIndexItemFieldsInput } from '../types';

interface UpdateIndexItemPayload extends UpdateIndexItemFieldsInput {
  id: number;
}

export const useUpdateIndexItemFields = () => {
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateIndexItemPayload): Promise<IndexItem> => {
      const response = await apiClient.patch<IndexItem>(`/index-items/${id}`, input);
      return response.data;
    },
  });
};

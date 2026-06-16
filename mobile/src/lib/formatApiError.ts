import { isAxiosError } from 'axios';

const getResponseMessage = (data: unknown): string | null => {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj.message === 'string') {
    return obj.message;
  }

  if (Array.isArray(obj.message)) {
    const parts = obj.message.filter((item) => typeof item === 'string');
    if (parts.length > 0) {
      return parts.join(', ');
    }
  }

  if (typeof obj.error === 'string') {
    return obj.error;
  }

  return null;
};

export const formatApiError = (err: unknown): string => {
  if (isAxiosError(err)) {
    const baseURL = err.config?.baseURL ?? 'unknown-base-url';
    const path = err.config?.url ?? 'unknown-path';
    const endpoint = `${baseURL}${path}`;

    if (err.response) {
      const serverMessage = getResponseMessage(err.response.data);
      const message = serverMessage ?? 'Request failed';
      return `${message} (HTTP ${err.response.status}) at ${endpoint}`;
    }

    if (err.code) {
      return `Network request failed (${err.code}) at ${endpoint}`;
    }

    return `Network request failed at ${endpoint}`;
  }

  return err instanceof Error ? err.message : 'Unknown error';
};

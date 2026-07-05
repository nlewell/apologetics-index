import axios from 'axios';

const API_TARGET = (process.env.EXPO_PUBLIC_API_TARGET ?? 'remote').toLowerCase();
const API_LOCAL_URL = process.env.EXPO_PUBLIC_API_LOCAL_URL ?? 'http://localhost:3000/api';
const API_REMOTE_URL = process.env.EXPO_PUBLIC_API_REMOTE_URL;
const LEGACY_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

// Choose which configured base to use
const configuredBase = API_TARGET === 'local' ? API_LOCAL_URL : API_REMOTE_URL ?? LEGACY_API_BASE_URL ?? API_LOCAL_URL;

// Normalize base URL and ensure it includes the '/api' prefix exactly once.
function normalizeApiBase(base: string): string {
  if (!base) return base;
  // strip trailing slash
  let b = base.replace(/\/+$/, '');
  if (b.endsWith('/api')) return b;
  return `${b}/api`;
}

const API_BASE_URL = normalizeApiBase(configuredBase);
const API_KEY = process.env.EXPO_PUBLIC_API_KEY;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: API_KEY ? { 'x-api-key': API_KEY } : undefined,
});
import axios from 'axios';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api';
const API_KEY = process.env.EXPO_PUBLIC_API_KEY;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: API_KEY ? { 'x-api-key': API_KEY } : undefined,
});
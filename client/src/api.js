import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tp_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function setToken(token) {
  if (token) localStorage.setItem('tp_token', token);
  else localStorage.removeItem('tp_token');
}

export function getToken() {
  return localStorage.getItem('tp_token');
}

export function setUser(user) {
  if (user) localStorage.setItem('tp_user', JSON.stringify(user));
  else localStorage.removeItem('tp_user');
}

export function getUser() {
  const raw = localStorage.getItem('tp_user');
  return raw ? JSON.parse(raw) : null;
}

export default api;

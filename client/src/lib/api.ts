import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE;

const client = axios.create({
  baseURL: API_BASE,
  timeout: 20000,
});

export function setApiKey(k: string) {
  localStorage.setItem("chainlit_api_key", k);
}

export function getApiKey(): string {
  return localStorage.getItem("chainlit_api_key") || "";
}

// attach key on each request (demo only; don't do this in production)
client.interceptors.request.use((config) => {
  const key = getApiKey();
  if (key && config.headers) config.headers["x-api-key"] = key;
  return config;
});

export default client;

import axios from "axios";

// Ensure a sane default in case the env var is missing in prod
const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

const client = axios.create({
  baseURL: API_BASE,
  timeout: 20000,
});

export default client;

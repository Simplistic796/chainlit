// src/lib/http.ts
export async function getJSON<T>(
  url: string,
  headers: Record<string, string> = {},
  timeoutMs = 8000
): Promise<T> {
  const ctl = new AbortController();
  const id = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: ctl.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`GET ${url} -> ${res.status} ${res.statusText} ${body}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(id);
  }
}


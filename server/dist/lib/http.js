"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJSON = getJSON;
// src/lib/http.ts
async function getJSON(url, headers = {}, timeoutMs = 8000) {
    const ctl = new AbortController();
    const id = setTimeout(() => ctl.abort(), timeoutMs);
    try {
        const res = await fetch(url, { headers, signal: ctl.signal });
        if (!res.ok) {
            const body = await res.text().catch(() => "");
            throw new Error(`GET ${url} -> ${res.status} ${res.statusText} ${body}`);
        }
        return (await res.json());
    }
    finally {
        clearTimeout(id);
    }
}
//# sourceMappingURL=http.js.map
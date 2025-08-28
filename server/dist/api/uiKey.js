"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUiApiKey = getUiApiKey;
const prisma_1 = require("../db/prisma");
const auth_1 = require("./auth");
let cached = null;
async function getUiApiKey() {
    if (cached)
        return cached;
    const raw = process.env.DEMO_API_KEY || "";
    console.log("DEMO_API_KEY:", raw ? "SET" : "NOT SET");
    if (!raw)
        throw new Error("DEMO_API_KEY not set");
    const keyHash = (0, auth_1.hashKey)(raw);
    console.log("Looking for key hash:", keyHash);
    const key = await prisma_1.prisma.apiKey.findFirst({ where: { keyHash, isActive: true } });
    if (!key)
        throw new Error("DEMO_API_KEY hash not found in DB (make sure you created the key)");
    console.log("Found API key:", key.id);
    cached = key;
    return key;
}
//# sourceMappingURL=uiKey.js.map
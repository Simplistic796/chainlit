"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashKey = hashKey;
exports.findApiKey = findApiKey;
exports.generateRawKey = generateRawKey;
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = require("../db/prisma");
const HASH_ALGO = "sha256";
function hashKey(raw) {
    return crypto_1.default.createHash(HASH_ALGO).update(raw).digest("hex");
}
async function findApiKey(rawKey) {
    const keyHash = hashKey(rawKey);
    return prisma_1.prisma.apiKey.findFirst({ where: { keyHash, isActive: true } });
}
/** Generate a new raw key (returns {raw, hash}) — store hash only! */
function generateRawKey() {
    const raw = "ck_" + crypto_1.default.randomBytes(24).toString("hex"); // e.g., ck_abcdef...
    return { raw, hash: hashKey(raw) };
}
//# sourceMappingURL=auth.js.map
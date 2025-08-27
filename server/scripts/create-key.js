"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("../src/db/prisma");
const auth_1 = require("../src/api/auth");
async function main() {
    const name = process.argv[2] || "default";
    const plan = process.argv[3] || "free";
    const rpm = Number(process.argv[4] || 60);
    const rpd = Number(process.argv[5] || 5000);
    const { raw, hash } = (0, auth_1.generateRawKey)();
    const rec = await prisma_1.prisma.apiKey.create({
        data: { name, plan, keyHash: hash, requestsPerMin: rpm, requestsPerDay: rpd, isActive: true },
    });
    console.log("API KEY (save this securely):", raw);
    console.log("DB record id:", rec.id);
}
main().then(() => process.exit(0));
//# sourceMappingURL=create-key.js.map
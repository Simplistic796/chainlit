"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripeWebhook = stripeWebhook;
const prisma_1 = require("../db/prisma");
const stripe_1 = __importDefault(require("stripe"));
const planSync_1 = require("../billing/planSync");
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-08-27.basil" });
async function getOrCreateUserByEmail(email) {
    let user = await prisma_1.prisma.user.findUnique({ where: { email } });
    if (!user) {
        user = await prisma_1.prisma.user.create({ data: { email, plan: "free" } });
        // Create a default ApiKey for this user if they don't have one
        // You already have a generator in src/api/auth.ts
        const { generateRawKey, hashKey } = await Promise.resolve().then(() => __importStar(require("../api/auth")));
        const { raw, hash } = generateRawKey();
        await prisma_1.prisma.apiKey.create({
            data: {
                name: `Key for ${email}`,
                keyHash: hash,
                plan: "free",
                requestsPerMin: 60,
                requestsPerDay: 5000,
                userId: user.id,
            },
        });
        console.log("[billing] Created user + default key:", email, "(Keep the raw key from your admin flow, not here)");
    }
    return user;
}
async function stripeWebhook(req, res) {
    const sig = req.headers["stripe-signature"];
    if (!sig)
        return res.status(400).send("Missing sig");
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    }
    catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    switch (event.type) {
        case "checkout.session.completed": {
            const session = event.data.object;
            const email = session.customer_email;
            if (!email)
                break;
            const user = await getOrCreateUserByEmail(email);
            const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
            const custId = typeof session.customer === "string" ? session.customer : session.customer?.id;
            const updated = await prisma_1.prisma.user.update({
                where: { id: user.id },
                data: { plan: "pro", stripeCustomerId: custId, stripeSubId: subId },
            });
            await (0, planSync_1.applyPlanToUserKeys)(updated.id, "pro");
            console.log("[billing] PRO activated for", email);
            break;
        }
        case "customer.subscription.deleted": {
            const sub = event.data.object;
            // Find by customer or subscription id
            const custId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
            const user = await prisma_1.prisma.user.findFirst({
                where: { OR: [{ stripeCustomerId: custId }, { stripeSubId: sub.id }] }
            });
            if (!user)
                break;
            const updated = await prisma_1.prisma.user.update({
                where: { id: user.id },
                data: { plan: "free", stripeSubId: null },
            });
            await (0, planSync_1.applyPlanToUserKeys)(updated.id, "free");
            console.log("[billing] Downgraded to FREE:", updated.email);
            break;
        }
        default:
            // ignore others for now
            break;
    }
    res.json({ received: true });
}
//# sourceMappingURL=stripeWebhook.js.map
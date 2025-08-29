"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripeWebhook = stripeWebhook;
const stripe_1 = __importDefault(require("stripe"));
const stripe = process.env.STRIPE_SECRET_KEY ? new stripe_1.default(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-08-27.basil",
}) : null;
async function stripeWebhook(req, res) {
    if (!stripe)
        return res.status(500).send("Stripe not configured");
    const signature = req.headers["stripe-signature"];
    if (!signature)
        return res.status(400).send("Missing sig");
    let event;
    try {
        // req.body is a Buffer because we mount this route with express.raw({ type: "application/json" })
        event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
    }
    catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const email = session.customer_email ?? undefined;
        console.log("Pro subscription started for", email);
    }
    if (event.type === "customer.subscription.deleted") {
        const subscription = event.data.object;
        // In live setups you would look up the customer to resolve email/user
        console.log("Pro subscription cancelled", subscription.id);
    }
    return res.json({ received: true });
}
//# sourceMappingURL=stripeWebhook.js.map
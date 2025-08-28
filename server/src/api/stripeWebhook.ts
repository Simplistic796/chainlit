import { prisma } from "../db/prisma";
import Stripe from "stripe";
import { Request, Response } from "express";
import { applyPlanToUserKeys } from "../billing/planSync";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-08-27.basil" });

async function getOrCreateUserByEmail(email: string) {
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({ data: { email, plan: "free" } });
    // Create a default ApiKey for this user if they don't have one
    // You already have a generator in src/api/auth.ts
    const { generateRawKey, hashKey } = await import("../api/auth");
    const { raw, hash } = generateRawKey();
    await prisma.apiKey.create({
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

export async function stripeWebhook(req: Request, res: Response) {
  const sig = req.headers["stripe-signature"];
  if (!sig) return res.status(400).send("Missing sig");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const email = session.customer_email;
      if (!email) break;

      const user = await getOrCreateUserByEmail(email);
      const subId = typeof session.subscription === "string" ? session.subscription : (session.subscription as any)?.id;
      const custId = typeof session.customer === "string" ? session.customer : (session.customer as any)?.id;

      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { plan: "pro", stripeCustomerId: custId, stripeSubId: subId },
      });
      await applyPlanToUserKeys(updated.id, "pro");
      console.log("[billing] PRO activated for", email);
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      // Find by customer or subscription id
      const custId = typeof sub.customer === "string" ? sub.customer : (sub.customer as any)?.id;
      const user = await prisma.user.findFirst({
        where: { OR: [{ stripeCustomerId: custId }, { stripeSubId: sub.id }] }
      });
      if (!user) break;
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { plan: "free", stripeSubId: null },
      });
      await applyPlanToUserKeys(updated.id, "free");
      console.log("[billing] Downgraded to FREE:", updated.email);
      break;
    }
    default:
      // ignore others for now
      break;
  }

  res.json({ received: true });
}



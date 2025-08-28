import type { Request, Response } from "express";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
	apiVersion: "2024-06-20",
});

export async function stripeWebhook(req: Request, res: Response) {
	const signature = req.headers["stripe-signature"] as string | undefined;
	if (!signature) return res.status(400).send("Missing sig");

	let event: Stripe.Event;
	try {
		// req.body is a Buffer because we mount this route with express.raw({ type: "application/json" })
		event = stripe.webhooks.constructEvent(
			req.body as any,
			signature,
			process.env.STRIPE_WEBHOOK_SECRET as string
		);
	} catch (err: any) {
		return res.status(400).send(`Webhook Error: ${err.message}`);
	}

	if (event.type === "checkout.session.completed") {
		const session = event.data.object as Stripe.Checkout.Session;
		const email = session.customer_email ?? undefined;
		console.log("Pro subscription started for", email);
	}

	if (event.type === "customer.subscription.deleted") {
		const subscription = event.data.object as Stripe.Subscription;
		// In live setups you would look up the customer to resolve email/user
		console.log("Pro subscription cancelled", subscription.id);
	}

	return res.json({ received: true });
}



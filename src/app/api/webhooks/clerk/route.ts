// Clerk Webhook Handler
// Syncs Clerk user data to Supabase user_profiles table

import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error("[Clerk Webhook] Missing CLERK_WEBHOOK_SECRET");
    return Response.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  // Get headers for verification
  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  // Validate required headers
  if (!svixId || !svixTimestamp || !svixSignature) {
    console.error("[Clerk Webhook] Missing svix headers");
    return Response.json({ error: "Missing svix headers" }, { status: 400 });
  }

  // Get the raw body for signature verification
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Verify the webhook signature
  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("[Clerk Webhook] Signature verification failed:", err);
    return Response.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  // Handle the webhook event
  const eventType = evt.type;
  console.log(`[Clerk Webhook] Received event: ${eventType}`);

  try {
    const supabase = createAdminClient();

    switch (eventType) {
      case "user.created":
      case "user.updated": {
        const {
          id,
          email_addresses,
          primary_email_address_id,
          first_name,
          last_name,
          image_url,
          created_at,
          updated_at,
        } = evt.data;

        // Find primary email
        const primaryEmail = email_addresses?.find(
          (email) => email.id === primary_email_address_id
        )?.email_address;

        // Upsert user profile
        const { error } = await supabase.from("user_profiles").upsert(
          {
            id: id,
            email: primaryEmail ?? null,
            first_name: first_name ?? null,
            last_name: last_name ?? null,
            avatar_url: image_url ?? null,
            created_at: new Date(created_at).toISOString(),
            updated_at: new Date(updated_at).toISOString(),
          },
          { onConflict: "id" }
        );

        if (error) {
          console.error(`[Clerk Webhook] Error upserting user ${id}:`, error);
          return Response.json({ error: "Database error" }, { status: 500 });
        }

        console.log(`[Clerk Webhook] User ${eventType === "user.created" ? "created" : "updated"}: ${id}`);
        break;
      }

      case "user.deleted": {
        const { id } = evt.data;

        if (id) {
          // Soft delete: set deleted_at timestamp
          const { error } = await supabase
            .from("user_profiles")
            .update({ deleted_at: new Date().toISOString() })
            .eq("id", id);

          if (error) {
            console.error(`[Clerk Webhook] Error deleting user ${id}:`, error);
            return Response.json({ error: "Database error" }, { status: 500 });
          }

          console.log(`[Clerk Webhook] User soft-deleted: ${id}`);
        }
        break;
      }

      default:
        console.log(`[Clerk Webhook] Unhandled event type: ${eventType}`);
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error("[Clerk Webhook] Unexpected error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

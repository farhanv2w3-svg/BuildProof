import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push";

Deno.serve(async (request) => {
  if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });

  const webhookSecret = Deno.env.get("PUSH_WEBHOOK_SECRET");
  if (!webhookSecret || request.headers.get("x-buildproof-webhook-secret") !== webhookSecret) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@buildproof.org";
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!publicKey || !privateKey || !url || !serviceRoleKey) {
    return Response.json({ error: "Push is not configured" }, { status: 503 });
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: jobs } = await supabase
    .from("push_delivery_outbox")
    .select("id,subscription_id,payload,push_subscriptions(endpoint,p256dh,auth)")
    .eq("status", "pending")
    .lte("next_attempt_at", new Date().toISOString())
    .limit(50);

  for (const job of jobs ?? []) {
    const subscription = job.push_subscriptions as unknown as {
      endpoint: string;
      p256dh: string;
      auth: string;
    } | null;
    if (!subscription) continue;
    try {
      await webpush.sendNotification(subscription, JSON.stringify(job.payload));
      await supabase.from("push_delivery_outbox").update({
        status: "sent",
        delivered_at: new Date().toISOString(),
        last_error: null,
      }).eq("id", job.id);
    } catch (error) {
      const statusCode = typeof error === "object" && error !== null && "statusCode" in error
        ? Number((error as { statusCode: number }).statusCode)
        : undefined;
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", job.subscription_id);
        await supabase.from("push_delivery_outbox").update({
          status: "failed",
          last_error: "Subscription expired",
        }).eq("id", job.id);
      } else {
        await supabase.from("push_delivery_outbox").update({
          status: "failed",
          last_error: "Browser push provider rejected delivery",
          next_attempt_at: new Date(Date.now() + 30 * 60_000).toISOString(),
        }).eq("id", job.id);
      }
    }
  }

  return Response.json({ processed: jobs?.length ?? 0 });
});

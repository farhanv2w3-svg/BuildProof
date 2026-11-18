import { createClient } from "npm:@supabase/supabase-js@2";

type WebPushModule = {
  setVapidDetails: (subject: string, publicKey: string, privateKey: string) => void;
  sendNotification: (
    subscription: { endpoint: string; p256dh: string; auth: string },
    payload?: string,
  ) => Promise<unknown>;
};

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

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

  try {
    let webpush: WebPushModule;
    try {
      const imported = await import("npm:web-push");
      webpush = (imported.default ?? imported) as unknown as WebPushModule;
    } catch (importError) {
      const message = importError instanceof Error ? importError.message : String(importError);
      console.error("web-push import failed:", message);
      return Response.json({
        ok: false,
        error: "web-push dependency failed to load",
        detail: message.slice(0, 300),
      }, { status: 500 });
    }

    try {
      webpush.setVapidDetails(subject, publicKey, privateKey);
    } catch (vapidError) {
      const message = vapidError instanceof Error ? vapidError.message : String(vapidError);
      console.error("invalid VAPID configuration:", message);
      return Response.json({
        ok: false,
        error: "invalid VAPID configuration",
        detail: message.slice(0, 300),
      }, { status: 500 });
    }

    const supabase = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: jobs, error: jobsError } = await supabase
      .from("push_delivery_outbox")
      .select("id,subscription_id,payload,push_subscriptions(endpoint,p256dh,auth)")
      .eq("status", "pending")
      .lte("next_attempt_at", new Date().toISOString())
      .limit(50);
    if (jobsError) {
      console.error("push outbox query failed:", jobsError.message);
      return Response.json({
        ok: false,
        error: "push outbox query failed",
        detail: jobsError.message,
      }, { status: 500 });
    }

    let delivered = 0;
    let failed = 0;
    let errored = 0;

    for (const job of jobs ?? []) {
      const subscription = job.push_subscriptions as unknown as {
        endpoint: string;
        p256dh: string;
        auth: string;
      } | null;
      if (!subscription) continue;

      try {
        await webpush.sendNotification(subscription, JSON.stringify(job.payload));
        const { error: sentError } = await supabase.from("push_delivery_outbox").update({
          status: "sent",
          delivered_at: new Date().toISOString(),
          last_error: null,
        }).eq("id", job.id);
        if (sentError) {
          console.error("push sent update failed:", sentError.message);
          errored += 1;
        } else {
          delivered += 1;
        }
      } catch (error) {
        const statusCode = typeof error === "object" && error !== null && "statusCode" in error
          ? Number((error as { statusCode: number }).statusCode)
          : undefined;
        if (statusCode === 404 || statusCode === 410) {
          const { error: deleteError } = await supabase
            .from("push_subscriptions")
            .delete()
            .eq("id", job.subscription_id);
          if (deleteError) {
            console.error("push subscription delete failed:", deleteError.message);
            errored += 1;
          }
          const { error: failedError } = await supabase.from("push_delivery_outbox").update({
            status: "failed",
            last_error: "Subscription expired",
          }).eq("id", job.id);
          if (failedError) {
            console.error("push failed update failed:", failedError.message);
            errored += 1;
          } else {
            failed += 1;
          }
        } else {
          const { error: failedError } = await supabase.from("push_delivery_outbox").update({
            status: "failed",
            last_error: "Browser push provider rejected delivery",
            next_attempt_at: new Date(Date.now() + 30 * 60_000).toISOString(),
          }).eq("id", job.id);
          if (failedError) {
            console.error("push failed update failed:", failedError.message);
            errored += 1;
          } else {
            failed += 1;
          }
        }
      }
    }

    if (errored > 0) {
      return Response.json({
        ok: false,
        processed: jobs?.length ?? 0,
        delivered,
        failed,
        errors: errored,
      }, { status: 500 });
    }

    return Response.json({
      ok: true,
      processed: jobs?.length ?? 0,
      delivered,
      failed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("send-web-push failed:", message);
    return Response.json({
      ok: false,
      error: "push worker failed",
      detail: message.slice(0, 300),
    }, { status: 500 });
  }
});

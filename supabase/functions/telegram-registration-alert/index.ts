import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const webhookSecret = Deno.env.get("REGISTRATION_WEBHOOK_SECRET");
  if (
    !webhookSecret ||
    request.headers.get("x-buildproof-webhook-secret") !== webhookSecret
  ) {
    return json({ error: "Forbidden" }, 403);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN")?.trim();
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID")?.trim();
  if (!supabaseUrl || !serviceRoleKey || !botToken || !chatId) {
    return json({ error: "Delivery is not configured" }, 503);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const requestedUserId = typeof payload === "object" && payload !== null
    ? (payload as { record?: { user_id?: unknown } }).record?.user_id
    : undefined;
  const userId = typeof requestedUserId === "string"
    ? requestedUserId
    : undefined;
  if (
    requestedUserId !== undefined &&
    (typeof userId !== "string" || !/^[0-9a-f-]{36}$/i.test(userId))
  ) {
    return json({ error: "Invalid user identifier" }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let userIds = userId ? [userId] : [];
  if (
    typeof payload === "object" && payload !== null &&
    (payload as { test?: unknown }).test === true
  ) {
    const tokenDiagnostics = {
      token_length: botToken.length,
      token_format_ok: /^\d+:[A-Za-z0-9_-]{30,}$/.test(botToken),
      token_has_inner_whitespace: /\s/.test(botToken),
    };
    let getMeSummary: {
      http_status: number;
      ok: boolean;
      bot_username?: string;
      bot_id?: number;
    } = { http_status: 0, ok: false };
    try {
      const getMeResponse = await fetch(
        `https://api.telegram.org/bot${botToken}/getMe`,
        { method: "GET", signal: AbortSignal.timeout(15_000) },
      );
      getMeSummary = await summarizeGetMe(getMeResponse);
    } catch {
      getMeSummary = { http_status: 0, ok: false };
    }
    try {
      const telegramResponse = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text:
              "BuildProof notification test: Telegram delivery is operational.",
            disable_web_page_preview: true,
          }),
          signal: AbortSignal.timeout(15_000),
        },
      );
      const telegramResult = await readTelegramResponse(
        telegramResponse,
        botToken,
        chatId,
      );
      return json({
        ...telegramResult,
        get_me: getMeSummary,
        diagnostics: tokenDiagnostics,
      }, telegramResult.ok ? 200 : 502);
    } catch {
      return json({
        ok: false,
        telegram_status: 0,
        error_code: 0,
        error_description: "Telegram request failed",
        get_me: getMeSummary,
        diagnostics: tokenDiagnostics,
      });
    }
  }
  if (!userId) {
    const { data: dueRows } = await supabase
      .from("registration_notification_outbox")
      .select("user_id")
      .in("status", ["pending", "failed"])
      .lte("next_attempt_at", new Date().toISOString())
      .limit(20);
    userIds = (dueRows ?? []).map((row) => String(row.user_id));
  }

  for (const targetUserId of userIds) {
    await processUser(supabase, targetUserId, botToken, chatId);
  }
  return json({ ok: true, processed: userIds.length });
});

async function processUser(
  supabase: SupabaseClient<any>,
  userId: string,
  botToken: string,
  chatId: string,
) {
  const { data, error } = await supabase
    .from("registration_notification_outbox")
    .select("user_id,email,display_name,registered_at,status,attempt_count")
    .eq("user_id", userId)
    .single();

  if (error || !data || data.status === "sent") return;

  const { data: claimed, error: claimError } = await supabase.rpc(
    "claim_registration_notification",
    { target_user_id: userId },
  );
  if (claimError || claimed !== true || data.status === "sent") return;

  const lines = [
    "BuildProof new registration",
    `Registered: ${data.registered_at}`,
  ];
  if (data.display_name) lines.push(`Name: ${data.display_name}`);
  if (data.email) lines.push(`Email: ${data.email}`);

  let telegramResponse: Response;
  try {
    telegramResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: lines.join("\n"),
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );
  } catch {
    await markFailed(
      supabase,
      userId,
      (data.attempt_count ?? 0) + 1,
      "Telegram request failed",
    );
    return;
  }

  const telegramResult = await readTelegramResponse(
    telegramResponse,
    botToken,
    chatId,
  );
  if (!telegramResult.ok) {
    await markFailed(
      supabase,
      userId,
      (data.attempt_count ?? 0) + 1,
      telegramResult.error_description ?? "Telegram API rejected delivery",
    );
    return;
  }

  await supabase
    .from("registration_notification_outbox")
    .update({
      status: "sent",
      delivered_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("status", "processing");
}

async function readTelegramResponse(
  response: Response,
  botToken: string,
  chatId: string,
): Promise<
  {
    ok: boolean;
    telegram_status: number;
    error_code?: number;
    error_description?: string;
  }
> {
  const telegramStatus = response.status;
  let telegramResult: unknown;
  try {
    telegramResult = await response.json();
  } catch {
    return {
      ok: false,
      telegram_status: telegramStatus,
      error_code: telegramStatus,
      error_description: "Telegram returned invalid JSON",
    };
  }

  if (typeof telegramResult !== "object" || telegramResult === null) {
    return {
      ok: false,
      telegram_status: telegramStatus,
      error_code: telegramStatus,
      error_description: "Telegram returned an unexpected response",
    };
  }

  const result = telegramResult as {
    ok?: unknown;
    error_code?: unknown;
    description?: unknown;
  };
  const telegramOk = result.ok === true && response.ok;
  const errorCode = typeof result.error_code === "number"
    ? result.error_code
    : undefined;
  const description = typeof result.description === "string"
    ? sanitizeTelegramDescription(result.description, botToken, chatId)
    : undefined;

  return {
    ok: telegramOk,
    telegram_status: telegramStatus,
    ...(telegramOk ? {} : {
      error_code: errorCode ?? telegramStatus,
      error_description: description ?? "Telegram API rejected delivery",
    }),
  };
}

async function summarizeGetMe(
  response: Response,
): Promise<{
  http_status: number;
  ok: boolean;
  bot_username?: string;
  bot_id?: number;
}> {
  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    return { http_status: response.status, ok: false };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return { http_status: response.status, ok: false };
  }
  const result = parsed as {
    ok?: unknown;
    result?: { username?: unknown; id?: unknown };
  };
  if (
    result.ok !== true || typeof result.result !== "object" ||
    result.result === null
  ) {
    return { http_status: response.status, ok: false };
  }
  const username = typeof result.result.username === "string"
    ? result.result.username
    : undefined;
  const botId = typeof result.result.id === "number"
    ? result.result.id
    : undefined;
  return {
    http_status: response.status,
    ok: true,
    bot_username: username,
    bot_id: botId,
  };
}

function sanitizeTelegramDescription(
  description: string,
  botToken: string,
  chatId: string,
): string {
  return description
    .replaceAll(botToken, "[REDACTED]")
    .replaceAll(chatId, "[REDACTED]")
    .slice(0, 500);
}

async function markFailed(
  supabase: SupabaseClient<any>,
  userId: string,
  attempts: number,
  message: string,
) {
  const delayMinutes = Math.min(60, 2 ** Math.min(attempts - 1, 5));
  await supabase
    .from("registration_notification_outbox")
    .update({
      status: "failed",
      attempt_count: attempts,
      next_attempt_at: new Date(Date.now() + delayMinutes * 60_000)
        .toISOString(),
      last_error: message,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

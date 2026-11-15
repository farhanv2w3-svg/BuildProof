# BuildProof notification setup

This guide describes manual production setup. It contains no secrets and does not perform a production action.

## Telegram bot

1. In Telegram, open a conversation with **@BotFather**.
2. Run `/newbot` and follow the prompts.
3. Start a chat with the new bot so it can send you messages.
4. Retrieve the destination chat ID from your Telegram account/chat tooling or a Telegram API update response. Supply the owner chat ID only to the Supabase secret, not to Git.
5. Set Supabase secrets, using the newly rotated bot token:

```sh
supabase secrets set TELEGRAM_BOT_TOKEN="<new-token>"
supabase secrets set TELEGRAM_CHAT_ID="<owner-chat-id>"
supabase secrets set REGISTRATION_WEBHOOK_SECRET="<random-long-secret>"
```

The former Telegram token must be revoked in BotFather before production use.

## Registration delivery architecture

The `on_auth_user_created` trigger queues every new user exactly once in
`registration_notification_outbox`. The queue is separate from account signup,
so Telegram outages cannot break registration. Configure a Supabase Database
Webhook on the outbox `INSERT` event to call `telegram-registration-alert`.

Set the webhook custom header:

```text
x-buildproof-webhook-secret: <same-random-long-secret>
```

Database webhooks do not provide an application-level guarantee for every
network failure. A scheduled retry worker or Supabase cron should call the
Edge Function for rows in `pending`/`failed` with `next_attempt_at <= now()`
until `scheduled delivery` infrastructure is approved.

Only `registration_notification_outbox` status and safe delivery errors are
stored. The function response never contains the bot token, and Telegram
request URLs are not logged to application or browser logs.

Safe local simulation:

```sh
curl -i -X POST http://127.0.0.1:54321/functions/v1/telegram-registration-alert \
  -H "Content-Type: application/json" \
  -H "x-buildproof-webhook-secret: <local-test-secret>" \
  -d '{"record":{"user_id":"00000000-0000-4000-8000-000000000000"}}'
```

Do not run against production without explicit approval.

## VAPID push

Generate a key pair with a trusted local command:

```sh
npx web-push generate-vapid-keys
```

Set only the public key in the frontend:

```sh
VITE_VAPID_PUBLIC_KEY=<public-key>
```

Set private/server values using Supabase secrets:

```sh
supabase secrets set VAPID_PUBLIC_KEY="<public-key>"
supabase secrets set VAPID_PRIVATE_KEY="<private-key>"
supabase secrets set VAPID_SUBJECT="mailto:admin@example.com"
supabase secrets set PUSH_WEBHOOK_SECRET="<random-long-secret>"
```

Never place `VAPID_PRIVATE_KEY` in Vite configuration, Git, Cloudflare frontend
variables, browser JavaScript or documentation.

## Deploying locally prepared functions

Deploy only after production approval:

```sh
supabase functions deploy telegram-registration-alert
supabase functions deploy send-web-push
```

Apply migration only after explicit database approval:

```sh
supabase db push
```

## User push setup

1. Open BuildProof while signed in.
2. Open **Notifications > Notification preferences**.
3. Read the explanation and choose **Enable push**.
4. Confirm the browser permission.
5. Use **Disable push** to remove the subscription and revoke push delivery.

Android and desktop Chromium/Firefox browsers generally support web push, but
availability and battery behavior vary. iOS support generally requires an
eligible installed PWA/web app and browser permission. Unsupported or denied
browsers fail gracefully and are not prompted repeatedly by this application.

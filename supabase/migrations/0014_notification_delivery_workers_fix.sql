create or replace function public.dispatch_registration_notification()
returns trigger
language plpgsql
security definer
set search_path = public, net, extensions
as $$
declare
  webhook_secret text;
begin
  select decrypted_secret into webhook_secret
  from vault.decrypted_secrets
  where name = 'buildproof_registration_webhook';
  if webhook_secret is not null then
    perform net.http_post(
      url := 'https://rwvfzsnbfqchyzqtdqpi.supabase.co/functions/v1/telegram-registration-alert',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-buildproof-webhook-secret', webhook_secret
      ),
      body := jsonb_build_object('record', jsonb_build_object('user_id', new.user_id))
    );
  end if;
  return new;
end;
$$;

create or replace function public.dispatch_notification_delivery_jobs()
returns void
language plpgsql
security definer
set search_path = public, net, extensions
as $$
declare
  webhook_secret text;
begin
  select decrypted_secret into webhook_secret
  from vault.decrypted_secrets
  where name = 'buildproof_registration_webhook';
  if webhook_secret is not null then
    perform net.http_post(
      url := 'https://rwvfzsnbfqchyzqtdqpi.supabase.co/functions/v1/telegram-registration-alert',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-buildproof-webhook-secret', webhook_secret
      ),
      body := '{}'::jsonb
    );
  end if;

  select decrypted_secret into webhook_secret
  from vault.decrypted_secrets
  where name = 'buildproof_push_webhook';
  if webhook_secret is not null then
    perform net.http_post(
      url := 'https://rwvfzsnbfqchyzqtdqpi.supabase.co/functions/v1/send-web-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-buildproof-webhook-secret', webhook_secret
      ),
      body := '{}'::jsonb
    );
  end if;
end;
$$;

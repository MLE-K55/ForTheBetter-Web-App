-- Run after the migration, deployment, and server environment variables are set.
-- In Supabase Vault, create these secrets through the dashboard:
-- daily_reminder_app_url = https://your-production-domain
-- daily_reminder_cron_secret = the exact CRON_SECRET configured on Vercel
create extension if not exists pg_cron;
create extension if not exists pg_net;
-- Re-running this script updates the existing job rather than duplicating it.
select cron.schedule(
  'daily-email-reminders',
  '* * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'daily_reminder_app_url') || '/api/reminders?action=run',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'daily_reminder_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $job$
);

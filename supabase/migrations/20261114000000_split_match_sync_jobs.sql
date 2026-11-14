/*
 * Split the original minute tick into a full discovery pass every 15 minutes
 * and a minute-by-minute refresh of tracked upcoming/live matches. The full
 * pass also refreshes tracked matches, so the live job skips those same minutes
 * to avoid concurrent writes to the same rows.
 * Install the updated site-admin function before applying this migration.
 */
DO $$
DECLARE
  job record;
BEGIN
  FOR job IN SELECT jobid FROM cron.job WHERE jobname IN ('site-sync-tick', 'site-sync-live', 'site-sync-full') LOOP
    PERFORM cron.unschedule(job.jobid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'site-sync-live',
  '1-14,16-29,31-44,46-59 * * * *',
  $job$
  SELECT net.http_post(
    url := 'https://dydsgyjwjbrcymkvzrji.supabase.co/functions/v1/site-admin',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT value FROM public.esea_secrets WHERE key = 'cron_secret')
    ),
    body := '{"action":"cron_tick","mode":"live"}'::jsonb,
    timeout_milliseconds := 120000
  );
  $job$
);

SELECT cron.schedule(
  'site-sync-full',
  '*/15 * * * *',
  $job$
  SELECT net.http_post(
    url := 'https://dydsgyjwjbrcymkvzrji.supabase.co/functions/v1/site-admin',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT value FROM public.esea_secrets WHERE key = 'cron_secret')
    ),
    body := '{"action":"cron_tick","mode":"full"}'::jsonb,
    timeout_milliseconds := 120000
  );
  $job$
);

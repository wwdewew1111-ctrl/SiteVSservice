/*
# Match lifecycle (upcoming -> live -> finished) and server-side sync scheduler

Plain-English summary:
Matches now carry a phase that the server moves automatically as FACEIT reports
progress. Finished FACEIT matches are archived with their map-by-map results.
A database scheduler calls the site server once per minute so the sync runs
without anyone keeping the admin panel open. Public visitors receive changes
live through realtime updates.

## 1. Modified tables
- `matches`:
  - `phase` (text: upcoming / live / finished, default upcoming). Existing
    matches that already have a final score are marked finished.
  - `maps` (jsonb, default empty list) - per-map results of a finished match.

## 2. Realtime
- `matches` is added to the realtime publication so visitors see phase and
  score changes without reloading the page.

## 3. Scheduler
- Extensions `pg_cron` and `pg_net` are enabled.
- A random shared secret `cron_secret` is stored in `esea_secrets` (never
  readable from the browser). The site server checks it on every scheduled call.
- Job `site-sync-tick` runs every minute and calls the `site-admin` function.

## 4. Security
- No changes to row level security or grants on public tables.
- The scheduler secret lives only in the server-only secrets table.

## 5. Important notes
1. Re-running this migration is safe: columns use IF NOT EXISTS, the publication
   membership is checked first, the secret is created only once, and the job is
   rescheduled under the same name.
*/

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

ALTER TABLE matches ADD COLUMN IF NOT EXISTS phase text NOT NULL DEFAULT 'upcoming'
  CHECK (phase IN ('upcoming', 'live', 'finished'));
ALTER TABLE matches ADD COLUMN IF NOT EXISTS maps jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE matches
SET phase = 'finished'
WHERE phase = 'upcoming' AND team_score IS NOT NULL AND opponent_score IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'matches'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE matches;
  END IF;
END $$;

INSERT INTO esea_secrets (key, value)
VALUES ('cron_secret', gen_random_uuid()::text || gen_random_uuid()::text)
ON CONFLICT (key) DO NOTHING;

SELECT cron.schedule(
  'site-sync-tick',
  '* * * * *',
  $job$
  SELECT net.http_post(
    url := 'https://dydsgyjwjbrcymkvzrji.supabase.co/functions/v1/site-admin',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT value FROM esea_secrets WHERE key = 'cron_secret')
    ),
    body := '{"action":"cron_tick"}'::jsonb
  );
  $job$
);

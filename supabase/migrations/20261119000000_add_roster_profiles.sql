-- Optional profile information for roster members; existing records keep empty values.
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS surname text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bio text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS quote text NOT NULL DEFAULT '';

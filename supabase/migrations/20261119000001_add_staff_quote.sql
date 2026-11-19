-- Support databases where the earlier roster-profile migration was already applied.
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS quote text NOT NULL DEFAULT '';

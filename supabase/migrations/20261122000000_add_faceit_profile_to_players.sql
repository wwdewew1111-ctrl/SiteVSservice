-- Store the canonical FACEIT profile reference for roster and staff records.
-- It may be a FACEIT profile URL or a player_id; the public nickname remains editable separately.
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS faceit_profile text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.players.faceit_profile IS
  'FACEIT profile URL or stable FACEIT player_id used by ESEA synchronization';

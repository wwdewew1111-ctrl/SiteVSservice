import { useState } from 'react';
import type { Match } from '@/types';
import { matchUnitLabel } from '@/lib/format';

interface MatchScoreEditorProps {
  match: Match;
  onSave: (match: Match) => Promise<boolean>;
}

function parseScore(value: string): number | null | 'invalid' {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 99) return 'invalid';
  return parsed;
}

function toInputValue(score: number | null): string {
  return score === null ? '' : String(score);
}

export function MatchScoreEditor({ match, onSave }: MatchScoreEditorProps) {
  const [teamInput, setTeamInput] = useState(toInputValue(match.teamScore));
  const [opponentInput, setOpponentInput] = useState(toInputValue(match.opponentScore));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const unit = matchUnitLabel(match.format);

  const handleSave = async () => {
    const teamScore = parseScore(teamInput);
    const opponentScore = parseScore(opponentInput);
    if (teamScore === 'invalid' || opponentScore === 'invalid') {
      setError('Счёт должен быть целым числом от 0 до 99');
      return;
    }
    if ((teamScore === null) !== (opponentScore === null)) {
      setError('Заполните счёт обеих команд или оставьте оба поля пустыми');
      return;
    }
    setError(null);
    setSaving(true);
    const saved = await onSave({ ...match, teamScore, opponentScore });
    setSaving(false);
    if (!saved) setError('Не удалось сохранить счёт. Попробуйте ещё раз.');
  };

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-end">
      <div className="min-w-0 flex-1">
        <p className="label">Счёт · {match.format.toUpperCase()}</p>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <input
            type="number"
            min={0}
            max={99}
            inputMode="numeric"
            value={teamInput}
            onChange={(event) => setTeamInput(event.target.value)}
            placeholder={unit}
            aria-label={`Счёт КАБАНЫ ЕСПОРТС: ${unit.toLowerCase()}`}
            className="input text-center"
          />
          <span className="text-muted">:</span>
          <input
            type="number"
            min={0}
            max={99}
            inputMode="numeric"
            value={opponentInput}
            onChange={(event) => setOpponentInput(event.target.value)}
            placeholder={unit}
            aria-label={`Счёт ${match.opponent}: ${unit.toLowerCase()}`}
            className="input text-center"
          />
        </div>
        {error && (
          <p role="alert" className="mt-2 text-sm text-error-700 dark:text-error-500">
            {error}
          </p>
        )}
      </div>
      <button type="button" onClick={handleSave} disabled={saving} className="btn-outline h-10 sm:shrink-0">
        {saving ? 'Сохраняем...' : 'Сохранить счёт'}
      </button>
    </div>
  );
}

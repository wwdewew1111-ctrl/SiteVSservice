import { useState, type FormEvent } from 'react';
import type { Match, MatchFormat } from '@/types';
import { ImageInput } from '@/components/admin/ImageInput';
import { Field } from '@/components/admin/FormField';

type MatchErrors = Partial<Record<'tournament' | 'opponent' | 'streamUrl', string>>;

interface MatchFormProps {
  initial: Match;
  onSave: (match: Match) => void;
  onCancel: () => void;
}

function toLocalInputValue(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function MatchForm({ initial, onSave, onCancel }: MatchFormProps) {
  const [form, setForm] = useState<Match>(initial);
  const [errors, setErrors] = useState<MatchErrors>({});
  const isNew = initial.tournament === '' && initial.opponent === '';

  const update = <K extends keyof Match>(key: K, value: Match[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: MatchErrors = {};
    const streamUrl = form.streamUrl.trim();
    if (!form.tournament.trim()) nextErrors.tournament = 'Введите название турнира';
    if (!form.opponent.trim()) nextErrors.opponent = 'Введите название команды соперника';
    if (streamUrl && !/^https?:\/\//i.test(streamUrl)) nextErrors.streamUrl = 'Ссылка должна начинаться с https://';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSave({
      ...form,
      tournament: form.tournament.trim(),
      opponent: form.opponent.trim(),
      streamUrl,
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6 p-6 sm:p-8">
      <h2 className="pr-10 text-2xl text-text">{isNew ? 'Новый матч' : 'Редактирование матча'}</h2>

      <Field label="Название турнира" error={errors.tournament}>
        <input
          type="text"
          value={form.tournament}
          onChange={(event) => update('tournament', event.target.value)}
          placeholder="Например: Осенний кубок"
          className="input"
        />
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Дата и время матча">
          <input
            type="datetime-local"
            value={toLocalInputValue(form.startsAt)}
            onChange={(event) => update('startsAt', event.target.value ? new Date(event.target.value).toISOString() : '')}
            className="input"
          />
        </Field>
        <Field label="Ссылка на трансляцию" error={errors.streamUrl}>
          <input
            type="url"
            value={form.streamUrl}
            onChange={(event) => update('streamUrl', event.target.value)}
            placeholder="https://www.twitch.tv/..."
            className="input"
          />
        </Field>
      </div>

      <Field label="Формат матча">
        <select value={form.format} onChange={(event) => update('format', event.target.value as MatchFormat)} className="input">
          <option value="bo1">BO1</option>
          <option value="bo3">BO3</option>
          <option value="bo5">BO5</option>
        </select>
      </Field>

      <Field label="Команда соперника" error={errors.opponent}>
        <input
          type="text"
          value={form.opponent}
          onChange={(event) => update('opponent', event.target.value)}
          placeholder="Например: NORTHLINE"
          className="input"
        />
      </Field>

      <ImageInput
        label="Логотип турнира"
        value={form.tournamentLogo}
        onChange={(value) => update('tournamentLogo', value)}
      />

      <ImageInput
        label="Логотип КАБАНЫ ЕСПОРТС"
        value={form.teamLogo}
        onChange={(value) => update('teamLogo', value)}
      />

      <ImageInput
        label="Логотип команды соперника"
        value={form.opponentLogo}
        onChange={(value) => update('opponentLogo', value)}
      />

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} className="btn-outline">
          Отмена
        </button>
        <button type="submit" className="btn-primary">
          Сохранить матч
        </button>
      </div>
    </form>
  );
}

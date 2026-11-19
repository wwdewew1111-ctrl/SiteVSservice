import { useState, type FormEvent } from 'react';
import type { Player } from '@/types';
import { CS2_ROLES } from '@/lib/roles';
import { ImageInput } from '@/components/admin/ImageInput';
import { Field } from '@/components/admin/FormField';

type PlayerErrors = Partial<Record<'nickname' | 'role', string>>;

interface PlayerFormProps {
  initial: Player;
  onSave: (player: Player) => void;
  onCancel: () => void;
}

export function PlayerForm({ initial, onSave, onCancel }: PlayerFormProps) {
  const [form, setForm] = useState<Player>(initial);
  const [errors, setErrors] = useState<PlayerErrors>({});
  const isNew = initial.nickname === '';

  const update = <K extends keyof Player>(key: K, value: Player[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: PlayerErrors = {};
    if (!form.nickname.trim()) nextErrors.nickname = 'Введите никнейм';
    if (!form.role.trim()) nextErrors.role = form.isCoach ? 'Укажите должность' : 'Укажите роль в CS2';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSave({
      ...form,
      nickname: form.nickname.trim(),
      name: form.name.trim(),
      surname: form.surname.trim(),
      role: form.role.trim(),
      bio: form.bio.trim(),
      quote: form.quote.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6 p-6 sm:p-8">
      <h2 className="pr-10 text-2xl text-text">{isNew ? (form.isCoach ? 'Новый сотрудник' : 'Новый игрок') : `Редактирование ${form.isCoach ? 'сотрудника' : 'игрока'}`}</h2>

      <Field label="Раздел команды">
        <select value={form.isCoach ? 'staff' : 'players'} onChange={(event) => update('isCoach', event.target.value === 'staff')} className="input">
          <option value="players">Состав по CS2</option>
          <option value="staff">Staff</option>
        </select>
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Никнейм" error={errors.nickname}>
          <input
            type="text"
            value={form.nickname}
            onChange={(event) => update('nickname', event.target.value)}
            placeholder="Например: Kolibri"
            className="input"
          />
        </Field>
        <Field label="Имя">
          <input
            type="text"
            value={form.name}
            onChange={(event) => update('name', event.target.value)}
            placeholder="Например: Артём"
            className="input"
          />
        </Field>
        <Field label="Фамилия (необязательно)">
          <input
            type="text"
            value={form.surname}
            onChange={(event) => update('surname', event.target.value)}
            placeholder="Например: Иванов"
            className="input"
          />
        </Field>
      </div>

      <Field label={form.isCoach ? 'Должность' : 'Роль в CS2'} error={errors.role} hint={form.isCoach ? 'Укажите должности через пробел, например: CEO Тренер.' : 'Выберите из списка или напишите свою роль.'}>
        <input
          type="text"
          list={form.isCoach ? undefined : 'cs2-roles'}
          value={form.role}
          onChange={(event) => update('role', event.target.value)}
          placeholder={form.isCoach ? 'Например: Тренер' : 'Например: AWPer / Снайпер'}
          className="input"
        />
        <datalist id="cs2-roles">
          {CS2_ROLES.map((role) => (
            <option key={role} value={role} />
          ))}
        </datalist>
      </Field>

      {form.isCoach && (
        <>
          <Field label="Описание (необязательно)">
            <textarea
              value={form.bio}
              onChange={(event) => update('bio', event.target.value)}
              placeholder="Расскажите о сотруднике"
              className="textarea"
            />
          </Field>
          <Field label="Цитата (необязательно)">
            <textarea
              value={form.quote}
              onChange={(event) => update('quote', event.target.value)}
              placeholder="Цитата сотрудника"
              className="textarea"
            />
          </Field>
        </>
      )}

      <ImageInput label={form.isCoach ? 'Фото сотрудника (необязательно)' : 'Фото игрока (необязательно)'} value={form.photo} onChange={(value) => update('photo', value)} />

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} className="btn-outline">
          Отмена
        </button>
        <button type="submit" className="btn-primary">
          {form.isCoach ? 'Сохранить сотрудника' : 'Сохранить игрока'}
        </button>
      </div>
    </form>
  );
}

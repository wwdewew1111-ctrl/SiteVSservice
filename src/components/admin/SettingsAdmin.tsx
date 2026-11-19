import { useState, type FormEvent } from 'react';
import { Check } from 'lucide-react';
import { useSite } from '@/context/siteStore';
import { cleanSocials, SOCIAL_FIELDS } from '@/lib/socials';
import { TEAM_NAME } from '@/lib/brand';
import type { SiteSettings } from '@/types';
import { ImageInput } from '@/components/admin/ImageInput';
import { Field } from '@/components/admin/FormField';
import { AdminToolbar } from '@/components/admin/AdminToolbar';
import { PartnersEditor } from '@/components/admin/PartnersEditor';

export function SettingsAdmin() {
  const { data, actions } = useSite();
  const [form, setForm] = useState<SiteSettings>(data.settings);
  const [saved, setSaved] = useState(false);

  const update = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) => {
    setSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateSocial = (key: keyof SiteSettings['socials'], value: string) => {
    setSaved(false);
    setForm((current) => ({ ...current, socials: { ...current.socials, [key]: value } }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ok = await actions.saveSettings({
      ...form,
      heroTitle: TEAM_NAME,
      heroSubtitle: form.heroSubtitle.trim(),
      socials: cleanSocials(form.socials),
      partners: form.partners
        .filter((partner) => partner.name.trim())
        .map((partner) => ({ ...partner, name: partner.name.trim(), url: partner.url.trim() })),
    });
    setSaved(ok);
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-10">
      <AdminToolbar
        title="Настройки сайта"
        description="Главный баннер, ссылки на соцсети команды и партнеры в подвале сайта."
        action={
          <button type="submit" className="btn-primary">
            Сохранить настройки
          </button>
        }
      />

      {saved && (
        <p role="status" className="flex items-center gap-2 rounded-lg border border-success-500/40 bg-success-500/10 px-4 py-3 text-sm font-medium text-success-700 dark:text-success-500">
          <Check className="h-4 w-4" />
          Изменения сохранены и уже видны на сайте.
        </p>
      )}

      <section className="card space-y-6 p-6 sm:p-8">
        <h3 className="text-xl text-text">Главный баннер</h3>
        <Field label="Название команды" hint="Название используется на главном баннере.">
          <input type="text" value={TEAM_NAME} readOnly className="input" />
        </Field>
        <Field label="Слоган">
          <textarea
            value={form.heroSubtitle}
            onChange={(event) => update('heroSubtitle', event.target.value)}
            rows={2}
            className="textarea"
          />
        </Field>
        <ImageInput label="Фон баннера" value={form.heroImage} onChange={(value) => update('heroImage', value)} />
      </section>

      <section className="card space-y-6 p-6 sm:p-8">
        <h3 className="text-xl text-text">Ссылки на соцсети</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {SOCIAL_FIELDS.map(({ key, label }) => (
            <Field key={key} label={label}>
              <input
                type="text"
                value={form.socials[key] ?? ''}
                onChange={(event) => updateSocial(key, event.target.value)}
                placeholder="https://..."
                className="input"
              />
            </Field>
          ))}
        </div>
      </section>

      <section className="card space-y-6 p-6 sm:p-8">
        <div>
          <h3 className="text-xl text-text">Партнеры</h3>
          <p className="mt-2 text-sm text-muted">Логотипы и названия появятся в подвале сайта. Партнер без логотипа отобразится текстом.</p>
        </div>
        <PartnersEditor partners={form.partners} onChange={(partners) => update('partners', partners)} />
      </section>
    </form>
  );
}

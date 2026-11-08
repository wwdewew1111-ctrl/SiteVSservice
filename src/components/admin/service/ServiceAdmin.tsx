import { useEffect, useRef, useState } from 'react';
import './service.css';
import './site-overrides.css';

export function ServiceAdmin() {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    const root = ref.current;
    let dispose: () => void = () => undefined;
    import('./main.js')
      .then(({ initService }) => {
        if (disposed || !root) return;
        root.innerHTML = markup;
        dispose = initService(root);
      })
      .catch((reason: unknown) => {
        if (!disposed) setError(reason instanceof Error ? reason.message : 'Не удалось загрузить сервис.');
      });
    return () => {
      disposed = true;
      dispose();
      root?.replaceChildren();
    };
  }, []);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl">Сервис</h1>
        <p className="mt-2 text-sm text-muted">Карточки и статистика FACEIT доступны только в админ-панели. Для работы сохраните ключ FACEIT в разделе «Статистика ESEA».</p>
      </div>
      {error ? <div role="alert" className="rounded-lg border border-error-500/50 bg-error-500/10 p-4 text-sm text-error-700 dark:text-error-500">{error}</div> : <div ref={ref} className="service-tool card p-4 sm:p-6" />}
    </section>
  );
}

const markup = `
<div class="tabs">
  <button type="button" class="tab active" data-mode="match">Карточка матча</button>
  <button type="button" class="tab" data-mode="preview">Превью</button>
  <button type="button" class="tab" data-mode="player">Карточка игрока</button>
  <button type="button" class="tab" data-mode="season">Итоги сезона</button>
</div>
<div id="bar" class="bar">
  <div id="matchPanel" class="panel">
    <div class="line"><input id="input" class="field" type="text" autocomplete="off" aria-label="Ссылка на матч и название турнира" placeholder="Ссылка на матч FACEIT и название турнира"><button id="create" class="btn primary">Создать</button></div>
    <div id="teamLogos" class="line"></div>
  </div>
  <div id="previewPanel" class="panel" hidden>
    <div class="line"><input id="previewLink" class="field" type="text" autocomplete="off" aria-label="Ссылка на матч" placeholder="Ссылка на предстоящий матч FACEIT"><button id="previewCreate" class="btn primary">Создать превью</button></div>
    <div id="previewOptions" class="panel" hidden>
      <div class="preview-fields"><input id="previewTitle" class="field" type="text" maxlength="90" placeholder="Название турнира" aria-label="Название турнира"><input id="previewSubtitle" class="field" type="text" maxlength="60" placeholder="Этап турнира" aria-label="Этап турнира"></div>
      <div class="preview-fields"><input id="previewDate" class="field" type="date" aria-label="Дата матча по Москве"><input id="previewTime" class="field" type="time" aria-label="Время матча по Москве"><input id="previewFormat" class="field" type="text" maxlength="12" placeholder="Формат, например BO3" aria-label="Формат матча"><select id="previewTheme" class="field sel" aria-label="Тема превью"><option value="light">Светлая тема</option><option value="dark">Тёмная тема</option></select></div>
      <div class="preview-hint">Дата и время — по Москве. Названия и логотипы команд сохраняются в этом браузере.</div><div id="previewTeamLogos" class="line"></div>
    </div>
  </div>
  <div id="playerPanel" class="panel" hidden>
    <div class="line"><input id="pMatch" class="field" type="text" autocomplete="off" aria-label="Ссылка на матч" placeholder="Ссылка на матч FACEIT"><select id="pMap" class="field sel" aria-label="Карта" hidden><option value="all">Вся серия</option></select></div>
    <input id="pPlayer" class="field" type="text" autocomplete="off" aria-label="Профиль игрока" placeholder="Ссылка на профиль игрока или ник FACEIT">
    <div class="line"><input id="pNick" class="field" type="text" autocomplete="off" aria-label="Отображаемый ник" placeholder="Отображаемый ник (необязательно)"><select id="pTheme" class="field sel" aria-label="Тема карточки"><option value="light">Светлая тема</option><option value="dark">Тёмная тема</option></select></div>
    <div class="line"><button id="pPhotoBtn" class="btn">Загрузить фото игрока</button><input id="pPhotoFile" type="file" accept="image/*" hidden><input id="pPhotoUrl" class="field" type="text" autocomplete="off" aria-label="Ссылка на фото" placeholder="Ссылка на фото или вставьте картинку через Ctrl+V"><button id="pCreate" class="btn primary">Создать</button></div>
  </div>
  <div class="bar-actions"><button id="logoBtn" class="btn">Лого подвала</button><input id="logoFile" type="file" accept="image/png" hidden><button id="dl" class="btn" disabled>Скачать PNG</button><button id="cp" class="btn" disabled>Скопировать картинку</button></div>
  <div id="status" class="status" role="status"></div>
</div>
<div class="service-card-scroll"><div id="card" hidden></div></div>
<section id="seasonPanel" class="bar" hidden>
  <textarea id="seasonLinks" class="field area" autocomplete="off" aria-label="Ссылки на матчи" placeholder="Ссылки на матчи FACEIT, по одной в строке (до 25)"></textarea>
  <div class="line"><button id="seasonRun" class="btn primary">Собрать итоги сезона</button><button id="seasonLogoBtn" class="btn">Логотип команды</button><input id="seasonLogoFile" type="file" accept="image/*" hidden></div>
  <div id="seasonStatus" class="status" role="status"></div><div id="seasonResults"></div>
</section>
<input id="teamLogoFile" type="file" accept="image/*" hidden>
`;

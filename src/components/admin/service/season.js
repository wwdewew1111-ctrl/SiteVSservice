import { esc, logo, num } from './util.js';
import { MATCH_RE, fetchMatch, fetchRounds, makeSideOf, collect, summarize, avgOf } from './faceit.js';
import { getTeamLogo, setTeamLogo, storeImage } from './storage.js';
import { downloadPng, copyPng } from './export.js';
import { fetchEseaState, getActiveSeason } from '@/services/eseaService';
import { DEFAULT_TEAM_LOGO } from '@/lib/teamLogo';

const TEAM_ID = 'c55b7815-3739-4199-b1b7-d55eade7e489';
const TEAM_NAME = 'TEAM KA6ANbl';
const CARD_TEAM_NAME = 'КАБАНЫ ЕСПОРТС';
const MAX_MATCHES = 25;
const CONCURRENCY = 3;

// FACEIT stat field names per map; verify against a real match response if a column stays at 0.
const SUM_STATS = {
  mvp: ['MVPs'],
  double: ['Double Kills'],
  triple: ['Triple Kills'],
  quadro: ['Quadro Kills'],
  penta: ['Penta Kills'],
  headshots: ['Headshots'],
  damage: ['Damage'],
  utilityCount: ['Utility Count', 'Grenades Thrown'],
  utilityDamage: ['Utility Damage', 'Utility Damage Done'],
  he: ['HE Grenades', 'HE Grenade'],
  flash: ['Flashbangs', 'Flashbangs Thrown'],
  smoke: ['Smoke Grenades', 'Smokes'],
  molotov: ['Molotovs', 'Incendiaries'],
  grenadeKills: ['Grenade Kills', 'HE Grenade Kills'],
  flashAssists: ['Flash Assists'],
  flashSuccess: ['Flash Successes'],
  enemiesFlashed: ['Enemies Flashed'],
  sniper: ['Sniper Kills'],
  knife: ['Knife Kills'],
  zeus: ['Zeus Kills'],
  pistol: ['Pistol Kills'],
  entryAttempts: ['Entry Count'],
  entryWins: ['Entry Wins'],
  clutchKills: ['Clutch Kills'],
  c1v1Wins: ['1v1Wins', '1v1 Wins'],
  c1v1Count: ['1v1Count', '1v1 Count', '1v1 Attempts'],
  c1v2Wins: ['1v2Wins', '1v2 Wins'],
  c1v2Count: ['1v2Count', '1v2 Count', '1v2 Attempts'],
  c1v3Wins: ['1v3Wins', '1v3 Wins'],
  c1v3Count: ['1v3Count', '1v3 Count', '1v3 Attempts'],
  c1v4Wins: ['1v4Wins', '1v4 Wins'],
  c1v4Count: ['1v4Count', '1v4 Count', '1v4 Attempts'],
  c1v5Wins: ['1v5Wins', '1v5 Wins'],
  c1v5Count: ['1v5Count', '1v5 Count', '1v5 Attempts'],
};

const PCT_STATS = {
  adr: ['ADR'],
};

export function initSeason(root) {
const $ = id => root.querySelector(`#${id}`);
  const panel = $('seasonPanel');
  let seasonData = null;
  let seasonRosterIds = [];
  let summarySeasons = [];
  let summarySeason = null;
  let summaryMatch = null;

  const readStat = (ps, aliases) => {
    for (const key of aliases) {
      const v = num(ps[key]);
      if (v !== null) return v;
    }
    return null;
  };

function setSeasonStatus(text, isError = false) {
  const el = $('seasonStatus');
  el.textContent = text;
  el.className = isError ? 'status error' : 'status';
}

function parseLinks(text) {
  const ids = new Set();
  let invalid = 0;
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const m = t.match(MATCH_RE);
    if (m) ids.add(m[1]);
    else invalid++;
  }
  return { ids: [...ids], invalid };
}

function ourSide(match) {
  return [1, 2].find(side => {
    const f = match.teams[`faction${side}`];
    return f?.faction_id === TEAM_ID || (f?.name || '').trim().toLowerCase() === TEAM_NAME.toLowerCase();
  }) ?? null;
}

function collectExtras(rounds, norm) {
  const out = new Map();
  for (const r of rounds) {
    for (const team of r.teams || []) {
      if (norm(team) !== 1) continue;
      for (const pl of team.players || []) {
        const ps = pl.player_stats || {};
        if (!out.has(pl.player_id)) out.set(pl.player_id, { sums: {}, pct: {} });
        const acc = out.get(pl.player_id);
        for (const [key, aliases] of Object.entries(SUM_STATS)) {
          acc.sums[key] = (acc.sums[key] || 0) + (readStat(ps, aliases) ?? 0);
        }
        for (const [key, aliases] of Object.entries(PCT_STATS)) {
          const v = readStat(ps, aliases);
          if (v !== null) (acc.pct[key] ??= []).push(v);
        }
      }
    }
  }
  return out;
}

async function processMatch(id) {
  const match = await fetchMatch(id);
  if (match.status !== 'FINISHED') return { skip: 'матч ещё не завершён' };
  const side = ourSide(match);
  if (!side) return { skip: 'команда не найдена в матче' };

  const rounds = await fetchRounds(id);
  const sideOf = makeSideOf(match);
  const norm = team => (sideOf(team) === side ? 1 : 2);
  const { players, maps } = collect(match, rounds, norm);
  const extras = collectExtras(rounds, norm);

  const records = new Map();
  for (const [pid, p] of players) {
    if (p.side !== 1) continue;
    const s = summarize(p);
    const ex = extras.get(pid) || { sums: {}, pct: {} };
    records.set(pid, {
      playerId: pid,
      nick: s.nick,
      maps: p.mapCount,
      R: p.R,
      k: s.k,
      d: s.d,
      a: s.a,
      rtg: s.rtg,
      hsPct: s.hsPct,
      sums: ex.sums,
      pct: Object.fromEntries(Object.keys(PCT_STATS).map(key => [key, avgOf(ex.pct[key] || [])])),
    });
  }
  return { skip: null, maps, records };
}

function aggregate(list) {
  const players = new Map();
  const maps = new Map();
  for (const m of list) {
    for (const [pid, r] of m.records) {
      if (!players.has(pid)) {
        players.set(pid, { playerId: pid, nick: r.nick, maps: 0, R: 0, k: 0, d: 0, a: 0, rtg: [], kd: [], swing: [], hs: [], sums: {}, pct: {} });
      }
      const a = players.get(pid);
      // The stable FACEIT player ID is the aggregation key; the latest nickname is display-only.
      a.nick = r.nick;
      a.maps += r.maps;
      a.R += r.R;
      a.k += r.k;
      a.d += r.d;
      a.a += r.a;
      a.rtg.push(r.rtg);
      a.kd.push(r.k / Math.max(r.d, 1));
      a.swing.push(r.k - r.d);
      if (r.hsPct !== null) a.hs.push(r.hsPct);
      for (const [key, v] of Object.entries(r.sums)) a.sums[key] = (a.sums[key] || 0) + v;
      for (const [key, v] of Object.entries(r.pct)) (a.pct[key] ??= []).push(v);
    }
    for (const map of m.maps) {
      if (!maps.has(map.name)) maps.set(map.name, { name: map.name, wins: 0, losses: 0, diff: 0 });
      const ms = maps.get(map.name);
      if (map.s[0] > map.s[1]) ms.wins++;
      else if (map.s[0] < map.s[1]) ms.losses++;
      ms.diff += map.s[0] - map.s[1];
    }
  }
  return {
    players: [...players.values()].sort((x, y) => avgOf(y.rtg) - avgOf(x.rtg)),
    maps: [...maps.values()].sort((x, y) => (y.wins + y.losses) - (x.wins + x.losses)),
  };
}

async function mapLimit(items, limit, task) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++];
      await task(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

function seasonCard(index, title, headers, rows, match = null, teamStats = null) {
  const homeLogo = DEFAULT_TEAM_LOGO;
  const wins = teamStats?.wins;
  const losses = teamStats?.losses;
  const hasRecord = Number.isInteger(wins) && wins >= 0 && Number.isInteger(losses) && losses >= 0;
  const awayId = match?.opponentId || `esea-opponent:${match?.id || 'unknown'}`;
  const awayLogo = match?.opponentLogo || getTeamLogo(awayId);
  const score = String(match?.score || '—:—').replace(/\s+/g, '');
  const scoreParts = score.split(':');
  const stats = rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('');
  const statHeaders = headers.map(h => `<th>${esc(h)}</th>`).join('');
  const visualTitle = match ? 'MATCH DAY' : 'SEASON SUMMARY';
  return `<div class="season-item">
    <section class="season-card${match ? ' season-match-card' : ' season-summary-card'}">
      <div class="season-art">
        <div class="season-frame"></div>
        <div class="season-top"><span class="season-label">● ${visualTitle}</span><span>ESEA / CS2</span></div>
        <div class="season-heading"><small>${match ? 'ЗАВЕРШЁННЫЙ МАТЧ' : 'ИТОГИ СЕЗОНА'}</small><h2>${esc(title)}</h2><p>${esc(match ? 'MATCH STATISTICS' : 'TEAM PERFORMANCE')}</p></div>
        ${match ? `<div class="season-versus">
          <div class="season-team">${logo(homeLogo, CARD_TEAM_NAME, 'season-team-logo')}<strong>${esc(CARD_TEAM_NAME)}</strong></div>
          <div class="season-vs">${esc(scoreParts[0] || '—')}<b>:</b>${esc(scoreParts[1] || '—')}</div>
          <div class="season-team">${logo(awayLogo, match.opponent || 'СОПЕРНИК', 'season-team-logo')}<strong>${esc(match.opponent || 'СОПЕРНИК')}</strong></div>
        </div>` : `<div class="season-summary-mark"><span>${logo(homeLogo, CARD_TEAM_NAME, 'season-summary-logo')}</span><div class="season-summary-team"><strong>КАБАНЫ<br>ЕСПОРТС</strong>${hasRecord ? `<div class="season-record"><div><span class="season-record-wins">${wins}</span> – <span class="season-record-losses">${losses}</span></div><small>ПОБЕДЫ / ПОРАЖЕНИЯ · МАТЧЕЙ: ${wins + losses}</small></div>` : ''}</div></div>`}
        <div class="season-stats"><table><thead><tr>${statHeaders}</tr></thead><tbody>${stats}</tbody></table></div>
        <div class="season-footer"><span>VK.RU / КАБАНЫ ЕСПОРТС</span><span>КАБАНЫ ЕСПОРТС</span></div><div class="season-accent"></div>
      </div>
    </section>
    <div class="line">
      <button class="btn" data-action="download" data-index="${index}">Скачать PNG</button>
      <button class="btn" data-action="copy" data-index="${index}">Скопировать картинку</button>
    </div>
  </div>`;
}

function renderSeason() {
  // Only players from the configured season roster are shown; substitutes are excluded.
  const rosterIds = new Set((seasonData.rosterIds || []).filter(Boolean));
  const players = seasonData.players.filter(player => !rosterIds.size || rosterIds.has(player.playerId));
  const s = (a, key) => a.sums[key] || 0;
  const sections = [
    ['Общая статистика',
      ['Игрок', 'Карт', 'K', 'D', 'A', 'Ср. рейтинг', 'Ср. K/D', 'K/R', 'Swing за матч', 'HS', 'HS %', '2K', '3K', '4K', '5K', 'MVP'],
      players.map(a => [
        a.nick, a.maps, a.k, a.d, a.a, avgOf(a.rtg).toFixed(2), avgOf(a.kd).toFixed(2),
        (a.k / Math.max(a.R, 1)).toFixed(2), avgOf(a.swing).toFixed(1),
        s(a, 'headshots'), `${Math.round(avgOf(a.hs))}%`,
        s(a, 'double'), s(a, 'triple'), s(a, 'quadro'), s(a, 'penta'), s(a, 'mvp'),
      ])],
    ['Гранаты',
      ['Игрок', 'HE', 'Flash', 'Smoke', 'Molotov', 'Убийства гранатами', 'Flash assists', 'Урон гранатами', 'Успешных флешей', 'Ослеплено врагов'],
      players.map(a => [
        a.nick, s(a, 'he'), s(a, 'flash'), s(a, 'smoke'), s(a, 'molotov'), s(a, 'grenadeKills'),
        s(a, 'flashAssists'), s(a, 'utilityDamage'), s(a, 'flashSuccess'), s(a, 'enemiesFlashed'),
      ])],
    ['Энтри-статистика',
      ['Игрок', 'Попытки энтри', 'Энтри-убийства', 'Энтри-смерти', 'Разница', '% раундов с энтри', 'Успешность энтри %'],
      players.map(a => {
        const att = s(a, 'entryAttempts'), wins = s(a, 'entryWins'), losses = att - wins;
        return [
          a.nick, att, wins, losses, wins - losses,
          `${(att / Math.max(a.R, 1) * 100).toFixed(1)}%`,
          `${(att ? wins / att * 100 : 0).toFixed(1)}%`,
        ];
      })],
    ['Дополнительно',
      ['Игрок', 'Пистолетные', 'Снайперские', 'Ножевые', 'Zeus'],
      players.map(a => [a.nick, s(a, 'pistol'), s(a, 'sniper'), s(a, 'knife'), s(a, 'zeus')])],
    ['Клатчи',
      ['Игрок', 'Ситуаций', 'Побед', 'Поражений', 'Успех %', 'Клатч-убийства', '1v1', '1v2', '1v3', '1v4', '1v5'],
      players.map(a => {
        const situations = [1, 2, 3, 4, 5].map(level => s(a, `c1v${level}Count`));
        const wins = [1, 2, 3, 4, 5].map(level => s(a, `c1v${level}Wins`));
        const attempts = situations.reduce((total, value) => total + value, 0);
        const won = wins.reduce((total, value) => total + value, 0);
        const result = (level) => {
          const index = level - 1;
          const attemptsForLevel = situations[index];
          const winsForLevel = wins[index];
          return `${winsForLevel}/${attemptsForLevel}${attemptsForLevel ? ` (${(winsForLevel / attemptsForLevel * 100).toFixed(1)}%)` : ''}`;
        };
        return [
          a.nick, attempts, won, attempts - won,
          attempts ? `${(won / attempts * 100).toFixed(1)}%` : '—',
          s(a, 'clutchKills'), result(1), result(2), result(3), result(4), result(5),
        ];
      })],
    ['Статистика по картам',
      ['Карта', 'Победы', 'Поражения', 'Win Rate %', 'Разница раундов'],
      seasonData.maps.map(m => {
        const games = m.wins + m.losses;
        return [
          m.name.toUpperCase(), m.wins, m.losses,
          `${(games ? m.wins / games * 100 : 0).toFixed(1)}%`,
          `${m.diff > 0 ? '+' : ''}${m.diff}`,
        ];
      })],
  ];
  $('seasonResults').innerHTML = sections.map(([title, headers, rows], i) => seasonCard(i, title, headers, rows)).join('');
}

async function loadSummarySeasons() {
  const button = $('seasonSummaryLoad');
  button.disabled = true;
  setSeasonStatus('⏳ Загрузка сезонов ESEA...');
  try {
    const state = await fetchEseaState();
    summarySeasons = state.seasons || [];
    const select = $('seasonSummarySelect');
    select.innerHTML = '<option value="">Выберите сезон</option>' + summarySeasons.map(season => `<option value="${esc(season.id)}">${esc(season.seasonTag)} · ${esc(season.name)}</option>`).join('');
    const active = getActiveSeason(state);
    if (active) select.value = active.id;
    updateSummaryMatches();
    setSeasonStatus(`✅ Загружено сезонов: ${summarySeasons.length}.`);
  } catch (error) {
    setSeasonStatus(error instanceof Error ? error.message : 'Не удалось загрузить сезоны ESEA.', true);
  } finally {
    button.disabled = false;
  }
}

function updateSummaryMatches() {
  const season = summarySeasons.find(item => item.id === $('seasonSummarySelect').value);
  const matches = Array.isArray(season?.matches) ? season.matches : [];
  $('seasonMatchSelect').innerHTML = '<option value="">Выберите матч</option>' + matches.map(match => {
    const title = `${CARD_TEAM_NAME} vs ${match.opponent || 'Соперник'}`;
    const details = [match.date, match.score].filter(Boolean).join(' · ');
    return `<option value="${esc(match.id)}">${esc(title)}${details ? ` · ${esc(details)}` : ''}</option>`;
  }).join('');
}

function renderSummary() {
  const players = [...(summaryMatch ? summaryMatch.players || [] : summarySeason.players || [])].sort((a, b) => (num(b.rating) ?? -Infinity) - (num(a.rating) ?? -Infinity));
  const decimal = (value, digits) => { const n = num(value); return n === null ? '—' : n.toFixed(digits); };
  const rows = players.map(player => {
    const k = num(player.kills) ?? 0, d = num(player.deaths) ?? 0;
    const hs = num(player.hsPercent);
    return [player.nickname, player.role || '—', player.maps, `${k} - ${d}`, `${k - d > 0 ? '+' : ''}${k - d}`,
      (k / Math.max(d, 1)).toFixed(2), decimal(player.adr, 1), hs === null ? '—' : `${hs.toFixed(1)}%`, decimal(player.rating, 2)];
  });
  const title = summaryMatch ? `${CARD_TEAM_NAME} vs ${summaryMatch.opponent || 'Соперник'}` : `${summarySeason.name} · ИТОГИ СЕЗОНА`;
  $('seasonResults').innerHTML = seasonCard(0, title,
    ['Игрок', 'Роль', 'Карты', 'K - D', '+/-', 'K/D', 'ADR', 'HS%', 'Rating'], rows, summaryMatch, summaryMatch ? null : summarySeason.teamStats);
}

function runSummary() {
  summarySeason = summarySeasons.find(season => season.id === $('seasonSummarySelect').value);
  if (!summarySeason) return setSeasonStatus('Загрузите сезоны ESEA и выберите сезон.', true);
  seasonData = null;
  summaryMatch = null;
  renderSummary();
  setSeasonStatus(summarySeason.players?.length ? '✅ Карточка сезона готова.' : 'Карточка создана, но статистика игроков отсутствует.', !summarySeason.players?.length);
}

function runMatchSummary() {
  const season = summarySeasons.find(item => item.id === $('seasonSummarySelect').value);
  if (!season) return setSeasonStatus('Загрузите сезоны ESEA и выберите сезон.', true);
  const match = season.matches?.find(item => item.id === $('seasonMatchSelect').value);
  if (!match) return setSeasonStatus('Выберите матч для карточки.', true);
  summarySeason = season;
  summaryMatch = match;
  seasonData = null;
  renderSummary();
  setSeasonStatus(match.players?.length ? '✅ Карточка матча готова.' : 'Карточка создана, но статистика игроков для этого матча отсутствует.', !match.players?.length);
}

async function loadEseaMatches() {
  const button = $('seasonLoadEsea');
  button.disabled = true;
  setSeasonStatus('⏳ Загрузка матчей активного сезона ESEA...');
  try {
    const state = await fetchEseaState();
    const season = getActiveSeason(state);
    if (!season) return setSeasonStatus('Активный сезон ESEA не найден. Проверьте настройки статистики ESEA.', true);
    const matches = Array.isArray(season.matches) ? season.matches : [];
    seasonRosterIds = (season.players || []).map(player => player.faceitId).filter(Boolean);
    const ids = [...new Set(matches.map(match => match?.id).filter(id => typeof id === 'string' && /^1-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)).map(id => id.toLowerCase()))];
    if (!ids.length) return setSeasonStatus('В активном сезоне нет доступных матчей FACEIT. Сначала синхронизируйте статистику ESEA.', true);

    const field = $('seasonLinks');
    const existing = parseLinks(field.value);
    const knownIds = new Set(existing.ids.map(id => id.toLowerCase()));
    const added = ids.filter(id => !knownIds.has(id.toLowerCase()));
    const links = added.map(id => `https://www.faceit.com/ru/cs2/room/${id}`);
    if (links.length) field.value = [field.value.trimEnd(), ...links].filter(Boolean).join('\n');
    const total = parseLinks(field.value).ids.length;
    const lastSync = Number(state.config.lastSync);
    const syncTime = lastSync > 0 && Number.isFinite(lastSync) ? new Date(lastSync).toLocaleString('ru-RU') : 'нет данных';
    const ignored = matches.length - matches.filter(match => typeof match?.id === 'string' && /^1-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(match.id)).length;
    const warning = total > MAX_MATCHES ? ` В списке ${total} матчей — перед сборкой оставьте не более ${MAX_MATCHES}.` : '';
    const invalidWarning = ignored ? ` Не распознано записей матчей: ${ignored}.` : '';
    setSeasonStatus(`Сезон ${season.seasonTag || season.name}: найдено ${ids.length}, добавлено ${added.length}. Последняя синхронизация: ${syncTime}.${invalidWarning}${warning}`, total > MAX_MATCHES || ignored > 0);
  } catch (error) {
    setSeasonStatus(error instanceof Error ? error.message : 'Не удалось загрузить матчи из ESEA.', true);
  } finally {
    button.disabled = false;
  }
}

async function runSeason() {
  const { ids, invalid } = parseLinks($('seasonLinks').value);
  if (!ids.length) return setSeasonStatus('Вставьте ссылки на матчи FACEIT (по одной в строке).', true);
  if (ids.length > MAX_MATCHES) return setSeasonStatus(`Можно указать не больше ${MAX_MATCHES} матчей.`, true);

  const runBtn = $('seasonRun');
  runBtn.disabled = true;
  const results = [];
  let done = 0;
  const progress = () => setSeasonStatus(`⏳ Загрузка матчей: ${done} из ${ids.length}`);
  progress();

  await mapLimit(ids, CONCURRENCY, async id => {
    try {
      results.push({ id, data: await processMatch(id) });
    } catch (e) {
      results.push({ id, error: e.message });
    }
    done++;
    progress();
  });
  runBtn.disabled = false;

  const ok = results.filter(r => r.data && !r.data.skip);
  const skipped = results.length - ok.length;
  if (!ok.length) {
    return setSeasonStatus(`Не нашёл завершённых матчей с командой ${CARD_TEAM_NAME} в этой выборке.`, true);
  }
  summarySeason = null;
  seasonData = { ...aggregate(ok.map(r => r.data)), rosterIds: seasonRosterIds };
  renderSeason();
  const notes = [
    skipped ? `пропущено ${skipped}` : '',
    invalid ? `не распознано ссылок ${invalid}` : '',
  ].filter(Boolean);
  setSeasonStatus(`✅ Готово: учтено матчей ${ok.length}${notes.length ? `, ${notes.join(', ')}` : ''}.`);
}

async function onResultClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const card = btn.closest('.season-item').querySelector('.season-card');
  const n = Number(btn.dataset.index) + 1;
  const isDownload = btn.dataset.action === 'download';
  setSeasonStatus('⏳ Подготовка картинки...');
  try {
    if (isDownload) {
      await downloadPng(card, `season-${n}.png`);
      setSeasonStatus('✅ Готово!');
    } else {
      await copyPng(card);
      setSeasonStatus('✅ Картинка скопирована в буфер обмена!');
    }
  } catch {
    setSeasonStatus('Не удалось выполнить экспорт картинки.', true);
  }
}

async function saveSeasonLogo() {
  const fileInput = $('seasonLogoFile');
  const file = fileInput.files[0];
  fileInput.value = '';
  if (!file) return;
  try {
    await storeImage(file, url => setTeamLogo(TEAM_ID, url));
    if (seasonData) renderSeason();
    else if (summarySeason) renderSummary();
    setSeasonStatus('✅ Логотип команды сохранён!');
  } catch (e) {
    setSeasonStatus(e.message, true);
  }
}

  $('seasonLoadEsea').onclick = loadEseaMatches;
  $('seasonSummaryLoad').onclick = loadSummarySeasons;
  $('seasonSummaryRun').onclick = runSummary;
  $('seasonSummarySelect').addEventListener('change', updateSummaryMatches);
  $('seasonMatchRun').onclick = runMatchSummary;
  panel.querySelector('#seasonRun').onclick = runSeason;
  $('seasonLogoBtn').onclick = () => $('seasonLogoFile').click();
  $('seasonLogoFile').onchange = saveSeasonLogo;
  $('seasonResults').onclick = onResultClick;
}

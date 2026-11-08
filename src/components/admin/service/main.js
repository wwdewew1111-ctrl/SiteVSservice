import { esc, fmtDot, num, logo, imageSrc } from './util.js';
import { MATCH_RE, faceitGet, fetchMatch, fetchRounds, makeSideOf, collect, summarize } from './faceit.js';
import { getFooterLogo, setFooterLogo, getTeamLogo, setTeamLogo, getTeamName, setTeamName, readImageFile, storeImage } from './storage.js';
import { downloadPng, copyPng } from './export.js';
import { initSeason } from './season.js';

export function initService(root) {
  const PLAYER_RE = /faceit\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?players\/([^/?#\s]+)/i;

const $ = id => root.querySelector(`#${id}`);
  const bar = $('bar'), matchPanel = $('matchPanel'), playerPanel = $('playerPanel'), seasonPanel = $('seasonPanel');
const previewPanel = $('previewPanel'), previewLink = $('previewLink'), previewCreate = $('previewCreate');
const previewOptions = $('previewOptions'), previewTeamLogos = $('previewTeamLogos');
const previewTitle = $('previewTitle'), previewSubtitle = $('previewSubtitle'), previewDate = $('previewDate');
const previewTime = $('previewTime'), previewFormat = $('previewFormat'), previewTheme = $('previewTheme');
const input = $('input'), createBtn = $('create'), teamLogos = $('teamLogos'), teamLogoFile = $('teamLogoFile');
const pMatch = $('pMatch'), pMap = $('pMap'), pPlayer = $('pPlayer'), pNick = $('pNick'), pTheme = $('pTheme');
const pPhotoBtn = $('pPhotoBtn'), pPhotoFile = $('pPhotoFile'), pPhotoUrl = $('pPhotoUrl'), pCreate = $('pCreate');
const logoBtn = $('logoBtn'), logoFile = $('logoFile'), dlBtn = $('dl'), cpBtn = $('cp');
const statusEl = $('status'), card = $('card');

let mode = 'match';
let current = null;
let preview = null;
let player = null;
let userPhoto = null;
let matchCache = null;

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.className = isError ? 'status error' : 'status';
}

const teamName = (f, side) => f[`faction${side}`].name || `Команда ${side}`;

async function loadMatch(matchId) {
  if (matchCache?.matchId === matchId) return matchCache;
  const match = await fetchMatch(matchId);
  if (match.status !== 'FINISHED') {
    throw new Error(`Матч ещё идёт (статус: ${match.status}). Карточку можно создать после завершения.`);
  }
  const rounds = await fetchRounds(matchId);
  const sideOf = makeSideOf(match);
  matchCache = { matchId, match, rounds, sideOf, ...collect(match, rounds, sideOf) };
  return matchCache;
}

function buildData(c, customTitle) {
  const { match, players, maps } = c;
  const f = match.teams;
  const wins = { 1: 0, 2: 0 };
  for (const m of maps) wins[m.s[0] > m.s[1] ? 1 : 2]++;
  const sc = match.results?.score;
  const series = { 1: num(sc?.faction1) ?? wins[1], 2: num(sc?.faction2) ?? wins[2] };
  const playersOf = side => [...players.values()].filter(p => p.side === side).map(summarize).sort((a, b) => b.rtg - a.rtg);
  return {
    matchId: c.matchId,
    title: customTitle,
    bo: match.best_of ?? maps.length,
    series,
    maps,
    teams: [1, 2].map(side => {
      const fac = f[`faction${side}`];
      const faceitName = teamName(f, side);
      return {
        id: fac.faction_id,
        faceitName,
        name: getTeamName(fac.faction_id) || faceitName,
        logo: getTeamLogo(fac.faction_id) || fac.avatar,
        win: series[side] > series[side === 1 ? 2 : 1],
        players: playersOf(side),
      };
    }),
  };
}

function mapHtml(m, teams) {
  const left = m.s[0] > m.s[1];
  const winner = teams[left ? 0 : 1];
  const img = m.img
    ? `<img src="${esc(imageSrc(m.img))}" crossorigin="anonymous" alt="" onerror="this.remove()">`
    : '';
  return `<div class="map">
    <div class="map-body">
      <div class="map-score"><span class="${left ? '' : 'dim'}">${m.s[0]}</span><span class="c">:</span><span class="${left ? 'dim' : ''}">${m.s[1]}</span></div>
      <div class="map-img">${img}</div>
      ${logo(winner.logo, winner.name, 'map-win')}
    </div>
    <div class="map-foot">${esc(m.name.toUpperCase())}</div>
    <div class="map-bar"></div>
  </div>`;
}

function teamHtml(t) {
  const rows = t.players.map(p => {
    const hs = p.hsPct === null ? '0%' : `${Math.round(p.hsPct)}%`;
    return `
      <div class="row p"><div>${esc(p.nick)}</div><div>${p.k}-${p.d}-${p.a}</div><div>${p.adr}</div><div>${hs}</div><div class="rtg ${p.rtg >= 1 ? 'good' : 'bad'}">${p.rtg.toFixed(2)}</div></div>`;
  }).join('');
  return `<div class="tbl${t.win ? ' win' : ''}">
    <div class="tbl-head">${logo(t.logo, t.name)}<div class="nm">${esc(t.name)}</div></div>
    <div class="row h"><div>PLAYER</div><div>K-D-A</div><div>ADR</div><div>HS</div><div>RTG</div></div>${rows}
  </div>`;
}

function renderMatch(d) {
  const [t1, t2] = d.teams;
  const titleText = d.title || `${t1.name} vs ${t2.name}`;
  const titleCls = titleText.length > 34 ? 'xlong' : titleText.length > 22 ? 'long' : '';
  const footerLogo = getFooterLogo();
  const footerLogoHtml = footerLogo ? `<img src="${esc(footerLogo)}" alt="">` : '';
  card.className = '';
  card.innerHTML = `
    <div class="wm-row"><span>VK.RU / КАБАНЫ ЕСПОРТ</span></div>
    <div class="title ${titleCls}">${esc(titleText)}</div>
    <div class="board">
      <div class="board-top">
        <div class="l">${logo(t1.logo, t1.name)}</div>
        <div class="score"><span class="${t1.win ? 'win' : ''}">${d.series[1]}</span><span class="dash">:</span><span class="${t2.win ? 'win' : ''}">${d.series[2]}</span></div>
        <div class="r">${logo(t2.logo, t2.name)}</div>
      </div>
      <div class="board-bot">
        <div class="name">${esc(t1.name)}</div>
        <div class="bo">BO${d.bo}</div>
        <div class="name n2">${esc(t2.name)}</div>
      </div>
    </div>
    <div class="maps">${d.maps.map(m => mapHtml(m, d.teams)).join('')}</div>
    <div class="tables">${d.teams.map(teamHtml).join('')}</div>
    <div class="footer">
      <div class="left">FACEIT MATCH</div>
      <div class="center">${footerLogoHtml}<span class="brand">КАБАНЫ<b>ЕСПОРТ</b></span></div>
      <div class="right">${new Date().toLocaleDateString('ru-RU')}</div>
    </div>`;
}

function previewTeam(fac, side) {
  const id = fac?.faction_id || '';
  const faceitName = fac?.name || `Команда ${side}`;
  return { id, faceitName, name: (id && getTeamName(id)) || faceitName, logo: (id && getTeamLogo(id)) || fac?.avatar || '' };
}

function previewMoscowDate(timestamp) {
  if (!Number.isFinite(Number(timestamp)) || Number(timestamp) <= 0) return { date: '', time: '' };
  const date = new Date(Number(timestamp) * 1000);
  if (Number.isNaN(date.getTime())) return { date: '', time: '' };
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map(p => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

function renderPreview(d) {
  const teams = [1, 2].map(side => previewTeam(d.match.teams?.[`faction${side}`], side));
  const date = previewDate.value ? previewDate.value.split('-').reverse().join('.') : 'TBA';
  const time = previewTime.value ? `${previewTime.value} МСК` : 'TBA';
  const footerLogo = getFooterLogo();
  const title = previewTitle.value.trim() || 'ПРЕДСТОЯЩИЙ МАТЧ';
  const subtitle = previewSubtitle.value.trim() || 'MATCH PREVIEW';
  card.className = `preview-mode${previewTheme.value === 'dark' ? ' preview-dark' : ''}`;
  card.innerHTML = `<div class="preview-art">
    <div class="preview-frame"></div>
    <div class="preview-top"><span class="preview-label">● MATCH DAY</span><span>CS2 / FACEIT</span></div>
    <div class="preview-heading"><small>ПРЕДСТОЯЩИЙ МАТЧ</small><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>
    <div class="preview-versus">
      ${teams.map((t, i) => `${i ? '<div class="preview-vs">VS</div>' : ''}<div class="preview-team">${logo(t.logo, t.name)}<div class="preview-team-name${t.name.length > 15 ? ' long' : ''}">${esc(t.name)}</div></div>`).join('')}
    </div>
    <div class="preview-info"><div><small>ДАТА</small>${esc(date)}</div><div class="preview-time"><small>НАЧАЛО</small>${esc(time)}</div><div><small>ФОРМАТ</small>${esc(previewFormat.value.trim() || 'TBA')}</div></div>
    <div class="preview-footer"><span>VK.RU / КАБАНЫ ЕСПОРТ</span><span class="preview-brand">${footerLogo ? `<img src="${esc(footerLogo)}" alt="">` : ''} КАБАНЫ ЕСПОРТС</span></div>
    <div class="preview-accent"></div>
  </div>`;
}

function renderPreviewTeamControls() {
  const teams = [1, 2].map(side => previewTeam(preview.match.teams?.[`faction${side}`], side));
  previewTeamLogos.innerHTML = teams.map((t, i) => `<div class="team-edit">
    <button class="btn" data-preview-team="${i + 1}">Логотип ${i + 1}</button>
    <input class="field" data-preview-name="${i + 1}" value="${esc(t.id ? getTeamName(t.id) || '' : '')}" placeholder="${esc(t.faceitName)}" maxlength="40" aria-label="Название команды ${i + 1}" autocomplete="off">
  </div>`).join('');
}

async function generatePreview() {
  const link = previewLink.value.trim().match(MATCH_RE);
  if (!link) return setStatus('Не нашёл ссылку на матч FACEIT. Вставьте ссылку вида faceit.com/.../room/1-...', true);
  previewCreate.disabled = true;
  setStatus('⏳ Загрузка данных матча...');
  try {
    const match = await fetchMatch(link[1]);
    if (!match.teams?.faction1 || !match.teams?.faction2) throw new Error('FACEIT пока не предоставил обе команды матча.');
    if (!match.teams.faction1.faction_id || !match.teams.faction2.faction_id) throw new Error('FACEIT пока не предоставил идентификаторы обеих команд.');
    preview = { matchId: link[1], match };
    const scheduled = previewMoscowDate(match.scheduled_at);
    previewTitle.value = match.competition_name || '';
    previewSubtitle.value = '';
    previewDate.value = scheduled.date;
    previewTime.value = scheduled.time;
    previewFormat.value = Number(match.best_of) > 0 ? `BO${match.best_of}` : '';
    previewOptions.hidden = false;
    renderPreviewTeamControls();
    setStatus(match.status === 'FINISHED' ? 'Матч уже завершён; превью создано по доступным данным.' : '✅ Превью готово! Проверьте дату, время и названия.');
    show();
  } catch (e) {
    setStatus(e instanceof TypeError ? 'Не удалось разобрать данные матча.' : e.message, true);
  } finally {
    previewCreate.disabled = false;
  }
}

function renderPlayer(p) {
  const nick = pNick.value.trim() || p.nick;
  const photo = userPhoto || (p.avatar ? imageSrc(p.avatar) : '');
  const photoHtml = photo ? `<img src="${esc(photo)}" crossorigin="anonymous" alt="" onerror="this.remove()">` : '';
  const s = p.stats;
  const stats = [[s.rtg.toFixed(2), 'RATING'], [s.adr, 'ADR'], [`${s.k}-${s.d}`, 'K-D']];
  const footerLogo = getFooterLogo();
  card.className = `player-mode theme-${pTheme.value}`;
  card.innerHTML = `
    <div class="pc">
      <span class="corner c-tl"></span><span class="corner c-tr"></span><span class="corner c-bl"></span><span class="corner c-br"></span>
      <div class="p-vs">VS</div>
      <h1 class="p-title">Статистика <span class="p-nick">${esc(nick)}</span><br>${p.mapName ? `на карте ${esc(p.mapName)}` : 'за всю серию'}</h1>
      <div class="p-plash"><span>${esc(p.plash.toUpperCase())}</span></div>
      ${stats.map(([v, cap], i) => `<div class="p-stat s${i + 1}"><div class="p-val">${fmtDot(v)}</div><div class="p-cap">${cap}</div></div>`).join('')}
      <div class="p-photo">${photoHtml}</div>
      <div class="p-footer">${footerLogo ? `<img src="${esc(footerLogo)}" alt=""><span class="p-div"></span>` : ''}<span class="p-brand">КАБАНЫ ЕСПОРТС</span></div>
      <div class="p-bar"></div>
    </div>`;
}

function show() {
  const hasMatch = mode === 'match' && current;
  const hasPreview = mode === 'preview' && preview;
  const hasPlayer = mode === 'player' && player;
  if (hasMatch) renderMatch(current);
  else if (hasPreview) renderPreview(preview);
  else if (hasPlayer) renderPlayer(player);
  card.hidden = !(hasMatch || hasPreview || hasPlayer);
  dlBtn.disabled = card.hidden;
  cpBtn.disabled = card.hidden;
}

function renderTeamLogoButtons(d) {
  teamLogos.innerHTML = d.teams.map(t => `
    <div class="team-edit">
      <button class="btn" data-team="${esc(t.id)}">Логотип команды</button>
      <input class="field" data-team-name="${esc(t.id)}" value="${esc(getTeamName(t.id) || '')}" placeholder="${esc(t.faceitName)}" maxlength="40" autocomplete="off">
    </div>`).join('');
}

function syncMapSelect(c) {
  pMap.innerHTML = '<option value="all">Вся серия</option>' +
    c.maps.map((m, i) => `<option value="${i}">${i + 1}. ${esc(m.name.toUpperCase())}</option>`).join('');
  pMap.value = 'all';
  pMap.hidden = c.maps.length < 2;
}

async function findPlayer(c, nick) {
  const lower = nick.toLowerCase();
  let pid = [...c.players].find(([, p]) => p.nick.toLowerCase() === lower)?.[0];
  let profile = null;
  if (pid === undefined) {
    try {
      profile = await faceitGet(`players?nickname=${encodeURIComponent(nick)}`);
    } catch {
      profile = null;
    }
    pid = profile?.player_id;
  }
  if (!c.players.has(pid)) throw new Error('Игрок не найден в этом матче.');
  const f = c.match.teams;
  const roster = [...(f.faction1.roster || []), ...(f.faction2.roster || [])];
  const avatar = roster.find(r => r.player_id === pid)?.avatar || profile?.avatar || '';
  return { pid, nick: c.players.get(pid).nick, avatar };
}

async function generate() {
  const raw = input.value.trim();
  const m = raw.match(MATCH_RE);
  if (!m) {
    setStatus('Не нашёл ссылку на матч FACEIT. Вставьте ссылку вида faceit.com/.../room/1-...', true);
    return;
  }
  const customTitle = raw.slice(m.index + m[0].length).trim();
  createBtn.disabled = true;
  setStatus('⏳ Загрузка данных матча...');
  try {
    const c = await loadMatch(m[1]);
    current = buildData(c, customTitle);
    renderTeamLogoButtons(current);
    setStatus('✅ Готово!');
    show();
  } catch (e) {
    setStatus(e instanceof TypeError ? 'Не удалось разобрать данные матча.' : e.message, true);
  } finally {
    createBtn.disabled = false;
  }
}

async function generatePlayer() {
  const mm = pMatch.value.trim().match(MATCH_RE);
  if (!mm) return setStatus('Не нашёл ссылку на матч FACEIT.', true);
  const playerRaw = pPlayer.value.trim();
  if (!playerRaw) return setStatus('Вставьте ссылку на профиль игрока FACEIT.', true);
  const pm = playerRaw.match(PLAYER_RE);
  const nick = pm ? pm[1] : playerRaw;

  pCreate.disabled = true;
  setStatus('⏳ Загрузка данных игрока...');
  try {
    const c = await loadMatch(mm[1]);
    syncMapSelect(c);
    const found = await findPlayer(c, nick);
    const mapIdx = pMap.hidden || pMap.value === 'all' ? null : Number(pMap.value);
    const rounds = mapIdx === null ? c.rounds : [c.rounds[mapIdx]];
    const { players } = collect(c.match, rounds, c.sideOf);
    const p = players.get(found.pid);
    if (!p) throw new Error('Игрок не играл на выбранной карте.');
    const f = c.match.teams;
    player = {
      matchId: c.matchId,
      nick: found.nick,
      avatar: found.avatar,
      mapName: mapIdx === null ? null : c.maps[mapIdx].name.toUpperCase(),
      stats: summarize(p),
      plash: `${teamName(f, 1)} vs ${teamName(f, 2)}`,
    };
    setStatus('✅ Готово!');
    show();
  } catch (e) {
    setStatus(e instanceof TypeError ? 'Не удалось разобрать данные игрока.' : e.message, true);
  } finally {
    pCreate.disabled = false;
  }
}

async function readPhoto(file) {
  try {
    userPhoto = await readImageFile(file);
    show();
  } catch (e) {
    setStatus(e.message, true);
  }
}

async function runExport(action, doneText) {
  setStatus('⏳ Подготовка картинки...');
  try {
    await action();
    setStatus(doneText);
  } catch {
    setStatus('Не удалось выполнить экспорт картинки.', true);
  }
}

const fileName = () => mode === 'player' ? `${player.matchId}-${player.nick}`
  : mode === 'preview' ? `preview-${preview.matchId}` : current.matchId;

root.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
  mode = tab.dataset.mode;
  root.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab));
  bar.hidden = mode === 'season';
  seasonPanel.hidden = mode !== 'season';
  matchPanel.hidden = mode !== 'match';
  previewPanel.hidden = mode !== 'preview';
  playerPanel.hidden = mode !== 'player';
  setStatus('');
  show();
}));

previewCreate.onclick = generatePreview;
previewLink.addEventListener('keydown', e => { if (e.key === 'Enter') generatePreview(); });
[previewTitle, previewSubtitle, previewDate, previewTime, previewFormat].forEach(el => {
  el.addEventListener('input', () => { if (mode === 'preview' && preview) show(); });
});
previewTheme.addEventListener('change', () => { if (mode === 'preview' && preview) show(); });
previewTeamLogos.addEventListener('click', e => {
  const btn = e.target.closest('[data-preview-team]');
  if (!btn || !preview) return;
  const side = btn.dataset.previewTeam;
  const id = preview.match.teams?.[`faction${side}`]?.faction_id;
  if (!id) return setStatus('FACEIT пока не предоставил идентификатор команды.', true);
  teamLogoFile.dataset.team = id;
  teamLogoFile.click();
});
previewTeamLogos.addEventListener('input', e => {
  if (!e.target.matches('[data-preview-name]') || !preview) return;
  const id = preview.match.teams?.[`faction${e.target.dataset.previewName}`]?.faction_id;
  if (!id) return setStatus('FACEIT пока не предоставил идентификатор команды.', true);
  try {
    setTeamName(id, e.target.value.trim());
    if (current && matchCache?.matchId === current.matchId) {
      current = buildData(matchCache, current.title);
      renderTeamLogoButtons(current);
    }
    show();
  } catch {
    setStatus('Не удалось сохранить название команды в браузере.', true);
  }
});

createBtn.onclick = generate;
input.addEventListener('keydown', e => { if (e.key === 'Enter') generate(); });

teamLogos.addEventListener('click', e => {
  const btn = e.target.closest('[data-team]');
  if (!btn) return;
  teamLogoFile.dataset.team = btn.dataset.team;
  teamLogoFile.click();
});
teamLogos.addEventListener('input', e => {
  if (!e.target.matches('[data-team-name]')) return;
  setTeamName(e.target.dataset.teamName, e.target.value.trim());
  current = buildData(matchCache, current.title);
  if (preview) renderPreviewTeamControls();
  show();
});
teamLogoFile.onchange = async () => {
  const id = teamLogoFile.dataset.team;
  const file = teamLogoFile.files[0];
  teamLogoFile.value = '';
  if (!file) return;
  try {
    await storeImage(file, url => setTeamLogo(id, url));
    if (current && matchCache?.matchId === current.matchId) current = buildData(matchCache, current.title);
    setStatus('✅ Логотип сохранён!');
    show();
  } catch (e) {
    setStatus(e.message, true);
  }
};

pMatch.addEventListener('change', async () => {
  const m = pMatch.value.trim().match(MATCH_RE);
  if (!m) return;
  setStatus('⏳ Загрузка матча...');
  try {
    syncMapSelect(await loadMatch(m[1]));
    setStatus('');
  } catch (e) {
    setStatus(e.message, true);
  }
});
[pMatch, pPlayer, pNick].forEach(el => el.addEventListener('keydown', e => { if (e.key === 'Enter') generatePlayer(); }));
pCreate.onclick = generatePlayer;
pNick.addEventListener('input', () => { if (mode === 'player') show(); });
pTheme.addEventListener('change', () => { if (mode === 'player') show(); });

pPhotoBtn.onclick = () => pPhotoFile.click();
pPhotoFile.onchange = () => {
  readPhoto(pPhotoFile.files[0]);
  pPhotoFile.value = '';
};
pPhotoUrl.addEventListener('change', () => {
  const u = pPhotoUrl.value.trim();
  if (u && !/^https?:\/\//i.test(u)) return setStatus('Ссылка на фото должна начинаться с https://', true);
  userPhoto = u ? imageSrc(u) : null;
  show();
});
const onPaste = e => {
  if (mode !== 'player') return;
  const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
  if (!item) return;
  e.preventDefault();
  readPhoto(item.getAsFile());
};
window.addEventListener('paste', onPaste);

logoBtn.onclick = () => logoFile.click();
logoFile.onchange = async () => {
  const file = logoFile.files[0];
  logoFile.value = '';
  if (!file) return;
  try {
    await storeImage(file, setFooterLogo);
    setStatus('✅ Логотип сохранён!');
    show();
  } catch (e) {
    setStatus(e.message, true);
  }
};

dlBtn.onclick = () => runExport(() => downloadPng(card, `${fileName()}.png`), '✅ Готово!');
cpBtn.onclick = () => runExport(() => copyPng(card), '✅ Картинка скопирована в буфер обмена!');

initSeason(root);
return () => window.removeEventListener('paste', onPaste);
}

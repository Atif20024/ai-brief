// AI Brief — single-page app over data/*.json
// Routes:  #/                      -> latest post
//          #/history               -> calendar + timeline of all posts
//          #/DATE                  -> that post, first tab
//          #/DATE/TAB              -> that post, that tab
//          #/DATE/TAB?q=..&t=..&all=1  -> with search text, topic, all-days scope

const app = document.getElementById('app');
const sel = document.getElementById('dates');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');

let index = [];          // [{date, kind, title, summary}] newest first
const cache = {};        // date -> post json

// ---------- helpers ----------
function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}
function md(s) {   // tiny inline markdown: **bold**, `code`, [text](url), blank line = paragraph
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\n\n/g, '</p><p>');
}
function tierClass(name) {
  const n = name.toLowerCase();
  if (n.startsWith('must')) return 'must';
  if (n.startsWith('should')) return 'should';
  return '';
}
function fmtDate(d, opts) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', opts || {weekday:'short', day:'numeric', month:'short', year:'numeric'});
}
function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, qs] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  const q = new URLSearchParams(qs || '');
  return {parts, q: q.get('q') || '', topic: q.get('t') || '', all: q.get('all') === '1'};
}
function buildHash(date, tab, f) {
  const q = new URLSearchParams();
  if (f.q) q.set('q', f.q);
  if (f.topic) q.set('t', f.topic);
  if (f.all) q.set('all', '1');
  const s = q.toString();
  return `#/${date}/${tab}${s ? '?' + s : ''}`;
}
function matches(it, f) {
  if (f.topic && !(it.topics || []).some(t => t.toLowerCase() === f.topic.toLowerCase())) return false;
  if (f.q) {
    const hay = [it.title, it.summary, it.note, it.source, ...(it.topics || [])].join(' ').toLowerCase();
    if (!hay.includes(f.q.toLowerCase())) return false;
  }
  return true;
}

// ---------- data ----------
async function loadIndex() {
  const r = await fetch('data/index.json', {cache:'no-store'});
  index = (await r.json()).posts.sort((a, b) => b.date.localeCompare(a.date));
  sel.innerHTML = index.map(p => `<option value="${p.date}">${fmtDate(p.date)}${p.kind === 'weekly' ? ' · Weekly' : ''}</option>`).join('');
}
async function loadPost(date) {
  if (!cache[date]) {
    const r = await fetch(`data/${date}.json`, {cache:'no-store'});
    if (!r.ok) throw new Error('missing');
    cache[date] = await r.json();
  }
  return cache[date];
}
async function loadAll() {
  return Promise.all(index.map(p => loadPost(p.date).catch(() => null)));
}

// ---------- rendering ----------
function renderItem(it, date, tab, f) {
  const tag = it.tag ? `<span class="pill ${it.tag === 'Confirmed' ? 'ok' : 'rep'}">${esc(it.tag)}</span>` : '';
  const links = (it.links || []).map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`).join('');
  const open = it.url ? `<a href="${esc(it.url)}" target="_blank" rel="noopener">Open ↗</a>` : '';
  const topics = (it.topics || []).map(t =>
    `<a class="topic ${f.topic.toLowerCase() === t.toLowerCase() ? 'on' : ''}" href="${buildHash(date, tab, {...f, topic: f.topic.toLowerCase() === t.toLowerCase() ? '' : t})}">${esc(t)}</a>`).join('');
  return `<div class="card">
    <h3>${md(it.title)}${it.meta ? `<span class="meta">${esc(it.meta)}</span>` : ''}</h3>
    ${it.summary ? `<p>${md(it.summary)}</p>` : ''}
    ${it.note ? `<p class="note"><strong>What you can do:</strong> ${md(it.note)}</p>` : ''}
    <div class="row">${tag}${it.source ? `<span>${esc(it.source)}</span>` : ''}${open}${links}<span class="topics">${topics}</span></div>
  </div>`;
}

function renderTiers(tab, date, f, filtering) {
  return tab.tiers.map(tr => {
    const items = tr.items.filter(it => matches(it, f));
    if (filtering && !items.length) return '';
    return `<h2 class="tier ${tierClass(tr.name)}">${esc(tr.name)}</h2>` +
      (items.length ? items.map(it => renderItem(it, date, tab.id, f)).join('')
                    : `<div class="none">Nothing ${cache[date].kind === 'weekly' ? 'this week' : 'today'}</div>`);
  }).join('');
}

function topicChips(posts, tabId, date, f) {
  const counts = {};
  for (const p of posts) {
    const tab = p.tabs.find(t => t.id === tabId); if (!tab) continue;
    for (const tr of tab.tiers) for (const it of tr.items)
      for (const t of (it.topics || [])) counts[t] = (counts[t] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t, n]) => {
    const on = f.topic.toLowerCase() === t.toLowerCase();
    return `<a class="chip ${on ? 'on' : ''}" href="${buildHash(date, tabId, {...f, topic: on ? '' : t})}">${esc(t)}<span class="n">${n}</span></a>`;
  }).join('');
}

async function renderPost(post, tabId, f) {
  const tab = post.tabs.find(t => t.id === tabId) || post.tabs[0];
  tabId = tab.id;
  const filtering = !!(f.q || f.topic);
  const tabbar = post.tabs.map(t => {
    const n = t.tiers.reduce((s, x) => s + x.items.length, 0);
    return `<a href="${buildHash(post.date, t.id, f)}" class="${t === tab ? 'active' : ''}">${esc(t.name)}<span class="n">${n}</span></a>`;
  }).join('');

  let body, chips;
  if (f.all && filtering) {
    const posts = (await loadAll()).filter(Boolean);
    chips = topicChips(posts, tabId, post.date, f);
    body = posts.map(p => {
      const t = p.tabs.find(x => x.id === tabId); if (!t) return '';
      const items = t.tiers.flatMap(tr => tr.items.filter(it => matches(it, f)));
      if (!items.length) return '';
      return `<h2 class="tier day"><a href="#/${p.date}/${tabId}">${fmtDate(p.date)}${p.kind === 'weekly' ? ' · Weekly' : ''}</a></h2>` +
        items.map(it => renderItem(it, p.date, tabId, f)).join('');
    }).join('') || `<div class="none">No matches on any day.</div>`;
  } else {
    chips = topicChips([post], tabId, post.date, f);
    body = renderTiers(tab, post.date, f, filtering) || `<div class="none">No matches in this tab${f.all ? '' : ' — tick "all days" to search every post'}.</div>`;
  }

  app.innerHTML = `
    <div class="post-head">
      <span class="kind">${post.kind === 'weekly' ? 'Weekly review' : 'Daily brief'}</span>
      <h1>${esc(post.title)}</h1>
      ${post.summary ? `<p class="one"><strong>In one sentence:</strong> ${md(post.summary)}</p>` : ''}
      ${post.window ? `<div class="window">${esc(post.window)}</div>` : ''}
    </div>
    <nav class="tabbar">${tabbar}</nav>
    <div class="filters">
      <input id="q" type="search" placeholder="Search in ${esc(tab.name)}…" value="${esc(f.q)}">
      <label class="all"><input id="all" type="checkbox" ${f.all ? 'checked' : ''}> all days</label>
      ${filtering ? `<a class="clear" href="#/${post.date}/${tabId}">clear</a>` : ''}
    </div>
    <div class="chips">${chips}</div>
    <section class="panel">${body}
      ${!filtering && post.footer ? `<footer class="src">${md(post.footer)}</footer>` : ''}
    </section>`;

  const qEl = document.getElementById('q');
  let timer;
  qEl.oninput = () => { clearTimeout(timer); timer = setTimeout(() => { location.hash = buildHash(post.date, tabId, {...f, q: qEl.value.trim()}); }, 250); };
  document.getElementById('all').onchange = e => { location.hash = buildHash(post.date, tabId, {...f, all: e.target.checked}); };
  if (f.q) { qEl.focus(); qEl.setSelectionRange(qEl.value.length, qEl.value.length); }
}

function renderHistory() {
  const byDate = Object.fromEntries(index.map(p => [p.date, p]));
  // months that have posts, newest first
  const months = [...new Set(index.map(p => p.date.slice(0, 7)))];
  const cal = months.map(m => {
    const [y, mo] = m.split('-').map(Number);
    const first = new Date(y, mo - 1, 1);
    const days = new Date(y, mo, 0).getDate();
    const pad = (first.getDay() + 6) % 7;                 // Monday-first
    let cells = '';
    for (let i = 0; i < pad; i++) cells += '<span class="cell empty"></span>';
    for (let d = 1; d <= days; d++) {
      const key = `${m}-${String(d).padStart(2, '0')}`;
      const p = byDate[key];
      cells += p ? `<a class="cell has ${p.kind}" href="#/${key}" title="${esc(p.title)}">${d}</a>` : `<span class="cell">${d}</span>`;
    }
    return `<div class="month"><h2>${first.toLocaleDateString('en-GB', {month:'long', year:'numeric'})}</h2>
      <div class="grid"><span class="dow">M</span><span class="dow">T</span><span class="dow">W</span><span class="dow">T</span><span class="dow">F</span><span class="dow">S</span><span class="dow">S</span>${cells}</div></div>`;
  }).join('');
  const timeline = index.map(p => `<a class="tl" href="#/${p.date}">
      <div class="when">${fmtDate(p.date, {weekday:'short', day:'numeric', month:'short'})}${p.kind === 'weekly' ? '<span class="w">Weekly</span>' : ''}</div>
      <div class="what"><div class="t">${esc(p.title)}</div>${p.summary ? `<div class="s">${esc(p.summary)}</div>` : ''}</div>
    </a>`).join('');
  app.innerHTML = `<div class="history">
    <h1>History</h1>
    <div class="cals">${cal}</div>
    <h2 class="tier">Timeline</h2>
    ${timeline}
  </div>`;
}

function setNav(date) {
  sel.value = date;
  const i = index.findIndex(p => p.date === date);
  nextBtn.disabled = i <= 0;
  prevBtn.disabled = i < 0 || i >= index.length - 1;
}

// ---------- routing ----------
async function route() {
  const {parts, q, topic, all} = parseHash();
  if (parts[0] === 'history' || parts[0] === 'archive') { renderHistory(); return; }
  const date = parts[0] || (index[0] && index[0].date);
  if (!date) { app.innerHTML = '<p class="muted">No posts yet.</p>'; return; }
  try {
    const post = await loadPost(date);
    setNav(date);
    const scrollY = window.scrollY;
    await renderPost(post, parts[1], {q, topic, all});
    window.scrollTo(0, (q || topic) ? Math.min(scrollY, 260) : 0);
  } catch {
    app.innerHTML = `<p class="muted">No post for ${esc(date)}. <a href="#/history">See the history</a>.</p>`;
  }
}

sel.onchange = () => location.hash = '#/' + sel.value;
prevBtn.onclick = () => { const i = index.findIndex(p => p.date === sel.value); if (i < index.length - 1) location.hash = '#/' + index[i + 1].date; };
nextBtn.onclick = () => { const i = index.findIndex(p => p.date === sel.value); if (i > 0) location.hash = '#/' + index[i - 1].date; };
window.addEventListener('hashchange', route);

loadIndex().then(route).catch(() => { app.innerHTML = '<p class="muted">Could not load data/index.json.</p>'; });

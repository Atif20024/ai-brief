// AI Brief — single-page app over data/*.json
// Routes:  #/            -> latest post
//          #/archive     -> list of all posts
//          #/DATE        -> that post, first tab
//          #/DATE/TAB    -> that post, that tab

const app = document.getElementById('app');
const sel = document.getElementById('dates');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');

let index = [];          // [{date, kind, title}] newest first
const cache = {};        // date -> post json

function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}
// tiny inline markdown: **bold**, `code`, [text](url)
function md(s) {
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
function fmtDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {weekday:'short', day:'numeric', month:'short', year:'numeric'});
}

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

function renderItem(it) {
  const tag = it.tag ? `<span class="pill ${it.tag === 'Confirmed' ? 'ok' : 'rep'}">${esc(it.tag)}</span>` : '';
  const links = (it.links || []).map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`).join('');
  const open = it.url ? `<a href="${esc(it.url)}" target="_blank" rel="noopener">Open ↗</a>` : '';
  return `<div class="card">
    <h3>${md(it.title)}${it.meta ? `<span class="meta">${esc(it.meta)}</span>` : ''}</h3>
    ${it.summary ? `<p>${md(it.summary)}</p>` : ''}
    ${it.note ? `<p class="note"><strong>What you can do:</strong> ${md(it.note)}</p>` : ''}
    <div class="row">${tag}${it.source ? `<span>${esc(it.source)}</span>` : ''}${open}${links}</div>
  </div>`;
}

function renderPost(post, tabId) {
  const tab = post.tabs.find(t => t.id === tabId) || post.tabs[0];
  const tabbar = post.tabs.map(t => {
    const n = t.tiers.reduce((s, x) => s + x.items.length, 0);
    return `<a href="#/${post.date}/${t.id}" class="${t === tab ? 'active' : ''}">${esc(t.name)}<span class="n">${n}</span></a>`;
  }).join('');
  const tiers = tab.tiers.map(tr => `
    <h2 class="tier ${tierClass(tr.name)}">${esc(tr.name)}</h2>
    ${tr.items.length ? tr.items.map(renderItem).join('') : `<div class="none">Nothing ${post.kind === 'weekly' ? 'this week' : 'today'}</div>`}`).join('');
  app.innerHTML = `
    <div class="post-head">
      <span class="kind">${post.kind === 'weekly' ? 'Weekly review' : 'Daily brief'}</span>
      <h1>${esc(post.title)}</h1>
      ${post.summary ? `<p class="one"><strong>In one sentence:</strong> ${md(post.summary)}</p>` : ''}
      ${post.window ? `<div class="window">${esc(post.window)}</div>` : ''}
    </div>
    <nav class="tabbar">${tabbar}</nav>
    <section class="panel">${tiers}
      ${post.footer ? `<footer class="src">${md(post.footer)}</footer>` : ''}
    </section>`;
  window.scrollTo(0, 0);
}

function renderArchive() {
  const groups = {};
  for (const p of index) {
    const m = new Date(p.date + 'T00:00:00').toLocaleDateString('en-GB', {month:'long', year:'numeric'});
    (groups[m] = groups[m] || []).push(p);
  }
  app.innerHTML = `<div class="archive"><h1>Archive</h1>` +
    Object.entries(groups).map(([m, ps]) => `<h2>${m}</h2>` +
      ps.map(p => `<a class="post" href="#/${p.date}">${esc(p.title)}<span class="d">${fmtDate(p.date)}</span></a>`).join('')
    ).join('') + `</div>`;
}

function setNav(date) {
  sel.value = date;
  const i = index.findIndex(p => p.date === date);
  nextBtn.disabled = i <= 0;
  prevBtn.disabled = i < 0 || i >= index.length - 1;
}

async function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'archive') { renderArchive(); return; }
  const date = parts[0] || (index[0] && index[0].date);
  if (!date) { app.innerHTML = '<p class="muted">No posts yet.</p>'; return; }
  try {
    const post = await loadPost(date);
    setNav(date);
    renderPost(post, parts[1]);
  } catch {
    app.innerHTML = `<p class="muted">No post for ${esc(date)}. <a href="#/archive">See the archive</a>.</p>`;
  }
}

sel.onchange = () => location.hash = '#/' + sel.value;
prevBtn.onclick = () => { const i = index.findIndex(p => p.date === sel.value); if (i < index.length - 1) location.hash = '#/' + index[i + 1].date; };
nextBtn.onclick = () => { const i = index.findIndex(p => p.date === sel.value); if (i > 0) location.hash = '#/' + index[i - 1].date; };
window.addEventListener('hashchange', route);

loadIndex().then(route).catch(() => { app.innerHTML = '<p class="muted">Could not load data/index.json.</p>'; });

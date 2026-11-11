// Private review studio. In the cloud it sits behind Identity-Aware Proxy, so
// only the named reviewers can reach it, and it checks their email again here.
// Reviewers listen to the narration, approve the exact text, or send it back
// with a note. Volunteer recordings are approved or rejected here too.
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { LANGS, env, isCloud } from '../../shared/config.js';
import { makeStore, contentTypeFor } from '../../shared/store.js';
import { loadStories, storyLangs, textHash, guardHits, minutesFor } from '../../shared/stories.js';
import { getStatus, setStatus, isApproved } from '../../shared/status.js';
import { triggerPublish } from '../../shared/jobs.js';

const log = (severity, message, extra = {}) => console.log(JSON.stringify({ severity, message, ...extra }));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const CSS = `
body{font:16px/1.5 system-ui,sans-serif;margin:0;background:#f6f5fb;color:#1d1d35}
header{background:#141a3d;color:#fff;padding:12px 20px;display:flex;gap:16px;align-items:center;flex-wrap:wrap}
header a{color:#ffe6a1;text-decoration:none;font-weight:600}
main{max-width:980px;margin:0 auto;padding:20px}
table{border-collapse:collapse;width:100%;background:#fff;border-radius:12px;overflow:hidden}
th,td{padding:10px 12px;border-bottom:1px solid #eee;text-align:start;vertical-align:top}
.pill{display:inline-block;padding:2px 10px;border-radius:999px;font-size:.85rem;font-weight:600}
.approved{background:#d8f5e7;color:#14593b}.changes{background:#ffe2e2;color:#8a1c1c}.draft{background:#fff1c9;color:#7a5600}.stale{background:#ffe4cc;color:#8a4500}
.card{background:#fff;border-radius:12px;padding:16px 18px;margin:0 0 16px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
.page{font-size:1.15rem;line-height:1.8;margin:0 0 12px}
[dir=rtl] .page{font-size:1.3rem;line-height:2}
button{font:inherit;padding:10px 16px;border-radius:10px;border:1px solid #c9c9dd;background:#fff;cursor:pointer}
button.go{background:#14593b;color:#fff;border-color:#14593b}button.no{background:#8a1c1c;color:#fff;border-color:#8a1c1c}
textarea{width:100%;min-height:80px;font:inherit;padding:8px;border-radius:8px;border:1px solid #c9c9dd;box-sizing:border-box}
.flash{background:#e5f0ff;border:1px solid #9cc0ff;padding:10px 14px;border-radius:10px;margin-bottom:16px}
.warn{background:#fff4e5;border:1px solid #ffc27a;padding:10px 14px;border-radius:10px}
audio{width:100%;margin:8px 0}
.muted{color:#666;font-size:.9rem}
.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
`;

function page(title, body, user, flash) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(title)} · Same Moon studio</title><style>${CSS}</style></head><body>
<header><strong>Same Moon studio</strong><a href="/">Stories</a><a href="/voices">Volunteer voices</a><span class="muted" style="color:#b8bde3;margin-inline-start:auto">${esc(user)}</span></header>
<main>${flash ? `<div class="flash">${esc(flash)}</div>` : ''}${body}</main></body></html>`;
}

function statusPill(status, hash) {
  if (isApproved(status, hash)) return '<span class="pill approved">Approved</span>';
  if (status.state === 'approved') return '<span class="pill stale">Text changed: approve again</span>';
  if (status.state === 'changes') return '<span class="pill changes">Changes requested</span>';
  return '<span class="pill draft">Waiting for review</span>';
}

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(new URLSearchParams(Buffer.concat(chunks).toString('utf8'))));
    req.on('error', reject);
  });
}

function sendAudio(req, res, buf, type) {
  const range = req.headers.range && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
  const base = { 'content-type': type, 'accept-ranges': 'bytes', 'cache-control': 'private, max-age=300' };
  if (!range) {
    res.writeHead(200, { ...base, 'content-length': buf.length });
    return res.end(buf);
  }
  const start = range[1] ? Number(range[1]) : Math.max(0, buf.length - Number(range[2]));
  const end = range[1] && range[2] ? Math.min(Number(range[2]), buf.length - 1) : buf.length - 1;
  res.writeHead(206, { ...base, 'content-range': `bytes ${start}-${end}/${buf.length}`, 'content-length': end - start + 1 });
  return res.end(buf.subarray(start, end + 1));
}

// Two ways in. "iap": Identity-Aware Proxy has already checked the person,
// and we check again against our own list. "password": HTTP Basic sign-in
// against a secret, for projects where IAP cannot be used.
function whoIs(req) {
  if (!isCloud()) return 'local reviewer';
  if (env('STUDIO_AUTH', 'iap') === 'password') {
    const secret = env('STUDIO_PASSWORD', '');
    const m = /^Basic (.+)$/.exec(req.headers.authorization || '');
    if (!secret || !m) return null;
    const decoded = Buffer.from(m[1], 'base64').toString('utf8');
    const i = decoded.indexOf(':');
    const name = decoded.slice(0, i).trim().slice(0, 40) || 'reviewer';
    const given = crypto.createHash('sha256').update(decoded.slice(i + 1)).digest();
    const want = crypto.createHash('sha256').update(secret).digest();
    return crypto.timingSafeEqual(given, want) ? name : null;
  }
  const raw = req.headers['x-goog-authenticated-user-email'] || '';
  const email = raw.replace(/^accounts\.google\.com:/, '').toLowerCase();
  const allowed = env('REVIEWERS', '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
  return email && allowed.includes(email) ? email : null;
}

// After 10 wrong passwords from one address in 15 minutes, stop answering for a while.
const failures = new Map();
function lockedOut(ip) {
  const now = Date.now();
  const recent = (failures.get(ip) || []).filter((t) => now - t < 15 * 60 * 1000);
  failures.set(ip, recent);
  return recent.length >= 10;
}

export function createServer({ store = makeStore(), stories = loadStories(), publish = triggerPublish } = {}) {
  async function dashboard(user, flash) {
    const langs = Object.keys(LANGS);
    let rows = '';
    let waiting = 0;
    for (const s of stories) {
      let cells = '';
      for (const lang of langs) {
        if (!s[lang]) { cells += '<td class="muted">none</td>'; continue; }
        const hash = textHash(s, lang);
        const st = await getStatus(store, s.id, lang);
        if (!isApproved(st, hash)) waiting++;
        const audio = await store.exists('state', `audio/${s.id}/${lang}-${hash}.json`);
        cells += `<td><a href="/story/${esc(s.id)}/${lang}">${statusPill(st, hash)}</a><div class="muted">${audio ? 'Narration ready' : 'No narration yet'}</div></td>`;
      }
      rows += `<tr><td><strong>${esc(s.en?.title || s.id)}</strong><div class="muted">${esc(s.theme?.en || '')}</div></td>${cells}</tr>`;
    }
    const voices = (await store.list('state', 'voices/review/')).filter((k) => k.endsWith('.json')).length;
    const body = `
<div class="card row"><div><strong>${waiting}</strong> story versions waiting for review · <strong>${voices}</strong> volunteer recordings waiting</div>
<form method="post" action="/publish" style="margin-inline-start:auto"><button>Publish approved stories now</button></form></div>
<p class="muted">A story appears in the public app only when a reviewer has approved its exact words in that language. Editing the text resets the approval.</p>
<table><thead><tr><th>Story</th>${langs.map((l) => `<th>${esc(LANGS[l].name)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
    return page('Stories', body, user, flash);
  }

  async function storyPage(user, id, lang, flash) {
    const s = stories.find((x) => x.id === id);
    if (!s || !s[lang]) return null;
    const t = s[lang];
    const hash = textHash(s, lang);
    const st = await getStatus(store, id, lang);
    const manifestBuf = await store.get('state', `audio/${id}/${lang}-${hash}.json`);
    const manifest = manifestBuf ? JSON.parse(manifestBuf.toString('utf8')) : null;
    const hits = guardHits(s, lang);
    const dir = LANGS[lang].dir;
    const audio = manifest
      ? `<audio controls preload="none" src="/audio/audio/${esc(id)}/${lang}-${hash}.m4a"></audio>
         <div class="muted">Voice: ${esc(manifest.voice)} · ${Math.round(manifest.duration)}s · ${Math.round(manifest.bytes.webm / 1024)} KB for phones</div>`
      : '<p class="warn">No narration yet for this version. Press "Publish approved stories now" on the main page to make it, then come back.</p>';
    const body = `
<p><a href="/">← All stories</a></p>
<div class="card"><div class="row"><h1 style="margin:0">${esc(t.title)}</h1>${statusPill(st, hash)}</div>
<p class="muted">${esc(LANGS[lang].name)} · about ${minutesFor(s, lang)} min · version ${hash}${st.by ? ` · last decision by ${esc(st.by)} on ${esc((st.at || '').slice(0, 10))}` : ''}</p>
${st.note ? `<p class="warn">Note: ${esc(st.note)}</p>` : ''}
${hits.length ? `<p class="warn">Words to check: ${esc(hits.join(', '))}</p>` : ''}
<h2>Listen</h2>${audio}</div>
<div class="card" dir="${dir}" lang="${lang}"><h2 style="margin-top:0">${esc(t.title)}</h2>${t.pages.map((p) => `<p class="page">${esc(p)}</p>`).join('')}
<p class="page"><em>${esc(t.grownUp)}</em></p></div>
<div class="card">
<form method="post" action="/story/${esc(id)}/${lang}/approve" class="row">
<button class="go">Approve this text${manifest ? ' and narration' : ''}</button>
<span class="muted">It goes live in the app a minute or two after you approve.</span></form>
<hr style="margin:16px 0;border:none;border-top:1px solid #eee">
<form method="post" action="/story/${esc(id)}/${lang}/changes">
<label for="note"><strong>Or ask for changes</strong> (what should change, and why)</label>
<textarea id="note" name="note" required></textarea>
<p><button class="no">Send back for changes</button></p></form></div>`;
    return page(t.title, body, user, flash);
  }

  async function voicesPage(user, flash) {
    const keys = (await store.list('state', 'voices/review/')).filter((k) => k.endsWith('.json'));
    let cards = '';
    for (const k of keys) {
      const rec = JSON.parse((await store.get('state', k)).toString('utf8'));
      const s = stories.find((x) => x.id === rec.storyId);
      const base = k.slice(0, -5);
      cards += `<div class="card"><strong>${esc(s?.[rec.lang]?.title || rec.storyId)}</strong>
<div class="muted">${esc(LANGS[rec.lang]?.name || rec.lang)}${rec.dialect ? ` · ${esc(rec.dialect)}` : ''} · ${esc(rec.credit || 'no name given')} · ${rec.duration}s · received ${esc((rec.receivedAt || '').slice(0, 10))}</div>
<audio controls preload="none" src="/audio/${esc(base)}.m4a"></audio>
<div class="row"><form method="post" action="/voices/approve"><input type="hidden" name="key" value="${esc(k)}"><button class="go">Approve and publish</button></form>
<form method="post" action="/voices/reject"><input type="hidden" name="key" value="${esc(k)}"><button class="no">Reject and delete</button></form></div>
<p class="muted">Check: an adult voice, the right story, clear and kind, nothing added, no background voices of children.</p></div>`;
    }
    const body = `<h1>Volunteer voices</h1>${cards || '<p>No recordings waiting.</p>'}`;
    return page('Volunteer voices', body, user, flash);
  }

  async function moveVoice(key, approve) {
    if (!/^voices\/review\/[a-z0-9-]+\/[a-z]{2}\/[0-9a-f-]{36}\.json$/.test(key)) throw new Error('bad key');
    const base = key.slice(0, -5);
    if (approve) {
      const to = base.replace('voices/review/', 'voices/approved/');
      for (const ext of ['.webm', '.m4a', '.json']) await store.copy('state', base + ext, 'state', to + ext);
    }
    for (const ext of ['.webm', '.m4a', '.json']) await store.del('state', base + ext);
  }

  async function startPublish() {
    try {
      await publish();
      return 'Publishing has started. Approved changes appear in the app within a few minutes.';
    } catch (err) {
      log('ERROR', 'publish trigger failed', { error: err.message });
      return 'Saved, but publishing could not start. Press "Publish approved stories now" to try again.';
    }
  }

  async function handle(req, res) {
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    if (lockedOut(ip)) {
      res.writeHead(429, { 'content-type': 'text/plain', 'retry-after': '900' });
      return res.end('Too many attempts. Try again in 15 minutes.');
    }
    const user = whoIs(req);
    if (!user) {
      const headers = { 'content-type': 'text/plain' };
      if (env('STUDIO_AUTH', 'iap') === 'password') {
        headers['www-authenticate'] = 'Basic realm="Same Moon studio", charset="UTF-8"';
        if (req.headers.authorization) failures.get(ip).push(Date.now());
      }
      res.writeHead(headers['www-authenticate'] ? 401 : 403, headers);
      return res.end('Not allowed');
    }
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;
    const html = (s) => {
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'content-security-policy': "default-src 'self'; style-src 'unsafe-inline'; media-src 'self'; frame-ancestors 'none'",
        'x-robots-tag': 'noindex',
      });
      res.end(s);
    };
    const redirect = (to, flash) => {
      res.writeHead(303, { location: flash ? `${to}?flash=${encodeURIComponent(flash)}` : to });
      res.end();
    };
    const flash = url.searchParams.get('flash');

    if (req.method === 'POST') {
      const site = req.headers['sec-fetch-site'];
      if (site && site !== 'same-origin') {
        res.writeHead(403);
        return res.end();
      }
    }

    if (req.method === 'GET' && p === '/healthz') { res.writeHead(200); return res.end('ok'); }
    if (req.method === 'GET' && p === '/') return html(await dashboard(user, flash));
    if (req.method === 'GET' && p === '/voices') return html(await voicesPage(user, flash));

    let m;
    if (req.method === 'GET' && (m = /^\/story\/([a-z0-9-]+)\/([a-z]{2})$/.exec(p))) {
      const out = await storyPage(user, m[1], m[2], flash);
      if (out) return html(out);
    }
    if (req.method === 'GET' && p.startsWith('/audio/')) {
      const key = decodeURIComponent(p.slice('/audio/'.length));
      if (/^(audio|voices\/review|voices\/approved)\/[\w./-]+\.(m4a|webm)$/.test(key) && !key.includes('..')) {
        const buf = await store.get('state', key);
        if (buf) return sendAudio(req, res, buf, contentTypeFor(key));
      }
    }
    if (req.method === 'POST' && (m = /^\/story\/([a-z0-9-]+)\/([a-z]{2})\/(approve|changes)$/.exec(p))) {
      const s = stories.find((x) => x.id === m[1]);
      if (s && s[m[2]] && storyLangs(s).includes(m[2])) {
        const form = await readBody(req);
        const hash = textHash(s, m[2]);
        if (m[3] === 'approve') {
          await setStatus(store, s.id, m[2], { state: 'approved', hash, by: user });
          log('INFO', 'story approved', { story: s.id, lang: m[2], hash, by: user });
          return redirect(`/story/${s.id}/${m[2]}`, await startPublish());
        }
        const note = (form.get('note') || '').slice(0, 2000);
        await setStatus(store, s.id, m[2], { state: 'changes', hash, by: user, note });
        log('INFO', 'changes requested', { story: s.id, lang: m[2], by: user });
        return redirect(`/story/${s.id}/${m[2]}`, (await startPublish()).replace('Publishing has started.', 'Sent back for changes. It has been taken out of the app.'));
      }
    }
    if (req.method === 'POST' && (p === '/voices/approve' || p === '/voices/reject')) {
      const form = await readBody(req);
      await moveVoice(form.get('key') || '', p.endsWith('approve'));
      log('INFO', p.endsWith('approve') ? 'voice approved' : 'voice rejected', { by: user });
      return redirect('/voices', p.endsWith('approve') ? await startPublish() : 'Recording deleted.');
    }
    if (req.method === 'POST' && p === '/publish') return redirect('/', await startPublish());

    res.writeHead(404, { 'content-type': 'text/plain' });
    return res.end('Not found');
  }

  return http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      log('ERROR', 'studio request failed', { error: err.message });
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain' });
      res.end('Something went wrong');
    });
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const port = Number(process.env.PORT || 8081);
  createServer().listen(port, () => log('INFO', `studio listening on ${port}`));
}

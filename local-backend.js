/* PaceMates local mode.
   A tiny stand-in for the server that keeps all data in this browser (localStorage).
   It answers the same API calls as Backend/server.py, so the website code is identical in both modes.
   The database starts empty: every runner and club is created by the people using the app. */
(function () {
'use strict';

const KEY = 'pacemates-local-db-v2';
const NEIGHBORHOODS = ['Retiro', 'Chamberí', 'Malasaña', 'Salamanca', 'Moncloa', 'Lavapiés', 'Arganzuela', 'Casa de Campo', 'Chamartín'];
const GENDERS = ['Woman', 'Man', 'Non-binary', 'Prefer not to say'];
const NATIONALITIES = ['Spain', 'Germany', 'Italy', 'France', 'United Kingdom', 'United States', 'Portugal', 'Mexico', 'Brazil', 'Netherlands', 'Colombia', 'Other'];
const LANGUAGES = ['English', 'Spanish', 'German', 'French', 'Italian', 'Portuguese'];
const TYPES = ['Social', 'Training', 'Trail', 'Intervals', 'Beginner-friendly'];
const DISTANCES = [3, 5, 6, 8, 10, 12, 15, 18, 21];
const PACE_MIN = 240, PACE_MAX = 480;

const fmtPace = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
const clean = (s, n) => String(s == null ? '' : s).replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const displayName = name => { const p = name.split(' '); return p.length < 2 ? p[0] : p[0] + ' ' + p[p.length - 1][0].toUpperCase() + '.'; };
const nowIso = () => new Date().toISOString().slice(0, 19);
function fail(status, message) { const e = new Error(message); e.status = status; return e; }

/* ---------- starting data: empty (people and clubs come from the users) ---------- */
function buildSample() {
  return { users: {}, clubs: [], creds: {}, sessions: {}, log: [] };
}

/* ---------- storage ---------- */
function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw); } catch (e) { /* fall through */ }
  const db = buildSample(); save(db); return db;
}
function save(db) { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* storage full or blocked */ } }
function log(db, text) { db.log.push(new Date().toISOString().slice(0, 16).replace('T', ' ') + ' · ' + clean(text, 200)); db.log = db.log.slice(-80); }
async function hash(pw, salt) {
  const data = new TextEncoder().encode(salt + ':' + pw);
  if (window.crypto && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 5381; data.forEach(b => { h = ((h << 5) + h + b) >>> 0; }); return 'x' + h.toString(16);
}
const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(4))).map(b => b.toString(16).padStart(2, '0')).join('');

/* ---------- views of the data (same shapes as the server) ---------- */
const pubUser = u => ({ userId: u.id, name: displayName(u.name), nationality: u.nationality, gender: u.gender, pace: u.pace });
const ownUser = u => ({ id: u.id, name: u.name, gender: u.gender, nationality: u.nationality, hood: u.hood, pace: u.pace, days: u.days, langs: u.langs });
function pubClub(db, c) {
  const f = db.users[c.founderId];
  return { id: c.id, name: c.name, hood: c.hood, meet: c.meet, pace: c.pace, dist: c.dist, days: c.days, time: c.time, types: c.types, langs: c.langs, max: c.max, women: c.women,
    desc: c.desc, founderId: c.founderId, founder: f ? displayName(f.name) : 'Former member', members: c.members.filter(i => db.users[i]).map(i => pubUser(db.users[i])) };
}

/* ---------- validation ---------- */
function str(d, k, lo, hi, label) { const v = clean(d[k], hi); if (v.length < lo) throw fail(400, label + ' is required.'); return v; }
function choice(d, k, opts, label) { if (!opts.includes(d[k])) throw fail(400, 'Choose a valid ' + label + '.'); return d[k]; }
function paceOf(d) { const v = parseInt(d.pace, 10); if (!(v >= PACE_MIN && v <= PACE_MAX)) throw fail(400, 'Choose your pace.'); return v; }
function subset(v, opts, label, min) {
  v = Array.isArray(v) ? v : [];
  if (v.some(x => !opts.includes(x))) throw fail(400, 'Invalid ' + label + '.');
  v = opts.filter(x => v.includes(x));
  if (v.length < (min || 0)) throw fail(400, 'Select at least one ' + label + '.');
  return v;
}
function fullName(d) { const n = str(d, 'name', 3, 60, 'Your name'); if (n.split(' ').length < 2) throw fail(400, 'Enter your first and last name.'); return n; }

/* ---------- the API ---------- */
async function handle(method, path, body, token) {
  body = body || {};
  const db = load(), parts = path.split('/').filter(Boolean);
  const sid = token && db.sessions[token];
  const user = sid ? db.users[sid] : null;
  const need = () => { if (!user) throw fail(401, 'Please log in.'); return user; };
  const done = v => { save(db); return v; };
  const route = method + ' ' + parts.join('/');

  if (route === 'GET public') return { users: Object.keys(db.users).length, clubs: db.clubs.length, neighborhoods: new Set(db.clubs.map(c => c.hood)).size };

  if (route === 'POST signup') {
    const name = fullName(body);
    if (Object.values(db.users).some(u => u.name.toLowerCase() === name.toLowerCase())) throw fail(409, 'That name already has an account. Log in instead.');
    const pw = String(body.password || '');
    if (pw.length < 4 || pw.length > 128) throw fail(400, 'Use a password with at least 4 characters.');
    const id = 'u' + rid();
    const u = { id: id, name: name, gender: choice(body, 'gender', GENDERS, 'gender'), nationality: choice(body, 'nationality', NATIONALITIES, 'nationality'),
      hood: choice(body, 'hood', NEIGHBORHOODS, 'neighborhood'), pace: paceOf(body), days: subset(body.days, [0, 1, 2, 3, 4, 5, 6], 'day'), langs: subset(body.langs, LANGUAGES, 'language'), created: nowIso() };
    const salt = rid();
    db.creds[id] = { salt: salt, hash: await hash(pw, salt) };
    db.users[id] = u;
    const tok = rid() + rid() + rid();
    db.sessions[tok] = id;
    log(db, displayName(u.name) + ' signed up (' + u.hood + ', ' + fmtPace(u.pace) + ' min/km)');
    return done({ token: tok, user: ownUser(u) });
  }
  if (route === 'POST login') {
    const name = clean(body.name, 60).toLowerCase();
    const u = Object.values(db.users).find(x => x.name.toLowerCase() === name), cred = u && db.creds[u.id];
    if (!cred || (await hash(String(body.password || ''), cred.salt)) !== cred.hash) throw fail(401, 'Name or password is not right.');
    const tok = rid() + rid() + rid();
    db.sessions[tok] = u.id;
    return done({ token: tok, user: ownUser(u) });
  }

  if (route === 'GET me') return { user: ownUser(need()) };
  if (route === 'PUT me') {
    const u = need();
    Object.assign(u, { name: fullName(body), hood: choice(body, 'hood', NEIGHBORHOODS, 'neighborhood'), pace: paceOf(body), days: subset(body.days, [0, 1, 2, 3, 4, 5, 6], 'day'), langs: subset(body.langs, LANGUAGES, 'language') });
    log(db, displayName(u.name) + ' updated the profile');
    return done({ user: ownUser(u) });
  }
  if (route === 'DELETE me') {
    const u = need();
    delete db.users[u.id]; delete db.creds[u.id];
    db.clubs.forEach(c => { c.members = c.members.filter(i => i !== u.id); });
    Object.keys(db.sessions).forEach(t => { if (db.sessions[t] === u.id) delete db.sessions[t]; });
    log(db, displayName(u.name) + ' deleted the account');
    return done({ ok: true });
  }

  if (route === 'GET clubs') { need(); return { clubs: db.clubs.map(c => pubClub(db, c)) }; }
  if (route === 'POST clubs') {
    const u = need(), dist = parseInt(body.dist, 10), mx = parseInt(body.max, 10), t = String(body.time || '');
    if (!DISTANCES.includes(dist) || !(mx >= 6 && mx <= 20)) throw fail(400, 'Invalid distance or group size.');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) throw fail(400, 'Pick a start time.');
    if (body.women && u.gender === 'Man') throw fail(400, 'Only women can start a women-only club.');
    const c = { id: 'u' + rid(), name: str(body, 'name', 3, 48, 'Club name'), hood: choice(body, 'hood', NEIGHBORHOODS, 'neighborhood'), meet: str(body, 'meet', 2, 60, 'Meeting point'),
      pace: paceOf(body), dist: dist, days: subset(body.days, [0, 1, 2, 3, 4, 5, 6], 'day', 1), time: t, types: subset(body.types || ['Social'], TYPES, 'style', 1),
      langs: subset(body.langs, LANGUAGES, 'language', 1), max: mx, women: !!body.women, desc: clean(body.desc, 280) || 'A new running club.', founderId: u.id, members: [u.id], created: nowIso() };
    db.clubs.unshift(c);
    log(db, displayName(u.name) + ' started the club "' + c.name + '"');
    return done({ club: pubClub(db, c) });
  }
  const m = /^POST clubs\/([^/]+)\/(join|leave)$/.exec(route);
  if (m) {
    const u = need(), c = db.clubs.find(x => x.id === m[1]);
    if (!c) throw fail(404, 'Club not found.');
    if (m[2] === 'join') {
      if (!c.members.includes(u.id)) {
        if (c.women && u.gender === 'Man') throw fail(403, 'This club is for women.');
        if (c.members.length >= c.max) throw fail(409, 'This club is full.');
        c.members.push(u.id); log(db, displayName(u.name) + ' joined "' + c.name + '"');
      }
    } else { c.members = c.members.filter(i => i !== u.id); log(db, displayName(u.name) + ' left "' + c.name + '"'); }
    return done({ club: pubClub(db, c) });
  }

  /* admin view (no key needed in local mode: the data only lives in this browser) */
  if (route === 'GET admin/overview') {
    const users = Object.values(db.users).map(u => Object.assign(ownUser(u), { created: u.created, clubs: db.clubs.filter(c => c.members.includes(u.id)).map(c => c.name) }))
      .sort((a, b) => b.created.localeCompare(a.created));
    const clubs = db.clubs.map(c => Object.assign(pubClub(db, c), { created: c.created })).sort((a, b) => b.created.localeCompare(a.created));
    const paces = users.map(u => u.pace);
    const by = key => users.reduce((o, u) => { o[u[key]] = (o[u[key]] || 0) + 1; return o; }, {});
    return { dataDir: 'This browser (local storage). Not connected to a server.',
      stats: { users: users.length, clubs: clubs.length, memberships: db.clubs.reduce((n, c) => n + c.members.length, 0), avgPace: paces.length ? Math.round(paces.reduce((a, b) => a + b, 0) / paces.length) : null, byHood: by('hood'), byGender: by('gender') },
      users: users, clubs: clubs, activity: db.log.slice().reverse().slice(0, 40) };
  }
  let d = /^DELETE admin\/(users|clubs)\/([^/]+)$/.exec(route);
  if (d) {
    if (d[1] === 'users') { delete db.users[d[2]]; delete db.creds[d[2]]; db.clubs.forEach(c => { c.members = c.members.filter(i => i !== d[2]); }); }
    else db.clubs = db.clubs.filter(c => c.id !== d[2]);
    return done({ ok: true });
  }
  throw fail(404, 'Not found.');
}

window.PaceMatesLocal = { handle: handle, reset: function () { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } } };
})();

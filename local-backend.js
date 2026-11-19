/* PaceMates local mode.
   A tiny stand-in for the server that keeps all data in this browser (localStorage).
   It answers the same API calls as Backend/server.py, so the website code is identical in both modes.
   Used automatically on GitHub Pages (see config.js). The sample runners and clubs below are made up. */
(function () {
'use strict';

const KEY = 'pacemates-local-db-v1';
const NEIGHBORHOODS = ['Retiro', 'Chamberí', 'Malasaña', 'Salamanca', 'Moncloa', 'Lavapiés', 'Arganzuela', 'Casa de Campo', 'Chamartín'];
const GENDERS = ['Woman', 'Man', 'Non-binary', 'Prefer not to say'];
const NATIONALITIES = ['Spain', 'Germany', 'Italy', 'France', 'United Kingdom', 'United States', 'Portugal', 'Mexico', 'Brazil', 'Netherlands', 'Colombia', 'Other'];
const LANGUAGES = ['English', 'Spanish', 'German', 'French', 'Italian', 'Portuguese'];
const TYPES = ['Social', 'Training', 'Trail', 'Intervals', 'Beginner-friendly'];
const DISTANCES = [3, 5, 6, 8, 10, 12, 15, 18, 21];
const PACE_MIN = 240, PACE_MAX = 480;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const parsePaceStr = s => { const [m, r] = s.split(':').map(Number); return m * 60 + r; };
const fmtPace = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
const clean = (s, n) => String(s == null ? '' : s).replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const displayName = name => { const p = name.split(' '); return p.length < 2 ? p[0] : p[0] + ' ' + p[p.length - 1][0].toUpperCase() + '.'; };
const nowIso = () => new Date().toISOString().slice(0, 19);
function fail(status, message) { const e = new Error(message); e.status = status; return e; }

/* ---------- sample people and clubs (made up) ---------- */
// [name, nationality, gender]
const PEOPLE = [
  ['Lucía M.','Spain','Woman'],['Elena R.','Italy','Woman'],['Ana P.','Portugal','Woman'],['Sofía G.','Spain','Woman'],
  ['Clara W.','Germany','Woman'],['Laura S.','Spain','Woman'],['Inês C.','Portugal','Woman'],['Julia F.','Brazil','Woman'],
  ['Carmen D.','Spain','Woman'],['Hannah K.','Germany','Woman'],['Paula N.','Spain','Woman'],['Irene V.','Spain','Woman'],
  ['Giulia B.','Italy','Woman'],['Mia D.','Netherlands','Woman'],['Sara L.','Spain','Woman'],['Chloé M.','France','Woman'],
  ['Marta O.','Portugal','Woman'],['Emma T.','United Kingdom','Woman'],['Lena H.','Germany','Woman'],['Noa A.','Spain','Woman'],
  ['Alice P.','France','Woman'],['Nora B.','Germany','Woman'],['Camille R.','France','Woman'],['Valentina C.','Italy','Woman'],
  ['Maya S.','United States','Woman'],['Isabel T.','Mexico','Woman'],['Katja L.','Germany','Woman'],['Rosa M.','Spain','Woman'],
  ['Sophie L.','Netherlands','Woman'],['Martina F.','Italy','Woman'],['Beatriz A.','Portugal','Woman'],['Daniela R.','Colombia','Woman'],
  ['Tom H.','United Kingdom','Man'],['Jonas B.','Germany','Man'],['Marc L.','France','Man'],['Ben C.','United States','Man'],
  ['Diego R.','Mexico','Man'],['Nico F.','Italy','Man'],['Pieter V.','Netherlands','Man'],['Rafa M.','Spain','Man'],
  ['Max W.','Germany','Man'],['Luca G.','Italy','Man'],['Olivier D.','France','Man'],['Kai S.','Germany','Man'],
  ['Will T.','United Kingdom','Man'],['Álvaro P.','Spain','Man'],['Théo B.','France','Man'],['Leon K.','Germany','Man'],
  ['Dan R.','United States','Man'],['Paco G.','Spain','Man'],['Fabio C.','Italy','Man'],['Ravi P.','United Kingdom','Man'],
  ['Hugo S.','Spain','Man'],['Pablo N.','Spain','Man'],['Andrés V.','Colombia','Man'],['Mateus L.','Brazil','Man'],
  ['Daniel K.','United States','Man'],['Felix R.','Germany','Man'],['Marco B.','Italy','Man'],['Javi C.','Spain','Man'],
  ['Tiago F.','Portugal','Man'],['Joan T.','Spain','Man'],['Sam J.','United Kingdom','Non-binary'],['Alex M.','Spain','Non-binary']
];

// days: 0 = Monday ... 6 = Sunday
const CLUB_SEED = [
  { name:'Retiro Sunrise Runners', hood:'Retiro', meet:'Puerta de Alcalá', pace:'5:00', dist:10, days:[1,3], time:'07:00', types:['Training'], langs:['English','Spanish'], max:14,
    desc:'Steady morning runs on the main Retiro loop with a few strides at the end. Come on time, we leave at 7:00 sharp so everyone is at work by nine.' },
  { name:'Chamberí Easy Pace', hood:'Chamberí', meet:'Plaza de Olavide', pace:'6:30', dist:6, days:[5], time:'09:00', types:['Social','Beginner-friendly'], langs:['English','Spanish'], max:12,
    desc:'A relaxed Saturday run where nobody gets left behind. We keep it conversational and finish with a coffee on the square.' },
  { name:'Malasaña Night Runs', hood:'Malasaña', meet:'Plaza del Dos de Mayo', pace:'5:45', dist:8, days:[2], time:'20:00', types:['Social'], langs:['English','Spanish'], max:12,
    desc:'Midweek evening loop through the quiet streets towards Moncloa and back. Reflective vests recommended, head torches welcome.' },
  { name:'Casa de Campo Trail Crew', hood:'Casa de Campo', meet:'Teleférico station', pace:'5:15', dist:12, days:[6], time:'08:30', types:['Trail'], langs:['Spanish','English','German'], max:16,
    desc:'Sunday trail run on the dirt paths and hills of Casa de Campo. Trail shoes are best. We regroup at every junction.' },
  { name:'Madrid Río Riverside', hood:'Arganzuela', meet:'Matadero Madrid, main entrance', pace:'6:00', dist:8, days:[0,4], time:'07:30', types:['Social'], langs:['English','Spanish'], max:14,
    desc:'Flat and fast out-and-back along the river, a good start or end to the working week. All paces up to 6:15 are welcome.' },
  { name:'Salamanca Social Jog', hood:'Salamanca', meet:'Plaza de Colón', pace:'6:45', dist:5, days:[5], time:'10:00', types:['Social','Beginner-friendly'], langs:['English','Spanish','French'], max:14,
    desc:'A friendly 5K on the Castellana boulevard and through the Retiro gates. New to running? This is the place to start.' },
  { name:'Chamberí Morning Loop', hood:'Chamberí', meet:'Glorieta de Quevedo', pace:'5:45', dist:8, days:[1,3], time:'07:30', types:['Training'], langs:['English','Spanish','German'], max:12,
    desc:'Two weekday runs a week, 8 km at an even effort around Chamberí and Parque del Oeste. We hold the pace together.' },
  { name:'Parque del Oeste Hill Repeats', hood:'Moncloa', meet:'Templo de Debod, main steps', pace:'5:15', dist:7, days:[3], time:'20:00', types:['Intervals'], langs:['English','Spanish','French'], max:10,
    desc:'Warm-up, six hill repeats in the park, cool-down. Hard but friendly. Please tell us if you are coming so we can plan the sets.' },
  { name:'Moncloa Campus Runners', hood:'Moncloa', meet:'Faro de Moncloa', pace:'6:00', dist:7, days:[2], time:'19:30', types:['Social'], langs:['English','Spanish','German','French'], max:18,
    desc:'Founded by students and open to everyone. A relaxed run with lots of newcomers every week and a standing group of regulars.' },
  { name:'Retiro Steady State', hood:'Retiro', meet:'Estanque Grande', pace:'6:15', dist:10, days:[5], time:'08:30', types:['Training'], langs:['English','Spanish'], max:14,
    desc:'Ten kilometers at a controlled effort. Good for anyone building towards a half marathon. We run in two groups if needed.' },
  { name:'Malasaña Early Birds', hood:'Malasaña', meet:'Glorieta de Bilbao', pace:'5:30', dist:7, days:[0,2], time:'07:00', types:['Training'], langs:['English','Spanish','French'], max:10,
    desc:'A small group that likes to be done before the city wakes up. Seven kilometers, consistent pace, no drop-offs.' },
  { name:'Lavapiés Fun Run', hood:'Lavapiés', meet:'Plaza de Lavapiés', pace:'6:30', dist:5, days:[6], time:'10:00', types:['Social','Beginner-friendly'], langs:['English','Spanish'], max:15,
    desc:'Sunday 5K with music, costumes now and then, and brunch afterwards. The pace is easy and the mood is the point.' },
  { name:'Chamartín Long Run Club', hood:'Chamartín', meet:'Plaza de Castilla', pace:'5:30', dist:16, days:[6], time:'08:00', types:['Training'], langs:['English','Spanish','German'], max:12,
    desc:'Long Sunday runs along the Castellana and into Parque Juan Carlos I or back. Bring water and a gel for anything over 14 km.' },
  { name:'Women Run Retiro', hood:'Retiro', meet:'Puerta de Alcalá', pace:'6:15', dist:7, days:[1], time:'19:30', types:['Social'], langs:['English','Spanish'], max:16, women:true,
    desc:'A women-only group that meets on Tuesday evenings. We run together, stretch together and keep the mood supportive.' },
  { name:'Madrid Río Intervals', hood:'Arganzuela', meet:'Puente de Segovia', pace:'4:45', dist:9, days:[1], time:'20:15', types:['Intervals'], langs:['English','Spanish'], max:10,
    desc:'Track-style intervals on the flat river path. For runners who already hold 5:00 per km or faster for a longer distance.' },
  { name:'Casa de Campo Easy Trail', hood:'Casa de Campo', meet:'Lago, boathouse side', pace:'6:45', dist:8, days:[5], time:'09:30', types:['Trail','Beginner-friendly'], langs:['English','Spanish'], max:14,
    desc:'Gentle introduction to trail running on the wide paths around the lake. Walk breaks are normal and encouraged.' },
  { name:'Chamberí Lunch Runners', hood:'Chamberí', meet:'Plaza de Chamberí', pace:'5:45', dist:6, days:[0,2,4], time:'13:30', types:['Social'], langs:['English','Spanish'], max:10,
    desc:'Forty-five minutes on your lunch break: run, shower, back at your desk. Showers are available at a nearby gym for a small fee.' },
  { name:'Malasaña Sunday Reset', hood:'Malasaña', meet:'Plaza de San Ildefonso', pace:'7:00', dist:5, days:[6], time:'11:00', types:['Social','Beginner-friendly'], langs:['English','Spanish','Italian'], max:14,
    desc:'A slow, short run to start the week well. Walkers and run-walkers are welcome, no one is timing anything.' },
  { name:'Salamanca Tempo Club', hood:'Salamanca', meet:'Calle de Velázquez, Núñez de Balboa', pace:'5:00', dist:10, days:[3], time:'07:00', types:['Training'], langs:['English','Spanish'], max:12,
    desc:'Thursday tempo session: easy warm-up, 5 km at a comfortably hard pace, easy cool-down. For regular runners.' },
  { name:'Moncloa Sunrise Hills', hood:'Moncloa', meet:'Puente de los Franceses', pace:'5:30', dist:8, days:[5], time:'08:00', types:['Training'], langs:['English','Spanish'], max:12,
    desc:'Rolling route through Parque del Oeste and Casa de Campo. Plenty of elevation, great views, easy conversation on the flats.' },
  { name:'Arganzuela Evening Easy', hood:'Arganzuela', meet:'Puente de Toledo', pace:'7:00', dist:5, days:[3], time:'20:00', types:['Social','Beginner-friendly'], langs:['English','Spanish','Portuguese'], max:14,
    desc:'A relaxed after-work run along the river. We start with a few minutes of walking, then jog at a very easy pace.' },
  { name:'Atocha Early Run', hood:'Lavapiés', meet:'Plaza del Emperador Carlos V', pace:'5:45', dist:9, days:[0,3], time:'07:15', types:['Training'], langs:['English','Spanish'], max:12,
    desc:'Loop through Retiro and back, nine kilometers at a steady effort twice a week. Good for building routine.' },
  { name:'Casa de Campo Sunday Long', hood:'Casa de Campo', meet:'Teleférico station', pace:'5:45', dist:18, days:[6], time:'07:30', types:['Trail','Training'], langs:['Spanish','English'], max:12,
    desc:'Long trail run for those preparing for a marathon or an ultra. Self-supported, we agree stops in advance.' },
  { name:'Bernabéu Social 5K', hood:'Chamartín', meet:'Paseo de la Castellana, Bernabéu side', pace:'6:30', dist:5, days:[5], time:'10:00', types:['Social','Beginner-friendly'], langs:['English','Spanish'], max:16,
    desc:'Saturday 5K with a warm-up, a short loop and a long stretch afterwards. Groups at 6:00, 6:30 and 7:00 per km.' },
  { name:'German Runners Madrid', hood:'Retiro', meet:'Paseo de Coches, Puerta de Alcalá', pace:'6:00', dist:8, days:[5], time:'09:00', types:['Social'], langs:['German','English'], max:14,
    desc:'Ein Lauftreff für Deutschsprachige in Madrid. We switch to English whenever someone new joins.' }
];

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function slug(s) { return s.normalize('NFKD').replace(/[^\x00-\x7F]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, ''); }

function buildSample() {
  const users = {}, clubs = [], byKey = {};
  let n = 0;
  CLUB_SEED.forEach((c, i) => {
    const rnd = mulberry32(i * 7919 + 13);
    const pool = PEOPLE.filter(p => !c.women || p[2] === 'Woman');
    const order = pool.map(p => ({ p, k: rnd() })).sort((a, b) => a.k - b.k).map(x => x.p);
    const count = clamp(Math.round(c.max * (0.5 + rnd() * 0.42)), 3, c.max);
    const basePace = parsePaceStr(c.pace);
    const members = order.slice(0, count).map(p => {
      const key = p[0] + '|' + p[1];
      if (!byKey[key]) {
        const id = 's' + (++n);
        byKey[key] = id;
        users[id] = { id: id, name: p[0], email: slug(p[0]) + '.' + slug(p[1]).slice(0, 2) + '@example.com', gender: p[2], nationality: p[1], hood: c.hood,
          pace: clamp(basePace + Math.round((rnd() * 2 - 1) * 4) * 5, PACE_MIN, PACE_MAX), days: c.days.slice(), langs: c.langs.slice(0, 2),
          created: new Date(Date.UTC(2026, 9, 20 + (n % 24), 8 + (n % 10), (n * 7) % 60)).toISOString().slice(0, 19), sample: true };
      }
      return byKey[key];
    });
    clubs.push({ id: 'c' + (i + 1), name: c.name, hood: c.hood, meet: c.meet, pace: basePace, dist: c.dist, days: c.days, time: c.time, types: c.types, langs: c.langs,
      max: c.max, women: !!c.women, desc: c.desc, founderId: members[0], members: members, created: new Date(Date.UTC(2026, 9, 18 + (i % 20), 9, i * 2)).toISOString().slice(0, 19) });
  });
  return { users: users, clubs: clubs, creds: {}, sessions: {}, log: ['Sample runners and clubs loaded'] };
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
const ownUser = u => ({ id: u.id, name: u.name, email: u.email, gender: u.gender, nationality: u.nationality, hood: u.hood, pace: u.pace, days: u.days, langs: u.langs });
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
    const email = clean(body.email, 120).toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw fail(400, 'Enter a valid email address.');
    if (Object.values(db.users).some(u => u.email === email)) throw fail(409, 'That email already has an account. Log in instead.');
    const pw = String(body.password || '');
    if (pw.length < 8 || pw.length > 128) throw fail(400, 'Use a password with at least 8 characters.');
    const id = 'u' + rid();
    const u = { id: id, name: fullName(body), email: email, gender: choice(body, 'gender', GENDERS, 'gender'), nationality: choice(body, 'nationality', NATIONALITIES, 'nationality'),
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
    const email = clean(body.email, 120).toLowerCase();
    const u = Object.values(db.users).find(x => x.email === email), cred = u && db.creds[u.id];
    if (!cred || (await hash(String(body.password || ''), cred.salt)) !== cred.hash) throw fail(401, 'Email or password is not right.');
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

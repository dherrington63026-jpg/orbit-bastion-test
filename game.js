'use strict';
/* Orbit Bastion - small version: 3 sectors, 6 towers x3 tiers + Prime merge, ground/air enemies, 2 abilities. Offline, no account. */
const W = 360, H = 600, START_LIVES = 20;

const LEVELS = [
  { name:'Landing Dock', sub:'Learn the basics', waves:8, hp:.8, gold:300, hue:210,
    paths:[[[-20,60],[310,60],[310,160],[50,160],[50,260],[310,260],[310,360],[50,360],[50,460],[230,460],[230,570]]],
    pads:[[100,110],[190,110],[270,110],[100,210],[190,210],[270,210],[100,310],[190,310],[270,310],[100,410],[190,410],[150,515]] },
  { name:'Ring Corridor', sub:'Longer lanes, tighter slots', waves:10, hp:1.0, gold:380, hue:280,
    paths:[[[-20,80],[180,80],[180,200],[300,200],[300,340],[60,340],[60,470],[250,470],[250,570]]],
    pads:[[100,410],[260,270],[140,140],[220,140],[190,510],[120,300],[240,380],[60,40],[220,430],[30,120],[30,490],[270,160],[290,510],[150,380],[30,320],[330,360],[120,40],[330,180]] },
  { name:'Twin Gate', sub:'Two entrances, one core', waves:12, hp:1.0, gold:450, hue:160,
    paths:[[[-20,70],[120,70],[120,200],[180,260],[180,420],[180,570]], [[380,70],[240,70],[240,200],[180,260],[180,420],[180,570]]],
    pads:[[170,200],[140,290],[140,360],[140,430],[140,500],[60,110],[300,110],[200,160],[60,30],[300,30],[140,550],[80,160]] }
];

/* hits: which layers a tower can shoot. type: damage type. ap: armor piercing. */
const TOWERS = {
  pulse:   { name:'Pulse',   icon:'🔵', cost:55,  range:64,  dmg:6,  rate:1.0,  col:'#6fe3ff', hits:['ground','air'], type:'energy',    ap:0, aoe:1, desc:'Sends out a shockwave that hits EVERY enemy in range, ground and air.', strong:'crowds, swarms, scouts', weak:'armor, shields' },
  rail:    { name:'Rail',    icon:'➖', cost:110, range:130, dmg:48, rate:1.5, col:'#ffffff', hits:['ground'],       type:'kinetic',   ap:6, desc:'Ground only. Long range, pierces armor.', strong:'brutes, stalkers', weak:'swarms, air (cannot hit)' },
  missile: { name:'Missile', icon:'🚀', cost:120, range:82,  dmg:20, rate:1.4, col:'#ff9a4a', hits:['ground'],       type:'explosive', ap:0, splash:36, desc:'Ground only. Blast hits groups.', strong:'swarms, groups', weak:'brutes, air (cannot hit)' },
  flak:    { name:'Flak',    icon:'✈️', cost:100, range:92,  dmg:14, rate:.7,  col:'#ffcf6b', hits:['air'],          type:'explosive', ap:0, splash:30, desc:'Air only. Bursts shred flyers.', strong:'scouts, bombers, boss', weak:'ground (cannot hit)' },
  cryo:    { name:'Cryo',    icon:'❄️', cost:90,  range:66,  dmg:0,  rate:1,   col:'#9fd8ff', hits:['ground','air'], type:'cold',      ap:0, slow:.32, desc:'Slows ground AND air. No damage.', strong:'speedsters', weak:'does no damage' },
  beam:    { name:'Beam',    icon:'🔆', cost:150, range:92,  dmg:22, rate:.1,  col:'#ff7ae6', hits:['ground','air'], type:'energy',    ap:3, locked:1, desc:'Locks on with a continuous beam that grows stronger the longer it holds a target.', strong:'bosses, brutes, shields', weak:'swarms (one target)' },
  gravity: { name:'Gravity', icon:'🌀', cost:125, range:72,  dmg:0,  rate:1,   col:'#7b8cff', hits:['ground','air'], type:'gravity',   ap:0, locked:1, pull:16, desc:'Pulls enemies backward and slows them. Bosses resist.', strong:'holding crowds in a kill zone', weak:'does no damage' },
  tesla:   { name:'Arc',     icon:'⚡', cost:130, range:64,  dmg:15, rate:1.0, col:'#c28bff', hits:['ground','air'], type:'electric',  ap:0, chain:3, desc:'Lightning jumps between enemies, ground and air.', strong:'shields, swarms', weak:'boss, brutes' }
};
const KINDS = ['pulse', 'rail', 'missile', 'flak', 'cryo', 'tesla', 'beam', 'gravity'];
const LOADOUT_N = 6;
const avail = () => {
  let u = KINDS.filter(k => !TOWERS[k].locked || prog.tw[k]);
  if (typeof CUR !== 'undefined' && CUR && CUR.only) return u.filter(k => CUR.only.includes(k));
  if (u.length > LOADOUT_N) { const lo = (prog.loadout || []).filter(k => u.includes(k)); u = lo.length === LOADOUT_N ? lo : u.slice(0, LOADOUT_N); }
  return u;
};
const TAG = k => TOWERS[k].hits.length === 2 ? 'Ground+Air' : TOWERS[k].hits[0] === 'air' ? 'Air only' : 'Ground only';

/* air: flies (only 'air' towers hit it). armor: flat damage cut per hit. mods: damage type multipliers. intro: [sector, wave] it first appears. */
const ENEMY = {
  drone:  { name:'Drone',     hp:32,   sp:40, gold:4,   leak:1,  col:'#ff6b8b', cost:4,   air:false, armor:0, mods:{},                                  intro:[0,1], note:'Basic ground robot.' },
  scout:  { name:'Wasp Scout',hp:16,   sp:78, gold:3,   leak:1,  col:'#ffd24a', cost:3,   air:true,  armor:0, mods:{},                                  intro:[0,2], note:'FLYING and fast. Only Pulse, Arc and Flak can hit air.' },
  swarm:  { name:'Swarm Bug', hp:10,   sp:55, gold:2,   leak:1,  col:'#7dff9a', cost:2,   air:false, armor:0, mods:{ explosive:1.5, electric:1.3 },     intro:[1,2], note:'Many tiny bugs. Weak to Missile and Arc.' },
  stalker:{ name:'Stalker',   hp:70,   sp:62, gold:6,   leak:1,  col:'#b88bff', cost:6,   air:false, armor:1, mods:{ kinetic:1.3, explosive:.85 },      intro:[3,1], note:'Fast armored ground hunter. Rail hits it hard.' },
  shield: { name:'Shield Walker',hp:120,sp:30,gold:9,   leak:2,  col:'#6fb7ff', cost:9,   air:false, armor:0, mods:{ energy:.5, electric:1.6 },         intro:[5,1], note:'Energy shield blocks Pulse. Weak to Arc.' },
  bomber: { name:'Bomber',    hp:170,  sp:26, gold:12,  leak:2,  col:'#ff9a4a', cost:12,  air:true,  armor:3, mods:{ explosive:1.3, energy:.85 },       intro:[7,1], note:'FLYING and armored. Use Flak.' },
  brute:  { name:'Brute',     hp:300,  sp:22, gold:22,  leak:3,  col:'#ff8a3a', cost:22,  air:false, armor:5, mods:{ explosive:.7, kinetic:1.4 },       intro:[10,3], note:'Heavy armor shrugs off weak hits. Use Rail.' },
  boss:   { name:'Dreadnought',hp:2300,sp:18, gold:170, leak:10, col:'#ff3b6b', cost:140, air:true,  armor:4, mods:{ electric:.8, explosive:1.2 },      intro:[999,1], note:'BOSS. Flying! Bring Flak.' }
};
const EH = { drone: 30, scout: 30, swarm: 22, stalker: 34, shield: 42, bomber: 60, brute: 54, boss: 96 };
const MUZ = { beam: [.42, 0], gravity: [0, -.4], pulse: [0, -.4], rail: [.42, -.04], missile: [.34, -.1], flak: [0, -.46], cryo: [0, -.42], tesla: [0, -.46] };


/* ---------- story ---------- */
const SPEAK = { nine: { name: 'Nine', img: 'u_nine' }, quill: { name: 'Quill', img: 'u_quill' }, oru: { name: 'Warden Oru', img: 'u_oru' } };
const WORLDS = [
  { lv: 0, name: 'Bastion Academy', tag: 'The Exam', planet: 'u_planet_academy', pos: [30, 78],
    intro: [['nine', 'Welcome to the Bastion Academy, Cadet {c}. I am Nine. I have trained every defender you have ever heard of, and a few you have not.'], ['nine', 'Today is your exam. Build towers on the glowing hexes, send the waves, and do not let anything touch the core.'], ['nine', 'Ground enemies walk. Air enemies fly. Not every tower can hit both, so read the little tags.']],
    win: ['nine', 'Passed. Do not let it go to your head. It will anyway. Orders just arrived: the Halcyon Ring is under attack. Pack a bag.'],
    lose: ['nine', 'Failed? Nobody fails the exam, they just take it twice. Again.'], reward: null },
  { lv: 1, name: 'Halcyon Ring', tag: 'Orbital habitat', planet: 'u_planet_halcyon', pos: [70, 56],
    intro: [['quill', 'Quill here, Halcyon Ring maintenance. The bombers showed up an hour ago and my coffee is still warm. Please hurry.'], ['nine', 'Bombers fly and wear armor, Cadet {c}. Flak is your friend. So is Arc against shields.']],
    win: ['quill', 'The ring is saved! I owe you a drink, or an upgrade. I made you two: the Repair Pulse for emergencies, and a prototype Beam Prism tower. Do not ask where I got the crystal.'], tower: 'beam',
    lose: ['quill', 'Hang on, I will patch the hull. Want to try again?'], reward: 'repair' },
  { lv: 2, name: 'Gatefall', tag: 'Twin gates', planet: 'u_planet_gate', pos: [30, 34],
    intro: [['oru', 'Two gates, one core, and nowhere to sit down. Welcome to Gatefall.'], ['nine', 'They arrive from both sides and meet at the core. Cover both lanes, Cadet {c}.']],
    win: ['oru', 'Both gates held. Take the Overcharge: every tower fires faster for a short while. And take this Gravity Well. It does not hurt anything. It simply makes them late.'], tower: 'gravity',
    lose: ['oru', 'The gates are patient. So are we. Again.'], reward: 'over' }
];
const TWTXT = { beam: 'Beam Prism tower (a continuous beam that grows stronger the longer it holds a target).', gravity: 'Gravity Well tower (pulls enemies back and slows them).' };
const REWARDS = { repair: 'Repair Pulse (wrench button): restores 5 lives, once per level.', over: 'Overcharge (bolt button): towers fire 50% faster for 8 seconds.' };
const RANKS = [[0, 'Cadet'], [1, 'Defender'], [8, 'Guardian'], [16, 'Warden'], [26, 'Commander']];
const rankOf = () => { const pts = totalCleared(); let r = RANKS[0][1]; RANKS.forEach(x => { if (pts >= x[0]) r = x[1]; }); return r; };
const QUIPS = { nine: ['Clean work. Do not look so surprised.', 'Efficient. I am almost impressed.', 'Another one down. The core remains unbothered.', 'You are getting good at this, which is inconvenient for me.'], quill: ['Hull is holding! That was lovely.', 'You are a lifesaver. Literally. Station-wise.', 'I will put a sticker on your file.', 'No leaks. I checked twice.'], oru: ['The gates are quiet again.', 'Patience and good aim. Both useful.', 'Well held.', 'The road thanks you, in its way.'] };

/* ---------- levels: 10 per world, generated; 3 difficulty tiers ---------- */
const LPW = 10, OPEN_ALL = /[?&]unlock=1/.test(location.search);
const TIERS = [{ n: 'Normal', hp: 1, gold: 1, budget: 1, sp: 1 }, { n: 'Hard', hp: 1.7, gold: .92, budget: 1.22, sp: 1.06 }, { n: 'Nightmare', hp: 3.1, gold: .85, budget: 1.6, sp: 1.18 }];
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rr = (rng, a, b) => a + (b - a) * rng();
function serp(n, rng, wide) {
  const ys = []; for (let i = 0; i < n; i++) ys.push(Math.round(70 + i * (410 / (n - 1))));
  const pts = [[-20, ys[0]]]; let right = true;
  for (let i = 0; i < n; i++) { const x = right ? Math.round(rr(rng, wide ? 250 : 288, 326)) : Math.round(rr(rng, wide ? 30 : 42, wide ? 110 : 72)); pts.push([x, ys[i]]); if (i < n - 1) pts.push([x, ys[i + 1]]); right = !right; }
  const last = pts[pts.length - 1]; last[0] = Math.max(70, Math.min(290, last[0])); pts.push([last[0], 572]);
  return [pts];
}
function spiral(rng, mirror) {
  const j = () => Math.round(rr(rng, -6, 6)), x2 = 250 + j(), x3 = 110 + j(), y2 = 140 + j(), y3 = 460 + j(), y4 = 220 + j();
  let p = [[-20, 60], [320, 60], [320, 540], [40, 540], [40, y2], [x2, y2], [x2, y3], [x3, y3], [x3, y4], [180, y4], [180, y4 + 112]];
  if (mirror) p = p.map(q => [360 - q[0], q[1]]);
  return [p];
}
function dual(rng) {
  const y1 = Math.round(rr(rng, 60, 95)), x1 = Math.round(rr(rng, 90, 140)), ym = Math.round(rr(rng, 180, 230)), cx = 180;
  return [[[-20, y1], [x1, y1], [x1, ym], [cx, ym + 60], [cx, 572]], [[380, y1], [360 - x1, y1], [360 - x1, ym], [cx, ym + 60], [cx, 572]]];
}
function ladder(rng) {
  const ya = Math.round(rr(rng, 70, 100)), yb = Math.round(rr(rng, 340, 380)), xa = Math.round(rr(rng, 280, 320)), xb = Math.round(rr(rng, 40, 80)), yc = yb + 110;
  return [[[-20, ya], [xa, ya], [xa, 210], [180, 210], [180, 572]], [[380, yb], [xb, yb], [xb, yc], [180, yc], [180, 572]]];
}
function genPaths(w, i, rng) {
  switch (i) {
    case 1: return serp(4, rng, false);
    case 2: return serp(5, rng, false);
    case 3: return spiral(rng, w % 2 === 1);
    case 4: return dual(rng);
    case 5: return serp(4, rng, true);
    case 6: return ladder(rng);
    case 7: return spiral(rng, w % 2 === 0);
    case 8: return dual(rng);
    default: return serp(6, rng, i === 9);
  }
}
function autoPads(paths, count, rng) {
  const segs = []; paths.forEach(P => { for (let i = 1; i < P.length; i++) segs.push([P[i - 1], P[i]]); });
  const dseg = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy; let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2; t = Math.max(0, Math.min(1, t)); return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy)); };
  const dist = p => { let m = 1e9; for (const sg of segs) m = Math.min(m, dseg(p, sg[0], sg[1])); return m; };
  const S = []; segs.forEach(([a, b]) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.floor(l / 6)); for (let k = 0; k <= n; k++) S.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); });
  const core = paths[0][paths[0].length - 1], cands = [];
  for (let x = 26; x <= 334; x += 8) for (let y = 26; y <= 574; y += 8) { const d = dist([x, y]); if (d >= 33 && d <= 52 && Math.hypot(x - core[0], y - core[1]) > 40) cands.push([x, y]); }
  const cov = new Array(S.length).fill(0), out = [];
  for (let k = 0; k < count; k++) {
    let best = null, bg = -1;
    for (const c of cands) {
      if (out.some(o => Math.hypot(o[0] - c[0], o[1] - c[1]) < 44)) continue;
      let g = 0, all = 0; for (let i = 0; i < S.length; i++) { if (Math.hypot(S[i][0] - c[0], S[i][1] - c[1]) <= 80) { all++; if (cov[i] < 2) g++; } }
      const sc = g + .02 * all + rng() * .5; if (sc > bg) { bg = sc; best = c; }
    }
    if (!best) break; out.push(best);
    for (let i = 0; i < S.length; i++) if (Math.hypot(S[i][0] - best[0], S[i][1] - best[1]) <= 80) cov[i]++;
  }
  return out;
}
function buildLevel(w, i, t) {
  const g = w * LPW + i, T = TIERS[t], base = LEVELS[w], rng = mulberry(w * 1000 + i * 17 + 5);
  let paths, pads;
  if (i === 0) { paths = base.paths; pads = base.pads; } else { paths = genPaths(w, i, rng); pads = autoPads(paths, 15 + Math.min(4, i >> 1) + w, rng); }
  const finale = i === LPW - 1, mini = i === 4, bm = [.4, .75, 1.1][w] * (finale ? 1 : mini ? .45 : 0);
  return { world: w, idx: i, tier: t, g, name: i === 0 ? base.name : base.name + ' ' + (i + 1), paths, pads,
    waves: 8 + Math.floor(i * .6) + w, hp: (.72 + .03 * g) * T.hp, gold: Math.round((300 + 8 * g) * T.gold), budget: (1 + .02 * g) * T.budget, spMult: T.sp,
    boss: finale || mini, bossMult: bm, hue: base.hue, bgv: i % 4 };
}

/* ---------- waves from a recipe (new enemy types are released slowly) ---------- */
function eligible(g, w) { return Object.keys(ENEMY).filter(t => t !== 'boss' && (g > ENEMY[t].intro[0] || (g === ENEMY[t].intro[0] && w >= ENEMY[t].intro[1]))); }
function makeWaves(lv) {
  const out = [], g = lv.g;
  for (let w = 1; w <= lv.waves; w++) {
    const budget = 38 * (1 + .42 * (w - 1)) * lv.budget * (w === lv.waves ? .7 : 1) * (g === 0 ? .8 : 1);
    const el = eligible(g, w).filter(t => !lv.airOnly || ENEMY[t].air), fresh = el.filter(t => ENEMY[t].intro[0] === g && ENEMY[t].intro[1] === w);
    const picks = fresh.slice();
    for (let i = 0; picks.length < Math.min(3, el.length) && i < 12; i++) { const t = el[(w * 2 + i * 3 + g) % el.length]; if (!picks.includes(t)) picks.push(t); }
    if (w >= 2 && !picks.some(t => ENEMY[t].air) && w % 2 === 0) { const a = el.filter(t => ENEMY[t].air); if (a.length) picks[picks.length - 1] = a[w % a.length]; }
    const groups = [];
    picks.forEach((t, i) => {
      const share = budget * (i === 0 ? .5 : .5 / Math.max(1, picks.length - 1));
      let n = Math.max(ENEMY[t].cost >= 12 ? 1 : 2, Math.round(share / ENEMY[t].cost)); if (lv.swarm) n *= 2;
      if (fresh.includes(t)) n = Math.max(n, 3);
      groups.push([t, n, Math.max(.35, 1.3 - w * .07 - ENEMY[t].sp / 200)]);
    });
    if (w === lv.waves && lv.boss) groups.unshift(['boss', 1, 4]);
    out.push(groups);
  }
  return out;
}

/* ---------- storage ---------- */
const SKEY = 'orbitbastion_stats_v1', PKEY = 'orbitbastion_progress_v1';
function loadJSON(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ? Object.assign(d, v) : d; } catch (e) { return d; } }
let stats = loadJSON(SKEY, { first: Date.now(), days: {}, runs: 0, wins: 0, losses: 0, wavesCleared: 0, bestWave: 0, funYes: 0, funNo: 0, unlockTaps: 0, speedTaps: 0, builds: {}, upgrades: 0, merges: 0, abilities: 0, secs: 0, kills: 0, air: 0, bossKills: 0, mk: {}, dmgBy: {}, byType: {}, cosTry: 0 });
let prog = loadJSON(PKEY, { stars: [0, 0, 0], seen: [], call: '', ab: { repair: false, over: false }, sawIntro: [], tw: { beam: false, gravity: false }, tier: 0 });
if (!prog.tw) prog.tw = { beam: false, gravity: false };
if (!prog.ab) prog.ab = { repair: false, over: false }; if (!prog.sawIntro) prog.sawIntro = [];
const scKey = (w, i, t) => w + '-' + i + '-' + t;
if (!prog.sc) { prog.sc = {}; (prog.stars || []).forEach((st, w) => { if (st > 0) prog.sc[scKey(w, 0, 0)] = st; }); }
const starsOf = (w, i, t) => prog.sc[scKey(w, i, t)] || 0;
const cleared = (w, i, t) => starsOf(w, i, t) > 0;
const worldCleared = w => { let n = 0; for (let i = 0; i < LPW; i++) if (cleared(w, i, 0)) n++; return n; };
const totalCleared = () => WORLDS.reduce((n, _, w) => n + worldCleared(w), 0);
const totalStars = () => Object.values(prog.sc).reduce((a, b) => a + b, 0);
const worldOpen = w => OPEN_ALL || w === 0 || cleared(w - 1, LPW - 1, 0);
const levelOpen = (w, i) => OPEN_ALL || (i === 0 ? worldOpen(w) : cleared(w, i - 1, 0));
const tierOpen = (w, i, t) => OPEN_ALL || t === 0 || cleared(w, i, t - 1);
function save() { try { localStorage.setItem(SKEY, JSON.stringify(stats)); localStorage.setItem(PKEY, JSON.stringify(prog)); } catch (e) {} }
const dk = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate(); };
stats.days[dk()] = (stats.days[dk()] || 0) + 1; save();
let autoWave = false; try { autoWave = localStorage.getItem('orbitbastion_auto') === '1'; } catch (e) {}
let tips = true; try { tips = localStorage.getItem('orbitbastion_tips') !== '0'; } catch (e) {}

/* ---------- rewards: research, mastery, rank perks, medals ---------- */
if (!prog.res) prog.res = {}; if (prog.rp === undefined) prog.rp = 0; if (!prog.medals) prog.medals = {}; if (!prog.flags) prog.flags = {};
const NODES = [];
const SP_TXT = { pulse: ['Concussion', 'Hit enemies are slowed 20% for 1 second.'], rail: ['Critical shots', '20% chance for double damage.'], missile: ['Wide blast', '+25% blast radius.'], flak: ['Double burst', '25% chance of a second burst.'], cryo: ['Brittle frost', 'Slowed enemies take +10% damage from everything.'], tesla: ['Overload', '+1 chain jump and +15% damage.'], beam: ['Fast focus', 'Reaches full power in 1.6 s instead of 2.5 s.'], gravity: ['Heavy well', '+30% pull strength.'] };
KINDS.forEach(k => {
  NODES.push({ id: k + '.dmg', scope: k, label: 'Damage', desc: '+6% damage per rank', max: 3, costs: [2, 3, 4] });
  NODES.push({ id: k + '.rng', scope: k, label: 'Range', desc: '+4% range per rank', max: 3, costs: [2, 3, 4] });
  NODES.push({ id: k + '.rate', scope: k, label: 'Fire rate', desc: '+5% fire rate per rank', max: 3, costs: [2, 3, 4] });
  NODES.push({ id: k + '.sp', scope: k, label: SP_TXT[k][0], desc: SP_TXT[k][1], max: 1, costs: [8], special: 1 });
});
[['energy', 'Starting energy', '+15 energy at the start of every level', [2, 3, 4]], ['lives', 'Core lives', '+1 core life per rank', [4, 6, 8]], ['disc', 'Upgrade discount', '-4% tower upgrade cost per rank', [2, 3, 4]], ['cd', 'Ability recharge', 'Abilities recharge 8% faster per rank', [2, 3, 4]], ['sell', 'Salvage', '+5% sell value per rank', [2, 3, 4]], ['reloc', 'Quick relocation', '-25% tower relocation fee per rank', [2, 3, 4]]]
  .forEach(([id, label, desc, costs]) => NODES.push({ id: 'g.' + id, scope: 'g', label, desc, max: 3, costs }));
const rk = id => prog.res[id] || 0;
const resRanks = () => Object.values(prog.res).reduce((a, b) => a + b, 0);
const nodeById = id => NODES.find(n => n.id === id);
function buyNode(id) { const n = nodeById(id), r = rk(id); if (!n || r >= n.max || prog.rp < n.costs[r]) return false; prog.rp -= n.costs[r]; prog.res[id] = r + 1; save(); SFX.play('upgrade'); return true; }
function respec() { let back = 0; for (const id in prog.res) { const n = nodeById(id); if (n) for (let i = 0; i < prog.res[id]; i++) back += n.costs[i]; } prog.res = {}; prog.rp += back; save(); return back; }
const MASTERY_N = ['—', 'Bronze', 'Silver', 'Gold'];
function masteryOf(kind) { const k = (stats.mk && stats.mk[kind]) || 0, tier = k >= 2000 ? 3 : k >= 500 ? 2 : k >= 100 ? 1 : 0; return { kills: k, tier, name: MASTERY_N[tier], bonus: [0, .03, .06, .10][tier], next: [100, 500, 2000, 0][tier] }; }
const rankIdx = () => { const pts = totalCleared(); let r = 0; RANKS.forEach((x, i) => { if (pts >= x[0]) r = i; }); return r; };
const perkEnergy = () => rankIdx() >= 1 ? 20 : 0, perkLife = () => rankIdx() >= 2 ? 1 : 0, perkDmg = () => rankIdx() >= 3 ? .03 : 0, perkCd = () => rankIdx() >= 4 ? .1 : 0;
const cdMult = () => Math.max(.4, 1 - .08 * rk('g.cd') - perkCd());
const maxLives = () => START_LIVES + rk('g.lives') + perkLife();
const startBonus = () => 15 * rk('g.energy') + perkEnergy();
const MEDALS = [
  ['win', 'First Victory', 'Win any level.', () => stats.wins >= 1],
  ['perfect', 'Perfect Defense', 'Win a level without losing a life.', () => !!prog.flags.perfect],
  ['air', 'Air Ace', 'Shoot down 100 flyers.', () => (stats.air || 0) >= 100],
  ['merge', 'Merge Master', 'Merge 10 Prime towers.', () => stats.merges >= 10],
  ['boss', 'Boss Slayer', 'Defeat 3 bosses.', () => (stats.bossKills || 0) >= 3],
  ['kills', 'Exterminator', 'Defeat 500 enemies.', () => (stats.kills || 0) >= 500],
  ['hard', 'Hard Hitter', 'Win a level on Hard.', () => !!prog.flags.hard],
  ['night', 'Nightmare Survivor', 'Win a level on Nightmare.', () => !!prog.flags.night],
  ['noab', 'Purist', 'Win level 5 or later without using abilities.', () => !!prog.flags.noab],
  ['gold', 'Master of Arms', 'Reach Gold mastery with any tower.', () => KINDS.some(k => masteryOf(k).tier >= 3)],
  ['world', 'World Saver', 'Clear level 10 of any world.', () => WORLDS.some((w, i) => cleared(i, LPW - 1, 0))],
  ['res', 'Researcher', 'Own 25 research ranks.', () => resRanks() >= 25]
];
function checkMedals() {
  for (const m of MEDALS) if (!prog.medals[m[0]] && m[3]()) { prog.medals[m[0]] = Date.now(); prog.rp += 3; save(); SFX.play('clear'); try { flash('🏅 ' + m[1] + ' +3 RP'); } catch (e) {} }
}


/* ---------- Armory (cosmetics only, never power) ---------- */
const PALS = {
  default: { n: 'Standard', price: 0, c: {} },
  inferno: { n: 'Inferno', price: .99, c: { pulse: '#ff9a4a', rail: '#ffe0b0', missile: '#ff4a2a', flak: '#ffb060', cryo: '#ffd08a', tesla: '#ff7a3a', beam: '#ff5a2a', gravity: '#ff9a5a' } },
  frost: { n: 'Frost', price: .99, c: { pulse: '#cfeeff', rail: '#ffffff', missile: '#9fd8ff', flak: '#bfe6ff', cryo: '#ffffff', tesla: '#9fb8ff', beam: '#8fe0ff', gravity: '#b0c8ff' } },
  toxic: { n: 'Toxic', price: .99, c: { pulse: '#9aff6a', rail: '#e0ffc0', missile: '#c8ff3a', flak: '#7dff9a', cryo: '#a0ffd0', tesla: '#6aff9a', beam: '#b8ff3a', gravity: '#8aff9a' } },
  royal: { n: 'Royal', price: .99, c: { pulse: '#ffd24a', rail: '#fff0b0', missile: '#ffb040', flak: '#ffe070', cryo: '#e0c8ff', tesla: '#c08bff', beam: '#ff9af0', gravity: '#a08bff' } },
  medalist: { n: 'Medalist (earn 8 medals)', price: 0, need: 8, c: { pulse: '#ffffff', rail: '#ffd24a', missile: '#ffd24a', flak: '#ffffff', cryo: '#ffd24a', tesla: '#ffffff', beam: '#ffd24a', gravity: '#ffffff' } }
};
const LANES = { default: { n: 'World default', price: 0, hue: null }, crimson: { n: 'Crimson', price: .99, hue: 350 }, emerald: { n: 'Emerald', price: .99, hue: 140 }, amber: { n: 'Amber', price: .99, hue: 40 }, ultra: { n: 'Ultraviolet', price: .99, hue: 275 } };
if (!prog.skin) prog.skin = { pal: 'default', lane: 'default' };
if (!prog.daily) prog.daily = { last: '', streak: 0 };
{ const m = /[?&]rp=(\d+)/.exec(location.search); if (m) prog.rp = Math.max(prog.rp, +m[1]); }
const tcol = kind => { const p = PALS[prog.skin.pal]; return (p && p.c[kind]) || TOWERS[kind].col; };
const laneHue = base => { const l = LANES[prog.skin.lane]; return l && l.hue !== null ? l.hue : base; };

/* ---------- state ---------- */
const $ = id => document.getElementById(id);
let G, LV = 0, IDX = 0, TIER = 0, CUR, WAVES, PL;
function pathData(lv) {
  return lv.paths.map(p => { const seg = []; let len = 0; for (let i = 1; i < p.length; i++) { const a = p[i-1], b = p[i], l = Math.hypot(b[0]-a[0], b[1]-a[1]); seg.push({ a, b, l, s: len }); len += l; } return { pts: p, seg, len }; });
}
function posAt(pi, d) {
  const P = PL[pi]; if (d >= P.len) return P.pts[P.pts.length-1];
  for (const s of P.seg) if (d <= s.s + s.l) { const t = (d - s.s) / s.l; return [s.a[0] + (s.b[0]-s.a[0])*t, s.a[1] + (s.b[1]-s.a[1])*t]; }
  return P.pts[0];
}
const ePos = e => posAt(e.pi, e.d);
function startLevel(L, idx, tier, quiet, dly) {
  LV = L; IDX = idx || 0; TIER = tier || 0; CUR = buildLevel(LV, IDX, TIER); if (dly) applyTwist(CUR, dly.tw, dly.sd); SFX.theme(L); PL = pathData(CUR); WAVES = makeWaves(CUR);
  G = { lives: maxLives(), maxLives: maxLives(), abUsed: 0, gold: CUR.gold + startBonus(), wave: 0, running: false, spawnQ: [], t: 0, clock: 0, enemies: [], shots: [], waves: [], nums: [], decals: [], warn: 0, slowmo: 0, bossAt: null, waveTotal: 0, fx: [], parts: [], towers: [], sel: null, build: null, speed: G ? G.speed : 1, over: false, funAsked: false, strike: 0, freeze: 0, armed: false, nextPath: 0, freezeT: 0, autoT: 0, shake: 0, repairUsed: false, overT: 0, overCd: 0 };
  if (!quiet) stats.runs++; save(); hud(); closeSheet(); coach(); abilityUI(); hideAll(); $('intro').style.display = 'none';
}
function maxWave() { return CUR.waves; }
function enemyHp(type, w) { return ENEMY[type].hp * CUR.hp * (1 + (type === 'boss' ? .12 : .32) * (w - 1)) * (type === 'boss' ? (CUR.bossMult || .3) : 1); }
function flash(t) { const m = $('msg'); m.textContent = t; m.style.opacity = 1; clearTimeout(flash.t); flash.t = setTimeout(() => m.style.opacity = 0, 1300); }
function intro(type) {
  if (prog.seen.includes(type)) return; prog.seen.push(type); save();
  const d = ENEMY[type], el = $('intro');
  el.innerHTML = '<img src="art/e_' + type + '.webp?v=' + ART_V + '"><div><b>NINE: NEW · ' + d.name + '</b> · ' + (d.air ? '✈ Air' : '⛰ Ground') + '<br><span>' + d.note + '</span></div>';
  el.style.display = 'flex'; clearTimeout(intro.t); intro.t = setTimeout(() => el.style.display = 'none', 5500);
}

/* ---------- particles ---------- */
function part(x, y, vx, vy, life, size, col, add, grav) { if (G.parts.length > 420) return; G.parts.push({ x, y, vx, vy, life, max: life, size, col, add: !!add, grav: grav || 0 }); }
function burst(x, y, n, col, speed, life, size, add) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = speed * (.3 + Math.random()); part(x, y, Math.cos(a)*s, Math.sin(a)*s, life * (.6 + Math.random() * .6), size * (.6 + Math.random() * .8), col, add); } }

function sendWave() {
  if (G.running || G.over || G.wave >= maxWave()) return;
  G.wave++; G.running = true; G.spawnQ = []; G.moving = null; closeSheet();
  let t = 0;
  for (const [type, n, gap] of WAVES[G.wave-1]) { for (let i = 0; i < n; i++) { G.spawnQ.push({ at: t, type }); t += gap; } t += 1; }
  G.t = 0; G.waveTotal = G.spawnQ.length; SFX.play('wave'); stats.bestWave = Math.max(stats.bestWave, G.wave); save();
  flash(G.wave === maxWave() ? 'Final wave!' : 'Wave ' + G.wave); hud(); coach();
}
function spawn(type) {
  const hp = enemyHp(type, G.wave), pi = G.nextPath++ % PL.length;
  G.enemies.push({ type, hp, max: hp, d: 0, pi, slow: 0, bob: Math.random() * 6, flash: 0, ph: Math.random() * 6, age: 0, trail: 0 });
  SFX.play('spawn'); intro(type);
  if (type === 'boss') { G.warn = 2.8; G.slowmo = 1.6; G.bossAt = ePos(G.enemies[G.enemies.length - 1]); G.shake = Math.max(G.shake, .7); SFX.play('warn'); SFX.play('roar'); }
}
function tStats(t) {
  const r = tStats0(t), b = TOWERS[t.kind], k = t.kind; if (b.pull) r.pull = b.pull * (t.lvl <= 3 ? 1 + .45 * (t.lvl - 1) : 2.4);
  r.dmg *= 1 + .06 * rk(k + '.dmg') + masteryOf(k).bonus + perkDmg(); r.range = Math.round(r.range * (1 + .04 * rk(k + '.rng'))); r.rate *= 1 - .05 * rk(k + '.rate');
  if (k === 'missile' && rk('missile.sp')) r.splash = Math.round(r.splash * 1.25);
  if (k === 'tesla' && rk('tesla.sp')) { r.chain += 1; r.dmg *= 1.15; }
  if (k === 'gravity' && rk('gravity.sp') && r.pull) r.pull *= 1.3;
  return r;
}
function tStats0(t) {
  const b = TOWERS[t.kind], k = t.lvl;
  const dm = k <= 3 ? 1 + .65 * (k - 1) : 5.6, rng = k <= 3 ? (k - 1) * 8 : 24, rt = k <= 3 ? 1 - .1 * (k - 1) : .6;
  return { range: Math.round(b.range * (k <= 3 ? 1 + .15 * (k - 1) : 1.5)), dmg: b.dmg * dm, rate: b.rate * rt, slow: b.slow ? Math.min(.7, b.slow + (k <= 3 ? .09 * (k - 1) : .3)) : 0, splash: b.splash ? b.splash + (k <= 3 ? 6 * (k - 1) : 20) : 0, chain: b.chain ? b.chain + (k <= 3 ? k - 1 : 4) : 0 };
}
const upCost = t => Math.round(TOWERS[t.kind].cost * (t.lvl === 1 ? .75 : 1.1) * (1 - .04 * rk('g.disc')));
const sellVal = t => Math.round(t.spent * (.6 + .05 * rk('g.sell')));
const tName = t => (t.lvl === 4 ? 'Prime ' : '') + TOWERS[t.kind].name;
const PADS = () => CUR.pads;
const MOTES = Array.from({ length: 46 }, () => [Math.random() * 360, Math.random() * 600, 4 + Math.random() * 10, .6 + Math.random() * 1.4, Math.random() * 6]);
const NCOL = { energy: '#8ff0ff', kinetic: '#ffffff', explosive: '#ffb060', electric: '#e2c4ff', gold: '#ffd24a', cold: '#bfe6ff' };
function numPop(e, dmg, type) {
  if (dmg < 3 || G.nums.length > 34) return;
  const q = ePos(e), air = ENEMY[e.type].air;
  G.nums.push({ x: q[0] + (Math.random() - .5) * 10, y: q[1] - (air ? 24 : 12), t: 0, text: String(Math.round(dmg)), col: NCOL[type] || '#fff', big: dmg >= 40 });
}
const canHit = (kind, e) => TOWERS[kind].hits.includes(ENEMY[e.type].air ? 'air' : 'ground');
function buildTower(pad, kind) {
  const c = TOWERS[kind].cost; if (G.gold < c || G.towers.some(t => t.pad === pad)) return false;
  G.gold -= c; G.towers.push({ pad, kind, lvl: 1, cd: .2, spent: c, ang: -Math.PI/2, aim: -Math.PI/2, rec: 0, born: G.clock, acc: 0, ring: 0 });
  SFX.play('build'); const p = PADS()[pad]; G.fx.push({ k: 'build', p, t: 0 }); burst(p[0], p[1], 10, TOWERS[kind].col, 50, .5, 2, true);
  stats.builds[kind] = (stats.builds[kind] || 0) + 1; save(); hud(); return true;
}
function upgradeTower(t) {
  if (t.lvl >= 3) return false; const c = upCost(t); if (G.gold < c) return false;
  SFX.play('upgrade'); G.gold -= c; t.spent += c; t.lvl++; t.born = G.clock - .15; const p = PADS()[t.pad]; G.fx.push({ k: 'merge', p, t: 0, col: '#fff' }); burst(p[0], p[1], 12, '#ffffff', 60, .5, 2, true);
  stats.upgrades++; save(); hud(); return true;
}
function mergePartners(t) { return t.lvl === 3 ? G.towers.filter(o => o !== t && o.kind === t.kind && o.lvl === 3) : []; }
function mergeTowers(a, b) {
  SFX.play('merge'); G.towers.splice(G.towers.indexOf(b), 1); a.lvl = 4; a.spent += b.spent; a.born = G.clock - .1; stats.merges++; save();
  const p = PADS()[a.pad]; G.fx.push({ k: 'merge', p, t: 0, col: '#ffd24a' }); burst(p[0], p[1], 26, '#ffd24a', 90, .8, 2.6, true); hud();
}
const MOVE_PCT = [.15, .25, .40];
const moveFee = t => Math.max(5, Math.round(t.spent * MOVE_PCT[TIER] * Math.max(.25, 1 - .25 * rk('g.reloc'))));
function moveTower(t, pad) {
  const fee = moveFee(t); if (G.running || G.gold < fee || G.towers.some(o => o.pad === pad)) return false;
  const from = PADS()[t.pad], to = PADS()[pad];
  G.gold -= fee; stats.moves = (stats.moves || 0) + 1; stats.moveFees = (stats.moveFees || 0) + fee; save();
  t.pad = pad; t.born = G.clock - .1; t.cd = .5; SFX.play('build');
  G.fx.push({ k: 'build', p: from, t: 0 }); G.fx.push({ k: 'build', p: to, t: 0 }); burst(to[0], to[1], 12, tcol(t.kind), 60, .5, 2, true); hud(); return true;
}
function sellTower(t) { stats.sells = (stats.sells || 0) + 1; if (G.clock - t.born < 30) { stats.regretSells = (stats.regretSells || 0) + 1; G.regret = true; save(); } SFX.play('sell'); G.gold += sellVal(t); G.towers.splice(G.towers.indexOf(t), 1); hud(); }

/* damage with armor + weaknesses */
function dealDamage(e, base, type, ap, kind) {
  const d = ENEMY[e.type], m = (d.mods && d.mods[type]) || 1, raw = base * m * (e.slow > 0 && rk('cryo.sp') ? 1.1 : 1), arm = Math.max(0, (d.armor || 0) - (ap || 0));
  const dmg = Math.max(raw * .2, raw - arm); e.hp -= dmg; e.flash = .1; if (kind) { e.lk = kind; stats.dmgBy[kind] = (stats.dmgBy[kind] || 0) + dmg; } numPop(e, dmg, type); SFX.play('hit'); if (base >= 30 && e.type !== 'boss') e.d = Math.max(0, e.d - 2.5); return dmg;
}
function muzzle(t) {
  const p = PADS()[t.pad], hi = headInfo(t);
  if (hi) { const d = (1 - hi.cx) * hi.w; return [p[0] + Math.cos(t.aim) * d, p[1] - 3 + Math.sin(t.aim) * d]; }
  const sp = spr('t_' + t.kind + '_' + t.lvl), m = MUZ[t.kind];
  if (!sp) return [p[0], p[1]];
  const h = TH[t.lvl], w = sp.naturalWidth / sp.naturalHeight * h, sg = flipOf(t) ? -1 : 1;
  return [p[0] + sg * m[0] * w, p[1] - h * .32 + m[1] * h];
}
const TH = [0, 50, 56, 62, 68];
const flipOf = t => Math.cos(t.ang) < 0 && (t.kind === 'rail' || t.kind === 'missile');

function useStrike(x, y) {
  if (G.strike > 0) return;
  SFX.play('strike'); G.strike = 45 * cdMult(); stats.abilities++; G.abUsed = (G.abUsed || 0) + 1; save(); G.shake = .8;
  for (const e of G.enemies) { const q = ePos(e); if (Math.hypot(q[0]-x, q[1]-y) <= 55) { dealDamage(e, 160 + G.wave * 14, 'explosive', 99); } }
  G.fx.push({ k: 'strike', p: [x, y], t: 0 }); G.fx.push({ k: 'skybeam', p: [x, y], t: 0 }); burst(x, y, 40, '#ffd24a', 140, .9, 3, true);
}
function useRepair() { if (!prog.ab.repair || G.repairUsed || G.over || G.lives >= G.maxLives) return; G.abUsed++; SFX.play('repair'); G.repairUsed = true; G.lives = Math.min(G.maxLives, G.lives + 5); G.fx.push({ k: 'heal', t: 0 }); flash('Repaired +5 lives'); hud(); }
function useOver() { if (!prog.ab.over || G.overCd > 0 || G.over || !G.running) return; SFX.play('boost'); G.overT = 8; G.overCd = 50 * cdMult(); stats.abilities++; G.abUsed = (G.abUsed || 0) + 1; save(); flash('Overcharge!'); for (const t of G.towers) { const p0 = PADS()[t.pad]; G.fx.push({ k: 'merge', p: p0, t: 0, col: '#ffd24a' }); burst(p0[0], p0[1], 10, '#ffd24a', 70, .6, 2, true); } }
function useFreeze() { if (G.freeze > 0 || !G.running) return; SFX.play('freeze'); G.freeze = 40 * cdMult(); G.freezeT = 4; stats.abilities++; G.abUsed = (G.abUsed || 0) + 1; save(); G.fx.push({ k: 'freeze', t: 0 }); for (const e of G.enemies) { const q = ePos(e); G.fx.push({ k: 'ice', p: [q[0], q[1] - (ENEMY[e.type].air ? 14 : 0)], t: 0 }); } }

function killEnemy(e, i) {
  const def = ENEMY[e.type], q = ePos(e), air = def.air;
  G.gold += def.gold; G.enemies.splice(i, 1); hud();
  stats.kills++; stats.byType[e.type] = (stats.byType[e.type] || 0) + 1; if (def.air) stats.air++; if (e.type === 'boss') stats.bossKills++; if (e.lk) stats.mk[e.lk] = (stats.mk[e.lk] || 0) + 1;
  if (stats.kills % 25 === 0 || e.type === 'boss') checkMedals();
  const big = e.type === 'boss' ? 4 : e.type === 'brute' || e.type === 'bomber' ? 2 : 1;
  SFX.play(big >= 2 ? 'bigdie' : 'die'); G.decals.push({ x: q[0], y: q[1], r: 8 + big * 6, t: 0 }); G.nums.push({ x: q[0], y: q[1] - (air ? 26 : 16), t: 0, text: '+' + def.gold, col: NCOL.gold, big: false });
  G.fx.push({ k: 'light', p: [q[0], q[1]], col: def.col, r: 40 + big * 22, t: 0 });
  G.fx.push({ k: 'corpse', type: e.type, p: [q[0], q[1] - (air ? 14 : 0)], flip: posAt(e.pi, e.d + 3)[0] < q[0], t: 0 });
  burst(q[0], q[1], 8 * big, def.col, 70 * Math.sqrt(big), .6, 2.2, true);
  burst(q[0], q[1], 5 * big, '#555a66', 40, .9, 3, false);
  if (big >= 2) { G.fx.push({ k: 'puff', p: q, t: 0, col: def.col }); G.shake = Math.max(G.shake, e.type === 'boss' ? 1 : .25); }
}

function step(dt) {
  if (G.over) return;
  G.overT = Math.max(0, G.overT - dt); G.overCd = Math.max(0, G.overCd - dt);
  G.t += dt; G.clock += dt; G.strike = Math.max(0, G.strike - dt); G.freeze = Math.max(0, G.freeze - dt); G.freezeT = Math.max(0, G.freezeT - dt); G.shake = Math.max(0, G.shake - dt * 2);
  while (G.spawnQ.length && G.spawnQ[0].at <= G.t) spawn(G.spawnQ.shift().type);
  if (autoWave && !G.running && G.wave > 0 && G.wave < maxWave() && G.autoT > 0) { G.autoT -= dt; if (G.autoT <= 0) sendWave(); hud(); }
  for (const e of G.enemies) { e.slow = G.freezeT > 0 ? .6 : 0; if (e.hs > 0) { e.hs -= dt; e.slow = Math.max(e.slow, .2); } }
  for (const t of G.towers) if (t.kind === 'cryo') {
    const s = tStats(t), p = PADS()[t.pad]; let any = false;
    for (const e of G.enemies) { const q = ePos(e); if (Math.hypot(q[0]-p[0], q[1]-p[1]) <= s.range) { e.slow = Math.max(e.slow, s.slow); any = true; } }
    t.ring -= dt; if (any && t.ring <= 0) { t.ring = 1.3; G.fx.push({ k: 'ring', p, r: s.range, t: 0 }); SFX.play('cryo'); }
    t.acc -= dt; if (t.acc <= 0) { t.acc = any ? .07 : .22; const a = Math.random() * 6.283; part(p[0] + Math.cos(a) * 8, p[1] - 22, Math.cos(a) * 8, -14 - Math.random() * 10, .9, 1.6, '#cfeeff', true); }
  }
  for (const t of G.towers) if (t.kind === 'gravity') {
    const s = tStats(t), p = PADS()[t.pad]; let any = false;
    for (const e of G.enemies) { const q = ePos(e); if (Math.hypot(q[0] - p[0], q[1] - p[1]) <= s.range) { const rs = Math.max(.12, 1 - (e.pulled || 0) / 7); e.pulled = (e.pulled || 0) + dt; e.d = Math.max(0, e.d - s.pull * rs * (e.type === 'boss' ? .3 : 1) * dt); e.slow = Math.max(e.slow, .18); any = true; } }
    t.ring -= dt; if (any && t.ring <= 0) { t.ring = 1.0; G.fx.push({ k: 'vortex', p, r: s.range, t: 0 }); SFX.play('gravity'); }
    t.acc -= dt; if (t.acc <= 0) { t.acc = any ? .05 : .2; const a = Math.random() * 6.283, rr = s.range * (.7 + Math.random() * .3); part(p[0] + Math.cos(a) * rr, p[1] + Math.sin(a) * rr, -Math.cos(a) * rr * 1.1 - Math.sin(a) * 18, -Math.sin(a) * rr * 1.1 + Math.cos(a) * 18, .8, 1.6, '#9aa8ff', true); }
  }
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i], def = ENEMY[e.type];
    e.flash = Math.max(0, e.flash - dt); e.d += def.sp * (1 - e.slow) * CUR.spMult * dt;
    if (e.slow > 0 && Math.random() < .15) { const q = ePos(e); part(q[0] + (Math.random()-.5) * 10, q[1] - 6, 0, -10, .5, 1.4, '#bfe6ff', true); }
    if (e.hp <= 0) { killEnemy(e, i); continue; }
    if (e.d >= PL[e.pi].len) {
      G.lives = Math.max(0, G.lives - def.leak); G.enemies.splice(i, 1); G.fx.push({ k: 'hit', t: 0 }); G.fx.push({ k: 'coreHit', t: 0 }); G.shake = .5; SFX.play('leak'); hud();
      if (G.lives <= 0) { endGame(false); return; }
    }
  }
  for (const t of G.towers) {
    t.rec = Math.max(0, t.rec - dt * 5);
    const s = tStats(t), p = PADS()[t.pad];
    if (t.kind === 'cryo' || t.kind === 'gravity') continue;
    let best = null, bd = -1;
    for (const e of G.enemies) { if (!canHit(t.kind, e)) continue; const q = ePos(e); if (Math.hypot(q[0]-p[0], q[1]-p[1]) <= s.range && e.d > bd) { best = e; bd = e.d; } }
    if (best) { const q = ePos(best); t.ang = Math.atan2(q[1] - (ENEMY[best.type].air ? 14 : 0) - p[1], q[0] - p[0]); t.has = true; } else t.has = false;
    let ready = true;
    if (ROT[t.kind]) {
      if (best) { const df = angDiff(t.ang, t.aim), mx = TURN[t.kind] * dt * (G.overT > 0 ? 1.3 : 1); t.aim += Math.max(-mx, Math.min(mx, df)); ready = Math.abs(angDiff(t.ang, t.aim)) < .2; }
      else t.aim += Math.sin(G.clock * .7 + t.pad) * .35 * dt;
    } else t.aim = t.ang;
    if (t.kind === 'beam') {
      if (best && ready) {
        if (t.tgt === best) t.chan = (t.chan || 0) + dt; else { t.tgt = best; t.chan = 0; }
        const ramp = 1 + Math.min(1, t.chan / (rk('beam.sp') ? 1.6 : 2.5)); t.ramp = ramp; t.beamOn = best;
        t.dacc = (t.dacc || 0) + s.dmg * ramp * (G.overT > 0 ? 1.5 : 1) * dt; t.dt2 = (t.dt2 || 0) + dt;
        if (t.dt2 >= .25) { dealDamage(best, t.dacc, 'energy', 3, 'beam'); t.dacc = 0; t.dt2 = 0; }
        t.acc -= dt; if (t.acc <= 0) { t.acc = .35; SFX.play('beam'); }
        t.rec = .5;
      } else { t.beamOn = null; t.chan = 0; t.tgt = null; }
      continue;
    }
    t.cd -= dt * (G.overT > 0 ? 1.5 : 1); if (t.cd > 0) continue;
    if (!best || !ready) { t.cd = 0; if (t.kind === 'tesla') { t.acc -= dt; } continue; }
    t.cd = s.rate; t.rec = 1; fire(t, p, best, s);
  }
  for (const t of G.towers) if (t.kind === 'tesla' && Math.random() < dt * 5) { const p = PADS()[t.pad]; part(p[0] + (Math.random()-.5) * 14, p[1] - 28 + Math.random() * 8, (Math.random()-.5) * 30, (Math.random()-.5) * 30, .25, 1.3, '#e6c8ff', true); }
  for (let i = G.waves.length - 1; i >= 0; i--) {
    const w = G.waves[i]; w.r += 300 * dt;
    for (const e of G.enemies) { if (w.hit.includes(e)) continue; const q = ePos(e), qy = q[1] - (ENEMY[e.type].air ? 14 : 0); if (Math.hypot(q[0] - w.x, qy - w.y) <= w.r) { w.hit.push(e); dealDamage(e, w.dmg, 'energy', 0, 'pulse'); if (rk('pulse.sp')) e.hs = 1; burst(q[0], qy, 3, '#bff4ff', 40, .25, 1.4, true); } }
    if (w.r >= w.max) G.waves.splice(i, 1);
  }
  for (let i = G.shots.length - 1; i >= 0; i--) {
    const s = G.shots[i], tg = s.tgt;
    if (tg.hp <= 0 || G.enemies.indexOf(tg) < 0) { if (s.kind === 'missile' || s.kind === 'flak') { hitShot(s, null, [s.x, s.y]); } G.shots.splice(i, 1); continue; }
    const q = ePos(tg), ty = q[1] - (ENEMY[tg.type].air ? 14 : 0), dx = q[0]-s.x, dy = ty-s.y, dist = Math.hypot(dx, dy);
    s.sp = Math.min(s.max, s.sp + s.acc * dt); const mv = s.sp * dt;
    s.trail.push([s.x, s.y]); if (s.trail.length > 6) s.trail.shift();
    if (s.kind === 'missile') part(s.x, s.y, (Math.random()-.5) * 12, (Math.random()-.5) * 12, .5, 2.2, 'rgba(210,210,220,.55)', false);
    if (dist <= mv + 4) { hitShot(s, tg, [q[0], ty]); G.shots.splice(i, 1); } else { s.x += dx/dist*mv; s.y += dy/dist*mv; s.ang = Math.atan2(dy, dx); }
  }
  for (let i = G.fx.length - 1; i >= 0; i--) { G.fx[i].t += dt; if (G.fx[i].t > .7) G.fx.splice(i, 1); }
  for (let i = G.nums.length - 1; i >= 0; i--) { const n = G.nums[i]; n.t += dt; n.y -= 26 * dt; if (n.t > .75) G.nums.splice(i, 1); }
  for (let i = G.decals.length - 1; i >= 0; i--) { G.decals[i].t += dt; if (G.decals[i].t > 7) G.decals.splice(i, 1); }
  G.warn = Math.max(0, G.warn - dt);
  for (const e of G.enemies) {
    e.age += dt; const def = ENEMY[e.type];
    if (def.air) { e.trail -= dt; if (e.trail <= 0) { e.trail = e.type === 'boss' ? .03 : .05; const q = ePos(e), n2 = posAt(e.pi, e.d + 3), dx = n2[0] - q[0], dy = n2[1] - q[1], l = Math.hypot(dx, dy) || 1; part(q[0] - dx / l * 9, q[1] - 14 - dy / l * 9, -dx / l * 14, -dy / l * 14, .35, e.type === 'boss' ? 3 : 1.6, def.col, true); } }
  }
  for (let i = G.parts.length - 1; i >= 0; i--) { const q = G.parts[i]; q.life -= dt; if (q.life <= 0) { G.parts.splice(i, 1); continue; } q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.grav * dt; q.vx *= .98; }
  if (G.running && !G.spawnQ.length && !G.enemies.length) {
    G.running = false; stats.wavesCleared++; save();
    if (G.wave >= maxWave()) { endGame(true); return; }
    SFX.play('clear'); G.autoT = 4; const bonus = 25 + G.wave * 7; G.gold += bonus; flash('Wave clear +' + bonus + '⚡'); hud(); coach();
    if (!G.funAsked && G.wave === 3) { G.funAsked = true; setTimeout(() => { if (!G.over) show('ovFun'); }, 900); }
  }
}
function fire(t, p, best, s) {
  const m = muzzle(t), b = TOWERS[t.kind], q = ePos(best), air = ENEMY[best.type].air, ty = q[1] - (air ? 14 : 0);
  burst(m[0], m[1], 4, tcol(t.kind), 55, .25, 1.8, true); SFX.play(t.kind === 'tesla' ? 'arc' : t.kind);
  G.fx.push({ k: 'light', p: [m[0], m[1]], col: tcol(t.kind), r: t.kind === 'rail' ? 46 : 30, t: 0 });
  if (t.kind === 'pulse') { G.waves.push({ x: PADS()[t.pad][0], y: PADS()[t.pad][1] - 4, r: 8, max: s.range, dmg: s.dmg, hit: [] }); burst(m[0], m[1], 6, '#aef2ff', 40, .3, 1.6, true); return; }
  if (t.kind === 'tesla') { chain(t, m, best, s); return; }
  if (t.kind === 'rail') { // instant beam
    const crit = rk('rail.sp') && Math.random() < .2; dealDamage(best, s.dmg * (crit ? 2 : 1), b.type, b.ap, 'rail'); G.fx.push({ k: 'beam', a: m, b: [q[0], ty], t: 0 }); burst(q[0], ty, 8, '#cfe6ff', 70, .3, 1.8, true); G.shake = Math.max(G.shake, .08); return;
  }
  const sp0 = t.kind === 'missile' ? 90 : t.kind === 'flak' ? 300 : 340, mx = t.kind === 'missile' ? 300 : t.kind === 'flak' ? 380 : 340;
  G.shots.push({ x: m[0], y: m[1], tgt: best, kind: t.kind, dmg: s.dmg, splash: s.splash, type: b.type, ap: b.ap, sp: sp0, max: mx, acc: t.kind === 'missile' ? 380 : 0, trail: [], ang: t.ang });
}
function chain(t, m, first, s) {
  const hitSet = [first], tv = e => { const q = ePos(e); return [q[0], q[1] - (ENEMY[e.type].air ? 14 : 0)]; };
  let cur = tv(first), pts = [[m[0], m[1]], cur];
  for (let n = 1; n < s.chain; n++) {
    let nx = null, nd = 52;
    for (const e of G.enemies) { if (hitSet.includes(e) || !canHit('tesla', e)) continue; const q = tv(e), d = Math.hypot(q[0]-cur[0], q[1]-cur[1]); if (d < nd) { nd = d; nx = e; } }
    if (!nx) break; hitSet.push(nx); cur = tv(nx); pts.push(cur);
  }
  hitSet.forEach(e => { dealDamage(e, s.dmg, 'electric', 0, 'tesla'); const q = tv(e); burst(q[0], q[1], 4, '#d9b6ff', 50, .25, 1.6, true); });
  G.fx.push({ k: 'bolt', pts, t: 0 });
}
function hitShot(s, tg, q) {
  if (s.splash) {
    const wantAir = s.kind === 'flak';
    const passes = (s.kind === 'flak' && rk('flak.sp') && Math.random() < .25) ? 2 : 1;
    for (let ps = 0; ps < passes; ps++) for (const e of G.enemies) { if (ENEMY[e.type].air !== wantAir) continue; const r = ePos(e), ry = r[1] - (wantAir ? 14 : 0); if (Math.hypot(r[0]-q[0], ry-q[1]) <= s.splash) dealDamage(e, s.dmg, s.type, s.ap, s.kind); }
    G.fx.push({ k: s.kind === 'flak' ? 'flakburst' : 'boom', p: q, t: 0, r: s.splash }); SFX.play(s.kind === 'flak' ? 'flakburst' : 'boom'); G.fx.push({ k: 'light', p: q, col: s.kind === 'flak' ? '#ffe9a0' : '#ff9a4a', r: s.splash * 2.2, t: 0 });
    if (s.kind !== 'flak') G.decals.push({ x: q[0], y: q[1], r: s.splash * .8, t: 0 });
    if (s.kind === 'flak') { burst(q[0], q[1], 10, '#ffcf6b', 70, .4, 1.8, true); burst(q[0], q[1], 5, '#444', 30, .7, 3, false); }
    else { burst(q[0], q[1], 16, '#ff9a4a', 90, .5, 2.2, true); burst(q[0], q[1], 8, '#3a3a40', 40, .9, 3.2, false); G.shake = Math.max(G.shake, .12); }
  } else if (tg) { dealDamage(tg, s.dmg, s.type, s.ap, s.kind); burst(q[0], q[1], 4, tcol(s.kind), 45, .25, 1.6, true); }
}
function endGame(win) {
  G.over = true; G.running = false; SFX.play(win ? 'win' : 'lose'); if (win) stats.wins++; else stats.losses++; if (G.regret && !win) stats.regretLosses = (stats.regretLosses || 0) + 1;
  const lost = G.maxLives - G.lives, stars = win ? (lost <= 2 ? 3 : lost <= 8 ? 2 : 1) : 0;
  let rpGain = 0;
  let dailyMsg = '';
  if (win && CUR.daily) { if (prog.daily.last !== dayStr()) { const y = new Date(); y.setDate(y.getDate() - 1); const ys = String(y.getFullYear() * 10000 + (y.getMonth() + 1) * 100 + y.getDate()); prog.daily.streak = prog.daily.last === ys ? (prog.daily.streak || 0) + 1 : 1; prog.daily.last = dayStr(); const r = 5 + Math.min(5, prog.daily.streak - 1); prog.rp += r; dailyMsg = '<br><b>Daily reward:</b> +' + r + ' RP · streak ' + prog.daily.streak; checkMedals(); } else dailyMsg = '<br>Daily reward already claimed today.'; }
  if (win && !CUR.daily) { const k = scKey(LV, IDX, TIER), prev = prog.sc[k] || 0; prog.sc[k] = Math.max(prev, stars); rpGain = Math.max(0, stars - prev) * (TIER + 1) + (stars <= prev ? TIER + 1 : 0); prog.rp += rpGain;
    if (G.lives >= G.maxLives) prog.flags.perfect = 1; if (TIER === 1) prog.flags.hard = 1; if (TIER === 2) prog.flags.night = 1; if (IDX >= 4 && !G.abUsed) prog.flags.noab = 1; checkMedals(); }
  save();
  $('eTitle').textContent = win ? 'Sector secured!' : 'Station lost';
  $('eStars').textContent = win ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : '';
  $('eText').textContent = 'Level ' + (IDX + 1) + ' · ' + TIERS[TIER].n + ' — ' + (win ? 'You held all ' + maxWave() + ' waves with ' + G.lives + ' lives left.' : 'You reached wave ' + G.wave + ' of ' + maxWave() + '. Check each enemy\'s weakness and try a different mix.');
  const wd = WORLDS[LV], fin = IDX === LPW - 1 && TIER === 0 && !CUR.daily, spkId = wd.win[0], q = win ? (fin ? wd.win : [spkId, QUIPS[spkId][(IDX + TIER) % QUIPS[spkId].length]]) : wd.lose, spk = SPEAK[q[0]];
  const nextOpen = win && IDX < LPW - 1 && !CUR.daily;
  $('eNext').style.display = nextOpen ? 'block' : 'none';
  let extra = (rpGain ? '<br><b>Research:</b> +' + rpGain + ' RP' : '') + dailyMsg;
  if (win && fin && wd.reward && !prog.ab[wd.reward]) { prog.ab[wd.reward] = true; extra = '<br><b>New ability:</b> ' + REWARDS[wd.reward]; save(); }
  if (win && fin && wd.tower && !prog.tw[wd.tower]) { prog.tw[wd.tower] = true; extra += '<br><b>New tower:</b> ' + TWTXT[wd.tower]; save(); }
  $('eQuote').innerHTML = '<b>' + spk.name + ':</b> ' + q[1].replace('{c}', (prog.call || 'Cadet').replace(/</g, '&lt;')) + extra + (win ? '<br><b>Rank:</b> ' + rankOf() : '');
  setTimeout(() => show('ovEnd'), 700);
}

/* ---------- drawing ---------- */
const ART_V = '1792566315';
const IM = {};
['bg_1','bg_2','bg_3','lane_1','lane_2','lane_3','p_pad','p_core'].concat(Object.keys(ENEMY).map(t => 'e_' + t), KINDS.filter(k => k !== 'beam').flatMap(k => [1,2,3,4].map(n => 't_' + k + '_' + n)), ['pulse','rail','missile','flak','beam'].flatMap(k => [1,2,3,4].map(n => 'h_' + k + '_' + n))).forEach(n => { const i = new Image(); i.src = 'art/' + n + '.webp?v=' + ART_V; IM[n] = i; });
const spr = n => { const i = IM[n]; return i && i.complete && i.naturalWidth ? i : null; };
const ROT = { rail: 1, missile: 1, flak: 1, beam: 1 }, TURN = { rail: 5, missile: 5.5, flak: 8, beam: 6 }, HL = [0, 44, 48, 53, 58];
let HM = {}; fetch('art/heads.json?v=' + ART_V).then(r => r.json()).then(j => { HM = j; }).catch(() => {});
function headInfo(t) {
  const n = 'h_' + t.kind + '_' + t.lvl, im = spr(n), m = HM[n];
  if (!ROT[t.kind] || !im || !m) return null;
  const w = HL[t.lvl] * (t.kind === 'rail' ? 1.15 : 1), h = w * im.naturalHeight / im.naturalWidth;
  return { im, w, h, cx: m.cx, cy: m.cy };
}
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 6.283185; while (d < -Math.PI) d += 6.283185; return d; };
const cv = $('cv'), ctx = cv.getContext('2d');
let SC = 1, OX = 0, OY = 0;
const STARS = Array.from({ length: 90 }, () => [Math.random() * W, Math.random() * H, Math.random() * 1.4 + .3, Math.random() * 6]);
function resize() {
  const r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  SC = Math.min(cv.width / W, cv.height / H); OX = (cv.width - W*SC) / 2; OY = (cv.height - H*SC) / 2;
}
window.addEventListener('resize', resize);
const trace = pts => { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); };
function glow(x, y, r, col, a) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalAlpha = a; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
const ease = x => { x = Math.min(1, Math.max(0, x)); const c = 1.7; return Math.max(.001, 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2)); };

/* Puppet animation: the picture is split into parts so legs step, arms swing and wings flap (the AI cannot redraw clean walking poses). */
const FLY = { scout: 1 };
function puppet(sp, w, h, type, ph, time, e) {
  const sw = sp.naturalWidth, sh = sp.naturalHeight;
  if (FLY[type]) {
    const fl = Math.sin(time / 38 + e.ph * 3), lift = Math.sin(time / 38 + e.ph * 3 + 1.2) * 1.2;
    ctx.drawImage(sp, 0, sh * .5, sw, sh * .5, -w/2, 0, w, h * .5);
    ctx.save(); ctx.translate(0, lift); ctx.scale(1, 1 + .16 * fl); ctx.drawImage(sp, 0, 0, sw, sh * .5, -w/2, -h/2, w, h * .5); ctx.restore();
    return;
  }
  if (type === 'bomber' || type === 'boss') { ctx.drawImage(sp, -w/2, -h/2, w, h); return; }
  const seam = .6, ov = .05, lift = h * .075, sg = w * .028;
  const sL = Math.sin(ph), sR = Math.sin(ph + Math.PI), lL = Math.max(0, sL) * lift, lR = Math.max(0, sR) * lift;
  const ly = sh * (seam - ov), lh = sh * (1 - seam + ov), dy = -h / 2 + h * (seam - ov), dh = h * (1 - seam + ov), mw = .04;
  ctx.drawImage(sp, 0, ly, sw * (.5 + mw), lh, -w/2 + sL * sg, dy - lL, w * (.5 + mw), dh);
  ctx.drawImage(sp, sw * (.5 - mw), ly, sw * (.5 + mw), lh, -w * mw + sR * sg, dy - lR, w * (.5 + mw), dh);
  const arm = (type === 'brute' || type === 'shield') ? Math.sin(ph) * .07 : 0, uh = sh * (seam + ov), dh2 = h * (seam + ov);
  if (arm) {
    const e1 = .34, e2 = .66, ov2 = .03;
    ctx.save(); ctx.translate(-w * (.5 - e1 / 2), -h / 2 + h * .18); ctx.rotate(arm); ctx.drawImage(sp, 0, 0, sw * (e1 + ov2), uh, -w * e1 / 2, -h * .18, w * (e1 + ov2), dh2); ctx.restore();
    ctx.save(); ctx.translate(w * (.5 - (1 - e2) / 2), -h / 2 + h * .18); ctx.rotate(-arm); ctx.drawImage(sp, sw * (e2 - ov2), 0, sw * (1 - e2 + ov2), uh, -w * (1 - e2) / 2 - w * ov2, -h * .18, w * (1 - e2 + ov2), dh2); ctx.restore();
    ctx.drawImage(sp, sw * (e1 - ov2), 0, sw * (e2 - e1 + 2 * ov2), uh, -w / 2 + w * (e1 - ov2), -h / 2, w * (e2 - e1 + 2 * ov2), dh2);
  } else ctx.drawImage(sp, 0, 0, sw, uh, -w/2, -h/2, w, dh2);
}
function drawEnemy(e, time) {
  const q = ePos(e), def = ENEMY[e.type], r = EH[e.type] / 2, air = def.air, col = def.col;
  const nxt = posAt(e.pi, e.d + 3), ang = Math.atan2(nxt[1] - q[1], nxt[0] - q[0]), flip = nxt[0] < q[0];
  const sp = spr('e_' + e.type);
  const spd = def.sp * (1 - e.slow), cyc = time / (1000 / (1 + spd / 14)) * 6.283 + e.ph;
  if (!sp) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(q[0], q[1], r * .6, 0, 7); ctx.fill(); return; }
  const h = EH[e.type], w = sp.naturalWidth / sp.naturalHeight * h;
  ctx.save();
  // ground shadow (smaller and lower for flyers)
  ctx.fillStyle = air ? 'rgba(0,0,0,.28)' : 'rgba(0,0,0,.38)'; ctx.beginPath(); ctx.ellipse(q[0], q[1] + (air ? 12 : h*.28), w*(air ? .3 : .4), h*.12, 0, 0, 7); ctx.fill();
  let hop = 0, sway = 0, sq = 1;
  if (air) { hop = -14 + Math.sin(time/260 + e.ph) * 3; sway = Math.sin(time/380 + e.ph) * .08 + (flip ? -.05 : .05); }
  else if (e.type === 'swarm' || e.type === 'scout') { hop = -Math.abs(Math.sin(cyc * 2)) * 2.5; sway = Math.sin(cyc * 2) * .12; }
  else if (e.type === 'stalker') { hop = -Math.abs(Math.sin(cyc * 2)) * 2; sway = Math.sin(cyc * 2) * .08; sq = 1 + Math.sin(cyc * 2) * .04; }
  else { hop = -Math.abs(Math.sin(cyc)) * (e.type === 'brute' ? 2.5 : 3); sway = Math.sin(cyc) * (e.type === 'brute' ? .035 : .06); sq = 1 + Math.sin(cyc * 2) * .03; }
  ctx.translate(q[0], q[1] - h * .1 + hop); ctx.rotate(sway); if (flip) ctx.scale(-1, 1); ctx.scale(1 / sq, sq);
  const wp = Math.min(1, (e.age === undefined ? 1 : e.age) / .45); if (wp < 1) { const k2 = wp * (2 - wp); ctx.scale(Math.max(.05, k2), Math.max(.05, k2)); ctx.globalAlpha = .4 + .6 * wp; }
  if (air) { // engine glow trailing behind
    glow(-w * .35, h * .05, h * (e.type === 'boss' ? .5 : .35), col, .45 + .2 * Math.sin(time / 90 + e.ph));
  }
  ctx.shadowColor = col; ctx.shadowBlur = e.type === 'boss' ? 22 : 8; puppet(sp, w, h, e.type, cyc, time, e); ctx.shadowBlur = 0;
  if (e.type === 'shield') { ctx.globalAlpha = .25 + .15 * Math.sin(time / 200); ctx.strokeStyle = '#8fd0ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, h * .62, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
  if (e.slow > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .28; ctx.shadowColor = '#7fd8ff'; ctx.shadowBlur = 14; puppet(sp, w, h, e.type, cyc, time, e); ctx.shadowBlur = 0; ctx.globalAlpha = 1; }
  if (e.flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .65; puppet(sp, w, h, e.type, cyc, time, e); }
  ctx.restore();
  const by = q[1] + hop - h/2 - 8;
  if (e.hp < e.max) { const bw = Math.max(18, w*.8); ctx.fillStyle = '#000b'; ctx.fillRect(q[0]-bw/2, by, bw, 3.5); ctx.fillStyle = e.hp/e.max > .5 ? '#5be07a' : e.hp/e.max > .25 ? '#ffd24a' : '#ff5470'; ctx.fillRect(q[0]-bw/2, by, bw*Math.max(0, e.hp/e.max), 3.5); }
  if (air) { ctx.fillStyle = '#cfe6ff'; ctx.font = 'bold 8px system-ui'; ctx.textAlign = 'center'; ctx.fillText('✈', q[0], by - 2); }
}
function drawVortex(t, time) {
  const p = PADS()[t.pad], s = tStats(t); ctx.save(); ctx.translate(p[0], p[1]); ctx.globalCompositeOperation = 'lighter';
  glow(0, 0, s.range, '#4a5bd8', .22);
  for (let i = 0; i < 3; i++) { const k = ((time / 1400 + i / 3) % 1), r = s.range * (1 - k); ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.2); ctx.strokeStyle = 'rgba(150,165,255,' + (.5 * k) + ')'; ctx.lineWidth = 1.6; ctx.stroke(); }
  ctx.rotate(time / 600); for (let i = 0; i < 4; i++) { ctx.rotate(1.571); ctx.beginPath(); ctx.arc(0, 0, s.range * .6, 0, .9); ctx.strokeStyle = 'rgba(180,190,255,.35)'; ctx.lineWidth = 2; ctx.stroke(); }
  ctx.restore();
}
function drawTower(t, time) {
  if (t.kind === 'gravity') drawVortex(t, time);
  if (G.overT > 0) { const p0 = PADS()[t.pad]; ctx.globalCompositeOperation = 'lighter'; glow(p0[0], p0[1], 30, '#ffd24a', .35 + .2 * Math.sin(time / 90)); ctx.globalCompositeOperation = 'source-over'; }
  const p = PADS()[t.pad], b = TOWERS[t.kind], k = t.lvl, c = tcol(t.kind), sp = spr('t_' + t.kind + '_' + k), hi = headInfo(t);
  if (hi) {
    const age = G.clock - t.born, bs = age < .5 ? ease(age / .5) : 1, r = t.rec, ps = spr('p_pad'), ca = Math.cos(t.aim), sa = Math.sin(t.aim);
    ctx.save();
    ctx.translate(p[0], p[1]);
    glow(0, 0, 28, c, k === 4 ? .35 : .18);
    if (ps) { const pw = 46 * bs, ph = ps.naturalHeight / ps.naturalWidth * pw; ctx.drawImage(ps, -pw/2, -ph/2, pw, ph); }
    ctx.translate(-ca * 4 * r, -3 - sa * 4 * r);
    ctx.rotate(t.aim); ctx.scale(bs * (1 - .04 * r), bs * (1 + .03 * r));
    ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 5; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 4;
    ctx.drawImage(hi.im, -hi.cx * hi.w, -hi.cy * hi.h, hi.w, hi.h);
    ctx.shadowColor = k === 4 ? '#ffd24a' : c; ctx.shadowBlur = (k === 4 ? 12 : 4) + 8 * r; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    ctx.globalAlpha = .35 + .2 * Math.sin(time / 200 + t.pad) + r * .4; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(hi.im, -hi.cx * hi.w, -hi.cy * hi.h, hi.w, hi.h);
    ctx.restore();
    const m = muzzle(t);
    if (r > .3) { ctx.globalCompositeOperation = 'lighter'; glow(m[0], m[1], 9 + 12 * r, c, Math.min(1, r * 1.1)); ctx.globalCompositeOperation = 'source-over'; }
    for (let i = 0; i < Math.min(k, 3); i++) { ctx.beginPath(); ctx.arc(p[0] - (Math.min(k,3)-1)*4 + i*8, p[1] + 25, 2.4, 0, 7); ctx.fillStyle = k === 4 ? '#ffd24a' : '#fff'; ctx.fill(); }
    if (k === 4) { ctx.font = 'bold 9px system-ui'; ctx.fillStyle = '#ffd24a'; ctx.textAlign = 'center'; ctx.fillText('PRIME', p[0], p[1] + 35); }
    return;
  }
  if (!sp) { ctx.beginPath(); ctx.arc(p[0], p[1], 18, 0, 7); ctx.fillStyle = c; ctx.fill(); return; }
  const h = TH[k], w = sp.naturalWidth / sp.naturalHeight * h, flip = flipOf(t), r = t.rec, dx = Math.cos(t.ang), dy = Math.sin(t.ang);
  const age = G.clock - t.born, bs = age < .5 ? ease(age / .5) : 1, idle = Math.sin(time / 500 + t.pad);
  ctx.save(); ctx.translate(p[0], p[1]);
  ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(0, 12, w*.42*bs, 8, 0, 0, 7); ctx.fill();
  const lean = t.kind === 'pulse' ? Math.sin(time / 700 + t.pad) * .01 : (t.has ? Math.max(-1, Math.min(1, dy)) * .1 * (flip ? -1 : 1) : Math.sin(time / 900 + t.pad) * .02) + (t.kind === 'flak' && t.has ? dx * .12 : 0);
  ctx.translate(-dx * 4.5 * r * (t.kind === 'cryo' || t.kind === 'tesla' || t.kind === 'pulse' || t.kind === 'gravity' ? 0 : 1), -h*.32 + idle * .8 - (1 - bs) * 26 * (age < .5 ? 1 : 0));
  ctx.rotate(lean); if (flip) ctx.scale(-1, 1); const sq = 1 + .05 * r; ctx.scale(bs * sq, bs / sq);
  ctx.shadowColor = k === 4 ? '#ffd24a' : c; ctx.shadowBlur = (k === 4 ? 16 : 6) + 4 * Math.sin(time / 180 + t.pad) + 10 * r;
  ctx.drawImage(sp, -w/2, -h/2, w, h); ctx.shadowBlur = 0;
  if (r > .3) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = r * .35; ctx.drawImage(sp, -w/2, -h/2, w, h); }
  ctx.restore();
  // muzzle flash / charge glow
  const m = muzzle(t);
  if (r > .35) { ctx.globalCompositeOperation = 'lighter'; glow(m[0], m[1], 10 + 12 * r, c, Math.min(1, r * 1.1)); ctx.globalCompositeOperation = 'source-over'; }
  else if (t.kind === 'rail' && t.has) { ctx.globalCompositeOperation = 'lighter'; glow(m[0], m[1], 6 + 6 * (1 - Math.max(0, t.cd) / tStats(t).rate), '#9fd0ff', .5); ctx.globalCompositeOperation = 'source-over'; }
  else if (t.kind === 'tesla' || t.kind === 'cryo' || t.kind === 'pulse' || t.kind === 'gravity') { ctx.globalCompositeOperation = 'lighter'; glow(m[0], m[1], 9 + 3 * Math.sin(time / 150 + t.pad), c, .35); ctx.globalCompositeOperation = 'source-over'; }
  for (let i = 0; i < Math.min(k, 3); i++) { ctx.beginPath(); ctx.arc(p[0] - (Math.min(k,3)-1)*4 + i*8, p[1] + 21, 2.4, 0, 7); ctx.fillStyle = k === 4 ? '#ffd24a' : '#fff'; ctx.fill(); }
  if (k === 4) { ctx.font = 'bold 9px system-ui'; ctx.fillStyle = '#ffd24a'; ctx.textAlign = 'center'; ctx.fillText('PRIME', p[0], p[1] + 31); }
}
function draw(time) {
  ctx.setTransform(1,0,0,1,0,0); ctx.fillStyle = '#050816'; ctx.fillRect(0,0,cv.width,cv.height);
  const lv = LEVELS[LV], hue = laneHue(lv.hue), bgi = spr('bg_' + (LV + 1));
  if (bgi) { ctx.save(); const bv = CUR.bgv; if (bv === 1 || bv === 3) { ctx.translate(cv.width, 0); ctx.scale(-1, 1); } if (bv === 2 || bv === 3) { ctx.translate(0, cv.height); ctx.scale(1, -1); } const k = Math.max(cv.width / bgi.naturalWidth, cv.height / bgi.naturalHeight) * (1.05 + (bv === 2 ? .25 : 0)), dx = Math.sin(time / 9000) * 7, dy = Math.cos(time / 11000) * 7; ctx.drawImage(bgi, (cv.width - bgi.naturalWidth*k)/2 + dx, (cv.height - bgi.naturalHeight*k)/2 + dy, bgi.naturalWidth*k, bgi.naturalHeight*k); ctx.restore(); ctx.fillStyle = 'rgba(4,8,22,' + (LV === 2 ? .6 : .4) + ')'; ctx.fillRect(0,0,cv.width,cv.height); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'hsla(' + (hue + CUR.idx * 23) + ',70%,35%,.07)'; ctx.fillRect(0,0,cv.width,cv.height); ctx.globalCompositeOperation = 'source-over'; }
  const sx = G.shake > 0 ? (Math.random() - .5) * 6 * G.shake * SC : 0, sy = G.shake > 0 ? (Math.random() - .5) * 6 * G.shake * SC : 0;
  ctx.setTransform(SC,0,0,SC,OX + sx,OY + sy); ctx.save(); ctx.beginPath(); ctx.rect(-40,-40,W+80,H+80); ctx.clip();
  if (G.slowmo > 0) { const zk = Math.min(1, G.slowmo / 1.6), z = 1 + .16 * Math.sin(zk * Math.PI * .5) * zk, bp = (G.enemies.find(e => e.type === 'boss') ? ePos(G.enemies.find(e => e.type === 'boss')) : G.bossAt) || [W / 2, H / 2]; ctx.translate(bp[0], bp[1]); ctx.scale(z, z); ctx.translate(-bp[0], -bp[1]); }
  const g = ctx.createLinearGradient(0,0,0,H); g.addColorStop(0, 'hsl(' + hue + ',55%,9%)'); g.addColorStop(1, 'hsl(' + (hue+30) + ',60%,5%)'); if (!bgi) { ctx.fillStyle = g; ctx.fillRect(0,0,W,H); }
  for (const s of (bgi ? [] : STARS)) { ctx.globalAlpha = .4 + .5 * Math.abs(Math.sin(time/1500 + s[3])); ctx.fillStyle = '#fff'; ctx.fillRect(s[0], s[1], s[2], s[2]); } ctx.globalAlpha = 1;
  // slow drifting colored fog + dust motes (adds depth)
  ctx.globalCompositeOperation = 'lighter';
  glow(180 + Math.sin(time / 6000) * 90, 140 + Math.cos(time / 7000) * 60, 190, 'hsl(' + (hue + 20) + ',80%,30%)', .22);
  glow(180 + Math.cos(time / 5000) * 100, 460 + Math.sin(time / 6500) * 70, 200, 'hsl(' + (hue - 30) + ',80%,28%)', .18);
  for (const m of MOTES) { const yy = ((m[1] - time / 1000 * m[2]) % 620 + 620) % 620 - 10, xx = m[0] + Math.sin(time / 1500 + m[4]) * 8; ctx.globalAlpha = .25 + .2 * Math.sin(time / 700 + m[4]); ctx.fillStyle = '#bfe8ff'; ctx.beginPath(); ctx.arc(xx, yy, m[3], 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  // scorch marks left by explosions
  for (const d of G.decals) { const a = Math.max(0, 1 - d.t / 7) * .5; const gg = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r); gg.addColorStop(0, 'rgba(0,0,0,' + a + ')'); gg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 7); ctx.fill(); }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const P of PL) { trace(P.pts); ctx.strokeStyle = 'rgba(3,6,16,.8)'; ctx.lineWidth = 35; ctx.stroke(); ctx.globalCompositeOperation = 'lighter'; trace(P.pts); ctx.strokeStyle = 'hsla(' + hue + ',95%,60%,.75)'; ctx.lineWidth = 30; ctx.shadowColor = 'hsl(' + hue + ',100%,60%)'; ctx.shadowBlur = 14; ctx.stroke(); ctx.shadowBlur = 0; ctx.globalCompositeOperation = 'source-over'; trace(P.pts); ctx.strokeStyle = bgi ? 'rgba(8,13,30,.78)' : 'hsl(' + hue + ',70%,12%)'; ctx.lineWidth = 27; ctx.stroke(); }
  drawLaneTex(hue, time);
  ctx.globalCompositeOperation = 'lighter';
  for (const P of PL) { trace(P.pts); ctx.setLineDash([3, 13]); ctx.lineDashOffset = -time/45; ctx.strokeStyle = 'hsla(' + hue + ',100%,75%,.9)'; ctx.lineWidth = 2.4; ctx.shadowColor = 'hsl(' + hue + ',100%,60%)'; ctx.shadowBlur = 8; ctx.stroke(); ctx.setLineDash([]); ctx.shadowBlur = 0; }
  ctx.globalCompositeOperation = 'source-over';
  drawPortals(hue, time);
  const d = PL[0].pts[PL[0].pts.length - 1], cs = spr('p_core');
  if (cs) { const ch = 52, cw = cs.naturalWidth / cs.naturalHeight * ch; ctx.shadowColor = '#7defff'; ctx.shadowBlur = 20 + 6 * Math.sin(time / 300); ctx.drawImage(cs, d[0]-cw/2, d[1]+8-ch/2, cw, ch); ctx.shadowBlur = 0; }
  PADS().forEach((p, i) => {
    if (G.towers.some(t => t.pad === i)) return;
    const selB = G.build === i, pulse = .5 + .5 * Math.sin(time/500 + i), ps = spr('p_pad');
    if (ps) { const pw = 44, ph = ps.naturalHeight / ps.naturalWidth * pw; ctx.globalAlpha = selB ? 1 : .75 + .25 * pulse * (G.wave === 0 && tips ? 1 : .3); ctx.drawImage(ps, p[0]-pw/2, p[1]-ph/2, pw, ph); ctx.globalAlpha = 1; if (selB) { ctx.beginPath(); ctx.arc(p[0], p[1], 22, 0, 7); ctx.strokeStyle = '#7defff'; ctx.lineWidth = 2; ctx.stroke(); } }
  });
  if (G.moving) {
    PADS().forEach((p, i) => { if (G.towers.some(t => t.pad === i)) return; ctx.beginPath(); ctx.arc(p[0], p[1], 24 + 2 * Math.sin(time / 150), 0, 7); ctx.strokeStyle = 'rgba(90,255,150,.95)'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.fillStyle = 'rgba(90,255,150,.12)'; ctx.fill(); });
    const mp = PADS()[G.moving.pad]; ctx.beginPath(); ctx.arc(mp[0], mp[1], 26, 0, 7); ctx.strokeStyle = 'rgba(255,210,74,.95)'; ctx.lineWidth = 3; ctx.stroke();
  }
  if (G.build != null && G.pick) { const sr = tStats({ kind: G.pick, lvl: 1 }).range, pb = PADS()[G.build]; ctx.beginPath(); ctx.arc(pb[0], pb[1], sr, 0, 7); ctx.fillStyle = 'rgba(125,239,255,.08)'; ctx.fill(); ctx.strokeStyle = 'rgba(125,239,255,.55)'; ctx.lineWidth = 1.5; ctx.stroke(); }
  if (G.sel && G.sel.lvl < 3) { const sn = tStats({ kind: G.sel.kind, lvl: G.sel.lvl + 1 }), pn = PADS()[G.sel.pad]; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.arc(pn[0], pn[1], sn.range, 0, 7); ctx.strokeStyle = 'rgba(255,210,74,.55)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]); }
  if (G.sel) { const s = tStats(G.sel), p = PADS()[G.sel.pad]; ctx.beginPath(); ctx.arc(p[0], p[1], s.range, 0, 7); ctx.fillStyle = 'rgba(125,239,255,.09)'; ctx.fill(); ctx.strokeStyle = 'rgba(125,239,255,.55)'; ctx.lineWidth = 1.5; ctx.stroke(); }
  // draw order: ground things by y, towers, then flyers on top
  const sorted = G.enemies.slice().sort((a, b) => ePos(a)[1] - ePos(b)[1]);
  sorted.filter(e => !ENEMY[e.type].air).forEach(e => drawEnemy(e, time));
  G.towers.slice().sort((a, b) => PADS()[a.pad][1] - PADS()[b.pad][1]).forEach(t => drawTower(t, time));
  sorted.filter(e => ENEMY[e.type].air).forEach(e => drawEnemy(e, time));
  // continuous beams
  for (const t of G.towers) if (t.kind === 'beam' && t.beamOn && G.enemies.includes(t.beamOn)) {
    const m = muzzle(t), q = ePos(t.beamOn), qy = q[1] - (ENEMY[t.beamOn.type].air ? 14 : 0), rp = (t.ramp || 1) - 1, fl = .8 + .2 * Math.sin(time / 30), w0 = 2 + 4 * rp;
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,90,220,' + (.35 * fl) + ')'; ctx.lineWidth = w0 * 3.2; ctx.beginPath(); ctx.moveTo(m[0], m[1]); ctx.lineTo(q[0], qy); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,150,240,' + fl + ')'; ctx.lineWidth = w0 * 1.5; ctx.shadowColor = '#ff5ae0'; ctx.shadowBlur = 14; ctx.stroke(); ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,' + fl + ')'; ctx.lineWidth = Math.max(1.2, w0 * .5); ctx.stroke();
    glow(q[0], qy, 14 + 12 * rp, '#ff7ae6', .8); glow(m[0], m[1], 10, '#ffd0f4', .7);
    if (Math.random() < .6) part(q[0], qy, (Math.random() - .5) * 70, (Math.random() - .5) * 70, .3, 1.5, '#ffb0f0', true);
    ctx.globalCompositeOperation = 'source-over';
  }
  // pulse shockwaves
  for (const w of G.waves) {
    const k = Math.min(1, w.r / w.max), a = Math.max(0, 1 - k * k);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(w.x, w.y, Math.max(0, w.r * .6), w.x, w.y, Math.max(1, w.r));
    g.addColorStop(0, 'rgba(111,227,255,0)'); g.addColorStop(1, 'rgba(111,227,255,' + (a * .35) + ')');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(w.x, w.y, Math.max(1, w.r), 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(190,245,255,' + a + ')'; ctx.lineWidth = 3.5 * (1 - k) + 1; ctx.shadowColor = '#6fe3ff'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(w.x, w.y, Math.max(1, w.r), 0, 7); ctx.stroke();
    ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(111,227,255,' + (a * .6) + ')'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(w.x, w.y, Math.max(1, w.r * .72), 0, 7); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }
  // projectiles
  for (const s of G.shots) {
    const c = tcol(s.kind);
    ctx.globalCompositeOperation = 'lighter';
    if (s.kind === 'pulse') { const a = s.ang || 0; ctx.strokeStyle = c; ctx.lineWidth = 2.6; ctx.shadowColor = c; ctx.shadowBlur = 10; ctx.beginPath(); ctx.moveTo(s.x - Math.cos(a) * 12, s.y - Math.sin(a) * 12); ctx.lineTo(s.x, s.y); ctx.stroke(); ctx.shadowBlur = 0; }
    else if (s.kind === 'missile') { const a = s.ang || 0; glow(s.x - Math.cos(a) * 4, s.y - Math.sin(a) * 4, 9, '#ffb060', .8); ctx.globalCompositeOperation = 'source-over'; ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(a); ctx.fillStyle = '#d8dde6'; ctx.fillRect(-5, -1.6, 9, 3.2); ctx.fillStyle = '#ff6a2a'; ctx.beginPath(); ctx.moveTo(4, -1.6); ctx.lineTo(7, 0); ctx.lineTo(4, 1.6); ctx.fill(); ctx.restore(); }
    else { glow(s.x, s.y, 6, c, .9); ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, s.y, 1.8, 0, 7); ctx.fill(); }
    ctx.globalCompositeOperation = 'source-over';
  }
  // particles
  for (const q of G.parts) { const a = Math.max(0, q.life / q.max); ctx.globalCompositeOperation = q.add ? 'lighter' : 'source-over'; ctx.globalAlpha = a * (q.add ? 1 : .6); ctx.fillStyle = q.col; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (q.add ? a : 1.4 - a * .4), 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  for (const f of G.fx) {
    const a = Math.max(0, 1 - f.t / .5);
    if (f.k === 'corpse') { const sp = spr('e_' + f.type), h = EH[f.type]; if (sp) { const w = sp.naturalWidth / sp.naturalHeight * h, al = Math.max(0, 1 - f.t / .35); ctx.save(); ctx.translate(f.p[0], f.p[1]); if (f.flip) ctx.scale(-1, 1); ctx.scale(1 + f.t * .6, 1 - f.t * .5); ctx.globalAlpha = al; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(sp, -w/2, -h/2, w, h); ctx.restore(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; } }
    if (f.k === 'puff') { ctx.beginPath(); ctx.arc(f.p[0], f.p[1], 10 + f.t*60, 0, 7); ctx.strokeStyle = f.col; ctx.globalAlpha = a; ctx.lineWidth = 3; ctx.stroke(); ctx.globalAlpha = 1; }
    if (f.k === 'boom') { glow(f.p[0], f.p[1], f.r * (.7 + f.t), '#ffb060', a * .9); ctx.beginPath(); ctx.arc(f.p[0], f.p[1], f.r * (.4 + f.t*1.5), 0, 7); ctx.strokeStyle = 'rgba(255,220,150,' + a + ')'; ctx.lineWidth = 2; ctx.stroke(); }
    if (f.k === 'flakburst') { glow(f.p[0], f.p[1], f.r * (.6 + f.t), '#ffe9a0', a * .8); ctx.beginPath(); ctx.arc(f.p[0], f.p[1], f.r * (.3 + f.t*1.6), 0, 7); ctx.strokeStyle = 'rgba(255,230,160,' + a + ')'; ctx.lineWidth = 2; ctx.stroke(); }
    if (f.k === 'beam') { const al = Math.max(0, 1 - f.t / .16); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(190,225,255,' + al + ')'; ctx.lineWidth = 6 * al + 1; ctx.shadowColor = '#7dc0ff'; ctx.shadowBlur = 14; ctx.beginPath(); ctx.moveTo(f.a[0], f.a[1]); ctx.lineTo(f.b[0], f.b[1]); ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,' + al + ')'; ctx.lineWidth = 2; ctx.stroke(); ctx.shadowBlur = 0; ctx.globalCompositeOperation = 'source-over'; }
    if (f.k === 'bolt') { const al = Math.max(0, 1 - f.t / .22); ctx.globalCompositeOperation = 'lighter'; ctx.beginPath(); f.pts.forEach((p, i) => { if (!i) { ctx.moveTo(p[0], p[1]); return; } const pr = f.pts[i-1], n = 5; for (let j = 1; j <= n; j++) { const u = j / n; ctx.lineTo(pr[0] + (p[0]-pr[0])*u + (j < n ? (Math.random()-.5)*8 : 0), pr[1] + (p[1]-pr[1])*u + (j < n ? (Math.random()-.5)*8 : 0)); } }); ctx.strokeStyle = 'rgba(200,150,255,' + al + ')'; ctx.lineWidth = 3; ctx.shadowColor = '#c28bff'; ctx.shadowBlur = 12; ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,' + al + ')'; ctx.lineWidth = 1; ctx.stroke(); ctx.shadowBlur = 0; ctx.globalCompositeOperation = 'source-over'; }
    if (f.k === 'ring') { ctx.beginPath(); ctx.arc(f.p[0], f.p[1], f.r * Math.min(1, f.t / .6), 0, 7); ctx.strokeStyle = 'rgba(170,225,255,' + Math.max(0, .5 - f.t * .8) + ')'; ctx.lineWidth = 3; ctx.stroke(); }
    if (f.k === 'strike') { ctx.globalCompositeOperation = 'lighter'; glow(f.p[0], f.p[1], 70 * (.4 + f.t), '#ffe38a', a); ctx.globalCompositeOperation = 'source-over'; ctx.beginPath(); ctx.arc(f.p[0], f.p[1], 55 * (.3 + f.t*1.6), 0, 7); ctx.strokeStyle = 'rgba(255,255,255,' + a + ')'; ctx.lineWidth = 3; ctx.stroke(); }
    if (f.k === 'merge') { ctx.beginPath(); ctx.arc(f.p[0], f.p[1], 20 + f.t*50, 0, 7); ctx.strokeStyle = f.col === '#fff' ? 'rgba(255,255,255,' + a + ')' : 'rgba(255,210,74,' + a + ')'; ctx.lineWidth = 3; ctx.stroke(); }
    if (f.k === 'build') { ctx.beginPath(); ctx.arc(f.p[0], f.p[1], 10 + f.t*40, 0, 7); ctx.strokeStyle = 'rgba(125,239,255,' + a + ')'; ctx.lineWidth = 2; ctx.stroke(); }
    if (f.k === 'skybeam') { const pr = Math.min(1, f.t / .22), a2 = f.t < .22 ? 1 : Math.max(0, 1 - (f.t - .22) / .35), yy = -40 + (f.p[1] + 40) * pr; ctx.globalCompositeOperation = 'lighter'; const wg = ctx.createLinearGradient(f.p[0] - 16, 0, f.p[0] + 16, 0); wg.addColorStop(0, 'rgba(255,200,80,0)'); wg.addColorStop(.5, 'rgba(255,250,220,' + a2 + ')'); wg.addColorStop(1, 'rgba(255,200,80,0)'); ctx.fillStyle = wg; ctx.fillRect(f.p[0] - 16, -40, 32, yy + 40); ctx.globalCompositeOperation = 'source-over'; }
    if (f.k === 'vortex') { ctx.beginPath(); ctx.arc(f.p[0], f.p[1], f.r * (1 - Math.min(1, f.t / .6)), 0, 7); ctx.strokeStyle = 'rgba(150,165,255,' + Math.max(0, .55 - f.t * .9) + ')'; ctx.lineWidth = 3; ctx.stroke(); }
    if (f.k === 'ice') { const al = Math.max(0, 1 - f.t / .6); ctx.strokeStyle = 'rgba(190,235,255,' + al + ')'; ctx.lineWidth = 1.6; for (let i = 0; i < 6; i++) { const a3 = i * 1.047 + f.t * 2, r1 = 3, r2 = 11 + f.t * 8; ctx.beginPath(); ctx.moveTo(f.p[0] + Math.cos(a3) * r1, f.p[1] + Math.sin(a3) * r1); ctx.lineTo(f.p[0] + Math.cos(a3) * r2, f.p[1] + Math.sin(a3) * r2); ctx.stroke(); } }
    if (f.k === 'heal') { const c0 = PL[0].pts[PL[0].pts.length - 1], al = Math.max(0, 1 - f.t / .6); ctx.beginPath(); ctx.arc(c0[0], c0[1] + 8, 14 + f.t * 160, 0, 7); ctx.strokeStyle = 'rgba(90,255,150,' + al + ')'; ctx.lineWidth = 4; ctx.stroke(); }
    if (f.k === 'freeze') { ctx.fillStyle = 'rgba(159,216,255,' + a*.25 + ')'; ctx.fillRect(-40, -40, W+80, H+80); }
    if (f.k === 'hit') { ctx.fillStyle = 'rgba(255,40,70,' + Math.max(0, .3 - f.t*.6) + ')'; ctx.fillRect(-40, -40, W+80, H+80); }
  }
  for (const f of G.fx) if (f.k === 'light') { const a = Math.max(0, 1 - f.t / .22); if (a > 0) { ctx.globalCompositeOperation = 'lighter'; glow(f.p[0], f.p[1], f.r, f.col, a * .55); ctx.globalCompositeOperation = 'source-over'; } }
  for (const f of G.fx) if (f.k === 'coreHit') { const c0 = PL[0].pts[PL[0].pts.length - 1], a = Math.max(0, 1 - f.t / .5); ctx.beginPath(); ctx.arc(c0[0], c0[1] + 8, 18 + f.t * 120, 0, 7); ctx.strokeStyle = 'rgba(255,70,90,' + a + ')'; ctx.lineWidth = 4; ctx.stroke(); }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const n of G.nums) { const a = Math.min(1, (.75 - n.t) / .35), sc = n.t < .12 ? 1 + (.12 - n.t) * 6 : 1; ctx.save(); ctx.translate(n.x, n.y); ctx.scale(sc, sc); ctx.globalAlpha = Math.max(0, a); ctx.font = (n.big ? 'bold 15px' : 'bold 10.5px') + ' Rajdhani, system-ui'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.strokeText(n.text, 0, 0); ctx.fillStyle = n.col; ctx.fillText(n.text, 0, 0); ctx.restore(); }
  ctx.globalAlpha = 1;
  if (G.armed) { ctx.fillStyle = 'rgba(255,210,74,.1)'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#ffd24a'; ctx.font = 'bold 15px system-ui'; ctx.textAlign = 'center'; ctx.fillText('Tap where to strike', W/2, 22); }
  ctx.restore();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const vg = ctx.createRadialGradient(cv.width / 2, cv.height / 2, Math.min(cv.width, cv.height) * .35, cv.width / 2, cv.height / 2, Math.max(cv.width, cv.height) * .75);
  vg.addColorStop(0, 'rgba(0,0,8,0)'); vg.addColorStop(1, 'rgba(0,0,10,.62)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, cv.width, cv.height);
  if (G.warn > 0) { const wa = (.25 + .25 * Math.sin(time / 90)) * Math.min(1, G.warn); const wg = ctx.createRadialGradient(cv.width / 2, cv.height / 2, Math.min(cv.width, cv.height) * .2, cv.width / 2, cv.height / 2, Math.max(cv.width, cv.height) * .7); wg.addColorStop(0, 'rgba(255,0,40,0)'); wg.addColorStop(1, 'rgba(255,0,40,' + wa * 1.6 + ')'); ctx.fillStyle = wg; ctx.fillRect(0, 0, cv.width, cv.height); }
}
function drawPortals(hue, time) {
  PL.forEach(P => {
    const st = P.pts[0], x = Math.min(Math.max(st[0], 14), W - 14), y = st[1];
    ctx.save(); ctx.translate(x, y); ctx.globalCompositeOperation = 'lighter';
    glow(0, 0, 34, 'hsl(' + (hue + 150) + ',100%,55%)', .55 + .15 * Math.sin(time / 250));
    for (let i = 0; i < 3; i++) { ctx.rotate(time / (700 - i * 160) * (i % 2 ? -1 : 1)); ctx.beginPath(); ctx.arc(0, 0, 10 + i * 5, 0, 4.4); ctx.strokeStyle = 'hsla(' + (hue + 150 + i * 20) + ',100%,70%,' + (.9 - i * .2) + ')'; ctx.lineWidth = 2.2; ctx.stroke(); }
    ctx.restore();
  });
}
function drawLaneTex(hue, time) {
  const tx = spr('lane_' + (LV + 1)); if (!tx) return;
  const th = 190;
  for (const P of PL) {
    for (const sg of P.seg) {
      const ang = Math.atan2(sg.b[1] - sg.a[1], sg.b[0] - sg.a[0]);
      ctx.save(); ctx.translate(sg.a[0], sg.a[1]); ctx.rotate(ang - Math.PI / 2);
      ctx.beginPath(); ctx.rect(-13.5, -2, 27, sg.l + 4); ctx.clip();
      ctx.globalAlpha = .92;
      for (let y = -2; y < sg.l + 4; y += th) ctx.drawImage(tx, 110, 0, 36, 256, -13.5, y, 27, th);
      ctx.restore();
    }
    for (let i = 1; i < P.pts.length - 1; i++) { ctx.fillStyle = 'rgba(14,24,48,.96)'; ctx.beginPath(); ctx.arc(P.pts[i][0], P.pts[i][1], 13.5, 0, 7); ctx.fill(); ctx.strokeStyle = 'hsla(' + hue + ',95%,60%,.8)'; ctx.lineWidth = 2; ctx.stroke(); }
  }
  ctx.globalAlpha = 1;
}

/* ---------- HUD / sheets ---------- */
function hud() {
  $('hLives').textContent = '❤ ' + G.lives; $('hGold').textContent = '⚡ ' + G.gold; $('hWave').textContent = 'Wave ' + G.wave + '/' + maxWave();
  const go = $('go');
  if (G.over) { go.textContent = 'Finished'; go.disabled = true; }
  else if (G.running) { go.textContent = 'Wave ' + G.wave + ' ▸▸'; go.disabled = true; }
  else { go.textContent = G.wave >= maxWave() ? 'Done' : (autoWave && G.autoT > 0 ? 'Next wave ' + Math.ceil(G.autoT) + ' · tap' : 'Send wave ' + (G.wave + 1)); go.disabled = G.wave >= maxWave(); }
  if ($('sheet').style.display === 'block') renderSheet();
}
let lastBoss = false;
function ui2() {
  const total = Math.max(1, G.waveTotal), left = G.spawnQ.length + G.enemies.length;
  const frac = (Math.max(0, G.wave - (G.running ? 1 : 0)) + (G.running ? 1 - left / total : 0)) / maxWave();
  $('wbar').firstElementChild.style.width = Math.min(100, frac * 100) + '%';
  const boss = G.enemies.find(e => e.type === 'boss');
  $('boss').style.display = boss ? 'block' : 'none'; if (boss) $('boss').querySelector('i').style.width = Math.max(0, boss.hp / boss.max * 100) + '%';
  $('warn').style.display = G.warn > 0 ? 'block' : 'none';
  if (!!boss !== lastBoss) { lastBoss = !!boss; SFX.boss(lastBoss); }
}
function abilityUI() {
  for (const [id, key, cdMax] of [['aStrike', 'strike', 45 * cdMult()], ['aFreeze', 'freeze', 40 * cdMult()]]) {
    const el = $(id), left = G[key]; el.querySelector('.cd').style.height = (left / cdMax * 100) + '%';
    el.classList.toggle('armed', id === 'aStrike' && G.armed);
  }
  $('aRepair').style.display = prog.ab.repair ? 'block' : 'none'; $('aOver').style.display = prog.ab.over ? 'block' : 'none';
  $('aRepair').querySelector('.cd').style.height = (G.repairUsed || G.lives >= G.maxLives ? 100 : 0) + '%';
  $('aOver').querySelector('.cd').style.height = (G.overCd / (50 * cdMult()) * 100) + '%'; $('aOver').classList.toggle('armed', G.overT > 0);
}
function coach() {
  const c = $('coach'); if (G.moving) { c.textContent = 'Tap a green pad to move the ' + TOWERS[G.moving.kind].name + '. Tap anywhere else to cancel.'; c.style.display = 'block'; return; }
  if (!tips || LV > 0 || IDX > 0 || TIER > 0) { c.style.display = 'none'; return; }
  let t = '';
  if (!G.towers.length && G.wave === 0) t = '1 · Tap a glowing + hex to build a tower.';
  else if (G.wave === 0) t = '2 · Press “Send wave 1” when ready.';
  else if (G.wave === 1 && G.running) t = 'Towers fire by themselves. Earn ⚡ to build more.';
  else if (G.wave === 1 && !G.running) t = '3 · Tap a tower to upgrade it. Flyers need Pulse, Arc or Flak!';
  c.textContent = t; c.style.display = t ? 'block' : 'none';
}
function closeSheet() { G.sel = null; G.build = null; $('sheet').style.display = 'none'; }
/* tower stats shown while building and when a tower is selected: includes tier, research, mastery and rank perks */
function statRows(kind, lvl) {
  const b = TOWERS[kind], s = tStats({ kind, lvl }), f1 = x => (Math.round(x * 10) / 10), R = [];
  const shooter = b.dmg > 0 && !b.beam, dps = shooter ? s.dmg / s.rate : 0;
  R.push(['Targets', TAG(kind), 0]);
  if (kind === 'beam') R.push(['Damage', Math.round(s.dmg) + '/s → ' + Math.round(s.dmg * 2) + '/s', s.dmg]);
  else if (kind === 'pulse') R.push(['Damage', Math.round(s.dmg) + ' to all', s.dmg]);
  else if (b.dmg > 0) R.push(['Damage', Math.round(s.dmg) + ' / shot', s.dmg]);
  else R.push(['Damage', 'none', 0]);
  R.push(['Range', String(s.range), s.range]);
  if (kind === 'beam') R.push(['Fire rate', 'continuous', 0]);
  else if (b.dmg > 0) R.push(['Fire rate', f1(1 / s.rate) + ' / s', 1 / s.rate]);
  if (shooter) R.push(['DPS (one target)', String(Math.round(dps)), dps]);
  if (s.splash) R.push(['Blast radius', String(s.splash), s.splash]);
  if (s.chain) R.push(['Chain jumps', String(s.chain), s.chain]);
  if (s.slow) R.push(['Slows by', Math.round(s.slow * 100) + '%', s.slow]);
  if (s.pull) R.push(['Pull', f1(s.pull) + ' / s', s.pull]);
  if (b.ap) R.push(['Armor pierce', String(b.ap), b.ap]);
  R.push(['Damage type', b.type === 'gravity' || b.type === 'cold' ? b.type : b.type, 0]);
  return R;
}
function bonusLine(kind) {
  const d = Math.round((.06 * rk(kind + '.dmg') + masteryOf(kind).bonus + perkDmg()) * 100), r = rk(kind + '.rng') * 4, f = rk(kind + '.rate') * 5, p = [];
  if (d) p.push('+' + d + '% damage'); if (r) p.push('+' + r + '% range'); if (f) p.push('+' + f + '% fire rate'); if (rk(kind + '.sp')) p.push(SP_TXT[kind][0]);
  return p.length ? '<div class="info"><b>Your upgrades:</b> ' + p.join(' · ') + ' (research, mastery, rank)</div>' : '';
}
function statGrid(kind, lvl, nextLvl) {
  const cur = statRows(kind, lvl), nxt = nextLvl ? statRows(kind, nextLvl) : null;
  return '<div class="stg">' + cur.map((r, i) => { const n = nxt && nxt[i] && nxt[i][1] !== r[1] && r[2] !== 0 ? nxt[i][1] : ''; return '<div><span>' + r[0] + '</span><b>' + r[1] + '</b>' + (n ? '<i>→ ' + n + '</i>' : '') + '</div>'; }).join('') + '</div>';
}
function renderSheet() {
  const sh = $('sheet');
  if (G.build != null) {
    const p = PADS()[G.build], list = avail(); sh.className = p[1] > 300 ? 'top' : 'bot'; sh.style.display = 'block';
    if (!G.pick || !list.includes(G.pick)) G.pick = (prog.lastBuild && list.includes(prog.lastBuild)) ? prog.lastBuild : list[0];
    const k = G.pick, b = TOWERS[k], cost = b.cost, can = G.gold >= cost;
    sh.innerHTML = '<h4>Build a tower · tap a tower to see its stats</h4><div class="row" style="flex-wrap:wrap">' + list.map(q => { const bb = TOWERS[q]; return '<button class="tb' + (G.gold < bb.cost ? ' no' : '') + (q === k ? ' sel' : '') + '" style="flex:1 1 ' + (list.length > 6 ? '22%' : '14%') + '" data-b="' + q + '"><b>' + bb.icon + '</b>' + bb.name + '<br>⚡ ' + bb.cost + '<i class="tag ' + (bb.hits.length === 2 ? 'both' : bb.hits[0]) + '">' + (bb.hits.length === 2 ? 'G+A' : bb.hits[0] === 'air' ? 'AIR' : 'GND') + '</i></button>'; }).join('') + '</div>'
      + '<div class="info"><b>' + b.icon + ' ' + b.name + '</b> · ' + b.desc + '</div>' + statGrid(k, 1, 2) + bonusLine(k)
      + '<div class="info"><b>Strong:</b> ' + b.strong + ' · <b>Weak:</b> ' + b.weak + '</div><div class="row"><button class="act up' + (can ? '' : ' no') + '" id="bBuild">Build ' + b.name + ' ⚡ ' + cost + '</button></div>';
    const doBuild = () => { if (G.gold < cost) { flash('Not enough ⚡ yet'); return; } const pd = G.build; if (buildTower(pd, k)) { prog.lastBuild = k; save(); closeSheet(); G.sel = G.towers.find(t => t.pad === pd); renderSheet(); coach(); } };
    sh.querySelectorAll('[data-b]').forEach(el => { el.onclick = () => { if (G.pick === el.dataset.b) { doBuild(); return; } G.pick = el.dataset.b; SFX.play('click'); renderSheet(); }; });
    $('bBuild').onclick = doBuild;
  } else if (G.sel) {
    const t = G.sel, b = TOWERS[t.kind], p = PADS()[t.pad]; sh.className = p[1] > 300 ? 'top' : 'bot'; sh.style.display = 'block';
    const uc = upCost(t), partners = mergePartners(t);
    let btns = '';
    if (t.lvl < 3) btns += '<button class="act up' + (G.gold < uc ? ' no' : '') + '" id="bUp">Upgrade ⚡ ' + uc + '</button>';
    else if (t.lvl === 3) btns += '<button class="act mer' + (partners.length ? '' : ' no') + '" id="bMerge">' + (partners.length ? 'Merge → Prime' : 'Merge needs a 2nd max ' + b.name) + '</button>';
    else btns += '<button class="act up no">Prime tower</button>';
    const mfee = moveFee(t), canMove = !G.running && G.gold >= mfee;
    btns += '<button class="act mv' + (canMove ? '' : ' no') + '" id="bMove">' + (G.running ? 'Move<br><small>between waves</small>' : 'Move ⚡ ' + mfee) + '</button>';
    btns += '<button class="act sell" id="bSell">Sell ⚡ ' + sellVal(t) + '</button>';
    const nextLvl = t.lvl < 3 ? t.lvl + 1 : t.lvl === 3 ? 4 : 0, mm = masteryOf(t.kind);
    sh.innerHTML = '<h4>' + b.icon + ' ' + tName(t) + ' · tier ' + Math.min(t.lvl, 3) + (t.lvl === 4 ? ' ★' : '') + (t.lvl < 4 ? '  (green = after upgrade)' : '') + '</h4>' + statGrid(t.kind, t.lvl, t.lvl < 3 ? nextLvl : 0) + (t.lvl === 3 ? '<div class="info">Merge with a second max-tier ' + b.name + ' to make a Prime: about 5x damage.</div>' : '')
      + bonusLine(t.kind) + '<div class="info"><b>Strong:</b> ' + b.strong + ' · <b>Weak:</b> ' + b.weak + '<br><b>Mastery:</b> ' + mm.name + (mm.bonus ? ' (+' + Math.round(mm.bonus * 100) + '%)' : '') + ' · ' + mm.kills + ' kills' + (mm.next ? ' (next at ' + mm.next + ')' : '') + '</div><div class="row">' + btns + '</div>';
    if ($('bUp')) $('bUp').onclick = () => upgradeTower(t);
    if ($('bMerge')) $('bMerge').onclick = () => {
      if (!partners.length) return;
      const p0 = PADS()[t.pad]; partners.sort((x, y) => Math.hypot(PADS()[x.pad][0]-p0[0], PADS()[x.pad][1]-p0[1]) - Math.hypot(PADS()[y.pad][0]-p0[0], PADS()[y.pad][1]-p0[1]));
      mergeTowers(t, partners[0]); G.sel = t; renderSheet();
    };
    $('bMove').onclick = () => { if (G.running) { flash('Move towers between waves'); return; } if (G.gold < mfee) { flash('Not enough ⚡ to move'); return; } G.moving = t; closeSheet(); coach(); };
    $('bSell').onclick = () => { sellTower(t); closeSheet(); coach(); };
  } else sh.style.display = 'none';
}
const show = id => $(id).style.display = 'flex', hide = id => $(id).style.display = 'none';
function hideAll() { document.querySelectorAll('.ov').forEach(o => o.style.display = 'none'); }

function showLevels() {
  $('mapRank').textContent = rankOf() + (prog.call ? ' ' + prog.call : ''); $('mapSub').textContent = totalCleared() + ' / ' + WORLDS.length * LPW + ' levels · ★ ' + totalStars() + ' · ' + prog.rp + ' RP';
  let html = '<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%"><polyline points="' + WORLDS.map(w => w.pos.join(',')).join(' ') + ' 70,14" fill="none" stroke="rgba(125,239,255,.35)" stroke-width=".5" stroke-dasharray="1.5 1.5"/></svg>';
  let nextDone = false;
  WORLDS.forEach((w, i) => {
    const locked = !worldOpen(i), n = worldCleared(i), isNext = !locked && n < LPW && !nextDone; if (isNext) nextDone = true;
    html += '<button class="pl' + (locked ? ' lock' : '') + (isNext ? ' next' : '') + '" data-w="' + i + '" style="left:' + w.pos[0] + '%;top:' + w.pos[1] + '%"><img src="art/' + w.planet + '.webp?v=' + ART_V + '"><b>' + (locked ? '🔒 ' : '') + w.name + '</b><small>' + w.tag + '</small><span class="s">' + n + ' / ' + LPW + '</span></button>';
  });
  html += '<button class="pl lock" data-soon="1" style="left:70%;top:14%"><img src="art/u_planet_gate.webp" style="width:60px;height:60px"><b>Tessara</b><small>Coming soon</small></button>';
  $('mapBody').innerHTML = html;
  $('mapBody').querySelectorAll('[data-w]').forEach(b => b.onclick = () => { const i = +b.dataset.w; if (b.classList.contains('lock')) { $('mapFoot').textContent = 'Clear the final level of the world before it first.'; return; } playWorld(i); });
  $('mapBody').querySelectorAll('[data-soon]').forEach(b => b.onclick = () => { stats.soonTaps = (stats.soonTaps || 0) + 1; save(); $('mapFoot').textContent = 'More worlds are on the way. Your tap was counted so we know if you want them.'; });
  $('mapFoot').textContent = 'Tap a world to begin.';
  hideAll(); show('ovLevels');
}
function showWorld(w) {
  const wd = WORLDS[w]; $('wlTitle').textContent = wd.name; $('wlSub').textContent = wd.tag + ' · ' + worldCleared(w) + ' / ' + LPW + ' cleared';
  const tierUnlocked = t => OPEN_ALL || t === 0 || (() => { for (let i = 0; i < LPW; i++) if (cleared(w, i, t - 1)) return true; return false; })();
  if (!tierUnlocked(prog.tier || 0)) prog.tier = 0;
  $('wlTiers').innerHTML = TIERS.map((T, t) => '<button class="chip2' + ((prog.tier || 0) === t ? ' on' : '') + (tierUnlocked(t) ? '' : ' lock') + '" data-t="' + t + '">' + (tierUnlocked(t) ? '' : '🔒 ') + T.n + '</button>').join('');
  $('wlTiers').querySelectorAll('[data-t]').forEach(b => b.onclick = () => { const t = +b.dataset.t; if (!tierUnlocked(t)) { $('wlFoot').textContent = 'Clear a level on ' + TIERS[t - 1].n + ' to unlock ' + TIERS[t].n + '.'; return; } prog.tier = t; save(); showWorld(w); });
  const t = prog.tier || 0; let html = '';
  for (let i = 0; i < LPW; i++) {
    const open = levelOpen(w, i) && tierOpen(w, i, t), st = starsOf(w, i, t), boss = i === 4 || i === LPW - 1;
    html += '<button class="lvb' + (open ? '' : ' lock') + (st ? ' done' : '') + (boss ? ' boss' : '') + '" data-i="' + i + '"><b>' + (open ? (i + 1) : '🔒') + '</b>' + (boss ? '<em>' + (i === LPW - 1 ? 'FINAL' : 'BOSS') + '</em>' : '') + '<span>' + '★'.repeat(st) + '☆'.repeat(3 - st) + '</span></button>';
  }
  $('wlGrid').innerHTML = html;
  $('wlGrid').querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const i = +b.dataset.i; if (b.classList.contains('lock')) { $('wlFoot').textContent = tierOpen(w, i, t) ? 'Clear the level before it first.' : 'Clear this level on ' + TIERS[t - 1].n + ' first.'; return; } startLevel(w, i, t); });
  $('wlFoot').textContent = 'Stars: 3 = lose 2 lives or fewer. Hard and Nightmare give tougher waves.';
  hideAll(); show('ovWorld');
}
$('wlBack').onclick = showLevels;
let stLines = [], stI = 0, stDone = null;
function showStory(lines, done) { stLines = lines; stI = 0; stDone = done; renderStory(); hideAll(); show('ovStory'); }
function renderStory() {
  const l = stLines[stI], sp = SPEAK[l[0]];
  $('stImg').src = 'art/' + sp.img + '.webp?v=' + ART_V; $('stName').textContent = sp.name; $('stText').textContent = l[1].replace('{c}', prog.call || 'Cadet');
  $('stNext').textContent = stI >= stLines.length - 1 ? 'Start ▸' : 'Next ▸';
}
$('stNext').onclick = () => { if (stI < stLines.length - 1) { stI++; renderStory(); } else { hide('ovStory'); if (stDone) stDone(); } };
$('stSkip').onclick = () => { hide('ovStory'); if (stDone) stDone(); };
function playWorld(i) {
  const w = WORLDS[i];
  if (!prog.sawIntro.includes(i)) { prog.sawIntro.push(i); save(); showStory(w.intro, () => showWorld(i)); } else showWorld(i);
}
$('callOk').onclick = () => { prog.call = ($('callIn').value || '').trim().slice(0, 14) || 'Rookie'; save(); hide('ovCall'); showLevels(); };


/* ---------- Hangar (research, medals, stats, ...) ---------- */
let hubTab = 'research', hubScope = 'pulse', hubReturn = 'ovLevels';
const HUB_TABS = [['research', 'Research'], ['medals', 'Medals'], ['stats', 'Stats']];
const hubExtra = {};
function showHub(tab, from) { if (tab) hubTab = tab; if (from) hubReturn = from; renderHub(); hideAll(); show('ovHub'); }
function renderHub() {
  $('hubRP').textContent = prog.rp + ' Research Points · ' + resRanks() + ' ranks owned';
  $('hubTabs').innerHTML = HUB_TABS.map(([id, n]) => '<button class="chip2' + (hubTab === id ? ' on' : '') + '" data-tab="' + id + '">' + n + '</button>').join('');
  $('hubTabs').querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { hubTab = b.dataset.tab; renderHub(); });
  const body = $('hubBody');
  if (hubExtra[hubTab]) { hubExtra[hubTab](body); return; }
  if (hubTab === 'research') {
    const scopes = KINDS.map(k => [k, TOWERS[k].icon, !TOWERS[k].locked || prog.tw[k]]).concat([['g', '🛠', true]]);
    let html = '<div class="scopes">' + scopes.map(([k, ic, ok]) => '<button class="sc' + (hubScope === k ? ' on' : '') + (ok ? '' : ' lock') + '" data-sc="' + k + '">' + ic + '</button>').join('') + '</div>';
    html += '<div class="hubnote">' + (hubScope === 'g' ? '<b>Global upgrades</b>' : '<b>' + TOWERS[hubScope].name + '</b> · ' + TAG(hubScope) + (() => { const m = masteryOf(hubScope); return ' · Mastery: ' + m.name + ' (' + m.kills + ' kills' + (m.next ? ', next at ' + m.next : '') + ')'; })()) + '</div>';
    NODES.filter(n => n.scope === hubScope).forEach(n => {
      const r = rk(n.id), full = r >= n.max, cost = full ? 0 : n.costs[r], can = !full && prog.rp >= cost;
      html += '<div class="node' + (n.special ? ' sp' : '') + '"><div class="nt"><b>' + n.label + '</b><span>' + n.desc + '</span></div><div class="pips">' + '●'.repeat(r) + '○'.repeat(n.max - r) + '</div><button class="buy' + (can ? '' : ' no') + '" data-n="' + n.id + '">' + (full ? 'MAX' : cost + ' RP') + '</button></div>';
    });
    html += '<button class="btn alt" id="respec">Respec: refund everything</button>';
    body.innerHTML = html;
    body.querySelectorAll('[data-sc]').forEach(b => b.onclick = () => { hubScope = b.dataset.sc; renderHub(); });
    body.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { if (b.classList.contains('no') || b.textContent === 'MAX') return; if (buyNode(b.dataset.n)) renderHub(); });
    $('respec').onclick = () => { const n = respec(); renderHub(); $('hubBody').insertAdjacentHTML('afterbegin', '<div class="hubnote">Refunded ' + n + ' RP.</div>'); };
  } else if (hubTab === 'medals') {
    body.innerHTML = '<div class="hubnote">Each medal pays 3 Research Points once. ' + Object.keys(prog.medals).length + ' / ' + MEDALS.length + ' earned.</div>' + MEDALS.map(m => '<div class="node' + (prog.medals[m[0]] ? ' got' : '') + '"><div class="nt"><b>' + (prog.medals[m[0]] ? '🏅 ' : '🔒 ') + m[1] + '</b><span>' + m[2] + '</span></div></div>').join('');
  } else if (hubTab === 'stats') {
    const t = Math.round(stats.secs / 60), bt = Object.entries(stats.byType || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => (ENEMY[k] ? ENEMY[k].name : k) + ' ' + v).join(' · ') || '—';
    const tw = KINDS.map(k => { const m = masteryOf(k); return TOWERS[k].icon + ' ' + TOWERS[k].name + ': ' + m.kills + ' kills (' + m.name + '), ' + Math.round((stats.dmgBy && stats.dmgBy[k]) || 0) + ' damage'; });
    body.innerHTML = '<div class="tiles">' + [['Enemies defeated', stats.kills || 0], ['Flyers shot down', stats.air || 0], ['Bosses defeated', stats.bossKills || 0], ['Levels cleared', totalCleared() + ' / ' + WORLDS.length * LPW], ['Stars', totalStars()], ['Best wave', stats.bestWave], ['Merges', stats.merges], ['Minutes played', t], ['Wins / losses', stats.wins + ' / ' + stats.losses], ['Rank', rankOf()]].map(([a, b]) => '<div class="tile"><b>' + b + '</b><span>' + a + '</span></div>').join('') + '</div><div class="hubnote"><b>Kills by enemy:</b> ' + bt + '</div><div class="hubnote">' + tw.join('<br>') + '</div><div class="hubnote"><b>Rank perks:</b> Defender +20 energy · Guardian +1 core life · Warden +3% damage · Commander abilities recharge 10% faster.</div>';
  }
}

HUB_TABS.push(['armory', 'Armory'], ['loadout', 'Loadout']);
hubExtra.armory = body => {
  const medals = Object.keys(prog.medals).length, own = (def) => !def.need || medals >= def.need;
  const sw = (c) => Object.values(c).slice(0, 5).map(x => '<i style="background:' + x + '"></i>').join('');
  let html = '<div class="hubnote">Cosmetics only. They never change how strong anything is. In this test build you can try everything free; the prices show what they would cost later (all together $4.99). Your taps are counted so we know what people like.</div><div class="hubnote"><b>Tower colours</b></div>';
  html += Object.entries(PALS).map(([id, p]) => '<div class="node' + (prog.skin.pal === id ? ' got' : '') + '"><div class="nt"><b>' + p.n + '</b><span class="swatch">' + (id === 'default' ? 'Original colours' : sw(p.c)) + '</span><span>' + (p.price ? '$' + p.price.toFixed(2) + ' · free to try in test' : own(p) ? 'Unlocked' : 'Locked: ' + (p.need - medals) + ' more medals') + '</span></div><button class="buy' + (own(p) ? '' : ' no') + '" data-pal="' + id + '">' + (prog.skin.pal === id ? 'ON' : 'Equip') + '</button></div>').join('');
  html += '<div class="hubnote"><b>Lane themes</b></div>' + Object.entries(LANES).map(([id, l]) => '<div class="node' + (prog.skin.lane === id ? ' got' : '') + '"><div class="nt"><b>' + l.n + '</b><span class="swatch">' + (l.hue === null ? 'Each world uses its own colour' : '<i style="background:hsl(' + l.hue + ',90%,60%)"></i>') + '</span><span>' + (l.price ? '$' + l.price.toFixed(2) + ' · free to try in test' : 'Unlocked') + '</span></div><button class="buy" data-lane="' + id + '">' + (prog.skin.lane === id ? 'ON' : 'Equip') + '</button></div>').join('');
  body.innerHTML = html;
  body.querySelectorAll('[data-pal]').forEach(b => b.onclick = () => { if (b.classList.contains('no')) return; prog.skin.pal = b.dataset.pal; if (PALS[b.dataset.pal].price) stats.cosTry++; save(); renderHub(); });
  body.querySelectorAll('[data-lane]').forEach(b => b.onclick = () => { prog.skin.lane = b.dataset.lane; if (LANES[b.dataset.lane].price) stats.cosTry++; save(); renderHub(); });
};
hubExtra.loadout = body => {
  const u = KINDS.filter(k => !TOWERS[k].locked || prog.tw[k]);
  if (u.length <= LOADOUT_N) { body.innerHTML = '<div class="hubnote">You own ' + u.length + ' towers, so all of them come into every level. Once you unlock more than ' + LOADOUT_N + ', you will pick which ' + LOADOUT_N + ' to bring here.</div>'; return; }
  let lo = (prog.loadout || []).filter(k => u.includes(k)); if (lo.length !== LOADOUT_N) lo = u.slice(0, LOADOUT_N); prog.loadout = lo;
  body.innerHTML = '<div class="hubnote">Pick exactly ' + LOADOUT_N + ' towers to bring into levels (' + lo.length + ' chosen). Tap to swap.</div>' + u.map(k => '<div class="node' + (lo.includes(k) ? ' got' : '') + '"><div class="nt"><b>' + TOWERS[k].icon + ' ' + TOWERS[k].name + '</b><span>' + TAG(k) + ' · ' + TOWERS[k].desc + '</span></div><button class="buy" data-lo="' + k + '">' + (lo.includes(k) ? 'IN' : 'OUT') + '</button></div>').join('');
  body.querySelectorAll('[data-lo]').forEach(b => b.onclick = () => {
    const k = b.dataset.lo; let cur = prog.loadout.slice();
    if (cur.includes(k)) { $('hubBody').insertAdjacentHTML('afterbegin', '<div class="hubnote">Tap a tower that is OUT to swap it in for this one.</div>'); prog.swapOut = k; save(); return; }
    if (prog.swapOut && cur.includes(prog.swapOut)) { cur[cur.indexOf(prog.swapOut)] = k; prog.swapOut = null; prog.loadout = cur; save(); renderHub(); }
    else { $('hubBody').insertAdjacentHTML('afterbegin', '<div class="hubnote">First tap the tower you want to remove (IN), then the one to bring.</div>'); }
  });
};

$('hubBack').onclick = () => { hide('ovHub'); show(hubReturn); if (hubReturn === 'ovLevels') showLevels(); };
$('lvHub').onclick = () => showHub('research', 'ovLevels');
$('mHub').onclick = () => { hide('ovMenu'); showHub('research', 'ovMenu'); };


/* ---------- Daily challenge ---------- */
const TWISTS = [{ id: 'air', n: 'Air Raid', d: 'Only flyers attack. Bring Flak, Pulse and Arc.' }, { id: 'speed', n: 'Speed Run', d: 'Enemies move 30% faster.' }, { id: 'frugal', n: 'Frugal', d: 'You start with 30% less energy.' }, { id: 'swarm', n: 'Swarm', d: 'Double the enemies, half the health.' }, { id: 'tight', n: 'Tight Loadout', d: 'Only 4 random towers allowed.' }];
const dayNum = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
const dayStr = () => String(dayNum());
function dailyInfo() {
  const sd = dayNum(), w = sd % 3, i = 1 + ((sd >> 2) % 9), tw = TWISTS[(sd >> 4) % TWISTS.length], tier = totalCleared() >= 10 ? 1 : 0;
  return { sd, w, i, tw, tier };
}
function applyTwist(lv, tw, sd) {
  lv.daily = { tw: tw.id, date: dayStr() };
  if (tw.id === 'air') lv.airOnly = true;
  if (tw.id === 'speed') lv.spMult *= 1.3;
  if (tw.id === 'frugal') lv.gold = Math.round(lv.gold * .7);
  if (tw.id === 'swarm') { lv.swarm = true; lv.hp *= .5; }
  if (tw.id === 'tight') { const rng = mulberry(sd), u = KINDS.filter(k => !TOWERS[k].locked || prog.tw[k]).slice(); const pick = []; while (pick.length < 4 && u.length) pick.push(u.splice(Math.floor(rng() * u.length), 1)[0]); lv.only = pick; }
  lv.name = 'Daily: ' + tw.n;
}
function showDaily() {
  const d = dailyInfo(), done = prog.daily.last === dayStr();
  $('dlTitle').textContent = 'Daily challenge';
  $('dlBody').innerHTML = '<p><b>' + d.tw.n + '</b><br>' + d.tw.d + '</p><p>' + WORLDS[d.w].name + ' · level ' + (d.i + 1) + ' · ' + TIERS[d.tier].n + '</p><p>Streak: <b>' + (prog.daily.streak || 0) + '</b> day' + ((prog.daily.streak || 0) === 1 ? '' : 's') + '<br>' + (done ? 'Today\'s reward: claimed. You can still play for fun.' : 'Reward: ' + (5 + Math.min(5, prog.daily.streak || 0)) + ' Research Points') + '</p>';
  hideAll(); show('ovDaily');
}
$('lvDaily').onclick = () => { if (totalCleared() < 1 && !OPEN_ALL) { $('mapFoot').textContent = 'Beat the exam first to unlock the daily challenge.'; return; } showDaily(); };
$('dlGo').onclick = () => { const d = dailyInfo(); startLevel(d.w, d.i, d.tier, false, d); };
$('dlBack').onclick = showLevels;

/* ---------- input ---------- */
cv.addEventListener('pointerdown', ev => {
  if (G.over) return;
  const r = cv.getBoundingClientRect(), dpr = cv.width / r.width;
  const x = ((ev.clientX - r.left) * dpr - OX) / SC, y = ((ev.clientY - r.top) * dpr - OY) / SC;
  if (G.armed) { G.armed = false; useStrike(x, y); abilityUI(); return; }
  if (G.moving) {
    let ph = -1, bd2 = 26; PADS().forEach((p, i) => { const d = Math.hypot(p[0] - x, p[1] - y); if (d < bd2) { bd2 = d; ph = i; } });
    const mt = G.moving; G.moving = null;
    if (ph >= 0 && !G.towers.some(o => o.pad === ph)) { if (moveTower(mt, ph)) { G.sel = mt; } } else flash('Move cancelled');
    coach(); renderSheet(); return;
  }
  let hit = -1, bd = 26;
  PADS().forEach((p, i) => { const d = Math.hypot(p[0]-x, p[1]-y); if (d < bd) { bd = d; hit = i; } });
  if (hit < 0) { closeSheet(); return; }
  const t = G.towers.find(tt => tt.pad === hit);
  if (t) { G.build = null; G.sel = t; } else { G.sel = null; G.build = hit; }
  renderSheet();
});
$('go').onclick = sendWave;
$('aStrike').onclick = () => { if (G.over || G.strike > 0) return; G.armed = !G.armed; abilityUI(); };
$('aFreeze').onclick = () => { if (!G.over) { useFreeze(); abilityUI(); } };
$('aRepair').onclick = () => { useRepair(); abilityUI(); };
$('aOver').onclick = () => { useOver(); abilityUI(); };
$('bSpeed').onclick = () => { G.speed = G.speed === 1 ? 2 : G.speed === 2 ? 3 : 1; $('bSpeed').textContent = G.speed + '×'; stats.speedTaps++; save(); };
$('bAuto').onclick = () => { autoWave = !autoWave; try { localStorage.setItem('orbitbastion_auto', autoWave ? '1' : '0'); } catch (e) {} autoUI(); if (autoWave && !G.running && G.wave > 0 && G.wave < maxWave()) G.autoT = 4; hud(); };
function autoUI() { $('bAuto').innerHTML = 'Auto<br>' + (autoWave ? 'on' : 'off'); $('bAuto').classList.toggle('on', autoWave); }
$('bMenu').onclick = () => { $('tipState').textContent = tips ? 'on' : 'off'; show('ovMenu'); };
$('mResume').onclick = () => hide('ovMenu');
$('mRestart').onclick = () => { stats.restarts = (stats.restarts || 0) + 1; if (!G.over && G.clock < 60) stats.earlyRestarts = (stats.earlyRestarts || 0) + 1; save(); startLevel(LV, IDX, TIER, false, CUR.daily ? { tw: TWISTS.find(x => x.id === CUR.daily.tw), sd: dayNum() } : null); };
$('mLevels').onclick = showLevels;
$('mWorld').onclick = () => showWorld(LV);
function sndUI() { $('mSound').textContent = 'Sound effects: ' + (SFX.on ? 'on' : 'off'); $('mMusic').textContent = 'Music: ' + (SFX.music ? 'on' : 'off'); }
$('mSound').onclick = () => { SFX.setOn(!SFX.on); sndUI(); SFX.play('click'); };
$('mMusic').onclick = () => { SFX.setMusic(!SFX.music); sndUI(); };
$('bMenu').addEventListener('click', sndUI);
$('mTips').onclick = () => { tips = !tips; try { localStorage.setItem('orbitbastion_tips', tips ? '1' : '0'); } catch (e) {} $('tipState').textContent = tips ? 'on' : 'off'; coach(); };
$('mUnlock').onclick = () => { stats.unlockTaps++; save(); alert('Thanks! More sectors are not for sale yet. Your tap was counted so we know if people want them.'); };
$('mStats').onclick = () => { hide('ovMenu'); showStats(); };
$('lvStats').onclick = () => { showStats(); };
$('sClose').onclick = () => { hide('ovStats'); };
$('eAgain').onclick = () => startLevel(LV, IDX, TIER, false, CUR.daily ? { tw: TWISTS.find(x => x.id === CUR.daily.tw), sd: dayNum() } : null);
$('eNext').onclick = () => startLevel(LV, IDX + 1, TIER);
$('eWorld').onclick = () => showWorld(LV);
document.querySelectorAll('[data-fun]').forEach(b => b.onclick = () => {
  if (b.dataset.fun === '1') stats.funYes++; else stats.funNo++; save();
  b.parentElement.querySelectorAll('button').forEach(x => x.style.opacity = x === b ? 1 : .35);
  if (b.closest('#ovFun')) setTimeout(() => hide('ovFun'), 350);
});
function statsText() {
  const days = Object.keys(stats.days).length;
  return ['Orbit Bastion test stats', 'Days played: ' + days, 'Runs started: ' + stats.runs, 'Wins: ' + stats.wins + '  Losses: ' + stats.losses, 'Waves cleared: ' + stats.wavesCleared, 'Best wave: ' + stats.bestWave, 'Minutes played: ' + Math.round(stats.secs / 60), 'Fun yes/no: ' + stats.funYes + '/' + stats.funNo, 'Unlock taps: ' + stats.unlockTaps, 'Upgrades: ' + stats.upgrades + '  Merges: ' + stats.merges + '  Abilities: ' + stats.abilities, 'Speed taps: ' + stats.speedTaps, 'Auto wave on: ' + autoWave, 'Towers moved: ' + (stats.moves || 0) + '  Move fees paid: ' + (stats.moveFees || 0) + '  Restarts from pause menu: ' + (stats.restarts || 0) + '  (within first minute: ' + (stats.earlyRestarts || 0) + ')', 'Towers sold: ' + (stats.sells || 0) + '  Sold within 30 s of building: ' + (stats.regretSells || 0) + '  Lost a level after such a sell: ' + (stats.regretLosses || 0), 'More-worlds taps: ' + (stats.soonTaps || 0), 'Callsign set: ' + !!prog.call, 'Stars per sector: ' + prog.stars.join('/'), 'Towers built: ' + JSON.stringify(stats.builds)].join('\n');
}
function showStats() {
  const days = Object.keys(stats.days).length;
  $('tiles').innerHTML = [['Days played', days], ['Runs', stats.runs], ['Wins', stats.wins], ['Waves cleared', stats.wavesCleared], ['Best wave', stats.bestWave], ['Minutes', Math.round(stats.secs/60)]].map(([a, b]) => '<div class="tile"><b>' + b + '</b><span>' + a + '</span></div>').join('');
  show('ovStats');
}
$('sCopy').onclick = async () => { try { await navigator.clipboard.writeText(statsText()); $('sCopy').textContent = 'Copied ✓'; } catch (e) { prompt('Copy this:', statsText()); } };

/* ---------- loop ---------- */
let last = 0;
function loop(ts) {
  const dt = Math.min(.05, (ts - last) / 1000 || 0); last = ts;
  const paused = [...document.querySelectorAll('.ov')].some(o => o.style.display === 'flex');
  if (!paused && !G.over) { const sf = G.slowmo > 0 ? .35 : 1; G.slowmo = Math.max(0, G.slowmo - dt); for (let i = 0; i < G.speed; i++) step(dt * sf); stats.secs += dt; if (Math.random() < .01) save(); abilityUI(); ui2(); }
  else if (G.over) { G.clock += dt; for (let i = G.parts.length - 1; i >= 0; i--) { const q = G.parts[i]; q.life -= dt; if (q.life <= 0) G.parts.splice(i, 1); else { q.x += q.vx * dt; q.y += q.vy * dt; } } for (const f of G.fx) f.t += dt; }
  requestAnimationFrame(loop);
  try { draw(ts); } catch (e) { window.__drawErr = e; try { ctx.restore(); } catch (e2) {} }
}
window.__td = { buildLevel, get CUR() { return CUR; }, LPW, TIERS, prog, avail, endGame, step, get G() { return G; }, startLevel, sendWave, buildTower, upgradeTower, mergeTowers, mergePartners, useFreeze, useStrike, LEVELS, TOWERS, ENEMY, KINDS, PADS, canHit, get WAVES() { return WAVES; }, prog };
autoUI(); resize(); startLevel(0, 0, 0, true); if (!prog.call) { hideAll(); show('ovCall'); } else showLevels(); requestAnimationFrame(loop); setTimeout(resize, 200);

// MMODD — client
'use strict';
(() => {
const $ = id => document.getElementById(id);
const cv = $('game'), ctx = cv.getContext('2d');
const TS = 16;
const T = { GRASS: 0, TREE: 1, WATER: 2, PATH: 3, STONE: 4, WALL: 5, FLOWER: 6, DGRASS: 7, DFLOOR: 8, DWALL: 9, ROOF: 10,
  SAND: 11, DOOR: 12, PILLAR: 13, MARSH: 14, BOG: 15, REED: 16, MFLOOR: 17, MWALL: 18, CRYSTAL: 19, AFLOOR: 20,
  SNOW: 21, ICE: 22, ASH: 23, LAVA: 24, VOID: 25, CACTUS: 26, ROCK: 27, DEADTREE: 28, PINE: 29, DECO: 30, DECOS: 31 };
const SOLID = new Set([T.TREE, T.WATER, T.WALL, T.DWALL, T.ROOF, T.DOOR, T.PILLAR, T.BOG, T.MWALL, T.CRYSTAL, T.ICE, T.LAVA, T.CACTUS, T.ROCK, T.DEADTREE, T.PINE, T.DECOS]);
const KW = 96; // largeur du royaume d'origine
let ZONES = [];
const zoneAt = (x, y) => { if (x < KW || y >= WORLD_H) return null; for (const z of ZONES) if (x >= z.x0 && x <= z.x1 + 0.999 && y >= z.y0 && y <= z.y1 + 0.999) return z; return null; };
const BIOME_GROUND = [0, 11, 7, 14, 21, 23, 25];
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ============================================================
   Pixel art
   ============================================================ */
const HUM = {
  head_d: ['....hhhh....', '...hhhhhh...', '..hhhhhhhh..', '..hssssssh..', '..sesssses..', '...ssssss...'],
  head_u: ['....hhhh....', '...hhhhhh...', '..hhhhhhhh..', '..hhhhhhhh..', '..hhhhhhhh..', '...hhhhhh...'],
  head_s: ['....hhhh....', '...hhhhhh...', '..hhhhhhhh..', '..hhhsssss..', '..hhhssses..', '...hsssss...'],
  body_f: ['..dbbbbbbd..', '.sdbbbbbbds.', '.sdbbbbbbds.', '..sbbggbbs..', '...bbbbbb...'],
  body_s: ['...dbbbbd...', '...dbbbbs...', '...dbbbbs...', '...bbggbb...', '...bbbbbb...'],
  legs_f: [['...ll..ll...', '...ll..ll...', '...kk..kk...'], ['...ll..ll...', '..ll....l...', '..kk....kk..'], ['...ll..ll...', '...l....ll..', '..kk....kk..']],
  legs_s: [['....llll....', '....l..l....', '....k..kk...'], ['...ll..ll...', '...l....l...', '..kk....kk..'], ['....lll.....', '....ll......', '....kkk.....']],
};
function humFrame(dir, f) {
  if (dir === 0) return [...HUM.head_d, ...HUM.body_f, ...HUM.legs_f[f]];
  if (dir === 1) return [...HUM.head_u, ...HUM.body_f, ...HUM.legs_f[f]];
  return [...HUM.head_s, ...HUM.body_s, ...HUM.legs_s[f]];
}
const WOLF = { top: ['...........g.g..', '..........ggggg.', 'g.........gggegn', '.g.......gggggg.', '..gggggggggggg..', '..gGGGGGGGGgg...', '..gggggggggg....'],
  legs: [['..gg.gg..gg.gg..', '..gg.g....g..g..', '..d..d....d..d..'], ['...gg.g..g.gg...', '...g..g..g..g...', '...d..d..d..d...']] };
const BOAR = { top: ['....DDDDDDD.....', '..bbbbbbbbbbb...', '.bbbbbbbbbbbbbb.', 'bbbbbbbbbbbbbebb', 'bbbbbbbbbbbbbbpp', '.bbbbbbbbbbbbbwb', '..bbbbbbbbbbbb..'],
  legs: [['..dd..dd..dd.dd.', '..dd..dd..dd.dd.'], ['.dd...dd.dd..dd.', '.dd...dd.dd..dd.']] };
const SPIDER = { top: ['....aaaa........', '..aaAAAAaa......', '.aaAAaaAAaa.hh..', '.aAAAAAAAAahhhe.', '.aaAAAAAAaahhee.', '..aaaaaaaa.hhh..'],
  legs: [['.l.l.l.l..l.l.l.', 'l.l.l.l..l.l.l.l'], ['l.l.l.l..l.l.l.l', '.l.l.l.l..l.l.l.']] };
const HORSE = { top: ['............hh....', '...........hhhh...', '..........hhhhhe..', 't........hhhhhhhn.', 'tt..bbbbbbbbhh....', '.tbbbbbbbbbbbh....', '..bbbbbbbbbbbb....', '..bbbbbbbbbbb.....'],
  legs: [['..ll..ll..ll.ll...', '..ll..ll..ll.ll...', '..l...l....l..l...', '..k...k....k..k...'], ['...ll.ll...ll.ll..', '...l..l....l...l..', '...l..l....l...l..', '...k..k....k...k..']] };
const DRAGON = { top: ['..................hh........', '.................hhhh.......', '........ww......hhhhhhe.....', '.......wwww....hhhhhhhhhn...', '......wwwwww...hhhhh........',
  '.....wwwwwwww.bbbbb.........', '....wwwwwwwwwbbbbbb.........', '...wwwwwwwwbbbbbbbb.........', '..t...wwwbbbbbbbbbb.........', '.tt....bbbbbbbbbbbb.........', 'tt....bbbbbbbbbbbbb.........',
  't....bbbBBBBBBBbbbb.........', '....bbbBBBBBBBBbbb..........', '....bbbbbbbbbbbbb...........'],
  legs: [['.....ll..ll..ll..ll.........', '.....ll..ll..ll..ll.........', '.....kk..kk..kk..kk.........'], ['......ll.ll...ll.ll.........', '......ll.ll...ll.ll.........', '......kk.kk...kk.kk.........']] };
const PAL = {
  m_cheval: { h: '#7a4a28', b: '#8a5a32', e: '#1a1008', n: '#3a2414', t: '#3a2414', l: '#6a4024', k: '#2a1a0e' },
  m_spectre: { h: '#cfe4ff', b: '#a8c8f0', e: '#3a6aff', n: '#6a8ab8', t: '#e6f3ff', l: '#8aaad8', k: '#6a8ab8' },
  m_loup: { g: '#7a7a82', G: '#a9a9b0', e: '#f2d04a', n: '#1b1b1f', d: '#3a3a40' },
  dragon: { b: '#a8401a', B: '#e0a040', w: '#6a1e10', h: '#b84a1e', e: '#ffe040', n: '#2a0a00', t: '#8a3010', l: '#7a2a10', k: '#3a1208' },
  guerrier: { h: '#5a3a22', s: '#f1c49a', e: '#2a1a10', b: '#a8342c', d: '#6b1f1a', g: '#d9a441', l: '#4a3a2e', k: '#2b211b' },
  archere:  { h: '#e8bf52', s: '#f3cda6', e: '#2a1a10', b: '#3f8a4a', d: '#24572e', g: '#7a4f2a', l: '#5b4632', k: '#2b211b' },
  mage:     { h: '#dcdcee', s: '#efc39c', e: '#2a1a10', b: '#4a4fb0', d: '#2c2f75', g: '#e2c35a', l: '#383c94', k: '#1d1d40' },
  squelette:{ h: '#e8e2cc', s: '#e8e2cc', e: '#1a0f0f', b: '#cfc7ad', d: '#7d7563', g: '#4a3f36', l: '#d6cfb6', k: '#bdb59c' },
  roi:      { h: '#3a1748', s: '#e8e2cc', e: '#ff5a20', b: '#4a1f5a', d: '#2a1035', g: '#f0c23a', l: '#3a1748', k: '#20102a' },
  spectre:  { h: '#cfe8ff', s: '#e6f3ff', e: '#3a6aff', b: '#a8c8f0', d: '#6a8ab8', g: '#e6f3ff', l: '#8aaad8', k: '#6a8ab8' },
  golem:    { h: '#7a7468', s: '#8e887a', e: '#ffb030', b: '#6e685c', d: '#4e4a42', g: '#9ad0e0', l: '#6e685c', k: '#4e4a42' },
  golemroi: { h: '#5a6a7a', s: '#7a8a9a', e: '#40e0ff', b: '#4e5a68', d: '#2e3640', g: '#40e0ff', l: '#4e5a68', k: '#2e3640' },
  ombre:    { h: '#2a1a3a', s: '#3a2a4e', e: '#ff40a0', b: '#24183a', d: '#140c22', g: '#6a3aa0', l: '#24183a', k: '#140c22' },
  gardien:  { h: '#5a0a14', s: '#8a2a2a', e: '#ffd040', b: '#3a0a12', d: '#1e0508', g: '#d0a040', l: '#3a0a12', k: '#1e0508' },
  forge:    { h: '#2a2420', s: '#d9a67c', e: '#1a1010', b: '#6b5845', d: '#3e3226', g: '#9a9a9a', l: '#3a3330', k: '#1e1a18' },
  shop:     { h: '#b04a2a', s: '#f3cda6', e: '#1a1010', b: '#7a4e9a', d: '#4b2d61', g: '#d9c06a', l: '#4b2d61', k: '#2b1a35' },
  paladin:  { h: '#d8b060', s: '#f1c49a', e: '#2a1a10', b: '#c8c8d8', d: '#8a8aa0', g: '#e2b04a', l: '#6a6a80', k: '#3a3a48' },
  assassin: { h: '#24202e', s: '#e0b896', e: '#c02a3a', b: '#2e2a3a', d: '#1a1822', g: '#8a2a3a', l: '#24202e', k: '#141218' },
  druide:   { h: '#6a4a2a', s: '#f0c8a0', e: '#2a1a10', b: '#4a7a3a', d: '#2e5226', g: '#c8a050', l: '#5a4a2a', k: '#2e2416' },
  bank:     { h: '#9a9a9a', s: '#f1c49a', e: '#2a1a10', b: '#2a3a5a', d: '#1a2440', g: '#e2b04a', l: '#2a2a3a', k: '#1a1a24' },
  stable:   { h: '#c87a3a', s: '#f1c49a', e: '#2a1a10', b: '#6a8a4a', d: '#3e5a2a', g: '#8a5a2b', l: '#5a4632', k: '#2b211b' },
  quest:    { h: '#6a4a2a', s: '#f1c49a', e: '#2a1a10', b: '#4a5a7a', d: '#2a3448', g: '#d9c06a', l: '#3a4458', k: '#1e2430' },
  loup:     { g: '#8a8a8f', G: '#b9b9bd', e: '#f2d04a', n: '#1b1b1f', d: '#4a4a50' },
  loupnoir: { g: '#2e2b36', G: '#4b4757', e: '#ff4a3a', n: '#0d0c10', d: '#1a1820' },
  lougarou: { g: '#5a4030', G: '#7a5a40', e: '#ffd030', n: '#1a1008', d: '#3a2818' },
  sanglier: { b: '#7a5434', D: '#4e3220', e: '#1a1010', p: '#d48a7a', w: '#f2ead2', d: '#3b2616' },
  ours:     { b: '#5b3a22', D: '#3b2414', e: '#0f0a08', p: '#2a1a10', w: '#5b3a22', d: '#2a1a10' },
  araignee: { a: '#2a2230', A: '#4a3a5a', h: '#1e1824', e: '#ff3030', l: '#1a1420' },
};
const MSPR = { dragon: 'dragon', loup: 'wolf', loupnoir: 'wolf', lougarou: 'wolf', sanglier: 'boar', ours: 'boar', araignee: 'spider' };
function tintPal(base, tint) {
  const out = {}, [th, ts, lift = 0] = tint;
  for (const [k, hex] of Object.entries(base)) {
    if (k === 'e') { out[k] = hex; continue; }
    const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let l = (mx + mn) / 2;
    l = l + lift * (1 - l);
    out[k] = `hsl(${th},${Math.round(ts * 100)}%,${Math.round(Math.min(0.95, l) * 100)}%)`;
  }
  return out;
}
function prepMonsterTypes() {
  for (const [k, mt] of Object.entries(MT)) if (mt.base) {
    if (MSPR[mt.base]) MSPR[k] = MSPR[mt.base];
    if (PAL[mt.base]) PAL[k] = mt.tint ? tintPal(PAL[mt.base], mt.tint) : PAL[mt.base];
  }
}
const spriteCache = new Map();
function sprite(key, rows, pal, white) {
  const k = key + (white ? '#w' : '');
  let c = spriteCache.get(k); if (c) return c;
  const wmax = Math.max(...rows.map(r => r.length)); rows = rows.map(r => r.padEnd(wmax, '.'));
  if (spriteCache.size > 600) spriteCache.clear();
  c = document.createElement('canvas'); c.width = wmax; c.height = rows.length;
  const g = c.getContext('2d');
  rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const ch = row[x]; if (ch === '.') continue; g.fillStyle = white ? '#fff' : (pal[ch] || '#f0f'); g.fillRect(x, y, 1, 1); } });
  spriteCache.set(k, c); return c;
}
const RAR_COL = ['#c8c0b0', '#6ad06a', '#5aa0ff', '#c070ff', '#ffa030', '#e8f4ff', '#ff4a5a'];
const rarColor = r => r === 5 ? `hsl(${(performance.now() / 8) % 360},90%,68%)` : (RAR_COL[r] || RAR_COL[0]);
const WEAPON_OF = { guerrier: 'sword', archere: 'bow', mage: 'staff', paladin: 'mace', assassin: 'daggers', druide: 'nstaff' };
const ICONS = {
  casque: ['..aaaaaa..', '.aAAAAAAa.', 'aAAAAAAAAa', 'aAAaaaaAAa', 'aAa....aAa', 'aAa....aAa', 'aa......aa'],
  armure: ['.aa....aa.', 'aAAa..aAAa', 'aAAAaaAAAa', '.aAAAAAAa.', '.aAAAAAAa.', '.aAAAAAAa.', '.aAAAAAAa.', '..aaaaaa..'],
  anneau: ['...aGGa...', '..aGGGGa..', '...aaaa...', '..aAAAAa..', '.aA....Aa.', '.aA....Aa.', '..aAAAAa..', '...aaaa...'],
  amulette: ['a........a', '.a......a.', '..a....a..', '...aGGa...', '..aGGGGa..', '..aGGGGa..', '...aGGa...', '....aa....'],
  gants: ['.a.a.a....', 'aAaAaAa...', 'aAAAAAAa..', 'aAAAAAAAa.', 'aAAAAAAAa.', '.aAAAAAa..', '..aAAAa...', '..aaaaa...'],
  bottes: ['..aaaa....', '..aAAa....', '..aAAa....', '..aAAa....', '..aAAAaa..', '.aAAAAAAa.', '.aAAAAAAAa', '.aaaaaaaaa'],
  cape: ['..aaaaaa..', '.aGAAAAGa.', '.aAAAAAAa.', 'aAAAAAAAAa', 'aAAAAAAAAa', 'aAAAAAAAAa', 'aAAaAAaAAa', 'aaa.aa.aaa'],
  ceinture: ['..........', 'aaaaaaaaaa', 'AAAAaGGaAA', 'AAAAaG.aAA', 'AAAAaGGaAA', 'aaaaaaaaaa'],
  w_bow: ['..aa......', '.aAa......', '.aA.a.....', 'aA...a....', 'aA....a...', 'aA...a....', '.aA.a.....', '.aAa......', '..aa......'],
  w_staff: ['......aGGa', '.....aGGGa', '......aGa.', '.....aAa..', '....aAa...', '...aAa....', '..aAa.....', '.aAa......', 'aAa.......', 'aa........'],
  w_mace: ['......aaa.', '.....aAAAa', '.....aAAAa', '....aaAAa.', '...aAa.a..', '..aAa.....', '.aAa......', 'aAa.......', 'aa........'],
  w_daggers: ['a........a', 'Aa......aA', '.Aa....aA.', '..Aa..aA..', '...aaaa...', '..aG..Ga..', '.aG....Ga.', '..........'],
  arme: ['........aa', '.......aAa', '......aAa.', '.....aAa..', '..a.aAa...', '...aAa....', '...aa.....', '..a..a....', '.a........'],
};
const iconCache = new Map();
const iconKey = it => it.s !== 'arme' ? it.s : ({ bow: 'w_bow', staff: 'w_staff', nstaff: 'w_nstaff', mace: 'w_mace', daggers: 'w_daggers' }[WEAPON_OF[it.c]] || 'arme');
// Icône d'objet : la matière du palier et la couleur d'accent du nom de panoplie
const tierOfL = L => { const lo = (ITEMDEF && ITEMDEF.tierLo) || [1, 7, 13, 19, 25, 41, 101, 301]; let t = 0; lo.forEach((v, i) => { if (L >= v) t = i; }); return t; };
const accOfItem = it => { if (!it.set || !ITEMDEF) return 0; const r = it.r, si = it.set.k % 10; let off = 0; for (let i = 1; i < r; i++) off += ITEMDEF.suffix[i].length; return 1 + off + si; };
function icon(slot, r, t = -1, acc = 0) {
  const k = slot + r + '|' + t + '|' + acc; if (iconCache.has(k)) return iconCache.get(k);
  if (iconCache.size > 800) iconCache.clear();
  const c = document.createElement('canvas'); let u;
  if (slot.startsWith('w_') || slot === 'arme') {
    c.width = 20; c.height = 20; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    const kind = { w_bow: 'bow', w_staff: 'staff', w_nstaff: 'nstaff', w_mace: 'mace', w_daggers: 'dagger' }[slot] || 'sword';
    const im = kind === 'bow' ? bowSprite(0, t, acc) : wpnSprite(kind, t, acc);
    g.translate(10, 10); g.rotate(kind === 'bow' ? 0.5 : 0.785); g.drawImage(im, -im.width / 2, -im.height / 2 - (kind === 'bow' ? 0 : 2));
    if (kind === 'dagger') { g.rotate(-1.57); g.drawImage(im, -im.width / 2 - 2, -im.height / 2); }
  } else {
    c.width = 10; c.height = 10; const g = c.getContext('2d');
    const rows = ICONS[slot] || ICONS.casque, M = t >= 0 ? MAT[t] : null;
    const main = M ? (['cape'].includes(slot) && acc ? accBase(acc) : M.c) : (r === 5 ? '#ffffff' : (RAR_COL[r] || RAR_COL[0]));
    const pal = { a: '#1a120c', A: main, G: acc ? accAt(acc, 3, 3) : (M && M.trim) || (r >= 3 ? '#ff5a7a' : '#7ad0ff') };
    rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] !== '.') { g.fillStyle = row[x] === 'A' && M && (x + y) % 5 === 0 ? M.h : pal[row[x]]; g.fillRect(x, y + (10 - rows.length >> 1), 1, 1); } });
    if (M && M.glow) { g.fillStyle = M.glow; g.fillRect(4, 5, 1, 1); }
  }
  u = c.toDataURL(); iconCache.set(k, u); return u;
}

/* ============================================================
   État
   ============================================================ */
let ws = null, myId = 0, W = 0, H = 0, WORLD_H = 104, map = null, miniBase = null;
const chunks = new Map(); const CH = 32;
let ITEMDEF = null;
let NPCS = [], WAYPOINTS = [], CLASSES = {}, MT = {}, SLOT_NAMES = {}, RAR_NAMES = [], INV_SIZE = 20, LOCAL = false, myName = '';
let joined = false, wantJoin = null, potionCost = 15;
const ents = new Map();
let drops = [];
const me = { lx: 0, ly: 0, has: false, st: null, dir: 0, cls: 'guerrier', inv: [], eq: {} };
const particles = [], texts = [], shapes = [], emotes = new Map();
let S = 3, dpr = 1, camPx = 0, camPy = 0, time = 0;

/* ============================================================
   Carte
   ============================================================ */
function hash(x, y, s = 0) { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function tileAt(x, y) { if (x < 0 || y < 0 || x >= W || y >= H) return T.TREE; return map[y * W + x]; }

function drawTile(g, tx, ty, frame) {
  const t = tileAt(tx, ty), ox = tx * TS, oy = ty * TS;
  let n = 0; const r = () => hash(tx, ty, n++);
  const px = (x, y, c, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(ox + x, oy + y, w, h); };
  const speck = (base, cols, count) => { px(0, 0, base, 16, 16); for (let i = 0; i < count; i++) px(r() * 16 | 0, r() * 16 | 0, cols[r() * cols.length | 0]); };
  const grass = kind => {
    if (kind === 'marsh') { speck('#3d5a3a', ['#34503a', '#4a6a44', '#2e4632'], 24); return; }
    const dark = kind;
    speck(dark ? '#2f6b34' : '#4a8f3c', dark ? ['#27592c', '#3a7a3c', '#245028'] : ['#3f7f34', '#5aa046', '#447f37'], 22);
    for (let i = 0; i < 2; i++) { const x = r() * 14 | 0, y = r() * 13 | 0; px(x, y, dark ? '#4a8a48' : '#6cb455', 1, 2); px(x + 1, y + 1, dark ? '#4a8a48' : '#6cb455', 1, 2); }
  };
  const water = (deep, light, foam) => {
    px(0, 0, deep, 16, 16);
    for (let i = 0; i < 3; i++) px(0, (i * 6 + ty * 3 + frame * 2) % 16, light, 16, 2);
    for (let i = 0; i < 3; i++) { const x = (hash(tx, ty, i + frame * 10) * 12) | 0, y = (hash(tx, ty, i + 5 + frame * 10) * 15) | 0; px(x, y, foam, 3, 1); }
  };
  const under = () => { const z = zoneAt(tx, ty); const gt = z ? BIOME_GROUND[z.bi] : T.GRASS;
    if (gt === T.SAND) speck('#dcc68f', ['#cdb57c', '#ead7a4'], 22); else if (gt === T.SNOW) speck('#e6edf4', ['#d2dce8', '#ffffff', '#c4d0de'], 22);
    else if (gt === T.ASH) speck('#3a3432', ['#2e2826', '#4a423e'], 26); else if (gt === T.VOID) speck('#1e1a2e', ['#2a2440', '#16122a'], 22);
    else if (gt === T.MARSH) grass('marsh'); else if (gt === T.DGRASS) grass(true); else grass(false); };
  switch (t) {
    case T.DECO: case T.DECOS: {
      under();
      const z = zoneAt(tx, ty); if (!z || !z.props) break;
      const list = t === T.DECOS ? z.props.s : z.props.w, name = list[(hash(tx, ty, 77) * list.length) | 0];
      drawProp(g, ox, oy, name, z, r, px);
      break;
    }
    case T.SNOW: speck('#e6edf4', ['#d2dce8', '#ffffff', '#c4d0de'], 22); if (r() < 0.3) px(r() * 13 | 0, r() * 13 | 0, '#b8c6d8', 3, 1); break;
    case T.ASH: speck('#3a3432', ['#2e2826', '#4a423e', '#332c2a'], 26); if (r() < 0.12) px(r() * 14 | 0, r() * 14 | 0, '#ff7a2a'); break;
    case T.VOID: speck('#1e1a2e', ['#2a2440', '#16122a', '#241e38'], 22); if (r() < 0.15) px(r() * 15 | 0, r() * 15 | 0, '#8a6aff'); if (r() < 0.06) px(r() * 15 | 0, r() * 15 | 0, '#e0d0ff'); break;
    case T.LAVA:
      water('#b8321a', '#d8501a', '#ffc04a');
      if (tileAt(tx, ty - 1) !== T.LAVA) { px(0, 0, '#2a1a14', 16, 1); px(0, 1, '#ff8a2a', 16, 1); }
      break;
    case T.ICE: {
      px(0, 0, '#9ad4f0', 16, 16); px(0, 0, '#c8ecff', 16, 2); px(0, 12, '#6aa8d0', 16, 4);
      for (let i = 0; i < 3; i++) px(2 + r() * 10 | 0, 3 + r() * 7 | 0, '#e8f8ff', 3, 1);
      break;
    }
    case T.ROCK: {
      under();
      g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(ox + 8, oy + 14, 7, 2.5, 0, 0, 7); g.fill();
      const z = zoneAt(tx, ty), dark = z && (z.bi === 5 || z.bi === 6);
      const c1 = dark ? '#3a3036' : '#7a7468', c2 = dark ? '#524650' : '#9a9486', c3 = dark ? '#241e24' : '#5a554c';
      px(2, 5, c1, 12, 9); px(3, 3, c1, 9, 2); px(4, 2, c2, 6, 2); px(3, 5, c2, 4, 3); px(9, 9, c3, 5, 5); px(2, 12, c3, 12, 2);
      if (z && z.bi === 4) px(3, 2, '#ffffff', 8, 2);
      break;
    }
    case T.CACTUS: {
      under();
      g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(ox + 8, oy + 14, 5, 2, 0, 0, 7); g.fill();
      px(7, 2, '#3a8a3a', 3, 12); px(8, 2, '#5aaa4a', 1, 12); px(3, 6, '#3a8a3a', 2, 4); px(3, 9, '#3a8a3a', 4, 2); px(11, 4, '#3a8a3a', 2, 4); px(9, 7, '#3a8a3a', 4, 2);
      px(8, 1, '#ff6a8a', 1, 1);
      break;
    }
    case T.DEADTREE: {
      under();
      g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(ox + 8, oy + 14, 6, 2.2, 0, 0, 7); g.fill();
      const z = zoneAt(tx, ty), c = z && z.bi === 5 ? '#1e1614' : '#4a3a2e', hi = z && z.bi === 5 ? '#3a2a24' : '#6a5440';
      px(7, 4, c, 2, 11); px(7, 4, hi, 1, 11); px(4, 3, c, 1, 4); px(4, 6, c, 3, 1); px(10, 2, c, 1, 5); px(9, 6, c, 2, 1); px(5, 1, c, 1, 2); px(11, 1, c, 2, 1);
      break;
    }
    case T.PINE: {
      under();
      g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(ox + 8, oy + 14, 6, 2.2, 0, 0, 7); g.fill();
      px(7, 12, '#5a3b22', 2, 3);
      for (let y = 0; y < 12; y++) { const w = Math.floor(y / 1.6) + 1, x = 8 - w; px(x, y, '#1f4a36', w * 2, 1); if (y % 4 === 1) px(x, y, '#ffffff', w * 2, 1); else px(x, y, '#2e6a4a', Math.max(1, w - 1), 1); }
      break;
    }
    case T.GRASS: grass(false); break;
    case T.DGRASS: grass(true); break;
    case T.MARSH: grass('marsh'); if (r() < 0.3) px(r() * 12 | 0, r() * 12 | 0, '#5a7a4a', 3, 2); break;
    case T.REED: grass('marsh'); for (let i = 0; i < 5; i++) { const x = 2 + r() * 12 | 0, h = 5 + r() * 5 | 0; px(x, 15 - h, '#7a8a4a', 1, h); px(x, 14 - h, '#6a4a2a', 1, 2); } break;
    case T.FLOWER: {
      grass(false);
      const cols = ['#fff3f0', '#ff6b6b', '#c08cff', '#ffd84a'];
      for (let i = 0; i < 3; i++) { const x = 2 + r() * 11 | 0, y = 2 + r() * 11 | 0, c = cols[r() * 4 | 0]; px(x - 1, y, c); px(x + 1, y, c); px(x, y - 1, c); px(x, y + 1, c); px(x, y, '#ffe36a'); }
      break;
    }
    case T.PATH: speck('#b39468', ['#9c7f56', '#c8ab7e', '#a88a5e'], 28); if (r() < 0.5) px(r() * 13 | 0, r() * 13 | 0, '#8a7656', 2, 2); break;
    case T.SAND: speck('#dcc68f', ['#cdb57c', '#ead7a4'], 22); break;
    case T.STONE: {
      px(0, 0, '#6f6a62', 16, 16);
      const off = (ty % 2) * 4;
      for (let row = 0; row < 3; row++) for (let col = -1; col < 3; col++) {
        const x = col * 8 + off + (row % 2) * 4, y = row * 5 + 1;
        const shade = ['#948f84', '#8a857a', '#9e998d'][(hash(tx * 3 + col, ty * 3 + row) * 3) | 0];
        const x0 = Math.max(0, x), x1 = Math.min(16, x + 7);
        if (x1 > x0) { px(x0, y, shade, x1 - x0, 4); px(x0, y, '#aaa598', x1 - x0, 1); }
      }
      break;
    }
    case T.WATER:
      water('#2f6fbf', '#2b66b0', '#7fb2ea');
      if (tileAt(tx, ty - 1) !== T.WATER) { px(0, 0, '#a8d4f5', 16, 1); px(0, 1, '#5d9be0', 16, 1); }
      if (tileAt(tx - 1, ty) !== T.WATER) px(0, 0, '#5d9be0', 1, 16);
      if (tileAt(tx + 1, ty) !== T.WATER) px(15, 0, '#5d9be0', 1, 16);
      break;
    case T.BOG:
      water('#2c4a36', '#284430', '#5a8a5a');
      if (tileAt(tx, ty - 1) !== T.BOG) { px(0, 0, '#6a8a5a', 16, 1); px(0, 1, '#3a5a3a', 16, 1); }
      if (hash(tx, ty, 9) < 0.25) { px(5, 6, '#3a7a3a', 5, 3); px(6, 5, '#4a9a4a', 3, 1); }
      break;
    case T.TREE: {
      const zt = zoneAt(tx, ty), marsh = (ty >= 74 && tx <= 45 && tx < KW) || (zt && zt.bi === 3), dark = tx >= 68 || ty === 0 || ty === WORLD_H - 1 || marsh;
      if (zt && zt.bi !== 2 && zt.bi !== 0) under(); else grass(marsh ? 'marsh' : dark);
      g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(ox + 8, oy + 14, 7, 2.5, 0, 0, 7); g.fill();
      px(7, 10, '#5a3b22', 3, 5); px(7, 10, '#704a2b', 1, 5);
      const base = marsh ? '#3a4a2a' : dark ? '#1f4f26' : '#2d6b2f', hi = marsh ? '#5a6a3a' : dark ? '#2f6b34' : '#4a9a44', lo = marsh ? '#2a3420' : dark ? '#163a1b' : '#1d4a22';
      const cx = 8.5, cy = 4 + (r() * 2 | 0);
      for (let y = -6; y <= 6; y++) for (let x = -7; x <= 7; x++) {
        const d = (x * x) / 49 + (y * y) / 36 + (hash(tx * 16 + x, ty * 16 + y) - 0.5) * 0.25;
        if (d > 1) continue;
        let c = base; if (y < -1 && x < 2 && d < 0.75) c = hi; if (y > 2 || d > 0.85) c = lo;
        if (hash(tx * 16 + x, ty * 16 + y, 3) < 0.08) c = hi;
        px(Math.floor(cx + x), Math.floor(cy + y), c);
      }
      break;
    }
    case T.DFLOOR: case T.AFLOOR: {
      const red = t === T.AFLOOR;
      px(0, 0, red ? '#3a2630' : '#3a3546', 16, 16);
      const ln = red ? '#2a1820' : '#2c2836';
      px(0, 7, ln, 16, 1); px((ty % 2) * 8, 0, ln, 1, 7); px(((ty + 1) % 2) * 8 + 4, 8, ln, 1, 8);
      for (let i = 0; i < 6; i++) px(r() * 16 | 0, r() * 16 | 0, r() < 0.5 ? (red ? '#4a3040' : '#433d52') : (red ? '#301c26' : '#312c3d'));
      if (!red && r() < 0.12) px(3 + r() * 8 | 0, 3 + r() * 8 | 0, '#3d5a36', 3, 2);
      if (red && r() < 0.06) px(3 + r() * 8 | 0, 3 + r() * 8 | 0, '#8a2a3a', 2, 1);
      break;
    }
    case T.MFLOOR: speck('#4a4038', ['#3e352e', '#564a40', '#40372f'], 30); if (r() < 0.2) px(r() * 13 | 0, r() * 13 | 0, '#2e2620', 3, 2); break;
    case T.MWALL: case T.CRYSTAL: {
      px(0, 0, '#3a322c', 16, 16);
      for (let i = 0; i < 5; i++) { const x = r() * 12 | 0, y = r() * 10 | 0; px(x, y, '#4e443c', 4 + r() * 3 | 0, 3); px(x, y, '#5e544a', 3, 1); }
      if (tileAt(tx, ty + 1) !== T.MWALL && tileAt(tx, ty + 1) !== T.CRYSTAL) px(0, 12, '#1e1814', 16, 4);
      if (t === T.CRYSTAL) { px(6, 3, '#40c8e8', 3, 9); px(4, 6, '#2a90c0', 2, 6); px(10, 5, '#2a90c0', 2, 7); px(7, 3, '#bff4ff', 1, 4); }
      break;
    }
    case T.DWALL: case T.PILLAR: {
      if (t === T.PILLAR) {
        px(0, 0, ty >= WORLD_H ? '#3a2630' : '#3a3546', 16, 16);
        g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(ox + 3, oy + 13, 12, 3);
        px(4, 2, '#6d6680', 8, 12); px(4, 2, '#857d99', 2, 12); px(10, 2, '#544e63', 2, 12); px(3, 0, '#9a92ae', 10, 3); px(3, 13, '#4b4559', 10, 2);
      } else {
        px(0, 0, '#4b4459', 16, 16);
        for (let row = 0; row < 4; row++) { px(0, row * 4 + 3, '#2a2533', 16, 1); px(((row + tx) % 2) * 8 + 3, row * 4, '#2a2533', 1, 3); }
        px(0, 0, '#5d556d', 16, 1);
        if (tileAt(tx, ty + 1) !== T.DWALL) px(0, 12, '#1c1924', 16, 4);
      }
      break;
    }
    case T.ROOF: {
      px(0, 0, '#a5463b', 16, 16);
      for (let row = 0; row < 4; row++) { px(0, row * 4 + 3, '#7e3129', 16, 1); for (let c = 0; c < 3; c++) px(((row % 2) * 3 + c * 6 + 2) % 16, row * 4, '#7e3129', 1, 3); }
      if (tileAt(tx, ty - 1) !== T.ROOF) px(0, 0, '#c25a4b', 16, 2);
      if (tileAt(tx - 1, ty) !== T.ROOF) px(0, 0, '#6a2820', 1, 16);
      if (tileAt(tx + 1, ty) !== T.ROOF) px(15, 0, '#6a2820', 1, 16);
      break;
    }
    case T.WALL: case T.DOOR: {
      px(0, 0, '#d2b07e', 16, 16);
      for (let i = 0; i < 8; i++) px(r() * 16 | 0, r() * 16 | 0, '#c49f6b');
      px(0, 0, '#5c3b22', 16, 2); px(0, 14, '#5c3b22', 16, 2);
      if (tileAt(tx - 1, ty) !== T.WALL && tileAt(tx - 1, ty) !== T.DOOR) px(0, 0, '#5c3b22', 2, 16);
      if (tileAt(tx + 1, ty) !== T.WALL && tileAt(tx + 1, ty) !== T.DOOR) px(14, 0, '#5c3b22', 2, 16);
      if (t === T.DOOR) { px(4, 3, '#4a2c16', 8, 11); px(5, 4, '#6b4426', 6, 10); px(8, 4, '#4a2c16', 1, 10); px(9, 9, '#e2b04a', 1, 1); }
      else if ((tx + ty) % 2 === 0) { px(4, 4, '#5c3b22', 8, 7); px(5, 5, '#3b5a7a', 6, 5); px(5, 5, '#6c94bd', 2, 2); px(8, 5, '#5c3b22', 1, 5); }
      break;
    }
  }
}
const ANIM = new Set([T.WATER, T.BOG, T.LAVA]);
function getChunk(cx, cy, frame) {
  const key = cx + ',' + cy;
  let c = chunks.get(key);
  if (c) { chunks.delete(key); chunks.set(key, c); }
  else {
    const x0 = cx * CH, y0 = cy * CH, x1 = Math.min(W, x0 + CH), y1 = Math.min(H, y0 + CH);
    let anim = false; for (let y = y0; y < y1 && !anim; y++) for (let x = x0; x < x1; x++) if (ANIM.has(tileAt(x, y))) { anim = true; break; }
    const mk = f => {
      const cv2 = document.createElement('canvas'); cv2.width = (x1 - x0) * TS; cv2.height = (y1 - y0) * TS; const g = cv2.getContext('2d'); g.translate(-x0 * TS, -y0 * TS);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) drawTile(g, x, y, f);
      // chaque région a sa propre ambiance de couleur
      for (const z of ZONES) {
        if (!z.tint || z.x1 < x0 || z.x0 >= x1 || z.y1 < y0 || z.y0 >= y1) continue;
        const ax = Math.max(x0, z.x0), ay = Math.max(y0, z.y0), bx = Math.min(x1, z.x1 + 1), by = Math.min(y1, z.y1 + 1);
        g.save(); g.globalCompositeOperation = z.tier === 4 ? 'saturation' : 'color'; g.globalAlpha = z.tier === 4 ? 0.55 : z.tier === 6 ? 0.22 : 0.28;
        g.fillStyle = z.tint; g.fillRect(ax * TS, ay * TS, (bx - ax) * TS, (by - ay) * TS); g.restore();
      }
      return cv2;
    };
    const f0 = mk(0);
    c = [f0, anim ? mk(1) : f0];
    chunks.set(key, c);
    while (chunks.size > 40) chunks.delete(chunks.keys().next().value);
  }
  return c[frame];
}
const MC = { 0: '#4a8f3c', 1: '#1f4a22', 2: '#2f6fbf', 3: '#b39468', 4: '#8f8a80', 5: '#a5463b', 6: '#4a8f3c', 7: '#2f6b34', 8: '#3a3546', 9: '#22202b',
  10: '#a5463b', 11: '#dcc68f', 12: '#a5463b', 13: '#22202b', 14: '#3d5a3a', 15: '#2c4a36', 16: '#4a6a3a', 17: '#4a4038', 18: '#2a2420', 19: '#40c8e8', 20: '#3a2630',
  21: '#e6edf4', 22: '#9ad4f0', 23: '#3a3432', 24: '#e0601a', 25: '#1e1a2e', 26: '#3a8a3a', 27: '#6a655c', 28: '#4a3a2e', 29: '#1f4a36', 30: '#5a8a4a', 31: '#8a8070' };
// éléments de décor (un jeu différent dans chaque région)
const PROP_TINT = ['#c8a060', '#e0c080', '#6a8a5a', '#5a7a5a', '#c8d8e8', '#5a4a48', '#6a4aa0'];
function drawProp(g, ox, oy, name, z, r, px) {
  const sh = () => { g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(ox + 8, oy + 14, 6, 2.2, 0, 0, 7); g.fill(); };
  const acc = ['#e0424a', '#e2b04a', '#7a50c0', '#c02a2a', '#8a9098', '#30c0d0', '#f4f0ff'][z.tier] || '#e2b04a';
  const stone = ['#9a958a', '#c8b890', '#7a8a7a', '#6a7060', '#b8c8d8', '#4a4040', '#4a3a6a'][z.bi], stD = shade(stone, -0.3), stH = shade(stone, 0.25);
  switch (name) {
    case 'ruine': sh(); px(4, 2, stone, 5, 12); px(4, 2, stH, 2, 12); px(9, 6, stone, 3, 8); px(3, 13, stD, 10, 2); px(5, 1, stone, 3, 1); px(10, 9, stD, 2, 1); px(6, 6, stD, 1, 2); break;
    case 'statue': sh(); px(5, 11, stD, 6, 3); px(6, 5, stone, 4, 6); px(6, 1, stone, 4, 4); px(6, 1, stH, 4, 1); px(4, 6, stone, 2, 4); px(10, 6, stone, 2, 4); px(7, 3, stD, 1, 1); px(9, 3, stD, 1, 1); px(10, 0, acc, 1, 4); break;
    case 'totem': sh(); px(6, 0, '#7a4a24', 4, 14); px(6, 1, acc, 4, 2); px(7, 4, '#1a1010', 1, 1); px(8, 4, '#1a1010', 1, 1); px(6, 7, '#e0c080', 4, 1); px(4, 2, '#d04040', 2, 2); px(10, 2, '#4080d0', 2, 2); px(6, 10, acc, 4, 1); break;
    case 'tente': sh(); for (let i = 0; i < 9; i++) px(8 - i * 0.8 | 0, 3 + i, acc, (i * 1.6 | 0) + 1, 1); px(7, 8, '#2a1a10', 2, 4); px(8, 1, '#5a3a20', 1, 3); px(9, 1, acc, 2, 1); break;
    case 'souche': sh(); px(4, 8, '#6a4a2a', 8, 6); px(4, 7, '#a07a4a', 8, 2); px(6, 8, '#7a5a3a', 4, 1); px(3, 13, '#5a3a20', 2, 1); px(11, 13, '#5a3a20', 2, 1); px(10, 9, '#5ac84a', 2, 1); break;
    case 'brasero': sh(); px(5, 9, '#5a5a62', 6, 3); px(7, 12, '#4a4a52', 2, 2); px(5, 4, '#ff8a2a', 6, 5); px(6, 2, '#ffd040', 4, 3); px(7, 1, '#fff0a0', 2, 2); break;
    case 'obelisque': sh(); px(6, 0, stD, 4, 14); px(6, 0, stone, 2, 14); px(7, -2, stone, 2, 2); px(7, 3, acc, 2, 1); px(7, 6, acc, 2, 1); px(7, 9, acc, 2, 1); px(5, 13, stD, 6, 1); break;
    case 'crane': sh(); px(3, 6, '#e8e0cc', 10, 7); px(4, 5, '#f4ecd8', 8, 1); px(5, 8, '#1a1010', 2, 2); px(9, 8, '#1a1010', 2, 2); px(4, 12, '#1a1010', 8, 1); for (let x = 4; x < 12; x += 2) px(x, 12, '#f4ecd8', 1, 1); px(2, 3, '#e8e0cc', 2, 3); px(12, 3, '#e8e0cc', 2, 3); break;
    case 'cotes': sh(); for (let i = 0; i < 4; i++) { px(3 + i * 3, 4 + (i % 2), '#e8e0cc', 1, 9 - (i % 2)); px(4 + i * 3, 3 + (i % 2), '#e8e0cc', 1, 1); } px(2, 12, '#d8d0bc', 12, 2); break;
    case 'oeufs': sh(); for (const [x, y, c] of [[3, 7, acc], [8, 5, shade(acc, 0.3)], [6, 9, shade(acc, -0.2)]]) { px(x, y, c, 4, 5); px(x + 1, y - 1, c, 2, 1); px(x + 1, y + 1, '#ffffff', 1, 1); } break;
    case 'champi': sh(); px(6, 8, '#f0e6d0', 4, 6); px(2, 4, acc, 12, 4); px(3, 3, acc, 10, 1); px(5, 2, acc, 6, 1); px(4, 4, '#ffffff', 2, 2); px(9, 3, '#ffffff', 2, 1); px(11, 6, '#ffffff', 1, 1); px(2, 8, shade(acc, -0.35), 12, 1); break;
    case 'cocon': sh(); px(5, 2, '#e8e8e8', 6, 11); px(4, 4, '#e8e8e8', 8, 7); for (let y = 3; y < 13; y += 2) px(4, y, '#c8c8c8', 8, 1); px(7, 0, '#d0d0d0', 1, 2); break;
    case 'arche': sh(); px(2, 2, stone, 3, 12); px(11, 2, stone, 3, 12); px(2, 1, stone, 12, 3); px(2, 1, stH, 12, 1); px(6, 2, acc, 4, 1); px(3, 6, acc, 1, 1); px(12, 9, acc, 1, 1); break;
    case 'tombe': sh(); px(5, 3, stone, 6, 10); px(6, 2, stone, 4, 1); px(5, 3, stH, 1, 10); px(7, 5, stD, 2, 5); px(6, 6, stD, 4, 1); px(4, 13, '#4a3a2a', 8, 1); break;
    case 'pic': sh(); for (let i = 0; i < 12; i++) px(8 - (i >> 2), 1 + i, '#bfe8ff', 1 + (i >> 1), 1); px(7, 3, '#ffffff', 1, 8); px(3, 8, '#9ad4f0', 2, 6); px(11, 9, '#9ad4f0', 2, 5); break;
    case 'cristal': sh(); for (const [x, h, c] of [[4, 8, acc], [7, 12, shade(acc, 0.2)], [10, 7, shade(acc, -0.15)]]) { px(x, 14 - h, c, 3, h); px(x + 1, 13 - h, c, 1, 1); px(x, 14 - h, '#ffffff', 1, 2); } break;
    case 'fumerolle': sh(); px(3, 8, '#3a3032', 10, 6); px(5, 6, '#4a4042', 6, 2); px(6, 5, '#ff7a2a', 4, 1); px(7, 2, 'rgba(200,200,200,.5)', 2, 3); px(6, 0, 'rgba(200,200,200,.35)', 3, 2); break;
    case 'colonne': sh(); px(5, 0, '#2a2240', 6, 12); px(5, 0, '#4a3a6a', 2, 12); px(6, 3, acc, 4, 1); px(6, 8, acc, 4, 1); px(4, -2, '#3a3050', 8, 2); break;
    case 'os': for (const [x, y] of [[3, 9], [9, 5]]) { px(x, y, '#e8e0cc', 5, 1); px(x - 1, y - 1, '#e8e0cc', 1, 1); px(x - 1, y + 1, '#e8e0cc', 1, 1); px(x + 5, y - 1, '#e8e0cc', 1, 1); px(x + 5, y + 1, '#e8e0cc', 1, 1); } if (r() < 0.4) { px(6, 11, '#e8e0cc', 3, 2); px(6, 12, '#1a1010', 1, 1); } break;
    case 'fleursR': case 'fleursB': { const c1 = name === 'fleursR' ? acc : ['#5a8aff', '#a070ff', '#40c0e0', '#ffffff'][z.tier % 4]; for (let i = 0; i < 4; i++) { const x = 2 + r() * 11 | 0, y = 2 + r() * 11 | 0; px(x, y + 1, '#3a7a2a', 1, 2); px(x - 1, y, c1, 3, 1); px(x, y - 1, c1, 1, 3); px(x, y, '#ffe36a', 1, 1); } break; }
    case 'herbes': for (let i = 0; i < 6; i++) { const x = 1 + r() * 13 | 0, h = 4 + r() * 5 | 0; px(x, 15 - h, z.bi === 1 ? '#c8a060' : z.bi === 4 ? '#a8b8c8' : '#5a9a3a', 1, h); px(x + 1, 14 - h, z.bi === 1 ? '#a88040' : '#3a7a2a', 1, 2); } break;
    case 'cailloux': for (let i = 0; i < 4; i++) { const x = r() * 13 | 0, y = r() * 13 | 0; px(x, y, stone, 2 + (i % 2), 2); px(x, y, stH, 1, 1); } break;
    case 'traces': for (let i = 0; i < 3; i++) { const x = 3 + i * 4, y = 4 + (i % 2) * 5; px(x, y, 'rgba(0,0,0,.22)', 2, 2); px(x - 1, y - 1, 'rgba(0,0,0,.22)', 1, 1); px(x + 2, y - 1, 'rgba(0,0,0,.22)', 1, 1); } break;
    case 'runes': px(3, 7, acc, 10, 1); px(5, 4, acc, 1, 7); px(10, 5, acc, 1, 5); px(7, 10, acc, 3, 1); px(8, 3, '#ffffff', 1, 1); break;
    case 'champis': for (let i = 0; i < 3; i++) { const x = 2 + r() * 10 | 0, y = 4 + r() * 8 | 0; px(x + 1, y + 2, '#f0e6d0', 1, 2); px(x, y, acc, 3, 2); px(x + 1, y, '#ffffff', 1, 1); } break;
    case 'toile': g.strokeStyle = 'rgba(240,240,240,.55)'; g.lineWidth = 0.6; g.beginPath(); for (let a = 0; a < 6; a++) { g.moveTo(ox + 8, oy + 8); g.lineTo(ox + 8 + Math.cos(a) * 8, oy + 8 + Math.sin(a) * 8); } for (let rr = 2; rr < 8; rr += 2.5) { g.moveTo(ox + 8 + rr, oy + 8); g.arc(ox + 8, oy + 8, rr, 0, 7); } g.stroke(); break;
    case 'feuilles': for (let i = 0; i < 7; i++) px(r() * 14 | 0, r() * 14 | 0, ['#c86a2a', '#d8a040', '#8a3a1a'][i % 3], 2, 1); break;
    case 'mousse': for (let i = 0; i < 5; i++) { const x = r() * 12 | 0, y = r() * 12 | 0; px(x, y, '#4a8a3a', 3, 2); px(x + 1, y, '#6aaa4a', 1, 1); } break;
    case 'nenuphar': px(4, 6, '#3a8a3a', 7, 4); px(5, 5, '#3a8a3a', 5, 1); px(7, 7, '#2a6a2a', 3, 1); px(8, 5, acc, 2, 2); break;
    case 'flaque': g.fillStyle = z.bi === 5 ? 'rgba(255,120,30,.55)' : z.bi === 6 ? 'rgba(140,90,255,.45)' : 'rgba(60,110,170,.45)'; g.beginPath(); g.ellipse(ox + 8, oy + 9, 5, 2.5, 0, 0, 7); g.fill(); px(6, 8, 'rgba(255,255,255,.4)', 2, 1); break;
    case 'glace': px(2, 4, 'rgba(200,235,255,.6)', 12, 8); g.strokeStyle = '#ffffff'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(ox + 3, oy + 5); g.lineTo(ox + 8, oy + 8); g.lineTo(ox + 13, oy + 6); g.moveTo(ox + 8, oy + 8); g.lineTo(ox + 7, oy + 11); g.stroke(); break;
    case 'braises': for (let i = 0; i < 6; i++) px(r() * 14 | 0, r() * 14 | 0, i % 2 ? '#ff7a2a' : '#ffd040', 1, 1); px(5, 7, '#2a2020', 5, 2); break;
    case 'etoiles': for (let i = 0; i < 5; i++) { const x = r() * 14 | 0, y = r() * 14 | 0; px(x, y, i % 2 ? '#e0d0ff' : acc, 1, 1); } px(7, 6, '#ffffff', 1, 3); px(6, 7, '#ffffff', 3, 1); break;
  }
}
function buildMap() {
  chunks.clear();
  miniBase = document.createElement('canvas'); miniBase.width = W; miniBase.height = H;
  const g = miniBase.getContext('2d'), id = g.createImageData(W, H), d = id.data;
  const rgb = {}; for (const [k, v] of Object.entries(MC)) rgb[k] = [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16)];
  for (let i = 0; i < W * H; i++) { const c = rgb[map[i]] || [0, 0, 0]; d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255; }
  g.putImageData(id, 0, 0);
}
function solidAt(x, y) { return SOLID.has(tileAt(Math.floor(x), Math.floor(y))); }
function blocked(x, y, r = 0.3) { return solidAt(x - r, y - r * 0.6) || solidAt(x + r, y - r * 0.6) || solidAt(x - r, y + r * 0.4) || solidAt(x + r, y + r * 0.4); }
function zoneName(x, y) {
  if (y >= WORLD_H) return 'Le Gouffre';
  const z = zoneAt(x, y); if (z) return `${z.name} · ${z.lv[0]}-${z.lv[1]}`;
  if (y < 19 && x > 33 && x < 63) return 'Crypte du nord';
  if (x >= 37 && x <= 59 && y >= 30 && y <= 50) return "Village d'Ambre";
  if (y >= 74 && x <= 45) return 'Marais Brumeux';
  if (y >= 74 && x >= 54) return 'Mine Profonde';
  if (x >= 68) return 'Forêt des Murmures';
  if (x < 30 && y > 26 && y < 50) return 'Lac Miroir';
  if (y > 50) return 'Plaines du Sud';
  return 'Prairies';
}
const isDarkZone = (x, y) => { if (y >= WORLD_H) return true; const z = zoneAt(x, y); if (z) return z.bi === 6; if (x >= KW) return false; return (y < 19.5 && x > 33.5 && x < 62.5) || (y >= 74 && x >= 54.5); };

/* ============================================================
   Son (synthèse 8 bits, aucun fichier)
   ============================================================ */
const Snd = {
  ac: null, on: store.get('ra_snd') !== '0', master: null, mus: null, nextT: 0, step: 0, timer: null,
  init() {
    if (this.ac || !this.on) return;
    try { this.ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    this.master = this.ac.createGain(); this.master.gain.value = 0.5; this.master.connect(this.ac.destination);
    this.mus = this.ac.createGain(); this.mus.gain.value = 0.22; this.mus.connect(this.master);
    this.nextT = this.ac.currentTime + 0.1;
    this.timer = setInterval(() => this.sched(), 100);
  },
  toggle() {
    this.on = !this.on; store.set('ra_snd', this.on ? '1' : '0');
    if (this.on) { if (!this.ac) this.init(); else this.ac.resume(); } else if (this.ac) this.ac.suspend();
    return this.on;
  },
  tone(f, d, type = 'square', v = 0.15, f2, at = 0, dest) {
    if (!this.ac || !this.on) return;
    const t = this.ac.currentTime + Math.max(0, at), o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g); g.connect(dest || this.master); o.start(t); o.stop(t + d + 0.02);
  },
  noise(d, v = 0.15, freq = 1500, at = 0) {
    if (!this.ac || !this.on) return;
    const t = this.ac.currentTime + at, n = Math.floor(this.ac.sampleRate * d), b = this.ac.createBuffer(1, n, this.ac.sampleRate), ch = b.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = Math.random() * 2 - 1;
    const s = this.ac.createBufferSource(), f = this.ac.createBiquadFilter(), g = this.ac.createGain();
    s.buffer = b; f.type = 'lowpass'; f.frequency.value = freq; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t);
  },
  play(k, r = 0) {
    switch (k) {
      case 'swing': this.noise(0.08, 0.12, 3000); break;
      case 'arrow': this.tone(1100, 0.09, 'square', 0.05, 300); break;
      case 'bolt': this.tone(500, 0.14, 'triangle', 0.12, 1300); break;
      case 'hit': this.tone(200, 0.07, 'square', 0.07, 80); this.noise(0.05, 0.08, 1200); break;
      case 'crit': this.tone(320, 0.06, 'square', 0.08); this.tone(640, 0.1, 'square', 0.07, null, 0.05); break;
      case 'hurt': this.tone(140, 0.16, 'sawtooth', 0.1, 60); break;
      case 'boom': this.noise(0.45, 0.25, 600); this.tone(90, 0.4, 'triangle', 0.2, 40); break;
      case 'spin': this.noise(0.25, 0.14, 2500); break;
      case 'ice': this.tone(1600, 0.25, 'triangle', 0.08, 500); this.noise(0.2, 0.06, 6000); break;
      case 'shout': this.tone(220, 0.3, 'sawtooth', 0.09, 330); break;
      case 'dash': this.noise(0.15, 0.1, 4000); break;
      case 'lvl': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'square', 0.08, null, i * 0.09)); break;
      case 'coin': this.tone(1320, 0.06, 'square', 0.05); this.tone(1760, 0.12, 'square', 0.05, null, 0.06); break;
      case 'heal': this.tone(420, 0.25, 'sine', 0.12, 840); break;
      case 'die': this.noise(0.18, 0.1, 900); break;
      case 'loot': [660, 880, 1100, 1320].slice(0, r + 2).forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.09, null, i * 0.07)); break;
      case 'quest': [784, 988, 1175].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.1, null, i * 0.12)); break;
      case 'tp': this.tone(300, 0.4, 'sine', 0.1, 1500); break;
      case 'click': this.tone(900, 0.03, 'square', 0.03); break;
      case 'quake': this.noise(0.5, 0.25, 300); break;
      case 'forge': this.tone(1800, 0.1, 'square', 0.06); this.tone(1500, 0.15, 'square', 0.05, null, 0.12); break;
    }
  },
  sched() {
    if (!this.ac || !this.on || !joined) return;
    const night = me.st && me.st.night, dark = isDarkZone(me.lx, me.ly);
    const beat = night || dark ? 0.32 : 0.26;
    const prog = night || dark ? [[220, 261.6, 329.6], [196, 233, 293.7], [174.6, 220, 261.6], [164.8, 207.7, 246.9]]
                              : [[261.6, 329.6, 392], [220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7]];
    if (this.nextT < this.ac.currentTime) this.nextT = this.ac.currentTime + 0.05;
    while (this.nextT < this.ac.currentTime + 0.4) {
      const bar = Math.floor(this.step / 8) % 4, s = this.step % 8, ch = prog[bar], at = this.nextT - this.ac.currentTime;
      if (s % 4 === 0) this.tone(ch[0] / 2, beat * 1.8, 'triangle', 0.18, null, at, this.mus);
      const mel = [0, 2, 1, 2, 0, 1, 2, 1][s], h = hash(this.step % 64, bar, 7);
      if (h < 0.7) this.tone(ch[mel] * (h < 0.2 ? 2 : 1), beat * 0.9, 'square', 0.035, null, at, this.mus);
      this.nextT += beat; this.step++;
    }
  },
};

/* ============================================================
   Réseau
   ============================================================ */
function connect() {
  if (window.LocalServer) {
    const srvSide = { open: true, onmessage: null, onclose: null, send(s) { if (client.onmessage) client.onmessage({ data: s }); }, close() {} };
    const client = { readyState: 1, onmessage: null, send(s) { queueMicrotask(() => srvSide.onmessage && srvSide.onmessage(s)); } };
    ws = client; ws.onmessage = ev => handle(JSON.parse(ev.data));
    window.LocalServer.connect(srvSide);
    sendMsg({ t: 'chars', acc: ACC });
    return;
  }
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
  ws.onopen = () => { $('net').classList.remove('on'); if (wantJoin) ws.send(JSON.stringify({ t: 'join', acc: ACC, ...wantJoin })); else ws.send(JSON.stringify({ t: 'chars', acc: ACC })); };
  ws.onmessage = ev => handle(JSON.parse(ev.data));
  ws.onclose = () => { if (joined) $('net').classList.add('on'); setTimeout(connect, 1500); };
}
function sendMsg(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }

function handle(o) {
  switch (o.t) {
    case 'err': $('err').textContent = o.m; wantJoin = null; return;
    case 'chars': renderChars(o.list, o.max); return;
    case 'loggedOut': resetToLogin(); renderChars(o.list, o.max); return;
    case 'bankui': closePanels(); $('bank').hidden = false; renderBank(); Snd.play('click'); return;
    case 'bank': me.bank = o; renderBank(); return;
    case 'welcome': {
      myId = o.id; W = o.w; H = o.h; WORLD_H = o.worldH; NPCS = o.npcs; WAYPOINTS = o.waypoints; CLASSES = o.classes; MT = o.mtypes; prepMonsterTypes();
      DEF = o; potionCost = o.potionCost; SLOT_NAMES = o.slotNames; RAR_NAMES = o.rarNames; INV_SIZE = o.invSize; LOCAL = !!o.local; myName = o.name; ITEMDEF = o.items;
      if (o.mapR) { const bin = atob(o.mapR); map = new Uint8Array(W * H); let k = 0; for (let i = 0; i < bin.length; i += 2) { const v = bin.charCodeAt(i), n = bin.charCodeAt(i + 1); map.fill(v, k, k + n); k += n; } }
      else { const bin = atob(o.map); map = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) map[i] = bin.charCodeAt(i); }
      ZONES = o.zones || []; buildMap();
      me.cls = o.cls; me.has = false; ents.clear(); joined = true;
      $('login').classList.add('off'); $('hud').classList.add('on');
      $('pname').textContent = o.name;
      CLASSES[o.cls].skills.forEach((s, i) => { const b = $('bSk' + i); if (b) b.querySelector('span').innerHTML = esc(s.name) + `<em class="key">${'CXFU'[i]}</em>`; }); hudCache.rk = '';
      store.set('ra_name', wantJoin.name); store.set('ra_cls', wantJoin.cls);
      if (!o.returning) addChat('★', 'Bienvenue ! Parle au Capitaine Aldric, au nord de la place, pour ta première quête.', 'sys');
      updSnd(); sendMsg({ t: 'autopot', v: autoPot }); if (window.RA_onJoin) window.RA_onJoin();
      return;
    }
    case 'chat': addChat(o.n, o.m, o.n === '★' ? 'sys' : ''); if (o.id) { const e = ents.get(o.id); if (e) { e.bubble = o.m; e.bubbleT = 5; } } return;
    case 'msg': addChat('', o.m, 'info'); if (/^(Quête|Récompense|Pierre)/.test(o.m)) Snd.play('quest'); return;
    case 's': onSnap(o); return;
    case 'inv': me.inv = o.inv; me.eq = o.eq; me.sets = o.sets || []; renderBag(); renderTradeGrid(); renderForge(); return;
    case 'dlg': openDlg(o); return;
    case 'travel': togglePanel('travel'); return;
    case 'prog': me.prog = o; renderOpenPanels(); return;
    case 'gathered': if (gatherLoop) setTimeout(() => { if (gatherLoop && nodeHere()) sendMsg({ t: 'gather' }); else gatherLoop = false; }, 200); return;
    case 'hub': case 'kvr': Hub.answer(o); return;
    case 'arenaRes': Hub.arenaResult(o.win); return;
    case 'forgeui': closePanels(); $('forge').hidden = false; renderForge(); Snd.play('click'); return;
    case 'forgeres': forgeFlash = { id: o.id, ok: o.ok, t: performance.now() }; Snd.play(o.ok ? 'forge' : 'hurt'); renderForge(); return;
    case 'tp': me.has = false; auto.path = null; auto.chaseId = 0; auto.anchor = null; Snd.play('tp'); return;
    case 'lvlup': if (window.RA_onLevel) window.RA_onLevel(o.lvl); return;
    case 'ask': showAsk(o.kind, o.name, { kind: 'srv', id: o.from }); return;
    case 'trade': if (o.open) { trade = { srv: true, withName: o.with, mine: o.mine, theirs: o.theirs, okMe: o.okMe, okThem: o.okThem }; renderTrade(); } else closeTradeUI(); return;
    case 'board': renderBoard(o.rows); return;
    case 'desc': if (descWaiters[o.ref]) { descWaiters[o.ref](o.items); delete descWaiters[o.ref]; } return;
  }
}

function onSnap(s) {
  const seen = new Set();
  for (const a of s.p) {
    const [id, x, y, dir, mv, hp, mhp, cls, name, lvl, dead, weap, atk, fl, wr, mount, tag, title, look, vis, rb] = a;
    let e = ents.get(id);
    if (!e) { e = { kind: 'p', id, rx: x, ry: y }; ents.set(id, e); }
    if (e.hp !== undefined && hp < e.hp) e.flash = 0.12;
    if (id === myId && e.vis !== vis && !$('bag').hidden) setTimeout(renderDoll, 0);
    Object.assign(e, { tx: x, ty: y, dir, mv, hp, mhp, cls, name, lvl, dead, weap, atk, shield: fl & 1, buff: fl & 2, ally: fl & 4, regen: fl & 8, invis: fl & 16, wr, mount, tag, title, look, vis, rb: rb | 0 });
    seen.add(id);
    if (id === myId) {
      if (!me.has || dead) { me.lx = x; me.ly = y; me.has = true; me.corrX = me.corrY = 0; }
      else {
        const ex = x - me.lx, ey = y - me.ly, err = Math.hypot(ex, ey);
        if (err > 2) { me.lx = x; me.ly = y; }
        else if (input.dx || input.dy) { if (err > 0.6) { me.lx += ex * 0.1; me.ly += ey * 0.1; } }
        else { me.corrX = ex; me.corrY = ey; }
      }
      me.dead = dead;
      if (!(input.dx || input.dy) || atk) me.dir = dir;
    }
  }
  for (const a of s.m) {
    const [id, type, x, y, dir, mv, hp, mhp, agg, lvl, fl, champ] = a;
    let e = ents.get(id);
    if (!e) { e = { kind: 'm', id, rx: x, ry: y, flip: false }; ents.set(id, e); }
    if (e.hp !== undefined && hp < e.hp) e.flash = 0.12;
    Object.assign(e, { tx: x, ty: y, type, dir, mv, hp, mhp, agg, lvl, stun: fl & 1, slow: fl & 2, champ: champ ? champ.split('|') : null });
    if (dir === 2) e.flip = true; else if (dir === 3) e.flip = false;
    seen.add(id);
  }
  for (const id of ents.keys()) if (!seen.has(id)) ents.delete(id);
  drops = s.d;
  for (const f of s.f) spawnFx(f);
  const prevLvl = me.st && me.st.lvl;
  me.st = s.me;
  if (prevLvl && prevLvl !== me.st.lvl && window.RA_onLevel) window.RA_onLevel(me.st.lvl);
  updateHud();
}

/* ============================================================
   Entrées
   ============================================================ */
const input = { dx: 0, dy: 0 };
const keys = new Set();
let stick = { id: null, dx: 0, dy: 0 };
let lastSent = '';
const chatOpen = () => $('chatbox').classList.contains('on');

addEventListener('keydown', e => {
  Snd.init();
  if (!joined) return;
  const ae = document.activeElement;
  if (ae && ae.tagName === 'INPUT' && ae.id !== 'chatIn') return;
  if (chatOpen()) { if (e.key === 'Enter') { sendChat(); e.preventDefault(); } else if (e.key === 'Escape') closeChat(); return; }
  const k = e.key.toLowerCase();
  if (e.key === 'Escape') { closePanels(); return; }
  if (e.key === 'Enter') { openChat(); e.preventDefault(); return; }
  if (e.repeat) { if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault(); return; }
  keys.add(k);
  if (k === ' ') { sendMsg({ t: 'atk' }); sendMsg({ t: 'auto', on: true }); e.preventDefault(); }
  if (k === 'c' || k === '1') sendMsg({ t: 'skill', i: 0 });
  if (k === 'x' || k === '2') sendMsg({ t: 'skill', i: 1 });
  if (k === 'f' || k === '3') sendMsg({ t: 'skill', i: 2 });
  if (k === 'u' || k === '4') sendMsg({ t: 'skill', i: 3 });
  if (k === 'v') sendMsg({ t: 'pot' });
  if (k === 'e') { if (hudCache.useLbl === 'Récolter') doGather(); else sendMsg({ t: 'use' }); }
  if (k === 'i' || k === 'b') togglePanel('bag');
  if (k === 'g') togglePanel('social');
  if (k === 'k') togglePanel('cat');
  if (k === 't') togglePanel('travel');
  if (k === 'b') setFarm(!auto.farm);
  if (k === 'r') sendMsg({ t: 'mount' });
  if (k === 'j') togglePanel('journal');
  if (k === 'n') togglePanel('talents');
  if (k === 'm') { Snd.toggle(); updSnd(); }
  if (k.startsWith('arrow')) e.preventDefault();
});
addEventListener('keyup', e => { const k = e.key.toLowerCase(); keys.delete(k); if (k === ' ') sendMsg({ t: 'auto', on: false }); });
addEventListener('blur', () => { keys.clear(); sendMsg({ t: 'auto', on: false }); });
addEventListener('pointerdown', () => Snd.init(), { capture: true });

function readInput() {
  let dx = 0, dy = 0;
  if (keys.has('arrowleft') || keys.has('q') || keys.has('a')) dx -= 1;
  if (keys.has('arrowright') || keys.has('d')) dx += 1;
  if (keys.has('arrowup') || keys.has('z') || keys.has('w')) dy -= 1;
  if (keys.has('arrowdown') || keys.has('s')) dy += 1;
  if (stick.id !== null) { dx = stick.dx; dy = stick.dy; }
  if (dx || dy) { gatherLoop = false; if (auto.mode || auto.chaseId) cancelAuto(); if (auto.farm) { auto.anchor = null; auto.wait = 1.2; } }
  else { const st = steer(); if (st) { dx = st[0]; dy = st[1]; } }
  const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
  if (me.dead) { dx = 0; dy = 0; }
  input.dx = Math.round(dx * 20) / 20; input.dy = Math.round(dy * 20) / 20;
  const sig = input.dx + ',' + input.dy;
  if (sig !== lastSent) { lastSent = sig; sendMsg({ t: 'in', dx: input.dx, dy: input.dy }); }
}

const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) $('stickZone').classList.add('on');
const zone = $('stickZone'), stickEl = $('stick');
zone.addEventListener('pointerdown', e => {
  if (stick.id !== null) return;
  stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, dx: 0, dy: 0 };
  zone.setPointerCapture(e.pointerId);
  stickEl.style.display = 'block'; stickEl.style.left = e.clientX + 'px'; stickEl.style.top = e.clientY + 'px'; stickEl.firstElementChild.style.transform = '';
});
zone.addEventListener('pointermove', e => {
  if (e.pointerId !== stick.id) return;
  let x = e.clientX - stick.ox, y = e.clientY - stick.oy; const l = Math.hypot(x, y), R = 50;
  if (l > R) { x = x / l * R; y = y / l * R; }
  stick.dx = l < 8 ? 0 : x / R; stick.dy = l < 8 ? 0 : y / R;
  stickEl.firstElementChild.style.transform = `translate(${x}px, ${y}px)`;
});
const endStick = e => { if (e.pointerId !== stick.id) return; stick = { id: null, dx: 0, dy: 0 }; stickEl.style.display = 'none'; };
zone.addEventListener('pointerup', endStick); zone.addEventListener('pointercancel', endStick);

function holdButton(el, down, up) {
  el.addEventListener('pointerdown', e => { e.preventDefault(); el.setPointerCapture(e.pointerId); el.classList.add('down'); down(); });
  const end = () => { el.classList.remove('down'); if (up) up(); };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
}
holdButton($('bAtk'), () => { sendMsg({ t: 'atk' }); sendMsg({ t: 'auto', on: true }); }, () => sendMsg({ t: 'auto', on: false }));
[0, 1, 2, 3].forEach(i => holdButton($('bSk' + i), () => sendMsg({ t: 'skill', i })));
holdButton($('bPot'), () => sendMsg({ t: 'pot' }));
holdButton($('bUse'), () => { if (hudCache.useLbl === 'Récolter') doGather(); else sendMsg({ t: 'use' }); });
$('mChat').onclick = () => chatOpen() ? closeChat() : openChat();
$('mBag').onclick = () => togglePanel('bag');
$('mTravel').onclick = () => togglePanel('travel');
$('dollL').onclick = () => { dollDir = (dollDir + 3) % 4; renderDoll(); };
$('dollR').onclick = () => { dollDir = (dollDir + 1) % 4; renderDoll(); };
$('bAuto').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); setFarm(!auto.farm); });
$('mSnd').onclick = () => { Snd.toggle(); updSnd(); };
function updSnd() { $('mSnd').textContent = Snd.on ? 'Son' : 'Muet'; }
$('chatSend').addEventListener('click', sendChat);
function openChat() { $('chatbox').classList.add('on'); $('chatIn').focus(); keys.clear(); }
function closeChat() { $('chatbox').classList.remove('on'); $('chatIn').blur(); }
function sendChat() {
  const v = $('chatIn').value.trim();
  if (v) { sendMsg({ t: 'chat', m: v }); if (window.RA_chat) window.RA_chat(v); }
  $('chatIn').value = ''; closeChat();
}

// Toucher le monde : cibler un monstre ou ouvrir la fiche d'un joueur
cv.addEventListener('pointerdown', e => {
  if (!joined || !me.has) return;
  const px = e.clientX * dpr, py = e.clientY * dpr;
  let best = null, bd = 34 * dpr;
  const test = (e2, x, y, scale) => { const [sx, sy] = scr(x, y); const d = Math.hypot(px - sx, py - (sy - 7 * S * scale)) - 6 * S * (scale - 1); if (d < bd) { bd = d; best = e2; } };
  for (const e2 of ents.values()) { if (e2.id === myId) continue; test(e2, e2.rx, e2.ry, e2.kind === 'm' ? ((MT[e2.type] || {}).size || 1) : 1); }
  for (const r of remoteList()) test(r, r.rx, r.ry, 1);
  if (!best) { if (me.st && me.st.tgt) { sendMsg({ t: 'target', id: 0 }); if (auto.chaseId) { auto.chaseId = 0; auto.path = null; setAuto(false); } } return; }
  if (best.kind === 'm') { chase(best); Snd.play('click'); }
  else openPcard(best);
});

/* ============================================================
   Pilote automatique : aller vers la quête, poursuivre et attaquer la cible
   ============================================================ */
const auto = { mode: null, chaseId: 0, path: null, goalKey: '', repathT: 0, atkOn: false, wait: 0, usedAt: -9, lastQ: '', farm: false, anchor: null, roamT: 0, skT: 0, ignore: new Map(), stillT: 0, lastX: 0, lastY: 0, lootId: 0, lootT: 0 };
const walkable = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !SOLID.has(tileAt(x, y));
function nearestWalkable(gx, gy) {
  gx = Math.floor(gx); gy = Math.floor(gy);
  for (let r = 0; r < 7; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++)
    if (Math.max(Math.abs(dx), Math.abs(dy)) === r && walkable(gx + dx, gy + dy)) return [gx + dx, gy + dy];
  return null;
}
const pf = {};
function findPath(fx, fy, tx, ty) {
  const goal = nearestWalkable(tx, ty); if (!goal) return null;
  const sx = Math.floor(fx), sy = Math.floor(fy), gi = goal[1] * W + goal[0], si = sy * W + sx;
  if (si === gi) return [];
  const N = W * H;
  if (!pf.gs || pf.gs.length !== N) { pf.gs = new Float32Array(N); pf.came = new Int32Array(N); pf.stamp = new Uint32Array(N); pf.closed = new Uint32Array(N); pf.gen = 0; }
  const gen = ++pf.gen, st = pf.stamp, cl = pf.closed, gsA = pf.gs, cameA = pf.came;
  const gs = { get: i => st[i] === gen ? gsA[i] : 1e9 }, touch = i => { if (st[i] !== gen) { st[i] = gen; gsA[i] = 1e9; cameA[i] = -1; } };
  const came = cameA, closed = { has: i => cl[i] === gen, set: i => { cl[i] = gen; } };
  const heap = []; const push = (f, i) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const pk = (k - 1) >> 1; if (heap[pk][0] <= heap[k][0]) break; [heap[pk], heap[k]] = [heap[k], heap[pk]]; k = pk; } };
  const pop = () => { const top = heap[0], end = heap.pop(); if (heap.length) { heap[0] = end; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  const h = (x, y) => { const dx = Math.abs(x - goal[0]), dy = Math.abs(y - goal[1]); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
  touch(si); gsA[si] = 0; touch(gi); push(h(sx, sy), si);
  let n = 0;
  while (heap.length && n++ < 40000) {
    const [, i] = pop(); if (closed.has(i)) continue; closed.set(i);
    if (i === gi) break;
    const x = i % W, y = (i / W) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy; if (!walkable(nx, ny)) continue;
      if (dx && dy && (!walkable(x + dx, y) || !walkable(x, y + dy))) continue;
      const ni = ny * W + nx; if (closed.has(ni)) continue;
      touch(ni);
      const g = gsA[i] + (dx && dy ? 1.414 : 1);
      if (g < gsA[ni]) { gsA[ni] = g; came[ni] = i; push(g + h(nx, ny), ni); }
    }
  }
  if (st[gi] !== gen || came[gi] < 0) return null;
  const path = []; for (let i = gi; i !== si && i >= 0; i = came[i]) path.push([i % W, (i / W) | 0]);
  return path.reverse();
}
function steer() {
  if (!auto.path || !auto.path.length || me.dead) return null;
  while (auto.path.length) {
    const [tx, ty] = auto.path[0], cx = tx + 0.5, cy = ty + 0.5, d = Math.hypot(cx - me.lx, cy - me.ly);
    if (d < (auto.path.length > 1 ? 0.35 : 0.15)) { auto.path.shift(); continue; }
    return [(cx - me.lx) / d, (cy - me.ly) / d];
  }
  auto.path = null; return null;
}
function goTo(x, y, key) {
  const p = findPath(me.lx, me.ly, x, y);
  auto.path = p; auto.goalKey = key;
  if (!p) { addChat('', "Je ne trouve pas de chemin jusque-là.", 'info'); stopQuest(); }
}
function setAuto(on) { if (on !== auto.atkOn) { auto.atkOn = on; sendMsg({ t: 'auto', on }); } }
function farmTick() {
  if (auto.wait > 0) return;
  const inInst = me.ly >= WORLD_H;
  if (!auto.anchor) auto.anchor = [me.lx, me.ly];
  const [ax, ay] = auto.anchor, myPl = me.st.pl || me.st.lvl;
  // ramasse le butin proche (sauf si le sac est plein)
  {
    let bdrop = null, dd = 9;
    const ign = k => { const v = auto.ignore.get(k); return v && v > time; };
    for (const d of drops || []) { if (d[3] === 'item' && me.inv.length >= INV_SIZE) continue; if (ign('d' + d[0])) continue; const dist = Math.hypot(d[1] - me.lx, d[2] - me.ly); if (dist < dd && dist > 0.4) { dd = dist; bdrop = d; } }
    if (bdrop) {
      if (auto.lootId !== bdrop[0]) { auto.lootId = bdrop[0]; auto.lootT = time; }
      if (time - auto.lootT > 4) { auto.ignore.set('d' + bdrop[0], time + 60); auto.lootId = 0; auto.path = null; return; }
      if (!auto.path || !auto.path.length || auto.goalKey !== 'loot' + bdrop[0]) {
        let pth = findPath(me.lx, me.ly, bdrop[1], bdrop[2]);
        if (pth && !pth.length) pth = [[Math.floor(bdrop[1]), Math.floor(bdrop[2])]];
        if (!pth) { auto.ignore.set('d' + bdrop[0], time + 60); auto.lootId = 0; return; }
        auto.path = pth; auto.goalKey = 'loot' + bdrop[0];
      }
      return;
    }
    auto.lootId = 0;
  }
  let best = null, bd = inInst ? 60 : 22;
  for (const e of ents.values()) {
    if (e.kind !== 'm' || e.champ && !inInst) continue;
    const mt = MT[e.type] || {};
    if (mt.boss && !inInst && (e.lvl || mt.lvl) > myPl + 3) continue;
    { const v = auto.ignore.get('m' + e.id); if (v && v > time) continue; }
    const d = Math.hypot(e.rx - me.lx, e.ry - me.ly);
    if (!inInst && Math.hypot(e.rx - ax, e.ry - ay) > 26) continue;
    if (d < bd) { bd = d; best = e; }
  }
  if (best) { chase(best); return; }
  if (inInst) return;
  const da = Math.hypot(ax - me.lx, ay - me.ly);
  if (da > 4) { if (!auto.path || auto.goalKey !== 'farm') { auto.path = findPath(me.lx, me.ly, ax, ay); auto.goalKey = 'farm'; if (!auto.path) auto.anchor = null; } return; }
  if (auto.roamT <= 0 && (!auto.path || !auto.path.length)) {
    auto.roamT = 3 + Math.random() * 3;
    const a = Math.random() * 6.283, rr = 3 + Math.random() * 7;
    const tx = ax + Math.cos(a) * rr, ty = ay + Math.sin(a) * rr;
    if (walkable(Math.floor(tx), Math.floor(ty))) { auto.path = findPath(me.lx, me.ly, tx, ty); auto.goalKey = 'roam'; }
  }
}
function setFarm(on) {
  auto.farm = on; sendMsg({ t: 'autoMode', on: on || auto.mode === 'quest' }); auto.anchor = null; auto.wait = 0; auto.path = null;
  if (!on) { auto.chaseId = 0; setAuto(false); } else if (auto.mode === 'quest') stopQuest();
  $('bAuto').classList.toggle('on', on);
  addChat('', on ? 'Combat automatique activé : ton héros attaque les monstres autour de lui et lance ses sorts. Déplace-toi pour changer de coin de chasse.' : 'Combat automatique désactivé.', 'info');
  Snd.play('click');
}
function chase(m) { sendMsg({ t: 'target', id: m.id }); auto.chaseId = m.id; auto.path = null; auto.repathT = 0; }
function cancelAuto() { if (auto.mode === 'quest' && !auto.farm) sendMsg({ t: 'autoMode', on: false }); auto.mode = null; auto.chaseId = 0; auto.path = null; setAuto(false); }
function stopQuest() { if (!auto.farm) sendMsg({ t: 'autoMode', on: false }); auto.mode = null; auto.path = null; }
function startQuest() { if (!me.st || !me.st.q || me.st.inst) return; auto.mode = 'quest'; sendMsg({ t: 'autoMode', on: true }); auto.path = null; auto.goalKey = ''; auto.wait = 0; Snd.play('click'); }
function autoTick(dt) {
  if (!me.st || !me.has) return;
  if (me.dead) { if (auto.chaseId) { auto.chaseId = 0; setAuto(false); } auto.path = null; auto.anchor = null; return; }
  auto.repathT -= dt; auto.wait -= dt; auto.roamT -= dt; auto.skT -= dt; auto.potT = (auto.potT || 0) - dt;
  if (me.st.tpc) { auto.path = null; if (auto.atkOn) setAuto(false); return; }
  if (auto.path && auto.path.length > 6 && !auto.chaseId && !auto.atkOn && !me.st.riding && !me.st.inst && P().mount && time - (auto.mountT || -99) > 3) { auto.mountT = time; sendMsg({ t: 'mountOn' }); }
  if (auto.farm && !autoPot && me.st.pots > 0 && me.st.hp < me.st.mhp * 0.4 && auto.potT <= 0) { auto.potT = 2; sendMsg({ t: 'pot' }); }
  // combat auto : si le héros ne bouge plus alors qu'il devrait (cible ou butin inaccessible), on passe à autre chose
  if (auto.farm) {
    const moved = Math.hypot(me.lx - auto.lastX, me.ly - auto.lastY); auto.lastX = me.lx; auto.lastY = me.ly;
    if (moved < 0.02 && !auto.atkOn && (auto.path || auto.chaseId || auto.lootId)) auto.stillT += dt; else auto.stillT = 0;
    if (auto.stillT > 2) {
      if (auto.chaseId) auto.ignore.set('m' + auto.chaseId, time + 15);
      if (auto.lootId) auto.ignore.set('d' + auto.lootId, time + 60);
      auto.chaseId = 0; auto.lootId = 0; auto.path = null; auto.stillT = 0; auto.roamT = 0; setAuto(false);
    }
    if (auto.ignore.size > 50) for (const [k, v] of auto.ignore) if (v < time) auto.ignore.delete(k);
  }
  // une nouvelle quête démarre le trajet automatiquement
  const qk = me.st.q ? me.st.q[0] : '';
  if (qk && qk !== auto.lastQ && !auto.farm) startQuest();
  auto.lastQ = qk;
  if (auto.chaseId) {
    const tg = ents.get(auto.chaseId);
    if (!tg || tg.kind !== 'm') { auto.chaseId = 0; auto.path = null; setAuto(false); auto.wait = 0.5; }
    else {
      const range = (me.st.range || CLASSES[me.cls].range) + (((MT[tg.type] || {}).size || 1) - 1) * 0.5;
      const d = Math.hypot(tg.rx - me.lx, tg.ry - me.ly);
      if (d > range * 0.85) {
        setAuto(false);
        if (auto.repathT <= 0 || !auto.path) { auto.repathT = 0.4; auto.path = findPath(me.lx, me.ly, tg.tx, tg.ty); }
      } else {
        auto.path = null; setAuto(true);
        // combat automatique : lance les compétences prêtes
        if ((auto.farm || auto.mode === 'quest') && auto.skT <= 0 && me.st.sk) { auto.skT = 0.35; const i = me.st.sk.findIndex(k => k[0] <= 0 && !k[2]); if (i >= 0) sendMsg({ t: 'skill', i }); }
      }
      return;
    }
  }
  if (auto.farm && auto.mode !== 'quest') { farmTick(); return; }
  if (auto.mode !== 'quest') return;
  const q = me.st.q;
  if (!q || me.st.inst) { stopQuest(); return; }
  const [, prog, n, , gx, gy, type] = q, done = prog >= n;
  if (time - (auto.warpT || -99) < 2.2) { auto.path = null; return; } // on attend la fin de l'incantation
  const dGoal = Math.hypot(gx - me.lx, gy - me.ly);
  if (done) {
    if (dGoal < 1.1) { auto.path = null; sendMsg({ t: 'use' }); stopQuest(); return; }
    if (questWarp(gx, gy)) return;
    if (!auto.path || auto.goalKey !== 'aldric') goTo(gx, gy, 'aldric');
    return;
  }
  if (auto.wait <= 0) {
    let best = null, bd = dGoal < 12 ? 14 : 6;
    for (const e of ents.values()) if (e.kind === 'm' && e.type === type) { const d = Math.hypot(e.rx - me.lx, e.ry - me.ly); if (d < bd) { bd = d; best = e; } }
    if (best) { chase(best); return; }
  }
  if (dGoal > 3 && questWarp(gx, gy)) return;
  if (dGoal > 3 && (!auto.path || auto.goalKey !== 'zone')) goTo(gx, gy, 'zone');
}
// Quête : se téléporter à la pierre de passage activée la plus proche du but, si elle fait gagner du chemin
function questWarp(gx, gy) {
  if (me.st.inst || me.ly >= WORLD_H || time - (auto.warpT || -99) < 7) return false;
  const known = new Set(me.st.wps || []), dCur = Math.hypot(gx - me.lx, gy - me.ly);
  let best = null, bd = 1e9;
  for (const w of WAYPOINTS) { if (!known.has(w.id)) continue; const d = Math.hypot(w.x - gx, w.y - gy); if (d < bd) { bd = d; best = w; } }
  if (!best || bd + 14 > dCur) return false;
  auto.warpT = time; auto.path = null; auto.wait = 2.2; auto.chaseId = 0;
  sendMsg({ t: 'wptp', id: best.id });
  addChat('', `Voyage rapide vers ${best.name}, la pierre la plus proche de l'objectif.`, 'info');
  return true;
}

/* ============================================================
   HUD
   ============================================================ */
const chatLines = [];
function addChat(n, m, cls) {
  if (!n || n === '★') pushLog(m, n === '★' ? 'evt' : 'sys');
  const d = document.createElement('div'); if (cls) d.className = cls;
  if (n) { const b = document.createElement('span'); b.className = 'n'; b.textContent = n + ' : '; d.appendChild(b); }
  d.appendChild(document.createTextNode(m));
  $('chatlog').appendChild(d); chatLines.push({ el: d, t: performance.now() });
  while (chatLines.length > 4) chatLines.shift().el.remove();
}
const hudCache = {};
function setTxt(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
function setHtml(id, v) { if (hudCache['h' + id] !== v) { hudCache['h' + id] = v; $(id).innerHTML = v; } }
function setSty(id, prop, v) { const k = id + prop; if (hudCache[k] !== v) { hudCache[k] = v; if (prop[0] === '-') $(id).style.setProperty(prop, v); else $(id).style[prop] = v; } }
function setHidden(id, h) { const k = 'hid' + id; if (hudCache[k] !== h) { hudCache[k] = h; $(id).hidden = h; } }
function updateHud() {
  const s = me.st; if (!s) return;
  setSty('hpFill', 'transform', `scaleX(${Math.max(0, s.hp / s.mhp).toFixed(3)})`);
  setSty('shFill', 'transform', `scaleX(${Math.min(1, s.sh / s.mhp).toFixed(3)})`);
  setTxt('hpTxt', `${s.hp} / ${s.mhp}${s.sh ? ' +' + s.sh : ''}`);
  setSty('xpFill', 'transform', `scaleX(${(s.xp / s.xpn).toFixed(3)})`);
  setTxt('plvl', `${CLASSES[me.cls].name} · Niv. ${s.lvl}${s.rb ? ` (${s.pl})` : ''}`);
  if (hudCache.gold !== String(s.gold) && !$('forge').hidden) setTimeout(renderForge);
  setTxt('gold', String(s.gold)); setTxt('pots', String(s.pots)); setTxt('weap', '+' + s.weap);
  setTxt('buff', [s.buff > 0 ? `Cri ${Math.ceil(s.buff)} s` : '', s.streak >= 3 ? `Série ×${s.streak}` : ''].filter(Boolean).join(' · '));
  setHidden('evtBan', !s.evt);
  if (s.evt) setTxt('evtBan', `★ ${s.evt[1]} · ${Math.floor(s.evt[2] / 60)}:${String(s.evt[2] % 60).padStart(2, '0')}`);
  const ROM = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
  if (hudCache.rk !== String(s.rk)) { hudCache.rk = String(s.rk); for (let i = 0; i < 4; i++) delete hudCache['lk' + i]; }
  s.sk.forEach(([cd, max, lock], i) => {
    const el = $('bSk' + i); if (!el) return;
    const v = Math.round(cd / max * 360) + 'deg', k = 'cd' + i;
    if (hudCache[k] !== v) { hudCache[k] = v; el.querySelector('.cd').style.setProperty('--cd', v); }
    const want = !!lock, lk = (lock ? 'L' + lock : 'R' + s.rk);
    if (hudCache['lk' + i] !== lk) { hudCache['lk' + i] = lk; el.classList.toggle('locked', want); el.querySelector('em').textContent = lock ? `Niv. ${lock}` : 'CXFU'[i] + (s.rk > 1 ? ' · ' + ROM[s.rk] : ''); }
  });
  setTxt('potKey', autoPot ? `×${s.pots} · auto` : `×${s.pots} · V`);
  setHidden('death', !(s.deadT > 0));
  if (s.deadT > 0) setTxt('deathT', `Réapparition dans ${Math.ceil(s.deadT)}…`);
  if (s.q) { const done = s.q[1] >= s.q[2]; setHidden('qtrack', false); $('qtrack').classList.toggle('done', done);
    const st = auto.mode === 'quest' ? (auto.chaseId ? 'Au combat' : auto.path ? 'En route…' : done ? 'Arrivé' : 'En chasse') : 'Touche pour y aller';
    setHtml('qtrack', `<b>${esc(s.q[0])}</b>${done ? `Terminée : retourne voir ${esc(((NPCS.find(n => n.id === s.qg) || {}).name || 'Aldric').split(',')[0])}` : `${esc(s.q[3] || 'Éliminés')} : ${s.q[1]} / ${s.q[2]}`}<span class="auto${auto.mode === 'quest' ? ' on' : ''}">${st}</span>`); }
  else setHidden('qtrack', true);
  setHidden('wave', !s.wave); if (s.wave) setTxt('waveTxt', (s.ik === 'gouffre' ? 'Le Gouffre · ' : '') + s.wave);
  setHidden('waveLeave', !(s.ik === 'tower' || s.ik === 'arena'));
  setHidden('gbar', !s.gath && !s.tpc);
  if (s.tpc) { setTxt('gbarTxt', 'Téléportation…'); setSty('gbarFill', 'transform', `scaleX(${(1 - s.tpc[0] / s.tpc[1]).toFixed(2)})`); }
  else if (s.gath) { setTxt('gbarTxt', { peche: 'Pêche…', mine: 'Minage…', herbe: 'Cueillette…' }[s.gath[0]]); setSty('gbarFill', 'transform', `scaleX(${(1 - s.gath[1] / s.gath[2]).toFixed(2)})`); }
  setTxt('mMount', s.riding ? 'Descendre' : 'Monture');
  const ph = todPhase();
  setTxt('tod', ph.night > 0.5 ? 'Nuit' : ph.dusk ? 'Crépuscule' : 'Jour');
  renderParty();
}
function todPhase() {
  const t = me.st ? me.st.tod : 0.2;
  let night = 0;
  if (t >= 0.64 && t < 0.7) night = (t - 0.64) / 0.06; else if (t >= 0.7 && t < 0.97) night = 1; else if (t >= 0.97) night = 1 - (t - 0.97) / 0.03;
  return { night, dusk: t >= 0.6 && t < 0.7 };
}

/* ============================================================
   Panneaux : sac, social, dialogue, échange
   ============================================================ */
function closePanels() { for (const id of PANELS) $(id).hidden = true; }
let forgeFlash = null;
function renderForge() {
  if ($('forge').hidden || !me.st) return;
  const worn = ITEMDEF.slots.map(k => me.eq[k]).filter(Boolean);
  const frags = (P().mat || {}).frag || 0;
  const row = (it, tag) => {
    const max = it.u >= 9, poor = me.st.gold < it.fc;
    const fl = forgeFlash && forgeFlash.id === it.id && performance.now() - forgeFlash.t < 2500 ? (forgeFlash.ok ? '<span class="fok">Réussite !</span>' : '<span class="fko">Échec</span>') : '';
    return `<div class="crow"><span class="cell r${it.r}">${cellHtml(it)}</span><div class="cinfo"><div class="nm rc${it.r}">${esc(it.name)} ${fl}</div><div class="note">${tag} · ${statLine(it.st)}</div>` +
      (max ? '<div class="note">Niveau maximum atteint.</div>' : `<div class="note">+${it.u} → <b style="color:var(--gold-hi)">+${it.u + 1}</b> · ${it.fc} or · ${Math.round(it.fp * 100)} % de réussite</div><button class="btn small" data-forge="${it.id}"${poor ? ' disabled' : ''}>${poor ? 'Pas assez d\'or' : 'Améliorer'}</button>${it.fp < 1 ? ` <button class="btn alt small" data-safe="${it.id}"${poor || frags < safeForgeFrags(it) ? ' disabled' : ''}>Sans risque (${safeForgeFrags(it)} fragments)</button>` : ''}`) + '</div></div>';
  };
  const wearBox = me.st.wear ? `<div class="row2"><div class="grow"><b>Réparation</b> <span class="note">usure ${me.st.wear} % : −${(me.st.wear / 2) | 0} % de vie, dégâts et défense</span></div><button class="btn small" id="fRepair"${me.st.gold < me.st.rc ? ' disabled' : ''}>Réparer (${me.st.rc} or)</button></div>` : '<div class="note" style="margin-bottom:6px">Équipement en parfait état. Chaque défaite l\'use de 10 % (jusqu\'à 50 %).</div>';
  $('forgeList').innerHTML = wearBox + `<div class="note" style="margin-bottom:6px">Ton or : <b style="color:var(--gold-hi)">${me.st.gold}</b> · fragments de forge : <b>${frags}</b> (recycle des objets pour en gagner)</div>` +
    (worn.length ? '<div class="sub2">Équipement porté</div>' + worn.map(it => row(it, 'porté')).join('') : '') +
    (me.inv.length ? '<div class="sub2">Dans le sac</div>' + me.inv.map(it => row(it, 'sac')).join('') : '') +
    (!worn.length && !me.inv.length ? '<div class="note">Tu n\'as aucun objet à améliorer pour l\'instant.</div>' : '');
  if ($('fRepair')) $('fRepair').onclick = () => { sendMsg({ t: 'repair' }); Snd.play('forge'); setTimeout(renderForge, 300); };
  $('forgeList').querySelectorAll('[data-forge]').forEach(b => b.onclick = () => { b.disabled = true; sendMsg({ t: 'forge', id: +b.dataset.forge }); });
  $('forgeList').querySelectorAll('[data-safe]').forEach(b => b.onclick = () => { b.disabled = true; sendMsg({ t: 'forge', id: +b.dataset.safe, safe: true }); });
}
function togglePanel(id) { const was = $(id).hidden; closePanels(); $(id).hidden = !was; if (!was) return; if (id === 'bag') renderBag(); if (id === 'social') renderSocial(); if (id === 'cat') renderCat(); if (id === 'travel') renderTravel(); if (id === 'bestiary') renderBestiary(); if (id === 'wmap') renderWmap(); if (id === 'clog') renderClog(); if (id === 'settings') renderSettings(); if (onOpen[id]) onOpen[id](); Snd.play('click'); }
function renderTravel() {
  if ($('travel').hidden || !me.st) return;
  const known = new Set(me.st.wps || []);
  let nextShown = false;
  const list = WAYPOINTS.filter(w => { if (w.id[0] !== 'z' || known.has(w.id)) return true; if (nextShown) return false; nextShown = true; return true; });
  $('travelList').innerHTML = list.map(w => {
    const z = w.id[0] === 'z' ? ZONES.find(q => 'z' + q.k === w.id) : null;
    const ok = known.has(w.id), home = me.st.wp === w.id;
    const here = Math.hypot(w.x - me.lx, w.y - me.ly) < 3;
    return `<div class="li tr${ok ? '' : ' off'}"><span class="grow"><b>${esc(w.name)}</b>${z ? ` <span class="note">niv. ${z.lv[0]}-${z.lv[1]}</span>` : ''}${home ? ' <span class="home">Réapparition</span>' : ''}<br><span class="note">${ok ? (here ? 'Tu es ici' : 'Activée') : 'Pas encore découverte : va la toucher'}</span></span>` +
      (ok ? `${here ? '' : `<button class="btn small" data-tp="${w.id}">Y aller</button>`}${home ? '' : `<button class="btn alt small" data-home="${w.id}">Réapparaître ici</button>`}` : '') + '</div>';
  }).join('');
  $('travelList').querySelectorAll('[data-tp]').forEach(b => b.onclick = () => { sendMsg({ t: 'wptp', id: b.dataset.tp }); $('travel').hidden = true; cancelAuto(); });
  $('travelList').querySelectorAll('[data-home]').forEach(b => b.onclick = () => { sendMsg({ t: 'wpset', id: b.dataset.home }); me.st.wp = b.dataset.home; renderTravel(); Snd.play('click'); });
}
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => { $(b.dataset.close).hidden = true; });

let selItem = null, bagTab = 'tous', bagAll = false, bulkKeep = true, bulkKeepGems = true, bulkArm = '', bulkRar = Math.min(6, +(store.get('ra_bulkrar') || 1));
let autoPot = +(store.get('ra_autopot') || 0); if (![0, 0.3, 0.5, 0.7].includes(autoPot)) autoPot = 0;
function setAutoPot(v) { autoPot = v; store.set('ra_autopot', String(v)); sendMsg({ t: 'autopot', v }); hudCache.potKey = ''; if (me.st) updateHud(); }
const STAT_LABEL = { hp: 'vie', def: 'défense', dmg: 'dégâts', crit: '% critique', spd: '% vitesse', cdmg: '% dégâts critiques' };
const bonusTxt = (stat, v) => `+${v} ${STAT_LABEL[stat]}`.replace('+' + v + ' %', '+' + v + ' %');
function setsHtml() {
  const list = me.sets || [];
  if (!list.length) return '<div class="note">Aucune panoplie : porte plusieurs objets du même nom (par exemple « du Faucon ») pour un bonus à 2, 4, 6 et 8 pièces.</div>';
  return list.map(e => `<div class="setrow"><span class="rc${e.r}">Panoplie ${esc(e.n)}</span> <span class="note">${e.c} / 9</span><div>${e.val ? `<b>${bonusTxt(e.stat, e.val)}</b>` : '<span class="note">Aucun bonus encore</span>'}${e.full ? ' · <b>+10 % dégâts et vie</b>' : ''}${e.next ? ` <span class="note">· à ${e.next[0]} pièces : ${bonusTxt(e.stat, e.next[1])}${e.next[0] === 8 ? ', +10 % dégâts et vie' : ''}</span>` : ''}</div></div>`).join('');
}
function statLine(st) { const o = []; if (st.dmg) o.push(`+${st.dmg} dégâts`); if (st.def) o.push(`+${st.def} défense`); if (st.hp) o.push(`+${st.hp} vie`); if (st.crit) o.push(`+${st.crit} % critique`); if (st.cdmg) o.push(`+${st.cdmg} % dégâts critiques`); if (st.spd) o.push(`+${st.spd} % vitesse`); return o.join(' · '); }
function cellHtml(it, extra = '') { return it ? `<img src="${icon(iconKey(it), it.r, tierOfL(it.l), accOfItem(it))}" alt=""><span class="lv">${it.l}</span>${extra}` : ''; }
let dollDir = 0;
function renderDoll() {
  const cv = $('bagDoll'); if (!cv || !me.st) return;
  const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height); g.imageSmoothingEnabled = false;
  const e = ents.get(myId) || {}, [dye] = String(e.look || 'base|-1').split('|');
  const dd = DEF.dyesDef && DEF.dyesDef[dye] && DEF.dyesDef[dye].c;
  const pal = dd ? Object.assign({}, PAL[me.cls], { b: dd[0], d: dd[1] }) : PAL[me.cls];
  const d = [0, 3, 1, 2][dollDir], spr = heroSprite(STYLE_OF[me.cls], pal, me.cls + (dd ? dye : ''), d === 2 ? 3 : d, 0, 'n', false, e.vis || '', dd ? dd[0] : '');
  g.save(); if (d === 2) { g.translate(cv.width, 0); g.scale(-1, 1); } g.drawImage(spr, 0, 0, HW * 3, HH * 3);
  const wv = parseVis(e.vis || '').arme, wk = WPN_OF[me.cls];
  if (wk && d !== 1) { const im = wk === 'bow' ? bowSprite(0, wv ? wv.t : -1, wv ? wv.a : 0) : wpnSprite(wk, wv ? wv.t : -1, wv ? wv.a : 0); const hx = d === 0 ? 16 : 12, hy = 21; g.translate(hx * 3, hy * 3); g.rotate(wk === 'bow' ? -0.1 : 0.4); g.drawImage(im, -im.ax * 3, -im.ay * 3, im.width * 3, im.height * 3); }
  g.restore();
}
function renderBag() {
  if ($('bag').hidden || !me.st) return;
  renderDoll();
  const eq = $('eqRow'); eq.innerHTML = '';
  for (const slot of ITEMDEF.slots) {
    const it = me.eq[slot], b = document.createElement('button');
    const lab = slot === 'arme' ? `Arme +${me.st.weap}` : SLOT_NAMES[slot];
    b.className = 'cell ' + (it ? 'r' + it.r : ''); b.innerHTML = it ? cellHtml(it, `<em>${lab}</em>`) : `<em>${lab}</em>`;
    if (selItem && it && selItem.id === it.id) b.classList.add('sel');
    b.onclick = () => { if (it) { selItem = it; renderBag(); showItem(it, true); } else if (slot === 'arme') showForgeInfo(); };
    eq.appendChild(b);
  }
  const ap = $('potAuto'); ap.innerHTML = '<span>Potion auto sous</span>' + [[0, 'Non'], [0.3, '30 %'], [0.5, '50 %'], [0.7, '70 %']].map(([v, l]) => `<button class="btn alt${autoPot === v ? ' on' : ''}" data-v="${v}">${l}</button>`).join('');
  ap.querySelectorAll('button').forEach(b => b.onclick = () => { setAutoPot(+b.dataset.v); renderBag(); Snd.play('click'); });
  $('statsLine').innerHTML = `<span>Dégâts <b>${me.st.dmg}</b></span><span>Défense <b>${me.st.def}</b></span><span>Vie <b>${me.st.mhp}</b></span><span>Critique <b>${me.st.crit} %</b> (×${((me.st.cdmg || 80) / 100 + 1).toFixed(2)})</span>${me.st.wear ? `<span style="color:var(--bad)">Usure <b>${me.st.wear} %</b></span>` : ''}<span>Vitesse <b>+${me.st.spd || 0} %</b></span>`;
  $('bagSets').innerHTML = setsHtml();
  $('bagCount').textContent = `${me.inv.length} / ${INV_SIZE}`;
  const counts = {}; for (const it of me.inv) counts[it.s] = (counts[it.s] || 0) + 1;
  const TAB_NAMES = { tous: 'Tous', arme: 'Armes', casque: 'Casques', armure: 'Armures', gants: 'Gants', bottes: 'Bottes', cape: 'Capes', ceinture: 'Ceintures', anneau: 'Anneaux', amulette: 'Amulettes' };
  $('bagTabs').innerHTML = ['tous', ...ITEMDEF.slots].map(k => `<button class="chip${bagTab === k ? ' on' : ''}" data-tab="${k}">${TAB_NAMES[k] || SLOT_NAMES[k]} <span class="note">${k === 'tous' ? me.inv.length : counts[k] || 0}</span></button>`).join('');
  $('bagTabs').querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { bagTab = b.dataset.tab; bulkArm = ''; renderBag(); Snd.play('click'); });
  const list = me.inv.filter(it => bagTab === 'tous' || it.s === bagTab).slice().sort((a, b) => bagTab === 'tous' ? 0 : (b.r - a.r) || (b.l - a.l));
  // vente et recyclage groupés (onglet affiché, jusqu'à la rareté choisie)
  const better = it => { const cur = me.eq[it.s]; if (it.s === 'arme' && it.c !== me.cls) return false; if (!cur) return true; const sc = x => (x.st.dmg || 0) * 3 + (x.st.def || 0) * 2 + (x.st.hp || 0) * 0.5 + (x.st.crit || 0) * 6 + (x.st.spd || 0) * 6; return sc(it) > sc(cur); };
  const bulkList = list.filter(it => it.r <= bulkRar && !(bulkKeep && better(it)) && !(it.g && it.g.length && bulkKeepGems));
  const gold = bulkList.reduce((a2, it) => a2 + it.value, 0), frags = bulkList.reduce((a2, it) => a2 + recycleFrags(it), 0);
  const where = bagTab === 'tous' ? 'du sac' : `de l'onglet ${(TAB_NAMES[bagTab] || '').toLowerCase()}`;
  $('bagBulk').innerHTML = `<div class="row"><span class="note">Rareté max :</span>${RAR_NAMES.map((n, r) => `<button class="chip rc${r}${r === bulkRar ? ' on' : ''}" data-br="${r}">${n}</button>`).join('')}</div>
    <div class="row"><label><input type="checkbox" id="bkKeep"${bulkKeep ? ' checked' : ''}> garder les objets meilleurs que les miens (▲)</label></div>
    <div class="row"><button class="btn small" id="bSellAll"${bulkList.length ? '' : ' disabled'}>${bulkArm === 'sell' ? `Confirmer : vendre ${bulkList.length} objet${bulkList.length > 1 ? 's' : ''} (${gold} or)` : `Tout vendre (${bulkList.length})`}</button>
      <button class="btn alt small" id="bRecAll"${bulkList.length ? '' : ' disabled'}>${bulkArm === 'rec' ? `Confirmer : recycler ${bulkList.length} (+${frags} fragments)` : `Tout recycler (${bulkList.length})`}</button></div>
    <div class="note">S'applique aux objets ${where}, jusqu'à la rareté ${RAR_NAMES[bulkRar].toLowerCase()}. L'équipement porté n'est jamais touché.</div>`;
  $('bagBulk').querySelectorAll('[data-br]').forEach(b => b.onclick = () => { bulkRar = +b.dataset.br; bulkArm = ''; store.set('ra_bulkrar', bulkRar); renderBag(); });
  $('bkKeep').onchange = () => { bulkKeep = $('bkKeep').checked; bulkArm = ''; renderBag(); };
  $('bSellAll').onclick = () => { if (bulkArm === 'sell') { sendMsg({ t: 'bulk', op: 'sell', ids: bulkList.map(i => i.id) }); bulkArm = ''; Snd.play('coin'); } else bulkArm = 'sell'; renderBag(); };
  $('bRecAll').onclick = () => { if (bulkArm === 'rec') { sendMsg({ t: 'bulk', op: 'recycle', ids: bulkList.map(i => i.id) }); bulkArm = ''; Snd.play('forge'); } else bulkArm = 'rec'; renderBag(); };
  const g = $('bagGrid'); g.innerHTML = '';
  const free = INV_SIZE - me.inv.length, shown = bagAll ? (bagTab === 'tous' ? INV_SIZE : list.length) : list.length + (bagTab === 'tous' ? Math.min(free, Math.max(5 - (list.length % 5 || 5), 0) + 5) : 0);
  for (let i = 0; i < shown; i++) {
    const it = list[i], b = document.createElement('button');
    b.className = 'cell ' + (it ? 'r' + it.r : ''); b.innerHTML = cellHtml(it);
    if (it && selItem && selItem.id === it.id) b.classList.add('sel');
    if (it) {
      const cur = me.eq[it.s];
      if (cur && !(it.s === 'arme' && it.c !== me.cls)) { const sc = x => (x.st.dmg || 0) * 3 + (x.st.def || 0) * 2 + (x.st.hp || 0) * 0.5 + (x.st.crit || 0) * 6 + (x.st.spd || 0) * 6; const dlt = sc(it) - sc(cur); if (Math.abs(dlt) > 0.5) b.insertAdjacentHTML('beforeend', `<b class="up ${dlt > 0 ? 'ok' : 'ko'}">${dlt > 0 ? '▲' : '▼'}</b>`); }
      else if (!cur && !(it.s === 'arme' && it.c !== me.cls)) b.insertAdjacentHTML('beforeend', '<b class="up ok">▲</b>');
      b.onclick = () => { selItem = it; renderBag(); showItem(it, false); };
    } else b.tabIndex = -1;
    g.appendChild(b);
  }
  if (!list.length && bagTab !== 'tous') g.innerHTML = `<div class="note" style="grid-column:1/-1;padding:8px 2px">Aucun objet de ce type dans ton sac.</div>`;
  $('bagFree').textContent = `${free} place${free > 1 ? 's' : ''} libre${free > 1 ? 's' : ''}`;
  $('bagScroll').classList.toggle('all', bagAll);
  $('bagAll').textContent = bagAll ? '▲ Réduire' : `▼ Tout afficher (${INV_SIZE} places)`;
  $('bagAll').onclick = () => { bagAll = !bagAll; renderBag(); if (bagAll) $('bagScroll').scrollIntoView({ block: 'start', behavior: 'smooth' }); };
  const still = selItem && (me.inv.some(i => i.id === selItem.id) || Object.values(me.eq).some(i => i && i.id === selItem.id));
  if (selItem && !still) selItem = null;
}
function itemCard(it) {
  const eff = it.eff < it.l ? `affaibli au niv. ${it.eff} (ton niveau)` : it.eff > it.l ? `renforcé au niv. ${it.eff}` : `au niv. ${it.eff}`;
  let setLine = '';
  if (it.set) { const worn = (me.sets || []).find(e => e.n === it.set.n && e.r === it.r); setLine = `<div class="note" style="margin-top:3px">Panoplie <span class="rc${it.r}">${esc(it.set.n)}</span> (bonus de ${STAT_LABEL[it.set.stat].replace('% ', '')}) : ${worn ? worn.c : 0} / 9 pièces portées</div>`; }
  const kind = it.s === 'arme' && it.c ? `Arme de ${CLASSES[it.c].name.toLowerCase()}` : SLOT_NAMES[it.s];
  return `<div class="nm rc${it.r}">${esc(it.name)}</div><div class="note">${RAR_NAMES[it.r]} · ${kind} · objet niv. ${it.l}, ${eff}</div><div style="margin-top:4px">${statLine(it.st)}</div>${setLine}`;
}
function closeItemPop() { $('itemPop').hidden = true; selItem = null; renderBag(); }
function showForgeInfo() {
  $('ipBody').innerHTML = `<div class="nm rc1">Emplacement d'arme</div><div class="note">Aucune arme équipée. Les monstres font tomber des armes de chaque classe et de chaque rareté. Brann le forgeron peut ensuite l'améliorer jusqu'à +9.</div>`;
  $('ipActs').innerHTML = '<button class="btn alt" id="ipClose2">Fermer</button>'; $('ipClose2').onclick = closeItemPop; $('itemPop').hidden = false;
}
function showItem(it, equipped) {
  const cur = me.eq[it.s];
  const wrongCls = it.s === 'arme' && it.c !== me.cls;
  let cmp = '';
  if (!equipped && !wrongCls) {
    const LBL = { dmg: 'Dégâts', def: 'Défense', hp: 'Vie', crit: 'Critique %', spd: 'Vitesse %' };
    const rows = ['dmg', 'def', 'hp', 'crit', 'spd'].map(k => {
      const a = cur ? (cur.st[k] || 0) : 0, b = it.st[k] || 0, d = b - a;
      if (!a && !b) return '';
      return `<tr><td>${LBL[k]}</td><td class="num">${a || '–'}</td><td class="num">${b || '–'}</td><td class="num ${d > 0 ? 'ok' : d < 0 ? 'ko' : ''}">${d > 0 ? '▲ +' + d : d < 0 ? '▼ ' + d : '='}</td></tr>`;
    }).join('');
    const gemTxt = x => x && x.g && x.g.length ? x.g.length + ' gemme' + (x.g.length > 1 ? 's' : '') : '';
    const extra = [];
    if (cur && cur.set && (!it.set || it.set.n !== cur.set.n)) extra.push(`tu quittes la panoplie <span class="rc${cur.r}">${esc(cur.set.n)}</span>`);
    if (it.set && (!cur || !cur.set || cur.set.n !== it.set.n)) extra.push(`tu rejoins la panoplie <span class="rc${it.r}">${esc(it.set.n)}</span>`);
    if (cur && (cur.u || 0) > (it.u || 0)) extra.push(`l'objet équipé est forgé à +${cur.u}`);
    if (cur && gemTxt(cur)) extra.push(`l'objet équipé porte ${gemTxt(cur)} (perdue${cur.g.length > 1 ? 's' : ''} s'il est vendu)`);
    cmp = `<div class="cmpbox"><div class="cmphead"><div><span class="note">Équipé</span><br>${cur ? `<span class="rc${cur.r}">${esc(cur.name)}</span>` : '<span class="note">rien</span>'}</div><div><span class="note">Cet objet</span><br><span class="rc${it.r}">${esc(it.name)}</span></div></div>
      <table class="cmp"><tr><th></th><th>Équipé</th><th>Nouveau</th><th>Écart</th></tr>${rows}</table>${extra.length ? `<div class="note">À savoir : ${extra.join(' · ')}.</div>` : ''}</div>`;
  } else if (equipped) {
    cmp = '<div class="note" style="margin-top:6px">Objet équipé. Touche un objet du même type dans ton sac pour comparer.</div>';
  }
  const warn = wrongCls ? `<div class="note" style="margin-top:6px;color:var(--bad)">Réservée à la classe ${esc(CLASSES[it.c].name)} : tu peux la vendre ou l'échanger.</div>` : '';
  let sock = '';
  if (it.sk) {
    const owned = Object.entries(P().mat || {}).filter(([k, n]) => k.startsWith('g_') && n > 0).map(([k]) => k.slice(2)).sort();
    sock = '<div class="sub2">Emplacements de gemme</div>';
    for (let i = 0; i < it.sk; i++) {
      const c = (it.g || [])[i];
      sock += c ? `<div class="row2"><span class="gemdot" style="background:${GEM_COL[c[0]]}"></span><div class="grow">${esc(gemName(c))} <span class="note">${gemStatTxt(c)}</span></div><button class="btn alt small" data-unsock="${i}">Détruire</button></div>`
        : `<div class="row2"><div class="grow"><span class="note">Emplacement libre</span><div class="chips" style="margin-top:4px">${owned.length ? owned.slice(0, 8).map(g => `<button class="chip" data-sock="${g}"><span class="gemdot" style="background:${GEM_COL[g[0]]}"></span>${esc(gemName(g))}</button>`).join('') : '<span class="note">Aucune gemme dans ton sac.</span>'}</div></div></div>`;
    }
  }
  $('ipBody').innerHTML = itemCard(it) + cmp + warn + sock;
  $('ipBody').querySelectorAll('[data-sock]').forEach(b => b.onclick = () => { sendMsg({ t: 'socket', id: it.id, gem: b.dataset.sock }); closeItemPop(); });
  $('ipBody').querySelectorAll('[data-unsock]').forEach(b => b.onclick = () => { if (b.dataset.sure) { sendMsg({ t: 'unsocket', id: it.id, i: +b.dataset.unsock }); closeItemPop(); } else { b.dataset.sure = 1; b.textContent = 'Confirmer'; } });
  const acts = [];
  if (equipped) acts.push('<button class="btn" id="iUn">Retirer</button>');
  else { if (!wrongCls) acts.push(`<button class="btn" id="iEq">${cur ? 'Remplacer' : 'Équiper'}</button>`); acts.push(`<button class="btn alt" id="iSell">Vendre (${it.value} or)</button>`); acts.push(`<button class="btn alt" id="iRec">Recycler (+${recycleFrags(it)} fragments)</button>`); }
  acts.push('<button class="btn alt" id="ipClose2">Fermer</button>');
  $('ipActs').innerHTML = acts.join('');
  if ($('iEq')) $('iEq').onclick = () => { sendMsg({ t: 'equip', id: it.id }); Snd.play('click'); closeItemPop(); };
  if ($('iSell')) $('iSell').onclick = () => { sendMsg({ t: 'sell', id: it.id }); Snd.play('coin'); closeItemPop(); };
  if ($('iUn')) $('iUn').onclick = () => { sendMsg({ t: 'unequip', slot: it.s }); closeItemPop(); };
  if ($('iRec')) $('iRec').onclick = () => { const b = $('iRec'); if (b.dataset.sure) { sendMsg({ t: 'recycle', id: it.id }); closeItemPop(); } else { b.dataset.sure = 1; b.textContent = 'Confirmer le recyclage'; } };
  $('ipClose2').onclick = closeItemPop;
  $('itemPop').hidden = false;
}
$('ipClose').onclick = closeItemPop;

// Catalogue de tous les équipements
let catSlot = 'tous', catRar = 2, catCls = null;
function previewStats(slot, r, L, cls) {
  const m = ITEMDEF.mult[r], st = {};
  const base = slot === 'arme' ? ITEMDEF.weaponStats[cls] : ITEMDEF.stats[slot];
  for (const [k, v] of Object.entries(base)) st[k] = Math.max(1, Math.round(v * L * m));
  return st;
}
function renderCat() {
  if ($('cat').hidden || !ITEMDEF || !me.st) return;
  const lvl = me.st.pl || me.st.lvl;
  $('catSlots').innerHTML = ['tous', ...ITEMDEF.slots].map(s => `<button class="chip${s === catSlot ? ' on' : ''}" data-s="${s}">${s === 'tous' ? 'Tous' : SLOT_NAMES[s]}</button>`).join('');
  if (!catCls) catCls = me.cls;
  $('catCls').hidden = !(catSlot === 'arme' || catSlot === 'tous');
  $('catCls').innerHTML = Object.keys(ITEMDEF.names.arme).map(c => `<button class="chip${c === catCls ? ' on' : ''}" data-c="${c}">Armes ${esc(CLASSES[c].name)}</button>`).join('');
  $('catRars').innerHTML = RAR_NAMES.map((n, r) => `<button class="chip rc${r}${r === catRar ? ' on' : ''}" data-r="${r}">${n}</button>`).join('');
  const rows = [];
  for (const slot of ITEMDEF.slots) {
    if (catSlot !== 'tous' && slot !== catSlot) continue;
    (slot === 'arme' ? ITEMDEF.names.arme[catCls] : ITEMDEF.names[slot]).forEach((name, t) => {
      const TL = ITEMDEF.tierLo || [1, 7, 13, 19, 25, 41, 101, 301], lo = TL[t], hi = t < TL.length - 1 ? TL[t + 1] - 1 : 1000;
      const E = Math.max(1, Math.min(hi + 3, lvl));
      const st = previewStats(slot, catRar, E, catCls), stMax = previewStats(slot, catRar, hi + 3, catCls);
      const mobs = Object.values(MT).filter(m => m.lvl >= lo - 1 && m.lvl <= hi + 1).map(m => m.name);
      const now = lvl >= lo - 2 && lvl <= hi + 3;
      rows.push(`<div class="crow${now ? ' now' : ''}"><span class="cell r${catRar}"><img src="${icon(iconKey({ s: slot, c: catCls }), catRar, t, 0)}" alt=""></span><div class="cinfo"><div class="nm rc${catRar}">${esc(name)}</div><div class="note">${slot === 'arme' ? 'Arme de ' + esc(CLASSES[catCls].name.toLowerCase()) : SLOT_NAMES[slot]} · objets niv. ${lo} à ${hi}${now ? ' · à ta portée' : ''}${slot === 'arme' && catCls !== me.cls ? ' · pas ta classe' : ''}</div><div>Pour toi (niv. ${lvl}) : ${statLine(st)}</div><div class="note">Au maximum (niv. ${hi + 3}) : ${statLine(stMax)}${catRar ? ` · + ${Math.min(4, catRar)} bonus au hasard` : ''}</div><div class="note">Butin : ${mobs.length ? esc(mobs.join(', ')) : 'monstres de ce niveau'}, Gouffre</div></div></div>`);
    });
  }
  let setsInfo = '';
  if (catRar) {
    const L = me.st.lvl, m = ITEMDEF.mult[catRar];
    const val = (stat, f) => Math.max(1, Math.round({ hp: 1.2, def: 0.4, dmg: 0.3, crit: 0.12, spd: 0.08 }[stat] * L * m * f));
    setsInfo = `<div class="setbox"><div class="note">Panoplies ${RAR_NAMES[catRar].toLowerCase()}s : porte des objets du même nom pour un bonus à 2, 4, 6 et 8 pièces (valeurs à ton niveau). Les 8 pièces ajoutent +10 % de dégâts et de vie. L'arme compte aussi.</div>` +
      ITEMDEF.suffix[catRar].map((n, i) => { const st = ITEMDEF.setStat[catRar][i]; return `<div class="setrow"><span class="rc${catRar}">${esc(n)}</span> <span class="note">${STAT_LABEL[st].replace('% ', '')}</span><div class="note">${ITEMDEF.setSteps.map(([c, f]) => `${c} p. : ${bonusTxt(st, val(st, f))}`).join(' · ')}</div></div>`; }).join('') + '</div>';
  }
  $('catList').innerHTML = setsInfo + rows.join('');
  $('catNote').textContent = `Statistiques indicatives pour ton niveau (${lvl}), avant les variations de chaque objet. Un objet suit ton niveau jusqu'à 3 niveaux au-dessus du sien : plus faible si tu es en dessous, plus fort quand tu montes.`;
  $('catSlots').querySelectorAll('button').forEach(b => b.onclick = () => { catSlot = b.dataset.s; renderCat(); });
  $('catRars').querySelectorAll('button').forEach(b => b.onclick = () => { catRar = +b.dataset.r; renderCat(); });
  $('catCls').querySelectorAll('button').forEach(b => b.onclick = () => { catCls = b.dataset.c; renderCat(); });
}
$('bagCat').onclick = () => togglePanel('cat');

function openDlg(o) {
  closePanels();
  $('dlgTitle').textContent = o.title; $('dlgText').textContent = o.text;
  const box = $('dlgOpts'); box.innerHTML = '';
  for (const op of o.opts) {
    const b = document.createElement('button'); b.className = 'btn' + (op.id === 'close' || op.id === 'qdrop' ? ' alt' : ''); b.textContent = op.label; b.disabled = !!op.off;
    b.onclick = () => { $('dlg').hidden = true; sendMsg({ t: 'dlg', id: op.id }); Snd.play('click'); };
    box.appendChild(b);
  }
  $('dlg').hidden = false;
}

document.querySelectorAll('.tab').forEach(t => t.onclick = () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === t));
  for (const k of ['grp', 'brd', 'emo']) $('tab-' + k).hidden = k !== t.dataset.tab;
  if (t.dataset.tab === 'brd') requestBoard();
  if (t.dataset.tab === 'grp') renderSocial();
});
document.querySelectorAll('[data-emo]').forEach(b => b.onclick = () => { doEmote(b.dataset.emo); $('social').hidden = true; });
function doEmote(k) { sendMsg({ t: 'emote', k }); if (window.RA_emote) window.RA_emote(k); }
function partyMembers() {
  if (LOCAL && window.RA_party) return window.RA_party();
  return (me.st && me.st.pt || []).map(([id, name, cls, lvl, hp, mhp]) => ({ name, cls, lvl, hp, mhp }));
}
function renderSocial() {
  if ($('social').hidden || $('tab-grp').hidden) return;
  const mem = partyMembers(), box = $('tab-grp');
  let h = '';
  if (mem.length) {
    h += '<div class="list">' + mem.map(m => `<div class="li"><span class="grow">${esc(m.name)}</span><span class="note">${esc((CLASSES[m.cls] || {}).name || '')} · Niv. ${m.lvl | 0}</span></div>`).join('') + '</div>';
    h += '<div style="margin-top:8px"><button class="btn alt" id="pLeave">Quitter le groupe</button></div>';
  } else h += "<div class=\"note\">Tu n'es dans aucun groupe. Touche un joueur dans le monde pour l'inviter (4 joueurs maximum).</div>";
  h += `<div class="note" style="margin-top:10px">${LOCAL ? "Ici, chaque joueur a ses propres monstres. Chaque membre du groupe à moins de 15 cases te donne +15 % d'XP." : "En groupe, l'XP est partagée entre les membres proches, le Cri de guerre touche tout le groupe et vous entrez ensemble dans le Gouffre."}</div>`;
  box.innerHTML = h;
  if ($('pLeave')) $('pLeave').onclick = () => { if (LOCAL && window.RA_leaveParty) window.RA_leaveParty(); else sendMsg({ t: 'party', op: 'leave' }); $('social').hidden = true; };
}
function requestBoard() {
  $('tab-brd').innerHTML = '<div class="note">Chargement…</div>';
  if (LOCAL) { if (window.RA_board) window.RA_board(renderBoard); else renderBoard(null); } else sendMsg({ t: 'board' });
}
function renderBoard(rows) {
  if (!rows) { $('tab-brd').innerHTML = "<div class=\"note\">Le classement partagé n'est pas disponible ici.</div>"; return; }
  if (!rows.length) { $('tab-brd').innerHTML = "<div class=\"note\">Personne au classement pour l'instant. Gagne un niveau pour y apparaître.</div>"; return; }
  $('tab-brd').innerHTML = '<div class="list">' + rows.map((r, i) => `<div class="li"><span class="rank">${i + 1}</span><span class="grow">${esc(r[0])}</span><span class="note">${esc((CLASSES[r[1]] || {}).name || '')} · Niv. ${r[2] | 0}${r[3] ? ` · ${r[3]} renaissance${r[3] > 1 ? 's' : ''}` : ''}${r[4] ? ` · tour ${r[4]}` : ''}</span></div>`).join('') + '</div>';
}
function renderParty() {
  const mem = partyMembers();
  setHtml('party', mem.map(m => `<div class="pm frame"><div style="display:flex;justify-content:space-between;gap:4px"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(m.name)}</span><span style="color:var(--muted)">${m.lvl | 0}</span></div><div class="bar hp"><i style="transform:scaleX(${Math.max(0, Math.min(1, (m.hp || 0) / (m.mhp || 1))).toFixed(2)})"></i></div></div>`).join(''));
}

let pcTarget = null;
function openPcard(e) {
  closePanels();
  pcTarget = e.peer ? { kind: 'peer', peer: e.peer, name: e.name } : { kind: 'srv', id: e.id, name: e.name };
  $('pcName').textContent = e.name;
  $('pcInfo').textContent = `${(CLASSES[e.cls] || {}).name || ''} · niveau ${e.lvl | 0}${e.ally ? ' · dans ton groupe' : ''}`;
  $('pcInv').hidden = !!e.ally;
  $('pcard').hidden = false;
}
$('pcInv').onclick = () => { $('pcard').hidden = true; if (!pcTarget) return; if (pcTarget.kind === 'peer') window.RA_invite && window.RA_invite(pcTarget); else sendMsg({ t: 'party', op: 'invite', to: pcTarget.id }); };
$('pcTrade').onclick = () => { $('pcard').hidden = true; if (!pcTarget) return; if (pcTarget.kind === 'peer') window.RA_tradeReq && window.RA_tradeReq(pcTarget); else sendMsg({ t: 'trade', op: 'req', to: pcTarget.id }); };

let askCtx = null, askTimer = null;
function showAsk(kind, name, from) {
  askCtx = { kind, from };
  $('askText').textContent = kind === 'party' ? `${name} t'invite dans son groupe.` : `${name} te propose un échange.`;
  $('ask').hidden = false; Snd.play('click');
  clearTimeout(askTimer); askTimer = setTimeout(() => answerAsk(false), 20000);
}
function answerAsk(yes) {
  $('ask').hidden = true; clearTimeout(askTimer);
  const a = askCtx; askCtx = null; if (!a) return;
  if (a.from.kind === 'peer') { if (window.RA_answer) window.RA_answer(a.kind, a.from, yes); return; }
  sendMsg({ t: a.kind, op: yes ? 'accept' : 'decline', from: a.from.id });
}
$('qtrack').addEventListener('click', () => { if (auto.mode === 'quest') cancelAuto(); else { if (auto.farm) setFarm(false); startQuest(); } hudCache.hqtrack = ''; updateHud(); });
$('askYes').onclick = () => answerAsk(true); $('askNo').onclick = () => answerAsk(false);

let trade = null;
const descWaiters = {}; let descRef = 0;
function describe(raw, cb) { const ref = ++descRef; descWaiters[ref] = cb; sendMsg({ t: 'describe', ref, items: raw }); }
function renderTrade() {
  if (!trade) return;
  closePanels(); $('trade').hidden = false;
  $('trWith').textContent = 'avec ' + trade.withName;
  const col = (title, o, ok) => `<h4><span>${esc(title)}</span>${ok ? '<span class="ok">Validé</span>' : ''}</h4>` +
    (o.items.length ? o.items.map(it => `<div class="ti rc${it.r}">${esc(it.name)}</div>`).join('') : '<div class="note">Aucun objet</div>') + `<div class="note" style="margin-top:4px">${o.gold | 0} or</div>`;
  $('trMine').innerHTML = col('Toi', trade.mine, trade.okMe);
  $('trTheirs').innerHTML = col(trade.withName, trade.theirs, trade.okThem);
  if (document.activeElement !== $('trGold')) $('trGold').value = trade.mine.gold | 0;
  $('trOk').disabled = trade.okMe;
  $('trStatus').textContent = trade.okMe && !trade.okThem ? `En attente de ${trade.withName}…` : trade.okThem && !trade.okMe ? `${trade.withName} a validé.` : '';
  renderTradeGrid();
}
function renderTradeGrid() {
  if (!trade || $('trade').hidden) return;
  const g = $('trGrid'); g.innerHTML = '';
  const offered = new Set(trade.mine.items.map(i => i.id));
  for (const it of me.inv) {
    const b = document.createElement('button'); b.className = 'cell r' + it.r + (offered.has(it.id) ? ' sel' : ''); b.innerHTML = cellHtml(it); b.title = it.name;
    b.onclick = () => {
      const ids = trade.mine.items.map(i => i.id);
      sendOffer(offered.has(it.id) ? ids.filter(x => x !== it.id) : ids.concat(it.id).slice(0, 8), +$('trGold').value || 0);
    };
    g.appendChild(b);
  }
}
function sendOffer(ids, gold) {
  gold = Math.max(0, Math.min(me.st ? me.st.gold : 0, Math.floor(gold)));
  if (trade.srv) sendMsg({ t: 'trade', op: 'offer', items: ids, gold });
  else if (window.RA_tradeOffer) window.RA_tradeOffer(ids, gold);
}
$('trGold').addEventListener('change', () => { if (trade) sendOffer(trade.mine.items.map(i => i.id), +$('trGold').value || 0); });
$('trOk').onclick = () => { if (!trade) return; if (trade.srv) sendMsg({ t: 'trade', op: 'confirm' }); else if (window.RA_tradeConfirm) window.RA_tradeConfirm(); };
const cancelTrade = () => { if (!trade) return; if (trade.srv) sendMsg({ t: 'trade', op: 'cancel' }); else if (window.RA_tradeCancel) window.RA_tradeCancel(); closeTradeUI(); };
$('trCancel').onclick = cancelTrade; $('trX').onclick = cancelTrade;
function closeTradeUI() { trade = null; $('trade').hidden = true; }

/* ============================================================
   Effets
   ============================================================ */
function spawnFx(f) {
  if (f.dl > 0) { const g = { ...f, dl: 0 }; setTimeout(() => spawnFx(g), f.dl * 1000); return; }
  logFx(f);
  const mine = f.id === myId || f.by === myId;
  const near = me.has && Math.hypot(f.x - me.lx, f.y - me.ly) < 12;
  const burst = (n, col, up = 1.5) => { for (let i = 0; i < n; i++) { const a = Math.random() * 7, v = 0.5 + Math.random() * 2; particles.push({ x: f.x + Math.cos(a) * 0.3, y: f.y - 0.5, vx: Math.cos(a) * v, vy: Math.sin(a) * v - up, life: 0.9, max: 0.9, c: col, s: 1.5 }); } };
  switch (f.k) {
    case 'hit':
      if (showDmg || f.c || f.on === 'p') texts.push({ x: f.x + (Math.random() - 0.5) * 0.4, y: f.y, t: f.v + (f.c ? ' !' : ''), c: f.on === 'p' ? '#ff6a5a' : (f.c ? '#ffd23a' : '#ffffff'), big: f.c ? 1.4 : 1, life: 0.9, max: 0.9 });
      if (f.on === 'p' && f.id === myId) Snd.play('hurt'); else if (mine) Snd.play(f.c ? 'crit' : 'hit');
      break;
    case 'warn': shapes.push({ k: 'warn', x: f.x, y: f.y, r: f.r, life: f.d || 1.5, max: f.d || 1.5 }); if (near) Snd.play('click'); break;
    case 'laser': shapes.push({ k: 'laser', x: f.x, y: f.y, x2: f.x2, y2: f.y2, life: 0.6, max: 0.6 }); for (let i = 0; i < 24; i++) { const q = Math.random(); particles.push({ x: f.x + (f.x2 - f.x) * q, y: f.y + (f.y2 - f.y) * q, vx: (Math.random() - 0.5) * 2, vy: -Math.random() * 2, life: 0.6, max: 0.6, c: '#fff2a8', s: 1.6 }); } if (near) Snd.play('boom'); break;
    case 'absorb': texts.push({ x: f.x, y: f.y, t: `(${f.v})`, c: '#9ad0ff', big: 0.9, life: 0.8, max: 0.8 }); break;
    case 'slash': {
      const col = f.c === 'paladin' ? '255,220,120' : f.c === 'assassin' ? '255,110,150' : '235,245,255';
      if (f.c === 'assassin') { shapes.push({ k: 'xslash', x: f.x, y: f.y, d: f.d, life: 0.22, max: 0.22, col }); }
      else shapes.push({ k: 'crescent', x: f.x, y: f.y, d: f.d, life: f.c === 'paladin' ? 0.3 : 0.24, max: f.c === 'paladin' ? 0.3 : 0.24, col, heavy: f.c === 'paladin' });
      const [ox, oy] = [[0, 0.9], [0, -0.9], [-0.9, 0], [0.9, 0]][f.d] || [0, 0];
      for (let i = 0; i < 5; i++) particles.push({ x: f.x + ox, y: f.y - 0.4 + oy * 0.6, vx: ox * 3 + (Math.random() - 0.5) * 3, vy: oy * 2 + (Math.random() - 0.5) * 3, life: 0.25, max: 0.25, c: `rgb(${col})`, s: 1.2, delay: 0.08 });
      if (f.c === 'paladin') shapes.push({ k: 'ring', x: f.x + ox, y: f.y + oy * 0.6, r: 0.8, c: '#ffd77a', w: 2, life: 0.3, max: 0.3, delay: 0.12 });
      if (mine) Snd.play('swing'); break;
    }
    case 'cast': {
      const ce = ents.get(f.id); if (ce) { ce.castT0 = time; ce.castK = f.sk; }
      switch (f.sk) {
        case 'guerrier0': shapes.push({ k: 'whirl', x: f.x, y: f.y, id: f.id, r: 2.4, life: 0.5, max: 0.5 }); for (let i = 0; i < 18; i++) { const a = Math.random() * 7; particles.push({ x: f.x + Math.cos(a) * 1.8, y: f.y + Math.sin(a) * 1, vx: Math.cos(a) * 2, vy: -0.6, life: 0.5, max: 0.5, c: '#c8b898', s: 2 }); } break;
        case 'guerrier2': for (let i = 0; i < 3; i++) shapes.push({ k: 'ring', x: f.x, y: f.y - 0.3, r: 3 + i * 2, c: i % 2 ? '#ffd23a' : '#ff6a3a', w: 3, life: 0.5, max: 0.5, delay: i * 0.12 }); burst(24, '#ffb040', 2.5); break;
        case 'archere0': for (let i = 0; i < 10; i++) particles.push({ x: f.x + (Math.random() - 0.5) * 0.6, y: f.y - 0.7, vx: (Math.random() - 0.5) * 2, vy: -1.5, life: 0.4, max: 0.4, c: '#ffe28a', s: 1.3 }); break;
        case 'archere2': shapes.push({ k: 'upArrow', x: f.x, y: f.y, life: 0.35, max: 0.35 }); break;
        case 'mage0': shapes.push({ k: 'rune', x: f.x, y: f.y, r: 1.3, c: '120,170,255', life: 0.6, max: 0.6 }); break;
        case 'mage1': for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283; particles.push({ x: f.x, y: f.y - 0.7, vx: Math.cos(a) * 3, vy: Math.sin(a) * 2, life: 0.4, max: 0.4, c: i % 2 ? '#ffffff' : '#7ad0ff', s: 1.6 }); } break;
        case 'paladin1': shapes.push({ k: 'beam', x: f.x, y: f.y, life: 0.8, max: 0.8 }); break;
        case 'assassin1': for (let i = 0; i < 8; i++) shapes.push({ k: 'puff', x: f.x + (Math.random() - 0.5) * 2, y: f.y + (Math.random() - 0.5), r: 1 + Math.random(), life: 0.9, max: 0.9, c: '90,88,102', delay: Math.random() * 0.2 }); break;
        case 'druide1': for (let i = 0; i < 16; i++) { const a = Math.random() * 7; particles.push({ x: f.x + Math.cos(a), y: f.y + Math.sin(a) * 0.5, vx: -Math.sin(a) * 2, vy: -1.6, life: 0.8, max: 0.8, c: i % 2 ? '#5ac84a' : '#c8f0a0', s: 1.8 }); } break;
      }
      break;
    }
    case 'shadow': {
      const ce = ents.get(f.id);
      if (ce && ce.lastSpr) shapes.push({ k: 'ghost', x: f.x, y: f.y, spr: ce.lastSpr, flip: ce.lastFlip, tint: '#a050ff', life: 0.6, max: 0.6 });
      shapes.push({ k: 'trail', x: f.x, y: f.y, x2: f.x2, y2: f.y2, c: '170,80,255', life: 0.3, max: 0.3 });
      break;
    }
    case 'slam': shapes.push({ k: 'ring', x: f.x, y: f.y, r: 1.2, c: '#ffd77a', w: 2, life: 0.3, max: 0.3 }); break;
    case 'thorn': shapes.push({ k: 'thornP', x: f.x, y: f.y, x2: f.x2, y2: f.y2, life: 0.22, max: 0.22 });
      for (let i = 0; i < 6; i++) particles.push({ x: f.x2, y: f.y2, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 3 - 1, life: 0.4, max: 0.4, c: i % 2 ? '#4ab83a' : '#a0e070', s: 1.6, delay: 0.2 });
      if (mine) Snd.play('arrow'); break;
    case 'holy': shapes.push({ k: 'cross', x: f.x, y: f.y, life: 0.7, max: 0.7, big: f.r > 4 }); shapes.push({ k: 'ring', x: f.x, y: f.y - 0.3, r: f.r, c: '#ffe08a', w: 3, life: 0.4, max: 0.4 }); for (let i = 0; i < 18; i++) particles.push({ x: f.x + (Math.random() - 0.5) * f.r, y: f.y - Math.random(), vx: 0, vy: -1.5, life: 0.7, max: 0.7, c: '#fff0a0', s: 1.5 }); if (near) Snd.play('shout'); break;
    case 'judge': shapes.push({ k: 'skysword', x: f.x, y: f.y, life: 0.7, max: 0.7 }); shapes.push({ k: 'pillar', x: f.x, y: f.y, life: 0.7, max: 0.7, delay: 0.25 }); shapes.push({ k: 'ring', x: f.x, y: f.y, r: 2.2, c: '#fff0a0', w: 3, life: 0.4, max: 0.4, delay: 0.28 }); if (near) setTimeout(() => Snd.play('boom'), 250); break;
    case 'smoke': for (let i = 0; i < (f.big ? 7 : 3); i++) shapes.push({ k: 'puff', x: f.x + (Math.random() - 0.5) * (f.big ? 1.6 : 0.8), y: f.y + (Math.random() - 0.5) * 0.5, r: (f.big ? 1.2 : 0.7) + Math.random() * 0.5, life: 0.8, max: 0.8, c: '80,76,96' });
      for (let i = 0; i < (f.big ? 40 : 16); i++) { const a = Math.random() * 7, v = 0.5 + Math.random() * 1.5; particles.push({ x: f.x, y: f.y - 0.4, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 0.4, life: 0.8, max: 0.8, c: Math.random() < 0.5 ? '#5a5866' : '#8a8898', s: f.big ? 3 : 2 }); } if (near) Snd.play('dash'); break;
    case 'roots': shapes.push({ k: 'vines', x: f.x, y: f.y, r: f.r, life: 1.1, max: 1.1, seed: Math.random() * 100 }); shapes.push({ k: 'ring', x: f.x, y: f.y, r: f.r, c: '#6ad04a', w: 3, life: 0.45, max: 0.45 }); for (let i = 0; i < 20; i++) { const a = Math.random() * 7, rr = Math.random() * f.r; particles.push({ x: f.x + Math.cos(a) * rr, y: f.y + Math.sin(a) * rr * 0.6, vx: 0, vy: -2.5, life: 0.5, max: 0.5, c: Math.random() < 0.5 ? '#4ab83a' : '#6a4a2a', s: 2 }); } if (near) Snd.play('spin'); break;
    case 'storm': shapes.push({ k: 'cloud', x: f.x, y: f.y, r: f.r, life: 0.55, max: 0.55 }); for (let i = 0; i < 2; i++) { const a = Math.random() * 7, rr = Math.random() * f.r; shapes.push({ k: 'bolt2', x: f.x + Math.cos(a) * rr, y: f.y + Math.sin(a) * rr * 0.6, life: 0.18, max: 0.18 }); } if (near) Snd.play('hit'); break;
    case 'blades': shapes.push({ k: 'orbit', x: f.x, y: f.y, r: f.r * 0.6, life: 0.42, max: 0.42 }); shapes.push({ k: 'ring', x: f.x, y: f.y - 0.4, r: f.r, c: '#ff8090', w: 1, life: 0.3, max: 0.3 }); if (near) Snd.play('swing'); break;
    case 'arrow': shapes.push({ k: 'arrow', x: f.x, y: f.y, x2: f.x2, y2: f.y2, big: f.big, life: 0.18, max: 0.18 });
      for (let i = 0; i < (f.big ? 7 : 4); i++) particles.push({ x: f.x2, y: f.y2, vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3, life: 0.25, max: 0.25, c: f.big ? '#ffe28a' : '#fff4d0', s: 1.2, delay: 0.17 }); if (mine || (f.big && near)) Snd.play('arrow'); break;
    case 'bolt': shapes.push({ k: 'bolt', x: f.x, y: f.y, x2: f.x2, y2: f.y2, life: 0.2, max: 0.2 });
      for (let i = 0; i < 8; i++) particles.push({ x: f.x2, y: f.y2, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, life: 0.4, max: 0.4, c: i % 2 ? '#9a8cff' : '#d8d0ff', s: 2, delay: 0.18 });
      shapes.push({ k: 'ring', x: f.x2, y: f.y2 + 0.4, r: 0.7, c: '#b8a8ff', w: 2, life: 0.25, max: 0.25, delay: 0.18 });
      if (mine) Snd.play('bolt'); break;
    case 'spin': shapes.push({ k: 'ring', x: f.x, y: f.y - 0.3, r: f.r, c: '#f3e6c8', life: 0.3, max: 0.3 }); if (f.r < 2) { shapes.push({ k: 'ring', x: f.x, y: f.y, r: 2.2, c: '#ffd23a', w: 3, life: 0.35, max: 0.35 }); burst(14, '#c8b898', 1); } if (near) Snd.play('spin'); break;
    case 'meteor': shapes.push({ k: 'rune', x: f.x, y: f.y, r: f.r * 0.8, c: '255,120,40', life: 0.55, max: 0.55 }); shapes.push({ k: 'scorch', x: f.x, y: f.y, r: f.r * 0.7, life: 3, max: 3, delay: 0.3 }); shapes.push({ k: 'meteor', x: f.x, y: f.y, r: f.r, life: 0.55, max: 0.55 }); if (near) setTimeout(() => Snd.play('boom'), 250); break;
    case 'quake': shapes.push({ k: 'ring', x: f.x, y: f.y, r: f.r, c: '#ff5a2a', w: 3, life: 0.45, max: 0.45 }); if (near) Snd.play('quake');
      for (let i = 0; i < 24; i++) { const a = Math.random() * 7; particles.push({ x: f.x + Math.cos(a) * f.r * Math.random(), y: f.y + Math.sin(a) * f.r * Math.random(), vx: 0, vy: -2, life: 0.7, max: 0.7, c: Math.random() < 0.5 ? '#ff7a2a' : '#3a2020', s: 2 }); }
      break;
    case 'fire': shapes.push({ k: 'ring', x: f.x, y: f.y, r: f.r, c: '#ff8a20', w: 4, life: 0.5, max: 0.5 }); if (near) Snd.play('boom');
      for (let i = 0; i < 40; i++) { const a = Math.random() * 7, rr = Math.random() * f.r; particles.push({ x: f.x + Math.cos(a) * rr, y: f.y + Math.sin(a) * rr * 0.6, vx: 0, vy: -2.5, life: 0.7, max: 0.7, c: ['#ffd040', '#ff8a20', '#e03a10'][i % 3], s: 2.5 }); }
      break;
    case 'claw': shapes.push({ k: 'claw', x: f.x, y: f.y - 0.6, life: 0.2, max: 0.2 }); break;
    case 'die': for (let i = 0; i < 16; i++) { const a = Math.random() * 7, v = 1 + Math.random() * 2; particles.push({ x: f.x, y: f.y - 0.4, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, life: 0.6, max: 0.6, c: Math.random() < 0.5 ? '#d8d0c0' : '#8a8478', s: 2 }); } if (near) Snd.play('die'); break;
    case 'lvl': shapes.push({ k: 'pillar', x: f.x, y: f.y, life: 1.2, max: 1.2 }); texts.push({ x: f.x, y: f.y - 1.6, t: 'Niveau supérieur !', c: '#ffd77a', big: 1.2, life: 1.6, max: 1.6 }); if (mine) Snd.play('lvl'); break;
    case 'heal': shapes.push({ k: 'ring', x: f.x, y: f.y, r: 1.1, c: '#9aff9a', w: 2, life: 0.5, max: 0.5 }); for (let i = 0; i < 12; i++) particles.push({ x: f.x + (Math.random() - 0.5), y: f.y - Math.random(), vx: 0, vy: -1.5, life: 0.8, max: 0.8, c: '#7aff8a', s: 2, plus: 1 }); if (near) Snd.play('heal'); break;
    case 'gold': texts.push({ x: f.x, y: f.y, t: `+${f.v} or`, c: '#ffd23a', big: 0.9, life: 1, max: 1 }); if (mine) Snd.play('coin'); break;
    case 'coin': if (near) Snd.play('coin'); break;
    case 'potpick': texts.push({ x: f.x, y: f.y, t: `+${f.v} potion${f.v > 1 ? 's' : ''}`, c: '#ff8a8a', big: 0.9, life: 1, max: 1 }); if (mine) Snd.play('coin'); break;
    case 'loot': texts.push({ x: f.x, y: f.y, t: f.t, c: f.r === 5 ? '#c8f0ff' : RAR_COL[f.r], big: f.r >= 4 ? 1.2 : 1, life: 2, max: 2 }); if (mine) Snd.play('loot', Math.min(4, f.r)); if (f.r >= 4 && mine) shapes.push({ k: 'pillar', x: f.x, y: f.y + 1.2, life: 1, max: 1 }); break;
    case 'qprog': texts.push({ x: f.x, y: f.y, t: f.t, c: '#9fd38a', big: 0.95, life: 1.4, max: 1.4 }); break;
    case 'forge': for (let i = 0; i < 22; i++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, v = 2 + Math.random() * 3; particles.push({ x: f.x - 1, y: f.y + 0.2, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 8, life: 0.6, max: 0.6, c: Math.random() < 0.5 ? '#ffb84a' : '#fff0a0', s: 1.5 }); } if (near) Snd.play('forge'); break;
    case 'dash': {
      shapes.push({ k: 'dash', x: f.x, y: f.y, x2: f.x2, y2: f.y2, life: 0.25, max: 0.25 });
      const ce = ents.get(f.id);
      if (ce && ce.lastSpr) for (let i = 0; i < 4; i++) { const q = i / 4; shapes.push({ k: 'ghost', x: f.x + (f.x2 - f.x) * q, y: f.y + (f.y2 - f.y) * q, spr: ce.lastSpr, flip: ce.lastFlip, tint: ce.cls === 'archere' ? '#ffe28a' : '#ff8a5a', life: 0.25 + q * 0.2, max: 0.45 }); }
      for (let i = 0; i < 8; i++) particles.push({ x: f.x + (f.x2 - f.x) * Math.random(), y: f.y + (f.y2 - f.y) * Math.random(), vx: (Math.random() - 0.5), vy: -0.8, life: 0.5, max: 0.5, c: '#c8b898', s: 2 });
      if (near) Snd.play('dash'); break;
    }
    case 'shout': shapes.push({ k: 'ring', x: f.x, y: f.y - 0.4, r: 6, c: '#ffd23a', w: 2, life: 0.5, max: 0.5 }); if (near) Snd.play('shout'); break;
    case 'shield': shapes.push({ k: 'ring', x: f.x, y: f.y - 0.6, r: 1.4, c: '#9ad0ff', w: 2, life: 0.35, max: 0.35 }); if (near) Snd.play('ice'); break;
    case 'nova': shapes.push({ k: 'spikes', x: f.x, y: f.y, r: f.r, life: 0.6, max: 0.6 }); shapes.push({ k: 'ring', x: f.x, y: f.y, r: f.r, c: '#bfe8ff', w: 3, life: 0.4, max: 0.4 }); if (near) Snd.play('ice');
      for (let i = 0; i < 30; i++) { const a = Math.random() * 7, v = 3 + Math.random() * 4; particles.push({ x: f.x, y: f.y - 0.3, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, life: 0.5, max: 0.5, c: Math.random() < 0.5 ? '#ffffff' : '#7ad0ff', s: 2 }); }
      break;
    case 'rain':
      for (let i = 0; i < 7; i++) { const a = Math.random() * 7, rr = Math.random() * f.r, x = f.x + Math.cos(a) * rr, y = f.y + Math.sin(a) * rr * 0.7; shapes.push({ k: 'fall', x, y, life: 0.25, max: 0.25 }); particles.push({ x, y, vx: (Math.random() - 0.5) * 2, vy: -1, life: 0.3, max: 0.3, c: '#c8b898', s: 1.4, delay: 0.24 }); }
      if (near) Snd.play('arrow'); break;
    case 'emote': emotes.set(f.id, { k: f.e, t: 2.6 }); break;
    case 'chest': burst(26, '#ffd77a'); if (near) Snd.play('loot', 3); break;
    case 'wp': burst(26, '#7ae8ff'); break;
    case 'tp': burst(20, '#c08aff'); break;
    case 'tpcast': shapes.push({ k: 'tpcast', x: f.x, y: f.y, id: f.id, life: f.d, max: f.d }); if (near) Snd.play('tp'); break;
    case 'tpcancel': for (let i = shapes.length - 1; i >= 0; i--) if (shapes[i].k === 'tpcast' && shapes[i].id === f.id) shapes.splice(i, 1); burst(10, '#8a7aa0', 0.5); break;
    case 'tpout': shapes.push({ k: 'tpbeam', x: f.x, y: f.y, life: 0.6, max: 0.6, out: 1 }); burst(30, '#c08aff', 3); break;
    case 'tpin': shapes.push({ k: 'tpbeam', x: f.x, y: f.y, life: 0.8, max: 0.8 }); shapes.push({ k: 'ring', x: f.x, y: f.y, r: 2.6, c: '#c8a8ff', w: 3, life: 0.6, max: 0.6, delay: 0.25 });
      for (let i = 0; i < 26; i++) { const a = Math.random() * 7; particles.push({ x: f.x + Math.cos(a) * 1.4, y: f.y + Math.sin(a) * 0.6, vx: -Math.cos(a) * 2, vy: -Math.sin(a) * 1 - 0.5, life: 0.6, max: 0.6, c: i % 2 ? '#e8d8ff' : '#9a7aff', s: 1.6, delay: 0.2 }); }
      { const ce = ents.get(f.id); if (ce) ce.tpInT = time; }
      break;
  }
}

/* ============================================================
   Rendu
   ============================================================ */
function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr);
  S = Math.max(2, Math.round(Math.min(cv.width, cv.height) / (TS * 12)));
}
addEventListener('resize', resize); resize();
const scr = (x, y) => [Math.round((x * TS - camPx) * S), Math.round((y * TS - camPy) * S)];

function drawMap() {
  if (!map) return;
  const frame = Math.floor(time / 0.6) % 2, vw = cv.width / S, vh = cv.height / S, cp = CH * TS;
  const cx0 = Math.max(0, Math.floor(camPx / cp)), cy0 = Math.max(0, Math.floor(camPy / cp));
  const cx1 = Math.min(Math.ceil(W / CH) - 1, Math.floor((camPx + vw) / cp)), cy1 = Math.min(Math.ceil(H / CH) - 1, Math.floor((camPy + vh) / cp));
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
    const img = getChunk(cx, cy, frame);
    const dx = Math.round((cx * cp - camPx) * S), dy = Math.round((cy * cp - camPy) * S);
    const dx2 = Math.round(((cx * cp + img.width) - camPx) * S), dy2 = Math.round(((cy * cp + img.height) - camPy) * S);
    ctx.drawImage(img, dx, dy, dx2 - dx, dy2 - dy);
  }
}

function weaponDraw(kind, dir, weap, atk, wr) {
  const glow = wr >= 3 ? rarColor(wr) : weap >= 9 ? '#c070ff' : weap >= 7 ? '#ffd34a' : weap >= 5 ? '#6ac8ff' : null;
  const a = atk ? 1 : 0, ops = [];
  const r = (x, y, w, h, c, gl) => ops.push([x, y, w, h, c, gl]);
  if (kind === 'sword' || kind === 'rusty') {
    const blade = kind === 'rusty' ? '#9a8a70' : '#dfe3ea';
    if (dir === 3) { r(9, 7, 1, 3, '#d9a441'); r(10 + a, 8, 5, 1, blade, glow); r(10 + a, 8, 1, 1, '#ffffff'); }
    else { r(11, 3 + a * 2, 1, 6, blade, glow); r(11, 3 + a * 2, 1, 1, '#ffffff'); r(10, 9 + a * 2, 3, 1, '#d9a441'); r(11, 10 + a * 2, 1, 2, '#5a3b22'); }
  } else if (kind === 'bow') {
    if (dir === 3) { r(10, 3, 1, 1, '#8a5a2b', glow); r(11, 4, 1, 7, '#8a5a2b', glow); r(10, 11, 1, 1, '#8a5a2b', glow); r(10, 4, 1, 7, '#e8e0c8'); }
    else { r(10, 4, 1, 1, '#8a5a2b', glow); r(11, 5, 1, 6, '#8a5a2b', glow); r(10, 11, 1, 1, '#8a5a2b', glow); r(10, 5, 1, 6, '#e8e0c8'); }
  } else if (kind === 'staff' || kind === 'nstaff') {
    const orb = glow || (kind === 'nstaff' ? '#7ae05a' : '#7ad0ff'), x = dir === 3 ? 9 : 10;
    r(x, 2, 1, 11, kind === 'nstaff' ? '#5a3a1a' : '#7a4f2a'); r(x - 1, -1 - a, 3, 3, orb, orb); r(x, -a, 1, 1, '#ffffff');
    if (kind === 'nstaff') { r(x + 1, 1, 2, 1, '#4ab83a'); r(x - 2, 3, 2, 1, '#4ab83a'); }
  } else if (kind === 'mace') {
    if (dir === 3) { r(9, 8, 4 + a, 1, '#6a4a2a'); r(12 + a, 6, 3, 4, '#e2b04a', glow); r(13 + a, 6, 1, 1, '#fff3c0'); }
    else { r(11, 4 + a * 2, 1, 7, '#6a4a2a'); r(10, 1 + a * 2, 3, 4, '#e2b04a', glow); r(10, 1 + a * 2, 1, 1, '#fff3c0'); }
  } else if (kind === 'daggers') {
    if (dir === 3) { r(10 + a, 8, 3, 1, '#d0d4dc', glow); r(9, 8, 1, 1, '#8a2a3a'); r(10 + a, 10, 2, 1, '#d0d4dc', glow); }
    else { r(11, 6 + a, 1, 3, '#d0d4dc', glow); r(11, 9 + a, 1, 1, '#8a2a3a'); r(0, 7 + a, 1, 3, '#d0d4dc', glow); r(0, 10 + a, 1, 1, '#8a2a3a'); }
  }
  return ops;
}

function drawHumanoid(e, x, y, pal, palKey, scale, weapon, extra) {
  const dir = e.dir === 2 ? 3 : e.dir;
  const walk = e.mv && !e.dead ? [1, 0, 2, 0][Math.floor((time + e.id * 0.37) * 8) % 4] : 0;
  const img = sprite(`h${dir}${walk}${palKey}`, humFrame(dir, walk), pal, e.flash > 0);
  const s = S * scale, w = 12 * s, h = 14 * s;
  const em = emotes.get(e.id);
  const bob = em && em.k === 'danse' ? Math.abs(Math.sin(time * 10)) * 3 * S : (extra && extra.float ? Math.sin(time * 3 + e.id) * 2 * S : 0);
  ctx.save();
  if (extra && extra.alpha) ctx.globalAlpha *= extra.alpha;
  ctx.translate(x, y - h - bob);
  if (e.dir === 2 || (em && em.k === 'danse' && Math.floor(time * 4) % 2)) { ctx.translate(w, 0); ctx.scale(-1, 1); }
  const ops = weapon ? weaponDraw(weapon, dir, e.weap || 0, e.atk, e.wr) : [];
  const drawOps = () => { for (const [ox, oy, ow, oh, c, gl] of ops) { if (gl) { ctx.shadowColor = gl; ctx.shadowBlur = 2 * s * (0.7 + 0.3 * Math.sin(time * 6)); } ctx.fillStyle = c; ctx.fillRect(ox * s, oy * s, ow * s, oh * s); ctx.shadowBlur = 0; } };
  if (dir === 1) drawOps();
  ctx.drawImage(img, 0, 0, w, h);
  if (extra && extra.crown) { ctx.fillStyle = extra.crown; ctx.fillRect(3 * s, -2 * s, 6 * s, 2 * s); ctx.fillRect(3 * s, -4 * s, s, 2 * s); ctx.fillRect(5.5 * s, -4 * s, s, 2 * s); ctx.fillRect(8 * s, -4 * s, s, 2 * s); ctx.fillStyle = '#ff3a3a'; ctx.fillRect(5.5 * s, -1.5 * s, s, s); }
  if (extra && extra.horns) { ctx.fillStyle = '#e8d8b0'; ctx.fillRect(1 * s, -2 * s, 2 * s, 3 * s); ctx.fillRect(0, -4 * s, s, 2 * s); ctx.fillRect(9 * s, -2 * s, 2 * s, 3 * s); ctx.fillRect(11 * s, -4 * s, s, 2 * s); }
  if (extra && extra.crystals) { ctx.fillStyle = '#40e0ff'; ctx.fillRect(2 * s, 6 * s, 2 * s, 3 * s); ctx.fillRect(8 * s, 5 * s, 2 * s, 4 * s); ctx.fillRect(5 * s, -2 * s, 2 * s, 3 * s); }
  if (dir !== 1) drawOps();
  ctx.restore();
  return h + bob;
}
// ---- Héros en pixel art détaillé ----
const HERO_K = 0.42; // 1 pixel d'art = 0,36 pixel du monde
const HERO_DYE = { // zones recolorées par les teintures : teinte [min,max], saturation [min,max], luminosité [min,max], hors du visage (fractions x0,y0,x1,y1)
  guerrier: { z: [[346, 14, 0.45, 1, 0.12, 0.8]] },
  mage: { z: [[195, 255, 0.28, 1, 0.1, 0.85]], face: [0.15, 0.36, 0.62, 0.52] },
  paladin: { z: [[30, 58, 0.4, 1, 0.2, 0.85]] },
  archere: { z: [[65, 160, 0.18, 1, 0.08, 0.8]], face: [0.25, 0.12, 0.75, 0.4] },
  assassin: { z: [[0, 360, 0, 0.2, 0.06, 0.42]], face: [0.25, 0.18, 0.75, 0.42] },
  druide: { z: [[45, 360, 0, 0.5, 0.66, 1], [0, 10, 0, 0.5, 0.66, 1]], face: [0.2, 0.1, 0.85, 0.48] },
};
const heroArt = {}, heroCache = new Map();
for (const [k, d] of Object.entries(window.HERO_ART || {})) { const im = new Image(); im.onload = () => { if (!joined && charsCache.length && $('newChar').hidden) renderChars(charsCache, charsMax); }; im.src = d.src; heroArt[k] = { ...d, im }; }
const USE_HERO_ART = false; // apparences d'origine
const heroReady = cls => USE_HERO_ART && heroArt[cls] && heroArt[cls].im.complete && heroArt[cls].im.naturalWidth > 0;
function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hsl2rgb(h, s, l) {
  const f = n => { const k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l); return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))); };
  return [f(0), f(8), f(4)];
}
function heroCanvas(cls, dye, white) {
  const key = cls + '|' + (dye || '') + (white ? '|w' : '');
  let c = heroCache.get(key); if (c) return c;
  const art = heroArt[cls]; c = document.createElement('canvas'); c.width = art.w; c.height = art.h;
  const g = c.getContext('2d'); g.drawImage(art.im, 0, 0);
  const dc = dye && DEF.dyesDef && DEF.dyesDef[dye] && DEF.dyesDef[dye].c;
  if (dc || white) {
    const id = g.getImageData(0, 0, art.w, art.h), px = id.data;
    if (white) { for (let i = 0; i < px.length; i += 4) { px[i] = px[i + 1] = px[i + 2] = 255; } }
    else {
      const [th, ts, tl] = rgb2hsl(parseInt(dc[0].slice(1, 3), 16), parseInt(dc[0].slice(3, 5), 16), parseInt(dc[0].slice(5, 7), 16));
      const zd = HERO_DYE[cls] || { z: [] }, zones = zd.z, fc = zd.face, hit = [], ls = [];
      for (let i = 0; i < px.length; i += 4) {
        if (px[i + 3] < 120) continue;
        if (fc) { const fx = (i / 4) % art.w / art.w, fy = Math.floor(i / 4 / art.w) / art.h; if (fx >= fc[0] && fx <= fc[2] && fy >= fc[1] && fy <= fc[3]) continue; }
        const [h, sa, l] = rgb2hsl(px[i], px[i + 1], px[i + 2]);
        if (zones.some(([h0, h1, s0, s1, l0, l1]) => (h0 <= h1 ? h >= h0 && h <= h1 : h >= h0 || h <= h1) && sa >= s0 && sa <= s1 && l >= l0 && l <= l1)) { hit.push(i); ls.push(l); }
      }
      const mean = ls.reduce((a, b) => a + b, 0) / Math.max(1, ls.length);
      hit.forEach((i, n) => { const [r, gg, b] = hsl2rgb(th, Math.max(ts, 0.08), Math.max(0.04, Math.min(0.96, tl + (ls[n] - mean) * 0.9))); px[i] = r; px[i + 1] = gg; px[i + 2] = b; });
    }
    g.putImageData(id, 0, 0);
  }
  heroCache.set(key, c); return c;
}
// Dessine un héros : (x, y) = position des pieds. Renvoie la hauteur dessinée.
function drawHero(e, x, y, cls, dye, glow, st = e) {
  const art = heroArt[cls], s = S * HERO_K;
  const w = art.w * s, h = art.h * s;
  const em = emotes.get(e.id);
  if (e.dir === 2) st.hflip = true; else if (e.dir === 3) st.hflip = false;
  const flip = !!st.hflip !== !!(em && em.k === 'danse' && Math.floor(time * 4) % 2);
  const ph = time * 9 + e.id * 0.37;
  const walking = e.mv && !e.dead;
  let bob = walking ? Math.abs(Math.sin(ph)) * 1.4 * S : 0, tilt = walking ? Math.sin(ph) * 0.06 : 0;
  let sy = walking ? 1 : 1 + Math.sin(time * 2.4 + e.id) * 0.012, sx = 1, lx = 0, ly = 0;
  if (em && em.k === 'danse') bob = Math.abs(Math.sin(time * 10)) * 3 * S;
  if (e.atk) { const dx = e.dir === 2 ? -1 : e.dir === 3 ? 1 : 0, dy = e.dir === 0 ? 1 : e.dir === 1 ? -1 : 0; lx = dx * 2 * S; ly = dy * 1.2 * S; sx = 1.06; sy *= 0.95; tilt += dx * 0.12; }
  if (e.dead) { tilt = 1.45; bob = 0; }
  ctx.save();
  ctx.translate(x + lx, y + ly - bob); ctx.rotate(tilt); ctx.scale(flip ? -sx : sx, sy);
  const ox = -art.fx * s;
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 3 * S * (0.75 + 0.25 * Math.sin(time * 5)); }
  ctx.drawImage(heroCanvas(cls, dye), ox, -h, w, h);
  ctx.shadowBlur = 0;
  if (e.flash > 0) { ctx.globalAlpha *= Math.min(1, e.flash * 6); ctx.drawImage(heroCanvas(cls, '', true), ox, -h, w, h); }
  ctx.restore();
  return h + bob;
}
window.RA_heroCanvas = (c, d) => heroCanvas(c, d);
const heroGlow = e => { const wr = e.wr | 0, wp = e.weap | 0; return wr >= 3 ? rarColor(wr) : wp >= 9 ? '#c070ff' : wp >= 7 ? '#ffd34a' : wp >= 5 ? '#6ac8ff' : null; };
function drawHeroPreview(g, cls, cw, ch, pad = 2) {
  if (!heroReady(cls)) return false;
  const art = heroArt[cls], k = Math.min((cw - pad * 2) / art.w, (ch - pad * 2) / art.h);
  g.imageSmoothingEnabled = false; g.drawImage(heroCanvas(cls, ''), Math.round((cw - art.w * k) / 2), Math.round(ch - pad - art.h * k), art.w * k, art.h * k);
  return true;
}
/* ============================================================
   Héros dessinés : sprites détaillés générés (4 directions, marche, attaque, sort)
   L'équipement porté se voit : chaque palier a sa forme et sa matière,
   chaque nom de panoplie sa couleur d'accent.
   ============================================================ */
const HW = 22, HH = 30, HFX = 11, HFY = 28; // les pieds touchent le point (11, 28) du sprite
function shade(c, a) {
  if (!c || c[0] !== '#') return c;
  let r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16);
  if (a > 0) { r += (255 - r) * a; g += (255 - g) * a; b += (255 - b) * a; } else { r *= 1 + a; g *= 1 + a; b *= 1 + a; }
  const h = v => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, '0');
  return '#' + h(r) + h(g) + h(b);
}
const OUTLINE = [24, 14, 12];
// matières des 8 paliers : cuir, fer, acier, chevalier, runique, draconique, astral, Titan
const MAT = [
  { c: '#8a5a32', h: '#b07a48', d: '#5a3a1e', cloth: '#7a5a3a' },
  { c: '#7a808c', h: '#a4aab6', d: '#4a4e58', cloth: '#6a5a4a' },
  { c: '#b4bccb', h: '#e2e8f2', d: '#7a8292', cloth: '#4a5a8a' },
  { c: '#c6ccd8', h: '#f0f4fa', d: '#8a90a0', trim: '#e2b04a', cloth: '#3a4a8a' },
  { c: '#4a5470', h: '#6a7898', d: '#2a3044', glow: '#5ad8ff', cloth: '#2a3a5a' },
  { c: '#a8382a', h: '#d86a48', d: '#6a1e16', trim: '#f0b040', cloth: '#7a1e1a' },
  { c: '#2c3a80', h: '#4a62b8', d: '#18204a', glow: '#e8f0ff', star: 1, cloth: '#1e2a6a' },
  { c: '#e2cf8a', h: '#fff2c0', d: '#a88a3a', trim: '#ffffff', glow: '#fff4c0', cloth: '#f0e6c8' },
];
// couleurs d'accent : une par nom de panoplie (0 = objet commun)
const ACC_COL = ['#a8a090',
  '#e07a2a', '#a8d8f0', '#5a8a2a', '#3aa0b0', '#7a4a2a',
  '#d8b070', '#8a8f9a', '#2a8a9a', '#b8b0e8', '#8ae0ff',
  '#ff9aa0', '#ff6020', '#3a5ad0', '#a050c0', '#3a2a4a',
  '#7a9a5a', '#8a1a2a', '#e89a20', '#ff4a1a', '#c8d0e0',
  'R1', 'R2', '#f0f8ff', '#40e0a0',
  '#2a6ad8', '#5ac8b8', '#c02a2a', '#ffb020'];
const accAt = (a, x, y) => { const c = ACC_COL[a] || ACC_COL[0]; if (c === 'R1') return `hsl(${(x * 40 + y * 25) % 360},85%,62%)`; if (c === 'R2') return `hsl(${(y * 30) % 360},90%,60%)`; return c; };
const accBase = a => { const c = ACC_COL[a] || ACC_COL[0]; return c[0] === 'R' ? '#c070ff' : c; };
const VIS_SLOTS = ['arme', 'casque', 'armure', 'gants', 'bottes', 'cape', 'ceinture', 'amulette'];
function parseVis(v) {
  const o = {}; if (!v) return o;
  v.split('.').forEach((c, i) => { if (c && c !== '-') o[VIS_SLOTS[i]] = { t: parseInt(c[0], 36) || 0, a: parseInt(c.slice(1, 3), 36) || 0, r: +c[3] || 0, gl: c[4] === '1' }; });
  return o;
}
const STYLE_OF = { guerrier: 'guerrier', archere: 'archere', mage: 'mage', paladin: 'paladin', assassin: 'assassin', druide: 'druide',
  forge: 'apron', shop: 'robe', quest: 'guerrier', stable: 'npc', bank: 'hat' };
const HEAD_FAMILY = { guerrier: 'helm', paladin: 'helm', mage: 'hat', archere: 'band', assassin: 'hood', druide: 'crown' };
const heroSprCache = new Map();
// dir : 0 face, 1 dos, 3 profil (droite) ; f : 0 repos, 1 et 2 pas ; pose : 'n' normale, 'c' sort (bras levés)
function heroSprite(style, pal, palKey, dir, f, pose, white, vis, dye) {
  const key = `${style}|${palKey}|${dir}|${f}|${pose}|${vis || ''}|${dye || ''}${white ? '|w' : ''}`;
  let c = heroSprCache.get(key); if (c) return c;
  if (heroSprCache.size > 900) heroSprCache.clear();
  c = document.createElement('canvas'); c.width = HW; c.height = HH;
  const g = c.getContext('2d');
  g.translate(1, 2); // marge pour les grands couvre-chefs et les ailes
  const R = (x, y, w, h, col) => { if (!col || w <= 0 || h <= 0) return; g.fillStyle = col; g.fillRect(x, y, w, h); };
  const P = (x, y, col) => R(x, y, 1, 1, col);
  const EQ = parseVis(vis);
  const A = (slot, x, y) => { const q = EQ[slot]; return q ? (dye && slot !== 'arme' ? dye : accAt(q.a, x, y)) : null; };
  const h = pal.h, s = pal.s, e = pal.e, gg = pal.g;
  let b = pal.b, d = pal.d, l = pal.l, k = pal.k;
  const robe = style === 'mage' || style === 'robe' || style === 'druide';
  // armure : matière sur le torse et les bras ; couleur d'accent sur l'étoffe
  const ar = EQ.armure, arM = ar && MAT[ar.t];
  let armCol = style === 'guerrier' ? '#9aa0aa' : b;
  if (ar) {
    const accC = dye || accBase(ar.a);
    if (robe || style === 'assassin') { b = ar.a ? accC : arM.cloth; d = shade(b, -0.35); armCol = b; }
    else { b = arM.c; d = arM.d; armCol = arM.c; }
  }
  const bt = EQ.bottes, gl = EQ.gants;
  if (bt) k = MAT[bt.t].c;
  if (ar && !robe) l = shade(MAT[ar.t].d, 0.1);
  const bH = shade(b, 0.25), bD = shade(b, -0.3), sD = shade(s, -0.18), hH = shade(h, 0.22), hD = shade(h, -0.3), lD = shade(l, -0.25), kH = shade(k, 0.25);
  const cast = pose === 'c';
  const front = dir === 0, back = dir === 1, side = dir === 3;
  const legL = f === 1 ? -1 : 0, legR = f === 2 ? -1 : 0;
  const swing = f === 1 ? 1 : f === 2 ? -1 : 0;
  const cape = EQ.cape, capeM = cape && MAT[cape.t];
  const capeC = cape ? (dye || accBase(cape.a)) : null;

  // ---------- derrière le corps ----------
  if (cape && cape.t === 5) { // ailes draconiques
    const wc = capeM.c, wd = capeM.d, flap = f ? 1 : 0;
    const wing = (x0, dirx) => { for (let i = 0; i < 6; i++) { R(x0 + dirx * i - (dirx < 0 ? 0 : 0), 9 + i - flap + Math.abs(i - 2), 1, 7 - i, i % 2 ? wd : wc); } P(x0 + dirx * 5, 8 - flap, '#f0b040'); };
    if (front) { wing(4, -1); wing(15, 1); } else if (side) wing(5, -1);
  }
  if (cape && cape.t !== 5) {
    const trim = capeM.trim || capeM.h;
    if (side) { R(3, 13 + (f === 1 ? 1 : 0), 4, 10, capeC); R(3, 22 + (f === 1 ? 1 : 0), 4, 1, trim); }
    else { R(4, 13, 1, 9, capeC); R(15, 13, 1, 9, capeC); }
  }
  if (style === 'archere' && side) {
    const qx = back ? 11 : 5;
    R(qx, 11, 3, 8, '#7a4a24'); R(qx, 11, 1, 8, '#9a6434'); R(qx, 18, 3, 1, '#4a2c14');
    P(qx, 9, '#e8e0d0'); P(qx + 1, 8, '#d04040'); P(qx + 2, 9, '#e8e0d0'); R(qx, 10, 3, 1, '#c8b890');
  }
  if (style === 'assassin' && side) { const t = f === 1 ? 1 : 0; R(3, 14 + t, 4, 2, gg); R(2, 15 + t, 2, 2, shade(gg, -0.2)); }

  // ---------- jambes ----------
  const boot = (x, y, w) => { R(x, y, w, 2, k); R(x, y, w, 1, kH); if (bt && bt.t >= 3) { R(x, y - 1, w, 1, MAT[bt.t].h); } if (bt && bt.a) P(x + (w > 2 ? 1 : 0), y, A('bottes', x, y)); if (bt && MAT[bt.t].glow) P(x + w - 1, y + 1, MAT[bt.t].glow); };
  if (pose === 'r') { // assis sur une monture : cuisse vers l'avant, mollet le long du flanc
    if (robe) { const tc = ar ? (MAT[ar.t].trim || MAT[ar.t].c) : d; R(7, 20, 7, 2, b); R(7, 20, 7, 1, bH); R(7, 22, 7, 1, tc); R(12, 23, 2, 1, l); }
    else { R(8, 20, 6, 2, l); R(8, 21, 6, 1, lD); R(12, 22, 2, 2, l); R(12, 22, 1, 2, lD); }
    boot(11, 24, 4);
  } else if (!robe) {
    if (front || back) {
      R(6, 20, 3, 4 + legL, l); R(6, 20, 1, 4 + legL, lD);
      R(11, 20, 3, 4 + legR, l); R(13, 20, 1, 4 + legR, lD);
      boot(6, 23 + legL, 3); boot(11, 23 + legR, 3);
    } else {
      if (f === 0) { R(8, 20, 3, 4, l); R(8, 20, 1, 4, lD); boot(8, 23, 4); }
      else {
        const a = f === 1 ? 1 : -1;
        R(9 + a * 2, 20, 3, 3, l); boot(9 + a * 2, 23, 4);
        R(9 - a * 2, 20, 3, 3, lD); boot(9 - a * 2, 23, 3);
      }
    }
  } else {
    const hem = style === 'druide' ? 23 : 24;
    const trimC = ar ? (MAT[ar.t].trim || MAT[ar.t].c) : d;
    if (front || back) {
      for (let y = 20; y <= hem; y++) { const w = 8 + Math.min(3, Math.floor((y - 19) / 2)); R(10 - w / 2 | 0, y, w, 1, b); }
      R(5, hem, 10, 1, trimC); R(5, 20, 1, hem - 19, bD);
      if (front && style !== 'druide') R(9, 14, 2, hem - 13, ar ? trimC : gg);
      if (ar && MAT[ar.t].star) { P(7, 22, '#ffffff'); P(12, 21, '#e8f0ff'); P(10, 23, '#ffffff'); }
      if (ar && MAT[ar.t].glow && !MAT[ar.t].star) { P(6, 22, MAT[ar.t].glow); P(13, 22, MAT[ar.t].glow); }
      boot(6, hem + 1, 3); boot(11, hem + 1, 3);
    } else {
      for (let y = 20; y <= hem; y++) { const w = 6 + Math.min(3, Math.floor((y - 19) / 2)); R(8 - (y > 21 ? 1 : 0) + (f === 1 ? 1 : 0) * (y > 21 ? 1 : 0), y, w, 1, b); }
      R(7, hem, 9, 1, trimC);
      boot(f === 1 ? 11 : f === 2 ? 7 : 9, hem + 1, 4);
    }
  }

  // ---------- bras arrière (profil) ----------
  if (side && !cast) { R(7 - swing, 14, 2, 5, shade(armCol, -0.3)); P(7 - swing, 19, gl ? MAT[gl.t].d : sD); }

  // ---------- torse ----------
  if (front || back) { R(6, 14, 8, 6, b); R(6, 14, 8, 1, bH); R(6, 14, 1, 6, bD); R(13, 14, 1, 6, bD); }
  else { R(7, 14, 6, 6, b); R(7, 14, 6, 1, bH); R(7, 14, 1, 6, bD); }
  const x0 = side ? 7 : 6, w0 = side ? 6 : 8;
  if (ar) {
    const M = MAT[ar.t], acc = dye || accBase(ar.a), t = ar.t;
    if (!robe && style !== 'assassin') {
      if (t === 0) { for (let y = 15; y < 19; y++) P(x0 + w0 / 2 | 0, y, M.d); P(x0 + 2, 16, M.d); P(x0 + w0 - 3, 16, M.d); }
      if (t === 1) for (let y = 15; y < 19; y++) for (let x = x0 + 1; x < x0 + w0 - 1; x++) if ((x + y) % 2) P(x, y, M.d);
      if (t === 2) { R(x0 + 1, 15, w0 - 2, 1, M.h); P(x0 + 2, 16, M.h); }
      if (t >= 3 && front) { R(8, 14, 4, 6, acc); R(8, 14, 1, 6, shade(acc, -0.25)); if (M.trim) { R(6, 14, 8, 1, M.trim); R(8, 19, 4, 1, M.trim); } }
      if (t >= 3 && side) { R(10, 14, 3, 6, acc); }
      if (t === 4) { P(7, 16, M.glow); P(12, 16, M.glow); P(7, 18, M.glow); P(12, 18, M.glow); }
      if (t === 5) for (let y = 15; y < 20; y += 2) for (let x = x0 + (y % 4 === 1 ? 0 : 1); x < x0 + w0; x += 2) P(x, y, M.h);
      if (t === 6) { P(x0 + 1, 15, '#ffffff'); P(x0 + w0 - 2, 17, '#ffffff'); P(x0 + 3, 18, '#e8f0ff'); }
      if (t === 7 && front) { R(9, 16, 2, 2, accAt(ar.a, 9, 16)); P(9, 16, '#ffffff'); }
      if (back && t >= 3) { R(6, 14, 8, 1, M.trim || M.h); }
    } else {
      // robes et cuirs souples : bordures dans la matière du palier
      const trim = M.trim || M.c;
      if (front) { R(6, 14, 8, 1, trim); P(9, 15, trim); P(10, 15, trim); }
      if (M.glow) { P(x0 + 1, 17, M.glow); P(x0 + w0 - 2, 17, M.glow); }
      if (M.star) { P(x0 + 2, 16, '#ffffff'); P(x0 + w0 - 3, 18, '#ffffff'); }
      if (style === 'assassin' && front) { for (let i = 0; i < 6; i++) { P(7 + i, 14 + i, M.c); P(12 - i, 14 + i, M.c); } }
    }
  } else {
    if (style === 'guerrier') { if (front) { R(9, 15, 2, 4, d); R(7, 16, 1, 3, shade(b, -0.15)); R(12, 16, 1, 3, shade(b, -0.15)); } if (side) R(10, 15, 2, 4, d); }
    if (style === 'paladin') { if (front) { R(8, 14, 4, 7, '#f0ece0'); R(8, 14, 1, 7, '#cfc8b4'); R(9, 15, 2, 4, gg); R(8, 16, 4, 1, gg); } if (side) { R(10, 14, 3, 7, '#f0ece0'); R(11, 15, 1, 4, gg); } }
    if (style === 'archere' && front) { for (let i = 0; i < 6; i++) P(7 + i, 14 + i, '#6a4a2a'); }
    if (style === 'assassin' && front) { for (let i = 0; i < 6; i++) { P(7 + i, 14 + i, '#4a3a4a'); P(12 - i, 14 + i, '#4a3a4a'); } P(9, 16, gg); P(10, 16, gg); }
    if (style === 'apron' && (front || side)) { R(front ? 7 : 9, 15, front ? 6 : 4, 8, '#6a4a2a'); R(front ? 7 : 9, 15, front ? 6 : 4, 1, '#8a6a42'); }
  }
  if (style === 'assassin') { R(6, 13, 8, 2, gg); R(6, 13, 8, 1, shade(gg, 0.25)); }
  // ceinture
  const be = EQ.ceinture;
  const beltC = be ? MAT[be.t].c : (style === 'paladin' ? shade(gg, -0.2) : '#5a3a20');
  if (style !== 'mage' && style !== 'robe') {
    if (front || back) { R(6, 19, 8, 1, beltC); if (front) R(9, 19, 2, 1, be ? A('ceinture', 9, 19) : gg); }
    else { R(7, 19, 6, 1, beltC); if (be) P(11, 19, A('ceinture', 11, 19)); }
  } else if (front || back) { R(6, 19, 8, 1, be ? beltC : gg); if (be && front) R(9, 19, 2, 1, A('ceinture', 9, 19)); }
  // amulette
  const am = EQ.amulette;
  if (am && front) { P(8, 14, '#e2b04a'); P(11, 14, '#e2b04a'); P(9, 15, '#e2b04a'); P(10, 15, '#e2b04a'); R(9, 16, 2, 1, accAt(am.a, 9, 16)); if (am.t >= 4) P(9, 16, '#ffffff'); }

  // ---------- bras ----------
  const gC = gl ? MAT[gl.t].c : null, gH = gl ? MAT[gl.t].h : null;
  const arm = (x, y, len, col) => { R(x, y, len > 0 ? 2 : 0, len, col); R(x, y, 1, len, shade(col, 0.15)); };
  const glove = (x, y) => { if (!gl) return; R(x, y - 2, 2, 3, gC); R(x, y - 2, 2, 1, gH); if (gl.a) P(x, y - 2, A('gants', x, y)); if (gl.t >= 5) P(x + 1, y + 1, MAT[gl.t].trim || gH); if (MAT[gl.t].glow) P(x + 1, y - 1, MAT[gl.t].glow); };
  if (cast) {
    if (front || back) { arm(3, 9, 5, armCol); arm(15, 9, 5, armCol); R(3, 8, 2, 1, gl ? gC : s); R(15, 8, 2, 1, gl ? gC : s); if (gl) { R(3, 9, 2, 2, gC); R(15, 9, 2, 2, gC); } }
    else { arm(11, 9, 5, armCol); R(11, 8, 2, 1, gl ? gC : s); if (gl) R(11, 9, 2, 2, gC); }
  } else if (front || back) {
    arm(4, 14, 5, armCol); arm(14, 14, 5, armCol);
    const yl = 19 + (swing > 0 ? -1 : 0), yr = 19 + (swing < 0 ? -1 : 0);
    R(4, yl, 2, 1, s); R(14, yr, 2, 1, s);
    if (gl) { glove(4, yl); glove(14, yr); }
    else {
      if (style === 'archere') { R(4, 17, 2, 2, pal.k); R(14, 17, 2, 2, pal.k); }
      if (style === 'mage' || style === 'robe') { R(4, 18, 2, 1, gg); R(14, 18, 2, 1, gg); }
    }
  } else {
    arm(10 + swing, 14, 5, armCol); R(10 + swing, 19, 2, 1, s);
    if (gl) glove(10 + swing, 19); else if (style === 'archere') R(10 + swing, 17, 2, 2, pal.k);
  }
  // épaulières
  const padM = ar && !robe && style !== 'assassin' ? MAT[ar.t] : null;
  if (style === 'guerrier' || (padM && ar.t >= 2 && style !== 'paladin')) {
    const pc = padM ? padM.h : '#b8bec8', ph = padM ? shade(padM.h, 0.3) : '#dde2ea';
    if (front || back) { R(3, 13, 4, 2, pc); R(13, 13, 4, 2, pc); R(3, 13, 4, 1, ph); R(13, 13, 4, 1, ph); if (padM && padM.trim) { P(3, 14, padM.trim); P(16, 14, padM.trim); } if (ar && ar.t === 5) { P(3, 12, padM.trim); P(16, 12, padM.trim); } }
    else { R(8, 13, 5, 2, pc); R(8, 13, 5, 1, ph); }
  }
  if (style === 'paladin') {
    const pc = padM ? padM.h : bH, tc = padM ? (padM.trim || gg) : gg;
    if (front || back) { R(2, 12, 5, 3, pc); R(13, 12, 5, 3, pc); R(2, 14, 5, 1, tc); R(13, 14, 5, 1, tc); } else { R(8, 12, 6, 3, pc); R(8, 14, 6, 1, tc); }
  }
  if (style === 'druide' && !ar) { P(4, 13, '#5ac84a'); P(5, 13, '#3a9a3a'); P(14, 13, '#3a9a3a'); P(15, 13, '#5ac84a'); }
  if (back) {
    if (cape && cape.t === 5) { const wc = capeM.c, wd = capeM.d, flap = f ? 1 : 0; for (const [x0, dx] of [[4, -1], [15, 1]]) { for (let i = 0; i < 6; i++) R(x0 + dx * i, 9 + i - flap + Math.abs(i - 2), 1, 7 - i, i % 2 ? wd : wc); P(x0 + dx * 5, 8 - flap, '#f0b040'); } R(8, 14, 4, 2, wd); }
    else if (cape) {
      const trim = capeM.trim || capeM.h, sw2 = f === 1 ? 1 : f === 2 ? -1 : 0;
      R(5, 13, 10, 10, capeC); R(4 + (sw2 < 0 ? 0 : 1), 22, 10, 2, capeC); R(5, 13, 10, 1, shade(capeC, 0.3));
      R(5, 14, 1, 9, shade(capeC, -0.25)); R(14, 14, 1, 9, shade(capeC, -0.25)); R(4 + (sw2 < 0 ? 0 : 1), 23, 10, 1, trim);
      for (let y = 16; y < 22; y += 3) { P(8, y, shade(capeC, -0.2)); P(11, y + 1, shade(capeC, -0.2)); }
      if (capeM.star) { P(8, 17, '#ffffff'); P(12, 20, '#ffffff'); P(10, 15, '#e8f0ff'); }
      if (capeM.glow) { P(7, 21, capeM.glow); P(12, 21, capeM.glow); }
      if (cape.t === 7) R(5, 13, 10, 1, '#f4ecd8');
    } else if (style === 'guerrier' || style === 'paladin') { R(6, 13, 8, 10, pal.d); R(6, 13, 8, 1, shade(pal.d, 0.2)); R(6, 14, 1, 9, shade(pal.d, -0.25)); R(13, 14, 1, 9, shade(pal.d, -0.25)); }
    if (style === 'assassin') { const t = f === 1 ? 1 : 0; R(9, 14, 3, 5 + t, gg); R(9, 14, 1, 5 + t, shade(gg, 0.2)); }
  }
  if (cape && front && cape.t !== 5) { R(4, 13, 3, 1, capeC); R(13, 13, 3, 1, capeC); if (cape.t === 7) { R(5, 13, 10, 1, '#f4ecd8'); } }

  // ---------- tête ----------
  if (front) {
    R(6, 6, 8, 8, s); R(5, 8, 10, 5, s); R(6, 13, 8, 1, sD);
    R(7, 10, 2, 2, '#ffffff'); R(11, 10, 2, 2, '#ffffff'); R(8, 10, 1, 2, e); R(11, 10, 1, 2, e);
    P(9, 12, sD); P(10, 12, sD); P(6, 12, '#f0a090'); P(13, 12, '#f0a090');
  } else if (back) { R(6, 6, 8, 8, h); R(5, 8, 10, 5, h); R(7, 13, 6, 1, sD); }
  else { R(6, 6, 8, 8, s); R(5, 8, 10, 5, s); R(14, 10, 1, 2, s); R(6, 13, 8, 1, sD); R(11, 10, 2, 2, '#ffffff'); R(12, 10, 1, 2, e); P(13, 12, sD); }

  const hairs = long => {
    R(6, 5, 8, 2, h); R(5, 6, 10, 2, h); R(7, 4, 6, 1, h); R(7, 5, 4, 1, hH);
    if (front) { R(5, 8, 1, long - 8, h); R(14, 8, 1, long - 8, h); if (long > 13) { R(4, 10, 1, long - 10, h); R(15, 10, 1, long - 10, h); } R(6, 8, 3, 1, h); R(11, 8, 2, 1, h); P(13, 8, hD); P(9, 8, hD); }
    else if (side) { R(5, 7, 5, long - 7, h); R(5, 7, 1, long - 7, hD); R(10, 8, 3, 1, h); R(6, 8, 2, 1, hH); if (style === 'archere') { R(3, 9, 2, 6, h); P(3, 15, hD); } }
    else { R(5, 8, 10, long - 8, h); R(6, 9, 1, long - 10, hH); if (style === 'archere') { R(8, 13, 4, 6, h); R(9, 19, 2, 1, hD); } }
  };
  const longHair = style === 'archere' ? 16 : style === 'druide' || style === 'robe' ? 13 : 11;
  const he = EQ.casque, fam = HEAD_FAMILY[style];
  if (he && fam) {
    const M = MAT[he.t], t = he.t, ac = x => A('casque', x, 4);
    if (fam === 'helm') {
      // casques de plates : de la calotte de cuir au heaume du Titan
      if (t >= 3) { // heaume fermé
        R(5, 4, 10, 10, M.c); R(5, 4, 10, 1, M.h); R(6, 3, 8, 1, M.c); R(5, 4, 1, 10, M.d); R(14, 4, 1, 10, M.d);
        if (front) { R(6, 9, 8, 1, '#1a1418'); P(9, 11, M.d); P(10, 11, M.d); P(8, 12, M.d); P(11, 12, M.d); }
        if (side) { R(10, 9, 5, 1, '#1a1418'); }
        if (M.trim) { R(5, 7, 10, 1, M.trim); }
        if (M.glow) { P(7, 6, M.glow); P(12, 6, M.glow); }
        if (t === 3 || t === 7) { R(9, 0, 2, 3, ac(9)); R(8, 1, 1, 2, ac(8)); } // plumet
        if (t === 5) { P(4, 3, M.trim); P(3, 2, M.trim); P(15, 3, M.trim); P(16, 2, M.trim); R(9, 1, 2, 2, M.d); } // cornes
        if (t === 6) { P(10, 1, '#ffffff'); P(9, 2, '#e8f0ff'); P(11, 2, '#e8f0ff'); P(10, 2, ac(10)); } // étoile
        if (t === 7) { P(3, 5, '#ffffff'); P(2, 4, '#ffffff'); P(16, 5, '#ffffff'); P(17, 4, '#ffffff'); }
      } else {
        hairs(11);
        R(5, 4, 10, 4, M.c); R(6, 3, 8, 1, M.c); R(5, 4, 10, 1, M.h); R(5, 7, 10, 1, M.d);
        if (t >= 1 && !back) { R(4, 7, 12, 1, M.c); }
        if (t === 2 && front) { R(9, 8, 2, 3, M.c); }
        if (he.a) R(7, 5, 6, 1, ac(7));
      }
    } else if (fam === 'hat') {
      hairs(12);
      const hc = he.a ? (dye || accBase(he.a)) : M.cloth, hD2 = shade(hc, -0.3), tall = Math.min(7, 3 + t);
      R(3, 8, 14, 1, hD2); R(4, 7, 12, 1, hc); R(6, 6, 8, 1, M.trim || M.c);
      for (let i = 0; i < tall; i++) { const w = Math.max(2, 8 - i * 1.2 | 0); R(10 - (w >> 1) + (i > tall - 3 ? 1 : 0), 5 - i, w, 1, hc); }
      P(7, 5, shade(hc, 0.25));
      if (M.glow) { P(8, 6, M.glow); P(11, 6, M.glow); }
      if (M.star) { P(9, 3, '#ffffff'); P(11, 1, '#ffffff'); }
      if (t === 5) { P(5, 5, M.trim); P(4, 4, M.trim); P(14, 5, M.trim); P(15, 4, M.trim); }
      if (t >= 3) P(10, 6, accAt(he.a, 10, 6));
    } else if (fam === 'band') {
      hairs(16);
      if (t <= 1) { R(5, 7, 10, 1, M.c); if (t === 1) { R(5, 4, 10, 3, he.a ? accBase(he.a) : M.cloth); R(6, 3, 8, 1, he.a ? accBase(he.a) : M.cloth); } }
      else { R(5, 7, 10, 1, M.trim || M.c); P(9, 6, accAt(he.a, 9, 6)); P(10, 6, accAt(he.a, 10, 6)); }
      if (t === 2 || t === 3) { R(14, 3, 1, 4, he.a ? accBase(he.a) : '#d04040'); P(15, 2, he.a ? accBase(he.a) : '#d04040'); } // plume
      if (t === 4 && M.glow) { P(7, 7, M.glow); P(12, 7, M.glow); }
      if (t === 5) { P(5, 5, M.trim); P(4, 4, M.trim); P(14, 5, M.trim); P(15, 4, M.trim); }
      if (t === 6) { P(9, 5, '#ffffff'); P(10, 4, '#e8f0ff'); }
      if (t === 7) { R(8, 5, 4, 2, M.c); P(9, 5, '#ffffff'); P(4, 6, '#ffffff'); P(15, 6, '#ffffff'); }
    } else if (fam === 'hood') {
      const hc = he.a ? shade(dye || accBase(he.a), -0.45) : shade(M.c, -0.35);
      R(5, 4, 10, 4, hc); R(4, 7, 12, 6, hc); R(9, 3, 2, 1, hc); R(5, 4, 10, 1, shade(hc, 0.25));
      if (front) { R(7, 9, 6, 3, s); R(7, 11, 6, 2, M.c); R(8, 10, 1, 1, M.glow || e); R(11, 10, 1, 1, M.glow || e); R(4, 13, 12, 1, hc); }
      else if (side) { R(10, 9, 4, 3, s); R(10, 11, 5, 2, M.c); P(12, 10, M.glow || e); R(4, 13, 8, 1, hc); }
      else { R(4, 4, 12, 10, hc); R(9, 3, 2, 1, hc); R(9, 6, 2, 7, shade(hc, -0.3)); }
      if (t === 5) { P(5, 3, M.trim); P(4, 2, M.trim); P(14, 3, M.trim); P(15, 2, M.trim); }
      if (M.trim && t !== 5) R(5, 4, 10, 1, M.trim);
    } else if (fam === 'crown') {
      hairs(13);
      const leaf = ['#5ac84a', '#ff9ad0', '#8a6a3a', '#e2b04a', M.glow || '#5ad8ff', M.trim || '#f0b040', '#e8f0ff', '#fff2c0'][t];
      if (t <= 2) { for (let x = 6; x <= 13; x += 2) P(x, 4, leaf); P(7, 3, '#3a9a3a'); P(11, 3, '#3a9a3a'); P(9, 3, accAt(he.a, 9, 3)); }
      else { // bois de cerf
        const ac2 = t === 3 ? '#8a6a3a' : leaf;
        R(6, 1, 1, 4, ac2); R(5, 2, 1, 1, ac2); R(4, 0, 1, 2, ac2); R(13, 1, 1, 4, ac2); R(14, 2, 1, 1, ac2); R(15, 0, 1, 2, ac2);
        R(6, 4, 8, 1, M.c); P(9, 4, accAt(he.a, 9, 4)); P(10, 4, accAt(he.a, 10, 4));
      }
    }
  } else {
    // couvre-chefs d'origine de chaque classe
    if (style === 'mage') {
      if (front || side) { R(5, 9, 1, 4, h); R(14, 9, 1, 3, h); if (side) R(5, 9, 4, 4, h); }
      R(3, 8, 14, 1, pal.d); R(4, 7, 12, 1, pal.b); R(6, 6, 8, 1, gg); R(6, 5, 8, 1, pal.b); R(7, 4, 6, 1, pal.b); R(8, 3, 4, 1, pal.b); R(9, 2, 3, 1, pal.b); R(10, 1, 2, 1, pal.b); R(11, 0, 2, 1, shade(pal.b, 0.25));
      P(12, 5, '#ffe080');
    } else if (style === 'paladin') {
      const hb = pal.b;
      R(5, 5, 10, 4, hb); R(6, 4, 8, 1, hb); R(5, 5, 10, 1, shade(hb, 0.25)); R(5, 8, 10, 1, gg);
      if (front) { R(5, 9, 1, 4, hb); R(14, 9, 1, 4, hb); } else if (side) { R(5, 9, 4, 4, hb); } else R(5, 9, 10, 4, hb);
      R(9, 2, 2, 3, gg);
    } else if (style === 'assassin') {
      const hd = pal.d;
      R(5, 4, 10, 4, hd); R(4, 7, 12, 6, hd); R(9, 3, 2, 1, hd); R(5, 4, 10, 1, shade(hd, 0.2));
      if (front) { R(7, 9, 6, 3, s); R(7, 11, 6, 2, shade(hd, -0.3)); R(8, 10, 1, 1, e); R(11, 10, 1, 1, e); R(4, 13, 12, 1, hd); }
      else if (side) { R(10, 9, 4, 3, s); R(10, 11, 5, 2, shade(hd, -0.3)); P(12, 10, e); R(4, 13, 8, 1, hd); }
      else { R(4, 4, 12, 10, hd); R(9, 3, 2, 1, hd); R(5, 5, 10, 1, shade(hd, 0.25)); R(9, 6, 2, 7, shade(hd, -0.3)); }
    } else if (style === 'hat') {
      R(4, 6, 12, 1, '#2a2a34'); R(6, 1, 8, 5, '#2a2a34'); R(6, 4, 8, 1, '#8a2a2a');
      if (front) { R(5, 7, 1, 4, h); R(14, 7, 1, 4, h); } else if (side) R(5, 7, 4, 5, h);
    } else {
      hairs(longHair);
      if (style === 'archere') R(5, 7, 10, 1, pal.d);
      if (style === 'druide') { P(6, 4, '#5ac84a'); P(8, 3, '#3a9a3a'); P(10, 3, '#5ac84a'); P(12, 4, '#3a9a3a'); P(7, 4, '#3a9a3a'); P(11, 4, '#5ac84a'); P(9, 3, '#ff9ad0'); }
    }
  }
  if (style === 'archere' && back && !(cape && cape.t !== 5)) { R(11, 9, 3, 7, '#7a4a24'); R(11, 9, 1, 7, '#9a6434'); P(11, 7, '#e8e0d0'); P(12, 6, '#d04040'); P(13, 7, '#e8e0d0'); R(11, 8, 3, 1, '#c8b890'); }

  // ---------- contour ----------
  g.setTransform(1, 0, 0, 1, 0, 0);
  const id = g.getImageData(0, 0, HW, HH), px = id.data, Aq = i => px[i * 4 + 3] > 0;
  const out = [];
  for (let y = 0; y < HH; y++) for (let x = 0; x < HW; x++) {
    const i = y * HW + x; if (Aq(i)) continue;
    if ((x > 0 && Aq(i - 1)) || (x < HW - 1 && Aq(i + 1)) || (y > 0 && Aq(i - HW)) || (y < HH - 1 && Aq(i + HW))) out.push(i);
  }
  for (const i of out) { px[i * 4] = OUTLINE[0]; px[i * 4 + 1] = OUTLINE[1]; px[i * 4 + 2] = OUTLINE[2]; px[i * 4 + 3] = 255; }
  if (white) for (let i = 0; i < px.length; i += 4) if (px[i + 3]) { px[i] = px[i + 1] = px[i + 2] = 255; }
  g.putImageData(id, 0, 0);
  heroSprCache.set(key, c);
  return c;
}

// ---------- armes : une forme par palier, l'accent de la panoplie sur la garde ou la gemme ----------
const wpnCache = new Map();
function outlineCanvas(c) {
  const g = c.getContext('2d'), id = g.getImageData(0, 0, c.width, c.height), px = id.data, W2 = c.width, A = i => px[i * 4 + 3] > 0;
  const out = []; for (let i = 0; i < W2 * c.height; i++) { if (px[i * 4 + 3]) continue; const x = i % W2; if ((x > 0 && A(i - 1)) || (x < W2 - 1 && A(i + 1)) || (i >= W2 && A(i - W2)) || A(i + W2)) out.push(i); }
  for (const i of out) { px[i * 4] = OUTLINE[0]; px[i * 4 + 1] = OUTLINE[1]; px[i * 4 + 2] = OUTLINE[2]; px[i * 4 + 3] = 255; }
  g.putImageData(id, 0, 0);
}
// kind : sword, mace, dagger, staff, nstaff ; t : palier (-1 = arme de base) ; a : accent
function wpnSprite(kind, t = -1, a = 0) {
  const key = kind + t + '|' + a; let c = wpnCache.get(key); if (c) return c;
  c = document.createElement('canvas'); c.width = 11; c.height = 24; const g = c.getContext('2d');
  const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); }, P = (x, y, col) => R(x, y, 1, 1, col);
  const T = Math.max(0, t), M = MAT[T], acc = a ? accAt(a, 5, 5) : (t >= 3 ? '#e2b04a' : '#c8a060');
  const steel = t < 0 ? '#c8ccd8' : t <= 2 ? ['#b8bcc6', '#c8ccd8', '#e2e8f2'][t] : t === 3 ? '#e8ecf4' : t === 4 ? '#5a6a8a' : t === 5 ? '#c8382a' : t === 6 ? '#3a4ab0' : '#f4e6b0';
  const edge = t === 4 ? '#5ad8ff' : t === 5 ? '#ffb050' : t === 6 ? '#e8f0ff' : '#ffffff';
  const grip = T >= 6 ? '#2a2a4a' : '#5a3b22';
  if (kind === 'sword') {
    const len = 8 + Math.min(6, T), w = T >= 2 ? 2 : 1, cx = 5, top = 16 - len;
    R(cx - (w > 1 ? 1 : 0), top + 1, w, len, steel); P(cx, top, edge); R(cx - (w > 1 ? 1 : 0), top + 1, 1, len, edge);
    if (T === 5) for (let y = top + 2; y < 16; y += 2) P(cx + 1, y, edge);
    if (T === 4 || T === 6) for (let y = top + 3; y < 15; y += 3) P(cx, y, M.glow);
    if (T === 7) { R(cx - 2, top + 3, 1, len - 4, steel); P(cx - 2, top + 2, edge); }
    const gw = T <= 1 ? 3 : T <= 3 ? 5 : 7;
    R(cx - (gw >> 1), 16, gw, 1, T >= 3 ? (M.trim || '#e2b04a') : '#8a6a3a'); if (T >= 6) { P(cx - 3, 15, M.trim || '#ffffff'); P(cx + 3, 15, M.trim || '#ffffff'); }
    P(cx, 16, acc); R(cx, 17, 1, 3, grip); P(cx, 20, acc);
    c.ax = cx; c.ay = 18;
  } else if (kind === 'mace') {
    const cx = 5, head = T === 0 ? '#8a5a32' : M.c, hh = shade(head, 0.3);
    R(cx, 7, 1, 13, T === 0 ? '#6a4024' : grip);
    if (T === 0) { R(cx - 1, 2, 3, 6, head); R(cx - 1, 2, 1, 6, hh); }
    else if (T === 1) { R(cx - 2, 3, 5, 4, head); P(cx - 3, 4, head); P(cx + 3, 4, head); P(cx, 2, head); R(cx - 2, 3, 5, 1, hh); }
    else { const hw = T >= 5 ? 7 : 5; R(cx - (hw >> 1), 2, hw, 5, head); R(cx - (hw >> 1), 2, hw, 1, hh); R(cx - (hw >> 1), 6, hw, 1, shade(head, -0.3)); if (T === 5) { P(cx - 4, 1, M.trim); P(cx + 4, 1, M.trim); } if (M.glow) P(cx, 4, M.glow); if (M.trim && T !== 5) R(cx - (hw >> 1), 4, hw, 1, M.trim); }
    P(cx, T >= 2 ? 4 : 5, acc); P(cx, 20, acc);
    c.ax = cx; c.ay = 15;
  } else if (kind === 'dagger') {
    const cx = 5, len = 4 + Math.min(3, T >> 1);
    R(cx, 10 - len, 1, len, steel); P(cx, 10 - len - 1, edge); if (T === 1 || T === 5) P(cx + 1, 10 - len, steel);
    if (M.glow && T >= 4) P(cx, 8, M.glow);
    R(cx - 1, 10, 3, 1, T >= 3 ? (M.trim || '#e2b04a') : '#8a2a3a'); P(cx, 10, acc); R(cx, 11, 1, 2, grip); P(cx, 13, acc);
    c.ax = cx; c.ay = 12;
  } else { // bâtons
    const nat = kind === 'nstaff', cx = 5;
    const wood = nat ? (T === 0 ? '#6a4a24' : T === 7 ? '#e2cf8a' : T === 6 ? '#3a4a8a' : T >= 4 ? M.d : '#7a5a2e') : (T <= 1 ? '#7a4f2a' : T === 2 ? '#9aa0aa' : T === 3 ? '#e2b04a' : M.c);
    R(cx, 5, 1, 17, wood); R(cx, 5, 1, 17, wood);
    for (let y = 8; y < 21; y += 4) P(cx, y, shade(wood, -0.25));
    const orb = a ? accAt(a, 5, 2) : nat ? '#7ae05a' : '#7ad0ff';
    if (!nat) {
      if (T === 0) { R(cx - 1, 3, 3, 3, wood); P(cx, 2, wood); }
      else if (T <= 3) { R(cx - 1, 2, 3, 3, orb); P(cx, 1, '#ffffff'); R(cx - 2, 5, 5, 1, T === 3 ? '#f0c860' : wood); }
      else if (T === 4) { R(cx - 1, 2, 3, 3, orb); P(cx - 3, 3, M.glow); P(cx + 3, 3, M.glow); P(cx, 0, M.glow); }
      else if (T === 5) { R(cx - 1, 2, 3, 3, '#ff6a2a'); P(cx - 2, 1, M.d); P(cx + 2, 1, M.d); P(cx - 2, 5, M.d); P(cx + 2, 5, M.d); }
      else if (T === 6) { P(cx, 0, '#ffffff'); R(cx - 1, 1, 3, 3, orb); P(cx - 2, 2, '#ffffff'); P(cx + 2, 2, '#ffffff'); P(cx, 4, '#ffffff'); }
      else { R(cx - 2, 1, 5, 4, '#fff2c0'); R(cx - 1, 2, 3, 2, orb); P(cx - 3, 0, '#ffffff'); P(cx + 3, 0, '#ffffff'); }
    } else {
      if (T <= 1) { P(cx - 1, 4, wood); P(cx + 1, 3, wood); P(cx - 1, 2, '#4ab83a'); P(cx + 1, 1, '#4ab83a'); if (T === 1) { P(cx + 1, 9, '#c0c0a0'); P(cx - 1, 13, '#c0c0a0'); } }
      else if (T <= 3) { R(cx - 1, 2, 3, 3, orb); P(cx - 2, 3, '#4ab83a'); P(cx + 2, 2, '#4ab83a'); if (T === 3) { P(cx - 2, 1, '#e2b04a'); P(cx + 2, 5, '#e2b04a'); } }
      else { R(cx - 1, 2, 3, 3, orb); P(cx - 2, 0, wood); P(cx + 2, 0, wood); P(cx - 3, 1, wood); P(cx + 3, 1, wood); if (M.glow) P(cx, 3, M.glow); }
      P(cx + 1, 8, '#4ab83a'); P(cx - 1, 12, '#5ac84a');
    }
    c.ax = cx; c.ay = 14; c.orbY = 3;
  }
  outlineCanvas(c); c.ax += 0; wpnCache.set(key, c); return c;
}
function bowSprite(pull, t = -1, a = 0) {
  const key = 'bow' + pull + '|' + t + '|' + a; let c = wpnCache.get(key); if (c) return c;
  const T = Math.max(0, t), M = MAT[T];
  c = document.createElement('canvas'); c.width = 11; c.height = 20; const g = c.getContext('2d');
  const wood = T <= 1 ? '#8a5a2b' : T === 2 ? '#9aa0aa' : T === 3 ? '#8a5a2b' : M.c, woodH = shade(wood, 0.3);
  const big = T >= 1 ? 1 : 0;
  const curve = [[3, 1], [4, 2], [5, 3], [5, 4], [6, 5], [6, 6], [6, 7], [6, 8], [6, 9], [6, 10], [6, 11], [6, 12], [5, 13], [5, 14], [4, 15], [3, 16]];
  for (const [x, y] of curve) { g.fillStyle = wood; g.fillRect(x + big, y + 1, 1, 1); }
  g.fillStyle = woodH; g.fillRect(6 + big, 8, 1, 4); g.fillStyle = '#5a3b22'; g.fillRect(6 + big, 9, 1, 2);
  const tip = T >= 3 ? (M.trim || '#e2b04a') : T === 2 ? '#e2e8f2' : null;
  if (tip) { g.fillStyle = tip; g.fillRect(3 + big, 1, 1, 1); g.fillRect(3 + big, 17, 1, 1); }
  if (T === 5) { g.fillStyle = M.trim; g.fillRect(2 + big, 0, 1, 1); g.fillRect(2 + big, 18, 1, 1); }
  if (a) { g.fillStyle = accAt(a, 6, 9); g.fillRect(7 + big, 9, 1, 2); }
  g.fillStyle = M.glow && T >= 4 ? M.glow : '#e8e0c8';
  for (let y = 3; y <= 16; y++) { const tt = Math.abs(y - 9.5) / 6.5; g.fillRect(Math.round(3 + big - pull * (1 - tt)), y, 1, 1); }
  if (pull > 0) { const sx = 3 + big - pull; g.fillStyle = '#d6dae4'; g.fillRect(sx, 9, 9 - sx, 1); g.fillStyle = '#ffffff'; g.fillRect(9, 9, 1, 1); g.fillStyle = a ? accAt(a, 1, 1) : '#d04040'; g.fillRect(sx, 8, 1, 1); g.fillRect(sx, 10, 1, 1); }
  outlineCanvas(c);
  c.ax = 6 + big; c.ay = 10; wpnCache.set(key, c); return c;
}
const WPN_OF = { guerrier: 'sword', archere: 'bow', mage: 'staff', paladin: 'mace', assassin: 'dagger', druide: 'nstaff' };
const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const SPIN_DIRS = [0, 3, 1, 2];

// Dessine un héros. (x, y) = pieds à l'écran. st = objet persistant (animations). Renvoie la hauteur.
function drawHero2(view, x, y, cls, pal, palKey, opts = {}, st = view) {
  const style = STYLE_OF[cls] || 'npc', s = S * (opts.scale || 1);
  const em = emotes.get(view.id);
  let dir = view.dir;
  const now = time;
  if (view.atk && !st._atkPrev) { st.atkT0 = now; st.atkN = (st.atkN || 0) + 1; }
  st._atkPrev = view.atk;
  const atkT = st.atkT0 != null ? (now - st.atkT0) / 0.3 : 9;
  const castT = st.castT0 != null ? (now - st.castT0) / 0.5 : 9;
  const castK = st.castK || '';
  if (castK === 'guerrier0' && castT < 1) dir = SPIN_DIRS[Math.floor(castT * 16) % 4];
  let flip = dir === 2; const d3 = dir === 2 ? 3 : dir;
  if (em && em.k === 'danse' && Math.floor(now * 4) % 2) flip = !flip;
  const walking = view.mv && !view.dead;
  const f = walking ? [1, 0, 2, 0][Math.floor((now + view.id * 0.37) * 8) % 4] : 0;
  const pose = view.ride ? 'r' : castT < 0.8 && castK !== 'guerrier0' && castK !== 'archere1' ? 'c' : 'n';
  const vis = opts.vis || '', dye = opts.dye || '';
  const spr = heroSprite(style, pal, palKey, d3, f, pose, false, vis, dye);
  st.lastSpr = spr; st.lastFlip = flip;
  let bob = walking && f ? -1 * s : 0;
  if (em && em.k === 'danse') bob = -Math.abs(Math.sin(now * 10)) * 3 * s;
  if (opts.float) bob += Math.sin(now * 3 + view.id) * 2 * s;
  let lx = 0, ly = 0;
  if (atkT < 1) { const kk = Math.sin(Math.min(1, atkT) * Math.PI) * 1.5 * s; lx = (dir === 3 ? 1 : dir === 2 ? -1 : 0) * kk; ly = (dir === 0 ? 1 : dir === 1 ? -1 : 0) * kk * 0.6; }
  const W = HW * s, H = HH * s;
  ctx.save();
  if (opts.alpha) ctx.globalAlpha *= opts.alpha;
  ctx.translate(x + lx, y + ly + bob);
  if (castK === 'archere1' && castT < 0.7) { ctx.translate(0, -10 * s); ctx.rotate((castT / 0.7) * Math.PI * 2 * (flip ? -1 : 1)); ctx.translate(0, 10 * s); }
  if (view.dead) ctx.rotate(1.45);
  if (flip) ctx.scale(-1, 1);
  ctx.translate(-HFX * s, -HFY * s);
  if (castT < 1 && pose === 'c') {
    const col = { guerrier: '255,90,60', archere: '255,230,140', mage: '120,170,255', paladin: '255,220,120', assassin: '200,90,255', druide: '110,230,90' }[cls] || '255,255,255';
    ctx.save(); ctx.globalAlpha *= 1 - castT; ctx.strokeStyle = `rgb(${col})`; ctx.lineWidth = s;
    ctx.beginPath(); ctx.ellipse(HFX * s, HFY * s, (6 + castT * 6) * s, (2 + castT * 2) * s, 0, 0, 7); ctx.stroke(); ctx.restore();
  }
  const wv = parseVis(vis).arme;
  const wk = opts.weapon === undefined ? WPN_OF[cls] : opts.weapon;
  const drawW = () => { if (wk) drawWeapon(wk, view, st, d3, pose, atkT, castT, castK, s, opts.glow, wv); };
  if (d3 === 1) drawW();
  ctx.drawImage(spr, 0, 0, W, H);
  if (view.flash > 0) { ctx.globalAlpha *= Math.min(1, view.flash * 6); ctx.drawImage(heroSprite(style, pal, palKey, d3, f, pose, true, vis, dye), 0, 0, W, H); ctx.globalAlpha = 1; }
  if (d3 !== 1) drawW();
  ctx.restore();
  return (HFY - (style === 'mage' ? 1 : 4)) * s - bob;
}
// coordonnées de la main dans le sprite (marge de 1 à gauche, 2 en haut)
function drawWeapon(wk, view, st, dir, pose, atkT, castT, castK, s, glow, wv) {
  let hx, hy, ang, img;
  const atk = atkT < 1, t = Math.min(1, Math.max(0, atkT)), wt = wv ? wv.t : -1, wa = wv ? wv.a : 0;
  if (pose === 'c') { hx = dir === 3 ? 12 : dir === 1 ? 4 : 16; hy = 8; ang = dir === 3 ? 0.2 : 0; }
  else if (dir === 3) { hx = 11; hy = 19; ang = 0.55; }
  else if (dir === 1) { hx = 4.5; hy = 19; ang = -0.4; }
  else { hx = 15; hy = 19; ang = 0.35; }
  hx += 1; hy += 2;
  const swingW = dir === 1 ? -1 : 1;
  if (wk === 'bow') {
    const pull = atk ? (t < 0.65 ? Math.min(3, Math.round(t / 0.65 * 3)) : 0) : 0;
    img = bowSprite(pull, wt, wa);
    ang = dir === 3 ? 0 : dir === 1 ? 0.1 : -0.1;
    if (dir === 0) { hx = 16; hy = 19; } if (dir === 3) { hx = 14; hy = 19; }
    if (pose === 'c') { ang = -0.9; hy = 11; }
  } else {
    img = wpnSprite(wk, wt, wa);
    if (atk) {
      if (wk === 'sword') ang = swingW * (-2.1 + ease(t) * 3.6);
      else if (wk === 'mace') ang = swingW * (-2.6 + ease(t) * 3.7);
      else if (wk === 'staff' || wk === 'nstaff') { ang = (dir === 1 ? -1 : 1) * (0.2 + Math.sin(t * Math.PI) * 1.1); hy -= Math.sin(t * Math.PI) * 2; }
    }
    if (castK === 'guerrier0' && castT < 1) ang = castT * Math.PI * 4;
    if (view.mv && !atk) ang += Math.sin(time * 16 + view.id) * 0.06;
  }
  const g0 = glow || (wv && wv.gl ? MAT[wv.t].glow || '#ffd34a' : null);
  const one = (x, y, a, im, stab) => {
    ctx.save(); ctx.translate(x * s, y * s); ctx.rotate(a);
    if (stab) ctx.translate(0, -stab * s);
    if (g0) { ctx.shadowColor = g0; ctx.shadowBlur = 3 * s * (0.7 + 0.3 * Math.sin(time * 6)); }
    ctx.drawImage(im, -im.ax * s, -im.ay * s, im.width * s, im.height * s);
    ctx.restore();
  };
  if (wk === 'dagger') {
    const alt = (st.atkN || 0) % 2, stab = atk ? Math.sin(t * Math.PI) * 4 : 0;
    const fwd = dir === 3 ? 1.4 : 1.4;
    if (pose === 'c') { one(17, 10, 0, img); one(5, 10, 0, img); return; }
    if (dir === 3) { one(hx, hy, fwd + (alt ? 0 : 0.3), img, alt ? stab : 0); one(hx - 4, hy, fwd - 0.3, img, alt ? 0 : stab); }
    else { one(16, 21, dir === 1 ? -2.6 : 2.6, img, alt ? stab : 0); one(6, 21, dir === 1 ? 2.6 : -2.6, img, alt ? 0 : stab); }
    return;
  }
  one(hx, hy, ang, img);
  if ((wk === 'staff' || wk === 'nstaff') && ((atk && t > 0.25 && t < 0.75) || (pose === 'c' && castT < 0.7))) {
    ctx.save(); ctx.translate(hx * s, hy * s); ctx.rotate(ang); const oy = -(img.ay - (img.orbY || 3)) * s;
    const gr = ctx.createRadialGradient(0, oy, 0, 0, oy, 7 * s); const c0 = wk === 'nstaff' ? '120,255,120' : '140,200,255';
    gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(0.3, `rgba(${c0},.7)`); gr.addColorStop(1, `rgba(${c0},0)`);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, oy, 7 * s, 0, 7); ctx.fill(); ctx.restore();
  }
}
function drawHero2Preview(g, cls, cw, ch, walkF = 0, vis = '', dye = '') {
  const spr = heroSprite(STYLE_OF[cls] || 'npc', PAL[cls], cls, 0, walkF, 'n', false, vis, dye);
  const k = Math.min(cw / HW, ch / HH) * 0.95, ox = (cw - HW * k) / 2, oy = ch - HH * k;
  g.imageSmoothingEnabled = false; g.drawImage(spr, ox, oy, HW * k, HH * k);
  const wk = WPN_OF[cls]; if (!wk) return;
  const wv = parseVis(vis).arme, wt = wv ? wv.t : -1, wa = wv ? wv.a : 0;
  const im = wk === 'bow' ? bowSprite(0, wt, wa) : wpnSprite(wk, wt, wa);
  const hx = 16, hy = wk === 'bow' ? 19 : 21, a = wk === 'bow' ? -0.1 : 0.35;
  if (wk === 'dagger') {
    for (const [x, aa] of [[16, 2.6], [6, -2.6]]) { g.save(); g.translate(ox + x * k, oy + 21 * k); g.rotate(aa); g.drawImage(im, -im.ax * k, -im.ay * k, im.width * k, im.height * k); g.restore(); }
    return;
  }
  g.save(); g.translate(ox + hx * k, oy + hy * k); g.rotate(a); g.drawImage(im, -im.ax * k, -im.ay * k, im.width * k, im.height * k); g.restore();
}

// ---------- montures : dessinées dans le même style, vues de profil ----------
const MOUNT_DEF = {
  sanglier: { type: 'boar', c: '#7a5434', d: '#4e3220', m: '#3a2416', seat: 10 },
  cheval: { type: 'horse', c: '#8a5a32', d: '#5a3a1e', m: '#3a2414', seat: 12 },
  cerf: { type: 'horse', c: '#a8784a', d: '#6a4a2a', m: '#e8dcc8', antler: '#d8c8a0', spots: '#f0e6d0', seat: 12 },
  loup: { type: 'cat', c: '#7a7a82', d: '#4a4a52', m: '#a9a9b0', ear: 1, seat: 9 },
  tigre: { type: 'cat', c: '#eef0f4', d: '#b8c0cc', m: '#ffffff', stripes: '#2a2a34', eye: '#5ab0ff', seat: 9 },
  salamandre: { type: 'lizard', c: '#d8501a', d: '#8a2a10', m: '#ffd040', glow: '#ffb030', seat: 8 },
  spectre: { type: 'horse', c: '#bcd8ff', d: '#8aaad8', m: '#e6f3ff', ghost: 1, eye: '#3a6aff', seat: 12 },
  griffon: { type: 'horse', c: '#c89a5a', d: '#8a6232', m: '#f4f0e6', griffon: 1, wing: '#8a5a32', seat: 12 },
  licorne: { type: 'horse', c: '#f4f0f8', d: '#c8c0d8', m: 'R', horn: '#f0c860', seat: 12 },
  drake: { type: 'lizard', c: '#7a1e1a', d: '#3a0e0c', m: '#f0b040', wing: '#5a1410', horn: '#e8d8b0', seat: 11 },
};
const mountCache = new Map();
function mountSprite(k, f) {
  const key = k + f; let c = mountCache.get(key); if (c) return c;
  const D = MOUNT_DEF[k] || MOUNT_DEF.cheval;
  c = document.createElement('canvas'); c.width = 34; c.height = 30; const g = c.getContext('2d'); g.translate(0, 4);
  const R = (x, y, w, h, col) => { if (w <= 0 || h <= 0) return; g.fillStyle = col; g.fillRect(x, y, w, h); }, P = (x, y, col) => R(x, y, 1, 1, col);
  const C = D.c, Dk = D.d, H = shade(C, 0.25), M = D.m === 'R' ? null : D.m;
  const mane = (x, y) => M || `hsl(${(x * 30 + y * 20) % 360},85%,65%)`;
  // pattes : 4 images de galop
  const legs = [[0, 0, 0, 0], [-2, 1, 2, -1], [-1, 2, 1, -2], [2, -1, -2, 1]][f];
  const lifts = [[0, 0, 0, 0], [0, 2, 0, 2], [1, 1, 1, 1], [2, 0, 2, 0]][f];
  let li = 0;
  const leg = (x, top, len, off, col) => { const lf = lifts[li++ % 4]; R(x, top, 2, 2, col); R(x + off, top + 2, 2, len - 2 - lf, col); R(x + off, top + len - lf, 2, 1, shade(col, -0.45)); };
  const SADDLE = { horse: 11, cat: 13, boar: 10, lizard: 13 };
  if (D.type === 'horse') {
    const by = 9;
    if (D.griffon) { // ailes repliées qui battent au galop
      const fl = f === 1 || f === 3 ? -2 : 0;
      for (let i = 0; i < 6; i++) R(9 + i * 2, by - 3 - i + fl + (i > 3 ? i - 3 : 0), 2, 5 + i, i % 2 ? D.wing : shade(D.wing, 0.25));
    }
    leg(8, by + 6, 6, legs[0], Dk); leg(19, by + 6, 6, legs[2], Dk);
    R(6, by, 17, 7, C); R(7, by - 1, 15, 1, C); R(6, by, 17, 1, H); R(6, by + 6, 17, 1, Dk);
    if (D.spots) { P(9, by + 2, D.spots); P(12, by + 1, D.spots); P(15, by + 3, D.spots); P(18, by + 2, D.spots); }
    leg(11, by + 6, 6, legs[1], C); leg(21, by + 6, 6, legs[3], C);
    // encolure et tête
    if (D.griffon) {
      R(21, by - 4, 5, 6, D.m); R(24, by - 6, 5, 5, D.m); R(29, by - 4, 2, 2, '#f0c040'); P(31, by - 3, '#c08a20'); P(27, by - 5, '#1a1008'); R(23, by - 7, 2, 2, D.m);
    } else {
      // encolure en biais puis tête allongée
      for (let i = 0; i < 7; i++) R(20 + (i >> 1), by + 1 - i, 4, 2, C);
      R(23, by - 8, 4, 3, C); R(26, by - 7, 4, 3, C); R(29, by - 6, 2, 3, shade(C, -0.15)); P(30, by - 4, Dk); R(27, by - 5, 3, 1, shade(C, -0.1));
      P(25, by - 7, D.eye || '#1a1008'); R(23, by - 10, 1, 2, C); R(25, by - 10, 1, 2, C); P(23, by - 10, Dk);
      for (let i = 0; i < 8; i++) P(20 + (i >> 1) - 1 + (i > 6 ? 1 : 0), by + 1 - i, mane(20, i)); R(22, by - 9, 2, 2, mane(22, 9));
      if (D.antler) { R(24, by - 13, 1, 3, D.antler); P(23, by - 12, D.antler); P(22, by - 13, D.antler); P(25, by - 14, D.antler); R(26, by - 13, 1, 3, D.antler); P(27, by - 14, D.antler); P(21, by - 14, D.antler); }
      if (D.horn) { R(28, by - 10, 1, 2, D.horn); P(29, by - 12, D.horn); P(29, by - 11, '#fff4c0'); P(30, by - 13, '#fff4c0'); }
    }
    // queue
    for (let i = 0; i < 6; i++) P(5 - (i >> 1), by + i, mane(5, by + i)); R(4, by, 2, 2, mane(4, by));
    if (D.griffon) { R(3, by + 1, 3, 1, D.c); R(1, by, 2, 3, D.m); }
    // selle
    R(12, by - 2, 6, 2, '#6a3a1e'); R(12, by - 2, 6, 1, '#8a5a2e'); R(13, by, 1, 3, '#4a2a14'); P(14, by - 2, '#e2b04a');
  } else if (D.type === 'cat') {
    const by = 11;
    leg(7, by + 5, 5, legs[0], Dk); leg(19, by + 5, 5, legs[2], Dk);
    R(6, by, 16, 6, C); R(7, by - 1, 14, 1, C); R(6, by, 16, 1, H); R(7, by + 5, 14, 1, Dk);
    if (D.stripes) for (let x = 8; x < 21; x += 3) { R(x, by - 1, 1, 3, D.stripes); P(x + 1, by + 3, D.stripes); }
    leg(10, by + 5, 5, legs[1], C); leg(21, by + 5, 5, legs[3], C);
    R(21, by - 4, 7, 6, C); R(27, by - 2, 3, 3, Dk); R(21, by - 4, 7, 1, H); P(25, by - 3, D.eye || '#f2d04a'); P(29, by - 2, '#1a1008');
    R(22, by - 6, 2, 2, C); R(25, by - 6, 2, 2, C); P(22, by - 6, Dk); P(25, by - 6, Dk);
    if (D.stripes) { P(23, by - 4, D.stripes); P(24, by - 2, D.stripes); }
    R(3, by - 3, 2, 4, C); R(2, by - 5, 2, 3, C); R(4, by, 3, 2, C); if (D.stripes) { P(3, by - 2, D.stripes); P(2, by - 4, D.stripes); }
    R(11, by - 2, 6, 2, '#6a3a1e'); R(11, by - 2, 6, 1, '#8a5a2e'); P(13, by - 2, '#e2b04a');
  } else if (D.type === 'boar') {
    const by = 10;
    leg(8, by + 6, 4, legs[0], Dk); leg(18, by + 6, 4, legs[2], Dk);
    R(5, by, 19, 7, C); R(6, by - 2, 16, 2, C); R(6, by - 2, 16, 1, H); R(5, by + 6, 19, 1, Dk);
    for (let x = 7; x < 21; x += 2) P(x, by - 3, D.m);
    leg(11, by + 6, 4, legs[1], C); leg(21, by + 6, 4, legs[3], C);
    R(23, by, 6, 6, C); R(28, by + 2, 3, 3, '#d48a7a'); P(25, by + 1, '#1a1010'); R(27, by + 4, 1, 2, '#f2ead2'); P(26, by + 5, '#f2ead2'); P(23, by - 1, Dk);
    P(4, by + 1, Dk); P(3, by + 2, Dk);
    R(11, by - 4, 7, 2, '#6a3a1e'); R(11, by - 4, 7, 1, '#8a5a2e'); P(14, by - 4, '#e2b04a');
  } else { // lézards : salamandre, drake
    const by = 12;
    if (D.wing) { const fl = f === 1 || f === 3 ? -3 : 0; for (let i = 0; i < 7; i++) R(8 + i * 2, by - 4 - i + fl + (i > 4 ? (i - 4) * 2 : 0), 2, 4 + i, i % 2 ? D.wing : shade(D.wing, 0.3)); }
    leg(8, by + 4, 4, legs[0], Dk); leg(19, by + 4, 4, legs[2], Dk);
    R(6, by, 18, 5, C); R(7, by - 1, 16, 1, C); R(6, by, 18, 1, H); R(6, by + 4, 18, 1, Dk);
    for (let x = 0; x < 7; x++) R(x, by + 1 + (x < 3 ? 1 : 0), 7 - x > 0 ? 1 : 0, 2, x % 2 ? C : Dk);
    R(0, by + 2, 7, 2, C);
    if (D.glow) for (let x = 8; x < 22; x += 3) P(x, by + 1, D.glow);
    for (let x = 8; x < 22; x += 2) P(x, by - 2, D.m);
    leg(11, by + 4, 4, legs[1], C); leg(21, by + 4, 4, legs[3], C);
    R(23, by - 2, 8, 5, C); R(23, by - 2, 8, 1, H); P(27, by - 1, D.glow || '#ffe040'); R(29, by + 1, 3, 1, Dk);
    if (D.horn) { P(24, by - 3, D.horn); P(23, by - 4, D.horn); P(26, by - 3, D.horn); P(25, by - 4, D.horn); }
    R(12, by - 3, 6, 2, '#5a2a14'); R(12, by - 3, 6, 1, '#7a4a24'); P(14, by - 3, '#e2b04a');
  }
  g.setTransform(1, 0, 0, 1, 0, 0); outlineCanvas(c);
  if (D.ghost) { const id = g.getImageData(0, 0, c.width, c.height); for (let i = 3; i < id.data.length; i += 4) if (id.data[i]) id.data[i] = 200; g.putImageData(id, 0, 0); }
  c.seat = D.seat + 4; c.saddle = SADDLE[D.type] || 11; mountCache.set(key, c); return c;
}
// dessine la monture et renvoie la hauteur de selle (pixels écran)
function drawMount(k, e, x, y, flip, moving) {
  const f = moving ? Math.floor((time + e.id * 0.3) * 10) % 4 : 0;
  const img = mountSprite(k, f), s = S;
  const bob = moving ? (f % 2 ? -s : 0) : Math.round(Math.sin(time * 2) * 0.5) * s;
  ctx.save(); ctx.translate(x, y + bob); if (flip) ctx.scale(-1, 1);
  ctx.drawImage(img, -17 * s, -30 * s + 1 * s, 34 * s, 30 * s);
  ctx.restore();
  const D = MOUNT_DEF[k] || {};
  if (D.ghost && Math.random() < 0.3) particles.push({ x: e.rx + (Math.random() - 0.5), y: e.ry - Math.random() * 0.6, vx: 0, vy: -0.8, life: 0.6, max: 0.6, c: '#c8e0ff', s: 1.3 });
  if (D.glow && moving && Math.random() < 0.4) particles.push({ x: e.rx + (Math.random() - 0.5) * 0.8, y: e.ry - 0.2, vx: 0, vy: -1, life: 0.5, max: 0.5, c: D.glow, s: 1.3 });
  if (k === 'licorne' && Math.random() < 0.2) particles.push({ x: e.rx + (flip ? -0.6 : 0.6), y: e.ry - 1.4, vx: 0, vy: -0.6, life: 0.6, max: 0.6, c: `hsl(${Math.random() * 360},90%,70%)`, s: 1.2 });
  e._mdx = (flip ? 2 : -2) * s;
  return (22 - img.saddle) * s - bob;
}

// ---------- auras de prestige : une nouvelle à chaque renaissance, de plus en plus impressionnante ----------
const AURA_NAMES = ['', 'Lueur', 'Sève', 'Onde', 'Runes d\'or', 'Brasier', 'Givre éternel', 'Tempête', 'Néant', 'Céleste', 'Prisme', 'Transcendance'];
function drawPrestige(e, sx, sy, h, layer) {
  const rb = e.rb | 0; if (rb < 1 || fxLow) return;
  const s = S, t = time + (e.id || 0) * 0.37, lv = Math.min(rb, 11), extra = Math.max(0, rb - 10);
  const P = (x, y, vx, vy, c, sz, life) => particles.push({ x, y, vx, vy, life, max: life, c, s: sz });
  const ring = (rx, ry, col, w, a) => { ctx.strokeStyle = col; ctx.globalAlpha = a; ctx.lineWidth = w * s; ctx.beginPath(); ctx.ellipse(sx, sy, rx * s, ry * s, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; };
  const glow = (cx, cy, r, col, a) => { const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`); ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2); };
  const runeCircle = (R, col, n, speed, a) => {
    ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = s;
    ctx.beginPath(); ctx.ellipse(sx, sy, R * s, R * 0.45 * s, 0, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(sx, sy, (R - 2.5) * s, (R - 2.5) * 0.45 * s, 0, 0, 7); ctx.stroke();
    ctx.fillStyle = col;
    for (let i = 0; i < n; i++) { const a2 = t * speed + i * Math.PI * 2 / n, x = sx + Math.cos(a2) * (R - 1.2) * s, y = sy + Math.sin(a2) * (R - 1.2) * 0.45 * s; ctx.fillRect(x - s, y - s * 0.5, 2 * s, s); ctx.fillRect(x - s * 0.5, y - s, s, 2 * s); }
    ctx.restore();
  };
  const rainbow = o => `hsl(${(t * 80 + o) % 360},90%,65%)`;
  if (layer === 'back') {
    // --- au sol et derrière le héros ---
    if (lv === 1) { glow(sx, sy - 2 * s, 12 * s, '255,250,230', 0.25 + 0.08 * Math.sin(t * 2)); ring(9, 3.5, '#fff8e0', 1, 0.45); }
    if (lv === 2) { glow(sx, sy - 4 * s, 14 * s, '120,230,120', 0.25); ring(10, 4, '#7ae07a', 1, 0.6); }
    if (lv === 3) { for (let i = 0; i < 3; i++) { const p = ((t * 0.6 + i / 3) % 1); ring(4 + p * 10, (4 + p * 10) * 0.42, '#7ac8ff', 1, (1 - p) * 0.8); } glow(sx, sy - 4 * s, 14 * s, '90,170,255', 0.2); }
    if (lv === 4) { glow(sx, sy, 16 * s, '255,215,120', 0.25); runeCircle(12, '#ffd77a', 8, 0.8, 0.85); }
    if (lv === 5) { glow(sx, sy - 6 * s, 18 * s, '255,120,40', 0.32 + 0.1 * Math.sin(t * 6)); runeCircle(11, '#ff8a2a', 6, -1.2, 0.7); }
    if (lv === 6) { glow(sx, sy - 4 * s, 18 * s, '160,220,255', 0.3); runeCircle(13, '#bfe8ff', 6, 0.6, 0.9); for (let i = 0; i < 6; i++) { const a = -t * 0.8 + i * Math.PI / 3, x = sx + Math.cos(a) * 13 * s, y = sy + Math.sin(a) * 6 * s; ctx.fillStyle = '#e8f8ff'; ctx.beginPath(); ctx.moveTo(x, y - 5 * s); ctx.lineTo(x + 1.5 * s, y); ctx.lineTo(x, y + 1 * s); ctx.lineTo(x - 1.5 * s, y); ctx.fill(); } }
    if (lv === 7) { glow(sx, sy - 8 * s, 22 * s, '170,120,255', 0.3 + 0.15 * Math.random()); runeCircle(13, '#c8a0ff', 8, 1.5, 0.85); }
    if (lv === 8) { glow(sx, sy - 6 * s, 24 * s, '60,0,90', 0.55); runeCircle(14, '#9a5aff', 10, -0.9, 0.9); runeCircle(9, '#5a2a9a', 5, 1.4, 0.8);
      for (let i = 0; i < 5; i++) { const a = t * 1.3 + i * 1.256; ctx.strokeStyle = 'rgba(80,20,120,.6)'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(sx + Math.cos(a) * 6 * s, sy); ctx.quadraticCurveTo(sx + Math.cos(a) * 16 * s, sy - 10 * s, sx + Math.cos(a + 0.6) * 12 * s, sy - (18 + Math.sin(t * 3 + i) * 4) * s); ctx.stroke(); } }
    if (lv >= 9) {
      const col = lv >= 10 ? null : '255,230,150';
      // ailes de lumière
      const flap = Math.sin(t * 2.4) * 0.15, wy = sy - h * 0.62;
      for (const side of [-1, 1]) for (let f = 0; f < 5; f++) {
        ctx.save(); ctx.translate(sx + side * 3 * s, wy); ctx.rotate(side * (-0.55 - f * 0.22 + flap)); ctx.globalAlpha = 0.5 - f * 0.06;
        ctx.fillStyle = col ? `rgba(${col},1)` : rainbow(f * 40 + (side > 0 ? 180 : 0));
        ctx.beginPath(); ctx.ellipse(side * (10 + f * 2) * s, 0, (12 - f) * s, 2.4 * s, 0, 0, 7); ctx.fill(); ctx.restore();
      }
      glow(sx, sy - h / 2, (26 + extra * 2) * s, col || '255,255,255', 0.28);
      if (lv >= 10) { runeCircle(15 + Math.min(6, extra), rainbow(0), 12, 1, 0.9); runeCircle(10, rainbow(120), 6, -1.6, 0.8);
        const pg = ctx.createLinearGradient(0, sy - 80 * s, 0, sy); pg.addColorStop(0, 'rgba(255,255,255,0)'); pg.addColorStop(1, `rgba(255,255,255,${0.18 + 0.1 * Math.sin(t * 3)})`); ctx.fillStyle = pg; ctx.fillRect(sx - 7 * s, sy - 80 * s, 14 * s, 80 * s); }
      else runeCircle(14, '#ffe08a', 10, 0.7, 0.9);
    }
    return;
  }
  // --- devant : particules et éléments en orbite ---
  const rnd = Math.random, cy = e.ry - 0.6;
  if (lv === 1 && rnd() < 0.12) P(e.rx + (rnd() - 0.5) * 0.8, e.ry - rnd() * 0.8, 0, -0.6, '#fff4c0', 1, 0.9);
  if (lv === 2) { for (let i = 0; i < 2; i++) { const a = t * 2 + i * Math.PI, x = sx + Math.cos(a) * 10 * s, y = sy - h * 0.5 + Math.sin(a) * 4 * s; ctx.fillStyle = '#9aec7a'; ctx.fillRect(x - s, y - s, 2 * s, 2 * s); ctx.fillStyle = '#5ac84a'; ctx.fillRect(x - 2 * s, y, s, s); } if (rnd() < 0.1) P(e.rx + (rnd() - 0.5), cy, 0, -0.8, '#7ae07a', 1.3, 0.8); }
  if (lv === 3 && rnd() < 0.2) P(e.rx + (rnd() - 0.5) * 0.9, e.ry, 0, -1.4, rnd() < 0.5 ? '#bfe8ff' : '#7ac8ff', 1.3, 0.9);
  if (lv === 4) { for (let i = 0; i < 3; i++) { const a = t * 1.5 + i * 2.09, x = sx + Math.cos(a) * 11 * s, y = sy - h * 0.55 + Math.sin(a) * 5 * s; glow(x, y, 4 * s, '255,215,120', 0.9); } if (rnd() < 0.12) P(e.rx + (rnd() - 0.5), e.ry, 0, -1.2, '#ffd77a', 1.2, 0.8); }
  if (lv === 5) { for (let i = 0; i < 3; i++) if (rnd() < 0.6) P(e.rx + (rnd() - 0.5) * 0.9, e.ry - rnd() * 0.3, (rnd() - 0.5) * 0.4, -2.4 - rnd(), ['#ffd040', '#ff8a2a', '#e03a10'][i], 1.8, 0.5); }
  if (lv === 6) { if (rnd() < 0.3) P(e.rx + (rnd() - 0.5) * 1.6, e.ry - 2 - rnd(), (rnd() - 0.5) * 0.3, 0.8, '#ffffff', 1.2, 1.4); }
  if (lv === 7) { if (rnd() < 0.25) { const a = rnd() * 7, r1 = 8 * s, x1 = sx + Math.cos(a) * r1, y1 = sy - h * 0.5 + Math.sin(a) * r1; ctx.strokeStyle = '#e0d0ff'; ctx.lineWidth = s; ctx.beginPath(); ctx.moveTo(x1, y1); let x = x1, y = y1; for (let j = 0; j < 4; j++) { x += (rnd() - 0.5) * 8 * s; y += (rnd() - 0.2) * 6 * s; ctx.lineTo(x, y); } ctx.stroke(); } for (let i = 0; i < 2; i++) { const a = -t * 3 + i * Math.PI, x = sx + Math.cos(a) * 12 * s, y = sy - h * 0.5 + Math.sin(a) * 5 * s; glow(x, y, 5 * s, '200,170,255', 0.9); } }
  if (lv === 8) { for (let i = 0; i < 4; i++) { const a = t * 1.7 + i * Math.PI / 2, x = sx + Math.cos(a) * 13 * s, y = sy - h * 0.5 + Math.sin(a) * 6 * s; ctx.fillStyle = '#140a20'; ctx.beginPath(); ctx.arc(x, y, 2.5 * s, 0, 7); ctx.fill(); glow(x, y, 5 * s, '160,80,255', 0.7); } if (rnd() < 0.3) P(e.rx + (rnd() - 0.5) * 1.2, e.ry - rnd() * 0.5, 0, -0.9, rnd() < 0.5 ? '#4a1a6a' : '#9a5aff', 2, 0.9); }
  if (lv >= 9) {
    // auréole au-dessus de la tête
    const hy = sy - h - 3 * s;
    ctx.save(); ctx.strokeStyle = lv >= 10 ? rainbow(0) : '#fff0a0'; ctx.lineWidth = 1.5 * s; ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 6 * s;
    ctx.beginPath(); ctx.ellipse(sx, hy + Math.sin(t * 2) * s, 5 * s, 1.6 * s, 0, 0, 7); ctx.stroke(); ctx.restore();
    const n = lv >= 10 ? 6 + Math.min(10, extra * 2) : 4;
    for (let i = 0; i < n; i++) { const a = t * (lv >= 10 ? 2.2 : 1.4) + i * Math.PI * 2 / n, rr = (13 + (i % 2) * 3 + Math.min(6, extra)) * s, x = sx + Math.cos(a) * rr, y = sy - h * 0.5 + Math.sin(a) * rr * 0.45;
      glow(x, y, 5 * s, lv >= 10 ? `${80 + (i * 40) % 175},${150 + (i * 70) % 105},255` : '255,240,170', 0.95); }
    if (rnd() < 0.4) P(e.rx + (rnd() - 0.5) * 1.6, e.ry - rnd() * 1.5, 0, -1, lv >= 10 ? `hsl(${rnd() * 360},90%,70%)` : '#fff4c0', 1.4, 1);
    if (extra > 0) for (let i = 0; i < Math.min(5, extra); i++) { const p = ((t * 0.5 + i / Math.min(5, extra)) % 1); ring(6 + p * 20, (6 + p * 20) * 0.42, rainbow(i * 70), 1.2, (1 - p) * 0.9); }
  }
}

// ---------- effets attachés aux héros (sorts et états) ----------
function heroOverlays(e, sx, sy, h) {
  const s = S;
  if (e.buff) {
    for (let i = 0; i < 2; i++) if (Math.random() < 0.5) particles.push({ x: e.rx + (Math.random() - 0.5) * 0.8, y: e.ry - Math.random() * 0.3, vx: 0, vy: -2.2, life: 0.45, max: 0.45, c: Math.random() < 0.5 ? '#ff7a2a' : '#ffd23a', s: 1.6 });
    ctx.strokeStyle = `rgba(255,140,40,${0.35 + 0.15 * Math.sin(time * 8)})`; ctx.lineWidth = s; ctx.beginPath(); ctx.ellipse(sx, sy, 8 * s, 3 * s, 0, 0, 7); ctx.stroke();
  }
  if (e.shield) {
    for (let i = 0; i < 6; i++) {
      const a = time * 2.2 + i * Math.PI / 3, cx = sx + Math.cos(a) * 10 * s, cy = sy - h / 2 + Math.sin(a) * 4 * s;
      ctx.fillStyle = Math.sin(a) > 0 ? '#e8f8ff' : '#7ad0ff';
      ctx.beginPath(); ctx.moveTo(cx, cy - 3 * s); ctx.lineTo(cx + 1.5 * s, cy); ctx.lineTo(cx, cy + 3 * s); ctx.lineTo(cx - 1.5 * s, cy); ctx.fill();
    }
  }
  if (e.regen) {
    for (let i = 0; i < 4; i++) {
      const a = -time * 2.5 + i * Math.PI / 2, cx = sx + Math.cos(a) * 9 * s, cy = sy - 4 * s - ((time * 6 + i * 5) % 18) * s;
      ctx.fillStyle = i % 2 ? '#5ac84a' : '#9aec7a'; ctx.fillRect(cx - s, cy - s / 2, 2 * s, s); ctx.fillRect(cx - s / 2, cy - s, s, 2 * s);
    }
  }
}

/* ============================================================
   Monstres dessinés dans le style des héros : gabarits générés
   (quadrupèdes, bipèdes, insectes, gelées, volants, serpents, dragons)
   ============================================================ */
const MW = 44, MH = 40, MFX = 22, MFY = 38; // pieds au point (22, 38)
const hx2rgb = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const rgb2hx = (r, g, b) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const A = hx2rgb(a), B = hx2rgb(b); return rgb2hx(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); };
function mrand(seed) { let a = seed * 2654435761 >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// couleurs de base des gabarits : [corps, ventre/secondaire, accent, yeux]
const KIND_COL = {
  wolf: ['#7a7a82', '#b9b9bd', '#4a4a50', '#f2d04a'], fox: ['#d8702a', '#f4ead8', '#3a2a20', '#2a1a10'], hyena: ['#b8925a', '#e0c890', '#5a3a20', '#e0a020'],
  boar: ['#7a5434', '#d48a7a', '#3b2616', '#1a1010'], bison: ['#5a3a22', '#8a6a4a', '#e8dcc0', '#1a1010'], bear: ['#6a4428', '#9a6a44', '#2a1a10', '#1a1010'],
  cat: ['#d8a040', '#f4ead8', '#2a2018', '#4ad04a'], ram: ['#e8e0d0', '#c8b8a0', '#a08060', '#1a1010'], rhino: ['#8a8a8e', '#b0b0b4', '#e8e0d0', '#1a1010'],
  mammoth: ['#6a4a30', '#8a6a48', '#f4ecd8', '#1a1010'], lizard: ['#4a8a3a', '#d8c870', '#2a5a2a', '#ffd040'], croc: ['#4a6a3a', '#c8c090', '#2a3a20', '#ffd040'],
  deer: ['#a8784a', '#f0e6d0', '#d8c8a0', '#1a1010'], tortoise: ['#5a7a3a', '#8a6a3a', '#c8b070', '#1a1010'], hound: ['#3a2a2a', '#6a3a30', '#c04a20', '#ff6a20'],
  toad: ['#6a8a3a', '#d8d090', '#3a5a2a', '#ffd040'],
  skeleton: ['#e8e2cc', '#bdb59c', '#7d7563', '#ff4a3a'], mummy: ['#d8c8a0', '#a89870', '#6a5a40', '#40e0ff'], goblin: ['#6aa04a', '#8a5a32', '#4a6a2a', '#ff3a3a'],
  orc: ['#6a8a5a', '#5a4a3a', '#8a8a8e', '#ff3a3a'], brute: ['#8a6a5a', '#4a3a3a', '#a0a0a8', '#ffd040'], golem: ['#7a7468', '#5e584e', '#9ad0e0', '#ffb030'],
  imp: ['#b03a2a', '#601a14', '#2a1a10', '#ffe040'], demon: ['#7a1e2a', '#3a0a12', '#e8d8b0', '#ffd040'], cultist: ['#4a2a5a', '#2a1a35', '#d0a040', '#ff40a0'],
  shaman: ['#8a5a32', '#c8a060', '#d04040', '#ffe040'], knight: ['#6a6e7a', '#3a3e4a', '#a03030', '#ff4a3a'], zombie: ['#7a9a6a', '#5a4a3a', '#4a5a3a', '#ffe040'],
  frogman: ['#5a9a4a', '#d8d090', '#3a6a2a', '#ffd040'], lizardman: ['#4a7a5a', '#c8c090', '#2a4a3a', '#ffd040'], yeti: ['#eef0f4', '#b8c0cc', '#5a6a8a', '#3a6aff'],
  treant: ['#6a4a2a', '#4a3018', '#5ac84a', '#ffe060'], werewolf: ['#5a4030', '#7a5a40', '#2a1a10', '#ffd030'], specter: ['#cfe4ff', '#8aaad8', '#6a8ab8', '#3a6aff'],
  lich: ['#3a1748', '#e8e2cc', '#f0c23a', '#40ff90'], bandit: ['#a87a4a', '#5a3a2a', '#c04040', '#1a1010'],
  spider: ['#2a2230', '#4a3a5a', '#1a1420', '#ff3030'], scorpion: ['#a84a2a', '#d8783a', '#5a2010', '#1a1010'], beetle: ['#2a6a8a', '#4ac0d8', '#1a2a3a', '#ffffff'],
  ant: ['#8a2a1a', '#c84a2a', '#3a1008', '#1a1010'], mantis: ['#5ab04a', '#a8e080', '#2a6a2a', '#ff4040'],
  slime: ['#5ac84a', '#a8f090', '#2a8a2a', '#1a1a1a'], wisp: ['#7ad0ff', '#ffffff', '#3a8ad0', '#ffffff'], eye: ['#f0e8e0', '#c84040', '#5a2a6a', '#2a1020'],
  elemental: ['#8a7a5a', '#c8b080', '#ffb030', '#ffe060'], shroom: ['#c83a3a', '#f4ecd8', '#e8d8c0', '#1a1010'],
  bat: ['#4a3a4a', '#7a5a6a', '#2a1a2a', '#ff4040'], vulture: ['#5a4a3a', '#e8dcc8', '#d8a040', '#1a1010'], owl: ['#8a6a4a', '#e8dcc8', '#f0b030', '#ffe040'],
  wasp: ['#f0c030', '#2a2018', '#e8f0ff', '#1a1010'], moth: ['#8a5ac0', '#e8d0ff', '#3a2a5a', '#ffe060'], wyvern: ['#4a7a4a', '#c8c090', '#2a4a2a', '#ffd040'],
  snake: ['#4a8a3a', '#d8d070', '#2a5a2a', '#ffd040'], worm: ['#b87a6a', '#e0a898', '#7a4a3a', '#1a1010'], dragon: ['#a8401a', '#e0a040', '#6a1e10', '#ffe040'],
  hydra: ['#3a7a5a', '#a8d0a0', '#1a4a3a', '#ffd040'],
};
const BIOME_MIX = [null, ['#d8b070', 0.3], ['#2a6a3a', 0.3], ['#5a6a3a', 0.3], ['#d8e8f8', 0.45], ['#c03a1a', 0.4], ['#5a2a8a', 0.45]];
const TIER_EYE = ['', '#ffd040', '#ff8a2a', '#ff3a3a', '#c0c8d0', '#40e0ff', '#f0f0ff'];
function monsterPal(spec) {
  const base = KIND_COL[spec.k] || KIND_COL.wolf, R = mrand(spec.s + 99);
  let [c, b, a, e] = base;
  const bm = spec.bi != null ? BIOME_MIX[spec.bi] : null;
  if (bm) { c = mix(c, bm[0], bm[1] * (0.7 + R() * 0.6)); b = mix(b, bm[0], bm[1] * 0.6); }
  if (spec.t) { // chaque palier décale les teintes : la même espèce ne se ressemble jamais d'une région à l'autre
    const sh = (spec.t * 0.07) * (R() < 0.5 ? -1 : 1);
    c = shade(c, sh); a = mix(a, TIER_EYE[spec.t] || a, 0.35); e = TIER_EYE[spec.t] || e;
  }
  if (spec.col) [c, b, a, e] = spec.col;
  return { c, cH: shade(c, 0.25), cD: shade(c, -0.3), b, bD: shade(b, -0.25), a, aH: shade(a, 0.3), e };
}
// gabarits connus du royaume d'origine
const KINGDOM_SPEC = {
  loup: { k: 'wolf', s: 1 }, sanglier: { k: 'boar', s: 2 }, loupnoir: { k: 'wolf', s: 3, col: ['#2e2b36', '#4b4757', '#1a1820', '#ff4a3a'] },
  spectre: { k: 'specter', s: 4 }, ours: { k: 'bear', s: 5 }, squelette: { k: 'skeleton', s: 6 }, lougarou: { k: 'werewolf', s: 7 },
  araignee: { k: 'spider', s: 8, col: ['#4a3a5a', '#7a6a8a', '#2a2230', '#ff3030'] }, roi: { k: 'lich', s: 9, boss: 1, col: ['#3a1748', '#e8e2cc', '#f0c23a', '#ff5a20'] },
  golem: { k: 'golem', s: 10 }, golemroi: { k: 'golem', s: 11, boss: 1, col: ['#4e5a68', '#7a8a9a', '#40e0ff', '#40e0ff'] },
  dragon: { k: 'dragon', s: 12, boss: 1 }, ombre: { k: 'specter', s: 13, col: ['#2a1a3a', '#4a2a6a', '#6a3aa0', '#ff40a0'] },
  gardien: { k: 'demon', s: 14, boss: 1, col: ['#5a0a14', '#3a0a12', '#d0a040', '#ffd040'] },
};
const PLAN = {
  wolf: 'quad', fox: 'quad', hyena: 'quad', boar: 'quad', bison: 'quad', bear: 'quad', cat: 'quad', ram: 'quad', rhino: 'quad', mammoth: 'quad', lizard: 'quad', croc: 'quad',
  deer: 'quad', tortoise: 'quad', hound: 'quad', toad: 'quad',
  skeleton: 'biped', mummy: 'biped', goblin: 'biped', orc: 'biped', brute: 'biped', golem: 'biped', imp: 'biped', demon: 'biped', cultist: 'biped', shaman: 'biped', knight: 'biped',
  zombie: 'biped', frogman: 'biped', lizardman: 'biped', yeti: 'biped', treant: 'biped', werewolf: 'biped', specter: 'biped', lich: 'biped', bandit: 'biped',
  spider: 'bug', scorpion: 'bug', beetle: 'bug', ant: 'bug', mantis: 'bug', slime: 'blob', wisp: 'blob', eye: 'blob', elemental: 'blob', shroom: 'blob',
  bat: 'fly', vulture: 'fly', owl: 'fly', wasp: 'fly', moth: 'fly', wyvern: 'fly', snake: 'snake', worm: 'snake', dragon: 'dragon', hydra: 'dragon',
};
const FLOATS = new Set(['specter', 'wisp', 'eye', 'bat', 'vulture', 'owl', 'wasp', 'moth', 'wyvern', 'lich']);
const monCache = new Map();
// dir : 0 face, 1 dos, 3 profil ; f : image d'animation (0 à 3) ; atk : en train de frapper
function monsterSprite(spec, dir, f, atk, white) {
  const key = `${spec.k}|${spec.s}|${spec.bi}|${spec.t}|${spec.boss || 0}|${dir}|${f}|${atk ? 1 : 0}|${white ? 1 : 0}|${spec.col ? spec.col.join() : ''}`;
  let c = monCache.get(key); if (c) return c;
  if (monCache.size > 1500) monCache.clear();
  c = document.createElement('canvas'); c.width = MW; c.height = MH;
  const g = c.getContext('2d');
  const R = (x, y, w, h, col) => { if (!col || w <= 0 || h <= 0) return; g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const P = (x, y, col) => R(x, y, 1, 1, col);
  const E = (cx, cy, rx, ry, col) => { for (let y = -ry; y <= ry; y++) { const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + 0.01)))); R(cx - w, cy + y, w * 2 + 1, 1, col); } };
  const pal = monsterPal(spec), k = spec.k, rnd = mrand(spec.s), plan = PLAN[k] || 'quad';
  const v1 = rnd(), v2 = rnd(), v3 = rnd(); // variantes
  const boss = !!spec.boss;
  const { c: C, cH, cD, b: B, bD, a: A, e: EY } = pal;
  const GY = MFY; // sol
  const leg4 = [[0, 0, 0, 0], [-2, 1, 2, -1], [-1, 2, 1, -2], [2, -1, -2, 1]][f];
  const lift4 = [[0, 0, 0, 0], [0, 2, 0, 2], [1, 1, 1, 1], [2, 0, 2, 0]][f];

  if (plan === 'quad') {
    // proportions par gabarit
    const P0 = { wolf: [18, 7, 6], fox: [15, 6, 5], hyena: [17, 8, 6], boar: [18, 9, 4], bison: [20, 11, 5], bear: [20, 11, 5], cat: [17, 6, 6], ram: [17, 8, 6], rhino: [21, 11, 5],
      mammoth: [22, 13, 6], lizard: [19, 5, 3], croc: [22, 5, 3], deer: [17, 7, 8], tortoise: [18, 8, 3], hound: [18, 7, 6], toad: [14, 9, 3] }[k] || [18, 7, 6];
    const [L, H, LG] = P0, x0 = MFX - (L >> 1) - 2, by = GY - LG - H;
    const legs = (xs, col) => xs.forEach((x, i) => { const lf = lift4[i], off = leg4[i]; R(x, by + H - 1, 3, 2, col); R(x + off * 0.6, by + H + 1, 3, LG - 1 - lf, col); R(x + off * 0.6, GY - 1 - lf, 3, 1, shade(col, -0.45)); });
    const back = [x0 + 2, x0 + L - 6], front = [x0 + 5, x0 + L - 3];
    // queue
    const tail = { wolf: 'bushy', fox: 'fox', hyena: 'short', boar: 'curl', bison: 'thin', bear: 'stub', cat: 'long', ram: 'stub', rhino: 'thin', mammoth: 'thin', lizard: 'reptile', croc: 'reptile', deer: 'stub', tortoise: 'stub', hound: 'spike', toad: 'none' }[k];
    if (tail === 'bushy') { R(x0 - 4, by + 1, 5, 3, C); R(x0 - 6, by + 2, 3, 3, C); P(x0 - 6, by + 4, cD); }
    if (tail === 'fox') { R(x0 - 5, by, 6, 4, C); R(x0 - 8, by + 1, 4, 4, C); R(x0 - 9, by + 2, 2, 2, '#f4ead8'); }
    if (tail === 'long') { R(x0 - 3, by + 1, 4, 2, C); R(x0 - 5, by - 2, 2, 4, C); R(x0 - 4, by - 4, 2, 2, C); }
    if (tail === 'thin') { R(x0 - 2, by + 1, 3, 1, C); R(x0 - 3, by + 1, 1, 5, C); R(x0 - 4, by + 5, 2, 2, cD); }
    if (tail === 'curl') { P(x0 - 1, by + 1, C); P(x0 - 2, by, C); P(x0 - 3, by + 1, C); }
    if (tail === 'short') R(x0 - 2, by + 1, 3, 2, cD);
    if (tail === 'spike') { R(x0 - 4, by, 5, 2, C); P(x0 - 5, by - 1, A); P(x0 - 3, by - 1, A); }
    if (tail === 'reptile') { for (let i = 0; i < 9; i++) R(x0 - i - 1, by + 2 + (i >> 2), 1, 3 - (i >> 2), i % 2 ? C : cD); }
    // pattes du fond
    legs(back, cD);
    // corps
    if (k === 'tortoise') { E(x0 + L / 2, by + 3, L / 2 - 1, 5, A); E(x0 + L / 2, by + 3, L / 2 - 3, 3, shade(A, -0.2)); for (let x = x0 + 4; x < x0 + L - 3; x += 4) R(x, by + 1, 1, 4, shade(A, -0.4)); R(x0 + 1, by + H - 3, L - 2, 2, C); }
    else if (k === 'toad') { E(x0 + L / 2, by + H / 2, L / 2, H / 2, C); E(x0 + L / 2, by + H / 2 + 2, L / 2 - 3, H / 2 - 2, B); }
    else {
      R(x0, by + 1, L, H - 1, C); R(x0 + 1, by, L - 2, 1, C); R(x0 + 1, by, L - 2, 1, cH); R(x0, by + H - 2, L, 1, cD);
      R(x0 + 3, by + H - 3, L - 6, 1, B);
    }
    if (k === 'bison' || k === 'mammoth') { E(x0 + L - 7, by, 5, 3, cD); R(x0 + 2, by + H - 2, L - 4, 2, cD); }
    if (k === 'hyena') { R(x0 + L - 8, by - 2, 7, 2, cD); for (let x = x0 + 2; x < x0 + L - 3; x += 3) P(x, by + 2, '#5a3a20'); }
    if (k === 'boar' || k === 'hound' || (k === 'lizard' && v1 > 0.4) || k === 'croc') for (let x = x0 + 2; x < x0 + L - 4; x += 2) P(x, by - 1, k === 'hound' ? A : cD);
    if (k === 'hound' || (k === 'lizard' && v2 > 0.5)) for (let x = x0 + 3; x < x0 + L - 4; x += 3) { P(x, by - 2, A); }
    if (k === 'cat' && (v1 > 0.3 || spec.t)) for (let x = x0 + 3; x < x0 + L - 2; x += 3) { R(x, by, 1, 3, A); }
    if (k === 'ram') for (let x = x0 + 1; x < x0 + L - 2; x += 2) for (let y = by + 1; y < by + H - 2; y += 2) P(x + (y % 2), y, cH);
    if (k === 'rhino') { R(x0 + 4, by + 2, L - 8, 1, cD); R(x0 + 8, by, 1, H - 2, cD); }
    if (k === 'deer' || (k === 'cat' && v2 > 0.6)) for (let i = 0; i < 4; i++) P(x0 + 3 + i * 3, by + 2 + (i % 2), B);
    // pattes de devant
    legs(front, C);
    // tête
    const hx = x0 + L - 2, hy = by - 2;
    const head = {
      wolf: () => { R(hx - 1, hy, 7, 6, C); R(hx + 5, hy + 2, 4, 3, C); P(hx + 8, hy + 2, '#1a1010'); R(hx, hy - 2, 2, 2, C); R(hx + 3, hy - 2, 2, 2, C); P(hx + 3, hy + 1, EY); R(hx + 5, hy + 4, 3, 1, B); },
      fox: () => { R(hx - 1, hy + 1, 6, 5, C); R(hx + 4, hy + 3, 4, 2, C); P(hx + 7, hy + 3, '#1a1010'); R(hx - 1, hy - 2, 2, 3, C); R(hx + 2, hy - 2, 2, 3, C); P(hx + 2, hy + 2, EY); R(hx + 2, hy + 5, 5, 1, B); },
      hyena: () => { R(hx - 1, hy, 7, 6, C); R(hx + 5, hy + 2, 4, 4, cD); P(hx + 8, hy + 2, '#1a1010'); E(hx + 1, hy - 1, 1, 1, C); P(hx + 3, hy + 1, EY); },
      boar: () => { R(hx - 2, hy + 2, 8, 7, C); R(hx + 5, hy + 4, 3, 3, B); P(hx + 2, hy + 3, EY); R(hx + 5, hy + 8, 1, 2, '#f2ead2'); P(hx + 4, hy + 9, '#f2ead2'); P(hx - 1, hy + 1, cD); },
      bison: () => { R(hx - 3, hy + 1, 8, 8, cD); R(hx + 4, hy + 4, 3, 4, C); P(hx + 2, hy + 3, EY); R(hx - 1, hy - 1, 1, 2, A); R(hx - 2, hy - 2, 1, 1, A); R(hx + 3, hy - 1, 1, 2, A); R(hx + 4, hy - 2, 1, 1, A); R(hx, hy + 9, 4, 2, cD); },
      bear: () => { R(hx - 2, hy, 8, 7, C); R(hx + 5, hy + 3, 3, 3, B); P(hx + 7, hy + 3, '#1a1010'); R(hx - 1, hy - 1, 2, 2, C); R(hx + 3, hy - 1, 2, 2, C); P(hx + 3, hy + 2, EY); },
      cat: () => { R(hx - 1, hy + 1, 7, 5, C); R(hx + 5, hy + 3, 2, 3, B); P(hx + 6, hy + 3, '#1a1010'); R(hx - 1, hy - 1, 2, 2, C); R(hx + 3, hy - 1, 2, 2, C); P(hx, hy - 1, A); P(hx + 4, hy - 1, A); P(hx + 3, hy + 2, EY); if (spec.t >= 4 || v3 > 0.7) { P(hx + 5, hy + 6, '#ffffff'); P(hx + 5, hy + 7, '#ffffff'); } },
      ram: () => { R(hx - 1, hy + 1, 6, 6, C); R(hx + 4, hy + 3, 3, 3, B); P(hx + 2, hy + 3, EY); R(hx - 3, hy - 1, 4, 2, A); R(hx - 4, hy + 1, 2, 3, A); P(hx - 3, hy + 4, A); R(hx + 2, hy - 1, 3, 2, A); },
      rhino: () => { R(hx - 2, hy + 1, 8, 7, C); R(hx + 5, hy + 3, 3, 4, C); R(hx + 6, hy - 1, 2, 4, A); P(hx + 7, hy - 2, A); R(hx + 4, hy + 1, 1, 2, A); P(hx + 2, hy + 3, EY); P(hx, hy, C); },
      mammoth: () => { R(hx - 3, hy - 1, 9, 9, C); R(hx + 4, hy + 5, 3, 3, C); R(hx + 5, hy + 8, 2, 4, C); P(hx + 4, hy + 12, cD); R(hx + 2, hy + 8, 2, 1, A); R(hx + 3, hy + 9, 3, 1, A); P(hx + 6, hy + 8, A); P(hx + 2, hy + 3, EY); R(hx - 4, hy + 1, 3, 5, cD); },
      lizard: () => { R(hx - 1, hy + 4, 9, 4, C); R(hx + 6, hy + 6, 3, 2, B); P(hx + 3, hy + 5, EY); if (v1 > 0.6 || spec.t >= 3) { P(hx, hy + 3, A); P(hx + 2, hy + 3, A); } },
      croc: () => { R(hx - 1, hy + 4, 7, 4, C); R(hx + 6, hy + 5, 6, 3, C); R(hx + 6, hy + 7, 6, 1, B); for (let x = hx + 6; x < hx + 12; x += 2) P(x, hy + 7, '#ffffff'); P(hx + 2, hy + 4, EY); },
      deer: () => { R(hx, hy - 3, 3, 6, C); R(hx + 1, hy - 4, 6, 4, C); R(hx + 6, hy - 3, 2, 3, B); P(hx + 4, hy - 3, EY); const ant = true;
        if (ant) { R(hx + 2, hy - 8, 1, 4, A); P(hx + 1, hy - 7, A); P(hx, hy - 8, A); P(hx + 3, hy - 9, A); R(hx + 4, hy - 7, 1, 3, A); P(hx + 5, hy - 8, A); } },
      tortoise: () => { R(hx - 2, hy + 4, 6, 4, C); P(hx + 2, hy + 5, EY); R(hx + 2, hy + 7, 2, 1, cD); },
      hound: () => { R(hx - 1, hy, 7, 6, C); R(hx + 5, hy + 2, 4, 3, C); R(hx + 5, hy + 5, 4, 1, '#ffffff'); P(hx + 3, hy + 1, EY); P(hx + 4, hy + 1, EY); R(hx - 1, hy - 3, 1, 3, A); R(hx + 2, hy - 3, 1, 3, A); P(hx - 2, hy - 4, A); P(hx + 1, hy - 4, A); },
      toad: () => { R(hx - 4, hy + 3, 8, 5, C); R(hx - 2, hy + 1, 2, 2, C); R(hx + 1, hy + 1, 2, 2, C); P(hx - 1, hy + 1, EY); P(hx + 2, hy + 1, EY); R(hx - 3, hy + 6, 7, 1, cD); if (atk) R(hx + 3, hy + 6, 6, 1, '#e05a6a'); },
    }[k] || (() => R(hx, hy, 6, 6, C));
    g.save(); if (atk && k !== 'toad') g.translate(2, 1); head(); g.restore();
    if (boss && k !== 'deer') { R(hx, hy - 4, 5, 2, '#f0c23a'); P(hx, hy - 5, '#f0c23a'); P(hx + 2, hy - 5, '#f0c23a'); P(hx + 4, hy - 5, '#f0c23a'); P(hx + 2, hy - 4, '#ff3a3a'); }
  } else if (plan === 'biped') {
    // bipèdes : face, dos et profil
    const big = { brute: 2, golem: 2, yeti: 2, demon: 2, treant: 2, orc: 1, knight: 1, werewolf: 1, lizardman: 1, goblin: -1, imp: -1 }[k] || 0;
    const floaty = k === 'specter' || k === 'lich' && false;
    const tw = 8 + big * 2, th = 7 + Math.max(0, big), legH = big < 0 ? 4 : 5, cx = MFX;
    const front = dir === 0, back = dir === 1, side = dir === 3;
    const yLeg = GY - legH, yTor = yLeg - th, headS = big < 0 ? 9 : 8 + (big > 1 ? 1 : 0), yHead = yTor - headS + 1;
    const sw = [0, 1, 0, -1][f];
    const body = { skeleton: '#d8d2bc', mummy: '#d8c8a0', knight: pal.c, golem: pal.c, treant: pal.c, specter: pal.c, cultist: pal.c, lich: pal.c, shaman: pal.c, bandit: pal.c }[k] || pal.c;
    const skin = { goblin: C, orc: C, brute: C, imp: C, demon: C, zombie: C, frogman: C, lizardman: C, yeti: C, werewolf: C, skeleton: '#e8e2cc', mummy: '#e0d0a8', golem: C, treant: C, knight: '#3a3e4a', specter: C, cultist: '#e8c8a0', shaman: '#c8905a', lich: '#e8e2cc', bandit: '#e8b890' }[k] || C;
    const robe = k === 'cultist' || k === 'lich' || k === 'specter' || k === 'shaman' && v1 > 0.5;
    // ailes et queue (derrière)
    if (k === 'demon' || (k === 'imp' && v1 > 0.3)) { const fl = f % 2 ? -1 : 0, ww = k === 'demon' ? 8 : 5; for (let i = 0; i < ww; i++) { R(cx - tw / 2 - i - 1, yTor - 3 + i + fl + (i > 3 ? i - 3 : 0), 1, ww + 2 - i, i % 2 ? pal.b : shade(pal.b, 0.2)); R(cx + tw / 2 + i, yTor - 3 + i + fl + (i > 3 ? i - 3 : 0), 1, ww + 2 - i, i % 2 ? pal.b : shade(pal.b, 0.2)); } }
    if ((k === 'imp' || k === 'demon' || k === 'lizardman') && !front) { R(cx - (side ? tw / 2 + 4 : 1), yLeg + 1, side ? 5 : 2, 2, k === 'lizardman' ? C : pal.b); P(cx - (side ? tw / 2 + 5 : 1), yLeg, A); }
    // jambes
    if (!floaty && !robe) {
      const lc = { skeleton: '#d8d2bc', knight: pal.b, golem: cD, treant: cD, bandit: '#5a3a2a', cultist: pal.b }[k] || shade(C, -0.15);
      if (front || back) { R(cx - 4 - (big > 1 ? 1 : 0), yLeg, 3 + (big > 1), legH - (f === 1 ? 1 : 0), lc); R(cx + 1 + (big > 1 ? 0 : 0), yLeg, 3 + (big > 1), legH - (f === 3 ? 1 : 0), lc); R(cx - 4 - (big > 1), GY - 1 - (f === 1 ? 1 : 0), 3 + (big > 1), 1, shade(lc, -0.4)); R(cx + 1, GY - 1 - (f === 3 ? 1 : 0), 3 + (big > 1), 1, shade(lc, -0.4)); }
      else { R(cx - 2 + sw * 2, yLeg, 3, legH, shade(lc, -0.2)); R(cx - 2 - sw * 2, yLeg, 3, legH, lc); R(cx - 2 - sw * 2, GY - 1, 4, 1, shade(lc, -0.4)); }
      if (k === 'skeleton') { P(cx - 3, yLeg + 2, '#8a8270'); P(cx + 2, yLeg + 2, '#8a8270'); }
    }
    // torse
    const tx0 = cx - (side ? tw / 2 - 1 : tw / 2), tww = side ? tw - 2 : tw;
    if (robe) {
      const rb = k === 'specter' ? C : pal.c;
      for (let y = yTor; y < GY - (k === 'specter' ? 2 : 0); y++) { const w = tww + Math.floor((y - yTor) / 3); R(cx - (w >> 1), y, w, 1, rb); }
      R(cx - (tww >> 1) - 2, GY - 2, tww + 4, 1, shade(rb, -0.3));
      if (k === 'specter') for (let x = cx - (tww >> 1) - 1; x < cx + (tww >> 1) + 2; x += 2) R(x, GY - 2 - ((x + f) % 3), 1, 2, shade(rb, 0.2));
      if (front && k !== 'specter') R(cx - 1, yTor + 1, 2, GY - yTor - 2, pal.a);
    } else {
      R(tx0, yTor, tww, th, body); R(tx0, yTor, tww, 1, shade(body, 0.25)); R(tx0, yTor + th - 1, tww, 1, shade(body, -0.25));
      if (k === 'skeleton') { R(tx0, yTor, tww, th, '#00000000'); g.clearRect(tx0, yTor, tww, th); R(cx - 1, yTor, 2, th, '#d8d2bc'); for (let y = yTor + 1; y < yTor + th - 1; y += 2) R(tx0 + 1, y, tww - 2, 1, '#e8e2cc'); }
      if (k === 'mummy') for (let y = yTor; y < yTor + th; y += 2) R(tx0, y, tww, 1, '#a89870');
      if (k === 'golem' || k === 'elemental') { P(cx - 1, yTor + 2, pal.e); P(cx, yTor + 2, pal.e); P(cx - 1, yTor + 3, pal.a); R(tx0 + 1, yTor + th - 3, 2, 2, cD); }
      if (k === 'knight') { R(cx - 2, yTor + 1, 4, th - 2, pal.a); R(tx0, yTor + th - 2, tww, 1, '#5a3a20'); }
      if (k === 'treant') { for (let y = yTor; y < yTor + th; y += 2) P(tx0 + 1 + (y % 3), y, cD); R(cx - 1, yTor + 2, 2, 2, pal.a); }
      if (k === 'yeti' || k === 'werewolf') { for (let x = tx0; x < tx0 + tww; x += 2) P(x, yTor + th - 1, shade(C, 0.2)); R(cx - 2, yTor + 1, 4, th - 2, B); }
      if (k === 'orc' || k === 'brute' || k === 'bandit') { R(tx0, yTor + th - 2, tww, 1, '#5a3a20'); for (let i = 0; i < 4; i++) P(tx0 + 1 + i, yTor + i, '#5a3a20'); }
      if (k === 'zombie') { R(tx0, yTor + 2, tww, 3, pal.b); P(tx0 + 2, yTor + 5, pal.b); }
      if (k === 'goblin' || k === 'imp') R(tx0, yTor + th - 2, tww, 1, pal.b);
    }
    // bras
    const ac = { skeleton: '#d8d2bc', knight: pal.c, golem: cD, mummy: '#d8c8a0' }[k] || (robe ? pal.c : C);
    const thick = big > 0 ? 3 : 2, aY = yTor + (atk ? -3 : 0);
    if (front || back) { R(tx0 - thick, aY, thick, th + 1, ac); R(tx0 + tww, aY, thick, th + 1, ac); R(tx0 - thick, aY + th + 1, thick, 1, skin); R(tx0 + tww, aY + th + 1, thick, 1, skin); }
    else { R(cx - 1 + (atk ? 3 : sw), aY + 1, thick, th, shade(ac, -0.1)); R(cx - 1 + (atk ? 5 : sw), aY + th + 1, thick, 1, skin); }
    if (k === 'werewolf' || k === 'yeti' || k === 'treant') { const ux = side ? cx + 1 + (atk ? 5 : sw) : tx0 + tww; P(ux, aY + th + 2, '#ffffff'); P(ux + 1, aY + th + 2, '#ffffff'); }
    // tête
    const hx0 = cx - (headS >> 1);
    if (!back) {
      if (k === 'skeleton' || k === 'lich') { R(hx0, yHead, headS, headS - 1, '#e8e2cc'); R(hx0 + 1, yHead + headS - 2, headS - 2, 2, '#d8d2bc'); if (front) { R(hx0 + 1, yHead + 3, 2, 2, '#1a0f0f'); R(hx0 + headS - 3, yHead + 3, 2, 2, '#1a0f0f'); P(hx0 + 1, yHead + 3, pal.e); P(hx0 + headS - 2, yHead + 3, pal.e); for (let x = hx0 + 2; x < hx0 + headS - 2; x += 2) P(x, yHead + headS - 1, '#1a0f0f'); } else { R(hx0 + headS - 3, yHead + 3, 2, 2, '#1a0f0f'); P(hx0 + headS - 2, yHead + 3, pal.e); } }
      else if (k === 'mummy') { R(hx0, yHead, headS, headS, '#e0d0a8'); for (let y = yHead + 1; y < yHead + headS; y += 2) R(hx0, y, headS, 1, '#b8a880'); R(front ? hx0 + 2 : hx0 + headS - 3, yHead + 3, front ? headS - 4 : 2, 1, '#2a1a10'); P(front ? hx0 + 2 : hx0 + headS - 2, yHead + 3, pal.e); if (front) P(hx0 + headS - 3, yHead + 3, pal.e); }
      else if (k === 'cultist' || k === 'shaman' && v1 > 0.5) { R(hx0 - 1, yHead - 1, headS + 2, headS + 1, pal.b); R(hx0 + headS / 2 - 1, yHead - 2, 2, 1, pal.b); R(front ? hx0 + 1 : hx0 + headS - 4, yHead + 2, front ? headS - 2 : 4, 4, '#140a18'); P(front ? hx0 + 2 : hx0 + headS - 2, yHead + 4, pal.e); if (front) P(hx0 + headS - 3, yHead + 4, pal.e); }
      else if (k === 'specter') { R(hx0 - 1, yHead - 1, headS + 2, headS + 1, shade(C, 0.15)); R(front ? hx0 + 1 : hx0 + headS - 4, yHead + 2, front ? headS - 2 : 4, 4, shade(C, -0.55)); P(front ? hx0 + 2 : hx0 + headS - 2, yHead + 4, pal.e); if (front) P(hx0 + headS - 3, yHead + 4, pal.e); }
      else if (k === 'knight') { R(hx0, yHead, headS, headS, pal.c); R(hx0, yHead, headS, 1, shade(pal.c, 0.3)); R(front ? hx0 + 1 : hx0 + headS - 4, yHead + 3, front ? headS - 2 : 4, 1, '#0a0608'); P(front ? hx0 + 3 : hx0 + headS - 2, yHead + 3, pal.e); if (front) P(hx0 + headS - 4, yHead + 3, pal.e); R(cx - 1, yHead - 3, 2, 3, pal.a); }
      else if (k === 'golem') { R(hx0, yHead + 1, headS, headS - 1, C); R(hx0 + 1, yHead, headS - 2, 1, cH); R(front ? hx0 + 2 : hx0 + headS - 3, yHead + 3, front ? headS - 4 : 2, 1, pal.e); P(hx0 + 1, yHead + headS - 2, cD); }
      else if (k === 'treant') { R(hx0, yHead, headS, headS, C); for (let i = 0; i < 4; i++) P(hx0 + i * 2 + 1, yHead + 1 + (i % 2), cD); R(front ? hx0 + 2 : hx0 + headS - 3, yHead + 4, front ? headS - 4 : 2, 1, pal.e); R(hx0 - 2, yHead - 2, 2, 3, cD); R(hx0 + headS, yHead - 3, 2, 4, cD); P(hx0 - 2, yHead - 3, pal.a); P(hx0 + headS + 1, yHead - 4, pal.a); P(hx0 + 3, yHead - 1, pal.a); }
      else if (k === 'frogman' || k === 'lizardman') { R(hx0, yHead + 2, headS + (side ? 2 : 0), headS - 2, C); R(hx0 + 1, yHead, 2, 2, C); R(hx0 + headS - 3, yHead, 2, 2, C); P(hx0 + 1, yHead + 1, pal.e); P(hx0 + headS - 2, yHead + 1, pal.e); R(hx0 + 1, yHead + headS - 2, headS - 2 + (side ? 2 : 0), 1, B); }
      else if (k === 'werewolf') { R(hx0, yHead + 1, headS, headS - 1, C); if (side) R(hx0 + headS, yHead + 3, 3, 3, C); else R(hx0 + 2, yHead + 4, headS - 4, 3, B); R(hx0, yHead - 1, 2, 2, C); R(hx0 + headS - 2, yHead - 1, 2, 2, C); P(front ? hx0 + 2 : hx0 + headS - 2, yHead + 3, pal.e); if (front) P(hx0 + headS - 3, yHead + 3, pal.e); }
      else { // tête de chair : gobelin, orc, brute, diablotin, démon, zombie, yéti, bandit, chaman
        R(hx0, yHead, headS, headS, skin); R(hx0, yHead, headS, 1, shade(skin, 0.2));
        const ex = front ? [hx0 + 2, hx0 + headS - 3] : [hx0 + headS - 3];
        for (const x of ex) { P(x, yHead + 3, '#ffffff'); P(x, yHead + 4, pal.e); }
        if (k === 'goblin' || k === 'imp') { R(hx0 - 2, yHead + 2, 2, 2, skin); R(hx0 + headS, yHead + 2, 2, 2, skin); P(hx0 - 3, yHead + 1, skin); P(hx0 + headS + 2, yHead + 1, skin); }
        if (k === 'orc' || k === 'brute') { P(hx0 + 2, yHead + headS - 1, '#f4ecd8'); P(hx0 + headS - 3, yHead + headS - 1, '#f4ecd8'); R(hx0 + 1, yHead + headS - 2, headS - 2, 1, shade(skin, -0.25)); }
        if (k === 'imp' || k === 'demon') { R(hx0, yHead - 2, 1, 3, pal.a); R(hx0 + headS - 1, yHead - 2, 1, 3, pal.a); P(hx0 - 1, yHead - 3, pal.a); P(hx0 + headS, yHead - 3, pal.a); }
        if (k === 'yeti') { R(hx0 - 1, yHead - 1, headS + 2, 3, shade(C, 0.15)); R(hx0 + 1, yHead + 2, headS - 2, headS - 3, B); for (const x of ex) P(x, yHead + 4, pal.e); }
        if (k === 'zombie') { P(hx0 + 1, yHead + 1, pal.b); P(hx0 + headS - 2, yHead + 2, pal.b); }
        if (k === 'bandit') { R(hx0, yHead, headS, 3, pal.b); R(hx0 + 1, yHead + headS - 3, headS - 2, 2, pal.b); }
        if (k === 'shaman') { R(hx0 + 1, yHead + 1, headS - 2, headS - 2, '#e8dcc0'); for (const x of ex) { P(x, yHead + 3, '#1a1010'); P(x, yHead + 4, pal.e); } R(hx0 - 1, yHead - 3, 1, 4, '#d04040'); R(hx0 + headS, yHead - 3, 1, 4, '#40a0d0'); R(cx, yHead - 4, 1, 4, '#f0c030'); }
        if (k === 'goblin' && v1 > 0.5) R(hx0, yHead - 1, headS, 2, pal.b);
      }
    } else {
      R(hx0, yHead, headS, headS, k === 'skeleton' || k === 'lich' ? '#e8e2cc' : k === 'cultist' || k === 'specter' ? pal.b : k === 'knight' ? pal.c : skin);
      if (k === 'imp' || k === 'demon') { R(hx0, yHead - 2, 1, 3, pal.a); R(hx0 + headS - 1, yHead - 2, 1, 3, pal.a); }
    }
    if (k === 'lich' || boss) { R(hx0, yHead - 2, headS, 2, '#f0c23a'); P(hx0, yHead - 3, '#f0c23a'); P(cx, yHead - 3, '#f0c23a'); P(hx0 + headS - 1, yHead - 3, '#f0c23a'); P(cx, yHead - 2, '#40ff90'); }
    // arme
    const wpn = { skeleton: 'sword', knight: 'sword', orc: 'axe', brute: 'club', bandit: 'sword', goblin: v1 > 0.5 ? 'spear' : 'club', cultist: 'staff', shaman: 'staff', lich: 'staff', specter: v2 > 0.5 ? 'scythe' : null, zombie: null, lizardman: 'spear', frogman: 'spear', demon: 'axe', imp: 'spear' }[k];
    if (wpn && !back) {
      const wx = side ? cx + 2 + (atk ? 5 : sw) : tx0 + tww + 1, wy = aY + th + 1;
      const wc = { sword: '#c8ccd4', axe: '#9aa0aa', club: '#6a4a2a', spear: '#8a6a3a', staff: '#5a3a20', scythe: '#4a3a3a' }[wpn];
      if (wpn === 'sword') { R(wx, wy - 9 + (atk ? 2 : 0), 1, 8, wc); P(wx, wy - 10 + (atk ? 2 : 0), '#ffffff'); R(wx - 1, wy - 1, 3, 1, '#8a6a3a'); }
      if (wpn === 'axe') { R(wx, wy - 9, 1, 10, '#6a4a2a'); R(wx + 1, wy - 9, 3, 4, wc); P(wx + 3, wy - 10, wc); }
      if (wpn === 'club') { R(wx, wy - 6, 1, 7, wc); R(wx - 1, wy - 9, 3, 4, wc); P(wx + 1, wy - 8, shade(wc, 0.3)); }
      if (wpn === 'spear') { R(wx, wy - 12, 1, 14, wc); R(wx - 1, wy - 14, 3, 2, '#c8ccd4'); P(wx, wy - 15, '#ffffff'); }
      if (wpn === 'staff') { R(wx, wy - 12, 1, 14, wc); R(wx - 1, wy - 15, 3, 3, pal.e); P(wx, wy - 14, '#ffffff'); }
      if (wpn === 'scythe') { R(wx, wy - 12, 1, 14, wc); R(wx - 5, wy - 13, 6, 1, '#c8ccd4'); P(wx - 6, wy - 12, '#c8ccd4'); }
    }
  } else if (plan === 'bug') {
    const cx = MFX, by = GY - 6;
    const legsN = k === 'spider' ? 4 : 3, lc = shade(C, -0.35);
    for (let i = 0; i < legsN; i++) { const lx = cx - 8 + i * 5 + leg4[i % 4], up = lift4[i % 4]; R(lx, by + 1, 1, 3 - up, lc); R(lx - 1, by + 3 - up, 1, 3, lc); R(lx + 3, by + 1, 1, 3 - (2 - up), lc); R(lx + 4, by + 3 - (2 - up), 1, 3, lc); }
    if (k === 'spider') { E(cx - 4, by - 2, 7, 5, C); E(cx - 4, by - 3, 5, 3, cH); for (let i = 0; i < 3; i++) P(cx - 6 + i * 2, by - 4 + (i % 2), A); E(cx + 5, by, 4, 3, cD); P(cx + 7, by - 1, pal.e); P(cx + 8, by, pal.e); P(cx + 6, by - 1, pal.e); if (atk) { R(cx + 8, by + 2, 1, 2, '#e8e8e8'); } }
    if (k === 'scorpion') { R(cx - 7, by - 3, 13, 5, C); R(cx - 7, by - 3, 13, 1, cH); for (let x = cx - 6; x < cx + 6; x += 3) R(x, by - 3, 1, 5, cD); const sy = atk ? -2 : 0; for (let i = 0; i < 6; i++) R(cx - 9 - (i < 3 ? i : 2), by - 4 - i * 2 + sy, 3, 3, i % 2 ? C : B); R(cx - 9, by - 17 + sy, 2, 3, A); P(cx - 7, by - 16 + sy, '#ffffff'); R(cx + 6, by - 2, 3, 2, C); R(cx + 9, by - 4, 3, 2, B); R(cx + 9, by, 3, 2, B); P(cx + 5, by - 3, pal.e); }
    if (k === 'beetle') { E(cx - 1, by - 3, 8, 5, C); R(cx - 1, by - 8, 1, 10, cD); E(cx - 3, by - 5, 3, 2, cH); R(cx + 7, by - 3, 4, 4, cD); R(cx + 10, by - 6, 1, 4, A); P(cx + 11, by - 7, A); P(cx + 9, by - 2, pal.e); }
    if (k === 'ant') { E(cx - 7, by - 2, 4, 3, C); E(cx, by - 2, 3, 2, C); E(cx + 6, by - 3, 3, 3, C); P(cx + 7, by - 4, pal.e); R(cx + 8, by - 8, 1, 4, cD); P(cx + 9, by - 9, cD); R(cx + 9, by - 1, 2, 1, A); }
    if (k === 'mantis') {
      E(cx - 5, by - 2, 7, 3, C); E(cx - 5, by - 4, 6, 2, B); for (let x = cx - 10; x < cx; x += 3) P(x, by - 1, cD);
      for (let i = 0; i < 6; i++) R(cx + 1 + (i >> 1), by - 2 - i, 3, 2, C);
      R(cx + 3, by - 12, 6, 4, C); R(cx + 3, by - 12, 6, 1, cH); P(cx + 4, by - 11, pal.e); P(cx + 7, by - 11, pal.e); R(cx + 6, by - 8, 2, 1, cD); R(cx + 4, by - 15, 1, 3, cD); R(cx + 7, by - 15, 1, 3, cD);
      const ay = atk ? -3 : 0; R(cx + 5, by - 7 + ay, 2, 4, A); R(cx + 7, by - 9 + ay, 4, 2, A); R(cx + 10, by - 9 + ay, 1, 4, A); P(cx + 9, by - 6 + ay, '#ffffff');
    }
  } else if (plan === 'blob') {
    const cx = MFX, sq = [0, 1, 0, -1][f];
    if (k === 'slime') { const h = 8 - sq, w = 9 + sq; E(cx, GY - h, w, h, C); E(cx - 3, GY - h - 3, 3, 2, cH); R(cx - w + 1, GY - 2, (w - 1) * 2, 1, cD); R(cx - 3, GY - h, 2, 3, '#1a1a1a'); R(cx + 2, GY - h, 2, 3, '#1a1a1a'); P(cx - 3, GY - h, '#ffffff'); P(cx + 2, GY - h, '#ffffff'); if (spec.t >= 2) P(cx + 5, GY - h - 2, A); }
    if (k === 'wisp') { const fl = f; for (let y = 0; y < 20; y++) { const w = Math.max(1, Math.round(7 * Math.sin((y + 3) / 23 * Math.PI)) + ((y + fl) % 3 === 0 ? 1 : 0) - (y > 15 ? (y + fl) % 2 : 0)); R(cx - w + (y > 14 ? ((fl + y) % 3) - 1 : 0), GY - 4 - y, w * 2, 1, y < 5 ? A : y < 12 ? C : B); } R(cx - 3, GY - 12, 2, 3, '#1a1a3a'); R(cx + 2, GY - 12, 2, 3, '#1a1a3a'); P(cx - 3, GY - 12, '#ffffff'); P(cx + 2, GY - 12, '#ffffff'); }
    if (k === 'eye') { E(cx, GY - 12, 8, 8, C); E(cx - 2, GY - 15, 3, 2, '#ffffff'); E(cx + 2, GY - 12, 4, 4, B); E(cx + 3, GY - 12, 2, 2, pal.e); P(cx + 2, GY - 13, '#ffffff'); for (let i = 0; i < 4; i++) { const tx = cx - 5 + i * 3; R(tx + ((i + f) % 2), GY - 5, 1, 3, A); P(tx + ((i + f + 1) % 2), GY - 2, A); } for (let i = 0; i < 3; i++) P(cx - 6 + i * 2, GY - 9 + (i % 2), B); }
    if (k === 'elemental') { E(cx, GY - 12, 6, 6, C); E(cx - 1, GY - 14, 3, 2, cH); R(cx - 2, GY - 13, 4, 2, A); P(cx - 1, GY - 13, pal.e); P(cx + 1, GY - 13, pal.e); const ar = atk ? -3 : sq; E(cx - 10, GY - 11 + ar, 3, 3, B); E(cx + 10, GY - 11 - ar, 3, 3, B); E(cx - 3, GY - 3, 2, 2, cD); E(cx + 3, GY - 3, 2, 2, cD); }
    if (k === 'shroom') { R(cx - 3, GY - 9, 6, 8, B); R(cx - 3, GY - 9, 1, 8, shade(B, -0.15)); E(cx, GY - 12, 10, 5, C); R(cx - 10, GY - 10, 20, 1, cD); for (const [x, y] of [[-6, -14], [-1, -16], [4, -13], [7, -11]]) R(cx + x, GY + y, 2, 2, pal.a); P(cx - 2, GY - 7, '#1a1010'); P(cx + 1, GY - 7, '#1a1010'); R(cx - 3 + ([0, 1, 0, -1][f]), GY - 1, 2, 1, cD); R(cx + 1 - ([0, 1, 0, -1][f]), GY - 1, 2, 1, cD); }
  } else if (plan === 'fly') {
    const cx = MFX, cy = GY - 16, fl = f % 2;
    if (k === 'bat') { const wy = fl ? -4 : 2; for (let i = 0; i < 8; i++) { R(cx - 3 - i, cy - 2 + Math.abs(i - 3) * (fl ? -1 : 1) * 0.5 + (fl ? 0 : 0), 1, 4 - (i >> 2), cD); R(cx + 3 + i, cy - 2 + Math.abs(i - 3) * (fl ? -1 : 1) * 0.5, 1, 4 - (i >> 2), cD); } E(cx, cy, 3, 4, C); R(cx - 2, cy - 6, 1, 2, C); R(cx + 1, cy - 6, 1, 2, C); P(cx - 1, cy - 2, pal.e); P(cx + 1, cy - 2, pal.e); P(cx, cy + 2, '#ffffff'); void wy; }
    if (k === 'vulture' || k === 'owl') { const ww = fl ? -3 : 1; for (let i = 0; i < 7; i++) { R(cx - 4 - i, cy - 1 + (i > 2 ? ww : 0), 1, 4, i % 2 ? C : cD); R(cx + 4 + i, cy - 1 + (i > 2 ? ww : 0), 1, 4, i % 2 ? C : cD); } E(cx, cy, 4, 5, C); E(cx, cy + 1, 2, 3, B); if (k === 'owl') { E(cx, cy - 6, 4, 3, C); P(cx - 2, cy - 6, pal.e); P(cx + 2, cy - 6, pal.e); P(cx, cy - 5, pal.a); P(cx - 4, cy - 9, C); P(cx + 4, cy - 9, C); } else { R(cx - 1, cy - 8, 3, 3, B); R(cx + 2, cy - 7, 2, 1, pal.a); P(cx, cy - 7, '#1a1010'); } R(cx - 2, cy + 5, 1, 2, pal.a); R(cx + 1, cy + 5, 1, 2, pal.a); }
    if (k === 'wasp') { E(cx - 3, cy + 1, 5, 3, C); for (let x = cx - 7; x < cx; x += 2) R(x, cy - 2, 1, 6, B); R(cx - 9, cy + 1, 2, 1, '#2a2018'); E(cx + 4, cy - 1, 3, 3, B); P(cx + 5, cy - 2, '#ff3a3a'); const wa = fl ? -5 : -3; E(cx - 1, cy + wa, 4, 2, 'rgba(232,240,255,.8)'); E(cx + 2, cy + wa + 1, 3, 2, 'rgba(232,240,255,.7)'); }
    if (k === 'moth') { const wa = fl ? 1 : 0; E(cx - 6, cy - 2 + wa, 6 - wa, 6, C); E(cx + 6, cy - 2 + wa, 6 - wa, 6, C); E(cx - 6, cy - 2, 3, 3, B); E(cx + 6, cy - 2, 3, 3, B); P(cx - 6, cy - 2, pal.a); P(cx + 6, cy - 2, pal.a); R(cx - 1, cy - 6, 2, 11, cD); R(cx - 2, cy - 9, 1, 3, cD); R(cx + 1, cy - 9, 1, 3, cD); P(cx - 1, cy - 5, pal.e); }
    if (k === 'wyvern') { const fl2 = fl ? -4 : 0; for (let i = 0; i < 8; i++) R(cx - 6 + i, cy - 8 + fl2 + Math.abs(i - 4), 1, 6 - Math.abs(i - 4) / 2, i % 2 ? cD : B); R(cx - 9, cy, 18, 5, C); R(cx - 9, cy, 18, 1, cH); for (let i = 0; i < 6; i++) R(cx - 10 - i, cy + 2 + (i >> 1), 1, 2, C); R(cx + 7, cy - 4, 4, 5, C); R(cx + 10, cy - 3, 4, 3, C); P(cx + 10, cy - 3, pal.e); P(cx + 8, cy - 6, pal.a); R(cx - 4, cy + 5, 2, 3, cD); R(cx + 3, cy + 5, 2, 3, cD); }
  } else if (plan === 'snake') {
    const cx = MFX;
    if (k === 'snake') { const wv = f; for (let i = 0; i < 16; i++) { const x = cx - 10 + i, y = GY - 3 - Math.round(Math.sin((i + wv) * 0.7) * 1.5); R(x, y, 1, 3, i % 3 ? C : cD); P(x, y + 2, B); } R(cx + 4, GY - 12, 3, 8, C); R(cx + 4, GY - 14, 6, 4, C); P(cx + 7, GY - 13, pal.e); if (atk || f === 2) R(cx + 10, GY - 12, 2, 1, '#e03040'); R(cx + 4, GY - 10, 1, 6, B); if (spec.t >= 3 || spec.s % 3 === 0) { R(cx + 2, GY - 16, 2, 4, A); R(cx + 9, GY - 16, 2, 4, A); } }
    if (k === 'worm') { const up = [0, 1, 2, 1][f]; for (let i = 0; i < 6; i++) { const y = GY - 3 - i * 3 - up; E(cx + Math.round(Math.sin(i * 0.8 + f) * 1.5), y, 4 - (i >> 2), 2, i % 2 ? C : B); } const ty = GY - 22 - up; E(cx, ty, 5, 3, C); R(cx - 3, ty, 6, 2, '#2a0a0a'); for (let x = cx - 3; x < cx + 3; x += 2) P(x, ty, '#ffffff'); R(cx - 6, GY - 1, 12, 1, shade(C, -0.4)); }
  } else if (plan === 'dragon') {
    const by = GY - 13, x0 = MFX - 12;
    const fl = f % 2 ? -3 : 0;
    for (let i = 0; i < 9; i++) R(x0 + 6 + i, by - 9 + fl + Math.abs(i - 4), 1, 8 - Math.abs(i - 4) / 2, i % 2 ? pal.b : shade(pal.b, -0.3));
    for (let i = 0; i < 10; i++) R(x0 - i, by + 3 + (i >> 1), 1, 3 - (i >> 2), i % 2 ? C : cD);
    R(x0 + 2, by + 7, 3, 6 - lift4[0], cD); R(x0 + 15, by + 7, 3, 6 - lift4[2], cD);
    R(x0, by, 20, 8, C); R(x0 + 1, by - 1, 18, 1, cH); R(x0 + 2, by + 6, 16, 2, B);
    for (let x = x0 + 2; x < x0 + 19; x += 3) P(x, by - 2, pal.a);
    R(x0 + 5 + leg4[1], by + 7, 3, 6 - lift4[1], C); R(x0 + 17 + leg4[3], by + 7, 3, 6 - lift4[3], C);
    const heads = k === 'hydra' ? [[0, 0], [-3, -5], [3, -4]] : [[0, 0]];
    for (const [ox, oy] of heads) {
      const nx = x0 + 18 + ox, ny = by - 1 + oy;
      for (let i = 0; i < 6; i++) R(nx + (i >> 1), ny - i, 3, 2, C);
      R(nx + 2, ny - 9, 6, 4, C); R(nx + 7, ny - 8, 4, 3, C); R(nx + 7, ny - 6, 4, 1, B); P(nx + 5, ny - 8, pal.e);
      P(nx + 2, ny - 10, pal.a); P(nx + 1, ny - 11, pal.a); P(nx + 4, ny - 10, pal.a);
      if (atk) { R(nx + 11, ny - 7, 3, 1, '#ffb030'); P(nx + 14, ny - 7, '#ffe080'); }
    }
  }
  // contour
  const id = g.getImageData(0, 0, MW, MH), px = id.data, Aq = i => px[i * 4 + 3] > 0;
  const out = [];
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { const i = y * MW + x; if (Aq(i)) continue; if ((x > 0 && Aq(i - 1)) || (x < MW - 1 && Aq(i + 1)) || (y > 0 && Aq(i - MW)) || (y < MH - 1 && Aq(i + MW))) out.push(i); }
  for (const i of out) { px[i * 4] = OUTLINE[0]; px[i * 4 + 1] = OUTLINE[1]; px[i * 4 + 2] = OUTLINE[2]; px[i * 4 + 3] = 255; }
  if (spec.k === 'specter' || spec.k === 'wisp') for (let i = 3; i < px.length; i += 4) if (px[i]) px[i] = 215;
  if (white) for (let i = 0; i < px.length; i += 4) if (px[i + 3]) { px[i] = px[i + 1] = px[i + 2] = 255; }
  g.putImageData(id, 0, 0);
  // hauteur utile (pour placer le nom)
  let top = MH; for (let y = 0; y < MH && top === MH; y++) for (let x = 0; x < MW; x++) if (px[(y * MW + x) * 4 + 3]) { top = y; break; }
  c.top = top;
  monCache.set(key, c);
  return c;
}
function specOf(type) { const mt = MT[type] || {}; return mt.spec || KINGDOM_SPEC[type] || { k: 'wolf', s: 0 }; }
function drawMonster(e, sx, sy, mt) {
  const spec = specOf(e.type), plan = PLAN[spec.k] || 'quad';
  const sc = mt.size || 1, s = S * sc;
  const st = e;
  if (e.agg && e.mv === false && !st._mAtkPrev && e.lastHp === e.hp) {}
  // animation d'attaque : quand le monstre est au contact et ne bouge pas
  const now = time;
  const attacking = e.agg && !e.mv && me.has && Math.hypot(e.rx - me.lx, e.ry - me.ly) < 1.6 + (sc - 1);
  if (attacking && (!st.mAtkT || now - st.mAtkT > 1.3)) st.mAtkT = now;
  const atk = st.mAtkT && now - st.mAtkT < 0.25;
  const biped = plan === 'biped';
  let dir = 3, flip = !!e.flip;
  if (biped) { dir = e.dir === 0 ? 0 : e.dir === 1 ? 1 : 3; flip = e.dir === 2; }
  const f = e.mv ? Math.floor((now + e.id * 0.31) * (plan === 'fly' ? 10 : 7)) % 4 : (plan === 'fly' || plan === 'blob' ? Math.floor((now + e.id) * 4) % 4 : 0);
  const img = monsterSprite(spec, dir, f, atk, false);
  const float = FLOATS.has(spec.k) ? Math.sin(now * 3 + e.id) * 2 * s - 3 * s : 0;
  shadow(sx, sy, (plan === 'dragon' ? 12 : plan === 'quad' ? 8 : 6) * s / S * S * 0.9);
  ctx.save();
  if (spec.k === 'specter' && e.type === 'spectre') ctx.globalAlpha *= 0.85;
  ctx.translate(sx, sy + float);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(img, -MFX * s, -MFY * s, MW * s, MH * s);
  if (e.flash > 0) { ctx.globalAlpha *= Math.min(1, e.flash * 6); ctx.drawImage(monsterSprite(spec, dir, f, atk, true), -MFX * s, -MFY * s, MW * s, MH * s); }
  ctx.restore();
  // halo de boss et lueurs magiques
  if (spec.k === 'wisp' || spec.k === 'elemental' || (spec.bi === 5 && Math.random() < 0.05)) { if (Math.random() < 0.15) particles.push({ x: e.rx + (Math.random() - 0.5) * 0.6, y: e.ry - 0.8 - Math.random() * 0.6, vx: 0, vy: -0.8, life: 0.5, max: 0.5, c: monsterPal(spec).b, s: 1.2 }); }
  return (MFY - img.top) * s - float;
}

function drawBeast(e, x, y, def, palKey, scale) {
  const f = e.mv ? Math.floor((time + e.id * 0.31) * 7) % 2 : 0;
  const rows = [...def.top, ...def.legs[f]];
  const img = sprite(`${palKey}${f}`, rows, PAL[palKey], e.flash > 0);
  const s = S * scale, w = rows[0].length * s, h = rows.length * s;
  ctx.save(); ctx.translate(x - w / 2, y - h);
  if (e.flip) { ctx.translate(w, 0); ctx.scale(-1, 1); }
  ctx.drawImage(img, 0, 0, w, h); ctx.restore();
  return h;
}
function shadow(x, y, rx) { ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(x, y - S, rx, rx * 0.38, 0, 0, 7); ctx.fill(); }
function label(text, x, y, color, size = 10) {
  ctx.font = `600 ${Math.round(size * dpr)}px 'Pixelify Sans', monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.lineWidth = Math.max(2, 2.5 * dpr); ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.lineJoin = 'round';
  ctx.strokeText(text, x, y); ctx.fillStyle = color; ctx.fillText(text, x, y);
}
function hpBar(x, y, w, frac, col) {
  const h = Math.max(3, Math.round(2.5 * dpr));
  ctx.fillStyle = '#000'; ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = '#3a1210'; ctx.fillRect(x - w / 2, y, w, h);
  ctx.fillStyle = col; ctx.fillRect(x - w / 2, y, w * Math.max(0, frac), h);
}
function lvlColor(ml) { const d = ml - (me.st ? me.st.pl || me.st.lvl : 1); return d >= 5 ? '#ff5a4a' : d >= 2 ? '#ffa04a' : d >= -3 ? '#f3e6c8' : '#9a9a9a'; }

const LANTERNS = [[41.5, 41.5], [55.5, 43.6], [44.5, 49.4], [52.5, 49.4], [46.2, 36.8], [50.8, 36.8]];
function drawProps(list) {
  const f = NPCS.find(n => n.kind === 'forge'), sh = NPCS.find(n => n.kind === 'shop');
  if (f) list.push({ y: f.y + 0.4, draw: () => {
    const [x, y] = scr(f.x - 1.1, f.y + 0.4), s = S;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x - 6 * s, y - s, 12 * s, 2 * s);
    ctx.fillStyle = '#3a3a40'; ctx.fillRect(x - 3 * s, y - 5 * s, 6 * s, 4 * s);
    ctx.fillStyle = '#5a5a64'; ctx.fillRect(x - 6 * s, y - 8 * s, 12 * s, 3 * s); ctx.fillRect(x - 7 * s, y - 8 * s, 2 * s, 2 * s);
    ctx.fillStyle = '#8a8a96'; ctx.fillRect(x - 6 * s, y - 8 * s, 12 * s, s);
    if (Math.random() < 0.08) particles.push({ x: f.x - 1.1, y: f.y - 0.1, vx: (Math.random() - .5) * 2, vy: -2, g: 6, life: .4, max: .4, c: '#ffb84a', s: 1.5 });
  } });
  if (sh) list.push({ y: sh.y + 0.4, draw: () => {
    const [x, y] = scr(sh.x + 1.1, sh.y + 0.4), s = S;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x - 8 * s, y - s, 16 * s, 2 * s);
    ctx.fillStyle = '#5c3b22'; ctx.fillRect(x - 7 * s, y - 6 * s, 2 * s, 5 * s); ctx.fillRect(x + 5 * s, y - 6 * s, 2 * s, 5 * s);
    ctx.fillStyle = '#8a5a2b'; ctx.fillRect(x - 8 * s, y - 8 * s, 16 * s, 3 * s); ctx.fillStyle = '#a8743c'; ctx.fillRect(x - 8 * s, y - 8 * s, 16 * s, s);
    [['#e0424a', -6], ['#4ac46a', -1], ['#4a8ae0', 4]].forEach(([c, ox]) => { ctx.fillStyle = c; ctx.fillRect(x + ox * s, y - 12 * s, 3 * s, 4 * s); ctx.fillStyle = '#d8d0c0'; ctx.fillRect(x + (ox + 1) * s, y - 13 * s, s, s); });
  } });
  const lit = todPhase().night > 0.2;
  for (const [lx, ly] of LANTERNS) list.push({ y: ly, draw: () => {
    const [x, y] = scr(lx, ly), s = S;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x - 3 * s, y - s, 6 * s, 2 * s);
    ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x - s / 2, y - 18 * s, s, 18 * s);
    ctx.fillStyle = '#2a1e12'; ctx.fillRect(x - 2 * s, y - 22 * s, 4 * s, 5 * s);
    ctx.fillStyle = lit ? '#ffd27a' : '#a08850'; ctx.fillRect(x - s, y - 21 * s, 2 * s, 3 * s);
  } });
  for (const w of WAYPOINTS) list.push({ y: w.y, draw: () => {
    const [x, y] = scr(w.x, w.y), s = S, on = me.st && me.st.wps && me.st.wps.includes(w.id);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, y - s, 7 * s, 2.5 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#5a5668'; ctx.fillRect(x - 5 * s, y - 3 * s, 10 * s, 3 * s);
    ctx.fillStyle = '#7a748a'; ctx.fillRect(x - 3 * s, y - 20 * s, 6 * s, 17 * s); ctx.fillStyle = '#948ea6'; ctx.fillRect(x - 3 * s, y - 20 * s, 2 * s, 17 * s);
    ctx.fillStyle = '#5a5668'; ctx.fillRect(x - 2 * s, y - 22 * s, 4 * s, 2 * s);
    ctx.fillStyle = on ? `rgba(122,232,255,${0.7 + 0.3 * Math.sin(time * 3)})` : '#4a4658';
    ctx.fillRect(x - s, y - 17 * s, 2 * s, 2 * s); ctx.fillRect(x - s, y - 13 * s, 2 * s, 4 * s); ctx.fillRect(x - 2 * s, y - 11 * s, 4 * s, s);
    if (on && Math.random() < 0.05) particles.push({ x: w.x + (Math.random() - 0.5) * 0.4, y: w.y - 0.8, vx: 0, vy: -1, life: 0.8, max: 0.8, c: '#7ae8ff', s: 1 });
  } });
}

function remoteList() { return window.RA_remotes ? window.RA_remotes() : []; }

function render(dt) {
  const cw = cv.width, ch = cv.height;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#0b0806'; ctx.fillRect(0, 0, cw, ch);
  if (!map || !me.has) return;
  const vw = cw / S, vh = ch / S;
  const inArena = me.ly >= WORLD_H;
  const y0 = inArena ? WORLD_H * TS : 0, y1 = inArena ? H * TS : WORLD_H * TS;
  let cx = me.lx * TS - vw / 2, cy = (me.ly - 0.4) * TS - vh / 2;
  cx = vw < W * TS ? Math.max(0, Math.min(W * TS - vw, cx)) : (W * TS - vw) / 2;
  cy = vh < y1 - y0 ? Math.max(y0, Math.min(y1 - vh, cy)) : (y0 + y1 - vh) / 2;
  camPx = Math.round(cx * S) / S; camPy = Math.round(cy * S) / S;
  drawMap(); drawGroundFx();

  for (const [id, x, y, k, rr] of drops) {
    const [sx, sy] = scr(x, y), bob = Math.sin(time * 4 + id) * S;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(sx - 3 * S, sy - S, 6 * S, 2 * S);
    if (k === 'gold') {
      ctx.fillStyle = '#8a5a14'; ctx.fillRect(sx - 3 * S, sy - 7 * S + bob, 6 * S, 5 * S);
      ctx.fillStyle = '#e2b04a'; ctx.fillRect(sx - 2 * S, sy - 7 * S + bob, 4 * S, 4 * S); ctx.fillStyle = '#fff2b0'; ctx.fillRect(sx - 2 * S, sy - 7 * S + bob, S, S);
    } else if (k === 'mat') {
      const gc = typeof rr === 'string' && GEM_COL[rr[0]] && /^[rseta][1-5]$/.test(rr) ? GEM_COL[rr[0]] : '#b0a080';
      ctx.save(); ctx.translate(sx, sy - 5 * S + bob); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#000'; ctx.fillRect(-3 * S, -3 * S, 6 * S, 6 * S); ctx.fillStyle = gc; ctx.fillRect(-2.2 * S, -2.2 * S, 4.4 * S, 4.4 * S);
      ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(-2 * S, -2 * S, 1.5 * S, 1.5 * S); ctx.restore();
    } else if (k === 'pot') {
      ctx.fillStyle = '#3a0808'; ctx.fillRect(sx - 3 * S, sy - 7 * S + bob, 6 * S, 6 * S);
      ctx.fillStyle = '#d8323a'; ctx.fillRect(sx - 2 * S, sy - 6 * S + bob, 4 * S, 4 * S); ctx.fillStyle = '#d8d0c0'; ctx.fillRect(sx - S, sy - 9 * S + bob, 2 * S, 2 * S);
    } else {
      const c = rr === 5 ? `hsl(${(time * 140) % 360},90%,65%)` : (RAR_COL[rr] || RAR_COL[0]);
      const g = ctx.createRadialGradient(sx, sy - 5 * S, 0, sx, sy - 5 * S, (rr >= 4 ? 13 : 9) * S); g.addColorStop(0, rr === 5 ? `hsla(${(time * 140) % 360},90%,65%,.7)` : c + 'aa'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(sx - 9 * S, sy - 14 * S, 18 * S, 18 * S);
      ctx.fillStyle = '#2a1e12'; ctx.fillRect(sx - 4 * S, sy - 8 * S + bob, 8 * S, 6 * S);
      ctx.fillStyle = '#6a4a2a'; ctx.fillRect(sx - 3 * S, sy - 7 * S + bob, 6 * S, 4 * S);
      ctx.fillStyle = c; ctx.fillRect(sx - S, sy - 6 * S + bob, 2 * S, 2 * S);
      if (rr >= 3 && Math.random() < 0.15) particles.push({ x: x + (Math.random() - 0.5) * 0.5, y: y - 0.3, vx: 0, vy: -1.2, life: 0.6, max: 0.6, c, s: 1 });
    }
  }
  const tg = me.st && me.st.tgt ? ents.get(me.st.tgt) : null;
  if (tg) { const [sx, sy] = scr(tg.rx, tg.ry), sc = (MT[tg.type] || {}).size || 1;
    ctx.strokeStyle = `rgba(255,90,70,${0.7 + 0.3 * Math.sin(time * 6)})`; ctx.lineWidth = Math.max(2, S * 0.7);
    ctx.beginPath(); ctx.ellipse(sx, sy - S, 7 * S * sc, 2.6 * S * sc, 0, 0, 7); ctx.stroke(); }

  if (auto.path && auto.path.length) {
    ctx.fillStyle = 'rgba(255,215,122,.55)';
    auto.path.slice(0, 14).forEach(([tx, ty], i) => { if (i % 2) return; const [px, py] = scr(tx + 0.5, ty + 0.5); ctx.fillRect(px - S, py - S, 2 * S, 2 * S); });
  }
  const list = [];
  const k = 1 - Math.exp(-dt * 14);
  for (const e of ents.values()) {
    e.rx += (e.tx - e.rx) * k; e.ry += (e.ty - e.ry) * k;
    if (Math.hypot(e.tx - e.rx, e.ty - e.ry) > 4) { e.rx = e.tx; e.ry = e.ty; }
    if (e.flash > 0) e.flash -= dt; if (e.bubbleT > 0) e.bubbleT -= dt;
    const isMe = e.id === myId, ex = isMe ? me.lx : e.rx, ey = isMe ? me.ly : e.ry;
    list.push({ y: ey, draw: () => drawEnt(e, ex, ey, isMe) });
  }
  for (const e of remoteList()) {
    e.rx += (e.tx - e.rx) * k; e.ry += (e.ty - e.ry) * k;
    if (Math.hypot(e.tx - e.rx, e.ty - e.ry) > 4) { e.rx = e.tx; e.ry = e.ty; }
    if (e.bubbleT > 0) e.bubbleT -= dt;
    list.push({ y: e.ry, draw: () => drawEnt(e, e.rx, e.ry, false) });
  }
  if (!inArena) { for (const n of NPCS) list.push({ y: n.y, draw: () => drawNpc(n) }); drawProps(list); }
  list.sort((a, b) => a.y - b.y);
  for (const o of list) o.draw();
  for (const [id, em] of emotes) { em.t -= dt; if (em.t <= 0) emotes.delete(id); }

  drawShapes(dt); drawParticles(dt); drawDarkness(); drawTexts(dt); drawMinimap(); updTargetFrame();
}

const EMO_TXT = { salut: 'Salut !', rire: 'Ha ha !', coeur: '♥', danse: '♪' };
function drawEnt(e, x, y, isMe) {
  const [sx, sy] = scr(x, y);
  if (e.kind === 'p') {
    if (e.dead) ctx.globalAlpha = 0.35;
    shadow(sx, sy, 5 * S);
    const dir = isMe ? me.dir : e.dir;
    const view = Object.assign({}, e, { dir, mv: isMe ? !!(input.dx || input.dy) && !me.dead : e.mv });
    if (e.invis) ctx.globalAlpha *= 0.45;
    { const tin = e.tpInT ? time - e.tpInT : 9; if (tin < 0.6) ctx.globalAlpha *= Math.max(0, (tin - 0.15) / 0.45); }
    const [dye, aura] = String(e.look || 'base|-1').split('|');
    const dd = DEF.dyesDef && DEF.dyesDef[dye] && DEF.dyesDef[dye].c;
    const pal = dd ? Object.assign({}, PAL[e.cls] || PAL.guerrier, { b: dd[0], d: dd[1] }) : (PAL[e.cls] || PAL.guerrier);
    if (+aura >= 2) view.wr = +aura;
    let lift = 0;
    if (e.mount && MOUNT_DEF[e.mount]) {
      const flip = dir === 2 ? true : dir === 3 ? false : !!e.mflip;
      e.mflip = flip;
      shadow(sx, sy, 10 * S);
      drawPrestige(e, sx, sy, 22 * S, 'back');
      lift = drawMount(e.mount, e, sx, sy, flip, view.mv);
      view.dir = flip ? 2 : 3; view.mv = false; view.ride = true;
    }
    const hc = PAL[e.cls] ? e.cls : 'guerrier';
    if (!lift && e.rb && !e.dead) drawPrestige(e, sx, sy, 22 * S, 'back');
    const hx = lift ? sx + (e._mdx || 0) : sx;
    const h = (heroReady(hc) ? drawHero(view, hx, sy - lift, hc, dd ? dye : '', heroGlow(view), e)
      : drawHero2(view, hx, sy - lift, hc, pal, hc + (dd ? dye : ''), { glow: heroGlow(view), vis: e.vis || '', dye: dd ? dd[0] : '' }, e)) + lift;
    heroOverlays(e, hx, sy - lift, h - lift);
    if (e.rb && !e.dead) drawPrestige(e, hx, sy - lift, h - lift, 'front');
    if (e.regen && Math.random() < 0.15) particles.push({ x: x + (Math.random() - 0.5) * 0.7, y: y - Math.random(), vx: 0, vy: -1, life: 0.6, max: 0.6, c: '#7ae05a', s: 1.3, plus: 1 });
    if (e.shield) { ctx.strokeStyle = `rgba(150,210,255,${0.55 + 0.2 * Math.sin(time * 5)})`; ctx.fillStyle = 'rgba(150,210,255,.12)'; ctx.lineWidth = S;
      ctx.beginPath(); ctx.ellipse(sx, sy - lift - (h - lift) / 2, 11 * S, (h - lift) / 2 + 2 * S, 0, 0, 7); ctx.fill(); ctx.stroke(); }
    if (e.buff && Math.random() < 0.2) particles.push({ x: x + (Math.random() - 0.5) * 0.6, y: y - Math.random(), vx: 0, vy: -1.2, life: 0.5, max: 0.5, c: '#ffd23a', s: 1.2 });
    ctx.globalAlpha = 1;
    label((e.tag ? `[${e.tag}] ` : '') + e.name, sx, sy - h - 5 * dpr, isMe ? '#ffd77a' : e.ally ? '#9fd38a' : '#ffffff', 10);
    if (e.title) label(`« ${e.title} »`, sx, sy - h - 17 * dpr, '#e2b04a', 8);
    if (!isMe && e.hp < e.mhp) hpBar(sx, sy - h - 3 * dpr, 12 * S, e.hp / e.mhp, '#4ad06a');
    const em = emotes.get(e.id), by = sy - h - (e.title ? 28 : 18) * dpr;
    if (em && em.k !== 'danse') bubble(EMO_TXT[em.k], sx, by, em.k === 'coeur' ? '#e0303a' : null);
    else if (e.bubble && e.bubbleT > 0) bubble(e.bubble, sx, by);
    if (em && em.k === 'danse' && Math.random() < 0.1) texts.push({ x: x + (Math.random() - 0.5), y: y - 1.6, t: '♪', c: '#ffd77a', big: 1, life: 0.8, max: 0.8 });
    return;
  }
  const mt = MT[e.type] || { size: 1, name: e.type, lvl: 1 };
  const sc = mt.size, spr = MSPR[e.type];
  let h;
  if (mt.boss) {
    const pc = monsterPal(specOf(e.type)), rgbA = hx2rgb(pc.e && pc.e[0] === '#' ? pc.e : '#a03cff'), col = rgbA.join(',');
    const g = ctx.createRadialGradient(sx, sy - 5 * S * sc, 0, sx, sy - 5 * S * sc, 24 * S);
    g.addColorStop(0, `rgba(${col},.35)`); g.addColorStop(1, `rgba(${col},0)`); ctx.fillStyle = g; ctx.fillRect(sx - 24 * S, sy - 36 * S, 48 * S, 48 * S);
    if (Math.random() < 0.3) particles.push({ x: x + (Math.random() - 0.5) * 1.6, y: y - Math.random() * 1.5, vx: 0, vy: -1.2, life: 0.9, max: 0.9, c: `rgb(${col})`, s: 2 });
  }
  if (e.champ) {
    const cls = PAL[e.champ[0]] ? e.champ[0] : 'guerrier';
    shadow(sx, sy, 5 * S);
    h = heroReady(cls) ? drawHero(e, sx, sy, cls, '', '#ff5a4a') : drawHero2(e, sx, sy, cls, PAL[cls], cls, { glow: '#ff5a4a' });
    label(e.champ[1], sx, sy - h - 6 * dpr, '#ff9a8a', 10);
    hpBar(sx, sy - h - 4 * dpr, 16 * S, e.hp / e.mhp, '#e0423a');
    return;
  }
  h = drawMonster(e, sx, sy, mt);
  if (e.stun) for (let i = 0; i < 3; i++) { const a = time * 4 + i * 2.1; label('*', sx + Math.cos(a) * 6 * S, sy - h - 2 * dpr + Math.sin(a) * 2 * S, '#ffe27a', 10); }
  if (e.slow && Math.random() < 0.15) particles.push({ x: x + (Math.random() - 0.5) * 0.6, y: y - Math.random() * 0.8, vx: 0, vy: 0.3, life: 0.5, max: 0.5, c: '#bfe8ff', s: 1.2 });
  const isT = me.st && me.st.tgt === e.id;
  if (e.agg || e.hp < e.mhp || mt.boss || isT) label(`${mt.name} · ${e.lvl || mt.lvl}`, sx, sy - h - 6 * dpr, mt.boss ? '#e0a0ff' : lvlColor(e.lvl || mt.lvl), mt.boss ? 12 : 9);
  if (e.hp < e.mhp) hpBar(sx, sy - h - 4 * dpr, (mt.boss ? 30 : 14) * S, e.hp / e.mhp, '#e0423a');
}
function drawNpc(n) {
  const [sx, sy] = scr(n.x, n.y);
  if (n.kind === 'portal') {
    const s = S, r = 9 * s;
    ctx.save(); ctx.translate(sx, sy - 10 * s);
    ctx.fillStyle = 'rgba(40,10,60,.75)'; ctx.beginPath(); ctx.ellipse(0, 0, r - 2 * s, r * 1.3 - 2 * s, 0, 0, 7); ctx.fill();
    for (let i = 0; i < 4; i++) { ctx.strokeStyle = `rgba(${160 + i * 20},${70 + i * 20},255,${0.8 - i * 0.15})`; ctx.lineWidth = 2 * s; ctx.beginPath(); const a0 = time * (i % 2 ? -2 : 2) + i; ctx.ellipse(0, 0, r - i * 2 * s, r * 1.3 - i * 2.5 * s, 0, a0, a0 + 4.5); ctx.stroke(); }
    ctx.restore();
    if (Math.random() < 0.3) particles.push({ x: n.x + (Math.random() - 0.5), y: n.y - 0.6 - Math.random(), vx: 0, vy: -0.8, life: 0.8, max: 0.8, c: '#c08aff', s: 1.3 });
    label(n.name, sx, sy - 26 * S, '#d8b0ff', 9);
    return;
  }
  if (n.kind === 'dungeon') {
    const s = S; ctx.save(); ctx.translate(sx, sy);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0, 1 * s, 16 * s, 4 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#4a4550'; ctx.fillRect(-15 * s, -30 * s, 30 * s, 31 * s);
    ctx.fillStyle = '#5c5664'; for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) ctx.fillRect((-15 + c * 8 + (r % 2) * 4) * s, (-30 + r * 5) * s, 7 * s, 4 * s);
    ctx.fillStyle = '#0c0812'; ctx.beginPath(); ctx.moveTo(-8 * s, 1 * s); ctx.lineTo(-8 * s, -16 * s); ctx.arc(0, -16 * s, 8 * s, Math.PI, 0); ctx.lineTo(8 * s, 1 * s); ctx.fill();
    const pulse = 0.5 + 0.5 * Math.sin(time * 2.5);
    const g = ctx.createRadialGradient(0, -10 * s, 1, 0, -10 * s, 9 * s); g.addColorStop(0, `rgba(190,80,255,${0.35 + 0.3 * pulse})`); g.addColorStop(1, 'rgba(60,0,90,0)');
    ctx.fillStyle = g; ctx.fillRect(-8 * s, -24 * s, 16 * s, 25 * s);
    ctx.fillStyle = `rgba(220,150,255,${0.5 + 0.5 * pulse})`;
    for (let i = 0; i < 5; i++) { const a = Math.PI + (i + 0.5) / 5 * Math.PI; ctx.fillRect(Math.cos(a) * 12 * s - s, -16 * s + Math.sin(a) * 12 * s - s, 2 * s, 2 * s); }
    ctx.fillStyle = '#2a2530'; ctx.fillRect(-16 * s, -32 * s, 32 * s, 3 * s);
    ctx.restore();
    if (Math.random() < 0.15) particles.push({ x: n.x + (Math.random() - 0.5) * 0.8, y: n.y - 0.3, vx: 0, vy: -0.6, life: 1, max: 1, c: '#b070ff', s: 1.2 });
    label(n.name, sx, sy - 38 * S, '#d8b0ff', 9);
    return;
  }
  shadow(sx, sy, 5 * S);
  n._st = n._st || {};
  const pk = n.zone != null ? ['quest', 'stable', 'forge', 'bank', 'shop'][n.zone % 5] : n.kind;
  const h = drawHero2({ id: n.zone != null ? 6 + n.zone : n.id === 'forge' ? 1 : n.id === 'shop' ? 2 : n.id === 'stable' ? 4 : n.id === 'bank' ? 5 : 3, dir: 0, mv: false, flash: 0 }, sx, sy, n.kind, PAL[pk] || PAL[n.kind], pk, { weapon: n.kind === 'quest' ? 'sword' : null }, n._st);
  label(n.name, sx, sy - h - 5 * dpr, '#9fd38a', 9);
  if (n.kind === 'quest' && me.st) {
    const mine = me.st.q && me.st.qg === n.id, done = mine && me.st.q[1] >= me.st.q[2];
    const z = n.zone != null ? ZONES.find(q => q.k === n.zone) : null, okLv = !z || ((me.st.pl || 1) >= z.lv[0] - 2 && (me.st.pl || 1) <= z.lv[1] + 30);
    if ((me.st.qa && okLv) || done) label(done ? '?' : '!', sx, sy - h - 18 * dpr + Math.sin(time * 3) * 2 * dpr, '#ffd23a', 16);
  }
}
function bubble(text, x, y, col) {
  ctx.font = `${Math.round(10 * dpr)}px 'Pixelify Sans', monospace`;
  const t = text.length > 40 ? text.slice(0, 38) + '…' : text;
  const w = ctx.measureText(t).width + 10 * dpr, h = 15 * dpr;
  ctx.fillStyle = 'rgba(255,248,230,.95)'; ctx.fillRect(x - w / 2, y - h, w, h);
  ctx.fillStyle = col || '#2a1a10'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y - h / 2);
}

function drawShapes(dt) {
  for (let i = shapes.length - 1; i >= 0; i--) {
    const f = shapes[i];
    if (f.delay > 0) { f.delay -= dt; continue; }
    f.life -= dt; if (f.life <= 0) { shapes.splice(i, 1); continue; }
    const p = 1 - f.life / f.max;
    if (GROUND_FX.has(f.k)) continue;
    if (drawShape2(f, p)) continue;
    if (f.k === 'slash') {
      const [sx, sy] = scr(f.x, f.y - 0.45), base = [Math.PI / 2, -Math.PI / 2, Math.PI, 0][f.d];
      ctx.strokeStyle = `rgba(${f.col || '255,250,235'},${1 - p})`; ctx.lineWidth = 3 * S / 2;
      ctx.beginPath(); ctx.arc(sx, sy, 16 * S, base - 1.1 + p * 0.6, base + 0.4 + p * 0.8); ctx.stroke();
    } else if (f.k === 'arrow') {
      const ax = f.x + (f.x2 - f.x) * p, ay = f.y + (f.y2 - f.y) * p, q = Math.max(0, p - 0.35);
      const [x1, y1] = scr(f.x + (f.x2 - f.x) * q, f.y + (f.y2 - f.y) * q), [x2, y2] = scr(ax, ay), a = Math.atan2(y2 - y1, x2 - x1);
      ctx.strokeStyle = f.big ? 'rgba(255,226,138,.55)' : 'rgba(255,255,255,.35)'; ctx.lineWidth = S * (f.big ? 2 : 1.2); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.save(); ctx.translate(x2, y2); ctx.rotate(a);
      ctx.fillStyle = '#8a5a2b'; ctx.fillRect(-9 * S, -0.5 * S, 9 * S, S);
      ctx.fillStyle = '#e8e8f0'; ctx.beginPath(); ctx.moveTo(2.5 * S, 0); ctx.lineTo(-1 * S, -1.6 * S); ctx.lineTo(-1 * S, 1.6 * S); ctx.fill();
      ctx.fillStyle = f.big ? '#ffd23a' : '#d04040'; ctx.fillRect(-10 * S, -1.5 * S, 2.5 * S, S); ctx.fillRect(-10 * S, 0.5 * S, 2.5 * S, S);
      ctx.restore();
    } else if (f.k === 'dash') {
      const ax = f.x + (f.x2 - f.x) * p, ay = f.y + (f.y2 - f.y) * p, q = Math.max(0, p - (f.k === 'dash' ? 0.7 : 0.3));
      const [x1, y1] = scr(f.x + (f.x2 - f.x) * q, f.y + (f.y2 - f.y) * q), [x2, y2] = scr(ax, ay), off = f.k === 'dash' ? 6 * S : 0;
      ctx.strokeStyle = f.k === 'dash' ? `rgba(255,240,200,${0.6 * (1 - p)})` : f.big ? '#ffe28a' : '#e8e0c8'; ctx.lineWidth = S * (f.k === 'dash' ? 4 : f.big ? 1.5 : 1);
      ctx.beginPath(); ctx.moveTo(x1, y1 - off); ctx.lineTo(x2, y2 - off); ctx.stroke();
    } else if (f.k === 'fall') {
      const [sx, sy] = scr(f.x, f.y);
      ctx.strokeStyle = '#ffe28a'; ctx.lineWidth = S; ctx.beginPath(); ctx.moveTo(sx - 4 * S * (1 - p), sy - 40 * S * (1 - p) - 6 * S); ctx.lineTo(sx, sy - 40 * S * (1 - p)); ctx.stroke();
    } else if (f.k === 'bolt') {
      const ax = f.x + (f.x2 - f.x) * p, ay = f.y + (f.y2 - f.y) * p, [x2, y2] = scr(ax, ay);
      const g = ctx.createRadialGradient(x2, y2, 0, x2, y2, 6 * S); g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, f.green ? '#7ae05a' : '#9a8cff'); g.addColorStop(1, f.green ? 'rgba(60,180,40,0)' : 'rgba(90,60,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x2, y2, (f.green ? 4 : 6) * S, 0, 7); ctx.fill();
      particles.push({ x: ax, y: ay, vx: 0, vy: 0, life: 0.25, max: 0.25, c: f.green ? '#4ab83a' : '#7a6aff', s: 2 });
    } else if (f.k === 'bolt2') {
      const [sx, sy] = scr(f.x, f.y);
      ctx.strokeStyle = `rgba(220,240,255,${1 - p})`; ctx.lineWidth = S * 1.2; ctx.beginPath(); ctx.moveTo(sx + 4 * S, sy - 60 * S);
      for (let j = 1; j <= 5; j++) ctx.lineTo(sx + (j % 2 ? -4 : 4) * S, sy - 60 * S + j * 12 * S); ctx.stroke();
      ctx.fillStyle = `rgba(200,230,255,${0.5 * (1 - p)})`; ctx.beginPath(); ctx.ellipse(sx, sy, 8 * S, 3 * S, 0, 0, 7); ctx.fill();
    } else if (f.k === 'ring') {
      const [sx, sy] = scr(f.x, f.y);
      ctx.strokeStyle = f.c; ctx.globalAlpha = 1 - p; ctx.lineWidth = (f.w || 2) * S;
      const R = f.r * TS * S * (0.3 + p * 0.7); ctx.beginPath(); ctx.ellipse(sx, sy, R, R * 0.55, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
    } else if (f.k === 'meteor') {
      const [sx, sy] = scr(f.x, f.y);
      if (p < 0.45) { const q = p / 0.45, mx = sx - (1 - q) * 60 * S, my = sy - (1 - q) * 110 * S;
        const g = ctx.createRadialGradient(mx, my, 0, mx, my, 9 * S); g.addColorStop(0, '#fff6c0'); g.addColorStop(0.4, '#ff8a2a'); g.addColorStop(1, 'rgba(255,60,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mx, my, 9 * S, 0, 7); ctx.fill();
        particles.push({ x: f.x - (1 - q) * 60 / TS, y: f.y - (1 - q) * 110 / TS, vx: 0, vy: 0, life: 0.3, max: 0.3, c: '#ff7a2a', s: 3 });
      } else {
        const q = (p - 0.45) / 0.55, R = f.r * TS * S * (0.4 + q * 0.6);
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, R); g.addColorStop(0, `rgba(255,240,180,${1 - q})`); g.addColorStop(0.5, `rgba(255,120,30,${0.8 * (1 - q)})`); g.addColorStop(1, 'rgba(255,60,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(sx, sy, R, R * 0.6, 0, 0, 7); ctx.fill();
        if (!f.burst) { f.burst = 1; for (let i = 0; i < 26; i++) { const a = Math.random() * 7, v = 2 + Math.random() * 4; particles.push({ x: f.x, y: f.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 1, g: 4, life: 0.6, max: 0.6, c: Math.random() < 0.5 ? '#ffb84a' : '#ff5a1a', s: 2 }); } }
      }
    } else if (f.k === 'claw') {
      const [sx, sy] = scr(f.x, f.y);
      ctx.strokeStyle = `rgba(255,70,60,${1 - p})`; ctx.lineWidth = S;
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(sx - 5 * S + i * 3 * S, sy - 5 * S); ctx.lineTo(sx + 3 * S + i * 3 * S, sy + 4 * S); ctx.stroke(); }
    } else if (f.k === 'pillar') {
      const [sx, sy] = scr(f.x, f.y);
      const g = ctx.createLinearGradient(0, sy - 60 * S, 0, sy); g.addColorStop(0, 'rgba(255,215,122,0)'); g.addColorStop(1, `rgba(255,215,122,${0.6 * (1 - p)})`);
      ctx.fillStyle = g; ctx.fillRect(sx - 8 * S, sy - 60 * S, 16 * S, 60 * S);
      if (Math.random() < 0.6) particles.push({ x: f.x + (Math.random() - 0.5), y: f.y, vx: 0, vy: -3, life: 0.6, max: 0.6, c: '#ffe28a', s: 1.5 });
    }
  }
}
const GROUND_FX = new Set(['scorch', 'rune', 'warn']);
function drawGroundFx() { for (const f of shapes) if (GROUND_FX.has(f.k) && !(f.delay > 0) && f.life > 0) drawShape2(f, 1 - f.life / f.max); }
function drawShape2(f, p) {
  const [sx, sy] = scr(f.x, f.y), s = S;
  switch (f.k) {
    case 'warn': { // zone dangereuse de boss
      const R = f.r * TS * s, a = 0.25 + 0.2 * Math.sin(time * 14);
      ctx.save(); ctx.fillStyle = `rgba(255,40,30,${a})`; ctx.beginPath(); ctx.ellipse(sx, sy, R, R * 0.7, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,60,40,.35)'; ctx.beginPath(); ctx.ellipse(sx, sy, R * p, R * 0.7 * p, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,90,60,.9)'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.ellipse(sx, sy, R, R * 0.7, 0, 0, 7); ctx.stroke();
      ctx.restore(); return true;
    }
    case 'laser': {
      const [x2, y2] = scr(f.x2, f.y2), w = (1 - p) * 9 * s;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(255,210,90,${0.6 * (1 - p)})`; ctx.lineWidth = w * 2; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,230,${1 - p})`; ctx.lineWidth = w * 0.7; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.restore(); return true;
    }
    case 'crescent': { // arc de lame plein
      const base = [Math.PI / 2, -Math.PI / 2, Math.PI, 0][f.d], R = (f.heavy ? 15 : 17) * s, cy = sy - 7 * s;
      const a0 = base - 1.5 + p * 1.1, a1 = base + 0.2 + p * 1.6;
      ctx.save(); ctx.globalAlpha = 1 - p * p;
      const g = ctx.createRadialGradient(sx, cy, R * 0.4, sx, cy, R);
      g.addColorStop(0, `rgba(${f.col},0)`); g.addColorStop(0.75, `rgba(${f.col},.55)`); g.addColorStop(1, `rgba(255,255,255,.95)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, cy, R, a0, a1); ctx.arc(sx + Math.cos(base) * 3 * s, cy + Math.sin(base) * 3 * s, R * 0.62, a1, a0, true); ctx.closePath(); ctx.fill();
      ctx.restore(); return true;
    }
    case 'xslash': {
      const [ox, oy] = [[0, 9], [0, -9], [-9, 0], [9, 0]][f.d], cx = sx + ox * s, cy = sy - 7 * s + oy * s * 0.6;
      ctx.save(); ctx.globalAlpha = 1 - p; ctx.strokeStyle = `rgb(${f.col})`; ctx.lineWidth = 2 * s; ctx.lineCap = 'round';
      const L = 8 * s * Math.min(1, p * 3);
      ctx.beginPath(); ctx.moveTo(cx - L, cy - L); ctx.lineTo(cx + L, cy + L); ctx.stroke();
      if (p > 0.2) { const L2 = 8 * s * Math.min(1, (p - 0.2) * 3); ctx.beginPath(); ctx.moveTo(cx + L2, cy - L2); ctx.lineTo(cx - L2, cy + L2); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 0.8 * s; ctx.beginPath(); ctx.moveTo(cx - L, cy - L); ctx.lineTo(cx + L, cy + L); ctx.stroke();
      ctx.restore(); return true;
    }
    case 'whirl': { // tourbillon de lame
      const e = ents.get(f.id), [wx, wy] = e ? scr(e.rx, e.ry) : [sx, sy], R = f.r * TS * s * 0.75;
      ctx.save(); ctx.globalAlpha = 1 - p;
      for (let j = 0; j < 3; j++) {
        const a = p * Math.PI * 5 + j * 2.1;
        ctx.strokeStyle = j === 0 ? 'rgba(255,255,255,.95)' : 'rgba(220,230,255,.5)'; ctx.lineWidth = (3 - j) * s;
        ctx.beginPath(); ctx.ellipse(wx, wy - 6 * s, R, R * 0.5, 0, a, a + 1.6); ctx.stroke();
      }
      ctx.restore(); return true;
    }
    case 'upArrow': {
      const y = sy - 10 * s - p * 90 * s;
      ctx.fillStyle = '#ffe28a'; ctx.fillRect(sx - 0.5 * s, y, s, 8 * s); ctx.fillStyle = '#ffffff'; ctx.fillRect(sx - 1 * s, y - 2 * s, 2 * s, 2 * s);
      ctx.strokeStyle = `rgba(255,226,138,${1 - p})`; ctx.lineWidth = s; ctx.beginPath(); ctx.moveTo(sx, y + 8 * s); ctx.lineTo(sx, sy - 10 * s); ctx.stroke();
      return true;
    }
    case 'rune': { // cercle magique
      const R = f.r * TS * s, a = p * 3;
      ctx.save(); ctx.globalAlpha = Math.sin(p * Math.PI); ctx.strokeStyle = `rgb(${f.c})`; ctx.lineWidth = s;
      ctx.beginPath(); ctx.ellipse(sx, sy, R, R * 0.5, 0, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(sx, sy, R * 0.7, R * 0.35, 0, 0, 7); ctx.stroke();
      ctx.beginPath(); for (let j = 0; j < 6; j++) { const t = a + j * Math.PI * 2 / 6 * 2; const x = sx + Math.cos(t) * R * 0.95, y = sy + Math.sin(t) * R * 0.48; if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.closePath(); ctx.stroke();
      ctx.fillStyle = `rgba(${f.c},.15)`; ctx.beginPath(); ctx.ellipse(sx, sy, R, R * 0.5, 0, 0, 7); ctx.fill();
      ctx.restore(); return true;
    }
    case 'beam': { // rayons de lumière
      ctx.save(); ctx.globalAlpha = Math.sin(p * Math.PI) * 0.8;
      for (let j = -2; j <= 2; j++) {
        const x = sx + j * 7 * s, w = (j === 0 ? 7 : 3) * s;
        const g = ctx.createLinearGradient(0, sy - 90 * s, 0, sy); g.addColorStop(0, 'rgba(255,240,170,0)'); g.addColorStop(1, 'rgba(255,240,170,.8)');
        ctx.fillStyle = g; ctx.fillRect(x - w / 2, sy - 90 * s, w, 90 * s);
      }
      ctx.restore(); if (Math.random() < 0.5) particles.push({ x: f.x + (Math.random() - 0.5) * 2, y: f.y, vx: 0, vy: -3, life: 0.5, max: 0.5, c: '#fff4c0', s: 1.4 });
      return true;
    }
    case 'puff': {
      const R = f.r * TS * s * (0.5 + p * 0.6);
      ctx.fillStyle = `rgba(${f.c},${0.55 * (1 - p)})`; ctx.beginPath(); ctx.arc(sx, sy - 6 * s - p * 8 * s, R, 0, 7); ctx.fill();
      return true;
    }
    case 'ghost': { // image rémanente
      const spr = f.spr, k = s;
      ctx.save(); ctx.globalAlpha = 0.5 * (1 - p); ctx.translate(sx, sy); if (f.flip) ctx.scale(-1, 1);
      ctx.drawImage(spr, -HFX * k, -HFY * k, HW * k, HH * k);
      ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = f.tint; ctx.globalAlpha = 0.35 * (1 - p); ctx.fillRect(-HFX * k, -HFY * k, HW * k, HH * k);
      ctx.restore(); return true;
    }
    case 'trail': {
      const [x2, y2] = scr(f.x2, f.y2);
      ctx.strokeStyle = `rgba(${f.c},${0.6 * (1 - p)})`; ctx.lineWidth = 6 * s; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sx, sy - 8 * s); ctx.lineTo(x2, y2 - 8 * s); ctx.stroke(); ctx.lineCap = 'butt';
      return true;
    }
    case 'thornP': { // épine qui tourne
      const ax = f.x + (f.x2 - f.x) * p, ay = f.y + (f.y2 - f.y) * p, [x2, y2] = scr(ax, ay);
      ctx.save(); ctx.translate(x2, y2); ctx.rotate(time * 18);
      ctx.fillStyle = '#4ab83a'; ctx.beginPath(); ctx.moveTo(0, -4 * s); ctx.lineTo(1.5 * s, 0); ctx.lineTo(0, 4 * s); ctx.lineTo(-1.5 * s, 0); ctx.fill();
      ctx.fillStyle = '#a0e070'; ctx.fillRect(-0.5 * s, -3 * s, s, 2 * s);
      ctx.restore();
      if (Math.random() < 0.6) particles.push({ x: ax, y: ay, vx: 0, vy: 0.4, life: 0.3, max: 0.3, c: '#7ae05a', s: 1.2 });
      return true;
    }
    case 'cross': { // croix sacrée
      const y = sy - 14 * s - p * 14 * s, k = (f.big ? 1.6 : 1) * s;
      ctx.save(); ctx.globalAlpha = 1 - p; ctx.shadowColor = '#ffe08a'; ctx.shadowBlur = 8 * s; ctx.fillStyle = '#fff4c0';
      ctx.fillRect(sx - 1.5 * k, y - 8 * k, 3 * k, 16 * k); ctx.fillRect(sx - 6 * k, y - 4 * k, 12 * k, 3 * k);
      ctx.restore(); return true;
    }
    case 'skysword': { // épée céleste du Jugement
      const q = Math.min(1, p / 0.35), y = sy - (1 - q) * 120 * s;
      ctx.save(); ctx.globalAlpha = p < 0.35 ? 1 : 1 - (p - 0.35) / 0.65; ctx.shadowColor = '#ffe08a'; ctx.shadowBlur = 10 * s;
      ctx.fillStyle = '#fff8dc'; ctx.fillRect(sx - 2 * s, y - 34 * s, 4 * s, 30 * s);
      ctx.beginPath(); ctx.moveTo(sx - 2 * s, y - 4 * s); ctx.lineTo(sx, y + 2 * s); ctx.lineTo(sx + 2 * s, y - 4 * s); ctx.fill();
      ctx.fillStyle = '#e2b04a'; ctx.fillRect(sx - 7 * s, y - 36 * s, 14 * s, 3 * s); ctx.fillRect(sx - 1.5 * s, y - 44 * s, 3 * s, 8 * s);
      ctx.restore();
      if (p > 0.35 && !f.hit) { f.hit = 1; for (let j = 0; j < 24; j++) { const a = Math.random() * 7, v = 2 + Math.random() * 4; particles.push({ x: f.x, y: f.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.5 - 1, g: 3, life: 0.6, max: 0.6, c: j % 2 ? '#ffe28a' : '#ffffff', s: 2 }); } }
      return true;
    }
    case 'vines': { // ronces qui sortent du sol
      const n = 9, grow = Math.min(1, p * 4), fade = p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;
      ctx.save(); ctx.globalAlpha = fade;
      for (let j = 0; j < n; j++) {
        const a = j / n * 6.283 + f.seed, rr = (0.3 + ((j * 37 + f.seed) % 10) / 14) * f.r;
        const bx = sx + Math.cos(a) * rr * TS * s, by = sy + Math.sin(a) * rr * TS * s * 0.5, H = (10 + (j % 3) * 4) * s * grow;
        ctx.strokeStyle = '#3a7a2a'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + 4 * s * Math.sin(j), by - H / 2, bx + 2 * s * Math.cos(j), by - H); ctx.stroke();
        ctx.fillStyle = '#7ae05a'; ctx.fillRect(bx + 2 * s * Math.cos(j) - s, by - H - s, 2 * s, 2 * s);
        ctx.fillStyle = '#d8f0a0'; ctx.fillRect(bx + 1 * s, by - H * 0.5, s, s);
      }
      ctx.restore(); return true;
    }
    case 'cloud': { // nuage d'orage
      const R = f.r * TS * s, cy = sy - 62 * s;
      ctx.save(); ctx.globalAlpha = 0.55 * Math.sin(p * Math.PI);
      ctx.fillStyle = '#3a3a4a'; for (let j = 0; j < 5; j++) { ctx.beginPath(); ctx.ellipse(sx + (j - 2) * R * 0.35, cy + Math.sin(j * 2) * 4 * s, R * 0.35, R * 0.18, 0, 0, 7); ctx.fill(); }
      ctx.restore(); return true;
    }
    case 'orbit': { // danse des lames
      const R = f.r * TS * s, e = me.has ? null : null;
      const im = wpnSprite('dagger');
      for (let j = 0; j < 6; j++) {
        const a = time * 9 + j * Math.PI / 3, x = sx + Math.cos(a) * R, y = sy - 6 * s + Math.sin(a) * R * 0.5;
        ctx.save(); ctx.globalAlpha = 1 - p * 0.5; ctx.translate(x, y); ctx.rotate(a + Math.PI); ctx.drawImage(im, -im.ax * s, -im.ay * s, im.width * s, im.height * s); ctx.restore();
      }
      return true;
    }
    case 'spikes': { // pics de glace
      ctx.save(); ctx.globalAlpha = p > 0.6 ? 1 - (p - 0.6) / 0.4 : 1;
      const n = 14, R = f.r * TS * s * Math.min(1, p * 2.5);
      for (let j = 0; j < n; j++) {
        const a = j / n * 6.283, x = sx + Math.cos(a) * R, y = sy + Math.sin(a) * R * 0.5, H = (8 + (j % 3) * 3) * s;
        ctx.fillStyle = '#bfe8ff'; ctx.beginPath(); ctx.moveTo(x - 2 * s, y); ctx.lineTo(x, y - H); ctx.lineTo(x + 2 * s, y); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 0.5 * s, y - H * 0.8, s, H * 0.5);
      }
      ctx.restore(); return true;
    }
    case 'tpcast': { // cercle de runes qui monte, colonne de lumière qui grandit
      const e = ents.get(f.id), [cx, cy] = e ? scr(e.rx, e.ry) : [sx, sy], R = (10 + p * 6) * s;
      ctx.save(); ctx.strokeStyle = '#c8a8ff'; ctx.lineWidth = s; ctx.globalAlpha = 0.5 + p * 0.5;
      ctx.beginPath(); ctx.ellipse(cx, cy, R, R * 0.45, 0, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.ellipse(cx, cy, R * 0.7, R * 0.32, 0, 0, 7); ctx.stroke();
      ctx.fillStyle = '#e8d8ff'; for (let i = 0; i < 6; i++) { const a = time * 3 + i * Math.PI / 3; ctx.fillRect(cx + Math.cos(a) * R * 0.85 - s, cy + Math.sin(a) * R * 0.38 - s, 2 * s, 2 * s); }
      const H = p * 70 * s, g = ctx.createLinearGradient(0, cy - H, 0, cy); g.addColorStop(0, 'rgba(200,170,255,0)'); g.addColorStop(1, `rgba(200,170,255,${0.15 + p * 0.45})`);
      ctx.fillStyle = g; ctx.fillRect(cx - (4 + p * 6) * s, cy - H, (8 + p * 12) * s, H); ctx.restore();
      if (e && Math.random() < 0.7) { const a = Math.random() * 7, rr = 1.2 * (1 - p * 0.5); particles.push({ x: e.rx + Math.cos(a) * rr, y: e.ry + Math.sin(a) * rr * 0.4, vx: -Math.cos(a) * 0.6, vy: -1.5 - p * 2, life: 0.6, max: 0.6, c: Math.random() < 0.5 ? '#c08aff' : '#ffffff', s: 1.4 }); }
      if (e) e.tpGlow = p;
      return true;
    }
    case 'tpbeam': { // éclair de lumière au départ et à l'arrivée
      const H = 90 * s, w = (f.out ? (1 - p) * 16 : (1 - p) * 20) * s;
      const g = ctx.createLinearGradient(0, sy - H, 0, sy); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, `rgba(230,210,255,${0.9 * (1 - p)})`);
      ctx.fillStyle = g; ctx.fillRect(sx - w / 2, sy - H, w, H);
      ctx.fillStyle = `rgba(255,255,255,${0.8 * (1 - p)})`; ctx.fillRect(sx - w / 6, sy - H, w / 3, H);
      return true;
    }
    case 'scorch': {
      const R = f.r * TS * s;
      ctx.fillStyle = `rgba(30,16,10,${0.45 * (1 - p)})`; ctx.beginPath(); ctx.ellipse(sx, sy, R, R * 0.5, 0, 0, 7); ctx.fill();
      if (Math.random() < 0.15 * (1 - p)) particles.push({ x: f.x + (Math.random() - 0.5) * f.r, y: f.y + (Math.random() - 0.5) * f.r * 0.5, vx: 0, vy: -1, life: 0.6, max: 0.6, c: '#ff7a2a', s: 1.2 });
      return true;
    }
  }
  return false;
}
function drawParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const q = particles[i];
    if (q.delay > 0) { q.delay -= dt; continue; }
    q.life -= dt; if (q.life <= 0) { particles.splice(i, 1); continue; }
    q.vy += (q.g || 0) * dt; q.x += q.vx * dt; q.y += q.vy * dt;
    const [sx, sy] = scr(q.x, q.y), s = q.s * S;
    ctx.globalAlpha = Math.min(1, q.life / q.max * 1.5); ctx.fillStyle = q.c;
    if (q.plus) { ctx.fillRect(sx - s, sy - s / 3, s * 2, s * 2 / 3); ctx.fillRect(sx - s / 3, sy - s, s * 2 / 3, s * 2); } else ctx.fillRect(sx - s / 2, sy - s / 2, s, s);
  }
  ctx.globalAlpha = 1;
  if (particles.length > 600) particles.splice(0, particles.length - 600);
}
function drawTexts(dt) {
  for (let i = texts.length - 1; i >= 0; i--) {
    const t = texts[i]; t.life -= dt; if (t.life <= 0) { texts.splice(i, 1); continue; }
    const p = 1 - t.life / t.max, [sx, sy] = scr(t.x, t.y - p * 0.9);
    ctx.globalAlpha = Math.min(1, t.life / t.max * 2);
    label(t.t, sx, sy, t.c, 11 * t.big * (p < 0.12 ? 1 + (0.12 - p) * 3 : 1));
  }
  ctx.globalAlpha = 1;
}

// Obscurité : souterrains et nuit, éclairés autour des joueurs, lanternes et pierres
let darkCv = null, darkAmt = 0, nightAmt = 0;
function drawDarkness() {
  darkAmt += ((isDarkZone(me.lx, me.ly) ? 1 : 0) - darkAmt) * 0.06;
  nightAmt += (todPhase().night - nightAmt) * 0.05;
  const a = Math.max(darkAmt * 0.78, nightAmt * 0.55);
  if (a < 0.02) return;
  const dw = Math.ceil(cv.width / 4), dh = Math.ceil(cv.height / 4);
  if (!darkCv || darkCv.width !== dw || darkCv.height !== dh) { darkCv = document.createElement('canvas'); darkCv.width = dw; darkCv.height = dh; }
  const g = darkCv.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, dw, dh);
  g.fillStyle = darkAmt * 0.78 > nightAmt * 0.55 ? `rgba(8,4,18,${a})` : `rgba(10,16,44,${a})`; g.fillRect(0, 0, dw, dh);
  g.globalCompositeOperation = 'destination-out'; g.setTransform(0.25, 0, 0, 0.25, 0, 0);
  const light = (x, y, r, al) => { const [sx, sy] = scr(x, y), R = r * TS * S;
    const gr = g.createRadialGradient(sx, sy, 0, sx, sy, R); gr.addColorStop(0, `rgba(0,0,0,${al})`); gr.addColorStop(0.6, `rgba(0,0,0,${al * 0.6})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(sx - R, sy - R, R * 2, R * 2); };
  for (const e of ents.values()) {
    if (e.kind === 'p') light(e.id === myId ? me.lx : e.rx, (e.id === myId ? me.ly : e.ry) - 0.5, 5.5 + Math.sin(time * 9 + e.id) * 0.15, 1);
    else if ((MT[e.type] || {}).boss) light(e.rx, e.ry - 1, 4, 0.7);
  }
  for (const e of remoteList()) light(e.rx, e.ry - 0.5, 5.5, 1);
  if (me.ly < WORLD_H) {
    for (const [lx, ly] of LANTERNS) light(lx, ly - 1.2, 4, 0.9);
    for (const w of WAYPOINTS) light(w.x, w.y - 0.8, 2.2, 0.6);
    const p = NPCS.find(n => n.kind === 'portal'); if (p) light(p.x, p.y - 0.6, 2.5, 0.7);
  }
  ctx.imageSmoothingEnabled = true; ctx.drawImage(darkCv, 0, 0, cv.width, cv.height); ctx.imageSmoothingEnabled = false;
}

const miniCv = $('miniCv'), mctx = miniCv.getContext('2d');
let miniT = 0;
function drawMinimap() {
  miniT -= 1; if (miniT > 0) return; miniT = 6;
  const inArena = me.ly >= WORLD_H, y0 = inArena ? WORLD_H : 0, hh = inArena ? H - WORLD_H : WORLD_H, VW = 96;
  const x0 = Math.max(0, Math.min(W - VW, Math.round(me.lx - VW / 2)));
  if (miniCv.height !== hh || miniCv.width !== VW) { miniCv.width = VW; miniCv.height = hh; miniCv.style.aspectRatio = `${VW} / ${hh}`; }
  mctx.imageSmoothingEnabled = false;
  mctx.drawImage(miniBase, x0, y0, VW, hh, 0, 0, VW, hh);
  const dot = (x, y, c, s = 1) => { mctx.fillStyle = c; mctx.fillRect((x | 0) - x0 - (s >> 1), (y | 0) - y0 - (s >> 1), s, s); };
  if (!inArena) { for (const n of NPCS) dot(n.x, n.y, '#9fd38a'); for (const w of WAYPOINTS) dot(w.x, w.y, me.st && me.st.wps && me.st.wps.includes(w.id) ? '#7ae8ff' : '#6a6680', 2); }
  for (const e of ents.values()) if (e.kind === 'm') { if ((MT[e.type] || {}).boss) dot(e.rx, e.ry, '#e070ff', 3); else dot(e.rx, e.ry, 'rgba(255,80,60,.9)'); }
  for (const e of ents.values()) if (e.kind === 'p' && e.id !== myId) dot(e.rx, e.ry, e.ally ? '#9fd38a' : '#6cc0ff', 2);
  for (const e of remoteList()) dot(e.rx, e.ry, e.ally ? '#9fd38a' : '#6cc0ff', 2);
  dot(me.lx, me.ly, '#fff', 3); dot(me.lx, me.ly, '#000');
  setTxt('zoneName', zoneName(me.lx, me.ly));
  const npc = !inArena && NPCS.filter(n => Math.hypot(n.x - me.lx, n.y - me.ly) < 2.2).sort((u, v) => Math.hypot(u.x - me.lx, u.y - me.ly) - Math.hypot(v.x - me.lx, v.y - me.ly))[0];
  const wp = !inArena && !npc && WAYPOINTS.find(w => Math.hypot(w.x - me.lx, w.y - me.ly) < 1.8);
  const node = !npc && !wp ? nodeHere() : null;
  const useOn = !!(npc || wp || node);
  if ($('bUse').classList.contains('on') !== useOn) $('bUse').classList.toggle('on', useOn);
  const useLbl = node ? 'Récolter' : 'Parler';
  if (hudCache.useLbl !== useLbl) { hudCache.useLbl = useLbl; $('bUse').querySelector('span').innerHTML = `${useLbl}<em class="key">E</em>`; }
  let txt = '';
  if (npc) txt = `<b>${esc(npc.name)}</b> · ` + ({ forge: 'améliorer ton équipement', shop: 'potions et rachat', quest: 'quêtes', portal: 'Gouffre et Tour sans fin', stable: 'montures', bank: 'banque commune' }[npc.kind]);
  else if (node) txt = `<b>${{ peche: 'Coin de pêche', mine: 'Filon', herbe: 'Plantes' }[node]}</b> · touche Récolter`;
  else if (wp) txt = `<b>Pierre de passage</b> · ${esc(wp.name)}`;
  setHidden('prompt', !txt); if (txt) setHtml('prompt', txt);
}
function updTargetFrame() {
  const tg = me.st && me.st.tgt ? ents.get(me.st.tgt) : null;
  setHidden('tframe', !tg);
  if (!tg) return;
  const mt = MT[tg.type] || {};
  setTxt('tName', `${mt.name || ''} · niv. ${tg.lvl || mt.lvl}`);
  setSty('tFill', 'transform', `scaleX(${Math.max(0, tg.hp / tg.mhp).toFixed(3)})`);
}

/* ============================================================
   Boucle
   ============================================================ */
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
  if (fxLow && particles.length > 50) particles.splice(0, particles.length - 50);
  if (joined) {
    autoTick(dt);
    readInput();
    if (me.has && !me.dead && CLASSES[me.cls]) {
      const l = Math.hypot(input.dx, input.dy);
      if (l > 0.1) {
        const s = CLASSES[me.cls].spd * (1 + ((me.st && me.st.spdT) || 0) / 100) * dt * Math.min(1, l), mx = input.dx / l * s, my = input.dy / l * s;
        if (!blocked(me.lx + mx, me.ly)) me.lx += mx;
        if (!blocked(me.lx, me.ly + my)) me.ly += my;
        const meEnt = ents.get(myId);
        if (!(meEnt && meEnt.atk)) me.dir = Math.abs(input.dx) > Math.abs(input.dy) ? (input.dx < 0 ? 2 : 3) : (input.dy < 0 ? 1 : 0);
      }
    }
    if (me.corrX || me.corrY) { const k = 1 - Math.exp(-dt * 12); me.lx += me.corrX * k; me.ly += me.corrY * k; me.corrX *= 1 - k; me.corrY *= 1 - k;
      if (Math.abs(me.corrX) < 0.002 && Math.abs(me.corrY) < 0.002) me.corrX = me.corrY = 0; }
    const t = performance.now();
    for (const c of chatLines) { const o = t - c.t > 14000 ? '0.25' : '1'; if (c.el.style.opacity !== o) c.el.style.opacity = o; }
  }
  render(dt);
  requestAnimationFrame(loop);
}

/* ============================================================
   Écran d'accueil
   ============================================================ */
const CLS_INFO = {
  guerrier: ['Guerrier', 'Robuste, au corps à corps', 'Beaucoup de vie. Tourbillon, puis Charge (niv. 5) et Cri de guerre pour tout le groupe (niv. 10).'],
  archere: ['Archère', 'Rapide, à distance', 'Tire de loin. Volée sur 4 cibles, puis Roulade (niv. 5) et Pluie de flèches (niv. 10).'],
  mage: ['Mage', 'Fragile, dégâts de zone', 'Projectiles magiques. Météore, puis Bouclier de glace (niv. 5) et Nova de givre (niv. 10).'],
  paladin: ['Paladin', 'Tank et soigneur', 'Le plus résistant. Frappe sacrée qui soigne, puis Lumière guérisseuse pour le groupe (niv. 5) et Jugement qui étourdit (niv. 10).'],
  assassin: ['Assassin', 'Très rapide, critiques', "Attaque vite et frappe fort. Pas de l'ombre derrière sa cible, puis Fumigène (niv. 5) et Danse des lames (niv. 10)."],
  druide: ['Druide', 'Nature, soins', 'Lance des épines à distance. Ronces qui ralentissent, puis Régénération pour le groupe (niv. 5) et Colère de la nature (niv. 10).'],
};
let chosen = store.get('ra_cls') || 'guerrier'; if (!CLS_INFO[chosen]) chosen = 'guerrier';
const box = $('classes');
for (const [k, [name, tag]] of Object.entries(CLS_INFO)) {
  const b = document.createElement('button'); b.className = 'cls'; b.dataset.k = k;
  const c = document.createElement('canvas'); c.width = 72; c.height = 84;
  b.append(c); b.insertAdjacentHTML('beforeend', `<b>${name}</b><small>${tag}</small>`);
  b.onclick = () => { chosen = k; refreshCls(); };
  box.appendChild(b);
}
function refreshCls() { for (const b of box.children) b.classList.toggle('sel', b.dataset.k === chosen); $('clsInfo').textContent = CLS_INFO[chosen][2]; }
function animPreview() {
  for (const b of box.children) {
    const k = b.dataset.k, g = b.querySelector('canvas').getContext('2d');
    g.imageSmoothingEnabled = false; g.clearRect(0, 0, 72, 84);
    const walk = k === chosen ? [1, 0, 2, 0][Math.floor(performance.now() / 125) % 4] : 0;
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(36, 78, 22, 5, 0, 0, 7); g.fill();
    if (heroReady(k)) { g.save(); if (k === chosen) g.translate(0, -Math.abs(Math.sin(performance.now() / 160)) * 3); drawHeroPreview(g, k, 72, 84, 3); g.restore(); }
    else {
      drawHero2Preview(g, k, 72, 80, walk);
    }
  }
  if (!joined) requestAnimationFrame(animPreview);
}
$('nameIn').value = store.get('ra_name') || '';
if (window.LocalServer) $('saveHint').textContent = 'Ta progression est gardée dans ce navigateur. Les autres personnes qui ouvrent cette page apparaissent en direct.';
refreshCls(); animPreview();
function join(nameOverride, clsOverride) {
  Snd.init();
  const name = (nameOverride || $('nameIn').value).trim();
  if (name.length < 2) { $('err').textContent = 'Choisis un pseudo de 2 à 14 caractères.'; return; }
  $('err').textContent = ''; wantJoin = { name, cls: clsOverride || chosen };
  if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'join', acc: ACC, ...wantJoin }));
}
// Compte de l'appareil : il regroupe tes personnages (5 au maximum)
let ACC = store.get('ra_acc');
if (!ACC || ACC.length < 8) { ACC = Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join(''); store.set('ra_acc', ACC); }
let charsCache = [], charsMax = 5;
function showNewChar(on) {
  $('newChar').hidden = !on; $('charBox').hidden = on || !charsCache.length;
  $('newCharHead').hidden = !charsCache.length;
  if (on) $('nameIn').value = '';
}
function renderChars(list, max) {
  charsCache = list || []; charsMax = max || 5;
  $('charCount').textContent = `${charsCache.length} / ${charsMax}`;
  const box = $('charList'); box.innerHTML = '';
  for (const c of charsCache) {
    const row = document.createElement('div'); row.className = 'charrow';
    const cvs = document.createElement('canvas'); cvs.width = 60; cvs.height = 70;
    const pal = PAL[c.cls] || PAL.guerrier, dd = c.look && DEF.dyesDef && DEF.dyesDef[c.look.dye] && DEF.dyesDef[c.look.dye].c;
    const dye = c.look && c.look.dye && c.look.dye !== 'base' ? c.look.dye : '';
    if (heroReady(c.cls)) { const g2 = cvs.getContext('2d'); g2.imageSmoothingEnabled = false; const art = heroArt[c.cls], k = Math.min(56 / art.w, 66 / art.h); g2.drawImage(heroCanvas(c.cls, DEF.dyesDef ? dye : ''), (60 - art.w * k) / 2, 68 - art.h * k, art.w * k, art.h * k); }
    else drawHero2Preview(cvs.getContext('2d'), c.cls, 60, 70);
    row.appendChild(cvs);
    const info = document.createElement('div'); info.className = 'grow';
    info.innerHTML = `<b>${esc(c.name)}</b><div class="note">${esc(CLS_INFO[c.cls] ? CLS_INFO[c.cls][0] : c.cls)} · niveau ${c.lvl}${c.reborn ? ` · ${c.reborn} renaissance${c.reborn > 1 ? 's' : ''}` : ''}</div>`;
    row.appendChild(info);
    const play = document.createElement('button'); play.className = 'btn'; play.textContent = 'Jouer';
    play.onclick = () => join(c.name, c.cls);
    const del = document.createElement('button'); del.className = 'btn alt small'; del.textContent = 'Supprimer';
    del.onclick = () => { if (del.dataset.sure) sendMsg({ t: 'delChar', acc: ACC, name: c.name }); else { del.dataset.sure = 1; del.textContent = 'Confirmer ?'; setTimeout(() => { delete del.dataset.sure; del.textContent = 'Supprimer'; }, 4000); } };
    row.append(play, del); box.appendChild(row);
  }
  $('newCharBtn').disabled = charsCache.length >= charsMax;
  $('newCharBtn').textContent = charsCache.length >= charsMax ? `Maximum atteint (${charsMax} personnages)` : 'Créer un nouveau personnage';
  showNewChar(!charsCache.length);
}
$('newCharBtn').onclick = () => showNewChar(true);
$('backChars').onclick = () => showNewChar(false);
function resetToLogin() {
  joined = false; wantJoin = null; me.has = false; me.st = null; me.prog = null; me.inv = []; me.eq = {}; me.bank = null;
  ents.clear(); drops = []; particles.length = 0; texts.length = 0; shapes.length = 0;
  try { cancelAuto(); auto.farm = false; $('bAuto').classList.remove('on'); } catch (e) {}
  closePanels(); closeTradeUI(); $('ask').hidden = true; $('chatlog').innerHTML = ''; chatLines.length = 0;
  for (const k of Object.keys(hudCache)) delete hudCache[k];
  $('hud').classList.remove('on'); $('login').classList.remove('off'); $('err').textContent = '';
  requestAnimationFrame(animPreview);
}
$('switchChar').onclick = () => { sendMsg({ t: 'auto', on: false }); sendMsg({ t: 'logout' }); };
$('go').onclick = () => join();
$('nameIn').addEventListener('keydown', e => { if (e.key === 'Enter') join(); });

/* ============================================================
   Progression : talents, métiers, gemmes, succès, apparence, journal
   ============================================================ */
let DEF = {};
const PANELS = ['bestiary', 'wmap', 'clog', 'settings', 'bank', 'bag', 'social', 'dlg', 'pcard', 'cat', 'itemPop', 'travel', 'forge', 'hub', 'journal', 'talents', 'metiers', 'gems', 'ach', 'look', 'guild', 'ah', 'arena'];
const GEM_COL = { r: '#e0303a', s: '#3a7ae0', e: '#2ec05a', t: '#f0c030', a: '#e08a20', o: '#8a5ac0' };
const gemName = c => `${DEF.gems[c[0]].name} ${'I II III IV V'.split(' ')[+c[1] - 1]}`;
const gemStatTxt = c => { const g = DEF.gems[c[0]], v = Math.max(1, Math.round(g.base * DEF.gemMul[+c[1]])); return `+${v} ${STAT_LABEL[g.stat]}`; };
const matName = k => k.startsWith('g_') ? gemName(k.slice(2)) : (DEF.mats[k] || k);
const recycleFrags = it => Math.max(1, Math.round([1, 2, 4, 8, 16, 32, 64][it.r] * (1 + 0.5 * (it.u || 0)) * Math.max(1, it.l / 10)));
const safeForgeFrags = it => ((it.u || 0) + 1) * [2, 3, 4, 6, 9, 13, 20][it.r];
const P = () => me.prog || {};
function renderOpenPanels() {
  if (!$('talents').hidden) renderTalents();
  if (!$('metiers').hidden) renderMetiers();
  if (!$('journal').hidden) renderJournal();
  if (!$('ach').hidden) renderAch();
  if (!$('bestiary').hidden) renderBestiary();
  if (!$('look').hidden) renderLook();
  if (!$('gems').hidden) renderGems();
  if (!$('forge').hidden) renderForge();
  if (!$('bank').hidden) renderBank();
}
document.querySelectorAll('[data-open]').forEach(b => b.onclick = () => togglePanel(b.dataset.open));
$('mHub').onclick = () => togglePanel('hub');
$('mMount').onclick = () => sendMsg({ t: 'mount' });
$('waveLeave').onclick = () => { if ($('waveLeave').dataset.sure) { sendMsg({ t: 'leaveInst' }); delete $('waveLeave').dataset.sure; $('waveLeave').textContent = 'Quitter'; } else { $('waveLeave').dataset.sure = '1'; $('waveLeave').textContent = 'Sûr ?'; setTimeout(() => { delete $('waveLeave').dataset.sure; $('waveLeave').textContent = 'Quitter'; }, 3000); } };
const onOpen = { journal: renderJournal, talents: renderTalents, metiers: renderMetiers, gems: renderGems, ach: renderAch, look: renderLook, guild: () => Hub.guild(), ah: () => Hub.ah(), arena: () => Hub.arena() };

function renderBank() {
  const b = me.bank; if (!b || $('bank').hidden) return;
  const pr = P(), mine = Object.entries(pr.mat || {}), stored = Object.entries(b.mat || {});
  const keepAmt = $('bkGold') ? $('bkGold').value : '';
  const matRow = (k, n, dep) => `<div class="row2">${k.startsWith('g_') ? `<span class="gemdot" style="background:${GEM_COL[k[2]]}"></span>` : ''}<div class="grow"><b>${esc(matName(k))}</b> × ${n}</div><button class="btn small" data-bk="${k}" data-op="${dep ? 'dep' : 'wd'}" data-n="1">${dep ? 'Déposer 1' : 'Retirer 1'}</button><button class="btn alt small" data-bk="${k}" data-op="${dep ? 'dep' : 'wd'}" data-n="${n}">Tout</button></div>`;
  $('bankBody').innerHTML = `<div class="note" style="margin-bottom:6px">Ce que tu déposes ici est partagé entre tous tes personnages.</div>
    <div class="sub2">Or · en banque : ${b.gold} · sur toi : ${b.pgold != null ? b.pgold : (me.st ? me.st.gold : 0)}</div>
    <div class="field"><input id="bkGold" type="number" min="1" inputmode="numeric" placeholder="Montant"><button class="btn small" id="bkGDep">Déposer</button><button class="btn alt small" id="bkGWd">Retirer</button></div>
    <div class="tcols"><div class="tcol"><h4>Sur toi</h4>${mine.length ? mine.map(([k, n]) => matRow(k, n, true)).join('') : '<div class="note">Aucune ressource.</div>'}</div>
    <div class="tcol"><h4>En banque</h4>${stored.length ? stored.map(([k, n]) => matRow(k, n, false)).join('') : '<div class="note">Vide.</div>'}</div></div>
    <div class="sub2">Objets en banque · ${b.items.length} / ${b.max}</div>
    <div class="grid" id="bkItems"></div>
    <div class="sub2">Déposer un objet du sac</div>
    <div class="grid" id="bkBag"></div>`;
  $('bkGold').value = keepAmt;
  $('bankBody').querySelectorAll('[data-bk]').forEach(btn => btn.onclick = () => sendMsg({ t: 'bank', kind: 'mat', op: btn.dataset.op, k: btn.dataset.bk, n: +btn.dataset.n }));
  $('bkGDep').onclick = () => sendMsg({ t: 'bank', kind: 'gold', op: 'dep', n: +$('bkGold').value || 0 });
  $('bkGWd').onclick = () => sendMsg({ t: 'bank', kind: 'gold', op: 'wd', n: +$('bkGold').value || 0 });
  for (const it of b.items) { const c = document.createElement('button'); c.className = 'cell r' + it.r; c.innerHTML = cellHtml(it); c.title = 'Retirer : ' + it.name; c.onclick = () => sendMsg({ t: 'bank', kind: 'item', op: 'wd', i: it.bi }); $('bkItems').appendChild(c); }
  if (!b.items.length) $('bkItems').innerHTML = '<div class="note" style="grid-column:1/-1">Aucun objet. Touche un objet du sac ci-dessous pour le déposer.</div>';
  for (const it of me.inv) { const c = document.createElement('button'); c.className = 'cell r' + it.r; c.innerHTML = cellHtml(it); c.title = 'Déposer : ' + it.name; c.onclick = () => sendMsg({ t: 'bank', kind: 'item', op: 'dep', id: it.id }); $('bkBag').appendChild(c); }
  if (!me.inv.length) $('bkBag').innerHTML = '<div class="note" style="grid-column:1/-1">Ton sac est vide.</div>';
}
function renderTalents() {
  const pr = P(); if (!pr.tal) return;
  $('talPts').textContent = `${pr.pts} point${pr.pts > 1 ? 's' : ''}`;
  const ct = DEF.classTalents[me.cls];
  const rows = [...Object.entries(DEF.talents), ['cls', ct]].map(([k, t]) => {
    const r = pr.tal[k] || 0, max = DEF.talentMax;
    return `<div class="row2"><div class="grow"><b>${esc(t.name)}</b> <span class="note">${r} / ${max}</span><div class="note">${esc(t.desc)}</div><div class="pbar"><i style="width:${r / max * 100}%"></i></div></div><div class="talbtns">${[1, 10].map(n => `<button class="btn small" data-tal="${k}" data-n="${n}"${pr.pts > 0 && r < max ? '' : ' disabled'}>+${n}</button>`).join('')}<button class="btn alt small" data-tal="${k}" data-n="100"${pr.pts > 0 && r < max ? '' : ' disabled'}>Max</button></div></div>`;
  }).join('');
  const lvl = me.st ? me.st.lvl : 1, ready = lvl >= DEF.maxLvl;
  $('talBody').innerHTML = `<div class="note" style="margin-bottom:6px">Un point par niveau (deux après ta première renaissance), plus 10 par réincarnation. Chaque talent monte jusqu'au rang ${DEF.talentMax}. « Max » y met tous les points possibles.</div>${rows}
    <div class="field"><button class="btn alt small" id="talReset">Réinitialiser (${lvl * 20} or)</button></div>
    <div class="row2${ready ? ' done' : ''}"><div class="grow"><b>Réincarnation</b> <span class="note">${pr.reborn ? `déjà ${pr.reborn} fois` : 'jamais'}</span>
    <div class="note">Au niveau ${DEF.maxLvl}, renais au niveau 1 en gardant ton équipement, ton or et tes succès. Ton niveau de puissance (niveau + 100 par renaissance) continue de monter : c'est lui qui compte face aux monstres jusqu'au niveau 1000. Chaque renaissance donne pour toujours +5 % de vie et de dégâts, et 10 points de talent.${pr.reborn ? ` Bonus actuel : +${pr.reborn * 5} %.` : ''}${' <b>Aura de prestige</b> : ' + (pr.reborn ? AURA_NAMES[Math.min(11, pr.reborn)] : 'aucune') + ' · prochaine : ' + AURA_NAMES[Math.min(11, (pr.reborn || 0) + 1)] + '.'}</div>
    <div class="pbar${ready ? ' ok' : ''}"><i style="width:${Math.min(100, lvl / DEF.maxLvl * 100)}%"></i></div></div>
    <button class="btn small" id="talReborn"${ready ? '' : ' disabled'}>${ready ? 'Se réincarner' : `Niv. ${lvl}/${DEF.maxLvl}`}</button></div>`;
  $('talBody').querySelectorAll('[data-tal]').forEach(b => b.onclick = () => { sendMsg({ t: 'talent', k: b.dataset.tal, n: +b.dataset.n || 1 }); Snd.play('click'); });
  $('talReset').onclick = () => sendMsg({ t: 'talentReset' });
  $('talReborn').onclick = () => { const b = $('talReborn'); if (b.dataset.sure) { sendMsg({ t: 'reborn' }); } else { b.dataset.sure = '1'; b.textContent = 'Confirmer ?'; } };
}

function renderMetiers() {
  const pr = P(); if (!pr.prof) return;
  const how = { peche: 'de n\'importe quelle eau (lac, rivières des régions)', mine: 'des roches et cristaux (Mine du royaume ou rochers des régions)', herbe: 'des roseaux et des fleurs, partout dans le monde' };
  let h = Object.entries(DEF.profs).map(([k, n]) => { const p = pr.prof[k]; return `<div class="row2"><div class="grow"><b>${n}</b> <span class="note">niv. ${p.lvl} / 50</span><div class="note">Approche-toi ${how[k]} puis touche « Récolter ».</div><div class="pbar"><i style="width:${p.lvl >= 50 ? 100 : p.xp / (40 * p.lvl) * 100}%"></i></div></div></div>`; }).join('');
  const mats = Object.entries(pr.mat || {}).filter(([k]) => !k.startsWith('g_'));
  h += `<div class="sub2">Matériaux</div><div class="note">${mats.length ? mats.map(([k, n]) => `${esc(matName(k))} × <b>${n}</b>`).join(' · ') : 'Aucun pour l\'instant.'}</div>`;
  h += '<div class="sub2">Artisanat</div>' + Object.entries(DEF.recipes).map(([id, r]) => {
    const ok = Object.entries(r.need).every(([k, n]) => (pr.mat[k] || 0) >= n);
    return `<div class="row2"><div class="grow"><b>${esc(r.name)}</b><div class="note">${Object.entries(r.need).map(([k, n]) => `${n} ${esc(matName(k))} (${pr.mat[k] || 0})`).join(' + ')} → ${esc(r.desc)}</div></div><button class="btn small" data-craft="${id}"${ok ? '' : ' disabled'}>Fabriquer</button></div>`;
  }).join('');
  h += gearCraftHtml(pr);
  const buffs = [pr.food, pr.elix].filter(Boolean);
  if (buffs.length) h += `<div class="note" style="margin-top:6px">Effets actifs : ${buffs.map(b => `${esc(b.name)} (${b.min} min)`).join(', ')}</div>`;
  $('metBody').innerHTML = h;
  $('metBody').querySelectorAll('[data-craft]').forEach(b => b.onclick = () => { sendMsg({ t: 'craft', id: b.dataset.craft }); Snd.play('click'); });
  $('metBody').querySelectorAll('[data-gs]').forEach(b => b.onclick = () => { gc.s = b.dataset.gs; renderMetiers(); });
  $('metBody').querySelectorAll('[data-gr]').forEach(b => b.onclick = () => { gc.r = +b.dataset.gr; gc.si = 0; renderMetiers(); });
  $('metBody').querySelectorAll('[data-gi]').forEach(b => b.onclick = () => { gc.si = +b.dataset.gi; renderMetiers(); });
  const gb = $('gcGo'); if (gb) gb.onclick = () => { sendMsg({ t: 'craftGear', s: gc.s, r: gc.r, si: gc.si }); Snd.play('click'); setTimeout(renderMetiers, 300); };
}

function renderGems() {
  const pr = P(); if (!pr.mat) return;
  const gems = Object.entries(pr.mat).filter(([k]) => k.startsWith('g_')).map(([k, n]) => [k.slice(2), n]).sort();
  let h = `<div class="note" style="margin-bottom:6px">Les objets Rares en ont 1 emplacement, les Légendaires 2, les Héroïques 3. Sertis une gemme depuis la fiche d'un objet. Trois gemmes identiques fusionnent en une du niveau supérieur. Fragments de forge : <b>${pr.mat.frag || 0}</b>.</div>`;
  h += gems.length ? gems.map(([c, n]) => `<div class="row2"><span class="gemdot" style="background:${GEM_COL[c[0]]}"></span><div class="grow"><b>${esc(gemName(c))}</b> × ${n}<div class="note">${gemStatTxt(c)}</div></div>${+c[1] < 5 ? `<button class="btn small" data-fuse="${c}"${n >= 3 ? '' : ' disabled'}>Fusionner 3 → 1</button>` : ''}</div>`).join('')
    : '<div class="note">Aucune gemme. Elles tombent des monstres, se minent dans la Mine et récompensent les quêtes journalières.</div>';
  $('gemBody').innerHTML = h;
  $('gemBody').querySelectorAll('[data-fuse]').forEach(b => b.onclick = () => sendMsg({ t: 'fuse', gem: b.dataset.fuse }));
}

function renderAch() {
  const pr = P(); if (!pr.ach) return;
  const got = new Set(pr.ach);
  $('achCount').textContent = `${got.size} / ${DEF.achDef.length}`;
  const val = a => {
    const s = pr.stats || {}, lvl = (me.st ? me.st.lvl : 1) + (pr.reborn || 0) * 100;
    return ({ k100: s.kills, k1000: s.kills, k10000: s.kills, loups: (s.k_loup || 0) + (s.k_loupnoir || 0) + (s.k_lougarou || 0), roi: s.b_roi, golem: s.b_golemroi, dragon: s.b_dragon,
      r4: s.maxRar, r5: s.maxRar, r6: s.maxRar, f9: s.forgeMax, t10: s.tower, t50: s.tower, fish: s.fish, ore: s.ore, herb: s.herb, q9: null, lvl50: lvl, lvl100: lvl, reborn: pr.reborn, arena10: s.arena, daily10: s.daily })[a.id] || 0;
  };
  $('achBody').innerHTML = `<div class="note" style="margin-bottom:6px">Titre porté : <span class="titlechip">${pr.title ? esc(pr.title) : 'aucun'}</span>${pr.title ? ' <button class="btn alt small" data-title="">Retirer</button>' : ''}</div>` +
    DEF.achDef.map(a => { const ok = got.has(a.id), v = Math.min(a.n, val(a));
      return `<div class="row2${ok ? ' done' : ''}"><div class="grow"><b>${esc(a.name)}</b> <span class="note">titre « ${esc(a.title)} »</span><div class="note">${esc(a.desc)}${ok ? '' : ` · ${v} / ${a.n}`}</div>${ok ? '' : `<div class="pbar"><i style="width:${v / a.n * 100}%"></i></div>`}</div>${ok && pr.title !== a.title ? `<button class="btn small" data-title="${a.id}">Porter</button>` : ''}</div>`; }).join('');
  $('achBody').querySelectorAll('[data-title]').forEach(b => b.onclick = () => sendMsg({ t: 'title', id: b.dataset.title }));
}

function renderLook() {
  const pr = P(); if (!pr.look) return;
  const own = new Set(pr.dyes), maxR = (pr.stats || {}).maxRar || 0;
  let h = '<div class="note" style="margin-bottom:6px">Change la couleur de ta tenue et la lueur de ton arme, sans toucher à tes statistiques.</div><div class="sub2">Teintures</div>';
  h += Object.entries(DEF.dyesDef).map(([k, d]) => {
    const sw = d.c ? `background:linear-gradient(135deg, ${d.c[0]} 50%, ${d.c[1]} 50%)` : `background:linear-gradient(135deg, ${PAL[me.cls].b} 50%, ${PAL[me.cls].d} 50%)`;
    const on = pr.look.dye === k, has = own.has(k);
    return `<div class="row2${on ? ' done' : ''}"><span class="sw" style="${sw}"></span><div class="grow"><b>${esc(d.name)}</b><div class="note">${on ? 'Portée' : has ? 'Possédée' : d.cost + ' or'}</div></div>${on ? '' : `<button class="btn small" data-dye="${k}">${has ? 'Porter' : 'Acheter'}</button>`}</div>`;
  }).join('');
  h += '<div class="sub2">Lueur d\'arme</div><div class="note" style="margin-bottom:4px">Débloquée par la plus haute rareté que tu as trouvée.</div><div class="chips">' +
    [-1, 2, 3, 4, 5, 6].map(r => `<button class="chip${r >= 0 ? ' rc' + r : ''}${pr.look.aura === r ? ' on' : ''}" data-aura="${r}"${r > maxR ? ' disabled' : ''}>${r < 0 ? 'Aucune' : RAR_NAMES[r]}</button>`).join('') + '</div>';
  $('lookBody').innerHTML = h;
  $('lookBody').querySelectorAll('[data-dye]').forEach(b => b.onclick = () => sendMsg({ t: 'dye', id: b.dataset.dye }));
  $('lookBody').querySelectorAll('[data-aura]').forEach(b => b.onclick = () => sendMsg({ t: 'aura', r: +b.dataset.aura }));
}

function fmtMin(ms) { const m = Math.max(0, Math.round(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; }
function renderJournal() {
  const pr = P(); if (!pr.daily || !me.st) return;
  const wb = me.st.wb || {};
  let h = '<div class="sub2">Boss mondial</div>';
  h += `<div class="row2${wb.s === 'up' ? ' done' : ''}"><div class="grow"><b>Vyrmax, dragon d'Ambre</b><div class="note">${wb.s === 'up' ? `Posé vers ${esc(wb.n)} : il repart dans ${fmtMin(wb.t)}. Butin Héroïque garanti.` : wb.s === 'soon' ? `Arrive dans ${fmtMin(wb.t)} vers ${esc(wb.n)}.` : `Prochaine apparition dans ${fmtMin(wb.t)}, toutes les heures.`}</div></div></div>`;
  h += '<div class="sub2">Quête principale</div>';
  const q = me.st.q;
  h += q ? `<div class="row2"><div class="grow"><b>${esc(q[0])}</b><div class="note">${q[1]} / ${q[2]}</div><div class="pbar"><i style="width:${q[1] / q[2] * 100}%"></i></div></div></div>` : '<div class="note">Aucune quête en cours : parle au Capitaine Aldric.</div>';
  h += '<div class="sub2">Quêtes du jour</div><div class="note" style="margin-bottom:4px">Elles changent chaque jour. Récompense : or, XP et une gemme.</div>';
  h += pr.daily.defs.map((d, i) => { const v = Math.min(d.n, pr.daily.prog[i]), done = v >= d.n, cl = pr.daily.claimed[i];
    return `<div class="row2${cl ? ' done' : ''}"><div class="grow"><b>${esc(d.name)}</b><div class="note">${cl ? 'Récompense reçue' : `${v} / ${d.n}`}</div><div class="pbar${done ? ' ok' : ''}"><i style="width:${v / d.n * 100}%"></i></div></div>${done && !cl ? `<button class="btn small" data-claim="${i}">Récupérer</button>` : ''}</div>`; }).join('');
  $('journalBody').innerHTML = h;
  $('journalBody').querySelectorAll('[data-claim]').forEach(b => b.onclick = () => sendMsg({ t: 'dclaim', i: +b.dataset.claim }));
}

// Récolte : le bouton d'action devient « Récolter » près d'une ressource
let gatherLoop = false;
function nearTileC(set, r = 1.4) {
  for (let y = Math.floor(me.ly - r); y <= me.ly + r; y++) for (let x = Math.floor(me.lx - r); x <= me.lx + r; x++)
    if (set.includes(tileAt(x, y)) && Math.hypot(x + 0.5 - me.lx, y + 0.5 - me.ly) < r + 0.3) return true;
  return false;
}
function nodeHere() {
  if (me.ly >= WORLD_H) return null;
  if (me.lx < 40 && me.ly > 26 && me.ly < 52 && nearTileC([T.WATER])) return 'peche';
  if (me.ly >= 74 && me.lx >= 54 && nearTileC([T.MWALL, T.CRYSTAL], 1.2)) return 'mine';
  if (nearTileC([T.REED, T.FLOWER], 1.1)) return 'herbe';
  return null;
}
function doGather() { gatherLoop = true; sendMsg({ t: 'gather' }); }

/* ============================================================
   Couche sociale partagée : guildes, hôtel des ventes, arène
   Elle passe par la base de l'artefact (version jouable ici) ou par le serveur.
   ============================================================ */
const Hub = (() => {
  let ref = 0; const waiting = {};
  const ask = o => new Promise(res => { const r = ++ref; waiting[r] = res; sendMsg({ ...o, ref: r }); setTimeout(() => { if (waiting[r]) { delete waiting[r]; res({ ok: false }); } }, 8000); });
  const answer = o => { const f = waiting[o.ref]; if (f) { delete waiting[o.ref]; f(o); } };
  const db = () => window.RA_db || null;
  const uid = () => window.RA_uid || DEF.uid || null;
  const available = () => !!(LOCAL ? db() && uid() : uid());
  // Base : mêmes opérations des deux côtés
  const store = {
    async list(col, where = [], order, limit = 200) {
      if (LOCAL) { let q = db().collection(col); for (const [f, op, v] of where) q = q.where(f, op, v); if (order) q = q.orderBy(order[0], order[1]); q = q.limit(limit);
        const snap = await q.get(); return snap.docs.map(d => ({ id: d.id, data: d.data() || {} })); }
      const r = await ask({ t: 'kv', op: 'list', col, where, order, limit }); return r.docs || [];
    },
    async get(col, id) { if (LOCAL) { const d = await db().doc(col + '/' + id).get(); return d.exists ? d.data() : null; } const r = await ask({ t: 'kv', op: 'get', col, id }); return r.docs && r.docs[0] ? r.docs[0].data : null; },
    async set(col, id, data) { if (LOCAL) { await db().doc(col + '/' + id).set(data); return true; } return (await ask({ t: 'kv', op: 'set', col, id, data })).ok; },
    async del(col, id) { if (LOCAL) { await db().doc(col + '/' + id).delete(); return true; } return (await ask({ t: 'kv', op: 'del', col, id })).ok; },
  };
  const take = o => ask({ t: 'hubTake', ...o });
  const give = o => ask({ t: 'hubGive', ...o });
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const weekKey = () => { const d = new Date(); const j = new Date(d.getFullYear(), 0, 1); return d.getFullYear() + '-' + Math.ceil(((d - j) / 864e5 + j.getDay() + 1) / 7); };
  const busy = (el, txt = 'Chargement…') => { el.innerHTML = `<div class="note">${txt}</div>`; };
  const unavailable = el => { el.innerHTML = '<div class="note">Cette fonction a besoin de la base partagée, qui n\'est pas disponible dans cette vue.</div>'; };
  const err = e => addChat('', 'Action impossible pour le moment, réessaie.', 'info');
  async function describeRaw(raws) { return new Promise(res => { if (!raws.length) return res([]); describe(raws.slice(0, 8), res); }); }

  /* ---------- Guilde ---------- */
  let myGuild = null;
  async function guild() {
    const el = $('guildBody'); if (!available()) return unavailable(el); busy(el);
    try {
      const mem = await store.get('gmembers', uid());
      if (!mem || !mem.gid) { myGuild = null; sendMsg({ t: 'setTag', tag: '' }); window.RA_gtag = ''; return guildList(el); }
      const g = await store.get('guilds', mem.gid);
      if (!g) { await store.del('gmembers', uid()); return guild(); }
      myGuild = { id: mem.gid, ...g };
      sendMsg({ t: 'setTag', tag: g.tag }); window.RA_gtag = g.tag;
      await syncMember(mem);
      const members = await store.list('gmembers', [['gid', '==', mem.gid]]);
      const bank = await store.list('gbank', [['gid', '==', mem.gid]]);
      const wk = weekKey(), goal = 1000;
      const done = members.reduce((s, m) => s + (m.data.week === wk ? m.data.wk || 0 : 0), 0);
      const meDoc = members.find(m => m.id === uid());
      const claimed = meDoc && meDoc.data.claimed === wk;
      const golds = bank.filter(b => b.data.kind === 'gold'), items = bank.filter(b => b.data.kind === 'item');
      const goldTotal = golds.reduce((s, b) => s + (b.data.gold | 0), 0);
      const infos = await describeRaw(items.map(b => b.data.raw));
      el.innerHTML = `<div class="row2"><div class="grow"><b>${esc(g.name)}</b> <span class="note">[${esc(g.tag)}] · ${members.length} membre${members.length > 1 ? 's' : ''}</span></div><button class="btn alt small" id="gLeave">Quitter</button></div>
        <div class="sub2">Quête de guilde de la semaine</div><div class="row2"><div class="grow"><b>Vaincre ${goal} monstres ensemble</b><div class="note">${Math.min(goal, done)} / ${goal}</div><div class="pbar${done >= goal ? ' ok' : ''}"><i style="width:${Math.min(100, done / goal * 100)}%"></i></div></div>${done >= goal && !claimed ? '<button class="btn small" id="gClaim">Récupérer</button>' : claimed ? '<span class="note">Reçue</span>' : ''}</div>
        <div class="sub2">Membres</div>${members.sort((a, b) => (b.data.lvl | 0) - (a.data.lvl | 0)).map(m => `<div class="row2"><div class="grow"><b>${esc(m.data.n || '?')}</b>${m.id === g.owner ? ' <span class="home">Chef</span>' : ''}<div class="note">${esc((CLASSES[m.data.cls] || {}).name || '')} · niv. ${m.data.lvl | 0} · ${m.data.week === wk ? m.data.wk | 0 : 0} monstres cette semaine</div></div></div>`).join('')}
        <div class="sub2">Banque · ${goldTotal} or</div>
        <div class="field"><input id="gGold" type="number" min="1" inputmode="numeric" placeholder="Montant"><button class="btn small" id="gDep">Déposer</button><button class="btn alt small" id="gWd">Retirer</button></div>
        ${items.map((b, i) => infos[i] ? `<div class="row2"><span class="cell r${infos[i].r}" style="width:36px;height:36px">${cellHtml(infos[i])}</span><div class="grow"><b class="rc${infos[i].r}">${esc(infos[i].name)}</b><div class="note">déposé par ${esc(b.data.by || '?')}</div></div><button class="btn small" data-wi="${b.id}">Prendre</button></div>` : '').join('') || '<div class="note">Aucun objet en banque.</div>'}
        <div class="field"><button class="btn alt small" id="gDepItem">Déposer un objet du sac…</button></div><div id="gPick"></div>`;
      $('gLeave').onclick = async () => { await store.del('gmembers', uid()); if (g.owner === uid() && members.length <= 1) await store.del('guilds', mem.gid); addChat('', 'Tu quittes la guilde.', 'info'); guild(); };
      if ($('gClaim')) $('gClaim').onclick = async () => { await store.set('gmembers', uid(), { ...meDoc.data, claimed: wk }); await give({ gold: (me.st.lvl | 0) * 60 }); addChat('', 'Récompense de guilde reçue.', 'info'); guild(); };
      $('gDep').onclick = async () => { const n = Math.floor(+$('gGold').value || 0); if (n <= 0) return; const r = await take({ gold: n }); if (!r.ok) return addChat('', "Pas assez d'or.", 'info'); await store.set('gbank', newId(), { gid: mem.gid, kind: 'gold', gold: n, by: myName }); guild(); };
      $('gWd').onclick = async () => {
        let n = Math.floor(+$('gGold').value || 0); if (n <= 0 || n > goldTotal) return addChat('', 'Montant invalide.', 'info');
        let left = n;
        for (const b of golds) { if (left <= 0) break; const v = b.data.gold | 0; await store.del('gbank', b.id); if (v > left) await store.set('gbank', newId(), { gid: mem.gid, kind: 'gold', gold: v - left, by: b.data.by }); left -= Math.min(v, left); }
        await give({ gold: n }); guild();
      };
      el.querySelectorAll('[data-wi]').forEach(b => b.onclick = async () => { const doc = await store.get('gbank', b.dataset.wi); if (!doc) return guild(); const r = await give({ items: [doc.raw] }); if (!r.ok) return addChat('', 'Ton sac est plein.', 'info'); await store.del('gbank', b.dataset.wi); guild(); });
      $('gDepItem').onclick = () => pickItem($('gPick'), async it => { const r = await take({ item: it.id }); if (!r.ok) return; await store.set('gbank', newId(), { gid: mem.gid, kind: 'item', raw: r.raw, by: myName }); guild(); });
    } catch (e) { console.error(e); err(); el.innerHTML = '<div class="note">Erreur de chargement.</div>'; }
  }
  async function guildList(el) {
    const gs = await store.list('guilds');
    el.innerHTML = `<div class="note" style="margin-bottom:6px">Rejoins une guilde ou crée la tienne : son tag s'affiche devant ton nom, et vous partagez une banque et une quête par semaine.</div>
      ${gs.length ? gs.map(g => `<div class="row2"><div class="grow"><b>${esc(g.data.name)}</b> <span class="note">[${esc(g.data.tag)}]</span></div><button class="btn small" data-join="${g.id}">Rejoindre</button></div>`).join('') : '<div class="note">Aucune guilde pour l\'instant.</div>'}
      <div class="sub2">Créer une guilde (1 000 or)</div>
      <div class="field"><input id="gName" maxlength="20" placeholder="Nom (3 à 20 lettres)"><input id="gTag" maxlength="4" placeholder="Tag" style="flex:0 0 70px"><button class="btn small" id="gCreate">Créer</button></div>`;
    el.querySelectorAll('[data-join]').forEach(b => b.onclick = async () => { await store.set('gmembers', uid(), { gid: b.dataset.join, n: myName, cls: me.cls, lvl: me.st.lvl, week: weekKey(), wk: 0, base: (P().stats || {}).kills | 0 }); addChat('', 'Bienvenue dans la guilde !', 'info'); guild(); });
    $('gCreate').onclick = async () => {
      const name = $('gName').value.trim().slice(0, 20), tag = $('gTag').value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
      if (name.length < 3 || tag.length < 2) return addChat('', 'Choisis un nom (3 lettres ou plus) et un tag (2 à 4 caractères).', 'info');
      const r = await take({ gold: 1000 }); if (!r.ok) return addChat('', 'Créer une guilde coûte 1 000 or.', 'info');
      const gid = newId();
      await store.set('guilds', gid, { name, tag, owner: uid(), at: Date.now() });
      await store.set('gmembers', uid(), { gid, n: myName, cls: me.cls, lvl: me.st.lvl, week: weekKey(), wk: 0, base: (P().stats || {}).kills | 0 });
      addChat('', `Guilde « ${name} » créée !`, 'info'); guild();
    };
  }
  let lastSync = '';
  async function syncMember(mem) {
    const kills = (P().stats || {}).kills | 0, wk = weekKey();
    const d = { ...mem, n: myName, cls: me.cls, lvl: me.st.lvl };
    if (d.week !== wk) { d.week = wk; d.base = kills; d.wk = 0; } else d.wk = Math.max(0, kills - (d.base | 0));
    const sig = JSON.stringify(d); if (sig === lastSync) return; lastSync = sig;
    await store.set('gmembers', uid(), d);
  }
  setInterval(async () => { if (!joined || !available()) return; try { const mem = await store.get('gmembers', uid()); if (mem && mem.gid) { await syncMember(mem); if (!window.RA_gtag) { const g = await store.get('guilds', mem.gid); if (g) { window.RA_gtag = g.tag; sendMsg({ t: 'setTag', tag: g.tag }); } } } } catch (e) {} }, 60000);

  function pickItem(box, cb) {
    if (!me.inv.length) { box.innerHTML = '<div class="note">Ton sac est vide.</div>'; return; }
    box.innerHTML = '<div class="note">Choisis un objet :</div><div class="grid" id="pickGrid"></div>';
    for (const it of me.inv) { const b = document.createElement('button'); b.className = 'cell r' + it.r; b.innerHTML = cellHtml(it); b.title = it.name; b.onclick = () => { box.innerHTML = ''; cb(it); }; $('pickGrid').appendChild(b); }
  }

  /* ---------- Hôtel des ventes ---------- */
  let ahTab = 'buy';
  document.querySelectorAll('[data-ah]').forEach(t => t.onclick = () => { ahTab = t.dataset.ah; document.querySelectorAll('[data-ah]').forEach(x => x.classList.toggle('on', x === t)); ah(); });
  async function ah() {
    const el = $('ahBody'); if (!available()) return unavailable(el); busy(el);
    try {
      if (ahTab === 'sell') {
        el.innerHTML = `<div class="note">Mets un objet en vente : il quitte ton sac jusqu'à ce qu'il soit acheté ou que tu le retires. Une taxe de 5 % est prélevée à la vente.</div><div class="field"><input id="ahPrice" type="number" min="1" inputmode="numeric" placeholder="Prix en or"></div><div id="ahPick"></div>`;
        pickItem($('ahPick'), async it => {
          const price = Math.floor(+$('ahPrice').value || 0); if (price < 1) { addChat('', "Indique d'abord un prix.", 'info'); return ah(); }
          const r = await take({ item: it.id }); if (!r.ok) return ah();
          await store.set('ah', newId(), { raw: r.raw, name: r.name, r: r.raw.r, s: r.raw.s, price, seller: uid(), sellerName: myName, sold: false, at: Date.now() });
          addChat('', `${r.name} mis en vente pour ${price} or.`, 'info'); ahTab = 'mine'; document.querySelectorAll('[data-ah]').forEach(x => x.classList.toggle('on', x.dataset.ah === 'mine')); ah();
        });
        return;
      }
      const all = await store.list('ah');
      if (ahTab === 'mine') {
        const mine = all.filter(d => d.data.seller === uid() && !d.data.collected);
        const infos = await describeRaw(mine.slice(0, 8).map(d => d.data.raw));
        el.innerHTML = mine.length ? mine.slice(0, 8).map((d, i) => `<div class="row2"><span class="cell r${d.data.r}" style="width:36px;height:36px">${infos[i] ? cellHtml(infos[i]) : ''}</span><div class="grow"><b class="rc${d.data.r}">${esc(d.data.name || (infos[i] || {}).name || 'Objet')}</b><div class="note">${d.data.price} or · ${d.data.sold ? `vendu à ${esc(d.data.buyerName || '?')}` : 'en vente'}</div></div>${d.data.sold ? `<button class="btn small" data-collect="${d.id}">Encaisser ${Math.floor(d.data.price * 0.95)} or</button>` : `<button class="btn alt small" data-cancel="${d.id}">Retirer</button>`}</div>`).join('') : '<div class="note">Tu n\'as rien en vente.</div>';
        el.querySelectorAll('[data-collect]').forEach(b => b.onclick = async () => { const d = await store.get('ah', b.dataset.collect); if (!d || !d.sold || d.collected) return ah(); await store.del('ah', b.dataset.collect); await give({ gold: Math.floor(d.price * 0.95) }); ah(); });
        el.querySelectorAll('[data-cancel]').forEach(b => b.onclick = async () => { const d = await store.get('ah', b.dataset.cancel); if (!d || d.sold) return ah(); const r = await give({ items: [d.raw] }); if (!r.ok) return addChat('', 'Ton sac est plein.', 'info'); await store.del('ah', b.dataset.cancel); ah(); });
        return;
      }
      const list = all.filter(d => !d.data.sold).sort((a, b) => (b.data.at | 0) - (a.data.at | 0)).slice(0, 24);
      const infos = []; for (let i = 0; i < list.length; i += 8) infos.push(...await describeRaw(list.slice(i, i + 8).map(d => d.data.raw)));
      el.innerHTML = list.length ? list.map((d, i) => { const it = infos[i]; if (!it) return '';
        return `<div class="row2"><span class="cell r${it.r}" style="width:36px;height:36px">${cellHtml(it)}</span><div class="grow"><b class="rc${it.r}">${esc(it.name)}</b><div class="note">${RAR_NAMES[it.r]} · ${statLine(it.st)} · par ${esc(d.data.sellerName || '?')}</div></div>${d.data.seller === uid() ? '<span class="note">à toi</span>' : `<button class="btn small" data-buy="${d.id}"${me.st.gold >= d.data.price ? '' : ' disabled'}>${d.data.price} or</button>`}</div>`; }).join('') : '<div class="note">Rien en vente pour l\'instant.</div>';
      el.querySelectorAll('[data-buy]').forEach(b => b.onclick = async () => {
        b.disabled = true;
        const d = await store.get('ah', b.dataset.buy); if (!d || d.sold) { addChat('', 'Cet objet vient d\'être vendu.', 'info'); return ah(); }
        if (me.inv.length >= INV_SIZE) return addChat('', 'Ton sac est plein.', 'info');
        const r = await take({ gold: d.price }); if (!r.ok) return addChat('', "Pas assez d'or.", 'info');
        await store.set('ah', b.dataset.buy, { ...d, sold: true, buyer: uid(), buyerName: myName });
        await give({ items: [d.raw] }); addChat('', `Acheté : ${d.name || 'objet'}.`, 'info'); Snd.play('coin'); ah();
      });
    } catch (e) { console.error(e); err(); el.innerHTML = '<div class="note">Erreur de chargement.</div>'; }
  }

  /* ---------- Arène ---------- */
  let arenaOpp = null;
  async function publishChampion() {
    const old = await store.get('arena', uid());
    const doc = { n: myName, cls: me.cls, lvl: me.st.lvl, hp: me.st.mhp, dmg: me.st.dmg, def: me.st.def, crit: me.st.crit, rating: old ? old.rating | 0 : 1000, w: old ? old.w | 0 : 0, l: old ? old.l | 0 : 0, at: Date.now() };
    await store.set('arena', uid(), doc); return doc;
  }
  async function arena() {
    const el = $('arenaBody'); if (!available()) return unavailable(el); busy(el);
    try {
      const mine = await publishChampion();
      const all = (await store.list('arena')).filter(d => d.id !== uid());
      const opps = all.sort((a, b) => Math.abs(a.data.rating - mine.rating) - Math.abs(b.data.rating - mine.rating)).slice(0, 5);
      const top = [{ id: uid(), data: mine }, ...all].sort((a, b) => b.data.rating - a.data.rating).slice(0, 10);
      el.innerHTML = `<div class="row2 done"><div class="grow"><b>Ta cote : ${mine.rating}</b><div class="note">${mine.w} victoires · ${mine.l} défaites. Tu affrontes une copie des autres joueurs, contrôlée par le jeu : +25 points par victoire, −15 par défaite.</div></div></div>
        <div class="sub2">Adversaires à ta mesure</div>${opps.length ? opps.map(o => `<div class="row2"><div class="grow"><b>${esc(o.data.n)}</b> <span class="note">${esc((CLASSES[o.data.cls] || {}).name || '')} · niv. ${o.data.lvl | 0} · cote ${o.data.rating | 0}</span></div><button class="btn small" data-duel="${o.id}">Défier</button></div>`).join('') : '<div class="note">Aucun autre champion inscrit pour l\'instant.</div>'}
        <div class="field"><button class="btn alt small" id="arTrain">S'entraîner contre ton reflet (sans cote)</button></div>
        <div class="sub2">Classement</div>${top.map((o, i) => `<div class="li" style="margin-bottom:4px"><span class="rank">${i + 1}</span><span class="grow">${esc(o.data.n)}${o.id === uid() ? ' (toi)' : ''}</span><span class="note">${o.data.rating | 0}</span></div>`).join('')}`;
      el.querySelectorAll('[data-duel]').forEach(b => b.onclick = () => { const o = all.find(x => x.id === b.dataset.duel); if (!o) return; arenaOpp = { id: o.id, rated: true }; sendMsg({ t: 'arenaStart', opp: o.data }); closePanels(); });
      $('arTrain').onclick = () => { arenaOpp = { rated: false }; sendMsg({ t: 'arenaStart', opp: { ...mine, n: 'Ton reflet' } }); closePanels(); };
    } catch (e) { console.error(e); err(); el.innerHTML = '<div class="note">Erreur de chargement.</div>'; }
  }
  async function arenaResult(win) {
    if (!arenaOpp || !arenaOpp.rated || !available()) { arenaOpp = null; return; }
    arenaOpp = null;
    try { const d = await store.get('arena', uid()) || {}; await store.set('arena', uid(), { ...d, rating: Math.max(0, (d.rating | 0 || 1000) + (win ? 25 : -15)), w: (d.w | 0) + (win ? 1 : 0), l: (d.l | 0) + (win ? 0 : 1), at: Date.now() }); } catch (e) {}
  }
  return { answer, guild, ah, arena, arenaResult };
})();

// API pour la couche « présence partagée » de la version jouable dans Claude
window.RA = { get NPCS() { return NPCS; }, get ZONES() { return ZONES; }, me, input, sendMsg, addChat, showAsk, describe, renderTrade, closeTradeUI, renderSocial, renderParty, emotes, Snd, isDarkZone,
  get trade() { return trade; }, set trade(v) { trade = v; }, get myName() { return myName; }, get joined() { return joined; }, get WORLD_H() { return WORLD_H; }, get W() { return W; }, get myVis() { const e = ents.get(myId); return e ? e.vis || '' : ''; }, dbg: { heroSprite, PAL, wpnSprite, bowSprite, STYLE_OF, mountSprite, drawHero2Preview, monsterSprite, MT: () => MT } };

connect();
requestAnimationFrame(loop);
/* ===== Fabrication d'équipement ===== */
var gc = { s: 'armure', r: 1, si: 0 };
const GEAR_COST_C = [null, { fer: 6, frag: 10 }, { fer: 12, herbe: 6, frag: 30 }, { fer: 25, herbe: 12, fleur: 4, frag: 80 }, { fer: 50, herbe: 25, fleur: 10, truite: 3, frag: 200 }];
function gearCraftHtml(pr) {
  if (!ITEMDEF || !me.st) return '';
  const pl = me.st.pl || 1, mul = 1 + Math.floor(pl / 100), need = GEAR_COST_C[gc.r], gold = Math.round(50 * gc.r * gc.r * (1 + pl / 10));
  const sl = ITEMDEF.suffix[gc.r] || []; if (gc.si >= sl.length) gc.si = 0;
  const mineLvl = (pr.prof && pr.prof.mine) ? pr.prof.mine.lvl : 1, okMine = mineLvl >= gc.r * 5;
  const okMats = Object.entries(need).every(([k, n]) => (pr.mat[k] || 0) >= n * mul), okGold = (me.st.gold || 0) >= gold;
  const stat = (ITEMDEF.setStat[gc.r] || [])[gc.si];
  let h = `<div class="sub2">Forge d'équipement</div><div class="note">Fabrique une pièce de panoplie précise, à ton niveau de puissance (${pl}). Les raretés supérieures demandent un meilleur niveau de Minage.</div>`;
  h += `<div class="chips">${ITEMDEF.slots.map(k => `<button class="chip${gc.s === k ? ' on' : ''}" data-gs="${k}">${esc(SLOT_NAMES[k] || k)}</button>`).join('')}</div>`;
  h += `<div class="chips">${[1, 2, 3, 4].map(r => `<button class="chip${gc.r === r ? ' on' : ''}" data-gr="${r}" style="color:${RAR_COL[r] || '#fff'}">${esc(RAR_NAMES[r] || r)}</button>`).join('')}</div>`;
  h += `<div class="chips">${sl.map((n, i) => `<button class="chip${gc.si === i ? ' on' : ''}" data-gi="${i}">${esc(n)}</button>`).join('')}</div>`;
  h += `<div class="row2"><div class="grow"><b style="color:${RAR_COL[gc.r] || '#fff'}">${esc(SLOT_NAMES[gc.s] || gc.s)} ${esc(sl[gc.si] || '')}</b>${stat ? ` <span class="note">(panoplie : ${esc(STAT_LABEL[stat] || stat)})</span>` : ''}<div class="note">${Object.entries(need).map(([k, n]) => `${n * mul} ${esc(matName(k))} (${pr.mat[k] || 0})`).join(' + ')} + ${gold} or · Minage ${gc.r * 5}${okMine ? '' : ' ✗'}</div></div><button class="btn small" id="gcGo"${okMats && okGold && okMine ? '' : ' disabled'}>Forger</button></div>`;
  return h;
}

/* ===== Bestiaire ===== */
var bestZone = -1;
function renderBestiary() {
  if ($('bestiary').hidden || !me.st) return;
  const st = P().stats || {};
  const groups = [{ k: -1, name: 'Royaume d\'Ambre', types: Object.keys(MT).filter(t => !/^z\d+_/.test(t) && !MT[t].scaled && t !== 'dragon') }];
  for (const z of ZONES) groups.push({ k: z.k, name: z.name, lv: z.lv, types: ['0', '1', '2', 'B'].map(j => `z${z.k}_${j}`).filter(t => MT[t]) });
  let studied = 0, mastered = 0, total = 0;
  for (const g of groups) for (const t of g.types) { total++; const n = st['k_' + t] || 0; if (n >= 25) studied++; if (n >= 100) mastered++; }
  const pl = me.st.pl || 1;
  let h = `<div class="note" style="margin-bottom:6px"><b>${studied}</b> / ${total} espèces étudiées (25 victoires : or) · <b>${mastered}</b> maîtrisées (100 victoires : +0,1 % de dégâts chacune, soit +${(mastered * 0.1).toFixed(1)} %)</div>`;
  h += `<div class="chips" style="max-height:72px;overflow:auto">${groups.filter(g => g.k < 0 || g.lv[0] <= pl + 40).map(g => `<button class="chip${bestZone === g.k ? ' on' : ''}" data-bz="${g.k}">${esc(g.k < 0 ? 'Royaume' : g.name.split(' ')[0] + ' ' + g.lv[0])}</button>`).join('')}</div>`;
  const g = groups.find(q => q.k === bestZone) || groups[0];
  h += `<div class="sub2">${esc(g.name)}${g.lv ? ` <span class="note">niv. ${g.lv[0]}-${g.lv[1]}</span>` : ''}</div><div class="list">` + g.types.map(t => {
    const m = MT[t], n = st['k_' + t] || 0, stt = n >= 100 ? '<span style="color:#ffd23a">Maîtrisé</span>' : n >= 25 ? '<span style="color:#9fd38a">Étudié</span>' : n ? 'Rencontré' : '<span class="note">Inconnu</span>';
    const nm = n ? m.name : '???';
    return `<div class="li"><canvas class="bico" data-bt="${t}" width="44" height="40"></canvas><span class="grow"><b>${esc(nm)}</b>${m.boss ? ' <span class="note">boss</span>' : ''}<br><span class="note">niv. ${m.lvl} · ${n} victoire${n > 1 ? 's' : ''} · </span>${stt}<div class="pbar"><i style="width:${Math.min(100, n)}%"></i></div></span></div>`;
  }).join('') + '</div>';
  $('bestBody').innerHTML = h;
  $('bestBody').querySelectorAll('[data-bz]').forEach(b => b.onclick = () => { bestZone = +b.dataset.bz; renderBestiary(); });
  $('bestBody').querySelectorAll('[data-bt]').forEach(c => {
    const t = c.dataset.bt, m = MT[t], n = st['k_' + t] || 0, g2 = c.getContext('2d');
    try { const img = monsterSprite(specOf(t), 3, 0, false, false); if (img) { g2.imageSmoothingEnabled = false; if (!n) g2.filter = 'brightness(0)'; g2.drawImage(img, 0, 0, 44, 40); } } catch (e) { }
  });
}

/* ===== Carte du monde ===== */
function renderWmap() {
  if ($('wmap').hidden || !miniBase) return;
  const cv = $('wmapCv'), box = cv.parentElement.getBoundingClientRect();
  const sc = Math.max(3, box.width / W), hh = WORLD_H;
  cv.width = Math.round(W * sc); cv.height = Math.round(hh * sc);
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  g.drawImage(miniBase, 0, 0, W, hh, 0, 0, cv.width, cv.height);
  const pl = me.st ? me.st.pl || 1 : 1, known = new Set((me.st && me.st.wps) || []);
  g.font = `${Math.max(8, Math.round(sc * 4))}px 'Pixelify Sans', monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const z of ZONES) {
    const x = z.x0 * sc, y = z.y0 * sc, w = (z.x1 - z.x0) * sc, h2 = (z.y1 - z.y0) * sc, lock = z.lv[0] > pl + 20;
    if (lock) { g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(x, y, w, h2); }
    g.strokeStyle = 'rgba(255,230,180,.35)'; g.strokeRect(x + 0.5, y + 0.5, w - 1, h2 - 1);
    if (sc >= 1.2) { g.fillStyle = lock ? '#887' : '#ffe8b0'; g.fillText(z.name.split(' ')[0], x + w / 2, y + h2 / 2 - 7); g.fillText(`${z.lv[0]}-${z.lv[1]}`, x + w / 2, y + h2 / 2 + 7); }
  }
  for (const w of WAYPOINTS) { g.fillStyle = known.has(w.id) ? '#5ad0ff' : '#555'; g.fillRect(w.x * sc - 2, w.y * sc - 2, 4, 4); }
  for (const n of NPCS) if (n.kind === 'dungeon') { g.fillStyle = '#c070ff'; g.fillRect(n.x * sc - 2, n.y * sc - 2, 4, 4); }
  if (me.has) { g.fillStyle = '#fff'; g.beginPath(); g.arc(me.lx * sc, me.ly * sc, 3.5, 0, 7); g.fill(); g.strokeStyle = '#d33'; g.lineWidth = 1.5; g.stroke(); }
  const wrap = cv.parentElement; if (me.has && !wrap._centered) { wrap._centered = 1; wrap.scrollLeft = me.lx * sc - wrap.clientWidth / 2; wrap.scrollTop = me.ly * sc - wrap.clientHeight / 2; }
  cv.onclick = e => {
    const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / sc * (cv.width / r.width), y = (e.clientY - r.top) / sc * (cv.height / r.height);
    let best = null, bd = 1e9; for (const w of WAYPOINTS) { if (!known.has(w.id)) continue; const d = Math.hypot(w.x - x, w.y - y); if (d < bd) { bd = d; best = w; } }
    const z = ZONES.find(q => x >= q.x0 && x <= q.x1 && y >= q.y0 && y <= q.y1);
    $('wmapInfo').innerHTML = (z ? `<b>${esc(z.name)}</b> · niv. ${z.lv[0]}-${z.lv[1]}` : '<b>Royaume d\'Ambre</b>') + (best ? ` · <button class="btn small" id="wmTp">Aller à ${esc(best.name)}</button>` : '');
    const b = $('wmTp'); if (b) b.onclick = () => { sendMsg({ t: 'wptp', id: best.id }); $('wmap').hidden = true; cancelAuto(); };
  };
}

/* ===== Journal de combat ===== */
var clog = [];
function pushLog(t, c) { clog.push({ t, c, at: Date.now() }); if (clog.length > 120) clog.shift(); if (!$('clog').hidden) renderClog(); }
var clogT = 0;
function logFx(f) {
  if (f.k !== 'hit' && f.k !== 'absorb') return;
  if (f.k === 'hit' && f.on === 'm' && f.by === myId) pushLog(`Tu infliges ${f.v}${f.c ? ' (critique)' : ''}`, 'out');
  else if (f.k === 'hit' && f.on === 'p' && f.id === myId) pushLog(`Tu subis ${f.v}`, 'in');
}
function renderClog() {
  if ($('clog').hidden) return;
  const now = performance.now(); if (now - clogT < 250) return; clogT = now;
  const recent = clog.filter(l => Date.now() - l.at < 10000);
  const dOut = recent.filter(l => l.c === 'out').reduce((a, l) => a + (parseInt(l.t.replace(/\D+/g, ' ').trim()) || 0), 0);
  $('clogSum').textContent = `Dégâts infligés sur 10 s : ${dOut} (${Math.round(dOut / 10)} / s)`;
  $('clogBody').innerHTML = clog.slice(-60).reverse().map(l => `<div class="cl ${l.c}">${esc(l.t)}</div>`).join('');
}

/* ===== Réglages ===== */
var fxLow = false, showDmg = true;
try { fxLow = localStorage.getItem('ra_fxlow') === '1'; showDmg = localStorage.getItem('ra_dmgtxt') !== '0'; } catch (e) { }
function renderSettings() {
  const opt = (id, on, label, note) => `<div class="row2"><div class="grow"><b>${label}</b><div class="note">${note}</div></div><button class="btn small${on ? '' : ' alt'}" id="${id}">${on ? 'Activé' : 'Désactivé'}</button></div>`;
  $('setBody').innerHTML = opt('stLow', fxLow, 'Mode économie', 'Moins de particules et pas d\'auras de prestige : plus fluide sur les vieux téléphones.') +
    opt('stDmg', showDmg, 'Chiffres de dégâts', 'Affiche les dégâts au-dessus des cibles.') +
    opt('stSnd', !!(window.Snd && Snd.on), 'Sons', 'Effets sonores du jeu (touche M).');
  $('stLow').onclick = () => { fxLow = !fxLow; try { localStorage.setItem('ra_fxlow', fxLow ? '1' : '0'); } catch (e) { } renderSettings(); };
  $('stDmg').onclick = () => { showDmg = !showDmg; try { localStorage.setItem('ra_dmgtxt', showDmg ? '1' : '0'); } catch (e) { } renderSettings(); };
  $('stSnd').onclick = () => { Snd.toggle(); updSnd(); renderSettings(); };
}

})();

// MMODD — serveur MMO 2D (Node.js, aucune dépendance)
// Lancer : node server.js   puis ouvrir http://localhost:3000
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

const PORT = process.env.PORT || 3000;
const PUB = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const SAVE = path.join(DATA_DIR, 'save.json');

// --- Stockage et encodage (remplacés dans la version navigateur) ---
// sauvegarde atomique (fichier temporaire puis renommage) et copie de secours toutes les 10 minutes
function storeLoad() {
  for (const f of [SAVE, SAVE + '.bak']) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { if (f === SAVE && fs.existsSync(SAVE)) console.error('sauvegarde illisible, essai de la copie de secours'); } }
  return {};
}
let lastBak = 0;
function storeSave(o) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    cloudMark('saves', o);
    const tmp = SAVE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(o)); fs.renameSync(tmp, SAVE);
    if (Date.now() - lastBak > 600000) { lastBak = Date.now(); fs.copyFileSync(SAVE, SAVE + '.bak'); }
  } catch (e) { console.error('save', e.message); }
}
// --- Sauvegarde dans le nuage (facultative) : base Redis gratuite Upstash ---
// Sur un hébergeur gratuit (Render…), le disque est effacé à chaque redémarrage.
// Si UPSTASH_REDIS_REST_URL et UPSTASH_REDIS_REST_TOKEN sont définis, les sauvegardes y sont aussi copiées.
const CLOUD = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN ? { url: process.env.UPSTASH_REDIS_REST_URL.replace(/\/$/, ''), tok: process.env.UPSTASH_REDIS_REST_TOKEN } : null;
const cloudDirty = new Map();
async function cloudGet(key) {
  if (!CLOUD) return null;
  try {
    const r = await fetch(`${CLOUD.url}/get/ra_${key}`, { headers: { Authorization: 'Bearer ' + CLOUD.tok } });
    const j = await r.json(); if (!j.result) return null;
    return JSON.parse(zlib.gunzipSync(Buffer.from(j.result, 'base64')).toString('utf8'));
  } catch (e) { console.error('nuage (lecture)', e.message); return null; }
}
async function cloudPut(key, obj) {
  try {
    const body = zlib.gzipSync(JSON.stringify(obj)).toString('base64');
    const r = await fetch(`${CLOUD.url}/set/ra_${key}`, { method: 'POST', headers: { Authorization: 'Bearer ' + CLOUD.tok }, body });
    if (!r.ok) console.error('nuage (écriture)', r.status);
  } catch (e) { console.error('nuage (écriture)', e.message); }
}
function cloudMark(key, obj) { if (CLOUD) cloudDirty.set(key, obj); }
async function cloudFlush() { const all = [...cloudDirty]; cloudDirty.clear(); for (const [k, o] of all) await cloudPut(k, o); }
if (CLOUD) setInterval(cloudFlush, 30000);
function toB64(u8) { return Buffer.from(u8).toString('base64'); }
const LOCAL = false; // true dans la version jouable dans Claude (monde local à un joueur)

/* ============================================================
   Mini WebSocket (RFC 6455)
   ============================================================ */
function upgradeToWS(req, socket) {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return null; }
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  socket.setNoDelay(true);
  const ws = { open: true, onmessage: null, onclose: null };
  let buf = Buffer.alloc(0), frags = [];
  function frame(op, data) {
    if (!ws.open || socket.destroyed) return;
    if (socket.writableLength > 2e6) return;
    const len = data.length; let h;
    if (len < 126) h = Buffer.from([0x80 | op, len]);
    else if (len < 65536) { h = Buffer.alloc(4); h[0] = 0x80 | op; h[1] = 126; h.writeUInt16BE(len, 2); }
    else { h = Buffer.alloc(10); h[0] = 0x80 | op; h[1] = 127; h.writeBigUInt64BE(BigInt(len), 2); }
    socket.write(Buffer.concat([h, data]));
  }
  function close() {
    if (!ws.open) return;
    try { frame(8, Buffer.alloc(0)); } catch (e) {}
    ws.open = false; socket.end();
    if (ws.onclose) ws.onclose();
  }
  ws.send = s => frame(1, Buffer.from(s));
  ws.close = close;
  socket.on('data', d => {
    buf = Buffer.concat([buf, d]);
    while (buf.length >= 2) {
      const b0 = buf[0], b1 = buf[1], fin = b0 & 0x80, op = b0 & 15, masked = b1 & 0x80;
      let len = b1 & 127, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      if (len > 65536) { socket.destroy(); return; }
      const mOff = off; if (masked) off += 4;
      if (buf.length < off + len) return;
      let p = Buffer.from(buf.subarray(off, off + len));
      if (masked) { const m = buf.subarray(mOff, mOff + 4); for (let i = 0; i < p.length; i++) p[i] ^= m[i & 3]; }
      buf = buf.subarray(off + len);
      if (op === 8) { close(); return; }
      if (op === 9) { frame(10, p); continue; }
      if (op === 10) continue;
      frags.push(p);
      if (fin) {
        const msg = Buffer.concat(frags).toString('utf8'); frags = [];
        if (ws.onmessage) { try { ws.onmessage(msg); } catch (e) { console.error(e); } }
      }
    }
  });
  socket.on('close', () => { if (ws.open) { ws.open = false; if (ws.onclose) ws.onclose(); } });
  socket.on('error', () => {});
  return ws;
}

/* ===== ENGINE START ===== */
/* ============================================================
   Carte
   ============================================================ */
const KW = 96, ZW = 48, ZH = 52, ZCOLS = 25; // royaume d'origine + 49 régions de 48×52 cases
const W = KW + ZCOLS * ZW, H = 130, WORLD_H = 104;
const T = { GRASS: 0, TREE: 1, WATER: 2, PATH: 3, STONE: 4, WALL: 5, FLOWER: 6, DGRASS: 7, DFLOOR: 8, DWALL: 9, ROOF: 10,
  SAND: 11, DOOR: 12, PILLAR: 13, MARSH: 14, BOG: 15, REED: 16, MFLOOR: 17, MWALL: 18, CRYSTAL: 19, AFLOOR: 20,
  SNOW: 21, ICE: 22, ASH: 23, LAVA: 24, VOID: 25, CACTUS: 26, ROCK: 27, DEADTREE: 28, PINE: 29, DECO: 30, DECOS: 31 };
const SOLID = new Set([T.TREE, T.WATER, T.WALL, T.DWALL, T.ROOF, T.DOOR, T.PILLAR, T.BOG, T.MWALL, T.CRYSTAL, T.ICE, T.LAVA, T.CACTUS, T.ROCK, T.DEADTREE, T.PINE, T.DECOS]);

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const map = new Uint8Array(W * H);
function setT(x, y, t) { if (x >= 0 && y >= 0 && x < W && y < H) map[y * W + x] = t; }
function getT(x, y) { if (x < 0 || y < 0 || x >= W || y >= H) return T.TREE; return map[y * W + x]; }
const ARENA = { x0: 34, y0: 107, x1: 62, y1: 127 };

/* ---------- Régions : une tous les 20 niveaux, jusqu'au niveau 1000 ---------- */
const BIOMES = [
  { name: 'Steppes', ground: [[T.GRASS, 0.82], [T.FLOWER, 0.1], [T.DGRASS, 0.08]], obst: [T.ROCK, T.TREE], od: 0.05, pool: T.WATER, path: T.PATH,
    mobs: [{ n: 'Loup des steppes', base: 'loup', tint: [35, 0.35] }, { n: 'Bison sauvage', base: 'sanglier', tint: [25, 0.45], size: 1.3 }, { n: 'Pillard squelette', base: 'squelette', tint: [30, 0.18] }],
    boss: { n: 'Khan des steppes', base: 'gardien', tint: [18, 0.6], size: 2 } },
  { name: 'Dunes', ground: [[T.SAND, 1]], obst: [T.CACTUS, T.ROCK], od: 0.045, pool: T.WATER, poolN: 2, path: T.PATH,
    mobs: [{ n: 'Scorpion des sables', base: 'araignee', tint: [40, 0.7, 0.25] }, { n: 'Hyène rieuse', base: 'loup', tint: [38, 0.45] }, { n: 'Momie', base: 'squelette', tint: [44, 0.3] }],
    boss: { n: 'Pharaon maudit', base: 'roi', tint: [46, 0.75], size: 2 } },
  { name: 'Sylves', ground: [[T.DGRASS, 0.7], [T.GRASS, 0.3]], obst: [T.TREE], od: 0.17, pool: T.WATER, path: T.PATH,
    mobs: [{ n: 'Loup sylvestre', base: 'loupnoir', tint: [110, 0.35, 0.15] }, { n: 'Tisseuse', base: 'araignee', tint: [285, 0.5, 0.1] }, { n: 'Esprit des bois', base: 'spectre', tint: [100, 0.5] }],
    boss: { n: 'Sylvain corrompu', base: 'golemroi', tint: [95, 0.45], size: 2.2 } },
  { name: 'Fanges', ground: [[T.MARSH, 0.88], [T.REED, 0.12]], obst: [T.DEADTREE], od: 0.05, pool: T.BOG, poolN: 9, path: T.PATH,
    mobs: [{ n: 'Sanglier des fanges', base: 'sanglier', tint: [80, 0.35] }, { n: 'Araignée des tourbières', base: 'araignee', tint: [120, 0.45, 0.1] }, { n: 'Noyé', base: 'ombre', tint: [170, 0.45, 0.15] }],
    boss: { n: 'Hydre des fanges', base: 'dragon', tint: [110, 0.55], size: 1.6 } },
  { name: 'Toundras', ground: [[T.SNOW, 1]], obst: [T.PINE, T.PINE, T.ROCK], od: 0.08, pool: T.ICE, path: T.PATH,
    mobs: [{ n: 'Loup des neiges', base: 'loup', tint: [205, 0.15, 0.45] }, { n: 'Ours polaire', base: 'ours', tint: [200, 0.12, 0.75], size: 1.3 }, { n: 'Golem de givre', base: 'golem', tint: [195, 0.45, 0.3], size: 1.3 }],
    boss: { n: 'Géant de givre', base: 'golemroi', tint: [190, 0.5, 0.25], size: 2.4 } },
  { name: 'Brasiers', ground: [[T.ASH, 1]], obst: [T.ROCK, T.DEADTREE], od: 0.06, pool: T.LAVA, poolN: 6, path: T.MFLOOR,
    mobs: [{ n: 'Salamandre', base: 'loupnoir', tint: [12, 0.75, 0.3] }, { n: 'Golem de magma', base: 'golem', tint: [15, 0.7], size: 1.3 }, { n: 'Diablotin', base: 'gardien', tint: [355, 0.7] }],
    boss: { n: 'Dragon de lave', base: 'dragon', tint: [8, 0.85], size: 2 } },
  { name: 'Abysses', ground: [[T.VOID, 1]], obst: [T.CRYSTAL, T.PILLAR], od: 0.05, pool: T.BOG, poolN: 0, path: T.DFLOOR,
    mobs: [{ n: 'Ombre abyssale', base: 'ombre', tint: [265, 0.6, 0.1] }, { n: 'Spectre du néant', base: 'spectre', tint: [285, 0.55] }, { n: 'Arachnide du vide', base: 'araignee', tint: [250, 0.6, 0.15] }],
    boss: { n: 'Seigneur du Néant', base: 'gardien', tint: [275, 0.7], size: 2.3 } },
];
// Espèces uniques par région : [nom, gabarit] ; 3 espèces par palier et un boss par région
const SPECIES = [
  { n: [['Loup des steppes', 'wolf'], ['Bison sauvage', 'bison'], ['Pillard squelette', 'skeleton'], ['Renard roux', 'fox'], ['Gobelin chapardeur', 'goblin'], ['Vautour charognard', 'vulture'],
    ['Bélier des collines', 'ram'], ['Hyène tachetée', 'hyena'], ['Orc éclaireur', 'orc'], ['Serpent des herbes', 'snake'], ['Lynx doré', 'cat'], ['Frelon géant', 'wasp'],
    ['Rhinocéros cuirassé', 'rhino'], ['Chaman gobelin', 'shaman'], ['Feu follet des prés', 'wisp'], ['Ours des collines', 'bear'], ['Mante des herbes', 'mantis'], ['Brute orque', 'brute'],
    ['Chevalier déchu', 'knight'], ['Taureau ardent', 'bison'], ['Gelée des prairies', 'slime']],
    b: [['Khan des steppes', 'brute'], ['Roi gobelin', 'goblin'], ["Grand Bélier d'airain", 'ram'], ['Reine des frelons', 'wasp'], ['Mammouth ancestral', 'mammoth'], ['Seigneur orque', 'orc'], ['Dragon des plaines', 'dragon']] },
  { n: [['Scorpion des sables', 'scorpion'], ['Hyène rieuse', 'hyena'], ['Momie', 'mummy'], ['Vipère des dunes', 'snake'], ['Chacal', 'fox'], ['Scarabée doré', 'beetle'],
    ['Ver des sables', 'worm'], ['Pillard du désert', 'bandit'], ['Vautour du désert', 'vulture'], ['Lézard cornu', 'lizard'], ['Djinn mineur', 'wisp'], ['Fourmi soldat', 'ant'],
    ['Gardien momifié', 'mummy'], ['Basilic', 'lizard'], ['Élémentaire de sable', 'elemental'], ['Sphinx mineur', 'cat'], ["Scorpion d'obsidienne", 'scorpion'], ['Prêtre maudit', 'cultist'],
    ['Golem de grès', 'golem'], ['Serpent ailé', 'wyvern'], ['Mirage vivant', 'wisp']],
    b: [['Pharaon maudit', 'lich'], ['Reine scarabée', 'beetle'], ['Ver colossal', 'worm'], ['Basilic royal', 'lizard'], ['Sphinx gardien', 'cat'], ['Seigneur des sables', 'elemental'], ['Wyrm du désert', 'dragon']] },
  { n: [['Loup sylvestre', 'wolf'], ['Tisseuse', 'spider'], ['Esprit des bois', 'wisp'], ['Champignon errant', 'shroom'], ['Lynx des ombres', 'cat'], ['Hibou géant', 'owl'],
    ['Sanglier moussu', 'boar'], ['Gobelin des bois', 'goblin'], ['Araignée bondissante', 'spider'], ['Cerf corrompu', 'deer'], ['Dryade sombre', 'cultist'], ['Chauve-souris géante', 'bat'],
    ['Ours-hibou', 'bear'], ['Sylvain', 'treant'], ['Mante sylvestre', 'mantis'], ['Loup-garou', 'werewolf'], ['Vouivre', 'wyvern'], ['Spore vivante', 'slime'],
    ["Sentinelle d'écorce", 'treant'], ['Fée corrompue', 'moth'], ['Cauchemar sylvestre', 'hound']],
    b: [['Sylvain corrompu', 'treant'], ['Reine tisseuse', 'spider'], ['Grand Cerf blanc', 'deer'], ['Ours-hibou ancestral', 'bear'], ['Roi des champignons', 'shroom'], ['Seigneur loup-garou', 'werewolf'], ['Dragon sylvestre', 'dragon']] },
  { n: [['Sanglier des fanges', 'boar'], ['Araignée des tourbières', 'spider'], ['Noyé', 'zombie'], ['Crapaud géant', 'toad'], ['Sangsue géante', 'worm'], ['Moustique géant', 'wasp'],
    ['Homme-grenouille', 'frogman'], ['Crocodile des marais', 'croc'], ['Feu follet', 'wisp'], ["Serpent d'eau", 'snake'], ['Sorcière des marais', 'cultist'], ['Limon toxique', 'slime'],
    ['Anguille électrique', 'snake'], ['Tortue vaseuse', 'tortoise'], ['Homme-lézard', 'lizardman'], ['Goule', 'zombie'], ['Libellule de jade', 'moth'], ['Hydre mineure', 'lizard'],
    ['Chaman des fanges', 'shaman'], ['Crocodile titan', 'croc'], ['Spectre noyé', 'specter']],
    b: [['Hydre des fanges', 'hydra'], ['Reine crapaud', 'toad'], ['Grand Crocodile', 'croc'], ['Sorcière ancestrale', 'lich'], ['Tortue-montagne', 'tortoise'], ['Roi lézard', 'lizardman'], ['Dragon des marais', 'dragon']] },
  { n: [['Loup des neiges', 'wolf'], ['Ours polaire', 'bear'], ['Golem de givre', 'golem'], ['Renard polaire', 'fox'], ['Yéti', 'yeti'], ['Harfang', 'owl'],
    ['Bélier des glaces', 'ram'], ['Élémentaire de glace', 'elemental'], ['Morse', 'boar'], ['Mammouth laineux', 'mammoth'], ['Spectre glacé', 'specter'], ['Lynx des neiges', 'cat'],
    ['Guerrier gelé', 'knight'], ['Ver des glaces', 'worm'], ['Gelée de givre', 'slime'], ['Tigre à dents de sabre', 'cat'], ['Géant du froid', 'brute'], ['Feu follet bleu', 'wisp'],
    ['Chevalier de glace', 'knight'], ['Wyverne blanche', 'wyvern'], ['Chaman des neiges', 'shaman']],
    b: [['Géant de givre', 'golem'], ['Reine des neiges', 'lich'], ['Mammouth roi', 'mammoth'], ['Yéti ancestral', 'yeti'], ['Ver des glaces colossal', 'worm'], ['Tigre spectral', 'cat'], ['Dragon de givre', 'dragon']] },
  { n: [['Salamandre', 'lizard'], ['Golem de magma', 'golem'], ['Diablotin', 'imp'], ["Chien de l'enfer", 'hound'], ['Chauve-souris de cendre', 'bat'], ['Limon de lave', 'slime'],
    ['Scorpion de feu', 'scorpion'], ['Cultiste des flammes', 'cultist'], ['Élémentaire de feu', 'elemental'], ['Ver de magma', 'worm'], ['Démon cornu', 'demon'], ['Phénix mineur', 'vulture'],
    ['Rhinocéros de lave', 'rhino'], ['Squelette calciné', 'skeleton'], ['Feu follet ardent', 'wisp'], ['Salamandre géante', 'lizard'], ['Chevalier infernal', 'knight'], ['Guêpe de braise', 'wasp'],
    ['Seigneur démon', 'demon'], ['Wyverne de feu', 'wyvern'], ['Tortue volcanique', 'tortoise']],
    b: [['Dragon de lave', 'dragon'], ['Roi des diablotins', 'imp'], ['Golem du volcan', 'golem'], ['Grand prêtre du feu', 'lich'], ['Phénix', 'vulture'], ['Archidémon', 'demon'], ['Ancêtre des flammes', 'dragon']] },
  { n: [['Ombre abyssale', 'specter'], ['Spectre du néant', 'specter'], ['Arachnide du vide', 'spider'], ['Œil flottant', 'eye'], ['Rôdeur du vide', 'hound'], ['Tentacule', 'worm'],
    ['Cultiste du néant', 'cultist'], ['Gelée astrale', 'slime'], ['Raie du vide', 'moth'], ['Horreur rampante', 'mantis'], ['Chevalier creux', 'knight'], ['Feu follet violet', 'wisp'],
    ['Golem de cristal', 'golem'], ['Liche mineure', 'lich'], ['Ver du néant', 'worm'], ['Démon du vide', 'demon'], ["Œil de l'abîme", 'eye'], ['Faucheur', 'specter'],
    ['Béhémoth', 'rhino'], ['Gardien astral', 'knight'], ['Sentinelle du néant', 'eye']],
    b: [['Seigneur du Néant', 'demon'], ['Mère des yeux', 'eye'], ['Reine du vide', 'spider'], ['Liche ancestrale', 'lich'], ['Colosse de cristal', 'golem'], ['Faucheur primordial', 'specter'], ['Dragon du néant', 'dragon']] },
];
const KIND_INFO = { // vitesse et taille de base de chaque gabarit
  wolf: [3.0, 1], fox: [3.2, 0.9], hyena: [3.0, 1], boar: [2.6, 1.05], bison: [2.4, 1.2], bear: [2.4, 1.2], cat: [3.3, 1], ram: [2.7, 1.05], rhino: [2.3, 1.25], mammoth: [2.1, 1.35],
  lizard: [2.6, 1], croc: [2.2, 1.15], deer: [3.2, 1.05], tortoise: [1.8, 1.1], hound: [3.2, 1], toad: [2.4, 1],
  skeleton: [2.8, 1], mummy: [2.4, 1], goblin: [3.0, 0.85], orc: [2.7, 1.1], brute: [2.4, 1.25], golem: [2.1, 1.25], imp: [3.1, 0.85], demon: [2.6, 1.25], cultist: [2.6, 1], shaman: [2.6, 1],
  knight: [2.6, 1.1], zombie: [2.2, 1], frogman: [2.8, 1], lizardman: [2.8, 1.05], yeti: [2.5, 1.25], treant: [2.0, 1.3], werewolf: [3.3, 1.15], specter: [2.9, 1], lich: [2.5, 1.1], bandit: [3.0, 1],
  spider: [3.0, 1], scorpion: [2.7, 1], beetle: [2.5, 1], ant: [3.0, 0.9], mantis: [3.0, 1.05], slime: [2.2, 0.9], wisp: [3.0, 0.9], eye: [2.6, 1], elemental: [2.5, 1.15], shroom: [2.2, 0.95],
  bat: [3.4, 0.9], vulture: [3.2, 1], owl: [3.0, 1], wasp: [3.4, 0.85], moth: [3.0, 1], wyvern: [3.0, 1.2], snake: [2.8, 1], worm: [2.3, 1.1], dragon: [2.6, 1.3], hydra: [2.3, 1.3] };
// Décor propre à chaque région : 2 éléments solides et 2 au sol, et une teinte par palier
const PROPS = [
  { s: ['ruine', 'statue', 'totem', 'tente', 'souche', 'brasero'], w: ['fleursR', 'fleursB', 'herbes', 'cailloux', 'os', 'traces'] },
  { s: ['ruine', 'obelisque', 'crane', 'statue', 'cotes', 'oeufs'], w: ['os', 'cailloux', 'traces', 'runes', 'herbes', 'fleursR'] },
  { s: ['champi', 'souche', 'cocon', 'totem', 'statue', 'arche'], w: ['champis', 'toile', 'feuilles', 'mousse', 'fleursB', 'herbes'] },
  { s: ['champi', 'souche', 'tombe', 'cocon', 'totem', 'ruine'], w: ['nenuphar', 'flaque', 'champis', 'mousse', 'os', 'toile'] },
  { s: ['pic', 'statue', 'tente', 'souche', 'cristal', 'cotes'], w: ['glace', 'traces', 'cailloux', 'os', 'fleursB', 'herbes'] },
  { s: ['fumerolle', 'brasero', 'obelisque', 'crane', 'cristal', 'ruine'], w: ['braises', 'runes', 'os', 'cailloux', 'flaque', 'traces'] },
  { s: ['colonne', 'cristal', 'obelisque', 'arche', 'oeufs', 'statue'], w: ['etoiles', 'runes', 'os', 'toile', 'flaque', 'mousse'] },
];
const PROP_PAIRS = [[0, 1], [2, 3], [4, 5], [0, 3], [1, 4], [2, 5], [0, 5]];
const TIER_TINT = [null, '#d0a040', '#7a50c0', '#c02a2a', '#8a9098', '#30a0b0', '#f4f0ff'];
const TIER_QUAL = ["de l'Aube", 'des Échos', 'du Crépuscule', 'des Rois déchus', "de l'Oubli", 'des Titans', "de l'Éternité"];
const TIER_MOB = ['', ' féroce', ' funeste', ' sombre', ' titanesque', ' mythique', ' apocalyptique'];
const ZONES = [], ZSPAWNERS = [], ZWPS = [], ZTYPES = {};
function zoneRect(k) {
  const i = k - 1, row = i < ZCOLS ? 0 : 1, col = row === 0 ? i : ZCOLS - 1 - (i - ZCOLS);
  return { x0: KW + col * ZW, y0: row * ZH, row, col };
}
function genZones() {
  for (let k = 1; k <= 49; k++) {
    const r = mulberry32(9000 + k * 77), bi = (k - 1) % BIOMES.length, tier = Math.floor((k - 1) / BIOMES.length), B = BIOMES[bi];
    const { x0, y0, row, col } = zoneRect(k), x1 = x0 + ZW - 1, y1 = y0 + ZH - 1;
    const lv = [k * 20 + 1, k * 20 + 20];
    const pp = PROP_PAIRS[tier], PR = PROPS[bi];
    const z = { k, name: `${B.name} ${TIER_QUAL[tier]}`, bi, tier, x0, y0, x1, y1, lv, props: { s: [PR.s[pp[0]], PR.s[pp[1]]], w: [PR.w[pp[1]], PR.w[(pp[0] + tier + 2) % 6]] }, tint: TIER_TINT[tier] };
    ZONES.push(z);
    // bruit lissé : le sol forme des plaques au lieu d'un damier
    const gw = Math.ceil(ZW / 6) + 2, gh = Math.ceil(ZH / 6) + 2, grid = Array.from({ length: gw * gh }, () => r());
    const noise = (x, y) => { const fx = (x - x0) / 6, fy = (y - y0) / 6, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      const g = (i, j) => grid[(iy + j) * gw + ix + i], sm = t => t * t * (3 - 2 * t);
      const a = g(0, 0) + (g(1, 0) - g(0, 0)) * sm(tx), c = g(0, 1) + (g(1, 1) - g(0, 1)) * sm(tx); return a + (c - a) * sm(ty); };
    const pick = (x, y) => { let v = noise(x, y) * 0.85 + r() * 0.15; for (const [t, w] of B.ground) { if ((v -= w) <= 0) return t; } return B.ground[0][0]; };
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) setT(x, y, (x === x0 || x === x1 || y === y0 || y === y1) ? B.obst[0] : pick(x, y));
    // entrée et sortie
    const ewY = row === 0 ? 40 : 78, nsX = x0 + 24;
    let entry, exit;
    if (row === 0) { entry = [x0, ewY]; exit = col === ZCOLS - 1 ? [nsX, y1] : [x1, ewY]; }
    else { entry = col === ZCOLS - 1 ? [nsX, y0] : [x1, ewY]; exit = k === 49 ? null : [x0, ewY]; }
    const corridor = new Set(), key = (x, y) => y * W + x;
    const carve = (cx, cy, rad, t) => { for (let y = cy - rad; y <= cy + rad; y++) for (let x = cx - rad; x <= cx + rad; x++) if (x >= x0 && x <= x1 && y >= y0 && y <= y1) { setT(x, y, t); corridor.add(key(x, y)); } };
    const line = (ax, ay, bx, by) => { const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay)); const pts = []; for (let i = 0; i <= n; i++) { const x = Math.round(ax + (bx - ax) * i / n), y = Math.round(ay + (by - ay) * i / n); carve(x, y, 1, B.path); pts.push([x, y]); } return pts; };
    const inside = ([x, y]) => [Math.min(x1 - 3, Math.max(x0 + 3, x)), Math.min(y1 - 3, Math.max(y0 + 3, y))];
    const a = inside(entry), b = exit ? inside(exit) : [x0 + 6 + Math.floor(r() * 6), y0 + 8 + Math.floor(r() * (ZH - 16))];
    const m1 = [x0 + 10 + Math.floor(r() * (ZW - 20)), y0 + 8 + Math.floor(r() * (ZH - 16))], m2 = [x0 + 10 + Math.floor(r() * (ZW - 20)), y0 + 8 + Math.floor(r() * (ZH - 16))];
    // les étapes intermédiaires dans l'ordre du trajet
    const d1 = Math.hypot(m1[0] - a[0], m1[1] - a[1]), d2 = Math.hypot(m2[0] - a[0], m2[1] - a[1]);
    const [p1, p2] = d1 < d2 ? [m1, m2] : [m2, m1];
    line(entry[0], entry[1], a[0], a[1]);
    const path = [...line(a[0], a[1], p1[0], p1[1]), ...line(p1[0], p1[1], p2[0], p2[1]), ...line(p2[0], p2[1], b[0], b[1])];
    if (exit) line(b[0], b[1], exit[0], exit[1]);
    // repaire du boss, dans le coin le plus éloigné du chemin
    const corners = [[x0 + 7, y0 + 7], [x1 - 7, y0 + 7], [x0 + 7, y1 - 7], [x1 - 7, y1 - 7]];
    let lair = corners[0], ld = -1;
    for (const c of corners) { let dmin = 1e9; for (const q of path) dmin = Math.min(dmin, Math.hypot(q[0] - c[0], q[1] - c[1])); if (dmin > ld) { ld = dmin; lair = c; } }
    const near = path.reduce((best, q) => Math.hypot(q[0] - lair[0], q[1] - lair[1]) < Math.hypot(best[0] - lair[0], best[1] - lair[1]) ? q : best, path[0]);
    line(near[0], near[1], lair[0], lair[1]);
    for (let y = lair[1] - 3; y <= lair[1] + 3; y++) for (let x = lair[0] - 3; x <= lair[0] + 3; x++) if (Math.hypot(x - lair[0], y - lair[1]) < 3.6) { setT(x, y, B.ground[0][0]); corridor.add(key(x, y)); }
    const clear = (x, y, d) => { for (let yy = y - d; yy <= y + d; yy++) for (let xx = x - d; xx <= x + d; xx++) if (corridor.has(key(xx, yy))) return false; return true; };
    // mares (eau, tourbe, lave, glace)
    const nPools = B.poolN != null ? B.poolN : 4;
    for (let i = 0; i < nPools; i++) {
      const cx = x0 + 4 + r() * (ZW - 8), cy = y0 + 4 + r() * (ZH - 8), rr = 1.3 + r() * 2.4;
      for (let y = Math.floor(cy - rr); y <= cy + rr; y++) for (let x = Math.floor(cx - rr); x <= cx + rr; x++)
        if (x > x0 && x < x1 && y > y0 && y < y1 && Math.hypot(x - cx, (y - cy) * 1.15) < rr && clear(x, y, 1)) setT(x, y, B.pool);
    }
    // obstacles
    for (let y = y0 + 1; y < y1; y++) for (let x = x0 + 1; x < x1; x++) if (!SOLID.has(getT(x, y)) && r() < B.od && clear(x, y, 1)) setT(x, y, B.obst[Math.floor(r() * B.obst.length)]);
    // décor propre à la région
    for (let y = y0 + 2; y < y1 - 1; y++) for (let x = x0 + 2; x < x1 - 1; x++) {
      if (SOLID.has(getT(x, y))) continue;
      const v = r();
      if (v < 0.012 && clear(x, y, 2)) setT(x, y, T.DECOS);
      else if (v < 0.05 && !corridor.has(key(x, y))) setT(x, y, T.DECO);
    }
    // ouvertures vers les régions voisines
    const gap = ([gx, gy]) => { for (let d = -1; d <= 1; d++) { if (gx === x0 || gx === x1) setT(gx, gy + d, B.path); else setT(gx + d, gy, B.path); } };
    gap(entry); if (exit) gap(exit);
    // pierre de passage près de l'entrée
    const wpP = path[Math.min(4, path.length - 1)];
    ZWPS.push({ id: 'z' + k, name: z.name, x: wpP[0] + 0.5, y: wpP[1] + 0.5 });
    // monstres
    const SP = SPECIES[bi];
    const mt = [0, 1, 2].map(j => {
      const id = `z${k}_${j}`, [nm, kind] = SP.n[tier * 3 + j], ki = KIND_INFO[kind] || [2.8, 1];
      ZTYPES[id] = { name: nm, kind, spd: ki[0], size: ki[1], spec: { k: kind, s: k * 7 + j, bi, t: tier }, lvl: lv[0] + j * 7, gen: true, zone: k,
        aggro: j === 0 && tier === 0 ? 0 : 4 + j, respawn: 16, minRar: tier >= 3 ? 1 : 0 };
      return id;
    });
    const bid = `z${k}_B`, [bnm, bkind] = SP.b[tier], bki = KIND_INFO[bkind] || [2.4, 1];
    ZTYPES[bid] = { name: bnm, kind: bkind, spd: bki[0] * 0.9, size: Math.min(2.6, bki[1] * 1.7), spec: { k: bkind, s: k * 7 + 5, bi, t: tier, boss: 1 }, lvl: lv[1], gen: true, zone: k, aggro: 7, respawn: 180, boss: true, minRar: Math.min(6, 3 + Math.floor(tier / 2)) };
    const at = f => path[Math.min(path.length - 1, Math.floor(path.length * f))];
    [[0.3, 0, [lv[0], lv[0] + 6]], [0.58, 1, [lv[0] + 6, lv[0] + 13]], [0.86, 2, [lv[0] + 12, lv[0] + 19]]].forEach(([f, j, range]) => {
      const c = at(f);
      ZSPAWNERS.push({ type: mt[j], x: c[0] + 0.5, y: c[1] + 0.5, r: 8, n: 9, lv: range });
    });
    ZSPAWNERS.push({ type: bid, x: lair[0] + 0.5, y: lair[1] + 0.5, r: 1, n: 1, lv: [lv[1], lv[1]] });
  }
}

(function genMap() {
  const r = mulberry32(1337);
  for (let y = 0; y < WORLD_H; y++) for (let x = 0; x < W; x++) setT(x, y, r() < 0.04 ? T.FLOWER : T.GRASS);
  for (let y = 0; y < 74; y++) for (let x = 68; x < KW; x++) setT(x, y, r() < (x < 71 ? 0.1 : 0.2) ? T.TREE : T.DGRASS);
  for (let y = 0; y < 74; y++) for (let x = 0; x < 40; x++) {
    const d = Math.hypot((x - 16) / 10, (y - 38) / 8);
    if (d < 1) setT(x, y, T.WATER); else if (d < 1.22) setT(x, y, T.SAND);
  }
  for (let y = 0; y < WORLD_H; y++) for (let x = 0; x < 68; x++) {
    const t = getT(x, y);
    if ((t === T.GRASS || t === T.FLOWER) && r() < 0.05) setT(x, y, T.TREE);
  }
  // Crypte du nord
  for (let y = 2; y <= 18; y++) for (let x = 34; x <= 62; x++) setT(x, y, (x === 34 || x === 62 || y === 2 || y === 18) ? T.DWALL : T.DFLOOR);
  for (let y = 6; y <= 15; y += 4) for (let x = 38; x <= 58; x += 5) if (Math.abs(x - 48) > 2) setT(x, y, T.PILLAR);
  // Marais du sud-ouest
  for (let y = 75; y <= 102; y++) for (let x = 1; x <= 44; x++) setT(x, y, r() < 0.1 ? T.REED : T.MARSH);
  for (let i = 0; i < 16; i++) {
    const cx = 4 + r() * 38, cy = 83 + r() * 18, rr = 1.4 + r() * 2.2;
    for (let y = Math.floor(cy - rr); y <= cy + rr; y++) for (let x = Math.floor(cx - rr); x <= cx + rr; x++)
      if (Math.hypot(x - cx, (y - cy) * 1.2) < rr && x >= 1 && x <= 44 && y >= 75 && y <= 102) setT(x, y, T.BOG);
  }
  for (let y = 75; y <= 102; y++) for (let x = 1; x <= 44; x++) if (getT(x, y) === T.MARSH && r() < 0.035) setT(x, y, T.TREE);
  // Mine du sud-est
  for (let y = 74; y <= 102; y++) for (let x = 54; x <= 94; x++) setT(x, y, (x === 54 || x === 94 || y === 74 || y === 102) ? T.MWALL : T.MFLOOR);
  for (let i = 0; i < 26; i++) {
    const cx = 57 + r() * 35, cy = 76 + r() * 24, rr = 0.8 + r() * 1.6;
    for (let y = Math.floor(cy - rr); y <= cy + rr; y++) for (let x = Math.floor(cx - rr); x <= cx + rr; x++)
      if (Math.hypot(x - cx, y - cy) < rr && x > 54 && x < 94 && y > 74 && y < 102) setT(x, y, T.MWALL);
  }
  for (let y = 75; y < 102; y++) for (let x = 55; x < 94; x++) if (getT(x, y) === T.MFLOOR && r() < 0.015) setT(x, y, T.CRYSTAL);
  const carve = (x0, y0, x1, y1, t) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) setT(x, y, t); };
  carve(54, 78, 88, 80, T.MFLOOR); carve(87, 78, 89, 97, T.MFLOOR); carve(83, 93, 93, 101, T.MFLOOR);
  carve(60, 81, 62, 96, T.MFLOOR); carve(60, 95, 86, 97, T.MFLOOR);
  // Chemins
  const pth = (x0, y0, x1, y1) => carve(x0, y0, x1, y1, T.PATH);
  pth(47, 18, 49, 31); pth(58, 39, 95, 41); pth(27, 39, 38, 41); pth(47, 49, 49, 80);
  pth(20, 78, 46, 80); pth(50, 78, 53, 80);
  for (let x = 47; x <= 49; x++) setT(x, 18, T.DFLOOR);
  // Village
  for (let y = 31; y <= 49; y++) for (let x = 38; x <= 58; x++) setT(x, y, T.STONE);
  const house = (hx, hy) => { for (let y = 0; y < 4; y++) for (let x = 0; x < 5; x++) setT(hx + x, hy + y, y < 2 ? T.ROOF : T.WALL); setT(hx + 2, hy + 3, T.DOOR); };
  house(39, 32); house(53, 32); house(39, 45); house(53, 45);
  // Bordures
  for (let x = 0; x < W; x++) { setT(x, 0, T.TREE); setT(x, WORLD_H - 1, T.TREE); }
  for (let y = 0; y < WORLD_H; y++) { setT(0, y, T.TREE); setT(W - 1, y, T.TREE); setT(KW - 1, y, y >= 39 && y <= 41 ? T.PATH : T.TREE); }
  genZones();
  // Gouffre (salle instanciée, hors du monde)
  for (let y = WORLD_H; y < H; y++) for (let x = 0; x < W; x++) setT(x, y, T.DWALL);
  carve(ARENA.x0, ARENA.y0, ARENA.x1, ARENA.y1, T.AFLOOR);
  for (const [px, py] of [[39, 111], [57, 111], [39, 122], [57, 122]]) setT(px, py, T.PILLAR);
})();

function rleMap() { // compression par plages : [tuile, longueur] (la carte passe de ~230 Ko à quelques dizaines)
  const out = []; let i = 0;
  while (i < map.length) { const v = map[i]; let n = 1; while (i + n < map.length && map[i + n] === v && n < 255) n++; out.push(v, n); i += n; }
  return Uint8Array.from(out);
}
let rleCache = null; const rleMapC = () => rleCache || (rleCache = rleMap());
const R = 0.3;
function solidAt(x, y) { return SOLID.has(getT(Math.floor(x), Math.floor(y))); }
function blocked(x, y, r = R) {
  return solidAt(x - r, y - r * 0.6) || solidAt(x + r, y - r * 0.6) || solidAt(x - r, y + r * 0.4) || solidAt(x + r, y + r * 0.4);
}
function moveEnt(e, dx, dy, r = R) {
  const nx = e.x + dx; if (!blocked(nx, e.y, r)) e.x = nx;
  const ny = e.y + dy; if (!blocked(e.x, ny, r)) e.y = ny;
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const same = (a, b) => (a.inst || 0) === (b.inst || 0);

const WAYPOINTS = [
  { id: 'village', name: "Village d'Ambre", x: 51.5, y: 47.6 },
  { id: 'lac', name: 'Lac Miroir', x: 31.5, y: 40.5 },
  { id: 'crypte', name: 'Porte de la crypte', x: 48.5, y: 21.5 },
  { id: 'foret', name: 'Forêt des Murmures', x: 76.5, y: 40.5 },
  { id: 'sud', name: 'Plaines du Sud', x: 48.5, y: 68.5 },
  { id: 'marais', name: 'Marais Brumeux', x: 24.5, y: 79.5 },
  { id: 'mine', name: 'Mine Profonde', x: 57.5, y: 79.5 },
  ...ZWPS,
];
const NPCS = [
  { id: 'forge', name: 'Brann le forgeron', x: 45.5, y: 43.2, kind: 'forge' },
  { id: 'shop', name: "Elya l'herboriste", x: 51.5, y: 43.2, kind: 'shop' },
  { id: 'quest', name: 'Capitaine Aldric', x: 48.5, y: 37.4, kind: 'quest' },
  { id: 'portal', name: 'Portail du Gouffre', x: 56.5, y: 40.2, kind: 'portal' },
  { id: 'stable', name: 'Mira la palefrenière', x: 41.6, y: 43.2, kind: 'stable' },
  { id: 'bank', name: 'Gaspard le banquier', x: 55.5, y: 37.4, kind: 'bank' },
];
const SCOUT_NAMES = ['Aldwin', 'Mira', 'Torvald', 'Sélène', 'Garrick', 'Ysolde', 'Bran', 'Nessa', 'Corwin', 'Lysa', 'Hadrien', 'Ilda', 'Rurik', 'Faye'];
const DJ_NAMES = { 0: 'Forteresse du Khan', 1: 'Tombeau du Pharaon', 2: 'Cœur de la Sylve', 3: "Antre de l'Hydre", 4: 'Citadelle de givre', 5: 'Forge infernale', 6: 'Trône du Néant' };
const DUNGEONS = [];
function npcSpot(wx, wy, offs) { for (const [dx, dy] of offs) { const x = wx + dx, y = wy + dy; if (!blocked(x, y, 0.45) && !blocked(x, y + 0.6, 0.45)) return [x, y]; } return [wx + 1.2, wy]; }
for (const z of ZONES) {
  const w = ZWPS.find(q => q.id === 'z' + z.k); if (!w) continue;
  const [sx, sy] = npcSpot(w.x, w.y, [[2, -0.5], [-2, -0.5], [2, 1.5], [-2, 1.5], [0, -2], [0, 2.5], [3, 0], [-3, 0]]);
  NPCS.push({ id: 'rq' + z.k, name: `${SCOUT_NAMES[z.k % SCOUT_NAMES.length]}, éclaireur`, x: sx, y: sy, kind: 'quest', zone: z.k });
  if (z.lv[1] % 100 === 0) {
    const n = z.lv[1] / 100, [dx, dy] = npcSpot(w.x, w.y, [[-2.5, 1.8], [2.5, 1.8], [-3, -1.5], [3, -1.5], [0, 3], [-4, 0], [4, 0]]);
    const dj = { n, k: z.k, L: z.lv[1], name: DJ_NAMES[z.bi] + (n > 7 ? ' (héroïque)' : ''), x: dx, y: dy };
    DUNGEONS.push(dj);
    NPCS.push({ id: 'dj' + n, name: `Porte : ${dj.name}`, x: dx, y: dy, kind: 'dungeon', dj: n });
  }
}
const SPAWN_WP = 'village';

/* ============================================================
   Classes, compétences, monstres
   ============================================================ */
const CLASSES = {
  guerrier: { name: 'Guerrier', hp: 120, hpL: 18, dmg: 10, dmgL: 3.0, range: 1.4, cd: 0.5, spd: 4.4,
    skills: [{ name: 'Tourbillon', cd: 5, lvl: 1 }, { name: 'Charge', cd: 7, lvl: 5 }, { name: 'Cri de guerre', cd: 20, lvl: 10 }, { name: 'Fureur du Titan', cd: 60, lvl: 50, ult: true }] },
  archere: { name: 'Archère', hp: 85, hpL: 12, dmg: 8, dmgL: 2.6, range: 6.5, cd: 0.7, spd: 4.6,
    skills: [{ name: 'Volée', cd: 6, lvl: 1 }, { name: 'Roulade', cd: 5, lvl: 5 }, { name: 'Pluie de flèches', cd: 12, lvl: 10 }, { name: 'Tir céleste', cd: 50, lvl: 50, ult: true }] },
  mage: { name: 'Mage', hp: 75, hpL: 10, dmg: 9.5, dmgL: 3.05, range: 5.5, cd: 0.8, spd: 4.2,
    skills: [{ name: 'Météore', cd: 7, lvl: 1 }, { name: 'Bouclier de glace', cd: 16, lvl: 5 }, { name: 'Nova de givre', cd: 10, lvl: 10 }, { name: 'Cataclysme', cd: 55, lvl: 50, ult: true }] },
  paladin: { name: 'Paladin', hp: 130, hpL: 19, dmg: 9, dmgL: 2.8, range: 1.4, cd: 0.6, spd: 4.2,
    skills: [{ name: 'Frappe sacrée', cd: 6, lvl: 1 }, { name: 'Lumière guérisseuse', cd: 14, lvl: 5 }, { name: 'Jugement', cd: 12, lvl: 10 }, { name: 'Bouclier divin', cd: 75, lvl: 50, ult: true }] },
  assassin: { name: 'Assassin', hp: 100, hpL: 14, dmg: 11, dmgL: 3.2, range: 1.3, cd: 0.4, spd: 4.9, crit: 10,
    skills: [{ name: "Pas de l'ombre", cd: 6, lvl: 1 }, { name: 'Fumigène', cd: 15, lvl: 5 }, { name: 'Danse des lames', cd: 12, lvl: 10 }, { name: 'Mille entailles', cd: 45, lvl: 50, ult: true }] },
  druide: { name: 'Druide', hp: 90, hpL: 12, dmg: 8.5, dmgL: 2.8, range: 6, cd: 0.75, spd: 4.4,
    skills: [{ name: 'Ronces', cd: 7, lvl: 1 }, { name: 'Régénération', cd: 18, lvl: 5 }, { name: 'Colère de la nature', cd: 14, lvl: 10 }, { name: 'Avatar de la forêt', cd: 70, lvl: 50, ult: true }] },
};
const MTYPES = {
  loup:      { name: 'Loup gris', lvl: 1, hp: 40, dmg: 5, spd: 2.8, xp: 12, gold: [2, 6], aggro: 0, size: 1, respawn: 12 },
  sanglier:  { name: 'Sanglier', lvl: 3, hp: 85, dmg: 9, spd: 2.6, xp: 26, gold: [4, 10], aggro: 0, size: 1, respawn: 15 },
  loupnoir:  { name: 'Loup noir', lvl: 5, hp: 150, dmg: 15, spd: 3.4, xp: 48, gold: [8, 16], aggro: 5, size: 1, respawn: 18 },
  spectre:   { name: 'Spectre errant', lvl: 6, hp: 170, dmg: 17, spd: 3.0, xp: 70, gold: [12, 22], aggro: 6, size: 1, respawn: 20, night: true },
  ours:      { name: 'Ours brun', lvl: 7, hp: 280, dmg: 24, spd: 2.5, xp: 85, gold: [14, 28], aggro: 4, size: 1.3, respawn: 22 },
  squelette: { name: 'Squelette', lvl: 10, hp: 440, dmg: 34, spd: 2.9, xp: 145, gold: [20, 40], aggro: 6, size: 1, respawn: 25 },
  lougarou:  { name: 'Loup-garou', lvl: 11, hp: 560, dmg: 40, spd: 3.6, xp: 200, gold: [28, 50], aggro: 7, size: 1.4, respawn: 25, night: true },
  araignee:  { name: 'Araignée des brumes', lvl: 12, hp: 580, dmg: 41, spd: 3.2, xp: 200, gold: [26, 50], aggro: 5, size: 1.1, respawn: 22 },
  roi:       { name: 'Roi des Cendres', lvl: 15, hp: 4500, dmg: 62, spd: 2.6, xp: 1600, gold: [300, 500], aggro: 7, size: 2, respawn: 120, boss: true, minRar: 3 },
  golem:     { name: 'Golem de pierre', lvl: 16, hp: 1100, dmg: 58, spd: 2.2, xp: 340, gold: [40, 80], aggro: 5, size: 1.3, respawn: 28 },
  golemroi:  { name: 'Golem Ancien', lvl: 20, hp: 12000, dmg: 110, spd: 2.2, xp: 4500, gold: [600, 900], aggro: 7, size: 2.2, respawn: 150, boss: true, minRar: 4 },
  dragon:    { name: "Vyrmax, dragon d'Ambre", lvl: 30, hp: 60000, dmg: 150, spd: 2.4, xp: 18000, gold: [1800, 3000], aggro: 9, size: 2.6, respawn: 0, boss: true, world: true, minRar: 6 },
  champion:  { name: 'Champion', lvl: 1, hp: 100, dmg: 10, spd: 3.3, xp: 0, gold: [0, 0], aggro: 60, size: 1, respawn: 0, scaled: true },
  ombre:     { name: 'Ombre du Gouffre', lvl: 5, hp: 100, dmg: 10, spd: 3.1, xp: 40, gold: [6, 14], aggro: 40, size: 1, respawn: 0, scaled: true },
  gardien:   { name: 'Gardien du Gouffre', lvl: 5, hp: 100, dmg: 10, spd: 2.5, xp: 40, gold: [6, 14], aggro: 40, size: 2, respawn: 0, boss: true, scaled: true, minRar: 3 },
};
for (const [id, z] of Object.entries(ZTYPES)) {
  MTYPES[id] = { ...z, hp: 1, dmg: 1, xp: 1, gold: [1, 2] };
}
const SPAWNERS = [
  { type: 'loup', x: 48, y: 61, r: 10, n: 10 },
  { type: 'loup', x: 30, y: 26, r: 6, n: 5 },
  { type: 'sanglier', x: 28, y: 58, r: 8, n: 8 },
  { type: 'sanglier', x: 62, y: 58, r: 6, n: 5 },
  { type: 'loupnoir', x: 79, y: 40, r: 9, n: 10 },
  { type: 'ours', x: 84, y: 59, r: 8, n: 6 },
  { type: 'ours', x: 84, y: 18, r: 8, n: 6 },
  { type: 'squelette', x: 48, y: 11, r: 10, n: 12 },
  { type: 'roi', x: 48, y: 5, r: 1, n: 1 },
  { type: 'araignee', x: 20, y: 90, r: 14, n: 14 },
  { type: 'golem', x: 70, y: 88, r: 12, n: 10 },
  { type: 'golemroi', x: 89, y: 98, r: 1.5, n: 1 },
  // la nuit seulement
  { type: 'spectre', x: 48, y: 62, r: 10, n: 6, night: true },
  { type: 'spectre', x: 25, y: 20, r: 8, n: 4, night: true },
  { type: 'lougarou', x: 82, y: 30, r: 10, n: 5, night: true },
];

const rnd = Math.random;
function freeSpot(cx, cy, r) {
  for (let i = 0; i < 200; i++) {
    const x = cx + (rnd() * 2 - 1) * r, y = cy + (rnd() * 2 - 1) * r;
    if (!blocked(x, y, 0.45)) return { x, y };
  }
  return { x: cx, y: cy };
}

let nextId = 1;
const monsters = [];
function makeMonster(type, x, y, opts = {}) {
  const mt = MTYPES[type];
  const m = { id: nextId++, type, mt, x, y, hx: x, hy: y, dir: 3, target: null, atkCd: 0, wanderT: rnd() * 3, wx: x, wy: y,
    dmgBy: new Set(), dead: false, respawnT: 0, mv: false, inst: 0, sp: null, stunT: 0, slowT: 0,
    lvl: mt.lvl, maxhp: mt.hp, dmg: mt.dmg, xp: mt.xp, gold: mt.gold, ...opts };
  m.hp = m.maxhp;
  monsters.push(m);
  return m;
}
for (const s of SPAWNERS) for (let i = 0; i < s.n; i++) {
  const p = freeSpot(s.x, s.y, s.r);
  const m = makeMonster(s.type, p.x, p.y, { sp: s });
  if (s.night) { m.dead = true; m.respawnT = 0; m.nightOff = true; }
}

/* ============================================================
   Objets
   ============================================================ */
const SLOTS = ['arme', 'casque', 'armure', 'gants', 'bottes', 'cape', 'ceinture', 'anneau', 'amulette'];
const CLASS_IDS = ['guerrier', 'archere', 'mage', 'paladin', 'assassin', 'druide'];
// Arme : dégâts + une statistique propre à la classe
const WEAPON_STATS = { guerrier: { dmg: 1.2, hp: 1.0 }, archere: { dmg: 1.2, crit: 0.15 }, mage: { dmg: 1.45 }, paladin: { dmg: 1.1, def: 0.45 }, assassin: { dmg: 1.15, crit: 0.2 }, druide: { dmg: 1.15, hp: 0.8 } };
const SLOT_NAMES = { arme: 'Arme', casque: 'Casque', armure: 'Armure', gants: 'Gants', bottes: 'Bottes', cape: 'Cape', ceinture: 'Ceinture', anneau: 'Anneau', amulette: 'Amulette' };
// Points de stat par niveau d'objet, avant le multiplicateur de rareté
const SLOT_STATS = {
  casque: { hp: 3, def: 0.8 }, armure: { hp: 4, def: 1.4 }, gants: { dmg: 0.5, crit: 0.15 }, bottes: { hp: 2, def: 0.6, spd: 0.12 },
  cape: { hp: 1.5, def: 0.5, crit: 0.1 }, ceinture: { hp: 2.5, dmg: 0.3 }, anneau: { dmg: 0.7, crit: 0.3 }, amulette: { hp: 2.5, dmg: 0.5 },
};
const BONUS_BASE = { hp: 2.5, def: 0.8, dmg: 0.6, crit: 0.25 };
const TIERS = 8, TIER_SPAN = 6, TIER_LO = [1, 7, 13, 19, 25, 41, 101, 301]; // premier niveau de chaque palier
const tierOf = L => { let t = 0; for (let i = 0; i < TIERS; i++) if (L >= TIER_LO[i]) t = i; return t; };
const BASE_NAMES = {
  arme: {
    guerrier: ['Épée courte', 'Épée longue', "Lame d'acier", 'Épée de chevalier', 'Lame runique', 'Croc de dragon', 'Épée astrale', 'Lame du Titan'],
    archere: ['Arc court', 'Arc long', "Arc d'acier", 'Arc de chevalier', 'Arc runique', 'Arc draconique', 'Arc astral', 'Arc du Titan'],
    mage: ['Bâton de saule', 'Bâton de chêne', "Sceptre d'acier", "Sceptre de l'ordre", 'Bâton runique', 'Bâton draconique', 'Sceptre astral', 'Sceptre du Titan'],
    paladin: ['Masse de bois', 'Masse de fer', "Marteau d'acier", 'Marteau de chevalier', 'Marteau runique', 'Marteau draconique', 'Marteau astral', 'Marteau du Titan'],
    assassin: ['Dagues de fer', 'Dagues courbes', "Dagues d'acier", "Lames de l'ordre", 'Dagues runiques', 'Crocs draconiques', 'Dagues astrales', 'Lames du Titan'],
    druide: ['Bâton noueux', 'Bâton de ronces', "Bâton d'if", 'Bâton du cercle', 'Bâton runique', 'Bâton draconique', 'Bâton astral', 'Bâton du Titan'],
  },
  casque: ['Casque de cuir', 'Casque de fer', "Heaume d'acier", 'Heaume de chevalier', 'Heaume runique', 'Heaume draconique', 'Couronne astrale', 'Heaume du Titan'],
  armure: ['Armure de cuir', 'Cotte de mailles', "Cuirasse d'acier", 'Harnois de chevalier', 'Armure runique', 'Écailles draconiques', 'Armure astrale', 'Égide du Titan'],
  gants: ['Gants de cuir', 'Gantelets de fer', "Gantelets d'acier", 'Poignes de chevalier', 'Gantelets runiques', 'Griffes draconiques', 'Gants astraux', 'Poings du Titan'],
  bottes: ['Bottes de cuir', 'Bottes ferrées', "Solerets d'acier", 'Grèves de chevalier', 'Bottes runiques', 'Bottes draconiques', 'Bottes astrales', 'Pas du Titan'],
  cape: ['Cape de laine', 'Cape de voyage', 'Manteau de garde', 'Cape de chevalier', 'Cape runique', 'Ailes draconiques', 'Voile astral', 'Manteau du Titan'],
  ceinture: ['Ceinture de corde', 'Ceinture de cuir', 'Ceinturon de fer', 'Ceinturon de chevalier', 'Ceinture runique', 'Ceinture draconique', 'Ceinture astrale', 'Sangle du Titan'],
  anneau: ['Anneau de cuivre', "Anneau d'argent", "Anneau d'or", 'Chevalière', 'Anneau runique', 'Anneau draconique', 'Anneau astral', 'Sceau du Titan'],
  amulette: ['Amulette de bois', 'Amulette de jade', "Amulette d'ambre", 'Médaillon de chevalier', 'Talisman runique', 'Cœur de dragon', 'Amulette étoilée', 'Relique du Titan'],
};
const SUFFIX = [[],
  ['du Renard', 'de la Bise', 'du Chêne', 'du Ruisseau', "de l'Ours"],
  ['du Faucon', 'du Loup', 'des Marées', 'de la Lune', 'du Givre'],
  ["de l'Aube", 'des Braises', 'de la Tempête', 'du Crépuscule', 'des Ombres'],
  ['des Anciens', 'du Roi Déchu', "de l'Ambre éternelle", 'du Phénix', 'des Sept Lames'],
  ['du Prisme', "de l'Arc-en-ciel", 'des Mille Éclats', "de l'Aurore boréale"],
  ['du Héros', 'des Légendes oubliées', 'du Dernier Rempart', "du Champion d'Ambre"]];
// Panoplies : objets portant le même nom (même suffixe). Chaque nom renforce une statistique.
// Apparence : palier (forme et matière) + nom de panoplie (couleur d'accent)
const SUFFIX_OFF = SUFFIX.reduce((a, l, i) => { a.push(i ? a[i - 1] + SUFFIX[i - 1].length : 0); return a; }, []);
const VIS_SLOTS = ['arme', 'casque', 'armure', 'gants', 'bottes', 'cape', 'ceinture', 'amulette'];
function visOf(p) {
  return VIS_SLOTS.map(k => {
    const it = p.eq[k]; if (!it) return '-';
    const g = mulberry32(it.sd | 0), L = Math.max(1, it.l | 0);
    const base = it.s === 'arme' ? (WEAPON_STATS[it.c] || WEAPON_STATS.guerrier) : (SLOT_STATS[it.s] || {});
    for (const _ in base) g();
    for (let i = 0; i < Math.min(4, it.r); i++) g();
    const sl = SUFFIX[it.r] || [], si = sl.length ? Math.floor(g() * sl.length) : -1;
    const acc = si >= 0 ? 1 + SUFFIX_OFF[it.r] + si : 0;
    return tierOf(L).toString(36) + acc.toString(36).padStart(2, '0') + it.r + ((it.u | 0) >= 7 ? 1 : 0);
  }).join('.');
}
const SET_STAT = [[], ['crit', 'spd', 'def', 'hp', 'dmg'], ['crit', 'dmg', 'hp', 'spd', 'def'], ['hp', 'dmg', 'spd', 'def', 'crit'],
  ['def', 'dmg', 'hp', 'crit', 'spd'], ['dmg', 'spd', 'crit', 'hp'], ['dmg', 'crit', 'def', 'hp']];
const SET_BASE = { hp: 1.2, def: 0.4, dmg: 0.3, crit: 0.12, spd: 0.08 };
const SET_STEPS = [[2, 1], [4, 2.4], [6, 4], [8, 6]]; // pièces portées, multiplicateur
function setBonusVal(stat, r, plvl, factor) { return Math.max(1, Math.round(SET_BASE[stat] * plvl * RAR_MULT[r] * factor)); }
const RAR_NAMES = ['Commun', 'Peu commun', 'Rare', 'Épique', 'Légendaire', 'Prismatique', 'Héroïque'];
const RAR_MULT = [1, 1.3, 1.65, 2.1, 2.7, 3.4, 4.2];
const RAR_VALUE = [1, 2, 4, 9, 20, 45, 100];
const MAX_RAR = RAR_NAMES.length - 1;
// Puissance réelle : l'objet suit ton niveau, jusqu'à 3 niveaux au-dessus du sien
const effLevel = (itemLvl, plvl) => Math.max(1, Math.min(itemLvl + 3, plvl == null ? itemLvl : plvl));
// Forge : chaque objet peut monter de +0 à +9 (+10 % de statistiques par niveau)
const FORGE_MAX = 9, FORGE_CHANCE = [1, 1, 1, 0.9, 0.8, 0.7, 0.55, 0.4, 0.3];
const FORGE_RAR = [1, 1.3, 1.7, 2.2, 3, 4, 5];
const forgeItemCost = it => Math.round((it.l * 3 + 10) * FORGE_RAR[it.r] * Math.pow((it.u || 0) + 1, 1.6));
function itemInfo(it, plvl) {
  const u = Math.max(0, Math.min(FORGE_MAX, it.u | 0));
  const g = mulberry32(it.sd | 0), L = Math.max(1, it.l | 0), E = effLevel(L, plvl), m = (RAR_MULT[it.r] || 1) * (1 + 0.1 * u);
  const st = { hp: 0, def: 0, dmg: 0, crit: 0, spd: 0, cdmg: 0 };
  const base = it.s === 'arme' ? (WEAPON_STATS[it.c] || WEAPON_STATS.guerrier) : (SLOT_STATS[it.s] || {});
  for (const k in base) st[k] = base[k] * E * m * (0.85 + g() * 0.3);
  const keys = Object.keys(BONUS_BASE);
  for (let i = 0; i < Math.min(4, it.r); i++) { const k = keys[Math.floor(g() * keys.length)]; st[k] += BONUS_BASE[k] * E * 0.45 * m; }
  const gems = (it.g || []).filter(gemOk);
  for (const c of gems) { const gs = gemStat(c); st[gs.stat] += gs.v; }
  for (const k in st) st[k] = st[k] > 0 ? Math.max(1, Math.round(st[k])) : 0;
  const tier = tierOf(L);
  const sl = SUFFIX[it.r] || [];
  const si = sl.length ? Math.floor(g() * sl.length) : -1;
  const suf = si >= 0 ? ' ' + sl[si] : '';
  const set = si >= 0 ? { k: it.r * 10 + si, n: sl[si], stat: SET_STAT[it.r][si] } : null;
  const bn = it.s === 'arme' ? BASE_NAMES.arme[it.c] || BASE_NAMES.arme.guerrier : BASE_NAMES[it.s];
  return { id: it.id, s: it.s, c: it.c, r: it.r, l: L, eff: E, sd: it.sd, u, name: bn[tier] + suf + (u ? ` +${u}` : ''), st, set, sk: SOCKETS[it.r] || 0, g: gems,
    value: Math.round((L * 3 + 5) * RAR_VALUE[it.r] * (1 + 0.5 * u)), fc: u < FORGE_MAX ? forgeItemCost(it) : 0, fp: u < FORGE_MAX ? FORGE_CHANCE[u] : 0 };
}
function rollRarity(lvl) {
  const x = rnd();
  if (x < 0.003 && lvl >= 18) return 6;
  if (x < 0.011 && lvl >= 12) return 5;
  if (x < 0.035 && lvl >= 6) return 4;
  if (x < 0.09) return 3;
  if (x < 0.2) return 2;
  if (x < 0.42) return 1;
  return 0;
}
// cls : classe de celui qui ramasse en priorité (7 armes sur 10 lui sont destinées)
function newItem(lvl, minRar = 0, slot, cls) {
  const r = Math.max(rollRarity(lvl), minRar);
  const s = slot || (rnd() < 0.2 ? 'arme' : SLOTS[1 + Math.floor(rnd() * (SLOTS.length - 1))]);
  const it = { id: nextId++, s, r, l: Math.max(1, Math.round(lvl + (rnd() - 0.5) * 2)), sd: (rnd() * 2e9) | 0 };
  if (s === 'arme') it.c = cls && rnd() < 0.7 ? cls : CLASS_IDS[Math.floor(rnd() * CLASS_IDS.length)];
  return it;
}
function cleanItem(o) {
  if (!o || !SLOTS.includes(o.s)) return null;
  const it = { id: nextId++, s: o.s, r: Math.max(0, Math.min(MAX_RAR, o.r | 0)), l: Math.max(1, Math.min(1100, o.l | 0)), sd: o.sd | 0, u: Math.max(0, Math.min(9, o.u | 0)) };
  if (it.s === 'arme') { if (!CLASS_IDS.includes(o.c)) return null; it.c = o.c; }
  if (Array.isArray(o.g)) it.g = o.g.filter(gemOk).slice(0, SOCKETS[it.r]);
  return it;
}
const packIt = v => [v.s, v.r, v.l, v.sd, v.c || null, v.u || 0, v.g || []];
const INV_SIZE = 100;

/* ============================================================
   Quêtes
   ============================================================ */
const QUESTS = [
  { name: 'Les crocs du sud', text: 'Des loups gris rôdent au sud du village. Élimine-en 8 et le village dormira mieux.', type: 'loup', n: 8, xp: 70, gold: 30 },
  { name: 'Défenses de sanglier', text: "Brann a besoin de défenses de sanglier pour ses manches d'armes. Rapporte-m'en 5.", type: 'sanglier', item: 'Défense de sanglier', chance: 0.6, n: 5, xp: 160, gold: 60, reward: { s: 'casque', r: 1 } },
  { name: 'Ombres de la forêt', text: "Les loups noirs de la forêt de l'est attaquent nos chariots. Abats-en 10.", type: 'loupnoir', n: 10, xp: 420, gold: 110 },
  { name: 'Le seigneur des bois', text: 'Les ours bruns deviennent agressifs. Calme-en 6, au nord-est ou au sud-est de la forêt.', type: 'ours', n: 6, xp: 700, gold: 160, reward: { s: 'gants', r: 2 } },
  { name: 'La crypte du nord', text: "Des squelettes sortent de la crypte au nord du village. Détruis-en 12 avant qu'ils n'atteignent nos murs.", type: 'squelette', n: 12, xp: 1700, gold: 320 },
  { name: 'Le Roi des Cendres', text: "Au fond de la crypte règne le Roi des Cendres. Rassemble des alliés et abats-le.", type: 'roi', n: 1, xp: 3200, gold: 650, reward: { s: 'amulette', r: 3 } },
  { name: 'Toiles du marais', text: 'Les araignées des brumes envahissent le marais au sud-ouest. Élimine-en 10.', type: 'araignee', n: 10, xp: 3000, gold: 520 },
  { name: 'Cœurs de pierre', text: "Les golems de la mine portent un cœur de pierre. Rapporte-m'en 6.", type: 'golem', item: 'Cœur de golem', chance: 0.5, n: 6, xp: 4800, gold: 820, reward: { s: 'armure', r: 3 } },
  { name: 'Le Golem Ancien', text: 'Au fond de la mine dort le Golem Ancien. Sa chute rendra la mine aux mineurs.', type: 'golemroi', n: 1, xp: 9500, gold: 1500, reward: { s: 'arme', r: 4 } },
];
// Lieu visé par la quête : la zone de ses monstres, ou Aldric quand elle est terminée
function questGoal(p, q) {
  if (p.q.prog >= q.n) { const a = NPCS.find(n => n.id === (p.q.g || 'quest')) || NPCS.find(n => n.kind === 'quest'); return [a.x, a.y + 0.9]; }
  let best = null, bd = 1e9;
  for (const s of SPAWNERS) if (s.type === q.type && !s.night) { const d = Math.hypot(s.x - p.x, s.y - p.y); if (d < bd) { bd = d; best = s; } }
  return best ? [best.x, best.y] : [p.x, p.y];
}
const BOUNTY_TYPES = ['loup', 'sanglier', 'loupnoir', 'ours', 'squelette', 'araignee', 'golem'];
function regionQuest(p, k) {
  const z = ZONES[k - 1], step = (p.rq && p.rq[k]) | 0, ty = j => `z${k}_${j}`, nm = j => MTYPES[ty(j)].name;
  const ms = j => mobStats(MTYPES[ty(j)].lvl, j === 'B'), xpK = (j, n) => Math.round(ms(j).xp * n * 1.6), goldK = (j, n) => Math.round((ms(j).gold[0] + ms(j).gold[1]) * n * 0.9);
  const R = Math.min(5, 2 + Math.floor(z.tier / 2));
  const chain = [
    { name: `${z.name} : premiers pas`, text: `Bienvenue dans ${z.name}. Les ${nm(0).toLowerCase()}s rendent la route dangereuse : abats-en 10 pour que nous puissions avancer.`, type: ty(0), n: 10, xp: xpK(0, 10), gold: goldK(0, 10) },
    { name: `${z.name} : trophées`, text: `Rapporte-moi 6 trophées de ${nm(1).toLowerCase()}. Ils prouveront à mes chefs que la région peut être tenue.`, type: ty(1), item: `trophée de ${nm(1).toLowerCase()}`, chance: 0.5, n: 6, xp: xpK(1, 12), gold: goldK(1, 12) },
    { name: `${z.name} : la menace`, text: `Plus loin, les ${nm(2).toLowerCase()}s gardent le passage. Élimines-en 12.`, type: ty(2), n: 12, xp: xpK(2, 12), gold: goldK(2, 12), reward: { s: null, r: Math.max(2, R - 1) } },
    { name: `${z.name} : le maître des lieux`, text: `Il est temps d'affronter ${nm('B')}, qui règne sur ${z.name}. Ramène-moi la preuve de sa chute.`, type: ty('B'), n: 1, xp: Math.round(ms('B').xp * 3), gold: goldK('B', 2), reward: { s: 'arme', r: R } },
  ];
  if (step < chain.length) return { ...chain[step], g: 'rq' + k, rk: k, step };
  const j = (Math.floor(Date.now() / 3600000) + k) % 3;
  return { name: `${z.name} : patrouille`, text: `La région reste agitée. Abats encore 15 ${nm(j).toLowerCase()}s.`, type: ty(j), n: 15, xp: xpK(j, 9), gold: goldK(j, 10), bounty: true, g: 'rq' + k, rk: k, reward: { s: null, r: 2 } };
}
function questFor(p, giver) {
  const g = giver || (p.q.on ? p.q.g : null) || 'quest';
  if (g.startsWith('rq')) return regionQuest(p, +g.slice(2));
  if (p.q.i < QUESTS.length) return QUESTS[p.q.i];
  // primes répétables adaptées au niveau
  let best = 'loup';
  for (const t of BOUNTY_TYPES) if (MTYPES[t].lvl <= plv(p) + 1) best = t;
  const mt = MTYPES[best], ms = mt.gen ? mobStats(mt.lvl, false) : mt;
  return { name: `Prime : ${mt.name}`, text: `Le village offre une prime pour 12 ${mt.name.toLowerCase()}s de plus.`, type: best, n: 12,
    xp: Math.round(ms.xp * 9), gold: Math.round((ms.gold[0] + ms.gold[1]) * 4), bounty: true, reward: { s: null, r: 2 } };
}

/* ============================================================
   Joueurs, sauvegarde, statistiques
   ============================================================ */
let saves = storeLoad() || {};
const players = new Map();
function persist() { for (const p of players.values()) saves[p.key] = snapshotSave(p); storeSave(saves); }
function snapshotSave(p) {
  return { name: p.name, cls: p.cls, lvl: p.lvl, xp: p.xp, gold: p.gold, pots: p.pots, weap: p.weap,
    inv: p.inv.map(packIt), eq: Object.fromEntries(Object.entries(p.eq).filter(([, v]) => v).map(([k, v]) => [k, packIt(v)])),
    q: { i: p.q.i, prog: p.q.prog, on: p.q.on, g: p.q.g || null }, wps: [...p.wps], wp: p.wp,
    reborn: p.reborn, tal: p.tal, mounts: [...p.mounts], mount: p.mount, mat: p.mat, prof: p.prof, stats: p.stats, ach: [...p.ach], title: p.title,
    daily: p.daily, look: p.look, dyes: [...p.dyes], gtag: p.gtag || '', acc: p.acc, wear: p.wear || 0, rq: p.rq || {}, best: p.best || {} };
}
const xpNext = l => Math.round(25 * Math.pow(l, 1.6));
// Niveau de puissance : niveau + 100 par renaissance (sert aux statistiques, à l'équipement et aux monstres)
const plv = p => p.lvl + 100 * (p.reborn || 0);
const forgeCost = w => Math.round(30 * Math.pow(w + 1, 1.7));
const POTION_COST = 15;
const potPrice = p => Math.round(15 + plv(p) * 1.5 + p.reborn * 20);
const weapLvl = p => (p.eq.arme ? p.eq.arme.u || 0 : 0) + p.weap;
function recalc(p) {
  const c = CLASSES[p.cls];
  const P = plv(p), s = { hp: c.hp + c.hpL * (P - 1), dmg: c.dmg + c.dmgL * (P - 1) + p.weap * 4, def: 0, crit: 12 + (c.crit || 0), spd: 0, cdmg: 0 };
  const sets = new Map();
  for (const k of SLOTS) {
    const it = p.eq[k]; if (!it) continue;
    const info = itemInfo(it, P), st = info.st;
    s.hp += st.hp; s.dmg += st.dmg; s.def += st.def; s.crit += st.crit; s.spd += st.spd; s.cdmg += st.cdmg || 0;
    if (info.set) { const e = sets.get(info.set.k) || { n: info.set.n, r: it.r, stat: info.set.stat, c: 0 }; e.c++; sets.set(info.set.k, e); }
  }
  p.sets = [];
  let full = false;
  for (const e of sets.values()) {
    let factor = 0; for (const [n, f] of SET_STEPS) if (e.c >= n) factor = f;
    e.val = factor ? setBonusVal(e.stat, e.r, P, factor) : 0;
    const nxt = SET_STEPS.find(([n]) => n > e.c);
    e.next = nxt ? [nxt[0], setBonusVal(e.stat, e.r, P, nxt[1])] : null;
    e.full = e.c >= 8; if (e.full) full = true;
    s[e.stat] += e.val;
    p.sets.push(e);
  }
  p.sets.sort((a, b) => b.c - a.c || b.r - a.r);
  if (full) { s.hp *= 1.1; s.dmg *= 1.1; }
  applyTalents(p, s);
  s.dmg *= 1 + 0.001 * Math.min(250, (p.stats && p.stats.mastered) || 0);
  if (s.crit > 50) s.crit = 50 + (s.crit - 50) * 0.5;
  s.critMul += s.cdmg / 100;
  const wear = 1 - (p.wear || 0) / 200; s.hp *= wear; s.dmg *= wear; s.def *= wear;
  // coup de pouce des débutants : jusqu'à +80 % de dégâts et +40 % de vie au niveau 1, disparaît au niveau 40
  if (!p.ref && P < 40) { const k = (40 - P) / 39; s.dmg *= 1 + 0.8 * k; s.hp *= 1 + 0.4 * k; }
  s.hp = Math.round(s.hp); s.dmg = Math.round(s.dmg); s.def = Math.round(s.def); s.crit = Math.round(Math.min(75, s.crit) * 10) / 10; s.spd = Math.min(30, s.spd);
  p.st = s; p.vis = visOf(p);
  if (p.hp > s.hp) p.hp = s.hp;
}
const maxHp = p => p.st.hp;
// Puissance de référence d'un joueur bien équipé au niveau L : sert à calibrer les monstres
const refCache = new Map();
function refPower(L) {
  L = Math.max(1, Math.round(L));
  let v = refCache.get(L); if (v) return v;
  const rb = Math.floor((L - 1) / 100);
  const f = { ref: 1, cls: 'guerrier', lvl: L - rb * 100, reborn: rb, weap: 0, eq: {}, tal: newTal(), riding: false, hp: 1 };
  SLOTS.forEach((k, i) => { f.eq[k] = { s: k, r: 1 + Math.min(2, Math.floor(L / 250)), l: L, sd: 4242 + i * 31, c: 'guerrier', u: Math.min(5, Math.floor(L / 150)), g: [] }; });
  recalc(f);
  v = { hp: f.st.hp, dmg: f.st.dmg, def: f.st.def };
  refCache.set(L, v); return v;
}
function mobStats(L, boss, mul = 1) {
  const R = refPower(L), K = 90 + 8 * Math.max(0, L - 10), taken = 1 - R.def / (R.def + K);
  const hp = Math.round(R.dmg * 5 * mul * (boss ? 22 : 1));
  const dmg = Math.round(R.hp / 20 / taken * (boss ? 1.6 : 1) * (0.8 + 0.2 * mul));
  const xp = Math.round(xpNext(L) / (14 + L / 12) * (boss ? 18 : 1) * mul);
  const gold = [Math.round((2 + L * 1.5) * (boss ? 20 : 1)), Math.round((6 + L * 3) * (boss ? 25 : 1))];
  return { lvl: L, maxhp: hp, dmg, xp, gold };
}
const baseDmg = p => p.st.dmg * (p.buffT > 0 ? 1.4 : 1);

function send(p, o) { p.ws.send(JSON.stringify(o)); }
function msg(p, m) { send(p, { t: 'msg', m }); }
function broadcast(o) { const s = JSON.stringify(o); for (const p of players.values()) p.ws.send(s); }
function sendInv(p) { send(p, { t: 'inv', sets: p.sets || [], inv: p.inv.map(i => itemInfo(i, plv(p))), eq: Object.fromEntries(SLOTS.map(k => [k, p.eq[k] ? itemInfo(p.eq[k], plv(p)) : null])) }); }

let fx = [];
function addFx(o, inst = 0) { o.inst = inst; fx.push(o); }

function faceTo(e, tx, ty) { const dx = tx - e.x, dy = ty - e.y; e.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : (dy < 0 ? 1 : 0); }
function nearestMonster(p, range) {
  if (p.tgt) { const t = monsters.find(m => m.id === p.tgt && !m.dead && same(m, p)); if (t && dist(p, t) - (t.mt.size - 1) * 0.5 < range) return t; }
  let best = null, bd = range;
  for (const m of monsters) { if (m.dead || !same(m, p)) continue; const d = dist(p, m) - (m.mt.size - 1) * 0.5; if (d < bd) { bd = d; best = m; } }
  return best;
}

/* ============================================================
   Jour / nuit
   ============================================================ */
const CYCLE = 480; // secondes : ~5 min de jour, ~2 min de nuit
let gameTime = 60, isNight = false;
const todPhase = () => (gameTime % CYCLE) / CYCLE;
function updateDayNight() {
  const t = todPhase(), night = t >= 0.7 && t < 0.97;
  if (night === isNight) return;
  isNight = night;
  broadcast({ t: 'chat', n: '★', m: night ? 'La nuit tombe… des créatures plus dangereuses rôdent, avec un meilleur butin.' : "Le jour se lève sur le royaume d'Ambre." });
  for (const m of monsters) if (m.sp && m.sp.night) {
    if (night) { const s = freeSpot(m.sp.x, m.sp.y, m.sp.r); Object.assign(m, { dead: false, nightOff: false, x: s.x, y: s.y, hx: s.x, hy: s.y, hp: m.maxhp, target: null }); }
    else { if (!m.dead) addFx({ k: 'die', x: m.x, y: m.y }); m.dead = true; m.nightOff = true; m.target = null; }
  }
}

/* ============================================================
   Combat
   ============================================================ */
function damageMonster(p, m, amount) {
  if (m.dead) return;
  // les boss du royaume s'adaptent au joueur qui les attaque
  if (m.mt.boss && !m.mt.gen && !m.mt.world && !m.inst && !m.mt.scaled && m.hp >= m.maxhp && plv(p) > m.lvl + 5) { Object.assign(m, mobStats(Math.min(1000, plv(p)), true, 0.6)); m.hp = m.maxhp; }
  const crit = rnd() < p.st.crit / 100;
  const dmg = Math.max(1, Math.round(amount * (0.85 + rnd() * 0.3) * (crit ? p.st.critMul : 1)));
  m.hp -= dmg; m.dmgBy.add(p.id);
  if (!m.target) m.target = p.id;
  addFx({ k: 'hit', x: m.x, y: m.y - 0.6 * m.mt.size, v: dmg, c: crit ? 1 : 0, on: 'm', by: p.id }, m.inst);
  if (m.hp <= 0) killMonster(m);
}

function partyOf(p) { return p.party ? parties.get(p.party) : null; }

function killMonster(m) {
  m.dead = true; m.respawnT = m.mt.respawn; m.target = null;
  for (const p of players.values()) if (p.tgt === m.id) p.tgt = null;
  addFx({ k: 'die', x: m.x, y: m.y }, m.inst);
  const recv = new Set();
  for (const id of m.dmgBy) {
    const p = players.get(id); if (!p || !same(p, m) || dist(p, m) > 25) continue;
    recv.add(p);
    const pt = partyOf(p);
    if (pt) for (const mid of pt.members) { const q = players.get(mid); if (q && !q.dead && same(q, m) && dist(q, m) < 25) recv.add(q); }
  }
  const nightMul = isNight && !m.inst ? 1.3 : 1;
  if (m.champ) {
    const I = instances.get(m.inst); m.remove = true; if (I) arenaEnd(I, true); m.dmgBy.clear(); return;
  }
  for (const p of recv) {
    p.stats.kills++; const kc = p.stats['k_' + m.type] = (p.stats['k_' + m.type] || 0) + 1;
    if (!m.mt.scaled && (kc === 25 || kc === 100)) {
      const g = Math.round(20 * m.lvl * (kc === 100 ? 4 : 1)); p.gold += g;
      if (kc === 100) { p.stats.mastered = (p.stats.mastered || 0) + 1; recalc(p); }
      else p.stats.studied = (p.stats.studied || 0) + 1;
      addFx({ k: 'qprog', x: p.x, y: p.y - 1.8, t: kc === 100 ? `Bestiaire : ${m.mt.name} maîtrisé !` : `Bestiaire : ${m.mt.name} étudié` }, p.inst);
      msg(p, kc === 100 ? `Bestiaire : ${m.mt.name} maîtrisé (+${g} or, +0,1 % de dégâts pour toujours).` : `Bestiaire : ${m.mt.name} étudié (+${g} or).`);
    }
    if (m.mt.boss) { p.stats['b_' + m.type] = (p.stats['b_' + m.type] || 0) + 1; dailyProg(p, 'boss'); }
    dailyProg(p, 'kill', m.type);
    checkAch(p);
    if (p.dead) continue;
    const diff = plv(p) - m.lvl;
    let xp = m.xp * (diff > 4 ? Math.max(0.15, 1 - (diff - 4) * 0.2) : 1) * nightMul;
    if (recv.size > 1) xp *= 0.8;
    if (p.autoMode) xp *= 0.7;
    else {
      const now = Date.now(); p.streak = now - (p.lastKill || 0) < 8000 ? (p.streak || 0) + 1 : 1; p.lastKill = now;
      if (p.streak >= 3) { xp *= 1 + Math.min(0.25, p.streak * 0.025); if (p.streak % 5 === 0) addFx({ k: 'qprog', x: p.x, y: p.y - 1.6, t: `Série ×${p.streak} : +${Math.round(Math.min(25, p.streak * 2.5))} % XP` }, p.inst); }
    }
    if (evt.k === 'etoiles') xp *= 2;
    if (LOCAL && p.allies) xp *= 1 + 0.15 * p.allies;
    giveXp(p, Math.round(xp));
    questKill(p, m);
  }
  const names = [...recv].map(h => h.name);
  if (m.mt.boss && names.length && !m.inst) broadcast({ t: 'chat', n: '★', m: `${names.join(', ')} ${names.length > 1 ? 'ont' : 'a'} vaincu ${m.mt.name} !` });
  m.dmgBy.clear();
  if (m.mt.world) { dragonLoot(m, recv); m.remove = true; }
  const d0 = drops.length;
  const gemN = m.mt.boss ? 2 : (rnd() < 0.04 + (isNight ? 0.02 : 0) ? 1 : 0);
  for (let i = 0; i < gemN; i++) drops.push({ id: nextId++, x: m.x - 0.4 + rnd() * 0.8, y: m.y + 0.3, k: 'mat', mk: 'g_' + randGem(m.mt.boss ? 2 + Math.floor(rnd() * 2) : 1), v: 1, ttl: 90, inst: m.inst });
  const g = m.gold;
  drops.push({ id: nextId++, x: m.x, y: m.y, k: 'gold', v: Math.round((g[0] + rnd() * (g[1] - g[0])) * nightMul), ttl: 60, inst: m.inst });
  if (rnd() < (m.mt.boss ? 1 : 0.1)) drops.push({ id: nextId++, x: m.x + 0.4, y: m.y + 0.2, k: 'pot', v: m.mt.boss ? 5 : 1, ttl: 60, inst: m.inst });
  const nItems = m.mt.boss ? 2 : (rnd() < (0.055 + (isNight ? 0.04 : 0) + (evt.k === 'etoiles' ? 0.06 : 0)) ? 1 : 0);
  const looter = [...recv][0];
  for (let i = 0; i < nItems; i++) drops.push({ id: nextId++, x: m.x - 0.5 + rnd(), y: m.y - 0.3 + rnd() * 0.6, k: 'item', item: newItem(m.lvl, m.mt.minRar || 0, undefined, looter && looter.cls), ttl: 90, inst: m.inst });
  for (let i = d0; i < drops.length; i++) if (blocked(drops[i].x, drops[i].y, 0.15)) { drops[i].x = m.x; drops[i].y = m.y; }
  if (m.evt) {
    m.remove = true;
    for (const p of recv) { p.stats.events = (p.stats.events || 0) + (m.evt === 2 || !p.evtCounted ? 1 : 0); p.evtCounted = evt.until; const g = Math.round(m.lvl * (m.evt === 2 ? 80 : 12)); p.gold += g; if (m.evt === 2 || rnd() < 0.25) { const it = newItem(m.lvl, m.evt === 2 ? 5 : 3, undefined, p.cls); if (rnd() < 0.15 && m.evt === 2) it.r = 6; if (p.inv.length < INV_SIZE) { p.inv.push(it); sendInv(p); } } msg(p, `Événement : +${g} or.`); checkAch(p); }
  }
  if (m.inst) { m.remove = true; const I = instances.get(m.inst); if (I) instanceCheck(I); }
}

function giveXp(p, xp) {
  p.xp += xp;
  let up = false;
  while (p.xp >= xpNext(plv(p)) && p.lvl < MAX_LVL) {
    p.xp -= xpNext(plv(p)); p.lvl++; up = true;
    recalc(p); p.hp = maxHp(p);
    addFx({ k: 'lvl', x: p.x, y: p.y, id: p.id }, p.inst);
    msg(p, `Niveau ${p.lvl} ! Tu te sens plus fort.`);
    for (const s of CLASSES[p.cls].skills) if (s.lvl === plv(p)) msg(p, `Nouvelle compétence : ${s.name} !`);
  }
  if (p.lvl >= MAX_LVL) p.xp = Math.min(p.xp, xpNext(plv(p)));
  if (up) { send(p, { t: 'lvlup', lvl: p.lvl }); sendInv(p); checkAch(p); if (p.lvl === MAX_LVL) msg(p, 'Niveau 100 ! La réincarnation est disponible dans le panneau Talents.'); }
}

function questKill(p, m) {
  if (!p.q.on) return;
  const q = questFor(p);
  if (q.type !== m.type || p.q.prog >= q.n) return;
  if (q.item && rnd() > q.chance) return;
  p.q.prog++;
  addFx({ k: 'qprog', x: p.x, y: p.y - 1.4, t: q.item ? `+1 ${q.item}` : `${p.q.prog}/${q.n}` }, p.inst);
  if (p.q.prog >= q.n) msg(p, `Quête « ${q.name} » terminée ! Retourne voir le Capitaine Aldric.`);
}

const drops = [];
let evt = { k: '', until: 0, name: '' }; // événement mondial en cours

function doAttack(p) {
  const c = CLASSES[p.cls];
  if (p.dead || p.atkCd > 0) return;
  p.atkCd = c.cd; dismount(p); p.gath = null;
  const m = nearestMonster(p, c.range + p.st.range);
  if (m) faceTo(p, m.x, m.y);
  const off = [[0, 5], [0, -5], [-5, 0], [5, 0]][p.dir];
  if (p.cls === 'guerrier' || p.cls === 'paladin' || p.cls === 'assassin') { addFx({ k: 'slash', x: p.x, y: p.y, d: p.dir, id: p.id, c: p.cls }, p.inst); if (m) damageMonster(p, m, baseDmg(p)); }
  else if (p.cls === 'druide') {
    if (m) { addFx({ k: 'thorn', x: p.x, y: p.y - 0.6, x2: m.x, y2: m.y - 0.4, id: p.id }, p.inst); damageMonster(p, m, baseDmg(p)); }
    else addFx({ k: 'thorn', x: p.x, y: p.y - 0.6, x2: p.x + off[0] * 0.8, y2: p.y - 0.6 + off[1] * 0.8, id: p.id }, p.inst);
  }
  else if (p.cls === 'archere') {
    if (m) { addFx({ k: 'arrow', x: p.x, y: p.y - 0.5, x2: m.x, y2: m.y - 0.4, id: p.id }, p.inst); damageMonster(p, m, baseDmg(p)); }
    else addFx({ k: 'arrow', x: p.x, y: p.y - 0.5, x2: p.x + off[0], y2: p.y - 0.5 + off[1], id: p.id }, p.inst);
  } else {
    if (m) { addFx({ k: 'bolt', x: p.x, y: p.y - 0.6, x2: m.x, y2: m.y - 0.4, id: p.id }, p.inst); damageMonster(p, m, baseDmg(p)); }
    else addFx({ k: 'bolt', x: p.x, y: p.y - 0.6, x2: p.x + off[0] * 0.8, y2: p.y - 0.6 + off[1] * 0.8, id: p.id }, p.inst);
  }
}

function inRange(p, cx, cy, r) { return monsters.filter(m => !m.dead && same(m, p) && Math.hypot(m.x - cx, m.y - cy) < r + (m.mt.size - 1) * 0.5); }
function dash(p, dx, dy, len) {
  const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
  const x0 = p.x, y0 = p.y;
  for (let i = 0; i < len * 10; i++) { const bx = p.x, by = p.y; moveEnt(p, dx * 0.1, dy * 0.1); if (bx === p.x && by === p.y) break; }
  addFx({ k: 'dash', x: x0, y: y0, x2: p.x, y2: p.y, id: p.id }, p.inst);
}

// rang des compétences : II au niveau 25, III au 50, IV au 100, puis +1 toutes les 2 renaissances
const skillRank = p => Math.min(9, 1 + (plv(p) >= 25) + (plv(p) >= 50) + (plv(p) >= 100) + Math.floor(p.reborn / 2));
function doSkill(p, i) {
  const c = CLASSES[p.cls], sk = c.skills[i];
  if (!sk || p.dead) return;
  if (plv(p) < sk.lvl) return msg(p, `${sk.name} se débloque au niveau ${sk.lvl}.`);
  if (p.skCd[i] > 0) return;
  dismount(p); p.gath = null;
  const rank = skillRank(p);
  const dmg = baseDmg(p) * p.st.skillMul * (1 + 0.25 * (rank - 1));
  const key = p.cls + i;
  switch (key) {
    case 'guerrier0': addFx({ k: 'spin', x: p.x, y: p.y, r: 2.4 }, p.inst); for (const m of inRange(p, p.x, p.y, 2.4)) damageMonster(p, m, dmg * 1.7); break;
    case 'guerrier1': {
      const t = nearestMonster(p, 7);
      const dir = t ? [t.x - p.x, t.y - p.y] : [[0, 1], [0, -1], [-1, 0], [1, 0]][p.dir];
      const len = t ? Math.max(0, dist(p, t) - 0.9) : 4;
      if (t) faceTo(p, t.x, t.y);
      dash(p, dir[0], dir[1], Math.min(6, len));
      addFx({ k: 'spin', x: p.x, y: p.y, r: 1.6 }, p.inst);
      for (const m of inRange(p, p.x, p.y, 1.7)) { damageMonster(p, m, dmg * 1.5); if (!m.mt.boss) m.stunT = 1.2; }
      break;
    }
    case 'guerrier2': {
      const allies = [p];
      const pt = partyOf(p);
      if (pt) for (const id of pt.members) { const q = players.get(id); if (q && q !== p && !q.dead && same(q, p) && dist(q, p) < 7) allies.push(q); }
      for (const a of allies) { a.buffT = 8; if (a !== p) msg(a, `${p.name} pousse un cri de guerre : +40 % de dégâts !`); }
      addFx({ k: 'shout', x: p.x, y: p.y }, p.inst);
      break;
    }
    case 'archere0': {
      const targets = inRange(p, p.x, p.y, 7.5).sort((a, b) => dist(p, a) - dist(p, b)).slice(0, 4);
      if (!targets.length) { msg(p, 'Aucune cible à portée.'); return; }
      faceTo(p, targets[0].x, targets[0].y);
      for (const m of targets) { addFx({ k: 'arrow', x: p.x, y: p.y - 0.5, x2: m.x, y2: m.y - 0.4, big: 1 }, p.inst); damageMonster(p, m, dmg * 1.4); }
      break;
    }
    case 'archere1': {
      const l = Math.hypot(p.inp.dx, p.inp.dy);
      let dir = l > 0.1 ? [p.inp.dx, p.inp.dy] : null;
      if (!dir) { const t = nearestMonster(p, 8); dir = t ? [p.x - t.x, p.y - t.y] : [[0, 1], [0, -1], [-1, 0], [1, 0]][p.dir]; }
      dash(p, dir[0], dir[1], 3.6); p.invT = 0.7;
      break;
    }
    case 'archere2': {
      const t = nearestMonster(p, 8);
      const cx = t ? t.x : p.x + [0, 0, -3, 3][p.dir], cy = t ? t.y : p.y + [3, -3, 0, 0][p.dir];
      if (t) faceTo(p, t.x, t.y);
      zones.push({ x: cx, y: cy, r: 2.8, dmg: dmg * 0.75, t: 3, tick: 0, every: 0.5, owner: p.id, inst: p.inst, fx: 'rain' });
      break;
    }
    case 'mage0': {
      const t = nearestMonster(p, 6.5);
      if (!t) { msg(p, 'Aucune cible à portée.'); return; }
      faceTo(p, t.x, t.y);
      addFx({ k: 'meteor', x: t.x, y: t.y, r: 2.6, ox: p.x, oy: p.y }, p.inst);
      for (const m of inRange(p, t.x, t.y, 2.6)) damageMonster(p, m, dmg * 2.1);
      break;
    }
    case 'mage1': p.shield = Math.round(maxHp(p) * 0.4); p.shieldT = 8; addFx({ k: 'shield', x: p.x, y: p.y }, p.inst); break;
    case 'paladin0': {
      addFx({ k: 'holy', x: p.x, y: p.y, r: 2.3 }, p.inst);
      const hit = inRange(p, p.x, p.y, 2.3);
      for (const m of hit) damageMonster(p, m, dmg * 1.5);
      if (hit.length) { p.hp = Math.min(maxHp(p), p.hp + Math.round(maxHp(p) * Math.min(0.3, 0.08 * hit.length) * p.st.healMul)); addFx({ k: 'heal', x: p.x, y: p.y }, p.inst); }
      break;
    }
    case 'paladin1': {
      const allies = [p]; const pt = partyOf(p);
      if (pt) for (const id of pt.members) { const q = players.get(id); if (q && q !== p && !q.dead && same(q, p) && dist(q, p) < 7) allies.push(q); }
      for (const a of allies) { a.hp = Math.min(maxHp(a), a.hp + Math.round(maxHp(a) * 0.35 * p.st.healMul)); addFx({ k: 'heal', x: a.x, y: a.y }, a.inst); }
      addFx({ k: 'holy', x: p.x, y: p.y, r: 7 }, p.inst);
      break;
    }
    case 'paladin2': {
      const t = nearestMonster(p, 3.2);
      if (!t) { msg(p, 'Aucune cible à portée.'); return; }
      faceTo(p, t.x, t.y); addFx({ k: 'judge', x: t.x, y: t.y }, p.inst); addFx({ k: 'slam', x: p.x, y: p.y, d: p.dir }, p.inst);
      damageMonster(p, t, dmg * 3.2); if (!t.mt.boss) t.stunT = 2;
      break;
    }
    case 'assassin0': {
      const t = nearestMonster(p, 7);
      if (!t) { msg(p, 'Aucune cible à portée.'); return; }
      const a = Math.atan2(t.y - p.y, t.x - p.x), bx = t.x + Math.cos(a) * 0.8, by = t.y + Math.sin(a) * 0.8;
      addFx({ k: 'smoke', x: p.x, y: p.y }, p.inst); addFx({ k: 'shadow', id: p.id, x: p.x, y: p.y, x2: bx, y2: by }, p.inst);
      if (!blocked(bx, by)) { p.x = bx; p.y = by; } else dash(p, t.x - p.x, t.y - p.y, Math.max(0, dist(p, t) - 0.8));
      faceTo(p, t.x, t.y); addFx({ k: 'smoke', x: p.x, y: p.y }, p.inst); addFx({ k: 'slash', x: p.x, y: p.y, d: p.dir, id: p.id, c: 'assassin' }, p.inst);
      damageMonster(p, t, dmg * 2.4); send(p, { t: 'tp' });
      break;
    }
    case 'assassin1':
      p.invT = 2.5; addFx({ k: 'smoke', x: p.x, y: p.y, big: 1 }, p.inst);
      for (const m of monsters) if (m.target === p.id) { m.target = null; m.returning = !m.inst; }
      break;
    case 'assassin2': zones.push({ x: p.x, y: p.y, r: 2.6, dmg: dmg * 0.7, t: 2, tick: 0, every: 0.4, owner: p.id, inst: p.inst, follow: true, fx: 'blades' }); break;
    case 'druide0': {
      const t = nearestMonster(p, 6.5);
      if (!t) { msg(p, 'Aucune cible à portée.'); return; }
      faceTo(p, t.x, t.y); addFx({ k: 'roots', x: t.x, y: t.y, r: 2.4 }, p.inst);
      for (const m of inRange(p, t.x, t.y, 2.4)) { damageMonster(p, m, dmg * 1.4); m.slowT = 3; }
      break;
    }
    case 'druide1': {
      const allies = [p]; const pt = partyOf(p);
      if (pt) for (const id of pt.members) { const q = players.get(id); if (q && q !== p && !q.dead && same(q, p) && dist(q, p) < 6) allies.push(q); }
      for (const a of allies) { a.regenT = 8; a.regenMul = p.st.healMul; }
      addFx({ k: 'heal', x: p.x, y: p.y }, p.inst);
      break;
    }
    case 'druide2': {
      const t = nearestMonster(p, 8);
      const cx = t ? t.x : p.x + [0, 0, -3, 3][p.dir], cy = t ? t.y : p.y + [3, -3, 0, 0][p.dir];
      if (t) faceTo(p, t.x, t.y);
      zones.push({ x: cx, y: cy, r: 3, dmg: dmg * 0.85, t: 3, tick: 0, every: 0.5, owner: p.id, inst: p.inst, fx: 'storm' });
      break;
    }
    case 'guerrier3': {
      addFx({ k: 'quake', x: p.x, y: p.y, r: 4.2 }, p.inst); addFx({ k: 'spin', x: p.x, y: p.y, r: 4 }, p.inst);
      for (const m of inRange(p, p.x, p.y, 4.2)) { damageMonster(p, m, dmg * 4.5); if (!m.mt.boss) m.stunT = 2; }
      break;
    }
    case 'archere3': {
      const t = nearestMonster(p, 10);
      const d = t ? [t.x - p.x, t.y - p.y] : [[0, 1], [0, -1], [-1, 0], [1, 0]][p.dir], l = Math.hypot(d[0], d[1]) || 1, ux = d[0] / l, uy = d[1] / l;
      if (t) faceTo(p, t.x, t.y);
      const ex = p.x + ux * 11, ey = p.y + uy * 11;
      addFx({ k: 'laser', x: p.x, y: p.y - 0.5, x2: ex, y2: ey - 0.5 }, p.inst);
      for (const m of monsters) { if (m.dead || !same(m, p)) continue; const px = m.x - p.x, py = m.y - p.y, along = px * ux + py * uy; if (along < 0 || along > 11) continue; if (Math.abs(px * uy - py * ux) < 1.3 + (m.mt.size - 1) * 0.5) damageMonster(p, m, dmg * 4); }
      break;
    }
    case 'mage3': {
      const t = nearestMonster(p, 8); const cx = t ? t.x : p.x, cy = t ? t.y : p.y;
      if (t) faceTo(p, t.x, t.y);
      for (let n = 0; n < 4; n++) {
        const x = cx + (n ? (rnd() - 0.5) * 4 : 0), y = cy + (n ? (rnd() - 0.5) * 3 : 0);
        addFx({ k: 'meteor', x, y, r: 2.4, dl: n * 0.25 }, p.inst);
        for (const m of inRange(p, x, y, 2.4)) damageMonster(p, m, dmg * 2.4);
      }
      break;
    }
    case 'paladin3': {
      const allies = [p]; const pt = partyOf(p);
      if (pt) for (const id of pt.members) { const q = players.get(id); if (q && q !== p && !q.dead && same(q, p) && dist(q, p) < 7) allies.push(q); }
      for (const a of allies) { a.invT = 3; a.hp = Math.min(maxHp(a), a.hp + Math.round(maxHp(a) * 0.5 * p.st.healMul)); addFx({ k: 'heal', x: a.x, y: a.y }, a.inst); addFx({ k: 'shield', x: a.x, y: a.y }, a.inst); }
      addFx({ k: 'holy', x: p.x, y: p.y, r: 7 }, p.inst);
      break;
    }
    case 'assassin3': {
      const t = nearestMonster(p, 3.5);
      if (!t) { msg(p, 'Aucune cible à portée.'); return; }
      faceTo(p, t.x, t.y);
      for (let n = 0; n < 8; n++) { addFx({ k: 'slash', x: p.x, y: p.y, d: n % 4, id: p.id, c: 'assassin' }, p.inst); damageMonster(p, t, dmg * 1.05); if (t.dead) break; }
      break;
    }
    case 'druide3': {
      const allies = [p]; const pt = partyOf(p);
      if (pt) for (const id of pt.members) { const q = players.get(id); if (q && q !== p && !q.dead && same(q, p) && dist(q, p) < 7) allies.push(q); }
      for (const a of allies) { a.hp = Math.min(maxHp(a), a.hp + Math.round(maxHp(a) * 0.4 * p.st.healMul)); a.regenT = 10; a.regenMul = p.st.healMul; addFx({ k: 'heal', x: a.x, y: a.y }, a.inst); }
      zones.push({ x: p.x, y: p.y, r: 4, dmg: dmg * 1.2, t: 5, tick: 0, every: 0.5, owner: p.id, inst: p.inst, follow: true, fx: 'storm' });
      addFx({ k: 'roots', x: p.x, y: p.y, r: 4 }, p.inst);
      break;
    }
    case 'mage2':
      addFx({ k: 'nova', x: p.x, y: p.y, r: 3.2 }, p.inst);
      for (const m of inRange(p, p.x, p.y, 3.2)) { damageMonster(p, m, dmg * 1.6); m.slowT = 4; }
      break;
  }
  addFx({ k: 'cast', id: p.id, x: p.x, y: p.y, sk: key }, p.inst);
  p.skCd[i] = sk.cd * p.st.cdMul * (1 - 0.04 * (rank - 1));
}
const zones = [];

function usePotion(p) {
  if (p.dead) return;
  if (p.pots <= 0) return msg(p, "Tu n'as plus de potion. Elya en vend au village.");
  const mh = maxHp(p);
  if (p.hp >= mh) return msg(p, 'Tes points de vie sont déjà au maximum.');
  if (p.potCd > 0) return;
  p.potCd = 2; p.pots--; p.hp = Math.min(mh, p.hp + Math.round(mh * 0.45) + 20);
  addFx({ k: 'heal', x: p.x, y: p.y }, p.inst);
}

function hurtPlayer(p, amount, src) {
  if (p.dead || p.invT > 0) return;
  dismount(p); p.gath = null;
  const K = 90 + 8 * Math.max(0, ((src && src.lvl) || plv(p)) - 10);
  let dmg = Math.max(1, Math.round(amount * (0.85 + rnd() * 0.3) * (1 - p.st.def / (p.st.def + K)) * (1 - p.st.red)));
  if (p.shield > 0) { const a = Math.min(p.shield, dmg); p.shield -= a; dmg -= a; addFx({ k: 'absorb', x: p.x, y: p.y - 0.8, v: a }, p.inst); if (dmg <= 0) return; }
  p.hp -= dmg; p.lastHurt = Date.now();
  addFx({ k: 'hit', x: p.x, y: p.y - 0.8, v: dmg, on: 'p', id: p.id }, p.inst);
  if (p.hp <= 0) {
    p.hp = 0; p.dead = true; p.deadT = 4; p.autoAtk = false;
    const lost = Math.min(Math.floor(p.gold * 0.1), 30 * plv(p)); p.gold -= lost;
    const I0 = p.inst ? instances.get(p.inst) : null;
    if (!I0 || I0.kind !== 'arena') { p.xp = Math.max(0, p.xp - Math.round(xpNext(plv(p)) * 0.05)); p.wear = Math.min(50, (p.wear || 0) + 10); recalc(p); }
    addFx({ k: 'die', x: p.x, y: p.y }, p.inst);
    const I = p.inst ? instances.get(p.inst) : null;
    if (I && I.kind === 'arena') { p.gold += lost; arenaEnd(I, false); }
    else msg(p, `Tu as été vaincu par ${src.champ ? src.champ.n : src.mt.name}${lost ? `, tu perds ${lost} pièces d'or` : ''} et un peu d'expérience. Ton équipement s'use (${p.wear} %) : Brann peut le réparer.`);
    for (const m of monsters) if (m.target === p.id) m.target = null;
  }
}

function respawnAt(p) {
  const wp = WAYPOINTS.find(w => w.id === p.wp) || WAYPOINTS[0];
  leaveInstance(p);
  p.x = wp.x + (rnd() - 0.5) * 0.6; p.y = wp.y + 0.8; p.hp = maxHp(p);
}

/* ============================================================
   Dialogues avec les PNJ
   ============================================================ */
function dlg(p, title, text, opts) { p.dlgOpts = opts.map(o => o.id); send(p, { t: 'dlg', title, text, opts }); }

function interact(p) {
  if (p.dead) return;
  const near = (o, r) => Math.hypot(o.x - p.x, o.y - p.y) < r;
  if (p.inst) return msg(p, 'Impossible ici.');
  const npc = NPCS.filter(n => near(n, 2.2)).sort((u, v) => Math.hypot(u.x - p.x, u.y - p.y) - Math.hypot(v.x - p.x, v.y - p.y))[0];
  const wp = WAYPOINTS.find(w => near(w, 1.8));
  if (npc) return npcDialog(p, npc);
  if (wp) return wpDialog(p, wp);
  msg(p, 'Personne à qui parler ici.');
}

function npcDialog(p, npc) {
  if (npc.kind === 'forge') { sendInv(p); return send(p, { t: 'forgeui' }); }
  if (npc.kind === 'bank') { sendBank(p); return send(p, { t: 'bankui' }); }
  if (npc.kind === 'shop') {
    const commons = p.inv.filter(i => i.r <= 1);
    const val = commons.reduce((s, i) => s + itemInfo(i).value, 0);
    const pc = potPrice(p);
    return dlg(p, npc.name, `« Mes potions rendent près de la moitié de ta vie. Pour un aventurier de ta trempe, il me faut des ingrédients rares : ${pc} pièces d'or chacune. Je rachète aussi tes objets. »`,
      [{ id: 'buy1', label: `1 potion (${pc} or)`, off: p.gold < pc }, { id: 'buy5', label: `5 potions (${pc * 5} or)`, off: p.gold < pc * 5 }, { id: 'buy20', label: `20 potions (${pc * 20} or)`, off: p.gold < pc * 20 },
       { id: 'sellc', label: `Vendre les communs et peu communs (${val} or)`, off: !commons.length }, { id: 'close', label: 'Au revoir' }]);
  }
  if (npc.kind === 'quest') {
    p.dlgGiver = npc.id;
    if (p.q.on && (p.q.g || 'quest') !== npc.id) {
      const cur = questFor(p), who = NPCS.find(n => n.id === (p.q.g || 'quest'));
      return dlg(p, npc.name, `« Tu es déjà occupé·e : ${cur.name} (${p.q.prog} / ${cur.n}), pour ${who ? who.name : 'quelqu\'un d\'autre'}. Termine-la ou abandonne-la, puis reviens me voir. »`, [{ id: 'close', label: 'D\'accord' }, { id: 'qdrop', label: 'Abandonner ma quête actuelle' }]);
    }
    if (npc.zone && plv(p) < ZONES[npc.zone - 1].lv[0] - 10) return dlg(p, npc.name, `« Cette région est trop dangereuse pour toi (niveau conseillé : ${ZONES[npc.zone - 1].lv[0]}). Reviens plus aguerri·e. »`, [{ id: 'close', label: 'Compris' }]);
    const q = questFor(p, npc.id);
    if (!p.q.on) return dlg(p, `${npc.name} · ${q.name}`, `« ${q.text} »\n\nRécompense : ${q.xp} XP, ${q.gold} or${q.reward ? ' et un objet ' + RAR_NAMES[q.reward.r].toLowerCase() : ''}.${npc.zone ? `\n\nChaîne de la région : étape ${Math.min(4, (p.rq[npc.zone] | 0) + 1)} / 4.` : ''}`,
      [{ id: 'qaccept', label: 'Accepter' }, { id: 'close', label: 'Plus tard' }]);
    if (p.q.prog >= q.n) return dlg(p, `${npc.name} · ${q.name}`, '« Beau travail ! Le village te doit beaucoup. Voici ta récompense. »', [{ id: 'qturn', label: 'Recevoir la récompense' }]);
    return dlg(p, `${npc.name} · ${q.name}`, `« ${q.text} »\n\nProgression : ${p.q.prog} / ${q.n}.`, [{ id: 'close', label: "J'y retourne" }, { id: 'qdrop', label: 'Abandonner' }]);
  }
  if (npc.kind === 'dungeon') {
    const dj = DUNGEONS.find(d => d.n === npc.dj);
    const pt = partyOf(p);
    const n = pt ? [...pt.members].filter(id => { const q = players.get(id); return q && !q.inst && !q.dead && dist(q, p) < 10; }).length : 1;
    return dlg(p, npc.name, `Donjon de niveau ${dj.L}. Deux salles de gardiens, puis un boss aux attaques à éviter : sors des cercles rouges, il appelle des renforts et entre en furie à mi-vie. Prévu pour un groupe, faisable seul avec un bon équipement.\n\nRécompense garantie : objets légendaires ou mieux, gemmes et or. Ton groupe proche (${n} joueur${n > 1 ? 's' : ''}) entre avec toi.${p.best['dj' + dj.n] ? `\n\nDéjà terminé ${p.best['dj' + dj.n]} fois.` : ''}`,
      [{ id: 'djenter', label: `Entrer (${dj.name})`, off: plv(p) < dj.L - 30 }, { id: 'close', label: 'Pas maintenant' }]);
  }
  if (npc.kind === 'portal') {
    const pt = partyOf(p);
    const n = pt ? [...pt.members].filter(id => { const q = players.get(id); return q && !q.inst && !q.dead && dist(q, p) < 10; }).length : 1;
    return dlg(p, npc.name, `Un tourbillon d'ombre mène au Gouffre : trois vagues d'ombres puis leur Gardien, réglés sur ton niveau. Ton groupe proche (${n} joueur${n > 1 ? 's' : ''}) entre avec toi.\n\nLe portail ouvre aussi la Tour sans fin : des étages de plus en plus durs, seul. Ton record : étage ${p.stats.tower}.`,
      [{ id: 'enter', label: 'Entrer dans le Gouffre' }, { id: 'tower', label: 'Tour sans fin (étage 1)' }, { id: 'close', label: 'Pas maintenant' }]);
  }
  if (npc.kind === 'stable') {
    const opts = [];
    for (const [k, mo] of Object.entries(MOUNTS)) {
      if (p.mounts.has(k)) { if (p.mount !== k) opts.push({ id: 'msel:' + k, label: `Prendre ${mo.name} (+${mo.spd} % de vitesse)` }); }
      else if (mo.cost) opts.push({ id: 'mbuy:' + k, label: `Acheter ${mo.name} (+${mo.spd} %) : ${mo.cost} or`, off: p.gold < mo.cost });
    }
    opts.push({ id: 'close', label: 'Au revoir' });
    return dlg(p, npc.name, `« Une monture te fait voyager bien plus vite hors combat. Monte ou descends avec le bouton Monture (touche R). Le Destrier spectral, lui, ne se trouve que sur Vyrmax, le dragon. »${p.mount ? `\n\nTa monture : ${MOUNTS[p.mount].name}.` : ''}`, opts);
  }
}

function wpDialog(p, wp) { send(p, { t: 'travel' }); }
// Voyage : téléportation vers une pierre activée, depuis n'importe où hors combat
function wpTeleport(p, id) {
  const w = WAYPOINTS.find(w => w.id === id);
  if (!w || !p.wps.has(w.id) || p.dead) return;
  if (p.inst) return msg(p, 'Impossible depuis le Gouffre.');
  if (Date.now() - p.lastHurt < 5000) return msg(p, 'Impossible en plein combat : éloigne-toi quelques secondes.');
  if ((p.tpCd || 0) > Date.now()) return msg(p, `Les pierres se rechargent encore ${Math.ceil((p.tpCd - Date.now()) / 1000)} s.`);
  if (p.tpCast) return;
  // incantation : il faut rester immobile un instant
  p.autoAtk = false; p.tgt = null; p.gath = null; dismount(p);
  p.tpCast = { id: w.id, t: TP_CAST, at: Date.now() };
  addFx({ k: 'tpcast', id: p.id, x: p.x, y: p.y, d: TP_CAST });
}
const TP_CAST = 1.6;
function tpCastTick(p, dt) {
  const c = p.tpCast; if (!c) return;
  if (p.mv || p.dead || p.lastHurt > c.at || p.inst) { p.tpCast = null; addFx({ k: 'tpcancel', id: p.id, x: p.x, y: p.y }); if (!p.dead) msg(p, 'Téléportation interrompue.'); return; }
  c.t -= dt; if (c.t > 0) return;
  p.tpCast = null;
  const w = WAYPOINTS.find(q => q.id === c.id); if (!w) return;
  p.tpCd = Date.now() + 5000;
  addFx({ k: 'tpout', x: p.x, y: p.y }); p.x = w.x; p.y = w.y + 0.8; addFx({ k: 'tpin', x: p.x, y: p.y, id: p.id });
  send(p, { t: 'tp' }); msg(p, `Téléporté à : ${w.name}.`);
}

function onDlg(p, id) {
  if (!p.dlgOpts || !p.dlgOpts.includes(id)) return;
  p.dlgOpts = null;
  const npcNear = kind => NPCS.find(n => n.kind === kind && Math.hypot(n.x - p.x, n.y - p.y) < 3);
  if (id === 'close') return;

  if ((id === 'buy1' || id === 'buy5' || id === 'buy20') && npcNear('shop')) {
    const n = id === 'buy1' ? 1 : id === 'buy5' ? 5 : 20, pc = potPrice(p);
    if (p.gold < pc * n) return msg(p, "Tu n'as pas assez d'or.");
    p.gold -= pc * n; p.pots += n; addFx({ k: 'coin', x: p.x, y: p.y });
    msg(p, `Elya te vend ${n} potion${n > 1 ? 's' : ''} (${p.pots} en stock).`); return;
  }
  if (id === 'sellc' && npcNear('shop')) {
    let g = 0; p.inv = p.inv.filter(i => { if (i.r <= 1) { g += itemInfo(i).value; return false; } return true; });
    p.gold += g; sendInv(p); addFx({ k: 'coin', x: p.x, y: p.y }); msg(p, `Tu vends tes objets communs et peu communs pour ${g} pièces d'or.`); return;
  }
  if (id === 'qaccept' && npcNear('quest')) { p.q.on = true; p.q.prog = 0; p.q.g = p.dlgGiver || 'quest'; msg(p, `Nouvelle quête : ${questFor(p).name}.`); return; }
  if (id === 'qdrop' && npcNear('quest')) { p.q.on = false; p.q.prog = 0; p.q.g = null; msg(p, 'Quête abandonnée.'); return; }
  if (id === 'qturn' && npcNear('quest')) {
    const q = questFor(p); if (!p.q.on || p.q.prog < q.n) return;
    p.q.on = false; p.q.prog = 0; p.q.g = null;
    if (q.rk) { if (!q.bounty) { p.rq[q.rk] = (p.rq[q.rk] | 0) + 1; if (p.rq[q.rk] === 4) { p.stats.regions = (p.stats.regions || 0) + 1; broadcast({ t: 'chat', n: '★', m: `${p.name} a libéré la région ${ZONES[q.rk - 1].name} !` }); } } }
    else if (!q.bounty) p.q.i++;
    p.gold += q.gold; giveXp(p, q.xp);
    let extra = '';
    if (q.reward) { const it = newItem(Math.max(plv(p), MTYPES[q.type].lvl), q.reward.r, q.reward.s || undefined, p.cls); if (p.inv.length < INV_SIZE) { p.inv.push(it); extra = ` et ${itemInfo(it, plv(p)).name}`; sendInv(p); } }
    addFx({ k: 'chest', x: p.x, y: p.y });
    msg(p, `Récompense : ${q.xp} XP, ${q.gold} or${extra}.`); return;
  }
  if (id === 'enter' && npcNear('portal')) return enterInstance(p);
  if (id === 'djenter') { const nd = NPCS.find(n => n.kind === 'dungeon' && Math.hypot(n.x - p.x, n.y - p.y) < 3); if (nd) return enterDungeon(p, DUNGEONS.find(d => d.n === nd.dj)); }
  if (id === 'tower' && npcNear('portal')) return enterTower(p);
  if (id.startsWith('mbuy:') && npcNear('stable')) {
    const k = id.slice(5), mo = MOUNTS[k]; if (!mo || !mo.cost || p.mounts.has(k)) return;
    if (p.gold < mo.cost) return msg(p, "Tu n'as pas assez d'or.");
    p.gold -= mo.cost; p.mounts.add(k); p.mount = k; msg(p, `Tu achètes : ${mo.name}. Touche « Monture » pour monter.`); return;
  }
  if (id.startsWith('msel:')) { const k = id.slice(5); if (p.mounts.has(k)) { p.mount = k; if (p.riding) recalc(p); msg(p, `Monture choisie : ${MOUNTS[k].name}.`); } return; }

}

/* ============================================================
   Gouffre instancié
   ============================================================ */
const instances = new Map();
const WAVES = [[['ombre', 6]], [['ombre', 8]], [['ombre', 10]], [['gardien', 1], ['ombre', 4]]];
function scaledStats(type, L) {
  if (type === 'gardien') { const b = mobStats(L + 2, true); return b; }
  return mobStats(L, false, 0.75);
}
function enterInstance(p) {
  const group = [p];
  const pt = partyOf(p);
  if (pt) for (const id of pt.members) { const q = players.get(id); if (q && q !== p && !q.inst && !q.dead && dist(q, p) < 10) group.push(q); }
  const L = Math.max(3, Math.round(group.reduce((s, q) => s + plv(q), 0) / group.length));
  const I = { id: nextId++, players: new Set(), wave: -1, L, state: 'start', timer: 3, done: false };
  instances.set(I.id, I);
  for (const q of group) {
    addFx({ k: 'tp', x: q.x, y: q.y });
    q.inst = I.id; I.players.add(q.id);
    q.x = 48.5 + (rnd() - 0.5) * 2; q.y = ARENA.y1 - 1; q.tgt = null;
    addFx({ k: 'tp', x: q.x, y: q.y }, I.id);
    send(q, { t: 'tp' });
    msg(q, `Tu entres dans le Gouffre (niveau ${L}). Les ombres arrivent…`);
  }
}
function enterDungeon(p, dj) {
  if (!dj || p.inst || p.dead) return;
  const group = [p], pt = partyOf(p);
  if (pt) for (const id of pt.members) { const q = players.get(id); if (q && q !== p && !q.inst && !q.dead && dist(q, p) < 10) group.push(q); }
  const I = { id: nextId++, kind: 'donjon', dj, players: new Set(), wave: -1, L: dj.L, state: 'start', timer: 3, size: group.length };
  instances.set(I.id, I);
  for (const q of group) {
    dismount(q); addFx({ k: 'tp', x: q.x, y: q.y });
    q.inst = I.id; I.players.add(q.id); q.x = 48.5 + (rnd() - 0.5) * 2; q.y = ARENA.y1 - 1; q.tgt = null; q.hp = maxHp(q);
    addFx({ k: 'tp', x: q.x, y: q.y }, I.id); send(q, { t: 'tp' });
    msg(q, `Tu entres dans ${dj.name} (niveau ${dj.L}). Les gardiens approchent…`);
  }
}
function dungeonWave(I) {
  const k = I.dj.k, L = I.L, n = I.size, w = I.wave;
  const spawn = (type, mul, boss, extra) => { const s = freeSpot(48, ARENA.y0 + 4, boss ? 1 : 8); return makeMonster(type, s.x, s.y, { inst: I.id, ...mobStats(L + (boss ? 3 : 0), boss, mul), ...extra }); };
  if (w === 0) { for (let i = 0; i < 6 + n * 2; i++) spawn(`z${k}_${i % 3}`, 1.2 * (1 + 0.25 * (n - 1)), false); instanceMsg(I, 'Salle 1 : les gardiens du donjon !'); }
  else if (w === 1) { for (let i = 0; i < 7 + n * 2; i++) spawn(`z${k}_${(i + 1) % 3}`, 1.3 * (1 + 0.25 * (n - 1)), false); for (let i = 0; i < 2; i++) spawn(`z${k}_2`, 3.2 * (1 + 0.3 * (n - 1)), false); instanceMsg(I, 'Salle 2 : deux champions mènent la garde !'); }
  else {
    const b = spawn(`z${k}_B`, 1.5 * (1 + 0.6 * (n - 1)), true, { mech: { warn: 5, nova: 10, adds: 16, furie: false } });
    b.djBoss = true;
    instanceMsg(I, `${MTYPES[`z${k}_B`].name} se réveille ! Évite les cercles rouges.`);
  }
}
const mechHits = [];
function bossMechanics(m, dt) {
  const M = m.mech; if (!M || m.dead) return;
  const I = instances.get(m.inst); if (!I) return;
  const ps = [...I.players].map(id => players.get(id)).filter(q => q && !q.dead);
  if (!ps.length) return;
  const sp = M.furie ? 0.6 : 1;
  M.warn -= dt; M.nova -= dt; M.adds -= dt;
  if (!M.furie && m.hp < m.maxhp * 0.5) { M.furie = true; m.dmg = Math.round(m.dmg * 1.3); addFx({ k: 'shout', x: m.x, y: m.y }, m.inst); instanceMsg(I, `${m.mt.name} entre en furie !`); }
  if (M.warn <= 0) { // zones ciblées sous les joueurs
    M.warn = 5 * sp;
    for (const q of ps) { const x = q.x + (rnd() - 0.5) * 0.6, y = q.y + (rnd() - 0.5) * 0.6; addFx({ k: 'warn', x, y, r: 2, d: 1.5 }, m.inst); mechHits.push({ inst: m.inst, x, y, r: 2, t: 1.5, dmg: m.dmg * 2.2, src: m }); }
  }
  if (M.nova <= 0) { // onde autour du boss
    M.nova = 11 * sp; addFx({ k: 'warn', x: m.x, y: m.y, r: 4.2, d: 1.8 }, m.inst); mechHits.push({ inst: m.inst, x: m.x, y: m.y, r: 4.2, t: 1.8, dmg: m.dmg * 3, src: m });
  }
  if (M.adds <= 0) { // renforts
    M.adds = 17 * sp;
    for (let i = 0; i < 2 + I.size; i++) { const s = freeSpot(m.x, m.y, 4); makeMonster(`z${I.dj.k}_${i % 3}`, s.x, s.y, { inst: m.inst, ...mobStats(I.L, false, 0.8), xp: 0, gold: [0, 0] }); }
    instanceMsg(I, 'Des renforts arrivent !');
  }
}
function tickMechHits(dt) {
  for (let i = mechHits.length - 1; i >= 0; i--) {
    const h = mechHits[i]; h.t -= dt; if (h.t > 0) continue;
    mechHits.splice(i, 1);
    addFx({ k: 'quake', x: h.x, y: h.y, r: h.r }, h.inst);
    for (const q of players.values()) if (!q.dead && (q.inst || 0) === h.inst && Math.hypot(q.x - h.x, q.y - h.y) < h.r) hurtPlayer(q, h.dmg, h.src);
  }
}
function dungeonDone(I) {
  I.state = 'won'; I.timer = 15;
  const dj = I.dj;
  for (const id of I.players) {
    const q = players.get(id); if (!q) continue;
    const g = Math.round(dj.L * 120); q.gold += g;
    q.best['dj' + dj.n] = (q.best['dj' + dj.n] | 0) + 1; q.stats.dungeons = (q.stats.dungeons || 0) + 1;
    const items = [newItem(dj.L + 2, 4, 'arme', q.cls), newItem(dj.L + 2, 4, undefined, q.cls)];
    if (rnd() < 0.3) items.push(newItem(dj.L + 2, 5, undefined, q.cls));
    if (rnd() < 0.08) items.push(newItem(dj.L + 2, 6, undefined, q.cls));
    const got = [];
    for (const it of items) if (q.inv.length < INV_SIZE) { q.inv.push(it); got.push(itemInfo(it, plv(q)).name); q.stats.maxRar = Math.max(q.stats.maxRar, it.r); }
    for (let i = 0; i < 3; i++) addMat(q, 'g_' + randGem(Math.min(5, 2 + Math.floor(dj.n / 3))));
    sendInv(q); addFx({ k: 'chest', x: q.x, y: q.y }, I.id); checkAch(q);
    msg(q, `${dj.name} est vaincu ! Coffre : ${g} or, 3 gemmes${got.length ? ', ' + got.join(', ') : ''}. Sortie dans 15 secondes.`);
  }
  broadcast({ t: 'chat', n: '★', m: `${[...I.players].map(id => (players.get(id) || {}).name).filter(Boolean).join(', ')} ${I.players.size > 1 ? 'ont' : 'a'} terminé le donjon ${dj.name} !` });
}
function instanceMsg(I, m) { for (const id of I.players) { const q = players.get(id); if (q) msg(q, m); } }
function instanceCheck(I) {
  if (I.state !== 'fight' || I.kind === 'arena') return;
  if (monsters.some(m => m.inst === I.id && !m.dead)) return;
  if (I.kind === 'tower') return towerCleared(I);
  if (I.kind === 'donjon') { if (I.wave >= 2) return dungeonDone(I); I.state = 'pause'; I.timer = 5; return instanceMsg(I, 'Salle nettoyée. La suite dans 5 secondes…'); }
  if (I.wave >= WAVES.length - 1) {
    I.state = 'won'; I.timer = 14;
    for (const id of I.players) {
      const q = players.get(id); if (!q) continue;
      const g = Math.round(I.L * 40); q.gold += g;
      const items = [newItem(I.L + 2, 3, 'arme', q.cls), newItem(I.L + 1, 2, undefined, q.cls)];
      let got = [];
      for (const it of items) if (q.inv.length < INV_SIZE) { q.inv.push(it); got.push(itemInfo(it, plv(q)).name); }
      sendInv(q); addFx({ k: 'chest', x: q.x, y: q.y }, I.id);
      msg(q, `Le Gardien est tombé ! Coffre : ${g} or${got.length ? ', ' + got.join(', ') : ''}. Retour au village dans 14 secondes.`);
    }
  } else { I.state = 'pause'; I.timer = 4; instanceMsg(I, `Vague ${I.wave + 1} repoussée. La suivante arrive…`); }
}
function updateInstances(dt) {
  for (const I of instances.values()) {
    for (const id of [...I.players]) { const q = players.get(id); if (!q || q.inst !== I.id) I.players.delete(id); }
    if (!I.players.size) { destroyInstance(I); continue; }
    I.timer -= dt;
    if (I.kind === 'arena') {
      if (I.state === 'fight' && I.timer <= 0) arenaEnd(I, false);
      if ((I.state === 'won' || I.state === 'lost') && I.timer <= 0) {
        for (const id of [...I.players]) { const q = players.get(id); if (q) { leaveInstance(q); const v = WAYPOINTS[0]; q.x = v.x; q.y = v.y + 0.8; q.hp = maxHp(q); send(q, { t: 'tp' }); } }
        destroyInstance(I);
      }
      continue;
    }
    if (I.kind === 'tower') {
      if ((I.state === 'start' || I.state === 'pause') && I.timer <= 0) { I.state = 'fight'; towerSpawn(I); }
      continue;
    }
    if (I.kind === 'donjon') {
      if ((I.state === 'start' || I.state === 'pause') && I.timer <= 0) { I.wave++; I.state = 'fight'; dungeonWave(I); }
      if (I.state === 'won' && I.timer <= 0) {
        const w = ZWPS.find(q => q.id === 'z' + I.dj.k) || WAYPOINTS[0];
        for (const id of [...I.players]) { const q = players.get(id); if (q) { leaveInstance(q); q.x = w.x; q.y = w.y + 0.8; q.hp = maxHp(q); send(q, { t: 'tp' }); } }
        destroyInstance(I);
      }
      continue;
    }
    if ((I.state === 'start' || I.state === 'pause') && I.timer <= 0) {
      I.wave++; I.state = 'fight';
      for (const [type, n] of WAVES[I.wave]) for (let i = 0; i < n; i++) {
        const s = freeSpot(48, ARENA.y0 + 3, type === 'gardien' ? 1 : 8);
        makeMonster(type, s.x, s.y, { inst: I.id, ...scaledStats(type, I.L) });
      }
      instanceMsg(I, I.wave === WAVES.length - 1 ? 'Le Gardien du Gouffre se dresse devant vous !' : `Vague ${I.wave + 1} / ${WAVES.length - 1}`);
    }
    if (I.state === 'won' && I.timer <= 0) {
      for (const id of [...I.players]) { const q = players.get(id); if (q) { leaveInstance(q); const v = WAYPOINTS[0]; q.x = v.x; q.y = v.y + 0.8; send(q, { t: 'tp' }); } }
      destroyInstance(I);
    }
  }
}
function leaveInstance(p) {
  if (!p.inst) return;
  const I = instances.get(p.inst); if (I) I.players.delete(p.id);
  p.inst = 0; p.tgt = null;
}
function destroyInstance(I) {
  for (const m of monsters) if (m.inst === I.id) m.remove = true;
  for (let i = drops.length - 1; i >= 0; i--) if (drops[i].inst === I.id) drops.splice(i, 1);
  instances.delete(I.id);
}

/* ============================================================
   Groupes et échanges
   ============================================================ */
const parties = new Map();
function partyInvite(p, to) {
  const q = players.get(to); if (!q || q === p) return;
  if (q.party && q.party === p.party) return msg(p, `${q.name} est déjà dans ton groupe.`);
  const pt = partyOf(p); if (pt && pt.members.size >= 4) return msg(p, 'Ton groupe est complet (4 joueurs).');
  q.partyInv = { from: p.id, t: Date.now() };
  send(q, { t: 'ask', kind: 'party', from: p.id, name: p.name }); msg(p, `Invitation envoyée à ${q.name}.`);
}
function partyAccept(p, from) {
  const q = players.get(from); if (!q || !p.partyInv || p.partyInv.from !== from) return;
  p.partyInv = null;
  partyLeave(p, true);
  let pt = partyOf(q);
  if (!pt) { pt = { id: nextId++, members: new Set([q.id]) }; parties.set(pt.id, pt); q.party = pt.id; }
  if (pt.members.size >= 4) return msg(p, 'Ce groupe est complet.');
  pt.members.add(p.id); p.party = pt.id;
  for (const id of pt.members) { const r = players.get(id); if (r) msg(r, `${p.name} rejoint le groupe.`); }
}
function partyLeave(p, silent) {
  const pt = partyOf(p); if (!pt) return;
  pt.members.delete(p.id); p.party = null;
  if (!silent) msg(p, 'Tu quittes le groupe.');
  for (const id of pt.members) { const r = players.get(id); if (r) msg(r, `${p.name} quitte le groupe.`); }
  if (pt.members.size <= 1) { for (const id of pt.members) { const r = players.get(id); if (r) r.party = null; } parties.delete(pt.id); }
}

const trades = new Map(); // id joueur -> échange
function tradeState(tr) {
  for (const [me, them] of [[tr.a, tr.b], [tr.b, tr.a]]) {
    const pm = players.get(me), pt = players.get(them); if (!pm || !pt) continue;
    const view = id => ({ items: tr.off[id].items.map(iid => { const o = players.get(id); const it = o && o.inv.find(i => i.id === iid); return it ? itemInfo(it, pm.lvl) : null; }).filter(Boolean), gold: tr.off[id].gold });
    send(pm, { t: 'trade', open: true, with: pt.name, mine: view(me), theirs: view(them), okMe: !!tr.ok[me], okThem: !!tr.ok[them] });
  }
}
function tradeEnd(tr, why) {
  for (const id of [tr.a, tr.b]) { trades.delete(id); const q = players.get(id); if (q) { send(q, { t: 'trade', open: false }); if (why) msg(q, why); } }
}
function onTrade(p, o) {
  const tr = trades.get(p.id);
  switch (o.op) {
    case 'req': {
      const q = players.get(o.to); if (!q || q === p || !same(p, q)) return;
      if (trades.has(q.id) || tr) return msg(p, 'Un échange est déjà en cours.');
      q.tradeInv = { from: p.id }; send(q, { t: 'ask', kind: 'trade', from: p.id, name: p.name }); msg(p, `Demande d'échange envoyée à ${q.name}.`); return;
    }
    case 'accept': {
      const q = players.get(o.from); if (!q || !p.tradeInv || p.tradeInv.from !== q.id || trades.has(q.id) || tr) return;
      p.tradeInv = null;
      const t = { a: q.id, b: p.id, off: { [q.id]: { items: [], gold: 0 }, [p.id]: { items: [], gold: 0 } }, ok: {} };
      trades.set(q.id, t); trades.set(p.id, t); tradeState(t); return;
    }
    case 'decline': { const q = players.get(o.from); p.tradeInv = null; if (q) msg(q, `${p.name} refuse l'échange.`); return; }
    case 'offer': {
      if (!tr) return;
      const ids = (Array.isArray(o.items) ? o.items : []).filter(id => p.inv.some(i => i.id === id)).slice(0, 8);
      tr.off[p.id] = { items: [...new Set(ids)], gold: Math.max(0, Math.min(p.gold, Math.floor(+o.gold || 0))) };
      tr.ok = {}; tradeState(tr); return;
    }
    case 'confirm': {
      if (!tr) return; tr.ok[p.id] = true;
      if (tr.ok[tr.a] && tr.ok[tr.b]) {
        const A = players.get(tr.a), B = players.get(tr.b); if (!A || !B) return tradeEnd(tr);
        const oa = tr.off[A.id], ob = tr.off[B.id];
        if (A.gold < oa.gold || B.gold < ob.gold) return tradeEnd(tr, "Échange annulé : pas assez d'or.");
        if (A.inv.length - oa.items.length + ob.items.length > INV_SIZE || B.inv.length - ob.items.length + oa.items.length > INV_SIZE) return tradeEnd(tr, 'Échange annulé : sac plein.');
        const ia = A.inv.filter(i => oa.items.includes(i.id)), ib = B.inv.filter(i => ob.items.includes(i.id));
        A.inv = A.inv.filter(i => !oa.items.includes(i.id)).concat(ib); B.inv = B.inv.filter(i => !ob.items.includes(i.id)).concat(ia);
        A.gold += ob.gold - oa.gold; B.gold += oa.gold - ob.gold;
        sendInv(A); sendInv(B); tradeEnd(tr, 'Échange réussi !');
      } else tradeState(tr);
      return;
    }
    case 'cancel': if (tr) tradeEnd(tr, 'Échange annulé.'); return;
  }
}

function boardRows() {
  const all = new Map();
  for (const [k, s] of Object.entries(saves)) if (!k.startsWith('__')) all.set(k, [s.name, s.cls, s.lvl, s.xp, s.reborn | 0, (s.stats && s.stats.tower) | 0]);
  for (const p of players.values()) all.set(p.key, [p.name, p.cls, p.lvl, p.xp, p.reborn, p.stats.tower]);
  return [...all.values()].sort((a, b) => b[4] - a[4] || b[2] - a[2] || b[3] - a[3]).slice(0, 10).map(r => [r[0], r[1], r[2], r[4], r[5]]);
}

/* ============================================================
   Talents et réincarnation
   ============================================================ */
const MAX_LVL = 100;
const TALENTS = {
  vig: { name: 'Vigueur', desc: '+1 % de vie par rang' },
  pui: { name: 'Puissance', desc: '+1 % de dégâts par rang' },
  pre: { name: 'Précision', desc: '+0,4 % de critique par rang' },
  cel: { name: 'Célérité', desc: '−0,5 % de recharge des compétences par rang' },
};
const CLASS_TALENT = {
  guerrier: { name: 'Rempart', desc: '−0,5 % de dégâts subis par rang' },
  archere: { name: 'Œil de faucon', desc: '+0,04 case de portée par rang' },
  mage: { name: 'Arcanes', desc: '+2 % de dégâts des compétences par rang' },
  paladin: { name: 'Lumière', desc: '+3 % de soins par rang' },
  assassin: { name: 'Lames cruelles', desc: '+3 % de dégâts critiques par rang' },
  druide: { name: 'Sève', desc: '+3 % de soins par rang' },
};
const TALENT_MAX = 100;
const newTal = () => ({ vig: 0, pui: 0, pre: 0, cel: 0, cls: 0 });
const talentPoints = p => (p.lvl - 1) * (p.reborn ? 2 : 1) + p.reborn * 10 - Object.values(p.tal).reduce((a, b) => a + b, 0);
function applyTalents(p, s) {
  const t = p.tal, c = p.cls;
  s.hp *= 1 + 0.01 * t.vig; s.dmg *= 1 + 0.01 * t.pui; s.crit += 0.4 * t.pre;
  s.cdMul = 1 - 0.005 * t.cel;
  s.red = c === 'guerrier' ? 0.005 * t.cls : 0;
  s.range = c === 'archere' ? 0.04 * t.cls : 0;
  s.skillMul = 1 + (c === 'mage' ? 0.02 * t.cls : 0);
  s.healMul = 1 + (c === 'paladin' || c === 'druide' ? 0.03 * t.cls : 0);
  s.critMul = 1.8 + (c === 'assassin' ? 0.03 * t.cls : 0);
  s.hp *= 1 + 0.05 * p.reborn; s.dmg *= 1 + 0.05 * p.reborn;
  const now = Date.now();
  if (p.food && p.food.until > now) s.hp *= p.food.mul;
  if (p.elix && p.elix.until > now) s.dmg *= p.elix.mul;
  s.mountSpd = p.riding && MOUNTS[p.mount] ? MOUNTS[p.mount].spd : 0;
}
function reincarnate(p) {
  if (p.lvl < MAX_LVL) return msg(p, `La réincarnation s'ouvre au niveau ${MAX_LVL}.`);
  p.reborn++; p.lvl = 1; p.xp = 0; p.tal = newTal(); p.stats.reborn = p.reborn;
  recalc(p); p.hp = maxHp(p); sendInv(p);
  addFx({ k: 'lvl', x: p.x, y: p.y, id: p.id }, p.inst);
  broadcast({ t: 'chat', n: '★', m: `${p.name} s'est réincarné (renaissance ${p.reborn}) et repart au niveau 1, plus fort que jamais.` });
  msg(p, `Renaissance ${p.reborn} : ton niveau repart à 1 mais ton niveau de puissance continue (${plv(p)}). +${p.reborn * 5} % de vie et de dégâts pour toujours, et ${p.reborn * 10} points de talent en plus.`);
  checkAch(p);
}

/* ============================================================
   Montures
   ============================================================ */
const MOUNTS = {
  sanglier: { name: 'Sanglier de guerre', spd: 30, cost: 1200 },
  cheval: { name: 'Cheval brun', spd: 40, cost: 2000 },
  cerf: { name: 'Cerf des sylves', spd: 50, cost: 5000 },
  loup: { name: 'Loup des steppes', spd: 55, cost: 8000 },
  tigre: { name: 'Tigre des neiges', spd: 60, cost: 15000 },
  salamandre: { name: 'Salamandre de lave', spd: 65, cost: 30000 },
  spectre: { name: 'Destrier spectral', spd: 70, cost: 0 },
  griffon: { name: 'Griffon royal', spd: 80, cost: 60000 },
  licorne: { name: "Licorne d'Ambre", spd: 85, cost: 120000 },
  drake: { name: 'Drake de braise', spd: 90, cost: 250000 },
};
function toggleMount(p) {
  if (p.dead) return;
  if (p.riding) { p.riding = false; recalc(p); return; }
  if (!p.mount) return msg(p, "Tu n'as pas de monture. Mira la palefrenière en vend au village.");
  if (p.inst) return msg(p, 'Pas de monture ici.');
  if (Date.now() - p.lastHurt < 3000) return msg(p, 'Impossible de monter en plein combat.');
  p.riding = true; p.gath = null; recalc(p); addFx({ k: 'tp', x: p.x, y: p.y }, p.inst);
}
function repairGear(p) {
  const brann = NPCS.find(n => n.kind === 'forge');
  if (p.inst || Math.hypot(brann.x - p.x, brann.y - p.y) > 3) return msg(p, 'Va voir Brann le forgeron pour réparer ton équipement.');
  if (!p.wear) return msg(p, 'Brann : « Ton équipement est en parfait état. »');
  const cost = repairCost(p); if (p.gold < cost) return msg(p, `Il faut ${cost} or pour tout réparer.`);
  p.gold -= cost; p.wear = 0; recalc(p); addFx({ k: 'forge', x: p.x, y: p.y }, p.inst); msg(p, `Brann répare ton équipement pour ${cost} or.`);
}
const repairCost = p => Math.round((p.wear || 0) * (5 + plv(p) * 2));
function dismount(p) { if (p.riding) { p.riding = false; recalc(p); } }

/* ============================================================
   Matériaux, gemmes, recyclage
   ============================================================ */
const GEMS = { r: { name: 'Rubis', stat: 'dmg', base: 3 }, s: { name: 'Saphir', stat: 'def', base: 2.5 }, e: { name: 'Émeraude', stat: 'hp', base: 12 },
  t: { name: 'Topaze', stat: 'crit', base: 1 }, a: { name: "Œil d'ambre", stat: 'spd', base: 0.6 }, o: { name: 'Onyx', stat: 'cdmg', base: 2 } };
const GEM_MUL = [0, 1, 3, 8, 18, 35];
const SOCKETS = [0, 0, 1, 1, 2, 2, 3];
const MATS = { frag: 'Fragments de forge', fer: 'Minerai de fer', herbe: 'Herbe-lune', fleur: "Fleur d'ambre", poisson: 'Carpe', truite: 'Truite dorée' };
const gemOk = c => typeof c === 'string' && /^[rsetao][1-5]$/.test(c);
const gemName = c => `${GEMS[c[0]].name} ${'I II III IV V'.split(' ')[+c[1] - 1]}`;
function gemStat(c) { const g = GEMS[c[0]]; return { stat: g.stat, v: Math.max(1, Math.round(g.base * GEM_MUL[+c[1]])) }; }
const randGem = lvl => 'rsetao'[Math.floor(rnd() * 6)] + Math.max(1, Math.min(5, lvl));
function addMat(p, k, n = 1) { p.mat[k] = (p.mat[k] || 0) + n; }
function takeMat(p, k, n) { if ((p.mat[k] || 0) < n) return false; p.mat[k] -= n; if (!p.mat[k]) delete p.mat[k]; return true; }
const recycleFrags = it => Math.max(1, Math.round([1, 2, 4, 8, 16, 32, 64][it.r] * (1 + 0.5 * (it.u || 0)) * Math.max(1, it.l / 10)));
const safeForgeFrags = it => ((it.u || 0) + 1) * [2, 3, 4, 6, 9, 13, 20][it.r];
const findItem = (p, id) => p.inv.find(i => i.id === id) || Object.values(p.eq).find(i => i && i.id === id);

/* ============================================================
   Apparences
   ============================================================ */
const DYES = {
  base: { name: 'Couleurs de classe', cost: 0 },
  rouge: { name: 'Rouge sang', cost: 500, c: ['#a8342c', '#6b1f1a'] }, azur: { name: 'Azur', cost: 500, c: ['#3a6ac8', '#22407a'] },
  foret: { name: 'Vert forêt', cost: 500, c: ['#2e8a4a', '#1a5a2e'] }, nuit: { name: 'Nuit', cost: 800, c: ['#2a2a3a', '#14141e'] },
  or: { name: 'Or', cost: 1500, c: ['#c8a040', '#8a6a20'] }, neige: { name: 'Neige', cost: 1500, c: ['#e0e4ec', '#9aa0b0'] },
  pourpre: { name: 'Pourpre royal', cost: 2500, c: ['#7a3aa0', '#4a1e66'] }, ambre: { name: "Ambre d'Ambre", cost: 5000, c: ['#d08020', '#8a4e10'] },
};

/* ============================================================
   Métiers et artisanat
   ============================================================ */
const PROFS = { peche: 'Pêche', mine: 'Minage', herbe: 'Herboristerie' };
const newProf = () => ({ peche: { lvl: 1, xp: 0 }, mine: { lvl: 1, xp: 0 }, herbe: { lvl: 1, xp: 0 } });
function nearTile(p, set, r = 1.4) {
  for (let y = Math.floor(p.y - r); y <= p.y + r; y++) for (let x = Math.floor(p.x - r); x <= p.x + r; x++)
    if (set.includes(getT(x, y)) && Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y) < r + 0.3) return true;
  return false;
}
function nodeAt(p) {
  if (p.inst) return null;
  if (nearTile(p, [T.WATER])) return 'peche';
  if ((p.y >= 74 && p.x >= 54 && nearTile(p, [T.MWALL, T.CRYSTAL], 1.2)) || (p.x >= KW && nearTile(p, [T.ROCK, T.CRYSTAL], 1.2))) return 'mine';
  if (nearTile(p, [T.REED, T.FLOWER], 1.1)) return 'herbe';
  return null;
}
function startGather(p) {
  if (p.dead || p.gath) return;
  const k = nodeAt(p);
  if (!k) return msg(p, 'Rien à récolter ici : approche-toi du lac, des roches de la mine, des roseaux ou des fleurs.');
  dismount(p); p.autoAtk = false;
  p.gath = { k, t: 2.5, max: 2.5 };
}
function finishGather(p) {
  const k = p.gath.k; p.gath = null;
  const pr = p.prof[k], n = 1 + Math.floor(pr.lvl / 15), got = [];
  if (k === 'peche') {
    const rare = rnd() < 0.12 + pr.lvl * 0.004; addMat(p, rare ? 'truite' : 'poisson', n); got.push(`${n} ${MATS[rare ? 'truite' : 'poisson']}`);
    if (rnd() < 0.04) { addMat(p, 'g_s2'); got.push(gemName('s2')); }
    p.stats.fish += n;
  } else if (k === 'mine') {
    addMat(p, 'fer', n); got.push(`${n} ${MATS.fer}`);
    const crystal = nearTile(p, [T.CRYSTAL], 1.2) ? 2 : 1;
    if (rnd() < (0.03 + pr.lvl * 0.002) * crystal) { const g = randGem(2); addMat(p, 'g_' + g); got.push(gemName(g)); }
    else if (rnd() < (0.18 + pr.lvl * 0.004) * crystal) { const g = randGem(1); addMat(p, 'g_' + g); got.push(gemName(g)); }
    p.stats.ore += n;
  } else {
    const rare = rnd() < 0.12 + pr.lvl * 0.004; addMat(p, rare ? 'fleur' : 'herbe', n); got.push(`${n} ${MATS[rare ? 'fleur' : 'herbe']}`);
    p.stats.herb += n;
  }
  pr.xp += 10;
  if (pr.lvl < 50 && pr.xp >= 40 * pr.lvl) { pr.xp -= 40 * pr.lvl; pr.lvl++; msg(p, `${PROFS[k]} niveau ${pr.lvl} !`); }
  addFx({ k: 'qprog', x: p.x, y: p.y - 1.4, t: '+' + got.join(', +') }, p.inst);
  dailyProg(p, 'gather', k); checkAch(p);
  send(p, { t: 'gathered', k });
}
const RECIPES = {
  potion: { name: 'Potion de soin', need: { herbe: 3 }, desc: '1 potion' },
  potion5: { name: '5 potions de soin', need: { herbe: 12 }, desc: '5 potions' },
  plat: { name: 'Plat du pêcheur', need: { poisson: 3 }, desc: '+15 % de vie pendant 10 min' },
  festin: { name: 'Festin doré', need: { truite: 2, poisson: 2 }, desc: '+25 % de vie pendant 10 min' },
  elixir: { name: 'Élixir de force', need: { fleur: 2 }, desc: '+15 % de dégâts pendant 10 min' },
  lingot: { name: 'Fragments de forge', need: { fer: 5 }, desc: '2 fragments de forge' },
};
const GEAR_COST = [null, { fer: 6, frag: 10 }, { fer: 12, herbe: 6, frag: 30 }, { fer: 25, herbe: 12, fleur: 4, frag: 80 }, { fer: 50, herbe: 25, fleur: 10, truite: 3, frag: 200 }];
function suffixIndex(it) {
  const g = mulberry32(it.sd | 0), base = it.s === 'arme' ? (WEAPON_STATS[it.c] || WEAPON_STATS.guerrier) : (SLOT_STATS[it.s] || {});
  for (const _ in base) g(); for (let i = 0; i < Math.min(4, it.r); i++) g();
  const sl = SUFFIX[it.r] || []; return sl.length ? Math.floor(g() * sl.length) : -1;
}
function craftGear(p, o) {
  const slot = SLOTS.includes(o.s) ? o.s : null, r = Math.max(1, Math.min(4, o.r | 0)), si = o.si | 0;
  if (!slot || si < 0 || si >= SUFFIX[r].length) return;
  const need = GEAR_COST[r], mul = 1 + Math.floor(plv(p) / 100), gold = Math.round(50 * r * r * (1 + plv(p) / 10));
  const mineLvl = p.prof.mine.lvl;
  if (mineLvl < r * 5) return msg(p, `Il faut le Minage niveau ${r * 5} pour forger cette rareté.`);
  for (const [k, n] of Object.entries(need)) if ((p.mat[k] || 0) < n * mul) return msg(p, `Il manque des matériaux : ${n * mul} ${MATS[k]}.`);
  if (p.gold < gold) return msg(p, `Il faut ${gold} or.`);
  if (p.inv.length >= INV_SIZE) return msg(p, 'Ton sac est plein.');
  for (const [k, n] of Object.entries(need)) takeMat(p, k, n * mul);
  p.gold -= gold;
  let it;
  for (let tries = 0; tries < 200; tries++) { it = { id: nextId++, s: slot, r, l: plv(p), sd: (rnd() * 2e9) | 0 }; if (slot === 'arme') it.c = p.cls; if (suffixIndex(it) === si) break; }
  p.inv.push(it); sendInv(p); addFx({ k: 'forge', x: p.x, y: p.y }, p.inst);
  msg(p, `Tu fabriques : ${itemInfo(it, plv(p)).name}.`);
}
function craft(p, id) {
  const r = RECIPES[id]; if (!r) return;
  for (const [k, n] of Object.entries(r.need)) if ((p.mat[k] || 0) < n) return msg(p, `Il te manque des ingrédients pour : ${r.name}.`);
  for (const [k, n] of Object.entries(r.need)) takeMat(p, k, n);
  const until = Date.now() + 10 * 60000;
  if (id === 'potion') p.pots += 1; else if (id === 'potion5') p.pots += 5;
  else if (id === 'plat') p.food = { mul: 1.15, until, name: r.name };
  else if (id === 'festin') p.food = { mul: 1.25, until, name: r.name };
  else if (id === 'elixir') p.elix = { mul: 1.15, until, name: r.name };
  else if (id === 'lingot') addMat(p, 'frag', 2);
  recalc(p); addFx({ k: 'heal', x: p.x, y: p.y }, p.inst); msg(p, `Fabriqué : ${r.name}.`);
}

/* ============================================================
   Succès et titres
   ============================================================ */
const ACH = [
  { id: 'bes25', name: 'Naturaliste', desc: 'Étudier 25 espèces (25 victoires chacune)', n: 25, v: p => p.stats.studied || 0, title: 'le Naturaliste' },
  { id: 'bes100', name: 'Encyclopédiste', desc: 'Étudier 100 espèces', n: 100, v: p => p.stats.studied || 0, title: "l'Encyclopédiste" },
  { id: 'mas50', name: 'Maître des bêtes', desc: 'Maîtriser 50 espèces (100 victoires chacune)', n: 50, v: p => p.stats.mastered || 0, title: 'Maître des bêtes' },
  { id: 'reg1', name: 'Libérateur', desc: 'Terminer la chaîne de quêtes d\'une région', n: 1, v: p => p.stats.regions || 0, title: 'le Libérateur' },
  { id: 'reg10', name: 'Héraut des régions', desc: 'Libérer 10 régions', n: 10, v: p => p.stats.regions || 0, title: 'Héraut des régions' },
  { id: 'dj1', name: 'Pilleur de donjon', desc: 'Terminer un donjon', n: 1, v: p => p.stats.dungeons || 0, title: 'Pilleur de donjon' },
  { id: 'dj25', name: 'Fléau des donjons', desc: 'Terminer 25 donjons', n: 25, v: p => p.stats.dungeons || 0, title: 'Fléau des donjons' },
  { id: 'evt5', name: 'Sentinelle', desc: 'Participer à 5 événements mondiaux', n: 5, v: p => p.stats.events || 0, title: 'la Sentinelle' },
  { id: 'k100', name: 'Chasseur', desc: 'Vaincre 100 monstres', n: 100, v: p => p.stats.kills, title: 'le Chasseur' },
  { id: 'k1000', name: 'Fléau des bêtes', desc: 'Vaincre 1 000 monstres', n: 1000, v: p => p.stats.kills, title: 'Fléau des bêtes' },
  { id: 'k10000', name: 'Légende vivante', desc: 'Vaincre 10 000 monstres', n: 10000, v: p => p.stats.kills, title: 'Légende vivante' },
  { id: 'loups', name: 'Tueur de loups', desc: 'Vaincre 200 loups', n: 200, v: p => (p.stats.k_loup || 0) + (p.stats.k_loupnoir || 0) + (p.stats.k_lougarou || 0), title: 'Tueur de loups' },
  { id: 'roi', name: 'Régicide', desc: 'Vaincre le Roi des Cendres', n: 1, v: p => p.stats.b_roi || 0, title: 'Régicide' },
  { id: 'golem', name: 'Briseur de pierre', desc: 'Vaincre le Golem Ancien', n: 1, v: p => p.stats.b_golemroi || 0, title: 'Briseur de pierre' },
  { id: 'dragon', name: 'Tueur de dragon', desc: 'Vaincre Vyrmax, le boss mondial', n: 1, v: p => p.stats.b_dragon || 0, title: 'Tueur de dragon' },
  { id: 'r4', name: 'Légendaire', desc: 'Obtenir un objet Légendaire', n: 4, v: p => p.stats.maxRar, title: 'le Légendaire' },
  { id: 'r5', name: 'Prismatique', desc: 'Obtenir un objet Prismatique', n: 5, v: p => p.stats.maxRar, title: 'le Prismatique' },
  { id: 'r6', name: 'Héroïque', desc: 'Obtenir un objet Héroïque', n: 6, v: p => p.stats.maxRar, title: "l'Héroïque" },
  { id: 'f9', name: 'Maître forgeron', desc: 'Monter un objet à +9', n: 9, v: p => p.stats.forgeMax, title: 'Maître forgeron' },
  { id: 't10', name: 'Grimpeur', desc: "Atteindre l'étage 10 de la Tour", n: 10, v: p => p.stats.tower, title: 'le Grimpeur' },
  { id: 't50', name: 'Sans fin', desc: "Atteindre l'étage 50 de la Tour", n: 50, v: p => p.stats.tower, title: "l'Infini" },
  { id: 'fish', name: 'Pêcheur', desc: 'Pêcher 100 poissons', n: 100, v: p => p.stats.fish, title: 'le Pêcheur' },
  { id: 'ore', name: 'Mineur', desc: 'Extraire 100 minerais', n: 100, v: p => p.stats.ore, title: 'le Mineur' },
  { id: 'herb', name: 'Herboriste', desc: 'Cueillir 100 plantes', n: 100, v: p => p.stats.herb, title: "l'Herboriste" },
  { id: 'q9', name: 'Héros du village', desc: "Terminer les 9 quêtes d'Aldric", n: 9, v: p => p.q.i, title: 'Héros du village' },
  { id: 'lvl50', name: 'Vétéran', desc: 'Atteindre le niveau 50', n: 50, v: p => p.lvl + p.reborn * 100, title: 'le Vétéran' },
  { id: 'lvl100', name: 'Centenaire', desc: 'Atteindre le niveau 100', n: 100, v: p => p.lvl + p.reborn * 100, title: 'le Centenaire' },
  { id: 'reborn', name: 'Renaissance', desc: 'Se réincarner une première fois', n: 1, v: p => p.reborn, title: 'le Réincarné' },
  { id: 'arena10', name: 'Gladiateur', desc: "Gagner 10 combats d'arène", n: 10, v: p => p.stats.arena, title: 'Gladiateur' },
  { id: 'daily10', name: 'Assidu', desc: 'Terminer 10 quêtes journalières', n: 10, v: p => p.stats.daily, title: "l'Assidu" },
];
function checkAch(p) {
  for (const a of ACH) {
    if (p.ach.has(a.id) || a.v(p) < a.n) continue;
    p.ach.add(a.id); p.gold += 300;
    addFx({ k: 'chest', x: p.x, y: p.y }, p.inst);
    msg(p, `Succès débloqué : ${a.name} ! Titre « ${a.title} » disponible, +300 or.`);
  }
}

/* ============================================================
   Quêtes journalières
   ============================================================ */
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
function strHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function dailyDefs(p) {
  const g = mulberry32(strHash(p.daily.d + p.cls));
  let best = 'loup'; for (const t of BOUNTY_TYPES) if (MTYPES[t].lvl <= plv(p) + 1) best = t;
  const prof = ['peche', 'mine', 'herbe'][Math.floor(g() * 3)];
  const third = ['tower', 'boss', 'forge'][Math.floor(g() * 3)];
  return [
    { k: 'kill', type: best, n: 25, name: `Éliminer 25 × ${MTYPES[best].name}` },
    { k: 'gather', type: prof, n: 12, name: `Récolter 12 fois (${PROFS[prof]})` },
    third === 'tower' ? { k: 'tower', n: 3, name: 'Franchir 3 étages de la Tour sans fin' }
      : third === 'boss' ? { k: 'boss', n: 1, name: "Vaincre un boss (Gouffre, crypte, mine ou dragon)" }
      : { k: 'forge', n: 2, name: 'Réussir 2 améliorations chez Brann' },
  ];
}
function dailyCheckDay(p) { const d = todayKey(); if (!p.daily || p.daily.d !== d) p.daily = { d, prog: [0, 0, 0], claimed: [false, false, false] }; }
function dailyProg(p, kind, extra) {
  dailyCheckDay(p);
  dailyDefs(p).forEach((q, i) => { if (q.k === kind && (!q.type || q.type === extra) && p.daily.prog[i] < q.n) p.daily.prog[i]++; });
}
function dailyClaim(p, i) {
  dailyCheckDay(p);
  const q = dailyDefs(p)[i]; if (!q || p.daily.claimed[i] || p.daily.prog[i] < q.n) return;
  p.daily.claimed[i] = true; p.stats.daily++;
  const gold = 40 * plv(p), xp = Math.round(xpNext(plv(p)) * 0.2), gem = randGem(Math.min(5, 1 + (plv(p) > 30) + (plv(p) > 60) + (plv(p) > 300) + (plv(p) > 700)));
  p.gold += gold; addMat(p, 'g_' + gem); giveXp(p, xp);
  addFx({ k: 'chest', x: p.x, y: p.y }, p.inst); msg(p, `Quête journalière terminée : +${gold} or, +${xp} XP, ${gemName(gem)}.`); checkAch(p);
}

/* ============================================================
   Boss mondial : Vyrmax, toutes les heures
   ============================================================ */
const WB_SPOTS = [{ x: 48, y: 62, name: 'les Plaines du Sud' }, { x: 26, y: 22, name: 'les Prairies du nord-ouest' }, { x: 78, y: 52, name: 'la Forêt des Murmures' }, { x: 24, y: 58, name: 'les Prairies du sud-ouest' }];
const nextHour = () => { const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1); return d.getTime(); };
const wb = { next: nextHour(), warned: false, m: null, until: 0, spot: null };
const EVENTS = [
  { k: 'etoiles', name: "Pluie d'étoiles", text: "Une pluie d'étoiles tombe sur le monde : expérience doublée et plus de butin pendant 10 minutes !" },
  { k: 'invasion', name: 'Invasion', text: 'Une invasion de champions déferle' },
  { k: 'errant', name: 'Boss errant', text: 'Un boss errant parcourt' },
];
let evtNext = Date.now() + (8 + rnd() * 8) * 60000;
function regionOfPlayers() {
  const counts = new Map();
  for (const p of players.values()) { if (p.inst) continue; const z = ZONES.find(z => p.x >= z.x0 && p.x <= z.x1 && p.y >= z.y0 && p.y <= z.y1); if (z) counts.set(z, (counts.get(z) || 0) + 1); }
  let best = null, bn = 0; for (const [z, n] of counts) if (n > bn) { bn = n; best = z; }
  if (best) return best;
  const top = Math.max(0, ...[...players.values()].map(p => plv(p)));
  return ZONES.filter(z => z.lv[0] <= top + 5).pop() || null;
}
function updateEvents() {
  const now = Date.now();
  if (evt.k && now > evt.until) {
    for (const m of evt.ms || []) if (!m.dead) { addFx({ k: 'tp', x: m.x, y: m.y }); m.remove = true; }
    broadcast({ t: 'chat', n: '★', m: `L'événement « ${evt.name} » est terminé.` });
    evt = { k: '', until: 0, name: '' }; evtNext = now + (15 + rnd() * 10) * 60000;
    return;
  }
  if (evt.k || now < evtNext || !players.size) return;
  const E = EVENTS[Math.floor(rnd() * EVENTS.length)];
  const z = regionOfPlayers();
  if (E.k !== 'etoiles' && !z) { evtNext = now + 60000; return; }
  evt = { k: E.k, name: E.name, until: now + 10 * 60000, ms: [] };
  if (E.k === 'etoiles') broadcast({ t: 'chat', n: '★', m: E.text });
  else if (E.k === 'invasion') {
    for (let i = 0; i < 12; i++) { const s = freeSpot(z.x0 + ZW / 2, z.y0 + ZH / 2, 16), j = i % 3; const m = makeMonster(`z${z.k}_${j}`, s.x, s.y, { ...mobStats(z.lv[0] + 10, false, 2.2), evt: 1 }); m.hx = s.x; m.hy = s.y; evt.ms.push(m); }
    evt.name = `Invasion : ${z.name}`;
    broadcast({ t: 'chat', n: '★', m: `${E.text} sur ${z.name} : 12 champions à abattre en 10 minutes (butin et or bonus) !` });
  } else {
    const s = freeSpot(z.x0 + ZW / 2, z.y0 + ZH / 2, 14);
    const m = makeMonster(`z${z.k}_B`, s.x, s.y, { ...mobStats(z.lv[1] + 5, true, 1.6), evt: 2 }); m.hx = s.x; m.hy = s.y; evt.ms.push(m);
    evt.name = `Boss errant : ${z.name}`;
    broadcast({ t: 'chat', n: '★', m: `${E.text} ${z.name} : ${m.mt.name} (niveau ${m.lvl}) ! Butin héroïque possible.` });
  }
}
function updateWorldBoss() {
  const now = Date.now();
  if (!wb.m) {
    if (!wb.warned && wb.next - now < 5 * 60000) {
      wb.warned = true; wb.spot = WB_SPOTS[Math.floor(rnd() * WB_SPOTS.length)];
      broadcast({ t: 'chat', n: '★', m: `Le dragon Vyrmax approche : il se posera dans 5 minutes vers ${wb.spot.name} !` });
    }
    if (now >= wb.next) {
      if (!wb.spot) wb.spot = WB_SPOTS[0];
      const top = Math.max(0, ...[...players.values()].map(p => plv(p)));
      const L = Math.max(30, top + 3), s = freeSpot(wb.spot.x, wb.spot.y, 3);
      const ms = mobStats(Math.min(1050, L), true); wb.m = makeMonster('dragon', s.x, s.y, { ...ms, maxhp: ms.maxhp * 4, xp: ms.xp * 3, gold: [ms.gold[0] * 2, ms.gold[1] * 2] });
      wb.until = now + 15 * 60000;
      broadcast({ t: 'chat', n: '★', m: `Vyrmax, dragon d'Ambre (niveau ${L}), s'est posé vers ${wb.spot.name} ! Butin Héroïque garanti pour tous ceux qui le combattent.` });
    }
  } else if (wb.m.dead || wb.m.remove) { wb.m = null; wb.next = nextHour(); wb.warned = false; wb.spot = null; }
  else if (now > wb.until) {
    broadcast({ t: 'chat', n: '★', m: "Vyrmax reprend son envol… Il reviendra dans l'heure." });
    addFx({ k: 'tp', x: wb.m.x, y: wb.m.y }); wb.m.remove = true; wb.m = null; wb.next = nextHour(); wb.warned = false; wb.spot = null;
  }
}
function wbInfo() {
  const now = Date.now();
  if (wb.m) return { s: 'up', t: wb.until - now, n: wb.spot ? wb.spot.name : '', x: wb.m.x, y: wb.m.y };
  return { s: wb.warned ? 'soon' : 'idle', t: wb.next - now, n: wb.spot ? wb.spot.name : '' };
}
function dragonLoot(m, recv) {
  for (const p of recv) {
    p.stats.b_dragon = (p.stats.b_dragon || 0) + 1;
    const it = newItem(m.lvl, 6, undefined, p.cls);
    if (p.inv.length < INV_SIZE) p.inv.push(it); else drops.push({ id: nextId++, x: p.x, y: p.y, k: 'item', item: it, ttl: 120, inst: 0 });
    p.stats.maxRar = Math.max(p.stats.maxRar, 6);
    for (let i = 0; i < 2; i++) addMat(p, 'g_' + randGem(3));
    let extra = '';
    if (rnd() < 0.15 && !p.mounts.has('spectre')) { p.mounts.add('spectre'); extra = ' et le Destrier spectral'; }
    sendInv(p); msg(p, `Vyrmax est tombé ! Tu reçois ${itemInfo(it, plv(p)).name}, 2 gemmes${extra}.`);
  }
}

/* ============================================================
   Tour sans fin et arène
   ============================================================ */
function enterTower(p) {
  if (p.inst || p.dead) return;
  const I = { id: nextId++, kind: 'tower', players: new Set([p.id]), floor: 1, wave: -1, L: 6, state: 'start', timer: 3 };
  instances.set(I.id, I);
  dismount(p); addFx({ k: 'tp', x: p.x, y: p.y });
  p.inst = I.id; p.x = 48.5; p.y = ARENA.y1 - 1; p.tgt = null;
  send(p, { t: 'tp' }); msg(p, `Tour sans fin : étage 1. Ton record : étage ${p.stats.tower}.`);
}
function towerSpawn(I) {
  const f = I.floor, L = 4 + f * 2; I.L = L;
  const boss = f % 5 === 0;
  const list = boss ? [['gardien', 1], ['ombre', 3]] : [['ombre', 5 + Math.min(10, Math.floor(f / 3))]];
  for (const [type, n] of list) for (let i = 0; i < n; i++) { const s = freeSpot(48, ARENA.y0 + 3, type === 'gardien' ? 1 : 8); makeMonster(type, s.x, s.y, { inst: I.id, ...scaledStats(type, L) }); }
  instanceMsg(I, boss ? `Étage ${f} : un Gardien garde le passage !` : `Étage ${f}`);
}
function towerCleared(I) {
  for (const id of I.players) {
    const q = players.get(id); if (!q) continue;
    const g = I.L * 8; q.gold += g;
    q.stats.tower = Math.max(q.stats.tower, I.floor); dailyProg(q, 'tower');
    let extra = '';
    if (rnd() < 0.3 || I.floor % 5 === 0) { const it = newItem(I.L, I.floor >= 20 ? 3 : I.floor >= 10 ? 2 : 1, undefined, q.cls); if (q.inv.length < INV_SIZE) { q.inv.push(it); extra += `, ${itemInfo(it, plv(q)).name}`; q.stats.maxRar = Math.max(q.stats.maxRar, it.r); sendInv(q); } }
    if (I.floor % 5 === 0) { const gm = randGem(Math.min(5, 1 + Math.floor(I.floor / 10))); addMat(q, 'g_' + gm); extra += `, ${gemName(gm)}`; }
    msg(q, `Étage ${I.floor} franchi : +${g} or${extra}.`); checkAch(q);
  }
  I.floor++; I.state = 'pause'; I.timer = 3;
}
function startArena(p, o) {
  if (p.inst || p.dead) return msg(p, "Tu ne peux pas entrer dans l'arène maintenant.");
  const cls = CLASS_IDS.includes(o.cls) ? o.cls : 'guerrier';
  const opp = { n: String(o.n || 'Champion').slice(0, 14), cls, lvl: Math.max(1, Math.min(2000, o.lvl | 0)),
    hp: Math.max(60, Math.min(1e6, +o.hp || 100)), dmg: Math.max(5, Math.min(1e5, +o.dmg || 10)), def: Math.max(0, Math.min(1e5, +o.def || 0)) };
  const I = { id: nextId++, kind: 'arena', players: new Set([p.id]), wave: 0, state: 'fight', timer: 90, opp };
  instances.set(I.id, I);
  dismount(p); p.inst = I.id; p.x = 48.5; p.y = ARENA.y1 - 1; p.tgt = null; p.hp = maxHp(p);
  const tough = 1 + opp.def / (opp.def + 200);
  makeMonster('champion', 48.5, ARENA.y0 + 3, { inst: I.id, lvl: opp.lvl, maxhp: Math.round(opp.hp * 4 * tough), dmg: Math.round(opp.dmg * 0.55), xp: 0, gold: [0, 0], champ: { cls, n: opp.n } });
  send(p, { t: 'tp' }); msg(p, `Arène : affronte ${opp.n} (${CLASSES[cls].name} niv. ${opp.lvl}). 90 secondes !`);
}
function arenaEnd(I, win) {
  if (I.state === 'won' || I.state === 'lost') return;
  I.state = win ? 'won' : 'lost'; I.timer = 4;
  for (const id of I.players) {
    const q = players.get(id); if (!q) continue;
    if (win) { q.stats.arena++; q.gold += q.lvl * 15; checkAch(q); }
    send(q, { t: 'arenaRes', win, opp: I.opp.n });
    msg(q, win ? `Victoire contre ${I.opp.n} ! +${q.lvl * 15} or.` : `Défaite contre ${I.opp.n}.`);
  }
}

/* ============================================================
   Échanges avec la couche sociale (guildes, hôtel des ventes)
   ============================================================ */
function hubTake(p, o) {
  const reply = (ok, extra) => send(p, { t: 'hub', ref: o.ref, ok, ...extra });
  if (o.item) {
    const it = p.inv.find(i => i.id === o.item); if (!it) return reply(false);
    p.inv = p.inv.filter(i => i !== it); sendInv(p);
    return reply(true, { raw: { s: it.s, r: it.r, l: it.l, sd: it.sd, c: it.c, u: it.u || 0, g: it.g || [] }, name: itemInfo(it, plv(p)).name });
  }
  const n = Math.floor(+o.gold || 0);
  if (n <= 0 || p.gold < n) return reply(false);
  p.gold -= n; reply(true);
}
function hubGive(p, o) {
  const now = Date.now(); p.hubLog = (p.hubLog || []).filter(t => now - t < 60000);
  if (!LOCAL && p.hubLog.length >= 20) return send(p, { t: 'hub', ref: o.ref, ok: false, why: 'trop de demandes' });
  p.hubLog.push(now);
  const items = (Array.isArray(o.items) ? o.items : []).slice(0, 8).map(cleanItem).filter(Boolean).filter(it => LOCAL || it.l <= plv(p) + 120);
  const gold = Math.max(0, Math.min(LOCAL ? 1e8 : 2e6 + plv(p) * 20000, Math.floor(+o.gold || 0)));
  if (p.inv.length + items.length > INV_SIZE) return send(p, { t: 'hub', ref: o.ref, ok: false, why: 'sac plein' });
  for (const it of items) { p.inv.push(it); p.stats.maxRar = Math.max(p.stats.maxRar, it.r); }
  p.gold += gold; if (items.length) sendInv(p);
  send(p, { t: 'hub', ref: o.ref, ok: true });
}

/* ============================================================
   Progression envoyée au client (seulement quand elle change)
   ============================================================ */
function progOf(p) {
  dailyCheckDay(p);
  const now = Date.now();
  return { tal: p.tal, pts: talentPoints(p), reborn: p.reborn, mounts: [...p.mounts], mount: p.mount, riding: p.riding,
    mat: p.mat, prof: p.prof, ach: [...p.ach], title: p.title, dyes: [...p.dyes], look: p.look, stats: p.stats,
    daily: { defs: dailyDefs(p), prog: p.daily.prog, claimed: p.daily.claimed },
    food: p.food && p.food.until > now ? { name: p.food.name, min: Math.ceil((p.food.until - now) / 60000) } : null,
    elix: p.elix && p.elix.until > now ? { name: p.elix.name, min: Math.ceil((p.elix.until - now) / 60000) } : null,
    st: { cdMul: p.st.cdMul, red: p.st.red, range: p.st.range, skillMul: p.st.skillMul, healMul: p.st.healMul, critMul: p.st.critMul } };
}
function sendProg(p) {
  const o = progOf(p), sig = JSON.stringify(o);
  if (sig === p.progSig) return;
  p.progSig = sig; send(p, { t: 'prog', ...o });
}

/* ============================================================
   Comptes : jusqu'à 5 personnages, banque commune
   ============================================================ */
const MAX_CHARS = 5, BANK_ITEMS = 60;
function charList(acc) {
  if (!acc) return [];
  return Object.entries(saves).filter(([k, s]) => !k.startsWith('__') && s && s.acc === acc)
    .map(([, s]) => ({ name: s.name, cls: s.cls, lvl: s.lvl | 0, reborn: s.reborn | 0, look: s.look || null }))
    .sort((a, b) => b.lvl - a.lvl);
}
function bankOf(p) {
  const all = saves.__bank__ || (saves.__bank__ = {});
  return all[p.acc] || (all[p.acc] = { mat: {}, items: [], gold: 0 });
}
function sendBank(p) {
  const b = bankOf(p);
  send(p, { t: 'bank', mat: b.mat, gold: b.gold, pgold: p.gold, max: BANK_ITEMS,
    items: b.items.map((a, i) => { const it = cleanItem({ s: a[0], r: a[1], l: a[2], sd: a[3], c: a[4], u: a[5], g: a[6] }); if (!it) return null; const info = itemInfo(it, plv(p)); info.bi = i; return info; }).filter(Boolean) });
}
function bankOp(p, o) {
  const banker = NPCS.find(n => n.kind === 'bank');
  if (p.inst || Math.hypot(banker.x - p.x, banker.y - p.y) > 3) return msg(p, 'Va voir Gaspard le banquier au village.');
  const b = bankOf(p);
  if (o.kind === 'mat') {
    const k = String(o.k || ''); if (!(k in MATS) && !(k.startsWith('g_') && gemOk(k.slice(2)))) return;
    if (o.op === 'dep') { const n = Math.min(p.mat[k] || 0, Math.max(1, o.n | 0)); if (!n) return; takeMat(p, k, n); b.mat[k] = (b.mat[k] || 0) + n; }
    else { const n = Math.min(b.mat[k] || 0, Math.max(1, o.n | 0)); if (!n) return; b.mat[k] -= n; if (!b.mat[k]) delete b.mat[k]; addMat(p, k, n); }
  } else if (o.kind === 'gold') {
    const n = Math.max(0, Math.floor(+o.n || 0));
    if (o.op === 'dep') { const v = Math.min(n, p.gold); p.gold -= v; b.gold += v; } else { const v = Math.min(n, b.gold); b.gold -= v; p.gold += v; }
  } else if (o.kind === 'item') {
    if (o.op === 'dep') {
      const it = p.inv.find(i => i.id === o.id); if (!it) return;
      if (b.items.length >= BANK_ITEMS) return msg(p, `La banque est pleine (${BANK_ITEMS} objets).`);
      p.inv = p.inv.filter(i => i !== it); b.items.push(packIt(it)); sendInv(p);
    } else {
      const a = b.items[o.i | 0]; if (!a) return;
      if (p.inv.length >= INV_SIZE) return msg(p, 'Ton sac est plein.');
      const it = cleanItem({ s: a[0], r: a[1], l: a[2], sd: a[3], c: a[4], u: a[5], g: a[6] }); b.items.splice(o.i | 0, 1);
      if (it) { p.inv.push(it); sendInv(p); }
    }
  }
  sendBank(p);
}

/* ============================================================
   Monstres des régions
   ============================================================ */
for (const sp of ZSPAWNERS) {
  SPAWNERS.push(sp);
  const mt = MTYPES[sp.type];
  for (let i = 0; i < sp.n; i++) {
    const L = sp.lv[0] + Math.floor(rnd() * (sp.lv[1] - sp.lv[0] + 1));
    const pos = freeSpot(sp.x, sp.y, sp.r);
    makeMonster(sp.type, pos.x, pos.y, { sp, ...mobStats(L, !!mt.boss, [1, 0.9, 1, 1.12][+sp.type.slice(-1)] || 1) });
  }
}
for (const t of Object.keys(ZTYPES)) if (!ZTYPES[t].boss) BOUNTY_TYPES.push(t);
// le royaume suit le même calibrage que les régions (progression continue)
for (const m of monsters) if (m.sp && !m.mt.gen && !m.mt.scaled && !m.inst) { Object.assign(m, mobStats(m.mt.lvl, !!m.mt.boss, m.mt.boss ? 0.6 : 0.85)); m.hp = m.maxhp; }
for (const m of monsters) m.base = { lvl: m.lvl, maxhp: m.maxhp, dmg: m.dmg, xp: m.xp, gold: m.gold };

/* ============================================================
   Boucle de jeu
   ============================================================ */
const TICK = 50;
let lastTick = Date.now();

function update(dt) {
  gameTime += dt; updateDayNight(); updateInstances(dt); updateWorldBoss(); updateEvents(); tickMechHits(dt);
  const sec = Math.floor(gameTime) !== Math.floor(gameTime - dt);
  for (const p of players.values()) {
    p.atkCd = Math.max(0, p.atkCd - dt);
    for (let i = 0; i < 4; i++) p.skCd[i] = Math.max(0, (p.skCd[i] || 0) - dt);
    p.buffT = Math.max(0, p.buffT - dt); p.invT = Math.max(0, p.invT - dt); p.potCd = Math.max(0, (p.potCd || 0) - dt);
    if (p.shieldT > 0) { p.shieldT -= dt; if (p.shieldT <= 0) p.shield = 0; }
    if (p.regenT > 0 && !p.dead) { p.regenT -= dt; p.rgAcc = (p.rgAcc || 0) + maxHp(p) * 0.05 * (p.regenMul || 1) * dt; if (p.rgAcc >= 1) { const a = Math.floor(p.rgAcc); p.hp = Math.min(maxHp(p), p.hp + a); p.rgAcc -= a; } }
    if (p.dead) { p.deadT -= dt; if (p.deadT <= 0) { p.dead = false; respawnAt(p); send(p, { t: 'tp' }); msg(p, 'Tu te relèves à ta dernière pierre de passage.'); } continue; }
    const { dx, dy } = p.inp, len = Math.hypot(dx, dy);
    p.mv = len > 0.1;
    if (p.mv) {
      const s = CLASSES[p.cls].spd * (1 + (p.st.spd + p.st.mountSpd) / 100) * dt * Math.min(1, len);
      moveEnt(p, dx / len * s, dy / len * s);
      if (p.atkCd <= 0.01 || p.atkCd < CLASSES[p.cls].cd - 0.25) p.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : (dy < 0 ? 1 : 0);
    }
    if (p.gath) { if (p.mv) { p.gath = null; } else { p.gath.t -= dt; if (p.gath.t <= 0) finishGather(p); } }
    tpCastTick(p, dt);
    if (sec) { const now = Date.now(); if ((p.food && p.food.until < now) || (p.elix && p.elix.until < now)) { if (p.food && p.food.until < now) p.food = null; if (p.elix && p.elix.until < now) p.elix = null; recalc(p); } sendProg(p); }
    if (p.autoAtk) doAttack(p);
    if (p.autoPot && p.pots > 0 && p.potCd <= 0 && p.hp < maxHp(p) * p.autoPot) usePotion(p);
    const mh = maxHp(p);
    p.hpAcc = (p.hpAcc || 0) + (Date.now() - p.lastHurt > 5000 ? 0.03 : 0.004) * mh * dt;
    if (p.hpAcc >= 1) { const a = Math.floor(p.hpAcc); p.hp = Math.min(mh, p.hp + a); p.hpAcc -= a; }
    if (!p.inst) for (const w of WAYPOINTS) if (!p.wps.has(w.id) && Math.hypot(w.x - p.x, w.y - p.y) < 1.6) {
      p.wps.add(w.id); addFx({ k: 'wp', x: w.x, y: w.y });
      msg(p, `Pierre de passage activée : ${w.name}. Ouvre « Voyage » pour t'y téléporter ou en faire ton point de réapparition.`);
    }
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      if (!same(d, p) || Math.hypot(d.x - p.x, d.y - p.y) > 1.1) continue;
      if (d.k === 'gold') { p.gold += d.v; addFx({ k: 'gold', x: p.x, y: p.y - 1, v: d.v, id: p.id }, p.inst); }
      else if (d.k === 'mat') { addMat(p, d.mk, d.v); addFx({ k: 'qprog', x: p.x, y: p.y - 1.2, t: '+ ' + (d.mk.startsWith('g_') ? gemName(d.mk.slice(2)) : MATS[d.mk]) }, p.inst); }
      else if (d.k === 'pot') { p.pots += d.v; addFx({ k: 'potpick', x: p.x, y: p.y - 1, v: d.v, id: p.id }, p.inst); }
      else {
        if (p.inv.length >= INV_SIZE) { if (Date.now() - (p.fullWarn || 0) > 4000) { p.fullWarn = Date.now(); msg(p, 'Ton sac est plein. Vends des objets chez Elya.'); } continue; }
        p.inv.push(d.item); const info = itemInfo(d.item, plv(p)); p.stats.maxRar = Math.max(p.stats.maxRar, d.item.r); checkAch(p);
        addFx({ k: 'loot', x: p.x, y: p.y - 1.2, t: info.name, r: info.r, id: p.id }, p.inst); sendInv(p);
      }
      drops.splice(i, 1);
    }
  }
  for (let i = drops.length - 1; i >= 0; i--) { drops[i].ttl -= dt; if (drops[i].ttl <= 0) drops.splice(i, 1); }

  for (let i = zones.length - 1; i >= 0; i--) {
    const z = zones[i]; z.t -= dt; z.tick -= dt;
    if (z.tick <= 0) {
      const p = players.get(z.owner);
      if (z.follow && p) { z.x = p.x; z.y = p.y; }
      z.tick = z.every; addFx({ k: z.fx, x: z.x, y: z.y, r: z.r }, z.inst);
      if (p) for (const m of monsters) if (!m.dead && (m.inst || 0) === (z.inst || 0) && Math.hypot(m.x - z.x, m.y - z.y) < z.r) damageMonster(p, m, z.dmg);
    }
    if (z.t <= 0) zones.splice(i, 1);
  }

  for (const m of monsters) {
    if (m.remove) continue;
    if (m.dead) {
      if (m.nightOff || m.inst) continue;
      if (!m.sp) { m.remove = true; continue; }
      m.respawnT -= dt;
      if (m.respawnT <= 0) {
        const s = freeSpot(m.sp.x, m.sp.y, m.sp.r);
        if (m.base) Object.assign(m, m.base);
        Object.assign(m, { dead: false, x: s.x, y: s.y, hx: s.x, hy: s.y, hp: m.maxhp, target: null, stunT: 0, slowT: 0 });
        if (m.mt.boss) broadcast({ t: 'chat', n: '★', m: `${m.mt.name} s'est relevé…` });
      }
      continue;
    }
    if (!m.inst && !m.target) {
      let awake = false;
      for (const p of players.values()) if (!p.inst && Math.abs(p.x - m.x) < 36 && Math.abs(p.y - m.y) < 36) { awake = true; break; }
      if (!awake) { m.mv = false; continue; }
    }
    m.atkCd = Math.max(0, m.atkCd - dt); m.slowT = Math.max(0, m.slowT - dt);
    if (m.mech) bossMechanics(m, dt);
    if (m.stunT > 0) { m.stunT -= dt; m.mv = false; continue; }
    let tgt = m.target ? players.get(m.target) : null;
    if (tgt && (tgt.dead || !same(tgt, m) || dist(tgt, m) > (m.inst ? 60 : 14))) { tgt = null; m.target = null; }
    if (!tgt && m.mt.aggro > 0) {
      let bd = m.mt.aggro;
      for (const p of players.values()) if (!p.dead && same(p, m) && dist(p, m) < bd) { tgt = p; bd = dist(p, m); }
      if (tgt) m.target = tgt.id;
    }
    const homeD = Math.hypot(m.x - m.hx, m.y - m.hy);
    if (!m.inst && tgt && homeD > 13) { tgt = null; m.target = null; m.returning = true; }
    m.mv = false;
    const spd = m.mt.spd * dt * (m.slowT > 0 ? 0.5 : 1), r = 0.3 * Math.min(1.4, m.mt.size);
    if (m.returning) {
      if (homeD < 1) { m.returning = false; m.hp = m.maxhp; m.dmgBy.clear(); }
      else { const a = Math.atan2(m.hy - m.y, m.hx - m.x); moveEnt(m, Math.cos(a) * spd * 1.5, Math.sin(a) * spd * 1.5, r); faceTo(m, m.hx, m.hy); m.mv = true; }
    } else if (tgt) {
      const ranged = m.champ && ['archere', 'mage', 'druide'].includes(m.champ.cls);
      const d = dist(tgt, m), reach = ranged ? 5 : 0.9 + (m.mt.size - 1) * 0.7;
      faceTo(m, tgt.x, tgt.y);
      if (d > reach) { const a = Math.atan2(tgt.y - m.y, tgt.x - m.x); moveEnt(m, Math.cos(a) * spd, Math.sin(a) * spd, r); m.mv = true; }
      else if (m.atkCd <= 0) {
        m.atkCd = m.champ ? CLASSES[m.champ.cls].cd * 1.8 : m.mt.boss ? 1.6 : 1.3;
        if (m.champ) {
          const c = m.champ.cls;
          if (c === 'archere') addFx({ k: 'arrow', x: m.x, y: m.y - 0.5, x2: tgt.x, y2: tgt.y - 0.4 }, m.inst);
          else if (c === 'mage') addFx({ k: 'bolt', x: m.x, y: m.y - 0.6, x2: tgt.x, y2: tgt.y - 0.4 }, m.inst);
          else if (c === 'druide') addFx({ k: 'thorn', x: m.x, y: m.y - 0.6, x2: tgt.x, y2: tgt.y - 0.4 }, m.inst);
          else addFx({ k: 'slash', x: m.x, y: m.y, d: m.dir, c }, m.inst);
          hurtPlayer(tgt, m.dmg, m);
        } else if (m.mt.boss && rnd() < 0.3) {
          addFx({ k: m.mt.world ? 'fire' : 'quake', x: m.x, y: m.y, r: 3.2 }, m.inst);
          for (const p of players.values()) if (!p.dead && same(p, m) && dist(p, m) < 3.2) hurtPlayer(p, m.dmg * 0.8, m);
        } else { addFx({ k: 'claw', x: tgt.x, y: tgt.y, id: tgt.id }, m.inst); hurtPlayer(tgt, m.dmg, m); }
      }
    } else {
      m.wanderT -= dt;
      if (m.wanderT <= 0) {
        m.wanderT = 2 + rnd() * 4;
        const s = freeSpot(m.hx, m.hy, Math.min(4, m.sp ? m.sp.r : 3)); m.wx = s.x; m.wy = s.y;
        if (rnd() < 0.4) { m.wx = m.x; m.wy = m.y; }
      }
      const wd = Math.hypot(m.wx - m.x, m.wy - m.y);
      if (wd > 0.2) { const a = Math.atan2(m.wy - m.y, m.wx - m.x); moveEnt(m, Math.cos(a) * spd * 0.45, Math.sin(a) * spd * 0.45, r); faceTo(m, m.wx, m.wy); m.mv = true; }
      if (m.hp < m.maxhp) m.hp = Math.min(m.maxhp, m.hp + m.maxhp * 0.02 * dt);
    }
  }
  for (let i = monsters.length - 1; i >= 0; i--) if (monsters[i].remove) monsters.splice(i, 1);
}

const VIEW = 22;
const r2 = v => Math.round(v * 100) / 100;
function sendSnapshots() {
  const ps = [...players.values()];
  const tod = r2(todPhase());
  for (const p of ps) {
    const near = o => same(o, p) && Math.abs(o.x - p.x) < VIEW && Math.abs(o.y - p.y) < VIEW;
    const pl = ps.filter(near).map(o => [o.id, r2(o.x), r2(o.y), o.dir, o.mv ? 1 : 0, o.hp, maxHp(o), o.cls, o.name, o.lvl, o.dead ? 1 : 0, weapLvl(o),
      CLASSES[o.cls].cd - o.atkCd < 0.25 ? 1 : 0, (o.shield > 0 ? 1 : 0) | (o.buffT > 0 ? 2 : 0) | (o.party && o.party === p.party ? 4 : 0) | (o.regenT > 0 ? 8 : 0) | (o.invT > 0 ? 16 : 0), o.eq.arme ? o.eq.arme.r : -1,
      o.riding ? o.mount : 0, o.gtag || '', o.title || '', o.look.dye + '|' + o.look.aura, o.vis || '', o.reborn | 0]);
    const ms = monsters.filter(m => !m.dead && !m.remove && near(m)).map(m => [m.id, m.type, r2(m.x), r2(m.y), m.dir, m.mv ? 1 : 0, Math.ceil(m.hp), m.maxhp, m.target ? 1 : 0, m.lvl, (m.stunT > 0 ? 1 : 0) | (m.slowT > 0 ? 2 : 0), m.champ ? m.champ.cls + '|' + m.champ.n : 0]);
    const ds = drops.filter(near).map(d => [d.id, r2(d.x), r2(d.y), d.k, d.item ? d.item.r : d.mk ? (d.mk.startsWith('g_') ? d.mk.slice(2) : d.mk) : 0]);
    const f = fx.filter(near);
    const c = CLASSES[p.cls], q = questFor(p);
    const pt = partyOf(p);
    const I = p.inst ? instances.get(p.inst) : null;
    const snap = JSON.stringify({ t: 's', p: pl, m: ms, d: ds, f, me: {
      hp: p.hp, mhp: maxHp(p), lvl: p.lvl, pl: plv(p), rb: p.reborn, xp: p.xp, xpn: xpNext(plv(p)), gold: p.gold, pots: p.pots, weap: weapLvl(p),
      deadT: p.dead ? r2(p.deadT) : 0, fc: forgeCost(p.weap), rk: skillRank(p), sk: c.skills.map((s, i) => [r2(p.skCd[i] || 0), s.cd, plv(p) < s.lvl ? s.lvl : 0]),
      tgt: p.tgt || 0, sh: p.shield || 0, spd: p.st.spd, inst: p.inst ? 1 : 0, tod, dmg: Math.round(baseDmg(p)), def: p.st.def, crit: p.st.crit,
      q: p.q.on ? [q.name, p.q.prog, q.n, q.item || '', ...questGoal(p, q), q.type] : null, qa: !p.q.on, qg: p.q.on ? (p.q.g || 'quest') : '', wave: !I ? '' : I.kind === 'donjon' ? (I.state === 'won' ? 'Victoire !' : `${I.dj.name} · ${I.wave >= 2 ? 'Boss' : 'Salle ' + Math.max(1, I.wave + 1) + ' / 2'}`) : I.kind === 'tower' ? `Tour · étage ${I.floor}` : I.kind === 'arena' ? (I.state === 'fight' ? `Arène · ${Math.ceil(I.timer)} s` : I.state === 'won' ? 'Victoire !' : 'Défaite') : (I.state === 'won' ? 'Victoire !' : I.wave >= WAVES.length - 1 ? 'Le Gardien' : `Vague ${Math.max(1, I.wave + 1)} / ${WAVES.length - 1}`),
      ik: I ? I.kind || 'gouffre' : '', djn: I && I.kind === 'donjon' ? (I.state === 'won' ? 'Victoire !' : `${I.dj.name} · ${I.wave >= 2 ? 'Boss' : 'Salle ' + Math.max(1, I.wave + 1) + ' / 2'}`) : '', gath: p.gath ? [p.gath.k, r2(p.gath.t), p.gath.max] : null, tpc: p.tpCast ? [r2(p.tpCast.t), TP_CAST] : null, wear: p.wear || 0, rc: repairCost(p), pc: potPrice(p), evt: evt.k ? [evt.k, evt.name, Math.max(0, Math.round((evt.until - Date.now()) / 1000))] : null, streak: !p.autoMode && Date.now() - (p.lastKill || 0) < 8000 ? p.streak || 0 : 0, cdmg: Math.round((p.st.critMul - 1) * 100), wb: wbInfo(), riding: p.riding ? 1 : 0, spdT: p.st.spd + p.st.mountSpd, range: CLASSES[p.cls].range + p.st.range,
      pt: pt ? [...pt.members].filter(id => id !== p.id).map(id => { const o = players.get(id); return o ? [o.id, o.name, o.cls, o.lvl, o.hp, maxHp(o)] : null; }).filter(Boolean) : [],
      buff: r2(p.buffT), wps: [...p.wps], wp: p.wp, night: isNight ? 1 : 0 } });
    // instantané identique au précédent : on ne le renvoie qu'une fois par seconde
    if (snap === p.lastSnap && Date.now() - p.lastSnapT < 1000) continue;
    p.lastSnap = snap; p.lastSnapT = Date.now(); p.ws.send(snap);
  }
  fx = [];
}

setInterval(() => {
  const now = Date.now(); const dt = Math.min(0.1, (now - lastTick) / 1000); lastTick = now;
  update(dt); sendSnapshots();
}, TICK);
setInterval(persist, 30000);

/* ============================================================
   Connexions
   ============================================================ */
function onConnection(ws) {
  let p = null, lastChat = 0;
  ws.onmessage = raw => {
    let o; try { o = JSON.parse(raw); } catch (e) { return; }
    if (!o || typeof o !== 'object') return;
    if (!p) {
      const acc = String(o.acc || '').replace(/[^a-z0-9]/gi, '').slice(0, 40);
      if (o.t === 'chars') return ws.send(JSON.stringify({ t: 'chars', list: charList(acc), max: MAX_CHARS }));
      if (o.t === 'delChar') {
        const k = String(o.name || '').toLowerCase(), sv = saves[k];
        if (sv && !k.startsWith('__') && sv.acc === acc && ![...players.values()].some(q => q.key === k)) { delete saves[k]; storeSave(saves); }
        return ws.send(JSON.stringify({ t: 'chars', list: charList(acc), max: MAX_CHARS }));
      }
      if (o.t !== 'join') return;
      if (acc.length < 8) return ws.send(JSON.stringify({ t: 'err', m: 'Compte invalide, recharge la page.' }));
      const name = String(o.name || '').replace(/[^\p{L}\p{N}_\- ]/gu, '').trim().slice(0, 14);
      if (name.length < 2) return ws.send(JSON.stringify({ t: 'err', m: 'Choisis un pseudo de 2 à 14 caractères.' }));
      const key = name.toLowerCase();
      for (const q of players.values()) if (q.key === key) return ws.send(JSON.stringify({ t: 'err', m: 'Ce pseudo est déjà en jeu.' }));
      if (key.startsWith('__')) return ws.send(JSON.stringify({ t: 'err', m: 'Ce pseudo est réservé.' }));
      const sv = saves[key];
      if (sv && sv.acc && sv.acc !== acc) return ws.send(JSON.stringify({ t: 'err', m: 'Ce pseudo appartient déjà à un autre joueur.' }));
      if (!sv && charList(acc).length >= MAX_CHARS) return ws.send(JSON.stringify({ t: 'err', m: `Tu as déjà ${MAX_CHARS} personnages : supprimes-en un pour en créer un autre.` }));
      const cls = sv ? sv.cls : (CLASSES[o.cls] ? o.cls : 'guerrier');
      const loadIt = a => Array.isArray(a) ? cleanItem({ s: a[0], r: a[1], l: a[2], sd: a[3], c: a[4], u: a[5], g: a[6] }) : null;
      p = { id: nextId++, key, ws, acc, name: sv ? sv.name : name, cls, lvl: sv ? sv.lvl : 1, xp: sv ? sv.xp : 0,
        gold: sv ? sv.gold : 20, pots: sv ? sv.pots : 3, weap: sv ? sv.weap : 0,
        inv: sv && sv.inv ? sv.inv.map(loadIt).filter(Boolean) : [], eq: {},
        q: sv && sv.q ? { i: sv.q.i | 0, prog: sv.q.prog | 0, on: !!sv.q.on, g: typeof sv.q.g === 'string' && NPCS.some(n => n.id === sv.q.g) ? sv.q.g : null } : { i: 0, prog: 0, on: false, g: null },
        wps: new Set(sv && sv.wps ? sv.wps : [SPAWN_WP]), wp: sv && sv.wp ? sv.wp : SPAWN_WP, wear: Math.max(0, Math.min(50, sv && sv.wear | 0)), rq: sv && sv.rq && typeof sv.rq === 'object' ? sv.rq : {}, best: sv && sv.best && typeof sv.best === 'object' ? sv.best : {},
        dir: 0, mv: false, inp: { dx: 0, dy: 0 }, atkCd: 0, skCd: [0, 0, 0, 0], dead: false, deadT: 0, lastHurt: 0, autoAtk: false,
        buffT: 0, invT: 0, shield: 0, shieldT: 0, inst: 0, tgt: null, party: null, allies: 0,
        reborn: sv && sv.reborn | 0 || 0, tal: Object.assign(newTal(), sv && sv.tal || {}), mounts: new Set(sv && sv.mounts || []), mount: sv && sv.mount || null, riding: false,
        mat: sv && sv.mat || {}, prof: Object.assign(newProf(), sv && sv.prof || {}), ach: new Set(sv && sv.ach || []), title: sv && sv.title || '',
        stats: Object.assign({ kills: 0, maxRar: 0, forgeMax: 0, tower: 0, fish: 0, ore: 0, herb: 0, arena: 0, daily: 0, reborn: 0 }, sv && sv.stats || {}),
        daily: sv && sv.daily || null, look: Object.assign({ dye: 'base', aura: -1 }, sv && sv.look || {}), dyes: new Set(sv && sv.dyes || ['base']), gtag: sv && sv.gtag || '', gath: null };
      if (p.mount && !p.mounts.has(p.mount)) p.mount = null;
      for (const k of Object.keys(p.tal)) p.tal[k] = Math.max(0, Math.min(TALENT_MAX, p.tal[k] | 0));
      if (sv && sv.eq) for (const k of SLOTS) if (sv.eq[k]) p.eq[k] = loadIt(sv.eq[k]);
      // Nouveau personnage : une arme commune de sa classe pour commencer
      if (!sv) p.eq.arme = { id: nextId++, s: 'arme', c: cls, r: 0, l: 1, sd: (rnd() * 2e9) | 0, u: 0 };
      recalc(p); p.hp = maxHp(p);
      const wp = WAYPOINTS.find(w => w.id === p.wp) || WAYPOINTS[0];
      p.x = wp.x + (rnd() - 0.5); p.y = wp.y + 0.8;
      players.set(p.id, p);
      send(p, { t: 'welcome', id: p.id, w: W, h: H, worldH: WORLD_H, arena: ARENA, mapR: toB64(rleMapC()), npcs: NPCS, waypoints: WAYPOINTS,
        cls: p.cls, name: p.name, classes: CLASSES, local: LOCAL,
        mtypes: Object.fromEntries(Object.entries(MTYPES).map(([k, v]) => [k, { name: v.name, lvl: v.lvl, size: v.size, boss: !!v.boss, spec: v.spec }])), zones: ZONES.map(z => ({ k: z.k, name: z.name, bi: z.bi, tier: z.tier, x0: z.x0, y0: z.y0, x1: z.x1, y1: z.y1, lv: z.lv, props: z.props, tint: z.tint })),
        returning: !!sv, potionCost: POTION_COST, slotNames: SLOT_NAMES, rarNames: RAR_NAMES, invSize: INV_SIZE,
        uid: p.key, talents: TALENTS, classTalents: CLASS_TALENT, talentMax: TALENT_MAX, maxLvl: MAX_LVL, mountsDef: MOUNTS, gems: GEMS, gemMul: GEM_MUL, sockets: SOCKETS, mats: MATS,
        dyesDef: DYES, recipes: RECIPES, profs: PROFS, achDef: ACH.map(a => ({ id: a.id, name: a.name, desc: a.desc, n: a.n, title: a.title })),
        items: { slots: SLOTS, stats: SLOT_STATS, weaponStats: WEAPON_STATS, bonus: BONUS_BASE, names: BASE_NAMES, suffix: SUFFIX, setStat: SET_STAT, setSteps: SET_STEPS, mult: RAR_MULT, value: RAR_VALUE, tiers: TIERS, span: TIER_SPAN, tierLo: TIER_LO } });
      checkAch(p); sendInv(p); sendProg(p);
      broadcast({ t: 'chat', n: '★', m: `${p.name} (${CLASSES[p.cls].name}) a rejoint le royaume.` });
      if (sv && sv.cls !== o.cls) msg(p, `Bon retour ! Ton personnage est ${CLASSES[p.cls].name} niveau ${p.lvl}.`);
      console.log(`+ ${p.name} (${players.size} en ligne)`);
      return;
    }
    switch (o.t) {
      case 'in': { let dx = +o.dx || 0, dy = +o.dy || 0; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } p.inp = { dx, dy }; break; }
      case 'atk': doAttack(p); break;
      case 'auto': p.autoAtk = !!o.on; break;
      case 'skill': doSkill(p, Math.max(0, Math.min(3, o.i | 0))); break;
      case 'pot': usePotion(p); break;
      case 'autopot': p.autoPot = [0, 0.3, 0.5, 0.7].includes(+o.v) ? +o.v : 0; break;
      case 'use': interact(p); break;
      case 'dlg': onDlg(p, String(o.id || '')); break;
      case 'forge': {
        const brann = NPCS.find(n => n.kind === 'forge');
        if (p.inst || Math.hypot(brann.x - p.x, brann.y - p.y) > 3) return msg(p, 'Va voir Brann le forgeron au village pour améliorer tes objets.');
        const it = p.inv.find(i => i.id === o.id) || Object.values(p.eq).find(i => i && i.id === o.id);
        if (!it) return;
        const u = it.u || 0;
        if (u >= FORGE_MAX) return msg(p, 'Brann : « Cet objet est déjà au maximum (+9). »');
        const cost = forgeItemCost(it), fc = safeForgeFrags(it);
        if (p.gold < cost) return msg(p, `Brann : « Il me faut ${cost} pièces d'or pour ça. »`);
        if (o.safe && (p.mat.frag || 0) < fc) return msg(p, `Il faut ${fc} fragments de forge pour une amélioration sans risque.`);
        p.gold -= cost; if (o.safe) takeMat(p, 'frag', fc);
        const name = itemInfo(it, plv(p)).name;
        if (o.safe || rnd() < FORGE_CHANCE[u]) {
          it.u = u + 1; recalc(p); p.stats.forgeMax = Math.max(p.stats.forgeMax, it.u); dailyProg(p, 'forge'); checkAch(p);
          addFx({ k: 'forge', x: brann.x, y: brann.y }); send(p, { t: 'forgeres', ok: true, id: it.id });
          msg(p, `Réussite ! ${itemInfo(it, plv(p)).name}.`);
        } else { send(p, { t: 'forgeres', ok: false, id: it.id }); msg(p, `Échec : ${name} garde son niveau. Brann garde l'or.`); }
        sendInv(p); break;
      }
      case 'wptp': wpTeleport(p, String(o.id || '')); break;
      case 'logout': { const acc = p.acc; leave(); ws.send(JSON.stringify({ t: 'loggedOut', list: charList(acc), max: MAX_CHARS })); return; }
      case 'bank': bankOp(p, o); break;
      case 'talent': { const k = String(o.k); if (!(k in p.tal)) return; const n = Math.min(Math.max(1, o.n | 0), talentPoints(p), TALENT_MAX - p.tal[k]); if (n <= 0) return; p.tal[k] += n; recalc(p); break; }
      case 'talentReset': { const c = p.lvl * 20; if (p.gold < c) return msg(p, `Il faut ${c} or pour réinitialiser tes talents.`); p.gold -= c; p.tal = newTal(); recalc(p); msg(p, 'Talents réinitialisés.'); break; }
      case 'reborn': reincarnate(p); break;
      case 'mount': toggleMount(p); break;
      case 'autoMode': p.autoMode = !!o.on; break;
      case 'repair': repairGear(p); break;
      case 'mountOn': if (!p.riding && p.mount && !p.inst && !p.dead && Date.now() - p.lastHurt >= 3000) toggleMount(p); break;
      case 'gather': startGather(p); break;
      case 'craft': craft(p, String(o.id)); break;
      case 'craftGear': craftGear(p, o); break;
      case 'dbg': if (LOCAL || process.env.RA_DEBUG) { if (o.a === 'evt') evtNext = 0; if (o.a === 'tp') { p.x = +o.x; p.y = +o.y; } if (o.a === 'lvl') { p.lvl = o.v | 0; recalc(p); } if (o.a === 'mount' && MOUNTS[o.v]) p.mount = o.v; } break;
      case 'dclaim': dailyClaim(p, o.i | 0); break;
      case 'title': { const a = ACH.find(a => a.id === o.id); p.title = a && p.ach.has(a.id) ? a.title : ''; break; }
      case 'dye': { const k = String(o.id), d = DYES[k]; if (!d) return; if (!p.dyes.has(k)) { if (p.gold < d.cost) return msg(p, `Cette teinture coûte ${d.cost} or.`); p.gold -= d.cost; p.dyes.add(k); } p.look.dye = k; break; }
      case 'aura': { const r = o.r | 0; p.look.aura = r >= 2 && r <= p.stats.maxRar ? r : -1; break; }
      case 'socket': {
        const it = findItem(p, o.id), c = String(o.gem); if (!it || !gemOk(c)) return;
        if ((it.g || []).length >= SOCKETS[it.r]) return msg(p, "Plus d'emplacement libre sur cet objet.");
        if (!takeMat(p, 'g_' + c, 1)) return msg(p, "Tu n'as pas cette gemme.");
        it.g = (it.g || []).concat(c); recalc(p); sendInv(p); msg(p, `${gemName(c)} sertie dans ${itemInfo(it, plv(p)).name}.`); break;
      }
      case 'unsocket': { const it = findItem(p, o.id); if (!it || !it.g || !it.g[o.i | 0]) return; const c = it.g.splice(o.i | 0, 1)[0]; recalc(p); sendInv(p); msg(p, `${gemName(c)} détruite.`); break; }
      case 'fuse': {
        const c = String(o.gem); if (!gemOk(c) || +c[1] >= 5) return;
        if (!takeMat(p, 'g_' + c, 3)) return msg(p, 'Il faut 3 gemmes identiques.');
        const up = c[0] + (+c[1] + 1); addMat(p, 'g_' + up); msg(p, `Fusion réussie : ${gemName(up)}.`); break;
      }
      case 'recycle': {
        const it = p.inv.find(i => i.id === o.id); if (!it) return;
        if (trades.has(p.id)) return msg(p, "Termine d'abord ton échange.");
        const n = recycleFrags(it); p.inv = p.inv.filter(i => i !== it); addMat(p, 'frag', n);
        for (const c of it.g || []) addMat(p, 'g_' + c);
        sendInv(p); msg(p, `Recyclé : +${n} fragments de forge${it.g && it.g.length ? ' (gemmes récupérées)' : ''}.`); break;
      }
      case 'leaveInst': if (p.inst) { const I = instances.get(p.inst); if (I && I.kind === 'arena') arenaEnd(I, false); respawnAt(p); send(p, { t: 'tp' }); } break;
      case 'arenaStart': startArena(p, o.opp || {}); break;
      case 'hubTake': hubTake(p, o); break;
      case 'hubGive': hubGive(p, o); break;
      case 'setTag': p.gtag = String(o.tag || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4); break;
      case 'wpset': { const w = WAYPOINTS.find(w => w.id === o.id); if (w && p.wps.has(w.id)) { p.wp = w.id; msg(p, `Tu réapparaîtras désormais à : ${w.name}.`); } break; }
      case 'target': { const m = monsters.find(m => m.id === o.id && !m.dead && same(m, p)); p.tgt = m ? m.id : null; break; }
      case 'equip': {
        const it = p.inv.find(i => i.id === o.id); if (!it) return;
        if (it.s === 'arme' && it.c !== p.cls) return msg(p, `Cette arme est réservée à la classe ${CLASSES[it.c].name}. Vends-la ou échange-la.`);
        const old = p.eq[it.s]; p.inv = p.inv.filter(i => i !== it); if (old) p.inv.push(old); p.eq[it.s] = it; recalc(p); sendInv(p); break;
      }
      case 'unequip': {
        const it = p.eq[o.slot]; if (!it) return;
        if (p.inv.length >= INV_SIZE) return msg(p, 'Ton sac est plein.');
        p.eq[o.slot] = null; p.inv.push(it); recalc(p); sendInv(p); break;
      }
      case 'bulk': { // vente ou recyclage de plusieurs objets d'un coup
        if (trades.has(p.id)) return msg(p, "Termine d'abord ton échange.");
        const ids = new Set((Array.isArray(o.ids) ? o.ids : []).slice(0, INV_SIZE));
        const sel = p.inv.filter(i => ids.has(i.id)); if (!sel.length) return;
        p.inv = p.inv.filter(i => !ids.has(i.id));
        if (o.op === 'recycle') {
          let n = 0, gems = 0; for (const it of sel) { n += recycleFrags(it); for (const c of it.g || []) { addMat(p, 'g_' + c); gems++; } }
          addMat(p, 'frag', n); msg(p, `${sel.length} objet${sel.length > 1 ? 's' : ''} recyclé${sel.length > 1 ? 's' : ''} : +${n} fragments de forge${gems ? `, ${gems} gemme${gems > 1 ? 's' : ''} récupérée${gems > 1 ? 's' : ''}` : ''}.`);
        } else {
          let g = 0; for (const it of sel) g += itemInfo(it).value; p.gold += g; addFx({ k: 'coin', x: p.x, y: p.y }, p.inst);
          msg(p, `${sel.length} objet${sel.length > 1 ? 's' : ''} vendu${sel.length > 1 ? 's' : ''} pour ${g} pièces d'or.`);
        }
        sendInv(p); break;
      }
      case 'sell': {
        const it = p.inv.find(i => i.id === o.id); if (!it) return;
        if (trades.has(p.id)) return msg(p, "Termine d'abord ton échange.");
        p.inv = p.inv.filter(i => i !== it); p.gold += itemInfo(it).value; sendInv(p); break;
      }
      case 'emote': { const k = ['salut', 'danse', 'rire', 'coeur'].includes(o.k) ? o.k : null; if (k) addFx({ k: 'emote', x: p.x, y: p.y, id: p.id, e: k }, p.inst); break; }
      case 'party':
        if (o.op === 'invite') partyInvite(p, o.to);
        else if (o.op === 'accept') partyAccept(p, o.from);
        else if (o.op === 'decline') { const q = players.get(o.from); p.partyInv = null; if (q) msg(q, `${p.name} décline l'invitation.`); }
        else if (o.op === 'leave') partyLeave(p);
        break;
      case 'trade': onTrade(p, o); break;
      case 'board': send(p, { t: 'board', rows: boardRows() }); break;
      case 'describe': send(p, { t: 'desc', ref: o.ref, items: (Array.isArray(o.items) ? o.items : []).slice(0, 8).map(cleanItem).filter(Boolean).map(i => itemInfo(i, plv(p))) }); break;
      case 'allies': if (LOCAL) p.allies = Math.max(0, Math.min(3, o.n | 0)); break;
      case 'tradeApply': {
        if (!LOCAL) return;
        const give = (Array.isArray(o.give) ? o.give : []).filter(id => p.inv.some(i => i.id === id));
        const get = (Array.isArray(o.get) ? o.get : []).slice(0, 8).map(cleanItem).filter(Boolean);
        const gg = Math.max(0, Math.min(p.gold, Math.floor(+o.gold || 0))), rg = Math.max(0, Math.min(100000, Math.floor(+o.getGold || 0)));
        if (p.inv.length - give.length + get.length > INV_SIZE) return msg(p, 'Échange annulé : sac plein.');
        p.inv = p.inv.filter(i => !give.includes(i.id)).concat(get); p.gold += rg - gg; sendInv(p); msg(p, 'Échange réussi !'); break;
      }
      default: if (typeof kvHandle === 'function') kvHandle(p, o); break;
      case 'chat': {
        const m = String(o.m || '').slice(0, 120).trim();
        if (!m || Date.now() - lastChat < 800) return; lastChat = Date.now();
        broadcast({ t: 'chat', n: p.name, m, id: p.id }); break;
      }
    }
  };
  function leave() {
    if (!p) return;
    const tr = trades.get(p.id); if (tr) tradeEnd(tr, 'Échange annulé.');
    partyLeave(p, true); leaveInstance(p);
    saves[p.key] = snapshotSave(p); players.delete(p.id); persist();
    for (const m of monsters) if (m.target === p.id) m.target = null;
    broadcast({ t: 'chat', n: '★', m: `${p.name} a quitté le royaume.` });
    console.log(`- ${p.name} (${players.size} en ligne)`);
    p = null;
  }
  ws.onclose = leave;
}
/* ===== ENGINE END ===== */

/* ============================================================
   Petite base partagée (guildes, hôtel des ventes, arène) — version serveur
   ============================================================ */
const KV_FILE = path.join(DATA_DIR, 'shared.json');
let kv = {}; try { kv = JSON.parse(fs.readFileSync(KV_FILE, 'utf8')); } catch (e) {}
let kvTimer = null;
function kvSave() { cloudMark('shared', kv); clearTimeout(kvTimer); kvTimer = setTimeout(() => { try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(KV_FILE, JSON.stringify(kv)); } catch (e) {} }, 1000); }
const COLS = ['guilds', 'gmembers', 'gbank', 'ah', 'arena', 'board'];
function kvHandle(p, o) {
  if (o.t !== 'kv' || !COLS.includes(o.col)) return;
  const col = kv[o.col] || (kv[o.col] = {});
  const reply = (ok, docs) => send(p, { t: 'kvr', ref: o.ref, ok, docs });
  const id = String(o.id || '').slice(0, 80);
  switch (o.op) {
    case 'get': return reply(true, col[id] ? [{ id, data: col[id] }] : []);
    case 'set': if (!id || !o.data || typeof o.data !== 'object' || JSON.stringify(o.data).length > 4000) return reply(false); col[id] = o.data; kvSave(); return reply(true, []);
    case 'del': delete col[id]; kvSave(); return reply(true, []);
    case 'list': {
      let docs = Object.entries(col).map(([id, data]) => ({ id, data }));
      for (const [f, , v] of (Array.isArray(o.where) ? o.where : [])) docs = docs.filter(d => d.data[f] === v);
      if (o.order) { const [f, dir] = o.order; docs.sort((a, b) => ((a.data[f] ?? 0) < (b.data[f] ?? 0) ? -1 : 1) * (dir === 'desc' ? -1 : 1)); }
      return reply(true, docs.slice(0, Math.min(200, o.limit || 200)));
    }
  }
}

/* ============================================================
   HTTP
   ============================================================ */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let u = decodeURIComponent((req.url || '/').split('?')[0]);
  if (u === '/') u = '/index.html';
  // dossier public/ ; sinon (fichiers tous envoyés au même niveau), seulement les fichiers du jeu
  const flat = !fs.existsSync(PUB), FLAT_OK = ['/index.html', '/game.js', '/heroes.js'];
  if (flat && !FLAT_OK.includes(u)) { res.writeHead(404); return res.end('Introuvable'); }
  const base = flat ? __dirname : PUB, f = path.normalize(path.join(base, u));
  if (!f.startsWith(base)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Introuvable'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});
server.on('upgrade', (req, socket) => {
  if ((req.headers.upgrade || '').toLowerCase() !== 'websocket') return socket.destroy();
  const ws = upgradeToWS(req, socket);
  if (ws) onConnection(ws);
});
(async () => {
  if (CLOUD) {
    const [sv, sh] = [await cloudGet('saves'), await cloudGet('shared')];
    if (sv) { for (const k of Object.keys(saves)) delete saves[k]; Object.assign(saves, sv); }
    if (sh) { for (const k of Object.keys(kv)) delete kv[k]; Object.assign(kv, sh); }
    console.log(`Sauvegardes du nuage chargées : ${sv ? Object.keys(sv).length : 0} entrées`);
    const bye = async () => { try { persist(); await cloudFlush(); } finally { process.exit(0); } };
    process.on('SIGTERM', bye); process.on('SIGINT', bye);
  }
  server.listen(PORT, () => console.log(`MMODD en ligne sur http://localhost:${PORT}`));
})();
if (!CLOUD) {
  process.on('SIGINT', () => { persist(); process.exit(0); });
  process.on('SIGTERM', () => { persist(); process.exit(0); });
}

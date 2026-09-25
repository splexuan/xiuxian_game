/* ═══════════════════════════════════════════════════════
   smoke-test.js — 无头逻辑冒烟测试 / 平衡性验证
   用法：node tests/smoke-test.js [模拟小时数]

   在 Node 中以 vm 沙箱加载全部「逻辑层」脚本，驱动一个自动
   游玩 AI 长时间运行，验证：
     1) 无异常抛出
     2) 数值不出现 NaN / Infinity / 负数
     3) 进度持续推进且节奏合理（不会过快或停滞）
     4) 存档读写往返一致
     5) 通天塔的可爬升深度处于设计区间
   ═══════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const LOGIC_FILES = [
  'src/js/core/utils.js',
  'src/js/data/realms.js',
  'src/js/data/content.js',
  'src/js/data/content2.js',
  'src/js/core/state.js',
  'src/js/systems/cultivation.js',
  'src/js/systems/combat.js',
  'src/js/systems/economy.js',
  'src/js/systems/pets.js',
  'src/js/systems/meta.js',
  'src/js/systems/forge.js',
  'src/js/systems/gacha.js',
  'src/js/systems/quest.js',
];

/* ── 沙箱 ── */
const store = {};
let randomSeed = 0x1a2b3c4d;
const seededRandom = () => {
  randomSeed = (Math.imul(randomSeed, 1664525) + 1013904223) >>> 0;
  return randomSeed / 4294967296;
};
let clock = Date.now();
const TestDate = class extends Date {
  constructor(...args) { super(...(args.length ? args : [clock])); }
  static now() { return clock; }
};
const sandbox = {
  console,
  Math, Date: TestDate, JSON, Object, Array, String, Number, Boolean, isNaN, isFinite, parseInt, parseFloat,
  setTimeout, clearTimeout, setInterval, clearInterval,
  performance: { now: () => Date.now() },
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  },
  requestAnimationFrame: () => 0,
  addEventListener: () => {},
  location: { reload: () => {} },
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
sandbox.__testRandom = seededRandom;
const setSandboxRandom = fn => {
  sandbox.__testRandom = fn;
  vm.runInContext('Math.random = __testRandom;', sandbox);
};
setSandboxRandom(seededRandom);

let loadErrors = 0;
for (const f of LOGIC_FILES) {
  const code = fs.readFileSync(path.join(ROOT, f), 'utf8');
  try { vm.runInContext(code, sandbox, { filename: f }); }
  catch (e) { console.error(`[加载失败] ${f}\n  ${e.message}`); loadErrors++; }
}
if (loadErrors) { console.error('\n脚本加载失败，终止。'); process.exit(1); }

const XG = sandbox.window.XG;
const U = XG.U;
// 状态对象可能被飞升整体替换，故一律通过 getter 访问
const S = () => XG.State.s;

console.log('== 脚本加载完成 ==');
console.log(`境界 ${XG.REALMS.length} | 功法 ${XG.ARTS.length} | 建筑 ${XG.BUILDINGS.length} | 丹药 ${XG.PILLS.length}` +
  ` | 灵宠 ${XG.PETS.length} | 奇遇 ${XG.EVENTS.length} | 道果 ${XG.ACHIEVEMENTS.length} | 秘境 ${XG.ZONE_NAMES.length * 2}`);

/* ── 运行环境装配 ── */
if (process.env.TOWER_GROWTH) XG.Combat.TOWER_GROWTH = parseFloat(process.env.TOWER_GROWTH);
XG.Combat.autoBossBattle = true;
const closeBattleOnEnd = () => { XG.Combat.closeResult(); };
XG.Bus.on('battle:end', closeBattleOnEnd);
XG.Bus.on('event:show', d => {
  const ev = d.ev;
  if (!ev.choices) { XG.Events.close(); return; }
  for (let i = 0; i < ev.choices.length; i++) {
    const r = XG.Events.choose(ev, i);
    if (r && r.ok) return;
  }
  XG.Events.close();
});

const errors = [];
const origErr = console.error;
console.error = (...a) => { errors.push(a.join(' ')); origErr('[捕获]', ...a); };

const dbg = { tribStart: 0, tribWin: 0, tribLose: 0, towerWin: 0, towerLose: 0, ascends: 0 };
const _st = XG.Cult.startTribulation.bind(XG.Cult);
XG.Cult.startTribulation = function () { const r = _st(); if (r) dbg.tribStart++; return r; };
XG.Bus.on('tribulation:win', () => dbg.tribWin++);
XG.Bus.on('tribulation:lose', () => dbg.tribLose++);
XG.Bus.on('tower:win', () => dbg.towerWin++);
XG.Bus.on('tower:lose', () => dbg.towerLose++);
XG.Bus.on('ascend', () => dbg.ascends++);

let s = S();
s.settings.autoBreak = true;
s.settings.autoPill = true;
XG.Combat.setExploring(true);
s.explore.zone = 0;

/* 记录首次到达各境界的时间点，用于节奏契约断言 */
const firstReach = {};

/* ── 自动游玩 AI（模拟一位决策激进但合理的玩家） ── */
function ai() {
  const s = S();
  const C = XG.State.Calc;

  // 0) 道途：达标即领
  let gq = 0;
  while (gq++ < 6) { if (!XG.Quest.claim().ok) break; }

  // 1) 洞天：保留 15% 余钱，其余投入建设
  for (const b of XG.BUILDINGS) {
    if (!XG.Economy.canUnlockBuilding(b)) continue;
    let guard = 0;
    while (s.res.stone > C.buildCost(b) * 1.15 && guard++ < 150) {
      if (!XG.Economy.upgradeBuilding(b.id).ok) break;
    }
  }

  // 2) 功法：心法 → 攻伐 → 护体 → 身法
  const artMax = C.artMaxLv();
  for (const t of ['mind', 'atk', 'body', 'agile']) {
    for (const a of XG.ARTS) {
      if (a.type !== t || !s.arts[a.id]) continue;
      let guard = 0;
      while (s.res.stone > C.artCost(a) * 1.4 && s.arts[a.id].lv < artMax && guard++ < 120) {
        if (!XG.Economy.upgradeArt(a.id, 1).ok) break;
      }
    }
  }

  // 3) 神通：未配满则自动配置
  if (!s.skills[0] || !s.skills[1] || !s.skills[2]) XG.Combat.autoSkills();

  // 4) 寻宝阁：仙玉三池，保留 20 仙玉应急
  for (const pool of ['art', 'equip', 'pet']) {
    let g = 0;
    while (g++ < 40) {
      const info = XG.Gacha.info(pool);
      if (!info) break;
      if (s.res.jade < info.single + 20) break;
      const times = s.res.jade >= info.ten + 20 ? 10 : 1;
      if (!XG.Gacha.pull(pool, times).ok) break;
    }
  }
  // 采药池：灵石富余时才抽
  let gm = 0;
  while (gm++ < 15) {
    const info = XG.Gacha.info('mat');
    if (!info || s.res.stone < info.single * 8) break;
    if (!XG.Gacha.pull('mat', 1).ok) break;
  }

  // 5) 灵宠：孵化 + 培养
  let ge = 0;
  while (s.res.jade >= 30 && ge++ < 20) {
    const before = XG.Pets.unowned().length;
    if (before === 0) break;
    if (!XG.Pets.buyEgg(1).ok) break;
    XG.Pets.hatchAll();
  }
  if (s.pets.eggs > 0) XG.Pets.hatchAll();
  for (const pid of s.pets.owned) {
    const d = s.pets.data[pid];
    if (d && d.lv < XG.Pets.maxLv(pid) && s.res.stone > XG.Pets.levelCost(pid) * 4) XG.Pets.levelUp(pid, 5);
  }
  XG.Pets.autoBest();

  // 6) 炼丹
  for (const p of XG.Economy.pillsUnlocked()) { if (XG.Economy.canCraft(p, 1).ok) XG.Economy.craft(p.id, 1); }

  // 7) 装备：先换装，再强化
  XG.Economy.autoEquip();
  for (const sl of XG.SLOTS) {
    const eq = s.equip[sl.id];
    if (!eq) continue;
    let g = 0;
    while (g++ < 12) {
      if ((eq.enh || 0) >= XG.FORGE_CFG.ENHANCE_MAX) break;
      if (s.res.stone < XG.Forge.enhanceCost(eq) * 3) break;
      if (!XG.Forge.enhance(eq.id).ok) break;
    }
  }
  // 8) 锻炉：三合一升品
  let gf = 0;
  while (gf++ < 30) {
    const t = XG.Forge.mergeTargets().filter(x => s.res.stone >= x.cost * 3);
    if (!t.length) break;
    if (!XG.Forge.merge(t[0].slot, t[0].q).ok) break;
  }
  // 9) 宝石：合成高階 + 镶嵌
  let gg = 0;
  while (gg++ < 20) {
    const list = XG.Forge.gemList().filter(x => x.n >= 3 && x.tier < XG.GEM_MAX_TIER);
    if (!list.length) break;
    if (!XG.Forge.gemMerge(list[0].id, list[0].tier).ok) break;
  }
  XG.Forge.autoSocket();
  // 10) 灵材合成
  let gmm = 0;
  while (gmm++ < 12) {
    const m = XG.MATS.filter(x => (s.mats[x.id] || 0) >= 3 && x.q < 6).sort((a, b) => a.q - b.q)[0];
    if (!m) break;
    if (!XG.Forge.matUpgrade(m.id).ok) break;
  }
  if (s.equipBag.length > 45) XG.Economy.sellAllBelow(3);

  // 11) 秘境：挑选「能稳胜」的最高级区域
  const mine = C.power(C.playerStats());
  let best = 0;
  for (let i = 0; i < XG.Combat.totalZones(); i++) {
    const z = XG.Combat.zoneAt(i);
    if (!z.unlocked) break;
    if (C.power(XG.Combat.makeEnemy(z.refR, z.mult)) * 1.5 < mine) best = i;
  }
  s.explore.zone = best;
  if (!s.explore.running) {
     const z = XG.Combat.zoneAt(best);
     if (z && C.power(XG.Combat.makeEnemy(z.refR, z.mult)) * 1.4 < mine) XG.Combat.setExploring(true);
   }

  // 12) 通天塔（仅在空闲时）
   if (!XG.Combat.active && !XG.Combat.last) {
    for (let k = 0; k < 12; k++) {
      const f = s.tower.best + 1;
      const te = XG.Combat.towerEnemy(f);
      if (C.power(te) * 1.2 < mine) { XG.Combat.challengeTower(f); break; }
      else break;
    }
  }

  // 13) 飞升
  if (XG.Prestige.canAscend() && s.prestige.earned < 120) {
    const r = XG.Prestige.ascend();
    if (r.ok) {
      const ns = S();
       ns.settings.autoBreak = true; ns.settings.autoPill = true;
       XG.Combat.setExploring(true);
       ns.explore.zone = 0;
    }
  }
  // 14) 仙缘天赋
  let gt = 0;
  while (XG.Prestige.freePoints() > 0 && gt++ < 60) {
    let bought = false;
    for (const t of XG.TALENTS) { if (XG.Prestige.buyTalent(t.id).ok) { bought = true; break; } }
    if (!bought) break;
  }
}

/* ── 主模拟 ── */
const HOURS = parseFloat(process.argv[2] || '2');
const dt = 0.25;
const total = Math.round(HOURS * 3600 / dt);
const aiEvery = Math.max(1, Math.round(4 / dt));
let nanHit = null;

console.log(`\n== 开始模拟 ${HOURS} 小时（步长 ${dt}s，每 4s 决策一次）==`);
const t0 = Date.now();
const snapshots = [];

for (let i = 0; i < total; i++) {
  clock += dt * 1000;
  try {
    XG.Cult.tick(dt);
    XG.Combat.tickExplore(dt);
    XG.Combat.tickBattle(dt);
    if (i % aiEvery === 0) {
      ai();
      s = S();
      if (firstReach[s.realm] === undefined) firstReach[s.realm] = i * dt;
      snapshots.push({ t: i * dt, realm: s.realm, layer: s.layer, rate: XG.State.Calc.spiritRate(), stone: s.res.stone });
    }
  } catch (e) {
    console.error(`[tick 异常] t=${(i * dt).toFixed(1)}s\n${e.stack}`);
    break;
  }
  if (i % 3000 === 0) {
    const C = XG.State.Calc, st = S();
    const p = C.playerStats();
    const bad = Object.entries({
      spirit: st.spirit, stone: st.res.stone, herb: st.res.herb, jade: st.res.jade,
      realm: st.realm, layer: st.layer, atk: p.atk, hp: p.maxHp, rate: C.spiritRate(),
    }).find(([, v]) => typeof v !== 'number' || !isFinite(v) || isNaN(v) || v < 0);
    if (bad && !nanHit) nanHit = bad;
  }
}
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

s = S();
const C = XG.State.Calc;
const p = C.playerStats();

/* ── 通天塔爬升探测 ── */
function towerProbe() {
  let lo = 1, hi = 400, best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const e = XG.Combat.towerEnemy(mid);
    const res = XG.Combat.simulate(C.playerStats(), e);
    if (res.win) { best = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return best;
}
const towerMax = towerProbe();

/* ── 报告 ── */
console.log(`\n== 模拟结束（耗时 ${elapsed}s）==`);
console.log(`境界            : ${XG.R.name(s.realm, s.layer)}`);
console.log(`灵气/秒         : ${U.fmt(C.spiritRate())}`);
console.log(`灵石/灵草/仙玉   : ${U.fmt(s.res.stone)} / ${U.fmt(s.res.herb)} / ${U.fmt(s.res.jade)}`);
console.log(`攻/血/防        : ${U.fmt(p.atk)} / ${U.fmt(p.maxHp)} / ${U.fmt(p.def)}`);
console.log(`战力            : ${U.fmt(C.power(p))}`);
console.log(`通天塔 已通关/当前可达: ${s.tower.best} / ${towerMax}`);
console.log(`飞升次数/仙缘点  : ${s.prestige.times} / ${s.prestige.earned}`);
console.log(`道果            : ${XG.Achieve.count()} / ${XG.ACHIEVEMENTS.length}`);
console.log(`功法            : ${Object.keys(s.arts).length} / ${XG.ARTS.length}`);
console.log(`灵宠            : ${s.pets.owned.length} 只（出战 ${s.pets.active.length}）`);
console.log(`击杀/突破/渡劫   : ${s.stats.kills} / ${s.stats.breakthroughs} / ${s.stats.tribulations}`);
console.log(`天劫 起/胜/负    : ${dbg.tribStart} / ${dbg.tribWin} / ${dbg.tribLose}`);
console.log(`洞天总等级       : ${Object.values(s.buildings).reduce((a, b) => a + b, 0)}`);
console.log(`装备            : ${XG.SLOTS.map(sl => (s.equip[sl.id] ? s.equip[sl.id].name : '空')).join(' / ')}`);
console.log(`奇遇次数         : ${s.stats.events}`);

/* 关键节点（每约 6 分钟） */
const marks = [];
for (let i = 0; i < snapshots.length; i += 90) marks.push(snapshots[i]);
console.log('\n-- 进度时间线 --');
console.log(marks.map(m => `${U.time(m.t)}=${XG.R.name(m.realm, m.layer)}`).join('  '));

console.log('\n-- 首次抵达境界的耗时 --');
for (const k in firstReach) {
  console.log(`  ${XG.REALMS[k].name}境 : ${U.time(firstReach[k])}`);
}
const tAscend = firstReach[XG.CONFIG.ASCEND_MIN_REALM];
const tMax = firstReach[XG.REALMS.length - 1];

/* ── 断言 ── */
const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); };

ok(!nanHit, `数值异常：${nanHit ? nanHit[0] + '=' + nanHit[1] : ''}`);
ok(errors.length === 0, `捕获 ${errors.length} 条错误日志（前 3）：\n    ` + errors.slice(0, 3).join('\n    '));
ok(s.realm >= 2, `境界过低（${XG.R.name(s.realm, s.layer)}），核心循环可能停滞`);

/* ── 节奏契约 ──
   下列区间基于「接近最优的自动游玩」测得；真人操作通常慢 2~4 倍。 */
ok(tAscend !== undefined, `未能抵达飞升门槛（${XG.REALMS[XG.CONFIG.ASCEND_MIN_REALM].name}境）`);
ok(tAscend === undefined || tAscend >= 15 * 60,
  `抵达飞升门槛仅用 ${U.time(tAscend)}，前期过于急促（期望 ≥15 分钟）`);
ok(tAscend === undefined || tAscend <= 3 * 3600,
  `抵达飞升门槛耗时 ${U.time(tAscend)}，前期过于拖沓（期望 ≤3 小时）`);
if (tMax !== undefined) {
  ok(tMax >= 45 * 60, `满级（大罗）仅用 ${U.time(tMax)}，长线内容不足（期望 ≥45 分钟）`);
}
ok(towerMax >= 25, `通天塔上限过浅（${towerMax} 层），后期内容不足`);
ok(towerMax <= 200, `通天塔上限过深（${towerMax} 层），长期缺乏挑战`);
ok(C.spiritRate() > 0 && isFinite(C.spiritRate()), '灵气速率为正且有限');
ok(isFinite(C.power(p)) && C.power(p) > 0, '战力异常');
ok(s.stats.breakthroughs > 10, '突破次数过少');
ok(Object.keys(s.arts).length > 5, '功法获取过少');
ok(Object.values(s.buildings).reduce((a, b) => a + b, 0) > 20, '洞天建设未推进');
ok(s.pets.owned.length > 0, '未获得灵宠');
ok(s.explore.wins > 20, '秘境探索未产出');
ok(s.tower.best > 5, '通天塔未推进');
ok(towerMax >= 25, `通天塔上限过浅（${towerMax} 层），后期内容不足`);
ok(towerMax <= 95, `通天塔上限过深（${towerMax} 层），长时间无挑战`);

/* ── 存档往返 ── */
try {
  XG.State.Save.save(true);
  const result = XG.State.Save.load();
  const cur = S();
  ok(result && result.status === 'ok' && result.state, '存档读取状态不是 ok');
  const loaded = result && result.state;
  ok(loaded && loaded.realm === cur.realm && loaded.layer === cur.layer, '存档读写不一致（境界丢失）');
  ok(loaded && loaded.tower && loaded.tower.best === cur.tower.best, '存档塔层丢失');
  ok(loaded && Object.keys(loaded.arts).length === Object.keys(cur.arts).length, '存档功法丢失');
  ok(loaded && loaded.res && loaded.res.stone === cur.res.stone, '存档灵石丢失');
  ok(loaded && !!loaded.prestige && loaded.prestige.earned === cur.prestige.earned, '存档飞升数据丢失');
  ok(result && result.raw === store[XG.State.SAVE_KEY], '存档原始数据未返回');
} catch (e) {
  fails.push('存档测试异常：' + e.message);
}

/* ── 离线结算测试 ── */
try {
  const cur = S();
  cur.meta.lastSeen = Date.now() - 3600 * 1000;   // 假装离线 1 小时
  const before = cur.res.stone;
  const rep = XG.Cult.applyOffline();
  ok(rep && rep.capped > 0, '离线结算未生效');
  ok(S().res.stone >= before, '离线灵石为负');
} catch (e) {
  fails.push('离线结算异常：' + e.message);
}

{
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const check = (name, fn) => {
    try { fn(); } catch (e) { fails.push(name + '异常：' + (e && e.stack || e)); }
  };
  const clearCombat = () => {
    if (XG.Combat.active) {
      XG.Combat.active.p.hp = 0;
      XG.Combat.endBattle();
    }
    if (XG.Combat.last) XG.Combat.closeResult();
  };
  const resetLogic = () => {
    clearCombat();
    XG.State.Save.unlock();
    XG.State.Save.conflict = null;
    XG.State.Save._knownRaw = null;
    for (const k of Object.keys(store)) if (k.indexOf(XG.State.SAVE_KEY) === 0) delete store[k];
    XG.State.reset();
    const st = S();
    st.res.stone = 1e12;
    st.res.herb = 1e9;
    st.res.jade = 1e9;
    return st;
  };
  const withRandom = (value, fn) => {
    const old = sandbox.__testRandom;
    setSandboxRandom(() => value);
    try { return fn(); } finally { setSandboxRandom(old); }
  };
  const muted = fn => {
    const oldError = console.error;
    const oldWarn = console.warn;
    console.error = () => {};
    console.warn = () => {};
    try { return fn(); } finally { console.error = oldError; console.warn = oldWarn; }
  };
  const gemTotals = st => {
    const out = {};
    const add = (key, n) => {
      n = Number(n) || 0;
      if (n > 0) out[key] = (out[key] || 0) + n;
    };
    for (const key in st.gems) add(key, st.gems[key]);
    const addEq = eq => {
      for (const g of (eq && eq.sockets || [])) {
        if (g && typeof g.id === 'string') add(g.id + '_' + (Number(g.tier) || 1), 1);
      }
    };
    for (const sl of XG.SLOTS) addEq(st.equip[sl.id]);
    for (const eq of st.equipBag) addEq(eq);
    const sorted = {};
    for (const key of Object.keys(out).sort()) sorted[key] = out[key];
    return sorted;
  };
  const makeEq = (id, slot, q, score, gem) => ({
    id, slot, q, stats: { atk: score }, score, enh: 0,
    sockets: [gem ? { id: gem.id, tier: gem.tier } : null], set: null,
    from: 'test', realm: 0,
  });
  const breakSnapshot = st => ({
    realm: st.realm,
    layer: st.layer,
    breakthroughs: st.stats.breakthroughs,
    failed: st.stats.breakthroughsFailed,
    stone: st.res.stone,
    herb: st.res.herb,
    jade: st.res.jade,
  });

  check('飞升元进度与出战宠物引用', () => {
    const st = resetLogic();
    st.realm = XG.CONFIG.ASCEND_MIN_REALM;
    st.layer = XG.CONFIG.LAYERS_PER_REALM;
    st.res.jade = 1e9;
    st.perm = { spirit: 7, all: 5 };
    st.permBonus = { spirit: 0.13, atk: 0.17, hp: 0.19, stone: 0.23, all: 0.29, break: 0.31 };
    st.gems = { g_atk_1: 4, g_hp_3: 2 };
    st.gacha.pity = { art: 3, equip: 7, pet: 11, mat: 9 };
    st.gacha.total = { art: 13, equip: 17, pet: 19, mat: 23 };
    const owned = XG.PETS.slice(0, 5).map(x => x.id);
    st.pets = {
      owned,
      data: Object.fromEntries(owned.map(id => [id, { lv: 4 }])),
      eggs: 2,
      active: owned.slice(),
    };
    st.buildings.b_garden = 4;
    XG.State.set(st);
    const before = {
      perm: JSON.stringify(S().perm),
      permBonus: JSON.stringify(S().permBonus),
      gems: JSON.stringify(S().gems),
      pity: JSON.stringify(S().gacha.pity),
      times: S().prestige.times,
    };
    ok(XG.State.Save.save(true), '飞升回归准备存档失败');
    const result = XG.Prestige.ascend();
    const after = S();
    ok(result.ok, '飞升未成功');
    ok(JSON.stringify(after.perm) === before.perm, '飞升丢失 perm');
    ok(JSON.stringify(after.permBonus) === before.permBonus, '飞升丢失 permBonus');
    ok(JSON.stringify(after.gems) === before.gems, '飞升丢失 gems');
    ok(JSON.stringify(after.gacha.pity) === before.pity, '飞升丢失 gacha pity');
    ok(after.prestige.times === before.times + 1, '飞升次数未递增');
    const slots = XG.State.Calc.mods().petSlots;
    ok(after.pets.active.length <= slots, '飞升后出战宠物超过栏位');
    ok(after.pets.active.every(id => after.pets.owned.includes(id)), '飞升后出战宠物含未拥有引用');
    ok(new Set(after.pets.active).size === after.pets.active.length, '飞升后出战宠物重复');
  });

  check('装备合成出售溢出宝石守恒', () => {
    let st = resetLogic();
    const gem = { id: 'g_atk', tier: 1 };
    st.equipBag.push(makeEq('merge-1', 'weapon', 1, 10, gem));
    st.equipBag.push(makeEq('merge-2', 'weapon', 1, 20, gem));
    st.equipBag.push(makeEq('merge-3', 'weapon', 1, 30, gem));
    const mergeBefore = gemTotals(st);
    const merged = XG.Forge.merge('weapon', 1);
    ok(merged.ok, '装备合成未执行');
    ok(same(mergeBefore, gemTotals(S())), '装备合成造成宝石总量变化');

    st = resetLogic();
    const recoverEq = makeEq('direct-recover', 'ring', 1, 45, { id: 'g_spirit', tier: 1 });
    st.equipBag.push(recoverEq);
    const recoverBefore = gemTotals(st);
    const recovered = XG.Equip.recoverGems(recoverEq);
    ok(recovered.length === 1 && same(recoverBefore, gemTotals(S())), 'Equip.recoverGems 未保持宝石总量');
    const direct = makeEq('direct-destroy', 'ring', 1, 50, { id: 'g_spirit', tier: 1 });
    st.equipBag.push(direct);
    const directBefore = gemTotals(st);
    const destroyed = XG.Equip.destroy(direct);
    ok(destroyed.ok && destroyed.gems.length === 1, 'Equip.destroy 未回收镶嵌宝石');
    ok(same(directBefore, gemTotals(S())), 'Equip.destroy 造成宝石总量变化');

    st = resetLogic();
    st.equipBag.push(makeEq('sale-1', 'armor', 1, 40, { id: 'g_hp', tier: 2 }));
    const saleBefore = gemTotals(st);
    ok(XG.Economy.sellEquip('sale-1') > 0, '出售装备未执行');
    ok(same(saleBefore, gemTotals(S())), '出售装备造成宝石总量变化');

    st = resetLogic();
    for (const sl of XG.SLOTS) st.equip[sl.id] = makeEq('equipped-' + sl.id, sl.id, 1, 1e9, null);
    for (let i = 0; i < XG.BAG_LIMIT; i++) st.equipBag.push(makeEq('bag-' + i, 'weapon', 1, 1000 + i, null));
    st.equipBag.push(makeEq('overflow-gem', 'weapon', 1, 1, gem));
    const overflowBefore = gemTotals(st);
    XG.Economy.pickupEquip(makeEq('overflow-incoming', 'weapon', 1, 500, null));
    ok(st.equipBag.length === XG.BAG_LIMIT, '背包溢出后未保持容量上限');
    ok(same(overflowBefore, gemTotals(S())), '背包溢出造成宝石总量变化');
  });

  check('采药保底与耗尽池计数', () => {
    let st = resetLogic();
    const first = withRandom(0, () => {
      const out = [];
      for (let i = 0; i < 9; i++) out.push(XG.Gacha.pull('mat', 1));
      return out;
    });
    ok(first.every(x => x.ok), '采药前九抽未完成');
    const tenth = XG.Gacha.pull('mat', 1);
    const hit = tenth.ok && tenth.out[0];
    ok(hit && hit.type === 'gem' && hit.pityHit === true && hit.guaranteed === true, '采药第 10 抽未真实触发保底');
    ok(S().gacha.pity.mat === 0, '采药保底后计数未重置');
    ok(S().gacha.total.mat === 10, '采药保底后总抽数错误');

    st = resetLogic();
    st.arts = Object.fromEntries(XG.ARTS.map(x => [x.id, { lv: 1 }]));
    st.gacha.pity.art = 9;
    const exhausted = XG.Gacha.pull('art', 1);
    ok(exhausted.ok && exhausted.out[0].type === 'stone', '耗尽功法池未转为灵石');
    ok(exhausted.out[0].pityHit === false && S().gacha.pity.art === 10, '耗尽功法池误重置保底');

    st = resetLogic();
    st.pets.owned = XG.PETS.map(x => x.id);
    st.pets.data = Object.fromEntries(st.pets.owned.map(id => [id, { lv: 1 }]));
    st.gacha.pity.pet = 14;
    const petExhausted = XG.Gacha.pull('pet', 1);
    ok(petExhausted.ok && petExhausted.out[0].type === 'gem', '耗尽灵宠池未转为宝石');
    ok(petExhausted.out[0].pityHit === false && S().gacha.pity.pet === 15, '耗尽灵宠池误重置保底');
  });

  check('在线离线突破副作用与零收益服丹', () => {
    const oldRate = XG.CONFIG.BASE_SPIRIT_RATE;
    const oldRandom = sandbox.__testRandom;
    XG.CONFIG.BASE_SPIRIT_RATE = 0.0001;
    try {
      let st = resetLogic();
      st.realm = 0;
      st.layer = 8;
      st.spirit = XG.State.Calc.need();
      st.settings.autoBreak = true;
      st.meta.lastSeen = sandbox.Date.now() - 61000;
      setSandboxRandom(() => 0);
      const online = XG.Cult.attemptBreak(false);
      const onlineState = breakSnapshot(S());
      const onlineSpirit = S().spirit;
      st = resetLogic();
      st.realm = 0;
      st.layer = 8;
      st.spirit = XG.State.Calc.need();
      st.settings.autoBreak = true;
      st.meta.lastSeen = sandbox.Date.now() - 61000;
      const report = XG.Cult.applyOffline();
      const offlineState = breakSnapshot(S());
      ok(online.ok && report && report.breaks === 1, '在线或离线突破未成功一次');
      ok(onlineState.realm === offlineState.realm && onlineState.layer === offlineState.layer, '在线离线突破境界副作用不一致');
      ok(onlineState.breakthroughs === offlineState.breakthroughs && onlineState.failed === offlineState.failed, '在线离线突破统计副作用不一致');
      ok(onlineState.stone === offlineState.stone && onlineState.herb === offlineState.herb && onlineState.jade === offlineState.jade, '在线离线突破资源副作用不一致');
      ok(Math.abs(onlineSpirit - S().spirit) < 0.01, '在线离线突破灵气副作用差异过大');
    } finally {
      setSandboxRandom(oldRandom);
      XG.CONFIG.BASE_SPIRIT_RATE = oldRate;
    }

    let st = resetLogic();
    st.spirit = XG.State.Calc.need();
    st.pills.p_juqi = 1;
    st.settings.autoPill = true;
    const used = st.stats.pillsUsed;
    XG.Cult.autoUsePill(XG.State.Calc.need(), XG.State.Calc.spiritRate());
    ok(st.pills.p_juqi === 1 && st.stats.pillsUsed === used, '满灵气时自动服丹零收益仍消耗');

    st = resetLogic();
    st.spirit = XG.State.Calc.need() * 0.8;
    st.pills.p_juqi = 1;
    const def = XG.idx.pill.p_juqi;
    const oldEffect = def.effect;
    def.effect = () => 0;
    try {
      XG.Cult.autoUsePill(XG.State.Calc.need(), XG.State.Calc.spiritRate());
      ok(st.pills.p_juqi === 1, '自动服丹零收益仍消耗聚气丹');
    } finally {
      def.effect = oldEffect;
    }
  });

  check('损坏存档与冲突保护', () => {
    resetLogic();
    const raw = '{broken-json';
    store[XG.State.SAVE_KEY] = raw;
    const bad = muted(() => XG.State.Save.load());
    ok(bad.status === 'error' && bad.raw === raw, '损坏存档未返回 error 状态');
    ok(bad.backupKey && store[bad.backupKey] === raw, '损坏存档未建立原样备份');
    ok(store[XG.State.SAVE_KEY] === raw, '损坏存档覆盖了原数据');
    ok(XG.State.Save.isLocked(), '损坏存档后未锁定写入');

    resetLogic();
    const absent = XG.State.Save.load();
    ok(absent.status === 'absent' && absent.raw === null, '空存档未返回 absent 状态');

    resetLogic();
    const st = S();
    st.res.stone = 123;
    ok(XG.State.Save.save(true), '冲突保护准备存档失败');
    const external = JSON.stringify(Object.assign(XG.State.fresh(), { res: { stone: 999, herb: 0, jade: 0 } }));
    store[XG.State.SAVE_KEY] = external;
    const conflict = muted(() => XG.State.Save.save(true));
    const data = XG.State.Save.conflict;
    ok(conflict === false && XG.State.Save.hasConflict(), '外部更新未被冲突保护拦截');
    ok(store[XG.State.SAVE_KEY] === external, '冲突保护覆盖了外部存档');
    ok(data && data.externalRaw === external && data.snapshotKey && store[data.snapshotKey] === data.localRaw, '冲突快照不完整');
    ok(XG.State.Save.isLocked(), '冲突保护后未锁定写入');
  });

  check('探索状态与战斗结果释放恢复', () => {
    resetLogic();
    XG.Bus.off('battle:end', closeBattleOnEnd);
    const oldDelay = XG.CONFIG.AUTO_RESULT_DELAY;
    XG.CONFIG.AUTO_RESULT_DELAY = 999;
    try {
      XG.Combat.setExploring(true);
      XG.Combat.setExploring(true);
      ok(S().explore.running === true, '探索 setter 未建立单一运行状态');
      const enemy = XG.Combat.makeEnemy(0, 1, { name: '回归妖兽' });
      const started = XG.Combat.startBattle(XG.State.Calc.playerStats(), {
        kind: 'test', enemy, explore: true, auto: false,
      });
      ok(started === true && !!XG.Combat.active, '探索战斗未建立');
      ok(S().explore.running === true, '探索战斗期间丢失运行意图');
      const battle = XG.Combat.active;
      battle.e.hp = 0;
      XG.Combat.endBattle();
      ok(XG.Combat.active === null && XG.Combat.last === battle, '战斗结算后 active 未释放或 last 缺失');
      ok(XG.Combat.last && typeof XG.Combat.last.result.win === 'boolean', '战斗结果未保存到 last');
      const progress = S().explore.progress;
      XG.Combat.tickExplore(100);
      ok(S().explore.progress === progress, '战斗结果待关闭时探索仍在推进');
      ok(XG.Combat.closeResult() === true && XG.Combat.last === null, 'closeResult 未释放结果');
      ok(S().explore.running === true, '关闭探索战斗结果后未自动恢复');
    } finally {
      XG.CONFIG.AUTO_RESULT_DELAY = oldDelay;
      XG.Bus.on('battle:end', closeBattleOnEnd);
      XG.Combat.setExploring(false);
      if (XG.Combat.active) {
        XG.Combat.active.p.hp = 0;
        XG.Combat.endBattle();
      }
      if (XG.Combat.last) XG.Combat.closeResult();
    }
  });
}

console.log('\n== 断言结果 ==');
if (fails.length) {
  for (const f of fails) console.log('  ✗ ' + f);
  process.exit(1);
} else {
  console.log('  ✓ 全部通过');
}

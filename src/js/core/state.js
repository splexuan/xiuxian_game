/* ═══════════════════════════════════════════
   state.js — 游戏状态 / 属性计算 / 存档
   ═══════════════════════════════════════════ */
(function () {
  'use strict';
  const XG = window.XG;
  const U = XG.U;
  const R = XG.R;

  const SAVE_KEY = 'xiantu_save_v1';
  const SAVE_VERSION = 1;

  /* ══════ 历史存档兼容映射 ══════
     旧版本「金刚伏魔拳」的 id 里误含空格（'a_jin Gang'），
     会污染存档键名，也会出现在 HTML 的 data-art 属性里。
     已修正为 'a_jingang'，读档时按此表做一次性改名。 */
  const ART_ID_ALIAS = { 'a_jin Gang': 'a_jingang' };

  /* 道途任务链的**旧数组顺序**（2026-09 版之前）。
     旧档的 quest.idx 是这份顺序里的下标，而现在指针改为任务 id，
     所以读档时要用这张表把旧下标翻译回 id。
     之所以要把顺序固化下来：同一次改动里「斩妖万头(q30)」已被移出任务链，
     若直接用现在的数组去解释旧下标，卡在 q30 的玩家会莫名跳到别的任务。 */
  const LEGACY_QUEST_ORDER = [
    'q01', 'q02', 'q03', 'q04', 'q05', 'q06', 'q07', 'q08', 'q09',
    'q10', 'q11', 'q12', 'q13', 'q14', 'q15', 'q16', 'q17', 'q18',
    'q19', 'q20', 'q21', 'q22', 'q23', 'q24', 'q25', 'q26', 'q27',
    'q28', 'q29', 'q30', 'q31', 'q32', 'q33', 'q34', 'q35', 'q36',
  ];

  /* ══════ 默认存档 ══════ */
  function createState() {
    return {
      version: SAVE_VERSION,

      realm: 0,
      layer: 1,
      spirit: 0,

      res: { stone: 0, herb: 0, jade: 0 },
      mats: {},
      pills: {},

      buildings: { b_array: 1 },
      arts: { a_yinqi: { lv: 1 } },

      equip: { weapon: null, armor: null, talisman: null, ring: null },
      equipBag: [],
      nextEquipId: 1,

      /* 锻炉：宝石库存 / 强化次数 */
      gems: {},
      enhanceBag: [],

      /* 已装备的神通（3 格） */
      skills: ['sk_lieshi', null, null],

      pets: { owned: [], data: {}, eggs: 0, active: [] },

      buffs: [],
      perm: { spirit: 0, all: 0 },
      permBonus: { spirit: 0, atk: 0, hp: 0, stone: 0, all: 0, break: 0 },

      achievements: {},
      achBonus: { spirit: 0, atk: 0, hp: 0, stoneGain: 0 },

      /* 道途任务链。
         指针存「任务 id」而不是数组下标 —— 后者一旦调整任务顺序就会错位，
         让所有旧档指向错误的任务。 */
      quest: { id: (XG.QUESTS[0] || {}).id || null, claimed: {}, seen: {}, ready: {} },

      /* 寻宝阁保底计数 */
      gacha: { pity: { art: 0, equip: 0, pet: 0, mat: 0 }, total: { art: 0, equip: 0, pet: 0, mat: 0 } },

      /* 天象 */
      omen: { id: null, until: 0, next: 0 },

      /* 战斗偏好 */
      battle: { stance: 'balance', autoSkill: true, autoPill: false },

      /* 抽卡 / 战斗动画队列（仅用于连续展示） */
      lastPulls: [],

      stats: {
        kills: 0, bossKills: 0, breakthroughs: 0, breakthroughsFailed: 0,
        tribulations: 0, pillsMade: 0, pillsUsed: 0, events: 0,
        totalStone: 0, totalSpirit: 0, totalHerb: 0, deaths: 0, playTime: 0,
        meditates: 0, forges: 0, gemForges: 0, enhances: 0, enhanceFails: 0,
        rerolls: 0, gachaPulls: 0, skillsUsed: 0, q3Made: 0, zoneEvents: 0,
        eliteKills: 0, omensSeen: 0, questsDone: 0, sockets: 0,
        towerEver: 0, ascendCount: 0,
      },

      tower: { best: 0, floor: 1, cleared: {} },
      explore: { zone: 0, running: false, progress: 0, wins: 0, losses: 0 },

      prestige: {
        times: 0, earned: 0, spent: 0,
        talents: { wuxing: 0, zhanyi: 0, tipo: 0, caiyun: 0, tianji: 0 },
      },

      settings: { autoBreak: false, autoPill: false, autoExplore: false },

      log: [],
      meta: { createdAt: Date.now(), lastSeen: Date.now(), totalPlayed: 0 },
      flags: {},
    };
  }

  const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER || 9007199254740991;
  const MAX_NUMBER = Number.MAX_VALUE;

  function hasOwn(value, key) {
    return !!value && Object.prototype.hasOwnProperty.call(value, key);
  }

  function isObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function asObject(value, name) {
    if (value === undefined || value === null) return {};
    if (!isObject(value)) throw new TypeError(name + ' must be an object');
    return value;
  }

  function asArray(value, name) {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) throw new TypeError(name + ' must be an array');
    return value;
  }

  function safeNumber(value, fallback, min, max, integer) {
    let n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
    if (integer) n = Math.floor(n);
    if (n < min) n = min;
    if (n > max) n = max;
    return n;
  }

  function safeText(value, fallback, maxLength) {
    if (typeof value !== 'string') return fallback;
    const text = value.trim();
    if (!text) return fallback;
    return text.slice(0, maxLength || 200);
  }

  function petSlotsFor(target) {
    let slots = 1;
    const buildings = target && target.buildings ? target.buildings : {};
    for (const b of XG.BUILDINGS) {
      const lv = safeNumber(buildings[b.id], 0, 0, MAX_SAFE_INTEGER, true);
      if (lv > 0 && b.petSlots) {
        const add = Number(b.petSlots(lv));
        if (Number.isFinite(add)) slots += Math.max(0, Math.floor(add));
      }
    }
    return Math.max(1, Math.min(MAX_SAFE_INTEGER, slots));
  }

  function normalizePets(target) {
    const raw = isObject(target.pets) ? target.pets : {};
    const owned = [];
    const ownedSet = new Set();
    for (const id of asArray(raw.owned, 'pets.owned')) {
      if (typeof id !== 'string' || ownedSet.has(id) || !hasOwn(XG.idx.pet, id)) continue;
      owned.push(id);
      ownedSet.add(id);
    }
    const sourceData = asObject(raw.data, 'pets.data');
    const data = {};
    const maxLv = 20 + safeNumber(target.realm, 0, 0, XG.REALMS.length - 1, true) * 12;
    for (const id of owned) {
      const d = isObject(sourceData[id]) ? sourceData[id] : {};
      const pet = { lv: safeNumber(d.lv, 1, 1, maxLv, true) };
      if (typeof d.bornAt === 'number' && Number.isFinite(d.bornAt) && d.bornAt > 0) {
        pet.bornAt = safeNumber(d.bornAt, Date.now(), 1, MAX_SAFE_INTEGER, true);
      }
      data[id] = pet;
    }
    const active = [];
    const activeSet = new Set();
    const sourceActive = Array.isArray(raw.active) ? raw.active : owned;
    for (const id of sourceActive) {
      if (!ownedSet.has(id) || activeSet.has(id)) continue;
      active.push(id);
      activeSet.add(id);
      if (active.length >= petSlotsFor(target)) break;
    }
    target.pets = {
      owned,
      data,
      eggs: safeNumber(raw.eggs, 0, 0, MAX_NUMBER, true),
      active,
    };
    return target;
  }

  /* ══════ 仙缘天赋定义 ══════ */
  const TALENTS = [
    { id: 'wuxing', name: '悟性', icon: '🧠', desc: '灵气/秒 +10% / 级', per: 0.10, max: 50 },
    { id: 'zhanyi', name: '战意', icon: '⚔', desc: '攻击 +8% / 级', per: 0.08, max: 50 },
    { id: 'tipo', name: '体魄', icon: '🛡', desc: '气血与防御 +8% / 级', per: 0.08, max: 50 },
    { id: 'caiyun', name: '财运', icon: '💰', desc: '灵石获取 +15% / 级', per: 0.15, max: 50 },
    { id: 'tianji', name: '天机', icon: '🌌', desc: '突破成功率 +1% / 级', per: 0.01, max: 15 },
  ];
  XG.TALENTS = TALENTS;

  let state = createState();

  /* ═════════════════════════════════════════
     属性与乘区计算
     ═════════════════════════════════════════ */
  const Calc = {
    /* 洞天建筑等级 */
    bLv(id) { return state.buildings[id] || 0; },

    /* 所有建筑的效果。
       注意：同属「灵气」或「气血」的建筑采用【加算】而非累乘，
       避免多个线性项相乘产生超指数膨胀。 */
    buildingMults() {
      const out = {
        spirit: 1, hp: 1, def: 1, herbRate: 0, artCostCut: 0, artLvBonus: 0,
        pillPower: 1, pillSuccess: 0, equipPower: 1, stoneGain: 1,
        petSlots: 0, petPower: 1, breakBonus: 0, jadeRate: 0,
      };
      let spAdd = 0, hpAdd = 0, defAdd = 0;
      for (const b of XG.BUILDINGS) {
        const lv = state.buildings[b.id] || 0;
        if (lv <= 0) continue;
        if (b.id === 'b_array') spAdd += 0.30 * lv;
        if (b.id === 'b_spring') spAdd += 0.45 * lv;
        if (b.id === 'b_tiandao') spAdd += 0.60 * lv;
        if (b.id === 'b_farm') {
          const farmRate = Number(XG.CONFIG.HERB_FROM_FARM);
          out.herbRate += (Number.isFinite(farmRate) ? farmRate : 0.35) * lv;
        } else if (b.herbRate) out.herbRate += b.herbRate(lv);
        if (b.artCostCut) out.artCostCut = Math.max(out.artCostCut, b.artCostCut(lv));
        if (b.artLvBonus) out.artLvBonus += b.artLvBonus(lv);
        if (b.pillPower) out.pillPower *= b.pillPower(lv);
        if (b.pillSuccess) out.pillSuccess += b.pillSuccess(lv);
        if (b.equipPower) out.equipPower *= b.equipPower(lv);
        if (b.stoneGain) out.stoneGain *= b.stoneGain(lv);
        if (b.petSlots) out.petSlots += b.petSlots(lv);
        if (b.petPower) out.petPower *= b.petPower(lv);
        if (b.breakBonus) out.breakBonus += b.breakBonus(lv);
        if (b.jadeRate) out.jadeRate += b.jadeRate(lv);
        if (b.hpMult) hpAdd += 0.10 * lv;
        if (b.defMult) defAdd += 0.15 * lv;
        if (b.id === 'b_spring') hpAdd += 0.15 * lv;
      }
      out.spirit = 1 + spAdd;
      out.hp = 1 + hpAdd;
      out.def = 1 + defAdd;
      return out;
    },

    /* 所有已解锁功法的原始加总（按类型） */
    artTotals() {
      const t = { mind: 0, atk: 0, body: 0, agile: 0 };
      for (const a of XG.ARTS) {
        const d = state.arts[a.id];
        if (!d || !d.lv) continue;
        t[a.type] += a.eff * d.lv;
      }
      return t;
    },

    /* 功法 / 灵宠聚合加成：原始总和经收益递减后返回总倍率。
       指数 0.7 使持续堆叠依然强力，但不至于指数爆炸。 */
    ART_EXP: 0.70,
    artMult(raw) {
      if (raw <= 0) return 1;
      return 1 + Math.pow(raw, Calc.ART_EXP);
    },
    petMult(raw) {
      if (raw <= 0) return 1;
      return 1 + Math.pow(raw, 0.70);
    },

    /* 单件装备的最终属性（含强化与宝石） */
    eqStats(e) {
      const out = {};
      const mul = XG.FORGE_CFG.enhanceStatMul(e.enh || 0);
      for (const k in (e.stats || {})) out[k] = e.stats[k] * mul;
      for (const g of (e.sockets || [])) {
        if (!g) continue;
        const def = XG.idx.gem[g.id];
        if (!def) continue;
        const v = def.val * Math.pow(XG.GEM_TIER_MULT, (g.tier || 1) - 1);
        out[def.stat] = (out[def.stat] || 0) + v;
      }
      return out;
    },

    /* 装备属性加总（含强化与宝石） */
    equipTotals() {
      const t = { atk: 0, def: 0, hp: 0, crit: 0, critDmg: 0, dodge: 0, spd: 0, lifesteal: 0, pen: 0, spirit: 0 };
      for (const sl of XG.SLOTS) {
        const e = state.equip[sl.id];
        if (!e) continue;
        const st = Calc.eqStats(e);
        for (const k in st) t[k] = (t[k] || 0) + st[k];
      }
      return t;
    },

    /* 套装共鸣加成 */
    setBonuses() {
      const cnt = {};
      for (const sl of XG.SLOTS) {
        const e = state.equip[sl.id];
        if (e && e.set) cnt[e.set] = (cnt[e.set] || 0) + 1;
      }
      const out = {};
      for (const id in cnt) {
        const def = XG.SETS[id];
        if (!def) continue;
        for (const need of [2, 4]) {
          if (cnt[id] >= need && def[need]) {
            for (const k in def[need]) out[k] = (out[k] || 0) + def[need][k];
          }
        }
      }
      return out;
    },

    /* 当前生效的套装（用于 UI 展示） */
    activeSets() {
      const cnt = {};
      for (const sl of XG.SLOTS) {
        const e = state.equip[sl.id];
        if (e && e.set) cnt[e.set] = (cnt[e.set] || 0) + 1;
      }
      return Object.keys(cnt).map(id => ({ id, def: XG.SETS[id], count: cnt[id] })).filter(x => x.def);
    },

    /* 当前天象加成 */
    omenMods() {
      const o = state.omen;
      if (!o || !o.id) return {};
      if (o.until && o.until <= Date.now()) return {};
      const def = XG.OMENS.find(x => x.id === o.id);
      return def ? def.mods : {};
    },
    omenDef() {
      const o = state.omen;
      if (!o || !o.id || (o.until && o.until <= Date.now())) return null;
      return XG.OMENS.find(x => x.id === o.id) || null;
    },
    weatherMods() {
      return isObject(state.weather) ? state.weather : {};
    },

    /* 激活中的灵宠加成 */
    petTotals() {
      const t = { atk: 0, def: 0, hp: 0, crit: 0, critDmg: 0, dodge: 0, spd: 0, lifesteal: 0, pen: 0, spirit: 0, stoneGain: 0, herbGain: 0 };
      const bm = Calc.buildingMults();
      const pm = bm.petPower;
      const slots = 1 + bm.petSlots;
      const owned = new Set(Array.isArray(state.pets.owned) ? state.pets.owned : []);
      const petData = state.pets.data && typeof state.pets.data === 'object' ? state.pets.data : {};
      const current = Array.isArray(state.pets.active) ? state.pets.active : [];
      const seen = new Set();
      const active = [];
      for (const id of current) {
        if (!owned.has(id) || seen.has(id) || !petData[id]) continue;
        active.push(id);
        seen.add(id);
        if (active.length >= slots) break;
      }
      if (active.length !== current.length || active.some((id, i) => id !== current[i])) {
        state.pets.active = active;
      }
      for (const pid of active) {
        const pd = petData[pid];
        const def = Object.prototype.hasOwnProperty.call(XG.idx.pet, pid) ? XG.idx.pet[pid] : null;
        if (!pd || !def) continue;
        const lv = pd.lv || 1;
        for (const k in def.bonus) t[k] = (t[k] || 0) + def.bonus[k] * lv * pm;
      }
      return t;
    },

    /* 当前生效的丹药 Buff */
    buffTotals() {
      const now = Date.now();
      const t = { spirit: 1, atk: 1, hp: 1, def: 1, breakBonus: 0 };
      for (const b of state.buffs) {
        if (b.until <= now) continue;
        if (b.spiritMult) t.spirit *= b.spiritMult;
        if (b.stat) {
          if (b.stat.atk) t.atk *= 1 + b.stat.atk;
          if (b.stat.hp) t.hp *= 1 + b.stat.hp;
          if (b.stat.def) t.def *= 1 + b.stat.def;
        }
        if (b.breakBonus) t.breakBonus += b.breakBonus;
      }
      return t;
    },

    /* 仙缘天赋。
       对缺失/非数值的键统一回退为 0——否则 undefined * n = NaN，
       会顺着乘法污染 mods() 的整条乘区（灵气、攻击、气血全部变成 NaN）。 */
    talentTotals() {
      const tl = (state.prestige && state.prestige.talents) || {};
      const n = id => {
        const v = tl[id];
        return typeof v === 'number' && Number.isFinite(v) ? v : 0;
      };
      return {
        spirit: 1 + n('wuxing') * 0.10,
        atk: 1 + n('zhanyi') * 0.08,
        hp: 1 + n('tipo') * 0.08,
        def: 1 + n('tipo') * 0.08,
        stoneGain: 1 + n('caiyun') * 0.15,
        breakBonus: n('tianji') * 0.01,
      };
    },

    /* 永久丹药加成（收益递减曲线） */
    permTotals() {
      return {
        spirit: Calc.permRate(state.perm.spirit, 0.05),
        all: Calc.permRate(state.perm.all, 0.08),
      };
    },

    /* 永久丹药加成：收益递减且设有上限，防止无限堆叠 */
    PERM_CAP: 800,
    permRate: function (n, per) {
      if (n <= 0) return 1;
      const k = Math.min(n, Calc.PERM_CAP);
      return 1 + per * Math.pow(k, 0.72);
    },

    /* ════ 最终乘区 ════ */
    mods() {
      const bm = Calc.buildingMults();
      const at = Calc.artTotals();
      const et = Calc.equipTotals();
      const pt = Calc.petTotals();
      const bt = Calc.buffTotals();
      const tt = Calc.talentTotals();
      const pmt = {
        spirit: Calc.permRate(state.perm.spirit, 0.05),
        all: Calc.permRate(state.perm.all, 0.08),
      };
      const ab = state.achBonus;
      const pr = state.prestige;

      /* 仙缘基础加成（累计仙缘点越多，全属性越高）。
         必须走收益递减，不能用线性：境界需求是固定的，
         若加成随 earned 无限线性增长，转生若干次后单局时长会塌缩，
         13 重境界的内容会被一路秒穿。
         permRate = 1 + per * min(n,PERM_CAP)^0.72，天然收敛且有上限。 */
      const prSpirit = Calc.permRate(pr.earned, 0.07);
      const prAtk = Calc.permRate(pr.earned, 0.06);
      const prHp = Calc.permRate(pr.earned, 0.06);

      const eqp = bm.equipPower;

      const m = {};

      const aMind = Calc.artMult(at.mind);
      const aAtk = Calc.artMult(at.atk);
      const aBody = Calc.artMult(at.body);
      const aAgile = Calc.artMult(at.agile);
      const pSpirit = Calc.petMult(pt.spirit);
      const pAtk = Calc.petMult(pt.atk);
      const pHp = Calc.petMult(pt.hp);
      const pDef = Calc.petMult(pt.def);

      /* 套装共鸣 + 天象 */
      const sb = Calc.setBonuses();
      const om = Calc.omenMods();
      const wm = Calc.weatherMods();
      const allBonus = 1 + (state.permBonus.all || 0);

      /* 灵气/秒 乘数 */
      m.spirit = R.mult(state.realm)
        * bm.spirit
        * aMind
        * (1 + et.spirit * eqp)
        * pSpirit
        * bt.spirit
        * tt.spirit
        * pmt.spirit * pmt.all
        * (1 + (ab.spirit || 0))
        * (1 + (state.permBonus.spirit || 0))
        * (1 + (sb.spirit || 0))
        * prSpirit
        * (om.spirit || 1)
        * allBonus;

      /* 攻击 */
      m.atk = aAtk
        * (1 + et.atk * eqp)
        * pAtk
        * bt.atk
        * tt.atk
        * pmt.all
        * (1 + (ab.atk || 0))
        * (1 + (sb.atk || 0))
        * prAtk
        * (om.atk || 1)
        * allBonus;

      /* 气血 */
      m.hp = bm.hp * aBody
        * (1 + et.hp * eqp)
        * pHp
        * bt.hp
        * tt.hp
        * pmt.all
        * (1 + (ab.hp || 0))
        * (1 + (sb.hp || 0))
        * prHp
        * allBonus;

      /* 防御（由护体功法 + 装备 + 建筑决定） */
      m.def = bm.def * aBody
        * (1 + et.def * eqp)
        * pDef
        * bt.def
        * tt.def
        * pmt.all
        * (1 + (sb.def || 0))
        * allBonus;

      /* 战斗次级属性 */
      m.crit = U.clamp(0.05 + et.crit * eqp + pt.crit + at.agile * 0.06 + (sb.crit || 0), 0, 0.92);
      m.critDmg = 0.55 + et.critDmg * eqp + pt.critDmg + (sb.critDmg || 0);
      m.dodge = U.clamp(0.02 + et.dodge * eqp + pt.dodge + at.agile * 0.05 + (sb.dodge || 0), 0, 0.72);
      m.spd = (1 + et.spd * eqp + pt.spd + at.agile * 0.08 + (sb.spd || 0)) * 1.0;
      m.lifesteal = U.clamp(et.lifesteal * eqp + pt.lifesteal + (sb.lifesteal || 0), 0, 0.55);
      m.pen = U.clamp(et.pen * eqp + pt.pen + (sb.pen || 0), 0, 0.80);

      /* 资源 */
      m.stoneGain = bm.stoneGain * (1 + (pt.stoneGain || 0)) * tt.stoneGain
        * (1 + (ab.stoneGain || 0)) * (1 + (state.permBonus.stone || 0)) * (om.stoneGain || 1);
      m.herbGain = bm.herbRate > 0 ? bm.herbRate * (1 + (pt.herbGain || 0)) : 0;
      m.jadeRate = bm.jadeRate * (om.jadeRate || 1);

      /* 其它 */
      m.breakBonus = bm.breakBonus + bt.breakBonus + tt.breakBonus + (state.permBonus.break || 0) + (om.breakBonus || 0) + safeNumber(wm.breakBonus, 0, -1, 1, false);
      m.artCostCut = bm.artCostCut;
      m.artLvBonus = bm.artLvBonus;
      m.pillPower = bm.pillPower;
      m.pillSuccess = bm.pillSuccess;
      m.equipPower = bm.equipPower;
      m.petSlots = 1 + bm.petSlots;
      m.petPower = bm.petPower;
      m.dropRate = om.dropRate || 1;
      m.enemyPower = om.enemyPower || 1;

      return m;
    },

    /* 战力评估（双方通用） */
    power(st) {
      const off = st.atk * (1 + st.crit * (1 + st.critDmg)) * (1 + st.lifesteal) * (1 + st.pen * 0.6);
      const def = st.hp * 0.55 + st.def * 1.4;
      /* 速度的实际收益只有两项：先手判定 + 灵力回复加成（后者上限 1.8 倍，见
         Combat.SPD_ENERGY_MAX），因此这里必须同样封顶。
         从前写的是 (1 + (spd-1)*0.35) 无上限，导致堆速度能把战力虚抬到
         与实际战斗力完全脱节 —— 玩家看到战力高，打起来却没差别。 */
      const spdFactor = 1 + U.clamp((Number(st.spd) || 1) - 1, 0, 0.8) * 0.25;
      return (off + def) * (1 + st.dodge * 0.8) * spdFactor;
    },

    /* ════ 玩家战斗属性 ════ */
    playerStats() {
      const m = Calc.mods();
      const rb = XG.REALMS[state.realm];
      const atk = rb.atkBase * m.atk;
      const hp = rb.hpBase * m.hp;
      const def = rb.atkBase * 0.62 * m.def;
      return {
        name: R.name(state.realm, state.layer),
        atk, hp, maxHp: hp, def,
        crit: m.crit, critDmg: m.critDmg, dodge: m.dodge,
        spd: m.spd, lifesteal: m.lifesteal, pen: m.pen,
        skills: state.skills.filter(Boolean),
        maxEnergy: 100,
        stance: state.battle.stance || 'balance',
        dmgTaken: 1,
      };
    },

    /* 灵气/秒 */
    spiritRate() {
      const m = Calc.mods();
      return XG.CONFIG.BASE_SPIRIT_RATE * m.spirit;
    },

    /* 当前层需求 / 进度 */
    need() { return R.need(state.realm, state.layer); },
    remain() { return Math.max(0, R.need(state.realm, state.layer) - state.spirit); },
    needSeconds() {
      const r = Calc.spiritRate();
      if (r <= 0) return Infinity;
      return Calc.remain() / r;
    },

    /* 突破成功率 */
    breakChance() {
      const bm = Calc.buildingMults();
      const bt = Calc.buffTotals();
      const tt = Calc.talentTotals();
      const om = Calc.omenMods();
      const wm = Calc.weatherMods();
      let c = R.breakChance(state.realm, state.layer);
      c += bm.breakBonus + bt.breakBonus + tt.breakBonus + (state.permBonus.break || 0)
        + safeNumber(om.breakBonus, 0, -1, 1, false) + safeNumber(wm.breakBonus, 0, -1, 1, false);
      if (R.isRealmTop(state.layer)) c -= 0.18;
      return U.clamp(c, 0.05, 0.99);
    },

    /* 随境界平滑增长的造价系数（飞升后回落，故重建轻快） */
    costMult() {
      const lvl = state.realm * XG.CONFIG.LAYERS_PER_REALM + (state.layer - 1);
      return Math.pow(XG.CONFIG.REALM_COST_MULT, lvl / XG.CONFIG.LAYERS_PER_REALM);
    },

    /* 功法等级上限（藏经阁加成有上限，避免无限堆叠） */
    artMaxLv() {
      return Math.floor(18 + state.realm * 6 + Math.min(30, Calc.buildingMults().artLvBonus * 0.5));
    },

    /* 功法升级消耗 */
    artCost(art) {
      const d = state.arts[art.id];
      const lv = d ? d.lv : 0;
      const cut = 1 - Calc.buildingMults().artCostCut;
      return Math.ceil(art.costBase * Math.pow(1.235, lv) * cut * Calc.costMult());
    },

    /* 建筑升级消耗 */
    buildCost(b) {
      const lv = state.buildings[b.id] || 0;
      return Math.ceil(b.costBase * Math.pow(b.costGrow, lv) * Calc.costMult());
    },

    /* 飞升可得仙缘点（各项均收敛，避免无限膨胀） */
    ascendGain() {
      if (state.realm < XG.CONFIG.ASCEND_MIN_REALM) return 0;
      const lvl = R.totalLevel(state.realm, state.layer);
      const a = Math.pow(lvl / 9, 1.18);                                     // 境界贡献
      const b = Math.min(26, Math.log10(1 + state.tower.best) * 9);          // 塔层贡献（对数收敛）
      const c = Object.keys(state.achievements).length / 9;                  // 道果贡献
      return Math.max(1, Math.floor(a + b + c));
    },
  };

  /* ═════════════════════════════════════════
     资源操作
     ═════════════════════════════════════════ */
  const Res = {
    gainStone(n, silent) {
      n = Math.floor(n);
      if (n <= 0) return 0;
      state.res.stone += n;
      state.stats.totalStone += n;
      if (!silent) XG.Bus.emit('res:stone', n);
      return n;
    },
    spendStone(n) {
      if (state.res.stone < n) return false;
      state.res.stone -= n; return true;
    },
    gainHerb(n, silent) {
      n = Math.floor(n);
      if (n <= 0) return 0;
      state.res.herb += n; state.stats.totalHerb += n;
      if (!silent) XG.Bus.emit('res:herb', n);
      return n;
    },
    gainJade(n, silent) {
      n = Math.floor(n);
      if (n <= 0) return 0;
      state.res.jade += n;
      if (!silent) XG.Bus.emit('res:jade', n);
      return n;
    },
    spendJade(n) { if (state.res.jade < n) return false; state.res.jade -= n; return true; },
    gainMat(id, n) { state.mats[id] = (state.mats[id] || 0) + n; },
    gainGem(id, tier, n) {
      const k = id + '_' + (tier || 1);
      state.gems[k] = (state.gems[k] || 0) + (n || 1);
    },
    useGem(id, tier, n) {
      const k = id + '_' + (tier || 1);
      if ((state.gems[k] || 0) < (n || 1)) return false;
      state.gems[k] -= (n || 1);
      if (state.gems[k] <= 0) delete state.gems[k];
      return true;
    },
    useMat(id, n) {
      if ((state.mats[id] || 0) < n) return false;
      state.mats[id] -= n;
      if (state.mats[id] <= 0) delete state.mats[id];
      return true;
    },
    gainPill(id, n) { state.pills[id] = (state.pills[id] || 0) + n; },
    usePill(id, n) {
      n = n || 1;
      if ((state.pills[id] || 0) < n) return false;
      state.pills[id] -= n;
      if (state.pills[id] <= 0) delete state.pills[id];
      return true;
    },
  };

  /* ═════════════════════════════════════════
     存档
     ═════════════════════════════════════════ */
  const Save = {
    _ls: null,
    _knownRaw: null,
    _snapshotSeq: 0,
    conflict: null,
    storage() {
      if (Save._ls !== null) return Save._ls;
      try {
        const ls = window.localStorage;
        const probe = '__xt_probe__';
        ls.setItem(probe, '1'); ls.removeItem(probe);
        Save._ls = ls;
      } catch (e) {
        console.warn('[save] localStorage 不可用，本次运行不会保存进度：', e && e.name);
        Save._ls = false;
      }
      return Save._ls;
    },

    backupRaw(raw, error) {
      let backupKey = null;
      let backupError = null;
      const ls = Save.storage();
      try {
        if (ls) {
          do {
            backupKey = SAVE_KEY + '.backup.' + Date.now() + '.' + (Save._snapshotSeq++);
          } while (ls.getItem(backupKey) !== null);
          ls.setItem(backupKey, raw);
        }
      } catch (e) {
        backupError = e;
      }
      Save.lock();
      console.error('[load] 存档损坏或迁移失败，原存档未改动', error);
      return { status: 'error', raw, error, backupKey, backupError };
    },

    preserveConflict(externalRaw, reason, error) {
      if (Save.conflict) return Save.conflict;
      let localRaw = null;
      let snapshotKey = null;
      let snapshotError = null;
      const ls = Save.storage();
      try { localRaw = JSON.stringify(state); } catch (e) { snapshotError = e; }
      try {
        if (ls && localRaw !== null) {
          do {
            snapshotKey = SAVE_KEY + '.conflict.' + Date.now() + '.' + (Save._snapshotSeq++);
          } while (ls.getItem(snapshotKey) !== null);
          ls.setItem(snapshotKey, localRaw);
        }
      } catch (e) {
        snapshotError = e;
      }
      const conflict = {
        reason: reason || 'external-update',
        detectedAt: Date.now(),
        localRaw,
        externalRaw: externalRaw === undefined ? null : externalRaw,
        snapshotKey,
        snapshotError,
        error: error || null,
      };
      Save.conflict = conflict;
      Save.lock();
      console.warn('[save] 检测到其它标签页更新，已阻止陈旧存档覆盖', conflict);
      XG.Bus.emit('save:conflict', conflict);
      return conflict;
    },

    save(silent) {
      if (Save._locked || Save.conflict) return false;
      const ls = Save.storage();
      if (!ls) return false;
      let raw;
      try {
        state.meta.lastSeen = Date.now();
        state.meta.totalPlayed = state.meta.totalPlayed || 0;
        raw = JSON.stringify(state);
        const stored = ls.getItem(SAVE_KEY);
        if (stored !== Save._knownRaw) {
          const conflict = Save.preserveConflict(stored, 'external-update');
          const error = new Error('save conflict');
          error.conflict = conflict;
          XG.Bus.emit('save:fail', error);
          return false;
        }
        ls.setItem(SAVE_KEY, raw);
        const confirmed = ls.getItem(SAVE_KEY);
        if (confirmed !== raw) {
          const conflict = Save.preserveConflict(confirmed, 'external-update');
          const error = new Error('save conflict');
          error.conflict = conflict;
          XG.Bus.emit('save:fail', error);
          return false;
        }
        Save._knownRaw = raw;
        if (!silent) XG.Bus.emit('save:ok');
        return true;
      } catch (e) {
        console.error('[save]', e);
        XG.Bus.emit('save:fail', e);
        return false;
      }
    },
    load() {
      const ls = Save.storage();
      if (!ls) {
        const error = new Error('localStorage unavailable');
        return { status: 'error', raw: null, error };
      }
      let raw;
      try {
        raw = ls.getItem(SAVE_KEY);
      } catch (e) {
        console.error('[load]', e);
        return { status: 'error', error: e };
      }
      if (raw === null || raw === undefined) {
        Save._knownRaw = null;
        Save.conflict = null;
        return { status: 'absent', raw: null };
      }
      try {
        const migrated = Save.migrate(JSON.parse(raw));
        Save._knownRaw = raw;
        Save.conflict = null;
        return { status: 'ok', state: migrated, raw };
      } catch (e) {
        return Save.backupRaw(raw, e);
      }
    },
    migrate(data) {
      if (!isObject(data)) throw new TypeError('invalid save root');
      if (!hasOwn(data, 'version')) throw new RangeError('missing save version');
      const version = data.version;
      if (typeof version !== 'number' || !Number.isInteger(version) || version < 1 || version > SAVE_VERSION) {
        throw new RangeError('unsupported save version: ' + String(data.version));
      }
      const now = Date.now();
      const defaults = createState();
      const merged = createState();
      const countMap = (value, index, name) => {
        const raw = asObject(value, name);
        const out = {};
        for (const id of Object.keys(raw)) {
          if (!hasOwn(index, id)) continue;
          const count = safeNumber(raw[id], 0, 0, MAX_NUMBER, true);
          if (count > 0) out[id] = count;
        }
        return out;
      };

      merged.realm = safeNumber(data.realm, 0, 0, XG.REALMS.length - 1, true);
      merged.layer = safeNumber(data.layer, 1, 1, XG.CONFIG.LAYERS_PER_REALM, true);
      merged.spirit = Math.min(
        XG.R.need(merged.realm, merged.layer),
        safeNumber(data.spirit, 0, 0, Number.MAX_VALUE, false)
      );

      const res = asObject(data.res, 'res');
      merged.res = {
        stone: safeNumber(res.stone, 0, 0, MAX_NUMBER, true),
        herb: safeNumber(res.herb, 0, 0, MAX_NUMBER, true),
        jade: safeNumber(res.jade, 0, 0, MAX_NUMBER, true),
      };
      merged.mats = countMap(data.mats, XG.idx.mat, 'mats');
      merged.pills = countMap(data.pills, XG.idx.pill, 'pills');

      const buildingRaw = asObject(data.buildings, 'buildings');
      merged.buildings = {};
      for (const b of XG.BUILDINGS) {
        const min = b.id === 'b_array' ? 1 : 0;
        const lv = safeNumber(buildingRaw[b.id], min, min, 1e9, true);
        if (lv > 0 || hasOwn(buildingRaw, b.id)) merged.buildings[b.id] = lv;
      }
      if (!merged.buildings.b_array) merged.buildings.b_array = 1;

      const artRaw = asObject(data.arts, 'arts');
      const artMax = 18 + merged.realm * 6 + Math.min(30, Math.floor((merged.buildings.b_library || 0) * 0.5));
      merged.arts = {};
      for (const rawId of Object.keys(artRaw)) {
        const id = ART_ID_ALIAS[rawId] || rawId;
        if (!hasOwn(XG.idx.art, id) || !isObject(artRaw[rawId])) continue;
        const lv = safeNumber(artRaw[rawId].lv, 1, 1, artMax, true);
        // 新旧 id 同时存在时取等级较高者，避免改名丢进度
        const prev = merged.arts[id];
        merged.arts[id] = { lv: prev ? Math.max(prev.lv, lv) : lv };
      }
      if (!merged.arts.a_yinqi) merged.arts.a_yinqi = { lv: 1 };

      const equipRaw = asObject(data.equip, 'equip');
      const equipBagRaw = asArray(data.equipBag, 'equipBag');
      const statKeys = ['atk', 'def', 'hp', 'crit', 'critDmg', 'dodge', 'spd', 'lifesteal', 'pen', 'spirit'];
      const weights = { atk: 1, hp: 0.9, def: 1.1, crit: 14, critDmg: 6, dodge: 16, spd: 16, lifesteal: 20, pen: 14, spirit: 1 };
      const socketCount = q => q >= 5 ? 3 : q >= 3 ? 2 : q >= 1 ? 1 : 0;
      const normalizeEquipment = value => {
        if (!isObject(value)) return null;
        const id = safeText(value.id, '', 128);
        const slot = typeof value.slot === 'string' ? value.slot : '';
        if (!id || !hasOwn(XG.idx.slot, slot)) return null;
        const q = safeNumber(value.q, 0, 0, 6, true);
        const sourceStats = isObject(value.stats) ? value.stats : {};
        const stats = {};
        for (const key of statKeys) {
          if (!hasOwn(sourceStats, key)) continue;
          const stat = safeNumber(sourceStats[key], 0, 0, 1e15, false);
          if (stat > 0) stats[key] = stat;
        }
        if (!Object.keys(stats).length) return null;
        const slots = socketCount(q);
        const sourceSockets = Array.isArray(value.sockets) ? value.sockets : [];
        const sockets = Array(slots).fill(null);
        for (let i = 0; i < Math.min(slots, sourceSockets.length); i++) {
          const gem = sourceSockets[i];
          if (!isObject(gem) || typeof gem.id !== 'string' || !hasOwn(XG.idx.gem, gem.id)) continue;
          if (!Number.isInteger(gem.tier) || gem.tier < 1 || gem.tier > XG.GEM_MAX_TIER) continue;
          sockets[i] = { id: gem.id, tier: gem.tier };
        }
        const enh = safeNumber(value.enh, 0, 0, XG.FORGE_CFG.ENHANCE_MAX, true);
        const mul = Number(XG.FORGE_CFG.enhanceStatMul(enh));
        let score = 0;
        for (const key in stats) score += stats[key] * (Number.isFinite(mul) ? mul : 1) * (weights[key] || 1);
        for (const gem of sockets) {
          if (!gem) continue;
          const def = XG.idx.gem[gem.id];
          score += def.val * Math.pow(XG.GEM_TIER_MULT, gem.tier - 1) * (weights[def.stat] || 1);
        }
        if (!Number.isFinite(score) || score <= 0) return null;
        const names = XG.EQUIP_NAMES[slot][q];
        const setId = typeof value.set === 'string' && hasOwn(XG.SETS, value.set) ? value.set : null;
        return {
          id,
          slot,
          name: safeText(value.name, names && names[0] ? names[0] : '装备', 100),
          q,
          stats,
          realm: safeNumber(value.realm, 0, 0, XG.REALMS.length - 1, true),
          from: safeText(value.from, '未知', 100),
          enh,
          sockets,
          set: setId,
          score,
        };
      };

      let maxEquipId = 0;
      for (const value of Object.keys(equipRaw).map(key => equipRaw[key]).concat(equipBagRaw)) {
        if (!isObject(value) || typeof value.id !== 'string') continue;
        const match = /^e([0-9]+)$/.exec(value.id);
        if (!match) continue;
        const id = Number(match[1]);
        if (Number.isFinite(id) && id <= MAX_SAFE_INTEGER) maxEquipId = Math.max(maxEquipId, id);
      }
      const equipIds = new Set();
      const equipBag = [];
      const addBag = eq => {
        if (!eq || equipIds.has(eq.id)) return false;
        equipIds.add(eq.id);
        equipBag.push(eq);
        return true;
      };
      merged.equip = {};
      for (const sl of XG.SLOTS) {
        merged.equip[sl.id] = null;
        const eq = normalizeEquipment(equipRaw[sl.id]);
        if (!eq) continue;
        if (eq.slot === sl.id && !equipIds.has(eq.id)) {
          equipIds.add(eq.id);
          merged.equip[sl.id] = eq;
        } else addBag(eq);
      }
      for (const value of equipBagRaw) addBag(normalizeEquipment(value));
      merged.equipBag = equipBag;
      let nextEquipId = safeNumber(data.nextEquipId, 1, 1, MAX_SAFE_INTEGER, true);
      if (maxEquipId >= nextEquipId) nextEquipId = maxEquipId < MAX_SAFE_INTEGER ? maxEquipId + 1 : MAX_SAFE_INTEGER;
      merged.nextEquipId = nextEquipId;

      const skillSource = data.skills === undefined
        ? defaults.skills
        : (asArray(data.skills, 'skills').length === 3 ? data.skills : defaults.skills);
      const skillIds = new Set();
      merged.skills = [null, null, null];
      for (let i = 0; i < 3; i++) {
        const id = skillSource[i];
        if (typeof id !== 'string' || skillIds.has(id) || !hasOwn(XG.idx.skill, id)) continue;
        if (XG.idx.skill[id].unlock > merged.realm) continue;
        merged.skills[i] = id;
        skillIds.add(id);
      }
      merged.enhanceBag = [];

      merged.pets = asObject(data.pets, 'pets');
      normalizePets(merged);

      const gemRaw = asObject(data.gems, 'gems');
      merged.gems = {};
      for (const key of Object.keys(gemRaw)) {
        const split = key.lastIndexOf('_');
        if (split <= 0) continue;
        const id = key.slice(0, split);
        const tierRaw = key.slice(split + 1);
        if (!hasOwn(XG.idx.gem, id) || !/^[1-9][0-9]*$/.test(tierRaw)) continue;
        const tier = Number(tierRaw);
        if (!Number.isInteger(tier) || tier < 1 || tier > XG.GEM_MAX_TIER) continue;
        const count = safeNumber(gemRaw[key], 0, 0, MAX_NUMBER, true);
        if (count > 0) merged.gems[id + '_' + tier] = count;
      }

      const buffSource = asArray(data.buffs, 'buffs');
      const buffMap = {};
      for (const value of buffSource) {
        if (!isObject(value) || typeof value.id !== 'string' || !hasOwn(XG.idx.pill, value.id)) continue;
        const def = XG.idx.pill[value.id];
        if (def.kind !== 'buff' && def.kind !== 'buffStat' && def.kind !== 'buffCharge') continue;
        const until = safeNumber(value.until, 0, 0, MAX_SAFE_INTEGER, true);
        if (until <= now) continue;
        const buff = { id: def.id, name: def.name, icon: def.icon, until };
        if (typeof value.spiritMult === 'number' && Number.isFinite(value.spiritMult) && value.spiritMult > 0) {
          buff.spiritMult = safeNumber(value.spiritMult, 1, 0, 1e6, false);
        }
        if (typeof value.breakBonus === 'number' && Number.isFinite(value.breakBonus) && value.breakBonus >= 0) {
          buff.breakBonus = safeNumber(value.breakBonus, 0, 0, 1, false);
        }
        if (isObject(value.stat)) {
          const stat = {};
          for (const key of ['atk', 'hp', 'def']) {
            if (typeof value.stat[key] === 'number' && Number.isFinite(value.stat[key]) && value.stat[key] > 0) {
              stat[key] = safeNumber(value.stat[key], 0, 0, 1e6, false);
            }
          }
          if (Object.keys(stat).length) buff.stat = stat;
        }
        if (!buffMap[def.id] || buff.until > buffMap[def.id].until) buffMap[def.id] = buff;
      }
      merged.buffs = Object.keys(buffMap).map(id => buffMap[id]);

      const questRaw = asObject(data.quest, 'quest');
      const questTimes = value => {
        const raw = asObject(value, 'quest timestamps');
        const out = {};
        for (const id of Object.keys(raw)) {
          if (!hasOwn(XG.idx.quest, id)) continue;
          const at = safeNumber(raw[id], 0, 0, MAX_SAFE_INTEGER, true);
          if (at > 0) out[id] = at;
        }
        return out;
      };
      /* 任务指针解析：
         优先用新格式的 id；旧档则把下标经 LEGACY_QUEST_ORDER 翻译成 id。
         若翻译出的任务已被移除（如 q30「斩妖万头」），
         就顺延到新链中同一位置的任务 —— 卡在 q30 的玩家会自然过渡到「首次飞升」。 */
      let questId = XG.QUESTS.length ? XG.QUESTS[0].id : null;
      if (typeof questRaw.id === 'string' && hasOwn(XG.idx.quest, questRaw.id)) {
        questId = questRaw.id;
      } else if (hasOwn(questRaw, 'idx')) {
        const legacyIdx = safeNumber(questRaw.idx, 0, 0, LEGACY_QUEST_ORDER.length, true);
        const legacyId = LEGACY_QUEST_ORDER[legacyIdx];
        if (legacyId && hasOwn(XG.idx.quest, legacyId)) questId = legacyId;
        else if (legacyIdx < XG.QUESTS.length) questId = XG.QUESTS[legacyIdx].id;
        else questId = null;          // 旧档已完成全部任务
      }
      merged.quest = {
        id: questId,
        claimed: questTimes(questRaw.claimed),
        seen: questTimes(questRaw.seen),
        ready: questTimes(questRaw.ready),
      };

      const gachaRaw = asObject(data.gacha, 'gacha');
      const gachaCounts = value => {
        const raw = asObject(value, 'gacha counters');
        const out = {};
        for (const id of Object.keys(XG.GACHA_POOLS)) {
          const count = safeNumber(raw[id], 0, 0, MAX_NUMBER, true);
          if (count > 0) out[id] = count;
        }
        return out;
      };
      merged.gacha = { pity: gachaCounts(gachaRaw.pity), total: gachaCounts(gachaRaw.total) };

      const omenRaw = asObject(data.omen, 'omen');
      const omenId = typeof omenRaw.id === 'string' && XG.OMENS.some(o => o.id === omenRaw.id) ? omenRaw.id : null;
      const omenUntil = safeNumber(omenRaw.until, 0, 0, MAX_SAFE_INTEGER, true);
      merged.omen = {
        id: omenId && omenUntil > now ? omenId : null,
        until: omenId && omenUntil > now ? omenUntil : 0,
        next: safeNumber(omenRaw.next, 0, 0, MAX_SAFE_INTEGER, true),
      };

      if (hasOwn(data, 'weather')) {
        const weatherRaw = asObject(data.weather, 'weather');
        const weather = {};
        if (typeof weatherRaw.id === 'string' && XG.OMENS.some(o => o.id === weatherRaw.id)) weather.id = weatherRaw.id;
        if (typeof weatherRaw.until === 'number' && Number.isFinite(weatherRaw.until) && weatherRaw.until > now) {
          weather.until = safeNumber(weatherRaw.until, 0, 0, MAX_SAFE_INTEGER, true);
        }
        for (const key of ['spirit', 'atk', 'hp', 'stoneGain', 'herbGain', 'jadeRate', 'breakBonus', 'dropRate', 'enemyPower']) {
          if (typeof weatherRaw[key] === 'number' && Number.isFinite(weatherRaw[key])) {
            weather[key] = safeNumber(weatherRaw[key], key === 'breakBonus' ? 0 : 1, -1, 1e6, false);
          }
        }
        merged.weather = weather;
      }

      const battleRaw = asObject(data.battle, 'battle');
      merged.battle = {
        stance: typeof battleRaw.stance === 'string' && hasOwn(XG.idx.stance, battleRaw.stance) ? battleRaw.stance : 'balance',
        autoSkill: battleRaw.autoSkill !== false,
        autoPill: battleRaw.autoPill === true,
      };

      const statDefaults = defaults.stats;
      const statsRaw = asObject(data.stats, 'stats');
      merged.stats = {};
      for (const key of Object.keys(statDefaults)) {
        merged.stats[key] = safeNumber(statsRaw[key], 0, 0, MAX_NUMBER, true);
      }

      const towerRaw = asObject(data.tower, 'tower');
      const clearedRaw = asObject(towerRaw.cleared, 'tower.cleared');
      let towerBest = safeNumber(towerRaw.best, 0, 0, 999, true);
      for (const key of Object.keys(clearedRaw)) {
        if (!/^[1-9][0-9]*$/.test(key) || (clearedRaw[key] !== true && clearedRaw[key] !== 1)) continue;
        const floor = Number(key);
        if (Number.isSafeInteger(floor) && floor <= 999) towerBest = Math.max(towerBest, floor);
      }
      const cleared = {};
      for (let floor = 1; floor <= towerBest; floor++) cleared[floor] = true;
      merged.tower = {
        best: towerBest,
        floor: safeNumber(towerRaw.floor, Math.min(999, towerBest + 1), 1, 999, true),
        cleared,
      };
      merged.stats.towerEver = Math.max(merged.stats.towerEver, towerBest);

      const zoneCount = XG.ZONE_NAMES.length * 2;
      const maxZone = Math.min(zoneCount - 1, merged.realm * 2 + 1);
      const exploreRaw = asObject(data.explore, 'explore');
      merged.explore = {
        zone: safeNumber(exploreRaw.zone, 0, 0, Math.max(0, maxZone), true),
        running: exploreRaw.running === true,
        progress: safeNumber(exploreRaw.progress, 0, 0, Number.MAX_VALUE, false),
        wins: safeNumber(exploreRaw.wins, 0, 0, MAX_NUMBER, true),
        losses: safeNumber(exploreRaw.losses, 0, 0, MAX_NUMBER, true),
      };

      const prestigeRaw = asObject(data.prestige, 'prestige');
      const talentRaw = asObject(prestigeRaw.talents, 'prestige.talents');
      /* 必须为每个天赋都写入键（哪怕是 0）。
         若像以前那样只在 lv > 0 时写入，全员 0 级的存档会得到 {}，
         而 talentTotals() 会做 `tl.wuxing * 0.10` → undefined * 0.1 = NaN，
         污染整个灵气乘区，导致灵气再也涨不上去。 */
      const talents = {};
      for (const def of XG.TALENTS) {
        talents[def.id] = safeNumber(talentRaw[def.id], 0, 0, def.max, true);
      }
      const earned = safeNumber(prestigeRaw.earned, 0, 0, MAX_NUMBER, true);
      merged.prestige = {
        times: safeNumber(prestigeRaw.times, 0, 0, MAX_NUMBER, true),
        earned,
        spent: Math.min(earned, safeNumber(prestigeRaw.spent, 0, 0, MAX_NUMBER, true)),
        talents,
      };
      merged.stats.ascendCount = Math.max(merged.stats.ascendCount, merged.prestige.times);

      const settingsRaw = asObject(data.settings, 'settings');
      merged.settings = {
        autoBreak: settingsRaw.autoBreak === true,
        autoPill: settingsRaw.autoPill === true,
        autoExplore: settingsRaw.autoExplore === true,
      };
      const permRaw = asObject(data.perm, 'perm');
      merged.perm = {
        spirit: safeNumber(permRaw.spirit, 0, 0, 1e12, true),
        all: safeNumber(permRaw.all, 0, 0, 1e12, true),
      };
      const permBonusRaw = asObject(data.permBonus, 'permBonus');
      merged.permBonus = {
        spirit: safeNumber(permBonusRaw.spirit, 0, 0, 1e6, false),
        atk: safeNumber(permBonusRaw.atk, 0, 0, 1e6, false),
        hp: safeNumber(permBonusRaw.hp, 0, 0, 1e6, false),
        stone: safeNumber(permBonusRaw.stone, 0, 0, 1e6, false),
        all: safeNumber(permBonusRaw.all, 0, 0, 1e6, false),
        break: safeNumber(permBonusRaw.break, 0, 0, 1, false),
      };

      const achievementRaw = asObject(data.achievements, 'achievements');
      merged.achievements = {};
      for (const id of Object.keys(achievementRaw)) {
        if (!hasOwn(XG.idx.ach, id)) continue;
        const at = safeNumber(achievementRaw[id], 0, 0, MAX_SAFE_INTEGER, true);
        if (at > 0) merged.achievements[id] = at;
      }
      merged.achBonus = { spirit: 0, atk: 0, hp: 0, stoneGain: 0 };
      for (const id of Object.keys(merged.achievements)) {
        const reward = XG.idx.ach[id].reward || {};
        for (const key of Object.keys(merged.achBonus)) {
          if (typeof reward[key] === 'number' && Number.isFinite(reward[key])) {
            merged.achBonus[key] += reward[key];
          }
        }
      }

      const metaRaw = asObject(data.meta, 'meta');
      merged.meta = {
        createdAt: safeNumber(metaRaw.createdAt, now, 1, MAX_SAFE_INTEGER, true),
        lastSeen: safeNumber(metaRaw.lastSeen, now, 0, MAX_SAFE_INTEGER, true),
        totalPlayed: safeNumber(metaRaw.totalPlayed, 0, 0, Number.MAX_VALUE, false),
      };
      merged.lastPulls = asArray(data.lastPulls, 'lastPulls').filter(isObject).slice(-100);
      merged.log = asArray(data.log, 'log').filter(entry => {
        return isObject(entry)
          && typeof entry.text === 'string'
          && typeof entry.t === 'number'
          && Number.isFinite(entry.t)
          && entry.t > 0;
      }).slice(-80).map(entry => ({
        t: safeNumber(entry.t, now, 1, MAX_SAFE_INTEGER, true),
        text: safeText(entry.text, '', 1000),
        type: safeText(entry.type, 'info', 20),
      }));
      const flagsRaw = asObject(data.flags, 'flags');
      merged.flags = {};
      for (const key of Object.keys(flagsRaw)) {
        if (typeof flagsRaw[key] === 'boolean') merged.flags[key] = flagsRaw[key];
      }
      merged.version = SAVE_VERSION;
      return merged;
    },
    wipe() {
      Save._locked = true;
      Save.conflict = null;
      Save._knownRaw = null;
      state = createState();
      const ls = Save.storage();
      if (ls) {
        try { ls.removeItem(SAVE_KEY); } catch (e) { console.error('[wipe]', e); }
      }
      return !Save.exists();
    },
    lock() { Save._locked = true; },
    unlock() { Save._locked = false; },
    isLocked() { return !!Save._locked; },
    hasConflict() { return !!Save.conflict; },
    exists() {
      const ls = Save.storage();
      if (!ls) return false;
      try { return ls.getItem(SAVE_KEY) !== null; } catch (e) { return false; }
    },
  };

  /* ══════ 日志 ══════ */
  function addLog(text, type) {
    const entry = { t: Date.now(), text, type: type || 'info' };
    state.log.push(entry);
    if (state.log.length > 120) state.log.splice(0, state.log.length - 120);
    XG.Bus.emit('log', entry);
  }

  try {
    window.addEventListener('storage', ev => {
      if (ev && (ev.key === SAVE_KEY || ev.key === null) && ev.newValue !== Save._knownRaw) {
        Save.preserveConflict(ev.newValue, 'external-update');
      }
    });
  } catch (e) { /* 不支持 storage 事件的环境忽略 */ }

  XG.State = {
    get s() { return state; },
    set(v) { state = normalizePets(v); },
    reset() { state = createState(); },
    fresh() { return createState(); },
    normalizePets, petSlotsFor,
    Calc, Res, Save, addLog,
    SAVE_KEY, SAVE_VERSION,
  };
})();

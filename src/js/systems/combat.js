/* ═══════════════════════════════════════════
   combat.js — 战斗 / 秘境 / 通天塔 / 装备生成
   ═══════════════════════════════════════════ */
(function () {
  'use strict';
  const XG = window.XG;
  const U = XG.U, R = XG.R;

  /* 等级浮动插值（几何） */
  function baseAtkAt(rf) {
    const c = XG.REALMS;
    const i = U.clamp(Math.floor(rf), 0, c.length - 1);
    const t = U.clamp(rf - i, 0, 1);
    const a = c[i].atkBase, b = c[Math.min(i + 1, c.length - 1)].atkBase;
    return a * Math.pow(b / a, t);
  }
  function baseHpAt(rf) {
    const c = XG.REALMS;
    const i = U.clamp(Math.floor(rf), 0, c.length - 1);
    const t = U.clamp(rf - i, 0, 1);
    const a = c[i].hpBase, b = c[Math.min(i + 1, c.length - 1)].hpBase;
    return a * Math.pow(b / a, t);
  }
  XG.baseAtkAt = baseAtkAt;
  XG.baseHpAt = baseHpAt;

  const QUALITY_POWER = [0.09, 0.20, 0.38, 0.70, 1.25, 2.30, 4.20];

  /* ══════ 装备生成 ══════ */
  const SLOT_ROLL = {
    weapon: {
      main: 'atk',
      subs: [['crit', 0.010, 0.045], ['critDmg', 0.05, 0.22], ['pen', 0.008, 0.035], ['atk', 0.10, 0.35]],
    },
    armor: {
      main: 'hp',
      subs: [['def', 0.08, 0.30], ['dodge', 0.004, 0.018], ['hp', 0.10, 0.35], ['atk', 0.04, 0.14]],
    },
    talisman: {
      main: 'spirit',
      subs: [['crit', 0.008, 0.038], ['pen', 0.006, 0.030], ['atk', 0.08, 0.30], ['hp', 0.06, 0.22]],
    },
    ring: {
      main: 'spd',
      subs: [['dodge', 0.005, 0.022], ['lifesteal', 0.004, 0.018], ['crit', 0.008, 0.036], ['critDmg', 0.06, 0.26]],
    },
  };

  function rollQuality(bonus) {
    bonus = bonus || 0;
    const table = [
      { q: 0, w: 100 },
      { q: 1, w: 62 + bonus * 40 },
      { q: 2, w: 30 + bonus * 55 },
      { q: 3, w: 11 + bonus * 36 },
      { q: 4, w: 3.2 + bonus * 18 },
      { q: 5, w: 0.7 + bonus * 7 },
      { q: 6, w: 0.08 + bonus * 2.2 },
    ];
    return U.weighted(table).q;
  }

  const Combat = {
    /* 供锻炉重铸词条使用 */
    SLOT_ROLL,

    /* ══════ 秘境区域 ══════ */
    totalZones() { return XG.ZONE_NAMES.length * 2; },

    zoneAt(i) {
      const realms = XG.ZONE_NAMES.length;
      if (i < 0 || i >= realms * 2) return null;
      const r = Math.floor(i / 2), sub = i % 2;
      const refR = Math.min(12, i * 0.5 + 0.18 + sub * 0.12);
      return {
        index: i, realm: r, sub,
        name: XG.ZONE_NAMES[r][sub],
        refR,
        mult: 1 + i * 0.05,
        unlocked: XG.State.s.realm >= r,
      };
    },

    /* 秘境每秒灵石收益（用于挂机/离线） */
    zoneStoneRate(i) {
      const z = Combat.zoneAt(i);
      if (!z) return 0;
      const perKill = baseAtkAt(z.refR) * 2.2 * (1 + i * 0.16);
      const perStep = perKill;                 // 每步一战
      return perStep / XG.CONFIG.EXPLORE_STEP * XG.State.Calc.mods().stoneGain;
    },

    offlineZoneStone(zoneIdx, seconds, efficiency) {
      const z = Combat.zoneAt(zoneIdx);
      const encounters = Math.floor(Math.max(0, seconds) / XG.CONFIG.EXPLORE_STEP);
      if (!z || !z.unlocked || encounters <= 0) return { stone: 0, encounters: 0, sampled: 0, wins: 0, winRate: 0 };
      const player = XG.State.Calc.playerStats();
      const enemy = Combat.makeEnemy(z.refR, z.mult);
      const sampled = Math.min(encounters, Math.max(1, XG.CONFIG.OFFLINE_BATTLE_SAMPLES));
      let wins = 0;
      for (let i = 0; i < sampled; i++) if (Combat.simulate(player, enemy).win) wins++;
      const winRate = wins / sampled;
      const perWin = Combat.zoneStoneRate(zoneIdx) * XG.CONFIG.EXPLORE_STEP;
      return {
        stone: Math.floor(perWin * encounters * winRate * Math.max(0, efficiency || 0)),
        encounters, sampled, wins, winRate,
      };
    },

    /* ══════ 生成敌人 ══════
       系数设计原则：同境界普通妖兽明显弱于裸装玩家，
       妖王（精英）需要一定装备积累方能稳胜。 */
    ENEMY_TUNE: {
      mob: { A: 0.45, H: 0.78, D: 0.30 },   // 普通妖兽
      boss: { A: 0.70, H: 2.60, D: 0.45 },  // 妖王 / 塔层守关者
    },

    makeEnemy(refR, mult, opts) {
      opts = opts || {};
      const isBoss = !!opts.boss;
      const T = isBoss ? Combat.ENEMY_TUNE.boss : Combat.ENEMY_TUNE.mob;
      const atk = baseAtkAt(refR) * mult * T.A;
      const hp = baseHpAt(refR) * mult * T.H * (opts.hpMul || 1);
      const def = baseAtkAt(refR) * mult * T.D;
      const name = opts.name || U.pick(XG.MOB_NAMES[U.clamp(Math.round(refR), 0, 12)]);
      const prefix = opts.prefix !== undefined ? opts.prefix : (refR > 6 ? U.pick(XG.MOB_PREFIX) : '');
      /* 天象「煞气弥漫」会强化所有妖敌 */
      const om = XG.State.Calc.mods().enemyPower || 1;
      return {
        name: (prefix || '') + name,
        icon: opts.icon || (isBoss ? '👺' : '👹'),
        atk: atk * om, hp: hp * om, maxHp: hp * om, def: def * om,
        crit: U.clamp(0.04 + refR * 0.006, 0, 0.4),
        critDmg: 0.4 + refR * 0.05,
        dodge: U.clamp(0.01 + refR * 0.004, 0, 0.22),
        spd: 1 + refR * 0.012,
        lifesteal: isBoss ? 0.05 : 0,
        pen: U.clamp(refR * 0.012, 0, 0.35),
        isBoss, refR, mult,
        /* 守关者拥有杀招（带预警） */
        skillPool: isBoss ? Combat.enemySkillPool(refR) : null,
      };
    },

    /* 敌方杀招池：随境界解锁更多手段 */
    enemySkillPool(refR) {
      const pool = [XG.ENEMY_SKILLS[0]];
      if (refR >= 1.5) pool.push(XG.ENEMY_SKILLS[2]);
      if (refR >= 3) pool.push(XG.ENEMY_SKILLS[1]);
      if (refR >= 5) pool.push(XG.ENEMY_SKILLS[3]);
      return pool;
    },

    /* 妖王（秘境精英） */
    makeZoneBoss(zoneIdx) {
      const z = Combat.zoneAt(zoneIdx);
      const r = Math.floor(z.index / 2);
      const nm = XG.BOSS_NAMES[r][z.sub] || U.pick(XG.BOSS_NAMES[r]);
      return Combat.makeEnemy(z.refR, z.mult * 1.55, { boss: true, name: nm, icon: '👺', prefix: '' });
    },

    /* 天劫化身
       设计：以「玩家自身实力」为基准动态生成，保证是一场
       需要全力应对、但准备充分即可取胜的战斗。
       攻方回合伤害 f(x) = 3x²/(3x + D)，据此反解出敌方攻击力。 */
    makeTribulation(nextRealm) {
      const p = XG.State.Calc.playerStats();
      const refR = Math.max(0, nextRealm - 0.15);
      const power = Math.max(0.1, XG.CONFIG.TRIB_BASE_POWER || 1);
      const killRounds = Math.max(1, (XG.CONFIG.TRIB_KILL_ROUNDS + nextRealm * XG.CONFIG.TRIB_ROUNDS_PER_REALM) * power);
      const surviveRounds = Math.max(1, (XG.CONFIG.TRIB_SURVIVE_ROUNDS + nextRealm * XG.CONFIG.TRIB_ROUNDS_PER_REALM) * power);
      const def = p.def * 0.55;
      const playerDamage = Combat.offenseBudget(p, { def, dodge: 0, crit: 0, critDmg: 0, spd: 1 }, killRounds);
      const hp = Math.max(1, playerDamage * killRounds);
      const incoming = Math.max(1, p.maxHp / surviveRounds);
      const atk = Combat.attackForDamage({
        name: '九天雷劫', icon: '⚡', atk: 1, hp: 1, maxHp: 1, def: 0,
        crit: 0.12, critDmg: 0.7, dodge: 0.03, spd: 1.06, lifesteal: 0, pen: 0.18,
      }, p, incoming);

      return {
        name: '九天雷劫',
        icon: '⚡',
        isBoss: true,
        refR,
        atk,
        hp, maxHp: hp,
        def,
        crit: 0.12,
        critDmg: 0.7,
        dodge: 0.03,
        spd: 1.06,
        lifesteal: 0,
        pen: 0.18,
      };
    },

    /* ══════ 通天塔 ══════
       塔层难度按指数增长（玩家靠装备/功法/道果实现的成长同样是
       指数级），因此塔能长期充当「验算修行成果」的标尺。 */
    TOWER_GROWTH: 1.085,
    towerRefR(n) { return Math.min(12, 0.25 + n * 0.30); },
    towerMult(n) { return Math.pow(Combat.TOWER_GROWTH, n) * (1 + n * 0.02); },
    towerHpMul(n) { return 1.5 + n * 0.22; },

    towerEnemy(n) {
      Combat.rememberTower();
      const refR = Combat.towerRefR(n);
      const r = U.clamp(Math.round(refR), 0, 12);
      const pool = XG.BOSS_NAMES[r];
      const base = pool[(n * 7 + 3) % pool.length];
      const e = Combat.makeEnemy(refR, Combat.towerMult(n), {
        boss: true, name: base, icon: '👺', hpMul: Combat.towerHpMul(n),
      });
      e.name = '第' + n + '层 · ' + base;
      e.floor = n;
      return e;
    },

    towerReward(n) {
      Combat.rememberTower();
      const refR = Combat.towerRefR(n);
      const m = XG.State.Calc.mods();
      return {
        jade: Math.floor((2 + n * 1.1) * (1 + XG.State.s.prestige.earned * 0.05)),
        stone: Math.floor(baseAtkAt(refR) * 14 * (1 + n * 0.14) * m.stoneGain),
        equipBonus: n % 5 === 0 ? 0.6 : 0.12,
      };
    },

    /* ══════ 装备生成 ══════
       opts: { slot, q, set, keepEnh } 用于合成/寻宝等定向生成 */
    genEquip(bonus, label, opts) {
      const s = XG.State.s;
      opts = opts || {};
      const rIdx = U.clamp(s.realm, 0, 6);
      const q = opts.q !== undefined ? opts.q : rollQuality(bonus || 0);
      const slot = opts.slot || U.pick(XG.SLOTS).id;
      const cfg = SLOT_ROLL[slot];
      const names = XG.EQUIP_NAMES[slot][U.clamp(q, 0, 6)];
      const nm = U.pick(names);
      const power = QUALITY_POWER[q] * U.rnd(0.9, 1.15) * XG.State.Calc.mods().equipPower;

      const stats = {};
      stats[cfg.main] = (stats[cfg.main] || 0) + power;
      const nSub = q >= 6 ? 4 : q >= 4 ? 3 : q >= 2 ? 2 : 1;
      const subs = U.sample(cfg.subs, Math.min(nSub, cfg.subs.length));
      for (const [k, lo, hi] of subs) {
        stats[k] = (stats[k] || 0) + U.rnd(lo, hi) * (0.6 + power * 0.55);
      }

      /* 孔位：品质越高孔越多 */
      const nSock = q >= 5 ? 3 : q >= 3 ? 2 : q >= 1 ? 1 : 0;
      const sockets = [];
      for (let i = 0; i < nSock; i++) sockets.push(null);

      /* 套装：品质与境界达标时有一定概率附带 */
      let setId = opts.set !== undefined ? opts.set : null;
      if (opts.set === undefined && q >= 1) {
        const cand = Object.keys(XG.SETS).filter(id => {
          const d = XG.SETS[id];
          return d.q <= q && (d.minRealm || 0) <= s.realm;
        });
        if (cand.length && U.chance(0.30 + q * 0.06)) setId = U.pick(cand);
      }

      const eq = {
        id: 'e' + (s.nextEquipId++),
        slot, name: nm, q, stats,
        realm: rIdx,
        from: label || '未知',
        enh: opts.keepEnh || 0, sockets, set: setId,
      };
      eq.score = Combat.equipScore(eq);
      return eq;
    },

    equipScore(e) {
      const w = { atk: 1, hp: 0.9, def: 1.1, crit: 14, critDmg: 6, dodge: 16, spd: 16, lifesteal: 20, pen: 14, spirit: 1.0 };
      let sc = 0;
      const st = XG.State.Calc.eqStats(e);
      for (const k in st) sc += (st[k] || 0) * (w[k] || 1);
      return sc;
    },

    /* 强化 / 镶嵌后重算评分 */
    recalc(e) { e.score = Combat.equipScore(e); return e.score; },

    /* ═════════════════════════════════════════
       战斗执行（回合制 · 姿态 / 神通 / 连击）
       ═════════════════════════════════════════ */
    active: null,
    last: null,
    _resultTimer: null,
    _exploreResume: false,
    _towerArchive: null,

    MAX_COMBO: 10,
    COMBO_STEP: 0.03,      // 每层连击 +3% 伤害
    ENERGY_PER_ROUND: 22,  // 玩家每回合回复灵力
    ENEMY_ENERGY_PER_ROUND: 18,
    /* 速度对灵力回复的加成区间（按双方速度比映射）。
       速度的实际收益 = 先手 + 灵力回复更快；这里卡住上下限，
       既让堆速度有平滑收益，又不会产生无限收益。 */
    SPD_ENERGY_MIN: 0.6,
    SPD_ENERGY_MAX: 1.8,
    MAX_LOG: 260,

    /* 生成战斗单位（战斗内使用的可变副本） */
    mkUnit(o, isPlayer) {
      const maxHp = o.maxHp !== undefined ? o.maxHp : o.hp;
      const u = {
        name: o.name, icon: o.icon || (isPlayer ? '🧘' : '👹'),
        atk: o.atk, hp: o.hp, maxHp, baseMaxHp: maxHp, def: o.def,
        crit: o.crit || 0, critDmg: o.critDmg || 0,
        dodge: o.dodge || 0, spd: o.spd || 1,
        lifesteal: o.lifesteal || 0, pen: o.pen || 0,
        isBoss: !!o.isBoss, isPlayer: !!isPlayer,
        stance: isPlayer ? (o.stance || 'balance') : 'balance',
        energy: isPlayer ? 30 : 0, maxEnergy: o.maxEnergy || 100,
        buffs: [], cd: {}, combo: 0,
        skills: isPlayer ? (o.skills || []).slice() : [],
        skillPool: o.skillPool || null,
        charging: null,
      };
      return u;
    },

    /* 姿态 + Buff 综合后的有效属性 */
    eff(st) {
      const stance = XG.idx.stance[st.stance] || XG.idx.stance.balance;
      let atkMul = stance.atk, defMul = stance.def, taken = stance.taken;
      let critAdd = 0, critDmgAdd = 0, dmgMul = 1, hpMul = 1, immune = false;
      for (const b of st.buffs) {
        if (b.atkMul) atkMul *= b.atkMul;
        if (b.defMul) defMul *= b.defMul;
        if (b.hpMul) hpMul *= b.hpMul;
        if (b.crit) critAdd += b.crit;
        if (b.critDmg) critDmgAdd += b.critDmg;
        if (b.taken) taken *= b.taken;
        if (b.dmgMul) dmgMul *= b.dmgMul;
        if (b.immune) immune = true;
      }
      const combo = 1 + Math.min(st.combo || 0, Combat.MAX_COMBO) * Combat.COMBO_STEP;
      return {
        atk: st.atk * atkMul, def: st.def * defMul,
        crit: U.clamp(st.crit + critAdd, 0, 0.95), critDmg: st.critDmg + critDmgAdd,
        dodge: st.dodge, spd: st.spd,
        lifesteal: st.lifesteal, pen: st.pen,
        taken, dmgMul: dmgMul * combo, hpMul, immune, combo,
      };
    },

    dmg(att, def, fixed, opts) {
      opts = opts || {};
      const A = Combat.eff(att), D = Combat.eff(def);
      if (D.immune) return { immune: true, dmg: 0 };
      if (U.chance(D.dodge)) return { miss: true };
      const d = Math.max(0, D.def * (1 - U.clamp(A.pen, 0, 0.85)) * (1 - U.clamp(opts.ignoreDef || 0, 0, 0.9)));
      const raw = (fixed !== undefined ? fixed : A.atk) * A.dmgMul * (opts.mult || 1) * U.rnd(0.88, 1.14);
      let dmg = raw * (3 * raw) / (3 * raw + d);
      let crit = !!opts.forceCrit;
      if (!crit && U.chance(A.crit)) crit = true;
      if (crit) dmg *= 1.8 + A.critDmg;
      dmg *= D.taken;
      return { dmg: Math.max(1, dmg), crit };
    },

    expectedDamage(att, def, mult, opts) {
      opts = opts || {};
      const A = Combat.eff(att), D = Combat.eff(def);
      if (D.immune) return 0;
      const mitigation = D.def * (1 - U.clamp(A.pen, 0, 0.85)) * (1 - U.clamp(opts.ignoreDef || 0, 0, 0.9));
      const raw = A.atk * A.dmgMul * (mult === undefined ? 1 : mult) * 1.01;
      const hit = Math.max(1, raw * (3 * raw) / (3 * raw + Math.max(0, mitigation)) * D.taken);
      const crit = opts.forceCrit ? 1 : 1 + A.crit * (0.8 + A.critDmg);
      return Math.max(0, hit * crit * (1 - D.dodge));
    },

    offenseBudget(player, enemy, rounds) {
      const target = Object.assign({
        name: '预算目标', icon: '', atk: 1, hp: 1, maxHp: 1, def: 1,
        crit: 0, critDmg: 0, dodge: 0, spd: 1, lifesteal: 0, pen: 0,
      }, enemy || {});
      const attacker = Combat.mkUnit(player, true);
      const defender = Combat.mkUnit(target, false);
      const count = Math.max(1, Math.ceil(rounds || 1));
      let total = 0;
      for (let round = 1; round <= count; round++) {
        for (const id in attacker.cd) if (attacker.cd[id] > 0) attacker.cd[id]--;
        attacker.buffs.forEach(buff => buff.rounds--);
        attacker.buffs = attacker.buffs.filter(buff => buff.rounds > 0);
        defender.buffs.forEach(buff => buff.rounds--);
        defender.buffs = defender.buffs.filter(buff => buff.rounds > 0);
        /* 与 runRound 保持一致的灵力回复模型，否则天劫预算会与实际战斗脱节 */
        attacker.energy = Math.min(attacker.maxEnergy,
          attacker.energy + Combat.ENERGY_PER_ROUND * Combat.spdEnergyMult(attacker, defender));
        if (round <= 2) {
          const support = attacker.skills.map(id => XG.idx.skill[id]).find(sk => sk && (sk.role === 'support' || sk.role === 'control') && attacker.energy >= sk.cost && !attacker.cd[sk.id]);
          if (support) {
            attacker.energy -= support.cost;
            attacker.cd[support.id] = support.cd;
            if (support.id === 'sk_jianxin') Combat.addBuff(attacker, { id: support.id, rounds: 4, crit: 0.4, critDmg: 0.7 });
            if (support.id === 'sk_zhenhun') Combat.addBuff(defender, { id: support.id, rounds: 4, atkMul: 0.55 });
            continue;
          }
        }
        const attacks = attacker.skills.map((id, index) => ({ sk: XG.idx.skill[id], index })).filter(x => x.sk && x.sk.role === 'attack' && x.sk.power && attacker.energy >= x.sk.cost && !attacker.cd[x.sk.id]);
        attacks.sort((x, y) => attacker.energy >= 70 ? y.sk.priority - x.sk.priority : x.sk.cost - y.sk.cost || x.index - y.index);
        const chosen = attacks[0];
        if (chosen) {
          const sk = chosen.sk;
          if (sk.selfCost) attacker.hp = Math.max(1, attacker.hp * (1 - sk.selfCost));
          total += Combat.expectedDamage(attacker, defender, sk.power, { ignoreDef: sk.ignoreDef || 0, forceCrit: !!sk.forceCrit });
          if (sk.dotPower) total += Combat.eff(attacker).atk * sk.dotPower * Math.min(sk.dotRounds || 0, count - round);
          attacker.energy -= sk.cost;
          attacker.cd[sk.id] = sk.cd;
        } else {
          total += Combat.expectedDamage(attacker, defender, 1);
        }
        attacker.combo = Math.min(Combat.MAX_COMBO, attacker.combo + 1);
      }
      return Math.max(1, total / count);
    },

    attackForDamage(attacker, target, desired) {
      desired = Math.max(Number.EPSILON, desired || 0);
      const probe = Combat.mkUnit(attacker, false);
      const defender = Combat.mkUnit(target, true);
      let lo = 0;
      let hi = Math.max(1, desired * 12 + (attacker.atk || 1));
      for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2;
        probe.atk = mid;
        if (Combat.expectedDamage(probe, defender) < desired) lo = mid;
        else hi = mid;
      }
      return hi;
    },

    /* 施加一次命中，返回造成的伤害 */
    applyHit(b, who, a, t, r, opts) {
      opts = opts || {};
      const an = a.isPlayer ? '<b>你</b>' : '<b>' + a.name + '</b>';
      const tn = t.isPlayer ? '<b>你</b>' : '<b>' + t.name + '</b>';
      if (r.immune) {
        b.log.push({ t: 'buff', who, txt: `${tn} 金光罩体，毫发无伤！` });
        return 0;
      }
      if (r.miss) {
        if (a.isPlayer) a.combo = 0;
        b.log.push({ t: 'miss', who, txt: `${an} 一击落空！` });
        return 0;
      }
      t.hp -= r.dmg;
      const heal = r.dmg * (Combat.eff(a).lifesteal || 0);
      if (heal > 0) a.hp = Math.min(a.maxHp, a.hp + heal);
      if (a.isPlayer) {
        a.combo = Math.min(Combat.MAX_COMBO, a.combo + 1);
        a.energy = Math.min(a.maxEnergy, a.energy + 6);
      } else {
        a.combo = Math.min(Combat.MAX_COMBO, a.combo + 1);
        // 被击中会打断连击
        t.combo = 0;
      }
      b.log.push({
        t: r.crit ? 'crit' : 'hit', who, dmg: r.dmg, heal, crit: r.crit,
        txt: `${an}${opts.tag ? '·' + opts.tag + ' ' : ' '}造成 ${U.fmt(r.dmg)} 伤害${r.crit ? '（暴击！）' : ''}${heal > 0 ? ` 汲取 ${U.fmt(heal)}` : ''}${a.isPlayer && a.combo >= 3 ? ` <span class="cmb">连击 ×${a.combo}</span>` : ''}`,
      });
      Combat.trim(b);
      return r.dmg;
    },

    trim(b) { if (b.log.length > Combat.MAX_LOG) b.log.splice(0, b.log.length - Combat.MAX_LOG); },

    addBuff(st, def) {
      const old = st.buffs.findIndex(x => x.id === def.id);
      if (old >= 0) st.buffs.splice(old, 1);
      st.buffs.push(Object.assign({}, def));
    },

    syncHp(st) {
      if (!st || !st.isPlayer || st.baseMaxHp === undefined) return;
      const next = Math.max(1, st.baseMaxHp * Combat.eff(st).hpMul);
      if (next > st.maxHp) st.hp += next - st.maxHp;
      st.maxHp = next;
      if (st.hp > next) st.hp = next;
    },

    basicAttack(b, a, t) {
      const r = Combat.dmg(a, t);
      Combat.applyHit(b, a.isPlayer ? 'p' : 'e', a, t, r);
    },

    /* 可用神通列表 */
    castableList(st) {
      return st.skills.filter(id => {
        const sk = XG.idx.skill[id];
        if (!sk) return false;
        if ((st.cd[id] || 0) > 0) return false;
        return st.energy >= sk.cost;
      });
    },

    castSkill(b, a, t, id) {
      const sk = XG.idx.skill[id];
      if (!sk) return false;
      if ((a.cd[id] || 0) > 0 || a.energy < sk.cost) return false;
      a.energy -= sk.cost;
      a.cd[id] = sk.cd;
      if (a.isPlayer && !b.transient) {
        const st = XG.State.s.stats;
        st.skillsUsed = (st.skillsUsed || 0) + 1;
      }
      const an = a.isPlayer ? '你' : a.name;
      b.log.push({ t: 'skill', who: a.isPlayer ? 'p' : 'e', txt: `${a.isPlayer ? '<b>你</b>' : '<b>' + a.name + '</b>'} 施展 <b>${sk.icon}${sk.name}</b>` });
      try { sk.run(Combat.ctx(b, a, t, sk)); } catch (err) { console.error('[skill:' + id + ']', err); }
      Combat.trim(b);
      return true;
    },

    ctx(b, self, foe, sk) {
      const who = self.isPlayer ? 'p' : 'e';
      return {
        b, self, foe, skill: sk, state: XG.State.s,
        hit(mult, opts) {
          opts = opts || {};
          const r = Combat.dmg(self, foe, undefined, { mult, ignoreDef: opts.pen, forceCrit: opts.forceCrit });
          return Combat.applyHit(b, who, self, foe, r, opts);
        },
        buff(t, def) { Combat.addBuff(t, def); },
        debuff(t, def) { Combat.addBuff(t, def); },
        heal(t, pct, flat) {
          const amt = flat !== undefined ? flat : t.maxHp * (pct || 0);
          const before = t.hp;
          t.hp = Math.min(t.maxHp, t.hp + amt);
          const got = t.hp - before;
          if (got > 0) b.log.push({ t: 'heal', who, txt: `${t.isPlayer ? '你' : t.name} 回复 ${U.fmt(got)} 气血` });
          return got;
        },
        say(txt, cls) { b.log.push({ t: cls || 'info', who, txt }); },
      };
    },

    /* 自动应战 AI：优先后手用的救命技，其次高爆发 */
    pickAuto(b, a, t) {
      const list = Combat.castableList(a).map(id => XG.idx.skill[id]).filter(Boolean);
      if (!list.length) return null;
      const hpPct = a.hp / a.maxHp;
      const foePct = t.hp / t.maxHp;
      const attacks = list.filter(sk => sk.role === 'attack').sort((x, y) => y.priority - x.priority);
      const defenses = list.filter(sk => sk.role === 'defense').sort((x, y) => y.priority - x.priority);
      const recovery = list.filter(sk => sk.role === 'recovery' || sk.role === 'heal').sort((x, y) => y.priority - x.priority);
      if (hpPct < 0.42) {
        const guard = defenses[0] || recovery[0];
        if (guard) return guard.id;
      }
      if (t.charging) {
        const guard = defenses[0];
        if (guard) return guard.id;
      }
      if (foePct < 0.3 && attacks[0]) return attacks[0].id;
      if (b.round <= 2) {
        const support = list.filter(sk => sk.role === 'support' || sk.role === 'control').sort((x, y) => y.priority - x.priority)[0];
        if (support) return support.id;
      }
      if (a.energy >= 70 && attacks[0]) return attacks[0].id;
      const cheap = attacks.filter(sk => sk.cost <= a.energy).sort((x, y) => x.cost - y.cost || y.priority - x.priority)[0];
      return cheap ? cheap.id : null;
    },

    /* ══════ 回合流程 ══════ */
    tickBuffs(st, b, who) {
      const remain = [];
      for (const bf of st.buffs) {
        if (bf.dot && st.hp > 0) {
          const d = Math.max(1, bf.dot * Combat.eff(st).atk);
          st.hp -= d;
          b.log.push({ t: 'dot', who, txt: `${st.isPlayer ? '你' : st.name} 受 <b>${bf.name}</b> 侵蚀，损失 ${U.fmt(d)} 气血` });
        }
        bf.rounds--;
        if (bf.rounds > 0) remain.push(bf);
      }
      st.buffs = remain;
      Combat.syncHp(st);
      for (const id in st.cd) if (st.cd[id] > 0) st.cd[id]--;
    },

    isAuto(b) { return b.auto !== false; },

    /* 速度比 → 灵力回复倍率（有上下限，避免极端堆叠产生无限收益） */
    spdEnergyMult(a, b) {
      const sa = Math.max(1e-4, Number(a && a.spd) || 1);
      const sb = Math.max(1e-4, Number(b && b.spd) || 1);
      return U.clamp(sa / sb, Combat.SPD_ENERGY_MIN, Combat.SPD_ENERGY_MAX);
    },

    runRound(b) {
      b.round++;
      Combat.tickBuffs(b.p, b, 'p');
      Combat.tickBuffs(b.e, b, 'e');
      if (b.p.hp <= 0 || b.e.hp <= 0) return;
      /* 灵力回复随双方速度比浮动：速度快的一侧出手更频。
         这是速度除「先手」之外的第二个实际收益。 */
      b.p.energy = Math.min(b.p.maxEnergy,
        b.p.energy + Combat.ENERGY_PER_ROUND * Combat.spdEnergyMult(b.p, b.e));
      b.e.energy = Math.min(b.e.maxEnergy,
        b.e.energy + Combat.ENEMY_ENERGY_PER_ROUND * Combat.spdEnergyMult(b.e, b.p));

      /* 手动模式：若玩家有可施展的神通，则停下等待指令 */
      if (!Combat.isAuto(b) && b.pendingSkill === undefined && !b.waiting
        && Combat.castableList(b.p).length) {
        b.waiting = true;
        XG.Bus.emit('battle:wait', b);
        return;
      }
      Combat.resolveRound(b);
    },

    resolveRound(b) {
      const playerFirst = (b.p.spd || 1) >= (b.e.spd || 1);
      if (playerFirst) {
        Combat.playerTurn(b);
        if (b.e.hp > 0 && b.p.hp > 0) Combat.enemyTurn(b);
      } else {
        Combat.enemyTurn(b);
        if (b.p.hp > 0 && b.e.hp > 0) Combat.playerTurn(b);
      }
    },

    playerTurn(b) {
      const want = b.pendingSkill;
      b.pendingSkill = undefined;
      if (want) { if (Combat.castSkill(b, b.p, b.e, want)) return; }
      if (Combat.isAuto(b)) {
        const id = Combat.pickAuto(b, b.p, b.e);
        if (id && Combat.castSkill(b, b.p, b.e, id)) return;
      }
      Combat.basicAttack(b, b.p, b.e);
    },

    enemyTurn(b) {
      const e = b.e, p = b.p;
      // 完成蓄力
      if (e.charging) {
        const cs = e.charging; e.charging = null;
        if (cs.buff) { Combat.addBuff(e, cs.buff); b.log.push({ t: 'skill', who: 'e', txt: `<b>${e.name}</b> 施展 <b>${cs.icon}${cs.name}</b>：${cs.tell}` }); return; }
        if (cs.debuff) { Combat.addBuff(p, cs.debuff); b.log.push({ t: 'skill', who: 'e', txt: `<b>${e.name}</b> 施展 <b>${cs.icon}${cs.name}</b>：${cs.tell}` }); return; }
        b.log.push({ t: 'skill', who: 'e', txt: `<b>${e.name}</b> 轰出 <b>${cs.icon}${cs.name}</b>！` });
        const r = Combat.dmg(e, p, undefined, { mult: cs.mult || 1 });
        const dealt = Combat.applyHit(b, 'e', e, p, r);
        if (cs.drain && dealt > 0) Combat.ctx(b, e, p, { name: '' }).heal(e, 0, dealt * cs.drain);
        return;
      }
      // 决定是否起手杀招
      if (e.skillPool && e.skillPool.length && U.chance(e.isBoss ? 0.26 : 0.1)) {
        const cs = U.pick(e.skillPool);
        if (cs.id === 'es_charge') {
          e.charging = cs;
          b.log.push({ t: 'tell', who: 'e', txt: `⚠ <b>${e.name}</b> ${cs.tell}` });
          return;
        }
        b.log.push({ t: 'skill', who: 'e', txt: `<b>${e.name}</b> 施展 <b>${cs.icon}${cs.name}</b>：${cs.tell}` });
        if (cs.buff) { Combat.addBuff(e, cs.buff); return; }
        if (cs.debuff) { Combat.addBuff(p, cs.debuff); return; }
        if (cs.mult) {
          const r = Combat.dmg(e, p, undefined, { mult: cs.mult });
          const dealt = Combat.applyHit(b, 'e', e, p, r);
          if (cs.drain && dealt > 0) Combat.ctx(b, e, p, { name: '' }).heal(e, 0, dealt * cs.drain);
        }
        return;
      }
      Combat.basicAttack(b, e, p);
    },

    /* 玩家指令（手动模式） */
    playerCommand(b, skillId) {
      if (!b || b.over || !b.waiting) return false;
      b.waiting = false;
      b.pendingSkill = skillId || null;
      Combat.resolveRound(b);
      Combat.trim(b);
      if (b.p.hp <= 0 || b.e.hp <= 0) Combat.endBattle();
      else XG.Bus.emit('battle:turn', b);
      return true;
    },

    /* 战斗切换姿态 */
    setStance(id) {
      const b = Combat.active;
      if (!b || b.over || !XG.idx.stance[id]) return false;
      b.p.stance = id;
      b.p.combo = 0;
      XG.State.s.battle.stance = id;
      b.log.push({ t: 'buff', who: 'p', txt: `你切换为 <b>${XG.idx.stance[id].icon}${XG.idx.stance[id].name}</b>` });
      XG.Bus.emit('battle:turn', b);
      return true;
    },

    /* 战斗中可用的丹药（返回列表，供战斗界面展示） */
    battlePills() {
      const s = XG.State.s;
      const out = [];
      for (const id in s.pills) {
        const p = XG.idx.pill[id];
        if (!p || s.pills[id] <= 0 || p.battleUsable !== true || !p.battleEffect) continue;
        out.push({ id, def: p, n: s.pills[id] });
      }
      return out.sort((a, b) => a.def.q - b.def.q);
    },

    /* 战斗中服丹：转化为即时治疗或战斗增益 */
    useBattlePill(pillId) {
      const b = Combat.active;
      if (!b || b.over) return { ok: false, reason: 'nobattle' };
      const def = XG.idx.pill[pillId];
      if (!def || (XG.State.s.pills[pillId] || 0) <= 0) return { ok: false, reason: 'none' };
      if (def.battleUsable !== true || !def.battleEffect) return { ok: false, reason: 'unusable' };

      const power = XG.State.Calc.mods().pillPower;
      const effect = def.battleEffect;
      const p = b.p;
      let text = '';
      if (effect.type === 'heal') {
        const before = p.hp;
        p.hp = Math.min(p.maxHp, p.hp + p.maxHp * (effect.pct || 0) * power);
        const gained = p.hp - before;
        if (gained <= 0) return { ok: false, reason: 'noeffect' };
        text = `回复气血 ${U.fmt(gained)}`;
      } else if (effect.type === 'stat') {
        const rounds = effect.rounds || 6;
        const stat = def.stat || {};
        const atk = (stat.atk || 0) * power;
        const hp = (stat.hp || 0) * power;
        Combat.addBuff(p, {
          id: pillId, name: def.name, icon: def.icon, rounds,
          atkMul: 1 + atk, hpMul: 1 + hp,
        });
        Combat.syncHp(p);
        text = `攻击 +${Math.round(atk * 100)}%，气血 +${Math.round(hp * 100)}%（${rounds} 回合）`;
      } else if (effect.type === 'defense') {
        const rounds = effect.rounds || 4;
        Combat.addBuff(p, { id: pillId, name: def.name, icon: def.icon, rounds, taken: effect.taken || 0.85 });
        text = `受到伤害 ×${(effect.taken || 0.85).toFixed(2)}（${rounds} 回合）`;
      } else {
        return { ok: false, reason: 'unusable' };
      }

      XG.State.Res.usePill(pillId, 1);
      XG.State.s.stats.pillsUsed++;
      b.log.push({ t: 'buff', who: 'p', txt: `<b>你</b> 服下 <b>${def.icon}${def.name}</b>：${text}` });
      XG.Bus.emit('pill:used', { pill: def, text });
      XG.Bus.emit('battle:turn', b);
      return { ok: true, text, name: def.name };
    },

    startBattle(player, opts) {
      if (Combat.active || Combat.last) return false;
      opts = opts || {};
      if (!opts.enemy || !isFinite(opts.enemy.hp) || opts.enemy.hp <= 0) {
        console.error('[combat] startBattle 缺少有效的 enemy');
        return false;
      }
      const e = JSON.parse(JSON.stringify(opts.enemy));
      if (!isFinite(e.maxHp) || e.maxHp <= 0) e.maxHp = e.hp;
      const p = Combat.mkUnit(player, true);
      const eu = Combat.mkUnit(e, false);
      const exploreResume = !!XG.State.s.explore.running;
      Combat._exploreResume = exploreResume;
      const b = {
        p, e: eu, log: [], round: 0, timer: 0, over: false, waiting: false,
        opts, speed: XG.CombatSpeed || 1, exploreResume,
        transient: !!opts.transient,
        auto: opts.auto !== undefined ? opts.auto : (XG.State.s.battle.autoSkill !== false),
      };
      Combat.active = b;
      XG.Bus.emit('battle:start', b);
      return true;
    },

    tickBattle(dt) {
      const b = Combat.active;
      if (!b || b.over || b.waiting) return;
      const interval = XG.CONFIG.BATTLE_TICK / (b.speed || 1);
      b.timer += dt;
      let guard = 0;
      while (b.timer >= interval && !b.over && !b.waiting && guard < 40) {
        b.timer -= interval; guard++;
        Combat.runRound(b);
        if (b.p.hp <= 0 || b.e.hp <= 0) { Combat.endBattle(); return; }
        if (b.round > 300) { Combat.endBattle(true); return; }
      }
      XG.Bus.emit('battle:turn', b);
    },

    endBattle(timeout) {
      const b = Combat.active;
      if (!b) return;
      b.over = true;
      b.waiting = false;
      const win = !timeout && b.e.hp <= 0 && b.p.hp > 0;
      b.result = { win, timeout: !!timeout };
      Combat.active = null;
      Combat.last = b;
      Combat._exploreResume = false;
      try {
        if (b.opts.onWin && win) b.opts.onWin(b);
        else if (b.opts.onLose && !win) b.opts.onLose(b);
      } catch (err) {
        console.error('[battle:result]', err);
      }
      XG.Bus.emit('battle:end', b);
      if (Combat.last === b && b.opts.explore && b.exploreResume) {
        clearTimeout(Combat._resultTimer);
        Combat._resultTimer = setTimeout(() => Combat.closeResult(), Math.max(0, XG.CONFIG.AUTO_RESULT_DELAY) * 1000);
      }
    },

    closeResult() {
      clearTimeout(Combat._resultTimer);
      Combat._resultTimer = null;
      const b = Combat.last;
      if (!b) return false;
      Combat.last = null;
      if (b.exploreResume) Combat.setExploring(true);
      XG.Bus.emit('battle:closed', b);
      return true;
    },

    closeBattle() {
      return Combat.closeResult();
    },

    /* ═════════════════════════════════════════
       秘境挂机（瞬时结算 + 随机遭遇）
       ═════════════════════════════════════════ */
    EXPLORE_EVENT_CHANCE: 0.24,   // 每步触发随机遭遇的概率

    setExploring(on) {
      on = !!on;
      const s = XG.State.s;
      s.explore.running = on;
      if (!on) {
        Combat._exploreResume = false;
        const battle = Combat.active || Combat.last;
        if (battle) battle.exploreResume = false;
      }
      XG.Bus.emit('explore:change');
      XG.Bus.emit('explore:toggle');
      return on;
    },

    tickExplore(dt) {
      if (Combat.active || Combat.last) return;
      const s = XG.State.s;
      if (!s.explore.running) return;
      const z = Combat.zoneAt(s.explore.zone);
      if (!z || !z.unlocked) { Combat.setExploring(false); XG.Bus.emit('explore:stop'); return; }

      s.explore.progress += dt;
      if (s.explore.progress < XG.CONFIG.EXPLORE_STEP) return;
      s.explore.progress -= XG.CONFIG.EXPLORE_STEP;
      Combat.exploreOnce();
    },

    /* 秘境遭遇的增益接口 */
    zoneApi(z) {
      const s = XG.State.s, Calc = XG.State.Calc;
      return {
        state: s,
        mods: () => Calc.mods(),
        gainStone(n) { XG.State.Res.gainStone(n, true); },
        gainSpirit(n) { s.spirit = Math.min(Calc.need(), s.spirit + n); s.stats.totalSpirit += n; },
        loseSpirit(n) { s.spirit = Math.max(0, s.spirit - n); },
        gainHerb(n) { XG.State.Res.gainHerb(n, true); },
        gainJade(n) { XG.State.Res.gainJade(n, true); },
        gainMat(id, n) { XG.State.Res.gainMat(id, n); },
        gainGem(tier, n) {
          const g = U.pick(XG.GEMS);
          XG.State.Res.gainGem(g.id, tier, n);
          return `${g.icon}${g.name}×${n}`;
        },
        dropEquip(bonus, label) {
          const eq = Combat.genEquip(bonus, label);
          XG.Economy.pickupEquip(eq);
          return eq;
        },
        permanentBonus(kind, v) {
          s.permBonus[kind] = (s.permBonus[kind] || 0) + v;
          XG.Bus.emit('perm:bonus');
        },
        heal() { /* 秘境无战斗态，仅作叙事 */ },
      };
    },

    exploreOnce() {
      if (Combat.active || Combat.last || !XG.State.s.explore.running) return null;
      const s = XG.State.s;
      const z = Combat.zoneAt(s.explore.zone);
      if (!z) return null;
      const p = XG.State.Calc.playerStats();

      /* ① 随机遭遇 */
      if (Math.random() < Combat.EXPLORE_EVENT_CHANCE) {
        const ev = U.weighted(XG.ZONE_EVENTS);
        if (ev.kind === 'battle') {
          const e = Combat.makeEnemy(z.refR, z.mult * 1.30, { boss: true, prefix: '', icon: '👹', name: '精英·' + U.pick(XG.MOB_NAMES[U.clamp(Math.round(z.refR), 0, 12)]) });
          if (XG.Combat.autoBossBattle !== false) {
            XG.Combat.startBattle(p, {
              kind: 'elite', enemy: e, title: '精英遭遇战', explore: true,
              onWin: () => { Combat.settleWin(z, true, true); },
              onLose: () => { Combat.settleLose(z); },
            });
            return 'elite';
          }
        } else {
          const text = ev.run(z, Combat.zoneApi(z));
          s.stats.zoneEvents = (s.stats.zoneEvents || 0) + 1;
          XG.State.addLog(`【秘境·${ev.name}】${text}`, ev.kind === 'bad' ? 'battle' : 'event');
          XG.Bus.emit('zone:event', { ev, text, zone: z.name });
          if (ev.kind !== 'bad') {
            XG.Bus.emit('float', { text: ev.icon + ' ' + ev.name, cls: 'epic' });
            s.explore.wins++;
          } else s.explore.losses++;
          return 'event';
        }
      }

      /* ② 妖王 */
      const boss = Math.random() < 0.045;
      if (boss) {
        const e = Combat.makeZoneBoss(z.index);
        if (XG.Combat.autoBossBattle !== false) {
          XG.Combat.startBattle(p, {
            kind: 'zoneboss', enemy: e, title: '妖王来袭', explore: true,
            onWin: () => { Combat.settleWin(z, true); },
            onLose: () => { Combat.settleLose(z); },
          });
          return 'boss';
        }
      }

      /* ③ 普通怪：快速结算 */
      const e2 = boss ? Combat.makeZoneBoss(z.index) : Combat.makeEnemy(z.refR, z.mult);
      const res = Combat.simulate(p, e2);
      if (res.win) Combat.settleWin(z, boss, false, res.rounds);
      else Combat.settleLose(z);
      return res.win;
    },

    /* 无动画快速模拟（用于挂机结算与战力评估） */
    simulate(p, e) {
      const b = {
        p: Combat.mkUnit(p, true), e: Combat.mkUnit(e, false),
        log: [], round: 0, timer: 0, over: false, waiting: false,
        opts: {}, speed: 1, auto: true, pendingSkill: undefined, transient: true,
      };
      let guard = 0;
      while (b.p.hp > 0 && b.e.hp > 0 && b.round < 250 && guard++ < 600) {
        Combat.runRound(b);
        if (b.log.length > 30) b.log.length = 0;
      }
      return { win: b.e.hp <= 0 && b.p.hp > 0, rounds: b.round, p: b.p, e: b.e };
    },

    settleWin(z, isBoss, isElite, rounds) {
      const s = XG.State.s, m = XG.State.Calc.mods();
      const i = z.index;
      const drop = m.dropRate || 1;

      // 灵气收益与「当前层需求」挂钩，保证战斗始终是修行的有效补充
      const need = XG.State.Calc.need();
      let stone = baseAtkAt(z.refR) * 2.2 * (1 + i * 0.16) * m.stoneGain * U.rnd(0.85, 1.2);
      let herb = Math.floor(U.rnd(6, 18) * (1 + i * 0.42) * (m.herbGain > 0 ? 1 + m.herbGain : 1));
      let spirit = need * (0.012 + i * 0.0014) * U.rnd(0.9, 1.3);

      if (isBoss) {
        stone *= isElite ? 4.5 : 7; herb *= 3; spirit *= 4;
        XG.State.Res.gainJade(Math.floor((2 + i / 2) * (m.jadeRate > 0 ? Math.max(1, m.jadeRate) : 1)), true);
      }

      XG.State.Res.gainStone(stone, true);
      XG.State.Res.gainHerb(herb, true);
      s.spirit = Math.min(XG.State.Calc.need(), s.spirit + spirit);
      s.stats.totalSpirit += spirit;
      s.explore.wins++;
      if (isBoss) { s.stats.bossKills++; if (isElite) s.stats.eliteKills++; }
      else s.stats.kills++;

      /* 材料掉落 */
      let matTxt = '';
      if (U.chance(U.clamp((isBoss ? 1 : 0.24) * drop, 0, 1))) {
        const pool = XG.MATS.filter(mm => mm.q <= U.clamp(1 + Math.floor(i / 2), 1, 6));
        const mm = U.weighted(pool.map(x => ({ ...x, w: 1 / Math.pow(1.9, x.q) })));
        const n = U.rndInt(1, isBoss ? 5 : 2);
        XG.State.Res.gainMat(mm.id, n);
        matTxt = `，${mm.icon}${mm.name}×${n}`;
      }

      /* 宝石掉落 */
      let gemTxt = '';
      if (U.chance(U.clamp((isBoss ? 0.30 : 0.055) * drop, 0, 1))) {
        const g = U.pick(XG.GEMS);
        const tier = U.clamp(1 + Math.floor(i / 7), 1, XG.GEM_MAX_TIER);
        XG.State.Res.gainGem(g.id, tier, 1);
        gemTxt = `，${g.icon}${g.name}(${tier}阶)`;
      }

      /* 装备掉落 */
      let eqTxt = '', eqDrop = null;
      if (U.chance(U.clamp((isBoss ? 0.62 : 0.11) * drop, 0, 1))) {
        eqDrop = Combat.genEquip((isBoss ? 0.55 : 0.12) + i * 0.006, z.name);
        XG.Economy.pickupEquip(eqDrop);
        eqTxt = `，${U.QUALITY[eqDrop.q].name}「${eqDrop.name}」`;
      }

      const summary = `击败 <b>${z.name}</b> 妖兽：灵石 +${U.fmt(stone)}，灵气 +${U.fmt(spirit)}${matTxt}${gemTxt}${eqTxt}`;
      if (isBoss) {
        XG.State.addLog(`【${isElite ? '精英伏诛' : '妖王伏诛'}】${summary}`, 'epic');
        XG.Bus.emit('float', { text: isElite ? '精英伏诛！' : '妖王伏诛！', cls: 'epic' });
      } else {
        XG.Bus.emit('explore:win', { stone, herb, spirit, matTxt, eqTxt, zone: z.name });
        if (Math.random() < 0.30) XG.State.addLog(summary, 'battle');
      }
      XG.Bus.emit('float', { text: '+' + U.fmt(stone) + ' 灵石', cls: 'gold' });
    },

    settleLose(z) {
      const s = XG.State.s;
      const battle = Combat.last || Combat.active;
      const resumes = !!(battle && battle.opts.explore && battle.exploreResume);
      s.explore.losses++;
      const lost = XG.R.need(s.realm, s.layer) * 0.06;
      s.spirit = Math.max(0, s.spirit - lost);
      if (!resumes) Combat.setExploring(false);
      XG.State.addLog(resumes
        ? `在 <b>${z.name}</b> 遭遇强敌，你负伤退避，片刻后继续探索，灵气 −${U.fmt(lost)}。`
        : `在 <b>${z.name}</b> 遭遇强敌，你负伤而退，探索中断，灵气 −${U.fmt(lost)}。`, 'battle');
      XG.Bus.emit('explore:lose', { zone: z.name });
      if (!resumes) XG.Bus.emit('explore:stop');
    },

    rememberTower() {
      const t = XG.State.s && XG.State.s.tower;
      if (!t) return;
      const cleared = t.cleared && typeof t.cleared === 'object' ? Object.assign({}, t.cleared) : {};
      Combat._towerArchive = {
        best: Math.max(0, Number(t.best) || 0),
        floor: Math.max(1, Math.min(Number(t.floor) || 1, 999)),
        cleared,
      };
    },

    restoreTower() {
      const archive = Combat._towerArchive;
      const t = XG.State.s && XG.State.s.tower;
      if (!archive || !t) return;
      const current = t.cleared && typeof t.cleared === 'object' ? t.cleared : {};
      t.best = Math.max(Number(t.best) || 0, archive.best);
      t.floor = Math.max(Number(t.floor) || 1, archive.floor);
      t.cleared = Object.assign({}, archive.cleared, current);
      if (XG.State.s.stats) XG.State.s.stats.towerEver = Math.max(Number(XG.State.s.stats.towerEver) || 0, t.best);
      Combat.rememberTower();
    },

    /* 通天塔挑战 */
    challengeTower(floor) {
      const s = XG.State.s;
      if (!s.tower) return false;
      floor = Math.floor(Number(floor));
      if (!Number.isFinite(floor) || floor < 1 || floor > s.tower.best + 1) return false;
      if (!s.tower.cleared || typeof s.tower.cleared !== 'object') s.tower.cleared = {};
      if (s.tower.cleared[floor] || floor <= (Number(s.tower.best) || 0)) return false;
      Combat.rememberTower();
      const p = XG.State.Calc.playerStats();
      const e = Combat.towerEnemy(floor);
      const rw = Combat.towerReward(floor);
      const started = Combat.startBattle(p, {
        kind: 'tower', enemy: e, title: '通天塔 · 第' + floor + '层',
        onWin: () => {
          const ts = XG.State.s;
          if (!ts.tower) return;
          if (!ts.tower.cleared || typeof ts.tower.cleared !== 'object') ts.tower.cleared = {};
          if (ts.tower.cleared[floor] || floor <= (Number(ts.tower.best) || 0)) return;
          ts.tower.best = Math.max(ts.tower.best || 0, floor);
          ts.tower.cleared[floor] = true;
          ts.tower.floor = Math.max(ts.tower.floor || 1, Math.min(floor + 1, 999));
          Combat.rememberTower();
          const dr = XG.State.Calc.mods().dropRate || 1;
          XG.State.Res.gainJade(Math.floor(rw.jade * Math.max(1, XG.State.Calc.mods().jadeRate || 1)), true);
          XG.State.Res.gainStone(rw.stone, true);
          let lootTxt = '';
          const eq = Combat.genEquip(rw.equipBonus * dr, '通天塔' + floor + '层');
          XG.Economy.pickupEquip(eq);
          lootTxt += `「${eq.name}」`;
          const mats = XG.MATS.filter(m => m.q <= U.clamp(2 + Math.floor(floor / 9), 1, 6));
          const mm = U.pick(mats); const n = U.rndInt(1, 3 + Math.floor(floor / 8));
          XG.State.Res.gainMat(mm.id, n);
          lootTxt += `、${mm.name}×${n}`;
          if (U.chance(U.clamp(0.45 * dr, 0, 1))) {
            const g = U.pick(XG.GEMS);
            const tier = U.clamp(1 + Math.floor(floor / 12), 1, XG.GEM_MAX_TIER);
            XG.State.Res.gainGem(g.id, tier, 1);
            lootTxt += `、${g.icon}${g.name}(${tier}阶)`;
          }
          XG.State.addLog(`【通天塔】踏破第 <b>${floor}</b> 层！仙玉 +${rw.jade}，灵石 +${U.fmt(rw.stone)}，获得 ${lootTxt}`, 'epic');
          XG.Bus.emit('tower:win', floor);
        },
        onLose: () => {
          XG.State.addLog(`【通天塔】在第 ${floor} 层力竭败退，需再作准备。`, 'battle');
          XG.Bus.emit('tower:lose', floor);
        },
      });
      return !!started;
    },

    /* 兼容旧接口：转发到寻宝阁 */
    gacha(mode, times) {
      return XG.Gacha.pull(mode === 'equip' ? 'equip' : 'art', times || 1);
    },

    /* ══════ 神通 ══════ */
    skillUnlocked(id) {
      const sk = XG.idx.skill[id];
      return !!sk && sk.unlock <= XG.State.s.realm;
    },
    skillsUnlocked() {
      const r = XG.State.s.realm;
      return XG.SKILLS.filter(s => s.unlock <= r);
    },
    setSkill(idx, id) {
      const s = XG.State.s;
      if (idx < 0 || idx > 2) return { ok: false, reason: 'idx' };
      if (id) {
        if (!Combat.skillUnlocked(id)) return { ok: false, reason: 'lock' };
        const dup = s.skills.indexOf(id);
        if (dup >= 0 && dup !== idx) return { ok: false, reason: 'dup' };
      }
      s.skills[idx] = id || null;
      XG.Bus.emit('skill:change');
      return { ok: true };
    },
    /* 自动装配最强的三门已解锁神通 */
    autoSkills() {
      const s = XG.State.s;
      const list = Combat.skillsUnlocked().slice().sort((a, b) => b.priority - a.priority || b.unlock - a.unlock || a.cost - b.cost);
      const picked = [];
      const roles = {};
      for (const sk of list) {
        if (picked.length >= 3) break;
        if (!sk.role || roles[sk.role]) continue;
        roles[sk.role] = true;
        picked.push(sk.id);
      }
      while (picked.length < 3) picked.push(null);
      s.skills = picked;
      XG.Bus.emit('skill:change');
      return s.skills;
    },

    /* 「一秒收入」估值：用于把各类消耗表达成体感一致的时长 */
    stoneUnit() {
      const s = XG.State.s;
      return Math.max(1, baseAtkAt(s.realm) * 2.2 * XG.State.Calc.mods().stoneGain / XG.CONFIG.EXPLORE_STEP);
    },

    rollArt(maxQ, source) {
      const s = XG.State.s;
      maxQ = maxQ || U.clamp(1 + Math.floor(s.realm / 1.5), 1, 6);
      const pool = XG.ARTS.filter(a => !s.arts[a.id]);
      if (!pool.length) {
        // 全解锁 → 转化为灵石
        const st = Math.floor(baseAtkAt(s.realm) * 20 * XG.State.Calc.mods().stoneGain);
        XG.State.Res.gainStone(st, true);
        return { type: 'stone', stone: st };
      }
      const cand = pool.filter(a => a.q <= maxQ);
      const arr = (cand.length ? cand : pool).map(a => ({ ...a, w: 1 / Math.pow(2.1, a.q) }));
      const art = U.weighted(arr);
      s.arts[art.id] = { lv: 1 };
      XG.State.addLog(`【${source || '悟道'}】领悟功法 <b>《${art.name}》</b>（${U.QUALITY[art.q].name}）`, 'event');
      return { type: 'art', art };
    },
  };

  XG.Combat = Combat;
  const ascendGain = XG.State.Calc.ascendGain;
  XG.State.Calc.ascendGain = function () {
    Combat.rememberTower();
    return ascendGain.apply(this, arguments);
  };
  XG.Bus.on('ascend', () => Combat.restoreTower());
})();

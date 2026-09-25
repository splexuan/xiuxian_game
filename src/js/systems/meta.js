/* ═══════════════════════════════════════════
   meta.js — 成就 / 奇遇事件 / 飞升转生 / 仙缘天赋
   ═══════════════════════════════════════════ */
(function () {
  'use strict';
  const XG = window.XG;
  const U = XG.U;

  const META_KEEP = Object.freeze({
    state: Object.freeze([
      'perm', 'permBonus', 'gems', 'achievements', 'achBonus', 'pets', 'prestige', 'tower',
    ]),
    gacha: Object.freeze(['pity']),
    res: Object.freeze(['jade']),
    preferences: Object.freeze(['settings', 'battle']),
    meta: Object.freeze(['createdAt', 'totalPlayed']),
    stats: Object.freeze([
      'kills', 'bossKills', 'breakthroughs', 'breakthroughsFailed', 'tribulations',
      'pillsMade', 'pillsUsed', 'events', 'totalStone', 'totalSpirit', 'totalHerb',
      'deaths', 'playTime', 'meditates', 'forges', 'gemForges', 'enhances',
      'enhanceFails', 'rerolls', 'gachaPulls', 'skillsUsed', 'q3Made', 'zoneEvents',
      'eliteKills', 'omensSeen', 'questsDone', 'sockets', 'towerEver', 'ascendCount',
    ]),
  });

  function eventState(s) {
    return new Proxy(s, {
      get(target, key, receiver) {
        if (key === 'breakBonus') return XG.State.Calc.mods().breakBonus || 0;
        return Reflect.get(target, key, receiver);
      },
    });
  }

  function addSocketGems(gems, eq) {
    if (!eq || !Array.isArray(eq.sockets)) return;
    for (const gem of eq.sockets) {
      if (!gem || typeof gem.id !== 'string' || !Object.prototype.hasOwnProperty.call(XG.idx.gem, gem.id)) continue;
      const tier = Number(gem.tier);
      if (!Number.isInteger(tier) || tier < 1 || tier > XG.GEM_MAX_TIER) continue;
      const key = gem.id + '_' + tier;
      gems[key] = (Number(gems[key]) || 0) + 1;
    }
  }

  function validateAscendState(next, expected) {
    if (!next || typeof next !== 'object' || Array.isArray(next)) throw new TypeError('invalid ascend state');
    XG.State.normalizePets(next);
    const finite = n => typeof n === 'number' && Number.isFinite(n);
    if (!finite(next.res.jade) || next.res.jade < 0 || next.res.jade !== expected.jade) throw new TypeError('invalid ascend jade');
    if (!finite(next.prestige.times) || next.prestige.times !== expected.times) throw new TypeError('invalid ascend times');
    if (!finite(next.prestige.earned) || next.prestige.earned < expected.gain) throw new TypeError('invalid ascend earnings');
    if (!next.tower || !Number.isInteger(next.tower.best) || next.tower.best < 0) throw new TypeError('invalid ascend tower');
    if (!Number.isInteger(next.tower.floor) || next.tower.floor < 1) throw new TypeError('invalid ascend tower floor');
    if (!next.tower.cleared || typeof next.tower.cleared !== 'object' || Array.isArray(next.tower.cleared)) throw new TypeError('invalid ascend tower history');
    if (!finite(next.stats.towerEver) || next.stats.towerEver < next.tower.best) throw new TypeError('invalid tower history');
    if (next.explore.running !== expected.exploring) throw new TypeError('invalid explore state');
    for (const sl of XG.SLOTS) if (next.equip[sl.id] !== null) throw new TypeError('equipment was not reset');
    if (next.equipBag.length !== 0) throw new TypeError('equipment bag was not reset');
    const serialized = JSON.stringify(next);
    if (!serialized) throw new TypeError('ascend state is not serializable');
    return next;
  }

  /* ═════════════════════════════════════════
     成就
     ═════════════════════════════════════════ */
  const Achieve = {
    check() {
      const s = XG.State.s;
      let got = false;
      for (const ac of XG.ACHIEVEMENTS) {
        if (s.achievements[ac.id]) continue;
        let ok = false;
        try { ok = ac.cond(s); } catch (e) { ok = false; }
        if (!ok) continue;
        s.achievements[ac.id] = Date.now();
        for (const k in (ac.reward || {})) s.achBonus[k] = (s.achBonus[k] || 0) + ac.reward[k];
        got = true;
        XG.State.addLog(`【道果达成】${ac.icon} <b>${ac.name}</b> —— ${ac.desc}，永久加成已生效。`, 'epic');
        XG.Bus.emit('ach:done', ac);
      }
      if (got) XG.Bus.emit('ach:change');
      return got;
    },
    list() {
      const s = XG.State.s;
      return XG.ACHIEVEMENTS.map(a => ({ ...a, done: !!s.achievements[a.id] }));
    },
    count() { return Object.keys(XG.State.s.achievements).length; },
  };

  /* ═════════════════════════════════════════
     奇遇事件
     ═════════════════════════════════════════ */
  const Events = {
    _pending: null,

    /* 提供给事件脚本的操作接口 */
    api() {
      const s = XG.State.s;
      const Calc = XG.State.Calc;
      const modifiers = Calc.mods();
      const herbMultiplier = 1 + (Calc.petTotals().herbGain || 0);
      return {
        mods: () => Object.assign({}, modifiers, { herbGain: herbMultiplier }),
        herbMultiplier: () => herbMultiplier,
        herbGainMultiplier: herbMultiplier,
        breakBonus: () => modifiers.breakBonus || 0,
        breakBonusValue: modifiers.breakBonus || 0,
        state: eventState(s),
        gainSpirit(g, tag) {
          s.spirit = Math.min(Calc.need(), s.spirit + g);
          s.stats.totalSpirit += g;
          XG.Bus.emit('float', { text: '+' + U.fmt(g) + ' 灵气', cls: 'good' });
        },
        loseSpirit(g) {
          s.spirit = Math.max(0, s.spirit - g);
          XG.Bus.emit('float', { text: '-' + U.fmt(g) + ' 灵气', cls: 'bad' });
        },
        gainStone(n, tag) {
          XG.State.Res.gainStone(n, true);
          XG.Bus.emit('float', { text: '+' + U.fmt(n) + ' 灵石', cls: 'gold' });
        },
        gainHerb(n) { XG.State.Res.gainHerb(n, true); },
        gainJade(n) { XG.State.Res.gainJade(n, true); },
        gainMat(id, n) {
          XG.State.Res.gainMat(id, n);
          if (Number(n) > 0) {
            XG.Bus.emit('res:mat', { id, amount: n });
            XG.Bus.emit('mat:change', { id, delta: n });
          }
        },
        gainPill(id, n) {
          XG.State.Res.gainPill(id, n);
          if (Number(n) > 0) {
            XG.Bus.emit('res:pill', { id, amount: n });
            XG.Bus.emit('pill:change', { id, delta: n });
          }
        },
        dropEquip(bonus, label) {
          const eq = XG.Combat.genEquip(bonus, label);
          XG.Economy.pickupEquip(eq);
          return eq;
        },
        permanentBonus(kind, v) {
          if (kind === 'spirit') s.permBonus.spirit = (s.permBonus.spirit || 0) + v;
          XG.Bus.emit('perm:bonus');
        },
        log: (t, ty) => XG.State.addLog(t, ty),
        startEventBattle(kind) {
          if (XG.Combat.active || XG.Combat.last) throw new Error('战斗尚未结束');
          const p = Calc.playerStats();
          const zone = XG.Combat.zoneAt(XG.State.s.explore.zone) || XG.Combat.zoneAt(0);
          const e = XG.Combat.makeEnemy(zone.refR, zone.mult * 1.25, { name: '悍匪妖兽', icon: '👹', prefix: '' });
          Events._eventBattleResult = null;
          const started = XG.Combat.startBattle(p, {
            kind: 'event', enemy: e, title: '遭遇战',
            onWin: () => {
              const st = XG.baseAtkAt(zone.refR) * 4 * Calc.mods().stoneGain;
              const sp = XG.R.need(s.realm, s.layer) * 0.3;
              XG.State.Res.gainStone(st, true);
              s.spirit = Math.min(Calc.need(), s.spirit + sp);
              s.stats.kills++;
              Events._eventBattleResult = `力斩妖兽！灵石 +${U.fmt(st)}，灵气 +${U.fmt(sp)}`;
              XG.State.addLog(`【奇遇】${Events._eventBattleResult}`, 'battle');
            },
            onLose: () => {
              const l = XG.R.need(s.realm, s.layer) * 0.12;
              s.spirit = Math.max(0, s.spirit - l);
              Events._eventBattleResult = `你被妖兽击退，灵气 −${U.fmt(l)}`;
              XG.State.addLog(`【奇遇】${Events._eventBattleResult}`, 'battle');
            },
          });
          if (!started) {
            Events._eventBattleResult = null;
            throw new Error('战斗开启失败');
          }
          return '战斗开始！';
        },
      };
    },

    pool() {
      const s = XG.State.s;
      return XG.EVENTS.filter(e => s.realm >= (e.minRealm || 0));
    },

    triggerRandom(force) {
      const s = XG.State.s;
      if (Events._pending) return false;
      if (XG.Combat.active && !force) return false;
      const pool = Events.pool();
      if (!pool.length) return false;
      const ev = U.weighted(pool);
      s.stats.events++;
      Events._pending = ev;

      if (ev.apply) {
        const text = ev.apply(eventState(s), Events.api());
        XG.State.addLog(`【奇遇·${ev.name}】${text}`, 'event');
        XG.Bus.emit('event:auto', { ev, text });
        Events._pending = null;
        XG.Bus.emit('float', { text: ev.icon + ' ' + ev.name, cls: 'epic' });
        return true;
      }
      XG.Bus.emit('event:show', { ev });
      XG.Bus.emit('float', { text: ev.icon + ' ' + ev.name, cls: 'epic' });
      return true;
    },

    choiceCost(ev, ch) {
      const raw = ch && ch.cost && typeof ch.cost === 'object' ? ch.cost : {};
      let pillRaw = raw.pillId || raw.pill || (ch && (ch.pillId || ch.pill)) || null;
      const legacyPill = !pillRaw && ch && typeof ch.title === 'string' && ch.title.includes('服丹');
      if (legacyPill) pillRaw = 'p_ningshen';
      let pill = null;
      let pillN = 1;
      if (typeof pillRaw === 'string') pill = pillRaw;
      else if (typeof pillRaw === 'number' && isFinite(pillRaw)) {
        pill = 'p_ningshen';
        pillN = Math.max(1, Math.floor(pillRaw));
      } else if (pillRaw && typeof pillRaw === 'object') {
        pill = pillRaw.id || pillRaw.pillId || null;
        pillN = Math.max(1, Math.floor(Number(pillRaw.n || pillRaw.count) || 1));
      }
      return {
        jade: Math.max(0, Number(raw.jade) || 0),
        stone: legacyPill ? 0 : Math.max(0, Number(raw.stone) || 0),
        stoneFactor: Math.max(0, Number(raw.stoneFactor) || 0),
        pill,
        pillN: pill ? Math.max(1, Math.floor(Number(raw.pillN || raw.pillCount) || pillN)) : 0,
      };
    },

    inventorySnapshot(s) {
      return {
        res: Object.assign({}, s.res),
        pills: Object.assign({}, s.pills),
        mats: Object.assign({}, s.mats),
      };
    },

    restoreInventory(s, snapshot) {
      for (const key of ['res', 'pills', 'mats']) {
        for (const id of Object.keys(s[key])) delete s[key][id];
        Object.assign(s[key], snapshot[key]);
      }
    },

    emitResourceChanges(s, snapshot) {
      for (const key of ['stone', 'herb', 'jade']) {
        const delta = (s.res[key] || 0) - (snapshot.res[key] || 0);
        if (delta) XG.Bus.emit('res:' + key, delta);
      }
    },

    /* 玩家选择 */
    choose(ev, idx) {
      const s = XG.State.s;
      const ch = idx >= 0 ? ev.choices[idx] : null;
      if (!ch) {
        Events._pending = null;
        XG.Bus.emit('event:close');
        return null;
      }

      const snapshot = Events.inventorySnapshot(s);
      try {
        const api = Events.api();
        const cost = Events.choiceCost(ev, ch);
        const factorStone = cost.stoneFactor > 0
          ? Math.ceil(XG.baseAtkAt(s.realm) * 30 * cost.stoneFactor * api.mods().stoneGain)
          : 0;
        if (cost.jade > 0 && s.res.jade < cost.jade) return { ok: false, reason: '仙玉不足' };
        if (cost.stone > 0 && s.res.stone < cost.stone) return { ok: false, reason: '灵石不足' };
        if (factorStone > 0 && s.res.stone - cost.stone < factorStone) {
          return { ok: false, reason: '灵石不足（需 ' + U.fmt(cost.stone + factorStone) + '）' };
        }
        if (cost.pill && (s.pills[cost.pill] || 0) < cost.pillN) {
          const def = XG.idx.pill[cost.pill];
          return { ok: false, reason: (def ? def.name : '丹药') + '不足' };
        }
        if (cost.jade > 0 && !XG.State.Res.spendJade(cost.jade)) throw new Error('仙玉扣除失败');
        if (cost.stone > 0 && !XG.State.Res.spendStone(cost.stone)) throw new Error('灵石扣除失败');
        if (factorStone > 0 && !XG.State.Res.spendStone(factorStone)) throw new Error('灵石扣除失败');
        if (cost.pill && !XG.State.Res.usePill(cost.pill, cost.pillN)) throw new Error('丹药扣除失败');

        const result = ch.run(eventState(s), api);
        if (result === false || (result && typeof result === 'object' && result.ok === false)) {
          throw new Error(result && result.reason ? result.reason : '选择执行失败');
        }
        const text = result || '';
        Events.emitResourceChanges(s, snapshot);
        if (cost.pill) {
          const def = XG.idx.pill[cost.pill];
          XG.Bus.emit('res:pill', { id: cost.pill, delta: -cost.pillN });
          XG.Bus.emit('pill:change', { id: cost.pill, delta: -cost.pillN });
          XG.Bus.emit('pill:used', { pill: def, count: cost.pillN, source: 'event' });
        }
        Events._pending = null;
        XG.Bus.emit('event:result', { ev, text, title: ch.title });
        return { ok: true, text };
      } catch (e) {
        Events.restoreInventory(s, snapshot);
        Events.emitResourceChanges(s, snapshot);
        return { ok: false, reason: e && e.message ? e.message : '选择执行失败' };
      }
    },

    close() { Events._pending = null; XG.Bus.emit('event:close'); },
  };

  /* ═════════════════════════════════════════
     飞升转生
     ═════════════════════════════════════════ */
  const Prestige = {
    ascendCost(gain) {
      gain = gain === undefined ? XG.State.Calc.ascendGain() : gain;
      const configured = Number(XG.CONFIG.ASCEND_JADE_PER);
      const rate = Number.isFinite(configured) && configured >= 0 ? configured : 0;
      return Math.max(0, Math.ceil(Math.max(0, gain) * rate));
    },

    canAscend() {
      const s = XG.State.s;
      if (XG.Combat.active || XG.Combat.last) return false;
      if (s.realm < XG.CONFIG.ASCEND_MIN_REALM) return false;
      const gain = XG.State.Calc.ascendGain();
      return gain > 0 && s.res.jade >= Prestige.ascendCost(gain);
    },

    preview() {
      const s = XG.State.s;
      const gain = XG.State.Calc.ascendGain();
      return {
        gain,
        jadeCost: Prestige.ascendCost(gain),
        realmName: XG.REALMS[s.realm].name,
        level: XG.R.totalLevel(s.realm, s.layer),
        tower: s.tower.best,
        ach: Object.keys(s.achievements).length,
        spiritMult: 1 + (s.prestige.earned + gain) * 0.07,
        atkMult: 1 + (s.prestige.earned + gain) * 0.06,
        hpMult: 1 + (s.prestige.earned + gain) * 0.06,
      };
    },

    ascend() {
      const s = XG.State.s;
      if (XG.Combat.active || XG.Combat.last) return { ok: false, reason: 'combat' };
      if (s.realm < XG.CONFIG.ASCEND_MIN_REALM) return { ok: false, reason: 'realm' };
      const gain = XG.State.Calc.ascendGain();
      if (gain <= 0) return { ok: false, reason: 'gain' };
      const jadeCost = Prestige.ascendCost(gain);
      if (s.res.jade < jadeCost) return { ok: false, reason: 'jade', cost: jadeCost };
      const wasExploring = s.explore.running === true;
      let fresh;

      try {
        const keep = { state: {}, gacha: {}, res: {}, preferences: {}, meta: {}, stats: {} };
        for (const key of META_KEEP.state) keep.state[key] = U.clone(s[key]);
        for (const key of META_KEEP.gacha) keep.gacha[key] = U.clone(s.gacha[key]);
        for (const key of META_KEEP.res) keep.res[key] = s.res[key];
        for (const key of META_KEEP.preferences) keep.preferences[key] = U.clone(s[key]);
        for (const key of META_KEEP.meta) keep.meta[key] = s.meta[key];
        for (const key of META_KEEP.stats) {
          const value = Number(s.stats[key]);
          keep.stats[key] = Number.isFinite(value) ? value : 0;
        }
        keep.state.prestige.times += 1;
        keep.state.prestige.earned += gain;
        keep.stats.towerEver = Math.max(keep.stats.towerEver, Number(s.tower.best) || 0);
        keep.stats.ascendCount = Math.max(keep.stats.ascendCount + 1, keep.state.prestige.times);

        for (const sl of XG.SLOTS) addSocketGems(keep.state.gems, s.equip[sl.id]);
        for (const eq of s.equipBag) addSocketGems(keep.state.gems, eq);

        fresh = XG.State.fresh();
        for (const key of META_KEEP.state) fresh[key] = keep.state[key];
        fresh.gacha = Object.assign(fresh.gacha, keep.gacha);
        fresh.res.jade = Math.max(0, Math.floor(keep.res.jade - jadeCost));
        for (const key of META_KEEP.preferences) fresh[key] = keep.preferences[key];
        for (const key of META_KEEP.meta) fresh.meta[key] = keep.meta[key];
        fresh.stats = keep.stats;
        fresh.explore.running = wasExploring;
        if (wasExploring) fresh.settings.autoExplore = true;
        fresh.log = U.clone(s.log.slice(-25));
        validateAscendState(fresh, { jade: fresh.res.jade, times: keep.state.prestige.times, gain, exploring: wasExploring });
      } catch (e) {
        return { ok: false, reason: 'state', error: e };
      }

      try {
        XG.State.set(fresh);
      } catch (e) {
        return { ok: false, reason: 'state', error: e };
      }
      XG.State.addLog(`【飞升】天道垂青，你斩断此世因果，重返凡尘。消耗仙玉 ${jadeCost}，获得仙缘点 <b>${gain}</b>（累计 ${fresh.prestige.earned}）`, 'epic');
      XG.Bus.emit('ascend', { gain, jadeCost });
      const saved = XG.State.Save.save(true);
      return { ok: true, gain, jadeCost, saved };
    },

    /* 可用（未花费）仙缘点 */
    freePoints() {
      const p = XG.State.s.prestige;
      return Math.max(0, p.earned - p.spent);
    },

    talentCost(id) {
      const lv = XG.State.s.prestige.talents[id] || 0;
      return Math.floor(1 + lv * 1.6);
    },

    buyTalent(id) {
      const s = XG.State.s;
      const def = XG.TALENTS.find(x => x.id === id);
      if (!def) return { ok: false };
      const lv = s.prestige.talents[id] || 0;
      if (lv >= def.max) return { ok: false, reason: 'max' };
      const cost = Prestige.talentCost(id);
      const free = Prestige.freePoints();
      if (free < cost) return { ok: false, reason: 'point', cost, free };
      s.prestige.talents[id] = lv + 1;
      s.prestige.spent += cost;
      XG.State.addLog(`【仙缘】以 ${cost} 点仙缘点强化 <b>${def.name}</b> 至 ${lv + 1} 级`, 'epic');
      XG.Bus.emit('talent:up', { id, lv: lv + 1 });
      return { ok: true, lv: lv + 1, cost };
    },
  };

  XG.Achieve = Achieve;
  XG.Events = Events;
  XG.Prestige = Prestige;
  XG.META_KEEP = META_KEEP;
  XG.State.META_KEEP = META_KEEP;
})();

/* ═══════════════════════════════════════════
   gacha.js — 寻宝阁（抽卡）：问道 / 寻宝 / 御兽 / 采药
   含保底机制、十连折扣与结果分级
   ═══════════════════════════════════════════ */
(function () {
  'use strict';
  const XG = window.XG;
  const U = XG.U;

  const Gacha = {
    pools() { return Object.keys(XG.GACHA_POOLS).map(id => XG.GACHA_POOLS[id]); },
    def(poolId) { return XG.GACHA_POOLS[poolId]; },
    pityContract(poolId) {
      const pool = Gacha.def(poolId);
      return pool && pool.pity && pool.pity.n > 0 ? pool.pity : null;
    },

    /* ══════ 消耗计算 ══════ */
    unitCost(pool) {
      if (pool.cur === 'stone') {
        const s = XG.State.s;
        return Math.max(1, XG.baseAtkAt(s.realm) * (pool.costFactor || 40) * XG.State.Calc.mods().stoneGain);
      }
      return pool.cost;
    },

    cost(poolId, times) {
      const pool = Gacha.def(poolId);
      if (!pool) return Infinity;
      times = times || 1;
      if (pool.cur === 'stone') {
        const unit = Gacha.unitCost(pool);
        if (times >= 10) return Math.ceil(unit * (pool.cost10Factor || pool.costFactor * 10) * (times / 10));
        return Math.ceil(unit * times);
      }
      if (times >= 10) return Math.ceil(pool.cost10 * (times / 10));
      return pool.cost * times;
    },

    canPull(poolId, times) {
      const pool = Gacha.def(poolId);
      if (!pool) return { ok: false, reason: 'none' };
      const cost = Gacha.cost(poolId, times || 1);
      const have = pool.cur === 'jade' ? XG.State.s.res.jade : XG.State.s.res.stone;
      if (have < cost) return { ok: false, reason: pool.cur, cost, have };
      return { ok: true, cost };
    },

    /* ══════ 保底状态 ══════ */
    pityLeft(poolId) {
      const pity = Gacha.pityContract(poolId);
      const g = XG.State.s.gacha;
      if (!pity) return 0;
      return Math.max(0, pity.n - (g.pity[poolId] || 0));
    },

    /* ═════════════════════════════════════════
       单次抽取
       ═════════════════════════════════════════ */
    pullOne(poolId, guarantee) {
      const s = XG.State.s;
      const Calc = XG.State.Calc;
      if (typeof guarantee === 'number') {
        guarantee = guarantee === -1 ? { type: 'gem', tierBonus: 1 } : { type: 'quality', minQ: guarantee };
      }
      guarantee = guarantee && guarantee.type ? guarantee : null;
      const pity = Gacha.pityContract(poolId);

      if (poolId === 'art') {
        const maxQ = U.clamp(1 + Math.floor(s.realm / 1.4), 1, 6);
        const unowned = XG.ARTS.filter(a => !s.arts[a.id]);
        if (!unowned.length) {
          const st = Math.floor(XG.baseAtkAt(s.realm) * 60 * Calc.mods().stoneGain);
          XG.State.Res.gainStone(st, true);
          return { type: 'stone', stone: st, q: 1, name: '道藏已尽·化灵石', pityHit: false };
        }
        const floorQ = pity && pity.type === 'quality' ? pity.minQ : null;
        let cand = unowned.filter(a => a.q <= maxQ);
        if (guarantee && guarantee.type === 'quality') {
          const hi = unowned.filter(a => a.q >= floorQ);
          if (hi.length) cand = hi;
        }
        if (!cand.length) cand = unowned;
        const pick = U.weighted(cand.map(a => ({ ...a, w: 1 / Math.pow(2.1, a.q) })));
        const pityHit = floorQ !== null && pick.q >= floorQ;
        s.arts[pick.id] = { lv: 1 };
        XG.Bus.emit('art:up', { id: pick.id, lv: 1 });
        return { type: 'art', art: pick, q: pick.q, name: pick.name, pityHit, guaranteed: !!guarantee && pityHit };
      }

      if (poolId === 'equip') {
        const floorQ = pity && pity.type === 'quality' ? pity.minQ : null;
        const forcedQ = guarantee && guarantee.type === 'quality' ? guarantee.minQ : null;
        const bonus = forcedQ === null ? 0.75 : 2.2 + forcedQ * 0.4;
        const eq = XG.Combat.genEquip(bonus, '寻宝阁', forcedQ === null ? undefined : { q: forcedQ });
        const pityHit = floorQ !== null && eq.q >= floorQ;
        XG.Economy.pickupEquip(eq);
        return { type: 'equip', eq, q: eq.q, name: eq.name, pityHit, guaranteed: !!guarantee && pityHit };
      }

      if (poolId === 'pet') {
        let un = XG.Pets.unowned();
        const lo = un.filter(p => p.q <= U.clamp(1 + Math.floor(s.realm / 1.6), 1, 6));
        if (lo.length) un = lo;
        if (!un.length) {
          const tier = U.clamp(1 + Math.floor(s.realm / 3), 1, XG.GEM_MAX_TIER);
          const g = U.pick(XG.GEMS);
          XG.State.Res.gainGem(g.id, tier, 1);
          const st = Math.floor(XG.baseAtkAt(s.realm) * 50 * Calc.mods().stoneGain);
          XG.State.Res.gainStone(st, true);
          return { type: 'gem', gem: g, tier, n: 1, q: 3, name: `${g.name}(${tier}阶)`, pityHit: false };
        }
        const pick = U.weighted(un.map(p => ({ ...p, w: 1 / Math.pow(2.2, p.q) })));
        XG.Pets.grant(pick.id);
        return { type: 'pet', pet: pick, q: pick.q, name: pick.name, pityHit: true, guaranteed: !!guarantee };
      }

      const rollGem = bonus => {
        let tier = U.clamp(1 + Math.floor(s.realm / 4) + (bonus || 0), 1, XG.GEM_MAX_TIER);
        const g = U.pick(XG.GEMS);
        const n = U.rndInt(1, 2);
        XG.State.Res.gainGem(g.id, tier, n);
        return { type: 'gem', gem: g, tier, n, q: Math.min(6, tier + 1), name: `${g.name}(${tier}阶)×${n}`, pityHit: true, guaranteed: !!guarantee };
      };
      if (guarantee && guarantee.type === 'gem') return rollGem(guarantee.tierBonus || 0);

      const r = Math.random();
      if (r < 0.42) {
        const pool = XG.MATS.filter(m => m.q <= U.clamp(1 + Math.floor(s.realm * 0.9), 1, 6));
        const m = U.weighted(pool.map(x => ({ ...x, w: 1 / Math.pow(1.8, x.q) })));
        const n = U.rndInt(2, 6);
        XG.State.Res.gainMat(m.id, n);
        return { type: 'mat', mat: m, n, q: m.q, name: `${m.name}×${n}`, pityHit: false };
      }
      if (r < 0.72) {
        const amt = Math.floor(U.rnd(120, 600) * (1 + s.realm * 1.4) * (1 + Calc.mods().herbGain));
        XG.State.Res.gainHerb(amt, true);
        return { type: 'herb', n: amt, q: 1, name: `灵草×${U.fmt(amt)}`, pityHit: false };
      }
      return rollGem(0);
    },

    /* ═════════════════════════════════════════
       抽卡主入口
       ═════════════════════════════════════════ */
    pull(poolId, times) {
      const pool = Gacha.def(poolId);
      if (!pool) return { ok: false, reason: 'none' };
      times = times || 1;
      const can = Gacha.canPull(poolId, times);
      if (!can.ok) return can;

      const s = XG.State.s;
      if (pool.cur === 'jade') XG.State.Res.spendJade(can.cost);
      else XG.State.Res.spendStone(can.cost);

      const out = [];
      const pity = Gacha.pityContract(poolId);
      for (let i = 0; i < times; i++) {
        const g = s.gacha;
        g.pity[poolId] = (g.pity[poolId] || 0) + 1;
        g.total[poolId] = (g.total[poolId] || 0) + 1;
        s.stats.gachaPulls = (s.stats.gachaPulls || 0) + 1;

        const due = !!pity && g.pity[poolId] >= pity.n;
        const r = Gacha.pullOne(poolId, due ? { ...pity } : null);
        if (r.pityHit) g.pity[poolId] = 0;
        out.push(r);
      }

      s.lastPulls = out;
      const best = out.reduce((a, b) => (b.q > a.q ? b : a), out[0]);
      const costTxt = pool.cur === 'jade' ? `仙玉 ${can.cost}` : `灵石 ${U.fmt(can.cost)}`;
      XG.State.addLog(`【寻宝阁·${pool.name}】${pool.cur === 'jade' ? '仙玉' : '灵石'} −${pool.cur === 'jade' ? can.cost : U.fmt(can.cost)}，${times} 次寻宝，最佳：<b>${U.QUALITY[U.clamp(best.q, 0, 6)].name} ${best.name}</b>`, 'event');
      XG.Bus.emit('gacha:result', { pool: poolId, out, cost: can.cost, cur: pool.cur });
      if (best.q >= 4) XG.Bus.emit('float', { text: U.QUALITY[best.q].name + ' ' + best.name, cls: 'epic' });
      return { ok: true, out, cost: can.cost, cur: pool.cur, costTxt };
    },

    /* 各池展示用概率信息 */
    info(poolId) {
      const pool = Gacha.def(poolId);
      if (!pool) return null;
      return {
        name: pool.name, icon: pool.icon, color: pool.color, desc: pool.desc,
        cur: pool.cur,
        single: Gacha.cost(poolId, 1),
        ten: Gacha.cost(poolId, 10),
        pityLeft: Gacha.pityLeft(poolId),
        pity: pool.pity,
        total: XG.State.s.gacha.total[poolId] || 0,
      };
    },
  };

  XG.Gacha = Gacha;
})();

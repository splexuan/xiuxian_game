/* ═══════════════════════════════════════════
   forge.js — 锻炉：强化 / 合成升品 / 重铸 / 镶嵌 / 材料与宝石合成
   ═══════════════════════════════════════════ */
(function () {
  'use strict';
  const XG = window.XG;
  const U = XG.U;
  const CFG = XG.FORGE_CFG;

  /* 「一秒收入」的估值单位，用于把消耗表达成「约 N 秒的收益」，
     这样无论处于哪个境界，投入体感都是一致的。 */
  function incomeUnit() { return XG.Combat.stoneUnit(); }

  const Forge = {
    unit: incomeUnit,

    /* ══════ 通用查询 ══════ */
    find(id) {
      const s = XG.State.s;
      for (const sl of XG.SLOTS) {
        const e = s.equip[sl.id];
        if (e && e.id === id) return { eq: e, where: 'equip', slot: sl.id };
      }
      const i = s.equipBag.findIndex(e => e.id === id);
      if (i >= 0) return { eq: s.equipBag[i], where: 'bag', index: i };
      return null;
    },

    /* 已镶嵌宝石总数 */
    gemCount() {
      const s = XG.State.s;
      let n = 0;
      for (const sl of XG.SLOTS) {
        const e = s.equip[sl.id];
        if (!e || !e.sockets) continue;
        for (const g of e.sockets) if (g) n++;
      }
      for (const e of s.equipBag) {
        if (!e.sockets) continue;
        for (const g of e.sockets) if (g) n++;
      }
      return n;
    },

    /* 库存宝石列表（按阶降序） */
    gemList() {
      const s = XG.State.s;
      const out = [];
      for (const k in s.gems) {
        const n = s.gems[k];
        if (!n) continue;
        const i = k.lastIndexOf('_');
        const id = k.slice(0, i), tier = parseInt(k.slice(i + 1), 10) || 1;
        const def = XG.idx.gem[id];
        if (!def) continue;
        out.push({ key: k, id, tier, n, def });
      }
      out.sort((a, b) => b.tier - a.tier || a.def.name.localeCompare(b.def.name));
      return out;
    },

    /* ═════════════════════════════════════════
       一、装备强化
       ═════════════════════════════════════════ */
    enhanceCost(eq) {
      const lv = eq.enh || 0;
      const secs = 12 + lv * 14 + (eq.score || 1) * 20;
      return Math.ceil(incomeUnit() * secs);
    },
    enhanceChance(eq) { return CFG.enhanceChance(eq.enh || 0); },

    enhance(id) {
      const found = Forge.find(id);
      if (!found) return { ok: false, reason: 'none' };
      const eq = found.eq;
      const lv = eq.enh || 0;
      if (lv >= CFG.ENHANCE_MAX) return { ok: false, reason: 'max' };
      const cost = Forge.enhanceCost(eq);
      if (!XG.State.Res.spendStone(cost)) return { ok: false, reason: 'stone', cost };
      const s = XG.State.s;
      s.stats.enhances = (s.stats.enhances || 0) + 1;
      const chance = Forge.enhanceChance(eq);
      if (U.chance(chance)) {
        eq.enh = lv + 1;
        XG.Combat.recalc(eq);
        XG.State.addLog(`【锻炉】<b>${eq.name}</b> 强化成功 → +${eq.enh}（消耗灵石 ${U.fmt(cost)}）`, 'gain');
        XG.Bus.emit('forge', { kind: 'enhance', eq, ok: true });
      } else {
        s.stats.enhanceFails = (s.stats.enhanceFails || 0) + 1;
        XG.State.addLog(`【锻炉】<b>${eq.name}</b> 强化失败，灵材尽毁（+${lv} 保持不变）`, 'battle');
        XG.Bus.emit('forge', { kind: 'enhance', eq, ok: false });
      }
      XG.Bus.emit('equip:change', eq);
      return { ok: true, success: !!eq.enh && eq.enh > lv, enh: eq.enh, cost, chance };
    },

    /* ═════════════════════════════════════════
       二、装备合成升品（三合一）
       ═════════════════════════════════════════ */
    MERGE_NEED: 3,

    mergePool(slot, q) {
      const s = XG.State.s;
      const out = [];
      for (const e of s.equipBag) if (e.slot === slot && e.q === q) out.push(e);
      const eq = s.equip[slot];
      if (eq && eq.q === q) out.push(eq);
      return out;
    },

    canMerge(slot, q) {
      if (q >= 6) return false;
      return Forge.mergePool(slot, q).length >= Forge.MERGE_NEED;
    },

    mergeCost(q) {
      return Math.ceil(incomeUnit() * (18 + q * 26));
    },

    merge(slot, q) {
      if (!Forge.canMerge(slot, q)) return { ok: false, reason: 'lack' };
      const cost = Forge.mergeCost(q);
      if (!XG.State.Res.spendStone(cost)) return { ok: false, reason: 'stone', cost };
      const s = XG.State.s;
      const pool = Forge.mergePool(slot, q);
      // 优先消耗背包中评分最低的，保护身上的装备
      pool.sort((a, b) => (a.enh || 0) - (b.enh || 0) || a.score - b.score);
      const used = pool.slice(0, Forge.MERGE_NEED);
      let keepEnh = 0;
      for (const e of used) {
        keepEnh = Math.max(keepEnh, e.enh || 0);
        XG.Equip.destroy(e, { reason: 'merge' });
      }
      const eq = XG.Combat.genEquip(0, '锻炉合成', {
        slot, q: q + 1, keepEnh: Math.max(0, keepEnh - 1),
      });
      XG.Economy.pickupEquip(eq);
      s.stats.forges = (s.stats.forges || 0) + 1;
      if (q + 1 >= 3) s.stats.q3Made = (s.stats.q3Made || 0) + 1;
      XG.State.addLog(`【锻炉】三件${U.QUALITY[q].name}装备熔炼，铸成 <b>${U.QUALITY[q + 1].name}「${eq.name}」</b>`, 'epic');
      XG.Bus.emit('forge', { kind: 'merge', eq });
      XG.Bus.emit('loot', { eq, from: '锻炉合成' });
      XG.Bus.emit('equip:change', null);
      return { ok: true, eq, cost };
    },

    /* ═════════════════════════════════════════
       三、词条重铸
       ═════════════════════════════════════════ */
    rerollCost(eq) {
      return Math.ceil(incomeUnit() * (14 + eq.q * 18));
    },

    reroll(id) {
      const found = Forge.find(id);
      if (!found) return { ok: false, reason: 'none' };
      const eq = found.eq;
      const cost = Forge.rerollCost(eq);
      if (!XG.State.Res.spendStone(cost)) return { ok: false, reason: 'stone', cost };
      const cfg = XG.Combat.SLOT_ROLL ? XG.Combat.SLOT_ROLL[eq.slot] : null;
      if (!cfg) return { ok: false, reason: 'slot' };
      const main = cfg.main;
      const power = eq.stats[main] || 1;
      const nSub = eq.q >= 6 ? 4 : eq.q >= 4 ? 3 : eq.q >= 2 ? 2 : 1;
      const subs = U.sample(cfg.subs, Math.min(nSub, cfg.subs.length));
      const stats = {};
      stats[main] = power;
      for (const [k, lo, hi] of subs) stats[k] = (stats[k] || 0) + U.rnd(lo, hi) * (0.6 + power * 0.55);
      // 与旧词条对比，保留更优者（避免重铸越洗越差）
      const oldScore = eq.score;
      eq.stats = stats;
      XG.Combat.recalc(eq);
      if (eq.score < oldScore * 0.75) {
        // 太差则再洗一次，保证不出现“纯亏”
        const s2 = {};
        s2[main] = power;
        for (const [k, lo, hi] of subs) s2[k] = (s2[k] || 0) + U.rnd(lo, hi) * (0.75 + power * 0.62);
        eq.stats = s2;
        XG.Combat.recalc(eq);
      }
      const s = XG.State.s;
      s.stats.rerolls = (s.stats.rerolls || 0) + 1;
      XG.State.addLog(`【锻炉】重铸 <b>${eq.name}</b> 词条（评分 ${U.fmt(oldScore)} → ${U.fmt(eq.score)}）`, 'gain');
      XG.Bus.emit('forge', { kind: 'reroll', eq });
      XG.Bus.emit('equip:change', eq);
      return { ok: true, eq, cost, before: oldScore, after: eq.score };
    },

    /* ═════════════════════════════════════════
       四、材料合成（三合一升阶）
       ═════════════════════════════════════════ */
    MAT_NEED: 3,
    matCanUp(m) { return m.q < 6; },
    matUpgrade(matId) {
      const m = XG.idx.mat[matId];
      if (!m || m.q >= 6) return { ok: false, reason: 'max' };
      const s = XG.State.s;
      if ((s.mats[matId] || 0) < Forge.MAT_NEED) return { ok: false, reason: 'lack' };
      const higher = XG.MATS.filter(x => x.q === m.q + 1);
      if (!higher.length) return { ok: false, reason: 'none' };
      const cost = Math.ceil(incomeUnit() * 10 * m.q);
      if (!XG.State.Res.spendStone(cost)) return { ok: false, reason: 'stone', cost };
      XG.State.Res.useMat(matId, Forge.MAT_NEED);
      const to = U.pick(higher);
      XG.State.Res.gainMat(to.id, 1);
      s.stats.forges = (s.stats.forges || 0) + 1;
      XG.State.addLog(`【锻炉】${m.name}×3 合炼为 <b>${to.icon}${to.name}</b>`, 'gain');
      XG.Bus.emit('forge', { kind: 'mat', mat: to });
      return { ok: true, to, cost };
    },

    /* ═════════════════════════════════════════
       五、宝石合成（三合一升阶）
       ═════════════════════════════════════════ */
    GEM_NEED: 3,
    gemMerge(id, tier) {
      if (tier >= XG.GEM_MAX_TIER) return { ok: false, reason: 'max' };
      const s = XG.State.s;
      const k = id + '_' + tier;
      if ((s.gems[k] || 0) < Forge.GEM_NEED) return { ok: false, reason: 'lack' };
      const cost = Math.ceil(incomeUnit() * 12 * tier);
      if (!XG.State.Res.spendStone(cost)) return { ok: false, reason: 'stone', cost };
      XG.State.Res.useGem(id, tier, Forge.GEM_NEED);
      XG.State.Res.gainGem(id, tier + 1, 1);
      const def = XG.idx.gem[id];
      s.stats.gemForges = (s.stats.gemForges || 0) + 1;
      XG.State.addLog(`【锻炉】${def.icon}${def.name}×3 合成为 <b>${tier + 1} 阶</b>`, 'gain');
      XG.Bus.emit('forge', { kind: 'gem', id, tier: tier + 1 });
      return { ok: true, id, tier: tier + 1, cost };
    },

    /* ═════════════════════════════════════════
       六、镶嵌 / 取下
       ═════════════════════════════════════════ */
    socketFree(eq) {
      if (!eq.sockets) return -1;
      return eq.sockets.findIndex(g => !g);
    },
    openSlots(eq) { return eq.sockets ? eq.sockets.filter(g => !g).length : 0; },

    socket(eqId, gemKey) {
      const found = Forge.find(eqId);
      if (!found) return { ok: false, reason: 'none' };
      const eq = found.eq;
      const idx = Forge.socketFree(eq);
      if (idx < 0) return { ok: false, reason: 'full' };
      const i = gemKey.lastIndexOf('_');
      const id = gemKey.slice(0, i), tier = parseInt(gemKey.slice(i + 1), 10) || 1;
      const def = XG.idx.gem[id];
      if (!def) return { ok: false, reason: 'none' };
      if (!XG.State.Res.useGem(id, tier, 1)) return { ok: false, reason: 'lack' };
      eq.sockets[idx] = { id, tier };
      XG.Combat.recalc(eq);
      const s = XG.State.s;
      s.stats.sockets = (s.stats.sockets || 0) + 1;
      const val = def.val * Math.pow(XG.GEM_TIER_MULT, tier - 1);
      XG.State.addLog(`【锻炉】为 <b>${eq.name}</b> 镶嵌 ${def.icon}${def.name}(${tier}阶)：${def.name} +${(val * 100).toFixed(1)}%`, 'gain');
      XG.Bus.emit('forge', { kind: 'socket', eq, stat: def.stat, val });
      XG.Bus.emit('equip:change', eq);
      return { ok: true, eq, stat: def.stat, val };
    },

    unsocket(eqId, idx) {
      const found = Forge.find(eqId);
      if (!found) return { ok: false, reason: 'none' };
      const eq = found.eq;
      const g = eq.sockets && eq.sockets[idx];
      if (!g) return { ok: false, reason: 'empty' };
      const cost = Math.ceil(incomeUnit() * 8);
      if (!XG.State.Res.spendStone(cost)) return { ok: false, reason: 'stone', cost };
      XG.State.Res.gainGem(g.id, g.tier, 1);
      eq.sockets[idx] = null;
      XG.Combat.recalc(eq);
      XG.Bus.emit('equip:change', eq);
      return { ok: true, eq, cost };
    },

    /* 一键镶嵌：把背包中最好的宝石塞进所有空孔 */
    autoSocket() {
      let n = 0;
      const list = Forge.gemList();
      for (const sl of XG.SLOTS) {
        const eq = XG.State.s.equip[sl.id];
        if (!eq) continue;
        let free = Forge.socketFree(eq);
        while (free >= 0) {
          const g = list.find(x => x.n > 0);
          if (!g) return n;
          const r = Forge.socket(eq.id, g.key);
          if (!r.ok) break;
          g.n--;
          n++;
          free = Forge.socketFree(eq);
        }
      }
      if (n > 0) XG.State.addLog(`【锻炉】自动镶嵌 ${n} 颗宝石。`, 'gain');
      return n;
    },

    /* 可合成的装备列表（按部位与品质分组） */
    mergeTargets() {
      const s = XG.State.s;
      const out = [];
      for (const sl of XG.SLOTS) {
        for (let q = 0; q <= 5; q++) {
          const pool = Forge.mergePool(sl.id, q);
          if (pool.length >= Forge.MERGE_NEED) {
            out.push({ slot: sl.id, slotName: sl.name, q, have: pool.length, cost: Forge.mergeCost(q) });
          }
        }
      }
      return out;
    },
  };

  XG.Forge = Forge;
})();

/* ═══════════════════════════════════════════
   economy.js — 洞天 / 功法 / 炼丹 / 装备 / 背包
   ═══════════════════════════════════════════ */
(function () {
  'use strict';
  const XG = window.XG;
  const U = XG.U;

  const BAG_LIMIT = 80;
  const SALE_WEIGHTS = { atk: 1, hp: 0.9, def: 1.1, crit: 14, critDmg: 6, dodge: 16, spd: 16, lifesteal: 20, pen: 14, spirit: 1 };

  function baseEquipScore(eq) {
    if (XG.Combat && typeof XG.Combat.equipScore === 'function') {
      return XG.Combat.equipScore({ stats: eq.stats || {}, enh: 0, sockets: [] });
    }
    let score = 0;
    for (const key in (eq.stats || {})) score += (Number(eq.stats[key]) || 0) * (SALE_WEIGHTS[key] || 1);
    return score;
  }

  function findEquip(ref) {
    const s = XG.State.s;
    if (ref && typeof ref === 'object') {
      for (const sl of XG.SLOTS) {
        if (s.equip[sl.id] === ref) return { eq: ref, where: 'equip', slot: sl.id };
      }
      for (const slot of Object.keys(s.equip)) {
        if (s.equip[slot] === ref) return { eq: ref, where: 'equip', slot };
      }
      const index = s.equipBag.indexOf(ref);
      if (index >= 0) return { eq: ref, where: 'bag', index };
      return null;
    }
    const id = String(ref || '');
    for (const sl of XG.SLOTS) {
      const eq = s.equip[sl.id];
      if (eq && eq.id === id) return { eq, where: 'equip', slot: sl.id };
    }
    for (const slot of Object.keys(s.equip)) {
      const eq = s.equip[slot];
      if (eq && eq.id === id) return { eq, where: 'equip', slot };
    }
    const index = s.equipBag.findIndex(eq => eq.id === id);
    if (index >= 0) return { eq: s.equipBag[index], where: 'bag', index };
    return null;
  }

  const Equip = {
    find: findEquip,

    saleValue(eq, stoneGain) {
      const gain = Number.isFinite(stoneGain) ? stoneGain : XG.State.Calc.mods().stoneGain;
      const configured = Number(XG.CONFIG.STONE_SELL_RATE);
      const rate = Number.isFinite(configured) && configured >= 0 ? configured : 1;
      const score = Math.max(0, Number(baseEquipScore(eq)) || 0);
      return Math.max(0, Math.floor(Math.max(10, score * 3 * gain) * rate));
    },

    recoverGems(eq) {
      const out = [];
      if (!eq || typeof eq !== 'object') return out;
      const sockets = Array.isArray(eq.sockets) ? eq.sockets : [];
      for (let i = 0; i < sockets.length; i++) {
        const g = sockets[i];
        if (!g || typeof g.id !== 'string') continue;
        const tier = Math.max(1, Math.floor(Number(g.tier) || 1));
        XG.State.Res.gainGem(g.id, tier, 1);
        out.push({ id: g.id, tier });
        sockets[i] = null;
      }
      return out;
    },

    destroy(ref, options) {
      options = options || {};
      const s = XG.State.s;
      const found = findEquip(ref);
      if (!found) return { ok: false, reason: 'none' };
      const eq = found.eq;
      const stone = options.stone ? Equip.saleValue(eq, options.stoneGain) : 0;
      const gems = Equip.recoverGems(eq);
      if (found.where === 'bag') s.equipBag.splice(found.index, 1);
      else s.equip[found.slot] = null;
      if (stone > 0) XG.State.Res.gainStone(stone, true);
      return { ok: true, eq, where: found.where, slot: found.slot, gems, stone, reason: options.reason || '' };
    },
  };

  const Economy = {
    /* ══════ 洞天建造 ══════ */
    canUnlockBuilding(b) {
      const s = XG.State.s;
      if (s.realm > b.unlock.realm) return true;
      if (s.realm < b.unlock.realm) return false;
      return s.layer >= b.unlock.layer;
    },
    buildingsUnlocked() {
      return XG.BUILDINGS.filter(b => Economy.canUnlockBuilding(b));
    },
    upgradeBuilding(id) {
      const s = XG.State.s;
      const b = XG.idx.building[id];
      if (!b || !Economy.canUnlockBuilding(b)) return { ok: false, reason: 'lock' };
      const cost = XG.State.Calc.buildCost(b);
      if (!XG.State.Res.spendStone(cost)) return { ok: false, reason: 'stone', cost };
      s.buildings[id] = (s.buildings[id] || 0) + 1;
      const lv = s.buildings[id];
      XG.State.addLog(`【洞天】<b>${b.name}</b> 提升至 ${lv} 级（消耗灵石 ${U.fmt(cost)}）`, 'gain');
      XG.Bus.emit('building:up', { id, lv });
      return { ok: true, lv, cost };
    },
    upgradeBuildingMax(id, times) {
      let n = 0, spent = 0;
      const b = XG.idx.building[id];
      if (!b) return { n: 0 };
      while (n < (times || 10)) {
        const cost = XG.State.Calc.buildCost(b);
        if (XG.State.s.res.stone < cost) break;
        const r = Economy.upgradeBuilding(id);
        if (!r.ok) break;
        spent += cost; n++;
      }
      return { n, spent };
    },

    /* ══════ 功法修习 ══════ */
    artMaxLv() { return XG.State.Calc.artMaxLv(); },
    upgradeArt(id, times) {
      const s = XG.State.s;
      const a = XG.idx.art[id];
      if (!a || !s.arts[id]) return { ok: false, reason: 'lock' };
      const max = XG.State.Calc.artMaxLv();
      let n = 0, spent = 0;
      const want = times || 1;
      while (n < want) {
        const d = s.arts[id];
        if (d.lv >= max) return { ok: false, reason: 'max', n, spent };
        const cost = XG.State.Calc.artCost(a);
        if (s.res.stone < cost) return { ok: false, reason: 'stone', n, spent, cost };
        XG.State.Res.spendStone(cost);
        d.lv++; n++; spent += cost;
      }
      if (n > 0) {
        XG.Bus.emit('art:up', { id, lv: s.arts[id].lv });
        XG.State.addLog(`【功法】《${a.name}》修至 ${s.arts[id].lv} 重（消耗灵石 ${U.fmt(spent)}）`, 'gain');
      }
      return { ok: true, n, spent, lv: s.arts[id].lv };
    },

    /* ══════ 炼丹 ══════ */
    pillMaxUnlock() { return U.clamp(1 + Math.floor(XG.State.s.realm / 1.2), 1, 6); },
    pillsUnlocked() { return XG.PILLS.filter(p => p.unlock <= Economy.pillMaxUnlock()); },

    craftChance(p) {
      const m = XG.State.Calc.mods();
      const base = 0.74 + m.pillSuccess + XG.State.s.realm * 0.012;
      return U.clamp(base, 0.2, 0.98);
    },

    /* 丹药实际消耗：随境界水涨船高 */
    pillCost(p, times) {
      times = times || 1;
      const cm = XG.State.Calc.costMult();
      const need = { herb: 0, stone: 0, mat: {} };
      need.herb = Math.ceil((p.cost.herb || 0) * cm) * times;
      need.stone = Math.ceil((p.cost.stone || 0) * cm) * times;
      for (const k in (p.cost.mat || {})) need.mat[k] = p.cost.mat[k] * times;
      return need;
    },

    canCraft(p, times) {
      const s = XG.State.s;
      const need = Economy.pillCost(p, times || 1);
      if (s.res.herb < need.herb) return { ok: false, reason: 'herb', need };
      if (s.res.stone < need.stone) return { ok: false, reason: 'stone', need };
      for (const k in need.mat) if ((s.mats[k] || 0) < need.mat[k]) return { ok: false, reason: 'mat', need, mat: k };
      return { ok: true, need };
    },

    craft(pillId, times) {
      const s = XG.State.s;
      const p = XG.idx.pill[pillId];
      if (!p) return { ok: false, reason: 'no' };
      times = times || 1;
      const can = Economy.canCraft(p, times);
      if (!can.ok) return can;

      /* 扣除材料 */
      s.res.herb -= can.need.herb;
      s.res.stone -= can.need.stone;
      for (const k in can.need.mat) XG.State.Res.useMat(k, can.need.mat[k]);

      const chance = Economy.craftChance(p);
      const power = XG.State.Calc.mods().pillPower;
      let made = 0, extra = 0, failed = 0;
      for (let i = 0; i < times; i++) {
        if (U.chance(chance)) {
          made++;
          if (U.chance(0.18 + (power - 1) * 0.2)) extra++;
        } else failed++;
      }
      const total = made + extra;
      if (total > 0) {
        XG.State.Res.gainPill(p.id, total);
        s.stats.pillsMade += total;
      }
      XG.Bus.emit('craft', { pill: p, made: total, failed, extra });
      if (total > 0) {
        XG.State.addLog(`【丹道】炼制 <b>${p.name}</b> ×${total}${extra > 0 ? `（含额外 ${extra} 枚）` : ''}${failed > 0 ? `，失败 ${failed} 次` : ''}`, 'gain');
      } else {
        XG.State.addLog(`【丹道】炼制 <b>${p.name}</b> 失败，材料尽毁。`, 'battle');
      }
      return { ok: true, made: total, failed, extra };
    },

    /* ══════ 使用丹药 ══════ */
    usePill(pillId) {
      const s = XG.State.s;
      const p = XG.idx.pill[pillId];
      if (!p || !XG.State.Res.usePill(pillId, 1)) return { ok: false, reason: 'none' };
      s.stats.pillsUsed++;
      const power = XG.State.Calc.mods().pillPower;
      let text = '';

      if (p.kind === 'instant') {
        const gain = p.effect(s, power);
        s.spirit = Math.min(XG.State.Calc.need(), s.spirit + gain);
        s.stats.totalSpirit += gain;
        text = `灵气 +${U.fmt(gain)}`;
      } else if (p.kind === 'buff' || p.kind === 'buffCharge') {
        const now = Date.now();
        s.buffs = s.buffs.filter(b => b.id !== p.id);
        const b = { id: p.id, name: p.name, icon: p.icon, until: now + p.dur * 1000 };
        if (p.buffMult) b.spiritMult = p.buffMult(power);
        if (p.breakBonus) b.breakBonus = p.breakBonus(power);
        s.buffs.push(b);
        text = p.effectText(power);
      } else if (p.kind === 'buffStat') {
        const now = Date.now();
        s.buffs = s.buffs.filter(b => b.id !== p.id);
        const st = {};
        for (const k in p.stat) st[k] = p.stat[k] * power;
        s.buffs.push({ id: p.id, name: p.name, icon: p.icon, until: now + p.dur * 1000, stat: st });
        text = p.effectText(power);
      } else if (p.kind === 'perm') {
        const pts = p.permPoints * (1 + (XG.State.s.prestige.earned * 0));
        if (p.permKind === 'spirit') s.perm.spirit += pts;
        else s.perm.all += pts;
        const rt = XG.State.Calc.permTotals();
        text = `永久加成：灵气 ×${rt.spirit.toFixed(2)}，全属性 ×${rt.all.toFixed(2)}`;
      }

      XG.State.addLog(`【服丹】服下 <b>${p.name}</b>，${text}`, p.kind === 'perm' ? 'epic' : 'gain');
      XG.Bus.emit('pill:used', { pill: p, text });
      return { ok: true, text };
    },

    /* ══════ 装备 ══════
       所有装备入手的唯一入口，统一广播 'loot' 供掉落弹窗使用。 */
    pickupEquip(eq) {
      const s = XG.State.s;
      let auto = false;
      if (!s.equip[eq.slot]) {
        s.equip[eq.slot] = eq;
        auto = true;
      } else {
        // 若明显强于当前装备，直接替换（新手友好），否则进背包
        const cur = s.equip[eq.slot];
        if (eq.score > cur.score * 1.35 && (cur.enh || 0) === 0) {
          s.equipBag.push(cur);
          s.equip[eq.slot] = eq;
          auto = true;
        } else {
          s.equipBag.push(eq);
        }
      }
      // 背包溢出：自动熔炼评分最低的一件
      const overflowStoneGain = XG.State.Calc.mods().stoneGain;
      while (s.equipBag.length > BAG_LIMIT) {
        let worst = 0;
        for (let i = 1; i < s.equipBag.length; i++) if (s.equipBag[i].score < s.equipBag[worst].score) worst = i;
        Equip.destroy(s.equipBag[worst], { reason: 'overflow', stone: true, stoneGain: overflowStoneGain });
      }
      XG.Bus.emit('equip:new', eq);
      XG.Bus.emit('loot', { eq, auto });
      return { auto, eq };
    },

    equipItem(id) {
      const s = XG.State.s;
      const i = s.equipBag.findIndex(e => e.id === id);
      if (i < 0) return false;
      const eq = s.equipBag.splice(i, 1)[0];
      const old = s.equip[eq.slot];
      s.equip[eq.slot] = eq;
      if (old) s.equipBag.push(old);
      XG.Bus.emit('equip:change', eq);
      return true;
    },

    unequip(slot) {
      const s = XG.State.s;
      const old = s.equip[slot];
      if (!old) return false;
      s.equip[slot] = null;
      s.equipBag.push(old);
      XG.Bus.emit('equip:change', null);
      return true;
    },

    /* 自动装备最优 */
    autoEquip() {
      const s = XG.State.s;
      let n = 0;
      const slots = new Set(XG.SLOTS.map(x => x.id));
      for (const sl of slots) {
        const cur = s.equip[sl];
        let best = cur, bestIdx = -1;
        for (let i = 0; i < s.equipBag.length; i++) {
          const e = s.equipBag[i];
          if (e.slot !== sl) continue;
          if (!best || e.score > best.score) { best = e; bestIdx = i; }
        }
        if (bestIdx >= 0) {
          s.equipBag.splice(bestIdx, 1);
          if (cur) s.equipBag.push(cur);
          s.equip[sl] = best;
          n++;
        }
      }
      if (n > 0) { XG.State.addLog(`【装备】自动换装完成，更新 ${n} 件。`, 'gain'); XG.Bus.emit('equip:change', null); }
      return n;
    },

    destroyEquip(ref, options) { return Equip.destroy(ref, options); },
    recoverGems(eq) { return Equip.recoverGems(eq); },

    sellEquip(id) {
      const result = Equip.destroy(id, { reason: 'sell', stone: true });
      if (!result.ok) return 0;
      XG.Bus.emit('equip:change', null);
      return result.stone;
    },

    sellAllBelow(q) {
      const s = XG.State.s;
      const stoneGain = XG.State.Calc.mods().stoneGain;
      let total = 0, n = 0;
      for (const eq of s.equipBag.slice()) {
        if (eq.q >= q) continue;
        const result = Equip.destroy(eq, { reason: 'sell', stone: true, stoneGain });
        if (!result.ok) continue;
        total += result.stone;
        n++;
      }
      if (n > 0) {
        XG.State.addLog(`【熔炼】售出 ${n} 件低品装备，获得灵石 ${U.fmt(total)}`, 'gain');
        XG.Bus.emit('equip:change', null);
      }
      return { n, total };
    },

    sellMat(id, n) {
      const s = XG.State.s;
      const m = XG.idx.mat[id];
      if (!m) return 0;
      const have = s.mats[id] || 0;
      n = Math.min(n || have, have);
      if (n <= 0) return 0;
      XG.State.Res.useMat(id, n);
      const configured = Number(XG.CONFIG.STONE_SELL_RATE);
      const rate = Number.isFinite(configured) && configured >= 0 ? configured : 1;
      const val = Math.floor(m.value * n * 0.6 * XG.State.Calc.mods().stoneGain * rate);
      XG.State.Res.gainStone(val, true);
      return val;
    },
  };

  XG.Equip = Equip;
  XG.Economy = Economy;
  XG.BAG_LIMIT = BAG_LIMIT;
})();

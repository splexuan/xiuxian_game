/* ═══════════════════════════════════════════
   pets.js — 灵宠孵化 / 培养 / 出战
   ═══════════════════════════════════════════ */
(function () {
  'use strict';
  const XG = window.XG;
  const U = XG.U;

  const Pets = {
    /* 可孵化池：随境界解锁更高品质 */
    pool() {
      const s = XG.State.s;
      const maxQ = U.clamp(1 + Math.floor(s.realm / 1.8), 1, 6);
      const list = XG.PETS.filter(p => p.q <= maxQ);
      return (list.length ? list : [XG.PETS[0]]).map(p => ({
        ...p, w: 1 / Math.pow(2.3, p.q - 1),
      }));
    },

    /* 孵化一枚灵宠蛋 */
    hatch() {
      const s = XG.State.s;
      if (s.pets.eggs <= 0) return { ok: false, reason: 'egg' };

      const ownedIds = new Set(s.pets.owned);
      const avail = Pets.pool().filter(p => !ownedIds.has(p.id));
      s.pets.eggs--;

      if (!avail.length) {
        // 已集齐 → 转换为大量灵石
        const st = Math.floor(XG.baseAtkAt(s.realm) * 40 * XG.State.Calc.mods().stoneGain);
        XG.State.Res.gainStone(st, true);
        XG.State.addLog(`【灵宠园】孵化出一只普通灵兽，但你已收服所有灵宠，将其放归山林，得灵石 ${U.fmt(st)}。`, 'gain');
        return { ok: true, dup: true, stone: st };
      }

      const pet = U.weighted(avail);
      s.pets.owned.push(pet.id);
      s.pets.data[pet.id] = { lv: 1, bornAt: Date.now() };
      if (s.pets.active.length < XG.State.Calc.mods().petSlots) s.pets.active.push(pet.id);

      XG.State.addLog(`【灵宠园】灵光大盛，孵化出 <b>${pet.icon} ${pet.name}</b>（${U.QUALITY[pet.q].name}）！`, 'epic');
      XG.Bus.emit('pet:hatch', pet);
      return { ok: true, pet };
    },
    hatchAll() {
      const out = [];
      let guard = 0;
      while (XG.State.s.pets.eggs > 0 && guard++ < 200) {
        const r = Pets.hatch();
        if (!r.ok) break;
        if (!r.dup) out.push(r.pet);
      }
      return out;
    },

    /* 直接收服一只指定灵宠（寻宝阁 / 奇遇用） */
    grant(petId) {
      const s = XG.State.s;
      const pet = XG.idx.pet[petId];
      if (!pet) return { ok: false };
      if (s.pets.owned.indexOf(petId) >= 0) return { ok: false, reason: 'dup' };
      s.pets.owned.push(petId);
      s.pets.data[petId] = { lv: 1, bornAt: Date.now() };
      if (s.pets.active.length < XG.State.Calc.mods().petSlots) s.pets.active.push(petId);
      XG.State.addLog(`【御兽】灵兽俯首，<b>${pet.icon} ${pet.name}</b>（${U.QUALITY[pet.q].name}）归于麾下！`, 'epic');
      XG.Bus.emit('pet:hatch', pet);
      return { ok: true, pet };
    },

    /* 未拥有的灵宠池 */
    unowned() {
      const s = XG.State.s;
      return XG.PETS.filter(p => s.pets.owned.indexOf(p.id) < 0);
    },

    /* 灵宠等级上限 */
    maxLv(petId) {
      return 20 + XG.State.s.realm * 12;
    },
    levelCost(petId) {
      const def = XG.idx.pet[petId];
      const d = XG.State.s.pets.data[petId];
      if (!def || !d) return Infinity;
      const base = 60 * Math.pow(6, def.q);
      const cm = XG.State.Calc.costMult();
      return Math.ceil(base * Math.pow(1.155, d.lv) * cm / XG.State.Calc.mods().stoneGain);
    },

    levelUp(petId, times) {
      const s = XG.State.s;
      const d = s.pets.data[petId];
      if (!d) return { ok: false };
      const max = Pets.maxLv(petId);
      let n = 0, spent = 0;
      const want = times === 'max' ? 9999 : (times || 1);
      while (n < want) {
        if (d.lv >= max) return { ok: n > 0, reason: 'max', n, spent };
        const cost = Pets.levelCost(petId);
        if (s.res.stone < cost) return { ok: n > 0, reason: 'stone', n, spent, cost };
        XG.State.Res.spendStone(cost);
        d.lv++; n++; spent += cost;
      }
      if (n > 0) XG.Bus.emit('pet:up', { id: petId, lv: d.lv });
      return { ok: true, n, spent, lv: d.lv };
    },

    /* 出战/休战切换 */
    toggle(petId) {
      const s = XG.State.s;
      if (!s.pets.data[petId]) return { ok: false };
      const i = s.pets.active.indexOf(petId);
      if (i >= 0) {
        s.pets.active.splice(i, 1);
        XG.Bus.emit('pet:change');
        return { ok: true, active: false };
      }
      const slots = XG.State.Calc.mods().petSlots;
      if (s.pets.active.length >= slots) return { ok: false, reason: 'slots', slots };
      s.pets.active.push(petId);
      XG.Bus.emit('pet:change');
      return { ok: true, active: true };
    },

    autoBest() {
      const s = XG.State.s;
      const slots = XG.State.Calc.mods().petSlots;
      const sorted = s.pets.owned.slice().sort((a, b) => {
        const pa = XG.idx.pet[a], pb = XG.idx.pet[b];
        return Pets.petScore(pb, b) - Pets.petScore(pa, a);
      });
      s.pets.active = sorted.slice(0, slots);
      XG.Bus.emit('pet:change');
      return s.pets.active.slice();
    },

    petScore(def, id) {
      if (!def) return 0;
      const d = XG.State.s.pets.data[id];
      const lv = d ? d.lv : 1;
      let sc = 0;
      for (const k in def.bonus) sc += def.bonus[k] * lv * (k === 'spirit' || k === 'stoneGain' ? 2.2 : 1);
      return sc;
    },

    /* 用仙玉购买灵宠蛋 */
    buyEgg(n) {
      const s = XG.State.s;
      n = n || 1;
      const cost = 10 * n;
      if (s.res.jade < cost) return { ok: false, reason: 'jade', cost };
      XG.State.Res.spendJade(cost);
      s.pets.eggs += n;
      XG.Bus.emit('pet:egg', n);
      return { ok: true, n };
    },
  };

  XG.Pets = Pets;
})();

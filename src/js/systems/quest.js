/* ═══════════════════════════════════════════
   quest.js — 道途任务链（分步引导 + 目标奖励）
   ═══════════════════════════════════════════ */
(function () {
  'use strict';
  const XG = window.XG;
  const U = XG.U;

  const CHAPTERS = [
    { n: 1, name: '凡尘问道', icon: '🧑', desc: '自山野少年始，习吐纳、辟洞天、入秘境。' },
    { n: 2, name: '炼器寻宝', icon: '🔨', desc: '锻炉开火，宝石现世，寻宝阁中问道机缘。' },
    { n: 3, name: '神通初成', icon: '✨', desc: '神通入体，御兽为友，登临宝塔。' },
    { n: 4, name: '化神炼虚', icon: '🌟', desc: '神游太虚，法宝加身，塔上二十。' },
    { n: 5, name: '大乘飞升', icon: '🔆', desc: '步步高升，直至大乘，直面飞升。' },
    { n: 6, name: '轮回再世', icon: '🌀', desc: '斩断因果者，方可重走一次仙途。' },
  ];

  const Quest = {
    CHAPTERS,
    list() { return XG.QUESTS; },
    chapter(n) { return CHAPTERS.find(c => c.n === n); },

    /* 当前进行中的任务 */
    current() {
      const s = XG.State.s;
      return XG.QUESTS[s.quest.idx] || null;
    },
    index() { return XG.State.s.quest.idx; },
    total() { return XG.QUESTS.length; },
    doneCount() { return Math.min(XG.State.s.quest.idx, XG.QUESTS.length); },
    allDone() { return XG.State.s.quest.idx >= XG.QUESTS.length; },

    /* 当前任务目标是否达成 */
    reached() {
      const q = Quest.current();
      if (!q) return false;
      try { return !!q.goal(XG.State.s); } catch (e) { return false; }
    },

    /* 某章节的完成进度 */
    chapterProgress(n) {
      const s = XG.State.s;
      const list = XG.QUESTS.filter(q => q.ch === n);
      const done = list.filter(q => XG.QUESTS.indexOf(q) < s.quest.idx).length;
      return { done, total: list.length };
    },

    /* 是否已解锁到该章节 */
    chapterUnlocked(n) {
      const s = XG.State.s;
      const cur = Quest.current();
      if (!cur) return true;
      return n <= cur.ch;
    },

    /* ═════════════════════════════════════════
       领取奖励并推进
       ═════════════════════════════════════════ */
    claim() {
      const q = Quest.current();
      if (!q) return { ok: false, reason: 'none' };
      if (!Quest.reached()) return { ok: false, reason: 'unfinished' };
      const s = XG.State.s;
      const gain = Quest.applyReward(q.reward || {});
      s.quest.claimed[q.id] = Date.now();
      s.quest.idx++;
      s.stats.questsDone = (s.stats.questsDone || 0) + 1;

      XG.State.addLog(`【道途·${q.title}】达成！${gain.text}`, 'epic');
      const next = Quest.current();
      XG.Bus.emit('quest:done', { quest: q, gain, next });
      XG.Bus.emit('float', { text: '道途达成：' + q.title, cls: 'epic' });
      XG.State.Save.save(true);
      return { ok: true, gain, next };
    },

    /* 应用奖励，返回可用于展示的文本 */
    applyReward(r) {
      const s = XG.State.s;
      const parts = [];
      if (r.jade) { XG.State.Res.gainJade(r.jade, true); parts.push('仙玉 +' + r.jade); }
      if (r.stoneSec) {
        const n = Math.ceil(XG.Combat.stoneUnit() * r.stoneSec);
        XG.State.Res.gainStone(n, true);
        parts.push('灵石 +' + U.fmt(n));
      }
      if (r.stone) { XG.State.Res.gainStone(r.stone, true); parts.push('灵石 +' + U.fmt(r.stone)); }
      if (r.herb) { XG.State.Res.gainHerb(r.herb, true); parts.push('灵草 +' + U.fmt(r.herb)); }
      for (const k in (r.mat || {})) {
        XG.State.Res.gainMat(k, r.mat[k]);
        const m = XG.idx.mat[k];
        parts.push(`${m ? m.name : k}×${r.mat[k]}`);
      }
      if (r.gem) {
        const parts2 = [];
        for (let i = 0; i < (r.gem.n || 1); i++) {
          const g = U.pick(XG.GEMS);
          XG.State.Res.gainGem(g.id, r.gem.tier || 1, 1);
          parts2.push(`${g.icon}${g.name}(${r.gem.tier || 1}阶)`);
        }
        parts.push(parts2.join('、'));
      }
      if (r.equip) {
        const eq = XG.Combat.genEquip(0, '道途奖励', { q: r.equip.q });
        XG.Economy.pickupEquip(eq);
        parts.push(`${U.QUALITY[eq.q].name}「${eq.name}」`);
      }
      if (r.pet && XG.idx.pet[r.pet.id]) {
        const res = XG.Pets.grant(r.pet.id);
        if (res.ok) parts.push(`灵宠 ${res.pet.name}`);
      }
      if (r.free) {
        if (r.free === 'spirit') { s.permBonus.spirit = (s.permBonus.spirit || 0) + 0.02; parts.push('永久 灵气/秒 +2%'); }
        else if (r.free === 'all') { s.permBonus.all = (s.permBonus.all || 0) + 0.012; parts.push('永久 全属性 +1.2%'); }
        else if (r.free === 'atk') { s.permBonus.all = (s.permBonus.all || 0) + 0.008; parts.push('永久 全属性 +0.8%'); }
        XG.Bus.emit('perm:bonus');
      }
      XG.Bus.emit('quest:change');
      return { text: parts.join('，') || '道途精进', parts };
    },

    /* ═════════════════════════════════════════
       轮询检查：新任务播报 + 目标达成提示
       （全部状态存于存档，飞升后自动重置）
       ═════════════════════════════════════════ */
    check() {
      const q = Quest.current();
      if (!q) return;
      const s = XG.State.s;
      s.quest.seen = s.quest.seen || {};
      s.quest.ready = s.quest.ready || {};

      if (!s.quest.seen[q.id]) {
        s.quest.seen[q.id] = Date.now();
        XG.State.addLog(`【道途】新目标：<b>${q.title}</b> —— ${q.desc}`, 'event');
        XG.Bus.emit('quest:new', q);
        XG.Bus.emit('quest:change');
        XG.Bus.emit('float', { text: '📜 新道途：' + q.title, cls: 'epic' });
      }
      if (Quest.reached() && !s.quest.ready[q.id]) {
        s.quest.ready[q.id] = Date.now();
        XG.Bus.emit('quest:ready', q);
        XG.Bus.emit('quest:change');
        XG.Float.show('✦ 道途可领取：' + q.title, 'epic');
      }
    },
  };

  /* ═════════════════════════════════════════
     天象（周期性全局增益 / 减益）
     ═════════════════════════════════════════ */
  const Omen = {
    init() {
      const s = XG.State.s;
      // 首个天象来得快一些，让玩家早些见到这套机制
      if (!s.omen.next) s.omen.next = Date.now() + 150 * 1000;
    },

    active() { return XG.State.Calc.omenDef(); },

    left() {
      const s = XG.State.s;
      const o = s.omen;
      if (!o || !o.id) return 0;
      return Math.max(0, Math.floor((o.until - Date.now()) / 1000));
    },

    nextIn() {
      const s = XG.State.s;
      return Math.max(0, Math.floor(((s.omen.next || 0) - Date.now()) / 1000));
    },

    /* 由主循环调用 */
    tick() {
      const s = XG.State.s;
      const now = Date.now();
      if (!s.omen.next) { s.omen.next = now + XG.OMEN_INTERVAL; return; }
      if (s.omen.id && s.omen.until <= now) {
        const def = XG.OMENS.find(x => x.id === s.omen.id);
        s.omen.id = null;
        XG.Bus.emit('omen:end', def);
      }
      if (now >= s.omen.next && !s.omen.id) {
        Omen.roll();
      }
    },

    roll() {
      const s = XG.State.s;
      const om = XG.State.Calc.omenMods();
      void om;
      const def = U.weighted(XG.OMENS);
      s.omen.id = def.id;
      s.omen.until = Date.now() + def.dur * 1000;
      s.omen.next = Date.now() + XG.OMEN_INTERVAL + U.rndInt(0, 120) * 1000;
      s.stats.omensSeen = (s.stats.omensSeen || 0) + 1;
      XG.State.addLog(`【天象】${def.icon} <b>${def.name}</b> 降临 —— ${def.desc}（${Math.round(def.dur / 60)} 分钟内）`, def.good ? 'event' : 'battle');
      XG.Bus.emit('omen:start', def);
      XG.Bus.emit('float', { text: def.icon + ' ' + def.name, cls: def.good ? 'epic' : 'bad' });
      return def;
    },

    /* 强制召唤（调试 / 特殊事件） */
    force(id) {
      const def = XG.OMENS.find(x => x.id === id);
      if (!def) return null;
      const s = XG.State.s;
      s.omen.id = def.id;
      s.omen.until = Date.now() + def.dur * 1000;
      XG.Bus.emit('omen:start', def);
      return def;
    },
  };

  XG.Quest = Quest;
  XG.Omen = Omen;
})();

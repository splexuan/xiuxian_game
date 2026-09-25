/* ═══════════════════════════════════════════
   render.js — UI 基础工具 / 面板调度 / 日志 / 飘字
   ═══════════════════════════════════════════ */
(function () {
  'use strict';
  const XG = window.XG;
  const U = XG.U;

  const calcCache = { dirty: true, state: null, mods: null, player: null };

  function copySnapshot(value) {
    if (Array.isArray(value)) return value.map(copySnapshot);
    if (value && typeof value === 'object') {
      const out = Object.create(null);
      for (const key of Object.keys(value)) out[key] = copySnapshot(value[key]);
      return out;
    }
    return value;
  }

  function sameSnapshot(a, b) {
    if (a === b) return true;
    try { return JSON.stringify(a) === JSON.stringify(b); } catch (e) { return false; }
  }

  const UI = {
    esc(s) { return U.esc(s); },
    /* 允许 <b> 标签的简易安全转义 */
    rich(s) {
      return UI.esc(s).replace(/&lt;b&gt;/g, '<b>').replace(/&lt;\/b&gt;/g, '</b>')
        .replace(/&lt;em&gt;/g, '<em>').replace(/&lt;\/em&gt;/g, '</em>');
    },
    $(sel, root) { return (root || document).querySelector(sel); },
    $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); },
    el(tag, cls, html) {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (html !== undefined) e.innerHTML = html;
      return e;
    },
    quality(q) { return U.QUALITY[U.clamp(q | 0, 0, 6)]; },
    invalidateCalc() { calcCache.dirty = true; },
    mods() {
      const s = XG.State && XG.State.s;
      if (!calcCache.dirty && calcCache.state === s && calcCache.mods) return calcCache.mods;
      calcCache.state = s;
      calcCache.mods = XG.State.Calc.mods();
      calcCache.player = null;
      calcCache.dirty = false;
      return calcCache.mods;
    },
    playerStats() {
      const s = XG.State.s;
      const m = UI.mods();
      if (!calcCache.player) {
        const rb = XG.REALMS[s.realm];
        calcCache.player = {
          name: XG.R.name(s.realm, s.layer),
          atk: rb.atkBase * m.atk,
          hp: rb.hpBase * m.hp,
          maxHp: rb.hpBase * m.hp,
          def: rb.atkBase * 0.62 * m.def,
          crit: m.crit, critDmg: m.critDmg, dodge: m.dodge,
          spd: m.spd, lifesteal: m.lifesteal, pen: m.pen,
          skills: s.skills.filter(Boolean),
          maxEnergy: 100,
          stance: s.battle.stance || 'balance',
          dmgTaken: 1,
        };
      }
      return calcCache.player;
    },
    setHTML(el, html) {
      if (el && el.innerHTML !== html) el.innerHTML = html;
    },
    setText(el, text) {
      if (el && el.textContent !== text) el.textContent = text;
    },
    setBtn(btn, enabled) { if (btn) btn.disabled = !enabled; },
  };

  /* ═════════════════════════════════════════
     面板调度
     ═════════════════════════════════════════ */
  const Panels = XG.Panels = {};
  const MT = {
    current: 'cultivate',
    dirty: {},
    errors: {},
    retryRequired: {},
    containers: {},
    reconcileState: null,
    dirtySeq: 0,
    renderVersions: {},

    register(name, mod) { Panels[name] = mod; },

    init() {
      UI.$$('#sidebar .nav-item').forEach(btn => {
        btn.addEventListener('click', () => MT.show(btn.dataset.panel));
      });
      UI.$$('.panel-page').forEach(p => {
        MT.containers[p.id.replace('page-', '')] = p;
      });
      for (const k in Panels) if (Panels[k].init) Panels[k].init();
      MT.show('cultivate');
    },

    show(name) {
      if (!Panels[name]) return;
      MT.current = name;
      UI.$$('#sidebar .nav-item').forEach(b => {
        const active = b.dataset.panel === name;
        b.classList.toggle('active', active);
        b.setAttribute('aria-current', active ? 'page' : 'false');
      });
      UI.$$('.panel-page').forEach(p => p.classList.toggle('active', p.id === 'page-' + name));
      MT.render(name, true);
      XG.Bus.emit('panel:show', name);
    },

    render(name, force) {
      const mod = Panels[name];
      const box = MT.containers[name];
      if (!mod || !box) return;
      if (!box.__mtRetryBound) {
        box.addEventListener('click', ev => {
          if (ev.target.closest('[data-panel-retry]')) MT.render(name, true);
        });
        box.__mtRetryBound = true;
      }
      if ((force || MT.dirty[name]) && (force || !MT.retryRequired[name])) {
        /* 注意：两边都必须做「|| 0」归一化。
           renderVersions[name] 在首次 markDirty 之前是 undefined，
           若只归一化左边，右式会变成 `undefined !== 0` → 恒为 true，
           面板就被永久标记为脏：每个 UI 帧（8Hz）整页重建一次，
           表现为按钮等元素不停闪烁。 */
        const renderVersion = MT.renderVersions[name] || 0;
        try {
          mod.render(box);
          UI.$$('button', box).forEach(button => { if (!button.getAttribute('type')) button.setAttribute('type', 'button'); });
          delete MT.errors[name];
          delete MT.retryRequired[name];
          box.removeAttribute('data-render-error');
          MT.dirty[name] = (MT.renderVersions[name] || 0) !== renderVersion;
        } catch (e) {
          console.error('[render:' + name + ']', e);
          MT.dirty[name] = true;
          MT.retryRequired[name] = true;
          MT.errors[name] = e;
          MT.showError(name, box, e);
          return;
        }
      }
      if (!force && MT.retryRequired[name]) return;
      if (mod.update) {
        try { mod.update(box); } catch (e) {
          console.error('[update:' + name + ']', e);
          MT.dirty[name] = true;
          MT.retryRequired[name] = true;
          MT.errors[name] = e;
          MT.showError(name, box, e);
        }
      }
    },

    showError(name, box, error) {
      const message = error && error.message ? error.message : String(error || '未知错误');
      box.setAttribute('data-render-error', name);
      UI.setHTML(box, `<div class="panel-error" role="alert"><b>面板暂时无法显示</b><span>${UI.esc(message)}</span><button class="btn sm" type="button" data-panel-retry>重试</button></div>`);
    },

    markDirty(name) {
      UI.invalidateCalc();
      const version = ++MT.dirtySeq;
      if (name) {
        MT.dirty[name] = true;
        MT.renderVersions[name] = version;
      } else {
        for (const k in Panels) {
          MT.dirty[k] = true;
          MT.renderVersions[k] = version;
        }
      }
    },

    reconcile() {
      const s = XG.State.s;
      const snap = {
        state: s,
        realm: s.realm,
        layer: s.layer,
        stone: s.res.stone,
        herb: s.res.herb,
        jade: s.res.jade,
        pills: copySnapshot(s.pills),
        mats: copySnapshot(s.mats),
        gems: copySnapshot(s.gems),
        equip: copySnapshot(s.equip),
        equipBag: copySnapshot(s.equipBag),
        buildings: copySnapshot(s.buildings),
        arts: copySnapshot(s.arts),
        skills: copySnapshot(s.skills),
        buffs: copySnapshot(s.buffs),
        perm: copySnapshot(s.perm),
        permBonus: copySnapshot(s.permBonus),
        achBonus: copySnapshot(s.achBonus),
        pets: copySnapshot(s.pets),
        achievements: copySnapshot(s.achievements),
        gacha: copySnapshot(s.gacha),
        lastPulls: copySnapshot(s.lastPulls),
        zone: s.explore.zone,
        running: s.explore.running,
        exploreWins: s.explore.wins,
        exploreLosses: s.explore.losses,
        autoBreak: s.settings.autoBreak,
        autoPill: s.settings.autoPill,
        autoExplore: s.settings.autoExplore,
        towerBest: s.tower.best,
        towerFloor: s.tower.floor,
        eggs: s.pets.eggs,
        petCount: s.pets.owned.length,
        quest: s.quest.idx,
        omen: copySnapshot(s.omen),
      };
      const p = MT.reconcileState;
      MT.reconcileState = snap;
      if (!p) return;
      const mark = names => { for (const name of names) MT.markDirty(name); };
      if (p.state !== s) { MT.markDirty(); return; }
      if (p.stone !== snap.stone) mark(['cave', 'arts', 'alchemy', 'forge', 'gacha', 'pets', 'ascend']);
      if (p.herb !== snap.herb) mark(['alchemy', 'forge']);
      if (p.jade !== snap.jade) mark(['gacha', 'pets', 'ascend']);
      if (!sameSnapshot(p.pills, snap.pills)) mark(['alchemy', 'cultivate']);
      if (!sameSnapshot(p.mats, snap.mats)) mark(['alchemy', 'forge']);
      if (!sameSnapshot(p.gems, snap.gems)) mark(['forge']);
      if (!sameSnapshot(p.equip, snap.equip) || !sameSnapshot(p.equipBag, snap.equipBag)) {
        mark(['bag', 'forge', 'cultivate', 'tower']);
      }
      if (!sameSnapshot(p.buildings, snap.buildings)) mark(['cave', 'cultivate', 'alchemy', 'forge', 'arts']);
      if (!sameSnapshot(p.arts, snap.arts)) mark(['arts', 'cultivate']);
      if (!sameSnapshot(p.skills, snap.skills)) mark(['arts']);
      if (!sameSnapshot(p.buffs, snap.buffs)) mark(['cultivate']);
      if (!sameSnapshot(p.perm, snap.perm) || !sameSnapshot(p.permBonus, snap.permBonus)
        || !sameSnapshot(p.achBonus, snap.achBonus)) mark(['cultivate']);
      if (!sameSnapshot(p.pets, snap.pets) || p.eggs !== snap.eggs || p.petCount !== snap.petCount) {
        mark(['pets', 'cultivate']);
      }
      if (!sameSnapshot(p.achievements, snap.achievements)) mark(['achievement', 'cultivate']);
      if (!sameSnapshot(p.gacha, snap.gacha) || !sameSnapshot(p.lastPulls, snap.lastPulls)) mark(['gacha']);
      if (p.realm !== snap.realm || p.layer !== snap.layer) {
        mark(['cultivate', 'cave', 'arts', 'alchemy', 'forge', 'gacha', 'pets', 'explore', 'tower', 'ascend']);
      }
      if (p.zone !== snap.zone || p.running !== snap.running || p.autoExplore !== snap.autoExplore
        || p.exploreWins !== snap.exploreWins || p.exploreLosses !== snap.exploreLosses) {
        mark(['explore']);
      }
      if (p.autoBreak !== snap.autoBreak || p.autoPill !== snap.autoPill) mark(['cultivate']);
      if (p.towerBest !== snap.towerBest || p.towerFloor !== snap.towerFloor) mark(['tower', 'ascend']);
      if (p.quest !== snap.quest) mark(['quest']);
      if (!sameSnapshot(p.omen, snap.omen)) MT.markDirty();
    },

    refresh() {
      MT.reconcile();
      MT.render(MT.current);
      if (XG.Modals && typeof XG.Modals.update === 'function') XG.Modals.update();
    },

    updateDots() {
      const s = XG.State.s, Calc = XG.State.Calc;
      const set = (id, on) => { const e = document.getElementById('dot-' + id); if (e) e.classList.toggle('on', !!on); };
      const artMax = Calc.artMaxLv();

      set('cultivate', s.spirit >= Calc.need() && !XG.R.isMax(s.realm, s.layer));
      set('quest', XG.Quest.reached());
      set('cave', XG.BUILDINGS.some(b => XG.Economy.canUnlockBuilding(b) && s.res.stone >= Calc.buildCost(b)));
      set('arts', Object.keys(s.arts).some(id => s.res.stone >= Calc.artCost(XG.idx.art[id]) && s.arts[id].lv < artMax));
      set('forge', XG.Forge.mergeTargets().some(t => s.res.stone >= t.cost)
        || XG.Forge.gemList().some(g => g.n >= 3 && g.tier < XG.GEM_MAX_TIER));
      set('gacha', XG.Gacha.pools().some(p => XG.Gacha.canPull(p.id, 1).ok
        && XG.Gacha.info(p.id) && XG.Gacha.info(p.id).pityLeft <= 3));
      set('alchemy', XG.Economy.pillsUnlocked().some(p => XG.Economy.canCraft(p, 1).ok));
      set('pets', s.pets.eggs > 0 || s.pets.owned.some(id => s.res.stone >= XG.Pets.levelCost(id)));
      set('explore', !s.explore.running && !!XG.Combat.zoneAt(s.explore.zone) && XG.Combat.zoneAt(s.explore.zone).unlocked);
      set('tower', s.tower.floor > s.tower.best);
      set('achievement', XG.ACHIEVEMENTS.some(a => !s.achievements[a.id] && a.cond(s)));
      set('ascend', XG.Prestige.canAscend());
    },
  };

  /* ═════════════════════════════════════════
     日志
     ═════════════════════════════════════════ */
  const Log = {
    filter: 'all',
    init() {
      const body = document.getElementById('log-body');
      if (body) {
        body.setAttribute('role', 'log');
        body.setAttribute('aria-live', 'polite');
        body.setAttribute('aria-relevant', 'additions text');
      }
      UI.$$('.log-tab').forEach(t => t.addEventListener('click', () => {
        UI.$$('.log-tab').forEach(x => {
          const active = x === t;
           x.classList.toggle('active', active);
           x.setAttribute('aria-selected', active ? 'true' : 'false');
           x.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        Log.filter = t.dataset.filter;
        Log.rebuild();
      }));
      const clr = document.getElementById('btn-clear-log');
      if (clr) clr.addEventListener('click', () => { XG.State.s.log.length = 0; if (body) body.innerHTML = ''; });

      XG.Bus.on('log', entry => Log.append(entry));
      Log.rebuild();
    },
    match(entry) {
      if (Log.filter === 'all') return true;
      if (Log.filter === 'battle') return entry.type === 'battle' || entry.type === 'epic' && /劫|败|战|妖兽/.test(entry.text);
      if (Log.filter === 'gain') return entry.type === 'gain' || entry.type === 'epic';
      if (Log.filter === 'event') return entry.type === 'event';
      return true;
    },
    line(entry) {
      const d = new Date(entry.t);
      const tm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      return `<div class="log-line ${entry.type}"><span class="t">${tm}</span>${UI.rich(entry.text)}</div>`;
    },
    append(entry) {
      const body = document.getElementById('log-body');
      if (!body || !Log.match(entry)) return;
      const nearBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 60;
      body.insertAdjacentHTML('beforeend', Log.line(entry));
      while (body.children.length > 140) body.removeChild(body.firstChild);
      if (nearBottom) body.scrollTop = body.scrollHeight;
    },
    rebuild() {
      const body = document.getElementById('log-body');
      if (!body) return;
      const list = XG.State.s.log.filter(Log.match).slice(-90);
      body.innerHTML = list.length
        ? list.map(Log.line).join('')
        : '<div class="empty" style="padding:28px 12px"><span class="e-ico">📜</span>尚无天机记载</div>';
      body.scrollTop = body.scrollHeight;
    },
  };

  /* ═════════════════════════════════════════
     飘字
     ═════════════════════════════════════════ */
  const Float = {
    show(text, cls, x, y) {
      const layer = document.getElementById('float-layer');
      if (!layer) return;
      const e = document.createElement('div');
      e.className = 'float-txt ' + (cls || '');
      e.textContent = text;
      const px = x === undefined ? (window.innerWidth * 0.5 + U.rnd(-120, 120)) : x;
      const py = y === undefined ? (window.innerHeight * 0.38 + U.rnd(-40, 40)) : y;
      e.style.left = px + 'px';
      e.style.top = py + 'px';
      layer.appendChild(e);
      setTimeout(() => e.remove(), 1600);
      if (layer.children.length > 40) layer.removeChild(layer.firstChild);
    },
  };

  /* ═════════════════════════════════════════
     通用卡片片段
     ═════════════════════════════════════════ */
  const Frag = {
    /* 资源文本 */
    costRow(need, label) {
      const s = XG.State.s;
      const parts = [];
      if (need.stone !== undefined && need.stone > 0) {
        parts.push(`<span class="${s.res.stone >= need.stone ? 'full' : 'no'}">灵石 <b>${U.fmt(need.stone)}</b></span>`);
      }
      if (need.herb !== undefined && need.herb > 0) {
        parts.push(`<span class="${s.res.herb >= need.herb ? 'full' : 'no'}">灵草 <b>${U.fmt(need.herb)}</b></span>`);
      }
      if (need.jade !== undefined && need.jade > 0) {
        parts.push(`<span class="${s.res.jade >= need.jade ? 'full' : 'no'}">仙玉 <b>${U.fmt(need.jade)}</b></span>`);
      }
      for (const k in (need.mat || {})) {
        const have = s.mats[k] || 0, want = need.mat[k];
        parts.push(`<span class="${have >= want ? 'full' : 'no'}">${XG.idx.mat[k] ? XG.idx.mat[k].name : k} <b>${have}/${want}</b></span>`);
      }
      return `<div class="cost">${label ? label + '：' : ''}${parts.join(' · ')}</div>`;
    },
    bar(cls, pct) {
      const value = U.clamp(pct * 100, 0, 100);
      return `<div class="bar ${cls}" role="progressbar" aria-label="进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(value)}"><i style="width:${value}%"></i></div>`;
    },
    empty(ico, txt) { return `<div class="empty"><span class="e-ico">${ico}</span>${txt}</div>`; },
  };

  XG.UI = UI;
  XG.MT = MT;
  XG.Log = Log;
  XG.Float = Float;
  XG.Frag = Frag;

  /* ══════ 事件接线 ══════ */
  XG.Bus.on('float', d => Float.show(d.text, d.cls));
  XG.Bus.on('log', () => MT.updateDots());
  XG.Bus.on('res:stone', () => { MT.markDirty('cave'); MT.markDirty('arts'); MT.markDirty('alchemy'); MT.markDirty('forge'); MT.markDirty('gacha'); MT.markDirty('pets'); MT.markDirty('ascend'); });
  XG.Bus.on('res:herb', () => { MT.markDirty('alchemy'); MT.markDirty('forge'); });
  XG.Bus.on('res:jade', () => { MT.markDirty('gacha'); MT.markDirty('pets'); MT.markDirty('ascend'); });

  XG.Bus.on('realm:up', () => { MT.markDirty(); XG.Float.show('境界突破！', 'epic'); });
  XG.Bus.on('break:ok', () => MT.markDirty());
  XG.Bus.on('break:fail', () => MT.markDirty());
  XG.Bus.on('building:up', () => MT.markDirty());
  XG.Bus.on('art:up', () => MT.markDirty('arts'));
  XG.Bus.on('equip:change', () => { MT.markDirty('bag'); MT.markDirty('forge'); });
  XG.Bus.on('equip:new', () => { MT.markDirty('bag'); MT.markDirty('forge'); });
  XG.Bus.on('pet:change', () => MT.markDirty('pets'));
  XG.Bus.on('pet:hatch', () => MT.markDirty('pets'));
  XG.Bus.on('pet:up', () => MT.markDirty('pets'));
  XG.Bus.on('craft', () => MT.markDirty('alchemy'));
  XG.Bus.on('pill:used', () => { MT.markDirty('alchemy'); MT.markDirty('cultivate'); });
  XG.Bus.on('buff:change', () => MT.markDirty('cultivate'));
  XG.Bus.on('perm:bonus', () => MT.markDirty('cultivate'));
  XG.Bus.on('explore:win', () => { MT.markDirty('explore'); });
  XG.Bus.on('explore:stop', () => MT.markDirty('explore'));
  XG.Bus.on('explore:lose', () => MT.markDirty('explore'));
  XG.Bus.on('tower:win', () => { MT.markDirty('tower'); XG.Float.show('塔层突破！', 'epic'); });
  XG.Bus.on('tower:lose', () => MT.markDirty('tower'));
  XG.Bus.on('ach:change', () => MT.markDirty('achievement'));
  XG.Bus.on('ascend', () => MT.markDirty());
  XG.Bus.on('talent:up', () => MT.markDirty('ascend'));

  XG.Bus.on('quest:change', () => { MT.markDirty('quest'); MT.updateDots(); });
  XG.Bus.on('quest:done', () => MT.markDirty('quest'));
  XG.Bus.on('forge', () => { MT.markDirty('forge'); MT.markDirty('bag'); MT.updateDots(); });
  XG.Bus.on('gacha:result', () => { MT.markDirty('gacha'); MT.markDirty(); MT.updateDots(); });
  XG.Bus.on('skill:change', () => { MT.markDirty('arts'); MT.updateDots(); });
  XG.Bus.on('omen:start', () => { MT.markDirty(); });
  XG.Bus.on('omen:end', () => { MT.markDirty(); });
  XG.Bus.on('zone:event', () => MT.markDirty('explore'));
})();

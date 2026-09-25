/* ═══════════════════════════════════════════
   game.js — 启动 / 主循环 / 顶栏 / 底栏 / 存读档
   ═══════════════════════════════════════════ */
(function () {
  'use strict';
  const XG = window.XG;
  const U = XG.U, R = XG.R;
  const UI = XG.UI, MT = XG.MT;

  XG.CombatSpeed = 2;
  XG.Combat.autoBossBattle = true;

  const Game = {
    last: 0,
    uiTimer: 0,
    saveTimer: 0,
    dotTimer: 0,
    running: false,
    saveBlocked: false,
    recoveryReason: '',
    lastBottomKey: '',
    lastSaveNotice: 0,
    eventsBound: false,

    boot() {
      XG.BG.init();
      XG.BattleView.init();
      XG.LootView.init();
      XG.PullView.init();

      let loadResult;
      try { loadResult = XG.State.Save.load(); } catch (e) { loadResult = { status: 'error', error: e }; }
      const loaded = Game.loadData(loadResult);
      let loadError = false;
      if (loaded) {
        XG.State.set(loaded);
      } else {
        XG.State.reset();
        loadError = !!(loadResult && loadResult.status === 'error');
        if (loadError) {
          Game.saveBlocked = true;
          Game.recoveryReason = loadResult.error && loadResult.error.message ? loadResult.error.message : '存档内容无法读取';
          if (XG.State.Save.lock) XG.State.Save.lock();
          XG.State.addLog('存档读取失败，已暂停自动写入。请通过恢复提示选择重试或放弃旧档。', 'battle');
        } else {
          XG.State.addLog('你自凡尘中睁眼，天地灵气扑面而来。仙途，自此而始。', 'epic');
          XG.State.addLog('提示：点击中央灵珠「吐纳」可额外凝聚灵气；灵气满后点击「运功突破」提升境界。', 'info');
        }
      }
      if (XG.Combat.rememberTower) XG.Combat.rememberTower();

      XG.Log.init();
      XG.MT.init();
      XG.Modals.init();
      XG.Omen.init();
      Game.bindTop();
      Game.bindBottom();
      Game.bindTracker();
      Game.bindEvents();
      Game.syncToggles();

      if (loaded) {
        window.__offlineReport = XG.Cult.applyOffline();
      } else {
        window.__offlineReport = null;
      }
      if (XG.State.s.explore.running) XG.Combat.setExploring(true);
      Game.syncToggles();

      if (!loaded && !loadError) {
        setTimeout(() => {
          XG.Modals.result('仙途开启',
            '挂机修仙 · 一生一世一双人',
            `你本是山野少年，一日偶得《引气诀》残页，自此踏上仙途。<br><br>
             <b>道途：</b>「道途」入口会一步步指引你该做什么，达成后记得领取奖励。<br>
             <b>修行：</b>灵气随时间自动增长，满则突破；点击灵珠「吐纳」可加速。<br>
             <b>洞天：</b>以灵石建造建筑，永久提升修炼速度。<br>
             <b>功法·神通：</b>修习功法增强底蕴，配置神通可在战斗中主动释放。<br>
             <b>秘境：</b>挂机刷怪换取灵石与灵材，还会随机遇到宝箱、灵泉与精英。<br>
             <b>锻炉：</b>强化装备、三件合成为更高品阶、镶嵌宝石。<br>
             <b>寻宝阁：</b>消耗仙玉寻宝，有保底，能得功法、法宝与灵宠。<br>
             <b>通天塔：</b>层层挑战，每 5 层必掉高品装备。<br>
             <b>飞升：</b>修至大乘可转生，换取永久仙缘加成。<br><br>
             <span style="color:var(--gold)">提示：先按「道途」的指引走几步，很快就能上手。</span>`,
            null);
          MT.show('quest');
        }, 400);
      } else if (loadError) {
        setTimeout(() => Game.showRecovery(), 400);
      } else if (window.__offlineReport) {
        setTimeout(() => XG.Modals.offline(window.__offlineReport), 350);
      }

      window.addEventListener('beforeunload', () => Game.save(true));
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) Game.save(true);
        else Game.last = performance.now();
      });
      window.addEventListener('blur', () => Game.save(true));
      XG.Bus.on('save:conflict', data => Game.handleSaveConflict(data));

      Game.running = true;
      Game.last = performance.now();
      requestAnimationFrame(Game.loop);
    },

    bindEvents() {
      if (Game.eventsBound) return;
      Game.eventsBound = true;
      XG.Bus.on('battle:end', () => { Game.saveTimer = 999; });
      XG.Bus.on('realm:up', r => {
        const nz = XG.Combat.totalZones();
        for (let i = 0; i < nz; i++) {
          const z = XG.Combat.zoneAt(i);
          if (z.realm === r) { XG.State.s.explore.zone = i; break; }
        }
        MT.markDirty();
      });
      XG.Bus.on('explore:change', () => { Game.syncToggles(); MT.markDirty('explore'); });
      XG.Bus.on('explore:toggle', () => { Game.syncToggles(); MT.markDirty('explore'); });
    },

    loadData(result) {
      if (result && typeof result === 'object' && result.status) {
        if (result.status !== 'ok') return null;
        return result.data || result.state || result.value || result.save || null;
      }
      return result || null;
    },

    save(silent) {
      if (Game.saveBlocked) {
        if (!silent) Game.showRecovery();
        return { status: 'blocked' };
      }
      let result;
      try { result = XG.State.Save.save(silent); } catch (e) {
        result = { status: 'error', error: e };
      }
      if (result && (result.status === 'conflict' || result.conflict)) {
        Game.handleSaveConflict(result);
      } else if (!result && XG.State.Save.hasConflict && XG.State.Save.hasConflict()) {
        Game.handleSaveConflict(XG.State.Save.conflict);
      } else if (result && result.status === 'error' && !silent) {
        XG.Float.show('保存失败：浏览器存储不可用', 'bad');
      } else if (!result && !silent) {
        XG.Float.show('保存失败：浏览器存储不可用', 'bad');
      }
      return result;
    },

    saveOk(result) {
      return result === true || !!(result && (result.ok || result.status === 'ok'));
    },

    handleSaveConflict(data) {
      Game.saveBlocked = true;
      Game.status('存档冲突，自动保存已暂停');
      if (XG.State.Save.lock) XG.State.Save.lock();
      const now = Date.now();
      if (now - Game.lastSaveNotice < 1500) return;
      Game.lastSaveNotice = now;
      const reason = data && data.reason === 'external-update'
        ? '检测到其他页面更新了存档'
        : (data && data.reason ? data.reason : '检测到其他页面更新了存档');
      XG.Modals.result('存档冲突', '为避免覆盖其他页面的进度，自动保存已暂停',
        `${UI.esc(reason)}<br><br>请先备份当前页面，再刷新并重新载入。`, null);
    },

    showRecovery() {
      Game.status('存档读取失败，请选择恢复方式');
      XG.Modals.recovery(Game.recoveryReason || '存档读取失败',
        () => Game.retryLoad(), () => Game.discardRecovery());
    },

    retryLoad() {
      let result;
      try { result = XG.State.Save.load(); } catch (e) { result = { status: 'error', error: e }; }
      const loaded = Game.loadData(result);
      if (loaded) {
        Game.saveBlocked = false;
        Game.recoveryReason = '';
        if (XG.State.Save.unlock) XG.State.Save.unlock();
        XG.State.set(loaded);
        if (XG.Combat.rememberTower) XG.Combat.rememberTower();
        if (!Game.eventsBound) Game.bindEvents();
        const rep = XG.Cult.applyOffline();
        window.__offlineReport = rep;
        if (XG.State.s.explore.running) XG.Combat.setExploring(true);
        XG.Modals.close();
        MT.markDirty();
        MT.show('cultivate', true);
        Game.syncToggles();
        Game.updateTracker();
        if (rep) XG.Modals.offline(rep);
        return true;
      }
      if (result && result.status === 'error') {
        Game.recoveryReason = result.error && result.error.message ? result.error.message : '存档仍然无法读取';
        XG.Modals.recovery(Game.recoveryReason, () => Game.retryLoad(), () => Game.discardRecovery());
        return false;
      }
      Game.discardRecovery();
      return false;
    },

    discardRecovery() {
      if (XG.State.Save.wipe && !XG.State.Save.wipe()) {
        XG.Float.show('无法清除旧存档', 'bad');
        return false;
      }
      if (XG.State.Save.unlock) XG.State.Save.unlock();
      Game.saveBlocked = false;
      Game.recoveryReason = '';
      XG.State.reset();
      if (XG.Combat.rememberTower) XG.Combat.rememberTower();
      XG.State.addLog('已放弃无法读取的旧档，当前为新的临时旅程。', 'event');
      XG.Modals.close();
      MT.markDirty();
      MT.show('cultivate', true);
      Game.save(true);
      return true;
    },

    setExploring(on) {
      if (!XG.Combat || typeof XG.Combat.setExploring !== 'function') return { ok: false, reason: 'unsupported' };
      return XG.Combat.setExploring(!!on);
    },

    status(text) {
      const el = document.getElementById('ui-status');
      if (el && el.textContent !== text) el.textContent = text;
    },

    /* ══════ 顶栏 ══════ */
    bindTop() {
      document.getElementById('btn-settings').addEventListener('click', () => XG.Modals.settings());
      const rb = document.getElementById('realm-badge');
      rb.style.cursor = 'pointer';
      rb.addEventListener('click', () => MT.show('cultivate'));

      const goto = { 'res-stone': 'cave', 'res-herb': 'alchemy', 'res-jade': 'gacha' };
      for (const id in goto) {
        const el = document.getElementById(id);
        if (!el) continue;
        el.style.cursor = 'pointer';
        el.addEventListener('click', () => MT.show(goto[id]));
      }

      /* 日志栏收起 / 展开（状态记忆在本地） */
      const fold = document.getElementById('btn-fold-log');
      const lay = document.getElementById('layout');
      const applyFold = (off) => {
        if (lay) lay.classList.toggle('log-off', off);
        if (fold) {
          fold.textContent = off ? '◂ 展开日志' : '收起 ▸';
          fold.setAttribute('aria-expanded', off ? 'false' : 'true');
        }
      };
      if (fold) fold.addEventListener('click', () => {
        const off = !(lay && lay.classList.contains('log-off'));
        applyFold(off);
        try { window.localStorage.setItem('xiantu_log_off', off ? '1' : '0'); } catch (e) { /* ignore */ }
      });
      try { applyFold(window.localStorage.getItem('xiantu_log_off') === '1'); } catch (e) { /* ignore */ }

      const mobileLog = document.getElementById('btn-log');
      const mobileClose = document.getElementById('btn-log-close');
      const setMobileLog = (open) => {
        document.body.classList.toggle('log-mobile-open', open);
        if (mobileLog) mobileLog.setAttribute('aria-expanded', open ? 'true' : 'false');
      };
      if (mobileLog) mobileLog.addEventListener('click', () => setMobileLog(true));
      if (mobileClose) mobileClose.addEventListener('click', () => setMobileLog(false));
      document.addEventListener('keydown', ev => {
        if (ev.key === 'Escape' && document.body.classList.contains('log-mobile-open')) setMobileLog(false);
      });
    },

    updateTop() {
      const s = XG.State.s, C = XG.State.Calc;
      const mods = UI.mods();
      const set = (id, v) => { const e = document.getElementById(id); if (e && e.textContent !== v) e.textContent = v; };

      set('realm-name', R.name(s.realm, s.layer));
      const rb = XG.REALMS[s.realm];
      set('realm-sub', rb.desc.slice(0, 10));

      const need = C.need();
      const pct = need > 0 ? U.clamp(s.spirit / need, 0, 1) : 0;
      const fill = document.getElementById('cult-fill');
      if (fill) fill.style.width = (pct * 100) + '%';
      const progress = document.getElementById('cult-progress');
      if (progress) progress.setAttribute('aria-valuenow', String(Math.round(pct * 100)));
      const glow = document.getElementById('cult-glow');
      if (glow) glow.style.left = `calc(${(pct * 100)}% - 26px)`;
      set('cult-num', `${U.fmt(s.spirit)} / ${U.fmt(need)}`);
      const spiritRate = XG.CONFIG.BASE_SPIRIT_RATE * mods.spirit;
      set('cult-rate', `+${U.fmt(spiritRate)}/秒`);
      const sec = spiritRate > 0 ? C.remain() / spiritRate : Infinity;
      if (R.isMax(s.realm, s.layer)) set('cult-eta', '已臻化境 · 可考虑飞升');
      else if (pct >= 1) set('cult-eta', '灵气已满，随时可以突破');
      else set('cult-eta', isFinite(sec) ? `预计突破 ${U.clock(sec)}` : '');

      set('val-stone', U.fmt(s.res.stone));
      set('val-herb', U.fmt(s.res.herb));
      set('val-jade', U.fmt(s.res.jade));

      /* 天象 */
      const chip = document.getElementById('omen-chip');
      if (chip) {
        const def = XG.Omen.active();
        if (def) {
          chip.classList.add('on');
          chip.classList.toggle('bad', !def.good);
          set('omen-ico', def.icon);
          set('omen-txt', def.name);
          set('omen-time', U.clock(XG.Omen.left()));
        } else {
          chip.classList.remove('on', 'bad');
          set('omen-ico', '🌤');
          set('omen-txt', '天象未起');
          set('omen-time', XG.Omen.nextIn() > 0 ? U.clock(XG.Omen.nextIn()) : '');
        }
      }
    },

    /* ══════ 底栏「道途」入口 ══════
       替代原先常驻浮动的引导条：只占底栏一小格，
       不遮挡内容；目标达成时短暂高亮提示。 */
    bindTracker() {
      const chip = document.getElementById('quest-chip');
      if (!chip) return;
      chip.addEventListener('click', () => MT.show('quest'));
      XG.Bus.on('quest:change', () => Game.updateTracker());
      XG.Bus.on('quest:ready', () => Game.flashQuestChip());
      Game.updateTracker();
    },

    flashQuestChip() {
      const chip = document.getElementById('quest-chip');
      if (!chip) return;
      chip.classList.remove('flash');
      void chip.offsetWidth;              // 强制重排以重启动画
      chip.classList.add('flash');
      clearTimeout(Game._qflash);
      Game._qflash = setTimeout(() => chip.classList.remove('flash'), 2800);
    },

    updateTracker() {
      const chip = document.getElementById('quest-chip');
      if (!chip) return;
      const q = XG.Quest.current();
      if (!q) { chip.classList.add('hidden'); return; }
      chip.classList.remove('hidden');
      const ready = XG.Quest.reached();
      chip.classList.toggle('ready', ready);
      const set = (id, v) => { const e = document.getElementById(id); if (e && e.textContent !== v) e.textContent = v; };
      set('qc-ico', q.icon);
      set('qc-txt', (ready ? '✦ ' : '') + q.title);
      set('qc-step', (XG.Quest.index() + 1) + '/' + XG.Quest.total());
       chip.title = ready
         ? `可领取奖励：${q.title}`
         : `当前道途：${q.title} —— ${q.desc}`;
       chip.setAttribute('aria-label', ready ? `领取道途奖励：${q.title}` : `当前道途：${q.title}`);
    },

    /* ══════ 底栏 ══════ */
    bindBottom() {
      document.getElementById('toggle-auto-break').addEventListener('click', () => {
        const s = XG.State.s; s.settings.autoBreak = !s.settings.autoBreak; Game.syncToggles();
      });
      document.getElementById('toggle-auto-pill').addEventListener('click', () => {
        const s = XG.State.s; s.settings.autoPill = !s.settings.autoPill; Game.syncToggles();
      });
      document.getElementById('toggle-explore').addEventListener('click', () => {
        const on = !XG.State.s.explore.running;
         XG.Combat.setExploring(on);
         XG.State.s.explore.progress = 0;
         if (typeof XG.Combat.resetExploreProgress === 'function') XG.Combat.resetExploreProgress();
         Game.syncToggles();
        MT.markDirty('explore');
        XG.Bus.emit('explore:toggle');
      });
    },

    syncToggles() {
      const s = XG.State.s;
      const map = [
        ['toggle-auto-break', () => !!s.settings.autoBreak],
        ['toggle-auto-pill', () => !!s.settings.autoPill],
        ['toggle-explore', () => !!s.explore.running],
      ];
      for (const [id, getOn] of map) {
        const btn = document.getElementById(id);
        if (!btn) continue;
        const on = getOn();
        btn.classList.toggle('on', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        const st = btn.querySelector('.tg-state');
        if (st) st.textContent = on ? '开' : '关';
      }
    },

    updateBottom() {
      const s = XG.State.s, C = XG.State.Calc;
      const p = UI.playerStats();
      const host = document.getElementById('bb-stats');
      if (!host) return;
      const items = [
        ['战力', U.fmt(C.power(p)), ''],
        ['攻', U.fmt(p.atk), 'atk'],
        ['防', U.fmt(p.def), 'def'],
        ['血', U.fmt(p.maxHp), 'hp'],
        ['暴击', U.pct(p.crit, 1), 'hide-sm'],
        ['速度', '×' + p.spd.toFixed(2), 'hide-sm'],
        ['塔', s.tower.best + '层', 'hide-sm'],
        ['道果', XG.Achieve.count() + '/' + XG.ACHIEVEMENTS.length, 'hide-sm'],
        ['飞升', s.prestige.times + '次', 'hide-sm'],
      ];
      const html = items.map(([k, v, c]) => `<span class="bb-stat ${c}">${k} <b>${v}</b></span>`).join('');
      if (Game.lastBottomKey !== html) {
        Game.lastBottomKey = html;
        host.innerHTML = html;
      }

      const t = document.getElementById('bb-time');
      if (t) {
        const day = Math.floor(s.stats.playTime / 300) + 1;
        const text = `第 ${day} 天 · ${U.time(s.stats.playTime)}`;
        if (t.textContent !== text) t.textContent = text;
      }
    },

    /* ══════ 主循环 ══════ */
    loop(now) {
      if (!Game.running) return;
      let dt = (now - Game.last) / 1000;
      Game.last = now;
      if (!isFinite(dt) || dt < 0) dt = 0;
      dt = Math.min(dt, 0.5);

      if (!document.hidden) {
        try {
          XG.Cult.tick(dt);
          XG.Combat.tickBattle(dt);
          XG.Combat.tickExplore(dt);
        } catch (e) {
          console.error('[tick]', e);
        }
      }

      Game.uiTimer += dt;
      if (Game.uiTimer >= 0.12) {
        Game.uiTimer = 0;
        try {
          UI.invalidateCalc();
          XG.MT.reconcile();
          Game.updateTop();
          Game.updateBottom();
          XG.MT.refresh();
        } catch (e) { console.error('[ui]', e); }
      }

      Game.dotTimer += dt;
      if (Game.dotTimer >= 1) {
        Game.dotTimer = 0;
        try { XG.MT.updateDots(); } catch (e) { console.error('[dots]', e); }
      }

      /* 自动存档 */
      Game.saveTimer += dt;
      if (Game.saveTimer >= XG.CONFIG.AUTO_SAVE_INTERVAL) {
        Game.saveTimer = 0;
        try { Game.save(true); } catch (e) { console.error('[save]', e); }
      }

      requestAnimationFrame(Game.loop);
    },
  };

  XG.Game = Game;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => Game.boot());
  else Game.boot();
})();

/* ═══════════════════════════════════════════
   modals.js — 弹窗系统 / 设置 / 奇遇 / 确认 / 离线结算
   ═══════════════════════════════════════════ */
(function () {
  'use strict';
  const XG = window.XG;
  const U = XG.U;
  const UI = XG.UI, MT = XG.MT;

  const Modals = {
    stack: [],
    previousFocus: null,
    isolated: [],
    backgroundLocks: [],
    isolationSnapshot: null,
    modalIsolationToken: null,
    focusToken: 0,
    activeEvent: null,
    initialized: false,
    init() {
      if (Modals.initialized) return;
      Modals.initialized = true;
      XG.Bus.on('event:show', d => Modals.event(d.ev));
      XG.Bus.on('event:result', d => Modals.eventResult(d));
      XG.Bus.on('event:close', () => Modals.eventClose());
      const mask = document.getElementById('modal-mask');
      if (mask) mask.addEventListener('click', () => Modals.closeTop());
      document.addEventListener('keydown', Modals.onKeyDown);
    },

    backgroundRoot(overlay) {
      let node = overlay;
      while (node && node.parentElement && node.parentElement !== document.body) node = node.parentElement;
      return node && node.parentElement === document.body ? node : null;
    },

    restoreNode(item) {
      const el = item.el;
      if (!el) return;
      try { el.inert = item.inert; } catch (e) { }
      if (item.inertAttr) el.setAttribute('inert', '');
      else el.removeAttribute('inert');
      if (item.aria === null) el.removeAttribute('aria-hidden');
      else el.setAttribute('aria-hidden', item.aria);
    },

    applyIsolation() {
      if (!Modals.backgroundLocks.length) {
        if (Modals.isolationSnapshot) Modals.isolationSnapshot.forEach(Modals.restoreNode);
        Modals.isolationSnapshot = null;
        Modals.isolated = [];
        return;
      }
      const nodes = Array.prototype.slice.call(document.body.children);
      if (!Modals.isolationSnapshot) {
        Modals.isolationSnapshot = nodes.map(el => ({
          el,
          inert: !!el.inert,
          inertAttr: el.hasAttribute('inert'),
          aria: el.getAttribute('aria-hidden'),
        }));
      }
      const activeRoot = Modals.backgroundLocks[Modals.backgroundLocks.length - 1].root;
      Modals.isolated = [];
      for (const el of nodes) {
        const saved = Modals.isolationSnapshot.find(item => item.el === el)
          || { el, inert: false, inertAttr: false, aria: el.getAttribute('aria-hidden') };
        Modals.restoreNode(saved);
        if (el === activeRoot) {
          if (el.id === 'modal-layer') el.setAttribute('aria-hidden', 'false');
          continue;
        }
        try { el.inert = true; } catch (e) { }
        el.setAttribute('inert', '');
        el.setAttribute('aria-hidden', 'true');
        Modals.isolated.push(saved);
      }
    },

    lockBackground(overlay) {
      const token = { overlay, root: Modals.backgroundRoot(overlay) };
      Modals.backgroundLocks.push(token);
      Modals.applyIsolation();
      return token;
    },

    unlockBackground(token) {
      const i = Modals.backgroundLocks.indexOf(token);
      if (i >= 0) Modals.backgroundLocks.splice(i, 1);
      Modals.applyIsolation();
    },

    isolate(on) {
      const layer = document.getElementById('modal-layer');
      if (!layer) return;
      if (on) {
        if (!Modals.modalIsolationToken) Modals.modalIsolationToken = Modals.lockBackground(layer);
      } else if (Modals.modalIsolationToken) {
        const token = Modals.modalIsolationToken;
        Modals.modalIsolationToken = null;
        Modals.unlockBackground(token);
      }
    },

    activeBackgroundRoot() {
      const top = Modals.backgroundLocks[Modals.backgroundLocks.length - 1];
      return top ? top.root : null;
    },

    isBackgroundActive(overlay) {
      return !!overlay && Modals.activeBackgroundRoot() === Modals.backgroundRoot(overlay);
    },

    canFocus(el) {
      if (!el || !document.contains(el) || el.disabled || el.hidden) return false;
      return !el.closest('[inert],[aria-hidden="true"]');
    },

    focusable(root) {
      const box = root || document.getElementById('modal-box');
      if (!box) return [];
      return UI.$$('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[contenteditable="true"],[tabindex]:not([tabindex="-1"])', box)
        .filter(el => Modals.canFocus(el));
    },

    onKeyDown(ev) {
      const layer = document.getElementById('modal-layer');
      if (!Modals.stack.length || !Modals.isBackgroundActive(layer)) return;
      const top = Modals.stack[Modals.stack.length - 1];
      if (ev.key === 'Escape') {
        if (top.noDismiss) return;
        ev.preventDefault();
        Modals.closeTop();
        return;
      }
      if (ev.key !== 'Tab') return;
      const focusable = Modals.focusable();
      if (!focusable.length) {
        ev.preventDefault();
        const box = document.getElementById('modal-box');
        if (box) box.focus();
        return;
      }
      const first = focusable[0], last = focusable[focusable.length - 1];
      const box = document.getElementById('modal-box');
      if (!box || !box.contains(document.activeElement) || document.activeElement === box) {
        ev.preventDefault();
        (ev.shiftKey ? last : first).focus();
      } else if (ev.shiftKey && document.activeElement === first) {
        ev.preventDefault();
        last.focus();
      } else if (!ev.shiftKey && document.activeElement === last) {
        ev.preventDefault();
        first.focus();
      }
    },

    open(html, opts) {
      if (!Modals.initialized) Modals.init();
      opts = opts || {};
      const layer = document.getElementById('modal-layer');
      const box = document.getElementById('modal-box');
      if (!layer || !box) return box;
      if (!Modals.stack.length) {
        Modals.previousFocus = document.activeElement;
        Modals.isolate(true);
      }
      const focusVersion = ++Modals.focusToken;
      box.className = 'modal-box' + (opts.wide ? ' wide' : '') + (opts.danger ? ' danger' : '');
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      box.setAttribute('tabindex', '-1');
      box.removeAttribute('aria-hidden');
      box.onclick = null;
      box.innerHTML = html;
      const title = box.querySelector('.modal-title');
      if (title) {
        if (!title.id) title.id = 'modal-title-' + Date.now();
        box.setAttribute('aria-labelledby', title.id);
      } else box.removeAttribute('aria-labelledby');
      layer.classList.remove('hidden');
      layer.setAttribute('aria-hidden', 'false');
      Modals.stack.push(opts);
      const focusFirst = () => {
        if (!Modals.stack.length || Modals.focusToken !== focusVersion || !Modals.isBackgroundActive(layer)) return;
        const first = Modals.focusable()[0];
        (first || box).focus();
      };
      focusFirst();
      setTimeout(focusFirst, 0);
      return box;
    },

    close() {
      const layer = document.getElementById('modal-layer');
      const box = document.getElementById('modal-box');
      const focusVersion = ++Modals.focusToken;
      if (Modals.activeEvent && (!box || Modals.activeEvent.box === box)) Modals.activeEvent = null;
      if (layer) {
        layer.classList.add('hidden');
        layer.setAttribute('aria-hidden', 'true');
      }
      if (box) {
        box.innerHTML = '';
        box.onclick = null;
        box.removeAttribute('aria-labelledby');
      }
      Modals.stack.length = 0;
      Modals.isolate(false);
      const focus = Modals.previousFocus;
      Modals.previousFocus = null;
      if (Modals.canFocus(focus)) {
        focus.focus();
        setTimeout(() => {
          if (Modals.focusToken === focusVersion && Modals.canFocus(focus)) focus.focus();
        }, 0);
      }
    },

    closeTop() {
      const layer = document.getElementById('modal-layer');
      if (!Modals.stack.length || !Modals.isBackgroundActive(layer)) return;
      const top = Modals.stack[Modals.stack.length - 1];
      if (top && top.noDismiss) return;
      Modals.close();
    },

    confirm(title, body, onOk, okText, danger) {
      const box = Modals.open(`
        <div class="modal-title">${title}</div>
        <div class="modal-body">${body}</div>
        <div class="modal-actions">
          <button class="btn" id="m-cancel" type="button">取消</button>
          <button class="btn ${danger ? 'danger' : 'primary'}" id="m-ok" type="button">${okText || '确定'}</button>
        </div>`, { danger: !!danger });
      box.querySelector('#m-cancel').onclick = () => Modals.close();
      box.querySelector('#m-ok').onclick = () => { Modals.close(); onOk && onOk(); };
    },

    result(title, sub, body, arts) {
      let extra = '';
      if (arts && arts.length) {
        extra = `<div class="grid g2" style="margin-top:12px">` + arts.map(a => `
          <div class="item-card q${a.q}">
            <div class="item-head"><div class="item-ico">${XG.ART_TYPE[a.type].icon}</div>
            <div class="item-name">《${a.name}》</div><span class="item-tag">${U.QUALITY[a.q].name}</span></div>
            <div class="item-desc">${a.desc}</div>
            <div class="item-stats"><span class="item-stat jade">${XG.ART_TYPE[a.type].tag} +${U.pct(a.eff, 0)}/重</span></div>
          </div>`).join('') + `</div>`;
      }
      const box = Modals.open(`
        <div class="modal-title">${title}</div>
        <div class="modal-sub">${sub || ''}</div>
        <div class="modal-body">${body}</div>
        ${extra}
         <div class="modal-actions"><button class="btn primary" id="m-ok" type="button">知道了</button></div>`);
      box.querySelector('#m-ok').onclick = () => Modals.close();
    },

    recovery(reason, onRetry, onDiscard) {
      const box = Modals.open(`
        <div class="modal-title">存档恢复</div>
        <div class="modal-sub">读取存档时发生错误</div>
        <div class="modal-body">${UI.esc(reason || '存档内容无法读取')}。为避免覆盖原存档，自动保存已暂停。</div>
        <div class="modal-actions">
          <button class="btn" id="m-retry" type="button">重试读取</button>
          <button class="btn danger" id="m-discard" type="button">放弃旧档并重新开始</button>
        </div>`, { noDismiss: true, danger: true });
      box.querySelector('#m-retry').onclick = onRetry;
      box.querySelector('#m-discard').onclick = onDiscard;
    },

    /* ══════ 天劫确认 ══════ */
    askTribulation() {
      const s = XG.State.s, C = XG.State.Calc;
       const p = UI.playerStats();
      const e = XG.Combat.makeTribulation(s.realm + 1);
      const r = C.power(p) / Math.max(1, C.power(e));
      const box = Modals.open(`
        <div class="modal-title">引动天劫</div>
        <div class="modal-sub">${XG.R.name(s.realm, s.layer)} → ${XG.REALMS[s.realm + 1].name}境</div>
        <div class="modal-body">
          跨越大境界必受天劫。此战为真实战斗，若败北将散失部分灵气，但道基不损，可再战。<br><br>
          <div style="display:flex;gap:14px;justify-content:center;margin-top:10px">
            <div style="text-align:center">
              <div class="hint">我方战力</div>
              <div style="font-family:var(--font-serif);font-size:20px;color:var(--jade-2)">${U.fmt(C.power(p))}</div>
            </div>
            <div style="text-align:center">
              <div class="hint">天劫战力</div>
              <div style="font-family:var(--font-serif);font-size:20px;color:#ff9aa8">${U.fmt(C.power(e))}</div>
            </div>
          </div>
          <div class="hint" style="text-align:center;margin-top:12px">
            ${r > 1.5 ? '你的实力已足以碾压此劫。' : r > 1.1 ? '天道垂青，胜算在握。' : r > 0.9 ? '势均力敌，需看机缘。' : '实力尚有不足，凶险异常。'}
          </div>
        </div>
        <div class="modal-actions">
           <button class="btn" id="m-cancel" type="button">再作准备</button>
           <button class="btn primary" id="m-ok" type="button">迎雷而上</button>
        </div>`, { noDismiss: false });
      box.querySelector('#m-cancel').onclick = () => Modals.close();
      box.querySelector('#m-ok').onclick = () => { Modals.close(); XG.Cult.startTribulation(); };
    },

    /* ══════ 奇遇 ══════ */
    choiceCostParts(ev, ch) {
      const rawCost = ch && ch.cost && typeof ch.cost === 'object' ? ch.cost : {};
      let cost = Object.assign({}, rawCost);
      if (XG.Events && typeof XG.Events.choiceCost === 'function') {
        try {
          const resolved = XG.Events.choiceCost(ev, ch);
          if (resolved && typeof resolved === 'object') cost = Object.assign(cost, resolved);
        } catch (e) { }
      }
      if (!cost || typeof cost !== 'object') cost = {};
      const s = XG.State.s;
      const parts = [];
      const seen = Object.create(null);
      const positive = value => {
        const n = Number(value);
        return isFinite(n) && n > 0 ? n : 0;
      };
      const add = (key, text, ok) => {
        if (seen[key]) return;
        seen[key] = true;
        parts.push({ text, ok: !!ok });
      };
      const pillEntries = value => {
        if (typeof value === 'string') return [[value, 1]];
        if (typeof value === 'number') return [['p_ningshen', positive(value)]];
        if (Array.isArray(value)) {
          return value.map(item => typeof item === 'string'
            ? [item, 1]
            : [item && (item.id || item.pillId), positive(item && (item.n || item.count || item.amount || item.pillN))]);
        }
        if (value && typeof value === 'object') {
          const id = value.id || value.pillId;
          if (id) return [[id, positive(value.n || value.count || value.amount || value.pillN)]];
          return Object.keys(value).map(id => [id, positive(value[id])]);
        }
        return [];
      };
      const addPill = (id, count) => {
        id = String(id || '');
        count = positive(count);
        if (!id || !count) return;
        const def = Object.prototype.hasOwnProperty.call(XG.idx.pill, id) ? XG.idx.pill[id] : null;
        add('pill:' + id, `丹药 ${def ? def.name : id} ×${U.fmt(count)}`, positive(s.pills[id]) >= count);
      };
      const materialEntries = value => {
        if (typeof value === 'string') return [[value, 1]];
        if (Array.isArray(value)) {
          return value.map(item => typeof item === 'string'
            ? [item, 1]
            : [item && (item.id || item.materialId || item.matId), positive(item && (item.n || item.count || item.amount || item.materialN || item.matN))]);
        }
        if (value && typeof value === 'object') {
          const id = value.id || value.materialId || value.matId;
          if (id) return [[id, positive(value.n || value.count || value.amount || value.materialN || value.matN)]];
          return Object.keys(value).map(id => [id, positive(value[id])]);
        }
        return [];
      };
      const addMaterial = (id, count) => {
        id = String(id || '');
        count = positive(count);
        if (!id || !count) return;
        const def = Object.prototype.hasOwnProperty.call(XG.idx.mat, id) ? XG.idx.mat[id] : null;
        add('mat:' + id, `${def ? def.name : id} ×${U.fmt(count)}`, positive(s.mats[id]) >= count);
      };
      const addGem = (id, tier, count) => {
        id = String(id || '');
        if (!id) return;
        const last = id.lastIndexOf('_');
        const parsedId = last > 0 ? id.slice(0, last) : id;
        const parsedTier = last > 0 ? positive(id.slice(last + 1)) : 0;
        const hasEmbeddedTier = last > 0 && parsedTier > 0
          && Object.prototype.hasOwnProperty.call(XG.idx.gem, parsedId);
        const defId = hasEmbeddedTier ? parsedId : id;
        const gemTier = Math.max(1, Math.floor(positive(tier) || parsedTier || 1));
        count = positive(count);
        if (!count) return;
        const def = Object.prototype.hasOwnProperty.call(XG.idx.gem, defId) ? XG.idx.gem[defId] : null;
        const key = defId + '_' + gemTier;
        add('gem:' + key, `宝石 ${def ? def.name : defId} ${gemTier}阶 ×${U.fmt(count)}`, positive(s.gems[key]) >= count);
      };
      const gemEntries = value => {
        if (typeof value === 'string') return [[value, value.costGemTier, value.costGemN || 1]];
        if (Array.isArray(value)) {
          return value.map(item => typeof item === 'string'
            ? [item, 1, 1]
            : [item && (item.id || item.gemId), positive(item && (item.tier || item.gemTier)), positive(item && (item.n || item.count || item.amount || item.gemN))]);
        }
        if (value && typeof value === 'object') {
          const id = value.id || value.gemId;
          if (id) return [[id, positive(value.tier || value.gemTier), positive(value.n || value.count || value.amount || value.gemN)]];
          return Object.keys(value).map(id => [id, 0, positive(value[id])]);
        }
        return [];
      };
      const jade = positive(cost.jade);
      const herb = positive(cost.herb);
      const stone = positive(cost.stone);
      const spirit = positive(cost.spirit);
      if (jade) add('jade', `仙玉 ${U.fmt(jade)}`, positive(s.res.jade) >= jade);
      if (herb) add('herb', `灵草 ${U.fmt(herb)}`, positive(s.res.herb) >= herb);
      if (stone) add('stone', `灵石 ${U.fmt(stone)}`, positive(s.res.stone) >= stone);
      const factor = positive(cost.stoneFactor);
      if (factor) {
        const amount = Math.max(0, Math.ceil(XG.baseAtkAt(s.realm) * 30 * factor * UI.mods().stoneGain));
        if (amount) add('stoneFactor', `灵石 ${U.fmt(amount)}（按境界）`, positive(s.res.stone) - stone >= amount);
      }
      pillEntries(cost.pill).forEach(x => addPill(x[0], cost.pillN || x[1]));
      pillEntries(cost.pills).forEach(x => addPill(x[0], x[1]));
      materialEntries(cost.material).forEach(x => addMaterial(x[0], cost.materialN || x[1]));
      materialEntries(cost.materials).forEach(x => addMaterial(x[0], x[1]));
      materialEntries(cost.mat).forEach(x => addMaterial(x[0], x[1]));
      materialEntries(cost.mats).forEach(x => addMaterial(x[0], x[1]));
      gemEntries(cost.gem).forEach(x => addGem(x[0], cost.gemTier || x[1], cost.gemN || x[2]));
      gemEntries(cost.gems).forEach(x => addGem(x[0], x[1], x[2]));
      if (cost.materialId) addMaterial(cost.materialId, cost.materialN || cost.matN || 1);
      if (cost.matId) addMaterial(cost.matId, cost.matN || 1);
      if (cost.gemId) addGem(cost.gemId, cost.gemTier, cost.gemN || 1);
      const type = String(cost.type || '').toLowerCase();
      if (type === 'pill' && cost.id) addPill(cost.id, cost.n || cost.count || cost.amount);
      if ((type === 'material' || type === 'mat') && cost.id) addMaterial(cost.id, cost.n || cost.count || cost.amount);
      if (type === 'gem' && (cost.id || cost.gemId)) addGem(cost.id || cost.gemId, cost.tier, cost.n || cost.count || cost.amount);
      return { parts, affordable: parts.every(part => part.ok) };
    },

    update() {
      const active = Modals.activeEvent;
      if (!active || !active.box || !active.box.isConnected || !Array.isArray(active.choices)) return;
      active.choices.forEach((choice, i) => {
        const button = active.box.querySelector(`[data-i="${i}"]`);
        if (!button) return;
        const can = Modals.choiceCostParts(active.ev, choice).affordable;
        button.disabled = !can;
        button.setAttribute('aria-disabled', can ? 'false' : 'true');
      });
    },

    event(ev) {
      const list = Array.isArray(ev.choices) ? ev.choices : [];
      let choices = '';
      if (list.length) {
        choices = `<div class="choice-list">` + list.map((choice, i) => {
          const detail = Modals.choiceCostParts(ev, choice);
          const costTxt = detail.parts.length
            ? `<div class="c-cost">代价：${detail.parts.map(part => `<span class="${part.ok ? 'full' : 'no'}">${UI.esc(part.text)}</span>`).join('、')}</div>`
            : '';
          return `<button class="choice" type="button" data-i="${i}" aria-label="选择：${UI.esc(choice.title)}" aria-disabled="${detail.affordable ? 'false' : 'true'}" ${detail.affordable ? '' : 'disabled'}>
            <div class="c-title">${UI.esc(choice.title)}</div>
            <div class="c-desc">${UI.esc(choice.desc)}</div>${costTxt}
          </button>`;
        }).join('') + `</div>`;
      } else {
        choices = `<div class="modal-actions"><button class="btn primary" id="m-ok" type="button">继续</button></div>`;
      }
      Modals.activeEvent = { ev, choices: list, box: null };
      const box = Modals.open(`
        <div class="modal-title">${UI.esc(ev.icon)} ${UI.esc(ev.name)}</div>
        <div class="modal-sub">奇遇 · 机缘</div>
        <div class="modal-body">${UI.esc(ev.text)}</div>
        ${choices}`, { noDismiss: true });
      if (Modals.activeEvent) Modals.activeEvent.box = box;

      if (list.length) {
        box.querySelectorAll('.choice').forEach(button => {
          button.onclick = () => {
            const result = XG.Events.choose(ev, +button.dataset.i);
            if (!result || !result.ok) {
              if (result && result.reason) XG.Float.show(result.reason, 'bad');
              Modals.update();
              return;
            }
            XG.Game.save(true);
          };
        });
      } else {
        const ok = box.querySelector('#m-ok');
        if (ok) ok.onclick = () => { XG.Events.close(); XG.Game.save(true); };
      }
    },

    eventResult(d) {
      Modals.activeEvent = null;
      MT.refresh();
      const ev = d.ev || {};
      const box = Modals.open(`
        <div class="modal-title">${UI.esc(ev.icon)} ${UI.esc(ev.name)}</div>
        <div class="modal-sub">你的抉择：${UI.esc(d.title || '静观其变')}</div>
        <div class="modal-body" style="text-align:center;font-size:15px;color:var(--gold-2)">${UI.esc(d.text)}</div>
        <div class="modal-actions"><button class="btn primary" id="m-ok" type="button">继续前行</button></div>`);
      box.querySelector('#m-ok').onclick = () => { Modals.close(); MT.refresh(); };
    },

    eventClose() {
      const active = Modals.activeEvent;
      Modals.activeEvent = null;
      if (active && active.box && active.box.isConnected) Modals.close();
      MT.refresh();
    },

    /* ══════ 设置 ══════ */
    settings() {
      const s = XG.State.s;
      const box = Modals.open(`
        <div class="modal-title">设置</div>
        <div class="modal-sub">仙途 · 挂机修仙录</div>
        <div class="modal-body">
          <div style="display:flex;flex-direction:column;gap:10px">
            <label style="display:flex;align-items:center;gap:10px">
              <input type="checkbox" id="set-auto-break" ${s.settings.autoBreak ? 'checked' : ''}>
              <span>灵气满时自动突破</span>
            </label>
            <label style="display:flex;align-items:center;gap:10px">
              <input type="checkbox" id="set-auto-pill" ${s.settings.autoPill ? 'checked' : ''}>
              <span>自动服用丹药（聚气/凝神/破境）</span>
            </label>
            <label style="display:flex;align-items:center;gap:10px">
               <input type="checkbox" id="set-auto-explore" ${s.explore.running || s.settings.autoExplore ? 'checked' : ''}>
              <span>自动在秘境中探索</span>
            </label>
          </div>
          <hr style="border:none;border-top:1px solid rgba(255,255,255,.08);margin:16px 0">
          <div class="hint">
            存档状态：${XG.State.Save.exists() ? '已有存档（自动保存）' : '暂无存档'}<br>
            游戏时间：${U.time(s.stats.playTime)}｜飞升次数：${s.prestige.times}<br>
            累计击杀：${U.fmt(s.stats.kills)}｜累计突破：${s.stats.breakthroughs}
          </div>
        </div>
        <div class="modal-actions">
           <button class="btn" id="m-save" type="button">立即存档</button>
           <button class="btn danger" id="m-wipe" type="button">重置存档</button>
           <button class="btn primary" id="m-ok" type="button">关闭</button>
        </div>`);

      box.querySelector('#set-auto-break').onchange = e => { s.settings.autoBreak = e.target.checked; XG.Game.syncToggles(); };
      box.querySelector('#set-auto-pill').onchange = e => { s.settings.autoPill = e.target.checked; XG.Game.syncToggles(); };
       box.querySelector('#set-auto-explore').onchange = e => {
         XG.Combat.setExploring(e.target.checked);
         s.explore.progress = 0;
         XG.Game.syncToggles();
         XG.MT.markDirty('explore');
       };
       box.querySelector('#m-save').onclick = () => {
         const result = XG.Game.save(false);
         if (XG.Game.saveOk(result)) XG.Float.show('已保存', 'good');
         else if (result && result.status === 'error') XG.Float.show('保存失败：浏览器存储不可用', 'bad');
         else if (!result && !(XG.State.Save.hasConflict && XG.State.Save.hasConflict())) XG.Float.show('保存失败：浏览器存储不可用', 'bad');
       };
      box.querySelector('#m-wipe').onclick = () => {
        Modals.confirm('重置存档',
          `<b style="color:#ff9aa8">这将永久删除全部进度，无法恢复。</b><br><br>
           当前进度：${XG.R.name(s.realm, s.layer)}｜飞升 ${s.prestige.times} 次｜道果 ${XG.Achieve.count()}/${XG.ACHIEVEMENTS.length}<br><br>
           确定要重新开始吗？`,
          () => {
            XG.State.Save.wipe();          // 上锁 + 清空内存状态 + 删除存档
            if (XG.State.Save.exists()) {
              XG.State.Save.unlock();
              XG.Float.show('重置失败：浏览器存储被拒绝', 'bad');
              return;
            }
            try { location.reload(); } catch (e) { /* 某些内嵌环境不允许刷新 */ }
            // 兜底：若刷新被拦截，1.5 秒后恢复自动存档
            //（此时内存已是全新状态，写入的也是新档，不会复活旧进度）
            setTimeout(() => XG.State.Save.unlock(), 1500);
           }, '确认重置', true);
      };
      box.querySelector('#m-ok').onclick = () => Modals.close();
    },

    /* ══════ 离线结算 ══════ */
    offline(rep) {
      if (!rep) return;
      const box = Modals.open(`
        <div class="modal-title">闭关归来</div>
        <div class="modal-sub">离线 ${U.time(rep.seconds)}（有效结算 ${U.time(rep.capped)}）</div>
        <div class="modal-body" style="text-align:center">
          你闭关 ${U.time(rep.seconds)}，其间天地灵气自行汇聚于身。<br><br>
        </div>
        <div class="stat-row">
          ${rep.spirit > 0 ? `<div class="stat-cell"><div class="k">灵气</div><div class="v jade">+${U.fmt(rep.spirit)}</div></div>` : ''}
          ${rep.stone > 0 ? `<div class="stat-cell"><div class="k">灵石</div><div class="v">+${U.fmt(rep.stone)}</div></div>` : ''}
          ${rep.herb > 0 ? `<div class="stat-cell"><div class="k">灵草</div><div class="v jade">+${U.fmt(rep.herb)}</div></div>` : ''}
          ${rep.jade > 0 ? `<div class="stat-cell"><div class="k">仙玉</div><div class="v violet">+${U.fmt(rep.jade)}</div></div>` : ''}
          ${rep.breaks > 0 ? `<div class="stat-cell"><div class="k">自动突破</div><div class="v">${rep.breaks} 次</div></div>` : ''}
        </div>
        <div class="hint" style="text-align:center;margin-top:12px">离线收益效率为 ${Math.round(XG.CONFIG.OFFLINE_EFFICIENCY * 100)}%，最多结算 ${XG.CONFIG.OFFLINE_CAP_HOURS} 小时。</div>
         <div class="modal-actions"><button class="btn primary" id="m-ok" type="button">继续修行</button></div>`);
      box.querySelector('#m-ok').onclick = () => Modals.close();
    },

    /* ══════ 宝石选择（镶嵌） ══════ */
    pickGem(eqId, idx) {
      const found = XG.Forge.find(eqId);
      if (!found) return;
      const eq = found.eq;
      const list = XG.Forge.gemList();
      let html = `<div class="modal-title">镶嵌宝石</div>
        <div class="modal-sub">${UI.esc(eq.name)} · 第 ${idx + 1} 孔</div>
        <div class="modal-body">`;
      if (!list.length) {
        html += `<div class="empty"><span class="e-ico">🔮</span>暂无宝石（秘境、通天塔与寻宝阁均可获得）</div>`;
      } else {
        html += `<div class="gem-pick">` + list.map(g => {
          const val = g.def.val * Math.pow(XG.GEM_TIER_MULT, g.tier - 1);
          const af = XG.AFFIX.find(a => a.key === g.def.stat);
          return `<button class="gem-pick-item" type="button" data-g="${g.key}" aria-label="选择${g.def.name}" style="--gc:${g.def.color}">
            <span class="gp-ico">${g.def.icon}</span>
            <span class="gp-body"><b>${g.def.name}</b>
              <small>${g.tier} 阶 · ${af ? af.name : g.def.stat} +${(val * 100).toFixed(1)}%</small></span>
            <span class="gp-n">×${g.n}</span>
          </button>`;
        }).join('') + `</div>`;
      }
      html += `</div><div class="modal-actions"><button class="btn" id="m-cancel" type="button">取消</button></div>`;
      const box = Modals.open(html);
      box.querySelector('#m-cancel').onclick = () => Modals.close();
      box.onclick = (e) => {
        const b = e.target.closest('[data-g]');
        if (!b) return;
        const r = XG.Forge.socket(eqId, b.dataset.g);
        if (r.ok) { XG.Float.show('镶嵌成功！', 'epic'); Modals.close(); XG.ForgePanel.refresh(); }
        else XG.Float.show('无法镶嵌', 'bad');
      };
    },

    /* ══════ 战斗中的丹药快捷使用 ══════ */
    battlePills() {
      const b = XG.Combat.active || XG.Combat.last;
      if (!b || b.over) return;
      const list = XG.Combat.battlePills();
      let html = `<div class="modal-title">服用丹药</div>
        <div class="modal-sub">战斗中服丹不消耗行动机会</div>
        <div class="modal-body">`;
      if (!list.length) {
        html += `<div class="empty"><span class="e-ico">⚗</span>暂无可用丹药</div>`;
      } else {
        html += `<div class="gem-pick">` + list.map(x => {
          const desc = x.def.kind === 'instant'
            ? '立即回复 35% 气血'
             : (x.def.effectText ? x.def.effectText(UI.mods().pillPower) : '');
          return `<button class="gem-pick-item" type="button" data-bp="${x.id}" aria-label="使用${x.def.name}">
             <span class="gp-ico">${x.def.icon}</span>
            <span class="gp-body"><b>${x.def.name}</b><small>${desc}</small></span>
            <span class="gp-n">×${x.n}</span>
          </button>`;
        }).join('') + `</div>`;
      }
      html += `</div><div class="modal-actions"><button class="btn" id="m-cancel" type="button">关闭</button></div>`;
      const box = Modals.open(html);
      box.querySelector('#m-cancel').onclick = () => Modals.close();
      box.onclick = e => {
        const t = e.target.closest('[data-bp]');
        if (!t) return;
        const r = XG.Combat.useBattlePill(t.dataset.bp);
        if (r.ok) { XG.Float.show(r.name + '：' + r.text, 'good'); Modals.close(); }
        else XG.Float.show('无法使用', 'bad');
      };
    },

    /* ══════ 神通配置 ══════ */
    pickSkill(idx) {
      const s = XG.State.s;
      const list = XG.Combat.skillsUnlocked();
      const cur = s.skills[idx];
      let html = `<div class="modal-title">配置神通</div>
        <div class="modal-sub">战斗中的第 ${idx + 1} 个神通位</div>
        <div class="modal-body"><div class="skill-pick">`;
      if (cur) {
        html += `<button class="skill-pick-item off" type="button" data-null="1" aria-label="卸下神通">
          <span class="sp-ico">✖</span><span class="sp-body"><b>卸下神通</b><small>清空此神通位</small></span></button>`;
      }
      html += list.map(sk => {
        const used = s.skills.indexOf(sk.id) >= 0 && s.skills[idx] !== sk.id;
        return `<button class="skill-pick-item ${cur === sk.id ? 'on' : ''}" type="button" data-sk="${sk.id}" aria-label="${sk.name}" ${used ? 'disabled' : ''}>
          <span class="sp-ico">${sk.icon}</span>
          <span class="sp-body"><b>${sk.name}</b><small>${sk.desc}</small></span>
          <span class="sp-cost">灵力 ${sk.cost}　冷却 ${sk.cd}</span>
        </button>`;
      }).join('');
      html += `</div></div><div class="modal-actions"><button class="btn" id="m-cancel" type="button">取消</button></div>`;
      const box = Modals.open(html, { wide: true });
      box.querySelector('#m-cancel').onclick = () => Modals.close();
      box.onclick = (e) => {
        const b = e.target.closest('[data-sk]');
        const n = e.target.closest('[data-null]');
        if (n) { XG.Combat.setSkill(idx, null); Modals.close(); MT.markDirty('arts'); MT.render('arts', true); return; }
        if (!b) return;
        const r = XG.Combat.setSkill(idx, b.dataset.sk);
        if (r.ok) { XG.Float.show('神通已配置', 'good'); Modals.close(); MT.markDirty('arts'); MT.render('arts', true); }
        else XG.Float.show(r.reason === 'dup' ? '该神通已在其他位' : '尚未领悟', 'bad');
      };
    },
  };

  XG.Modals = Modals;
})();

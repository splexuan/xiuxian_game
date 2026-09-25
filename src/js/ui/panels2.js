/* ═══════════════════════════════════════════
   panels2.js — 灵宠 / 储物 / 秘境 / 通天塔 / 道果 / 飞升 / 战斗视图
   ═══════════════════════════════════════════ */
(function () {
  'use strict';
  const XG = window.XG;
  const U = XG.U, R = XG.R;
  const UI = XG.UI, MT = XG.MT, Frag = XG.Frag;

  /* ═══════════════════════════════════════
     灵宠
     ═══════════════════════════════════════ */
  const PetsPanel = {
    init() {},
    render(box) {
      const s = XG.State.s, C = XG.State.Calc;
      const m = UI.mods();
      const pts = C.petTotals();
      const bonusTxt = [];
      const NAMEMAP = { atk: '攻击', def: '防御', hp: '气血', crit: '暴击', critDmg: '爆伤', dodge: '闪避', spd: '速度', lifesteal: '吸血', pen: '穿透', spirit: '修炼', stoneGain: '灵石', herbGain: '灵草' };
      for (const k in pts) if (pts[k] > 0) bonusTxt.push(`${NAMEMAP[k] || k} +${U.pct(pts[k], 1)}`);

      let html = `<div class="card">
        <div class="card-title"><span class="ico">🥚</span>灵宠园<span class="sub">栏位 ${s.pets.active.length}/${m.petSlots}</span></div>
        <div class="hint">孵化灵宠蛋可收服灵宠。出战的灵宠会提供被动加成（受【灵兽园】等级加成 ×${m.petPower.toFixed(2)}）。</div>
        <div class="stat-row">
          <div class="stat-cell"><div class="k">灵宠蛋</div><div class="v">${s.pets.eggs}</div></div>
          <div class="stat-cell"><div class="k">已收服</div><div class="v jade">${s.pets.owned.length}</div></div>
          <div class="stat-cell"><div class="k">出战栏位</div><div class="v azure">${m.petSlots}</div></div>
        </div>
        <div class="hint" style="margin-top:9px">当前总加成：${bonusTxt.length ? bonusTxt.join('、') : '无'}</div>
        <div class="btn-row" style="margin-top:10px">
          <button class="btn primary" id="hatch" ${s.pets.eggs > 0 ? '' : 'disabled'}>孵化灵宠蛋</button>
          <button class="btn" id="hatchAll" ${s.pets.eggs > 0 ? '' : 'disabled'}>全部孵化</button>
          <button class="btn violet" id="buyEgg" ${s.res.jade < 10 ? 'disabled' : ''}>购蛋 · 仙玉 10</button>
          <button class="btn" id="autoPet">自动出战最优</button>
        </div>
      </div><div class="grid g2">`;

      if (!s.pets.owned.length) {
        html += Frag.empty('🥚', '尚无灵宠。突破筑基境或通关通天塔可获得灵宠蛋。');
      }
      for (const pid of s.pets.owned) {
        const def = XG.idx.pet[pid];
        const d = s.pets.data[pid];
        const lv = d ? d.lv : 1;
        const max = XG.Pets.maxLv(pid);
        const cost = XG.Pets.levelCost(pid);
        const active = s.pets.active.indexOf(pid) >= 0;
        const bs = [];
        for (const k in def.bonus) bs.push(`<span class="item-stat jade">${NAMEMAP[k] || k} +${U.pct(def.bonus[k] * lv * m.petPower, 2)}</span>`);
        html += `<div class="item-card q${def.q} ${active ? 'equipped' : ''}">
          <div class="item-head">
            <div class="item-ico" style="font-size:20px">${def.icon}</div>
            <div class="item-name">${def.name}</div>
            <span class="item-tag">${active ? '出战中' : U.QUALITY[def.q].name}</span>
          </div>
          <div class="item-desc">${def.desc}</div>
          <div class="item-stats">
            <span class="item-stat gold">Lv.${lv}/${max}</span>
            ${bs.join('')}
          </div>
          <div class="btn-row">
            <button class="btn sm ${active ? 'jade' : 'primary'}" data-toggle="${pid}">${active ? '休战' : '出战'}</button>
            <button class="btn sm" data-petup="${pid}" data-n="1" ${lv < max && s.res.stone >= cost ? '' : 'disabled'}>培养 ${U.fmt(cost)}</button>
            <button class="btn sm" data-petup="${pid}" data-n="max" ${lv < max && s.res.stone >= cost ? '' : 'disabled'}>升至满级</button>
          </div>
        </div>`;
      }
      html += `</div>`;

      /* 未获得图鉴 */
      const unowned = XG.PETS.filter(p => s.pets.owned.indexOf(p.id) < 0);
      if (unowned.length) {
        html += `<div class="card" style="margin-top:11px"><div class="card-title"><span class="ico">📖</span>灵宠图鉴<span class="sub">未收服 ${unowned.length}</span></div><div class="grid g4">`;
        for (const p of unowned) {
          html += `<div class="item-card q${p.q}" style="opacity:.45;padding:9px">
            <div class="item-head"><div class="item-ico" style="width:26px;height:26px;font-size:15px">❔</div>
            <div class="item-name" style="font-size:12px">？？？</div></div>
             <div class="item-desc" style="min-height:0;font-size:var(--fs-mini)">${U.QUALITY[p.q].name}灵宠</div></div>`;
        }
        html += `</div></div>`;
      }
      box.innerHTML = html;

      box.onclick = (e => {
        if (e.target.closest('#hatch')) { const r = XG.Pets.hatch(); if (!r.ok) XG.Float.show('没有灵宠蛋', 'bad'); MT.markDirty('pets'); return; }
        if (e.target.closest('#hatchAll')) { const r = XG.Pets.hatchAll(); if (r.length) XG.Float.show(`收服 ${r.length} 只灵宠`, 'epic'); MT.markDirty('pets'); return; }
        if (e.target.closest('#buyEgg')) { const r = XG.Pets.buyEgg(1); if (!r.ok) XG.Float.show('仙玉不足', 'bad'); MT.markDirty('pets'); return; }
        if (e.target.closest('#autoPet')) { XG.Pets.autoBest(); XG.Float.show('已部署最强灵宠', 'good'); MT.markDirty('pets'); return; }
        const t = e.target.closest('[data-toggle]');
        if (t) {
          const r = XG.Pets.toggle(t.dataset.toggle);
          if (!r.ok && r.reason === 'slots') XG.Float.show(`出战栏位已满（${r.slots}）`, 'bad');
          MT.markDirty('pets'); return;
        }
        const pu = e.target.closest('[data-petup]');
        if (pu) {
          const r = XG.Pets.levelUp(pu.dataset.petup, pu.dataset.n === 'max' ? 'max' : 1);
          if (r.n > 0) XG.Float.show(`培养成功 → Lv.${r.lv}`, 'good');
          else XG.Float.show('灵石不足', 'bad');
          MT.markDirty('pets');
        }
      });
    },
    update() {},
  };

  /* ═══════════════════════════════════════
     储物
     ═══════════════════════════════════════ */
  const BagPanel = {
    init() {},
    render(box) {
      const s = XG.State.s, C = XG.State.Calc;
      const eqp = UI.mods().equipPower;

      let html = `<div class="card">
        <div class="card-title"><span class="ico">🎽</span>已装备<span class="sub">炼器室加成 ×${eqp.toFixed(2)}</span></div>
        <div class="grid g4">`;
      for (const sl of XG.SLOTS) {
        const e = s.equip[sl.id];
        if (!e) {
          html += `<div class="item-card q0" style="opacity:.55">
            <div class="item-head"><div class="item-ico">${sl.icon}</div><div class="item-name">${sl.name}</div></div>
            <div class="item-desc">空置</div></div>`;
        } else {
          html += BagPanel.equipCard(e, sl, true);
        }
      }
      html += `</div>
        <div class="btn-row" style="margin-top:10px">
          <button class="btn primary" id="autoEquip">自动装备最优</button>
          <button class="btn" id="sellQ">熔炼 玄品以下</button>
          <button class="btn danger" id="sellAll">熔炼全部（保留已装备）</button>
        </div>
      </div>
      <div class="card">
        <div class="card-title"><span class="ico">🎒</span>储物袋<span class="sub">${s.equipBag.length} / ${XG.BAG_LIMIT}</span></div>
        <div class="grid g3">`;
      if (!s.equipBag.length) html += Frag.empty('🎒', '储物袋空空如也。前往秘境或通天塔可获取装备。');
      const sorted = s.equipBag.slice().sort((a, b) => (b.q - a.q) || ((b.score || 0) - (a.score || 0)));
      for (const e of sorted) html += BagPanel.equipCard(e, XG.idx.slot[e.slot], false);
      html += `</div></div>`;
      box.innerHTML = html;

      box.onclick = (e => {
        const tf = e.target.closest('[data-toforge]');
        if (tf) { XG.ForgePanel.tab = 'enhance'; MT.show('forge'); return; }
        const eq = e.target.closest('[data-equip]');
        if (eq) { XG.Economy.equipItem(eq.dataset.equip); MT.markDirty('bag'); return; }
        const un = e.target.closest('[data-unequip]');
        if (un) { XG.Economy.unequip(un.dataset.unequip); MT.markDirty('bag'); return; }
        const sl = e.target.closest('[data-sell]');
        if (sl) { const v = XG.Economy.sellEquip(sl.dataset.sell); XG.Float.show('+' + U.fmt(v) + ' 灵石', 'gold'); MT.markDirty('bag'); return; }
        if (e.target.closest('#autoEquip')) { const n = XG.Economy.autoEquip(); XG.Float.show(n ? `更新 ${n} 件装备` : '无需更换', n ? 'good' : 'bad'); MT.markDirty('bag'); return; }
        if (e.target.closest('#sellQ')) { const r = XG.Economy.sellAllBelow(3); XG.Float.show(r.n ? `熔炼 ${r.n} 件，+${U.fmt(r.total)} 灵石` : '没有可熔炼的装备', r.n ? 'gold' : 'bad'); MT.markDirty('bag'); return; }
        if (e.target.closest('#sellAll')) {
          const n = s.equipBag.length;
          XG.Modals.confirm('熔炼全部', `确定熔炼储物袋中全部 ${n} 件装备吗？此操作不可撤销。`, () => {
            let total = 0;
            while (XG.State.s.equipBag.length) total += XG.Economy.sellEquip(XG.State.s.equipBag[0].id);
            XG.Float.show('+' + U.fmt(total) + ' 灵石', 'gold');
            MT.markDirty('bag');
          });
          return;
        }
      });
    },
    equipCard(e, sl, equipped) {
      const eqp = UI.mods().equipPower;
      const st = XG.State.Calc.eqStats(e);
      const stats = [];
      for (const a of XG.AFFIX) {
        if (!st[a.key]) continue;
        stats.push(`<span class="item-stat ${a.key === 'spirit' ? 'jade' : a.key === 'hp' ? 'gold' : ''}">${a.name} ${a.fmt(st[a.key] * eqp)}</span>`);
      }
      const setName = e.set && XG.SETS[e.set] ? XG.SETS[e.set].name + '套' : '';
      const sock = (e.sockets || []).map(g => {
        if (!g) return `<span class="socket-mini empty"></span>`;
        const d = XG.idx.gem[g.id];
        return `<span class="socket-mini on" title="${d ? d.name : ''} ${g.tier}阶">${d ? d.icon : '?'}</span>`;
      }).join('');
      return `<div class="item-card q${e.q} ${equipped ? 'equipped' : ''}">
        <div class="item-head">
          <div class="item-ico">${sl.icon}</div>
          <div class="item-name">${UI.esc(e.name)}${e.enh ? `<em class="enh">+${e.enh}</em>` : ''}</div>
          <span class="item-tag">${U.QUALITY[e.q].name}</span>
        </div>
        <div class="item-desc" style="min-height:0">
          ${sl.name}${setName ? ` ｜ <b style="color:var(--gold)">${setName}</b>` : ''} ｜ 得自 ${UI.esc(e.from || '未知')}
          ${sock ? `<span class="sock-mini-row">${sock}</span>` : ''}
        </div>
        <div class="item-stats">${stats.join('')}</div>
        <div class="btn-row">
          ${equipped
          ? `<button class="btn sm" data-unequip="${e.slot}">卸下</button>
             <button class="btn sm" data-toforge="${e.id}">锻造</button>`
          : `<button class="btn sm primary" data-equip="${e.id}">装备</button>
             <button class="btn sm" data-toforge="${e.id}">锻造</button>
             <button class="btn sm danger" data-sell="${e.id}">熔炼</button>`}
        </div>
      </div>`;
    },
    update() {},
  };

  /* ═══════════════════════════════════════
     秘境
     ═══════════════════════════════════════ */
  const ExplorePanel = {
    init() {},
    render(box) {
      const s = XG.State.s;
      const total = XG.Combat.totalZones();
      let html = `<div class="card">
        <div class="card-title"><span class="ico">⚔</span>秘境探索<span class="sub">胜 ${s.explore.wins} ｜ 负 ${s.explore.losses}</span></div>
        <div class="hint">挂机探索当前秘境，每 ${XG.CONFIG.EXPLORE_STEP} 秒遭遇一次事件。<br>
          约 ${Math.round(XG.Combat.EXPLORE_EVENT_CHANCE * 100)}% 概率触发
          <b style="color:var(--jade)">随机遭遇</b>（宝箱 / 灵泉 / 悟道石 / 宝石矿脉 / 陷阱 / 精英），
          另有小概率遭遇 <b style="color:var(--gold)">妖王</b>（真实战斗，掉落丰厚）。</div>
        <div class="stat-row" style="margin-top:10px">
          <div class="stat-cell"><div class="k">随机遭遇</div><div class="v jade">${s.stats.zoneEvents || 0} 次</div></div>
          <div class="stat-cell"><div class="k">妖王 / 精英</div><div class="v gold">${s.stats.bossKills} / ${s.stats.eliteKills || 0}</div></div>
        </div>
        <div class="stat-row" style="margin-top:10px">
          <div class="stat-cell"><div class="k">当前秘境</div><div class="v" id="ex-zone" style="font-size:14px">—</div></div>
          <div class="stat-cell"><div class="k">灵石/秒</div><div class="v jade" id="ex-rate">0</div></div>
          <div class="stat-cell"><div class="k">预计战力需求</div><div class="v azure" id="ex-pow">0</div></div>
        </div>
         <div style="margin-top:10px" id="ex-progress">
           <div class="bar jade" id="ex-progress-bar" role="progressbar" aria-label="秘境探索进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i id="ex-progress-fill"></i></div>
           <div class="hint" id="ex-progress-text" style="margin-top:4px">未在探索</div>
         </div>
        <div class="btn-row" style="margin-top:10px">
           <button class="btn primary" id="ex-toggle" type="button" aria-pressed="false">—</button>
           <button class="btn" id="ex-next" type="button" aria-label="切换到下一个已解锁秘境">切换秘境</button>
        </div>
      </div>
      <div class="grid g3" id="zonegrid">`;

      for (let i = 0; i < total; i++) {
        const z = XG.Combat.zoneAt(i);
        if (!z) continue;
        const active = s.explore.zone === i;
        const rate = XG.Combat.zoneStoneRate(i);
        const enemy = XG.Combat.makeEnemy(z.refR, z.mult);
        const need = XG.State.Calc.power(enemy);
         html += `<button class="zone-card ${active ? 'active' : ''} ${z.unlocked ? '' : 'locked'}" type="button" data-zone="${i}" aria-pressed="${active ? 'true' : 'false'}" aria-label="选择秘境：${U.esc(z.name)}" ${z.unlocked ? '' : 'disabled'}>
           <div class="zone-name">${U.esc(z.name)}</div>
          <div class="zone-req">${XG.REALMS[z.realm].name}境 · ${z.sub === 0 ? '外围' : '深处'}</div>
          <div class="item-stats" style="margin-top:7px">
            <span class="item-stat gold">${U.fmt(rate)} 灵石/秒</span>
            <span class="item-stat">敌力 ${U.fmt(need)}</span>
            ${active ? '<span class="item-stat jade">探索中</span>' : ''}
          </div>
           ${z.unlocked ? '' : `<div class="hint" style="margin-top:6px;color:var(--crimson)">需 ${XG.REALMS[z.realm].name}境 解锁</div>`}
         </button>`;
      }
      html += `</div>`;
      box.innerHTML = html;
      ExplorePanel._powKey = null;

      box.onclick = (e => {
        const zc = e.target.closest('[data-zone]');
        if (zc) {
          const i = +zc.dataset.zone;
          const z = XG.Combat.zoneAt(i);
          if (!z.unlocked) { XG.Float.show(`需 ${XG.REALMS[z.realm].name}境`, 'bad'); return; }
          s.explore.zone = i;
          s.explore.progress = 0;
          MT.markDirty('explore');
          XG.Bus.emit('explore:change');
          return;
        }
         if (e.target.closest('#ex-toggle')) {
           const on = !s.explore.running;
             XG.Combat.setExploring(on);
             s.explore.progress = 0;
             if (typeof XG.Combat.resetExploreProgress === 'function') XG.Combat.resetExploreProgress();
             const running = !!s.explore.running;
             XG.State.addLog(running ? `【秘境】开始探索 <b>${XG.Combat.zoneAt(s.explore.zone).name}</b>` : `【秘境】停止探索`, 'info');
           MT.markDirty('explore');
           XG.Bus.emit('explore:toggle');
           return;
         }
         if (e.target.closest('#ex-next')) {
          const total = XG.Combat.totalZones();
          let i = s.explore.zone;
          for (let k = 1; k <= total; k++) {
            const n = (s.explore.zone + k) % total;
            if (XG.Combat.zoneAt(n).unlocked) { i = n; break; }
          }
          s.explore.zone = i; s.explore.progress = 0;
          MT.markDirty('explore');
        }
      });

      ExplorePanel.update(box);
    },
    update(box) {
      const s = XG.State.s;
      const z = XG.Combat.zoneAt(s.explore.zone);
      if (!z) return;
      const set = (id, v) => { const e = document.getElementById(id); if (e && e.textContent !== v) e.textContent = v; };
      set('ex-zone', z.name);
      set('ex-rate', U.fmt(XG.Combat.zoneStoneRate(s.explore.zone)));
      const enemy = XG.Combat.makeEnemy(z.refR, z.mult);
      const need = XG.State.Calc.power(enemy);
      const mine = XG.State.Calc.power(UI.playerStats());
      const ratio = mine / Math.max(1, need);
      const pow = document.getElementById('ex-pow');
      const powHtml = `<span style="color:${ratio > 1.6 ? 'var(--jade)' : ratio > 1.0 ? 'var(--amber)' : 'var(--crimson)'}">${U.fmt(need)}（我 ${ratio.toFixed(2)}×）</span>`;
      if (pow && ExplorePanel._powKey !== powHtml) {
        ExplorePanel._powKey = powHtml;
        pow.innerHTML = powHtml;
      }

      const running = !!s.explore.running;
      const pct = running ? U.clamp(s.explore.progress / XG.CONFIG.EXPLORE_STEP, 0, 1) : 0;
      const bar = document.getElementById('ex-progress-bar');
      const fill = document.getElementById('ex-progress-fill');
      const text = document.getElementById('ex-progress-text');
      if (bar) bar.setAttribute('aria-valuenow', String(Math.round(pct * 100)));
      if (fill) fill.style.width = (pct * 100) + '%';
      if (text) UI.setText(text, running ? `下一次遭遇：${U.clock(XG.CONFIG.EXPLORE_STEP - s.explore.progress)}` : '未在探索');
      const tg = document.getElementById('ex-toggle');
      if (tg) {
        tg.textContent = running ? '停止探索' : '开始探索';
        tg.classList.toggle('jade', !running);
        tg.setAttribute('aria-pressed', running ? 'true' : 'false');
      }
      UI.$$('[data-zone]', box).forEach(card => {
        const on = +card.dataset.zone === s.explore.zone;
        card.classList.toggle('active', on);
        card.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    },
  };

  /* ═══════════════════════════════════════
     通天塔
     ═══════════════════════════════════════ */
  const TowerPanel = {
    init() {},
    render(box) {
      const s = XG.State.s;
      const cur = Math.min(s.tower.floor, Math.max(s.tower.best + 1, 1));
      const e = XG.Combat.towerEnemy(cur);
      const rw = XG.Combat.towerReward(cur);
      const mine = XG.State.Calc.power(UI.playerStats());
      const need = XG.State.Calc.power(e);
      const ratio = mine / Math.max(1, need);

      let html = `<div class="tower-view">
        <div class="card-title"><span class="ico">🗼</span>通天塔<span class="sub">最高 ${s.tower.best} 层</span></div>
        <div class="hint">每层皆为强敌。战胜可获仙玉、灵石、灵材与装备，每 5 层必掉高品装备。塔层不随飞升重置，是永久挑战。</div>
        <div class="stat-row" style="margin-top:12px">
          <div class="stat-cell"><div class="k">当前层</div><div class="v">第 ${cur} 层</div></div>
          <div class="stat-cell"><div class="k">守关者</div><div class="v" style="font-size:13px">${U.esc(e.name.replace('第' + cur + '层 · ', ''))}</div></div>
          <div class="stat-cell"><div class="k">敌方战力</div><div class="v" style="color:${ratio > 1.3 ? 'var(--jade)' : ratio > 0.95 ? 'var(--amber)' : 'var(--crimson)'}">${U.fmt(need)}</div></div>
          <div class="stat-cell"><div class="k">我方战力</div><div class="v jade">${U.fmt(mine)}</div></div>
          <div class="stat-cell"><div class="k">仙玉奖励</div><div class="v violet">${rw.jade}</div></div>
          <div class="stat-cell"><div class="k">灵石奖励</div><div class="v">${U.fmt(rw.stone)}</div></div>
        </div>
        <div class="btn-row" style="margin-top:12px">
          <button class="btn primary" id="tw-fight" style="flex:1">挑战第 ${cur} 层</button>
        </div>
        <div class="hint" style="margin-top:8px;text-align:center">
          ${ratio > 1.3 ? '胜算颇大，放手一战。' : ratio > 0.95 ? '胜负难料，需谨慎。' : '实力差距明显，建议先提升修为与装备。'}
        </div>
      </div>
      <div class="card">
        <div class="card-title"><span class="ico">📜</span>塔层记录</div>
        <div class="tower-floors" id="floorlist">`;

      const from = Math.max(1, cur - 12);
      const to = cur + 6;
      for (let n = from; n <= to; n++) {
        const done = n <= s.tower.best;
        const isCur = n === cur;
        const fe = XG.Combat.towerEnemy(n);
        html += `<div class="floor ${done ? 'done' : ''} ${isCur ? 'cur' : ''}">
          <div class="floor-num">第${n}层</div>
          <div style="flex:1"><div class="floor-name">${U.esc(fe.name.replace('第' + n + '层 · ', ''))}</div>
          <div class="floor-boss">战力 ${U.fmt(XG.State.Calc.power(fe))}</div></div>
          ${done ? '<span class="item-tag" style="--q:#5fd8c4">已通关</span>' : isCur ? `<button class="btn xs primary" data-floor="${n}">挑战</button>` : '<span class="item-tag" style="--q:#5d6b85">未解锁</span>'}
        </div>`;
      }
      html += `</div></div>`;
      box.innerHTML = html;

      box.onclick = (ev => {
        const f = ev.target.closest('[data-floor]');
        if (f) { XG.Combat.challengeTower(+f.dataset.floor); return; }
        if (ev.target.closest('#tw-fight')) { XG.Combat.challengeTower(cur); }
      });
    },
    update() {},
  };

  /* ═══════════════════════════════════════
     道果
     ═══════════════════════════════════════ */
  const AchPanel = {
    init() {},
    render(box) {
      const list = XG.Achieve.list();
      const done = list.filter(a => a.done).length;
      let html = `<div class="card">
        <div class="card-title"><span class="ico">🏆</span>道果<span class="sub">${done} / ${list.length}</span></div>
        <div class="hint">每达成一项道果，都会获得<b>永久</b>加成，跨越飞升亦不消失。</div>
         <div class="bar gold" role="progressbar" aria-label="道果完成进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(done / list.length * 100)}" style="margin-top:10px"><i style="width:${(done / list.length) * 100}%"></i></div>
      </div><div class="grid g3">`;
      for (const a of list) {
        const rw = [];
        const NAMEMAP = { spirit: '灵气/秒', atk: '攻击', hp: '气血', stoneGain: '灵石获取' };
        for (const k in (a.reward || {})) rw.push(`${NAMEMAP[k] || k} +${U.pct(a.reward[k], 0)}`);
        html += `<div class="item-card q${a.done ? 6 : 0}" style="${a.done ? '' : 'opacity:.55'}">
          <div class="item-head"><div class="item-ico">${a.done ? a.icon : '🔒'}</div>
            <div class="item-name">${a.name}</div></div>
          <div class="item-desc">${a.desc}</div>
          <div class="item-stats"><span class="item-stat ${a.done ? 'jade' : 'gold'}">${rw.join(' · ')}</span></div>
        </div>`;
      }
      html += `</div>`;
      box.innerHTML = html;
    },
    update() {},
  };

  /* ═══════════════════════════════════════
     飞升
     ═══════════════════════════════════════ */
  const AscendPanel = {
    init() {},
    render(box) {
      const s = XG.State.s;
      const pv = XG.Prestige.preview();
      const free = XG.Prestige.freePoints();
      const can = XG.Prestige.canAscend();

      let html = `<div class="cult-hero" style="padding:22px">
        <div class="hero-sphere" style="width:100px;height:100px"><span style="font-size:28px">🌀</span></div>
        <div class="hero-title" style="font-size:22px">飞升转生</div>
        <div class="hero-sub">斩断因果，重入轮回。仙缘点永存，助你更快登临大道。</div>
      </div>

      <div class="card">
        <div class="card-title"><span class="ico">📈</span>转生预览</div>
        <div class="stat-row">
          <div class="stat-cell"><div class="k">当前境界</div><div class="v" style="font-size:14px">${pv.realmName}</div></div>
          <div class="stat-cell"><div class="k">修为层次</div><div class="v">${pv.level}</div></div>
          <div class="stat-cell"><div class="k">通天塔</div><div class="v">${pv.tower}</div></div>
          <div class="stat-cell"><div class="k">道果</div><div class="v">${pv.ach}</div></div>
          <div class="stat-cell"><div class="k">可得仙缘点</div><div class="v violet">${pv.gain}</div></div>
          <div class="stat-cell"><div class="k">累计仙缘点</div><div class="v violet">${s.prestige.earned}</div></div>
        </div>
        <div class="hint" style="margin-top:10px">
          飞升后灵气/秒 ×<b>${pv.spiritMult.toFixed(2)}</b>、攻击 ×<b>${pv.atkMult.toFixed(2)}</b>、气血 ×<b>${pv.hpMult.toFixed(2)}</b>（由累计仙缘点决定）<br>
          <b style="color:var(--crimson)">保留：</b>仙缘点、天赋、道果、灵宠、仙玉、已解锁的成就加成<br>
          <b style="color:var(--crimson)">重置：</b>境界、灵气、灵石、灵草、洞天、功法、装备、丹药、材料、通天塔进度
        </div>
        <div class="btn-row" style="margin-top:12px">
          <button class="btn primary" id="doAscend" style="flex:1" ${can ? '' : 'disabled'}>${can ? `飞升 · 获得 ${pv.gain} 点仙缘` : `需达到 ${XG.REALMS[XG.CONFIG.ASCEND_MIN_REALM].name}境方可飞升`}</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title"><span class="ico">✧</span>仙缘天赋<span class="sub">可用仙缘点 ${free}</span></div>
        <div class="hint">消耗仙缘点永久强化各项能力，跨飞升保留。</div>
        <div class="grid g3" style="margin-top:10px">`;

      for (const t of XG.TALENTS) {
        const lv = s.prestige.talents[t.id] || 0;
        const cost = XG.Prestige.talentCost(t.id);
        const maxed = lv >= t.max;
        html += `<div class="item-card q4">
          <div class="item-head"><div class="item-ico">${t.icon}</div><div class="item-name">${t.name}</div>
            <span class="item-tag">${lv} / ${t.max}</span></div>
          <div class="item-desc">${t.desc}</div>
          <div class="item-stats"><span class="item-stat jade">当前 +${U.pct(t.per * lv, 0)}</span></div>
          <div class="btn-row">
            <button class="btn sm ${free >= cost && !maxed ? 'violet' : ''}" data-talent="${t.id}" ${free >= cost && !maxed ? '' : 'disabled'}>
              ${maxed ? '已满级' : `强化 · ${cost} 点`}</button>
          </div>
        </div>`;
      }
      html += `</div></div>`;

      /* 转生记录 */
      html += `<div class="card">
        <div class="card-title"><span class="ico">📖</span>轮回记录</div>
        <div class="stat-row">
          <div class="stat-cell"><div class="k">飞升次数</div><div class="v">${s.prestige.times}</div></div>
          <div class="stat-cell"><div class="k">累计仙缘点</div><div class="v violet">${s.prestige.earned}</div></div>
          <div class="stat-cell"><div class="k">已消耗点数</div><div class="v">${s.prestige.spent}</div></div>
          <div class="stat-cell"><div class="k">历史最高塔层</div><div class="v">${s.stats.towerEver || s.tower.best}</div></div>
        </div>
      </div>`;

      box.innerHTML = html;

      box.onclick = (e => {
        const t = e.target.closest('[data-talent]');
        if (t) {
          const r = XG.Prestige.buyTalent(t.dataset.talent);
          if (!r.ok) XG.Float.show(r.reason === 'max' ? '已满级' : '仙缘点不足', 'bad');
          else XG.Float.show('天赋强化成功', 'epic');
          MT.markDirty('ascend'); return;
        }
         if (e.target.closest('#doAscend')) {
          const pv = XG.Prestige.preview();
          XG.Modals.confirm('确认飞升？',
            `你将重返凡人，失去当前一切修为，换取 <b>${pv.gain}</b> 点仙缘点。<br><br>累计仙缘点将变为 <b>${s.prestige.earned + pv.gain}</b>，永久提升全属性。<br><br>此操作不可撤销。`,
            () => {
              const r = XG.Prestige.ascend();
              if (r.ok) {
                XG.Modals.result('飞升成功', '仙缘点 +' + r.gain, '你在万丈仙光中化作一道流虹，世间再无你的踪迹。百年后，青山之下，一名少年睁开了眼……', null);
                MT.markDirty();
                MT.show('cultivate');
              }
            });
        }
      });
    },
    update() {},
  };

  /* ═══════════════════════════════════════
     战斗视图（非阻塞浮层）
     ═══════════════════════════════════════ */
  const BattleView = {
    el: null,
    collapsed: false,
    resultTimer: 0,
    cache: {},
    current() { return XG.Combat.active || XG.Combat.last; },

    /* ── 战况提示 / 结算条的显隐 ──
       注意：这两块都必须「占位式」切换，不能用 .hidden（display:none）。
       浮层贴屏幕底部定位，任何内部元素被移出文档流都会让上方内容整体跳动；
       它们是整场战斗中最高频的出现/消失元素（每回合都可能切换）。 */
    showWarn(html) {
      const w = document.getElementById('bo-warn');
      if (!w) return;
      if (w.innerHTML !== html) w.innerHTML = html;
      w.classList.add('on');
      w.setAttribute('aria-hidden', 'false');
    },
    hideWarn() {
      const w = document.getElementById('bo-warn');
      if (!w) return;
      w.classList.remove('on');
      w.setAttribute('aria-hidden', 'true');
    },
    showResult() {
      const r = document.getElementById('bo-result');
      if (r) { r.classList.add('show'); r.setAttribute('aria-hidden', 'false'); }
      // 让日志腾出与结算条等量的高度，浮层总高保持不变
      if (BattleView.el) BattleView.el.classList.add('has-result');
    },
    hideResult() {
      const r = document.getElementById('bo-result');
      if (r) { r.classList.remove('show'); r.setAttribute('aria-hidden', 'true'); }
      if (BattleView.el) BattleView.el.classList.remove('has-result');
    },

    init() {
      const e = document.createElement('div');
      e.id = 'battle-overlay';
      e.className = 'hidden';
      e.setAttribute('role', 'region');
      e.setAttribute('aria-label', '战斗浮层');
      e.setAttribute('aria-live', 'polite');
      e.setAttribute('aria-hidden', 'true');
      e.innerHTML = `
        <div class="bo-inner">
          <div class="bo-head">
            <div class="bo-head-main">
              <span class="bo-title" id="bo-title">战斗</span>
              <span class="bo-round" id="bo-round"></span>
            </div>
            <div class="bo-head-ctl">
              <div class="bo-speed" role="group" aria-label="战斗速度">
                <button type="button" data-speed="1" aria-label="一倍速" aria-pressed="false">1×</button>
                <button type="button" data-speed="2" aria-label="二倍速" aria-pressed="false">2×</button>
                <button type="button" data-speed="4" aria-label="四倍速" aria-pressed="false">4×</button>
                <button type="button" data-speed="8" aria-label="八倍速" aria-pressed="false">8×</button>
              </div>
              <button class="mini-btn" id="bo-auto" type="button" aria-pressed="true">自动应战</button>
              <button class="mini-btn" id="bo-fold" type="button" aria-expanded="true">收起</button>
            </div>
          </div>
          <div class="bo-warn" id="bo-warn" aria-hidden="true"></div>
          <div class="bo-body">
            <div class="bo-stage">
              <div class="bo-side">
                <div class="avatar" id="bo-pa">🧘</div>
                <div class="bo-side-info">
                  <div class="bo-name" id="bo-pn">你</div>
                   <div class="bar hp" role="progressbar" aria-label="我方气血" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><i id="bo-php"></i></div>
                  <div class="bo-hptxt" id="bo-pt">0 / 0</div>
                   <div class="bar energy" role="progressbar" aria-label="灵力" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i id="bo-pen"></i></div>
                  <div class="bo-buffs" id="bo-pbf"></div>
                </div>
              </div>
              <div class="vs-mark">⚔</div>
              <div class="bo-side right">
                <div class="bo-side-info">
                  <div class="bo-name" id="bo-en">妖兽</div>
                   <div class="bar hp azure" role="progressbar" aria-label="敌方气血" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><i id="bo-ehp"></i></div>
                  <div class="bo-hptxt" id="bo-et">0 / 0</div>
                  <div class="bo-buffs right" id="bo-ebf"></div>
                </div>
                <div class="avatar boss" id="bo-ea">👺</div>
              </div>
            </div>

            <div class="bo-command">
              <div class="bo-stance" id="bo-stance"></div>
              <div class="bo-skills" id="bo-skills"></div>
               <button class="btn sm" id="bo-pill" type="button" aria-label="使用战斗丹药">丹药</button>
            </div>

             <div class="battle-log" id="bo-log" role="log" aria-live="polite" aria-relevant="additions"></div>
             <div class="bo-result" id="bo-result" role="status" aria-live="assertive" aria-hidden="true">
               <span id="bo-result-txt"></span>
               <button class="btn sm primary" id="bo-continue" type="button">继续</button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(e);
      BattleView.el = e;

      e.addEventListener('click', ev => {
        const sp = ev.target.closest('[data-speed]');
        if (sp) {
          XG.CombatSpeed = +sp.dataset.speed;
          const b = BattleView.current();
          if (b && !b.over) b.speed = XG.CombatSpeed;
          UI.$$('.bo-speed button', e).forEach(x => {
            const on = +x.dataset.speed === XG.CombatSpeed;
            x.classList.toggle('on', on);
            x.setAttribute('aria-pressed', on ? 'true' : 'false');
          });
          return;
        }
        if (ev.target.closest('#bo-fold')) {
          e.classList.toggle('folded');
          const folded = e.classList.contains('folded');
          ev.target.closest('#bo-fold').textContent = folded ? '展开' : '收起';
          ev.target.closest('#bo-fold').setAttribute('aria-expanded', folded ? 'false' : 'true');
          return;
        }
        if (ev.target.closest('#bo-auto')) {
          const b = BattleView.current();
          if (!b || b.over) return;
          b.auto = !b.auto;
          XG.State.s.battle.autoSkill = b.auto;
          if (b.auto && b.waiting) XG.Combat.playerCommand(b, null);
          BattleView.paint();
          return;
        }
        const st = ev.target.closest('[data-stance]');
        if (st) { XG.Combat.setStance(st.dataset.stance); BattleView.paint(); return; }

        const sk = ev.target.closest('[data-skill]');
        if (sk) {
          const b = BattleView.current();
          if (!b || b.over) return;
          const id = sk.dataset.skill;
          if (b.waiting) XG.Combat.playerCommand(b, id);
          else if ((b.p.cd[id] || 0) > 0 || b.p.energy < XG.idx.skill[id].cost) {
            XG.Float.show('灵力不足或冷却中', 'bad');
          } else if (XG.Combat.castSkill(b, b.p, b.e, id)) {
            if (b.e.hp <= 0) XG.Combat.endBattle(); else XG.Bus.emit('battle:turn', b);
            BattleView.paint();
          }
          return;
        }

        if (ev.target.closest('#bo-pill')) { XG.Modals.battlePills(); return; }
        if (ev.target.closest('#bo-continue')) {
          clearTimeout(BattleView.resultTimer);
          if (typeof XG.Combat.closeResult === 'function') XG.Combat.closeResult();
          else if (typeof XG.Combat.closeBattle === 'function') XG.Combat.closeBattle();
          BattleView.hide();
        }
      });

      XG.Bus.on('battle:start', b => BattleView.onStart(b));
      XG.Bus.on('battle:turn', b => BattleView.paint(b));
      XG.Bus.on('battle:wait', b => BattleView.paint(b));
      XG.Bus.on('battle:end', b => BattleView.onEnd(b));
      XG.Bus.on('battle:closed', () => BattleView.hide());
      document.addEventListener('keydown', ev => {
        const b = BattleView.current();
        if (!b || b.over) return;
        if (ev.key === '1' || ev.key === '2' || ev.key === '3') {
          const i = +ev.key - 1;
          if (b.p.skills[i]) {
            const btn = document.querySelector(`[data-skill="${b.p.skills[i]}"]`);
            if (btn && !btn.disabled) btn.click();
          }
        }
      });
    },

    onStart(battle) {
      const b = battle || BattleView.current();
      if (!b) return;
      clearTimeout(BattleView.resultTimer);
      BattleView.cache = {};
      BattleView.el.classList.remove('hidden', 'folded');
      BattleView.el.setAttribute('aria-hidden', 'false');
      BattleView.el.classList.toggle('epic', b.opts.kind === 'tribulation');
      const lg = document.getElementById('bo-log');
      lg.innerHTML = '';
      BattleView.hideResult();
      BattleView.hideWarn();
       document.getElementById('bo-fold').textContent = '收起';
       document.getElementById('bo-fold').setAttribute('aria-expanded', 'true');
       document.getElementById('bo-title').textContent = b.opts.title || '战斗';
      document.getElementById('bo-pn').textContent = b.p.name;
      document.getElementById('bo-en').textContent = b.e.name;
      document.getElementById('bo-ea').textContent = b.e.icon || '👺';
      const av = document.getElementById('bo-pa');
      if (av) av.classList.remove('hit');
       UI.$$('.bo-speed button', BattleView.el).forEach(x => {
         const on = +x.dataset.speed === (b.speed || 1);
         x.classList.toggle('on', on);
         x.setAttribute('aria-pressed', on ? 'true' : 'false');
       });
      BattleView.paint();
    },

    paint(battle) {
      const b = battle || BattleView.current();
      if (!b) return;
      const set = (id, v) => { const e = document.getElementById(id); if (e && e.textContent !== v) e.textContent = v; };
      set('bo-round', b.round > 0 ? '第 ' + b.round + ' 回合' : '准备中');
      const pp = U.clamp(b.p.hp / b.p.maxHp, 0, 1), ep = U.clamp(b.e.hp / b.e.maxHp, 0, 1);
      const energy = Math.max(0, Number(b.p.energy) || 0);
      const maxEnergy = Math.max(0, Number(b.p.maxEnergy) || 0);
      const energyPct = maxEnergy > 0 ? U.clamp(energy / maxEnergy, 0, 1) : 0;
      const energyPctText = Math.round(energyPct * 100);
      const pe = document.getElementById('bo-php');
      const ee = document.getElementById('bo-ehp');
      const en = document.getElementById('bo-pen');
      if (pe) { pe.style.width = pp * 100 + '%'; pe.parentElement.setAttribute('aria-valuenow', String(Math.round(pp * 100))); }
      if (ee) { ee.style.width = ep * 100 + '%'; ee.parentElement.setAttribute('aria-valuenow', String(Math.round(ep * 100))); }
      if (en) {
        en.style.width = energyPct * 100 + '%';
        en.parentElement.setAttribute('aria-valuenow', String(energyPctText));
        en.parentElement.setAttribute('aria-valuetext', `灵力 ${U.fmt(energy)} / ${U.fmt(maxEnergy)}（${energyPctText}%）`);
      }
      set('bo-pt', U.fmt(Math.max(0, b.p.hp)) + ' / ' + U.fmt(b.p.maxHp));
      set('bo-et', U.fmt(Math.max(0, b.e.hp)) + ' / ' + U.fmt(b.e.maxHp));

      const stBox = document.getElementById('bo-stance');
      if (stBox && BattleView.cache.stanceKey !== XG.STANCES.map(s => s.id).join('|')) {
        BattleView.cache.stanceKey = XG.STANCES.map(s => s.id).join('|');
        stBox.innerHTML = XG.STANCES.map(s => `<button type="button" class="stance-btn" data-stance="${s.id}" title="${s.desc}" aria-label="${s.name}" aria-pressed="false">${s.icon}${s.name}</button>`).join('');
      }
      if (stBox) UI.$$('[data-stance]', stBox).forEach(btn => {
        const on = btn.dataset.stance === b.p.stance;
        btn.classList.toggle('on', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      });

      const skBox = document.getElementById('bo-skills');
      if (skBox) {
        const ids = b.p.skills;
        const idsKey = ids.join('|');
        if (BattleView.cache.skillKey !== idsKey) {
          BattleView.cache.skillKey = idsKey;
          if (!ids.length) {
            skBox.innerHTML = '<div class="bo-noskill">尚未配置神通（可在「功法」页配置）</div>';
          } else {
            skBox.innerHTML = ids.map((id, i) => {
              const sk = XG.idx.skill[id];
              if (!sk) return '<span class="skill-btn empty">空位</span>';
              return `<button type="button" class="skill-btn" data-skill="${id}" title="${sk.desc}" aria-label="${sk.name}，灵力${sk.cost}">
                <span class="sb-ico" aria-hidden="true">${sk.icon}</span>
                <span class="sb-name">${sk.name}</span>
                <span class="sb-cost">灵力 ${sk.cost}</span>
                <em class="sb-key">${i + 1}</em>
              </button>`;
            }).join('');
          }
        }
        UI.$$('[data-skill]', skBox).forEach(btn => {
          const id = btn.dataset.skill;
          const sk = XG.idx.skill[id];
          if (!sk) return;
          const cd = b.p.cd[id] || 0;
          const dis = cd > 0 || b.p.energy < sk.cost || b.over;
          const ready = b.waiting && !dis;
          btn.disabled = dis;
          btn.classList.toggle('off', dis);
          btn.classList.toggle('ready', ready);
          btn.setAttribute('aria-disabled', dis ? 'true' : 'false');
          const cost = btn.querySelector('.sb-cost');
          if (cost) cost.textContent = cd > 0 ? '冷却 ' + cd : '灵力 ' + sk.cost;
        });
      }

      const pBuffKey = b.p.buffs.map(x => x.id + x.rounds).join('|');
      const eBuffKey = b.e.buffs.map(x => x.id + x.rounds).join('|');
      const pbf = document.getElementById('bo-pbf');
      if (pbf && BattleView.cache.pBuffKey !== pBuffKey) {
        BattleView.cache.pBuffKey = pBuffKey;
        pbf.innerHTML = b.p.buffs.map(bf => `<span class="bf" title="${bf.rounds} 回合">${bf.icon || ''}${bf.name}<em>${bf.rounds}</em></span>`).join('');
      }
      const ebf = document.getElementById('bo-ebf');
      if (ebf && BattleView.cache.eBuffKey !== eBuffKey) {
        BattleView.cache.eBuffKey = eBuffKey;
        ebf.innerHTML = b.e.buffs.map(bf => `<span class="bf enemy" title="${bf.rounds} 回合">${bf.icon || ''}${bf.name}<em>${bf.rounds}</em></span>`).join('');
      }

      {
        const warnKey = b.e.charging ? 'charge:' + b.e.name : b.waiting ? 'wait' : '';
        if (BattleView.cache.warnKey !== warnKey) {
          BattleView.cache.warnKey = warnKey;
          if (b.e.charging) {
            BattleView.showWarn(`⚠ <b>${UI.esc(b.e.name)}</b> 正在蓄力 —— 建议切换守势或施展护体神通`);
          } else if (b.waiting) {
            BattleView.showWarn('⌛ 轮到你出手 —— 选择一门神通，或点击右上「自动应战」');
          } else BattleView.hideWarn();
        }
      }

      const ab = document.getElementById('bo-auto');
      if (ab) {
        ab.classList.toggle('on', !!b.auto);
        ab.setAttribute('aria-pressed', b.auto ? 'true' : 'false');
        const text = b.auto ? '自动应战' : '手动应战';
        if (ab.textContent !== text) ab.textContent = text;
      }

      const lg = document.getElementById('bo-log');
      if (!lg) return;
      const shown = b.log.slice(-60);
      const last = shown[shown.length - 1];
      const logKey = shown.length + ':' + (last && last.txt || '');
      if (BattleView.cache.logKey !== logKey) {
        BattleView.cache.logKey = logKey;
        const cls = { crit: 'crit', miss: 'info', skill: 'skill', buff: 'buff', heal: 'heal', dot: 'dot', tell: 'tell', info: 'info' };
        lg.innerHTML = shown.map(l => l.t === 'win' ? `<div class="win">${l.txt}</div>` : `<div class="${cls[l.t] || 'dmg'}">${l.txt}</div>`).join('');
        lg.scrollTop = lg.scrollHeight;
      }
    },

    onEnd(battle) {
      const b = battle || BattleView.current();
      if (!b) return;
      BattleView.paint(b);
      const txt = document.getElementById('bo-result-txt');
      const win = !!(b.result && b.result.win);
      BattleView.showResult();
      txt.innerHTML = win
        ? '<span style="color:var(--gold-2);font-family:var(--font-serif);font-size:16px">✦ 战斗胜利 ✦</span>'
        : '<span style="color:#ff9aa8;font-family:var(--font-serif);font-size:16px">✖ 战斗失败 ✖</span>';
      const lg = document.getElementById('bo-log');
      lg.insertAdjacentHTML('beforeend', `<div class="win">${win ? '你击败了对手！' : '你倒下了……'}</div>`);
      lg.scrollTop = lg.scrollHeight;
      const av = document.getElementById('bo-pa');
      if (av) av.classList.toggle('hit', !win);
      BattleView.hideWarn();
      MT.markDirty();
      clearTimeout(BattleView.resultTimer);
      const delay = XG.CONFIG.AUTO_RESULT_DELAY === undefined ? 4.2 : XG.CONFIG.AUTO_RESULT_DELAY;
      BattleView.resultTimer = setTimeout(() => {
        if (typeof XG.Combat.closeResult === 'function') XG.Combat.closeResult();
        else if (typeof XG.Combat.closeBattle === 'function') XG.Combat.closeBattle();
        BattleView.hide();
      }, Math.max(0, delay) * 1000);
    },

    hide() {
      clearTimeout(BattleView.resultTimer);
      if (BattleView.el) {
        BattleView.el.classList.add('hidden');
        BattleView.el.setAttribute('aria-hidden', 'true');
      }
    },
  };

  MT.register('pets', PetsPanel);
  MT.register('bag', BagPanel);
  MT.register('explore', ExplorePanel);
  MT.register('tower', TowerPanel);
  MT.register('achievement', AchPanel);
  MT.register('ascend', AscendPanel);

  XG.BattleView = BattleView;
  XG.P_Bag = BagPanel;
  XG.P_Explore = ExplorePanel;
  XG.P_Tower = TowerPanel;
})();

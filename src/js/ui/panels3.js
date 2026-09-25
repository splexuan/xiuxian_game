/* ═══════════════════════════════════════════
   panels3.js — 道途 / 寻宝阁 / 锻炉 / 掉落与抽卡表现
   ═══════════════════════════════════════════ */
(function () {
  'use strict';
  const XG = window.XG;
  const U = XG.U, R = XG.R;
  const UI = XG.UI, MT = XG.MT, Frag = XG.Frag;

  const qColor = q => U.QUALITY[U.clamp(q | 0, 0, 6)].color;
  const qName = q => U.QUALITY[U.clamp(q | 0, 0, 6)].name;

  /* ═══════════════════════════════════════
     一、道途（任务链 + 引导）
     ═══════════════════════════════════════ */
  const QuestPanel = {
    init() {},
    render(box) {
      const s = XG.State.s;
      const cur = XG.Quest.current();
      const idx = XG.Quest.index();
      const total = XG.Quest.total();

      let html = `
        <div class="card">
          <div class="card-title"><span class="ico">📜</span>道途
            <span class="sub">已达成 ${XG.Quest.doneCount()} / ${total}</span></div>
          <div class="hint">循道途而行，每一步皆有馈赠。达成目标后点击「领取」获取奖励。</div>
        </div>`;

      /* 章节进度 */
      html += `<div class="card"><div class="card-title"><span class="ico">🧭</span>六章道途</div><div class="ch-list">`;
      for (const c of XG.Quest.CHAPTERS) {
        const p = XG.Quest.chapterProgress(c.n);
        const unlocked = XG.Quest.chapterUnlocked(c.n);
        const done = p.done >= p.total;
        html += `<div class="ch-item ${unlocked ? '' : 'locked'} ${done ? 'done' : ''}">
          <div class="ch-ico">${c.icon}</div>
          <div class="ch-body">
            <div class="ch-name">第${'一二三四五六'[c.n - 1]}章 · ${c.name}${done ? '<em>已圆满</em>' : ''}</div>
            <div class="ch-desc">${c.desc}</div>
            <div class="ch-bar"><i style="width:${(p.done / p.total * 100).toFixed(0)}%"></i></div>
          </div>
          <div class="ch-num">${p.done}/${p.total}</div>
        </div>`;
      }
      html += `</div></div>`;

      /* 当前任务 */
      if (cur) {
        const reached = XG.Quest.reached();
        html += `<div class="card quest-cur ${reached ? 'ready' : ''}">
          <div class="card-title"><span class="ico">${cur.icon}</span>当前目标<span class="sub">第 ${idx + 1} / ${total} 步</span></div>
          <div class="quest-big">
            <div class="q-title">${cur.title}</div>
            <div class="q-desc">${cur.desc}</div>
            ${cur.tip ? `<div class="q-tip">💡 ${cur.tip}</div>` : ''}
            <div class="q-reward" id="q-reward">奖励：${QuestPanel.rewardText(cur.reward)}</div>
          </div>
          <div class="btn-row" style="margin-top:12px">
             <button class="btn ${reached ? 'primary' : ''}" id="q-claim" data-reached="${reached ? '1' : '0'}" style="flex:1" ${reached ? '' : 'disabled'}>
              ${reached ? '✦ 领取奖励' : '尚未达成'}
            </button>
          </div>
        </div>`;
      } else {
        html += `<div class="card"><div class="empty"><span class="e-ico">🏁</span>道途已尽，你已立于仙途之巅。</div></div>`;
      }

      /* 后续任务预览 */
      const upcoming = XG.QUESTS.slice(idx + 1, idx + 4);
      if (upcoming.length) {
        html += `<div class="card"><div class="card-title"><span class="ico">▸</span>后续道途</div>`;
        for (const q of upcoming) {
          html += `<div class="q-preview"><span class="qp-ico">${q.icon}</span>
            <div><b>${q.title}</b><small>${q.desc}</small></div></div>`;
        }
        html += `</div>`;
      }

      box.innerHTML = html;
      box.onclick = (e => {
        if (e.target.closest('#q-claim')) {
          const r = XG.Quest.claim();
          if (r.ok) {
            XG.Float.show('道途奖励已领取！', 'epic');
            if (r.next) XG.Float.show('新目标：' + r.next.title, 'good');
          } else if (r.reason === 'unfinished') XG.Float.show('目标尚未达成', 'bad');
          MT.markDirty('quest');
          MT.updateDots();
        }
      });
      QuestPanel.update(box);
    },

    rewardText(r) {
      const parts = [];
      if (r.jade) parts.push('仙玉 ' + r.jade);
      if (r.stoneSec) parts.push('灵石（约 ' + r.stoneSec + ' 秒产出）');
      if (r.stone) parts.push('灵石 ' + U.fmt(r.stone));
      if (r.herb) parts.push('灵草 ' + U.fmt(r.herb));
      for (const k in (r.mat || {})) { const m = XG.idx.mat[k]; parts.push((m ? m.name : k) + '×' + r.mat[k]); }
      if (r.gem) parts.push(`宝石(${r.gem.tier}阶)×${r.gem.n || 1}`);
      if (r.equip) parts.push(qName(r.equip.q) + '装备一件');
      if (r.pet) parts.push('灵宠');
      if (r.free === 'spirit') parts.push('永久 灵气/秒 +2%');
      if (r.free === 'all') parts.push('永久 全属性 +1.2%');
      if (r.free === 'atk') parts.push('永久 全属性 +0.8%');
      return parts.join(' · ') || '—';
    },

    update() {
      const btn = document.getElementById('q-claim');
      if (!btn) return;
      const reached = XG.Quest.reached();
      const state = reached ? '1' : '0';
      if (btn.dataset.reached === state) return;
      btn.dataset.reached = state;
      btn.classList.toggle('primary', reached);
      btn.disabled = !reached;
      btn.textContent = reached ? '✦ 领取奖励' : '尚未达成';
      MT.markDirty('quest');
    },
  };

  /* ═══════════════════════════════════════
     二、寻宝阁
     ═══════════════════════════════════════ */
  const GachaPanel = {
    pool: 'art',
    init() {},
    render(box) {
      const pools = XG.Gacha.pools();
      let html = `<div class="card">
        <div class="card-title"><span class="ico">🎰</span>寻宝阁<span class="sub">仙玉 ${U.fmt(XG.State.s.res.jade)}</span></div>
        <div class="hint">各池拥有独立保底计数，十连享折扣且更易触发保底。</div>
      </div>`;

      html += `<div class="pool-grid" id="pool-grid">`;
      for (const p of pools) {
        const info = XG.Gacha.info(p.id);
        html += `<button class="pool-card ${GachaPanel.pool === p.id ? 'on' : ''}" type="button" data-pool="${p.id}" aria-pressed="${GachaPanel.pool === p.id ? 'true' : 'false'}" style="--pc:${p.color}">
          <span class="pc-ico">${p.icon}</span>
          <span class="pc-name">${p.name}</span>
          <span class="pc-pity">保底 ${info.pityLeft} 抽</span>
        </button>`;
      }
      html += `</div>`;

      const pool = XG.Gacha.def(GachaPanel.pool);
      if (pool) {
        const info = XG.Gacha.info(pool.id);
        const cur = pool.cur === 'jade';
        const have = cur ? XG.State.s.res.jade : XG.State.s.res.stone;
        const fmtCost = v => (cur ? v : U.fmt(v));
        html += `<div class="card">
          <div class="card-title"><span class="ico">${pool.icon}</span>${pool.name}
            <span class="sub">已抽 ${info.total} 次</span></div>
          <div class="hint">${pool.desc}</div>
          <div class="pity-wrap">
             <div class="pity-bar" role="progressbar" aria-label="${pool.name}保底进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round((1 - info.pityLeft / info.pity.n) * 100)}"><i style="width:${(1 - info.pityLeft / info.pity.n) * 100}%"></i></div>
            <div class="pity-txt">${pool.pity.label}　还剩 <b>${info.pityLeft}</b> 抽</div>
          </div>
          <div class="btn-row" style="margin-top:12px">
             <button class="btn" id="g1" type="button" style="flex:1" ${have >= info.single ? '' : 'disabled'}>
               寻宝 ×1　<span class="cost-inline">${cur ? '✦' : '◈'}${fmtCost(info.single)}</span>
             </button>
             <button class="btn primary" id="g10" type="button" style="flex:1.25" ${have >= info.ten ? '' : 'disabled'}> 
              寻宝 ×10　<span class="cost-inline">${cur ? '✦' : '◈'}${fmtCost(info.ten)}</span>
            </button>
          </div>
          <div class="cost" style="margin-top:8px">当前持有：${cur ? '仙玉 ' + U.fmt(have) : '灵石 ' + U.fmt(have)}</div>
        </div>`;
      }

      html += `<div class="card">
        <div class="card-title"><span class="ico">✦</span>本次所得</div>
        <div class="pull-grid" id="pull-grid">
          <div class="empty"><span class="e-ico">🎁</span>尚未寻宝</div>
        </div>
      </div>`;

      box.innerHTML = html;
      GachaPanel._paintKey = null;
      if (XG.State.s.lastPulls && XG.State.s.lastPulls.length) GachaPanel.paint(XG.State.s.lastPulls);

      box.onclick = (e => {
        const pc = e.target.closest('[data-pool]');
        if (pc) { GachaPanel.pool = pc.dataset.pool; MT.markDirty('gacha'); MT.render('gacha', true); return; }
        if (e.target.closest('#g1')) GachaPanel.doPull(1);
        if (e.target.closest('#g10')) GachaPanel.doPull(10);
      });
    },

    doPull(n) {
      const r = XG.Gacha.pull(GachaPanel.pool, n);
      if (!r.ok) {
        const pool = XG.Gacha.def(GachaPanel.pool);
        XG.Float.show(pool.cur === 'jade' ? '仙玉不足' : '灵石不足', 'bad');
        return;
      }
      GachaPanel.paint(r.out, true);
      if (n >= 10) XG.PullView.show(r.out, GachaPanel.pool);
      XG.MT.markDirty();
      XG.MT.updateDots();
    },

    paint(out, animate) {
      const g = document.getElementById('pull-grid');
      if (!g) return;
      const key = out.map(r => `${r.type}:${r.name || ''}:${r.q}:${r.tier || ''}`).join('|');
      if (GachaPanel._paintKey === key && !animate) return;
      GachaPanel._paintKey = key;
      UI.setHTML(g, out.map((r, i) =>
        `<div class="pull-card q${r.q}" style="--q:${qColor(r.q)};animation-delay:${animate ? i * 55 : 0}ms">
          <div class="pc-q">${qName(r.q)}</div>
          <div class="pc-body">
            <div class="pc-title">${UI.esc(r.name || '')}</div>
            <div class="pc-sub">${GachaPanel.detail(r)}</div>
          </div>
        </div>`).join(''));
    },

    detail(r) {
      if (r.type === 'art') return '功法 · ' + XG.ART_TYPE[r.art.type].name;
      if (r.type === 'equip') return '装备 · ' + (XG.idx.slot[r.eq.slot] ? XG.idx.slot[r.eq.slot].name : '') + (r.eq.set ? ' · ' + XG.SETS[r.eq.set].name + '套' : '');
      if (r.type === 'pet') return '灵宠 · 已收入灵兽园';
      if (r.type === 'gem') return '宝石 · ' + r.tier + ' 阶';
      if (r.type === 'mat') return '灵材';
      if (r.type === 'herb') return '灵草';
      if (r.type === 'stone') return '灵石';
      return '';
    },
  };

  /* ═══════════════════════════════════════
     三、锻炉
     ═══════════════════════════════════════ */
  const FORGE_TABS = [
    { id: 'enhance', name: '强化', icon: '⬆' },
    { id: 'merge', name: '合成', icon: '⚗' },
    { id: 'reforge', name: '镶嵌·重铸', icon: '💠' },
    { id: 'gem', name: '宝石', icon: '🔮' },
    { id: 'mat', name: '灵材', icon: '🧱' },
  ];

  const ForgePanel = {
    tab: 'enhance',
    sel: null,
    init() {},
    render(box) {
      const s = XG.State.s;
      let html = `<div class="card">
        <div class="card-title"><span class="ico">🔨</span>锻炉<span class="sub">灵石 ${U.fmt(s.res.stone)}</span></div>
        <div class="hint">强化提升装备基础属性，三件同品同部位可合成为更高品阶，宝石镶嵌提供额外词条。</div>
      </div>`;

      html += `<div class="tabbar">` + FORGE_TABS.map(t =>
         `<button class="tab ${ForgePanel.tab === t.id ? 'on' : ''}" type="button" data-ftab="${t.id}" aria-pressed="${ForgePanel.tab === t.id ? 'true' : 'false'}">${t.icon} ${t.name}</button>`).join('') + `</div>`;

      html += `<div id="forge-body">${ForgePanel.body()}</div>`;
      box.innerHTML = html;

      box.onclick = (e => ForgePanel.onClick(e));
      ForgePanel.update(box);
    },

    update() {},

    body() {
      switch (ForgePanel.tab) {
        case 'merge': return ForgePanel.bodyMerge();
        case 'reforge': return ForgePanel.bodyReforge();
        case 'gem': return ForgePanel.bodyGem();
        case 'mat': return ForgePanel.bodyMat();
        default: return ForgePanel.bodyEnhance();
      }
    },

    /* ── 装备卡片 ── */
    eqCard(eq, opts) {
      opts = opts || {};
      const affixes = [];
      for (const a of XG.AFFIX) {
        const st = XG.State.Calc.eqStats(eq);
        if (st[a.key]) affixes.push(`<span class="aff">${a.name} ${a.fmt(st[a.key])}</span>`);
      }
      const unsocketCost = Math.ceil(XG.Combat.stoneUnit() * 8);
      const canUnsocket = XG.State.s.res.stone >= unsocketCost;
      const sock = (eq.sockets || []).map((g, i) => {
        if (!g) return `<button class="sock empty" type="button" data-sock="${eq.id}:${i}" title="镶嵌宝石" aria-label="镶嵌宝石">＋</button>`;
        const d = XG.idx.gem[g.id];
        return `<button class="sock on" type="button" data-unsock="${eq.id}:${i}" title="点击取下" aria-label="取下宝石" ${canUnsocket ? '' : 'disabled'}>${d ? d.icon : '?'}<em>${g.tier}</em></button>`;
      }).join('');
      const setName = eq.set && XG.SETS[eq.set] ? XG.SETS[eq.set].name : '';
      return `<div class="eq-card" style="--q:${qColor(eq.q)}">
        <div class="eq-head">
          <span class="eq-name">${UI.esc(eq.name)}${eq.enh ? `<em class="enh">+${eq.enh}</em>` : ''}</span>
          <span class="item-tag" style="--q:${qColor(eq.q)}">${qName(eq.q)}</span>
          ${setName ? `<span class="item-tag set">${setName}套</span>` : ''}
        </div>
        <div class="aff-list">${affixes.join('')}</div>
        ${sock ? `<div class="sock-row">${sock}</div>` : ''}
        ${opts.actions || ''}
      </div>`;
    },

    /* ── 强化 ── */
    bodyEnhance() {
      const s = XG.State.s;
      const list = [];
      for (const sl of XG.SLOTS) if (s.equip[sl.id]) list.push(s.equip[sl.id]);
      const bagTop = s.equipBag.slice().sort((a, b) => b.score - a.score).slice(0, 6);
      let html = `<div class="card"><div class="card-title"><span class="ico">⬆</span>强化<span class="sub">上限 +${XG.FORGE_CFG.ENHANCE_MAX}</span></div>
        <div class="hint">每级提升该装备全部属性 10%。等级越高成功率越低，失败不降级但消耗不退。</div>`;
      if (!list.length && !bagTop.length) return html + Frag.empty('🗡', '尚无可强化的装备') + '</div>';

      const row = (eq) => {
        const lv = eq.enh || 0;
        const cost = XG.Forge.enhanceCost(eq);
        const ch = XG.Forge.enhanceChance(eq);
        const can = lv < XG.FORGE_CFG.ENHANCE_MAX && s.res.stone >= cost;
        return ForgePanel.eqCard(eq, {
          actions: `<div class="eq-act">
            <span class="cost ${s.res.stone >= cost ? 'full' : 'no'}">灵石 <b>${U.fmt(cost)}</b></span>
            <span class="odds">成功率 ${(ch * 100).toFixed(0)}%</span>
            <button class="btn sm ${can ? 'primary' : ''}" data-enh="${eq.id}" ${can ? '' : 'disabled'}>
              ${lv >= XG.FORGE_CFG.ENHANCE_MAX ? '已满级' : '强化 +' + (lv + 1)}
            </button>
          </div>`,
        });
      };

      html += `<div class="sub-title">已装备</div>` + list.map(row).join('');
      if (bagTop.length) html += `<div class="sub-title">背包（评分最高 6 件）</div>` + bagTop.map(row).join('');
      html += `</div>`;
      return html;
    },

    /* ── 合成 ── */
    bodyMerge() {
      const s = XG.State.s;
      const targets = XG.Forge.mergeTargets();
      let html = `<div class="card"><div class="card-title"><span class="ico">⚗</span>合成升品</div>
        <div class="hint">消耗 <b>3 件</b>同部位、同品阶装备，铸成 <b>1 件更高品阶</b>装备（并继承部分强化等级）。</div>`;
      if (!targets.length) {
        html += Frag.empty('⚗', '暂无可合成的组合（需 3 件同部位同品阶装备）');
      } else {
        for (const t of targets) {
          const can = s.res.stone >= t.cost;
          html += `<div class="merge-row" style="--q:${qColor(t.q)}">
            <div class="mr-ico">${XG.idx.slot[t.slot] ? XG.idx.slot[t.slot].icon : '🗡'}</div>
            <div class="mr-body">
              <div class="mr-name">${t.slotName} · ${qName(t.q)} → <b style="color:${qColor(t.q + 1)}">${qName(t.q + 1)}</b></div>
              <div class="mr-stock">持有 <b>${t.have}</b> 件</div>
            </div>
            <div class="mr-act">
              <div class="cost ${can ? 'full' : 'no'}">灵石 <b>${U.fmt(t.cost)}</b></div>
              <button class="btn sm ${can ? 'primary' : ''}" data-merge="${t.slot}:${t.q}" ${can ? '' : 'disabled'}>合成</button>
            </div>
          </div>`;
        }
        const canAll = targets.filter(t => s.res.stone >= t.cost);
        if (canAll.length > 1) {
          html += `<div class="btn-row" style="margin-top:10px"><button class="btn sm" id="merge-all" style="flex:1">一键合成（全部可合成项）</button></div>`;
        }
      }
      html += `</div>`;
      return html;
    },

    /* ── 镶嵌与重铸 ── */
    bodyReforge() {
      const s = XG.State.s;
      const list = [];
      for (const sl of XG.SLOTS) if (s.equip[sl.id]) list.push(s.equip[sl.id]);
      if (!list.length) return `<div class="card">${Frag.empty('🗡', '尚无装备')}</div>`;
      let html = `<div class="card"><div class="card-title"><span class="ico">💠</span>镶嵌 · 重铸</div>
        <div class="hint">点击空孔镶入宝石；「重铸」随机重洗副属性（不会低于原有评分太多）。取下宝石需少量灵石。</div>`;
      for (const eq of list) {
        const cost = XG.Forge.rerollCost(eq);
        const can = s.res.stone >= cost;
        html += ForgePanel.eqCard(eq, {
          actions: `<div class="eq-act">
            <span class="cost ${can ? 'full' : 'no'}">灵石 <b>${U.fmt(cost)}</b></span>
            <button class="btn" data-reroll="${eq.id}" ${can ? '' : 'disabled'}>重铸词条</button>
          </div>`,
        });
      }
      html += `</div>`;
      return html;
    },

    /* ── 宝石背包 ── */
    bodyGem() {
      const list = XG.Forge.gemList();
      let html = `<div class="card"><div class="card-title"><span class="ico">🔮</span>宝石<span class="sub">库存 ${list.reduce((a, b) => a + b.n, 0)} 颗</span></div>
        <div class="hint">3 颗同种同阶宝石可合成 1 颗更高阶（数值 ×1.9）。已镶嵌 ${XG.Forge.gemCount()} 颗。</div>`;
      const canSocket = list.length > 0 && XG.SLOTS.some(sl => {
        const eq = XG.State.s.equip[sl.id];
        return eq && XG.Forge.socketFree(eq) >= 0;
      });
      html += `<div class="btn-row" style="margin-bottom:10px"><button class="btn sm primary" id="auto-sock" style="flex:1" ${canSocket ? '' : 'disabled'}>一键镶嵌（自动填入空孔）</button></div>`;
      if (!list.length) {
        html += Frag.empty('🔮', '尚无宝石（秘境、通天塔与寻宝阁可获得）');
      } else {
        for (const g of list) {
          const canUp = g.tier < XG.GEM_MAX_TIER && g.n >= XG.Forge.GEM_NEED;
          const cost = Math.ceil(XG.Combat.stoneUnit() * 12 * g.tier);
          html += `<div class="gem-row">
            <div class="gr-ico" style="--gc:${g.def.color}">${g.def.icon}</div>
            <div class="gr-body">
              <div class="gr-name">${g.def.name} <em class="tier">${g.tier} 阶</em> ×${g.n}</div>
              <div class="gr-eff">${XG.AFFIX.find(a => a.key === g.def.stat)?.name || g.def.stat} +${(g.def.val * Math.pow(XG.GEM_TIER_MULT, g.tier - 1) * 100).toFixed(1)}%</div>
            </div>
            <div class="gr-act">
              ${g.tier < XG.GEM_MAX_TIER
                ? `<span class="cost ${g.n >= 3 ? 'full' : 'no'}">灵石 <b>${U.fmt(cost)}</b></span>
                   <button class="btn sm ${canUp ? 'primary' : ''}" data-gemup="${g.id}:${g.tier}" ${canUp && XG.State.s.res.stone >= cost ? '' : 'disabled'}>合成 ${g.tier + 1} 阶</button>`
                : `<span class="odds">已达最高阶</span>`}
            </div>
          </div>`;
        }
      }
      html += `</div>`;
      return html;
    },

    /* ── 灵材合成 ── */
    bodyMat() {
      const s = XG.State.s;
      let html = `<div class="card"><div class="card-title"><span class="ico">🧱</span>灵材合成</div>
        <div class="hint">3 份同种灵材可合炼为 1 份更高阶灵材，用于高阶丹药与强化。</div>`;
      const have = XG.MATS.filter(m => (s.mats[m.id] || 0) > 0);
      if (!have.length) {
        html += Frag.empty('🧱', '尚无灵材（秘境与通天塔可获取）');
      } else {
        for (const m of have) {
          const n = s.mats[m.id];
          const canUp = m.q < 6 && n >= ForgePanel.MAT_NEED;
          const cost = Math.ceil(XG.Combat.stoneUnit() * 10 * m.q);
          html += `<div class="gem-row">
            <div class="gr-ico" style="--gc:${qColor(m.q)}">${m.icon}</div>
            <div class="gr-body">
              <div class="gr-name">${m.name} <em class="tier">${m.q} 阶</em> ×${U.fmt(n)}</div>
              <div class="gr-eff">${m.desc}</div>
            </div>
            <div class="gr-act">
              ${m.q < 6
                ? `<span class="cost ${n >= 3 ? 'full' : 'no'}">灵石 <b>${U.fmt(cost)}</b></span>
                   <button class="btn sm ${canUp ? 'primary' : ''}" data-matup="${m.id}" ${canUp && s.res.stone >= cost ? '' : 'disabled'}>合炼 ×3</button>`
                : `<span class="odds">最高阶</span>`}
            </div>
          </div>`;
        }
      }
      html += `</div>`;
      return html;
    },

    MAT_NEED: 3,

    onClick(e) {
      const t = e.target;
      const ftab = t.closest('[data-ftab]');
      if (ftab) { ForgePanel.tab = ftab.dataset.ftab; MT.render('forge', true); return; }

      const enh = t.closest('[data-enh]');
      if (enh) {
        const r = XG.Forge.enhance(enh.dataset.enh);
        if (r.ok) XG.Float.show(r.success ? '强化成功 +' + r.enh : '强化失败…', r.success ? 'epic' : 'bad');
        else if (r.reason === 'stone') XG.Float.show('灵石不足', 'bad');
        ForgePanel.refresh();
        return;
      }

      const mg = t.closest('[data-merge]');
      if (mg) {
        const [slot, q] = mg.dataset.merge.split(':');
        const r = XG.Forge.merge(slot, +q);
        if (r.ok) { XG.Float.show('合成成功：' + r.eq.name, 'epic'); ForgePanel.tab = 'enhance'; }
        else XG.Float.show(r.reason === 'stone' ? '灵石不足' : '材料不足', 'bad');
        ForgePanel.refresh();
        return;
      }

      if (t.closest('#merge-all')) {
        let n = 0, guard = 0;
        while (guard++ < 60) {
          const t2 = XG.Forge.mergeTargets().filter(x => XG.State.s.res.stone >= x.cost);
          if (!t2.length) break;
          const r = XG.Forge.merge(t2[0].slot, t2[0].q);
          if (!r.ok) break;
          n++;
        }
        XG.Float.show(n ? `一键合成 ${n} 次` : '无可合成项', n ? 'epic' : 'bad');
        ForgePanel.refresh();
        return;
      }

      const rr = t.closest('[data-reroll]');
      if (rr) {
        const r = XG.Forge.reroll(rr.dataset.reroll);
        if (r.ok) XG.Float.show(`重铸完成：${r.before.toFixed(2)} → ${r.after.toFixed(2)}`, r.after >= r.before ? 'epic' : 'bad');
        else XG.Float.show('灵石不足', 'bad');
        ForgePanel.refresh();
        return;
      }

      const sk = t.closest('[data-sock]');
      if (sk) {
        const [eqId, idx] = sk.dataset.sock.split(':');
        XG.Modals.pickGem(eqId, +idx);
        return;
      }

      const us = t.closest('[data-unsock]');
      if (us) {
        const [eqId, idx] = us.dataset.unsock.split(':');
        const r = XG.Forge.unsocket(eqId, +idx);
        XG.Float.show(r.ok ? '宝石已取下' : '灵石不足', r.ok ? 'good' : 'bad');
        ForgePanel.refresh();
        return;
      }

      const gu = t.closest('[data-gemup]');
      if (gu) {
        const [id, tier] = gu.dataset.gemup.split(':');
        const r = XG.Forge.gemMerge(id, +tier);
        XG.Float.show(r.ok ? '宝石合成成功' : '材料不足', r.ok ? 'epic' : 'bad');
        ForgePanel.refresh();
        return;
      }

      const mu = t.closest('[data-matup]');
      if (mu) {
        const r = XG.Forge.matUpgrade(mu.dataset.matup);
        XG.Float.show(r.ok ? '合炼成功：' + r.to.name : '材料不足', r.ok ? 'epic' : 'bad');
        ForgePanel.refresh();
        return;
      }

      if (t.closest('#auto-sock')) {
        const n = XG.Forge.autoSocket();
        XG.Float.show(n ? `已镶嵌 ${n} 颗宝石` : '没有可镶嵌的宝石或空孔', n ? 'epic' : 'bad');
        ForgePanel.refresh();
        return;
      }
    },

    refresh() {
      MT.markDirty('forge');
      if (MT.current === 'forge') MT.render('forge', true);
      MT.updateDots();
      XG.Bus.emit('equip:change', null);
    },
  };

  /* ═══════════════════════════════════════
     四、掉落弹窗（品阶 >= 宝品才展示，避免刷屏）
     ═══════════════════════════════════════ */
  const LootView = {
    queue: [],
    showing: false,
    last: 0,
    init() {
      XG.Bus.on('loot', d => LootView.push(d));
    },
    push(d) {
      if (!d || !d.eq) return;
      if (d.eq.q < 2) return;                 // 低品不打扰
      const now = Date.now();
      if (now - LootView.last < 400) return;  // 节流
      LootView.last = now;
      if (LootView.queue.length > 6) return;
      LootView.queue.push(d);
      if (!LootView.showing) LootView.next();
    },
    next() {
      const d = LootView.queue.shift();
      const layer = document.getElementById('loot-layer');
      if (!layer) { LootView.showing = false; return; }
      if (!d) { LootView.showing = false; return; }
      LootView.showing = true;
      const eq = d.eq;
      const st = XG.State.Calc.eqStats(eq);
      const affix = XG.AFFIX.filter(a => st[a.key]).map(a => `${a.name} ${a.fmt(st[a.key])}`).join(' · ');
      const el = document.createElement('div');
      el.className = 'loot-toast q' + eq.q;
      el.style.setProperty('--q', qColor(eq.q));
      el.innerHTML = `
        <div class="lt-tag">${qName(eq.q)}${eq.set && XG.SETS[eq.set] ? ' · ' + XG.SETS[eq.set].name + '套' : ''}</div>
        <div class="lt-name">${UI.esc(eq.name)}${eq.enh ? ' +' + eq.enh : ''}</div>
        <div class="lt-aff">${affix}</div>
        <div class="lt-from">来自 ${UI.esc(d.from || '未知')}</div>`;
      layer.appendChild(el);
      setTimeout(() => { el.classList.add('out'); }, 2400);
      setTimeout(() => { el.remove(); LootView.next(); }, 2900);
    },
  };

  /* ═══════════════════════════════════════
     五、抽卡结果全屏展示
     ═══════════════════════════════════════ */
  const PullView = {
    top: null,
    openCount: 0,
    layerState: null,
    init() {},
    focusable(root) {
      return UI.$$('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[contenteditable="true"],[tabindex]:not([tabindex="-1"])', root)
        .filter(el => XG.Modals && typeof XG.Modals.canFocus === 'function' ? XG.Modals.canFocus(el) : true);
    },
    isTop(el) {
      const target = el || PullView.top;
      if (!target || PullView.top !== target) return false;
      return !XG.Modals || typeof XG.Modals.isBackgroundActive !== 'function' || XG.Modals.isBackgroundActive(target);
    },
    show(out, poolId) {
      const pool = XG.Gacha.def(poolId);
      if (!pool) return;
      const layer = document.getElementById('loot-layer');
      if (!layer) return;
      if (!PullView.openCount) {
        PullView.layerState = { pointerEvents: layer.style.pointerEvents, zIndex: layer.style.zIndex };
      }
      PullView.openCount++;
      layer.style.pointerEvents = 'auto';
      layer.style.zIndex = '250';
      const el = document.createElement('div');
      el.className = 'pull-veil';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      el.setAttribute('aria-label', '十连寻宝结果');
      el.tabIndex = -1;
      el.style.pointerEvents = 'auto';
      el.style.overscrollBehavior = 'contain';
      el.innerHTML = `
        <div class="pv-inner">
          <div class="pv-title">${pool.icon} ${pool.name}</div>
          <div class="pv-grid">
            ${out.map((r, i) => `<div class="pv-card" style="--q:${qColor(r.q)};animation-delay:${i * 60}ms">
              <div class="pv-q">${qName(r.q)}</div>
              <div class="pv-name">${UI.esc(r.name || '')}</div>
              <div class="pv-sub">${GachaPanel.detail(r)}</div>
            </div>`).join('')}
          </div>
          <button class="btn primary" id="pv-close" type="button" aria-label="关闭十连结果">收下</button>
        </div>`;
      layer.appendChild(el);
      const previousFocus = document.activeElement;
      const previousTop = PullView.top;
      PullView.top = el;
      let closed = false;
      let localIsolation = null;
      let lock = null;
      if (XG.Modals && typeof XG.Modals.lockBackground === 'function') lock = XG.Modals.lockBackground(el);
      else {
        localIsolation = UI.$$('body > :not(#loot-layer)').map(node => ({
          node,
          inert: !!node.inert,
          inertAttr: node.hasAttribute('inert'),
          aria: node.getAttribute('aria-hidden'),
        }));
        localIsolation.forEach(item => {
          try { item.node.inert = true; } catch (e) { }
          item.node.setAttribute('inert', '');
          item.node.setAttribute('aria-hidden', 'true');
        });
      }
      const close = () => {
        if (closed) return;
        closed = true;
        document.removeEventListener('keydown', onKeyDown, true);
        if (el.parentNode) el.parentNode.removeChild(el);
        if (lock && XG.Modals && typeof XG.Modals.unlockBackground === 'function') XG.Modals.unlockBackground(lock);
        if (localIsolation) {
          localIsolation.forEach(item => {
            try { item.node.inert = item.inert; } catch (e) { }
            if (item.inertAttr) item.node.setAttribute('inert', '');
            else item.node.removeAttribute('inert');
            if (item.aria === null) item.node.removeAttribute('aria-hidden');
            else item.node.setAttribute('aria-hidden', item.aria);
          });
        }
        if (PullView.top === el) PullView.top = previousTop;
        PullView.openCount = Math.max(0, PullView.openCount - 1);
        if (!PullView.openCount && PullView.layerState) {
          layer.style.pointerEvents = PullView.layerState.pointerEvents;
          layer.style.zIndex = PullView.layerState.zIndex;
          PullView.layerState = null;
        }
        setTimeout(() => {
          const valid = XG.Modals && typeof XG.Modals.canFocus === 'function'
            ? XG.Modals.canFocus(previousFocus) : !!previousFocus && document.contains(previousFocus);
          if (valid) previousFocus.focus();
        }, 0);
      };
      const onKeyDown = ev => {
        if (closed || !PullView.isTop(el)) return;
        if (ev.key === 'Escape') {
          ev.preventDefault();
          ev.stopPropagation();
          ev.stopImmediatePropagation();
          close();
          return;
        }
        if (ev.key !== 'Tab') return;
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();
        const focusable = PullView.focusable(el);
        if (!focusable.length) {
          el.focus();
          return;
        }
        const index = focusable.indexOf(document.activeElement);
        const next = ev.shiftKey
          ? (index <= 0 ? focusable.length - 1 : index - 1)
          : (index < 0 || index === focusable.length - 1 ? 0 : index + 1);
        focusable[next].focus();
      };
      el.addEventListener('click', ev => {
        if (ev.target.id === 'pv-close' || ev.target === el || ev.target.classList.contains('pv-inner')) close();
      });
      document.addEventListener('keydown', onKeyDown, true);
      const closeButton = el.querySelector('#pv-close');
      if (closeButton) closeButton.focus();
    },
  };

  MT.register('quest', QuestPanel);
  MT.register('gacha', GachaPanel);
  MT.register('forge', ForgePanel);

  XG.QuestPanel = QuestPanel;
  XG.GachaPanel = GachaPanel;
  XG.ForgePanel = ForgePanel;
  XG.LootView = LootView;
  XG.PullView = PullView;
})();

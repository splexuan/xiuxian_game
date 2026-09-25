/* ═══════════════════════════════════════════
   panels.js — 修炼 / 洞天 / 功法 / 丹道
   ═══════════════════════════════════════════ */
(function () {
  'use strict';
  const XG = window.XG;
  const U = XG.U, R = XG.R;
  const UI = XG.UI, MT = XG.MT, Frag = XG.Frag;

  const QUOTES = [
    '朝闻道，夕可死矣。',
    '大道无形，生育天地。',
    '心若冰清，天塌不惊。',
    '我命由我不由天。',
    '一念成仙，一念成魔。',
    '天地不仁，以万物为刍狗。',
    '一步一回首，何处是归途。',
    '三千大道，唯我独尊。',
    '修仙者，逆天而行也。',
    '宝剑锋从磨砺出，梅花香自苦寒来。',
    '凡人畏果，菩萨畏因。',
    '踏上仙途，再无归路。',
  ];

  /* ═══════════════════════════════════════
     一、修炼
     ═══════════════════════════════════════ */
  const CultivatePanel = {
    init() {},
    render(box) {
      const s = XG.State.s, C = XG.State.Calc;
      const rb = XG.REALMS[s.realm];
      const maxed = R.isMax(s.realm, s.layer);
      const needT = R.needTribulation(s.realm, s.layer);
      box.innerHTML = `
        <div class="cult-hero">
           <button class="hero-sphere" id="hero-sphere" type="button" aria-label="吐纳，凝聚少量灵气" title="点击吐纳（可获得少量灵气）"><span aria-hidden="true">☯</span></button>
          <div class="hero-title" id="p-realm">${R.name(s.realm, s.layer)}</div>
          <div class="hero-sub" id="p-desc">${rb.desc}</div>
          <div class="hero-quote" id="p-quote">${U.pick(QUOTES)}</div>
        </div>

        <div class="card">
          <div class="card-title"><span class="ico">☯</span>吐纳修行
            <span class="sub" id="p-eta"></span></div>
           <div class="bar jade" id="p-progress" role="progressbar" aria-label="吐纳进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" style="height:14px"><i id="p-fill" style="width:0%"></i></div>
          <div style="display:flex;justify-content:space-between;margin-top:7px;font-size:12px">
            <span style="color:var(--txt-dim)" id="p-spirit">0 / 0</span>
            <span style="color:var(--jade)" id="p-rate">+0/秒</span>
          </div>
          <div class="btn-row" style="margin-top:12px">
             <button class="btn primary" id="p-break" type="button" style="flex:1">${maxed ? '已臻化境' : (needT ? '引动天劫 · 突破' : '运功突破')}</button>
             <button class="btn" id="p-meditate" type="button" aria-label="吐纳，凝聚少量灵气">吐纳（点击）</button>
          </div>
          <div class="hint" style="margin-top:9px" id="p-breakhint"></div>
        </div>

        <div class="card">
          <div class="card-title"><span class="ico">📊</span>道体属性</div>
          <div class="stat-row" id="p-stats"></div>
        </div>

        <div class="card">
          <div class="card-title"><span class="ico">✨</span>加成详解<span class="sub">各部分相乘</span></div>
          <div class="mult-list" id="p-mults"></div>
        </div>

        <div class="card" id="p-buffcard">
          <div class="card-title"><span class="ico">⏳</span>当前增益</div>
          <div id="p-buffs"></div>
        </div>

        <div class="card">
          <div class="card-title"><span class="ico">🧭</span>下一步
            <span class="sub"><button class="mini-btn" id="p-gotoquest" type="button" aria-label="查看道途目标">道途 ▸</button></span></div>
          <div id="p-guide" style="display:flex;flex-direction:column;gap:7px"></div>
        </div>
      `;
      CultivatePanel._statsKey = null;
      CultivatePanel._multKey = null;
      CultivatePanel._buffsKey = null;
      CultivatePanel._guideKey = null;

      box.onclick = (e) => {
        if (e.target.closest('#p-gotoquest')) { MT.show('quest'); return; }
        if (e.target.closest('#p-claimq')) {
          const r = XG.Quest.claim();
          if (r.ok) { XG.Float.show('道途奖励已领取！', 'epic'); MT.markDirty('cultivate'); MT.updateDots(); }
          return;
        }
      };

      const sph = UI.$('#hero-sphere', box);
      if (sph) sph.addEventListener('click', () => {
        const g = XG.Cult.meditate();
        XG.Float.show('+' + U.fmt(g) + ' 灵气', 'good');
        if (sph.animate) {
          sph.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 260 });
        }
      });

      const brk = UI.$('#p-break', box);
      brk.addEventListener('click', () => CultivatePanel.onBreak());

      UI.$('#p-meditate', box).addEventListener('click', () => {
        const g = XG.Cult.meditate();
        XG.Float.show('+' + U.fmt(g) + ' 灵气', 'good');
      });

      CultivatePanel.update(box);
    },

    onBreak() {
      const s = XG.State.s, C = XG.State.Calc;
      if (R.isMax(s.realm, s.layer)) return;
      const need = C.need();
      if (s.spirit < need) {
        XG.Float.show('灵气不足，尚需' + U.time(C.needSeconds()), 'bad');
        return;
      }
      if (R.needTribulation(s.realm, s.layer)) {
        XG.Modals.askTribulation();
        return;
      }
      const r = XG.Cult.tryBreak(false);
      if (r.ok) {
        const sph = document.querySelector('#hero-sphere');
        if (sph && sph.animate) sph.animate(
          [{ filter: 'brightness(1)' }, { filter: 'brightness(3)' }, { filter: 'brightness(1)' }],
          { duration: 700 });
        XG.Float.show('突破成功！', 'epic');
      } else if (r.reason === 'fail') {
        XG.Float.show('突破失败…', 'bad');
      }
      MT.markDirty('cultivate');
    },

    update(box) {
      const s = XG.State.s, C = XG.State.Calc;
      const m = UI.mods();
      const need = C.need();
      const pct = need > 0 ? U.clamp(s.spirit / need, 0, 1) : 0;
      const rate = XG.CONFIG.BASE_SPIRIT_RATE * m.spirit;
      const sec = rate > 0 ? C.remain() / rate : Infinity;
      const set = (id, v) => { const e = document.getElementById(id); if (e && e.textContent !== v) e.textContent = v; };

      set('p-realm', R.name(s.realm, s.layer));
      const fill = document.getElementById('p-fill');
      if (fill) fill.style.width = (pct * 100) + '%';
      const progress = document.getElementById('p-progress');
      if (progress) progress.setAttribute('aria-valuenow', String(Math.round(pct * 100)));
      set('p-spirit', `${U.fmt(s.spirit)} / ${U.fmt(need)}`);
      set('p-rate', `+${U.fmt(rate)}/秒`);
      set('p-eta', isFinite(sec) ? `预计 ${U.clock(sec)}` : '');

      const maxed = R.isMax(s.realm, s.layer);
      const needT = R.needTribulation(s.realm, s.layer);
      const chance = C.breakChance();
      let hint;
      if (maxed) hint = '你已登临大罗之巅，此界再无可突破之境。唯有飞升，方可另辟天地。';
      else if (needT) hint = `跨越大境界需渡天劫。<b>天劫为实战，战力不足切勿强行引动。</b>`;
      else hint = `突破成功率 <b>${U.pct(chance, 0)}</b>，失败将散失 ${Math.round((1 - XG.CONFIG.BREAK_FAIL_KEEP) * 100)}% 灵气。`;
      /* update() 每帧都会执行，所有 DOM 写入都必须幂等，
         否则即使文本相同也会重建文本节点 / innerHTML，造成每帧无谓的重排与重绘。 */
      const hintEl = document.getElementById('p-breakhint');
      if (hintEl && hintEl.__hintKey !== hint) {
        hintEl.__hintKey = hint;
        UI.setHTML(hintEl, hint);
      }

      const brk = document.getElementById('p-break');
      if (brk) {
        const brkText = maxed ? '已臻化境' : (needT ? '引动天劫 · 突破' : '运功突破');
        const wantDisabled = !!(maxed || s.spirit < need);
        if (wantDisabled !== brk.disabled) {
          brk.disabled = wantDisabled;
          brk.setAttribute('aria-disabled', wantDisabled ? 'true' : 'false');
        }
        if (brk.textContent !== brkText) brk.textContent = brkText;
      }

      const p = UI.playerStats();
      const statsHtml = [
        ['战力', U.fmt(C.power(p)), ''],
        ['攻击', U.fmt(p.atk), ''],
        ['气血', U.fmt(p.maxHp), 'jade'],
        ['防御', U.fmt(p.def), 'azure'],
        ['暴击', U.pct(p.crit, 1), ''],
        ['爆伤', U.pct(p.critDmg, 0), ''],
        ['闪避', U.pct(p.dodge, 1), 'azure'],
        ['速度', '×' + p.spd.toFixed(2), 'violet'],
        ['吸血', U.pct(p.lifesteal, 1), 'jade'],
        ['穿透', U.pct(p.pen, 1), 'violet'],
        ['灵石加成', U.mult(m.stoneGain), ''],
        ['灵草/秒', U.fmt(m.herbGain * (1 + s.realm * 0.8)), 'jade'],
      ].map(([k, v, c]) => `<div class="stat-cell"><div class="k">${k}</div><div class="v ${c}">${v}</div></div>`).join('');
      if (CultivatePanel._statsKey !== statsHtml) {
        CultivatePanel._statsKey = statsHtml;
        UI.setHTML(document.getElementById('p-stats'), statsHtml);
      }

      const bm = C.buildingMults();
      const at = C.artTotals();
      const et = C.equipTotals();
      const pt = C.petTotals();
      const bt = C.buffTotals();
      const chips = [
        ['境界 ×' + U.fmt(R.mult(s.realm)), 'gold'],
        ['洞天 ×' + U.fmt(bm.spirit), ''],
        ['心法 ×' + (1 + at.mind).toFixed(2), ''],
        ['装备 ×' + (1 + et.spirit * bm.equipPower).toFixed(2), ''],
        ['灵宠 ×' + C.petMult(pt.spirit).toFixed(2), ''],
        ['丹药 ×' + bt.spirit.toFixed(2), bt.spirit > 1 ? '' : 'dim'],
        ['仙缘 ×' + (1 + s.prestige.earned * 0.12).toFixed(2), 'gold'],
        ['道果 ×' + (1 + (s.achBonus.spirit || 0)).toFixed(2), ''],
        ['洗髓 ×' + C.permRate(s.perm.spirit, 0.05).toFixed(2), ''],
        ['九转 ×' + C.permRate(s.perm.all, 0.08).toFixed(2), ''],
      ];
      const multHtml = chips.map(([t, c]) => `<span class="mult-chip ${c}">${t}</span>`).join('');
      if (CultivatePanel._multKey !== multHtml) {
        CultivatePanel._multKey = multHtml;
        UI.setHTML(document.getElementById('p-mults'), multHtml);
      }

      const now = Date.now();
      const buffs = s.buffs.filter(b => b && Number(b.until) > now);
      const bc = document.getElementById('p-buffcard');
      if (bc) bc.style.display = buffs.length ? '' : 'none';
      const buffsKey = JSON.stringify([m.pillPower, Math.floor(now / 1000), buffs.map(b => [b.id, b.name, b.icon, b.until])]);
      const buffsHtml = buffs.map(b => {
        const left = Math.max(0, (Number(b.until) - now) / 1000);
        const name = UI.esc(b.name);
        const icon = UI.esc(b.icon);
        const def = Object.prototype.hasOwnProperty.call(XG.idx.pill, b.id) ? XG.idx.pill[b.id] : null;
        const effect = def && typeof def.effectText === 'function' ? UI.esc(def.effectText(m.pillPower)) : '';
        return `<div class="entry" style="margin-bottom:6px;padding:8px">
          <div class="entry-ico" style="width:34px;height:34px;font-size:17px" aria-hidden="true" title="${name}">${icon}</div>
          <div class="entry-body">
            <div class="entry-name">${name}</div>
            <div class="entry-desc">${effect}</div>
          </div>
          <div class="entry-act" style="color:var(--amber);font-variant-numeric:tabular-nums">${U.clock(left)}</div>
        </div>`;
      }).join('');
      if (CultivatePanel._buffsKey !== buffsKey) {
        CultivatePanel._buffsKey = buffsKey;
        UI.setHTML(document.getElementById('p-buffs'), buffsHtml);
      }

      const q = XG.Quest.current();
      let guideHtml = '';
      if (q) {
        const ready = XG.Quest.reached();
        guideHtml += `<div class="next-step ${ready ? 'ready' : ''}">
          <span class="ns-ico">${q.icon}</span>
          <span class="ns-body">
            <b>${ready ? '✦ 可领取　' : ''}${q.title}</b>
            <small>${q.desc}</small>
          </span>
          ${ready ? '<button class="btn xs primary" type="button" id="p-claimq">领取</button>' : ''}
        </div>`;
      }
      guideHtml += CultivatePanel.guide().slice(0, 3).map(g =>
        `<div class="gd-line"><span>▸</span><span>${g}</span></div>`).join('');
      if (CultivatePanel._guideKey !== guideHtml) {
        CultivatePanel._guideKey = guideHtml;
        UI.setHTML(document.getElementById('p-guide'), guideHtml);
      }
    },

    /* 仅保留最关键的几条提示，避免信息过载 */
    guide() {
      const s = XG.State.s, C = XG.State.Calc;
      const out = [];

      /* 灵气已满且可突破 */
      if (!R.isMax(s.realm, s.layer) && s.spirit >= C.need()) {
        out.push(R.needTribulation(s.realm, s.layer)
          ? '灵气已满，<b>引动天劫</b>即可破境（务必准备充分）'
          : '灵气已满，可 <b>运功突破</b>');
      }
      /* 洞天有钱可花 */
      const b = XG.BUILDINGS.find(x => XG.Economy.canUnlockBuilding(x) && s.res.stone >= C.buildCost(x));
      if (b) out.push(`洞天有可升级项：<b>${b.name}</b>`);
      /* 塔可挑战 */
      if (s.tower.floor > s.tower.best) out.push(`通天塔可挑战 <b>第 ${s.tower.floor} 层</b>`);
      /* 待孵化 */
      if (s.pets.eggs > 0) out.push(`有 <b>${s.pets.eggs}</b> 枚灵宠蛋待孵化`);
      /* 可飞升 */
      if (XG.Prestige.canAscend()) out.push('已达飞升门槛，可换取 <b>仙缘点</b> 重开仙途');
      /* 未开启自动挂机 */
      if (!s.settings.autoBreak) out.push('建议开启底栏的 <b>自动突破</b> 与 <b>自动秘境</b>，安心挂机');

      return out.length ? out : ['一切顺遂，静待时机即可'];
    },
  };

  /* ═══════════════════════════════════════
     二、洞天
     ═══════════════════════════════════════ */
  const CavePanel = {
    init() {},
    render(box) {
      const s = XG.State.s, C = XG.State.Calc;
      const list = XG.BUILDINGS;
      let html = `<div class="card">
        <div class="card-title"><span class="ico">⛰</span>洞天福地<span class="sub">灵石总产：${U.fmt(s.res.stone)}</span></div>
        <div class="hint">每一处建筑皆可增益修行。消耗灵石升级，等级越高消耗越多。</div>
      </div>`;

      for (const b of list) {
        const unlocked = XG.Economy.canUnlockBuilding(b);
        const lv = s.buildings[b.id] || 0;
        const cost = C.buildCost(b);
        const can = unlocked && s.res.stone >= cost;
        html += `<div class="entry ${unlocked ? '' : 'locked'}" data-b="${b.id}">
          <div class="entry-ico">${b.icon}</div>
          <div class="entry-body">
            <div class="entry-name">${b.name}<span class="entry-lv">Lv.${lv}</span>
              ${!unlocked ? `<span class="item-tag" style="--q:#ff9aa8">需 ${XG.REALMS[b.unlock.realm].name}${b.unlock.layer}层</span>` : ''}</div>
            <div class="entry-desc">${b.desc}</div>
            <div class="entry-effect">${lv > 0 ? b.effect(lv) : '尚未建造'}</div>
          </div>
          <div class="entry-act">
            <div class="cost ${s.res.stone >= cost ? 'full' : 'no'}">灵石 <b>${U.fmt(cost)}</b></div>
            <div class="btn-row">
              <button class="btn sm ${can ? 'primary' : ''}" data-up="${b.id}" ${can ? '' : 'disabled'}>升级</button>
              <button class="btn sm" data-up10="${b.id}" ${unlocked ? '' : 'disabled'}>×10</button>
            </div>
          </div>
        </div>`;
      }
      box.innerHTML = html;

      box.onclick = (e => {
        const up = e.target.closest('[data-up]');
        const up10 = e.target.closest('[data-up10]');
        if (up) CavePanel.doUpgrade(up.dataset.up, 1);
        else if (up10) CavePanel.doUpgrade(up10.dataset.up10, 10);
      });
    },
    doUpgrade(id, n) {
      const r = XG.Economy.upgradeBuildingMax(id, n);
      if (r.n === 0) {
        XG.Float.show('灵石不足', 'bad');
      } else {
        const b = XG.idx.building[id];
        XG.Float.show(`${b.name} → Lv.${XG.State.s.buildings[id]}`, 'good');
      }
      MT.markDirty('cave');
    },
    update() {},
  };

  /* ═══════════════════════════════════════
     三、功法
     ═══════════════════════════════════════ */
  const ArtsPanel = {
    init() {},
    render(box) {
      const s = XG.State.s, C = XG.State.Calc;
      const maxLv = C.artMaxLv();
      const owned = Object.keys(s.arts).length;

      const learnedSkills = XG.Combat.skillsUnlocked();
      const lockedSkills = XG.SKILLS.filter(sk => !XG.Combat.skillUnlocked(sk.id));

      let html = `<div class="card">
        <div class="card-title"><span class="ico">✨</span>神通
          <span class="sub">已领悟 ${learnedSkills.length} / ${XG.SKILLS.length}</span></div>
        <div class="hint">战斗中消耗「灵力」释放，威力远超普通攻击。灵宠与敌人同样会使出杀招。</div>
        <div class="skill-slots">`;
      for (let i = 0; i < 3; i++) {
        const id = s.skills[i];
        const sk = id ? XG.idx.skill[id] : null;
         html += `<button class="skill-slot ${sk ? 'on' : ''}" type="button" data-slot="${i}" aria-pressed="${sk ? 'true' : 'false'}" aria-label="配置第${i + 1}个神通位" style="--q:${sk ? U.QUALITY[sk.q].color : 'var(--line)'}">
          <span class="ss-ico">${sk ? sk.icon : '＋'}</span>
          <span class="ss-body">
            <b>${sk ? sk.name : '空置'}</b>
            <small>${sk ? `灵力 ${sk.cost} · 冷却 ${sk.cd} 回合` : '点击配置神通'}</small>
          </span>
          <em class="ss-key">${i + 1}</em>
        </button>`;
      }
      html += `</div>
        <div class="btn-row" style="margin-top:10px">
          <button class="btn sm" id="auto-skill">自动配置</button>
          <button class="btn sm" data-go="gacha">前往寻宝阁 →</button>
        </div>
      </div>`;

      if (lockedSkills.length) {
        html += `<div class="card"><div class="card-title"><span class="ico">🔒</span>待领悟神通
          <span class="sub">随境界解锁</span></div>`;
        for (const sk of lockedSkills.slice(0, 6)) {
          html += `<div class="entry locked">
            <div class="entry-ico" style="color:${U.QUALITY[sk.q].color}">${sk.icon}</div>
            <div class="entry-body">
              <div class="entry-name" style="color:var(--txt-mute)">${sk.name}
                <span class="item-tag" style="--q:#8a93a6">需 ${XG.REALMS[sk.unlock].name}境</span></div>
              <div class="entry-desc">${sk.desc}</div>
            </div>
          </div>`;
        }
        html += `</div>`;
      }

      html += `<div class="card">
        <div class="card-title"><span class="ico">🕮</span>功法录<span class="sub">已习得 ${owned} / ${XG.ARTS.length} ｜ 等级上限 ${maxLv}</span></div>
        <div class="hint">功法等级上限随境界提升而增加（藏经阁可进一步提升）。新的功法可在「寻宝阁 · 问道池」领悟。</div>
      </div>`;

      const types = ['mind', 'atk', 'body', 'agile'];
      for (const t of types) {
        const info = XG.ART_TYPE[t];
        const list = XG.ARTS.filter(a => a.type === t);
        const got = list.filter(a => s.arts[a.id]).length;
        html += `<div class="card"><div class="card-title"><span class="ico">${info.icon}</span>${info.name}
          <span class="sub">${info.tag} ｜ ${got}/${list.length}</span></div>`;
        for (const a of list) {
          const d = s.arts[a.id];
          if (!d) {
            html += `<div class="entry locked">
              <div class="entry-ico" style="color:${U.QUALITY[a.q].color}">？</div>
              <div class="entry-body">
                <div class="entry-name" style="color:var(--txt-mute)">未习得 · ${U.QUALITY[a.q].name}功法</div>
                <div class="entry-desc">需通过「悟道」领悟（品阶 ${U.QUALITY[a.q].name}）</div>
              </div>
              <div class="entry-act"><button class="btn sm" data-go="gacha">前往悟道</button></div>
            </div>`;
            continue;
          }
          const cost = C.artCost(a);
          const can = s.res.stone >= cost && d.lv < maxLv;
          html += `<div class="entry">
            <div class="entry-ico" style="color:${U.QUALITY[a.q].color}">${info.icon}</div>
            <div class="entry-body">
              <div class="entry-name"><span style="color:${U.QUALITY[a.q].color}">《${a.name}》</span>
                <span class="entry-lv">${d.lv} 重</span>
                <span class="item-tag" style="--q:${U.QUALITY[a.q].color}">${U.QUALITY[a.q].name}</span></div>
              <div class="entry-desc">${a.desc}</div>
              <div class="entry-effect">${info.tag} +${U.pct(a.eff * d.lv, 1)}　<i style="color:var(--txt-mute);font-style:normal">「${a.lore}」</i></div>
            </div>
            <div class="entry-act">
              <div class="cost ${s.res.stone >= cost ? 'full' : 'no'}">灵石 <b>${U.fmt(cost)}</b></div>
              <div class="btn-row">
                <button class="btn sm ${can ? 'primary' : ''}" data-art="${a.id}" data-n="1" ${can ? '' : 'disabled'}>修习</button>
                <button class="btn sm" data-art="${a.id}" data-n="10" ${d.lv < maxLv ? '' : 'disabled'}>×10</button>
              </div>
            </div>
          </div>`;
        }
        html += `</div>`;
      }
      box.innerHTML = html;

      box.onclick = (e => {
        const artBtn = e.target.closest('[data-art]');
        if (artBtn) { ArtsPanel.doUpgrade(artBtn.dataset.art, +artBtn.dataset.n); return; }

        const slot = e.target.closest('[data-slot]');
        if (slot) { XG.Modals.pickSkill(+slot.dataset.slot); return; }
        if (e.target.closest('#auto-skill')) {
          XG.Combat.autoSkills();
          XG.Float.show('已自动配置最强神通', 'good');
          MT.render('arts', true);
          return;
        }
        const go = e.target.closest('[data-go="gacha"]');
        if (go) { XG.GachaPanel.pool = 'art'; MT.show('gacha'); }
      });
    },
    doUpgrade(id, n) {
      const r = XG.Economy.upgradeArt(id, n);
      if (r.n > 0) XG.Float.show(`《${XG.idx.art[id].name}》→ ${XG.State.s.arts[id].lv} 重`, 'good');
      else if (r.reason === 'stone' && n === 1) XG.Float.show('灵石不足', 'bad');
      else if (r.reason === 'max') XG.Float.show('已达当前境界上限', 'bad');
      MT.markDirty('arts');
    },
    update() {},
  };

  /* ═══════════════════════════════════════
     四、丹道
     ═══════════════════════════════════════ */
  const AlchemyPanel = {
    init() {},
    render(box) {
      const s = XG.State.s, C = XG.State.Calc;
      const m = UI.mods();
      const list = XG.PILLS;
      let html = `<div class="card">
        <div class="card-title"><span class="ico">⚗</span>丹炉<span class="sub">成丹率 ${U.pct(XG.Economy.craftChance(list[0]), 0)}</span></div>
        <div class="hint">炼丹消耗灵草、灵石与材料。丹药效果受【炼丹房】等级加成（当前 ×${m.pillPower.toFixed(2)}）。</div>
        <div class="stat-row">
          <div class="stat-cell"><div class="k">灵草</div><div class="v jade">${U.fmt(s.res.herb)}</div></div>
          <div class="stat-cell"><div class="k">丹药效果</div><div class="v">×${m.pillPower.toFixed(2)}</div></div>
          <div class="stat-cell"><div class="k">成丹率加成</div><div class="v azure">+${U.pct(m.pillSuccess, 0)}</div></div>
        </div>
      </div><div class="grid g2">`;

      for (const p of list) {
        const unlocked = p.unlock <= XG.Economy.pillMaxUnlock();
        const have = s.pills[p.id] || 0;
        const can = XG.Economy.canCraft(p, 1);
        if (!unlocked) {
          html += `<div class="item-card q0" style="opacity:.5">
            <div class="item-head"><div class="item-ico">🔒</div><div class="item-name">未知丹方</div></div>
            <div class="item-desc">需境界提升后方可解锁（需 ${XG.REALMS[Math.min(12, Math.ceil((p.unlock - 1) * 1.2))].name}境 以上）</div>
          </div>`;
          continue;
        }
        html += `<div class="item-card q${p.q}">
          ${have > 0 ? `<span class="count-badge">${U.fmt(have)}</span>` : ''}
          <div class="item-head">
            <div class="item-ico">${p.icon}</div>
            <div class="item-name">${p.name}</div>
            <span class="item-tag">${U.QUALITY[p.q].name}</span>
          </div>
          <div class="item-desc">${p.desc}</div>
          <div class="item-stats"><span class="item-stat jade">${p.effectText(m.pillPower)}</span>
            <span class="item-stat gold">${p.kind === 'perm' ? '永久' : p.kind === 'instant' ? '立即' : p.dur + '秒'}</span></div>
          ${Frag.costRow(XG.Economy.pillCost(p, 1))}
          <div class="btn-row">
            <button class="btn sm ${can.ok ? 'primary' : ''}" data-craft="${p.id}" data-n="1" ${can.ok ? '' : 'disabled'}>炼制</button>
            <button class="btn sm" data-craft="${p.id}" data-n="10" ${XG.Economy.canCraft(p, 10).ok ? '' : 'disabled'}>×10</button>
            <button class="btn sm jade" data-use="${p.id}" ${have > 0 ? '' : 'disabled'}>服用</button>
          </div>
        </div>`;
      }
      html += `</div>`;

      /* 材料 */
      html += `<div class="card" style="margin-top:11px">
        <div class="card-title"><span class="ico">📦</span>灵材</div><div class="grid g4" id="matgrid">`;
      const owned = XG.MATS.filter(mm => (s.mats[mm.id] || 0) > 0);
      if (!owned.length) html += `<div class="hint">暂无材料，前往秘境探索可获得。</div>`;
      for (const mm of owned) {
        html += `<div class="item-card q${mm.q}" style="padding:9px">
          <div class="item-head"><div class="item-ico" style="width:26px;height:26px;font-size:14px">${mm.icon}</div>
          <div class="item-name" style="font-size:12px">${mm.name}</div></div>
           <div class="item-desc" style="min-height:0;font-size:var(--fs-mini)">${mm.desc}</div>
          <div class="btn-row" style="margin-top:6px">
            <span class="item-stat gold">×${U.fmt(s.mats[mm.id])}</span>
            <button class="btn xs" data-sellmat="${mm.id}">售 ${U.fmt(Math.floor(mm.value * 0.6 * m.stoneGain))}</button>
          </div>
        </div>`;
      }
      html += `</div></div>`;
      box.innerHTML = html;

      box.onclick = (e => {
        const c = e.target.closest('[data-craft]');
        if (c) { AlchemyPanel.craft(c.dataset.craft, +c.dataset.n); return; }
        const u = e.target.closest('[data-use]');
        if (u) { XG.Economy.usePill(u.dataset.use); MT.markDirty('alchemy'); return; }
        const sm = e.target.closest('[data-sellmat]');
        if (sm) { const v = XG.Economy.sellMat(sm.dataset.sellmat); if (v) XG.Float.show('+' + U.fmt(v) + ' 灵石', 'gold'); MT.markDirty('alchemy'); }
      });
    },
    craft(id, n) {
      const r = XG.Economy.craft(id, n);
      if (!r.ok) { XG.Float.show('材料不足', 'bad'); return; }
      if (r.made > 0) XG.Float.show(`炼制成功 ×${r.made}`, 'good');
      else XG.Float.show('炼制失败…', 'bad');
      MT.markDirty('alchemy');
    },
    update() {},
  };

  MT.register('cultivate', CultivatePanel);
  MT.register('cave', CavePanel);
  MT.register('arts', ArtsPanel);
  MT.register('alchemy', AlchemyPanel);

  XG.P_Cultivate = CultivatePanel;
})();

/* ═══════════════════════════════════════════════════════
   ui-test.js — 无头 DOM 冒烟测试（jsdom）
   用法：node tests/ui-test.js

   真实加载 index.html 与全部脚本，在 jsdom 中启动游戏，
   遍历每个面板、点击主要按钮，验证：
     1) 无脚本加载错误 / 运行时异常
     2) 各面板均能渲染出内容（非空白）
     3) 顶栏 / 底栏数值持续更新
     4) 核心交互（吐纳 / 突破 / 建造 / 修习 / 炼丹）可用
   ═══════════════════════════════════════════════════════ */
const path = require('path');
const fs = require('fs');
const http = require('http');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');

/* ── 测试内自建静态服务（jsdom 在 file:// 下 localStorage 不可用） ── */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
};
function startServer() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent((req.url || '/').split('?')[0]);
      if (p === '/') p = '/index.html';
      const fp = path.join(ROOT, path.normalize(p));
      fs.readFile(fp, (err, data) => {
        if (err) { res.writeHead(404); res.end('404'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' });
        res.end(data);
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}

const errors = [];
const vc = new VirtualConsole();
vc.on('error', (...a) => errors.push('[console.error] ' + a.map(String).join(' ')));
vc.on('warn', () => {});
vc.on('jsdomError', e => {
  const msg = String(e && e.message || e);
  // jsdom 未实现 Canvas 渲染与页面跳转，属预期情况，忽略
  if (/Not implemented: HTMLCanvasElement/.test(msg)) return;
  if (/Not implemented: navigation/.test(msg)) return;
  errors.push('[jsdomError] ' + msg);
});
vc.on('log', (...a) => console.log('  [page]', ...a.map(String)));

const wait = ms => new Promise(r => setTimeout(r, ms));
let uiRandomSeed = 0x6d2b79f5;
const uiRandom = () => {
  uiRandomSeed = (Math.imul(uiRandomSeed, 1664525) + 1013904223) >>> 0;
  return uiRandomSeed / 4294967296;
};

(async function main() {
  const { srv, port } = await startServer();
  const URL = `http://127.0.0.1:${port}/index.html`;
  console.log('== 载入 index.html（jsdom）==', URL);

  const dom = await JSDOM.fromURL(URL, {
    beforeParse(window) { window.Math.random = uiRandom; },
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole: vc,
  });

  const { window } = dom;
  const doc = window.document;

  // 等待所有 <script src> 加载完成
  for (let i = 0; i < 100 && !(window.XG && window.XG.Game); i++) await wait(100);
  if (!window.XG || !window.XG.Game) {
    console.error('✗ 脚本未加载完成（window.XG.Game 不存在）');
    console.error('  window.XG 存在：', !!window.XG);
    if (window.XG) console.error('  XG 已有键：', Object.keys(window.XG).join(','));
    console.error('  已捕获错误：\n    ' + errors.slice(0, 8).join('\n    '));
    const scripts = Array.from(doc.querySelectorAll('script[src]')).map(s => s.getAttribute('src'));
    console.error('  声明脚本：', scripts.join(' | '));
    process.exit(1);
  }
  const XG = window.XG;
  console.log('✓ 脚本加载完成');

  await wait(600);   // 等待 boot 与首帧渲染
  if (errors.length) {
    console.log('  ⚠ 启动阶段报错：\n    ' + errors.slice(0, 8).join('\n    '));
  }

  const fails = [];
  const ok = (c, m) => { if (!c) fails.push(m); };
  const $ = s => doc.querySelector(s);
  const textOf = s => { const e = $(s); return e ? e.textContent.trim() : ''; };
  const nonEmpty = s => { const e = $(s); return !!e && e.innerHTML.trim().length > 30; };

  /* ── 1. 首次进入的欢迎弹窗 ── */
  ok(!$('#modal-layer').classList.contains('hidden'), '新档未弹出开场引导');
  ok(!$('#modal-box').innerHTML.includes('仙途开启') === false, '开场引导内容缺失');
  // 关闭弹窗
  const okBtn = $('#modal-box #m-ok');
  if (okBtn) okBtn.click();
  await wait(120);
  ok($('#modal-layer').classList.contains('hidden'), '弹窗未能关闭');

  /* ── 2. 顶栏与底栏 ── */
  ok(textOf('#realm-name').includes('练气'), '顶栏境界显示异常：' + textOf('#realm-name'));
  ok(/\/\s*\d/.test(textOf('#cult-num')), '顶栏灵气数值显示异常：' + textOf('#cult-num'));
  ok(textOf('#cult-rate').includes('/秒'), '顶栏灵气速率显示异常');
  ok($('#bb-stats').innerHTML.includes('战力'), '底栏属性未渲染');
  ok(doc.querySelectorAll('#log-body .log-line').length >= 1, '天机录未写入开场日志');

  /* ── 2.5 天象条 / 底栏道途入口 ── */
  ok(!!$('#omen-chip') && !!$('#omen-ico'), '顶栏天象元素缺失');
  const chip = $('#quest-chip');
  ok(!!chip, '底栏道途入口缺失');
  ok(chip && !chip.classList.contains('hidden'), '道途入口未显示');
  ok(textOf('#qc-txt').length > 0, '道途入口未显示任务名');
  ok(/\d+\/\d+/.test(textOf('#qc-step')), '道途入口未显示进度，实际：' + textOf('#qc-step'));
  // 不应再有常驻浮动的引导条
  ok(!$('#quest-tracker'), '仍存在常驻浮动的引导条');
  // 触发一次天象，确认联动
  XG.Omen.roll();
  await wait(200);
  ok(!!XG.Omen.active(), '天象未能降临');
  ok($('#omen-chip').classList.contains('on'), '天象降临后顶栏未高亮');
  ok(textOf('#omen-txt').length > 0 && textOf('#omen-txt') !== '天象未起', '天象名称未显示');

  /* ── 3. 遍历所有面板 ── */
  const panels = ['cultivate', 'quest', 'cave', 'arts', 'alchemy', 'forge', 'gacha', 'pets', 'bag', 'explore', 'tower', 'achievement', 'ascend'];
  for (const p of panels) {
    const btn = doc.querySelector(`#sidebar .nav-item[data-panel="${p}"]`);
    ok(!!btn, `导航按钮缺失：${p}`);
    if (!btn) continue;
    btn.click();
    await wait(90);
    const page = doc.querySelector('#page-' + p);
    ok(page && page.classList.contains('active'), `面板未激活：${p}`);
    ok(nonEmpty('#page-' + p), `面板渲染为空：${p}`);
    ok(XG.MT.current === p, `MT.current 未切换：${p}`);
  }

  /* ── 4. 核心交互 ── */
  XG.MT.show('cultivate');
  await wait(120);

  // 吐纳
  const spirit0 = XG.State.s.spirit;
  const med = doc.querySelector('#p-meditate');
  ok(!!med, '吐纳按钮缺失');
  if (med) { med.click(); med.click(); }
  await wait(80);
  ok(XG.State.s.spirit > spirit0, '吐纳未增加灵气');

  // 直接灌满灵气并突破（突破有失败概率，故重试数次）
  const layer0 = XG.State.s.layer, realm0 = XG.State.s.realm;
  let brk = null, brkDisabled = null;
  for (let i = 0; i < 12; i++) {
    const st = XG.State.s;
    if (st.layer !== layer0 || st.realm !== realm0) break;
    st.spirit = XG.State.Calc.need();
    XG.MT.markDirty('cultivate'); XG.MT.refresh();
    await wait(50);
    brk = doc.querySelector('#p-break');
    if (i === 0 && brk) brkDisabled = brk.disabled;
    if (brk && !brk.disabled) brk.click();
    await wait(80);
  }
  ok(!!brk, '突破按钮缺失');
  ok(brkDisabled === false, '灵气满时突破按钮仍被禁用');
  ok(XG.State.s.layer !== layer0 || XG.State.s.realm !== realm0, '突破未生效（连续 12 次均失败）');

  // 建造（给足灵石）
  XG.State.s.res.stone = 1e9;
  XG.MT.show('cave'); await wait(120);
  const upBtn = doc.querySelector('[data-up="b_array"]');
  ok(!!upBtn, '洞天升级按钮缺失');
  const lv0 = XG.State.s.buildings.b_array;
  if (upBtn) upBtn.click();
  await wait(120);
  ok(XG.State.s.buildings.b_array > lv0, '洞天升级未生效');

  // 炼丹（灌满材料）
  XG.State.s.res.herb = 1e6; XG.State.s.res.stone = 1e9;
  XG.MT.show('alchemy'); await wait(150);
  const craftBtn = doc.querySelector('[data-craft="p_juqi"][data-n="10"]');
  ok(!!craftBtn, '炼丹按钮缺失');
  const herb0 = XG.State.s.res.herb;
  const made0 = XG.State.s.stats.pillsMade;
  if (craftBtn) craftBtn.click();
  await wait(150);
  ok(XG.State.s.res.herb < herb0, '炼丹未消耗材料');
  ok(XG.State.s.stats.pillsMade > made0, '炼制 10 次仍无一成功');

  // 服用丹药
  XG.State.s.pills.p_juqi = (XG.State.s.pills.p_juqi || 0) + 3;
  XG.MT.markDirty('alchemy'); XG.MT.refresh(); await wait(120);
  const useBtn = doc.querySelector('[data-use="p_juqi"]');
  if (useBtn && !useBtn.disabled) {
    XG.State.s.spirit = 0;
    useBtn.click();
    await wait(120);
    ok(XG.State.s.spirit > 0, '服用聚气丹未获得灵气');
  }

  // 秘境探索
  XG.MT.show('explore'); await wait(150);
  const toggleBtn = doc.querySelector('#ex-toggle');
  ok(!!toggleBtn, '秘境开关缺失');
  if (toggleBtn) toggleBtn.click();
  ok(XG.State.s.explore.running === true, '秘境未能开始探索');
  const zoneCards = doc.querySelectorAll('#zonegrid .zone-card');
  ok(zoneCards.length > 20, '秘境区域列表数量异常：' + zoneCards.length);
  if (zoneCards.length) zoneCards[0].click();
  await wait(80);
  ok(XG.State.s.explore.zone === 0, '切换秘境失败');

  // 直接驱动探索结算（有小概率触发妖王实战，故循环若干次）
  const settled0 = XG.State.s.explore.wins + XG.State.s.explore.losses;
  for (let i = 0; i < 10; i++) {
    XG.State.s.explore.progress = XG.CONFIG.EXPLORE_STEP;
    XG.Combat.tickExplore(0.01);
    await wait(20);
    if (XG.State.s.explore.wins + XG.State.s.explore.losses > settled0) break;
  }
   ok(XG.State.s.explore.wins + XG.State.s.explore.losses > settled0 || !!XG.Combat.active || !!XG.Combat.last,
     '秘境结算未发生');

   XG.Combat.setExploring(false);
   if (XG.Combat.active) { XG.Combat.active.e.hp = 0; XG.Combat.endBattle(); }
   if (XG.Combat.last) XG.Combat.closeResult();
   const oldResultDelay = XG.CONFIG.AUTO_RESULT_DELAY;
   XG.CONFIG.AUTO_RESULT_DELAY = 999;
   XG.State.s.tower.best = 0; XG.State.s.tower.floor = 1;
  const okStart = XG.Combat.challengeTower(1);
  ok(okStart === true, '通天塔挑战未能开始');
  await wait(100);
  ok(!!XG.Combat.active, '战斗状态未建立');
  const overlay = $('#battle-overlay');
  ok(overlay && !overlay.classList.contains('hidden'), '战斗浮层未显示');
  ok((overlay ? overlay.querySelector('#bo-en').textContent : '').length > 1, '战斗浮层未显示敌方名称');
   XG.CombatSpeed = 999; XG.Combat.active.speed = 999;
   for (let i = 0; i < 60 && XG.Combat.active; i++) { XG.Combat.tickBattle(1); await wait(5); }
   ok(XG.Combat.active === null && !!XG.Combat.last && XG.Combat.last.over, '战斗未能结束');
   ok(!!XG.Combat.last && typeof XG.Combat.last.result.win === 'boolean', '战斗结果缺失');
   const contBtn = $('#bo-continue');
   ok(!!contBtn, '战斗结算按钮缺失');
   if (contBtn) contBtn.click();
   await wait(120);
   ok(XG.Combat.active === null && XG.Combat.last === null, '战斗未关闭');
   ok(overlay && overlay.classList.contains('hidden'), '战斗浮层未隐藏');

  // 道果面板
  XG.MT.show('achievement'); await wait(120);
  ok(doc.querySelectorAll('#page-achievement .item-card').length > 20, '道果列表渲染不完整');

  /* ── 新系统 ── */
  // 道途
  XG.MT.show('quest'); await wait(150);
  ok(doc.querySelectorAll('#page-quest .ch-item').length === 6, '道途章节列表不完整');
  ok(!!doc.querySelector('#page-quest .quest-big'), '道途未显示当前目标');
  const curQ = XG.Quest.current();
  ok(!!curQ, '道途无当前任务');
  // 强制达成第一个任务并领取
  XG.State.s.stats.meditates = 99;
  XG.State.s.quest.idx = 0;
  XG.MT.render('quest', true); await wait(80);
  const claimBtn = doc.querySelector('#q-claim');
  ok(claimBtn && !claimBtn.disabled, '道途目标达成后领取按钮仍禁用');
  const jadeBefore = XG.State.s.res.jade;
  if (claimBtn) claimBtn.click();
  await wait(150);
  ok(XG.State.s.quest.idx > 0 || XG.State.s.stats.questsDone > 0, '道途领取未推进');

  // 寻宝阁
  XG.State.s.res.jade = 5000;
  XG.MT.show('gacha'); await wait(150);
  ok(doc.querySelectorAll('#pool-grid .pool-card').length === 4, '寻宝藏宝池数量异常');
  const g1 = doc.querySelector('#g1');
  ok(!!g1, '寻宝按钮缺失');
  const pullsBefore = XG.State.s.stats.gachaPulls;
  if (g1) g1.click();
  await wait(200);
  ok(XG.State.s.stats.gachaPulls > pullsBefore, '寻宝未生效');
  ok(doc.querySelectorAll('#pull-grid .pull-card').length > 0, '寻宝结果未渲染');
  const g10 = doc.querySelector('#g10');
  if (g10) g10.click();
  await wait(250);
  ok(!!doc.querySelector('.pull-veil'), '十连结果未弹出全屏展示');
  const veilClose = doc.querySelector('#pv-close');
  if (veilClose) veilClose.click();
  await wait(100);
  ok(!doc.querySelector('.pull-veil'), '十连结果弹层未关闭');

  // 锻炉
  XG.State.s.res.stone = 1e12;
  XG.MT.show('forge'); await wait(200);
  ok(doc.querySelectorAll('.tabbar .tab').length === 5, '锻炉页签数量异常');
  // 造几件同部位同品装备用于合成
  for (let i = 0; i < 3; i++) {
    const e = XG.Combat.genEquip(0, '测试', { slot: 'weapon', q: 1 });
    XG.State.s.equipBag.push(e);
  }
  XG.ForgePanel.tab = 'merge';
  XG.MT.render('forge', true); await wait(150);
  const mergeBtn = doc.querySelector('[data-merge]');
  ok(!!mergeBtn, '锻炉合成项未出现');
  if (mergeBtn) mergeBtn.click();
  await wait(200);
  ok(XG.State.s.stats.forges > 0, '合成未生效');
  // 强化
  const eq0 = XG.State.s.equip.weapon;
  if (eq0) {
    XG.ForgePanel.tab = 'enhance';
    XG.MT.render('forge', true); await wait(150);
    const enhBtn = doc.querySelector('[data-enh]');
    ok(!!enhBtn, '强化按钮缺失');
    if (enhBtn) enhBtn.click();
    await wait(200);
    ok(XG.State.s.stats.enhances > 0, '强化未生效');
  }
  // 宝石页签
  XG.State.s.gems = { g_atk_1: 5, g_crit_2: 3 };
  XG.ForgePanel.tab = 'gem';
  XG.MT.render('forge', true); await wait(150);
  ok(doc.querySelectorAll('.gem-row').length >= 2, '宝石列表渲染不完整');
  const gemUp = doc.querySelector('[data-gemup]');
  ok(!!gemUp, '宝石合成按钮缺失');
  if (gemUp) gemUp.click();
  await wait(150);
  ok(XG.State.s.stats.gemForges > 0, '宝石合成未生效');
  // 材料页签 + 合炼
  XG.State.s.mats = { m_core: 9 };
  XG.ForgePanel.tab = 'mat';
  XG.MT.render('forge', true); await wait(150);
  const matUp = doc.querySelector('[data-matup]');
  ok(!!matUp, '灵材合炼按钮缺失');
  if (matUp) matUp.click();
  await wait(150);

  // 神通配置
  XG.State.s.realm = Math.max(XG.State.s.realm, 3);
  XG.MT.show('arts'); await wait(200);
  ok(doc.querySelectorAll('.skill-slot').length === 3, '神通位渲染异常');
  const autoSk = doc.querySelector('#auto-skill');
  ok(!!autoSk, '自动配置神通按钮缺失');
  if (autoSk) autoSk.click();
  await wait(150);
  ok(XG.State.s.skills.filter(Boolean).length > 0, '自动配置神通未生效');

  // 战斗中的神通 / 姿态 / 手动应战
  // 用一个皮糙肉厚的傀儡，并切到手动模式，避免战斗瞬间结束
  const foe = XG.Combat.makeEnemy(12, 40000, { boss: true, name: '试炼傀儡' });
  foe.hp = foe.maxHp = 1e30;   // 打不死
  foe.atk = Math.max(1, XG.State.Calc.playerStats().maxHp * 0.01);  // 也打不死玩家
  foe.skillPool = null;
  XG.Combat.startBattle(XG.State.Calc.playerStats(), {
    kind: 'test', enemy: foe, title: '测试战斗', auto: false,
  });
  await wait(200);
  ok(!!XG.Combat.active, '测试战斗未能开始');
  for (let i = 0; i < 10 && XG.Combat.active && !XG.Combat.active.waiting; i++) {
    XG.Combat.tickBattle(1); await wait(10);
  }
  ok(XG.Combat.active && XG.Combat.active.waiting, '手动模式未进入等待指令状态');

  ok(doc.querySelectorAll('#bo-stance .stance-btn').length === 3, '战斗姿态按钮缺失');
  const stBtn = doc.querySelector('[data-stance="attack"]');
  if (stBtn) stBtn.click();
  await wait(100);
  ok(XG.State.s.battle.stance === 'attack', '切换姿态未生效');
  ok(!!XG.Combat.active && XG.Combat.active.p.stance === 'attack', '战斗姿态未同步');

  const skBtn = doc.querySelector('#bo-skills [data-skill]');
  ok(!!skBtn, '战斗神通按钮缺失');
  if (skBtn && !skBtn.disabled) {
    const used0 = XG.State.s.stats.skillsUsed;
    skBtn.click();
    await wait(150);
    ok(XG.State.s.stats.skillsUsed > used0, '战斗释放神通未生效');
  }
  // 服丹按钮
  XG.State.s.pills.p_juqi = 3;
  const pillBtn = doc.querySelector('#bo-pill');
  ok(!!pillBtn, '战斗服丹按钮缺失');
  if (pillBtn) { pillBtn.click(); await wait(120); }
  ok(!doc.getElementById('modal-layer').classList.contains('hidden'), '战斗服丹弹窗未打开');
  const bpItem = doc.querySelector('[data-bp]');
  if (bpItem) {
    const hp0 = XG.Combat.active ? XG.Combat.active.p.hp : 0;
    bpItem.click();
    await wait(150);
    ok(!XG.Combat.active || XG.Combat.active.p.hp >= hp0, '战斗服丹未生效');
  } else {
    XG.Modals.close();
  }
  // 收尾
   if (XG.Combat.active) { XG.Combat.active.p.hp = 0; XG.Combat.endBattle(); }
   await wait(120);
   ok(XG.Combat.active === null && !!XG.Combat.last && typeof XG.Combat.last.result.win === 'boolean', '测试战斗结果未释放到 last');
   const cbtn = doc.querySelector('#bo-continue');
   if (cbtn) cbtn.click();
   await wait(150);
   ok(XG.Combat.active === null && XG.Combat.last === null, '测试战斗未关闭');
   XG.CONFIG.AUTO_RESULT_DELAY = oldResultDelay;

  // 飞升面板
  XG.MT.show('ascend'); await wait(120);
  ok(nonEmpty('#page-ascend'), '飞升面板为空');
  ok(textOf('#page-ascend').includes('仙缘'), '飞升面板缺少仙缘信息');

  // 灵宠
  XG.State.s.pets.eggs = 5;
  XG.MT.show('pets'); await wait(150);
  const hatchBtn = doc.querySelector('#hatch');
  ok(!!hatchBtn, '孵化按钮缺失');
  if (hatchBtn) hatchBtn.click();
  await wait(150);
  ok(XG.State.s.pets.owned.length > 0, '孵化灵宠未生效');

  // 储物
  XG.MT.show('bag'); await wait(150);
  ok(doc.querySelectorAll('#page-bag .item-card').length >= 4, '装备栏渲染不完整');

  /* ── 5. 长跑：模拟 3 分钟游戏时间，验证数值更新 ── */
   XG.State.s.settings.autoBreak = true;
   XG.Combat.setExploring(true);
   let ticks = 0;
   for (; ticks < 120; ticks++) {
     XG.Cult.tick(0.1);
     XG.Combat.tickExplore(0.1);
     XG.Combat.tickBattle(0.1);
     XG.MT.refresh();
   }
   ok(ticks === 120, '主循环未持续运行');
  ok(/\d/.test(textOf('#cult-rate')), '顶栏速率未更新');
  ok(textOf('#bb-stats').length > 10, '底栏未更新');

  /* ── 6. 存档 ── */
  ok(XG.State.Save.save(true), '存档写入失败');
  ok(XG.State.Save.exists(), '存档未落盘');
  ok(!!window.localStorage.getItem(XG.State.SAVE_KEY), 'localStorage 中无存档');

  /* ── 7. 弹窗系统 ── */
  XG.Modals.settings();
  await wait(80);
  ok(!$('#modal-layer').classList.contains('hidden'), '设置弹窗未打开');
  const closeBtn = $('#modal-box #m-ok');
  if (closeBtn) closeBtn.click();
  await wait(80);
  ok($('#modal-layer').classList.contains('hidden'), '设置弹窗未关闭');

  {
    const settingsTrigger = $('#btn-settings');
    if (settingsTrigger) settingsTrigger.focus();
    XG.Modals.settings();
    await wait(40);
    const dialog = $('#modal-box');
    const title = dialog && dialog.querySelector('.modal-title');
    ok(dialog && dialog.getAttribute('role') === 'dialog', '弹窗缺少 dialog 语义');
    ok(dialog && dialog.getAttribute('aria-modal') === 'true', '弹窗缺少 aria-modal');
    ok(title && dialog.getAttribute('aria-labelledby') === title.id, '弹窗标题未关联 aria-labelledby');
    ok(dialog && dialog.contains(doc.activeElement), '弹窗打开后焦点未进入弹窗');
    const isolated = Array.from(doc.querySelectorAll('body > :not(#modal-layer)')).every(el => el.getAttribute('aria-hidden') === 'true');
    ok(isolated, '弹窗打开时背景未隔离');
    doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await wait(40);
    ok($('#modal-layer').classList.contains('hidden'), 'Escape 未关闭弹窗');
    ok(doc.activeElement === settingsTrigger, '弹窗关闭后焦点未恢复');
  }

  {
    const progress = $('#cult-progress');
    ok(!!progress && progress.getAttribute('role') === 'progressbar', '灵气进度缺少 progressbar 语义');
    ok(progress && progress.hasAttribute('aria-valuemin') && progress.hasAttribute('aria-valuemax') && progress.hasAttribute('aria-valuenow'), '进度条缺少 aria 数值');
    ok(!!doc.querySelector('nav#sidebar') && !!doc.querySelector('main#layout'), '页面缺少主要地标');
    const exploreToggle = $('#toggle-explore');
    ok(!!exploreToggle && exploreToggle.hasAttribute('aria-pressed'), '探索开关缺少 aria-pressed');
  }

  {
    XG.MT.show('cave');
    await wait(30);
    const st = XG.State.s;
    const building = XG.idx.building.b_array;
    st.res.stone = 0;
    XG.MT.markDirty('cave');
    XG.MT.render('cave', true);
    let upgrade = doc.querySelector('[data-up="b_array"]');
    ok(!!upgrade && upgrade.disabled, '资源不足时建筑按钮错误可用');
    XG.State.Res.gainStone(XG.State.Calc.buildCost(building) + 1);
    XG.MT.markDirty('cave');
    XG.MT.render('cave', true);
    upgrade = doc.querySelector('[data-up="b_array"]');
    ok(!!upgrade && !upgrade.disabled, '资源增长后建筑按钮仍不可用');
  }

  {
    XG.GachaPanel.pool = 'art';
    XG.State.s.res.jade = 0;
    XG.MT.show('gacha');
    await wait(30);
    XG.MT.render('gacha', true);
    let ten = $('#g10');
    ok(!!ten && ten.disabled, '资源不足时十连按钮错误可用');
    const info = XG.Gacha.info('art');
    XG.State.Res.gainJade(info.ten + 1);
    XG.MT.markDirty('gacha');
    XG.MT.render('gacha', true);
    ten = $('#g10');
    ok(!!ten && !ten.disabled, '资源增长后十连按钮仍不可用');
  }

  XG.Events.triggerRandom(true);
  await wait(120);
  const hasEventModal = !$('#modal-layer').classList.contains('hidden');
  ok(hasEventModal || XG.State.s.stats.events > 0, '奇遇事件未触发');
  if (hasEventModal) XG.Modals.close();

  /* ── 7.4 系统性不变量：核心数值必须全部有限 ──
     乘区里任何一项变成 NaN 都会顺着乘法扩散，把整局游戏拖死
     （灵气不涨、按钮状态错乱）。这里做一次全局体检。 */
  XG.MT.refresh();
  await wait(80);
  {
    const bad = [];
    const dump = (label, obj) => {
      for (const k in obj) {
        const v = obj[k];
        if (typeof v === 'number' && !Number.isFinite(v)) bad.push(`${label}.${k}=${v}`);
      }
    };
    dump('mods', XG.State.Calc.mods());
    dump('playerStats', XG.State.Calc.playerStats());
    dump('talentTotals', XG.State.Calc.talentTotals());
    dump('buildingMults', XG.State.Calc.buildingMults());
    dump('permTotals', XG.State.Calc.permTotals());
    const s0 = XG.State.s;
    dump('state', { spirit: s0.spirit, realm: s0.realm, layer: s0.layer, stone: s0.res.stone, herb: s0.res.herb, jade: s0.res.jade });
    if (!Number.isFinite(XG.State.Calc.spiritRate())) bad.push('spiritRate=NaN');
    if (!Number.isFinite(XG.State.Calc.need())) bad.push('need=NaN');
    ok(bad.length === 0, '存在非有限数值（NaN/Infinity）：' + bad.slice(0, 8).join(', '));
  }

  /* ── 7.5 回归：曾导致「突破按钮一直闪」与「灵气变 NaN」的两个缺陷 ── */

  // (a) 面板脏标记必须能被清除。
  //     历史缺陷：MT.render 只归一化了左侧（renderVersion = renderVersions[name] || 0），
  //     右侧却用原始值，于是首次渲染前 renderVersions[name] === undefined 时
  //     `undefined !== 0` 恒为 true —— 面板被永久标记为脏，此后每个 UI 帧（8Hz）
  //     都整页重建一次，按钮等元素被反复销毁重建，肉眼看到的就是「一直闪」。
  XG.MT.show('cultivate');
  delete XG.MT.renderVersions.cultivate;
  XG.MT.dirty.cultivate = true;
  XG.MT.refresh();
  ok(XG.MT.dirty.cultivate === false,
    '修炼面板脏标记无法清除 —— 会导致面板每帧整页重建（表现为按钮不停闪烁）');
  XG.MT.refresh();
  await wait(60);
  ok(XG.MT.dirty.cultivate !== true, '面板脏标记在静置状态下再次卡住');

  // (b) 天赋数据缺失不得污染乘区。
  //     历史缺陷：存档迁移只在 lv > 0 时写入天赋键，全员 0 级会得到 {}；
  //     而 talentTotals() 直接做 `tl.wuxing * 0.10` → undefined * 0.1 = NaN，
  //     顺着乘法污染 mods() 整条乘区，灵气/攻击/气血全变 NaN，游戏再也无法推进。
  const talentsBackup = JSON.parse(JSON.stringify(XG.State.s.prestige.talents || {}));
  XG.State.s.prestige.talents = {};
  const tt = XG.State.Calc.talentTotals();
  ok(Number.isFinite(tt.spirit) && Number.isFinite(tt.atk) && Number.isFinite(tt.hp)
    && Number.isFinite(tt.stoneGain) && Number.isFinite(tt.breakBonus),
    '天赋为空对象时 talentTotals() 产生 NaN');
  ok(Number.isFinite(XG.State.Calc.mods().spirit),
    '天赋键缺失污染了 mods().spirit —— 灵气将永远无法增长');
  ok(Number.isFinite(XG.State.Calc.spiritRate()),
    '天赋键缺失导致 spiritRate() 变成 NaN');
  XG.State.s.prestige.talents = talentsBackup;
  XG.State.Calc.invalidate && XG.State.Calc.invalidate();

  // (c) 迁移后的存档必须带齐全部天赋键（哪怕是 0）
  const migrated = XG.State.Save.migrate({ version: 1, prestige: { talents: {} } });
  const mkeys = Object.keys((migrated && migrated.prestige && migrated.prestige.talents) || {});
  ok(mkeys.length >= (XG.TALENTS || []).length,
    `存档迁移后天赋键只有 ${mkeys.length} 个（应为 ${(XG.TALENTS || []).length} 个）—— 0 级存档会退化成 {} 并污染乘区`);

  /* ── 8. 重置存档（回归：beforeunload 不得把进度写回） ── */
  XG.MT.show('cultivate');
  // 重置会把状态下零，故在此先把本局战果留存下来供最终断言使用
  const breakthroughsTotal = XG.State.s.stats.breakthroughs;
  const killsTotal = XG.State.s.stats.kills;
  ok(XG.State.Save.save(true), '重置前存档写入失败');
  ok(XG.State.Save.exists(), '重置前存档不存在');

  XG.Modals.settings();
  await wait(120);
  const wipeBtn = doc.querySelector('#m-wipe');
  ok(!!wipeBtn, '「重置存档」按钮缺失');
  if (wipeBtn) {
    wipeBtn.click();
    await wait(140);
    const confirmBtn = doc.querySelector('#m-ok');
    ok(!!confirmBtn, '重置确认按钮缺失');
    if (confirmBtn) confirmBtn.click();
    await wait(200);

    // 关键回归点：模拟页面刷新前浏览器触发的 beforeunload 存档
    XG.State.Save.save(true);
    XG.State.Save.save(true);
    ok(!XG.State.Save.exists(), '重置后存档依然存在 —— beforeunload 把旧进度写回来了');
    ok(!window.localStorage.getItem(XG.State.SAVE_KEY), 'localStorage 中仍残留存档');
    ok(XG.State.s.realm === 0 && XG.State.s.layer === 1, '重置后内存状态未归零');
    ok(XG.State.s.res.stone === 0, '重置后资源未归零');
    ok(XG.State.Save.isLocked(), '重置后存档锁未生效');
    // 兜底解锁后应能正常写入新档
    XG.State.Save.unlock();
    ok(XG.State.Save.save(true), '解锁后无法写入新档');
     const reloadResult = XG.State.Save.load();
     ok(reloadResult && reloadResult.status === 'ok' && reloadResult.state && reloadResult.state.realm === 0, '新档读回后不是全新状态');
  }

  /* ── 结果 ── */
  ok(errors.length === 0, `页面报错 ${errors.length} 条：\n    ` + errors.slice(0, 6).join('\n    '));
  ok(breakthroughsTotal > 0, '全程未发生突破');
  ok(killsTotal > 0, '全程未发生战斗结算');

  console.log('\n== 状态（重置后）==');
  console.log('  本局突破 :', breakthroughsTotal, '｜击杀', killsTotal);
  console.log('  当前境界 :', XG.R.name(XG.State.s.realm, XG.State.s.layer));
  console.log('  存档残留 :', XG.State.Save.exists() ? '有' : '无（重置成功）');

  console.log('\n== 断言结果 ==');
  if (fails.length) {
    for (const f of fails) console.log('  ✗ ' + f);
    dom.window.close(); srv.close();
    process.exit(1);
  }
  console.log('  ✓ 全部通过');
  dom.window.close(); srv.close();
  process.exit(0);
})().catch(e => {
  console.error('测试异常：', e && (e.stack || e.message || e));
  process.exit(1);
});

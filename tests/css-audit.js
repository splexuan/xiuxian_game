/* ═══════════════════════════════════════════════════════
   css-audit.js — 样式可读性审计
   用法：node tests/css-audit.js

   静态解析 main.css，客观校验两件事：
     1) 文本色与背景的 WCAG 对比度是否达到 AA（4.5:1）
     2) 是否存在过小的字号（内容文字不得低于 12px）

   之所以用脚本而不是靠肉眼：对比度和字号都能精确计算，
   写成断言后每次改样式都能自动回归。
   ═══════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');

const CSS_PATH = path.resolve(__dirname, '../src/css/main.css');
const INDEX_PATH = path.resolve(__dirname, '../index.html');
const css = fs.readFileSync(CSS_PATH, 'utf8');
const html = fs.readFileSync(INDEX_PATH, 'utf8');

const fails = [];
const warns = [];
const ok = (c, m) => { if (!c) fails.push(m); };

/* ── 颜色工具 ── */
function hex2rgb(h) {
  h = h.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function parseColor(v) {
  v = v.trim();
  let m = v.match(/^#([0-9a-f]{3,8})$/i);
  if (m) return { rgb: hex2rgb(m[1]), a: 1 };
  m = v.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)$/i);
  if (m) return { rgb: [+m[1], +m[2], +m[3]], a: m[4] === undefined ? 1 : +m[4] };
  return null;
}
/* 把半透明色叠在不透明底色上 */
function over(fg, bg) {
  const a = fg.a;
  return [0, 1, 2].map(i => Math.round(fg.rgb[i] * a + bg[i] * (1 - a)));
}
function relLum(rgb) {
  const [r, g, b] = rgb.map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const l1 = relLum(a), l2 = relLum(b);
  const hi = Math.max(l1, l2), lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

/* ── 读取 CSS 变量 ── */
function cssVar(name) {
  const re = new RegExp('--' + name + '\\s*:\\s*([^;]+);');
  const m = css.match(re);
  return m ? m[1].trim() : null;
}
function resolve(v, depth) {
  depth = depth || 0;
  if (!v || depth > 6) return v;
  const m = v.match(/^var\(\s*--([\w-]+)\s*\)$/);
  if (m) return resolve(cssVar(m[1]), depth + 1);
  return v;
}

console.log('== 样式可读性审计 ==\n');

/* ═════════════════════════════════════════
   1. 对比度
   ═════════════════════════════════════════ */
const baseRaw = parseColor(resolve(cssVar('bg-0')));
const base = baseRaw.rgb;

/* 卡片/面板的实际底色 = 半透明层叠在最底层背景上 */
const surfaces = [
  { name: '面板底色  ', raw: resolve(cssVar('glass')) },
  { name: '卡片底色  ', raw: resolve(cssVar('surface')) },
  { name: '卡片亮面  ', raw: resolve(cssVar('surface-2')) },
  { name: '区块亮面  ', raw: resolve(cssVar('surface-3')) },
];

const texts = ['txt', 'txt-2', 'txt-dim', 'txt-mute'];

console.log('── 文本对比度（WCAG AA 正文需 ≥ 4.5:1，大字需 ≥ 3:1）──');
console.log('  文本令牌      ' + surfaces.map(s => s.name).join('  '));
const contrastTable = {};
for (const t of texts) {
  const c = parseColor(resolve(cssVar(t)));
  if (!c) continue;
  const ratios = surfaces.map(s => {
    const sp = parseColor(s.raw);
    const bg = over(sp, base);
    const fg = over(c, bg);
    return contrast(fg, bg);
  });
  contrastTable[t] = ratios;
  console.log(
    '  --' + t.padEnd(10) + ratios.map(r => (r.toFixed(2) + ':1').padEnd(11)).join('  ') +
    (ratios.every(r => r >= 4.5) ? '  ✓' : '  ✗')
  );
}

for (const t of ['txt', 'txt-2', 'txt-dim', 'txt-mute']) {
  const rs = contrastTable[t];
  if (!rs) continue;
  const worst = Math.min(...rs);
  ok(worst >= 4.5,
    `--${t} 最差对比度仅 ${worst.toFixed(2)}:1（需 ≥4.5:1）—— 文字会看不清`);
}

/* 强调色用于正文时也应达标 */
console.log('\n── 强调色对比度（用于按钮文字 / 数值）──');
const accents = ['gold', 'gold-2', 'jade-2', 'azure', 'violet', 'crimson', 'amber'];
for (const a of accents) {
  const c = parseColor(resolve(cssVar(a)));
  if (!c) continue;
  const bg = over(parseColor(resolve(cssVar('surface'))), base);
  const r = contrast(over(c, bg), bg);
  console.log('  --' + a.padEnd(10) + r.toFixed(2) + ':1' + (r >= 4.5 ? '  ✓' : (r >= 3 ? '  ~ 仅可用于大字/图形' : '  ✗ 偏低')));
  if (r < 3) warns.push(`--${a} 对比度 ${r.toFixed(2)}:1 偏低，避免用于小字正文`);
}

/* ═════════════════════════════════════════
   2. 字号
   ═════════════════════════════════════════ */
console.log('\n── 字号检查（内容文字最低 12px）──');
const FS = {};
for (const k of ['mini', 'sm', 'base', 'md', 'lg', 'xl', '2xl']) {
  const v = resolve(cssVar('fs-' + k));
  FS[k] = v ? parseFloat(v) : null;
}
console.log('  字号阶梯：' + Object.entries(FS).map(([k, v]) => `${k}=${v}px`).join('  '));
ok(FS['mini'] !== null, '未找到字号令牌 --fs-mini');
ok(FS['mini'] >= 12, `字号阶梯最小值 --fs-mini = ${FS['mini']}px，低于 12px`);
ok(FS['base'] >= 13, `正文字号 --fs-base = ${FS['base']}px，偏小`);

/* 扫描所有字面量 px 字号 */
const smallHits = [];
const lines = css.split('\n');
lines.forEach((line, i) => {
  if (/^\s*\/\*/.test(line)) return;
  const re = /font-size\s*:\s*([\d.]+)px/g;
  let m;
  while ((m = re.exec(line))) {
    const v = parseFloat(m[1]);
    if (v < 12) smallHits.push({ line: i + 1, v, txt: line.trim() });
  }
});
if (smallHits.length) {
  console.log(`  发现 ${smallHits.length} 处小于 12px 的字号：`);
  for (const h of smallHits.slice(0, 12)) console.log(`    L${h.line}  ${h.v}px  ${h.txt.slice(0, 90)}`);
} else {
  console.log('  未发现小于 12px 的字面量字号  ✓');
}
ok(smallHits.length === 0, `仍有 ${smallHits.length} 处字号小于 12px`);

/* 统计未使用字号令牌的字面量（仅提示，不阻断） */
const literalSizes = (css.match(/font-size\s*:\s*[\d.]+px/g) || []).length;
const tokenSizes = (css.match(/font-size\s*:\s*var\(--fs-/g) || []).length;
console.log(`  字号写法：令牌 ${tokenSizes} 处 / 字面量 ${literalSizes} 处`);

/* ═════════════════════════════════════════
   3. 触控目标
   ═════════════════════════════════════════ */
console.log('\n── 交互元素最小高度（建议 ≥32px）──');
const tinyBtn = [];
lines.forEach((line, i) => {
  const m = line.match(/min-height\s*:\s*(\d+)px/);
  if (m && +m[1] < 32) tinyBtn.push({ line: i + 1, v: m[1], txt: line.trim() });
});
console.log(tinyBtn.length
  ? '  偏小的 min-height：' + tinyBtn.map(t => `L${t.line}(${t.v}px)`).join(' ')
  : '  未发现低于 32px 的 min-height  ✓');

/* ═════════════════════════════════════════
   4. 布局健壮性 & 移动端适配
   ═════════════════════════════════════════ */
console.log('\n── 布局健壮性 ──');

/* 顶层必须是 flex 纵向布局，避免硬编码高度在顶栏换行时错位 */
const bodyRule = (css.match(/\nbody\{([\s\S]*?)\}/) || [])[1] || '';
ok(/display\s*:\s*flex/.test(bodyRule), 'body 未使用 flex 布局');
ok(/flex-direction\s*:\s*column/.test(bodyRule), 'body 未使用纵向 flex 布局');

const layoutRule = (css.match(/\n#layout\{([\s\S]*?)\}/) || [])[1] || '';
ok(!/height\s*:\s*calc\(/.test(layoutRule),
  '#layout 仍依赖 calc() 硬算高度——顶栏换行或底栏加高时会错位，应改用 flex:1');
ok(/flex\s*:\s*1/.test(layoutRule) || /min-height\s*:\s*0/.test(layoutRule),
  '#layout 未设置 flex:1 / min-height:0，无法自适应剩余高度');
console.log('  body / #layout 采用 flex 自适应布局  ✓');

/* ═════════════════════════════════════════
   5. 移动端媒体查询
   ═════════════════════════════════════════ */
console.log('\n── 移动端适配 ──');

function mediaBlock(maxWidth) {
  const start = css.indexOf(`@media (max-width:${maxWidth}px)`);
  if (start < 0) return null;
  // 向后配对花括号
  let i = css.indexOf('{', start), depth = 1, j = i + 1;
  while (j < css.length && depth > 0) {
    if (css[j] === '{') depth++;
    else if (css[j] === '}') depth--;
    j++;
  }
  return css.slice(i + 1, j - 1);
}

const m900 = mediaBlock(900);
const m620 = mediaBlock(620);
ok(!!m900, '缺少 ≤900px 的媒体查询（平板 / 手机横屏）');
ok(!!m620, '缺少 ≤620px 的媒体查询（手机竖屏）');

if (m900) {
  /* 导航：移动端必须把全部入口一屏铺开。
     曾经的「横向滚动」方案会把一半入口藏在屏幕外且无任何提示，
     玩家会误以为底部只有露出来的那几个功能。 */
  const sidebar = (m900.match(/#sidebar\{[\s\S]*?\}/) || [''])[0];
  ok(/display\s*:\s*grid/.test(sidebar),
    '≤900px 时侧栏未改为网格布局，导航入口无法一屏看全');
  ok(/auto-fit|auto-fill/.test(sidebar),
    '≤900px 时导航栅格未自适应列数，窄屏会溢出');
  ok(!/overflow-x\s*:\s*auto/.test(sidebar),
    '≤900px 时导航仍依赖横向滚动，入口会被藏到屏幕外');

  const navItem = (m900.match(/\.nav-item\{[\s\S]*?\}/) || [''])[0];
  const mh = navItem.match(/min-height\s*:\s*(\d+)px/);
  ok(mh && +mh[1] >= 44, `≤900px 时导航项触控高度不足 44px（当前 ${mh ? mh[1] + 'px' : '未设置'}）`);
  /* 神通按钮的 44px 触控高度由文件末尾的全局触控规则统一提供
     （那条规则同时覆盖 .btn/.mini-btn/.stance-btn 等），此处只需确认它确实覆盖了 .skill-btn。 */
  ok((css.match(/[^{}]*\.skill-btn[^{}]*\{[^}]*\}/g) || []).some(r => /min-height\s*:\s*44px/.test(r)),
    '战斗神通按钮（.skill-btn）缺少 ≥44px 的触控高度');
  ok(/#battle-overlay\{[\s\S]*?width\s*:\s*calc\(100vw/.test(m900),
    '≤900px 时战斗浮层未铺满宽度');
}

/* 导航入口数量必须与 index.html 中声明的一致（防止漏加/漏显） */
const navCount = (html.match(/class="nav-item/g) || []).length;
ok(navCount >= 13, `导航入口仅 ${navCount} 个，疑似遗漏面板`);
console.log(`  导航入口 ${navCount} 个，移动端网格全展开  ✓`);

if (m620) {
  /* 手机端底栏必须做减法：只留必要项，避免与上方导航形成两条相邻横滚区域 */
  ok(/\.bb-stat\.hide-sm\s*\{[^}]*display\s*:\s*none/.test(m620)
    || /#bb-stats[^{]*bb-stat[^{]*\{[^}]*display\s*:\s*none/.test(m620),
    '≤620px 未精简底栏统计项');
  ok(/\.toggle-btn\s+\.tg-label\s*\{[^}]*display\s*:\s*none/.test(m620),
    '≤620px 自动开关未收敛为图标');
  ok(/grid-template-columns\s*:\s*1fr/.test(m620), '≤620px 网格未降为单列');
  ok(/\.quest-chip\s*\{[^}]*max-width/.test(m620), '≤620px 道途入口未做宽度限制');
}

/* 刘海屏安全区 */
ok(/viewport-fit=cover/.test(html), 'index.html 的 viewport 缺少 viewport-fit=cover（刘海屏适配）');
ok(/env\(safe-area-inset-bottom\)/.test(css), '未处理底部安全区（iPhone 底部横条会遮挡底栏）');
ok(/safe-area-inset-top/.test(css), '未处理顶部安全区');
console.log('  媒体查询 900px / 620px、触控尺寸、安全区  ✓');

/* 触控目标总览 */
const touchHits = [];
for (const m of mediaBlock(900) ? [mediaBlock(900)] : []) {
  const re = /([.#][\w-]+)\{([^}]*min-height\s*:\s*(\d+)px[^}]*)\}/g;
  let mm;
  while ((mm = re.exec(m))) if (+mm[3] < 44) touchHits.push(`${mm[1]}(${mm[3]}px)`);
}
if (touchHits.length) warns.push('移动端触控目标偏小：' + touchHits.join(' '));

const cssRules = css.match(/[^{}]+\{[^{}]*\}/g) || [];
ok(cssRules.some(rule => /#loot-layer\s*\{/.test(rule) && /pointer-events\s*:\s*none/.test(rule)),
  '十连结果层未关闭默认 pointer-events');
ok(cssRules.some(rule => /\.pull-veil/.test(rule) && /pointer-events\s*:\s*auto/.test(rule)),
  '十连弹层未显式启用 pointer-events');

/* ═════════════════════════════════════════
   战斗浮层：尺寸必须在整场战斗中恒定
   ─────────────────────────────────────────
   浮层是 position:fixed + bottom 贴底定位的，所以内部任何元素
   一旦改变高度、或被 display:none 移出文档流，上方内容就会整体跳动。
   下面每条都对应一个真实的跳动源，写成断言防止再次退化。
   ═════════════════════════════════════════ */
{
  /* 只取「顶层规则」。本文件的媒体查询写在基础规则之前，
     若直接在整份 CSS 里 indexOf，会命中媒体查询里被覆盖的那条规则。 */
  const stripAtBlocks = src => {
    let out = '', i = 0;
    for (;;) {
      const at = src.indexOf('@media', i);
      if (at < 0) return out + src.slice(i);
      out += src.slice(i, at);
      let j = src.indexOf('{', at), depth = 0;
      for (; j < src.length; j++) {
        if (src[j] === '{') depth++;
        else if (src[j] === '}' && --depth === 0) { j++; break; }
      }
      i = j;
    }
  };
  const cssTop = stripAtBlocks(css);
  const ruleOf = sel => {
    const i = cssTop.indexOf(sel + '{');
    return i < 0 ? '' : cssTop.slice(i + sel.length + 1, cssTop.indexOf('}', i));
  };

  const log = ruleOf('.battle-log');
  ok(/height\s*:\s*\d+px/.test(log) && !/max-height/.test(log),
    '.battle-log 未用固定 height —— 日志会随行数从 0 撑到上限，把浮层一路顶高');

  const warn = ruleOf('.bo-warn');
  ok(/height\s*:\s*\d+px/.test(warn), '.bo-warn 未固定高度 —— 提示条出现/消失会顶动下方内容');
  ok(css.indexOf('.bo-warn:not(.on)') >= 0 && /visibility\s*:\s*hidden/.test(ruleOf('.bo-warn:not(.on)')),
    '.bo-warn 隐藏时未用 visibility 占位（display:none 会让布局塌缩）');

  /* 结算条靠「日志让出等量高度」保持总高不变：
     隐藏用 display:none（空间已由日志让出，不能再常驻占位，否则重复扣减），
     但必须存在 has-result 规则把日志高度减掉结算条的 68+11=79px。 */
  const result = ruleOf('.bo-result');
  ok(/height\s*:\s*\d+px/.test(result), '.bo-result 未固定高度 —— 结算条出现时浮层高度会变化');
  ok(/has-result/.test(css) && /has-result[\s\S]{0,160}\.battle-log/.test(css),
    '结算条出现时未让日志腾出等量高度，浮层总高会变化');
  /* 「日志让位」的数值必须与各处日志高度自洽：
     桌面端与移动端各一条 calc(<日志高度> - 79px)，79px 为结算条 68+11。 */
  {
    const calcs = css.match(/calc\((\d+)px\s*-\s*79px\)/g) || [];
    ok(calcs.length >= 2, '缺少「日志让位」规则（桌面端 / 移动端各需一条 calc(<日志高度> - 79px)）');
    for (const c of calcs) {
      const n = c.match(/calc\((\d+)px/)[1];
      ok(new RegExp('\\.battle-log\\{[^}]*height:' + n + 'px').test(css),
        `calc(${n}px - 79px) 对应的日志高度 ${n}px 在 CSS 中不存在，数值已失配`);
    }
  }
  ok(!/\.bo-result:not\(\.show\)\{[^}]*visibility\s*:\s*hidden/.test(css),
    '结算条同时使用了「常驻占位」与「日志让位」，会导致面板净缩 79px');

  const skills = ruleOf('.bo-skills');
  ok(/flex-wrap\s*:\s*nowrap/.test(skills),
    '.bo-skills 允许换行 —— 神通过多时会把指令区撑成两行');

  const buffs = ruleOf('.bo-buffs');
  ok(/height\s*:\s*\d+px/.test(buffs) && /flex-wrap\s*:\s*nowrap/.test(buffs),
    '.bo-buffs 未固定单行高度 —— 增益徽章增减会顶动整个舞台');

  ok(/min-width\s*:\s*\d+px/.test(ruleOf('.skill-btn .sb-cost')),
    '.sb-cost 未设最小宽度 —— 「灵力 N」变「冷却 N」时按钮宽度抖动，整排神通重排');

  ok(/white-space\s*:\s*nowrap/.test(ruleOf('.bo-title')),
    '.bo-title 未禁止换行 —— 标题变长（如天劫）会把头部撑成两行');

  /* 头部必须拆成「标题段 + 控制段」两段并各自占位。
     若把标题、速度、按钮混在一起靠 flex-wrap 自动折行，
     标题一长就会多折一行，实测头部高度会在 115px ↔ 144px 之间跳变。 */
  const headMain = ruleOf('.bo-head-main');
  ok(headMain && /display\s*:\s*flex/.test(headMain) && /flex\s*:\s*1 1 auto/.test(headMain),
    '战斗头部「标题段」未真正参与 flex 布局（需 display:flex + flex:1 1 auto），标题变长会改变行数');
  ok(headMain && !/display\s*:\s*contents/.test(headMain),
    '战斗头部「标题段」被设为 display:contents，拆分失去意义，行数仍会随标题变化');
  ok(/display\s*:\s*flex/.test(ruleOf('.bo-head-ctl') || ''),
    '战斗头部「控制段」未设为 flex 容器');
  ok(/\.bo-head-main,\.bo-head-ctl\{[^}]*flex-basis\s*:\s*100%/.test(css),
    '≤900px 时头部两段未各占一整行，行数会随内容浮动');
  ok(/\.bo-head\{[^}]*min-height\s*:\s*\d+px/.test(css),
    '≤900px 时战斗头部未设 min-height，内容「刚好差一点」时行数会跳变');

  ok(!/\.bo-speed\{[^}]*margin-left\s*:\s*auto/.test((css.match(/@media \(max-width:900px\)\{[\s\S]*?\n\}/) || [''])[0]),
    '≤900px 时 .bo-speed 仍保留 margin-left:auto —— 换行时会吞掉整行，把「收起」挤到第三行');

  /* 级联顺序陷阱：本文件的媒体查询写在部分基础规则之前。
     若把移动端覆盖写在前面，会被后面的基础规则反向覆盖 —— 曾导致
     神通无法独立成行、指令区布局与预期不符。 */
  {
    const baseCmd = css.indexOf('.bo-command{');
    const mobCmd = css.indexOf('.bo-command{padding:10px;flex-wrap:wrap;}');
    ok(baseCmd >= 0 && mobCmd > baseCmd,
      '移动端 .bo-command 覆盖写在基础规则之前，会被反向覆盖（flex-wrap:wrap 失效）');
    const baseSk = css.indexOf('.bo-skills{display:flex;gap:8px;flex:1 1 auto');
    const mobSk = css.indexOf('.bo-skills{order:3;flex-basis:100%;}');
    ok(baseSk >= 0 && mobSk > baseSk,
      '移动端 .bo-skills 覆盖写在基础规则之前，神通无法独立成行');
  }

  console.log('  战斗浮层尺寸恒定（日志 / 提示条 / 结算条 / 神通 / 徽章）  ✓');
}

/* ═════════════════════════════════════════
   结果
   ═════════════════════════════════════════ */
console.log('\n== 审计结果 ==');
if (warns.length) for (const w of warns) console.log('  ! ' + w);
if (fails.length) {
  for (const f of fails) console.log('  ✗ ' + f);
  process.exit(1);
}
console.log('  ✓ 对比度与字号全部达标');

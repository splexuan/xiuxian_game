/* ═══════════════════════════════════════════
   utils.js — 通用工具函数
   ═══════════════════════════════════════════ */
(function () {
  'use strict';
  const XG = (window.XG = window.XG || {});

  const CN_UNITS = [
    [1e48, '极'], [1e44, '载'], [1e40, '正'], [1e36, '涧'], [1e32, '沟'],
    [1e28, '穰'], [1e24, '秭'], [1e20, '垓'], [1e16, '京'],
    [1e12, '兆'], [1e8, '亿'], [1e4, '万'],
  ];

  const U = {
    /* ── 数值格式化：中文大数单位 ── */
    fmt(n, digits) {
      if (n === undefined || n === null || isNaN(n)) return '0';
      if (!isFinite(n)) return '∞';
      const neg = n < 0;
      n = Math.abs(n);
      if (n < 1000) {
        const v = n < 10 && n % 1 !== 0 ? n.toFixed(digits === undefined ? 1 : digits) : Math.floor(n).toString();
        return (neg ? '-' : '') + v;
      }
      for (let i = 0; i < CN_UNITS.length; i++) {
        const [v, u] = CN_UNITS[i];
        if (n >= v) {
          const x = n / v;
          const d = x >= 100 ? 1 : x >= 10 ? 2 : 3;
          return (neg ? '-' : '') + x.toFixed(d).replace(/\.?0+$/, '') + u;
        }
      }
      return (neg ? '-' : '') + Math.floor(n).toLocaleString('en-US');
    },

    /* 精确整数（灵石等） */
    fmtInt(n) { return U.fmt(Math.floor(n)); },

    /* 百分比 */
    pct(n, d) { return (n * 100).toFixed(d === undefined ? 1 : d) + '%'; },

    /* 倍率 ×1.23 */
    mult(n) {
      if (!isFinite(n)) return '∞';
      if (n >= 1e6) return '×' + U.fmt(n);
      if (n >= 100) return '×' + n.toFixed(0);
      return '×' + n.toFixed(n < 10 ? 2 : 1);
    },

    /* 时间：mm:ss / hh:mm:ss / x天 */
    time(sec) {
      if (!isFinite(sec) || sec < 0) return '∞';
      sec = Math.floor(sec);
      if (sec < 60) return sec + '秒';
      const m = Math.floor(sec / 60), s = sec % 60;
      if (m < 60) return m + '分' + (s > 0 ? s + '秒' : '');
      const h = Math.floor(m / 60);
      if (h < 24) return h + '时' + (m % 60 > 0 ? (m % 60) + '分' : '');
      const d = Math.floor(h / 24);
      return d + '天' + (h % 24 > 0 ? (h % 24) + '时' : '');
    },

    /* 倒计时 mm:ss */
    clock(sec) {
      if (!isFinite(sec) || sec <= 0) return '--:--';
      sec = Math.floor(sec);
      const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
      const p = x => String(x).padStart(2, '0');
      return h > 0 ? `${p(h)}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
    },

    /* ── 随机 ── */
    rnd(a, b) { return a + Math.random() * (b - a); },
    rndInt(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); },
    pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
    chance(p) { return Math.random() < p; },
    /* 加权随机：items = [{w:number, ...}] */
    weighted(items, wkey) {
      wkey = wkey || 'w';
      let total = 0;
      for (const it of items) total += (it[wkey] || 0);
      if (total <= 0) return items[0];
      let r = Math.random() * total;
      for (const it of items) { r -= (it[wkey] || 0); if (r <= 0) return it; }
      return items[items.length - 1];
    },

    clamp(v, a, b) { return v < a ? a : v > b ? b : v; },
    lerp(a, b, t) { return a + (b - a) * t; },

    /* 深拷贝 */
    clone(o) { return JSON.parse(JSON.stringify(o)); },

    /* 数字安全（防止 NaN / Infinity 污染存档） */
    safe(n, d) { return typeof n === 'number' && isFinite(n) ? n : (d === undefined ? 0 : d); },

    /* 从数组中随机取 n 个不重复 */
    sample(arr, n) {
      const c = arr.slice(); const out = [];
      while (out.length < n && c.length) out.push(c.splice(Math.floor(Math.random() * c.length), 1)[0]);
      return out;
    },

    /* HTML 转义（防止内容破坏结构） */
    esc(s) {
      return String(s === undefined || s === null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    },
  };

  /* ── 品质表 ── */
  U.QUALITY = [
    { name: '凡品', color: '#9aa7bd' },
    { name: '灵品', color: '#7ee08a' },
    { name: '宝品', color: '#6bb8ff' },
    { name: '玄品', color: '#b18cff' },
    { name: '地品', color: '#ffb454' },
    { name: '天品', color: '#ff6b81' },
    { name: '仙品', color: '#ffe9a8' },
  ];

  XG.U = U;

  /* ── 简单事件总线 ── */
  const bus = {};
  XG.Bus = {
    on(evt, fn) { (bus[evt] = bus[evt] || []).push(fn); },
    off(evt, fn) { if (bus[evt]) bus[evt] = bus[evt].filter(f => f !== fn); },
    emit(evt, data) {
      const l = bus[evt];
      if (l) for (const f of l.slice()) { try { f(data); } catch (e) { console.error('[bus:' + evt + ']', e); } }
      const all = bus['*'];
      if (all) for (const f of all.slice()) { try { f(evt, data); } catch (e) { console.error(e); } }
    },
  };
})();

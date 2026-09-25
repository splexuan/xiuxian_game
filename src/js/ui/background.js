(function () {
  'use strict';
  const XG = window.XG;

  const BG = {
    init() {
      const cv = document.getElementById('bg-canvas');
      if (!cv) return;
      let ctx = null;
      try { ctx = cv.getContext('2d'); } catch (e) { ctx = null; }
      if (!ctx) return;
      const motionQuery = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
      let reduced = !!(motionQuery && motionQuery.matches);
      let W = 1, H = 1, dpr = Math.min(window.devicePixelRatio || 1, 2);
      let raf = 0, visible = !document.hidden, last = 0;
      let gradientKey = '', backgroundGradient = null, glowGradient = null;
      const colors = ['#5fd8c4', '#e9c46a', '#6bb8ff', '#b18cff'];
      const parts = [];
      const N = 70;
      const spriteSize = 64;
      const sprites = colors.map(color => {
        const image = document.createElement('canvas');
        image.width = spriteSize;
        image.height = spriteSize;
        const g = image.getContext('2d');
        if (!g) return null;
        const gradient = g.createRadialGradient(spriteSize / 2, spriteSize / 2, 0, spriteSize / 2, spriteSize / 2, spriteSize / 2);
        gradient.addColorStop(0, color);
        gradient.addColorStop(.35, color);
        gradient.addColorStop(1, 'transparent');
        g.fillStyle = gradient;
        g.fillRect(0, 0, spriteSize, spriteSize);
        return image;
      });

      function resize() {
        W = Math.max(1, cv.clientWidth || window.innerWidth || 1);
        H = Math.max(1, cv.clientHeight || window.innerHeight || 1);
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        cv.width = Math.round(W * dpr);
        cv.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        gradientKey = '';
        paintBase();
      }

      function paintBase() {
        const st = XG.State && XG.State.s;
        const realmIdx = st ? st.realm : 0;
        const hue = 210 + realmIdx * 8;
        const key = W + ':' + H + ':' + hue;
        if (key !== gradientKey) {
          backgroundGradient = ctx.createLinearGradient(0, 0, W * .4, H);
          backgroundGradient.addColorStop(0, `hsl(${hue},45%,5%)`);
          backgroundGradient.addColorStop(.55, `hsl(${hue + 12},42%,7%)`);
          backgroundGradient.addColorStop(1, `hsl(${hue + 30},38%,4%)`);
          glowGradient = ctx.createRadialGradient(W * .5, H * .36, 0, W * .5, H * .36, Math.max(W, H) * .72);
          glowGradient.addColorStop(0, `hsla(${hue + 30},80%,55%,.075)`);
          glowGradient.addColorStop(1, 'transparent');
          gradientKey = key;
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.fillStyle = backgroundGradient;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = glowGradient;
        ctx.fillRect(0, 0, W, H);
      }

      function seed() {
        parts.length = 0;
        for (let i = 0; i < N; i++) {
          parts.push({
            x: Math.random() * W,
            y: Math.random() * H,
            r: .6 + Math.random() * 2.2,
            vx: (Math.random() - .5) * 9,
            vy: -6 - Math.random() * 18,
            a: .12 + Math.random() * .42,
            c: (Math.random() * colors.length) | 0,
            ph: Math.random() * Math.PI * 2,
          });
        }
      }

      function draw(now) {
        raf = 0;
        if (!visible || reduced) return;
        const dt = Math.min((now - last) / 1000, .1);
        last = now;
        paintBase();
        ctx.globalCompositeOperation = 'lighter';
        for (const p of parts) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.ph += dt * 1.7;
          if (p.y < -12) { p.y = H + 10; p.x = Math.random() * W; }
          if (p.x < -12) p.x = W + 10;
          if (p.x > W + 12) p.x = -10;
          const alpha = p.a * (.6 + .4 * Math.sin(p.ph));
          const radius = p.r * (1 + .25 * Math.sin(p.ph * .7));
          const image = sprites[p.c];
          if (image) {
            ctx.globalAlpha = alpha;
            ctx.drawImage(image, p.x - radius * 2.5, p.y - radius * 2.5, radius * 5, radius * 5);
          }
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        raf = requestAnimationFrame(draw);
      }

      function start() {
        if (!visible || reduced || raf) return;
        last = performance.now();
        raf = requestAnimationFrame(draw);
      }

      function stop() {
        if (raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf);
        raf = 0;
      }

      function syncMotion() {
        reduced = !!(motionQuery && motionQuery.matches);
        if (reduced) { stop(); paintBase(); } else start();
      }

      resize();
      seed();
      if (reduced) paintBase(); else start();
      window.addEventListener('resize', resize);
      document.addEventListener('visibilitychange', () => {
        visible = !document.hidden;
        if (visible) start(); else stop();
      });
      if (motionQuery) {
        if (typeof motionQuery.addEventListener === 'function') motionQuery.addEventListener('change', syncMotion);
        else if (typeof motionQuery.addListener === 'function') motionQuery.addListener(syncMotion);
      }
    },
  };

  XG.BG = BG;
})();

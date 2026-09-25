/* ═══════════════════════════════════════════
   cultivation.js — 修炼循环 / 突破 / 天劫 / 离线
   ═══════════════════════════════════════════ */
(function () {
  'use strict';
  const XG = window.XG;
  const U = XG.U, R = XG.R;

  const Cult = {
    _acc: { herb: 0, jade: 0 },
    _evtTimer: 0,
    _achTimer: 0,
    _autoPillCooldowns: { p_juqi: 0, p_ningshen: 0, p_pojing: 0 },
    _autoBreakCooldown: 0,
    AUTO_PILL_COOLDOWN: 1,
    AUTO_BREAK_COOLDOWN: 1,

    hasBuff(id) {
      return XG.State.s.buffs.some(b => b.id === id && b.until > Date.now());
    },

    useAutoPill(id) {
      if ((this._autoPillCooldowns[id] || 0) > 0) return false;
      const result = XG.Economy.usePill(id);
      if (!result || !result.ok) return false;
      this._autoPillCooldowns[id] = this.AUTO_PILL_COOLDOWN;
      return true;
    },

    autoBreak(need, rate) {
      const s = XG.State.s;
      if (this._autoBreakCooldown > 0 || R.isMax(s.realm, s.layer) || XG.Combat.active || XG.Combat.last) return false;
      if (R.needTribulation(s.realm, s.layer)) {
        const started = this.startTribulation('auto');
        if (!started) this._autoBreakCooldown = this.AUTO_BREAK_COOLDOWN;
        return !!started;
      }
      if (s.settings.autoPill) this.autoUsePill(need, rate);
      const result = this.tryBreak(true);
      if (result.ok) this._autoBreakCooldown = 0;
      else if (result.reason === 'fail') this._autoBreakCooldown = this.AUTO_BREAK_COOLDOWN;
      return result;
    },

    /* ══════ 主循环 ══════ */
    tick(dt) {
      const s = XG.State.s;
      const Calc = XG.State.Calc;
      dt = Number.isFinite(dt) ? Math.max(0, dt) : 0;
      for (const id in this._autoPillCooldowns) this._autoPillCooldowns[id] = Math.max(0, this._autoPillCooldowns[id] - dt);
      this._autoBreakCooldown = Math.max(0, this._autoBreakCooldown - dt);
      s.stats.playTime += dt;
      /* 兜底：无论何种原因让灵气变成 NaN/Infinity，都会永久卡死
         （Math.min(need, NaN) === NaN），这里统一复位，
         避免一处乘区被污染就导致整局无法推进。 */
      if (!Number.isFinite(s.spirit)) s.spirit = 0;

      /* 灵气累积 */
      const need = Calc.need();
      const rate = Calc.spiritRate();
      if (!R.isMax(s.realm, s.layer)) {
        s.spirit = Math.min(need, s.spirit + rate * dt);
        s.stats.totalSpirit += rate * dt;
      } else {
        s.spirit = Math.min(need, s.spirit + rate * dt);
      }

      /* 灵草 */
      const herbRate = Calc.buildingMults().herbRate * (1 + (Calc.petTotals().herbGain || 0)) * (1 + s.realm * 0.8);
      if (herbRate > 0) {
        Cult._acc.herb += herbRate * dt;
        if (Cult._acc.herb >= 1) {
          const g = Math.floor(Cult._acc.herb);
          Cult._acc.herb -= g;
          XG.State.Res.gainHerb(g, true);
        }
      }

      /* 仙玉（悟道台/天道碑 被动产出） */
      const jr = Calc.buildingMults().jadeRate;
      if (jr > 0) {
        Cult._acc.jade += jr * dt;
        if (Cult._acc.jade >= 1) {
          const g = Math.floor(Cult._acc.jade);
          Cult._acc.jade -= g;
          XG.State.Res.gainJade(g, true);
        }
      }

      /* 清理过期 Buff */
      if (s.buffs.length) {
        const now = Date.now();
        const before = s.buffs.length;
        s.buffs = s.buffs.filter(b => b.until > now);
        if (s.buffs.length !== before) XG.Bus.emit('buff:change');
      }

      /* 自动服丹 */
      const canAct = !XG.Combat.active && !XG.Combat.last;
      if (s.settings.autoPill && canAct && !(s.settings.autoBreak && s.spirit >= need)) Cult.autoUsePill(need, rate);

      /* 自动突破（含自动引动天劫） */
      if (s.settings.autoBreak && s.spirit >= need && canAct) Cult.autoBreak(need, rate);

      /* 奇遇计时 */
      Cult._evtTimer += dt;
      const evtCd = 75 + U.rnd(0, 40);
      if (Cult._evtTimer >= evtCd) {
        Cult._evtTimer = 0;
        if (Math.random() < 0.62) XG.Events.triggerRandom();
      }

      /* 天象轮转 + 道途检查（低频） */
      Cult._achTimer += dt;
      if (Cult._achTimer >= 2) {
        Cult._achTimer = 0;
        XG.Achieve.check();
        XG.Omen.tick();
        XG.Quest.check();
      }
    },

    /* ══════ 自动服丹策略 ══════ */
    autoUsePill(need, rate) {
      const s = XG.State.s;
      const Calc = XG.State.Calc;
      need = Number.isFinite(need) ? need : Calc.need();
      rate = Number.isFinite(rate) ? rate : Calc.spiritRate();
      if (R.isMax(s.realm, s.layer) || XG.Combat.active || XG.Combat.last) return false;

      if (s.spirit >= need) {
        if (s.settings.autoBreak && this._autoBreakCooldown > 0) return false;
        if (!R.needTribulation(s.realm, s.layer) && s.pills.p_pojing && !this.hasBuff('p_pojing')) {
          const chance = Calc.breakChance();
          if (chance < 0.86 && this.useAutoPill('p_pojing')) return true;
        }
        return false;
      }

      if (s.pills.p_juqi && s.spirit > need * 0.72) {
        const def = XG.idx.pill.p_juqi;
        const gain = def.effect(s, Calc.mods().pillPower);
        const actual = Math.min(need, s.spirit + gain) - s.spirit;
        if (actual > 0 && this.useAutoPill('p_juqi')) return true;
      }
      if (s.pills.p_ningshen && !this.hasBuff('p_ningshen') && rate < need / 30) {
        const def = XG.idx.pill.p_ningshen;
        if (rate > 0 && def.buffMult(Calc.mods().pillPower) > 1 && this.useAutoPill('p_ningshen')) return true;
      }
      return false;
    },

    /* ══════ 手动吐纳（点击灵珠）══════ */
    meditate() {
      const s = XG.State.s, Calc = XG.State.Calc;
      if (R.isMax(s.realm, s.layer)) return 0;
      const rate = Calc.spiritRate();
      const gain = Math.max(rate * 6, XG.REALMS[s.realm].expBase * 0.02);
      s.spirit = Math.min(Calc.need(), s.spirit + gain);
      s.stats.totalSpirit += gain;
      s.stats.meditates = (s.stats.meditates || 0) + 1;
      XG.Bus.emit('meditate', gain);
      return gain;
    },

    /* ══════ 突破 ══════ */
    attemptBreak(isAuto, options) {
      const s = XG.State.s, Calc = XG.State.Calc;
      if (R.isMax(s.realm, s.layer)) return { ok: false, reason: 'max' };
      if (s.spirit < Calc.need()) return { ok: false, reason: 'spirit' };
      if (R.needTribulation(s.realm, s.layer)) return { ok: false, reason: 'tribulation' };

      const chance = Calc.breakChance();
      if (U.chance(chance)) {
        Cult.doBreak(options);
        if (isAuto && !(options && options.offline)) Cult._autoBreakCooldown = 0;
        return { ok: true, auto: isAuto };
      }
      const failed = Cult.failBreak(chance, options);
      if (isAuto && !(options && options.offline)) Cult._autoBreakCooldown = Cult.AUTO_BREAK_COOLDOWN;
      return { ok: false, reason: 'fail', lost: failed.lost, chance };
    },

    tryBreak(isAuto) {
      return Cult.attemptBreak(isAuto);
    },

    failBreak(chance, options) {
      options = options || {};
      const s = XG.State.s;
      const keep = XG.CONFIG.BREAK_FAIL_KEEP;
      const lost = s.spirit * (1 - keep);
      s.spirit *= keep;
      s.stats.breakthroughsFailed++;
      if (!options.offline) XG.State.addLog(`突破失败！灵力紊乱，散失灵气 <b>${U.fmt(lost)}</b>（成功率 ${U.pct(chance, 0)}）`, 'battle');
      XG.Bus.emit('break:fail', { lost, chance, offline: !!options.offline });
      return { lost };
    },

    doBreak(options) {
      options = options || {};
      const s = XG.State.s;
      s.spirit = 0;
      s.stats.breakthroughs++;

      let realmUp = false;
      if (s.layer >= XG.CONFIG.LAYERS_PER_REALM) {
        s.layer = 1;
        if (s.realm < XG.REALMS.length - 1) { s.realm++; realmUp = true; }
      } else {
        s.layer++;
      }

      const name = R.name(s.realm, s.layer);
      if (realmUp) {
        const rb = XG.REALMS[s.realm];
        XG.Bus.emit('realm:up', s.realm);
        const jade = 5 + s.realm * 3;
        XG.State.Res.gainJade(jade, true);
        const milestone = XG.baseAtkAt(s.realm + 0.5) * 150 * XG.State.Calc.mods().stoneGain;
        XG.State.Res.gainStone(milestone, true);
        if (!options.offline) {
          XG.State.addLog(`【${rb.name}境】${rb.desc}`, 'epic');
          XG.State.addLog(`突破至 <b>${name}</b>！获得仙玉 ${jade}，灵石若干。`, 'gain');
        }
        if (s.pets.eggs === 0 && s.realm >= 1) s.pets.eggs += 1;
        const got = XG.Combat.rollArt(U.clamp(s.realm, 1, 6), '境界参悟');
        if (got && got.type === 'art') XG.Bus.emit('float', { text: '参悟《' + got.art.name + '》', cls: 'epic' });
      } else if (!options.offline) {
        XG.State.addLog(`修为精进，突破至 <b>${name}</b>。`, 'gain');
      }
      XG.Bus.emit('break:ok', { realmUp, name, offline: !!options.offline });
      return true;
    },

    /* ══════ 天劫 ══════ */
    startTribulation(aidId) {
      const s = XG.State.s, Calc = XG.State.Calc;
      if (!R.needTribulation(s.realm, s.layer)) return false;
      if (s.spirit < Calc.need()) return false;

      /* 渡劫准备：投入灵石布阵，换取本次渡劫的额外「余量」。
         'auto' 用于挂机 —— 在付得起的前提下自动挑最高档，
         否则后期天劫打不过会把挂机永久卡在境界门口。 */
      const tier = aidId === 'auto'
        ? XG.Combat.bestAffordableTribAid()
        : (XG.Combat.tribAidTiers().find(t => t.id === aidId)
          || { id: 'none', name: '独自渡劫', rounds: 0, cost: 0 });
      if (tier.cost > 0) {
        if (!XG.State.Res.spendStone(tier.cost)) return false;
        XG.State.addLog(`【渡劫准备】${tier.name}，耗灵石 ${U.fmt(tier.cost)}，余量 +${tier.rounds.toFixed(1)} 回合。`, 'gain');
      }

      const nextRealm = s.realm + 1;
      const enemy = XG.Combat.makeTribulation(nextRealm, tier.rounds);
      const p = Calc.playerStats();
      return XG.Combat.startBattle(p, {
        kind: 'tribulation',
        enemy,
        title: '天劫降临 · ' + XG.REALMS[nextRealm].name + '境',
        onWin: () => {
          s.stats.tribulations++;
          Cult.doBreak({ source: 'tribulation' });
          XG.State.Res.gainJade(6 + nextRealm * 3, true);
          XG.State.addLog(`【渡劫成功】九天雷劫散去，你踏入 <b>${XG.REALMS[nextRealm].name}境</b>，天地为之震动！`, 'epic');
          XG.Bus.emit('tribulation:win', nextRealm);
        },
        onLose: () => {
          const keep = XG.CONFIG.TRIB_FAIL_KEEP;
          const lost = s.spirit * (1 - keep);
           s.spirit *= keep;
           Cult._autoBreakCooldown = Cult.AUTO_BREAK_COOLDOWN;
           XG.State.addLog(`【渡劫失败】雷劫加身，你重伤退回，灵气散失 <b>${U.fmt(lost)}</b>。所幸道基未损。`, 'battle');
          XG.Bus.emit('tribulation:lose');
        },
      });
    },

    /* ══════ 离线结算 ══════ */
    applyOffline() {
      const s = XG.State.s;
      const now = Date.now();
      const last = s.meta.lastSeen || now;
      const sec = Math.max(0, (now - last) / 1000);
      if (sec < XG.CONFIG.OFFLINE_MIN_SECONDS) {
        s.meta.lastSeen = now;
        return null;
      }

      const capped = Math.max(0, Math.min(sec, XG.CONFIG.OFFLINE_CAP_HOURS * 3600));
      const eff = XG.CONFIG.OFFLINE_EFFICIENCY;
      const Calc = XG.State.Calc;
      const initialSpirit = s.spirit;
      let spirit = s.spirit;
      let remain = capped;
      let breaks = 0;
      let failed = 0;
      let herbRaw = 0;
      const accrueHerb = seconds => {
        const t = Math.max(0, Number(seconds) || 0);
        if (!t) return;
        const bm = Calc.buildingMults();
        const pt = Calc.petTotals();
        const rate = bm.herbRate * (1 + (pt.herbGain || 0)) * (1 + s.realm * 0.8);
        herbRaw += rate * eff * t;
      };

      if (s.settings.autoBreak && Calc.spiritRate() > 0) {
        for (let g = 0; g < 300 && remain > 0; g++) {
          const need = Calc.need();
          if (R.isMax(s.realm, s.layer) || R.needTribulation(s.realm, s.layer)) {
            const rate = Calc.spiritRate() * eff;
            spirit = Math.min(need, spirit + rate * remain);
            accrueHerb(remain);
            remain = 0;
            break;
          }
          const rate = Calc.spiritRate() * eff;
          if (rate <= 0) {
            accrueHerb(remain);
            remain = 0;
            break;
          }
          const tNeed = Math.max(0, (need - spirit) / rate);
          if (tNeed > remain) {
            spirit = Math.min(need, spirit + rate * remain);
            accrueHerb(remain);
            remain = 0;
            break;
          }
          accrueHerb(tNeed);
          remain -= tNeed;
          spirit = need;
          s.spirit = need;
          const result = Cult.attemptBreak(true, { offline: true });
          spirit = s.spirit;
          if (result.ok) breaks++;
          else if (result.reason === 'fail') failed++;
          else {
            accrueHerb(remain);
            remain = 0;
            break;
          }
        }
        if (remain > 0) {
          const need = Calc.need();
          const rate = Calc.spiritRate() * eff;
          spirit = Math.min(need, spirit + rate * remain);
          accrueHerb(remain);
          remain = 0;
        }
      } else {
        if (Calc.spiritRate() > 0) spirit = Math.min(Calc.need(), spirit + Calc.spiritRate() * eff * capped);
        accrueHerb(capped);
      }
      const spiritGain = Math.max(0, spirit - initialSpirit);

      const herbGain = Math.floor(Math.max(0, herbRaw));
      const jadeGain = Math.floor(Calc.buildingMults().jadeRate * capped * eff);

      let stoneGain = 0;
      let explore = { encounters: 0, sampled: 0, wins: 0, winRate: 0 };
      if (s.explore.running) {
        const zone = XG.Combat.zoneAt(s.explore.zone);
        if (zone && zone.unlocked) {
          explore = XG.Combat.offlineZoneStone(s.explore.zone, capped, eff);
          stoneGain = explore.stone;
        }
      }

      s.spirit = spirit;
      s.stats.totalSpirit += spiritGain;
      if (breaks > 0 || failed > 0) {
        XG.State.addLog(`【闭关】离线期间自行运功，成功突破 ${breaks} 次${failed > 0 ? `，失败 ${failed} 次` : ''}，境界至 <b>${R.name(s.realm, s.layer)}</b>。`, 'epic');
      }
      if (herbGain > 0) XG.State.Res.gainHerb(herbGain, true);
      if (jadeGain > 0) XG.State.Res.gainJade(jadeGain, true);
      if (stoneGain > 0) XG.State.Res.gainStone(stoneGain, true);
      s.meta.lastSeen = now;

      return {
        seconds: sec, capped, breaks, failed,
        spirit: spiritGain, herb: herbGain, jade: jadeGain, stone: stoneGain,
        realm: s.realm, layer: s.layer, explore,
      };
    },
  };

  XG.Cult = Cult;
})();

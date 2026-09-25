/* ═══════════════════════════════════════════
   content2.js — 扩展内容数据表
   神通 / 战斗姿态 / 宝石 / 套装 / 道途任务
   秘境遭遇 / 天象 / 寻宝池
   ═══════════════════════════════════════════ */
(function () {
  'use strict';
  const XG = window.XG;
  const U = XG.U;

  /* ═════════════════════════════════════════
     一、战斗姿态
     ═════════════════════════════════════════ */
  const STANCES = [
    { id: 'balance', name: '均衡', icon: '☯', desc: '攻守兼备，无额外增减。', atk: 1.00, def: 1.00, taken: 1.00 },
    { id: 'attack', name: '攻势', icon: '⚔', desc: '攻击 ×1.40，但防御 ×0.70、受伤 ×1.12。', atk: 1.40, def: 0.70, taken: 1.12 },
    { id: 'guard', name: '守势', icon: '🛡', desc: '防御 ×1.75、受伤 ×0.78，但攻击 ×0.68。', atk: 0.68, def: 1.75, taken: 0.78 },
  ];

  /* ═════════════════════════════════════════
     二、神通（主动技）
     战斗中消耗「灵力」释放，有冷却。
     run(ctx) 中可使用：
       ctx.hit(mult, opts)  对敌造成 mult 倍攻击伤害
            opts: { pen, pierce(def减伤比), crit, tag, color }
       ctx.buff(target,'...') / ctx.debuff(target, obj)
       ctx.heal(target, pct)  按最大气血百分比回复
       ctx.say(text, cls)     追加战斗日志
       ctx.self / ctx.foe     施法者 / 目标
     ═════════════════════════════════════════ */
  const SKILLS = [
    {
      id: 'sk_lieshi', name: '裂石拳', icon: '👊', q: 0, unlock: 0, cost: 20, cd: 2, kind: 'attack', role: 'attack', priority: 10, power: 2.2,
      desc: '凝灵力于拳，轰出 220% 攻击伤害。',
      run: (c) => c.hit(2.2, { tag: '裂石拳' }),
    },
    {
      id: 'sk_huti', name: '凝气护体', icon: '🔵', q: 0, unlock: 0, cost: 20, cd: 4, kind: 'buff', role: 'defense', priority: 20,
      desc: '灵气化罩，3 回合内受到伤害降低 45%。',
      run: (c) => { c.buff(c.self, { id: 'huti', name: '凝气护体', icon: '🔵', rounds: 3, taken: 0.55 }); c.say('灵力化罩，护住周身。', 'buff'); },
    },
    {
      id: 'sk_yujian', name: '御剑术', icon: '🗡', q: 1, unlock: 1, cost: 25, cd: 3, kind: 'attack', role: 'attack', priority: 20, power: 2.7, ignoreDef: 0.5,
      desc: '飞剑破空，造成 270% 伤害并无视 50% 防御。',
      run: (c) => c.hit(2.7, { pen: 0.5, tag: '御剑术' }),
    },
    {
      id: 'sk_huichun', name: '回春术', icon: '🌿', q: 1, unlock: 1, cost: 30, cd: 5, kind: 'heal', role: 'heal', priority: 30,
      desc: '木灵之气流转，回复 32% 最大气血。',
      run: (c) => { c.heal(c.self, 0.32); c.say('青木之气流转，伤势迅速愈合。', 'buff'); },
    },
    {
      id: 'sk_fentian', name: '焚天诀', icon: '🔥', q: 2, unlock: 2, cost: 35, cd: 4, kind: 'attack', role: 'attack', priority: 35, power: 2, dotPower: 0.45, dotRounds: 3,
      desc: '造成 200% 伤害，并附加 3 回合灼烧（每回合 45% 攻击）。',
      run: (c) => {
        c.hit(2.0, { tag: '焚天诀' });
        if (c.foe.hp > 0) { c.debuff(c.foe, { id: 'burn', name: '灼烧', icon: '🔥', rounds: 3, dot: 0.45 }); c.say('烈焰缠身，敌人开始灼烧！', 'buff'); }
      },
    },
    {
      id: 'sk_jianxin', name: '剑心通明', icon: '✨', q: 2, unlock: 2, cost: 25, cd: 5, kind: 'buff', role: 'support', priority: 40,
      desc: '4 回合内暴击率 +40%、暴击伤害 +70%。',
      run: (c) => { c.buff(c.self, { id: 'jianxin', name: '剑心通明', icon: '✨', rounds: 4, crit: 0.40, critDmg: 0.70 }); c.say('剑心澄澈，锋芒毕露！', 'buff'); },
    },
    {
      id: 'sk_zhenhun', name: '镇魂咒', icon: '🌀', q: 3, unlock: 3, cost: 30, cd: 5, kind: 'debuff', role: 'control', priority: 35,
      desc: '镇压敌魂，4 回合内敌人攻击 −45%。',
      run: (c) => { c.debuff(c.foe, { id: 'zhenhun', name: '镇魂', icon: '🌀', rounds: 4, atkMul: 0.55 }); c.say('咒印落下，敌之气势骤衰。', 'buff'); },
    },
    {
      id: 'sk_xuemo', name: '血魔功', icon: '🩸', q: 3, unlock: 3, cost: 0, cd: 6, kind: 'attack', role: 'attack', priority: 45, power: 3.8, forceCrit: true, selfCost: 0.22,
      desc: '献祭 22% 当前气血，打出必定暴击的 380% 伤害。',
      run: (c) => {
        const cost = Math.max(1, c.self.hp * 0.22);
        c.self.hp = Math.max(1, c.self.hp - cost);
        c.say('血气翻涌，以命换命！', 'buff');
        c.hit(3.8, { forceCrit: true, tag: '血魔功' });
      },
    },
    {
      id: 'sk_wanjian', name: '万剑归宗', icon: '⚔', q: 4, unlock: 4, cost: 60, cd: 6, kind: 'attack', role: 'attack', priority: 60, power: 5.2,
      desc: '万剑齐发，造成 520% 攻击伤害。',
      run: (c) => c.hit(5.2, { tag: '万剑归宗', big: true }),
    },
    {
      id: 'sk_jinguang', name: '金光罩', icon: '🟡', q: 4, unlock: 4, cost: 35, cd: 7, kind: 'buff', role: 'defense', priority: 70,
      desc: '2 回合内免疫一切伤害。',
      run: (c) => { c.buff(c.self, { id: 'jinguang', name: '金光罩', icon: '🟡', rounds: 2, immune: true }); c.say('金光罩体，万法不侵！', 'buff'); },
    },
    {
      id: 'sk_tianlei', name: '九天神雷', icon: '⚡', q: 5, unlock: 5, cost: 70, cd: 7, kind: 'attack', role: 'attack', priority: 80, power: 6.8, ignoreDef: 0.6,
      desc: '引九天神雷，造成 680% 伤害并无视 60% 防御。',
      run: (c) => c.hit(6.8, { pen: 0.6, tag: '九天神雷', big: true }),
    },
    {
      id: 'sk_shihun', name: '噬魂大法', icon: '👁', q: 5, unlock: 5, cost: 45, cd: 5, kind: 'attack', role: 'attack', priority: 65, power: 3.2, drain: 0.6,
      desc: '造成 320% 伤害，并汲取其六成化为己用。',
      run: (c) => {
        const d = c.hit(3.2, { tag: '噬魂大法' });
        if (d > 0) { c.heal(c.self, 0, d * 0.6); c.say('魂力回流，气血恢复。', 'buff'); }
      },
    },
    {
      id: 'sk_dadao', name: '大道湮灭', icon: '🌌', q: 6, unlock: 6, cost: 100, cd: 9, kind: 'attack', role: 'attack', priority: 100, power: 12.5, ignoreDef: 0.35,
      desc: '以大道之力碾碎对手，造成 1250% 攻击伤害。',
      run: (c) => c.hit(12.5, { pen: 0.35, tag: '大道湮灭', big: true }),
    },
    {
      id: 'sk_lunhui', name: '轮回逆转', icon: '♾', q: 6, unlock: 6, cost: 80, cd: 10, kind: 'buff', role: 'recovery', priority: 90,
      desc: '回满气血，并在 3 回合内伤害翻倍。',
      run: (c) => {
        c.self.hp = c.self.maxHp;
        c.buff(c.self, { id: 'lunhui', name: '轮回逆转', icon: '♾', rounds: 3, dmgMul: 2.0 });
        c.say('轮回逆转，气机重回巅峰！', 'buff');
      },
    },
  ];

  /* 敌方神通（守关者的杀招，带预警） */
  const ENEMY_SKILLS = [
    { id: 'es_charge', name: '蓄力重击', icon: '💢', tell: '正在蓄力，下一击将造成重创！', mult: 2.6 },
    { id: 'es_rage', name: '狂暴', icon: '😤', tell: '气势暴涨，攻击大幅提升！', buff: { id: 'rage', name: '狂暴', icon: '😤', rounds: 3, atkMul: 1.6 } },
    { id: 'es_drain', name: '噬血', icon: '🩸', tell: '张口狂吸，汲取你的生机！', mult: 1.5, drain: 0.5 },
    { id: 'es_curse', name: '妖咒', icon: '🌀', tell: '妖气缠身，你的防御被削弱！', debuff: { id: 'curse', name: '妖咒', icon: '🌀', rounds: 3, defMul: 0.6 } },
  ];

  /* ═════════════════════════════════════════
     三、宝石（镶嵌）
     stat 为加成键；val 为 1 阶数值，每升 1 阶 ×1.9
     ═════════════════════════════════════════ */
  const GEMS = [
    { id: 'g_atk', name: '赤阳石', icon: '🔺', stat: 'atk', val: 0.045, color: '#ff6b81' },
    { id: 'g_hp', name: '厚土石', icon: '🟫', stat: 'hp', val: 0.050, color: '#c9a227' },
    { id: 'g_def', name: '金刚石', icon: '🔷', stat: 'def', val: 0.055, color: '#6bb8ff' },
    { id: 'g_crit', name: '锐金石', icon: '💠', stat: 'crit', val: 0.012, color: '#ffe066' },
    { id: 'g_critDmg', name: '烈焰石', icon: '🔥', stat: 'critDmg', val: 0.070, color: '#ff9a3c' },
    { id: 'g_dodge', name: '流风石', icon: '🌪', stat: 'dodge', val: 0.008, color: '#7ee08a' },
    { id: 'g_spd', name: '疾行石', icon: '⚡', stat: 'spd', val: 0.012, color: '#b8e0ff' },
    { id: 'g_lifesteal', name: '血玉石', icon: '🩸', stat: 'lifesteal', val: 0.006, color: '#ff5a7a' },
    { id: 'g_pen', name: '破甲石', icon: '🗡', stat: 'pen', val: 0.010, color: '#b18cff' },
    { id: 'g_spirit', name: '通灵石', icon: '🔮', stat: 'spirit', val: 0.020, color: '#8ad8ff' },
  ];
  const GEM_TIER_MULT = 1.9;      // 每阶宝石数值倍率
  const GEM_MAX_TIER = 5;

  /* ═════════════════════════════════════════
     四、套装
     ═════════════════════════════════════════ */
  const SETS = {
    s_fanti: {
      name: '凡铁', q: 0, minRealm: 0,
      2: { atk: 0.05 }, 4: { hp: 0.10 },
    },
    s_lingwen: {
      name: '灵纹', q: 1, minRealm: 0,
      2: { spirit: 0.06 }, 4: { atk: 0.08, crit: 0.02 },
    },
    s_xuantian: {
      name: '玄天', q: 2, minRealm: 1,
      2: { hp: 0.08 }, 4: { def: 0.12, dodge: 0.02 },
    },
    s_taiyi: {
      name: '太乙', q: 3, minRealm: 2,
      2: { crit: 0.03 }, 4: { critDmg: 0.30, pen: 0.04 },
    },
    s_shenmo: {
      name: '神魔', q: 4, minRealm: 4,
      2: { atk: 0.12, lifesteal: 0.02 }, 4: { atk: 0.20, hp: 0.20 },
    },
    s_hundun: {
      name: '鸿蒙', q: 5, minRealm: 6,
      2: { spirit: 0.15, atk: 0.15 }, 4: { atk: 0.30, hp: 0.30, crit: 0.06 },
    },
  };

  /* ═════════════════════════════════════════
     五、道途任务链
     goal.check(s) 返回 bool；reward 为奖励对象
     reward: { jade, stone, herb, mat:{}, gem:{}, perm:{spirit|all}, equip:{q},
               pet:{id}, skill:{id}, free:{spirit|atk} }
     ═════════════════════════════════════════ */
  const QUESTS = [
    /* ── 第一章 · 凡尘问道（新手引导） ── */
    { id: 'q01', ch: 1, title: '山中少年', icon: '🧑', desc: '点击中央灵珠「吐纳」三次，感受天地灵气。',
      tip: '先点几下灵珠加速起步。', goal: (s) => (s.stats.meditates || 0) >= 3, reward: { jade: 2, free: 'spirit' } },
    { id: 'q02', ch: 1, title: '初次突破', icon: '⬆', desc: '灵气满后运功突破，晋升练气二层。',
      tip: '灵气进度条满后，点「运功突破」。', goal: (s) => s.realm >= 0 && s.layer >= 2, reward: { stone: 200, free: 'spirit' } },
    { id: 'q03', ch: 1, title: '开辟洞天', icon: '⛰', desc: '前往【洞天】将聚灵阵升至 2 级。',
      tip: '洞天是修行速度的根本。', goal: (s) => (s.buildings.b_array || 0) >= 2, reward: { jade: 3, mat: { m_core: 3 } } },
    { id: 'q04', ch: 1, title: '修习功法', icon: '📜', desc: '在【功法】中将《引气诀》修至 3 重。',
      tip: '功法等级越高，加成越强。', goal: (s) => s.arts.a_yinqi && s.arts.a_yinqi.lv >= 3, reward: { jade: 4, free: 'spirit' } },
    { id: 'q05', ch: 1, title: '踏入秘境', icon: '⚔', desc: '在【秘境】开启探索，击败 3 只妖兽。',
      tip: '秘境是灵石的唯一来源。', goal: (s) => s.stats.kills >= 3, reward: { jade: 5, mat: { m_core: 5 } } },
    { id: 'q06', ch: 1, title: '灵宠初缘', icon: '🐾', desc: '在【灵宠】中孵化一枚灵宠蛋。',
      tip: '灵宠提供永久被动加成。', goal: (s) => s.pets.owned.length >= 1, reward: { jade: 6, free: 'all' } },
    { id: 'q07', ch: 1, title: '丹道初窥', icon: '⚗', desc: '在【丹道】成功炼出 1 枚聚气丹。',
      tip: '丹药是突破与战斗的底牌。', goal: (s) => s.stats.pillsMade >= 1, reward: { jade: 6, mat: { m_core: 6 } } },
    { id: 'q08', ch: 1, title: '筑基立道', icon: '🏗', desc: '突破至【筑基境】。',
      tip: '跨越大境界需渡天劫，务必准备充分。', goal: (s) => s.realm >= 1, reward: { jade: 12, equip: { q: 2 }, free: 'all' } },

    /* ── 第二章 · 炼器寻宝 ── */
    { id: 'q09', ch: 2, title: '锻炉初开', icon: '🔨', desc: '在【锻炉】中合成 1 次装备。',
      tip: '三件同品同部位装备可合成更高品阶。', goal: (s) => (s.stats.forges || 0) >= 1, reward: { jade: 8, mat: { m_iron: 5 } } },
    { id: 'q10', ch: 2, title: '点石成金', icon: '💎', desc: '在【锻炉】中合成 1 颗 2 阶宝石。',
      tip: '宝石可镶嵌在装备上，永久生效。', goal: (s) => (s.stats.gemForges || 0) >= 1, reward: { jade: 8, free: 'spirit' } },
    { id: 'q11', ch: 2, title: '寻宝问道', icon: '🎰', desc: '在【寻宝阁】寻宝 10 次。',
      tip: '寻宝阁有保底，越抽越强。', goal: (s) => (s.stats.gachaPulls || 0) >= 10, reward: { jade: 10, free: 'all' } },
    { id: 'q12', ch: 2, title: '百战之躯', icon: '⚔', desc: '击败 100 只妖兽。',
      tip: '', goal: (s) => s.stats.kills >= 100, reward: { jade: 10, mat: { m_iron: 8 } } },
    { id: 'q13', ch: 2, title: '登临宝塔', icon: '🗼', desc: '在【通天塔】中踏破第 5 层。',
      tip: '塔层是检验战力的标尺，每 5 层必掉好装备。', goal: (s) => s.tower.best >= 5, reward: { jade: 15, equip: { q: 2 } } },
    { id: 'q14', ch: 2, title: '金丹大道', icon: '🟡', desc: '突破至【金丹境】。',
      tip: '', goal: (s) => s.realm >= 2, reward: { jade: 22, free: 'all' } },

    /* ── 第三章 · 神通初成 ── */
    { id: 'q15', ch: 3, title: '神通入体', icon: '✨', desc: '装备 1 门神通，并在战斗中释放一次。',
      tip: '战斗中灵力攒满即可释放神通。', goal: (s) => (s.stats.skillsUsed || 0) >= 1, reward: { jade: 12, free: 'atk' } },
    { id: 'q16', ch: 3, title: '洞天小成', icon: '⛰', desc: '洞天建筑总等级达到 20。',
      tip: '', goal: (s) => Object.values(s.buildings).reduce((a, b) => a + b, 0) >= 20, reward: { jade: 15, free: 'spirit' } },
    { id: 'q17', ch: 3, title: '御兽之术', icon: '🐾', desc: '拥有 3 只灵宠，且全部升至 10 级。',
      tip: '', goal: (s) => s.pets.owned.length >= 3 && s.pets.owned.filter(id => s.pets.data[id] && s.pets.data[id].lv >= 10).length >= 3, reward: { jade: 18, free: 'all' } },
    { id: 'q18', ch: 3, title: '镶嵌宝石', icon: '💠', desc: '在装备上镶嵌 2 颗宝石。',
      tip: '品质越高的装备孔位越多。', goal: (s) => XG.Forge.gemCount() >= 2, reward: { jade: 15, gem: { tier: 2, n: 2 } } },
    { id: 'q19', ch: 3, title: '屠戮妖王', icon: '👑', desc: '击败 10 只妖王。',
      tip: '妖王必掉材料与仙玉。', goal: (s) => s.stats.bossKills >= 10, reward: { jade: 25, equip: { q: 3 } } },
    { id: 'q20', ch: 3, title: '元婴出窍', icon: '👶', desc: '突破至【元婴境】。',
      tip: '', goal: (s) => s.realm >= 3, reward: { jade: 35, free: 'all' } },

    /* ── 第四章 · 化神炼虚 ── */
    { id: 'q21', ch: 4, title: '一身玄装', icon: '🎽', desc: '四个部位全部装备宝品（绿）以上。',
      tip: '', goal: (s) => XG.SLOTS.every(sl => s.equip[sl.id] && s.equip[sl.id].q >= 2), reward: { jade: 30, free: 'atk' } },
    { id: 'q22', ch: 4, title: '塔上二十', icon: '🏯', desc: '通天塔到达第 20 层。',
      tip: '', goal: (s) => s.tower.best >= 20, reward: { jade: 40, equip: { q: 4 } } },
    { id: 'q23', ch: 4, title: '玄品现世', icon: '🟦', desc: '合成出 1 件玄品（蓝）装备。',
      tip: '合成升品是获得高品装备最稳的途径。', goal: (s) => (s.stats.q3Made || 0) >= 1, reward: { jade: 35, gem: { tier: 3, n: 2 } } },
    { id: 'q24', ch: 4, title: '化神一念', icon: '🌟', desc: '突破至【化神境】。',
      tip: '', goal: (s) => s.realm >= 4, reward: { jade: 55, free: 'all' } },
    { id: 'q25', ch: 4, title: '炼虚合道', icon: '🌌', desc: '突破至【炼虚境】。',
      tip: '', goal: (s) => s.realm >= 5, reward: { jade: 80, free: 'all' } },

    /* ── 第五章 · 大乘飞升 ── */
    { id: 'q26', ch: 5, title: '天人合一', icon: '☯', desc: '突破至【合体境】。',
      tip: '', goal: (s) => s.realm >= 6, reward: { jade: 120, free: 'all' } },
    { id: 'q27', ch: 5, title: '塔过三十', icon: '🌠', desc: '通天塔到达第 30 层。',
      tip: '', goal: (s) => s.tower.best >= 30, reward: { jade: 100, equip: { q: 5 } } },
    { id: 'q28', ch: 5, title: '千锤百炼', icon: '🔨', desc: '装备强化累计 20 次。',
      tip: '强化消耗灵石，成功率随等级下降。', goal: (s) => (s.stats.enhances || 0) >= 20, reward: { jade: 90, free: 'all' } },
    { id: 'q29', ch: 5, title: '大乘无量', icon: '🔆', desc: '突破至【大乘境】，获得飞升资格。',
      tip: '', goal: (s) => s.realm >= 7, reward: { jade: 200, free: 'all' } },
    { id: 'q30', ch: 5, title: '斩妖万头', icon: '💀', desc: '累计击败 10000 只妖兽。',
      tip: '', goal: (s) => s.stats.kills >= 10000, reward: { jade: 150, free: 'atk' } },

    /* ── 第六章 · 轮回再世 ── */
    { id: 'q31', ch: 6, title: '斩断因果', icon: '🌀', desc: '完成第一次飞升转生。',
      tip: '飞升保留仙缘、道果、灵宠、宝石与锻炉积累。', goal: (s) => s.prestige.times >= 1, reward: { jade: 60, free: 'all' } },
    { id: 'q32', ch: 6, title: '再登大道', icon: '🔁', desc: '飞升后重新修至【金丹境】。',
      tip: '仙缘加成会让第二轮快得多。', goal: (s) => s.prestige.times >= 1 && s.realm >= 2, reward: { jade: 80, free: 'all' } },
    { id: 'q33', ch: 6, title: '法宝满身', icon: '💍', desc: '宝石镶嵌总数达到 8 颗。',
      tip: '', goal: (s) => XG.Forge.gemCount() >= 8, reward: { jade: 120, gem: { tier: 4, n: 2 } } },
    { id: 'q34', ch: 6, title: '塔顶望月', icon: '🌙', desc: '通天塔到达第 45 层。',
      tip: '', goal: (s) => s.tower.best >= 45, reward: { jade: 220, equip: { q: 6 } } },
    { id: 'q35', ch: 6, title: '轮回三次', icon: '♾', desc: '累计飞升 3 次。',
      tip: '', goal: (s) => s.prestige.times >= 3, reward: { jade: 400, free: 'all' } },
    { id: 'q36', ch: 6, title: '大道归真', icon: '🌌', desc: '踏上【大罗境】，道果圆满。',
      tip: '', goal: (s) => s.realm >= 12, reward: { jade: 888, free: 'all' } },
  ];

  /* ═════════════════════════════════════════
     六、秘境随机遭遇
     每次结算有小概率触发，替代普通战斗
     ═════════════════════════════════════════ */
  const ZONE_EVENTS = [
    {
      id: 'ze_treasure', name: '上古宝箱', icon: '🎁', w: 9, kind: 'gain',
      text: '一具半掩在土中的古朴石箱映入眼帘。',
      run: (z, api) => {
        const stone = XG.baseAtkAt(z.refR) * 6 * (1 + z.index * 0.2) * api.mods().stoneGain;
        api.gainStone(stone);
        let extra = '';
        if (U.chance(0.34)) { const eq = api.dropEquip(0.30, '秘境宝箱'); extra = `，${U.QUALITY[eq.q].name}「${eq.name}」`; }
        else if (U.chance(0.5)) { const j = U.rndInt(2, 6); api.gainJade(j); extra = `，仙玉 +${j}`; }
        return `开启石箱：灵石 +${U.fmt(stone)}${extra}`;
      },
    },
    {
      id: 'ze_spring', name: '秘境灵泉', icon: '⛲', w: 8, kind: 'gain',
      text: '一泓清泉自石缝涌出，泉眼处灵气浓郁如雾。',
      run: (z, api) => {
        const sp = XG.R.need(api.state.realm, api.state.layer) * U.rnd(0.5, 1.2);
        api.gainSpirit(sp);
        api.heal();
        return `痛饮灵泉：灵气 +${U.fmt(sp)}，伤势尽复`;
      },
    },
    {
      id: 'ze_insight', name: '悟道石', icon: '🗿', w: 5, kind: 'gain',
      text: '一方无字石碑静立，观之竟令心神空明。',
      run: (z, api) => {
        const r = Math.random();
        if (r < 0.45) { api.gainSpirit(XG.R.need(api.state.realm, api.state.layer) * U.rnd(1.2, 2.4)); return '面壁顿悟：灵气大涨！'; }
        if (r < 0.8) { api.permanentBonus('spirit', 0.02); return '参悟天道：永久 +2% 灵气/秒'; }
        api.permanentBonus('all', 0.01);
        return '窥见道则：永久 +1% 全属性';
      },
    },
    {
      id: 'ze_gem', name: '宝石矿脉', icon: '💎', w: 6, kind: 'gain',
      text: '岩壁中嵌着点点流光，分明是一条宝石矿脉。',
      run: (z, api) => {
        const tier = U.clamp(1 + Math.floor(z.index / 6), 1, GEM_MAX_TIER);
        const n = U.rndInt(1, 3);
        const names = api.gainGem(tier, n);
        return `采得 ${names}（${tier} 阶）`;
      },
    },
    {
      id: 'ze_herb', name: '灵草园', icon: '🌿', w: 9, kind: 'gain',
      text: '一片野生灵草长势喜人，药香扑鼻。',
      run: (z, api) => {
        const amt = Math.floor(U.rnd(60, 260) * (1 + z.index * 0.5) * (1 + api.mods().herbGain));
        api.gainHerb(amt);
        return `采得灵草 +${U.fmt(amt)}`;
      },
    },
    {
      id: 'ze_trap', name: '禁制陷阱', icon: '💥', w: 8, kind: 'bad',
      text: '脚下符文骤然亮起——是上古禁制！',
      run: (z, api) => {
        const l = XG.R.need(api.state.realm, api.state.layer) * U.rnd(0.08, 0.2);
        api.loseSpirit(l);
        return `禁制爆发，你狼狈脱身，灵气 −${U.fmt(l)}`;
      },
    },
    {
      id: 'ze_merchant', name: '游方商人', icon: '🧳', w: 6, kind: 'gain',
      text: '一名游方商人从雾中走出：「道友，看看货？」',
      run: (z, api) => {
        const tier = U.clamp(1 + Math.floor(z.index / 8), 1, GEM_MAX_TIER);
        const names = api.gainGem(tier, 1);
        const j = U.rndInt(3, 9);
        api.gainJade(j);
        return `购得 ${names}，另赠仙玉 +${j}`;
      },
    },
    {
      id: 'ze_elite', name: '精英妖兽', icon: '👹', w: 10, kind: 'battle',
      text: '一头煞气冲霄的精英妖兽缓缓转身，锁定了你。',
      run: () => '精英妖兽袭来！',
    },
  ];

  /* ═════════════════════════════════════════
     七、天象（周期性全局效果）
     ═════════════════════════════════════════ */
  const OMENS = [
    { id: 'o_lingchao', name: '灵气潮汐', icon: '🌊', w: 12, dur: 420, good: true, desc: '灵气/秒 +55%', mods: { spirit: 1.55 } },
    { id: 'o_xingchen', name: '星辰垂芒', icon: '✨', w: 12, dur: 420, good: true, desc: '灵石获取 +80%', mods: { stoneGain: 1.80 } },
    { id: 'o_daoyun', name: '道韵流转', icon: '☯', w: 9, dur: 420, good: true, desc: '突破成功率 +15%', mods: { breakBonus: 0.15 } },
    { id: 'o_tianlei', name: '天雷淬体', icon: '⚡', w: 9, dur: 420, good: true, desc: '战斗掉落率 ×2', mods: { dropRate: 2 } },
    { id: 'o_xuesha', name: '血煞冲霄', icon: '🩸', w: 8, dur: 420, good: true, desc: '攻击 ×1.6，但灵气 −20%', mods: { atk: 1.60, spirit: 0.80 } },
    { id: 'o_jinji', name: '仙缘汇聚', icon: '✦', w: 6, dur: 420, good: true, desc: '仙玉掉落 ×2', mods: { jadeRate: 2 } },
    { id: 'o_wuqing', name: '天道无情', icon: '🌫', w: 7, dur: 300, good: false, desc: '灵气/秒 −35%', mods: { spirit: 0.65 } },
    { id: 'o_zhensha', name: '煞气弥漫', icon: '💀', w: 6, dur: 300, good: false, desc: '秘境与塔中妖敌变强', mods: { enemyPower: 1.25 } },
  ];
  /* 天象间隔远大于持续时间，使其成为「偶发机缘」而非常驻增益 */
  const OMEN_INTERVAL = 900;

  /* ═════════════════════════════════════════
     八、寻宝阁（抽卡）
     ═════════════════════════════════════════ */
  const GACHA_POOLS = {
    art: {
      id: 'art', name: '问道池', icon: '📜', color: '#8ad8ff',
      desc: '自万千道藏中随机领悟一门未习得的功法。',
      cur: 'jade', cost: 14, cost10: 120,
      pity: { n: 10, type: 'quality', minQ: 2, label: '每 10 抽必得灵品以上' },
    },
    equip: {
      id: 'equip', name: '寻宝池', icon: '🗡', color: '#ffe066',
      desc: '搜寻散落各界的法宝神兵，品阶更高、词条更佳。',
      cur: 'jade', cost: 16, cost10: 140,
      pity: { n: 20, type: 'quality', minQ: 3, label: '每 20 抽必得玄品以上' },
    },
    pet: {
      id: 'pet', name: '御兽池', icon: '🐾', color: '#7ee08a',
      desc: '呼唤山林间的灵兽，有缘者自会相随。',
      cur: 'jade', cost: 22, cost10: 190,
      pity: { n: 15, type: 'unowned', label: '每 15 抽必得未拥有的灵宠' },
    },
    mat: {
      id: 'mat', name: '采药池', icon: '🌿', color: '#b18cff',
      desc: '遍访灵山，采撷灵草、灵材与宝石。',
      cur: 'stone', costFactor: 40, cost10Factor: 350,
      pity: { n: 10, type: 'gem', tierBonus: 1, label: '每 10 抽必得宝石' },
    },
  };

  /* ═════════════════════════════════════════
     九、装备强化 / 合成参数
     ═════════════════════════════════════════ */
  const FORGE_CFG = {
    ENHANCE_MAX: 15,
    enhanceChance: lv => U.clamp(0.95 - lv * 0.05, 0.28, 1),
    enhanceCost: (eq, lv) => eq.score * (2.5 + lv * 1.9) * 40,
    enhanceStatMul: lv => 1 + lv * 0.10,
    MERGE_COUNT: 3,                 // 三合一
    REROLL_COST: eq => eq.score * 60,
  };

  XG.STANCES = STANCES;
  XG.SKILLS = SKILLS;
  XG.ENEMY_SKILLS = ENEMY_SKILLS;
  XG.GEMS = GEMS;
  XG.GEM_TIER_MULT = GEM_TIER_MULT;
  XG.GEM_MAX_TIER = GEM_MAX_TIER;
  XG.SETS = SETS;
  XG.QUESTS = QUESTS;
  XG.ZONE_EVENTS = ZONE_EVENTS;
  XG.OMENS = OMENS;
  XG.OMEN_INTERVAL = OMEN_INTERVAL;
  XG.GACHA_POOLS = GACHA_POOLS;
  XG.GACHA = {
    get artCost() { return GACHA_POOLS.art.cost; },
    set artCost(value) { GACHA_POOLS.art.cost = value; },
    get artCost10() { return GACHA_POOLS.art.cost10; },
    set artCost10(value) { GACHA_POOLS.art.cost10 = value; },
    get equipCost() { return GACHA_POOLS.equip.cost; },
    set equipCost(value) { GACHA_POOLS.equip.cost = value; },
  };
  XG.FORGE_CFG = FORGE_CFG;

  XG.idx.skill = Object.fromEntries(SKILLS.map(s => [s.id, s]));
  XG.idx.gem = Object.fromEntries(GEMS.map(g => [g.id, g]));
  XG.idx.quest = Object.fromEntries(QUESTS.map(q => [q.id, q]));
  XG.idx.stance = Object.fromEntries(STANCES.map(s => [s.id, s]));
})();

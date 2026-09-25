/* ═══════════════════════════════════════════
   content.js — 内容数据表
   功法 / 洞天 / 丹药 / 装备 / 灵宠 / 秘境妖兽 / 奇遇 / 成就
   ═══════════════════════════════════════════ */
(function () {
  'use strict';
  const XG = window.XG;
  const U = XG.U;

  /* ═════════════════════════════════════════
     一、功法（Arts）
     type: mind 心法(修炼) / atk 攻伐 / body 护体 / agile 身法
     eff : 每级加成（加算进同类总倍率）
     ═════════════════════════════════════════ */
  const ART_TYPE = {
    mind: { name: '心法', tag: '修炼速度', icon: '☯' },
    atk: { name: '攻伐', tag: '攻击强度', icon: '⚔' },
    body: { name: '护体', tag: '气血防御', icon: '🛡' },
    agile: { name: '身法', tag: '速度闪避', icon: '💨' },
  };

  const ARTS = [
    /* ── 心法 ── */
    { id: 'a_yinqi', type: 'mind', name: '引气诀', q: 0, eff: 0.06, costBase: 40, desc: '最基础的吐纳之法，凡人亦可修习。', lore: '万道之始，不过一呼一吸。' },
    { id: 'a_zixia', type: 'mind', name: '紫霞神功', q: 1, eff: 0.09, costBase: 260, desc: '引朝霞紫气入体，温养经脉。', lore: '紫气东来，三万里如龙。' },
    { id: 'a_xuanbing', type: 'mind', name: '玄冰诀', q: 2, eff: 0.13, costBase: 2600, desc: '以玄冰之气淬炼灵力，心境澄明。', lore: '心若冰清，天塌不惊。' },
    { id: 'a_wuji', type: 'mind', name: '无极心经', q: 3, eff: 0.18, costBase: 26000, desc: '太极无极，周流不息，灵气自生。', lore: '无极生太极，太极生两仪。' },
    { id: 'a_hundun', type: 'mind', name: '浑天宝鉴', q: 4, eff: 0.25, costBase: 260000, desc: '上古残卷，可窥天地初开之秘。', lore: '混沌未分，一气化三清。' },
    { id: 'a_dadao', type: 'mind', name: '大道真解', q: 5, eff: 0.36, costBase: 3.2e6, desc: '直指大道本源的无上心法。', lore: '道可道，非常道。' },
    { id: 'a_xianji', type: 'mind', name: '仙机造化诀', q: 6, eff: 0.55, costBase: 4e7, desc: '仙人所传，夺天地之造化。', lore: '一念可造万物，一念可灭苍生。' },

    /* ── 攻伐 ── */
    { id: 'a_lieyan', type: 'atk', name: '烈焰掌', q: 0, eff: 0.07, costBase: 50, desc: '掌心凝火，掌出如焚。', lore: '烈火燎原，寸草不生。' },
    { id: 'a_jin Gang', type: 'atk', name: '金刚伏魔拳', q: 1, eff: 0.10, costBase: 300, desc: '拳意刚猛，专破妖邪。', lore: '金刚怒目，降伏四魔。' },
    { id: 'a_qinglian', type: 'atk', name: '青莲剑歌', q: 2, eff: 0.15, costBase: 3000, desc: '剑如青莲绽放，一花一世界。', lore: '十步杀一人，千里不留行。' },
    { id: 'a_zhuxian', type: 'atk', name: '诛仙剑意', q: 3, eff: 0.21, costBase: 30000, desc: '剑意一出，仙神辟易。', lore: '剑来！' },
    { id: 'a_fentian', type: 'atk', name: '焚天战决', q: 4, eff: 0.30, costBase: 3e5, desc: '战意焚天，战力倍增。', lore: '一怒焚天，血流漂橹。' },
    { id: 'a_hongmeng', type: 'atk', name: '鸿蒙破虚斩', q: 5, eff: 0.44, costBase: 3.6e6, desc: '斩开虚空的一刀，无人可挡。', lore: '鸿蒙初开，一斩分天地。' },
    { id: 'a_zhutian', type: 'atk', name: '诸天万剑诀', q: 6, eff: 0.66, costBase: 4.5e7, desc: '御诸天万剑，剑雨覆天。', lore: '剑落如雨，众生俯首。' },

    /* ── 护体 ── */
    { id: 'a_tiebu', type: 'body', name: '铁布衫', q: 0, eff: 0.08, costBase: 45, desc: '外家横练功夫，皮糙肉厚。', lore: '刀枪不入，水火不侵。' },
    { id: 'a_guizang', type: 'body', name: '龟藏术', q: 1, eff: 0.11, costBase: 280, desc: '敛息藏形，气血如龟寿长。', lore: '藏于九地之下，动于九天之上。' },
    { id: 'a_bujin', type: 'body', name: '不灭金身', q: 2, eff: 0.16, costBase: 2800, desc: '肉身如金铁铸成，难伤分毫。', lore: '金身不灭，万法不侵。' },
    { id: 'a_taixu', type: 'body', name: '太虚炼体诀', q: 3, eff: 0.23, costBase: 28000, desc: '以太虚之力炼体，化虚为实。', lore: '虚己以游世，其孰能害之。' },
    { id: 'a_shenmo', type: 'body', name: '神魔霸体', q: 4, eff: 0.32, costBase: 2.8e5, desc: '神魔之血淬体，肉身成圣。', lore: '神魔一体，我行我道。' },
    { id: 'a_hunyuan', type: 'body', name: '混元圣体', q: 5, eff: 0.47, costBase: 3.4e6, desc: '混元一气，护体不破。', lore: '一气混元，天地同寿。' },
    { id: 'a_wujian', type: 'body', name: '无相劫体', q: 6, eff: 0.70, costBase: 4.2e7, desc: '身如劫云，触之即灭。', lore: '无相无形，劫灭苍生。' },

    /* ── 身法 ── */
    { id: 'a_qinggong', type: 'agile', name: '轻身术', q: 0, eff: 0.07, costBase: 45, desc: '踏叶而行，身轻如燕。', lore: '身轻一鸟过，枪急万人呼。' },
    { id: 'a_lingbo', type: 'agile', name: '凌波微步', q: 1, eff: 0.10, costBase: 270, desc: '步法凌波，敌手难触其衣角。', lore: '凌波微步，罗袜生尘。' },
    { id: 'a_yufeng', type: 'agile', name: '御风诀', q: 2, eff: 0.14, costBase: 2700, desc: '御风而行，快若流光。', lore: '御风而行，泠然善也。' },
    { id: 'a_dunxu', type: 'agile', name: '遁虚步', q: 3, eff: 0.20, costBase: 27000, desc: '一步遁入虚空，无从追踪。', lore: '虚步而行，不留痕迹。' },
    { id: 'a_liuguang', type: 'agile', name: '流光遁影', q: 4, eff: 0.28, costBase: 2.7e5, desc: '快过流光，先发制人。', lore: '流光易逝，我自长存。' },
    { id: 'a_xingyi', type: 'agile', name: '星辰挪移', q: 5, eff: 0.42, costBase: 3.3e6, desc: '挪移星辰之位，一步千里。', lore: '星移斗转，一念之间。' },
    { id: 'a_wuxing', type: 'agile', name: '无相天遁', q: 6, eff: 0.62, costBase: 4e7, desc: '无相无迹，天遁之术。', lore: '遁去其一，天道难寻。' },
  ];

  /* ═════════════════════════════════════════
     二、洞天福地（建筑）
     ═════════════════════════════════════════ */
  const BUILDINGS = [
    {
      id: 'b_array', name: '聚灵阵', icon: '🔯', costBase: 30, costGrow: 1.27,
      unlock: { realm: 0, layer: 1 },
      desc: '汇聚天地灵气的法阵，等级越高灵气越浓郁。',
      effect: lv => '灵气/秒 ×' + (1 + 0.30 * lv).toFixed(2),
      calc: lv => 1 + 0.30 * lv,
    },
    {
      id: 'b_farm', name: '灵田', icon: '🌱', costBase: 120, costGrow: 1.30,
      unlock: { realm: 0, layer: 3 },
      desc: '开垦灵田种植灵草，是丹道的根基。',
      effect: lv => '灵草 +' + (0.35 * lv).toFixed(2) + '/秒',
      herbRate: lv => 0.35 * lv,
    },
    {
      id: 'b_library', name: '藏经阁', icon: '📚', costBase: 400, costGrow: 1.32,
      unlock: { realm: 0, layer: 6 },
      desc: '万千典籍藏于此，可参悟功法真意。',
      effect: lv => '功法修习消耗 −' + Math.min(70, 3 * lv) + '% ｜ 功法上限 +' + lv,
      artCostCut: lv => Math.min(0.70, 0.03 * lv),
      artLvBonus: lv => lv,
    },
    {
      id: 'b_furnace', name: '炼丹房', icon: '⚗', costBase: 900, costGrow: 1.30,
      unlock: { realm: 1, layer: 1 },
      desc: '三昧真火不熄，丹药之效倍增。',
      effect: lv => '丹药效果 +' + (12 * lv) + '% ｜ 成丹率 +' + Math.min(30, 2 * lv) + '%',
      pillPower: lv => 1 + 0.12 * lv,
      pillSuccess: lv => Math.min(0.30, 0.02 * lv),
    },
    {
      id: 'b_forge', name: '炼器室', icon: '🔨', costBase: 1600, costGrow: 1.31,
      unlock: { realm: 1, layer: 4 },
      desc: '以真火锻打灵材，法宝威能大涨。',
      effect: lv => '装备属性 +' + (10 * lv) + '%',
      equipPower: lv => 1 + 0.10 * lv,
    },
    {
      id: 'b_treasury', name: '聚宝盆', icon: '💰', costBase: 2200, costGrow: 1.30,
      unlock: { realm: 1, layer: 7 },
      desc: '可源源不断吸纳天地财气。',
      effect: lv => '灵石获取 +' + (20 * lv) + '%',
      stoneGain: lv => 1 + 0.20 * lv,
    },
    {
      id: 'b_barrier', name: '护山大阵', icon: '🛡', costBase: 4000, costGrow: 1.31,
      unlock: { realm: 2, layer: 1 },
      desc: '以山川为阵眼，守御外敌。',
      effect: lv => '防御 +' + (15 * lv) + '% ｜ 气血 +' + (10 * lv) + '%',
      defMult: lv => 1 + 0.15 * lv,
      hpMult: lv => 1 + 0.10 * lv,
    },
    {
      id: 'b_garden', name: '灵兽园', icon: '🐾', costBase: 6000, costGrow: 1.33,
      unlock: { realm: 2, layer: 4 },
      desc: '畜养灵兽之所，可容纳更多灵宠。',
      effect: lv => '灵宠栏位 ' + (1 + Math.floor(lv / 2)) + ' ｜ 灵宠效果 +' + (8 * lv) + '%',
      petSlots: lv => 1 + Math.floor(lv / 2),
      petPower: lv => 1 + 0.08 * lv,
    },
    {
      id: 'b_altar', name: '悟道台', icon: '🌀', costBase: 12000, costGrow: 1.34,
      unlock: { realm: 3, layer: 1 },
      desc: '静坐悟道，可提升突破成功率。',
      effect: lv => '突破成功率 +' + Math.min(25, 1 * lv) + '% ｜ 仙玉 +' + (0.02 * lv).toFixed(2) + '/秒',
      breakBonus: lv => Math.min(0.25, 0.01 * lv),
      jadeRate: lv => 0.02 * lv,
    },
    {
      id: 'b_spring', name: '灵泉', icon: '⛲', costBase: 30000, costGrow: 1.33,
      unlock: { realm: 4, layer: 1 },
      desc: '万年灵泉，洗髓伐骨，延年益寿。',
      effect: lv => '灵气/秒 ×' + (1 + 0.45 * lv).toFixed(2) + ' ｜ 气血 +' + (15 * lv) + '%',
      calc: lv => 1 + 0.45 * lv,
      hpMult: lv => 1 + 0.15 * lv,
    },
    {
      id: 'b_tiandao', name: '天道碑', icon: '🗿', costBase: 8e4, costGrow: 1.35,
      unlock: { realm: 5, layer: 1 },
      desc: '铭刻天道法则的石碑，参悟可加速修行。',
      effect: lv => '灵气/秒 ×' + (1 + 0.60 * lv).toFixed(2) + ' ｜ 仙玉 +' + (0.1 * lv).toFixed(2) + '/秒',
      calc: lv => 1 + 0.60 * lv,
      jadeRate: lv => 0.10 * lv,
    },
  ];

  /* ═════════════════════════════════════════
     三、材料
     ═════════════════════════════════════════ */
  const MATS = [
    { id: 'm_core', name: '妖兽内丹', icon: '🔴', q: 1, desc: '妖兽精华所聚，炼丹炼器皆可用。', value: 40 },
    { id: 'm_iron', name: '玄铁', icon: '⬛', q: 2, desc: '千年寒铁，坚不可摧。', value: 260 },
    { id: 'm_jade', name: '玉髓', icon: '🔷', q: 2, desc: '灵玉之精，蕴含精纯灵力。', value: 320 },
    { id: 'm_star', name: '星辰砂', icon: '✨', q: 3, desc: '自天外坠落，炼制法宝的稀有材料。', value: 2400 },
    { id: 'm_dragon', name: '龙鳞', icon: '🐉', q: 4, desc: '真龙之鳞，护体无双。', value: 18000 },
    { id: 'm_phoenix', name: '凤羽', icon: '🔥', q: 4, desc: '凤凰涅槃之羽，蕴含不死火。', value: 22000 },
    { id: 'm_chaos', name: '混沌石', icon: '🌑', q: 5, desc: '开天辟地时遗留的混沌物质。', value: 2.6e5 },
    { id: 'm_immortal', name: '仙灵石', icon: '💠', q: 6, desc: '仙人所用之石，凡间难得一见。', value: 3.2e6 },
  ];

  /* ═════════════════════════════════════════
     四、丹药（Pills）
     kind: instant 立即生效 / buff 限时增益 / perm 永久
     ═════════════════════════════════════════ */
  const PILLS = [
    {
      id: 'p_juqi', name: '聚气丹', icon: '🟢', q: 0, kind: 'instant', unlock: 1,
      battleUsable: true, battleEffect: { type: 'heal', pct: 0.35 },
      desc: '服下后立即吸纳大量灵气，可省去数日苦修。',
      cost: { herb: 12, stone: 30 },
      effect: (s, power) => Math.max(10, XG.R.need(s.realm, s.layer) * 0.45 * power),
      effectText: () => '立即获得当前层所需约 45% 的灵气',
    },
    {
      id: 'p_ningshen', name: '凝神丹', icon: '🔵', q: 1, kind: 'buff', dur: 60, unlock: 1,
      battleUsable: false, battleEffect: null,
      desc: '凝神静气，短时间内修行速度暴涨。',
      cost: { herb: 45, stone: 240 },
      buffMult: power => 3 * power,
      effectText: power => '60 秒内修炼速度 ×' + (3 * power).toFixed(2),
    },
    {
      id: 'p_pojing', name: '破境丹', icon: '🟣', q: 2, kind: 'buffCharge', dur: 300, unlock: 2,
      battleUsable: true, battleEffect: { type: 'defense', rounds: 4, taken: 0.82 },
      desc: '专为破境而炼，可大幅提升突破成功率。',
      cost: { herb: 160, stone: 1800, mat: { m_core: 3 } },
      breakBonus: power => Math.min(0.45, 0.18 * power),
      effectText: power => '5 分钟内突破成功率 +' + Math.round(Math.min(45, 18 * power)) + '%',
    },
    {
      id: 'p_cuiti', name: '淬体丹', icon: '🟠', q: 2, kind: 'buffStat', dur: 300, unlock: 2,
      battleUsable: true, battleEffect: { type: 'stat', rounds: 6 },
      desc: '淬炼肉身，战斗威能大增。',
      cost: { herb: 140, stone: 1500, mat: { m_iron: 2 } },
      stat: { atk: 0.6, hp: 0.5 },
      effectText: power => '5 分钟内 攻击 +' + Math.round(60 * power) + '% ｜ 气血 +' + Math.round(50 * power) + '%',
    },
    {
      id: 'p_xisui', name: '洗髓丹', icon: '🟡', q: 3, kind: 'perm', unlock: 3,
      battleUsable: false, battleEffect: null,
      desc: '洗尽凡俗杂质，永久提升修行资质。每次服用效果递减。',
      cost: { herb: 600, stone: 12000, mat: { m_jade: 4 } },
      permKind: 'spirit', permPoints: 1,
      effectText: () => '永久 +5% 灵气/秒（收益递减，可无限叠加）',
    },
    {
      id: 'p_jiuzhuan', name: '九转金丹', icon: '🟠', q: 4, kind: 'perm', unlock: 4,
      battleUsable: false, battleEffect: null,
      desc: '九转九炼而成的仙丹，服之脱胎换骨。',
      cost: { herb: 2400, stone: 9e4, mat: { m_star: 5, m_dragon: 1 } },
      permKind: 'all', permPoints: 1,
      effectText: () => '永久 +8% 全属性（收益递减，可无限叠加）',
    },
    {
      id: 'p_taixu', name: '太虚神丹', icon: '⚪', q: 5, kind: 'perm', unlock: 5,
      battleUsable: false, battleEffect: null,
      desc: '传说中太虚道人留下的神丹，一枚可抵百年苦修。',
      cost: { herb: 9000, stone: 8e5, mat: { m_chaos: 4, m_phoenix: 2 } },
      permKind: 'spirit', permPoints: 7,
      effectText: () => '永久 +35% 灵气/秒（收益递减，可无限叠加）',
    },
    {
      id: 'p_xianling', name: '仙灵圣丹', icon: '💫', q: 6, kind: 'perm', unlock: 6,
      battleUsable: false, battleEffect: null,
      desc: '以仙灵石为引炼成的圣丹，可窥仙途。',
      cost: { herb: 4e4, stone: 1.2e7, mat: { m_immortal: 3, m_chaos: 10 } },
      permKind: 'all', permPoints: 3,
      effectText: () => '永久 +25% 全属性（收益递减，可无限叠加）',
    },
  ];

  /* ═════════════════════════════════════════
     五、装备
     ═════════════════════════════════════════ */
  const SLOTS = [
    { id: 'weapon', name: '兵器', icon: '🗡' },
    { id: 'armor', name: '护甲', icon: '🥋' },
    { id: 'talisman', name: '法宝', icon: '🔮' },
    { id: 'ring', name: '灵饰', icon: '💍' },
  ];

  const EQUIP_NAMES = {
    weapon: {
      0: ['凡人铁剑', '青锋剑', '柴刀', '猎弓'],
      1: ['寒霜剑', '流云枪', '裂石锤', '紫竹箫'],
      2: ['玄冰长剑', '赤炎刀', '九节鞭', '碧水剑'],
      3: ['屠龙刀', '裂天戟', '青莲剑', '落霞弓'],
      4: ['诛仙剑', '弑神枪', '焚天刃', '太虚钟'],
      5: ['鸿蒙神剑', '诸天万剑', '混沌戟', '造化轮回刃'],
      6: ['斩道之刃', '一念化仙剑', '天道劫剑', '虚无之锋'],
    },
    armor: {
      0: ['粗布道袍', '皮甲', '蓑衣'],
      1: ['灵蚕宝衣', '玄铁甲', '青云袍'],
      2: ['冰蚕丝甲', '赤炎战甲', '水云袍'],
      3: ['太乙玄甲', '龙鳞宝甲', '紫霞仙衣'],
      4: ['神魔战铠', '不灭金身甲', '焚天羽衣'],
      5: ['混沌战甲', '混元圣衣', '星辰法袍'],
      6: ['无相劫衣', '大道仙袍', '造化天衣'],
    },
    talisman: {
      0: ['粗制灵符', '铜铃', '桃木剑'],
      1: ['聚灵珠', '八卦镜', '镇魂铃'],
      2: ['玄冰玉符', '赤炎珠', '水灵幡'],
      3: ['太乙玉册', '山河社稷图', '落宝金钱'],
      4: ['乾坤鼎', '诛仙阵图', '焚天印'],
      5: ['混元金斗', '鸿蒙量天尺', '造化玉牒'],
      6: ['大道天书', '轮回镜', '天道法印'],
    },
    ring: {
      0: ['木簪', '铜环', '素银戒'],
      1: ['灵玉镯', '青玉戒', '流苏坠'],
      2: ['玄冰指环', '赤炎佩', '水魄珠'],
      3: ['太乙玉环', '须弥戒', '落霞珠'],
      4: ['神魔血戒', '不灭玉玺', '焚天玉佩'],
      5: ['混沌灵珠', '混元环', '星辰戒'],
      6: ['无相天珠', '大道戒', '仙灵圣佩'],
    },
  };

  const AFFIX = [
    { key: 'atk', name: '攻击', fmt: v => '+' + Math.round(v * 100) + '%' },
    { key: 'def', name: '防御', fmt: v => '+' + Math.round(v * 100) + '%' },
    { key: 'hp', name: '气血', fmt: v => '+' + Math.round(v * 100) + '%' },
    { key: 'crit', name: '暴击', fmt: v => '+' + (v * 100).toFixed(1) + '%' },
    { key: 'critDmg', name: '爆伤', fmt: v => '+' + Math.round(v * 100) + '%' },
    { key: 'dodge', name: '闪避', fmt: v => '+' + (v * 100).toFixed(1) + '%' },
    { key: 'spd', name: '速度', fmt: v => '+' + (v * 100).toFixed(1) + '%' },
    { key: 'lifesteal', name: '吸血', fmt: v => '+' + (v * 100).toFixed(1) + '%' },
    { key: 'pen', name: '穿透', fmt: v => '+' + (v * 100).toFixed(1) + '%' },
    { key: 'spirit', name: '修炼', fmt: v => '+' + (v * 100).toFixed(1) + '%' },
  ];

  /* ═════════════════════════════════════════
     六、灵宠
     ═════════════════════════════════════════
     bonus: 每级提供的加成（key 同 AFFIX + spirit/stoneGain/herbGain）
     ═════════════════════════════════════════ */
  const PETS = [
    { id: 'pet_fox', name: '九尾灵狐', icon: '🦊', q: 2, desc: '生于青丘，善媚术，助宿主暴击。', bonus: { crit: 0.006, critDmg: 0.012 } },
    { id: 'pet_turtle', name: '玄冥灵龟', icon: '🐢', q: 2, desc: '寿逾万载，甲壳坚不可摧。', bonus: { hp: 0.010, def: 0.009 } },
    { id: 'pet_firebird', name: '赤炎凤雏', icon: '🔥', q: 3, desc: '涅槃之焰所生，灼烧万物。', bonus: { atk: 0.011, pen: 0.004 } },
    { id: 'pet_white', name: '白泽幼兽', icon: '🦌', q: 3, desc: '通晓万物之情，助人悟道。', bonus: { spirit: 0.013 } },
    { id: 'pet_kunpeng', name: '鲲鹏', icon: '🐦', q: 4, desc: '扶摇直上九万里，迅捷无匹。', bonus: { spd: 0.008, dodge: 0.006 } },
    { id: 'pet_qilin', name: '瑞兽麒麟', icon: '🦄', q: 4, desc: '祥瑞之兽，福泽绵长。', bonus: { atk: 0.008, hp: 0.008, def: 0.008, spirit: 0.008 } },
    { id: 'pet_taotie', name: '饕餮', icon: '👹', q: 5, desc: '吞噬万物，为主人敛财。', bonus: { stoneGain: 0.016, lifesteal: 0.003 } },
    { id: 'pet_dragon', name: '九天应龙', icon: '🐉', q: 5, desc: '真龙血脉，执掌九天雷霆。', bonus: { atk: 0.014, crit: 0.004, hp: 0.010 } },
    { id: 'pet_chaos', name: '混沌凶兽', icon: '🌑', q: 6, desc: '开天之前的凶物，力量无匹。', bonus: { atk: 0.020, hp: 0.016, def: 0.014, crit: 0.006, spirit: 0.012 } },
    { id: 'pet_taixu', name: '太虚灵兽', icon: '✨', q: 6, desc: '超脱三界之外，近乎大道。', bonus: { atk: 0.016, hp: 0.014, spirit: 0.026, stoneGain: 0.03 } },
  ];

  /* ═════════════════════════════════════════
     七、秘境（区域） & 妖兽
     ═════════════════════════════════════════ */
  const ZONE_NAMES = [
    ['青云山麓', '黑风林'],                          // 练气
    ['万兽谷', '幽冥沼泽'],                          // 筑基
    ['星河涧', '赤炎荒漠'],                          // 金丹
    ['九天雷池', '冰封绝域'],                        // 元婴
    ['虚空乱流', '太古战场'],                        // 化神
    ['炼狱熔渊', '万象幻境'],                        // 炼虚
    ['不周山遗址', '归墟海眼'],                      // 合体
    ['天外陨星海', '混沌迷域'],                      // 大乘
    ['九霄雷域', '仙陨之地'],                        // 渡劫
    ['瑶池仙境', '蓬莱福地'],                        // 地仙
    ['天庭遗址', '星河彼岸'],                        // 天仙
    ['大罗天', '无生绝地'],                          // 金仙
    ['造化源地', '万道归墟'],                        // 大罗
  ];

  const MOB_PREFIX = ['', '妖', '魔', '凶', '古', '太古', '远古', '洪荒', '混沌'];
  const MOB_NAMES = [
    ['灰狼', '毒蛇', '山猪', '野猴', '黑鸦', '蜈蚣精', '树妖'],
    ['铁背熊', '赤目虎', '沼泽巨鳄', '食人花', '石魔', '风隼'],
    ['星辉兽', '烈焰狮', '沙蝎王', '幽魂', '雷牙兽', '晶甲虫'],
    ['雷纹蛟', '冰魄玄蛇', '雪魔', '寒鸦王', '雷灵', '霜巨人'],
    ['虚空异兽', '裂空鹫', '时空虫', '战场亡魂', '血甲魔将', '星陨兽'],
    ['熔岩魔君', '幻心魅影', '炼狱犬', '业火修罗', '万象傀儡', '冥河渡者'],
    ['不周山魔', '归墟海妖', '上古凶兽', '海眼巨兽', '断岳猿', '幽都鬼将'],
    ['陨星巨兽', '混沌幼兽', '迷域幻灵', '吞星兽', '虚无法师', '陨铁傀儡'],
    ['九霄雷兽', '劫云妖', '仙陨残魂', '雷罚使者', '天雷巨人', '陨仙傀儡'],
    ['瑶池灵兽', '蓬莱仙鹤', '蟠桃树妖', '仙宫守卫', '玉兔精', '九天玄女像'],
    ['天兵天将', '星河巨兽', '天庭战将', '星辰古神', '河神', '彼岸花妖'],
    ['大罗魔尊', '无生鬼帝', '金仙残念', '天神战傀', '道则化身', '造化凶灵'],
    ['万道祖兽', '归墟之主', '开天巨人', '造化神魔', '道源之影', '虚无尊主'],
  ];
  const BOSS_NAMES = [
    ['山君·白额', '黑风老妖'], ['万兽王·裂天', '幽冥鬼母'], ['星河真君', '炎魔帝君'],
    ['雷池之主', '冰封女帝'], ['虚空魔尊', '太古战神'], ['炼狱阎君', '幻心魔尊'],
    ['不周山神', '归墟海皇'], ['陨星天魔', '混沌道君'], ['九霄雷帝', '陨仙之主'],
    ['瑶池圣母', '蓬莱仙翁'], ['天庭战神', '星河之主'], ['大罗魔帝', '无生鬼主'],
    ['造化道尊', '归墟万道主'],
  ];

  /* ═════════════════════════════════════════
     八、奇遇事件
     ═════════════════════════════════════════ */
  const HERB_EVENT_REWARD = { type: 'herb', min: 30, max: 200, realmMultiplier: 2.5 };
  const DEMON_SUPPRESS = {
    title: '以道心镇压', desc: '以己身道心强行压制心魔，考验心境。',
    costType: 'none', chance: 0.55,
    successReward: { type: 'spirit', multiplier: 0.6 }, failureReward: { type: 'spirit', multiplier: 0.22 },
    run: (s, api) => {
      if (U.chance(DEMON_SUPPRESS.chance)) {
        const gain = XG.R.need(s.realm, s.layer) * DEMON_SUPPRESS.successReward.multiplier;
        api.gainSpirit(gain, '炼心');
        return '心魔溃散，道心更坚！灵气 +' + U.fmt(gain);
      }
      const loss = XG.R.need(s.realm, s.layer) * DEMON_SUPPRESS.failureReward.multiplier;
      api.loseSpirit(loss);
      return '道心失守，走火入魔，灵气 −' + U.fmt(loss);
    },
  };
  const DEMON_PILL = {
    title: '服丹定神', desc: '消耗一枚凝神丹稳住心神（需有丹药储备）。',
    costType: 'pill', cost: { type: 'pill', id: 'p_ningshen', n: 1 },
    chance: 1, successReward: { type: 'spirit', multiplier: 1.1 },
    run: (s, api) => {
      if (!U.chance(DEMON_PILL.chance)) return '丹力未稳，心魔再度翻涌。';
      const gain = XG.R.need(s.realm, s.layer) * DEMON_PILL.successReward.multiplier;
      api.gainSpirit(gain, '定神');
      return '丹力化开，心魔自散，反助你悟道。灵气 +' + U.fmt(gain);
    },
  };

  const EVENTS = [
    {
      id: 'e_rain', name: '天降灵雨', w: 10, icon: '🌧', minRealm: 0,
      text: '天际紫云汇聚，丝丝灵雨洒落，你盘膝而坐，贪婪地吸纳着这份天赐机缘。',
      apply: (s, api) => {
        const gain = XG.R.need(s.realm, s.layer) * U.rnd(0.35, 0.9);
        api.gainSpirit(gain, '灵雨');
        return '灵气 +' + U.fmt(gain);
      },
    },
    {
      id: 'e_oldman', name: '老者传功', w: 8, icon: '🧙', minRealm: 0,
      text: '一位白发老者拦住去路，抚须笑道：「小友与老夫有缘，传你百年功力，可愿接下？」',
      apply: (s, api) => {
        const gain = XG.R.need(s.realm, s.layer) * U.rnd(0.8, 2.2);
        api.gainSpirit(gain, '传功');
        return '灵气 +' + U.fmt(gain);
      },
    },
    {
      id: 'e_herb', name: '灵药现世', w: 10, icon: '🌿', minRealm: 0,
      text: '崖壁缝隙中一株灵草散发着淡淡莹光，看年份至少已逾百年。',
      reward: HERB_EVENT_REWARD,
      apply: (s, api) => {
        const r = HERB_EVENT_REWARD;
        const amt = Math.max(1, Math.floor(U.rnd(r.min, r.max) * (1 + s.realm * r.realmMultiplier) * (1 + (api.mods().herbGain || 0))));
        api.gainHerb(amt, '灵药');
        return '灵草 +' + U.fmt(amt);
      },
    },
    {
      id: 'e_treasure', name: '遗落洞府', w: 7, icon: '🏛', minRealm: 0,
      text: '你在山腹中发现一座被藤蔓遮掩的洞府，石门半开，隐隐有宝光透出。',
      choices: [
        {
          title: '破门而入', desc: '强行闯入，或有所获，亦或有凶险。',
          run: (s, api) => {
            if (U.chance(0.72)) {
              const jade = Math.max(1, Math.floor(U.rnd(2, 6) * (1 + s.realm * 0.5)));
              const stone = Math.floor(U.rnd(200, 900) * (1 + s.realm * s.realm) * api.mods().stoneGain);
              api.gainJade(jade, '洞府'); api.gainStone(stone, '洞府');
              const eq = api.dropEquip(0.08 + s.realm * 0.01, '洞府遗宝');
              return '探索洞府成功！仙玉 +' + jade + '，灵石 +' + U.fmt(stone) + (eq ? '，获得「' + eq.name + '」' : '');
            }
            const loss = XG.R.need(s.realm, s.layer) * 0.15;
            api.loseSpirit(loss);
            api.log('洞府中机关重重，你狼狈逃出。', 'battle');
            return '触怒机关，灵气 −' + U.fmt(loss);
          },
        },
        {
          title: '叩门三拜', desc: '以礼相待，或许能得到洞府主人的馈赠。',
          run: (s, api) => {
            const gain = XG.R.need(s.realm, s.layer) * U.rnd(0.5, 1.4);
            api.gainSpirit(gain, '洞府');
            api.gainStone(Math.floor(U.rnd(100, 400) * (1 + s.realm * s.realm) * api.mods().stoneGain), '洞府');
            return '石门无声而开，你于蒲团上得一卷残篇，灵气 +' + U.fmt(gain);
          },
        },
      ],
    },
    {
      id: 'e_demon', name: '心魔来袭', w: 7, icon: '😈', minRealm: 1,
      text: '你修行之际，忽觉心神不稳，四周景象扭曲——心魔趁虚而入！',
      choices: [DEMON_SUPPRESS, DEMON_PILL],
    },
    {
      id: 'e_beast', name: '妖兽袭击', w: 9, icon: '👹', minRealm: 0,
      text: '一头浑身散发煞气的妖兽突然拦路，眼中满是贪婪与凶光。',
      choices: [
        {
          title: '拔剑迎战', desc: '与妖兽一战，胜则收获颇丰。',
          run: (s, api) => api.startEventBattle('event'),
        },
        {
          title: '遁走避让', desc: '三十六计走为上，但会损失些许灵气。',
          run: (s, api) => { const l = XG.R.need(s.realm, s.layer) * 0.08; api.loseSpirit(l); return '你施展身法远遁，灵气 −' + U.fmt(l); },
        },
      ],
    },
    {
      id: 'e_jade', name: '仙缘乍现', w: 5, icon: '✦', minRealm: 2,
      text: '一道流光自九天坠落，化作一枚流转着仙韵的玉简，静静悬浮于你面前。',
      apply: (s, api) => {
        const jade = Math.floor(U.rnd(4, 12) * (1 + s.realm * 0.35));
        api.gainJade(jade, '仙缘');
        return '仙玉 +' + jade;
      },
    },
    {
      id: 'e_merchant', name: '游方修士', w: 8, icon: '🧳', minRealm: 0,
      text: '一名游方修士拦住你：「道友，我这有批好货，便宜卖你，如何？」',
      choices: [
        {
          title: '买下灵材（灵石 ×大量）', desc: '以灵石换取珍贵材料。',
          cost: { stoneFactor: 0.8 },
          run: (s, api) => {
            const mats = XG.MATS.filter(m => m.q <= Math.min(6, 1 + s.realm));
            const m = U.pick(mats);
            const n = U.rndInt(2, 5);
            api.gainMat(m.id, n);
            return '购得「' + m.name + '」×' + n;
          },
        },
        {
          title: '买下丹药', desc: '以灵石换取一枚丹药。',
          cost: { stoneFactor: 0.5 },
          run: (s, api) => {
            const pool = XG.PILLS.filter(p => p.unlock <= Math.min(6, 1 + s.realm));
            const p = U.pick(pool);
            api.gainPill(p.id, 1);
            return '购得丹药「' + p.name + '」×1';
          },
        },
        {
          title: '婉言谢绝', desc: '不理会，继续赶路。',
          run: () => '你摇头离去，修士失望地摇摇头。',
        },
      ],
    },
    {
      id: 'e_insight', name: '顿悟', w: 6, icon: '💡', minRealm: 1,
      text: '你望着山间流云，忽然心有所感，仿佛触摸到了某种玄妙的天道法则……',
      apply: (s, api) => {
        const g = XG.R.need(s.realm, s.layer) * U.rnd(1.2, 2.6);
        api.gainSpirit(g, '顿悟');
        return '顿悟！灵气 +' + U.fmt(g);
      },
    },
    {
      id: 'e_ruin', name: '上古遗迹', w: 5, icon: '🗿', minRealm: 3,
      text: '一处被黄沙掩埋的上古遗迹显露出来，石碑上刻着无人能识的古老文字。',
      choices: [
        {
          title: '参悟碑文（消耗仙玉）', desc: '以仙玉为引参悟古文，可永久提升修为。',
          cost: { jade: 8 },
          run: (s, api) => {
            api.permanentBonus('spirit', 0.03);
            return '你参悟出一丝天道真意，永久获得 +3% 灵气/秒';
          },
        },
        {
          title: '搜寻宝物', desc: '在遗迹中翻找，也许能找到些东西。',
          run: (s, api) => {
            const mats = XG.MATS.filter(m => m.q <= Math.min(6, 2 + s.realm));
            const m = U.pick(mats); const n = U.rndInt(3, 8);
            api.gainMat(m.id, n);
            const st = Math.floor(U.rnd(1e3, 1e4) * Math.pow(3, s.realm) * api.mods().stoneGain);
            api.gainStone(st, '遗迹');
            return '搜得「' + m.name + '」×' + n + '，灵石 +' + U.fmt(st);
          },
        },
      ],
    },
  ];

  /* ═════════════════════════════════════════
     九、成就（道果）
     ═════════════════════════════════════════
     cond(s) → bool；reward: {spirit/atk/hp: 倍率加成}
     ═════════════════════════════════════════ */
  const ACHIEVEMENTS = [
    { id: 'ac_first', name: '初入仙途', icon: '🌱', desc: '完成第一次境界突破', reward: { spirit: 0.02 }, cond: s => s.stats.breakthroughs >= 1 },
    { id: 'ac_found', name: '筑基之始', icon: '🏗', desc: '踏入筑基境', reward: { spirit: 0.03 }, cond: s => s.realm >= 1 },
    { id: 'ac_gold', name: '金丹大道', icon: '🟡', desc: '凝成金丹', reward: { atk: 0.05 }, cond: s => s.realm >= 2 },
    { id: 'ac_infant', name: '元婴出窍', icon: '👶', desc: '结成元婴', reward: { hp: 0.05 }, cond: s => s.realm >= 3 },
    { id: 'ac_spirit', name: '化神之境', icon: '🌟', desc: '化神成功', reward: { spirit: 0.05 }, cond: s => s.realm >= 4 },
    { id: 'ac_xu', name: '炼虚合道', icon: '🌌', desc: '踏入炼虚', reward: { spirit: 0.06 }, cond: s => s.realm >= 5 },
    { id: 'ac_he', name: '天人合一', icon: '☯', desc: '达成合体境', reward: { spirit: 0.08 }, cond: s => s.realm >= 6 },
    { id: 'ac_cheng', name: '大乘无量', icon: '🔆', desc: '登临大乘', reward: { spirit: 0.10 }, cond: s => s.realm >= 7 },
    { id: 'ac_du', name: '渡过天劫', icon: '⚡', desc: '成功渡过一次天劫', reward: { hp: 0.10 }, cond: s => s.stats.tribulations >= 1 },
    { id: 'ac_xian', name: '羽化登仙', icon: '🕊', desc: '踏入地仙之境', reward: { spirit: 0.15 }, cond: s => s.realm >= 9 },

    { id: 'ac_slay100', name: '斩妖百头', icon: '⚔', desc: '击败 100 只妖兽', reward: { atk: 0.05 }, cond: s => s.stats.kills >= 100 },
    { id: 'ac_slay1k', name: '斩妖千头', icon: '🗡', desc: '击败 1000 只妖兽', reward: { atk: 0.10 }, cond: s => s.stats.kills >= 1000 },
    { id: 'ac_slay10k', name: '杀伐无双', icon: '💀', desc: '击败 10000 只妖兽', reward: { atk: 0.20 }, cond: s => s.stats.kills >= 10000 },
    { id: 'ac_boss10', name: '屠戮妖王', icon: '👑', desc: '击败 10 只妖王', reward: { atk: 0.08 }, cond: s => s.stats.bossKills >= 10 },
    { id: 'ac_tower10', name: '登塔十层', icon: '🗼', desc: '通天塔到达第 10 层', reward: { hp: 0.05 }, cond: s => s.tower.best >= 10 },
    { id: 'ac_tower30', name: '登塔三十', icon: '🏯', desc: '通天塔到达第 30 层', reward: { atk: 0.10 }, cond: s => s.tower.best >= 30 },
    { id: 'ac_tower60', name: '通天彻地', icon: '🌠', desc: '通天塔到达第 60 层', reward: { spirit: 0.15 }, cond: s => s.tower.best >= 60 },

    { id: 'ac_stone1', name: '小有积蓄', icon: '💰', desc: '累计获得 10 万灵石', reward: { stoneGain: 0.05 }, cond: s => s.stats.totalStone >= 1e5 },
    { id: 'ac_stone2', name: '富甲一方', icon: '💎', desc: '累计获得 1 亿灵石', reward: { stoneGain: 0.10 }, cond: s => s.stats.totalStone >= 1e8 },
    { id: 'ac_pill10', name: '丹道初成', icon: '⚗', desc: '成功炼制 10 次丹药', reward: { spirit: 0.03 }, cond: s => s.stats.pillsMade >= 10 },
    { id: 'ac_pill100', name: '丹道宗师', icon: '🏺', desc: '成功炼制 100 次丹药', reward: { spirit: 0.06 }, cond: s => s.stats.pillsMade >= 100 },
    { id: 'ac_pet3', name: '灵宠满园', icon: '🐾', desc: '拥有 3 只灵宠', reward: { spirit: 0.04 }, cond: s => s.pets.owned.length >= 3 },
    { id: 'ac_pet6', name: '万兽之主', icon: '🐲', desc: '拥有 6 只灵宠', reward: { atk: 0.10, hp: 0.10 }, cond: s => s.pets.owned.length >= 6 },
    { id: 'ac_equip', name: '一身神装', icon: '🎽', desc: '四个装备栏全部装备地品以上', reward: { atk: 0.08, hp: 0.08 }, cond: s => SLOTS.every(sl => { const e = s.equip[sl.id]; return e && e.q >= 4; }) },
    { id: 'ac_ascend', name: '轮回者', icon: '🌀', desc: '完成一次飞升转生', reward: { spirit: 0.20 }, cond: s => s.prestige.times >= 1 },
    { id: 'ac_build50', name: '洞天福地', icon: '⛰', desc: '洞天建筑总等级达到 50', reward: { spirit: 0.05 }, cond: s => Object.values(s.buildings).reduce((a, b) => a + b, 0) >= 50 },
    { id: 'ac_event20', name: '机缘深厚', icon: '🍀', desc: '经历 20 次奇遇', reward: { spirit: 0.05 }, cond: s => s.stats.events >= 20 },
    { id: 'ac_maxart', name: '功法大成', icon: '📜', desc: '任意一门功法升至 50 级', reward: { atk: 0.06, spirit: 0.06 }, cond: s => Object.values(s.arts).some(a => a.lv >= 50) },
  ];

  XG.ART_TYPE = ART_TYPE;
  XG.ARTS = ARTS;
  XG.BUILDINGS = BUILDINGS;
  XG.MATS = MATS;
  XG.PILLS = PILLS;
  XG.SLOTS = SLOTS;
  XG.EQUIP_NAMES = EQUIP_NAMES;
  XG.AFFIX = AFFIX;
  XG.PETS = PETS;
  XG.ZONE_NAMES = ZONE_NAMES;
  XG.MOB_PREFIX = MOB_PREFIX;
  XG.MOB_NAMES = MOB_NAMES;
  XG.BOSS_NAMES = BOSS_NAMES;
  XG.EVENTS = EVENTS;
  XG.ACHIEVEMENTS = ACHIEVEMENTS;

  /* ── 索引表 ── */
  XG.idx = {
    art: Object.fromEntries(ARTS.map(a => [a.id, a])),
    building: Object.fromEntries(BUILDINGS.map(b => [b.id, b])),
    mat: Object.fromEntries(MATS.map(m => [m.id, m])),
    pill: Object.fromEntries(PILLS.map(p => [p.id, p])),
    pet: Object.fromEntries(PETS.map(p => [p.id, p])),
    event: Object.fromEntries(EVENTS.map(e => [e.id, e])),
    ach: Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a])),
    slot: Object.fromEntries(SLOTS.map(s => [s.id, s])),
  };
})();

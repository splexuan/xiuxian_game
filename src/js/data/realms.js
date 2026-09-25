/* ═══════════════════════════════════════════
   realms.js — 境界体系 & 全局数值配置
   ═══════════════════════════════════════════ */
(function () {
  'use strict';
  const XG = window.XG;

  /* ══════ 全局平衡配置（集中调参） ══════ */
  XG.CONFIG = {
    LAYERS_PER_REALM: 9,          // 每个大境界 9 层
    /* 层内灵气需求增长。
       这是全局节奏的总闸门：单个大境界的基准耗时 ∝ (g^9-1)/(g-1)。
       g=1.70 约为 g=1.42 的 4.6 倍、g=1.52 的 2.0 倍——
       因为锻炉、宝石、套装、神通、天象等系统会显著放大玩家战力，
       基准曲线必须相应拉长，否则一局会在几十分钟内被打穿。 */
    LAYER_EXP_GROWTH: 1.70,
    BASE_SPIRIT_RATE: 1,          // 初始灵气/秒
    TRIBULATION_FROM: 1,          // 从第几个大境界起，跨境界需渡劫（筑基起）

    /* 突破 */
    BREAK_SUCCESS_BASE: 0.92,     // 小境界突破基础成功率（层数越高略降）
    BREAK_FAIL_KEEP: 0.72,        // 失败保留的灵气比例
    BREAK_COOLDOWN: 0,            // 层内突破冷却（秒）

    /* 天劫 */
    TRIB_BASE_POWER: 1,           // 天劫强度基数
    TRIB_KILL_ROUNDS: 9,          // 基准：你需要几回合击破天劫化身
    TRIB_ROUNDS_PER_REALM: 0.5,   // 每个大境界双方回合数同步增长

    /* 渡劫「余量」= 你能撑住的回合数 − 击破它所需的回合数。
       旧版让两者同步增长，余量恒为 4 回合 —— 任何境界都是必胜，
       天劫形同虚设（旧基线实测 11 战 11 胜、0 负）。

       注意：反解敌方伤害时只用了「气血 / 生存回合」，**没有计入你的
       吸血与丹药回复**，因此实际生存回合明显长于理论值。
       所以后期必须让余量降到**负值**（敌方先把你打死）才真正有威胁，
       再靠「渡劫准备」把它补回来。余量为负 ≠ 不可能取胜。 */
    TRIB_MARGIN_BASE: 3.0,        // 首个大境界渡劫的余量（回合）
    TRIB_MARGIN_DECAY: 0.75,      // 每上升一个大境界收窄的余量
    TRIB_MIN_MARGIN: -6.0,        // 余量下限（负值 = 不布阵必败）

    /* 渡劫准备：投入灵石布阵，换取本次渡劫的额外余量。
       stoneSec 以「N 秒灵石收入」计，与锻炉 / 任务同一套换算口径。 */
    TRIB_AID_TIERS: [
      { id: 'none', name: '独自渡劫', rounds: 0, stoneSec: 0 },
      { id: 'array', name: '灵石布阵', rounds: 2.5, stoneSec: 180 },
      { id: 'grand', name: '倾力大阵', rounds: 5.0, stoneSec: 600 },
    ],

    TRIB_FAIL_KEEP: 0.55,

    /* 灵石 */
    STONE_SELL_RATE: 1,           // 出售物品返还比例

    /* 离线 */
    OFFLINE_CAP_HOURS: 12,        // 离线收益上限
    OFFLINE_EFFICIENCY: 0.65,     // 离线效率
    OFFLINE_MIN_SECONDS: 60,      // 低于此秒数不结算
    OFFLINE_BATTLE_SAMPLES: 12,

    /* 飞升 */
    ASCEND_MIN_REALM: 7,          // 至少达到该大境界索引才能飞升（大乘）
    ASCEND_JADE_PER: 8,           // 每点飞升值所需仙玉倍率

    /* 战斗 */
    BATTLE_TICK: 0.85,            // 每个回合所消耗的秒数（1x速度）
    AUTO_RESULT_DELAY: 1.2,
    EXPLORE_STEP: 6,              // 秘境探索一步的秒数
    AUTO_SAVE_INTERVAL: 20,       // 自动存档间隔（秒）

    /* 挂机产出 */
    HERB_FROM_FARM: 0.35,         // 灵田每级每秒灵草产出基数

    /* 洞天 / 功法 / 丹药 / 灵宠 随境界的造价系数。
       每上升一个大境界（按连续层次平滑）乘以此值。
       该值略高于同期灵石收入的增长倍率（约 ×19），
       使修行越深、投入越显吃紧；而飞升回到凡尘后造价骤降，
       重建变得轻快——这正是转生循环的核心手感。 */
    REALM_COST_MULT: 19,
  };

  /* ══════ 大境界表 ══════
     expBase   : 该境界第 1 层的灵气需求
     realmMult : 身处此境界时的灵气/秒乘数
     atkBase   : 该境界基础攻击
     hpBase    : 该境界基础气血

     平衡要点：每提升一个大境界，
       灵气需求 ×50，而境界乘数 ×25（比值 q ≈ 2.0）
     → 每个大境界的「基准耗时」是上一层级的 2.0 倍。
     配合层内增长 1.70，形成「一层比一层吃紧、破境后豁然开朗」
     的锯齿曲线——这正是挂机修仙的节奏感来源。
  */
  XG.REALMS = [
    { name: '练气', expBase: 12,       realmMult: 1,          atkBase: 8,      hpBase: 60,      desc: '纳天地灵气入体，洗去凡尘。', color: '#9aa7bd' },
    { name: '筑基', expBase: 600,      realmMult: 25,         atkBase: 90,     hpBase: 480,     desc: '筑就道基，灵气化液，寿元大增。', color: '#7ee08a' },
    { name: '金丹', expBase: 3.00e4,   realmMult: 625,        atkBase: 1400,   hpBase: 6200,    desc: '凝液成丹，金丹一成，我命由我不由天。', color: '#6bb8ff' },
    { name: '元婴', expBase: 1.50e6,   realmMult: 1.5625e4,   atkBase: 2.4e4,  hpBase: 9.2e4,   desc: '碎丹生婴，神魂可离体遨游。', color: '#b18cff' },
    { name: '化神', expBase: 7.50e7,   realmMult: 3.906e5,    atkBase: 4.2e5,  hpBase: 1.4e6,   desc: '元婴化神，一念之间天地变色。', color: '#ffb454' },
    { name: '炼虚', expBase: 3.75e9,   realmMult: 9.766e6,    atkBase: 7.6e6,  hpBase: 2.2e7,   desc: '炼化虚空，举手投足皆合天道。', color: '#ff6b81' },
    { name: '合体', expBase: 1.875e11, realmMult: 2.441e8,    atkBase: 1.4e8,  hpBase: 3.6e8,   desc: '神与体合，法相天地，寿与天齐。', color: '#ffe9a8' },
    { name: '大乘', expBase: 9.375e12, realmMult: 6.104e9,    atkBase: 2.6e9,  hpBase: 6.0e9,   desc: '大乘之境，一步可跨山河万里。', color: '#c4f0ff' },
    { name: '渡劫', expBase: 4.69e14,  realmMult: 1.526e11,   atkBase: 5.0e10, hpBase: 1.0e11,  desc: '雷劫加身，渡过则为真仙。', color: '#ffd6a5' },
    { name: '地仙', expBase: 2.34e16,  realmMult: 3.815e12,   atkBase: 9.6e11, hpBase: 1.8e12,  desc: '陆地神仙，长生久视，逍遥人间。', color: '#a8ffd8' },
    { name: '天仙', expBase: 1.17e18,  realmMult: 9.537e13,   atkBase: 1.9e13, hpBase: 3.2e13,  desc: '飞升天界，位列仙班，超脱轮回。', color: '#b8e0ff' },
    { name: '金仙', expBase: 5.86e19,  realmMult: 2.384e15,   atkBase: 3.8e14, hpBase: 6.0e14,  desc: '金仙不朽，可开天辟地，造化万物。', color: '#ffe066' },
    { name: '大罗', expBase: 2.93e21,  realmMult: 5.961e16,   atkBase: 8.0e15, hpBase: 1.2e16,  desc: '大罗金仙，超脱诸天，万劫不磨。', color: '#ffffff' },
  ];

  /* 中文层数 */
  const CN_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

  const R = {
    count() { return XG.REALMS.length; },
    maxLayers() { return XG.CONFIG.LAYERS_PER_REALM; },

    get(idx) {
      return XG.REALMS[XG.U.clamp(idx, 0, XG.REALMS.length - 1)];
    },

    /* 综合等级 = realm*9 + layer-1 */
    totalLevel(realm, layer) { return realm * XG.CONFIG.LAYERS_PER_REALM + (layer - 1); },

    /* 名称：练气三层 / 大罗金仙九层 */
    name(realm, layer) {
      const r = R.get(realm);
      return r.name + CN_NUM[XG.U.clamp(layer - 1, 0, 8)] + '层';
    },

    /* 当前层所需灵气 */
    need(realm, layer) {
      const r = R.get(realm);
      return r.expBase * Math.pow(XG.CONFIG.LAYER_EXP_GROWTH, layer - 1);
    },

    /* 该境界灵气/秒基础乘数 */
    mult(realm) { return R.get(realm).realmMult; },

    /* 下一个境界（跨大境界时） */
    isRealmTop(layer) { return layer >= XG.CONFIG.LAYERS_PER_REALM; },

    /* 是否最后一境界最后一层 */
    isMax(realm, layer) {
      return realm >= XG.REALMS.length - 1 && layer >= XG.CONFIG.LAYERS_PER_REALM;
    },

    /* 修为总览百分比（用于进度表现，取连续对数刻度） */
    progress(realm, layer) {
      return XG.U.clamp((realm * 9 + layer - 1) / (XG.REALMS.length * 9 - 1), 0, 1);
    },

    /* 突破到下一层前是否需要渡劫（跨大境界） */
    needTribulation(realm, layer) {
      return R.isRealmTop(layer) && realm >= XG.CONFIG.TRIBULATION_FROM && realm < XG.REALMS.length - 1;
    },

    /* 小境界突破基础成功率：层数越高越难 */
    breakChance(realm, layer) {
      const base = XG.CONFIG.BREAK_SUCCESS_BASE;
      return XG.U.clamp(base - (layer - 1) * 0.012, 0.6, 0.99);
    },
  };

  XG.R = R;
})();

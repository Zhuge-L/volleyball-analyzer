/* ============================================================
 * 北京大学排球课程 · 考试项目与评判标准
 * 每个项目包含：拍摄建议、关键帧检测条件、指标、权重、报告字段
 *
 * 重要：本系统不追踪排球。所谓「击球动作瞬间」是根据人体关键点的
 * 运动学峰值推算的动作相位，无球空挥也可能被标出，仅作相位参考。
 * ============================================================ */

function M(label, short, unit, range, zones, evaluate, fix) {
  return { label, short, unit, range, zones, evaluate, fix };
}

const kneeBump = M('膝关节夹角', '膝角', '°', [60, 180],
  [{ from: 110, to: 150, level: 'good' }, { from: 100, to: 110, level: 'warn' }, { from: 150, to: 165, level: 'warn' }],
  (v) => {
    if (v >= 110 && v <= 150) return { level: 'good', text: '屈膝半蹲到位，重心稳定' };
    if (v > 150 && v <= 165) return { level: 'warn', text: '腿部偏直，建议再屈膝降低重心' };
    if (v > 165) return { level: 'bad', text: '双腿几乎伸直：重心过高，无法蹬地发力' };
    if (v >= 100) return { level: 'warn', text: '蹲得略低，注意保持移动弹性' };
    return { level: 'bad', text: '蹲得过低，影响起动与移动速度' };
  },
  (v) => (v > 150 ? `再蹲低约 ${v - 150}°` : v < 110 ? `稍抬高重心约 ${110 - v}°` : null),
);

const kneeLight = M('膝关节夹角', '膝角', '°', [60, 180],
  [{ from: 130, to: 165, level: 'good' }, { from: 120, to: 130, level: 'warn' }, { from: 165, to: 175, level: 'warn' }],
  (v) => {
    if (v >= 130 && v <= 165) return { level: 'good', text: '下肢微屈，便于蹬伸发力' };
    if (v > 165) return { level: 'warn', text: '腿部偏直，可略屈膝增加弹性' };
    if (v >= 120) return { level: 'warn', text: '蹲得略深，传球/发球时保持轻快' };
    return { level: 'bad', text: '蹲得过低，影响出手高度与稳定性' };
  },
  (v) => (v > 165 ? `再屈膝约 ${v - 165}°` : v < 130 ? `稍抬高重心约 ${130 - v}°` : null),
);

const cogDrop = M('髋部下降幅度', '髋部', '%', [0, 30],
  [{ from: 12, to: 30, level: 'good' }, { from: 6, to: 12, level: 'warn' }],
  (v) => {
    if (v >= 12) return { level: 'good', text: '重心下降到位，保持这个高度迎球' };
    if (v >= 6) return { level: 'warn', text: '重心下降不够充分，再蹲低一点' };
    return { level: 'bad', text: '重心过高：请屈膝下蹲，降低重心再迎球' };
  },
  (v) => (v < 12 ? `髋部再下降约 ${12 - v}%` : null),
);

const trunkBump = M('躯干前倾角', '躯干', '°', [0, 60],
  [{ from: 10, to: 30, level: 'good' }, { from: 5, to: 10, level: 'warn' }, { from: 30, to: 40, level: 'warn' }],
  (v) => {
    if (v >= 10 && v <= 30) return { level: 'good', text: '上体前倾角度合适' };
    if (v < 10) return { level: 'warn', text: '上体偏直，可稍前倾含胸准备' };
    if (v <= 40) return { level: 'warn', text: '前倾偏大，注意收紧核心' };
    return { level: 'bad', text: '前倾过度：重心易失控，抬起一点上体' };
  },
  (v) => (v < 10 ? `上体再前倾约 ${10 - v}°` : v > 30 ? `上体抬起约 ${v - 30}°` : null),
);

const trunkUpright = M('躯干前倾角', '躯干', '°', [0, 60],
  [{ from: 0, to: 18, level: 'good' }, { from: 18, to: 28, level: 'warn' }],
  (v) => {
    if (v <= 18) return { level: 'good', text: '上体较直，利于向上送球' };
    if (v <= 28) return { level: 'warn', text: '前倾略大，传球时上体再立一些' };
    return { level: 'bad', text: '前倾过大，球容易传低、传近' };
  },
  (v) => (v > 18 ? `上体再立起约 ${v - 18}°` : null),
);

const elbowExt = M('击球臂伸直度', '伸直', '°', [60, 180],
  [{ from: 160, to: 180, level: 'good' }, { from: 145, to: 160, level: 'warn' }],
  (v) => {
    if (v >= 160) return { level: 'good', text: '击球臂充分伸直，鞭打完整' };
    if (v >= 145) return { level: 'warn', text: '手臂基本伸直，击球瞬间再绷紧' };
    return { level: 'bad', text: '屈肘击球：力量和方向都难控制' };
  },
  (v) => (v < 160 ? `击球臂再伸直约 ${160 - v}°` : null),
);

/** 手腕相对肩的高度：正值 = 手腕在肩以上（归一化 ×100） */
const wristHigh = M('击球点高度', '击球点', '', [0, 40],
  [{ from: 8, to: 40, level: 'good' }, { from: 3, to: 8, level: 'warn' }],
  (v) => {
    if (v >= 8) return { level: 'good', text: '击球点在头上方，利于发力与过网' };
    if (v >= 3) return { level: 'warn', text: '击球点略低，再向上伸展一些' };
    return { level: 'bad', text: '击球点过低：应在头上方最高点击球' };
  },
  (v) => (v < 8 ? `击球点再抬高约 ${8 - v}` : null),
);

const wristSet = M('手型高度', '手型', '', [-5, 30],
  [{ from: 2, to: 18, level: 'good' }, { from: -2, to: 2, level: 'warn' }, { from: 18, to: 24, level: 'warn' }],
  (v) => {
    if (v >= 2 && v <= 18) return { level: 'good', text: '手型在额前上方，传球点合适' };
    if (v < 2) return { level: 'warn', text: '手型偏低，容易变成垫传' };
    if (v <= 24) return { level: 'warn', text: '手型略高，注意在额前而不是脑后' };
    return { level: 'bad', text: '传球点偏离额前，先把球接到额头前方' };
  },
  (v) => (v < 2 ? `手型再抬高一些` : v > 18 ? `手型略降到额前` : null),
);

const handsGap = M('两手间距', '间距', '', [0, 40],
  [{ from: 0, to: 10, level: 'good' }, { from: 10, to: 16, level: 'warn' }],
  (v) => {
    if (v <= 10) return { level: 'good', text: '两手靠拢成半球形，传球手型稳定' };
    if (v <= 16) return { level: 'warn', text: '两手略分开，拇指食指再靠拢一些' };
    return { level: 'bad', text: '两手过开：球会从手中漏掉或飞偏' };
  },
  (v) => (v > 10 ? `两手再靠拢约 ${v - 10}` : null),
);

const setElbow = M('传球肘角', '肘角', '°', [60, 180],
  [{ from: 85, to: 130, level: 'good' }, { from: 70, to: 85, level: 'warn' }, { from: 130, to: 150, level: 'warn' }],
  (v) => {
    if (v >= 85 && v <= 130) return { level: 'good', text: '肘关节弯曲适中，便于手指弹击' };
    if (v < 85) return { level: 'warn', text: '肘角过小，手腕容易僵硬' };
    if (v <= 150) return { level: 'warn', text: '肘角偏直，传球点容易靠后' };
    return { level: 'bad', text: '手臂过直：先屈肘把球接到额前再伸送' };
  },
  (v) => (v < 85 ? `肘角再打开约 ${85 - v}°` : v > 130 ? `肘角再弯曲约 ${v - 130}°` : null),
);

const underWrist = M('击球点高度', '击球点', '', [-5, 30],
  [{ from: -5, to: 6, level: 'good' }, { from: 6, to: 12, level: 'warn' }],
  (v) => {
    if (v <= 6) return { level: 'good', text: '下手击球点在腰腹以下，符合下手发球' };
    if (v <= 12) return { level: 'warn', text: '击球点略高，注意由下向前挥臂' };
    return { level: 'bad', text: '击球点过高：已接近上手，请保持下手挥臂' };
  },
  (v) => (v > 6 ? `击球点再放低一些` : null),
);

const jumpRise = M('起跳腾空', '腾空', '%', [0, 25],
  [{ from: 6, to: 25, level: 'good' }, { from: 3, to: 6, level: 'warn' }],
  (v) => {
    if (v >= 6) return { level: 'good', text: '有明显起跳，利于高点击球' };
    if (v >= 3) return { level: 'warn', text: '腾空偏小，助跑起跳再充分一些' };
    return { level: 'bad', text: '几乎没有起跳：扣球应先助跑起跳再挥臂' };
  },
  (v) => (v < 6 ? `腾空再增加约 ${6 - v}%` : null),
);

const PHASE_BASE = {
  contactWindow: 0.12,
  scoreWindow: 0.16,
  minGap: 0.7,
  standKnee: 158,
  standCog: 6,
};

/** 手腕上升速度（图像 y 减小）的局部峰值 */
function upPeak(series, n, minVy) {
  if (n < 4) return null;
  const s0 = series[n - 3], s1 = series[n - 2], s2 = series[n - 1];
  const vPrev = (s0.y - series[n - 4].y) / Math.max(1e-3, s0.t - series[n - 4].t);
  const v1 = (s1.y - s0.y) / Math.max(1e-3, s1.t - s0.t);
  const v2 = (s2.y - s1.y) / Math.max(1e-3, s2.t - s1.t);
  if (v1 <= minVy && v1 <= vPrev && v1 <= v2) return { s1, v1 };
  return null;
}

/** 手腕高度局部最高（y 局部最小） */
function heightPeak(series, n) {
  if (n < 4) return null;
  const s0 = series[n - 3], s1 = series[n - 2], s2 = series[n - 1];
  if (s1.y <= s0.y && s1.y <= s2.y) return s1;
  return null;
}

export const SKILLS = {
  bump: {
    id: 'bump',
    icon: '🤲',
    name: '垫球',
    examName: '正面双手垫球',
    blurb: '考试核心：稳定击球平台 + 正确平台朝向 + 下肢蹬送。',
    camera: {
      best: '斜侧面 30°～45°（推荐）',
      also: '需要看两臂是否夹紧成面时，可再补一段正面。',
      framing: '全身入镜，镜头与腰同高，先站直 1～2 秒再开始垫球。',
      avoid: '纯侧面远端手臂会被身体挡住；纯正面看不清膝角和平台倾角。',
    },
    metrics: {
      platformExt: M('平台伸直度', '伸直', '°', [60, 180],
        [{ from: 165, to: 180, level: 'good' }, { from: 150, to: 165, level: 'warn' }],
        (v) => {
          if (v >= 165) return { level: 'good', text: '两臂伸直夹紧，击球平台稳定' };
          if (v >= 150) return { level: 'warn', text: '手臂基本伸直，击球瞬间再绷紧一些' };
          return { level: 'bad', text: '屈肘垫球容易失误：两臂应伸直、夹紧、压腕' };
        },
        (v) => (v < 165 ? `两臂再伸直约 ${165 - v}°` : null),
      ),
      platformSym: M('平台对称度', '对称', '°', [0, 40],
        [{ from: 0, to: 8, level: 'good' }, { from: 8, to: 15, level: 'warn' }],
        (v) => {
          if (v <= 8) return { level: 'good', text: '两臂对称共面，平台朝向稳定' };
          if (v <= 15) return { level: 'warn', text: '两臂略不对称，注意同时发力、夹紧成面' };
          return { level: 'bad', text: '两臂明显不对称：球容易飞偏，先夹紧再触球' };
        },
        (v) => (v > 8 ? `两臂角度差再缩小约 ${v - 8}°` : null),
      ),
      platformTilt: M('平台倾角', '倾角', '°', [0, 90],
        [{ from: 25, to: 45, level: 'good' }, { from: 15, to: 25, level: 'warn' }, { from: 45, to: 55, level: 'warn' }],
        (v) => {
          if (v >= 25 && v <= 45) return { level: 'good', text: '平台朝向合适，出球弧度适中' };
          if (v < 15) return { level: 'bad', text: '平台太平：球易向前冲，压腕让平台朝上' };
          if (v < 25) return { level: 'warn', text: '平台略平，出球弧度偏低' };
          if (v <= 55) return { level: 'warn', text: '平台略陡，出球易偏高偏近' };
          return { level: 'bad', text: '平台过陡：球易垂直起落，放平一些' };
        },
        (v) => (v < 25 ? `平台再向上翘起约 ${25 - v}°` : v > 45 ? `平台放平约 ${v - 45}°` : null),
      ),
      knee: kneeBump, cog: cogDrop, trunk: trunkBump,
    },
    combined: { title: '击球平台（两臂）', keys: ['platformExt', 'platformSym', 'platformTilt'] },
    stdKeys: ['knee', 'cog', 'trunk'],
    groups: [{ title: '下肢 · 蹲深站位', until: 'trunk' }, { title: '躯干' }],
    focusOrder: ['platformExt', 'knee', 'platformTilt', 'platformSym', 'cog', 'trunk'],
    weights: { platform: 0.4, lower: 0.3, trunk: 0.15, timing: 0.15 },
    reportMap: [
      { name: '平台', wKey: 'platform', keys: ['platformExt', 'platformSym', 'platformTilt'] },
      { name: '下肢', wKey: 'lower', keys: ['knee', 'cog'] },
      { name: '躯干', wKey: 'trunk', keys: ['trunk'] },
      { name: '时机', wKey: 'timing', timing: true },
    ],
    tableKeys: [
      ['platformExt', '°'], ['platformSym', '°'], ['platformTilt', '°'],
      ['knee', '°'], ['cog', '%'], ['trunk', '°'],
    ],
    chart: { kneeBand: [110, 150], series: [{ key: 'cog', color: 'rgba(255,176,32,0.25)', fill: true }, { key: 'knee', color: '#00d4ff' }, { key: 'platformExt', color: '#a78bff' }] },
    phase: { ...PHASE_BASE, minVy: -0.85 },
    detect(series, lastT) {
      const n = series.length;
      const peak = upPeak(series, n, this.phase.minVy);
      if (!peak) return false;
      const s = peak.s1;
      return s.belowShoulder
        && (s.knee == null || s.knee < 155)
        && (s.cog == null || s.cog >= 8)
        && (s.wristGap == null || s.wristGap < 0.28)
        && s.t - lastT >= this.phase.minGap;
    },
    overlay: { elbowAs: 'platformExt', tilt: true, cog: true },
    timingText: '蹬地→送髋→抬臂，用腿送球而不是用手捞球',
    standards: [
      { name: '平台伸直度', good: '165° ~ 180°', warn: '150° ~ 165°', bad: '< 150°', note: '击球动作瞬间两臂伸直夹紧（取两肘较小值）' },
      { name: '平台对称度', good: '≤ 8°', warn: '8° ~ 15°', bad: '> 15°', note: '两肘角度差；侧拍远端易被挡，建议斜侧面或补一段正面' },
      { name: '平台倾角', good: '25° ~ 45°', warn: '15°~25° 或 45°~55°', bad: '< 15° 或 > 55°', note: '前臂与水平面夹角，决定出球弧度' },
      { name: '膝关节夹角', good: '110° ~ 150°', warn: '100°~110° 或 150°~165°', bad: '< 100° 或 > 165°', note: '半蹲准备姿势' },
      { name: '髋部下降幅度', good: '≥ 12%', warn: '6% ~ 12%', bad: '< 6%', note: '以髋部高度近似重心' },
      { name: '躯干前倾角', good: '10° ~ 30°', warn: '5°~10° 或 30°~40°', bad: '< 5° 或 > 40°', note: '含胸前倾，便于蹬伸' },
    ],
  },

  set: {
    id: 'set',
    icon: '🖐️',
    name: '传球',
    examName: '正面上手传球',
    blurb: '考试核心：额前手型、两手靠拢、肘关节弯曲后伸送。',
    camera: {
      best: '正面或斜正面 20°～30°（推荐）',
      also: '正面最容易看两手间距与传球点是否在额前。',
      framing: '全身入镜，镜头略高于腰；先站直 1～2 秒再开始传球。',
      avoid: '纯侧面看不清两手是否靠拢，也容易把手型高度估错。',
    },
    metrics: {
      wristHigh: wristSet, handsGap, setElbow, knee: kneeLight, trunk: trunkUpright,
    },
    combined: null,
    stdKeys: ['wristHigh', 'handsGap', 'setElbow', 'knee', 'trunk'],
    groups: [{ title: '手型与传球点', until: 'knee' }, { title: '下肢与躯干' }],
    focusOrder: ['wristHigh', 'handsGap', 'setElbow', 'knee', 'trunk'],
    weights: { hands: 0.45, lower: 0.25, trunk: 0.15, timing: 0.15 },
    reportMap: [
      { name: '手型', wKey: 'hands', keys: ['wristHigh', 'handsGap', 'setElbow'] },
      { name: '下肢', wKey: 'lower', keys: ['knee'] },
      { name: '躯干', wKey: 'trunk', keys: ['trunk'] },
      { name: '时机', wKey: 'timing', timing: true },
    ],
    tableKeys: [['wristHigh', ''], ['handsGap', ''], ['setElbow', '°'], ['knee', '°'], ['trunk', '°']],
    chart: { kneeBand: [130, 165], series: [{ key: 'knee', color: '#00d4ff' }, { key: 'setElbow', color: '#a78bff' }] },
    phase: { ...PHASE_BASE, minVy: -0.45 },
    detect(series, lastT) {
      const n = series.length;
      const s = heightPeak(series, n);
      if (!s) return false;
      return s.aboveBrow
        && (s.wristGap == null || s.wristGap < 0.22)
        && (s.knee == null || s.knee < 170)
        && s.t - lastT >= this.phase.minGap;
    },
    overlay: { elbowAs: 'setElbow', tilt: false, cog: false },
    timingText: '蹬地伸膝的同时手指弹击，不要只靠手臂硬推',
    standards: [
      { name: '手型高度', good: '额前上方', warn: '略低或略高', bad: '明显偏离额前', note: '以手腕相对肩/头的高度近似传球点' },
      { name: '两手间距', good: '靠拢成半球', warn: '略分开', bad: '明显分开', note: '正面机位更准' },
      { name: '传球肘角', good: '85° ~ 130°', warn: '70°~85° 或 130°~150°', bad: '< 70° 或 > 150°', note: '先屈肘接球，再伸送' },
      { name: '膝关节夹角', good: '130° ~ 165°', warn: '120°~130° 或 165°~175°', bad: '< 120° 或 > 175°', note: '微屈膝，不要深蹲' },
      { name: '躯干前倾角', good: '≤ 18°', warn: '18° ~ 28°', bad: '> 28°', note: '传球上体应较直' },
    ],
  },

  underhand: {
    id: 'underhand',
    icon: '↙️',
    name: '下手发球',
    examName: '下手发球',
    blurb: '考试核心：由下向前挥臂，击球点在腰腹以下，下肢配合蹬送。',
    camera: {
      best: '击球臂一侧的正侧面（推荐）',
      also: '看清挥臂轨迹与击球点高低即可。',
      framing: '全身入镜，发球方向朝画面一侧；先站直 1～2 秒再发球。',
      avoid: '从持球手一侧拍，挥臂会被身体挡住。',
    },
    metrics: {
      elbowExt, wristHigh: underWrist, knee: kneeLight, trunk: trunkBump,
    },
    combined: null,
    stdKeys: ['elbowExt', 'wristHigh', 'knee', 'trunk'],
    groups: [{ title: '挥臂与击球点', until: 'knee' }, { title: '下肢与躯干' }],
    focusOrder: ['wristHigh', 'elbowExt', 'knee', 'trunk'],
    weights: { arm: 0.4, lower: 0.3, trunk: 0.15, timing: 0.15 },
    reportMap: [
      { name: '挥臂', wKey: 'arm', keys: ['elbowExt', 'wristHigh'] },
      { name: '下肢', wKey: 'lower', keys: ['knee'] },
      { name: '躯干', wKey: 'trunk', keys: ['trunk'] },
      { name: '时机', wKey: 'timing', timing: true },
    ],
    tableKeys: [['elbowExt', '°'], ['wristHigh', ''], ['knee', '°'], ['trunk', '°']],
    chart: { kneeBand: [130, 165], series: [{ key: 'knee', color: '#00d4ff' }, { key: 'elbowExt', color: '#a78bff' }] },
    phase: { ...PHASE_BASE, minVy: -0.35 },
    detect(series, lastT) {
      const n = series.length;
      const peak = upPeak(series, n, this.phase.minVy);
      if (!peak) return false;
      const s = peak.s1;
      return s.belowShoulder
        && !s.aboveHead
        && (s.wristHigh == null || s.wristHigh <= 12)
        && (s.knee == null || s.knee < 172)
        && s.t - lastT >= this.phase.minGap;
    },
    overlay: { elbowAs: 'elbowExt', tilt: false, cog: false },
    timingText: '蹬地送髋的同时由下向前挥臂击球',
    standards: [
      { name: '击球臂伸直度', good: '160° ~ 180°', warn: '145° ~ 160°', bad: '< 145°', note: '击球瞬间手臂应基本伸直' },
      { name: '击球点高度', good: '腰腹以下', warn: '略高', bad: '接近肩以上', note: '下手发球的击球点应低' },
      { name: '膝关节夹角', good: '130° ~ 165°', warn: '120°~130° 或 165°~175°', bad: '过蹲或过直', note: '微屈膝便于蹬送' },
      { name: '躯干前倾角', good: '10° ~ 30°', warn: '5°~10° 或 30°~40°', bad: '< 5° 或 > 40°', note: '上体适当前倾' },
    ],
  },

  overhand: {
    id: 'overhand',
    icon: '↗️',
    name: '上手发球',
    examName: '上手发球',
    blurb: '考试核心：头上最高点击球、击球臂伸直、下肢蹬地配合。',
    camera: {
      best: '击球臂一侧的斜侧面 30°（推荐）',
      also: '能同时看到抛球手、挥臂与蹬地即可。',
      framing: '全身入镜，头顶留出空间（手臂上举不能出画）；先站直 1～2 秒。',
      avoid: '镜头过近导致起跳或举手出画；对面平拍看不清挥臂平面。',
    },
    metrics: {
      elbowExt, wristHigh, knee: kneeLight, trunk: trunkBump,
    },
    combined: null,
    stdKeys: ['elbowExt', 'wristHigh', 'knee', 'trunk'],
    groups: [{ title: '击球臂与击球点', until: 'knee' }, { title: '下肢与躯干' }],
    focusOrder: ['wristHigh', 'elbowExt', 'knee', 'trunk'],
    weights: { arm: 0.45, lower: 0.25, trunk: 0.15, timing: 0.15 },
    reportMap: [
      { name: '击球', wKey: 'arm', keys: ['elbowExt', 'wristHigh'] },
      { name: '下肢', wKey: 'lower', keys: ['knee'] },
      { name: '躯干', wKey: 'trunk', keys: ['trunk'] },
      { name: '时机', wKey: 'timing', timing: true },
    ],
    tableKeys: [['elbowExt', '°'], ['wristHigh', ''], ['knee', '°'], ['trunk', '°']],
    chart: { kneeBand: [130, 165], series: [{ key: 'knee', color: '#00d4ff' }, { key: 'elbowExt', color: '#a78bff' }] },
    phase: { ...PHASE_BASE, minGap: 0.9 },
    detect(series, lastT) {
      const n = series.length;
      const s = heightPeak(series, n);
      if (!s) return false;
      return s.aboveHead
        && (s.elbowMax == null || s.elbowMax >= 145)
        && s.t - lastT >= this.phase.minGap;
    },
    overlay: { elbowAs: 'elbowExt', tilt: false, cog: false },
    timingText: '蹬地转体的同时在头上最高点鞭打击球',
    standards: [
      { name: '击球臂伸直度', good: '160° ~ 180°', warn: '145° ~ 160°', bad: '< 145°', note: '上手击球瞬间手臂应伸直' },
      { name: '击球点高度', good: '头上方', warn: '略低', bad: '肩附近或更低', note: '应在头上最高点击球' },
      { name: '膝关节夹角', good: '130° ~ 165°', warn: '偏蹲或偏直', bad: '过蹲或完全伸直', note: '微屈后蹬伸' },
      { name: '躯干前倾角', good: '10° ~ 30°', warn: '5°~10° 或 30°~40°', bad: '< 5° 或 > 40°', note: '击球时上体跟进' },
    ],
  },

  spike: {
    id: 'spike',
    icon: '💥',
    name: '扣球',
    examName: '四号位扣球',
    blurb: '考试核心：助跑起跳、头上高点击球、击球臂充分伸直。',
    camera: {
      best: '击球臂一侧的斜侧面 30°～45°（推荐）',
      also: '要拍到完整助跑—起跳—挥臂，镜头拉远一些。',
      framing: '全身入镜，头顶和落地点都要留空；先站直 1～2 秒再助跑。',
      avoid: '镜头太近导致起跳出画；正后方拍不到挥臂面。',
    },
    metrics: {
      jumpRise, elbowExt, wristHigh, knee: kneeBump, trunk: trunkBump,
    },
    combined: null,
    stdKeys: ['jumpRise', 'elbowExt', 'wristHigh', 'knee', 'trunk'],
    groups: [{ title: '起跳与击球', until: 'knee' }, { title: '下肢与躯干' }],
    focusOrder: ['jumpRise', 'wristHigh', 'elbowExt', 'knee', 'trunk'],
    weights: { attack: 0.5, lower: 0.25, trunk: 0.1, timing: 0.15 },
    reportMap: [
      { name: '进攻', wKey: 'attack', keys: ['jumpRise', 'elbowExt', 'wristHigh'] },
      { name: '下肢', wKey: 'lower', keys: ['knee'] },
      { name: '躯干', wKey: 'trunk', keys: ['trunk'] },
      { name: '时机', wKey: 'timing', timing: true },
    ],
    tableKeys: [['jumpRise', '%'], ['elbowExt', '°'], ['wristHigh', ''], ['knee', '°'], ['trunk', '°']],
    chart: { kneeBand: [110, 150], series: [{ key: 'jumpRise', color: 'rgba(255,176,32,0.25)', fill: true }, { key: 'knee', color: '#00d4ff' }, { key: 'elbowExt', color: '#a78bff' }] },
    phase: { ...PHASE_BASE, minGap: 0.9 },
    detect(series, lastT) {
      const n = series.length;
      const s = heightPeak(series, n);
      if (!s) return false;
      return s.aboveHead
        && (s.jumpRise == null || s.jumpRise >= 2)
        && s.t - lastT >= this.phase.minGap;
    },
    overlay: { elbowAs: 'elbowExt', tilt: false, cog: false },
    timingText: '起跳接近最高点时挥臂鞭打，而不是落地后再捞球',
    standards: [
      { name: '起跳腾空', good: '有明显腾空', warn: '腾空偏小', bad: '几乎不起跳', note: '以髋部相对站立高度的上升近似' },
      { name: '击球臂伸直度', good: '160° ~ 180°', warn: '145° ~ 160°', bad: '< 145°', note: '扣球击球瞬间手臂应伸直' },
      { name: '击球点高度', good: '头上方', warn: '略低', bad: '肩附近', note: '应在起跳最高点、头上击球' },
      { name: '膝关节夹角', good: '110° ~ 150°（起跳前）', warn: '偏直或过蹲', bad: '几乎不屈膝', note: '助跑最后一步应明显屈膝起跳' },
      { name: '躯干前倾角', good: '10° ~ 30°', warn: '偏直或前倾过大', bad: '失控前倾', note: '空中收腹、落地缓冲' },
    ],
  },
};

export const SKILL_LIST = ['bump', 'set', 'underhand', 'overhand', 'spike'].map((id) => SKILLS[id]);

export function getSkill(id) {
  return SKILLS[id] || SKILLS.bump;
}

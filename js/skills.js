/* ============================================================
 * 北京大学排球课程 · 考试项目与评判标准
 *
 * 评分只发生在「技术窗口」内：
 *   垫/传/发：球体接近击球部位的触球瞬间（无球则回退人体相位）
 *   扣球：仅腾空段挥臂与击球点；地面挥臂不计分
 *
 * 下手发球 = 正面下手发球（面对球网），不是侧面下手发球。
 * 传球 = 正面双手传球。
 * ============================================================ */

function M(label, short, unit, range, zones, evaluate, fix) {
  return { label, short, unit, range, zones, evaluate, fix };
}

const kneeBump = M('膝关节夹角', '膝角', '°', [60, 180],
  [{ from: 100, to: 150, level: 'good' }, { from: 90, to: 100, level: 'warn' }, { from: 150, to: 165, level: 'warn' }],
  (v) => {
    if (v >= 100 && v <= 150) return { level: 'good', text: '半蹲到位，重心稳定，便于插臂与蹬送' };
    if (v > 150 && v <= 165) return { level: 'warn', text: '腿部偏直，建议再屈膝降低重心' };
    if (v > 165) return { level: 'bad', text: '双腿几乎伸直：重心过高，无法蹬地发力' };
    if (v >= 90) return { level: 'warn', text: '蹲得略低，注意保持移动弹性' };
    return { level: 'bad', text: '蹲得过低（接近文献跨步垫球极限膝屈），公体课不必蹲这么深' };
  },
  (v) => (v > 150 ? `再蹲低约 ${v - 150}°` : v < 100 ? `稍抬高重心约 ${100 - v}°` : null),
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

const kneeSpike = M('起跳前膝角', '起跳膝', '°', [60, 180],
  [{ from: 110, to: 130, level: 'good' }, { from: 96, to: 110, level: 'warn' }, { from: 130, to: 150, level: 'warn' }],
  (v) => {
    if (v >= 110 && v <= 130) return { level: 'good', text: '起跳前缓冲膝屈在 110°–130° 最优区间' };
    if (v >= 96 && v < 110) return { level: 'warn', text: '缓冲略深，蹬伸时注意髋—膝—踝依次加速' };
    if (v > 130 && v <= 150) return { level: 'warn', text: '起跳前膝屈不足，水平速度难转为垂直速度' };
    if (v > 150) return { level: 'bad', text: '几乎不屈膝起跳：助跑末步先制动再蹬伸' };
    return { level: 'bad', text: '蹲得过低，影响起跳爆发' };
  },
  (v) => (v > 130 ? `起跳前再屈膝约 ${v - 130}°` : v < 110 ? `缓冲不要过深，约抬 ${110 - v}°` : null),
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

/** 文献肩髋—水平 55°–72° ⇔ 本系统肩髋—竖直约 18°–35° */
const trunkBump = M('躯干前倾角', '躯干', '°', [0, 60],
  [{ from: 15, to: 35, level: 'good' }, { from: 8, to: 15, level: 'warn' }, { from: 35, to: 42, level: 'warn' }],
  (v) => {
    if (v >= 15 && v <= 35) return { level: 'good', text: '上体前倾稳定，接近教学/运动学参考区间' };
    if (v < 8) return { level: 'bad', text: '上体过直，含胸前倾再迎球' };
    if (v < 15) return { level: 'warn', text: '上体偏直，可稍前倾含胸准备' };
    if (v <= 42) return { level: 'warn', text: '前倾偏大，注意收紧核心' };
    return { level: 'bad', text: '前倾过度：重心易失控，抬起一点上体' };
  },
  (v) => (v < 15 ? `上体再前倾约 ${15 - v}°` : v > 35 ? `上体抬起约 ${v - 35}°` : null),
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
  [{ from: 145, to: 180, level: 'good' }, { from: 130, to: 145, level: 'warn' }],
  (v) => {
    if (v >= 145) return { level: 'good', text: '击球窗口内手臂充分伸展（公体课口径）' };
    if (v >= 130) return { level: 'warn', text: '手臂基本伸展；精英上手/扣球触球时仍有少量屈肘，但课堂应先求伸直' };
    return { level: 'bad', text: '屈肘击球：力量和方向都难控制' };
  },
  (v) => (v < 145 ? `击球窗口内再伸直约 ${145 - v}°` : null),
);

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
  [{ from: 4, to: 16, level: 'good' }, { from: 0, to: 4, level: 'warn' }, { from: 16, to: 22, level: 'warn' }],
  (v) => {
    if (v >= 4 && v <= 16) return { level: 'good', text: '手型在额前上方约一球距离，传球点合适' };
    if (v < 4) return { level: 'warn', text: '手型偏低，容易变成垫传' };
    if (v <= 22) return { level: 'warn', text: '手型略高，注意在额前而不是脑后' };
    return { level: 'bad', text: '传球点偏离额前，先把球接到额头前方' };
  },
  (v) => (v < 4 ? `手型再抬到额前上方` : v > 16 ? `手型略降到额前一球处` : null),
);

const handsGap = M('两手间距', '间距', '', [0, 40],
  [{ from: 0, to: 10, level: 'good' }, { from: 10, to: 16, level: 'warn' }],
  (v) => {
    if (v <= 10) return { level: 'good', text: '两手靠拢成半球形，拇指相对，传球手型稳定' };
    if (v <= 16) return { level: 'warn', text: '两手略分开，拇指食指再靠拢一些' };
    return { level: 'bad', text: '两手过开：球会从手中漏掉或飞偏' };
  },
  (v) => (v > 10 ? `两手再靠拢约 ${v - 10}` : null),
);

const setElbow = M('传球肘角', '肘角', '°', [60, 180],
  [{ from: 85, to: 130, level: 'good' }, { from: 70, to: 85, level: 'warn' }, { from: 130, to: 150, level: 'warn' }],
  (v) => {
    if (v >= 85 && v <= 130) return { level: 'good', text: '肘关节弯曲适中，便于手指弹击与缓冲' };
    if (v < 85) return { level: 'warn', text: '肘角过小，手腕容易僵硬' };
    if (v <= 150) return { level: 'warn', text: '肘角偏直，传球点容易靠后、变成拍击' };
    return { level: 'bad', text: '手臂过直：先屈肘把球接到额前再伸送' };
  },
  (v) => (v < 85 ? `肘角再打开约 ${85 - v}°` : v > 130 ? `肘角再弯曲约 ${v - 130}°` : null),
);

const underWrist = M('击球点高度', '击球点', '', [-8, 30],
  [{ from: -8, to: 6, level: 'good' }, { from: 6, to: 12, level: 'warn' }],
  (v) => {
    if (v <= 6) return { level: 'good', text: '正面下手击球点在腹前/腰腹以下，符合钟摆挥臂' };
    if (v <= 12) return { level: 'warn', text: '击球点略高，注意由下向前摆臂，不要撩成上手' };
    return { level: 'bad', text: '击球点过高：已接近上手，请保持正面下手挥臂' };
  },
  (v) => (v > 6 ? `击球点再放到腹前` : null),
);

const jumpRise = M('起跳腾空', '腾空', '%', [0, 25],
  [{ from: 6, to: 25, level: 'good' }, { from: 3, to: 6, level: 'warn' }],
  (v) => {
    if (v >= 6) return { level: 'good', text: '有明显起跳；扣球应在腾空最高点稍后击球' };
    if (v >= 3) return { level: 'warn', text: '腾空偏小，助跑起跳再充分一些' };
    return { level: 'bad', text: '几乎没有起跳：地面挥臂不计入扣球评分' };
  },
  (v) => (v < 6 ? `腾空再增加约 ${6 - v}%` : null),
);

const PHASE_BASE = {
  contactWindow: 0.14,
  scoreWindow: 0.18,
  minGap: 0.7,
  standKnee: 158,
  standCog: 6,
  ballNear: 0.14,
};

function upPeak(series, n, minVy) {
  if (n < 4) return null;
  const s0 = series[n - 3], s1 = series[n - 2], s2 = series[n - 1];
  const vPrev = (s0.y - series[n - 4].y) / Math.max(1e-3, s0.t - series[n - 4].t);
  const v1 = (s1.y - s0.y) / Math.max(1e-3, s1.t - s0.t);
  const v2 = (s2.y - s1.y) / Math.max(1e-3, s2.t - s1.t);
  if (v1 <= minVy && v1 <= vPrev && v1 <= v2) return { s1, v1 };
  return null;
}

function heightPeak(series, n) {
  if (n < 4) return null;
  const s0 = series[n - 3], s1 = series[n - 2], s2 = series[n - 1];
  if (s1.y <= s0.y && s1.y <= s2.y) return s1;
  return null;
}

/** 近期见过球则必须「球靠近击球部位」才算触球；否则回退人体相位 */
function ballGate(s, series, maxDist) {
  const recent = series.some((x) => x.ball && s.t - x.t < 1.4);
  if (!recent) return { ok: true, via: 'pose' };
  const near = s.hitDist != null && s.hitDist <= maxDist;
  return { ok: near, via: near ? 'ball' : 'miss' };
}

function incomingToss(s, series) {
  const win = series.filter((x) => x.ball && s.t - x.t <= 0.55 && s.t - x.t >= 0.12);
  return win.some((x) => x.ballOutside);
}

const CAM = {
  bump: {
    best: '后斜 45°（能同时看到前臂平面与下肢屈伸）',
    angle: '后斜 45°（备选正侧面）',
    distance: '3 – 4.5 m',
    height: '离地 1.0 – 1.2 m（髋高）',
    fps: '≥ 60 fps（对墙自垫建议 120 fps）',
    also: '需要看两臂是否夹紧成面时，可再补一段正面。手机尽量固定，人物占画面高度一半以上。',
    framing: '全身入镜，头顶与脚步留空；先自然站直 1～2 秒再开始。画面只留一名学生。',
    avoid: '纯正面看不清膝角；纯侧面远端手臂易被挡；俯拍/贴地仰拍会明显降低姿态精度。',
    cite: '单机位后斜约 4.3 m、镜头高 1.2 m 的垫球判别准确率 >95% [C1]；髋高优于近地 [C14]。',
  },
  set: {
    best: '正面或前斜 45°（看双手对称、肘外展与额前击球点）',
    angle: '正面 / 前斜 45°',
    distance: '5 – 10 m',
    height: '离地 1.2 – 1.5 m',
    fps: '60 fps（文献 30 fps 可做粗评）',
    also: '若要看蹬伸时序，可再加一段正侧面。',
    framing: '全身入镜，镜头略高于腰；先站直 1～2 秒。正面双手传球，正对来球。',
    avoid: '纯侧面看不清两手是否靠拢，也容易把手型高度估错。',
    cite: '传球研究常用约 10 m、垂直于运动平面 [C10]；额状面 2D 筛查与 3D 有中高相关 [C11]。',
  },
  underhand: {
    best: '击球臂一侧斜侧 45° 或正侧面（正面下手，面对球网）',
    angle: '斜侧 45° / 正侧面',
    distance: '4 – 8 m',
    height: '离地 0.9 – 1.2 m',
    fps: '≥ 60 fps',
    also: '可补一段正面确认两脚前后开立、身体是否正对球网——本项不是侧面下手发球。',
    framing: '全身入镜，发球方向朝画面一侧；先站直 1～2 秒。抛球离手约 20–30 cm 后钟摆击球。',
    avoid: '从持球手一侧拍会挡住挥臂；不要拍成侧面下手（体侧摆臂）的动作。',
    cite: '低速单平面动作，摆臂在矢状面；专项机位文献少，按教学动作平面推断 [C5][C6]。',
  },
  overhand: {
    best: '击球臂一侧正侧面（光轴垂直矢状面）',
    angle: '正侧面（击球臂一侧）',
    distance: '课堂 6 – 10 m（研究跳发 10 – 13 m）',
    height: '离地约 1.5 m',
    fps: '≥ 60 fps（跳发/鞭打建议手机慢动作 120 fps）',
    also: '可另加正后方看抛球是否偏到击球肩前上方。',
    framing: '全身入镜，头顶留空（手臂上举不能出画）；先站直 1～2 秒。',
    avoid: '镜头过近导致举手出画；对面平拍看不清挥臂平面；光轴偏离 30° 时水平速度误差约 2.5 倍。',
    cite: '跳发研究侧面 12–13 m、高 1.5 m、120 fps [C2]；侧面看肩外旋/抛球高度更可靠 [C4]。',
  },
  spike: {
    best: '击球臂一侧斜侧 45°（场角方向），拍完整助跑—起跳—空中挥臂',
    angle: '斜侧 45°（击球臂一侧）',
    distance: '6 – 10 m',
    height: '离地 1.2 – 1.5 m',
    fps: '建议手机慢动作 120 fps；快门尽量短，减少拖影',
    also: '只评起跳时序时可放宽到正侧面，但挥臂面仍以斜侧为准。',
    framing: '全身入镜，头顶和落地点都要留空；先站直 1～2 秒再助跑。',
    avoid: '镜头太近导致起跳出画；正后方拍不到挥臂面。地面空挥不能代替扣球。',
    cite: '扣球肩内旋峰值极高，30 fps 无法解析鞭打细节 [C9]；常用 120–240 fps [C7]。',
  },
};

function bumpSkill(spec) {
  const exam = spec.kind === 'self';
  return {
    id: spec.id,
    group: 'bump',
    kind: spec.kind,
    icon: '🤲',
    name: spec.name,
    examName: spec.examName,
    blurb: spec.blurb,
    needsBall: true,
    camera: CAM.bump,
    metrics: {
      platformExt: M('平台伸直度', '伸直', '°', [60, 180],
        [{ from: 165, to: 180, level: 'good' }, { from: 150, to: 165, level: 'warn' }],
        (v) => {
          if (v >= 165) return { level: 'good', text: '触球窗口内两臂伸直夹紧，击球平台稳定' };
          if (v >= 150) return { level: 'warn', text: '手臂基本伸直，触球瞬间再绷紧、压腕' };
          return { level: 'bad', text: '屈肘垫球容易失误：应打在前臂桡骨内侧平面，而不是手腕' };
        },
        (v) => (v < 165 ? `两臂再伸直约 ${165 - v}°` : null),
      ),
      platformSym: M('平台对称度', '对称', '°', [0, 40],
        [{ from: 0, to: 8, level: 'good' }, { from: 8, to: 15, level: 'warn' }],
        (v) => {
          if (v <= 8) return { level: 'good', text: '两臂对称共面，平台朝向稳定' };
          if (v <= 15) return { level: 'warn', text: '两臂略不对称，注意同时发力、夹紧成面' };
          return { level: 'bad', text: '两臂明显不对称或单臂击球：球容易飞偏' };
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
    combined: { title: '击球平台（触球窗口）', keys: ['platformExt', 'platformSym', 'platformTilt'] },
    stdKeys: ['knee', 'cog', 'trunk'],
    groups: [{ title: '下肢 · 迎球半蹲', until: 'trunk' }, { title: '躯干' }],
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
    chart: { kneeBand: [100, 150], series: [{ key: 'cog', color: 'rgba(255,176,32,0.25)', fill: true }, { key: 'knee', color: '#00d4ff' }, { key: 'platformExt', color: '#a78bff' }] },
    phase: { ...PHASE_BASE, minVy: exam ? -0.55 : -0.75, minGap: exam ? 0.55 : 0.75 },
    idleHint: {
      platformExt: '仅统计球体接近前臂的触球窗口',
      platformSym: '仅统计触球窗口',
      platformTilt: '仅统计触球窗口',
      knee: '仅统计迎球/触球窗口，站立等待不计分',
    },
    metricLive(key, m, ph) {
      if (ph === 'standing' || ph === 'none') return false;
      if (['platformExt', 'platformSym', 'platformTilt'].includes(key)) return ph === 'contact';
      return ph === 'contact' || ph === 'ready';
    },
    scoreSample(h) { return h.phase === 'contact'; },
    detect(series, lastT) {
      const n = series.length;
      const peak = upPeak(series, n, this.phase.minVy);
      if (!peak) return false;
      const s = peak.s1;
      const gate = ballGate(s, series, this.phase.ballNear);
      if (!gate.ok) return false;
      if (spec.kind === 'toss' && s.ball) {
        /* 抛–垫：优先球从身外进入；自垫漏选时仍允许触球，但会在报告注明 */
      }
      if (spec.kind === 'self' && s.ball && incomingToss(s, series) && gate.via === 'ball') {
        /* 自垫被抛球干扰时仍可计，由报告区分 */
      }
      const ok = s.belowShoulder
        && (s.knee == null || s.knee < 155)
        && (s.wristGap == null || s.wristGap < 0.28)
        && s.t - lastT >= this.phase.minGap;
      return ok ? { t: s.t, via: gate.via, tossLike: incomingToss(s, series) } : false;
    },
    overlay: { elbowAs: 'platformExt', tilt: true, cog: true },
    timingText: spec.kind === 'self'
      ? '连续自垫：球至腹前时蹬地送髋、抬臂，用腿送球而不是用手捞球'
      : '抛–垫：球下落到肩平面附近再「插—夹—提」（提肩、顶肘、压腕、抬臂），不要过早或过晚发力',
    refs: spec.kind === 'self' ? ['R1', 'R2', 'C1'] : ['R1', 'R2', 'R3', 'R5', 'C1'],
    standards: [
      { name: '平台伸直度', good: '165° ~ 180°', warn: '150° ~ 165°', bad: '< 150°', note: '触球瞬间两臂伸直夹紧；击球部位为腕上约 10 cm 前臂桡骨内侧平面，避免打在手腕 [R2]' },
      { name: '平台对称度', good: '≤ 8°', warn: '8° ~ 15°', bad: '> 15°', note: '两肘角度差；单臂、两臂不共面是常见错误 [R2]' },
      { name: '平台倾角', good: '25° ~ 45°', warn: '15°~25° 或 45°~55°', bad: '< 15° 或 > 55°', note: '前臂与水平面夹角，决定出球弧度' },
      { name: '膝关节夹角', good: '100° ~ 150°（公体半蹲）', warn: '90°~100° 或 150°~165°', bad: '< 90° 或 > 165°', note: '课堂半蹲迎球。文献跨步垫球最大膝屈可达约 60°，只作专项上限参考 [R1]' },
      { name: '髋部下降幅度', good: '≥ 12%', warn: '6% ~ 12%', bad: '< 6%', note: '以髋部高度近似重心' },
      { name: '躯干前倾角', good: '15° ~ 35°（相对竖直）', warn: '8°~15° 或 35°~42°', bad: '< 8° 或 > 42°', note: '对应文献肩髋连线与水平夹角约 55°–72° [R1]' },
      { name: '触球窗口', good: '球靠近前臂时计分', warn: '未检出球则回退人体相位', bad: '无球空挥不作为考试垫球', note: spec.kind === 'self' ? '自垫：球在体前上下，连续触球 [C1]' : '抛–垫：球由身外进入后再触球；发力约在球至肩平面上方 5–10 cm [R2]' },
    ],
  };
}

function setSkill(spec) {
  return {
    id: spec.id,
    group: 'set',
    kind: spec.kind,
    icon: '🖐️',
    name: spec.name,
    examName: spec.examName,
    blurb: spec.blurb,
    needsBall: true,
    camera: CAM.set,
    metrics: {
      wristHigh: wristSet, handsGap, setElbow, knee: kneeLight, trunk: trunkUpright,
    },
    combined: null,
    stdKeys: ['wristHigh', 'handsGap', 'setElbow', 'knee', 'trunk'],
    groups: [{ title: '额前手型（触球窗口）', until: 'knee' }, { title: '下肢与躯干' }],
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
    phase: { ...PHASE_BASE, minVy: -0.4, minGap: spec.kind === 'self' ? 0.55 : 0.75, ballNear: 0.12 },
    idleHint: {
      wristHigh: '仅统计球体接近额前手型的触球窗口',
      handsGap: '仅统计触球窗口',
      setElbow: '仅统计触球窗口',
    },
    metricLive(key, m, ph) {
      if (ph === 'standing' || ph === 'none') return false;
      if (['wristHigh', 'handsGap', 'setElbow'].includes(key)) return ph === 'contact';
      return ph === 'contact' || ph === 'ready';
    },
    scoreSample(h) { return h.phase === 'contact'; },
    detect(series, lastT) {
      const n = series.length;
      const s = heightPeak(series, n);
      if (!s) return false;
      const gate = ballGate(s, series, this.phase.ballNear);
      if (!gate.ok) return false;
      const ok = s.aboveBrow
        && (s.wristGap == null || s.wristGap < 0.22)
        && (s.knee == null || s.knee < 170)
        && s.t - lastT >= this.phase.minGap;
      return ok ? { t: s.t, via: gate.via, tossLike: incomingToss(s, series) } : false;
    },
    overlay: { elbowAs: 'setElbow', tilt: false, cog: false },
    timingText: spec.kind === 'self'
      ? '自传：蹬地伸膝的同时手指弹击，在额前上方完成拉—推，不要拍击球'
      : '抛–传：正对来球，球到额前约一球距离再伸送；下肢先蹬，再传到手上',
    refs: ['R37', 'R38', 'R40', 'R42'],
    standards: [
      { name: '手型高度', good: '额前上方约一球（15–20 cm）', warn: '略低或略高', bad: '明显偏离额前', note: '正面双手传球的击球点 [R37]' },
      { name: '两手间距', good: '靠拢成半球，拇指相对', warn: '略分开', bad: '明显分开 / 拇指朝前戳球', note: '正面机位更准' },
      { name: '传球肘角', good: '85° ~ 130°', warn: '70°~85° 或 130°~150°', bad: '< 70° 或 > 150°', note: '先屈肘缓冲，再伸送；熟练者存在肘→腕时序 [R40]' },
      { name: '膝关节夹角', good: '130° ~ 165°', warn: '120°~130° 或 165°~175°', bad: '< 120° 或 > 175°', note: '微屈膝，不要深蹲 [R42]' },
      { name: '躯干前倾角', good: '≤ 18°', warn: '18° ~ 28°', bad: '> 28°', note: '传球上体应较直，利于向上送球' },
      { name: '触球窗口', good: '球靠近额前双手时计分', warn: '未检出球则回退人体相位', bad: '无球比划手型不作为传球考试', note: spec.kind === 'self' ? '自传为基础练习' : '抛–传为考试内容：他人抛球后正面双手传出' },
    ],
  };
}

export const SKILLS = {
  selfBump: bumpSkill({
    id: 'selfBump',
    kind: 'self',
    name: '自垫球',
    examName: '正面双手垫球 · 自垫球（基础练习）',
    blurb: '基础练习：自己把球连续垫起，重点是击球平台稳定、节奏均匀。系统会看球是否在体前反复触臂。',
  }),
  tossBump: bumpSkill({
    id: 'tossBump',
    kind: 'toss',
    name: '抛–垫球',
    examName: '正面双手垫球 · 抛–垫球（考试）',
    blurb: '考试内容：他人抛球后接垫。准备半蹲，球由身外进入，至肩平面附近再插臂夹紧蹬送。',
  }),
  selfSet: setSkill({
    id: 'selfSet',
    kind: 'self',
    name: '自传球',
    examName: '正面双手传球 · 自传球（基础练习）',
    blurb: '基础练习：自己连续正面双手传球，练额前手型与上下肢协调。',
  }),
  tossSet: setSkill({
    id: 'tossSet',
    kind: 'toss',
    name: '抛–传球',
    examName: '正面双手传球 · 抛–传球（考试）',
    blurb: '考试内容：他人抛球后，正面双手在额前上方约一球处传出。不是侧面传球。',
  }),

  underhand: {
    id: 'underhand',
    group: 'serve',
    kind: 'front-under',
    icon: '🏐',
    name: '正面下手发球',
    examName: '发球 · 正面下手发球',
    blurb: '考试口径是正面下手发球：面对球网，两脚前后开立，腹前抛球后以肩为轴钟摆挥臂，击球点在腹前。不是侧面下手发球。',
    needsBall: true,
    camera: CAM.underhand,
    metrics: {
      elbowExt, wristHigh: underWrist, knee: kneeLight, trunk: trunkBump,
    },
    combined: null,
    stdKeys: ['elbowExt', 'wristHigh', 'knee', 'trunk'],
    groups: [{ title: '挥臂与腹前击球点（触球窗口）', until: 'knee' }, { title: '下肢与躯干' }],
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
    phase: { ...PHASE_BASE, minVy: -0.3, ballNear: 0.13 },
    idleHint: {
      elbowExt: '仅统计腹前触球窗口，练习空挥不计分',
      wristHigh: '仅统计触球窗口的击球点',
    },
    metricLive(key, m, ph) {
      if (ph === 'standing' || ph === 'none') return false;
      if (key === 'elbowExt' || key === 'wristHigh') return ph === 'contact';
      return ph === 'contact' || ph === 'ready';
    },
    scoreSample(h) { return h.phase === 'contact'; },
    detect(series, lastT) {
      const n = series.length;
      const peak = upPeak(series, n, this.phase.minVy);
      if (!peak) return false;
      const s = peak.s1;
      const gate = ballGate(s, series, this.phase.ballNear);
      if (!gate.ok) return false;
      const ok = s.belowShoulder
        && !s.aboveHead
        && (s.wristHigh == null || s.wristHigh <= 12)
        && (s.knee == null || s.knee < 172)
        && s.t - lastT >= this.phase.minGap;
      return ok ? { t: s.t, via: gate.via } : false;
    },
    overlay: { elbowAs: 'elbowExt', tilt: false, cog: false },
    timingText: '抛球约 20–30 cm 的同时击球臂后摆，右脚蹬地、重心前移，全掌击打球的后下方',
    refs: ['R16', 'R18', 'R19', 'R20'],
    standards: [
      { name: '技术类型', good: '正面下手（面对球网）', warn: '—', bad: '侧面下手', note: '两脚前后开立，持球腹前，钟摆挥臂；侧面下手不是本课程考试内容 [R16]' },
      { name: '击球臂伸直度', good: '145° ~ 180°', warn: '130° ~ 145°', bad: '< 130°', note: '以肩为轴、手臂伸直摆动，避免屈肘前撩 [R16]' },
      { name: '击球点高度', good: '腹前 / 腰腹以下', warn: '略高', bad: '接近肩以上', note: '击球点在腹前，全掌或掌根击打球的后下方 [R16]' },
      { name: '膝关节夹角', good: '130° ~ 165°', warn: '偏蹲或偏直', bad: '过蹲或过直', note: '两膝微屈，重心由后脚移至前脚' },
      { name: '躯干前倾角', good: '15° ~ 35°', warn: '略直或前倾过大', bad: '失控', note: '上体稍前倾；出手角教学参考约 40°–50° [R18]' },
      { name: '触球窗口', good: '球靠近击球手时计分', warn: '未检出球则回退', bad: '无球空挥', note: '下手发球定量生物力学文献少，以国内课程口径为主 [R19][R20]' },
    ],
  },

  overhand: {
    id: 'overhand',
    group: 'serve',
    kind: 'overhand',
    icon: '🏐',
    name: '上手发球',
    examName: '发球 · 上手发球',
    blurb: '头上最高点击球、击球臂伸展、抛球在击球肩前上方。挥臂只在头上触球窗口计分，地面引臂不计分。',
    needsBall: true,
    camera: CAM.overhand,
    metrics: {
      elbowExt, wristHigh, knee: kneeLight, trunk: trunkBump,
    },
    combined: null,
    stdKeys: ['elbowExt', 'wristHigh', 'knee', 'trunk'],
    groups: [{ title: '头上击球窗口', until: 'knee' }, { title: '下肢与躯干' }],
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
    phase: { ...PHASE_BASE, minGap: 0.9, ballNear: 0.13 },
    idleHint: {
      elbowExt: '仅统计头上触球窗口，引臂/空挥不计分',
      wristHigh: '仅统计头上击球点',
    },
    metricLive(key, m, ph) {
      if (ph === 'standing' || ph === 'none') return false;
      if (key === 'elbowExt' || key === 'wristHigh') return ph === 'contact' || !!(m && m.aboveHead);
      return ph === 'contact' || ph === 'ready';
    },
    scoreSample(h) { return h.phase === 'contact'; },
    detect(series, lastT) {
      const n = series.length;
      const s = heightPeak(series, n);
      if (!s) return false;
      const gate = ballGate(s, series, this.phase.ballNear);
      if (!gate.ok) return false;
      const ok = s.aboveHead
        && (s.elbowMax == null || s.elbowMax >= 130)
        && s.t - lastT >= this.phase.minGap;
      return ok ? { t: s.t, via: gate.via } : false;
    },
    overlay: { elbowAs: 'elbowExt', tilt: false, cog: false },
    timingText: '抛球在击球肩前上方约 50–70 cm，蹬地转体，在头上最高点鞭打；飘球手腕固定、随挥短促',
    refs: ['R7', 'R8', 'R10', 'C2'],
    standards: [
      { name: '击球臂伸直度', good: '145° ~ 180°（课堂）', warn: '130° ~ 145°', bad: '< 130°', note: '课堂要求头上伸展击球。女大学生触球肘屈约 48°–50°（约 130° 肘角）为精英参考，不作初学者硬门槛 [R8]' },
      { name: '击球点高度', good: '头上方最高点', warn: '略低', bad: '肩附近或更低', note: '抛球位于击球肩前上方，教学抛高约 50–70 cm [R7]' },
      { name: '膝关节夹角', good: '130° ~ 165°', warn: '偏蹲或偏直', bad: '过蹲或完全伸直', note: '微屈后蹬伸' },
      { name: '躯干前倾角', good: '15° ~ 35°', warn: '偏直或前倾过大', bad: '失控', note: '击球时上体跟进' },
      { name: '触球窗口', good: '球靠近头上手掌时计分', warn: '未检出球则回退', bad: '无球挥臂', note: '不评判肩内旋角速度（单目 2D 不可靠）[C9][R8]' },
    ],
  },

  spike: {
    id: 'spike',
    group: 'spike',
    kind: 'spike',
    icon: '💥',
    name: '扣球',
    examName: '四号位扣球',
    blurb: '只评价腾空段：助跑起跳后，在空中挥臂、头上击球。地面上怎么挥臂都不计分，建议也只针对空中击球窗口。',
    needsBall: true,
    camera: CAM.spike,
    metrics: {
      jumpRise, elbowExt, wristHigh, knee: kneeSpike, trunk: trunkBump,
    },
    combined: null,
    stdKeys: ['jumpRise', 'elbowExt', 'wristHigh', 'knee', 'trunk'],
    groups: [{ title: '腾空击球（唯一计分窗口）', until: 'knee' }, { title: '起跳前下肢' }],
    focusOrder: ['jumpRise', 'wristHigh', 'elbowExt', 'knee', 'trunk'],
    weights: { attack: 0.5, lower: 0.25, trunk: 0.1, timing: 0.15 },
    reportMap: [
      { name: '进攻', wKey: 'attack', keys: ['jumpRise', 'elbowExt', 'wristHigh'] },
      { name: '下肢', wKey: 'lower', keys: ['knee'] },
      { name: '躯干', wKey: 'trunk', keys: ['trunk'] },
      { name: '时机', wKey: 'timing', timing: true },
    ],
    tableKeys: [['jumpRise', '%'], ['elbowExt', '°'], ['wristHigh', ''], ['knee', '°'], ['trunk', '°']],
    chart: { kneeBand: [110, 130], series: [{ key: 'jumpRise', color: 'rgba(255,176,32,0.25)', fill: true }, { key: 'knee', color: '#00d4ff' }, { key: 'elbowExt', color: '#a78bff' }] },
    phase: { ...PHASE_BASE, minGap: 0.9, ballNear: 0.15, airMin: 3 },
    idleHint: {
      elbowExt: '地面挥臂不计分 · 只评腾空挥臂',
      wristHigh: '只评腾空头上击球点',
      jumpRise: '未腾空则不记扣球',
      knee: '膝角按起跳前缓冲期计分，空中伸膝不作为错误',
      trunk: '只评腾空击球窗口的躯干',
    },
    metricLive(key, m, ph) {
      const air = !!(m && (m.airborne || ph === 'airborne' || ph === 'contact' && m.jumpRise >= 3));
      if (key === 'jumpRise') return air || (m && m.jumpRise > 0);
      if (key === 'knee') return !air && ph !== 'standing';
      if (key === 'elbowExt' || key === 'wristHigh' || key === 'trunk') return air;
      return air;
    },
    scoreSample(h) {
      return !!h.airborne && (h.phase === 'contact' || h.phase === 'airborne');
    },
    scoreKey(key, h) {
      if (key === 'knee') return h.phase !== 'standing' && !h.airborne && h.phase !== 'contact';
      if (key === 'elbowExt' || key === 'wristHigh' || key === 'trunk') {
        return !!h.airborne && (h.phase === 'contact' || h.aboveHead);
      }
      if (key === 'jumpRise') return !!h.airborne;
      return this.scoreSample(h);
    },
    detect(series, lastT) {
      const n = series.length;
      const s = heightPeak(series, n);
      if (!s) return false;
      if (!s.airborne && !(s.jumpRise >= 3)) return false;
      const gate = ballGate(s, series, this.phase.ballNear);
      if (!gate.ok) return false;
      const ok = s.aboveHead && s.t - lastT >= this.phase.minGap;
      return ok ? { t: s.t, via: gate.via, airborne: true } : false;
    },
    overlay: { elbowAs: 'elbowExt', tilt: false, cog: false },
    timingText: '在重心最高点稍后、开始下落时击球；地面挥臂再标准也不计入扣球',
    refs: ['R8', 'R23', 'R24', 'R25', 'R27', 'C7', 'C9'],
    standards: [
      { name: '计分窗口', good: '腾空后的挥臂与击球', warn: '腾空偏小', bad: '未起跳的地面挥臂', note: '地面怎么挥臂都不评分；建议只针对空中击球窗口 [R27]' },
      { name: '起跳腾空', good: '有明显腾空', warn: '腾空偏小', bad: '几乎不起跳', note: '精英男质心跳高约 0.62 m 为上限参考 [R23]；本系统用髋部相对站立高度的上升近似' },
      { name: '起跳前膝角', good: '110° ~ 130°', warn: '96°~110° 或 130°~150°', bad: '几乎不屈膝', note: '缓冲期膝屈最优区间 [R24][R25]；空中伸膝不扣分' },
      { name: '击球臂伸直度', good: '145° ~ 180°（腾空）', warn: '130° ~ 145°', bad: '< 130°', note: '仅腾空触球窗口。精英触球肘屈约 34° 为参考，课堂先求伸展 [R8]' },
      { name: '击球点高度', good: '腾空头上方', warn: '略低', bad: '肩附近', note: '击球在重心最高点之后、开始下落时 [R27]' },
      { name: '躯干前倾角', good: '15° ~ 35°（腾空）', warn: '偏直或过大', bad: '失控前倾', note: '空中收腹；落地膝内扣属安全风险，单目仅能粗看 [R30]' },
    ],
  },
};

/** 旧版 id 兼容（档案里可能仍是 bump / set） */
const LEGACY = { bump: 'tossBump', set: 'tossSet' };

export const SKILL_LIST = [
  'selfBump', 'tossBump', 'selfSet', 'tossSet', 'overhand', 'underhand', 'spike',
].map((id) => SKILLS[id]);

export const SKILL_GROUPS = [
  {
    id: 'bump',
    icon: '🤲',
    name: '垫球',
    examName: '正面双手垫球',
    blurb: '上格自垫是基础练习，下格抛–垫才是考试接垫。',
    camera: CAM.bump.best,
    variants: [
      { id: 'selfBump', tag: '基础练习', title: '自垫球', desc: '自己连续垫，练平台与节奏' },
      { id: 'tossBump', tag: '考试内容', title: '抛–垫球', desc: '别人抛过来再接垫' },
    ],
  },
  {
    id: 'set',
    icon: '🖐️',
    name: '传球',
    examName: '正面双手传球',
    blurb: '上格自传是基础练习，下格抛–传才是考试。均为正面双手，不是侧面传球。',
    camera: CAM.set.best,
    variants: [
      { id: 'selfSet', tag: '基础练习', title: '自传球', desc: '自己连续正面双手传' },
      { id: 'tossSet', tag: '考试内容', title: '抛–传球', desc: '别人抛过来再正面传出' },
    ],
  },
  {
    id: 'serve',
    icon: '🏐',
    name: '发球',
    examName: '上手发球 / 正面下手发球',
    blurb: '同一格的两种发球。下手必须是正面下手（面对球网），不是侧面下手。',
    camera: '上手：正侧面 · 下手：斜侧 45°',
    variants: [
      { id: 'overhand', tag: '上手', title: '上手发球', desc: '头上最高点击球' },
      { id: 'underhand', tag: '正面下手', title: '正面下手发球', desc: '面对球网 · 腹前钟摆击球' },
    ],
  },
  {
    id: 'spike',
    icon: '💥',
    name: '扣球',
    examName: '四号位扣球',
    blurb: '只评腾空挥臂；地面挥臂不计分。',
    camera: CAM.spike.best,
    skillId: 'spike',
  },
];

export function getSkill(id) {
  return SKILLS[LEGACY[id] || id] || SKILLS.tossBump;
}

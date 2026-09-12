/* ============================================================
 * 垫球姿态评判标准（通用训练经验值，可按队伍要求调整）
 *
 * 每个指标包含：
 *   label  名称
 *   unit   单位
 *   range  仪表盘量程 [最小, 最大]
 *   zones  仪表盘色带（good=绿 / warn=黄），其余区域视为需纠正
 *   evaluate(v)  返回 { level: 'good'|'warn'|'bad', text: 提示语 }
 * ============================================================ */

export const METRICS = {
  elbowL: {
    label: '左肘关节夹角', short: '左肘', unit: '°', range: [60, 180],
    zones: [{ from: 165, to: 180, level: 'good' }, { from: 150, to: 165, level: 'warn' }],
    evaluate(v) {
      if (v >= 165) return { level: 'good', text: '手臂伸直，击球面稳定' };
      if (v >= 150) return { level: 'warn', text: '手臂基本伸直，触球瞬间再绷紧一些' };
      return { level: 'bad', text: '屈肘垫球容易失误：两臂应伸直、夹紧、压腕' };
    },
  },
  elbowR: {
    label: '右肘关节夹角', short: '右肘', unit: '°', range: [60, 180],
    zones: [{ from: 165, to: 180, level: 'good' }, { from: 150, to: 165, level: 'warn' }],
    evaluate(v) {
      if (v >= 165) return { level: 'good', text: '手臂伸直，击球面稳定' };
      if (v >= 150) return { level: 'warn', text: '手臂基本伸直，触球瞬间再绷紧一些' };
      return { level: 'bad', text: '屈肘垫球容易失误：两臂应伸直、夹紧、压腕' };
    },
  },
  kneeL: {
    label: '左膝关节夹角', short: '左膝', unit: '°', range: [60, 180],
    zones: [{ from: 110, to: 150, level: 'good' }, { from: 100, to: 110, level: 'warn' }, { from: 150, to: 165, level: 'warn' }],
    evaluate(v) {
      if (v >= 110 && v <= 150) return { level: 'good', text: '屈膝半蹲到位，重心稳定' };
      if (v > 150 && v <= 165) return { level: 'warn', text: '腿部偏直，建议再屈膝降低重心' };
      if (v > 165) return { level: 'bad', text: '双腿几乎伸直：重心过高，无法蹬地发力' };
      if (v >= 100) return { level: 'warn', text: '蹲得略低，注意保持移动弹性' };
      return { level: 'bad', text: '蹲得过低，影响起动与移动速度' };
    },
  },
  kneeR: {
    label: '右膝关节夹角', short: '右膝', unit: '°', range: [60, 180],
    zones: [{ from: 110, to: 150, level: 'good' }, { from: 100, to: 110, level: 'warn' }, { from: 150, to: 165, level: 'warn' }],
    evaluate(v) {
      if (v >= 110 && v <= 150) return { level: 'good', text: '屈膝半蹲到位，重心稳定' };
      if (v > 150 && v <= 165) return { level: 'warn', text: '腿部偏直，建议再屈膝降低重心' };
      if (v > 165) return { level: 'bad', text: '双腿几乎伸直：重心过高，无法蹬地发力' };
      if (v >= 100) return { level: 'warn', text: '蹲得略低，注意保持移动弹性' };
      return { level: 'bad', text: '蹲得过低，影响起动与移动速度' };
    },
  },
  trunk: {
    label: '躯干前倾角', short: '躯干', unit: '°', range: [0, 60],
    zones: [{ from: 10, to: 30, level: 'good' }, { from: 5, to: 10, level: 'warn' }, { from: 30, to: 40, level: 'warn' }],
    evaluate(v) {
      if (v >= 10 && v <= 30) return { level: 'good', text: '上体前倾角度合适' };
      if (v < 10) return { level: 'warn', text: '上体偏直，可稍前倾含胸准备' };
      if (v <= 40) return { level: 'warn', text: '前倾偏大，注意收紧核心' };
      return { level: 'bad', text: '前倾过度：重心易失控，抬起一点上体' };
    },
  },
  cog: {
    label: '重心下降幅度', short: '重心', unit: '%', range: [0, 30],
    zones: [{ from: 12, to: 30, level: 'good' }, { from: 6, to: 12, level: 'warn' }],
    evaluate(v) {
      if (v >= 12) return { level: 'good', text: '重心下降到位，保持这个高度迎球' };
      if (v >= 6) return { level: 'warn', text: '重心下降不够充分，再蹲低一点' };
      return { level: 'bad', text: '重心过高：请屈膝下蹲，降低重心再迎球' };
    },
  },
};

/* 报告权重（合计 1.0） */
export const REPORT_WEIGHTS = { elbow: 0.3, knee: 0.3, trunk: 0.15, cog: 0.25 };

/* 弹窗里的标准说明表 */
export const STANDARDS_DOC = [
  { name: '肘关节夹角', good: '165° ~ 180°', warn: '150° ~ 165°', bad: '< 150°', note: '触球瞬间两臂伸直夹紧，击球面才稳定' },
  { name: '膝关节夹角', good: '110° ~ 150°', warn: '100°~110° 或 150°~165°', bad: '< 100° 或 > 165°', note: '半蹲准备姿势，太直重心高、太低难移动' },
  { name: '躯干前倾角', good: '10° ~ 30°', warn: '5°~10° 或 30°~40°', bad: '< 5° 或 > 40°', note: '上体适当前倾含胸，便于蹬伸发力' },
  { name: '重心下降幅度', good: '≥ 12%', warn: '6% ~ 12%', bad: '< 6%', note: '相对站立时髋部高度的下降比例' },
];

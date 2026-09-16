/* ============================================================
 * 单目垂直方向 1D 标定（身高）
 *
 * 方法：站立段测量鼻点→两踝中点的画面归一化长度 S，
 * 对照人体测量学比例：眼高 ≈ 0.936 H、外踝 ≈ 0.039 H，
 * 故鼻–踝 ≈ 0.897 H（以鼻近似眼高）。
 *   cmPerNormY = (0.897 × 身高cm) / S
 * 垂直画面差 Δy 换算 Δh ≈ Δy × cmPerNormY。
 *
 * 依据：Drillis & Contini / Winter 人体比例；Komisar 等指出
 * 用身高做垂直 1D 标定，在光轴接近水平时近似替代 2D 网格 [C12]。
 *
 * 边界：不把厘米当作测距仪。透视、俯仰拍、侧倾会使误差增大；
 * 水平距离/球速仍不可靠。评分阈值仍用相对量，厘米仅作反馈。
 * ============================================================ */

export const NOSE_TO_ANKLE_FRAC = 0.936 - 0.039;

export const scaleState = {
  statureCm: null,
  cmPerNormY: null,
  bodySpan: null,
  hipStandY: null,
  cogBaseline: null,
  ready: false,
};

export function setStature(cm) {
  const n = Number(cm);
  scaleState.statureCm = (Number.isFinite(n) && n >= 140 && n <= 210) ? Math.round(n) : null;
  scaleState.cmPerNormY = null;
  scaleState.bodySpan = null;
  scaleState.ready = false;
}

export function resetVideoScale() {
  scaleState.cmPerNormY = null;
  scaleState.bodySpan = null;
  scaleState.hipStandY = null;
  scaleState.cogBaseline = null;
  scaleState.ready = false;
}

export function updateStandingScale(spanNorm) {
  if (!scaleState.statureCm || spanNorm == null) return;
  if (spanNorm < 0.28 || spanNorm > 0.98) return;
  const prev = scaleState.bodySpan;
  scaleState.bodySpan = prev ? prev * 0.85 + spanNorm * 0.15 : spanNorm;
  scaleState.cmPerNormY = (NOSE_TO_ANKLE_FRAC * scaleState.statureCm) / scaleState.bodySpan;
  scaleState.ready = scaleState.bodySpan >= 0.32 && scaleState.cmPerNormY > 50 && scaleState.cmPerNormY < 900;
}

export function unitsToCm(rel100) {
  if (!scaleState.ready || rel100 == null || !scaleState.cmPerNormY) return null;
  return Math.round((rel100 / 100) * scaleState.cmPerNormY);
}

export function jumpPctToCm(pct) {
  if (!scaleState.ready || pct == null || !scaleState.hipStandY || !scaleState.cmPerNormY) return null;
  return Math.round((pct / 100) * scaleState.hipStandY * scaleState.cmPerNormY);
}

export function cogPctToCm(pct) {
  if (!scaleState.ready || pct == null || !scaleState.cogBaseline || !scaleState.cmPerNormY) return null;
  return Math.round((pct / 100) * scaleState.cogBaseline * scaleState.cmPerNormY);
}

export function liftHint(v, target, noun = '击球点') {
  const d = target - v;
  if (d <= 0) return null;
  const cm = unitsToCm(d);
  if (cm != null) return `${noun}再抬高约 ${cm} cm（身高 1D 标定估算，仅垂直方向）`;
  return `${noun}再抬高一些（填写身高并先站直 1～2 秒后显示厘米）`;
}

export function lowerHint(v, target, noun = '击球点') {
  const d = v - target;
  if (d <= 0) return null;
  const cm = unitsToCm(d);
  if (cm != null) return `${noun}再放低约 ${cm} cm（估算，仅垂直方向）`;
  return `${noun}再放低一些（填写身高并站直后显示厘米）`;
}

export function dropHint(v, target, noun = '髋部') {
  const d = target - v;
  if (d <= 0) return null;
  const cm = cogPctToCm(d);
  if (cm != null) return `${noun}再下降约 ${cm} cm（估算）`;
  return `${noun}再下降约 ${d}%`;
}

export function jumpHint(v, target) {
  if (v >= target) return null;
  const cm = jumpPctToCm(target - v);
  if (cm != null) return `腾空再增加约 ${cm} cm（估算；精英质心跳高约 62 cm 为上限参考）`;
  return `腾空再增加约 ${target - v}%`;
}

export function gapHint(v, target) {
  if (v <= target) return null;
  const cm = unitsToCm(v - target);
  if (cm != null) return `两手再靠拢约 ${cm} cm（估算）`;
  return `两手再靠拢约 ${v - target}`;
}

export function formatScaled(def, v) {
  if (v == null || !def) return { n: '--', unit: def?.unit || '', title: '' };
  if (def.scale === 'vert' || def.scale === 'len') {
    const cm = unitsToCm(v);
    if (cm != null) {
      return {
        n: String(cm),
        unit: 'cm',
        title: `画面相对分 ${v}；鼻–踝 ≈ 0.897×身高 的垂直 1D 标定`,
      };
    }
  }
  if (def.scale === 'jump') {
    const cm = jumpPctToCm(v);
    if (cm != null) return { n: String(cm), unit: 'cm', title: `相对站立髋高 ${v}%` };
  }
  if (def.scale === 'cog') {
    const cm = cogPctToCm(v);
    if (cm != null) return { n: String(cm), unit: 'cm', title: `相对腿长 ${v}%` };
  }
  return { n: String(v), unit: def.unit || '', title: '' };
}

export function calibCaption() {
  if (!scaleState.statureCm) return '未填身高：长度反馈暂无厘米';
  if (!scaleState.ready) return `身高 ${scaleState.statureCm} cm · 请全身入镜并先站直 1～2 秒完成垂直标定`;
  return `身高 ${scaleState.statureCm} cm · 垂直标定约 ${Math.round(scaleState.cmPerNormY)} cm / 画面全高`;
}

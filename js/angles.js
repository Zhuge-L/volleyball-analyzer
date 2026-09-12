/* ============================================================
 * 角度与几何计算（基于 MediaPipe 归一化关键点坐标）
 * 关键点索引（共 33 个）：
 *   0 鼻 | 11/12 左/右肩 | 13/14 左/右肘 | 15/16 左/右腕
 *   23/24 左/右髋 | 25/26 左/右膝 | 27/28 左/右踝
 * ============================================================ */

/** 三点夹角：以 b 为顶点，返回角度（度），无法计算时返回 null */
export function angleABC(a, b, c) {
  if (!a || !b || !c) return null;
  const abx = a.x - b.x, aby = a.y - b.y;
  const cbx = c.x - b.x, cby = c.y - b.y;
  const m1 = Math.hypot(abx, aby);
  const m2 = Math.hypot(cbx, cby);
  if (m1 < 1e-6 || m2 < 1e-6) return null;
  const cos = Math.min(1, Math.max(-1, (abx * cbx + aby * cby) / (m1 * m2)));
  return Math.round((Math.acos(cos) * 180) / Math.PI);
}

/** 两点中点 */
export function mid(p, q) {
  return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
}

/** 躯干前倾角：肩髋连线与竖直方向的夹角（度） */
export function trunkLean(shoulderMid, hipMid) {
  const dx = shoulderMid.x - hipMid.x;
  const dy = hipMid.y - shoulderMid.y; // 图像 y 轴向下，站立时髋在肩下方
  if (dy <= 0) return null; // 异常姿态（如倒地）不评估
  return Math.round((Math.atan2(Math.abs(dx), dy) * 180) / Math.PI);
}

/** 关键点可见度是否达标 */
export function visible(lm, indices, threshold = 0.4) {
  return indices.every((i) => (lm[i].visibility ?? 1) >= threshold);
}

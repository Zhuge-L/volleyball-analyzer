/* ============================================================
 * 排球检测：MediaPipe ObjectDetector（COCO sports ball）
 * + 黄/白球体颜色块回退。输出归一化中心点，供触球窗口判定。
 * ============================================================ */

const BALL_NAME = /ball/i;
const TRACK_KEEP = 0.45;

let colorCanvas = null;
let colorCtx = null;
let lastBall = null;

function ensureColorCanvas() {
  if (colorCanvas) return;
  colorCanvas = document.createElement('canvas');
  colorCtx = colorCanvas.getContext('2d', { willReadFrequently: true });
}

export function resetBallTrack() {
  lastBall = null;
}

function toNorm(box, vw, vh) {
  const cx = (box.originX + box.width / 2) / vw;
  const cy = (box.originY + box.height / 2) / vh;
  const r = Math.max(box.width / vw, box.height / vh) / 2;
  return { x: cx, y: cy, r, score: 0, via: 'model' };
}

export function pickBallFromDetections(detections, vw, vh) {
  let best = null;
  for (const d of detections || []) {
    const cat = d.categories && d.categories[0];
    if (!cat || !BALL_NAME.test(cat.categoryName || '')) continue;
    const box = d.boundingBox;
    if (!box) continue;
    const hit = toNorm(box, vw, vh);
    hit.score = cat.score || 0;
    if (hit.x < -0.05 || hit.x > 1.05 || hit.y < -0.05 || hit.y > 1.05) continue;
    if (!best || hit.score > best.score) best = hit;
  }
  return best;
}

/** 简易黄/白圆形色块：用于模型漏检时的回退 */
export function detectBallByColor(video) {
  if (!video.videoWidth) return null;
  ensureColorCanvas();
  const w = 160;
  const h = Math.max(90, Math.round((video.videoHeight / video.videoWidth) * w));
  colorCanvas.width = w;
  colorCanvas.height = h;
  colorCtx.drawImage(video, 0, 0, w, h);
  let data;
  try {
    data = colorCtx.getImageData(0, 0, w, h).data;
  } catch {
    return null;
  }

  let sx = 0, sy = 0, n = 0, nYellow = 0;
  for (let y = 2; y < h - 2; y += 2) {
    for (let x = 2; x < w - 2; x += 2) {
      const i = (y * w + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const v = max / 255;
      const s = max === 0 ? 0 : (max - min) / max;
      let hue = 0;
      if (max !== min) {
        const d = max - min;
        if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) * 60;
        else if (max === g) hue = ((b - r) / d + 2) * 60;
        else hue = ((r - g) / d + 4) * 60;
      }
      const yellow = hue >= 28 && hue <= 62 && s > 0.32 && v > 0.42;
      const white = s < 0.18 && v > 0.82 && r > 170 && g > 170 && b > 150;
      if (yellow || white) {
        sx += x; sy += y; n += 1;
        if (yellow) nYellow += 1;
      }
    }
  }
  if (n < 18) return null;
  const cx = sx / n / w;
  const cy = sy / n / h;
  const frac = n / ((w * h) / 4);
  if (frac < 0.004 || frac > 0.18) return null;
  if (nYellow / n < 0.18 && frac > 0.08) return null; // 大片白墙
  return { x: cx, y: cy, r: Math.sqrt(frac) * 0.55, score: Math.min(0.7, 0.25 + nYellow / n), via: 'color' };
}

export function smoothBall(next, dt = 0.08) {
  if (!next) {
    if (lastBall && lastBall.age < TRACK_KEEP) {
      lastBall = { ...lastBall, age: lastBall.age + dt, stale: true };
      return lastBall;
    }
    lastBall = null;
    return null;
  }
  if (lastBall && Math.hypot(next.x - lastBall.x, next.y - lastBall.y) < 0.35) {
    lastBall = {
      x: lastBall.x * 0.45 + next.x * 0.55,
      y: lastBall.y * 0.45 + next.y * 0.55,
      r: lastBall.r * 0.5 + next.r * 0.5,
      score: next.score,
      via: next.via,
      age: 0,
      stale: false,
    };
  } else {
    lastBall = { ...next, age: 0, stale: false };
  }
  return lastBall;
}

/** 球体到击球点（双手腕 / 前臂中点）的最小归一化距离 */
export function ballHitDistance(ball, lm) {
  if (!ball || !lm) return null;
  const pts = [];
  for (const i of [15, 16, 13, 14]) {
    if ((lm[i].visibility ?? 1) >= 0.3) pts.push(lm[i]);
  }
  if ((lm[13]?.visibility ?? 0) >= 0.3 && (lm[15]?.visibility ?? 0) >= 0.3) {
    pts.push({ x: (lm[13].x + lm[15].x) / 2, y: (lm[13].y + lm[15].y) / 2 });
  }
  if ((lm[14]?.visibility ?? 0) >= 0.3 && (lm[16]?.visibility ?? 0) >= 0.3) {
    pts.push({ x: (lm[14].x + lm[16].x) / 2, y: (lm[14].y + lm[16].y) / 2 });
  }
  if (!pts.length) return null;
  return Math.min(...pts.map((p) => Math.hypot(p.x - ball.x, p.y - ball.y)));
}

export function ballOutsideBody(ball, lm) {
  if (!ball || !lm) return false;
  const xs = [11, 12, 23, 24].map((i) => lm[i]).filter((p) => (p.visibility ?? 1) >= 0.3);
  if (xs.length < 3) return false;
  const minX = Math.min(...xs.map((p) => p.x)) - 0.12;
  const maxX = Math.max(...xs.map((p) => p.x)) + 0.12;
  const minY = Math.min(...xs.map((p) => p.y)) - 0.18;
  const maxY = Math.max(...xs.map((p) => p.y)) + 0.22;
  return ball.x < minX || ball.x > maxX || ball.y < minY || ball.y > maxY;
}

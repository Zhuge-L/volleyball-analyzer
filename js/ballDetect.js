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
    // 全身取景时排球通常只占画面很小一块；过大的框多为地板、灯光或人物误检。
    if (hit.r < 0.004 || hit.r > 0.085) continue;
    if (!best || hit.score > best.score) best = hit;
  }
  return best;
}

/**
 * 黄/白近圆连通块：用于模型漏检时的回退。
 * 不能把全画面的同色像素直接平均，否则木地板和窗户反光会合成一个巨大假球。
 */
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

  const step = 2;
  const gw = Math.floor(w / step), gh = Math.floor(h / step);
  const mask = new Uint8Array(gw * gh);
  const yellowMask = new Uint8Array(gw * gh);
  for (let gy = 1; gy < gh - 1; gy++) {
    for (let gx = 1; gx < gw - 1; gx++) {
      const x = gx * step, y = gy * step;
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
        const k = gy * gw + gx;
        mask[k] = 1;
        yellowMask[k] = yellow ? 1 : 0;
      }
    }
  }

  const seen = new Uint8Array(mask.length);
  let best = null;
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    const queue = [start];
    seen[start] = 1;
    let q = 0, n = 0, nYellow = 0, sx = 0, sy = 0;
    let minX = gw, maxX = 0, minY = gh, maxY = 0;
    while (q < queue.length) {
      const k = queue[q++];
      const x = k % gw, y = Math.floor(k / gw);
      n++; nYellow += yellowMask[k]; sx += x; sy += y;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          if (!ox && !oy) continue;
          const nx = x + ox, ny = y + oy;
          if (nx < 0 || nx >= gw || ny < 0 || ny >= gh) continue;
          const nk = ny * gw + nx;
          if (mask[nk] && !seen[nk]) { seen[nk] = 1; queue.push(nk); }
        }
      }
    }
    const bw = maxX - minX + 1, bh = maxY - minY + 1;
    const aspect = bw / Math.max(1, bh);
    const fill = n / Math.max(1, bw * bh);
    const radius = Math.max(bw / gw, bh / gh) / 2;
    if (n < 5 || n > 100 || aspect < 0.55 || aspect > 1.8 || fill < 0.28) continue;
    if (radius < 0.005 || radius > 0.075) continue;
    const yellowShare = nYellow / n;
    const score = fill * 0.45 + yellowShare * 0.35 + Math.min(n / 35, 1) * 0.2;
    if (!best || score > best.score) {
      best = {
        x: (sx / n * step) / w,
        y: (sy / n * step) / h,
        r: radius,
        score: Math.min(0.78, score),
        via: 'color',
      };
    }
  }
  return best;
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

/** 球体到当前技术实际击球部位的最小归一化距离。 */
export function ballHitDistance(ball, lm, group = '') {
  if (!ball || !lm) return null;
  const pts = [];
  if (group === 'bump') {
    // 垫球接触在腕上方前臂，不把肘部本身当作触球点。
    for (const [e, w] of [[13, 15], [14, 16]]) {
      if ((lm[e]?.visibility ?? 0) < 0.3 || (lm[w]?.visibility ?? 0) < 0.3) continue;
      pts.push({
        x: lm[e].x * 0.35 + lm[w].x * 0.65,
        y: lm[e].y * 0.35 + lm[w].y * 0.65,
      });
    }
  } else {
    // 传球、发球和扣球以手腕附近作为单目手部位置近似。
    for (const i of [15, 16]) {
      if ((lm[i]?.visibility ?? 0) >= 0.3) pts.push(lm[i]);
    }
    if (group === 'set' && pts.length === 2) {
      pts.push({ x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 });
    }
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

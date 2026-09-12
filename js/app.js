/* ============================================================
 * VolleySense 主逻辑
 * 上传视频 → MediaPipe 姿态识别 → 画面叠加骨架/角度 →
 * 实时仪表盘 + 提示 → 角度曲线 → 训练报告
 * ============================================================ */

import { createPoseEngine, BONES, ANGLE_JOINTS } from './poseEngine.js';
import { METRICS, REPORT_WEIGHTS, STANDARDS_DOC } from './standards.js';
import { angleABC, mid, trunkLean, visible } from './angles.js';

const $ = (s) => document.querySelector(s);

/* ---------- DOM ---------- */
const hero = $('#hero');
const analyzer = $('#analyzer');
const dropZone = $('#drop-zone');
const fileInput = $('#file-input');
const video = $('#video');
const overlay = $('#overlay');
const octx = overlay.getContext('2d');
const stageLoading = $('#stage-loading');
const loadingText = $('#loading-text');
const btnPlay = $('#btn-play');
const btnReport = $('#btn-report');
const btnReset = $('#btn-reset');
const speedSel = $('#speed');
const timeLabel = $('#time-label');
const dash = $('#dash');
const chartCanvas = $('#chart');
const chartCtx = chartCanvas.getContext('2d');
const reportCard = $('#report-card');
const reportBody = $('#report-body');
const modal = $('#modal');

/* ---------- 状态 ---------- */
let landmarker = null;        // MediaPipe 识别器
let videoURL = null;
let history = [];             // { t, elbowL, elbowR, kneeL, kneeR, trunk, cog }
let cogBaseline = 0;          // 站立时的「踝-髋」纵向距离（归一化），取全程最大值
let smooth = {};              // 平滑后的展示值
let lastSampleT = -1;         // 上次采样时间点（节流）
let rafId = 0;
let usingRVFC = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;

const LEVEL_COLOR = { good: '#2ee6a8', warn: '#ffb020', bad: '#ff5470', none: '#93a0bd' };

/* ============================================================
 * 仪表盘：根据评判标准自动生成指标卡片
 * ============================================================ */
const metricEls = {};
(function buildDashboard() {
  for (const [key, def] of Object.entries(METRICS)) {
    const card = document.createElement('div');
    card.className = 'metric-card';
    card.innerHTML = `
      <div class="metric-top">
        <span class="metric-name">${def.label}</span>
        <span class="pill none">等待检测</span>
      </div>
      <div class="metric-value">--<small>${def.unit}</small></div>
      <div class="gauge">
        ${def.zones.map((z) => {
          const [min, max] = def.range;
          const l = ((z.from - min) / (max - min)) * 100;
          const w = ((z.to - z.from) / (max - min)) * 100;
          return `<span class="zone ${z.level}" style="left:${l}%;width:${w}%"></span>`;
        }).join('')}
        <span class="marker" style="left:0%"></span>
      </div>
      <p class="metric-msg"></p>`;
    dash.appendChild(card);
    metricEls[key] = {
      card,
      pill: card.querySelector('.pill'),
      value: card.querySelector('.metric-value'),
      marker: card.querySelector('.marker'),
      msg: card.querySelector('.metric-msg'),
    };
  }
  const tips = document.createElement('div');
  tips.className = 'tips-card';
  tips.innerHTML = `<h4>💡 实时纠正提示</h4><ul class="tips-list" id="tips-list"><li class="good">上传视频后点击「播放分析」开始</li></ul>`;
  dash.appendChild(tips);
})();

/* ============================================================
 * 评判标准弹窗
 * ============================================================ */
(function buildStandardsTable() {
  const rows = STANDARDS_DOC.map((d) => `
    <tr>
      <td><b>${d.name}</b></td>
      <td class="tag-good">${d.good}</td>
      <td class="tag-warn">${d.warn}</td>
      <td class="tag-bad">${d.bad}</td>
    </tr>
    <tr><td colspan="4" style="color:var(--text-dim);font-size:12.5px;padding-top:0;border-bottom:1px solid var(--stroke)">${d.note}</td></tr>`).join('');
  $('#standards-table').innerHTML = `
    <table class="std-table">
      <thead><tr><th>指标</th><th>✅ 理想</th><th>⚠️ 可接受</th><th>⛔ 需纠正</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
})();

$('#btn-standards').addEventListener('click', () => (modal.hidden = false));
modal.addEventListener('click', (e) => { if (e.target.hasAttribute('data-close')) modal.hidden = true; });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') modal.hidden = true; });

/* ============================================================
 * 视频上传
 * ============================================================ */
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });
fileInput.addEventListener('change', () => fileInput.files[0] && loadFile(fileInput.files[0]));
['dragover', 'dragleave', 'drop'].forEach((evt) =>
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropZone.classList.toggle('dragover', evt === 'dragover');
    if (evt === 'drop' && e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
  })
);

function loadFile(file) {
  if (!file.type.startsWith('video/')) { alert('请选择视频文件'); return; }
  if (videoURL) URL.revokeObjectURL(videoURL);
  videoURL = URL.createObjectURL(file);
  video.src = videoURL;
  hero.hidden = true;
  analyzer.hidden = false;
  reportCard.hidden = true;
  history = [];
  cogBaseline = 0;
  smooth = {};
  lastSampleT = -1;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  ensureModel();
  // 布局切换后下一帧再对齐一次 canvas
  requestAnimationFrame(() => syncOverlaySize());
}

/* ============================================================
 * 模型加载
 * ============================================================ */
let modelPromise = null;
function ensureModel() {
  if (landmarker) return Promise.resolve();
  if (modelPromise) return modelPromise;
  stageLoading.hidden = false;
  loadingText.textContent = '正在下载 AI 模型（首次约 10MB，请稍候）…';
  modelPromise = createPoseEngine()
    .then((lm) => {
      landmarker = lm;
      stageLoading.hidden = true;
      loadingText.textContent = '模型就绪';
      detectOnce(); // 先在当前帧画一次
    })
    .catch((err) => {
      console.error(err);
      loadingText.textContent = '模型加载失败，请检查网络后刷新页面重试';
      modelPromise = null;
    });
  return modelPromise;
}

/* ============================================================
 * 播放控制
 * ============================================================ */
btnPlay.addEventListener('click', async () => {
  await ensureModel();
  if (!landmarker) return;
  if (video.paused) video.play(); else video.pause();
});
video.addEventListener('play', () => {
  syncOverlaySize();
  btnPlay.textContent = '⏸ 暂停';
  scheduleNext();
});
video.addEventListener('pause', () => { btnPlay.textContent = '▶ 播放分析'; cancelAnimationFrame(rafId); });
video.addEventListener('ended', () => { btnPlay.textContent = '▶ 重新播放'; buildReport(); });
speedSel.addEventListener('change', () => (video.playbackRate = parseFloat(speedSel.value)));
video.addEventListener('loadedmetadata', () => {
  syncOverlaySize();
  updateTimeLabel();
});
video.addEventListener('timeupdate', updateTimeLabel);
video.addEventListener('seeked', () => { if (video.paused) detectOnce(); });

/** 让 canvas 像素尺寸与视频一致，CSS 尺寸与视频显示区域一致 */
function syncOverlaySize() {
  if (!video.videoWidth) return;
  overlay.width = video.videoWidth;
  overlay.height = video.videoHeight;
  // 双保险：显式对齐到 video 当前渲染尺寸（竖屏视频尤其重要）
  overlay.style.width = `${video.clientWidth}px`;
  overlay.style.height = `${video.clientHeight}px`;
}

btnReset.addEventListener('click', () => {
  video.pause();
  if (videoURL) URL.revokeObjectURL(videoURL);
  videoURL = null;
  video.removeAttribute('src');
  video.load();
  analyzer.hidden = true;
  hero.hidden = false;
  fileInput.value = '';
  octx.clearRect(0, 0, overlay.width, overlay.height);
  clearChart();
});

function updateTimeLabel() {
  timeLabel.textContent = `${fmt(video.currentTime)} / ${fmt(video.duration || 0)}`;
}
function fmt(s) {
  if (!isFinite(s)) s = 0;
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/* ============================================================
 * 逐帧识别循环
 * ============================================================ */
function scheduleNext() {
  if (usingRVFC) {
    video.requestVideoFrameCallback(() => tick());
  } else {
    rafId = requestAnimationFrame(() => tick());
  }
}

function tick() {
  if (video.paused || video.ended) return;
  runDetection();
  scheduleNext();
}

function detectOnce() {
  if (!landmarker || !video.videoWidth) return;
  runDetection();
}

function runDetection() {
  const result = landmarker.detectForVideo(video, performance.now());
  const lm = result.landmarks && result.landmarks[0];
  const metrics = computeMetrics(lm);
  drawOverlay(lm, metrics);
  updateDashboard(metrics);
  sampleHistory(metrics);
}

/* ============================================================
 * 指标计算
 * ============================================================ */
function computeMetrics(lm) {
  if (!lm) return null;
  const m = {};

  if (visible(lm, [11, 13, 15])) m.elbowL = angleABC(lm[11], lm[13], lm[15]);
  if (visible(lm, [12, 14, 16])) m.elbowR = angleABC(lm[12], lm[14], lm[16]);
  if (visible(lm, [23, 25, 27])) m.kneeL = angleABC(lm[23], lm[25], lm[27]);
  if (visible(lm, [24, 26, 28])) m.kneeR = angleABC(lm[24], lm[26], lm[28]);

  if (visible(lm, [11, 12, 23, 24])) {
    m.trunk = trunkLean(mid(lm[11], lm[12]), mid(lm[23], lm[24]));
  }

  // 重心：髋部中点相对脚踝的纵向距离，与站立基准对比
  if (visible(lm, [23, 24, 27, 28])) {
    const legLen = mid(lm[27], lm[28]).y - mid(lm[23], lm[24]).y;
    if (legLen > 0.05) {
      cogBaseline = Math.max(cogBaseline, legLen);
      m.cog = Math.round(((cogBaseline - legLen) / cogBaseline) * 100);
    }
  }

  // 指数平滑，减少抖动
  for (const k of Object.keys(METRICS)) {
    if (m[k] == null) continue;
    smooth[k] = smooth[k] == null ? m[k] : Math.round(smooth[k] * 0.6 + m[k] * 0.4);
    m[k] = smooth[k];
  }
  return m;
}

/* ============================================================
 * 画面叠加：骨架 + 角度标注 + 重心线
 * ============================================================ */
function drawOverlay(lm, metrics) {
  const W = overlay.width, H = overlay.height;
  octx.clearRect(0, 0, W, H);
  if (!lm) return;

  // 骨架
  octx.lineWidth = Math.max(3, W / 320);
  octx.lineCap = 'round';
  octx.shadowBlur = 12;
  octx.shadowColor = 'rgba(0, 212, 255, 0.8)';
  octx.strokeStyle = 'rgba(0, 212, 255, 0.9)';
  for (const [a, b] of BONES) {
    if ((lm[a].visibility ?? 1) < 0.3 || (lm[b].visibility ?? 1) < 0.3) continue;
    octx.beginPath();
    octx.moveTo(lm[a].x * W, lm[a].y * H);
    octx.lineTo(lm[b].x * W, lm[b].y * H);
    octx.stroke();
  }
  // 关节点
  octx.shadowBlur = 0;
  octx.fillStyle = '#fff';
  for (const idx of [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
    if ((lm[idx].visibility ?? 1) < 0.3) continue;
    octx.beginPath();
    octx.arc(lm[idx].x * W, lm[idx].y * H, Math.max(3.5, W / 220), 0, Math.PI * 2);
    octx.fill();
  }

  // 角度标注（直接画在关节旁边）
  if (metrics) {
    const jointValue = { 13: metrics.elbowL, 14: metrics.elbowR, 25: metrics.kneeL, 26: metrics.kneeR };
    const jointMetric = { 13: 'elbowL', 14: 'elbowR', 25: 'kneeL', 26: 'kneeR' };
    for (const j of ANGLE_JOINTS) {
      const v = jointValue[j.idx];
      if (v == null || (lm[j.idx].visibility ?? 1) < 0.3) continue;
      const level = METRICS[jointMetric[j.idx]].evaluate(v).level;
      drawBadge(lm[j.idx].x * W, lm[j.idx].y * H, `${j.name} ${v}°`, LEVEL_COLOR[level]);
    }
    // 重心参考线（髋部高度）
    if (metrics.cog != null) {
      const hipY = mid(lm[23], lm[24]).y * H;
      const lv = METRICS.cog.evaluate(metrics.cog).level;
      octx.save();
      octx.setLineDash([10, 8]);
      octx.lineWidth = 2;
      octx.strokeStyle = LEVEL_COLOR[lv];
      octx.beginPath();
      octx.moveTo(0, hipY);
      octx.lineTo(W, hipY);
      octx.stroke();
      octx.restore();
      drawBadge(W * 0.04, hipY - 14, `重心 ↓${metrics.cog}%`, LEVEL_COLOR[lv]);
    }
  }
}

function drawBadge(x, y, text, color) {
  const W = overlay.width;
  const fontSize = Math.max(14, W / 55);
  octx.font = `700 ${fontSize}px "Space Grotesk", "Noto Sans SC", sans-serif`;
  const pad = fontSize * 0.55;
  const w = octx.measureText(text).width + pad * 2;
  const h = fontSize + pad * 1.2;
  // 避免超出画面
  x = Math.min(Math.max(x + 12, 4), overlay.width - w - 4);
  y = Math.min(Math.max(y - h / 2, 4), overlay.height - h - 4);
  octx.fillStyle = 'rgba(5, 8, 18, 0.78)';
  octx.strokeStyle = color;
  octx.lineWidth = 1.5;
  roundRect(x, y, w, h, h / 2.6);
  octx.fill();
  octx.stroke();
  octx.fillStyle = color;
  octx.textBaseline = 'middle';
  octx.fillText(text, x + pad, y + h / 2 + 1);
}

function roundRect(x, y, w, h, r) {
  octx.beginPath();
  octx.moveTo(x + r, y);
  octx.arcTo(x + w, y, x + w, y + h, r);
  octx.arcTo(x + w, y + h, x, y + h, r);
  octx.arcTo(x, y + h, x, y, r);
  octx.arcTo(x, y, x + w, y, r);
  octx.closePath();
}

/* ============================================================
 * 仪表盘更新 + 实时提示
 * ============================================================ */
function updateDashboard(metrics) {
  const tips = [];
  for (const [key, def] of Object.entries(METRICS)) {
    const el = metricEls[key];
    const v = metrics ? metrics[key] : null;
    if (v == null) {
      el.value.innerHTML = `--<small>${def.unit}</small>`;
      el.pill.className = 'pill none';
      el.pill.textContent = metrics ? '未检测到' : '等待检测';
      el.msg.textContent = '';
      el.msg.className = 'metric-msg';
      el.card.className = 'metric-card';
      continue;
    }
    const { level, text } = def.evaluate(v);
    el.value.innerHTML = `${v}<small>${def.unit}</small>`;
    el.pill.className = `pill ${level}`;
    el.pill.textContent = level === 'good' ? '理想' : level === 'warn' ? '可接受' : '需纠正';
    el.msg.textContent = text;
    el.msg.className = `metric-msg ${level}`;
    el.card.className = `metric-card lv-${level}`;
    const [min, max] = def.range;
    el.marker.style.left = `${Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100))}%`;
    if (level !== 'good') tips.push({ level, text: `${def.short}：${text}` });
  }

  const list = $('#tips-list');
  if (!metrics) {
    list.innerHTML = `<li class="good">未检测到完整人体，请确保全身入镜、光线充足</li>`;
  } else if (tips.length === 0) {
    list.innerHTML = `<li class="good">姿态良好，保持这个动作模式！</li>`;
  } else {
    tips.sort((a, b) => (a.level === 'bad' ? -1 : 1) - (b.level === 'bad' ? -1 : 1));
    list.innerHTML = tips.slice(0, 4).map((t) => `<li class="${t.level}">${t.text}</li>`).join('');
  }
}

/* ============================================================
 * 历史采样 + 曲线图
 * ============================================================ */
function sampleHistory(metrics) {
  if (!metrics) return;
  const t = video.currentTime;
  if (t - lastSampleT < 0.1) return; // 每秒最多 10 个点
  lastSampleT = t;
  history.push({ t, ...metrics });
  drawChart();
}

function drawChart() {
  const dpr = window.devicePixelRatio || 1;
  const cssW = chartCanvas.clientWidth || chartCanvas.parentElement.clientWidth - 36;
  const cssH = 170;
  if (chartCanvas.width !== cssW * dpr) {
    chartCanvas.width = cssW * dpr;
    chartCanvas.height = cssH * dpr;
  }
  const c = chartCtx;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, cssW, cssH);

  const padL = 34, padR = 40, padT = 12, padB = 24;
  const plotW = cssW - padL - padR, plotH = cssH - padT - padB;
  const dur = video.duration || 1;
  const A_MIN = 60, A_MAX = 180;              // 角度轴
  const x = (t) => padL + (t / dur) * plotW;
  const yA = (v) => padT + (1 - (v - A_MIN) / (A_MAX - A_MIN)) * plotH;
  const yC = (v) => padT + (1 - Math.min(v, 30) / 30) * plotH; // 重心 0~30%

  // 膝角理想色带 110~150
  c.fillStyle = 'rgba(46, 230, 168, 0.10)';
  c.fillRect(padL, yA(150), plotW, yA(110) - yA(150));

  // 网格与坐标
  c.strokeStyle = 'rgba(255,255,255,0.07)';
  c.fillStyle = 'rgba(147,160,189,0.9)';
  c.font = '10px "Space Grotesk", sans-serif';
  c.lineWidth = 1;
  for (const a of [60, 120, 180]) {
    c.beginPath(); c.moveTo(padL, yA(a)); c.lineTo(padL + plotW, yA(a)); c.stroke();
    c.textAlign = 'right'; c.fillText(`${a}°`, padL - 6, yA(a) + 3);
  }
  c.textAlign = 'left';
  for (const p of [0, 15, 30]) c.fillText(`${p}%`, padL + plotW + 6, yC(p) + 3);

  if (history.length < 2) return;

  const line = (getVal, color, fill = false) => {
    c.beginPath();
    let started = false;
    for (const h of history) {
      const v = getVal(h);
      if (v == null) { started = false; continue; }
      const px = x(h.t), py = fill ? yC(v) : yA(v);
      if (!started) { c.moveTo(px, py); started = true; } else c.lineTo(px, py);
    }
    if (fill) {
      c.lineTo(x(history[history.length - 1].t), padT + plotH);
      c.lineTo(x(history[0].t), padT + plotH);
      c.closePath();
      c.fillStyle = color;
      c.fill();
    } else {
      c.strokeStyle = color;
      c.lineWidth = 2;
      c.lineJoin = 'round';
      c.stroke();
    }
  };

  const avg = (a, b) => (a == null ? b : b == null ? a : (a + b) / 2);
  line((h) => h.cog, 'rgba(255, 176, 32, 0.25)', true);
  line((h) => avg(h.kneeL, h.kneeR), '#00d4ff');
  line((h) => avg(h.elbowL, h.elbowR), '#a78bff');

  // 播放位置游标
  c.strokeStyle = 'rgba(255,255,255,0.5)';
  c.setLineDash([4, 4]);
  c.beginPath();
  c.moveTo(x(video.currentTime), padT);
  c.lineTo(x(video.currentTime), padT + plotH);
  c.stroke();
  c.setLineDash([]);
}

function clearChart() {
  chartCtx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
}

/* 点击曲线跳转 */
chartCanvas.addEventListener('click', (e) => {
  if (!video.duration) return;
  const rect = chartCanvas.getBoundingClientRect();
  const padL = 34, plotW = rect.width - 34 - 40;
  const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left - padL) / plotW));
  video.currentTime = ratio * video.duration;
});

window.addEventListener('resize', () => {
  syncOverlaySize();
  drawChart();
  if (video.paused && landmarker) detectOnce();
});

/* ============================================================
 * 训练报告
 * ============================================================ */
btnReport.addEventListener('click', buildReport);

function buildReport() {
  if (history.length < 5) {
    alert('数据太少：请先播放视频进行分析，再生成报告');
    return;
  }
  const stat = (key) => {
    const vals = history.map((h) => h[key]).filter((v) => v != null);
    if (!vals.length) return null;
    const avgV = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
    const goodN = vals.filter((v) => METRICS[key].evaluate(v).level === 'good').length;
    const warnN = vals.filter((v) => METRICS[key].evaluate(v).level === 'warn').length;
    return { avg: avgV, pct: (goodN + warnN * 0.5) / vals.length, goodPct: Math.round((goodN / vals.length) * 100) };
  };

  const sEL = stat('elbowL'), sER = stat('elbowR'), sKL = stat('kneeL'),
        sKR = stat('kneeR'), sT = stat('trunk'), sC = stat('cog');

  const groupPct = (a, b) => {
    const arr = [a, b].filter(Boolean);
    return arr.length ? arr.reduce((s, x) => s + x.pct, 0) / arr.length : 0;
  };
  const score = Math.round(
    100 * (
      REPORT_WEIGHTS.elbow * groupPct(sEL, sER) +
      REPORT_WEIGHTS.knee * groupPct(sKL, sKR) +
      REPORT_WEIGHTS.trunk * (sT ? sT.pct : 0) +
      REPORT_WEIGHTS.cog * (sC ? sC.pct : 0)
    )
  );
  const grade = score >= 85 ? '🏆 优秀' : score >= 70 ? '👍 良好' : score >= 55 ? '💪 继续加油' : '📌 需要重点纠正';

  const row = (name, s, unit) => s
    ? `<tr><td>${name}</td><td><b>${s.avg}${unit}</b></td><td>${s.goodPct}%</td></tr>`
    : `<tr><td>${name}</td><td>--</td><td>--</td></tr>`;

  // 找出最需要纠正的问题
  const issues = [];
  if (sC && sC.pct < 0.6) issues.push('重心下降不足：准备与触球阶段都要再蹲低一些');
  if (groupPct(sKL, sKR) < 0.6) issues.push('膝角不在理想区间：注意保持 110°~150° 的半蹲深度');
  if (groupPct(sEL, sER) < 0.6) issues.push('肘角偏小：触球瞬间两臂要伸直夹紧');
  if (sT && sT.pct < 0.6) issues.push('躯干前倾角度不稳定：保持含胸前倾 10°~30°');

  reportBody.innerHTML = `
    <div class="report-score">
      <div class="score-num">${score}</div>
      <div>
        <div class="score-grade">${grade}</div>
        <div class="score-sub">综合肘、膝、躯干、重心四项加权（理想=满分，可接受=半分）</div>
      </div>
    </div>
    <table class="report-table">
      <thead><tr><th>指标</th><th>平均值</th><th>理想区间占比</th></tr></thead>
      <tbody>
        ${row('左肘角', sEL, '°')}${row('右肘角', sER, '°')}
        ${row('左膝角', sKL, '°')}${row('右膝角', sKR, '°')}
        ${row('躯干前倾角', sT, '°')}${row('重心下降幅度', sC, '%')}
      </tbody>
    </table>
    ${issues.length
      ? `<p class="report-issues">🔍 重点改进：<br>${issues.map((i) => '· ' + i).join('<br>')}</p>`
      : `<p class="report-issues" style="color:var(--good)">✅ 各项指标表现稳定，继续保持！</p>`}
  `;
  reportCard.hidden = false;
  reportCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

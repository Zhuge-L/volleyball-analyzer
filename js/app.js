/* ============================================================
 * VolleySense · 北京大学排球课程
 * 登录 → 选择考试项目 → 上传视频 → 姿态分析 → 报告
 *
 * 不追踪排球。击球相位由人体关键点运动学推算。
 * ============================================================ */

import { createPoseEngine, BONES, ANGLE_JOINTS } from './poseEngine.js';
import { SKILL_LIST, getSkill } from './skills.js';
import { angleABC, mid, trunkLean, visible, forearmTilt } from './angles.js';
import { exportSingleReportPdf, exportCombinedReportPdf, exportSingleReportMd, exportCombinedReportMd } from './pdfExport.js';

const $ = (s) => document.querySelector(s);
const clamp = (v, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const loginScreen = $('#login-screen');
const topbar = $('#topbar');
const appMain = $('#app-main');
const hub = $('#hub');
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
const historyCard = $('#history-card');
const historyList = $('#history-list');

let landmarker = null;
let videoURL = null;
let history = [];
let contactEvents = [];
let motionSeries = [];
let cogBaseline = 0;
let hipStandY = 0;
let smooth = {};
let phase = 'none';
let standStreak = 0;
let lastSampleT = -1;
let rafId = 0;
let savedHistoryLen = 0;
let lastReport = null;
let student = { name: '', sid: '' };
let skill = getSkill('bump');
const usingRVFC = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;

const LEVEL_COLOR = { good: '#2ee6a8', warn: '#ffb020', bad: '#ff5470', none: '#93a0bd' };
const LV_RANK = { good: 0, warn: 1, bad: 2 };
const PILL_TEXT = { good: '理想', warn: '可接受', bad: '需纠正' };
const LS_SESSION = 'volleysense_session';
const LS_SESSIONS = 'volleysense_sessions';

const metricEls = {};
let METRICS = skill.metrics;
let PHASE = skill.phase;

/* ============================================================
 * 登录
 * ============================================================ */
function applySession(s) {
  student = { name: s.name, sid: s.sid };
  $('#user-chip').textContent = `${s.name} · ${s.sid}`;
  loginScreen.hidden = true;
  topbar.hidden = false;
  appMain.hidden = false;
  showHub();
}

try {
  const saved = JSON.parse(localStorage.getItem(LS_SESSION) || 'null');
  if (saved && saved.name && saved.sid) {
    $('#login-name').value = saved.name;
    $('#login-sid').value = saved.sid;
    applySession(saved);
  }
} catch { /* ignore */ }

$('#login-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('#login-name').value.trim();
  const sid = $('#login-sid').value.trim();
  const err = $('#login-err');
  if (!name || !sid) { err.hidden = false; return; }
  err.hidden = true;
  const rec = { name, sid };
  if ($('#login-remember').checked) {
    try { localStorage.setItem(LS_SESSION, JSON.stringify(rec)); } catch { /* ignore */ }
  } else {
    try { localStorage.removeItem(LS_SESSION); } catch { /* ignore */ }
  }
  applySession(rec);
});

$('#btn-logout').addEventListener('click', () => {
  try { localStorage.removeItem(LS_SESSION); } catch { /* ignore */ }
  student = { name: '', sid: '' };
  leaveAnalyzer();
  topbar.hidden = true;
  appMain.hidden = true;
  loginScreen.hidden = false;
});

$('#btn-hub').addEventListener('click', () => {
  leaveAnalyzer();
  showHub();
});

/* 项目页内的返回按钮（上传页 + 分析台各一个） */
const backToHub = () => { leaveAnalyzer(); showHub(); };
$('#btn-back-hub')?.addEventListener('click', backToHub);
$('#btn-back-hub2')?.addEventListener('click', backToHub);

function showHub() {
  hub.hidden = false;
  hero.hidden = true;
  analyzer.hidden = true;
  renderArchive();
}

function leaveAnalyzer() {
  video.pause();
  if (videoURL) URL.revokeObjectURL(videoURL);
  videoURL = null;
  video.removeAttribute('src');
  video.load();
  fileInput.value = '';
  resetAnalysisState();
  octx.clearRect(0, 0, overlay.width, overlay.height);
  clearChart();
  analyzer.hidden = true;
}

/* ============================================================
 * 考试项目
 * ============================================================ */
(function buildSkillGrid() {
  $('#skill-grid').innerHTML = SKILL_LIST.map((s) => `
    <button class="skill-card" type="button" data-skill="${s.id}">
      <span class="skill-icon">${s.icon}</span>
      <span class="skill-name">${s.name}</span>
      <span class="skill-exam">${s.examName}</span>
      <span class="skill-blurb">${s.blurb}</span>
      <span class="skill-cam">📷 ${s.camera.best}</span>
    </button>`).join('');
  $('#skill-grid').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-skill]');
    if (btn) selectSkill(btn.dataset.skill);
  });
})();

function selectSkill(id) {
  skill = getSkill(id);
  METRICS = skill.metrics;
  PHASE = skill.phase;
  $('#skill-eyebrow').textContent = `考试项目 · ${skill.examName}`;
  $('#skill-title').innerHTML = `上传「${skill.name}」视频<br /><span class="grad-text">对照课堂标准自评</span>`;
  $('#skill-blurb').textContent = skill.blurb;
  $('#camera-card').innerHTML = `
    <h3>建议拍摄角度</h3>
    <p><b>最佳机位：</b>${skill.camera.best}</p>
    <p>${skill.camera.also}</p>
    <p><b>取景：</b>${skill.camera.framing}</p>
    <p><b>避免：</b>${skill.camera.avoid}</p>`;
  $('#chart-hint').textContent = '绿色色带 = 膝角参考区间 · ▲ = 击球动作相位（由人体动作推算，不是球体检测）· 点击跳转';
  $('#std-title').textContent = `${skill.examName} · 评判标准`;
  buildStandardsTable();
  buildDashboard();
  hub.hidden = true;
  hero.hidden = false;
  analyzer.hidden = true;
  renderHistory();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ============================================================
 * 训练档案
 * ============================================================ */
function loadSessions() {
  try { return JSON.parse(localStorage.getItem(LS_SESSIONS)) || []; } catch { return []; }
}
function saveSession(rec) {
  const arr = loadSessions();
  arr.push(rec);
  while (arr.length > 50) arr.shift();
  try { localStorage.setItem(LS_SESSIONS, JSON.stringify(arr)); } catch { /* ignore */ }
}

/** 当前学员某项目最近一次带完整报告快照的记录 */
function latestReportFor(skillId, name = student.name) {
  const list = loadSessions()
    .filter((s) => s.name === name && s.skill === skillId && s.report)
    .sort((a, b) => (b.id || 0) - (a.id || 0));
  return list[0] || null;
}

function renderArchive() {
  const list = $('#archive-list');
  if (!list) return;
  list.innerHTML = SKILL_LIST.map((sk) => {
    const rec = latestReportFor(sk.id);
    const r = rec && rec.report;
    const cls = r ? (r.score >= 85 ? 'good' : r.score >= 70 ? '' : r.score >= 55 ? 'warn' : 'bad') : 'none';
    const scoreHtml = r ? `<span class="h-score ${cls}">${r.score}</span>` : `<span class="h-score none">未评</span>`;
    const dateHtml = r ? `<span class="h-date">${esc(r.dateStr || '')}</span>` : `<span class="h-date">尚未生成报告</span>`;
    const disabled = r ? '' : 'disabled';
    return `<li data-skill="${sk.id}">
      <span class="skill-icon">${sk.icon}</span>
      <span class="h-name">${esc(sk.examName)}</span>
      ${dateHtml}
      ${scoreHtml}
      <button class="btn btn-ghost btn-sm btn-export-one" type="button" data-skill="${sk.id}" ${disabled}>📄 导出 PDF</button>
    </li>`;
  }).join('');
}

$('#archive-list')?.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-export-one');
  if (!btn || btn.disabled) return;
  const rec = latestReportFor(btn.dataset.skill);
  if (!rec || !rec.report) { alert('该项目还没有可导出的报告'); return; }
  // 同步打开打印窗口（异步会被浏览器拦截）
  exportSingleReportPdf(rec.report);
});

function collectAllReports() {
  const summaryRows = [];
  const reports = [];
  for (const sk of SKILL_LIST) {
    const rec = latestReportFor(sk.id);
    if (rec && rec.report) {
      reports.push(rec.report);
      summaryRows.push({
        name: sk.examName,
        dateStr: rec.report.dateStr,
        score: rec.report.score,
        gradeText: rec.report.gradeText,
      });
    } else {
      summaryRows.push({ name: sk.examName, dateStr: '', score: null, gradeText: '尚未测评' });
    }
  }
  return { reports, summaryRows };
}

$('#btn-export-all')?.addEventListener('click', () => {
  const { reports, summaryRows } = collectAllReports();
  if (!reports.length) {
    alert('还没有任何项目报告。请先完成至少一项分析并生成报告。');
    return;
  }
  exportCombinedReportPdf(student, reports, summaryRows);
});

$('#btn-export-all-md')?.addEventListener('click', () => {
  const { reports, summaryRows } = collectAllReports();
  if (!reports.length) {
    alert('还没有任何项目报告。请先完成至少一项分析并生成报告。');
    return;
  }
  exportCombinedReportMd(student, reports, summaryRows);
});

function renderHistory() {
  const sessions = loadSessions().filter((s) => (!s.skill || s.skill === skill.id) && (!student.name || s.name === student.name));
  historyCard.hidden = sessions.length === 0;
  historyList.innerHTML = sessions.slice(-6).reverse().map((s) => {
    const d = new Date(s.date);
    const ds = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const cls = s.score >= 85 ? 'good' : s.score >= 70 ? '' : s.score >= 55 ? 'warn' : 'bad';
    return `<li><span class="h-date">${ds}</span><span class="h-name">${esc(s.skillName || skill.name)}</span><span class="h-score ${cls}">${s.score}</span></li>`;
  }).join('');
}
$('#btn-clear-history').addEventListener('click', () => {
  try { localStorage.removeItem(LS_SESSIONS); } catch { /* ignore */ }
  renderHistory();
  renderArchive();
});

/* ============================================================
 * 仪表盘 / 标准表
 * ============================================================ */
function gaugeHTML(def) {
  const [min, max] = def.range;
  return def.zones.map((z) => {
    const l = ((z.from - min) / (max - min)) * 100;
    const w = ((z.to - z.from) / (max - min)) * 100;
    return `<span class="zone ${z.level}" style="left:${l}%;width:${w}%"></span>`;
  }).join('') + '<span class="marker" style="left:0%"></span>';
}

function buildDashboard() {
  dash.innerHTML = '';
  Object.keys(metricEls).forEach((k) => delete metricEls[k]);

  const focus = document.createElement('div');
  focus.className = 'focus-card';
  focus.id = 'focus-card';
  focus.innerHTML = `<div class="focus-label">🎯 当前重点</div><div class="focus-text" id="focus-text">上传视频后点击「播放分析」开始</div>`;
  dash.appendChild(focus);

  if (skill.combined) {
    const keys = skill.combined.keys;
    const pCard = document.createElement('div');
    pCard.className = 'metric-card platform-card';
    pCard.innerHTML = `
      <div class="metric-top">
        <span class="metric-name">🎯 ${skill.combined.title}</span>
        <span class="pill none">等待检测</span>
      </div>
      ${keys.map((key) => {
        const def = METRICS[key];
        return `<div class="prow" data-key="${key}">
          <div class="prow-head">
            <span class="pname">${def.label}</span>
            <b class="pval">--<small>${def.unit}</small></b>
            <i class="lv-dot none"></i>
          </div>
          <div class="gauge">${gaugeHTML(def)}</div>
        </div>`;
      }).join('')}
      <p class="metric-msg"></p>`;
    dash.appendChild(pCard);
    metricEls.platform = {
      card: pCard, pill: pCard.querySelector('.pill'), msg: pCard.querySelector('.metric-msg'),
      lvState: { shown: 'none', pend: null, n: 0 }, keys, subs: {},
    };
    for (const key of keys) {
      const rowEl = pCard.querySelector(`.prow[data-key="${key}"]`);
      metricEls.platform.subs[key] = {
        value: rowEl.querySelector('.pval'),
        dot: rowEl.querySelector('.lv-dot'),
        marker: rowEl.querySelector('.marker'),
      };
    }
  }

  const groupTitle = (t) => {
    const d = document.createElement('div');
    d.className = 'dash-group';
    d.textContent = t;
    dash.appendChild(d);
  };
  const until = skill.groups[0] && skill.groups[0].until;
  if (skill.groups[0]) groupTitle(skill.groups[0].title);
  for (const key of skill.stdKeys) {
    if (key === until && skill.groups[1]) groupTitle(skill.groups[1].title);
    const def = METRICS[key];
    const card = document.createElement('div');
    card.className = 'metric-card';
    card.innerHTML = `
      <div class="metric-top">
        <span class="metric-name">${def.label}</span>
        <span class="pill none">等待检测</span>
      </div>
      <div class="metric-value">--<small>${def.unit}</small></div>
      <div class="gauge">${gaugeHTML(def)}</div>
      <p class="metric-msg"></p>`;
    dash.appendChild(card);
    metricEls[key] = {
      card, pill: card.querySelector('.pill'), value: card.querySelector('.metric-value'),
      marker: card.querySelector('.marker'), msg: card.querySelector('.metric-msg'),
      lvState: { shown: 'none', pend: null, n: 0 },
    };
  }

  const tips = document.createElement('div');
  tips.className = 'tips-card';
  tips.innerHTML = `<h4>💡 实时纠正提示</h4><ul class="tips-list" id="tips-list"><li class="good">上传视频后点击「播放分析」开始</li></ul>`;
  dash.appendChild(tips);
}

function buildStandardsTable() {
  const rows = skill.standards.map((d) => `
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
}

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

function resetAnalysisState() {
  history = [];
  contactEvents = [];
  motionSeries = [];
  cogBaseline = 0;
  hipStandY = 0;
  smooth = {};
  phase = 'none';
  standStreak = 0;
  lastSampleT = -1;
  savedHistoryLen = 0;
  lastReport = null;
}

function loadFile(file) {
  if (!file.type.startsWith('video/')) { alert('请选择视频文件'); return; }
  if (videoURL) URL.revokeObjectURL(videoURL);
  videoURL = URL.createObjectURL(file);
  video.src = videoURL;
  hero.hidden = true;
  analyzer.hidden = false;
  reportCard.hidden = true;
  resetAnalysisState();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  ensureModel();
  requestAnimationFrame(() => syncOverlaySize());
}

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
      detectOnce();
    })
    .catch((err) => {
      console.error(err);
      loadingText.textContent = '模型加载失败，请检查网络后刷新页面重试';
      modelPromise = null;
    });
  return modelPromise;
}

btnPlay.addEventListener('click', async () => {
  await ensureModel();
  if (!landmarker) return;
  if (video.paused) video.play(); else video.pause();
});
video.addEventListener('play', () => { syncOverlaySize(); btnPlay.textContent = '⏸ 暂停'; scheduleNext(); });
video.addEventListener('pause', () => { btnPlay.textContent = '▶ 播放分析'; cancelAnimationFrame(rafId); });
video.addEventListener('ended', () => { btnPlay.textContent = '▶ 重新播放'; buildReport(); });
speedSel.addEventListener('change', () => (video.playbackRate = parseFloat(speedSel.value)));
video.addEventListener('loadedmetadata', () => { syncOverlaySize(); updateTimeLabel(); });
video.addEventListener('timeupdate', updateTimeLabel);
video.addEventListener('seeking', () => { motionSeries = []; smooth = {}; standStreak = 0; });
video.addEventListener('seeked', () => { if (video.paused) detectOnce(); });

function syncOverlaySize() {
  if (!video.videoWidth) return;
  overlay.width = video.videoWidth;
  overlay.height = video.videoHeight;
  overlay.style.width = `${video.clientWidth}px`;
  overlay.style.height = `${video.clientHeight}px`;
}

btnReset.addEventListener('click', () => {
  leaveAnalyzer();
  hero.hidden = false;
  renderHistory();
});

function updateTimeLabel() {
  timeLabel.textContent = `${fmt(video.currentTime)} / ${fmt(video.duration || 0)}`;
}
function fmt(s) {
  if (!isFinite(s)) s = 0;
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function scheduleNext() {
  if (usingRVFC) video.requestVideoFrameCallback(() => tick());
  else rafId = requestAnimationFrame(() => tick());
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
  phase = metrics ? classifyPhase(metrics) : 'none';
  drawOverlay(lm, metrics);
  updateDashboard(metrics);
  sampleHistory(metrics);
}

/* ============================================================
 * 指标计算
 * ============================================================ */
function computeMetrics(lm) {
  if (!lm) return null;
  const m = { conf: {} };
  const vis = (i) => lm[i].visibility ?? 1;
  const minVis = (...idx) => Math.min(...idx.map((i) => vis(i)));

  const arm = (s, e, w) => visible(lm, [s, e, w])
    ? { elbow: angleABC(lm[s], lm[e], lm[w]), tilt: forearmTilt(lm[e], lm[w]), conf: minVis(s, e, w) }
    : null;
  const armL = arm(11, 13, 15);
  const armR = arm(12, 14, 16);
  const arms = [armL, armR].filter(Boolean);
  if (arms.length) {
    m.platformExt = Math.min(...arms.map((a) => a.elbow));
    m.elbowExt = Math.max(...arms.map((a) => a.elbow));
    m.setElbow = Math.round(arms.reduce((s, a) => s + a.elbow, 0) / arms.length);
    m.platformTilt = Math.round(arms.reduce((s, a) => s + a.tilt, 0) / arms.length);
    const c = Math.min(...arms.map((a) => a.conf));
    m.conf.platformExt = m.conf.platformTilt = m.conf.elbowExt = m.conf.setElbow = c;
    if (armL && armR && Math.min(armL.conf, armR.conf) >= 0.55) {
      m.platformSym = Math.abs(armL.elbow - armR.elbow);
      m.conf.platformSym = Math.min(armL.conf, armR.conf);
    }
  }
  m.elbowL = armL ? armL.elbow : null;
  m.elbowR = armR ? armR.elbow : null;

  const knee = (h, k, a) => visible(lm, [h, k, a])
    ? { v: angleABC(lm[h], lm[k], lm[a]), conf: minVis(h, k, a) }
    : null;
  const kneeL = knee(23, 25, 27);
  const kneeR = knee(24, 26, 28);
  const knees = [kneeL, kneeR].filter(Boolean);
  if (knees.length) {
    m.knee = Math.round(knees.reduce((s, x) => s + x.v, 0) / knees.length);
    m.conf.knee = Math.max(...knees.map((x) => x.conf));
  }
  m.kneeL = kneeL ? kneeL.v : null;
  m.kneeR = kneeR ? kneeR.v : null;

  if (visible(lm, [11, 12, 23, 24])) {
    m.trunk = trunkLean(mid(lm[11], lm[12]), mid(lm[23], lm[24]));
    m.conf.trunk = minVis(11, 12, 23, 24);
  }

  if (visible(lm, [23, 24, 27, 28])) {
    const hip = mid(lm[23], lm[24]);
    const legLen = mid(lm[27], lm[28]).y - hip.y;
    if (legLen > 0.05) {
      cogBaseline = Math.max(cogBaseline, legLen);
      m.cog = Math.round(((cogBaseline - legLen) / cogBaseline) * 100);
      m.conf.cog = minVis(23, 24, 27, 28);
    }
    if (m.knee != null && m.knee >= PHASE.standKnee && (m.cog == null || m.cog < PHASE.standCog)) {
      hipStandY = hipStandY ? hipStandY * 0.85 + hip.y * 0.15 : hip.y;
    }
    if (hipStandY > 0.05) {
      m.jumpRise = Math.max(0, Math.round(((hipStandY - hip.y) / hipStandY) * 100));
      m.conf.jumpRise = minVis(23, 24);
    }
  }

  const wrists = [lm[15], lm[16]].filter((p) => (p.visibility ?? 1) >= 0.35);
  if (wrists.length && visible(lm, [11, 12], 0.3)) {
    const wy = wrists.reduce((s, p) => s + p.y, 0) / wrists.length;
    const sh = mid(lm[11], lm[12]);
    m.wristHigh = Math.round((sh.y - wy) * 100);
    m.conf.wristHigh = Math.min(...wrists.map((p) => p.visibility ?? 1), minVis(11, 12));
  }
  if (visible(lm, [15, 16], 0.35)) {
    m.handsGap = Math.round(Math.hypot(lm[15].x - lm[16].x, lm[15].y - lm[16].y) * 100);
    m.conf.handsGap = minVis(15, 16);
  }

  trackAction(lm, m);

  for (const k of Object.keys(METRICS)) {
    if (m[k] == null) continue;
    smooth[k] = smooth[k] == null ? m[k] : Math.round(smooth[k] * 0.65 + m[k] * 0.35);
    m[k] = smooth[k];
  }
  return m;
}

function trackAction(lm, m) {
  const t = video.currentTime;
  const wrists = [lm[15], lm[16]].filter((p) => (p.visibility ?? 1) >= 0.4);
  if (!wrists.length || !visible(lm, [11, 12], 0.3)) return;
  const wy = wrists.reduce((s, p) => s + p.y, 0) / wrists.length;
  const sh = mid(lm[11], lm[12]);
  const noseY = lm[0] ? lm[0].y : sh.y - 0.12;
  motionSeries.push({
    t, y: wy,
    belowShoulder: wy > sh.y,
    aboveHead: wy < noseY,
    aboveBrow: wy < noseY + 0.05,
    knee: m.knee, cog: m.cog, jumpRise: m.jumpRise,
    wristGap: visible(lm, [15, 16], 0.3) ? Math.hypot(lm[15].x - lm[16].x, lm[15].y - lm[16].y) : null,
    wristHigh: m.wristHigh, elbowMax: m.elbowExt,
  });
  while (motionSeries.length && t - motionSeries[0].t > 3) motionSeries.shift();

  const lastT = contactEvents.length ? contactEvents[contactEvents.length - 1].t : -Infinity;
  if (skill.detect(motionSeries, lastT)) {
    contactEvents.push({ t: motionSeries[motionSeries.length - 2].t });
  }
}

function classifyPhase(m) {
  const t = video.currentTime;
  if (contactEvents.some((e) => Math.abs(e.t - t) <= PHASE.contactWindow)) {
    standStreak = 0;
    return 'contact';
  }
  const upright = m.knee != null && m.knee >= PHASE.standKnee && (m.cog == null || m.cog < PHASE.standCog);
  standStreak = upright ? standStreak + 1 : 0;
  if (upright && (standStreak >= 6 || phase === 'standing')) return 'standing';
  return 'ready';
}

/* ============================================================
 * 画面叠加
 * ============================================================ */
function drawOverlay(lm, metrics) {
  const W = overlay.width, H = overlay.height;
  octx.clearRect(0, 0, W, H);
  if (!lm) return;
  const standing = phase === 'standing';

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
  octx.shadowBlur = 0;
  octx.fillStyle = '#fff';
  for (const idx of [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
    if ((lm[idx].visibility ?? 1) < 0.3) continue;
    octx.beginPath();
    octx.arc(lm[idx].x * W, lm[idx].y * H, Math.max(3.5, W / 220), 0, Math.PI * 2);
    octx.fill();
  }

  const badges = [];
  const lvColor = (def, v) => (standing || !def) ? LEVEL_COLOR.none : LEVEL_COLOR[def.evaluate(v).level];
  const elbowDef = METRICS[skill.overlay.elbowAs];
  const kneeDef = METRICS.knee;
  if (metrics) {
    const jointMap = {
      13: [metrics.elbowL, elbowDef],
      14: [metrics.elbowR, elbowDef],
      25: [metrics.kneeL, kneeDef],
      26: [metrics.kneeR, kneeDef],
    };
    for (const j of ANGLE_JOINTS) {
      const pair = jointMap[j.idx];
      if (!pair) continue;
      const [v, def] = pair;
      if (v == null || (lm[j.idx].visibility ?? 1) < 0.3) continue;
      badges.push({ x: lm[j.idx].x * W, y: lm[j.idx].y * H, text: `${j.name} ${v}°`, color: lvColor(def, v) });
    }
    if (skill.overlay.tilt && metrics.platformTilt != null && visible(lm, [15, 16], 0.3)) {
      const wm = mid(lm[15], lm[16]);
      const color = tiltActive(metrics) ? lvColor(METRICS.platformTilt, metrics.platformTilt) : LEVEL_COLOR.none;
      badges.push({ x: wm.x * W, y: wm.y * H + 26, text: `平台 ${metrics.platformTilt}°`, color });
    }
    if (phase === 'contact' && visible(lm, [15, 16], 0.3)) {
      const wm = mid(lm[15], lm[16]);
      octx.save();
      octx.strokeStyle = '#ffd166';
      octx.lineWidth = Math.max(3, W / 260);
      octx.shadowBlur = 16;
      octx.shadowColor = '#ffd166';
      octx.beginPath();
      octx.arc(wm.x * W, wm.y * H, Math.max(18, W / 40), 0, Math.PI * 2);
      octx.stroke();
      octx.restore();
    }
    if (skill.overlay.cog && metrics.cog != null) {
      const hipY = mid(lm[23], lm[24]).y * H;
      const color = lvColor(METRICS.cog, metrics.cog);
      octx.save();
      octx.setLineDash([10, 8]);
      octx.lineWidth = 2;
      octx.strokeStyle = color;
      octx.beginPath();
      octx.moveTo(0, hipY);
      octx.lineTo(W, hipY);
      octx.stroke();
      octx.restore();
      badges.push({ x: W * 0.04, y: hipY - 14, text: `髋部 ↓${metrics.cog}%`, color });
    }
  }
  const phaseBadge = {
    contact: ['⚡ 击球动作（人体推算）', '#ffd166'],
    ready: ['● 动作段 · 评估中', LEVEL_COLOR.good],
    standing: ['○ 站立段 · 不计分', LEVEL_COLOR.none],
    none: null,
  }[phase];
  if (phaseBadge) badges.unshift({ x: 14, y: 30, text: phaseBadge[0], color: phaseBadge[1] });
  drawBadges(badges);
}

function drawBadges(badges) {
  if (!badges.length) return;
  const W = overlay.width, H = overlay.height;
  const fontSize = Math.max(14, W / 55);
  const pad = fontSize * 0.55;
  octx.font = `700 ${fontSize}px "Space Grotesk", "Noto Sans SC", sans-serif`;
  for (const b of badges) {
    b.w = octx.measureText(b.text).width + pad * 2;
    b.h = fontSize + pad * 1.2;
    b.x = Math.min(Math.max(b.x + 12, 4), W - b.w - 4);
    b.y = Math.min(Math.max(b.y - b.h / 2, 4), H - b.h - 4);
  }
  const sorted = badges.slice().sort((a, b) => a.y - b.y);
  for (let i = 1; i < sorted.length; i++) {
    for (let j = 0; j < i; j++) {
      const a = sorted[j], b = sorted[i];
      const overlap = b.x < a.x + a.w + 6 && b.x + b.w + 6 > a.x && b.y < a.y + a.h + 6 && b.y + b.h + 6 > a.y;
      if (overlap) b.y = Math.min(a.y + a.h + 6, H - b.h - 4);
    }
  }
  for (const b of badges) {
    octx.fillStyle = 'rgba(5, 8, 18, 0.78)';
    octx.strokeStyle = b.color;
    octx.lineWidth = 1.5;
    roundRect(b.x, b.y, b.w, b.h, b.h / 2.6);
    octx.fill();
    octx.stroke();
    octx.fillStyle = b.color;
    octx.textBaseline = 'middle';
    octx.fillText(b.text, b.x + pad, b.y + b.h / 2 + 1);
  }
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

function settleLevel(st, target) {
  if (target === st.shown) { st.pend = null; st.n = 0; return st.shown; }
  if (st.pend === target) {
    if (++st.n >= 4) { st.shown = target; st.pend = null; st.n = 0; }
  } else { st.pend = target; st.n = 1; }
  return st.shown;
}

function setCardLevel(el, level, pillText, msgText, msgLevel = level) {
  el.pill.className = `pill ${level}`;
  el.pill.textContent = pillText;
  el.msg.textContent = msgText;
  el.msg.className = `metric-msg ${msgLevel}`;
  el.card.classList.remove('lv-good', 'lv-warn', 'lv-bad');
  if (level === 'good' || level === 'warn' || level === 'bad') el.card.classList.add(`lv-${level}`);
}

function tiltActive(m) {
  return phase === 'contact' || (m && m.platformTilt != null && m.platformTilt <= 55);
}

function fillMetricRow(el, def, v, standing, conf) {
  if (v == null) {
    el.value.innerHTML = `--<small>${def.unit}</small>`;
    el.value.classList.remove('lowconf');
    el.marker.style.left = '0%';
    setCardLevel(el, 'none', standing ? '站立·不计分' : '未检测到', '');
    el.lvState.shown = 'none';
    return;
  }
  const { level, text } = def.evaluate(v);
  const lowConf = (conf ?? 1) < 0.55;
  el.value.innerHTML = `${v}<small>${def.unit}</small>`;
  el.value.classList.toggle('lowconf', lowConf);
  el.value.title = lowConf ? '置信度较低（可能被遮挡），评分时已降权' : '';
  const [min, max] = def.range;
  el.marker.style.left = `${clamp(((v - min) / (max - min)) * 100)}%`;
  if (standing) {
    setCardLevel(el, 'none', '站立·不计分', '');
    el.lvState.shown = 'none';
  } else {
    const shown = settleLevel(el.lvState, level);
    setCardLevel(el, shown, PILL_TEXT[shown], text, level);
  }
}

function updateDashboard(m) {
  const standing = phase === 'standing';
  if (metricEls.platform) {
    const pEls = metricEls.platform;
    const subResults = [];
    for (const key of pEls.keys) {
      const def = METRICS[key];
      const sub = pEls.subs[key];
      const v = m ? m[key] : null;
      const inactive = key === 'platformTilt' && v != null && !tiltActive(m);
      if (v == null) {
        sub.value.innerHTML = `--<small>${def.unit}</small>`;
        sub.value.classList.remove('lowconf');
        sub.dot.className = 'lv-dot none';
        sub.marker.style.left = '0%';
        continue;
      }
      const { level } = def.evaluate(v);
      const lowConf = ((m.conf && m.conf[key]) ?? 1) < 0.55;
      sub.value.innerHTML = `${v}<small>${def.unit}</small>`;
      sub.value.classList.toggle('lowconf', lowConf);
      sub.dot.className = `lv-dot ${standing || inactive ? 'none' : level}`;
      const [min, max] = def.range;
      sub.marker.style.left = `${clamp(((v - min) / (max - min)) * 100)}%`;
      if (!inactive) subResults.push({ key, level, v });
    }
    if (!subResults.length) {
      setCardLevel(pEls, 'none', m ? '未检测到' : '等待检测', '');
      pEls.lvState.shown = 'none';
    } else if (standing) {
      setCardLevel(pEls, 'none', '站立·不计分', '');
      pEls.lvState.shown = 'none';
    } else {
      const worst = subResults.slice().sort((a, b) => LV_RANK[b.level] - LV_RANK[a.level])[0];
      const shown = settleLevel(pEls.lvState, worst.level);
      setCardLevel(pEls, shown, PILL_TEXT[shown], METRICS[worst.key].evaluate(worst.v).text, worst.level);
    }
  }
  for (const key of skill.stdKeys) {
    const el = metricEls[key];
    if (!el) continue;
    fillMetricRow(el, METRICS[key], m ? m[key] : null, standing && !!m, m && m.conf ? m.conf[key] : 1);
  }
  updateFocus(m, standing);
}

function updateFocus(m, standing) {
  const card = $('#focus-card');
  const text = $('#focus-text');
  const list = $('#tips-list');
  if (!m) {
    card.className = 'focus-card';
    text.textContent = '未检测到完整人体：请确保全身入镜、光线充足';
    list.innerHTML = `<li class="good">未检测到完整人体，请确保全身入镜、光线充足</li>`;
    return;
  }
  if (standing) {
    card.className = 'focus-card';
    text.textContent = '站立段不计分 —— 开始动作后，按人体运动推算击球相位';
    list.innerHTML = `<li class="good">站立段不计分。系统不检测排球，只根据人体动作标记击球相位。</li>`;
    return;
  }
  const issues = [];
  for (const key of skill.focusOrder) {
    const v = m[key];
    if (v == null || !METRICS[key]) continue;
    if (key === 'platformTilt' && !tiltActive(m)) continue;
    const { level } = METRICS[key].evaluate(v);
    if (level !== 'good') issues.push({ key, level, v });
  }
  if (!issues.length) {
    card.className = 'focus-card lv-good';
    text.textContent = phase === 'contact' ? '⚡ 击球动作相位：姿态良好，保持！' : '姿态良好，保持这个动作模式！';
    list.innerHTML = `<li class="good">姿态良好，保持这个动作模式！</li>`;
    return;
  }
  issues.sort((a, b) => LV_RANK[b.level] - LV_RANK[a.level] || skill.focusOrder.indexOf(a.key) - skill.focusOrder.indexOf(b.key));
  const top = issues[0];
  const def = METRICS[top.key];
  card.className = `focus-card lv-${top.level}`;
  text.innerHTML = `<b>${def.label} ${top.v}${def.unit}</b> → ${def.fix(top.v) || def.evaluate(top.v).text}`;
  list.innerHTML = issues.slice(0, 4)
    .map((t) => `<li class="${t.level}">${METRICS[t.key].short}：${METRICS[t.key].fix(t.v) || METRICS[t.key].evaluate(t.v).text}</li>`)
    .join('');
}

function sampleHistory(metrics) {
  if (!metrics) return;
  const t = video.currentTime;
  if (t - lastSampleT < 0.1) return;
  lastSampleT = t;
  history.push({ t, phase, ...metrics });
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

  const padL = 34, padR = 40, padT = 14, padB = 24;
  const plotW = cssW - padL - padR, plotH = cssH - padT - padB;
  const dur = video.duration || 1;
  const A_MIN = 60, A_MAX = 180;
  const x = (t) => padL + (t / dur) * plotW;
  const yA = (v) => padT + (1 - (v - A_MIN) / (A_MAX - A_MIN)) * plotH;
  const yC = (v) => padT + (1 - Math.min(Math.max(v, 0), 30) / 30) * plotH;

  const band = skill.chart.kneeBand;
  c.fillStyle = 'rgba(46, 230, 168, 0.10)';
  c.fillRect(padL, yA(band[1]), plotW, yA(band[0]) - yA(band[1]));

  c.strokeStyle = 'rgba(255,255,255,0.07)';
  c.fillStyle = 'rgba(147,160,189,0.9)';
  c.font = '10px "Space Grotesk", sans-serif';
  c.lineWidth = 1;
  for (const a of [60, 120, 180]) {
    c.beginPath(); c.moveTo(padL, yA(a)); c.lineTo(padL + plotW, yA(a)); c.stroke();
    c.textAlign = 'right'; c.fillText(`${a}°`, padL - 6, yA(a) + 3);
  }

  c.fillStyle = '#ffd166';
  for (const e of contactEvents) {
    const px = x(e.t);
    c.beginPath();
    c.moveTo(px, padT + 9);
    c.lineTo(px - 5, padT + 1);
    c.lineTo(px + 5, padT + 1);
    c.closePath();
    c.fill();
  }

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

  for (const s of skill.chart.series) {
    line((h) => h[s.key], s.color, !!s.fill);
  }

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

btnReport.addEventListener('click', buildReport);

function pickScoredSamples() {
  const contactSamples = history.filter((h) => h.phase === 'contact');
  if (contactEvents.length >= 1 && contactSamples.length >= 3) return { samples: contactSamples, mode: 'contact' };
  return { samples: history.filter((h) => h.phase !== 'standing'), mode: 'active' };
}

function evalTiming() {
  if (!contactEvents.length) return null;
  let ok = 0, judged = 0;
  for (const e of contactEvents) {
    const win = history.filter((h) => h.knee != null && h.t >= e.t - 0.3 && h.t <= e.t + 0.1);
    if (win.length < 3) continue;
    judged++;
    const dt = win[win.length - 1].t - win[0].t;
    const slope = dt > 0 ? (win[win.length - 1].knee - win[0].knee) / dt : 0;
    if (slope > 8) ok++;
  }
  return judged ? { ok, judged, pct: ok / judged } : null;
}

function buildReport() {
  const scored = pickScoredSamples();
  if (scored.samples.length < 3) {
    alert('数据太少：请先播放视频进行分析，再生成报告');
    return;
  }

  const stat = (key) => {
    if (!METRICS[key]) return null;
    const rows = scored.samples
      .filter((h) => h[key] != null)
      .map((h) => ({ v: h[key], w: clamp(h.conf && h.conf[key] != null ? h.conf[key] : 0.8, 0.4, 1) }));
    if (!rows.length) return null;
    const wSum = rows.reduce((s, r) => s + r.w, 0);
    const avg = Math.round(rows.reduce((s, r) => s + r.v * r.w, 0) / wSum);
    const wScore = rows.reduce((s, r) => {
      const lv = METRICS[key].evaluate(r.v).level;
      return s + r.w * (lv === 'good' ? 1 : lv === 'warn' ? 0.5 : 0);
    }, 0) / wSum;
    const goodPct = Math.round((rows.filter((r) => METRICS[key].evaluate(r.v).level === 'good').reduce((s, r) => s + r.w, 0) / wSum) * 100);
    return { avg, pct: wScore, goodPct };
  };

  const stats = {};
  for (const [key] of skill.tableKeys) stats[key] = stat(key);
  const timing = evalTiming();

  const avgPct = (keys) => {
    const a = keys.map((k) => stats[k]).filter(Boolean);
    return a.length ? a.reduce((s, x) => s + x.pct, 0) / a.length : null;
  };

  const parts = skill.reportMap.map((p) => {
    const val = p.timing ? (timing ? timing.pct : null) : avgPct(p.keys);
    return [p.name, skill.weights[p.wKey], val];
  }).filter(([, , p]) => p != null);
  const wSum = parts.reduce((s, [, w]) => s + w, 0) || 1;
  const score = Math.round((100 * parts.reduce((s, [, w, p]) => s + w * p, 0)) / wSum);
  const grade = score >= 85 ? '🏆 优秀' : score >= 70 ? '👍 良好' : score >= 55 ? '💪 继续加油' : '📌 需要重点纠正';
  const gradeText = score >= 85 ? '优秀' : score >= 70 ? '良好' : score >= 55 ? '继续加油' : '需要重点纠正';

  const modeNote = scored.mode === 'contact'
    ? `基于 ${contactEvents.length} 次击球动作相位（由人体运动推算，非球体检测；±${Math.round(PHASE.scoreWindow * 1000)}ms），站立段不计分`
    : '未识别到明确的击球动作相位，按动作段（已剔除站立）统计，结果仅供参考。系统不检测排球。';

  const issues = [];
  for (const [key] of skill.tableKeys) {
    const s = stats[key];
    if (s && s.pct < 0.6) issues.push(`${METRICS[key].label}：${METRICS[key].fix(s.avg) || METRICS[key].evaluate(s.avg).text}`);
  }
  if (timing && timing.pct < 0.5) {
    issues.push(`发力时机：${timing.judged} 次动作中仅 ${timing.ok} 次伴随蹬地伸展。${skill.timingText}`);
  }

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const reportSnapshot = {
    score, gradeText, dateStr, modeNote, issues,
    contacts: contactEvents.length, duration: fmt(video.duration || 0),
    name: student.name, sid: student.sid,
    skillId: skill.id, skillName: skill.examName, skillIcon: skill.icon,
    tableRows: [
      ...skill.tableKeys.map(([k, u]) => [METRICS[k].label, stats[k] ? `${stats[k].avg}${u}` : '--', stats[k] ? `${stats[k].goodPct}%` : '--']),
      ['蹬地发力时机', timing ? `${timing.ok}/${timing.judged} 次` : '--', timing ? `${Math.round(timing.pct * 100)}%` : '--'],
    ],
  };

  let recId = lastReport && lastReport.recId;
  if (history.length !== savedHistoryLen) {
    recId = now.getTime();
    saveSession({
      id: recId, date: now.toISOString(), name: student.name, sid: student.sid, score,
      contacts: contactEvents.length, duration: video.duration || 0, mode: scored.mode,
      skill: skill.id, skillName: skill.name, report: reportSnapshot,
    });
    savedHistoryLen = history.length;
    renderHistory();
    renderArchive();
  }

  const sessions = loadSessions().filter((s) => s.name === student.name && (!s.skill || s.skill === skill.id));
  const trend = sessions.slice(-5).map((s) => s.score);

  const row = (name, s, unit) => s
    ? `<tr><td>${name}</td><td><b>${s.avg}${unit}</b></td><td>${s.goodPct}%</td></tr>`
    : `<tr><td>${name}</td><td>--</td><td>--</td></tr>`;
  const timingRow = timing
    ? `<tr><td>蹬地发力时机</td><td><b>${timing.ok}/${timing.judged} 次</b></td><td>${Math.round(timing.pct * 100)}%</td></tr>`
    : `<tr><td>蹬地发力时机</td><td>--</td><td>--</td></tr>`;

  reportBody.innerHTML = `
    <div class="report-meta">
      <span class="meta-chip">👤 ${esc(student.name)}</span>
      <span class="meta-chip">🎓 ${esc(student.sid)}</span>
      <span class="meta-chip">${skill.icon} ${esc(skill.examName)}</span>
      <span class="meta-chip">🕐 ${dateStr}</span>
      <span class="meta-chip">击球动作 ${contactEvents.length} 次（人体推算）</span>
    </div>
    <div class="report-score">
      <div class="score-num">${score}</div>
      <div>
        <div class="score-grade">${grade}</div>
        <div class="score-sub">${parts.map(([n, w]) => `${n} ${Math.round((w / wSum) * 100)}%`).join(' · ')} 加权</div>
        <div class="score-sub">${modeNote}</div>
      </div>
    </div>
    <table class="report-table">
      <thead><tr><th>指标</th><th>平均值</th><th>理想区间占比</th></tr></thead>
      <tbody>
        ${skill.tableKeys.map(([k, u]) => row(METRICS[k].label, stats[k], u)).join('')}
        ${timingRow}
      </tbody>
    </table>
    ${issues.length
      ? `<p class="report-issues">🔍 重点改进：<br>${issues.map((i) => '· ' + i).join('<br>')}</p>`
      : `<p class="report-issues" style="color:var(--good)">✅ 各项指标表现稳定，继续保持！</p>`}
    ${trend.length >= 2 ? `
    <div class="report-trend">
      <span class="trend-label">📈 ${esc(student.name)} · ${esc(skill.name)} 近 ${trend.length} 次</span>
      <span class="trend-chips">${trend.map((s2, i) => `${i ? '<i>→</i>' : ''}<b class="${s2 >= 85 ? 'good' : s2 >= 70 ? '' : s2 >= 55 ? 'warn' : 'bad'}">${s2}</b>`).join('')}</span>
    </div>` : ''}
    <div class="report-actions">
      <button class="btn btn-primary btn-sm" id="btn-export" type="button">📄 导出本项目 PDF</button>
      <button class="btn btn-ghost btn-sm" id="btn-export-md" type="button">⬇ 导出 Markdown</button>
      <button class="btn btn-ghost btn-sm" id="btn-export-all-inline" type="button">📄 全部项目总报告 PDF</button>
    </div>
  `;
  reportCard.hidden = false;
  reportCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  lastReport = { recId, ...reportSnapshot };
  $('#btn-export').addEventListener('click', () => {
    if (lastReport) exportSingleReportPdf(lastReport);
  });
  $('#btn-export-md').addEventListener('click', () => {
    if (lastReport) exportSingleReportMd(lastReport);
  });
  $('#btn-export-all-inline').addEventListener('click', () => $('#btn-export-all')?.click());
}

/* ============================================================
 * VolleySense · 北京大学排球课程
 * 登录 → 选择考试项目 → 上传视频 → 人体动作分析 → 报告
 *
 * 关键动作窗口由人体姿态相位判定；扣球只评腾空挥臂。
 * ============================================================ */

import { createVisionEngines, BONES, ANGLE_JOINTS } from './poseEngine.js';
import { SKILL_LIST, SKILL_GROUPS, getSkill } from './skills.js';
import { citeList } from './refs.js';
import { angleABC, mid, trunkLean, visible, forearmTilt } from './angles.js';
import { exportSingleReportPdf, exportCombinedReportPdf, exportSingleReportMd, exportCombinedReportMd } from './pdfExport.js';
import {
  setStature, resetVideoScale, updateStandingScale, formatScaled, calibCaption, scaleState,
} from './scale.js';

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
let lastPoseLandmarks = null;
let lastPoseMetrics = null;
let lastPoseTs = 0;
let student = { name: '', sid: '', height: null };
let skill = getSkill('tossBump');
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
  student = { name: s.name, sid: s.sid, height: s.height || null };
  setStature(student.height);
  $('#user-chip').textContent = student.height
    ? `${s.name} · ${s.sid} · ${student.height} cm`
    : `${s.name} · ${s.sid}`;
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
    if (saved.height) $('#login-height').value = saved.height;
    if (saved.height) applySession(saved);
  }
} catch { /* ignore */ }

$('#login-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('#login-name').value.trim();
  const sid = $('#login-sid').value.trim();
  const height = Number($('#login-height').value);
  const err = $('#login-err');
  if (!name || !sid || !Number.isFinite(height) || height < 140 || height > 210) {
    err.hidden = false;
    return;
  }
  err.hidden = true;
  const rec = { name, sid, height: Math.round(height) };
  if ($('#login-remember').checked) {
    try { localStorage.setItem(LS_SESSION, JSON.stringify(rec)); } catch { /* ignore */ }
  } else {
    try { localStorage.removeItem(LS_SESSION); } catch { /* ignore */ }
  }
  applySession(rec);
});

$('#btn-send-teacher-hub')?.addEventListener('click', () => {
  toast('教师端对接即将开通。当前请先导出 PDF / Markdown，再自行提交给任课教师。');
});

$('#btn-logout').addEventListener('click', () => {
  try { localStorage.removeItem(LS_SESSION); } catch { /* ignore */ }
  student = { name: '', sid: '', height: null };
  resetVideoScale();
  setStature(null);
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
  const teachVid = $('#teach-video');
  if (teachVid) {
    teachVid.pause();
    teachVid.removeAttribute('src');
    teachVid.load();
  }
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
  $('#skill-grid').innerHTML = SKILL_GROUPS.map((g) => {
    if (g.skillId) {
      return `<button class="skill-card" type="button" data-skill="${g.skillId}">
        <span class="skill-icon">${g.icon}</span>
        <span class="skill-name">${g.name}</span>
        <span class="skill-exam">${g.examName}</span>
        <span class="skill-blurb">${g.blurb}</span>
        <span class="skill-cam">📷 ${g.camera}</span>
      </button>`;
    }
    return `<article class="skill-card split">
      <div class="skill-head">
        <span class="skill-icon">${g.icon}</span>
        <span class="skill-name">${g.name}</span>
        <span class="skill-exam">${g.examName}</span>
        <span class="skill-blurb">${g.blurb}</span>
        <span class="skill-cam">📷 ${g.camera}</span>
      </div>
      <div class="skill-split">
        ${g.variants.map((v, i) => `
          <button type="button" data-skill="${v.id}" class="${i === 1 ? 'exam-slot' : 'drill-slot'}">
            <span class="skill-tag ${v.tag.includes('考试') || v.tag === '上手' || v.tag === '正面下手' ? 'exam' : 'drill'}">${v.tag}</span>
            <strong>${v.title}</strong>
            <small>${v.desc}</small>
          </button>`).join('')}
      </div>
    </article>`;
  }).join('');
  $('#skill-grid').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-skill]');
    if (btn) selectSkill(btn.dataset.skill);
  });
})();

function toast(msg) {
  let el = $('#toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 3200);
}

function selectSkill(id) {
  skill = getSkill(id);
  METRICS = skill.metrics;
  PHASE = skill.phase;
  $('#skill-eyebrow').textContent = `考试项目 · ${skill.examName}`;
  $('#skill-title').innerHTML = `上传「${skill.name}」视频<br /><span class="grad-text">对照课堂标准自评</span>`;
  $('#skill-blurb').textContent = skill.blurb;
  const cam = skill.camera;
  $('#camera-card').innerHTML = `
    <h3>拍摄机位（请按此取景，否则角度误差会明显变大）</h3>
    <div class="cam-specs">
      <div><em>角度</em><b>${esc(cam.angle)}</b></div>
      <div><em>距离</em><b>${esc(cam.distance)}</b></div>
      <div><em>镜头离地</em><b>${esc(cam.height)}</b></div>
      <div><em>帧率</em><b>${esc(cam.fps)}</b></div>
    </div>
    <p><b>最佳机位：</b>${esc(cam.best)}</p>
    <p>${esc(cam.also)}</p>
    <p><b>取景：</b>${esc(cam.framing)}</p>
    <p><b>避免：</b>${esc(cam.avoid)}</p>
    <p class="cam-cite">${esc(cam.cite)}</p>`;
  $('#chart-hint').textContent = '绿色色带 = 膝角参考区间 · ▲ = 人体关键动作窗口 · 点击跳转';
  $('#std-title').textContent = `${skill.examName} · 评判标准`;
  buildStandardsTable(skill.id);
  buildDashboard();
  hub.hidden = true;
  hero.hidden = false;
  analyzer.hidden = true;
  renderHistory();
  bindTeach(skill);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function bindTeach(sk) {
  const teach = sk.teach;
  const videoEl = $('#teach-video');
  const ph = $('#teach-placeholder');
  const bubble = $('#coach-bubble');
  if (!teach) return;
  bubble.innerHTML = (teach.points || []).map((p) => `<p>${esc(p)}</p>`).join('');
  videoEl.pause();
  videoEl.removeAttribute('src');
  videoEl.hidden = true;
  ph.hidden = false;
  const onOk = () => {
    videoEl.hidden = false;
    ph.hidden = true;
  };
  const onFail = () => {
    videoEl.hidden = true;
    ph.hidden = false;
  };
  videoEl.onloadeddata = onOk;
  videoEl.onerror = onFail;
  videoEl.src = teach.video;
  videoEl.load();
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

/** 成绩按姓名与学号共同归属，避免同名学生之间串档。 */
function belongsToCurrentStudent(rec) {
  return !!rec
    && !!student.name
    && !!student.sid
    && rec.name === student.name
    && rec.sid === student.sid;
}

/** 当前学员某项目最近一次带完整报告快照的记录 */
function latestReportFor(skillId) {
  const aliases = { tossBump: ['tossBump', 'bump'], tossSet: ['tossSet', 'set'] };
  const ids = aliases[skillId] || [skillId];
  const list = loadSessions()
    .filter((s) => belongsToCurrentStudent(s) && ids.includes(s.skill) && s.report)
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
      <span class="h-name">${esc(sk.name)}</span>
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
  if (!rec || !rec.report) { toast('该项目还没有可导出的报告'); return; }
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
    toast('还没有任何项目报告。请先完成至少一项分析并生成报告。');
    return;
  }
  exportCombinedReportPdf(student, reports, summaryRows);
});

$('#btn-export-all-md')?.addEventListener('click', () => {
  const { reports, summaryRows } = collectAllReports();
  if (!reports.length) {
    toast('还没有任何项目报告。请先完成至少一项分析并生成报告。');
    return;
  }
  exportCombinedReportMd(student, reports, summaryRows);
});

function renderHistory() {
  const sessions = loadSessions().filter((s) => belongsToCurrentStudent(s) && (!s.skill || s.skill === skill.id));
  historyCard.hidden = sessions.length === 0;
  historyList.innerHTML = sessions.slice(-6).reverse().map((s) => {
    const d = new Date(s.date);
    const ds = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const cls = s.score >= 85 ? 'good' : s.score >= 70 ? '' : s.score >= 55 ? 'warn' : 'bad';
    return `<li><span class="h-date">${ds}</span><span class="h-name">${esc(s.skillName || skill.name)}</span><span class="h-score ${cls}">${s.score}</span></li>`;
  }).join('');
}
$('#btn-clear-history').addEventListener('click', () => {
  try {
    const others = loadSessions().filter((s) => !belongsToCurrentStudent(s));
    localStorage.setItem(LS_SESSIONS, JSON.stringify(others));
  } catch { /* ignore */ }
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
  focus.innerHTML = `<div class="focus-label">🎯 当前重点</div><div class="focus-text" id="focus-text">上传视频后点击「播放分析」开始</div><p class="calib-chip" id="calib-chip">${esc(calibCaption())}</p>`;
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

function buildStandardsTable(activeId = skill.id) {
  const current = getSkill(activeId);
  const tabs = SKILL_LIST.map((s) =>
    `<button type="button" class="std-tab ${s.id === current.id ? 'on' : ''}" data-std="${s.id}">${s.name}</button>`
  ).join('');
  const rows = current.standards.map((d) => `
    <tr>
      <td><b>${d.name}</b></td>
      <td class="tag-good">${d.good}</td>
      <td class="tag-warn">${d.warn}</td>
      <td class="tag-bad">${d.bad}</td>
    </tr>
    <tr><td colspan="4" class="std-note">${d.note}</td></tr>`).join('');
  const refHtml = citeList(current.refs || []).map((r) =>
    `<li>${r.url ? `<a href="${r.url}" target="_blank" rel="noopener">${r.tag}</a>` : r.tag} ${esc(r.title)}${r.note ? ` — ${esc(r.note)}` : ''}</li>`
  ).join('');
  const cam = current.camera;
  $('#standards-table').innerHTML = `
    <div class="std-tabs">${tabs}</div>
    <p class="std-lead">${esc(current.examName)} · ${esc(current.blurb)}</p>
    <div class="cam-specs cam-specs-modal">
      <div><em>角度</em><b>${esc(cam.angle)}</b></div>
      <div><em>距离</em><b>${esc(cam.distance)}</b></div>
      <div><em>镜头离地</em><b>${esc(cam.height)}</b></div>
      <div><em>帧率</em><b>${esc(cam.fps)}</b></div>
    </div>
    <table class="std-table">
      <thead><tr><th>指标</th><th>✅ 理想</th><th>⚠️ 可接受</th><th>⛔ 需纠正</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <h4 class="ref-h">参考文献</h4>
    <ul class="ref-list">${refHtml || '<li>见课程教学口径</li>'}</ul>
    <p class="std-bound">能力边界：不评判肩内旋/外旋与绝对球速（单目 2D 不可靠）。肘角仅作粗粒度判断。文献精英数值为上限参考，公体课采用教学可执行区间。</p>`;
  $('#std-title').textContent = `${current.examName} · 评判标准`;
}

buildStandardsTable('tossBump');

$('#standards-table')?.addEventListener('click', (e) => {
  const tab = e.target.closest('[data-std]');
  if (tab) buildStandardsTable(tab.dataset.std);
});

$('#btn-standards').addEventListener('click', () => {
  buildStandardsTable(skill.id);
  modal.hidden = false;
});
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
  lastPoseLandmarks = null;
  lastPoseMetrics = null;
  lastPoseTs = 0;
  resetVideoScale();
}

function loadFile(file) {
  if (!file.type.startsWith('video/')) { toast('请选择视频文件'); return; }
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
  loadingText.textContent = '正在下载人体姿态模型（首次加载需要一点时间）…';
  modelPromise = createVisionEngines((msg) => { loadingText.textContent = msg; })
    .then(({ pose }) => {
      landmarker = pose;
      stageLoading.hidden = true;
      loadingText.textContent = '人体姿态模型就绪';
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
video.addEventListener('seeking', () => {
  motionSeries = [];
  smooth = {};
  standStreak = 0;
  lastPoseLandmarks = null;
  lastPoseMetrics = null;
  lastPoseTs = 0;
});
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
  const ts = performance.now();
  const result = landmarker.detectForVideo(video, ts);
  const lm = result.landmarks && result.landmarks[0];
  if (!lm && lastPoseLandmarks && ts - lastPoseTs <= 450) {
    // 快速动作和腾空最高点容易偶发漏掉一两帧；短暂沿用最近一次显示，
    // 但不重复采样或计分，避免把同一姿态伪造成多个事件。
    drawOverlay(lastPoseLandmarks, lastPoseMetrics);
    updateDashboard(lastPoseMetrics);
    return;
  }
  const metrics = computeMetrics(lm);
  if (lm && metrics) {
    lastPoseLandmarks = lm;
    lastPoseMetrics = metrics;
    lastPoseTs = ts;
  }
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

  if (visible(lm, [0, 11, 12, 23, 24], 0.35)) {
    const shoulder = mid(lm[11], lm[12]);
    const hip = mid(lm[23], lm[24]);
    m.headLean = Math.max(0, Math.round(180 - angleABC(lm[0], shoulder, hip)));
    m.conf.headLean = minVis(0, 11, 12, 23, 24);
  }

  if (visible(lm, [23, 24], 0.3)) {
    const hip = mid(lm[23], lm[24]);
    if (visible(lm, [27, 28], 0.3)) {
      const legLen = mid(lm[27], lm[28]).y - hip.y;
      if (legLen > 0.05) {
        cogBaseline = Math.max(cogBaseline, legLen);
        m.cog = Math.round(((cogBaseline - legLen) / cogBaseline) * 100);
        m.conf.cog = minVis(23, 24, 27, 28);
      }
    }
    // 视频可能从助跑或屈膝开始，不能只等“完全站直”才建立地面基线。
    // 先用最初/最低的髋部位置初始化，随后在站立帧缓慢校准。
    if (!hipStandY) hipStandY = hip.y;
    else if (hip.y > hipStandY) hipStandY = hipStandY * 0.8 + hip.y * 0.2;
    if (m.knee != null && m.knee >= PHASE.standKnee && (m.cog == null || m.cog < PHASE.standCog)) {
      hipStandY = hipStandY ? hipStandY * 0.85 + hip.y * 0.15 : hip.y;
      if (visible(lm, [0, 27, 28], 0.35)) {
        const span = mid(lm[27], lm[28]).y - lm[0].y;
        updateStandingScale(span);
      }
    }
    scaleState.hipStandY = hipStandY || null;
    scaleState.cogBaseline = cogBaseline || null;
    if (hipStandY > 0.05) {
      m.jumpRise = Math.max(0, Math.round(((hipStandY - hip.y) / hipStandY) * 100));
      m.conf.jumpRise = minVis(23, 24);
      m.airborne = m.jumpRise >= (skill.phase.airMin || 3);
    }
  }

  const wrists = [lm[15], lm[16]].filter((p) => (p.visibility ?? 1) >= 0.35);
  if (wrists.length && visible(lm, [11, 12], 0.3)) {
    const wy = wrists.reduce((s, p) => s + p.y, 0) / wrists.length;
    const sh = mid(lm[11], lm[12]);
    const noseY = lm[0] ? lm[0].y : sh.y - 0.12;
    m.wristHigh = Math.round((sh.y - wy) * 100);
    m.conf.wristHigh = Math.min(...wrists.map((p) => p.visibility ?? 1), minVis(11, 12));
    m.aboveHead = wy < noseY;
    m.aboveBrow = wy < noseY + 0.05;
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
  const bothWrists = visible(lm, [15, 16], 0.35);
  const wy = wrists.reduce((s, p) => s + p.y, 0) / wrists.length;
  const sh = mid(lm[11], lm[12]);
  const noseY = lm[0] ? lm[0].y : sh.y - 0.12;
  motionSeries.push({
    t, y: wy,
    belowShoulder: wy > sh.y,
    aboveHead: wy < noseY,
    aboveBrow: wy < noseY + 0.05,
    bothWrists,
    bothBelowShoulder: bothWrists && lm[15].y > sh.y && lm[16].y > sh.y,
    bothAboveBrow: bothWrists && lm[15].y < noseY + 0.05 && lm[16].y < noseY + 0.05,
    knee: m.knee, cog: m.cog, jumpRise: m.jumpRise,
    airborne: !!m.airborne,
    wristGap: visible(lm, [15, 16], 0.3) ? Math.hypot(lm[15].x - lm[16].x, lm[15].y - lm[16].y) : null,
    wristHigh: m.wristHigh, elbowMax: m.elbowExt,
    elbowMean: m.setElbow,
    armCount: Number(m.elbowL != null) + Number(m.elbowR != null),
    armAsym: m.elbowL != null && m.elbowR != null ? Math.abs(m.elbowL - m.elbowR) : null,
  });
  while (motionSeries.length && t - motionSeries[0].t > 3) motionSeries.shift();

  const lastT = contactEvents.length ? contactEvents[contactEvents.length - 1].t : -Infinity;
  const hit = skill.detect(motionSeries, lastT);
  if (hit) {
    const ev = typeof hit === 'object' ? hit : { t: motionSeries[motionSeries.length - 2].t, via: 'pose' };
    contactEvents.push({
      t: ev.t ?? motionSeries[motionSeries.length - 2].t,
      confirmedAt: t,
      via: ev.via || 'pose',
      airborne: !!ev.airborne,
    });
  }
}

function classifyPhase(m) {
  const t = video.currentTime;
  if (contactEvents.some((e) => Math.abs(e.t - t) <= PHASE.contactWindow
    || (e.confirmedAt != null && t >= e.confirmedAt && t - e.confirmedAt <= PHASE.contactWindow))) {
    standStreak = 0;
    return 'contact';
  }
  if (skill.id === 'spike' && m.airborne) {
    standStreak = 0;
    return 'airborne';
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
  const liveKey = (key) => !skill.metricLive || skill.metricLive(key, metrics || {}, phase);

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
  const lvColor = (def, v, key) => {
    if (standing || !def) return LEVEL_COLOR.none;
    if (key && !liveKey(key)) return LEVEL_COLOR.none;
    return LEVEL_COLOR[def.evaluate(v).level];
  };
  const elbowDef = METRICS[skill.overlay.elbowAs];
  const kneeDef = METRICS.knee;
  if (metrics) {
    const jointMap = {
      13: [metrics.elbowL, elbowDef, skill.overlay.elbowAs],
      14: [metrics.elbowR, elbowDef, skill.overlay.elbowAs],
      25: [metrics.kneeL, kneeDef, 'knee'],
      26: [metrics.kneeR, kneeDef, 'knee'],
    };
    for (const j of ANGLE_JOINTS) {
      const pair = jointMap[j.idx];
      if (!pair) continue;
      const [v, def, key] = pair;
      if (v == null || (lm[j.idx].visibility ?? 1) < 0.3) continue;
      badges.push({ x: lm[j.idx].x * W, y: lm[j.idx].y * H, text: `${j.name} ${v}°`, color: lvColor(def, v, key) });
    }
    if (skill.overlay.tilt && metrics.platformTilt != null && visible(lm, [15, 16], 0.3)) {
      const wm = mid(lm[15], lm[16]);
      const color = tiltActive(metrics) && liveKey('platformTilt') ? lvColor(METRICS.platformTilt, metrics.platformTilt, 'platformTilt') : LEVEL_COLOR.none;
      badges.push({ x: wm.x * W, y: wm.y * H + 26, text: `平台 ${metrics.platformTilt}°`, color });
    }
    if (skill.overlay.cog && metrics.cog != null) {
      const hipY = mid(lm[23], lm[24]).y * H;
      const color = lvColor(METRICS.cog, metrics.cog, 'cog');
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

function setMetricDisplay(el, def, v) {
  const shown = formatScaled(def, v);
  el.innerHTML = `${shown.n}<small>${shown.unit}</small>`;
  el.title = shown.title || '';
}

function fillMetricRow(el, def, v, standing, conf, inactiveHint) {
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
  setMetricDisplay(el.value, def, v);
  el.value.classList.toggle('lowconf', lowConf);
  if (lowConf) el.value.title = (el.value.title ? `${el.value.title} · ` : '') + '置信度较低（可能被遮挡），评分时已降权';
  const [min, max] = def.range;
  el.marker.style.left = `${clamp(((v - min) / (max - min)) * 100)}%`;
  if (standing || inactiveHint) {
    setCardLevel(el, 'none', standing ? '站立·不计分' : '窗口外·不计分', inactiveHint || '');
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
      const gated = skill.metricLive && m ? !skill.metricLive(key, m, phase) : false;
      const inactive = gated || (key === 'platformTilt' && v != null && !tiltActive(m));
      if (v == null) {
        sub.value.innerHTML = `--<small>${def.unit}</small>`;
        sub.value.classList.remove('lowconf');
        sub.dot.className = 'lv-dot none';
        sub.marker.style.left = '0%';
        continue;
      }
      const { level } = def.evaluate(v);
      const lowConf = ((m.conf && m.conf[key]) ?? 1) < 0.55;
      setMetricDisplay(sub.value, def, v);
      sub.value.classList.toggle('lowconf', lowConf);
      sub.dot.className = `lv-dot ${standing || inactive ? 'none' : level}`;
      const [min, max] = def.range;
      sub.marker.style.left = `${clamp(((v - min) / (max - min)) * 100)}%`;
      if (!inactive) subResults.push({ key, level, v });
    }
    if (!subResults.length) {
      setCardLevel(pEls, 'none', standing ? '站立·不计分' : (phase === 'contact' ? '未检测到' : '等待动作峰值'), skill.idleHint?.platformExt || '');
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
    const live = !skill.metricLive || !m || skill.metricLive(key, m, phase);
    fillMetricRow(
      el, METRICS[key], m ? m[key] : null, standing && !!m,
      m && m.conf ? m.conf[key] : 1,
      (!standing && m && !live) ? (skill.idleHint?.[key] || '非评分窗口 · 不计分') : null,
    );
  }
  updateFocus(m, standing);
  const chip = $('#calib-chip');
  if (chip) chip.textContent = calibCaption();
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
    text.textContent = '站立段不计分 —— 正在用身高做垂直 1D 标定，随后只在动作峰值/腾空窗口评分';
    list.innerHTML = `<li class="good">${esc(calibCaption())}。发球、垫球、传球会尝试检测排球；扣球只评腾空挥臂。</li>`;
    return;
  }
  if (skill.id === 'spike' && phase === 'ready') {
    card.className = 'focus-card';
    text.textContent = '地面挥臂不计分。请助跑起跳，系统只测量空中击球窗口的臂角与击球点。';
    list.innerHTML = `<li class="good">扣球建议只针对腾空段：头上伸臂击球，而不是地面空挥。</li>`;
    return;
  }
  const issues = [];
  for (const key of skill.focusOrder) {
    const v = m[key];
    if (v == null || !METRICS[key]) continue;
    if (skill.metricLive && !skill.metricLive(key, m, phase)) continue;
    if (key === 'platformTilt' && !tiltActive(m)) continue;
    const { level } = METRICS[key].evaluate(v);
    if (level !== 'good') issues.push({ key, level, v });
  }
  if (!issues.length) {
    card.className = 'focus-card lv-good';
    text.textContent = phase === 'contact' ? '⚡ 关键动作窗口：姿态良好，保持！' : (phase === 'airborne' ? '▲ 腾空窗口姿态良好' : '等待关键动作…');
    list.innerHTML = `<li class="good">${phase === 'contact' || phase === 'airborne' ? '当前评分窗口内姿态良好。' : '窗口外动作仅作参考，建议查看动作峰值或腾空瞬间。'}</li>`;
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
  // 每次事件只取时间上最近的一帧，避免把准备、移动和随挥混入动作评分。
  const picked = [];
  const used = new Set();
  for (const event of contactEvents) {
    const nearest = history
      .filter((h) => Math.abs(h.t - event.t) <= PHASE.scoreWindow)
      .sort((a, b) => Math.abs(a.t - event.t) - Math.abs(b.t - event.t))[0];
    if (nearest && !used.has(nearest)) {
      used.add(nearest);
      // 事件通常在局部最小点后的下一帧才确认，旧样本原本可能仍标成 ready。
      picked.push({ ...nearest, phase: event.airborne ? 'airborne' : 'contact', contactVia: event.via });
    }
  }
  if (picked.length) return { samples: picked, mode: 'contact-frame' };
  return { samples: [], mode: 'none' };
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

function actionMismatchHint() {
  // 这里只拦截特征非常明确的跨项目视频；不把边界动作强行分类。
  const spikeLike = history.some((h) =>
    h.jumpRise >= 6
    && h.aboveHead
    && h.elbowExt >= 115
    && (h.handsGap == null || h.handsGap > 22));
  if (skill.id !== 'spike' && spikeLike) {
    return '检测到明显的腾空单臂头上挥臂，视频更像扣球；请切换到“扣球”项目后重新分析。';
  }

  const overheadSingleArm = history.filter((h) =>
    !h.airborne
    && h.aboveHead
    && h.elbowExt >= 130
    && (h.handsGap == null || h.handsGap > 18)).length;
  if (skill.group === 'set' && overheadSingleArm >= 2) {
    return '检测到单臂头上挥臂，动作不符合正面双手传球；请确认所选项目与视频一致。';
  }
  return null;
}

function buildReport() {
  const mismatch = actionMismatchHint();
  if (mismatch) {
    toast(mismatch);
    return;
  }
  const scored = pickScoredSamples();
  if (!scored.samples.length) {
    toast(skill.id === 'spike'
      ? '尚未确认腾空挥臂：请完整播放助跑、起跳和头上挥臂过程'
      : '尚未确认关键动作：请完整播放视频，并确保全身清晰入镜');
    return;
  }

  const stat = (key) => {
    if (!METRICS[key]) return null;
    const pool = skill.scoreKey && key === 'knee'
      // 扣球膝角仍取起跳前缓冲期；其余技术指标只取实际击球帧。
      ? history.filter((h) => h[key] != null && skill.scoreKey(key, h))
      : scored.samples.filter((h) => h[key] != null
        && (!skill.scoreKey || skill.scoreKey(key, h))
        && (!skill.metricLive || skill.metricLive(key, h, h.phase)));
    const rows = pool
      .map((h) => ({ v: h[key], w: clamp(h.conf && h.conf[key] != null ? h.conf[key] : 0.8, 0.4, 1) }))
      .filter((r) => r.w >= 0.48);
    if (!rows.length) return null;
    const wSum = rows.reduce((s, r) => s + r.w, 0);
    const avg = Math.round(rows.reduce((s, r) => s + r.v * r.w, 0) / wSum);
    const wScore = rows.reduce((s, r) => {
      const lv = METRICS[key].evaluate(r.v).level;
      // 鼓励型评分：达标满分、提醒项保留大部分分值、明显问题仍给基础分。
      return s + r.w * (lv === 'good' ? 1 : lv === 'warn' ? 0.78 : 0.42);
    }, 0) / wSum;
    const goodPct = Math.round((rows.filter((r) => METRICS[key].evaluate(r.v).level === 'good').reduce((s, r) => s + r.w, 0) / wSum) * 100);
    return { avg, pct: wScore, goodPct };
  };

  const stats = {};
  for (const [key] of skill.tableKeys) stats[key] = stat(key);
  const missingCore = (skill.requiredMetrics || []).filter((key) => !stats[key]);
  if (missingCore.length) {
    toast(`无法生成报告：${missingCore.map((key) => METRICS[key]?.label || key).join('、')}未形成有效数据。请确认动作类型正确且关键部位清晰入镜。`);
    return;
  }
  const timing = evalTiming();

  const avgPct = (keys) => {
    const a = keys.map((k) => stats[k]).filter(Boolean);
    return a.length ? a.reduce((s, x) => s + x.pct, 0) / a.length : null;
  };

  const parts = skill.reportMap.map((p) => {
    const val = p.timing ? (timing ? 0.62 + timing.pct * 0.38 : null) : avgPct(p.keys);
    return [p.name, skill.weights[p.wKey], val];
  }).filter(([, , p]) => p != null);
  const wSum = parts.reduce((s, [, w]) => s + w, 0) || 1;
  const rawScore = parts.reduce((s, [, w, p]) => s + w * p, 0) / wSum;
  const score = Math.round(15 + 85 * rawScore);
  const grade = score >= 85 ? '🏆 优秀' : score >= 70 ? '👍 良好' : score >= 55 ? '💪 继续加油' : '📌 需要重点纠正';
  const gradeText = score >= 85 ? '优秀' : score >= 70 ? '良好' : score >= 55 ? '继续加油' : '需要重点纠正';

  let modeNote;
  if (scored.mode === 'contact-frame') {
    const win = skill.id === 'spike' ? '腾空挥臂窗口' : '关键动作窗口';
    modeNote = `基于人体姿态识别到的 ${contactEvents.length} 次${win}，每次只取动作峰值最近的一帧。准备、移动与随挥均不计入动作分。`;
  }

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
    name: student.name, sid: student.sid, height: student.height,
    scaleNote: calibCaption(),
    skillId: skill.id, skillName: skill.examName, skillIcon: skill.icon,
    tableRows: [
      ...skill.tableKeys.map(([k, u]) => {
        const s = stats[k];
        if (!s) return [METRICS[k].label, '--', '--'];
        const shown = formatScaled(METRICS[k], s.avg);
        const avgTxt = shown.unit && shown.unit !== u
          ? `${shown.n}${shown.unit}`
          : `${s.avg}${u}`;
        return [METRICS[k].label, avgTxt, `${s.goodPct}%`];
      }),
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

  const sessions = loadSessions().filter((s) => belongsToCurrentStudent(s) && (!s.skill || s.skill === skill.id));
  const trend = sessions.slice(-5).map((s) => s.score);

  const row = (name, s, key, unit) => {
    if (!s) return `<tr><td>${name}</td><td>--</td><td>--</td></tr>`;
    const shown = formatScaled(METRICS[key], s.avg);
    const avgTxt = shown.n !== String(s.avg) || shown.unit !== unit
      ? `<b>${shown.n}${shown.unit}</b>`
      : `<b>${s.avg}${unit}</b>`;
    return `<tr><td>${name}</td><td>${avgTxt}</td><td>${s.goodPct}%</td></tr>`;
  };
  const timingRow = timing
    ? `<tr><td>蹬地发力时机</td><td><b>${timing.ok}/${timing.judged} 次</b></td><td>${Math.round(timing.pct * 100)}%</td></tr>`
    : `<tr><td>蹬地发力时机</td><td>--</td><td>--</td></tr>`;

  reportBody.innerHTML = `
    <div class="report-meta">
      <span class="meta-chip">👤 ${esc(student.name)}</span>
      <span class="meta-chip">🎓 ${esc(student.sid)}</span>
      <span class="meta-chip">📏 ${student.height ? `${student.height} cm` : '未填身高'}</span>
      <span class="meta-chip">🕐 ${dateStr}</span>
      <span class="meta-chip">关键动作 ${contactEvents.length} 次</span>
    </div>
    <div class="report-score">
      <div class="score-num">${score}</div>
      <div>
        <div class="score-grade">${grade}</div>
        <div class="score-sub">${parts.map(([n, w]) => `${n} ${Math.round((w / wSum) * 100)}%`).join(' · ')} 加权</div>
        <div class="score-sub">${modeNote}</div>
        <div class="score-sub">${esc(calibCaption())}。厘米为垂直估算，不作绝对测距。</div>
      </div>
    </div>
    <table class="report-table">
      <thead><tr><th>指标</th><th>平均值</th><th>理想区间占比</th></tr></thead>
      <tbody>
        ${skill.tableKeys.map(([k, u]) => row(METRICS[k].label, stats[k], k, u)).join('')}
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
      <button class="btn btn-send btn-sm" id="btn-send-teacher" type="button">📤 一键发送教师</button>
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
  $('#btn-send-teacher')?.addEventListener('click', () => {
    toast('教师端对接即将开通。当前请先导出 PDF / Markdown，再自行提交给任课教师。');
  });
}

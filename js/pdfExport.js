/* ============================================================
 * 报告导出
 *  PDF：打开打印窗口 → 在打印对话框选「另存为 PDF」（浏览器原生，中文可靠）
 *  Markdown：直接下载 .md 文件，可备份或自行转 PDF
 *  注意：window.open 必须在点击事件里同步调用，否则会被拦截。
 * ============================================================ */

const PRINT_CSS = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body {
    font-family: "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif;
    color: #1a1f36; background: #fff; padding: 12mm;
    font-size: 13px; line-height: 1.65;
  }
  .cover { text-align: center; margin-bottom: 22px; padding-bottom: 16px; border-bottom: 2px solid #1a1f36; }
  .cover .crest { font-size: 12px; letter-spacing: 3px; color: #5b6b8c; margin-bottom: 8px; }
  .cover h1 { font-size: 22px; margin: 0 0 6px; }
  .cover .sub { color: #5b6b8c; font-size: 13px; }
  .meta { display: flex; flex-wrap: wrap; gap: 8px 18px; margin: 12px 0 16px; color: #3d4a66; }
  .meta span { white-space: nowrap; }
  .score-box {
    display: flex; align-items: center; gap: 16px;
    background: #f4f6fb; border: 1px solid #d8dee9; border-radius: 10px;
    padding: 14px 18px; margin-bottom: 16px;
  }
  .score-num { font-size: 42px; font-weight: 800; color: #2a3a8f; line-height: 1; }
  .score-grade { font-size: 16px; font-weight: 700; }
  .score-note { font-size: 12px; color: #5b6b8c; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0 16px; }
  th, td { border: 1px solid #d8dee9; padding: 8px 10px; text-align: left; }
  th { background: #eef1f8; color: #3d4a66; font-weight: 600; font-size: 12px; }
  .issues { background: #fff8ee; border-left: 3px solid #e09b2d; padding: 10px 14px; margin: 12px 0; }
  .ok { background: #eefbf4; border-left: 3px solid #2aaa6a; padding: 10px 14px; margin: 12px 0; }
  h2 { font-size: 16px; margin: 22px 0 10px; padding-bottom: 6px; border-bottom: 1px solid #d8dee9; }
  .section { margin-bottom: 22px; page-break-inside: avoid; }
  .summary-table td:nth-child(3) { font-weight: 700; }
  .foot { margin-top: 28px; padding-top: 12px; border-top: 1px solid #d8dee9; color: #8a94a8; font-size: 11px; }
  .missing { color: #a0a8b8; font-style: italic; }
  .print-tip {
    position: sticky; top: 0; margin: -12mm -12mm 16px; padding: 12px 16px;
    background: #2a3a8f; color: #fff; font-size: 14px; text-align: center;
  }
  @media print {
    .print-tip { display: none !important; }
    body { padding: 0; }
  }
`;

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function safeName(s) {
  return String(s || '未署名').replace(/[\\/:*?"<>|]/g, '_');
}

function dateStamp(dateStr) {
  if (!dateStr) {
    const n = new Date();
    return `${n.getFullYear()}${String(n.getMonth() + 1).padStart(2, '0')}${String(n.getDate()).padStart(2, '0')}`;
  }
  return String(dateStr).slice(0, 10).replaceAll('-', '');
}

function filenameFor(r, combined = false, ext = 'pdf') {
  const who = safeName(r?.name);
  const d = dateStamp(r?.dateStr);
  if (combined) return `排球课程总报告_${who}_${d}.${ext}`;
  return `${safeName(r?.skillName || '训练')}报告_${who}_${d}.${ext}`;
}

/* ---------------- HTML 组装 ---------------- */

function skillSectionHtml(r) {
  const rows = (r.tableRows || []).map((row) =>
    `<tr><td>${esc(row[0])}</td><td>${esc(row[1])}</td><td>${esc(row[2])}</td></tr>`
  ).join('');
  const issuesHtml = (r.issues && r.issues.length)
    ? `<div class="issues"><b>重点改进</b><br>${r.issues.map((i) => `· ${esc(i)}`).join('<br>')}</div>`
    : `<div class="ok">各项指标表现稳定，继续保持。</div>`;

  return `
    <section class="section">
      <h2>${esc(r.skillIcon || '')} ${esc(r.skillName || '训练报告')}</h2>
      <div class="meta">
        <span>时间：${esc(r.dateStr || '—')}</span>
        <span>视频时长：${esc(r.duration || '—')}</span>
        <span>击球动作相位：${esc(r.contacts ?? '—')} 次（人体推算）</span>
      </div>
      <div class="score-box">
        <div class="score-num">${esc(r.score)}</div>
        <div>
          <div class="score-grade">${esc(r.gradeText || '')}</div>
          <div class="score-note">${esc(r.modeNote || '')}</div>
        </div>
      </div>
      <table>
        <thead><tr><th>指标</th><th>平均值</th><th>理想区间占比</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="3" class="missing">暂无明细</td></tr>'}</tbody>
      </table>
      ${issuesHtml}
    </section>`;
}

function wrapPrintDoc(title, inner) {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8" /><title>${esc(title)}</title>
<style>${PRINT_CSS}</style></head><body>
  <div class="print-tip">📄 报告已生成：在弹出的对话框中选择「另存为 PDF」，点击「保存」即可</div>
  ${inner}
</body></html>`;
}

function buildSingleDoc(r) {
  return wrapPrintDoc(`${r.skillName || '训练'}报告`, `
  <div class="cover">
    <div class="crest">北京大学 · 公共体育 · 排球课程</div>
    <h1>${esc(r.skillName || '训练')} · 训练报告</h1>
    <div class="sub">VolleySense 智能分析（本地生成）</div>
  </div>
  <div class="meta">
    <span>姓名：${esc(r.name || '（未填写）')}</span>
    <span>学号：${esc(r.sid || '（未填写）')}</span>
    <span>导出时间：${esc(r.dateStr || '')}</span>
  </div>
  ${skillSectionHtml(r)}
  <div class="foot">本报告由 VolleySense 在浏览器本地生成，视频未上传服务器。评分基于人体姿态关键帧，不检测排球本身。</div>`);
}

function buildCombinedDoc(student, reports, summaryRows) {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const scored = reports.filter((r) => r && r.score != null);
  const avg = scored.length
    ? Math.round(scored.reduce((s, r) => s + r.score, 0) / scored.length)
    : '—';

  return wrapPrintDoc('排球课程总报告', `
  <div class="cover">
    <div class="crest">北京大学 · 公共体育 · 排球课程</div>
    <h1>考试技术总报告</h1>
    <div class="sub">垫球 · 传球 · 下手发球 · 上手发球 · 扣球</div>
  </div>
  <div class="meta">
    <span>姓名：${esc(student.name || '（未填写）')}</span>
    <span>学号：${esc(student.sid || '（未填写）')}</span>
    <span>导出时间：${esc(dateStr)}</span>
  </div>
  <section class="section">
    <h2>成绩总览</h2>
    <div class="score-box">
      <div class="score-num">${esc(avg)}</div>
      <div>
        <div class="score-grade">已评项目均分</div>
        <div class="score-note">共 ${scored.length} / ${summaryRows.length} 项有成绩；未评项目可继续上传分析后再次导出。</div>
      </div>
    </div>
    <table class="summary-table">
      <thead><tr><th>考试项目</th><th>最近测评时间</th><th>得分</th><th>等级</th></tr></thead>
      <tbody>
        ${summaryRows.map((row) => `
          <tr>
            <td>${esc(row.name)}</td>
            <td>${esc(row.dateStr || '尚未测评')}</td>
            <td>${row.score != null ? esc(row.score) : '<span class="missing">—</span>'}</td>
            <td>${esc(row.gradeText || '—')}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </section>
  <h2>分项明细</h2>
  ${reports.filter(Boolean).map((r) => skillSectionHtml(r)).join('') || '<p class="missing">暂无已保存的项目报告。</p>'}
  <div class="foot">本报告由 VolleySense 在浏览器本地生成，视频未上传服务器。评分基于人体姿态关键帧，不检测排球本身。</div>`);
}

/* ---------------- Markdown 组装 ---------------- */

function reportToMd(r) {
  return [
    `# 🏐 ${r.skillName || '训练'}训练报告`,
    '',
    `- 课程：北京大学排球课程`,
    `- 姓名：${r.name || '（未填写）'}　学号：${r.sid || '（未填写）'}`,
    `- 时间：${r.dateStr || '—'}`,
    `- 视频时长：${r.duration || '—'}　击球动作相位：${r.contacts ?? '—'} 次（人体推算，非球体检测）`,
    `- 评分方式：${r.modeNote || '—'}`,
    '',
    `## 综合评分：${r.score} 分（${r.gradeText || ''}）`,
    '',
    '| 指标 | 平均值 | 理想区间占比 |',
    '| --- | --- | --- |',
    ...(r.tableRows || []).map((row) => `| ${row[0]} | ${row[1]} | ${row[2]} |`),
    '',
    '## 重点改进',
    ...((r.issues && r.issues.length) ? r.issues.map((i) => `- ${i}`) : ['- 各项指标表现稳定，继续保持！']),
    '',
    '> 由 VolleySense 在浏览器本地生成（视频不上传服务器）',
  ].join('\n');
}

function combinedToMd(student, reports, summaryRows) {
  const scored = reports.filter((r) => r && r.score != null);
  const avg = scored.length
    ? Math.round(scored.reduce((s, r) => s + r.score, 0) / scored.length)
    : '—';
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return [
    '# 🏐 北京大学排球课程 · 考试技术总报告',
    '',
    `- 姓名：${student.name || '（未填写）'}　学号：${student.sid || '（未填写）'}`,
    `- 导出时间：${dateStr}　已评项目均分：${avg}（${scored.length}/${summaryRows.length} 项）`,
    '',
    '| 考试项目 | 最近测评时间 | 得分 | 等级 |',
    '| --- | --- | --- | --- |',
    ...summaryRows.map((row) => `| ${row.name} | ${row.dateStr || '尚未测评'} | ${row.score ?? '—'} | ${row.gradeText || '—'} |`),
    '',
    '---',
    '',
    ...reports.filter(Boolean).map((r) => reportToMd(r)),
  ].join('\n');
}

function downloadText(text, filename) {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/* ---------------- 对外接口（同步调用，避免弹窗被拦） ---------------- */

function openPrintWindow(html, title) {
  const w = window.open('', '_blank');
  if (!w) {
    alert('浏览器拦截了弹窗。请允许本站弹窗后重试。');
    return false;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.document.title = title.replace(/\.pdf$/i, '');
  const trigger = () => { try { w.focus(); w.print(); } catch { /* ignore */ } };
  if (w.document.readyState === 'complete') setTimeout(trigger, 300);
  else w.addEventListener('load', () => setTimeout(trigger, 300));
  setTimeout(trigger, 1200); // 兜底
  return true;
}

/** 单项目 → 打印另存 PDF */
export function exportSingleReportPdf(r) {
  if (!r) return false;
  return openPrintWindow(buildSingleDoc(r), filenameFor(r, false, 'pdf'));
}

/** 全部项目 → 打印另存 PDF */
export function exportCombinedReportPdf(student, reports, summaryRows) {
  return openPrintWindow(
    buildCombinedDoc(student, reports, summaryRows),
    filenameFor({ name: student.name, dateStr: summaryRows.find((x) => x.dateStr)?.dateStr }, true, 'pdf'),
  );
}

/** 单项目 → Markdown 下载 */
export function exportSingleReportMd(r) {
  if (!r) return;
  downloadText(reportToMd(r), filenameFor(r, false, 'md'));
}

/** 全部项目 → Markdown 下载 */
export function exportCombinedReportMd(student, reports, summaryRows) {
  downloadText(
    combinedToMd(student, reports, summaryRows),
    filenameFor({ name: student.name, dateStr: summaryRows.find((x) => x.dateStr)?.dateStr }, true, 'md'),
  );
}

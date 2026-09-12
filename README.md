# 🏐 VolleySense · 排球垫球姿态智能分析

上传垫球视频，基于 **MediaPipe Pose** 在浏览器本地实时识别人体 33 个关键点，
测算并标注 **膝关节夹角、肘关节夹角、躯干前倾角、重心下降幅度**，
对照训练标准即时给出纠正提醒，并生成训练报告。

> 纯静态网页，无需后端，视频不上传任何服务器，可直接部署到 GitHub Pages。

## ✨ 功能

- 📤 拖拽 / 点击上传视频（MP4 / MOV / WebM）
- 🦴 画面实时叠加骨架、关节角度标注、重心参考线
- 📊 6 项指标仪表盘：理想 / 可接受 / 需纠正 三档评判 + 纠正提示
- 📈 角度-时间曲线，点击曲线跳转对应画面
- 📋 一键生成训练报告（综合评分 + 重点改进项）
- 🐢 支持 0.25× / 0.5× 慢放分析

## 📏 评判标准（可在 `js/standards.js` 中调整）

| 指标 | ✅ 理想 | ⚠️ 可接受 | ⛔ 需纠正 |
| --- | --- | --- | --- |
| 肘关节夹角 | 165° ~ 180° | 150° ~ 165° | < 150° |
| 膝关节夹角 | 110° ~ 150° | 100°~110° 或 150°~165° | < 100° 或 > 165° |
| 躯干前倾角 | 10° ~ 30° | 5°~10° 或 30°~40° | < 5° 或 > 40° |
| 重心下降幅度 | ≥ 12% | 6% ~ 12% | < 6% |

## 🎬 拍摄建议

- 固定机位，侧面或斜侧面拍摄效果最佳
- 全身入镜，光线充足，避免逆光
- 视频开头先**自然站直 1~2 秒**（用于重心基准校准），再开始垫球
- 画面中只保留一名运动员

## 🚀 本地预览

```bash
# 任选其一，然后浏览器打开 http://localhost:8000
python -m http.server 8000
npx serve .
```

> 注意：直接双击 index.html 无法运行（浏览器对本地 ES 模块有安全限制），需通过 HTTP 访问。

## 🌐 部署到 GitHub Pages

1. 新建一个 **Public** 仓库，例如 `volleyball-analyzer`
2. 把本项目的所有文件上传（保持 `css/`、`js/` 目录结构）
3. 仓库 **Settings → Pages → Build and deployment**：
   - Source 选 **Deploy from a branch**
   - Branch 选 **main**，目录选 **/(root)**，保存
4. 等待 1~3 分钟，访问 `https://<你的用户名>.github.io/volleyball-analyzer/`

## 🧰 技术栈

- [MediaPipe Pose Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker)（CDN 加载，GPU 加速，自动回退 CPU）
- 原生 HTML / CSS / JavaScript（ES Modules），零构建、零依赖安装

/* ============================================================
 * 姿态识别引擎：封装 MediaPipe PoseLandmarker
 * 模型与运行时均从 CDN 加载，无需打包工具，可直接部署到 GitHub Pages
 * ============================================================ */

import { FilesetResolver, PoseLandmarker } from
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs';

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';

/**
 * 创建姿态识别器（优先 GPU，失败时自动回退 CPU）
 * @returns {Promise<PoseLandmarker>}
 */
export async function createPoseEngine() {
  const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
  const options = (delegate) => ({
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  try {
    return await PoseLandmarker.createFromOptions(fileset, options('GPU'));
  } catch (e) {
    console.warn('GPU 加速不可用，已切换到 CPU 模式', e);
    return await PoseLandmarker.createFromOptions(fileset, options('CPU'));
  }
}

/** 骨架连线（关键点索引对） */
export const BONES = [
  [11, 12],           // 双肩
  [11, 13], [13, 15], // 左臂
  [12, 14], [14, 16], // 右臂
  [11, 23], [12, 24], // 躯干两侧
  [23, 24],           // 双髋
  [23, 25], [25, 27], // 左腿
  [24, 26], [26, 28], // 右腿
];

/** 需要在画面上标注角度的关节：名称 + 关键点索引 */
export const ANGLE_JOINTS = [
  { name: '左肘', idx: 13 },
  { name: '右肘', idx: 14 },
  { name: '左膝', idx: 25 },
  { name: '右膝', idx: 26 },
];

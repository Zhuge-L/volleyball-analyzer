/* ============================================================
 * 人体姿态识别引擎：MediaPipe PoseLandmarker
 * 模型与运行时均从 CDN 加载，无需打包，可直接部署到 GitHub Pages
 * ============================================================ */

import { FilesetResolver, PoseLandmarker } from
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs';

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm';
const POSE_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';

/**
 * 创建姿态识别器（优先 GPU，失败回退 CPU）。
 * @returns {Promise<{ pose: PoseLandmarker }>}
 */
export async function createVisionEngines(onProgress) {
  const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
  const poseOpts = (delegate) => ({
    baseOptions: { modelAssetPath: POSE_URL, delegate },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  onProgress?.('正在加载人体姿态模型…');
  let pose;
  try {
    pose = await PoseLandmarker.createFromOptions(fileset, poseOpts('GPU'));
  } catch (e) {
    console.warn('姿态 GPU 不可用，已切换 CPU', e);
    pose = await PoseLandmarker.createFromOptions(fileset, poseOpts('CPU'));
  }

  return { pose };
}

/** @deprecated 兼容旧调用 */
export async function createPoseEngine() {
  const { pose } = await createVisionEngines();
  return pose;
}

export const BONES = [
  [11, 12],
  [11, 13], [13, 15],
  [12, 14], [14, 16],
  [11, 23], [12, 24],
  [23, 24],
  [23, 25], [25, 27],
  [24, 26], [26, 28],
];

export const ANGLE_JOINTS = [
  { name: '左肘', idx: 13 },
  { name: '右肘', idx: 14 },
  { name: '左膝', idx: 25 },
  { name: '右膝', idx: 26 },
];

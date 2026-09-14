/* ============================================================
 * 姿态 + 球体识别引擎：MediaPipe PoseLandmarker / ObjectDetector
 * 模型与运行时均从 CDN 加载，无需打包，可直接部署到 GitHub Pages
 * ============================================================ */

import { FilesetResolver, PoseLandmarker, ObjectDetector } from
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs';

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm';
const POSE_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';
const BALL_URL = 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite';

/**
 * 创建姿态识别器与球体检测器（优先 GPU，失败回退 CPU）
 * @returns {Promise<{ pose: PoseLandmarker, ballDetector: ObjectDetector|null }>}
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
  const ballOpts = (delegate) => ({
    baseOptions: { modelAssetPath: BALL_URL, delegate },
    runningMode: 'VIDEO',
    scoreThreshold: 0.28,
    maxResults: 5,
  });

  onProgress?.('正在加载人体姿态模型…');
  let pose;
  try {
    pose = await PoseLandmarker.createFromOptions(fileset, poseOpts('GPU'));
  } catch (e) {
    console.warn('姿态 GPU 不可用，已切换 CPU', e);
    pose = await PoseLandmarker.createFromOptions(fileset, poseOpts('CPU'));
  }

  onProgress?.('正在加载球体检测模型…');
  let ballDetector = null;
  try {
    ballDetector = await ObjectDetector.createFromOptions(fileset, ballOpts('GPU'));
  } catch (e1) {
    try {
      ballDetector = await ObjectDetector.createFromOptions(fileset, ballOpts('CPU'));
    } catch (e2) {
      console.warn('球体检测模型加载失败，将使用颜色回退', e2);
      ballDetector = null;
    }
  }

  return { pose, ballDetector };
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

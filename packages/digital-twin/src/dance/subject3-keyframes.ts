/**
 * 科目三舞蹈关键帧数据（抖音版 15 秒循环）
 * 时间单位：秒 | 角度单位：弧度
 * 关节命名见 §2.1，须与 URDF 实际关节名一致（可用 JOINT_ALIAS 映射）
 */
export type G1JointName =
  | 'waist_yaw' | 'waist_pitch' | 'waist_roll'
  | 'left_hip_pitch' | 'left_hip_roll' | 'left_hip_yaw'
  | 'left_knee' | 'left_ankle_pitch' | 'left_ankle_roll'
  | 'right_hip_pitch' | 'right_hip_roll' | 'right_hip_yaw'
  | 'right_knee' | 'right_ankle_pitch' | 'right_ankle_roll'
  | 'left_shoulder_pitch' | 'left_shoulder_roll' | 'left_shoulder_yaw' | 'left_elbow'
  | 'right_shoulder_pitch' | 'right_shoulder_roll' | 'right_shoulder_yaw' | 'right_elbow'

export interface DanceRoot {
  position?: [number, number, number]
  rotationY?: number
}

export interface DanceKeyframe {
  time: number
  joints: Partial<Record<G1JointName, number>>
  root?: DanceRoot
}

export const SUBJECT3_FRAMES: DanceKeyframe[] = [
  // ── 0-3s：双手交叉摇手 ──
  { time: 0,   joints: { waist_yaw: 0, waist_roll: 0, waist_pitch: 0,
    left_shoulder_roll: 0.3, left_shoulder_pitch: -0.2, left_elbow: -0.5,
    right_shoulder_roll: -0.3, right_shoulder_pitch: -0.2, right_elbow: -0.5,
    left_knee: 0.1, right_knee: 0.1 } },
  { time: 0.5, joints: { left_shoulder_roll: -0.2, left_shoulder_pitch: -0.4, left_elbow: -0.8,
    right_shoulder_roll: 0.4, right_shoulder_pitch: -0.1, right_elbow: -0.3,
    waist_yaw: 0.2, waist_roll: 0.1, left_knee: 0.15, right_knee: 0.05 } },
  { time: 1.0, joints: { left_shoulder_roll: 0.5, left_shoulder_pitch: -0.1, left_elbow: -0.3,
    right_shoulder_roll: -0.4, right_shoulder_pitch: -0.4, right_elbow: -0.8,
    waist_yaw: -0.2, waist_roll: -0.1, left_knee: 0.05, right_knee: 0.15 } },
  { time: 1.5, joints: { left_shoulder_roll: -0.1, left_shoulder_pitch: -0.3, left_elbow: -0.6,
    right_shoulder_roll: 0.3, right_shoulder_pitch: -0.3, right_elbow: -0.6,
    waist_yaw: 0.1, waist_roll: 0.05, left_knee: 0.12, right_knee: 0.12 } },
  { time: 2.0, joints: { left_shoulder_roll: 0.4, left_elbow: -0.4,
    right_shoulder_roll: -0.3, right_elbow: -0.5,
    waist_yaw: 0, waist_roll: 0, left_knee: 0.1, right_knee: 0.1 } },
  { time: 2.5, joints: { left_shoulder_roll: -0.3, left_elbow: -0.7,
    right_shoulder_roll: 0.3, right_elbow: -0.4,
    waist_yaw: 0.15, waist_roll: 0.08, left_knee: 0.18, right_knee: 0.05 } },
  { time: 3.0, joints: { left_shoulder_roll: 0.2, left_elbow: -0.5,
    right_shoulder_roll: -0.2, right_elbow: -0.5,
    waist_yaw: 0, waist_roll: 0, left_knee: 0.1, right_knee: 0.1 } },

  // ── 3-6s：扭胯踏步 ──
  { time: 3.5, joints: { waist_yaw: 0.4, waist_roll: 0.2, waist_pitch: -0.05,
    left_hip_pitch: -0.2, left_knee: 0.3, left_ankle_pitch: 0.1,
    right_hip_pitch: 0.05, right_knee: 0.05, right_ankle_pitch: 0,
    left_shoulder_roll: 0.6, right_shoulder_roll: -0.1 } },
  { time: 4.0, joints: { waist_yaw: -0.4, waist_roll: -0.2, waist_pitch: -0.05,
    left_hip_pitch: 0.05, left_knee: 0.05,
    right_hip_pitch: -0.2, right_knee: 0.3, right_ankle_pitch: 0.1,
    left_shoulder_roll: 0.1, right_shoulder_roll: -0.6 } },
  { time: 4.5, joints: { waist_yaw: 0.3, waist_roll: 0.15,
    left_knee: 0.25, right_knee: 0.1,
    left_shoulder_roll: 0.5, right_shoulder_roll: -0.2 } },
  { time: 5.0, joints: { waist_yaw: -0.3, waist_roll: -0.15,
    left_knee: 0.1, right_knee: 0.25,
    left_shoulder_roll: 0.2, right_shoulder_roll: -0.5 } },
  { time: 5.5, joints: { waist_yaw: 0.2, waist_roll: 0.1,
    left_knee: 0.2, right_knee: 0.15, left_elbow: -0.6, right_elbow: -0.6 } },
  { time: 6.0, joints: { waist_yaw: 0, waist_roll: 0,
    left_knee: 0.1, right_knee: 0.1, left_elbow: -0.5, right_elbow: -0.5 } },

  // ── 6-9s：原地转圈（双臂张开 + yaw 累加） ──
  { time: 6.5, joints: { waist_yaw: 1.0,
    left_shoulder_pitch: -1.2, left_shoulder_roll: 0.8, left_elbow: -1.0,
    right_shoulder_pitch: -1.2, right_shoulder_roll: -0.8, right_elbow: -1.0,
    left_knee: 0.2, right_knee: 0.2 } },
  { time: 7.0, joints: { waist_yaw: 2.0,
    left_shoulder_pitch: -1.0, left_shoulder_roll: 0.9,
    right_shoulder_pitch: -1.0, right_shoulder_roll: -0.9,
    left_knee: 0.25, right_knee: 0.25 } },
  { time: 7.5, joints: { waist_yaw: 3.0,
    left_shoulder_pitch: -1.3, left_shoulder_roll: 0.7,
    right_shoulder_pitch: -1.3, right_shoulder_roll: -0.7,
    left_knee: 0.2, right_knee: 0.2 } },
  { time: 8.0, joints: { waist_yaw: 4.0,
    left_shoulder_pitch: -1.1, left_shoulder_roll: 0.8,
    right_shoulder_pitch: -1.1, right_shoulder_roll: -0.8,
    left_knee: 0.22, right_knee: 0.22 } },
  { time: 8.5, joints: { waist_yaw: 5.0,
    left_shoulder_pitch: -1.2, left_elbow: -1.2,
    right_shoulder_pitch: -1.2, right_elbow: -1.2,
    left_knee: 0.15, right_knee: 0.15 } },
  { time: 9.0, joints: { waist_yaw: 6.28,
    left_shoulder_pitch: -0.5, left_shoulder_roll: 0.3, left_elbow: -0.5,
    right_shoulder_pitch: -0.5, right_shoulder_roll: -0.3, right_elbow: -0.5,
    left_knee: 0.1, right_knee: 0.1 } },

  // ── 9-12s：滑步侧移 ──
  { time: 9.5, joints: { waist_yaw: 6.28, waist_roll: 0.3,
    left_ankle_roll: 0.2, right_ankle_roll: -0.1,
    left_shoulder_roll: 0.4, right_shoulder_roll: -0.4,
    left_knee: 0.2, right_knee: 0.1 },
    root: { position: [-0.1, 0, 0] } },
  { time: 10.0, joints: { waist_yaw: 6.28, waist_roll: -0.3,
    left_ankle_roll: -0.1, right_ankle_roll: 0.2,
    left_shoulder_roll: -0.4, right_shoulder_roll: 0.4,
    left_knee: 0.1, right_knee: 0.2 },
    root: { position: [0.1, 0, 0] } },
  { time: 10.5, joints: { waist_roll: 0.25,
    left_ankle_roll: 0.15, right_ankle_roll: -0.05,
    left_knee: 0.18, right_knee: 0.12 },
    root: { position: [-0.05, 0, 0] } },
  { time: 11.0, joints: { waist_roll: -0.25,
    left_ankle_roll: -0.05, right_ankle_roll: 0.15,
    left_knee: 0.12, right_knee: 0.18 },
    root: { position: [0.05, 0, 0] } },
  { time: 11.5, joints: { waist_roll: 0.2, left_knee: 0.15, right_knee: 0.15 },
    root: { position: [0, 0, 0] } },
  { time: 12.0, joints: { waist_roll: 0, left_knee: 0.1, right_knee: 0.1 } },

  // ── 12-15s：结尾 pose（双手举起） ──
  { time: 12.5, joints: { left_shoulder_pitch: -2.5, left_shoulder_roll: 0.3, left_elbow: -0.2,
    right_shoulder_pitch: -2.5, right_shoulder_roll: -0.3, right_elbow: -0.2,
    waist_pitch: -0.15, left_knee: 0.15, right_knee: 0.15 } },
  { time: 13.0, joints: { left_shoulder_pitch: -2.8, left_elbow: 0,
    right_shoulder_pitch: -2.8, right_elbow: 0,
    waist_pitch: -0.2, left_knee: 0.2, right_knee: 0.2 } },
  { time: 14.0, joints: { left_shoulder_pitch: -2.6, left_elbow: -0.1,
    right_shoulder_pitch: -2.6, right_elbow: -0.1,
    waist_pitch: -0.18, left_knee: 0.18, right_knee: 0.18 } },
  { time: 15.0, joints: { left_shoulder_pitch: -2.5, left_elbow: -0.2,
    right_shoulder_pitch: -2.5, right_elbow: -0.2,
    waist_pitch: -0.15, left_knee: 0.15, right_knee: 0.15 } },
]

export const DANCE_DURATION = 15.0
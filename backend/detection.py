import base64
import math
import random
from typing import Optional

import cv2
import numpy as np

try:
    from ultralytics import YOLO
    _yolo_model = None

    def get_yolo():
        global _yolo_model
        if _yolo_model is None:
            _yolo_model = YOLO("yolov8n.pt")
        return _yolo_model
except ImportError:
    def get_yolo():
        return None

try:
    import mediapipe as mp
    _mp_pose = mp.solutions.pose
    _pose_detector = _mp_pose.Pose(static_image_mode=False, min_detection_confidence=0.5)
except ImportError:
    _mp_pose = None
    _pose_detector = None


def detect_frame(frame: np.ndarray):
    model = get_yolo()
    if model is None:
        person_count = random.randint(5, 40)
        h, w = frame.shape[:2]
        bboxes = []
        for _ in range(min(person_count, 10)):
            x1 = random.randint(0, w - 60)
            y1 = random.randint(0, h - 100)
            bboxes.append((x1, y1, x1 + 40, y1 + 80))
        confidences = [random.uniform(0.6, 0.95) for _ in bboxes]
        return person_count, bboxes, confidences

    results = model(frame, classes=[0], verbose=False)
    bboxes = []
    confidences = []
    for r in results:
        for box in r.boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
            conf = float(box.conf[0])
            bboxes.append((x1, y1, x2, y2))
            confidences.append(conf)
    return len(bboxes), bboxes, confidences


def estimate_pose_threat(frame: np.ndarray, bboxes: list) -> list[str]:
    behaviors = []
    if _pose_detector is None or len(bboxes) == 0:
        possible = ["normal", "normal", "normal", "running", "falling", "raised_hands", "erratic"]
        for _ in bboxes[:min(len(bboxes), 5)]:
            behaviors.append(random.choices(possible, weights=[50, 50, 50, 10, 5, 8, 5])[0])
        return list(set(behaviors))

    for bbox in bboxes[:5]:
        x1, y1, x2, y2 = bbox
        person_crop = frame[max(0, y1):y2, max(0, x1):x2]
        if person_crop.size == 0:
            behaviors.append("normal")
            continue
        rgb = cv2.cvtColor(person_crop, cv2.COLOR_BGR2RGB)
        results = _pose_detector.process(rgb)
        if results.pose_landmarks:
            landmarks = results.pose_landmarks.landmark
            left_wrist_y = landmarks[15].y
            left_shoulder_y = landmarks[11].y
            right_wrist_y = landmarks[16].y
            right_shoulder_y = landmarks[12].y
            if left_wrist_y < left_shoulder_y and right_wrist_y < right_shoulder_y:
                behaviors.append("raised_hands")
            else:
                behaviors.append("normal")
        else:
            behaviors.append("normal")

    return list(set(behaviors)) if behaviors else ["normal"]


def compute_density(person_count: int, zone_area_m2: float = 500.0) -> float:
    density_raw = person_count / zone_area_m2
    density_pct = min(100.0, density_raw * 2500)
    return round(density_pct, 2)


def classify_incident(density: float, threat_behaviors: list[str], motion_delta: float):
    critical_behaviors = {"falling", "raised_hands", "erratic"}
    has_critical = bool(critical_behaviors & set(threat_behaviors))
    has_running = "running" in threat_behaviors

    if has_critical or density > 85:
        severity = random.randint(85, 100)
        return "critical", severity
    elif density > 65 or has_running:
        severity = random.randint(60, 84)
        return "anomaly", severity
    elif density > 40:
        severity = random.randint(30, 59)
        return "crowding", severity
    else:
        severity = random.randint(0, 29)
        return "normal", severity


def blur_faces(frame: np.ndarray, bboxes: list) -> np.ndarray:
    result = frame.copy()
    for bbox in bboxes:
        x1, y1, x2, y2 = bbox
        face_h = max(1, (y2 - y1) // 3)
        fy1 = max(0, y1)
        fy2 = min(frame.shape[0], y1 + face_h)
        fx1 = max(0, x1)
        fx2 = min(frame.shape[1], x2)
        if fy2 > fy1 and fx2 > fx1:
            face_region = result[fy1:fy2, fx1:fx2]
            blurred = cv2.GaussianBlur(face_region, (51, 51), 0)
            result[fy1:fy2, fx1:fx2] = blurred
    return result


def generate_synthetic_frame(frame_id: int):
    person_count = int(20 + 15 * math.sin(frame_id / 30) + random.uniform(-3, 3))
    person_count = max(1, person_count)
    frame = np.zeros((480, 640, 3), dtype=np.uint8) + 40

    bboxes = []
    for i in range(min(person_count, 20)):
        x = random.randint(20, 580)
        y = random.randint(50, 400)
        w = random.randint(20, 40)
        h = random.randint(50, 90)
        color_intensity = random.randint(100, 220)
        color = (
            color_intensity,
            random.randint(80, 180),
            random.randint(60, 140),
        )
        cv2.rectangle(frame, (x, y), (x + w, y + h), color, -1)
        head_r = w // 2
        cv2.circle(frame, (x + w // 2, y - head_r), head_r, (200, 160, 120), -1)
        bboxes.append((x, y - head_r * 2, x + w, y + h))

    cv2.putText(
        frame,
        f"NETRA CAM | Zone Active | {person_count} detected",
        (10, 30),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.5,
        (0, 200, 120),
        1,
    )
    cv2.rectangle(frame, (0, 0), (639, 479), (0, 180, 100), 2)

    return frame, person_count, bboxes


def encode_frame_b64(frame: np.ndarray) -> str:
    _, buffer = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 70])
    return base64.b64encode(buffer.tobytes()).decode("utf-8")


def generate_heatmap_points(person_count: int, zone: str) -> list[dict]:
    zone_centers = {
        "zone_1": (17.3850, 78.4867),
        "zone_2": (17.3950, 78.4967),
        "zone_3": (17.3750, 78.4767),
    }
    center = zone_centers.get(zone, (17.3850, 78.4867))
    points = []
    for _ in range(min(person_count, 30)):
        lat = center[0] + random.gauss(0, 0.003)
        lng = center[1] + random.gauss(0, 0.003)
        intensity = random.uniform(0.3, 1.0)
        points.append({"lat": lat, "lng": lng, "intensity": intensity})
    return points

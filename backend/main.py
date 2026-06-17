import asyncio
import json
import os
import random
import math
from datetime import datetime
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from database import init_db, get_database
from models import Incident, ConsentRecord, SOSReport, EnvironmentLog
from detection import generate_synthetic_frame, detect_frame, estimate_pose_threat, compute_density, classify_incident, blur_faces, encode_frame_b64, generate_heatmap_points
from alert import evaluate_alert, dispatch_alert
from chat import chat_handler
from analytics import compute_forecast, compute_co2_saved, get_aqi, seed_environment_data


connected_feed_clients: list[WebSocket] = []
connected_alert_clients: list[WebSocket] = []
mobile_cam_active: bool = False
frame_counter = 0


async def synthetic_frame_loop():
    global frame_counter
    while True:
        try:
            frame, person_count, bboxes = generate_synthetic_frame(frame_counter)
            frame_counter += 1

            behaviors = estimate_pose_threat(frame, bboxes)
            density = compute_density(person_count)
            motion_delta = random.uniform(0.5, 3.0)
            incident_type, severity = classify_incident(density, behaviors, motion_delta)
            threat_score = min(100, severity + random.randint(-10, 10))

            blurred_frame = blur_faces(frame, bboxes)
            frame_b64 = encode_frame_b64(blurred_frame)

            zone = random.choice(["zone_1", "zone_2", "zone_3"])
            heatmap_points = generate_heatmap_points(person_count, zone)

            feed_data = {
                "frame_b64": frame_b64,
                "person_count": person_count,
                "density": round(density, 2),
                "incident_type": incident_type,
                "severity": severity,
                "threat_score": threat_score,
                "threat_behaviors": behaviors,
                "zone": zone,
                "heatmap_points": heatmap_points,
                "timestamp": datetime.utcnow().isoformat(),
            }

            dead_clients = []
            for ws in connected_feed_clients:
                try:
                    await ws.send_text(json.dumps(feed_data))
                except Exception:
                    dead_clients.append(ws)
            for ws in dead_clients:
                connected_feed_clients.remove(ws)

            if severity > 30 and frame_counter % 10 == 0:
                level = evaluate_alert(severity, threat_score)
                if level:
                    incident_obj = Incident(
                        zone=zone,
                        type=incident_type,
                        severity=severity,
                        threat_score=threat_score,
                        threat_behaviors=behaviors,
                        person_count=person_count,
                        density=density,
                        timestamp=datetime.utcnow(),
                    )
                    await dispatch_alert(incident_obj, level, connected_alert_clients)

        except Exception as e:
            print(f"Frame loop error: {e}")

        await asyncio.sleep(0.5)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await seed_environment_data()
    asyncio.create_task(synthetic_frame_loop())
    yield


app = FastAPI(title="NETRA Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    db = get_database()
    db_status = "connected"
    try:
        await db.command("ping")
    except Exception:
        db_status = "disconnected"

    ai_key = os.getenv("ANTHROPIC_API_KEY", "")
    ai_status = "configured" if ai_key and ai_key != "your_anthropic_key_here" else "not_configured"

    return {"status": "ok", "db": db_status, "ai": ai_status}


@app.websocket("/ws/feed")
async def ws_feed(websocket: WebSocket):
    await websocket.accept()
    connected_feed_clients.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        if websocket in connected_feed_clients:
            connected_feed_clients.remove(websocket)


@app.websocket("/ws/alerts")
async def ws_alerts(websocket: WebSocket):
    await websocket.accept()
    connected_alert_clients.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        if websocket in connected_alert_clients:
            connected_alert_clients.remove(websocket)


@app.websocket("/ws/mobile-cam")
async def ws_mobile_cam(websocket: WebSocket):
    """Receive JPEG frames from a mobile browser camera, process with YOLOv8,
    and broadcast the results to all connected desktop feed clients."""
    global mobile_cam_active
    await websocket.accept()
    mobile_cam_active = True
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                payload = json.loads(raw)
                b64 = payload.get("frame_b64", "")
                if not b64:
                    continue

                import base64
                import numpy as np
                import cv2

                frame_bytes = base64.b64decode(b64)
                nparr = np.frombuffer(frame_bytes, np.uint8)
                frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                if frame is None:
                    continue

                # Run detection on the real phone frame
                person_count, bboxes, _ = detect_frame(frame)
                behaviors = estimate_pose_threat(frame, bboxes)
                density = compute_density(person_count)
                motion_delta = random.uniform(0.5, 2.0)
                incident_type, severity = classify_incident(density, behaviors, motion_delta)
                threat_score = min(100, severity + random.randint(-8, 8))

                blurred = blur_faces(frame, bboxes)
                frame_b64_out = encode_frame_b64(blurred)

                zone = "mobile"
                heatmap_points = generate_heatmap_points(person_count, "zone_1")

                feed_data = {
                    "frame_b64": frame_b64_out,
                    "person_count": person_count,
                    "density": round(density, 2),
                    "incident_type": incident_type,
                    "severity": severity,
                    "threat_score": threat_score,
                    "threat_behaviors": behaviors,
                    "zone": zone,
                    "heatmap_points": heatmap_points,
                    "timestamp": datetime.utcnow().isoformat(),
                    "source": "mobile",
                }

                # Broadcast to all desktop feed viewers
                dead = []
                for ws in connected_feed_clients:
                    try:
                        await ws.send_text(json.dumps(feed_data))
                    except Exception:
                        dead.append(ws)
                for ws in dead:
                    connected_feed_clients.remove(ws)

                # Evaluate alert
                if severity > 50:
                    level = evaluate_alert(severity, threat_score)
                    if level:
                        incident_obj = type("Incident", (), {
                            "zone": zone, "type": incident_type, "severity": severity,
                            "threat_score": threat_score, "threat_behaviors": behaviors,
                            "person_count": person_count, "density": density,
                            "timestamp": datetime.utcnow(),
                        })()
                        await dispatch_alert(incident_obj, level, connected_alert_clients)

            except Exception as e:
                print(f"Mobile cam frame error: {e}")

    except WebSocketDisconnect:
        mobile_cam_active = False


class ConsentInput(BaseModel):
    citizen_name: str
    phone: str
    zone: str
    language: str


@app.post("/consent", status_code=201)
async def register_consent(data: ConsentInput):
    db = get_database()
    record = {
        "citizen_name": data.citizen_name,
        "phone": data.phone,
        "zone": data.zone,
        "language": data.language,
        "active": True,
        "created_at": datetime.utcnow().isoformat(),
    }
    result = await db.consent_records.insert_one(record)
    record["id"] = str(result.inserted_id)
    record.pop("_id", None)
    return record


@app.delete("/consent/{record_id}")
async def revoke_consent(record_id: str):
    from bson import ObjectId
    db = get_database()
    try:
        oid = ObjectId(record_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    doc = await db.consent_records.find_one_and_update(
        {"_id": oid},
        {"$set": {"active": False}},
        return_document=True,
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Record not found")
    doc["id"] = str(doc.pop("_id"))
    return doc


@app.get("/incidents")
async def list_incidents(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    zone: Optional[str] = None,
    type: Optional[str] = None,
    severity_min: Optional[int] = None,
    severity_max: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
):
    db = get_database()
    query: dict = {}
    if zone:
        query["zone"] = zone
    if type:
        query["type"] = type
    if severity_min is not None or severity_max is not None:
        query["severity"] = {}
        if severity_min is not None:
            query["severity"]["$gte"] = severity_min
        if severity_max is not None:
            query["severity"]["$lte"] = severity_max
    if date_from or date_to:
        query["timestamp"] = {}
        if date_from:
            query["timestamp"]["$gte"] = date_from
        if date_to:
            query["timestamp"]["$lte"] = date_to

    total = await db.incidents.count_documents(query)
    skip = (page - 1) * limit
    cursor = db.incidents.find(query).sort("timestamp", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)

    items = []
    for doc in docs:
        doc["id"] = str(doc.pop("_id"))
        doc.setdefault("assigned_to", None)
        doc.setdefault("sos_triggered", False)
        doc.setdefault("status", None)
        items.append(doc)

    return {
        "items": items,
        "total": total,
        "page": page,
        "pages": math.ceil(total / limit) if total else 1,
    }


@app.get("/incidents/stats")
async def get_incident_stats():
    db = get_database()
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0).isoformat()

    total_today = await db.incidents.count_documents({"timestamp": {"$gte": today_start}})
    active_alerts = await db.incidents.count_documents({"resolved": False, "severity": {"$gt": 50}})
    citizens_enrolled = await db.consent_records.count_documents({"active": True})

    by_type_pipeline = [
        {"$group": {"_id": "$type", "count": {"$sum": 1}}}
    ]
    by_type_result = await db.incidents.aggregate(by_type_pipeline).to_list(length=10)
    by_type = {r["_id"]: r["count"] for r in by_type_result}

    by_zone_pipeline = [
        {"$group": {"_id": "$zone", "count": {"$sum": 1}}}
    ]
    by_zone_result = await db.incidents.aggregate(by_zone_pipeline).to_list(length=10)
    by_zone = {r["_id"]: r["count"] for r in by_zone_result}

    return {
        "total_today": total_today,
        "active_alerts": active_alerts,
        "zones_monitored": 3,
        "citizens_enrolled": citizens_enrolled,
        "by_type": by_type,
        "by_zone": by_zone,
        "by_severity": {
            "normal": await db.incidents.count_documents({"severity": {"$lt": 30}}),
            "crowding": await db.incidents.count_documents({"severity": {"$gte": 30, "$lt": 60}}),
            "anomaly": await db.incidents.count_documents({"severity": {"$gte": 60, "$lt": 85}}),
            "critical": await db.incidents.count_documents({"severity": {"$gte": 85}}),
        },
    }


@app.patch("/incidents/{incident_id}")
async def update_incident(incident_id: str, data: dict):
    from bson import ObjectId
    db = get_database()
    try:
        oid = ObjectId(incident_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")
    update_fields = {}
    if "resolved" in data:
        update_fields["resolved"] = data["resolved"]
    if "assigned_to" in data:
        update_fields["assigned_to"] = data["assigned_to"]
    if "status" in data:
        update_fields["status"] = data["status"]
    doc = await db.incidents.find_one_and_update(
        {"_id": oid},
        {"$set": update_fields},
        return_document=True,
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Incident not found")
    doc["id"] = str(doc.pop("_id"))
    doc.setdefault("assigned_to", None)
    doc.setdefault("sos_triggered", False)
    doc.setdefault("status", None)
    return doc


class ChatRequest(BaseModel):
    message: str
    language: str = "en"
    history: list = []


@app.post("/chat")
async def chat(req: ChatRequest):
    return await chat_handler(req.message, req.language, req.history)


class SOSRequest(BaseModel):
    citizen_id: Optional[str] = None
    latitude: float
    longitude: float
    voice_note_b64: Optional[str] = None
    photo_b64: Optional[str] = None


@app.post("/sos", status_code=201)
async def submit_sos(req: SOSRequest):
    db = get_database()
    import secrets
    ref = "SOS-" + secrets.token_hex(4).upper()
    doc = {
        "citizen_id": req.citizen_id,
        "latitude": req.latitude,
        "longitude": req.longitude,
        "voice_note_b64": req.voice_note_b64,
        "photo_b64": req.photo_b64,
        "timestamp": datetime.utcnow().isoformat(),
        "resolved": False,
        "reference": ref,
    }
    result = await db.sos_reports.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@app.get("/analytics/forecast")
async def forecast(zone: str = Query("zone_1")):
    return await compute_forecast(zone)


@app.get("/environment/aqi")
async def environment_aqi():
    zones = ["zone_1", "zone_2", "zone_3"]
    zone_data = []
    for z in zones:
        data = await get_aqi(z)
        zone_data.append(data)
    co2_data = await compute_co2_saved()
    return {
        "zones": zone_data,
        "co2_kg": co2_data["co2_kg"],
        "events_count": co2_data["events_count"],
    }

import json
from datetime import datetime


def evaluate_alert(severity: int, threat_score: int) -> str | None:
    if threat_score > 80 or severity > 90:
        return "emergency"
    elif severity > 70:
        return "police"
    elif severity > 50:
        return "municipal"
    elif severity > 30:
        return "log"
    return None


def generate_voice_text(incident_type: str, zone: str, language: str) -> str:
    zone_display = zone.replace("_", " ").title()
    type_display = incident_type.capitalize()

    if language == "hi":
        return f"सचेत: {zone_display} में {type_display} पाया गया। अधिकारियों को सूचित किया गया।"
    elif language == "te":
        return f"హెచ్చరిక: {zone_display}లో {type_display} గుర్తించబడింది. అధికారులకు తెలియజేయబడింది."
    else:
        return f"Alert: {type_display} detected at {zone_display}. Authorities have been notified."


async def dispatch_alert(incident, level: str, connected_clients: list):
    from database import get_database
    db = get_database()

    doc = {
        "zone": incident.zone,
        "type": incident.type,
        "severity": incident.severity,
        "threat_score": incident.threat_score,
        "threat_behaviors": incident.threat_behaviors,
        "person_count": incident.person_count,
        "density": incident.density,
        "timestamp": incident.timestamp.isoformat() if hasattr(incident.timestamp, "isoformat") else str(incident.timestamp),
        "resolved": False,
        "assigned_to": None,
        "sos_triggered": False,
        "status": None,
    }
    result = await db.incidents.insert_one(doc.copy())
    doc["_id"] = str(result.inserted_id)

    alert_payload = {
        "zone": incident.zone,
        "type": incident.type,
        "severity": incident.severity,
        "threat_score": incident.threat_score,
        "level": level,
        "timestamp": doc["timestamp"],
        "voice_text_en": generate_voice_text(incident.type, incident.zone, "en"),
        "voice_text_hi": generate_voice_text(incident.type, incident.zone, "hi"),
        "voice_text_te": generate_voice_text(incident.type, incident.zone, "te"),
    }

    dead_clients = []
    for ws in connected_clients:
        try:
            await ws.send_text(json.dumps(alert_payload))
        except Exception:
            dead_clients.append(ws)
    for ws in dead_clients:
        connected_clients.remove(ws)

from datetime import datetime
from typing import Optional
from beanie import Document


class Incident(Document):
    zone: str
    type: str
    severity: int
    threat_score: int
    threat_behaviors: list[str]
    person_count: int
    density: float
    timestamp: datetime
    resolved: bool = False
    assigned_to: Optional[str] = None
    sos_triggered: bool = False
    status: Optional[str] = None

    class Settings:
        name = "incidents"


class ConsentRecord(Document):
    citizen_name: str
    phone: str
    zone: str
    language: str
    active: bool = True
    created_at: datetime

    class Settings:
        name = "consent_records"


class SOSReport(Document):
    citizen_id: Optional[str] = None
    latitude: float
    longitude: float
    voice_note_b64: Optional[str] = None
    photo_b64: Optional[str] = None
    timestamp: datetime
    resolved: bool = False
    reference: str = ""

    class Settings:
        name = "sos_reports"


class EnvironmentLog(Document):
    zone: str
    aqi: int
    co2_saved_g: float
    timestamp: datetime

    class Settings:
        name = "environment_logs"


class ChatLog(Document):
    message: str
    reply: str
    language: str
    timestamp: datetime

    class Settings:
        name = "chat_logs"

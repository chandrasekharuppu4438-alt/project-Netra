import random
from datetime import datetime, timedelta


async def compute_forecast(zone: str) -> list[dict]:
    from database import get_database
    db = get_database()

    now = datetime.utcnow()
    sixty_min_ago = (now - timedelta(minutes=60)).isoformat()

    cursor = db.incidents.find(
        {"zone": zone, "timestamp": {"$gte": sixty_min_ago}}
    ).sort("timestamp", 1)
    docs = await cursor.to_list(length=200)

    buckets: dict[int, list] = {}
    for doc in docs:
        ts_str = doc.get("timestamp", "")
        try:
            if isinstance(ts_str, str):
                ts = datetime.fromisoformat(ts_str)
            else:
                ts = ts_str
        except Exception:
            continue
        bucket_key = int((now - ts).total_seconds() // 300)
        buckets.setdefault(bucket_key, []).append(doc.get("density", 0))

    window_values = []
    for i in range(12, -1, -1):
        vals = buckets.get(i, [])
        if vals:
            window_values.append(sum(vals) / len(vals))
        else:
            base = 35 + 20 * abs(i - 6) / 6
            window_values.append(base + random.uniform(-5, 5))

    if len(window_values) < 3:
        base = 40.0
        window_values = [base + i * 2 + random.uniform(-3, 3) for i in range(13)]

    last_mean = sum(window_values[-3:]) / 3
    last_std = max(5, (max(window_values[-3:]) - min(window_values[-3:])) / 2)

    slope = (window_values[-1] - window_values[-4]) / 3 if len(window_values) >= 4 else 1.0

    forecast = []
    for i in range(1, 4):
        predicted = min(100, max(0, last_mean + slope * i + random.uniform(-2, 2)))
        spread = last_std * (1 + i * 0.2)
        label = (now + timedelta(minutes=5 * i)).strftime("%H:%M")
        forecast.append({
            "time_label": label,
            "predicted": round(predicted, 1),
            "upper": round(min(100, predicted + spread), 1),
            "lower": round(max(0, predicted - spread), 1),
        })

    return forecast


async def compute_co2_saved() -> dict:
    from database import get_database
    db = get_database()

    cursor = db.environment_logs.find({})
    docs = await cursor.to_list(length=1000)

    total_g = sum(doc.get("co2_saved_g", 0) for doc in docs)
    events_count = len(docs)

    if events_count == 0:
        total_g = random.uniform(150, 350) * 1000
        events_count = random.randint(50, 120)

    return {
        "co2_kg": round(total_g / 1000, 2),
        "events_count": events_count,
    }


async def get_aqi(zone: str) -> dict:
    from database import get_database
    db = get_database()

    doc = await db.environment_logs.find_one(
        {"zone": zone}, sort=[("timestamp", -1)]
    )

    if doc:
        aqi = doc.get("aqi", 75)
    else:
        hour = datetime.utcnow().hour
        base_aqis = {"zone_1": 55, "zone_2": 90, "zone_3": 45}
        base = base_aqis.get(zone, 70)
        time_factor = 20 * abs(math.sin(hour * 3.14 / 12))
        aqi = int(base + time_factor + random.uniform(-10, 10))
        aqi = max(10, min(200, aqi))

    if aqi <= 50:
        category = "Good"
    elif aqi <= 100:
        category = "Moderate"
    elif aqi <= 150:
        category = "Unhealthy"
    else:
        category = "Hazardous"

    return {"zone": zone, "aqi": aqi, "category": category}


async def seed_environment_data():
    from database import get_database
    db = get_database()

    count = await db.environment_logs.count_documents({})
    if count > 0:
        return

    now = datetime.utcnow()
    docs = []
    zones = ["zone_1", "zone_2", "zone_3"]
    for h in range(24):
        for zone in zones:
            hour_ts = now - timedelta(hours=24 - h)
            base_aqi = {"zone_1": 55, "zone_2": 90, "zone_3": 45}[zone]
            aqi = int(base_aqi + random.uniform(-15, 20))
            events = random.randint(3, 12)
            co2_saved_g = events * 30 * 0.21 * 10
            docs.append({
                "zone": zone,
                "aqi": max(10, min(200, aqi)),
                "co2_saved_g": round(co2_saved_g, 2),
                "timestamp": hour_ts.isoformat(),
            })

    if docs:
        await db.environment_logs.insert_many(docs)
        print(f"Seeded {len(docs)} environment log entries")


import math

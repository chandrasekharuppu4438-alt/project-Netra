import os
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

_client: AsyncIOMotorClient = None
_db: AsyncIOMotorDatabase = None


async def init_db():
    global _client, _db
    mongodb_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    database_name = os.getenv("DATABASE_NAME", "netra")
    _client = AsyncIOMotorClient(mongodb_uri)
    _db = _client[database_name]

    await _db.incidents.create_index([("timestamp", -1)])
    await _db.incidents.create_index([("zone", 1)])
    await _db.consent_records.create_index([("phone", 1)])

    print(f"Connected to MongoDB: {database_name}")


def get_database() -> AsyncIOMotorDatabase:
    if _db is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")
    return _db

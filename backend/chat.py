import os
from datetime import datetime

try:
    import anthropic
    _anthropic_client = None

    def get_anthropic():
        global _anthropic_client
        if _anthropic_client is None:
            _anthropic_client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))
        return _anthropic_client
except ImportError:
    def get_anthropic():
        return None


SYSTEM_PROMPT = """You are NETRA Assist, a calm multilingual public safety AI assistant.
Help citizens with: safety concerns, consent management, SOS feature,
emergency contacts, and how NETRA protects their privacy.
Always reply in the same language the user writes in.
Be brief, clear, and reassuring. Never cause panic.

Key facts about NETRA:
- NETRA is a citizen-consented public safety platform
- All faces are automatically blurred by AI for privacy
- Citizens can register or revoke consent at any time
- Data is retained for only 30 days
- SOS button connects to emergency services immediately
- Emergency contacts: Police 100, Ambulance 108, Fire 101, Women Helpline 1091"""


async def chat_handler(message: str, language: str, history: list) -> dict:
    client = get_anthropic()

    if client is None:
        fallback_responses = {
            "en": "I'm sorry, the AI assistant is currently unavailable. For emergencies, please call Police: 100, Ambulance: 108, Fire: 101.",
            "hi": "मुझे खेद है, AI सहायक अभी उपलब्ध नहीं है। आपात स्थिति के लिए: पुलिस: 100, एम्बुलेंस: 108, अग्निशमन: 101।",
            "te": "క్షమించండి, AI సహాయకుడు అందుబాటులో లేడు. అత్యవసర పరిస్థితుల్లో: పోలీస్: 100, అంబులెన్స్: 108, అగ్నిమాపక: 101.",
        }
        reply = fallback_responses.get(language, fallback_responses["en"])
        return {"reply": reply, "language_detected": language}

    messages = []
    for h in history:
        if isinstance(h, dict) and "role" in h and "content" in h:
            messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": message})

    try:
        response = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=512,
            system=SYSTEM_PROMPT,
            messages=messages,
        )
        reply = response.content[0].text

        from database import get_database
        db = get_database()
        await db.chat_logs.insert_one({
            "message": message,
            "reply": reply,
            "language": language,
            "timestamp": datetime.utcnow().isoformat(),
        })

        return {"reply": reply, "language_detected": language}

    except Exception as e:
        print(f"Chat error: {e}")
        return {
            "reply": "I'm having trouble connecting right now. Please try again shortly.",
            "language_detected": language,
        }

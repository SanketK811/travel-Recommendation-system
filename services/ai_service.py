import os

import httpx
import openai
from openai import OpenAI


class AIServiceError(Exception):
    """A user-facing error from AI configuration or generation."""


SYSTEM_INSTRUCTION = """You are Wanderwise, an expert AI Travel Planner and intelligent trip concierge.
Provide practical, personalized, and visually organized travel advice.
Always format your responses with rich Markdown: bold highlights, bullet points, emojis, and clear section dividers.
Never invent hotel availability, exact flight rates, or live train schedules. Clearly advise checking official sources."""

ITINERARY_INSTRUCTION = """Create a comprehensive, beautifully structured Travel Planner Dashboard itinerary:
1. **Transit & Route Overview**: If a Source and Destination are provided, state estimated distance and recommend the best transport options (Flight vs Train vs Road / Bus with travel duration).
2. **Day-by-Day Schedule**:
   - For each day use: '## Day [X]: [Theme / Area Name]'
   - Subsections:
     - '### 🌅 Morning (08:30 AM - 12:30 PM)': Key spots, estimated time, transport mode (Cab/Scooter/Walk)
     - '### ☀️ Afternoon (01:00 PM - 04:30 PM)': Attractions, famous local dishes to try, and recommended restaurant style
     - '### 🌙 Evening (05:00 PM - 08:30 PM)': Sunset viewpoints or cultural strolls
     - '### 🌃 Night (09:00 PM onwards)': Dinner spots, evening vibes, or nightlife
3. **🎒 Smart Packing Checklist**: 5-8 essential items tailored to the destination climate (beachwear, woolens, footwear, medicines)."""


def generate_response(user_message, history, preferences, itinerary=False):
    groq_api_key = os.getenv("GROQ_API_KEY", "").strip()
    openai_api_key = os.getenv("OPENAI_API_KEY", "").strip()

    if groq_api_key:
        api_key = groq_api_key
        base_url = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
        model = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
        provider_name = "Groq"
    elif openai_api_key:
        api_key = openai_api_key
        base_url = None
        model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        provider_name = "OpenAI"
    else:
        raise AIServiceError(
            "AI is not configured. Add GROQ_API_KEY to your .env file and restart the app."
        )

    messages = [{"role": "system", "content": SYSTEM_INSTRUCTION}]

    # When generating an itinerary, keep context clean to strictly stay under Groq 8000 TPM limit
    if not itinerary and history:
        for entry in history[-2:]:
            role = entry.get("role")
            if role in ("model", "assistant"):
                role = "assistant"
            text = entry.get("text", "")
            if role in ("user", "assistant") and isinstance(text, str) and text.strip():
                snippet = text[:250] + ("..." if len(text) > 250 else "")
                messages.append({"role": role, "content": snippet})

    context_parts = []
    days_count = (preferences or {}).get("days")
    if preferences:
        context_parts.append(f"Travel preferences: {preferences}")
    if itinerary:
        if days_count:
            day_requirement = (
                f"\n\n🚨 STRICT REQUIREMENT FOR TRIP DURATION ({days_count} DAYS):\n"
                f"You MUST generate a distinct section for EVERY SINGLE DAY from Day 1 up to Day {days_count} "
                f"('## Day 1: [Theme]', '## Day 2: [Theme]', through '## Day {days_count}: [Theme]').\n"
                f"- Do NOT stop or truncate before reaching Day {days_count}.\n"
                f"- Do NOT combine days (e.g. NEVER write 'Day 4-5' or 'Days 3 & 4').\n"
                f"- Keep descriptions for each time slot (Morning, Afternoon, Evening, Night) punchy and concise (1-2 sentences with spot names) "
                f"so that all {days_count} days are fully written out from start to finish."
            )
            context_parts.append(ITINERARY_INSTRUCTION + day_requirement)
        else:
            context_parts.append(ITINERARY_INSTRUCTION)
    prompt = "\n\n".join(context_parts + [user_message])
    messages.append({"role": "user", "content": prompt})

    # Dynamically allocate token budget so multi-day plans never get truncated
    if itinerary:
        calc_tokens = (int(days_count) if days_count else 3) * 450 + 600
        generation_tokens = min(3200, max(1800, calc_tokens))
    else:
        generation_tokens = 1500

    # Models supported on this Groq account
    models_to_try = [model]
    if provider_name == "Groq" and "openai/gpt-oss" in model:
        if model != "openai/gpt-oss-20b":
            models_to_try.append("openai/gpt-oss-20b")

    last_error = None
    for attempt_model in models_to_try:
        try:
            http_client = httpx.Client(timeout=35.0)
            kwargs = {"api_key": api_key, "http_client": http_client}
            if base_url:
                kwargs["base_url"] = base_url
            client = OpenAI(**kwargs)
            response = client.chat.completions.create(
                model=attempt_model,
                messages=messages,
                temperature=0.7,
                max_tokens=generation_tokens,
            )
            answer = response.choices[0].message.content
            if isinstance(answer, str) and answer.strip():
                return answer.strip()
        except openai.RateLimitError as error:
            last_error = error
            continue
        except openai.AuthenticationError as error:
            raise AIServiceError(
                f"{provider_name} rejected the API key. Check your API key in your .env file."
            ) from error
        except openai.NotFoundError as error:
            last_error = error
            continue
        except openai.APIConnectionError as error:
            raise AIServiceError(
                f"Could not connect to {provider_name} servers. Please check your internet connection."
            ) from error
        except openai.APIError as error:
            last_error = error
            if "too large" in str(error).lower() or "413" in str(error):
                continue
            raise AIServiceError(
                f"{provider_name} service error: {getattr(error, 'message', str(error))}"
            ) from error
        except Exception as error:
            last_error = error
            break

    if last_error:
        raise AIServiceError(f"AI generation failed: {str(last_error)}")

    raise AIServiceError(
        f"{provider_name} returned an empty response. Please try rephrasing your request."
    )

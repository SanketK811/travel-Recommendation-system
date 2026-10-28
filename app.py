import logging
import os
import secrets
import uuid

import httpx
from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request, session

from services.ai_service import AIServiceError, generate_response
from services.auth_service import (
    authenticate_user,
    get_user_by_id,
    init_db,
    register_user,
)
from services.firebase_service import (
    FirebaseServiceError,
    clear_conversations,
    get_conversation,
    get_conversation_messages,
    get_conversations,
    get_storage_mode,
    save_itinerary,
    save_turn,
)

load_dotenv()
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))


def create_app():
    app = Flask(__name__)
    app.config.update(
        SECRET_KEY=os.getenv("FLASK_SECRET_KEY") or secrets.token_hex(32),
        MAX_CONTENT_LENGTH=16 * 1024,
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=os.getenv("SESSION_COOKIE_SECURE", "false").lower()
        == "true",
    )
    if not os.getenv("FLASK_SECRET_KEY"):
        app.logger.warning(
            "FLASK_SECRET_KEY is not set; sessions will not persist across restarts."
        )

    # Initialize SQLite database for Authentication & User Profiles
    init_db()

    @app.get("/")
    def index():
        return render_template("index.html")

    # -------------------------------------------------------------------------
    # Authentication Endpoints
    # -------------------------------------------------------------------------
    @app.get("/api/auth/me")
    def auth_me():
        user_id = session.get("user_id")
        if user_id:
            user = get_user_by_id(user_id)
            if user:
                return jsonify(authenticated=True, user=user)
        return jsonify(authenticated=False, user=None)

    @app.post("/api/auth/register")
    def auth_register():
        data = request.get_json(silent=True) or {}
        name = data.get("name", "").strip()
        email = data.get("email", "").strip()
        password = data.get("password", "")

        user, error = register_user(name, email, password)
        if error:
            return jsonify(error=error), 400

        session["user_id"] = user["id"]
        session["user_name"] = user["name"]
        return jsonify(authenticated=True, user=user, message="Registration successful!")

    @app.post("/api/auth/login")
    def auth_login():
        data = request.get_json(silent=True) or {}
        email = data.get("email", "").strip()
        password = data.get("password", "")

        user, error = authenticate_user(email, password)
        if error:
            return jsonify(error=error), 401

        session["user_id"] = user["id"]
        session["user_name"] = user["name"]
        return jsonify(authenticated=True, user=user, message="Logged in successfully!")

    @app.post("/api/auth/logout")
    def auth_logout():
        session.pop("user_id", None)
        session.pop("user_name", None)
        return jsonify(authenticated=False, message="Logged out successfully.")

    # -------------------------------------------------------------------------
    # Status & System Endpoints
    # -------------------------------------------------------------------------
    @app.get("/api/status")
    def status():
        return jsonify(
            ai_configured=bool(os.getenv("GROQ_API_KEY", "").strip()),
            ai_provider="Groq",
            ai_model=os.getenv("GROQ_MODEL", "openai/gpt-oss-120b"),
            storage_mode=get_storage_mode(),
            database="MySQL",
        )

    @app.get("/api/weather")
    def weather():
        city = request.args.get("city", "").strip()
        if not city or len(city) > 100:
            return jsonify(error="Enter a city name of 1 to 100 characters."), 400

        api_key = os.getenv("OPENWEATHER_API_KEY", "").strip()
        if not api_key:
            return jsonify(error="Weather is not configured. Add OPENWEATHER_API_KEY to .env."), 503

        try:
            response = httpx.get(
                "https://api.openweathermap.org/data/2.5/weather",
                params={"q": city, "appid": api_key, "units": "metric"},
                timeout=8.0,
            )
            if response.status_code == 404:
                return jsonify(error=f"No weather data found for {city}."), 404
            if response.is_error:
                app.logger.warning(
                    "OpenWeatherMap request failed with status %s.",
                    response.status_code,
                )
                return jsonify(error="Weather provider request failed."), 502

            data = response.json()
            current = data.get("main", {})
            weather_info = (data.get("weather") or [{}])[0]
            wind = data.get("wind", {})
            return jsonify(
                city=data.get("name", city),
                temperature_c=round(current["temp"]),
                condition=weather_info.get("description", "Current conditions"),
                humidity=current.get("humidity"),
                wind_speed_kmh=round(wind.get("speed", 0) * 3.6),
            )
        except (httpx.HTTPError, ValueError, KeyError, TypeError, IndexError) as error:
            app.logger.warning(
                "Unable to retrieve weather for %s (%s).",
                city,
                type(error).__name__,
            )
            return jsonify(error="Unable to retrieve weather right now. Please try again."), 502

    @app.get("/api/history")
    def history():
        owner_id = _owner_id()
        conversation_id = request.args.get("conversation_id")
        try:
            if conversation_id:
                conversation = get_conversation(owner_id, conversation_id)
                if conversation is None:
                    return jsonify(error="Conversation not found."), 404
                messages = get_conversation_messages(conversation_id)
                return jsonify(conversation=conversation, messages=messages)
            return jsonify(conversations=get_conversations(owner_id))
        except FirebaseServiceError as error:
            return jsonify(error=str(error)), 503

    @app.post("/api/chat")
    def chat():
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify(error="Send a JSON object with a message."), 400

        message = data.get("message")
        if not isinstance(message, str) or not message.strip():
            return jsonify(error="Enter a message before sending."), 400
        message = message.strip()
        if len(message) > 4000:
            return jsonify(error="Messages must be 4,000 characters or fewer."), 400

        preferences, error = _validated_preferences(data.get("preferences", {}))
        if error:
            return jsonify(error=error), 400

        owner_id = _owner_id()
        conversation_id = data.get("conversation_id")
        if conversation_id is not None and not _valid_id(conversation_id):
            return jsonify(error="Invalid conversation ID."), 400
        if not conversation_id:
            conversation_id = str(uuid.uuid4())

        try:
            conversation = get_conversation(owner_id, conversation_id)
            if conversation is None and data.get("conversation_id"):
                return jsonify(error="Conversation not found."), 404
            messages = get_conversation_messages(conversation_id) if conversation else []
            answer = generate_response(message, messages, preferences)
            save_turn(owner_id, conversation_id, message, answer, preferences)
            return jsonify(
                conversation_id=conversation_id,
                reply=answer,
                conversations=get_conversations(owner_id),
            )
        except AIServiceError as error:
            return jsonify(error=str(error)), 503
        except FirebaseServiceError as error:
            return jsonify(error=str(error)), 503

    @app.post("/api/itinerary")
    def itinerary():
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify(error="Send a JSON object with a trip request."), 400
        trip_request = data.get("request")
        if not isinstance(trip_request, str) or not trip_request.strip():
            return jsonify(error="Describe the trip you want planned."), 400
        if len(trip_request.strip()) > 2000:
            return jsonify(error="Trip requests must be 2,000 characters or fewer."), 400

        preferences, error = _validated_preferences(data.get("preferences", {}))
        if error:
            return jsonify(error=error), 400

        owner_id = _owner_id()
        conversation_id = data.get("conversation_id")
        if conversation_id is not None and not _valid_id(conversation_id):
            return jsonify(error="Invalid conversation ID."), 400
        if not conversation_id:
            conversation_id = str(uuid.uuid4())

        try:
            conversation = get_conversation(owner_id, conversation_id)
            if conversation is None and data.get("conversation_id"):
                return jsonify(error="Conversation not found."), 404
            messages = get_conversation_messages(conversation_id) if conversation else []
            plan = generate_response(
                trip_request.strip(), messages, preferences, itinerary=True
            )
            itinerary_id = save_itinerary(
                owner_id, conversation_id, trip_request.strip(), plan, preferences
            )
            return jsonify(
                conversation_id=conversation_id,
                itinerary_id=itinerary_id,
                itinerary=plan,
            )
        except AIServiceError as error:
            return jsonify(error=str(error)), 503
        except FirebaseServiceError as error:
            return jsonify(error=str(error)), 503

    @app.post("/api/compare")
    def compare():
        data = request.get_json(silent=True) or {}
        city1 = data.get("city1", "Goa").strip()
        city2 = data.get("city2", "Manali").strip()
        budget = data.get("budget", "25000").strip()
        days = data.get("days", "4")

        prompt = (
            f"Compare two travel destinations for a {days}-day trip with an estimated budget of {budget}: "
            f"'{city1}' versus '{city2}'. Provide a clear side-by-side comparison with:\n"
            f"1. 💰 Budget & Cost Comparison (Stay, Food, Activities)\n"
            f"2. ☀️ Ideal Weather & Best Months to Visit\n"
            f"3. 🎯 Key Attractions & Experiences\n"
            f"4. 👥 Best For (Friends, Couples, Family, Solo)\n"
            f"5. 🏆 Verdict / Recommendation based on traveler preferences.\n"
            f"Format cleanly in Markdown with tables, bullet points, and emojis."
        )
        try:
            comparison = generate_response(prompt, [], {"destination": f"{city1} vs {city2}"})
            return jsonify(comparison=comparison, city1=city1, city2=city2)
        except AIServiceError as error:
            return jsonify(error=str(error)), 503

    @app.delete("/api/history")
    def delete_history():
        owner_id = _owner_id()
        conversation_id = request.args.get("conversation_id")
        if conversation_id and not _valid_id(conversation_id):
            return jsonify(error="Invalid conversation ID."), 400
        try:
            deleted = clear_conversations(owner_id, conversation_id)
            return jsonify(deleted=len(deleted))
        except FirebaseServiceError as error:
            return jsonify(error=str(error)), 503

    return app


def _owner_id():
    # If a user is logged in, use their permanent User ID
    if "user_id" in session:
        return session["user_id"]
    if "owner_id" not in session:
        session["owner_id"] = secrets.token_urlsafe(32)
    return session["owner_id"]


def _valid_id(value):
    return isinstance(value, str) and len(value) <= 64 and all(
        character.isalnum() or character in "-_" for character in value
    )


def _validated_preferences(value):
    if not isinstance(value, dict):
        return {}, "Preferences must be a JSON object."
    limits = {"source": 150, "destination": 150, "budget": 100, "interests": 500, "trip_type": 100}
    preferences = {}
    for key, limit in limits.items():
        item = value.get(key, "")
        if not isinstance(item, str):
            continue
        if len(item) > limit:
            return {}, f"The {key} preference must be {limit} characters or fewer."
        if item.strip():
            preferences[key] = item.strip()

    days = value.get("days")
    if days not in (None, ""):
        try:
            days = int(days)
        except (TypeError, ValueError):
            return {}, "Travel days must be a whole number from 1 to 30."
        if not 1 <= days <= 30:
            return {}, "Travel days must be a whole number from 1 to 30."
        preferences["days"] = days

    travelers = value.get("travelers")
    if travelers not in (None, ""):
        try:
            travelers = int(travelers)
            if 1 <= travelers <= 50:
                preferences["travelers"] = travelers
        except (TypeError, ValueError):
            preferences["travelers"] = 1
    return preferences, None


app = create_app()


if __name__ == "__main__":
    app.run(
        host=os.getenv("FLASK_HOST", "127.0.0.1"),
        port=int(os.getenv("FLASK_PORT", "5000")),
        debug=os.getenv("FLASK_DEBUG", "false").lower() == "true",
    )

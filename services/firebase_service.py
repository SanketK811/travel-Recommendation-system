"""
Wanderwise — Storage Service (MySQL)
=====================================
Replaces Firebase Firestore + in-memory fallback with MySQL.
All conversations, messages, and itineraries are now stored in MySQL.

The function signatures remain identical so app.py needs minimal changes.
"""

import json
import logging
import uuid
from datetime import datetime, timezone

from mysql.connector import Error as MySQLError

from services.db_service import get_connection

logger = logging.getLogger(__name__)


class FirebaseServiceError(Exception):
    """A user-facing error from storage operations."""


# ---------------------------------------------------------------------------
# Compatibility Helpers (keep app.py imports working)
# ---------------------------------------------------------------------------

def is_firebase_configured():
    """Always True since we're using MySQL now."""
    return True


def get_storage_mode():
    """Returns storage backend identifier."""
    return "mysql"


def get_firestore_client():
    """Not used anymore — returns None for compatibility."""
    return None


# ---------------------------------------------------------------------------
# Conversations
# ---------------------------------------------------------------------------

def get_conversation(owner_id, conversation_id):
    """Fetch a single conversation by owner_id and conversation_id."""
    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT id, owner_id, title, preferences, created_at, updated_at "
            "FROM conversations WHERE id = %s AND owner_id = %s",
            (conversation_id, owner_id),
        )
        row = cursor.fetchone()
        cursor.close()
        if not row:
            return None
        return _serialize_conversation(row)
    except MySQLError as e:
        raise FirebaseServiceError(f"Database error loading conversation: {e}") from e
    finally:
        conn.close()


def get_conversations(owner_id):
    """Fetch all conversations for a given owner, sorted by most recent."""
    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT id, owner_id, title, preferences, created_at, updated_at "
            "FROM conversations WHERE owner_id = %s ORDER BY updated_at DESC LIMIT 30",
            (owner_id,),
        )
        rows = cursor.fetchall()
        cursor.close()
        return [_serialize_conversation(row) for row in rows]
    except MySQLError as e:
        raise FirebaseServiceError(f"Database error loading history: {e}") from e
    finally:
        conn.close()


def get_conversation_messages(conversation_id):
    """Fetch all messages for a conversation, ordered chronologically."""
    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT role, text, created_at FROM messages "
            "WHERE conversation_id = %s ORDER BY created_at ASC LIMIT 100",
            (conversation_id,),
        )
        rows = cursor.fetchall()
        cursor.close()
        return [
            {
                "role": row["role"] if row["role"] != "model" else "assistant",
                "text": row["text"],
                "created_at": _iso(row["created_at"]),
            }
            for row in rows
        ]
    except MySQLError as e:
        raise FirebaseServiceError(f"Database error loading messages: {e}") from e
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Save Chat Turn
# ---------------------------------------------------------------------------

def save_turn(owner_id, conversation_id, user_text, assistant_text, preferences):
    """Save a user ↔ AI chat turn. Creates conversation if it doesn't exist."""
    now = datetime.now(timezone.utc)
    prefs_json = json.dumps(preferences) if preferences else "{}"

    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)

        # Check if conversation exists
        cursor.execute("SELECT id, title FROM conversations WHERE id = %s", (conversation_id,))
        existing = cursor.fetchone()

        if existing:
            # Update existing conversation
            cursor.execute(
                "UPDATE conversations SET updated_at = %s, preferences = %s WHERE id = %s",
                (now, prefs_json, conversation_id),
            )
        else:
            # Create new conversation
            title = user_text.strip().replace("\n", " ")[:72] or "Travel chat"
            cursor.execute(
                "INSERT INTO conversations (id, owner_id, title, preferences, created_at, updated_at) "
                "VALUES (%s, %s, %s, %s, %s, %s)",
                (conversation_id, owner_id, title, prefs_json, now, now),
            )

        # Insert user message
        cursor.execute(
            "INSERT INTO messages (conversation_id, role, text, created_at) VALUES (%s, %s, %s, %s)",
            (conversation_id, "user", user_text, now),
        )

        # Insert assistant message
        cursor.execute(
            "INSERT INTO messages (conversation_id, role, text, created_at) VALUES (%s, %s, %s, %s)",
            (conversation_id, "assistant", assistant_text, datetime.now(timezone.utc)),
        )

        conn.commit()
        cursor.close()
    except MySQLError as e:
        raise FirebaseServiceError(f"Database error saving chat: {e}") from e
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Save Itinerary
# ---------------------------------------------------------------------------

def save_itinerary(owner_id, conversation_id, request_text, plan, preferences):
    """Save a generated travel itinerary. Creates conversation if needed."""
    now = datetime.now(timezone.utc)
    prefs_json = json.dumps(preferences) if preferences else "{}"
    itinerary_id = str(uuid.uuid4())

    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)

        # Check if conversation exists
        cursor.execute("SELECT id FROM conversations WHERE id = %s", (conversation_id,))
        existing = cursor.fetchone()

        if existing:
            cursor.execute(
                "UPDATE conversations SET updated_at = %s, preferences = %s WHERE id = %s",
                (now, prefs_json, conversation_id),
            )
        else:
            title = request_text.replace("\n", " ")[:72] or "Trip Itinerary"
            cursor.execute(
                "INSERT INTO conversations (id, owner_id, title, preferences, created_at, updated_at) "
                "VALUES (%s, %s, %s, %s, %s, %s)",
                (conversation_id, owner_id, title, prefs_json, now, now),
            )

        # Save itinerary
        cursor.execute(
            "INSERT INTO itineraries (id, conversation_id, request_text, plan, preferences, created_at) "
            "VALUES (%s, %s, %s, %s, %s, %s)",
            (itinerary_id, conversation_id, request_text, plan, prefs_json, now),
        )

        # Save messages
        cursor.execute(
            "INSERT INTO messages (conversation_id, role, text, created_at) VALUES (%s, %s, %s, %s)",
            (conversation_id, "user", request_text, now),
        )
        cursor.execute(
            "INSERT INTO messages (conversation_id, role, text, created_at) VALUES (%s, %s, %s, %s)",
            (conversation_id, "assistant", plan, datetime.now(timezone.utc)),
        )

        conn.commit()
        cursor.close()
        return itinerary_id
    except MySQLError as e:
        raise FirebaseServiceError(f"Database error saving itinerary: {e}") from e
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Delete Conversations
# ---------------------------------------------------------------------------

def clear_conversations(owner_id, conversation_id=None):
    """Delete conversations (and cascading messages/itineraries) for a user."""
    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)

        if conversation_id:
            # Delete specific conversation
            cursor.execute(
                "SELECT id FROM conversations WHERE id = %s AND owner_id = %s",
                (conversation_id, owner_id),
            )
            row = cursor.fetchone()
            if not row:
                cursor.close()
                return []
            # CASCADE will delete messages and itineraries automatically
            cursor.execute("DELETE FROM conversations WHERE id = %s", (conversation_id,))
            conn.commit()
            cursor.close()
            return [conversation_id]
        else:
            # Delete all conversations for this owner
            cursor.execute(
                "SELECT id FROM conversations WHERE owner_id = %s", (owner_id,)
            )
            rows = cursor.fetchall()
            deleted_ids = [r["id"] for r in rows]
            if deleted_ids:
                cursor.execute(
                    "DELETE FROM conversations WHERE owner_id = %s", (owner_id,)
                )
                conn.commit()
            cursor.close()
            return deleted_ids
    except MySQLError as e:
        raise FirebaseServiceError(f"Database error deleting history: {e}") from e
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _serialize_conversation(row):
    """Convert a MySQL row dict to the standard conversation format."""
    prefs = row.get("preferences", "{}")
    if isinstance(prefs, str):
        try:
            prefs = json.loads(prefs)
        except (json.JSONDecodeError, TypeError):
            prefs = {}
    return {
        "id": row["id"],
        "title": row.get("title", "Travel chat"),
        "updated_at": _iso(row.get("updated_at")),
        "preferences": prefs,
    }


def _iso(value):
    """Convert datetime to ISO format string."""
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return None

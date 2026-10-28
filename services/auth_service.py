"""
Wanderwise — Authentication Service (MySQL)
============================================
User registration, login, and profile lookup using MySQL database.
"""

import uuid

from mysql.connector import Error as MySQLError
from werkzeug.security import check_password_hash, generate_password_hash

from services.db_service import get_connection, init_mysql


def init_db():
    """Initialize MySQL database and create all required tables."""
    init_mysql()


def get_db():
    """Get a MySQL database connection."""
    return get_connection()


def register_user(name, email, password):
    """Register a new user. Returns (user_dict, None) on success or (None, error_message) on failure."""
    email = email.strip().lower()
    name = name.strip()
    if not name or not email or not password:
        return None, "Name, email, and password are all required."
    if "@" not in email or "." not in email:
        return None, "Please enter a valid email address."
    if len(password) < 6:
        return None, "Password must be at least 6 characters long."

    conn = get_db()
    try:
        cursor = conn.cursor()
        user_id = str(uuid.uuid4())
        pwd_hash = generate_password_hash(password)
        cursor.execute(
            "INSERT INTO users (id, name, email, password_hash) VALUES (%s, %s, %s, %s)",
            (user_id, name, email, pwd_hash),
        )
        conn.commit()
        cursor.close()
        return {"id": user_id, "name": name, "email": email}, None
    except MySQLError as e:
        if e.errno == 1062:  # Duplicate entry (unique constraint)
            return None, "An account with this email already exists."
        return None, f"Database error: {e}"
    finally:
        conn.close()


def authenticate_user(email, password):
    """Authenticate a user by email and password. Returns (user_dict, None) on success."""
    email = email.strip().lower()
    if not email or not password:
        return None, "Enter both email and password."

    conn = get_db()
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT id, name, email, password_hash FROM users WHERE email = %s",
            (email,),
        )
        row = cursor.fetchone()
        cursor.close()
        if not row:
            return None, "Invalid email or password."
        if not check_password_hash(row["password_hash"], password):
            return None, "Invalid email or password."
        return {"id": row["id"], "name": row["name"], "email": row["email"]}, None
    except MySQLError as e:
        return None, f"Database error: {e}"
    finally:
        conn.close()


def get_user_by_id(user_id):
    """Look up a user by their unique ID."""
    if not user_id:
        return None
    conn = get_db()
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, name, email FROM users WHERE id = %s", (user_id,))
        row = cursor.fetchone()
        cursor.close()
        if row:
            return {"id": row["id"], "name": row["name"], "email": row["email"]}
        return None
    except MySQLError:
        return None
    finally:
        conn.close()

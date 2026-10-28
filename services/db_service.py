"""
Wanderwise — MySQL Database Service
=====================================
Centralized MySQL connection and table management.
Handles: Users, Conversations, Messages, Itineraries — all in one MySQL DB.

Requirements:
  pip install mysql-connector-python
  MySQL Server running (via XAMPP / MySQL Workbench / standalone)

.env config:
  MYSQL_HOST=localhost
  MYSQL_PORT=3306
  MYSQL_USER=root
  MYSQL_PASSWORD=
  MYSQL_DATABASE=wanderwise
"""

import logging
import os

import mysql.connector
from mysql.connector import Error as MySQLError

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Connection Pool
# ---------------------------------------------------------------------------
_pool = None


def _get_db_config():
    """Read MySQL credentials from environment variables."""
    return {
        "host": os.getenv("MYSQL_HOST", "localhost"),
        "port": int(os.getenv("MYSQL_PORT", "3306")),
        "user": os.getenv("MYSQL_USER", "root"),
        "password": os.getenv("MYSQL_PASSWORD", ""),
        "database": os.getenv("MYSQL_DATABASE", "wanderwise"),
        "charset": "utf8mb4",
        "collation": "utf8mb4_general_ci",
        "autocommit": True,
    }


def get_connection():
    """Return a fresh MySQL connection (auto-reconnect safe)."""
    global _pool
    config = _get_db_config()
    try:
        if _pool is None:
            _pool = mysql.connector.pooling.MySQLConnectionPool(
                pool_name="wanderwise_pool",
                pool_size=5,
                pool_reset_session=True,
                **config,
            )
        conn = _pool.get_connection()
        return conn
    except MySQLError:
        # Fallback: direct connection if pooling fails
        return mysql.connector.connect(**config)


# ---------------------------------------------------------------------------
# Schema Initialization (auto-creates DB + all tables on app start)
# ---------------------------------------------------------------------------

_CREATE_DATABASE_SQL = "CREATE DATABASE IF NOT EXISTS `{db}` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci"

_CREATE_TABLES_SQL = [
    # 1. Users table (login / register)
    """
    CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
    """,

    # 2. Conversations table (trip sessions)
    """
    CREATE TABLE IF NOT EXISTS conversations (
        id VARCHAR(36) PRIMARY KEY,
        owner_id VARCHAR(64) NOT NULL,
        title VARCHAR(200) DEFAULT 'Travel chat',
        preferences JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_owner (owner_id),
        INDEX idx_updated (updated_at)
    ) ENGINE=InnoDB
    """,

    # 3. Messages table (user ↔ AI chat turns)
    """
    CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        conversation_id VARCHAR(36) NOT NULL,
        role ENUM('user', 'assistant', 'model') NOT NULL DEFAULT 'user',
        text LONGTEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_conv (conversation_id),
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
    """,

    # 4. Itineraries table (generated travel plans)
    """
    CREATE TABLE IF NOT EXISTS itineraries (
        id VARCHAR(36) PRIMARY KEY,
        conversation_id VARCHAR(36) NOT NULL,
        request_text TEXT,
        plan LONGTEXT,
        preferences JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_conv_itin (conversation_id),
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
    """,
]


def init_mysql():
    """
    Initialize the MySQL database and create all required tables.
    Called once on application startup.
    """
    config = _get_db_config()
    db_name = config.pop("database")

    try:
        # Step 1: Connect without specifying a database to create it
        setup_conn = mysql.connector.connect(**{k: v for k, v in config.items() if k not in ("charset", "collation", "autocommit")},
                                              charset="utf8mb4", autocommit=True)
        cursor = setup_conn.cursor()
        cursor.execute(_CREATE_DATABASE_SQL.format(db=db_name))
        cursor.close()
        setup_conn.close()

        # Step 2: Connect to the actual database and create tables
        config["database"] = db_name
        conn = mysql.connector.connect(**config)
        cursor = conn.cursor()
        for ddl in _CREATE_TABLES_SQL:
            cursor.execute(ddl)
        conn.commit()
        cursor.close()
        conn.close()

        logger.info("✅ MySQL database '%s' initialized successfully with all tables.", db_name)
    except MySQLError as e:
        logger.error("❌ MySQL initialization failed: %s", e)
        raise RuntimeError(
            f"MySQL connection failed. Check that MySQL is running and credentials in .env are correct.\n"
            f"Error: {e}"
        ) from e


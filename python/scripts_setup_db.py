#!/usr/bin/env python
"""Create the database schema. Usage: python scripts_setup_db.py"""
from backend.app.models.db import init_db
from backend.app.utils.logging import setup_logging

if __name__ == "__main__":
    setup_logging("INFO")
    print("Schema created." if init_db() else "DATABASE_URL not set - nothing to do.")

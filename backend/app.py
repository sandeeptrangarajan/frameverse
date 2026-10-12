
import json
import os
import re
import secrets
import sqlite3
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, request, session, send_from_directory
from werkzeug.security import check_password_hash

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

FRONTEND_DIST = BASE_DIR.parent / "frontend" / "dist"
app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("FRAMEVERSE_SECRET_KEY", "")
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = os.environ.get("FRAMEVERSE_COOKIE_SECURE", "false").lower() == "true"

default_db_dir = Path("/tmp") if os.environ.get("VERCEL") else BASE_DIR
DB_PATH = Path(os.environ.get("FRAMEVERSE_DATABASE_PATH", str(default_db_dir / "frameverse.db")))
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

YEAR_TABLES = {
    "first_year": "first_year_registrations",
    "second_year": "second_year_registrations",
    "third_year": "third_year_registrations",
    "fourth_year": "fourth_year_registrations",
}


def connect_db():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_db():
    with connect_db() as db:
        for table in YEAR_TABLES.values():
            db.execute(f"""
                CREATE TABLE IF NOT EXISTS {table} (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    registration_id TEXT UNIQUE NOT NULL,
                    team_lead_name TEXT NOT NULL,
                    team_members TEXT NOT NULL,
                    mobile TEXT NOT NULL,
                    laptop_availability TEXT NOT NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            """)


# Ensure tables exist when Gunicorn imports the app in production.
initialize_db()


@app.get("/api/health")
def health():
    try:
        initialize_db()
        return jsonify(status="ok", database="connected")
    except sqlite3.Error:
        app.logger.exception("Database check failed")
        return jsonify(message="Database error"), 500


@app.post("/api/admin/login")
def admin_login():
    data = request.get_json(silent=True) or {}
    username = os.environ.get("FRAMEVERSE_ADMIN_USER", "")
    password_hash = os.environ.get("FRAMEVERSE_ADMIN_PASSWORD_HASH", "")
    secret_key = app.config.get("SECRET_KEY", "")

    if not secret_key or not username or not password_hash:
        app.logger.error(
            "Admin config missing: secret=%s username=%s hash=%s",
            bool(secret_key),
            bool(username),
            bool(password_hash),
        )
        return jsonify(message="Admin login is not configured."), 503

    password = data.get("password")
    if (
        data.get("username") != username
        or not isinstance(password, str)
        or not check_password_hash(password_hash, password)
    ):
        return jsonify(message="Invalid username or password."), 401

    session.clear()
    session["is_admin"] = True
    return jsonify(message="Login successful.")


@app.get("/api/admin/session")
def admin_session():
    return jsonify(authenticated=session.get("is_admin") is True)


@app.post("/api/admin/logout")
def admin_logout():
    session.clear()
    return jsonify(message="Logged out.")


@app.get("/api/admin/registrations")
def admin_registrations():
    if session.get("is_admin") is not True:
        return jsonify(message="Admin login required."), 401

    try:
        with connect_db() as db:
            registrations = {}
            for year, table in YEAR_TABLES.items():
                rows = db.execute(
                    f"""SELECT registration_id, team_lead_name,
                    team_members, mobile, laptop_availability, created_at
                    FROM {table} ORDER BY id DESC"""
                ).fetchall()
                registrations[year] = [dict(row) for row in rows]

        return jsonify(registrations=registrations)
    except sqlite3.Error:
        app.logger.exception("Could not load registrations")
        return jsonify(message="Could not load registrations."), 500


@app.route("/api/admin/registrations/<registration_id>", methods=["DELETE"])
def admin_delete_registration_by_id(registration_id):
    if session.get("is_admin") is not True:
        return jsonify(message="Admin login required."), 401

    academic_year = request.args.get("academic_year")
    deleted = False

    try:
        with connect_db() as db:
            if academic_year and academic_year in YEAR_TABLES:
                table = YEAR_TABLES[academic_year]
                cur = db.execute(
                    f"DELETE FROM {table} WHERE registration_id = ?",
                    (registration_id,),
                )
                if cur.rowcount > 0:
                    deleted = True
            else:
                for table in YEAR_TABLES.values():
                    cur = db.execute(
                        f"DELETE FROM {table} WHERE registration_id = ?",
                        (registration_id,),
                    )
                    if cur.rowcount > 0:
                        deleted = True
                        break

        if deleted:
            return jsonify(success=True, message=f"Registration {registration_id} deleted successfully.")
        return jsonify(success=False, message="Registration not found."), 404
    except sqlite3.Error:
        app.logger.exception("Could not delete registration")
        return jsonify(message="Database error deleting registration."), 500


@app.post("/api/admin/registrations/delete")
def admin_delete_registration_post():
    if session.get("is_admin") is not True:
        return jsonify(message="Admin login required."), 401

    data = request.get_json(silent=True) or {}
    registration_id = data.get("registration_id")
    academic_year = data.get("academic_year")

    if not registration_id:
        return jsonify(message="Registration ID is required."), 400

    deleted = False
    try:
        with connect_db() as db:
            if academic_year and academic_year in YEAR_TABLES:
                table = YEAR_TABLES[academic_year]
                cur = db.execute(
                    f"DELETE FROM {table} WHERE registration_id = ?",
                    (registration_id,),
                )
                if cur.rowcount > 0:
                    deleted = True
            else:
                for table in YEAR_TABLES.values():
                    cur = db.execute(
                        f"DELETE FROM {table} WHERE registration_id = ?",
                        (registration_id,),
                    )
                    if cur.rowcount > 0:
                        deleted = True
                        break

        if deleted:
            return jsonify(success=True, message=f"Registration {registration_id} deleted successfully.")
        return jsonify(success=False, message="Registration not found."), 404
    except sqlite3.Error:
        app.logger.exception("Could not delete registration")
        return jsonify(message="Database error deleting registration."), 500


@app.post("/api/admin/registrations/clear")
def admin_clear_registrations():
    if session.get("is_admin") is not True:
        return jsonify(message="Admin login required."), 401

    data = request.get_json(silent=True) or {}
    academic_year = data.get("academic_year", "all")

    try:
        with connect_db() as db:
            if academic_year in YEAR_TABLES:
                table = YEAR_TABLES[academic_year]
                db.execute(f"DELETE FROM {table}")
            elif academic_year == "all":
                for table in YEAR_TABLES.values():
                    db.execute(f"DELETE FROM {table}")
            else:
                return jsonify(message="Invalid academic year."), 400

        return jsonify(success=True, message="Registrations cleared successfully.")
    except sqlite3.Error:
        app.logger.exception("Could not clear registrations")
        return jsonify(message="Database error clearing registrations."), 500


@app.post("/api/registrations")
def register():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify(message="Invalid registration data."), 400

    year = data.get("academic_year")
    if year not in YEAR_TABLES:
        return jsonify(message="Choose a valid academic year."), 422

    lead = data.get("teamLeadName")
    mobile = data.get("teamLeadMobile")
    laptop = data.get("laptopAvailability")
    members = data.get("teamMembers")

    if not isinstance(lead, str) or not lead.strip():
        return jsonify(message="Team lead name is required."), 422

    if not isinstance(mobile, str):
        return jsonify(message="Enter a valid mobile number."), 422

    digits = re.sub(r"\D", "", mobile)
    if not 7 <= len(digits) <= 15 or len(set(digits)) == 1:
        return jsonify(message="Enter a valid mobile number."), 422

    if laptop not in ("Yes", "No"):
        return jsonify(message="Select laptop availability."), 422

    if not isinstance(members, list) or len(members) > 3:
        return jsonify(message="Enter two or three team members."), 422

    clean_members = []

    for index, member in enumerate(members, start=1):
        if not isinstance(member, dict):
            return jsonify(message="Invalid member details."), 422

        name = member.get("name", "")
        reg = member.get("registerNumber", "")
        section = member.get("section", "")

        if not all(isinstance(value, str) for value in (name, reg, section)):
            return jsonify(message="Invalid member details."), 422

        name, reg, section = name.strip(), reg.strip(), section.strip()

        if index == 3 and not (name or reg or section):
            continue

        if not name or not reg or not section:
            return jsonify(
                message=f"Complete all fields for Team Member {index}."
            ), 422

        if not re.fullmatch(r"\d+", reg):
            return jsonify(
                message="Register number must contain digits only."
            ), 422

        clean_members.append({
            "name": name,
            "registerNumber": reg,
            "section": section,
        })

    names = [member["name"].casefold() for member in clean_members]

    if len(clean_members) < 2 or len(names) != len(set(names)):
        return jsonify(
            message="Enter at least two members with unique names."
        ), 422

    if lead.strip().casefold() not in names:
        return jsonify(
            message="The team lead must be one of the listed members."
        ), 422

    try:
        with connect_db() as db:
            table = YEAR_TABLES[year]
            cursor = db.execute(
                f"""INSERT INTO {table}
                (registration_id, team_lead_name, team_members,
                 mobile, laptop_availability)
                VALUES (?, ?, ?, ?, ?)""",
                (
                    "TEMP-" + secrets.token_hex(16),
                    lead.strip(),
                    json.dumps(clean_members),
                    mobile.strip(),
                    laptop,
                ),
            )

            row_id = cursor.lastrowid
            registration_id = f"FV{row_id}"

            db.execute(
                f"UPDATE {table} SET registration_id = ? WHERE id = ?",
                (registration_id, row_id),
            )

        return jsonify(
            saved=True,
            registrationId=registration_id,
            academic_year=year,
        ), 201

    except sqlite3.Error:
        app.logger.exception("Registration save failed")
        return jsonify(
            saved=False,
            message="Could not save registration. Please try again."
        ), 500


if not os.environ.get("VERCEL"):
    @app.get("/")
    def frontend_index():
        if not (FRONTEND_DIST / "index.html").is_file():
            return jsonify(message="Frontend build not found. Run npm run build in the frontend folder."), 503
        return send_from_directory(FRONTEND_DIST, "index.html")

    @app.get("/<path:asset_path>")
    def frontend_assets(asset_path):
        requested = FRONTEND_DIST / asset_path
        if requested.is_file():
            return send_from_directory(FRONTEND_DIST, asset_path)
        if (FRONTEND_DIST / "index.html").is_file():
            return send_from_directory(FRONTEND_DIST, "index.html")
        return jsonify(message="Frontend build not found."), 404


if __name__ == "__main__":
    initialize_db()
    app.run(host="127.0.0.1", port=5000, debug=False)

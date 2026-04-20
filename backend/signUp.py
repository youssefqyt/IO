from flask import request, jsonify
from werkzeug.security import generate_password_hash
from datetime import datetime, timezone
import re

def serach(Collection, email):
    if Collection.find_one({"email": email}):
        return True
    return False
def validate(name, email, password):
    errors = {}

    if not name:
        errors["fullName"] = "Full name is required"
    elif len(name.strip().split()) < 2:
        errors["fullName"] = "Name must include first and last name"

    if not email:
        errors["email"] = "Email is required"
    else:
        email_regex = r'^[\w\.-]+@[\w\.-]+\.\w+$'
        if not re.match(email_regex, email):
            errors["email"] = "Invalid email format"

    if not password:
        errors["password"] = "Password is required"
    elif len(password) < 8:
        errors["password"] = "Password must be at least 8 characters"

    return errors
def register_user(db):
    data = request.get_json()
    role = data.get('role')
    name = data.get('fullName')
    email = (data.get('email') or '').strip().lower()
    password = data.get('password')

    errors = validate(name, email, password)

    if role not in ["freelancer", "client"]:
        errors["role"] = "Invalid role selected"

    email_exists = serach(db["Freelancer"], email) or serach(db["Client"], email)
    if email and email_exists:
        errors["email"] = "User already exists"

    email_exists_in_admin = serach(db["AdminCompte"], email)
    if email and email_exists_in_admin:
        errors["email"] = "User already exists"

    if errors:
        return jsonify({"errors": errors}), 400

    hashed_password = generate_password_hash(password)
    now = datetime.now(timezone.utc)

    admin_request = {
        "username": name,
        "email": email,
        "password": hashed_password,
        "role": role,
        "createdAt": now,
        "status": "pending"
    }

    result = db["AdminCompte"].insert_one(admin_request)

    return jsonify({
        "message": "Signup request submitted. Pending admin approval.",
        "requestId": str(result.inserted_id),
        "user": {
            "fullName": name,
            "email": email,
            "role": role
        }
    }), 201

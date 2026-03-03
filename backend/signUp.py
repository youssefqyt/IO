from flask import request, jsonify
from werkzeug.security import generate_password_hash
import re

def serach(Collection, email):
    if Collection.find_one({"email": email}):
        return True
    return False
def validate(name, email, password):
    errors = {}

    # Full Name
    if not name:
        errors["fullName"] = "Full name is required"
    elif len(name.strip().split()) < 2:
        errors["fullName"] = "Name must include first and last name"

    # Email
    if not email:
        errors["email"] = "Email is required"
    else:
        email_regex = r'^[\w\.-]+@[\w\.-]+\.\w+$'
        if not re.match(email_regex, email):
            errors["email"] = "Invalid email format"

    # Password
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

    # تحقق من الدور
    if role not in ["freelancer", "client"]:
        errors["role"] = "Invalid role selected"

    Collection = db["Freelancer"] if role == "freelancer" else db["Client"]

    # تحقق من وجود الإيميل في الكولكشنين
    email_exists = serach(db["Freelancer"], email) or serach(db["Client"], email)
    if email and email_exists:
        errors["email"] = "User already exists"

    # إذا فما أخطاء
    if errors:
        return jsonify({"errors": errors}), 400

    hashed_password = generate_password_hash(password)

    Collection.insert_one({
        "username": name,
        "email": email,
        "password": hashed_password
    })

    return jsonify({"message": "Account Created successfully"}), 201

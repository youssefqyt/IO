from flask import request, jsonify
from werkzeug.security import generate_password_hash
import re

def serach(Collection, email):
    if Collection.find_one({"email": email}):
        return True
    return False

def validate(name, email, password):
    errors = []
    if not name or not email or not password:
        errors.append("All fields are required")
    if name and len(name.strip().split()) < 2:
        errors.append("Name must include first and last name")
    if email:
        email_regex = r'^[\w\.-]+@[\w\.-]+\.\w+$'
        if not re.match(email_regex, email):
            errors.append("Invalid email format")
    if password and len(password) < 8:
        errors.append("Password must be at least 8 characters")
    return errors

def register_user(db):
    data = request.get_json()
    role = data.get('role')
    name = data.get('fullName')
    email = data.get('email')
    password = data.get('password')
    errors = validate(name, email, password)
    if errors:
        return jsonify({"errors": errors}), 400
    Collection = db["Freelancer"] if role == "freelancer" else db["Client"]
    if serach(Collection, email):
        return jsonify({"errors": ["User already exists"]}), 400
    hashed_password = generate_password_hash(password)
    Collection.insert_one({
        "username": name,
        "email": email,
        "password": hashed_password
    })

    return jsonify({"message": "User registered successfully"}), 201
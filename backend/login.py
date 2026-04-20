from flask import request, jsonify
from werkzeug.security import check_password_hash
import jwt
import datetime
from config import SECRET_KEY


def validate(email, password):
    errors = {}

    if not email:
        errors["email"] = "Email is required"

    if not password:
        errors["password"] = "Password is required"

    return errors

def login_user(db):
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''

    errors = validate(email, password)
    if errors:
        return jsonify({"errors": errors}), 400

    role = None
    user = None
    for collection_name, user_role in [("Freelancer", "freelancer"), ("Client", "client")]:
        found = db[collection_name].find_one({"email": email})
        if found:
            user = found
            role = user_role
            break

    if not user:
        return jsonify({"errors": {"email": "Email does not exist"}}), 401

    if not check_password_hash(user['password'], password):
        return jsonify({"errors": {"password": "Incorrect password"}}), 401

    token = jwt.encode({
        'user_id': str(user['_id']),
        'email': user.get('email'),
        'role': role,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    }, SECRET_KEY, algorithm="HS256")

    return jsonify({
        "message": "Login successful",
        "token": token,
        "user": {
            "id": str(user['_id']),
            "fullName": user.get('username', ''),
            "email": user.get('email', ''),
            "role": role
        }
    }), 200
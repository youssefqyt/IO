from flask import request, jsonify
from werkzeug.security import check_password_hash, generate_password_hash
import jwt
from config import SECRET_KEY


def _extract_token():
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    return auth_header.split(" ", 1)[1].strip()


def _validate_payload(current_password, new_password, confirm_password):
    errors = {}

    if not current_password:
        errors["currentPassword"] = "Current password is required"

    if not new_password:
        errors["newPassword"] = "New password is required"
    elif len(new_password) < 8:
        errors["newPassword"] = "New password must be at least 8 characters"

    if not confirm_password:
        errors["confirmPassword"] = "Please confirm your new password"
    elif new_password and new_password != confirm_password:
        errors["confirmPassword"] = "New password and confirm password do not match"

    if current_password and new_password and current_password == new_password:
        errors["newPassword"] = "New password must be different from current password"

    return errors


def change_password(db):
    token = _extract_token()
    if not token:
        return jsonify({"errors": {"general": "Authorization token is missing"}}), 401

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        return jsonify({"errors": {"general": "Session expired. Please login again"}}), 401
    except jwt.InvalidTokenError:
        return jsonify({"errors": {"general": "Invalid token"}}), 401

    data = request.get_json() or {}
    current_password = data.get("currentPassword") or ""
    new_password = data.get("newPassword") or ""
    confirm_password = data.get("confirmPassword") or ""

    errors = _validate_payload(current_password, new_password, confirm_password)
    if errors:
        return jsonify({"errors": errors}), 400

    user_email = (payload.get("email") or "").strip().lower()
    if not user_email:
        return jsonify({"errors": {"general": "Invalid token payload"}}), 401

    collection = None
    user = None
    for collection_name in ["Freelancer", "Client"]:
        found = db[collection_name].find_one({"email": user_email})
        if found:
            collection = db[collection_name]
            user = found
            break

    if not user or collection is None:
        return jsonify({"errors": {"general": "User not found"}}), 404

    if not check_password_hash(user["password"], current_password):
        return jsonify({"errors": {"currentPassword": "Current password is incorrect"}}), 401

    hashed_password = generate_password_hash(new_password)
    collection.update_one({"_id": user["_id"]}, {"$set": {"password": hashed_password}})

    return jsonify({"message": "Password updated successfully"}), 200

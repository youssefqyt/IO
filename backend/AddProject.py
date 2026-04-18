from datetime import datetime, timezone

from flask import jsonify, request
from bson import ObjectId


def validate_project_payload(data):
    errors = {}

    title = (data.get("title") or "").strip()
    category = (data.get("category") or "").strip()
    description = (data.get("description") or "").strip()
    budget = data.get("budget")
    deadline = data.get("deadline")
    project_type = (data.get("projectType") or "").strip()
    posted_by = data.get("postedBy") or {}
    poster_id = (posted_by.get("id") or "").strip()
    poster_role = (posted_by.get("role") or "").strip().lower()

    if not title:
        errors["title"] = "Project title is required"

    if not category:
        errors["category"] = "Category is required"

    if not description:
        errors["description"] = "Project description is required"

    if budget in (None, ""):
        errors["budget"] = "Budget or rate is required"
    else:
        try:
            parsed_budget = float(budget)
            if parsed_budget <= 0:
                errors["budget"] = "Budget must be greater than 0"
        except (TypeError, ValueError):
            errors["budget"] = "Budget must be a valid number"

    if deadline in (None, ""):
        errors["deadline"] = "Deadline is required"
    else:
        try:
            parsed_deadline = int(deadline)
            if parsed_deadline <= 0:
                errors["deadline"] = "Deadline must be greater than 0"
        except (TypeError, ValueError):
            errors["deadline"] = "Deadline must be a valid number"

    allowed_types = {"project", "hourly", "fixed-price"}
    if project_type not in allowed_types:
        errors["projectType"] = "Project type must be Project, Hourly, or Fixed Price"

    if not poster_id:
        errors["postedBy"] = "Poster id is required"

    if poster_role not in {"client", "freelancer"}:
        errors["postedBy"] = "Poster role must be client or freelancer"

    return errors


def add_project(db):
    data = request.get_json() or {}
    errors = validate_project_payload(data)

    if errors:
        return jsonify({"errors": errors}), 400

    posted_by = data.get("postedBy") or {}
    poster_role = posted_by.get("role").strip().lower()
    collection_name = "Client" if poster_role == "client" else "Freelancer"

    try:
        poster_object_id = ObjectId(posted_by.get("id").strip())
    except Exception:
        return jsonify({"errors": {"postedBy": "Poster id is invalid"}}), 400

    poster = db[collection_name].find_one({"_id": poster_object_id})
    if not poster:
        return jsonify({"errors": {"postedBy": "Poster account was not found"}}), 404

    now = datetime.now(timezone.utc)

    project_document = {
        "title": data.get("title").strip(),
        "category": data.get("category").strip(),
        "description": data.get("description").strip(),
        "budget": float(data.get("budget")),
        "deadlineDays": int(data.get("deadline")),
        "projectType": data.get("projectType").strip(),
        "briefFileName": (data.get("briefFileName") or "").strip(),
        "briefFileData": (data.get("briefFileData") or "").strip(),
        "status": "open",
        "postedBy": {
            "id": str(poster["_id"]),
            "role": poster_role,
            "name": poster.get("username", (posted_by.get("fullName") or "").strip()),
            "email": poster.get("email", (posted_by.get("email") or "").strip().lower()),
        },
        "createdAt": now,
        "updatedAt": now,
    }

    result = db["Project"].insert_one(project_document)

    return jsonify({
        "message": "Project posted successfully",
        "project": {
            "id": str(result.inserted_id),
            "title": project_document["title"],
            "projectType": project_document["projectType"],
            "postedBy": project_document["postedBy"],
            "status": project_document["status"],
        }
    }), 201

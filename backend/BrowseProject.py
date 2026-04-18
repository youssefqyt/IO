from datetime import datetime, timezone

from flask import jsonify
from bson import ObjectId


def _format_relative_time(value):
    if not isinstance(value, datetime):
        return "Just now"

    created_at = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    diff = now - created_at
    if diff.total_seconds() < 0:
        return "Just now"
    total_seconds = int(diff.total_seconds())

    if total_seconds < 60:
        return "Just now"

    minutes = total_seconds // 60
    if minutes < 60:
        return f"{minutes}m ago"

    hours = minutes // 60
    if hours < 24:
        return f"{hours}h ago"

    days = hours // 24
    return f"{days}d ago"


def _badge_class(project_type):
    normalized = (project_type or "").strip().lower()
    if normalized == "hourly":
        return "bg-green-50 text-green-600"
    if normalized == "fixed-price":
        return "bg-blue-50 text-blue-600"
    return "bg-orange-50 text-orange-600"


def _type_label(project_type):
    normalized = (project_type or "").strip().lower()
    if normalized == "fixed-price":
        return "Fixed Price"
    if normalized == "hourly":
        return "Hourly"
    return "Project"


def _amount_label(project_type):
    normalized = (project_type or "").strip().lower()
    return "Rate" if normalized == "hourly" else "Budget"


def _amount_value(project_type, budget):
    try:
        numeric_budget = float(budget)
    except (TypeError, ValueError):
        return str(budget or "")

    if (project_type or "").strip().lower() == "hourly":
        return f"${numeric_budget:,.0f}/hr"

    return f"${numeric_budget:,.0f}"


def _accepted_project_ids(db):
    project_ids = set()
    documents = db["MyJobFreelancer"].find(
        {"status": "active"},
        {"projectId": 1}
    )

    for document in documents:
        project_id = (document.get("projectId") or "").strip()
        if project_id:
            project_ids.add(project_id)

    return list(project_ids)


def get_projects(db):
    query = {"status": "open"}
    accepted_ids = _accepted_project_ids(db)
    if accepted_ids:
        query["_id"] = {"$nin": [ObjectId(project_id) for project_id in accepted_ids if ObjectId.is_valid(project_id)]}

    documents = db["Project"].find(query).sort("createdAt", -1)
    projects = []

    for document in documents:
        project_type = document.get("projectType", "project")
        projects.append({
            "id": str(document.get("_id")),
            "type": _type_label(project_type),
            "time": _format_relative_time(document.get("createdAt")),
            "badgeClass": _badge_class(project_type),
            "title": document.get("title", "Untitled Project"),
            "description": document.get("description", ""),
            "label": _amount_label(project_type),
            "amount": _amount_value(project_type, document.get("budget", "")),
            "deadline": f"{document.get('deadlineDays', 0)} Days",
            "briefFileName": document.get("briefFileName", ""),
            "category": document.get("category", ""),
            "projectType": project_type,
            "postedBy": document.get("postedBy", {}),
        })

    return jsonify(projects), 200


def get_project_details(db, project_id):
    try:
        object_id = ObjectId(project_id)
    except Exception:
        return jsonify({"error": "Invalid project id"}), 400

    document = db["Project"].find_one({"_id": object_id, "status": "open"})
    if not document:
        return jsonify({"error": "Project not found"}), 404

    project_type = document.get("projectType", "project")
    return jsonify({
        "id": str(document.get("_id")),
        "type": _type_label(project_type),
        "time": _format_relative_time(document.get("createdAt")),
        "badgeClass": _badge_class(project_type),
        "title": document.get("title", "Untitled Project"),
        "description": document.get("description", ""),
        "label": _amount_label(project_type),
        "amount": _amount_value(project_type, document.get("budget", "")),
        "deadline": f"{document.get('deadlineDays', 0)} Days",
        "briefFileName": document.get("briefFileName", ""),
        "briefFileData": document.get("briefFileData", ""),
        "category": document.get("category", ""),
        "projectType": project_type,
        "postedBy": document.get("postedBy", {}),
    }), 200

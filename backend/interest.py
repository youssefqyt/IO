import base64
from datetime import datetime, timezone

from flask import jsonify


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


def _normalize_image(image_value):
    if not image_value:
        return ""

    if isinstance(image_value, (bytes, bytearray)):
        encoded = base64.b64encode(image_value).decode("utf-8")
        return f"data:image/png;base64,{encoded}"

    if isinstance(image_value, dict):
        binary_value = image_value.get("$binary")
        if isinstance(binary_value, dict):
            base64_value = str(binary_value.get("base64", "")).strip()
            if base64_value:
                return f"data:image/png;base64,{base64_value}"
        return ""

    if not isinstance(image_value, str):
        return ""

    image_value = image_value.strip()
    if not image_value:
        return ""

    if image_value.startswith(("http://", "https://", "data:image/")):
        return image_value

    return f"data:image/png;base64,{image_value}"


def _normalize_includes(includes_value):
    if isinstance(includes_value, list):
        return [str(item).strip() for item in includes_value if str(item).strip()]

    if isinstance(includes_value, str):
        normalized = includes_value
        for separator in ["\n", ";", ","]:
            normalized = normalized.replace(separator, "|")
        return [item.strip() for item in normalized.split("|") if item.strip()]

    return []


def _normalize_interest_label(value):
    text = str(value or "").strip()
    if not text:
        return ""

    normalized = text.replace("-", " ").replace("_", " ")
    return " ".join(part.capitalize() for part in normalized.split())


def _interest_icon(label):
    normalized = str(label or "").strip().lower()
    icon_map = {
        "graphic design": "brush",
        "design": "brush",
        "web dev": "code",
        "web development": "code",
        "development": "code",
        "ai": "psychology",
        "ai models": "psychology",
        "marketing": "trending_up",
        "video editor": "videocam",
        "video editing": "videocam",
        "illustration": "draw",
        "copywriting": "translate",
        "photography": "photo_camera",
        "mobile dev": "phone_iphone",
        "mobile development": "phone_iphone",
        "ui ux": "design_services",
        "ui/ux": "design_services",
        "data entry": "table_rows",
        "seo": "query_stats",
        "project mgmt": "fact_check",
        "project management": "fact_check",
        "translation": "g_translate",
        "3d": "view_in_ar",
        "3d design": "view_in_ar",
        "music prod": "library_music",
        "music production": "library_music",
        "branding": "palette",
        "writing": "edit_note",
        "app design": "devices",
        "templates": "dashboard_customize",
        "icons": "apps",
    }
    return icon_map.get(normalized, "grid_view")


def _build_interest_items(project_documents, product_documents):
    values = []

    for document in project_documents:
        label = _normalize_interest_label(document.get("category"))
        if label:
            values.append(label)

    for product in product_documents:
        label = _normalize_interest_label(product.get("type"))
        if label:
            values.append(label)

    if not values:
        values = [
            "Graphic Design",
            "Web Dev",
            "AI Models",
            "Marketing",
            "Video Editor",
            "Illustration",
            "Copywriting",
            "Photography",
        ]

    unique_values = []
    seen = set()
    for value in values:
        key = value.lower()
        if key in seen:
            continue
        seen.add(key)
        unique_values.append(value)

    return [
        {
            "name": value,
            "icon": _interest_icon(value),
            "selected": index < 2,
        }
        for index, value in enumerate(unique_values[:16])
    ]


def get_interest_data(db):
    try:
        project_documents = list(
            db["Project"]
            .find({"status": "open"})
            .sort("createdAt", -1)
            .limit(3)
        )

        product_documents = list(
            db["MarketPlace"]
            .find()
            .sort("createdAt", -1)
            .limit(2)
        )

        interests = _build_interest_items(project_documents, product_documents)

        projects = []
        for document in project_documents:
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

        products = []
        for product in product_documents:
            product_id = product.get("_id")
            title = str(product.get("name", "")).strip()
            category = str(product.get("type", "")).strip()

            products.append({
                "id": str(product_id) if product_id else "",
                "title": title,
                "studio": str(product.get("studio") or "MARKETPLACE").strip(),
                "price": str(product.get("price", "")).strip(),
                "image": _normalize_image(product.get("image")),
                "alt": f"{title or 'Marketplace'} preview",
                "category": category,
                "description": str(product.get("description", "")).strip(),
                "includes": _normalize_includes(product.get("includes")),
            })

        return jsonify({
            "interests": interests,
            "projects": projects,
            "products": products
        }), 200
    except Exception as error:
        return jsonify({
            "message": "Failed to load interest data",
            "error": str(error)
        }), 500

import base64
from datetime import datetime, timezone

from flask import jsonify, request


DEFAULT_INTEREST_LABELS = [
    "Graphic Design",
    "Web Dev",
    "AI Models",
    "Marketing",
    "Video Editor",
    "Illustration",
    "Copywriting",
    "Photography",
    "Mobile Dev",
    "UI/UX",
    "Data Entry",
    "SEO",
    "Project Mgmt",
    "Translation",
    "3D Design",
    "Music Prod",
]

FALLBACK_INTEREST_CATEGORIES = [
    "Graphic Design",
    "Web Dev",
    "Marketing",
]

PROJECT_LIMIT = 3
PRODUCT_LIMIT = 2

CATEGORY_ALIASES = {
    "web development": "web dev",
    "mobile development": "mobile dev",
    "project management": "project mgmt",
    "music production": "music prod",
    "3d": "3d design",
}

CATEGORY_DISPLAY_LABELS = {
    "graphic design": "Graphic Design",
    "web dev": "Web Dev",
    "ai models": "AI Models",
    "marketing": "Marketing",
    "video editor": "Video Editor",
    "illustration": "Illustration",
    "copywriting": "Copywriting",
    "photography": "Photography",
    "mobile dev": "Mobile Dev",
    "ui ux": "UI/UX",
    "data entry": "Data Entry",
    "seo": "SEO",
    "project mgmt": "Project Mgmt",
    "translation": "Translation",
    "3d design": "3D Design",
    "music prod": "Music Prod",
}


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


def _normalize_category_key(value):
    normalized = str(value or "").strip().lower()
    if not normalized:
        return ""

    for separator in ["-", "_", "/", "&"]:
        normalized = normalized.replace(separator, " ")

    normalized = " ".join(normalized.split())
    return CATEGORY_ALIASES.get(normalized, normalized)


def _normalize_interest_label(value):
    normalized_key = _normalize_category_key(value)
    if not normalized_key:
        return ""

    if normalized_key in CATEGORY_DISPLAY_LABELS:
        return CATEGORY_DISPLAY_LABELS[normalized_key]

    return " ".join(part.capitalize() for part in normalized_key.split())


def _interest_icon(label):
    normalized = _normalize_category_key(label)
    icon_map = {
        "graphic design": "brush",
        "design": "brush",
        "web dev": "code",
        "development": "code",
        "ai models": "psychology",
        "marketing": "trending_up",
        "video editor": "videocam",
        "illustration": "draw",
        "copywriting": "translate",
        "photography": "photo_camera",
        "mobile dev": "phone_iphone",
        "ui ux": "design_services",
        "data entry": "table_rows",
        "seo": "query_stats",
        "project mgmt": "fact_check",
        "translation": "g_translate",
        "3d design": "view_in_ar",
        "music prod": "library_music",
        "branding": "palette",
        "writing": "edit_note",
        "app design": "devices",
        "templates": "dashboard_customize",
        "icons": "apps",
    }
    return icon_map.get(normalized, "grid_view")


def _normalize_selected_categories(values):
    normalized_categories = []
    seen = set()

    for value in values:
        label = _normalize_interest_label(value)
        key = _normalize_category_key(label)
        if not key or key in seen:
            continue
        seen.add(key)
        normalized_categories.append(label)

    return normalized_categories


def _build_interest_items(project_documents, product_documents, selected_categories=None):
    values = []
    selected_categories = selected_categories or []

    for selected_label in _normalize_selected_categories(selected_categories):
        values.append(selected_label)

    for document in project_documents:
        label = _normalize_interest_label(document.get("category"))
        if label:
            values.append(label)

    for product in product_documents:
        label = _normalize_interest_label(product.get("type"))
        if label:
            values.append(label)

    values.extend(DEFAULT_INTEREST_LABELS)

    unique_values = []
    seen = set()
    for value in values:
        key = _normalize_category_key(value)
        if not key or key in seen:
            continue
        seen.add(key)
        unique_values.append(_normalize_interest_label(value))

    selected_keys = {
        _normalize_category_key(category)
        for category in selected_categories
        if _normalize_category_key(category)
    }
    items = [
        {
            "name": value,
            "icon": _interest_icon(value),
            "selected": False,
        }
        for value in unique_values[:16]
    ]

    if not items:
        return items

    if selected_keys:
        for item in items:
            item["selected"] = _normalize_category_key(item["name"]) in selected_keys

    if not any(item["selected"] for item in items):
        default_selected_count = min(len(items), 2)
        for index in range(default_selected_count):
            items[index]["selected"] = True

    return items


def _filter_documents_by_category(documents, field_name, category_keys):
    normalized_keys = {key for key in category_keys if key}
    if not normalized_keys:
        return []

    return [
        document
        for document in documents
        if _normalize_category_key(document.get(field_name)) in normalized_keys
    ]


def _get_saved_interest_categories(db):
    documents = list(
        db["Interest"]
        .find({})
        .sort([("updatedAt", -1), ("createdAt", -1)])
    )

    if not documents:
        return []

    return _normalize_selected_categories(
        [
            document.get("category") or document.get("normalizedCategory")
            for document in documents
        ]
    )


def _resolve_feed_documents(project_documents, product_documents, selected_categories):
    selected_keys = {
        _normalize_category_key(category)
        for category in selected_categories
        if _normalize_category_key(category)
    }
    fallback_keys = {
        _normalize_category_key(category)
        for category in FALLBACK_INTEREST_CATEGORIES
    }

    if not selected_keys:
        return (
            project_documents[:PROJECT_LIMIT],
            product_documents[:PRODUCT_LIMIT],
            False,
        )

    filtered_projects = _filter_documents_by_category(
        project_documents,
        "category",
        selected_keys,
    )
    filtered_products = _filter_documents_by_category(
        product_documents,
        "type",
        selected_keys,
    )

    used_fallback = False

    if not filtered_projects:
        filtered_projects = _filter_documents_by_category(
            project_documents,
            "category",
            fallback_keys,
        )
        used_fallback = True

    if not filtered_products:
        filtered_products = _filter_documents_by_category(
            product_documents,
            "type",
            fallback_keys,
        )
        used_fallback = True

    if not filtered_projects:
        filtered_projects = project_documents

    if not filtered_products:
        filtered_products = product_documents

    return (
        filtered_projects[:PROJECT_LIMIT],
        filtered_products[:PRODUCT_LIMIT],
        used_fallback,
    )


def save_interest_selection(db):
    data = request.get_json() or {}
    raw_categories = data.get("categories")
    if isinstance(raw_categories, list):
        categories = raw_categories
    else:
        categories = [data.get("category")]

    normalized_categories = _normalize_selected_categories(categories)
    if not normalized_categories:
        return jsonify({"message": "At least one category is required"}), 400

    now = datetime.now(timezone.utc)

    db["Interest"].delete_many({})
    documents = [
        {
            "category": category,
            "normalizedCategory": _normalize_category_key(category),
            "createdAt": now,
            "updatedAt": now,
        }
        for category in normalized_categories
    ]
    result = db["Interest"].insert_many(documents)

    return jsonify(
        {
            "message": "Interest categories saved successfully",
            "interests": [
                {
                    "id": str(inserted_id),
                    "category": category,
                }
                for inserted_id, category in zip(result.inserted_ids, normalized_categories)
            ],
            "categories": normalized_categories,
        }
    ), 201


def get_interest_data(db):
    try:
        all_project_documents = list(
            db["Project"]
            .find({"status": "open"})
            .sort("createdAt", -1)
        )

        all_product_documents = list(
            db["MarketPlace"]
            .find()
            .sort("createdAt", -1)
        )

        selected_categories = _get_saved_interest_categories(db)
        project_documents, product_documents, used_fallback = _resolve_feed_documents(
            all_project_documents,
            all_product_documents,
            selected_categories,
        )

        interests = _build_interest_items(
            all_project_documents,
            all_product_documents,
            selected_categories,
        )

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
            "products": products,
            "selectedCategory": selected_categories[0] if selected_categories else "",
            "selectedCategories": selected_categories,
            "fallbackCategories": FALLBACK_INTEREST_CATEGORIES if used_fallback else [],
        }), 200
    except Exception as error:
        return jsonify({
            "message": "Failed to load interest data",
            "error": str(error)
        }), 500

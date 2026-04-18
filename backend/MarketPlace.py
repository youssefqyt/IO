import base64

from datetime import datetime, timezone

from bson import ObjectId
from flask import jsonify, request


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
        separators = ["\n", ";", ","]
        normalized = includes_value
        for separator in separators:
            normalized = normalized.replace(separator, "|")

        return [item.strip() for item in normalized.split("|") if item.strip()]

    return []


def get_marketplace_products(db):
    try:
        collection = db.get_collection("MarketPlace")
        products = []

        for product in collection.find():
            product_id = product.get("_id")
            category = str(product.get("type", "")).strip()
            title = str(product.get("name", "")).strip()

            products.append(
                {
                    "id": str(product_id) if product_id else "",
                    "title": title,
                    "studio": str(product.get("studio") or "MARKETPLACE").strip(),
                    "price": str(product.get("price", "")).strip(),
                    "image": _normalize_image(product.get("image")),
                    "alt": f"{title or 'Marketplace'} preview",
                    "category": category,
                    "description": str(product.get("description", "")).strip(),
                    "includes": _normalize_includes(product.get("includes")),
                }
            )

        return jsonify(products), 200
    except Exception as error:
        return jsonify({"message": "Failed to load marketplace products", "error": str(error)}), 500


def _normalize_price_input(value):
    if value in (None, ""):
        raise ValueError("Price is required")

    if isinstance(value, (int, float)):
        numeric_value = float(value)
    else:
        cleaned_value = str(value).strip().replace("$", "")
        numeric_value = float(cleaned_value)

    if numeric_value <= 0:
        raise ValueError("Price must be greater than 0")

    return f"${numeric_value:,.0f}"


def _normalize_image_input(image_value):
    normalized = _normalize_image(image_value)
    if not normalized:
        return ""
    return normalized


def add_marketplace_product(db):
    data = request.get_json() or {}
    errors = {}

    title = str(data.get("title", "")).strip()
    product_type = str(data.get("category", "")).strip()
    description = str(data.get("description", "")).strip()
    studio = str(data.get("studio", "")).strip()
    image = _normalize_image_input(data.get("image"))
    includes = _normalize_includes(data.get("includes"))
    submitted_by = data.get("submittedBy") or {}
    submitted_by_id = str(submitted_by.get("id", "")).strip()

    if not title:
        errors["title"] = "Product title is required"

    if not product_type:
        errors["category"] = "Category is required"

    if not description:
        errors["description"] = "Description is required"

    if not studio:
        errors["studio"] = "Studio name is required"

    if not submitted_by_id:
        errors["submittedBy"] = "User id is required"

    try:
        price = _normalize_price_input(data.get("price"))
    except (TypeError, ValueError) as error:
        errors["price"] = str(error)
        price = ""

    if errors:
        return jsonify({"errors": errors}), 400

    user_collection = db["Freelancer"]
    try:
        user = user_collection.find_one({"_id": ObjectId(submitted_by_id)})
    except Exception:
        return jsonify({"errors": {"submittedBy": "User id is invalid"}}), 400

    if not user:
        return jsonify({"errors": {"submittedBy": "Freelancer account was not found"}}), 404

    now = datetime.now(timezone.utc)
    document = {
        "name": title,
        "type": product_type,
        "studio": studio,
        "price": price,
        "description": description,
        "includes": includes,
        "image": image,
        "submittedBy": {
            "id": str(user.get("_id")),
            "name": user.get("username", studio),
            "email": user.get("email", ""),
        },
        "createdAt": now,
        "updatedAt": now,
    }

    result = db["MarketPlace"].insert_one(document)

    return jsonify({
        "message": "Product added successfully",
        "product": {
            "id": str(result.inserted_id),
            "title": document["name"],
            "category": document["type"],
            "price": document["price"],
        }
    }), 201

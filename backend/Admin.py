from flask import request, jsonify
from bson import ObjectId
from datetime import datetime, timezone

def get_pending_signup_requests(db):
    try:
        requests = db["AdminCompte"].find({"status": "pending"})
        result = []
        for req in requests:
            result.append({
                "id": str(req.get("_id")),
                "username": req.get("username", ""),
                "email": req.get("email", ""),
                "role": req.get("role", ""),
                "createdAt": req.get("createdAt", "").isoformat() if req.get("createdAt") else ""
            })
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"message": "Failed to fetch signup requests", "error": str(e)}), 500

def approve_signup_request(db, request_id):
    try:
        request_obj = db["AdminCompte"].find_one({"_id": ObjectId(request_id), "status": "pending"})
        if not request_obj:
            return jsonify({"errors": {"request": "Request not found"}}), 404

        role = request_obj.get("role")
        Collection = db["Freelancer"] if role == "freelancer" else db["Client"]

        user_data = {
            "username": request_obj.get("username"),
            "email": request_obj.get("email"),
            "password": request_obj.get("password")
        }

        result = Collection.insert_one(user_data)

        db["AdminCompte"].update_one(
            {"_id": ObjectId(request_id)},
            {"$set": {"status": "approved", "approvedAt": datetime.now(timezone.utc)}}
        )

        return jsonify({
            "message": "Signup request approved",
            "user": {
                "id": str(result.inserted_id),
                "fullName": user_data["username"],
                "email": user_data["email"],
                "role": role
            }
        }), 200
    except Exception as e:
        return jsonify({"message": "Failed to approve signup request", "error": str(e)}), 500

def reject_signup_request(db, request_id):
    try:
        result = db["AdminCompte"].delete_one({"_id": ObjectId(request_id), "status": "pending"})
        if result.deleted_count == 0:
            return jsonify({"errors": {"request": "Request not found"}}), 404

        return jsonify({"message": "Signup request rejected"}), 200
    except Exception as e:
        return jsonify({"message": "Failed to reject signup request", "error": str(e)}), 500

def get_pending_product_requests(db):
    try:
        requests = db["AdminProduct"].find({"status": "pending"})
        result = []
        for req in requests:
            submitted_by = req.get("submittedBy", {})
            result.append({
                "id": str(req.get("_id")),
                "title": req.get("name", ""),
                "category": req.get("type", ""),
                "studio": req.get("studio", ""),
                "price": req.get("price", ""),
                "description": req.get("description", ""),
                "includes": req.get("includes", []),
                "image": req.get("image", ""),
                "submittedBy": {
                    "id": submitted_by.get("id", ""),
                    "name": submitted_by.get("name", ""),
                    "email": submitted_by.get("email", "")
                },
                "createdAt": req.get("createdAt", "").isoformat() if req.get("createdAt") else ""
            })
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"message": "Failed to fetch product requests", "error": str(e)}), 500

def approve_product_request(db, request_id):
    try:
        request_obj = db["AdminProduct"].find_one({"_id": ObjectId(request_id), "status": "pending"})
        if not request_obj:
            return jsonify({"errors": {"request": "Request not found"}}), 404

        product_data = {
            "name": request_obj.get("name"),
            "type": request_obj.get("type"),
            "studio": request_obj.get("studio"),
            "price": request_obj.get("price"),
            "description": request_obj.get("description"),
            "includes": request_obj.get("includes"),
            "image": request_obj.get("image"),
            "submittedBy": request_obj.get("submittedBy"),
            "createdAt": request_obj.get("createdAt"),
            "updatedAt": datetime.now(timezone.utc)
        }

        result = db["MarketPlace"].insert_one(product_data)

        db["AdminProduct"].update_one(
            {"_id": ObjectId(request_id)},
            {"$set": {"status": "approved", "approvedAt": datetime.now(timezone.utc)}}
        )

        return jsonify({
            "message": "Product request approved",
            "product": {
                "id": str(result.inserted_id),
                "title": product_data["name"],
                "category": product_data["type"],
                "price": product_data["price"]
            }
        }), 200
    except Exception as e:
        return jsonify({"message": "Failed to approve product request", "error": str(e)}), 500

def reject_product_request(db, request_id):
    try:
        result = db["AdminProduct"].delete_one({"_id": ObjectId(request_id), "status": "pending"})
        if result.deleted_count == 0:
            return jsonify({"errors": {"request": "Request not found"}}), 404

        return jsonify({"message": "Product request rejected"}), 200
    except Exception as e:
        return jsonify({"message": "Failed to reject product request", "error": str(e)}), 500


def get_dashboard_stats(db):
    try:
        freelancer_count = db["Freelancer"].count_documents({})
        client_count = db["Client"].count_documents({})
        
        return jsonify({
            "freelancerCount": freelancer_count,
            "clientCount": client_count
        }), 200
    except Exception as e:
        return jsonify({"message": "Failed to fetch dashboard stats", "error": str(e)}), 500


def get_compte_requests(db):
    try:
        requests = db["AdminCompte"].find({"status": "pending"})
        result = []
        for req in requests:
            result.append({
                "id": str(req.get("_id")),
                "username": req.get("username", ""),
                "email": req.get("email", ""),
                "role": req.get("role", ""),
                "createdAt": req.get("createdAt", "").isoformat() if req.get("createdAt") else ""
            })
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"message": "Failed to fetch compte requests", "error": str(e)}), 500
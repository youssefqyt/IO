from flask import jsonify, request
from datetime import datetime, timezone
from bson import ObjectId


def _format_relative_time(value):
    if not isinstance(value, datetime):
        return "Just now"
    created_at = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    diff = datetime.now(timezone.utc) - created_at
    seconds = int(diff.total_seconds())
    if seconds < 60:
        return "Just now"
    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes}m ago"
    hours = minutes // 60
    if hours < 24:
        return f"{hours}h ago"
    return f"{hours // 24}d ago"


FALLBACK_CONVERSATIONS = [
    {
        "name": "Alex Rivera",
        "time": "09:44 AM",
        "preview": "Great! It's for a fintech startup. We need a clean, iOS-style interface.",
        "isOnline": True,
        "isUnread": True,
    },
    {
        "name": "Sarah Jenkins",
        "time": "Yesterday",
        "preview": "The contract has been signed. Looking forward to the kickoff!",
        "isOnline": False,
        "isUnread": False,
    },
]


def get_conversations(db):
    try:
        user_id = (request.args.get("userId") or "").strip()
        role = (request.args.get("role") or "").strip().lower()

        if not user_id:
            return jsonify({"errors": {"userId": "User id is required"}}), 400

        if role not in {"client", "freelancer"}:
            return jsonify({"errors": {"role": "Role must be client or freelancer"}}), 400

        query = {"$or": [{"clientId": user_id}, {"freelancerId": user_id}]}
        
        messages = list(db["Message"].find(query).sort("createdAt", -1))

        if not messages:
            return jsonify([]), 200

        conversation_map = {}
        for msg in messages:
            # Ensure consistent conversation ID generation
            project_id = msg.get("projectId", "")
            client_id = msg.get("clientId", "")
            freelancer_id = msg.get("freelancerId", "")
            if project_id and client_id and freelancer_id:
                ids = sorted([client_id, freelancer_id])
                conversation_id = f"{project_id}|{ids[0]}|{ids[1]}"
            else:
                conversation_id = msg.get("conversationId") or f"{project_id}|{client_id}|{freelancer_id}"
            
            if conversation_id not in conversation_map:
                conversation_map[conversation_id] = {
                    "conversationId": conversation_id,
                    "projectId": msg.get("projectId", ""),
                    "clientId": msg.get("clientId", ""),
                    "freelancerId": msg.get("freelancerId", ""),
                    "lastMessage": msg.get("message", ""),
                    "lastMessageTime": msg.get("createdAt"),
                    "senderRole": msg.get("senderRole", ""),
                    "eventType": msg.get("eventType", ""),
                }

        conversations = []
        for conversation_id, data in conversation_map.items():
            other_user_id = data.get("freelancerId") if data.get("clientId") == user_id else data.get("clientId")
            other_user_collection = "Freelancer" if role == "client" else "Client"

            other_user = None
            if other_user_id:
                other_user_doc = db[other_user_collection].find_one({"_id": other_user_id})
                if other_user_doc:
                    other_user = {
                        "id": str(other_user_doc.get("_id")),
                        "name": other_user_doc.get("username", "")
                    }

            # Check if there are unread messages in this conversation
            unread_query = {
                "conversationId": conversation_id,
                "receiverId": user_id,
                "isRead": False
            }
            unread_count = db["Message"].count_documents(unread_query)
            is_unread = unread_count > 0

            conversations.append({
                "conversationId": conversation_id,
                "projectId": data.get("projectId", ""),
                "name": other_user.get("name", "Unknown") if other_user else "Unknown",
                "otherUserId": other_user.get("id", "") if other_user else "",
                "lastMessage": data.get("lastMessage", ""),
                "time": _format_relative_time(data.get("lastMessageTime")),
                "eventType": data.get("eventType", ""),
                "senderRole": data.get("senderRole", ""),
                "isUnread": is_unread,
            })

        return jsonify(conversations), 200

    except Exception as error:
        return jsonify({"message": "Failed to load conversations", "error": str(error)}), 500


def _format_message_doc(message_doc):
    return {
        "id": str(message_doc.get("_id")) if message_doc.get("_id") else "",
        "conversationId": message_doc.get("conversationId", ""),
        "projectId": message_doc.get("projectId", ""),
        "senderId": message_doc.get("senderId", ""),
        "receiverId": message_doc.get("receiverId", ""),
        "senderRole": message_doc.get("senderRole", ""),
        "message": message_doc.get("message", ""),
        "createdAt": message_doc.get("createdAt"),
        "time": _format_relative_time(message_doc.get("createdAt")),
    }


def get_messages(db):
    try:
        user_id = (request.args.get("userId") or "").strip()
        role = (request.args.get("role") or "").strip().lower()
        other_user_id = (request.args.get("otherUserId") or "").strip()
        conversation_id = (request.args.get("conversationId") or "").strip()
        project_id = (request.args.get("projectId") or "").strip()

        if not user_id:
            return jsonify({"errors": {"userId": "User id is required"}}), 400

        if role not in {"client", "freelancer"}:
            return jsonify({"errors": {"role": "Role must be client or freelancer"}}), 400

        if conversation_id:
            query = {
                "conversationId": conversation_id,
                "$or": [{"clientId": user_id}, {"freelancerId": user_id}]
            }
        else:
            if not other_user_id or not project_id:
                return jsonify({"errors": {"conversation": "ConversationId or otherUserId and projectId are required"}}), 400
            query = {
                "$or": [
                    {"clientId": user_id, "freelancerId": other_user_id, "projectId": project_id},
                    {"clientId": other_user_id, "freelancerId": user_id, "projectId": project_id}
                ]
            }

        messages = list(db["Message"].find(query).sort("createdAt", 1))
        return jsonify([_format_message_doc(msg) for msg in messages]), 200

    except Exception as error:
        return jsonify({"message": "Failed to load messages", "error": str(error)}), 500


def send_message(db):
    try:
        data = request.get_json() or {}
        sender_id = str(data.get("senderId", "")).strip()
        receiver_id = str(data.get("receiverId", "")).strip()
        sender_role = (data.get("senderRole") or "").strip().lower()
        client_id = str(data.get("clientId", "")).strip()
        freelancer_id = str(data.get("freelancerId", "")).strip()
        project_id = str(data.get("projectId", "")).strip()
        conversation_id = str(data.get("conversationId", "")).strip()
        message_text = str(data.get("message", "")).strip()

        if not sender_id or not receiver_id or not sender_role or not message_text:
            return jsonify({"errors": {"message": "senderId, receiverId, senderRole and message are required"}}), 400

        if sender_role not in {"client", "freelancer"}:
            return jsonify({"errors": {"senderRole": "senderRole must be client or freelancer"}}), 400

        if not conversation_id:
            # Ensure consistent ordering: project_id|smaller_id|larger_id
            ids = sorted([client_id, freelancer_id])
            conversation_id = f"{project_id}|{ids[0]}|{ids[1]}"

        now = datetime.now(timezone.utc)
        message_doc = {
            "conversationId": conversation_id,
            "projectId": project_id,
            "clientId": client_id,
            "freelancerId": freelancer_id,
            "senderId": sender_id,
            "receiverId": receiver_id,
            "senderRole": sender_role,
            "message": message_text,
            "eventType": "chat",
            "isRead": False,  # Mark as unread initially
            "createdAt": now,
        }

        result = db["Message"].insert_one(message_doc)
        message_doc["id"] = str(result.inserted_id)
        message_doc["time"] = _format_relative_time(now)
        if hasattr(now, 'isoformat'):
            message_doc["createdAt"] = now.isoformat()

        return jsonify(message_doc), 201

    except Exception as error:
        return jsonify({"message": "Failed to send message", "error": str(error)}), 500


def mark_messages_read(db):
    try:
        user_id = (request.args.get("userId") or "").strip()
        conversation_id = (request.args.get("conversationId") or "").strip()

        if not user_id or not conversation_id:
            return jsonify({"errors": {"userId": "User id is required", "conversationId": "Conversation id is required"}}), 400

        # Mark all messages in this conversation as read for this user
        result = db["Message"].update_many(
            {"conversationId": conversation_id, "receiverId": user_id, "isRead": False},
            {"$set": {"isRead": True}}
        )

        return jsonify({"message": f"Marked {result.modified_count} messages as read"}), 200

    except Exception as error:
        return jsonify({"message": "Failed to mark messages as read", "error": str(error)}), 500

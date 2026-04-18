from flask import jsonify


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
    {
        "name": "Mark Thompson",
        "time": "Tuesday",
        "preview": "Could you send over the latest wireframes for the dashboard?",
        "isOnline": False,
        "isUnread": False,
    },
    {
        "name": "Emily Chen",
        "time": "Oct 20",
        "preview": "Thanks for the quick turnaround on those icons!",
        "isOnline": True,
        "isUnread": False,
    },
    {
        "name": "David Miller",
        "time": "Oct 18",
        "preview": "Let's hop on a call tomorrow to discuss the budget.",
        "isOnline": False,
        "isUnread": False,
    },
]


def _normalize_conversation(document):
    name = str(document.get("name") or document.get("fullName") or "").strip()
    preview = str(
        document.get("preview")
        or document.get("lastMessage")
        or document.get("message")
        or ""
    ).strip()

    if not name:
        return None

    return {
        "id": str(document.get("_id", "")),
        "name": name,
        "time": str(document.get("time") or document.get("lastMessageTime") or "").strip(),
        "preview": preview,
        "isOnline": bool(document.get("isOnline", False)),
        "isUnread": bool(document.get("isUnread", False)),
    }


def get_conversations(db):
    try:
        collection_names = set(db.list_collection_names())
        candidate_collections = ["Messages", "Message", "Conversations", "Conversation"]

        for collection_name in candidate_collections:
            if collection_name not in collection_names:
                continue

            conversations = []
            collection = db.get_collection(collection_name)

            for document in collection.find():
                normalized = _normalize_conversation(document)
                if normalized:
                    conversations.append(normalized)

            if conversations:
                return jsonify(conversations), 200

        return jsonify(FALLBACK_CONVERSATIONS), 200
    except Exception as error:
        return jsonify({"message": "Failed to load conversations", "error": str(error)}), 500

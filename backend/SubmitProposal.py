from datetime import datetime, timezone

from bson import ObjectId
from flask import jsonify, request
from Myjob import create_myjob_client_record, create_myjob_freelancer_record


def validate_proposal_payload(data):
    errors = {}

    project_id = (data.get("projectId") or "").strip()
    pitch = (data.get("pitch") or "").strip()
    bid = data.get("bid")
    duration = (data.get("duration") or "").strip()
    submitted_by = data.get("submittedBy") or {}
    sender_id = (submitted_by.get("id") or "").strip()
    sender_role = (submitted_by.get("role") or "").strip().lower()

    if not project_id:
        errors["projectId"] = "Project id is required"

    if not pitch:
        errors["pitch"] = "Pitch is required"

    if bid in (None, ""):
        errors["bid"] = "Bid is required"
    else:
        try:
            parsed_bid = float(bid)
            if parsed_bid <= 0:
                errors["bid"] = "Bid must be greater than 0"
        except (TypeError, ValueError):
            errors["bid"] = "Bid must be a valid number"

    if not duration:
        errors["duration"] = "Duration is required"

    if not sender_id:
        errors["submittedBy"] = "Sender id is required"

    if sender_role not in {"client", "freelancer"}:
        errors["submittedBy"] = "Sender role must be client or freelancer"

    return errors


def submit_proposal(db):
    data = request.get_json() or {}
    errors = validate_proposal_payload(data)
    if errors:
        return jsonify({"errors": errors}), 400

    project_id = data.get("projectId").strip()
    submitted_by = data.get("submittedBy") or {}
    sender_role = submitted_by.get("role").strip().lower()
    sender_collection = "Client" if sender_role == "client" else "Freelancer"

    try:
        project_object_id = ObjectId(project_id)
    except Exception:
        return jsonify({"errors": {"projectId": "Project id is invalid"}}), 400

    try:
        sender_object_id = ObjectId(submitted_by.get("id").strip())
    except Exception:
        return jsonify({"errors": {"submittedBy": "Sender id is invalid"}}), 400

    project = db["Project"].find_one({"_id": project_object_id, "status": "open"})
    if not project:
        return jsonify({"errors": {"projectId": "Project not found"}}), 404

    sender = db[sender_collection].find_one({"_id": sender_object_id})
    if not sender:
        return jsonify({"errors": {"submittedBy": "Sender account was not found"}}), 404

    project_owner = project.get("postedBy") or {}
    owner_role = (project_owner.get("role") or "").strip().lower()

    if sender_role == owner_role:
        return jsonify({
            "errors": {
                "submittedBy": "A proposal must connect one client and one freelancer"
            }
        }), 400

    if sender_role == "freelancer":
        freelancer_account = sender
        client_id = (project_owner.get("id") or "").strip()
        freelancer_id = str(sender["_id"])
        client_profile = {
            "id": client_id,
            "name": (project_owner.get("name") or "").strip(),
            "email": (project_owner.get("email") or "").strip().lower(),
        }
        freelancer_profile = {
            "id": freelancer_id,
            "name": sender.get("username", (submitted_by.get("fullName") or "").strip()),
            "email": sender.get("email", (submitted_by.get("email") or "").strip().lower()),
        }
    else:
        freelancer_id = (project_owner.get("id") or "").strip()
        client_id = str(sender["_id"])
        freelancer_profile = {
            "id": freelancer_id,
            "name": (project_owner.get("name") or "").strip(),
            "email": (project_owner.get("email") or "").strip().lower(),
        }
        freelancer_account = db["Freelancer"].find_one({"_id": ObjectId(freelancer_id)}) if ObjectId.is_valid(freelancer_id) else None
        client_profile = {
            "id": client_id,
            "name": sender.get("username", (submitted_by.get("fullName") or "").strip()),
            "email": sender.get("email", (submitted_by.get("email") or "").strip().lower()),
        }

    if not client_id or not freelancer_id:
        return jsonify({
            "errors": {
                "projectId": "The selected project must belong to a valid client and freelancer pair"
            }
        }), 400

    if not freelancer_account and ObjectId.is_valid(freelancer_id):
        freelancer_account = db["Freelancer"].find_one({"_id": ObjectId(freelancer_id)})

    now = datetime.now(timezone.utc)
    proposal_document = {
        "projectId": str(project["_id"]),
        "clientId": client_id,
        "freelancerId": freelancer_id,
        "projectTitle": project.get("title", ""),
        "projectBudget": project.get("budget"),
        "projectDeadlineDays": project.get("deadlineDays"),
        "pitch": data.get("pitch").strip(),
        "bid": float(data.get("bid")),
        "duration": data.get("duration").strip(),
        "milestonesEnabled": bool(data.get("milestonesEnabled")),
        "attachmentFileName": (data.get("attachmentFileName") or "").strip(),
        "attachmentFileData": (data.get("attachmentFileData") or "").strip(),
        "etat": "pending",
        "status": "submitted",
        "client": client_profile,
        "freelancer": {
            **freelancer_profile,
            "skills": freelancer_account.get("skills", []) if freelancer_account else [],
        },
        "submittedBy": {
            "id": str(sender["_id"]),
            "role": sender_role,
            "name": sender.get("username", (submitted_by.get("fullName") or "").strip()),
            "email": sender.get("email", (submitted_by.get("email") or "").strip().lower()),
        },
        "projectOwner": {
            "id": client_id if owner_role == "client" else freelancer_id,
            "role": owner_role,
            "name": (project_owner.get("name") or "").strip(),
            "email": (project_owner.get("email") or "").strip().lower(),
        },
        "createdAt": now,
        "updatedAt": now,
    }

    result = db["SendProposal"].insert_one(proposal_document)
    
    # Removed: Create an initial Sprint document for this proposal

    return jsonify({
        "message": "Proposal submitted successfully",
        "proposal": {
            "id": str(result.inserted_id),
            "projectId": proposal_document["projectId"],
            "clientId": proposal_document["clientId"],
            "freelancerId": proposal_document["freelancerId"],
            "etat": proposal_document["etat"],
            "status": proposal_document["status"],
        }
    }), 201


def _format_relative_time(value):
    if not isinstance(value, datetime):
        return "Just now"

    created_at = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    diff = datetime.now(timezone.utc) - created_at
    if diff.total_seconds() < 0:
        return "Just now"

    seconds = int(diff.total_seconds())
    if seconds < 60:
        return "Just now"

    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes}m ago"

    hours = minutes // 60
    if hours < 24:
        return f"{hours}h ago"

    days = hours // 24
    return f"{days}d ago"


def get_send_proposals(db):
    user_id = (request.args.get("userId") or "").strip()
    role = (request.args.get("role") or "").strip().lower()

    if not user_id:
        return jsonify({"errors": {"userId": "User id is required"}}), 400

    if role not in {"client", "freelancer"}:
        return jsonify({"errors": {"role": "Role must be client or freelancer"}}), 400

    query = {"clientId": user_id} if role == "client" else {"freelancerId": user_id}
    query["etat"] = {"$ne": "accepted"}
    documents = db["SendProposal"].find(query).sort("createdAt", -1)

    proposals = []
    for document in documents:
        proposals.append({
            "id": str(document.get("_id")),
            "projectId": document.get("projectId", ""),
            "clientId": document.get("clientId", ""),
            "freelancerId": document.get("freelancerId", ""),
            "projectTitle": document.get("projectTitle", "Untitled Project"),
            "projectBudget": document.get("projectBudget"),
            "projectDeadlineDays": document.get("projectDeadlineDays"),
            "pitch": document.get("pitch", ""),
            "bid": document.get("bid", 0),
            "duration": document.get("duration", ""),
            "milestonesEnabled": bool(document.get("milestonesEnabled")),
            "attachmentFileName": document.get("attachmentFileName", ""),
            "attachmentFileData": document.get("attachmentFileData", ""),
            "etat": document.get("etat", "pending"),
            "status": document.get("status", "submitted"),
            "submittedBy": document.get("submittedBy", {}),
            "client": document.get("client", {}),
            "freelancer": document.get("freelancer", {}),
            "projectOwner": document.get("projectOwner", {}),
            "createdAt": document.get("createdAt"),
            "updatedAt": document.get("updatedAt"),
            "createdAtLabel": _format_relative_time(document.get("createdAt")),
        })

    return jsonify(proposals), 200


def update_send_proposal_status(db, proposal_id):
    data = request.get_json() or {}
    action = (data.get("action") or "").strip().lower()
    user_id = (data.get("userId") or "").strip()
    role = (data.get("role") or "").strip().lower()

    if action not in {"accept", "refuse"}:
        return jsonify({"errors": {"action": "Action must be accept or refuse"}}), 400

    if role != "client":
        return jsonify({"errors": {"role": "Only clients can update proposal requests"}}), 403

    if not user_id:
        return jsonify({"errors": {"userId": "User id is required"}}), 400

    try:
        proposal_object_id = ObjectId(proposal_id)
    except Exception:
        return jsonify({"errors": {"proposalId": "Proposal id is invalid"}}), 400

    proposal = db["SendProposal"].find_one({"_id": proposal_object_id, "clientId": user_id})
    if not proposal:
        return jsonify({"errors": {"proposalId": "Proposal was not found"}}), 404

    if action == "refuse":
        db["SendProposal"].delete_one({"_id": proposal_object_id})
        return jsonify({"message": "Proposal refused and removed successfully"}), 200

    now = datetime.now(timezone.utc)
    db["SendProposal"].update_one(
        {"_id": proposal_object_id},
        {
            "$set": {
                "etat": "accepted",
                "status": "accepted",
                "updatedAt": now,
            }
        }
    )
    proposal["etat"] = "accepted"
    proposal["status"] = "accepted"
    proposal["updatedAt"] = now
    create_myjob_freelancer_record(db, proposal, now)
    create_myjob_client_record(db, proposal, now)

    db["Message"].insert_one({
        "proposalId": proposal.get("proposalId", ""),
        "projectId": proposal.get("projectId", ""),
        "clientId": proposal.get("clientId", ""),
        "freelancerId": proposal.get("freelancerId", ""),
        "senderId": user_id,
        "senderRole": "client",
        "message": "Proposal accepted - Project started",
        "eventType": "project-started",
        "createdAt": now
    })

    return jsonify({"message": "Proposal accepted successfully"}), 200

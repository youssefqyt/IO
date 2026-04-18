from datetime import datetime, timezone

from flask import jsonify, request


ALLOWED_WORKFLOW_STATUSES = {"in-progress", "in-review", "completed"}
ALLOWED_DELIVERY_STATUSES = {"none", "submitted", "revision-requested", "paid"}
MAX_DELIVERY_BYTES = 8 * 1024 * 1024
DEFAULT_CURRENCY = "USD"


def _now_utc():
    return datetime.now(timezone.utc)


def _format_relative_time(value):
    if not isinstance(value, datetime):
        return "Just now"

    created_at = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    diff = _now_utc() - created_at
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


def _normalize_workflow_status(value):
    normalized = (value or "").strip().lower()
    if normalized in ALLOWED_WORKFLOW_STATUSES:
        return normalized
    if normalized in {"review", "under-review"}:
        return "in-review"
    if normalized in {"done", "complete"}:
        return "completed"
    return "in-progress"


def _workflow_status_label(value):
    normalized = _normalize_workflow_status(value)
    if normalized == "in-review":
        return "In Review"
    if normalized == "completed":
        return "Completed"
    return "In Progress"


def _normalize_delivery_status(value):
    normalized = (value or "").strip().lower()
    if normalized in ALLOWED_DELIVERY_STATUSES:
        return normalized
    if normalized in {"revision", "revision-request"}:
        return "revision-requested"
    return "none"


def _safe_float(value, default=0.0):
    try:
        return round(float(value), 2)
    except (TypeError, ValueError):
        return round(float(default), 2)


def _safe_int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return int(default)


def _normalize_project_type(value):
    normalized = (value or "").strip().lower()
    if normalized in {"fixed-price", "hourly", "project"}:
        return normalized
    return "project"


def _estimate_data_url_size(value):
    if not isinstance(value, str):
        return 0

    normalized = value.strip()
    if not normalized:
        return 0

    if "," in normalized:
        normalized = normalized.split(",", 1)[1]

    padding = normalized.count("=")
    return max(0, (len(normalized) * 3) // 4 - padding)


def _serialize_delivery_files(value):
    if not isinstance(value, list):
        return []

    files = []
    for item in value:
        if not isinstance(item, dict):
            continue

        file_name = str(item.get("fileName", "")).strip()
        file_data = str(item.get("fileData", "")).strip()
        mime_type = str(item.get("mimeType", "")).strip()
        size_bytes = _safe_int(item.get("sizeBytes"), 0)

        if not file_name or not file_data:
            continue

        estimated_size = _estimate_data_url_size(file_data)
        files.append(
            {
                "fileName": file_name,
                "fileData": file_data,
                "mimeType": mime_type,
                "sizeBytes": size_bytes or estimated_size,
            }
        )

    return files


def _serialize_file_summaries(files):
    serialized_files = _serialize_delivery_files(files)
    return [
        {
            "fileName": file.get("fileName", ""),
            "mimeType": file.get("mimeType", ""),
            "sizeBytes": _safe_int(file.get("sizeBytes"), 0),
        }
        for file in serialized_files
    ]


def _contract_amount(document):
    bid_amount = _safe_float(document.get("bid"), 0)
    if bid_amount > 0:
        return bid_amount
    return _safe_float(document.get("projectBudget"), 0)


def _remaining_contract_amount(document):
    stored_remaining = _safe_float(document.get("remainingBudgetAmount"), -1)
    if stored_remaining >= 0:
        return stored_remaining
    contract_amount = _contract_amount(document)
    total_paid_amount = _safe_float(document.get("totalPaidAmount"), 0)
    return max(round(contract_amount - total_paid_amount, 2), 0)


def _user_unread_field(role):
    return "hasUnreadClientUpdate" if role == "client" else "hasUnreadFreelancerUpdate"


def _counterparty_unread_field(role):
    return "hasUnreadFreelancerUpdate" if role == "client" else "hasUnreadClientUpdate"


def _actor_profile(job, role):
    if role == "client":
        return job.get("client", {})
    return job.get("freelancer", {})


def _authorized_job_collection(role):
    return "MyJobClient" if role == "client" else "MyJobFreelancer"


def _load_authorized_job(db, proposal_id, user_id, role):
    if role not in {"client", "freelancer"}:
        return None

    user_field = "clientId" if role == "client" else "freelancerId"
    collection_name = _authorized_job_collection(role)

    return db[collection_name].find_one(
        {
            "proposalId": proposal_id,
            user_field: user_id,
            "status": "active",
        }
    )


def _sync_job_update(db, proposal_id, set_payload):
    update_payload = {"$set": set_payload}
    db["MyJobClient"].update_one({"proposalId": proposal_id}, update_payload)
    db["MyJobFreelancer"].update_one({"proposalId": proposal_id}, update_payload)


def _record_communication(
    db,
    job,
    event_type,
    sender_role,
    message="",
    files=None,
    requested_amount=0.0,
    approved_amount=0.0,
    delivery_sequence=0,
):
    sender_profile = _actor_profile(job, sender_role)
    event_time = _now_utc()

    db["MyJobCommunication"].insert_one(
        {
            "proposalId": job.get("proposalId", ""),
            "projectId": job.get("projectId", ""),
            "clientId": job.get("clientId", ""),
            "freelancerId": job.get("freelancerId", ""),
            "eventType": event_type,
            "senderRole": sender_role,
            "senderId": sender_profile.get("id", ""),
            "senderName": sender_profile.get("name", ""),
            "message": str(message or "").strip(),
            "files": _serialize_file_summaries(files),
            "requestedAmount": _safe_float(requested_amount, 0),
            "approvedAmount": _safe_float(approved_amount, 0),
            "deliverySequence": _safe_int(delivery_sequence, 0),
            "createdAt": event_time,
        }
    )


def _build_myjob_document(proposal, now=None):
    timestamp = now or _now_utc()
    contract_amount = _contract_amount(proposal)
    total_paid_amount = _safe_float(proposal.get("totalPaidAmount"), 0)
    remaining_budget_amount = _remaining_contract_amount(
        {
            **proposal,
            "remainingBudgetAmount": proposal.get("remainingBudgetAmount", contract_amount),
            "totalPaidAmount": total_paid_amount,
        }
    )

    return {
        "proposalId": str(proposal.get("_id") or proposal.get("proposalId") or ""),
        "projectId": proposal.get("projectId", ""),
        "clientId": proposal.get("clientId", ""),
        "freelancerId": proposal.get("freelancerId", ""),
        "projectTitle": proposal.get("projectTitle", "Untitled Project"),
        "projectBudget": proposal.get("projectBudget"),
        "projectDeadlineDays": proposal.get("projectDeadlineDays"),
        "projectType": _normalize_project_type(proposal.get("projectType")),
        "pitch": proposal.get("pitch", ""),
        "bid": proposal.get("bid", 0),
        "duration": proposal.get("duration", ""),
        "milestonesEnabled": bool(proposal.get("milestonesEnabled")),
        "attachmentFileName": proposal.get("attachmentFileName", ""),
        "attachmentFileData": proposal.get("attachmentFileData", ""),
        "status": "active",
        "workflowStatus": _normalize_workflow_status(proposal.get("workflowStatus")),
        "etat": "accepted",
        "client": proposal.get("client", {}),
        "freelancer": proposal.get("freelancer", {}),
        "submittedBy": proposal.get("submittedBy", {}),
        "contractAmount": contract_amount,
        "currency": str(proposal.get("currency") or DEFAULT_CURRENCY).strip() or DEFAULT_CURRENCY,
        "deliverySequence": _safe_int(proposal.get("deliverySequence"), 0),
        "progressIncrementCount": _safe_int(proposal.get("progressIncrementCount"), 0),
        "deliveryMessage": str(proposal.get("deliveryMessage", "")).strip(),
        "deliveryFiles": _serialize_delivery_files(proposal.get("deliveryFiles")),
        "deliverySubmittedAt": proposal.get("deliverySubmittedAt"),
        "latestRequestedAmount": _safe_float(proposal.get("latestRequestedAmount"), 0),
        "latestDeliveryStatus": _normalize_delivery_status(proposal.get("latestDeliveryStatus")),
        "latestRevisionRequestMessage": str(proposal.get("latestRevisionRequestMessage", "")).strip(),
        "latestRevisionRequestedAt": proposal.get("latestRevisionRequestedAt"),
        "latestApprovedAmount": _safe_float(proposal.get("latestApprovedAmount"), 0),
        "lastPaidAmount": _safe_float(proposal.get("lastPaidAmount"), 0),
        "lastPaidAt": proposal.get("lastPaidAt"),
        "totalPaidAmount": total_paid_amount,
        "remainingBudgetAmount": remaining_budget_amount,
        "hasUnreadClientUpdate": bool(proposal.get("hasUnreadClientUpdate", False)),
        "hasUnreadFreelancerUpdate": bool(proposal.get("hasUnreadFreelancerUpdate", False)),
        "lastCommunicationType": str(proposal.get("lastCommunicationType", "")).strip(),
        "lastCommunicationAt": proposal.get("lastCommunicationAt"),
        "acceptedAt": proposal.get("acceptedAt") or timestamp,
        "updatedAt": timestamp,
    }


def create_myjob_freelancer_record(db, proposal, now=None):
    timestamp = now or _now_utc()
    document = _build_myjob_document(proposal, timestamp)

    db["MyJobFreelancer"].update_one(
        {"proposalId": document["proposalId"]},
        {
            "$set": document,
            "$setOnInsert": {"createdAt": timestamp},
        },
        upsert=True,
    )


def create_myjob_client_record(db, proposal, now=None):
    timestamp = now or _now_utc()
    document = _build_myjob_document(proposal, timestamp)

    db["MyJobClient"].update_one(
        {"proposalId": document["proposalId"]},
        {
            "$set": document,
            "$setOnInsert": {"createdAt": timestamp},
        },
        upsert=True,
    )


def _normalize_myjob_response(document, role):
    unread_field = _user_unread_field(role)

    return {
        "id": str(document.get("_id")),
        "proposalId": document.get("proposalId", ""),
        "projectId": document.get("projectId", ""),
        "clientId": document.get("clientId", ""),
        "freelancerId": document.get("freelancerId", ""),
        "projectTitle": document.get("projectTitle", "Untitled Project"),
        "projectBudget": document.get("projectBudget"),
        "projectDeadlineDays": document.get("projectDeadlineDays"),
        "projectType": _normalize_project_type(document.get("projectType")),
        "pitch": document.get("pitch", ""),
        "bid": document.get("bid", 0),
        "duration": document.get("duration", ""),
        "attachmentFileName": document.get("attachmentFileName", ""),
        "attachmentFileData": document.get("attachmentFileData", ""),
        "status": document.get("status", "active"),
        "workflowStatus": _normalize_workflow_status(document.get("workflowStatus")),
        "etat": document.get("etat", "accepted"),
        "client": document.get("client", {}),
        "freelancer": document.get("freelancer", {}),
        "contractAmount": _contract_amount(document),
        "currency": str(document.get("currency") or DEFAULT_CURRENCY).strip() or DEFAULT_CURRENCY,
        "deliverySequence": _safe_int(document.get("deliverySequence"), 0),
        "progressIncrementCount": _safe_int(document.get("progressIncrementCount"), 0),
        "deliveryMessage": str(document.get("deliveryMessage", "")).strip(),
        "deliveryFiles": _serialize_delivery_files(document.get("deliveryFiles")),
        "deliverySubmittedAtLabel": _format_relative_time(document.get("deliverySubmittedAt")),
        "latestRequestedAmount": _safe_float(document.get("latestRequestedAmount"), 0),
        "latestDeliveryStatus": _normalize_delivery_status(document.get("latestDeliveryStatus")),
        "latestRevisionRequestMessage": str(document.get("latestRevisionRequestMessage", "")).strip(),
        "latestRevisionRequestedAtLabel": _format_relative_time(document.get("latestRevisionRequestedAt")),
        "latestApprovedAmount": _safe_float(document.get("latestApprovedAmount"), 0),
        "lastPaidAmount": _safe_float(document.get("lastPaidAmount"), 0),
        "lastPaidAtLabel": _format_relative_time(document.get("lastPaidAt")),
        "totalPaidAmount": _safe_float(document.get("totalPaidAmount"), 0),
        "remainingBudgetAmount": _remaining_contract_amount(document),
        "hasUnreadUpdate": bool(document.get(unread_field, False)),
        "lastCommunicationType": str(document.get("lastCommunicationType", "")).strip(),
        "lastCommunicationAtLabel": _format_relative_time(document.get("lastCommunicationAt")),
        "acceptedAtLabel": _format_relative_time(document.get("acceptedAt") or document.get("createdAt")),
    }


def get_active_myjobs(db):
    user_id = (request.args.get("userId") or "").strip()
    role = (request.args.get("role") or "").strip().lower()

    if not user_id:
        return jsonify({"errors": {"userId": "User id is required"}}), 400

    if role not in {"client", "freelancer"}:
        return jsonify({"errors": {"role": "Role must be client or freelancer"}}), 400

    collection_name = _authorized_job_collection(role)
    user_field = "clientId" if role == "client" else "freelancerId"
    documents = db[collection_name].find({"status": "active", user_field: user_id}).sort("acceptedAt", -1)

    return jsonify([_normalize_myjob_response(document, role) for document in documents]), 200


def get_myjob_communications(db, proposal_id):
    user_id = (request.args.get("userId") or "").strip()
    role = (request.args.get("role") or "").strip().lower()

    if not user_id:
        return jsonify({"errors": {"userId": "User id is required"}}), 400

    if role not in {"client", "freelancer"}:
        return jsonify({"errors": {"role": "Role must be client or freelancer"}}), 400

    existing_job = _load_authorized_job(db, proposal_id, user_id, role)
    if not existing_job:
        return jsonify({"errors": {"proposalId": "Active task not found"}}), 404

    communications = []
    for document in db["MyJobCommunication"].find({"proposalId": proposal_id}).sort("createdAt", 1):
        communications.append(
            {
                "id": str(document.get("_id")),
                "eventType": str(document.get("eventType", "")).strip(),
                "senderRole": str(document.get("senderRole", "")).strip(),
                "senderName": str(document.get("senderName", "")).strip(),
                "message": str(document.get("message", "")).strip(),
                "files": document.get("files", []),
                "requestedAmount": _safe_float(document.get("requestedAmount"), 0),
                "approvedAmount": _safe_float(document.get("approvedAmount"), 0),
                "deliverySequence": _safe_int(document.get("deliverySequence"), 0),
                "createdAtLabel": _format_relative_time(document.get("createdAt")),
            }
        )

    return jsonify(communications), 200


def update_myjob_workflow_status(db, proposal_id):
    data = request.get_json() or {}
    user_id = (data.get("userId") or "").strip()
    role = (data.get("role") or "").strip().lower()
    workflow_status = _normalize_workflow_status(data.get("workflowStatus"))

    if not user_id:
        return jsonify({"errors": {"userId": "User id is required"}}), 400

    if role not in {"client", "freelancer"}:
        return jsonify({"errors": {"role": "Role must be client or freelancer"}}), 400

    if workflow_status not in ALLOWED_WORKFLOW_STATUSES:
        return jsonify({"errors": {"workflowStatus": "Workflow status is invalid"}}), 400

    existing_job = _load_authorized_job(db, proposal_id, user_id, role)
    if not existing_job:
        return jsonify({"errors": {"proposalId": "Active task not found"}}), 404

    now = _now_utc()
    _sync_job_update(
        db,
        proposal_id,
        {
            "workflowStatus": workflow_status,
            "updatedAt": now,
            "lastCommunicationType": "status-update",
            "lastCommunicationAt": now,
        },
    )

    return jsonify(
        {
            "message": f"Task status updated to {_workflow_status_label(workflow_status)}.",
            "workflowStatus": workflow_status,
        }
    ), 200


def deliver_myjob_assets(db, proposal_id):
    data = request.get_json() or {}
    user_id = (data.get("userId") or "").strip()
    role = (data.get("role") or "").strip().lower()
    delivery_message = str(data.get("deliveryMessage", "")).strip()
    delivery_files = _serialize_delivery_files(data.get("deliveryFiles"))
    requested_amount = _safe_float(data.get("requestedAmount"), 0)

    if not user_id:
        return jsonify({"errors": {"userId": "User id is required"}}), 400

    if role != "freelancer":
        return jsonify({"errors": {"role": "Only freelancers can deliver project assets"}}), 403

    if not delivery_files:
        return jsonify({"errors": {"deliveryFiles": "Please attach at least one delivery file"}}), 400

    total_delivery_bytes = sum(_estimate_data_url_size(file.get("fileData")) for file in delivery_files)
    if total_delivery_bytes > MAX_DELIVERY_BYTES:
        return jsonify(
            {
                "errors": {
                    "deliveryFiles": "Delivery files are too large. Keep the combined upload under 8MB."
                }
            }
        ), 400

    existing_job = _load_authorized_job(db, proposal_id, user_id, role)
    if not existing_job:
        return jsonify({"errors": {"proposalId": "Active task not found"}}), 404

    if _normalize_workflow_status(existing_job.get("workflowStatus")) == "completed":
        return jsonify({"errors": {"workflowStatus": "Completed projects cannot receive a new delivery"}}), 400

    project_type = _normalize_project_type(existing_job.get("projectType"))
    remaining_budget_amount = _remaining_contract_amount(existing_job)
    if project_type == "fixed-price":
        if requested_amount <= 0:
            return jsonify(
                {
                    "errors": {
                        "requestedAmount": "Fixed-price deliveries must include a requested release amount."
                    }
                }
            ), 400

        if remaining_budget_amount > 0 and requested_amount > remaining_budget_amount:
            return jsonify(
                {
                    "errors": {
                        "requestedAmount": f"Requested amount cannot exceed the remaining contract balance of ${remaining_budget_amount:.2f}."
                    }
                }
            ), 400

    delivery_sequence = _safe_int(existing_job.get("deliverySequence"), 0) + 1
    now = _now_utc()
    workflow_status = "in-review"
    update_payload = {
        "deliverySequence": delivery_sequence,
        "progressIncrementCount": delivery_sequence,
        "deliveryMessage": delivery_message,
        "deliveryFiles": delivery_files,
        "deliverySubmittedAt": now,
        "latestRequestedAmount": requested_amount,
        "latestDeliveryStatus": "submitted",
        "latestRevisionRequestMessage": "",
        "latestRevisionRequestedAt": None,
        "hasUnreadClientUpdate": True,
        "hasUnreadFreelancerUpdate": False,
        "lastCommunicationType": "delivery",
        "lastCommunicationAt": now,
        "workflowStatus": workflow_status,
        "updatedAt": now,
    }

    _sync_job_update(db, proposal_id, update_payload)
    _record_communication(
        db,
        existing_job,
        "delivery",
        "freelancer",
        message=delivery_message,
        files=delivery_files,
        requested_amount=requested_amount,
        delivery_sequence=delivery_sequence,
    )

    return jsonify(
        {
            "message": "Assets delivered successfully and moved to In Review.",
            "workflowStatus": workflow_status,
            "deliveryMessage": delivery_message,
            "deliveryFiles": delivery_files,
            "deliverySubmittedAtLabel": _format_relative_time(now),
            "deliverySequence": delivery_sequence,
            "progressIncrementCount": delivery_sequence,
            "latestRequestedAmount": requested_amount,
            "latestDeliveryStatus": "submitted",
            "hasUnreadClientUpdate": True,
        }
    ), 200


def request_myjob_revision(db, proposal_id):
    data = request.get_json() or {}
    user_id = (data.get("userId") or "").strip()
    role = (data.get("role") or "").strip().lower()
    revision_message = str(data.get("revisionMessage", "")).strip()

    if not user_id:
        return jsonify({"errors": {"userId": "User id is required"}}), 400

    if role != "client":
        return jsonify({"errors": {"role": "Only clients can request a revision"}}), 403

    if not revision_message:
        return jsonify({"errors": {"revisionMessage": "Please add revision notes before sending"}}), 400

    existing_job = _load_authorized_job(db, proposal_id, user_id, role)
    if not existing_job:
        return jsonify({"errors": {"proposalId": "Active task not found"}}), 404

    if _normalize_delivery_status(existing_job.get("latestDeliveryStatus")) != "submitted":
        return jsonify(
            {
                "errors": {
                    "latestDeliveryStatus": "A delivered submission is required before requesting a revision."
                }
            }
        ), 400

    now = _now_utc()
    workflow_status = "in-progress"
    update_payload = {
        "latestRevisionRequestMessage": revision_message,
        "latestRevisionRequestedAt": now,
        "latestDeliveryStatus": "revision-requested",
        "hasUnreadClientUpdate": False,
        "hasUnreadFreelancerUpdate": True,
        "lastCommunicationType": "revision-request",
        "lastCommunicationAt": now,
        "workflowStatus": workflow_status,
        "updatedAt": now,
    }

    _sync_job_update(db, proposal_id, update_payload)
    _record_communication(
        db,
        existing_job,
        "revision-request",
        "client",
        message=revision_message,
        delivery_sequence=_safe_int(existing_job.get("deliverySequence"), 0),
    )

    return jsonify(
        {
            "message": "Revision request sent to the freelancer.",
            "workflowStatus": workflow_status,
            "latestRevisionRequestMessage": revision_message,
            "latestRevisionRequestedAtLabel": _format_relative_time(now),
            "latestDeliveryStatus": "revision-requested",
            "hasUnreadFreelancerUpdate": True,
        }
    ), 200


def mark_myjob_updates_seen(db, proposal_id):
    data = request.get_json() or {}
    user_id = (data.get("userId") or "").strip()
    role = (data.get("role") or "").strip().lower()

    if not user_id:
        return jsonify({"errors": {"userId": "User id is required"}}), 400

    if role not in {"client", "freelancer"}:
        return jsonify({"errors": {"role": "Role must be client or freelancer"}}), 400

    existing_job = _load_authorized_job(db, proposal_id, user_id, role)
    if not existing_job:
        return jsonify({"errors": {"proposalId": "Active task not found"}}), 404

    unread_field = _user_unread_field(role)
    _sync_job_update(db, proposal_id, {unread_field: False, "updatedAt": _now_utc()})

    return jsonify({"message": "Updates marked as seen."}), 200

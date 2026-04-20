from datetime import datetime, timezone

from flask import jsonify, request


ALLOWED_WORKFLOW_STATUSES = {"in-progress", "in-review", "completed"}
ALLOWED_DELIVERY_STATUSES = {"none", "submitted", "revision-requested", "paid"}
ALLOWED_SPRINT_STATUSES = {"unpaid", "paid"}
MAX_DELIVERY_BYTES = 8 * 1024 * 1024
DEFAULT_CURRENCY = "USD"


def _now_utc():
    return datetime.now(timezone.utc)


def _format_relative_time(value):
    if not isinstance(value, datetime):
        return "Just now"
    created_at = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    diff = _now_utc() - created_at
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


def _normalize_workflow_status(value):
    normalized = (value or "").strip().lower()
    aliases = {"review": "in-review", "under-review": "in-review", "done": "completed", "complete": "completed"}
    return aliases.get(normalized, normalized) if normalized in ALLOWED_WORKFLOW_STATUSES or normalized in aliases else "in-progress"


def _workflow_status_label(value):
    return {"in-review": "In Review", "completed": "Completed"}.get(_normalize_workflow_status(value), "In Progress")


def _normalize_delivery_status(value):
    normalized = (value or "").strip().lower()
    if normalized in {"revision", "revision-request"}:
        return "revision-requested"
    return normalized if normalized in ALLOWED_DELIVERY_STATUSES else "none"


def _normalize_sprint_status(value):
    normalized = (value or "").strip().lower()
    return normalized if normalized in ALLOWED_SPRINT_STATUSES else "unpaid"


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
    return normalized if normalized in {"fixed-price", "hourly", "project"} else "project"


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
        if not file_name or not file_data:
            continue
        mime_type = str(item.get("mimeType", "")).strip()
        size_bytes = _safe_int(item.get("sizeBytes"), 0)
        estimated_size = _estimate_data_url_size(file_data)
        files.append({
            "fileName": file_name,
            "fileData": file_data,
            "mimeType": mime_type,
            "sizeBytes": size_bytes or estimated_size,
        })
    return files


def _serialize_file_summaries(files):
    return [
        {"fileName": f.get("fileName", ""), "mimeType": f.get("mimeType", ""), "sizeBytes": _safe_int(f.get("sizeBytes"), 0)}
        for f in _serialize_delivery_files(files)
    ]


def _contract_amount(document):
    bid = _safe_float(document.get("bid"), 0)
    return bid if bid > 0 else _safe_float(document.get("projectBudget"), 0)


def _remaining_contract_amount(document):
    stored = _safe_float(document.get("remainingBudgetAmount"), -1)
    if stored >= 0:
        return stored
    return max(round(_contract_amount(document) - _safe_float(document.get("totalPaidAmount"), 0), 2), 0)


def _user_unread_field(role):
    return "hasUnreadClientUpdate" if role == "client" else "hasUnreadFreelancerUpdate"


def _actor_profile(job, role):
    return job.get("client", {}) if role == "client" else job.get("freelancer", {})


def _authorized_job_collection(role):
    return "MyJobClient" if role == "client" else "MyJobFreelancer"


def _load_authorized_job(db, proposal_id, user_id, role):
    if role not in {"client", "freelancer"}:
        return None
    user_field = "clientId" if role == "client" else "freelancerId"
    return db[_authorized_job_collection(role)].find_one(
        {"proposalId": proposal_id, user_field: user_id, "status": "active"}
    )


def _sync_job_update(db, proposal_id, set_payload):
    update = {"$set": set_payload}
    db["MyJobClient"].update_one({"proposalId": proposal_id}, update)
    db["MyJobFreelancer"].update_one({"proposalId": proposal_id}, update)


def _record_communication(db, job, event_type, sender_role, message="", files=None,
                           requested_amount=0.0, approved_amount=0.0, delivery_sequence=0, payment_type="unpaid"):
    sender = _actor_profile(job, sender_role)
    db["MyJobCommunication"].insert_one({
        "proposalId": job.get("proposalId", ""),
        "projectId": job.get("projectId", ""),
        "clientId": job.get("clientId", ""),
        "freelancerId": job.get("freelancerId", ""),
        "eventType": event_type,
        "senderRole": sender_role,
        "senderId": sender.get("id", ""),
        "senderName": sender.get("name", ""),
        "message": str(message or "").strip(),
        "files": _serialize_file_summaries(files),
        "requestedAmount": _safe_float(requested_amount, 0),
        "approvedAmount": _safe_float(approved_amount, 0),
        "deliverySequence": _safe_int(delivery_sequence, 0),
        "paymentType": payment_type,
        "createdAt": _now_utc(),
    })


def _make_sprint(sprint_id, number, timestamp, **overrides):
    base = {
        "sprintId": sprint_id,
        "sprintNumber": number,
        "title": f"Sprint {number}",
        "description": "",
        "status": "unpaid",
        "price": 0,
        "deliveryMessage": "",
        "deliveryFiles": [],
        "submittedAt": None,
        "paidAt": None,
        "createdAt": timestamp,
        "updatedAt": timestamp,
    }
    base.update(overrides)
    return base


def _build_sprints(proposal, timestamp):
    existing = proposal.get("sprints", [])
    if existing:
        return [
            {
                "sprintId": str(s.get("sprintId", "")),
                "sprintNumber": _safe_int(s.get("sprintNumber"), 1),
                "title": str(s.get("title", f"Sprint {_safe_int(s.get('sprintNumber'), 1)}")).strip(),
                "description": str(s.get("description", "")).strip(),
                "status": _normalize_sprint_status(s.get("status")),
                "price": _safe_float(s.get("price"), 0),
                "deliveryMessage": str(s.get("deliveryMessage", "")).strip(),
                "deliveryFiles": _serialize_delivery_files(s.get("deliveryFiles")),
                "submittedAt": s.get("submittedAt"),
                "paidAt": s.get("paidAt"),
                "createdAt": s.get("createdAt", timestamp),
                "updatedAt": timestamp,
            }
            for s in existing
        ]
    return [_make_sprint(
        "sprint-1", 1, proposal.get("acceptedAt", timestamp),
        status=_normalize_sprint_status(proposal.get("latestDeliveryStatus")) if proposal.get("deliverySubmittedAt") else "unpaid",
        price=_safe_float(proposal.get("latestRequestedAmount"), 0),
        deliveryMessage=str(proposal.get("deliveryMessage", "")).strip(),
        deliveryFiles=_serialize_delivery_files(proposal.get("deliveryFiles")),
        submittedAt=proposal.get("deliverySubmittedAt"),
        paidAt=proposal.get("lastPaidAt") if proposal.get("lastPaidAmount", 0) > 0 else None,
        updatedAt=timestamp,
    )]


def _build_myjob_document(proposal, now=None):
    timestamp = now or _now_utc()
    contract_amount = _contract_amount(proposal)
    total_paid = _safe_float(proposal.get("totalPaidAmount"), 0)
    remaining = _remaining_contract_amount({
        **proposal,
        "remainingBudgetAmount": proposal.get("remainingBudgetAmount", contract_amount),
        "totalPaidAmount": total_paid,
    })
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
        "sprints": _build_sprints(proposal, timestamp),
        "totalPaidAmount": total_paid,
        "remainingBudgetAmount": remaining,
        "hasUnreadClientUpdate": bool(proposal.get("hasUnreadClientUpdate", False)),
        "hasUnreadFreelancerUpdate": bool(proposal.get("hasUnreadFreelancerUpdate", False)),
        "lastCommunicationType": str(proposal.get("lastCommunicationType", "")).strip(),
        "lastCommunicationAt": proposal.get("lastCommunicationAt"),
        "acceptedAt": proposal.get("acceptedAt") or timestamp,
        "updatedAt": timestamp,
    }


def _upsert_myjob(db, collection_name, proposal, now=None):
    timestamp = now or _now_utc()
    document = _build_myjob_document(proposal, timestamp)
    db[collection_name].update_one(
        {"proposalId": document["proposalId"]},
        {"$set": document, "$setOnInsert": {"createdAt": timestamp}},
        upsert=True,
    )


def create_myjob_freelancer_record(db, proposal, now=None):
    _upsert_myjob(db, "MyJobFreelancer", proposal, now)


def create_myjob_client_record(db, proposal, now=None):
    _upsert_myjob(db, "MyJobClient", proposal, now)


def _normalize_myjob_response(document, role, db):
    proposal_id = document.get("proposalId", "")
    # Build sprints from MyJobCommunication delivery records
    sprints = []
    sprint_number_to_sprint_id = {}
    # Pre-fetch all Sprint documents for this proposal to map sprintNumber -> sprintId
    for sprint_doc in db["Sprint"].find({"proposalId": proposal_id}).sort("sprintNumber", 1):
        sn = _safe_int(sprint_doc.get("sprintNumber"), 0)
        if sn > 0:
            sprint_number_to_sprint_id[sn] = str(sprint_doc.get("_id"))
    for comm in db["MyJobCommunication"].find({"proposalId": proposal_id, "eventType": "delivery"}).sort("deliverySequence", 1):
        sn = comm.get("deliverySequence", 0)
        sprint_entry = {
            "id": str(comm.get("_id")),
            "sprintId": sprint_number_to_sprint_id.get(sn, ""),  # Link to Sprint collection ID
            "sprintNumber": sn,
            "title": f"Sprint {sn}",
            "description": "",
            "status": "paid" if comm.get("approvedAmount", 0) > 0 else "unpaid",
            "price": _safe_float(comm.get("requestedAmount"), 0),
            "deliveryMessage": comm.get("message", ""),
            "deliveryFiles": _serialize_file_summaries(comm.get("files", [])),
            "submittedAtLabel": _format_relative_time(comm.get("createdAt")),
            "paidAtLabel": _format_relative_time(comm.get("paidAt") or comm.get("createdAt")) if comm.get("approvedAmount", 0) > 0 else None,
            "canAccessFiles": (comm.get("approvedAmount", 0) > 0) or role == "freelancer",
        }
        sprints.append(sprint_entry)
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
        "sprints": sprints,
        "totalPaidAmount": _safe_float(document.get("totalPaidAmount"), 0),
        "remainingBudgetAmount": _remaining_contract_amount(document),
        "hasUnreadUpdate": bool(document.get(_user_unread_field(role), False)),
        "lastCommunicationType": str(document.get("lastCommunicationType", "")).strip(),
        "lastCommunicationAtLabel": _format_relative_time(document.get("lastCommunicationAt")),
        "acceptedAtLabel": _format_relative_time(document.get("acceptedAt") or document.get("createdAt")),
    }


def _validate_user_role(data, allowed_roles=("client", "freelancer")):
    user_id = (data.get("userId") or "").strip()
    role = (data.get("role") or "").strip().lower()
    if not user_id:
        return None, None, jsonify({"errors": {"userId": "User id is required"}}), 400
    if role not in allowed_roles:
        msg = f"Role must be {' or '.join(allowed_roles)}" if len(allowed_roles) > 1 else f"Only {allowed_roles[0]}s can perform this action"
        return None, None, jsonify({"errors": {"role": msg}}), 403 if len(allowed_roles) == 1 else 400
    return user_id, role, None, None


def get_active_myjobs(db):
    user_id = (request.args.get("userId") or "").strip()
    role = (request.args.get("role") or "").strip().lower()
    if not user_id:
        return jsonify({"errors": {"userId": "User id is required"}}), 400
    if role not in {"client", "freelancer"}:
        return jsonify({"errors": {"role": "Role must be client or freelancer"}}), 400
    user_field = "clientId" if role == "client" else "freelancerId"
    docs = db[_authorized_job_collection(role)].find({"status": "active", user_field: user_id}).sort("acceptedAt", -1)
    return jsonify([_normalize_myjob_response(doc, role, db) for doc in docs]), 200


def get_myjob_detail(db, proposal_id):
    user_id = (request.args.get("userId") or "").strip()
    role = (request.args.get("role") or "").strip().lower()
    if not user_id:
        return jsonify({"errors": {"userId": "User id is required"}}), 400
    if role not in {"client", "freelancer"}:
        return jsonify({"errors": {"role": "Role must be client or freelancer"}}), 400
    doc = db[_authorized_job_collection(role)].find_one({"proposalId": proposal_id, "status": "active"})
    if not doc:
        return jsonify({"errors": {"proposalId": "Active task not found"}}), 404
    return jsonify(_normalize_myjob_response(doc, role, db)), 200


def get_myjob_communications(db, proposal_id):
    user_id = (request.args.get("userId") or "").strip()
    role = (request.args.get("role") or "").strip().lower()
    if not user_id:
        return jsonify({"errors": {"userId": "User id is required"}}), 400
    if role not in {"client", "freelancer"}:
        return jsonify({"errors": {"role": "Role must be client or freelancer"}}), 400
    if not _load_authorized_job(db, proposal_id, user_id, role):
        return jsonify({"errors": {"proposalId": "Active task not found"}}), 404
    communications = [
        {
            "id": str(doc.get("_id")),
            "eventType": str(doc.get("eventType", "")).strip(),
            "senderRole": str(doc.get("senderRole", "")).strip(),
            "senderName": str(doc.get("senderName", "")).strip(),
            "message": str(doc.get("message", "")).strip(),
            "files": doc.get("files", []),
            "requestedAmount": _safe_float(doc.get("requestedAmount"), 0),
            "approvedAmount": _safe_float(doc.get("approvedAmount"), 0),
            "deliverySequence": _safe_int(doc.get("deliverySequence"), 0),
            "createdAtLabel": _format_relative_time(doc.get("createdAt")),
        }
        for doc in db["MyJobCommunication"].find({"proposalId": proposal_id}).sort("createdAt", 1)
    ]
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
    if not _load_authorized_job(db, proposal_id, user_id, role):
        return jsonify({"errors": {"proposalId": "Active task not found"}}), 404
    now = _now_utc()
    _sync_job_update(db, proposal_id, {
        "workflowStatus": workflow_status,
        "updatedAt": now,
        "lastCommunicationType": "status-update",
        "lastCommunicationAt": now,
    })
    return jsonify({"message": f"Task status updated to {_workflow_status_label(workflow_status)}.", "workflowStatus": workflow_status}), 200


def deliver_myjob_assets(db, proposal_id):
    data = request.get_json() or {}
    user_id = (data.get("userId") or "").strip()
    role = (data.get("role") or "").strip().lower()
    sprint_id = (data.get("sprintId") or "").strip()
    delivery_message = str(data.get("deliveryMessage", "")).strip()
    delivery_files = _serialize_delivery_files(data.get("deliveryFiles"))
    requested_amount = _safe_float(data.get("requestedAmount"), 0)
    payment_type = (data.get("paymentType") or "").strip().lower()

    if not user_id:
        return jsonify({"errors": {"userId": "User id is required"}}), 400
    if role != "freelancer":
        return jsonify({"errors": {"role": "Only freelancers can deliver project assets"}}), 403
    if not delivery_files:
        return jsonify({"errors": {"deliveryFiles": "Please attach at least one delivery file"}}), 400
    if payment_type not in {"paid", "unpaid"}:
        return jsonify({"errors": {"paymentType": "Payment type must be 'paid' or 'unpaid'"}}), 400
    if payment_type == "paid" and requested_amount <= 0:
        return jsonify({"errors": {"requestedAmount": "Paid deliveries must include a requested release amount"}}), 400

    total_bytes = sum(_estimate_data_url_size(f.get("fileData")) for f in delivery_files)
    if total_bytes > MAX_DELIVERY_BYTES:
        return jsonify({"errors": {"deliveryFiles": "Delivery files are too large. Keep the combined upload under 8MB."}}), 400

    existing_job = _load_authorized_job(db, proposal_id, user_id, role)
    if not existing_job:
        return jsonify({"errors": {"proposalId": "Active task not found"}}), 404
    if _normalize_workflow_status(existing_job.get("workflowStatus")) == "completed":
        return jsonify({"errors": {"workflowStatus": "Completed projects cannot receive a new delivery"}}), 400

    project_type = _normalize_project_type(existing_job.get("projectType"))
    remaining = _remaining_contract_amount(existing_job)
    if project_type == "fixed-price" and requested_amount > 0 and remaining > 0 and requested_amount > remaining:
        return jsonify({"errors": {"requestedAmount": f"Requested amount cannot exceed the remaining contract balance of ${remaining:.2f}."}}), 400

    now = _now_utc()
    sprints = existing_job.get("sprints") or _build_sprints(existing_job, now)

    if sprint_id:
        target_sprint = next((s for s in sprints if s["sprintId"] == sprint_id), None)
        if not target_sprint:
            return jsonify({"errors": {"sprintId": "Sprint not found"}}), 404
    elif sprints and sprints[-1].get("submittedAt"):
        last_num = _safe_int(sprints[-1].get("sprintNumber"), 1)
        next_num = last_num + 1
        target_sprint = _make_sprint(f"sprint-{next_num}", next_num, now, price=requested_amount)
        sprints.append(target_sprint)
    elif sprints:
        target_sprint = sprints[-1]
    else:
        target_sprint = _make_sprint("sprint-1", 1, now, price=requested_amount)
        sprints.append(target_sprint)

    target_sprint.update({
        "deliveryMessage": delivery_message,
        "deliveryFiles": delivery_files,
        "submittedAt": now,
        "price": requested_amount,
        "status": "unpaid",
        "paymentStatus": "unpaid",
        "updatedAt": now,
    })

    # Ensure a corresponding Sprint document exists for this sprint
    sprint_number = target_sprint.get("sprintNumber")
    sprint_doc = {
        "proposalId": proposal_id,
        "projectId": existing_job.get("projectId", ""),
        "clientId": existing_job.get("clientId", ""),
        "freelancerId": existing_job.get("freelancerId", ""),
        "sprintNumber": sprint_number,
        "price": requested_amount,
        "paymentStatus": "unpaid",
        "deliveryMessage": delivery_message,
        "deliveryFiles": delivery_files,
        "deliveredAt": now,
        "paidAt": None,
        "createdAt": now,
        "updatedAt": now,
    }
    db["Sprint"].update_one(
        {"proposalId": proposal_id, "sprintNumber": sprint_number},
        {"$set": sprint_doc},
        upsert=True
    )

    _sync_job_update(db, proposal_id, {
        "sprints": sprints,
        "hasUnreadClientUpdate": True,
        "hasUnreadFreelancerUpdate": False,
        "lastCommunicationType": "delivery",
        "lastCommunicationAt": now,
        "workflowStatus": "in-review",
        "updatedAt": now,
    })
    _record_communication(db, existing_job, "delivery", "freelancer",
        message=delivery_message, files=delivery_files,
        requested_amount=requested_amount if payment_type == "paid" else 0,
        delivery_sequence=len(sprints), payment_type=payment_type)

    return jsonify({
        "message": "Assets delivered successfully and moved to In Review.",
        "workflowStatus": "in-review",
        "deliveryMessage": delivery_message,
        "deliveryFiles": delivery_files,
        "deliverySubmittedAtLabel": _format_relative_time(now),
        "deliverySequence": len(sprints),
        "progressIncrementCount": len(sprints),
        "latestRequestedAmount": requested_amount if payment_type == "paid" else 0,
        "latestPaymentType": payment_type,
        "latestDeliveryStatus": "submitted",
        "hasUnreadClientUpdate": True,
    }), 200


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
        return jsonify({"errors": {"latestDeliveryStatus": "A delivered submission is required before requesting a revision."}}), 400

    now = _now_utc()
    _sync_job_update(db, proposal_id, {
        "latestRevisionRequestMessage": revision_message,
        "latestRevisionRequestedAt": now,
        "latestDeliveryStatus": "revision-requested",
        "hasUnreadClientUpdate": False,
        "hasUnreadFreelancerUpdate": True,
        "lastCommunicationType": "revision-request",
        "lastCommunicationAt": now,
        "workflowStatus": "in-progress",
        "updatedAt": now,
    })
    _record_communication(db, existing_job, "revision-request", "client",
        message=revision_message, delivery_sequence=_safe_int(existing_job.get("deliverySequence"), 0))

    return jsonify({
        "message": "Revision request sent to the freelancer.",
        "workflowStatus": "in-progress",
        "latestRevisionRequestMessage": revision_message,
        "latestRevisionRequestedAtLabel": _format_relative_time(now),
        "latestDeliveryStatus": "revision-requested",
        "hasUnreadFreelancerUpdate": True,
    }), 200


def mark_myjob_updates_seen(db, proposal_id):
    data = request.get_json() or {}
    user_id = (data.get("userId") or "").strip()
    role = (data.get("role") or "").strip().lower()
    if not user_id:
        return jsonify({"errors": {"userId": "User id is required"}}), 400
    if role not in {"client", "freelancer"}:
        return jsonify({"errors": {"role": "Role must be client or freelancer"}}), 400
    if not _load_authorized_job(db, proposal_id, user_id, role):
        return jsonify({"errors": {"proposalId": "Active task not found"}}), 404
    _sync_job_update(db, proposal_id, {_user_unread_field(role): False, "updatedAt": _now_utc()})
    return jsonify({"message": "Updates marked as seen."}), 200


def mark_delivery_viewed(db, proposal_id):
    data = request.get_json() or {}
    user_id = (data.get("userId") or "").strip()
    role = (data.get("role") or "").strip().lower()
    if not user_id:
        return jsonify({"errors": {"userId": "User id is required"}}), 400
    if role != "client":
        return jsonify({"errors": {"role": "Only clients can mark deliveries as viewed"}}), 403
    if not _load_authorized_job(db, proposal_id, user_id, role):
        return jsonify({"errors": {"proposalId": "Active task not found"}}), 404
    _sync_job_update(db, proposal_id, {"latestDeliveryIsNew": False, "updatedAt": _now_utc()})
    return jsonify({"message": "Delivery marked as viewed"}), 200
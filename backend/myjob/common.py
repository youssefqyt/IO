from datetime import datetime, timezone


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
        {
            "fileName": item.get("fileName", ""),
            "mimeType": item.get("mimeType", ""),
            "sizeBytes": _safe_int(item.get("sizeBytes"), 0),
        }
        for item in _serialize_delivery_files(files)
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
    payment_type="unpaid",
):
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

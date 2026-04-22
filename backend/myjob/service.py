from flask import jsonify, request

from .common import (
    ALLOWED_WORKFLOW_STATUSES,
    MAX_DELIVERY_BYTES,
    _estimate_data_url_size,
    _format_relative_time,
    _load_authorized_job,
    _normalize_delivery_status,
    _normalize_project_type,
    _normalize_workflow_status,
    _now_utc,
    _record_communication,
    _remaining_contract_amount,
    _safe_float,
    _safe_int,
    _serialize_delivery_files,
    _sync_job_update,
    _user_unread_field,
    _workflow_status_label,
    _authorized_job_collection,
)
from .records import (
    _build_sprints,
    _make_sprint,
    _normalize_myjob_response,
)


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
    return jsonify([_normalize_myjob_response(doc, role) for doc in docs]), 200


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

    total_bytes = sum(_estimate_data_url_size(item.get("fileData")) for item in delivery_files)
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

    _sync_job_update(db, proposal_id, {
        "sprints": sprints,
        "hasUnreadClientUpdate": True,
        "hasUnreadFreelancerUpdate": False,
        "lastCommunicationType": "delivery",
        "lastCommunicationAt": now,
        "workflowStatus": "in-review",
        "updatedAt": now,
    })
    _record_communication(
        db,
        existing_job,
        "delivery",
        "freelancer",
        message=delivery_message,
        files=delivery_files,
        requested_amount=requested_amount if payment_type == "paid" else 0,
        delivery_sequence=len(sprints),
        payment_type=payment_type,
    )

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
    _record_communication(
        db,
        existing_job,
        "revision-request",
        "client",
        message=revision_message,
        delivery_sequence=_safe_int(existing_job.get("deliverySequence"), 0),
    )

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

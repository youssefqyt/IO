from datetime import datetime, timezone
from typing import Optional

from flask import jsonify, request
from bson import ObjectId

from myjob import (
    _safe_float,
    _safe_int,
    _serialize_delivery_files,
    _estimate_data_url_size,
    _load_authorized_job,
    _sync_job_update,
    _record_communication,
    _normalize_workflow_status,
    _workflow_status_label,
    _format_relative_time,
    DEFAULT_CURRENCY,
)

MAX_DELIVERY_BYTES = 8 * 1024 * 1024


def _now_utc():
    return datetime.now(timezone.utc)


def _normalize_payment_status(value):
    normalized = (value or "").strip().lower()
    if normalized in {"paid", "unpaid"}:
        return normalized
    return "unpaid"


def create_sprint(db, proposal_id: str):
    data = request.get_json() or {}
    user_id = (data.get("userId") or "").strip()
    role = (data.get("role") or "").strip().lower()
    delivery_message = str(data.get("deliveryMessage", "")).strip()
    delivery_files = _serialize_delivery_files(data.get("deliveryFiles"))
    sprint_price = _safe_float(data.get("sprintPrice"), 0)

    if not user_id:
        return jsonify({"errors": {"userId": "User id is required"}}), 400

    if role != "freelancer":
        return jsonify({"errors": {"role": "Only freelancers can deliver sprint assets"}}), 403

    if not delivery_files:
        return jsonify({"errors": {"deliveryFiles": "Please attach at least one delivery file"}}), 400

    if sprint_price <= 0:
        return jsonify({"errors": {"sprintPrice": "Sprint price must be greater than 0"}}), 400

    existing_job = _load_authorized_job(db, proposal_id, user_id, role)
    if not existing_job:
        return jsonify({"errors": {"proposalId": "Active task not found"}}), 404

    if _normalize_workflow_status(existing_job.get("workflowStatus")) == "completed":
        return jsonify({"errors": {"workflowStatus": "Completed projects cannot receive a new sprint"}}), 400

    contract_amount = _safe_float(existing_job.get("contractAmount"), 0)
    total_paid = _safe_float(existing_job.get("totalPaidAmount"), 0)
    if contract_amount > 0 and total_paid >= contract_amount:
        return jsonify({"errors": {"budget": "Contract budget has been fully paid. Cannot add more sprints."}}), 400

    sprint_sequence = _safe_int(existing_job.get("sprintCount"), 0) + 1
    now = _now_utc()

    sprint_doc = {
        "proposalId": proposal_id,
        "projectId": existing_job.get("projectId", ""),
        "clientId": existing_job.get("clientId", ""),
        "freelancerId": existing_job.get("freelancerId", ""),
        "sprintNumber": sprint_sequence,
        "price": sprint_price,
        "paymentStatus": "unpaid",
        "deliveryMessage": delivery_message,
        "deliveryFiles": delivery_files,
        "deliveredAt": now,
        "paidAt": None,
        "revisionRequestMessage": "",
        "revisionRequestedAt": None,
        "createdAt": now,
    }

    result = db["Sprint"].insert_one(sprint_doc)
    sprint_id = str(result.inserted_id)

    update_payload = {
        "sprintCount": sprint_sequence,
        "latestSprintId": sprint_id,
        "latestDeliveryStatus": "submitted",
        "latestRequestedAmount": sprint_price,
        "latestPaymentType": "unpaid",
        "latestDeliveryIsNew": True,
        "hasUnreadClientUpdate": True,
        "hasUnreadFreelancerUpdate": False,
        "lastCommunicationType": "delivery",
        "lastCommunicationAt": now,
        "workflowStatus": "in-review",
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
        requested_amount=sprint_price,
        delivery_sequence=sprint_sequence,
        payment_type="unpaid",
    )

    return jsonify({
        "message": "Sprint delivered successfully.",
        "sprint": {
            "id": sprint_id,
            "sprintNumber": sprint_sequence,
            "price": sprint_price,
            "paymentStatus": "unpaid",
            "deliveryMessage": delivery_message,
            "deliveryFiles": delivery_files,
            "deliveredAtLabel": _format_relative_time(now),
        },
        "workflowStatus": "in-review",
        "latestDeliveryStatus": "submitted",
    }), 200


def get_sprints_for_proposal(db, proposal_id: str):
    user_id = (request.args.get("userId") or "").strip()
    role = (request.args.get("role") or "").strip().lower()

    if not user_id:
        return jsonify({"errors": {"userId": "User id is required"}}), 400

    if role not in {"client", "freelancer"}:
        return jsonify({"errors": {"role": "Role must be client or freelancer"}}), 400

    existing_job = _load_authorized_job(db, proposal_id, user_id, role)
    if not existing_job:
        return jsonify({"errors": {"proposalId": "Active task not found"}}), 404

    sprints = []
    for sprint in db["Sprint"].find({"proposalId": proposal_id}).sort("sprintNumber", 1):
        files = _serialize_delivery_files(sprint.get("deliveryFiles"))
        paid_at = sprint.get("paidAt")
        is_paid = sprint.get("paymentStatus") == "paid"

        if role == "client" and not is_paid:
            for f in files:
                f.pop("fileData", None)

        sprints.append({
            "id": str(sprint.get("_id")),
            "sprintNumber": sprint.get("sprintNumber"),
            "price": sprint.get("price"),
            "status": sprint.get("paymentStatus", "unpaid"),
            "paymentStatus": sprint.get("paymentStatus", "unpaid"),
            "deliveryMessage": sprint.get("deliveryMessage", ""),
            "deliveryFiles": files,
            "deliveredAtLabel": _format_relative_time(sprint.get("deliveredAt")),
            "paidAtLabel": _format_relative_time(paid_at) if paid_at else None,
            "revisionRequestMessage": sprint.get("revisionRequestMessage", ""),
            "revisionRequestedAtLabel": _format_relative_time(sprint.get("revisionRequestedAt")) if sprint.get("revisionRequestedAt") else None,
        })

    return jsonify(sprints), 200


def get_sprints_by_filters(db):
    user_id = (request.args.get("userId") or "").strip()
    role = (request.args.get("role") or "").strip().lower()
    project_id = (request.args.get("projectId") or "").strip()
    client_id = (request.args.get("clientId") or "").strip()
    freelancer_id = (request.args.get("freelancerId") or "").strip()

    if not user_id:
        return jsonify({"errors": {"userId": "User id is required"}}), 400

    if role not in {"client", "freelancer"}:
        return jsonify({"errors": {"role": "Role must be client or freelancer"}}), 400

    if not project_id:
        return jsonify({"errors": {"projectId": "Project id is required"}}), 400

    if role == "client":
        client_id = user_id
    else:
        freelancer_id = user_id

    query = {"projectId": project_id}
    if client_id:
        query["clientId"] = client_id
    if freelancer_id:
        query["freelancerId"] = freelancer_id
        
    sprints = []
    for sprint in db["Sprint"].find(query).sort("sprintNumber", 1):
        files = _serialize_delivery_files(sprint.get("deliveryFiles"))
        paid_at = sprint.get("paidAt")
        is_paid = sprint.get("paymentStatus") == "paid"

        if role == "client" and not is_paid:
            for f in files:
                f.pop("fileData", None)

        sprints.append({
            "id": str(sprint.get("_id")),
            "sprintId": str(sprint.get("_id")),
            "sprintNumber": sprint.get("sprintNumber"),
            "title": f"Sprint {sprint.get('sprintNumber')}",
            "price": sprint.get("price"),
            "status": sprint.get("paymentStatus", "unpaid"),
            "paymentStatus": sprint.get("paymentStatus", "unpaid"),
            "deliveryMessage": sprint.get("deliveryMessage", ""),
            "deliveryFiles": files,
            "deliveredAt": sprint.get("deliveredAt"),
            "deliveredAtLabel": _format_relative_time(sprint.get("deliveredAt")),
            "paidAt": paid_at,
            "paidAtLabel": _format_relative_time(paid_at) if paid_at else None,
            "canAccessFiles": is_paid or role == "freelancer",
        })

    return jsonify(sprints), 200


def pay_sprint(db, sprint_id: str):
    data = request.get_json() or {}
    user_id = (data.get("userId") or "").strip()
    role = (data.get("role") or "").strip().lower()

    if not user_id:
        return jsonify({"errors": {"userId": "User id is required"}}), 400

    if role != "client":
        return jsonify({"errors": {"role": "Only clients can pay for sprints"}}), 403

    try:
        sprint_obj_id = ObjectId(sprint_id)
    except Exception:
        return jsonify({"errors": {"sprintId": "Invalid sprint id"}}), 400

    sprint = db["Sprint"].find_one({"_id": sprint_obj_id})
    if not sprint:
        return jsonify({"errors": {"sprintId": "Sprint not found"}}), 404

    proposal_id = sprint.get("proposalId")
    job = _load_authorized_job(db, proposal_id, user_id, role)
    if not job:
        return jsonify({"errors": {"proposalId": "Active task not found for this sprint"}}), 404

    if sprint.get("paymentStatus") == "paid":
        return jsonify({"errors": {"paymentStatus": "Sprint already paid"}}), 400

    amount_to_pay = sprint.get("price", 0)
    if amount_to_pay <= 0:
        return jsonify({"errors": {"price": "Sprint has invalid price"}}), 400

    from Pay import _validate_payment_payload, _charge_credit_card, DEFAULT_CURRENCY as PAY_DEFAULT_CURRENCY

    payment_payload = {
        "cardNumber": data.get("cardNumber"),
        "expiryDate": data.get("expiryDate"),
        "cvv": data.get("cvv"),
        "amount": amount_to_pay,
    }
    errors, card_number, expiry_date, cvv, amount = _validate_payment_payload(payment_payload)
    if errors:
        return jsonify({"errors": errors}), 400

    if amount != amount_to_pay:
        return jsonify({"errors": {"amount": f"Amount must match sprint price ${amount_to_pay:.2f}"}}), 400

    charge_result, error_response = _charge_credit_card(db, card_number, expiry_date, cvv, amount)
    if error_response:
        return error_response

    charged_at = charge_result["chargedAt"]
    card = charge_result["card"]

    sprint_update = db["Sprint"].update_one(
        {"_id": sprint_obj_id},
        {"$set": {"paymentStatus": "paid", "paidAt": charged_at}}
    )

    # Also update the corresponding MyJobCommunication delivery record to reflect payment
    sprint_number = sprint.get("sprintNumber")
    db["MyJobCommunication"].update_one(
        {
            "proposalId": proposal_id,
            "eventType": "delivery",
            "deliverySequence": sprint_number
        },
        {
            "$set": {
                "approvedAmount": amount,
                "paymentType": "paid",
                "paidAt": charged_at
            }
        }
    )

    current_total_paid = _safe_float(job.get("totalPaidAmount"), 0)
    new_total_paid = round(current_total_paid + amount, 2)
    contract_amount = _safe_float(job.get("contractAmount"), 0)
    remaining = max(round(contract_amount - new_total_paid, 2), 0)
    new_workflow = "completed" if remaining <= 0 else "in-progress"

    update_job_payload = {
        "totalPaidAmount": new_total_paid,
        "remainingBudgetAmount": remaining,
        "latestDeliveryStatus": "paid",
        "latestPaymentType": "paid",
        "latestApprovedAmount": amount,
        "lastPaidAmount": amount,
        "lastPaidAt": charged_at,
        "workflowStatus": new_workflow,
        "hasUnreadFreelancerUpdate": True,
        "hasUnreadClientUpdate": False,
        "lastCommunicationType": "payment",
        "lastCommunicationAt": charged_at,
        "updatedAt": charged_at,
    }
    _sync_job_update(db, proposal_id, update_job_payload)

    db["PaymentHistory"].insert_one({
        "paymentType": "myjob-release",
        "proposalId": proposal_id,
        "projectId": sprint.get("projectId", ""),
        "clientId": user_id,
        "freelancerId": sprint.get("freelancerId", ""),
        "projectTitle": job.get("projectTitle", ""),
        "deliverySequence": sprint.get("sprintNumber", 0),
        "sprintId": sprint_id,
        "cardId": str(card["_id"]),
        "cardLast4": charge_result["last4"],
        "amount": amount,
        "currency": str(job.get("currency") or PAY_DEFAULT_CURRENCY).strip() or PAY_DEFAULT_CURRENCY,
        "status": "paid",
        "paidAt": charged_at,
    })

    db["EarningFreelancer"].update_one(
        {"proposalId": proposal_id, "freelancerId": sprint.get("freelancerId", "")},
        {
            "$set": {
                "projectTitle": job.get("projectTitle", ""),
                "currency": str(job.get("currency") or PAY_DEFAULT_CURRENCY).strip() or PAY_DEFAULT_CURRENCY,
                "contractAmount": contract_amount,
                "totalEarned": new_total_paid,
                "remainingContractAmount": remaining,
                "lastPaidAmount": amount,
                "lastPaidAt": charged_at,
                "updatedAt": charged_at,
            },
            "$push": {
                "payments": {
                    "amount": amount,
                    "sprintNumber": sprint.get("sprintNumber", 0),
                    "sprintId": sprint_id,
                    "paidAt": charged_at,
                    "cardLast4": charge_result["last4"],
                }
            },
            "$setOnInsert": {"createdAt": charged_at},
        },
        upsert=True,
    )

    _record_communication(
        db,
        job,
        "payment",
        "client",
        message=f"Payment released for Sprint #{sprint.get('sprintNumber')}.",
        approved_amount=amount,
        delivery_sequence=sprint.get("sprintNumber", 0),
    )

    return jsonify({
        "message": f"Payment for Sprint #{sprint.get('sprintNumber')} released successfully.",
        "payment": {
            "amount": amount,
            "currency": str(job.get("currency") or PAY_DEFAULT_CURRENCY).strip() or PAY_DEFAULT_CURRENCY,
            "cardHolder": card.get("cardHolder", ""),
            "last4": charge_result["last4"],
        },
        "sprintId": sprint_id,
        "paymentStatus": "paid",
        "workflowStatus": new_workflow,
        "totalPaidAmount": new_total_paid,
        "remainingBudgetAmount": remaining,
    }), 200


def complete_project(db, proposal_id: str):
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

    if _normalize_workflow_status(existing_job.get("workflowStatus")) == "completed":
        return jsonify({"errors": {"workflowStatus": "Project already completed"}}), 400

    now = _now_utc()

    sprints_cursor = db["Sprint"].find({"proposalId": proposal_id}).sort("sprintNumber", 1)
    sprints_list = []
    for sprint in sprints_cursor:
        sprint_files = _serialize_delivery_files(sprint.get("deliveryFiles", []))
        sprints_list.append({
            "sprintNumber": sprint.get("sprintNumber"),
            "price": sprint.get("price"),
            "paymentStatus": sprint.get("paymentStatus"),
            "deliveryMessage": sprint.get("deliveryMessage", ""),
            "deliveryFiles": [
                {"fileName": f.get("fileName"), "mimeType": f.get("mimeType"), "sizeBytes": f.get("sizeBytes")}
                for f in sprint_files
            ],
            "deliveredAt": sprint.get("deliveredAt"),
            "paidAt": sprint.get("paidAt"),
        })

    project_history_doc = {
        "proposalId": proposal_id,
        "projectId": existing_job.get("projectId", ""),
        "clientId": existing_job.get("clientId", ""),
        "freelancerId": existing_job.get("freelancerId", ""),
        "projectTitle": existing_job.get("projectTitle", ""),
        "contractAmount": _safe_float(existing_job.get("contractAmount"), 0),
        "totalPaidAmount": _safe_float(existing_job.get("totalPaidAmount"), 0),
        "currency": str(existing_job.get("currency") or DEFAULT_CURRENCY).strip() or DEFAULT_CURRENCY,
        "workflowStatus": "completed",
        "completedAt": now,
        "sprints": sprints_list,
        "createdAt": now,
    }

    db["ProjectHistory"].insert_one(project_history_doc)

    db["MyJobClient"].delete_many({"proposalId": proposal_id})
    db["MyJobFreelancer"].delete_many({"proposalId": proposal_id})

    db["Sprint"].delete_many({"proposalId": proposal_id})

    # Optionally archive communications or keep them? They are still in MyJobCommunication, which might be okay to keep for history.
    # We could also delete communications, but requirement says only remove from active tables. Keep communications.

    return jsonify({
        "message": "Project completed successfully and moved to history.",
        "historyId": str(project_history_doc.get("_id")),
    }), 200


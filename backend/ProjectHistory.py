from datetime import datetime, timezone
from flask import jsonify, request
from myjob import _load_authorized_job, _sync_job_update, _now_utc, _contract_amount, _safe_float


def complete_project(db, proposal_id):
    data = request.get_json() or {}
    user_id = (data.get("userId") or "").strip()
    role = (data.get("role") or "").strip().lower()

    if not user_id:
        return jsonify({"errors": {"userId": "User id is required"}}), 400

    if role not in {"client", "freelancer"}:
        return jsonify({"errors": {"role": "Role must be client or freelancer"}}), 403

    existing_job = _load_authorized_job(db, proposal_id, user_id, role)
    if not existing_job:
        return jsonify({"errors": {"proposalId": "Active project not found"}}), 404

    # Check if all sprints are paid
    sprints = existing_job.get("sprints", [])
    unpaid_sprints = [s for s in sprints if s.get("status") == "unpaid" and s.get("submittedAt")]
    if unpaid_sprints:
        return jsonify({"errors": {"sprints": "All submitted sprints must be paid before completing the project"}}), 400

    # Calculate total price (sum of all sprint prices)
    total_price = sum(_safe_float(s.get("price", 0)) for s in sprints)

    completion_date = _now_utc()

    # Create history record
    history_record = {
        "projectId": existing_job.get("projectId", ""),
        "clientId": existing_job.get("clientId", ""),
        "freelancerId": existing_job.get("freelancerId", ""),
        "projectTitle": existing_job.get("projectTitle", "Untitled Project"),
        "totalPrice": total_price,
        "completionDate": completion_date,
        "contractAmount": _contract_amount(existing_job),
        "totalPaidAmount": _safe_float(existing_job.get("totalPaidAmount"), 0),
        "currency": existing_job.get("currency", "USD"),
        "sprintSummaries": [
            {
                "sprintId": s.get("sprintId", ""),
                "sprintNumber": s.get("sprintNumber", 1),
                "title": s.get("title", ""),
                "price": _safe_float(s.get("price", 0)),
                "status": s.get("status", "unpaid"),
                "submittedAt": s.get("submittedAt"),
                "paidAt": s.get("paidAt"),
            }
            for s in sprints
        ],
        "createdAt": completion_date,
    }

    # Insert into ProjectHistory
    db["ProjectHistory"].insert_one(history_record)

    # Remove from active tables
    db["MyJobClient"].delete_one({"proposalId": proposal_id})
    db["MyJobFreelancer"].delete_one({"proposalId": proposal_id})

    # Remove related payment records (optional, or archive them)
    # For now, we'll keep PaymentHistory for records

    return jsonify({
        "message": "Project completed successfully and moved to history",
        "completionDate": completion_date.isoformat(),
        "totalPrice": total_price,
    }), 200


def get_project_history(db):
    user_id = (request.args.get("userId") or "").strip()
    role = (request.args.get("role") or "").strip().lower()

    if not user_id:
        return jsonify({"errors": {"userId": "User id is required"}}), 400

    if role not in {"client", "freelancer"}:
        return jsonify({"errors": {"role": "Role must be client or freelancer"}}), 400

    user_field = "clientId" if role == "client" else "freelancerId"
    history_records = db["ProjectHistory"].find({user_field: user_id}).sort("completionDate", -1)

    result = []
    for record in history_records:
        result.append({
            "id": str(record.get("_id")),
            "projectId": record.get("projectId", ""),
            "clientId": record.get("clientId", ""),
            "freelancerId": record.get("freelancerId", ""),
            "projectTitle": record.get("projectTitle", "Untitled Project"),
            "totalPrice": _safe_float(record.get("totalPrice"), 0),
            "completionDate": record.get("completionDate"),
            "contractAmount": _safe_float(record.get("contractAmount"), 0),
            "totalPaidAmount": _safe_float(record.get("totalPaidAmount"), 0),
            "currency": record.get("currency", "USD"),
            "sprintCount": len(record.get("sprintSummaries", [])),
        })

    return jsonify(result), 200

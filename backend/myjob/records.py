from .common import (
    DEFAULT_CURRENCY,
    _contract_amount,
    _format_relative_time,
    _normalize_project_type,
    _normalize_sprint_status,
    _normalize_workflow_status,
    _now_utc,
    _remaining_contract_amount,
    _safe_float,
    _safe_int,
    _serialize_delivery_files,
    _serialize_file_summaries,
    _user_unread_field,
)


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
        "sprint-1",
        1,
        proposal.get("acceptedAt", timestamp),
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


def _normalize_myjob_response(document, role):
    sprints = [
        {
            "sprintId": s.get("sprintId", ""),
            "sprintNumber": s.get("sprintNumber", 1),
            "title": s.get("title", ""),
            "description": s.get("description", ""),
            "status": _normalize_sprint_status(s.get("status")),
            "price": _safe_float(s.get("price"), 0),
            "deliveryMessage": s.get("deliveryMessage", ""),
            "deliveryFiles": _serialize_file_summaries(s.get("deliveryFiles", [])),
            "submittedAtLabel": _format_relative_time(s.get("submittedAt")),
            "paidAtLabel": _format_relative_time(s.get("paidAt")),
            "canAccessFiles": s.get("status") == "paid" or role == "freelancer",
        }
        for s in document.get("sprints", [])
    ]
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

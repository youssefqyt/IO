from datetime import datetime, timezone

from bson import ObjectId
from flask import jsonify, request


def _now_utc():
    return datetime.now(timezone.utc)


def _safe_rating(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _safe_float(value, default=0.0):
    try:
        return round(float(value), 2)
    except (TypeError, ValueError):
        return round(float(default), 2)


def _find_project_document(db, project_id):
    if not project_id or not ObjectId.is_valid(project_id):
        return None
    return db["Project"].find_one({"_id": ObjectId(project_id)})


def _find_history_record(db, proposal_id="", project_id="", client_id="", freelancer_id=""):
    queries = []

    if project_id and client_id and freelancer_id:
        queries.append({
            "projectId": project_id,
            "clientId": client_id,
            "freelancerId": freelancer_id,
        })

    if proposal_id and client_id and freelancer_id:
        queries.append({
            "proposalId": proposal_id,
            "clientId": client_id,
            "freelancerId": freelancer_id,
        })

    if project_id:
        queries.append({"projectId": project_id})

    if proposal_id:
        queries.append({"proposalId": proposal_id})

    for query in queries:
        history_record = db["ProjectHistory"].find_one(query)
        if history_record:
            return history_record

    return None


def _resolve_project_metadata(
    db,
    proposal_id="",
    project_id="",
    project_title="",
    client_id="",
    freelancer_id="",
    project_category="",
    project_price=None,
):
    history_record = _find_history_record(
        db,
        proposal_id=proposal_id,
        project_id=project_id,
        client_id=client_id,
        freelancer_id=freelancer_id,
    )
    project_document = _find_project_document(db, project_id)

    resolved_title = (
        str(project_title or "").strip()
        or str((history_record or {}).get("projectTitle") or "").strip()
        or str((project_document or {}).get("title") or "").strip()
        or "Untitled Project"
    )

    resolved_category = (
        str(project_category or "").strip()
        or str((history_record or {}).get("projectCategory") or "").strip()
        or str((project_document or {}).get("category") or "").strip()
    )

    resolved_price = _safe_float(project_price, 0)
    if resolved_price <= 0:
        for candidate in (
            (history_record or {}).get("totalPrice"),
            (history_record or {}).get("contractAmount"),
            (project_document or {}).get("budget"),
        ):
            resolved_price = _safe_float(candidate, 0)
            if resolved_price > 0:
                break

    return {
        "historyRecord": history_record,
        "projectTitle": resolved_title,
        "projectCategory": resolved_category,
        "projectPrice": resolved_price,
    }


def _build_review_payload(document):
    professionalism = _safe_rating(document.get("professionalismRating"))
    quality_of_code = _safe_rating(document.get("qualityOfCodeRating"))
    overall_rating = document.get("overallRating")
    if overall_rating is None:
        overall_rating = round((professionalism + quality_of_code) / 2, 2)

    created_at = document.get("createdAt")
    updated_at = document.get("updatedAt") or created_at

    return {
        "id": str(document.get("_id")),
        "proposalId": document.get("proposalId", ""),
        "projectId": document.get("projectId", ""),
        "projectTitle": document.get("projectTitle", "Untitled Project"),
        "projectCategory": document.get("projectCategory", ""),
        "projectPrice": _safe_float(document.get("projectPrice"), 0),
        "clientId": document.get("clientId", ""),
        "freelancerId": document.get("freelancerId", ""),
        "professionalismRating": professionalism,
        "qualityOfCodeRating": quality_of_code,
        "overallRating": overall_rating,
        "createdAt": created_at,
        "updatedAt": updated_at,
    }


def create_or_update_rate(db):
    data = request.get_json() or {}

    user_id = str(data.get("userId") or "").strip()
    role = str(data.get("role") or "").strip().lower()
    proposal_id = str(data.get("proposalId") or "").strip()
    project_id = str(data.get("projectId") or "").strip()
    project_title = str(data.get("projectTitle") or "").strip()
    project_category = str(data.get("projectCategory") or "").strip()
    project_price = data.get("projectPrice")
    client_id = str(data.get("clientId") or "").strip()
    freelancer_id = str(data.get("freelancerId") or "").strip()

    professionalism_rating = _safe_rating(data.get("professionalismRating"))
    quality_of_code_rating = _safe_rating(data.get("qualityOfCodeRating"))

    errors = {}

    if not user_id:
        errors["userId"] = "User id is required"

    if role != "client":
        errors["role"] = "Only clients can rate freelancers after project completion"

    if not proposal_id and not project_id:
        errors["project"] = "Proposal id or project id is required"

    if not client_id:
        errors["clientId"] = "Client id is required"

    if not freelancer_id:
        errors["freelancerId"] = "Freelancer id is required"

    if client_id and user_id and client_id != user_id:
        errors["clientId"] = "Client id must match the authenticated user"

    if professionalism_rating < 1 or professionalism_rating > 5:
        errors["professionalismRating"] = "Professionalism rating must be between 1 and 5"

    if quality_of_code_rating < 1 or quality_of_code_rating > 5:
        errors["qualityOfCodeRating"] = "Quality of code rating must be between 1 and 5"

    if errors:
        return jsonify({"errors": errors}), 400

    project_metadata = _resolve_project_metadata(
        db,
        proposal_id=proposal_id,
        project_id=project_id,
        project_title=project_title,
        client_id=client_id,
        freelancer_id=freelancer_id,
        project_category=project_category,
        project_price=project_price,
    )
    history_record = project_metadata["historyRecord"]
    if history_record:
        proposal_id = proposal_id or str(history_record.get("proposalId", "")).strip()
        project_id = project_id or str(history_record.get("projectId", "")).strip()
        client_id = str(history_record.get("clientId", client_id)).strip()
        freelancer_id = str(history_record.get("freelancerId", freelancer_id)).strip()

    project_title = project_metadata["projectTitle"]
    project_category = project_metadata["projectCategory"]
    project_price = project_metadata["projectPrice"]

    overall_rating = round((professionalism_rating + quality_of_code_rating) / 2, 2)
    now = _now_utc()

    review_filter = {
        "clientId": client_id,
        "freelancerId": freelancer_id,
    }
    if proposal_id:
        review_filter["proposalId"] = proposal_id
    else:
        review_filter["projectId"] = project_id

    db["Rate"].update_one(
        review_filter,
        {
            "$set": {
                "proposalId": proposal_id,
                "projectId": project_id,
                "projectTitle": project_title or "Untitled Project",
                "projectCategory": project_category,
                "projectPrice": _safe_float(project_price, 0),
                "clientId": client_id,
                "freelancerId": freelancer_id,
                "professionalismRating": professionalism_rating,
                "qualityOfCodeRating": quality_of_code_rating,
                "overallRating": overall_rating,
                "updatedAt": now,
            },
            "$setOnInsert": {
                "createdAt": now,
            }
        },
        upsert=True
    )

    saved_review = db["Rate"].find_one(review_filter)
    if not saved_review:
        return jsonify({"errors": {"review": "Unable to save review right now"}}), 500

    return jsonify({
        "message": "Freelancer review saved successfully.",
        "review": _build_review_payload(saved_review),
    }), 200


def get_reviews(db):
    freelancer_id = str(request.args.get("freelancerId") or "").strip()

    if not freelancer_id:
        return jsonify({"errors": {"freelancerId": "Freelancer id is required"}}), 400

    reviews = []
    professionalism_total = 0
    quality_total = 0
    overall_total = 0

    for document in db["Rate"].find({"freelancerId": freelancer_id}).sort("updatedAt", -1):
        normalized_document = dict(document)
        if not str(normalized_document.get("projectCategory") or "").strip() or _safe_float(normalized_document.get("projectPrice"), 0) <= 0:
            project_metadata = _resolve_project_metadata(
                db,
                proposal_id=str(normalized_document.get("proposalId") or "").strip(),
                project_id=str(normalized_document.get("projectId") or "").strip(),
                project_title=str(normalized_document.get("projectTitle") or "").strip(),
                client_id=str(normalized_document.get("clientId") or "").strip(),
                freelancer_id=str(normalized_document.get("freelancerId") or "").strip(),
                project_category=str(normalized_document.get("projectCategory") or "").strip(),
                project_price=normalized_document.get("projectPrice"),
            )
            normalized_document["projectTitle"] = project_metadata["projectTitle"]
            normalized_document["projectCategory"] = project_metadata["projectCategory"]
            normalized_document["projectPrice"] = project_metadata["projectPrice"]

        review = _build_review_payload(normalized_document)
        reviews.append(review)
        professionalism_total += review["professionalismRating"]
        quality_total += review["qualityOfCodeRating"]
        overall_total += review["overallRating"]

    total_reviews = len(reviews)

    summary = {
        "totalReviews": total_reviews,
        "averageProfessionalism": round(professionalism_total / total_reviews, 2) if total_reviews else 0,
        "averageQualityOfCode": round(quality_total / total_reviews, 2) if total_reviews else 0,
        "averageOverallRating": round(overall_total / total_reviews, 2) if total_reviews else 0,
    }

    return jsonify({
        "summary": summary,
        "reviews": reviews,
    }), 200

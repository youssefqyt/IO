from datetime import datetime, timezone

from flask import jsonify, request

from Myjob import (
    DEFAULT_CURRENCY,
    _contract_amount,
    _format_relative_time,
    _load_authorized_job,
    _normalize_delivery_status,
    _record_communication,
    _remaining_contract_amount,
    _safe_float,
    _sync_job_update,
)


def _normalize_card_number(value):
    return "".join(character for character in str(value or "") if character.isdigit())


def _normalize_expiry(value):
    return str(value or "").strip()


def _normalize_cvv(value):
    return str(value or "").strip()


def _seed_example_credit_card_if_needed(db):
    collection = db["CreditCard"]
    if collection.count_documents({}, limit=1):
        return

    now = datetime.now(timezone.utc)
    collection.insert_one(
        {
            "cardHolder": "Demo User",
            "cardNumber": "4242424242424242",
            "expiryDate": "12/30",
            "cvv": "123",
            "bucks": 5000.00,
            "currency": DEFAULT_CURRENCY,
            "createdAt": now,
            "updatedAt": now,
            "note": "Example credit card for checkout testing",
        }
    )


def _validate_payment_payload(data):
    errors = {}

    card_number = _normalize_card_number(data.get("cardNumber"))
    expiry_date = _normalize_expiry(data.get("expiryDate"))
    cvv = _normalize_cvv(data.get("cvv"))
    amount = data.get("amount")

    if len(card_number) != 16:
        errors["cardNumber"] = "Card number must contain 16 digits"

    if len(expiry_date) != 5 or expiry_date[2] != "/":
        errors["expiryDate"] = "Expiry date must use MM/YY format"
    else:
        month, year = expiry_date.split("/", 1)
        if not (month.isdigit() and year.isdigit() and 1 <= int(month) <= 12 and len(year) == 2):
            errors["expiryDate"] = "Expiry date must use a valid MM/YY value"

    if not (cvv.isdigit() and len(cvv) in {3, 4}):
        errors["cvv"] = "CVV must contain 3 or 4 digits"

    if amount in (None, ""):
        errors["amount"] = "Amount is required"
        normalized_amount = None
    else:
        try:
            normalized_amount = round(float(amount), 2)
            if normalized_amount <= 0:
                errors["amount"] = "Amount must be greater than 0"
        except (TypeError, ValueError):
            errors["amount"] = "Amount must be a valid number"
            normalized_amount = None

    return errors, card_number, expiry_date, cvv, normalized_amount


def _charge_credit_card(db, card_number, expiry_date, cvv, amount):
    _seed_example_credit_card_if_needed(db)
    cards = db["CreditCard"]
    card = cards.find_one(
        {
            "cardNumber": card_number,
            "expiryDate": expiry_date,
            "cvv": cvv,
        }
    )

    if not card:
        return None, (
            jsonify(
                {
                    "message": "Payment failed",
                    "errors": {
                        "cardNumber": "Credit card not found. Example test card: 4242 4242 4242 4242, expiry 12/30, cvv 123"
                    },
                }
            ),
            404,
        )

    available_bucks = round(float(card.get("bucks", 0)), 2)
    if available_bucks < amount:
        return None, (
            jsonify(
                {
                    "message": "Payment failed",
                    "errors": {
                        "amount": f"Not enough bucks on this card. Available balance: ${available_bucks:.2f}"
                    },
                    "card": {
                        "cardHolder": card.get("cardHolder", ""),
                        "last4": card_number[-4:],
                        "bucks": available_bucks,
                    },
                }
            ),
            400,
        )

    remaining_bucks = round(available_bucks - amount, 2)
    now = datetime.now(timezone.utc)

    cards.update_one(
        {"_id": card["_id"]},
        {
            "$set": {
                "bucks": remaining_bucks,
                "updatedAt": now,
            }
        },
    )

    return {
        "card": card,
        "last4": card_number[-4:],
        "remainingBucks": remaining_bucks,
        "chargedAt": now,
    }, None


def pay_product(db):
    data = request.get_json() or {}
    errors, card_number, expiry_date, cvv, amount = _validate_payment_payload(data)

    if errors:
        return jsonify({"errors": errors}), 400

    charge_result, error_response = _charge_credit_card(db, card_number, expiry_date, cvv, amount)
    if error_response:
        return error_response

    card = charge_result["card"]
    charged_at = charge_result["chargedAt"]

    db["PaymentHistory"].insert_one(
        {
            "paymentType": "marketplace-product",
            "cardId": str(card["_id"]),
            "cardLast4": charge_result["last4"],
            "productTitle": str(data.get("productTitle", "")).strip(),
            "amount": amount,
            "currency": DEFAULT_CURRENCY,
            "status": "paid",
            "paidAt": charged_at,
        }
    )

    return jsonify(
        {
            "message": "Payment completed successfully",
            "payment": {
                "amount": amount,
                "currency": DEFAULT_CURRENCY,
                "cardHolder": card.get("cardHolder", ""),
                "last4": charge_result["last4"],
                "remainingBucks": charge_result["remainingBucks"],
            },
            "exampleCard": {
                "cardNumber": "4242 4242 4242 4242",
                "expiryDate": "12/30",
                "cvv": "123",
            },
        }
    ), 200


def release_myjob_payment(db, proposal_id):
    data = request.get_json() or {}
    user_id = (data.get("userId") or "").strip()
    role = (data.get("role") or "").strip().lower()
    sprint_id = (data.get("sprintId") or "").strip()

    if not user_id:
        return jsonify({"errors": {"userId": "User id is required"}}), 400

    if role != "client":
        return jsonify({"errors": {"role": "Only clients can approve and pay for a delivery"}}), 403

    existing_job = _load_authorized_job(db, proposal_id, user_id, role)
    if not existing_job:
        return jsonify({"errors": {"proposalId": "Active task not found"}}), 404

    # Get sprints
    sprints = existing_job.get("sprints", [])
    if not sprints:
        return jsonify({"errors": {"sprints": "No sprints found for this project"}}), 400

    target_sprint = None
    if sprint_id:
        target_sprint = next((s for s in sprints if s["sprintId"] == sprint_id), None)
    else:
        # Find the first unpaid submitted sprint
        target_sprint = next((s for s in sprints if s.get("status") == "unpaid" and s.get("submittedAt")), None)

    if not target_sprint:
        return jsonify({"errors": {"sprintId": "No payable sprint found"}}), 400

    if target_sprint.get("status") != "unpaid":
        return jsonify({"errors": {"sprintId": "Sprint is not in unpaid status"}}), 400

    if not target_sprint.get("submittedAt"):
        return jsonify({"errors": {"sprintId": "Sprint has no submitted delivery"}}), 400

    requested_amount = _safe_float(data.get("amount"), target_sprint.get("price", 0))
    if requested_amount <= 0:
        return jsonify({"errors": {"amount": "Payment amount must be greater than 0"}}), 400

    remaining_budget_amount = _remaining_contract_amount(existing_job)
    if remaining_budget_amount > 0 and requested_amount > remaining_budget_amount:
        return jsonify(
            {
                "errors": {
                    "amount": f"Payment amount cannot exceed the remaining contract balance of ${remaining_budget_amount:.2f}"
                }
            }
        ), 400

    payment_payload = {
        "cardNumber": data.get("cardNumber"),
        "expiryDate": data.get("expiryDate"),
        "cvv": data.get("cvv"),
        "amount": requested_amount,
    }
    errors, card_number, expiry_date, cvv, amount = _validate_payment_payload(payment_payload)
    if errors:
        return jsonify({"errors": errors}), 400

    charge_result, error_response = _charge_credit_card(db, card_number, expiry_date, cvv, amount)
    if error_response:
        return error_response

    charged_at = charge_result["chargedAt"]
    card = charge_result["card"]
    contract_amount = _contract_amount(existing_job)
    previous_total_paid = _safe_float(existing_job.get("totalPaidAmount"), 0)
    total_paid_amount = round(previous_total_paid + amount, 2)
    remaining_contract_amount = max(round(contract_amount - total_paid_amount, 2), 0)
    workflow_status = "completed" if remaining_contract_amount <= 0 else "in-progress"

    # Update sprint status
    target_sprint["status"] = "paid"
    target_sprint["paidAt"] = charged_at
    target_sprint["updatedAt"] = charged_at

    update_payload = {
        "sprints": sprints,
        "lastPaidAmount": amount,
        "lastPaidAt": charged_at,
        "totalPaidAmount": total_paid_amount,
        "remainingBudgetAmount": remaining_contract_amount,
        "hasUnreadClientUpdate": False,
        "hasUnreadFreelancerUpdate": True,
        "lastCommunicationType": "payment",
        "lastCommunicationAt": charged_at,
        "workflowStatus": workflow_status,
        "updatedAt": charged_at,
    }
    _sync_job_update(db, proposal_id, update_payload)

    db["PaymentHistory"].insert_one(
        {
            "paymentType": "myjob-release",
            "proposalId": proposal_id,
            "projectId": existing_job.get("projectId", ""),
            "clientId": existing_job.get("clientId", ""),
            "freelancerId": existing_job.get("freelancerId", ""),
            "projectTitle": existing_job.get("projectTitle", ""),
            "sprintId": target_sprint["sprintId"],
            "sprintNumber": target_sprint["sprintNumber"],
            "cardId": str(card["_id"]),
            "cardLast4": charge_result["last4"],
            "amount": amount,
            "currency": str(existing_job.get("currency") or DEFAULT_CURRENCY).strip() or DEFAULT_CURRENCY,
            "status": "paid",
            "paidAt": charged_at,
        }
    )

    db["EarningFreelancer"].update_one(
        {
            "proposalId": proposal_id,
            "projectId": existing_job.get("projectId", ""),
            "clientId": existing_job.get("clientId", ""),
            "freelancerId": existing_job.get("freelancerId", ""),
        },
        {
            "$set": {
                "projectTitle": existing_job.get("projectTitle", ""),
                "currency": str(existing_job.get("currency") or DEFAULT_CURRENCY).strip() or DEFAULT_CURRENCY,
                "contractAmount": contract_amount,
                "totalEarned": total_paid_amount,
                "remainingContractAmount": remaining_contract_amount,
                "lastPaidAmount": amount,
                "lastPaidAt": charged_at,
                "updatedAt": charged_at,
            },
            "$push": {
                "payments": {
                    "amount": amount,
                    "deliverySequence": existing_job.get("deliverySequence", 0),
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
        existing_job,
        "payment",
        "client",
        message="Payment released successfully.",
        approved_amount=amount,
        delivery_sequence=existing_job.get("deliverySequence", 0),
    )

    return jsonify(
        {
            "message": "Delivery approved and payment released successfully.",
            "payment": {
                "amount": amount,
                "currency": str(existing_job.get("currency") or DEFAULT_CURRENCY).strip() or DEFAULT_CURRENCY,
                "cardHolder": card.get("cardHolder", ""),
                "last4": charge_result["last4"],
                "remainingBucks": charge_result["remainingBucks"],
            },
            "workflowStatus": workflow_status,
            "totalPaidAmount": total_paid_amount,
            "remainingBudgetAmount": remaining_contract_amount,
            "lastPaidAtLabel": _format_relative_time(charged_at),
            "hasUnreadFreelancerUpdate": True,
        }
    ), 200


def get_freelancer_earnings_summary(db):
    user_id = (request.args.get("userId") or "").strip()
    if not user_id:
        return jsonify({"errors": {"userId": "User id is required"}}), 400

    total_earned = 0.0
    current_month_earned = 0.0
    project_count = 0
    now = datetime.now(timezone.utc)

    for document in db["EarningFreelancer"].find({"freelancerId": user_id}):
        project_count += 1
        total_earned += _safe_float(document.get("totalEarned"), 0)

        for payment in document.get("payments", []):
            paid_at = payment.get("paidAt")
            if isinstance(paid_at, datetime):
                paid_at = paid_at if paid_at.tzinfo else paid_at.replace(tzinfo=timezone.utc)
                if paid_at.year == now.year and paid_at.month == now.month:
                    current_month_earned += _safe_float(payment.get("amount"), 0)

    monthly_goal = 7000.0
    progress_percent = 0
    if monthly_goal > 0:
        progress_percent = min(int(round((total_earned / monthly_goal) * 100)), 100)

    return jsonify(
        {
            "totalEarned": round(total_earned, 2),
            "currentMonthEarned": round(current_month_earned, 2),
            "projectCount": project_count,
            "monthlyGoal": monthly_goal,
            "progressPercent": progress_percent,
        }
    ), 200

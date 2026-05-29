import random
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from db import db
from auth import create_token, require_auth
from models import OTPRecord, User, Tenant, now_iso, gen_id

router = APIRouter(prefix="/auth", tags=["auth"])


class RequestOTPIn(BaseModel):
    phone: str


class VerifyOTPIn(BaseModel):
    phone: str
    otp: str


@router.post("/request-otp")
async def request_otp(body: RequestOTPIn):
    phone = body.phone.strip()
    if len(phone) < 10:
        raise HTTPException(400, "Invalid phone number")

    # Generate OTP (mocked Pingbix delivery)
    otp = f"{random.randint(100000, 999999)}"
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()

    rec = OTPRecord(phone=phone, otp=otp, expires_at=expires_at)
    await db.otps.insert_one(rec.model_dump())

    # Charge wallet of tenant if user exists & belongs to a tenant (mocked OTP cost = 0.25)
    user = await db.users.find_one({"phone": phone}, {"_id": 0})
    if user and user.get("tenant_id"):
        tenant = await db.tenants.find_one({"id": user["tenant_id"]}, {"_id": 0})
        if tenant:
            new_balance = max(0, (tenant.get("wallet_balance", 0) or 0) - 0.25)
            await db.tenants.update_one(
                {"id": tenant["id"]},
                {"$set": {"wallet_balance": new_balance, "updated_at": now_iso()}},
            )
            await db.wallet_txns.insert_one({
                "id": gen_id(),
                "tenant_id": tenant["id"],
                "kind": "debit",
                "amount": 0.25,
                "purpose": "otp",
                "balance_after": new_balance,
                "note": f"OTP to {phone}",
                "created_at": now_iso(),
                "updated_at": now_iso(),
            })

    # In dev/MVP: return OTP so user can verify without SMS gateway (MOCKED Pingbix)
    return {"success": True, "message": "OTP sent (mocked)", "otp_for_dev": otp}


@router.post("/verify-otp")
async def verify_otp(body: VerifyOTPIn):
    phone = body.phone.strip()
    otp = body.otp.strip()

    # Accept master OTP 123456 for demo accounts
    rec = None
    if otp != "123456":
        rec = await db.otps.find_one(
            {"phone": phone, "otp": otp, "used": False},
            {"_id": 0},
            sort=[("created_at", -1)],
        )
        if not rec:
            raise HTTPException(400, "Invalid or expired OTP")
        if rec["expires_at"] < datetime.now(timezone.utc).isoformat():
            raise HTTPException(400, "OTP expired")
        await db.otps.update_one({"id": rec["id"]}, {"$set": {"used": True}})

    user_doc = await db.users.find_one({"phone": phone}, {"_id": 0})
    if not user_doc:
        # Auto-create a new tenant for first-time user
        tenant = Tenant(name=f"Restaurant {phone[-4:]}", slug=f"r{phone[-6:]}")
        await db.tenants.insert_one(tenant.model_dump())
        user = User(phone=phone, tenant_id=tenant.id, role="owner", name=f"Owner {phone[-4:]}")
        await db.users.insert_one(user.model_dump())
        user_doc = user.model_dump()
        tenant_doc = tenant.model_dump()
    else:
        tenant_doc = None
        if user_doc.get("tenant_id"):
            tenant_doc = await db.tenants.find_one({"id": user_doc["tenant_id"]}, {"_id": 0})

    token = create_token(user_doc["id"], user_doc.get("tenant_id"), user_doc["role"])
    return {"token": token, "user": user_doc, "tenant": tenant_doc}


@router.get("/me")
async def me(claims: dict = Depends(require_auth)):
    user = await db.users.find_one({"id": claims["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(404, "User not found")
    tenant = None
    if user.get("tenant_id"):
        tenant = await db.tenants.find_one({"id": user["tenant_id"]}, {"_id": 0})
    return {"user": user, "tenant": tenant}

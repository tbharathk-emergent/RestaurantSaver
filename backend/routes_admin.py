from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from db import db
from auth import require_super_admin, require_tenant
from models import SubscriptionPlan, TenantSubscription, WalletTransaction, now_iso, gen_id

router = APIRouter(tags=["admin"])


# ---------- Subscription Plans ----------
class PlanIn(BaseModel):
    name: str
    price: float
    duration_days: int = 30
    max_outlets: int = 1
    max_users: int = 5
    max_menu_items: int = 50
    max_materials: int = 100
    reports_access: bool = True
    ai_insights: bool = False
    is_active: bool = True
    is_custom: bool = False


@router.get("/plans")
async def list_plans():
    return await db.plans.find({"is_active": True}, {"_id": 0}).to_list(100)


@router.get("/admin/plans")
async def admin_list_plans(claims: dict = Depends(require_super_admin)):
    return await db.plans.find({}, {"_id": 0}).to_list(200)


@router.post("/admin/plans")
async def admin_create_plan(body: PlanIn, claims: dict = Depends(require_super_admin)):
    p = SubscriptionPlan(**body.model_dump())
    await db.plans.insert_one(p.model_dump())
    return p.model_dump()


@router.patch("/admin/plans/{pid}")
async def admin_update_plan(pid: str, body: PlanIn, claims: dict = Depends(require_super_admin)):
    upd = body.model_dump()
    upd["updated_at"] = now_iso()
    await db.plans.update_one({"id": pid}, {"$set": upd})
    return await db.plans.find_one({"id": pid}, {"_id": 0})


@router.delete("/admin/plans/{pid}")
async def admin_delete_plan(pid: str, claims: dict = Depends(require_super_admin)):
    await db.plans.delete_one({"id": pid})
    return {"deleted": True}


# ---------- Tenant Admin Management ----------
@router.get("/admin/tenants")
async def admin_list_tenants(claims: dict = Depends(require_super_admin)):
    tenants = await db.tenants.find({}, {"_id": 0}).to_list(2000)
    # attach counts
    for t in tenants:
        t["user_count"] = await db.users.count_documents({"tenant_id": t["id"]})
        t["menu_count"] = await db.menu_items.count_documents({"tenant_id": t["id"]})
        t["material_count"] = await db.raw_materials.count_documents({"tenant_id": t["id"]})
    return tenants


class TenantStatusIn(BaseModel):
    status: str  # active, suspended, expired


@router.patch("/admin/tenants/{tid}/status")
async def admin_update_tenant_status(tid: str, body: TenantStatusIn, claims: dict = Depends(require_super_admin)):
    await db.tenants.update_one({"id": tid}, {"$set": {"status": body.status, "updated_at": now_iso()}})
    return await db.tenants.find_one({"id": tid}, {"_id": 0})


@router.get("/admin/revenue")
async def admin_revenue(claims: dict = Depends(require_super_admin)):
    subs = await db.subscriptions.find({"status": "active"}, {"_id": 0}).to_list(5000)
    total_revenue = sum(s.get("amount", 0) for s in subs)
    by_plan: dict = {}
    for s in subs:
        by_plan[s["plan_id"]] = by_plan.get(s["plan_id"], 0) + s.get("amount", 0)
    return {
        "total_revenue": round(total_revenue, 2),
        "active_subscriptions": len(subs),
        "by_plan": by_plan,
    }


# ---------- Razorpay Subscription (MOCKED) ----------
class CreateOrderIn(BaseModel):
    plan_id: str


@router.post("/subscription/create-order")
async def create_subscription_order(body: CreateOrderIn, claims: dict = Depends(require_tenant)):
    plan = await db.plans.find_one({"id": body.plan_id}, {"_id": 0})
    if not plan:
        raise HTTPException(404, "Plan not found")

    # MOCKED Razorpay order
    order_id = f"order_mock_{gen_id()[:10]}"
    sub = TenantSubscription(
        tenant_id=claims["tenant_id"],
        plan_id=plan["id"],
        razorpay_order_id=order_id,
        amount=plan["price"],
        status="pending",
    )
    await db.subscriptions.insert_one(sub.model_dump())
    return {
        "order_id": order_id,
        "amount": plan["price"],
        "currency": "INR",
        "key": "rzp_test_MOCK_KEY",
        "subscription_id": sub.id,
        "mocked": True,
    }


class VerifyPaymentIn(BaseModel):
    subscription_id: str
    razorpay_payment_id: Optional[str] = None
    razorpay_signature: Optional[str] = None


@router.post("/subscription/verify-payment")
async def verify_subscription_payment(body: VerifyPaymentIn, claims: dict = Depends(require_tenant)):
    sub = await db.subscriptions.find_one(
        {"id": body.subscription_id, "tenant_id": claims["tenant_id"]}, {"_id": 0}
    )
    if not sub:
        raise HTTPException(404, "Subscription not found")
    plan = await db.plans.find_one({"id": sub["plan_id"]}, {"_id": 0})
    if not plan:
        raise HTTPException(404, "Plan not found")

    # MOCKED verification - in real impl, verify razorpay signature
    starts = datetime.now(timezone.utc)
    expires = starts + timedelta(days=plan.get("duration_days", 30))
    await db.subscriptions.update_one(
        {"id": body.subscription_id},
        {"$set": {
            "status": "active",
            "razorpay_payment_id": body.razorpay_payment_id or f"pay_mock_{gen_id()[:10]}",
            "starts_at": starts.isoformat(),
            "expires_at": expires.isoformat(),
            "updated_at": now_iso(),
        }},
    )
    await db.tenants.update_one(
        {"id": claims["tenant_id"]},
        {"$set": {
            "plan_id": plan["id"],
            "plan_expires_at": expires.isoformat(),
            "status": "active",
            "updated_at": now_iso(),
        }},
    )
    return {"success": True, "expires_at": expires.isoformat()}


@router.get("/subscription/current")
async def current_subscription(claims: dict = Depends(require_tenant)):
    sub = await db.subscriptions.find_one(
        {"tenant_id": claims["tenant_id"], "status": "active"},
        {"_id": 0},
        sort=[("created_at", -1)],
    )
    if not sub:
        return None
    plan = await db.plans.find_one({"id": sub["plan_id"]}, {"_id": 0})
    return {"subscription": sub, "plan": plan}


# ---------- Wallet ----------
class WalletTopupIn(BaseModel):
    amount: float


@router.get("/wallet")
async def wallet_summary(claims: dict = Depends(require_tenant)):
    tenant = await db.tenants.find_one({"id": claims["tenant_id"]}, {"_id": 0})
    txns = await db.wallet_txns.find(
        {"tenant_id": claims["tenant_id"]}, {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    return {"balance": tenant.get("wallet_balance", 0) if tenant else 0, "transactions": txns}


@router.post("/wallet/topup")
async def wallet_topup(body: WalletTopupIn, claims: dict = Depends(require_tenant)):
    """MOCKED top-up - in production, integrate with Razorpay."""
    if body.amount <= 0:
        raise HTTPException(400, "Invalid amount")
    tenant = await db.tenants.find_one({"id": claims["tenant_id"]}, {"_id": 0})
    new_balance = (tenant.get("wallet_balance", 0) or 0) + body.amount
    await db.tenants.update_one(
        {"id": claims["tenant_id"]},
        {"$set": {"wallet_balance": new_balance, "updated_at": now_iso()}},
    )
    txn = WalletTransaction(
        tenant_id=claims["tenant_id"],
        kind="credit",
        amount=body.amount,
        purpose="topup",
        balance_after=new_balance,
        note="Wallet top-up (mocked)",
    )
    await db.wallet_txns.insert_one(txn.model_dump())
    return {"balance": new_balance}


# ---------- Demo seed ----------
@router.post("/seed/demo")
async def seed_demo():
    """Idempotent demo seed. Creates super admin + demo tenant with sample data."""
    # Super admin
    sa = await db.users.find_one({"phone": "1111111111"}, {"_id": 0})
    if not sa:
        await db.users.insert_one({
            "id": gen_id(),
            "phone": "1111111111",
            "name": "Super Admin",
            "tenant_id": None,
            "role": "super_admin",
            "outlet_ids": [],
            "active": True,
            "created_at": now_iso(),
            "updated_at": now_iso(),
        })

    # Plans
    plan_count = await db.plans.count_documents({})
    if plan_count == 0:
        plans_data = [
            {"name": "Starter", "price": 299, "duration_days": 30, "max_outlets": 1,
             "max_users": 3, "max_menu_items": 30, "max_materials": 50,
             "reports_access": True, "ai_insights": False, "is_active": True, "is_custom": False},
            {"name": "Pro", "price": 599, "duration_days": 30, "max_outlets": 3,
             "max_users": 10, "max_menu_items": 100, "max_materials": 200,
             "reports_access": True, "ai_insights": True, "is_active": True, "is_custom": False},
            {"name": "Business", "price": 1499, "duration_days": 30, "max_outlets": 10,
             "max_users": 50, "max_menu_items": 500, "max_materials": 1000,
             "reports_access": True, "ai_insights": True, "is_active": True, "is_custom": False},
        ]
        for p in plans_data:
            await db.plans.insert_one({"id": gen_id(), "created_at": now_iso(), "updated_at": now_iso(), **p})

    # Demo tenant
    demo = await db.tenants.find_one({"slug": "demo-restaurant"}, {"_id": 0})
    if not demo:
        tenant_id = gen_id()
        await db.tenants.insert_one({
            "id": tenant_id,
            "name": "Sai Ram Tiffins (Demo)",
            "slug": "demo-restaurant",
            "logo_url": None,
            "primary_color": "#16A34A",
            "language": "en",
            "currency": "INR",
            "status": "active",
            "plan_id": None,
            "plan_expires_at": None,
            "wallet_balance": 100.0,
            "outlets": [{"id": gen_id(), "name": "Main Outlet", "address": "Hyderabad"}],
            "created_at": now_iso(),
            "updated_at": now_iso(),
        })
        # Owner
        await db.users.insert_one({
            "id": gen_id(),
            "phone": "9999999999",
            "name": "Demo Owner",
            "tenant_id": tenant_id,
            "role": "owner",
            "outlet_ids": [],
            "active": True,
            "created_at": now_iso(),
            "updated_at": now_iso(),
        })
        # Raw materials
        materials = [
            ("Rice", "kg", 60, 5, 25, 5),
            ("Chicken", "kg", 280, 2, 8, 3),
            ("Oil", "l", 140, 2, 10, 3),
            ("Onion", "kg", 40, 2, 6, 5),
            ("Tomato", "kg", 50, 2, 5, 5),
            ("Milk", "l", 60, 5, 20, 2),
            ("Tea Powder", "kg", 400, 0.5, 2, 2),
            ("Sugar", "kg", 45, 2, 8, 3),
            ("Dal", "kg", 120, 1, 5, 3),
            ("Flour", "kg", 50, 2, 10, 3),
            ("Gas", "cylinder", 1100, 0, 2, 0),
            ("Masala", "kg", 600, 0.5, 1, 2),
            ("Curd", "kg", 80, 1, 3, 3),
        ]
        mat_ids = {}
        for name, unit, rate, minstock, current, tol in materials:
            mid = gen_id()
            mat_ids[name] = mid
            await db.raw_materials.insert_one({
                "id": mid, "tenant_id": tenant_id, "name": name, "unit": unit,
                "purchase_rate": rate, "min_stock": minstock, "current_stock": current,
                "wastage_tolerance": tol, "category": "General", "supplier_id": None,
                "created_at": now_iso(), "updated_at": now_iso(),
            })

        # Menu items
        menu_items = [
            ("Chicken Biryani", "Main", 180, "plate"),
            ("Veg Biryani", "Main", 120, "plate"),
            ("Meals", "Main", 90, "plate"),
            ("Tea", "Beverage", 15, "cup"),
            ("Coffee", "Beverage", 20, "cup"),
            ("Dosa", "Tiffin", 60, "plate"),
            ("Idli", "Tiffin", 40, "plate"),
        ]
        item_ids = {}
        for name, cat, price, unit in menu_items:
            iid = gen_id()
            item_ids[name] = iid
            await db.menu_items.insert_one({
                "id": iid, "tenant_id": tenant_id, "name": name, "category": cat,
                "selling_price": price, "unit": unit, "image_url": None, "active": True,
                "tax_percent": 0, "parcel_charge": 0,
                "created_at": now_iso(), "updated_at": now_iso(),
            })

        # BOMs
        boms = {
            "Chicken Biryani": [
                ("Rice", 250, "g"), ("Chicken", 200, "g"), ("Oil", 30, "ml"),
                ("Onion", 50, "g"), ("Masala", 20, "g"), ("Curd", 30, "g"),
            ],
            "Veg Biryani": [
                ("Rice", 250, "g"), ("Oil", 30, "ml"), ("Onion", 60, "g"),
                ("Tomato", 40, "g"), ("Masala", 20, "g"),
            ],
            "Meals": [("Rice", 200, "g"), ("Dal", 100, "g"), ("Oil", 15, "ml"), ("Onion", 30, "g")],
            "Tea": [("Milk", 100, "ml"), ("Tea Powder", 5, "g"), ("Sugar", 10, "g")],
            "Coffee": [("Milk", 120, "ml"), ("Sugar", 12, "g")],
            "Dosa": [("Flour", 80, "g"), ("Oil", 10, "ml")],
            "Idli": [("Flour", 60, "g")],
        }
        for item_name, ings in boms.items():
            await db.boms.insert_one({
                "id": gen_id(), "tenant_id": tenant_id,
                "menu_item_id": item_ids[item_name],
                "batch_size": 1.0,
                "ingredients": [{"material_id": mat_ids[n], "quantity": q, "unit": u} for n, q, u in ings],
                "tolerance_percent": 5.0,
                "notes": "",
                "version": 1,
                "created_at": now_iso(), "updated_at": now_iso(),
            })

        # Sample sales for today
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        sample_sales = [
            ("Chicken Biryani", 12, 180), ("Veg Biryani", 8, 120),
            ("Meals", 25, 90), ("Tea", 60, 15), ("Coffee", 15, 20),
            ("Dosa", 18, 60), ("Idli", 22, 40),
        ]
        await db.sales.insert_one({
            "id": gen_id(), "tenant_id": tenant_id, "outlet_id": None,
            "date": today,
            "items": [{"menu_item_id": item_ids[n], "quantity": q, "unit_price": p} for n, q, p in sample_sales],
            "total_amount": sum(q * p for _, q, p in sample_sales),
            "payment_mode": "cash", "notes": "Sample sales",
            "created_at": now_iso(), "updated_at": now_iso(),
        })

        # Sample inventory entries for today
        inv_samples = [
            ("Rice", 25, 10, 27.5), ("Chicken", 8, 5, 9), ("Oil", 10, 0, 9),
            ("Tea Powder", 2, 0, 1.7), ("Milk", 20, 10, 22),
        ]
        for name, opening, purchases, closing in inv_samples:
            await db.inventory.insert_one({
                "id": gen_id(), "tenant_id": tenant_id, "outlet_id": None,
                "date": today, "material_id": mat_ids[name],
                "opening_stock": opening, "purchases": purchases,
                "closing_stock": closing, "transfer_out": 0,
                "wastage": 0, "staff_use": 0,
                "created_at": now_iso(), "updated_at": now_iso(),
            })

    return {"success": True, "demo_phone": "9999999999", "super_admin_phone": "1111111111", "otp": "123456"}

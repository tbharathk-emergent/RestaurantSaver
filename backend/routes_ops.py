from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from db import db
from auth import require_tenant
from models import (
    Sale, SaleLine, InventoryEntry, Purchase, PurchaseLine,
    Wastage, PreparedFood, StockIssue, now_iso
)

router = APIRouter(tags=["ops"])


# ---------- Sales ----------
class SaleIn(BaseModel):
    outlet_id: Optional[str] = None
    date: str
    items: List[SaleLine] = []
    total_amount: float = 0.0
    payment_mode: str = "cash"
    notes: str = ""


def _serialize_lines(items):
    return [i.model_dump() if hasattr(i, "model_dump") else i for i in items]


@router.get("/sales")
async def list_sales(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    claims: dict = Depends(require_tenant),
):
    q = {"tenant_id": claims["tenant_id"]}
    if date_from or date_to:
        q["date"] = {}
        if date_from:
            q["date"]["$gte"] = date_from
        if date_to:
            q["date"]["$lte"] = date_to
    return await db.sales.find(q, {"_id": 0}).sort("date", -1).to_list(1000)


@router.post("/sales")
async def create_sale(body: SaleIn, claims: dict = Depends(require_tenant)):
    s = Sale(tenant_id=claims["tenant_id"], **body.model_dump())
    doc = s.model_dump()
    doc["items"] = _serialize_lines(doc["items"])
    await db.sales.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.patch("/sales/{sid}")
async def update_sale(sid: str, body: SaleIn, claims: dict = Depends(require_tenant)):
    upd = body.model_dump()
    upd["items"] = _serialize_lines(upd["items"])
    upd["updated_at"] = now_iso()
    await db.sales.update_one({"id": sid, "tenant_id": claims["tenant_id"]}, {"$set": upd})
    return await db.sales.find_one({"id": sid}, {"_id": 0})


@router.delete("/sales/{sid}")
async def delete_sale(sid: str, claims: dict = Depends(require_tenant)):
    await db.sales.delete_one({"id": sid, "tenant_id": claims["tenant_id"]})
    return {"deleted": True}


# ---------- Inventory ----------
class InventoryIn(BaseModel):
    outlet_id: Optional[str] = None
    date: str
    material_id: str
    opening_stock: float = 0.0
    purchases: float = 0.0
    closing_stock: float = 0.0
    transfer_out: float = 0.0
    wastage: float = 0.0
    staff_use: float = 0.0


@router.get("/inventory")
async def list_inventory(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    claims: dict = Depends(require_tenant),
):
    q = {"tenant_id": claims["tenant_id"]}
    if date_from or date_to:
        q["date"] = {}
        if date_from:
            q["date"]["$gte"] = date_from
        if date_to:
            q["date"]["$lte"] = date_to
    return await db.inventory.find(q, {"_id": 0}).sort("date", -1).to_list(1000)


@router.post("/inventory")
async def create_inventory(body: InventoryIn, claims: dict = Depends(require_tenant)):
    e = InventoryEntry(tenant_id=claims["tenant_id"], **body.model_dump())
    await db.inventory.insert_one(e.model_dump())
    # update current_stock on material with closing_stock if provided
    await db.raw_materials.update_one(
        {"id": body.material_id, "tenant_id": claims["tenant_id"]},
        {"$set": {"current_stock": body.closing_stock, "updated_at": now_iso()}},
    )
    return e.model_dump()


@router.patch("/inventory/{eid}")
async def update_inventory(eid: str, body: InventoryIn, claims: dict = Depends(require_tenant)):
    upd = body.model_dump()
    upd["updated_at"] = now_iso()
    await db.inventory.update_one({"id": eid, "tenant_id": claims["tenant_id"]}, {"$set": upd})
    return await db.inventory.find_one({"id": eid}, {"_id": 0})


@router.delete("/inventory/{eid}")
async def delete_inventory(eid: str, claims: dict = Depends(require_tenant)):
    await db.inventory.delete_one({"id": eid, "tenant_id": claims["tenant_id"]})
    return {"deleted": True}


# ---------- Purchases ----------
class PurchaseIn(BaseModel):
    supplier_id: Optional[str] = None
    date: str
    items: List[PurchaseLine] = []
    total_amount: float = 0.0
    invoice_no: str = ""
    payment_status: str = "pending"
    bill_image_url: Optional[str] = None


@router.get("/purchases")
async def list_purchases(claims: dict = Depends(require_tenant)):
    return await db.purchases.find({"tenant_id": claims["tenant_id"]}, {"_id": 0}).sort("date", -1).to_list(1000)


@router.post("/purchases")
async def create_purchase(body: PurchaseIn, claims: dict = Depends(require_tenant)):
    p = Purchase(tenant_id=claims["tenant_id"], **body.model_dump())
    doc = p.model_dump()
    doc["items"] = _serialize_lines(doc["items"])
    await db.purchases.insert_one(doc)
    # Increment current stock of each material
    for line in body.items:
        await db.raw_materials.update_one(
            {"id": line.material_id, "tenant_id": claims["tenant_id"]},
            {
                "$inc": {"current_stock": line.quantity},
                "$set": {"purchase_rate": line.rate, "updated_at": now_iso()},
            },
        )
    doc.pop("_id", None)
    return doc


@router.patch("/purchases/{pid}")
async def update_purchase(pid: str, body: PurchaseIn, claims: dict = Depends(require_tenant)):
    upd = body.model_dump()
    upd["items"] = _serialize_lines(upd["items"])
    upd["updated_at"] = now_iso()
    await db.purchases.update_one({"id": pid, "tenant_id": claims["tenant_id"]}, {"$set": upd})
    return await db.purchases.find_one({"id": pid}, {"_id": 0})


@router.delete("/purchases/{pid}")
async def delete_purchase(pid: str, claims: dict = Depends(require_tenant)):
    await db.purchases.delete_one({"id": pid, "tenant_id": claims["tenant_id"]})
    return {"deleted": True}


class PaymentStatusIn(BaseModel):
    payment_status: str  # "pending" or "paid"


@router.patch("/purchases/{pid}/payment-status")
async def set_payment_status(pid: str, body: PaymentStatusIn, claims: dict = Depends(require_tenant)):
    if body.payment_status not in ("pending", "paid"):
        raise HTTPException(400, "Invalid status")
    await db.purchases.update_one(
        {"id": pid, "tenant_id": claims["tenant_id"]},
        {"$set": {"payment_status": body.payment_status, "updated_at": now_iso()}},
    )
    return await db.purchases.find_one({"id": pid, "tenant_id": claims["tenant_id"]}, {"_id": 0})


# ---------- Stock Issue (simple "took out X kg today") ----------
class StockIssueIn(BaseModel):
    outlet_id: Optional[str] = None
    date: str
    material_id: str
    quantity: float
    notes: str = ""


@router.get("/stock-issues")
async def list_stock_issues(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    claims: dict = Depends(require_tenant),
):
    q = {"tenant_id": claims["tenant_id"]}
    if date_from or date_to:
        q["date"] = {}
        if date_from:
            q["date"]["$gte"] = date_from
        if date_to:
            q["date"]["$lte"] = date_to
    return await db.stock_issues.find(q, {"_id": 0}).sort("date", -1).to_list(2000)


@router.post("/stock-issues")
async def create_stock_issue(body: StockIssueIn, claims: dict = Depends(require_tenant)):
    s = StockIssue(tenant_id=claims["tenant_id"], **body.model_dump())
    await db.stock_issues.insert_one(s.model_dump())
    # Decrement current stock on material
    await db.raw_materials.update_one(
        {"id": body.material_id, "tenant_id": claims["tenant_id"]},
        {"$inc": {"current_stock": -body.quantity}, "$set": {"updated_at": now_iso()}},
    )
    return s.model_dump()


@router.delete("/stock-issues/{sid}")
async def delete_stock_issue(sid: str, claims: dict = Depends(require_tenant)):
    existing = await db.stock_issues.find_one({"id": sid, "tenant_id": claims["tenant_id"]}, {"_id": 0})
    if existing:
        # restore stock
        await db.raw_materials.update_one(
            {"id": existing["material_id"], "tenant_id": claims["tenant_id"]},
            {"$inc": {"current_stock": existing.get("quantity", 0)}, "$set": {"updated_at": now_iso()}},
        )
    await db.stock_issues.delete_one({"id": sid, "tenant_id": claims["tenant_id"]})
    return {"deleted": True}


# ---------- Wastage ----------
class WastageIn(BaseModel):
    outlet_id: Optional[str] = None
    date: str
    kind: str = "material"
    material_id: Optional[str] = None
    menu_item_id: Optional[str] = None
    quantity: float
    reason: str = ""
    staff_name: str = ""
    photo_url: Optional[str] = None


@router.get("/wastage")
async def list_wastage(claims: dict = Depends(require_tenant)):
    return await db.wastage.find({"tenant_id": claims["tenant_id"]}, {"_id": 0}).sort("date", -1).to_list(1000)


@router.post("/wastage")
async def create_wastage(body: WastageIn, claims: dict = Depends(require_tenant)):
    w = Wastage(tenant_id=claims["tenant_id"], **body.model_dump())
    await db.wastage.insert_one(w.model_dump())
    return w.model_dump()


@router.delete("/wastage/{wid}")
async def delete_wastage(wid: str, claims: dict = Depends(require_tenant)):
    await db.wastage.delete_one({"id": wid, "tenant_id": claims["tenant_id"]})
    return {"deleted": True}


# ---------- Prepared Food ----------
class PreparedFoodIn(BaseModel):
    outlet_id: Optional[str] = None
    date: str
    menu_item_id: str
    prepared_qty: float = 0.0
    sold_qty: float = 0.0
    leftover_qty: float = 0.0
    wasted_qty: float = 0.0
    reused_qty: float = 0.0
    staff_food_qty: float = 0.0


@router.get("/prepared-food")
async def list_prepared(claims: dict = Depends(require_tenant)):
    return await db.prepared_food.find({"tenant_id": claims["tenant_id"]}, {"_id": 0}).sort("date", -1).to_list(1000)


@router.post("/prepared-food")
async def create_prepared(body: PreparedFoodIn, claims: dict = Depends(require_tenant)):
    p = PreparedFood(tenant_id=claims["tenant_id"], **body.model_dump())
    await db.prepared_food.insert_one(p.model_dump())
    return p.model_dump()


@router.delete("/prepared-food/{pid}")
async def delete_prepared(pid: str, claims: dict = Depends(require_tenant)):
    await db.prepared_food.delete_one({"id": pid, "tenant_id": claims["tenant_id"]})
    return {"deleted": True}

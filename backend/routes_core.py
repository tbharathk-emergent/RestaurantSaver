from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from db import db
from auth import require_tenant
from models import (
    MenuItem, RawMaterial, BOM, BOMIngredient, Supplier, now_iso, gen_id, User, Tenant
)

router = APIRouter(tags=["core"])


# ---------- Tenant Settings ----------
class TenantUpdate(BaseModel):
    name: Optional[str] = None
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None
    language: Optional[str] = None
    outlets: Optional[List[dict]] = None


@router.get("/tenant")
async def get_tenant(claims: dict = Depends(require_tenant)):
    t = await db.tenants.find_one({"id": claims["tenant_id"]}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Tenant not found")
    return t


@router.patch("/tenant")
async def update_tenant(body: TenantUpdate, claims: dict = Depends(require_tenant)):
    upd = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    upd["updated_at"] = now_iso()
    await db.tenants.update_one({"id": claims["tenant_id"]}, {"$set": upd})
    return await db.tenants.find_one({"id": claims["tenant_id"]}, {"_id": 0})


# ---------- Users / Staff ----------
class UserCreate(BaseModel):
    phone: str
    name: str = ""
    role: str = "cashier"
    outlet_ids: List[str] = []


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    outlet_ids: Optional[List[str]] = None
    active: Optional[bool] = None


@router.get("/users")
async def list_users(claims: dict = Depends(require_tenant)):
    rows = await db.users.find({"tenant_id": claims["tenant_id"]}, {"_id": 0}).to_list(500)
    return rows


@router.post("/users")
async def create_user(body: UserCreate, claims: dict = Depends(require_tenant)):
    existing = await db.users.find_one({"phone": body.phone}, {"_id": 0})
    if existing:
        raise HTTPException(400, "User with this phone already exists")
    u = User(tenant_id=claims["tenant_id"], **body.model_dump())
    await db.users.insert_one(u.model_dump())
    return u.model_dump()


@router.patch("/users/{user_id}")
async def update_user(user_id: str, body: UserUpdate, claims: dict = Depends(require_tenant)):
    upd = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    upd["updated_at"] = now_iso()
    await db.users.update_one({"id": user_id, "tenant_id": claims["tenant_id"]}, {"$set": upd})
    return await db.users.find_one({"id": user_id}, {"_id": 0})


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, claims: dict = Depends(require_tenant)):
    await db.users.delete_one({"id": user_id, "tenant_id": claims["tenant_id"]})
    return {"deleted": True}


# ---------- Menu Items ----------
class MenuItemIn(BaseModel):
    name: str
    category: str = "Main"
    selling_price: float = 0.0
    unit: str = "plate"
    image_url: Optional[str] = None
    active: bool = True
    tax_percent: float = 0.0
    parcel_charge: float = 0.0


@router.get("/menu-items")
async def list_menu_items(claims: dict = Depends(require_tenant)):
    return await db.menu_items.find({"tenant_id": claims["tenant_id"]}, {"_id": 0}).to_list(1000)


@router.post("/menu-items")
async def create_menu_item(body: MenuItemIn, claims: dict = Depends(require_tenant)):
    m = MenuItem(tenant_id=claims["tenant_id"], **body.model_dump())
    await db.menu_items.insert_one(m.model_dump())
    return m.model_dump()


@router.patch("/menu-items/{item_id}")
async def update_menu_item(item_id: str, body: MenuItemIn, claims: dict = Depends(require_tenant)):
    upd = body.model_dump()
    upd["updated_at"] = now_iso()
    await db.menu_items.update_one({"id": item_id, "tenant_id": claims["tenant_id"]}, {"$set": upd})
    return await db.menu_items.find_one({"id": item_id}, {"_id": 0})


@router.delete("/menu-items/{item_id}")
async def delete_menu_item(item_id: str, claims: dict = Depends(require_tenant)):
    await db.menu_items.delete_one({"id": item_id, "tenant_id": claims["tenant_id"]})
    return {"deleted": True}


# ---------- Raw Materials ----------
class RawMaterialIn(BaseModel):
    name: str
    unit: str = "kg"
    purchase_rate: float = 0.0
    min_stock: float = 0.0
    current_stock: float = 0.0
    wastage_tolerance: float = 5.0
    category: str = "General"
    supplier_id: Optional[str] = None


@router.get("/raw-materials")
async def list_materials(claims: dict = Depends(require_tenant)):
    return await db.raw_materials.find({"tenant_id": claims["tenant_id"]}, {"_id": 0}).to_list(1000)


@router.post("/raw-materials")
async def create_material(body: RawMaterialIn, claims: dict = Depends(require_tenant)):
    rm = RawMaterial(tenant_id=claims["tenant_id"], **body.model_dump())
    await db.raw_materials.insert_one(rm.model_dump())
    return rm.model_dump()


@router.patch("/raw-materials/{mid}")
async def update_material(mid: str, body: RawMaterialIn, claims: dict = Depends(require_tenant)):
    upd = body.model_dump()
    upd["updated_at"] = now_iso()
    await db.raw_materials.update_one({"id": mid, "tenant_id": claims["tenant_id"]}, {"$set": upd})
    return await db.raw_materials.find_one({"id": mid}, {"_id": 0})


@router.delete("/raw-materials/{mid}")
async def delete_material(mid: str, claims: dict = Depends(require_tenant)):
    await db.raw_materials.delete_one({"id": mid, "tenant_id": claims["tenant_id"]})
    return {"deleted": True}


# ---------- BOM ----------
class BOMIn(BaseModel):
    menu_item_id: str
    batch_size: float = 1.0
    ingredients: List[BOMIngredient] = []
    tolerance_percent: float = 5.0
    notes: str = ""


@router.get("/boms")
async def list_boms(claims: dict = Depends(require_tenant)):
    return await db.boms.find({"tenant_id": claims["tenant_id"]}, {"_id": 0}).to_list(1000)


@router.get("/boms/by-item/{item_id}")
async def get_bom_by_item(item_id: str, claims: dict = Depends(require_tenant)):
    bom = await db.boms.find_one(
        {"tenant_id": claims["tenant_id"], "menu_item_id": item_id},
        {"_id": 0},
        sort=[("version", -1)],
    )
    return bom


@router.post("/boms")
async def create_bom(body: BOMIn, claims: dict = Depends(require_tenant)):
    # If existing BOM for item, bump version
    existing = await db.boms.find_one(
        {"tenant_id": claims["tenant_id"], "menu_item_id": body.menu_item_id},
        {"_id": 0},
        sort=[("version", -1)],
    )
    version = (existing["version"] + 1) if existing else 1
    b = BOM(
        tenant_id=claims["tenant_id"],
        menu_item_id=body.menu_item_id,
        batch_size=body.batch_size,
        ingredients=body.ingredients,
        tolerance_percent=body.tolerance_percent,
        notes=body.notes,
        version=version,
    )
    doc = b.model_dump()
    # Serialize ingredients which are BaseModels
    doc["ingredients"] = [i.model_dump() if hasattr(i, "model_dump") else i for i in doc["ingredients"]]
    await db.boms.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.patch("/boms/{bom_id}")
async def update_bom(bom_id: str, body: BOMIn, claims: dict = Depends(require_tenant)):
    upd = body.model_dump()
    upd["ingredients"] = [i.model_dump() if hasattr(i, "model_dump") else i for i in upd["ingredients"]]
    upd["updated_at"] = now_iso()
    await db.boms.update_one({"id": bom_id, "tenant_id": claims["tenant_id"]}, {"$set": upd})
    return await db.boms.find_one({"id": bom_id}, {"_id": 0})


@router.delete("/boms/{bom_id}")
async def delete_bom(bom_id: str, claims: dict = Depends(require_tenant)):
    await db.boms.delete_one({"id": bom_id, "tenant_id": claims["tenant_id"]})
    return {"deleted": True}


# ---------- Suppliers ----------
class SupplierIn(BaseModel):
    name: str
    phone: str = ""
    materials: List[str] = []
    last_rate_note: str = ""
    payment_due: float = 0.0


@router.get("/suppliers")
async def list_suppliers(claims: dict = Depends(require_tenant)):
    return await db.suppliers.find({"tenant_id": claims["tenant_id"]}, {"_id": 0}).to_list(500)


@router.post("/suppliers")
async def create_supplier(body: SupplierIn, claims: dict = Depends(require_tenant)):
    s = Supplier(tenant_id=claims["tenant_id"], **body.model_dump())
    await db.suppliers.insert_one(s.model_dump())
    return s.model_dump()


@router.patch("/suppliers/{sid}")
async def update_supplier(sid: str, body: SupplierIn, claims: dict = Depends(require_tenant)):
    upd = body.model_dump()
    upd["updated_at"] = now_iso()
    await db.suppliers.update_one({"id": sid, "tenant_id": claims["tenant_id"]}, {"$set": upd})
    return await db.suppliers.find_one({"id": sid}, {"_id": 0})


@router.delete("/suppliers/{sid}")
async def delete_supplier(sid: str, claims: dict = Depends(require_tenant)):
    await db.suppliers.delete_one({"id": sid, "tenant_id": claims["tenant_id"]})
    return {"deleted": True}

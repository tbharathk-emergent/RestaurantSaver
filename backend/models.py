from datetime import datetime, timezone
from typing import Optional, List, Any
from pydantic import BaseModel, Field, ConfigDict
import uuid


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def gen_id() -> str:
    return str(uuid.uuid4())


class BaseDoc(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    id: str = Field(default_factory=gen_id)
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)


# ============ Tenant ============
class Tenant(BaseDoc):
    name: str
    slug: str
    logo_url: Optional[str] = None
    primary_color: str = "#16A34A"
    language: str = "en"  # en, hi, te
    currency: str = "INR"
    status: str = "active"  # active, suspended, expired
    plan_id: Optional[str] = None
    plan_expires_at: Optional[str] = None
    wallet_balance: float = 100.0  # starting credit for AI/OTP
    outlets: List[dict] = []  # [{id, name, address}]


# ============ User ============
class User(BaseDoc):
    tenant_id: Optional[str] = None  # None for super_admin
    phone: str
    name: str = ""
    role: str = "owner"  # super_admin, owner, manager, cashier, kitchen, store, accountant
    outlet_ids: List[str] = []
    active: bool = True


class OTPRecord(BaseDoc):
    phone: str
    otp: str
    expires_at: str
    used: bool = False


# ============ Menu Item ============
class MenuItem(BaseDoc):
    tenant_id: str
    name: str
    category: str = "Main"
    selling_price: float = 0.0
    unit: str = "plate"
    image_url: Optional[str] = None
    active: bool = True
    tax_percent: float = 0.0
    parcel_charge: float = 0.0


# ============ Raw Material ============
class RawMaterial(BaseDoc):
    tenant_id: str
    name: str
    unit: str = "kg"  # kg, g, l, ml, pcs, packet, cylinder
    purchase_rate: float = 0.0
    min_stock: float = 0.0
    current_stock: float = 0.0
    wastage_tolerance: float = 5.0  # percent
    category: str = "General"
    supplier_id: Optional[str] = None


# ============ BOM ============
class BOMIngredient(BaseModel):
    material_id: str
    quantity: float
    unit: str = "g"


class BOM(BaseDoc):
    tenant_id: str
    menu_item_id: str
    batch_size: float = 1.0
    ingredients: List[BOMIngredient] = []
    tolerance_percent: float = 5.0
    notes: str = ""
    version: int = 1


# ============ Sales ============
class SaleLine(BaseModel):
    menu_item_id: str
    quantity: float
    unit_price: float


class Sale(BaseDoc):
    tenant_id: str
    outlet_id: Optional[str] = None
    date: str  # YYYY-MM-DD
    items: List[SaleLine] = []
    total_amount: float = 0.0
    payment_mode: str = "cash"
    notes: str = ""


# ============ Inventory ============
class InventoryEntry(BaseDoc):
    tenant_id: str
    outlet_id: Optional[str] = None
    date: str
    material_id: str
    opening_stock: float = 0.0
    purchases: float = 0.0
    closing_stock: float = 0.0
    transfer_out: float = 0.0
    wastage: float = 0.0
    staff_use: float = 0.0
    # computed: actual_used


# ============ Purchase ============
class PurchaseLine(BaseModel):
    material_id: str
    quantity: float
    rate: float


class Purchase(BaseDoc):
    tenant_id: str
    supplier_id: Optional[str] = None
    date: str
    items: List[PurchaseLine] = []
    total_amount: float = 0.0
    invoice_no: str = ""
    payment_status: str = "pending"  # pending, paid
    bill_image_url: Optional[str] = None


# ============ Supplier ============
class Supplier(BaseDoc):
    tenant_id: str
    name: str
    phone: str = ""
    materials: List[str] = []
    last_rate_note: str = ""
    payment_due: float = 0.0


# ============ Wastage ============
class Wastage(BaseDoc):
    tenant_id: str
    outlet_id: Optional[str] = None
    date: str
    kind: str = "material"  # material | prepared
    material_id: Optional[str] = None
    menu_item_id: Optional[str] = None
    quantity: float
    reason: str = ""
    staff_name: str = ""
    photo_url: Optional[str] = None


# ============ Prepared Food ============
class PreparedFood(BaseDoc):
    tenant_id: str
    outlet_id: Optional[str] = None
    date: str
    menu_item_id: str
    prepared_qty: float = 0.0
    sold_qty: float = 0.0
    leftover_qty: float = 0.0
    wasted_qty: float = 0.0
    reused_qty: float = 0.0
    staff_food_qty: float = 0.0


# ============ Stock Issue (simple "took out from stock today") ============
class StockIssue(BaseDoc):
    tenant_id: str
    outlet_id: Optional[str] = None
    date: str
    material_id: str
    quantity: float = 0.0
    notes: str = ""


# ============ Subscription Plan ============
class SubscriptionPlan(BaseDoc):
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


class TenantSubscription(BaseDoc):
    tenant_id: str
    plan_id: str
    razorpay_order_id: str = ""
    razorpay_payment_id: str = ""
    status: str = "pending"  # pending, active, expired, failed
    amount: float = 0.0
    starts_at: Optional[str] = None
    expires_at: Optional[str] = None


# ============ Wallet ============
class WalletTransaction(BaseDoc):
    tenant_id: str
    kind: str  # debit, credit
    amount: float
    purpose: str  # otp, ai_insight, topup, refund
    balance_after: float
    note: str = ""


# ============ AI Insight ============
class AIInsight(BaseDoc):
    tenant_id: str
    date: str
    content: str
    title: str = "AI Insight"
    cost: float = 1.0

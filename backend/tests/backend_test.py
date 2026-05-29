"""Backend regression tests for Restaurant OPS BOM.

Covers: Auth (OTP+JWT), tenant isolation, menu/raw-materials/BOM/suppliers/sales/inventory/
purchases/wastage/prepared-food CRUD, dashboard, variations, reports, wallet,
subscription mock flow, super admin, AI insights (with wallet deduction).
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://resto-leakage-fix.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
TODAY = time.strftime("%Y-%m-%d")


# ---------------- helpers ----------------
def _login(phone: str):
    r = requests.post(f"{API}/auth/request-otp", json={"phone": phone}, timeout=30)
    assert r.status_code == 200, r.text
    r = requests.post(f"{API}/auth/verify-otp", json={"phone": phone, "otp": "123456"}, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    return data["token"], data["user"], data.get("tenant")


@pytest.fixture(scope="session")
def owner_ctx():
    token, user, tenant = _login("9999999999")
    return {"token": token, "user": user, "tenant": tenant,
            "headers": {"Authorization": f"Bearer {token}"}}


@pytest.fixture(scope="session")
def admin_ctx():
    token, user, tenant = _login("1111111111")
    return {"token": token, "user": user, "tenant": tenant,
            "headers": {"Authorization": f"Bearer {token}"}}


@pytest.fixture(scope="session")
def other_ctx():
    # fresh tenant for isolation testing
    phone = "9000" + str(int(time.time()))[-6:]
    token, user, tenant = _login(phone)
    return {"token": token, "user": user, "tenant": tenant, "phone": phone,
            "headers": {"Authorization": f"Bearer {token}"}}


# ---------------- AUTH ----------------
class TestAuth:
    def test_request_otp(self):
        r = requests.post(f"{API}/auth/request-otp", json={"phone": "9999999999"})
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert "otp_for_dev" in body and len(body["otp_for_dev"]) == 6

    def test_request_otp_invalid_phone(self):
        r = requests.post(f"{API}/auth/request-otp", json={"phone": "12"})
        assert r.status_code == 400

    def test_master_otp_works(self):
        r = requests.post(f"{API}/auth/verify-otp",
                          json={"phone": "9999999999", "otp": "123456"})
        assert r.status_code == 200
        d = r.json()
        assert "token" in d and d["user"]["role"] == "owner"
        assert d["tenant"]["slug"] == "demo-restaurant"

    def test_invalid_otp(self):
        r = requests.post(f"{API}/auth/verify-otp",
                          json={"phone": "9999999999", "otp": "000000"})
        assert r.status_code == 400

    def test_me(self, owner_ctx):
        r = requests.get(f"{API}/auth/me", headers=owner_ctx["headers"])
        assert r.status_code == 200
        assert r.json()["user"]["phone"] == "9999999999"

    def test_me_unauthorized(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_super_admin_role(self, admin_ctx):
        assert admin_ctx["user"]["role"] == "super_admin"


# ---------------- TENANT ----------------
class TestTenant:
    def test_get_tenant(self, owner_ctx):
        r = requests.get(f"{API}/tenant", headers=owner_ctx["headers"])
        assert r.status_code == 200
        assert r.json()["slug"] == "demo-restaurant"

    def test_update_tenant(self, owner_ctx):
        r = requests.patch(f"{API}/tenant",
                           headers=owner_ctx["headers"],
                           json={"primary_color": "#16A34A", "language": "en"})
        assert r.status_code == 200
        assert r.json()["primary_color"] == "#16A34A"


# ---------------- MENU ITEMS / RAW MATERIALS ----------------
class TestMenuMaterials:
    def test_list_menu_items_seeded(self, owner_ctx):
        r = requests.get(f"{API}/menu-items", headers=owner_ctx["headers"])
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 7
        assert any(i["name"] == "Chicken Biryani" for i in items)

    def test_menu_item_crud(self, owner_ctx):
        h = owner_ctx["headers"]
        r = requests.post(f"{API}/menu-items", headers=h,
                          json={"name": "TEST_Item", "selling_price": 100, "category": "Main", "unit": "plate"})
        assert r.status_code == 200
        iid = r.json()["id"]
        r = requests.patch(f"{API}/menu-items/{iid}", headers=h,
                           json={"name": "TEST_Item_upd", "selling_price": 120, "category": "Main", "unit": "plate"})
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_Item_upd"
        r = requests.delete(f"{API}/menu-items/{iid}", headers=h)
        assert r.status_code == 200

    def test_list_raw_materials_seeded(self, owner_ctx):
        r = requests.get(f"{API}/raw-materials", headers=owner_ctx["headers"])
        assert r.status_code == 200
        assert len(r.json()) >= 10

    def test_raw_material_crud(self, owner_ctx):
        h = owner_ctx["headers"]
        r = requests.post(f"{API}/raw-materials", headers=h,
                          json={"name": "TEST_Salt", "unit": "kg", "purchase_rate": 20})
        assert r.status_code == 200
        mid = r.json()["id"]
        r = requests.patch(f"{API}/raw-materials/{mid}", headers=h,
                           json={"name": "TEST_Salt2", "unit": "kg", "purchase_rate": 25})
        assert r.status_code == 200 and r.json()["purchase_rate"] == 25
        r = requests.delete(f"{API}/raw-materials/{mid}", headers=h)
        assert r.status_code == 200


# ---------------- BOM ----------------
class TestBOM:
    def test_list_boms(self, owner_ctx):
        r = requests.get(f"{API}/boms", headers=owner_ctx["headers"])
        assert r.status_code == 200 and len(r.json()) >= 7

    def test_bom_versioning(self, owner_ctx):
        h = owner_ctx["headers"]
        items = requests.get(f"{API}/menu-items", headers=h).json()
        mats = requests.get(f"{API}/raw-materials", headers=h).json()
        item_id = items[0]["id"]
        mat_id = mats[0]["id"]
        r = requests.post(f"{API}/boms", headers=h, json={
            "menu_item_id": item_id, "batch_size": 1.0,
            "ingredients": [{"material_id": mat_id, "quantity": 10, "unit": "g"}],
            "tolerance_percent": 5.0,
        })
        assert r.status_code == 200
        v1 = r.json()["version"]
        r = requests.post(f"{API}/boms", headers=h, json={
            "menu_item_id": item_id, "batch_size": 1.0,
            "ingredients": [{"material_id": mat_id, "quantity": 12, "unit": "g"}],
            "tolerance_percent": 5.0,
        })
        assert r.status_code == 200
        assert r.json()["version"] == v1 + 1

    def test_bom_by_item(self, owner_ctx):
        h = owner_ctx["headers"]
        items = requests.get(f"{API}/menu-items", headers=h).json()
        r = requests.get(f"{API}/boms/by-item/{items[0]['id']}", headers=h)
        assert r.status_code == 200
        assert r.json() and r.json()["menu_item_id"] == items[0]["id"]


# ---------------- SUPPLIERS ----------------
class TestSuppliers:
    def test_supplier_crud(self, owner_ctx):
        h = owner_ctx["headers"]
        r = requests.post(f"{API}/suppliers", headers=h,
                          json={"name": "TEST_Sup", "phone": "1234567890"})
        assert r.status_code == 200
        sid = r.json()["id"]
        r = requests.get(f"{API}/suppliers", headers=h)
        assert any(s["id"] == sid for s in r.json())
        r = requests.patch(f"{API}/suppliers/{sid}", headers=h,
                           json={"name": "TEST_Sup2", "phone": "1234567890"})
        assert r.status_code == 200 and r.json()["name"] == "TEST_Sup2"
        r = requests.delete(f"{API}/suppliers/{sid}", headers=h)
        assert r.status_code == 200


# ---------------- SALES / INVENTORY / PURCHASES / WASTAGE / PREPARED ----------------
class TestOps:
    def test_create_sale(self, owner_ctx):
        h = owner_ctx["headers"]
        items = requests.get(f"{API}/menu-items", headers=h).json()
        r = requests.post(f"{API}/sales", headers=h, json={
            "date": TODAY,
            "items": [{"menu_item_id": items[0]["id"], "quantity": 2, "unit_price": items[0]["selling_price"]}],
            "total_amount": 2 * items[0]["selling_price"],
            "payment_mode": "cash",
        })
        assert r.status_code == 200
        sid = r.json()["id"]
        r = requests.get(f"{API}/sales", headers=h)
        assert any(s["id"] == sid for s in r.json())

    def test_create_inventory_updates_stock(self, owner_ctx):
        h = owner_ctx["headers"]
        mats = requests.get(f"{API}/raw-materials", headers=h).json()
        mat = mats[0]
        new_close = 42.5
        r = requests.post(f"{API}/inventory", headers=h, json={
            "date": TODAY, "material_id": mat["id"],
            "opening_stock": 50, "purchases": 0,
            "closing_stock": new_close, "transfer_out": 0,
            "wastage": 0, "staff_use": 0,
        })
        assert r.status_code == 200
        # verify material current_stock updated
        mats2 = requests.get(f"{API}/raw-materials", headers=h).json()
        m2 = next(m for m in mats2 if m["id"] == mat["id"])
        assert abs(m2["current_stock"] - new_close) < 0.001

    def test_create_purchase_increments_stock(self, owner_ctx):
        h = owner_ctx["headers"]
        mats = requests.get(f"{API}/raw-materials", headers=h).json()
        mat = mats[1]
        before = mat["current_stock"]
        r = requests.post(f"{API}/purchases", headers=h, json={
            "date": TODAY,
            "items": [{"material_id": mat["id"], "quantity": 5, "rate": 100}],
            "total_amount": 500,
        })
        assert r.status_code == 200
        mats2 = requests.get(f"{API}/raw-materials", headers=h).json()
        m2 = next(m for m in mats2 if m["id"] == mat["id"])
        assert abs(m2["current_stock"] - (before + 5)) < 0.001

    def test_wastage_material(self, owner_ctx):
        h = owner_ctx["headers"]
        mats = requests.get(f"{API}/raw-materials", headers=h).json()
        r = requests.post(f"{API}/wastage", headers=h, json={
            "date": TODAY, "kind": "material",
            "material_id": mats[0]["id"], "quantity": 0.5, "reason": "spillage",
        })
        assert r.status_code == 200
        wid = r.json()["id"]
        r = requests.delete(f"{API}/wastage/{wid}", headers=h)
        assert r.status_code == 200

    def test_prepared_food(self, owner_ctx):
        h = owner_ctx["headers"]
        items = requests.get(f"{API}/menu-items", headers=h).json()
        r = requests.post(f"{API}/prepared-food", headers=h, json={
            "date": TODAY, "menu_item_id": items[0]["id"],
            "prepared_qty": 20, "sold_qty": 15, "leftover_qty": 5,
        })
        assert r.status_code == 200


# ---------------- ANALYTICS ----------------
class TestAnalytics:
    def test_dashboard(self, owner_ctx):
        r = requests.get(f"{API}/dashboard", headers=owner_ctx["headers"])
        assert r.status_code == 200
        d = r.json()
        for k in ("total_sales", "gross_profit", "stock_difference",
                  "red_alerts_count", "low_stock_count", "variations"):
            assert k in d
        assert d["total_sales"] > 0  # seeded sales

    def test_variations(self, owner_ctx):
        r = requests.get(f"{API}/variations", headers=owner_ctx["headers"])
        assert r.status_code == 200
        v = r.json()
        assert "material_variations" in v and "sales_variations" in v

    def test_reports(self, owner_ctx):
        h = owner_ctx["headers"]
        r = requests.get(f"{API}/reports/sales?date_from={TODAY}&date_to={TODAY}", headers=h)
        assert r.status_code == 200 and "total" in r.json()
        r = requests.get(f"{API}/reports/wastage?date_from={TODAY}&date_to={TODAY}", headers=h)
        assert r.status_code == 200
        r = requests.get(f"{API}/reports/item-costing", headers=h)
        assert r.status_code == 200 and isinstance(r.json(), list)
        r = requests.get(f"{API}/reports/low-stock", headers=h)
        assert r.status_code == 200


# ---------------- TENANT ISOLATION ----------------
class TestIsolation:
    def test_other_tenant_cannot_see_owner_data(self, owner_ctx, other_ctx):
        other_items = requests.get(f"{API}/menu-items", headers=other_ctx["headers"]).json()
        # fresh tenant should have no menu items
        assert other_items == []
        other_mats = requests.get(f"{API}/raw-materials", headers=other_ctx["headers"]).json()
        assert other_mats == []
        # owner tenant still has its own
        owner_items = requests.get(f"{API}/menu-items", headers=owner_ctx["headers"]).json()
        assert len(owner_items) >= 7


# ---------------- WALLET ----------------
class TestWallet:
    def test_wallet_summary(self, owner_ctx):
        r = requests.get(f"{API}/wallet", headers=owner_ctx["headers"])
        assert r.status_code == 200
        d = r.json()
        assert "balance" in d and "transactions" in d

    def test_wallet_topup(self, owner_ctx):
        h = owner_ctx["headers"]
        b1 = requests.get(f"{API}/wallet", headers=h).json()["balance"]
        r = requests.post(f"{API}/wallet/topup", headers=h, json={"amount": 50})
        assert r.status_code == 200
        b2 = r.json()["balance"]
        assert abs(b2 - (b1 + 50)) < 0.01

    def test_wallet_topup_invalid(self, owner_ctx):
        r = requests.post(f"{API}/wallet/topup", headers=owner_ctx["headers"], json={"amount": -1})
        assert r.status_code == 400


# ---------------- SUBSCRIPTION ----------------
class TestSubscription:
    def test_list_plans_public(self):
        r = requests.get(f"{API}/plans")
        assert r.status_code == 200
        assert len(r.json()) >= 3

    def test_subscribe_mock_flow(self, owner_ctx):
        h = owner_ctx["headers"]
        plans = requests.get(f"{API}/plans").json()
        plan = plans[0]
        r = requests.post(f"{API}/subscription/create-order", headers=h, json={"plan_id": plan["id"]})
        assert r.status_code == 200
        order = r.json()
        assert order["mocked"] is True and "subscription_id" in order
        r = requests.post(f"{API}/subscription/verify-payment", headers=h, json={
            "subscription_id": order["subscription_id"],
            "razorpay_payment_id": "pay_mock_xx",
            "razorpay_signature": "sig_xx",
        })
        assert r.status_code == 200 and r.json()["success"] is True
        r = requests.get(f"{API}/subscription/current", headers=h)
        assert r.status_code == 200 and r.json() is not None


# ---------------- SUPER ADMIN ----------------
class TestSuperAdmin:
    def test_admin_tenants(self, admin_ctx):
        r = requests.get(f"{API}/admin/tenants", headers=admin_ctx["headers"])
        assert r.status_code == 200 and len(r.json()) >= 1

    def test_admin_revenue(self, admin_ctx):
        r = requests.get(f"{API}/admin/revenue", headers=admin_ctx["headers"])
        assert r.status_code == 200
        assert "total_revenue" in r.json()

    def test_admin_requires_role(self, owner_ctx):
        r = requests.get(f"{API}/admin/tenants", headers=owner_ctx["headers"])
        assert r.status_code == 403

    def test_admin_plan_crud(self, admin_ctx):
        h = admin_ctx["headers"]
        r = requests.post(f"{API}/admin/plans", headers=h, json={
            "name": "TEST_Plan", "price": 1, "duration_days": 1,
        })
        assert r.status_code == 200
        pid = r.json()["id"]
        r = requests.patch(f"{API}/admin/plans/{pid}", headers=h, json={
            "name": "TEST_Plan2", "price": 2, "duration_days": 1,
        })
        assert r.status_code == 200 and r.json()["name"] == "TEST_Plan2"
        r = requests.delete(f"{API}/admin/plans/{pid}", headers=h)
        assert r.status_code == 200

    def test_admin_tenant_status_toggle(self, admin_ctx, owner_ctx):
        tid = owner_ctx["tenant"]["id"]
        r = requests.patch(f"{API}/admin/tenants/{tid}/status",
                           headers=admin_ctx["headers"], json={"status": "active"})
        assert r.status_code == 200 and r.json()["status"] == "active"


# ---------------- AI INSIGHTS ----------------
class TestAIInsights:
    def test_generate_insight_and_charge(self, owner_ctx):
        h = owner_ctx["headers"]
        # ensure sufficient balance
        requests.post(f"{API}/wallet/topup", headers=h, json={"amount": 50})
        b1 = requests.get(f"{API}/wallet", headers=h).json()["balance"]
        r = requests.post(f"{API}/ai-insights/generate", headers=h, json={}, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "insight" in d and d["insight"]["content"]
        assert abs(d["wallet_balance"] - (b1 - 2)) < 0.01

    def test_list_insights(self, owner_ctx):
        r = requests.get(f"{API}/ai-insights", headers=owner_ctx["headers"])
        assert r.status_code == 200 and isinstance(r.json(), list)

import os
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict
from db import db
from auth import require_tenant
from models import AIInsight, now_iso, gen_id

router = APIRouter(tags=["analytics"])


# Unit normalization map (to a base for each major dimension)
UNIT_TO_BASE = {
    "kg": ("mass", 1000.0),
    "g": ("mass", 1.0),
    "gram": ("mass", 1.0),
    "grams": ("mass", 1.0),
    "l": ("volume", 1000.0),
    "ml": ("volume", 1.0),
    "liter": ("volume", 1000.0),
    "litre": ("volume", 1000.0),
    "pcs": ("count", 1.0),
    "piece": ("count", 1.0),
    "pieces": ("count", 1.0),
    "packet": ("count", 1.0),
    "cylinder": ("count", 1.0),
    "plate": ("count", 1.0),
    "cup": ("count", 1.0),
}


def to_base(qty: float, unit: str):
    u = (unit or "").lower().strip()
    dim, factor = UNIT_TO_BASE.get(u, ("mass", 1.0))
    return dim, qty * factor


def from_base(qty_base: float, unit: str):
    u = (unit or "").lower().strip()
    _, factor = UNIT_TO_BASE.get(u, ("mass", 1.0))
    return qty_base / factor if factor else qty_base


async def _get_tenant_data(tenant_id: str, date_from: str, date_to: str):
    sales = await db.sales.find(
        {"tenant_id": tenant_id, "date": {"$gte": date_from, "$lte": date_to}}, {"_id": 0}
    ).to_list(5000)
    inventory = await db.inventory.find(
        {"tenant_id": tenant_id, "date": {"$gte": date_from, "$lte": date_to}}, {"_id": 0}
    ).to_list(5000)
    stock_issues = await db.stock_issues.find(
        {"tenant_id": tenant_id, "date": {"$gte": date_from, "$lte": date_to}}, {"_id": 0}
    ).to_list(5000)
    inventory_days = await db.inventory_days.find(
        {"tenant_id": tenant_id, "date": {"$gte": date_from, "$lte": date_to}}, {"_id": 0}
    ).to_list(5000)
    materials = await db.raw_materials.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(2000)
    menu_items = await db.menu_items.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(2000)
    boms = await db.boms.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(2000)
    wastage = await db.wastage.find(
        {"tenant_id": tenant_id, "date": {"$gte": date_from, "$lte": date_to}}, {"_id": 0}
    ).to_list(5000)
    purchases = await db.purchases.find(
        {"tenant_id": tenant_id, "date": {"$gte": date_from, "$lte": date_to}}, {"_id": 0}
    ).to_list(5000)
    return sales, inventory, materials, menu_items, boms, wastage, purchases, stock_issues, inventory_days


def _latest_bom_per_item(boms: list):
    latest: Dict[str, dict] = {}
    for b in boms:
        cur = latest.get(b["menu_item_id"])
        if not cur or b.get("version", 1) > cur.get("version", 1):
            latest[b["menu_item_id"]] = b
    return latest


def compute_variations(sales, inventory, materials, menu_items, boms, wastage, stock_issues=None, inventory_days=None, purchases=None):
    """
    Returns 3 result sets:
      - material_variations (kitchen/sales reconciliation): expected_from_sales vs net_used_in_kitchen
      - sales_variations (reverse: possible plates from materials vs actual sales)
      - inventory_variances (storage reconciliation): calculated_ending vs actual_ending
    """
    bom_by_item = _latest_bom_per_item(boms)
    mat_by_id = {m["id"]: m for m in materials}
    item_by_id = {m["id"]: m for m in menu_items}

    # 1. Expected raw material usage from sales (in material's unit)
    expected_use: Dict[str, float] = {}
    for s in sales:
        for line in s.get("items", []):
            qty = line["quantity"]
            bom = bom_by_item.get(line["menu_item_id"])
            if not bom:
                continue
            batch = max(bom.get("batch_size", 1) or 1, 0.0001)
            for ing in bom.get("ingredients", []):
                mat = mat_by_id.get(ing["material_id"])
                if not mat:
                    continue
                # Convert ingredient qty (in ing['unit']) to material's unit
                _, base_qty = to_base(ing["quantity"], ing.get("unit", "g"))
                qty_in_mat_unit = from_base(base_qty, mat.get("unit", "g"))
                total = qty_in_mat_unit * (qty / batch)
                expected_use[mat["id"]] = expected_use.get(mat["id"], 0.0) + total

    # 2. Net kitchen usage per material = taken_out - returned - wastage(material) - staff_food
    actual_use: Dict[str, float] = {}
    materials_with_issues = set()
    for si in (stock_issues or []):
        materials_with_issues.add(si["material_id"])
        actual_use[si["material_id"]] = actual_use.get(si["material_id"], 0.0) + (si.get("quantity") or 0)
    # Subtract returned/staff_food from inventory_days
    for d in (inventory_days or []):
        mid = d["material_id"]
        if mid in actual_use:
            actual_use[mid] -= (d.get("returned_to_storage") or 0)
            actual_use[mid] -= (d.get("staff_food") or 0)
    # Subtract material wastage
    for w in wastage:
        if w.get("kind") == "material" and w.get("material_id"):
            mid = w["material_id"]
            if mid in actual_use:
                actual_use[mid] -= (w.get("quantity") or 0)
    # Fallback only for materials WITHOUT stock_issues entries (legacy inventory)
    for inv in inventory:
        if inv["material_id"] in materials_with_issues:
            continue
        actual = (
            (inv.get("opening_stock") or 0)
            + (inv.get("purchases") or 0)
            - (inv.get("closing_stock") or 0)
            - (inv.get("transfer_out") or 0)
            - (inv.get("wastage") or 0)
            - (inv.get("staff_use") or 0)
        )
        actual_use[inv["material_id"]] = actual_use.get(inv["material_id"], 0.0) + actual

    # Build variation rows
    rows = []
    for mat in materials:
        exp = expected_use.get(mat["id"], 0.0)
        act = actual_use.get(mat["id"], 0.0)
        diff = act - exp
        pct = (diff / exp * 100.0) if exp > 0.0001 else (100.0 if act > 0 else 0.0)
        tol = mat.get("wastage_tolerance", 5.0) or 5.0

        if abs(pct) <= tol:
            severity = "ok"
        elif abs(pct) <= tol * 2:
            severity = "warn"
        else:
            severity = "alert"

        message = ""
        if exp <= 0 and act <= 0:
            severity = "ok"
            message = "No usage today"
        elif diff > 0 and severity != "ok":
            message = (
                f"{mat['name']}: kitchen used {act:.2f} {mat['unit']} after deducting returned/wastage/staff food, "
                f"but sales only need {exp:.2f} {mat['unit']}. "
                f"Extra {abs(diff):.2f} {mat['unit']} — check unbilled sales, portion size, or leakage."
            )
        elif diff < 0 and severity != "ok":
            message = (
                f"{mat['name']}: sales need {exp:.2f} {mat['unit']}, "
                f"but kitchen only used {act:.2f} {mat['unit']}. "
                f"Short by {abs(diff):.2f} {mat['unit']} — check BOM or sales entry."
            )
        else:
            message = f"{mat['name']} matches sales."

        rows.append({
            "material_id": mat["id"],
            "material_name": mat["name"],
            "unit": mat["unit"],
            "expected": round(exp, 3),
            "actual": round(act, 3),
            "difference": round(diff, 3),
            "percent": round(pct, 2),
            "severity": severity,
            "message": message,
        })

    # 3. Reverse: possible sales from actual material usage
    # For each menu item, compute possible_sales = min over ingredients of (actual_mat_used / req_qty_in_mat_unit_per_plate)
    actual_sales: Dict[str, float] = {}
    for s in sales:
        for line in s.get("items", []):
            actual_sales[line["menu_item_id"]] = actual_sales.get(line["menu_item_id"], 0.0) + line["quantity"]

    reverse_rows = []
    for item_id, item in item_by_id.items():
        bom = bom_by_item.get(item_id)
        if not bom or not bom.get("ingredients"):
            continue
        batch = max(bom.get("batch_size", 1) or 1, 0.0001)
        possible_each = []
        for ing in bom["ingredients"]:
            mat = mat_by_id.get(ing["material_id"])
            if not mat:
                continue
            actual_mat = actual_use.get(mat["id"], 0.0)
            _, base_per_batch = to_base(ing["quantity"], ing.get("unit", "g"))
            per_plate_in_mat = from_base(base_per_batch, mat.get("unit", "g")) / batch
            if per_plate_in_mat <= 0:
                continue
            possible_each.append(actual_mat / per_plate_in_mat)
        if not possible_each:
            continue
        possible = min(possible_each)
        actual = actual_sales.get(item_id, 0.0)
        diff = possible - actual
        pct = (diff / possible * 100.0) if possible > 0.0001 else 0.0

        if abs(diff) < 1 or possible <= 0:
            severity = "ok"
            message = f"{item['name']}: stock matches sales."
        elif diff > 0 and abs(pct) > 10:
            severity = "alert"
            message = (
                f"{item['name']}: material used can make ~{possible:.0f} plates, "
                f"but only {actual:.0f} sold. Check wastage, staff food, unbilled sales, or leakage."
            )
        elif diff < 0 and abs(pct) > 10:
            severity = "warn"
            message = (
                f"{item['name']}: sold {actual:.0f} but materials suggest only {possible:.0f} possible. "
                f"Check stock entry or recipe."
            )
        else:
            severity = "ok"
            message = f"{item['name']}: within tolerance."

        reverse_rows.append({
            "menu_item_id": item_id,
            "menu_item_name": item["name"],
            "possible_sales": round(possible, 1),
            "actual_sales": round(actual, 1),
            "difference": round(diff, 1),
            "percent": round(pct, 2),
            "severity": severity,
            "message": message,
        })

    # 4. Inventory storage reconciliation per inventory_day entry
    # purchases_qty per (date, material_id)
    purchases_by_key: Dict[tuple, float] = {}
    for p in (purchases or []):
        for line in p.get("items", []):
            key = (p.get("date"), line.get("material_id"))
            purchases_by_key[key] = purchases_by_key.get(key, 0.0) + (line.get("quantity") or 0)
    # taken_out per (date, material_id)
    taken_by_key: Dict[tuple, float] = {}
    for si in (stock_issues or []):
        key = (si.get("date"), si.get("material_id"))
        taken_by_key[key] = taken_by_key.get(key, 0.0) + (si.get("quantity") or 0)

    inventory_variances = []
    for d in (inventory_days or []):
        mat = mat_by_id.get(d["material_id"])
        if not mat:
            continue
        key = (d["date"], d["material_id"])
        pq = purchases_by_key.get(key, 0.0)
        tq = taken_by_key.get(key, 0.0)
        opening = d.get("opening_stock") or 0
        returned = d.get("returned_to_storage") or 0
        staff = d.get("staff_food") or 0
        leakage = d.get("leakage") or 0
        adj = d.get("adjustment") or 0
        actual_end = d.get("actual_ending_stock") or 0
        calc_end = opening + pq - tq + returned + adj - staff - leakage
        variance = actual_end - calc_end
        tol = mat.get("wastage_tolerance", 5.0) or 5.0
        base = max(calc_end, 1)
        pct = variance / base * 100.0
        if abs(pct) <= tol:
            severity = "ok"
        elif abs(pct) <= tol * 2:
            severity = "warn"
        else:
            severity = "alert"
        if abs(variance) < 0.001:
            msg = f"{mat['name']}: storage tally matches."
        elif variance < 0:
            msg = (
                f"{mat['name']}: storage shows {abs(variance):.2f} {mat['unit']} short. "
                f"Calculated ending {calc_end:.2f}, actual {actual_end:.2f}. "
                f"Check pilferage, missed entry, or weighing error."
            )
        else:
            msg = (
                f"{mat['name']}: storage shows {variance:.2f} {mat['unit']} extra. "
                f"Calculated ending {calc_end:.2f}, actual {actual_end:.2f}. "
                f"Check unrecorded purchase or duplicate return entry."
            )
        inventory_variances.append({
            "date": d["date"],
            "material_id": d["material_id"],
            "material_name": mat["name"],
            "unit": mat["unit"],
            "opening_stock": round(opening, 3),
            "purchases": round(pq, 3),
            "taken_out": round(tq, 3),
            "returned_to_storage": round(returned, 3),
            "adjustment": round(adj, 3),
            "staff_food": round(staff, 3),
            "leakage": round(leakage, 3),
            "calculated_ending": round(calc_end, 3),
            "actual_ending": round(actual_end, 3),
            "variance": round(variance, 3),
            "percent": round(pct, 2),
            "severity": severity,
            "message": msg,
        })

    return rows, reverse_rows, inventory_variances


@router.get("/dashboard")
async def dashboard(date: Optional[str] = None, claims: dict = Depends(require_tenant)):
    today = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    sales, inventory, materials, menu_items, boms, wastage, purchases, stock_issues, inventory_days = await _get_tenant_data(
        claims["tenant_id"], today, today
    )
    rows, reverse_rows, inv_variances = compute_variations(
        sales, inventory, materials, menu_items, boms, wastage, stock_issues, inventory_days, purchases
    )

    total_sales = sum(s.get("total_amount", 0) or 0 for s in sales)
    if not total_sales:
        # fallback: compute from items * unit_price
        total_sales = sum(
            (line.get("quantity", 0) * line.get("unit_price", 0))
            for s in sales for line in s.get("items", [])
        )

    # Cost estimate via BOM
    bom_by_item = _latest_bom_per_item(boms)
    mat_by_id = {m["id"]: m for m in materials}
    total_cost = 0.0
    for s in sales:
        for line in s.get("items", []):
            bom = bom_by_item.get(line["menu_item_id"])
            if not bom:
                continue
            batch = max(bom.get("batch_size", 1) or 1, 0.0001)
            for ing in bom.get("ingredients", []):
                mat = mat_by_id.get(ing["material_id"])
                if not mat:
                    continue
                _, base_qty = to_base(ing["quantity"], ing.get("unit", "g"))
                qty_in_mat = from_base(base_qty, mat.get("unit", "g"))
                total_cost += qty_in_mat * (line["quantity"] / batch) * (mat.get("purchase_rate", 0) or 0)

    gross_profit = total_sales - total_cost

    expected_total = sum((r["expected"] * (mat_by_id.get(r["material_id"], {}).get("purchase_rate", 0) or 0)) for r in rows)
    actual_total = sum((r["actual"] * (mat_by_id.get(r["material_id"], {}).get("purchase_rate", 0) or 0)) for r in rows)
    stock_diff = actual_total - expected_total

    wastage_qty = sum(w.get("quantity", 0) for w in wastage)
    low_stock = [m for m in materials if (m.get("current_stock", 0) or 0) <= (m.get("min_stock", 0) or 0)]
    red_alerts = (
        [r for r in rows if r["severity"] == "alert"]
        + [r for r in reverse_rows if r["severity"] == "alert"]
        + [r for r in inv_variances if r["severity"] == "alert"]
    )
    high_var = [r for r in rows if r["severity"] in ("warn", "alert")] + [r for r in inv_variances if r["severity"] in ("warn", "alert")]

    return {
        "date": today,
        "total_sales": round(total_sales, 2),
        "expected_material_cost": round(expected_total, 2),
        "actual_material_cost": round(actual_total, 2),
        "stock_difference": round(stock_diff, 2),
        "wastage_qty": round(wastage_qty, 2),
        "gross_profit": round(gross_profit, 2),
        "red_alerts_count": len(red_alerts),
        "high_variation_count": len(high_var),
        "low_stock_count": len(low_stock),
        "low_stock_items": low_stock[:10],
        "inventory_variances_count": len([r for r in inv_variances if r["severity"] != "ok"]),
        "inventory_variances": inv_variances[:10],
        "red_alerts": red_alerts[:10],
        "variations": rows[:30],
        "reverse_variations": reverse_rows[:30],
    }


@router.get("/variations")
async def variations(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    claims: dict = Depends(require_tenant),
):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    date_from = date_from or today
    date_to = date_to or today
    sales, inventory, materials, menu_items, boms, wastage, purchases, stock_issues, inventory_days = await _get_tenant_data(
        claims["tenant_id"], date_from, date_to
    )
    rows, reverse_rows, inv_variances = compute_variations(
        sales, inventory, materials, menu_items, boms, wastage, stock_issues, inventory_days, purchases
    )
    return {
        "date_from": date_from,
        "date_to": date_to,
        "material_variations": rows,
        "sales_variations": reverse_rows,
        "inventory_variances": inv_variances,
    }


@router.get("/reports/sales")
async def report_sales(
    date_from: str, date_to: str, claims: dict = Depends(require_tenant)
):
    sales = await db.sales.find(
        {"tenant_id": claims["tenant_id"], "date": {"$gte": date_from, "$lte": date_to}},
        {"_id": 0},
    ).sort("date", -1).to_list(5000)
    total = sum(s.get("total_amount", 0) for s in sales)
    by_day: Dict[str, float] = {}
    for s in sales:
        by_day[s["date"]] = by_day.get(s["date"], 0) + (s.get("total_amount", 0) or 0)
    return {"total": round(total, 2), "by_day": by_day, "sales": sales}


@router.get("/reports/item-costing")
async def report_item_costing(claims: dict = Depends(require_tenant)):
    materials = await db.raw_materials.find({"tenant_id": claims["tenant_id"]}, {"_id": 0}).to_list(2000)
    menu_items = await db.menu_items.find({"tenant_id": claims["tenant_id"]}, {"_id": 0}).to_list(2000)
    boms = await db.boms.find({"tenant_id": claims["tenant_id"]}, {"_id": 0}).to_list(2000)
    bom_by_item = _latest_bom_per_item(boms)
    mat_by_id = {m["id"]: m for m in materials}
    rows = []
    for it in menu_items:
        bom = bom_by_item.get(it["id"])
        cost = 0.0
        if bom:
            batch = max(bom.get("batch_size", 1) or 1, 0.0001)
            for ing in bom.get("ingredients", []):
                mat = mat_by_id.get(ing["material_id"])
                if not mat:
                    continue
                _, base_qty = to_base(ing["quantity"], ing.get("unit", "g"))
                qty_in_mat = from_base(base_qty, mat.get("unit", "g"))
                cost += (qty_in_mat / batch) * (mat.get("purchase_rate", 0) or 0)
        sp = it.get("selling_price", 0) or 0
        margin = sp - cost
        food_cost_pct = (cost / sp * 100) if sp > 0 else 0
        rows.append({
            "menu_item_id": it["id"],
            "name": it["name"],
            "cost": round(cost, 2),
            "selling_price": round(sp, 2),
            "margin": round(margin, 2),
            "food_cost_percent": round(food_cost_pct, 2),
        })
    return rows


@router.get("/reports/wastage")
async def report_wastage(
    date_from: str, date_to: str, claims: dict = Depends(require_tenant)
):
    w = await db.wastage.find(
        {"tenant_id": claims["tenant_id"], "date": {"$gte": date_from, "$lte": date_to}},
        {"_id": 0},
    ).sort("date", -1).to_list(5000)
    total_qty = sum(x.get("quantity", 0) for x in w)
    return {"total_qty": total_qty, "entries": w}


@router.get("/reports/low-stock")
async def report_low_stock(claims: dict = Depends(require_tenant)):
    materials = await db.raw_materials.find({"tenant_id": claims["tenant_id"]}, {"_id": 0}).to_list(2000)
    low = [m for m in materials if (m.get("current_stock", 0) or 0) <= (m.get("min_stock", 0) or 0)]
    return low


# ---------- AI Insights ----------
class AIRequest(BaseModel):
    date: Optional[str] = None


@router.get("/ai-insights")
async def list_ai_insights(claims: dict = Depends(require_tenant)):
    return await db.ai_insights.find(
        {"tenant_id": claims["tenant_id"]}, {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)


@router.post("/ai-insights/generate")
async def generate_ai_insight(body: AIRequest, claims: dict = Depends(require_tenant)):
    tenant = await db.tenants.find_one({"id": claims["tenant_id"]}, {"_id": 0})
    if not tenant:
        raise HTTPException(404, "Tenant not found")

    cost = 2.0
    if (tenant.get("wallet_balance", 0) or 0) < cost:
        raise HTTPException(402, "Insufficient wallet balance. Please top up.")

    today = body.date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")
    sales, inventory, materials, menu_items, boms, wastage, purchases, stock_issues, inventory_days = await _get_tenant_data(
        claims["tenant_id"], week_ago, today
    )
    rows, reverse_rows, inv_variances = compute_variations(
        sales, inventory, materials, menu_items, boms, wastage, stock_issues, inventory_days, purchases
    )

    summary = {
        "today": today,
        "menu_items": [{"name": m["name"]} for m in menu_items[:20]],
        "variations": rows[:15],
        "sales_variations": reverse_rows[:15],
        "wastage_count": len(wastage),
        "wastage_total_qty": sum(w.get("quantity", 0) for w in wastage),
        "low_stock": [{"name": m["name"], "current": m.get("current_stock"), "min": m.get("min_stock"), "unit": m.get("unit")}
                      for m in materials if (m.get("current_stock", 0) or 0) <= (m.get("min_stock", 0) or 0)][:10],
        "total_sales_week": sum(s.get("total_amount", 0) or 0 for s in sales),
    }

    # Call Emergent LLM (Claude Sonnet 4.5)
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        chat = LlmChat(
            api_key=api_key,
            session_id=f"insight-{claims['tenant_id']}-{today}",
            system_message=(
                "You are an AI assistant for small rural restaurants in India. "
                "Generate 4-6 short, very simple, rural-friendly business insights based on the data. "
                "Use everyday language (avoid technical jargon). Each insight should be a single short sentence, "
                "actionable, and reference specific items/materials when possible. "
                "Format: a JSON array of strings only, no extra text."
            ),
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")

        prompt = f"Restaurant data summary:\n{summary}\n\nReturn 4-6 insights as a JSON array of strings."
        resp = await chat.send_message(UserMessage(text=prompt))
        content = resp if isinstance(resp, str) else str(resp)
    except Exception as e:
        content = (
            f'["Could not generate AI insights right now: {str(e)[:80]}. '
            f'Showing data summary: today wastage qty {summary["wastage_total_qty"]}, '
            f'{len(summary["low_stock"])} low-stock items."]'
        )

    # Save insight & charge wallet
    ai = AIInsight(
        tenant_id=claims["tenant_id"],
        date=today,
        content=content,
        title=f"Insights for {today}",
        cost=cost,
    )
    await db.ai_insights.insert_one(ai.model_dump())

    new_balance = max(0, (tenant.get("wallet_balance", 0) or 0) - cost)
    await db.tenants.update_one(
        {"id": tenant["id"]}, {"$set": {"wallet_balance": new_balance, "updated_at": now_iso()}}
    )
    await db.wallet_txns.insert_one({
        "id": gen_id(),
        "tenant_id": tenant["id"],
        "kind": "debit",
        "amount": cost,
        "purpose": "ai_insight",
        "balance_after": new_balance,
        "note": "AI insight generation",
        "created_at": now_iso(),
        "updated_at": now_iso(),
    })

    return {"insight": ai.model_dump(), "wallet_balance": new_balance}

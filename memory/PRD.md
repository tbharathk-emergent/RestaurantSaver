# Restaurant OPS BOM — PRD

## Original Problem Statement
SaaS-based Multi-Tenant, Multi-Whitelabel PWA application for small and rural restaurants to track Sales, Raw Materials, Inventory, BOM, Food Preparation, Wastage, and Variations.

## User Choices (asked & confirmed)
- Authentication: Phone OTP via Pingbix — **MOCKED** (master OTP `123456` always works)
- Razorpay subscription: Build UI/flow now, integrate live keys later — **MOCKED**
- AI Insights: Yes, via Emergent LLM Key with Claude Sonnet 4.5 — **charged to tenant wallet** (₹2 per gen)
- OTP cost: charged to tenant wallet (₹0.25 per OTP)
- Scope: Full MVP across all listed modules
- Design: clean KhataBook style (mobile-first PWA)

## User Personas
1. Super Admin / App Owner — manages SaaS tenants, plans, revenue
2. Tenant Admin / Restaurant Owner — daily ops, settings, staff, reports
3. Staff (manager / cashier / kitchen / store / accountant) — role-scoped data entry (roles modeled; UI shows admin scope)

## Architecture
- **Backend**: FastAPI + Motor + MongoDB; JWT auth; multi-tenant isolation by `tenant_id` claim
- **Frontend**: React 19 + React Router v7 + Tailwind + Shadcn primitives + Sonner toasts + Lucide icons
- **AI**: emergentintegrations LlmChat (anthropic, claude-sonnet-4-5-20250929)
- **Files**: backend split into routes_auth/core/ops/analytics/admin; frontend in src/pages

## What's Been Implemented (29-May-2026)
### Backend
- Auth: phone+OTP (mocked Pingbix), JWT, master OTP `123456`, auto-create tenant on first login
- Multi-tenant CRUD: tenants, users, menu_items, raw_materials, BOMs (versioned), suppliers
- Operations: sales (line items), inventory entries (with current_stock sync), purchases (with stock increment), wastage, prepared food
- Variation Engine: expected vs actual material usage; possible vs real sales (reverse) with severity ok/warn/alert and rural-friendly messages; unit normalization (kg/g/l/ml/pcs/etc.)
- Dashboard aggregates: today's sales, expected/actual cost, stock difference, wastage qty, gross profit estimate, red alerts, low stock
- Reports: sales (by_day), wastage, item-costing (food cost %), low-stock
- AI Insights: Claude Sonnet 4.5 via Emergent LLM Key, ₹2 wallet charge, history persisted
- Wallet: balance, top-up (mocked), txn ledger
- Subscriptions: plans CRUD (super admin), Razorpay create-order + verify-payment (MOCKED), activates tenant subscription
- Super Admin: list tenants with counts, suspend/activate, revenue summary, plans management
- Auto-seed demo tenant on startup with menu, materials, BOMs, sales, inventory

### Frontend (mobile-first, max-w-md, KhataBook style)
- Login (Phone+OTP, master 123456, language picker en/hi/te)
- Dashboard with greeting, daily closing CTA, quick actions, KPI grid, problems list, AI insights CTA
- Bottom nav: Home, Sales, Stock, Menu, More
- Menu Items, Raw Materials (with LOW badge), BOM builder
- Sales (list + new with auto-total), Inventory (list + new with live actual-used), Purchases (list + new), Suppliers
- Wastage (material/prepared), Prepared Food (with wastage % warning)
- Variations page with severity-coded list
- AI Insights with generate button + bullet parsing
- Reports (sales by day, wastage, item costing, low stock)
- Wallet (balance, presets top-up, txn history)
- Subscription (plans, mock Razorpay checkout)
- Settings (name/logo URL/brand color/language)
- Super Admin panel (tenants list, suspend/activate, plans CRUD, MRR)
- Daily Closing wizard (5 steps with checkmarks)
- More page (grouped nav)
- PWA manifest, theme color #16A34A, Outfit + IBM Plex Sans fonts

## Test Results (Iteration 1)
- Backend: 38/38 pass (after fixing 3 ObjectId `_id` leaks in BOM/Sale/Purchase POST returns)
- Frontend: 100% smoke pass on all visited routes

## Backlog / Next Tasks (P0/P1/P2)
**P0 (immediate next)**
- Hook up real Razorpay keys when user provides them
- Hook up real Pingbix SMS gateway when user provides creds
- Add staff/role-scoped UI (currently owner sees everything)

**P1**
- Photo upload for wastage entries (object storage)
- Outlet selector everywhere (multi-outlet workflow)
- Voice input for sales/inventory entry
- Notifications scheduler (push reminders for unentered sales/closing)
- Tenant whitelabel via subdomain (tenantname.restaurantops.app)

**P2**
- Export reports as PDF/CSV
- POS integration adapter
- Offline-first IndexedDB queue for poor connectivity
- AI insights scheduler (auto-generate weekly digest)
- Audit log / staff entry log report
- Outlet comparison report

## Files & Locations
- Backend: `/app/backend/{server,db,auth,models,routes_auth,routes_core,routes_ops,routes_analytics,routes_admin}.py`
- Frontend: `/app/frontend/src/{App.js, api.js, auth.jsx, i18n.jsx, components/Layout.jsx, components/ui-kit.jsx, pages/*.jsx}`
- Tests: `/app/backend/tests/backend_test.py`
- Credentials: `/app/memory/test_credentials.md`

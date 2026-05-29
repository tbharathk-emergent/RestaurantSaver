import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Boxes, IndianRupee, Building2, LogOut, ShieldCheck, Power, PowerOff } from "lucide-react";
import { useAuth } from "@/auth";
import client from "@/api";
import { toast } from "sonner";
import { KPICard, PrimaryButton, TextInput, SelectInput } from "@/components/ui-kit";

export default function SuperAdmin() {
  const { logout } = useAuth();
  const [tab, setTab] = useState("tenants");
  const [tenants, setTenants] = useState([]);
  const [plans, setPlans] = useState([]);
  const [revenue, setRevenue] = useState(null);

  const load = async () => {
    const [t, p, r] = await Promise.all([
      client.get("/admin/tenants"),
      client.get("/admin/plans"),
      client.get("/admin/revenue"),
    ]);
    setTenants(t.data); setPlans(p.data); setRevenue(r.data);
  };
  useEffect(() => { load(); }, []);

  const updateStatus = async (id, status) => {
    await client.patch(`/admin/tenants/${id}/status`, { status });
    toast.success(`Status updated to ${status}`);
    load();
  };

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-green-600 flex items-center justify-center">
              <ShieldCheck size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Super Admin</h1>
              <p className="text-xs text-gray-500">Restaurant OPS — Manage tenants & SaaS</p>
            </div>
          </div>
          <button onClick={logout} className="h-9 px-3 rounded-lg bg-red-50 text-red-600 text-sm font-medium flex items-center gap-1" data-testid="sa-logout">
            <LogOut size={14} /> Logout
          </button>
        </header>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <KPICard testId="sa-rev" label="MRR" value={`₹${revenue?.total_revenue?.toLocaleString("en-IN") || 0}`} accent="success" icon={IndianRupee} />
          <KPICard testId="sa-subs" label="Active Subs" value={revenue?.active_subscriptions || 0} accent="info" />
          <KPICard testId="sa-tenants" label="Tenants" value={tenants.length} accent="neutral" icon={Building2} />
          <KPICard testId="sa-plans" label="Plans" value={plans.length} accent="neutral" icon={Boxes} />
        </div>

        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-4 w-fit">
          {[
            { key: "tenants", label: "Tenants" },
            { key: "plans", label: "Plans" },
          ].map(tt => (
            <button
              key={tt.key}
              onClick={() => setTab(tt.key)}
              data-testid={`sa-tab-${tt.key}`}
              className={`px-4 py-1.5 rounded-md text-sm font-medium ${tab === tt.key ? "bg-white shadow-sm" : "text-gray-600"}`}
            >
              {tt.label}
            </button>
          ))}
        </div>

        {tab === "tenants" && (
          <ul className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100" data-testid="sa-tenants-list">
            {tenants.map(t => (
              <li key={t.id} className="p-3 flex justify-between items-center">
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-xs text-gray-500">
                    {t.slug} · {t.user_count} users · {t.menu_count} items · {t.material_count} materials
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${t.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {t.status}
                  </span>
                  {t.status === "active" ? (
                    <button onClick={() => updateStatus(t.id, "suspended")} className="text-red-600 p-2" title="Suspend" data-testid={`suspend-${t.id}`}>
                      <PowerOff size={16} />
                    </button>
                  ) : (
                    <button onClick={() => updateStatus(t.id, "active")} className="text-green-600 p-2" title="Activate" data-testid={`activate-${t.id}`}>
                      <Power size={16} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {tab === "plans" && <PlansAdmin plans={plans} onReload={load} />}
      </div>
    </div>
  );
}

function PlansAdmin({ plans, onReload }) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    name: "", price: 0, duration_days: 30, max_outlets: 1, max_users: 5,
    max_menu_items: 50, max_materials: 100, reports_access: true, ai_insights: false,
    is_active: true, is_custom: false,
  });
  const save = async () => {
    if (!form.name.trim()) return toast.error("Name required");
    await client.post("/admin/plans", {
      ...form,
      price: parseFloat(form.price) || 0,
      duration_days: parseInt(form.duration_days) || 30,
      max_outlets: parseInt(form.max_outlets) || 1,
      max_users: parseInt(form.max_users) || 1,
      max_menu_items: parseInt(form.max_menu_items) || 1,
      max_materials: parseInt(form.max_materials) || 1,
    });
    toast.success("Plan created");
    setShow(false);
    onReload();
  };

  return (
    <div className="space-y-3">
      <button onClick={() => setShow(true)} data-testid="add-plan-btn" className="h-10 px-4 rounded-lg bg-green-600 text-white text-sm font-medium">+ New Plan</button>
      {show && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3 grid sm:grid-cols-2 gap-3">
          <TextInput label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} testId="plan-name" />
          <TextInput label="Price (₹)" type="number" value={form.price} onChange={(v) => setForm({ ...form, price: v })} testId="plan-price" />
          <TextInput label="Duration (days)" type="number" value={form.duration_days} onChange={(v) => setForm({ ...form, duration_days: v })} testId="plan-dur" />
          <TextInput label="Max Outlets" type="number" value={form.max_outlets} onChange={(v) => setForm({ ...form, max_outlets: v })} testId="plan-out" />
          <TextInput label="Max Users" type="number" value={form.max_users} onChange={(v) => setForm({ ...form, max_users: v })} testId="plan-usr" />
          <TextInput label="Max Menu Items" type="number" value={form.max_menu_items} onChange={(v) => setForm({ ...form, max_menu_items: v })} testId="plan-mi" />
          <TextInput label="Max Materials" type="number" value={form.max_materials} onChange={(v) => setForm({ ...form, max_materials: v })} testId="plan-mat" />
          <SelectInput label="AI Insights" value={form.ai_insights ? "yes" : "no"} onChange={(v) => setForm({ ...form, ai_insights: v === "yes" })} testId="plan-ai"
            options={[{ value: "no", label: "No" }, { value: "yes", label: "Yes" }]} />
          <div className="sm:col-span-2 flex gap-2">
            <PrimaryButton onClick={save} testId="plan-save">Save</PrimaryButton>
            <button onClick={() => setShow(false)} className="h-12 px-4 rounded-lg bg-gray-100">Cancel</button>
          </div>
        </div>
      )}
      <ul className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100" data-testid="sa-plans-list">
        {plans.map(p => (
          <li key={p.id} className="p-3 flex justify-between">
            <div>
              <p className="font-medium">{p.name}</p>
              <p className="text-xs text-gray-500">{p.max_outlets} outlets · {p.max_users} users · AI: {p.ai_insights ? "Yes" : "No"}</p>
            </div>
            <p className="font-semibold">₹{p.price}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

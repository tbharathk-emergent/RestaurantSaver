import { useEffect, useState } from "react";
import { Check, Sparkles, Building2, Users } from "lucide-react";
import Layout from "@/components/Layout";
import { PrimaryButton } from "@/components/ui-kit";
import client from "@/api";
import { toast } from "sonner";

export default function Subscription() {
  const [plans, setPlans] = useState([]);
  const [current, setCurrent] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [p, c] = await Promise.all([client.get("/plans"), client.get("/subscription/current")]);
    setPlans(p.data); setCurrent(c.data);
  };
  useEffect(() => { load(); }, []);

  const subscribe = async (planId) => {
    setBusy(true);
    try {
      const { data } = await client.post("/subscription/create-order", { plan_id: planId });
      // Simulate Razorpay checkout (MOCKED)
      toast.success(`Razorpay order created (MOCKED): ${data.order_id}`);
      await client.post("/subscription/verify-payment", {
        subscription_id: data.subscription_id,
        razorpay_payment_id: `pay_mock_${Date.now()}`,
        razorpay_signature: "mock_sig",
      });
      toast.success("Subscription activated!");
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    } finally { setBusy(false); }
  };

  return (
    <Layout title="Subscription">
      <div className="space-y-4">
        {current && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4" data-testid="current-sub">
            <p className="text-xs text-green-700 font-medium uppercase">Current Plan</p>
            <p className="text-lg font-semibold">{current.plan?.name}</p>
            <p className="text-xs text-gray-600">Valid until: {new Date(current.subscription.expires_at).toLocaleDateString("en-IN")}</p>
          </div>
        )}

        <div className="space-y-3" data-testid="plans-list">
          {plans.map(p => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="text-lg font-semibold" style={{ fontFamily: "Outfit, sans-serif" }}>{p.name}</h3>
                  <p className="text-2xl font-bold text-green-700 mt-1">₹{p.price}<span className="text-sm text-gray-500 font-normal">/mo</span></p>
                </div>
                {current?.plan?.id === p.id && (
                  <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium">Active</span>
                )}
              </div>
              <ul className="space-y-1 text-sm text-gray-700 mt-3">
                <li className="flex items-center gap-2"><Check size={14} className="text-green-600" /> <Building2 size={12} className="text-gray-400" /> {p.max_outlets} outlet(s)</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-green-600" /> <Users size={12} className="text-gray-400" /> {p.max_users} users</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-green-600" /> {p.max_menu_items} menu items</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-green-600" /> {p.max_materials} raw materials</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-green-600" /> Reports access</li>
                {p.ai_insights && <li className="flex items-center gap-2"><Sparkles size={14} className="text-amber-500" /> AI Insights</li>}
              </ul>
              <button
                onClick={() => subscribe(p.id)}
                disabled={busy || current?.plan?.id === p.id}
                data-testid={`sub-${p.id}`}
                className="mt-4 w-full h-11 rounded-lg bg-green-600 text-white font-medium active:bg-green-700 disabled:opacity-50"
              >
                {current?.plan?.id === p.id ? "Current Plan" : `Subscribe via Razorpay`}
              </button>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 text-center">Razorpay integration is MOCKED. Real keys to be plugged later.</p>
      </div>
    </Layout>
  );
}

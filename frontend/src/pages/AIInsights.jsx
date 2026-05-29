import { useEffect, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import Layout from "@/components/Layout";
import { PrimaryButton, EmptyState } from "@/components/ui-kit";
import client from "@/api";
import { toast } from "sonner";

function parseInsightsContent(content) {
  if (!content) return [];
  // Try strict JSON
  try {
    const j = JSON.parse(content);
    if (Array.isArray(j)) return j;
  } catch {}
  // Try to extract a JSON array substring
  const m = content.match(/\[[\s\S]*\]/);
  if (m) {
    try {
      const j = JSON.parse(m[0]);
      if (Array.isArray(j)) return j;
    } catch {}
  }
  // Fallback: split on newlines
  return content.split("\n").map(x => x.trim()).filter(Boolean);
}

export default function AIInsights() {
  const [list, setList] = useState([]);
  const [busy, setBusy] = useState(false);
  const [wallet, setWallet] = useState(null);

  const load = async () => {
    const [a, w] = await Promise.all([client.get("/ai-insights"), client.get("/wallet")]);
    setList(a.data);
    setWallet(w.data.balance);
  };
  useEffect(() => { load(); }, []);

  const generate = async () => {
    setBusy(true);
    try {
      const { data } = await client.post("/ai-insights/generate", {});
      toast.success("New insights ready");
      setWallet(data.wallet_balance);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout title="AI Insights">
      <div className="space-y-4">
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-amber-500 flex items-center justify-center">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <p className="font-semibold">Smart insights powered by Claude</p>
              <p className="text-xs text-gray-600">Costs ₹2 per generation · Wallet: ₹{wallet?.toFixed(2) ?? "—"}</p>
            </div>
          </div>
          <PrimaryButton onClick={generate} disabled={busy} testId="generate-ai-btn">
            {busy ? (<><Loader2 size={16} className="animate-spin" /> Generating...</>) : "Generate New Insights"}
          </PrimaryButton>
        </div>

        {list.length === 0 ? (
          <EmptyState title="No insights yet" hint="Tap above to generate your first AI insights" />
        ) : (
          <ul className="space-y-3" data-testid="ai-list">
            {list.map((i) => {
              const tips = parseInsightsContent(i.content);
              return (
                <li key={i.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-xs text-gray-500 mb-2">{new Date(i.created_at).toLocaleString("en-IN")}</p>
                  <ul className="space-y-2">
                    {tips.map((tip, idx) => (
                      <li key={idx} className="flex gap-2 text-sm leading-snug">
                        <span className="text-amber-500">•</span>
                        <span className="text-gray-800">{typeof tip === "string" ? tip : JSON.stringify(tip)}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Layout>
  );
}

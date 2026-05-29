import { useEffect, useState } from "react";
import { Wallet, TrendingDown, TrendingUp } from "lucide-react";
import Layout from "@/components/Layout";
import { PrimaryButton, TextInput } from "@/components/ui-kit";
import client from "@/api";
import { toast } from "sonner";

export default function WalletPage() {
  const [data, setData] = useState({ balance: 0, transactions: [] });
  const [amount, setAmount] = useState(100);
  const [busy, setBusy] = useState(false);

  const load = () => client.get("/wallet").then(r => setData(r.data));
  useEffect(() => { load(); }, []);

  const topup = async () => {
    setBusy(true);
    try {
      await client.post("/wallet/topup", { amount: parseFloat(amount) });
      toast.success("Wallet topped up (MOCKED)");
      load();
    } catch { toast.error("Failed"); }
    finally { setBusy(false); }
  };

  return (
    <Layout title="Wallet">
      <div className="space-y-4">
        <div className="bg-gradient-to-br from-green-600 to-green-700 text-white rounded-2xl p-5" data-testid="wallet-balance">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
              <Wallet size={20} />
            </div>
            <div>
              <p className="text-xs opacity-90">Balance</p>
              <p className="text-3xl font-bold">₹{data.balance?.toFixed(2)}</p>
            </div>
          </div>
          <p className="text-xs opacity-90 mt-3">Used for OTP (₹0.25) & AI insights (₹2)</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3" data-testid="topup-card">
          <h3 className="font-semibold">Top up</h3>
          <div className="flex gap-2">
            {[50, 100, 500, 1000].map(v => (
              <button
                key={v}
                onClick={() => setAmount(v)}
                data-testid={`topup-${v}`}
                className={`flex-1 h-10 rounded-lg border text-sm font-medium ${amount === v ? "bg-green-600 text-white border-green-600" : "bg-white border-gray-300"}`}
              >
                ₹{v}
              </button>
            ))}
          </div>
          <TextInput label="Custom" type="number" value={amount} onChange={setAmount} testId="topup-amount" />
          <PrimaryButton onClick={topup} disabled={busy} testId="topup-btn">
            {busy ? "Processing..." : "Top up (Mocked Razorpay)"}
          </PrimaryButton>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Transactions</h3>
          {data.transactions.length === 0 ? (
            <p className="text-sm text-gray-500">No transactions yet</p>
          ) : (
            <ul className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100" data-testid="txn-list">
              {data.transactions.map(t => (
                <li key={t.id} className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {t.kind === "credit" ? (
                      <TrendingUp size={16} className="text-green-600" />
                    ) : (
                      <TrendingDown size={16} className="text-red-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium capitalize">{t.purpose}</p>
                      <p className="text-[10px] text-gray-500">{new Date(t.created_at).toLocaleString("en-IN")}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium ${t.kind === "credit" ? "text-green-600" : "text-red-500"}`}>
                      {t.kind === "credit" ? "+" : "-"}₹{t.amount}
                    </p>
                    <p className="text-[10px] text-gray-500">Bal: ₹{t.balance_after?.toFixed(2)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Layout>
  );
}

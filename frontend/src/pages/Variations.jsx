import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, AlertCircle, Warehouse, ChefHat, ArrowLeftRight } from "lucide-react";
import Layout from "@/components/Layout";
import { StatusBadge, EmptyState } from "@/components/ui-kit";
import client from "@/api";

const today = () => new Date().toISOString().slice(0, 10);

export default function Variations() {
  const [data, setData] = useState(null);
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [tab, setTab] = useState("inventory");

  const load = () => client.get("/variations", { params: { date_from: from, date_to: to } })
    .then(r => setData(r.data));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [from, to]);

  const icon = (sev) => sev === "ok" ? <CheckCircle2 size={16} className="text-green-600" />
    : sev === "warn" ? <AlertCircle size={16} className="text-amber-600" />
    : <AlertTriangle size={16} className="text-red-600" />;

  const invCount = (data?.inventory_variances || []).filter(r => r.severity !== "ok").length;
  const kitCount = (data?.material_variations || []).filter(r => r.severity !== "ok").length;
  const salCount = (data?.sales_variations || []).filter(r => r.severity !== "ok").length;

  const tabs = [
    { key: "inventory", label: "Inventory", icon: Warehouse, count: invCount },
    { key: "kitchen", label: "Sales vs Kitchen", icon: ChefHat, count: kitCount },
    { key: "reverse", label: "Sold vs Possible", icon: ArrowLeftRight, count: salCount },
  ];

  return (
    <Layout title="Variations & Problems">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs text-gray-500">From</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} data-testid="var-from"
              className="h-10 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs text-gray-500">To</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} data-testid="var-to"
              className="h-10 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 text-sm" />
          </label>
        </div>

        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {tabs.map(t => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                data-testid={`var-tab-${t.key}`}
                className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-md text-xs font-medium relative ${active ? "bg-white shadow-sm text-gray-900" : "text-gray-600"}`}
              >
                <Icon size={14} /> {t.label}
                {t.count > 0 && (
                  <span className="ml-0.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold">
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {tab === "inventory" && (
          <section>
            <p className="text-xs text-gray-500 mb-2 px-1 leading-snug">
              Storage-level check: <b>Opening + Purchases − Taken Out + Returned + Adjustment − Staff Food</b> vs <b>Actual Ending</b> (physical count).
            </p>
            {!data?.inventory_variances?.length ? (
              <EmptyState title="No inventory entries" hint="Fill the daily Inventory form to see this check" />
            ) : (
              <ul className="space-y-2" data-testid="inv-vars">
                {data.inventory_variances.map((r, i) => (
                  <li key={i} className="bg-white rounded-xl border border-gray-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {icon(r.severity)}
                        <div>
                          <p className="font-medium text-sm">{r.material_name}</p>
                          <p className="text-[10px] text-gray-500">{r.date}</p>
                        </div>
                      </div>
                      <StatusBadge severity={r.severity}>
                        {r.variance > 0 ? "+" : ""}{r.variance} {r.unit}
                      </StatusBadge>
                    </div>
                    <div className="text-xs text-gray-600 mt-2 grid grid-cols-2 gap-2">
                      <div className="bg-gray-50 rounded px-2 py-1">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wide">Calculated Ending</p>
                        <p className="font-mono font-semibold text-gray-800">{r.calculated_ending} {r.unit}</p>
                      </div>
                      <div className="bg-gray-50 rounded px-2 py-1">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wide">Actual Ending</p>
                        <p className="font-mono font-semibold text-gray-800">{r.actual_ending} {r.unit}</p>
                      </div>
                    </div>
                    <div className="text-[10px] text-gray-500 mt-2 grid grid-cols-3 gap-1">
                      <span>Open: <b>{r.opening_stock}</b></span>
                      <span>+Buy: <b>{r.purchases}</b></span>
                      <span>−Out: <b>{r.taken_out}</b></span>
                      <span>+Ret: <b>{r.returned_to_storage}</b></span>
                      <span>±Adj: <b>{r.adjustment}</b></span>
                      <span>−Staff: <b>{r.staff_food}</b></span>
                    </div>
                    {r.message && r.severity !== "ok" && (
                      <p className="text-xs text-gray-700 mt-2 leading-snug">{r.message}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {tab === "kitchen" && (
          <section>
            <p className="text-xs text-gray-500 mb-2 px-1 leading-snug">
              Sales-level check: what sales <b>should</b> have used (Sales × BOM) vs net used in kitchen
              (<b>Taken Out − Returned − Wastage − Staff Food</b>).
            </p>
            {!data?.material_variations?.length ? (
              <EmptyState title="No data" hint="Add sales + stock taken out to see comparison" />
            ) : (
              <ul className="space-y-2" data-testid="kitchen-vars">
                {data.material_variations.map((r, i) => (
                  <li key={i} className="bg-white rounded-xl border border-gray-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {icon(r.severity)}
                        <p className="font-medium text-sm">{r.material_name}</p>
                      </div>
                      <StatusBadge severity={r.severity}>{r.percent > 0 ? "+" : ""}{r.percent}%</StatusBadge>
                    </div>
                    <div className="text-xs text-gray-600 mt-2 grid grid-cols-2 gap-2">
                      <div className="bg-gray-50 rounded px-2 py-1">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wide">Sales need</p>
                        <p className="font-mono font-semibold text-gray-800">{r.expected} {r.unit}</p>
                      </div>
                      <div className="bg-gray-50 rounded px-2 py-1">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wide">Net kitchen use</p>
                        <p className="font-mono font-semibold text-gray-800">{r.actual} {r.unit}</p>
                      </div>
                    </div>
                    {r.message && r.severity !== "ok" && (
                      <p className="text-xs text-gray-700 mt-2 leading-snug">{r.message}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {tab === "reverse" && (
          <section>
            <p className="text-xs text-gray-500 mb-2 px-1 leading-snug">
              Reverse check: from net kitchen usage, how many plates could you have made? Compare with actual sales.
            </p>
            {!data?.sales_variations?.length ? (
              <EmptyState title="No data" />
            ) : (
              <ul className="space-y-2" data-testid="sales-vars">
                {data.sales_variations.map((r, i) => (
                  <li key={i} className="bg-white rounded-xl border border-gray-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {icon(r.severity)}
                        <p className="font-medium text-sm">{r.menu_item_name}</p>
                      </div>
                      <StatusBadge severity={r.severity}>diff {r.difference}</StatusBadge>
                    </div>
                    <div className="text-xs text-gray-600 mt-2 grid grid-cols-2 gap-2">
                      <div className="bg-gray-50 rounded px-2 py-1">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wide">Possible plates</p>
                        <p className="font-mono font-semibold text-gray-800">{r.possible_sales}</p>
                      </div>
                      <div className="bg-gray-50 rounded px-2 py-1">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wide">Actually sold</p>
                        <p className="font-mono font-semibold text-gray-800">{r.actual_sales}</p>
                      </div>
                    </div>
                    {r.message && r.severity !== "ok" && (
                      <p className="text-xs text-gray-700 mt-2 leading-snug">{r.message}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </Layout>
  );
}

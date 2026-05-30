import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, AlertCircle } from "lucide-react";
import Layout from "@/components/Layout";
import { StatusBadge, EmptyState } from "@/components/ui-kit";
import client from "@/api";

const today = () => new Date().toISOString().slice(0, 10);

export default function Variations() {
  const [data, setData] = useState(null);
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());

  const load = () => client.get("/variations", { params: { date_from: from, date_to: to } }).then(r => setData(r.data));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [from, to]);

  const icon = (sev) => sev === "ok" ? <CheckCircle2 size={16} className="text-green-600" />
    : sev === "warn" ? <AlertCircle size={16} className="text-amber-600" />
    : <AlertTriangle size={16} className="text-red-600" />;

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

        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Sales vs Stock Taken Out</h3>
          <p className="text-xs text-gray-500 mb-2 px-1 leading-snug">
            Compares what sales <i>should</i> have used (from BOM) vs what you actually took out of stock.
          </p>
          {!data?.material_variations?.length ? (
            <EmptyState title="No data" hint="Add sales + stock taken out to see comparison" />
          ) : (
            <ul className="space-y-2" data-testid="material-vars">
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
                      <p className="font-semibold text-gray-800">{r.expected} {r.unit}</p>
                    </div>
                    <div className="bg-gray-50 rounded px-2 py-1">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">Taken out</p>
                      <p className="font-semibold text-gray-800">{r.actual} {r.unit}</p>
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

        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Possible vs Real Sales</h3>
          {!data?.sales_variations?.length ? (
            <p className="text-xs text-gray-500">No data</p>
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
                  <p className="text-xs text-gray-600 mt-1">
                    Possible: <b>{r.possible_sales}</b> · Actual sold: <b>{r.actual_sales}</b>
                  </p>
                  {r.message && r.severity !== "ok" && (
                    <p className="text-xs text-gray-700 mt-2 leading-snug">{r.message}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Layout>
  );
}

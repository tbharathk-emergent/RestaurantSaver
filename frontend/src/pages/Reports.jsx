import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import client from "@/api";
import { EmptyState } from "@/components/ui-kit";

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

export default function Reports() {
  const [from, setFrom] = useState(daysAgo(7));
  const [to, setTo] = useState(today());
  const [sales, setSales] = useState(null);
  const [wastage, setWastage] = useState(null);
  const [costing, setCosting] = useState([]);
  const [lowStock, setLowStock] = useState([]);

  useEffect(() => {
    Promise.all([
      client.get("/reports/sales", { params: { date_from: from, date_to: to } }),
      client.get("/reports/wastage", { params: { date_from: from, date_to: to } }),
      client.get("/reports/item-costing"),
      client.get("/reports/low-stock"),
    ]).then(([s, w, c, l]) => {
      setSales(s.data); setWastage(w.data); setCosting(c.data); setLowStock(l.data);
    });
  }, [from, to]);

  return (
    <Layout title="Reports">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <label><span className="text-xs text-gray-500">From</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 text-sm" data-testid="rep-from" /></label>
          <label><span className="text-xs text-gray-500">To</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 text-sm" data-testid="rep-to" /></label>
        </div>

        <section data-testid="rep-sales">
          <h3 className="font-semibold mb-2">Sales</h3>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500">Period Total</p>
            <p className="text-3xl font-bold text-green-700">₹{sales?.total?.toLocaleString("en-IN") ?? "—"}</p>
            {sales?.by_day && Object.keys(sales.by_day).length > 0 && (
              <div className="mt-3 space-y-1">
                {Object.entries(sales.by_day).sort().map(([d, v]) => (
                  <div key={d} className="flex justify-between text-sm">
                    <span className="text-gray-600">{d}</span>
                    <span className="font-medium">₹{v.toLocaleString("en-IN")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section data-testid="rep-wastage">
          <h3 className="font-semibold mb-2">Wastage</h3>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500">Total Entries</p>
            <p className="text-2xl font-bold">{wastage?.entries?.length ?? 0}</p>
            <p className="text-sm text-gray-500 mt-1">Total quantity: {wastage?.total_qty?.toFixed(2) ?? 0}</p>
          </div>
        </section>

        <section data-testid="rep-costing">
          <h3 className="font-semibold mb-2">Item Costing</h3>
          {costing.length === 0 ? (
            <EmptyState title="Add BOM to see costing" />
          ) : (
            <ul className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {costing.map(r => (
                <li key={r.menu_item_id} className="p-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium">{r.name}</p>
                    <p className="text-xs text-gray-500">Cost ₹{r.cost} · Sell ₹{r.selling_price}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${r.margin >= 0 ? "text-green-600" : "text-red-600"}`}>₹{r.margin}</p>
                    <p className="text-[10px] text-gray-500">Food Cost {r.food_cost_percent}%</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section data-testid="rep-low-stock">
          <h3 className="font-semibold mb-2">Low Stock</h3>
          {lowStock.length === 0 ? (
            <p className="text-sm text-green-700 bg-green-50 p-3 rounded-lg">✓ All materials above minimum</p>
          ) : (
            <ul className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {lowStock.map(m => (
                <li key={m.id} className="p-3 flex justify-between">
                  <span>{m.name}</span>
                  <span className="text-red-600 font-medium">{m.current_stock} {m.unit} / min {m.min_stock}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Layout>
  );
}

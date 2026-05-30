import { useEffect, useState, useCallback } from "react";
import { Save, AlertTriangle, CheckCircle2, AlertCircle, Info } from "lucide-react";
import Layout from "@/components/Layout";
import { TextInput, EmptyState, StatusBadge } from "@/components/ui-kit";
import client from "@/api";
import { toast } from "sonner";

const today = () => new Date().toISOString().slice(0, 10);
const num = (v) => (v === "" || v == null ? 0 : parseFloat(v) || 0);

export default function InventoryDay() {
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await client.get(`/inventory-day/by-date/${date}`);
      setRows(data);
    } finally { setLoading(false); }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const recompute = (r) => {
    const calc = num(r.opening_stock) + num(r.purchases_qty) - num(r.taken_out_qty)
      + num(r.returned_to_storage) + num(r.adjustment) - num(r.staff_food) - num(r.leakage);
    const variance = num(r.actual_ending_stock) - calc;
    return { calculated_ending_stock: calc, variance };
  };

  const update = (idx, key, val) => {
    setRows((prev) => {
      const next = [...prev];
      const r = { ...next[idx], [key]: val };
      const { calculated_ending_stock, variance } = recompute(r);
      next[idx] = { ...r, calculated_ending_stock, variance };
      return next;
    });
  };

  const save = async (r, idx) => {
    setBusy((b) => ({ ...b, [r.material_id]: true }));
    try {
      const { data } = await client.post("/inventory-day", {
        date,
        material_id: r.material_id,
        opening_stock: num(r.opening_stock),
        returned_to_storage: num(r.returned_to_storage),
        staff_food: num(r.staff_food),
        leakage: num(r.leakage),
        adjustment: num(r.adjustment),
        actual_ending_stock: num(r.actual_ending_stock),
        notes: r.notes || "",
      });
      setRows((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], ...data, material_name: r.material_name, unit: r.unit };
        return next;
      });
      toast.success(`${r.material_name} saved`);
    } catch {
      toast.error("Save failed");
    } finally {
      setBusy((b) => ({ ...b, [r.material_id]: false }));
    }
  };

  const sev = (r) => {
    const tol = 5; // visual hint only; real severity calculated server-side
    const base = Math.max(Math.abs(r.calculated_ending_stock) || 1, 1);
    const pct = Math.abs((r.variance || 0) / base * 100);
    if (Math.abs(r.variance || 0) < 0.001) return "ok";
    if (pct <= tol) return "ok";
    if (pct <= tol * 2) return "warn";
    return "alert";
  };

  const icon = (s) => s === "ok" ? <CheckCircle2 size={14} className="text-green-600" />
    : s === "warn" ? <AlertCircle size={14} className="text-amber-600" />
    : <AlertTriangle size={14} className="text-red-600" />;

  return (
    <Layout title="Inventory (Storage)">
      <div className="space-y-3">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex gap-2">
          <Info size={16} className="text-blue-700 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-900 leading-snug">
            <b>Storage reconciliation</b> for each material per day. Purchases and Taken Out are auto-calculated.
            Enter <b>Opening</b>, <b>Returned</b>, <b>Adjustment</b>, <b>Staff Food</b>, and <b>Actual Ending</b> (physical count).
            System checks if numbers add up.
          </p>
        </div>

        <TextInput label="Date" type="date" value={date} onChange={setDate} testId="invday-date" />

        {loading ? (
          <p className="text-sm text-gray-500 text-center py-4">Loading...</p>
        ) : rows.length === 0 ? (
          <EmptyState title="No materials" hint="Add raw materials first" />
        ) : (
          <ul className="space-y-3" data-testid="invday-rows">
            {rows.map((r, idx) => {
              const s = sev(r);
              const auto = num(r.purchases_qty) > 0 || num(r.taken_out_qty) > 0 || num(r.wastage_qty) > 0;
              return (
                <li key={r.material_id} className="bg-white rounded-xl border border-gray-200 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {icon(s)}
                      <h3 className="font-semibold">{r.material_name}</h3>
                      <span className="text-xs text-gray-500">({r.unit})</span>
                    </div>
                    <StatusBadge severity={s}>
                      {r.variance > 0 ? `+${r.variance}` : r.variance} {r.unit}
                    </StatusBadge>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <NumberField label="Opening" value={r.opening_stock} onChange={(v) => update(idx, "opening_stock", v)} testId={`invday-open-${idx}`} />
                    <ReadOnly label="+ Purchases" value={r.purchases_qty} hint={auto ? "auto" : ""} />
                    <ReadOnly label="− Taken Out" value={r.taken_out_qty} hint={auto ? "auto" : ""} />
                    <NumberField label="+ Returned" value={r.returned_to_storage} onChange={(v) => update(idx, "returned_to_storage", v)} testId={`invday-ret-${idx}`} />
                    <NumberField label="− Staff Food" value={r.staff_food} onChange={(v) => update(idx, "staff_food", v)} testId={`invday-staff-${idx}`} />
                    <NumberField label="− Leakage" value={r.leakage} onChange={(v) => update(idx, "leakage", v)} testId={`invday-leak-${idx}`} />
                    <NumberField label="± Adjustment" value={r.adjustment} onChange={(v) => update(idx, "adjustment", v)} testId={`invday-adj-${idx}`} />
                  </div>

                  <div className="mt-3 bg-gray-50 rounded-lg p-3 grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">Calculated Ending</p>
                      <p className="font-mono font-semibold text-gray-800">{(r.calculated_ending_stock || 0).toFixed(2)} {r.unit}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">Actual Ending</p>
                      <input
                        type="number"
                        step="0.01"
                        value={r.actual_ending_stock ?? ""}
                        onChange={(e) => update(idx, "actual_ending_stock", e.target.value)}
                        data-testid={`invday-actual-${idx}`}
                        className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-base font-mono font-semibold focus:ring-2 focus:ring-green-500 outline-none"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => save(r, idx)}
                    disabled={busy[r.material_id]}
                    data-testid={`invday-save-${idx}`}
                    className="mt-2 w-full h-10 rounded-lg bg-green-600 text-white text-sm font-medium flex items-center justify-center gap-2 active:bg-green-700 disabled:opacity-50"
                  >
                    <Save size={14} /> {busy[r.material_id] ? "Saving..." : "Save"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Layout>
  );
}

function NumberField({ label, value, onChange, testId }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-0.5">{label}</span>
      <input
        type="number"
        step="0.01"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testId}
        className="h-9 w-full rounded-md border border-gray-300 bg-gray-50 px-2 text-sm font-mono focus:ring-2 focus:ring-green-500 focus:bg-white outline-none"
        placeholder="0"
      />
    </label>
  );
}

function ReadOnly({ label, value, hint }) {
  return (
    <div>
      <span className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-0.5">
        {label} {hint && <span className="text-[9px] text-blue-600 ml-1">({hint})</span>}
      </span>
      <div className="h-9 w-full rounded-md border border-gray-200 bg-gray-100 px-2 text-sm font-mono flex items-center text-gray-700">
        {Number(value || 0).toFixed(2)}
      </div>
    </div>
  );
}

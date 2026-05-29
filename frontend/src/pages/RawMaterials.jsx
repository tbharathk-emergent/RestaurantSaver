import { useEffect, useState } from "react";
import { Plus, Trash2, Package2 } from "lucide-react";
import Layout from "@/components/Layout";
import { TextInput, SelectInput, PrimaryButton, EmptyState } from "@/components/ui-kit";
import client from "@/api";
import { toast } from "sonner";

const UNITS = ["kg", "g", "l", "ml", "pcs", "packet", "cylinder"];

export default function RawMaterials() {
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", unit: "kg", purchase_rate: "", min_stock: "", current_stock: "", wastage_tolerance: 5, category: "General" });

  const load = () => client.get("/raw-materials").then(r => setItems(r.data));
  useEffect(() => { load(); }, []);

  const reset = () => setForm({ name: "", unit: "kg", purchase_rate: "", min_stock: "", current_stock: "", wastage_tolerance: 5, category: "General" });

  const save = async () => {
    if (!form.name.trim()) return toast.error("Enter name");
    const body = {
      name: form.name, unit: form.unit, category: form.category,
      purchase_rate: parseFloat(form.purchase_rate) || 0,
      min_stock: parseFloat(form.min_stock) || 0,
      current_stock: parseFloat(form.current_stock) || 0,
      wastage_tolerance: parseFloat(form.wastage_tolerance) || 5,
    };
    try {
      if (editing) await client.patch(`/raw-materials/${editing}`, body);
      else await client.post("/raw-materials", body);
      toast.success("Saved");
      setShowForm(false); setEditing(null); reset(); load();
    } catch { toast.error("Failed"); }
  };

  const edit = (m) => {
    setEditing(m.id);
    setForm({ ...m, purchase_rate: m.purchase_rate, min_stock: m.min_stock, current_stock: m.current_stock, wastage_tolerance: m.wastage_tolerance });
    setShowForm(true);
  };

  const remove = async (id) => {
    if (!window.confirm("Delete?")) return;
    await client.delete(`/raw-materials/${id}`);
    toast.success("Deleted"); load();
  };

  return (
    <Layout title="Raw Materials">
      <div className="space-y-3">
        <button
          data-testid="add-material-btn"
          onClick={() => { setEditing(null); reset(); setShowForm(true); }}
          className="w-full h-12 rounded-lg bg-green-600 text-white font-medium flex items-center justify-center gap-2"
        >
          <Plus size={18} /> Add Raw Material
        </button>

        {showForm && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3" data-testid="material-form">
            <TextInput label="Material Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} testId="mat-name" />
            <div className="grid grid-cols-2 gap-3">
              <SelectInput label="Unit" value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} testId="mat-unit"
                options={UNITS.map(u => ({ value: u, label: u }))} />
              <TextInput label="Purchase Rate (₹)" type="number" value={form.purchase_rate} onChange={(v) => setForm({ ...form, purchase_rate: v })} testId="mat-rate" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TextInput label="Current Stock" type="number" value={form.current_stock} onChange={(v) => setForm({ ...form, current_stock: v })} testId="mat-stock" />
              <TextInput label="Min Stock" type="number" value={form.min_stock} onChange={(v) => setForm({ ...form, min_stock: v })} testId="mat-min" />
            </div>
            <TextInput label="Wastage Tolerance (%)" type="number" value={form.wastage_tolerance} onChange={(v) => setForm({ ...form, wastage_tolerance: v })} testId="mat-tol" />
            <div className="flex gap-2">
              <PrimaryButton onClick={save} testId="mat-save">Save</PrimaryButton>
              <button onClick={() => { setShowForm(false); setEditing(null); }} className="h-12 px-4 rounded-lg bg-gray-100" data-testid="mat-cancel">Cancel</button>
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <EmptyState title="No raw materials yet" hint="Add rice, oil, milk, etc." />
        ) : (
          <ul className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100" data-testid="materials-list">
            {items.map((m) => {
              const low = (m.current_stock || 0) <= (m.min_stock || 0);
              return (
                <li key={m.id} className="flex items-center justify-between p-3 active:bg-gray-50">
                  <div onClick={() => edit(m)} className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 flex items-center gap-2">
                      {m.name}
                      {low && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium">LOW</span>}
                    </p>
                    <p className="text-xs text-gray-500">
                      Stock: {m.current_stock} {m.unit} · ₹{m.purchase_rate}/{m.unit} · Min: {m.min_stock}
                    </p>
                  </div>
                  <button onClick={() => remove(m.id)} className="text-red-500 p-2" data-testid={`del-mat-${m.id}`}>
                    <Trash2 size={16} />
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

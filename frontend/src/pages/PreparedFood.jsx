import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import Layout from "@/components/Layout";
import { TextInput, SelectInput, PrimaryButton, EmptyState } from "@/components/ui-kit";
import client from "@/api";
import { toast } from "sonner";

const today = () => new Date().toISOString().slice(0, 10);

export default function PreparedFood() {
  const [list, setList] = useState([]);
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: today(), menu_item_id: "", prepared_qty: 0, sold_qty: 0, leftover_qty: 0, wasted_qty: 0, reused_qty: 0, staff_food_qty: 0 });

  const load = async () => {
    const [p, it] = await Promise.all([client.get("/prepared-food"), client.get("/menu-items")]);
    setList(p.data); setItems(it.data);
    if (!form.menu_item_id && it.data[0]) setForm(f => ({ ...f, menu_item_id: it.data[0].id }));
  };
  useEffect(() => { load(); }, []);

  const itMap = Object.fromEntries(items.map(i => [i.id, i]));

  const save = async () => {
    if (!form.menu_item_id) return toast.error("Pick menu item");
    const body = {
      date: form.date,
      menu_item_id: form.menu_item_id,
      prepared_qty: parseFloat(form.prepared_qty) || 0,
      sold_qty: parseFloat(form.sold_qty) || 0,
      leftover_qty: parseFloat(form.leftover_qty) || 0,
      wasted_qty: parseFloat(form.wasted_qty) || 0,
      reused_qty: parseFloat(form.reused_qty) || 0,
      staff_food_qty: parseFloat(form.staff_food_qty) || 0,
    };
    await client.post("/prepared-food", body);
    toast.success("Saved");
    setShowForm(false);
    load();
  };

  const wastagePercent = (p) => p.prepared_qty > 0 ? (p.wasted_qty / p.prepared_qty * 100) : 0;

  return (
    <Layout title="Prepared Food">
      <div className="space-y-3">
        <button onClick={() => setShowForm(true)} className="w-full h-12 rounded-lg bg-green-600 text-white font-medium flex items-center justify-center gap-2" data-testid="add-prep-btn">
          <Plus size={18} /> Add Batch
        </button>

        {showForm && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3" data-testid="prep-form">
            <TextInput label="Date" type="date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} testId="prep-date" />
            <SelectInput label="Menu Item" value={form.menu_item_id} onChange={(v) => setForm({ ...form, menu_item_id: v })} testId="prep-item"
              options={items.map(i => ({ value: i.id, label: i.name }))} />
            <div className="grid grid-cols-2 gap-3">
              <TextInput label="Prepared" type="number" value={form.prepared_qty} onChange={(v) => setForm({ ...form, prepared_qty: v })} testId="prep-prepared" />
              <TextInput label="Sold" type="number" value={form.sold_qty} onChange={(v) => setForm({ ...form, sold_qty: v })} testId="prep-sold" />
              <TextInput label="Leftover" type="number" value={form.leftover_qty} onChange={(v) => setForm({ ...form, leftover_qty: v })} testId="prep-left" />
              <TextInput label="Wasted" type="number" value={form.wasted_qty} onChange={(v) => setForm({ ...form, wasted_qty: v })} testId="prep-waste" />
              <TextInput label="Reused" type="number" value={form.reused_qty} onChange={(v) => setForm({ ...form, reused_qty: v })} testId="prep-reused" />
              <TextInput label="Staff Food" type="number" value={form.staff_food_qty} onChange={(v) => setForm({ ...form, staff_food_qty: v })} testId="prep-staff" />
            </div>
            <div className="flex gap-2">
              <PrimaryButton onClick={save} testId="prep-save">Save</PrimaryButton>
              <button onClick={() => setShowForm(false)} className="h-12 px-4 rounded-lg bg-gray-100">Cancel</button>
            </div>
          </div>
        )}

        {list.length === 0 ? (
          <EmptyState title="No batches tracked yet" />
        ) : (
          <ul className="space-y-2" data-testid="prep-list">
            {list.map(p => {
              const wpct = wastagePercent(p);
              return (
                <li key={p.id} className="bg-white rounded-xl border border-gray-200 p-3">
                  <div className="flex justify-between">
                    <p className="font-medium">{itMap[p.menu_item_id]?.name || "—"}</p>
                    <p className="text-xs text-gray-500">{p.date}</p>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Prep {p.prepared_qty} · Sold {p.sold_qty} · Waste {p.wasted_qty}
                  </p>
                  {wpct > 5 && (
                    <p className="mt-2 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">
                      {wpct.toFixed(0)}% wastage today. Consider preparing less tomorrow.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Layout>
  );
}

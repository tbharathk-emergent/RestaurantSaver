import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import Layout from "@/components/Layout";
import { TextInput, SelectInput, PrimaryButton, EmptyState } from "@/components/ui-kit";
import client from "@/api";
import { toast } from "sonner";

const today = () => new Date().toISOString().slice(0, 10);

export function InventoryList() {
  const [rows, setRows] = useState([]);
  const [materials, setMaterials] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([client.get("/inventory"), client.get("/raw-materials")])
      .then(([i, m]) => { setRows(i.data); setMaterials(m.data); });
  }, []);

  const matMap = Object.fromEntries(materials.map(m => [m.id, m]));

  return (
    <Layout title="Stock Entries">
      <div className="space-y-3">
        <button
          onClick={() => navigate("/inventory/new")}
          data-testid="add-inv-btn"
          className="w-full h-12 rounded-lg bg-green-600 text-white font-medium flex items-center justify-center gap-2"
        >
          <Plus size={18} /> New Stock Entry
        </button>

        {rows.length === 0 ? (
          <EmptyState title="No stock entries yet" />
        ) : (
          <ul className="space-y-2" data-testid="inventory-list">
            {rows.map((r) => {
              const mat = matMap[r.material_id];
              const actual = (r.opening_stock || 0) + (r.purchases || 0) - (r.closing_stock || 0) - (r.transfer_out || 0) - (r.wastage || 0) - (r.staff_use || 0);
              return (
                <li key={r.id} className="bg-white rounded-xl border border-gray-200 p-3">
                  <div className="flex justify-between">
                    <p className="font-medium">{mat?.name || "—"}</p>
                    <p className="text-xs text-gray-500">{r.date}</p>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Open {r.opening_stock} + Buy {r.purchases} − Close {r.closing_stock} = <b>{actual.toFixed(2)} {mat?.unit || ""} used</b>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Layout>
  );
}

export function InventoryNew() {
  const navigate = useNavigate();
  const [materials, setMaterials] = useState([]);
  const [form, setForm] = useState({
    date: today(), material_id: "",
    opening_stock: 0, purchases: 0, closing_stock: 0,
    transfer_out: 0, wastage: 0, staff_use: 0,
  });

  useEffect(() => {
    client.get("/raw-materials").then(r => {
      setMaterials(r.data);
      if (r.data[0]) setForm(f => ({ ...f, material_id: r.data[0].id }));
    });
  }, []);

  const save = async () => {
    if (!form.material_id) return toast.error("Pick material");
    try {
      await client.post("/inventory", {
        ...form,
        opening_stock: parseFloat(form.opening_stock) || 0,
        purchases: parseFloat(form.purchases) || 0,
        closing_stock: parseFloat(form.closing_stock) || 0,
        transfer_out: parseFloat(form.transfer_out) || 0,
        wastage: parseFloat(form.wastage) || 0,
        staff_use: parseFloat(form.staff_use) || 0,
      });
      toast.success("Stock entry saved");
      navigate("/inventory");
    } catch { toast.error("Failed"); }
  };

  const actual = (parseFloat(form.opening_stock) || 0) + (parseFloat(form.purchases) || 0)
    - (parseFloat(form.closing_stock) || 0) - (parseFloat(form.transfer_out) || 0)
    - (parseFloat(form.wastage) || 0) - (parseFloat(form.staff_use) || 0);

  const mat = materials.find(m => m.id === form.material_id);

  return (
    <Layout title="New Stock Entry">
      <div className="space-y-3">
        <TextInput label="Date" type="date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} testId="inv-date" />
        <SelectInput label="Material" value={form.material_id} onChange={(v) => setForm({ ...form, material_id: v })} testId="inv-mat"
          options={materials.map(m => ({ value: m.id, label: `${m.name} (${m.unit})` }))} />
        <div className="grid grid-cols-2 gap-3">
          <TextInput label={`Opening Stock (${mat?.unit || ""})`} type="number" value={form.opening_stock} onChange={(v) => setForm({ ...form, opening_stock: v })} testId="inv-open" />
          <TextInput label="Purchases" type="number" value={form.purchases} onChange={(v) => setForm({ ...form, purchases: v })} testId="inv-buy" />
          <TextInput label="Closing Stock" type="number" value={form.closing_stock} onChange={(v) => setForm({ ...form, closing_stock: v })} testId="inv-close" />
          <TextInput label="Transfer Out" type="number" value={form.transfer_out} onChange={(v) => setForm({ ...form, transfer_out: v })} testId="inv-trans" />
          <TextInput label="Wastage" type="number" value={form.wastage} onChange={(v) => setForm({ ...form, wastage: v })} testId="inv-waste" />
          <TextInput label="Staff Use" type="number" value={form.staff_use} onChange={(v) => setForm({ ...form, staff_use: v })} testId="inv-staff" />
        </div>

        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex justify-between items-center">
          <span className="text-sm">Actual Used</span>
          <span className="text-2xl font-bold text-green-700">{actual.toFixed(2)} {mat?.unit || ""}</span>
        </div>

        <PrimaryButton onClick={save} testId="save-inv-btn">Save Entry</PrimaryButton>
      </div>
    </Layout>
  );
}

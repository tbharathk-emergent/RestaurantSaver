import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import Layout from "@/components/Layout";
import { TextInput, SelectInput, PrimaryButton, EmptyState } from "@/components/ui-kit";
import client from "@/api";
import { toast } from "sonner";

const today = () => new Date().toISOString().slice(0, 10);

export function WastageList() {
  const [list, setList] = useState([]);
  const [mats, setMats] = useState([]);
  const [items, setItems] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([client.get("/wastage"), client.get("/raw-materials"), client.get("/menu-items")])
      .then(([w, m, i]) => { setList(w.data); setMats(m.data); setItems(i.data); });
  }, []);
  const matMap = Object.fromEntries(mats.map(m => [m.id, m]));
  const itMap = Object.fromEntries(items.map(i => [i.id, i]));

  const remove = async (id) => {
    if (!window.confirm("Delete?")) return;
    await client.delete(`/wastage/${id}`);
    toast.success("Deleted");
    setList(list.filter(x => x.id !== id));
  };

  return (
    <Layout title="Wastage">
      <div className="space-y-3">
        <button onClick={() => navigate("/wastage/new")} className="w-full h-12 rounded-lg bg-green-600 text-white font-medium flex items-center justify-center gap-2" data-testid="add-waste-btn">
          <Plus size={18} /> Add Wastage
        </button>
        {list.length === 0 ? (
          <EmptyState title="No wastage recorded" hint="Track what gets wasted to reduce loss" />
        ) : (
          <ul className="space-y-2" data-testid="wastage-list">
            {list.map(w => {
              const name = w.kind === "material" ? matMap[w.material_id]?.name : itMap[w.menu_item_id]?.name;
              const unit = w.kind === "material" ? matMap[w.material_id]?.unit : itMap[w.menu_item_id]?.unit;
              return (
                <li key={w.id} className="bg-white rounded-xl border border-gray-200 p-3 flex justify-between items-start">
                  <div>
                    <p className="font-medium">{name || "—"} · {w.quantity} {unit || ""}</p>
                    <p className="text-xs text-gray-500">{w.date} · {w.reason || "No reason"} · {w.staff_name || "—"}</p>
                  </div>
                  <button onClick={() => remove(w.id)} className="text-red-500 p-2"><Trash2 size={16} /></button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Layout>
  );
}

export function WastageNew() {
  const navigate = useNavigate();
  const [mats, setMats] = useState([]);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({
    date: today(), kind: "material", material_id: "", menu_item_id: "",
    quantity: 0, reason: "", staff_name: "",
  });

  useEffect(() => {
    Promise.all([client.get("/raw-materials"), client.get("/menu-items")])
      .then(([m, i]) => {
        setMats(m.data); setItems(i.data);
        setForm(f => ({
          ...f,
          material_id: m.data[0]?.id || "",
          menu_item_id: i.data[0]?.id || "",
        }));
      });
  }, []);

  const save = async () => {
    if (form.kind === "material" && !form.material_id) return toast.error("Pick material");
    if (form.kind === "prepared" && !form.menu_item_id) return toast.error("Pick item");
    if (!form.quantity || parseFloat(form.quantity) <= 0) return toast.error("Enter quantity");
    const body = {
      date: form.date, kind: form.kind,
      material_id: form.kind === "material" ? form.material_id : null,
      menu_item_id: form.kind === "prepared" ? form.menu_item_id : null,
      quantity: parseFloat(form.quantity) || 0,
      reason: form.reason,
      staff_name: form.staff_name,
    };
    await client.post("/wastage", body);
    toast.success("Wastage recorded");
    navigate("/wastage");
  };

  return (
    <Layout title="Add Wastage">
      <div className="space-y-3">
        <TextInput label="Date" type="date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} testId="w-date" />
        <SelectInput label="Type" value={form.kind} onChange={(v) => setForm({ ...form, kind: v })} testId="w-kind"
          options={[{ value: "material", label: "Raw Material" }, { value: "prepared", label: "Prepared Food" }]} />
        {form.kind === "material" ? (
          <SelectInput label="Material" value={form.material_id} onChange={(v) => setForm({ ...form, material_id: v })} testId="w-mat"
            options={mats.map(m => ({ value: m.id, label: `${m.name} (${m.unit})` }))} />
        ) : (
          <SelectInput label="Menu Item" value={form.menu_item_id} onChange={(v) => setForm({ ...form, menu_item_id: v })} testId="w-item"
            options={items.map(i => ({ value: i.id, label: i.name }))} />
        )}
        <TextInput label="Quantity" type="number" value={form.quantity} onChange={(v) => setForm({ ...form, quantity: v })} testId="w-qty" />
        <SelectInput label="Reason" value={form.reason} onChange={(v) => setForm({ ...form, reason: v })} testId="w-reason"
          options={[
            { value: "", label: "-- Select --" },
            { value: "spoiled", label: "Spoiled / Expired" },
            { value: "over_prep", label: "Over-prepared" },
            { value: "kitchen_mistake", label: "Kitchen mistake" },
            { value: "returned", label: "Customer returned" },
            { value: "other", label: "Other" },
          ]} />
        <TextInput label="Staff Name" value={form.staff_name} onChange={(v) => setForm({ ...form, staff_name: v })} testId="w-staff" />
        <PrimaryButton onClick={save} testId="save-waste-btn">Save</PrimaryButton>
      </div>
    </Layout>
  );
}

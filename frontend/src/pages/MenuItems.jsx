import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import Layout from "@/components/Layout";
import { TextInput, SelectInput, PrimaryButton, EmptyState } from "@/components/ui-kit";
import client from "@/api";
import { toast } from "sonner";

export default function MenuItems() {
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", category: "Main", selling_price: "", unit: "plate", active: true });

  const load = () => client.get("/menu-items").then(r => setItems(r.data));
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name.trim()) return toast.error("Enter name");
    const body = { ...form, selling_price: parseFloat(form.selling_price) || 0 };
    try {
      if (editing) await client.patch(`/menu-items/${editing}`, body);
      else await client.post("/menu-items", body);
      toast.success(editing ? "Updated" : "Added");
      setShowForm(false);
      setEditing(null);
      setForm({ name: "", category: "Main", selling_price: "", unit: "plate", active: true });
      load();
    } catch (e) { toast.error("Failed"); }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this item?")) return;
    await client.delete(`/menu-items/${id}`);
    toast.success("Deleted");
    load();
  };

  const edit = (it) => {
    setEditing(it.id);
    setForm({
      name: it.name, category: it.category, selling_price: it.selling_price,
      unit: it.unit, active: it.active,
    });
    setShowForm(true);
  };

  return (
    <Layout title="Menu Items">
      <div className="space-y-3">
        <button
          data-testid="add-menu-btn"
          onClick={() => { setEditing(null); setForm({ name: "", category: "Main", selling_price: "", unit: "plate", active: true }); setShowForm(true); }}
          className="w-full h-12 rounded-lg bg-green-600 text-white font-medium flex items-center justify-center gap-2 active:bg-green-700"
        >
          <Plus size={18} /> Add Menu Item
        </button>

        {showForm && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3" data-testid="menu-form">
            <TextInput label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} testId="menu-name" />
            <div className="grid grid-cols-2 gap-3">
              <SelectInput label="Category" value={form.category} onChange={(v) => setForm({ ...form, category: v })} testId="menu-cat"
                options={[
                  { value: "Main", label: "Main" },
                  { value: "Tiffin", label: "Tiffin" },
                  { value: "Beverage", label: "Beverage" },
                  { value: "Snacks", label: "Snacks" },
                  { value: "Dessert", label: "Dessert" },
                ]}
              />
              <SelectInput label="Unit" value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} testId="menu-unit"
                options={[
                  { value: "plate", label: "Plate" },
                  { value: "cup", label: "Cup" },
                  { value: "piece", label: "Piece" },
                  { value: "packet", label: "Packet" },
                ]}
              />
            </div>
            <TextInput label="Selling Price (₹)" type="number" value={form.selling_price} onChange={(v) => setForm({ ...form, selling_price: v })} testId="menu-price" />
            <div className="flex gap-2">
              <PrimaryButton onClick={save} testId="menu-save">Save</PrimaryButton>
              <button onClick={() => { setShowForm(false); setEditing(null); }} className="h-12 px-4 rounded-lg bg-gray-100" data-testid="menu-cancel">Cancel</button>
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <EmptyState title="No menu items yet" hint="Add your first menu item" />
        ) : (
          <ul className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100" data-testid="menu-list">
            {items.map((it) => (
              <li key={it.id} className="flex items-center justify-between p-3 active:bg-gray-50">
                <div onClick={() => edit(it)} className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{it.name}</p>
                  <p className="text-xs text-gray-500">{it.category} · ₹{it.selling_price}/{it.unit}</p>
                </div>
                <button onClick={() => remove(it.id)} data-testid={`del-${it.id}`} className="text-red-500 p-2 active:bg-red-50 rounded">
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Layout>
  );
}

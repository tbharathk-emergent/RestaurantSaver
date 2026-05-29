import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import Layout from "@/components/Layout";
import { TextInput, PrimaryButton, EmptyState } from "@/components/ui-kit";
import client from "@/api";
import { toast } from "sonner";

export default function Suppliers() {
  const [list, setList] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", payment_due: 0 });

  const load = () => client.get("/suppliers").then(r => setList(r.data));
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name.trim()) return toast.error("Enter name");
    await client.post("/suppliers", { ...form, payment_due: parseFloat(form.payment_due) || 0 });
    toast.success("Saved");
    setShowForm(false);
    setForm({ name: "", phone: "", payment_due: 0 });
    load();
  };

  const remove = async (id) => {
    if (!window.confirm("Delete?")) return;
    await client.delete(`/suppliers/${id}`);
    toast.success("Deleted"); load();
  };

  return (
    <Layout title="Suppliers">
      <div className="space-y-3">
        <button
          onClick={() => setShowForm(true)}
          data-testid="add-sup-btn"
          className="w-full h-12 rounded-lg bg-green-600 text-white font-medium flex items-center justify-center gap-2"
        >
          <Plus size={18} /> Add Supplier
        </button>
        {showForm && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <TextInput label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} testId="sup-name" />
            <TextInput label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} testId="sup-phone" />
            <TextInput label="Payment Due (₹)" type="number" value={form.payment_due} onChange={(v) => setForm({ ...form, payment_due: v })} testId="sup-due" />
            <div className="flex gap-2">
              <PrimaryButton onClick={save} testId="sup-save">Save</PrimaryButton>
              <button onClick={() => setShowForm(false)} className="h-12 px-4 rounded-lg bg-gray-100">Cancel</button>
            </div>
          </div>
        )}
        {list.length === 0 ? (
          <EmptyState title="No suppliers" />
        ) : (
          <ul className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100" data-testid="sup-list">
            {list.map(s => (
              <li key={s.id} className="flex items-center justify-between p-3">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-gray-500">{s.phone} · Due: ₹{s.payment_due}</p>
                </div>
                <button onClick={() => remove(s.id)} className="text-red-500 p-2"><Trash2 size={16} /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Layout>
  );
}

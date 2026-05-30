import { useEffect, useState } from "react";
import { Plus, Trash2, Boxes } from "lucide-react";
import Layout from "@/components/Layout";
import { TextInput, SelectInput, PrimaryButton, EmptyState } from "@/components/ui-kit";
import client from "@/api";
import { toast } from "sonner";

const today = () => new Date().toISOString().slice(0, 10);

export default function StockIssues() {
  const [list, setList] = useState([]);
  const [mats, setMats] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: today(), material_id: "", quantity: "", notes: "" });

  const load = async () => {
    const [si, m] = await Promise.all([
      client.get("/stock-issues"),
      client.get("/raw-materials"),
    ]);
    setList(si.data);
    setMats(m.data);
    if (!form.material_id && m.data[0]) {
      setForm((f) => ({ ...f, material_id: m.data[0].id }));
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const matMap = Object.fromEntries(mats.map(m => [m.id, m]));

  const save = async () => {
    if (!form.material_id) return toast.error("Pick a material");
    const qty = parseFloat(form.quantity);
    if (!qty || qty <= 0) return toast.error("Enter quantity");
    try {
      await client.post("/stock-issues", {
        date: form.date,
        material_id: form.material_id,
        quantity: qty,
        notes: form.notes,
      });
      toast.success(`${qty} ${matMap[form.material_id]?.unit || ""} ${matMap[form.material_id]?.name || ""} taken out`);
      setShowForm(false);
      setForm({ date: today(), material_id: form.material_id, quantity: "", notes: "" });
      load();
    } catch {
      toast.error("Failed");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this entry? Stock will be restored.")) return;
    await client.delete(`/stock-issues/${id}`);
    toast.success("Deleted");
    load();
  };

  // group by date for clarity
  const byDate = {};
  for (const s of list) {
    if (!byDate[s.date]) byDate[s.date] = [];
    byDate[s.date].push(s);
  }
  const dates = Object.keys(byDate).sort().reverse();

  return (
    <Layout title="Stock Taken Out">
      <div className="space-y-3">
        <div className="bg-green-50 border border-green-200 rounded-xl p-3">
          <p className="text-xs text-green-900 leading-snug">
            <b>Simple flow:</b> Tell us how much you took out of stock today (e.g. 20 kg Rice).
            The dashboard compares this with what sales actually used.
          </p>
        </div>

        <button
          data-testid="add-issue-btn"
          onClick={() => { setShowForm(true); }}
          className="w-full h-12 rounded-lg bg-green-600 text-white font-medium flex items-center justify-center gap-2 active:bg-green-700"
        >
          <Plus size={18} /> Add Stock Used
        </button>

        {showForm && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3" data-testid="issue-form">
            <TextInput label="Date" type="date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} testId="issue-date" />
            <SelectInput label="Material" value={form.material_id} onChange={(v) => setForm({ ...form, material_id: v })} testId="issue-mat"
              options={mats.map(m => ({ value: m.id, label: `${m.name} (${m.unit}) — stock: ${m.current_stock}` }))} />
            <TextInput
              label={`Quantity Taken Out (${matMap[form.material_id]?.unit || ""})`}
              type="number"
              step="0.01"
              value={form.quantity}
              onChange={(v) => setForm({ ...form, quantity: v })}
              testId="issue-qty"
              placeholder="e.g. 20"
            />
            <TextInput label="Notes (optional)" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} testId="issue-notes" />
            <div className="flex gap-2">
              <PrimaryButton onClick={save} testId="issue-save">Save</PrimaryButton>
              <button onClick={() => setShowForm(false)} className="h-12 px-4 rounded-lg bg-gray-100" data-testid="issue-cancel">Cancel</button>
            </div>
          </div>
        )}

        {list.length === 0 ? (
          <EmptyState title="No stock used yet" hint="Tap above to record what you took out today" />
        ) : (
          <div className="space-y-4" data-testid="issues-list">
            {dates.map(d => (
              <section key={d}>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1 mb-1">{d}</h3>
                <ul className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                  {byDate[d].map(s => {
                    const mat = matMap[s.material_id];
                    return (
                      <li key={s.id} className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-9 w-9 rounded-full bg-green-50 flex items-center justify-center">
                            <Boxes size={16} className="text-green-700" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{mat?.name || "—"}</p>
                            <p className="text-xs text-gray-500">
                              <span className="font-mono font-medium text-gray-700">{s.quantity} {mat?.unit || ""}</span>
                              {s.notes ? ` · ${s.notes}` : ""}
                            </p>
                          </div>
                        </div>
                        <button onClick={() => remove(s.id)} className="text-red-500 p-2 active:bg-red-50 rounded" data-testid={`del-issue-${s.id}`}>
                          <Trash2 size={16} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

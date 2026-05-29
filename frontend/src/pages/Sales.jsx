import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import Layout from "@/components/Layout";
import { TextInput, SelectInput, PrimaryButton, EmptyState } from "@/components/ui-kit";
import client from "@/api";
import { toast } from "sonner";

const today = () => new Date().toISOString().slice(0, 10);

export function SalesList() {
  const [sales, setSales] = useState([]);
  const [items, setItems] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([client.get("/sales"), client.get("/menu-items")])
      .then(([s, it]) => { setSales(s.data); setItems(it.data); });
  }, []);

  const itemMap = Object.fromEntries(items.map(i => [i.id, i.name]));

  return (
    <Layout title="Sales">
      <div className="space-y-3">
        <button
          onClick={() => navigate("/sales/new")}
          data-testid="add-sale-btn"
          className="w-full h-12 rounded-lg bg-green-600 text-white font-medium flex items-center justify-center gap-2"
        >
          <Plus size={18} /> New Sale Entry
        </button>

        {sales.length === 0 ? (
          <EmptyState title="No sales yet" hint="Tap above to enter today's sales" />
        ) : (
          <ul className="space-y-2" data-testid="sales-list">
            {sales.map((s) => (
              <li key={s.id} className="bg-white rounded-xl border border-gray-200 p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium">{s.date}</p>
                    <p className="text-xs text-gray-500">{s.items.length} items · {s.payment_mode}</p>
                  </div>
                  <p className="text-lg font-bold text-green-700">₹{s.total_amount?.toFixed(0)}</p>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {s.items.slice(0, 4).map((l, i) => (
                    <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                      {itemMap[l.menu_item_id] || "Item"} × {l.quantity}
                    </span>
                  ))}
                  {s.items.length > 4 && <span className="text-[11px] text-gray-500">+{s.items.length - 4} more</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Layout>
  );
}

export function SaleNew() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [date, setDate] = useState(today());
  const [paymentMode, setPaymentMode] = useState("cash");
  const [lines, setLines] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    client.get("/menu-items").then(r => setItems(r.data));
  }, []);

  const addLine = () => {
    if (items.length === 0) return toast.error("Add menu items first");
    setLines([...lines, { menu_item_id: items[0].id, quantity: 0, unit_price: items[0].selling_price }]);
  };

  const update = (idx, key, val) => {
    const next = [...lines];
    next[idx] = { ...next[idx], [key]: val };
    if (key === "menu_item_id") {
      const item = items.find(i => i.id === val);
      next[idx].unit_price = item?.selling_price || 0;
    }
    setLines(next);
  };

  const remove = (idx) => setLines(lines.filter((_, i) => i !== idx));

  const total = lines.reduce((s, l) => s + (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_price) || 0), 0);

  const save = async () => {
    if (lines.length === 0) return toast.error("Add at least one item");
    setBusy(true);
    try {
      const body = {
        date, payment_mode: paymentMode, notes: "",
        items: lines.map(l => ({
          menu_item_id: l.menu_item_id,
          quantity: parseFloat(l.quantity) || 0,
          unit_price: parseFloat(l.unit_price) || 0,
        })),
        total_amount: total,
      };
      await client.post("/sales", body);
      toast.success("Sale saved");
      navigate("/sales");
    } catch { toast.error("Failed"); }
    finally { setBusy(false); }
  };

  return (
    <Layout title="New Sale">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Date" type="date" value={date} onChange={setDate} testId="sale-date" />
          <SelectInput label="Payment" value={paymentMode} onChange={setPaymentMode} testId="sale-mode"
            options={[
              { value: "cash", label: "Cash" },
              { value: "upi", label: "UPI" },
              { value: "card", label: "Card" },
              { value: "online", label: "Online" },
            ]}
          />
        </div>

        <div className="space-y-2" data-testid="sale-lines">
          {lines.map((l, idx) => (
            <div key={idx} className="bg-white rounded-xl border border-gray-200 p-3 flex gap-2 items-end">
              <div className="flex-1">
                <SelectInput
                  label={idx === 0 ? "Item" : ""}
                  value={l.menu_item_id}
                  onChange={(v) => update(idx, "menu_item_id", v)}
                  testId={`sale-item-${idx}`}
                  options={items.map(i => ({ value: i.id, label: i.name }))}
                />
              </div>
              <div className="w-20">
                <TextInput label={idx === 0 ? "Qty" : ""} type="number" value={l.quantity} onChange={(v) => update(idx, "quantity", v)} testId={`sale-qty-${idx}`} />
              </div>
              <div className="w-24">
                <TextInput label={idx === 0 ? "₹/unit" : ""} type="number" value={l.unit_price} onChange={(v) => update(idx, "unit_price", v)} testId={`sale-price-${idx}`} />
              </div>
              <button onClick={() => remove(idx)} className="h-12 w-10 text-red-500 flex items-center justify-center"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>

        <button onClick={addLine} className="w-full h-12 rounded-lg border-2 border-dashed border-gray-300 text-gray-700 flex items-center justify-center gap-2" data-testid="sale-add-row">
          <Plus size={16} /> Add Item
        </button>

        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex justify-between items-center">
          <span className="text-sm font-medium">Total</span>
          <span className="text-2xl font-bold text-green-700">₹{total.toFixed(0)}</span>
        </div>

        <PrimaryButton onClick={save} disabled={busy} testId="save-sale-btn">
          {busy ? "Saving..." : "Save Sale"}
        </PrimaryButton>
      </div>
    </Layout>
  );
}

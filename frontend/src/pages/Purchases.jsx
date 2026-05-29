import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import Layout from "@/components/Layout";
import { TextInput, SelectInput, PrimaryButton, EmptyState } from "@/components/ui-kit";
import client from "@/api";
import { toast } from "sonner";

const today = () => new Date().toISOString().slice(0, 10);

export function PurchasesList() {
  const [rows, setRows] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([client.get("/purchases"), client.get("/raw-materials"), client.get("/suppliers")])
      .then(([p, m, s]) => { setRows(p.data); setMaterials(m.data); setSuppliers(s.data); });
  }, []);

  const matMap = Object.fromEntries(materials.map(m => [m.id, m]));
  const supMap = Object.fromEntries(suppliers.map(s => [s.id, s]));

  return (
    <Layout title="Purchases">
      <div className="space-y-3">
        <button
          onClick={() => navigate("/purchases/new")}
          data-testid="add-purchase-btn"
          className="w-full h-12 rounded-lg bg-green-600 text-white font-medium flex items-center justify-center gap-2"
        >
          <Plus size={18} /> New Purchase
        </button>

        {rows.length === 0 ? (
          <EmptyState title="No purchases yet" />
        ) : (
          <ul className="space-y-2" data-testid="purchases-list">
            {rows.map(p => (
              <li key={p.id} className="bg-white rounded-xl border border-gray-200 p-3">
                <div className="flex justify-between">
                  <div>
                    <p className="font-medium">{supMap[p.supplier_id]?.name || "Walk-in"}</p>
                    <p className="text-xs text-gray-500">{p.date} · {p.items.length} items</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">₹{p.total_amount?.toFixed(0)}</p>
                    <p className={`text-[10px] px-1.5 py-0.5 rounded-full inline-block ${p.payment_status === "paid" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                      {p.payment_status}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.items.slice(0, 3).map((l, i) => (
                    <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                      {matMap[l.material_id]?.name} × {l.quantity}{matMap[l.material_id]?.unit}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Layout>
  );
}

export function PurchaseNew() {
  const navigate = useNavigate();
  const [materials, setMaterials] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [date, setDate] = useState(today());
  const [supplierId, setSupplierId] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("pending");
  const [lines, setLines] = useState([]);

  useEffect(() => {
    Promise.all([client.get("/raw-materials"), client.get("/suppliers")])
      .then(([m, s]) => { setMaterials(m.data); setSuppliers(s.data); });
  }, []);

  const addLine = () => {
    if (materials.length === 0) return toast.error("Add raw materials first");
    setLines([...lines, { material_id: materials[0].id, quantity: 0, rate: materials[0].purchase_rate }]);
  };
  const update = (i, k, v) => {
    const next = [...lines];
    next[i] = { ...next[i], [k]: v };
    if (k === "material_id") {
      const m = materials.find(x => x.id === v);
      next[i].rate = m?.purchase_rate || 0;
    }
    setLines(next);
  };
  const remove = (i) => setLines(lines.filter((_, idx) => idx !== i));
  const total = lines.reduce((s, l) => s + (parseFloat(l.quantity) || 0) * (parseFloat(l.rate) || 0), 0);

  const save = async () => {
    if (lines.length === 0) return toast.error("Add at least one item");
    try {
      await client.post("/purchases", {
        date, supplier_id: supplierId || null, invoice_no: invoiceNo,
        payment_status: paymentStatus,
        items: lines.map(l => ({ material_id: l.material_id, quantity: parseFloat(l.quantity) || 0, rate: parseFloat(l.rate) || 0 })),
        total_amount: total,
      });
      toast.success("Purchase saved");
      navigate("/purchases");
    } catch { toast.error("Failed"); }
  };

  return (
    <Layout title="New Purchase">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Date" type="date" value={date} onChange={setDate} testId="pur-date" />
          <SelectInput label="Payment" value={paymentStatus} onChange={setPaymentStatus} testId="pur-pay"
            options={[{ value: "pending", label: "Pending" }, { value: "paid", label: "Paid" }]} />
        </div>
        <SelectInput label="Supplier" value={supplierId} onChange={setSupplierId} testId="pur-sup"
          options={[{ value: "", label: "Walk-in / None" }, ...suppliers.map(s => ({ value: s.id, label: s.name }))]} />
        <TextInput label="Invoice No." value={invoiceNo} onChange={setInvoiceNo} testId="pur-inv" />

        <div className="space-y-2" data-testid="pur-lines">
          {lines.map((l, idx) => {
            const mat = materials.find(m => m.id === l.material_id);
            return (
              <div key={idx} className="bg-white rounded-xl border border-gray-200 p-3 flex gap-2 items-end">
                <div className="flex-1">
                  <SelectInput label={idx === 0 ? "Material" : ""} value={l.material_id} onChange={(v) => update(idx, "material_id", v)} testId={`pur-mat-${idx}`}
                    options={materials.map(m => ({ value: m.id, label: `${m.name} (${m.unit})` }))} />
                </div>
                <div className="w-20"><TextInput label={idx === 0 ? `Qty ${mat?.unit || ""}` : ""} type="number" value={l.quantity} onChange={(v) => update(idx, "quantity", v)} testId={`pur-qty-${idx}`} /></div>
                <div className="w-24"><TextInput label={idx === 0 ? "₹/unit" : ""} type="number" value={l.rate} onChange={(v) => update(idx, "rate", v)} testId={`pur-rate-${idx}`} /></div>
                <button onClick={() => remove(idx)} className="h-12 w-10 text-red-500 flex items-center justify-center"><Trash2 size={16} /></button>
              </div>
            );
          })}
        </div>
        <button onClick={addLine} className="w-full h-12 rounded-lg border-2 border-dashed border-gray-300 text-gray-700 flex items-center justify-center gap-2" data-testid="pur-add-row">
          <Plus size={16} /> Add Item
        </button>

        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex justify-between items-center">
          <span className="text-sm font-medium">Total</span>
          <span className="text-2xl font-bold text-green-700">₹{total.toFixed(0)}</span>
        </div>

        <PrimaryButton onClick={save} testId="save-pur-btn">Save Purchase</PrimaryButton>
      </div>
    </Layout>
  );
}

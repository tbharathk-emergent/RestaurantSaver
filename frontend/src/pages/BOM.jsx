import { useEffect, useState } from "react";
import { Plus, Trash2, ChefHat } from "lucide-react";
import Layout from "@/components/Layout";
import { TextInput, SelectInput, PrimaryButton, EmptyState } from "@/components/ui-kit";
import client from "@/api";
import { toast } from "sonner";

export default function BOMPage() {
  const [items, setItems] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [boms, setBoms] = useState([]);
  const [selectedItem, setSelectedItem] = useState("");
  const [batchSize, setBatchSize] = useState(1);
  const [tolerance, setTolerance] = useState(5);
  const [ingredients, setIngredients] = useState([]);
  const [editingBomId, setEditingBomId] = useState(null);

  const load = async () => {
    const [it, mt, bm] = await Promise.all([
      client.get("/menu-items"),
      client.get("/raw-materials"),
      client.get("/boms"),
    ]);
    setItems(it.data); setMaterials(mt.data); setBoms(bm.data);
  };
  useEffect(() => { load(); }, []);

  const matMap = Object.fromEntries(materials.map(m => [m.id, m]));
  const itemMap = Object.fromEntries(items.map(i => [i.id, i]));

  const latestByItem = {};
  for (const b of boms) {
    if (!latestByItem[b.menu_item_id] || (b.version || 1) > (latestByItem[b.menu_item_id].version || 1)) {
      latestByItem[b.menu_item_id] = b;
    }
  }

  const startCreate = (itemId) => {
    setSelectedItem(itemId);
    const existing = latestByItem[itemId];
    if (existing) {
      setEditingBomId(existing.id);
      setBatchSize(existing.batch_size || 1);
      setTolerance(existing.tolerance_percent || 5);
      setIngredients(existing.ingredients.map(i => ({ ...i })));
    } else {
      setEditingBomId(null);
      setBatchSize(1);
      setTolerance(5);
      setIngredients([]);
    }
  };

  const addRow = () => {
    if (materials.length === 0) return toast.error("Add raw materials first");
    setIngredients([...ingredients, { material_id: materials[0].id, quantity: 0, unit: materials[0].unit }]);
  };

  const updateRow = (idx, key, val) => {
    const next = [...ingredients];
    next[idx] = { ...next[idx], [key]: val };
    if (key === "material_id") {
      next[idx].unit = matMap[val]?.unit || "g";
    }
    setIngredients(next);
  };

  const removeRow = (idx) => setIngredients(ingredients.filter((_, i) => i !== idx));

  const save = async () => {
    if (!selectedItem) return toast.error("Select menu item");
    if (ingredients.length === 0) return toast.error("Add at least one ingredient");
    const body = {
      menu_item_id: selectedItem,
      batch_size: parseFloat(batchSize) || 1,
      tolerance_percent: parseFloat(tolerance) || 5,
      ingredients: ingredients.map(i => ({
        material_id: i.material_id,
        quantity: parseFloat(i.quantity) || 0,
        unit: i.unit,
      })),
      notes: "",
    };
    try {
      await client.post("/boms", body);
      toast.success("Recipe saved");
      setSelectedItem("");
      setIngredients([]);
      load();
    } catch { toast.error("Failed"); }
  };

  return (
    <Layout title="Recipe (BOM)">
      <div className="space-y-3">
        {!selectedItem ? (
          <>
            <p className="text-sm text-gray-600">Tap a menu item to define its recipe (ingredients used per plate/cup).</p>
            {items.length === 0 ? (
              <EmptyState title="No menu items" hint="Add menu items first" />
            ) : (
              <ul className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100" data-testid="bom-items-list">
                {items.map(it => {
                  const has = !!latestByItem[it.id];
                  return (
                    <li
                      key={it.id}
                      onClick={() => startCreate(it.id)}
                      data-testid={`bom-pick-${it.id}`}
                      className="flex items-center justify-between p-3 active:bg-gray-50 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-green-50 flex items-center justify-center">
                          <ChefHat size={16} className="text-green-700" />
                        </div>
                        <div>
                          <p className="font-medium">{it.name}</p>
                          <p className="text-xs text-gray-500">
                            {has ? `${latestByItem[it.id].ingredients.length} ingredients · v${latestByItem[it.id].version}` : "No recipe yet"}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${has ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                        {has ? "Edit" : "Create"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <div className="bg-green-50 border border-green-200 rounded-xl p-3">
              <p className="text-xs text-green-700 font-medium">Recipe for</p>
              <p className="text-lg font-semibold">{itemMap[selectedItem]?.name}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TextInput label="Batch size (plates)" type="number" value={batchSize} onChange={setBatchSize} testId="bom-batch" />
              <TextInput label="Tolerance %" type="number" value={tolerance} onChange={setTolerance} testId="bom-tol" />
            </div>

            <div className="space-y-2" data-testid="bom-ingredients">
              {ingredients.map((ing, idx) => (
                <div key={idx} className="bg-white rounded-xl border border-gray-200 p-3 flex gap-2 items-end">
                  <div className="flex-1">
                    <SelectInput
                      label={idx === 0 ? "Material" : ""}
                      value={ing.material_id}
                      onChange={(v) => updateRow(idx, "material_id", v)}
                      testId={`bom-mat-${idx}`}
                      options={materials.map(m => ({ value: m.id, label: `${m.name} (${m.unit})` }))}
                    />
                  </div>
                  <div className="w-24">
                    <TextInput
                      label={idx === 0 ? "Qty" : ""}
                      type="number"
                      step="0.01"
                      value={ing.quantity}
                      onChange={(v) => updateRow(idx, "quantity", v)}
                      testId={`bom-qty-${idx}`}
                    />
                  </div>
                  <div className="w-20">
                    <SelectInput
                      label={idx === 0 ? "Unit" : ""}
                      value={ing.unit}
                      onChange={(v) => updateRow(idx, "unit", v)}
                      testId={`bom-unit-${idx}`}
                      options={["g", "kg", "ml", "l", "pcs"].map(u => ({ value: u, label: u }))}
                    />
                  </div>
                  <button onClick={() => removeRow(idx)} className="h-12 w-10 text-red-500 flex items-center justify-center" data-testid={`bom-del-${idx}`}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            <button onClick={addRow} className="w-full h-12 rounded-lg border-2 border-dashed border-gray-300 text-gray-700 flex items-center justify-center gap-2" data-testid="bom-add-row">
              <Plus size={16} /> Add Ingredient
            </button>

            <div className="flex gap-2">
              <PrimaryButton onClick={save} testId="bom-save">Save Recipe</PrimaryButton>
              <button onClick={() => setSelectedItem("")} className="h-12 px-4 rounded-lg bg-gray-100" data-testid="bom-cancel">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

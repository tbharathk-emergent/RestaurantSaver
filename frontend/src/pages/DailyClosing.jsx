import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronRight, ChefHat, Warehouse } from "lucide-react";
import Layout from "@/components/Layout";

const kitchenSteps = [
  { key: "k-stock-taken", title: "Stock Taken", hint: "What you took out of storage today", to: "/inventory" },
  { key: "k-sales", title: "Sales", hint: "Today's item-wise sales", to: "/sales/new" },
  { key: "k-wastage", title: "Wastage", hint: "Burnt, spilled, spoiled, returned food", to: "/wastage/new" },
  { key: "k-staff-food", title: "Staff Food", hint: "Quantity consumed by staff (per material)", to: "/inventory-day" },
  { key: "k-stock-returned", title: "Stock Returned", hint: "Unused stock returned to storage", to: "/inventory-day" },
  { key: "k-review", title: "Review Problems", hint: "Sales vs Kitchen check", to: "/variations" },
];

const storageSteps = [
  { key: "s-purchases", title: "Purchases", hint: "Record today's stock buys", to: "/purchases/new" },
  { key: "s-taken-out", title: "Stock Taken Out to Kitchen", hint: "Material issued for cooking", to: "/inventory" },
  { key: "s-returned", title: "Stock Returned from Kitchen", hint: "Unused stock back in storage", to: "/inventory-day" },
  { key: "s-ending", title: "Enter Ending Stock", hint: "Physical count at day-end", to: "/inventory-day" },
  { key: "s-leakage", title: "Enter Leakage", hint: "Storage leakage / pilferage", to: "/inventory-day" },
  { key: "s-update", title: "Update Stock (auto-fill + adjustments)", hint: "System fills opening, purchases, taken out, returned, leakage. You enter adjustments and see Calculated vs Actual Ending.", to: "/inventory-day" },
  { key: "s-review", title: "Review Problems", hint: "Storage reconciliation check", to: "/variations" },
];

export default function DailyClosing() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("kitchen");
  const [done, setDone] = useState({});

  const steps = tab === "kitchen" ? kitchenSteps : storageSteps;
  const allDone = steps.every((s) => done[s.key]);

  const markDone = (key) => setDone((d) => ({ ...d, [key]: true }));

  return (
    <Layout title="Daily Closing">
      <div className="space-y-3">
        <p className="text-sm text-gray-600 leading-snug">
          Two independent flows. Complete each step. Tick each as you go.
        </p>

        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setTab("kitchen")}
            data-testid="closing-tab-kitchen"
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium ${tab === "kitchen" ? "bg-white shadow-sm text-gray-900" : "text-gray-600"}`}
          >
            <ChefHat size={16} /> Kitchen
          </button>
          <button
            onClick={() => setTab("storage")}
            data-testid="closing-tab-storage"
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium ${tab === "storage" ? "bg-white shadow-sm text-gray-900" : "text-gray-600"}`}
          >
            <Warehouse size={16} /> Store Room
          </button>
        </div>

        <ul className="space-y-2" data-testid={`closing-steps-${tab}`}>
          {steps.map((s, idx) => {
            const isDone = done[s.key];
            return (
              <li
                key={s.key}
                className={`bg-white rounded-xl border p-3 flex items-center gap-3 ${isDone ? "border-green-300 bg-green-50" : "border-gray-200"}`}
                data-testid={`step-${s.key}`}
              >
                <div className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center font-semibold text-sm ${isDone ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600"}`}>
                  {isDone ? <Check size={16} /> : idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{s.title}</p>
                  <p className="text-[11px] text-gray-500 leading-snug">{s.hint}</p>
                </div>
                <button
                  onClick={() => { navigate(s.to); markDone(s.key); }}
                  className="text-green-700 active:opacity-70 shrink-0 px-1"
                  data-testid={`step-go-${s.key}`}
                  aria-label="Go to step"
                >
                  <ChevronRight size={20} />
                </button>
              </li>
            );
          })}
        </ul>

        {allDone && (
          <div className="bg-green-100 border border-green-300 rounded-xl p-4 text-center" data-testid="closing-done">
            <p className="text-green-800 font-semibold">✓ {tab === "kitchen" ? "Kitchen" : "Store Room"} flow complete!</p>
            <p className="text-xs text-green-700 mt-1">
              {tab === "kitchen" ? "Switch to Store Room tab to close storage." : "Both flows done. Day closed."}
            </p>
          </div>
        )}

        <button
          onClick={() => navigate("/")}
          data-testid="closing-finish"
          className="w-full h-12 rounded-lg bg-gray-100 text-gray-800 font-medium active:bg-gray-200"
        >
          Back to Dashboard
        </button>
      </div>
    </Layout>
  );
}

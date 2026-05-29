import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronRight } from "lucide-react";
import Layout from "@/components/Layout";
import { PrimaryButton } from "@/components/ui-kit";

const steps = [
  { key: "sales", title: "Enter today's sales", to: "/sales/new" },
  { key: "purchases", title: "Record purchases", to: "/purchases/new" },
  { key: "inventory", title: "Enter closing stock", to: "/inventory/new" },
  { key: "wastage", title: "Record wastage", to: "/wastage/new" },
  { key: "review", title: "Review problems", to: "/variations" },
];

export default function DailyClosing() {
  const navigate = useNavigate();
  const [done, setDone] = useState({});

  const markDone = (key) => setDone(d => ({ ...d, [key]: true }));
  const allDone = steps.every(s => done[s.key]);

  return (
    <Layout title="Daily Closing">
      <div className="space-y-3">
        <p className="text-sm text-gray-600">
          Follow these steps every evening to close your day correctly. Tick each step as you complete it.
        </p>
        <ul className="space-y-2" data-testid="closing-steps">
          {steps.map((s, idx) => {
            const isDone = done[s.key];
            return (
              <li
                key={s.key}
                className={`bg-white rounded-xl border p-3 flex items-center gap-3 ${isDone ? "border-green-300 bg-green-50" : "border-gray-200"}`}
                data-testid={`step-${s.key}`}
              >
                <div className={`h-8 w-8 rounded-full flex items-center justify-center font-semibold text-sm ${isDone ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600"}`}>
                  {isDone ? <Check size={16} /> : idx + 1}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{s.title}</p>
                </div>
                <button
                  onClick={() => { navigate(s.to); markDone(s.key); }}
                  className="text-green-700 active:opacity-70"
                  data-testid={`step-go-${s.key}`}
                >
                  <ChevronRight size={20} />
                </button>
              </li>
            );
          })}
        </ul>
        {allDone && (
          <div className="bg-green-100 border border-green-300 rounded-xl p-4 text-center" data-testid="closing-done">
            <p className="text-green-800 font-semibold">✓ All steps complete!</p>
            <p className="text-xs text-green-700 mt-1">Great work. Day closed successfully.</p>
          </div>
        )}
        <PrimaryButton onClick={() => navigate("/")} testId="closing-finish">Go to Dashboard</PrimaryButton>
      </div>
    </Layout>
  );
}

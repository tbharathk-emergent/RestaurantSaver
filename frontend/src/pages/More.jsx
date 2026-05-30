import { useNavigate } from "react-router-dom";
import { ChevronRight, ChefHat, Boxes, FileText, Truck, Sparkles, Settings as SettingsIcon, AlertTriangle, ClipboardList, Wallet, CreditCard, Trash2, UtensilsCrossed, Warehouse } from "lucide-react";
import Layout from "@/components/Layout";
import { useAuth } from "@/auth";
import { useI18n } from "@/i18n";

export default function More() {
  const navigate = useNavigate();
  const { tenant, user } = useAuth();
  const { t } = useI18n();

  const groups = [
    {
      title: "Operations",
      items: [
        { icon: UtensilsCrossed, label: t("rawMaterials"), to: "/raw-materials", testId: "more-mat" },
        { icon: ChefHat, label: t("bom"), to: "/bom", testId: "more-bom" },
        { icon: Truck, label: t("purchases"), to: "/purchases", testId: "more-pur" },
        { icon: Warehouse, label: "Inventory (Storage)", to: "/inventory-day", testId: "more-invday" },
        { icon: Boxes, label: t("suppliers"), to: "/suppliers", testId: "more-sup" },
        { icon: Trash2, label: "Wastage", to: "/wastage", testId: "more-waste" },
        { icon: ClipboardList, label: t("preparedFood"), to: "/prepared-food", testId: "more-prep" },
      ],
    },
    {
      title: "Insights",
      items: [
        { icon: AlertTriangle, label: "Variations & Problems", to: "/variations", testId: "more-var" },
        { icon: FileText, label: t("reports"), to: "/reports", testId: "more-rep" },
        { icon: Sparkles, label: t("aiInsights"), to: "/ai-insights", testId: "more-ai" },
      ],
    },
    {
      title: "Account",
      items: [
        { icon: Wallet, label: t("wallet"), to: "/wallet", testId: "more-wallet" },
        { icon: CreditCard, label: t("subscription"), to: "/subscription", testId: "more-sub" },
        { icon: SettingsIcon, label: t("settings"), to: "/settings", testId: "more-set" },
      ],
    },
  ];

  return (
    <Layout title="More">
      <div className="space-y-5">
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
            <ChefHat size={22} className="text-green-700" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold truncate">{tenant?.name}</p>
            <p className="text-xs text-gray-500">{user?.phone} · {user?.role}</p>
          </div>
        </div>

        {groups.map(g => (
          <section key={g.title}>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-2">{g.title}</h3>
            <ul className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {g.items.map(it => {
                const Icon = it.icon;
                return (
                  <li key={it.label}>
                    <button
                      onClick={() => navigate(it.to)}
                      data-testid={it.testId}
                      className="w-full p-3 flex items-center justify-between active:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={18} className="text-gray-600" />
                        <span className="font-medium">{it.label}</span>
                      </div>
                      <ChevronRight size={18} className="text-gray-400" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </Layout>
  );
}

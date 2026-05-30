import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, AlertTriangle, Boxes, Sparkles, ChevronRight, ArrowDownToLine, Plus, ClipboardList, FileText } from "lucide-react";
import Layout from "@/components/Layout";
import { KPICard, StatusBadge, PrimaryButton } from "@/components/ui-kit";
import client from "@/api";
import { useI18n } from "@/i18n";
import { useAuth } from "@/auth";

const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();
  const { tenant } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    client.get("/dashboard").then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const todayStr = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });

  return (
    <Layout>
      <div className="space-y-4">
        <div data-testid="dashboard-greeting" className="bg-gradient-to-br from-green-600 to-green-700 text-white rounded-2xl p-5">
          <p className="text-sm opacity-90">{todayStr}</p>
          <h2 className="text-xl font-semibold mt-1" style={{ fontFamily: "Outfit, sans-serif" }}>
            Namaste, {tenant?.name?.split(" ")[0] || "Owner"}!
          </h2>
          <p className="text-sm opacity-90 mt-1">
            {data?.red_alerts_count > 0
              ? `⚠ ${data.red_alerts_count} problem${data.red_alerts_count > 1 ? "s" : ""} found today`
              : "All looks good today ✓"}
          </p>
          <button
            data-testid="run-closing-btn"
            onClick={() => navigate("/closing")}
            className="mt-4 bg-white text-green-700 px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2 active:scale-95"
          >
            <ClipboardList size={16} /> {t("dailyClosing")}
          </button>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-2">
          <QuickAction icon={Plus} label={t("addSale")} to="/sales/new" testId="qa-sale" />
          <QuickAction icon={ArrowDownToLine} label={t("addPurchase")} to="/purchases/new" testId="qa-purchase" />
          <QuickAction icon={Boxes} label="Stock Used" to="/inventory" testId="qa-inv" />
          <QuickAction icon={AlertTriangle} label={t("addWastage")} to="/wastage/new" testId="qa-waste" />
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 gap-3" data-testid="kpi-grid">
          <KPICard
            testId="kpi-sales"
            label={t("todaysSales")}
            value={loading ? "..." : fmt(data?.total_sales)}
            accent="success"
            icon={TrendingUp}
          />
          <KPICard
            testId="kpi-profit"
            label={t("grossProfit")}
            value={loading ? "..." : fmt(data?.gross_profit)}
            accent={data?.gross_profit >= 0 ? "success" : "danger"}
          />
          <KPICard
            testId="kpi-stock-diff"
            label={t("stockDifference")}
            value={loading ? "..." : fmt(Math.abs(data?.stock_difference || 0))}
            sub={data?.stock_difference > 0 ? "Over-used" : data?.stock_difference < 0 ? "Under-used" : "Balanced"}
            accent={Math.abs(data?.stock_difference || 0) > 100 ? "danger" : "neutral"}
          />
          <KPICard
            testId="kpi-wastage"
            label={t("foodWastage")}
            value={loading ? "..." : (data?.wastage_qty || 0).toFixed(1)}
            accent="warning"
          />
          <KPICard
            testId="kpi-alerts"
            label={t("redAlerts")}
            value={loading ? "..." : data?.red_alerts_count || 0}
            accent={data?.red_alerts_count ? "danger" : "success"}
          />
          <KPICard
            testId="kpi-low-stock"
            label={t("lowStock")}
            value={loading ? "..." : data?.low_stock_count || 0}
            accent={data?.low_stock_count ? "warning" : "success"}
          />
        </div>

        {/* Red Alerts list */}
        {data?.red_alerts?.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4" data-testid="alerts-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2" style={{ fontFamily: "Outfit, sans-serif" }}>
                <AlertTriangle size={16} className="text-red-600" />
                Problems Today
              </h3>
              <button onClick={() => navigate("/variations")} className="text-xs text-green-700 font-medium" data-testid="view-all-alerts">
                View all
              </button>
            </div>
            <ul className="space-y-3">
              {data.red_alerts.slice(0, 4).map((r, i) => (
                <li key={i} className="border-l-4 border-red-500 pl-3 py-1">
                  <p className="text-sm text-gray-800 leading-snug">{r.message}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* AI Insights teaser */}
        <button
          onClick={() => navigate("/ai-insights")}
          data-testid="ai-cta"
          className="w-full bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between active:bg-amber-100"
        >
          <div className="flex items-center gap-3 text-left">
            <div className="h-10 w-10 rounded-full bg-amber-500 flex items-center justify-center">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{t("aiInsights")}</p>
              <p className="text-xs text-gray-600">Smart tips powered by AI</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-gray-500" />
        </button>

        <button
          onClick={() => navigate("/reports")}
          data-testid="reports-cta"
          className="w-full bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between active:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <FileText size={20} className="text-green-700" />
            <p className="font-medium">{t("reports")}</p>
          </div>
          <ChevronRight size={18} className="text-gray-400" />
        </button>
      </div>
    </Layout>
  );
}

function QuickAction({ icon: Icon, label, to, testId }) {
  const navigate = useNavigate();
  return (
    <button
      data-testid={testId}
      onClick={() => navigate(to)}
      className="bg-white rounded-xl border border-gray-200 p-3 flex flex-col items-center justify-center gap-1 active:bg-gray-50 min-h-[80px]"
    >
      <div className="h-9 w-9 rounded-full bg-green-50 flex items-center justify-center">
        <Icon size={18} className="text-green-700" />
      </div>
      <span className="text-[11px] text-center text-gray-700 leading-tight">{label}</span>
    </button>
  );
}

import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, ShoppingCart, Package, UtensilsCrossed, MoreHorizontal, LogOut, Wallet } from "lucide-react";
import { useAuth } from "@/auth";
import { useI18n } from "@/i18n";

export default function Layout({ children, title, hideNav = false, right = null }) {
  const loc = useLocation();
  const navigate = useNavigate();
  const { tenant, user, logout } = useAuth();
  const { t } = useI18n();

  const tabs = [
    { to: "/", icon: Home, label: t("home"), key: "home" },
    { to: "/sales", icon: ShoppingCart, label: t("sales"), key: "sales" },
    { to: "/inventory", icon: Package, label: t("inventory"), key: "inv" },
    { to: "/menu", icon: UtensilsCrossed, label: t("menu"), key: "menu" },
    { to: "/more", icon: MoreHorizontal, label: t("more"), key: "more" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <div className="max-w-md mx-auto w-full pb-24 min-h-screen bg-gray-50 relative">
        {title !== undefined && (
          <header
            data-testid="app-header"
            className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between"
          >
            <div className="flex items-center gap-3 min-w-0">
              {loc.pathname !== "/" && (
                <button
                  data-testid="back-btn"
                  onClick={() => navigate(-1)}
                  className="text-gray-500 active:text-gray-800 -ml-1"
                  aria-label="Back"
                >
                  ←
                </button>
              )}
              <div className="min-w-0">
                <h1 className="text-lg font-semibold tracking-tight truncate" style={{ fontFamily: "Outfit, sans-serif" }}>
                  {title || tenant?.name || "Restaurant OPS"}
                </h1>
                {tenant && loc.pathname === "/" && (
                  <p className="text-xs text-gray-500 truncate">{tenant.name}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {right}
              {loc.pathname === "/" && (
                <button
                  data-testid="wallet-icon"
                  onClick={() => navigate("/wallet")}
                  className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center active:bg-gray-200"
                  aria-label="Wallet"
                >
                  <Wallet size={18} />
                </button>
              )}
              {loc.pathname === "/more" && (
                <button
                  data-testid="logout-btn"
                  onClick={logout}
                  className="h-9 w-9 rounded-full bg-red-50 text-red-600 flex items-center justify-center active:bg-red-100"
                  aria-label="Logout"
                >
                  <LogOut size={18} />
                </button>
              )}
            </div>
          </header>
        )}

        <main className="px-4 py-4">{children}</main>

        {!hideNav && user && (
          <nav
            data-testid="bottom-nav"
            className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-200 z-40"
          >
            <div className="max-w-md mx-auto h-full flex justify-around items-center">
              {tabs.map((tab) => {
                const active =
                  tab.to === "/"
                    ? loc.pathname === "/"
                    : loc.pathname.startsWith(tab.to);
                const Icon = tab.icon;
                return (
                  <Link
                    key={tab.key}
                    to={tab.to}
                    data-testid={`nav-${tab.key}`}
                    className={`flex flex-col items-center justify-center gap-0.5 min-h-[48px] min-w-[48px] px-2 ${active ? "text-green-600" : "text-gray-500"}`}
                  >
                    <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                    <span className="text-[10px] font-medium">{tab.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}

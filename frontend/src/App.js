import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import "@/App.css";

import { AuthProvider, useAuth } from "@/auth";
import { I18nProvider } from "@/i18n";

import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import MenuItems from "@/pages/MenuItems";
import RawMaterials from "@/pages/RawMaterials";
import BOMPage from "@/pages/BOM";
import { SalesList, SaleNew } from "@/pages/Sales";
import { InventoryList, InventoryNew } from "@/pages/Inventory";
import { PurchasesList, PurchaseNew } from "@/pages/Purchases";
import Suppliers from "@/pages/Suppliers";
import { WastageList, WastageNew } from "@/pages/Wastage";
import PreparedFood from "@/pages/PreparedFood";
import Variations from "@/pages/Variations";
import AIInsights from "@/pages/AIInsights";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import Subscription from "@/pages/Subscription";
import WalletPage from "@/pages/Wallet";
import SuperAdmin from "@/pages/SuperAdmin";
import DailyClosing from "@/pages/DailyClosing";
import More from "@/pages/More";

function PrivateRoute({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500" data-testid="loading">
        Loading...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (role === "super_admin" && user.role !== "super_admin") return <Navigate to="/" replace />;
  if (role !== "super_admin" && user.role === "super_admin") return <Navigate to="/admin" replace />;
  return children;
}

function RoutesWrap() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/admin" element={<PrivateRoute role="super_admin"><SuperAdmin /></PrivateRoute>} />
      <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/menu" element={<PrivateRoute><MenuItems /></PrivateRoute>} />
      <Route path="/raw-materials" element={<PrivateRoute><RawMaterials /></PrivateRoute>} />
      <Route path="/bom" element={<PrivateRoute><BOMPage /></PrivateRoute>} />
      <Route path="/sales" element={<PrivateRoute><SalesList /></PrivateRoute>} />
      <Route path="/sales/new" element={<PrivateRoute><SaleNew /></PrivateRoute>} />
      <Route path="/inventory" element={<PrivateRoute><InventoryList /></PrivateRoute>} />
      <Route path="/inventory/new" element={<PrivateRoute><InventoryNew /></PrivateRoute>} />
      <Route path="/purchases" element={<PrivateRoute><PurchasesList /></PrivateRoute>} />
      <Route path="/purchases/new" element={<PrivateRoute><PurchaseNew /></PrivateRoute>} />
      <Route path="/suppliers" element={<PrivateRoute><Suppliers /></PrivateRoute>} />
      <Route path="/wastage" element={<PrivateRoute><WastageList /></PrivateRoute>} />
      <Route path="/wastage/new" element={<PrivateRoute><WastageNew /></PrivateRoute>} />
      <Route path="/prepared-food" element={<PrivateRoute><PreparedFood /></PrivateRoute>} />
      <Route path="/variations" element={<PrivateRoute><Variations /></PrivateRoute>} />
      <Route path="/ai-insights" element={<PrivateRoute><AIInsights /></PrivateRoute>} />
      <Route path="/reports" element={<PrivateRoute><Reports /></PrivateRoute>} />
      <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
      <Route path="/subscription" element={<PrivateRoute><Subscription /></PrivateRoute>} />
      <Route path="/wallet" element={<PrivateRoute><WalletPage /></PrivateRoute>} />
      <Route path="/closing" element={<PrivateRoute><DailyClosing /></PrivateRoute>} />
      <Route path="/more" element={<PrivateRoute><More /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <I18nProvider>
        <AuthProvider>
          <RoutesWrap />
          <Toaster position="top-center" richColors closeButton />
        </AuthProvider>
      </I18nProvider>
    </BrowserRouter>
  );
}

export default App;

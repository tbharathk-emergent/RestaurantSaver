export function KPICard({ label, value, sub, accent = "neutral", icon: Icon, testId }) {
  const accents = {
    neutral: "text-gray-900",
    success: "text-green-600",
    danger: "text-red-600",
    warning: "text-amber-600",
    info: "text-blue-600",
  };
  return (
    <div
      data-testid={testId}
      className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col gap-1"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        {Icon && <Icon size={16} className="text-gray-400" />}
      </div>
      <p className={`text-2xl font-bold tracking-tight ${accents[accent]}`} style={{ fontFamily: "Outfit, sans-serif" }}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

export function StatusBadge({ severity, children }) {
  const map = {
    ok: "bg-green-50 text-green-700 border-green-200",
    warn: "bg-amber-50 text-amber-700 border-amber-200",
    alert: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${map[severity] || map.ok}`}>
      {children}
    </span>
  );
}

export function EmptyState({ title, hint, action }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
      <p className="text-gray-700 font-medium">{title}</p>
      {hint && <p className="text-sm text-gray-500 mt-1">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PrimaryButton({ children, onClick, testId, type = "button", disabled = false, className = "" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={`h-12 w-full rounded-lg bg-green-600 text-white font-medium flex items-center justify-center gap-2 active:scale-[0.98] active:bg-green-700 transition-transform disabled:opacity-50 disabled:active:scale-100 ${className}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, onClick, testId, type = "button" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      data-testid={testId}
      className="h-12 w-full rounded-lg bg-white border border-gray-300 text-gray-800 font-medium flex items-center justify-center gap-2 active:bg-gray-50"
    >
      {children}
    </button>
  );
}

export function TextInput({ label, value, onChange, type = "text", placeholder, testId, step }) {
  return (
    <label className="block">
      {label && <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>}
      <input
        type={type}
        value={value}
        step={step}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testId}
        className="h-12 w-full rounded-lg border border-gray-300 bg-gray-50 px-4 text-base focus:ring-2 focus:ring-green-500 focus:border-transparent focus:bg-white outline-none"
      />
    </label>
  );
}

export function SelectInput({ label, value, onChange, options, testId }) {
  return (
    <label className="block">
      {label && <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testId}
        className="h-12 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 text-base focus:ring-2 focus:ring-green-500 outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

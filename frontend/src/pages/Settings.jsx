import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { TextInput, PrimaryButton, SelectInput } from "@/components/ui-kit";
import { useAuth } from "@/auth";
import { useI18n } from "@/i18n";
import client from "@/api";
import { toast } from "sonner";

export default function Settings() {
  const { tenant, refresh } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [form, setForm] = useState({ name: "", logo_url: "", primary_color: "#16A34A", language: "en" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (tenant) {
      setForm({
        name: tenant.name || "",
        logo_url: tenant.logo_url || "",
        primary_color: tenant.primary_color || "#16A34A",
        language: tenant.language || "en",
      });
    }
  }, [tenant]);

  const save = async () => {
    setBusy(true);
    try {
      await client.patch("/tenant", form);
      setLang(form.language);
      toast.success("Saved");
      refresh();
    } catch { toast.error("Failed"); }
    finally { setBusy(false); }
  };

  return (
    <Layout title={t("settings")}>
      <div className="space-y-3">
        <TextInput label="Restaurant Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} testId="set-name" />
        <TextInput label="Logo URL" value={form.logo_url} onChange={(v) => setForm({ ...form, logo_url: v })} testId="set-logo" />
        <label className="block">
          <span className="text-sm font-medium text-gray-700 mb-1 block">Brand Color</span>
          <div className="flex items-center gap-3">
            <input type="color" value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
              className="h-12 w-16 rounded-lg border border-gray-300 bg-white" data-testid="set-color" />
            <span className="text-sm text-gray-700">{form.primary_color}</span>
          </div>
        </label>
        <SelectInput label="Language" value={form.language} onChange={(v) => setForm({ ...form, language: v })} testId="set-lang"
          options={[
            { value: "en", label: "English" },
            { value: "hi", label: "हिंदी" },
            { value: "te", label: "తెలుగు" },
          ]} />

        <PrimaryButton onClick={save} disabled={busy} testId="save-settings-btn">{busy ? "Saving..." : "Save"}</PrimaryButton>
      </div>
    </Layout>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import client from "@/api";
import { useAuth } from "@/auth";
import { useI18n } from "@/i18n";
import { TextInput, PrimaryButton, SelectInput } from "@/components/ui-kit";
import { Phone, ChefHat } from "lucide-react";

export default function Login() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("phone");
  const [otpHint, setOtpHint] = useState("");
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();

  const sendOtp = async () => {
    if (phone.length < 10) {
      toast.error("Enter valid phone number");
      return;
    }
    setBusy(true);
    try {
      const { data } = await client.post("/auth/request-otp", { phone });
      setStep("otp");
      setOtpHint(data.otp_for_dev ? `Dev OTP: ${data.otp_for_dev} (or use 123456)` : "");
      toast.success("OTP sent (mocked SMS)");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to send OTP");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (otp.length < 6) {
      toast.error("Enter 6-digit OTP");
      return;
    }
    setBusy(true);
    try {
      const { data } = await client.post("/auth/verify-otp", { phone, otp });
      login(data.token, data.user, data.tenant);
      toast.success("Welcome!");
      if (data.user.role === "super_admin") navigate("/admin");
      else navigate("/");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center px-4 py-8" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-4">
          <SelectInput
            value={lang}
            onChange={setLang}
            testId="lang-select"
            options={[
              { value: "en", label: "English" },
              { value: "hi", label: "हिंदी" },
              { value: "te", label: "తెలుగు" },
            ]}
          />
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8">
          <div className="flex flex-col items-center mb-6">
            <div className="h-16 w-16 rounded-2xl bg-green-600 flex items-center justify-center mb-3">
              <ChefHat size={32} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "Outfit, sans-serif" }}>
              {t("appName")}
            </h1>
            <p className="text-sm text-gray-500 mt-1">{t("tagline")}</p>
          </div>

          {step === "phone" ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("phone")}</label>
                <div className="flex items-stretch h-12 rounded-lg border border-gray-300 bg-gray-50 overflow-hidden focus-within:ring-2 focus-within:ring-green-500 focus-within:bg-white">
                  <span className="flex items-center px-3 bg-gray-100 border-r border-gray-300 text-gray-600">
                    <Phone size={16} className="mr-1" /> +91
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="9999999999"
                    data-testid="phone-input"
                    className="flex-1 px-3 text-base bg-transparent outline-none"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Try demo: <button className="underline" onClick={() => setPhone("9999999999")} data-testid="use-demo">9999999999</button>{" "}
                  | Super Admin: <button className="underline" onClick={() => setPhone("1111111111")} data-testid="use-superadmin">1111111111</button>
                </p>
              </div>
              <PrimaryButton onClick={sendOtp} disabled={busy} testId="send-otp-btn">
                {busy ? "Sending..." : t("sendOtp")}
              </PrimaryButton>
            </div>
          ) : (
            <div className="space-y-4">
              <TextInput
                label={t("otp")}
                value={otp}
                onChange={(v) => setOtp(v.replace(/\D/g, "").slice(0, 6))}
                placeholder="6-digit OTP"
                testId="otp-input"
              />
              {otpHint && <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">{otpHint}</p>}
              <PrimaryButton onClick={verify} disabled={busy} testId="verify-otp-btn">
                {busy ? "Verifying..." : t("verifyLogin")}
              </PrimaryButton>
              <button
                onClick={() => setStep("phone")}
                className="w-full text-sm text-gray-500 underline"
                data-testid="change-phone-btn"
              >
                Change number
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-500 mt-6">
          OTP via Pingbix (MOCKED). For demo, OTP 123456 always works.
        </p>
      </div>
    </div>
  );
}

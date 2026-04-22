import { useState } from "react";
import { useLocation } from "wouter";
import { useApp } from "@/context/AppContext";

const GOLD = "#D4AF37";
const BG = "#000000";
const CARD = "#0A0A0A";
const BORDER = "#1A1A1A";

export default function RegisterPage() {
  const { register, settings } = useApp();
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const theme = settings.theme;
  const bg = theme === "light" ? "#F5F5F0" : BG;
  const card = theme === "light" ? "#FFFDF8" : CARD;
  const border = theme === "light" ? "#DDD6C8" : BORDER;
  const text = theme === "light" ? "#111111" : "#E8E8E8";
  const muted = theme === "light" ? "#666666" : "#888888";
  const inputBg = theme === "light" ? "#FFFFFF" : "#111";

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) { setError("All fields are required"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    setError("");
    try {
      await register(name.trim(), email.trim(), password);
      setSuccess(true);
      setTimeout(() => setLocation("/"), 2000);
    } catch (err) {
      setError((err as Error).message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>✓</div>
          <h2 style={{ color: GOLD, fontSize: "22px", fontWeight: "600", marginBottom: "8px" }}>Account Created</h2>
          <p style={{ color: muted, fontSize: "14px" }}>Your account is pending admin approval. You'll be redirected shortly.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ width: "100%", maxWidth: "400px" }}>
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <h1 style={{ fontSize: "32px", fontWeight: "700", color: GOLD, letterSpacing: "2px", marginBottom: "8px" }}>MANUSKRIPTA</h1>
          <p style={{ color: muted, fontSize: "14px" }}>AI-Powered Book Creation Platform</p>
        </div>
        <div style={{ backgroundColor: card, border: `1px solid ${border}`, borderRadius: "12px", padding: "32px" }}>
          <h2 style={{ color: text, fontSize: "20px", fontWeight: "600", marginBottom: "24px" }}>Create Account</h2>
          <form onSubmit={handleRegister}>
            {[
              { label: "Full Name", value: name, setter: setName, type: "text", placeholder: "John Doe" },
              { label: "Email", value: email, setter: setEmail, type: "email", placeholder: "you@example.com" },
              { label: "Password", value: password, setter: setPassword, type: "password", placeholder: "••••••••" },
            ].map(({ label, value, setter, type, placeholder }) => (
              <div key={label} style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", color: muted, fontSize: "13px", marginBottom: "6px" }}>{label}</label>
                <input type={type} value={value} onChange={(e) => setter(e.target.value)} placeholder={placeholder} style={{ width: "100%", backgroundColor: inputBg, border: `1px solid ${border}`, borderRadius: "8px", padding: "10px 14px", color: text, fontSize: "14px", outline: "none", boxSizing: "border-box" }} onFocus={(e) => (e.target.style.borderColor = GOLD)} onBlur={(e) => (e.target.style.borderColor = border)} />
              </div>
            ))}
            {error && <div style={{ backgroundColor: "rgba(220,50,50,0.15)", border: "1px solid rgba(220,50,50,0.3)", borderRadius: "8px", padding: "10px 14px", color: "#ff6b6b", fontSize: "13px", marginBottom: "16px" }}>{error}</div>}
            <div style={{ marginBottom: "20px", padding: "12px", backgroundColor: "rgba(212,175,55,0.08)", borderRadius: "8px", border: "1px solid rgba(212,175,55,0.2)" }}>
              <p style={{ color: muted, fontSize: "12px", margin: 0 }}>⚠ Account requires admin approval before you can log in.</p>
            </div>
            <button type="submit" disabled={loading} style={{ width: "100%", backgroundColor: GOLD, color: "#000", padding: "12px", borderRadius: "8px", fontSize: "15px", fontWeight: "600", border: "none", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>
          <div style={{ marginTop: "20px", textAlign: "center" }}>
            <span style={{ color: muted, fontSize: "13px" }}>Already have an account? </span>
            <button onClick={() => setLocation("/login")} style={{ color: GOLD, fontSize: "13px", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Sign in</button>
          </div>
        </div>
      </div>
    </div>
  );
}

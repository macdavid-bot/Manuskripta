import { useState } from "react";
import { useLocation } from "wouter";
import { useApp } from "@/context/AppContext";

const GOLD = "#D4AF37";

export default function LoginPage() {
  const { login, settings } = useApp();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingAccess, setPendingAccess] = useState(false);

  const theme = settings.theme;
  const bg   = theme === "light" ? "#F5F5F0" : "#000000";
  const card = theme === "light" ? "#FFFDF8" : "#0A0A0A";
  const border = theme === "light" ? "#DDD6C8" : "#1A1A1A";
  const text  = theme === "light" ? "#111111" : "#E8E8E8";
  const muted = theme === "light" ? "#666666" : "#888888";
  const inputBg = theme === "light" ? "#FFFFFF" : "#111";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) { setError("Enter email and password"); return; }
    setLoading(true);
    setError("");
    setPendingAccess(false);
    try {
      await login(email.trim(), password);
      setLocation("/");
    } catch (err: unknown) {
      const message = (err as Error).message || "Invalid credentials";
      if (message.toLowerCase().includes("pending")) {
        setPendingAccess(true);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (pendingAccess) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <div style={{ width: "100%", maxWidth: "400px", textAlign: "center" }}>
          <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <h1 style={{ fontSize: "32px", fontWeight: "700", color: GOLD, letterSpacing: "2px", marginBottom: "8px" }}>MANUSKRIPTA</h1>
            <p style={{ color: muted, fontSize: "14px" }}>AI-Powered Book Creation Platform</p>
          </div>
          <div style={{ backgroundColor: card, border: `1px solid ${border}`, borderRadius: "12px", padding: "40px 32px" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>⏳</div>
            <h2 style={{ color: text, fontSize: "20px", fontWeight: "600", marginBottom: "12px" }}>Access Pending</h2>
            <p style={{ color: muted, fontSize: "14px", marginBottom: "28px", lineHeight: 1.6 }}>
              Your account is awaiting admin approval. Request access to be notified when approved.
            </p>
            <a
              href="https://wa.link/tvplnb"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "block", backgroundColor: "#25D366", color: "#fff", padding: "13px 24px", borderRadius: "8px", fontSize: "15px", fontWeight: "600", textDecoration: "none", marginBottom: "16px" }}
            >
              Request Access via WhatsApp
            </a>
            <button onClick={() => setPendingAccess(false)} style={{ color: muted, background: "none", border: "none", cursor: "pointer", fontSize: "13px" }}>
              ← Back to Sign In
            </button>
          </div>
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
          <h2 style={{ color: text, fontSize: "20px", fontWeight: "600", marginBottom: "24px" }}>Sign In</h2>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", color: muted, fontSize: "13px", marginBottom: "6px" }}>Email</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com" autoComplete="email"
                style={{ width: "100%", backgroundColor: inputBg, border: `1px solid ${border}`, borderRadius: "8px", padding: "10px 14px", color: text, fontSize: "14px", outline: "none", boxSizing: "border-box" }}
                onFocus={(e) => (e.target.style.borderColor = GOLD)} onBlur={(e) => (e.target.style.borderColor = border)}
              />
            </div>
            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", color: muted, fontSize: "13px", marginBottom: "6px" }}>Password</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" autoComplete="current-password"
                style={{ width: "100%", backgroundColor: inputBg, border: `1px solid ${border}`, borderRadius: "8px", padding: "10px 14px", color: text, fontSize: "14px", outline: "none", boxSizing: "border-box" }}
                onFocus={(e) => (e.target.style.borderColor = GOLD)} onBlur={(e) => (e.target.style.borderColor = border)}
              />
            </div>
            {error && <div style={{ backgroundColor: "rgba(220,50,50,0.15)", border: "1px solid rgba(220,50,50,0.3)", borderRadius: "8px", padding: "10px 14px", color: "#ff6b6b", fontSize: "13px", marginBottom: "16px" }}>{error}</div>}
            <button type="submit" disabled={loading} style={{ width: "100%", backgroundColor: GOLD, color: "#000", padding: "12px", borderRadius: "8px", fontSize: "15px", fontWeight: "600", border: "none", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
          <div style={{ marginTop: "20px", textAlign: "center" }}>
            <span style={{ color: muted, fontSize: "13px" }}>Don't have an account? </span>
            <button onClick={() => setLocation("/register")} style={{ color: GOLD, fontSize: "13px", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Register</button>
          </div>
          <div style={{ marginTop: "16px", textAlign: "center" }}>
            <p style={{ color: muted, fontSize: "12px" }}>
              Invite-only platform ·{" "}
              <a href="https://wa.link/tvplnb" target="_blank" rel="noopener noreferrer" style={{ color: GOLD }}>Request access</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

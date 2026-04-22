import { useState } from "react";
import { useLocation } from "wouter";
import { useApp } from "@/context/AppContext";
import { NavBar } from "./dashboard";

const GOLD = "#D4AF37";
const BG = "#000000";
const CARD = "#0A0A0A";
const BORDER = "#1A1A1A";

const ALL_TONES = [
  "Authoritative", "Conversational", "Educational", "Motivational",
  "Professional", "Casual", "Inspirational", "Analytical",
  "Storytelling", "Direct", "Empathetic", "Humorous",
];

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0" }}>
      <span style={{ color: "#C8C8C8", fontSize: "14px" }}>{label}</span>
      <button onClick={() => onChange(!value)} style={{ width: "46px", height: "26px", borderRadius: "13px", border: "none", cursor: "pointer", backgroundColor: value ? GOLD : "#333", position: "relative", flexShrink: 0, transition: "background 0.2s" }}>
        <span style={{ position: "absolute", top: "3px", width: "20px", height: "20px", borderRadius: "50%", backgroundColor: "#fff", transition: "left 0.2s", left: value ? "23px" : "3px" }} />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const { settings, updateSettings, logout, user } = useApp();
  const [, setLocation] = useLocation();
  const theme = settings.theme;
  const bg = theme === "light" ? "#F5F5F0" : BG;
  const card = theme === "light" ? "#FFFDF8" : CARD;
  const border = theme === "light" ? "#DDD6C8" : BORDER;
  const text = theme === "light" ? "#111111" : "#E8E8E8";
  const muted = theme === "light" ? "#666666" : "#555555";
  const inputBg = theme === "light" ? "#FFFFFF" : "#111";

  const [memoryBank, setMemoryBank] = useState(settings.memoryBank);
  const [defaultCopyright, setDefaultCopyright] = useState(settings.defaultCopyright);
  const [defaultTones, setDefaultTones] = useState<string[]>(settings.defaultTones);
  const [saved, setSaved] = useState(false);

  const toggleTone = (tone: string) => {
    setDefaultTones((prev) => prev.includes(tone) ? prev.filter((t) => t !== tone) : [...prev, tone]);
  };

  const handleSave = () => {
    updateSettings({ memoryBank, defaultCopyright, defaultTones });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: inputBg,
    border: `1px solid ${border}`,
    borderRadius: "8px",
    color: text,
    padding: "12px 14px",
    fontSize: "14px",
    outline: "none",
    resize: "vertical" as const,
    fontFamily: "inherit",
  };

  const labelStyle: React.CSSProperties = {
    color: muted,
    fontSize: "12px",
    fontWeight: "600",
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    marginBottom: "8px",
    display: "block",
  };

  return (
    <div style={{ backgroundColor: bg, minHeight: "100vh" }}>
      <NavBar />
      <div style={{ maxWidth: "700px", margin: "0 auto", padding: "40px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "32px" }}>
          <button onClick={() => setLocation("/")} style={{ color: muted, background: "none", border: "none", cursor: "pointer", fontSize: "13px", padding: 0 }}>← Back</button>
          <div>
            <h1 style={{ color: text, fontSize: "22px", fontWeight: "600", margin: 0 }}>Settings</h1>
            <p style={{ color: muted, fontSize: "13px", marginTop: "4px" }}>These defaults apply across all book creation</p>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: "12px", padding: "24px" }}>
            <label style={labelStyle}>Appearance</label>
            <Toggle value={settings.theme === "light"} onChange={(v) => updateSettings({ theme: v ? "light" : "dark" })} label="Light Mode" />
            <p style={{ color: muted, fontSize: "12px", marginTop: "4px" }}>Switch between dark (pure black) and light mode. Saved automatically.</p>
          </div>

          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: "12px", padding: "24px" }}>
            <label style={labelStyle}>Downloads</label>
            <Toggle value={settings.autoDownload} onChange={(v) => updateSettings({ autoDownload: v })} label="Auto-download completed books" />
            <p style={{ color: muted, fontSize: "12px", marginTop: "4px" }}>When enabled, books download automatically upon completion.</p>
          </div>

          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: "12px", padding: "24px" }}>
            <label style={labelStyle}>Memory Bank</label>
            <p style={{ color: muted, fontSize: "12px", marginBottom: "12px" }}>Automatically injected into every book generation. Use it for your writing style, brand voice, audience, or recurring preferences.</p>
            <textarea value={memoryBank} onChange={(e) => setMemoryBank(e.target.value)} placeholder="e.g. Write for first-time entrepreneurs aged 25–35..." rows={6} style={inputStyle} />
          </div>

          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: "12px", padding: "24px" }}>
            <label style={labelStyle}>Default Copyright Text</label>
            <p style={{ color: muted, fontSize: "12px", marginBottom: "12px" }}>Pre-filled when you select "Use Default Copyright" in book creation.</p>
            <textarea value={defaultCopyright} onChange={(e) => setDefaultCopyright(e.target.value)} placeholder={`e.g. Copyright © ${new Date().getFullYear()} [Your Name]. All rights reserved.`} rows={4} style={inputStyle} />
          </div>

          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: "12px", padding: "24px" }}>
            <label style={labelStyle}>Default Tone Preset</label>
            <p style={{ color: muted, fontSize: "12px", marginBottom: "14px" }}>Pre-selected in every new book. Can be changed during book creation.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {ALL_TONES.map((tone) => {
                const active = defaultTones.includes(tone);
                return (
                  <button key={tone} onClick={() => toggleTone(tone)} style={{ padding: "6px 14px", borderRadius: "20px", border: `1px solid ${active ? GOLD : border}`, background: active ? `${GOLD}22` : "transparent", color: active ? GOLD : muted, fontSize: "13px", cursor: "pointer", fontWeight: active ? "600" : "400" }}>
                    {tone}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", alignItems: "center" }}>
            {saved && <span style={{ color: "#4CAF50", fontSize: "13px" }}>Settings saved</span>}
            <button onClick={handleSave} style={{ background: GOLD, color: "#000", border: "none", borderRadius: "8px", padding: "12px 32px", fontWeight: "700", fontSize: "14px", cursor: "pointer", letterSpacing: "0.05em" }}>Save Settings</button>
          </div>

          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: "12px", padding: "20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ color: text, fontSize: "14px", margin: 0, fontWeight: "500" }}>{user?.name}</p>
              <p style={{ color: muted, fontSize: "12px", margin: "4px 0 0" }}>{user?.email}</p>
            </div>
            <button onClick={() => { logout(); setLocation("/login"); }} style={{ backgroundColor: "rgba(244,67,54,0.1)", border: "1px solid rgba(244,67,54,0.3)", color: "#f44336", padding: "8px 18px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "500" }}>Logout</button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { NavBar } from "./dashboard";

const GOLD = "#D4AF37";
const BG = "#000000";
const CARD = "#0A0A0A";
const BORDER = "#1A1A1A";

export default function AnnouncementsPage() {
  const { announcements, markAnnouncementsRead, settings } = useApp();
  const theme = settings.theme;
  const bg = theme === "light" ? "#F5F5F0" : BG;
  const card = theme === "light" ? "#FFFDF8" : CARD;
  const border = theme === "light" ? "#DDD6C8" : BORDER;
  const text = theme === "light" ? "#111111" : "#E8E8E8";
  const muted = theme === "light" ? "#666666" : "#555555";

  useEffect(() => { markAnnouncementsRead(); }, []);

  return (
    <div style={{ backgroundColor: bg, minHeight: "100vh" }}>
      <NavBar />
      <div style={{ maxWidth: "700px", margin: "0 auto", padding: "32px 24px" }}>
        <h1 style={{ color: text, fontSize: "22px", fontWeight: "600", marginBottom: "24px" }}>Announcements</h1>
        {announcements.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div style={{ fontSize: "40px", marginBottom: "16px" }}>📢</div>
            <p style={{ color: muted }}>No announcements yet.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {announcements.map((ann) => (
              <div key={ann.id} style={{ backgroundColor: card, border: `1px solid ${border}`, borderRadius: "10px", padding: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ color: muted, fontSize: "12px" }}>{new Date(ann.createdAt).toLocaleString()}</span>
                </div>
                <p style={{ color: text, fontSize: "15px", lineHeight: "1.7", margin: 0, whiteSpace: "pre-wrap" }}>{ann.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

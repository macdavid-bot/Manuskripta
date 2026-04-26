import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();
const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

router.post("/complete", requireAuth, async (req, res) => {
  try {
    const apiKey = process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: "AI service not configured" });
      return;
    }

    const { messages, max_tokens, temperature, model } = req.body as {
      messages: { role: string; content: string }[];
      max_tokens?: number;
      temperature?: number;
      model?: string;
    };

    const upstream = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model ?? "deepseek-reasoner",
        messages,
        max_tokens: max_tokens ?? 4096,
        temperature: temperature ?? 0.7,
      }),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      res.status(upstream.status).json({ error: text });
      return;
    }

    const data = await upstream.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message || "Internal server error" });
  }
});

export default router;

import express from "express";
import puppeteer from "puppeteer";
import { enqueuePDFJob } from "./pdfQueue";

const router = express.Router();

router.post("/export/pdf", async (req, res) => {
  const { title, html } = req.body;

  try {
    await enqueuePDFJob(async () => {
      const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
      const page = await browser.newPage();

      await page.setContent(html, { waitUntil: "networkidle0" });

      const pdfBuffer = await page.pdf({
        printBackground: true,
        margin: {
          top: "1in",
          right: "1in",
          bottom: "0.9in",
          left: "1in",
        },
      });

      await browser.close();

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${title || "book"}.pdf"`
      );

      res.send(pdfBuffer);
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("PDF generation failed");
  }
});

export default router;

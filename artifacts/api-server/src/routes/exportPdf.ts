import express from "express";
import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { enqueuePDFJob } from "./pdfQueue";
import { Marked } from "marked";

const router = express.Router();

const PDF_DIR = path.join(process.cwd(), "generated-pdfs");
if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR);

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-");
}

function buildHTML(title: string, markdown: string) {
  const toc: any[] = [];

  const marked = new Marked();
  marked.use({
    renderer: {
      heading({ text, depth }: any) {
        const id = slugify(text);
        if (depth <= 3) toc.push({ text, id, depth });
        return `<h${depth} id="${id}">${text}</h${depth}>`;
      },
    },
  });

  const body = marked.parse(markdown);

  const tocHtml = toc
    .map((e) => {
      const indent = (e.depth - 1) * 20;
      return `
      <div class="toc-row" style="margin-left:${indent}px">
        <a href="#${e.id}" class="toc-text">${e.text}</a>
        <span class="toc-dots"></span>
        <span class="toc-page">•</span>
      </div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style>
@page { margin: 1in 1in 0.9in 1in; }
body { font-family: Georgia, serif; line-height: 1.7; }
.title { text-align:center; margin-top:200px; page-break-after:always; }
.toc { page-break-after:always; }
</style>
</head>
<body>
<div class="title"><h1>${title}</h1></div>
<div class="toc"><h2>Table of Contents</h2>${tocHtml}</div>
${body}
</body>
</html>`;
}

async function generatePDF(filePath: string, html: string) {
  const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  await page.pdf({ path: filePath, printBackground: true });
  await browser.close();
}

// 🔥 Background generation trigger
router.post("/export/pdf/background", async (req, res) => {
  const { title, markdown, id } = req.body;
  const filePath = path.join(PDF_DIR, `${id}.pdf`);

  enqueuePDFJob(async () => {
    const html = buildHTML(title, markdown);
    await generatePDF(filePath, html);
  });

  res.json({ status: "queued" });
});

// ⚡ Instant download endpoint
router.get("/export/pdf/:id", (req, res) => {
  const filePath = path.join(PDF_DIR, `${req.params.id}.pdf`);

  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).send("PDF not ready");
  }
});

export default router;

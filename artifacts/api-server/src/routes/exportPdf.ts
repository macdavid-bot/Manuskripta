import express from "express";
import puppeteer from "puppeteer";
import { enqueuePDFJob } from "./pdfQueue";
import { Marked } from "marked";

const router = express.Router();

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
body { font-family: Georgia, serif; line-height: 1.7; color:#111; }

.title { text-align: center; margin-top: 200px; page-break-after: always; }

.toc { page-break-after: always; }
.toc h2 { border-bottom:2px solid #000; padding-bottom:8px; }

.toc-row {
  display: flex;
  align-items: center;
  margin: 6px 0;
}

.toc-text {
  text-decoration: none;
  color: #111;
  white-space: nowrap;
}

.toc-dots {
  flex: 1;
  border-bottom: 1px dotted #999;
  margin: 0 6px;
  transform: translateY(-3px);
}

.toc-page {
  font-size: 12px;
  color: #555;
}

h1 { page-break-before: always; font-size:22pt; border-bottom:2px solid #000; }
h2 { page-break-before: always; font-size:17pt; border-bottom:1px solid #000; }
h3 { font-size:13pt; }

p { text-align: justify; margin-bottom:10px; }

</style>
</head>
<body>

<div class="title">
<h1>${title}</h1>
</div>

<div class="toc">
<h2>Table of Contents</h2>
${tocHtml}
</div>

${body}

</body>
</html>`;
}

router.post("/export/pdf", async (req, res) => {
  const { title, markdown } = req.body;

  try {
    await enqueuePDFJob(async () => {
      const html = buildHTML(title, markdown);

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

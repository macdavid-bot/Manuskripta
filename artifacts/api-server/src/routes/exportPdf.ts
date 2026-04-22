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
    .map(
      (e) =>
        `<div style="margin-left:${(e.depth - 1) * 20}px">
          <a href="#${e.id}">${e.text}</a>
        </div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style>
@page { margin: 1in 1in 0.9in 1in; }
body { font-family: Georgia, serif; line-height: 1.7; }
h1 { page-break-before: always; }
.title { text-align: center; margin-top: 200px; }
.toc { page-break-after: always; }
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

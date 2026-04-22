import { Marked } from "marked";
import type { BookJob } from "./types";

function buildHTML(title: string, markdown: string) {
  const marked = new Marked();
  const body = marked.parse(markdown);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<title>${title}</title>
<style>
body { font-family: Georgia, serif; padding: 40px; line-height: 1.6; }
h1,h2,h3 { margin-top: 24px; }
</style>
</head>
<body>
<h1>${title}</h1>
${body}
</body>
</html>`;
}

export async function exportToPDF(job: BookJob) {
  if (!job.markdownContent) {
    alert("No content available to export.");
    return;
  }

  try {
    const html = buildHTML(job.title, job.markdownContent);

    const res = await fetch("/api/export/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: job.title,
        html,
      }),
    });

    if (!res.ok) throw new Error("Failed to generate PDF");

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${job.title.replace(/[^\\w\\s]/g, "").replace(/\\s+/g, "_")}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
    alert("PDF export failed.");
  }
}

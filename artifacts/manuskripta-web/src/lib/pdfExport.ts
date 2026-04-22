// UPDATED PDF EXPORT (direct download via API)
import type { BookJob } from "./types";

export async function exportToPDF(job: BookJob) {
  if (!job.markdownContent) {
    alert("No content available to export.");
    return;
  }

  try {
    const res = await fetch("/api/export/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: job.title,
        markdown: job.markdownContent,
        inputs: job.inputs,
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

    console.log("PDF download started");
  } catch (err) {
    console.error(err);
    alert("PDF export failed.");
  }
}

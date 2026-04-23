import type { BookJob } from "./types";

export async function triggerBackgroundPDF(job: BookJob) {
  if (!job.markdownContent) return;

  await fetch("/api/export/pdf/background", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: job.id,
      title: job.title,
      markdown: job.markdownContent,
    }),
  });
}

export async function downloadPDF(job: BookJob) {
  try {
    const res = await fetch(`/api/export/pdf/${job.id}`);

    if (res.status === 404) {
      alert("Preparing your PDF...");
      return;
    }

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
    alert("Download failed");
  }
}

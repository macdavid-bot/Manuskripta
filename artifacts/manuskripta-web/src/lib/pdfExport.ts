import type { BookJob } from "./types";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";

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
    a.download = `${job.title.replace(/[^\w\s]/g, "").replace(/\s+/g, "_")}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
    alert("Download failed");
  }
}

export async function exportToPDF(job: BookJob) {
  if (!job.markdownContent) {
    alert("No content available to export.");
    return;
  }
  await triggerBackgroundPDF(job);
  await downloadPDF(job);
}

export async function exportToDocx(job: BookJob) {
  if (!job.markdownContent) {
    alert("No content available to export.");
    return;
  }

  try {
    const lines = job.markdownContent.split("\n");
    const children: Paragraph[] = [];

    for (const line of lines) {
      if (line.startsWith("## ")) {
        children.push(
          new Paragraph({
            text: line.replace(/^##\s+/, ""),
            heading: HeadingLevel.HEADING_2,
          })
        );
      } else if (line.startsWith("### ")) {
        children.push(
          new Paragraph({
            text: line.replace(/^###\s+/, ""),
            heading: HeadingLevel.HEADING_3,
          })
        );
      } else if (line.startsWith("#### ")) {
        children.push(
          new Paragraph({
            text: line.replace(/^####\s+/, ""),
            heading: HeadingLevel.HEADING_4,
          })
        );
      } else if (line.startsWith("# ")) {
        children.push(
          new Paragraph({
            text: line.replace(/^#\s+/, ""),
            heading: HeadingLevel.HEADING_1,
          })
        );
      } else if (line.trim() === "") {
        children.push(new Paragraph({ text: "" }));
      } else {
        const boldPattern = /\*\*(.+?)\*\*/g;
        const runs: TextRun[] = [];
        let lastIndex = 0;
        let match;

        while ((match = boldPattern.exec(line)) !== null) {
          if (match.index > lastIndex) {
            runs.push(new TextRun(line.slice(lastIndex, match.index)));
          }
          runs.push(new TextRun({ text: match[1], bold: true }));
          lastIndex = match.index + match[0].length;
        }

        if (lastIndex < line.length) {
          runs.push(new TextRun(line.slice(lastIndex)));
        }

        children.push(new Paragraph({ children: runs.length > 0 ? runs : [new TextRun(line)] }));
      }
    }

    const doc = new Document({
      sections: [{ children }],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${job.title.replace(/[^\w\s]/g, "").replace(/\s+/g, "_")}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
    alert("DOCX export failed");
  }
}

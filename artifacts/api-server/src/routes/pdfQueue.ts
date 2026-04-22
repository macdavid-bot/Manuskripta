import express from "express";

const router = express.Router();

let isProcessing = false;
const queue: any[] = [];

async function processQueue() {
  if (isProcessing || queue.length === 0) return;

  isProcessing = true;
  const job = queue.shift();

  try {
    await job();
  } catch (err) {
    console.error("PDF job failed:", err);
  }

  isProcessing = false;
  processQueue();
}

export function enqueuePDFJob(fn: () => Promise<void>) {
  return new Promise<void>((resolve, reject) => {
    queue.push(async () => {
      try {
        await fn();
        resolve();
      } catch (err) {
        reject(err);
      }
    });

    processQueue();
  });
}

export default router;

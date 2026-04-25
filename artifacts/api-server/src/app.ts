import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { resumeInterruptedJobs } from "./lib/jobRunner.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  })
);

app.use(
  cors({
    origin: true,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);
app.use("/api-server/api", router);

// In production, serve the built web frontend
if (process.env.NODE_ENV === "production") {
  const webDistPath = path.resolve(__dirname, "../../manuskripta-web/dist/public");
  app.use("/manuskripta-web", express.static(webDistPath));
  app.get("/manuskripta-web/{*splat}", (_req, res) => {
    res.sendFile(path.join(webDistPath, "index.html"));
  });
  app.get("/", (_req, res) => {
    res.redirect("/manuskripta-web/");
  });
}

// Resume any jobs that were running when the server last restarted
resumeInterruptedJobs();

export default app;

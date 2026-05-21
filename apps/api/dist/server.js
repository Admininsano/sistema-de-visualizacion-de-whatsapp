import cors from "cors";
import express from "express";
import multer from "multer";
import { parseWhatsAppExport } from "./parser.js";
const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const port = Number(process.env.PORT ?? 4000);
app.use(cors({ origin: true }));
app.use(express.json({ limit: "10mb" }));
app.get("/health", (_request, response) => {
    response.json({ ok: true });
});
app.post("/api/parse", upload.single("file"), async (request, response) => {
    try {
        let text = "";
        const file = request.file;
        if (file) {
            text = file.buffer.toString("utf8");
        }
        else if (typeof request.body?.text === "string") {
            text = request.body.text;
        }
        if (!text.trim()) {
            response.status(400).json({ error: "Se requiere un archivo .txt o texto válido." });
            return;
        }
        const sourceName = typeof request.body?.sourceName === "string" ? request.body.sourceName : file?.originalname ?? "chat";
        const parsed = parseWhatsAppExport(text, sourceName);
        response.json(parsed);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "No fue posible procesar el archivo.";
        response.status(500).json({ error: message });
    }
});
app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
});

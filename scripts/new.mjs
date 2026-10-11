// Crea la carpeta de un vídeo nuevo con su brief y su timeline.
// Uso: npm run new -- <nombre-del-video>
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./lib/common.mjs";

const slug = (process.argv[2] || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
if (!slug) { console.error("Uso: npm run new -- nombre-del-video"); process.exit(1); }
const dir = path.join(ROOT, "videos", slug);
if (fs.existsSync(dir)) { console.error(`Ya existe videos/${slug}`); process.exit(1); }
fs.mkdirSync(path.join(dir, "out"), { recursive: true });
fs.copyFileSync(path.join(ROOT, "studio", "01-director", "BRIEF_TEMPLATE.md"), path.join(dir, "brief.md"));
fs.copyFileSync(path.join(ROOT, "studio", "03-timeline", "TEMPLATE.json"), path.join(dir, "timeline.json"));
console.log(`✔ videos/${slug}/ creado (brief.md + timeline.json)`);
console.log("Siguiente paso: rellena el brief (o pídeselo a Claude) y pasa el Gate 1.");

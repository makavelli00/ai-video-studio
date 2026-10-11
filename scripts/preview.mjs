// Vista previa en vivo en el navegador (se recarga al guardar timeline.json).
// Uso: npm run preview -- <video>
import { exec } from "node:child_process";
import { slugArg, loadVideo, startServer } from "./lib/common.mjs";

const slug = slugArg();
loadVideo(slug);
const port = Number(process.env.PORT) || 3333;
const { url } = await startServer(port);
const full = `${url.replace("127.0.0.1", "localhost")}/engine/preview.html?video=${encodeURIComponent(slug)}`;
console.log(`Vista previa: ${full}\n(Ctrl+C para cerrar)`);
const cmd = process.platform === "win32" ? `start "" "${full}"` : process.platform === "darwin" ? `open "${full}"` : `xdg-open "${full}"`;
if (!process.env.NO_OPEN) exec(cmd, () => {});

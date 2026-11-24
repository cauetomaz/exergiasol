import { mkdir, readFile, readdir, writeFile, copyFile } from "node:fs/promises"
import { extname, join } from "node:path"

const root = "out"
const types = {
  ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".txt": "text/plain; charset=utf-8",
  ".ico": "image/x-icon", ".webp": "image/webp",
}
const assets = {}
for (const file of (await readdir(root, { recursive: true })).sort()) {
  const type = types[extname(file)]
  if (type) assets["/" + file] = [type, (await readFile(join(root, file))).toString("base64")]
}
await mkdir("dist/server", { recursive: true })
await mkdir("dist/.openai", { recursive: true })
await copyFile(".openai/hosting.json", "dist/.openai/hosting.json")
const offers = JSON.parse(await readFile("config/ofertas.json", "utf8"))
const producers = JSON.parse(await readFile("config/produtores.json", "utf8"))
const worker = await readFile("worker/index.mjs", "utf8")
await writeFile("dist/server/index.js", "const assets = " + JSON.stringify(assets) + "\nconst offers = " + JSON.stringify(offers) + "\nconst producers = " + JSON.stringify(producers) + "\n" + worker)

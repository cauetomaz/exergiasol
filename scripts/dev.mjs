import { spawn } from "node:child_process"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const next = require.resolve("next/dist/bin/next")
const options = process.argv.slice(2).filter(option => option !== "--strictPort")
const hostIndex = options.indexOf("--host")
if (hostIndex >= 0) options[hostIndex] = "--hostname"

const server = spawn(process.execPath, [next, "dev", ...options], { stdio: "inherit" })
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal))
}
server.on("exit", code => { process.exitCode = code ?? 1 })

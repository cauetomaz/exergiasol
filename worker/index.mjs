const customerEncoder = new TextEncoder()
const customerCookieName = "__Host-exergia-customer"

function customerHex(bytes) {
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("")
}

async function customerKey(email, secret, sign) {
  return "email-accounts/" + await sign(secret, "email-key:" + email)
}

async function passwordHash(password, salt, secret, sign) {
  const peppered = await sign(secret, "email-password:" + password)
  const material = await crypto.subtle.importKey("raw", customerEncoder.encode(peppered), "PBKDF2", false, ["deriveBits"])
  const bits = await crypto.subtle.deriveBits({
    name: "PBKDF2", hash: "SHA-256", salt: customerEncoder.encode(salt), iterations: 100_000,
  }, material, 256)
  return customerHex(bits)
}

function customerCookie(value, age) {
  return customerCookieName + "=" + value + "; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=" + age
}

async function makeCustomerSession(accountKey, secret, sign) {
  const age = 7 * 24 * 60 * 60
  const payload = (Date.now() + age * 1000) + "." + accountKey.split("/")[1]
  return customerCookie(payload + "." + await sign(secret, "email-session:" + payload), age)
}

async function getCustomerSession(request, secret, sign, equal) {
  if (!secret) return null
  const token = request.headers.get("cookie")?.match(/(?:^|;\s*)__Host-exergia-customer=([^;]+)/)?.[1]
  const match = token?.match(/^((\d{13})\.([a-f0-9]{64}))\.([a-f0-9]{64})$/)
  if (!match || Number(match[2]) <= Date.now()) return null
  const expected = await sign(secret, "email-session:" + match[1])
  return equal(match[4], expected) ? "email-accounts/" + match[3] : null
}

const encoder = new TextEncoder()
const idPattern = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
const orderPattern = new RegExp("^pedido-" + idPattern + "$")
const uploadTypes = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg" }

function json(body, status = 200, extra = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...extra } })
}

function error(message, status) {
  return json({ error: message }, status)
}

function hex(bytes) {
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("")
}

function equal(a, b) {
  if (a.length !== b.length) return false
  let difference = 0
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return difference === 0
}

async function sign(secret, message) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  return hex(await crypto.subtle.sign("HMAC", key, encoder.encode(message)))
}

function cookie(value, age) {
  return "__Host-exergia-admin=" + value + "; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=" + age
}

async function authorized(request, env) {
  if (!env.ADMIN_SESSION_KEY) return false
  const token = request.headers.get("cookie")?.match(/(?:^|;\s*)__Host-exergia-admin=([^;]+)/)?.[1]
  const match = token?.match(/^(\d{13}\.[0-9a-f-]{36})\.([0-9a-f]{64})$/)
  if (!match || Number(match[1].split(".")[0]) <= Date.now()) return false
  return equal(match[2], await sign(env.ADMIN_SESSION_KEY, match[1] + ":" + env.ADMIN_PASSWORD_HASH))
}

async function getConfig(bucket) {
  const stored = await bucket.get("config/producer.json")
  if (stored) return stored.json()
  return { producer: "", name: "", city: "", pix: "" }
}

function validFile(type, bytes) {
  const prefix = Array.from(bytes.slice(0, 8))
  if (type === "application/pdf") return [37, 80, 68, 70, 45].every((byte, index) => prefix[index] === byte)
  if (type === "image/png") return [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => prefix[index] === byte)
  return type === "image/jpeg" && [255, 216, 255].every((byte, index) => prefix[index] === byte)
}

function parseProfile(data) {
  const name = typeof data?.name === "string" ? data.name.trim() : ""
  const city = typeof data?.city === "string" ? data.city.trim() : ""
  if (!["buyer", "producer"].includes(data?.role) || !name || name.length > 100
    || (data.role === "producer" && (!city || city.length > 100))) return null
  return { role: data.role, name, ...(data.role === "producer" ? { city } : {}) }
}

async function route(request, env, url) {
  const { pathname } = url
  const method = request.method
  if (method !== "GET" && request.headers.get("sec-fetch-site") === "cross-site") return error("Origem inválida.", 403)
  if (method !== "GET" && request.headers.get("origin") && request.headers.get("origin") !== url.origin) {
    return error("Origem inválida.", 403)
  }

  if (pathname === "/api/admin/session") {
    if (method === "GET") return json({ signedIn: await authorized(request, env) })
    if (method === "DELETE") return json({ ok: true }, 200, { "Set-Cookie": cookie("", 0) })
    if (method !== "POST") return error("Operação inválida.", 405)
    if (!env.ADMIN_PASSWORD_HASH || !env.ADMIN_SESSION_KEY || !env.ADMIN_LOGIN) return error("Acesso administrativo pendente de configuração.", 503)
    const data = await request.json()
    if (typeof data?.login !== "string" || typeof data?.password !== "string" || data.password.length > 200) return error("Login ou senha inválidos.", 401)
    const verifier = await sign(env.ADMIN_SESSION_KEY, data.password)
    if (!(equal(verifier, env.ADMIN_PASSWORD_HASH) && data.login === env.ADMIN_LOGIN)) {
      return error("Login ou senha inválidos.", 401)
    }
    const hours = 4
    const payload = (Date.now() + hours * 3600_000) + "." + crypto.randomUUID()
    const mac = await sign(env.ADMIN_SESSION_KEY, payload + ":" + env.ADMIN_PASSWORD_HASH)
    return json({ signedIn: true }, 200, { "Set-Cookie": cookie(payload + "." + mac, hours * 3600) })
  }

  if (pathname.startsWith("/api/admin/") && !(await authorized(request, env))) return error("Entre como administrador.", 401)
  const bucket = env.BUCKET
  if (!bucket) return error("Armazenamento privado indisponível.", 503)
  if (pathname === "/api/customer/session") {
    if (method === "DELETE") return json({ ok: true }, 200, { "Set-Cookie": customerCookie("", 0) })
    if (method !== "POST") return error("Operação inválida.", 405)
    const secret = env.CUSTOMER_SECRET
    if (!secret) return error("Cadastro por e-mail temporariamente indisponível.", 503)
    const data = await request.json()
    const email = typeof data?.email === "string" ? data.email.trim().toLowerCase() : ""
    const password = typeof data?.password === "string" ? data.password : ""
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12 || password.length > 128) {
      return error("Informe um e-mail válido e uma senha de 12 a 128 caracteres.", 400)
    }
    if (!["register", "login"].includes(data.action)) return error("Operação inválida.", 400)
    const key = await customerKey(email, secret, sign)
    if (data.action === "register") {
      const profile = parseProfile(data)
      if (!profile) return error("Confira o tipo de cadastro, o nome e a cidade do produtor.", 400)
      const salt = crypto.randomUUID()
      const hash = await passwordHash(password, salt, secret, sign)
      const saved = await bucket.put(key, JSON.stringify({ profile, salt, hash }), { onlyIf: { etagDoesNotMatch: "*" } })
      if (!saved) return error("Não foi possível criar a conta. Se já tiver cadastro, use Entrar.", 409)
      return json({ profile }, 201, { "Set-Cookie": await makeCustomerSession(key, secret, sign) })
    }
    const file = await bucket.get(key)
    const account = file ? await file.json() : null
    const hash = await passwordHash(password, account?.salt ?? "no-account-salt", secret, sign)
    if (!account || !equal(hash, account.hash)) return error("E-mail ou senha inválidos.", 401)
    return json({ profile: account.profile }, 200, { "Set-Cookie": await makeCustomerSession(key, secret, sign) })
  }

  if (pathname === "/api/profile") {
    const customer = await getCustomerSession(request, env.CUSTOMER_SECRET, sign, equal)
    if (method === "GET" && customer) {
      const account = await bucket.get(customer)
      if (account) return json({ profile: (await account.json()).profile, provider: "email" })
    }
    const identity = request.headers.get("oai-authenticated-user-id")
    if (!identity) return error("Entre com ChatGPT para acessar seu cadastro.", 401)
    const key = "accounts/" + hex(await crypto.subtle.digest("SHA-256", encoder.encode(identity)))
    const stored = await bucket.get(key)
    if (method === "GET") return json({ profile: stored ? await stored.json() : null, provider: "chatgpt" })
    if (method !== "POST") return error("Operação inválida.", 405)
    if (stored) return error("Esta conta já tem um cadastro.", 409)
    const data = await request.json()
    const profile = parseProfile(data)
    if (!profile) return error("Confira o tipo de cadastro, o nome e a cidade do produtor.", 400)
    const saved = await bucket.put(key, JSON.stringify(profile), { onlyIf: { etagDoesNotMatch: "*" } })
    if (!saved) return error("Esta conta já tem um cadastro.", 409)
    return json({ profile }, 201)
  }

  if (pathname === "/api/config" && method === "GET") return json(await getConfig(bucket))

  if (pathname === "/api/admin/config" && method === "POST") {
    const data = await request.json()
    const fields = ["producer", "name", "city", "pix"]
    if (!fields.every(field => typeof data?.[field] === "string" && data[field].length <= 120)) return error("Verifique os dados do produtor.", 400)
    const settings = Object.fromEntries(fields.map(field => [field, data[field].trim()]))
    if (settings.producer && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(settings.producer)) return error("Informe um endereço público Solana válido.", 400)
    await bucket.put("config/producer.json", JSON.stringify(settings))
    return json(settings)
  }

  if (pathname === "/api/pix" && method === "POST") {
    if (Number(request.headers.get("content-length")) > 5_100_000) return error("Arquivo inválido. Limite de 5 MB.", 413)
    const form = await request.formData()
    const file = form.get("file")
    const order = form.get("order")
    const adults = Number(form.get("adults"))
    if (typeof order !== "string" || !orderPattern.test(order) || !Number.isInteger(adults) || adults < 1 || adults > 10) return error("Informe um pedido válido.", 400)
    if (!(file instanceof File) || !file.size || file.size > 5_000_000 || !Object.hasOwn(uploadTypes, file.type)) {
      return error("Arquivo inválido. Use PDF, PNG ou JPEG de até 5 MB.", 400)
    }
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (!validFile(file.type, bytes)) return error("Arquivo inválido. O conteúdo não corresponde ao formato informado.", 400)
    const id = crypto.randomUUID()
    await bucket.put("pix/" + id, bytes, {
      customMetadata: { id, order, adults: String(adults), created: new Date().toISOString() },
      httpMetadata: { contentType: file.type },
    })
    return json({ id, status: "pending" }, 201)
  }

  const statusId = pathname.match(new RegExp("^/api/pix/(" + idPattern + ")$"))?.[1]
  if (statusId && method === "GET") {
    if (!(await bucket.head("pix/" + statusId))) return error("Comprovante não encontrado.", 404)
    const decision = await bucket.get("decisions/" + statusId)
    return json({ status: decision ? await decision.text() : "pending" })
  }

  if (pathname === "/api/admin/reviews" && method === "GET") {
    const cursor = url.searchParams.get("cursor") || undefined
    const page = await bucket.list({ prefix: "pix/", include: ["customMetadata"], limit: 30, cursor })
    const reviews = await Promise.all(page.objects.map(async object => {
      const metadata = object.customMetadata
      const decision = await bucket.get("decisions/" + metadata.id)
      return { ...metadata, status: decision ? await decision.text() : "pending" }
    }))
    return json({ reviews, cursor: page.truncated ? page.cursor : "" })
  }

  const reviewId = pathname.match(new RegExp("^/api/admin/reviews/(" + idPattern + ")$"))?.[1]
  if (reviewId && method === "GET") {
    const file = await bucket.get("pix/" + reviewId)
    if (!file) return error("Comprovante não encontrado.", 404)
    const extension = uploadTypes[file.httpMetadata?.contentType] || "bin"
    return new Response(file.body, { headers: {
      "Content-Type": "application/octet-stream", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
      "Content-Disposition": 'attachment; filename="comprovante-' + reviewId + "." + extension + '"',
    } })
  }
  if (reviewId && method === "POST") {
    const data = await request.json()
    if (!["approved", "rejected"].includes(data?.status)) return error("Escolha aprovar ou rejeitar.", 400)
    if (!(await bucket.head("pix/" + reviewId))) return error("Comprovante não encontrado.", 404)
    const result = await bucket.put("decisions/" + reviewId, data.status, { onlyIf: { etagDoesNotMatch: "*" } })
    if (!result) return error("O comprovante já foi revisado.", 409)
    return json({ status: data.status })
  }
  return error("Página não encontrada.", 404)
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname.startsWith("/api/")) {
      try { return await route(request, env, url) }
      catch (exception) {
        if (exception instanceof SyntaxError || exception instanceof TypeError) return error("Não foi possível processar a solicitação.", 400)
        return error("Serviço temporariamente indisponível.", 503)
      }
    }
    if (request.method !== "GET" && request.method !== "HEAD") return new Response(null, { status: 405 })
    const path = url.pathname === "/" ? "/index.html" : url.pathname.replace(/\/$/, "")
    const asset = Object.hasOwn(assets, path) ? assets[path] : assets[path + ".html"]
    if (!asset) return new Response("Página não encontrada", { status: 404 })
    const [type, contents] = asset
    return new Response(request.method === "HEAD" ? null : Uint8Array.from(atob(contents), char => char.charCodeAt(0)), {
      headers: { "Content-Type": type, "X-Content-Type-Options": "nosniff", "Cache-Control": path.startsWith("/_next/static/") ? "public,max-age=31536000,immutable" : "no-store" },
    })
  },
}

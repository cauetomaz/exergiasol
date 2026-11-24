"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"

type Settings = { producer: string; name: string; city: string; pix: string }
type Review = { id: string; order: string; adults: number; status: string; created: string }
const statuses: Record<string, string> = { pending: "Aguardando revisão", approved: "Aprovado", rejected: "Rejeitado" }
const empty = { producer: "", name: "", city: "", pix: "" }

async function request(path: string, body?: object, method = "POST") {
  const response = await fetch(path, body === undefined ? { cache: "no-store" } : {
    method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => null)
    throw new Error(error?.error || "Não foi possível completar a operação.")
  }
  return response.json()
}

export default function Admin() {
  const [signedIn, setSignedIn] = useState(false)
  const [ready, setReady] = useState(false)
  const [settings, setSettings] = useState<Settings>(empty)
  const [reviews, setReviews] = useState<Review[]>([])
  const [cursor, setCursor] = useState("")
  const [notice, setNotice] = useState("")
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (next = "") => {
    const result = await request("/api/admin/reviews" + (next ? "?cursor=" + encodeURIComponent(next) : ""))
    setReviews(previous => next ? [...previous, ...result.reviews] : result.reviews)
    setCursor(result.cursor)
  }, [])

  useEffect(() => {
    request("/api/admin/session").then(async data => {
      if (!data.signedIn) return
      setSignedIn(true)
      const config = await request("/api/config")
      setSettings(config)
      await load()
    }).catch(error => setNotice(error.message)).finally(() => setReady(true))
  }, [load])

  async function run(action: () => Promise<void>) {
    setNotice("")
    setBusy(true)
    try { await action() } catch (error) { setNotice(error instanceof Error ? error.message : "Falha de comunicação.") }
    finally { setBusy(false) }
  }

  function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    form.reset()
    void run(async () => {
      await request("/api/admin/session", { login: values.get("login"), password: values.get("password") })
      setSignedIn(true)
      setSettings(await request("/api/config"))
      await load()
    })
  }

  return <>
    <header className="top"><span className="brand">Exergia<span> SOL</span></span><span className="test">Administração</span></header>
    <main>
      <a href="/">Voltar para a cesta</a>
      <h1 className="admin-title">Revisão de Pix</h1>
      {notice && <p role="status">{notice}</p>}
      {!ready ? <p>Carregando…</p> : !signedIn ? <form className="panel" onSubmit={login}>
        <label className="field">Login<input name="login" autoComplete="username" required maxLength={100} /></label>
        <label className="field">Senha<input name="password" autoComplete="current-password" type="password" required maxLength={200} /></label>
        <button className="primary" disabled={busy}>Entrar</button>
      </form> : <>
        <button className="start" disabled={busy} onClick={() => void run(async () => {
          await request("/api/admin/session", {}, "DELETE")
          setSignedIn(false)
          setReviews([])
          setSettings(empty)
        })}>Sair</button>
        <section className="panel">
          <h2>Comprovantes</h2>
          <button disabled={busy} onClick={() => void run(() => load())}>Atualizar lista</button>
          {reviews.length === 0 && <p>Nenhum comprovante recebido.</p>}
          {reviews.map(item => <article className="method" key={item.id}>
            <h3>{statuses[item.status]}</h3>
            <p><code>{item.order}</code>{item.adults} adulto(s) · {new Date(item.created).toLocaleString("pt-BR")}</p>
            <p><a href={"/api/admin/reviews/" + item.id} download>Baixar comprovante</a></p>
            {item.status === "pending" && <div className="networks">
              {(["approved", "rejected"] as const).map(status => <button key={status} disabled={busy} onClick={() => void run(async () => {
                await request("/api/admin/reviews/" + item.id, { status })
                await load()
              })}>{status === "approved" ? "Aprovar" : "Rejeitar"}</button>)}
            </div>}
          </article>)}
          {cursor && <button disabled={busy} onClick={() => void run(() => load(cursor))}>Carregar mais</button>}
        </section>
        <form className="panel" onSubmit={event => {
          event.preventDefault()
          void run(async () => {
            setSettings(await request("/api/admin/config", settings))
            setNotice("Dados do produtor atualizados.")
          })
        }}>
          <h2>Dados do produtor</h2>
          {([["name", "Nome público"], ["city", "Cidade"], ["producer", "Carteira pública Solana Devnet"], ["pix", "Chave Pix a exibir (opcional)"]] as const)
            .map(([key, label]) => <label className="field" key={key}>{label}
              <input value={settings[key]} maxLength={120} onChange={event => setSettings({ ...settings, [key]: event.target.value })} />
            </label>)}
          <button className="primary" disabled={busy}>Salvar</button>
        </form>
      </>}
    </main>
  </>
}

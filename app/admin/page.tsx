"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"

import OriginLinks from "./origin-links"
import BasketRequests from "./basket-requests"
import FreightPlan from "./freight-plan"

type Settings = { producer: string; name: string; city: string; pix: string }
type City = "rio" | "sao-paulo"
const cityNames: Record<City, string> = { rio: "Rio de Janeiro, RJ", "sao-paulo": "São Paulo, SP" }
const cities = Object.keys(cityNames) as City[]
type Review = { id: string; order: string; adults: number; status: string; created: string; destination?: City }
type Freight = {
  routes: Record<City, { minimum: number | null; baskets: number }>
  batches: { id: string; destination: City; baskets: number; closedAt: string; orders: { order: string; baskets: number }[] }[]
}
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
  const [freight, setFreight] = useState<Freight | null>(null)
  const [confirmRoute, setConfirmRoute] = useState<City | null>(null)
  const [cursor, setCursor] = useState("")
  const [notice, setNotice] = useState("")
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (next = "") => {
    const result = await request("/api/admin/reviews" + (next ? "?cursor=" + encodeURIComponent(next) : ""))
    setReviews(previous => next ? [...previous, ...result.reviews] : result.reviews)
    setCursor(result.cursor)
  }, [])

  const loadFreight = useCallback(async () => {
    setFreight(await request("/api/admin/freight"))
  }, [])

  useEffect(() => {
    request("/api/admin/session").then(async data => {
      if (!data.signedIn) return
      setSignedIn(true)
      const config = await request("/api/config")
      setSettings(config)
      await Promise.all([load(), loadFreight()])
    }).catch(error => setNotice(error.message)).finally(() => setReady(true))
  }, [load, loadFreight])

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
      await Promise.all([load(), loadFreight()])
    })
  }

  return <>
    <main>
      <a href="/">Voltar para a cesta</a>
      <h1 className="admin-title">Administração</h1>
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
          setFreight(null)
          setConfirmRoute(null)
          setSettings(empty)
        })}>Sair</button>
        <BasketRequests />
        <OriginLinks />
        <section className="panel">
          <h2>Fretes da Costa do Cacau, BA</h2>
          <p>Cada pedido Pix aprovado conta como uma cesta. Defina o mínimo de cestas para cada cidade.</p>
          <button disabled={busy} onClick={() => void run(loadFreight)}>Atualizar volumes</button>
          {freight && cities.map(city => {
            const route = freight.routes[city]
            const available = route.minimum !== null && route.baskets >= route.minimum
            return <article className="method" key={city}>
              <h3>{cityNames[city]}</h3>
              <p><strong>{route.baskets}</strong> cesta(s) pronta(s) para consolidar
                {route.minimum !== null && " · mínimo de " + route.minimum}</p>
              <form key={route.minimum ?? "unset"} onSubmit={event => {
                event.preventDefault()
                const data = new FormData(event.currentTarget)
                void run(async () => {
                  await request("/api/admin/freight", { action: "minimum", destination: city, minimum: Number(data.get("minimum")) })
                  setConfirmRoute(null)
                  await loadFreight()
                })
              }}>
                <label className="field">Mínimo de cestas
                  <input name="minimum" required type="number" min="1" max="100000" defaultValue={route.minimum ?? ""} disabled={busy} />
                </label>
                <button disabled={busy}>Salvar mínimo</button>
              </form>
              {confirmRoute !== city ? <p><button className="primary" disabled={busy || !available}
                onClick={() => setConfirmRoute(city)}>Fechar frete</button></p> : <div>
                <p>Consolidar todos os pedidos elegíveis para {cityNames[city]}?</p>
                <div className="networks">
                  <button disabled={busy} onClick={() => setConfirmRoute(null)}>Cancelar</button>
                  <button className="primary" disabled={busy || !available} onClick={() => void run(async () => {
                    await request("/api/admin/freight", { action: "close", destination: city })
                    setConfirmRoute(null)
                    await loadFreight()
                    setNotice("Frete consolidado para " + cityNames[city] + ".")
                  })}>Confirmar fechamento</button>
                </div>
              </div>}
            </article>
          })}
          {freight?.batches.length ? <section className="method">
            <h3>Fretes fechados</h3>
            {freight.batches.map(batch => <details key={batch.id}>
              <summary>{cityNames[batch.destination]} · {batch.baskets} cesta(s) · {new Date(batch.closedAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</summary>
              <code>{batch.id}</code>
              <ul>{batch.orders.map(item => <li key={item.order}><code>{item.order}</code></li>)}</ul>
              <FreightPlan batch={batch} />
            </details>)}
          </section> : null}
          <details className="method"><summary>Planejar custos de frete</summary><FreightPlan /></details>
        </section>
        <section className="panel">
          <h2>Comprovantes</h2>
          <button disabled={busy} onClick={() => void run(() => load())}>Atualizar lista</button>
          {reviews.length === 0 && <p>Nenhum comprovante recebido.</p>}
          {reviews.map(item => <article className="method" key={item.id}>
            <h3>{statuses[item.status]}</h3>
            <p><code>{item.order}</code>{item.adults} adulto(s) · {new Date(item.created).toLocaleString("pt-BR")}</p>
            {item.destination && <p>Destino: {cityNames[item.destination]}</p>}
            {item.status === "approved" && !item.destination && <form onSubmit={event => {
              event.preventDefault()
              const form = new FormData(event.currentTarget)
              void run(async () => {
                await request("/api/admin/freight/destination/" + item.id, { destination: form.get("destination") })
                await Promise.all([load(), loadFreight()])
              })
            }}>
              <label className="field">Destino do pedido antigo
                <select name="destination" required defaultValue="" disabled={busy}>
                  <option value="">Selecione</option>
                  {cities.map(city => <option key={city} value={city}>{cityNames[city]}</option>)}
                </select>
              </label>
              <button disabled={busy}>Salvar destino</button>
            </form>}
            <p><a href={"/api/admin/reviews/" + item.id} download>Baixar comprovante</a></p>
            {item.status === "pending" && <div className="networks">
              {(["approved", "rejected"] as const).map(status => <button key={status} disabled={busy} onClick={() => void run(async () => {
                await request("/api/admin/reviews/" + item.id, { status })
                await Promise.all([load(), loadFreight()])
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

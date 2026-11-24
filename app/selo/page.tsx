"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"

type Lot = { catalog?: { producerId: string; offerId: string } | null; id: string; product: string; producer: string; region: string; date: string; peers: { name: string; date: string }[] }
type Entry = { id: string; product: string; date: string; count: string }
const sample: Lot = {
  id: "CACAU-001", product: "Cacau seco", producer: "Sítio Boa Sombra", region: "Ilhéus, BA", date: "2026-11-10",
  peers: [{ name: "Roça do Cedro", date: "2026-11-11" }, { name: "Sítio Água Clara", date: "2026-11-12" }],
}
const formatDate = (value: string) => value.split("-").reverse().join("/")
const steps = [
  ["Selo entre pares", "Produtores registram lotes e confirmam a origem entre si."],
  ["Origem visível", "QR code para consultar origem, selo e data."],
  ["Cesta por assinatura", "Piloto mensal com Pix e embalagem retornável."],
  ["Mercado direto", "Pagamento em stablecoin liberado na entrega."],
  ["Exergia", "Preço calculado por energia e decisões coletivas."],
]

async function request(path: string, data?: object) {
  const response = await fetch(path, data ? {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  } : { cache: "no-store" })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error)
  return result
}

export default function Selo() {
  const [lot, setLot] = useState<Lot | null>(null)
  const [producer, setProducer] = useState("")
  const [mode, setMode] = useState("inicio")
  const [entries, setEntries] = useState<Entry[]>([])
  const [cursor, setCursor] = useState("")
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const loadMine = useCallback(async (next = "") => {
    const result = await request("/api/seals/mine" + (next ? "?cursor=" + encodeURIComponent(next) : ""))
    setEntries(previous => next ? [...previous, ...result.lots] : result.lots)
    setCursor(result.cursor)
  }, [])

  useEffect(() => {
    let sequence = 0
    async function readLocation() {
      const current = ++sequence
      const [page, id] = window.location.hash.slice(1).split("/")
      setMode(page || "inicio")
      setNotice("")
      setError("")
      setLot(null)
      if (!id) return
      if (id === sample.id) { setLot(sample); return }
      try {
        const result = await request("/api/seals/" + encodeURIComponent(id))
        if (current === sequence) setLot(result.lot)
      } catch (reason) {
        if (current === sequence) setError(reason instanceof Error ? reason.message : "Não foi possível abrir o lote.")
      }
    }
    window.addEventListener("hashchange", readLocation)
    void readLocation()
    request("/api/profile").then(result => {
      if (result.profile?.role === "producer") {
        setProducer(result.profile.name)
        void loadMine().catch(() => setError("Não foi possível carregar seus lotes."))
      }
    }).catch(() => {})
    return () => {
      sequence++
      window.removeEventListener("hashchange", readLocation)
    }
  }, [loadMine])

  async function run(action: () => Promise<void>) {
    setError("")
    setNotice("")
    setBusy(true)
    try { await action() }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível concluir a operação.") }
    finally { setBusy(false) }
  }

  function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = Object.fromEntries(new FormData(event.currentTarget))
    void run(async () => {
      const result = await request("/api/seals", fields)
      window.location.hash = "convite/" + result.lot.id
      void loadMine().catch(() => {})
    })
  }

  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date())

  return <>
    <header className="top"><span className="brand">Exergia<span> SOL</span></span><span className="test">Costa do Cacau</span></header>
    <main className="seal-page">
      <nav className="seal-nav" aria-label="Selo entre pares">
        <a href="/">Cestas</a><a href="#inicio">Selo entre pares</a><a href="#lotes">Meus lotes</a><a href="#roadmap">Roadmap</a>
      </nav>
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {mode === "registrar" ? <section className="panel">
        <h1 className="admin-title">Registrar lote</h1>
        {!producer ? <p><a href="/conta">Entre com uma conta de produtor</a> para registrar lotes.</p> : <form onSubmit={register}>
          <p>Estes dados ficam visíveis para quem receber o link do lote.</p>
          <label className="field">Produto<input name="product" required maxLength={80} /></label>
          <label className="field">Apelido público do produtor<input name="producer" required maxLength={80} defaultValue={producer.slice(0, 80)} /></label>
          <label className="field">Região<input name="region" required maxLength={80} /></label>
          <label className="field">Data do lote<input name="date" type="date" required defaultValue={today} /></label>
          <button className="primary" disabled={busy}>Registrar lote</button>
        </form>}
      </section> : mode === "lotes" ? <section className="panel">
        <h1 className="admin-title">Meus lotes</h1>
        {producer ? <>
          {entries.length ? <ul>{entries.map(item => <li key={item.id}>
            <a href={"#selo/" + item.id}>{item.product}</a> · {formatDate(item.date)} · {item.count}/2 confirmações
          </li>)}</ul> : <p>Você ainda não registrou lotes.</p>}
          {cursor && <button disabled={busy} onClick={() => void run(() => loadMine(cursor))}>Carregar mais</button>}
          <p><a href="#registrar">Registrar lote</a></p>
        </> : <p><a href="/conta">Entre com uma conta de produtor</a> para ver seus lotes.</p>}
        <a href="#selo/CACAU-001">Ver selo de exemplo</a>
      </section> : mode === "roadmap" ? <section className="panel">
        <h1 className="admin-title">Roadmap da Exergia</h1>
        <ol>{steps.map(([title, description], index) => <li key={title}>
          <h3>{title} <small>{index === 0 ? "· Piloto" : "· Previsto"}</small></h3><p>{description}</p>
        </li>)}</ol>
      </section> : ["selo", "confirmar", "convite"].includes(mode) ? lot && <section className="panel">
        <h1 className="admin-title">{mode === "confirmar" ? "Confirmar origem" : mode === "convite" ? "Convidar produtores" : "Selo entre pares"}</h1>
        <p><strong>{lot.peers.length} de 2 confirmações</strong> · {lot.peers.length === 2 ? "Origem confirmada entre pares" : "Aguardando confirmações"}</p>
        <dl className="totals">
          <div><dt>Produto</dt><dd>{lot.product}</dd></div>
          <div><dt>Produtor</dt><dd>{lot.producer}</dd></div>
          <div><dt>Região</dt><dd>{lot.region}</dd></div>
          <div><dt>Data do lote</dt><dd>{formatDate(lot.date)}</dd></div>
        </dl>
        {lot.peers.length > 0 && <ul>{lot.peers.map((peer, index) => <li key={index}>{peer.name} · {formatDate(peer.date)}</li>)}</ul>}
        {lot.id === sample.id ? <p>Selo de demonstração.</p> : mode === "confirmar" && lot.peers.length < 2 ? producer
          ? <form onSubmit={event => {
            event.preventDefault()
            void run(async () => {
              await request("/api/seals/" + lot.id + "/confirm", { visited: true })
              window.location.hash = "selo/" + lot.id
            })
          }}>
            <p>Confirmação pública como {producer}</p>
            <label><input type="checkbox" required /> Visitei o lote e confirmo os dados acima.</label>
            <p><button className="primary" disabled={busy}>Confirmar origem</button></p>
          </form> : <p><a href="/conta">Entre com uma conta de produtor</a> e reabra este convite para confirmar.</p>
          : mode === "convite" ? <>
            <p>Compartilhe com produtores que visitaram o lote.</p>
            <label className="field">Link de confirmação<input readOnly value={new URL("/selo#confirmar/" + lot.id, window.location.origin).href} onFocus={event => event.currentTarget.select()} /></label>
            <button onClick={() => void run(async () => {
              await navigator.clipboard.writeText(new URL("/selo#confirmar/" + lot.id, window.location.origin).href)
              setNotice("Link copiado.")
            })}>Copiar link</button>
          </> : lot.peers.length < 2 && <p><a href={"#convite/" + lot.id}>Pedir confirmação</a></p>}
        {mode !== "selo" && <p><a href={"#selo/" + lot.id}>Ver selo</a></p>}
        {lot.catalog && <p><a href={"/produtores/" + lot.catalog.producerId}>Conhecer o produtor</a>
          {lot.catalog.offerId && <> · <a href={"/ofertas#oferta-" + lot.catalog.offerId}>Ver oferta vinculada</a></>}</p>}
        <p className="hint">Reconhecimento registrado pela plataforma e consultável pelo link do lote.</p>
      </section> : <>
        <section className="intro">
          <h1>A origem tem testemunhas</h1>
          <p>Registre a origem de um lote da Costa do Cacau. Duas confirmações de outros produtores completam o selo entre pares.</p>
          <p className="seal-nav"><a href="#registrar">Registrar lote</a><a href="#selo/CACAU-001">Ver um selo</a></p>
        </section>
        <section className="panel">
          <h2>Como funciona</h2>
          <ol><li>Registre produto, produtor, região e data.</li><li>Convide colegas que visitaram o lote.</li><li>Compartilhe o selo com as confirmações.</li></ol>
        </section>
      </>}
    </main>
  </>
}

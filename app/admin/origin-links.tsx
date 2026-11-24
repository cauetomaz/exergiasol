"use client"

import { useState, type FormEvent } from "react"
import offers from "../../config/ofertas.json"
import producers from "../../config/produtores.json"
import type { OriginLink } from "../produtores/linked-seals"

async function request(data?: object) {
  const response = await fetch("/api/admin/origin", data ? {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  } : { cache: "no-store" })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error)
  return result
}

function extractId(input: string) {
  const segments = input.trim().split("/")
  return segments.at(-1) ?? ""
}

type Lot = { id: string; product: string; producer: string; region: string; peers: unknown[]
  catalog?: { producerId: string; offerId: string } | null }

export default function OriginLinks() {
  const [producerId, setProducerId] = useState("")
  const [offerId, setOfferId] = useState("")
  const [input, setInput] = useState("")
  const [links, setLinks] = useState<OriginLink[] | null>(null)
  const [preview, setPreview] = useState<Lot | null>(null)
  const [lots, setLots] = useState<Lot[] | null>(null)
  const [cursor, setCursor] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState(false)

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setMessage("")
    setError(false)
    try { await action() }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "Não foi possível atualizar o vínculo."); setError(true) }
    finally { setBusy(false) }
  }

  function choose(lot: Lot) {
    setInput(lot.id)
    setPreview(lot)
    setProducerId(lot.catalog?.producerId ?? "")
    setOfferId(lot.catalog?.offerId ?? "")
  }

  async function loadLots(next = "") {
    const response = await fetch("/api/admin/origin/lots" + (next ? "?cursor=" + encodeURIComponent(next) : ""), { cache: "no-store" })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error)
    setLots(previous => next ? [...(previous ?? []), ...result.lots] : result.lots)
    setCursor(result.cursor)
  }

  function save(event: FormEvent) {
    event.preventDefault()
    if (!preview || !producerId) return
    void run(async () => {
      await request({ id: preview.id, producerId, offerId })
      setLinks((await request()).links)
      setPreview(null)
      setInput("")
      setMessage("Selo vinculado ao catálogo.")
    })
  }

  return <section className="panel">
    <h2>Origem e selos do catálogo</h2>
    <p>Abra o lote e confira o produtor e o produto antes de publicar o vínculo.</p>
    <button type="button" disabled={busy} onClick={() => void run(() => loadLots())}>Ver lotes cadastrados</button>
    {lots?.length === 0 && <p>Nenhum lote registrado neste aplicativo.</p>}
    {lots && <ul>{lots.map(lot => <li key={lot.id}>
      <button type="button" disabled={busy} onClick={() => choose(lot)}>{lot.product} · {lot.producer} · {lot.peers.length}/2</button>
    </li>)}</ul>}
    {cursor && <button type="button" disabled={busy} onClick={() => void run(() => loadLots(cursor))}>Carregar mais lotes</button>}
    <form onSubmit={save}>
      <label className="field">Link ou código do lote<input value={input} maxLength={300}
        onChange={event => { setInput(event.target.value); setPreview(null) }} /></label>
      <button type="button" disabled={busy || !input.trim()} onClick={() => void run(async () => {
        const response = await fetch("/api/seals/" + encodeURIComponent(extractId(input)), { cache: "no-store" })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error)
        choose(result.lot)
      })}>Consultar lote</button>
      {preview && <>
        <p><a href={"/selo#selo/" + preview.id}>{preview.product}</a> · {preview.producer} · {preview.region} · {preview.peers.length}/2 confirmações</p>
        <label className="field">Produtor do catálogo
          <select value={producerId} required onChange={event => { setProducerId(event.target.value); setOfferId("") }}>
            <option value="">Selecione</option>
            {producers.map(producer => <option key={producer.id} value={producer.id}>{producer.name}</option>)}
          </select>
        </label>
        <label className="field">Oferta correspondente
          <select value={offerId} onChange={event => setOfferId(event.target.value)}>
            <option value="">Vincular apenas ao produtor</option>
            {offers.filter(offer => offer.producerId === producerId).map(offer => <option key={offer.id} value={offer.id}>
              {offer.name}{offer.variant && " · " + offer.variant}
            </option>)}
          </select>
        </label>
        <button className="primary" disabled={busy || !producerId}>Publicar vínculo</button>
      </>}
    </form>
    {message && <p role={error ? "alert" : "status"}>{message}</p>}
    <p><button type="button" disabled={busy} onClick={() => void run(async () => setLinks((await request()).links))}>
      {links ? "Atualizar vínculos" : "Ver vínculos"}
    </button></p>
    {links?.length === 0 && <p>Nenhum selo vinculado.</p>}
    {links && <ul>{links.map(link => <li className="method" key={link.id}>
      <p><a href={"/selo#selo/" + link.id}>{link.product}</a> · {producers.find(item => item.id === link.producerId)?.name}</p>
      <button type="button" disabled={busy} onClick={() => void run(async () => {
        await request({ id: link.id, remove: true })
        setLinks((await request()).links)
      })}>Remover vínculo</button>
    </li>)}</ul>}
  </section>
}

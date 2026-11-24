"use client"

import { useEffect, useState } from "react"
import offers from "../../config/ofertas.json"

export type OriginLink = {
  id: string; producerId: string; offerId: string; product: string; producer: string
  region: string; date: string; confirmations: number
}

export default function LinkedSeals({ producerId }: { producerId: string }) {
  const [links, setLinks] = useState<OriginLink[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch("/api/origin?producer=" + encodeURIComponent(producerId), { cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error()
        setLinks((await response.json()).links)
      }).catch(() => setError(true))
  }, [producerId])

  return <section className="panel">
    <h2>Selos e lotes</h2>
    {error ? <p>Não foi possível consultar os selos. Atualize a página para tentar novamente.</p>
      : links === null ? <p>Consultando selos…</p>
        : links.length ? <ul className="basket-lines">{links.map(lot => {
          const offer = offers.find(item => item.id === lot.offerId)
          return <li key={lot.id}><div>
            <a href={"/selo#selo/" + lot.id}>{lot.product}</a>
            <div>{lot.date.split("-").reverse().join("/")} · {lot.region}</div>
            <div>{offer ? "Oferta vinculada: " + offer.name + (offer.variant ? " · " + offer.variant : "") : "Lote vinculado ao produtor"}</div>
          </div><span>{lot.confirmations === 2 ? "Confirmado por 2 produtores" : lot.confirmations + " de 2 confirmações"}</span></li>
        })}</ul> : <p>Este produtor ainda não tem lotes vinculados ao catálogo.</p>}
  </section>
}

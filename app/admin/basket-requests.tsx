"use client"

import { useState } from "react"

type Order = {
  key: string; id: string; status: "requested" | "contacted"; customer: string; subtotal: number; grams: number
  items: { id: string; name: string; variant: string; quantity: number }[]
  contact: { channel: "email" | "whatsapp"; value: string }
  delivery: { city: string; cep: string; street: string; number: string; neighborhood: string; extra: string }
}
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
const kilos = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 })

async function request(path: string, data?: object) {
  const response = await fetch(path, data ? {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  } : { cache: "no-store" })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error)
  return result
}

export default function BasketRequests() {
  const [orders, setOrders] = useState<Order[]>([])
  const [cursor, setCursor] = useState("")
  const [opened, setOpened] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function load(next = "") {
    const result = await request("/api/admin/baskets" + (next ? "?cursor=" + encodeURIComponent(next) : ""))
    setOrders(previous => next ? [...previous, ...result.orders] : result.orders)
    setCursor(result.cursor)
    setOpened(true)
  }

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError("")
    try { await action() }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível completar a operação.") }
    finally { setBusy(false) }
  }

  return <section className="panel">
    <h2>Solicitações de cestas</h2>
    <p>Confirme disponibilidade, frete e valor final com o comprador.</p>
    <button type="button" disabled={busy} onClick={() => void run(() => load())}>{opened ? "Atualizar solicitações" : "Ver solicitações"}</button>
    {error && <p role="alert" className="error">{error}</p>}
    {opened && !orders.length && <p>Nenhuma solicitação registrada.</p>}
    {orders.map(order => {
      const { delivery, contact } = order
      const city = delivery.city === "rio" ? "Rio de Janeiro, RJ" : "São Paulo, SP"
      const digits = contact.value.replace(/\D/g, "")
      const whatsapp = digits.length <= 11 ? "55" + digits : digits
      return <details className="method" key={order.id}>
        <summary>{order.customer} · {city} · {order.status === "contacted" ? "Contato realizado" : "Aguardando contato"}</summary>
        <code>{order.id}</code>
        <ul>{order.items.map(line => <li key={line.id}>{line.quantity} × {line.name}{line.variant && " · " + line.variant}</li>)}</ul>
        <p><strong>{brl.format(order.subtotal / 100)}</strong> em produtos · {kilos.format(order.grams / 1000)} kg</p>
        <p>{delivery.street}, {delivery.number}{delivery.extra && " · " + delivery.extra}<br />
          {delivery.neighborhood} · {city} · CEP {delivery.cep}</p>
        <p>{contact.channel === "email"
          ? <a href={"mailto:" + encodeURIComponent(contact.value)}>Escrever para {contact.value}</a>
          : <a href={"https://wa.me/" + whatsapp} target="_blank" rel="noreferrer">Abrir WhatsApp de {contact.value}</a>}</p>
        {order.status !== "contacted" && <button disabled={busy} onClick={() => void run(async () => {
          await request("/api/admin/baskets/" + order.key, { status: "contacted" })
          setOrders(previous => previous.map(item => item.id === order.id ? { ...item, status: "contacted" } : item))
        })}>Marcar contato realizado</button>}
      </details>
    })}
    {cursor && <button disabled={busy} onClick={() => void run(() => load(cursor))}>Carregar mais</button>}
  </section>
}

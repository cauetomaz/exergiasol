"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import offers from "../../config/ofertas.json"

type Order = {
  id: string; subtotal: number; status: string; city: string;
  items: { id: string; name: string; variant: string; quantity: number }[]
}
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
const kilograms = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 })
const cities: Record<string, string> = { rio: "Rio de Janeiro, RJ", "sao-paulo": "São Paulo, SP" }
const storageName = "exergia-ofertas-cesta"

export default function Basket() {
  const [cart, setCart] = useState<Record<string, number>>({})
  const [loaded, setLoaded] = useState(false)
  const [review, setReview] = useState(false)
  const [profile, setProfile] = useState("")
  const [channel, setChannel] = useState("whatsapp")
  const [orders, setOrders] = useState<Order[]>([])
  const [cursor, setCursor] = useState("")
  const [opened, setOpened] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const requestId = useRef("")
  const cartTitle = useRef<HTMLHeadingElement>(null)
  const saved = offers.filter(offer => cart[offer.id] > 0)
  const total = saved.reduce((sum, offer) => sum + offer.price * cart[offer.id], 0)
  const grams = saved.reduce((sum, offer) => sum + offer.grams * cart[offer.id], 0)

  useEffect(() => {
    try {
      const data = JSON.parse(sessionStorage.getItem(storageName) ?? "{}")
      setCart(Object.fromEntries(offers.map(offer => [offer.id,
        Number.isInteger(data?.[offer.id]) ? Math.min(offer.limit, Math.max(0, data[offer.id])) : 0])))
    } catch {}
    setLoaded(true)
    fetch("/api/profile", { cache: "no-store" }).then(async response => {
      if (response.ok) setProfile((await response.json()).profile?.role ?? "")
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!loaded) return
    try { sessionStorage.setItem(storageName, JSON.stringify(cart)) } catch {}
  }, [cart, loaded])

  function change(id: string, quantity: number, limit: number) {
    setCart(previous => ({ ...previous, [id]: Math.max(0, Math.min(limit, quantity)) }))
    requestId.current = ""
    setNotice("")
    setError("")
  }

  async function history(next = "") {
    setError("")
    try {
      const response = await fetch("/api/baskets" + (next ? "?cursor=" + encodeURIComponent(next) : ""), { cache: "no-store" })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setOrders(previous => next ? [...previous, ...result.orders] : result.orders)
      setCursor(result.cursor)
      setOpened(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar suas solicitações.")
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving || !saved.length) return
    setSaving(true)
    setError("")
    setNotice("")
    const fields = Object.fromEntries(new FormData(event.currentTarget))
    requestId.current ||= crypto.randomUUID()
    try {
      const response = await fetch("/api/baskets", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: requestId.current, items: saved.map(item => ({ id: item.id, quantity: cart[item.id] })),
          delivery: { city: fields.city, cep: fields.cep, street: fields.street, number: fields.number, neighborhood: fields.neighborhood, extra: fields.extra },
          contact: { channel, value: fields.contact },
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setCart({})
      setReview(false)
      requestId.current = ""
      setNotice("Cesta enviada. A equipe vai usar o contato informado para combinar disponibilidade, frete e valor final.")
      await history()
      cartTitle.current?.focus()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível enviar a cesta.")
    } finally { setSaving(false) }
  }

  return <>
    {saved.length > 0 && <aside className="basket-jump" aria-label="Resumo da cesta">
      <a href="#basket-title">{saved.reduce((count, offer) => count + cart[offer.id], 0)} embalagem(ns) · {currency.format(total / 100)} · Ver cesta</a>
    </aside>}
    <section className="offers-section">
      <h1>Monte sua cesta</h1>
      <p>Escolha os produtos e envie a cesta para combinar a entrega no Rio de Janeiro ou em São Paulo.</p>
      <p><a href="/produtores">Conheça quem produz</a></p>
      <div className="offers-grid">
        {offers.map(offer => {
          const quantity = cart[offer.id] ?? 0
          return <article className="offer-card" id={"oferta-" + offer.id} key={offer.id}>
            <p className="offer-brand"><a href={"/produtores/" + offer.producerId}>{offer.brand}</a> · {offer.origin}</p>
            <h2>{offer.name}</h2>
            {offer.variant && <p>{offer.variant}</p>}
            <p><strong>{currency.format(offer.price / 100)}</strong> · {offer.grams === 1000 ? "1 kg" : offer.grams + " g"}</p>
            <div className="offer-quantity">
              {quantity === 0 ? <button className="primary" type="button" disabled={!loaded || saving}
                aria-label={"Adicionar " + offer.name + (offer.variant ? " " + offer.variant : "")}
                onClick={() => change(offer.id, 1, offer.limit)}>Adicionar à cesta</button>
                : <>
                  <button type="button" disabled={saving} aria-label={"Remover uma embalagem de " + offer.name + " " + offer.variant}
                    onClick={() => change(offer.id, quantity - 1, offer.limit)}>−</button>
                  <output aria-label="Quantidade">{quantity}</output>
                  <button type="button" disabled={saving || quantity >= offer.limit}
                    aria-label={"Adicionar uma embalagem de " + offer.name + " " + offer.variant}
                    onClick={() => change(offer.id, quantity + 1, offer.limit)}>+</button>
                </>}
            </div>
          </article>
        })}
      </div>
    </section>
    <section className="panel basket-summary" aria-labelledby="basket-title">
      <h2 id="basket-title" ref={cartTitle} tabIndex={-1}>Sua cesta</h2>
      {notice && <p role="status">{notice}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {saved.length ? <>
        <ul className="basket-lines">{saved.map(offer => <li key={offer.id}>
          <span>{cart[offer.id]} × {offer.name}{offer.variant && " · " + offer.variant}</span>
          <strong>{currency.format(offer.price * cart[offer.id] / 100)}</strong>
        </li>)}</ul>
        <p aria-live="polite"><strong>{currency.format(total / 100)}</strong> em produtos · {kilograms.format(grams / 1000)} kg</p>
        <p>Frete e disponibilidade serão confirmados pela equipe.</p>
        {!review ? <button className="primary" onClick={() => setReview(true)}>Continuar para entrega</button>
          : profile !== "buyer" ? <p><a href="/conta">Entrar ou criar conta de comprador</a>. A seleção fica guardada nesta aba.</p>
            : <form onSubmit={submit} className="basket-delivery">
              <p>Seu contato e endereço ficam disponíveis para a equipe que organiza a entrega.</p>
              <div className="basket-fields">
                <label className="field">Cidade<select name="city" required defaultValue="">
                  <option value="">Selecione</option>{Object.entries(cities).map(([id, city]) => <option key={id} value={id}>{city}</option>)}
                </select></label>
                <label className="field">CEP<input name="cep" autoComplete="postal-code" inputMode="numeric" required pattern="[0-9]{5}-?[0-9]{3}" maxLength={9} /></label>
                <label className="field">Rua ou avenida<input name="street" autoComplete="address-line1" required maxLength={120} /></label>
                <label className="field">Número<input name="number" required maxLength={24} /></label>
                <label className="field">Bairro<input name="neighborhood" required maxLength={80} /></label>
                <label className="field">Complemento (opcional)<input name="extra" autoComplete="address-line2" maxLength={100} /></label>
                <label className="field">Como podemos falar com você?
                  <select value={channel} onChange={event => setChannel(event.target.value)}><option value="whatsapp">WhatsApp</option><option value="email">E-mail</option></select>
                </label>
                <label className="field">{channel === "email" ? "E-mail para contato" : "WhatsApp com DDD"}
                  <input key={channel} name="contact" type={channel === "email" ? "email" : "tel"} required
                    autoComplete={channel === "email" ? "email" : "tel"} maxLength={channel === "email" ? 254 : 25} />
                </label>
              </div>
              <button className="primary" disabled={saving}>{saving ? "Enviando…" : "Enviar solicitação"}</button>
            </form>}
      </> : !notice && <p>Adicione um produto para começar.</p>}
    </section>
    {profile === "buyer" && <section className="panel">
      <h2>Minhas solicitações</h2>
      <button onClick={() => void history()}>{opened ? "Atualizar solicitações" : "Ver solicitações"}</button>
      {opened && (orders.length ? <ul>{orders.map(item => <li key={item.id}>
        <strong>{item.status === "contacted" ? "Contato realizado" : "Aguardando contato"}</strong>
        <span>{cities[item.city]} · {currency.format(item.subtotal / 100)} em produtos</span>
        <span>{item.items.map(line => line.quantity + " × " + line.name + (line.variant ? " · " + line.variant : "")).join("; ")}</span>
        <code>{item.id}</code>
      </li>)}</ul> : <p>Nenhuma solicitação registrada.</p>)}
      {cursor && <button onClick={() => void history(cursor)}>Carregar mais</button>}
    </section>}
  </>
}

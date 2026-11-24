"use client"

import { useState, type FormEvent } from "react"

type Batch = { id: string; destination: string; baskets: number }
const source = "https://chatgpt.com/share/6b00c1b1-90a8-83ea-9b6a-1521bacd6977"
const scenarios = [
  { kg: 30, freight: 240, local: 320 },
  { kg: 50, freight: 390, local: 400 },
  { kg: 100, freight: 500, local: 580 },
  { kg: 300, freight: 875, local: 1090 },
  { kg: 500, freight: 1200, local: 1500 },
]
const modes = [
  ["network", "Pessoa da rede em viagem já prevista"],
  ["bus", "Ônibus-encomenda ou bagagem adicional"],
  ["parcel", "Encomenda ou transportadora"],
  ["ltl", "Carga fracionada ou palete"],
  ["cold", "Transporte com controle de temperatura"],
] as const
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 })
const cents = (value: number) => Math.round(value * 100)
const money = (value: number) => brl.format(value / 100)
const empty = {
  kg: 0, packed: 0, volume: 0, cubic: 0, products: 0, freight: 0, operation: 0,
  advance: 0, contribution: 5, handling: 0, losses: 0, days: 0, mode: "parcel",
  cargo: "ambient", dispatch: "", receipt: "", notes: "",
}
type Plan = typeof empty
const labels = {
  kg: "Peso líquido (kg)", packed: "Peso embalado (kg)", volume: "Volume total (m³)",
  cubic: "Peso cubado informado pela transportadora (kg)", products: "Valor total dos produtos (R$)",
  freight: "Transporte interestadual (R$)", operation: "Operação local total (R$)",
  advance: "Parcela da operação local adiantada pela GPBR (R$)", contribution: "Contribuição sobre o adiantamento (%)",
  handling: "Acompanhamento da carga (R$)", losses: "Perdas ou avarias registradas (R$)",
  days: "Prazo de transporte (dias)",
} as const

export default function FreightPlan({ batch }: { batch?: Batch }) {
  const [data, setData] = useState<Plan>(empty)
  const [opened, setOpened] = useState(false)
  const [saved, setSaved] = useState(false)
  const [revision, setRevision] = useState("")
  const [scenario, setScenario] = useState("")
  const [status, setStatus] = useState("")
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const route = "/api/admin/freight/plans/" + batch?.id
  const surplus = Math.round(cents(data.advance) * cents(data.contribution) / 10_000)
  const total = cents(data.products) + cents(data.freight) + cents(data.operation) + cents(data.handling) + surplus
  const recurring = cents(data.freight) + cents(data.operation) + cents(data.handling) + surplus
  const invalid = data.advance > data.operation || (data.packed > 0 && data.packed < data.kg)

  async function load() {
    setBusy(true)
    setStatus("")
    setFailed(false)
    try {
      const response = await fetch(route, { cache: "no-store" })
      if (!response.ok) throw new Error()
      const result = await response.json()
      setData(result.plan ?? empty)
      setRevision(result.revision)
      setSaved(Boolean(result.plan))
      setOpened(true)
    } catch {
      setStatus("Não foi possível carregar a ficha.")
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  function setPreset(value: string) {
    setScenario(value)
    const model = scenarios.find(item => String(item.kg) === value)
    if (!model) return
    const firstCycle = 320
    setData({
      ...empty, kg: model.kg, products: model.kg * 60, freight: model.freight,
      operation: model.local + firstCycle, advance: model.local + firstCycle,
      mode: model.kg >= 100 ? "ltl" : "parcel",
    })
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!batch) return
    setBusy(true)
    setStatus("")
    setFailed(false)
    try {
      const response = await fetch(route, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: data, revision }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setRevision(result.revision)
      setSaved(true)
      setStatus("Ficha de expedição salva.")
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível salvar a ficha.")
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return <section className="method">
    {batch ? <>
      {!opened && <button type="button" disabled={busy} onClick={() => void load()}>Abrir ficha de expedição</button>}
      {opened && <h4>Ficha de expedição</h4>}
    </> : <h3>Simulador de frete e custeio</h3>}
    {status && <p role={failed ? "alert" : "status"}>{status}</p>}
    {(!batch || opened) && <form onSubmit={save}>
      {!batch && <>
        <p>As referências da Bahia para São Paulo são estimativas de planejamento. Para o Rio de Janeiro, informe os custos da rota. Os cenários usam R$ 60/kg na origem, a parcela inicial de R$ 320 da articulação e contribuição de 5%.</p>
        <label className="field">Cenário de referência • Bahia → São Paulo
          <select value={scenario} onChange={event => setPreset(event.target.value)}>
            <option value="">Preencher manualmente</option>
            {scenarios.map(model => <option key={model.kg} value={model.kg}>{model.kg} kg</option>)}
          </select>
        </label>
        <p><a href={source} target="_blank" rel="noreferrer">Pesquisa e hipóteses de frete</a></p>
      </>}
      <label className="field">Modalidade
        <select value={data.mode} onChange={event => setData({ ...data, mode: event.target.value })}>
          {modes.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </label>
      <label className="field">Tipo de carga
        <select value={data.cargo} onChange={event => setData({ ...data, cargo: event.target.value })}>
          <option value="ambient">Produtos estáveis</option>
          <option value="sensitive">Chocolate ou carga sensível ao calor</option>
          <option value="frozen">Polpa congelada ou outra carga de cadeia fria</option>
        </select>
      </label>
      {data.cargo !== "ambient" && <p>Registre a condição térmica combinada com o operador antes de expedir.</p>}
      {data.mode === "network" && <p>Informe o gasto adicional da viagem e a remuneração pelo acompanhamento em campos separados.</p>}
      {(Object.keys(labels) as (keyof typeof labels)[]).map(key => <label className="field" key={key}>{labels[key]}
        <input type="number" min="0" max={key === "contribution" ? 100 : 10000000} step={key === "volume" ? ".001" : key === "days" ? "1" : ".01"}
          value={data[key] || ""} disabled={busy} onChange={event => setData({ ...data, [key]: Number(event.target.value) })} />
      </label>)}
      <dl className="totals">
        <div><dt>Contribuição de reposição</dt><dd>{money(surplus)}</dd></div>
        <div><dt>Valor a devolver à GPBR</dt><dd>{money(cents(data.advance) + surplus)}</dd></div>
        <div><dt>Custo total entregue</dt><dd>{money(total)}</dd></div>
        {data.kg > 0 && <>
          <div><dt>Custo entregue por kg líquido</dt><dd>{money(Math.round(total / data.kg))}</dd></div>
          <div><dt>Operação e frete por kg líquido</dt><dd>{money(Math.round(recurring / data.kg))}</dd></div>
        </>}
        {data.packed > 0 && <div><dt>Frete por kg embalado</dt><dd>{money(Math.round(cents(data.freight) / data.packed))}</dd></div>}
        {data.products > 0 && <div><dt>Operação e frete sobre o valor dos produtos</dt><dd>{decimal.format(recurring / cents(data.products) * 100)}%</dd></div>}
      </dl>
      {invalid && <p role="alert">Confira se o adiantamento está dentro do custo local e se o peso embalado comporta o peso líquido.</p>}
      {batch && <>
        <label className="field">Ponto de expedição na Bahia<input value={data.dispatch} maxLength={160} onChange={event => setData({ ...data, dispatch: event.target.value })} /></label>
        <label className="field">Ponto de recebimento no destino<input value={data.receipt} maxLength={160} onChange={event => setData({ ...data, receipt: event.target.value })} /></label>
        <label className="field">Embalagem, documentação e condições de transporte
          <textarea value={data.notes} maxLength={2000} onChange={event => setData({ ...data, notes: event.target.value })} />
        </label>
        <button className="primary" disabled={busy || invalid}>Salvar ficha</button>
        {saved && <button type="button" disabled={busy} onClick={() => void load()}>Recarregar ficha salva</button>}
      </>}
    </form>}
  </section>
}

"use client"

import { useEffect, useState } from "react"
import { restorePayment, sendMemo, solscan, transactionStatus } from "../lib/solana"

type Config = { producer: string; name: string; city: string; pix: string }
type Status = "pending" | "confirmed" | "failed"
const number = new Intl.NumberFormat("pt-BR")
const sol = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const reviewLabels: Record<string, string> = { pending: "Aguardando revisão", approved: "Comprovante aprovado", rejected: "Comprovante rejeitado" }

export default function Checkout({ address, walletName, network }: { address: string; walletName: string; network: string }) {
  const [step, setStep] = useState(2)
  const [adults, setAdults] = useState(2)
  const [order, setOrder] = useState("")
  const [config, setConfig] = useState<Config | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState("")
  const [destination, setDestination] = useState("")
  const [pixId, setPixId] = useState("")
  const [pixLookup, setPixLookup] = useState("")
  const [pixFreight, setPixFreight] = useState<{ destination: string; closedAt: string } | null>(null)
  const [pixStatus, setPixStatus] = useState("")
  const [payment, setPayment] = useState("")
  const [paymentStatus, setPaymentStatus] = useState<Status>("pending")
  const [receipt, setReceipt] = useState("")
  const [receiptStatus, setReceiptStatus] = useState<Status>("pending")
  const [recovery, setRecovery] = useState("")
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)

  const kcal = adults * 2100 * 30
  const kwh = kcal / 860.42
  const milliSol = Math.round(kwh)

  useEffect(() => {
    setOrder("pedido-" + crypto.randomUUID())
    fetch("/api/config", { cache: "no-store" }).then(response => {
      if (!response.ok) throw new Error()
      return response.json()
    }).then(setConfig).catch(() => setMessage("Não foi possível carregar os dados do produtor. Recarregue a página."))
  }, [])

  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setMessage("")
    try {
      await action()
    } catch (error) {
      const code = (error as { code?: number } | null)?.code
      const text = error instanceof Error ? error.message : ""
      setMessage(code === 4001 || /reject|declin|denied/i.test(text)
        ? "Aprovação recusada na carteira."
        : /^(Conecte|Ative|Saldo|Falha|Informe|Pagamento|O pagamento|Não foi|Arquivo)/.test(text)
          ? text : "Falha de comunicação. Verifique a conexão e consulte a assinatura antes de repetir uma operação enviada.")
    } finally {
      setBusy(false)
    }
  }

  async function check(signature: string, setStatus: (status: Status) => void) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const status = await transactionStatus(signature)
      if (status !== "pending") {
        setStatus(status)
        return
      }
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 1500))
    }
    setStatus("pending")
  }

  async function pay() {
    if (network !== "Solana" || !address) throw new Error("Conecte uma carteira Solana na tela inicial.")
    if (!config?.producer) throw new Error("Não foi configurada uma carteira do produtor.")
    const signature = await sendMemo(walletName, address, "EXERGIA | pagamento | " + order + " | " + kcal + " kcal",
      { producer: config.producer, lamports: milliSol * 1_000_000 })
    setPayment(signature)
    setPaymentStatus("pending")
    setStep(4)
    await check(signature, setPaymentStatus)
  }

  async function sendReceipt() {
    if (!config?.producer || !address) throw new Error("Conecte a carteira Solana usada no pagamento.")
    const originalOrder = await restorePayment(payment, address, config.producer)
    const signature = await sendMemo(walletName, address, "EXERGIA | recebido | " + originalOrder)
    setReceipt(signature)
    setReceiptStatus("pending")
    await check(signature, setReceiptStatus)
  }

  async function upload() {
    if (!file) throw new Error("Arquivo obrigatório.")
    const form = new FormData()
    form.set("file", file)
    form.set("destination", destination)
    form.set("order", order)
    form.set("adults", String(adults))
    const response = await fetch("/api/pix", { method: "POST", body: form })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error)
    setPixId(data.id)
    setPixStatus("pending")
    setFile(null)
    setPreview("")
  }

  async function refreshPix(id = pixId) {
    if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id)) throw new Error("Informe o código do comprovante Pix.")
    const response = await fetch("/api/pix/" + id, { cache: "no-store" })
    if (!response.ok) throw new Error("Não foi possível consultar o comprovante.")
    const result = await response.json()
    setPixStatus(result.status)
    setPixFreight(result.freight)
    setPixId(id)
  }

  if (step === 2) return (
    <section className="panel">
      <h2>Para quantos adultos?</h2>
      <label className="field">Número de adultos
        <select value={adults} onChange={event => setAdults(Number(event.target.value))}>
          {Array.from({ length: 10 }, (_, index) => index + 1).map(n => <option key={n}>{n}</option>)}
        </select>
      </label>
      <button type="button" className="primary" onClick={() => setStep(3)}>Ir ao checkout</button>
      <details>
        <summary>Consultar pedido Pix</summary>
        <label className="field">Código do comprovante
          <input value={pixLookup} onChange={event => setPixLookup(event.target.value)} />
        </label>
        <button disabled={busy || !pixLookup.trim()} onClick={() => void run(async () => {
          await refreshPix(pixLookup.trim())
          setStep(3)
        })}>Consultar pedido</button>
      </details>
      {network === "Solana" && <details>
        <summary>Já paguei em SOL</summary>
        <label className="field">Assinatura da transação
          <input value={recovery} onChange={event => setRecovery(event.target.value)} placeholder="Copie a assinatura do Solscan" />
        </label>
        <button disabled={busy || !config?.producer || !recovery} onClick={() => void run(async () => {
          if (network !== "Solana" || !address) throw new Error("Conecte a carteira Solana usada no pagamento.")
          const signature = recovery.trim()
          setOrder(await restorePayment(signature, address, config.producer))
          setPayment(signature)
          setPaymentStatus("confirmed")
          setStep(5)
        })}>Retomar recebimento</button>
      </details>}
      {message && <p role="alert" className="error">{message}</p>}
    </section>
  )

  if (step === 3) return (
    <section className="panel">
      <h2>Checkout</h2>
      <p>{config?.name || "Produtor ainda não configurado"}{config?.city && " · " + config.city}</p>
      <p className="hint">Cesta de demonstração com 1 kg de banana, 1 kg de mandioca e 1 maço de couve.</p>
      {!pixId && <><label className="field">Número de adultos
        <select disabled={busy} value={adults} onChange={event => setAdults(Number(event.target.value))}>
          {Array.from({ length: 10 }, (_, index) => index + 1).map(n => <option key={n}>{n}</option>)}
        </select>
      </label>
      <dl className="totals">
        <div><dt>Energia</dt><dd>{number.format(kcal)} kcal</dd></div>
        <div><dt>Equivalência</dt><dd>≈ {number.format(Math.round(kwh))} kWh</dd></div>
        <div><dt>Preço de teste</dt><dd>{sol.format(milliSol / 1000)} SOL</dd></div>
      </dl>
      {network === "Solana" && <section className="method">
        <h3>Solana Devnet</h3>
        {config?.producer && <p>Carteira do produtor<code>{config.producer}</code></p>}
        {config && !config.producer && <p>O administrador precisa configurar a carteira do produtor antes do primeiro pagamento.</p>}
        <button className="primary" disabled={busy || !order || !config?.producer} onClick={() => void run(pay)}>Pagar com SOL de teste</button>
      </section>}</>}
      <section className="method">
        <h3>Pix</h3>
        <p>Envie o comprovante para revisão manual. Para testar o protótipo, use um arquivo fictício.</p>
        {config?.pix && <p>Chave Pix do produtor<code>{config.pix}</code></p>}
        {pixId ? <>
          <p role="status"><strong>{reviewLabels[pixStatus]}</strong></p>
          {pixStatus === "approved" && <p>{pixFreight
            ? "Seu pedido entrou no frete para " + (pixFreight.destination === "rio" ? "Rio de Janeiro." : "São Paulo.")
            : "Aguardando a inclusão em um frete para a sua cidade."}</p>}
          <label className="field">Guarde este código para consultar o pedido depois
            <input value={pixId} readOnly onFocus={event => event.currentTarget.select()} />
          </label>
          <button disabled={busy} onClick={() => void run(() => refreshPix())}>Atualizar status</button>
        </> : <>
          <p>O pedido inclui 1 cesta. Os pedidos Pix aprovados são agrupados por destino.</p>
          <label className="field">Cidade de destino
            <select value={destination} onChange={event => setDestination(event.target.value)} disabled={busy}>
              <option value="">Selecione a cidade</option>
              <option value="rio">Rio de Janeiro, RJ</option>
              <option value="sao-paulo">São Paulo, SP</option>
            </select>
          </label>
          <label className="field">Comprovante (PDF, PNG ou JPEG, até 5 MB)
            <input type="file" accept="application/pdf,image/png,image/jpeg" disabled={busy}
              onChange={event => {
                const selected = event.target.files?.[0]
                setMessage("")
                setFile(null)
                setPreview("")
                if (selected && (!["application/pdf", "image/png", "image/jpeg"].includes(selected.type) || selected.size > 5_000_000 || !selected.size)) {
                  setMessage("Arquivo inválido. Use PDF, PNG ou JPEG de até 5 MB.")
                  event.target.value = ""
                } else if (selected) setFile(selected)
              }} />
          </label>
          {file && preview && <p><a href={preview} target="_blank" rel="noreferrer">Conferir {file.name}</a></p>}
          <button disabled={!file || busy || !order || !destination} onClick={() => void run(upload)}>Enviar para revisão</button>
        </>}
      </section>
      {message && <p role="alert" className="error">{message} {message.startsWith("Saldo") && <a href="https://faucet.solana.com/" target="_blank" rel="noreferrer">Abrir faucet</a>}</p>}
    </section>
  )

  return (
    <section className="panel">
      <h2>{step === 4 ? "Pagamento em SOL" : "Recebimento da cesta"}</h2>
      <p><code>{order}</code></p>
      <p>{paymentStatus === "confirmed" ? "Pagamento confirmado." : paymentStatus === "failed" ? "A rede registrou uma falha no pagamento." : "Verificação do pagamento pendente."}</p>
      <p><a href={solscan(payment)} target="_blank" rel="noreferrer">Abrir pagamento no Solscan devnet</a></p>
      {step === 4 && <>
        <p>Guarde a assinatura do pagamento para retomar o pedido mais tarde.</p>
        <code>{payment}</code>
        {paymentStatus === "confirmed" ? <button onClick={() => setStep(5)}>Ir para recebimento</button>
          : paymentStatus === "failed" ? <button onClick={() => { setPayment(""); setStep(3) }}>Voltar ao checkout</button>
            : <button disabled={busy} onClick={() => void run(() => check(payment, setPaymentStatus))}>Consultar pagamento</button>}
      </>}
      {step === 5 && (!receipt || receiptStatus === "failed") && <button className="primary" disabled={busy} onClick={() => void run(sendReceipt)}>Confirmar recebimento</button>}
      {receipt && <>
        <p>{receiptStatus === "confirmed" ? "Recebimento confirmado." : receiptStatus === "failed" ? "A rede registrou uma falha no recebimento." : "Verificação do recebimento pendente."}</p>
        <p><a href={solscan(receipt)} target="_blank" rel="noreferrer">Abrir recebimento no Solscan devnet</a></p>
        {receiptStatus === "pending" && <button disabled={busy} onClick={() => void run(() => check(receipt, setReceiptStatus))}>Consultar recebimento</button>}
      </>}
      {message && <p role="alert" className="error">{message} {message.startsWith("Saldo") && <a href="https://faucet.solana.com/" target="_blank" rel="noreferrer">Abrir faucet</a>}</p>}
    </section>
  )
}

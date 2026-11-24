"use client"

import { getWallets } from "@wallet-standard/app"
import type { StandardConnectFeature } from "@wallet-standard/features"
import { useEffect, useState } from "react"
import Checkout from "./checkout"
import { solanaTestChain } from "../config/exergia"

type Network = "Solana" | "Ethereum"
type Provider = {
  request(input: { method: string }): Promise<unknown>
}
type Announcement = { info: { uuid: string; name: string }; provider: Provider }
type WalletOption = { id: string; name: string; connect(): Promise<string | undefined> }

export default function Home() {
  const [network, setNetwork] = useState<Network>("Solana")
  const [solana, setSolana] = useState<WalletOption[]>([])
  const [ethereum, setEthereum] = useState<WalletOption[]>([])
  const [address, setAddress] = useState("")
  const [status, setStatus] = useState("")
  const [busy, setBusy] = useState(false)
  const [walletName, setWalletName] = useState("")
  const [shopping, setShopping] = useState(false)

  useEffect(() => {
    const registry = getWallets()
    function discoverSolana() {
      setSolana(registry.get().flatMap((wallet, index) => {
        if (!wallet.chains.some(chain => chain.startsWith("solana:"))) return []
        const connect = wallet.features["standard:connect"] as StandardConnectFeature["standard:connect"] | undefined
        if (!connect) return []
        return [{
          id: String(index),
          name: wallet.name,
          async connect() {
            const result = await connect.connect()
            return result.accounts.find(account => account.chains.includes(solanaTestChain))?.address
              ?? result.accounts.find(account => account.chains.some(chain => chain.startsWith("solana:")))?.address
          },
        }]
      }))
    }
    function announce(event: Event) {
      const detail = (event as CustomEvent<Announcement>).detail
      if (!detail?.info?.uuid || !detail.info.name || typeof detail.provider?.request !== "function") return
      const option: WalletOption = {
        id: detail.info.uuid,
        name: detail.info.name,
        async connect() {
          const accounts = await detail.provider.request({ method: "eth_requestAccounts" })
          return Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : undefined
        },
      }
      setEthereum(options => options.some(wallet => wallet.id === option.id) ? options : [...options, option])
    }
    const offRegister = registry.on("register", discoverSolana)
    const offUnregister = registry.on("unregister", discoverSolana)
    discoverSolana()
    window.addEventListener("eip6963:announceProvider", announce)
    window.dispatchEvent(new Event("eip6963:requestProvider"))

    const injected = (window as Window & { ethereum?: Provider }).ethereum
    if (typeof injected?.request === "function") {
      setEthereum(options => options.length ? options : [{
        id: "injected",
        name: "Carteira do navegador",
        async connect() {
          const accounts = await injected.request({ method: "eth_requestAccounts" })
          return Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : undefined
        },
      }])
    }

    return () => {
      offRegister()
      offUnregister()
      window.removeEventListener("eip6963:announceProvider", announce)
    }
  }, [])

  function selectNetwork(value: Network) {
    setNetwork(value)
    setAddress("")
    setWalletName("")
    setStatus("")
  }

  async function connectWallet(wallet: WalletOption) {
    setBusy(true)
    setAddress("")
    setStatus("")
    try {
      const account = await wallet.connect()
      if (!account) {
        setStatus("A carteira não disponibilizou uma conta para esta rede.")
        return
      }
      setAddress(account)
      setWalletName(wallet.name)
    } catch (error) {
      const code = (error as { code?: number } | null)?.code
      setStatus(code === 4001 ? "Conexão recusada na carteira." : "Não foi possível conectar. Abra a carteira e tente novamente.")
    } finally {
      setBusy(false)
    }
  }

  const wallets = network === "Solana" ? solana : ethereum.filter(wallet => ethereum.length === 1 || wallet.id !== "injected")

  return (
    <div className="exergia-home" id="inicio">
      <header className="exergia-header">
        <a className="exergia-wordmark" href="#inicio"><span aria-hidden="true">☀</span> Exergia <i>SOL</i></a>
        <nav aria-label="Navegação principal">
          <a href="#inicio">Início</a>
          <a href="/selo#lotes">Lotes</a>
          <a href="/selo#roadmap">Roadmap</a>
          <a href="#cestas">Cestas</a>
          <a href="#carteira">Devnet</a>
        </nav>
        <span className="exergia-test">Modo demonstração</span>
      </header>
      <main className="exergia-main">
        <section className="exergia-hero" aria-labelledby="exergia-title">
          <div className="exergia-intro">
            <p className="exergia-region">Costa do Cacau · Bahia</p>
            <h1 id="exergia-title">A origem tem <em>testemunhas.</em></h1>
            <p>Registre seu lote e peça a outros produtores que confirmem a origem. Duas confirmações completam o selo entre pares.</p>
            <div className="exergia-actions">
              <a className="exergia-button exergia-gold" href="/selo#registrar">Registrar lote</a>
              <a className="exergia-button exergia-outline" href="/selo#selo/CACAU-001">Ver um selo</a>
              <a className="exergia-button exergia-outline" href="#como-comprar">Como comprar</a>
            </div>
          </div>
          <div className="exergia-art" aria-hidden="true">
            <div className="exergia-stamp"><span>EXERGIA SOL</span><b>☀</b>Selo entre pares<span>COSTA DO CACAU</span></div>
          </div>
        </section>
        <section className="exergia-section" aria-labelledby="exergia-steps-title">
          <h2 id="exergia-steps-title">Como funciona</h2>
          <div className="exergia-steps">
            {[
              ["Registre o lote", "Informe o produto, o apelido do produtor, a região e a data."],
              ["Convide outros produtores", "Compartilhe o link com quem visitou o lote."],
              ["Consulte o selo", "Veja quem confirmou e em que data."],
            ].map(([title, description], index) => (
              <article key={title}>
                <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <h3>{title}</h3><p>{description}</p>
              </article>
            ))}
          </div>
        </section>
        <section id="como-comprar" className="exergia-section" aria-labelledby="exergia-buy-title">
          <h2 id="exergia-buy-title">Como comprar</h2>
          <div className="exergia-steps">
            <article>
              <h3>Escolha sua cesta</h3>
              <p>Informe para quantos adultos é a compra. Para pedidos por Pix, selecione Rio de Janeiro ou São Paulo no checkout.</p>
            </article>
            <article>
              <h3>Envie o comprovante Pix</h3>
              <p>Anexe o comprovante no checkout e acompanhe a aprovação. Se quiser experimentar o fluxo SOL, use a rede de testes Devnet.</p>
            </article>
            <article>
              <h3>Aguarde o fechamento do frete</h3>
              <p>Quando os pedidos Pix aprovados atingirem o mínimo da cidade, a equipe pode reuni-los em um frete da Costa do Cacau.</p>
            </article>
          </div>
          <p className="exergia-buy-action"><a className="exergia-button exergia-gold" href="#cestas">Ver cesta</a></p>
        </section>
        <section id="cestas" className="exergia-section exergia-commerce" aria-labelledby="exergia-cestas-title">
          <h2 id="exergia-cestas-title">Cestas de produtores locais</h2>
          <p>Escolha sua cesta e pague com SOL de teste ou envie seu comprovante Pix no checkout.</p>
          <section id="carteira" className="panel" aria-labelledby="wallet-title">
            <h3 id="wallet-title">Conectar carteira</h3>
            <p className="hint">Rede de testes · Solana Devnet</p>
            <div className="networks" role="group" aria-label="Rede da carteira">
              {(["Solana", "Ethereum"] as const).map(value => (
                <button key={value} type="button" aria-pressed={network === value} disabled={busy}
                  onClick={() => selectNetwork(value)}>{value}</button>
              ))}
            </div>
            {wallets.length ? (
              <ul>{wallets.map(wallet => <li key={wallet.id}>
                <button type="button" disabled={busy} onClick={() => void connectWallet(wallet)}>{wallet.name}</button>
              </li>)}</ul>
            ) : <p className="hint">Nenhuma carteira de {network} detectada. Abra esta página no navegador da sua carteira ou habilite uma extensão compatível.</p>}
            <div aria-live="polite">
              {busy && <p>Confirme a conexão na carteira.</p>}
              {status && <p className="error">{status}</p>}
              {address && <div className="connected"><strong>{walletName} conectada</strong><code>{address}</code></div>}
            </div>
          </section>
          {shopping ? <Checkout address={address} walletName={walletName} network={network} /> : (
            <button className="primary" onClick={() => setShopping(true)}>Ver cesta</button>
          )}
        </section>
      </main>
      <footer className="exergia-footer">
        <span>Exergia SOL · Costa do Cacau</span>
        <div className="account-links">
          <a href="/conta">Cadastro e minha conta</a>
          <a href="/admin">Acesso administrativo</a>
          <a href="https://github.com/solanabr/ai-kit">Solana AI Kit no GitHub</a>
        </div>
      </footer>
    </div>
  )
}

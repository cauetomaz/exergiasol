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
    <>
      <header className="top">
        <span className="brand">Exergia<span> SOL</span></span>
        <span className="test">Rede de testes · Solana Devnet</span>
      </header>
      <main>
        <section className="intro">
          <h1>Cestas de produtores locais</h1>
          <p>Escolha sua cesta e pague com SOL de teste ou envie seu comprovante Pix no checkout.</p>
        </section>
        <section className="panel" aria-labelledby="wallet-title">
          <h2 id="wallet-title">Conectar carteira</h2>
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
          <button className="primary start" onClick={() => setShopping(true)}>Ver cesta</button>
        )}
        <footer><a href="/admin">Acesso administrativo</a></footer>
      </main>
    </>
  )
}

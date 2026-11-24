"use client"

import dynamic from "next/dynamic"
import { getWallets } from "@wallet-standard/app"
import type { StandardConnectFeature } from "@wallet-standard/features"
import { useEffect, useRef, useState } from "react"

const Basket = dynamic(() => import("./ofertas/basket"))

type Network = "ethereum" | "solana"
type PublicKey = { toBase58(): string }
type Provider = {
  request(input: { method: string }): Promise<unknown>
  on?(event: string, handler: (accounts: unknown) => void): void
  removeListener?(event: string, handler: (accounts: unknown) => void): void
}
type Phantom = {
  isPhantom?: boolean
  connect(): Promise<{ publicKey: PublicKey }>
  disconnect(): Promise<void>
  on?(event: string, handler: (key: PublicKey | null) => void): void
  removeListener?(event: string, handler: (key: PublicKey | null) => void): void
}
type Human = Provider & { login(): Promise<string | null>; logout(): Promise<void> }
type WalletWindow = Window & { ethereum?: Provider; solana?: Phantom; phantom?: { solana?: Phantom }; waap?: Human }
type Option = {
  id: string
  name: string
  connect(): Promise<string | undefined>
  disconnect?(): Promise<void>
  subscribe?(update: (address?: string) => void): () => void
}
type Connected = { option: Option; network: Network; address: string }

function evmAddress(accounts: unknown) {
  const address = Array.isArray(accounts) ? accounts[0] : undefined
  return typeof address === "string" && /^0x[a-fA-F0-9]{40}$/.test(address) ? address : undefined
}

function evmOption(id: string, name: string, provider: Provider): Option {
  return {
    id, name,
    async connect() { return evmAddress(await provider.request({ method: "eth_requestAccounts" })) },
    subscribe(update) {
      const handle = (accounts: unknown) => update(evmAddress(accounts))
      provider.on?.("accountsChanged", handle)
      return () => provider.removeListener?.("accountsChanged", handle)
    },
  }
}

function detectMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
}

export default function Home() {
  const dialog = useRef<HTMLDialogElement>(null)
  const entry = useRef<HTMLButtonElement>(null)
  const [network, setNetwork] = useState<Network | null>(null)
  const [solana, setSolana] = useState<Option[]>([])
  const [ethereum, setEthereum] = useState<Option[]>([])
  const [fallback, setFallback] = useState<Option>()
  const [human, setHuman] = useState<Option>()
  const [humanLoading, setHumanLoading] = useState(false)
  const [humanError, setHumanError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [external, setExternal] = useState(false)
  const [inside, setInside] = useState(false)
  const [metamaskLink, setMetamaskLink] = useState("")
  const [mobileLink, setMobileLink] = useState("")
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [connected, setConnected] = useState<Connected>()
  const selected = connected?.option

  useEffect(() => {
    const browser = window as WalletWindow
    const registry = getWallets()
    function refreshSolana() {
      const options = registry.get().flatMap<Option>(wallet => {
        const connect = wallet.features["standard:connect"] as StandardConnectFeature["standard:connect"] | undefined
        if (!connect || !wallet.chains.some(chain => chain.startsWith("solana:"))) return []
        const disconnect = wallet.features["standard:disconnect"] as { disconnect(): Promise<void> } | undefined
        const events = wallet.features["standard:events"] as {
          on(event: "change", handler: (event: { accounts?: typeof wallet.accounts }) => void): () => void
        } | undefined
        return [{
          id: "standard:" + wallet.name, name: wallet.name,
          async connect() {
            const result = await connect.connect()
            return result.accounts.find(account => account.chains.some(chain => chain.startsWith("solana:")))?.address
              ?? result.accounts[0]?.address
          },
          disconnect: disconnect ? () => disconnect.disconnect() : undefined,
          subscribe: events ? update => events.on("change", ({ accounts }) => {
            if (accounts) update(accounts[0]?.address)
          }) : undefined,
        }]
      })
      const phantom = browser.phantom?.solana ?? browser.solana
      if (phantom?.isPhantom && !options.some(option => option.name.toLowerCase() === "phantom")) {
        options.unshift({
          id: "phantom", name: "Phantom",
          async connect() { return (await phantom.connect()).publicKey.toBase58() },
          disconnect: () => phantom.disconnect(),
          subscribe(update) {
            const handle = (key: PublicKey | null) => update(key?.toBase58())
            phantom.on?.("accountChanged", handle)
            return () => phantom.removeListener?.("accountChanged", handle)
          },
        })
      }
      setSolana(options)
      setMobileLink(detectMobile() && !options.length
        ? "https://phantom.app/ul/browse/" + encodeURIComponent(window.location.href) + "?ref=" + encodeURIComponent(window.location.origin)
        : "")
    }
    function refreshInjected() {
      refreshSolana()
      if (typeof browser.ethereum?.request === "function") {
        setFallback(evmOption("injected", "Carteira do navegador", browser.ethereum))
      }
      window.dispatchEvent(new Event("eip6963:requestProvider"))
    }
    function announce(event: Event) {
      const detail = (event as CustomEvent<{ info?: { uuid?: string; name?: string }; provider?: Provider }>).detail
      if (!detail?.info?.uuid || !detail.info.name || typeof detail.provider?.request !== "function") return
      const option = evmOption(detail.info.uuid, detail.info.name, detail.provider)
      setEthereum(previous => previous.some(item => item.id === option.id) ? previous : [...previous, option])
    }
    window.addEventListener("eip6963:announceProvider", announce)
    window.addEventListener("ethereum#initialized", refreshInjected)
    window.addEventListener("load", refreshInjected)
    window.addEventListener("focus", refreshInjected)
    const register = registry.on("register", refreshSolana)
    const unregister = registry.on("unregister", refreshSolana)
    refreshInjected()
    if (detectMobile()) setMetamaskLink("https://link.metamask.io/dapp/" + window.location.host)
    return () => {
      register()
      unregister()
      window.removeEventListener("eip6963:announceProvider", announce)
      window.removeEventListener("ethereum#initialized", refreshInjected)
      window.removeEventListener("load", refreshInjected)
      window.removeEventListener("focus", refreshInjected)
    }
  }, [])

  useEffect(() => {
    if (network !== "ethereum" || human) return
    let active = true
    import("@human.tech/waap-sdk").then(({ initWaaP }) => {
      if (!active) return
      const browser = window as WalletWindow
      if (!browser.waap) initWaaP({ config: { authenticationMethods: ["email", "phone", "social"], allowedSocials: ["google", "twitter", "discord"] } })
      const provider = browser.waap
      if (!provider) throw new Error("Human Wallet indisponível")
      const option = evmOption("human", "Human Wallet", provider)
      setHuman({
        ...option,
        async connect() {
          if (!(await provider.login())) return undefined
          return option.connect()
        },
        disconnect: () => provider.logout(),
      })
      setHumanLoading(false)
    }).catch(() => {
      if (active) { setHumanError(true); setHumanLoading(false) }
    })
    return () => { active = false }
  }, [network, human, retry])

  useEffect(() => selected?.subscribe?.(address => {
    setConnected(previous => {
      if (previous?.option !== selected) return previous
      return address ? { ...previous, address } : undefined
    })
  }), [selected])

  function choose(value: Network) {
    setMessage("")
    setExternal(false)
    setHumanError(false)
    setHumanLoading(value === "ethereum" && !human)
    setNetwork(value)
  }

  async function connect(option: Option) {
    if (!network) return
    const usesHuman = option.id === "human"
    if (usesHuman) dialog.current?.close()
    setBusy(true)
    setMessage("")
    try {
      const address = await option.connect()
      if (!address) setMessage("Conexão não concluída. Você pode tentar de novo.")
      else setConnected({ option, network, address })
    } catch (error) {
      const code = (error as { code?: number } | null)?.code
      setMessage(code === 4001 ? "Você recusou a conexão na carteira."
        : code === -32002 ? "Já há um pedido aberto. Confira a janela da carteira."
          : "A carteira não concluiu a conexão. Abra a extensão ou o aplicativo e tente novamente.")
    } finally {
      setBusy(false)
      if (usesHuman && !dialog.current?.open) dialog.current?.showModal()
    }
  }

  async function disconnect() {
    setBusy(true)
    setMessage("")
    try {
      await connected?.option.disconnect?.()
      setConnected(undefined)
      setNetwork(null)
    } catch {
      setMessage("Não foi possível desconectar. Tente novamente.")
    } finally {
      setBusy(false)
    }
  }

  function continueToApp() {
    setInside(true)
    dialog.current?.close()
  }

  const evmWallets = ethereum.length ? ethereum : fallback ? [fallback] : []
  return <>
    {inside ? <>
      <main className="wallet-app offers-app">
        <div className="journey-actions"><button ref={entry} onClick={() => dialog.current?.showModal()}>
          {connected ? "Minha carteira" : "Conectar carteira"}
        </button></div>
        <Basket />
        <nav className="wallet-app-nav" aria-label="Mais áreas do Exergia SOL">
          <a href="/cestas">Checkout de teste</a>
        </nav>
      </main>
    </> : <main className="wallet-home"><div className="wallet-cover">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/exergia-cacau.webp" alt="Fruto de cacau na agrofloresta da Costa do Cacau" />
      <div className="wallet-cover-content">
        <p className="journey-kicker">Costa do Cacau · Bahia</p>
        <h1>Da Costa do Cacau<br />para a sua <em>cesta</em></h1>
        <p>Escolha produtos de quem cultiva e transforma cacau e cupuaçu no sul da Bahia.</p>
        <div className="journey-actions">
          <a className="exergia-button exergia-gold" href="/ofertas">Montar minha cesta</a>
          <button ref={entry} className="wallet-cover-button" disabled={busy} onClick={() => dialog.current?.showModal()}>
            {connected ? "Ver carteira" : "Conectar carteira"}
          </button>
        </div>
      </div>
    </div>
    <div className="journey-grid wallet-home-paths">
      <article><h2><a href="/produtores">Quem produz</a></h2><p>Leia as histórias e consulte a origem dos lotes.</p></article>
      <article><h2><a href="/participar">Quero produzir</a></h2><p>Ative o perfil de produtor e registre seus lotes.</p></article>
      <article><h2><a href="/termos">Como funciona</a></h2><p>Entenda a compra coletiva, a entrega e o selo entre pares.</p></article>
    </div></main>}
    <dialog ref={dialog} className="wallet-dialog" aria-labelledby="wallet-entry-title" onClose={() => entry.current?.focus()}>
      <div className="wallet-dialog-head">
        <h2 id="wallet-entry-title">{connected ? "Carteira conectada" : network ? network === "solana" ? "Solana" : "Ethereum" : "Escolha a rede"}</h2>
        <button type="button" aria-label="Fechar" onClick={() => dialog.current?.close()}>×</button>
      </div>
      {connected ? <>
        <p>{connected.network === "solana" ? "Solana" : "Ethereum"} · {connected.option.name}</p>
        <code>{connected.address}</code>
        <p>Confira este endereço antes de continuar. Se for outra conta, desconecte e escolha a carteira certa.</p>
        {!inside && <p><button className="primary" disabled={busy} onClick={continueToApp}>Continuar para o Exergia SOL</button></p>}
        <button disabled={busy} onClick={() => void disconnect()}>Desconectar e trocar carteira</button>
      </> : !network ? <div className="wallet-options">
        <button onClick={() => choose("ethereum")}>Ethereum</button>
        <button onClick={() => choose("solana")}>Solana</button>
        <button onClick={continueToApp}>Continuar sem carteira</button>
      </div> : <>
        <div className="wallet-options">
          {network === "ethereum" ? external ? <>
            <p>Selecione a extensão ou abra o site no navegador da sua carteira. Para usar outra conta da mesma extensão, selecione-a na própria carteira antes de conectar.</p>
            {evmWallets.length ? evmWallets.map(option => <button key={option.id} disabled={busy} onClick={() => void connect(option)}>{option.name}</button>)
              : <><p>Nenhuma carteira Ethereum foi detectada.</p>
                {metamaskLink ? <a href={metamaskLink}>Abrir na MetaMask</a> : <a href="https://metamask.io/download/" target="_blank" rel="noreferrer">Instalar MetaMask</a>}</>}
            <button disabled={busy} onClick={() => setExternal(false)}>Ver opções Ethereum</button>
          </> : <>
            <button className="primary" disabled={busy} onClick={() => setExternal(true)}>Conectar uma carteira existente</button>
            <p>A Human Wallet é uma carteira integrada. Entre com e-mail, telefone ou conta social. Se você já tem uma Human Wallet, use o mesmo método e identificador para acessar o endereço que conhece.</p>
            {human && <button disabled={busy} onClick={() => void connect(human)}>Entrar com Human Wallet</button>}
            {humanLoading && <p role="status">Carregando Human Wallet…</p>}
            {humanError && <button disabled={busy} onClick={() => {
              setHumanError(false); setHumanLoading(true); setRetry(count => count + 1)
            }}>Tentar carregar Human Wallet</button>}
          </> : solana.length ? solana.map(option => <button key={option.id} disabled={busy} onClick={() => void connect(option)}>{option.name}</button>)
            : <>
              <p>Nenhuma carteira Solana detectada neste navegador.</p>
              {mobileLink ? <a href={mobileLink}>Abrir no navegador da Phantom</a>
                : <a href="https://phantom.com/download" target="_blank" rel="noreferrer">Instalar Phantom</a>}
            </>}
        </div>
        <button type="button" disabled={busy} onClick={() => { setNetwork(null); setMessage("") }}>Voltar</button>
      </>}
      {busy && <p role="status">Confira a janela da sua carteira.</p>}
      {message && <p className="error" role="alert">{message}</p>}
    </dialog>
  </>
}

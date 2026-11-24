"use client"

import { useEffect, useState, type FormEvent } from "react"

type Profile = { role: "buyer" | "producer"; name: string; city?: string; producer?: { name: string; city: string } }

function validReturn(hash: string | null) {
  return hash && /^(?:confirmar\/[a-f0-9]{32}-[a-f0-9-]{36}|registrar|lotes)$/.test(hash) ? "/selo#" + hash : "/selo#registrar"
}

export default function Participate() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [returnTo, setReturnTo] = useState("/selo#registrar")
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setReturnTo(validReturn(new URLSearchParams(window.location.search).get("selo")))
    fetch("/api/profile", { cache: "no-store" }).then(async response => {
      if (response.status !== 401 && !response.ok) throw new Error()
      if (response.ok) setProfile((await response.json()).profile)
    }).catch(() => setError("Não foi possível consultar a conta. Recarregue a página e tente de novo."))
      .finally(() => setReady(true))
  }, [])

  async function activate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError("")
    const form = new FormData(event.currentTarget)
    try {
      const response = await fetch("/api/profile/producer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.get("name"), city: form.get("city"), accepted: form.get("accepted") === "on" }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setProfile(result.profile)
      setSaved(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível ativar o perfil.")
    } finally {
      setBusy(false)
    }
  }

  const active = profile?.role === "producer" || Boolean(profile?.producer)
  const accountReturn = "/participar?selo=" + encodeURIComponent(returnTo.split("#")[1])
  return <main className="journey-page">
    <p className="journey-kicker">Para produtores</p>
    <h1>Mostre de onde vem o seu produto</h1>
    <p className="journey-lead">Registre a origem do lote e convide colegas que visitaram sua produção. Duas confirmações completam o selo entre pares.</p>
    <div className="journey-grid">
      <article><h2>Ative seu perfil</h2><p>Use sua conta do Exergia SOL e informe o nome público e a região da produção.</p></article>
      <article><h2>Registre um lote</h2><p>Informe o produto, a data e a origem. O lote recebe um link para compartilhar.</p></article>
      <article><h2>Convide seus pares</h2><p>Outros produtores confirmam o lote pelo link. Você acompanha tudo em Meus lotes.</p></article>
    </div>
    <section className="panel join-panel">
      <h2>{active ? "Área do produtor" : "Ativar perfil de produtor"}</h2>
      {error && <p role="alert" className="error">{error}</p>}
      {saved && <p role="status">Perfil de produtor ativado.</p>}
      {!ready ? <p>Carregando sua conta…</p> : active ? <>
        <p>{profile?.producer?.name ?? profile?.name} · {profile?.producer?.city ?? profile?.city}</p>
        <p className="journey-actions"><a className="exergia-button exergia-gold" href={returnTo}>
          {returnTo.includes("#confirmar/") ? "Voltar ao convite" : returnTo.endsWith("#lotes") ? "Meus lotes" : "Registrar lote"}
        </a><a href="/selo#lotes">Acompanhar lotes</a></p>
      </> : profile ? <form onSubmit={activate}>
        <p>Você continua usando a mesma conta para comprar e acompanhar suas cestas.</p>
        <label className="field">Nome público do produtor<input name="name" required maxLength={80} /></label>
        <label className="field">Município e estado da produção<input name="city" required maxLength={100} placeholder="Ex.: Uruçuca, BA" /></label>
        <label className="join-agreement"><input type="checkbox" name="accepted" required /> Li os <a href="/termos#termos" target="_blank" rel="noreferrer">termos do piloto</a>.</label>
        <button className="primary" disabled={busy}>{busy ? "Ativando…" : "Ativar perfil"}</button>
      </form> : <p><a className="exergia-button exergia-gold" href={"/conta?voltar=" + encodeURIComponent(accountReturn)}>Entrar ou criar uma conta</a></p>}
    </section>
  </main>
}

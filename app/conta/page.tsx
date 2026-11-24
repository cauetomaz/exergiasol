"use client"

import { useEffect, useState, type FormEvent } from "react"

type Role = "buyer" | "producer"
type Profile = { role: Role; name: string; city?: string }
const roleLabel = { buyer: "Comprador", producer: "Produtor" }

export default function Conta() {
  const [ready, setReady] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [mode, setMode] = useState<"register" | "login">("register")
  const [provider, setProvider] = useState<"chatgpt" | "email" | null>(null)
  const [role, setRole] = useState<Role>("buyer")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch("/api/profile", { cache: "no-store" }).then(async response => {
      if (response.status === 401) return
      if (!response.ok) throw new Error("Não foi possível carregar o cadastro.")
      const result = await response.json()
      setProfile(result.profile)
      setProvider(result.provider)
      setAuthenticated(result.provider === "chatgpt")
    }).catch(reason => setError(reason.message)).finally(() => setReady(true))
  }, [])

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError("")
    try {
      const response = await fetch(authenticated ? "/api/profile" : "/api/customer/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authenticated ? { role, name: form.get("name"), city: form.get("city") } : {
          action: mode, email: form.get("email"), password: form.get("password"), role,
          name: form.get("name"), city: form.get("city"),
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setProfile(result.profile)
      setProvider(authenticated ? "chatgpt" : "email")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar o cadastro.")
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    setBusy(true)
    setError("")
    try {
      const response = await fetch("/api/customer/session", { method: "DELETE" })
      if (!response.ok) throw new Error("Não foi possível sair da conta.")
      window.location.reload()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível sair da conta.")
    } finally {
      setBusy(false)
    }
  }

  const entering = !authenticated && mode === "login"

  return <>
    <header className="top"><span className="brand">Exergia<span> SOL</span></span><span className="test">Minha conta</span></header>
    <main>
      <a href="/">Voltar para o início</a>
      <h1 className="admin-title">{profile ? "Minha conta" : entering ? "Entrar" : "Criar cadastro"}</h1>
      {error && <p role="alert" className="error">{error}</p>}
      {!ready ? <p>Carregando…</p> : profile ? <section className="panel">
        <h2>{profile.name}</h2>
        <p>{roleLabel[profile.role]}{profile.city && " · " + profile.city}</p>
        {profile.role === "producer"
          ? <p>Seu cadastro foi registrado. A configuração do produtor que recebe os pagamentos é feita pela administração.</p>
          : <a href="/">Ver cesta</a>}
        {provider === "email" && <p><button disabled={busy} onClick={() => void logout()}>Sair da conta</button></p>}
      </section> : <form className="panel" key={mode} onSubmit={register}>
        {!authenticated && <>
          <div className="networks" role="group" aria-label="Acesso por e-mail">
            <button type="button" aria-pressed={!entering} disabled={busy} onClick={() => { setMode("register"); setError("") }}>Cadastrar</button>
            <button type="button" aria-pressed={entering} disabled={busy} onClick={() => { setMode("login"); setError("") }}>Entrar</button>
          </div>
          <label className="field">E-mail<input type="email" name="email" autoComplete="username" maxLength={254} required disabled={busy} /></label>
          <label className="field">Senha<input type="password" name="password" autoComplete={entering ? "current-password" : "new-password"}
            minLength={12} maxLength={128} required disabled={busy} /></label>
          {!entering && <p className="hint">Use pelo menos 12 caracteres.</p>}
        </>}
        {!entering && <>
        <label className="field">Tipo de cadastro
          <select value={role} onChange={event => setRole(event.target.value as Role)} disabled={busy}>
            <option value="buyer">Comprador</option>
            <option value="producer">Produtor</option>
          </select>
        </label>
        <label className="field">Nome<input name="name" maxLength={100} required disabled={busy} /></label>
        {role === "producer" && <label className="field">Cidade<input name="city" maxLength={100} required disabled={busy} /></label>}
        </>}
        <button type="submit" className="primary" disabled={busy}>{busy ? "Aguarde…" : entering ? "Entrar com e-mail" : "Concluir cadastro"}</button>
        {!authenticated && <p><a href="/signin-with-chatgpt?return_to=%2Fconta" target="_top">Entrar com ChatGPT</a></p>}
      </form>}
    </main>
  </>
}

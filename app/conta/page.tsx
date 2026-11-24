"use client"

import { useEffect, useState, type FormEvent } from "react"

type Role = "buyer" | "producer"
type Profile = { role: Role; name: string; city?: string }
const roleLabel = { buyer: "Comprador", producer: "Produtor" }

export default function Conta() {
  const [ready, setReady] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [role, setRole] = useState<Role>("buyer")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch("/api/profile", { cache: "no-store" }).then(async response => {
      if (response.status === 401) return
      if (!response.ok) throw new Error("Não foi possível carregar o cadastro.")
      setProfile((await response.json()).profile)
      setAuthenticated(true)
    }).catch(reason => setError(reason.message)).finally(() => setReady(true))
  }, [])

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError("")
    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, name: form.get("name"), city: form.get("city") }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setProfile(result.profile)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar o cadastro.")
    } finally {
      setBusy(false)
    }
  }

  return <>
    <header className="top"><span className="brand">Exergia<span> SOL</span></span><span className="test">Minha conta</span></header>
    <main>
      <a href="/">Voltar para o início</a>
      <h1 className="admin-title">{profile ? "Minha conta" : "Criar cadastro"}</h1>
      {error && <p role="alert" className="error">{error}</p>}
      {!ready ? <p>Carregando…</p> : profile ? <section className="panel">
        <h2>{profile.name}</h2>
        <p>{roleLabel[profile.role]}{profile.city && " · " + profile.city}</p>
        {profile.role === "producer"
          ? <p>Seu cadastro foi registrado. A configuração do produtor que recebe os pagamentos é feita pela administração.</p>
          : <a href="/">Ver cesta</a>}
      </section> : authenticated ? <form className="panel" onSubmit={register}>
        <label className="field">Tipo de cadastro
          <select value={role} onChange={event => setRole(event.target.value as Role)} disabled={busy}>
            <option value="buyer">Comprador</option>
            <option value="producer">Produtor</option>
          </select>
        </label>
        <label className="field">Nome<input name="name" maxLength={100} required disabled={busy} /></label>
        {role === "producer" && <label className="field">Cidade<input name="city" maxLength={100} required disabled={busy} /></label>}
        <button type="submit" className="primary" disabled={busy}>{busy ? "Salvando…" : "Concluir cadastro"}</button>
      </form> : !error && <p><a href="/signin-with-chatgpt?return_to=%2Fconta" target="_top">Entrar com ChatGPT</a></p>}
    </main>
  </>
}

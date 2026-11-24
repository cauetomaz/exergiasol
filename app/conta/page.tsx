"use client"

import { useEffect, useState, type FormEvent } from "react"

type Role = "buyer" | "producer"
type Profile = { role: Role; name: string; city?: string; producer?: { name: string; city: string } }
const roleLabel = { buyer: "Comprador", producer: "Produtor" }

export default function Conta() {
  const [back, setBack] = useState("/ofertas")
  const [ready, setReady] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [mode, setMode] = useState<"register" | "login" | "forgot" | "verify" | "reset">("register")
  const [token, setToken] = useState("")
  const [notice, setNotice] = useState("")
  const [provider, setProvider] = useState<"chatgpt" | "email" | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("voltar")
    if (requested === "/ofertas#basket-title" || requested === "/participar" || requested?.startsWith("/participar?selo=")) setBack(requested)
    const fragment = new URLSearchParams(window.location.hash.slice(1))
    const purpose = fragment.has("verify") ? "verify" : fragment.has("reset") ? "reset" : null
    if (purpose) {
      setMode(purpose)
      setToken(fragment.get(purpose) || "")
      window.history.replaceState(null, "", window.location.pathname + window.location.search)
      setReady(true)
      return
    }
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
    const password = form.get("password")
    if (mode === "reset" && password !== form.get("repeat")) {
      setError("As senhas precisam ser iguais.")
      return
    }
    setBusy(true)
    setNotice("")
    setError("")
    try {
      const response = await fetch(authenticated ? "/api/profile" : "/api/customer/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authenticated ? { role: "buyer", name: form.get("name") } : {
          action: mode, email: form.get("email"), password, token, role: "buyer",
          name: form.get("name"),
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      if (result.verificationRequired) {
        setNotice("Confira sua caixa de entrada. Se o link vencer, use Entrar para pedir outra confirmação.")
        setMode("login")
        return
      }
      if (mode === "forgot") {
        setNotice("Se houver uma conta com esse e-mail, enviaremos um link para redefinir a senha.")
        return
      }
      if (mode === "verify" || mode === "reset") {
        setNotice(mode === "verify" ? "E-mail confirmado. Entre para acessar sua conta." : "Senha redefinida. Entre com a nova senha.")
        setMode("login")
        setToken("")
        return
      }
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
  const linkMode = mode === "verify" || mode === "reset"
  const recovering = mode === "forgot"
  const signingUp = !linkMode && !recovering && !entering
  const title = profile ? "Minha conta" : mode === "verify" ? "Confirmar e-mail"
    : mode === "reset" ? "Escolher nova senha" : recovering ? "Recuperar senha" : entering ? "Entrar" : "Criar cadastro"

  function changeMode(next: "register" | "login" | "forgot") {
    setMode(next)
    setError("")
    setNotice("")
  }

  const producerActive = profile?.role === "producer" || Boolean(profile?.producer)
  const returnLabel = back.startsWith("/participar") ? "Voltar para a área do produtor" : "Voltar para a cesta"

  return <>
    <main className="journey-page join-panel">
      <a href={back}>{returnLabel}</a>
      <h1 className="admin-title">{title}</h1>
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert" className="error">{error}</p>}
      {!ready ? <p>Carregando…</p> : profile ? <section className="panel">
        <h2>{profile.name}</h2>
        <p>{roleLabel[profile.role]}{profile.role === "buyer" && producerActive && " e produtor"}</p>
        <div className="journey-actions">
          <a className="exergia-button exergia-gold" href={back}>{returnLabel}</a>
          {profile.role === "buyer" && <a href="/ofertas#minhas-solicitacoes">Minhas solicitações</a>}
          {!back.startsWith("/participar") && <a href="/participar">{producerActive ? "Área do produtor" : "Quero me tornar produtor"}</a>}
        </div>
        {provider === "email" && <p><button disabled={busy} onClick={() => void logout()}>Sair da conta</button></p>}
        {provider === "chatgpt" && <p><a href="/signout-with-chatgpt?return_to=%2F" target="_top">Sair da conta</a></p>}
      </section> : <form className="panel" key={mode} onSubmit={register}>
        {!authenticated && !linkMode && <>
          {!recovering && <div className="networks" role="group" aria-label="Acesso por e-mail">
            <button type="button" aria-pressed={!entering} disabled={busy} onClick={() => changeMode("register")}>Cadastrar</button>
            <button type="button" aria-pressed={entering} disabled={busy} onClick={() => changeMode("login")}>Entrar</button>
          </div>}
          <label className="field">E-mail<input type="email" name="email" autoComplete="username" maxLength={254} required disabled={busy} /></label>
        </>}
        {!authenticated && !recovering && mode !== "verify" && <>
          <label className="field">{mode === "reset" ? "Nova senha" : "Senha"}
            <input type="password" name="password" autoComplete={entering ? "current-password" : "new-password"}
              minLength={12} maxLength={128} required disabled={busy} />
          </label>
          {!entering && <p className="hint">Use pelo menos 12 caracteres.</p>}
          {mode === "reset" && <label className="field">Repita a nova senha
            <input name="repeat" type="password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={busy} />
          </label>}
        </>}
        {signingUp && <>
          <label className="field">Nome<input name="name" maxLength={100} required disabled={busy} /></label>
          <p>Uma conta serve para comprar e ativar seu perfil de produtor. <a href="/termos#termos" target="_blank" rel="noreferrer">Leia os termos do piloto</a>.</p>
        </>}
        <button type="submit" className="primary" disabled={busy || (linkMode && !token)}>
          {busy ? "Aguarde…" : recovering ? "Enviar link de recuperação" : mode === "verify" ? "Confirmar e-mail"
            : mode === "reset" ? "Redefinir senha" : entering ? "Entrar com e-mail" : "Concluir cadastro"}
        </button>
        {entering && <p><button type="button" disabled={busy} onClick={() => changeMode("forgot")}>Esqueci a senha</button></p>}
        {(recovering || linkMode) && <p><button type="button" disabled={busy} onClick={() => changeMode("login")}>Voltar para entrar</button></p>}
        {!authenticated && !recovering && !linkMode && <p><a href={"/signin-with-chatgpt?return_to=" + encodeURIComponent("/conta?voltar=" + encodeURIComponent(back))} target="_top">Entrar com ChatGPT</a></p>}
      </form>}
    </main>
  </>
}

"use client"

import { usePathname } from "next/navigation"

const links = [
  { href: "/ofertas", title: "Comprar" },
  { href: "/produtores", title: "Quem produz" },
  { href: "/participar", title: "Quero produzir" },
  { href: "/conta", title: "Minha conta" },
]

export function SiteNavigation() {
  const path = usePathname()
  return <header className="site-header">
    <a className="site-wordmark" href="/" aria-label="Exergia SOL, início">Exergia <span>SOL</span></a>
    <nav aria-label="Navegação principal">
      {links.map(link => <a key={link.href} href={link.href}
        aria-current={path === link.href || path.startsWith(link.href + "/") ? "page" : undefined}>{link.title}</a>)}
    </nav>
  </header>
}

export function SiteFooter() {
  return <footer className="site-footer">
    <a className="site-wordmark" href="/">Exergia <span>SOL</span></a>
    <nav aria-label="Informações e acesso">
      <a href="/termos">Como funciona e termos</a>
      <a href="/selo">Selo entre pares</a>
      <a href="/admin">Administração</a>
    </nav>
  </footer>
}

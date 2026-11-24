import type { Metadata } from "next"
import type { ReactNode } from "react"
import { SiteFooter, SiteNavigation } from "./navigation"
import "./styles.css"

export const metadata: Metadata = {
  title: "Exergia SOL",
  description: "Cestas de produtores locais",
}

export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="pt-BR"><body><SiteNavigation />{children}<SiteFooter /></body></html>
}

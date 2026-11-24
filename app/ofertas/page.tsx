import Basket from "./basket"

export default function Ofertas() {
  return <>
    <header className="top"><a className="brand" href="/">Exergia<span> SOL</span></a><a href="/conta">Minha conta</a></header>
    <main className="wallet-app offers-app">
      <Basket />
      <nav className="wallet-app-nav" aria-label="Mais áreas do Exergia SOL">
        <a href="/selo">Selo entre pares</a><a href="/cestas">Checkout de teste</a>
      </nav>
    </main>
  </>
}

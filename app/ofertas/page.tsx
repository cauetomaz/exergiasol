import Basket from "./basket"

export default function Ofertas() {
  return <>
    <main className="wallet-app offers-app">
      <Basket />
      <nav className="wallet-app-nav" aria-label="Mais áreas do Exergia SOL">
        <a href="/selo">Selo entre pares</a><a href="/cestas">Checkout de teste</a>
      </nav>
    </main>
  </>
}

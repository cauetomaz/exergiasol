import producers from "../../config/produtores.json"

export default function Producers() {
  return <main className="wallet-app offers-app">
    <p><a href="/ofertas">Voltar para as ofertas</a></p>
    <h1>Quem produz</h1>
    <p>Conheça quem está por trás das ofertas da Costa do Cacau.</p>
    <div className="offers-grid">
      {producers.map(producer => <article className="offer-card" key={producer.id}>
        <p className="offer-brand">{producer.origin}</p>
        <h2><a href={"/produtores/" + producer.id}>{producer.name}</a></h2>
        <p>{producer.title}</p>
      </article>)}
    </div>
  </main>
}

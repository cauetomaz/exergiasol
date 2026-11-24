import { notFound } from "next/navigation"
import producers from "../../../config/produtores.json"
import offers from "../../../config/ofertas.json"
import LinkedSeals from "../linked-seals"

export function generateStaticParams() {
  return producers.map(producer => ({ id: producer.id }))
}

export default async function ProducerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const producer = producers.find(item => item.id === id)
  if (!producer) notFound()
  return <main className="wallet-app">
    <p><a href="/produtores">Todos os produtores</a> · <a href="/ofertas">Voltar para as ofertas</a></p>
    <header className="producer-title">
      <p>{producer.origin}</p>
      <h1>{producer.name}</h1>
      <h2>{producer.title}</h2>
    </header>
    {producer.story.map(text => <p key={text}>{text}</p>)}
    <section className="panel">
      <h2>Ofertas deste produtor</h2>
      <ul>{offers.filter(offer => offer.producerId === id).map(offer => <li key={offer.id}>
        <a href={"/ofertas#oferta-" + offer.id}>{offer.name}{offer.variant && " · " + offer.variant}</a>
      </li>)}</ul>
    </section>
    <LinkedSeals producerId={id} />
  </main>
}

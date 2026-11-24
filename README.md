# exergiasol
Projeto piloto do curso de blockchain na solana, participantes Deroila e Giuseppe
Estamos tentando agregar Sistemas Participativos de Garantia para facilitar o contato dos produtores com consumidores, técnicos e demais interessados, partindo um Organismo Participativo de Avaliação da Conformidade (Opac) legalmente constituído. <https://ciorganicos.com.br/organicos/certificacao-de-organicos/certificacao-participativa/>

## Experimentar o app

**[Abrir o Exergia SOL](https://exergia-sol-compra.greenpillbr.chatgpt.site/)**

Este link abre a versão publicada do piloto. As mudanças da branch de desenvolvimento podem ser testadas seguindo as instruções abaixo.

## Rodar localmente

Você precisa de Git, Node.js 24 LTS e npm. Os comandos abaixo baixam a branch de desenvolvimento e instalam as versões registradas no `package-lock.json`.

```sh
git clone --branch feat/desenvolvimento-codex https://github.com/cauetomaz/exergiasol.git
cd exergiasol
npm ci
npm run dev -- --hostname 127.0.0.1
```

Abra [http://127.0.0.1:3000](http://127.0.0.1:3000). Para usar outra porta, pare o servidor com `Ctrl+C` e execute `npm run dev -- --hostname 127.0.0.1 --port 3001`, depois abra [http://127.0.0.1:3001](http://127.0.0.1:3001).

### O que testar localmente

- Abra **Comprar** para ver as ofertas e montar uma cesta. Abra **Quem produz** para ler as histórias dos produtores.
- Confira **Quero produzir** e **Como funciona e termos** para revisar a navegação e os textos.
- O comando `npm run dev` sobe a interface Next.js. Login, envio de cestas, comprovação de Pix, registro de lotes e administração dependem das rotas `/api` do Worker e dos serviços de hospedagem. Esses fluxos precisam de um ambiente de teste configurado com o Worker e seu bucket R2. Adicionar um arquivo `.env` ao Next.js, por si só, não sobe o Worker.
- Nenhuma credencial é necessária para navegar na interface local. Mantenha credenciais e dados de produção fora do Git.

### Verificar o build

Pare o servidor local com `Ctrl+C` e execute:

```sh
npm run build
```

O comando gera o site estático em `out/` e empacota o Worker em `dist/server/index.js`. Ele termina após gerar os arquivos.

## Manter estas instruções atualizadas

Se um PR mudar os pré-requisitos, os comandos, as variáveis de ambiente, as dependências de infraestrutura ou os fluxos disponíveis localmente, atualize este README no mesmo PR. Antes de marcar o PR como pronto, repita os passos afetados em um clone limpo.

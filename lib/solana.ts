import { getWallets } from "@wallet-standard/app"
import type { WalletAccount } from "@wallet-standard/base"
import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js"
import bs58 from "bs58"
import { Buffer } from "buffer"
import { solanaTestChain } from "../config/exergia"

const memoProgram = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr")
const connection = new Connection("https://api.devnet.solana.com", "confirmed")

export function solscan(signature: string) {
  return "https://solscan.io/tx/" + signature + "?cluster=devnet"
}

export async function sendMemo(
  walletName: string,
  address: string,
  memo: string,
  payment?: { producer: string; lamports: number },
) {
  const wallet = getWallets().get().find(item => item.name === walletName && item.accounts.some(account => account.address === address))
  const account = wallet?.accounts.find(item => item.address === address)
  if (!account) throw new Error("Conecte a carteira Solana antes de continuar.")
  const feature = wallet?.features["solana:signAndSendTransaction"] as {
    signAndSendTransaction(input: { account: WalletAccount; chain: string; transaction: Uint8Array }): Promise<readonly { signature: Uint8Array }[]>
  } | undefined
  if (!account.chains.includes(solanaTestChain) || !feature) {
    throw new Error("Ative o modo de testes da carteira e selecione Solana Devnet.")
  }
  const payer = new PublicKey(address)
  const { blockhash } = await connection.getLatestBlockhash()
  const transaction = new Transaction({ feePayer: payer, recentBlockhash: blockhash })
  if (payment) transaction.add(SystemProgram.transfer({
    fromPubkey: payer, toPubkey: new PublicKey(payment.producer), lamports: payment.lamports,
  }))
  transaction.add(new TransactionInstruction({
    programId: memoProgram, keys: [], data: Buffer.from(memo, "utf8"),
  }))
  const fee = (await connection.getFeeForMessage(transaction.compileMessage())).value
  if (fee === null) throw new Error("Falha na rede de testes. Tente consultar novamente.")
  if (await connection.getBalance(payer) < Number(fee) + (payment?.lamports ?? 0)) {
    throw new Error("Saldo insuficiente. Adicione SOL de teste pelo faucet.")
  }
  const [response] = await feature.signAndSendTransaction({
    account, chain: solanaTestChain, transaction: await transaction.serialize({ requireAllSignatures: false }),
  })
  return bs58.encode(response.signature)
}

export async function transactionStatus(signature: string) {
  const { value: [record] } = await connection.getSignatureStatuses([signature], { searchTransactionHistory: true })
  if (!record) return "pending"
  if (record.err) return "failed"
  return ["confirmed", "finalized"].includes(record.confirmationStatus ?? "") ? "confirmed" : "pending"
}

export async function restorePayment(signature: string, payer: string, producer: string) {
  if (!/^[1-9A-HJ-NP-Za-km-z]{85,90}$/.test(signature)) throw new Error("Informe uma assinatura válida do Solscan devnet.")
  const parsed = await connection.getParsedTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 })
  if (!parsed || !parsed.meta || parsed.meta.err) throw new Error("Pagamento confirmado não encontrado na devnet.")
  const { accountKeys, instructions } = parsed.transaction.message
  const transfer = instructions.find(instruction => "parsed" in instruction && instruction.program === "system"
    && instruction.parsed?.type === "transfer" && instruction.parsed.info.source === payer
    && instruction.parsed.info.destination === producer && instruction.parsed.info.lamports > 0)
  const memo = instructions.find(instruction => "parsed" in instruction && instruction.programId.equals(memoProgram))
  const match = memo && "parsed" in memo && typeof memo.parsed === "string"
    ? /^EXERGIA \| pagamento \| (pedido-[0-9a-f-]{36}) \| (\d+) kcal$/.exec(memo.parsed) : null
  const kcal = Number(match?.[2])
  const amount = Math.round(kcal / 860.42) * 1_000_000
  if (!transfer || !("parsed" in transfer) || transfer.parsed.info.lamports !== amount
    || kcal < 63_000 || kcal > 630_000 || kcal % 63_000 !== 0
    || !match || !accountKeys.some(key => key.signer && key.pubkey.toBase58() === payer)) {
    throw new Error("O pagamento não corresponde a essa carteira e ao produtor configurado.")
  }
  return match[1]
}

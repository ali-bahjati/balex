import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { Balex } from '../target/types/balex';
import * as spl_token from '@solana/spl-token';
import * as aaob from "@bonfida/aaob";

const provider = anchor.Provider.env();
anchor.setProvider(provider);

const program = anchor.workspace.Balex as Program<Balex>;
const connection = provider.connection;

// Mints, assume base is USD and quote is BTC

let mintBase: spl_token.Token;
let mintQuote: spl_token.Token;

let stubPriceOracle = anchor.web3.Keypair.generate();
console.log("stubPrice", stubPriceOracle)
console.log("stubPrice", stubPriceOracle.publicKey.toString())

// Market accounts
const NODE_CAPACITY = 100;
const EVENT_CAPACITY = 100;

let orderbook: anchor.web3.Keypair;
let eventQueue: anchor.web3.Keypair;
let bids: anchor.web3.Keypair;
let asks: anchor.web3.Keypair;

let lexMarket = anchor.web3.Keypair.generate();
console.log("lexMarket", lexMarket)
console.log("lexMarket", lexMarket.publicKey.toString())

let admin = anchor.web3.Keypair.generate();
console.log("admin", admin)
console.log("admin", admin.publicKey.toString())

let marketSigner: anchor.web3.PublicKey;
let signerBump: number;

let lexBaseVault: anchor.web3.PublicKey;
let lexQuoteVault: anchor.web3.PublicKey;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


const setup = async () => {
    console.log(program.programId.toString());

    [marketSigner, signerBump] = await anchor.web3.PublicKey.findProgramAddress([lexMarket.publicKey.toBytes()], program.programId)
    console.log("market signer & bump", marketSigner.toString(), signerBump);

    console.log("Request airdrops");
    await connection.confirmTransaction(await connection.requestAirdrop(admin.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL));
    console.log(await connection.getBalance(admin.publicKey))
    await sleep(10000);
    await connection.confirmTransaction(await connection.requestAirdrop(provider.wallet.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL));
    console.log(await connection.getBalance(provider.wallet.publicKey))

    console.log("Create mints");
    mintBase = await spl_token.Token.createMint(connection, admin, admin.publicKey, admin.publicKey, 0, spl_token.TOKEN_PROGRAM_ID);
    mintQuote = await spl_token.Token.createMint(connection, admin, admin.publicKey, admin.publicKey, 0, spl_token.TOKEN_PROGRAM_ID);
    console.log("Mint Base", mintBase.publicKey.toString());
    console.log("Mint Quote", mintQuote.publicKey.toString());


    lexBaseVault = await mintBase.createAccount(marketSigner); // TODO: Investigate why associated token account didn't work
    lexQuoteVault = await mintQuote.createAccount(marketSigner); 
    console.log("LexBaseVault", lexBaseVault)
    console.log("LexQuoteVault", lexQuoteVault)


    let aaobInstructions: anchor.web3.TransactionInstruction[];
    [[eventQueue, bids, asks, orderbook], aaobInstructions] = await aaob.createMarket(
      connection,
      marketSigner,
      new anchor.BN(32),
      new anchor.BN(32),
      EVENT_CAPACITY,
      NODE_CAPACITY,
      new anchor.BN(1),
      admin.publicKey,
      new anchor.BN(1),
      new anchor.BN(0),
      program.programId
    );
    // Remove the AOB create_market instruction as it is not needed with lib usage
    aaobInstructions.pop();

    await connection.confirmTransaction(
      await connection.sendTransaction(
        new anchor.web3.Transaction().add(...aaobInstructions),
        [admin, eventQueue, bids, asks, orderbook]
      ),
      'confirmed'
    );

    console.log(eventQueue.publicKey.toString())
    console.log(orderbook.publicKey.toString())
    console.log(asks.publicKey.toString())
    console.log(bids.publicKey.toString())

    // const logger = (acc) => {
    //     console.log(acc);
    // }

    // program.account.stubPrice.subscribe(stubPriceOracle.publicKey, "confirmed").addListener("change", logger);

    console.log("Create Stub Price account");
    await program.rpc.setStubPrice(new anchor.BN(100), new anchor.BN(10), {
      accounts: {
        admin: admin.publicKey,
        stubPrice: stubPriceOracle.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      }, signers: [admin, stubPriceOracle]
    })

    // await new Promise(resolve => setTimeout(resolve, 1000));
    // program.account.stubPrice.unsubscribe(stubPriceOracle.publicKey)

    console.log("Create lex market")

    const oracleType = { stub: {} }
    const oraclePubkey = stubPriceOracle.publicKey;

    const tx = await program.rpc.initializeMarket(signerBump, mintBase.publicKey, mintQuote.publicKey, oracleType, {
      accounts: {
        admin: admin.publicKey,
        market: lexMarket.publicKey,
        baseVault: lexBaseVault,
        quoteVault: lexQuoteVault,
        eventQueue: eventQueue.publicKey,
        orderbook: orderbook.publicKey,
        priceOracle: oraclePubkey,
        asks: asks.publicKey,
        bids: bids.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      },
      signers: [admin, lexMarket],
      preInstructions: [await program.account.lexMarket.createInstruction(lexMarket)]
    });

}

setup();
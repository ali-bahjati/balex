import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { Balex } from '../target/types/balex';
import * as spl_token from '@solana/spl-token';
import * as aaob from "@bonfida/aaob";
import * as assert from 'assert';

describe('balex', () => {

  const provider = anchor.Provider.env();
  anchor.setProvider(provider);

  const systemProgram = anchor.web3.SystemProgram;

  const program = anchor.workspace.Balex as Program<Balex>;
  const connection = provider.connection;

  // Mints, assume base is USD and qoute is BTC

  let mintBase: spl_token.Token;
  let mintQoute: spl_token.Token;

  // Market accounts
  const NODE_CAPACITY = 100;
  const EVENT_CAPACITY = 100;

  let lexMarket = anchor.web3.Keypair.generate();
  let admin = anchor.web3.Keypair.generate();

  let marketSigner: anchor.web3.PublicKey;
  let signerBump: number;

  let lexBaseVault: anchor.web3.PublicKey;
  let lexQouteVault: anchor.web3.PublicKey;

  // Alice and Bob are used for simulating what happens in the program

  let alice = anchor.web3.Keypair.generate();
  let bob = anchor.web3.Keypair.generate();

  let aliceAccountBase: anchor.web3.PublicKey;
  let aliceAccountQoute: anchor.web3.PublicKey;
  let bobAccountBase: anchor.web3.PublicKey;
  let bobAccountQoute: anchor.web3.PublicKey;
  

  it('Is setup!', async () => {
    [marketSigner, signerBump] = await anchor.web3.PublicKey.findProgramAddress([lexMarket.publicKey.toBuffer()], program.programId)

    console.log("Request airdrops");
    await connection.confirmTransaction(await connection.requestAirdrop(admin.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL));
    await connection.confirmTransaction(await connection.requestAirdrop(alice.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL));
    await connection.confirmTransaction(await connection.requestAirdrop(bob.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL));

    console.log("Create mints");
    mintBase = await spl_token.Token.createMint(connection, admin, admin.publicKey, admin.publicKey, 0, spl_token.TOKEN_PROGRAM_ID);
    mintQoute = await spl_token.Token.createMint(connection, admin, admin.publicKey, admin.publicKey, 0, spl_token.TOKEN_PROGRAM_ID);

    console.log("Create token accounts");
    aliceAccountBase = await mintBase.createAssociatedTokenAccount(alice.publicKey);
    await mintBase.mintTo(aliceAccountBase, admin, [], 100);
    aliceAccountQoute = await mintQoute.createAssociatedTokenAccount(alice.publicKey);
    await mintQoute.mintTo(aliceAccountQoute, admin, [], 100);

    bobAccountBase = await mintBase.createAssociatedTokenAccount(bob.publicKey);
    await mintBase.mintTo(bobAccountBase, admin, [], 100);
    bobAccountQoute = await mintQoute.createAssociatedTokenAccount(bob.publicKey);
    await mintQoute.mintTo(bobAccountQoute, admin, [], 100);

    lexBaseVault = await mintBase.createAccount(marketSigner);
    lexQouteVault = await mintQoute.createAccount(marketSigner);

    assert.equal((await mintBase.getAccountInfo(aliceAccountBase)).amount, 100);
    assert.equal((await mintQoute.getAccountInfo(aliceAccountQoute)).amount, 100);
    assert.equal((await mintBase.getAccountInfo(bobAccountBase)).amount, 100);
    assert.equal((await mintQoute.getAccountInfo(bobAccountQoute)).amount, 100);
  });

  it('Market is initialized!', async () => {
    // AAOB instructions to create required accounts
    const [[eventQueue, bids, asks, orderbook], aaobInstructions] = await aaob.createMarket(
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

    console.log("Initialize Lex market")
    
    const tx = await program.rpc.initializeMarket(signerBump, mintBase.publicKey, mintQoute.publicKey, {
      accounts: {
        admin: admin.publicKey,
        market: lexMarket.publicKey,
        baseVault: lexBaseVault,
        qouteVault: lexQouteVault,
        eventQueue: eventQueue.publicKey,
        orderbook: orderbook.publicKey,
        asks: asks.publicKey,
        bids: bids.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      },
      signers: [admin, lexMarket]
    });
    console.log("Your transaction signature", tx);
  });
});

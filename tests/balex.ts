import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { Balex } from '../target/types/balex';
import * as spl_token from '@solana/spl-token';
import * as aaob from "@bonfida/aaob";
import * as assert from 'assert';

describe('balex', () => {

  const provider = anchor.Provider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Balex as Program<Balex>;
  const connection = provider.connection;

  // Mints, assume base is USD and qoute is BTC

  let mintBase: spl_token.Token;
  let mintQoute: spl_token.Token;

  let stubPriceOracle = anchor.web3.Keypair.generate();

  // Market accounts
  const NODE_CAPACITY = 100;
  const EVENT_CAPACITY = 100;

  let orderbook: anchor.web3.Keypair;
  let eventQueue: anchor.web3.Keypair;
  let bids: anchor.web3.Keypair;
  let asks: anchor.web3.Keypair;

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

  let aliceUserAccount: anchor.web3.PublicKey;
  let aliceBump: number;
  let bobUserAccount: anchor.web3.PublicKey;
  let bobBump: number;
  

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
    await mintBase.mintTo(aliceAccountBase, admin, [], 10000);
    aliceAccountQoute = await mintQoute.createAssociatedTokenAccount(alice.publicKey);
    await mintQoute.mintTo(aliceAccountQoute, admin, [], 10000);

    bobAccountBase = await mintBase.createAssociatedTokenAccount(bob.publicKey);
    await mintBase.mintTo(bobAccountBase, admin, [], 10000);
    bobAccountQoute = await mintQoute.createAssociatedTokenAccount(bob.publicKey);
    await mintQoute.mintTo(bobAccountQoute, admin, [], 10000);

    lexBaseVault = await mintBase.createAccount(marketSigner); // TODO: Investigate why associated token account didn't work
    lexQouteVault = await mintQoute.createAccount(marketSigner); 

    assert.equal((await mintBase.getAccountInfo(aliceAccountBase)).amount, 10000);
    assert.equal((await mintQoute.getAccountInfo(aliceAccountQoute)).amount, 10000);
    assert.equal((await mintBase.getAccountInfo(bobAccountBase)).amount, 10000);
    assert.equal((await mintQoute.getAccountInfo(bobAccountQoute)).amount, 10000);
  });

  it('Market is initialized!', async () => {
    // AAOB instructions to create required accounts
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

    console.log("Create Stub Price account");
    await program.rpc.setStubPrice(new anchor.BN(100), new anchor.BN(10), {
      accounts: {
        admin: admin.publicKey,
        stubPrice: stubPriceOracle.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      }, signers: [admin, stubPriceOracle]
    })

    console.log("Initialize Lex market");

    const oracleType = { stub: {} }
    const oraclePubkey = stubPriceOracle.publicKey;

    
    // In order to test with Pyth run validator yourself and copy account data then test without validator initialization:
    // $ solana-test-validator --reset -c GVXRSBjFk6e6J3NbVPXohDJetcTjaeeuykUpbQF8UoMU --url=m
    // $ anchor test --skip-local-validator
    // const oracleType = { pyth: {} }
    // const oraclePubkey = new anchor.web3.PublicKey("GVXRSBjFk6e6J3NbVPXohDJetcTjaeeuykUpbQF8UoMU")

    console.log(program.account.lexMarket.size)
    const tx = await program.rpc.initializeMarket(signerBump, mintBase.publicKey, mintQoute.publicKey, oracleType, {
      accounts: {
        admin: admin.publicKey,
        market: lexMarket.publicKey,
        baseVault: lexBaseVault,
        qouteVault: lexQouteVault,
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

    // let lexMarketAccount = await program.account.lexMarket.fetch(lexMarket.publicKey);
    // console.log(lexMarketAccount);
  });

  it('Initialize user accounts', async () => {
    [aliceUserAccount, aliceBump] = await anchor.web3.PublicKey.findProgramAddress([alice.publicKey.toBuffer()], program.programId);
    [bobUserAccount, bobBump] = await anchor.web3.PublicKey.findProgramAddress([bob.publicKey.toBuffer()], program.programId);

    await program.rpc.initializeAccount(aliceBump, lexMarket.publicKey, {
      accounts: {
        userAccount: aliceUserAccount,
        owner: alice.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      },
      signers: [alice]
    });

    await program.rpc.initializeAccount(bobBump, lexMarket.publicKey, {
      accounts: {
        userAccount: bobUserAccount,
        owner: bob.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      },
      signers: [bob]
    });
  });

  it('Invalid deposit', async() => {
    assert.rejects(
      program.rpc.deposit(bobBump, new anchor.BN(10), {
          accounts: {
            owner: bob.publicKey,
            userAccount: bobUserAccount,
            market: lexMarket.publicKey,
            vault: aliceAccountBase,
            tokenSource: bobAccountQoute,
            tokenProgram: spl_token.TOKEN_PROGRAM_ID
          },
          signers: [bob]
        }
      )
    );

    assert.rejects(
      program.rpc.deposit(bobBump, new anchor.BN(1000000), {
          accounts: {
            owner: bob.publicKey,
            userAccount: bobUserAccount,
            market: lexMarket.publicKey,
            vault: lexQouteVault,
            tokenSource: bobAccountQoute,
            tokenProgram: spl_token.TOKEN_PROGRAM_ID
          },
          signers: [bob]
        }
      )
    );
  });

  it('Deposit balance', async () => {
    await program.rpc.deposit(aliceBump, new anchor.BN(20), {
      accounts: {
        owner: alice.publicKey,
        userAccount: aliceUserAccount,
        market: lexMarket.publicKey,
        vault: lexBaseVault,
        tokenSource: aliceAccountBase,
        tokenProgram: spl_token.TOKEN_PROGRAM_ID
      },
      signers: [alice]
    });

    await program.rpc.deposit(aliceBump, new anchor.BN(10), {
      accounts: {
        owner: alice.publicKey,
        userAccount: aliceUserAccount,
        market: lexMarket.publicKey,
        vault: lexBaseVault,
        tokenSource: aliceAccountBase,
        tokenProgram: spl_token.TOKEN_PROGRAM_ID
      },
      signers: [alice]
    });

    assert.equal((await mintBase.getAccountInfo(lexBaseVault)).amount, 30);
    assert.equal((await program.account.userAccount.fetch(aliceUserAccount)).baseFree.toNumber(), 30);

    await program.rpc.deposit(bobBump, new anchor.BN(5000), {
      accounts: {
        owner: bob.publicKey,
        userAccount: bobUserAccount,
        market: lexMarket.publicKey,
        vault: lexQouteVault,
        tokenSource: bobAccountQoute,
        tokenProgram: spl_token.TOKEN_PROGRAM_ID
      },
      signers: [bob]
    });

    assert.equal((await mintQoute.getAccountInfo(lexQouteVault)).amount, 5000);
    assert.equal((await program.account.userAccount.fetch(bobUserAccount)).baseFree.toNumber(), 0);
    assert.equal((await program.account.userAccount.fetch(bobUserAccount)).qouteTotal.toNumber(), 5000);
  });

  it('Alice creates Ask order', async () => {
    let rate = new anchor.BN(3 << 32);
    let qty = new anchor.BN(30)
    let askType = 1;
    await program.rpc.newOrder(aliceBump, askType, rate, qty, {
      accounts: {
        owner: alice.publicKey,
        userAccount: aliceUserAccount,
        market: lexMarket.publicKey,
        eventQueue: eventQueue.publicKey,
        orderbook: orderbook.publicKey,
        asks: asks.publicKey,
        bids: bids.publicKey,
        priceOracle: stubPriceOracle.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      }, signers: [alice]
    });
  });

  it('Bob creates Bid order', async () => {
    let rate = new anchor.BN(4 << 32);
    let qty = new anchor.BN(1000)
    let bidType = 0;
    assert.rejects(
      program.rpc.newOrder(bobBump, bidType, rate, qty, {
        accounts: {
          owner: bob.publicKey,
          userAccount: bobUserAccount,
          market: lexMarket.publicKey,
          eventQueue: eventQueue.publicKey,
          orderbook: orderbook.publicKey,
          asks: asks.publicKey,
          bids: bids.publicKey,
          priceOracle: stubPriceOracle.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId
        }, signers: [bob]
      })
    );

    qty = new anchor.BN(10);
    await program.rpc.newOrder(bobBump, bidType, rate, qty, {
        accounts: {
          owner: bob.publicKey,
          userAccount: bobUserAccount,
          market: lexMarket.publicKey,
          eventQueue: eventQueue.publicKey,
          orderbook: orderbook.publicKey,
          asks: asks.publicKey,
          bids: bids.publicKey,
          priceOracle: stubPriceOracle.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId
        }, signers: [bob]
      });
  });

  it('Alice cancels remaining of her first order', async () => {
    let aliceUserAccountData = await program.account.userAccount.fetch(aliceUserAccount);
    let order_id = aliceUserAccountData.openOrders[0]

    // Ensure bob cannot cancel her order
    assert.rejects(
      program.rpc.cancelMyOrder(bobBump, order_id, {
        accounts: {
          owner: bob.publicKey,
          userAccount: bobUserAccount,
          market: lexMarket.publicKey,
          eventQueue: eventQueue.publicKey,
          orderbook: orderbook.publicKey,
          asks: asks.publicKey,
          bids: bids.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId
        }, signers: [bob]
      })
    );

    await program.rpc.cancelMyOrder(aliceBump, order_id, {
      accounts: {
        owner: alice.publicKey,
        userAccount: aliceUserAccount,
        market: lexMarket.publicKey,
        eventQueue: eventQueue.publicKey,
        orderbook: orderbook.publicKey,
        asks: asks.publicKey,
        bids: bids.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      }, signers: [alice]
    });

    aliceUserAccountData = await program.account.userAccount.fetch(aliceUserAccount);
    assert.equal(aliceUserAccountData.baseOpenLend, 10); //10 Is already taken by Bob, ready to be consumed

    // Ensure cannot cancel invalid order
    assert.rejects(
      program.rpc.cancelMyOrder(aliceBump, order_id, {
        accounts: {
          owner: alice.publicKey,
          userAccount: aliceUserAccount,
          market: lexMarket.publicKey,
          eventQueue: eventQueue.publicKey,
          orderbook: orderbook.publicKey,
          asks: asks.publicKey,
          bids: bids.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId
        }, signers: [alice]
      })
    );
  });

});

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

  // Mints, assume base is USD and quote is BTC

  let mintBase: spl_token.Token;
  let mintQuote: spl_token.Token;

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
  let lexQuoteVault: anchor.web3.PublicKey;

  // Alice and Bob are used for simulating what happens in the program

  let alice = anchor.web3.Keypair.generate();
  let bob = anchor.web3.Keypair.generate();

  let aliceAccountBase: anchor.web3.PublicKey;
  let aliceAccountQuote: anchor.web3.PublicKey;
  let bobAccountBase: anchor.web3.PublicKey;
  let bobAccountQuote: anchor.web3.PublicKey;

  let aliceUserAccount: anchor.web3.PublicKey;
  let aliceBump: number;
  let bobUserAccount: anchor.web3.PublicKey;
  let bobBump: number;
  

  it('Is setup!', async () => {
    [marketSigner, signerBump] = await anchor.web3.PublicKey.findProgramAddress([lexMarket.publicKey.toBytes()], program.programId)

    console.log("Request airdrops");
    await connection.confirmTransaction(await connection.requestAirdrop(admin.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL));
    await connection.confirmTransaction(await connection.requestAirdrop(alice.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL));
    await connection.confirmTransaction(await connection.requestAirdrop(bob.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL));
    await connection.confirmTransaction(await connection.requestAirdrop(provider.wallet.publicKey, 20 * anchor.web3.LAMPORTS_PER_SOL));

    console.log("Create mints");
    mintBase = await spl_token.Token.createMint(connection, admin, admin.publicKey, admin.publicKey, 0, spl_token.TOKEN_PROGRAM_ID);
    mintQuote = await spl_token.Token.createMint(connection, admin, admin.publicKey, admin.publicKey, 0, spl_token.TOKEN_PROGRAM_ID);

    console.log("Create token accounts");
    aliceAccountBase = await mintBase.createAssociatedTokenAccount(alice.publicKey);
    await mintBase.mintTo(aliceAccountBase, admin, [], 10000);
    aliceAccountQuote = await mintQuote.createAssociatedTokenAccount(alice.publicKey);
    await mintQuote.mintTo(aliceAccountQuote, admin, [], 10000);

    bobAccountBase = await mintBase.createAssociatedTokenAccount(bob.publicKey);
    await mintBase.mintTo(bobAccountBase, admin, [], 10000);
    bobAccountQuote = await mintQuote.createAssociatedTokenAccount(bob.publicKey);
    await mintQuote.mintTo(bobAccountQuote, admin, [], 10000);

    lexBaseVault = await mintBase.createAccount(marketSigner); // TODO: Investigate why associated token account didn't work
    lexQuoteVault = await mintQuote.createAccount(marketSigner); 

    assert.equal((await mintBase.getAccountInfo(aliceAccountBase)).amount, 10000);
    assert.equal((await mintQuote.getAccountInfo(aliceAccountQuote)).amount, 10000);
    assert.equal((await mintBase.getAccountInfo(bobAccountBase)).amount, 10000);
    assert.equal((await mintQuote.getAccountInfo(bobAccountQuote)).amount, 10000);
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

    // let lexMarketAccount = await program.account.lexMarket.fetch(lexMarket.publicKey);
    // console.log(lexMarketAccount);
  });

  it('Initialize user accounts', async () => {
    [aliceUserAccount, aliceBump] = await anchor.web3.PublicKey.findProgramAddress([lexMarket.publicKey.toBuffer(), alice.publicKey.toBuffer()], program.programId);
    [bobUserAccount, bobBump] = await anchor.web3.PublicKey.findProgramAddress([lexMarket.publicKey.toBuffer(), bob.publicKey.toBuffer()], program.programId);

    await program.rpc.initializeAccount(aliceBump, {
      accounts: {
        userAccount: aliceUserAccount,
        owner: alice.publicKey,
        market: lexMarket.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      },
      signers: [alice]
    });

    await program.rpc.initializeAccount(bobBump, {
      accounts: {
        userAccount: bobUserAccount,
        owner: bob.publicKey,
        market: lexMarket.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      },
      signers: [bob]
    });
  });

  it('Invalid deposit', async() => {
    await assert.rejects(
      program.rpc.deposit(bobBump, new anchor.BN(10), {
          accounts: {
            owner: bob.publicKey,
            userAccount: bobUserAccount,
            market: lexMarket.publicKey,
            vault: aliceAccountBase,
            tokenSource: bobAccountQuote,
            tokenProgram: spl_token.TOKEN_PROGRAM_ID
          },
          signers: [bob]
        }
      )
    );

    await assert.rejects(
      program.rpc.deposit(bobBump, new anchor.BN(1000000), {
          accounts: {
            owner: bob.publicKey,
            userAccount: bobUserAccount,
            market: lexMarket.publicKey,
            vault: lexQuoteVault,
            tokenSource: bobAccountQuote,
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
        vault: lexQuoteVault,
        tokenSource: bobAccountQuote,
        tokenProgram: spl_token.TOKEN_PROGRAM_ID
      },
      signers: [bob]
    });

    assert.equal((await mintQuote.getAccountInfo(lexQuoteVault)).amount, 5000);
    assert.equal((await program.account.userAccount.fetch(bobUserAccount)).baseFree.toNumber(), 0);
    assert.equal((await program.account.userAccount.fetch(bobUserAccount)).quoteTotal.toNumber(), 5000);
  });

  it('Alice creates Ask order', async () => {
    let rate = new anchor.BN(3);
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

    let aliceUserAccountData = await program.account.userAccount.fetch(aliceUserAccount);
    assert.equal(aliceUserAccountData.openOrdersCnt, 1);
  });

  it('Bob creates Bid order', async () => {
    let rate = new anchor.BN(4);
    let qty = new anchor.BN(1000)
    let bidType = 0;
    await assert.rejects(
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

  it('Wallet owner consumes events', async () => {
    await program.rpc.consumeOrderEvents(new anchor.BN(10), {
      accounts: {
        market: lexMarket.publicKey,
        eventQueue: eventQueue.publicKey,
        orderbook: orderbook.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      },
      remainingAccounts: [
        {pubkey: aliceUserAccount, isSigner: false, isWritable: true},
        {pubkey: bobUserAccount, isSigner: false, isWritable: true},
      ]
    });
  });

  it('Alice cancels remaining of her first order', async () => {
    let aliceUserAccountData = await program.account.userAccount.fetch(aliceUserAccount);
    let order_id = aliceUserAccountData.openOrders[0]

    console.log("Ensure bob cannot cancel her order");
    await assert.rejects(
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

    console.log("Cancelling order");
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
    assert.equal(aliceUserAccountData.baseOpenLend, 10); 

    console.log("Ensure cannot cancel order twice");
    await assert.rejects(
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


  it('Bob set another order which becomes risky and will be cancelled', async () => {
    let rate = new anchor.BN(4 << 32);
    let qty = new anchor.BN(10)
    let bidType = 0;

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

    // Set price to high so it be considered risky
    // Bob has 20 borrowed in place with 5000 balance

    let bobUserAccountData = await program.account.userAccount.fetch(bobUserAccount);

    let order_id = bobUserAccountData.openOrders[0]

    await assert.rejects(
      program.rpc.cancelRiskyOrder(bobBump, order_id, {
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
            },
            signers: []
          })
    );

    await program.rpc.setStubPrice(new anchor.BN(201), new anchor.BN(10), {
      accounts: {
        admin: admin.publicKey,
        stubPrice: stubPriceOracle.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      }, signers: [admin, stubPriceOracle]
    })

    await program.rpc.cancelRiskyOrder(bobBump, order_id, {
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
      },
      signers: []
    });
    
  });

  it('Bob withdraws his borrowed debt', async () => {
    await program.rpc.withdraw(bobBump, new anchor.BN(10), {
      accounts: {
        owner: bob.publicKey,
        userAccount: bobUserAccount,
        market: lexMarket.publicKey,
        marketSigner: marketSigner,
        vault: lexBaseVault,
        tokenDest: bobAccountBase,
        priceOracle: stubPriceOracle.publicKey,
        tokenProgram: spl_token.TOKEN_PROGRAM_ID
      },
      signers: [bob]
    })

    let bobUserAccountData = await program.account.userAccount.fetch(bobUserAccount);
    assert.equal(bobUserAccountData.baseFree, 0);

    let bobAccountBaseData = await mintBase.getAccountInfo(bobAccountBase)
    assert.equal(bobAccountBaseData.amount, 10000 + 10)

    await assert.rejects(
      program.rpc.withdraw(bobBump, new anchor.BN(3000), {
        accounts: {
          owner: bob.publicKey,
          userAccount: bobUserAccount,
          market: lexMarket.publicKey,
          marketSigner: marketSigner,
          vault: lexQuoteVault,
          tokenDest: bobAccountQuote,
          priceOracle: stubPriceOracle.publicKey,
          tokenProgram: spl_token.TOKEN_PROGRAM_ID
        },
        signers: [bob]
      })
    )
  });

  it('Liquidation of Bob debts', async () => {
    await program.rpc.setStubPrice(new anchor.BN(405), new anchor.BN(10), {
      accounts: {
        admin: admin.publicKey,
        stubPrice: stubPriceOracle.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      }, signers: [admin, stubPriceOracle]
    })

    await program.rpc.liquidateDebts([new anchor.BN(0)], [new anchor.BN(4)], {
      accounts: {
        liquidator: alice.publicKey,
        tokenBaseSrc: aliceAccountBase,
        tokenQuoteDest: aliceAccountQuote,
        baseVault: lexBaseVault,
        quoteVault: lexQuoteVault,
        marketSigner: marketSigner,
        borrowerAccount: bobUserAccount,
        priceOracle: stubPriceOracle.publicKey,
        market: lexMarket.publicKey,
        tokenProgram: spl_token.TOKEN_PROGRAM_ID
      },
      signers: [alice],
      remainingAccounts: [
        {pubkey: aliceUserAccount, isSigner: false, isWritable: true}
      ]
    })

    let aliceAccountQuoteData = await mintQuote.getAccountInfo(aliceAccountQuote)
    assert.equal(aliceAccountQuoteData.amount, 10000 + 1669)
  });

  it('Bob deposits remaining back and settles his debt', async () => {
    await assert.rejects(
      program.rpc.settleDebt(bobBump, 0, {
        accounts: {
          owner: bob.publicKey,
          borrowerAccount: bobUserAccount,
          lenderAccount: aliceUserAccount,
          market: lexMarket.publicKey
        },
        signers: [bob]
      })
    );

    await program.rpc.deposit(bobBump, new anchor.BN(6), {
      accounts: {
        owner: bob.publicKey,
        userAccount: bobUserAccount,
        market: lexMarket.publicKey,
        vault: lexBaseVault,
        tokenSource: bobAccountBase,
        tokenProgram: spl_token.TOKEN_PROGRAM_ID
      },
      signers: [bob]
    });

    await program.rpc.settleDebt(bobBump, 0, {
      accounts: {
        owner: bob.publicKey,
        borrowerAccount: bobUserAccount,
        lenderAccount: aliceUserAccount,
        market: lexMarket.publicKey
      },
      signers: [bob]
    });
  });

});

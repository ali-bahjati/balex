import {
    ConnectionProvider,
    WalletProvider,
    useAnchorWallet,
    useConnection,
    useWallet,
    AnchorWallet,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolletExtensionWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl, Keypair, SystemProgram, Transaction } from '@solana/web3.js';
import * as anchor from '@project-serum/anchor';
import { PublicKey } from '@solana/web3.js';

import React, { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Balex } from './types/balex';
import balexIdl from './idl/balex.json';
import * as spl_token from '@solana/spl-token';
import { getPriceFromKey, MarketState } from '@bonfida/aaob';

import { IdlAccounts, Program } from '@project-serum/anchor';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';

import './index.css';
import Account from './components/Account';
import NewOrder from './components/NewOrder';
import OpenOrders from './components/OpenOrders';
import OpenDebts from './components/OpenDebts';
import { getUserAccount, useProgram } from './utils';
import { lexMarketPubkey, stubOracle } from './settings';

import Orderbook from './components/Orderbook';
import StubOracle from './components/StubOracle';
import { createRequire } from 'module';

//
// Configurations.
//



export const App = () => {
    return (
        <WalletContext>
            <React.Fragment>
                <div className='header'>
                    <div style={{ flex: '1' }}>
                        <img height={36} src={require("./assets/BalexLogo.png")}></img>
                    </div>
                    <div style={{ width: '190px', display: 'flex', justifyContent: 'end' }}>
                        <WalletMultiButton />
                    </div>
                </div>
                <Core />
                {/* <Footer /> */}
            </React.Fragment>
        </WalletContext>
    );
};

const WalletContext = ({ children }: { children: ReactNode }) => {
    const network = WalletAdapterNetwork.Devnet;

    const endpoint = useMemo(() => clusterApiUrl(network), [network]);
    // const endpoint = 'http://localhost:8899';

    const wallets = useMemo(
        () => [new PhantomWalletAdapter(), new SolletExtensionWalletAdapter({ network })],
        [] //[network]
    );

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>{children}</WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};

const Core = () => {
    const wallet = useAnchorWallet();
    const program = useProgram(wallet);

    const [userAccount, setUserAccount] = useState<anchor.IdlAccounts<Balex>['userAccount']>(null);

    const [market, setMarket] = useState<anchor.IdlAccounts<Balex>['lexMarket']>(null)

    useEffect(() => {
        if (!program) {
            return null;
        }
        const f = async () => {
            const account: any = await program.account.lexMarket.fetch(lexMarketPubkey);
            setMarket(account);
        };
        f();
    }, [program]);

    async function loadUserAccount() {
        const account = await program.account.userAccount.fetchNullable((await getUserAccount(wallet))[0]);
        console.log(account);
        if (account) {
            setUserAccount(account);
        }
    }
    async function createUserAccount() {
        const [userPub, bump] = await getUserAccount(wallet);

        await program.rpc.initializeAccount(bump, {
            accounts: {
                market: lexMarketPubkey,
                owner: wallet.publicKey,
                userAccount: userPub,
                systemProgram: anchor.web3.SystemProgram.programId,
            },
        });

        loadUserAccount();
    }
    async function registerUserChangeHook() {
        const [userPub, _bump] = await getUserAccount(wallet);
        program.account.userAccount.subscribe(userPub).addListener("change", (acc: IdlAccounts<Balex>['userAccount']) => { setUserAccount(acc) });
    }

    useEffect(() => {
        if (program) {
            loadUserAccount();
        }
        console.log(program)
        console.log(userAccount, 'user account')
    }, [program]);

    useEffect(() => {
        if (userAccount) {
            registerUserChangeHook();
        }
    }, [userAccount]);

    if (!userAccount || !wallet)
        return <div></div>;
    return (
        <div className='content'>
            <div style={{ height: '100%', display: 'flex', flex: '1', flexDirection: 'column', marginRight: '10px' }}>
                <OpenOrders userAccount={userAccount} />
                <div style={{ marginTop: '10px' }}></div>
                <OpenDebts userAccount={userAccount} />
            </div>
            <div style={{ height: '100%', width: '350px', display: 'flex', flexDirection: 'column', marginRight: '10px' }}>
                <NewOrder userAccount={userAccount} />
                <div style={{ marginTop: '10px' }}></div>
                <Orderbook />
            </div>
            <div style={{ height: '100%' }}>
                <Account userAccount={userAccount} />
                <div style={{ marginTop: '10px' }}></div>
                <StubOracle />
            </div>
        </div>
    );
};

// export const StubOracle = () => {
//     const [price, setPrice] = useState<number>(0);
//     const [suggested_price, setSuggestedPrice] = useState<number>(0);
//     const wallet = useAnchorWallet();
//     const program = useProgram(wallet);

//     async function applySuggestedPrice() {
//         if (program) {
//             await program.rpc.setStubPrice(new anchor.BN(suggested_price), new anchor.BN(10), {
//                 accounts: {
//                     admin: wallet.publicKey,
//                     stubPrice: stubOracle.publicKey,
//                     systemProgram: anchor.web3.SystemProgram.programId,
//                 },
//                 signers: [stubOracle],
//             });
//         } else {
//             console.log('Wallet is not connected yet');
//         }
//     }

//     async function registerPriceChangeHook() {
//         if (program) {
//             let stubData = await program.account.stubPrice.fetch(stubOracle.publicKey);
//             setPrice(stubData.price.toNumber());
//             program.account.stubPrice
//                 .subscribe(stubOracle.publicKey, 'confirmed')
//                 .addListener('change', (acc: IdlAccounts<Balex>['stubPrice']) => {
//                     setPrice(acc.price.toNumber());
//                 });
//         }
//     }

//     useEffect(() => {
//         registerPriceChangeHook();
//     }, [program]);

//     return (
//         <antd.Card title="Price Oracle">
//             <antd.Row gutter={{ xs: 8, sm: 16, md: 24, lg: 32 }}>
//                 <antd.Col className="gutter-row" span={2}>
//                     <antd.Statistic title="Current Price" value={price} />
//                 </antd.Col>
//                 <antd.Col className="gutter-row" span={6}>
//                     <antd.InputNumber
//                         onChange={(value) => setSuggestedPrice(parseInt(value.toString()))}
//                     ></antd.InputNumber>
//                     <antd.Button style={{ marginLeft: 8 }} type="primary" onClick={applySuggestedPrice}>
//                         Set Price to given value
//                     </antd.Button>
//                 </antd.Col>
//             </antd.Row>
//         </antd.Card>
//     );
// };

export const UserAccount = () => {
    const wallet = useAnchorWallet();
    const program = useProgram(wallet);

    const [userAccount, setUserAccount] = useState<anchor.IdlAccounts<Balex>['userAccount']>(null);
    const [userStat, setUserStat] = useState<[number, number, number]>([0, 0, 0]);
    const [userAccountFetched, setUserAccountFetched] = useState<boolean>(false);

    const [market, setMarket] = useState<anchor.IdlAccounts<Balex>['lexMarket']>(null)

    useEffect(() => {
        if (!program) {
            return null;
        }
        const f = async () => {
            const account: any = await program.account.lexMarket.fetch(lexMarketPubkey);
            setMarket(account);
        };
        f();
    }, [program]);

    async function loadUserAccount() {
        const account = await program.account.userAccount.fetchNullable((await getUserAccount(wallet))[0]);
        if (account) {
            setUserAccount(account);
            setUserAccountFetched(true);
        }
    }
    async function createUserAccount() {
        const [userPub, bump] = await getUserAccount(wallet);

        await program.rpc.initializeAccount(bump, {
            accounts: {
                market: lexMarketPubkey,
                owner: wallet.publicKey,
                userAccount: userPub,
                systemProgram: anchor.web3.SystemProgram.programId,
            },
        });

        loadUserAccount();
    }
    async function registerUserChangeHook() {
        const [userPub, _bump] = await getUserAccount(wallet);
        program.account.userAccount.subscribe(userPub).addListener("change", (acc: IdlAccounts<Balex>['userAccount']) => { setUserAccount(acc) });
    }

    useEffect(() => {
        if (program) {
            loadUserAccount();
        }
        console.log(program)
    }, [program]);

    useEffect(() => {
        if (userAccount) {
            registerUserChangeHook();
        }
    }, [userAccountFetched]);

    async function updateUserStat() {
        setUserStat(await getUserStat(userAccount, program))
    }

    useEffect(() => {
        if(userAccount) {
            updateUserStat();
        }
    }, [userAccount])

    if (userAccount) {
        return (
            <antd.Card title="Trade (User Account)">
                <antd.Row>
                    <antd.Col>
                        Your Total BTC is {userAccount.quoteTotal.toNumber()} and available USDT is {userAccount.baseFree.toNumber()}
                        <br/>Your health is {userStat[0]}%. Max Withdraw of BTC: {userStat[1]}. Max Borrow of USDT: {userStat[2]}.
                        {userAccount.baseOpenBorrow.toNumber() > 0 && (
                            <div>
                                <br />
                                Open value to borrow is {userAccount.baseOpenBorrow.toNumber()}
                            </div>
                        )}
                        {userAccount.baseOpenLend.toNumber() > 0 && (
                            <div>
                                <br />
                                Open value to lend is {userAccount.baseOpenLend.toNumber()}
                            </div>
                        )}
                        {userAccount.baseLocked.toNumber() > 0 && (
                            <div>
                                <br />
                                Open value to lend is {userAccount.baseLocked.toNumber()}
                            </div>
                        )}
                        
                    </antd.Col>
                </antd.Row>
                {market && (
                    <div>
                        <antd.Row>
                            <antd.Col style={{ padding: 10 }}>
                                <UserTokenManage name="BTC" mint={market.quoteMint} vault={market.quoteVault} />
                            </antd.Col>
                            <antd.Col style={{ padding: 10 }}>
                                <UserTokenManage name="USD" mint={market.baseMint} vault={market.baseVault} />
                            </antd.Col>
                            <antd.Col style={{ padding: 10 }}>
                                <NewOrder userAccount={userAccount} />
                            </antd.Col>
                        </antd.Row>
                        <antd.Row>
                            <OpenOrders userAccount={userAccount} />
                        </antd.Row>
                        <antd.Row>
                            <OpenDebts userAccount={userAccount} />
                        </antd.Row>
                    </div>
                )}
            </antd.Card>
        );
    } else if (wallet) {
        return (
            <antd.Card title="User Account">
                <antd.Row gutter={{ xs: 8, sm: 16, md: 24, lg: 32 }}>
                    <antd.Col className="glutter-row">You don't have User account yet. Let's create one!</antd.Col>
                </antd.Row>
                <antd.Row gutter={{ xs: 8, sm: 16, md: 24, lg: 32 }}>
                    <antd.Col className="glutter-row">
                        <antd.Button onClick={createUserAccount}>Create User Account</antd.Button>
                    </antd.Col>
                </antd.Row>
            </antd.Card>
        );
    } else {
        return (
            <antd.Card title="User Account">
                <antd.Row gutter={{ xs: 8, sm: 16, md: 24, lg: 32 }}>
                    <antd.Col className="glutter-row">Please connect wallet.</antd.Col>
                </antd.Row>
            </antd.Card>
        );
    }
};

export const UserTokenManage = ({ name, mint, vault }: { name: string, mint: PublicKey, vault: PublicKey }) => {
    const wallet = useAnchorWallet();
    const program = useProgram(wallet);

    const [amount, setAmount] = useState<number>(0)
    const [userToken, setUserToken] = useState<PublicKey>(null);
    const [userTokenExists, setUserTokenExists] = useState<boolean>(false);

    const [tokenBalance, setTokenBalance] = useState<number>(0);

    async function updateUserBalance() {
        if (!userToken || !userTokenExists) {
            return;
        }

        const connection = program.provider.connection;
        const tokenAmount = await connection.getTokenAccountBalance(userToken, 'confirmed');
        setTokenBalance(tokenAmount.value.uiAmount)
    }
    async function fetchUserToken() {
        const connection = program.provider.connection;
        let token = await spl_token.Token.getAssociatedTokenAddress(spl_token.ASSOCIATED_TOKEN_PROGRAM_ID, spl_token.TOKEN_PROGRAM_ID, mint, wallet.publicKey);
        setUserToken(token);

        try {
            await connection.getTokenAccountBalance(token, 'confirmed');
            setUserTokenExists(true);
        } catch (err) {
            console.log(name, err)
        }
    }

    useEffect(() => {
        if (wallet) {
            fetchUserToken();
        }
    }, [wallet])

    useEffect(() => { updateUserBalance() }, [userTokenExists, userToken]);

    useInterval(updateUserBalance, 5000);

    async function createTokenAccount() {
        const connection = program.provider.connection;
        let transaction = new Transaction({
            recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
            feePayer: wallet.publicKey
        }).add(
            spl_token.Token.createAssociatedTokenAccountInstruction(spl_token.ASSOCIATED_TOKEN_PROGRAM_ID, spl_token.TOKEN_PROGRAM_ID, mint, userToken,
                wallet.publicKey, wallet.publicKey)
        );

        await connection.confirmTransaction(await program.provider.send(transaction))
        setUserTokenExists(true);
    }

    async function deposit() {
        const [userPub, bump] = await getUserAccount(wallet);

        await program.rpc.deposit(bump, new anchor.BN(amount), {
            accounts: {
                owner: wallet.publicKey,
                userAccount: userPub,
                tokenSource: userToken,
                vault: vault,
                tokenProgram: spl_token.TOKEN_PROGRAM_ID,
                market: lexMarketPubkey
            }
        })
    }

    async function withdraw() {
        const [userPub, bump] = await getUserAccount(wallet);

        await program.rpc.withdraw(bump, new anchor.BN(amount), {
            accounts: {
                owner: wallet.publicKey,
                userAccount: userPub,
                tokenDest: userToken,
                vault: vault,
                tokenProgram: spl_token.TOKEN_PROGRAM_ID,
                market: lexMarketPubkey,
                priceOracle: stubOracle.publicKey,
                marketSigner: await getMarketSinger(),
            }
        })
    }

    async function mintToken() {
        const connection = program.provider.connection;
        const mintToken = new spl_token.Token(connection, mint, spl_token.TOKEN_PROGRAM_ID, admin)
        await mintToken.mintTo(userToken, admin.publicKey, [admin], amount)
    }

    if (!program) {
        return (<div>Please connect wallet!"</div>)
    } else if (!userTokenExists) {
        return (
            <antd.Card title={name}>
                <antd.Row style={{ padding: 10 }}>
                    <antd.Col>
                        <antd.Button onClick={createTokenAccount}>Create {name} Associated Token Account</antd.Button>
                    </antd.Col>
                </antd.Row>
            </antd.Card>
        )
    } else {
        return (
            <antd.Card title={name}>
                <antd.Row style={{ padding: 10 }}>
                    <antd.Col>
                        <antd.Typography.Text>You have {tokenBalance} {name}. Amount: </antd.Typography.Text>
                    </antd.Col>
                    <antd.Col style={{ width: 20 }}>
                    </antd.Col>
                    <antd.Col>
                        <antd.InputNumber
                            onChange={(value) => setAmount(parseInt(value.toString()))}
                        ></antd.InputNumber>
                    </antd.Col>
                </antd.Row>
                <antd.Row style={{ alignContent: 'center' }}>
                    <antd.Col>
                        <antd.Button onClick={mintToken}>Mint</antd.Button>
                    </antd.Col>
                    <antd.Col>
                        <antd.Button onClick={withdraw}>Withdraw from Balex</antd.Button>
                    </antd.Col>
                    <antd.Col>
                        <antd.Button onClick={deposit}>Deposit to Balex</antd.Button>
                    </antd.Col>
                </antd.Row>
            </antd.Card>
        )
    }
}

// export const NewOrder = ({userAccount}: {userAccount: IdlAccounts<Balex>['userAccount']}) => {
//     const [amount, setAmount] = useState<number>(0)
//     const [rate, setRate] = useState<number>(0)
//     const wallet = useAnchorWallet();
//     const program = useProgram(wallet);

//     async function newOrder(type: number) {
//         const [userPub, bump] = await getUserAccount(wallet);
//         const [orderbook, eventQueue, asks, bids] = await getMarketAccounts(program)

//         await program.rpc.newOrder(bump, type, new anchor.BN(rate), new anchor.BN(amount), {
//             accounts: {
//                 owner: wallet.publicKey,
//                 userAccount: userPub,
//                 market: lexMarketPubkey,
//                 eventQueue: eventQueue,
//                 asks: asks,
//                 bids: bids,
//                 orderbook: orderbook,
//                 priceOracle: stubOracle.publicKey,
//                 systemProgram: anchor.web3.SystemProgram.programId
//             }
//         })
//     }

//     return (
//         <antd.Card title="New order">
//             <antd.Row>
//                     Amount:
//                     <antd.InputNumber
//                         onChange={(value) => setAmount(parseInt(value.toString()))}
//                     ></antd.InputNumber>
//             </antd.Row>
//             <antd.Row>
//                     Inerest Rate:
//                     <antd.InputNumber
//                         onChange={(value) => setRate(parseInt(value.toString()))}
//                     ></antd.InputNumber>
//             </antd.Row>
//             <antd.Row>
//                 <antd.Button onClick={() => newOrder(0)}>Borrow</antd.Button>
//                 <antd.Button onClick={() => newOrder(1)}>Lend</antd.Button>
//             </antd.Row>
//         </antd.Card>
//     )
// }


// export const OrderBook = () => {
//     const wallet = useAnchorWallet();
//     const program = useProgram(wallet);
//     const [asks, setAsks] = useState<{ size: number, price: number }[]>([])
//     const [bids, setBids] = useState<{ size: number, price: number }[]>([])

//     async function updateOrderBook() {
//         if (!program) {
//             return;
//         }
//         const [orderbook, eventQueue, asks, bids] = await getMarketAccounts(program)
//         const connection = program.provider.connection;
//         const marketData = await MarketState.retrieve(connection, orderbook, 'confirmed')
//         const askData = await marketData.loadAsksSlab(connection, 'confirmed')
//         const bidData = await marketData.loadBidsSlab(connection, 'confirmed')

//         setAsks(askData.getL2DepthJS(10, true));
//         setBids(bidData.getL2DepthJS(10, false));
//     }

//     async function registerChanges() {
//         const [orderbook, eventQueue, asks, bids] = await getMarketAccounts(program)
//         program.provider.connection.onAccountChange(orderbook, updateOrderBook, 'confirmed');
//         program.provider.connection.onAccountChange(bids, updateOrderBook, 'confirmed');
//         program.provider.connection.onAccountChange(asks, updateOrderBook, 'confirmed');
//     }

//     useEffect(() => {
//         updateOrderBook();
//         if (program) {
//             registerChanges();
//         }
//     }, [program])

//     return (
//         <antd.Card>
//             <antd.Row gutter={{ xs: 8, sm: 16, md: 24, lg: 32 }}>
//                 <antd.Col className="gutter-row" span={6}>
//                     <antd.Card title="Borrows">
//                         {bids.map(({ price, size }) => (
//                             <antd.Row key={price + ''}>{size} with {price}% interest</antd.Row>
//                         ))}
//                     </antd.Card>
//                 </antd.Col>
//                 <antd.Col className="gutter-row" span={6}>
//                     <antd.Card title="Lends">
//                         {asks.map(({ price, size }) => (
//                             <antd.Row key={price + ''}>{size} with {price}% interest</antd.Row>
//                         ))}
//                     </antd.Card>
//                 </antd.Col>
//             </antd.Row>
//         </antd.Card>
//     )
// }


// export const OpenOrders = ({userAccount}: {userAccount: IdlAccounts<Balex>['userAccount']}) => {
//     const wallet = useAnchorWallet();
//     const program = useProgram(wallet);

//     type OrderType = {size: number, price: number, order_id: anchor.BN}

//     const [borrowOrders, setBorrowOrders] = useState<OrderType[]>([])
//     const [lendOrders, setLendOrders] = useState<OrderType[]>([])

//     async function updateOrders() {
//         const [orderbook, eventQueue, asks, bids] = await getMarketAccounts(program)
//         const connection = program.provider.connection;
//         const marketData = await MarketState.retrieve(connection, orderbook, 'confirmed')
//         const askData = await marketData.loadAsksSlab(connection, 'confirmed')
//         const bidData = await marketData.loadBidsSlab(connection, 'confirmed')

//         let borrowOrders: OrderType[] = []
//         let lendOrders: OrderType[] = []
//         for (let i = 0; i < userAccount.openOrdersCnt; i++) { 
//             const order_id = userAccount.openOrders[i]

//             let askNode = askData.getNodeByKey(order_id as any);
//             if (askNode) {
//                 let size = askNode.baseQuantity.toNumber()
//                 lendOrders.push({price: getPriceFromKey(order_id).toNumber(), order_id: order_id, size: size})
//             } else {
//                 let bidNode = bidData.getNodeByKey(order_id as any);
//                 if (bidNode) {
//                     let size = bidNode.baseQuantity.toNumber()
//                     borrowOrders.push({ price: getPriceFromKey(order_id).toNumber(), order_id: order_id, size: size })
//                 } else {
//                     console.log("Strange!");
//                     continue;
//                 }
//             } 
//         }

//         lendOrders.sort((a, b) => a.price - b.price)
//         borrowOrders.sort((a, b) => b.price - a.price)

//         setLendOrders(lendOrders);
//         setBorrowOrders(borrowOrders);
//     }

//     async function registerChanges() {
//         const [orderbook, eventQueue, asks, bids] = await getMarketAccounts(program)
//         program.provider.connection.onAccountChange(orderbook, updateOrders, 'confirmed');
//         program.provider.connection.onAccountChange(bids, updateOrders, 'confirmed');
//         program.provider.connection.onAccountChange(asks, updateOrders, 'confirmed');
//     }

//     useEffect(() => {
//         updateOrders();
//     }, [userAccount])

//     useInterval(updateOrders, 5000)

//     async function cancelOrder(order_id: anchor.BN) {
//         const [userPub, bump] = await getUserAccount(wallet);
//         const [orderbook, eventQueue, asks, bids] = await getMarketAccounts(program)
//         program.rpc.cancelMyOrder(bump, order_id, {
//             accounts: {
//                 market: lexMarketPubkey,
//                 owner: wallet.publicKey,
//                 userAccount: userPub,
//                 orderbook: orderbook,
//                 eventQueue: eventQueue,
//                 asks: asks,
//                 bids: bids,
//                 systemProgram: anchor.web3.SystemProgram.programId
//             }
//         });
//     }

//     return (<antd.Card title="Open Orders" style={{ flex: '1'}}>
//         <antd.Row>
//             <antd.Col style={{ padding: 10 }}>
//                 <antd.Card title="Borrow">
//                     {borrowOrders.map((order) => (
//                         <antd.Row style={{ padding: 5 }} key={order.order_id.toString()}>
//                             <antd.Col flex='auto'>
//                                 {order.size} USD with {order.price}% interest.
//                             </antd.Col>
//                             <antd.Col flex={1}>
//                                 <antd.Button style={{ paddingLeft: 15 }} onClick={() => cancelOrder(order.order_id)}>Cancel</antd.Button>
//                             </antd.Col>
//                         </antd.Row>
//                     ))}
//                 </antd.Card>
//             </antd.Col>
//             <antd.Col style={{padding: 10}}>
//                 <antd.Card title="Lend">
//                     {lendOrders.map((order) => (
//                         <antd.Row style={{ padding: 5 }} key={order.order_id.toString()}>
//                             <antd.Col flex='auto'>
//                                 {order.size} USD with {order.price}% interest.
//                             </antd.Col>
//                             <antd.Col flex={1}>
//                                 <antd.Button style={{ paddingLeft: 15 }} onClick={() => cancelOrder(order.order_id)}>Cancel</antd.Button>
//                             </antd.Col>
//                         </antd.Row>
//                     ))}
//                 </antd.Card>
//             </antd.Col>

//         </antd.Row>
//     </antd.Card>)
// }

// export const OpenDebts = ({ userAccount }: { userAccount: IdlAccounts<Balex>['userAccount'] }) => {
//     const wallet = useAnchorWallet();
//     const program = useProgram(wallet);

//     type DebtType = {
//         borrower: PublicKey,
//         lender: PublicKey,
//         interestRate: anchor.BN,
//         liquidQty: anchor.BN,
//         qty: anchor.BN,
//         timestamp: anchor.BN
//     }



//     const [borrowDebts, setBorrowDebts] = useState<DebtType[]>([])
//     const [lendDebts, setLendDebts] = useState<DebtType[]>([])

//     async function updateDebts() {
//         let marketData = await program.account.lexMarket.fetch(lexMarketPubkey);
//         console.log(marketData.debts)

//         for (let i = 0; i < userAccount.openDebtsCnt; i++) {
//             let debt_id = userAccount.openDebts[i];
//             let debt: DebtType = marketData.debts[debt_id]
//         }
//     }

//     useEffect(() => {
//         updateDebts();
//     }, [userAccount])


//     return (
//         <antd.Card title="Open Debts">
//         </antd.Card>
//     )
// }

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

import 'antd/dist/antd.css';
import './index.css';

import { Layout } from 'antd';
import * as antd from 'antd';
import React, { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Balex } from './types/balex';
import balexIdl from './idl/balex.json';
import * as spl_token from '@solana/spl-token';
import { EventQueue, MarketState } from '@bonfida/aaob';
import { Slab } from '@bonfida/aaob';

import { IdlAccounts, Program } from '@project-serum/anchor';

const { Header, Content } = Layout;

//
// Configurations.
//

const programId = new PublicKey(balexIdl.metadata.address);
const lexMarketPubkey = new PublicKey('EcmMMt1tdwLtqKKL5zoCfFHXW16REjc7w35LDuKJB3aY');

const admin = anchor.web3.Keypair.fromSecretKey(new Uint8Array([
    59, 225, 186,  23,  64,  44, 197, 113, 164,  74, 216,
    98,  33, 200,  17,  77,   9, 181, 115, 123,  80,  24,
    88, 217,  27,  77,  76,  28, 108,  41,  64, 218, 180,
    41, 200, 230, 112, 212, 170, 148, 141, 217, 142, 233,
    45, 238, 223, 149,  64, 105, 120, 232, 242,  46, 178,
    16,  18, 126, 137,  61, 206,   9,   2,  13
]));

const stubOracle = anchor.web3.Keypair.fromSecretKey(
    new Uint8Array([
        164, 136, 233, 111, 240, 29, 97, 187, 248, 101, 216,
        129, 99, 7, 134, 146, 9, 64, 42, 188, 164, 3,
        43, 3, 31, 134, 201, 97, 96, 8, 146, 85, 52,
        182, 218, 14, 77, 140, 205, 34, 249, 144, 123, 62,
        146, 96, 65, 198, 225, 169, 152, 126, 106, 143, 124,
        236, 38, 152, 211, 140, 26, 185, 66, 103
    ])
);

function useInterval(callback, delay) {
    const savedCallback: any = useRef();

    // Remember the latest callback.
    useEffect(() => {
        savedCallback.current = callback;
    }, [callback]);

    // Set up the interval.
    useEffect(() => {
        function tick() {
            savedCallback.current();
        }
        if (delay !== null) {
            let id = setInterval(tick, delay);
            return () => clearInterval(id);
        }
    }, [delay]);
}

function getProvider(wallet: AnchorWallet) {
    /* create the provider and return it to the caller */
    /* network set to local network for now */
    const network = 'http://127.0.0.1:8899';
    const connection = new anchor.web3.Connection(network, 'confirmed');

    const provider = new anchor.Provider(connection, wallet, 'confirmed' as any);
    return provider;
}

function useProgram(wallet: AnchorWallet): anchor.Program<Balex> {
    return useMemo(() => {
        if (!wallet) {
            return null;
        }
        const program: anchor.Program<Balex> = new anchor.Program<Balex>(balexIdl as any, programId, getProvider(wallet));
        return program;
    }, [wallet]);
}

async function getUserAccount(wallet: AnchorWallet): Promise<[PublicKey, number]> {
    return await PublicKey.findProgramAddress(
        [lexMarketPubkey.toBuffer(), wallet.publicKey.toBuffer()],
        programId
    );
}

async function getMarketSinger() {
    return (await PublicKey.findProgramAddress([lexMarketPubkey.toBytes()], programId))[0]
}

async function getMarketAccounts(program: Program<Balex>): Promise<[PublicKey, PublicKey, PublicKey, PublicKey]> {
    const marketData = await program.account.lexMarket.fetch(lexMarketPubkey);
    
    const orderbook = marketData.orderbook;

    const orderbookData = await MarketState.retrieve(program.provider.connection, orderbook, 'confirmed')

    return [orderbook, orderbookData.eventQueue, orderbookData.asks, orderbookData.bids];
}

export const App = () => {
    return (
        <WalletContext>
            <React.Fragment>
                <Layout
                    style={{
                        display: 'flex',
                        minHeight: '100vh',
                        flexDirection: 'column',
                    }}
                >
                    <Header style={{ padding: 10, minHeight: 64, height: 'unset' }}>
                        <WalletMultiButton />
                    </Header>
                    <Content style={{ flex: 1, padding: 10 }}>
                        <Core />
                    </Content>
                    {/* <Footer /> */}
                </Layout>
            </React.Fragment>
        </WalletContext>
    );
};

const WalletContext = ({ children }: { children: ReactNode }) => {
    // const network = WalletAdapterNetwork.Devnet;

    // const endpoint = useMemo(() => clusterApiUrl(network), [network]);
    const endpoint = 'http://localhost:8899';

    const wallets = useMemo(
        () => [new PhantomWalletAdapter(), new SolletExtensionWalletAdapter()],
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
    return (
        <div className="App">
            <div>
                <StubOracle />
                <UserAccount />
                <OrderBook />
            </div>
        </div>
    );
};

export const StubOracle = () => {
    const [price, setPrice] = useState<number>(0);
    const [suggested_price, setSuggestedPrice] = useState<number>(0);
    const wallet = useAnchorWallet();
    const program = useProgram(wallet);

    async function applySuggestedPrice() {
        if (program) {
            await program.rpc.setStubPrice(new anchor.BN(suggested_price), new anchor.BN(10), {
                accounts: {
                    admin: wallet.publicKey,
                    stubPrice: stubOracle.publicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                },
                signers: [stubOracle],
            });
        } else {
            console.log('Wallet is not connected yet');
        }
    }

    async function registerPriceChangeHook() {
        if (program) {
            let stubData = await program.account.stubPrice.fetch(stubOracle.publicKey);
            setPrice(stubData.price.toNumber());
            program.account.stubPrice
                .subscribe(stubOracle.publicKey, 'confirmed')
                .addListener('change', (acc: IdlAccounts<Balex>['stubPrice']) => {
                    setPrice(acc.price.toNumber());
                });
        }
    }

    useEffect(() => {
        registerPriceChangeHook();
    }, [program]);

    return (
        <antd.Card title="Price Oracle">
            <antd.Row gutter={{ xs: 8, sm: 16, md: 24, lg: 32 }}>
                <antd.Col className="gutter-row" span={2}>
                    <antd.Statistic title="Current Price" value={price} />
                </antd.Col>
                <antd.Col className="gutter-row" span={6}>
                    <antd.InputNumber
                        onChange={(value) => setSuggestedPrice(parseInt(value.toString()))}
                    ></antd.InputNumber>
                    <antd.Button style={{ marginLeft: 8 }} type="primary" onClick={applySuggestedPrice}>
                        Set Price to given value
                    </antd.Button>
                </antd.Col>
            </antd.Row>
        </antd.Card>
    );
};

export const UserAccount = () => {
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
        program.account.userAccount.subscribe(userPub).addListener("change", (acc: IdlAccounts<Balex>['userAccount']) => {setUserAccount(acc)});
    }

    useEffect(() => {
        if (program) {
            loadUserAccount();
        }
        console.log(program)
    }, [program]);

    useEffect(() => {
        if(userAccount) {
            registerUserChangeHook();
        }
    }, [userAccount]);

    if (userAccount) {
        return (
            <antd.Card title="User Account">
                <antd.Row>
                    <antd.Col>
                        Your Total BTC is {userAccount.quoteTotal.toNumber()} and available USDT is {userAccount.baseFree.toNumber()}
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
                    <antd.Row>
                        <antd.Col style={{padding: 10}}>
                            <UserTokenManage name="BTC" mint={market.quoteMint} vault={market.quoteVault} />
                        </antd.Col>
                        <antd.Col style={{padding: 10}}>
                            <UserTokenManage name="USD" mint={market.baseMint} vault={market.baseVault} />
                        </antd.Col>
                        <antd.Col style={{padding: 10}}>
                            <NewOrder userAccount={userAccount} />
                        </antd.Col>
                    </antd.Row>
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

export const UserTokenManage = ({name, mint, vault}: {name: string, mint: PublicKey, vault: PublicKey}) => {
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
        } catch(err) {
            console.log(name, err)
        } 
    }

    useEffect(() => {
        if (wallet) {
            fetchUserToken();
        }
    }, [wallet])

    useEffect(() => {updateUserBalance()}, [userTokenExists, userToken]);

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
                <antd.Row style={{padding: 10}}>
                    <antd.Col>
                        <antd.Button onClick={createTokenAccount}>Create {name} Associated Token Account</antd.Button>
                    </antd.Col>
                </antd.Row>
            </antd.Card>
        )
    } else {
        return (
            <antd.Card title={name}>
                <antd.Row style={{padding: 10}}>
                    <antd.Col>
                        <antd.Typography.Text>You have {tokenBalance} {name}. Amount: </antd.Typography.Text>
                    </antd.Col>
                    <antd.Col style={{width: 20}}>
                    </antd.Col>
                    <antd.Col>
                        <antd.InputNumber
                            onChange={(value) => setAmount(parseInt(value.toString()))}
                        ></antd.InputNumber>
                    </antd.Col>
                </antd.Row>
                <antd.Row style={{alignContent: 'center'}}>
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

export const NewOrder = ({userAccount}: {userAccount: IdlAccounts<Balex>['userAccount']}) => {
    const [amount, setAmount] = useState<number>(0)
    const [rate, setRate] = useState<number>(0)
    const wallet = useAnchorWallet();
    const program = useProgram(wallet);

    async function newOrder(type: number) {
        const [userPub, bump] = await getUserAccount(wallet);
        const [orderbook, eventQueue, asks, bids] = await getMarketAccounts(program)

        await program.rpc.newOrder(bump, type, new anchor.BN(rate), new anchor.BN(amount), {
            accounts: {
                owner: wallet.publicKey,
                userAccount: userPub,
                market: lexMarketPubkey,
                eventQueue: eventQueue,
                asks: asks,
                bids: bids,
                orderbook: orderbook,
                priceOracle: stubOracle.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId
            }
        })
    }

    return (
        <antd.Card title="New order">
            <antd.Row>
                    Amount:
                    <antd.InputNumber
                        onChange={(value) => setAmount(parseInt(value.toString()))}
                    ></antd.InputNumber>
            </antd.Row>
            <antd.Row>
                    Inerest Rate:
                    <antd.InputNumber
                        onChange={(value) => setRate(parseInt(value.toString()))}
                    ></antd.InputNumber>
            </antd.Row>
            <antd.Row>
                <antd.Button onClick={() => newOrder(0)}>Borrow</antd.Button>
                <antd.Button onClick={() => newOrder(1)}>Lend</antd.Button>
            </antd.Row>
        </antd.Card>
    )
}


export const OrderBook = () => {
    const wallet = useAnchorWallet();
    const program = useProgram(wallet);
    const [asks, setAsks] = useState<{size: number, price: number}[]>([])
    const [bids, setBids] = useState<{size: number, price: number}[]>([])

    async function updateOrderBook() {
        if (!program) {
            return;
        }
        const [orderbook, eventQueue, asks, bids] = await getMarketAccounts(program)
        const connection = program.provider.connection;
        const marketData = await MarketState.retrieve(connection, orderbook, 'confirmed')
        const askData = await marketData.loadAsksSlab(connection, 'confirmed')
        const bidData = await marketData.loadBidsSlab(connection, 'confirmed')

        setAsks(askData.getL2DepthJS(10, true));
        setBids(bidData.getL2DepthJS(10, false));
    }

    async function registerChanges() {
        const [orderbook, eventQueue, asks, bids] = await getMarketAccounts(program)
        program.provider.connection.onAccountChange(orderbook, updateOrderBook, 'confirmed');
    }

    useEffect(() => {
        updateOrderBook();
        if (program) {
            registerChanges();
        }
    }, [program])

    return (
        <antd.Card>
            <antd.Row gutter={{ xs: 8, sm: 16, md: 24, lg: 32 }}>
                <antd.Col className="gutter-row" span={6}>
                    <antd.Card title="Asks">
                        {asks.map( ({price, size}) => (
                            <antd.Row key={price + ''}>{size} with {price}% interest</antd.Row> 
                        ))}
                    </antd.Card>
                </antd.Col>
                <antd.Col className="gutter-row" span={6}>
                    <antd.Card title="Bids">
                        {bids.map( ({price, size}) => (
                            <antd.Row key={price + ''}>{size} with {price}% interest</antd.Row> 
                        ))}
                    </antd.Card>
                </antd.Col>
            </antd.Row>
        </antd.Card>
    )
}


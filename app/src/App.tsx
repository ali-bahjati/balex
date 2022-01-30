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
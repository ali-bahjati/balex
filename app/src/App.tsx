import { WalletAdapterNetwork, WalletNotConnectedError } from '@solana/wallet-adapter-base';
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

import 'antd/dist/antd.css';
import './index.css';

import { Layout } from 'antd';
import * as antd from 'antd';
import React, { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Balex } from './types/balex';
import balexIdl from './idl/balex.json';
import { MarketState } from '@bonfida/aaob';
import { Slab } from '@bonfida/aaob';

import { IdlAccounts, Program } from '@project-serum/anchor';

const { Header, Content } = Layout;

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

const programId = new anchor.web3.PublicKey(balexIdl.metadata.address);
const lexMarketPubkey = new anchor.web3.PublicKey('4UE8cJmTcf4M6S6yN1aQjyN6ty5Zf5WPA9KZWkweqWmG');

function getProgram(wallet: AnchorWallet): anchor.Program<Balex> {
    const program: anchor.Program<Balex> = new anchor.Program<Balex>(balexIdl as any, programId, getProvider(wallet));
    return program;
}

async function getUserAccount(wallet: AnchorWallet): Promise<[anchor.web3.PublicKey, number]> {
    return await anchor.web3.PublicKey.findProgramAddress(
        [lexMarketPubkey.toBuffer(), wallet.publicKey.toBuffer()],
        programId
    );
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
            </div>
        </div>
    );
};

export const StubOracle = () => {
    const [price, setPrice] = useState<number>(0);
    const [suggested_price, setSuggestedPrice] = useState<number>(0);
    const wallet = useAnchorWallet();

    const stubOracle = anchor.web3.Keypair.fromSecretKey(
        new Uint8Array([
            159, 65, 51, 122, 97, 218, 39, 176, 238, 15, 165, 124, 223, 116, 97, 26, 5, 156, 221, 182, 69, 222, 82, 180,
            197, 217, 231, 160, 92, 139, 245, 152, 160, 56, 217, 37, 95, 196, 147, 165, 2, 177, 135, 146, 249, 147, 194,
            188, 167, 204, 4, 189, 173, 34, 226, 73, 236, 201, 141, 22, 23, 195, 8, 134,
        ])
    );

    async function applySuggestedPrice() {
        if (wallet) {
            const program = getProgram(wallet);
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
        if (wallet) {
            const program = getProgram(wallet);
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
    }, [wallet]);

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

    const [userAccount, setUserAccount] = useState<anchor.IdlAccounts<Balex>['userAccount']>(null);

    async function loadUserAccount() {
        const program = getProgram(wallet);
        const account = await program.account.userAccount.fetchNullable((await getUserAccount(wallet))[0]);
        if (account) {
            setUserAccount(account);
        }
    }
    async function createUserAccount() {
        const program = getProgram(wallet);
        const [userPub, bump] = await getUserAccount(wallet);

        await program.rpc.initializeAccount(bump, {
            accounts: {
                market: lexMarketPubkey,
                owner: wallet.publicKey,
                userAccount: userPub,
                systemProgram: anchor.web3.SystemProgram.programId,
            },
        });

        setUserAccount(await program.account.userAccount.fetch(userPub));
    }

    useEffect(() => {
        if (wallet) {
            loadUserAccount();
        }
    }, [wallet]);

    if (userAccount) {
        return (
            <antd.Card title="User Account">
                Your Total Quote is {userAccount.quoteTotal.toNumber()} and Base Free is{' '}
                {userAccount.baseFree.toNumber()}.
                {userAccount.baseOpenBorrow.toNumber() && (
                    <div>
                        <br />
                        Open value to borrow is {userAccount.baseOpenBorrow.toNumber()}
                    </div>
                )}
                {userAccount.baseOpenLend.toNumber() && (
                    <div>
                        <br />
                        Open value to lend is {userAccount.baseOpenLend.toNumber()}
                    </div>
                )}
                {userAccount.baseLocked.toNumber() && (
                    <div>
                        <br />
                        Open value to lend is {userAccount.baseLocked.toNumber()}
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

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
import { getUserAccount, useInterval, useProgram } from './utils';
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
    const [userExists, setUserExists] = useState<boolean>(false);

    async function loadUserAccount() {
        const account = await program.account.userAccount.fetchNullable((await getUserAccount(wallet))[0]);
        console.log(account);
        if (account) {
            setUserAccount(account);
            setUserExists(true);
        }
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
        if (userExists) {
            registerUserChangeHook();
        }
    }, [userExists]);

    if (!wallet) {
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
                <Account userAccount={userAccount} loadUserAccount={loadUserAccount}/>
                <div style={{ marginTop: '10px' }}></div>
                <StubOracle />
            </div>
        </div>
        )
    }
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
                <Account userAccount={userAccount} loadUserAccount={loadUserAccount}/>
                <div style={{ marginTop: '10px' }}></div>
                <StubOracle />
            </div>
        </div>
    );
};

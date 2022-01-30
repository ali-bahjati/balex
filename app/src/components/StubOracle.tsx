import { IdlAccounts } from '@project-serum/anchor';
import { useAnchorWallet } from '@solana/wallet-adapter-react';
import React, { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Balex } from '../types/balex';
import { getMarketAccounts, getUserAccount, useProgram } from '../utils';
import * as anchor from '@project-serum/anchor';
import { lexMarketPubkey, stubOracle } from '../settings';

export default function StubOracle() {
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
        <div className='card'>
            <div className='title'>Stub Price Oracle</div>

            <div className='text'>
                <span className='label'>Current price</span>
                <span className='value'>{price}</span>
            </div>
            <div className='text'>
                <span className='label'>Amount to set</span>
                <input defaultValue={suggested_price} onChange={(e) => setSuggestedPrice(parseInt(e.target.value))} />
            </div>

            <div className='flex mt-5'>
                <button onClick={() => applySuggestedPrice()}>Set Price</button>
            </div>
        </div>
    )
}

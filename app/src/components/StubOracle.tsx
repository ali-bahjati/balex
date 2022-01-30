import { IdlAccounts } from '@project-serum/anchor';
import { useAnchorWallet } from '@solana/wallet-adapter-react';
import React, { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {Balex} from '../types/balex';
import { getMarketAccounts, getUserAccount, useProgram } from '../utils';
import * as anchor from '@project-serum/anchor';
import { lexMarketPubkey, stubOracle } from '../settings';

 export default function NewOrder({userAccount}: {userAccount: IdlAccounts<Balex>['userAccount']}) {
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
        <div className='card'>
            <div className='title'>Stub Price Oracle</div>

            <div className='text'>
                <span className='label'>Current price</span>
                <span className='value'>0</span>
            </div>
            <div className='text'>
                <span className='label'>Amount to set</span>
                <input defaultValue={rate} onChange={(e) => setRate(parseInt(e.target.value))} />
            </div>

            <div className='flex mt-5'>
                <button onClick={() => newOrder(0)}>Set Price</button>
            </div>
        </div>
    )
}

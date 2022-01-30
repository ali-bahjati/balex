import React, { useState, useEffect } from 'react';
import Divider from './Divider';
import { GiPayMoney } from "@react-icons/all-files/gi/GIPayMoney";
import { IdlAccounts } from '@project-serum/anchor';
import { Balex } from '../types/balex';
import { useAnchorWallet } from '@solana/wallet-adapter-react';
import { DebtType, getDebtAsOfNow, getMarketAccounts, getUserAccount, useInterval, useProgram } from '../utils';
import * as anchor from '@project-serum/anchor';
import { getPriceFromKey, MarketState } from '@bonfida/aaob';
import { lexMarketPubkey, programId } from '../settings';
import { PublicKey } from '@solana/web3.js';

export default function OpenDebts({userAccount}: {userAccount: IdlAccounts<Balex>['userAccount']}) {
    const wallet = useAnchorWallet();
    const program = useProgram(wallet);

    type DebtRow = {
        'id': number,
        'type': string,
        'qty': number,
        'interest': number,
        'liquid_qty': number
        'remaining': number,
    }

    async function settleDown(debt_id: number) {
        let marketData = await program.account.lexMarket.fetch(lexMarketPubkey);
        let debt: DebtType = marketData.debts[debt_id]
        let [borrowAccount, bump] = await getUserAccount(wallet)
        //Make sure user has balance (but not right now), or error if doesn't
        const lenderAccount =  (await PublicKey.findProgramAddress(
            [lexMarketPubkey.toBuffer(), debt.lender.toBuffer()], programId
        ))[0];
        console.log(lenderAccount.toString())
        await program.rpc.settleDebt(bump, debt_id, {
            accounts: {
                owner: wallet.publicKey,
                borrowerAccount: borrowAccount,
                lenderAccount: lenderAccount,
                market: lexMarketPubkey
            }
        })
    }

    const [debts, setDebts] = useState<DebtRow[]>([])

    async function updateDebts() {
        let marketData = await program.account.lexMarket.fetch(lexMarketPubkey);
        console.log(marketData.debts)

        let curr_debts: DebtRow[] = []
        for (let i = 0; i < userAccount.openDebtsCnt; i++) {
            let debt_id = userAccount.openDebts[i];
            let debt: DebtType = marketData.debts[debt_id]
            console.log(debt);

            curr_debts.push( {
                id: debt_id,
                type: (debt.borrower.equals(wallet.publicKey) ? 'Borrow': 'Lend'),
                qty: debt.qty.toNumber(),
                interest: debt.interestRate.toNumber(),
                liquid_qty: debt.liquidQty.toNumber(),
                remaining: getDebtAsOfNow(debt)
            })
        }

        setDebts(curr_debts);
    }

    useEffect(() => {
        updateDebts();
    }, [userAccount])
    useInterval(() => {
        updateDebts();
    }, 5000)



    return (
        <div className='card' style={{ flex: '1', minHeight: '320px', display: 'flex', justifyContent: 'start' }}>
            <div className='title'>Open Debts</div>

            <div className='text'>
                <span className='label'>Type</span>
                <span className='label'>Amount</span>
                <span className='label'>Interest Rate</span>
                <span className='label'>Liquidated Amount</span>
                <span className='label'>Amount To Receive/Pay</span>
                <span className='label'>Settle</span>
            </div>

            <Divider marginTop='0px' />

            { debts.map( (debt) => (

            <div key={debt.id} className='text'>
                <span className='label'>{debt.type}</span>
                <span className='label'>{debt.qty}</span>
                <span className='label'>{debt.interest}%</span>
                <span className='label'>{debt.liquid_qty}</span>
                <span className='label'>{debt.remaining}</span>
                <span className='label'>
                { debt.type == "Borrow" && 
                    <span className='label'><GiPayMoney style={{ color: 'white', cursor: 'pointer' }} onClick={() => settleDown(debt.id)} /></span>
                }   
                </span>
            </div>
            ))}

        </div>
    )
}

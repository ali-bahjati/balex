import React, { useEffect, useState } from 'react';
import Divider from './Divider';
import { Balex } from '../types/balex';
import { IdlAccounts, Program } from '@project-serum/anchor';
import { useAnchorWallet } from '@solana/wallet-adapter-react';
import { getUserAccount, getUserStat, useInterval, useProgram } from '../utils';
import * as anchor from '@project-serum/anchor';
import { lexMarketPubkey } from '../settings';
import { UserToken } from './UserToken';


const Account = ({userAccount, loadUserAccount}: {userAccount: IdlAccounts<Balex>['userAccount'], loadUserAccount: any}) => {
    const wallet = useAnchorWallet();
    const program = useProgram(wallet);

    const [userStat, setUserStat] = useState<[number, number, number, number]>([0, 0, 0, 0]);
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


    async function updateUserStat() {
        setUserStat(await getUserStat(userAccount, program))
    }

    useEffect(() => {
        if(userAccount) {
            updateUserStat();
        }
    }, [userAccount])

    useInterval(() => updateUserStat(), 5000);

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


    if (!wallet) {
        return (
            <div className='card'>
                <div className='title'>Account</div>
                <div className='text'>
                    <span className='label'>Please connect wallet first!</span>
                </div>
            </div>
        )
    }
    if (!userAccount) {
        return (
            <div className='card'>
                <div className='title'>Account</div>
                <div className='text'>
                    <button onClick={createUserAccount}>Create User Account</button>
                </div>
            </div>
        )
    }
    return (
        <div className='card'>
            <div className='title'>Account</div>
            <div className='text'>
                <span className='label'>BTC:</span>
                <span className='value'>{userAccount.quoteTotal.toNumber()}</span>
                <span style={{marginRight: '25px'}}></span>
                <span className='label'>USDT:</span>
                <span className='value'>{userAccount.baseFree.toNumber()}</span>
            </div>
            <div className='text'>
            </div>
            <div className='text'>
                <span className='label'>Health:</span>
                <span className={'value ' + (userStat[0] >= 100? 'clr-green': 'clr-red')}>{userStat[0].toFixed(0)}</span>
            </div>
            <div className='text'>
                <span className='label'>Total lended USDT:</span>
                <span className='value'>{userAccount.baseLocked.toNumber()}</span>
            </div>
            <div className='text'>
                <span className='label'>Max BTC withdraw:</span>
                <span className='value'>{userStat[1].toFixed(0)}</span>
            </div>
            <div className='text'>
                <span className='label'>Max USDT borrow:</span>
                <span className='value'>{userStat[2].toFixed(0)}</span>
            </div>
            <div className='text'>
                <span className='label'>Total USDT debt as of now:</span>
                <span className='value'>{userStat[3].toFixed(0)}</span>
            </div>

            {market && 
                (<UserToken name='BTC' mint={market.quoteMint} vault={market.quoteVault}  />)}
            {market && 
                (<UserToken name='USDT' mint={market.baseMint} vault={market.baseVault}  />)}
        </div>
    )
}

export default Account;

import React, { useEffect } from 'react';
import Divider from './Divider';
import { Balex } from '../types/balex';
import { IdlAccounts, Program } from '@project-serum/anchor';



const Account = ({userAccount}: {userAccount: IdlAccounts<Balex>['userAccount']}) => {
    useEffect(() => {0}, [userAccount]);

    if (!userAccount) {
        return <div></div>
    }
    return (
        <div className='card'>
            <div className='title'>Account</div>
            <div className='text'>
                <span className='label'>BTC:</span>
                <span className='value'>{userAccount.quoteTotal.toNumber()}</span>
            </div>
            <div className='text'>
                <span className='label'>USDT:</span>
                <span className='value'>{userAccount.baseFree.toNumber()}</span>
            </div>
            <div className='text'>
                <span className='label'>Open value to lend:</span>
                <span className='value'>0</span>
            </div>

            <Divider title='BTC' />

            <div className='text'>
                <span className='label'>Your balance</span>
                <span className='value'>0</span>
            </div>
            <div className='text'>
                <span className='label'>Amount</span>
                <input value={0} />
            </div>

            <div className='flex my-5'>
                <button>Mint</button>
                <button className='mx-5'>Deposit</button>
                <button>Withdraw</button>
            </div>

            <Divider title='USDT' />

            <div className='text'>
                <span className='label'>Your balance</span>
                <span className='value'>0</span>
            </div>
            <div className='text'>
                <span className='label'>Amount</span>
                <input value={0} />
            </div>

            <div className='flex my-5'>
                <button>Mint</button>
                <button className='mx-5'>Deposit</button>
                <button>Withdraw</button>
            </div>
        </div>
    )
}

export default Account;

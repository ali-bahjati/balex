import React, { useEffect, useState } from 'react';
import Divider from './Divider';
import { Balex } from '../types/balex';
import { IdlAccounts, Program } from '@project-serum/anchor';
import { useAnchorWallet } from '@solana/wallet-adapter-react';
import { getMarketSinger, getUserAccount, getUserStat, useInterval, useProgram } from '../utils';
import * as anchor from '@project-serum/anchor';
import * as spl_token from '@solana/spl-token';
import { admin, lexMarketPubkey, stubOracle } from '../settings';
import { PublicKey, Transaction } from '@solana/web3.js';

export const UserToken = ({ name, mint, vault }: { name: string, mint: PublicKey, vault: PublicKey }) => {
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
        return (
            <div>
                <div className='text'>
                    <span className='label'>Please connect your wallet!</span>
                </div>
            </div>
            )
    } else if (!userTokenExists) {
        return (
            <div>
                <Divider title={name} />

                <div className='flex my-5'>
                    <button onClick={createTokenAccount}>Create {name} Associated Token Account</button>
                </div>
            </div>
        )
    } else {
        return (
            <div>
                <Divider title={name} />

                <div className='text'>
                    <span className='label'>Your balance</span>
                    <span className='value'>{tokenBalance}</span>
                </div>
                <div className='text' style={{marginBottom: '10px'}}>
                    <span className='label'>Amount</span>
                    <input defaultValue={amount} onChange={(e) => setAmount(parseInt(e.target.value))} />
                </div>

                <div className='flex my-5'>
                    <button onClick={mintToken}>Mint</button>
                    <button onClick={deposit} className='mx-5'>Deposit</button>
                    <button onClick={withdraw}>Withdraw</button>
                </div>
            </div>
        )
    }
}
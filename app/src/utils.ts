import { AnchorWallet } from "@solana/wallet-adapter-react";
import { Balex } from "./types/balex";
import * as anchor from '@project-serum/anchor';
import { useEffect, useMemo, useRef } from "react";
import balexIdl from './idl/balex.json';
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { clusterApiUrl, PublicKey } from "@solana/web3.js";
import { lexMarketPubkey, programId } from "./settings";
import { IdlAccounts, Program } from "@project-serum/anchor";
import { getPriceFromKey, MarketState } from '@bonfida/aaob';

export function getProvider(wallet: AnchorWallet) {
    /* create the provider and return it to the caller */
    /* network set to local network for now */
    const network = WalletAdapterNetwork.Devnet;

    const endpoint = clusterApiUrl(network);

    const connection = new anchor.web3.Connection(endpoint, 'confirmed');

    const provider = new anchor.Provider(connection, wallet, 'confirmed' as any);
    return provider;
}

export function useProgram(wallet: AnchorWallet): anchor.Program<Balex> {
    return useMemo(() => {
        console.log(wallet);
        if (!wallet) {
            return null;
        }
        console.log(wallet);
        const program: anchor.Program<Balex> = new anchor.Program<Balex>(balexIdl as any, programId, getProvider(wallet));
        console.log("HI" + program);
        return program;
    }, [wallet]);
}


export function useInterval(callback, delay) {
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

export async function getUserAccount(wallet: AnchorWallet): Promise<[PublicKey, number]> {
    return await PublicKey.findProgramAddress(
        [lexMarketPubkey.toBuffer(), wallet.publicKey.toBuffer()],
        programId
    );
}

export async function getMarketSinger() {
    return (await PublicKey.findProgramAddress([lexMarketPubkey.toBytes()], programId))[0]
}

export async function getMarketAccounts(program: Program<Balex>): Promise<[PublicKey, PublicKey, PublicKey, PublicKey]> {
    const marketData = await program.account.lexMarket.fetch(lexMarketPubkey);

    const orderbook = marketData.orderbook;

    const orderbookData = await MarketState.retrieve(program.provider.connection, orderbook, 'confirmed')

    return [orderbook, orderbookData.eventQueue, orderbookData.asks, orderbookData.bids];
}

export type DebtType = {
    borrower: PublicKey,
    lender: PublicKey,
    interestRate: anchor.BN,
    liquidQty: anchor.BN,
    qty: anchor.BN,
    timestamp: anchor.BN
}

export function getDebtAsOfNow(debt: DebtType): number {
    let diff_timestamp = Date.now()/1000 - debt.timestamp.toNumber();
    let nowDebt = debt.qty.toNumber();
    console.log(diff_timestamp);
    console.log(nowDebt);
    nowDebt = nowDebt + diff_timestamp*debt.interestRate.toNumber() / (60*60*100)
    nowDebt = Math.ceil(nowDebt);
    return nowDebt - debt.liquidQty.toNumber(); 
}

export async function getTotalDebtToPay(userAccount: IdlAccounts<Balex>['userAccount'], program: Program<Balex>): Promise<number> {
    let marketData = await program.account.lexMarket.fetch(lexMarketPubkey);

    let totalDebt: number = 0;
    for (let i = 0; i < userAccount.openDebtsCnt; i++) {
        let debt_id = userAccount.openDebts[i];
        let debt: DebtType = marketData.debts[debt_id]
        totalDebt +=  getDebtAsOfNow(debt);
    }

    return totalDebt;
}

export async function getOraclePrice(oracle: PublicKey, type: any, program: Program<Balex>): Promise<number> {
    // Only stub oracle for now
    let stubData = await program.account.stubPrice.fetch(oracle);
    return stubData.price.toNumber();
}

// returns health, max withdraw, max borrow
export async function getUserStat(userAccount: IdlAccounts<Balex>['userAccount'], program: Program<Balex>): Promise<[number, number, number]> {
    let marketData = await program.account.lexMarket.fetch(lexMarketPubkey);
    let totalDebt = await getTotalDebtToPay(userAccount, program);


    let price = await getOraclePrice(marketData.priceOracle, marketData.oracleType, program);

    let maxBorrow = 100 * userAccount.quoteTotal.toNumber() * price / (100 + marketData.overCollateralPercent) - totalDebt;

    if (totalDebt < 1) {
        return [100, marketData.quoteTotal.toNumber(), maxBorrow];
    }

    let maxWithdraw = userAccount.quoteTotal.toNumber() - (totalDebt * (100 + marketData.overCollateralPercent)/(100*price)) 
    let health = 10000 * userAccount.quoteTotal.toNumber() * price / (totalDebt * (100 + marketData.overCollateralPercent/2))

    health = Math.floor(health);

    return [health, maxWithdraw, maxBorrow];
}

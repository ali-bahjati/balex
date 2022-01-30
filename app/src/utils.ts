import { AnchorWallet } from "@solana/wallet-adapter-react";
import { Balex } from "./types/balex";
import * as anchor from '@project-serum/anchor';
import { useEffect, useMemo, useRef } from "react";
import balexIdl from './idl/balex.json';
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { clusterApiUrl, PublicKey } from "@solana/web3.js";
import { lexMarketPubkey, programId } from "./settings";
import { Program } from "@project-serum/anchor";
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
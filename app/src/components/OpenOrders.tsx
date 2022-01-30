import React, { useState, useEffect } from 'react';
import Divider from './Divider';
import { AiOutlineDelete } from "react-icons/ai";
import { IdlAccounts } from '@project-serum/anchor';
import { Balex } from '../types/balex';
import { useAnchorWallet } from '@solana/wallet-adapter-react';
import { getMarketAccounts, getUserAccount, useInterval, useProgram } from '../utils';
import * as anchor from '@project-serum/anchor';
import { getPriceFromKey, MarketState } from '@bonfida/aaob';
import { lexMarketPubkey } from '../settings';

export default function OpenOrders({ userAccount }: { userAccount: IdlAccounts<Balex>['userAccount'] }) {
    const wallet = useAnchorWallet();
    const program = useProgram(wallet);

    type OrderType = { type: string, size: number, price: number, order_id: anchor.BN }

    const [openOrders, setOpenOrders] = useState<OrderType[]>([])

    async function updateOrders() {
        const [orderbook, eventQueue, asks, bids] = await getMarketAccounts(program)
        const connection = program.provider.connection;
        const marketData = await MarketState.retrieve(connection, orderbook, 'confirmed')
        const askData = await marketData.loadAsksSlab(connection, 'confirmed')
        const bidData = await marketData.loadBidsSlab(connection, 'confirmed')

        let openOrders: OrderType[] = []
        for (let i = 0; i < userAccount.openOrdersCnt; i++) {
            const order_id = userAccount.openOrders[i]

            let askNode = askData.getNodeByKey(order_id as any);
            if (askNode) {
                let size = askNode.baseQuantity.toNumber()
                openOrders.push({ type: "Lend", price: getPriceFromKey(order_id).toNumber(), order_id: order_id, size: size })
            } else {
                let bidNode = bidData.getNodeByKey(order_id as any);
                if (bidNode) {
                    let size = bidNode.baseQuantity.toNumber()
                    openOrders.push({ type: "Borrow", price: getPriceFromKey(order_id).toNumber(), order_id: order_id, size: size })
                } else {
                    console.log("Strange!");
                    continue;
                }
            }
        }

        openOrders.sort((a, b) => a.price - b.price)

        setOpenOrders(openOrders);
    }

    async function registerChanges() {
        const [orderbook, eventQueue, asks, bids] = await getMarketAccounts(program)
        program.provider.connection.onAccountChange(orderbook, updateOrders, 'confirmed');
        program.provider.connection.onAccountChange(bids, updateOrders, 'confirmed');
        program.provider.connection.onAccountChange(asks, updateOrders, 'confirmed');
    }

    useEffect(() => {
        updateOrders();
    }, [userAccount])

    useInterval(updateOrders, 5000)

    async function cancelOrder(order_id: anchor.BN) {
        const [userPub, bump] = await getUserAccount(wallet);
        const [orderbook, eventQueue, asks, bids] = await getMarketAccounts(program)
        program.rpc.cancelMyOrder(bump, order_id, {
            accounts: {
                market: lexMarketPubkey,
                owner: wallet.publicKey,
                userAccount: userPub,
                orderbook: orderbook,
                eventQueue: eventQueue,
                asks: asks,
                bids: bids,
                systemProgram: anchor.web3.SystemProgram.programId
            }
        });
    }

    return (
        <div className='card' style={{ flex: '1', minHeight: '320px', display: 'flex', justifyContent: 'start' }}>
            <div className='title'>Open Orders</div>

            <div className='text'>
                <span className='label' style={{ flex: 3 }}>Order</span>
                <span className='label' style={{ flex: 3 }}>Amount</span>
                <span className='label' style={{ flex: 5 }}>Interest Rate</span>
                <span className='label' style={{ flex: 2, display: 'flex', justifyContent: 'center' }}>Cancel</span>
            </div>

            <Divider marginTop='0px' />

            {openOrders.map((order: OrderType) =>
            (
                <div key={order.order_id.toString()} className='flex mt-5'>
                    <span className={"label " + (order.type == "Lend" ? "clr-red" : "clr-green")} style={{ flex: 3 }}>{order.type}</span>
                    <span className='label' style={{ flex: 3 }}>{order.size}</span>
                    <span className='label' style={{ flex: 5 }}>{order.price}%</span>
                    <span className='label' style={{ flex: 2, display: 'flex', justifyContent: 'center' }}><AiOutlineDelete style={{ color: 'white', cursor: 'pointer' }} onClick={() => cancelOrder(order.order_id)} /></span>
                </div>
            )
            )}
        </div>
    )
}

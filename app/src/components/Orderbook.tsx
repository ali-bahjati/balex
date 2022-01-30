import { MarketState } from '@bonfida/aaob';
import { useAnchorWallet } from '@solana/wallet-adapter-react';
import React, { useEffect, useState } from 'react';
import { getMarketAccounts, useProgram } from '../utils';
import Divider from './Divider';

export default function OpenOrders() {
     const wallet = useAnchorWallet();
     const program = useProgram(wallet);

     type OrderRow = { bidPercent: number, bidSize: number, bidPrice: number, askPrice: Number, askSize: number, askPercent: number}

     const [orders, setOrders] = useState<OrderRow[]>([])

     async function updateOrderBook() {
         if (!program) {
             return;
         }
         const [orderbook, eventQueue, asks, bids] = await getMarketAccounts(program)
         const connection = program.provider.connection;
         const marketData = await MarketState.retrieve(connection, orderbook, 'confirmed')
         const askData = await marketData.loadAsksSlab(connection, 'confirmed')
         const bidData = await marketData.loadBidsSlab(connection, 'confirmed')

         const bidList = bidData.getL2DepthJS(10, false);
         const askList = askData.getL2DepthJS(10, true);

         let sizeSum = 0;
         bidList.forEach(bid => {
             sizeSum += bid.size;
         });
         askList.forEach(ask => {
             sizeSum += ask.size;
         });

         let bidCurSum = 0;
         let askCurSum = 0;

         const orders = []
         for (let i = 0; i < Math.max(bidList.length, askList.length); i++) {
             const order: OrderRow = { bidPercent: 0, bidSize: null, bidPrice: null, askPrice: null, askSize: null, askPercent: 0 };
             if (i < bidList.length) {
                 bidCurSum += bidList[i].size;

                 order.bidPrice = bidList[i].price;
                 order.bidSize = bidList[i].size;
                 order.bidPercent = bidCurSum / sizeSum * 100;
             }
             if (i < askList.length) {
                 askCurSum += askList[i].size;

                 order.askPrice = askList[i].price;
                 order.askSize = askList[i].size;
                 order.askPercent = askCurSum / sizeSum * 100;
             }
             orders.push(order);
         }

         console.log(orders);

         setOrders(orders);
    }

     async function registerChanges() {
         const [orderbook, eventQueue, asks, bids] = await getMarketAccounts(program)
         program.provider.connection.onAccountChange(orderbook, updateOrderBook, 'confirmed');
         program.provider.connection.onAccountChange(bids, updateOrderBook, 'confirmed');
         program.provider.connection.onAccountChange(asks, updateOrderBook, 'confirmed');
     }

     useEffect(() => {
         updateOrderBook();
         if (program) {
             registerChanges();
         }
     }, [program])

    const styleFlex = {
        display: 'flex',
        flex: '1',
        fontSize: 'small',
    };

    const styleTextEnd = {
        justifyContent: 'end',
    };

    return (
        <div className='card' style={{ flex: '1', minHeight: '200px', display: 'flex', justifyContent: 'start' }}>
            <div className='title'>Orderbook</div>

            <div className='text'>
                <div className='label'>Amount</div>
                <div className='label' style={{ justifyContent: 'center' }}>Rate</div>
                <div className='label' style={{ justifyContent: 'end' }}>Amount</div>
            </div>

            <Divider marginTop='0px' />

            {orders.map( (order: OrderRow, index: number) => (
                <div key={index} className='text'>
                    <div style={styleFlex}>{order.bidSize}</div>
                    <div className='clr-green' style={{ ...styleFlex, marginRight: '3px', ...styleTextEnd }}>{order.bidPrice}</div>
                    <div className='clr-grey-dark'>|</div>
                    <div className='clr-red' style={{ ...styleFlex, marginLeft: '3px' }}>{order.askPrice}</div>
                    <div style={{ ...styleFlex, ...styleTextEnd }}>{order.askSize}</div>
                </div>
                )
            )}

        </div>
    )
}
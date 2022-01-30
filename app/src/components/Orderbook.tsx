import React from 'react';
import Divider from './Divider';

export default function OpenOrders() {
    return (
        <div className='card' style={{ flex: '1', minHeight: '200px', display: 'flex', justifyContent: 'start' }}>
            <div className='title'>Orderbook</div>

            <div className='text'>
                <div className='label'>Amount</div>
                <div className='label' style={{ justifyContent: 'center' }}>Rate</div>
                <div className='label' style={{ justifyContent: 'end' }}>Amount</div>
            </div>

            <Divider marginTop='0px'/>
        </div>
    )
}
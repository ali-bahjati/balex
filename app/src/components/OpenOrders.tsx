import React from 'react';
import Divider from './Divider';

export default function OpenOrders() {
    return (
        <div className='card' style={{ flex: '1', minHeight: '400px', display: 'flex', justifyContent: 'start' }}>
            <div className='title'>Open Orders</div>

            <div className='text'>
                <span className='label'>Order</span>
                <span className='label'>Amount</span>
                <span className='label'>Interest Rate</span>
                <span className='label'></span>
            </div>

            <Divider />
        </div>
    )
}

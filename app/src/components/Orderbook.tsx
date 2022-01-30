import React from 'react';
import Divider from './Divider';

export default function OpenOrders() {
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

            <div className='text'>
                <div style={styleFlex}>0</div>
                <div className='clr-green' style={{ ...styleFlex, marginRight: '3px', ...styleTextEnd }}>1</div>
                <div className='clr-grey-dark'>|</div>
                <div className='clr-red' style={{ ...styleFlex, marginLeft: '3px'}}>1</div>
                <div style={{ ...styleFlex, ...styleTextEnd }}>0</div>
            </div>
        </div>
    )
}
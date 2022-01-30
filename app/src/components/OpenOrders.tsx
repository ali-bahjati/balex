import React from 'react';
import Divider from './Divider';
import { AiOutlineDelete } from "@react-icons/all-files/ai/AiOutlineDelete";

export default function OpenOrders() {
    return (
        <div className='card' style={{ flex: '1', minHeight: '200px', display: 'flex', justifyContent: 'start' }}>
            <div className='title'>Open Orders</div>

            <div className='text'>
                <span className='label'>Order</span>
                <span className='label'>Amount</span>
                <span className='label'>Interest Rate</span>
                <span className='label'></span>
            </div>

            <Divider marginTop='0px' />

            <div className='flex mt-5'>
                <span className='label' style={{ color: 'green' }}>Lend</span>
                <span className='label'>200</span>
                <span className='label'>3%</span>
                <span className='label'><AiOutlineDelete style={{ color: 'red', cursor: 'pointer' }} /></span>
            </div>
            <div className='flex mt-5'>
                <span className='label' style={{ color: 'orange' }}>Borrow</span>
                <span className='label'>100</span>
                <span className='label'>6%</span>
                <span className='label'><AiOutlineDelete style={{ color: 'red', cursor: 'pointer' }} /></span>
            </div>
        </div>
    )
}

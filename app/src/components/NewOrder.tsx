import React from 'react';

export default function NewOrder() {
    return (
        <div className='card mx-10'>
            <div className='title'>New Order</div>

            <div className='text'>
                <span className='label'>Amount</span>
                <input value={0} />
            </div>
            <div className='text'>
                <span className='label'>Interest rate</span>
                <input value={0} />
            </div>

            <div className='flex mt-5'>
                <button>Borrow</button>
                <button className='ml-5'>Lend</button>
            </div>
        </div>
    )
}

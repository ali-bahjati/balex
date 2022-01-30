import React from 'react';

function Divider(props = { title: 'title' }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', marginTop: '15px' }}>
            <div style={{ backgroundColor: '#3B3D41', height: '1px', flex: '1' }}></div>
            <div style={{ color: '#e5e3ec', margin: '0px 15px', fontSize: 'small', display: props.title.length ? '' : 'none' }}>{props.title}</div>
            <div style={{ backgroundColor: '#3B3D41', height: '1px', flex: '1' }}></div>
        </div>
    )
}

Divider.defaultProps = {
    title: ''
}

export default Divider;

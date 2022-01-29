# BaLeX

Decentralized Borrow and Lend platform which you choose your own risk and reward!

Built on top of serum-core (aaob) and Pyth oracle.

## Setup
Build app using anchor build and deploy on your network (localnet or devnet). Make sure to also modify react app network according to it. 

The run `anchor run setup` to setup some market accounts for the program. Use the output to fill required data for the react app. 

To run react app run `yarn start` (If requires build it).

For cranker and liquidator see their folders.

Currently only Phantom and Sollet extension wallets are supported.
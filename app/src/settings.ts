import * as anchor from '@project-serum/anchor';
import { PublicKey } from '@solana/web3.js';
import balexIdl from './idl/balex.json';

export const programId = new PublicKey(balexIdl.metadata.address);
export const lexMarketPubkey = new PublicKey('BkBNRBCxYic4ZrmUGNLasm2FNJw25PbmhfjcChK5D2GE');

export const admin = anchor.web3.Keypair.fromSecretKey(new Uint8Array([
    108, 38, 107, 182, 51, 43, 128, 137, 35, 240, 23,
    174, 102, 51, 10, 255, 156, 179, 109, 42, 238, 99,
    14, 237, 85, 34, 172, 211, 126, 239, 202, 90, 11,
    148, 123, 175, 92, 85, 159, 13, 151, 70, 127, 142,
    100, 41, 117, 55, 54, 67, 59, 49, 52, 6, 92,
    240, 83, 236, 155, 161, 52, 91, 51, 246
]));

export const stubOracle = anchor.web3.Keypair.fromSecretKey(
    new Uint8Array([
        145, 104, 65, 171, 46, 67, 64, 252, 60, 118, 148,
        44, 18, 145, 188, 173, 150, 230, 56, 202, 17, 188,
        16, 243, 180, 56, 133, 63, 126, 15, 188, 52, 202,
        223, 160, 168, 184, 60, 186, 188, 21, 119, 68, 6,
        142, 204, 110, 254, 245, 90, 84, 34, 86, 101, 139,
        32, 115, 139, 236, 182, 100, 56, 4, 172
    ])
);

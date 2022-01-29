import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { Balex } from '../target/types/balex';
import * as spl_token from '@solana/spl-token';
import * as aaob from "@bonfida/aaob";
import { Keypair, PublicKey } from '@solana/web3.js';

const provider = anchor.Provider.env();
anchor.setProvider(provider);

const program = anchor.workspace.Balex as Program<Balex>;
const connection = provider.connection;

const admin = Keypair.fromSecretKey(new Uint8Array([
    108,  38, 107, 182,  51,  43, 128, 137,  35, 240,  23,
    174, 102,  51,  10, 255, 156, 179, 109,  42, 238,  99,
     14, 237,  85,  34, 172, 211, 126, 239, 202,  90,  11,
    148, 123, 175,  92,  85, 159,  13, 151,  70, 127, 142,
    100,  41, 117,  55,  54,  67,  59,  49,  52,   6,  92,
    240,  83, 236, 155, 161,  52,  91,  51, 246
]))

const mintAddr = new PublicKey("6QtMNWMh11jjnmB1cumpC8mvobhsTKkFYkXafYfoWhjy")
const userToken = new PublicKey("8bDx68KihyUJnCUNP4pKpLiVaTffkYj7bAvSafaniPeX")

const mint = async () => {
    const connection = program.provider.connection;
    const mintToken = new spl_token.Token(connection, mintAddr, spl_token.TOKEN_PROGRAM_ID, admin)
    await mintToken.mintTo(userToken, admin.publicKey, [admin], 1000)
}

mint();
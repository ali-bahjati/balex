use anchor_lang::prelude::*;
use anchor_lang::{AnchorDeserialize, AnchorSerialize};
use pyth_client::{load_price, PriceStatus};

pub static CALLBACK_INFO_LEN: u64 = 32;
pub static CALLBACK_ID_LEN: u64 = 32;


#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
#[repr(u8)]
pub enum OracleType {
    Stub, // Stub will be only similar to PriceInfo of Pyth as data of the price account
    Pyth
}

// TODO: Complete it as we go
#[account]
#[derive(Default)]
pub struct StubPrice {
  /// the current price
  pub price: i64,
  /// confidence interval around the price
  pub conf: u64,
}

#[account]
pub struct LexMarket {
    pub base_mint: Pubkey,
    pub qoute_mint: Pubkey,
    pub base_vault: Pubkey,
    pub qoute_vault: Pubkey,

    //Ratio of over collateralization, num between 0-100
    pub over_collateral_percent: u8,

    pub oracle_type: OracleType,
    pub price_oracle: Pubkey,

    pub orderbook: Pubkey,
    pub admin: Pubkey,

    pub signer_bump: u8,
}

// current assumption is that we only are handling one pair of token (lend usdt with eth)
#[account]
pub struct UserAccount {
    pub owner: Pubkey,
    pub market: Pubkey,

    pub base_token_free: u64,
    pub base_token_locked: u64,

    pub qoute_token_free: u64,
    pub qoute_token_locked: u64,
    // open_orders: [u64; 64] // TODO: Make length adjustable, also user orderId
    // in_debt_orders:
}

pub fn get_qoute_price(oracle_type: OracleType, oracle_account: AccountInfo) -> Option<i64> {
    match oracle_type {
        OracleType::Pyth => {
            let price_data = oracle_account.try_borrow_data().unwrap();
            let price = load_price(*price_data).unwrap();
            match price.agg.status {
               PriceStatus::Trading => Some(price.agg.price),
               _ => None
            }
        },
        OracleType::Stub => {
            let price: Account<StubPrice> = Account::try_from(&oracle_account).unwrap();
            Some(price.price)
        }
    }
}
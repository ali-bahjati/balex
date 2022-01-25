use anchor_lang::prelude::*;
use anchor_lang::{AnchorDeserialize, AnchorSerialize};
use pyth_client::{load_price, PriceStatus};

pub static CALLBACK_INFO_LEN: u64 = 32;
pub static CALLBACK_ID_LEN: u64 = 32;


#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
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

#[zero_copy]
#[derive(AnchorDeserialize, AnchorSerialize, Default)]
pub struct Debt {
    pub lender: Pubkey,
    pub borrower: Pubkey,
    pub timestamp: i64,
    pub interest_rate: u64,
    pub qty: u64
}


pub const TOTAL_OPEN_DEBTS_SIZE: usize = 256;

#[account(zero_copy)]
#[repr(packed)]
pub struct LexMarket {
    pub base_mint: Pubkey,
    pub qoute_mint: Pubkey,
    pub base_vault: Pubkey,
    pub qoute_vault: Pubkey,

    //Ratio of over collateralization, num between 0-100
    pub over_collateral_percent: u8,
    pub signer_bump: u8,
    pub oracle_type: OracleType,

    pub price_oracle: Pubkey,

    pub orderbook: Pubkey,
    pub admin: Pubkey,


    pub debts: [Debt; TOTAL_OPEN_DEBTS_SIZE]
}

// current assumption is that we only are handling one pair of token (lend usdt with eth)
pub const USER_OPEN_ORDERS_SIZE: usize = 16;
pub const USER_OPEN_DEBTS_SIZE: usize = 16;

#[account(zero_copy)]
#[repr(packed)]
pub struct UserAccount {
    pub owner: Pubkey,
    pub market: Pubkey,

    pub base_free: u64, // includes borrowed ones
    pub base_locked: u64, // given to lend
    pub base_borrowed: u64, // total borrowed base

    pub qoute_total: u64, // amount of locked is dynamic per time

    pub open_orders_cnt: u8,

    pub open_orders: [u128; USER_OPEN_ORDERS_SIZE], // TODO: Make length adjustable, also user orderId
    // debts:
    pub open_debts: [u16; USER_OPEN_DEBTS_SIZE] // TODO: Make length adjustable
}

pub fn get_qoute_price(oracle_type: &OracleType, oracle_account: &AccountInfo) -> Option<i64> {
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

// No debt is considered right now. Should change adding debt
pub fn get_max_borrow_qty(user_account: &UserAccount, market: &LexMarket, oracle_account: &AccountInfo) -> u64 {
    let price: u64 = get_qoute_price(&market.oracle_type, &oracle_account).unwrap() as u64; // If price is not present?

    let over_collateral_price = price * (100 + market.over_collateral_percent as u64 + 99) / 100; // Overflow?

    user_account.qoute_total / over_collateral_price
}
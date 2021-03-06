use anchor_lang::prelude::*;
use anchor_lang::{AnchorDeserialize, AnchorSerialize};
use anchor_lang::solana_program::clock::Clock;
use std::time::{SystemTime, UNIX_EPOCH};
use pyth_client::{load_price};

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
    pub timestamp: i64, //Used to calculate return interest 
    pub interest_rate: u64, //fp32
    pub qty: u64, //If zero it means it's empty debt
    pub liquid_qty: u64,
}

impl Debt {
    pub fn get_debt_as_of_now(self: &Self) -> u64 {
        #[cfg(target_arch = "bpf")]
        let diff_timestamp = (Clock::get().unwrap().unix_timestamp - self.timestamp) as u64;

        #[cfg(not(target_arch = "bpf"))]
        let diff_timestamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() - self.timestamp as u64;

        let profit_rate: f64 = (self.interest_rate * diff_timestamp) as f64 / (60.*60.*100.);
        msg!("{} {} {}", self.qty, diff_timestamp, profit_rate);

        (self.qty as f64 * (1. + profit_rate)).round() as u64 - self.liquid_qty
    }
}



pub const TOTAL_OPEN_DEBTS_SIZE: usize = 256;

#[account(zero_copy)]
pub struct LexMarket {
    pub base_mint: Pubkey,
    pub quote_mint: Pubkey,
    pub base_vault: Pubkey,
    pub quote_vault: Pubkey,

    pub price_oracle: Pubkey,

    pub orderbook: Pubkey,
    pub admin: Pubkey,

    pub debts: [Debt; TOTAL_OPEN_DEBTS_SIZE],

    //Ratio of over collateralization, num between 0-100
    pub over_collateral_percent: u8,
    pub signer_bump: u8,
    pub oracle_type: OracleType,

    _padding: [u8; 5]
}

// current assumption is that we only are handling one pair of token (lend usdt with eth)
pub const USER_OPEN_ORDERS_SIZE: usize = 16;
pub const USER_OPEN_DEBTS_SIZE: usize = 16;

#[account(zero_copy)]
pub struct UserAccount {
    pub owner: Pubkey,

    pub base_free: u64, // Includes borrowed ones
    pub base_locked: u64, // Given to lend
    pub base_open_lend: u64, // Total base given which is still open

    pub base_open_borrow: u64, // Total base requested which is open order now 

    pub quote_total: u64, // amount of locked is dynamic per time as price of borrowed collaterals can change

    pub open_orders: [u128; USER_OPEN_ORDERS_SIZE], // TODO: Make length adjustable, also user orderId
    // debts:
    pub open_debts: [u16; USER_OPEN_DEBTS_SIZE], // TODO: Make length adjustable

    pub open_orders_cnt: u8,

    pub open_debts_cnt: u8,

    _padding: [u8; 6]
}

impl UserAccount {
    pub fn remove_order(self: &mut Self, order_id: u128) -> ProgramResult {
        for i in 0..self.open_orders_cnt as usize {
            if self.open_orders[i] == order_id {
                self.open_orders[i] = self.open_orders[self.open_orders_cnt as usize - 1];
                self.open_orders[self.open_orders_cnt as usize - 1] = 0;
                self.open_orders_cnt -= 1;
                return Ok(());
            }
        }
        return Err(ProgramError::InvalidArgument);
    }
    pub fn remove_debt(self: &mut Self, debt_id: u16) -> ProgramResult {
        for i in 0..self.open_debts_cnt as usize {
            if self.open_debts[i] == debt_id {
                self.open_debts[i] = self.open_debts[self.open_debts_cnt as usize - 1];
                self.open_debts[self.open_debts_cnt as usize - 1] = 0;
                self.open_debts_cnt -= 1;
                return Ok(());
            }
        }
        return Err(ProgramError::InvalidArgument);
    }
}

pub fn get_quote_price(oracle_type: &OracleType, oracle_account: &AccountInfo) -> Option<i64> {
    match oracle_type {
        OracleType::Pyth => {
            let price_data = oracle_account.try_borrow_data().unwrap();
            let price = load_price(*price_data).unwrap();
            // match price.agg.status {
            //    PriceStatus::Trading => Some(price.agg.price),
            //    _ => Some(price.agg.price) // Change to a safe behavior
            // }
            Some(price.agg.price / (10 as i64).pow(price.expo as u32))
        },
        OracleType::Stub => {
            let price: Account<StubPrice> = Account::try_from(&oracle_account).unwrap();
            Some(price.price)
        }
    }
}

pub fn get_user_total_debt(user_account: &UserAccount, market: &LexMarket) -> u64 {
    let mut total_debt: u64 = 0;

    for i in 0..user_account.open_debts_cnt as usize {
        let debt_id = user_account.open_debts[i] as usize;
        let debt: &Debt = &market.debts[debt_id];

        if debt.borrower == user_account.owner {
            total_debt += debt.get_debt_as_of_now();
        }
    }

    total_debt
}

pub fn get_max_borrow_qty(user_account: &UserAccount, market: &LexMarket, oracle_account: &AccountInfo) -> u64 {
    let price: u64 = get_quote_price(&market.oracle_type, &oracle_account).unwrap() as u64; // If price is not present?

    let total_possible = user_account.quote_total * 100 * price / (100 + market.over_collateral_percent as u64);
    let user_total_open_debt = user_account.base_open_borrow + get_user_total_debt(user_account, market);

    total_possible.saturating_sub(user_total_open_debt)
}

pub fn get_max_withdraw_qty(user_account: &UserAccount, market: &LexMarket, oracle_account: &AccountInfo) -> u64 {
    let price: u64 = get_quote_price(&market.oracle_type, &oracle_account).unwrap() as u64; // If price is not present?

    let user_total_open_debt = user_account.base_open_borrow + get_user_total_debt(user_account, market);

    let safe_backed = (user_total_open_debt * (100 + market.over_collateral_percent as u64) + price * 100 -1) / (price * 100);

    user_account.quote_total.saturating_sub(safe_backed)
}


// Returns health factor as percent, not accurate and not safe for overflows! TODO: make it fp32
pub fn get_user_health_factor(user_account: &UserAccount, market: &LexMarket, oracle_account: &AccountInfo) -> u64 {
    let price: u64 = get_quote_price(&market.oracle_type, &oracle_account).unwrap() as u64; // If price is not present?

    let user_total_open_debt = user_account.base_open_borrow + get_user_total_debt(user_account, market);

    if user_total_open_debt == 0 {
        return 100;
    }

    let user_quote = user_account.quote_total;

    10000 * price * user_quote / (user_total_open_debt * (100 + (market.over_collateral_percent+1) as u64 /2))
}

pub fn get_user_health_factor_after_liquid(liquid_amount: u64, user_account: &UserAccount, market: &LexMarket, oracle_account: &AccountInfo) -> u64 {
    let price: u64 = get_quote_price(&market.oracle_type, &oracle_account).unwrap() as u64; // If price is not present?

    let user_total_open_debt = user_account.base_open_borrow + get_user_total_debt(user_account, market) - liquid_amount;

    if user_total_open_debt == 0 {
        return 100;
    }

    let liquid_quote = (liquid_amount + price - 1) / price;
    let liquid_quote = (liquid_quote as f64 * 1.03).round() as u64;

    let user_quote = user_account.quote_total - liquid_quote;
    10000 * price * user_quote / (user_total_open_debt * (100 + (market.over_collateral_percent+1) as u64 /2))
}

pub fn create_debt(qty: u64, interest_rate: u64, lender: &mut UserAccount, borrower: &mut UserAccount, market: &mut LexMarket) -> ProgramResult {
    for i in 0..TOTAL_OPEN_DEBTS_SIZE {
        if market.debts[i].qty == 0 {
            market.debts[i] = Debt {
                lender: lender.owner,
                borrower: borrower.owner,
                timestamp: Clock::get().unwrap().unix_timestamp,
                interest_rate,
                qty,
                liquid_qty: 0,
            };

            lender.open_debts[lender.open_debts_cnt as usize] = i as u16;
            lender.open_debts_cnt += 1;

            borrower.open_debts[borrower.open_debts_cnt as usize] = i as u16;
            borrower.open_debts_cnt += 1;

            borrower.base_free += qty;
            borrower.base_open_borrow -= qty;

            lender.base_locked += qty;
            lender.base_open_lend -= qty;

            msg!("Successfully created a debt of {} with interest {} between {} and {}", qty, interest_rate, lender.owner, borrower.owner);
            return Ok(())
        }
    }
    msg!("Debts are full!");
    Err(ProgramError::Custom(0))
}
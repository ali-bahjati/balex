use anchor_lang::prelude::*;
use anchor_lang::{AnchorDeserialize, AnchorSerialize};

declare_id!("CGQawUSGDyLdA96dbaL3YsA61JPdyv1zPYmvDRjpnHjF");

pub mod state;
pub mod processor;

use state::*;
use processor::*;

#[program]
pub mod balex {
    use super::*;

    pub fn initialize_market(
        ctx: Context<InitializeMarket>,
        signer_bump: u8,
        base_mint: Pubkey,
        quote_mint: Pubkey,
        oracle_type: OracleType,
    ) -> ProgramResult {
        processor::market::initialize_market(ctx, signer_bump, base_mint, quote_mint, oracle_type)
    }

    pub fn initialize_account(
        ctx: Context<InitializeAccount>,
        _bump: u8,
    ) -> ProgramResult {
        processor::account::initialize_account(ctx, _bump)
    }

    pub fn deposit(ctx: Context<Deposit>, _bump: u8, amount: u64) -> ProgramResult {
        processor::account::deposit(ctx, _bump, amount)
    }

    pub fn set_stub_price(ctx: Context<SetStubPrice>, price: i64, conf: u64) -> ProgramResult {
        processor::stub_oracle::set_stub_price(ctx, price, conf)
    }

    pub fn new_order(ctx: Context<NewOrder>, _bump: u8, side_num: u8, interest_rate: u64, qty: u64) -> ProgramResult {
        processor::order::new_order(ctx, _bump, side_num, interest_rate, qty)
    }

    pub fn cancel_my_order(ctx: Context<CancelMyOrder>, _bump: u8, order_id: u128) -> ProgramResult {
        processor::order::cancel_my_order(ctx, _bump, order_id)
    }

    pub fn cancel_risky_order(ctx: Context<CancelRiskyOrder>, _bump: u8, order_id: u128) -> ProgramResult {
        processor::order::cancel_risky_order(ctx, _bump, order_id)
    }

    pub fn consume_order_events(
        ctx: Context<ConsumerOrderEvents>,
        max_iterations: u64,
    ) -> ProgramResult {
        processor::order::consume_order_events(ctx, max_iterations)
    }


    pub fn withdraw(ctx: Context<Withdraw>, _bump: u8, amount: u64) -> ProgramResult {
        processor::account::withdraw(ctx, _bump, amount)
    }

    pub fn settle_debt(ctx: Context<SettleDebt>, _bump: u8, debt_id: u16) -> ProgramResult {
        processor::debt::settle_debt(ctx, _bump, debt_id)
    }

    pub fn liquidate_debts(ctx: Context<LiquidateDebts>, debts_id: Vec<u16>, debts_amount: Vec<u64>) -> ProgramResult {
        processor::debt::liquidate_debts(ctx, debts_id, debts_amount)
    }

    // close account?
    // close market?
}

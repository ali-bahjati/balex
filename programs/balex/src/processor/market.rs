use anchor_lang::prelude::*;
use pyth_client::{load_price};
use anchor_spl::token::TokenAccount;
use crate::state::{LexMarket, StubPrice, OracleType, CALLBACK_ID_LEN, CALLBACK_INFO_LEN};

#[derive(Accounts)]
pub struct InitializeMarket<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(zero)]
    pub market: AccountLoader<'info, LexMarket>,

    #[account()]
    pub base_vault: Account<'info, TokenAccount>,

    #[account()]
    pub qoute_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub event_queue: AccountInfo<'info>,

    #[account(mut)]
    pub orderbook: AccountInfo<'info>,

    #[account(mut)]
    pub asks: AccountInfo<'info>,

    #[account(mut)]
    pub bids: AccountInfo<'info>,

    #[account()]
    pub price_oracle: AccountInfo<'info>,

    #[account()]
    pub system_program: Program<'info, System>,
}

pub fn initialize_market(
    ctx: Context<InitializeMarket>,
    signer_bump: u8,
    base_mint: Pubkey,
    qoute_mint: Pubkey,
    oracle_type: OracleType,
) -> ProgramResult {
    let mut market = ctx.accounts.market.load_init()?;

    market.admin = ctx.accounts.admin.key();
    market.base_mint = base_mint;
    market.qoute_mint = qoute_mint;

    market.base_vault = ctx.accounts.base_vault.key();
    market.qoute_vault = ctx.accounts.qoute_vault.key();

    market.signer_bump = signer_bump;

    market.over_collateral_percent = 50;

    // TODO: More check on oracle to be from correct program
    match oracle_type {
        OracleType::Pyth => {
            let price_data = ctx.accounts.price_oracle.try_borrow_data()?;
            let price = load_price(*price_data)?;
            msg!(
                "Current price is {} conf {}",
                price.agg.price,
                price.agg.conf
            );
        }
        OracleType::Stub => {
            let price: Account<StubPrice> = Account::try_from(&ctx.accounts.price_oracle)?;
            msg!("Current price is {} conf {}", price.price, price.conf);
        }
    }

    market.oracle_type = oracle_type;
    market.price_oracle = ctx.accounts.price_oracle.key();

    market.orderbook = ctx.accounts.orderbook.key();

    let invoke_params = agnostic_orderbook::instruction::create_market::Params {
        caller_authority: ctx.program_id.to_bytes(),
        callback_info_len: CALLBACK_INFO_LEN,
        callback_id_len: CALLBACK_ID_LEN,
        min_base_order_size: 1,
        tick_size: 1,
        cranker_reward: 0,
    };

    let invoke_accounts = agnostic_orderbook::instruction::create_market::Accounts {
        market: &ctx.accounts.orderbook,
        event_queue: &ctx.accounts.event_queue,
        bids: &ctx.accounts.bids,
        asks: &ctx.accounts.asks,
    };
    if let Err(error) = agnostic_orderbook::instruction::create_market::process(
        ctx.program_id,
        invoke_accounts,
        invoke_params,
    ) {
        msg!("{}", error);
        return Err(ProgramError::InvalidAccountData);
    }

    Ok(())
}

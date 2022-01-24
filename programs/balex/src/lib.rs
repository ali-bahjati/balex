use anchor_lang::prelude::*;
use anchor_lang::{AnchorDeserialize, AnchorSerialize};
use anchor_spl::token::{TokenAccount};

declare_id!("CGQawUSGDyLdA96dbaL3YsA61JPdyv1zPYmvDRjpnHjF");

pub static CALLBACK_INFO_LEN: u64 = 32;
pub static CALLBACK_ID_LEN: u64 = 32;

#[program]
pub mod balex {
    use super::*;
    pub fn initialize_market(ctx: Context<InitializeMarket>, signer_bump: u8, base_mint: Pubkey, qoute_mint: Pubkey) -> ProgramResult {
        let market = &mut ctx.accounts.market;

        market.admin = ctx.accounts.admin.key();
        market.base_mint = base_mint;
        market.qoute_mint = qoute_mint;

        market.base_vault = ctx.accounts.base_vault.key();
        market.qoute_vault = ctx.accounts.qoute_vault.key();

        market.signer_bump = signer_bump;

        market.over_collateral_percent = 50;

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
            return Err(ProgramError::InvalidAccountData)
        }

        Ok(())
    }

    pub fn initialize_account(ctx: Context<InitializeAccount>, user_account_bump: u8, market: Pubkey) -> ProgramResult {
        ctx.accounts.user_account.owner = ctx.accounts.owner.key();
        ctx.accounts.user_account.market = market;

        Ok(())
    }

    // deposit
    // withdraw
    // new order
    // clear debt
    // cancel order
    // consume events
    // liquiditate 

    // close account?
    // close market?
}

#[derive(Accounts)]
pub struct InitializeMarket<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(init, payer=admin)]
    pub market: Account<'info, LexMarket>,

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
    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
#[instruction(user_account_bump: u8)]
pub struct InitializeAccount<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(init, payer=owner, space=8 + 32*3, seeds=[&owner.key().to_bytes()], bump=user_account_bump)]
    pub user_account: Account<'info, UserAccount>,

    pub system_program: Program<'info, System>,
}

#[account]
#[derive(Default)]
pub struct LexMarket {
    base_mint: Pubkey,
    qoute_mint: Pubkey,
    base_vault: Pubkey,
    qoute_vault: Pubkey,

    //Ratio of over collateralization, num between 0-100
    over_collateral_percent: u8,

    pyth_price: Pubkey,

    orderbook: Pubkey,
    admin: Pubkey,

    signer_bump: u8
}

// Current assumption is that we only are handling one pair of token (lend usdt with eth)
#[account]
pub struct UserAccount {
    owner: Pubkey,
    market: Pubkey,

    base_token_free: u64,
    base_token_locked: u64,

    qoute_token_free: u64,
    qoute_token_locked: u64,

    // orders: [Pubkey; 64] // TODO: Make length adjustable
}
use anchor_lang::prelude::*;
use crate::state::{UserAccount, LexMarket};
use anchor_spl::token::{transfer, Token, TokenAccount, Transfer};

#[derive(Accounts)]
#[instruction(_bump: u8)]
pub struct InitializeAccount<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(init, payer=owner, space = 8 + std::mem::size_of::<UserAccount>(), seeds=[&owner.key().to_bytes()], bump=_bump)]
    pub user_account: AccountLoader<'info, UserAccount>,

    #[account()]
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(_bump: u8)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(mut, seeds=[&owner.key().to_bytes()], bump=_bump)]
    // TODO: If it's gonna be per market also add market here
    pub user_account: AccountLoader<'info, UserAccount>,

    #[account()]
    pub market: AccountLoader<'info, LexMarket>,

    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub token_source: Account<'info, TokenAccount>,

    #[account()]
    pub token_program: Program<'info, Token>,
}

pub fn initialize_account(
    ctx: Context<InitializeAccount>,
    _bump: u8,
    market: Pubkey,
) -> ProgramResult {
    let mut user_account = ctx.accounts.user_account.load_init()?;

    user_account.owner = ctx.accounts.owner.key();
    user_account.market = market;

    Ok(())
}

pub fn deposit(ctx: Context<Deposit>, _bump: u8, amount: u64) -> ProgramResult {
    let market = ctx.accounts.market.load()?;
    let mut user_account = ctx.accounts.user_account.load_mut()?;

    if ctx.accounts.vault.key() == market.base_vault {
        user_account.base_free += amount;
    } else if ctx.accounts.vault.key() == market.quote_vault {
        user_account.quote_total += amount;
    } else {
        msg!("Vault address is not base nor quote vault of the market");
        return Err(ProgramError::InvalidAccountData);
    }    transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.token_source.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
        ),
        amount,
    )?;

    Ok(())
}

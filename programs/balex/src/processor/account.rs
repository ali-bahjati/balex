use anchor_lang::prelude::*;
use crate::state::{UserAccount, LexMarket};
use anchor_spl::token::{transfer, Token, TokenAccount, Transfer};

#[derive(Accounts)]
#[instruction(_bump: u8)]
pub struct InitializeAccount<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(init, payer=owner, space=8 + 32*3, seeds=[&owner.key().to_bytes()], bump=_bump)]
    pub user_account: Account<'info, UserAccount>,

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
    pub user_account: Account<'info, UserAccount>,

    #[account()]
    pub market: Account<'info, LexMarket>,

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
    ctx.accounts.user_account.owner = ctx.accounts.owner.key();
    ctx.accounts.user_account.market = market;

    Ok(())
}

pub fn deposit(ctx: Context<Deposit>, _bump: u8, amount: u64) -> ProgramResult {
    if ctx.accounts.vault.key() == ctx.accounts.market.base_vault {
        ctx.accounts.user_account.base_token_free += amount;
    } else if ctx.accounts.vault.key() == ctx.accounts.market.qoute_vault {
        ctx.accounts.user_account.qoute_token_free += amount;
    } else {
        msg!("Vault address is not base nor qoute vault of the market");
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

use crate::Debt;
use crate::get_quote_price;
use crate::get_user_health_factor;
use anchor_lang::prelude::*;
use anchor_spl::token::{transfer, Token, TokenAccount, Transfer};
use crate::state::{UserAccount, LexMarket};


#[derive(Accounts)]
#[instruction(_bump: u8)]
pub struct SettleDebt<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(mut, seeds=[&market.key().to_bytes(), &owner.key().to_bytes()], bump=_bump)]
    pub borrower_account: AccountLoader<'info, UserAccount>,

    #[account(mut)]
    pub lender_account: AccountLoader<'info, UserAccount>,

    #[account(mut)]
    pub market: AccountLoader<'info, LexMarket>,
}

pub fn settle_debt(ctx: Context<SettleDebt>, _bump: u8, debt_id: u16) -> ProgramResult {
    let borrower_account = &mut ctx.accounts.borrower_account.load_mut()?;
    let lender_account = &mut ctx.accounts.lender_account.load_mut()?;
    let market = &mut ctx.accounts.market.load_mut()?;

    let debt = &mut market.debts[debt_id as usize];
    let debt_qty_now = debt.get_debt_as_of_now();

    if borrower_account.base_free < debt_qty_now {
        msg!("Insufficiant base qty {}, required {}", borrower_account.base_free, debt_qty_now);
        return Err(ProgramError::InsufficientFunds);
    }

    borrower_account.base_free -= debt_qty_now;
    lender_account.base_locked -= debt.qty.saturating_sub(debt.liquid_qty);
    lender_account.base_free += debt_qty_now;

    debt.qty = 0;

    borrower_account.remove_debt(debt_id)?;
    lender_account.remove_debt(debt_id)?;

    Ok(())
}


#[derive(Accounts)]
#[instruction(_bump: u8)]
pub struct LiquidateDebts<'info> {
    #[account()]
    pub liquidator: Signer<'info>,

    #[account(mut)]
    pub borrower_account: AccountLoader<'info, UserAccount>,

    #[account(mut)]
    pub market: AccountLoader<'info, LexMarket>,

    #[account()]
    pub market_signer: AccountInfo<'info>,

    #[account(mut)]
    pub base_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub quote_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub token_base_src: Account<'info, TokenAccount>,

    #[account(mut)]
    pub token_quote_dest: Account<'info, TokenAccount>,

    #[account()]
    pub price_oracle: AccountInfo<'info>,

    #[account()]
    pub token_program: Program<'info, Token>,
}


pub fn liquidate_debts(ctx: Context<LiquidateDebts>, debts_id: Vec<u16>, debts_amount: Vec<u64>) -> ProgramResult {
    let borrower_account = &mut ctx.accounts.borrower_account.load_mut()?;
    let market = &mut ctx.accounts.market.load_mut()?;

    let borrower_health = get_user_health_factor(&borrower_account, &market, &ctx.accounts.price_oracle);

    if borrower_health >= 100 {
        msg!("Borrower is healthy! Health: {}", borrower_health);
        return Err(ProgramError::InvalidAccountData);
    }

    if borrower_account.base_open_borrow > 0 {
        msg!("Borrower has some borrow request order, close it first!");
        return Err(ProgramError::Custom(0));
    }

    let mut lender_accounts: Vec<(&AccountInfo, Pubkey)> = Vec::new(); 

    for acc in ctx.remaining_accounts.iter() {
        let acc_loader: AccountLoader<UserAccount> = AccountLoader::try_from(acc)?;
        let acc_data = acc_loader.load()?;
        lender_accounts.push((acc, acc_data.owner))
    }

    lender_accounts.sort_unstable_by_key(|a| a.1);

    if debts_id.len() != debts_amount.len() {
        msg!("Debt id list size and Debt amount list size are not equal!");
        return Err(ProgramError::InvalidArgument);
    }

    let mut total_base: u64 = 0;

    for i in 0..debts_id.len() {
        let debt_id = debts_id[i];
        let amount = debts_amount[i];

        let debt: &mut Debt = &mut market.debts[debt_id as usize];
        if debt.borrower != borrower_account.owner {
            msg!("Borrower is not borrower of this debt {}", debt_id);
            return Err(ProgramError::InvalidAccountData)
        }

        let debt_qty_now = debt.get_debt_as_of_now();
        let max_allowed_liquid = (debt_qty_now + 1)/2;
        if amount > max_allowed_liquid {
            msg!("Max allowed liquid is ceil(50%) {}, skipping for now", max_allowed_liquid);
            // return Err(ProgramError::Custom(0));
        }


        let lender_id = lender_accounts.binary_search_by_key(&debt.lender, |a| a.1).unwrap();
        let lender_account_loader: AccountLoader<UserAccount> = AccountLoader::try_from(lender_accounts[lender_id].0)?;
        let lender = &mut lender_account_loader.load_mut()?;

        lender.base_locked -= amount.min(debt.qty.saturating_sub(debt.liquid_qty));
        lender.base_free += amount;

        debt.liquid_qty += amount;
        total_base += amount;
    }

    let price = get_quote_price(&market.oracle_type, &ctx.accounts.price_oracle).unwrap() as u64;
    let mut total_quote = (total_base + price - 1) / price;
    total_quote = (total_quote as f64 * 1.03).round() as u64;

    if borrower_account.quote_total < total_quote {
        msg!("Strangely borrower doesn't have enough quote to pay, it's dangerous and means we're in a crash situation!");
        return Err(ProgramError::Custom(0));
    }

    borrower_account.quote_total -= total_quote;
    let borrower_health = get_user_health_factor(&borrower_account, &market, &ctx.accounts.price_oracle);

    if borrower_health < 100 {
        msg!("Liquidator could bring health factor more >= 100%, it's {}", borrower_health);
        return Err(ProgramError::Custom(0));
    }

    transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.token_base_src.to_account_info(),
                to: ctx.accounts.base_vault.to_account_info(),
                authority: ctx.accounts.liquidator.to_account_info(),
            }
        ),
        total_base,
    )?;

    transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.quote_vault.to_account_info(),
                to: ctx.accounts.token_quote_dest.to_account_info(),
                authority: ctx.accounts.market_signer.clone(),
            },
            &[&[&ctx.accounts.market.key().to_bytes(), &[market.signer_bump]]]
        ),
        total_quote,
    )?;

    msg!("Liquidated with total base {} and got back total quote {}", total_base, total_quote);

    Ok(())
}
use anchor_lang::prelude::*;
use agnostic_orderbook::state::Side;
use crate::state::{LexMarket, UserAccount, get_max_borrow_qty};

#[derive(Accounts)]
#[instruction(_bump: u8)]
pub struct NewOrder<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(mut, seeds=[&owner.key().to_bytes()], bump=_bump)]
    pub user_account: Account<'info, UserAccount>,

    #[account(mut)]
    pub market: Account<'info, LexMarket>,

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
    system_program: Program<'info, System>
}

// rate is 32bit fixed point float
pub fn new_order(ctx: Context<NewOrder>, _bump: u8, side_num: u8, rate: u64, qty: u64) -> ProgramResult {
    // TODO: Make side_num enum
    let side = match side_num {
        0 => Side::Bid,
        1 => Side::Ask,
        _ => {
            return Err(ProgramError::InvalidArgument)
        }
    };

    match side {
        Side::Ask => {
            if qty > ctx.accounts.user_account.base_token_free {
                return Err(ProgramError::InvalidInstructionData);
            }
        },
        Side::Bid => {
            let max_borrow_qty = get_max_borrow_qty(&ctx.accounts.user_account, &ctx.accounts.market, &ctx.accounts.price_oracle);
            if qty > max_borrow_qty {
                return Err(ProgramError::InsufficientFunds);
            }
        }
    };

    let aob_param = agnostic_orderbook::instruction::new_order::Params {
        max_base_qty: qty,
        max_quote_qty: u64::MAX,
        limit_price: rate,
        side: side,
        match_limit: 10000,
        post_only: false,
        post_allowed: true,
        callback_info: ctx.accounts.user_account.key().to_bytes().to_vec(),
        self_trade_behavior: agnostic_orderbook::state::SelfTradeBehavior::AbortTransaction
    };

    let aob_accounts = agnostic_orderbook::instruction::new_order::Accounts {
        market: &ctx.accounts.orderbook,
        asks: &ctx.accounts.asks,
        bids: &ctx.accounts.bids,
        event_queue: &ctx.accounts.event_queue,
        authority: &ctx.accounts.system_program.to_account_info(),
    };

    if let Err(err) = agnostic_orderbook::instruction::new_order::process(ctx.program_id, aob_accounts, aob_param) {
        msg!("{}", err);
        return Err(err)
    }

    Ok(())
}
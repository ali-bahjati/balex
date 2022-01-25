use agnostic_orderbook::state::OrderSummary;
use agnostic_orderbook::state::read_register;
use anchor_lang::prelude::*;
use agnostic_orderbook::state::Side;
use crate::state::{LexMarket, UserAccount, get_max_borrow_qty};
use crate::USER_OPEN_ORDERS_SIZE;

#[derive(Accounts)]
#[instruction(_bump: u8)]
pub struct NewOrder<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(mut, seeds=[&owner.key().to_bytes()], bump=_bump)]
    pub user_account: AccountLoader<'info, UserAccount>,

    #[account(mut)]
    pub market: AccountLoader<'info, LexMarket>,

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
pub fn new_order(ctx: Context<NewOrder>, _bump: u8, side_num: u8, interest_rate: u64, qty: u64) -> ProgramResult {
    // TODO: Make side_num enum
    let side = match side_num {
        0 => Side::Bid,
        1 => Side::Ask,
        _ => {
            return Err(ProgramError::InvalidArgument)
        }
    };

    let mut user_account = ctx.accounts.user_account.load_mut()?;
    let market = ctx.accounts.market.load()?; 

    match side {
        Side::Ask => {
            if qty > user_account.base_free {
                return Err(ProgramError::InvalidInstructionData);
            }
        },
        Side::Bid => {
            let max_borrow_qty = get_max_borrow_qty(&user_account, &market, &ctx.accounts.price_oracle);
            if qty > max_borrow_qty {
                return Err(ProgramError::InsufficientFunds);
            }
        }
    };

    let aob_param = agnostic_orderbook::instruction::new_order::Params {
        max_base_qty: qty,
        max_quote_qty: u64::MAX,
        limit_price: interest_rate,
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

    let order_summary: OrderSummary = read_register(&ctx.accounts.event_queue).unwrap().unwrap();

    if let Some(order_id) = order_summary.posted_order_id {
        let open_orders_cnt = user_account.open_orders_cnt as usize;

        if open_orders_cnt == USER_OPEN_ORDERS_SIZE {
            msg!("Max open orders reached.");
            return Err(ProgramError::AccountDataTooSmall);
        }

        user_account.open_orders[open_orders_cnt] = order_id;
        user_account.open_orders_cnt += 1;
    }

    Ok(())
}
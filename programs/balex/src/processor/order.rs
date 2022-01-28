use crate::create_debt;
use crate::state::{get_max_borrow_qty, get_user_health_factor, LexMarket, UserAccount};
use crate::CALLBACK_INFO_LEN;
use crate::USER_OPEN_ORDERS_SIZE;
use agnostic_orderbook::state::read_register;
use agnostic_orderbook::state::Event;
use agnostic_orderbook::state::EventQueue;
use agnostic_orderbook::state::EventQueueHeader;
use agnostic_orderbook::state::OrderSummary;
use agnostic_orderbook::state::Side;
use anchor_lang::prelude::*;
use std::rc::Rc;

#[derive(Accounts)]
#[instruction(_bump: u8)]
pub struct NewOrder<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(mut, seeds=[&market.key().to_bytes(), &owner.key().to_bytes()], bump=_bump)]
    pub user_account: AccountLoader<'info, UserAccount>,

    #[account(mut, has_one=orderbook)]
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
    system_program: Program<'info, System>, // Later could be used for paying rewards and maybe transaction fee
}

// rate is 32bit fixed point float
pub fn new_order(
    ctx: Context<NewOrder>,
    _bump: u8,
    side_num: u8,
    interest_rate: u64,
    qty: u64,
) -> ProgramResult {
    // TODO: Make side_num enum. Giving instant enum didn't work as anchor couldn't generate IDL for it
    let side = match side_num {
        0 => Side::Bid,
        1 => Side::Ask,
        _ => return Err(ProgramError::InvalidArgument),
    };

    let mut user_account = ctx.accounts.user_account.load_mut()?;
    let market = ctx.accounts.market.load()?;

    match side {
        Side::Ask => {
            if qty > user_account.base_free {
                return Err(ProgramError::InvalidInstructionData);
            }
        }
        Side::Bid => {
            let max_borrow_qty =
                get_max_borrow_qty(&user_account, &market, &ctx.accounts.price_oracle);
            msg!("Max borrow amount is {}", max_borrow_qty);
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
        self_trade_behavior: agnostic_orderbook::state::SelfTradeBehavior::AbortTransaction,
    };

    let aob_accounts = agnostic_orderbook::instruction::new_order::Accounts {
        market: &ctx.accounts.orderbook,
        asks: &ctx.accounts.asks,
        bids: &ctx.accounts.bids,
        event_queue: &ctx.accounts.event_queue,
        authority: &ctx.accounts.system_program.to_account_info(),
    };

    if let Err(err) =
        agnostic_orderbook::instruction::new_order::process(ctx.program_id, aob_accounts, aob_param)
    {
        msg!("{}", err);
        return Err(err);
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

    match side {
        Side::Bid => {
            user_account.base_open_borrow += order_summary.total_base_qty;
        }
        Side::Ask => {
            user_account.base_open_lend += order_summary.total_base_qty;
            user_account.base_free -= order_summary.total_base_qty;
        }
    }

    Ok(())
}

#[derive(Accounts)]
#[instruction(_bump: u8)]
pub struct CancelMyOrder<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(mut, seeds=[&market.key().to_bytes(), &owner.key().to_bytes()], bump=_bump)]
    pub user_account: AccountLoader<'info, UserAccount>,

    #[account(mut, has_one=orderbook)]
    pub market: AccountLoader<'info, LexMarket>, // Will be used later to aggregate total informations

    #[account(mut)]
    pub event_queue: AccountInfo<'info>,

    #[account(mut)]
    pub orderbook: AccountInfo<'info>,

    #[account(mut)]
    pub asks: AccountInfo<'info>,

    #[account(mut)]
    pub bids: AccountInfo<'info>,

    #[account()]
    system_program: Program<'info, System>, // Later could be used for paying rewards and maybe transaction fee
}

pub fn cancel_my_order(ctx: Context<CancelMyOrder>, _bump: u8, order_id: u128) -> ProgramResult {
    let aob_params = agnostic_orderbook::instruction::cancel_order::Params { order_id: order_id };

    let aob_accounts = agnostic_orderbook::instruction::cancel_order::Accounts {
        market: &ctx.accounts.orderbook,
        event_queue: &ctx.accounts.event_queue,
        bids: &ctx.accounts.bids,
        asks: &ctx.accounts.asks,
        authority: &ctx.accounts.system_program.to_account_info(),
    };

    if let Err(err) = agnostic_orderbook::instruction::cancel_order::process(
        ctx.program_id,
        aob_accounts,
        aob_params,
    ) {
        msg!("{}", err);
        return Err(err);
    }

    let side = agnostic_orderbook::state::get_side_from_order_id(order_id);
    let order_summary: OrderSummary = read_register(&ctx.accounts.event_queue).unwrap().unwrap();
    let mut user_account = ctx.accounts.user_account.load_mut()?;

    match side {
        Side::Ask => {
            user_account.base_open_lend -= order_summary.total_base_qty;
        },
        Side::Bid => {
            user_account.base_open_borrow -= order_summary.total_base_qty;
        },
    };

    user_account.remove_order(order_id)?;

    Ok(())
}

#[derive(Accounts)]
#[instruction(_bump: u8)]
pub struct CancelRiskyOrder<'info> {
    #[account(mut)]
    pub owner: AccountInfo<'info>,

    #[account(mut, seeds=[&market.key().to_bytes(), &owner.key().to_bytes()], bump=_bump)]
    pub user_account: AccountLoader<'info, UserAccount>,

    #[account(mut, has_one=orderbook)]
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
    system_program: Program<'info, System>, // Later could be used for paying rewards and maybe transaction fee
}

pub fn cancel_risky_order(
    ctx: Context<CancelRiskyOrder>,
    _bump: u8,
    order_id: u128,
) -> ProgramResult {
    let side = agnostic_orderbook::state::get_side_from_order_id(order_id);

    if let Side::Ask = side {
        return Err(ProgramError::InvalidInstructionData);
    }

    let mut user_account = ctx.accounts.user_account.load_mut()?;
    let market = ctx.accounts.market.load()?;

    let health_factor = get_user_health_factor(&user_account, &market, &ctx.accounts.price_oracle);
    msg!("Health factor: {}", health_factor);

    if health_factor >= 100 {
        msg!("User is good shape with good health factor");
        return Err(ProgramError::InvalidAccountData);
    }

    let aob_params = agnostic_orderbook::instruction::cancel_order::Params { order_id: order_id };

    let aob_accounts = agnostic_orderbook::instruction::cancel_order::Accounts {
        market: &ctx.accounts.orderbook,
        event_queue: &ctx.accounts.event_queue,
        bids: &ctx.accounts.bids,
        asks: &ctx.accounts.asks,
        authority: &ctx.accounts.system_program.to_account_info(),
    };

    if let Err(err) = agnostic_orderbook::instruction::cancel_order::process(
        ctx.program_id,
        aob_accounts,
        aob_params,
    ) {
        msg!("{}", err);
        return Err(err);
    }

    let order_summary: OrderSummary = read_register(&ctx.accounts.event_queue).unwrap().unwrap();

    user_account.base_open_borrow -= order_summary.total_base_qty;

    user_account.remove_order(order_id)?;

    Ok(())
}

// Proper user accounts should be given in remaining_accounts
#[derive(Accounts)]
#[instruction(_bump: u8)]
pub struct ConsumerOrderEvents<'info> {
    #[account(mut, has_one=orderbook)]
    pub market: AccountLoader<'info, LexMarket>, // Will be used later to aggregate total informations

    #[account(mut)]
    pub event_queue: AccountInfo<'info>,

    #[account(mut)]
    pub orderbook: AccountInfo<'info>,

    #[account()]
    system_program: Program<'info, System>, // Later could be used for paying rewards and maybe transaction fee
}

pub fn consume_order_events(
    ctx: Context<ConsumerOrderEvents>,
    max_iterations: u64,
) -> ProgramResult {
    let user_accounts: &[AccountInfo] = ctx.remaining_accounts;

    if user_accounts.is_empty() {
        return Err(ProgramError::InvalidAccountData);
    }

    let event_queue_header =
        EventQueueHeader::deserialize(&mut (&ctx.accounts.event_queue.data.borrow() as &[u8]))?;
    let event_queue = EventQueue::new(
        event_queue_header,
        Rc::clone(&ctx.accounts.event_queue.data),
        CALLBACK_INFO_LEN as usize,
    );

    let mut total_iterations = 0;

    for event in event_queue.iter().take(max_iterations as usize) {
        if let Err(err) = consume_event(user_accounts, event, &ctx.accounts.market) {
            msg!("{}", err);
            break;
        }
        total_iterations += 1;
    }

    if total_iterations == 0 {
        msg!("Failed to complete one iteration");
        return Err(ProgramError::Custom(0));
    }

    let aob_params = agnostic_orderbook::instruction::consume_events::Params {
        number_of_entries_to_consume: total_iterations,
    };
    let aob_accounts = agnostic_orderbook::instruction::consume_events::Accounts {
        market: &ctx.accounts.orderbook,
        event_queue: &ctx.accounts.event_queue,
        authority: &ctx.accounts.system_program.to_account_info(), // No impact with AOB as a lib
        reward_target: &ctx.accounts.market.to_account_info(),
    };

    if let Err(error) = agnostic_orderbook::instruction::consume_events::process(
        ctx.program_id,
        aob_accounts,
        aob_params,
    ) {
        msg!("{}", error);
        return Err(error);
    }

    Ok(())
}

fn consume_event(
    accounts_slice: &[AccountInfo],
    event: Event,
    market: &AccountLoader<LexMarket>,
) -> Result<(), ProgramError> {
    let mut user_accounts: Vec<&AccountInfo> = accounts_slice.iter().collect();

    user_accounts.sort_unstable_by_key(|a| a.key());

    match event {
        Event::Fill {
            taker_side,
            maker_order_id,
            quote_size: _,
            base_size,
            maker_callback_info,
            taker_callback_info,
        } => {
            let taker_account_loader = get_user_account_loader(&user_accounts, &taker_callback_info);
            let taker_account = &mut taker_account_loader.load_mut()?;

            let maker_account_loader = get_user_account_loader(&user_accounts, &maker_callback_info);
            let maker_account = &mut maker_account_loader.load_mut()?;

            let borrower: &mut UserAccount;
            let lender: &mut UserAccount;
            match taker_side {
                Side::Ask => {
                    borrower = maker_account;
                    lender = taker_account;
                }, 
                Side::Bid => {
                    borrower = taker_account;
                    lender = maker_account;
                }
            }

            let market_data = &mut market.load_mut()?;

            create_debt(base_size, (maker_order_id >> 64) as u64, lender, borrower, market_data)?;
        }
        Event::Out {
            side,
            order_id,
            base_size,
            delete,
            callback_info,
        } => {
            let user_account_loader = get_user_account_loader(&user_accounts, &callback_info);
            let mut user_account = user_account_loader.load_mut()?;

            msg!("base_size {} delete {}", base_size, delete);

            match side {
                Side::Ask => {
                    user_account.base_locked -= base_size;
                },
                Side::Bid => {
                    user_account.base_open_borrow -= base_size;
                }
            }

            if delete {
                user_account.remove_order(order_id)?;
            }
        }
    }

    Ok(())
}

fn get_user_account_loader<'info>(user_accounts: &Vec<&AccountInfo<'info>>, callback_info: &Vec<u8>) -> AccountLoader<'info, UserAccount> {
    let owner = Pubkey::new(&callback_info[..]);
    let user_account_id = user_accounts.binary_search_by_key(&owner, |acc| acc.key()).unwrap();
    AccountLoader::try_from(&user_accounts[user_account_id]).unwrap()
}
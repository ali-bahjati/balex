use anchor_lang::prelude::*;
use anchor_lang::{AnchorDeserialize, AnchorSerialize};
use anchor_spl::token::{transfer, Token, TokenAccount, Transfer};
use pyth_client::load_price;

declare_id!("CGQawUSGDyLdA96dbaL3YsA61JPdyv1zPYmvDRjpnHjF");

pub static CALLBACK_INFO_LEN: u64 = 32;
pub static CALLBACK_ID_LEN: u64 = 32;

#[program]
pub mod balex {
    use super::*;
    pub fn initialize_market(
        ctx: Context<InitializeMarket>,
        signer_bump: u8,
        base_mint: Pubkey,
        qoute_mint: Pubkey,
        oracle_type: OracleType,
    ) -> ProgramResult {
        let market = &mut ctx.accounts.market;

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
                msg!("Current price is {} conf {}", price.agg.price, price.agg.conf);
            },
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
        }
        transfer(
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

    pub fn set_stub_price(ctx: Context<SetStubPrice>, price: i64, conf: u64) -> ProgramResult {
        ctx.accounts.stub_price.price = price;
        ctx.accounts.stub_price.conf = conf;

        msg!("Price is set to {} conf {}", price, conf);
        
        Ok(())
    }

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

    #[account(init, payer=admin, space = 8 + 32*7 + 3)]
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
    pub price_oracle: AccountInfo<'info>,

    #[account()]
    pub system_program: Program<'info, System>,
}

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

#[derive(Accounts)]
pub struct SetStubPrice<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(init_if_needed, payer=admin)]
    pub stub_price: Account<'info, StubPrice>,
    
    #[account()]
    pub system_program: Program<'info, System>
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
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

#[account]
pub struct LexMarket {
    base_mint: Pubkey,
    qoute_mint: Pubkey,
    base_vault: Pubkey,
    qoute_vault: Pubkey,

    //Ratio of over collateralization, num between 0-100
    over_collateral_percent: u8,

    oracle_type: OracleType,
    price_oracle: Pubkey,

    orderbook: Pubkey,
    admin: Pubkey,

    signer_bump: u8,
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
    // open_orders: [u64; 64] // TODO: Make length adjustable, also user orderId
    // in_debt_orders:
}

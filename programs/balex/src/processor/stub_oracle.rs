use anchor_lang::prelude::*;
use crate::state::{StubPrice};

#[derive(Accounts)]
pub struct SetStubPrice<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(init_if_needed, payer=admin)]
    pub stub_price: Account<'info, StubPrice>,
    
    #[account()]
    pub system_program: Program<'info, System>
}

pub fn set_stub_price(ctx: Context<SetStubPrice>, price: i64, conf: u64) -> ProgramResult {
    ctx.accounts.stub_price.price = price;
    ctx.accounts.stub_price.conf = conf;

    msg!("Price is set to {} conf {}", price, conf);
    
    Ok(())
}

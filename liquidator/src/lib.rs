use std::{rc::Rc};
use std::{thread, time};
use anchor_client::solana_sdk::commitment_config::CommitmentConfig;
use anchor_client::solana_sdk::pubkey::Pubkey;
use anchor_client::solana_sdk::signature::{Keypair};
use anchor_client::{Client, Cluster, Program};
use anchor_client::ClientError;
use anchor_lang::prelude::*;
use spl_token;
use spl_associated_token_account::{get_associated_token_address};
use std::str::FromStr;

use agnostic_orderbook::state::{
    MarketState, MARKET_STATE_LEN, get_side_from_order_id, Side,
};
use balex::state::{UserAccount, get_user_health_factor, get_user_total_debt, get_user_health_factor_after_liquid};
use balex::instruction::{CancelRiskyOrder as CancelRiskyOrderInst, LiquidateDebts as LiquidateDebtsInst};
use balex::accounts::{CancelRiskyOrder as CancelRiskyOrderAccount, LiquidateDebts as LiquidateDebtsAccount};
use balex::accounts::RemUserAccount;
use balex::{
    state::{LexMarket},
};

use error::CrankError;
use solana_client::{
    rpc_client::RpcClient
};
use solana_sdk::signer::Signer;
use solana_sdk::{
    signature::{Signature},
    system_program
};

pub mod error;
pub mod utils;

pub struct Context {
    pub program_id: Pubkey,
    pub market: Pubkey,
    pub reward_target: Pubkey,
    pub fee_payer: Keypair,
    pub endpoint: String,
}

pub const MAX_ITERATIONS: u64 = 10;
pub const MAX_NUMBER_OF_USER_ACCOUNTS: usize = 20;

impl Context {
    pub fn crank(self) {
        let url = Cluster::from_str(&self.endpoint[..]).unwrap();
        let fee_payer_copy = Keypair::from_bytes(&self.fee_payer.to_bytes()[..]).unwrap();
 
        let client = Client::new_with_options(url, Rc::new(fee_payer_copy), CommitmentConfig::confirmed());

        let program = client.program(self.program_id);

        let connection =
            RpcClient::new_with_commitment(self.endpoint.clone(), CommitmentConfig::confirmed());
        
        let market_state_data = connection
            .get_account_data(&self.market)
            .map_err(|_| CrankError::ConnectionError)
            .unwrap();

        let market_state =
            bytemuck::try_from_bytes::<LexMarket>(&market_state_data[8..]).unwrap();

        let orderbook_data = connection
            .get_account_data(&market_state.orderbook)
            .unwrap();

        let orderbook =
            bytemuck::try_from_bytes::<MarketState>(&orderbook_data[..MARKET_STATE_LEN]).unwrap();
        
        loop {
            let res = self.try_liquidate(&connection, orderbook, &program);
            println!("{:#?}", res);
            thread::sleep(time::Duration::from_secs(1));
        }
    }

    pub fn try_liquidate(
        &self,
        connection: &RpcClient,
        orderbook: &MarketState,
        program: &Program,
    ) -> Result<Signature, ClientError> {
        let mut market_state_data = connection
            .get_account_data(&self.market)
            .map_err(|_| CrankError::ConnectionError)
            .unwrap();

        let market_state =
            bytemuck::try_from_bytes_mut::<LexMarket>(&mut market_state_data[8..]).unwrap();

        let mut oracle_account = connection.get_account(&market_state.price_oracle)?;
        let oracle_account_info: AccountInfo = AccountInfo::new(
            &market_state.price_oracle, false, false,
             &mut oracle_account.lamports, &mut oracle_account.data[..], &balex::ID, oracle_account.executable, oracle_account.rent_epoch
        );
        // FIXME: I used balex::ID due to a difference between program id as of now and real one 

        println!("{}", oracle_account_info.data_len());

        let mut owner_pubs: Vec<Pubkey> = Vec::new();

        for &debt in market_state.debts.iter() {
            if debt.qty > 0 {
                owner_pubs.push(debt.borrower);
            }
        }

        owner_pubs.sort_unstable();
        owner_pubs.dedup();

        for opub in owner_pubs {
            let (upub, _bump) = Pubkey::find_program_address(&[&self.market.to_bytes(), &opub.to_bytes()], &self.program_id);
            let mut user_data = connection.get_account_data(&upub).unwrap();
            let user_account = bytemuck::try_from_bytes_mut::<UserAccount>(&mut user_data[8..]).unwrap();

            let health = get_user_health_factor(&user_account, &market_state, &oracle_account_info);
            println!("health {}", health);

            if health < 100 {
                for i in 0..user_account.open_orders_cnt as usize {
                    let order_id = user_account.open_orders[i];

                    if let Side::Ask = get_side_from_order_id(order_id) {
                        continue;
                    }

                    let mut request = program.request();
                    request = request.accounts(CancelRiskyOrderAccount {
                        owner: user_account.owner,
                        user_account: upub,
                        market: self.market,
                        orderbook: market_state.orderbook,
                        system_program: system_program::ID,
                        price_oracle: market_state.price_oracle,
                        asks: Pubkey::new(&orderbook.asks[..]),
                        bids: Pubkey::new(&orderbook.bids[..]),
                        event_queue: Pubkey::new(&orderbook.event_queue[..])
                    });
                    request = request.args(CancelRiskyOrderInst {
                        _bump,
                        order_id: user_account.open_orders[i]
                    });
                    request.send()?;
                    return Ok(Signature::new_unique());
                }

                let total_debt = get_user_total_debt(&user_account, &market_state);

                let mut lo = 0;
                let mut hi = total_debt;

                while lo + 1 < hi {
                    let mid = (lo + hi)/2;

                    let health = get_user_health_factor_after_liquid(mid,&user_account, &market_state, &oracle_account_info);

                    if health < 100 {
                        lo = mid;
                    } else {
                        hi = mid;
                    }
                }

                let mut liquid_value = hi;
                println!("Liquid value is {}", liquid_value);
                let mut debt_ids: Vec<u16> = Vec::new();
                let mut debt_qty: Vec<u64> = Vec::new();

                for i in 0..user_account.open_debts_cnt as usize {
                    let debt_id = user_account.open_debts[i];
                    debt_ids.push(debt_id);
                    debt_qty.push(0);
                }

                while liquid_value > 0 {
                    for i in 0..user_account.open_debts_cnt as usize {
                        let debt_id = user_account.open_debts[i];
                        let debt = &market_state.debts[debt_id as usize];

                        let take = (debt.qty - debt.liquid_qty - debt_qty[i] + 1)/2;
                        let take = take.min(liquid_value);
                        debt_qty[i] += take;
                        liquid_value -= take;

                        if liquid_value == 0 {
                            break;
                        }
                    }
                }

                let market_signer = Pubkey::find_program_address(&[&self.market.to_bytes()], &balex::ID).0;

                let mut request = program.request();
                request = request.accounts(LiquidateDebtsAccount {
                    liquidator: self.fee_payer.pubkey(),
                    market: self.market,
                    base_vault: market_state.base_vault,
                    quote_vault: market_state.quote_vault,
                    price_oracle: market_state.price_oracle,
                    borrower_account: upub,
                    token_program: spl_token::ID,
                    market_signer,
                    token_base_src: get_associated_token_address(&self.reward_target, &market_state.base_mint),
                    token_quote_dest: get_associated_token_address(&self.reward_target, &market_state.quote_mint),
                });

                for i in 0..user_account.open_debts_cnt as usize {
                    if debt_qty[i] == 0 {
                        continue;
                    }
                    let debt_id = user_account.open_debts[i];
                    let debt = &market_state.debts[debt_id as usize];
                    let lender_user = Pubkey::find_program_address(&[&self.market.to_bytes(), &debt.lender.to_bytes()], &self.program_id).0;
                    request = request.accounts(RemUserAccount{
                        user_account: lender_user
                    })
                }
                request = request.args(LiquidateDebtsInst {
                    debts_amount: debt_qty,
                    debts_id: debt_ids
                });
                request.send()?;
            }
        }

        Ok(Signature::new_unique())
    }
}

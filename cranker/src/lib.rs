use std::str::FromStr;
use std::{cell::RefCell, rc::Rc};
use std::{thread, time};
use anchor_client::solana_sdk::commitment_config::CommitmentConfig;
use anchor_client::solana_sdk::pubkey::Pubkey;
use anchor_client::solana_sdk::signature::{Keypair};
use anchor_client::{Client, Cluster, Program};
use anchor_client::ClientError;
use anchor_lang::prelude::*;


use agnostic_orderbook::state::{
    Event, EventQueue, EventQueueHeader, MarketState, MARKET_STATE_LEN,
};
use borsh::BorshDeserialize;
use balex::instruction::ConsumeOrderEvents as InstructionConsume;
use balex::{
    state::{LexMarket},
    state::CALLBACK_INFO_LEN,
};
use balex::accounts::{ConsumerOrderEvents, RemUserAccount};

use error::CrankError;
use solana_client::{
    rpc_client::RpcClient
};
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

pub const MAX_ITERATIONS: u64 = 1;
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
            let res = self.consume_events_iteration(&connection, &orderbook, &market_state, &program);
            println!("{:#?}", res);
            thread::sleep(time::Duration::from_secs(1));
        }
    }

    pub fn consume_events_iteration(
        &self,
        connection: &RpcClient,
        orderbook: &MarketState,
        market_state: &LexMarket,
        program: &Program,
    ) -> Result<Signature, ClientError> {
        let mut event_queue_data =
            connection.get_account_data(&Pubkey::new(&orderbook.event_queue))?;
        let event_queue_header =
            EventQueueHeader::deserialize(&mut (&event_queue_data as &[u8])).unwrap();
        let length = event_queue_header.count as usize;
        let event_queue = EventQueue::new(
            event_queue_header,
            Rc::new(RefCell::new(&mut event_queue_data)),
            CALLBACK_INFO_LEN as usize,
        );
        let mut user_accounts = Vec::with_capacity(length << 1);
        for e in event_queue.iter() {
            match e {
                Event::Fill {
                    taker_side: _,
                    maker_order_id: _,
                    quote_size: _,
                    base_size: _,
                    maker_callback_info,
                    taker_callback_info,
                } => {
                    user_accounts.push(maker_callback_info);
                    user_accounts.push(taker_callback_info);
                }
                Event::Out {
                    side: _,
                    order_id: _,
                    base_size: _,
                    delete: _,
                    callback_info,
                } => {
                    user_accounts.push(callback_info);
                }
            }
        }


        user_accounts.truncate(MAX_NUMBER_OF_USER_ACCOUNTS);

        // We don't use the default sort since the initial ordering of the pubkeys is completely random
        user_accounts.sort_unstable();
        // Since the array is sorted, this removes all duplicate accounts, which shrinks the array.
        user_accounts.dedup();

        if user_accounts.len() == 0 {
            return Ok(Signature::new_unique());
        }



        let mut request = program.request();
        request = request.accounts(ConsumerOrderEvents{
            market: self.market,
            orderbook: market_state.orderbook,
            event_queue: Pubkey::new(&orderbook.event_queue[..]),
            system_program: system_program::ID
        });

        for user_account in user_accounts {
            let user_pubkey = Pubkey::new(&user_account[..]);
            request = request.accounts(RemUserAccount{
                user_account: user_pubkey
            })
        }

        request = request.args(InstructionConsume {
            max_iterations: MAX_ITERATIONS
        });

        println!("ATTENTION =====================================================");

        request.send()
    }
}

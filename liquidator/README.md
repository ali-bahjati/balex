# BaLeX Liquidator 

** Adopted from bonfida's dex-4 cranker **


## Building

In the current directory, run :

`cargo build --release`

This will output an executable at `target/release/balex-liquidator`

## Usage

```sh
balex-liquidator --fee-payer <KEYPAIR> --market <market> --program-id <program_id> --reward-target <reward-target>
```

Run `balex-liquidator --help` for more options and more information.

Reward target should have associated accounts for the mint tokens of market

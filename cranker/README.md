# BaLeX cranker

** Adopted from bonfida's dex-4 cranker **

The dex cranker reads the current event queue and sends a cranking `consume_events` transaction. The signing cranking authority must have
an associated token account containing at least one MSRM token in order for the cranking to succeed.

## Building

In the current directory, run :

`cargo build --release`

This will output an executable at `target/release/balex-cranker`

## Usage

```sh
balex-cranker --fee-payer <KEYPAIR> --market <market> --program-id <program_id> --reward-target <reward-target>
```

Run `balex-cranker --help` for more options and more information.

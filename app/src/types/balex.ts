export type Balex = {
  "version": "0.1.0",
  "name": "balex",
  "instructions": [
    {
      "name": "initializeMarket",
      "accounts": [
        {
          "name": "admin",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "market",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "baseVault",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "quoteVault",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "eventQueue",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "orderbook",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "asks",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "bids",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "priceOracle",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "signerBump",
          "type": "u8"
        },
        {
          "name": "baseMint",
          "type": "publicKey"
        },
        {
          "name": "quoteMint",
          "type": "publicKey"
        },
        {
          "name": "oracleType",
          "type": {
            "defined": "OracleType"
          }
        }
      ]
    },
    {
      "name": "initializeAccount",
      "accounts": [
        {
          "name": "owner",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "market",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "userAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "bump",
          "type": "u8"
        }
      ]
    },
    {
      "name": "deposit",
      "accounts": [
        {
          "name": "owner",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "market",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenSource",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "bump",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "setStubPrice",
      "accounts": [
        {
          "name": "admin",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "stubPrice",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "price",
          "type": "i64"
        },
        {
          "name": "conf",
          "type": "u64"
        }
      ]
    },
    {
      "name": "newOrder",
      "accounts": [
        {
          "name": "owner",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "market",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "eventQueue",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "orderbook",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "asks",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "bids",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "priceOracle",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "bump",
          "type": "u8"
        },
        {
          "name": "sideNum",
          "type": "u8"
        },
        {
          "name": "interestRate",
          "type": "u64"
        },
        {
          "name": "qty",
          "type": "u64"
        }
      ]
    },
    {
      "name": "cancelMyOrder",
      "accounts": [
        {
          "name": "owner",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "market",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "eventQueue",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "orderbook",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "asks",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "bids",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "bump",
          "type": "u8"
        },
        {
          "name": "orderId",
          "type": "u128"
        }
      ]
    },
    {
      "name": "cancelRiskyOrder",
      "accounts": [
        {
          "name": "owner",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "market",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "eventQueue",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "orderbook",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "asks",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "bids",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "priceOracle",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "bump",
          "type": "u8"
        },
        {
          "name": "orderId",
          "type": "u128"
        }
      ]
    },
    {
      "name": "consumeOrderEvents",
      "accounts": [
        {
          "name": "market",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "eventQueue",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "orderbook",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "maxIterations",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdraw",
      "accounts": [
        {
          "name": "owner",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "market",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "marketSigner",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenDest",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "priceOracle",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "bump",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "settleDebt",
      "accounts": [
        {
          "name": "owner",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "borrowerAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "lenderAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "market",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "bump",
          "type": "u8"
        },
        {
          "name": "debtId",
          "type": "u16"
        }
      ]
    },
    {
      "name": "liquidateDebts",
      "accounts": [
        {
          "name": "liquidator",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "borrowerAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "market",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "marketSigner",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "baseVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "quoteVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenBaseSrc",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenQuoteDest",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "priceOracle",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "debtsId",
          "type": {
            "vec": "u16"
          }
        },
        {
          "name": "debtsAmount",
          "type": {
            "vec": "u64"
          }
        }
      ]
    },
    {
      "name": "orderDummy",
      "accounts": [
        {
          "name": "userAccount",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "stubPrice",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "price",
            "type": "i64"
          },
          {
            "name": "conf",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "lexMarket",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "baseMint",
            "type": "publicKey"
          },
          {
            "name": "quoteMint",
            "type": "publicKey"
          },
          {
            "name": "baseVault",
            "type": "publicKey"
          },
          {
            "name": "quoteVault",
            "type": "publicKey"
          },
          {
            "name": "priceOracle",
            "type": "publicKey"
          },
          {
            "name": "orderbook",
            "type": "publicKey"
          },
          {
            "name": "admin",
            "type": "publicKey"
          },
          {
            "name": "debts",
            "type": {
              "array": [
                {
                  "defined": "Debt"
                },
                256
              ]
            }
          },
          {
            "name": "overCollateralPercent",
            "type": "u8"
          },
          {
            "name": "signerBump",
            "type": "u8"
          },
          {
            "name": "oracleType",
            "type": {
              "defined": "OracleType"
            }
          },
          {
            "name": "padding",
            "type": {
              "array": [
                "u8",
                5
              ]
            }
          }
        ]
      }
    },
    {
      "name": "userAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "publicKey"
          },
          {
            "name": "baseFree",
            "type": "u64"
          },
          {
            "name": "baseLocked",
            "type": "u64"
          },
          {
            "name": "baseOpenLend",
            "type": "u64"
          },
          {
            "name": "baseOpenBorrow",
            "type": "u64"
          },
          {
            "name": "quoteTotal",
            "type": "u64"
          },
          {
            "name": "openOrders",
            "type": {
              "array": [
                "u128",
                16
              ]
            }
          },
          {
            "name": "openDebts",
            "type": {
              "array": [
                "u16",
                16
              ]
            }
          },
          {
            "name": "openOrdersCnt",
            "type": "u8"
          },
          {
            "name": "openDebtsCnt",
            "type": "u8"
          },
          {
            "name": "padding",
            "type": {
              "array": [
                "u8",
                6
              ]
            }
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "Debt",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "lender",
            "type": "publicKey"
          },
          {
            "name": "borrower",
            "type": "publicKey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "interestRate",
            "type": "u64"
          },
          {
            "name": "qty",
            "type": "u64"
          },
          {
            "name": "liquidQty",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "OracleType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Stub"
          },
          {
            "name": "Pyth"
          }
        ]
      }
    }
  ]
};

export const IDL: Balex = {
  "version": "0.1.0",
  "name": "balex",
  "instructions": [
    {
      "name": "initializeMarket",
      "accounts": [
        {
          "name": "admin",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "market",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "baseVault",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "quoteVault",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "eventQueue",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "orderbook",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "asks",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "bids",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "priceOracle",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "signerBump",
          "type": "u8"
        },
        {
          "name": "baseMint",
          "type": "publicKey"
        },
        {
          "name": "quoteMint",
          "type": "publicKey"
        },
        {
          "name": "oracleType",
          "type": {
            "defined": "OracleType"
          }
        }
      ]
    },
    {
      "name": "initializeAccount",
      "accounts": [
        {
          "name": "owner",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "market",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "userAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "bump",
          "type": "u8"
        }
      ]
    },
    {
      "name": "deposit",
      "accounts": [
        {
          "name": "owner",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "market",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenSource",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "bump",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "setStubPrice",
      "accounts": [
        {
          "name": "admin",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "stubPrice",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "price",
          "type": "i64"
        },
        {
          "name": "conf",
          "type": "u64"
        }
      ]
    },
    {
      "name": "newOrder",
      "accounts": [
        {
          "name": "owner",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "market",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "eventQueue",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "orderbook",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "asks",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "bids",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "priceOracle",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "bump",
          "type": "u8"
        },
        {
          "name": "sideNum",
          "type": "u8"
        },
        {
          "name": "interestRate",
          "type": "u64"
        },
        {
          "name": "qty",
          "type": "u64"
        }
      ]
    },
    {
      "name": "cancelMyOrder",
      "accounts": [
        {
          "name": "owner",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "market",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "eventQueue",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "orderbook",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "asks",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "bids",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "bump",
          "type": "u8"
        },
        {
          "name": "orderId",
          "type": "u128"
        }
      ]
    },
    {
      "name": "cancelRiskyOrder",
      "accounts": [
        {
          "name": "owner",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "market",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "eventQueue",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "orderbook",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "asks",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "bids",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "priceOracle",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "bump",
          "type": "u8"
        },
        {
          "name": "orderId",
          "type": "u128"
        }
      ]
    },
    {
      "name": "consumeOrderEvents",
      "accounts": [
        {
          "name": "market",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "eventQueue",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "orderbook",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "maxIterations",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdraw",
      "accounts": [
        {
          "name": "owner",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "userAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "market",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "marketSigner",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenDest",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "priceOracle",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "bump",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "settleDebt",
      "accounts": [
        {
          "name": "owner",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "borrowerAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "lenderAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "market",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "bump",
          "type": "u8"
        },
        {
          "name": "debtId",
          "type": "u16"
        }
      ]
    },
    {
      "name": "liquidateDebts",
      "accounts": [
        {
          "name": "liquidator",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "borrowerAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "market",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "marketSigner",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "baseVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "quoteVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenBaseSrc",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenQuoteDest",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "priceOracle",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "debtsId",
          "type": {
            "vec": "u16"
          }
        },
        {
          "name": "debtsAmount",
          "type": {
            "vec": "u64"
          }
        }
      ]
    },
    {
      "name": "orderDummy",
      "accounts": [
        {
          "name": "userAccount",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "stubPrice",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "price",
            "type": "i64"
          },
          {
            "name": "conf",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "lexMarket",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "baseMint",
            "type": "publicKey"
          },
          {
            "name": "quoteMint",
            "type": "publicKey"
          },
          {
            "name": "baseVault",
            "type": "publicKey"
          },
          {
            "name": "quoteVault",
            "type": "publicKey"
          },
          {
            "name": "priceOracle",
            "type": "publicKey"
          },
          {
            "name": "orderbook",
            "type": "publicKey"
          },
          {
            "name": "admin",
            "type": "publicKey"
          },
          {
            "name": "debts",
            "type": {
              "array": [
                {
                  "defined": "Debt"
                },
                256
              ]
            }
          },
          {
            "name": "overCollateralPercent",
            "type": "u8"
          },
          {
            "name": "signerBump",
            "type": "u8"
          },
          {
            "name": "oracleType",
            "type": {
              "defined": "OracleType"
            }
          },
          {
            "name": "padding",
            "type": {
              "array": [
                "u8",
                5
              ]
            }
          }
        ]
      }
    },
    {
      "name": "userAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "publicKey"
          },
          {
            "name": "baseFree",
            "type": "u64"
          },
          {
            "name": "baseLocked",
            "type": "u64"
          },
          {
            "name": "baseOpenLend",
            "type": "u64"
          },
          {
            "name": "baseOpenBorrow",
            "type": "u64"
          },
          {
            "name": "quoteTotal",
            "type": "u64"
          },
          {
            "name": "openOrders",
            "type": {
              "array": [
                "u128",
                16
              ]
            }
          },
          {
            "name": "openDebts",
            "type": {
              "array": [
                "u16",
                16
              ]
            }
          },
          {
            "name": "openOrdersCnt",
            "type": "u8"
          },
          {
            "name": "openDebtsCnt",
            "type": "u8"
          },
          {
            "name": "padding",
            "type": {
              "array": [
                "u8",
                6
              ]
            }
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "Debt",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "lender",
            "type": "publicKey"
          },
          {
            "name": "borrower",
            "type": "publicKey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "interestRate",
            "type": "u64"
          },
          {
            "name": "qty",
            "type": "u64"
          },
          {
            "name": "liquidQty",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "OracleType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Stub"
          },
          {
            "name": "Pyth"
          }
        ]
      }
    }
  ]
};

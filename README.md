# Online Bookstore DApp

## Overview

Online Bookstore is a decentralized application (DApp) built on Ethereum that allows users to purchase and access digital books using cryptocurrency. The project was developed to explore real-world Web3 concepts such as smart contract development, ERC-20 token integration, wallet connectivity, and decentralized payment flows.

The application provides a complete ecosystem with both user and admin functionalities. Users can browse available books, connect their wallets, purchase books using ETH or a custom ERC-20 token (JG Token), and access purchased content through their personal library. The platform also includes a token claiming mechanism that allows users to receive JG tokens for testing and interaction within the application.

On the administrative side, the application enables book management, pricing updates, metadata modification, and withdrawal of collected funds from the smart contract.

#### DApp Link: https://ethereum-book-store.vercel.app/
#### Workflow Video: https://youtu.be/KScMybHk2EI?si=1m9fxsmha924v5SW 

## Key Features

### User Features

* Connect wallets using MetaMask and WalletConnect
* Browse available books
* Purchase books using ETH
* Purchase books using JG ERC-20 tokens
* Claim JG tokens for testing purposes
* Access purchased books in a personal library
* Mobile wallet support through WalletConnect

### Admin Features

* Add new books
* Manage book inventory
* Update book prices
* Modify book metadata
* Withdraw collected funds to the admin wallet

## Smart Contract Features

* ERC-20 token implementation (JG Token)
* Secure payment processing
* On-chain purchase tracking
* Ownership verification for purchased books
* Administrative access control

## Technology Stack

### Blockchain

* Solidity
* Ethereum
* Foundry
* ERC-20 Standard

### Frontend

* React
* Vite
* JavaScript
* CSS

### Wallet Integration

* MetaMask
* WalletConnect

## Learning Outcomes

Through this project, I gained practical experience in:

* Smart contract development and deployment
* ERC-20 token creation and integration
* Web3 wallet connectivity
* Frontend and blockchain interaction
* Designing token-based payment systems
* Building full-stack decentralized applications



##
### Foundry

**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**

Foundry consists of:

- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
- **Chisel**: Fast, utilitarian, and verbose solidity REPL.

## Documentation

https://book.getfoundry.sh/

## Usage

### Build

```shell
$ forge build
```

### Test

```shell
$ forge test
```

### Format

```shell
$ forge fmt
```

### Gas Snapshots

```shell
$ forge snapshot
```

### Anvil

```shell
$ anvil
```

### Deploy

```shell
$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
```

### Cast

```shell
$ cast <subcommand>
```

### Help

```shell
$ forge --help
$ anvil --help
$ cast --help
```

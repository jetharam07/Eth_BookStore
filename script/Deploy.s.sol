// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/JGToken.sol";
import "../src/BookStore.sol";

contract Deploy is Script {
    function run() external {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(privateKey);

        // 1. Deploy JGToken (owner = your deployer wallet)
        JGToken token = new JGToken();

        // 2. Deploy BookPaymentsV2 (owner = your deployer wallet)
        BookPaymentsV2 store = new BookPaymentsV2();

        // 3. Connect token to store
        store.setTokenAddress(address(token));

        vm.stopBroadcast();
    }
}

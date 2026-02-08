// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {TaskmintBounty} from "../src/TaskmintBounty.sol";
import {TaskmintFactory} from "../src/TaskmintFactory.sol";
import {TaskmintRouter} from "../src/TaskmintRouter.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        // Base Sepolia EAS address
        address eas = vm.envOr("EAS_CONTRACT", address(0x4200000000000000000000000000000000000021));

        vm.startBroadcast(deployerKey);

        // 1. Deploy bounty implementation (not used directly, only as clone template)
        TaskmintBounty bountyImpl = new TaskmintBounty();
        console.log("TaskmintBounty impl:", address(bountyImpl));

        // 2. Deploy router
        TaskmintRouter router = new TaskmintRouter();
        console.log("TaskmintRouter:", address(router));

        // 3. Deploy factory (treasury = deployer for now, 2.5% fee)
        address treasury = vm.addr(deployerKey);
        TaskmintFactory factory = new TaskmintFactory(
            address(bountyImpl),
            treasury,
            eas,
            250 // 2.5%
        );
        console.log("TaskmintFactory:", address(factory));

        vm.stopBroadcast();
    }
}

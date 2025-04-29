import { createPublicClient, http, parseAbi, parseEventLogs } from "viem";
import { defineChain } from "viem";

// Define the custom Anvil chain
const anvil = defineChain({
  id: 31337,
  name: "Anvil",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["http://127.0.0.1:8545"],
    },
  },
});

// Replace with your deployed contract's address
const contractAddress = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";

// Create a Viem public client
const publicClient = createPublicClient({
  chain: anvil,
  transport: http(),
});

// Define all event signatures
const abi = parseAbi([
  "event DepositEvent(address indexed user, uint256 amount, uint256 oldTotalDeposits, uint256 newTotalDeposits, uint256 oldUserDeposit, uint256 newUserDeposit)",
  "event WithdrawalEvent(address indexed user, uint256 amount, uint256 oldTotalDeposits, uint256 newTotalDeposits, uint256 oldUserDeposit, uint256 newUserDeposit)",
  "event BorrowEvent(address indexed user, uint256 amount, uint256 oldBorrow, uint256 newBorrow, uint256 maxBorrowAllowed)",
  "event RepaymentEvent(address indexed user, uint256 amount, uint256 oldBorrow, uint256 newBorrow)",
  "event TreasurySet(address indexed treasuryAddress)",
]);

// Subscribe to all defined events
publicClient.watchEvent({
  address: contractAddress,
  events: abi,
  pollingInterval: 1000, // 1 second
  onLogs: (logs) => {
    try {
      const parsedLogs = parseEventLogs({
        abi,
        logs,
      });

      parsedLogs.forEach((log) => {
        console.log(`📢 New ${log.eventName}:`);
        for (const [key, value] of Object.entries(log.args)) {
          console.log(`  - ${key}: ${value}`);
        }
      });
    } catch (error) {
      console.error("Error parsing logs:", error);
    }
  },
});

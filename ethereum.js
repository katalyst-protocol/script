import { createPublicClient, http } from "viem";
import { defineChain } from "viem";

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

// Replace with your actual contract address
const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

// Define the ABI for your contract events
const contractAbi = [
  {
    type: "event",
    name: "DepositEvent",
    inputs: [
      { type: "address", name: "user", indexed: true },
      { type: "uint256", name: "amount", indexed: false },
      { type: "uint256", name: "oldTotalDeposits", indexed: false },
      { type: "uint256", name: "newTotalDeposits", indexed: false },
      { type: "uint256", name: "oldUserDeposit", indexed: false },
      { type: "uint256", name: "newUserDeposit", indexed: false },
    ],
  },
  {
    type: "event",
    name: "WithdrawalEvent",
    inputs: [
      { type: "address", name: "user", indexed: true },
      { type: "uint256", name: "amount", indexed: false },
      { type: "uint256", name: "oldTotalDeposits", indexed: false },
      { type: "uint256", name: "newTotalDeposits", indexed: false },
      { type: "uint256", name: "oldUserDeposit", indexed: false },
      { type: "uint256", name: "newUserDeposit", indexed: false },
    ],
  },
  {
    type: "event",
    name: "BorrowEvent",
    inputs: [
      { type: "address", name: "user", indexed: true },
      { type: "uint256", name: "amount", indexed: false },
      { type: "uint256", name: "oldBorrow", indexed: false },
      { type: "uint256", name: "newBorrow", indexed: false },
      { type: "uint256", name: "maxBorrowAllowed", indexed: false },
    ],
  },
  {
    type: "event",
    name: "RepaymentEvent",
    inputs: [
      { type: "address", name: "user", indexed: true },
      { type: "uint256", name: "amount", indexed: false },
      { type: "uint256", name: "oldBorrow", indexed: false },
      { type: "uint256", name: "newBorrow", indexed: false },
    ],
  },
  {
    type: "event",
    name: "TreasurySet",
    inputs: [{ type: "address", name: "treasuryAddress", indexed: true }],
  },
];

// Create a public client
const publicClient = createPublicClient({
  chain: anvil,
  transport: http(),
});

async function getRecentBlockNumber() {
  return await publicClient.getBlockNumber();
}

async function fetchEvents(fromBlock, toBlock) {
  // Convert block numbers to proper hexadecimal strings if they're not already
  const fromBlockHex =
    typeof fromBlock === "string"
      ? fromBlock
      : typeof fromBlock === "bigint"
      ? `0x${fromBlock.toString(16)}`
      : `0x${fromBlock.toString(16)}`;

  const toBlockHex =
    typeof toBlock === "string"
      ? toBlock
      : typeof toBlock === "bigint"
      ? `0x${toBlock.toString(16)}`
      : `0x${toBlock.toString(16)}`;

  console.log(`Fetching events from block ${fromBlockHex} to ${toBlockHex}`);

  try {
    // Get all topics from your ABI events
    const eventSignatures = contractAbi
      .filter((item) => item.type === "event")
      .map((event) =>
        publicClient.createEventSignature({
          name: event.name,
          inputs: event.inputs,
        })
      );

    // First try with getLogs directly, which might be more flexible with Anvil
    const logs = await publicClient.request({
      method: "eth_getLogs",
      params: [
        {
          address: CONTRACT_ADDRESS,
          topics: [eventSignatures],
          fromBlock: fromBlockHex,
          toBlock: toBlockHex,
        },
      ],
    });

    if (logs.length === 0) {
      console.log("No events found in this block range");
      return;
    }

    // Decode and process logs
    const decodedLogs = [];
    for (const log of logs) {
      try {
        const decoded = publicClient.decodeEventLog({
          abi: contractAbi,
          data: log.data,
          topics: log.topics,
        });

        decodedLogs.push({
          ...decoded,
          blockNumber: BigInt(log.blockNumber),
          transactionHash: log.transactionHash,
          logIndex: BigInt(log.logIndex),
        });
      } catch (e) {
        console.warn("Could not decode log:", e);
      }
    }

    // Group events by type
    const groupedEvents = {};
    for (const event of decodedLogs) {
      const eventName = event.eventName;
      if (!groupedEvents[eventName]) {
        groupedEvents[eventName] = [];
      }
      groupedEvents[eventName].push(event);
    }

    // Log events by type
    console.log("\n=== Events By Type ===");
    for (const [eventType, events] of Object.entries(groupedEvents)) {
      console.log(`\n${eventType.toUpperCase()} EVENTS (${events.length}):`);
      for (const event of events) {
        console.log(formatEvent(event));
      }
    }

    // Log the total number of events
    console.log(`\nTotal events found: ${decodedLogs.length}`);
  } catch (error) {
    console.error("Error fetching events:", error);

    // Alternative approach: try fetching each event type individually
    console.log("Attempting to fetch events by type individually...");

    try {
      let allEvents = [];

      for (const eventDef of contractAbi.filter(
        (item) => item.type === "event"
      )) {
        try {
          const events = await publicClient.getContractEvents({
            address: CONTRACT_ADDRESS,
            abi: [eventDef],
            eventName: eventDef.name,
            fromBlock: fromBlockHex,
            toBlock: toBlockHex,
          });

          console.log(`Found ${events.length} ${eventDef.name} events`);
          allEvents = [...allEvents, ...events];
        } catch (e) {
          console.warn(`Error fetching ${eventDef.name} events:`, e);
        }
      }

      if (allEvents.length > 0) {
        // Process events as before
        console.log(`Found a total of ${allEvents.length} events`);

        // Group events by type
        const groupedEvents = {};
        for (const event of allEvents) {
          const eventName = event.eventName;
          if (!groupedEvents[eventName]) {
            groupedEvents[eventName] = [];
          }
          groupedEvents[eventName].push(event);
        }

        // Log events by type
        console.log("\n=== Events By Type ===");
        for (const [eventType, events] of Object.entries(groupedEvents)) {
          console.log(
            `\n${eventType.toUpperCase()} EVENTS (${events.length}):`
          );
          for (const event of events) {
            console.log(formatEvent(event));
          }
        }
      } else {
        console.log("No events found using alternative approach");
      }
    } catch (fallbackError) {
      console.error("Both approaches failed:", fallbackError);
    }
  }
}

function formatEvent(event) {
  return {
    eventName: event.eventName,
    blockNumber: event.blockNumber,
    transactionHash: event.transactionHash,
    args: event.args,
    // Format BigInt values for better display
    formattedArgs: formatBigIntValues(event.args),
  };
}

function formatBigIntValues(obj) {
  if (!obj) return null;

  const formatted = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "bigint") {
      formatted[key] = value.toString();
    } else {
      formatted[key] = value;
    }
  }
  return formatted;
}

// Function to fetch specific event types
async function fetchEventsByType(eventName, fromBlock, toBlock) {
  // Convert block numbers to proper hexadecimal strings
  const fromBlockHex =
    typeof fromBlock === "string"
      ? fromBlock
      : typeof fromBlock === "bigint"
      ? `0x${fromBlock.toString(16)}`
      : `0x${fromBlock.toString(16)}`;

  const toBlockHex =
    typeof toBlock === "string"
      ? toBlock
      : typeof toBlock === "bigint"
      ? `0x${toBlock.toString(16)}`
      : `0x${toBlock.toString(16)}`;

  console.log(
    `Fetching ${eventName} events from block ${fromBlockHex} to ${toBlockHex}`
  );

  try {
    const eventAbi = contractAbi.find(
      (item) => item.type === "event" && item.name === eventName
    );

    if (!eventAbi) {
      throw new Error(`Event ${eventName} not found in ABI`);
    }

    const events = await publicClient.getContractEvents({
      address: CONTRACT_ADDRESS,
      abi: [eventAbi],
      eventName,
      fromBlock: fromBlockHex,
      toBlock: toBlockHex,
    });

    console.log(`\n=== ${eventName} Events (${events.length}) ===`);
    for (const event of events) {
      console.log(formatEvent(event));
    }
  } catch (error) {
    console.error(`Error fetching ${eventName} events:`, error);
  }
}

// Fetch events for a specific user address
async function fetchUserEvents(userAddress, fromBlock, toBlock) {
  const fromBlockHex = `0x${BigInt(fromBlock).toString(16)}`;
  const toBlockHex = `0x${BigInt(toBlock).toString(16)}`;

  console.log(
    `Fetching events for user ${userAddress} from block ${fromBlockHex} to ${toBlockHex}`
  );

  const userEvents = [];

  const eventTypes = contractAbi
    .filter(
      (item) =>
        item.type === "event" && item.inputs.some((i) => i.name === "user")
    )
    .map((event) => event.name);

  for (const eventName of eventTypes) {
    try {
      const eventAbi = contractAbi.find((e) => e.name === eventName);
      const userTopic = userAddress
        .toLowerCase()
        .replace("0x", "0x" + "0".repeat(24)); // padded address

      const logs = await publicClient.getContractEvents({
        address: CONTRACT_ADDRESS,
        abi: [eventAbi],
        eventName,
        fromBlock: fromBlockHex,
        toBlock: toBlockHex,
        args: { user: userAddress },
      });

      console.log(
        `Found ${logs.length} ${eventName} events for user ${userAddress}`
      );
      userEvents.push(...logs);
    } catch (error) {
      console.warn(`Failed to fetch ${eventName} for user:`, error);
    }
  }

  for (const event of userEvents) {
    console.log(formatEvent(event));
  }
}

// Main function with examples of different ways to use the event listeners
async function main() {
  try {
    const latestBlock = await getRecentBlockNumber();
    console.log(`Latest block: ${latestBlock}`);

    // Convert block numbers to hexadecimal strings
    const fromBlock = "0x0"; // Starting from block 0
    const toBlock = `0x${latestBlock.toString(16)}`; // Latest block in hex

    console.log(`Fetching events from block ${fromBlock} to ${toBlock}`);

    // Example 1: Fetch all events
    await fetchEvents(fromBlock, toBlock);

    // Example 2: Fetch specific event type
    // await fetchEventsByType('DepositEvent', fromBlock, toBlock);

    // Example 3: Fetch events for a specific user
    // Replace with an actual user address from your contract
    // const userAddress = '0xYourUserAddressHere';
    // await fetchUserEvents(userAddress, fromBlock, toBlock);

    // Example 4: Listen for new events (poll every 10 seconds)
    // Create an event monitor
    // Note: For production use, consider using WebSockets instead of polling
    if (process.env.MONITOR_EVENTS === "true") {
      console.log("\n=== Starting Event Monitor ===");
      let lastCheckedBlock = latestBlock;

      setInterval(async () => {
        const newLatestBlock = await getRecentBlockNumber();
        if (newLatestBlock > lastCheckedBlock) {
          console.log(
            `\nNew blocks detected: ${
              lastCheckedBlock + 1n
            } to ${newLatestBlock}`
          );

          const fromHex = `0x${(lastCheckedBlock + 1n).toString(16)}`;
          const toHex = `0x${newLatestBlock.toString(16)}`;

          await fetchEvents(fromHex, toHex);
          lastCheckedBlock = newLatestBlock;
        } else {
          console.log(`No new blocks since ${lastCheckedBlock}`);
        }
      }, 10000); // Check every 10 seconds
    }
  } catch (error) {
    console.error("Error in main function:", error);
  }
}

// Run the main function
main().catch(console.error);

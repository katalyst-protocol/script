import {
  humanizeEvents,
  nativeToScVal,
  scValToNative,
  Address,
  xdr,
} from "@stellar/stellar-sdk";
import { Server } from "@stellar/stellar-sdk/rpc";

// Replace with your actual deployed contract ID
const CONTRACT_ID = "CBO3M3U7YOIJX63SLBOGZ3VQ4H3ZRX22OJR2BYRP5MWNX62QK6VSSX5W"; // 56-character string

const s = new Server("https://soroban-testnet.stellar.org");

async function main() {
  const response = await s.getLatestLedger();

  // Create filters for all event types
  const depositFilter = createEventFilter("deposited");
  const withdrawalFilter = createEventFilter("withdrawn");
  const borrowFilter = createEventFilter("borrowed");
  const repaymentFilter = createEventFilter("repaid");

  // Combine all filters
  const allFilters = [
    depositFilter,
    withdrawalFilter,
    borrowFilter,
    repaymentFilter,
  ];

  let page = await s.getEvents({
    startLedger: response.sequence - 120,
    filters: allFilters,
    limit: 10,
  });

  while (true) {
    if (!page.events.length) {
      // console.log("No events found, waiting...");
      await new Promise((r) => setTimeout(r, 2000));
    } else {
      console.log("\n=== Simplified Events ===");
      console.log(cereal(simpleEventLog(page.events)));

      console.log("\n=== Full Humanized Events ===");
      console.log(cereal(fullEventLog(page.events)));

      // Group events by type for better readability
      const eventsByType = groupEventsByType(page.events);
      if (Object.keys(eventsByType).length > 0) {
        console.log("\n=== Events By Type ===");
        for (const [eventType, events] of Object.entries(eventsByType)) {
          console.log(`\n${eventType.toUpperCase()} EVENTS:`);
          console.log(cereal(simpleEventLog(events)));
        }
      }
    }

    page = await s.getEvents({
      filters: allFilters,
      cursor: page.cursor,
      limit: 10,
    });
  }
}

function createEventFilter(eventType) {
  return {
    type: "contract",
    contractIds: [CONTRACT_ID],
    topics: [
      [
        nativeToScVal(eventType, { type: "symbol" }).toXDR("base64"),
        "*", // user Address
      ],
    ],
  };
}

function simpleEventLog(events) {
  return events.map((event) => {
    return {
      topics: event.topic.map((t) => scValToNative(t)),
      value: scValToNative(event.value),
    };
  });
}

function fullEventLog(events) {
  return humanizeEvents(
    events.map((event) => {
      return new xdr.ContractEvent({
        contractId: Address.fromString(event.contractId.address().toString())
          .toScAddress()
          .contractId(),
        type: xdr.ContractEventType.contract(),
        body: new xdr.ContractEventBody(
          0,
          new xdr.ContractEventV0({
            topics: event.topic,
            data: event.value,
          })
        ),
      });
    })
  );
}

function groupEventsByType(events) {
  const grouped = {};

  for (const event of events) {
    // Get the event type from the first topic
    const eventTypeScVal = event.topic[0];
    const eventType = scValToNative(eventTypeScVal);

    if (!grouped[eventType]) {
      grouped[eventType] = [];
    }

    grouped[eventType].push(event);
  }

  return grouped;
}

function cereal(data) {
  return JSON.stringify(
    data,
    (k, v) => (typeof v === "bigint" ? v.toString() : v),
    2
  );
}

main().catch((e) => console.error(e));

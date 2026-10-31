-- Separate immutable simulation receipts: never proof of a real money transfer.
CREATE TABLE demo_payments (
  id text PRIMARY KEY,
  "requestId" text NOT NULL REFERENCES requests(id),
  "quoteId" text NOT NULL UNIQUE REFERENCES quotes(id),
  "buyerId" text NOT NULL REFERENCES "user"(id),
  amount bigint NOT NULL CHECK(amount BETWEEN 0 AND 9007199254740991),
  "createdAt" text NOT NULL
);
CREATE INDEX demo_payments_request ON demo_payments("requestId");

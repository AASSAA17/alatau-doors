CREATE TABLE entry_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires BIGINT NOT NULL);
CREATE INDEX entry_limits_expiry ON entry_limits(expires);
CREATE TABLE guest_inquiries (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, contact TEXT NOT NULL, note TEXT NOT NULL,
  locale TEXT NOT NULL CHECK(locale IN ('ru','kk')),
  status TEXT NOT NULL CHECK(status IN ('NEW','IN_PROGRESS','COMPLETED','CANCELLED')),
  "sellerId" TEXT REFERENCES "user"(id), "createdAt" TEXT NOT NULL, "updatedAt" TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX guest_inquiries_seller ON guest_inquiries("sellerId");

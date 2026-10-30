-- No foreign key: signup sends verification inside the auth adapter's transaction.
-- The hash is an independent single-use delivery ledger, never an identity authority.
CREATE TABLE auth_links (id TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "expiresAt" BIGINT NOT NULL);
CREATE TABLE mfa_enrollments ("userId" TEXT PRIMARY KEY REFERENCES "user"(id), "tokenHash" TEXT NOT NULL, "expiresAt" BIGINT NOT NULL);

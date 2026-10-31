-- Run as the owner, only in the dedicated cloud DEMO database after migration.
-- Create the role with psql: CREATE ROLE alatau_demo_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
-- Set its password interactively with: \password alatau_demo_app
BEGIN;
ALTER ROLE alatau_demo_app SET statement_timeout = '15s';
ALTER ROLE alatau_demo_app SET idle_in_transaction_session_timeout = '15s';
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO alatau_demo_app;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM alatau_demo_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "user", session, account, verification, "rateLimit", favorites, drafts, requests, request_items, products, variants, demo_limits TO alatau_demo_app;
GRANT SELECT, INSERT ON quotes, request_events, internal_comments, audit_log TO alatau_demo_app;
GRANT SELECT, UPDATE ON store_settings TO alatau_demo_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON entry_limits TO alatau_demo_app;
GRANT SELECT, INSERT, UPDATE ON guest_inquiries TO alatau_demo_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "twoFactor", auth_links TO alatau_demo_app;
GRANT SELECT, DELETE ON mfa_enrollments TO alatau_demo_app;
GRANT SELECT, INSERT ON media TO alatau_demo_app;
GRANT SELECT, INSERT ON demo_payments TO alatau_demo_app;
GRANT SELECT ON app_meta TO alatau_demo_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO alatau_demo_app;
COMMIT;

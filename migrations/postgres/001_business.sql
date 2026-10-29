CREATE TABLE products (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, sku TEXT NOT NULL UNIQUE, payload TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0, "createdAt" TEXT NOT NULL, "updatedAt" TEXT NOT NULL);
      CREATE TABLE variants (id TEXT PRIMARY KEY, "productId" TEXT NOT NULL REFERENCES products(id), width INTEGER NOT NULL CHECK(width > 0), height INTEGER NOT NULL CHECK(height > 0), price INTEGER NOT NULL CHECK(price >= 0), stock TEXT NOT NULL CHECK(stock IN ('DEMO_AVAILABLE','DEMO_ORDER','DEMO_UNAVAILABLE')), active INTEGER NOT NULL DEFAULT 1);
      CREATE INDEX variants_product ON variants("productId");
      CREATE TABLE favorites ("userId" TEXT NOT NULL REFERENCES "user"(id), "productId" TEXT NOT NULL REFERENCES products(id), PRIMARY KEY("userId", "productId"));
      CREATE TABLE drafts ("userId" TEXT PRIMARY KEY REFERENCES "user"(id), payload TEXT NOT NULL, "updatedAt" TEXT NOT NULL);
      CREATE TABLE requests (number SERIAL PRIMARY KEY, id TEXT NOT NULL UNIQUE, "buyerId" TEXT NOT NULL REFERENCES "user"(id), "sellerId" TEXT REFERENCES "user"(id), status TEXT NOT NULL CHECK(status IN ('NEW','IN_PROGRESS','QUOTED','COMPLETED','CANCELLED')), note TEXT NOT NULL, "createdAt" TEXT NOT NULL, "updatedAt" TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1);
      CREATE INDEX requests_buyer ON requests("buyerId");
      CREATE INDEX requests_seller ON requests("sellerId");
      CREATE TABLE request_items (id TEXT PRIMARY KEY, "requestId" TEXT NOT NULL REFERENCES requests(id), "variantId" TEXT NOT NULL REFERENCES variants(id), quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 20), frame INTEGER NOT NULL, hardware INTEGER NOT NULL, installation INTEGER NOT NULL, ordinal BIGSERIAL UNIQUE);
      CREATE TABLE quotes (id TEXT PRIMARY KEY, "requestId" TEXT NOT NULL REFERENCES requests(id), version INTEGER NOT NULL, total BIGINT NOT NULL CHECK(total BETWEEN 0 AND 9007199254740991), payload TEXT NOT NULL, "authorId" TEXT NOT NULL REFERENCES "user"(id), "authorName" TEXT NOT NULL, "createdAt" TEXT NOT NULL, UNIQUE("requestId", version));
      CREATE TABLE request_events (id TEXT PRIMARY KEY, "requestId" TEXT NOT NULL REFERENCES requests(id), kind TEXT NOT NULL, status TEXT NOT NULL, "authorId" TEXT NOT NULL REFERENCES "user"(id), "authorName" TEXT NOT NULL, "createdAt" TEXT NOT NULL, ordinal BIGSERIAL UNIQUE);
      CREATE TABLE internal_comments (id TEXT PRIMARY KEY, "requestId" TEXT NOT NULL REFERENCES requests(id), "authorId" TEXT NOT NULL REFERENCES "user"(id), "authorName" TEXT NOT NULL, text TEXT NOT NULL, "createdAt" TEXT NOT NULL, ordinal BIGSERIAL UNIQUE);
      CREATE TABLE store_settings (id INTEGER PRIMARY KEY CHECK(id = 1), payload TEXT NOT NULL);
      CREATE TABLE audit_log (id TEXT PRIMARY KEY, "actorId" TEXT NOT NULL REFERENCES "user"(id), action TEXT NOT NULL, "targetId" TEXT NOT NULL, "createdAt" TEXT NOT NULL);
      CREATE TABLE app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE demo_limits (key text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL);
INSERT INTO store_settings(id,payload) VALUES (1,'{"phone":"","email":"","addressRu":"","addressKk":"","hoursRu":"","hoursKk":"","framePrice":18000,"hardwarePrice":12000,"installationPrice":20000}');

-- Serializes registration across instances; protected metadata is read-only at runtime.
CREATE FUNCTION public.limit_demo_users() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.app_meta WHERE key='publicDemo' AND value='cloud-v1') THEN
    PERFORM pg_advisory_xact_lock(71420303);
    IF (SELECT count(*) FROM public."user") >= 50 THEN
      RAISE EXCEPTION 'Public demo account capacity reached' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER demo_users_capacity BEFORE INSERT ON public."user" FOR EACH ROW EXECUTE FUNCTION public.limit_demo_users();


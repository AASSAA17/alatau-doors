CREATE TABLE media (
  id text PRIMARY KEY,
  data bytea NOT NULL,
  width integer NOT NULL CHECK (width BETWEEN 1 AND 1800),
  height integer NOT NULL CHECK (height BETWEEN 1 AND 1800),
  size integer NOT NULL CHECK (size BETWEEN 1 AND 1048576),
  "createdBy" text NOT NULL REFERENCES "user"(id),
  "createdAt" text NOT NULL
);

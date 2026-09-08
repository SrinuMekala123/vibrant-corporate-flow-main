
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


ALTER TABLE "public"."complaints" ADD COLUMN IF NOT EXISTS "resolution_notes" "text";
ALTER TABLE "public"."complaints" ADD COLUMN IF NOT EXISTS "resolved_remotely" "boolean" DEFAULT false;
ALTER TABLE "public"."complaints" ADD COLUMN IF NOT EXISTS "resolution_type" "text";
ALTER TABLE "public"."complaints" ADD COLUMN IF NOT EXISTS "resolved_at" timestamp with time zone;
ALTER TABLE "public"."complaints" ADD COLUMN IF NOT EXISTS "resolved_by" "uuid";


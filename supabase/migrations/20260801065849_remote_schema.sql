


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


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."enforce_server_timestamps"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.created_at = COALESCE(NEW.created_at, NOW());
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_server_timestamps"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (id, email, full_name, role, phone, expertise, avatar_url)
  values (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'customer'),
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'expertise',
    COALESCE(new.raw_user_meta_data->>'full_name', substring(new.email from 1 for 1))
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
end;
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."complaints" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "category" "text",
    "priority" "text",
    "status" "text",
    "assigned_to" "uuid",
    "assigned_supervisor" "text",
    "assigned_technician" "text",
    "location" "text",
    "field_of_work" "text",
    "severity" "text",
    "current_phase" integer,
    "resolution" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "customer_name" "text",
    "customer_phone" "text",
    "triage_outcome" "text",
    "pir_findings" "text",
    "pir_audio_url" "text",
    "pir_decision_tree" "jsonb",
    "arrival_lat" numeric,
    "arrival_lng" numeric,
    "evidence_urls" "text"[],
    "signature_url" "text",
    "signoff_timestamp" timestamp without time zone DEFAULT "now"(),
    "assignment_timestamp" timestamp without time zone,
    "start_journey_timestamp" timestamp without time zone,
    "arrival_timestamp" timestamp without time zone,
    "feedback_collected" boolean DEFAULT false,
    "customer_satisfaction" "text",
    "feedback_comments" "text",
    "feedback_timestamp" timestamp with time zone,
    "feedback_contact_method" "text",
    "closure_timestamp" timestamp with time zone,
    "closed_by" "text",
    "customer_lat" numeric(10,8),
    "customer_lng" numeric(11,8),
    "created_by_name" "text",
    "complaint_images" "text"[],
    "technician_evidence" "text"[],
    "pir_findings_severity" "text",
    "supervisor_severity" "text",
    "target_duration_hours" numeric,
    "feedback_history" "jsonb" DEFAULT '[]'::"jsonb",
    "pir_approved_by" "uuid",
    "pir_approved_at" timestamp with time zone,
    "target_end_time" timestamp with time zone,
    "pir_status" "text",
    CONSTRAINT "complaints_current_phase_check" CHECK ((("current_phase" >= 1) AND ("current_phase" <= 6))),
    CONSTRAINT "complaints_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "complaints_severity_check" CHECK (("severity" = ANY (ARRAY['minor'::"text", 'moderate'::"text", 'major'::"text"]))),
    CONSTRAINT "complaints_status_check" CHECK (("status" = ANY (ARRAY['unassigned'::"text", 'open'::"text", 'assigned'::"text", 'in-progress'::"text", 'in_progress'::"text", 'dispatched'::"text", 'completed'::"text", 'pir_pending'::"text", 'pir_approved'::"text", 'rework_required'::"text", 'pending_verification'::"text", 'closed'::"text", 'cancelled'::"text", 'pir_submitted_awaiting_approval'::"text", 'pir_approved_work_in_progress'::"text"]))),
    CONSTRAINT "complaints_triage_outcome_check" CHECK (("triage_outcome" = ANY (ARRAY['remote_fixed'::"text", 'field_required'::"text"]))),
    CONSTRAINT "complaints_pir_status_check" CHECK (("pir_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'revision_requested'::"text"])))
);

ALTER TABLE ONLY "public"."complaints" REPLICA IDENTITY FULL;


ALTER TABLE "public"."complaints" OWNER TO "postgres";


COMMENT ON COLUMN "public"."complaints"."feedback_collected" IS 'Whether customer satisfaction was verified';



COMMENT ON COLUMN "public"."complaints"."customer_satisfaction" IS 'Satisfaction level: satisfied, partially_satisfied, unsatisfied';



COMMENT ON COLUMN "public"."complaints"."feedback_comments" IS 'Customer feedback comments';



COMMENT ON COLUMN "public"."complaints"."feedback_timestamp" IS 'When feedback was collected';



COMMENT ON COLUMN "public"."complaints"."customer_lat" IS 'Customer location latitude for navigation';



COMMENT ON COLUMN "public"."complaints"."customer_lng" IS 'Customer location longitude for navigation';



COMMENT ON COLUMN "public"."complaints"."complaint_images" IS 'Images uploaded at ticket creation (Before fix)';



COMMENT ON COLUMN "public"."complaints"."technician_evidence" IS 'Images uploaded by technician at sign-off (After fix)';



CREATE TABLE IF NOT EXISTS "public"."location_tracking" (
    "id" integer NOT NULL,
    "complaint_id" "uuid",
    "latitude" numeric(10,8) NOT NULL,
    "longitude" numeric(11,8) NOT NULL,
    "accuracy" numeric(5,2),
    "timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    "battery_level" numeric(5,2),
    "synced" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."location_tracking" OWNER TO "postgres";


COMMENT ON TABLE "public"."location_tracking" IS 'Stores GPS location tracking data for field technicians';



CREATE SEQUENCE IF NOT EXISTS "public"."location_tracking_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."location_tracking_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."location_tracking_id_seq" OWNED BY "public"."location_tracking"."id";



CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "ticket_id" "uuid",
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "phase" integer,
    "action_url" "text",
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "read_at" timestamp with time zone,
    CONSTRAINT "notifications_phase_check" CHECK ((("phase" >= 1) AND ("phase" <= 6))),
    CONSTRAINT "notifications_type_check" CHECK (("type" = ANY (ARRAY['info'::"text", 'success'::"text", 'warning'::"text", 'error'::"text", 'assignment'::"text", 'status_change'::"text", 'feedback'::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "full_name" "text",
    "role" "text",
    "phone" "text",
    "expertise" "text",
    "avatar_url" "text",
    "available" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'supervisor'::"text", 'technician'::"text", 'customer'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_devices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "fcm_token" "text" NOT NULL,
    "platform" "text" NOT NULL,
    "device_name" "text",
    "last_active_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_devices_platform_check" CHECK (("platform" = ANY (ARRAY['web'::"text", 'mobile'::"text", 'ios'::"text", 'android'::"text"])))
);


ALTER TABLE "public"."user_devices" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_devices" IS 'Stores FCM push notification tokens for users';



ALTER TABLE ONLY "public"."location_tracking" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."location_tracking_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."complaints"
    ADD CONSTRAINT "complaints_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."location_tracking"
    ADD CONSTRAINT "location_tracking_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_devices"
    ADD CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_devices"
    ADD CONSTRAINT "user_devices_user_id_fcm_token_key" UNIQUE ("user_id", "fcm_token");



CREATE INDEX "idx_location_tracking_complaint" ON "public"."location_tracking" USING "btree" ("complaint_id");



CREATE INDEX "idx_location_tracking_synced" ON "public"."location_tracking" USING "btree" ("synced") WHERE ("synced" = false);



CREATE INDEX "idx_notifications_created_at" ON "public"."notifications" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_notifications_is_read" ON "public"."notifications" USING "btree" ("is_read");



CREATE INDEX "idx_notifications_ticket_id" ON "public"."notifications" USING "btree" ("ticket_id");



CREATE INDEX "idx_notifications_user_id" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_user_devices_token" ON "public"."user_devices" USING "btree" ("fcm_token");



CREATE INDEX "idx_user_devices_user" ON "public"."user_devices" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "handle_complaints_updated_at" BEFORE UPDATE ON "public"."complaints" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_timestamps" BEFORE INSERT OR UPDATE ON "public"."complaints" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_server_timestamps"();



ALTER TABLE ONLY "public"."complaints"
    ADD CONSTRAINT "complaints_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."complaints"
    ADD CONSTRAINT "complaints_pir_approved_by_fkey" FOREIGN KEY ("pir_approved_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."complaints"
    ADD CONSTRAINT "complaints_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."location_tracking"
    ADD CONSTRAINT "location_tracking_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "public"."complaints"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."complaints"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_devices"
    ADD CONSTRAINT "user_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can delete all profiles" ON "public"."profiles" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "Admins can insert all profiles" ON "public"."profiles" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can update all profiles" ON "public"."profiles" FOR UPDATE USING ("public"."is_admin"());



CREATE POLICY "Allow insert complaints" ON "public"."complaints" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow insert for authenticated users" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Allow read access for authenticated users" ON "public"."profiles" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow read complaints" ON "public"."complaints" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow read for authenticated users" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Anyone can view complaints" ON "public"."complaints" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can create complaints" ON "public"."complaints" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert notifications" ON "public"."notifications" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can update complaints" ON "public"."complaints" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Mask closed tickets" ON "public"."complaints" FOR SELECT USING (((("auth"."jwt"() ->> 'role'::"text") = ANY (ARRAY['admin'::"text", 'supervisor'::"text"])) OR ("status" <> 'closed'::"text")));



CREATE POLICY "Public profiles are viewable by everyone" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Service role can insert location tracking" ON "public"."location_tracking" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert location tracking" ON "public"."location_tracking" FOR INSERT TO "authenticated" WITH CHECK (true);




CREATE POLICY "Technicians see active tickets" ON "public"."complaints" FOR SELECT USING (((("auth"."jwt"() ->> 'role'::"text") = 'technician'::"text") AND ("status" <> 'closed'::"text")));



CREATE POLICY "Users can insert their own devices" ON "public"."user_devices" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own devices" ON "public"."user_devices" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own notifications" ON "public"."notifications" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own devices" ON "public"."user_devices" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own location tracking" ON "public"."location_tracking" FOR SELECT USING (("auth"."uid"() IN ( SELECT "users"."id"
   FROM "auth"."users"
  WHERE (("users"."email")::"text" IN ( SELECT "complaints"."assigned_technician"
           FROM "public"."complaints"
          WHERE ("complaints"."id" = "location_tracking"."complaint_id"))))));



CREATE POLICY "Users can view their own notifications" ON "public"."notifications" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."complaints" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."location_tracking" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_devices" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."complaints";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notifications";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."enforce_server_timestamps"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_server_timestamps"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_server_timestamps"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";


















GRANT ALL ON TABLE "public"."complaints" TO "anon";
GRANT ALL ON TABLE "public"."complaints" TO "authenticated";
GRANT ALL ON TABLE "public"."complaints" TO "service_role";



GRANT ALL ON TABLE "public"."location_tracking" TO "anon";
GRANT ALL ON TABLE "public"."location_tracking" TO "authenticated";
GRANT ALL ON TABLE "public"."location_tracking" TO "service_role";



GRANT ALL ON SEQUENCE "public"."location_tracking_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."location_tracking_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."location_tracking_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."user_devices" TO "anon";
GRANT ALL ON TABLE "public"."user_devices" TO "authenticated";
GRANT ALL ON TABLE "public"."user_devices" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


  create policy "Allow authenticated uploads"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'complaint-media'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Allow owner delete"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'complaint-media'::text) AND (auth.uid() = owner)));



  create policy "Allow public and owner read access"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using ((bucket_id = 'complaint-media'::text));

INSERT INTO storage.buckets (id, name, public)
VALUES ('complaint-media', 'complaint-media', true)
ON CONFLICT (id) DO NOTHING;




CREATE TYPE "public"."auth_token_kind" AS ENUM('verify_email', 'reset_password');--> statement-breakpoint
CREATE TYPE "public"."alias_kind" AS ENUM('typo', 'term', 'engine', 'type_header');--> statement-breakpoint
CREATE TYPE "public"."dimension_kind" AS ENUM('single', 'multi', 'bool', 'text');--> statement-breakpoint
CREATE TYPE "public"."manual_kind" AS ENUM('kai', 'intro', 'supplement');--> statement-breakpoint
CREATE TYPE "public"."quick_build_kind" AS ENUM('none', 'assembled_by_sling', 'jig_not_applicable');--> statement-breakpoint
CREATE TYPE "public"."revision_status" AS ENUM('draft', 'in_review', 'released');--> statement-breakpoint
CREATE TYPE "public"."rule_effect" AS ENUM('applies_only_if', 'qb_prebuilt');--> statement-breakpoint
CREATE TYPE "public"."rule_target_type" AS ENUM('page', 'section');--> statement-breakpoint
CREATE TYPE "public"."missing_part_status" AS ENUM('needed', 'ordered', 'received', 'installed');--> statement-breakpoint
CREATE TYPE "public"."na_reason" AS ENUM('manual', 'config', 'quick_build');--> statement-breakpoint
CREATE TYPE "public"."page_status_kind" AS ENUM('open', 'in_progress', 'done', 'not_applicable', 'problem');--> statement-breakpoint
CREATE TYPE "public"."visa_target_type" AS ENUM('page', 'section', 'dossier_item');--> statement-breakpoint
CREATE TYPE "public"."build_type" AS ENUM('standard', 'quick_build', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."deviation_status" AS ENUM('planned', 'in_progress', 'done', 'dropped');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner', 'co_builder', 'advisor', 'viewer');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid,
	"user_id" uuid,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb,
	"client_change_id" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_tokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "auth_token_kind" NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" text,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"email_verified_at" timestamp with time zone,
	"locale" text DEFAULT 'de' NOT NULL,
	"is_platform_admin" boolean DEFAULT false NOT NULL,
	"totp_secret_enc" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "aircraft_models" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"manufacturer" text DEFAULT 'Sling Aircraft' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "aircraft_models_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "aliases" (
	"id" uuid PRIMARY KEY NOT NULL,
	"scope_model_id" uuid,
	"scope_manual_id" uuid,
	"scope_revision_id" uuid,
	"kind" "alias_kind" NOT NULL,
	"match_text" text NOT NULL,
	"is_regex" boolean DEFAULT false NOT NULL,
	"replacement" text NOT NULL,
	"rationale" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"seed_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "aliases_seed_key_unique" UNIQUE("seed_key")
);
--> statement-breakpoint
CREATE TABLE "applicability_rules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"target_type" "rule_target_type" NOT NULL,
	"target_id" uuid NOT NULL,
	"effect" "rule_effect" DEFAULT 'applies_only_if' NOT NULL,
	"expression" jsonb NOT NULL,
	"source_text" text,
	"rationale" text,
	"confirmed" boolean DEFAULT false NOT NULL,
	"confirmed_by" uuid,
	"confirmed_at" timestamp with time zone,
	"seed_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "applicability_rules_seed_key_unique" UNIQUE("seed_key")
);
--> statement-breakpoint
CREATE TABLE "assembly_groups" (
	"id" uuid PRIMARY KEY NOT NULL,
	"aircraft_model_id" uuid NOT NULL,
	"code" text NOT NULL,
	"label" jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manual_revisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"manual_id" uuid NOT NULL,
	"revision" text NOT NULL,
	"revision_date" date,
	"cover_label" text,
	"source_hash" text,
	"source_name" text,
	"source_size" bigint,
	"status" "revision_status" DEFAULT 'draft' NOT NULL,
	"page_count" integer,
	"import_report" jsonb DEFAULT '{"notes":[],"conflicts":[]}'::jsonb NOT NULL,
	"notes" text,
	"released_at" timestamp with time zone,
	"released_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manuals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"aircraft_model_id" uuid NOT NULL,
	"code" text NOT NULL,
	"doc_number" text,
	"title" text NOT NULL,
	"assembly_group" text NOT NULL,
	"kind" "manual_kind" DEFAULT 'kai' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "option_dimensions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"aircraft_model_id" uuid NOT NULL,
	"code" text NOT NULL,
	"kind" "dimension_kind" NOT NULL,
	"label" jsonb NOT NULL,
	"help" jsonb,
	"group_code" text DEFAULT 'general' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "option_groups" (
	"id" uuid PRIMARY KEY NOT NULL,
	"aircraft_model_id" uuid NOT NULL,
	"code" text NOT NULL,
	"label" jsonb NOT NULL,
	"help" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "option_values" (
	"id" uuid PRIMARY KEY NOT NULL,
	"dimension_id" uuid NOT NULL,
	"code" text NOT NULL,
	"label" jsonb NOT NULL,
	"help" jsonb,
	"alias_value" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"revision_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"page_number" integer NOT NULL,
	"title_original" text,
	"drawing_number" text,
	"drawing_revision" text,
	"quick_build" "quick_build_kind" DEFAULT 'none' NOT NULL,
	"quick_build_source" text,
	"flags" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"revision_id" uuid NOT NULL,
	"sort_order" integer NOT NULL,
	"title_original" text NOT NULL,
	"title_note" text,
	"page_from" integer NOT NULL,
	"page_to" integer NOT NULL,
	"drawing_number" text,
	"drawing_revision" text,
	"is_untitled" boolean DEFAULT false NOT NULL,
	"flags" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extra_tasks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"category" text,
	"note" text,
	"due_date" date,
	"done" boolean DEFAULT false NOT NULL,
	"done_at" date,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"page_id" uuid,
	"dossier_item_id" uuid,
	"file_ref_id" uuid,
	"ticket_id" uuid,
	"origin" text DEFAULT 'manual' NOT NULL,
	"external_ref" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "missing_parts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"page_id" uuid,
	"position" text,
	"part_number" text,
	"description" text NOT NULL,
	"quantity" numeric(10, 2) DEFAULT '1' NOT NULL,
	"unit" text DEFAULT 'Stk' NOT NULL,
	"status" "missing_part_status" DEFAULT 'needed' NOT NULL,
	"purchase_item_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_status" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"status" "page_status_kind" DEFAULT 'open' NOT NULL,
	"na_reason" "na_reason",
	"done_at" date,
	"note" text,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visas" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"target_type" "visa_target_type" NOT NULL,
	"target_id" uuid NOT NULL,
	"advisor_user_id" uuid,
	"advisor_name" text NOT NULL,
	"visa_date" date NOT NULL,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_build_types" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"assembly_group" text NOT NULL,
	"build_type" "build_type" DEFAULT 'unknown' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_deviations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" text,
	"status" "deviation_status" DEFAULT 'planned' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_manual_revisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"manual_id" uuid NOT NULL,
	"revision_id" uuid NOT NULL,
	"activated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_members" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "member_role" NOT NULL,
	"invited_by" uuid,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_options" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"dimension_id" uuid NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"aircraft_model_id" uuid NOT NULL,
	"registration" text NOT NULL,
	"kit_number" text,
	"name" text NOT NULL,
	"planned_inspection_date" date,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aliases" ADD CONSTRAINT "aliases_scope_model_id_aircraft_models_id_fk" FOREIGN KEY ("scope_model_id") REFERENCES "public"."aircraft_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aliases" ADD CONSTRAINT "aliases_scope_manual_id_manuals_id_fk" FOREIGN KEY ("scope_manual_id") REFERENCES "public"."manuals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aliases" ADD CONSTRAINT "aliases_scope_revision_id_manual_revisions_id_fk" FOREIGN KEY ("scope_revision_id") REFERENCES "public"."manual_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicability_rules" ADD CONSTRAINT "applicability_rules_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assembly_groups" ADD CONSTRAINT "assembly_groups_aircraft_model_id_aircraft_models_id_fk" FOREIGN KEY ("aircraft_model_id") REFERENCES "public"."aircraft_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_revisions" ADD CONSTRAINT "manual_revisions_manual_id_manuals_id_fk" FOREIGN KEY ("manual_id") REFERENCES "public"."manuals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_revisions" ADD CONSTRAINT "manual_revisions_released_by_users_id_fk" FOREIGN KEY ("released_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manuals" ADD CONSTRAINT "manuals_aircraft_model_id_aircraft_models_id_fk" FOREIGN KEY ("aircraft_model_id") REFERENCES "public"."aircraft_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "option_dimensions" ADD CONSTRAINT "option_dimensions_aircraft_model_id_aircraft_models_id_fk" FOREIGN KEY ("aircraft_model_id") REFERENCES "public"."aircraft_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "option_groups" ADD CONSTRAINT "option_groups_aircraft_model_id_aircraft_models_id_fk" FOREIGN KEY ("aircraft_model_id") REFERENCES "public"."aircraft_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "option_values" ADD CONSTRAINT "option_values_dimension_id_option_dimensions_id_fk" FOREIGN KEY ("dimension_id") REFERENCES "public"."option_dimensions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_revision_id_manual_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."manual_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_revision_id_manual_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."manual_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extra_tasks" ADD CONSTRAINT "extra_tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extra_tasks" ADD CONSTRAINT "extra_tasks_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extra_tasks" ADD CONSTRAINT "extra_tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "missing_parts" ADD CONSTRAINT "missing_parts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "missing_parts" ADD CONSTRAINT "missing_parts_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_status" ADD CONSTRAINT "page_status_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_status" ADD CONSTRAINT "page_status_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_status" ADD CONSTRAINT "page_status_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visas" ADD CONSTRAINT "visas_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visas" ADD CONSTRAINT "visas_advisor_user_id_users_id_fk" FOREIGN KEY ("advisor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visas" ADD CONSTRAINT "visas_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_build_types" ADD CONSTRAINT "project_build_types_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_deviations" ADD CONSTRAINT "project_deviations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_manual_revisions" ADD CONSTRAINT "project_manual_revisions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_manual_revisions" ADD CONSTRAINT "project_manual_revisions_manual_id_manuals_id_fk" FOREIGN KEY ("manual_id") REFERENCES "public"."manuals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_manual_revisions" ADD CONSTRAINT "project_manual_revisions_revision_id_manual_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."manual_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_options" ADD CONSTRAINT "project_options_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_options" ADD CONSTRAINT "project_options_dimension_id_option_dimensions_id_fk" FOREIGN KEY ("dimension_id") REFERENCES "public"."option_dimensions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_options" ADD CONSTRAINT "project_options_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_aircraft_model_id_aircraft_models_id_fk" FOREIGN KEY ("aircraft_model_id") REFERENCES "public"."aircraft_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_project_at_idx" ON "audit_log" USING btree ("project_id","at");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "audit_log_client_change_uq" ON "audit_log" USING btree ("client_change_id") WHERE "audit_log"."client_change_id" is not null;--> statement-breakpoint
CREATE INDEX "aliases_scope_idx" ON "aliases" USING btree ("scope_model_id","scope_manual_id","scope_revision_id");--> statement-breakpoint
CREATE INDEX "applicability_rules_target_idx" ON "applicability_rules" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assembly_groups_model_code_uq" ON "assembly_groups" USING btree ("aircraft_model_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "manual_revisions_manual_rev_uq" ON "manual_revisions" USING btree ("manual_id","revision");--> statement-breakpoint
CREATE UNIQUE INDEX "manuals_model_code_uq" ON "manuals" USING btree ("aircraft_model_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "option_dimensions_model_code_uq" ON "option_dimensions" USING btree ("aircraft_model_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "option_groups_model_code_uq" ON "option_groups" USING btree ("aircraft_model_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "option_values_dimension_code_uq" ON "option_values" USING btree ("dimension_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "pages_revision_page_uq" ON "pages" USING btree ("revision_id","page_number");--> statement-breakpoint
CREATE INDEX "pages_section_idx" ON "pages" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "sections_revision_idx" ON "sections" USING btree ("revision_id");--> statement-breakpoint
CREATE INDEX "extra_tasks_project_idx" ON "extra_tasks" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "extra_tasks_project_external_uq" ON "extra_tasks" USING btree ("project_id","external_ref");--> statement-breakpoint
CREATE INDEX "missing_parts_project_idx" ON "missing_parts" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "missing_parts_page_idx" ON "missing_parts" USING btree ("page_id");--> statement-breakpoint
CREATE UNIQUE INDEX "page_status_project_page_uq" ON "page_status" USING btree ("project_id","page_id");--> statement-breakpoint
CREATE INDEX "page_status_project_idx" ON "page_status" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "visas_project_target_idx" ON "visas" USING btree ("project_id","target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_build_types_project_group_uq" ON "project_build_types" USING btree ("project_id","assembly_group");--> statement-breakpoint
CREATE INDEX "project_deviations_project_idx" ON "project_deviations" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_manual_revisions_project_manual_uq" ON "project_manual_revisions" USING btree ("project_id","manual_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_members_project_user_uq" ON "project_members" USING btree ("project_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_options_project_dimension_uq" ON "project_options" USING btree ("project_id","dimension_id");
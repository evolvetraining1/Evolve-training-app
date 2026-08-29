


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


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE SCHEMA IF NOT EXISTS "storage";


ALTER SCHEMA "storage" OWNER TO "supabase_admin";


CREATE TYPE "public"."feature_code" AS ENUM (
    'training',
    'journal',
    'nutrition',
    'advanced_stats',
    'messaging',
    'custom_protocols'
);


ALTER TYPE "public"."feature_code" OWNER TO "postgres";


CREATE TYPE "public"."relationship_status" AS ENUM (
    'pending',
    'active',
    'paused',
    'ended'
);


ALTER TYPE "public"."relationship_status" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'coach',
    'athlete',
    'admin'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE TYPE "public"."workout_status" AS ENUM (
    'planned',
    'in_progress',
    'completed',
    'skipped'
);


ALTER TYPE "public"."workout_status" OWNER TO "postgres";


CREATE TYPE "storage"."buckettype" AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


ALTER TYPE "storage"."buckettype" OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "public"."accept_coach_invite"("code" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_invite public.coach_invites%rowtype;
  v_rel_id uuid;
begin
  select * into v_invite
  from public.coach_invites
  where invite_code = code
    and accepted_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'Invitation invalide ou expirée';
  end if;

  if lower(v_invite.email) <> lower(coalesce(auth.jwt()->>'email','')) then
    raise exception 'Cette invitation ne correspond pas à votre email';
  end if;

  insert into public.coach_athlete_relationships (coach_id, athlete_id, status)
  values (v_invite.coach_id, auth.uid(), 'active')
  on conflict (coach_id, athlete_id)
  do update set status = 'active'
  returning id into v_rel_id;

  update public.coach_invites
  set accepted_at = now(), accepted_by = auth.uid()
  where id = v_invite.id;

  return v_rel_id;
end;
$$;


ALTER FUNCTION "public"."accept_coach_invite"("code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_has_program_assignment"("target_program" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.program_assignments a
    where a.program_id = target_program
      and a.athlete_id = auth.uid()
      and a.active = true
  );
$$;


ALTER FUNCTION "public"."current_user_has_program_assignment"("target_program" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_is_program_coach"("target_program" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.programs p
    where p.id = target_program
      and p.coach_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."current_user_is_program_coach"("target_program" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (
    id,
    role,
    first_name,
    last_name
  )
  values (
    new.id,
    'athlete'::public.user_role,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_coach_of"("target_athlete" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.coach_athlete_relationships r
    where r.coach_id = auth.uid()
      and r.athlete_id = target_athlete
      and r.status = 'active'
  );
$$;


ALTER FUNCTION "public"."is_coach_of"("target_athlete" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "storage"."allow_any_operation"("expected_operations" "text"[]) RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT CASE
      WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
      ELSE raw_operation
    END AS current_operation
    FROM current_operation
  )
  SELECT EXISTS (
    SELECT 1
    FROM normalized n
    CROSS JOIN LATERAL unnest(expected_operations) AS expected_operation
    WHERE expected_operation IS NOT NULL
      AND expected_operation <> ''
      AND n.current_operation = CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END
  );
$$;


ALTER FUNCTION "storage"."allow_any_operation"("expected_operations" "text"[]) OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."allow_only_operation"("expected_operation" "text") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT
      CASE
        WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
        ELSE raw_operation
      END AS current_operation,
      CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END AS requested_operation
    FROM current_operation
  )
  SELECT CASE
    WHEN requested_operation IS NULL OR requested_operation = '' THEN FALSE
    ELSE COALESCE(current_operation = requested_operation, FALSE)
  END
  FROM normalized;
$$;


ALTER FUNCTION "storage"."allow_only_operation"("expected_operation" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."can_insert_object"("bucketid" "text", "name" "text", "owner" "uuid", "metadata" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


ALTER FUNCTION "storage"."can_insert_object"("bucketid" "text", "name" "text", "owner" "uuid", "metadata" "jsonb") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."enforce_bucket_name_length"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


ALTER FUNCTION "storage"."enforce_bucket_name_length"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."extension"("name" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Get the last path segment (the actual filename)
    SELECT _parts[array_length(_parts, 1)] INTO _filename;
    -- Extract extension: reverse, split on '.', then reverse again
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


ALTER FUNCTION "storage"."extension"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."filename"("name" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    SELECT string_to_array(name, '/') INTO _parts;
    RETURN _parts[array_length(_parts, 1)];
END
$$;


ALTER FUNCTION "storage"."filename"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."foldername"("name" "text") RETURNS "text"[]
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


ALTER FUNCTION "storage"."foldername"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."get_common_prefix"("p_key" "text", "p_prefix" "text", "p_delimiter" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
SELECT CASE
    WHEN position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)) > 0
    THEN left(p_key, length(p_prefix) + position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)))
    ELSE NULL
END;
$$;


ALTER FUNCTION "storage"."get_common_prefix"("p_key" "text", "p_prefix" "text", "p_delimiter" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."get_size_by_bucket"() RETURNS TABLE("size" bigint, "bucket_id" "text")
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::bigint)::bigint as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


ALTER FUNCTION "storage"."get_size_by_bucket"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."list_multipart_uploads_with_delimiter"("bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer DEFAULT 100, "next_key_token" "text" DEFAULT ''::"text", "next_upload_token" "text" DEFAULT ''::"text") RETURNS TABLE("key" "text", "id" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


ALTER FUNCTION "storage"."list_multipart_uploads_with_delimiter"("bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer, "next_key_token" "text", "next_upload_token" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."list_objects_with_delimiter"("_bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer DEFAULT 100, "start_after" "text" DEFAULT ''::"text", "next_token" "text" DEFAULT ''::"text", "sort_order" "text" DEFAULT 'asc'::"text") RETURNS TABLE("name" "text", "id" "uuid", "metadata" "jsonb", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;

    -- Configuration
    v_is_asc BOOLEAN;
    v_prefix TEXT;
    v_start TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_is_asc := lower(coalesce(sort_order, 'asc')) = 'asc';
    v_prefix := coalesce(prefix_param, '');
    v_start := CASE WHEN coalesce(next_token, '') <> '' THEN next_token ELSE coalesce(start_after, '') END;
    v_file_batch_size := LEAST(GREATEST(max_keys * 2, 100), 1000);

    -- Calculate upper bound for prefix filtering (bytewise, using COLLATE "C")
    IF v_prefix = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix, 1) = delimiter_param THEN
        v_upper_bound := left(v_prefix, -1) || chr(ascii(delimiter_param) + 1);
    ELSE
        v_upper_bound := left(v_prefix, -1) || chr(ascii(right(v_prefix, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'AND o.name COLLATE "C" < $3 ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'AND o.name COLLATE "C" >= $3 ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- ========================================================================
    -- SEEK INITIALIZATION: Determine starting position
    -- ========================================================================
    IF v_start = '' THEN
        IF v_is_asc THEN
            v_next_seek := v_prefix;
        ELSE
            -- DESC without cursor: find the last item in range
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;

            IF v_next_seek IS NOT NULL THEN
                v_next_seek := v_next_seek || delimiter_param;
            ELSE
                RETURN;
            END IF;
        END IF;
    ELSE
        -- Cursor provided: determine if it refers to a folder or leaf
        IF EXISTS (
            SELECT 1 FROM storage.objects o
            WHERE o.bucket_id = _bucket_id
              AND o.name COLLATE "C" LIKE v_start || delimiter_param || '%'
            LIMIT 1
        ) THEN
            -- Cursor refers to a folder
            IF v_is_asc THEN
                v_next_seek := v_start || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_start || delimiter_param;
            END IF;
        ELSE
            -- Cursor refers to a leaf object
            IF v_is_asc THEN
                v_next_seek := v_start || delimiter_param;
            ELSE
                v_next_seek := v_start;
            END IF;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= max_keys;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(v_peek_name, v_prefix, delimiter_param);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Emit and skip to next folder (no heap access needed)
            name := rtrim(v_common_prefix, delimiter_param);
            id := NULL;
            updated_at := NULL;
            created_at := NULL;
            last_accessed_at := NULL;
            metadata := NULL;
            RETURN NEXT;
            v_count := v_count + 1;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := left(v_common_prefix, -1) || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_common_prefix;
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query USING _bucket_id, v_next_seek,
                CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix) ELSE v_prefix END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(v_current.name, v_prefix, delimiter_param);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := v_current.name;
                    EXIT;
                END IF;

                -- Emit file
                name := v_current.name;
                id := v_current.id;
                updated_at := v_current.updated_at;
                created_at := v_current.created_at;
                last_accessed_at := v_current.last_accessed_at;
                metadata := v_current.metadata;
                RETURN NEXT;
                v_count := v_count + 1;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := v_current.name || delimiter_param;
                ELSE
                    v_next_seek := v_current.name;
                END IF;

                EXIT WHEN v_count >= max_keys;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


ALTER FUNCTION "storage"."list_objects_with_delimiter"("_bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer, "start_after" "text", "next_token" "text", "sort_order" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."operation"() RETURNS "text"
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


ALTER FUNCTION "storage"."operation"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."protect_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Check if storage.allow_delete_query is set to 'true'
    IF COALESCE(current_setting('storage.allow_delete_query', true), 'false') != 'true' THEN
        RAISE EXCEPTION 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
            USING HINT = 'This prevents accidental data loss from orphaned objects.',
                  ERRCODE = '42501';
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION "storage"."protect_delete"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search"("prefix" "text", "bucketname" "text", "limits" integer DEFAULT 100, "levels" integer DEFAULT 1, "offsets" integer DEFAULT 0, "search" "text" DEFAULT ''::"text", "sortcolumn" "text" DEFAULT 'name'::"text", "sortorder" "text" DEFAULT 'asc'::"text") RETURNS TABLE("name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;
    v_delimiter CONSTANT TEXT := '/';

    -- Configuration
    v_limit INT;
    v_prefix TEXT;
    v_prefix_lower TEXT;
    v_is_asc BOOLEAN;
    v_order_by TEXT;
    v_sort_order TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;
    v_skipped INT := 0;
BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_limit := LEAST(coalesce(limits, 100), 1500);
    v_prefix := coalesce(prefix, '') || coalesce(search, '');
    v_prefix_lower := lower(v_prefix);
    v_is_asc := lower(coalesce(sortorder, 'asc')) = 'asc';
    v_file_batch_size := LEAST(GREATEST(v_limit * 2, 100), 1000);

    -- Validate sort column
    CASE lower(coalesce(sortcolumn, 'name'))
        WHEN 'name' THEN v_order_by := 'name';
        WHEN 'updated_at' THEN v_order_by := 'updated_at';
        WHEN 'created_at' THEN v_order_by := 'created_at';
        WHEN 'last_accessed_at' THEN v_order_by := 'last_accessed_at';
        ELSE v_order_by := 'name';
    END CASE;

    v_sort_order := CASE WHEN v_is_asc THEN 'asc' ELSE 'desc' END;

    -- ========================================================================
    -- NON-NAME SORTING: Use path_tokens approach (unchanged)
    -- ========================================================================
    IF v_order_by != 'name' THEN
        RETURN QUERY EXECUTE format(
            $sql$
            WITH folders AS (
                SELECT path_tokens[$1] AS folder
                FROM storage.objects
                WHERE objects.name ILIKE $2 || '%%'
                  AND bucket_id = $3
                  AND array_length(objects.path_tokens, 1) <> $1
                GROUP BY folder
                ORDER BY folder %s
            )
            (SELECT folder AS "name",
                   NULL::uuid AS id,
                   NULL::timestamptz AS updated_at,
                   NULL::timestamptz AS created_at,
                   NULL::timestamptz AS last_accessed_at,
                   NULL::jsonb AS metadata FROM folders)
            UNION ALL
            (SELECT path_tokens[$1] AS "name",
                   id, updated_at, created_at, last_accessed_at, metadata
             FROM storage.objects
             WHERE objects.name ILIKE $2 || '%%'
               AND bucket_id = $3
               AND array_length(objects.path_tokens, 1) = $1
             ORDER BY %I %s)
            LIMIT $4 OFFSET $5
            $sql$, v_sort_order, v_order_by, v_sort_order
        ) USING levels, v_prefix, bucketname, v_limit, offsets;
        RETURN;
    END IF;

    -- ========================================================================
    -- NAME SORTING: Hybrid skip-scan with batch optimization
    -- ========================================================================

    -- Calculate upper bound for prefix filtering
    IF v_prefix_lower = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix_lower, 1) = v_delimiter THEN
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(v_delimiter) + 1);
    ELSE
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(right(v_prefix_lower, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'AND lower(o.name) COLLATE "C" < $3 ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'AND lower(o.name) COLLATE "C" >= $3 ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- Initialize seek position
    IF v_is_asc THEN
        v_next_seek := v_prefix_lower;
    ELSE
        -- DESC: find the last item in range first (static SQL)
        IF v_upper_bound IS NOT NULL THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower AND lower(o.name) COLLATE "C" < v_upper_bound
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSIF v_prefix_lower <> '' THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSE
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        END IF;

        IF v_peek_name IS NOT NULL THEN
            v_next_seek := lower(v_peek_name) || v_delimiter;
        ELSE
            RETURN;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= v_limit;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix_lower <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(lower(v_peek_name), v_prefix_lower, v_delimiter);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Handle offset, emit if needed, skip to next folder
            IF v_skipped < offsets THEN
                v_skipped := v_skipped + 1;
            ELSE
                name := split_part(rtrim(storage.get_common_prefix(v_peek_name, v_prefix, v_delimiter), v_delimiter), v_delimiter, levels);
                id := NULL;
                updated_at := NULL;
                created_at := NULL;
                last_accessed_at := NULL;
                metadata := NULL;
                RETURN NEXT;
                v_count := v_count + 1;
            END IF;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := lower(left(v_common_prefix, -1)) || chr(ascii(v_delimiter) + 1);
            ELSE
                v_next_seek := lower(v_common_prefix);
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix_lower is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query
                USING bucketname, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix_lower) ELSE v_prefix_lower END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(lower(v_current.name), v_prefix_lower, v_delimiter);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := lower(v_current.name);
                    EXIT;
                END IF;

                -- Handle offset skipping
                IF v_skipped < offsets THEN
                    v_skipped := v_skipped + 1;
                ELSE
                    -- Emit file
                    name := split_part(v_current.name, v_delimiter, levels);
                    id := v_current.id;
                    updated_at := v_current.updated_at;
                    created_at := v_current.created_at;
                    last_accessed_at := v_current.last_accessed_at;
                    metadata := v_current.metadata;
                    RETURN NEXT;
                    v_count := v_count + 1;
                END IF;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := lower(v_current.name) || v_delimiter;
                ELSE
                    v_next_seek := lower(v_current.name);
                END IF;

                EXIT WHEN v_count >= v_limit;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


ALTER FUNCTION "storage"."search"("prefix" "text", "bucketname" "text", "limits" integer, "levels" integer, "offsets" integer, "search" "text", "sortcolumn" "text", "sortorder" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search_by_timestamp"("p_prefix" "text", "p_bucket_id" "text", "p_limit" integer, "p_level" integer, "p_start_after" "text", "p_sort_order" "text", "p_sort_column" "text", "p_sort_column_after" "text") RETURNS TABLE("key" "text", "name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $_$
DECLARE
    v_cursor_op text;
    v_query text;
    v_prefix text;
BEGIN
    v_prefix := coalesce(p_prefix, '');

    IF p_sort_order = 'asc' THEN
        v_cursor_op := '>';
    ELSE
        v_cursor_op := '<';
    END IF;

    v_query := format($sql$
        WITH raw_objects AS (
            SELECT
                o.name AS obj_name,
                o.id AS obj_id,
                o.updated_at AS obj_updated_at,
                o.created_at AS obj_created_at,
                o.last_accessed_at AS obj_last_accessed_at,
                o.metadata AS obj_metadata,
                storage.get_common_prefix(o.name, $1, '/') AS common_prefix
            FROM storage.objects o
            WHERE o.bucket_id = $2
              AND o.name COLLATE "C" LIKE $1 || '%%'
        ),
        -- Aggregate common prefixes (folders)
        -- Both created_at and updated_at use MIN(obj_created_at) to match the old prefixes table behavior
        aggregated_prefixes AS (
            SELECT
                rtrim(common_prefix, '/') AS name,
                NULL::uuid AS id,
                MIN(obj_created_at) AS updated_at,
                MIN(obj_created_at) AS created_at,
                NULL::timestamptz AS last_accessed_at,
                NULL::jsonb AS metadata,
                TRUE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NOT NULL
            GROUP BY common_prefix
        ),
        leaf_objects AS (
            SELECT
                obj_name AS name,
                obj_id AS id,
                obj_updated_at AS updated_at,
                obj_created_at AS created_at,
                obj_last_accessed_at AS last_accessed_at,
                obj_metadata AS metadata,
                FALSE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NULL
        ),
        combined AS (
            SELECT * FROM aggregated_prefixes
            UNION ALL
            SELECT * FROM leaf_objects
        ),
        filtered AS (
            SELECT *
            FROM combined
            WHERE (
                $5 = ''
                OR ROW(
                    date_trunc('milliseconds', %I),
                    name COLLATE "C"
                ) %s ROW(
                    COALESCE(NULLIF($6, '')::timestamptz, 'epoch'::timestamptz),
                    $5
                )
            )
        )
        SELECT
            split_part(name, '/', $3) AS key,
            name,
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
        FROM filtered
        ORDER BY
            COALESCE(date_trunc('milliseconds', %I), 'epoch'::timestamptz) %s,
            name COLLATE "C" %s
        LIMIT $4
    $sql$,
        p_sort_column,
        v_cursor_op,
        p_sort_column,
        p_sort_order,
        p_sort_order
    );

    RETURN QUERY EXECUTE v_query
    USING v_prefix, p_bucket_id, p_level, p_limit, p_start_after, p_sort_column_after;
END;
$_$;


ALTER FUNCTION "storage"."search_by_timestamp"("p_prefix" "text", "p_bucket_id" "text", "p_limit" integer, "p_level" integer, "p_start_after" "text", "p_sort_order" "text", "p_sort_column" "text", "p_sort_column_after" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search_v2"("prefix" "text", "bucket_name" "text", "limits" integer DEFAULT 100, "levels" integer DEFAULT 1, "start_after" "text" DEFAULT ''::"text", "sort_order" "text" DEFAULT 'asc'::"text", "sort_column" "text" DEFAULT 'name'::"text", "sort_column_after" "text" DEFAULT ''::"text") RETURNS TABLE("key" "text", "name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
    v_sort_col text;
    v_sort_ord text;
    v_limit int;
BEGIN
    -- Cap limit to maximum of 1500 records
    v_limit := LEAST(coalesce(limits, 100), 1500);

    -- Validate and normalize sort_order
    v_sort_ord := lower(coalesce(sort_order, 'asc'));
    IF v_sort_ord NOT IN ('asc', 'desc') THEN
        v_sort_ord := 'asc';
    END IF;

    -- Validate and normalize sort_column
    v_sort_col := lower(coalesce(sort_column, 'name'));
    IF v_sort_col NOT IN ('name', 'updated_at', 'created_at') THEN
        v_sort_col := 'name';
    END IF;

    -- Route to appropriate implementation
    IF v_sort_col = 'name' THEN
        -- Use list_objects_with_delimiter for name sorting (most efficient: O(k * log n))
        RETURN QUERY
        SELECT
            split_part(l.name, '/', levels) AS key,
            l.name AS name,
            l.id,
            l.updated_at,
            l.created_at,
            l.last_accessed_at,
            l.metadata
        FROM storage.list_objects_with_delimiter(
            bucket_name,
            coalesce(prefix, ''),
            '/',
            v_limit,
            start_after,
            '',
            v_sort_ord
        ) l;
    ELSE
        -- Use aggregation approach for timestamp sorting
        -- Not efficient for large datasets but supports correct pagination
        RETURN QUERY SELECT * FROM storage.search_by_timestamp(
            prefix, bucket_name, v_limit, levels, start_after,
            v_sort_ord, v_sort_col, sort_column_after
        );
    END IF;
END;
$$;


ALTER FUNCTION "storage"."search_v2"("prefix" "text", "bucket_name" "text", "limits" integer, "levels" integer, "start_after" "text", "sort_order" "text", "sort_column" "text", "sort_column_after" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


ALTER FUNCTION "storage"."update_updated_at_column"() OWNER TO "supabase_storage_admin";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."athlete_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "athlete_id" "uuid" NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "starts_at" "date" DEFAULT CURRENT_DATE NOT NULL,
    "ends_at" "date",
    "active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."athlete_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."body_measurements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "athlete_id" "uuid" NOT NULL,
    "measured_at" "date" DEFAULT CURRENT_DATE NOT NULL,
    "weight_kg" numeric(6,2),
    "waist_cm" numeric(6,2),
    "notes" "text"
);


ALTER TABLE "public"."body_measurements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coach_athlete_relationships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "athlete_id" "uuid" NOT NULL,
    "status" "public"."relationship_status" DEFAULT 'active'::"public"."relationship_status" NOT NULL,
    "started_at" "date" DEFAULT CURRENT_DATE NOT NULL,
    "ended_at" "date",
    CONSTRAINT "coach_athlete_relationships_check" CHECK (("coach_id" <> "athlete_id"))
);


ALTER TABLE "public"."coach_athlete_relationships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coach_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "invite_code" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '14 days'::interval) NOT NULL,
    "accepted_at" timestamp with time zone,
    "accepted_by" "uuid"
);


ALTER TABLE "public"."coach_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coach_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "athlete_id" "uuid" NOT NULL,
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."coach_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "athlete_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "conversations_distinct_users" CHECK (("coach_id" <> "athlete_id"))
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_checkins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "athlete_id" "uuid" NOT NULL,
    "checkin_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "sleep_minutes" integer,
    "sleep_quality" integer,
    "fatigue" integer,
    "stress" integer,
    "soreness" integer,
    "motivation" integer,
    "pain" integer,
    "notes" "text",
    CONSTRAINT "daily_checkins_fatigue_check" CHECK ((("fatigue" >= 1) AND ("fatigue" <= 10))),
    CONSTRAINT "daily_checkins_motivation_check" CHECK ((("motivation" >= 1) AND ("motivation" <= 10))),
    CONSTRAINT "daily_checkins_pain_check" CHECK ((("pain" >= 0) AND ("pain" <= 10))),
    CONSTRAINT "daily_checkins_sleep_minutes_check" CHECK ((("sleep_minutes" >= 0) AND ("sleep_minutes" <= 1440))),
    CONSTRAINT "daily_checkins_sleep_quality_check" CHECK ((("sleep_quality" >= 1) AND ("sleep_quality" <= 10))),
    CONSTRAINT "daily_checkins_soreness_check" CHECK ((("soreness" >= 1) AND ("soreness" <= 10))),
    CONSTRAINT "daily_checkins_stress_check" CHECK ((("stress" >= 1) AND ("stress" <= 10)))
);


ALTER TABLE "public"."daily_checkins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exercises" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_coach_id" "uuid",
    "name" "text" NOT NULL,
    "category" "text",
    "instructions" "text",
    "video_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."exercises" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "type" "text" DEFAULT 'text'::"text" NOT NULL,
    "content" "text",
    "media_url" "text",
    "media_duration" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "read_at" timestamp with time zone,
    CONSTRAINT "messages_content_or_media" CHECK (((("type" = 'text'::"text") AND ("content" IS NOT NULL) AND ("length"(TRIM(BOTH FROM "content")) > 0)) OR (("type" = ANY (ARRAY['image'::"text", 'video'::"text", 'audio'::"text"])) AND ("media_url" IS NOT NULL)) OR ("type" = 'call'::"text"))),
    CONSTRAINT "messages_media_duration_check" CHECK ((("media_duration" IS NULL) OR ("media_duration" >= 0))),
    CONSTRAINT "messages_type_check" CHECK (("type" = ANY (ARRAY['text'::"text", 'image'::"text", 'video'::"text", 'audio'::"text", 'call'::"text"])))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."nutrition_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "entry_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "meal_type" "text" DEFAULT 'collation'::"text" NOT NULL,
    "food_name" "text" NOT NULL,
    "grams" numeric(8,2) NOT NULL,
    "calories" numeric(10,2) DEFAULT 0 NOT NULL,
    "protein_g" numeric(10,2) DEFAULT 0 NOT NULL,
    "carbs_g" numeric(10,2) DEFAULT 0 NOT NULL,
    "fat_g" numeric(10,2) DEFAULT 0 NOT NULL,
    "fiber_g" numeric(10,2) DEFAULT 0 NOT NULL,
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "barcode" "text",
    "source_food_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "eaten_on" "date" DEFAULT CURRENT_DATE NOT NULL,
    CONSTRAINT "nutrition_entries_calories_check" CHECK (("calories" >= (0)::numeric)),
    CONSTRAINT "nutrition_entries_carbs_g_check" CHECK (("carbs_g" >= (0)::numeric)),
    CONSTRAINT "nutrition_entries_fat_g_check" CHECK (("fat_g" >= (0)::numeric)),
    CONSTRAINT "nutrition_entries_fiber_g_check" CHECK (("fiber_g" >= (0)::numeric)),
    CONSTRAINT "nutrition_entries_grams_check" CHECK (("grams" > (0)::numeric)),
    CONSTRAINT "nutrition_entries_meal_type_check" CHECK (("meal_type" = ANY (ARRAY['breakfast'::"text", 'lunch'::"text", 'dinner'::"text", 'snack'::"text", 'petit_dejeuner'::"text", 'dejeuner'::"text", 'diner'::"text", 'collation'::"text"]))),
    CONSTRAINT "nutrition_entries_protein_g_check" CHECK (("protein_g" >= (0)::numeric)),
    CONSTRAINT "nutrition_entries_source_check" CHECK (("source" = ANY (ARRAY['manual'::"text", 'open_food_facts'::"text", 'usda'::"text", 'ciqual_2025'::"text"])))
);


ALTER TABLE "public"."nutrition_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."nutrition_profile" (
    "user_id" "uuid" NOT NULL,
    "weight_kg" numeric,
    "goal" "text" DEFAULT 'maintenance'::"text" NOT NULL,
    "activity_level" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "nutrition_profile_activity_level_check" CHECK (("activity_level" = ANY (ARRAY['low'::"text", 'moderate'::"text", 'high'::"text", 'very_high'::"text"]))),
    CONSTRAINT "nutrition_profile_goal_check" CHECK (("goal" = ANY (ARRAY['mass_gain'::"text", 'weight_loss'::"text", 'maintenance'::"text"]))),
    CONSTRAINT "nutrition_profile_weight_kg_check" CHECK (("weight_kg" > (0)::numeric))
);


ALTER TABLE "public"."nutrition_profile" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."nutrition_targets" (
    "user_id" "uuid" NOT NULL,
    "calories_target" numeric DEFAULT 2500 NOT NULL,
    "protein_target_g" numeric DEFAULT 170 NOT NULL,
    "carbs_target_g" numeric DEFAULT 280 NOT NULL,
    "fat_target_g" numeric DEFAULT 75 NOT NULL,
    "fiber_target_g" numeric DEFAULT 30 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."nutrition_targets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."performed_sets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workout_session_id" "uuid" NOT NULL,
    "workout_exercise_id" "uuid" NOT NULL,
    "prescribed_set_id" "uuid",
    "set_number" integer NOT NULL,
    "reps" integer DEFAULT 0 NOT NULL,
    "load_kg" numeric(7,2) DEFAULT 0 NOT NULL,
    "rpe" numeric(3,1),
    "completed" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "performed_sets_load_kg_check" CHECK (("load_kg" >= (0)::numeric)),
    CONSTRAINT "performed_sets_reps_check" CHECK (("reps" >= 0))
);


ALTER TABLE "public"."performed_sets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plan_features" (
    "plan_id" "uuid" NOT NULL,
    "feature" "public"."feature_code" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."plan_features" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."prescribed_sets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workout_exercise_id" "uuid" NOT NULL,
    "set_number" integer NOT NULL,
    "target_reps" integer,
    "target_load_kg" numeric(7,2),
    "target_rpe" numeric(3,1),
    "target_rir" numeric(3,1),
    "rest_seconds" integer,
    CONSTRAINT "prescribed_sets_set_number_check" CHECK (("set_number" > 0)),
    CONSTRAINT "prescribed_sets_target_load_kg_check" CHECK ((("target_load_kg" IS NULL) OR ("target_load_kg" >= (0)::numeric))),
    CONSTRAINT "prescribed_sets_target_reps_check" CHECK ((("target_reps" IS NULL) OR ("target_reps" >= 0)))
);


ALTER TABLE "public"."prescribed_sets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "role" "public"."user_role" DEFAULT 'athlete'::"public"."user_role" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "selected_program_id" "uuid"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."program_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "program_id" "uuid" NOT NULL,
    "athlete_id" "uuid" NOT NULL,
    "starts_on" "date" NOT NULL,
    "ends_on" "date",
    "active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."program_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."programs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "duration_weeks" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "programs_duration_weeks_check" CHECK ((("duration_weeks" IS NULL) OR ("duration_weeks" > 0)))
);


ALTER TABLE "public"."programs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."routine_catalog" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "input_type" "text" NOT NULL,
    "unit" "text",
    "description" "text",
    "default_enabled" boolean DEFAULT false NOT NULL,
    "polarity" "text" DEFAULT 'higher_better'::"text" NOT NULL,
    "target_min" numeric,
    "target_max" numeric,
    "recovery_weight" numeric DEFAULT 0 NOT NULL,
    "stress_weight" numeric DEFAULT 0 NOT NULL,
    "readiness_weight" numeric DEFAULT 0 NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "routine_catalog_category_check" CHECK (("category" = ANY (ARRAY['sleep'::"text", 'nutrition'::"text", 'hydration'::"text", 'supplements'::"text", 'recovery'::"text", 'activity'::"text", 'mental'::"text", 'health'::"text", 'performance'::"text", 'environment'::"text"]))),
    CONSTRAINT "routine_catalog_input_type_check" CHECK (("input_type" = ANY (ARRAY['boolean'::"text", 'scale_5'::"text", 'scale_10'::"text", 'number'::"text", 'minutes'::"text", 'hours'::"text", 'count'::"text", 'time'::"text"]))),
    CONSTRAINT "routine_catalog_polarity_check" CHECK (("polarity" = ANY (ARRAY['higher_better'::"text", 'lower_better'::"text", 'target_range'::"text", 'neutral'::"text"])))
);


ALTER TABLE "public"."routine_catalog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."routine_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "athlete_id" "uuid" NOT NULL,
    "routine_id" "uuid" NOT NULL,
    "log_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "value" numeric,
    "bool_value" boolean,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."routine_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."service_plans" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."session_training_volume" WITH ("security_invoker"='true') AS
 SELECT "workout_session_id",
    "sum"((("reps")::numeric * "load_kg")) AS "volume_kg"
   FROM "public"."performed_sets"
  WHERE ("completed" = true)
  GROUP BY "workout_session_id";


ALTER VIEW "public"."session_training_volume" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_routines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "athlete_id" "uuid" NOT NULL,
    "routine_id" "uuid" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "target_value" numeric,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_routines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workout_exercises" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workout_template_id" "uuid" NOT NULL,
    "exercise_id" "uuid" NOT NULL,
    "position" integer NOT NULL,
    "prescription_notes" "text"
);


ALTER TABLE "public"."workout_exercises" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workout_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "athlete_id" "uuid" NOT NULL,
    "workout_template_id" "uuid" NOT NULL,
    "scheduled_for" "date",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "status" "public"."workout_status" DEFAULT 'planned'::"public"."workout_status" NOT NULL,
    "athlete_notes" "text",
    "session_rpe" numeric(3,1),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."workout_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workout_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "program_id" "uuid" NOT NULL,
    "week_number" integer NOT NULL,
    "day_number" integer NOT NULL,
    "name" "text" NOT NULL,
    "notes" "text",
    "estimated_minutes" integer,
    CONSTRAINT "workout_templates_day_number_check" CHECK ((("day_number" >= 1) AND ("day_number" <= 7))),
    CONSTRAINT "workout_templates_estimated_minutes_check" CHECK ((("estimated_minutes" IS NULL) OR ("estimated_minutes" > 0))),
    CONSTRAINT "workout_templates_week_number_check" CHECK (("week_number" > 0))
);


ALTER TABLE "public"."workout_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "storage"."buckets" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "owner" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "public" boolean DEFAULT false,
    "avif_autodetection" boolean DEFAULT false,
    "file_size_limit" bigint,
    "allowed_mime_types" "text"[],
    "owner_id" "text",
    "type" "storage"."buckettype" DEFAULT 'STANDARD'::"storage"."buckettype" NOT NULL
);


ALTER TABLE "storage"."buckets" OWNER TO "supabase_storage_admin";


COMMENT ON COLUMN "storage"."buckets"."owner" IS 'Field is deprecated, use owner_id instead';



CREATE TABLE IF NOT EXISTS "storage"."buckets_analytics" (
    "name" "text" NOT NULL,
    "type" "storage"."buckettype" DEFAULT 'ANALYTICS'::"storage"."buckettype" NOT NULL,
    "format" "text" DEFAULT 'ICEBERG'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "storage"."buckets_analytics" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."buckets_vectors" (
    "id" "text" NOT NULL,
    "type" "storage"."buckettype" DEFAULT 'VECTOR'::"storage"."buckettype" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "storage"."buckets_vectors" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."migrations" (
    "id" integer NOT NULL,
    "name" character varying(100) NOT NULL,
    "hash" character varying(40) NOT NULL,
    "executed_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "storage"."migrations" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."objects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bucket_id" "text",
    "name" "text",
    "owner" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_accessed_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb",
    "path_tokens" "text"[] GENERATED ALWAYS AS ("string_to_array"("name", '/'::"text")) STORED,
    "version" "text",
    "owner_id" "text",
    "user_metadata" "jsonb"
);


ALTER TABLE "storage"."objects" OWNER TO "supabase_storage_admin";


COMMENT ON COLUMN "storage"."objects"."owner" IS 'Field is deprecated, use owner_id instead';



CREATE TABLE IF NOT EXISTS "storage"."s3_multipart_uploads" (
    "id" "text" NOT NULL,
    "in_progress_size" bigint DEFAULT 0 NOT NULL,
    "upload_signature" "text" NOT NULL,
    "bucket_id" "text" NOT NULL,
    "key" "text" NOT NULL COLLATE "pg_catalog"."C",
    "version" "text" NOT NULL,
    "owner_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_metadata" "jsonb",
    "metadata" "jsonb"
);


ALTER TABLE "storage"."s3_multipart_uploads" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."s3_multipart_uploads_parts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "upload_id" "text" NOT NULL,
    "size" bigint DEFAULT 0 NOT NULL,
    "part_number" integer NOT NULL,
    "bucket_id" "text" NOT NULL,
    "key" "text" NOT NULL COLLATE "pg_catalog"."C",
    "etag" "text" NOT NULL,
    "owner_id" "text",
    "version" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "storage"."s3_multipart_uploads_parts" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."vector_indexes" (
    "id" "text" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL COLLATE "pg_catalog"."C",
    "bucket_id" "text" NOT NULL,
    "data_type" "text" NOT NULL,
    "dimension" integer NOT NULL,
    "distance_metric" "text" NOT NULL,
    "metadata_configuration" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "storage"."vector_indexes" OWNER TO "supabase_storage_admin";


ALTER TABLE ONLY "public"."athlete_subscriptions"
    ADD CONSTRAINT "athlete_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."body_measurements"
    ADD CONSTRAINT "body_measurements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_athlete_relationships"
    ADD CONSTRAINT "coach_athlete_relationships_coach_id_athlete_id_key" UNIQUE ("coach_id", "athlete_id");



ALTER TABLE ONLY "public"."coach_athlete_relationships"
    ADD CONSTRAINT "coach_athlete_relationships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_invites"
    ADD CONSTRAINT "coach_invites_invite_code_key" UNIQUE ("invite_code");



ALTER TABLE ONLY "public"."coach_invites"
    ADD CONSTRAINT "coach_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_notes"
    ADD CONSTRAINT "coach_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_unique_pair" UNIQUE ("coach_id", "athlete_id");



ALTER TABLE ONLY "public"."daily_checkins"
    ADD CONSTRAINT "daily_checkins_athlete_id_checkin_date_key" UNIQUE ("athlete_id", "checkin_date");



ALTER TABLE ONLY "public"."daily_checkins"
    ADD CONSTRAINT "daily_checkins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercises"
    ADD CONSTRAINT "exercises_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."nutrition_entries"
    ADD CONSTRAINT "nutrition_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."nutrition_profile"
    ADD CONSTRAINT "nutrition_profile_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."nutrition_targets"
    ADD CONSTRAINT "nutrition_targets_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."performed_sets"
    ADD CONSTRAINT "performed_sets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."performed_sets"
    ADD CONSTRAINT "performed_sets_workout_session_id_workout_exercise_id_set_n_key" UNIQUE ("workout_session_id", "workout_exercise_id", "set_number");



ALTER TABLE ONLY "public"."plan_features"
    ADD CONSTRAINT "plan_features_pkey" PRIMARY KEY ("plan_id", "feature");



ALTER TABLE ONLY "public"."prescribed_sets"
    ADD CONSTRAINT "prescribed_sets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."program_assignments"
    ADD CONSTRAINT "program_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."programs"
    ADD CONSTRAINT "programs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."routine_catalog"
    ADD CONSTRAINT "routine_catalog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."routine_catalog"
    ADD CONSTRAINT "routine_catalog_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."routine_logs"
    ADD CONSTRAINT "routine_logs_athlete_id_routine_id_log_date_key" UNIQUE ("athlete_id", "routine_id", "log_date");



ALTER TABLE ONLY "public"."routine_logs"
    ADD CONSTRAINT "routine_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_plans"
    ADD CONSTRAINT "service_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_routines"
    ADD CONSTRAINT "user_routines_athlete_id_routine_id_key" UNIQUE ("athlete_id", "routine_id");



ALTER TABLE ONLY "public"."user_routines"
    ADD CONSTRAINT "user_routines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workout_exercises"
    ADD CONSTRAINT "workout_exercises_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workout_exercises"
    ADD CONSTRAINT "workout_exercises_workout_template_id_position_key" UNIQUE ("workout_template_id", "position");



ALTER TABLE ONLY "public"."workout_sessions"
    ADD CONSTRAINT "workout_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workout_templates"
    ADD CONSTRAINT "workout_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."buckets_analytics"
    ADD CONSTRAINT "buckets_analytics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."buckets"
    ADD CONSTRAINT "buckets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."buckets_vectors"
    ADD CONSTRAINT "buckets_vectors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."migrations"
    ADD CONSTRAINT "migrations_name_key" UNIQUE ("name");



ALTER TABLE ONLY "storage"."migrations"
    ADD CONSTRAINT "migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."objects"
    ADD CONSTRAINT "objects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads_parts"
    ADD CONSTRAINT "s3_multipart_uploads_parts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads"
    ADD CONSTRAINT "s3_multipart_uploads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."vector_indexes"
    ADD CONSTRAINT "vector_indexes_pkey" PRIMARY KEY ("id");



CREATE INDEX "conversations_athlete_idx" ON "public"."conversations" USING "btree" ("athlete_id");



CREATE INDEX "conversations_coach_idx" ON "public"."conversations" USING "btree" ("coach_id");



CREATE INDEX "idx_assignment_athlete" ON "public"."program_assignments" USING "btree" ("athlete_id");



CREATE INDEX "idx_checkin_athlete_date" ON "public"."daily_checkins" USING "btree" ("athlete_id", "checkin_date" DESC);



CREATE INDEX "idx_nutrition_profile_goal" ON "public"."nutrition_profile" USING "btree" ("goal");



CREATE INDEX "idx_performed_session" ON "public"."performed_sets" USING "btree" ("workout_session_id");



CREATE INDEX "idx_relationship_athlete" ON "public"."coach_athlete_relationships" USING "btree" ("athlete_id");



CREATE INDEX "idx_session_athlete_date" ON "public"."workout_sessions" USING "btree" ("athlete_id", "scheduled_for" DESC);



CREATE INDEX "messages_conversation_created_idx" ON "public"."messages" USING "btree" ("conversation_id", "created_at" DESC);



CREATE INDEX "messages_sender_idx" ON "public"."messages" USING "btree" ("sender_id");



CREATE INDEX "nutrition_entries_user_date_idx" ON "public"."nutrition_entries" USING "btree" ("user_id", "entry_date" DESC, "created_at" DESC);



CREATE INDEX "nutrition_entries_user_eaten_on_idx" ON "public"."nutrition_entries" USING "btree" ("user_id", "eaten_on");



CREATE INDEX "nutrition_targets_user_id_idx" ON "public"."nutrition_targets" USING "btree" ("user_id");



CREATE INDEX "routine_logs_athlete_date_idx" ON "public"."routine_logs" USING "btree" ("athlete_id", "log_date" DESC);



CREATE INDEX "user_routines_athlete_idx" ON "public"."user_routines" USING "btree" ("athlete_id");



CREATE UNIQUE INDEX "bname" ON "storage"."buckets" USING "btree" ("name");



CREATE UNIQUE INDEX "bucketid_objname" ON "storage"."objects" USING "btree" ("bucket_id", "name");



CREATE UNIQUE INDEX "buckets_analytics_unique_name_idx" ON "storage"."buckets_analytics" USING "btree" ("name") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_multipart_uploads_list" ON "storage"."s3_multipart_uploads" USING "btree" ("bucket_id", "key", "created_at");



CREATE INDEX "idx_objects_bucket_id_name" ON "storage"."objects" USING "btree" ("bucket_id", "name" COLLATE "C");



CREATE INDEX "idx_objects_bucket_id_name_lower" ON "storage"."objects" USING "btree" ("bucket_id", "lower"("name") COLLATE "C");



CREATE INDEX "name_prefix_search" ON "storage"."objects" USING "btree" ("name" "text_pattern_ops");



CREATE UNIQUE INDEX "vector_indexes_name_bucket_id_idx" ON "storage"."vector_indexes" USING "btree" ("name", "bucket_id");



CREATE OR REPLACE TRIGGER "enforce_bucket_name_length_trigger" BEFORE INSERT OR UPDATE OF "name" ON "storage"."buckets" FOR EACH ROW EXECUTE FUNCTION "storage"."enforce_bucket_name_length"();



CREATE OR REPLACE TRIGGER "protect_buckets_delete" BEFORE DELETE ON "storage"."buckets" FOR EACH STATEMENT EXECUTE FUNCTION "storage"."protect_delete"();



CREATE OR REPLACE TRIGGER "protect_objects_delete" BEFORE DELETE ON "storage"."objects" FOR EACH STATEMENT EXECUTE FUNCTION "storage"."protect_delete"();



CREATE OR REPLACE TRIGGER "update_objects_updated_at" BEFORE UPDATE ON "storage"."objects" FOR EACH ROW EXECUTE FUNCTION "storage"."update_updated_at_column"();



ALTER TABLE ONLY "public"."athlete_subscriptions"
    ADD CONSTRAINT "athlete_subscriptions_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."athlete_subscriptions"
    ADD CONSTRAINT "athlete_subscriptions_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."athlete_subscriptions"
    ADD CONSTRAINT "athlete_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."service_plans"("id");



ALTER TABLE ONLY "public"."body_measurements"
    ADD CONSTRAINT "body_measurements_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_athlete_relationships"
    ADD CONSTRAINT "coach_athlete_relationships_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_athlete_relationships"
    ADD CONSTRAINT "coach_athlete_relationships_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_invites"
    ADD CONSTRAINT "coach_invites_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."coach_invites"
    ADD CONSTRAINT "coach_invites_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_notes"
    ADD CONSTRAINT "coach_notes_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_notes"
    ADD CONSTRAINT "coach_notes_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_checkins"
    ADD CONSTRAINT "daily_checkins_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercises"
    ADD CONSTRAINT "exercises_owner_coach_id_fkey" FOREIGN KEY ("owner_coach_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nutrition_entries"
    ADD CONSTRAINT "nutrition_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nutrition_profile"
    ADD CONSTRAINT "nutrition_profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nutrition_targets"
    ADD CONSTRAINT "nutrition_targets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."performed_sets"
    ADD CONSTRAINT "performed_sets_prescribed_set_id_fkey" FOREIGN KEY ("prescribed_set_id") REFERENCES "public"."prescribed_sets"("id");



ALTER TABLE ONLY "public"."performed_sets"
    ADD CONSTRAINT "performed_sets_workout_exercise_id_fkey" FOREIGN KEY ("workout_exercise_id") REFERENCES "public"."workout_exercises"("id");



ALTER TABLE ONLY "public"."performed_sets"
    ADD CONSTRAINT "performed_sets_workout_session_id_fkey" FOREIGN KEY ("workout_session_id") REFERENCES "public"."workout_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plan_features"
    ADD CONSTRAINT "plan_features_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."service_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prescribed_sets"
    ADD CONSTRAINT "prescribed_sets_workout_exercise_id_fkey" FOREIGN KEY ("workout_exercise_id") REFERENCES "public"."workout_exercises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_selected_program_id_fkey" FOREIGN KEY ("selected_program_id") REFERENCES "public"."programs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."program_assignments"
    ADD CONSTRAINT "program_assignments_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."program_assignments"
    ADD CONSTRAINT "program_assignments_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."programs"
    ADD CONSTRAINT "programs_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."routine_logs"
    ADD CONSTRAINT "routine_logs_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."routine_logs"
    ADD CONSTRAINT "routine_logs_routine_id_fkey" FOREIGN KEY ("routine_id") REFERENCES "public"."routine_catalog"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_plans"
    ADD CONSTRAINT "service_plans_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_routines"
    ADD CONSTRAINT "user_routines_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_routines"
    ADD CONSTRAINT "user_routines_routine_id_fkey" FOREIGN KEY ("routine_id") REFERENCES "public"."routine_catalog"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workout_exercises"
    ADD CONSTRAINT "workout_exercises_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id");



ALTER TABLE ONLY "public"."workout_exercises"
    ADD CONSTRAINT "workout_exercises_workout_template_id_fkey" FOREIGN KEY ("workout_template_id") REFERENCES "public"."workout_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workout_sessions"
    ADD CONSTRAINT "workout_sessions_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workout_sessions"
    ADD CONSTRAINT "workout_sessions_workout_template_id_fkey" FOREIGN KEY ("workout_template_id") REFERENCES "public"."workout_templates"("id");



ALTER TABLE ONLY "public"."workout_templates"
    ADD CONSTRAINT "workout_templates_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "storage"."objects"
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads"
    ADD CONSTRAINT "s3_multipart_uploads_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads_parts"
    ADD CONSTRAINT "s3_multipart_uploads_parts_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads_parts"
    ADD CONSTRAINT "s3_multipart_uploads_parts_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "storage"."s3_multipart_uploads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "storage"."vector_indexes"
    ADD CONSTRAINT "vector_indexes_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets_vectors"("id");



CREATE POLICY "athlete_can_read_invite_by_self_email" ON "public"."coach_invites" FOR SELECT USING ((("accepted_at" IS NULL) AND ("expires_at" > "now"()) AND ("lower"("email") = "lower"(COALESCE(("auth"."jwt"() ->> 'email'::"text"), ''::"text")))));



CREATE POLICY "athlete_inserts_own_sessions" ON "public"."workout_sessions" FOR INSERT TO "authenticated" WITH CHECK (("athlete_id" = "auth"."uid"()));



CREATE POLICY "athlete_owns_checkins" ON "public"."daily_checkins" USING (("athlete_id" = "auth"."uid"())) WITH CHECK (("athlete_id" = "auth"."uid"()));



CREATE POLICY "athlete_owns_measurements" ON "public"."body_measurements" USING (("athlete_id" = "auth"."uid"())) WITH CHECK (("athlete_id" = "auth"."uid"()));



CREATE POLICY "athlete_reads_assigned_prescribed_sets" ON "public"."prescribed_sets" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("public"."workout_exercises" "we"
     JOIN "public"."workout_templates" "wt" ON (("wt"."id" = "we"."workout_template_id")))
     JOIN "public"."program_assignments" "a" ON (("a"."program_id" = "wt"."program_id")))
  WHERE (("we"."id" = "prescribed_sets"."workout_exercise_id") AND ("a"."athlete_id" = "auth"."uid"()) AND ("a"."active" = true)))));



CREATE POLICY "athlete_reads_assigned_programs" ON "public"."programs" FOR SELECT USING ("public"."current_user_has_program_assignment"("id"));



CREATE POLICY "athlete_reads_assigned_workout_exercises" ON "public"."workout_exercises" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."workout_templates" "wt"
     JOIN "public"."program_assignments" "a" ON (("a"."program_id" = "wt"."program_id")))
  WHERE (("wt"."id" = "workout_exercises"."workout_template_id") AND ("a"."athlete_id" = "auth"."uid"()) AND ("a"."active" = true)))));



CREATE POLICY "athlete_reads_assigned_workout_templates" ON "public"."workout_templates" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."program_assignments" "a"
  WHERE (("a"."program_id" = "workout_templates"."program_id") AND ("a"."athlete_id" = "auth"."uid"()) AND ("a"."active" = true)))));



CREATE POLICY "athlete_reads_assignments" ON "public"."program_assignments" FOR SELECT USING (("athlete_id" = "auth"."uid"()));



CREATE POLICY "athlete_reads_exercises_in_assigned_program" ON "public"."exercises" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("public"."workout_exercises" "we"
     JOIN "public"."workout_templates" "wt" ON (("wt"."id" = "we"."workout_template_id")))
     JOIN "public"."program_assignments" "a" ON (("a"."program_id" = "wt"."program_id")))
  WHERE (("we"."exercise_id" = "exercises"."id") AND ("a"."athlete_id" = "auth"."uid"()) AND ("a"."active" = true)))));



CREATE POLICY "athlete_reads_performed_sets" ON "public"."performed_sets" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."workout_sessions" "s"
  WHERE (("s"."id" = "performed_sets"."workout_session_id") AND ("s"."athlete_id" = "auth"."uid"())))));



CREATE POLICY "athlete_reads_sessions" ON "public"."workout_sessions" FOR SELECT USING (("athlete_id" = "auth"."uid"()));



ALTER TABLE "public"."athlete_subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "athlete_updates_sessions" ON "public"."workout_sessions" FOR UPDATE USING (("athlete_id" = "auth"."uid"())) WITH CHECK (("athlete_id" = "auth"."uid"()));



CREATE POLICY "athlete_writes_performed_sets" ON "public"."performed_sets" USING ((EXISTS ( SELECT 1
   FROM "public"."workout_sessions" "s"
  WHERE (("s"."id" = "performed_sets"."workout_session_id") AND ("s"."athlete_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."workout_sessions" "s"
  WHERE (("s"."id" = "performed_sets"."workout_session_id") AND ("s"."athlete_id" = "auth"."uid"())))));



ALTER TABLE "public"."body_measurements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coach_athlete_relationships" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "coach_can_read_athlete_profile" ON "public"."profiles" FOR SELECT USING ("public"."is_coach_of"("id"));



CREATE POLICY "coach_creates_sessions_for_athletes" ON "public"."workout_sessions" FOR INSERT WITH CHECK ("public"."is_coach_of"("athlete_id"));



ALTER TABLE "public"."coach_invites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "coach_manages_assignments" ON "public"."program_assignments" USING ("public"."current_user_is_program_coach"("program_id")) WITH CHECK (("public"."current_user_is_program_coach"("program_id") AND "public"."is_coach_of"("athlete_id")));



CREATE POLICY "coach_manages_own_exercises" ON "public"."exercises" USING (("owner_coach_id" = "auth"."uid"())) WITH CHECK (("owner_coach_id" = "auth"."uid"()));



CREATE POLICY "coach_manages_own_invites" ON "public"."coach_invites" USING (("coach_id" = "auth"."uid"())) WITH CHECK (("coach_id" = "auth"."uid"()));



CREATE POLICY "coach_manages_own_programs" ON "public"."programs" USING (("coach_id" = "auth"."uid"())) WITH CHECK (("coach_id" = "auth"."uid"()));



CREATE POLICY "coach_manages_plan_features" ON "public"."plan_features" USING ((EXISTS ( SELECT 1
   FROM "public"."service_plans" "sp"
  WHERE (("sp"."id" = "plan_features"."plan_id") AND ("sp"."coach_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."service_plans" "sp"
  WHERE (("sp"."id" = "plan_features"."plan_id") AND ("sp"."coach_id" = "auth"."uid"())))));



CREATE POLICY "coach_manages_prescribed_sets" ON "public"."prescribed_sets" USING ((EXISTS ( SELECT 1
   FROM (("public"."workout_exercises" "we"
     JOIN "public"."workout_templates" "wt" ON (("wt"."id" = "we"."workout_template_id")))
     JOIN "public"."programs" "p" ON (("p"."id" = "wt"."program_id")))
  WHERE (("we"."id" = "prescribed_sets"."workout_exercise_id") AND ("p"."coach_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."workout_exercises" "we"
     JOIN "public"."workout_templates" "wt" ON (("wt"."id" = "we"."workout_template_id")))
     JOIN "public"."programs" "p" ON (("p"."id" = "wt"."program_id")))
  WHERE (("we"."id" = "prescribed_sets"."workout_exercise_id") AND ("p"."coach_id" = "auth"."uid"())))));



CREATE POLICY "coach_manages_program_templates" ON "public"."workout_templates" USING ((EXISTS ( SELECT 1
   FROM "public"."programs" "p"
  WHERE (("p"."id" = "workout_templates"."program_id") AND ("p"."coach_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."programs" "p"
  WHERE (("p"."id" = "workout_templates"."program_id") AND ("p"."coach_id" = "auth"."uid"())))));



CREATE POLICY "coach_manages_relationships" ON "public"."coach_athlete_relationships" USING (("coach_id" = "auth"."uid"())) WITH CHECK (("coach_id" = "auth"."uid"()));



CREATE POLICY "coach_manages_service_plans" ON "public"."service_plans" USING (("coach_id" = "auth"."uid"())) WITH CHECK (("coach_id" = "auth"."uid"()));



CREATE POLICY "coach_manages_subscriptions" ON "public"."athlete_subscriptions" USING (("coach_id" = "auth"."uid"())) WITH CHECK ((("coach_id" = "auth"."uid"()) AND "public"."is_coach_of"("athlete_id")));



CREATE POLICY "coach_manages_workout_exercises" ON "public"."workout_exercises" USING ((EXISTS ( SELECT 1
   FROM ("public"."workout_templates" "wt"
     JOIN "public"."programs" "p" ON (("p"."id" = "wt"."program_id")))
  WHERE (("wt"."id" = "workout_exercises"."workout_template_id") AND ("p"."coach_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."workout_templates" "wt"
     JOIN "public"."programs" "p" ON (("p"."id" = "wt"."program_id")))
  WHERE (("wt"."id" = "workout_exercises"."workout_template_id") AND ("p"."coach_id" = "auth"."uid"())))));



ALTER TABLE "public"."coach_notes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "coach_owns_notes" ON "public"."coach_notes" USING (("coach_id" = "auth"."uid"())) WITH CHECK (("coach_id" = "auth"."uid"()));



CREATE POLICY "coach_reads_checkins" ON "public"."daily_checkins" FOR SELECT USING ("public"."is_coach_of"("athlete_id"));



CREATE POLICY "coach_reads_measurements" ON "public"."body_measurements" FOR SELECT USING ("public"."is_coach_of"("athlete_id"));



CREATE POLICY "coach_reads_sessions" ON "public"."workout_sessions" FOR SELECT USING ("public"."is_coach_of"("athlete_id"));



CREATE POLICY "coach_updates_sessions_for_athletes" ON "public"."workout_sessions" FOR UPDATE USING ("public"."is_coach_of"("athlete_id")) WITH CHECK ("public"."is_coach_of"("athlete_id"));



ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conversations_create_active_relationship" ON "public"."conversations" FOR INSERT TO "authenticated" WITH CHECK (((("auth"."uid"() = "coach_id") OR ("auth"."uid"() = "athlete_id")) AND (EXISTS ( SELECT 1
   FROM "public"."coach_athlete_relationships" "r"
  WHERE (("r"."coach_id" = "conversations"."coach_id") AND ("r"."athlete_id" = "conversations"."athlete_id") AND (("r"."status")::"text" = 'active'::"text"))))));



CREATE POLICY "conversations_read_members" ON "public"."conversations" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "coach_id") OR ("auth"."uid"() = "athlete_id")));



ALTER TABLE "public"."daily_checkins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exercises" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "messages_delete_own" ON "public"."messages" FOR DELETE TO "authenticated" USING (("sender_id" = "auth"."uid"()));



CREATE POLICY "messages_read_members" ON "public"."messages" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND (("c"."coach_id" = "auth"."uid"()) OR ("c"."athlete_id" = "auth"."uid"()))))));



CREATE POLICY "messages_send_members" ON "public"."messages" FOR INSERT TO "authenticated" WITH CHECK ((("sender_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND (("c"."coach_id" = "auth"."uid"()) OR ("c"."athlete_id" = "auth"."uid"())))))));



ALTER TABLE "public"."nutrition_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "nutrition_entries_delete_own" ON "public"."nutrition_entries" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "nutrition_entries_insert_own" ON "public"."nutrition_entries" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "nutrition_entries_select_own" ON "public"."nutrition_entries" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "nutrition_entries_update_own" ON "public"."nutrition_entries" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."nutrition_profile" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "nutrition_profile_insert_own" ON "public"."nutrition_profile" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "nutrition_profile_select_own" ON "public"."nutrition_profile" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "nutrition_profile_update_own" ON "public"."nutrition_profile" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."nutrition_targets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "nutrition_targets_insert_own" ON "public"."nutrition_targets" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "nutrition_targets_select_own" ON "public"."nutrition_targets" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "nutrition_targets_update_own" ON "public"."nutrition_targets" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."performed_sets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plan_features" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."prescribed_sets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profile_self_read" ON "public"."profiles" FOR SELECT USING (("id" = "auth"."uid"()));



CREATE POLICY "profile_self_update" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."program_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."programs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "relationship_members_read" ON "public"."coach_athlete_relationships" FOR SELECT USING ((("coach_id" = "auth"."uid"()) OR ("athlete_id" = "auth"."uid"())));



ALTER TABLE "public"."routine_catalog" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "routine_catalog_read" ON "public"."routine_catalog" FOR SELECT TO "authenticated" USING (("active" = true));



ALTER TABLE "public"."routine_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "routine_logs_own_all" ON "public"."routine_logs" TO "authenticated" USING (("auth"."uid"() = "athlete_id")) WITH CHECK (("auth"."uid"() = "athlete_id"));



ALTER TABLE "public"."service_plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_routines" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_routines_own_all" ON "public"."user_routines" TO "authenticated" USING (("auth"."uid"() = "athlete_id")) WITH CHECK (("auth"."uid"() = "athlete_id"));



ALTER TABLE "public"."workout_exercises" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workout_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workout_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."buckets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."buckets_analytics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."buckets_vectors" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chat_media_delete_own" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'chat-media'::"text") AND ("owner_id" = ("auth"."uid"())::"text")));



CREATE POLICY "chat_media_insert_members" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'chat-media'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE ((("c"."id")::"text" = "split_part"("objects"."name", '/'::"text", 1)) AND (("c"."coach_id" = "auth"."uid"()) OR ("c"."athlete_id" = "auth"."uid"())))))));



CREATE POLICY "chat_media_read_members" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'chat-media'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE ((("c"."id")::"text" = "split_part"("objects"."name", '/'::"text", 1)) AND (("c"."coach_id" = "auth"."uid"()) OR ("c"."athlete_id" = "auth"."uid"())))))));



ALTER TABLE "storage"."migrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."objects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."s3_multipart_uploads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."s3_multipart_uploads_parts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."vector_indexes" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT USAGE ON SCHEMA "storage" TO "postgres" WITH GRANT OPTION;
GRANT USAGE ON SCHEMA "storage" TO "anon";
GRANT USAGE ON SCHEMA "storage" TO "authenticated";
GRANT USAGE ON SCHEMA "storage" TO "service_role";
GRANT ALL ON SCHEMA "storage" TO "supabase_storage_admin" WITH GRANT OPTION;
GRANT ALL ON SCHEMA "storage" TO "dashboard_user";



REVOKE ALL ON FUNCTION "public"."accept_coach_invite"("code" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."accept_coach_invite"("code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_coach_invite"("code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."current_user_has_program_assignment"("target_program" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."current_user_has_program_assignment"("target_program" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_has_program_assignment"("target_program" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."current_user_is_program_coach"("target_program" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."current_user_is_program_coach"("target_program" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_is_program_coach"("target_program" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_coach_of"("target_athlete" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_coach_of"("target_athlete" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_coach_of"("target_athlete" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."athlete_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."athlete_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."athlete_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."body_measurements" TO "anon";
GRANT ALL ON TABLE "public"."body_measurements" TO "authenticated";
GRANT ALL ON TABLE "public"."body_measurements" TO "service_role";



GRANT ALL ON TABLE "public"."coach_athlete_relationships" TO "anon";
GRANT ALL ON TABLE "public"."coach_athlete_relationships" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_athlete_relationships" TO "service_role";



GRANT ALL ON TABLE "public"."coach_invites" TO "anon";
GRANT ALL ON TABLE "public"."coach_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_invites" TO "service_role";



GRANT ALL ON TABLE "public"."coach_notes" TO "anon";
GRANT ALL ON TABLE "public"."coach_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_notes" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."daily_checkins" TO "anon";
GRANT ALL ON TABLE "public"."daily_checkins" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_checkins" TO "service_role";



GRANT ALL ON TABLE "public"."exercises" TO "anon";
GRANT ALL ON TABLE "public"."exercises" TO "authenticated";
GRANT ALL ON TABLE "public"."exercises" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."nutrition_entries" TO "anon";
GRANT ALL ON TABLE "public"."nutrition_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."nutrition_entries" TO "service_role";



GRANT ALL ON TABLE "public"."nutrition_profile" TO "anon";
GRANT ALL ON TABLE "public"."nutrition_profile" TO "authenticated";
GRANT ALL ON TABLE "public"."nutrition_profile" TO "service_role";



GRANT ALL ON TABLE "public"."nutrition_targets" TO "anon";
GRANT ALL ON TABLE "public"."nutrition_targets" TO "authenticated";
GRANT ALL ON TABLE "public"."nutrition_targets" TO "service_role";



GRANT ALL ON TABLE "public"."performed_sets" TO "anon";
GRANT ALL ON TABLE "public"."performed_sets" TO "authenticated";
GRANT ALL ON TABLE "public"."performed_sets" TO "service_role";



GRANT ALL ON TABLE "public"."plan_features" TO "anon";
GRANT ALL ON TABLE "public"."plan_features" TO "authenticated";
GRANT ALL ON TABLE "public"."plan_features" TO "service_role";



GRANT ALL ON TABLE "public"."prescribed_sets" TO "anon";
GRANT ALL ON TABLE "public"."prescribed_sets" TO "authenticated";
GRANT ALL ON TABLE "public"."prescribed_sets" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT UPDATE("first_name") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("last_name") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("avatar_url") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("updated_at") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("selected_program_id") ON TABLE "public"."profiles" TO "authenticated";



GRANT ALL ON TABLE "public"."program_assignments" TO "anon";
GRANT ALL ON TABLE "public"."program_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."program_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."programs" TO "anon";
GRANT ALL ON TABLE "public"."programs" TO "authenticated";
GRANT ALL ON TABLE "public"."programs" TO "service_role";



GRANT ALL ON TABLE "public"."routine_catalog" TO "anon";
GRANT ALL ON TABLE "public"."routine_catalog" TO "authenticated";
GRANT ALL ON TABLE "public"."routine_catalog" TO "service_role";



GRANT ALL ON TABLE "public"."routine_logs" TO "anon";
GRANT ALL ON TABLE "public"."routine_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."routine_logs" TO "service_role";



GRANT ALL ON TABLE "public"."service_plans" TO "anon";
GRANT ALL ON TABLE "public"."service_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."service_plans" TO "service_role";



GRANT ALL ON TABLE "public"."session_training_volume" TO "anon";
GRANT ALL ON TABLE "public"."session_training_volume" TO "authenticated";
GRANT ALL ON TABLE "public"."session_training_volume" TO "service_role";



GRANT ALL ON TABLE "public"."user_routines" TO "anon";
GRANT ALL ON TABLE "public"."user_routines" TO "authenticated";
GRANT ALL ON TABLE "public"."user_routines" TO "service_role";



GRANT ALL ON TABLE "public"."workout_exercises" TO "anon";
GRANT ALL ON TABLE "public"."workout_exercises" TO "authenticated";
GRANT ALL ON TABLE "public"."workout_exercises" TO "service_role";



GRANT ALL ON TABLE "public"."workout_sessions" TO "anon";
GRANT ALL ON TABLE "public"."workout_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."workout_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."workout_templates" TO "anon";
GRANT ALL ON TABLE "public"."workout_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."workout_templates" TO "service_role";



REVOKE ALL ON TABLE "storage"."buckets" FROM "supabase_storage_admin";
GRANT ALL ON TABLE "storage"."buckets" TO "supabase_storage_admin" WITH GRANT OPTION;
GRANT ALL ON TABLE "storage"."buckets" TO "service_role";
GRANT ALL ON TABLE "storage"."buckets" TO "authenticated";
GRANT ALL ON TABLE "storage"."buckets" TO "anon";
GRANT ALL ON TABLE "storage"."buckets" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON TABLE "storage"."buckets_analytics" TO "service_role";
GRANT ALL ON TABLE "storage"."buckets_analytics" TO "authenticated";
GRANT ALL ON TABLE "storage"."buckets_analytics" TO "anon";



GRANT SELECT ON TABLE "storage"."buckets_vectors" TO "service_role";
GRANT SELECT ON TABLE "storage"."buckets_vectors" TO "authenticated";
GRANT SELECT ON TABLE "storage"."buckets_vectors" TO "anon";



REVOKE ALL ON TABLE "storage"."objects" FROM "supabase_storage_admin";
GRANT ALL ON TABLE "storage"."objects" TO "supabase_storage_admin" WITH GRANT OPTION;
GRANT ALL ON TABLE "storage"."objects" TO "service_role";
GRANT ALL ON TABLE "storage"."objects" TO "authenticated";
GRANT ALL ON TABLE "storage"."objects" TO "anon";
GRANT ALL ON TABLE "storage"."objects" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON TABLE "storage"."s3_multipart_uploads" TO "service_role";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads" TO "authenticated";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads" TO "anon";



GRANT ALL ON TABLE "storage"."s3_multipart_uploads_parts" TO "service_role";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads_parts" TO "authenticated";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads_parts" TO "anon";



GRANT SELECT ON TABLE "storage"."vector_indexes" TO "service_role";
GRANT SELECT ON TABLE "storage"."vector_indexes" TO "authenticated";
GRANT SELECT ON TABLE "storage"."vector_indexes" TO "anon";



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






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "service_role";





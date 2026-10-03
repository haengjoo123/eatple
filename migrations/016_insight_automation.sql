-- Additive migration. Run after the existing nutrition tables have been installed.
CREATE TABLE IF NOT EXISTS public.insight_settings (
    id boolean PRIMARY KEY DEFAULT true CHECK (id), enabled boolean NOT NULL DEFAULT false,
    monthly_ai_budget_krw numeric NOT NULL DEFAULT 60000 CHECK (monthly_ai_budget_krw BETWEEN 0 AND 100000),
    input_krw_per_million numeric NOT NULL DEFAULT 150 CHECK (input_krw_per_million > 0),
    output_krw_per_million numeric NOT NULL DEFAULT 750 CHECK (output_krw_per_million > 0),
    agent_token_hash text, agent_last_seen timestamptz, agent_status text,
    last_collection_date date, last_collection_error text,
    collection_lease uuid, collection_lease_until timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.insight_settings(id) VALUES (true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS public.insight_candidates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), paper_key text UNIQUE NOT NULL,
    paper jsonb NOT NULL, status text NOT NULL DEFAULT 'candidate', selection_reason text,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.insight_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), candidate_id uuid UNIQUE NOT NULL REFERENCES public.insight_candidates(id),
    run_date date UNIQUE NOT NULL, state text NOT NULL DEFAULT 'queued'
        CHECK (state IN ('queued','processing','link_pending','link_processing','review','failed','rejected','published')),
    stage text NOT NULL DEFAULT 'extract', revision integer NOT NULL DEFAULT 1,
    verified_revision integer, post_id uuid UNIQUE REFERENCES public.nutrition_posts(id),
    evidence jsonb, article jsonb, checks jsonb, products jsonb NOT NULL DEFAULT '[]',
    full_text jsonb, integrity jsonb, links_complete boolean NOT NULL DEFAULT false,
    lease uuid, lease_until timestamptz, attempts integer NOT NULL DEFAULT 0,
    last_error text, reviewed_by text, reviewed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS insight_jobs_state_idx ON public.insight_jobs(state, created_at);
ALTER TABLE public.insight_jobs ADD COLUMN IF NOT EXISTS media jsonb NOT NULL DEFAULT '{"thumbnail":null,"images":[]}';
CREATE TABLE IF NOT EXISTS public.insight_products (
    product_id text PRIMARY KEY, product jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.insight_usage (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), job_id uuid REFERENCES public.insight_jobs(id),
    stage text NOT NULL, model text NOT NULL DEFAULT 'gpt-6-luna',
    reserved_krw numeric NOT NULL CHECK (reserved_krw >= 0), cost_krw numeric,
    input_tokens bigint, output_tokens bigint, status text NOT NULL DEFAULT 'reserved',
    created_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS insight_usage_month_idx ON public.insight_usage(created_at);
ALTER TABLE public.post_related_products ADD COLUMN IF NOT EXISTS delivery_type text;
ALTER TABLE public.nutrition_posts ADD COLUMN IF NOT EXISTS thumbnail_alt text;
CREATE TABLE IF NOT EXISTS public.post_modification_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),post_id uuid REFERENCES public.nutrition_posts(id) ON DELETE CASCADE,
    admin_id uuid,admin_name text,changes text,created_at timestamptz DEFAULT now()
);
ALTER TABLE public.post_modification_history ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.post_modification_history TO service_role;

-- Public clients must not retrieve a draft directly through Supabase, including its tags/products.
-- A restrictive policy also holds when an older installation has a permissive SELECT policy.
ALTER TABLE public.nutrition_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_related_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS insight_public_posts ON public.nutrition_posts;
CREATE POLICY insight_public_posts ON public.nutrition_posts FOR SELECT TO anon,authenticated USING (is_active AND NOT is_draft);
DROP POLICY IF EXISTS insight_hide_drafts ON public.nutrition_posts;
CREATE POLICY insight_hide_drafts ON public.nutrition_posts AS RESTRICTIVE FOR SELECT TO anon,authenticated USING (is_active AND NOT is_draft);
DROP POLICY IF EXISTS insight_public_products ON public.post_related_products;
CREATE POLICY insight_public_products ON public.post_related_products FOR SELECT TO anon,authenticated
  USING (EXISTS(SELECT 1 FROM nutrition_posts WHERE id=post_id AND is_active AND NOT is_draft));
DROP POLICY IF EXISTS insight_hide_draft_products ON public.post_related_products;
CREATE POLICY insight_hide_draft_products ON public.post_related_products AS RESTRICTIVE FOR SELECT TO anon,authenticated
  USING (EXISTS(SELECT 1 FROM nutrition_posts WHERE id=post_id AND is_active AND NOT is_draft));
DROP POLICY IF EXISTS insight_public_tags ON public.post_tags;
CREATE POLICY insight_public_tags ON public.post_tags FOR SELECT TO anon,authenticated
  USING (EXISTS(SELECT 1 FROM nutrition_posts WHERE id=post_id AND is_active AND NOT is_draft));
DROP POLICY IF EXISTS insight_hide_draft_tags ON public.post_tags;
CREATE POLICY insight_hide_draft_tags ON public.post_tags AS RESTRICTIVE FOR SELECT TO anon,authenticated
  USING (EXISTS(SELECT 1 FROM nutrition_posts WHERE id=post_id AND is_active AND NOT is_draft));

-- Neither anonymous browsers nor authenticated Supabase clients can read internal evidence or tokens.
ALTER TABLE public.insight_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insight_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insight_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insight_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insight_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.insight_settings, public.insight_candidates, public.insight_jobs,
    public.insight_products, public.insight_usage FROM anon, authenticated;
GRANT ALL ON public.insight_settings, public.insight_candidates, public.insight_jobs,
    public.insight_products, public.insight_usage TO service_role;

CREATE OR REPLACE FUNCTION public.insight_start_collection(p_date date,p_force boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s insight_settings; token uuid;
BEGIN
    SELECT * INTO s FROM insight_settings WHERE id FOR UPDATE;
    IF s.collection_lease_until > now() OR (NOT p_force AND s.last_collection_date=p_date)
      OR EXISTS(SELECT 1 FROM insight_jobs WHERE run_date=p_date) THEN RETURN NULL; END IF;
    token:=gen_random_uuid();
    UPDATE insight_settings SET collection_lease=token,collection_lease_until=now()+interval '20 minutes',last_collection_date=p_date WHERE id;
    RETURN token;
END $$;

CREATE OR REPLACE FUNCTION public.insight_reserve_cost(p_job uuid, p_stage text, p_amount numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE budget numeric; used numeric; result uuid;
BEGIN
    SELECT monthly_ai_budget_krw INTO budget FROM insight_settings WHERE id FOR UPDATE;
    SELECT coalesce(sum(coalesce(cost_krw, reserved_krw)),0) INTO used FROM insight_usage
      WHERE created_at >= date_trunc('month', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul';
    IF p_amount < 0 OR used + p_amount > budget THEN RAISE EXCEPTION 'INSIGHT_BUDGET_EXCEEDED'; END IF;
    INSERT INTO insight_usage(job_id,stage,reserved_krw) VALUES(p_job,p_stage,p_amount) RETURNING id INTO result;
    RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.insight_enqueue_daily(p_date date, p_candidate uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result uuid;
BEGIN
    PERFORM 1 FROM insight_settings WHERE id FOR UPDATE;
    SELECT id INTO result FROM insight_jobs WHERE run_date=p_date;
    IF result IS NOT NULL THEN RETURN result; END IF;
    IF (SELECT count(*) FROM insight_jobs WHERE state NOT IN ('published','rejected')) >= 7 THEN RETURN NULL; END IF;
    INSERT INTO insight_jobs(candidate_id,run_date) VALUES(p_candidate,p_date)
      ON CONFLICT DO NOTHING RETURNING id INTO result;
    UPDATE insight_candidates SET status='selected' WHERE id=p_candidate;
    RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.insight_claim(p_kind text)
RETURNS SETOF public.insight_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target uuid;
BEGIN
    IF p_kind NOT IN ('pipeline','links') THEN RAISE EXCEPTION 'INSIGHT_INVALID_KIND'; END IF;
    SELECT id INTO target FROM insight_jobs
      WHERE (CASE WHEN p_kind='pipeline' THEN state IN ('queued','processing') ELSE state IN ('link_pending','link_processing') END)
        AND (lease_until IS NULL OR lease_until < now()) AND attempts < 5
      ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED;
    IF target IS NULL THEN RETURN; END IF;
    RETURN QUERY UPDATE insight_jobs SET state=CASE WHEN p_kind='pipeline' THEN 'processing' ELSE 'link_processing' END,
      lease=gen_random_uuid(), lease_until=now()+interval '20 minutes', attempts=attempts+1, updated_at=now()
      WHERE id=target RETURNING *;
END $$;

CREATE OR REPLACE FUNCTION public.insight_save_draft(p_job uuid, p_revision integer, p_lease uuid,
    p_article jsonb, p_evidence jsonb, p_checks jsonb, p_products jsonb,
    p_content text, p_state text, p_verified boolean, p_links_complete boolean)
RETURNS public.insight_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE j insight_jobs; paper jsonb; new_revision integer; category uuid;
BEGIN
    SELECT * INTO j FROM insight_jobs WHERE id=p_job FOR UPDATE;
    IF j.id IS NULL OR j.revision<>p_revision OR j.state IN ('published','rejected') THEN RAISE EXCEPTION 'INSIGHT_STALE_REVISION'; END IF;
    IF p_lease IS NOT NULL AND (j.lease IS DISTINCT FROM p_lease OR j.lease_until<now()) THEN RAISE EXCEPTION 'INSIGHT_STALE_LEASE'; END IF;
    IF p_lease IS NULL AND j.lease_until > now() THEN RAISE EXCEPTION 'INSIGHT_JOB_BUSY'; END IF;
    IF p_state NOT IN ('queued','review','link_pending','failed') THEN RAISE EXCEPTION 'INSIGHT_INVALID_STATE'; END IF;
    IF p_verified AND (p_checks->>'passed') IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'INSIGHT_NOT_VERIFIED'; END IF;
    category := (p_article->>'categoryId')::uuid;
    SELECT insight_candidates.paper INTO paper FROM insight_candidates WHERE id=j.candidate_id;
    new_revision := j.revision+1;
    PERFORM set_config('eatple.insight_write',p_job::text,true);
    IF j.post_id IS NULL THEN
      INSERT INTO nutrition_posts(title,summary,content,category_id,source_type,source_url,source_name,
          is_draft,is_active,is_manual_post,trust_score,thumbnail_url,admin_name)
      VALUES(p_article->>'title',p_article->>'summary',p_content,category,'paper',paper->>'url',paper->>'journal',
          true,true,false,0,'/images/nutrition/research-default.svg','잇플 편집팀') RETURNING id INTO j.post_id;
    ELSE
      UPDATE nutrition_posts SET title=p_article->>'title',summary=p_article->>'summary',content=p_content,
        category_id=category,is_draft=true,updated_at=now() WHERE id=j.post_id;
    END IF;
    DELETE FROM post_related_products WHERE post_id=j.post_id;
    INSERT INTO post_related_products(post_id,product_name,product_link,display_order,delivery_type)
      SELECT j.post_id, item->>'name',item->>'link',ordinality::integer,item->>'delivery'
      FROM jsonb_array_elements(p_products) WITH ORDINALITY AS t(item,ordinality);
    DELETE FROM post_tags WHERE post_id=j.post_id;
    INSERT INTO tags(name) SELECT DISTINCT value FROM jsonb_array_elements_text(p_article->'tags') ON CONFLICT(name) DO NOTHING;
    INSERT INTO post_tags(post_id,tag_id) SELECT j.post_id,t.id FROM tags t
      WHERE t.name IN (SELECT value FROM jsonb_array_elements_text(p_article->'tags')) ON CONFLICT DO NOTHING;
    UPDATE insight_jobs SET article=p_article,evidence=p_evidence,checks=p_checks,products=p_products,post_id=j.post_id,
      revision=new_revision,verified_revision=CASE WHEN p_verified THEN new_revision ELSE NULL END,
      state=p_state,stage=CASE WHEN p_verified THEN 'done' ELSE 'verify' END,links_complete=p_links_complete,
      lease=NULL,lease_until=NULL,attempts=0,last_error=NULL,updated_at=now() WHERE id=p_job RETURNING * INTO j;
    RETURN j;
END $$;

CREATE OR REPLACE FUNCTION public.insight_save_draft_v2(p_job uuid, p_revision integer, p_lease uuid,
    p_article jsonb, p_evidence jsonb, p_checks jsonb, p_products jsonb,
    p_content text, p_state text, p_verified boolean, p_links_complete boolean, p_media jsonb)
RETURNS public.insight_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE j insight_jobs;
BEGIN
    j := insight_save_draft(p_job,p_revision,p_lease,p_article,p_evidence,p_checks,p_products,p_content,p_state,p_verified,p_links_complete);
    UPDATE insight_jobs SET media=p_media WHERE id=p_job RETURNING * INTO j;
    UPDATE nutrition_posts SET thumbnail_url=p_media->'thumbnail'->>'url',image_url=p_media->'thumbnail'->>'url',thumbnail_alt=p_media->'thumbnail'->>'alt' WHERE id=j.post_id;
    RETURN j;
END $$;

CREATE OR REPLACE FUNCTION public.insight_publish(p_job uuid, p_revision integer, p_reviewer text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE j insight_jobs;
BEGIN
    SELECT * INTO j FROM insight_jobs WHERE id=p_job FOR UPDATE;
    IF j.state='published' AND j.revision=p_revision THEN RETURN j.post_id; END IF;
    IF j.state IS DISTINCT FROM 'review' OR j.revision<>p_revision OR j.verified_revision IS DISTINCT FROM j.revision
        OR NOT j.links_complete OR nullif(j.media->'thumbnail'->>'url','') IS NULL
        OR (j.checks->>'passed') IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'INSIGHT_NOT_VERIFIED'; END IF;
    PERFORM set_config('eatple.insight_write',p_job::text,true);
    UPDATE nutrition_posts SET is_draft=false,published_date=now(),updated_at=now() WHERE id=j.post_id;
    UPDATE insight_jobs SET state='published',reviewed_by=p_reviewer,reviewed_at=now(),updated_at=now() WHERE id=p_job;
    INSERT INTO post_modification_history(post_id,admin_name,changes) VALUES(j.post_id,p_reviewer,'Insight revision '||j.revision||' approved and published');
    RETURN j.post_id;
END $$;

-- Protect automated drafts from the old manual-posting and bulk-action routes.
-- Counters and is_active remain editable; article/product edits must use the revision-aware route.
CREATE OR REPLACE FUNCTION public.insight_guard_post()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE job uuid;
BEGIN
    SELECT id INTO job FROM insight_jobs WHERE post_id=OLD.id;
    IF job IS NULL THEN RETURN NEW; END IF;
    IF current_setting('eatple.insight_write',true) IS DISTINCT FROM job::text AND
       ROW(NEW.title,NEW.summary,NEW.content,NEW.is_draft,NEW.category_id,NEW.source_url,NEW.source_type,NEW.published_date,NEW.thumbnail_url,NEW.image_url,NEW.thumbnail_alt)
       IS DISTINCT FROM ROW(OLD.title,OLD.summary,OLD.content,OLD.is_draft,OLD.category_id,OLD.source_url,OLD.source_type,OLD.published_date,OLD.thumbnail_url,OLD.image_url,OLD.thumbnail_alt)
       THEN RAISE EXCEPTION '자동 생성 글은 인사이트 자동화 화면에서 수정·게시해주세요.'; END IF;
    RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS insight_guard_post_trigger ON nutrition_posts;
CREATE TRIGGER insight_guard_post_trigger BEFORE UPDATE ON nutrition_posts FOR EACH ROW EXECUTE FUNCTION insight_guard_post();
CREATE OR REPLACE FUNCTION public.insight_guard_product()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE job uuid; target uuid;
BEGIN
    target := CASE WHEN TG_OP='DELETE' THEN OLD.post_id ELSE NEW.post_id END;
    SELECT id INTO job FROM insight_jobs WHERE post_id=target;
    IF job IS NOT NULL AND current_setting('eatple.insight_write',true) IS DISTINCT FROM job::text
      THEN RAISE EXCEPTION '자동 생성 글의 상품은 인사이트 자동화 화면에서 수정해주세요.'; END IF;
    IF TG_OP='UPDATE' AND OLD.post_id IS DISTINCT FROM NEW.post_id THEN
      SELECT id INTO job FROM insight_jobs WHERE post_id=OLD.post_id;
      IF job IS NOT NULL AND current_setting('eatple.insight_write',true) IS DISTINCT FROM job::text
        THEN RAISE EXCEPTION '자동 생성 글의 상품은 인사이트 자동화 화면에서 수정해주세요.'; END IF;
    END IF;
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS insight_guard_product_trigger ON post_related_products;
CREATE TRIGGER insight_guard_product_trigger BEFORE INSERT OR UPDATE OR DELETE ON post_related_products FOR EACH ROW EXECUTE FUNCTION insight_guard_product();

-- SECURITY DEFINER functions must never inherit Postgres' default PUBLIC execute grant.
DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
      WHERE n.nspname='public' AND p.proname LIKE 'insight_%'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',f.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
  END LOOP;
END $$;

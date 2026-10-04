const { generateText, isOpenAIConfigured } = require('./openaiClient');
const researchDefault = require('./insightResearch');
const c = require('./insightContracts');
const { WRITE_SEO, assessSeo } = require('./insightSeo');
const { LIMITATIONS_HEADING, WRITE_STYLE, REVIEW_STYLE } = require('./insightEditorial');
const { createCover, IMAGE_MODEL } = require('./insightImages');
const MODEL = 'gpt-6-luna';
const error = (message, status = 409) => Object.assign(new Error(message), { status });
const kstDate = now => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
const kstHour = now => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', hourCycle: 'h23' }).format(now));

class InsightService {
    constructor(db, { research = researchDefault, ai = generateText, images = createCover, now = () => new Date() } = {}) {
        this.db = db; this.research = research; this.ai = ai; this.images = images; this.now = now;
    }
    async result(query) {
        const { data, error: dbError } = await query;
        if (dbError) {
            if (['42P01','PGRST205','PGRST202'].includes(dbError.code)) throw error('인사이트 DB 마이그레이션 016을 먼저 적용해주세요.', 503);
            if (/INSIGHT_/.test(dbError.message)) throw error(dbError.message.match(/INSIGHT_[A-Z_]+/)[0]);
            throw error('인사이트 데이터 처리에 실패했습니다.', 503);
        }
        return data;
    }
    rpc(name, args) { return this.result(this.db.rpc(name, args)); }
    settings() { return this.result(this.db.from('insight_settings').select('*').eq('id', true).single()); }
    categories() { return this.result(this.db.from('categories').select('id,name,description')); }
    async job(id) {
        const job = await this.result(this.db.from('insight_jobs').select('*,candidate:insight_candidates(*)').eq('id', id).single());
        return { ...job, seoReport: job.article ? assessSeo(job.article,job.media,job.candidate.paper) : null };
    }
    async patchJob(job, patch) {
        let query = this.db.from('insight_jobs').update({ ...patch, updated_at: this.now().toISOString() }).eq('id', job.id).eq('revision', job.revision);
        if (job.lease) query = query.eq('lease', job.lease);
        const result = await this.result(query.select().maybeSingle());
        if (!result) throw error('INSIGHT_STALE_REVISION');
        return result;
    }
    async status() {
        const settings = await this.settings();
        const [jobs, candidates, usage] = await Promise.all([
            this.result(this.db.from('insight_jobs').select('id,state,stage,revision,verified_revision,post_id,last_error,created_at,article,products,links_complete').order('created_at', { ascending: false }).limit(40)),
            this.result(this.db.from('insight_candidates').select('id,paper_key,status,selection_reason,paper,created_at').order('created_at', { ascending: false }).limit(50)),
            this.result(this.db.from('insight_usage').select('cost_krw,reserved_krw,status,input_tokens,output_tokens').gte('created_at', `${kstDate(this.now()).slice(0,7)}-01T00:00:00+09:00`)),
        ]);
        const { agent_token_hash, collection_lease, collection_lease_until, ...publicSettings } = settings;
        return { settings: { ...publicSettings, paired: Boolean(agent_token_hash) }, jobs,
            candidates: candidates.map(x => ({ ...x, paper: { ...x.paper, fullText: undefined } })),
            usage: { estimatedKrw: usage.reduce((sum, x) => sum + Number(x.cost_krw ?? x.reserved_krw), 0),
                calls: usage.length, uncertainCalls: usage.filter(x => x.status === 'reserved' || x.status === 'uncertain').length }, model: MODEL };
    }
    async configure(input) {
        const patch = {};
        if (typeof input.enabled === 'boolean') patch.enabled = input.enabled;
        for (const [key, min, max] of [['monthly_ai_budget_krw',0,100000],['input_krw_per_million',1,100000],['output_krw_per_million',1,100000]]) {
            if (Object.hasOwn(input,key)) {
                if (!Number.isFinite(input[key]) || input[key] < min || input[key] > max) throw error('예산·단가 범위를 확인해주세요.', 400);
                patch[key] = input[key];
            }
        }
        await this.result(this.db.from('insight_settings').update(patch).eq('id', true));
    }
    async aiJson(job, stage, schema, payload, instructions = '') {
        if (this.ai === generateText && !isOpenAIConfigured()) throw error('OPENAI_API_KEY를 설정해주세요.', 503);
        const settings = await this.settings();
        const prompt = JSON.stringify(payload);
        const maxOutputTokens = stage === 'write' ? 12000 : 7000;
        // UTF-8 byte count conservatively bounds text tokens; include schema/instruction overhead.
        const inputBound = Buffer.byteLength(prompt + c.INSTRUCTIONS + instructions + JSON.stringify(schema)) + 3000;
        if (inputBound > 260000) throw error('분석 입력이 너무 큽니다.', 422);
        const reservation = (inputBound * Number(settings.input_krw_per_million) + maxOutputTokens * Number(settings.output_krw_per_million)) / 1e6;
        const usageId = await this.rpc('insight_reserve_cost', { p_job: job?.id || null, p_stage: stage, p_amount: reservation });
        let response;
        try {
            response = await this.ai(prompt, { model: MODEL, includeUsage: true, timeout: 180000,
                maxOutputTokens, schema, schemaName: `insight_${stage}`, instructions: `${c.INSTRUCTIONS}\n${instructions}` });
        } catch (failure) {
            // A timeout may already have consumed tokens. Keep the reservation rather than pretending cost was zero.
            await this.result(this.db.from('insight_usage').update({ status: 'uncertain' }).eq('id', usageId));
            throw failure;
        }
        const u = response.usage;
        const cost = u && Number.isFinite(u.input_tokens) && Number.isFinite(u.output_tokens)
            ? (u.input_tokens * Number(settings.input_krw_per_million) + u.output_tokens * Number(settings.output_krw_per_million)) / 1e6 : reservation;
        await this.result(this.db.from('insight_usage').update({ status: u ? 'completed' : 'estimated', cost_krw: cost,
            input_tokens: u?.input_tokens || null, output_tokens: u?.output_tokens || null, finished_at: this.now().toISOString() }).eq('id', usageId));
        let value;
        try { value = JSON.parse(response.text); } catch { throw error('AI 구조화 응답을 읽을 수 없습니다.', 422); }
        return c.validateShape(value, schema);
    }
    async collect({ force = false } = {}) {
        const today = kstDate(this.now());
        const settings = await this.settings();
        if (!force && (!settings.enabled || settings.last_collection_date === today || kstHour(this.now()) < 7)) return;
        const existing = await this.result(this.db.from('insight_jobs').select('id').eq('run_date', today).maybeSingle());
        if (existing) return existing.id;
        const backlog = await this.result(this.db.from('insight_jobs').select('id').not('state','in','(published,rejected)'));
        if (backlog.length >= 7) throw error('검수 대기 글이 7편입니다. 먼저 검수해주세요.');
        const collectionLease=await this.rpc('insight_start_collection',{ p_date:today,p_force:force });
        if (!collectionLease) return null;
        try {
        const papers = await this.research.searchPapers({ now: this.now() });
        if (papers.length) await this.result(this.db.from('insight_candidates').upsert(papers.map(p => ({ paper_key: p.key, paper: p })), { onConflict: 'paper_key', ignoreDuplicates: true }));
        const candidates = await this.result(this.db.from('insight_candidates').select('*').eq('status','candidate').order('created_at',{ ascending:false }).limit(50));
        const rank = p => (/systematic|meta.analysis/i.test(p.title + ' ' + p.articleTypes.join(' ')) ? 10 : /random/i.test(p.title + ' ' + p.articleTypes.join(' ')) ? 8 : 2) +
            (/Nutrition Reviews|British Journal of Nutrition/i.test(p.journal) ? 2 : 0);
        const available = [];
        for (const candidate of candidates.sort((a,b) => rank(b.paper)-rank(a.paper)).slice(0,10)) {
            if (available.length >= 3) break;
            try {
                const state = await this.research.integrity(candidate.paper.doi);
                if (state.blocked || !state.checked) throw error(state.issues.join(' '));
                const fullText = await this.research.fetchFullText(candidate.paper);
                available.push({ ...candidate, fullText, integrity: state });
            } catch (failure) {
                await this.result(this.db.from('insight_candidates').update({ status: 'excluded', selection_reason: failure.message }).eq('id',candidate.id));
            }
        }
        await this.result(this.db.from('insight_settings').update({ last_collection_date: today, last_collection_error: null }).eq('id',true));
        if (!available.length) return null;
        const chosen = await this.aiJson(null,'select',c.selectionSchema,{ candidates: available.map(x => ({ id:x.id, paper:x.paper })) },
            'Choose one useful, peer-reviewed nutrition topic for Korean general adults based on study design, novelty, and practical relevance. Do not rank by product sales. Return empty selectedId when none is suitable.');
        if (!chosen.selectedId) return null;
        const candidate = available.find(x => x.id === chosen.selectedId);
        if (!candidate) throw error('선정 결과가 실제 후보와 일치하지 않습니다.',422);
        const id = await this.rpc('insight_enqueue_daily',{ p_date:today,p_candidate:candidate.id });
        if (id) {
            await this.result(this.db.from('insight_candidates').update({ selection_reason:chosen.reason }).eq('id',candidate.id));
            // Only store source material when the daily job was actually created for this candidate.
            await this.result(this.db.from('insight_jobs').update({ full_text:candidate.fullText,integrity:candidate.integrity })
                .eq('id',id).eq('candidate_id',candidate.id).eq('stage','extract').is('full_text',null));
        }
        return id;
        } finally {
            await this.result(this.db.from('insight_settings').update({ collection_lease:null,collection_lease_until:null }).eq('id',true).eq('collection_lease',collectionLease));
        }
    }
    async generated(job,stage,schema,payload,instructions,validate) {
        let previousResult,feedback;
        for(let attempt=0;attempt<2;attempt++) {
            const value=await this.aiJson(job,stage,schema,attempt ? {...payload,previousResult,correctionRequired:feedback} : payload,
                instructions+(attempt ? '\nCorrect the validation error using the supplied source. Do not repeat a quote with omitted words, ellipses or edited punctuation. Return the full corrected object.' : ''));
            try {return validate(value);} catch(failure) {
                if(attempt || failure.status!==422)throw failure;
                previousResult=value;feedback=failure.message;
            }
        }
    }
    async saveDraft(job, { article = job.article, evidence = job.evidence, checks = job.checks,
        products = job.products, media = job.media || {thumbnail:null,images:[]}, state = 'review', verified = false } = {}) {
        const categories = await this.categories();
        c.validateEvidence(evidence, job.full_text.text);
        c.validateArticle(article,evidence,categories);
        products = c.validateProducts(products);
        media = c.validateMedia(media,article.sections.length);
        const seo = assessSeo(article,media,job.candidate.paper);
        if (verified && (!media.thumbnail || seo.score < 80)) {
            verified = false; state = 'failed';
            checks = { ...checks,passed:false,issues:[...checks.issues,...(!media.thumbnail ? ['대표 이미지가 필요합니다.'] : []),...(seo.score < 80 ? ['SEO 내부 점검 80점 이상이 필요합니다: '+seo.checks.filter(c=>!c.passed).map(c=>c.label).join(', ')] : [])] };
        }
        return this.rpc('insight_save_draft_v2',{ p_job:job.id,p_revision:job.revision,p_lease:job.lease || null,
            p_article:article,p_evidence:evidence,p_checks:checks || {},p_products:products,
            p_media:media,p_content:c.renderArticle(article,job.candidate.paper,evidence,media),p_state:state,p_verified:verified,p_links_complete:true });
    }
    async cover(job) {
        const usageId = await this.rpc('insight_reserve_cost',{p_job:job.id,p_stage:'image',p_amount:200});
        await this.result(this.db.from('insight_usage').update({model:IMAGE_MODEL}).eq('id',usageId));
        try {
            const media = await this.images(job.article,this.db);
            // A conservative reservation is retained when detailed billing isn't available.
            const usage=media.usage;
            const cost=usage?.input_tokens_details && Number.isFinite(usage.output_tokens)
                ? (Number(usage.input_tokens_details.text_tokens || 0)*5 + Number(usage.input_tokens_details.image_tokens || 0)*8 + usage.output_tokens*30)*1500/1e6 : 200;
            await this.result(this.db.from('insight_usage').update({status:usage ? 'completed' : 'estimated',cost_krw:cost,input_tokens:usage?.input_tokens || null,output_tokens:usage?.output_tokens || null,finished_at:this.now().toISOString()}).eq('id',usageId));
            delete media.usage;
            return c.validateMedia(media,job.article.sections.length,true);
        } catch(failure) {
            await this.result(this.db.from('insight_usage').update({status:'uncertain'}).eq('id',usageId));
            throw failure;
        }
    }
    async processNext() {
        const claimed = await this.rpc('insight_claim',{ p_kind:'pipeline' });
        if (!claimed?.length) return false;
        let job = { ...claimed[0], candidate:(await this.job(claimed[0].id)).candidate };
        try {
            if (!job.full_text) {
                const fullText = await this.research.fetchFullText(job.candidate.paper);
                job = { ...job, ...await this.patchJob(job,{ full_text:fullText }) };
            }
            if (job.stage === 'extract') {
                const state = await this.research.integrity(job.candidate.paper.doi);
                if (!state.checked || state.blocked) throw error('원문 정정·철회 상태를 확인해주세요.',422);
                const evidence = await this.generated(job,'extract',c.evidenceSchema,
                    { paper:job.candidate.paper,fullText:job.full_text.text },
                    'Extract 3-8 factual claims. Each quote must be an exact, short verbatim substring of the full text with its section, with no omissions or changed punctuation. Unknown values must say 확인 불가.',value=>c.validateEvidence(value,job.full_text.text));
                job = { ...job, ...await this.patchJob(job,{ evidence,integrity:state,stage:'write' }) };
            }
            if (job.stage === 'write') {
                const categories = await this.categories();
                const article = await this.generated(job,'write',c.articleSchema,
                    { paper:job.candidate.paper,evidence:job.evidence,categories },
                    'Create a Korean article with 1500-2500 characters in the combined paragraphs (exclude title/headings). Include reader question, study results, population and an evidence-grounded Korean diet interpretation. Do not recommend products, brands, purchases, supplement doses or affiliate links. Use only provided category IDs and evidence claim IDs. '+WRITE_STYLE+' '+WRITE_SEO,value=>c.validateArticle(value,job.evidence,categories));
                job = { ...job, ...await this.patchJob(job,{ article,stage:'verify' }) };
            }
            if (!job.article.seo || !job.article.sections.some(s => s.heading.trim() === LIMITATIONS_HEADING)) {
                const {productQueries,...oldArticle}=job.article;
                const categories=await this.categories();
                const article=await this.generated(job,'write',c.articleSchema,{paper:job.candidate.paper,evidence:job.evidence,categories,previousDraft:oldArticle},WRITE_STYLE+' '+WRITE_SEO+' Rewrite the complete article with 1500-2500 characters in the combined paragraphs. Preserve evidence and correct unsupported assertions.',value=>c.validateArticle(value,job.evidence,categories));
                job={...job,...await this.patchJob(job,{article})};
            }
            if (!job.media?.thumbnail) {
                const media=await this.cover(job);
                job={...job,...await this.patchJob(job,{media})};
            }
            const checks = c.validateReview(await this.aiJson(job,'verify',c.validationSchema,
                { article:job.article,evidence:job.evidence,fullText:job.full_text.text,media:job.media,products:job.products },
                'Independently check EVERY claim, number, dose, unit, causal inference, human applicability, and all practical recommendations against the supplied full text. Health or efficacy claims anywhere (including title/summary and image captions/product reasons) need support. Check that the keyword and search intent match the evidence, without keyword stuffing or clickbait. Fail unsupported assertions, missing limitations, or treatment advice. issues must contain ONLY actual defects requiring correction, not findings that match the paper. Claim IDs link factual sections, not each individual sentence; fullText can support statements beyond quoted claims. Do not demand an ID for every sentence. Return all reviewed claim IDs. Warnings are nonblocking topics needing human care, including supplements, pregnancy, diseases, medications. Image pixels require human review; do not claim you verified their visual content. '+REVIEW_STYLE),job.evidence);
            await this.saveDraft(job,{ checks,state:checks.passed ? 'review' : 'failed',verified:checks.passed });
            return true;
        } catch (failure) {
            await this.patchJob(job,{ state:'failed',last_error:[failure.code,failure.message].filter(Boolean).join(': ').slice(0,1000),lease:null,lease_until:null });
            return false;
        }
    }
    async edit(id, revision, article, products, media) {
        const job = await this.job(id);
        if (job.revision !== revision) throw error('다른 작업에서 글이 변경되었습니다. 새로고침해주세요.');
        c.validateShape(article,c.articleSchema);
        if (!job.article) throw error('초안 생성 후 수정할 수 있습니다.');
        return this.saveDraft(job,{ article,products:products ?? job.products,media:media ?? job.media,checks:{ passed:false,issues:[],warnings:[],checkedClaimIds:[] },
            state:'queued',verified:false,linksComplete:true });
    }
    async retry(id, revision) {
        const job = await this.job(id);
        if (job.revision !== revision || !['failed','processing','link_pending','link_processing'].includes(job.state)) throw error('재시도할 수 없는 상태입니다.');
        if (job.lease_until && new Date(job.lease_until) > this.now()) throw error('진행 중인 작업입니다.');
        return this.patchJob(job,{ state:'queued',stage:job.stage==='done' ? 'verify' : job.stage,attempts:0,last_error:null,lease:null,lease_until:null });
    }
    async reject(id, revision) {
        const job = await this.job(id);
        if (job.revision !== revision || ['processing','link_processing','published'].includes(job.state)) throw error('반려할 수 없는 상태입니다.');
        return this.patchJob(job,{ state:'rejected',lease:null,lease_until:null });
    }
    async approve(id, revision, reviewer) {
        const job = await this.job(id);
        if (job.revision !== revision) throw error('INSIGHT_STALE_REVISION');
        const state = await this.research.integrity(job.candidate.paper.doi);
        if (!state.checked || state.blocked) throw error('게시 전 정정·철회 확인을 통과하지 못했습니다.',422);
        c.validateReview(job.checks,job.evidence);
        c.validateArticle(job.article,job.evidence,await this.categories());
        c.validateProducts(job.products);
        c.validateMedia(job.media,job.article.sections.length,true);
        if (assessSeo(job.article,job.media,job.candidate.paper).score < 80) throw error('SEO 점검 결과를 보완해주세요.',422);
        return this.rpc('insight_publish',{ p_job:id,p_revision:revision,p_reviewer:reviewer });
    }
    async run() {
        if (!(await this.settings()).enabled) return { disabled:true };
        try { await this.collect(); }
        catch (failure) { await this.result(this.db.from('insight_settings').update({ last_collection_error:failure.code || failure.message }).eq('id',true)); }
        return { processed:await this.processNext() };
    }
}
module.exports = { InsightService, MODEL, kstDate, kstHour };

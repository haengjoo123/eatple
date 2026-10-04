const fs=require('fs');
const path=require('path');
const { PGlite }=require('@electric-sql/pglite');
const request=require('supertest');
const express=require('express');
const c=require('../utils/insightContracts');
const { InsightService,kstDate,kstHour }=require('../utils/insightService');
const { createInsightRouters }=require('../routes/insight-automation');
const {insightPage}=require('../routes/insight-page');
const {assessSeo}=require('../utils/insightSeo');
const {normalizePaper}=require('../utils/insightResearch');

jest.setTimeout(30000);
let db,category;
const sourceText='Participants consuming whole grains had a higher measured dietary fiber intake than the comparison group.';
const evidence={design:'관찰연구',population:'성인',sampleSize:'100명',exposure:'통곡물',duration:'1년',results:'식이섬유 섭취 차이',limitations:['인과관계 아님'],funding:'확인 불가',humanStudy:true,
    claims:[{id:'c1',statement:'통곡물 섭취군에서 식이섬유 섭취량이 높았습니다.',quote:sourceText,section:'Results'}]};
const checks={passed:true,issues:[],warnings:['관찰연구'],checkedClaimIds:['c1']};
const media={thumbnail:{url:'https://ovncracjrivndsjjfyoe.supabase.co/storage/v1/object/public/nutrition-images/nutrition-thumbnails/test.webp',alt:'통곡물 식재료 사진'},images:[]};
const products=[{name:'오트밀',originalUrl:'https://www.coupang.com/vp/products/123',link:'https://link.coupang.com/a/example',reason:'통곡물 식재료',delivery:'rocket'}];
const article=()=>({title:'통곡물 연구 읽기',summary:'연구 결과와 한계를 살펴봅니다.',categoryId:category,tags:['식이섬유'],seo:{primaryKeyword:'통곡물',searchIntent:'통곡물 연구 결과와 한계'},
    sections:[{heading:'연구',paragraphs:['통곡물과 식이섬유를 살펴봅니다. '.repeat(45)],claimIds:['c1']},
        {heading:'연구의 한계점',paragraphs:['관찰연구이므로 인과관계를 확정할 수 없습니다. '.repeat(15)],claimIds:[]},
        {heading:'실생활',paragraphs:['제품을 선택할 때 원재료와 알레르기 정보를 확인하세요. '.repeat(15)],claimIds:[]}]});
const q=async(sql,args=[])=>db.query(sql,args);
const one=async(sql,args=[])=> (await q(sql,args)).rows[0];
async function job(date='2026-10-04'){
    const candidate=await one("insert into insight_candidates(paper_key,paper) values($1,$2) returning id",['doi:'+date,{title:'Paper',journal:'Journal',doi:'10.1/paper',url:'https://doi.org/10.1/paper',publishedDate:date}]);
    const queued=await one('select insight_enqueue_daily($1,$2) as id',[date,candidate.id]);
    await q('update insight_jobs set full_text=$1 where id=$2',[{text:sourceText},queued.id]);
    return (await one('select * from insight_jobs where id=$1',[queued.id]));
}
async function save(j,verified=true,state='review'){
    return (await one('select to_jsonb(insight_save_draft_v2($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)) as job',[
        j.id,j.revision,j.lease || null,article(),evidence,verified?checks:{passed:false},products,
        '<p>safe generated content</p>',state,verified,true,media])).job;
}
beforeAll(async()=>{
    const dist=path.dirname(require.resolve('@electric-sql/pglite'));
    db=new PGlite({fsBundle:new Blob([fs.readFileSync(path.join(dist,'pglite.data'))]),
        pgliteWasmModule:await WebAssembly.compile(fs.readFileSync(path.join(dist,'pglite.wasm'))),
        initdbWasmModule:await WebAssembly.compile(fs.readFileSync(path.join(dist,'initdb.wasm')))});
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
    for(const name of ['001_create_nutrition_tables_fixed.sql','007_add_thumbnail_url_to_nutrition_posts.sql','008_create_post_related_products_table.sql','016_insight_automation.sql'])
        await db.exec(fs.readFileSync(path.join(__dirname,'../migrations',name),'utf8'));
    category=(await one('select id from categories limit 1')).id;
});
beforeEach(async()=>{
    await db.exec('TRUNCATE insight_usage,insight_jobs,insight_candidates,insight_products CASCADE; UPDATE insight_settings SET monthly_ai_budget_krw=60000,collection_lease=NULL,collection_lease_until=NULL,last_collection_date=NULL;');
});
afterAll(async()=>db?.close());

test('migration can be reapplied without losing jobs',async()=>{
    const j=await job();
    await db.exec(fs.readFileSync(path.join(__dirname,'../migrations/016_insight_automation.sql'),'utf8'));
    expect((await one('select id from insight_jobs')).id).toBe(j.id);
});
test('draft is private, publish is idempotent, manual bypass is rejected',async()=>{
    const j=await save(await job());
    expect((await one('select is_draft from nutrition_posts where id=$1',[j.post_id])).is_draft).toBe(true);
    await expect(q('update nutrition_posts set is_draft=false where id=$1',[j.post_id])).rejects.toThrow('인사이트 자동화');
    const first=await one("select insight_publish($1,$2,'admin') as id",[j.id,j.revision]);
    const second=await one("select insight_publish($1,$2,'admin') as id",[j.id,j.revision]);
    expect(first.id).toBe(second.id);
    expect((await one('select is_draft from nutrition_posts where id=$1',[j.post_id])).is_draft).toBe(false);
});

test('draft content, products and tags stay private despite older permissive policies',async()=>{
    const j=await save(await job());
    await db.exec('GRANT SELECT ON nutrition_posts,post_related_products,post_tags TO anon; CREATE POLICY legacy_public_read ON nutrition_posts FOR SELECT TO anon USING(true);');
    try {
        await db.exec('SET ROLE anon;');
        expect((await q('select id from nutrition_posts where id=$1',[j.post_id])).rows).toHaveLength(0);
        expect((await q('select id from post_related_products where post_id=$1',[j.post_id])).rows).toHaveLength(0);
        expect((await q('select post_id from post_tags where post_id=$1',[j.post_id])).rows).toHaveLength(0);
        await db.exec('RESET ROLE;');
        await q("select insight_publish($1,$2,'admin')",[j.id,j.revision]);
        await db.exec('SET ROLE anon;');
        expect((await q('select id from nutrition_posts where id=$1',[j.post_id])).rows).toHaveLength(1);
        expect((await q('select id from post_related_products where post_id=$1',[j.post_id])).rows).toHaveLength(1);
    } finally {await db.exec('RESET ROLE; DROP POLICY legacy_public_read ON nutrition_posts;');}
});
test('editing invalidates verification; stale approval and unverified publication fail',async()=>{
    const j=await save(await job());
    const edited=await save(j,false,'queued');
    expect(edited.verified_revision).toBeNull();
    await expect(q("select insight_publish($1,$2,'admin')",[j.id,j.revision])).rejects.toThrow('INSIGHT_NOT_VERIFIED');
    await expect(q("select insight_publish($1,$2,'admin')",[j.id,edited.revision])).rejects.toThrow('INSIGHT_NOT_VERIFIED');
    expect((await one('select is_draft from nutrition_posts where id=$1',[j.post_id])).is_draft).toBe(true);
});

test('verification alone cannot publish before the product step finishes',async()=>{
    const j=await save(await job());
    await q('update insight_jobs set links_complete=false where id=$1',[j.id]);
    await expect(q("select insight_publish($1,$2,'admin')",[j.id,j.revision])).rejects.toThrow('INSIGHT_NOT_VERIFIED');
});
test('two claimers cannot receive the same leased job',async()=>{
    await job();
    expect((await q("select * from insight_claim('pipeline')")).rows).toHaveLength(1);
    expect((await q("select * from insight_claim('pipeline')")).rows).toHaveLength(0);
});
test('expired claims can resume; stale lease cannot write a draft',async()=>{
    await job();
    const old=(await q("select * from insight_claim('pipeline')")).rows[0];
    await q("update insight_jobs set lease_until=now()-interval '1 minute' where id=$1",[old.id]);
    const fresh=(await q("select * from insight_claim('pipeline')")).rows[0];
    expect(fresh.lease).not.toBe(old.lease);
    await expect(save(old)).rejects.toThrow('INSIGHT_STALE_LEASE');
});
test('the same KST date produces at most one job and collection lease',async()=>{
    const first=await one('select insight_start_collection($1,false) as token',['2026-10-04']);
    const second=await one('select insight_start_collection($1,true) as token',['2026-10-04']);
    expect(first.token).toBeTruthy();expect(second.token).toBeNull();
    const j=await job();
    expect((await one('select insight_enqueue_daily($1,$2) as id',['2026-10-04',j.candidate_id])).id).toBe(j.id);
});
test('outstanding and uncertain AI calls count against the monthly cap',async()=>{
    await q('update insight_settings set monthly_ai_budget_krw=10');
    const reserved=await one("select insight_reserve_cost(NULL,'extract',8) as id");
    await q("update insight_usage set status='uncertain' where id=$1",[reserved.id]);
    await expect(q("select insight_reserve_cost(NULL,'verify',3)")).rejects.toThrow('INSIGHT_BUDGET_EXCEEDED');
});
test('product changes via legacy routes are blocked and publication errors roll back',async()=>{
    const j=await save(await job());
    await expect(q('delete from post_related_products where post_id=$1',[j.post_id])).rejects.toThrow('인사이트 자동화');
    const ordinary=await one("insert into nutrition_posts(title,summary,content,source_type) values('manual','manual','manual','manual') returning id");
    await expect(q('update post_related_products set post_id=$1 where post_id=$2',[ordinary.id,j.post_id])).rejects.toThrow('인사이트 자동화');
    const invalid={...article(),categoryId:'00000000-0000-0000-0000-000000000001'};
    await expect(q('select insight_save_draft($1,$2,NULL,$3,$4,$5,$6,$7,$8,true,true)',[j.id,j.revision,invalid,evidence,checks,products,'new text','review'])).rejects.toThrow();
    expect((await one('select revision from insight_jobs where id=$1',[j.id])).revision).toBe(j.revision);
    expect((await one('select content from nutrition_posts where id=$1',[j.post_id])).content).toBe('<p>safe generated content</p>');
});
test('internal tables use RLS and privileged functions are not callable by public users',async()=>{
    const rows=(await q("select relname,relrowsecurity from pg_class where relname in ('insight_jobs','insight_settings','insight_usage')")).rows;
    expect(rows.every(r=>r.relrowsecurity)).toBe(true);
    expect((await one("select has_function_privilege('anon','insight_publish(uuid,integer,text)','execute') as allowed")).allowed).toBe(false);
    expect((await one("select has_table_privilege('authenticated','insight_jobs','select') as allowed")).allowed).toBe(false);
});
test('quotes must exist verbatim and article references must resolve',()=>{
    expect(()=>c.validateEvidence({...evidence,claims:[{...evidence.claims[0],quote:'this quote does not exist in the paper'}]},sourceText)).toThrow('인용');
    expect(()=>c.validateArticle({...article(),categoryId:'wrong'},evidence,[{id:category}])).toThrow('카테고리');
    expect(()=>c.validateReview({...checks,checkedClaimIds:[]},evidence)).toThrow('검증');
    expect(()=>c.validateArticle({...article(),sections:article().sections.map(s=>({...s,claimIds:['unknown']}))},evidence,[{id:category}])).toThrow();
});

test('article needs one nonempty dedicated limitations section',()=>{
    expect(()=>c.validateArticle(article(),evidence,[{id:category}])).not.toThrow();
    const missing=article();missing.sections[1].heading='추가 설명';
    expect(()=>c.validateArticle(missing,evidence,[{id:category}])).toThrow('한계점');
    const duplicate=article();duplicate.sections[2].heading='연구의 한계점';
    expect(()=>c.validateArticle(duplicate,evidence,[{id:category}])).toThrow('한계점');
    const empty=article();empty.sections[1].paragraphs=[' '];
    empty.sections[0].paragraphs.push('연구 결과를 쉽게 설명합니다. '.repeat(30));
    expect(()=>c.validateArticle(empty,evidence,[{id:category}])).toThrow();
});
test('focused articles require verification of all used evidence and reject unknown IDs',()=>{
    const extra={...evidence,claims:[...evidence.claims,{...evidence.claims[0],id:'c2'}]};
    expect(()=>c.validateReview(checks,extra,article())).not.toThrow();
    const usesBoth=article();usesBoth.sections[1].claimIds=['c2'];
    expect(()=>c.validateReview(checks,extra,usesBoth)).toThrow('검증');
    expect(()=>c.validateReview({...checks,checkedClaimIds:['c1','unknown']},extra,article())).toThrow();
});
test('review defects must point to text actually present in the current article',()=>{
    const result={...checks,passed:false,issues:[{quote:'현재 글에 없는 통계 전문 용어',message:'쉬운 말로 설명하세요.'}]};
    expect(()=>c.validateReviewResponse(result,evidence,article())).toThrow('실제로');
    result.issues[0].quote='관찰연구이므로 인과관계를 확정할 수 없습니다.';
    expect(()=>c.validateReviewResponse(result,evidence,article())).toThrow('문단 일부');
    result.issues[0].quote=article().sections[1].paragraphs[0];
    expect(c.validateReviewResponse(result,evidence,article()).issues[0]).toContain(result.issues[0].quote);
});
test('product URLs are restricted and names obey ingredient/exclusion rules',()=>{
    expect(c.safeUrl('https://link.coupang.com.evil.test/a/x','affiliate')).toBeNull();
    expect(()=>c.validateProducts([{...products[0],link:'javascript:alert(1)'}])).toThrow();
    expect(()=>c.validateProducts([products[0],products[0]])).toThrow('중복');

});
test('all AI stages explicitly use Luna and reserve cost before invocation',async()=>{
    const calls=[];
    const ai=jest.fn(async(_,options)=>{calls.push(options);return {text:JSON.stringify(checks),usage:{input_tokens:10,output_tokens:10}};});
    const service=new InsightService({}, {ai});
    service.settings=async()=>({input_krw_per_million:150,output_krw_per_million:750});
    service.rpc=jest.fn(async()=> 'usage');service.result=async()=>null;
    service.db={from:()=>({update:()=>({eq:()=>({})})})};
    await service.aiJson({id:'job'},'verify',c.validationSchema,{evidence});
    expect(calls[0].model).toBe('gpt-6-luna');expect(calls[0].includeUsage).toBe(true);
    expect(service.rpc).toHaveBeenCalledWith('insight_reserve_cost',expect.objectContaining({p_stage:'verify'}));
});
test('KST scheduling handles UTC previous day correctly',()=>{
    expect(kstDate(new Date('2026-10-03T22:00:00Z'))).toBe('2026-10-04');
    expect(kstHour(new Date('2026-10-03T22:00:00Z'))).toBe(7);
});
test('Europe PMC core records retain journal and author provenance',()=>{
    const paper=normalizePaper({id:1,title:'Study',journalInfo:{journal:{title:'Nutrients'}},authorList:{author:[{fullName:'A. Researcher'},{firstName:'B',lastName:'Editor'}]}});
    expect(paper.journal).toBe('Nutrients');expect(paper.authors).toBe('A. Researcher, B Editor');
});

test('invalid source quotes get one bounded correction, never a silent fallback',async()=>{
    const service=new InsightService({});
    service.aiJson=jest.fn().mockResolvedValueOnce({...evidence,claims:[{...evidence.claims[0],quote:'invented quote which is not in this paper'}]}).mockResolvedValueOnce(evidence);
    expect(await service.generated(null,'extract',c.evidenceSchema,{fullText:sourceText},'Extract',value=>c.validateEvidence(value,sourceText))).toEqual(evidence);
    expect(service.aiJson).toHaveBeenCalledTimes(2);
    service.aiJson=jest.fn().mockResolvedValue({...evidence,claims:[{...evidence.claims[0],quote:'still an invented source quote'}]});
    await expect(service.generated(null,'extract',c.evidenceSchema,{fullText:sourceText},'Extract',value=>c.validateEvidence(value,sourceText))).rejects.toThrow('인용');
    expect(service.aiJson).toHaveBeenCalledTimes(2);
});
test('agent token has no access to admin publish or settings endpoints',async()=>{
    const service={};
    const app=express();app.use(express.json());const routers=createInsightRouters(service);
    app.use('/admin',routers.admin);
    expect((await request(app).post('/admin/jobs/00000000-0000-0000-0000-000000000001/approve').set('Authorization','Bearer agent-token').send({revision:1})).status).toBe(403);

});

test('public article HTML excludes drafts and escapes stored text and JSON-LD',async()=>{
    let post={id:'00000000-0000-0000-0000-000000000001',title:'$& <script>alert(1)</script>',summary:'</script><script>bad()</script>',content:'<p>Safe article</p>',published_date:'2026-10-04',updated_at:'2026-10-04'};
    const filters=[];
    const query={select:()=>query,eq:(...v)=>{filters.push(v);return query;},maybeSingle:async()=>({data:post})};
    const app=express();app.get('/article',insightPage({from:()=>query}));
    const response=await request(app).get('/article?id='+post.id);
    expect(response.status).toBe(200);
    expect(filters).toContainEqual(['is_draft',false]);
    expect(filters).toContainEqual(['is_active',true]);
    expect(response.text).toContain('$&amp; &lt;script&gt;');
    expect(response.text).not.toContain('<script>alert(1)</script>');
    expect(response.text).toContain('\\u003c/script');
    post=null;
    expect((await request(app).get('/article?id=00000000-0000-0000-0000-000000000001')).status).toBe(404);
});
test('manual affiliate links need no original URL; images reject unsafe URLs and invalid placement',()=>{
    expect(c.validateProducts([{name:'귀리',link:products[0].link,reason:'식재료',delivery:'unknown'}])[0].originalUrl).toBeNull();
    expect(()=>c.validateMedia({...media,images:[{...media.thumbnail,afterSection:99}]},3)).toThrow('배치');
    expect(()=>c.validateMedia({thumbnail:{...media.thumbnail,url:'https://evil.test/image.png'},images:[]})).toThrow('이미지');
    expect(()=>c.validateMedia({thumbnail:{...media.thumbnail,alt:''},images:[]})).toThrow();
    const safe=c.validateMedia({...media,images:[{...media.thumbnail,caption:'<script>bad()</script>',afterSection:0}]},3);
    const html=c.renderArticle(article(),{url:'https://doi.org/10.1/test',title:'Paper',journal:'Journal'},evidence,safe);
    expect(html).toContain('loading="lazy"');expect(html).not.toContain('<script>bad()');expect(html).toContain('&lt;script&gt;');
});
test('images and links persist; legacy cover edits and publication without a cover fail',async()=>{
    const original=await save(await job());
    const edited=await save(original,false,'queued');
    expect(edited.media.thumbnail.url).toBe(media.thumbnail.url);expect(edited.products[0].link).toBe(products[0].link);
    const post=await one('select thumbnail_url,image_url,thumbnail_alt from nutrition_posts where id=$1',[edited.post_id]);
    expect(post.thumbnail_alt).toBe(media.thumbnail.alt);expect(post.image_url).toBe(media.thumbnail.url);
    await expect(q('update nutrition_posts set thumbnail_url=$1 where id=$2',['https://evil.test/image.jpg',edited.post_id])).rejects.toThrow('인사이트 자동화');
    await q('update insight_jobs set media=$1,state=$2,verified_revision=revision,checks=$3 where id=$4',[{thumbnail:null,images:[]},'review',checks,edited.id]);
    await expect(q("select insight_publish($1,$2,'admin')",[edited.id,edited.revision])).rejects.toThrow('INSIGHT_NOT_VERIFIED');
});
test('SEO checklist rewards natural keyword placement, metadata and images without promising ranking',()=>{
    const a={...article(),title:'통곡물과 식이섬유, 연구에서 확인한 결과와 한계',summary:'통곡물 섭취와 식이섬유에 관한 성인 관찰연구의 결과를 살펴보고 인과관계 해석의 한계와 식품 선택 시 확인할 점을 설명합니다.',sections:article().sections.map((s,index)=>({...s,heading:index===0?'통곡물 연구 결과':s.heading}))};
    expect(assessSeo(a,media,{url:'https://doi.org/10.1/test'}).score).toBe(100);
    const poor=assessSeo({...a,seo:{primaryKeyword:'무관한키워드',searchIntent:''}}, {}, {});
    expect(poor.score).toBeLessThan(80);expect(poor.note).toContain('구글');
});
test('SSR exposes one H1, H2 and safe images before JS while stripping stored executable markup',async()=>{
    const post={id:'00000000-0000-0000-0000-000000000001',title:'통곡물 연구',summary:'통곡물 근거',thumbnail_url:media.thumbnail.url,thumbnail_alt:media.thumbnail.alt,
        content:`<h2>연구 한계</h2><img src="${media.thumbnail.url}" alt="귀리 사진" onerror="bad()"><script>bad()</script><img src="https://evil.test/a.png">`,published_date:'2026-10-04',updated_at:'2026-10-04'};
    const query={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:post})};
    const app=express();app.get('/article',insightPage({from:()=>query}));
    const response=await request(app).get('/article?id='+post.id);
    expect(response.text).toContain('<h2>연구 한계</h2>');expect(response.text).toContain('og:image');
    expect(response.text).not.toContain('onerror="bad()"');expect(response.text).not.toContain('<script>bad()</script>');
    expect(response.text).not.toContain('https://evil.test/a.png');expect(response.text.match(/<h1[\s>]/g)).toHaveLength(1);
});

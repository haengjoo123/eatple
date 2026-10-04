(() => {
    const base='/api/admin/insight-automation';
    const labels={ queued:'검증 대기',processing:'논문 처리 중',link_pending:'쿠팡 작업 대기',link_processing:'쿠팡 검색 중',review:'검수 가능',failed:'확인 필요',rejected:'반려',published:'게시 완료' };
    const $=id=>document.getElementById(id);
    let current=null;
    let categories=[];
    let dirty=false;
    let uploading=0;
    function buttons() {
        if(!current)return;
        $('insightSave').disabled=uploading>0 || !current.article || ['processing','link_processing','published','rejected'].includes(current.state);
        $('insightApprove').disabled=uploading>0 || dirty || !current.media?.thumbnail || !current.seoReport || current.seoReport.score<80 || current.state!=='review' || current.verified_revision!==current.revision;
        $('insightRetry').disabled=!['failed','processing','link_pending','link_processing'].includes(current.state) || Boolean(current.lease_until && new Date(current.lease_until)>new Date());
        $('insightReject').disabled=['processing','link_processing','published','rejected'].includes(current.state);
    }
    const el=(tag,text,cls)=>{ const e=document.createElement(tag); if(text!==undefined)e.textContent=text; if(cls)e.className=cls; return e; };
    async function api(endpoint,method='GET',body) {
        const r=await fetch(base+endpoint,{ method,credentials:'include',cache:'no-store',headers:{ 'Content-Type':'application/json' },...(body?{ body:JSON.stringify(body) }:{} ) });
        const result=await r.json();
        if(!r.ok)throw new Error(result.error || '요청을 처리할 수 없습니다.');
        return result.data;
    }
    async function action(button,fn) {
        button.disabled=true; $('insightMessage').textContent='처리 중…';
        try { await fn(); $('insightMessage').textContent='완료했습니다.'; await load(); }
        catch(error){ $('insightMessage').textContent=error.message; }
        finally { button.disabled=false; buttons(); }
    }
    async function load() {
        try {
            const data=await api('/status');
            $('insightEnabled').checked=data.settings.enabled;
            $('insightBudget').value=data.settings.monthly_ai_budget_krw;
            $('insightInputRate').value=data.settings.input_krw_per_million;
            $('insightOutputRate').value=data.settings.output_krw_per_million;
            $('insightUsage').textContent=`이번 달 AI 추정 비용 ${Math.ceil(data.usage.estimatedKrw).toLocaleString()}원 / ${Number(data.settings.monthly_ai_budget_krw).toLocaleString()}원 · ${data.usage.calls}회 · 모델 ${data.model}`;
            $('insightCollectionError').textContent=data.settings.last_collection_error || '';
            const rows=$('insightJobRows'); rows.replaceChildren();
            for(const job of data.jobs){
                const tr=el('tr');
                tr.append(el('td',job.article?.title || '논문 분석 대기'),el('td',labels[job.state] || job.state),el('td',job.last_error || ''),el('td',new Date(job.created_at).toLocaleDateString('ko-KR')));
                const td=el('td'); const button=el('button','열기','btn'); button.type='button'; button.addEventListener('click',()=>action(button,()=>open(job.id))); td.append(button); tr.append(td); rows.append(tr);
            }
            if(!data.jobs.length){const tr=el('tr');const td=el('td','아직 작업이 없습니다. 소재 수집을 실행해주세요.');td.colSpan=5;tr.append(td);rows.append(tr);}
            const list=$('insightCandidates');list.replaceChildren();
            for(const candidate of data.candidates){const li=el('li');li.append(el('strong',candidate.paper.title),el('p',`${candidate.paper.journal} · ${candidate.status} · ${candidate.selection_reason || '소재 검토 대기'}`));list.append(li);}
        } catch(error){$('insightMessage').textContent=error.message;}
    }
    function field(label,value,tag='input') {
        const wrapper=el('label',undefined,'insight-field');wrapper.append(el('span',label));
        const input=el(tag);input.value=value || '';if(tag==='textarea')input.rows=5;
        wrapper.append(input);return {wrapper,input};
    }
    async function open(id) {
        const job=await api(`/jobs/${id}`);current=job;dirty=false;
        if(!categories.length)categories=await api('/categories');
        $('insightEditor').hidden=false;
        $('insightReviewStatus').textContent=`${labels[job.state]} · 버전 ${job.revision}`;
        $('insightEvidence').replaceChildren();
        $('insightEvidence').append(el('h3',job.candidate.paper.title),el('p',`${job.candidate.paper.journal} · ${job.candidate.paper.publishedDate || ''}`));
        const link=el('a','논문 출처 확인');link.href=job.candidate.paper.url;link.target='_blank';link.rel='noopener noreferrer';$('insightEvidence').append(link);
        if(job.full_text?.license)$('insightEvidence').append(el('p',`원문 이용 조건: ${job.full_text.license}`));
        if(job.evidence){
            for(const [key,label] of [['design','설계'],['population','대상'],['sampleSize','표본 수'],['exposure','섭취 조건'],['duration','기간'],['results','결과'],['funding','연구비']])$('insightEvidence').append(el('p',`${label}: ${job.evidence[key]}`));
            $('insightEvidence').append(el('p','한계: '+job.evidence.limitations.join(' / ')));
            for(const claim of job.evidence.claims){$('insightEvidence').append(el('strong',`${claim.id}: ${claim.statement}`),el('blockquote',`${claim.section}: ${claim.quote}`));}
        }
        $('insightChecks').textContent=[...(job.checks?.issues || []),...(job.checks?.warnings || []),job.last_error || ''].filter(Boolean).join('\n') || '검증 결과를 기다리는 중입니다.';
        const form=$('insightDraftFields');form.replaceChildren();
        buttons();
$('insightPreview').replaceChildren();
        if(!job.article)return;
        const title=field('제목',job.article.title);title.input.id='insightTitle';form.append(title.wrapper);
        const summary=field('요약',job.article.summary,'textarea');summary.input.id='insightSummary';form.append(summary.wrapper);
        const category=field('카테고리','','select');category.input.id='insightCategory';
        categories.forEach(c=>{const option=el('option',c.name);option.value=c.id;category.input.append(option);});category.input.value=job.article.categoryId;form.append(category.wrapper);
        const tags=field('태그 (쉼표로 구분)',job.article.tags.join(', '));tags.input.id='insightTags';form.append(tags.wrapper);
        const keyword=field('SEO 주제 키워드',job.article.seo?.primaryKeyword);keyword.input.id='insightKeyword';form.append(keyword.wrapper);
        const intent=field('독자가 검색하는 질문·의도',job.article.seo?.searchIntent);intent.input.id='insightIntent';form.append(intent.wrapper);
        job.article.sections.forEach((section,index)=>{
            const box=el('div',undefined,'insight-section-editor');
            const heading=field(`소제목 ${index+1}`,section.heading);heading.input.dataset.sectionHeading=index;
            const bodyLabel=section.heading.trim()==='자주 묻는 질문(FAQ)' ? 'FAQ (Q. 질문 다음 줄에 A. 답변, 질문 쌍 사이는 빈 줄)' : '본문 (빈 줄로 문단 구분)';
            const paragraphs=field(bodyLabel,section.paragraphs.join('\n\n'),'textarea');paragraphs.input.dataset.sectionBody=index;
            const claims=field('연결할 근거 ID (쉼표로 구분)',section.claimIds.join(', '));claims.input.dataset.sectionClaims=index;
            box.append(heading.wrapper,paragraphs.wrapper,claims.wrapper);form.append(box);
        });
        form.append(el('h3','대표 이미지'));
        const cover=mediaRow(job.media?.thumbnail || {},true);cover.id='insightCover';form.append(cover);
        form.append(el('h3','본문 이미지 (최대 3개)'));
        const images=el('div');images.id='insightImages';form.append(images);
        (job.media?.images || []).forEach(i=>images.append(mediaRow(i,false)));
        const addImage=el('button','본문 이미지 추가','btn');addImage.type='button';addImage.onclick=()=>{if(images.children.length<3){images.append(mediaRow({},false));changed();}};form.append(addImage);
        form.append(el('h3','상품 링크 직접 첨부 (최대 3개)'));
        form.append(el('p','쿠팡 파트너스에서 복사한 링크를 입력하세요. 로켓배송 상품을 우선 선택하고 배송 표시를 직접 확인해주세요. 상품은 선택 사항입니다.'));
        const products=el('div');products.id='insightProducts';form.append(products);
        (job.products || []).forEach(p=>products.append(productRow(p)));
        const addProduct=el('button','상품 링크 추가','btn');addProduct.type='button';addProduct.onclick=()=>{if(products.children.length<3){products.append(productRow({}));changed();}};form.append(addProduct);
        showSeo(job.seoReport);
        preview();
        $('insightEditor').scrollIntoView({ behavior:'smooth',block:'start' });
    }
    const split=value=>value.split(',').map(x=>x.trim()).filter(Boolean);
    function showSeo(report) {
        const target=$('insightSeoReport');target.replaceChildren();
        if(!report){target.append(el('p','SEO 점검은 초안 저장·검증 후 표시됩니다.'));return;}
        target.append(el('strong',`내부 SEO 점검 ${report.score}/100`),el('p',report.note));
        const list=el('ul');report.checks.forEach(c=>list.append(el('li',`${c.passed?'✓':'보완'} ${c.label}`)));target.append(list);
    }
    function rowField(box,label,value,key,tag='input') {
        const f=field(label,value,tag);f.input.dataset.key=key;box.append(f.wrapper);return f.input;
    }
    function removeButton(box) {
        const remove=el('button','삭제','btn');remove.type='button';remove.onclick=()=>{box.remove();changed();};box.append(remove);
    }
    function productRow(product) {
        const box=el('div',undefined,'insight-section-editor');
        rowField(box,'상품명',product.name,'name');rowField(box,'쿠팡 제휴 링크',product.link,'link');
        rowField(box,'쿠팡 상품 원본 URL (선택)',product.originalUrl,'originalUrl');
        rowField(box,'상품 설명 (효능을 단정하지 마세요)',product.reason,'reason');
        const delivery=rowField(box,'확인한 배송 유형','','delivery','select');
        [['unknown','미확인'],['rocket','로켓배송'],['rocket_fresh','로켓프레시'],['standard','일반배송']].forEach(([value,label])=>{const option=el('option',label);option.value=value;delivery.append(option);});delivery.value=product.delivery || 'unknown';
        removeButton(box);return box;
    }
    function mediaRow(image,cover) {
        const box=el('div',undefined,'insight-section-editor');box.dataset.generated=String(image.generated===true);
        const url=rowField(box,'이미지 URL (업로드하면 자동 입력)',image.url,'url');
        const alt=rowField(box,'이미지 대체 텍스트 (이미지에 보이는 내용을 설명)',image.alt,'alt');
        rowField(box,'이미지 설명·출처',image.caption,'caption');
        if(!cover){const position=rowField(box,'배치 위치','','afterSection','select');current.article.sections.forEach((s,index)=>{const option=el('option',`${index+1}. ${s.heading} 다음`);option.value=index;position.append(option);});position.value=image.afterSection || 0;removeButton(box);}
        const upload=field(cover?'대표 이미지 업로드·교체':'본문 이미지 업로드');upload.input.type='file';upload.input.accept='image/jpeg,image/png,image/webp,image/gif';box.append(upload.wrapper);
        const status=el('p');status.setAttribute('role','status');box.append(status);
        upload.input.onchange=async()=>{
            const file=upload.input.files[0];if(!file)return;
            if(file.size>5*1024*1024){status.textContent='이미지는 5MB 이하로 선택해주세요.';return;}
            uploading++;buttons();status.textContent='이미지 업로드 중…';
            try {
                const body=new FormData();body.append(cover?'thumbnail':'image',file);
                const response=await fetch(`/api/admin/manual-posting/${cover?'upload-thumbnail':'upload-image'}`,{method:'POST',credentials:'include',body});
                const data=await response.json();if(!response.ok || !data.success)throw new Error(data.error || '업로드 실패');
                url.value=data.data.url;box.dataset.generated='false';if(!alt.value)alt.value=current.article.seo?.primaryKeyword || current.article.title;
                status.textContent='업로드됐습니다. 대체 텍스트를 확인하고 수정 저장해주세요.';changed();
            } catch(error){status.textContent=error.message;}
            finally{uploading--;buttons();upload.input.value='';}
        };
        return box;
    }
    const rowData=box=>Object.fromEntries([...box.querySelectorAll('[data-key]')].map(input=>[input.dataset.key,input.value]));
    function draft() {
        const article={title:$('insightTitle').value,summary:$('insightSummary').value,categoryId:$('insightCategory').value,tags:split($('insightTags').value),seo:{primaryKeyword:$('insightKeyword').value,searchIntent:$('insightIntent').value},
            sections:current.article.sections.map((s,i)=>({...s,heading:document.querySelector(`[data-section-heading="${i}"]`).value,paragraphs:document.querySelector(`[data-section-body="${i}"]`).value.split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean),claimIds:split(document.querySelector(`[data-section-claims="${i}"]`).value)}))};
        const cover=rowData($('insightCover'));
        const media={thumbnail:cover.url ? {...cover,generated:$('insightCover').dataset.generated==='true'} : null,
            images:[...$('insightImages').children].map(box=>{const image=rowData(box);return {...image,afterSection:Number(image.afterSection),generated:box.dataset.generated==='true'};})};
        const products=[...$('insightProducts').children].map(rowData);
        return {revision:current.revision,article,products,media};
    }
    function preview() {
        if(!current?.article)return;
        const {article,media,products}=draft();const target=$('insightPreview');target.replaceChildren(el('h1',article.title),el('p',article.summary));
        const image=i=>{const figure=el('figure');const img=el('img');try{const url=new URL(i.url);if(url.protocol!=='https:' || !url.hostname.endsWith('.supabase.co'))return figure;img.src=url.href;}catch{return figure;}img.alt=i.alt;figure.append(img);if(i.caption?.trim() && i.caption.trim()!=='AI가 생성한 주제 설명용 이미지입니다.')figure.append(el('figcaption',i.caption));return figure;};
        if(media.thumbnail)target.append(image(media.thumbnail));
        article.sections.forEach((section,index)=>{
            target.append(el('h2',section.heading));
            section.paragraphs.forEach(p=>{
                const faq=section.heading.trim()==='자주 묻는 질문(FAQ)' && p.trim().match(/^Q\.\s*([^\r\n]+)\r?\nA\.\s*([\s\S]+)$/);
                if(faq)target.append(el('h3',`Q. ${faq[1].trim()}`),el('p',`A. ${faq[2].trim()}`));
                else target.append(el('p',p));
            });
            media.images.filter(i=>i.afterSection===index).forEach(i=>target.append(image(i)));
        });
        if(products.length){target.append(el('h2','관련 상품'));products.forEach(p=>target.append(el('p',`${p.name} · ${p.delivery} · ${p.link}`)));}
    }
    function changed(){dirty=true;buttons();preview();$('insightSeoReport').replaceChildren(el('p','내용이 변경됐습니다. 저장 후 SEO 점검 결과를 다시 확인해주세요.'));$('insightMessage').textContent='수정한 내용을 저장하고 다시 검증한 뒤 승인해주세요.';}
    document.addEventListener('DOMContentLoaded',()=>{
        const tab=document.querySelector('[data-section="insight"]');if(!tab)return;
        $('insightDraftFields').addEventListener('input',changed);
        tab.addEventListener('click',load);
        $('insightRefresh').onclick=function(){action(this,load);};
        $('insightCollect').onclick=function(){action(this,()=>api('/collect','POST'));};
        $('insightProcess').onclick=function(){action(this,()=>api('/process','POST'));};
        $('insightSettingsSave').onclick=function(){action(this,()=>api('/settings','PATCH',{enabled:$('insightEnabled').checked,monthly_ai_budget_krw:Number($('insightBudget').value),input_krw_per_million:Number($('insightInputRate').value),output_krw_per_million:Number($('insightOutputRate').value)}));};
        $('insightSave').onclick=function(){action(this,async()=>{const updated=await api(`/jobs/${current.id}`,'PATCH',draft());await open(updated.id);});};
        for(const [button,operation] of [['insightRetry','retry'],['insightReject','reject'],['insightApprove','approve']])$(button).onclick=function(){action(this,async()=>{await api(`/jobs/${current.id}/${operation}`,'POST',{revision:current.revision});await open(current.id);});};
    });
})();

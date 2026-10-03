const fs=require('fs');
const path=require('path');
const cheerio=require('cheerio');
const { escapeHtml,imageUrl }=require('../utils/insightContracts');
function safeBody(content) {
    const $=cheerio.load(content || '',null,false);
    const allowed=new Set(['section','h2','h3','h4','p','ul','ol','li','strong','em','b','i','blockquote','figure','figcaption','img','a','br']);
    function render(node) {
        if(node.type==='text')return escapeHtml(node.data);
        const tag=node.name;
        if(['script','style','iframe','object','embed','form','svg'].includes(tag))return '';
        const children=(node.children || []).map(render).join('');
        if(!allowed.has(tag))return children;
        if(tag==='img') {
            const src=imageUrl(node.attribs.src);if(!src)return '';
            return `<img src="${escapeHtml(src)}" alt="${escapeHtml(node.attribs.alt || '본문 설명 이미지')}" loading="lazy" decoding="async" style="max-width:100%;height:auto">`;
        }
        if(tag==='br')return '<br>';
        let attrs='';
        if(tag==='a'){try{const url=new URL(node.attribs.href);if(url.protocol==='https:' && !url.username && !url.password)attrs=` href="${escapeHtml(url.href)}" rel="noopener noreferrer"`;}catch{}}
        return `<${tag}${attrs}>${children}</${tag}>`;
    }
    return $.root().contents().toArray().map(render).join('');
}
function insightPage(db) {
    const template=fs.readFileSync(path.join(__dirname,'../public/nutrition-info-detail.html'),'utf8');
    return async(req,res,next)=>{
        if(!req.query.id)return next();
        if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.query.id))return res.status(404).send('게시물을 찾을 수 없습니다.');
        try{
            const {data:post,error}=await db.from('nutrition_posts').select('id,title,summary,content,published_date,updated_at,thumbnail_url,thumbnail_alt,source_url')
                .eq('id',req.query.id).eq('is_active',true).eq('is_draft',false).maybeSingle();
            if(error) return res.status(503).send('게시물을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
            if(!post)return res.status(404).send('게시물을 찾을 수 없습니다.');
            const site=(process.env.SITE_URL || 'https://www.eatple.net').replace(/\/$/,'');
            const canonical=`${site}/nutrition-info-detail?id=${post.id}`;
            const text=cheerio.load((post.content || '').replace(/<\/(?:p|h[1-6]|li|section)>/gi,'$&\n')).text();
            const cover=imageUrl(post.thumbnail_url);
            const structured={ '@context':'https://schema.org','@type':'Article',headline:post.title,description:post.summary,inLanguage:'ko-KR',
                datePublished:post.published_date,dateModified:post.updated_at,mainEntityOfPage:canonical,
                author:{ '@type':'Organization',name:'잇플 편집팀' },publisher:{ '@type':'Organization',name:'잇플' },
                ...(cover?{ image:cover }:{}),articleBody:text };
            const metadata=`<meta name="description" content="${escapeHtml(post.summary)}"><link rel="canonical" href="${escapeHtml(canonical)}">`+
                `<meta property="og:title" content="${escapeHtml(post.title)}"><meta property="og:description" content="${escapeHtml(post.summary)}"><meta property="og:url" content="${escapeHtml(canonical)}">`+
                `<meta property="og:type" content="article"><meta name="twitter:card" content="summary_large_image">`+
                (cover?`<meta property="og:image" content="${escapeHtml(cover)}"><meta property="og:image:alt" content="${escapeHtml(post.thumbnail_alt || post.title)}">`:'')+
                `<script type="application/ld+json">${JSON.stringify(structured).replace(/</g,'\\u003c')}</script>`;
            const article=`<article id="insightServerArticle" class="container insight-server-article"><nav><a href="/nutrition-info">잇플 인사이트</a></nav><h1>${escapeHtml(post.title)}</h1>`+
                (cover?`<img src="${escapeHtml(cover)}" alt="${escapeHtml(post.thumbnail_alt || post.title)}" width="1200" height="800" fetchpriority="high" style="max-width:100%;height:auto">`:'')+
                `<p>${escapeHtml(post.summary)}</p>${safeBody(post.content)}</article>`;
            res.set('Cache-Control','no-store').send(template.replace(/<title>[\s\S]*?<\/title>/,()=>`<title>${escapeHtml(post.title)} | 잇플 인사이트</title>`)
                .replace(/<h1 class="detail-title" id="detailTitle">[\s\S]*?<\/h1>/,'<div class="detail-title" id="detailTitle"></div>')
                .replace('</head>',()=>metadata+'</head>').replace(/<body\b[^>]*>/,match=>match+article));
        }catch{res.status(503).send('게시물을 불러오지 못했습니다.');}
    };
}
module.exports={insightPage,safeBody};

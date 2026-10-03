// An editorial checklist, not a Google score or a ranking prediction.
const WRITE_SEO = `SEO: Pick one natural Korean primaryKeyword (2-30 characters) matching the paper and a specific reader searchIntent. Put the keyword naturally in a descriptive title (15-60 characters), the summary (50-160 characters), first paragraph and one useful H2. Avoid keyword stuffing, clickbait, unsupported health benefits and invented experience. Open with a direct answer to the reader's question, then explain evidence, population and limitations. Use distinctive descriptive headings; include an evidence-grounded reader question/answer where useful. This is a health topic: accuracy and uncertainty outrank marketing. Never add facts merely for SEO.`;
function assessSeo(article, media = {}, candidate = {}) {
    const keyword = (article.seo?.primaryKeyword || '').trim();
    const contains = text => keyword.length >= 2 && String(text || '').normalize('NFKC').toLowerCase().includes(keyword.normalize('NFKC').toLowerCase());
    const sections = article.sections || [];
    const checks = [
        ['검색 의도와 주제 키워드',10,keyword.length >= 2 && keyword.length <= 30 && Boolean(article.seo?.searchIntent?.trim())],
        ['제목에 주제 키워드 포함',15,contains(article.title)],
        ['명확한 제목 길이 (15~60자)',5,article.title.length >= 15 && article.title.length <= 60],
        ['검색 설명에 주제 키워드 포함',10,contains(article.summary)],
        ['검색 설명 길이 (50~160자)',5,article.summary.length >= 50 && article.summary.length <= 160],
        ['첫 문단에 주제 키워드 포함',15,contains(sections[0]?.paragraphs[0])],
        ['주제를 설명하는 소제목',10,sections.some(s => contains(s.heading))],
        ['소제목 중복 없음',5,new Set(sections.map(s => s.heading.trim())).size === sections.length],
        ['원문 출처 연결',10,Boolean(candidate.url)],
        ['대표 이미지와 대체 텍스트',10,Boolean(media.thumbnail?.url && media.thumbnail?.alt?.trim())],
        ['본문 이미지 대체 텍스트',5,(media.images || []).every(i => i.alt?.trim())],
    ].map(([label,weight,passed]) => ({ label,weight,passed }));
    return { score: checks.reduce((sum,c) => sum + (c.passed ? c.weight : 0),0), checks,
        note:'내부 SEO 점검입니다. 구글의 평가 점수 또는 검색 순위 예측이 아닙니다.' };
}
module.exports = { WRITE_SEO, assessSeo };

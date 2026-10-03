const axios = require('axios');
const cheerio = require('cheerio');
const { parseStringPromise } = require('xml2js');
const { safeUrl } = require('./insightContracts');

const TOPICS = '("dietary fiber" OR "whole grain" OR "fermented food" OR "protein intake" OR "omega-3" OR "vitamin D" OR probiotics)';
const EUROPE = 'https://www.ebi.ac.uk/europepmc/webservices/rest';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function request(url, params = {}) {
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            return (await axios.get(url, { params, timeout: 25000, maxRedirects: 0,
                maxContentLength: 3 * 1024 * 1024, headers: { 'User-Agent': 'EatpleInsight/1.0 (nutrition research)' } })).data;
        } catch (error) {
            if (attempt === 2 || (error.response && ![429, 502, 503, 504].includes(error.response.status))) throw new Error('논문 데이터 제공처 응답을 확인해주세요.');
            await wait(1500 * (attempt + 1));
        }
    }
}
function normalizePaper(record) {
    return {
        key: record.doi ? `doi:${record.doi.toLowerCase()}` : `pmid:${record.id}`,
        pmid: String(record.id), pmcid: record.pmcid || null, doi: record.doi || null,
        title: record.title || '', journal: record.journalTitle || '',
        publishedDate: record.firstPublicationDate || record.pubYear || null,
        url: record.doi ? `https://doi.org/${record.doi}` : `https://pubmed.ncbi.nlm.nih.gov/${record.id}/`,
        authors: record.authorString || '', articleTypes: record.pubTypeList?.pubType || [],
        abstract: cheerio.load(record.abstractText || '').text().slice(0, 12000),
    };
}
async function searchPapers({ now = new Date(), limit = 50 } = {}) {
    const start = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
    const end = now.toISOString().slice(0, 10);
    // Europe PMC searches PubMed records, then supplies full-text identifiers in the same response.
    const data = await request(`${EUROPE}/search`, { query: `SRC:MED AND FIRST_PDATE:[${start} TO ${end}] AND ${TOPICS} NOT PUB_TYPE:Preprint`,
        format: 'json', resultType: 'core', pageSize: Math.min(limit, 50) });
    return (data.resultList?.result || []).map(normalizePaper).filter(p => p.title && safeUrl(p.url));
}
async function integrity(doi) {
    if (!doi) return { checked: false, blocked: false, issues: ['DOI 없음: 정정·철회 상태 수동 확인 필요'] };
    const record = (await request(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
        ...(process.env.INSIGHT_CONTACT_EMAIL ? { mailto: process.env.INSIGHT_CONTACT_EMAIL } : {}) })).message;
    const updates = record['updated-by'] || [];
    const blocked = updates.some(x => /retraction|withdrawal|concern|correction/i.test(x.type || '')) ||
        /retraction|withdrawal|expression of concern/i.test((record.title || []).join(' '));
    return { checked: true, blocked, issues: blocked ? ['철회·정정·우려 표명 정보가 있어 자동 처리에서 제외했습니다.'] : [], checkedAt: new Date().toISOString() };
}
async function fetchFullText(paper) {
    if (!paper.pmcid || !/^PMC\d+$/.test(paper.pmcid)) throw new Error('이용 가능한 원문이 없습니다.');
    const xml = await request(`${EUROPE}/${paper.pmcid}/fullTextXML`);
    if (typeof xml !== 'string') throw new Error('원문 XML 응답이 아닙니다.');
    const $ = cheerio.load(xml, { xmlMode: true });
    const licenseUrl = $('license').attr('xlink:href') || $('license').attr('href') || $('license ext-link').attr('xlink:href') ||
        $('license ext-link').attr('href') || $('license').find('*').filter((_,el)=>el.name.endsWith('license_ref')).first().text().trim() || '';
    const licenseText = $('license').text();
    const permitted = /^https?:\/\/creativecommons\.org\/(licenses\/by\/|publicdomain\/zero\/)/i.test(licenseUrl) ||
        /Creative Commons Attribution(?:\s+4\.0)?(?:\s+International)?\s+(?:License|licen[cs]e)/i.test(licenseText);
    if (!permitted || /non.?commercial|no.?derivatives|share.?alike|by-nc|by-nd|by-sa/i.test(licenseUrl + licenseText)) throw new Error('CC0·CC BY 원문 이용 조건을 확인할 수 없습니다.');
    const sections = [];
    const abstract = $('article > front article-meta abstract').text().replace(/\s+/g, ' ').trim();
    if (abstract) sections.push(`[Abstract] ${abstract}`);
    $('article > body').children().each((_, el) => sections.push(`[${$(el).children('title').first().text() || el.name}] ${$(el).text().replace(/\s+/g, ' ').trim()}`));
    $('article-meta funding-group, back ack, back fn-group').each((_,el)=>sections.push(`[Funding/disclosures] ${$(el).text().replace(/\s+/g,' ').trim()}`));
    const text = sections.join('\n\n');
    if (text.length < 1500 || text.length > 180000) throw new Error('원문 길이 또는 본문 구조를 확인해주세요. 원문 일부만 읽고 진행하지 않습니다.');
    return { text, license: licenseUrl || licenseText.slice(0, 500), retrievedAt: new Date().toISOString() };
}
// Keep this parser available for PubMed EFetch integrations and tests without relying on HTML scraping.
async function parsePubmed(xml) { return parseStringPromise(xml, { explicitArray: false }); }
module.exports = { searchPapers, fetchFullText, integrity, normalizePaper, parsePubmed };

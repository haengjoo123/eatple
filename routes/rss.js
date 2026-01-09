/**
 * RSS 피드 라우터
 * 네이버 서치어드바이저 등 검색 엔진에 사이트 콘텐츠를 제공하기 위한 RSS 피드 생성
 */

const express = require('express');
const router = express.Router();
const SupabaseNutritionDataManager = require('../utils/supabaseNutritionDataManager');

module.exports = () => {
    const supabaseDataManager = new SupabaseNutritionDataManager();

    /**
     * RSS 피드 생성
     * GET /rss 또는 /rss.xml
     */
    router.get('/', async (req, res) => {
        try {
            // 모든 활성화된 영양 정보 조회 (RSS 피드용)
            const filters = {
                excludeDrafts: true
            };
            
            // 페이지네이션을 통해 모든 데이터 가져오기
            const allItems = [];
            let page = 1;
            const pageSize = 100; // 한 번에 100개씩 가져오기
            const maxPages = 100; // 최대 100페이지 (10,000개)로 제한하여 무한 루프 방지
            let hasMore = true;
            
            while (hasMore && page <= maxPages) {
                const pagination = {
                    page: page,
                    limit: pageSize
                };
                
                const result = await supabaseDataManager.getNutritionInfoList(filters, pagination);
                const items = result && result.data ? result.data : [];
                
                if (items.length === 0) {
                    hasMore = false;
                } else {
                    allItems.push(...items);
                    
                    // 전체 개수 확인하여 더 가져올 데이터가 있는지 확인
                    const totalCount = result?.pagination?.totalCount || 0;
                    const currentCount = allItems.length;
                    
                    if (currentCount >= totalCount || items.length < pageSize) {
                        hasMore = false;
                    } else {
                        page++;
                    }
                }
            }
            
            const items = allItems;

            // 사이트 정보
            const siteUrl = process.env.SITE_URL || 'https://www.eatple.net';
            const siteTitle = '잇플 - 건강한 식생활을 위한 종합 플랫폼';
            const siteDescription = 'AI 기반 개인 맞춤 식단부터 영양제 추천, 맛집 정보까지 건강한 라이프스타일을 위한 모든 것을 한 곳에서';

            // RSS 2.0 형식으로 XML 생성
            const rssXml = generateRSSFeed(siteUrl, siteTitle, siteDescription, items);

            // Content-Type 헤더 설정
            res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
            res.setHeader('Cache-Control', 'public, max-age=3600'); // 1시간 캐시
            
            res.send(rssXml);
        } catch (error) {
            console.error('RSS 피드 생성 오류:', error);
            res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>오류</title><description>RSS 피드를 생성하는 중 오류가 발생했습니다.</description></channel></rss>');
        }
    });

    /**
     * RSS 피드 XML 생성 함수
     */
    function generateRSSFeed(siteUrl, siteTitle, siteDescription, items) {
        const now = new Date();
        const pubDate = formatRSSDate(now);
        
        let rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title><![CDATA[${siteTitle}]]></title>
    <link>${siteUrl}</link>
    <description><![CDATA[${siteDescription}]]></description>
    <language>ko-KR</language>
    <lastBuildDate>${pubDate}</lastBuildDate>
    <pubDate>${pubDate}</pubDate>
    <generator>잇플 RSS 피드 생성기</generator>
    <webMaster>support@eatple.com (잇플 고객지원팀)</webMaster>
    <managingEditor>support@eatple.com (잇플 고객지원팀)</managingEditor>
`;

        // 각 아이템 추가
        items.forEach(item => {
            const itemUrl = `${siteUrl}/nutrition-info-detail.html?id=${item.id}`;
            const itemTitle = escapeXml(item.title || '제목 없음');
            const itemDescription = escapeXml(item.summary || item.content || '설명 없음');
            const itemDate = item.publishedDate || item.collectedDate;
            const itemPubDate = itemDate ? formatRSSDate(new Date(itemDate)) : pubDate;
            const itemAuthor = item.author || '잇플';
            
            rssXml += `    <item>
      <title><![CDATA[${itemTitle}]]></title>
      <link>${itemUrl}</link>
      <guid isPermaLink="true">${itemUrl}</guid>
      <description><![CDATA[${itemDescription}]]></description>
      <pubDate>${itemPubDate}</pubDate>
      <author>${escapeXml(itemAuthor)}</author>
`;

            // 카테고리 추가
            if (item.category) {
                rssXml += `      <category><![CDATA[${escapeXml(item.category)}]]></category>
`;
            }

            // 태그 추가
            if (item.tags && item.tags.length > 0) {
                item.tags.forEach(tag => {
                    rssXml += `      <category><![CDATA[${escapeXml(tag)}]]></category>
`;
                });
            }

            // 이미지 추가
            if (item.thumbnailUrl || item.imageUrl) {
                const imageUrl = item.thumbnailUrl || item.imageUrl;
                rssXml += `      <enclosure url="${escapeXml(imageUrl)}" type="image/jpeg"/>
`;
            }

            rssXml += `    </item>
`;
        });

        rssXml += `  </channel>
</rss>`;

        return rssXml;
    }

    /**
     * RSS 날짜 형식 변환 (RFC 822 형식)
     */
    function formatRSSDate(date) {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        const day = days[date.getUTCDay()];
        const month = months[date.getUTCMonth()];
        const dayNum = String(date.getUTCDate()).padStart(2, '0');
        const year = date.getUTCFullYear();
        const hours = String(date.getUTCHours()).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
        const seconds = String(date.getUTCSeconds()).padStart(2, '0');
        
        return `${day}, ${dayNum} ${month} ${year} ${hours}:${minutes}:${seconds} GMT`;
    }

    /**
     * XML 특수 문자 이스케이프
     */
    function escapeXml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    return router;
};


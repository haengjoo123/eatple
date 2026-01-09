/**
 * 사이트맵 라우터
 * 검색 엔진에 사이트의 모든 페이지를 알려주기 위한 사이트맵 XML 생성
 */

const express = require('express');
const router = express.Router();
const SupabaseNutritionDataManager = require('../utils/supabaseNutritionDataManager');

module.exports = () => {
    const supabaseDataManager = new SupabaseNutritionDataManager();

    /**
     * 사이트맵 생성
     * GET /sitemap.xml
     */
    router.get('/', async (req, res) => {
        try {
            const siteUrl = process.env.SITE_URL || 'https://www.eatple.net';
            
            // 정적 페이지 목록 (우선순위와 업데이트 빈도 포함)
            const staticPages = [
                { url: '', priority: '1.0', changefreq: 'daily' }, // 메인 페이지
                { url: 'meal-plan.html', priority: '0.9', changefreq: 'weekly' },
                { url: 'supplements.html', priority: '0.9', changefreq: 'weekly' },
                { url: 'restaurant-recommendation.html', priority: '0.9', changefreq: 'weekly' },
                { url: 'nutrition-info.html', priority: '0.9', changefreq: 'daily' },
                { url: 'ingredient-analyzer.html', priority: '0.8', changefreq: 'monthly' },
                { url: 'food-nutrition-search.html', priority: '0.8', changefreq: 'monthly' },
                { url: 'mini-games.html', priority: '0.7', changefreq: 'monthly' },
                { url: 'login.html', priority: '0.5', changefreq: 'monthly' },
                { url: 'signup.html', priority: '0.5', changefreq: 'monthly' },
            ];

            // 모든 활성화된 영양 정보 가져오기
            const filters = {
                excludeDrafts: true
            };
            
            const allNutritionItems = [];
            let page = 1;
            const pageSize = 100;
            const maxPages = 100;
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
                    allNutritionItems.push(...items);
                    
                    const totalCount = result?.pagination?.totalCount || 0;
                    const currentCount = allNutritionItems.length;
                    
                    if (currentCount >= totalCount || items.length < pageSize) {
                        hasMore = false;
                    } else {
                        page++;
                    }
                }
            }

            // 사이트맵 XML 생성
            const sitemapXml = generateSitemap(siteUrl, staticPages, allNutritionItems);

            // Content-Type 헤더 설정
            res.setHeader('Content-Type', 'application/xml; charset=utf-8');
            res.setHeader('Cache-Control', 'public, max-age=3600'); // 1시간 캐시
            
            res.send(sitemapXml);
        } catch (error) {
            console.error('사이트맵 생성 오류:', error);
            res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://www.eatple.net</loc></url></urlset>');
        }
    });

    /**
     * 사이트맵 XML 생성 함수
     */
    function generateSitemap(siteUrl, staticPages, nutritionItems) {
        const now = new Date().toISOString().split('T')[0]; // YYYY-MM-DD 형식
        
        let sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

        // 정적 페이지 추가
        staticPages.forEach(page => {
            const fullUrl = page.url ? `${siteUrl}/${page.url}` : siteUrl;
            sitemapXml += `  <url>
    <loc>${escapeXml(fullUrl)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
`;
        });

        // 영양 정보 상세 페이지 추가
        nutritionItems.forEach(item => {
            const itemUrl = `${siteUrl}/nutrition-info-detail.html?id=${item.id}`;
            const itemDate = item.publishedDate || item.collectedDate;
            const lastmod = itemDate ? new Date(itemDate).toISOString().split('T')[0] : now;
            
            sitemapXml += `  <url>
    <loc>${escapeXml(itemUrl)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
`;
        });

        sitemapXml += `</urlset>`;

        return sitemapXml;
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

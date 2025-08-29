/**
 * 영양 정보 데이터 모델
 * Requirements: 2.4, 5.2
 */

class NutritionInfo {
    constructor(data = {}) {
        this.id = data.id || this.generateId();
        this.title = data.title || '';
        this.summary = data.summary || '';
        this.content = data.content || data.originalContent || ''; // content 필드 추가
        this.originalContent = data.originalContent || data.content || ''; // 기존 호환성 유지
        this.sourceType = data.sourceType || ''; // 'paper', 'youtube', 'news', 'manual'
        this.sourceUrl = data.sourceUrl || '';
        this.sourceName = data.sourceName || '';
        this.author = data.author || '';
        this.publishedDate = data.publishedDate ? new Date(data.publishedDate) : null;
        this.collectedDate = data.collectedDate ? new Date(data.collectedDate) : new Date();
        this.trustScore = data.trustScore || 0; // 0-100
        this.category = data.category || ''; // 'diet', 'supplements', 'research', 'trends'
        this.tags = data.tags || [];
        this.imageUrl = data.imageUrl || '';
        this.thumbnailUrl = data.thumbnailUrl || '';
        this.videoId = data.videoId || '';
        this.language = data.language || 'ko';
        this.isActive = data.isActive !== undefined ? data.isActive : true;
        this.viewCount = data.viewCount || 0;
        this.likeCount = data.likeCount || 0;
        this.bookmarkCount = data.bookmarkCount || 0;
        this.related_products = data.related_products || []; // 관련 상품 정보 추가
    }

    /**
     * 고유 ID 생성
     */
    generateId() {
        const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const random = Math.random().toString(36).substr(2, 6);
        return `nutrition_${timestamp}_${random}`;
    }

    /**
     * 데이터 유효성 검증
     */
    validate() {
        const errors = [];

        if (!this.title || this.title.trim().length === 0) {
            errors.push('제목은 필수입니다.');
        }

        if (!this.summary || this.summary.trim().length === 0) {
            errors.push('요약은 필수입니다.');
        }

        if (!['paper', 'youtube', 'news', 'manual'].includes(this.sourceType)) {
            errors.push('소스 타입은 paper, youtube, news, manual 중 하나여야 합니다.');
        }

        if (!this.sourceUrl || !this.isValidUrl(this.sourceUrl)) {
            errors.push('유효한 소스 URL이 필요합니다.');
        }

        if (!['diet', 'supplements', 'research', 'trends'].includes(this.category)) {
            errors.push('카테고리는 diet, supplements, research, trends 중 하나여야 합니다.');
        }

        if (this.trustScore < 0 || this.trustScore > 100) {
            errors.push('신뢰도 점수는 0-100 사이여야 합니다.');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * URL 유효성 검증
     */
    isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    /**
     * JSON 직렬화를 위한 객체 변환
     */
    toJSON() {
        return {
            id: this.id,
            title: this.title,
            summary: this.summary,
            content: this.content, // content 필드 추가
            originalContent: this.originalContent, // 기존 호환성 유지
            sourceType: this.sourceType,
            sourceUrl: this.sourceUrl,
            sourceName: this.sourceName,
            author: this.author,
            publishedDate: this.publishedDate ? this.publishedDate.toISOString() : null,
            collectedDate: this.collectedDate.toISOString(),
            trustScore: this.trustScore,
            category: this.category,
            tags: this.tags,
            imageUrl: this.imageUrl,
            thumbnailUrl: this.thumbnailUrl,
            videoId: this.videoId,
            language: this.language,
            isActive: this.isActive,
            viewCount: this.viewCount,
            likeCount: this.likeCount,
            bookmarkCount: this.bookmarkCount,
            related_products: this.related_products // 관련 상품 정보 추가
        };
    }

    /**
     * 객체에서 NutritionInfo 인스턴스 생성
     */
    static fromJSON(data) {
        return new NutritionInfo(data);
    }

    /**
     * 조회수 증가
     */
    incrementViewCount() {
        this.viewCount++;
    }

    /**
     * 좋아요 수 증가/감소
     */
    toggleLike(increment = true) {
        if (increment) {
            this.likeCount++;
        } else {
            this.likeCount = Math.max(0, this.likeCount - 1);
        }
    }

    /**
     * 북마크 수 증가/감소
     */
    toggleBookmark(increment = true) {
        if (increment) {
            this.bookmarkCount++;
        } else {
            this.bookmarkCount = Math.max(0, this.bookmarkCount - 1);
        }
    }
}

module.exports = NutritionInfo;
/**
 * 영양 정보 데이터 관리 유틸리티
 * Requirements: 2.4, 5.2
 */

const fs = require('fs').promises;
const path = require('path');
const NutritionInfo = require('../models/NutritionInfo');

class NutritionDataManager {
    constructor() {
        this.dataDir = path.join(__dirname, '../data');
        this.nutritionDataFile = path.join(this.dataDir, 'nutrition-info.json');
        this.configFile = path.join(this.dataDir, 'nutrition-config.json');
        this.userPreferencesFile = path.join(this.dataDir, 'user-preferences.json');
        
        // 메모리 캐시
        this.cache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5분
    }

    /**
     * 데이터 디렉토리 초기화
     */
    async initialize() {
        try {
            await fs.access(this.dataDir);
        } catch (error) {
            await fs.mkdir(this.dataDir, { recursive: true });
        }

        // 기본 파일들 생성
        await this.ensureFileExists(this.nutritionDataFile, []);
        await this.ensureFileExists(this.configFile, this.getDefaultConfig());
        await this.ensureFileExists(this.userPreferencesFile, {});
    }

    /**
     * 파일이 존재하지 않으면 기본값으로 생성
     */
    async ensureFileExists(filePath, defaultData) {
        try {
            await fs.access(filePath);
        } catch (error) {
            await fs.writeFile(filePath, JSON.stringify(defaultData, null, 2), 'utf8');
        }
    }

    /**
     * 기본 설정 반환
     */
    getDefaultConfig() {
        return {
            collection: {
                pubmed: {
                    keywords: ["nutrition", "diet", "supplements", "health"],
                    maxResults: 20,
                    dateRange: "30d"
                },
                youtube: {
                    channels: [
                        // 한국 의료/건강 채널 ID들 (실제 채널 ID로 업데이트 필요)
                        "UCzvCCKOHVGbwJy1gIKyVxfA", // 닥터프렌즈 (예시)
                        "UCkEoLVKJAh-zBOCQHSzgVaA", // 약사가 들려주는 약 이야기 (예시)
                        "UCqDLncqz8V8uF8fGp8yZLQg"  // 건강TV (예시)
                    ],
                    keywords: ["영양", "건강", "식단", "다이어트", "건강식품", "영양제"],
                    maxResults: 15
                },
                news: {
                    sources: ["health-news", "nutrition-today"],
                    keywords: ["영양", "건강식품", "다이어트"],
                    maxResults: 25
                }
            },
            processing: {
                trustScoreThreshold: 60,
                duplicateDetectionEnabled: true,
                contentFilteringEnabled: true,
                autoTranslation: true
            },
            categories: ["diet", "supplements", "research", "trends"],
            sourceTypes: ["paper", "youtube", "news"],
            languages: ["ko", "en"]
        };
    }

    /**
     * 영양 정보 저장
     */
    async saveNutritionInfo(nutritionInfo) {
        if (!(nutritionInfo instanceof NutritionInfo)) {
            throw new Error('NutritionInfo 인스턴스가 필요합니다.');
        }

        const validation = nutritionInfo.validate();
        if (!validation.isValid) {
            throw new Error(`데이터 유효성 검증 실패: ${validation.errors.join(', ')}`);
        }

        const data = await this.loadNutritionData();
        
        // 기존 데이터 업데이트 또는 새 데이터 추가
        const existingIndex = data.findIndex(item => item.id === nutritionInfo.id);
        if (existingIndex >= 0) {
            data[existingIndex] = nutritionInfo.toJSON();
        } else {
            data.push(nutritionInfo.toJSON());
        }

        await this.saveNutritionData(data);
        
        // 캐시 무효화
        this.invalidateCache();
        
        return nutritionInfo;
    }

    /**
     * 영양 정보 목록 조회
     */
    async getNutritionInfoList(filters = {}, pagination = {}) {
        const cacheKey = `list_${JSON.stringify(filters)}_${JSON.stringify(pagination)}`;
        
        // 캐시 확인
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheExpiry) {
                return cached.data;
            }
        }

        const data = await this.loadNutritionData();
        let filteredData = data.filter(item => item.isActive);

        // 필터링 적용
        if (filters.search) {
            const searchTerms = filters.search.toLowerCase().split(' ');
            filteredData = filteredData.filter(item => {
                const searchableText = [
                    item.title,
                    item.summary,
                    item.author,
                    item.sourceName,
                    ...item.tags
                ].join(' ').toLowerCase();
                
                // Unicode 이스케이프된 문자열도 정상적으로 검색할 수 있도록 개선
                const normalizedSearchableText = searchableText.normalize('NFC');
                
                return searchTerms.every(term => {
                    const normalizedTerm = term.normalize('NFC');
                    return normalizedSearchableText.includes(normalizedTerm);
                });
            });

            // 검색 결과를 관련성 순으로 정렬 (제목 우선)
            filteredData.sort((a, b) => {
                const aTitle = a.title.toLowerCase().normalize('NFC');
                const bTitle = b.title.toLowerCase().normalize('NFC');
                const searchQuery = filters.search.toLowerCase().normalize('NFC');
                
                // 제목에 검색어가 포함된 항목을 우선 정렬
                const aTitleMatch = aTitle.includes(searchQuery);
                const bTitleMatch = bTitle.includes(searchQuery);
                
                if (aTitleMatch && !bTitleMatch) return -1;
                if (!aTitleMatch && bTitleMatch) return 1;
                
                // 둘 다 제목에 포함되거나 둘 다 제목에 포함되지 않는 경우
                // 제목에서 검색어의 위치를 기준으로 정렬 (앞쪽에 있을수록 우선)
                if (aTitleMatch && bTitleMatch) {
                    const aIndex = aTitle.indexOf(searchQuery);
                    const bIndex = bTitle.indexOf(searchQuery);
                    return aIndex - bIndex;
                }
                
                return 0;
            });
        }
        if (filters.category) {
            filteredData = filteredData.filter(item => item.category === filters.category);
        }
        if (filters.sourceType) {
            // 배열인 경우 (여러 소스 타입 필터링)
            if (Array.isArray(filters.sourceType)) {
                filteredData = filteredData.filter(item => 
                    filters.sourceType.includes(item.sourceType)
                );
            } else {
                // 단일 값인 경우
                filteredData = filteredData.filter(item => item.sourceType === filters.sourceType);
            }
        }
        if (filters.tags && filters.tags.length > 0) {
            filteredData = filteredData.filter(item => 
                filters.tags.some(tag => item.tags.includes(tag))
            );
        }
        if (filters.minTrustScore) {
            filteredData = filteredData.filter(item => item.trustScore >= filters.minTrustScore);
        }
        if (filters.dateFrom) {
            const fromDate = new Date(filters.dateFrom);
            filteredData = filteredData.filter(item => 
                new Date(item.collectedDate) >= fromDate
            );
        }
        if (filters.dateTo) {
            const toDate = new Date(filters.dateTo);
            filteredData = filteredData.filter(item => 
                new Date(item.collectedDate) <= toDate
            );
        }

        // 정렬
        const sortBy = filters.sortBy || 'collectedDate';
        const sortOrder = filters.sortOrder || 'desc';
        
        filteredData.sort((a, b) => {
            let aValue = a[sortBy];
            let bValue = b[sortBy];
            
            if (sortBy.includes('Date')) {
                aValue = new Date(aValue);
                bValue = new Date(bValue);
            }
            
            if (sortOrder === 'desc') {
                return bValue > aValue ? 1 : -1;
            } else {
                return aValue > bValue ? 1 : -1;
            }
        });

        // 페이지네이션
        const page = pagination.page || 1;
        const limit = pagination.limit || 20;
        const offset = (page - 1) * limit;
        
        const paginatedData = filteredData.slice(offset, offset + limit);
        
        const result = {
            data: paginatedData.map(item => NutritionInfo.fromJSON(item)),
            pagination: {
                page: page,
                limit: limit,
                total: filteredData.length,
                totalPages: Math.ceil(filteredData.length / limit)
            }
        };

        // 캐시 저장
        this.cache.set(cacheKey, {
            data: result,
            timestamp: Date.now()
        });

        return result;
    }

    /**
     * ID로 영양 정보 조회
     */
    async getNutritionInfoById(id) {
        const data = await this.loadNutritionData();
        
        // 배열에서 찾기
        const item = data.find(item => item.id === id);
        
        if (!item) {
            return null;
        }

        return NutritionInfo.fromJSON(item);
    }

    /**
     * 영양 정보 검색
     */
    async searchNutritionInfo(query, filters = {}) {
        const data = await this.loadNutritionData();
        const searchTerms = query.toLowerCase().split(' ');
        
        let searchResults = data.filter(item => {
            if (!item.isActive) return false;
            
            const searchableText = [
                item.title,
                item.summary,
                item.author,
                item.sourceName,
                ...item.tags
            ].join(' ').toLowerCase();
            
            // Unicode 이스케이프된 문자열도 정상적으로 검색할 수 있도록 개선
            const normalizedSearchableText = searchableText.normalize('NFC');
            
            return searchTerms.every(term => {
                const normalizedTerm = term.normalize('NFC');
                return normalizedSearchableText.includes(normalizedTerm);
            });
        });

        // 검색 결과를 관련성 순으로 정렬 (제목 우선)
        searchResults.sort((a, b) => {
            const aTitle = a.title.toLowerCase().normalize('NFC');
            const bTitle = b.title.toLowerCase().normalize('NFC');
            const searchQuery = query.toLowerCase().normalize('NFC');
            
            // 제목에 검색어가 포함된 항목을 우선 정렬
            const aTitleMatch = aTitle.includes(searchQuery);
            const bTitleMatch = bTitle.includes(searchQuery);
            
            if (aTitleMatch && !bTitleMatch) return -1;
            if (!aTitleMatch && bTitleMatch) return 1;
            
            // 둘 다 제목에 포함되거나 둘 다 제목에 포함되지 않는 경우
            // 제목에서 검색어의 위치를 기준으로 정렬 (앞쪽에 있을수록 우선)
            if (aTitleMatch && bTitleMatch) {
                const aIndex = aTitle.indexOf(searchQuery);
                const bIndex = bTitle.indexOf(searchQuery);
                return aIndex - bIndex;
            }
            
            return 0;
        });

        // 추가 필터링 적용
        if (filters.category) {
            searchResults = searchResults.filter(item => item.category === filters.category);
        }
        if (filters.sourceType) {
            // 배열인 경우 (여러 소스 타입 필터링)
            if (Array.isArray(filters.sourceType)) {
                searchResults = searchResults.filter(item => 
                    filters.sourceType.includes(item.sourceType)
                );
            } else {
                // 단일 값인 경우
                searchResults = searchResults.filter(item => item.sourceType === filters.sourceType);
            }
        }
        if (filters.tags && filters.tags.length > 0) {
            searchResults = searchResults.filter(item => 
                filters.tags.some(tag => item.tags.includes(tag))
            );
        }
        if (filters.minTrustScore) {
            searchResults = searchResults.filter(item => item.trustScore >= filters.minTrustScore);
        }

        // 정렬
        const sortBy = filters.sortBy || 'collectedDate';
        const sortOrder = filters.sortOrder || 'desc';
        
        searchResults.sort((a, b) => {
            let aValue = a[sortBy];
            let bValue = b[sortBy];
            
            if (sortBy.includes('Date')) {
                aValue = new Date(aValue);
                bValue = new Date(bValue);
            }
            
            if (sortOrder === 'desc') {
                return bValue > aValue ? 1 : -1;
            } else {
                return aValue > bValue ? 1 : -1;
            }
        });

        return searchResults.map(item => NutritionInfo.fromJSON(item));
    }

    /**
     * 영양 정보 업데이트
     */
    async updateNutritionInfo(id, updates) {
        const data = await this.loadNutritionData();
        const index = data.findIndex(item => item.id === id);
        
        if (index === -1) {
            throw new Error('해당 ID의 영양 정보를 찾을 수 없습니다.');
        }

        // 업데이트 적용
        const updatedItem = { ...data[index], ...updates };
        const nutritionInfo = NutritionInfo.fromJSON(updatedItem);
        
        const validation = nutritionInfo.validate();
        if (!validation.isValid) {
            throw new Error(`데이터 유효성 검증 실패: ${validation.errors.join(', ')}`);
        }

        data[index] = nutritionInfo.toJSON();
        await this.saveNutritionData(data);
        
        this.invalidateCache();
        return nutritionInfo;
    }

    /**
     * 영양 정보 삭제 (소프트 삭제)
     */
    async deleteNutritionInfo(id) {
        return this.updateNutritionInfo(id, { isActive: false });
    }

    /**
     * 영양 정보 영구 삭제
     */
    async permanentlyDeleteNutritionInfo(id) {
        try {
            const data = await this.loadNutritionData();
            const filteredData = data.filter(item => item.id !== id);
            
            if (filteredData.length === data.length) {
                throw new Error('해당 영양 정보를 찾을 수 없습니다.');
            }
            
            await this.saveNutritionData(filteredData);
            this.invalidateCache();
            
            console.log(`영양 정보 영구 삭제 완료: ${id}`);
            return true;
        } catch (error) {
            console.error('영양 정보 영구 삭제 오류:', error);
            throw error;
        }
    }

    /**
     * 통계 정보 조회
     */
    async getStatistics() {
        const data = await this.loadNutritionData();
        const activeData = data.filter(item => item.isActive);
        
        const stats = {
            totalItems: data.length,
            activeItems: activeData.length,
            inactiveItems: data.length - activeData.length,
            byCategory: {},
            bySourceType: {},
            averageTrustScore: 0,
            totalViews: 0,
            totalLikes: 0,
            totalBookmarks: 0
        };

        let trustScoreSum = 0;
        
        activeData.forEach(item => {
            // 카테고리별 통계
            stats.byCategory[item.category] = (stats.byCategory[item.category] || 0) + 1;
            
            // 소스 타입별 통계
            stats.bySourceType[item.sourceType] = (stats.bySourceType[item.sourceType] || 0) + 1;
            
            // 신뢰도 점수 합계
            trustScoreSum += item.trustScore;
            
            // 상호작용 통계
            stats.totalViews += item.viewCount;
            stats.totalLikes += item.likeCount;
            stats.totalBookmarks += item.bookmarkCount;
        });

        stats.averageTrustScore = activeData.length > 0 ? trustScoreSum / activeData.length : 0;
        
        return stats;
    }

    /**
     * 데이터 파일 로드
     */
    async loadNutritionData() {
        try {
            const data = await fs.readFile(this.nutritionDataFile, 'utf8');
            const parsed = JSON.parse(data);
            
            // 빈 객체이거나 배열이 아닌 경우 빈 배열 반환
            if (!parsed || typeof parsed !== 'object') {
                return [];
            }
            
            // 객체인 경우 배열로 변환 (기존 데이터 구조 호환성)
            if (!Array.isArray(parsed)) {
                return Object.values(parsed);
            }
            
            return parsed;
        } catch (error) {
            console.error('영양 정보 데이터 로드 실패:', error);
            return [];
        }
    }

    /**
     * 데이터 파일 저장
     */
    async saveNutritionData(data) {
        try {
            // 배열 형태로 저장 (웹 페이지 호환성을 위해)
            const dataArray = Array.isArray(data) ? data : Object.values(data);
            
            await fs.writeFile(this.nutritionDataFile, JSON.stringify(dataArray, null, 2), 'utf8');
        } catch (error) {
            console.error('영양 정보 데이터 저장 실패:', error);
            throw error;
        }
    }

    /**
     * 설정 파일 로드
     */
    async loadConfig() {
        try {
            const data = await fs.readFile(this.configFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('설정 파일 로드 실패:', error);
            return this.getDefaultConfig();
        }
    }

    /**
     * 설정 파일 저장
     */
    async saveConfig(config) {
        try {
            await fs.writeFile(this.configFile, JSON.stringify(config, null, 2), 'utf8');
        } catch (error) {
            console.error('설정 파일 저장 실패:', error);
            throw error;
        }
    }

    /**
     * 캐시 무효화
     */
    invalidateCache() {
        this.cache.clear();
    }

    /**
     * 북마크 토글
     */
    async toggleBookmark(itemId, userId) {
        try {
            const item = await this.getNutritionInfoById(itemId);
            if (!item) {
                throw new Error('해당 ID의 영양 정보를 찾을 수 없습니다.');
            }

            // 사용자별 북마크 상태 관리 (간단한 구현)
            const userPreferences = await this.loadUserPreferences();
            if (!userPreferences[userId]) {
                userPreferences[userId] = { bookmarks: [], likes: [] };
            }

            const bookmarks = userPreferences[userId].bookmarks;
            const isBookmarked = bookmarks.includes(itemId);

            if (isBookmarked) {
                // 북마크 제거
                userPreferences[userId].bookmarks = bookmarks.filter(id => id !== itemId);
                item.toggleBookmark(false);
            } else {
                // 북마크 추가
                userPreferences[userId].bookmarks.push(itemId);
                item.toggleBookmark(true);
            }

            await this.saveUserPreferences(userPreferences);
            await this.updateNutritionInfo(itemId, item.toJSON());

            return { bookmarked: !isBookmarked };
        } catch (error) {
            console.error('북마크 토글 실패:', error);
            throw error;
        }
    }

    /**
     * 좋아요 토글
     */
    async toggleLike(itemId, userId) {
        try {
            const item = await this.getNutritionInfoById(itemId);
            if (!item) {
                throw new Error('해당 ID의 영양 정보를 찾을 수 없습니다.');
            }

            // 사용자별 좋아요 상태 관리
            const userPreferences = await this.loadUserPreferences();
            if (!userPreferences[userId]) {
                userPreferences[userId] = { bookmarks: [], likes: [] };
            }

            const likes = userPreferences[userId].likes;
            const isLiked = likes.includes(itemId);

            if (isLiked) {
                // 좋아요 제거
                userPreferences[userId].likes = likes.filter(id => id !== itemId);
                item.toggleLike(false);
            } else {
                // 좋아요 추가
                userPreferences[userId].likes.push(itemId);
                item.toggleLike(true);
            }

            await this.saveUserPreferences(userPreferences);
            await this.updateNutritionInfo(itemId, item.toJSON());

            return { liked: !isLiked };
        } catch (error) {
            console.error('좋아요 토글 실패:', error);
            throw error;
        }
    }

    /**
     * 조회수 증가
     */
    async incrementViewCount(itemId) {
        try {
            const item = await this.getNutritionInfoById(itemId);
            if (!item) {
                throw new Error('해당 ID의 영양 정보를 찾을 수 없습니다.');
            }

            item.incrementViewCount();
            await this.updateNutritionInfo(itemId, item.toJSON());

            return item;
        } catch (error) {
            console.error('조회수 증가 실패:', error);
            throw error;
        }
    }

    /**
     * 사용자 상호작용 상태 조회
     */
    async getUserInteractionStatus(itemId, userId) {
        try {
            console.log(`[INTERACTION STATUS] 사용자 ${userId}의 아이템 ${itemId} 상호작용 상태 조회`);
            
            const userPreferences = await this.loadUserPreferences();
            console.log(`[INTERACTION STATUS] 로드된 사용자 선호도:`, JSON.stringify(userPreferences, null, 2));
            
            const userPref = userPreferences[userId];
            
            if (!userPref) {
                console.log(`[INTERACTION STATUS] 사용자 ${userId}의 선호도 데이터 없음`);
                return {
                    bookmarked: false,
                    liked: false
                };
            }

            // 새로운 구조 (interactions.bookmarks) 또는 기존 구조 (bookmarks) 모두 지원
            const bookmarks = userPref.interactions?.bookmarks || userPref.bookmarks || [];
            const likes = userPref.interactions?.likes || userPref.likes || [];
            
            console.log(`[INTERACTION STATUS] 북마크 목록: ${JSON.stringify(bookmarks)}`);
            console.log(`[INTERACTION STATUS] 좋아요 목록: ${JSON.stringify(likes)}`);

            const result = {
                bookmarked: bookmarks.includes(itemId),
                liked: likes.includes(itemId)
            };
            
            console.log(`[INTERACTION STATUS] 결과: ${JSON.stringify(result)}`);
            return result;
        } catch (error) {
            console.error('[INTERACTION STATUS] 사용자 상호작용 상태 조회 실패:', error);
            throw error;
        }
    }

    /**
     * 사용자 선호도 로드
     */
    async loadUserPreferences() {
        try {
            const data = await fs.readFile(this.userPreferencesFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return {};
        }
    }

    /**
     * 사용자 선호도 저장
     */
    async saveUserPreferences(preferences) {
        try {
            await fs.writeFile(this.userPreferencesFile, JSON.stringify(preferences, null, 2), 'utf8');
        } catch (error) {
            console.error('사용자 선호도 저장 실패:', error);
            throw error;
        }
    }

    /**
     * 수집 통계 조회
     */
    async getCollectionStats() {
        try {
            const data = await this.loadNutritionData();
            
            const stats = {
                totalItems: data.length,
                bySourceType: {},
                byCategory: {},
                recentCollections: []
            };

            // 소스 타입별 통계
            data.forEach(item => {
                stats.bySourceType[item.sourceType] = (stats.bySourceType[item.sourceType] || 0) + 1;
                stats.byCategory[item.category] = (stats.byCategory[item.category] || 0) + 1;
            });

            // 최근 수집된 항목들 (최근 10개)
            const sortedByDate = data
                .sort((a, b) => new Date(b.collectedDate) - new Date(a.collectedDate))
                .slice(0, 10);
            
            stats.recentCollections = sortedByDate.map(item => ({
                id: item.id,
                title: item.title,
                sourceType: item.sourceType,
                collectedDate: item.collectedDate
            }));

            return stats;
        } catch (error) {
            console.error('수집 통계 조회 실패:', error);
            throw error;
        }
    }

    /**
     * 영양 정보 상태 변경
     */
    async updateNutritionInfoStatus(itemId, isActive) {
        try {
            const updates = { isActive };
            const updatedItem = await this.updateNutritionInfo(itemId, updates);
            return updatedItem;
        } catch (error) {
            console.error('영양 정보 상태 변경 실패:', error);
            throw error;
        }
    }

}

module.exports = NutritionDataManager;
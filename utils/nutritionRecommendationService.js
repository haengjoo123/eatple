/**
 * 영양 정보 개인화 추천 서비스
 * Requirements: 6.1, 6.2, 6.3
 */

const fs = require('fs').promises;
const path = require('path');
const NutritionDataManager = require('./nutritionDataManager');

class NutritionRecommendationService {
    constructor() {
        this.nutritionDataManager = new NutritionDataManager();
        this.usersFile = path.join(__dirname, '../data/users.json');
        this.userPreferencesFile = path.join(__dirname, '../data/user-preferences.json');
        
        // 추천 가중치 설정
        this.weights = {
            categoryMatch: 0.3,      // 카테고리 일치도
            tagMatch: 0.25,          // 태그 일치도
            sourceTypeMatch: 0.15,   // 소스 타입 선호도
            trustScore: 0.15,        // 신뢰도 점수
            recency: 0.1,            // 최신성
            popularity: 0.05         // 인기도 (조회수, 좋아요)
        };
        
        // 기본 사용자 선호도
        this.defaultPreferences = {
            categories: ['diet', 'supplements', 'research'],
            sourceTypes: ['paper', 'news', 'youtube'],
            keywords: [],
            language: 'ko',
            minTrustScore: 60
        };
    }

    /**
     * 사용자 선호도 데이터 로드
     */
    async loadUserPreferences() {
        try {
            const data = await fs.readFile(this.userPreferencesFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.log('사용자 선호도 파일이 없거나 읽을 수 없습니다. 빈 객체를 반환합니다.');
            return {};
        }
    }

    /**
     * 사용자 선호도 데이터 저장
     */
    async saveUserPreferences(preferences) {
        try {
            await fs.writeFile(this.userPreferencesFile, JSON.stringify(preferences, null, 2));
        } catch (error) {
            console.error('사용자 선호도 저장 오류:', error);
            throw error;
        }
    }

    /**
     * 사용자 데이터 로드
     */
    async loadUsers() {
        try {
            const data = await fs.readFile(this.usersFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.log('사용자 파일이 없거나 읽을 수 없습니다. 빈 배열을 반환합니다.');
            return [];
        }
    }

    /**
     * 특정 사용자의 선호도 가져오기
     */
    async getUserPreferences(userId) {
        const allPreferences = await this.loadUserPreferences();
        const userPrefs = allPreferences[userId];
        
        if (!userPrefs) {
            // 기본 선호도 반환
            return {
                userId,
                preferences: { ...this.defaultPreferences },
                interactions: {
                    bookmarks: [],
                    likes: [],
                    views: []
                }
            };
        }
        
        return userPrefs;
    }

    /**
     * 사용자 선호도 업데이트
     */
    async updateUserPreferences(userId, preferences) {
        const allPreferences = await this.loadUserPreferences();
        
        if (!allPreferences[userId]) {
            allPreferences[userId] = {
                userId,
                preferences: { ...this.defaultPreferences },
                interactions: {
                    bookmarks: [],
                    likes: [],
                    views: []
                }
            };
        }
        
        // 선호도 업데이트
        allPreferences[userId].preferences = {
            ...allPreferences[userId].preferences,
            ...preferences
        };
        
        await this.saveUserPreferences(allPreferences);
        return allPreferences[userId];
    }

    /**
     * 사용자 상호작용 기록 (북마크, 좋아요, 조회)
     */
    async recordUserInteraction(userId, nutritionInfoId, interactionType) {
        const allPreferences = await this.loadUserPreferences();
        
        if (!allPreferences[userId]) {
            allPreferences[userId] = {
                userId,
                preferences: { ...this.defaultPreferences },
                interactions: {
                    bookmarks: [],
                    likes: [],
                    views: []
                }
            };
        }
        
        const interactions = allPreferences[userId].interactions;
        
        // 중복 방지
        if (!interactions[interactionType].includes(nutritionInfoId)) {
            interactions[interactionType].push(nutritionInfoId);
            
            // 최근 100개만 유지 (조회 기록의 경우)
            if (interactionType === 'views' && interactions[interactionType].length > 100) {
                interactions[interactionType] = interactions[interactionType].slice(-100);
            }
        }
        
        await this.saveUserPreferences(allPreferences);
        return allPreferences[userId];
    }

    /**
     * 사용자 상호작용 제거 (북마크 해제, 좋아요 취소)
     */
    async removeUserInteraction(userId, nutritionInfoId, interactionType) {
        const allPreferences = await this.loadUserPreferences();
        
        if (!allPreferences[userId]) {
            return null;
        }
        
        const interactions = allPreferences[userId].interactions;
        const index = interactions[interactionType].indexOf(nutritionInfoId);
        
        if (index > -1) {
            interactions[interactionType].splice(index, 1);
            await this.saveUserPreferences(allPreferences);
        }
        
        return allPreferences[userId];
    }

    /**
     * 추천 점수 계산
     */
    calculateRecommendationScore(nutritionInfo, userPreferences) {
        let score = 0;
        
        // 카테고리 일치도
        if (userPreferences.preferences.categories.includes(nutritionInfo.category)) {
            score += this.weights.categoryMatch;
        }
        
        // 태그 일치도
        const userKeywords = userPreferences.preferences.keywords || [];
        const matchingTags = nutritionInfo.tags.filter(tag => 
            userKeywords.some(keyword => 
                tag.toLowerCase().includes(keyword.toLowerCase()) ||
                keyword.toLowerCase().includes(tag.toLowerCase())
            )
        );
        const tagMatchRatio = matchingTags.length / Math.max(nutritionInfo.tags.length, 1);
        score += this.weights.tagMatch * tagMatchRatio;
        
        // 소스 타입 선호도
        if (userPreferences.preferences.sourceTypes.includes(nutritionInfo.sourceType)) {
            score += this.weights.sourceTypeMatch;
        }
        
        // 신뢰도 점수 (0-100을 0-1로 정규화)
        score += this.weights.trustScore * (nutritionInfo.trustScore / 100);
        
        // 최신성 (최근 30일 내 수집된 정보에 가산점)
        const daysSinceCollection = (Date.now() - new Date(nutritionInfo.collectedDate).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceCollection <= 30) {
            score += this.weights.recency * (1 - daysSinceCollection / 30);
        }
        
        // 인기도 (조회수와 좋아요 수 기반)
        const popularityScore = Math.min((nutritionInfo.viewCount + nutritionInfo.likeCount * 2) / 100, 1);
        score += this.weights.popularity * popularityScore;
        
        return Math.min(score, 1); // 최대 1.0으로 제한
    }

    /**
     * 사용자 맞춤 영양 정보 추천
     */
    async getRecommendedNutritionInfo(userId, limit = 20) {
        try {
            const userPreferences = await this.getUserPreferences(userId);
            
            // 모든 활성 영양 정보 가져오기
            const allNutritionInfo = await this.nutritionDataManager.getNutritionInfoList(
                { 
                    minTrustScore: userPreferences.preferences.minTrustScore,
                    isActive: true 
                },
                { limit: 1000 } // 충분히 많은 수를 가져와서 추천 알고리즘 적용
            );
            
            // 이미 본 정보는 제외 (최근 50개)
            const recentViews = userPreferences.interactions.views.slice(-50);
            const candidateInfo = allNutritionInfo.data.filter(info => 
                !recentViews.includes(info.id)
            );
            
            // 추천 점수 계산 및 정렬
            const scoredInfo = candidateInfo.map(info => ({
                ...info.toJSON(),
                recommendationScore: this.calculateRecommendationScore(info, userPreferences)
            }));
            
            // 점수 순으로 정렬하고 상위 항목 반환
            scoredInfo.sort((a, b) => b.recommendationScore - a.recommendationScore);
            
            return scoredInfo.slice(0, limit);
            
        } catch (error) {
            console.error('개인화 추천 생성 오류:', error);
            throw error;
        }
    }

    /**
     * 유사한 관심사를 가진 사용자들이 좋아한 정보 추천
     */
    async getCollaborativeRecommendations(userId, limit = 10) {
        try {
            const allPreferences = await this.loadUserPreferences();
            const targetUserPrefs = await this.getUserPreferences(userId);
            
            // 유사한 사용자 찾기
            const similarUsers = [];
            
            for (const [otherUserId, otherUserData] of Object.entries(allPreferences)) {
                if (otherUserId === userId) continue;
                
                // 카테고리 유사도 계산
                const commonCategories = targetUserPrefs.preferences.categories.filter(cat =>
                    otherUserData.preferences.categories.includes(cat)
                );
                const categorySimilarity = commonCategories.length / 
                    Math.max(targetUserPrefs.preferences.categories.length, otherUserData.preferences.categories.length);
                
                if (categorySimilarity > 0.3) { // 30% 이상 유사한 경우
                    similarUsers.push({
                        userId: otherUserId,
                        similarity: categorySimilarity,
                        likes: otherUserData.interactions.likes
                    });
                }
            }
            
            // 유사도 순으로 정렬
            similarUsers.sort((a, b) => b.similarity - a.similarity);
            
            // 유사한 사용자들이 좋아한 정보 수집
            const recommendedIds = new Set();
            const targetUserLikes = targetUserPrefs.interactions.likes;
            
            for (const similarUser of similarUsers.slice(0, 10)) { // 상위 10명의 유사 사용자
                for (const likedId of similarUser.likes) {
                    if (!targetUserLikes.includes(likedId)) {
                        recommendedIds.add(likedId);
                    }
                }
            }
            
            // 추천된 ID들의 실제 정보 가져오기
            const recommendations = [];
            for (const id of Array.from(recommendedIds).slice(0, limit)) {
                try {
                    const info = await this.nutritionDataManager.getNutritionInfoById(id);
                    if (info && info.isActive) {
                        recommendations.push(info.toJSON());
                    }
                } catch (error) {
                    console.log(`정보 ID ${id}를 찾을 수 없습니다:`, error.message);
                }
            }
            
            return recommendations;
            
        } catch (error) {
            console.error('협업 필터링 추천 생성 오류:', error);
            throw error;
        }
    }

    /**
     * 사용자 관심사 자동 업데이트 (상호작용 기반)
     */
    async updateUserInterestsFromInteractions(userId) {
        try {
            const userPrefs = await this.getUserPreferences(userId);
            const interactions = userPrefs.interactions;
            
            // 좋아요와 북마크한 정보들의 태그와 카테고리 분석
            const interactedIds = [...interactions.likes, ...interactions.bookmarks];
            const tagFrequency = {};
            const categoryFrequency = {};
            
            for (const id of interactedIds) {
                try {
                    const info = await this.nutritionDataManager.getNutritionInfoById(id);
                    if (info) {
                        // 카테고리 빈도 계산
                        categoryFrequency[info.category] = (categoryFrequency[info.category] || 0) + 1;
                        
                        // 태그 빈도 계산
                        for (const tag of info.tags) {
                            tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
                        }
                    }
                } catch (error) {
                    console.log(`정보 ID ${id}를 찾을 수 없습니다:`, error.message);
                }
            }
            
            // 빈도가 높은 태그들을 키워드로 추가
            const topTags = Object.entries(tagFrequency)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10)
                .map(([tag]) => tag);
            
            // 빈도가 높은 카테고리들을 선호 카테고리로 설정
            const topCategories = Object.entries(categoryFrequency)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5)
                .map(([category]) => category);
            
            // 선호도 업데이트
            const updatedPreferences = {
                ...userPrefs.preferences,
                keywords: [...new Set([...userPrefs.preferences.keywords, ...topTags])],
                categories: [...new Set([...topCategories, ...userPrefs.preferences.categories])]
            };
            
            await this.updateUserPreferences(userId, updatedPreferences);
            
            return updatedPreferences;
            
        } catch (error) {
            console.error('사용자 관심사 자동 업데이트 오류:', error);
            throw error;
        }
    }
}

module.exports = NutritionRecommendationService;
            
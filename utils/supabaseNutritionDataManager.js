/**
 * Supabase 기반 영양 정보 데이터 관리 유틸리티
 * Requirements: 6.1, 7.1 - 자동/수동 데이터 통합 조회
 */

const { supabase, supabaseAdmin } = require("./supabaseClient");
const NutritionInfo = require("../models/NutritionInfo");
const fs = require("fs").promises;
const path = require("path");

class SupabaseNutritionDataManager {
  constructor() {
    this.legacyDataFile = path.join(__dirname, "../data/nutrition-info.json");

    // 메모리 캐시
    this.cache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5분
  }

  /**
   * 영양 정보 목록 조회 (자동/수동 데이터 통합)
   * Requirements: 6.1, 7.1
   */
  async getNutritionInfoList(filters = {}, pagination = {}) {
    const cacheKey = `list_${JSON.stringify(filters)}_${JSON.stringify(
      pagination
    )}`;

    // 캐시 확인 (카테고리 필터링이 있을 때는 캐시 사용 안 함)
    if (!filters.category && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheExpiry) {
        return cached.data;
      }
    }

    try {
      // 카테고리 필터가 있는 경우, 먼저 카테고리 ID를 조회
      let categoryIds = null;
      if (filters.category) {
        const categoryNames = Array.isArray(filters.category) ? filters.category : [filters.category];
        const { data: categoryData } = await supabase
          .from("categories")
          .select("id")
          .in("name", categoryNames);
        
        if (categoryData && categoryData.length > 0) {
          categoryIds = categoryData.map(cat => cat.id);
        } else {
          // 해당 카테고리가 없으면 빈 결과 반환
          return {
            data: [],
            pagination: {
              page: pagination.page || 1,
              limit: pagination.limit || 20,
              total: 0,
              totalPages: 0,
            },
          };
        }
      }

      // Supabase에서 수동 포스팅 데이터 조회
      let supabaseQuery = supabase
        .from("nutrition_posts")
        .select(
          `
                    *,
                    categories(name),
                    post_tags(tags(name))
                `
        )
        .eq("is_active", true);

      // 필터링 적용
      if (filters.search) {
        supabaseQuery = supabaseQuery.or(
          `title.ilike.%${filters.search}%,summary.ilike.%${filters.search}%,content.ilike.%${filters.search}%`
        );
      }
      if (categoryIds) {
        supabaseQuery = supabaseQuery.in("category_id", categoryIds);
      }
      if (filters.sourceType) {
        if (Array.isArray(filters.sourceType)) {
          supabaseQuery = supabaseQuery.in("source_type", filters.sourceType);
        } else {
          supabaseQuery = supabaseQuery.eq("source_type", filters.sourceType);
        }
      }
      if (filters.minTrustScore) {
        supabaseQuery = supabaseQuery.gte("trust_score", filters.minTrustScore);
      }
      if (filters.maxTrustScore) {
        supabaseQuery = supabaseQuery.lte("trust_score", filters.maxTrustScore);
      }
      if (filters.dateFrom) {
        supabaseQuery = supabaseQuery.gte("published_date", filters.dateFrom);
      }
      if (filters.dateTo) {
        supabaseQuery = supabaseQuery.lte("published_date", filters.dateTo);
      }

      // 정렬
      const sortBy = filters.sortBy || "published_date";
      const sortOrder = filters.sortOrder || "desc";
      const ascending = sortOrder === "asc";

      // 컬럼명 매핑 (camelCase -> snake_case)
      const columnMapping = {
        collectedDate: "collected_date",
        publishedDate: "published_date",
        sourceType: "source_type",
        trustScore: "trust_score",
        viewCount: "view_count",
        likeCount: "like_count",
        bookmarkCount: "bookmark_count",
        imageUrl: "image_url",
        thumbnailUrl: "thumbnail_url",
        sourceUrl: "source_url",
        sourceName: "source_name",
        originalContent: "content",
      };

      const mappedSortBy = columnMapping[sortBy] || sortBy;

      supabaseQuery = supabaseQuery.order(mappedSortBy, { ascending });

      const { data: supabaseData, error: supabaseError } = await supabaseQuery;

      if (supabaseError) {
        console.error("Supabase 데이터 조회 오류:", supabaseError);
      }

      // 레거시 JSON 데이터 조회
      const legacyData = await this.loadLegacyData();
      let filteredLegacyData = legacyData.filter((item) => item.isActive);

      // 레거시 데이터에 필터링 적용
      if (filters.search) {
        const searchTerms = filters.search.toLowerCase().split(" ");
        filteredLegacyData = filteredLegacyData.filter((item) => {
          const searchableText = [
            item.title,
            item.summary,
            item.author,
            item.sourceName,
            ...item.tags,
          ]
            .join(" ")
            .toLowerCase();

          const normalizedSearchableText = searchableText.normalize("NFC");

          return searchTerms.every((term) => {
            const normalizedTerm = term.normalize("NFC");
            return normalizedSearchableText.includes(normalizedTerm);
          });
        });
      }
      if (filters.category) {
        if (Array.isArray(filters.category)) {
          filteredLegacyData = filteredLegacyData.filter((item) =>
            filters.category.includes(item.category)
          );
        } else {
          filteredLegacyData = filteredLegacyData.filter(
            (item) => item.category === filters.category
          );
        }
      }
      if (filters.sourceType) {
        if (Array.isArray(filters.sourceType)) {
          filteredLegacyData = filteredLegacyData.filter((item) =>
            filters.sourceType.includes(item.sourceType)
          );
        } else {
          filteredLegacyData = filteredLegacyData.filter(
            (item) => item.sourceType === filters.sourceType
          );
        }
      }
      if (filters.tags && filters.tags.length > 0) {
        filteredLegacyData = filteredLegacyData.filter((item) =>
          filters.tags.some((tag) => item.tags.includes(tag))
        );
      }
      if (filters.minTrustScore) {
        filteredLegacyData = filteredLegacyData.filter(
          (item) => item.trustScore >= filters.minTrustScore
        );
      }
      if (filters.maxTrustScore) {
        filteredLegacyData = filteredLegacyData.filter(
          (item) => item.trustScore <= filters.maxTrustScore
        );
      }
      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        filteredLegacyData = filteredLegacyData.filter(
          (item) => new Date(item.collectedDate) >= fromDate
        );
      }
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        filteredLegacyData = filteredLegacyData.filter(
          (item) => new Date(item.collectedDate) <= toDate
        );
      }

      // Supabase 데이터를 NutritionInfo 형식으로 변환
      const convertedSupabaseData = (supabaseData || []).map((item) =>
        this.convertSupabaseToNutritionInfo(item)
      );

      // 데이터 통합
      const combinedData = [...convertedSupabaseData, ...filteredLegacyData];

      // 통합 데이터 정렬
      combinedData.sort((a, b) => {
        // 컬럼명 매핑 적용
        const columnMapping = {
          collectedDate: "collectedDate",
          publishedDate: "publishedDate",
          sourceType: "sourceType",
          trustScore: "trustScore",
          viewCount: "viewCount",
          likeCount: "likeCount",
          bookmarkCount: "bookmarkCount",
        };

        const mappedSortBy = columnMapping[sortBy] || sortBy;

        let aValue = a[mappedSortBy] || a.collectedDate;
        let bValue = b[mappedSortBy] || b.collectedDate;

        if (mappedSortBy.includes("Date") || mappedSortBy.includes("date")) {
          aValue = new Date(aValue);
          bValue = new Date(bValue);
        }

        if (sortOrder === "desc") {
          return bValue > aValue ? 1 : -1;
        } else {
          return aValue > bValue ? 1 : -1;
        }
      });

      // 페이지네이션
      const page = pagination.page || 1;
      const limit = pagination.limit || 20;
      const offset = (page - 1) * limit;

      const paginatedData = combinedData.slice(offset, offset + limit);

      const result = {
        data: paginatedData.map((item) => {
          if (item instanceof NutritionInfo) {
            return item;
          }
          return NutritionInfo.fromJSON(item);
        }),
        pagination: {
          page: page,
          limit: limit,
          total: combinedData.length,
          totalPages: Math.ceil(combinedData.length / limit),
        },
      };

      // 캐시 저장
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
      });

      return result;
    } catch (error) {
      console.error("영양 정보 목록 조회 오류:", error);
      throw error;
    }
  }

  /**
   * ID로 영양 정보 조회 (자동/수동 데이터 통합)
   * Requirements: 6.2
   */
  async getNutritionInfoById(id) {
    try {
      // Supabase에서 먼저 조회 (관련 상품 정보 포함)
      const { data: supabaseData, error: supabaseError } = await supabase
        .from("nutrition_posts")
        .select(
          `
                    *,
                    categories(name),
                    post_tags(tags(name)),
                    post_related_products(id, product_name, product_link, display_order)
                `
        )
        .eq("id", id)
        .single();

      if (!supabaseError && supabaseData) {
        // 관련 상품 정보 처리
        const relatedProducts = supabaseData.post_related_products || [];
        
        const nutritionInfo = this.convertSupabaseToNutritionInfo(supabaseData);
        nutritionInfo.related_products = relatedProducts.sort((a, b) => a.display_order - b.display_order);
        
        
        return NutritionInfo.fromJSON(nutritionInfo);
      }

      // 레거시 데이터에서 조회
      const legacyData = await this.loadLegacyData();
      const item = legacyData.find((item) => item.id === id);

      if (!item) {
        return null;
      }

      return NutritionInfo.fromJSON(item);
    } catch (error) {
      console.error("영양 정보 조회 오류:", error);
      throw error;
    }
  }

  /**
   * 영양 정보 검색 (자동/수동 데이터 통합)
   * Requirements: 6.3
   */
  async searchNutritionInfo(query, filters = {}) {
    try {
      // 검색을 위한 필터 설정
      const searchFilters = { ...filters, search: query };

      // 통합 목록 조회 사용
      const result = await this.getNutritionInfoList(searchFilters);

      return {
        data: result.data,
        pagination: result.pagination,
      };
    } catch (error) {
      console.error("영양 정보 검색 오류:", error);
      throw error;
    }
  }

  /**
   * 통계 정보 조회 (자동/수동 데이터 통합)
   * Requirements: 6.1
   */
  async getStatistics() {
    try {
      // Supabase 데이터 통계
      const { data: supabaseStats, error: supabaseError } = await supabase
        .from("nutrition_posts")
        .select(
          "category_id, source_type, trust_score, view_count, like_count, bookmark_count"
        )
        .eq("is_active", true);

      // 레거시 데이터 통계
      const legacyData = await this.loadLegacyData();
      const activeLegacyData = legacyData.filter((item) => item.isActive);

      const stats = {
        totalItems: (supabaseStats?.length || 0) + activeLegacyData.length,
        activeItems: (supabaseStats?.length || 0) + activeLegacyData.length,
        inactiveItems: 0,
        byCategory: {},
        bySourceType: {},
        averageTrustScore: 0,
        totalViews: 0,
        totalLikes: 0,
        totalBookmarks: 0,
      };

      let trustScoreSum = 0;
      let totalItems = 0;

      // Supabase 데이터 처리
      if (supabaseStats && !supabaseError) {
        supabaseStats.forEach((item) => {
          const category = item.category_id || "unknown";
          const sourceType = item.source_type || "unknown";

          stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
          stats.bySourceType[sourceType] =
            (stats.bySourceType[sourceType] || 0) + 1;

          trustScoreSum += item.trust_score || 0;
          stats.totalViews += item.view_count || 0;
          stats.totalLikes += item.like_count || 0;
          stats.totalBookmarks += item.bookmark_count || 0;
          totalItems++;
        });
      }

      // 레거시 데이터 처리
      activeLegacyData.forEach((item) => {
        stats.byCategory[item.category] =
          (stats.byCategory[item.category] || 0) + 1;
        stats.bySourceType[item.sourceType] =
          (stats.bySourceType[item.sourceType] || 0) + 1;

        trustScoreSum += item.trustScore;
        stats.totalViews += item.viewCount;
        stats.totalLikes += item.likeCount;
        stats.totalBookmarks += item.bookmarkCount;
        totalItems++;
      });

      stats.averageTrustScore = totalItems > 0 ? trustScoreSum / totalItems : 0;

      return stats;
    } catch (error) {
      console.error("통계 정보 조회 오류:", error);
      throw error;
    }
  }

  /**
   * Supabase 데이터를 NutritionInfo 형식으로 변환
   */
  convertSupabaseToNutritionInfo(supabaseItem) {
    const tags = supabaseItem.post_tags
      ? supabaseItem.post_tags.map((pt) => pt.tags.name)
      : [];

    return {
      id: supabaseItem.id,
      title: supabaseItem.title,
      summary: supabaseItem.summary,
      content: supabaseItem.content,
      originalContent: supabaseItem.content, // 기존 호환성을 위해 유지
      sourceType: supabaseItem.source_type,
      sourceUrl: supabaseItem.source_url,
      sourceName: supabaseItem.source_name,
      author: supabaseItem.author,
      publishedDate: supabaseItem.published_date,
      collectedDate: supabaseItem.collected_date,
      trustScore: supabaseItem.trust_score,
      category: supabaseItem.categories?.name || supabaseItem.category_id,
      tags: tags,
      imageUrl: supabaseItem.image_url,
      thumbnailUrl: supabaseItem.thumbnail_url, // 썸네일 URL 추가
      language: supabaseItem.language,
      isActive: supabaseItem.is_active,
      viewCount: supabaseItem.view_count,
      likeCount: supabaseItem.like_count,
      bookmarkCount: supabaseItem.bookmark_count,
      isManualPost: supabaseItem.is_manual_post || false,
      adminId: supabaseItem.admin_id,
      adminName: supabaseItem.admin_name,
    };
  }

  /**
   * 레거시 JSON 데이터 로드
   */
  async loadLegacyData() {
    try {
      const data = await fs.readFile(this.legacyDataFile, "utf8");

      // 빈 파일 처리
      if (!data || data.trim() === "") {
        console.log("레거시 데이터 파일이 비어있음, 빈 배열 반환");
        return [];
      }

      const parsed = JSON.parse(data);

      if (!parsed || typeof parsed !== "object") {
        return [];
      }

      if (!Array.isArray(parsed)) {
        return Object.values(parsed);
      }

      return parsed;
    } catch (error) {
      console.error("레거시 데이터 로드 실패:", error);
      // 파일이 없거나 파싱 실패 시 빈 배열 반환
      return [];
    }
  }

  /**
   * 캐시 무효화
   */
  invalidateCache() {
    console.log(`🧹 SupabaseNutritionDataManager 캐시 무효화: ${this.cache.size}개 항목 삭제`);
    this.cache.clear();
  }

  /**
   * 특정 키 패턴의 캐시 무효화
   */
  invalidateCacheByPattern(pattern) {
    let deletedCount = 0;
    for (const [key, value] of this.cache.entries()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        deletedCount++;
      }
    }
    console.log(`🧹 패턴 '${pattern}'으로 ${deletedCount}개 캐시 항목 삭제`);
  }

  /**
   * 카테고리 목록 조회 (Supabase + 레거시 통합)
   * Requirements: 6.1
   */
  async getCategories() {
    try {
      // Supabase 카테고리 조회
      const { data: supabaseCategories, error } = await supabase
        .from("categories")
        .select("name, post_count");

      const categories = new Map();

      // Supabase 카테고리 추가
      if (!error && supabaseCategories) {
        supabaseCategories.forEach((cat) => {
          categories.set(cat.name, cat.post_count || 0);
        });
      }

      // 레거시 데이터에서 카테고리 추출
      const legacyData = await this.loadLegacyData();
      const activeLegacyData = legacyData.filter((item) => item.isActive);

      activeLegacyData.forEach((item) => {
        const category = item.category;
        if (category) {
          const currentCount = categories.get(category) || 0;
          categories.set(category, currentCount + 1);
        }
      });

      // 결과 배열로 변환
      return Array.from(categories.entries()).map(([name, count]) => ({
        name,
        count,
      }));
    } catch (error) {
      console.error("카테고리 목록 조회 오류:", error);
      throw error;
    }
  }

  /**
   * 태그 통계 조회 (Supabase + 레거시 통합)
   * Requirements: 6.3
   */
  async getTagStats() {
    try {
      // Supabase 태그 조회
      const { data: supabaseTags, error } = await supabase
        .from("tags")
        .select("name, post_count");

      const tags = new Map();

      // Supabase 태그 추가
      if (!error && supabaseTags) {
        supabaseTags.forEach((tag) => {
          tags.set(tag.name, tag.post_count || 0);
        });
      }

      // 레거시 데이터에서 태그 추출
      const legacyData = await this.loadLegacyData();
      const activeLegacyData = legacyData.filter((item) => item.isActive);

      activeLegacyData.forEach((item) => {
        if (item.tags && Array.isArray(item.tags)) {
          item.tags.forEach((tag) => {
            const currentCount = tags.get(tag) || 0;
            tags.set(tag, currentCount + 1);
          });
        }
      });

      // 결과 배열로 변환 (사용 빈도 순 정렬)
      return Array.from(tags.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
    } catch (error) {
      console.error("태그 통계 조회 오류:", error);
      throw error;
    }
  }

  /**
   * 조회수 증가 (Supabase 또는 레거시)
   */
  async incrementViewCount(itemId) {
    try {
      // Supabase에서 먼저 시도
      const { data: supabaseData, error: supabaseError } = await supabase
        .from("nutrition_posts")
        .select("view_count")
        .eq("id", itemId)
        .single();

      if (!supabaseError && supabaseData) {
        // Supabase 데이터 업데이트
        const { error: updateError } = await supabase
          .from("nutrition_posts")
          .update({ view_count: (supabaseData.view_count || 0) + 1 })
          .eq("id", itemId);

        if (updateError) {
          console.error("Supabase 조회수 업데이트 오류:", updateError);
        }
        return;
      }

      // 레거시 데이터에서 처리 (기존 nutritionDataManager 사용)
      const legacyManager = require("./nutritionDataManager");
      const manager = new legacyManager();
      await manager.incrementViewCount(itemId);
    } catch (error) {
      console.error("조회수 증가 오류:", error);
      throw error;
    }
  }

  /**
   * 영양 정보 업데이트 (Supabase 또는 레거시)
   */
  async updateNutritionInfo(itemId, updateData) {
    try {
      // Supabase에서 먼저 시도
      const { data: supabaseData, error: supabaseError } = await supabase
        .from("nutrition_posts")
        .select("id")
        .eq("id", itemId)
        .single();

      if (!supabaseError && supabaseData) {
        // Supabase 데이터 업데이트
        const supabaseUpdateData = {};

        // 필드명 매핑 (camelCase -> snake_case)
        if (updateData.viewCount !== undefined)
          supabaseUpdateData.view_count = updateData.viewCount;
        if (updateData.likeCount !== undefined)
          supabaseUpdateData.like_count = updateData.likeCount;
        if (updateData.bookmarkCount !== undefined)
          supabaseUpdateData.bookmark_count = updateData.bookmarkCount;
        if (updateData.trustScore !== undefined)
          supabaseUpdateData.trust_score = updateData.trustScore;
        if (updateData.title !== undefined)
          supabaseUpdateData.title = updateData.title;
        if (updateData.summary !== undefined)
          supabaseUpdateData.summary = updateData.summary;
        if (updateData.content !== undefined)
          supabaseUpdateData.content = updateData.content;
        if (updateData.isActive !== undefined)
          supabaseUpdateData.is_active = updateData.isActive;

        const { error: updateError } = await supabase
          .from("nutrition_posts")
          .update(supabaseUpdateData)
          .eq("id", itemId);

        if (updateError) {
          console.error("Supabase 데이터 업데이트 오류:", updateError);
          throw updateError;
        }

        // 캐시 무효화
        this.invalidateCache();
        return true;
      }

      // 레거시 데이터에서 처리 (기존 nutritionDataManager 사용)
      const legacyManager = require("./nutritionDataManager");
      const manager = new legacyManager();
      const result = await manager.updateNutritionInfo(itemId, updateData);

      // 캐시 무효화
      this.invalidateCache();
      return result;
    } catch (error) {
      console.error("영양 정보 업데이트 오류:", error);
      throw error;
    }
  }

  /**
   * 사용자 상호작용 상태 조회 (Supabase 통합)
   * Requirements: 6.4
   */
  async getUserInteractionStatus(nutritionInfoId, userId) {
    try {
      // 기본 상태
      const status = {
        bookmarked: false,
        liked: false,
      };

      if (!userId) {
        return status;
      }

      // Supabase에서 사용자 상호작용 상태 조회
      // 실제 구현에서는 user_interactions 테이블을 조회해야 함
      // 현재는 recommendationService를 통해 조회
      const recommendationService = require("./nutritionRecommendationService");
      const service = new recommendationService();

      try {
        const userPrefs = await service.getUserPreferences(userId);
        if (userPrefs && userPrefs.interactions) {
          status.bookmarked =
            userPrefs.interactions.bookmarks.includes(nutritionInfoId);
          status.liked = userPrefs.interactions.likes.includes(nutritionInfoId);
        }
      } catch (prefError) {
        console.log("사용자 선호도 조회 실패:", prefError);
        // 실패해도 기본 상태 반환
      }

      return status;
    } catch (error) {
      console.error("사용자 상호작용 상태 조회 오류:", error);
      // 오류 발생 시 기본 상태 반환
      return {
        bookmarked: false,
        liked: false,
      };
    }
  }
}

module.exports = SupabaseNutritionDataManager;

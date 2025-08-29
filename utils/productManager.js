/**
 * Product Management Utility
 * Handles CRUD operations for shop products with performance optimization
 * Requirements: 2.2, 2.3, 4.2, 4.3, 7.1, 7.2, 3.3, 3.4, 6.4, 8.1, 8.2
 */

const { supabase, supabaseAdmin } = require("./supabaseClient");
const { getCacheManager } = require("./cacheManager");
const { getDatabaseOptimizer } = require("./databaseOptimizer");

class ProductManager {
  constructor() {
    this.cache = getCacheManager();
    this.dbOptimizer = getDatabaseOptimizer();

    // Search debounce settings
    this.searchDebounceTime = 300;
    this.searchTimeouts = new Map();

    // Pagination optimization
    this.defaultPageSize = 20;
    this.maxPageSize = 100;

    // Initialize database optimization
    this.initializeOptimization();
  }

  async initializeOptimization() {
    try {
      // Create optimal indexes on first run
      await this.dbOptimizer.createOptimalIndexes();
    } catch (error) {
      console.warn("Could not create database indexes:", error.message);
    }
  }

  /**
   * 상품 생성 (Enhanced validation)
   * Requirements: 2.2, 2.3, 2.4, 2.5, 7.1
   */
  async createProduct(productData) {
    try {
      // 디버깅: 받은 데이터 확인
      console.log("🔍 [DEBUG] ProductManager.createProduct 호출됨");
      console.log("🔍 [DEBUG] 받은 productData:", productData);
      console.log("🔍 [DEBUG] productData.summary:", productData.summary);
      console.log(
        "🔍 [DEBUG] productData.summary 타입:",
        typeof productData.summary
      );

      // 종합 검증 (데이터 + 비즈니스 로직)
      await this.validateProduct(productData, false);

      // 상품 생성
      console.log('🔍 [DEBUG] 받은 productData.originalPrice:', productData.originalPrice);
      console.log('🔍 [DEBUG] originalPrice 타입:', typeof productData.originalPrice);
      
      const insertData = {
        name: productData.name.trim(),
        summary: productData.summary?.trim() || null,
        description: productData.description?.trim() || null,
        price: parseInt(productData.price),
        originalPrice: productData.originalPrice
          ? parseInt(productData.originalPrice)
          : null,
        category: productData.category.trim(),
        image_url: productData.image_url || null,
        image_path: productData.image_path || null,
        status: productData.status || "active",
        created_by: productData.created_by,
      };
      
      console.log('🔍 [DEBUG] 저장할 insertData.originalPrice:', insertData.originalPrice);

      console.log("🔍 [DEBUG] DB에 삽입할 데이터:", insertData);
      console.log("🔍 [DEBUG] insertData.summary:", insertData.summary);

      const { data, error } = await supabaseAdmin
        .from("products")
        .insert([insertData])
        .select()
        .single();

      if (error) {
        console.error("🔍 [DEBUG] DB 삽입 오류:", error);
        throw new Error(`Database error: ${error.message}`);
      }

      console.log("🔍 [DEBUG] DB 삽입 성공, 반환된 데이터:", data);

      // 캐시 무효화
      this.clearCache();

      return data;
    } catch (error) {
      console.error("ProductManager.createProduct error:", error);
      throw error;
    }
  }

  /**
   * 상품 목록 조회 (관리자용) - Optimized with caching and database optimization
   * Requirements: 4.2, 7.1, 3.3, 3.4
   */
  async getProducts(filters = {}, options = {}) {
    // Optimize pagination parameters
    const page = Math.max(1, parseInt(options.page) || 1);
    const limit = Math.min(
      this.maxPageSize,
      Math.max(1, parseInt(options.limit) || this.defaultPageSize)
    );
    const sortBy = options.sortBy || "created_at";
    const sortOrder = options.sortOrder || "desc";

    // Create cache key with normalized parameters
    const normalizedFilters = this.normalizeFilters(filters);
    const cacheParams = {
      ...normalizedFilters,
      page,
      limit,
      sortBy,
      sortOrder,
    };

    // Try cache first with warming
    const cached = await this.cache.warmCache(
      "products",
      "list",
      async () => {
        return await this.fetchProductsFromDatabase(normalizedFilters, {
          page,
          limit,
          sortBy,
          sortOrder,
        });
      },
      cacheParams
    );

    if (cached) {
      return cached;
    }

    // Fetch from database with optimization
    return await this.fetchProductsFromDatabase(normalizedFilters, {
      page,
      limit,
      sortBy,
      sortOrder,
    });
  }

  /**
   * Fetch products from database with optimization
   */
  async fetchProductsFromDatabase(filters, options) {
    try {
      // Build optimized query
      let query = supabaseAdmin
        .from("products")
        .select("*", { count: "exact" });

      // Apply filters with optimization
      query = this.applyOptimizedFilters(query, filters);

      // Apply sorting with index optimization
      const indexedColumns = [
        "created_at",
        "updated_at",
        "category",
        "status",
        "view_count",
      ];
      if (indexedColumns.includes(options.sortBy)) {
        query = query.order(options.sortBy, {
          ascending: options.sortOrder === "asc",
        });
      } else {
        // Fallback to default indexed column
        query = query.order("created_at", { ascending: false });
      }

      // Apply pagination
      const offset = (options.page - 1) * options.limit;
      query = query.range(offset, offset + options.limit - 1);

      // Execute with performance monitoring
      const { data, error, count } = await this.dbOptimizer.executeQuery(
        query,
        "getProducts",
        {
          useIndex: true,
          selectColumns: ["*"],
          orderBy: options.sortBy,
          ascending: options.sortOrder === "asc",
          indexedColumns,
        }
      );

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      const result = {
        products: data || [],
        page: options.page,
        limit: options.limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / options.limit),
      };

      // Cache the result
      this.cache.set("products", "list", result, {
        ...filters,
        page: options.page,
        limit: options.limit,
        sortBy: options.sortBy,
        sortOrder: options.sortOrder,
      });

      return result;
    } catch (error) {
      console.error("ProductManager.fetchProductsFromDatabase error:", error);
      throw error;
    }
  }

  /**
   * Apply optimized filters to query
   */
  applyOptimizedFilters(query, filters) {
    // Search optimization - use simple ILIKE for now to avoid full-text search issues
    if (filters.search && filters.search.trim()) {
      const searchTerm = filters.search.trim();
      // Use ILIKE for all search queries to avoid textSearch issues
      query = query.or(
        `name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`
      );
    }

    // Category filter (indexed)
    if (filters.category && filters.category.trim()) {
      query = query.eq("category", filters.category.trim());
    }

    // Status filter (indexed)
    if (filters.status && filters.status.trim()) {
      query = query.eq("status", filters.status.trim());
    }

    // Date range filters
    if (filters.startDate) {
      query = query.gte("created_at", filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte("created_at", filters.endDate);
    }

    return query;
  }

  /**
   * Normalize filters for consistent caching
   */
  normalizeFilters(filters) {
    return {
      search: filters.search?.trim() || "",
      category: filters.category?.trim() || "",
      status: filters.status?.trim() || "",
      startDate: filters.startDate || "",
      endDate: filters.endDate || "",
    };
  }

  /**
   * 단일 상품 조회
   * Requirements: 4.2, 7.1
   */
  async getProductById(productId) {
    try {
      const { data, error } = await supabaseAdmin
        .from("products")
        .select("*")
        .eq("id", productId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null;
        }
        throw new Error(`Database error: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error("ProductManager.getProductById error:", error);
      throw error;
    }
  }

  /**
   * 상품 업데이트 (Enhanced validation)
   * Requirements: 4.3, 4.4, 4.5, 7.1
   */
  async updateProduct(productId, updateData) {
    try {
      // 디버깅: 받은 데이터 확인
      console.log("🔍 [DEBUG] ProductManager.updateProduct 호출됨");
      console.log("🔍 [DEBUG] productId:", productId);
      console.log("🔍 [DEBUG] 받은 updateData:", updateData);
      console.log("🔍 [DEBUG] updateData.summary:", updateData.summary);
      console.log(
        "🔍 [DEBUG] updateData.summary 타입:",
        typeof updateData.summary
      );

      // 기존 상품 확인
      const existingProduct = await this.getProductById(productId);
      if (!existingProduct) {
        const error = new Error("상품을 찾을 수 없습니다.");
        error.type = "NOT_FOUND_ERROR";
        throw error;
      }

      // 종합 검증 (데이터 + 비즈니스 로직)
      await this.validateProduct(updateData, true, existingProduct);

      // 업데이트 데이터 준비
      const updateFields = {
        updated_at: new Date().toISOString(),
      };

      if (updateData.name !== undefined)
        updateFields.name = updateData.name.trim();
      if (updateData.summary !== undefined)
        updateFields.summary = updateData.summary?.trim() || null;
      if (updateData.description !== undefined)
        updateFields.description = updateData.description?.trim() || null;
      if (updateData.price !== undefined)
        updateFields.price = parseInt(updateData.price);
      if (updateData.originalPrice !== undefined) {
        console.log('🔍 [DEBUG] 업데이트할 originalPrice:', updateData.originalPrice);
        console.log('🔍 [DEBUG] originalPrice 타입:', typeof updateData.originalPrice);
        updateFields.originalPrice = updateData.originalPrice
          ? parseInt(updateData.originalPrice)
          : null;
        console.log('🔍 [DEBUG] 업데이트할 originalPrice 값:', updateFields.originalPrice);
      }
      if (updateData.category !== undefined)
        updateFields.category = updateData.category.trim();
      if (updateData.image_url !== undefined)
        updateFields.image_url = updateData.image_url;
      if (updateData.image_path !== undefined)
        updateFields.image_path = updateData.image_path;
      if (updateData.status !== undefined)
        updateFields.status = updateData.status;

      console.log("🔍 [DEBUG] DB에 업데이트할 데이터:", updateFields);
      console.log("🔍 [DEBUG] updateFields.summary:", updateFields.summary);

      const { data, error } = await supabaseAdmin
        .from("products")
        .update(updateFields)
        .eq("id", productId)
        .select()
        .single();

      if (error) {
        console.error("🔍 [DEBUG] DB 업데이트 오류:", error);
        throw new Error(`Database error: ${error.message}`);
      }

      console.log("🔍 [DEBUG] DB 업데이트 성공, 반환된 데이터:", data);

      // 캐시 무효화
      this.clearCache();

      return data;
    } catch (error) {
      console.error("ProductManager.updateProduct error:", error);
      throw error;
    }
  }

  /**
   * 상품 삭제
   * Requirements: 4.3, 7.1, 7.2
   */
  async deleteProduct(productId) {
    try {
      // 기존 상품 확인
      const existingProduct = await this.getProductById(productId);
      if (!existingProduct) {
        return false;
      }

      // 이미지가 있는 경우 삭제
      if (existingProduct.image_path) {
        try {
          const ImageUploadHandler = require("./imageUploadHandler");
          const imageHandler = new ImageUploadHandler();
          await imageHandler.deleteProductImage(existingProduct.image_path);
        } catch (imageError) {
          console.warn("Failed to delete product image:", imageError);
          // 이미지 삭제 실패해도 상품 삭제는 계속 진행
        }
      }

      const { error } = await supabaseAdmin
        .from("products")
        .delete()
        .eq("id", productId);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      // 캐시 무효화
      this.clearCache();

      return true;
    } catch (error) {
      console.error("ProductManager.deleteProduct error:", error);
      throw error;
    }
  }

  /**
   * 고객용 활성 상품 목록 조회 - Optimized with caching and lazy loading
   * Requirements: 7.1, 8.1, 8.2
   */
  async getActiveProducts(filters = {}) {
    const normalizedFilters = {
      category: filters.category?.trim() || "",
      limit: Math.min(50, parseInt(filters.limit) || 20),
      offset: Math.max(0, parseInt(filters.offset) || 0),
    };

    try {
      // Optimized query for customer-facing products
      let query = supabaseAdmin
        .from("products")
        .select(
          "id, name, description, summary, price, originalPrice, category, image_url, status, view_count, brand, shipping_fee, created_at"
        )
        .eq("status", "active");

      // Apply category filter if specified
      if (normalizedFilters.category) {
        query = query.eq("category", normalizedFilters.category);
      }

      // Optimize sorting for customer view (popular products first)
      query = query
        .order("view_count", { ascending: false })
        .order("created_at", { ascending: false });

      // Apply pagination for lazy loading
      if (normalizedFilters.limit) {
        query = query.range(
          normalizedFilters.offset,
          normalizedFilters.offset + normalizedFilters.limit - 1
        );
      }

      // Execute query directly
      const { data, error } = await query;

      if (error) {
        console.error(
          "ProductManager.getActiveProducts database error:",
          error
        );
        throw new Error(`Database error: ${error.message}`);
      }

      // 할인율 계산 및 추가
      const productsWithDiscount = (data || []).map(product => {
        let discountRate = 0;
        if (product.originalPrice && product.originalPrice > product.price) {
          discountRate = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
        }
        
        return {
          ...product,
          discount_rate: discountRate
        };
      });

      return {
        success: true,
        data: productsWithDiscount,
        hasMore: data && data.length === normalizedFilters.limit,
        nextOffset: normalizedFilters.offset + normalizedFilters.limit,
      };
    } catch (error) {
      console.error("ProductManager.getActiveProducts error:", error);
      return {
        success: false,
        error: error.message,
        message: "상품 목록 조회에 실패했습니다.",
        data: [],
      };
    }
  }

  /**
   * 신상품 조회 (3일 이내 등록된 상품)
   * Requirements: 8.1, 8.2
   */
  async getNewProducts(filters = {}) {
    const normalizedFilters = {
      category: filters.category?.trim() || "",
      limit: Math.min(50, parseInt(filters.limit) || 20),
      offset: Math.max(0, parseInt(filters.offset) || 0),
    };

    try {
      // 3일 전 날짜 계산
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const threeDaysAgoISO = threeDaysAgo.toISOString();

      // 3일 이내 등록된 상품만 조회
      let query = supabaseAdmin
        .from("products")
        .select(
          "id, name, description, summary, price, originalPrice, category, image_url, status, view_count, brand, shipping_fee, created_at"
        )
        .eq("status", "active")
        .gte("created_at", threeDaysAgoISO);

      // Apply category filter if specified
      if (normalizedFilters.category) {
        query = query.eq("category", normalizedFilters.category);
      }

      // 최신 등록 순으로 정렬
      query = query.order("created_at", { ascending: false });

      // Apply pagination for lazy loading
      if (normalizedFilters.limit) {
        query = query.range(
          normalizedFilters.offset,
          normalizedFilters.offset + normalizedFilters.limit - 1
        );
      }

      // Execute query directly
      const { data, error } = await query;

      if (error) {
        console.error(
          "ProductManager.getNewProducts database error:",
          error
        );
        throw new Error(`Database error: ${error.message}`);
      }

      // 할인율 계산 및 추가
      const productsWithDiscount = (data || []).map(product => {
        let discountRate = 0;
        if (product.originalPrice && product.originalPrice > product.price) {
          discountRate = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
        }
        
        return {
          ...product,
          discount_rate: discountRate
        };
      });

      return {
        success: true,
        data: productsWithDiscount,
        hasMore: data && data.length === normalizedFilters.limit,
        nextOffset: normalizedFilters.offset + normalizedFilters.limit,
      };
    } catch (error) {
      console.error("ProductManager.getNewProducts error:", error);
      return {
        success: false,
        error: error.message,
        message: "신상품 목록 조회에 실패했습니다.",
        data: [],
      };
    }
  }

  /**
   * 베스트 상품 조회 (판매율 상위 20개)
   * Requirements: 8.1, 8.2
   */
  async getBestProducts(filters = {}) {
    const normalizedFilters = {
      category: filters.category?.trim() || "",
      limit: 20, // 베스트 상품은 항상 상위 20개만
    };

    try {
      // 판매율 기준으로 상위 20개 상품 조회
      let query = supabaseAdmin
        .from("products")
        .select(
          "id, name, description, summary, price, originalPrice, category, image_url, status, view_count, brand, shipping_fee, created_at"
        )
        .eq("status", "active");

      // Apply category filter if specified
      if (normalizedFilters.category) {
        query = query.eq("category", normalizedFilters.category);
      }

      // 판매율 기준으로 정렬 (view_count를 판매율 대용으로 사용)
      query = query.order("view_count", { ascending: false });

      // 상위 20개만 조회
      query = query.limit(normalizedFilters.limit);

      // Execute query directly
      const { data, error } = await query;

      if (error) {
        console.error(
          "ProductManager.getBestProducts database error:",
          error
        );
        throw new Error(`Database error: ${error.message}`);
      }

      // 할인율 계산 및 추가
      const productsWithDiscount = (data || []).map(product => {
        let discountRate = 0;
        if (product.originalPrice && product.originalPrice > product.price) {
          discountRate = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
        }
        
        return {
          ...product,
          discount_rate: discountRate
        };
      });

      return {
        success: true,
        data: productsWithDiscount,
        hasMore: false, // 베스트 상품은 항상 20개 고정
        nextOffset: null,
      };
    } catch (error) {
      console.error("ProductManager.getBestProducts error:", error);
      return {
        success: false,
        error: error.message,
        message: "베스트 상품 목록 조회에 실패했습니다.",
        data: [],
      };
    }
  }

  /**
   * 상품 조회수 증가
   * Requirements: 7.1
   */
  async incrementViewCount(productId) {
    try {
      // 먼저 현재 view_count를 가져온 후 1 증가시킴
      const { data: currentProduct, error: selectError } = await supabaseAdmin
        .from("products")
        .select("view_count")
        .eq("id", productId)
        .single();

      if (selectError) {
        console.error("Failed to get current view count:", selectError);
        return;
      }

      const newViewCount = (currentProduct.view_count || 0) + 1;

      const { error } = await supabaseAdmin
        .from("products")
        .update({
          view_count: newViewCount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", productId);

      if (error) {
        console.error("Failed to increment view count:", error);
      } else {
        console.log(`✅ 상품 ${productId} 조회수 증가: ${newViewCount}`);
      }

      // 캐시 무효화 (조회수 변경)
      this.clearCache();
    } catch (error) {
      console.error("ProductManager.incrementViewCount error:", error);
    }
  }

  /**
   * 상품 이벤트 추적 (조회, 구매, 장바구니 추가 등)
   * Requirements: 8.4
   */
  async trackProductEvent(productId, eventType, eventData = {}) {
    try {
      const { error } = await supabaseAdmin.from("product_analytics").insert([
        {
          product_id: productId,
          event_type: eventType,
          user_id: eventData.user_id || null,
          session_id: eventData.session_id || null,
        },
      ]);

      if (error) {
        console.error("Failed to track product event:", error);
      }
    } catch (error) {
      console.error("ProductManager.trackProductEvent error:", error);
      // Don't throw error for analytics tracking failures
    }
  }

  /**
   * 상품 데이터 검증 (Enhanced)
   * Requirements: 2.3, 2.4, 2.5
   */
  validateProductData(data, isUpdate = false) {
    const errors = [];

    // 필수 필드 검증 (생성 시에만)
    if (!isUpdate) {
      if (
        !data.name ||
        typeof data.name !== "string" ||
        data.name.trim().length === 0
      ) {
        errors.push("상품명은 필수입니다.");
      }
      if (
        !data.price ||
        isNaN(parseInt(data.price)) ||
        parseInt(data.price) <= 0
      ) {
        errors.push("가격은 0보다 큰 숫자여야 합니다.");
      }
      if (
        !data.category ||
        typeof data.category !== "string" ||
        data.category.trim().length === 0
      ) {
        errors.push("카테고리는 필수입니다.");
      }
    } else {
      // 업데이트 시 제공된 필드만 검증
      if (
        data.name !== undefined &&
        (typeof data.name !== "string" || data.name.trim().length === 0)
      ) {
        errors.push("상품명은 비어있을 수 없습니다.");
      }
      if (
        data.price !== undefined &&
        (isNaN(parseInt(data.price)) || parseInt(data.price) <= 0)
      ) {
        errors.push("가격은 0보다 큰 숫자여야 합니다.");
      }
      if (
        data.category !== undefined &&
        (typeof data.category !== "string" || data.category.trim().length === 0)
      ) {
        errors.push("카테고리는 비어있을 수 없습니다.");
      }
    }

    // 상품명 상세 검증
    if (data.name) {
      const name = data.name.trim();
      if (name.length < 2) {
        errors.push("상품명은 최소 2자 이상이어야 합니다.");
      }
      if (name.length > 255) {
        errors.push("상품명은 255자를 초과할 수 없습니다.");
      }
      // 특수문자 검증 (한글, 영문, 숫자, 공백, 하이픈, 언더스코어, 괄호만 허용)
      if (!/^[가-힣a-zA-Z0-9\s\-_()]+$/.test(name)) {
        errors.push(
          "상품명에는 한글, 영문, 숫자, 공백, 하이픈, 언더스코어, 괄호만 사용할 수 있습니다."
        );
      }
      // 연속된 공백 검증
      if (/\s{2,}/.test(name)) {
        errors.push("상품명에 연속된 공백은 사용할 수 없습니다.");
      }
      // 시작/끝 공백 검증
      if (name !== name.trim()) {
        errors.push("상품명의 앞뒤 공백은 제거됩니다.");
      }
    }

    // 가격 상세 검증
    if (data.price !== undefined) {
      const price = parseInt(data.price);
      if (!isNaN(price)) {
        if (price <= 0) {
          errors.push("가격은 0보다 커야 합니다.");
        }
        if (price > 10000000) {
          errors.push("가격은 1000만원 이하여야 합니다.");
        }
        if (price % 10 !== 0) {
          errors.push("가격은 10원 단위로 입력해주세요.");
        }
      } else {
        errors.push("가격은 유효한 숫자여야 합니다.");
      }
    }

    // 설명 검증
    if (data.description !== undefined && data.description !== null) {
      if (typeof data.description !== "string") {
        errors.push("상품 설명은 문자열이어야 합니다.");
      } else if (data.description.length > 1000) {
        errors.push("상품 설명은 1000자를 초과할 수 없습니다.");
      }
    }

    // 카테고리 검증
    if (data.category) {
      const category = data.category.trim();
      if (category.length > 100) {
        errors.push("카테고리명은 100자를 초과할 수 없습니다.");
      }
      // 허용된 카테고리 목록 (새로운 카테고리 구조 포함)
      const allowedCategories = [
        // 새로운 카테고리 구조
        "health_functional_food", // 건강기능식품
        "protein_food", // 단백질 식품
        "healthy_snack", // 건강 간식
        "healthy_juice", // 건강 주스
        "home_meal_replacement", // 가정간편식
        "side_dish", // 반찬
        "salad", // 샐러드
        "fruit", // 과일
        "meat", // 정육/계란
        "seafood", // 수산/해산
      ];

      if (!allowedCategories.includes(category)) {
        errors.push(
          `허용되지 않는 카테고리입니다. 새로운 카테고리를 사용해주세요.`
        );
      }
    }

    // 상태 검증
    if (
      data.status &&
      !["active", "inactive", "out_of_stock"].includes(data.status)
    ) {
      errors.push("상태는 active, inactive, out_of_stock 중 하나여야 합니다.");
    }

    // 이미지 URL 검증
    if (data.image_url) {
      try {
        new URL(data.image_url);
      } catch (e) {
        errors.push("이미지 URL이 유효하지 않습니다.");
      }
    }

    // 이미지 경로 검증
    if (data.image_path) {
      if (typeof data.image_path !== "string" || data.image_path.length > 500) {
        errors.push("이미지 경로가 유효하지 않습니다.");
      }
    }

    return errors;
  }

  /**
   * 비즈니스 로직 검증
   * Requirements: 2.4, 2.5
   */
  async validateBusinessRules(data, isUpdate = false, existingProduct = null) {
    const errors = [];

    try {
      // 중복 상품명 검증 (같은 카테고리 내에서)
      if (data.name && data.category) {
        const { data: existingProducts, error } = await supabaseAdmin
          .from("products")
          .select("id, name")
          .eq("name", data.name.trim())
          .eq("category", data.category);

        if (!error && existingProducts && existingProducts.length > 0) {
          // 업데이트인 경우 자기 자신은 제외
          const duplicates = existingProducts.filter(
            (p) => !isUpdate || (existingProduct && p.id !== existingProduct.id)
          );

          if (duplicates.length > 0) {
            errors.push(
              "같은 카테고리에 동일한 이름의 상품이 이미 존재합니다."
            );
          }
        }
      }

      // 카테고리 존재 여부 검증
      if (data.category) {
        const { data: categoryExists, error } = await supabaseAdmin
          .from("product_categories")
          .select("id")
          .eq("name", data.category)
          .single();

        if (error && error.code === "PGRST116") {
          errors.push("존재하지 않는 카테고리입니다.");
        }
      }
    } catch (error) {
      console.error("Business rule validation error:", error);
      errors.push("비즈니스 규칙 검증 중 오류가 발생했습니다.");
    }

    return errors;
  }

  /**
   * 종합 검증 (데이터 + 비즈니스 로직)
   * Requirements: 2.3, 2.4, 2.5
   */
  async validateProduct(data, isUpdate = false, existingProduct = null) {
    // 기본 데이터 검증
    const dataErrors = this.validateProductData(data, isUpdate);

    // 비즈니스 로직 검증
    const businessErrors = await this.validateBusinessRules(
      data,
      isUpdate,
      existingProduct
    );

    const allErrors = [...dataErrors, ...businessErrors];

    if (allErrors.length > 0) {
      const error = new Error(`Validation failed: ${allErrors.join(", ")}`);
      error.type = "VALIDATION_ERROR";
      error.details = allErrors;
      throw error;
    }

    return true;
  }

  /**
   * 캐시 무효화 - Enhanced with selective invalidation
   */
  clearCache(namespace = null) {
    if (namespace) {
      this.cache.clearNamespace(namespace);
    } else {
      // Clear all product-related caches
      this.cache.clearNamespace("products");
      this.cache.clearNamespace("categories");
      this.cache.clearNamespace("statistics");
    }
  }

  /**
   * Debounced search for better performance
   * Requirements: 6.4
   */
  async debouncedSearch(searchTerm, filters = {}, callback) {
    const searchKey = `search_${searchTerm}_${JSON.stringify(filters)}`;

    // Clear existing timeout for this search
    if (this.searchTimeouts.has(searchKey)) {
      clearTimeout(this.searchTimeouts.get(searchKey));
    }

    // Set new timeout
    const timeoutId = setTimeout(async () => {
      try {
        const results = await this.searchProducts(searchTerm, filters);
        callback(null, results);
      } catch (error) {
        callback(error, null);
      } finally {
        this.searchTimeouts.delete(searchKey);
      }
    }, this.searchDebounceTime);

    this.searchTimeouts.set(searchKey, timeoutId);
  }

  /**
   * Optimized product search with caching
   * Requirements: 6.4, 3.3
   */
  async searchProducts(searchTerm, filters = {}) {
    if (!searchTerm || searchTerm.trim().length < 2) {
      return { products: [], total: 0 };
    }

    const normalizedSearch = searchTerm.trim().toLowerCase();
    const cacheParams = { search: normalizedSearch, ...filters };

    return await this.cache.wrap(
      "products",
      "search",
      async () => {
        try {
          let query = supabaseAdmin
            .from("products")
            .select("*", { count: "exact" });

          // Use optimized search based on term length
          if (normalizedSearch.length > 3) {
            // Full-text search for longer terms
            query = query.textSearch("name", normalizedSearch, {
              type: "websearch",
              config: "english",
            });
          } else {
            // ILIKE search for shorter terms
            query = query.or(
              `name.ilike.%${normalizedSearch}%,description.ilike.%${normalizedSearch}%`
            );
          }

          // Apply additional filters
          if (filters.category) {
            query = query.eq("category", filters.category);
          }
          if (filters.status) {
            query = query.eq("status", filters.status);
          }

          // Optimize ordering for search results
          query = query
            .order("view_count", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(50); // Limit search results

          const { data, error, count } = await this.dbOptimizer.executeQuery(
            query,
            "searchProducts",
            {
              useIndex: true,
              orderBy: "view_count",
              indexedColumns: [
                "view_count",
                "created_at",
                "category",
                "status",
              ],
            }
          );

          if (error) {
            throw new Error(`Search error: ${error.message}`);
          }

          return {
            products: data || [],
            total: count || 0,
            searchTerm: normalizedSearch,
          };
        } catch (error) {
          console.error("ProductManager.searchProducts error:", error);
          throw error;
        }
      },
      cacheParams,
      60
    ); // 1 minute cache for search results
  }

  /**
   * 벌크 작업 (여러 상품 상태 변경) - Optimized for large datasets
   * Requirements: 4.3, 3.4
   */
  async bulkUpdateStatus(productIds, status) {
    try {
      if (!Array.isArray(productIds) || productIds.length === 0) {
        throw new Error("상품 ID 목록이 필요합니다.");
      }

      if (!["active", "inactive", "out_of_stock"].includes(status)) {
        throw new Error("유효하지 않은 상태입니다.");
      }

      // Use database optimizer for bulk operations
      const updateData = productIds.map((id) => ({
        id,
        status,
        updated_at: new Date().toISOString(),
      }));

      const result = await this.dbOptimizer.executeBulkOperation(
        "update",
        updateData
      );

      // Invalidate related cache entries
      this.cache.clearNamespace("products");
      this.cache.clearNamespace("statistics");

      return result;
    } catch (error) {
      console.error("ProductManager.bulkUpdateStatus error:", error);
      throw error;
    }
  }

  /**
   * 벌크 삭제 - Optimized for large datasets
   * Requirements: 4.3, 3.4
   */
  async bulkDelete(productIds) {
    try {
      if (!Array.isArray(productIds) || productIds.length === 0) {
        throw new Error("상품 ID 목록이 필요합니다.");
      }

      // Fetch products to delete in batches for better performance
      const batchSize = 50;
      const batches = this.createBatches(productIds, batchSize);
      let allProductsToDelete = [];

      for (const batch of batches) {
        const { data: batchProducts, error } = await supabaseAdmin
          .from("products")
          .select("id, image_path")
          .in("id", batch);

        if (error) {
          throw new Error(`Database error: ${error.message}`);
        }

        allProductsToDelete.push(...batchProducts);
      }

      // Delete images in parallel batches
      const imagePaths = allProductsToDelete
        .filter((product) => product.image_path)
        .map((product) => product.image_path);

      if (imagePaths.length > 0) {
        try {
          const ImageUploadHandler = require("./imageUploadHandler");
          const imageHandler = new ImageUploadHandler();

          // Delete images in batches to avoid overwhelming the storage service
          const imageBatches = this.createBatches(imagePaths, 10);
          for (const imageBatch of imageBatches) {
            await imageHandler.deleteMultipleImages(imageBatch);
          }
        } catch (imageError) {
          console.warn("Failed to delete some product images:", imageError);
          // Continue with product deletion even if image deletion fails
        }
      }

      // Use optimized bulk delete
      const result = await this.dbOptimizer.executeBulkOperation(
        "delete",
        productIds
      );

      // Invalidate all related cache entries
      this.cache.clearNamespace("products");
      this.cache.clearNamespace("statistics");
      this.cache.clearNamespace("analytics");

      return { deletedCount: productIds.length };
    } catch (error) {
      console.error("ProductManager.bulkDelete error:", error);
      throw error;
    }
  }

  /**
   * Create batches from array for optimized processing
   */
  createBatches(array, batchSize) {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * 상품 분석 데이터 조회
   * Requirements: 10.1, 10.2
   */
  async getProductAnalytics(productId, options = {}) {
    try {
      const { startDate, endDate } = options;

      // 기본 상품 정보 조회
      const product = await this.getProductById(productId);
      if (!product) {
        throw new Error("상품을 찾을 수 없습니다.");
      }

      // 분석 데이터 조회 쿼리 구성
      let analyticsQuery = supabaseAdmin
        .from("product_analytics")
        .select("*")
        .eq("product_id", productId);

      if (startDate) {
        analyticsQuery = analyticsQuery.gte("created_at", startDate);
      }
      if (endDate) {
        analyticsQuery = analyticsQuery.lte("created_at", endDate);
      }

      const { data: analyticsData, error: analyticsError } =
        await analyticsQuery;

      if (analyticsError) {
        console.error("Analytics query error:", analyticsError);
        // 분석 데이터가 없어도 기본 정보는 반환
      }

      // 분석 데이터 집계
      const analytics = {
        product: {
          id: product.id,
          name: product.name,
          category: product.category,
          status: product.status,
          created_at: product.created_at,
        },
        stats: {
          total_views: product.view_count || 0,
          total_purchases: product.purchase_count || 0,
          view_events: 0,
          purchase_events: 0,
          cart_add_events: 0,
        },
        timeline: [],
      };

      if (analyticsData && analyticsData.length > 0) {
        // 이벤트 타입별 집계
        const eventCounts = analyticsData.reduce((acc, event) => {
          acc[event.event_type] = (acc[event.event_type] || 0) + 1;
          return acc;
        }, {});

        analytics.stats.view_events = eventCounts.view || 0;
        analytics.stats.purchase_events = eventCounts.purchase || 0;
        analytics.stats.cart_add_events = eventCounts.cart_add || 0;

        // 일별 타임라인 생성
        const dailyStats = analyticsData.reduce((acc, event) => {
          const date = event.created_at.split("T")[0];
          if (!acc[date]) {
            acc[date] = { date, views: 0, purchases: 0, cart_adds: 0 };
          }
          if (event.event_type === "view") acc[date].views++;
          if (event.event_type === "purchase") acc[date].purchases++;
          if (event.event_type === "cart_add") acc[date].cart_adds++;
          return acc;
        }, {});

        analytics.timeline = Object.values(dailyStats).sort((a, b) =>
          a.date.localeCompare(b.date)
        );
      }

      return analytics;
    } catch (error) {
      console.error("ProductManager.getProductAnalytics error:", error);
      throw error;
    }
  }

  /**
   * 상품 통계 조회
   * Requirements: 10.1, 10.2, 10.3
   */
  async getProductStats() {
    try {
      console.log("상품 통계 조회 시작...");

      // 총 상품 수
      console.log("총 상품 수 조회 중...");
      const { count: totalProducts, error: totalError } = await supabaseAdmin
        .from("products")
        .select("*", { count: "exact", head: true });

      if (totalError) {
        console.error("총 상품 수 조회 오류:", totalError);
      } else {
        console.log("총 상품 수:", totalProducts);
      }

      // 활성 상품 수
      console.log("활성 상품 수 조회 중...");
      const { count: activeProducts, error: activeError } = await supabaseAdmin
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      if (activeError) {
        console.error("활성 상품 수 조회 오류:", activeError);
      } else {
        console.log("활성 상품 수:", activeProducts);
      }

      // 비활성 상품 수
      console.log("비활성 상품 수 조회 중...");
      const { count: inactiveProducts, error: inactiveError } =
        await supabaseAdmin
          .from("products")
          .select("*", { count: "exact", head: true })
          .neq("status", "active");

      if (inactiveError) {
        console.error("비활성 상품 수 조회 오류:", inactiveError);
      } else {
        console.log("비활성 상품 수:", inactiveProducts);
      }

      // 카테고리 수
      console.log("카테고리 수 조회 중...");
      const { data: categories, error: categoryError } = await supabaseAdmin
        .from("products")
        .select("category")
        .not("category", "is", null);

      let totalCategories = 0;
      if (!categoryError && categories) {
        const uniqueCategories = new Set(
          categories.map((item) => item.category)
        );
        totalCategories = uniqueCategories.size;
        console.log("총 카테고리 수:", totalCategories);
      } else if (categoryError) {
        console.error("카테고리 수 조회 오류:", categoryError);
      }

      // 총 조회수
      console.log("총 조회수 조회 중...");
      const { data: totalViewsData, error: totalViewsError } =
        await supabaseAdmin.from("products").select("view_count");

      let totalViews = 0;
      if (!totalViewsError && totalViewsData) {
        totalViews = totalViewsData.reduce(
          (sum, product) => sum + (product.view_count || 0),
          0
        );
        console.log("총 조회수:", totalViews);
      } else if (totalViewsError) {
        console.error("총 조회수 조회 오류:", totalViewsError);
      }

      // 오늘 조회수 (product_analytics 테이블이 있다면)
      console.log("오늘 조회수 조회 중...");
      let todayViews = 0;
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { count: viewCount, error: viewError } = await supabaseAdmin
          .from("product_analytics")
          .select("*", { count: "exact", head: true })
          .eq("event_type", "view")
          .gte("created_at", today.toISOString());

        if (!viewError) {
          todayViews = viewCount || 0;
          console.log("오늘 조회수:", todayViews);
        } else {
          console.error("오늘 조회수 조회 오류:", viewError);
        }
      } catch (viewError) {
        // product_analytics 테이블이 없을 수 있으므로 에러 무시
        console.log(
          "오늘 조회수 조회 실패 (테이블이 없을 수 있음):",
          viewError.message
        );
      }

      const result = {
        totalProducts: totalProducts || 0,
        activeProducts: activeProducts || 0,
        inactiveProducts: inactiveProducts || 0,
        totalCategories: totalCategories,
        totalViews: totalViews,
        todayViews: todayViews,
      };

      console.log("상품 통계 조회 완료:", result);
      return result;
    } catch (error) {
      console.error("상품 통계 조회 오류:", error);
      console.error("오류 스택:", error.stack);
      return {
        totalProducts: 0,
        activeProducts: 0,
        inactiveProducts: 0,
        totalCategories: 0,
        totalViews: 0,
        todayViews: 0,
      };
    }
  }

  /**
   * 오늘 조회수 상세 정보 조회 (상품별)
   * Requirements: 10.1, 10.2
   */
  async getTodayViewsDetail() {
    try {
      console.log("오늘 조회수 상세 정보 조회 시작...");

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 오늘 조회된 상품들의 조회수를 집계
      const { data: todayAnalytics, error: analyticsError } =
        await supabaseAdmin
          .from("product_analytics")
          .select(
            `
                    product_id,
                    products (
                        id,
                        name,
                        category,
                        image_url,
                        status
                    )
                `
          )
          .eq("event_type", "view")
          .gte("created_at", today.toISOString())
          .not("products", "is", null); // products가 null이 아닌 것만 (삭제되지 않은 상품)

      if (analyticsError) {
        console.error("오늘 조회수 분석 데이터 조회 오류:", analyticsError);
        throw new Error(`Analytics query error: ${analyticsError.message}`);
      }

      console.log(`오늘 조회 이벤트 ${todayAnalytics?.length || 0}개 발견`);

      // 상품별 조회수 집계
      const productViewsMap = new Map();
      let totalViews = 0;

      if (todayAnalytics && todayAnalytics.length > 0) {
        todayAnalytics.forEach((analytics) => {
          const product = analytics.products;
          if (product && product.status === "active") {
            // 활성 상품만
            const productId = product.id;

            if (productViewsMap.has(productId)) {
              productViewsMap.get(productId).todayViews++;
            } else {
              // image_url 정리 - 빈 값이나 잘못된 값 처리
              let cleanImageUrl = product.image_url;
              if (
                !cleanImageUrl ||
                cleanImageUrl.trim() === "" ||
                cleanImageUrl === "[]"
              ) {
                cleanImageUrl = null;
              } else {
                cleanImageUrl = cleanImageUrl.trim();
              }

              productViewsMap.set(productId, {
                id: product.id,
                name: product.name,
                category: product.category,
                image_url: cleanImageUrl,
                todayViews: 1,
              });
            }
            totalViews++;
          }
        });
      }

      // Map을 배열로 변환하고 조회수 순으로 정렬
      const products = Array.from(productViewsMap.values()).sort(
        (a, b) => b.todayViews - a.todayViews
      );

      const result = {
        totalViews,
        products,
      };

      console.log("오늘 조회수 상세 정보 조회 완료:", {
        totalViews: result.totalViews,
        productsCount: result.products.length,
      });

      return result;
    } catch (error) {
      console.error("오늘 조회수 상세 정보 조회 오류:", error);
      console.error("오류 스택:", error.stack);
      return {
        totalViews: 0,
        products: [],
      };
    }
  }

  /**
   * 인기 상품 조회 (조회수 기준)
   * Requirements: 10.4
   */
  async getPopularProducts(limit = 10) {
    try {
      const { data, error } = await supabaseAdmin
        .from("products")
        .select("id, name, category, view_count, purchase_count, status")
        .eq("status", "active")
        .order("view_count", { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error("ProductManager.getPopularProducts error:", error);
      return [];
    }
  }

  /**
   * 카테고리별 통계 조회
   * Requirements: 10.5
   */
  async getCategoryStats() {
    try {
      console.log("ProductManager.getCategoryStats - 시작");
      const { data, error } = await supabaseAdmin
        .from("products")
        .select("category, status, view_count, purchase_count");

      if (error) {
        console.error(
          "ProductManager.getCategoryStats - 데이터베이스 오류:",
          error
        );
        throw new Error(`Database error: ${error.message}`);
      }

      console.log("ProductManager.getCategoryStats - 조회된 데이터:", data);

      // 카테고리별 집계
      const categoryStats = {};

      data.forEach((product) => {
        const category = product.category;
        if (!categoryStats[category]) {
          categoryStats[category] = {
            category: category,
            totalProducts: 0,
            activeProducts: 0,
            inactiveProducts: 0,
            totalViews: 0,
            totalPurchases: 0,
          };
        }

        categoryStats[category].totalProducts++;
        if (product.status === "active") {
          categoryStats[category].activeProducts++;
        } else {
          categoryStats[category].inactiveProducts++;
        }
        categoryStats[category].totalViews += product.view_count || 0;
        categoryStats[category].totalPurchases += product.purchase_count || 0;
      });

      const result = Object.values(categoryStats);
      console.log("ProductManager.getCategoryStats - 최종 결과:", result);
      return result;
    } catch (error) {
      console.error("ProductManager.getCategoryStats error:", error);
      return [];
    }
  }

  /**
   * 날짜 범위별 분석 데이터 조회
   * Requirements: 10.6
   */
  async getAnalyticsByDateRange(startDate, endDate) {
    try {
      let query = supabaseAdmin.from("product_analytics").select(`
                    event_type,
                    created_at,
                    product_id,
                    products!inner(name, category)
                `);

      if (startDate) {
        query = query.gte("created_at", startDate);
      }
      if (endDate) {
        query = query.lte("created_at", endDate);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      // 일별 집계
      const dailyStats = {};
      const categoryStats = {};
      const eventTypeStats = { view: 0, purchase: 0, cart_add: 0 };

      data.forEach((event) => {
        const date = event.created_at.split("T")[0];
        const category = event.products.category;
        const eventType = event.event_type;

        // 일별 통계
        if (!dailyStats[date]) {
          dailyStats[date] = { date, views: 0, purchases: 0, cart_adds: 0 };
        }
        if (eventType === "view") dailyStats[date].views++;
        if (eventType === "purchase") dailyStats[date].purchases++;
        if (eventType === "cart_add") dailyStats[date].cart_adds++;

        // 카테고리별 통계
        if (!categoryStats[category]) {
          categoryStats[category] = {
            category,
            views: 0,
            purchases: 0,
            cart_adds: 0,
          };
        }
        if (eventType === "view") categoryStats[category].views++;
        if (eventType === "purchase") categoryStats[category].purchases++;
        if (eventType === "cart_add") categoryStats[category].cart_adds++;

        // 이벤트 타입별 통계
        eventTypeStats[eventType]++;
      });

      return {
        dailyStats: Object.values(dailyStats).sort((a, b) =>
          a.date.localeCompare(b.date)
        ),
        categoryStats: Object.values(categoryStats),
        eventTypeStats,
        totalEvents: data.length,
      };
    } catch (error) {
      console.error("ProductManager.getAnalyticsByDateRange error:", error);
      return {
        dailyStats: [],
        categoryStats: [],
        eventTypeStats: { view: 0, purchase: 0, cart_add: 0 },
        totalEvents: 0,
      };
    }
  }

  /**
   * 상품 구매 추적 (포인트 시스템과 연동)
   * Requirements: 10.3
   */
  async trackProductPurchase(productId, userId, purchaseData = {}) {
    try {
      // 구매 카운트 증가
      const { error: updateError } = await supabaseAdmin
        .from("products")
        .update({
          purchase_count: supabaseAdmin.raw("purchase_count + 1"),
          updated_at: new Date().toISOString(),
        })
        .eq("id", productId);

      if (updateError) {
        console.error("Failed to increment purchase count:", updateError);
      }

      // 분석 데이터 추가
      await this.trackProductEvent(productId, "purchase", {
        user_id: userId,
        session_id: purchaseData.session_id,
        ...purchaseData,
      });

      // 캐시 무효화
      this.clearCache();
    } catch (error) {
      console.error("ProductManager.trackProductPurchase error:", error);
    }
  }

  /**
   * 분석 개요 데이터 조회
   * Requirements: 10.1, 10.2
   */
  async getAnalyticsOverview() {
    try {
      const stats = await this.getProductStats();
      const popularProducts = await this.getPopularProducts(5);

      // 총 구매수 계산
      const { data: purchaseData, error: purchaseError } = await supabaseAdmin
        .from("products")
        .select("purchase_count");

      let totalPurchases = 0;
      if (!purchaseError && purchaseData) {
        totalPurchases = purchaseData.reduce(
          (sum, product) => sum + (product.purchase_count || 0),
          0
        );
      }

      // 인기 상품 수 (조회수 + 구매수 * 2 >= 20)
      const popularThreshold = 20;
      const { data: allProducts, error: allProductsError } = await supabaseAdmin
        .from("products")
        .select("view_count, purchase_count");

      let popularProductsCount = 0;
      if (!allProductsError && allProducts) {
        popularProductsCount = allProducts.filter((product) => {
          const score =
            (product.view_count || 0) + (product.purchase_count || 0) * 2;
          return score >= popularThreshold;
        }).length;
      }

      return {
        totalViews: stats.totalViews,
        totalPurchases: totalPurchases,
        popularProductsCount: popularProductsCount,
        topProducts: popularProducts,
      };
    } catch (error) {
      console.error("ProductManager.getAnalyticsOverview error:", error);
      return {
        totalViews: 0,
        totalPurchases: 0,
        popularProductsCount: 0,
        topProducts: [],
      };
    }
  }

  /**
   * 분석 트렌드 데이터 조회
   * Requirements: 10.5, 10.6
   */
  async getAnalyticsTrends(days = 30) {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabaseAdmin
        .from("product_analytics")
        .select("event_type, created_at")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      if (error) {
        console.error("Trends query error:", error);
        return [];
      }

      // 일별 집계
      const dailyStats = {};

      // 날짜 범위 초기화
      for (
        let d = new Date(startDate);
        d <= endDate;
        d.setDate(d.getDate() + 1)
      ) {
        const dateStr = d.toISOString().split("T")[0];
        dailyStats[dateStr] = { date: dateStr, views: 0, purchases: 0 };
      }

      // 데이터 집계
      if (data) {
        data.forEach((event) => {
          const date = event.created_at.split("T")[0];
          if (dailyStats[date]) {
            if (event.event_type === "view") {
              dailyStats[date].views++;
            } else if (event.event_type === "purchase") {
              dailyStats[date].purchases++;
            }
          }
        });
      }

      return Object.values(dailyStats).sort((a, b) =>
        a.date.localeCompare(b.date)
      );
    } catch (error) {
      console.error("ProductManager.getAnalyticsTrends error:", error);
      return [];
    }
  }

  /**
   * 카테고리 통계 조회 (분석용)
   * Requirements: 10.5
   */
  async getCategoryStatistics() {
    try {
      const categoryStats = await this.getCategoryStats();

      // 추가 분석 데이터 계산
      return categoryStats.map((stat) => ({
        ...stat,
        avgViews:
          stat.totalProducts > 0
            ? Math.round(stat.totalViews / stat.totalProducts)
            : 0,
        avgPurchases:
          stat.totalProducts > 0
            ? Math.round(stat.totalPurchases / stat.totalProducts)
            : 0,
        conversionRate:
          stat.totalViews > 0
            ? ((stat.totalPurchases / stat.totalViews) * 100).toFixed(2)
            : 0,
      }));
    } catch (error) {
      console.error("ProductManager.getCategoryStatistics error:", error);
      return [];
    }
  }

  /**
   * 상품 분석 데이터 CSV 내보내기
   * Requirements: 10.6
   */
  async exportProductAnalytics(productId, options = {}) {
    try {
      const analytics = await this.getProductAnalytics(productId, options);

      // CSV 헤더
      const headers = [
        "Date",
        "Product Name",
        "Category",
        "Views",
        "Purchases",
        "Cart Adds",
      ];

      // CSV 데이터 생성
      const csvRows = [headers.join(",")];

      if (analytics.timeline && analytics.timeline.length > 0) {
        analytics.timeline.forEach((day) => {
          const row = [
            day.date,
            `"${analytics.product.name}"`,
            analytics.product.category,
            day.views,
            day.purchases,
            day.cart_adds,
          ];
          csvRows.push(row.join(","));
        });
      } else {
        // 데이터가 없는 경우 기본 행 추가
        const row = [
          new Date().toISOString().split("T")[0],
          `"${analytics.product.name}"`,
          analytics.product.category,
          analytics.stats.total_views,
          analytics.stats.total_purchases,
          0,
        ];
        csvRows.push(row.join(","));
      }

      return csvRows.join("\n");
    } catch (error) {
      console.error("ProductManager.exportProductAnalytics error:", error);
      throw error;
    }
  }

  /**
   * 전체 상품 분석 데이터 CSV 내보내기
   * Requirements: 10.6
   */
  async exportAllAnalytics(options = {}) {
    try {
      const { startDate, endDate } = options;

      // 모든 상품 조회
      const { data: products, error: productsError } = await supabaseAdmin
        .from("products")
        .select(
          "id, name, category, view_count, purchase_count, status, created_at"
        );

      if (productsError) {
        throw new Error(`Database error: ${productsError.message}`);
      }

      // CSV 헤더
      const headers = [
        "Product ID",
        "Product Name",
        "Category",
        "Status",
        "Total Views",
        "Total Purchases",
        "Conversion Rate (%)",
        "Created Date",
      ];

      // CSV 데이터 생성
      const csvRows = [headers.join(",")];

      products.forEach((product) => {
        const conversionRate =
          product.view_count > 0
            ? ((product.purchase_count / product.view_count) * 100).toFixed(2)
            : 0;

        const row = [
          product.id,
          `"${product.name}"`,
          product.category,
          product.status,
          product.view_count || 0,
          product.purchase_count || 0,
          conversionRate,
          new Date(product.created_at).toISOString().split("T")[0],
        ];
        csvRows.push(row.join(","));
      });

      return csvRows.join("\n");
    } catch (error) {
      console.error("ProductManager.exportAllAnalytics error:", error);
      throw error;
    }
  }

  /**
   * 특가 상품 조회
   * Requirements: 8.1, 8.2
   */
  async getFeaturedProducts() {
    try {
      // 캐시 확인
      const cached = this.cache.get("products", "featured");
      if (cached) {
        return {
          success: true,
          data: cached,
          source: "cache",
        };
      }

      // 특가상품 조회 (이미지 데이터 포함)
      const { data: allProducts, error: allError } = await supabaseAdmin
        .from("products")
        .select("id, name, description, price, originalPrice, category, status, featured, created_at, updated_at, view_count, purchase_count, summary, image_url")
        .eq("status", "active");
      
      if (allError) {
        console.error("All products query error:", allError);
        return {
          success: false,
          error: allError.message,
        };
      }

      // featured=true인 상품들과 할인율 20% 이상인 상품들 필터링
      const featuredProducts = (allProducts || []).filter(product => {
        // featured=true로 설정된 상품은 항상 포함
        if (product.featured === true) {
          return true;
        }
        
        // 할인율 15% 이상인 상품만 포함
        if (product.originalPrice && product.originalPrice > product.price) {
          const discountRate = ((product.originalPrice - product.price) / product.originalPrice) * 100;
          return discountRate >= 15;
        }
        
        return false;
      });
      
      // 최신순으로 정렬하고 8개로 제한
      const finalProducts = featuredProducts
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 8);

      // 캐시에 저장 (5분)
      this.cache.set("products", "featured", finalProducts, {}, 300);

      return {
        success: true,
        data: finalProducts,
        source: "database",
      };
    } catch (error) {
      console.error("ProductManager.getFeaturedProducts error:", error);
      return {
        success: false,
        error: "특가 상품을 불러오는데 실패했습니다.",
        message: error.message,
      };
    }
  }

  /**
   * Get product image by ID
   * @param {string} productId - Product ID
   * @returns {Promise<Object>} Result with image data
   */
  async getProductImage(productId) {
    try {
      const { data, error } = await supabaseAdmin
        .from("products")
        .select("image_url, image_path")
        .eq("id", productId)
        .single();

      if (error) {
        console.error("Product image query error:", error);
        return {
          success: false,
          error: "이미지를 찾을 수 없습니다.",
        };
      }

      if (!data) {
        return {
          success: false,
          error: "상품을 찾을 수 없습니다.",
        };
      }

      return {
        success: true,
        image_url: data.image_url,
        image_path: data.image_path,
      };
    } catch (error) {
      console.error("ProductManager.getProductImage error:", error);
      return {
        success: false,
        error: "이미지 조회 중 오류가 발생했습니다.",
      };
    }
  }

  /**
   * 이벤트 상품 조회
   * @returns {Promise<Object>} Result with event products data
   */
  async getEventProducts() {
    try {
      // 캐시에서 먼저 확인
      const cachedData = this.cache.get("products", "event");
      if (cachedData) {
        console.log("이벤트 상품 캐시에서 로드됨:", cachedData.length, "개");
        return {
          success: true,
          data: cachedData,
          source: "cache",
        };
      }

      // 이벤트 상품 조회 (이벤트 태그가 있거나 이벤트 상품으로 설정된 상품들)
      const { data: eventProducts, error: eventError } = await supabaseAdmin
        .from("products")
        .select("id, name, description, price, originalPrice, category, status, created_at, updated_at, view_count, purchase_count, summary, image_url, is_event, event_tag, event_start_date, event_end_date")
        .eq("status", "active")
        .or("is_event.eq.true,event_tag.not.is.null");

      if (eventError) {
        console.error("이벤트 상품 조회 오류:", eventError);
        return {
          success: false,
          error: eventError.message,
        };
      }

      // 이벤트 상품이 없으면 할인 상품들을 이벤트 상품으로 대체
      let finalProducts = eventProducts || [];
      
      if (finalProducts.length === 0) {
        console.log("이벤트 상품이 없어 할인 상품을 대체로 사용");
        
        // 할인율 10% 이상인 상품들을 이벤트 상품으로 표시
        const { data: allProducts, error: allError } = await supabaseAdmin
          .from("products")
          .select("id, name, description, price, originalPrice, category, status, created_at, updated_at, view_count, purchase_count, summary, image_url")
          .eq("status", "active");
        
        if (allError) {
          console.error("전체 상품 조회 오류:", allError);
          return {
            success: false,
            error: allError.message,
          };
        }

        finalProducts = (allProducts || []).filter(product => {
          if (product.originalPrice && product.originalPrice > product.price) {
            const discountRate = ((product.originalPrice - product.price) / product.originalPrice) * 100;
            return discountRate >= 10;
          }
          return false;
        });
      }

      // 최신순으로 정렬
      const sortedProducts = finalProducts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      // 캐시에 저장 (10분)
      this.cache.set("products", "event", sortedProducts, {}, 600);

      console.log("이벤트 상품 로드됨:", sortedProducts.length, "개");

      return {
        success: true,
        data: sortedProducts,
        source: "database",
      };
    } catch (error) {
      console.error("ProductManager.getEventProducts error:", error);
      return {
        success: false,
        error: "이벤트 상품을 불러오는데 실패했습니다.",
        message: error.message,
      };
    }
  }
}

module.exports = ProductManager;

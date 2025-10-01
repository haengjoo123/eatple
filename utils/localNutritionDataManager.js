/**
 * 로컬 JSON 파일 기반 영양 정보 데이터 관리 유틸리티
 * Requirements: 6.1, 7.1 - 로컬 데이터 통합 조회
 */

const fs = require("fs").promises;
const path = require("path");
const NutritionInfo = require("../models/NutritionInfo");
const { normalizePostMedia } = require("./mediaNormalizer");

class LocalNutritionDataManager {
  constructor() {
    this.dataPath = path.join(__dirname, "../data/nutrition");
    this.nutritionPostsFile = path.join(this.dataPath, "nutrition-posts.json");
    this.categoriesFile = path.join(this.dataPath, "categories.json");
    this.tagsFile = path.join(this.dataPath, "tags.json");
    this.postTagsFile = path.join(this.dataPath, "post-tags.json");
    this.relatedProductsFile = path.join(this.dataPath, "post-related-products.json");

    // 메모리 캐시
    this.cache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5분
    this.maxCacheSize = 100;
  }

  /**
   * JSON 파일 읽기
   */
  async readJsonFile(filePath) {
    try {
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`JSON 파일 읽기 실패: ${filePath}`, error);
      return [];
    }
  }

  /**
   * 카테고리 데이터 로드
   */
  async loadCategories() {
    const cacheKey = 'categories';
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }

    const categories = await this.readJsonFile(this.categoriesFile);
    this.cache.set(cacheKey, { data: categories, timestamp: Date.now() });
    return categories;
  }

  /**
   * 태그 데이터 로드
   */
  async loadTags() {
    const cacheKey = 'tags';
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }

    const tags = await this.readJsonFile(this.tagsFile);
    this.cache.set(cacheKey, { data: tags, timestamp: Date.now() });
    return tags;
  }

  /**
   * 포스트-태그 관계 데이터 로드
   */
  async loadPostTags() {
    const cacheKey = 'post_tags';
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }

    const postTags = await this.readJsonFile(this.postTagsFile);
    this.cache.set(cacheKey, { data: postTags, timestamp: Date.now() });
    return postTags;
  }

  /**
   * 관련 상품 데이터 로드
   */
  async loadRelatedProducts() {
    const cacheKey = 'related_products';
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }

    const relatedProducts = await this.readJsonFile(this.relatedProductsFile);
    this.cache.set(cacheKey, { data: relatedProducts, timestamp: Date.now() });
    return relatedProducts;
  }

  /**
   * 영양 정보 포스트 데이터 로드
   */
  async loadNutritionPosts() {
    const cacheKey = 'nutrition_posts';
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }

    const posts = await this.readJsonFile(this.nutritionPostsFile);
    this.cache.set(cacheKey, { data: posts, timestamp: Date.now() });
    return posts;
  }

  /**
   * 카테고리 이름으로 ID 찾기
   */
  async getCategoryIdByName(categoryName) {
    const categories = await this.loadCategories();
    const category = categories.find(cat => cat.name === categoryName);
    return category ? category.id : null;
  }

  /**
   * 포스트의 태그 가져오기
   */
  async getPostTags(postId) {
    const postTags = await this.loadPostTags();
    const tags = await this.loadTags();
    
    const postTagRelations = postTags.filter(pt => pt.post_id === postId);
    const tagNames = [];
    
    for (const relation of postTagRelations) {
      const tag = tags.find(t => t.id === relation.tag_id);
      if (tag) {
        tagNames.push(tag.name);
      }
    }
    
    return tagNames;
  }

  /**
   * 포스트의 관련 상품 가져오기
   */
  async getPostRelatedProducts(postId) {
    try {
      console.log(`🔍 관련상품 조회 시작 - 포스트 ID: ${postId}`);
      const relatedProducts = await this.loadRelatedProducts();
      console.log(`전체 관련상품 수: ${relatedProducts.length}`);
      
      const filteredProducts = relatedProducts.filter(rp => rp.post_id === postId);
      console.log(`해당 포스트 관련상품 수: ${filteredProducts.length}`);
      console.log('조회된 관련상품:', JSON.stringify(filteredProducts, null, 2));
      
      return filteredProducts;
    } catch (error) {
      console.error('관련상품 조회 오류:', error);
      return [];
    }
  }

  /**
   * 카테고리 정보 가져오기
   */
  async getCategoryInfo(categoryId) {
    const categories = await this.loadCategories();
    return categories.find(cat => cat.id === categoryId);
  }

  /**
   * 영양 정보 목록 조회
   */
  async getNutritionInfoList(filters = {}, pagination = {}) {
    try {
      const posts = await this.loadNutritionPosts();
      let filteredPosts = [...posts];

      // 필터 적용
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        filteredPosts = filteredPosts.filter(post => 
          post.title.toLowerCase().includes(searchTerm) ||
          post.summary.toLowerCase().includes(searchTerm) ||
          (post.content && post.content.toLowerCase().includes(searchTerm))
        );
      }

      if (filters.category) {
        const categoryNames = Array.isArray(filters.category) ? filters.category : [filters.category];
        const categoryIds = [];
        
        for (const categoryName of categoryNames) {
          const categoryId = await this.getCategoryIdByName(categoryName);
          if (categoryId) {
            categoryIds.push(categoryId);
          }
        }
        
        if (categoryIds.length > 0) {
          filteredPosts = filteredPosts.filter(post => 
            categoryIds.includes(post.category_id)
          );
        } else {
          // 해당 카테고리가 없으면 빈 결과 반환
          filteredPosts = [];
        }
      }

      if (filters.sourceType && filters.sourceType.length > 0) {
        filteredPosts = filteredPosts.filter(post => 
          filters.sourceType.includes(post.source_type)
        );
      }

      if (filters.tags && filters.tags.length > 0) {
        const matchingPostIds = new Set();
        
        for (const post of filteredPosts) {
          const postTags = await this.getPostTags(post.id);
          const hasMatchingTag = filters.tags.some(filterTag => 
            postTags.some(postTag => postTag.toLowerCase().includes(filterTag.toLowerCase()))
          );
          
          if (hasMatchingTag) {
            matchingPostIds.add(post.id);
          }
        }
        
        filteredPosts = filteredPosts.filter(post => matchingPostIds.has(post.id));
      }

      if (filters.minTrustScore !== undefined) {
        filteredPosts = filteredPosts.filter(post => 
          post.trust_score >= filters.minTrustScore
        );
      }

      if (filters.maxTrustScore !== undefined) {
        filteredPosts = filteredPosts.filter(post => 
          post.trust_score <= filters.maxTrustScore
        );
      }

      if (filters.dateFrom) {
        filteredPosts = filteredPosts.filter(post => 
          new Date(post.published_date || post.collected_date) >= new Date(filters.dateFrom)
        );
      }

      if (filters.dateTo) {
        filteredPosts = filteredPosts.filter(post => 
          new Date(post.published_date || post.collected_date) <= new Date(filters.dateTo)
        );
      }

      // 임시저장 제외 필터 (관리자 포스팅 목록용)
      if (filters.excludeDrafts) {
        const beforeCount = filteredPosts.length;
        filteredPosts = filteredPosts.filter(post => 
          post.is_draft !== true
        );
        console.log(`🔍 임시저장 제외 필터: ${beforeCount} → ${filteredPosts.length} 포스팅`);
      }

      // 정렬
      const sortBy = filters.sortBy || 'collected_date';
      const sortOrder = filters.sortOrder || 'desc';
      
      filteredPosts.sort((a, b) => {
        let aValue = a[sortBy];
        let bValue = b[sortBy];
        
        if (sortBy.includes('date')) {
          aValue = new Date(aValue || 0);
          bValue = new Date(bValue || 0);
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
      
      const totalCount = filteredPosts.length;
      const totalPages = Math.ceil(totalCount / limit);
      const paginatedPosts = filteredPosts.slice(offset, offset + limit);

      // NutritionInfo 객체로 변환하고 추가 데이터 로드
      const enrichedPosts = [];
      for (const post of paginatedPosts) {
        const enrichedPost = await this.enrichPostData(post);
        enrichedPosts.push(enrichedPost);
      }

      return {
        data: enrichedPosts,
        pagination: {
          page: page,
          limit: limit,
          offset: offset,
          count: paginatedPosts.length,
          totalCount: totalCount,
          totalPages: totalPages
        }
      };
    } catch (error) {
      console.error('영양 정보 목록 조회 오류:', error);
      throw error;
    }
  }

  /**
   * 특정 영양 정보 조회
   */
  async getNutritionInfoById(id) {
    try {
      const posts = await this.loadNutritionPosts();
      const post = posts.find(p => p.id === id);
      
      if (!post) {
        return null;
      }

      return await this.enrichPostData(post);
    } catch (error) {
      console.error(`영양 정보 조회 오류 (ID: ${id}):`, error);
      throw error;
    }
  }

  /**
   * 포스트 데이터 보강 (태그, 카테고리, 관련 상품 추가)
   */
  async enrichPostData(post) {
    try {
      // 태그 정보 추가
      const tags = await this.getPostTags(post.id);
      
      // 카테고리 정보 추가
      const categoryInfo = await this.getCategoryInfo(post.category_id);
      
      // 관련 상품 정보 추가
      console.log(`📦 포스트 ${post.id}의 관련상품 정보 추가 중...`);
      const relatedProducts = await this.getPostRelatedProducts(post.id);
      console.log(`📦 관련상품 정보 추가 완료: ${relatedProducts.length}개`);

      // NutritionInfo 객체 생성
      const nutritionInfo = new NutritionInfo({
        id: post.id,
        title: post.title,
        summary: post.summary,
        content: post.content,
        sourceType: post.source_type,
        sourceName: post.source_name,
        sourceUrl: post.source_url,
        publishedDate: post.published_date,
        collectedDate: post.collected_date,
        trustScore: post.trust_score,
        viewCount: post.view_count || 0,
        thumbnailUrl: post.thumbnail_url,
        imageUrl: post.image_url,
        category: categoryInfo ? categoryInfo.name : null,
        tags: tags,
        related_products: relatedProducts,
        isActive: true
      });

      return nutritionInfo;
    } catch (error) {
      console.error('포스트 데이터 보강 오류:', error);
      throw error;
    }
  }

  /**
   * 영양 정보 검색
   */
  async searchNutritionInfo(query, filters = {}) {
    // 검색어를 필터에 추가
    const searchFilters = { ...filters, search: query };
    return await this.getNutritionInfoList(searchFilters);
  }

  /**
   * 조회수 증가 (로컬 파일 업데이트)
   */
  async incrementViewCount(id) {
    try {
      const posts = await this.readJsonFile(this.nutritionPostsFile);
      const postIndex = posts.findIndex(p => p.id === id);
      
      if (postIndex !== -1) {
        posts[postIndex].view_count = (posts[postIndex].view_count || 0) + 1;
        
        // 파일에 저장
        await fs.writeFile(this.nutritionPostsFile, JSON.stringify(posts, null, 2), 'utf8');
        
        // 캐시 무효화
        this.cache.delete('nutrition_posts');
        
        console.log(`조회수 증가: ${id} -> ${posts[postIndex].view_count}`);
      }
    } catch (error) {
      console.error('조회수 증가 오류:', error);
    }
  }

  /**
   * 카테고리 목록 조회
   */
  async getCategories() {
    return await this.loadCategories();
  }

  /**
   * 영양 정보 업데이트 (북마크/좋아요 수 등)
   */
  async updateNutritionInfo(id, updateData) {
    try {
      console.log(`🔄 영양정보 업데이트 시작 - ID: ${id}`);
      console.log('업데이트 데이터:', JSON.stringify(updateData, null, 2));
      
      const posts = await this.readJsonFile(this.nutritionPostsFile);
      console.log(`전체 포스트 수: ${posts.length}`);
      
      const postIndex = posts.findIndex(p => p.id === id);
      console.log(`포스트 인덱스: ${postIndex}`);
      
      if (postIndex !== -1) {
        console.log('업데이트 전 포스트 데이터:', JSON.stringify(posts[postIndex], null, 2));
        
        // 업데이트 데이터 적용
        Object.keys(updateData).forEach(key => {
          // snake_case로 변환
          const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
          const oldValue = posts[postIndex][snakeKey];
          posts[postIndex][snakeKey] = updateData[key];
          console.log(`필드 업데이트: ${key} -> ${snakeKey}, ${oldValue} -> ${updateData[key]}`);
        });
        
        console.log('업데이트 후 포스트 데이터:', JSON.stringify(posts[postIndex], null, 2));
        
        // 파일에 저장
        await fs.writeFile(this.nutritionPostsFile, JSON.stringify(posts, null, 2), 'utf8');
        console.log('✅ 포스트 파일 저장 완료');
        
        // 캐시 무효화
        this.cache.delete('nutrition_posts');
        console.log('✅ 캐시 무효화 완료');
        
        console.log(`✅ 영양 정보 업데이트 완료: ${id}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('영양 정보 업데이트 오류:', error);
      throw error;
    }
  }

  /**
   * 새 영양 정보 생성
   */
  async createNutritionInfo(nutritionData) {
    try {
      const posts = await this.readJsonFile(this.nutritionPostsFile);
      
      // 새 ID 생성 (현재 최대 ID + 1)
      const maxId = posts.length > 0 ? Math.max(...posts.map(p => parseInt(p.id) || 0)) : 0;
      const newId = (maxId + 1).toString();
      
      // base64 -> URL 정규화
      const projectRoot = path.join(__dirname, '..');
      const normalized = await normalizePostMedia({
        title: nutritionData.title || '',
        summary: nutritionData.summary || '',
        content: nutritionData.content || '',
        sourceType: nutritionData.sourceType || 'manual',
        sourceName: nutritionData.sourceName || 'Admin',
        sourceUrl: nutritionData.sourceUrl || null,
        publishedDate: nutritionData.publishedDate || new Date().toISOString(),
        trustScore: nutritionData.trustScore || 80,
        thumbnailUrl: nutritionData.thumbnailUrl || null,
        imageUrl: nutritionData.imageUrl || null,
        category: nutritionData.category,
      }, projectRoot, newId);

      // 새 포스트 데이터 구성
      const newPost = {
        id: newId,
        title: normalized.title,
        summary: normalized.summary,
        content: normalized.content,
        source_type: normalized.sourceType,
        source_name: normalized.sourceName,
        source_url: normalized.sourceUrl,
        published_date: normalized.publishedDate,
        collected_date: new Date().toISOString(),
        trust_score: normalized.trustScore,
        view_count: 0,
        thumbnail_url: normalized.thumbnailUrl,
        image_url: normalized.imageUrl,
        category_id: await this.getCategoryIdByName(normalized.category) || 1,
        is_active: true
      };
      
      // 포스트 배열에 추가
      posts.push(newPost);
      
      // 파일에 저장
      await fs.writeFile(this.nutritionPostsFile, JSON.stringify(posts, null, 2), 'utf8');
      
      // 태그가 있다면 태그 관계도 저장
      if (nutritionData.tags && Array.isArray(nutritionData.tags) && nutritionData.tags.length > 0) {
        await this.saveTags(newId, nutritionData.tags);
      }
      
      // 관련 상품이 있다면 관련 상품도 저장
      if (nutritionData.relatedProducts && Array.isArray(nutritionData.relatedProducts) && nutritionData.relatedProducts.length > 0) {
        await this.saveRelatedProducts(newId, nutritionData.relatedProducts);
      }
      
      // 캐시 무효화
      this.cache.delete('nutrition_posts');
      
      console.log(`새 영양 정보 생성: ${newId} - ${newPost.title}`);
      return newId;
    } catch (error) {
      console.error('새 영양 정보 생성 오류:', error);
      throw error;
    }
  }

  /**
   * 영양 정보 삭제
   */
  async deleteNutritionInfo(id) {
    try {
      const posts = await this.readJsonFile(this.nutritionPostsFile);
      const postIndex = posts.findIndex(p => p.id === id);
      
      if (postIndex === -1) {
        return false; // 포스트를 찾을 수 없음
      }
      
      // 포스트 제거
      const deletedPost = posts.splice(postIndex, 1)[0];
      
      // 파일에 저장
      await fs.writeFile(this.nutritionPostsFile, JSON.stringify(posts, null, 2), 'utf8');
      
      // 관련 태그 삭제
      await this.deletePostTags(id);
      
      // 관련 상품 삭제
      await this.deletePostRelatedProducts(id);
      
      // 캐시 무효화
      this.cache.delete('nutrition_posts');
      this.cache.delete('post_tags');
      this.cache.delete('related_products');
      
      console.log(`영양 정보 삭제: ${id} - ${deletedPost.title}`);
      return true;
    } catch (error) {
      console.error('영양 정보 삭제 오류:', error);
      throw error;
    }
  }

  /**
   * 포스트의 태그 삭제
   */
  async deletePostTags(postId) {
    try {
      const postTags = await this.readJsonFile(this.postTagsFile);
      const filteredPostTags = postTags.filter(pt => pt.post_id !== postId);
      
      if (filteredPostTags.length !== postTags.length) {
        await fs.writeFile(this.postTagsFile, JSON.stringify(filteredPostTags, null, 2), 'utf8');
        console.log(`포스트 태그 삭제: ${postId}`);
      }
    } catch (error) {
      console.error('포스트 태그 삭제 오류:', error);
      // 에러가 있어도 계속 진행
    }
  }

  /**
   * 포스트의 관련 상품 삭제
   */
  async deletePostRelatedProducts(postId) {
    try {
      const relatedProducts = await this.readJsonFile(this.relatedProductsFile);
      const filteredProducts = relatedProducts.filter(rp => rp.post_id !== postId);
      
      if (filteredProducts.length !== relatedProducts.length) {
        await fs.writeFile(this.relatedProductsFile, JSON.stringify(filteredProducts, null, 2), 'utf8');
        console.log(`포스트 관련 상품 삭제: ${postId}`);
      }
    } catch (error) {
      console.error('포스트 관련 상품 삭제 오류:', error);
      // 에러가 있어도 계속 진행
    }
  }

  /**
   * 태그 저장
   */
  async saveTags(postId, tagNames) {
    try {
      const tags = await this.loadTags();
      const postTags = await this.loadPostTags();
      
      for (const tagName of tagNames) {
        // 태그가 존재하는지 확인
        let tag = tags.find(t => t.name === tagName);
        
        if (!tag) {
          // 새 태그 생성
          const maxTagId = tags.length > 0 ? Math.max(...tags.map(t => parseInt(t.id) || 0)) : 0;
          const newTagId = (maxTagId + 1).toString();
          
          tag = {
            id: newTagId,
            name: tagName,
            created_at: new Date().toISOString()
          };
          
          tags.push(tag);
          await fs.writeFile(this.tagsFile, JSON.stringify(tags, null, 2), 'utf8');
        }
        
        // 포스트-태그 관계 저장
        const existingRelation = postTags.find(pt => pt.post_id === postId && pt.tag_id === tag.id);
        if (!existingRelation) {
          postTags.push({
            post_id: postId,
            tag_id: tag.id,
            created_at: new Date().toISOString()
          });
        }
      }
      
      // 포스트-태그 관계 파일 저장
      await fs.writeFile(this.postTagsFile, JSON.stringify(postTags, null, 2), 'utf8');
      
      // 캐시 무효화
      this.cache.delete('tags');
      this.cache.delete('post_tags');
    } catch (error) {
      console.error('태그 저장 오류:', error);
      throw error;
    }
  }

  /**
   * 관련 상품 저장
   */
  async saveRelatedProducts(postId, relatedProducts) {
    try {
      console.log(`🔗 관련상품 저장 시작 - 포스트 ID: ${postId}, 상품 수: ${relatedProducts.length}`);
      console.log('관련상품 데이터:', JSON.stringify(relatedProducts, null, 2));
      
      const products = await this.loadRelatedProducts();
      console.log(`기존 관련상품 수: ${products.length}`);
      
      for (const product of relatedProducts) {
        const productData = {
          post_id: postId,
          product_id: product.id || null,
          product_name: product.name || '',
          product_url: product.url || '',
          product_price: product.price || null,
          product_image_url: product.imageUrl || null,
          created_at: new Date().toISOString()
        };
        
        console.log('저장할 상품 데이터:', JSON.stringify(productData, null, 2));
        products.push(productData);
      }
      
      console.log(`저장 후 총 관련상품 수: ${products.length}`);
      
      // 관련 상품 파일 저장
      await fs.writeFile(this.relatedProductsFile, JSON.stringify(products, null, 2), 'utf8');
      console.log(`✅ 관련상품 파일 저장 완료: ${this.relatedProductsFile}`);
      
      // 캐시 무효화
      this.cache.delete('related_products');
      console.log('관련상품 캐시 무효화 완료');
    } catch (error) {
      console.error('관련 상품 저장 오류:', error);
      throw error;
    }
  }

  /**
   * 새로운 포스팅 생성
   * @param {Object} postData - 포스팅 데이터
   * @param {Object} adminInfo - 관리자 정보
   * @returns {Promise<Object>} 생성된 포스팅 데이터
   */
  async createPost(postData, adminInfo) {
    try {
      const posts = await this.readJsonFile(this.nutritionPostsFile);
      
      // 새 포스팅 ID 생성 (기존 포스팅 중 가장 큰 ID + 1)
      const maxId = posts.reduce((max, post) => Math.max(max, parseInt(post.id) || 0), 0);
      const newId = (maxId + 1).toString();
      
      // base64 -> URL 정규화
      const projectRoot = path.join(__dirname, '..');
      const normalized = await normalizePostMedia({
        title: postData.title,
        summary: postData.summary,
        content: postData.content,
        sourceUrl: postData.sourceUrl || null,
        sourceName: postData.sourceName || null,
        imageUrl: postData.imageUrl || null,
        thumbnailUrl: postData.thumbnailUrl || null,
      }, projectRoot, newId);

      // 새 포스팅 데이터 생성
      const now = new Date().toISOString();
      const newPost = {
        id: newId,
        title: normalized.title,
        summary: normalized.summary,
        content: normalized.content,
        source_url: normalized.sourceUrl,
        source_name: normalized.sourceName,
        category_id: postData.categoryId,
        image_url: normalized.imageUrl || null,
        thumbnail_url: normalized.thumbnailUrl || null,
        is_draft: postData.isDraft || false,
        admin_id: adminInfo.id,
        admin_name: adminInfo.name,
        source_type: 'manual',
        is_manual_post: true,
        trust_score: 100,
        published_date: now,  // 발행일 추가
        collected_date: now,  // 수집일 추가
        created_at: now,
        updated_at: now,
        is_active: true,
        view_count: 0,
        like_count: 0
      };
      
      // 포스팅 배열에 추가
      posts.push(newPost);
      
      // 파일에 저장
      await fs.writeFile(this.nutritionPostsFile, JSON.stringify(posts, null, 2), 'utf8');
      
      // 태그 처리 (tags가 있는 경우)
      if (postData.tags && postData.tags.length > 0) {
        await this.saveTags(newId, postData.tags);
      }
      
      // 관련 상품 처리 (relatedProducts가 있는 경우)
      if (postData.relatedProducts && postData.relatedProducts.length > 0) {
        await this.saveRelatedProducts(newId, postData.relatedProducts.map(product => ({
          name: product.name,
          url: product.link,
          price: product.price || null,
          imageUrl: product.imageUrl || null
        })));
      }
      
      // 캐시 무효화
      this.cache.delete('nutrition_posts');
      
      console.log(`✅ 로컬 포스팅 생성 성공: ${newId}`);
      return newPost;
      
    } catch (error) {
      console.error('포스팅 생성 오류:', error);
      throw error;
    }
  }

  /**
   * 포스팅 조회 (ID로)
   * @param {string} postId - 포스팅 ID
   * @returns {Promise<Object|null>} 포스팅 데이터 또는 null
   */
  async getPostById(postId) {
    try {
      const posts = await this.readJsonFile(this.nutritionPostsFile);
      return posts.find(post => post.id === postId) || null;
    } catch (error) {
      console.error('포스팅 조회 오류:', error);
      throw error;
    }
  }

  /**
   * 임시저장 포스팅 목록 조회
   * @param {string} adminId - 관리자 ID
   * @returns {Promise<Array>} 임시저장 포스팅 목록
   */
  async getDrafts(adminId) {
    try {
      const posts = await this.readJsonFile(this.nutritionPostsFile);
      return posts.filter(post => post.is_draft === true && post.admin_id === adminId);
    } catch (error) {
      console.error('임시저장 조회 오류:', error);
      throw error;
    }
  }

  /**
   * 포스팅 삭제
   * @param {string} postId - 포스팅 ID
   * @returns {Promise<boolean>} 삭제 성공 여부
   */
  async deletePost(postId) {
    try {
      const posts = await this.readJsonFile(this.nutritionPostsFile);
      const index = posts.findIndex(post => post.id === postId);
      
      if (index === -1) {
        return false;
      }
      
      // 포스팅 삭제
      posts.splice(index, 1);
      
      // 파일에 저장
      await fs.writeFile(this.nutritionPostsFile, JSON.stringify(posts, null, 2), 'utf8');
      
      // 관련 태그 관계 삭제
      const postTags = await this.readJsonFile(this.postTagsFile);
      const filteredPostTags = postTags.filter(pt => pt.post_id !== postId);
      await fs.writeFile(this.postTagsFile, JSON.stringify(filteredPostTags, null, 2), 'utf8');
      
      // 관련 상품 관계 삭제
      const relatedProducts = await this.readJsonFile(this.relatedProductsFile);
      const filteredProducts = relatedProducts.filter(rp => rp.post_id !== postId);
      await fs.writeFile(this.relatedProductsFile, JSON.stringify(filteredProducts, null, 2), 'utf8');
      
      // 캐시 무효화
      this.cache.delete('nutrition_posts');
      this.cache.delete('post_tags');
      this.cache.delete('related_products');
      
      return true;
    } catch (error) {
      console.error('포스팅 삭제 오류:', error);
      throw error;
    }
  }

  /**
   * 캐시 정리
   */
  clearCache() {
    this.cache.clear();
  }
}

module.exports = LocalNutritionDataManager;
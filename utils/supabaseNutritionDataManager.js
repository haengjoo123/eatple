/**
 * Supabase 기반 영양 정보 데이터 관리 유틸리티
 * Requirements: 6.1, 7.1 - Supabase 데이터 통합 조회
 */

const { createClient } = require('@supabase/supabase-js');
const NutritionInfo = require("../models/NutritionInfo");
const SupabaseImageManager = require("./supabaseImageManager");
const path = require("path");

// 로그용 데이터 정리 헬퍼 함수 (긴 base64 데이터 등을 간략화)
function sanitizeForLog(data, maxLength = 100) {
  if (!data) return data;
  
  // 배열인 경우
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForLog(item, maxLength));
  }
  
  // 객체가 아닌 경우
  if (typeof data !== 'object') {
    if (typeof data === 'string') {
      // base64 이미지 데이터 감지
      if (data.startsWith('data:image/') || data.length > 1000) {
        return `[${data.substring(0, 20)}...] (${data.length} chars)`;
      } else if (data.length > maxLength) {
        return data.substring(0, maxLength) + `... (${data.length} chars)`;
      }
    }
    return data;
  }
  
  // 객체인 경우
  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      // base64 이미지 데이터 감지
      if (value.startsWith('data:image/') || value.length > 1000) {
        sanitized[key] = `[${value.substring(0, 20)}...] (${value.length} chars)`;
      } else if (value.length > maxLength) {
        sanitized[key] = value.substring(0, maxLength) + `... (${value.length} chars)`;
      } else {
        sanitized[key] = value;
      }
    } else if (typeof value === 'object' && value !== null) {
      // 재귀적으로 객체 처리
      sanitized[key] = sanitizeForLog(value, maxLength);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

class SupabaseNutritionDataManager {
  constructor() {
    // Supabase 클라이언트 초기화
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase URL과 Service Role Key가 환경 변수에 설정되어 있어야 합니다.');
    }
    
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    this.imageManager = new SupabaseImageManager();
    
    console.log('📁 SupabaseNutritionDataManager 초기화 완료');
  }

  /**
   * base64 이미지를 Supabase Storage에 업로드
   * @param {string} dataUrl - data URL 형식의 이미지
   * @param {string} folder - 업로드할 폴더 (기본값: 'posts')
   * @returns {Promise<string|null>} 업로드된 이미지 URL 또는 null
   */
  async uploadBase64Image(dataUrl, folder = 'posts') {
    try {
      if (!dataUrl || !dataUrl.startsWith('data:')) {
        return dataUrl; // data URL이 아니면 그대로 반환
      }

      // data URL 파싱
      const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
      if (!match) return dataUrl;

      const mimeType = match[1] || 'image/png';
      const isBase64 = Boolean(match[2]);
      const dataPart = match[3];
      
      const buffer = isBase64 
        ? Buffer.from(dataPart, 'base64') 
        : Buffer.from(decodeURIComponent(dataPart), 'utf8');

      // 파일명 생성
      const ext = mimeType.split('/')[1] || 'png';
      const originalName = `image_${Date.now()}.${ext}`;

      // Supabase Storage에 업로드
      const result = await this.imageManager.uploadImage(buffer, originalName, mimeType, folder);
      
      if (result.success) {
        console.log(`✅ 이미지 업로드 성공: ${result.url}`);
        return result.url;
      } else {
        console.error(`❌ 이미지 업로드 실패:`, result.error);
        return dataUrl; // 실패 시 원본 반환
      }
    } catch (error) {
      console.error('이미지 업로드 오류:', error);
      return dataUrl; // 오류 시 원본 반환
    }
  }

  /**
   * content 내의 모든 base64 이미지를 Supabase Storage에 업로드
   * @param {string} content - HTML 콘텐츠
   * @param {string} folder - 업로드할 폴더
   * @returns {Promise<string>} 변환된 콘텐츠
   */
  async replaceBase64ImagesInContent(content, folder = 'posts') {
    if (!content || !content.includes('data:')) {
      return content;
    }

    const imgRegex = /<img[^>]+src="(data:[^"]+)"[^>]*>/gi;
    const matches = [...content.matchAll(imgRegex)];
    
    let updatedContent = content;
    
    for (const match of matches) {
      const originalDataUrl = match[1];
      const uploadedUrl = await this.uploadBase64Image(originalDataUrl, folder);
      
      if (uploadedUrl !== originalDataUrl) {
        updatedContent = updatedContent.replace(originalDataUrl, uploadedUrl);
      }
    }
    
    return updatedContent;
  }

  /**
   * 카테고리 데이터 로드
   */
  async loadCategories() {
    try {
      const { data, error } = await this.supabase
        .from('categories')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('카테고리 로드 오류:', error);
      return [];
    }
  }

  /**
   * 태그 데이터 로드
   */
  async loadTags() {
    try {
      const { data, error } = await this.supabase
        .from('tags')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('태그 로드 오류:', error);
      return [];
    }
  }

  /**
   * 포스트-태그 관계 데이터 로드
   */
  async loadPostTags() {
    try {
      const { data, error } = await this.supabase
        .from('post_tags')
        .select('*');
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('포스트-태그 관계 로드 오류:', error);
      return [];
    }
  }

  /**
   * 관련 상품 데이터 로드
   */
  async loadRelatedProducts() {
    try {
      const { data, error } = await this.supabase
        .from('post_related_products')
        .select('*')
        .order('display_order');
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('관련 상품 로드 오류:', error);
      return [];
    }
  }

  /**
   * 영양 정보 포스트 데이터 로드
   */
  async loadNutritionPosts() {
    try {
      const { data, error } = await this.supabase
        .from('nutrition_posts')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('영양정보 포스트 로드 오류:', error);
      return [];
    }
  }

  /**
   * 카테고리 이름으로 ID 찾기
   */
  async getCategoryIdByName(categoryName) {
    try {
      console.log(`[CATEGORY DEBUG] 카테고리 이름으로 ID 조회: "${categoryName}"`);
      
      const { data, error } = await this.supabase
        .from('categories')
        .select('id')
        .eq('name', categoryName)
        .single();
      
      if (error) {
        console.error(`[CATEGORY DEBUG] 카테고리 조회 오류:`, error);
        throw error;
      }
      
      const categoryId = data?.id || null;
      console.log(`[CATEGORY DEBUG] 조회된 카테고리 ID: "${categoryId}"`);
      
      return categoryId;
    } catch (error) {
      console.error(`[CATEGORY DEBUG] 카테고리 ID 조회 실패:`, error);
      return null;
    }
  }

  /**
   * 포스트의 태그 가져오기
   */
  async getPostTags(postId) {
    try {
      const { data, error } = await this.supabase
        .from('post_tags')
        .select(`
          tags (
            name
          )
        `)
        .eq('post_id', postId);
      
      if (error) throw error;
      return data?.map(item => item.tags.name) || [];
    } catch (error) {
      console.error('포스트 태그 조회 오류:', error);
      return [];
    }
  }

  /**
   * 포스트의 관련 상품 가져오기
   */
  async getPostRelatedProducts(postId) {
    try {
      const { data, error } = await this.supabase
        .from('post_related_products')
        .select('*')
        .eq('post_id', postId)
        .order('display_order');
      
      if (error) throw error;
      
      // 프론트엔드가 기대하는 형식으로 변환
      const formattedProducts = (data || []).map(product => ({
        id: product.product_id || product.id,
        product_name: product.product_name,
        product_link: product.product_link,
        product_price: product.product_price,
        product_image_url: product.product_image_url,
        created_at: product.created_at
      }));
      
      return formattedProducts;
    } catch (error) {
      console.error('관련상품 조회 오류:', error);
      return [];
    }
  }

  /**
   * 카테고리 정보 가져오기
   */
  async getCategoryInfo(categoryId) {
    try {
      const { data, error } = await this.supabase
        .from('categories')
        .select('*')
        .eq('id', categoryId)
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('카테고리 정보 조회 오류:', error);
      return null;
    }
  }

  /**
   * 영양 정보 목록 조회
   */
  async getNutritionInfoList(filters = {}, pagination = {}) {
    try {
      
      // 먼저 필드명 매핑 처리
      const fieldMapping = {
        'collectedDate': 'collected_date',
        'publishedDate': 'published_date',
        'trustScore': 'trust_score',
        'viewCount': 'view_count',
        'likeCount': 'like_count',
        'bookmarkCount': 'bookmark_count',
        'createdAt': 'created_at',
        'updatedAt': 'updated_at'
      };
      
      // 정렬 필드명 변환
      let sortBy = filters.sortBy || 'created_at';
      if (fieldMapping[sortBy]) {
        sortBy = fieldMapping[sortBy];
      }
      
      // 태그 필터링이 있는 경우 먼저 처리
      let postIdsFromTags = null;
      if (filters.tags && filters.tags.length > 0) {
        const { data: postsWithTags, error: tagError } = await this.supabase
          .from('post_tags')
          .select(`
            post_id,
            tags!inner (
              name
            )
          `)
          .in('tags.name', filters.tags);
        
        if (tagError) throw tagError;
        
        postIdsFromTags = postsWithTags?.map(p => p.post_id) || [];
        if (postIdsFromTags.length === 0) {
          // 해당 태그가 없으면 빈 결과 반환
          return {
            data: [],
            pagination: {
              page: pagination.page || 1,
              limit: pagination.limit || 20,
              offset: 0,
              count: 0,
              totalCount: 0,
              totalPages: 0
            }
          };
        }
      }
      
      // 성능 최적화: JOIN을 사용하여 한 번에 모든 관련 데이터 조회 (content 제외)
      let query = this.supabase
        .from('nutrition_posts')
        .select(`
          id,
          title,
          summary,
          source_type,
          source_name,
          source_url,
          published_date,
          collected_date,
          trust_score,
          view_count,
          thumbnail_url,
          image_url,
          category_id,
          is_active,
          is_draft,
          created_at,
          updated_at,
          categories(name),
          post_tags(
            tags(name)
          ),
          post_related_products!left(
            product_name,
            product_link,
            product_price,
            product_image_url,
            display_order
          )
        `, { count: 'estimated' });

      // 필터 적용
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        // content 필드를 조회하지 않으므로 검색에서도 제외
        query = query.or(`title.ilike.%${searchTerm}%,summary.ilike.%${searchTerm}%`);
      }

      if (filters.category) {
        const categoryNames = Array.isArray(filters.category) ? filters.category : [filters.category];
        
        // 성능 최적화: 한 번에 모든 카테고리 ID 조회
        const { data: categories, error: catError } = await this.supabase
          .from('categories')
          .select('id, name')
          .in('name', categoryNames);
        
        if (catError) throw catError;
        
        const categoryIds = (categories || []).map(c => c.id);
        
        if (categoryIds.length > 0) {
          query = query.in('category_id', categoryIds);
        } else {
          // 해당 카테고리가 없으면 빈 결과 반환
          return {
            data: [],
            pagination: {
              page: pagination.page || 1,
              limit: pagination.limit || 20,
              offset: 0,
              count: 0,
              totalCount: 0,
              totalPages: 0
            }
          };
        }
      }

      if (filters.sourceType && filters.sourceType.length > 0) {
        query = query.in('source_type', filters.sourceType);
      }

      // 태그 필터링 결과 적용
      if (postIdsFromTags !== null) {
        query = query.in('id', postIdsFromTags);
      }

      if (filters.minTrustScore !== undefined) {
        query = query.gte('trust_score', filters.minTrustScore);
      }

      if (filters.maxTrustScore !== undefined) {
        query = query.lte('trust_score', filters.maxTrustScore);
      }

      if (filters.dateFrom) {
        query = query.gte('published_date', filters.dateFrom);
      }

      if (filters.dateTo) {
        query = query.lte('published_date', filters.dateTo);
      }

      // 임시저장 제외 필터 (관리자 포스팅 목록용)
      if (filters.excludeDrafts) {
        query = query.eq('is_draft', false);
      }

      // 활성 상태 필터
      query = query.eq('is_active', true);

      // 정렬 (이미 변환된 필드명 사용)
      const sortOrder = filters.sortOrder || 'desc';
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      // 페이지네이션
      const page = pagination.page || 1;
      const limit = pagination.limit || 20;
      const offset = (page - 1) * limit;
      
      query = query.range(offset, offset + limit - 1);

      const { data: posts, error, count } = await query;
      
      if (error) throw error;

      // NutritionInfo 객체로 변환 (JOIN된 데이터 활용)
      const enrichedPosts = (posts || []).map(post => {
        // 태그 정보 추출
        const tags = (post.post_tags || [])
          .map(pt => pt.tags?.name)
          .filter(Boolean);

        // 관련 상품 정보 추출 및 정렬 (목록에서는 최대 3개만)
        const related_products = (post.post_related_products || [])
          .slice(0, 3) // 목록에서는 최대 3개만 표시
          .map(rp => ({
            id: undefined,
            product_name: rp.product_name,
            product_link: rp.product_link,
            product_price: rp.product_price,
            product_image_url: rp.product_image_url,
            display_order: rp.display_order,
          }))
          .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

        return new NutritionInfo({
          id: post.id,
          title: post.title,
          summary: post.summary,
          // content는 목록 조회에서 제외 (성능 최적화)
          content: null,
          sourceType: post.source_type,
          sourceName: post.source_name,
          sourceUrl: post.source_url,
          publishedDate: post.published_date,
          collectedDate: post.collected_date,
          trustScore: post.trust_score,
          viewCount: post.view_count || 0,
          thumbnailUrl: post.thumbnail_url,
          imageUrl: post.image_url,
          category: post.categories?.name || null,
          tags: tags,
          related_products: related_products,
          isActive: post.is_active
        });
      });

      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / limit);

      const result = {
        data: enrichedPosts,
        pagination: {
          page: page,
          limit: limit,
          offset: offset,
          count: enrichedPosts.length,
          totalCount: totalCount,
          totalPages: totalPages
        }
      };
      
      return result;
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
      const { data: post, error } = await this.supabase
        .from('nutrition_posts')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      if (!post) return null;

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
      const relatedProducts = await this.getPostRelatedProducts(post.id);

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
        isActive: post.is_active
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
   * 조회수 증가
   */
  async incrementViewCount(id, userInfo = null) {
    try {
      // 현재 조회수를 먼저 가져온 다음 증가
      const { data: currentPost, error: fetchError } = await this.supabase
        .from('nutrition_posts')
        .select('view_count')
        .eq('id', id)
        .single();
      
      if (fetchError) throw fetchError;
      
      const newViewCount = (currentPost.view_count || 0) + 1;
      
      // nutrition_posts 테이블의 view_count 업데이트
      const { error } = await this.supabase
        .from('nutrition_posts')
        .update({ 
          view_count: newViewCount,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
      
      if (error) throw error;
      
      // nutrition_post_views 테이블에 조회 기록 추가
      try {
        const viewRecord = {
          post_id: id,
          viewed_at: new Date().toISOString(),
          view_count: 1,
          user_id: userInfo?.userId || null,
          ip_address: userInfo?.ipAddress || null,
          user_agent: userInfo?.userAgent || null
        };
        
        const { error: viewError } = await this.supabase
          .from('nutrition_post_views')
          .insert(viewRecord);
        
        if (viewError) {
          console.warn('조회 기록 저장 실패 (무시):', viewError.message);
        }
      } catch (viewLogError) {
        console.warn('조회 기록 저장 오류 (무시):', viewLogError);
      }
      
      console.log(`조회수 증가: ${id} -> ${newViewCount}`);
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
      console.log(`📝 updateNutritionInfo 호출 - ID: ${id}`);
      console.log(`📝 업데이트 데이터:`, sanitizeForLog(updateData));
      
      // camelCase를 snake_case로 변환 (이미 snake_case인 경우는 그대로 유지)
      const snakeCaseData = {};
      Object.keys(updateData).forEach(key => {
        // 이미 snake_case인지 확인 (언더스코어가 있는 경우)
        if (key.includes('_')) {
          // 이미 snake_case이므로 그대로 사용
          snakeCaseData[key] = updateData[key];
        } else {
          // camelCase를 snake_case로 변환
          const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
          snakeCaseData[snakeKey] = updateData[key];
        }
      });
      
      // updated_at 자동 설정
      snakeCaseData.updated_at = new Date().toISOString();
      
      console.log(`📝 변환된 snake_case 데이터:`, sanitizeForLog(snakeCaseData));
      
      const { error } = await this.supabase
        .from('nutrition_posts')
        .update(snakeCaseData)
        .eq('id', id);
      
      if (error) {
        console.error(`❌ Supabase 업데이트 에러:`, error);
        throw error;
      }
      
      console.log(`✅ updateNutritionInfo 성공 - ID: ${id}`);
      return true;
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
      // base64 이미지를 Supabase Storage에 업로드
      const content = await this.replaceBase64ImagesInContent(nutritionData.content || '', 'posts');
      const thumbnailUrl = await this.uploadBase64Image(nutritionData.thumbnailUrl || null, 'posts');
      const imageUrl = await this.uploadBase64Image(nutritionData.imageUrl || null, 'posts');

      // 카테고리 ID 조회 및 검증
      const categoryId = await this.getCategoryIdByName(nutritionData.category);
      console.log(`[POSTING DEBUG] 카테고리 매핑: "${nutritionData.category}" -> "${categoryId}"`);
      
      if (!categoryId) {
        throw new Error(`카테고리를 찾을 수 없습니다: "${nutritionData.category}"`);
      }

      // 새 포스트 데이터 구성
      const newPost = {
        title: nutritionData.title || '',
        summary: nutritionData.summary || '',
        content: content,
        source_type: nutritionData.sourceType || 'manual',
        source_name: nutritionData.sourceName || 'Admin',
        source_url: nutritionData.sourceUrl || null,
        published_date: nutritionData.publishedDate || new Date().toISOString(),
        collected_date: new Date().toISOString(),
        trust_score: nutritionData.trustScore || 80,
        view_count: 0,
        thumbnail_url: thumbnailUrl,
        image_url: imageUrl,
        category_id: categoryId,
        is_active: true
      };
      
      console.log(`[POSTING DEBUG] 생성할 포스트 데이터:`, {
        title: newPost.title,
        category_id: newPost.category_id,
        category_name: nutritionData.category
      });
      
      // 포스트 생성
      const { data: createdPost, error } = await this.supabase
        .from('nutrition_posts')
        .insert([newPost])
        .select()
        .single();
      
      if (error) throw error;
      
      const newId = createdPost.id;
      
      // 태그가 있다면 태그 관계도 저장
      if (nutritionData.tags && Array.isArray(nutritionData.tags) && nutritionData.tags.length > 0) {
        await this.saveTags(newId, nutritionData.tags);
      }
      
      // 관련 상품이 있다면 관련 상품도 저장
      if (nutritionData.relatedProducts && Array.isArray(nutritionData.relatedProducts) && nutritionData.relatedProducts.length > 0) {
        await this.saveRelatedProducts(newId, nutritionData.relatedProducts);
      }
      
      console.log(`새 영양 정보 생성: ${newId} - ${createdPost.title}`);
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
      const { error } = await this.supabase
        .from('nutrition_posts')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      console.log(`영양 정보 삭제: ${id}`);
      return true;
    } catch (error) {
      console.error('영양 정보 삭제 오류:', error);
      throw error;
    }
  }

  /**
   * 태그 저장 (기존 태그 삭제 후 새로 저장)
   */
  async saveTags(postId, tagNames) {
    try {
      console.log(`🏷️ 태그 저장 시작 - 포스트 ID: ${postId}, 태그 수: ${tagNames.length}`);
      
      // 1. 기존 태그 관계 모두 삭제
      const { error: deleteError } = await this.supabase
        .from('post_tags')
        .delete()
        .eq('post_id', postId);
      
      if (deleteError) {
        console.error('기존 태그 관계 삭제 오류:', deleteError);
        throw deleteError;
      }
      
      console.log(`🗑️ 기존 태그 관계 삭제 완료 - 포스트 ID: ${postId}`);
      
      // 2. 새로운 태그 저장 (태그가 있는 경우에만)
      if (tagNames && tagNames.length > 0) {
        for (const tagName of tagNames) {
          if (!tagName || !tagName.trim()) continue;
          
          // 태그가 존재하는지 확인
          let { data: tag, error } = await this.supabase
            .from('tags')
            .select('id')
            .eq('name', tagName.trim())
            .single();
          
          if (error && error.code !== 'PGRST116') { // PGRST116: No rows found
            throw error;
          }
          
          if (!tag) {
            // 새 태그 생성
            const { data: newTag, error: createError } = await this.supabase
              .from('tags')
              .insert([{ name: tagName.trim() }])
              .select()
              .single();
            
            if (createError) throw createError;
            tag = newTag;
          }
          
          // 포스트-태그 관계 저장
          const { error: relationError } = await this.supabase
            .from('post_tags')
            .insert([{
              post_id: postId,
              tag_id: tag.id
            }]);
          
          if (relationError) throw relationError;
        }
        console.log(`✅ 태그 저장 완료 - ${tagNames.length}개`);
      } else {
        console.log(`ℹ️ 저장할 태그가 없음 - 포스트 ID: ${postId}`);
      }
      
    } catch (error) {
      console.error('태그 저장 오류:', error);
      throw error;
    }
  }

  /**
   * 관련 상품 저장 (기존 상품 삭제 후 새로 저장)
   */
  async saveRelatedProducts(postId, relatedProducts) {
    try {
      console.log(`🔗 관련상품 저장 시작 - 포스트 ID: ${postId}, 상품 수: ${relatedProducts.length}`);
      
      // 1. 기존 관련상품 모두 삭제
      const { error: deleteError } = await this.supabase
        .from('post_related_products')
        .delete()
        .eq('post_id', postId);
      
      if (deleteError) {
        console.error('기존 관련상품 삭제 오류:', deleteError);
        throw deleteError;
      }
      
      console.log(`🗑️ 기존 관련상품 삭제 완료 - 포스트 ID: ${postId}`);
      
      // 2. 새로운 관련상품 삽입 (상품이 있는 경우에만)
      if (relatedProducts && relatedProducts.length > 0) {
        const productsToInsert = relatedProducts.map((product, index) => ({
          post_id: postId,
          product_id: product.id || null,
          product_name: product.name || '',
          product_link: product.link || product.url || '',
          product_price: product.price || null,
          product_image_url: product.imageUrl || null,
          display_order: index
        }));
        
        console.log(`➕ 새로운 관련상품 삽입 시작 - ${productsToInsert.length}개`);
        const { error: insertError } = await this.supabase
          .from('post_related_products')
          .insert(productsToInsert);
        
        if (insertError) {
          console.error('새로운 관련상품 삽입 오류:', insertError);
          throw insertError;
        }
        
        console.log(`✅ 새로운 관련상품 삽입 완료 - ${productsToInsert.length}개`);
      } else {
        console.log(`ℹ️ 삽입할 관련상품이 없음 - 포스트 ID: ${postId}`);
      }
      
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
      // base64 이미지를 Supabase Storage에 업로드
      const content = await this.replaceBase64ImagesInContent(postData.content || '', 'posts');
      const thumbnailUrl = await this.uploadBase64Image(postData.thumbnailUrl || null, 'posts');
      const imageUrl = await this.uploadBase64Image(postData.imageUrl || null, 'posts');

      // 새 포스팅 데이터 생성
      const now = new Date().toISOString();
      const newPost = {
        title: postData.title,
        summary: postData.summary,
        content: content,
        source_url: postData.sourceUrl || null,
        source_name: postData.sourceName || null,
        category_id: postData.categoryId,
        image_url: imageUrl,
        thumbnail_url: thumbnailUrl,
        is_draft: postData.isDraft || false,
        admin_id: adminInfo.id,
        admin_name: adminInfo.name,
        source_type: 'manual',
        is_manual_post: true,
        trust_score: 100,
        published_date: now,
        collected_date: now,
        created_at: now,
        updated_at: now,
        is_active: true,
        view_count: 0,
        like_count: 0
      };
      
      // 포스팅 생성
      const { data: createdPost, error } = await this.supabase
        .from('nutrition_posts')
        .insert([newPost])
        .select()
        .single();
      
      if (error) throw error;
      
      
      // 태그 처리 (tags가 있는 경우)
      if (postData.tags && postData.tags.length > 0) {
        await this.saveTags(createdPost.id, postData.tags);
      }
      
      // 관련 상품 처리 (relatedProducts가 있는 경우)
      if (postData.relatedProducts && postData.relatedProducts.length > 0) {
        try {
          await this.saveRelatedProducts(createdPost.id, postData.relatedProducts.map(product => ({
            name: product.name,
            url: product.link,
            price: product.price || null,
            imageUrl: product.imageUrl || null
          })));
        } catch (relatedError) {
          console.error(`❌ 관련상품 저장 오류:`, relatedError);
          // 관련상품 저장 실패해도 포스팅은 생성 계속
        }
      }
      
      console.log(`✅ Supabase 포스팅 생성 성공: ${createdPost.id}`);
      return createdPost;
      
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
      const { data: post, error } = await this.supabase
        .from('nutrition_posts')
        .select('*')
        .eq('id', postId)
        .single();
      
      if (error) throw error;
      return post;
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
      const { data, error } = await this.supabase
        .from('nutrition_posts')
        .select('*')
        .eq('is_draft', true)
        .eq('admin_id', adminId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
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
      const { error } = await this.supabase
        .from('nutrition_posts')
        .delete()
        .eq('id', postId);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('포스팅 삭제 오류:', error);
      throw error;
    }
  }

  /**
   * 캐시 정리 (Supabase에서는 불필요하지만 호환성을 위해 유지)
   */
  clearCache() {
    // Supabase는 자체적으로 캐싱을 관리하므로 별도 작업 불필요
  }
}

module.exports = SupabaseNutritionDataManager;

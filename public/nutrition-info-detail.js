/**
 * 영양 정보 상세 페이지 JavaScript
 * Requirements: 1.3, 3.3
 */

class NutritionInfoDetailManager {
    constructor() {
        this.nutritionInfoId = null;
        this.nutritionInfo = null;
        this.userInteractionState = {
            isBookmarked: false,
            isLiked: false
        };
        // 클라이언트 캐시 설정 (SWR 전략)
        // 왜: Supabase 응답 지연 시 사용자에게 즉시 콘텐츠를 보여주고, 백그라운드에서 최신화하기 위함
        this.CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12시간 TTL
        this.RECOMMENDATION_CACHE_TTL_MS = 30 * 60 * 1000; // 추천 정보 30분 TTL
        
        // 영양정보 데이터
        this.nutritionInfo = null;
        
        this.initializeElements();
        this.bindEvents();
        
        // 바로 데이터 로드 시작
        this.loadNutritionInfoDetail();
    }

    initializeElements() {
        // 상태 요소들 - null 체크 추가
        this.loadingState = document.getElementById('loadingState');
        this.errorState = document.getElementById('errorState');
        this.detailContent = document.getElementById('detailContent');
        this.errorMessage = document.getElementById('errorMessage');
        this.retryBtn = document.getElementById('retryBtn');

        // 필수 요소들이 없으면 오류 로그 출력
        if (!this.detailContent) {
            console.error('detailContent 요소를 찾을 수 없습니다');
        }
        if (!this.loadingState) {
            console.error('loadingState 요소를 찾을 수 없습니다');
        }
        if (!this.errorState) {
            console.error('errorState 요소를 찾을 수 없습니다');
        }

        // 상세 정보 요소들
        this.breadcrumbTitle = document.getElementById('breadcrumbTitle');
        this.breadcrumbCategory = document.getElementById('breadcrumbCategory');
        this.breadcrumbSubcategory = document.getElementById('breadcrumbSubcategory');
        this.breadcrumbSeparator = document.getElementById('breadcrumbSeparator');
        this.breadcrumbCategorySeparator = document.getElementById('breadcrumbCategorySeparator');

        
        this.detailTitle = document.getElementById('detailTitle');
        this.detailSource = document.getElementById('detailSource');
        this.detailDate = document.getElementById('detailDate');
        this.detailAuthor = document.getElementById('detailAuthor');
        
        this.detailImage = document.getElementById('detailImage');
        this.detailSummary = document.getElementById('detailSummary');
        this.detailMainContent = document.getElementById('detailMainContent');
        this.detailContentSection = document.getElementById('detailContentSection');
        this.detailTags = document.getElementById('detailTags');
        this.detailOriginalContent = document.getElementById('detailOriginalContent');
        this.originalSection = document.getElementById('originalSection');
        this.detailSourceLink = document.getElementById('detailSourceLink');

        // 액션 버튼들
        this.detailBookmarkBtn = document.getElementById('detailBookmarkBtn');
        this.detailShareBtn = document.getElementById('detailShareBtn');

        // 관련 정보 컨테이너들
        this.recommendedInfo = document.getElementById('recommendedInfo');
    }

    bindEvents() {
        // 재시도 버튼 - null 체크 추가
        if (this.retryBtn) {
            this.retryBtn.addEventListener('click', () => this.loadNutritionInfoDetail());
        }

        // 액션 버튼들 - null 체크 추가
        if (this.detailBookmarkBtn) {
            this.detailBookmarkBtn.addEventListener('click', () => this.handleBookmark());
        }
        if (this.detailShareBtn) {
            this.detailShareBtn.addEventListener('click', () => this.handleShare());
        }

        // 뒤로가기 처리
        window.addEventListener('popstate', () => {
            window.location.href = 'nutrition-info.html';
        });

        // 페이지 언로드 시 리소스 정리
        window.addEventListener('beforeunload', () => this.cleanup());

        // 창 크기 변경 시 브레드 크럼 업데이트
        window.addEventListener('resize', () => {
            if (this.nutritionInfo) {
                this.renderBreadcrumb(this.nutritionInfo);
            }
        });
    }

    async loadNutritionInfoDetail() {
        // URL에서 ID 추출
        const urlParams = new URLSearchParams(window.location.search);
        this.nutritionInfoId = urlParams.get('id');

        if (!this.nutritionInfoId) {
            this.showError('영양 정보 ID가 제공되지 않았습니다.');
            return;
        }

        // 일반 로딩 사용
        await this.loadNutritionInfoFallback();
    }


    async loadNutritionInfoFallback() {
        // 간단한 로딩 표시
        this.showLoading();

        // 1) 클라이언트 캐시가 있으면 즉시 렌더 (SWR의 stale 단계)
        const cacheKey = this.getCacheKey(this.nutritionInfoId);
        const cached = this.readCache(cacheKey);
        if (cached && cached.data && cached.data.title) {
            // 클라이언트 캐시에서 조회
            this.nutritionInfo = cached.data;
            
            // 캐시된 데이터로 점진적 렌더링 시작
            await this.renderProgressively();
        } else if (cached && cached.data && !cached.data.title) {
            console.warn(`[CLIENT CACHE INVALID] 영양정보 ${this.nutritionInfoId} 클라이언트 캐시 데이터가 유효하지 않음`);
            // 유효하지 않은 캐시 삭제
            this.writeCache(cacheKey, null);
        }

        try {
            // 2) 로컬 서버 API 호출 (캐시 우선 처리됨)
            const fetchOptions = { credentials: 'include', headers: {} };
            if (cached && cached.etag) {
                fetchOptions.headers['If-None-Match'] = cached.etag;
            }
            
            // 로컬 서버 API 호출
            const response = await fetch(`/api/nutrition-info/${this.nutritionInfoId}`, fetchOptions);

            // 304 Not Modified는 정상 응답이므로 먼저 처리
            if (response.status === 304 && cached && cached.data) {
                // 변경 없음
                // 304 응답 시에는 이미 캐시된 데이터로 렌더링 완료되었으므로 종료
                return;
            }

            // 304가 아닌 경우에만 다른 에러 상태 확인
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('해당 영양 정보를 찾을 수 없습니다.');
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            
            if (result.success && result.data) {
                this.nutritionInfo = result.data;
                
                // 서버에서 캐시된 데이터인지 확인
                if (result.cached) {
                    // 서버 캐시에서 조회
                } else {
                    // Supabase에서 직접 조회
                }
                
                // 클라이언트 캐시 업데이트
                const etag = response.headers.get('ETag');
                this.writeCache(cacheKey, {
                    data: this.nutritionInfo,
                    etag: etag || null,
                    cachedAt: Date.now(),
                    serverCached: result.cached || false
                });
                
                // 렌더링 전 데이터 유효성 최종 확인
                if (this.nutritionInfo && this.nutritionInfo.title) {
                    // 새로운 데이터로 점진적 렌더링 (캐시에서 이미 렌더링했다면 업데이트)
                    await this.renderProgressively();
                } else {
                    console.error('렌더링 실패: 영양정보 데이터가 유효하지 않음', this.nutritionInfo);
                    this.showError('영양정보 데이터를 불러올 수 없습니다.');
                }
            } else {
                throw new Error(result.error || '데이터를 불러오는데 실패했습니다.');
            }
        } catch (error) {
            console.error('영양 정보 상세 로딩 오류:', error);
            if (!(cached && cached.data)) {
                // 클라이언트 캐시도 없고 네트워크도 실패
                this.showError(error.message);
            } else {
                // 클라이언트 캐시로 이미 보여주고 있는 상태라면 조용히 처리
                // 네트워크 문제로 캐시 데이터를 표시 중
            }
        }
    }

    // 점진적 렌더링 메서드
    async renderProgressively() {
        // 1단계: 기본 정보 렌더링 (제목, 메타 정보)
        await this.renderBasicInfo();
        await this.delay(50); // 지연 시간 단축

        // 2단계: 이미지 렌더링
        await this.renderImage();
        await this.delay(50);

        // 3단계: 요약 정보 렌더링
        await this.renderSummary();
        await this.delay(50);

        // 4단계: 상세 내용 렌더링
        await this.renderDetailContent();
        await this.delay(50);

        // 5단계: 태그 및 액션 버튼 렌더링
        await this.renderTagsAndActions();
        await this.delay(50);

        // 6단계: 사용자 상호작용 상태와 추천 정보를 병렬로 로드 (백그라운드)
        // requestIdleCallback을 사용하여 브라우저가 유휴 상태일 때 실행
        if (window.requestIdleCallback) {
            requestIdleCallback(() => {
                Promise.allSettled([
                    this.loadUserInteractionState().then(() => {
                        this.updateActionButtons();
                    }),
                    this.loadRecommendedInfo()
                ]).catch(error => {
                    console.warn('백그라운드 데이터 로드 중 일부 실패:', error);
                });
            });
        } else {
            // requestIdleCallback을 지원하지 않는 브라우저를 위한 폴백
            setTimeout(() => {
                Promise.allSettled([
                    this.loadUserInteractionState().then(() => {
                        this.updateActionButtons();
                    }),
                    this.loadRecommendedInfo()
                ]).catch(error => {
                    console.warn('백그라운드 데이터 로드 중 일부 실패:', error);
                });
            }, 100);
        }
    }

    // 지연 유틸리티
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 브레드 크럼 렌더링 메서드
    renderBreadcrumb(info) {
        // 모바일 환경 감지
        const isMobile = window.innerWidth <= 768;
        
        // 카테고리 정보가 있는 경우에만 표시
        if (info.category) {
            const categoryLabel = this.getCategoryLabel(info.category);
            const subcategoryLabel = this.getSubcategoryLabel(info.category, info.subcategory);
            
            // 대분류 표시 (호버 효과 제거)
            if (categoryLabel) {
                this.breadcrumbCategory.textContent = categoryLabel;
                this.breadcrumbCategory.style.display = 'inline';
                this.breadcrumbCategory.style.cursor = 'default';
                this.breadcrumbCategory.style.color = '#666';
                this.breadcrumbCategory.style.textDecoration = 'none';
            } else {
                this.breadcrumbCategory.style.display = 'none';
            }
            
            // 소분류 표시 (클릭 가능하게 설정)
            if (subcategoryLabel) {
                this.breadcrumbSubcategory.textContent = subcategoryLabel;
                this.breadcrumbSubcategory.style.display = 'inline';
                this.breadcrumbCategorySeparator.style.display = 'inline';
                
                // 소분류를 클릭 가능한 링크로 설정
                this.breadcrumbSubcategory.style.cursor = 'pointer';
                this.breadcrumbSubcategory.style.color = '#4a69bd';
                this.breadcrumbSubcategory.style.textDecoration = 'none';
                
                // 소분류 클릭 이벤트 추가
                this.breadcrumbSubcategory.onclick = () => {
                    this.navigateToCategory(info.category);
                };
                
                // 모바일에서는 마지막 구분자 숨김
                if (isMobile) {
                    this.breadcrumbSeparator.style.display = 'none';
                } else {
                    this.breadcrumbSeparator.style.display = 'inline';
                }
            } else {
                this.breadcrumbSubcategory.style.display = 'none';
                this.breadcrumbCategorySeparator.style.display = 'none';
                this.breadcrumbSeparator.style.display = 'none';
            }
        } else {
            // 카테고리 정보가 없는 경우 숨김
            this.breadcrumbCategory.style.display = 'none';
            this.breadcrumbSubcategory.style.display = 'none';
            this.breadcrumbCategorySeparator.style.display = 'none';
            this.breadcrumbSeparator.style.display = 'none';
        }
    }

    // 카테고리 페이지로 이동하는 메서드
    navigateToCategory(category) {
        // 카테고리 필터가 적용된 영양정보 페이지로 이동
        const categoryParam = encodeURIComponent(category);
        window.location.href = `nutrition-info.html?category=${categoryParam}`;
    }

    // 단계별 렌더링 메서드들
    async renderBasicInfo() {
        if (!this.nutritionInfo) return;

        const info = this.nutritionInfo;
        
        // 실제 콘텐츠 표시
        this.showContent();
        
        // 페이지 제목 설정
        document.title = `${info.title} - 잇플`;
        
        // 브레드크럼
        this.renderBreadcrumb(info);
        this.breadcrumbTitle.textContent = this.truncateText(info.title, 30);
        this.breadcrumbTitle.classList.add('progressive-fade-in');

        // 헤더 정보
        this.detailTitle.textContent = info.title;
        this.detailSource.textContent = info.sourceName;
        this.detailDate.textContent = this.formatDate(info.publishedDate);
        
        if (info.author) {
            this.detailAuthor.textContent = info.author;
            this.detailAuthor.style.display = 'inline';
        } else {
            this.detailAuthor.style.display = 'none';
        }

        // 헤더에 애니메이션 적용
        document.querySelector('.detail-header').classList.add('progressive-fade-in');
    }

    async renderImage() {
        if (!this.nutritionInfo) return;

        const info = this.nutritionInfo;

        // 이미지 지연 로딩 및 WebP 최적화
        this.detailImage.loading = 'lazy';
        this.detailImage.decoding = 'async';
        
        // WebP 지원 확인 및 최적화된 이미지 URL 생성
        const imageUrl = this.getOptimizedImageUrl(info);
        this.detailImage.src = imageUrl;
        this.detailImage.alt = info.title;

        // 이미지 로드 완료 시 애니메이션 적용
        this.detailImage.onload = () => {
            this.detailImage.parentElement.classList.add('progressive-fade-in');
        };

        // 이미지 로드 실패 시 기본 이미지로 대체
        this.detailImage.onerror = () => {
            this.detailImage.src = this.getDefaultImage();
            this.detailImage.parentElement.classList.add('progressive-fade-in');
        };
    }

    // 최적화된 이미지 URL 생성
    getOptimizedImageUrl(info) {
        let imageUrl = '';
        
        if (info.thumbnailUrl) {
            imageUrl = info.thumbnailUrl;
        } else if (info.imageUrl) {
            imageUrl = info.imageUrl;
        } else {
            return this.getDefaultImage();
        }

        // WebP 지원 확인 및 URL 최적화
        if (this.supportsWebP() && !imageUrl.includes('.webp')) {
            // WebP 변환 요청 (서버에서 지원하는 경우)
            const url = new URL(imageUrl);
            url.searchParams.set('format', 'webp');
            url.searchParams.set('quality', '80');
            return url.toString();
        }

        // 기존 URL에 최적화 파라미터 추가
        const url = new URL(imageUrl);
        url.searchParams.set('w', '800');
        url.searchParams.set('h', '400');
        url.searchParams.set('fit', 'crop');
        return url.toString();
    }

    // WebP 지원 확인
    supportsWebP() {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    }

    async renderSummary() {
        if (!this.nutritionInfo) return;

        const info = this.nutritionInfo;

        // 요약 내용 설정
        this.detailSummary.innerHTML = this.formatSummary(info.summary);

        // 요약 섹션에 애니메이션 적용
        document.querySelector('.detail-summary-section').classList.add('progressive-fade-in');
    }

    async renderDetailContent() {
        if (!this.nutritionInfo) return;

        const info = this.nutritionInfo;

        // 상세 내용 (admin.html에서 작성한 content)
        if (info.content && info.content.trim()) {
            this.detailMainContent.innerHTML = this.formatContent(info.content);
            this.detailContentSection.style.display = 'block';
            this.detailContentSection.classList.add('progressive-fade-in');
        } else {
            this.detailContentSection.style.display = 'none';
        }

        // 원본 섹션 숨김 (수동 포스팅만 사용)
        if (this.originalSection) {
            this.originalSection.style.display = 'none';
        }

        // 원본 링크
        if (info.sourceUrl) {
            this.detailSourceLink.href = info.sourceUrl;
            this.detailSourceLink.style.display = 'inline-block';
            this.detailSourceLink.querySelector('.source-url-text').textContent = info.sourceUrl;
        } else {
            this.detailSourceLink.style.display = 'none';
        }

        // 관련 상품
        this.renderRelatedProducts(info.related_products);
    }

    async renderTagsAndActions() {
        if (!this.nutritionInfo) return;

        const info = this.nutritionInfo;

        // 태그 렌더링
        this.renderTags(info.tags);
        document.querySelector('.detail-tags-section').classList.add('progressive-fade-in');

        // 액션 버튼 섹션에 애니메이션 적용
        document.querySelector('.detail-actions').classList.add('progressive-fade-in');
    }

    // ----- 캐시 유틸 -----
    getCacheKey(id) {
        return `nutritionInfoDetail:${id}`;
    }

    readCache(key) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            // 왜: TTL 초과 시에도 SWR 특성상 우선 표시 후 재검증 위해 반환은 유지
            return parsed;
        } catch (_) {
            return null;
        }
    }

    writeCache(key, value) {
        try {
            // 저장 데이터는 { data, etag, cachedAt }
            localStorage.setItem(key, JSON.stringify(value));
        } catch (_) {
            // 저장 실패 시 조용히 무시 (quota 등)
        }
    }

    async loadUserInteractionState() {
        try {
            const response = await fetch(`/api/nutrition-info/${this.nutritionInfoId}/interaction-status`, {
                credentials: 'include'
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    this.userInteractionState = result.data;
                }
            } else if (response.status === 401) {
                // 로그인하지 않은 경우 기본값 유지
                // 로그인하지 않은 사용자 - 기본 상호작용 상태 사용
            } else {
                // 상호작용 상태 로드 실패
            }
        } catch (error) {
            // 사용자 상호작용 상태 로드 실패
        }
    }

    // 기존 renderNutritionInfoDetail 메서드는 점진적 렌더링으로 대체됨

    renderTags(tags) {
        this.detailTags.innerHTML = '';
        
        if (!tags || tags.length === 0) {
            this.detailTags.innerHTML = '<span class="no-tags">태그가 없습니다</span>';
            return;
        }

        // 최대 10개의 태그만 표시
        const displayTags = tags.slice(0, 10);
        
        displayTags.forEach(tag => {
            const tagElement = document.createElement('span');
            tagElement.className = 'detail-tag';
            tagElement.textContent = `#${tag}`;
            tagElement.addEventListener('click', () => {
                // 태그 클릭 시 해당 태그로 검색
                window.location.href = `nutrition-info.html?tags=${encodeURIComponent(tag)}`;
            });
            this.detailTags.appendChild(tagElement);
        });
        
        // 더 많은 태그가 있는 경우 표시
        if (tags.length > 10) {
            const moreTagsElement = document.createElement('span');
            moreTagsElement.className = 'more-tags';
            moreTagsElement.textContent = `+${tags.length - 10}개 더`;
            this.detailTags.appendChild(moreTagsElement);
        }
    }

    renderRelatedProducts(products) {
        const productsSection = document.getElementById('detailProductsSection');
        const productsContainer = document.getElementById('detailProducts');
        
        // 요소가 존재하지 않는 경우 처리
        if (!productsSection || !productsContainer) {
            console.warn('관련 상품 섹션 요소를 찾을 수 없습니다.');
            return;
        }
        
        if (!products || products.length === 0) {
            productsSection.style.display = 'none';
            return;
        }

        productsContainer.innerHTML = products.map(product => `
            <div class="product-item">
                <div class="product-info">
                    <div class="product-name">${this.escapeHtml(product.product_name)}</div>
                </div>
                ${product.product_link ? `
                    <div class="product-iframe-container">
                        <iframe src="${this.escapeHtml(product.product_link)}" 
                                width="120" 
                                height="240" 
                                frameborder="0" 
                                scrolling="no" 
                                referrerpolicy="unsafe-url" 
                                class="product-iframe">
                        </iframe>
                    </div>
                ` : `
                    <div class="product-no-link">
                        <span class="no-link-text">링크 없음</span>
                    </div>
                `}
            </div>
        `).join('');

        productsSection.style.display = 'block';
    }

    async loadRecommendedInfo() {
        try {
            // 클라이언트 캐시에서 추천 정보 확인
            const recKey = `nutritionInfoDetail:rec:${this.nutritionInfoId}`;
            const cached = this.readCache(recKey);
            if (cached && cached.data && cached.cachedAt && Date.now() - cached.cachedAt < this.RECOMMENDATION_CACHE_TTL_MS) {
                // 추천 정보 클라이언트 캐시에서 조회
                this.renderRecommendedInfo(cached.data);
                return;
            }

            // 서버 API를 통해 추천 정보 로드 (서버에서도 캐시 처리됨)
            // 추천 정보 서버 API 호출
            await this.loadCategoryAndTagBasedRecommendations();
            
            // 추천 섹션에 애니메이션 적용
            document.querySelector('.detail-recommendations').classList.add('progressive-fade-in');
        } catch (error) {
            // 추천 정보 로드 실패
            // 오류 발생 시 일반 목록으로 대체
            await this.loadFallbackRecommendations();
            document.querySelector('.detail-recommendations').classList.add('progressive-fade-in');
        }
    }

    async loadCategoryAndTagBasedRecommendations() {
        try {
            const info = this.nutritionInfo;
            let recommendedItems = [];

            // 병렬 API 호출로 성능 최적화
            const apiPromises = [];
            
            // 1. 같은 카테고리의 다른 정보들
            if (info.category) {
                apiPromises.push(
                    fetch(`/api/nutrition-info?category=${info.category}&limit=3`, {
                        credentials: 'include'
                    }).then(response => response.ok ? response.json() : null)
                );
            }

            // 2. 태그 기반 추천 (첫 번째 태그 사용)
            if (info.tags && info.tags.length > 0) {
                const firstTag = info.tags[0];
                apiPromises.push(
                    fetch(`/api/nutrition-info?tags=${encodeURIComponent(firstTag)}&limit=3`, {
                        credentials: 'include'
                    }).then(response => response.ok ? response.json() : null)
                );
            }

            // 3. 최신 정보 (백업용)
            apiPromises.push(
                fetch('/api/nutrition-info?limit=6&sortBy=collectedDate', {
                    credentials: 'include'
                }).then(response => response.ok ? response.json() : null)
            );

            // 모든 API 호출을 병렬로 실행
            const results = await Promise.allSettled(apiPromises);
            
            // 결과 처리
            results.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value && result.value.success && result.value.data) {
                    const items = result.value.data.filter(item => item.id !== this.nutritionInfoId);
                    recommendedItems.push(...items);
                }
            });

            // 중복 제거 및 최대 4개까지만 표시
            const uniqueItems = recommendedItems.filter((item, index, self) => 
                index === self.findIndex(t => t.id === item.id)
            );
            const top = uniqueItems.slice(0, 4);
            
            this.renderRecommendedInfo(top);
            // 캐시 저장
            this.writeCache(`nutritionInfoDetail:rec:${this.nutritionInfoId}`, { data: top, cachedAt: Date.now() });
        } catch (error) {
            // 카테고리/태그 기반 추천 실패
            await this.loadFallbackRecommendations();
        }
    }

    async loadGeneralRecommendations() {
        try {
            const response = await fetch(`/api/nutrition-info?limit=6&sortBy=trustScore`, {
                credentials: 'include'
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data.length > 0) {
                    const recommendedItems = result.data.filter(item => item.id !== this.nutritionInfoId);
                    const top = recommendedItems.slice(0, 4);
                    this.renderRecommendedInfo(top);
                    this.writeCache(`nutritionInfoDetail:rec:${this.nutritionInfoId}`, { data: top, cachedAt: Date.now() });
                }
            }
        } catch (error) {
            // 일반 추천 정보 로드 실패
        }
    }

    async loadFallbackRecommendations() {
        try {
            // 최신순으로 일반 영양 정보 목록을 가져옴
            const response = await fetch('/api/nutrition-info?limit=6&sortBy=collectedDate', {
                credentials: 'include'
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data.length > 0) {
                    // 현재 정보 제외
                    const recommendedItems = result.data.filter(item => item.id !== this.nutritionInfoId);
                    const top = recommendedItems.slice(0, 4);
                    this.renderRecommendedInfo(top);
                    this.writeCache(`nutritionInfoDetail:rec:${this.nutritionInfoId}`, { data: top, cachedAt: Date.now() });
                } else {
                    // 데이터가 없는 경우 빈 추천 섹션 표시
                    this.renderRecommendedInfo([]);
                }
            } else {
                // API 호출 실패 시 빈 추천 섹션 표시
                this.renderRecommendedInfo([]);
            }
        } catch (error) {
            // 대체 추천 정보 로드 실패
            // 완전히 실패한 경우 빈 추천 섹션 표시
            this.renderRecommendedInfo([]);
        }
    }

    renderRecommendedInfo(items) {
        this.recommendedInfo.innerHTML = '';

        if (!items || items.length === 0) {
            this.recommendedInfo.innerHTML = '<p class="no-recommendations">추천 정보가 없습니다</p>';
            return;
        }

        items.forEach(item => {
            const recommendedCard = document.createElement('div');
            recommendedCard.className = 'recommended-card';
            
            // 이미지 URL 결정 (썸네일 우선) 및 최적화
            let imageUrl;
            if (item.thumbnailUrl) {
                imageUrl = this.getOptimizedImageUrl(item);
            } else if (item.imageUrl) {
                imageUrl = this.getOptimizedImageUrl(item);
            } else {
                imageUrl = this.getDefaultImage();
            }
            
            recommendedCard.innerHTML = `
                <div class="recommended-card-image">
                    <img src="${imageUrl}" 
                         alt="${item.title}" 
                         loading="lazy"
                         decoding="async"
                         onerror="this.src='${this.getDefaultImage()}'">
                </div>
                <div class="recommended-card-content">
                    <h3 class="recommended-card-title">${this.truncateText(item.title, 50)}</h3>
                    <p class="recommended-card-summary">${this.truncateText(item.summary, 80)}</p>
                    <div class="recommended-card-meta">
                        <span class="recommended-source">${item.sourceName}</span>
                        <span class="recommended-trust-score">신뢰도: ${item.trustScore}</span>
                    </div>
                </div>
            `;

            recommendedCard.addEventListener('click', () => {
                window.location.href = `nutrition-info-detail.html?id=${item.id}`;
            });

            this.recommendedInfo.appendChild(recommendedCard);
        });
    }

    updateActionButtons() {
        // 북마크 버튼
        if (this.userInteractionState.isBookmarked) {
            this.detailBookmarkBtn.classList.add('active');
            this.detailBookmarkBtn.querySelector('.action-text').textContent = '북마크됨';
        } else {
            this.detailBookmarkBtn.classList.remove('active');
            this.detailBookmarkBtn.querySelector('.action-text').textContent = '북마크';
        }
    }

    async handleBookmark() {
        try {
            const isBookmarked = this.userInteractionState.isBookmarked;
            const action = isBookmarked ? 'remove' : 'add';

            const response = await fetch('/api/nutrition-info/bookmark', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    nutritionInfoId: this.nutritionInfoId,
                    action: action
                })
            });

            const result = await response.json();

            if (result.success) {
                this.userInteractionState.isBookmarked = !isBookmarked;
                this.updateActionButtons();
                
                // 통계 업데이트는 더 이상 UI에 반영하지 않음 (통계 표시 제거됨)

                this.showToast(isBookmarked ? '북마크가 해제되었습니다' : '북마크에 추가되었습니다', 'success');
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('북마크 처리 오류:', error);
            if (error.message.includes('로그인')) {
                this.showToast('로그인이 필요합니다', 'warning');
            } else {
                this.showToast('북마크 처리 중 오류가 발생했습니다', 'error');
            }
        }
    }



    handleShare() {
        const url = window.location.href;
        const title = this.nutritionInfo.title;
        
        if (navigator.share) {
            navigator.share({
                title: title,
                text: `${title} - 잇플에서 확인하세요`,
                url: url
            }).catch(console.error);
        } else {
            navigator.clipboard.writeText(url).then(() => {
                this.showToast('링크가 클립보드에 복사되었습니다', 'success');
            }).catch(() => {
                this.showToast('링크 복사에 실패했습니다', 'error');
            });
        }
    }

    // 유틸리티 메서드들
    formatSummary(summary) {
        // 줄바꿈을 <br>로 변환하고 단락 구분
        return summary
            .split('\n\n')
            .map(paragraph => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
            .join('');
    }

    formatContent(content) {
        // admin.html에서 작성한 HTML 콘텐츠를 그대로 표시
        // 이미 HTML 형태로 저장되어 있으므로 그대로 사용
        return content;
    }


    getSourceTypeLabel(sourceType) {
        // 수동 포스팅만 사용
        return '수동 포스팅';
    }

    getCategoryLabel(category) {
        // 영양 정보 페이지의 실제 카테고리 구조에 맞는 대분류 매핑
        const mainCategoryLabels = {
            // 웰니스 대분류
            'blood_sugar': '웰니스',
            'energy_fatigue': '웰니스',
            'sleep': '웰니스',
            'mental_health': '웰니스',
            'immunity': '웰니스',
            'anti_aging': '웰니스',
            'fat_loss': '웰니스',
            'muscle_exercise': '웰니스',
            
            // 신체 부위별 건강 대분류
            'brain_health': '신체 부위별 건강',
            'eye_health': '신체 부위별 건강',
            'oral_health': '신체 부위별 건강',
            'ent': '신체 부위별 건강',
            'lung_respiratory': '신체 부위별 건강',
            'cardiovascular': '신체 부위별 건강',
            'liver_health': '신체 부위별 건강',
            'gut_health': '신체 부위별 건강',
            'kidney_urinary': '신체 부위별 건강',
            'bone_joint': '신체 부위별 건강',
            'skin_hair': '신체 부위별 건강',
            
            // 특정 질환 및 증상 관리 대분류
            'cancer': '특정 질환 및 증상 관리',
            'autoimmune': '특정 질환 및 증상 관리',
            'pain': '특정 질환 및 증상 관리',
            
            // 생애 주기별 건강 대분류
            'womens_health': '생애 주기별 건강',
            'mens_health': '생애 주기별 건강',
            'pregnancy_parenting': '생애 주기별 건강'
        };
        
        return mainCategoryLabels[category] || category;
    }

    getSubcategoryLabel(category, subcategory) {
        // 영양 정보 페이지의 실제 카테고리 구조에 맞는 소분류 매핑
        const subcategoryLabels = {
            // 웰니스 소분류
            'blood_sugar': '혈당 관리',
            'energy_fatigue': '에너지/피로',
            'sleep': '수면',
            'mental_health': '정신 건강',
            'immunity': '면역력',
            'anti_aging': '항노화',
            'fat_loss': '체지방 감소',
            'muscle_exercise': '근력/운동',
            
            // 신체 부위별 건강 소분류
            'brain_health': '뇌 건강',
            'eye_health': '눈 건강',
            'oral_health': '구강 건강',
            'ent': '이비인후과',
            'lung_respiratory': '폐/호흡기',
            'cardiovascular': '심혈관',
            'liver_health': '간 건강',
            'gut_health': '장 건강',
            'kidney_urinary': '신장/비뇨기',
            'bone_joint': '뼈/관절',
            'skin_hair': '피부/모발',
            
            // 특정 질환 및 증상 관리 소분류
            'cancer': '암',
            'autoimmune': '자가면역',
            'pain': '통증',
            
            // 생애 주기별 건강 소분류
            'womens_health': '여성 건강',
            'mens_health': '남성 건강',
            'pregnancy_parenting': '임신/육아'
        };

        // category가 실제 소분류 키인 경우 해당 라벨 반환
        if (subcategoryLabels[category]) {
            return subcategoryLabels[category];
        }
        
        // subcategory가 있는 경우 해당 라벨 반환
        if (subcategory && subcategoryLabels[subcategory]) {
            return subcategoryLabels[subcategory];
        }
        
        return null;
    }



    getDefaultImage() {
        // 수동 포스팅용 기본 이미지
        return 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&h=400&fit=crop';
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric'
        });
    }







    // HTML 이스케이프 함수 (XSS 방지)
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 조회수 포맷팅
    formatCount(count) {
        if (count >= 1000000) {
            return Math.floor(count / 100000) / 10 + 'M';
        }
        if (count >= 1000) {
            return Math.floor(count / 100) / 10 + 'K';
        }
        return count.toString();
    }

    // 리소스 정리
    cleanup() {
        // 필요시 리소스 정리 코드 추가
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    // 상태 표시 메서드들 - null 체크 추가
    showLoading() {
        if (this.loadingState) this.loadingState.style.display = 'flex';
        if (this.errorState) this.errorState.style.display = 'none';
        if (this.detailContent) this.detailContent.style.display = 'none';
    }


    showError(message) {
        if (this.errorMessage) this.errorMessage.textContent = message;
        if (this.loadingState) this.loadingState.style.display = 'none';
        if (this.errorState) this.errorState.style.display = 'flex';
        if (this.detailContent) this.detailContent.style.display = 'none';
    }

    hideError() {
        if (this.errorState) this.errorState.style.display = 'none';
    }

    hideContent() {
        if (this.detailContent) this.detailContent.style.display = 'none';
    }

    showContent() {
        if (this.loadingState) this.loadingState.style.display = 'none';
        if (this.errorState) this.errorState.style.display = 'none';
        if (this.detailContent) this.detailContent.style.display = 'block';
    }

    showToast(message, type = 'info') {
        // 토스트 컨테이너가 없으면 생성
        let toastContainer = document.querySelector('.toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container';
            document.body.appendChild(toastContainer);
        }

        // 토스트 메시지 생성
        const toast = document.createElement('div');
        toast.className = `toast-message toast-${type}`;
        toast.textContent = message;

        toastContainer.appendChild(toast);

        // 애니메이션 시작
        setTimeout(() => toast.classList.add('show'), 100);

        // 자동 제거
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }
}

// 페이지 로드 시 초기화 - 더 안전한 방법
function initializeNutritionDetail() {
    // DOM이 완전히 로드되었는지 확인
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeNutritionDetail);
        return;
    }
    
    // 필수 요소들이 존재하는지 확인
    const requiredElements = [
        'loadingState', 'errorState', 'detailContent'
    ];
    
    const missingElements = requiredElements.filter(id => !document.getElementById(id));
    if (missingElements.length > 0) {
        console.error('필수 DOM 요소들이 없습니다:', missingElements);
        return;
    }
    
    try {
        new NutritionInfoDetailManager();
    } catch (error) {
        console.error('NutritionInfoDetailManager 초기화 실패:', error);
    }
}

// 즉시 실행 또는 DOM 로드 완료 후 실행
initializeNutritionDetail();
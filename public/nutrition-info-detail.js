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
        
        // 스트리밍 관련 속성
        this.currentEventSource = null;
        this.sectionsData = {
            basic: null,
            content: null,
            products: []
        };
        
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

        // 스트리밍 로딩 시도, 실패 시 일반 로딩으로 폴백
        try {
            await this.loadNutritionInfoStreaming();
        } catch (error) {
            console.warn('스트리밍 로딩 실패, 일반 로딩으로 전환:', error);
            await this.loadNutritionInfoFallback();
        }
    }

    async loadNutritionInfoStreaming() {
        // 스트리밍 로딩 상태 표시
        this.showStreamingLoading();

        // EventSource를 사용한 SSE 연결
        this.currentEventSource = new EventSource(`/api/nutrition-info/${this.nutritionInfoId}/stream`);
        const eventSource = this.currentEventSource;
        
        let hasError = false;
        let sectionsReceived = {
            basic: false,
            content: false,
            products: false
        };

        return new Promise((resolve, reject) => {
            // 연결 타임아웃 설정 (30초)
            const timeout = setTimeout(() => {
                eventSource.close();
                reject(new Error('스트리밍 연결 타임아웃'));
            }, 30000);

            // 시작 이벤트
            eventSource.addEventListener('start', (event) => {
                const data = JSON.parse(event.data);
                console.log('상세 스트리밍 시작:', data.message);
                this.showStreamingProgress('서버 연결 완료, 상세 정보 로딩 중...', 5);
            });

            // 진행 상황 이벤트
            eventSource.addEventListener('progress', (event) => {
                const data = JSON.parse(event.data);
                let progress = 0;
                
                // 섹션별 진행률 계산
                if (data.section === 'basic') progress = 20;
                else if (data.section === 'content') progress = 50;
                else if (data.section === 'products') progress = 80;
                
                this.showStreamingProgress(data.message, progress);
            });

            // 섹션 데이터 이벤트
            eventSource.addEventListener('section', (event) => {
                const data = JSON.parse(event.data);
                
                try {
                    this.renderSectionData(data);
                    
                    // 섹션별 수신 상태 업데이트
                    if (data.type === 'basic') {
                        sectionsReceived.basic = true;
                        // 첫 번째 섹션에서 콘텐츠 영역 표시
                        this.showContent();
                    } else if (data.type === 'content') {
                        sectionsReceived.content = true;
                    } else if (data.type.startsWith('products')) {
                        sectionsReceived.products = true;
                    }
                    
                } catch (renderError) {
                    console.error('섹션 렌더링 오류:', renderError);
                }
            });

            // 완료 이벤트
            eventSource.addEventListener('complete', (event) => {
                clearTimeout(timeout);
                const data = JSON.parse(event.data);
                
                console.log('상세 스트리밍 완료:', data.message);
                this.showStreamingProgress('로딩 완료!', 100);
                
                // 약간의 지연 후 스트리밍 UI 숨김
                setTimeout(() => {
                    this.hideStreamingLoading();
                }, 500);
                
                eventSource.close();
                this.currentEventSource = null;
                resolve();
            });

            // 에러 이벤트
            eventSource.addEventListener('error', (event) => {
                clearTimeout(timeout);
                const data = JSON.parse(event.data);
                console.error('상세 스트리밍 오류:', data);
                hasError = true;
                eventSource.close();
                this.currentEventSource = null;
                reject(new Error(data.error || '스트리밍 중 오류가 발생했습니다.'));
            });

            // 연결 오류 처리
            eventSource.onerror = (error) => {
                clearTimeout(timeout);
                console.error('EventSource 연결 오류:', error);
                eventSource.close();
                this.currentEventSource = null;
                if (!hasError) {
                    reject(new Error('스트리밍 연결 오류'));
                }
            };
        });
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
        await this.delay(100);

        // 2단계: 이미지 렌더링
        await this.renderImage();
        await this.delay(100);

        // 3단계: 요약 정보 렌더링
        await this.renderSummary();
        await this.delay(100);

        // 4단계: 상세 내용 렌더링
        await this.renderDetailContent();
        await this.delay(100);

        // 5단계: 태그 및 액션 버튼 렌더링
        await this.renderTagsAndActions();
        await this.delay(100);

        // 6단계: 사용자 상호작용 상태 로드 (백그라운드)
        this.loadUserInteractionState().then(() => {
            this.updateActionButtons();
        });

        // 7단계: 추천 정보 로드 (백그라운드)
        this.loadRecommendedInfo();
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

        // 이미지 설정
        if (info.thumbnailUrl) {
            this.detailImage.src = info.thumbnailUrl;
        } else if (info.imageUrl) {
            this.detailImage.src = info.imageUrl;
        } else {
            this.detailImage.src = this.getDefaultImage();
        }
        this.detailImage.alt = info.title;

        // 이미지 컨테이너에 애니메이션 적용
        this.detailImage.parentElement.classList.add('progressive-fade-in');
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
            if (cached && cached.data && cached.cachedAt && Date.now() - cached.cachedAt < 30 * 60 * 1000) {
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

            // 1. 같은 카테고리의 다른 정보들
            if (info.category) {
                const categoryResponse = await fetch(`/api/nutrition-info?category=${info.category}&limit=3`, {
                    credentials: 'include'
                });
                
                if (categoryResponse.ok) {
                    const categoryResult = await categoryResponse.json();
                    if (categoryResult.success && categoryResult.data) {
                        const categoryItems = categoryResult.data.filter(item => item.id !== this.nutritionInfoId);
                        recommendedItems.push(...categoryItems);
                    }
                }
            }

            // 2. 태그 기반 추천 (첫 번째 태그 사용)
            if (info.tags && info.tags.length > 0) {
                const firstTag = info.tags[0];
                const tagResponse = await fetch(`/api/nutrition-info?tags=${encodeURIComponent(firstTag)}&limit=3`, {
                    credentials: 'include'
                });
                
                if (tagResponse.ok) {
                    const tagResult = await tagResponse.json();
                    if (tagResult.success && tagResult.data) {
                        const tagItems = tagResult.data.filter(item => 
                            item.id !== this.nutritionInfoId && 
                            !recommendedItems.find(existing => existing.id === item.id)
                        );
                        recommendedItems.push(...tagItems);
                    }
                }
            }

            // 3. 추천 항목이 부족하면 최신 정보로 보완
            if (recommendedItems.length < 4) {
                const generalResponse = await fetch('/api/nutrition-info?limit=6&sortBy=collectedDate', {
                    credentials: 'include'
                });
                
                if (generalResponse.ok) {
                    const generalResult = await generalResponse.json();
                    if (generalResult.success && generalResult.data) {
                        const generalItems = generalResult.data.filter(item => 
                            item.id !== this.nutritionInfoId && 
                            !recommendedItems.find(existing => existing.id === item.id)
                        );
                        recommendedItems.push(...generalItems);
                    }
                }
            }

            // 최대 4개까지만 표시
            const top = recommendedItems.slice(0, 4);
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
            
            // 이미지 URL 결정 (썸네일 우선)
            let imageUrl;
            if (item.thumbnailUrl) {
                imageUrl = item.thumbnailUrl;
            } else if (item.imageUrl) {
                imageUrl = item.imageUrl;
            } else {
                imageUrl = this.getDefaultImage();
            }
            
            recommendedCard.innerHTML = `
                <div class="recommended-card-image">
                    <img src="${imageUrl}" 
                         alt="${item.title}" 
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

    // 스트리밍 관련 메서드들
    renderSectionData(data) {
        switch (data.type) {
            case 'basic':
                this.renderBasicSection(data.data);
                break;
            case 'content':
                this.renderContentSection(data.data);
                break;
            case 'products_batch':
                this.renderProductsBatch(data.data, data.batch, data.isLastBatch);
                break;
            case 'products_empty':
                this.renderEmptyProducts();
                break;
            default:
                console.warn('알 수 없는 섹션 타입:', data.type);
        }
    }

    renderBasicSection(basicData) {
        // 기본 정보를 sectionsData에 저장
        this.sectionsData.basic = basicData;

        // 제목 렌더링
        const titleElement = document.getElementById('detailTitle');
        if (titleElement && basicData.title) {
            titleElement.textContent = basicData.title;
            titleElement.classList.add('streaming-fade-in');
        }

        // 요약 렌더링
        const summaryElement = document.getElementById('detailSummary');
        if (summaryElement && basicData.summary) {
            summaryElement.textContent = basicData.summary;
            summaryElement.classList.add('streaming-fade-in');
        }

        // 메타 정보 렌더링
        const metaElement = document.getElementById('detailMeta');
        if (metaElement) {
            metaElement.innerHTML = `
                <div class="detail-meta-item">
                    <span class="meta-label">출처:</span>
                    <span class="meta-value">${this.escapeHtml(basicData.sourceName)}</span>
                </div>
                <div class="detail-meta-item">
                    <span class="meta-label">발행일:</span>
                    <span class="meta-value">${this.formatDate(basicData.publishedDate)}</span>
                </div>
                <div class="detail-meta-item">
                    <span class="meta-label">조회수:</span>
                    <span class="meta-value">${this.formatCount(basicData.viewCount)}</span>
                </div>
            `;
            metaElement.classList.add('streaming-fade-in');
        }

        // 태그 렌더링
        const tagsElement = document.getElementById('detailTags');
        if (tagsElement && basicData.tags && basicData.tags.length > 0) {
            tagsElement.innerHTML = basicData.tags.map(tag => 
                `<span class="detail-tag">#${this.escapeHtml(tag)}</span>`
            ).join('');
            tagsElement.classList.add('streaming-fade-in');
        }

        // 썸네일 이미지 렌더링
        const imageElement = document.getElementById('detailImage');
        if (imageElement) {
            const imageUrl = basicData.thumbnailUrl || basicData.imageUrl || this.getDefaultImage();
            imageElement.src = imageUrl;
            imageElement.alt = basicData.title;
            imageElement.classList.add('streaming-fade-in');
        }
    }

    renderContentSection(contentData) {
        // 콘텐츠를 sectionsData에 저장
        this.sectionsData.content = contentData;

        // 본문 내용 렌더링
        const contentElement = document.getElementById('detailContent');
        if (contentElement && contentData.content) {
            contentElement.innerHTML = contentData.content;
            contentElement.classList.add('streaming-fade-in');
        }

        // 원본 콘텐츠 제거 (수동 포스팅만 사용)
    }

    renderProductsBatch(productsData, batchNumber, isLastBatch) {
        // 관련 상품을 sectionsData에 추가
        this.sectionsData.products = this.sectionsData.products.concat(productsData);

        const productsContainer = document.getElementById('relatedProducts');
        if (!productsContainer) return;

        // 첫 번째 배치에서 컨테이너 초기화
        if (batchNumber === 1) {
            productsContainer.innerHTML = '';
        }

        // Document Fragment 사용하여 성능 최적화
        const fragment = document.createDocumentFragment();

        productsData.forEach((product, index) => {
            const productElement = document.createElement('div');
            productElement.className = 'related-product-item';
            
            productElement.innerHTML = `
                <div class="product-info">
                    <h4 class="product-name">${this.escapeHtml(product.product_name)}</h4>
                    <a href="${this.escapeHtml(product.product_link)}" 
                       target="_blank" 
                       rel="noopener noreferrer" 
                       class="product-link">
                        상품 보기 →
                    </a>
                </div>
            `;

            // 배치별 애니메이션 지연
            const globalIndex = ((batchNumber - 1) * 2) + index; // 배치 크기가 2라고 가정
            productElement.style.animationDelay = `${globalIndex * 0.2}s`;
            productElement.classList.add('streaming-fade-in');

            fragment.appendChild(productElement);
        });

        productsContainer.appendChild(fragment);

        // 마지막 배치인 경우 관련 상품 섹션 표시
        if (isLastBatch) {
            const productsSection = document.getElementById('relatedProductsSection');
            if (productsSection) {
                productsSection.style.display = 'block';
                productsSection.classList.add('streaming-fade-in');
            }
        }
    }

    renderEmptyProducts() {
        const productsSection = document.getElementById('relatedProductsSection');
        if (productsSection) {
            productsSection.style.display = 'none';
        }
    }

    // 스트리밍 로딩 상태 표시
    showStreamingLoading() {
        // 기존 상태 숨기기
        this.hideError();
        this.hideContent();
        
        // 스트리밍 로딩 컨테이너 생성 또는 표시
        let streamingContainer = document.getElementById('detailStreamingLoadingState');
        if (!streamingContainer) {
            streamingContainer = this.createStreamingLoadingContainer();
            const mainContainer = document.querySelector('.detail-container') || document.body;
            mainContainer.insertBefore(streamingContainer, mainContainer.firstChild);
        }
        
        streamingContainer.style.display = 'block';
    }

    // 스트리밍 로딩 컨테이너 생성
    createStreamingLoadingContainer() {
        const container = document.createElement('div');
        container.id = 'detailStreamingLoadingState';
        container.className = 'detail-streaming-loading-container';
        
        container.innerHTML = `
            <div class="detail-streaming-loading-content">
                <div class="detail-streaming-loading-icon">
                    <div class="detail-streaming-spinner"></div>
                </div>
                <h3 id="detailStreamingLoadingTitle">실시간 상세 정보 로딩 중...</h3>
                <div class="detail-streaming-progress-bar">
                    <div id="detailStreamingProgressFill" class="detail-streaming-progress-fill" style="width: 2%"></div>
                </div>
                <p id="detailStreamingLoadingMessage">서버에 연결하는 중...</p>
            </div>
        `;
        
        return container;
    }

    // 스트리밍 진행 상황 업데이트
    showStreamingProgress(message, progress) {
        const titleElement = document.getElementById('detailStreamingLoadingTitle');
        const messageElement = document.getElementById('detailStreamingLoadingMessage');
        const progressFill = document.getElementById('detailStreamingProgressFill');
        
        if (titleElement) titleElement.textContent = '실시간 데이터 로딩 중...';
        if (messageElement) messageElement.textContent = message;
        if (progressFill) progressFill.style.width = `${progress}%`;
    }

    // 스트리밍 로딩 숨기기
    hideStreamingLoading() {
        const streamingContainer = document.getElementById('detailStreamingLoadingState');
        if (streamingContainer) {
            streamingContainer.style.display = 'none';
        }
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

    // 리소스 정리 (EventSource 등)
    cleanup() {
        if (this.currentEventSource) {
            this.currentEventSource.close();
            this.currentEventSource = null;
        }
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
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
        
        this.initializeElements();
        this.bindEvents();
        this.loadNutritionInfoDetail();
    }

    initializeElements() {
        // 상태 요소들
        this.loadingState = document.getElementById('loadingState');
        this.errorState = document.getElementById('errorState');
        this.detailContent = document.getElementById('detailContent');
        this.errorMessage = document.getElementById('errorMessage');
        this.retryBtn = document.getElementById('retryBtn');

        // 상세 정보 요소들
        this.breadcrumbTitle = document.getElementById('breadcrumbTitle');

        
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
        // 재시도 버튼
        this.retryBtn.addEventListener('click', () => this.loadNutritionInfoDetail());

        // 액션 버튼들
        this.detailBookmarkBtn.addEventListener('click', () => this.handleBookmark());
        this.detailShareBtn.addEventListener('click', () => this.handleShare());

        // 뒤로가기 처리
        window.addEventListener('popstate', () => {
            window.location.href = 'nutrition-info.html';
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

        this.showLoading();

        // 1) 캐시가 있으면 즉시 렌더 (SWR의 stale 단계). 이후 백그라운드 재검증
        const cacheKey = this.getCacheKey(this.nutritionInfoId);
        const cached = this.readCache(cacheKey);
        if (cached && cached.data) {
            this.nutritionInfo = cached.data;
            await this.loadUserInteractionState(); // 개인화 상태는 캐시하지 않음
            this.renderNutritionInfoDetail();
            await this.loadRecommendedInfo();
            this.showContent();
        }

        try {
            // 영양 정보 상세 데이터 로드
            const fetchOptions = { credentials: 'include', headers: {} };
            if (cached && cached.etag) {
                // 왜: 서버 ETag와 비교하여 변경 없으면 304 수신
                fetchOptions.headers['If-None-Match'] = cached.etag;
            }
            const response = await fetch(`/api/nutrition-info/${this.nutritionInfoId}`, fetchOptions);

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('해당 영양 정보를 찾을 수 없습니다.');
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // 2) 서버가 304를 주면 캐시 유지, 아니면 최신 데이터로 갱신
            if (response.status === 304 && cached && cached.data) {
                // 변경 없음: 이미 위에서 캐시로 렌더됨 → 조용히 종료
                return;
            }

            const result = await response.json();
            
            if (result.success) {
                this.nutritionInfo = result.data;
                // 응답 ETag 저장 (없으면 생략)
                const etag = response.headers.get('ETag');
                this.writeCache(cacheKey, {
                    data: this.nutritionInfo,
                    etag: etag || null,
                    cachedAt: Date.now()
                });
                await this.loadUserInteractionState();
                this.renderNutritionInfoDetail();
                await this.loadRecommendedInfo();
                this.showContent();
            } else {
                throw new Error(result.error || '데이터를 불러오는데 실패했습니다.');
            }
        } catch (error) {
            console.error('영양 정보 상세 로딩 오류:', error);
            if (!(cached && cached.data)) {
                // 캐시도 없고 네트워크도 실패
                this.showError(error.message);
            } else {
                // 캐시로 이미 보여주고 있는 상태라면 사용자 경험 방해 없이 토스트만
                this.showToast('네트워크 문제로 캐시 데이터를 표시 중입니다', 'warning');
            }
        }
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
                console.log('로그인하지 않은 사용자 - 기본 상호작용 상태 사용');
            } else {
                console.log('상호작용 상태 로드 실패:', response.status);
            }
        } catch (error) {
            console.log('사용자 상호작용 상태 로드 실패:', error);
        }
    }

    renderNutritionInfoDetail() {
        const info = this.nutritionInfo;

        // 페이지 제목 설정
        document.title = `${info.title} - 잇플`;
        
        // 브레드크럼
        this.breadcrumbTitle.textContent = this.truncateText(info.title, 30);

        // 헤더 정보
        
        // 신뢰도 점수 숨김 (사용자에게 표시하지 않음)
        
        
        this.detailTitle.textContent = info.title;
        this.detailSource.textContent = info.sourceName;
        this.detailDate.textContent = this.formatDate(info.publishedDate);
        
        if (info.author) {
            this.detailAuthor.textContent = info.author;
            this.detailAuthor.style.display = 'inline';
        } else {
            this.detailAuthor.style.display = 'none';
        }

        // 통계 정보는 더 이상 표시하지 않음 (UI에서 제거됨)

        // 이미지 (썸네일 우선 표시)
        if (info.thumbnailUrl) {
            // 1순위: 수동 포스팅의 썸네일 이미지
            this.detailImage.src = info.thumbnailUrl;
        } else if (info.sourceType === 'youtube' && info.thumbnailUrl) {
            // 2순위: YouTube의 경우 실제 썸네일 우선 사용
            this.detailImage.src = info.thumbnailUrl;
        } else if (info.imageUrl) {
            // 3순위: 다른 소스의 경우 imageUrl 사용
            this.detailImage.src = info.imageUrl;
        } else {
            // 4순위: 기본 이미지 사용
            this.detailImage.src = this.getDefaultImage(info.sourceType);
        }
        this.detailImage.alt = info.title;

        // 요약
        this.detailSummary.innerHTML = this.formatSummary(info.summary);

        // 상세 내용 (admin.html에서 작성한 content)
        if (info.content && info.content.trim()) {
            this.detailMainContent.innerHTML = this.formatContent(info.content);
            this.detailContentSection.style.display = 'block';
        } else {
            this.detailContentSection.style.display = 'none';
        }

        // 태그
        this.renderTags(info.tags);

        // 관련 상품
        this.renderRelatedProducts(info.related_products);

        // 원본 콘텐츠 (논문의 경우만 표시)
        if (info.sourceType === 'paper' && info.originalContent) {
            this.detailOriginalContent.innerHTML = this.formatOriginalContent(info.originalContent);
            this.originalSection.style.display = 'block';
        } else {
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

        // 액션 버튼 상태 업데이트
        this.updateActionButtons();
    }

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

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }





    async loadRecommendedInfo() {
        try {
            // 카테고리와 태그 기반 추천 시도
            // 간단 캐시: 상세 ID별 추천 리스트 캐시 (30분)
            const recKey = `nutritionInfoDetail:rec:${this.nutritionInfoId}`;
            const cached = this.readCache(recKey);
            if (cached && cached.data && cached.cachedAt && Date.now() - cached.cachedAt < 30 * 60 * 1000) {
                this.renderRecommendedInfo(cached.data);
            }
            await this.loadCategoryAndTagBasedRecommendations();
        } catch (error) {
            console.log('추천 정보 로드 실패:', error);
            // 오류 발생 시 일반 목록으로 대체
            await this.loadFallbackRecommendations();
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
            console.log('카테고리/태그 기반 추천 실패:', error);
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
            console.log('일반 추천 정보 로드 실패:', error);
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
            console.log('대체 추천 정보 로드 실패:', error);
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

        console.log('추천 정보 아이템들:', items); // 디버깅용

        items.forEach(item => {
            console.log('아이템 데이터:', {
                id: item.id,
                title: item.title,
                thumbnailUrl: item.thumbnailUrl,
                imageUrl: item.imageUrl,
                sourceType: item.sourceType
            }); // 디버깅용
            const recommendedCard = document.createElement('div');
            recommendedCard.className = 'recommended-card';
            
            // 이미지 URL 결정 (썸네일 우선)
            let imageUrl;
            if (item.thumbnailUrl) {
                // 1순위: 썸네일 이미지 (수동 포스팅의 썸네일, YouTube 썸네일 등)
                imageUrl = item.thumbnailUrl;
                console.log(`추천 카드 이미지 (썸네일): ${imageUrl} for item: ${item.title}`);
            } else if (item.imageUrl) {
                // 2순위: 일반 이미지
                imageUrl = item.imageUrl;
                console.log(`추천 카드 이미지 (일반): ${imageUrl} for item: ${item.title}`);
            } else {
                // 3순위: 기본 이미지
                imageUrl = this.getDefaultImage(item.sourceType);
                console.log(`추천 카드 이미지 (기본): ${imageUrl} for item: ${item.title}, sourceType: ${item.sourceType}`);
            }
            
            recommendedCard.innerHTML = `
                <div class="recommended-card-image">
                    <img src="${imageUrl}" 
                         alt="${item.title}" 
                         onerror="console.log('이미지 로드 실패, 기본 이미지로 대체:', this.src, '→', '${this.getDefaultImage(item.sourceType)}'); this.src='${this.getDefaultImage(item.sourceType)}'">
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

    formatOriginalContent(content) {
        // 원본 콘텐츠 포맷팅 (논문의 경우)
        if (!content) return '';
        
        // 간단한 마크다운 스타일 변환
        return content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .split('\n\n')
            .map(paragraph => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
            .join('');
    }

    getSourceTypeLabel(sourceType) {
        const labels = {
            'paper': '논문',
            'pubmed': '논문',
            'youtube': '영상',
            'news': '뉴스',
            'manual': '수동 포스팅'
        };
        return labels[sourceType] || sourceType;
    }

    getCategoryLabel(category) {
        const labels = {
            'diet': '식단',
            'supplements': '보충제',
            'research': '연구',
            'trends': '트렌드',
            'nutrition': '영양',
            'health': '건강'
        };
        return labels[category] || category;
    }



    getDefaultImage(sourceType) {
        const images = {
            'paper': 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=800&h=400&fit=crop',
            'youtube': 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&h=400&fit=crop',
            'news': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=400&fit=crop',
            'manual': 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&h=400&fit=crop'
        };
        return images[sourceType] || images['news'];
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric'
        });
    }

    formatCount(count) {
        if (count >= 1000000) {
            return Math.floor(count / 100000) / 10 + 'M';
        }
        if (count >= 1000) {
            return Math.floor(count / 100) / 10 + 'K';
        }
        return count.toString();
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    // 상태 표시 메서드들
    showLoading() {
        this.loadingState.style.display = 'flex';
        this.errorState.style.display = 'none';
        this.detailContent.style.display = 'none';
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.loadingState.style.display = 'none';
        this.errorState.style.display = 'flex';
        this.detailContent.style.display = 'none';
    }

    showContent() {
        this.loadingState.style.display = 'none';
        this.errorState.style.display = 'none';
        this.detailContent.style.display = 'block';
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

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    new NutritionInfoDetailManager();
});
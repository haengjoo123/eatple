/**
 * 영양 정보 목록 페이지 JavaScript
 * Requirements: 1.1, 1.2, 4.1, 4.2, 4.3, 4.4
 */

class NutritionInfoManager {
    constructor() {
        this.currentPage = 1;
        this.itemsPerPage = 12;
        this.currentFilters = {};
        this.currentSort = 'collectedDate';
        this.currentSortOrder = 'desc';
        this.isLoading = false;
        
        // 성능 최적화를 위한 속성들
        this.intersectionObserver = null;
        this.renderedCardCount = 0;
        this.maxVisibleCards = 50; // 메모리 절약을 위해 최대 표시 카드 수 제한
        this.cardPool = []; // 카드 재사용을 위한 풀
        this.currentEventSource = null; // EventSource 참조 저장
        
        this.initializeElements();
        this.bindEvents();
        this.setupIntersectionObserver();
        
        // URL 파라미터 확인
        const urlParams = new URLSearchParams(window.location.search);
        const nutritionId = urlParams.get('id');
        const category = urlParams.get('category');
        const tags = urlParams.get('tags');
        
        if (nutritionId) {
            this.loadSingleNutritionInfo(nutritionId);
        } else {
            // 카테고리 파라미터가 있으면 필터 적용
            if (category) {
                this.currentFilters.category = decodeURIComponent(category);
                this.currentPage = 1;
                // UI에서 해당 카테고리 버튼 활성화
                this.activateCategoryButton(decodeURIComponent(category));
            }
            // 태그 파라미터가 있으면 태그 필터 적용
            if (tags) {
                const decodedTag = decodeURIComponent(tags);
                this.currentFilters.tags = decodedTag;
                this.currentPage = 1;
                // 태그 필터 UI 표시
                this.showActiveTagFilter(decodedTag);
            }
            this.loadNutritionInfo();
        }
    }

    initializeElements() {
        // DOM 요소들
        this.searchInput = document.getElementById('searchInput'); // 검색창이 없을 수 있음
        
        this.loadingState = document.getElementById('loadingState');
        this.skeletonState = document.getElementById('skeletonState');
        this.errorState = document.getElementById('errorState');
        this.emptyState = document.getElementById('emptyState');
        this.nutritionGrid = document.getElementById('nutritionGrid');
        this.paginationContainer = document.getElementById('paginationContainer');
        
        this.prevPageBtn = document.getElementById('prevPageBtn');
        this.nextPageBtn = document.getElementById('nextPageBtn');
        this.pageNumbers = document.getElementById('pageNumbers');
        this.retryBtn = document.getElementById('retryBtn');
        this.errorMessage = document.getElementById('errorMessage');

        // 태그 필터 관련 요소들
        this.activeTagFilter = document.getElementById('activeTagFilter');
        this.activeTagName = document.getElementById('activeTagName');
        this.clearTagFilterBtn = document.getElementById('clearTagFilter');
    }

    bindEvents() {
        // 카테고리 버튼 이벤트
        this.bindCategoryEvents();
        
        // 검색 이벤트 (검색창이 있을 때만)
        if (this.searchInput) {
            this.searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleSearch();
            });
        }

        // 페이지네이션 이벤트
        this.prevPageBtn.addEventListener('click', () => this.goToPreviousPage());
        this.nextPageBtn.addEventListener('click', () => this.goToNextPage());

        // 재시도 이벤트
        this.retryBtn.addEventListener('click', () => this.loadNutritionInfo());

        // 태그 필터 해제 버튼 이벤트
        if (this.clearTagFilterBtn) {
            this.clearTagFilterBtn.addEventListener('click', () => this.clearTagFilter());
        }
        
        // 페이지 언로드 시 리소스 정리
        window.addEventListener('beforeunload', () => this.cleanup());
    }

    // Intersection Observer 설정 (이미지 지연 로딩용)
    setupIntersectionObserver() {
        if (!('IntersectionObserver' in window)) {
            return; // 지원하지 않는 브라우저에서는 일반 로딩
        }

        this.intersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        // 이미지 로딩 최적화: 우선순위 힌트 추가
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                        this.intersectionObserver.unobserve(img);
                        
                        // 이미지 로딩 완료 시 부드러운 전환 효과
                        img.addEventListener('load', () => {
                            img.style.opacity = '1';
                        }, { once: true });
                    }
                }
            });
        }, {
            rootMargin: '100px 0px', // 100px 전에 미리 로딩 시작 (더 빠른 로딩)
            threshold: 0.01 // 더 민감하게 반응
        });
    }

    // 리소스 정리
    cleanup() {
        // EventSource 연결 종료
        if (this.currentEventSource) {
            this.currentEventSource.close();
            this.currentEventSource = null;
        }

        // Intersection Observer 정리
        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
            this.intersectionObserver = null;
        }

        this.cardPool = [];
    }

    bindCategoryEvents() {
        // 드롭다운 토글 이벤트
        const dropdownToggles = document.querySelectorAll('.dropdown-toggle');
        dropdownToggles.forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const dropdownId = toggle.getAttribute('data-dropdown');
                const dropdownMenu = document.getElementById(`${dropdownId}-dropdown`);
                
                // 다른 드롭다운들 닫기
                document.querySelectorAll('.dropdown-menu').forEach(menu => {
                    if (menu !== dropdownMenu) {
                        menu.classList.remove('show');
                    }
                });
                
                document.querySelectorAll('.dropdown-toggle').forEach(otherToggle => {
                    if (otherToggle !== toggle) {
                        otherToggle.classList.remove('active');
                    }
                });
                
                // 현재 드롭다운 토글
                toggle.classList.toggle('active');
                dropdownMenu.classList.toggle('show');
            });
        });

        // 카테고리 버튼 이벤트
        const categoryButtons = document.querySelectorAll('.category-btn');
        categoryButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                
                // 모든 카테고리 상태 초기화 (인라인으로 처리)
                // 모든 카테고리 버튼에서 active 클래스 제거
                document.querySelectorAll('.category-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                
                // 모든 드롭다운 토글 초기화
                document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
                    toggle.classList.remove('active');
                    this.resetDropdownText(toggle);
                });
                
                // 모든 드롭다운 메뉴 닫기
                document.querySelectorAll('.dropdown-menu').forEach(menu => {
                    menu.classList.remove('show');
                });
                
                // 클릭된 버튼에 active 클래스 추가
                button.classList.add('active');
                
                // 드롭다운 내부의 카테고리 버튼인 경우 해당 드롭다운 토글 업데이트
                const dropdownMenu = button.closest('.dropdown-menu');
                if (dropdownMenu) {
                    const dropdownCategory = dropdownMenu.closest('.dropdown-category');
                    const dropdownToggle = dropdownCategory.querySelector('.dropdown-toggle');
                    this.updateDropdownText(dropdownToggle, button.textContent);
                }
                
                // 카테고리 필터 설정
                const category = button.getAttribute('data-category');
                this.handleCategoryFilter(category);
            });
        });

        // 문서 클릭 시 드롭다운 닫기
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.dropdown-category')) {
                document.querySelectorAll('.dropdown-menu').forEach(menu => {
                    menu.classList.remove('show');
                });
                document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
                    toggle.classList.remove('active');
                });
            }
        });
    }

    handleCategoryFilter(category) {
        // 현재 필터 업데이트
        if (category) {
            this.currentFilters.category = category;
        } else {
            delete this.currentFilters.category;
        }
        
        // 카테고리 변경 시 태그 필터도 해제
        this.hideActiveTagFilter();
        delete this.currentFilters.tags;
        
        // 페이지를 1로 리셋
        this.currentPage = 1;
        
        // URL 파라미터 정리 (태그 파라미터 제거)
        this.updateUrlParams();
        
        // 영양정보 다시 로드
        this.loadNutritionInfo();
    }

    // 태그 클릭 시 해당 태그로 필터링하는 메서드
    filterByTag(tagName) {
        // 태그 필터 적용
        this.currentFilters.tags = tagName;
        this.currentPage = 1;
        
        // 태그 필터 UI 표시
        this.showActiveTagFilter(tagName);
        
        // URL 파라미터 업데이트
        this.updateUrlParams();
        
        // 영양정보 다시 로드
        this.loadNutritionInfo();
    }

    // 태그 필터 해제 메서드
    clearTagFilter() {
        // 태그 필터 제거
        delete this.currentFilters.tags;
        this.currentPage = 1;
        
        // 태그 필터 UI 숨김
        this.hideActiveTagFilter();
        
        // URL 파라미터 업데이트
        this.updateUrlParams();
        
        // 영양정보 다시 로드
        this.loadNutritionInfo();
    }

    // 활성 태그 필터 UI 표시
    showActiveTagFilter(tagName) {
        if (this.activeTagFilter && this.activeTagName) {
            this.activeTagName.textContent = `#${tagName}`;
            this.activeTagFilter.style.display = 'block';
        }
    }

    // 활성 태그 필터 UI 숨김
    hideActiveTagFilter() {
        if (this.activeTagFilter) {
            this.activeTagFilter.style.display = 'none';
        }
    }

    // URL 파라미터를 현재 필터 상태에 맞게 업데이트 (페이지 새로고침 없이)
    updateUrlParams() {
        const url = new URL(window.location);
        
        // 기존 파라미터 제거
        url.searchParams.delete('tags');
        url.searchParams.delete('category');
        
        // 현재 필터에 맞게 파라미터 설정
        if (this.currentFilters.tags) {
            url.searchParams.set('tags', this.currentFilters.tags);
        }
        if (this.currentFilters.category) {
            url.searchParams.set('category', this.currentFilters.category);
        }
        
        // 브라우저 URL 업데이트 (페이지 새로고침 없이)
        window.history.replaceState({}, '', url);
    }

    // URL 파라미터로 전달된 카테고리에 해당하는 버튼을 활성화
    activateCategoryButton(category) {
        // 모든 카테고리 상태 초기화 (인라인으로 처리)
        // 모든 카테고리 버튼에서 active 클래스 제거
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // 모든 드롭다운 토글 초기화
        document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
            toggle.classList.remove('active');
            this.resetDropdownText(toggle);
        });
        
        // 모든 드롭다운 메뉴 닫기
        document.querySelectorAll('.dropdown-menu').forEach(menu => {
            menu.classList.remove('show');
        });
        
        // 해당 카테고리 버튼 찾기
        const targetButton = document.querySelector(`[data-category="${category}"]`);
        if (targetButton) {
            targetButton.classList.add('active');
            
            // 드롭다운 내부의 카테고리 버튼인 경우 해당 드롭다운 토글 업데이트
            const dropdownMenu = targetButton.closest('.dropdown-menu');
            if (dropdownMenu) {
                const dropdownCategory = dropdownMenu.closest('.dropdown-category');
                const dropdownToggle = dropdownCategory.querySelector('.dropdown-toggle');
                this.updateDropdownText(dropdownToggle, targetButton.textContent);
            }
        }
    }

    // 드롭다운 토글 텍스트 업데이트
    updateDropdownText(toggle, selectedText) {
        const span = toggle.querySelector('span');
        if (span) {
            // 원래 텍스트를 data 속성에 저장 (처음 한 번만)
            if (!toggle.hasAttribute('data-original-text')) {
                toggle.setAttribute('data-original-text', span.textContent);
            }
            span.textContent = selectedText;
            toggle.classList.add('selected');
        }
    }

    // 드롭다운 토글 텍스트 원래대로 복원
    resetDropdownText(toggle) {
        const span = toggle.querySelector('span');
        const originalText = toggle.getAttribute('data-original-text');
        if (span && originalText) {
            span.textContent = originalText;
            toggle.classList.remove('selected');
        }
    }

    async loadSingleNutritionInfo(id) {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoading();

        try {
            const response = await fetch(`/api/nutrition-info/${id}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            
            if (result.success && result.data) {
                this.renderSingleNutritionInfo(result.data);
            } else {
                throw new Error(result.error || '영양정보를 찾을 수 없습니다.');
            }
        } catch (error) {
            console.error('영양 정보 로딩 오류:', error);
            this.showError(error.message);
        } finally {
            this.isLoading = false;
        }
    }

    async loadNutritionInfo() {
        if (this.isLoading) return;
        this.isLoading = true;
        try {
            await this.loadNutritionInfoFallback();
        } finally {
            this.isLoading = false;
        }
    }

    // 스트리밍 기능 제거됨

    async loadNutritionInfoFallback() {
        // 폴백에서도 스켈레톤 대신 간단한 로딩 표시
        this.showLoading();

        try {
            const params = new URLSearchParams({
                page: this.currentPage,
                limit: this.itemsPerPage,
                sortBy: this.currentSort,
                sortOrder: this.currentSortOrder,
                ...this.currentFilters
            });

            const response = await fetch(`/api/nutrition-info?${params}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            
            if (result.success) {
                await this.renderNutritionInfo(result.data, result.pagination);
            } else {
                throw new Error(result.error || '데이터를 불러오는데 실패했습니다.');
            }
        } catch (error) {
            console.error('영양 정보 로딩 오류:', error);
            this.showError(error.message);
        }
    }

    renderSingleNutritionInfo(data) {
        // 필터와 페이지네이션 숨기기
        const filtersSection = document.querySelector('.nutrition-filters');
        const paginationContainer = document.getElementById('paginationContainer');
        if (filtersSection) filtersSection.style.display = 'none';
        if (paginationContainer) paginationContainer.style.display = 'none';

        this.nutritionGrid.innerHTML = '';
        this.nutritionGrid.style.display = 'block';
        this.nutritionGrid.style.maxWidth = '800px';
        this.nutritionGrid.style.margin = '0 auto';
        
        // 단일 영양정보 카드 생성 (일반 카드와 동일하게 사용)
        const detailCard = this.createNutritionCard(data);
        detailCard.classList.add('progressive-fade-in');
        this.nutritionGrid.appendChild(detailCard);
        
        this.showContent();
    }

    async renderNutritionInfo(data, pagination) {
        if (!data || data.length === 0) {
            this.showEmpty();
            return;
        }


        this.nutritionGrid.innerHTML = '';
        
        data.forEach((item, index) => {
            const card = this.createNutritionCard(item);
            // 점진적 페이드인 애니메이션을 위한 지연
            card.style.animationDelay = `${index * 0.1}s`;
            card.classList.add('progressive-fade-in');
            this.nutritionGrid.appendChild(card);
        });

        this.renderPagination(pagination);
        this.showContent();
    }

    createNutritionCard(item) {
        // 카드 풀에서 재사용 가능한 카드 확인
        let card = this.cardPool.pop();
        if (!card) {
            card = document.createElement('div');
            card.className = 'nutrition-card';
        }

        // 기존 이벤트 리스너 제거 (메모리 누수 방지)
        const newCard = card.cloneNode(false);
        newCard.className = 'nutrition-card';
        newCard.setAttribute('data-id', item.id);

        const sourceTypeLabel = this.getSourceTypeLabel(item.sourceType);
        const formattedDate = this.formatDate(item.publishedDate);
        const imageUrl = this.getImageUrl(item);
        const defaultImage = this.getDefaultImage();

        // 이미지 지연 로딩을 위한 플레이스홀더
        const shouldLazyLoad = this.intersectionObserver && this.renderedCardCount > 2; // 첫 2개만 즉시 로드

        newCard.innerHTML = `
            <div class="nutrition-card-thumbnail">
                <img ${shouldLazyLoad ? `data-src="${imageUrl}"` : `src="${imageUrl}"`}
                     alt="${this.escapeHtml(item.title)}" 
                     ${shouldLazyLoad ? 'src="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'300\' height=\'200\'%3E%3Crect width=\'100%25\' height=\'100%25\' fill=\'%23f8fafc\'/%3E%3C/svg%3E"' : ''}
                     loading="${shouldLazyLoad ? 'lazy' : 'eager'}"
                     decoding="async"
                     onerror="this.src='${defaultImage}'; this.onerror=null;">
            </div>
            <div class="nutrition-card-content">
                <h3 class="nutrition-card-title">${this.escapeHtml(item.title)}</h3>
                <p class="nutrition-card-summary">${this.escapeHtml(item.summary)}</p>
                <div class="nutrition-card-tags">
                    ${item.tags.slice(0, 5).map(tag => `<span class="nutrition-tag clickable-tag" data-tag="${this.escapeHtml(tag)}">#${this.escapeHtml(tag)}</span>`).join('')}
                </div>
                <div class="nutrition-card-footer">
                    <div class="nutrition-card-stats">
                        <span class="stat-item">
                            <span class="stat-label">조회수</span>
                            <span class="stat-count">${this.formatCount(item.viewCount)}</span>
                        </span>
                    </div>
                    <div class="nutrition-card-meta">
                        <span class="nutrition-source">${this.escapeHtml(item.sourceName)}</span>
                        <span class="nutrition-date">${formattedDate}</span>
                    </div>
                </div>
            </div>
        `;

        // 지연 로딩 이미지를 Intersection Observer에 등록
        if (shouldLazyLoad) {
            const img = newCard.querySelector('img');
            if (img && this.intersectionObserver) {
                this.intersectionObserver.observe(img);
            }
        }

        // 카드 클릭 이벤트 (상세 페이지로 이동) - 이벤트 위임 대신 직접 바인딩
        newCard.addEventListener('click', (e) => {
            // 원본 링크 클릭 시 새 탭에서 열기
            if (e.target.closest('.source-link')) {
                e.stopPropagation();
                if (item.sourceUrl) {
                    window.open(item.sourceUrl, '_blank', 'noopener,noreferrer');
                }
                return;
            }
            // 태그 클릭 시 해당 태그로 필터링 (상세 페이지 이동 방지)
            const clickedTag = e.target.closest('.clickable-tag');
            if (clickedTag) {
                e.stopPropagation();
                const tagName = clickedTag.getAttribute('data-tag');
                if (tagName) {
                    this.filterByTag(tagName);
                }
                return;
            }
            this.openNutritionDetail(item.id);
        }, { passive: true }); // passive 이벤트로 성능 향상

        this.renderedCardCount++;
        return newCard;
    }

    // HTML 이스케이프 함수 (XSS 방지)
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    openNutritionDetail(itemId) {
        // 상세 페이지로 이동
        window.location.href = `/nutrition-info-detail.html?id=${itemId}`;
    }

    handleSearch() {
        if (!this.searchInput) return; // 검색창이 없으면 리턴
        
        const query = this.searchInput.value.trim();
        if (query) {
            this.currentFilters.query = query;
        } else {
            delete this.currentFilters.query;
        }
        this.currentPage = 1;
        this.loadNutritionInfo();
    }

    renderPagination(pagination) {
        if (!pagination) {
            this.paginationContainer.style.display = 'none';
            return;
        }

        const limit = pagination.limit || this.itemsPerPage || 20;
        const totalPages = pagination.totalPages || Math.ceil((pagination.totalCount || 0) / limit) || 1;
        const currentPage = pagination.page || pagination.currentPage || this.currentPage || 1;

        if (totalPages <= 1) {
            this.paginationContainer.style.display = 'none';
            return;
        }

        this.paginationContainer.style.display = 'flex';
        
        // 화살표 버튼 상태 설정
        
        this.prevPageBtn.disabled = currentPage <= 1;
        this.nextPageBtn.disabled = currentPage >= totalPages;
        
        // 페이지 번호 렌더링
        this.pageNumbers.innerHTML = '';
        
        // 페이지 번호 범위 계산 (이미지처럼 1-5 범위로 표시)
        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, currentPage + 2);
        
        // 첫 페이지
        if (startPage > 1) {
            this.addPageNumber(1);
            if (startPage > 2) {
                this.addPageEllipsis();
            }
        }
        
        // 중간 페이지들
        for (let i = startPage; i <= endPage; i++) {
            this.addPageNumber(i, i === currentPage);
        }
        
        // 마지막 페이지
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                this.addPageEllipsis();
            }
            this.addPageNumber(totalPages);
        }
    }

    addPageNumber(pageNum, isActive = false) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `page-number ${isActive ? 'active' : ''}`;
        pageBtn.textContent = pageNum;
        pageBtn.addEventListener('click', () => this.goToPage(pageNum));
        this.pageNumbers.appendChild(pageBtn);
    }

    addPageEllipsis() {
        const ellipsis = document.createElement('span');
        ellipsis.className = 'page-ellipsis';
        ellipsis.textContent = '...';
        this.pageNumbers.appendChild(ellipsis);
    }

    goToPage(pageNum) {
        this.currentPage = pageNum;
        this.loadNutritionInfo();
    }

    goToPreviousPage() {
        if (this.currentPage > 1) {
            this.goToPage(this.currentPage - 1);
        }
    }

    goToNextPage() {
        this.goToPage(this.currentPage + 1);
    }

    // 유틸리티 메서드들
    getSourceTypeLabel(sourceType) {
        // 수동 포스팅만 사용하므로 간단하게 처리
        return sourceType === 'manual' ? '수동 포스팅' : sourceType;
    }

    getImageUrl(item) {
        // 1순위: 썸네일 이미지 사용
        if (item.thumbnailUrl) {
            return item.thumbnailUrl;
        }
        
        // 2순위: 일반 이미지 URL 사용
        if (item.imageUrl) {
            return item.imageUrl;
        }
        
        // 3순위: 기본 이미지 사용
        return this.getDefaultImage();
    }

    getDefaultImage() {
        // 수동 포스팅만 사용하므로 하나의 기본 이미지만 사용
        return 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=300&h=200&fit=crop';
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


    // 배치 데이터 실시간 렌더링
    renderBatchData(batchData, batchNumber) {
        // 첫 번째 배치에서 그리드 초기화 및 카운터 리셋
        if (batchNumber === 1) {
            this.nutritionGrid.innerHTML = '';
            this.renderedCardCount = 0;
            
            // 기존 카드들을 풀로 회수 (메모리 재사용)
            const existingCards = this.nutritionGrid.querySelectorAll('.nutrition-card');
            existingCards.forEach(card => {
                // 이벤트 리스너 제거를 위해 복제
                const cleanCard = card.cloneNode(false);
                cleanCard.className = 'nutrition-card';
                this.cardPool.push(cleanCard);
            });
        }

        // Document Fragment를 사용하여 DOM 조작 최적화
        const fragment = document.createDocumentFragment();

        // 배치 데이터를 카드로 변환하여 추가
        batchData.forEach((item, index) => {
            const card = this.createNutritionCard(item);
            
            // 배치별 애니메이션 지연 설정
            const globalIndex = ((batchNumber - 1) * 4) + index; // 배치 크기가 4라고 가정
            card.style.animationDelay = `${Math.min(globalIndex * 0.1, 1.5)}s`; // 최대 1.5초로 제한
            card.classList.add('progressive-fade-in');
            
            fragment.appendChild(card);
        });

        // 한 번에 DOM에 추가 (리플로우 최소화)
        this.nutritionGrid.appendChild(fragment);

        // 메모리 사용량 모니터링 및 정리
        this.monitorMemoryUsage();
    }

    // 메모리 사용량 모니터링 및 정리
    monitorMemoryUsage() {
        // 렌더링된 카드 수가 최대치를 초과하면 정리
        if (this.renderedCardCount > this.maxVisibleCards) {
            this.cleanupExcessCards();
        }

        // 카드 풀 크기 제한 (메모리 누수 방지)
        if (this.cardPool.length > 20) {
            this.cardPool = this.cardPool.slice(0, 20);
        }
    }

    // 과도한 카드 정리
    cleanupExcessCards() {
        const cards = this.nutritionGrid.querySelectorAll('.nutrition-card');
        const excessCount = cards.length - this.maxVisibleCards;
        
        if (excessCount > 0) {
            // 처음 카드들을 제거 (오래된 카드부터)
            for (let i = 0; i < excessCount; i++) {
                if (cards[i]) {
                    // Intersection Observer에서 제거
                    const img = cards[i].querySelector('img[data-src]');
                    if (img && this.intersectionObserver) {
                        this.intersectionObserver.unobserve(img);
                    }
                    
                    cards[i].remove();
                    this.renderedCardCount--;
                }
            }
        }
    }

    // 스트리밍 기능 제거됨

    // 스트리밍 기능 제거됨

    // 스트리밍 기능 제거됨

    // 상태 표시 메서드들 - 중복 제거 및 최적화
    hideAllStates() {
        // 모든 상태 요소를 한 번에 숨기기
        const states = [
            this.loadingState,
            this.skeletonState,
            this.errorState,
            this.emptyState,
            this.nutritionGrid,
            this.paginationContainer,
            null
        ].filter(Boolean); // null/undefined 요소 제거

        states.forEach(state => {
            state.style.display = 'none';
        });
    }

    showLoading() {
        this.hideAllStates();
        this.loadingState.style.display = 'block';
    }

    showError(message) {
        this.hideAllStates();
        this.errorMessage.textContent = message;
        this.errorState.style.display = 'block';
    }

    showEmpty() {
        this.hideAllStates();
        this.emptyState.style.display = 'block';
    }

    showContent() {
        // 필요한 상태만 숨기고, 페이지네이션은 renderPagination가 제어하도록 둠
        if (this.loadingState) this.loadingState.style.display = 'none';
        if (this.errorState) this.errorState.style.display = 'none';
        if (this.emptyState) this.emptyState.style.display = 'none';
        this.nutritionGrid.style.display = 'grid';
        // renderPagination에서 이미 표시 여부를 설정함
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
    new NutritionInfoManager();
});

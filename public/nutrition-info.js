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
        this.userInteractions = new Map(); // 사용자 상호작용 상태 캐시
        
        this.initializeElements();
        this.bindEvents();
        
        // URL 파라미터 확인
        const urlParams = new URLSearchParams(window.location.search);
        const nutritionId = urlParams.get('id');
        
        if (nutritionId) {
            this.loadSingleNutritionInfo(nutritionId);
        } else {
            this.loadNutritionInfo();
        }
    }

    initializeElements() {
        // DOM 요소들
        this.searchInput = document.getElementById('searchInput');
        
        this.loadingState = document.getElementById('loadingState');
        this.errorState = document.getElementById('errorState');
        this.emptyState = document.getElementById('emptyState');
        this.nutritionGrid = document.getElementById('nutritionGrid');
        this.paginationContainer = document.getElementById('paginationContainer');
        
        this.prevPageBtn = document.getElementById('prevPageBtn');
        this.nextPageBtn = document.getElementById('nextPageBtn');
        this.pageNumbers = document.getElementById('pageNumbers');
        this.retryBtn = document.getElementById('retryBtn');
        this.errorMessage = document.getElementById('errorMessage');
    }

    bindEvents() {
        // 검색 이벤트 (Enter 키만 사용)
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSearch();
        });

        // 페이지네이션 이벤트
        this.prevPageBtn.addEventListener('click', () => this.goToPreviousPage());
        this.nextPageBtn.addEventListener('click', () => this.goToNextPage());

        // 재시도 이벤트
        this.retryBtn.addEventListener('click', () => this.loadNutritionInfo());
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
        } finally {
            this.isLoading = false;
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
        this.nutritionGrid.appendChild(detailCard);
        
        this.showContent();
    }

    async renderNutritionInfo(data, pagination) {
        if (!data || data.length === 0) {
            this.showEmpty();
            return;
        }

        // 사용자 상호작용 상태 로드
        // await this.loadUserInteractions(data.map(item => item.id)); // 제거됨

        this.nutritionGrid.innerHTML = '';
        
        data.forEach(item => {
            const card = this.createNutritionCard(item);
            this.nutritionGrid.appendChild(card);
        });

        this.renderPagination(pagination);
        this.showContent();
    }

    createNutritionCard(item) {
        const card = document.createElement('div');
        card.className = 'nutrition-card';
        card.setAttribute('data-id', item.id);

        const sourceTypeLabel = this.getSourceTypeLabel(item.sourceType);
        const formattedDate = this.formatDate(item.publishedDate);

        card.innerHTML = `
            <div class="nutrition-card-thumbnail">
                <img src="${this.getImageUrl(item)}" 
                     alt="${item.title}" 
                     onerror="this.src='${this.getDefaultImage(item.sourceType)}'">
            </div>
            <div class="nutrition-card-content">
                <h3 class="nutrition-card-title">${item.title}</h3>
                <p class="nutrition-card-summary">${item.summary}</p>
                <div class="nutrition-card-tags">
                    ${item.tags.slice(0, 5).map(tag => `<span class="nutrition-tag">#${tag}</span>`).join('')}
                </div>
                <div class="nutrition-card-footer">
                    <div class="nutrition-card-stats">
                        <span class="stat-item">
                            <span class="stat-label">조회수</span>
                            <span class="stat-count">${this.formatCount(item.viewCount)}</span>
                        </span>
                    </div>
                    <div class="nutrition-card-meta">
                        <span class="nutrition-source">${item.sourceName}</span>
                        <span class="nutrition-date">${formattedDate}</span>
                    </div>
                </div>
            </div>
        `;

        // 카드 클릭 이벤트 (상세 페이지로 이동)
        card.addEventListener('click', (e) => {
            // 원본 링크 클릭 시 새 탭에서 열기
            if (e.target.closest('.source-link')) {
                e.stopPropagation();
                if (item.sourceUrl) {
                    window.open(item.sourceUrl, '_blank', 'noopener,noreferrer');
                }
                return;
            }
            this.openNutritionDetail(item.id);
        });

        return card;
    }

    // async loadUserInteractions(itemIds) { // 제거됨
    //     try {
    //         const response = await fetch('/api/auth/me', { credentials: 'include' });
    //         const authData = await response.json();
            
    //         if (!authData.loggedIn) return;

    //         // 각 아이템의 상호작용 상태를 개별적으로 확인
    //         for (const itemId of itemIds) {
    //             try {
    //                 const interactionResponse = await fetch(`/api/nutrition-info/${itemId}/interaction-status`, {
    //                     credentials: 'include'
    //                 });
                    
    //                 if (interactionResponse.ok) {
    //                     const interactionData = await interactionResponse.json();
    //                     if (interactionData.success) {
    //                         this.userInteractions.set(itemId, interactionData.data);
    //                     }
    //                 }
    //             } catch (error) {
    //                 console.log(`상호작용 상태 로드 실패 (${itemId}):`, error);
    //             }
    //         }
    //     } catch (error) {
    //         console.log('사용자 인증 상태 확인 실패:', error);
    //     }
    // }

    openNutritionDetail(itemId) {
        // 상세 페이지로 이동
        window.location.href = `/nutrition-info-detail.html?id=${itemId}`;
    }

    // async recordView(itemId) { // 제거됨
    //     try {
    //         const response = await fetch('/api/nutrition-info/view', {
    //             method: 'POST',
    //             headers: {
    //                 'Content-Type': 'application/json'
    //             },
    //             credentials: 'include',
    //             body: JSON.stringify({
    //                 nutritionInfoId: itemId
    //             })
    //         });
            
    //         // 401 오류는 로그인하지 않은 사용자이므로 무시
    //         if (response.status === 401) {
    //             console.log('로그인하지 않은 사용자 - 조회 기록을 저장하지 않습니다.');
    //             return;
    //         }
            
    //         if (!response.ok) {
    //             throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    //         }
    //     } catch (error) {
    //         console.log('조회 기록 추가 실패:', error);
    //     }
    // }

    handleSearch() {
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
        if (!pagination || pagination.totalPages <= 1) {
            this.paginationContainer.style.display = 'none';
            return;
        }

        this.paginationContainer.style.display = 'flex';
        
        // 화살표 버튼 상태 설정
        const currentPage = pagination.page || pagination.currentPage || 1;
        const totalPages = pagination.totalPages || 1;
        
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
            this.currentPage--;
            this.loadNutritionInfo();
        }
    }

    goToNextPage() {
        this.currentPage++;
        this.loadNutritionInfo();
    }



    // 유틸리티 메서드들
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

    // 소스 타입을 필터링용으로 변환
    getFilterSourceType(sourceType) {
        const mapping = {
            'pubmed': 'paper',
            'paper': 'paper',
            'youtube': 'youtube',
            'news': 'news'
        };
        return mapping[sourceType] || sourceType;
    }

    getImageUrl(item) {
        // 1순위: 수동 포스팅의 썸네일 이미지 (nutrition-thumbnail)
        if (item.thumbnailUrl) {
            return item.thumbnailUrl;
        }
        
        // 2순위: YouTube의 경우 실제 썸네일 우선 사용
        if (item.sourceType === 'youtube' && item.thumbnailUrl) {
            return item.thumbnailUrl;
        }
        
        // 3순위: 다른 소스의 경우 imageUrl 사용
        if (item.imageUrl) {
            return item.imageUrl;
        }
        
        // 4순위: 기본 이미지 사용
        return this.getDefaultImage(item.sourceType);
    }

    getDefaultImage(sourceType) {
        const images = {
            'paper': 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=300&h=200&fit=crop',
            'youtube': 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&h=200&fit=crop',
            'news': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&h=200&fit=crop',
            'manual': 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=300&h=200&fit=crop'
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

    // 상태 표시 메서드들
    showLoading() {
        this.loadingState.style.display = 'block';
        this.errorState.style.display = 'none';
        this.emptyState.style.display = 'none';
        this.nutritionGrid.style.display = 'none';
        this.paginationContainer.style.display = 'none';
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.loadingState.style.display = 'none';
        this.errorState.style.display = 'block';
        this.emptyState.style.display = 'none';
        this.nutritionGrid.style.display = 'none';
        this.paginationContainer.style.display = 'none';
    }

    showEmpty() {
        this.loadingState.style.display = 'none';
        this.errorState.style.display = 'none';
        this.emptyState.style.display = 'block';
        this.nutritionGrid.style.display = 'none';
        this.paginationContainer.style.display = 'none';
    }

    showContent() {
        this.loadingState.style.display = 'none';
        this.errorState.style.display = 'none';
        this.emptyState.style.display = 'none';
        this.nutritionGrid.style.display = 'grid';
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

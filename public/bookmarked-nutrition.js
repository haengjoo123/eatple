/**
 * 북마크한 영양정보 목록 페이지 JavaScript
 */

class BookmarkedNutritionManager {
    constructor() {
        this.currentPage = 1;
        this.itemsPerPage = 12;
        this.isLoading = false;
        
        this.initializeElements();
        this.bindEvents();
        this.loadBookmarkedNutrition();
    }

    initializeElements() {
        this.loadingState = document.getElementById('loadingState');
        this.errorState = document.getElementById('errorState');
        this.emptyState = document.getElementById('emptyState');
        this.nutritionGrid = document.getElementById('nutritionGrid');
        this.paginationContainer = document.getElementById('paginationContainer');
        this.bookmarkedCount = document.getElementById('bookmarkedCount');
        
        this.prevPageBtn = document.getElementById('prevPageBtn');
        this.nextPageBtn = document.getElementById('nextPageBtn');
        this.pageNumbers = document.getElementById('pageNumbers');
        this.retryBtn = document.getElementById('retryBtn');
        this.errorMessage = document.getElementById('errorMessage');
    }

    bindEvents() {
        // 재시도 이벤트
        this.retryBtn.addEventListener('click', () => this.loadBookmarkedNutrition());
        
        // 페이지네이션 이벤트
        this.prevPageBtn.addEventListener('click', () => this.goToPrevPage());
        this.nextPageBtn.addEventListener('click', () => this.goToNextPage());
    }

    async loadBookmarkedNutrition() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoading();

        try {
            const params = new URLSearchParams({
                page: this.currentPage,
                limit: this.itemsPerPage
            });

            const response = await fetch(`/api/nutrition-info/bookmarks?${params}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                if (response.status === 401) {
                    window.location.href = 'login.html';
                    return;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            
            if (result.success) {
                this.renderBookmarkedNutrition(result.data, result.pagination);
            } else {
                throw new Error(result.error || '북마크 목록을 불러오는데 실패했습니다.');
            }
        } catch (error) {
            console.error('북마크 목록 로딩 오류:', error);
            this.showError(error.message);
        } finally {
            this.isLoading = false;
        }
    }

    renderBookmarkedNutrition(data, pagination) {
        // 총 개수 업데이트 - 실제 조회 가능한 데이터 개수 사용
        const totalCount = pagination ? pagination.totalCount : (data ? data.length : 0);
        this.bookmarkedCount.textContent = `북마크한 정보: ${totalCount}개`;

        if (!data || data.length === 0) {
            this.showEmpty();
            return;
        }

        this.nutritionGrid.innerHTML = '';
        
        data.forEach(item => {
            const card = this.createNutritionCard(item);
            this.nutritionGrid.appendChild(card);
        });

        if (pagination) {
            this.renderPagination(pagination);
        }
        this.showContent();
    }

    createNutritionCard(item) {
        const card = document.createElement('div');
        card.className = 'nutrition-card';
        card.setAttribute('data-id', item.id);

        const sourceTypeLabel = this.getSourceTypeLabel(item.sourceType);
        const formattedDate = this.formatDate(item.publishedDate || item.createdAt);

        card.innerHTML = `
            <div class="nutrition-card-thumbnail">
                <img src="${this.getImageUrl(item)}" 
                     alt="${item.title}" 
                     onerror="this.src='${this.getDefaultImage(item.sourceType)}'">
            </div>
            <div class="nutrition-card-content">
                <h3 class="nutrition-card-title">${item.title}</h3>
                <p class="nutrition-card-summary">${item.summary || '요약 정보가 없습니다.'}</p>
                <div class="nutrition-card-tags">
                    ${(item.tags || []).slice(0, 5).map(tag => `<span class="nutrition-tag">#${tag}</span>`).join('')}
                </div>
                <div class="nutrition-card-meta">
                    <span class="nutrition-date">${formattedDate}</span>
                </div>
                <div class="nutrition-card-stats">
                    <span class="stat-item">
                        <span class="stat-label">조회수</span>
                        <span class="stat-count">${this.formatCount(item.viewCount || 0)}</span>
                    </span>
                </div>
            </div>
        `;

        // 카드 클릭 이벤트 - 상세 페이지로 이동
        card.addEventListener('click', () => {
            window.location.href = `nutrition-info.html?id=${item.id}`;
        });

        return card;
    }

    getSourceTypeLabel(sourceType) {
        const labels = {
            'pubmed': '논문',
            'paper': '논문',
            'youtube': '유튜브',
            'news': '뉴스',
            'manual': '직접입력'
        };
        return labels[sourceType] || '기타';
    }

    getImageUrl(item) {
        if (item.thumbnailUrl) return item.thumbnailUrl;
        if (item.imageUrl) return item.imageUrl;
        return this.getDefaultImage(item.sourceType);
    }

    getDefaultImage(sourceType) {
        const defaultImages = {
            'pubmed': '/images/default-paper.jpg',
            'paper': '/images/default-paper.jpg',
            'youtube': '/images/default-youtube.jpg',
            'news': '/images/default-news.jpg',
            'manual': '/images/default-nutrition.jpg'
        };
        return defaultImages[sourceType] || '/images/default-nutrition.jpg';
    }

    formatDate(dateString) {
        if (!dateString) return '날짜 정보 없음';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('ko-KR');
        } catch (error) {
            return '날짜 정보 없음';
        }
    }

    formatCount(count) {
        if (count >= 1000000) {
            return Math.floor(count / 1000000) + 'M';
        } else if (count >= 1000) {
            return Math.floor(count / 1000) + 'K';
        }
        return count.toString();
    }

    renderPagination(pagination) {
        if (!pagination || pagination.totalPages <= 1) {
            this.paginationContainer.style.display = 'none';
            return;
        }

        this.paginationContainer.style.display = 'block';
        
        // 이전/다음 버튼 상태
        this.prevPageBtn.disabled = !pagination.hasPrev;
        this.nextPageBtn.disabled = !pagination.hasNext;
        
        // 페이지 번호들
        this.pageNumbers.innerHTML = '';
        const startPage = Math.max(1, pagination.currentPage - 2);
        const endPage = Math.min(pagination.totalPages, pagination.currentPage + 2);
        
        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `page-number ${i === pagination.currentPage ? 'active' : ''}`;
            pageBtn.textContent = i;
            pageBtn.addEventListener('click', () => this.goToPage(i));
            this.pageNumbers.appendChild(pageBtn);
        }
    }

    goToPage(pageNum) {
        this.currentPage = pageNum;
        this.loadBookmarkedNutrition();
    }

    goToPrevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.loadBookmarkedNutrition();
        }
    }

    goToNextPage() {
        this.currentPage++;
        this.loadBookmarkedNutrition();
    }

    showLoading() {
        this.loadingState.style.display = 'block';
        this.errorState.style.display = 'none';
        this.emptyState.style.display = 'none';
        this.nutritionGrid.style.display = 'none';
        this.paginationContainer.style.display = 'none';
        
        // 로딩 중에는 카운트를 초기화
        this.bookmarkedCount.textContent = '북마크한 정보: 0개';
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
        
        // 빈 상태일 때 카운트를 0으로 설정
        this.bookmarkedCount.textContent = '북마크한 정보: 0개';
    }

    showContent() {
        this.loadingState.style.display = 'none';
        this.errorState.style.display = 'none';
        this.emptyState.style.display = 'none';
        this.nutritionGrid.style.display = 'grid';
        // 페이지네이션은 renderPagination에서 처리
    }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    new BookmarkedNutritionManager();
    
    // footer-nav-mobile AI 기능 모달 제어
    const aiFeatureBtn = document.querySelector(".footer-nav-ai-btn");
    const aiFeatureModal = document.getElementById("aiFeatureModal");
    
    if (aiFeatureBtn && aiFeatureModal) {
        // AI 기능 버튼 클릭 시 모달 토글
        aiFeatureBtn.addEventListener("click", function() {
            aiFeatureModal.classList.toggle("active");
        });
        
        // 모달 외부 클릭 시 닫기
        document.addEventListener("click", function(e) {
            if (!aiFeatureBtn.contains(e.target) && !aiFeatureModal.contains(e.target)) {
                aiFeatureModal.classList.remove("active");
            }
        });
        
        // ESC 키로 모달 닫기
        document.addEventListener("keydown", function(e) {
            if (e.key === "Escape") {
                aiFeatureModal.classList.remove("active");
            }
        });
    }
});
/**
 * 카테고리 페이지 JavaScript
 */

class CategoryPage {
    constructor() {
        this.currentCategory = null;
        this.products = [];
        this.filteredProducts = [];
        this.currentFilter = '추천순';
        this.priceRange = { min: null, max: null };
        this.userPoints = 0;
        this.selectedProduct = null;
        
        this.init();
    }
    
    async init() {
        // URL에서 카테고리 파라미터 가져오기
        const urlParams = new URLSearchParams(window.location.search);
        this.currentCategory = urlParams.get('category');
        
        if (!this.currentCategory) {
            // 카테고리가 없으면 메인 페이지로 리다이렉트
            window.location.href = 'store.html';
            return;
        }
        
        // DOM이 완전히 로드될 때까지 대기
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve);
            });
        }
        
        // 즉시 카테고리 정보 로드 (가장 빠르게 표시)
        this.loadCategoryInfo();
        
        // 병렬로 처리할 수 있는 작업들
        const promises = [
            this.checkAuthStatus(),
            this.loadProducts()
        ];
        
        // 헤더 인증 관리자는 백그라운드에서 처리
        this.initHeaderAuth();
        
        // 병렬 처리
        await Promise.all(promises);
        
        // UI 설정
        this.setupEventListeners();
        this.updateCartCount();
    }
    
    // 헤더 인증을 백그라운드에서 처리
    async initHeaderAuth() {
        try {
            let retryCount = 0;
            while (!window.headerAuthManager && retryCount < 5) { // 재시도 횟수 줄임
                await new Promise(resolve => setTimeout(resolve, 50)); // 대기 시간 줄임
                retryCount++;
            }
            
            if (window.headerAuthManager) {
                await window.headerAuthManager.refreshAuthStatus();
                await this.loadUserPoints(); // 인증 후 포인트 로드
            }
        } catch (error) {
            console.error('헤더 인증 초기화 오류:', error);
        }
    }
    
    async checkAuthStatus() {
        try {
            const response = await fetch('/api/auth/me', {
                credentials: 'include'
            });
            const data = await response.json();
            
            if (!data.loggedIn) {
                this.userPoints = 0;
                return;
            }
            
            if (window.headerAuthManager) {
                await window.headerAuthManager.refreshAuthStatus();
            }
        } catch (error) {
            console.error('인증 확인 오류:', error);
            this.userPoints = 0;
        }
    }
    
    async loadUserPoints() {
        try {
            const response = await fetch('/api/points/balance', {
                credentials: 'include'
            });
            const data = await response.json();
            
            if (data.success) {
                this.userPoints = data.balance;
                const availablePointsElement = document.getElementById('availablePoints');
                if (availablePointsElement) {
                    availablePointsElement.textContent = this.userPoints.toLocaleString();
                }
            } else {
                this.userPoints = 0;
            }
        } catch (error) {
            console.error('포인트 조회 오류:', error);
            this.userPoints = 0;
        }
    }
    
    loadCategoryInfo() {
        const categoryInfo = this.getCategoryInfo(this.currentCategory);
        
        // 페이지 제목 즉시 업데이트
        document.title = `${categoryInfo.display_name} - 잇플 스토어`;
        
        // DOM 요소 업데이트 (동기적으로 처리)
        const updateElements = () => {
            const breadcrumbElement = document.getElementById('categoryBreadcrumb');
            const titleElement = document.getElementById('categoryTitle');
            const mobileBreadcrumbElement = document.getElementById('mobileBreadcrumb');
            
            if (breadcrumbElement) {
                breadcrumbElement.textContent = categoryInfo.display_name;
            }
            
            if (titleElement) {
                titleElement.textContent = categoryInfo.display_name;
            }
            
            // 모바일 브레드크럼 업데이트
            if (mobileBreadcrumbElement) {
                this.updateMobileBreadcrumb(categoryInfo);
            }
            
            // 요소가 아직 없다면 잠시 후 다시 시도
            if (!breadcrumbElement || !titleElement || !mobileBreadcrumbElement) {
                setTimeout(updateElements, 10);
            }
        };
        
        updateElements();
    }
    
    updateMobileBreadcrumb(categoryInfo) {
        const mobileBreadcrumb = document.getElementById('mobileBreadcrumb');
        if (!mobileBreadcrumb) return;
        
        // 기존 내용 제거
        mobileBreadcrumb.innerHTML = '';
        
        // 홈 링크
        const homeLink = document.createElement('a');
        homeLink.href = 'store.html';
        homeLink.className = 'breadcrumb-item';
        homeLink.textContent = '홈';
        mobileBreadcrumb.appendChild(homeLink);
        
        // 첫 번째 구분자
        const separator1 = document.createElement('span');
        separator1.className = 'breadcrumb-separator';
        separator1.textContent = '>';
        mobileBreadcrumb.appendChild(separator1);
        
        // 상위 카테고리 (클릭 가능한 링크)
        const parentLink = document.createElement('a');
        parentLink.href = '#';
        parentLink.className = 'breadcrumb-item';
        parentLink.textContent = categoryInfo.parent_category;
        parentLink.addEventListener('click', (e) => {
            e.preventDefault();
            // 상위 카테고리 클릭 시 해당 카테고리 그룹으로 이동하는 로직
            this.navigateToParentCategory(categoryInfo.parent_category);
        });
        mobileBreadcrumb.appendChild(parentLink);
        
        // 두 번째 구분자
        const separator2 = document.createElement('span');
        separator2.className = 'breadcrumb-separator';
        separator2.textContent = '>';
        mobileBreadcrumb.appendChild(separator2);
        
        // 현재 카테고리 (클릭 불가능)
        const currentCategory = document.createElement('span');
        currentCategory.className = 'breadcrumb-item current';
        currentCategory.textContent = categoryInfo.display_name;
        mobileBreadcrumb.appendChild(currentCategory);
    }
    
    navigateToParentCategory(parentCategory) {
        // 상위 카테고리에 따라 적절한 페이지로 이동
        switch (parentCategory) {
            case '건강식품':
                // 건강식품 카테고리 페이지로 이동하거나 모달 열기
                this.openCategoryModal('health');
                break;
            case '간편식/반찬':
                this.openCategoryModal('convenient');
                break;
            case '신선식품':
                this.openCategoryModal('fresh');
                break;
            default:
                // 기본적으로 스토어 메인으로 이동
                window.location.href = 'store.html';
        }
    }
    
    openCategoryModal(categoryType) {
        // 모바일 햄버거 메뉴 모달 열기
        const hamburgerModal = document.getElementById('storeHamburgerModal');
        if (hamburgerModal) {
            hamburgerModal.classList.add('active');
            
            // 해당 카테고리 활성화
            setTimeout(() => {
                const categoryItems = document.querySelectorAll('.category-item');
                const subCategoryGroups = document.querySelectorAll('.sub-category-group');
                
                // 모든 카테고리 아이템에서 active 클래스 제거
                categoryItems.forEach(cat => cat.classList.remove('active'));
                
                // 해당하는 카테고리 아이템 활성화
                const targetCategoryItem = document.querySelector(`.category-item[data-category="${categoryType}"]`);
                if (targetCategoryItem) {
                    targetCategoryItem.classList.add('active');
                }
                
                // 모든 서브카테고리 그룹 숨기기
                subCategoryGroups.forEach(group => group.classList.remove('active'));
                
                // 해당하는 서브카테고리 그룹 보이기
                const targetGroup = document.querySelector(`.sub-category-group[data-category="${categoryType}"]`);
                if (targetGroup) {
                    targetGroup.classList.add('active');
                }
            }, 100);
        }
    }
    
    getCategoryInfo(categoryName) {
        const categoryMap = {
            // 건강식품
            'health_functional_food': {
                display_name: '건강기능식품',
                parent_category: '건강식품'
            },
            'protein_food': {
                display_name: '단백질 식품',
                parent_category: '건강식품'
            },
            'healthy_snack': {
                display_name: '건강 간식',
                parent_category: '건강식품'
            },
            'healthy_juice': {
                display_name: '건강 주스',
                parent_category: '건강식품'
            },
            // 간편식/반찬
            'home_meal_replacement': {
                display_name: '가정간편식',
                parent_category: '간편식/반찬'
            },
            'side_dish': {
                display_name: '반찬',
                parent_category: '간편식/반찬'
            },
            'salad': {
                display_name: '샐러드',
                parent_category: '간편식/반찬'
            },
            // 신선식품
            'fruit': {
                display_name: '과일',
                parent_category: '신선식품'
            },
            'meat': {
                display_name: '정육/계란',
                parent_category: '신선식품'
            },
            'seafood': {
                display_name: '수산/해산',
                parent_category: '신선식품'
            }
        };
        
        return categoryMap[categoryName] || {
            display_name: '카테고리',
            parent_category: '카테고리'
        };
    }
    
    async loadProducts() {
        this.showLoading();
        
        try {
            // 타임아웃 설정으로 API 응답이 느릴 경우 fallback 사용
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000); // 3초 타임아웃
            
            const response = await fetch(`/api/shop/products?category=${encodeURIComponent(this.currentCategory)}`, {
                credentials: 'include',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const data = await response.json();
                
                if (data.success && data.data && data.data.length > 0) {
                    this.products = data.data.map(product => ({
                        id: product.id,
                        name: product.name,
                        description: product.description,
                        summary: product.summary,
                        price: product.price,
                        originalPrice: product.original_price || product.originalPrice,
                        image: product.image_url || this.getDefaultEmoji(product.category),
                        category: product.category,
                        status: product.status,
                        rating: product.rating || Math.floor(Math.random() * 2) + 4
                    }));
                } else {
                    this.loadFallbackProducts();
                }
            } else {
                this.loadFallbackProducts();
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('API 요청 타임아웃, fallback 데이터 사용');
            } else {
                console.error('상품 조회 오류:', error);
            }
            this.loadFallbackProducts();
        }
        
        this.filteredProducts = [...this.products];
        this.hideLoading();
        this.updateProductCount();
        this.renderProducts();
    }
    
    loadFallbackProducts() {
        // 관리자 페이지에서 등록한 상품 먼저 확인
        const adminProducts = JSON.parse(localStorage.getItem('adminProducts') || '[]');
        
        if (adminProducts.length > 0) {
            const categoryProducts = adminProducts
                .filter(product => product.category === this.currentCategory && product.status === 'active')
                .map(product => ({
                    id: product.id,
                    name: product.name,
                    summary: product.summary || product.description?.replace(/<[^>]*>/g, '') || '',
                    description: product.description?.replace(/<[^>]*>/g, '') || '',
                    price: product.price,
                    originalPrice: product.originalPrice || product.original_price,
                    image: product.images && product.images.length > 0 ? product.images[0] : this.getDefaultEmoji(product.category),
                    category: product.category,
                    status: 'active',
                    rating: Math.floor(Math.random() * 2) + 4
                }));
            
            if (categoryProducts.length > 0) {
                this.products = categoryProducts;
                return;
            }
        }
        
        // 관리자 상품이 없을 때 빈 배열로 설정
        this.products = [];
    }
    
    getDefaultEmoji(category) {
        const emojiMap = {
            'health_functional_food': '💊',
            'protein_food': '💪',
            'healthy_snack': '🥜',
            'healthy_juice': '🥤',
            'home_meal_replacement': '🍱',
            'side_dish': '🥘',
            'salad': '🥗',
            'fruit': '🍎',
            'meat': '🥩',
            'seafood': '🐟'
        };
        return emojiMap[category] || '📦';
    }
    
    showLoading() {
        document.getElementById('loadingState').style.display = 'block';
        document.getElementById('productsGrid').style.display = 'none';
        document.getElementById('emptyState').style.display = 'none';
    }
    
    hideLoading() {
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('productsGrid').style.display = 'grid';
    }
    
    updateProductCount() {
        // PC용과 모바일용 상품 카운트 모두 업데이트
        const productCountElements = document.querySelectorAll('#productCount');
        productCountElements.forEach(element => {
            element.textContent = this.filteredProducts.length;
        });
        
        // 모바일용 상품 카운트 업데이트
        const mobileProductCount = document.getElementById('mobileProductCount');
        if (mobileProductCount) {
            mobileProductCount.textContent = this.filteredProducts.length;
        }
    }
    
    renderProducts() {
        const productsGrid = document.getElementById('productsGrid');
        
        if (this.filteredProducts.length === 0) {
            productsGrid.style.display = 'none';
            document.getElementById('emptyState').style.display = 'block';
            return;
        }
        
        document.getElementById('emptyState').style.display = 'none';
        productsGrid.style.display = 'grid';
        
        productsGrid.innerHTML = this.filteredProducts.map(product => {
            // 디버깅을 위한 로그
            console.log('상품 데이터:', product);
            
            // 할인율 계산
            const discount = product.originalPrice && product.originalPrice > product.price
                ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
                : 0;

            return `
            <div class="product-card" data-product-id="${product.id}" onclick="categoryPage.goToProductDetail('${product.id}')" style="cursor: pointer;">
                <div class="product-image-container">
                    ${this.createImageHtml(product.image, product.name)}
                </div>
                <div class="product-cart-section">
                    <div class="product-actions">
                        <button class="cart-add-button" onclick="event.stopPropagation(); categoryPage.openProductDetailModal('${product.id}')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="9" cy="21" r="1"></circle>
                                <circle cx="20" cy="21" r="1"></circle>
                                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                            </svg>
                            담기
                        </button>
                    </div>
                </div>
                <div class="product-info">
                    <h3 class="product-name">${this.escapeHtml(product.name)}</h3>
                    <p class="product-summary">${this.escapeHtml(product.summary || '')}</p>
                    <div class="product-meta">
                        <div class="product-price">
                            ${product.originalPrice && product.originalPrice > product.price
                                ? `<span class="original-price">${product.originalPrice.toLocaleString()}원</span>`
                                : ''
                            }
                            <div class="price-row">
                                ${discount > 0
                                    ? `<span class="discount-rate">${discount}%</span>`
                                    : ''
                                }
                                <span class="current-price">${product.price.toLocaleString()}원</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        }).join('');
    }
    
    createImageHtml(imageUrl, productName) {
        const validUrl = this.extractValidImageUrl(imageUrl);
        
        if (!validUrl) {
            return `<div class="product-image-placeholder">📦</div>`;
        }
        
        const safeUrl = this.escapeHtml(validUrl);
        const safeName = this.escapeHtml(productName);
        
        return `<img src="${safeUrl}" alt="${safeName}" class="product-image" 
                onload="console.log('상품 이미지 로딩 성공')" 
                onerror="this.style.display='none'; this.parentElement.classList.add('image-error');">
                <div class="product-image-placeholder" style="display: none;">📦</div>`;
    }

    // 유효한 이미지 URL 추출
    extractValidImageUrl(imageData) {
        if (!imageData) {
            return null;
        }

        // 이모지인 경우 (길이가 1-4인 문자)
        if (typeof imageData === 'string' && imageData.length <= 4 && !/^https?:\/\//.test(imageData)) {
            return null;
        }

        const imageStr = String(imageData).trim();
        
        if (!imageStr || imageStr === '[]' || imageStr === 'null' || imageStr === 'undefined') {
            return null;
        }

        // JSON 배열 형태인지 확인
        if (imageStr.startsWith('[') && imageStr.endsWith(']')) {
            try {
                const images = JSON.parse(imageStr);
                if (Array.isArray(images) && images.length > 0) {
                    const firstImage = String(images[0]).trim();
                    return this.isValidImageUrl(firstImage) ? firstImage : null;
                }
            } catch (e) {
                console.warn('JSON 파싱 실패:', imageStr, e);
            }
            return null;
        }

        // 단일 URL인 경우
        return this.isValidImageUrl(imageStr) ? imageStr : null;
    }

    // URL 유효성 검사
    isValidImageUrl(url) {
        if (!url || typeof url !== 'string') {
            return false;
        }

        const trimmedUrl = url.trim();
        
        if (!trimmedUrl || trimmedUrl === '[]' || trimmedUrl === 'null' || trimmedUrl === 'undefined') {
            return false;
        }

        return trimmedUrl.startsWith('http://') || 
               trimmedUrl.startsWith('https://') || 
               trimmedUrl.startsWith('/') ||
               trimmedUrl.startsWith('./') ||
               trimmedUrl.startsWith('../') ||
               trimmedUrl.startsWith('data:image/');
    }
    
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    setupEventListeners() {
        // 필터 버튼 이벤트 (PC용과 모바일용 모두)
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // 모든 필터 버튼에서 active 클래스 제거
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                // 클릭된 버튼에 active 클래스 추가
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.filter;
                
                // 모바일용 정렬 드롭다운과 동기화
                const sortText = document.querySelector('.sort-text');
                if (sortText) {
                    sortText.textContent = e.target.dataset.filter;
                }
                
                this.applyFilters();
            });
        });
        
        // 가격 필터 적용
        document.getElementById('pcApplyPriceFilter').addEventListener('click', () => {
            const minPrice = document.getElementById('pcMinPrice').value;
            const maxPrice = document.getElementById('pcMaxPrice').value;
            
            this.priceRange.min = minPrice ? parseInt(minPrice) : null;
            this.priceRange.max = maxPrice ? parseInt(maxPrice) : null;
            
            // 모바일용 입력 필드와 동기화
            const mobileMinPrice = document.getElementById('mobileMinPrice');
            const mobileMaxPrice = document.getElementById('mobileMaxPrice');
            if (mobileMinPrice) mobileMinPrice.value = minPrice;
            if (mobileMaxPrice) mobileMaxPrice.value = maxPrice;
            
            this.applyFilters();
        });
        
        // 검색 기능
        const searchInput = document.querySelector('.search-input');
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.performSearch(searchInput.value);
                }
            });
        }
        
        // 모바일 필터 기능
        this.setupMobileFilters();
        
        // 상품 상세 모달 이벤트
        this.setupProductDetailModal();
        
        // 구매 모달 이벤트
        this.setupPurchaseModal();
        
        // 장바구니 업데이트
        this.updateCartCount();
        
        // 실시간 상품 업데이트 리스너
        this.setupRealTimeUpdates();
    }
    
    setupMobileFilters() {
        // 정렬 드롭다운 토글
        const sortBtn = document.getElementById('sortBtn');
        const sortDropdown = document.getElementById('sortDropdown');
        
        if (sortBtn && sortDropdown) {
            sortBtn.addEventListener('click', () => {
                const sortDropdown = document.querySelector('.sort-dropdown');
                sortDropdown.classList.toggle('active');
            });
            
            // 정렬 옵션 선택
            document.querySelectorAll('.sort-option').forEach(option => {
                option.addEventListener('click', (e) => {
                    const sortText = e.target.textContent;
                    const sortValue = e.target.dataset.sort;
                    document.querySelector('.sort-text').textContent = sortText;
                    document.querySelector('.sort-dropdown').classList.remove('active');
                    
                    // PC용 필터 버튼과 동기화
                    document.querySelectorAll('.filter-btn').forEach(btn => {
                        btn.classList.remove('active');
                        if (btn.dataset.filter === sortValue) {
                            btn.classList.add('active');
                        }
                    });
                    
                    // 필터 적용
                    this.currentFilter = sortValue;
                    this.applyFilters();
                });
            });
            
            // 드롭다운 외부 클릭 시 닫기
            document.addEventListener('click', (e) => {
                if (!sortBtn.contains(e.target) && !sortDropdown.contains(e.target)) {
                    sortDropdown.classList.remove('active');
                }
            });
        }
        
        // 필터 토글 버튼
        const filterToggleBtn = document.getElementById('filterToggleBtn');
        const filterExpanded = document.getElementById('filterExpanded');
        
        if (filterToggleBtn && filterExpanded) {
            filterToggleBtn.addEventListener('click', () => {
                const isExpanded = filterExpanded.style.display !== 'none';
                filterExpanded.style.display = isExpanded ? 'none' : 'block';
            });
        }
        
        // 모바일용 가격 필터 적용
        const mobileApplyPriceFilter = document.getElementById('mobileApplyPriceFilter');
        if (mobileApplyPriceFilter) {
            mobileApplyPriceFilter.addEventListener('click', () => {
                const minPrice = document.getElementById('mobileMinPrice').value;
                const maxPrice = document.getElementById('mobileMaxPrice').value;
                
                this.priceRange.min = minPrice ? parseInt(minPrice) : null;
                this.priceRange.max = maxPrice ? parseInt(maxPrice) : null;
                
                // PC용 입력 필드와 동기화
                const pcMinPrice = document.getElementById('pcMinPrice');
                const pcMaxPrice = document.getElementById('pcMaxPrice');
                if (pcMinPrice) pcMinPrice.value = minPrice;
                if (pcMaxPrice) pcMaxPrice.value = maxPrice;
                
                this.applyFilters();
            });
        }
    }
    
    applyFilters() {
        let filtered = [...this.products];
        
        // 가격 필터 적용
        if (this.priceRange.min !== null) {
            filtered = filtered.filter(product => product.price >= this.priceRange.min);
        }
        if (this.priceRange.max !== null) {
            filtered = filtered.filter(product => product.price <= this.priceRange.max);
        }
        
        // 정렬 적용
        switch (this.currentFilter) {
            case '추천순':
                filtered.sort((a, b) => b.rating - a.rating);
                break;
            case '낮은 가격순':
                filtered.sort((a, b) => a.price - b.price);
                break;
            case '판매순':
                // 임시로 랜덤 정렬
                filtered.sort(() => Math.random() - 0.5);
                break;
        }
        
        this.filteredProducts = filtered;
        this.updateProductCount();
        this.renderProducts();
    }
    
    performSearch(query) {
        if (!query.trim()) {
            this.filteredProducts = [...this.products];
        } else {
            this.filteredProducts = this.products.filter(product =>
                product.name.toLowerCase().includes(query.toLowerCase()) ||
                (product.summary && product.summary.toLowerCase().includes(query.toLowerCase())) ||
                (product.description && product.description.toLowerCase().includes(query.toLowerCase()))
            );
        }
        this.updateProductCount();
        this.renderProducts();
    }
    
    addToCart(productId, quantity = 1) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;
        
        // 장바구니에 추가 로직 (cart.js와 동일한 키와 구조 사용)
        let cart = JSON.parse(localStorage.getItem('eatple_cart') || '[]');
        const existingItem = cart.find(item => item.id === productId);
        
        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            cart.push({
                id: product.id,
                name: product.name,
                price: product.price,
                originalPrice: product.originalPrice,
                image: product.image,
                brand: product.brand || '', // 브랜드 정보 추가
                shippingFee: product.shipping_fee || 3000, // 배송비 정보 추가
                quantity: quantity,
                selected: true // cart.js에서 사용하는 필드
            });
        }
        
        localStorage.setItem('eatple_cart', JSON.stringify(cart));
        this.updateCartCount();
        
        // 성공 메시지 표시
        this.showMessage('장바구니에 추가되었습니다!', 'success');
    }
    
    updateCartCount() {
        try {
            // cart.js와 동일한 키와 계산 방식 사용
            const cart = JSON.parse(localStorage.getItem('eatple_cart') || '[]');
            
            // 제품 종류 수 기준으로 카운트 (cart.js와 동일한 방식)
            let productTypesCount = 0;
            if (Array.isArray(cart) && cart.length > 0) {
                const hasAllIds = cart.every(item => item && typeof item.id !== 'undefined' && item.id !== null);
                if (hasAllIds) {
                    productTypesCount = new Set(cart.map(item => item.id)).size;
                } else {
                    const uniqueKeys = new Set(
                        cart.map(item => (item && (item.id ?? item.name ?? JSON.stringify(item))))
                    );
                    productTypesCount = uniqueKeys.size;
                }
            }
            
            document.querySelectorAll('.cart-count').forEach(element => {
                element.textContent = String(productTypesCount);
            });
        } catch (error) {
            console.error('장바구니 카운트 업데이트 오류:', error);
        }
    }

    // 상품 상세 모달 설정
    setupProductDetailModal() {
        const productDetailModal = document.getElementById('productDetailModal');
        const closeBtn = document.getElementById('productDetailClose');
        const cancelBtn = document.getElementById('productDetailCancel');
        const addToCartBtn = document.getElementById('addToCartBtn');
        const decreaseQtyBtn = document.getElementById('decreaseQty');
        const increaseQtyBtn = document.getElementById('increaseQty');
        const quantityInput = document.getElementById('quantityInput');

        // 모달 닫기
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                productDetailModal.style.display = 'none';
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                productDetailModal.style.display = 'none';
            });
        }

        // 모달 외부 클릭 시 닫기
        if (productDetailModal) {
            productDetailModal.addEventListener('click', (e) => {
                if (e.target === productDetailModal) {
                    productDetailModal.style.display = 'none';
                }
            });
        }

        // 수량 조절 버튼
        if (decreaseQtyBtn) {
            decreaseQtyBtn.addEventListener('click', () => {
                const currentValue = parseInt(quantityInput.value) || 1;
                if (currentValue > 1) {
                    quantityInput.value = currentValue - 1;
                    this.updateTotalPrice();
                }
            });
        }

        if (increaseQtyBtn) {
            increaseQtyBtn.addEventListener('click', () => {
                const currentValue = parseInt(quantityInput.value) || 1;
                if (currentValue < 10) {
                    quantityInput.value = currentValue + 1;
                    this.updateTotalPrice();
                }
            });
        }

        // 수량 입력 필드 변경 시 총 가격 업데이트
        if (quantityInput) {
            quantityInput.addEventListener('input', () => {
                this.updateTotalPrice();
            });
        }

        // 장바구니 담기 버튼
        if (addToCartBtn) {
            addToCartBtn.addEventListener('click', () => {
                this.addToCartFromModal();
            });
        }
    }

    // 상품 상세 모달 열기
    openProductDetailModal(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) {
            console.error('상품을 찾을 수 없습니다:', productId);
            return;
        }

        this.selectedProduct = product;

        // 모달 내용 업데이트
        document.getElementById('productDetailTitle').textContent = product.name;
        document.getElementById('productDetailName').textContent = product.name;
        document.getElementById('productDetailSummary').textContent = product.summary || '';
        document.getElementById('productDetailPrice').textContent = `${product.price.toLocaleString()}원`;

        // 원가 표시
        const originalPriceElement = document.getElementById('productDetailOriginalPrice');
        if (product.originalPrice && product.originalPrice > product.price) {
            originalPriceElement.textContent = `${product.originalPrice.toLocaleString()}원`;
            originalPriceElement.style.display = 'inline';
        } else {
            originalPriceElement.style.display = 'none';
        }

        // 이미지 설정 - renderProducts와 동일한 로직 사용
        const imageContainer = document.getElementById('productDetailImageContainer');
        console.log('모달 이미지 처리 - 원본 이미지 데이터:', product.image);
        
        const validImageUrl = this.extractValidImageUrl(product.image);
        console.log('모달 이미지 처리 - 유효한 URL:', validImageUrl);
        
        if (validImageUrl) {
            const safeUrl = this.escapeHtml(validImageUrl);
            const safeName = this.escapeHtml(product.name);
            console.log('모달 이미지 처리 - 최종 URL:', safeUrl);
            imageContainer.innerHTML = `<img src="${safeUrl}" alt="${safeName}" class="product-image" onload="console.log('모달 이미지 로딩 성공')" onerror="console.log('모달 이미지 로딩 실패')">`;
        } else {
            console.log('모달 이미지 처리 - 유효한 URL 없음, placeholder 표시');
            imageContainer.innerHTML = `<div class="product-image-placeholder">📦</div>`;
        }

        // 수량 초기화
        document.getElementById('quantityInput').value = 1;
        this.updateTotalPrice();

        // 모달 표시
        document.getElementById('productDetailModal').style.display = 'block';
    }

    // 총 가격 업데이트
    updateTotalPrice() {
        if (!this.selectedProduct) return;

        const quantity = parseInt(document.getElementById('quantityInput').value) || 1;
        const totalPrice = this.selectedProduct.price * quantity;
        document.getElementById('totalPrice').textContent = `${totalPrice.toLocaleString()}원`;
    }

    // 모달에서 장바구니에 추가
    addToCartFromModal() {
        if (!this.selectedProduct) return;

        const quantity = parseInt(document.getElementById('quantityInput').value) || 1;

        // 장바구니에 추가
        this.addToCart(this.selectedProduct.id, quantity);

        // 모달 닫기
        document.getElementById('productDetailModal').style.display = 'none';
    }
    
    openPurchaseModal(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;
        
        this.selectedProduct = product;
        
        // 구매 요약 업데이트
        const purchaseSummary = document.getElementById('purchaseSummary');
        purchaseSummary.innerHTML = `
            <div class="summary-row">
                <span>상품명</span>
                <span>${this.escapeHtml(product.name)}</span>
            </div>
            <div class="summary-row">
                <span>가격</span>
                <span>${product.price.toLocaleString()}원</span>
            </div>
            <div class="summary-row">
                <span>포인트 사용</span>
                <span id="pointsUsed">0원</span>
            </div>
            <div class="summary-row total">
                <span>최종 결제금액</span>
                <span id="finalAmount">${product.price.toLocaleString()}원</span>
            </div>
        `;
        
        // 포인트 입력 최대값 설정
        const pointsInput = document.getElementById('pointsInput');
        pointsInput.max = Math.min(this.userPoints, product.price);
        pointsInput.value = 0;
        
        // 모달 표시
        document.getElementById('purchaseModal').style.display = 'block';
    }
    
    setupPurchaseModal() {
        const modal = document.getElementById('purchaseModal');
        const closeBtn = document.getElementById('modalClose');
        const cancelBtn = document.getElementById('cancelBtn');
        const confirmBtn = document.getElementById('confirmBtn');
        const pointsInput = document.getElementById('pointsInput');
        const maxPointsBtn = document.getElementById('maxPointsBtn');
        
        // 모달 닫기
        if (closeBtn) closeBtn.onclick = () => modal.style.display = 'none';
        if (cancelBtn) cancelBtn.onclick = () => modal.style.display = 'none';
        
        window.onclick = (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        };
        
        // 포인트 입력 이벤트
        if (pointsInput) {
            pointsInput.addEventListener('input', () => {
                this.updatePurchaseSummary();
            });
        }
        
        // 최대 포인트 사용
        if (maxPointsBtn) {
            maxPointsBtn.onclick = () => {
                if (this.selectedProduct) {
                    const maxPoints = Math.min(this.userPoints, this.selectedProduct.price);
                    pointsInput.value = maxPoints;
                    this.updatePurchaseSummary();
                }
            };
        }
        
        // 구매 확인
        if (confirmBtn) {
            confirmBtn.onclick = () => {
                this.processPurchase();
            };
        }
    }
    
    updatePurchaseSummary() {
        if (!this.selectedProduct) return;
        
        const pointsInput = document.getElementById('pointsInput');
        const pointsToUse = parseInt(pointsInput.value) || 0;
        const finalAmount = Math.max(0, this.selectedProduct.price - pointsToUse);
        
        document.getElementById('pointsUsed').textContent = `${pointsToUse.toLocaleString()}원`;
        document.getElementById('finalAmount').textContent = `${finalAmount.toLocaleString()}원`;
    }
    
    async processPurchase() {
        if (!this.selectedProduct) return;
        
        const pointsToUse = parseInt(document.getElementById('pointsInput').value) || 0;
        const finalAmount = Math.max(0, this.selectedProduct.price - pointsToUse);
        
        this.showPurchaseLoading();
        
        try {
            const response = await fetch('/api/shop/purchase', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    productId: this.selectedProduct.id,
                    pointsToUse: pointsToUse,
                    finalAmount: finalAmount
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showPurchaseSuccess('구매가 완료되었습니다!');
                await this.loadUserPoints(); // 포인트 잔액 업데이트
                
                setTimeout(() => {
                    document.getElementById('purchaseModal').style.display = 'none';
                }, 2000);
            } else {
                this.showPurchaseError(data.error || '구매 처리 중 오류가 발생했습니다.');
            }
        } catch (error) {
            console.error('구매 처리 오류:', error);
            this.showPurchaseError('구매 처리 중 오류가 발생했습니다.');
        }
    }
    
    showPurchaseLoading() {
        document.getElementById('loadingSpinner').style.display = 'block';
        document.getElementById('purchaseForm').style.display = 'none';
        document.getElementById('errorMessage').style.display = 'none';
        document.getElementById('successMessage').style.display = 'none';
    }
    
    showPurchaseSuccess(message) {
        document.getElementById('loadingSpinner').style.display = 'none';
        document.getElementById('purchaseForm').style.display = 'none';
        document.getElementById('errorMessage').style.display = 'none';
        document.getElementById('successMessage').style.display = 'block';
        document.getElementById('successMessage').textContent = message;
    }
    
    showPurchaseError(message) {
        document.getElementById('loadingSpinner').style.display = 'none';
        document.getElementById('purchaseForm').style.display = 'block';
        document.getElementById('successMessage').style.display = 'none';
        document.getElementById('errorMessage').style.display = 'block';
        document.getElementById('errorMessage').textContent = message;
    }
    
    showMessage(message, type = 'info') {
        // 간단한 토스트 메시지 표시
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#4a7c59' : '#ff4757'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
    
    setupRealTimeUpdates() {
        // 관리자 페이지에서 상품 업데이트 시 실시간 반영
        window.addEventListener('adminProductsUpdated', async (event) => {
            console.log('관리자 상품 업데이트 감지, 카테고리 페이지 새로고침');
            await this.loadProducts();
        });
        
        // localStorage 변경 감지 (다른 탭에서 변경 시)
        window.addEventListener('storage', async (event) => {
            if (event.key === 'adminProducts') {
                console.log('다른 탭에서 상품 업데이트 감지');
                await this.loadProducts();
            }
        });
    }
    
    // 제품 상세 페이지로 이동
    goToProductDetail(productId) {
        window.location.href = `product-detail.html?id=${productId}`;
    }
}

// 페이지 로드 시 초기화
let categoryPage;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        categoryPage = new CategoryPage();
    });
} else {
    categoryPage = new CategoryPage();
}

// CSS 애니메이션 추가
const categoryStyle = document.createElement('style');
categoryStyle.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(categoryStyle);

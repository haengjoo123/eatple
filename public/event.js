/**
 * 이벤트 페이지 JavaScript
 * 이벤트 상품만을 위한 전용 페이지
 */

class EventPage {
    constructor() {
        this.products = [];
        this.filteredProducts = [];
        this.currentFilter = 'all';
        this.currentSort = 'latest';
        this.userPoints = 0;
        this.selectedProduct = null;
        this.cart = [];
        
        this.init();
    }
    
    async init() {
        // DOM이 완전히 로드될 때까지 대기
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve);
            });
        }
        
        // 병렬로 처리할 수 있는 작업들
        const promises = [
            this.checkAuthStatus(),
            this.loadEventProducts()
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
            while (!window.headerAuthManager && retryCount < 5) {
                await new Promise(resolve => setTimeout(resolve, 50));
                retryCount++;
            }
            
            if (window.headerAuthManager) {
                await window.headerAuthManager.refreshAuthStatus();
                await this.loadUserPoints();
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
                console.log('비로그인 사용자 접근');
                this.userPoints = 0;
                return;
            }
            
            // 헤더 인증 관리자가 있으면 상태 동기화
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
                this.updatePointsDisplay();
            }
        } catch (error) {
            console.error('포인트 로드 오류:', error);
            this.userPoints = 0;
        }
    }
    
    async loadEventProducts() {
        try {
            // 로딩 상태 표시
            this.showLoading();
            
            // 이벤트 상품만 조회
            const response = await fetch('/api/shop/event-products', {
                credentials: 'include'
            });
            const data = await response.json();
            
            if (data.success) {
                this.products = data.products || [];
                console.log('이벤트 상품 로드됨:', this.products.length, '개');
            } else {
                console.error('이벤트 상품 조회 실패:', data.error);
                this.products = [];
            }
        } catch (error) {
            console.error('이벤트 상품 조회 오류:', error);
            this.products = [];
        } finally {
            this.hideLoading();
            this.filterAndRenderProducts();
        }
    }
    
    filterAndRenderProducts() {
        // 필터 적용
        this.filteredProducts = this.applyFilter(this.products);
        
        // 정렬 적용
        this.applySort(this.filteredProducts);
        
        // 렌더링
        this.renderProducts();
        
        // 빈 상태 확인
        if (this.filteredProducts.length === 0) {
            this.showEmptyState();
        } else {
            this.hideEmptyState();
        }
    }
    
    applyFilter(products) {
        switch (this.currentFilter) {
            case 'ongoing':
                return products.filter(p => p.is_event && this.isEventOngoing(p));
            case 'upcoming':
                return products.filter(p => p.is_event && this.isEventUpcoming(p));
            case 'ended':
                return products.filter(p => p.is_event && this.isEventEnded(p));
            default:
                return products.filter(p => p.is_event || p.event_tag);
        }
    }
    
    applySort(products) {
        switch (this.currentSort) {
            case 'popular':
                products.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
                break;
            case 'ending':
                products.sort((a, b) => {
                    const aEnd = new Date(a.event_end_date || a.created_at);
                    const bEnd = new Date(b.event_end_date || b.created_at);
                    return aEnd - bEnd;
                });
                break;
            case 'latest':
            default:
                products.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                break;
        }
    }
    
    isEventOngoing(product) {
        if (!product.event_start_date || !product.event_end_date) return true;
        const now = new Date();
        const start = new Date(product.event_start_date);
        const end = new Date(product.event_end_date);
        return now >= start && now <= end;
    }
    
    isEventUpcoming(product) {
        if (!product.event_start_date) return false;
        const now = new Date();
        const start = new Date(product.event_start_date);
        return now < start;
    }
    
    isEventEnded(product) {
        if (!product.event_end_date) return false;
        const now = new Date();
        const end = new Date(product.event_end_date);
        return now > end;
    }
    
    renderProducts() {
        const grid = document.getElementById('productsGrid');
        if (!grid) return;
        
        if (this.filteredProducts.length === 0) {
            grid.innerHTML = '';
            return;
        }
        
        const productsHTML = this.filteredProducts.map(product => this.createProductCard(product)).join('');
        grid.innerHTML = productsHTML;
        
        // 상품 카드 이벤트 리스너 추가
        this.attachProductEventListeners();
    }
    
    createProductCard(product) {
        const discountRate = product.discount_rate || 0;
        const originalPrice = product.price || 0;
        const discountedPrice = Math.round(originalPrice * (1 - discountRate / 100));
        const eventStatus = this.getEventStatus(product);
        
        return `
            <div class="product-card event-product-card" data-product-id="${product.id}">
                <div class="product-image-container">
                    <img src="${product.image_url || 'images/default-product.jpg'}" alt="${product.name}" class="product-image" />
                    ${discountRate > 0 ? `<div class="discount-badge">${discountRate}%</div>` : ''}
                    ${eventStatus ? `<div class="event-status-badge ${eventStatus.class}">${eventStatus.text}</div>` : ''}
                </div>
                <div class="product-info">
                    <h3 class="product-name">${product.name}</h3>
                    <p class="product-description">${product.description || ''}</p>
                    <div class="product-price">
                        ${discountRate > 0 ? `<span class="original-price">${originalPrice.toLocaleString()}원</span>` : ''}
                        <span class="current-price">${discountedPrice.toLocaleString()}원</span>
                    </div>
                    <div class="product-actions">
                        <button class="cart-add-button" onclick="event.stopPropagation(); eventPage.openPurchaseModal('${product.id}')" title="상품 상세보기">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="9" cy="21" r="1"></circle>
                                <circle cx="20" cy="21" r="1"></circle>
                                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                            </svg>
                            구매하기
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    getEventStatus(product) {
        if (this.isEventOngoing(product)) {
            return { text: '진행중', class: 'ongoing' };
        } else if (this.isEventUpcoming(product)) {
            return { text: '예정', class: 'upcoming' };
        } else if (this.isEventEnded(product)) {
            return { text: '종료', class: 'ended' };
        }
        return null;
    }
    
    setupEventListeners() {
        // 필터 버튼 이벤트
        const filterButtons = document.querySelectorAll('.filter-btn');
        filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                filterButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentFilter = btn.dataset.filter;
                this.filterAndRenderProducts();
            });
        });
        
        // 정렬 선택 이벤트
        const sortSelect = document.getElementById('sortSelect');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.currentSort = e.target.value;
                this.filterAndRenderProducts();
            });
        }
        
        // 검색 이벤트
        this.setupSearchEvents();
        
        // 모달 이벤트
        this.setupModalEvents();
        
        // 마이페이지 이벤트
        this.setupMypageEvents();
        
        // 장바구니 이벤트
        this.setupCartEvents();
    }
    
    setupSearchEvents() {
        const searchInput = document.querySelector('.search-input');
        const searchBtn = document.querySelector('.search-btn');
        const searchInputNav = document.querySelector('.search-input-nav');
        const searchBtnNav = document.querySelector('.search-btn-nav');
        
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.performSearch(searchInput.value);
                }
            });
        }
        
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                this.performSearch(searchInput.value);
            });
        }
        
        if (searchInputNav) {
            searchInputNav.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.performSearch(searchInputNav.value);
                }
            });
        }
        
        if (searchBtnNav) {
            searchBtnNav.addEventListener('click', () => {
                this.performSearch(searchInputNav.value);
            });
        }
    }
    
    performSearch(query) {
        if (!query.trim()) {
            this.filterAndRenderProducts();
            return;
        }
        
        const searchTerm = query.toLowerCase();
        this.filteredProducts = this.products.filter(product => 
            product.name.toLowerCase().includes(searchTerm) ||
            (product.description && product.description.toLowerCase().includes(searchTerm))
        );
        
        this.renderProducts();
    }
    
    setupModalEvents() {
        // 상품 상세 모달
        const productDetailModal = document.getElementById('productDetailModal');
        const closeBtn = productDetailModal?.querySelector('.close');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                productDetailModal.style.display = 'none';
            });
        }
        
        // 구매 모달
        const purchaseModal = document.getElementById('purchaseModal');
        const purchaseCloseBtn = purchaseModal?.querySelector('.close');
        const cancelBtn = document.getElementById('cancelBtn');
        const confirmBtn = document.getElementById('confirmBtn');
        const maxPointsBtn = document.getElementById('maxPointsBtn');
        const quantityInput = document.getElementById('quantity');
        const pointsInput = document.getElementById('pointsToUse');
        
        if (purchaseCloseBtn) {
            purchaseCloseBtn.addEventListener('click', () => this.closePurchaseModal());
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closePurchaseModal());
        }
        
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => this.confirmPurchase());
        }
        
        if (maxPointsBtn) {
            maxPointsBtn.addEventListener('click', () => this.useMaxPoints());
        }
        
        if (quantityInput) {
            quantityInput.addEventListener('input', () => this.updateTotalPrice());
        }
        
        if (pointsInput) {
            pointsInput.addEventListener('input', () => this.validatePointsInput());
        }
        
        // 모달 외부 클릭 시 닫기
        window.onclick = (event) => {
            if (event.target === productDetailModal) {
                productDetailModal.style.display = 'none';
            }
            if (event.target === purchaseModal) {
                this.closePurchaseModal();
            }
        };
    }
    
    setupMypageEvents() {
        const userBtn = document.querySelector('.user-btn');
        const mypageModal = document.getElementById('mypageModal');
        const mypageCloseBtn = mypageModal?.querySelector('.close');
        const tabButtons = mypageModal?.querySelectorAll('.tab-btn');
        const logoutBtn = mypageModal?.querySelector('.logout-btn');
        
        if (userBtn) {
            userBtn.addEventListener('click', () => {
                this.handleUserButtonClick();
            });
        }
        
        if (mypageCloseBtn) {
            mypageCloseBtn.addEventListener('click', () => {
                mypageModal.style.display = 'none';
            });
        }
        
        if (tabButtons) {
            tabButtons.forEach(tab => {
                tab.addEventListener('click', (e) => {
                    const tabName = e.target.dataset.tab;
                    this.switchMypageTab(tabName);
                });
            });
        }
        
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.logout();
            });
        }
        
        // 모달 외부 클릭 시 닫기
        window.onclick = (event) => {
            if (event.target === mypageModal) {
                mypageModal.style.display = 'none';
            }
        };
    }
    
    setupCartEvents() {
        const cartBtn = document.querySelector('.cart-btn');
        if (cartBtn) {
            cartBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.openCart();
            });
        }
    }
    
    attachProductEventListeners() {
        const productCards = document.querySelectorAll('.product-card');
        
        productCards.forEach(card => {
            card.addEventListener('click', (e) => {
                const productId = card.dataset.productId;
                this.openProductDetailModal(productId);
            });
        });
    }
    
    openProductDetailModal(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;
        
        const modal = document.getElementById('productDetailModal');
        const content = document.getElementById('productDetailContent');
        
        if (!modal || !content) return;
        
        const discountRate = product.discount_rate || 0;
        const originalPrice = product.price || 0;
        const discountedPrice = Math.round(originalPrice * (1 - discountRate / 100));
        
        content.innerHTML = `
            <div class="product-detail-header">
                <h2>${product.name}</h2>
            </div>
            <div class="product-detail-body">
                <div class="product-detail-image">
                    <img src="${product.image_url || 'images/default-product.jpg'}" alt="${product.name}" />
                </div>
                <div class="product-detail-info">
                    <p class="product-description">${product.description || ''}</p>
                    <div class="product-price">
                        ${discountRate > 0 ? `<span class="original-price">${originalPrice.toLocaleString()}원</span>` : ''}
                        <span class="current-price">${discountedPrice.toLocaleString()}원</span>
                    </div>
                    <div class="product-actions">
                        <button class="purchase-btn" onclick="eventPage.openPurchaseModal('${product.id}')">구매하기</button>
                    </div>
                </div>
            </div>
        `;
        
        modal.style.display = 'block';
    }
    
    openPurchaseModal(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;
        
        this.selectedProduct = product;
        const modal = document.getElementById('purchaseModal');
        const productInfo = document.getElementById('purchaseProductInfo');
        
        if (!modal || !productInfo) return;
        
        const discountRate = product.discount_rate || 0;
        const originalPrice = product.price || 0;
        const discountedPrice = Math.round(originalPrice * (1 - discountRate / 100));
        
        productInfo.innerHTML = `
            <div class="purchase-product-image">
                <img src="${product.image_url || 'images/default-product.jpg'}" alt="${product.name}" />
            </div>
            <div class="purchase-product-details">
                <h4>${product.name}</h4>
                <p>${product.description || ''}</p>
                <div class="purchase-price">
                    ${discountRate > 0 ? `<span class="original-price">${originalPrice.toLocaleString()}원</span>` : ''}
                    <span class="current-price">${discountedPrice.toLocaleString()}원</span>
                </div>
            </div>
        `;
        
        // 입력 필드 초기화
        document.getElementById('quantity').value = 1;
        document.getElementById('pointsToUse').value = 0;
        
        this.updateTotalPrice();
        modal.style.display = 'block';
    }
    
    closePurchaseModal() {
        const modal = document.getElementById('purchaseModal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.selectedProduct = null;
    }
    
    updateTotalPrice() {
        if (!this.selectedProduct) return;
        
        const quantity = parseInt(document.getElementById('quantity').value) || 1;
        const pointsToUse = parseInt(document.getElementById('pointsToUse').value) || 0;
        
        const discountRate = this.selectedProduct.discount_rate || 0;
        const originalPrice = this.selectedProduct.price || 0;
        const discountedPrice = Math.round(originalPrice * (1 - discountRate / 100));
        
        const totalPrice = (discountedPrice * quantity) - pointsToUse;
        const finalPrice = Math.max(0, totalPrice);
        
        document.getElementById('totalPrice').textContent = `${finalPrice.toLocaleString()}원`;
    }
    
    validatePointsInput() {
        const pointsInput = document.getElementById('pointsToUse');
        const pointsToUse = parseInt(pointsInput.value) || 0;
        const maxPoints = Math.min(this.userPoints, this.selectedProduct?.price || 0);
        
        if (pointsToUse > maxPoints) {
            pointsInput.value = maxPoints;
        }
        
        this.updateTotalPrice();
    }
    
    useMaxPoints() {
        if (!this.selectedProduct) return;
        
        const maxPoints = Math.min(this.userPoints, this.selectedProduct.price || 0);
        document.getElementById('pointsToUse').value = maxPoints;
        this.updateTotalPrice();
    }
    
    async confirmPurchase() {
        if (!this.selectedProduct) return;
        
        const quantity = parseInt(document.getElementById('quantity').value) || 1;
        const pointsToUse = parseInt(document.getElementById('pointsToUse').value) || 0;
        
        try {
            const response = await fetch('/api/shop/purchase', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    productId: this.selectedProduct.id,
                    quantity: quantity,
                    pointsToUse: pointsToUse
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                alert('구매가 완료되었습니다!');
                this.closePurchaseModal();
                await this.loadUserPoints();
                this.updateCartCount();
            } else {
                alert(data.error || '구매에 실패했습니다.');
            }
        } catch (error) {
            console.error('구매 오류:', error);
            alert('구매 중 오류가 발생했습니다.');
        }
    }
    
    handleUserButtonClick() {
        const mypageModal = document.getElementById('mypageModal');
        if (mypageModal) {
            mypageModal.style.display = 'block';
            this.updateMypageInfo();
        }
    }
    
    switchMypageTab(tabName) {
        const tabContents = document.querySelectorAll('.tab-content');
        const tabButtons = document.querySelectorAll('.tab-btn');
        
        tabContents.forEach(content => {
            content.style.display = 'none';
        });
        
        tabButtons.forEach(btn => {
            btn.classList.remove('active');
        });
        
        const targetContent = document.getElementById(`${tabName}Tab`);
        const targetButton = document.querySelector(`[data-tab="${tabName}"]`);
        
        if (targetContent) {
            targetContent.style.display = 'block';
        }
        
        if (targetButton) {
            targetButton.classList.add('active');
        }
    }
    
    updateMypageInfo() {
        // 사용자 정보 업데이트 (헤더 인증 관리자에서 가져옴)
        if (window.headerAuthManager && window.headerAuthManager.user) {
            const user = window.headerAuthManager.user;
            document.getElementById('userName').textContent = user.name || '사용자';
            document.getElementById('userEmail').textContent = user.email || '이메일';
        }
        
        document.getElementById('userPoints').textContent = this.userPoints.toLocaleString();
        document.getElementById('currentPoints').textContent = this.userPoints.toLocaleString();
    }
    
    async logout() {
        try {
            const response = await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });
            
            if (response.ok) {
                window.location.href = '/store.html';
            }
        } catch (error) {
            console.error('로그아웃 오류:', error);
        }
    }
    
    openCart() {
        window.location.href = '/cart.html';
    }
    
    updatePointsDisplay() {
        // 포인트 표시 업데이트 (필요한 경우)
    }
    
    updateCartCount() {
        // 장바구니 개수 업데이트 (필요한 경우)
        const cartCount = document.querySelector('.cart-count');
        if (cartCount) {
            cartCount.textContent = this.cart.length;
        }
    }
    
    showLoading() {
        const loadingState = document.getElementById('loadingState');
        if (loadingState) {
            loadingState.style.display = 'block';
        }
    }
    
    hideLoading() {
        const loadingState = document.getElementById('loadingState');
        if (loadingState) {
            loadingState.style.display = 'none';
        }
    }
    
    showEmptyState() {
        const emptyState = document.getElementById('emptyState');
        if (emptyState) {
            emptyState.style.display = 'block';
        }
    }
    
    hideEmptyState() {
        const emptyState = document.getElementById('emptyState');
        if (emptyState) {
            emptyState.style.display = 'none';
        }
    }
}

// 페이지 초기화
let eventPage;

document.addEventListener('DOMContentLoaded', () => {
    eventPage = new EventPage();
});

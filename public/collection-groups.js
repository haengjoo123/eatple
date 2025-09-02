/**
 * 컬렉션 그룹 페이지 JavaScript
 */

class CollectionGroupsPage {
    constructor() {
        this.currentGroup = null;
        this.products = [];
        this.filteredProducts = [];
        this.currentFilter = 'all';
        this.priceRange = { min: null, max: null };
        this.userPoints = 0;
        this.selectedProduct = null;
        
        // 그룹별 설정
        this.groupConfig = {
            best: {
                title: '베스트',
                description: '판매율 상위 20개 상품',
                filter: (products) => products // 서버에서 이미 필터링됨
            },
            new: {
                title: '신상품',
                description: '새로운 상품',
                filter: (products) => {
                    const threeDaysAgo = new Date();
                    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
                    return products.filter(p => new Date(p.created_at) > threeDaysAgo);
                }
            },
            sale: {
                title: '특가상품',
                description: '할인 상품',
                filter: (products) => products.filter(p => p.discount_rate >= 15)
            },
            event: {
                title: '이벤트',
                description: '이벤트 상품',
                filter: (products) => products.filter(p => p.is_event || p.event_tag)
            }
        };
        
        this.init();
    }
    
    async init() {
        // URL에서 그룹 파라미터 가져오기
        const urlParams = new URLSearchParams(window.location.search);
        this.currentGroup = urlParams.get('group') || 'best';
        
        // 유효한 그룹인지 확인
        if (!this.groupConfig[this.currentGroup]) {
            this.currentGroup = 'best';
        }
        
        // DOM이 완전히 로드될 때까지 대기
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve);
            });
        }
        
        // 네비게이션 활성 상태 업데이트
        this.updateActiveNav();

        // 즉시 그룹 정보 로드 (가장 빠르게 표시)
        this.loadGroupInfo();
        
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
        
        // 모바일 하단 네비게이션 초기화
        this.initMobileNavigation();
        
        // 모바일 필터 기능 초기화
        this.initMobileFilters();
        
        // PC용 필터 기능 초기화 (category.html과 동일)
        this.initPCFilters();

        // 헤더 장바구니 버튼 이벤트 설정
        this.setupCartButtonEvents();
    }

    // 현재 그룹에 맞게 헤더 네비게이션 active 처리
    updateActiveNav() {
        try {
            const navItems = document.querySelectorAll('.nav-item');
            const links = document.querySelectorAll('.nav-item .nav-link');
            const groupToHrefPart = {
                best: 'group=best',
                new: 'group=new',
                sale: 'group=sale',
                event: 'event.html'
            };

            // 모든 active 제거
            navItems.forEach(i => i.classList.remove('active'));
            links.forEach(a => a.classList.remove('active'));

            // 해당 그룹과 일치하는 링크 찾기
            links.forEach(link => {
                const href = link.getAttribute('href') || '';
                const part = groupToHrefPart[this.currentGroup];
                if (!part) return;
                if (href.includes(part)) {
                    const li = link.closest('.nav-item');
                    if (li) li.classList.add('active');
                    link.classList.add('active');
                }
            });
        } catch (e) {
            console.warn('네비게이션 활성화 처리 오류:', e);
        }
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
                this.userPoints = data.points || 0;
                this.updatePointsDisplay();
            }
        } catch (error) {
            console.error('포인트 로드 오류:', error);
            this.userPoints = 0;
        }
    }
    
    loadGroupInfo() {
        const config = this.groupConfig[this.currentGroup];
        if (!config) return;
        
        // 페이지 제목 업데이트
        document.title = `${config.title} - 잇플 스토어`;
        
        // 브레드크럼 업데이트
        const breadcrumb = document.getElementById('groupBreadcrumb');
        if (breadcrumb) {
            breadcrumb.textContent = config.title;
        }
        
        // 컬렉션 제목 업데이트
        const title = document.querySelector('.collection-title');
        if (title) {
            title.textContent = config.title;
        }
        

    }
    

    
    async loadProducts() {
        try {
            this.showLoading(true);
            
            // 현재 그룹에 따라 API 파라미터 설정
            const params = new URLSearchParams();
            if (this.currentGroup === 'new' || this.currentGroup === 'best') {
                params.append('group', this.currentGroup);
            }
            
            const response = await fetch(`/api/shop/products?${params.toString()}`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.products = data.data || [];
                // 이미지 필드 정규화
                this.products.forEach(product => {
                    // image_url이 없으면 image 필드 사용
                    if (!product.image_url && product.image) {
                        product.image_url = product.image;
                    }
                });
                this.filterProductsByGroup();
                this.renderProducts();
            } else {
                console.error('상품 로드 실패:', data.message);
                this.showEmptyState();
            }
        } catch (error) {
            console.error('상품 로드 오류:', error);
            this.showEmptyState();
        } finally {
            this.showLoading(false);
        }
    }
    
    filterProductsByGroup() {
        const config = this.groupConfig[this.currentGroup];
        if (!config) {
            this.filteredProducts = this.products;
            return;
        }
        
        // 신상품과 베스트 그룹의 경우 서버에서 이미 필터링된 데이터를 받았으므로
        // 클라이언트 측 필터링을 건너뜀
        if (this.currentGroup === 'new' || this.currentGroup === 'best') {
            this.filteredProducts = this.products;
        } else {
            // 그룹별 필터 적용
            this.filteredProducts = config.filter(this.products);
        }
        
        // 상품 수 업데이트
        this.updateProductCount();
    }
    
    updateProductCount() {
        const countElement = document.getElementById('productCount');
        if (countElement) {
            countElement.textContent = this.filteredProducts.length;
        }
    }
    
    renderProducts() {
        const grid = document.getElementById('productsGrid');
        if (!grid) return;
        
        if (this.filteredProducts.length === 0) {
            this.showEmptyState();
            return;
        }
        
        grid.innerHTML = '';
        
        this.filteredProducts.forEach(product => {
            const productCard = this.createProductCard(product);
            grid.appendChild(productCard);
        });
        
        this.hideEmptyState();
    }
    
    createProductCard(product) {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.style.cursor = 'pointer';

        // 제품 카드 클릭 시 상세 페이지로 이동
        card.addEventListener('click', (e) => {
            // 버튼 클릭 시에는 상세 페이지로 이동하지 않음
            if (e.target.closest('.cart-add-button')) {
                return;
            }
            this.goToProductDetail(product.id);
        });

        // 할인율 계산
        const discount = product.originalPrice && product.originalPrice > product.price
            ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
            : 0;

        card.innerHTML = `
            <div class="product-image-container">
                ${this.createImageHtml(product.image_url, product.name, product.category)}
            </div>
            <div class="product-cart-section">
                <div class="product-actions">
                    <button class="cart-add-button" onclick="event.stopPropagation(); collectionGroupsPage.openProductDetailModal('${product.id}')" title="상품 상세보기">
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
                <p class="product-summary">${this.escapeHtml(product.summary || product.description || '')}</p>
                <div class="product-meta">
                    <div class="product-price">
                        ${product.originalPrice && product.originalPrice > product.price
                            ? `<span class="original-price">${product.originalPrice.toLocaleString()}원</span>`
                            : ''}
                        <div class="price-row">
                            ${discount > 0 ? `<span class="discount-rate">${discount}%</span>` : ''}
                            <span class="current-price">${product.price.toLocaleString()}원</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 담기 버튼 이벤트 리스너 수정
        const cartBtn = card.querySelector('.cart-add-button');
        cartBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openProductDetailModal(product.id);
        });

        return card;
    }
    
    setupEventListeners() {
        // 필터 버튼 이벤트
        const filterBtns = document.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.applyFilter(btn.dataset.filter);
            });
        });
        
        // 가격 필터 이벤트
        const applyPriceBtn = document.getElementById('applyPriceFilter');
        if (applyPriceBtn) {
            applyPriceBtn.addEventListener('click', () => this.applyPriceFilter());
        }
        
        // 구매 모달 이벤트
        this.setupPurchaseModal();
        
        // 상품 상세 모달 이벤트
        this.setupProductDetailModal();
    }

    // 헤더의 장바구니 버튼 클릭 시 cart.html로 이동
    setupCartButtonEvents() {
        try {
            const cartButtons = document.querySelectorAll('.cart-btn');
            cartButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    window.location.href = 'cart.html';
                });
            });
        } catch (error) {
            console.warn('장바구니 버튼 이벤트 설정 오류:', error);
        }
    }
    

    
    applyFilter(filter) {
        this.currentFilter = filter;
        
        // 필터 버튼 활성화 상태 업데이트
        const filterBtns = document.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
        
        // 상품 정렬
        this.sortProducts();
    }
    
    sortProducts(sortType = null) {
        // 정렬 타입이 지정되지 않은 경우 현재 필터 사용
        const sortToApply = sortType || this.currentFilter;
        
        switch (sortToApply) {
            case 'recommend':
            case '추천순':
                this.filteredProducts.sort((a, b) => (b.recommendation_score || 0) - (a.recommendation_score || 0));
                break;
            case 'new':
            case '신상품':
                this.filteredProducts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                break;
            case 'popular':
            case '판매순':
                this.filteredProducts.sort((a, b) => (b.sales_count || 0) - (a.sales_count || 0));
                break;
            case 'discount':
            case '혜택순':
                this.filteredProducts.sort((a, b) => (b.discount_rate || 0) - (a.discount_rate || 0));
                break;
            case 'price-low':
            case '낮은 가격순':
                this.filteredProducts.sort((a, b) => a.price - b.price);
                break;
            case 'price-high':
                this.filteredProducts.sort((a, b) => b.price - a.price);
                break;
            default:
                // 기본 정렬 (그룹별 필터 적용)
                this.filterProductsByGroup();
        }
        
        // 정렬 후 상품 렌더링
        this.renderProducts();
    }


    
    applyPriceFilter() {
        const minPrice = document.getElementById('minPrice').value;
        const maxPrice = document.getElementById('maxPrice').value;
        
        this.priceRange = {
            min: minPrice ? parseInt(minPrice) : null,
            max: maxPrice ? parseInt(maxPrice) : null
        };
        
        // 가격 필터 적용
        this.filterProductsByPrice();
        this.renderProducts();
    }
    
    filterProductsByPrice() {
        if (!this.priceRange.min && !this.priceRange.max) {
            this.filterProductsByGroup();
            return;
        }
        
        this.filteredProducts = this.filteredProducts.filter(product => {
            const price = product.price;
            const min = this.priceRange.min;
            const max = this.priceRange.max;
            
            if (min && price < min) return false;
            if (max && price > max) return false;
            return true;
        });
        
        this.updateProductCount();
    }
    
    showLoading(show) {
        const loadingState = document.getElementById('loadingState');
        const productsGrid = document.getElementById('productsGrid');
        
        if (loadingState) {
            loadingState.style.display = show ? 'flex' : 'none';
        }
        
        if (productsGrid) {
            productsGrid.style.display = show ? 'none' : 'grid';
        }
    }
    
    showEmptyState() {
        const emptyState = document.getElementById('emptyState');
        const productsGrid = document.getElementById('productsGrid');
        
        if (emptyState) {
            emptyState.style.display = 'flex';
        }
        
        if (productsGrid) {
            productsGrid.style.display = 'none';
        }
    }
    
    hideEmptyState() {
        const emptyState = document.getElementById('emptyState');
        if (emptyState) {
            emptyState.style.display = 'none';
        }
    }
    
    updateCartCount() {
        // 장바구니 개수 업데이트 로직
        const cartCounts = document.querySelectorAll('.cart-count');
        cartCounts.forEach(count => {
            count.textContent = '0'; // 실제 장바구니 개수로 업데이트 필요
        });
    }
    
    updatePointsDisplay() {
        const availablePoints = document.getElementById('availablePoints');
        const pointsInput = document.getElementById('pointsInput');
        const maxPointsBtn = document.getElementById('maxPointsBtn');
        
        if (availablePoints) {
            availablePoints.textContent = this.userPoints.toLocaleString();
        }
        
        if (pointsInput) {
            pointsInput.max = this.userPoints;
        }
        
        if (maxPointsBtn) {
            maxPointsBtn.disabled = this.userPoints <= 0;
        }
    }
    
    // 구매 모달 관련 메서드들
    setupPurchaseModal() {
        const modal = document.getElementById('purchaseModal');
        const closeBtn = document.getElementById('modalClose');
        const cancelBtn = document.getElementById('cancelBtn');
        const confirmBtn = document.getElementById('confirmBtn');
        const maxPointsBtn = document.getElementById('maxPointsBtn');
        const pointsInput = document.getElementById('pointsInput');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closePurchaseModal());
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
        
        if (pointsInput) {
            pointsInput.addEventListener('input', () => this.validatePointsInput());
        }
        
        // 모달 외부 클릭 시 닫기
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closePurchaseModal();
                }
            });
        }
    }
    
    // 상품 상세 모달 관련 메서드들
    setupProductDetailModal() {
        const productDetailModal = document.getElementById('productDetailModal');
        const productDetailClose = document.getElementById('productDetailClose');
        const productDetailCancel = document.getElementById('productDetailCancel');
        const addToCartBtn = document.getElementById('addToCartBtn');
        const decreaseQty = document.getElementById('decreaseQty');
        const increaseQty = document.getElementById('increaseQty');
        const quantityInput = document.getElementById('quantityInput');

        // 모달 닫기
        if (productDetailClose) {
            productDetailClose.onclick = () => {
                productDetailModal.style.display = 'none';
            };
        }
        if (productDetailCancel) {
            productDetailCancel.onclick = () => {
                productDetailModal.style.display = 'none';
            };
        }

        // 수량 조절
        if (decreaseQty) {
            decreaseQty.onclick = () => {
                const currentQty = parseInt(quantityInput.value);
                if (currentQty > 1) {
                    quantityInput.value = currentQty - 1;
                    this.updateTotalPrice();
                }
            };
        }

        if (increaseQty) {
            increaseQty.onclick = () => {
                const currentQty = parseInt(quantityInput.value);
                if (currentQty < 10) {
                    quantityInput.value = currentQty + 1;
                    this.updateTotalPrice();
                }
            };
        }

        if (quantityInput) {
            quantityInput.addEventListener('input', () => {
                let qty = parseInt(quantityInput.value);
                if (isNaN(qty) || qty < 1) qty = 1;
                if (qty > 10) qty = 10;
                quantityInput.value = qty;
                this.updateTotalPrice();
            });
        }

        // 장바구니 담기
        if (addToCartBtn) {
            addToCartBtn.onclick = () => {
                this.addToCartFromModal();
            };
        }
        
        // 모달 외부 클릭 시 닫기
        if (productDetailModal) {
            productDetailModal.addEventListener('click', (e) => {
                if (e.target === productDetailModal) {
                    productDetailModal.style.display = 'none';
                }
            });
        }
    }
    
    // 상품 상세 모달 열기
    openProductDetailModal(productId) {
        const product = this.filteredProducts.find(p => p.id === productId);

        if (!product) {
            console.error('상품을 찾을 수 없습니다:', productId);
            return;
        }

        this.selectedProduct = product;

        // 디버깅용: 상품 이미지 정보 출력
        console.log('상품 이미지 정보:', {
            id: product.id,
            name: product.name,
            image_url: product.image_url,
            image: product.image
        });

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

        // 이미지 설정
        const imageContainer = document.getElementById('productDetailImageContainer');
        const createImageElement = (src, alt) => {
            console.log('이미지 URL 생성:', src); // 디버깅용 로그
            const img = document.createElement('img');
            img.src = src;
            img.alt = alt;
            img.onerror = () => {
                console.log('이미지 로드 실패:', src); // 디버깅용 로그
                img.style.display = 'none';
                imageContainer.innerHTML = '<div class="product-image-placeholder">📦</div>';
            };
            img.onload = () => {
                console.log('이미지 로드 성공:', src); // 디버깅용 로그
            };
            return img;
        };

        // 이미지 URL 처리 함수
        const processImageUrl = (imageData) => {
            if (!imageData) return null;
            
            const imageStr = String(imageData).trim();
            
            // JSON 배열 형태인지 확인
            if (imageStr.startsWith('[') && imageStr.endsWith(']')) {
                try {
                    const images = JSON.parse(imageStr);
                    if (Array.isArray(images) && images.length > 0) {
                        // 첫 번째 이미지 사용
                        const firstImage = String(images[0]).trim();
                        console.log('JSON 배열에서 추출된 이미지:', firstImage);
                        return firstImage;
                    }
                } catch (e) {
                    console.warn('JSON 파싱 실패:', imageStr, e);
                }
                return null;
            }
            
            // 단일 URL인 경우
            return imageStr;
        };
        
        // 이미지 URL 처리
        let imageUrl = null;
        
        if (product.image_url) {
            imageUrl = processImageUrl(product.image_url);
        } else if (product.image) {
            imageUrl = processImageUrl(product.image);
        }
        
        // 이미지 설정
        if (imageUrl) {
            // 절대 URL인 경우 그대로 사용
            if (imageUrl.startsWith('http')) {
                imageContainer.innerHTML = '';
                imageContainer.appendChild(createImageElement(imageUrl, product.name));
            } 
            // 상대 경로인 경우 /uploads/ 경로로 처리
            else if (imageUrl.startsWith('/uploads/')) {
                imageContainer.innerHTML = '';
                imageContainer.appendChild(createImageElement(imageUrl, product.name));
            }
            // 파일명만 있는 경우 /uploads/products/ 경로 추가
            else {
                imageContainer.innerHTML = '';
                imageContainer.appendChild(createImageElement(`/uploads/products/${imageUrl}`, product.name));
            }
        } else {
            imageContainer.innerHTML = '<div class="product-image-placeholder">📦</div>';
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

        // 장바구니에 추가 로직 (cart.js와 동일한 키와 구조 사용)
        let cart = JSON.parse(localStorage.getItem('eatple_cart') || '[]');
        const existingItem = cart.find(item => item.id === this.selectedProduct.id);
        
        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            cart.push({
                id: this.selectedProduct.id,
                name: this.selectedProduct.name,
                price: this.selectedProduct.price,
                originalPrice: this.selectedProduct.originalPrice,
                image: this.selectedProduct.image_url || this.selectedProduct.image,
                brand: this.selectedProduct.brand || '', // 브랜드 정보 추가
                shippingFee: this.selectedProduct.shipping_fee || 3000, // 배송비 정보 추가
                quantity: quantity,
                selected: true // cart.js에서 사용하는 필드
            });
        }
        
        localStorage.setItem('eatple_cart', JSON.stringify(cart));
        this.updateCartCount();
        
        // 성공 메시지 표시
        alert('장바구니에 추가되었습니다!');

        // 모달 닫기
        document.getElementById('productDetailModal').style.display = 'none';
    }
    
    openPurchaseModal(productOrId) {
        let product;
        
        // product ID가 전달된 경우 해당 상품을 찾기
        if (typeof productOrId === 'string') {
            product = this.filteredProducts.find(p => p.id === productOrId);
        } else {
            product = productOrId;
        }
        
        if (!product) {
            console.error('상품을 찾을 수 없습니다:', productOrId);
            return;
        }
        
        this.selectedProduct = product;
        const modal = document.getElementById('purchaseModal');
        
        if (modal) {
            this.updatePurchaseSummary();
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    }
    
    closePurchaseModal() {
        const modal = document.getElementById('purchaseModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
        
        this.selectedProduct = null;
        this.resetPurchaseForm();
    }
    
    updatePurchaseSummary() {
        if (!this.selectedProduct) return;
        
        const summary = document.getElementById('purchaseSummary');
        if (!summary) return;
        
        const finalPrice = this.selectedProduct.discount_rate > 0 
            ? Math.floor(this.selectedProduct.price * (1 - this.selectedProduct.discount_rate / 100))
            : this.selectedProduct.price;
        
        summary.innerHTML = `
            <div class="product-summary">
                <img src="${this.selectedProduct.image_url || 'images/product-placeholder.jpg'}" alt="${this.selectedProduct.name}">
                <div class="product-details">
                    <h3>${this.selectedProduct.name}</h3>
                    <p>${this.selectedProduct.description || ''}</p>
                    <div class="price-info">
                        <span class="final-price">${finalPrice.toLocaleString()}원</span>
                        ${this.selectedProduct.discount_rate > 0 
                            ? `<span class="original-price">${this.selectedProduct.price.toLocaleString()}원</span>` 
                            : ''}
                    </div>
                </div>
            </div>
        `;
    }
    
    resetPurchaseForm() {
        const pointsInput = document.getElementById('pointsInput');
        if (pointsInput) {
            pointsInput.value = '';
        }
        
        const errorMessage = document.getElementById('errorMessage');
        const successMessage = document.getElementById('successMessage');
        
        if (errorMessage) errorMessage.textContent = '';
        if (successMessage) successMessage.textContent = '';
    }
    
    useMaxPoints() {
        const pointsInput = document.getElementById('pointsInput');
        if (pointsInput) {
            pointsInput.value = this.userPoints;
        }
    }
    
    validatePointsInput() {
        const pointsInput = document.getElementById('pointsInput');
        if (!pointsInput) return;
        
        let value = parseInt(pointsInput.value) || 0;
        
        if (value > this.userPoints) {
            value = this.userPoints;
        }
        
        if (value < 0) {
            value = 0;
        }
        
        pointsInput.value = value;
    }
    
    async confirmPurchase() {
        if (!this.selectedProduct) return;
        
        const pointsInput = document.getElementById('pointsInput');
        const usedPoints = parseInt(pointsInput?.value) || 0;
        
        const confirmBtn = document.getElementById('confirmBtn');
        const loadingSpinner = document.getElementById('loadingSpinner');
        
        if (confirmBtn) confirmBtn.disabled = true;
        if (loadingSpinner) loadingSpinner.style.display = 'flex';
        
        try {
            const response = await fetch('/api/shop/purchase', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    productId: this.selectedProduct.id,
                    usedPoints: usedPoints
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showSuccessMessage('구매가 완료되었습니다!');
                setTimeout(() => {
                    this.closePurchaseModal();
                    this.updateCartCount();
                    this.loadUserPoints();
                }, 2000);
            } else {
                this.showErrorMessage(data.message || '구매 처리 중 오류가 발생했습니다.');
            }
        } catch (error) {
            console.error('구매 오류:', error);
            this.showErrorMessage('구매 처리 중 오류가 발생했습니다.');
        } finally {
            if (confirmBtn) confirmBtn.disabled = false;
            if (loadingSpinner) loadingSpinner.style.display = 'none';
        }
    }
    
    showSuccessMessage(message) {
        const successMessage = document.getElementById('successMessage');
        if (successMessage) {
            successMessage.textContent = message;
            successMessage.style.display = 'block';
        }
    }
    
    showErrorMessage(message) {
        const errorMessage = document.getElementById('errorMessage');
        if (errorMessage) {
            errorMessage.textContent = message;
            errorMessage.style.display = 'block';
        }
    }
    
    // HTML 이스케이프 메서드
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // 상품 상세 페이지로 이동
    goToProductDetail(productId) {
        window.location.href = `product-detail.html?id=${productId}`;
    }
    
    // 안전한 이미지 HTML 생성 함수
    createImageHtml(imageUrl, productName, category = null) {
        // 이미지 URL 처리 함수
        const processImageUrl = (imageData) => {
            if (!imageData) return null;
            
            const imageStr = String(imageData).trim();
            
            // JSON 배열 형태인지 확인
            if (imageStr.startsWith('[') && imageStr.endsWith(']')) {
                try {
                    const images = JSON.parse(imageStr);
                    if (Array.isArray(images) && images.length > 0) {
                        // 첫 번째 이미지 사용
                        const firstImage = String(images[0]).trim();
                        return firstImage;
                    }
                } catch (e) {
                    console.warn('JSON 파싱 실패:', imageStr, e);
                }
                return null;
            }
            
            // 단일 URL인 경우
            return imageStr;
        };

        const validUrl = processImageUrl(imageUrl);

        if (!validUrl) {
            // 카테고리가 있으면 해당 이모지 사용, 없으면 기본 박스 이모지
            const emoji = category ? this.getDefaultEmoji(category) : "📦";
            return `<div class="product-image-placeholder">${emoji}</div>`;
        }

        // URL 안전성 검사
        const safeUrl = this.escapeHtml(validUrl);
        const safeName = this.escapeHtml(productName);

        return (
            `<img src="${safeUrl}" alt="${safeName}" class="product-image" ` +
            `style="width: 100%; height: 100%; object-fit: cover; border-radius: 5px;" ` +
            `onerror="this.style.display='none'; this.parentElement.classList.add('image-error'); this.nextElementSibling.style.display='flex';">` +
            `<div class="product-image-placeholder" style="display: none; width: 100%; height: 100%; align-items: center; justify-content: center; font-size: 2rem; color: #999; background: #f5f5f5; border-radius: 5px;">${
                category ? this.getDefaultEmoji(category) : "📦"
            }</div>`
        );
    }

    // 유효한 이미지 URL 추출 (기존 메서드 - 현재는 사용하지 않음)
    extractValidImageUrl(imageData) {
        if (!imageData) {
            return null;
        }

        const imageStr = String(imageData).trim();

        if (
            !imageStr ||
            imageStr === "[]" ||
            imageStr === "null" ||
            imageStr === "undefined"
        ) {
            return null;
        }

        // JSON 배열 형태인지 확인
        if (imageStr.startsWith("[") && imageStr.endsWith("]")) {
            try {
                const images = JSON.parse(imageStr);
                if (Array.isArray(images) && images.length > 0) {
                    const firstImage = String(images[0]).trim();
                    const isValid = this.isValidImageUrl(firstImage);
                    return isValid ? firstImage : null;
                }
            } catch (e) {
                console.warn("JSON 파싱 실패:", imageStr, e);
            }
            return null;
        }

        // 단일 URL인 경우
        const isValid = this.isValidImageUrl(imageStr);
        return isValid ? imageStr : null;
    }

    // URL 유효성 검사
    isValidImageUrl(url) {
        if (!url || typeof url !== "string") {
            return false;
        }

        const trimmedUrl = url.trim();

        if (
            !trimmedUrl ||
            trimmedUrl === "[]" ||
            trimmedUrl === "null" ||
            trimmedUrl === "undefined"
        ) {
            return false;
        }

        return (
            trimmedUrl.startsWith("http://") ||
            trimmedUrl.startsWith("https://") ||
            trimmedUrl.startsWith("/") ||
            trimmedUrl.startsWith("./") ||
            trimmedUrl.startsWith("../") ||
            trimmedUrl.startsWith("data:image/")
        );
    }

    // 카테고리별 기본 이모지 반환
    getDefaultEmoji(category) {
        const emojiMap = {
            'health_functional_food': '💊',
            'protein_food': '🥩',
            'healthy_snack': '🍎',
            'healthy_juice': '🥤',
            'home_meal_replacement': '🍱',
            'side_dish': '🥗',
            'salad': '🥬',
            'fruit': '🍊',
            'meat': '🥩',
            'seafood': '🐟'
        };
        return emojiMap[category] || '📦';
    }

    // 모바일 하단 네비게이션 초기화
    initMobileNavigation() {
        // 햄버거 메뉴 버튼 이벤트
        const menuBtn = document.querySelector('.store-footer-nav-menu-btn');
        const hamburgerModal = document.getElementById('storeHamburgerModal');
        
        if (menuBtn && hamburgerModal) {
            menuBtn.addEventListener('click', () => {
                hamburgerModal.classList.toggle('active');
            });
            
            // 모달 외부 클릭 시 닫기
            hamburgerModal.addEventListener('click', (e) => {
                if (e.target === hamburgerModal) {
                    hamburgerModal.classList.remove('active');
                }
            });
        }

        // 검색 버튼 이벤트
        const searchBtn = document.querySelector('.store-footer-nav-search-btn');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                // 헤더의 검색창에 포커스
                const searchInput = document.querySelector('.search-input');
                if (searchInput) {
                    searchInput.focus();
                }
            });
        }

        // 마이페이지 버튼 이벤트
        const myBtn = document.querySelector('.store-footer-nav-my-btn');
        if (myBtn) {
            myBtn.addEventListener('click', () => {
                // 로그인 상태 확인
                if (window.headerAuthManager && window.headerAuthManager.isLoggedIn()) {
                    window.location.href = 'mypage.html';
                } else {
                    window.location.href = 'login.html';
                }
            });
        }

        // 카테고리 아이템 클릭 이벤트
        const categoryItems = document.querySelectorAll('.category-item');
        const subCategoryGroups = document.querySelectorAll('.sub-category-group');
        
        categoryItems.forEach(item => {
            item.addEventListener('click', () => {
                const category = item.dataset.category;
                
                // 활성 카테고리 변경
                categoryItems.forEach(cat => cat.classList.remove('active'));
                item.classList.add('active');
                
                // 서브카테고리 표시
                subCategoryGroups.forEach(group => {
                    group.classList.remove('active');
                    if (group.dataset.category === category) {
                        group.classList.add('active');
                    }
                });
            });
        });

        // 서브카테고리 헤더 클릭 이벤트 (접기/펼치기)
        const subCategoryHeaders = document.querySelectorAll('.sub-category-header');
        subCategoryHeaders.forEach(header => {
            header.addEventListener('click', () => {
                const group = header.closest('.sub-category-group');
                const list = group.querySelector('.sub-category-list');
                const arrow = header.querySelector('svg');
                
                if (list.style.display === 'none') {
                    list.style.display = 'block';
                    arrow.style.transform = 'rotate(0deg)';
                } else {
                    list.style.display = 'none';
                    arrow.style.transform = 'rotate(-90deg)';
                }
            });
        });
    }

    // 모바일 필터 기능 초기화
    initMobileFilters() {
        const sortBtn = document.getElementById('sortBtn');
        const sortDropdownContainer = document.querySelector('.sort-dropdown'); // 부모 컨테이너
        const sortDropdownMenu = document.getElementById('sortDropdown'); // 메뉴 요소
        const sortOptions = document.querySelectorAll('.sort-option');
        const filterToggleBtn = document.getElementById('filterToggleBtn');
        const filterExpanded = document.getElementById('filterExpanded');
        const sortText = document.querySelector('.sort-text');

        // 정렬 드롭다운 토글
        if (sortBtn && sortDropdownContainer) {
            sortBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                sortDropdownContainer.classList.toggle('active'); // 부모 컨테이너에 active 클래스 적용
            });
        }

        // 정렬 옵션 선택
        sortOptions.forEach(option => {
            option.addEventListener('click', () => {
                const sortValue = option.dataset.sort;
                sortText.textContent = sortValue;
                sortDropdownContainer.classList.remove('active'); // 부모 컨테이너에서 active 클래스 제거
                
                // 정렬 로직 실행
                this.applySort(sortValue);
            });
        });

        // 필터 토글 버튼
        if (filterToggleBtn && filterExpanded) {
            filterToggleBtn.addEventListener('click', () => {
                filterExpanded.style.display = filterExpanded.style.display === 'none' ? 'block' : 'none';
            });
        }

        // 드롭다운 외부 클릭 시 닫기
        document.addEventListener('click', (e) => {
            if (sortDropdownContainer && sortDropdownContainer.classList.contains('active')) {
                if (!sortDropdownContainer.contains(e.target)) {
                    sortDropdownContainer.classList.remove('active');
                }
            }
        });
    }

    // PC용 필터 기능 초기화 (category.html과 동일)
    initPCFilters() {
        // PC용 필터 버튼 이벤트 (category.html과 동일)
        const pcFilterBtns = document.querySelectorAll('.filter-options .filter-btn');
        pcFilterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // 활성 상태 업데이트
                pcFilterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // 필터 적용 (category.html과 동일한 방식)
                const filterType = btn.dataset.filter;
                this.applyFilter(filterType);
            });
        });

        // PC용 가격 필터 적용 버튼 (category.html과 동일)
        const applyPriceFilter = document.getElementById('applyPriceFilter');
        if (applyPriceFilter) {
            applyPriceFilter.addEventListener('click', () => {
                this.applyPriceFilter();
            });
        }

        // PC용 가격 입력 필드 엔터 키 이벤트 (category.html과 동일)
        const minPrice = document.getElementById('minPrice');
        const maxPrice = document.getElementById('maxPrice');
        
        if (minPrice) {
            minPrice.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.applyPriceFilter();
                }
            });
        }
        
        if (maxPrice) {
            maxPrice.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.applyPriceFilter();
                }
            });
        }
    }

    // PC용 필터 적용 (category.html과 동일)
    applyFilter(filterType) {
        console.log('필터 적용:', filterType);
        this.currentFilter = filterType;
        this.sortProducts();
        this.renderProducts();
    }

    // 정렬 적용
    applySort(sortType) {
        // 기존 정렬 로직을 여기에 구현
        console.log('정렬 적용:', sortType);
        
        // 필터 버튼 상태 업데이트
        const filterBtns = document.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.filter === sortType) {
                btn.classList.add('active');
            }
        });
        
        // 상품 목록 다시 로드
        this.loadProducts();
    }
}

// 페이지 초기화
let collectionGroupsPage;
document.addEventListener('DOMContentLoaded', () => {
    collectionGroupsPage = new CollectionGroupsPage();
});

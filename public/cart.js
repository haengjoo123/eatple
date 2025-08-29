// 장바구니 관리 클래스
class CartManager {
    constructor() {
        this.cartItems = this.loadCartFromStorage();
        this.isLoggedIn = false;
        this.user = null;
        this.availablePoints = 0;
        this.usedPoints = 0;
        this.init();
    }

    async init() {
        await this.checkAuthStatus();
        await this.loadUserPoints();
        this.renderCartItems();
        this.updateCartSummary();
        this.bindEvents();
        this.updateCartCount();
        this.initPointsSection();
    }

    async checkAuthStatus() {
        try {
            const response = await fetch('/api/auth/me', {
                credentials: 'include'
            });
            const data = await response.json();
            
            if (data.loggedIn && data.user) {
                this.isLoggedIn = true;
                this.user = data.user;
                console.log('로그인 상태:', this.user);
            } else {
                this.isLoggedIn = false;
                this.user = null;
                console.log('비로그인 상태');
            }
        } catch (error) {
            console.error('인증 상태 확인 오류:', error);
            this.isLoggedIn = false;
            this.user = null;
        }
    }

    // 사용자 포인트 정보 로드
    async loadUserPoints() {
        if (!this.isLoggedIn || !this.user) {
            this.availablePoints = 0;
            return;
        }

        try {
            const response = await fetch('/api/points/balance', {
                credentials: 'include'
            });
            const data = await response.json();
            
            if (data.success) {
                this.availablePoints = data.balance || 0;
                console.log('포인트 로드 완료:', this.availablePoints);
            } else {
                this.availablePoints = 0;
                console.log('포인트 로드 실패:', data);
            }
        } catch (error) {
            console.error('포인트 정보 로드 오류:', error);
            this.availablePoints = 0;
        }
    }

    // 사용자별 "항상 전액사용" 설정 저장
    saveAlwaysUseAllPointsSetting(enabled) {
        if (!this.isLoggedIn || !this.user) return;
        
        const userSettingsKey = `alwaysUseAllPoints_${this.user.id}`;
        localStorage.setItem(userSettingsKey, enabled.toString());
        console.log('항상 전액사용 설정 저장:', enabled);
    }

    // 사용자별 "항상 전액사용" 설정 로드
    loadAlwaysUseAllPointsSetting() {
        if (!this.isLoggedIn || !this.user) return false;
        
        const userSettingsKey = `alwaysUseAllPoints_${this.user.id}`;
        const savedSetting = localStorage.getItem(userSettingsKey);
        return savedSetting === 'true';
    }

    // 로컬 스토리지에서 장바구니 데이터 로드
    loadCartFromStorage() {
        try {
            const cartData = localStorage.getItem('eatple_cart');
            return cartData ? JSON.parse(cartData) : [];
        } catch (error) {
            console.error('장바구니 데이터 로드 실패:', error);
            return [];
        }
    }

    // 로컬 스토리지에 장바구니 데이터 저장
    saveCartToStorage() {
        try {
            localStorage.setItem('eatple_cart', JSON.stringify(this.cartItems));
        } catch (error) {
            console.error('장바구니 데이터 저장 실패:', error);
        }
    }

    // 이벤트 바인딩
    bindEvents() {
        // 헤더 유저 버튼 클릭 이벤트 바인딩
        const userButtons = document.querySelectorAll('.user-btn');
        if (userButtons && userButtons.length > 0) {
            userButtons.forEach((btn) => {
                btn.addEventListener('click', () => this.handleUserButtonClick());
            });
        }

        // 전체 선택 체크박스
        const selectAllCheckbox = document.getElementById('selectAll');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => {
                this.toggleSelectAll(e.target.checked);
            });
        }

        // 선택 삭제 버튼
        const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
        if (deleteSelectedBtn) {
            deleteSelectedBtn.addEventListener('click', () => {
                this.deleteSelectedItems();
            });
        }

        // 주문하기 버튼
        const orderBtn = document.getElementById('orderBtn');
        if (orderBtn) {
            orderBtn.addEventListener('click', () => {
                this.proceedToOrder();
            });
        }

        // 포인트 입력 필드
        const pointsInput = document.getElementById('pointsInput');
        if (pointsInput) {
            pointsInput.addEventListener('input', (e) => {
                this.updatePointsUsage(parseInt(e.target.value) || 0);
            });
        }

        // 전액사용 버튼
        const useAllPointsBtn = document.getElementById('useAllPointsBtn');
        if (useAllPointsBtn) {
            useAllPointsBtn.addEventListener('click', () => {
                this.useAllPoints();
            });
        }

        // 항상 전액사용 체크박스
        const alwaysUseAllPoints = document.getElementById('alwaysUseAllPoints');
        if (alwaysUseAllPoints) {
            alwaysUseAllPoints.addEventListener('change', (e) => {
                this.saveAlwaysUseAllPointsSetting(e.target.checked);
                if (e.target.checked) {
                    this.useAllPoints();
                }
            });
        }
    }

    // 유저 버튼 클릭 처리: 로그인 시 마이페이지 모달 오픈, 비로그인 시 로그인 페이지로 이동
    async handleUserButtonClick() {
        try {
            const response = await fetch('/api/auth/me', { credentials: 'include' });
            const data = await response.json();

            if (data && data.loggedIn) {
                this.openMypage();
                return;
            }

            // 비로그인: 로그인 페이지로 이동 (이후 복귀를 위해 현재 URL 저장)
            sessionStorage.setItem('returnUrl', window.location.href);
            window.location.href = 'login.html';
        } catch (error) {
            console.error('유저 버튼 처리 중 오류:', error);
            sessionStorage.setItem('returnUrl', window.location.href);
            window.location.href = 'login.html';
        }
    }

    // 마이페이지 모달 오픈 및 데이터 초기 로드
    async openMypage() {
        const modal = document.getElementById('mypageModal');
        if (!modal) return;
        modal.style.display = 'block';

        // 기본 탭 활성화 후 데이터 로드
        this.switchMypageTab('orders');
        await this.loadMypageData();
    }

    // 마이페이지 탭 전환
    switchMypageTab(tabName) {
        document.querySelectorAll('.mypage-tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
        const activeContent = document.getElementById(`${tabName}-tab`);
        if (activeTab) activeTab.classList.add('active');
        if (activeContent) activeContent.classList.add('active');

        switch (tabName) {
            case 'orders':
                this.loadOrders();
                break;
            case 'wishlist':
                this.loadWishlist();
                break;
            case 'reviews':
                this.loadReviews();
                break;
            case 'points':
                this.loadPointsHistory();
                this.resetPointsHistoryDropdown();
                break;
        }
    }

    // 마이페이지 데이터 일괄 로드
    async loadMypageData() {
        await Promise.all([
            this.loadOrders(),
            this.loadWishlist(),
            this.loadReviews(),
            this.loadPointsHistory()
        ]);
    }

    // 주문 내역 로드/렌더
    async loadOrders() {
        try {
            const response = await fetch('/api/shop/orders', { credentials: 'include' });
            const data = await response.json();
            if (data.success) {
                this.renderOrders(data.data);
            } else {
                this.renderOrders([]);
            }
        } catch (error) {
            console.error('주문 내역 조회 오류:', error);
            this.renderOrders([]);
        }
    }

    renderOrders(orders) {
        const ordersList = document.getElementById('ordersList');
        if (!ordersList) return;
        if (!orders || orders.length === 0) {
            ordersList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📦</div>
                    <div class="empty-state-text">주문 내역이 없습니다</div>
                    <div class="empty-state-subtext">첫 주문을 시작해보세요!</div>
                </div>
            `;
            return;
        }
        ordersList.innerHTML = orders.map(order => `
            <div class="order-item">
                <div class="order-header">
                    <div class="order-date">주문일: ${this.formatDate(order.created_at)}</div>
                    <div class="order-status ${this.getStatusClass(order.status)}">${this.getStatusText(order.status)}</div>
                </div>
                <div class="order-products">
                    ${order.items ? order.items.map(item => `
                        <div class="order-product">
                            <div class="order-product-image">${this.getDefaultEmoji(item.category) || '📦'}</div>
                            <div class="order-product-info">
                                <div class="order-product-name">${item.name || '상품명 없음'}</div>
                                <div class="order-product-details">수량: ${item.quantity}개 | 단가: ${item.price.toLocaleString()}원</div>
                            </div>
                        </div>
                    `).join('') : ''}
                </div>
                <div class="order-total">
                    ${order.points_used > 0 ? `포인트 사용: ${order.points_used.toLocaleString()}P<br>` : ''}
                    총 결제금액: ${order.total_amount.toLocaleString()}원
                </div>
            </div>
        `).join('');
    }

    getStatusClass(status) {
        const statusMap = { pending: 'status-pending', processing: 'status-processing', shipped: 'status-shipped', delivered: 'status-delivered' };
        return statusMap[status] || 'status-pending';
    }
    getStatusText(status) {
        const statusMap = { pending: '주문 확인중', processing: '준비중', shipped: '배송중', delivered: '배송완료' };
        return statusMap[status] || '주문 확인중';
    }

    // 찜 로드/렌더
    async loadWishlist() {
        try {
            const response = await fetch('/api/shop/wishlist', { credentials: 'include' });
            const data = await response.json();
            if (data.success) {
                this.renderWishlist(data.data);
            } else {
                this.renderWishlist([]);
            }
        } catch (error) {
            console.error('찜한 상품 조회 오류:', error);
            this.renderWishlist([]);
        }
    }
    renderWishlist(wishlist) {
        const wishlistGrid = document.getElementById('wishlistGrid');
        if (!wishlistGrid) return;
        if (!wishlist || wishlist.length === 0) {
            wishlistGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">❤️</div>
                    <div class="empty-state-text">찜한 상품이 없습니다</div>
                    <div class="empty-state-subtext">관심있는 상품을 찜해보세요!</div>
                </div>
            `;
            return;
        }
        wishlistGrid.innerHTML = wishlist.map(item => `
            <div class="wishlist-item">
                <div class="wishlist-item-image">${item.image_url || this.getDefaultEmoji(item.category) || '📦'}</div>
                <div class="wishlist-item-info">
                    <div class="wishlist-item-name">${item.name || '상품명 없음'}</div>
                    <div class="wishlist-item-price">${item.price ? item.price.toLocaleString() : '0'}원</div>
                </div>
                <button class="wishlist-remove-btn" data-id="${item.id}">삭제</button>
            </div>
        `).join('');

        // 삭제 바인딩
        wishlistGrid.querySelectorAll('.wishlist-remove-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const id = btn.getAttribute('data-id');
                try {
                    const res = await fetch(`/api/shop/wishlist/${id}`, { method: 'DELETE', credentials: 'include' });
                    const data = await res.json();
                    if (data.success) {
                        this.loadWishlist();
                    } else {
                        alert('찜 삭제에 실패했습니다.');
                    }
                } catch (err) {
                    console.error('찜 삭제 오류:', err);
                    alert('찜 삭제 중 오류가 발생했습니다.');
                }
            });
        });
    }

    // 리뷰 로드/렌더
    async loadReviews() {
        try {
            const [pendingResponse, myReviewsResponse] = await Promise.all([
                fetch('/api/shop/reviews/pending', { credentials: 'include' }),
                fetch('/api/shop/reviews/my', { credentials: 'include' })
            ]);
            const [pendingData, myReviewsData] = await Promise.all([
                pendingResponse.json(), myReviewsResponse.json()
            ]);
            const pending = pendingData.success ? pendingData.data : [];
            const myReviews = myReviewsData.success ? myReviewsData.data : [];
            this.renderPendingReviews(pending);
            this.renderMyReviews(myReviews);
        } catch (error) {
            console.error('리뷰 데이터 조회 오류:', error);
            this.renderPendingReviews([]);
            this.renderMyReviews([]);
        }
    }
    renderPendingReviews(pendingReviews) {
        const container = document.getElementById('pendingReviews');
        if (!container) return;
        if (!pendingReviews || pendingReviews.length === 0) {
            container.innerHTML = '<div class="empty-state">작성 가능한 리뷰가 없습니다</div>';
            return;
        }
        container.innerHTML = pendingReviews.map(item => `
            <div class="review-item">
                <div class="review-product">
                    <div class="review-product-image">${this.getDefaultEmoji(item.category) || '📦'}</div>
                    <div class="review-product-info">
                        <div class="review-product-name">${item.product_name || '상품명 없음'}</div>
                        <div class="review-product-date">배송 완료된 상품</div>
                    </div>
                </div>
                <button class="review-write-btn" data-product-id="${item.product_id}">리뷰 작성</button>
            </div>
        `).join('');
        // 작성 버튼 이벤트 바인딩
        container.querySelectorAll('.review-write-btn').forEach(btn => {
            btn.addEventListener('click', () => this.openReviewModal(btn.getAttribute('data-product-id')));
        });
    }
    renderMyReviews(myReviews) {
        const container = document.getElementById('myReviews');
        if (!container) return;
        if (!myReviews || myReviews.length === 0) {
            container.innerHTML = '<div class="empty-state">작성한 리뷰가 없습니다</div>';
            return;
        }
        container.innerHTML = myReviews.map(review => `
            <div class="review-item">
                <div class="review-product">
                    <div class="review-product-image">${this.getDefaultEmoji(review.category) || '📦'}</div>
                    <div class="review-product-info">
                        <div class="review-product-name">${review.product_name || '상품명 없음'}</div>
                        <div class="review-rating">${'★'.repeat(review.rating)}${'☆'.repeat(5-review.rating)}</div>
                    </div>
                </div>
                <div class="review-content">${review.content || ''}</div>
            </div>
        `).join('');
    }

    // 리뷰 작성 모달 열기/이벤트/제출
    openReviewModal(productId) {
        const reviewModal = document.getElementById('reviewModal');
        if (!reviewModal) return;
        // 상품 간단 정보 표시(필요 시 추가 로드 가능)
        const info = document.getElementById('reviewProductInfo');
        if (info) {
            info.innerHTML = `<div>상품 ID: ${productId}</div>`;
        }
        reviewModal.setAttribute('data-product-id', String(productId));
        reviewModal.style.display = 'block';
    }

    setupReviewModalEvents() {
        const reviewModal = document.getElementById('reviewModal');
        const reviewModalClose = document.getElementById('reviewModalClose');
        const reviewCancelBtn = document.getElementById('reviewCancelBtn');
        const reviewSubmitBtn = document.getElementById('reviewSubmitBtn');
        const starContainer = document.getElementById('starRating');

        if (reviewModalClose) reviewModalClose.onclick = () => reviewModal.style.display = 'none';
        if (reviewCancelBtn) reviewCancelBtn.onclick = () => reviewModal.style.display = 'none';
        window.addEventListener('click', (event) => {
            if (event.target === reviewModal) {
                reviewModal.style.display = 'none';
            }
        });

        // 별점 선택
        if (starContainer) {
            starContainer.addEventListener('click', (e) => {
                const target = e.target;
                if (target.classList.contains('star')) {
                    const rating = parseInt(target.getAttribute('data-rating')) || 0;
                    // 시각적 표시
                    Array.from(starContainer.querySelectorAll('.star')).forEach((el, idx) => {
                        el.style.color = (idx < rating) ? '#fbbf24' : '#e5e7eb';
                    });
                    starContainer.setAttribute('data-selected-rating', String(rating));
                }
            });
        }

        // 리뷰 제출
        if (reviewSubmitBtn) {
            reviewSubmitBtn.addEventListener('click', async () => {
                const rating = parseInt(starContainer?.getAttribute('data-selected-rating') || '0');
                const content = (document.getElementById('reviewText')?.value || '').trim();
                if (rating <= 0) {
                    alert('평점을 선택해주세요.');
                    return;
                }
                const reviewModalEl = document.getElementById('reviewModal');
                const productId = reviewModalEl?.getAttribute('data-product-id');
                try {
                    const res = await fetch('/api/shop/reviews', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ rating, content, product_id: productId })
                    });
                    const data = await res.json();
                    if (data.success) {
                        alert('리뷰가 성공적으로 등록되었습니다.');
                        reviewModal.style.display = 'none';
                        this.loadReviews();
                    } else {
                        alert('리뷰 등록에 실패했습니다: ' + (data.error || '알 수 없는 오류'));
                    }
                } catch (err) {
                    console.error('리뷰 등록 오류:', err);
                    alert('리뷰 등록 중 오류가 발생했습니다.');
                }
            });
        }
    }

    // 카테고리별 기본 이모지
    getDefaultEmoji(category) {
        const emojiMap = {
            health_functional_food: '💊',
            vitamins: '🟡',
            minerals: '🟢',
            protein: '💪',
            omega3: '🐟',
            probiotics: '🦠',
            herb: '🌿',
            etc: '📦'
        };
        return emojiMap[category] || '📦';
    }

    // 안전한 날짜 포맷팅 함수
    formatDate(dateString) {
        if (!dateString) return "";
        
        try {
            // ISO 문자열을 직접 파싱
            const date = new Date(dateString);
            
            // Invalid Date 체크
            if (isNaN(date.getTime())) {
                // 다른 형식으로 시도
                const parsedDate = new Date(dateString.replace('T', ' ').replace('Z', ''));
                if (isNaN(parsedDate.getTime())) {
                    return "날짜 오류";
                }
                return parsedDate.toLocaleDateString("ko-KR");
            }
            
            return date.toLocaleDateString("ko-KR");
        } catch (error) {
            console.warn("날짜 파싱 오류:", dateString, error);
            return "날짜 오류";
        }
    }

    // 포인트 내역 로드/렌더 + 드롭다운 리셋
    async loadPointsHistory() {
        try {
            const response = await fetch('/api/points/history', { credentials: 'include' });
            const data = await response.json();
            if (data.success) {
                this.renderPointsHistory(data.data);
                // 현재 포인트 표시 업데이트 (cart에서 보유 포인트는 availablePoints와 별개)
                const currentAmountEl = document.getElementById('currentPointsAmount');
                if (currentAmountEl) currentAmountEl.textContent = `${(this.availablePoints || 0).toLocaleString()}P`;
            } else {
                this.renderPointsHistory([]);
            }
        } catch (error) {
            console.error('포인트 내역 조회 오류:', error);
            this.renderPointsHistory([]);
        }
    }
    renderPointsHistory(history) {
        const list = document.getElementById('pointsList');
        if (!list) return;
        if (!history || history.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">💰</div>
                    <div class="empty-state-text">포인트 내역이 없습니다</div>
                    <div class="empty-state-subtext">활동을 통해 포인트를 적립해보세요!</div>
                </div>
            `;
            return;
        }
        list.innerHTML = history.map(item => `
            <div class="points-item">
                <div class="points-info">
                    <div class="points-description">${item.description}</div>
                    <div class="points-date">${this.formatDate(item.timestamp)}</div>
                </div>
                <div class="points-amount ${item.type === 'earn' ? 'earned' : 'used'}">
                    ${item.type === 'earn' ? '+' : '-'}${item.amount.toLocaleString()}P
                </div>
            </div>
        `).join('');
    }
    resetPointsHistoryDropdown() {
        const pointsList = document.getElementById('pointsList');
        const arrow = document.getElementById('pointsHistoryArrow');

        if (pointsList && arrow) {
            // 드롭다운을 닫힌 상태로 초기화
            pointsList.style.display = 'none';
            pointsList.classList.remove('expanded');
            arrow.classList.remove('rotated');
            arrow.textContent = '▼';
        }
    }

    // 브랜드별 배송비 계산 함수
    calculateBrandBasedShippingFee(selectedItems) {
        if (selectedItems.length === 0) return 0;

        // 브랜드별로 그룹화
        const brandGroups = {};
        selectedItems.forEach(item => {
            // 브랜드 정보가 null, undefined, 빈 문자열인 경우 '기본브랜드'로 처리
            const brand = (item.brand && typeof item.brand === 'string' && item.brand.trim() !== '') ? item.brand : '기본브랜드';
            if (!brandGroups[brand]) {
                brandGroups[brand] = {
                    items: [],
                    totalPrice: 0,
                    shippingFee: item.shippingFee || 3000 // 제품별 배송비, 기본값 3000원
                };
            }
            brandGroups[brand].items.push(item);
            brandGroups[brand].totalPrice += item.price * item.quantity;
        });

        // 각 브랜드별로 배송비 계산
        let totalShippingFee = 0;
        Object.keys(brandGroups).forEach(brand => {
            const group = brandGroups[brand];
            // 브랜드별 상품 총액이 30,000원 이상이면 해당 브랜드 배송비 무료
            if (group.totalPrice >= 30000) {
                // 배송비 무료
            } else {
                // 브랜드별 배송비 추가 (브랜드당 1회만)
                totalShippingFee += group.shippingFee;
            }
        });

        console.log('🚚 브랜드별 배송비 계산:', {
            brandGroups,
            totalShippingFee
        });

        return totalShippingFee;
    }

    // 배송비 상세 정보 업데이트
    updateShippingDetails(selectedItems, totalShippingFee) {
        const shippingInfoEl = document.getElementById('shippingInfo');
        const shippingDetailsEl = document.getElementById('shippingDetails');
        
        if (!shippingInfoEl || !shippingDetailsEl) return;

        if (selectedItems.length === 0) {
            shippingInfoEl.style.display = 'none';
            return;
        }

        // 브랜드별로 그룹화
        const brandGroups = {};
        selectedItems.forEach(item => {
            // 브랜드 정보가 null, undefined, 빈 문자열인 경우 '기본브랜드'로 처리
            const brand = (item.brand && typeof item.brand === 'string' && item.brand.trim() !== '') ? item.brand : '기본브랜드';
            if (!brandGroups[brand]) {
                brandGroups[brand] = {
                    items: [],
                    totalPrice: 0,
                    shippingFee: item.shippingFee || 3000
                };
            }
            brandGroups[brand].items.push(item);
            brandGroups[brand].totalPrice += item.price * item.quantity;
        });

        // 배송비 상세 정보 생성
        let detailsHTML = '';
        Object.keys(brandGroups).forEach(brand => {
            const group = brandGroups[brand];
            const isFreeShipping = group.totalPrice >= 30000;
            const shippingFeeText = isFreeShipping ? '무료배송' : `${this.formatPrice(group.shippingFee)}원`;
            const freeClass = isFreeShipping ? 'free' : '';
            
            detailsHTML += `
                <div class="brand-shipping-item">
                    <span class="brand-name">${brand}</span>
                    <span class="brand-shipping-fee ${freeClass}">${shippingFeeText}</span>
                </div>
            `;
        });

        if (totalShippingFee === 0) {
            detailsHTML = '<div class="brand-shipping-item"><span class="brand-shipping-fee free">전체 무료배송</span></div>';
        }

        shippingDetailsEl.innerHTML = detailsHTML;
        shippingInfoEl.style.display = 'block';
    }

    // 이미지 URL 파싱 함수
    parseImageUrl(imageData) {
        if (!imageData) {
            console.warn('이미지 데이터가 없습니다');
            return '';
        }
        
        // 이미 올바른 URL인 경우
        if (typeof imageData === 'string' && (imageData.startsWith('http') || imageData.startsWith('data:'))) {
            return imageData;
        }
        
        // JSON 배열 문자열인 경우 파싱
        if (typeof imageData === 'string' && imageData.startsWith('[')) {
            try {
                const parsed = JSON.parse(imageData);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    const firstImage = parsed[0];
                    // 상대 경로인 경우 절대 경로로 변환
                    if (typeof firstImage === 'string' && !firstImage.startsWith('http') && !firstImage.startsWith('data:')) {
                        return firstImage.startsWith('/') ? firstImage : `/uploads/products/${firstImage}`;
                    }
                    return firstImage;
                }
            } catch (e) {
                console.warn('이미지 데이터 파싱 실패:', imageData, e);
            }
        }
        
        // 배열이 아닌 문자열인 경우 (상대 경로일 가능성)
        if (typeof imageData === 'string') {
            // 상대 경로인 경우 절대 경로로 변환
            if (!imageData.startsWith('http') && !imageData.startsWith('data:')) {
                return imageData.startsWith('/') ? imageData : `/uploads/products/${imageData}`;
            }
            return imageData;
        }
        
        // 배열인 경우
        if (Array.isArray(imageData) && imageData.length > 0) {
            const firstImage = imageData[0];
            if (typeof firstImage === 'string' && !firstImage.startsWith('http') && !firstImage.startsWith('data:')) {
                return firstImage.startsWith('/') ? firstImage : `/uploads/products/${firstImage}`;
            }
            return firstImage;
        }
        
        console.warn('지원되지 않는 이미지 데이터 형식:', imageData);
        return '';
    }

    // 장바구니 아이템 렌더링
    renderCartItems() {
        const cartItemsList = document.getElementById('cartItemsList');
        const emptyCart = document.getElementById('emptyCart');

        if (!cartItemsList || !emptyCart) return;

        if (this.cartItems.length === 0) {
            cartItemsList.style.display = 'none';
            emptyCart.style.display = 'block';
            return;
        }

        // 디버깅: 장바구니 아이템의 이미지 데이터 출력
        console.log('장바구니 아이템들:', this.cartItems);
        this.cartItems.forEach((item, index) => {
            const parsedImage = this.parseImageUrl(item.image);
            console.log(`아이템 ${index + 1}:`, {
                name: item.name,
                originalImage: item.image,
                parsedImage: parsedImage,
                imageType: typeof item.image,
                imageLength: item.image ? item.image.length : 0,
                isArray: Array.isArray(item.image)
            });
        });

        cartItemsList.style.display = 'block';
        emptyCart.style.display = 'none';

        cartItemsList.innerHTML = this.cartItems.map((item, index) => {
            const imageUrl = this.parseImageUrl(item.image);
            return `
            <div class="cart-item" data-index="${index}" data-product-id="${item.id}">
                <input type="checkbox" class="cart-item-checkbox" ${item.selected ? 'checked' : ''} 
                       onchange="cartManager.toggleItemSelection(${index})" onclick="event.stopPropagation()">
                
                <div class="cart-item-clickable" onclick="cartManager.goToProductDetail('${item.id}')">
                    <img src="${imageUrl}" alt="${item.name}" class="cart-item-image" 
                         onerror="console.error('이미지 로드 실패:', '${imageUrl}', 'for item:', '${item.name}'); this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjRjVGNUY1Ii8+Cjx0ZXh0IHg9IjQwIiB5PSI0NSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEwIiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIj7snbTrr7jsp4A8L3RleHQ+Cjwvc3ZnPgo='">
                    
                    <div class="cart-item-info">
                        <div class="cart-item-name">${item.name}</div>
                        <div class="cart-item-price">
                            ${this.formatPrice(item.price)}원
                            ${item.originalPrice && item.originalPrice > item.price ? 
                                `<span class="cart-item-original-price">${this.formatPrice(item.originalPrice)}원</span>` : ''}
                        </div>
                    </div>
                </div>
                
                <div class="cart-item-controls">
                    <div class="quantity-controls">
                        <button class="quantity-btn" onclick="cartManager.updateQuantity(${index}, ${item.quantity - 1}); event.stopPropagation();" 
                                ${item.quantity <= 1 ? 'disabled' : ''}>-</button>
                        <input type="number" class="quantity-input" value="${item.quantity}" min="1" max="99"
                               onchange="cartManager.updateQuantity(${index}, parseInt(this.value))" onclick="event.stopPropagation()">
                        <button class="quantity-btn" onclick="cartManager.updateQuantity(${index}, ${item.quantity + 1}); event.stopPropagation();"
                                ${item.quantity >= 99 ? 'disabled' : ''}>+</button>
                    </div>
                    
                    <button class="delete-item-btn" onclick="cartManager.removeItem(${index}); event.stopPropagation();" title="삭제">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3,6 5,6 21,6"></polyline>
                            <path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                    </button>
                </div>
            </div>
            `;
        }).join('');
    }

    // 아이템 선택 토글
    toggleItemSelection(index) {
        if (this.cartItems[index]) {
            this.cartItems[index].selected = !this.cartItems[index].selected;
            this.saveCartToStorage();
            this.updateCartSummary();
            this.updateSelectAllCheckbox();
        }
    }

    // 전체 선택 토글
    toggleSelectAll(selectAll) {
        this.cartItems.forEach(item => {
            item.selected = selectAll;
        });
        this.saveCartToStorage();
        this.renderCartItems();
        this.updateCartSummary();
    }

    // 전체 선택 체크박스 상태 업데이트
    updateSelectAllCheckbox() {
        const selectAllCheckbox = document.getElementById('selectAll');
        if (!selectAllCheckbox) return;

        const selectedItems = this.cartItems.filter(item => item.selected);
        selectAllCheckbox.checked = selectedItems.length === this.cartItems.length && this.cartItems.length > 0;
    }

    // 수량 업데이트
    updateQuantity(index, newQuantity) {
        if (newQuantity < 1 || newQuantity > 99) return;
        
        if (this.cartItems[index]) {
            this.cartItems[index].quantity = newQuantity;
            this.saveCartToStorage();
            this.renderCartItems();
            this.updateCartSummary();
            this.updateCartCount();
        }
    }

    // 아이템 제거
    removeItem(index) {
        if (confirm('이 상품을 장바구니에서 삭제하시겠습니까?')) {
            this.cartItems.splice(index, 1);
            this.saveCartToStorage();
            this.renderCartItems();
            this.updateCartSummary();
            this.updateCartCount();
            this.updateSelectAllCheckbox();
        }
    }

    // 선택된 아이템 삭제
    deleteSelectedItems() {
        const selectedItems = this.cartItems.filter(item => item.selected);
        if (selectedItems.length === 0) {
            alert('삭제할 상품을 선택해주세요.');
            return;
        }

        if (confirm(`선택한 ${selectedItems.length}개 상품을 삭제하시겠습니까?`)) {
            this.cartItems = this.cartItems.filter(item => !item.selected);
            this.saveCartToStorage();
            this.renderCartItems();
            this.updateCartSummary();
            this.updateCartCount();
            this.updateSelectAllCheckbox();
        }
    }

    // 장바구니 요약 정보 업데이트
    updateCartSummary() {
        const selectedItems = this.cartItems.filter(item => item.selected);
        const selectedItemsPrice = selectedItems.reduce((total, item) => total + (item.price * item.quantity), 0);
        
        // 브랜드별 배송비 계산
        const shippingFee = this.calculateBrandBasedShippingFee(selectedItems);
        
        const subtotal = selectedItemsPrice + shippingFee;
        const totalPrice = Math.max(0, subtotal - this.usedPoints);

        // DOM 업데이트
        const selectedItemsPriceEl = document.getElementById('selectedItemsPrice');
        const shippingFeeEl = document.getElementById('shippingFee');
        const pointsDiscountRowEl = document.getElementById('pointsDiscountRow');
        const pointsDiscountEl = document.getElementById('pointsDiscount');
        const totalPriceEl = document.getElementById('totalPrice');
        const selectedItemsCountEl = document.getElementById('selectedItemsCount');
        const orderBtn = document.getElementById('orderBtn');

        if (selectedItemsPriceEl) selectedItemsPriceEl.textContent = this.formatPrice(selectedItemsPrice) + '원';
        if (shippingFeeEl) shippingFeeEl.textContent = this.formatPrice(shippingFee) + '원';
        
        // 배송비 상세 정보 표시
        this.updateShippingDetails(selectedItems, shippingFee);
        
        // 포인트 할인 표시
        if (pointsDiscountRowEl && pointsDiscountEl) {
            if (this.usedPoints > 0) {
                pointsDiscountRowEl.style.display = 'flex';
                pointsDiscountEl.textContent = '-' + this.formatPrice(this.usedPoints) + '원';
            } else {
                pointsDiscountRowEl.style.display = 'none';
            }
        }
        
        if (totalPriceEl) totalPriceEl.textContent = this.formatPrice(totalPrice) + '원';
        if (selectedItemsCountEl) selectedItemsCountEl.textContent = selectedItems.length;
        
        if (orderBtn) {
            // 비로그인 상태에서는 로그인 버튼으로 표시
            if (!this.isLoggedIn) {
                orderBtn.textContent = '로그인하고 주문하기';
                orderBtn.disabled = false;
                orderBtn.style.backgroundColor = '#2196F3'; // 파란색으로 변경
            } else {
                orderBtn.innerHTML = `주문하기 (<span id="selectedItemsCount">${selectedItems.length}</span>개)`;
                orderBtn.disabled = selectedItems.length === 0;
                orderBtn.style.backgroundColor = selectedItems.length === 0 ? '#ccc' : '#4CAF50';
            }
        }

        // 항상 전액사용이 체크되어 있으면 자동으로 포인트 적용
        const alwaysUseAllPoints = document.getElementById('alwaysUseAllPoints');
        if (alwaysUseAllPoints && alwaysUseAllPoints.checked && this.isLoggedIn && this.availablePoints > 0) {
            // 선택된 아이템이 있을 때만 포인트 적용
            if (selectedItems.length > 0) {
                this.useAllPoints();
            }
        }
    }

    // 포인트 섹션 초기화
    initPointsSection() {
        const pointsSection = document.querySelector('.points-section');
        const availablePointsEl = document.getElementById('availablePoints');
        const pointsInput = document.getElementById('pointsInput');
        const alwaysUseAllPoints = document.getElementById('alwaysUseAllPoints');
        
        // 로그인하지 않은 경우 포인트 섹션 숨기기
        if (!this.isLoggedIn) {
            if (pointsSection) {
                pointsSection.style.display = 'none';
            }
            return;
        }
        
        // 로그인한 경우 포인트 섹션 표시
        if (pointsSection) {
            pointsSection.style.display = 'block';
        }
        
        if (availablePointsEl) {
            availablePointsEl.textContent = this.formatPrice(this.availablePoints) + '원';
        }
        
        if (pointsInput) {
            pointsInput.max = this.availablePoints;
            pointsInput.value = this.usedPoints;
        }
        
        // 저장된 "항상 전액사용" 설정 로드 및 적용
        if (alwaysUseAllPoints) {
            const savedSetting = this.loadAlwaysUseAllPointsSetting();
            alwaysUseAllPoints.checked = savedSetting;
            
            // 체크되어 있고 포인트가 있으면 자동으로 전액사용 적용
            if (savedSetting && this.availablePoints > 0) {
                // 약간의 지연을 두어 다른 초기화가 완료된 후 실행
                setTimeout(() => {
                    this.useAllPoints();
                }, 100);
            }
        }
        
        this.updatePointsDisplay();
    }

    // 포인트 사용량 업데이트
    updatePointsUsage(points) {
        const selectedItems = this.cartItems.filter(item => item.selected);
        const selectedItemsPrice = selectedItems.reduce((total, item) => total + (item.price * item.quantity), 0);
        const shippingFee = this.calculateBrandBasedShippingFee(selectedItems);
        const maxUsablePoints = Math.min(this.availablePoints, selectedItemsPrice + shippingFee);
        
        // 사용 가능한 포인트 범위 내에서 제한
        this.usedPoints = Math.max(0, Math.min(points, maxUsablePoints));
        
        const pointsInput = document.getElementById('pointsInput');
        if (pointsInput) {
            pointsInput.value = this.usedPoints;
        }
        
        this.updatePointsDisplay();
        this.updateCartSummary();
    }

    // 전액사용 버튼 클릭
    useAllPoints() {
        const selectedItems = this.cartItems.filter(item => item.selected);
        const selectedItemsPrice = selectedItems.reduce((total, item) => total + (item.price * item.quantity), 0);
        const shippingFee = this.calculateBrandBasedShippingFee(selectedItems);
        const maxUsablePoints = Math.min(this.availablePoints, selectedItemsPrice + shippingFee);
        
        this.updatePointsUsage(maxUsablePoints);
    }

    // 포인트 표시 업데이트
    updatePointsDisplay() {
        // 포인트 입력 필드 업데이트만 수행
        const pointsInput = document.getElementById('pointsInput');
        if (pointsInput && pointsInput.value != this.usedPoints) {
            pointsInput.value = this.usedPoints;
        }
    }

    // 장바구니 개수 업데이트 (제품 종류 수 기준)
    // 헤더 등에서 표시하는 카운트는 동일 제품의 수량 합계가 아닌 "서로 다른 제품 개수"를 의미함
    updateCartCount() {
        let productTypesCount = 0;

        if (Array.isArray(this.cartItems) && this.cartItems.length > 0) {
            // 모든 아이템에 id가 있는 경우 id 기준으로 고유 개수 계산
            const hasAllIds = this.cartItems.every(item => item && typeof item.id !== 'undefined' && item.id !== null);
            if (hasAllIds) {
                productTypesCount = new Set(this.cartItems.map(item => item.id)).size;
            } else {
                // id가 없는 아이템이 섞여 있을 수 있으므로 name → 객체 직렬화 순으로 대체 키 사용
                const uniqueKeys = new Set(
                    this.cartItems.map(item => (item && (item.id ?? item.name ?? JSON.stringify(item))))
                );
                productTypesCount = uniqueKeys.size;
            }
        }

        const cartCountElements = document.querySelectorAll('.cart-count');
        cartCountElements.forEach(el => {
            el.textContent = String(productTypesCount);
        });
    }

    // 주문 진행
    proceedToOrder() {
        // 비로그인 상태에서는 로그인 페이지로 이동
        if (!this.isLoggedIn) {
            // 현재 페이지 URL을 저장하여 로그인 후 돌아올 수 있도록 함
            sessionStorage.setItem('returnUrl', window.location.href);
            window.location.href = 'login.html';
            return;
        }

        const selectedItems = this.cartItems.filter(item => item.selected);
        if (selectedItems.length === 0) {
            alert('주문할 상품을 선택해주세요.');
            return;
        }

        // 주문 정보를 세션 스토리지에 저장
        sessionStorage.setItem('orderItems', JSON.stringify(selectedItems));
        
        // 주문 페이지로 이동 (또는 모달 표시)
        alert(`${selectedItems.length}개 상품 주문을 진행합니다.`);
        // window.location.href = 'order.html';
    }

    // 가격 포맷팅
    formatPrice(price) {
        return new Intl.NumberFormat('ko-KR').format(price);
    }

    // 상품 상세페이지로 이동
    goToProductDetail(productId) {
        if (!productId) {
            console.error('상품 ID가 없습니다.');
            return;
        }
        
        // 상품 상세페이지로 이동
        window.location.href = `product-detail.html?id=${productId}`;
    }

    // 장바구니에 상품 추가 (다른 페이지에서 호출)
    addItem(product) {
        const existingItemIndex = this.cartItems.findIndex(item => item.id === product.id);
        
        if (existingItemIndex > -1) {
            // 이미 존재하는 상품이면 수량 증가
            this.cartItems[existingItemIndex].quantity += product.quantity || 1;
        } else {
            // 새로운 상품 추가
            this.cartItems.push({
                ...product,
                selected: true,
                quantity: product.quantity || 1
            });
        }
        
        this.saveCartToStorage();
        this.updateCartCount();
    }
}

// 전역 변수로 cartManager 인스턴스 생성
let cartManager;

// DOM 로드 완료 후 초기화
document.addEventListener('DOMContentLoaded', async () => {
    cartManager = new CartManager();
    
    // 장바구니 버튼 클릭 이벤트 (헤더)
    const cartButtons = document.querySelectorAll('.cart-btn');
    cartButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            // 이미 장바구니 페이지에 있으면 아무것도 하지 않음
            if (window.location.pathname.includes('cart.html')) {
                return;
            }
            window.location.href = 'cart.html';
        });
    });

    // 마이페이지 모달 닫기 및 외부 클릭 닫기, 탭 이벤트, 리뷰 모달 이벤트 설정
    const mypageModal = document.getElementById('mypageModal');
    const mypageModalClose = document.getElementById('mypageModalClose');
    if (mypageModal && mypageModalClose) {
        mypageModalClose.onclick = () => mypageModal.style.display = 'none';
        window.addEventListener('click', (event) => {
            if (event.target === mypageModal) {
                mypageModal.style.display = 'none';
            }
        });
    }

    // 마이페이지 탭 클릭 이벤트
    document.querySelectorAll('.mypage-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabName = e.target.dataset.tab;
            if (cartManager && typeof cartManager.switchMypageTab === 'function') {
                cartManager.switchMypageTab(tabName);
            }
        });
    });

    // 리뷰 작성 모달 관련 이벤트 설정
    if (cartManager && typeof cartManager.setupReviewModalEvents === 'function') {
        cartManager.setupReviewModalEvents();
    }

    // 포인트 내역 드롭다운 토글 전역 함수 주입 (store.html과 동일 동작)
    window.togglePointsHistory = function() {
        const pointsList = document.getElementById('pointsList');
        const arrow = document.getElementById('pointsHistoryArrow');

        if (
            pointsList.style.display === "none" ||
            !pointsList.classList.contains("expanded")
        ) {
            // 드롭다운 열기
            pointsList.style.display = "flex";
            setTimeout(() => {
                pointsList.classList.add("expanded");
            }, 10);
            arrow.classList.add("rotated");
            arrow.textContent = "▲";
        } else {
            // 드롭다운 닫기
            pointsList.classList.remove("expanded");
            arrow.classList.remove("rotated");
            arrow.textContent = "▼";
            setTimeout(() => {
                pointsList.style.display = "none";
            }, 300);
        }
    };

    // 로그인 후 돌아온 경우 처리
    const returnUrl = sessionStorage.getItem('returnUrl');
    if (returnUrl && returnUrl.includes('cart.html') && window.location.pathname.includes('cart.html')) {
        sessionStorage.removeItem('returnUrl');
        // 인증 상태를 다시 확인하고 UI 업데이트
        await cartManager.checkAuthStatus();
        await cartManager.loadUserPoints();
        cartManager.initPointsSection();
        cartManager.updateCartSummary();
        
        // 약간의 지연 후 항상 전액사용 설정 재적용
        setTimeout(() => {
            const alwaysUseAllPoints = document.getElementById('alwaysUseAllPoints');
            if (alwaysUseAllPoints && alwaysUseAllPoints.checked) {
                cartManager.useAllPoints();
            }
        }, 200);
    }
});

// 다른 페이지에서 사용할 수 있도록 전역 함수 제공
window.addToCart = function(product) {
    if (!cartManager) {
        cartManager = new CartManager();
    }
    cartManager.addItem(product);
};
// 관리자 제품 관리 JavaScript
class AdminProductManager {
  constructor() {
    this.products = [];
    this.selectedProducts = new Set();
    this.currentView = "grid";
    this.currentPage = 1;
    this.itemsPerPage = 12;
    this.searchQuery = "";
    this.categoryFilter = "";
    this.statusFilter = "";
    this.isLoading = false;

    this.init();
  }

  async init() {
    this.bindEvents();
    await this.loadProductsFromSupabase();
    this.renderProducts();
    this.updateStats();
  }

  bindEvents() {
    // 네비게이션 토글
    const navToggle = document.getElementById("navToggle");
    const navMenu = document.getElementById("navMenu");

    if (navToggle && navMenu) {
      navToggle.addEventListener("click", () => {
        navToggle.classList.toggle("active");
        navMenu.classList.toggle("active");
      });
    }

    // 새 제품 추가 버튼
    document.getElementById("addProductBtn").addEventListener("click", () => {
      window.location.href = "admin-product-form.html";
    });

    // 테스트 데이터 정리 버튼 제거됨

    // 검색 및 필터
    document.getElementById("searchInput").addEventListener("input", (e) => {
      this.searchQuery = e.target.value;
      this.currentPage = 1;
      this.renderProducts();
    });

    document
      .getElementById("categoryFilter")
      .addEventListener("change", (e) => {
        this.categoryFilter = e.target.value;
        this.currentPage = 1;
        this.renderProducts();
      });

    document.getElementById("statusFilter").addEventListener("change", (e) => {
      this.statusFilter = e.target.value;
      this.currentPage = 1;
      this.renderProducts();
    });

    // 뷰 전환
    document.querySelectorAll(".view-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        // 내부 아이콘(span) 클릭 시 dataset 누락되는 문제 방지
        const view = e.currentTarget.dataset.view;
        if (!view) return;
        this.switchView(view);
      });
    });

    // 전체 선택 (그리드 뷰용)
    const selectAllGrid = document.getElementById("selectAll");
    if (selectAllGrid) {
      selectAllGrid.addEventListener("change", (e) => {
        this.toggleSelectAll(e.target.checked);
      });
    }

    // 일괄 작업 (요소 존재 확인 후 바인딩)
    const bulkDeleteBtn = document.getElementById("bulkDelete");
    if (bulkDeleteBtn) {
      bulkDeleteBtn.addEventListener("click", () => this.bulkDelete());
    }

    const bulkActivateBtn = document.getElementById("bulkActivate");
    if (bulkActivateBtn) {
      bulkActivateBtn.addEventListener("click", () =>
        this.bulkUpdateStatus("active")
      );
    }

    const bulkDeactivateBtn = document.getElementById("bulkDeactivate");
    if (bulkDeactivateBtn) {
      bulkDeactivateBtn.addEventListener("click", () =>
        this.bulkUpdateStatus("inactive")
      );
    }
  }

  // Supabase에서 제품 데이터 로드
  async loadProductsFromSupabase() {
    this.isLoading = true;
    this.showLoadingState();

    try {
      const response = await fetch("/api/products");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      this.products = data.products || [];
      console.log("Supabase에서 제품 로드 완료:", this.products.length, "개");
    } catch (error) {
      console.error("Supabase에서 제품 로드 실패:", error);
      this.showNotification("제품 데이터를 불러오는데 실패했습니다.", "error");

      // 폴백으로 localStorage 데이터 사용
      this.loadFallbackProducts();
    } finally {
      this.isLoading = false;
    }
  }

  // 폴백 제품 데이터 (Supabase 연결 실패 시)
  loadFallbackProducts() {
    console.log("폴백 데이터 사용 - 빈 배열로 설정");
    this.products = [];
  }

  // 로딩 상태 표시
  showLoadingState() {
    const container = document.getElementById("productsGrid");
    container.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p>Supabase에서 제품을 불러오는 중입니다<span class="loading-dots"><span></span><span></span><span></span></span></p>
            </div>
        `;
  }

  // Supabase에 제품 저장
  async saveProductToSupabase(product) {
    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(product),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log("제품 저장 성공:", result);
      return result;
    } catch (error) {
      console.error("제품 저장 실패:", error);
      throw error;
    }
  }

  // Supabase에서 제품 삭제
  async deleteProductFromSupabase(productId) {
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log("제품 삭제 성공:", productId);
      return true;
    } catch (error) {
      console.error("제품 삭제 실패:", error);
      throw error;
    }
  }

  renderProducts() {
    const filteredProducts = this.getFilteredProducts();
    const paginatedProducts = this.getPaginatedProducts(filteredProducts);

    if (this.currentView === "grid") {
      this.renderProductGrid(paginatedProducts);
    } else {
      this.renderProductTable(paginatedProducts);
    }

    this.renderPagination(filteredProducts.length);
    this.updateBulkActions();
  }

  getFilteredProducts() {
    return this.products.filter((product) => {
      const matchesSearch =
        !this.searchQuery ||
        product.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        (product.description &&
          product.description
            .toLowerCase()
            .includes(this.searchQuery.toLowerCase()));

      const matchesCategory =
        !this.categoryFilter || product.category === this.categoryFilter;
      const matchesStatus =
        !this.statusFilter || product.status === this.statusFilter;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }

  getPaginatedProducts(products) {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return products.slice(startIndex, startIndex + this.itemsPerPage);
  }

  renderProductGrid(products) {
    const container = document.getElementById("productsGrid");
    // 테이블 뷰에서 전환 시 그리드 레이아웃 정상화
    container.classList.add("products-grid");
    container.classList.remove("products-table-wrapper");

    if (products.length === 0) {
      container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📦</div>
                    <h3>제품이 없습니다</h3>
                    <p>새로운 제품을 추가해보세요.</p>
                </div>
            `;
      return;
    }

    container.innerHTML = products
      .map(
        (product) => `
            <div class="product-card ${
              this.selectedProducts.has(product.id) ? "selected" : ""
            }" data-product-id="${product.id}">
                <div class="product-card-header">
                    <div class="product-select">
                        <input type="checkbox" class="product-checkbox" ${
                          this.selectedProducts.has(product.id) ? "checked" : ""
                        } 
                               data-product-id="${product.id}">
                    </div>
                    <div class="product-image">
                        ${this.getProductImageHtml(product)}
                    </div>
                </div>
                <div class="product-info">
                    <h3 class="product-name">${product.name}</h3>
                    <p class="product-description">${product.summary || ""}</p>
                    <div class="product-meta">
                        <div class="product-price">${(typeof product.price ===
                        "number"
                          ? product.price
                          : Number(product.price || 0)
                        ).toLocaleString()}</div>
                        <span class="product-category">${this.getCategoryName(
                          product.category
                        )}</span>
                        <span class="product-status ${
                          product.status
                        }">${this.getStatusName(product.status)}</span>
                    </div>
                    <div class="product-actions">
                        <button class="btn btn-primary edit-product-btn" data-product-id="${
                          product.id
                        }">
                            수정
                        </button>
                        <button class="btn btn-danger delete-product-btn" data-product-id="${
                          product.id
                        }">
                            삭제
                        </button>
                    </div>
                </div>
            </div>
        `
      )
      .join("");

    // 이벤트 리스너 추가
    this.attachProductEventListeners();
  }

  renderProductTable(products) {
    const container = document.getElementById("productsGrid");
    // 그리드 레이아웃 영향을 제거하고 테이블 전용 래퍼 클래스를 적용
    container.classList.remove("products-grid");
    container.classList.add("products-table-wrapper");

    if (products.length === 0) {
      container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📦</div>
                    <h3>제품이 없습니다</h3>
                    <p>새로운 제품을 추가해보세요.</p>
                </div>
            `;
      return;
    }

    container.innerHTML = `
            <table class="products-table">
                <thead>
                    <tr>
                        <th><input type="checkbox" id="selectAllTable"></th>
                        <th>이미지</th>
                        <th>제품명</th>
                        <th>카테고리</th>
                        <th>가격</th>
                        <th>상태</th>
                        <th>작업</th>
                    </tr>
                </thead>
                <tbody>
                    ${products
                      .map(
                        (product) => `
                        <tr class="${
                          this.selectedProducts.has(product.id)
                            ? "selected"
                            : ""
                        }" data-product-id="${product.id}">
                            <td>
                                <input type="checkbox" class="product-checkbox" ${
                                  this.selectedProducts.has(product.id)
                                    ? "checked"
                                    : ""
                                } 
                                       data-product-id="${product.id}">
                            </td>
                            <td>
                                <div class="table-product-image">
                                    ${this.getProductImageHtml(product)}
                                </div>
                            </td>
                            <td>
                                <strong>${product.name}</strong>
                                <br><small>${product.summary || ""}</small>
                            </td>
                            <td>${this.getCategoryName(product.category)}</td>
                            <td>${(typeof product.price === "number"
                              ? product.price
                              : Number(product.price || 0)
                            ).toLocaleString()}원</td>
                            <td><span class="product-status ${
                              product.status
                            }">${this.getStatusName(product.status)}</span></td>
                            <td>
                                <button class="btn btn-sm btn-primary edit-product-btn" data-product-id="${
                                  product.id
                                }">
                                    수정
                                </button>
                                <button class="btn btn-sm btn-danger delete-product-btn" data-product-id="${
                                  product.id
                                }">
                                    삭제
                                </button>
                            </td>
                        </tr>
                    `
                      )
                      .join("")}
                </tbody>
            </table>
        `;

    // 이벤트 리스너 추가
    this.attachProductEventListeners();
  }

  renderPagination(totalItems) {
    const totalPages = Math.ceil(totalItems / this.itemsPerPage);
    const container = document.querySelector(".pagination-container");

    if (!container) return;

    const startItem = (this.currentPage - 1) * this.itemsPerPage + 1;
    const endItem = Math.min(this.currentPage * this.itemsPerPage, totalItems);

    container.innerHTML = `
            <div class="pagination-info">
                ${
                  totalItems > 0 ? `${startItem}-${endItem}` : "0"
                } / ${totalItems}개 제품
            </div>
            <div class="pagination-controls">
                <button class="pagination-btn" ${
                  this.currentPage === 1 ? "disabled" : ""
                } 
                        onclick="adminManager.goToPage(${
                          this.currentPage - 1
                        })">이전</button>
                <div class="pagination-numbers">
                    ${this.generatePageNumbers(totalPages)}
                </div>
                <button class="pagination-btn" ${
                  this.currentPage === totalPages ? "disabled" : ""
                } 
                        onclick="adminManager.goToPage(${
                          this.currentPage + 1
                        })">다음</button>
            </div>
        `;
  }

  generatePageNumbers(totalPages) {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(`
                <button class="page-number ${
                  i === this.currentPage ? "active" : ""
                }" 
                        onclick="adminManager.goToPage(${i})">${i}</button>
            `);
    }

    return pages.join("");
  }

  goToPage(page) {
    this.currentPage = page;
    this.renderProducts();
  }

  switchView(view) {
    this.currentView = view;
    document.querySelectorAll(".view-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === view);
    });
    this.renderProducts();
  }

  toggleProductSelection(productId, selected) {
    if (selected) {
      this.selectedProducts.add(productId);
    } else {
      this.selectedProducts.delete(productId);
    }
    this.updateBulkActions();
    this.renderProducts();
  }

  toggleSelectAll(selectAll) {
    const filteredProducts = this.getFilteredProducts();
    const paginatedProducts = this.getPaginatedProducts(filteredProducts);

    if (selectAll) {
      paginatedProducts.forEach((product) => {
        this.selectedProducts.add(product.id);
      });
    } else {
      paginatedProducts.forEach((product) => {
        this.selectedProducts.delete(product.id);
      });
    }

    this.updateBulkActions();
    this.renderProducts();
  }

  updateBulkActions() {
    const bulkActions = document.querySelector(".bulk-actions");
    const selectedCount = this.selectedProducts.size;

    if (selectedCount > 0) {
      bulkActions.style.display = "flex";
      document.querySelector(
        ".bulk-info"
      ).textContent = `${selectedCount}개 제품 선택됨`;
    } else {
      bulkActions.style.display = "none";
    }
  }

  async deleteProduct(productId) {
    if (confirm("정말로 이 제품을 삭제하시겠습니까?")) {
      try {
        await this.deleteProductFromSupabase(productId);
        this.products = this.products.filter((p) => p.id !== productId);
        this.selectedProducts.delete(productId);
        this.renderProducts();
        this.updateStats();
        this.showNotification("제품이 삭제되었습니다.", "success");
      } catch (error) {
        this.showNotification("제품 삭제에 실패했습니다.", "error");
      }
    }
  }

  async bulkDelete() {
    if (this.selectedProducts.size === 0) return;

    if (
      confirm(`선택된 ${this.selectedProducts.size}개 제품을 삭제하시겠습니까?`)
    ) {
      try {
        // Supabase에서 각 제품 삭제
        const deletePromises = Array.from(this.selectedProducts).map(
          (productId) => this.deleteProductFromSupabase(productId)
        );
        await Promise.all(deletePromises);

        // 로컬 데이터에서도 제거
        this.products = this.products.filter(
          (p) => !this.selectedProducts.has(p.id)
        );
        this.selectedProducts.clear();
        this.renderProducts();
        this.updateStats();
        this.showNotification("선택된 제품들이 삭제되었습니다.", "success");
      } catch (error) {
        this.showNotification("일부 제품 삭제에 실패했습니다.", "error");
      }
    }
  }

  async bulkUpdateStatus(status) {
    if (this.selectedProducts.size === 0) return;

    try {
      // 로컬 데이터 업데이트
      this.products.forEach((product) => {
        if (this.selectedProducts.has(product.id)) {
          product.status = status;
          product.updated_at = new Date().toISOString();
        }
      });

      this.selectedProducts.clear();
      this.renderProducts();
      this.updateStats();
      this.showNotification(
        `선택된 제품들의 상태가 ${this.getStatusName(
          status
        )}(으)로 변경되었습니다.`,
        "success"
      );
    } catch (error) {
      this.showNotification("상태 변경에 실패했습니다.", "error");
    }
  }

  updateStats() {
    const totalProducts = this.products.length;
    const activeProducts = this.products.filter(
      (p) => p.status === "active"
    ).length;
    const inactiveProducts = this.products.filter(
      (p) => p.status === "inactive"
    ).length;
    const outOfStockProducts = this.products.filter(
      (p) => p.status === "out_of_stock"
    ).length;

    // 통계 업데이트 (HTML에 통계 섹션이 있다면)
    const statsElements = {
      total: document.querySelector('[data-stat="total"]'),
      active: document.querySelector('[data-stat="active"]'),
      inactive: document.querySelector('[data-stat="inactive"]'),
      outOfStock: document.querySelector('[data-stat="out_of_stock"]'),
    };

    if (statsElements.total) statsElements.total.textContent = totalProducts;
    if (statsElements.active) statsElements.active.textContent = activeProducts;
    if (statsElements.inactive)
      statsElements.inactive.textContent = inactiveProducts;
    if (statsElements.outOfStock)
      statsElements.outOfStock.textContent = outOfStockProducts;
  }

  getProductImageHtml(product) {
    const imageUrl = this.extractImageUrl(product.image_url);
    
    if (!imageUrl) {
      return "📦";
    }

    return `<img src="${imageUrl}" alt="${product.name}" loading="lazy" onerror="this.style.display='none'; this.parentElement.innerHTML='📦';">`;
  }

  // 이미지 URL 추출 및 정리 함수
  extractImageUrl(imageData) {
    if (!imageData) {
      return null;
    }

    // 문자열로 변환 후 trim
    const imageStr = String(imageData).trim();
    
    if (!imageStr || imageStr === '[]' || imageStr === 'null' || imageStr === 'undefined') {
      return null;
    }

    // JSON 배열 형태인지 확인 (대괄호로 시작하는 경우)
    if (imageStr.startsWith('[') && imageStr.endsWith(']')) {
      try {
        const images = JSON.parse(imageStr);
        if (Array.isArray(images) && images.length > 0) {
          const firstImage = String(images[0]).trim();
          return this.isValidImageUrl(firstImage) ? firstImage : null;
        }
      } catch (e) {
        console.warn('JSON 파싱 실패:', imageStr.substring(0, 100) + '...', e);
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
    
    // 빈 문자열이나 특수 값들 체크
    if (!trimmedUrl || trimmedUrl === '[]' || trimmedUrl === 'null' || trimmedUrl === 'undefined') {
      return false;
    }

    // URL 형태 체크 (http, https, 상대 경로, 또는 Base64 데이터 URL)
    return trimmedUrl.startsWith('http://') || 
           trimmedUrl.startsWith('https://') || 
           trimmedUrl.startsWith('/') ||
           trimmedUrl.startsWith('./') ||
           trimmedUrl.startsWith('../') ||
           trimmedUrl.startsWith('data:image/');
  }

  getCategoryName(category) {
    const categories = {
      health_functional_food: "건강기능식품",
      protein_food: "단백질 식품",
      healthy_snack: "건강 간식",
      healthy_juice: "건강 주스",
      home_meal_replacement: "가정간편식",
      side_dish: "반찬",
      salad: "샐러드",
      fruit: "과일",
      meat: "정육/계란",
      seafood: "수산/해산",
    };
    return categories[category] || category;
  }

  getStatusName(status) {
    const statuses = {
      active: "판매중",
      inactive: "판매중지",
      out_of_stock: "품절",
    };
    return statuses[status] || status;
  }

  // 제품 관련 이벤트 리스너 추가
  attachProductEventListeners() {
    // 체크박스 이벤트
    document.querySelectorAll(".product-checkbox").forEach((checkbox) => {
      checkbox.addEventListener("change", (e) => {
        const productId = e.target.dataset.productId;
        this.toggleProductSelection(productId, e.target.checked);
      });
    });

    // 수정 버튼 이벤트
    document.querySelectorAll(".edit-product-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const productId = e.target.dataset.productId;
        window.location.href = `admin-product-form.html?id=${productId}`;
      });
    });

    // 삭제 버튼 이벤트
    document.querySelectorAll(".delete-product-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const productId = e.target.dataset.productId;
        this.deleteProduct(productId);
      });
    });

    // 카드 클릭 시 상세페이지 이동 (체크박스/수정/삭제 영역 제외)
    document.querySelectorAll(".product-card").forEach((card) => {
      card.addEventListener("click", (e) => {
        const target = e.target;
        const isInActionArea =
          target.closest(".product-actions") ||
          target.closest(".product-select") ||
          target.closest(".product-checkbox") ||
          target.closest("button") ||
          target.closest("a") ||
          target.tagName.toLowerCase() === "input";
        if (isInActionArea) return;

        const productId = card.dataset.productId;
        if (productId) {
          window.open(`product-detail.html?id=${productId}`, '_blank');
        }
      });
    });

    // 전체 선택 이벤트 (테이블 뷰)
    const selectAllTable = document.getElementById("selectAllTable");
    if (selectAllTable) {
      selectAllTable.addEventListener("change", (e) => {
        this.toggleSelectAll(e.target.checked);
      });
    }
  }

  showNotification(message, type = "info") {
    // 간단한 알림 표시
    const notification = document.createElement("div");
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 6px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;

    switch (type) {
      case "success":
        notification.style.backgroundColor = "#28a745";
        break;
      case "error":
        notification.style.backgroundColor = "#dc3545";
        break;
      case "warning":
        notification.style.backgroundColor = "#ffc107";
        notification.style.color = "#212529";
        break;
      default:
        notification.style.backgroundColor = "#17a2b8";
    }

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = "slideOut 0.3s ease";
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 3000);
  }

  // 테스트 데이터 정리 기능 제거됨
}

// 페이지 로드 시 초기화
let adminManager;
document.addEventListener("DOMContentLoaded", () => {
  adminManager = new AdminProductManager();
});

// CSS 애니메이션 추가
const style = document.createElement("style");
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);
// 상품 문의 관리 기능 추가
class InquiryManager {
  constructor() {
    this.inquiries = [];
    this.currentInquiry = null;
    this.adminId = null; // 관리자 ID 저장
    this.init();
  }

  async init() {
    await this.loadAdminUser(); // 관리자 정보 먼저 로드
    await this.loadInquiries();
    this.bindInquiryEvents();
    this.updateInquiryStats();
  }

  async loadAdminUser() {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        if (data.loggedIn && data.user) {
          this.adminId = data.user.id;
          console.log('로그인된 관리자 ID:', this.adminId);
        } else {
          console.error('관리자 정보를 가져올 수 없습니다.');
          alert('세션이 만료되었거나 로그인 상태가 아닙니다. 다시 로그인해주세요.');
          window.location.href = 'login.html';
        }
      } else {
        throw new Error('Failed to fetch admin user');
      }
    } catch (error) {
      console.error('관리자 정보 로드 실패:', error);
      alert('관리자 정보를 불러오는 데 실패했습니다. 다시 로그인해주세요.');
      window.location.href = 'login.html';
    }
  }

  bindInquiryEvents() {
    // 문의 카드 클릭 이벤트
    const inquiryCard = document.getElementById("inquiryCard");
    if (inquiryCard) {
      inquiryCard.addEventListener("click", () => {
        this.showInquiryModal();
      });
    }

    // 문의 모달 닫기
    const inquiryModalClose = document.getElementById("inquiryModalClose");
    if (inquiryModalClose) {
      inquiryModalClose.addEventListener("click", () => {
        this.hideInquiryModal();
      });
    }

    // 문의 모달 배경 클릭으로 닫기
    const inquiryModal = document.getElementById("inquiryModal");
    if (inquiryModal) {
      inquiryModal.addEventListener("click", (e) => {
        if (e.target === inquiryModal) {
          this.hideInquiryModal();
        }
      });
    }

    // 답변 모달 닫기
    const answerModalClose = document.getElementById("answerModalClose");
    if (answerModalClose) {
      answerModalClose.addEventListener("click", () => {
        this.hideAnswerModal();
      });
    }

    // 답변 모달 배경 클릭으로 닫기
    const answerModal = document.getElementById("answerModal");
    if (answerModal) {
      answerModal.addEventListener("click", (e) => {
        if (e.target === answerModal) {
          this.hideAnswerModal();
        }
      });
    }

    // 답변 취소
    const answerCancel = document.getElementById("answerCancel");
    if (answerCancel) {
      answerCancel.addEventListener("click", () => {
        this.hideAnswerModal();
      });
    }

    // 답변 제출
    const answerSubmit = document.getElementById("answerSubmit");
    if (answerSubmit) {
      answerSubmit.addEventListener("click", () => {
        this.submitAnswer();
      });
    }

    // 문의 필터링
    const inquiryStatusFilter = document.getElementById("inquiryStatusFilter");
    if (inquiryStatusFilter) {
      inquiryStatusFilter.addEventListener("change", () => {
        this.renderInquiries();
      });
    }

    const inquirySearchInput = document.getElementById("inquirySearchInput");
    if (inquirySearchInput) {
      inquirySearchInput.addEventListener("input", () => {
        this.renderInquiries();
      });
    }
  }

  async loadInquiries() {
    try {
      const response = await fetch("/api/product-inquiries");
      if (response.ok) {
        this.inquiries = await response.json();
        console.log(`Supabase에서 ${this.inquiries.length}개 문의 로드 완료`);
      } else {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error("문의 데이터 로드 실패:", error);
      this.inquiries = [];
      // 사용자에게 오류 알림
      if (document.getElementById("inquiryList")) {
        document.getElementById("inquiryList").innerHTML = `
                    <div class="error-state">
                        <div class="error-icon">⚠️</div>
                        <h3>데이터 로드 실패</h3>
                        <p>상품 문의 데이터를 불러올 수 없습니다.</p>
                        <button class="retry-btn" onclick="inquiryManager.loadInquiries().then(() => inquiryManager.renderInquiries())">다시 시도</button>
                    </div>
                `;
      }
    }
  }

  updateInquiryStats() {
    const pendingCount = this.inquiries.filter(
      (inquiry) => inquiry.status === "pending"
    ).length;
    const totalCount = this.inquiries.length;

    const pendingElement = document.querySelector(
      '[data-stat="pending_inquiries"]'
    );
    const totalElement = document.querySelector(
      '[data-stat="total_inquiries"]'
    );

    if (pendingElement) {
      pendingElement.textContent = pendingCount;
    }
    if (totalElement) {
      totalElement.textContent = totalCount;
    }
  }

  showInquiryModal() {
    const modal = document.getElementById("inquiryModal");
    if (modal) {
      modal.classList.add("active");
      this.renderInquiries();
    }
  }

  hideInquiryModal() {
    const modal = document.getElementById("inquiryModal");
    if (modal) {
      modal.classList.remove("active");
    }
  }

  showAnswerModal(inquiry) {
    this.currentInquiry = inquiry;
    const modal = document.getElementById("answerModal");
    const detailsContainer = document.getElementById("inquiryDetails");
    const answerText = document.getElementById("answerText");

    if (modal && detailsContainer && answerText) {
      // 문의 상세 정보 표시
      detailsContainer.innerHTML = `
                <h4>
                    ${inquiry.productName}
                    ${inquiry.productId ? `<a href="product-detail.html?id=${inquiry.productId}" target="_blank" class="product-link">(제품 보기)</a>` : ''}
                </h4>
                <div class="customer-info">
                    <span><strong>고객:</strong> ${inquiry.userName}</span>
                    <span><strong>문의 제목:</strong> ${inquiry.title}</span>
                    <span><strong>문의일:</strong> ${this.formatDate(
                      inquiry.createdAt
                    )}</span>
                </div>
                <div class="question-text">
                    ${inquiry.question}
                </div>
            `;

      // 기존 답변이 있으면 표시
      answerText.value = inquiry.answer || "";

      modal.classList.add("active");
    }
  }

  hideAnswerModal() {
    const modal = document.getElementById("answerModal");
    if (modal) {
      modal.classList.remove("active");
    }
    this.currentInquiry = null;
  }

  async submitAnswer() {
    if (!this.currentInquiry) return;

    const answerText = document.getElementById("answerText");
    if (!answerText || !answerText.value.trim()) {
      alert("답변 내용을 입력해주세요.");
      return;
    }

    if (!this.adminId) {
      alert("관리자 ID를 찾을 수 없습니다. 다시 로그인해주세요.");
      return;
    }

    try {
      // 서버에 답변 업데이트 요청
      const response = await fetch(
        `/api/product-inquiries/${this.currentInquiry.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            answer: answerText.value.trim(),
            status: "answered",
            adminId: this.adminId,
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();

        // 로컬 데이터 업데이트
        const inquiryIndex = this.inquiries.findIndex(
          (inq) => inq.id === this.currentInquiry.id
        );
        if (inquiryIndex !== -1) {
          this.inquiries[inquiryIndex] = result.inquiry;
        }

        alert("답변이 등록되었습니다.");
        this.hideAnswerModal();
        this.renderInquiries();
        this.updateInquiryStats();
      } else {
        throw new Error("서버 응답 오류");
      }
    } catch (error) {
      console.error("답변 등록 실패:", error);
      alert("답변 등록에 실패했습니다.");
    }
  }

  renderInquiries() {
    const inquiryList = document.getElementById("inquiryList");
    const statusFilter = document.getElementById("inquiryStatusFilter");
    const searchInput = document.getElementById("inquirySearchInput");

    if (!inquiryList) return;

    let filteredInquiries = [...this.inquiries];

    // 상태 필터링
    if (statusFilter && statusFilter.value) {
      filteredInquiries = filteredInquiries.filter(
        (inquiry) => inquiry.status === statusFilter.value
      );
    }

    // 검색 필터링
    if (searchInput && searchInput.value.trim()) {
      const searchTerm = searchInput.value.trim().toLowerCase();
      filteredInquiries = filteredInquiries.filter(
        (inquiry) =>
          inquiry.productName.toLowerCase().includes(searchTerm) ||
          inquiry.userName.toLowerCase().includes(searchTerm) ||
          inquiry.title.toLowerCase().includes(searchTerm) ||
          inquiry.question.toLowerCase().includes(searchTerm)
      );
    }

    // 최신순 정렬
    filteredInquiries.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    if (filteredInquiries.length === 0) {
      inquiryList.innerHTML = `
                <div class="empty-inquiries">
                    <div class="empty-icon">💬</div>
                    <p>표시할 문의가 없습니다.</p>
                </div>
            `;
      return;
    }

    inquiryList.innerHTML = filteredInquiries
      .map(
        (inquiry) => `
            <div class="inquiry-item ${
              inquiry.status
            }" onclick="inquiryManager.showAnswerModal(${JSON.stringify(
          inquiry
        ).replace(/"/g, "&quot;")})">
                <div class="inquiry-header">
                    <div class="inquiry-product">${inquiry.productName}</div>
                    <div class="inquiry-status ${inquiry.status}">
                        ${inquiry.status === "pending" ? "미답변" : "답변완료"}
                    </div>
                </div>
                <div class="inquiry-customer">
                    <strong>${inquiry.title}</strong> - ${inquiry.userName}
                </div>
                <div class="inquiry-question">
                    ${inquiry.question}
                </div>
                <div class="inquiry-date">
                    ${this.formatDate(inquiry.createdAt)}
                    ${
                      inquiry.answeredAt
                        ? ` • 답변: ${this.formatDate(inquiry.answeredAt)}`
                        : ""
                    }
                </div>
            </div>
        `
      )
      .join("");
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return "오늘";
    } else if (diffDays === 2) {
      return "어제";
    } else if (diffDays <= 7) {
      return `${diffDays - 1}일 전`;
    } else {
      return date.toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
  }
}

// 문의 관리자 인스턴스 생성
let inquiryManager;

// DOM 로드 완료 후 관리자들 초기화
document.addEventListener("DOMContentLoaded", () => {
  // 기존 제품 관리자가 있다면 문의 관리자도 함께 초기화
  if (typeof AdminProductManager !== "undefined") {
    inquiryManager = new InquiryManager();
  } else {
    // 제품 관리자가 없는 경우에도 문의 관리자는 초기화
    inquiryManager = new InquiryManager();
  }
});
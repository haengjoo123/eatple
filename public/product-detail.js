/**
 * 제품 상세페이지 JavaScript
 */

class ProductDetail {
  constructor() {
    this.productId = null;
    this.product = null;
    this.currentQuantity = 1;
    this.currentImageIndex = 0;
    this.images = [];
    this.qnaData = [];
    this.currentQnaStatus = "all";
    this.currentPage = 1;
    this.itemsPerPage = 10;
    this.isLoggedIn = false;

    this.init();
  }

  async init() {
    // URL에서 제품 ID 추출
    this.productId = this.getProductIdFromUrl();

    if (!this.productId) {
      this.showError("제품을 찾을 수 없습니다.");
      return;
    }

    // 로그인 상태 확인
    await this.checkLoginStatus();

    await this.loadProduct();
    await this.loadQnaData();
    await this.loadInitialReviewStats(); // 초기 리뷰 통계 로드
    this.setupEventListeners();
    this.updateCartCount();
    await this.updateInquiryButtonsState();

    // 추가로 1초 후에 다시 한 번 버튼 상태 업데이트 (완전한 로드 보장)
    setTimeout(async () => {
      await this.updateInquiryButtonsState();
    }, 1000);
  }

  getProductIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get("id");

    return id;
  }

  async checkLoginStatus() {
    // 직접 API 호출로 로그인 상태 확인 (더 안정적)
    try {
      const response = await fetch("/api/auth/me", {
        credentials: "include",
      });
      const data = await response.json();

      if (data.loggedIn && data.user) {
        this.isLoggedIn = true;
        console.log("로그인 상태 확인 성공:", data.user);
      } else {
        this.isLoggedIn = false;
        console.log("비로그인 상태 확인");
      }
    } catch (error) {
      console.error("로그인 상태 확인 실패:", error);
      this.isLoggedIn = false;
    }
  }

  async loadProduct() {
    try {
      // API에서 제품 정보 로드 시도
      const response = await fetch(`/api/shop/products/${this.productId}`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          this.product = data.data;
          this.renderProduct();

          // 상품 조회수 추적 API 호출
          await this.trackProductView();

          return;
        }
      }

      // API 실패 시 fallback 데이터 사용
      this.loadFallbackProduct();
    } catch (error) {
      console.error("제품 로드 오류:", error);
      this.loadFallbackProduct();
    }
  }

  loadFallbackProduct() {
    // 폴백 데이터 사용하지 않음 - 제품이 없을 때는 빈 상태로 설정
    console.log("폴백 데이터 사용하지 않음 - 제품을 찾을 수 없습니다");
    this.product = null;
    this.showError("요청하신 제품을 찾을 수 없습니다.");
  }

  renderProduct() {
    if (!this.product) return;

    console.log("제품 렌더링 시작:", this.product.name);
    console.log("이미지 URL:", this.product.image_url ? "있음" : "없음");

    // 브레드크럼 업데이트
    document.getElementById("categoryBreadcrumb").textContent =
      this.getCategoryName(this.product.category);
    document.getElementById("productBreadcrumb").textContent =
      this.product.name;

    // 제품 정보 렌더링
    document.getElementById("productTitle").textContent = this.product.name;
    document.getElementById("productSummary").textContent =
      this.product.summary || "제품 상세 정보를 확인해보세요.";

    // 브랜드 및 배송비 정보
    document.getElementById("productBrand").textContent =
      this.product.brand || "기본브랜드";
    document.getElementById("productShippingFee").textContent =
      this.formatPrice(this.product.shipping_fee || 3000); // snake_case 사용

    // 가격 정보
    document.getElementById("currentPrice").textContent = this.formatPrice(
      this.product.price
    );

    if (
      this.product.originalPrice &&
      this.product.originalPrice > this.product.price
    ) {
      document.getElementById("originalPrice").textContent = this.formatPrice(
        this.product.originalPrice
      );
      const discountRate = Math.round(
        ((this.product.originalPrice - this.product.price) /
          this.product.originalPrice) *
          100
      );
      document.getElementById(
        "discountRate"
      ).textContent = `${discountRate}%`;
    } else {
      document.getElementById("originalPrice").style.display = "none";
      document.getElementById("discountRate").style.display = "none";
    }

    // 평점 정보 (초기에는 로딩 상태로 표시)
    this.renderRating(0, 0, true); // 세 번째 매개변수는 로딩 상태

    // 이미지 갤러리
    this.renderImageGallery();

    // 제품 설명
    this.renderProductDescription();

    // 총 가격 업데이트
    this.updateTotalPrice();

    // 모바일 모달 내용 업데이트
    this.updateMobileModalContent();

    // 페이지 제목 업데이트
    document.title = `${this.product.name} - 잇플 스토어`;
  }

  getCategoryName(category) {
    const categoryNames = {
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
    return categoryNames[category] || "기타";
  }

  renderRating(rating, reviewCount, isLoading = false) {
    const starsContainer = document.getElementById("productStars");
    const ratingText = document.getElementById("ratingText");

    if (isLoading) {
      // 로딩 상태
      starsContainer.innerHTML = "☆☆☆☆☆";
      ratingText.textContent = "(평점 로딩 중...)";
      return;
    }

    starsContainer.innerHTML = "";

    for (let i = 1; i <= 5; i++) {
      const star = document.createElement("span");
      star.className = "star";
      star.textContent = i <= rating ? "★" : "☆";
      starsContainer.appendChild(star);
    }

    if (reviewCount === 0) {
      ratingText.textContent = "(아직 리뷰가 없습니다)";
    } else {
      ratingText.textContent = `(${rating}) ${reviewCount}개 리뷰`;
    }
  }

  renderImageGallery() {
    const mainImage = document.getElementById("mainProductImage");
    const thumbnailList = document.getElementById("thumbnailList");

    // API 데이터 구조에 맞게 이미지 처리
    if (this.product.images && Array.isArray(this.product.images)) {
      // fallback 데이터의 경우 (images 배열)
      this.images = this.product.images;
    } else if (this.product.image_url) {
      // API 데이터의 경우 - JSON 문자열일 수 있음
      try {
        // JSON 배열로 파싱 시도
        const parsedImages = JSON.parse(this.product.image_url);
        if (Array.isArray(parsedImages)) {
          this.images = parsedImages;
        } else {
          // 단일 URL인 경우
          this.images = [this.product.image_url];
        }
      } catch (e) {
        // JSON 파싱 실패 시 단일 URL로 처리
        this.images = [this.product.image_url];
      }
    } else {
      // 이미지가 없는 경우
      this.images = [];
    }

    console.log("처리된 이미지 배열:", this.images);

    // 이미지가 없거나 base64 데이터인 경우 기본 이미지 사용
    const hasValidImages =
      this.images.length > 0 &&
      this.images.some((img) => img && !img.startsWith("data:image"));

    if (!hasValidImages) {
      this.showPlaceholderImage(mainImage);
      thumbnailList.innerHTML = "";
      return;
    }

    // 유효한 이미지만 필터링
    this.images = this.images.filter(
      (img) => img && !img.startsWith("data:image")
    );

    // 메인 이미지 설정 및 에러 처리
    mainImage.style.display = "block";
    mainImage.onerror = () => {
      console.warn(
        "메인 이미지 로드 실패:",
        this.images[this.currentImageIndex]
      );
      this.showPlaceholderImage(mainImage);
    };
    mainImage.onload = () => {
      console.log("메인 이미지 로드 성공:", mainImage.src);
    };

    // 절대 URL로 변환 (상대 경로인 경우)
    const imageUrl = this.images[0].startsWith("http")
      ? this.images[0]
      : `${window.location.origin}${this.images[0]}`;
    mainImage.src = imageUrl;
    mainImage.alt = this.product.name;

    // 썸네일 생성
    thumbnailList.innerHTML = "";
    this.images.forEach((image, index) => {
      const thumbnail = document.createElement("div");
      thumbnail.className = `thumbnail ${index === 0 ? "active" : ""}`;

      const thumbnailImg = document.createElement("img");
      const thumbnailUrl = image.startsWith("http")
        ? image
        : `${window.location.origin}${image}`;
      thumbnailImg.src = thumbnailUrl;
      thumbnailImg.alt = `제품 이미지 ${index + 1}`;
      thumbnailImg.onerror = () => {
        this.showPlaceholderThumbnail(thumbnailImg);
      };

      thumbnail.appendChild(thumbnailImg);
      thumbnail.addEventListener("click", () => this.changeMainImage(index));
      thumbnailList.appendChild(thumbnail);
    });
  }

  showPlaceholderImage(imgElement) {
    // 기본 이미지 생성
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = 500;
    canvas.height = 500;

    // 배경색 설정
    ctx.fillStyle = "#f8f9fa";
    ctx.fillRect(0, 0, 500, 500);

    // 테두리 설정
    ctx.strokeStyle = "#e0e0e0";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, 500, 500);

    // 텍스트 설정
    ctx.fillStyle = "#666";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "16px Arial";
    ctx.fillText("제품 이미지", 250, 250);

    imgElement.src = canvas.toDataURL();
    imgElement.alt = this.product.name;
    imgElement.style.display = "block";
  }

  showPlaceholderThumbnail(imgElement) {
    // 썸네일용 placeholder 생성
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = 80;
    canvas.height = 80;

    ctx.fillStyle = "#f8f9fa";
    ctx.fillRect(0, 0, 80, 80);
    ctx.strokeStyle = "#e0e0e0";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, 80, 80);
    ctx.fillStyle = "#666";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "12px Arial";
    ctx.fillText("X", 40, 40);

    imgElement.src = canvas.toDataURL();
  }

  changeMainImage(index) {
    if (index < 0 || index >= this.images.length) return;

    this.currentImageIndex = index;

    // 메인 이미지 변경
    const mainImage = document.getElementById("mainProductImage");
    mainImage.onerror = () => {
      console.warn("메인 이미지 로드 실패:", this.images[index]);
      this.showPlaceholderImage(mainImage);
    };
    mainImage.onload = () => {
      console.log("메인 이미지 변경 성공:", mainImage.src);
    };

    // 절대 URL로 변환
    const imageUrl = this.images[index].startsWith("http")
      ? this.images[index]
      : `${window.location.origin}${this.images[index]}`;
    mainImage.src = imageUrl;

    // 썸네일 활성 상태 변경
    const thumbnails = document.querySelectorAll(".thumbnail");
    thumbnails.forEach((thumb, i) => {
      thumb.classList.toggle("active", i === index);
    });
  }

  renderProductDescription() {
    const descriptionContainer = document.getElementById("productDescription");

    if (this.product.description) {
      // API에서 온 HTML 설명을 그대로 사용
      descriptionContainer.innerHTML = this.product.description;
    } else {
      descriptionContainer.innerHTML = `
                <div class="loading-placeholder">
                    <p>제품 상세 정보가 준비 중입니다.</p>
                </div>
            `;
    }
  }

  setupEventListeners() {
    // 수량 조절 버튼
    const decreaseBtn = document.getElementById("decreaseQty");
    const increaseBtn = document.getElementById("increaseQty");
    const quantityInput = document.getElementById("quantityInput");

    decreaseBtn.addEventListener("click", () => this.changeQuantity(-1));
    increaseBtn.addEventListener("click", () => this.changeQuantity(1));
    quantityInput.addEventListener("change", (e) => {
      this.currentQuantity = Math.max(
        1,
        Math.min(10, parseInt(e.target.value) || 1)
      );
      this.updateQuantityDisplay();
      this.updateTotalPrice();
    });

    // 장바구니 담기 버튼
    const addToCartBtn = document.getElementById("addToCartBtn");
    addToCartBtn.addEventListener("click", () => this.addToCart());

    // 바로 구매 버튼
    const buyNowBtn = document.getElementById("buyNowBtn");
    buyNowBtn.addEventListener("click", () => this.buyNow());

    // 탭 버튼들
    const tabBtns = document.querySelectorAll(".tab-btn");
    tabBtns.forEach((btn) => {
      btn.addEventListener("click", (e) =>
        this.switchTab(e.target.dataset.tab)
      );
    });

    // Q&A 관련 이벤트 리스너 추가
    this.setupQnaEventListeners();

    // 마이페이지 관련 이벤트 리스너 추가
    this.setupMypageEventListeners();

    // 모바일 하단 고정 섹션 이벤트 리스너 추가
    this.setupMobilePurchaseBar();

    // 장바구니 성공 모달 이벤트 리스너 추가
    this.setupCartSuccessModal();
  }

  changeQuantity(delta) {
    this.currentQuantity = Math.max(
      1,
      Math.min(10, this.currentQuantity + delta)
    );
    this.updateQuantityDisplay();
    this.updateTotalPrice();
  }

  updateQuantityDisplay() {
    const quantityInput = document.getElementById("quantityInput");
    quantityInput.value = this.currentQuantity;
  }

  updateTotalPrice() {
    if (!this.product) return;

    const totalPrice = this.product.price * this.currentQuantity;
    document.getElementById("totalPrice").textContent =
      this.formatPrice(totalPrice);
  }

  formatPrice(price) {
    return new Intl.NumberFormat("ko-KR").format(price) + "원";
  }

  async addToCart() {
    if (!this.product) return;

    try {
      // 로컬 스토리지에서 장바구니 가져오기 (cart.js와 동일한 키 사용)
      let cart = JSON.parse(localStorage.getItem("eatple_cart") || "[]");

      // 기존 상품이 있는지 확인
      const existingItemIndex = cart.findIndex(
        (item) => item.id === this.product.id
      );

      if (existingItemIndex >= 0) {
        // 기존 상품의 수량 업데이트
        cart[existingItemIndex].quantity += this.currentQuantity;
      } else {
        // 디버깅: 상품 이미지 데이터 확인
        console.log("상품 데이터:", this.product);
        console.log("상품 이미지 배열:", this.product.images);
        console.log("상품 이미지 URL:", this.product.image_url);

        const imageToSave =
          this.product.images?.[0] || this.product.image_url || "";
        console.log("장바구니에 저장될 이미지:", imageToSave);

        // 새 상품 추가 (cart.js와 동일한 구조)
        cart.push({
          id: this.product.id,
          name: this.product.name,
          price: this.product.price,
          originalPrice: this.product.originalPrice,
          image: imageToSave,
          brand: this.product.brand || '', // 브랜드 정보 추가
          shippingFee: this.product.shipping_fee || 3000, // 배송비 정보 추가
          quantity: this.currentQuantity,
          selected: true, // cart.js에서 사용하는 필드
        });
      }

      // 장바구니 저장 (cart.js와 동일한 키 사용)
      localStorage.setItem("eatple_cart", JSON.stringify(cart));

      // 장바구니 카운트 업데이트
      this.updateCartCount();

      // 모바일에서는 모달 표시, 데스크톱에서는 toast 메시지 표시
      if (window.innerWidth <= 480) {
        this.showCartSuccessModal();
      } else {
        this.showMessage("장바구니에 상품이 추가되었습니다.", "success");
      }
    } catch (error) {
      console.error("장바구니 추가 오류:", error);
      this.showMessage("장바구니 추가 중 오류가 발생했습니다.", "error");
    }
  }

  buyNow() {
    // 장바구니에 추가 후 결제 페이지로 이동
    this.addToCart().then(() => {
      window.location.href = "cart.html";
    });
  }

  updateCartCount() {
    try {
      // cart.js와 동일한 키와 계산 방식 사용
      const cart = JSON.parse(localStorage.getItem("eatple_cart") || "[]");

      // 제품 종류 수 기준으로 카운트 (cart.js와 동일한 방식)
      let productTypesCount = 0;
      if (Array.isArray(cart) && cart.length > 0) {
        const hasAllIds = cart.every(
          (item) => item && typeof item.id !== "undefined" && item.id !== null
        );
        if (hasAllIds) {
          productTypesCount = new Set(cart.map((item) => item.id)).size;
        } else {
          const uniqueKeys = new Set(
            cart.map(
              (item) => item && (item.id ?? item.name ?? JSON.stringify(item))
            )
          );
          productTypesCount = uniqueKeys.size;
        }
      }

      const cartCountElements = document.querySelectorAll(".cart-count");
      cartCountElements.forEach((el) => {
        el.textContent = String(productTypesCount);
      });
    } catch (error) {
      console.error("장바구니 카운트 업데이트 오류:", error);
    }
  }

  switchTab(tabName) {
    // 모든 탭 버튼과 콘텐츠 비활성화
    document
      .querySelectorAll(".tab-btn")
      .forEach((btn) => btn.classList.remove("active"));
    document
      .querySelectorAll(".tab-content")
      .forEach((content) => content.classList.remove("active"));

    // 선택된 탭 활성화
    document.querySelector(`[data-tab="${tabName}"]`).classList.add("active");
    document.getElementById(`${tabName}-tab`).classList.add("active");

    // 리뷰 탭이 선택되면 리뷰 로드
    if (tabName === "reviews") {
      this.loadReviews();
    }
  }

  async loadInitialReviewStats() {
    try {
      // API에서 리뷰 데이터 로드하여 상품 상세 정보의 평점 업데이트
      const response = await fetch(
        `/api/shop/products/${this.productId}/reviews`,
        {
          credentials: "include",
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          // 상품 상세 정보의 평점만 업데이트 (리뷰 목록은 탭 클릭 시 로드)
          if (data.data.length > 0) {
            const totalRating = data.data.reduce(
              (sum, review) => sum + review.rating,
              0
            );
            const averageRating = (totalRating / data.data.length).toFixed(1);
            this.renderRating(parseFloat(averageRating), data.data.length);
          } else {
            this.renderRating(0, 0);
          }
          return;
        }
      }
    } catch (error) {
      console.error("초기 리뷰 통계 로드 오류:", error);
    }

    // API 실패 시 기본값 표시
    this.renderRating(0, 0);
  }

  async loadReviews() {
    const reviewsList = document.getElementById("reviewsList");

    try {
      // API에서 리뷰 데이터 로드 시도
      const response = await fetch(
        `/api/shop/products/${this.productId}/reviews`,
        {
          credentials: "include",
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data && data.data.length > 0) {
          // 리뷰가 있는 경우
          this.updateReviewStats(data.data);
          this.renderReviews(data.data);
          return;
        }
      }
    } catch (error) {
      console.error("리뷰 로드 오류:", error);
    }

    // API 실패하거나 리뷰가 없는 경우 빈 상태 표시
    this.updateReviewStats([]);
    this.renderEmptyReviews();
  }

  updateReviewStats(reviews) {
    const ratingNumberEl = document.querySelector(".rating-number");
    const ratingStarsEl = document.querySelector(".rating-stars");
    const reviewCountEl = document.querySelector(".review-count");

    if (reviews.length === 0) {
      // 리뷰가 없는 경우
      ratingNumberEl.textContent = "0.0";
      ratingStarsEl.innerHTML = "☆☆☆☆☆";
      reviewCountEl.textContent = "(0개 리뷰)";

      // 상품 상세 정보의 평점도 업데이트
      this.renderRating(0, 0);
    } else {
      // 평균 평점 계산
      const totalRating = reviews.reduce(
        (sum, review) => sum + review.rating,
        0
      );
      const averageRating = (totalRating / reviews.length).toFixed(1);

      // 별점 표시 (소수점 반영)
      const fullStars = Math.floor(averageRating);
      const hasHalfStar = averageRating % 1 >= 0.5;
      const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

      let starsHtml = "★".repeat(fullStars);
      if (hasHalfStar) {
        starsHtml += "☆"; // 반별은 빈별로 표시 (간단하게)
      }
      starsHtml += "☆".repeat(emptyStars);

      // 리뷰 탭의 통계 업데이트
      ratingNumberEl.textContent = averageRating;
      ratingStarsEl.innerHTML = starsHtml;
      reviewCountEl.textContent = `(${reviews.length}개 리뷰)`;

      // 상품 상세 정보의 평점도 업데이트
      this.renderRating(parseFloat(averageRating), reviews.length);
    }
  }

  renderReviews(reviews) {
    const reviewsList = document.getElementById("reviewsList");

    reviewsList.innerHTML = reviews
      .map(
        (review) => `
            <div class="review-item">
                <div class="review-header">
                    <span class="reviewer-name">${this.maskUserName(
                      review.userName || review.user_name
                    )}</span>
                    <span class="review-date">${this.formatDate(
                      review.date || review.created_at
                    )}</span>
                </div>
                <div class="review-rating">
                    ${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}
                </div>
                <div class="review-content">${review.content}</div>
            </div>
        `
      )
      .join("");
  }

  renderEmptyReviews() {
    const reviewsList = document.getElementById("reviewsList");

    reviewsList.innerHTML = `
      <div class="empty-reviews">
        <p class="empty-reviews-message">아직 등록된 리뷰가 없습니다.</p>
      </div>
    `;
  }

  maskUserName(userName) {
    if (!userName) return "익명";
    if (userName.length <= 2) return userName;
    return (
      userName.charAt(0) +
      "*".repeat(userName.length - 2) +
      userName.charAt(userName.length - 1)
    );
  }

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
      
      return date.toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    } catch (error) {
      console.warn("날짜 파싱 오류:", dateString, error);
      return "날짜 오류";
    }
  }

  // 상품 조회수 추적
  async trackProductView() {
    try {
      console.log("상품 조회수 추적 API 호출:", this.productId);

      const response = await fetch(
        `/api/shop/products/${this.productId}/view`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log("조회수 추적 성공:", data.message);
      } else {
        console.warn("조회수 추적 실패:", response.status);
      }
    } catch (error) {
      console.error("조회수 추적 오류:", error);
      // 조회수 추적 실패해도 페이지 로딩은 계속 진행
    }
  }

  showMessage(message, type = "info") {
    // 간단한 토스트 메시지 표시
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${
              type === "success"
                ? "#4a7c59"
                : type === "error"
                ? "#ff4757"
                : "#333"
            };
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = "slideOut 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
  // Q&A 모달 관련 메서드들
  setupQnaEventListeners() {
    // 문의 버튼 클릭 이벤트
    const inquiryButtons = document.querySelectorAll(".inquiry-btn");
    inquiryButtons.forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const type = e.target.dataset.type;
        await this.openInquiryModal(type);
      });
    });

    // Q&A 탭 전환 이벤트
    const qnaTabs = document.querySelectorAll(".qna-tab-btn");
    qnaTabs.forEach((tab) => {
      tab.addEventListener("click", (e) => {
        const status = e.target.dataset.status;
        this.switchQnaTab(status);
      });
    });

    // 모달 관련 이벤트
    const modal = document.getElementById("inquiryModal");
    const closeBtn = document.getElementById("closeModal");
    const cancelBtn = document.getElementById("cancelInquiry");
    const form = document.getElementById("inquiryForm");

    if (closeBtn)
      closeBtn.addEventListener("click", () => this.closeInquiryModal());
    if (cancelBtn)
      cancelBtn.addEventListener("click", () => this.closeInquiryModal());

    // 모달 배경 클릭시 닫기
    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          this.closeInquiryModal();
        }
      });
    }

    // 폼 제출 이벤트
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        this.submitInquiry();
      });
    }

    // 페이지네이션 이벤트 리스너
    this.setupPaginationEventListeners();
  }

  setupPaginationEventListeners() {
    const prevBtn = document.getElementById("prevPageBtn");
    const nextBtn = document.getElementById("nextPageBtn");

    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        if (this.currentPage > 1) {
          this.currentPage--;
          this.renderQnaList();
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        const filteredData = this.getFilteredQnaData();
        const totalPages = Math.ceil(filteredData.length / this.itemsPerPage);
        if (this.currentPage < totalPages) {
          this.currentPage++;
          this.renderQnaList();
        }
      });
    }
  }

  async openInquiryModal(type) {
    // 실시간으로 로그인 상태 재확인
    await this.checkLoginStatus();

    console.log("문의 버튼 클릭 - 로그인 상태:", this.isLoggedIn);

    // 로그인 상태 확인
    if (!this.isLoggedIn) {
      console.log("비로그인 상태 - 로그인 페이지로 이동");
      this.showLoginRequiredMessage();
      return;
    }

    console.log("로그인 상태 - 모달 열기");
    const modal = document.getElementById("inquiryModal");
    const modalTitle = document.getElementById("modalTitle");

    const titles = {
      product: "상품/배송일정문의",
      return: "취소/교환/반품 문의",
    };

    if (modalTitle) modalTitle.textContent = titles[type] || "문의하기";
    if (modal) modal.classList.add("active");

    // 폼 초기화
    const form = document.getElementById("inquiryForm");
    if (form) form.reset();
  }

  showLoginRequiredMessage() {
    // 로그인 필요 알림 및 로그인 페이지로 이동
    const shouldRedirect = confirm(
      "문의를 작성하려면 로그인이 필요합니다.\n로그인 페이지로 이동하시겠습니까?"
    );

    if (shouldRedirect) {
      // 현재 페이지 URL을 저장하여 로그인 후 돌아올 수 있도록 함
      const currentUrl = encodeURIComponent(window.location.href);
      window.location.href = `login.html?redirect=${currentUrl}`;
    }
  }

  async updateInquiryButtonsState() {
    // 실시간으로 로그인 상태 재확인
    await this.checkLoginStatus();

    console.log("버튼 상태 업데이트 - 현재 로그인 상태:", this.isLoggedIn);

    const inquiryButtons = document.querySelectorAll(".inquiry-btn");

    inquiryButtons.forEach((button) => {
      // 기존 로그인 필요 텍스트 제거
      const loginRequiredSpan = button.querySelector(".login-required-text");
      if (loginRequiredSpan) {
        loginRequiredSpan.remove();
      }

      if (!this.isLoggedIn) {
        button.classList.add("login-required");
        button.title = "로그인이 필요한 기능입니다";

        // 기존 텍스트에 로그인 필요 표시 추가
        const originalText = button.textContent.trim();
        if (!originalText.includes("(로그인 필요)")) {
          button.innerHTML = `${originalText} <span class="login-required-text">(로그인 필요)</span>`;
        }
      } else {
        button.classList.remove("login-required");
        button.title = "";
      }
    });
  }

  closeInquiryModal() {
    const modal = document.getElementById("inquiryModal");
    if (modal) modal.classList.remove("active");
  }

  switchQnaTab(status) {
    // 탭 버튼 활성화 상태 변경
    const tabs = document.querySelectorAll(".qna-tab-btn");
    tabs.forEach((tab) => {
      tab.classList.remove("active");
      if (tab.dataset.status === status) {
        tab.classList.add("active");
      }
    });

    // 현재 상태 업데이트 및 페이지를 1로 초기화
    this.currentQnaStatus = status;
    this.currentPage = 1;
    this.renderQnaList();
  }

  async submitInquiry() {
    // 로그인 상태 재확인
    if (!this.isLoggedIn) {
      this.closeInquiryModal();
      this.showLoginRequiredMessage();
      return;
    }

    const form = document.getElementById("inquiryForm");
    if (!form) return;

    const formData = new FormData(form);

    const inquiryData = {
      productId: this.productId,
      title: formData.get("title"),
      content: formData.get("content"),
      isSecret: formData.get("isSecret") === "on",
      type: document.getElementById("modalTitle")?.textContent || "일반문의",
    };

    try {
      // 실제로는 서버에 문의를 전송해야 함
      console.log("문의 데이터:", inquiryData);

      // 서버에 문의 등록 요청
      const response = await fetch("/api/shop/qna", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inquiryData),
        credentials: "include",
      });

      const result = await response.json();

      if (response.ok && result.success) {
        alert("문의가 등록되었습니다.");
        this.closeInquiryModal();
        this.currentPage = 1; // 새 문의 등록 후 첫 페이지로 이동
        await this.loadQnaData(); // Q&A 목록 새로고침
      } else {
        // 인증 오류인 경우 로그인 페이지로 이동
        if (response.status === 401) {
          this.closeInquiryModal();
          this.showLoginRequiredMessage();
          return;
        }
        throw new Error(result.error || "문의 등록에 실패했습니다.");
      }
    } catch (error) {
      console.error("문의 등록 실패:", error);
      alert("문의 등록에 실패했습니다. 다시 시도해주세요.");
    }
  }

  async loadQnaData() {
    try {
      // 실제 API 호출 시도
      const response = await fetch(`/api/shop/products/${this.productId}/qna`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          this.qnaData = data.data || [];
          this.renderQnaList();
          this.updateQnaCounts();
          return;
        }
      }
    } catch (error) {
      console.log("API 호출 실패, 빈 데이터로 표시:", error);
    }

    // API 실패 시 빈 배열로 설정
    this.qnaData = [];
    this.renderQnaList();
    this.updateQnaCounts();
  }

  renderQnaList() {
    const qnaList = document.getElementById("qnaList");
    const pagination = document.getElementById("qnaPagination");

    if (!qnaList) return;

    if (this.qnaData.length === 0) {
      qnaList.innerHTML = `
        <div class="empty-state">
          <p>아직 문의가 없습니다.</p>
          <p>궁금한 점이 있으시면 언제든 문의해 주세요.</p>
        </div>
      `;
      if (pagination) pagination.style.display = "none";
      return;
    }

    const filteredData = this.getFilteredQnaData();

    if (filteredData.length === 0) {
      qnaList.innerHTML = `
        <div class="empty-state">
          <p>해당 조건의 문의가 없습니다.</p>
        </div>
      `;
      if (pagination) pagination.style.display = "none";
      return;
    }

    // 페이지네이션 계산
    const totalPages = Math.ceil(filteredData.length / this.itemsPerPage);
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const currentPageData = filteredData.slice(startIndex, endIndex);

    // QnA 목록 렌더링
    const qnaHtml = currentPageData
      .map((qna) => {
        // 전체 데이터에서 이 문의의 실제 순서를 찾기 (먼저 문의한 것이 1번)
        const originalIndex = this.qnaData.findIndex(
          (item) => item.id === qna.id
        );
        // 역순 계산: 데이터가 최신순이므로 마지막이 1번, 첫 번째가 가장 큰 번호
        const qnaNumber = this.qnaData.length - originalIndex;

        return `
      <div class="qna-item" data-qna-id="${qna.id}">
        <div class="qna-status ${
          qna.status === "completed" ? "completed" : "waiting"
        }">
          ${qna.status === "completed" ? "답변완료" : "답변대기"}
        </div>
        <div class="qna-content">
          <div class="qna-question">
            ${qna.isSecret ? '<span class="qna-lock">🔒</span>' : ""}
            <span class="qna-text" data-qna-id="${qna.id}">${qna.title}</span>
          </div>
          <div class="qna-meta">
            <span class="qna-author">${this.maskAuthor(qna.author)}</span>
            <span class="qna-date">${this.formatDate(qna.createdAt)}</span>
            <span class="qna-number">No. ${qnaNumber}</span>
          </div>
          <div class="qna-details" id="qna-details-${qna.id}">
            ${
              qna.isSecret
                ? `
              <div class="qna-secret-placeholder">
                <div class="qna-secret-message">
                  <span class="qna-lock-icon">🔒</span>
                  <p>비밀글입니다. 작성자만 내용을 확인할 수 있습니다.</p>
                </div>
              </div>
            `
                : `
              <div class="qna-question-content">
                <div class="qna-question-label">문의 내용</div>
                <div class="qna-question-text">${qna.content}</div>
              </div>
              <div class="qna-answer-content">
                <div class="qna-answer-label">답변</div>
                <div class="qna-answer-text">
                  ${
                    qna.answer_content
                      ? qna.answer_content
                      : '<div class="qna-no-answer">아직 답변이 등록되지 않았습니다.</div>'
                  }
                </div>
              </div>
            `
            }
          </div>
        </div>
      </div>
      `;
      })
      .join("");

    qnaList.innerHTML = qnaHtml;

    // QnA 클릭 이벤트 리스너 추가
    this.setupQnaClickListeners();

    // 페이지네이션 렌더링
    this.renderPagination(totalPages, filteredData.length);
  }

  getFilteredQnaData() {
    // 답변 완료/대기 상태를 `status` 필드 기준으로 통일하여 일관성 보장
    const isCompleted = (qna) => {
      const status = qna.status?.toLowerCase()?.trim();
      return status === "completed" || status === "answered";
    };

    switch (this.currentQnaStatus) {
      case "waiting":
        return this.qnaData.filter((qna) => !isCompleted(qna));
      case "completed":
        return this.qnaData.filter((qna) => isCompleted(qna));
      default:
        return this.qnaData;
    }
  }

  updateQnaCounts() {
    const totalCount = this.qnaData.length;

    // 답변 완료/대기 상태를 `status` 필드 기준으로 통일하여 일관성 보장
    const isCompleted = (qna) => {
      const status = qna.status?.toLowerCase()?.trim();
      return status === "completed" || status === "answered";
    };

    const completedCount = this.qnaData.filter(isCompleted).length;
    const waitingCount = totalCount - completedCount;

    // 제목 업데이트
    const qnaTitle = document.getElementById("qnaTitle");
    if (qnaTitle) {
      qnaTitle.textContent = `상품 Q&A (${totalCount})`;
    }

    // 탭 카운트 업데이트
    const allTab = document.getElementById("allTab");
    const waitingTab = document.getElementById("waitingTab");
    const completedTab = document.getElementById("completedTab");

    if (allTab) allTab.textContent = `전체 (${totalCount})`;
    if (waitingTab) waitingTab.textContent = `답변대기 (${waitingCount})`;
    if (completedTab) completedTab.textContent = `답변완료 (${completedCount})`;
  }

  maskAuthor(author) {
    if (!author || author.length <= 2) return author;
    const firstChar = author.charAt(0);
    const lastChar = author.charAt(author.length - 1);
    const maskedMiddle = "*".repeat(Math.max(0, author.length - 2));
    return firstChar + maskedMiddle + lastChar;
  }

  formatDate(dateString) {
    if (!dateString) return "";
    
    try {
      const date = new Date(dateString);
      
      // Invalid Date 체크
      if (isNaN(date.getTime())) {
        // 다른 형식으로 시도
        const parsedDate = new Date(dateString.replace('T', ' ').replace('Z', ''));
        if (isNaN(parsedDate.getTime())) {
          return "날짜 오류";
        }
        const year = parsedDate.getFullYear();
        const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
        const day = String(parsedDate.getDate()).padStart(2, "0");
        return `${year}.${month}.${day}`;
      }
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}.${month}.${day}`;
    } catch (error) {
      console.warn("날짜 파싱 오류:", dateString, error);
      return "날짜 오류";
    }
  }

  setupQnaClickListeners() {
    // qna-text 클릭 이벤트 리스너 추가
    const qnaTexts = document.querySelectorAll(".qna-text");
    qnaTexts.forEach((qnaText) => {
      qnaText.addEventListener("click", (e) => {
        const qnaId = e.target.dataset.qnaId;
        this.toggleQnaDetails(qnaId);
      });
    });
  }

  async toggleQnaDetails(qnaId) {
    const detailsElement = document.getElementById(`qna-details-${qnaId}`);
    if (!detailsElement) return;

    // 해당 QnA 데이터 찾기
    const qnaItem = this.qnaData.find((qna) => qna.id === qnaId);
    if (!qnaItem) return;

    // 비밀글인 경우 권한 검증
    if (qnaItem.isSecret) {
      // 로그인 상태 재확인
      await this.checkLoginStatus();

      if (!this.isLoggedIn) {
        alert("비밀글을 보려면 로그인이 필요합니다.");
        this.showLoginRequiredMessage();
        return;
      }

      // 작성자 본인인지 확인 (서버에서 검증)
      try {
        console.log("비밀글 접근 권한 확인 요청:", qnaId);
        const response = await fetch(`/api/shop/qna/${qnaId}/access`, {
          method: "GET",
          credentials: "include",
        });

        console.log("응답 상태:", response.status, response.statusText);
        console.log("응답 헤더:", response.headers.get("content-type"));

        const responseText = await response.text();
        console.log("응답 원본:", responseText);

        let result;
        try {
          result = JSON.parse(responseText);
        } catch (parseError) {
          console.error("JSON 파싱 실패:", parseError);
          console.error("응답 내용:", responseText.substring(0, 200));
          throw new Error("서버에서 올바르지 않은 응답을 받았습니다.");
        }

        if (!response.ok || !result.success) {
          if (response.status === 401) {
            alert("로그인이 필요합니다.");
            this.showLoginRequiredMessage();
            return;
          } else if (response.status === 403) {
            alert("작성자만 비밀글을 볼 수 있습니다.");
            return;
          } else {
            alert("비밀글 접근 권한을 확인할 수 없습니다.");
            return;
          }
        }

        // 권한이 확인된 경우 비밀글 내용을 실제 내용으로 교체
        if (result.data) {
          qnaItem.content = result.data.content;
          qnaItem.answer_content = result.data.answer_content;
        }
        this.showSecretQnaContent(qnaId, qnaItem);
      } catch (error) {
        console.error("비밀글 접근 권한 확인 실패:", error);
        alert("비밀글 접근 권한을 확인하는 중 오류가 발생했습니다.");
        return;
      }
    }

    // 현재 상태 확인
    const isVisible = detailsElement.classList.contains("show");

    // 다른 모든 QnA 상세 내용 닫기
    const allDetails = document.querySelectorAll(".qna-details");
    allDetails.forEach((detail) => {
      detail.classList.remove("show");
    });

    // 클릭한 QnA가 이미 열려있지 않았다면 열기
    if (!isVisible) {
      detailsElement.classList.add("show");
    }
  }

  showSecretQnaContent(qnaId, qnaItem) {
    const detailsElement = document.getElementById(`qna-details-${qnaId}`);
    if (!detailsElement) return;

    // 비밀글 placeholder를 실제 내용으로 교체
    detailsElement.innerHTML = `
      <div class="qna-question-content">
        <div class="qna-question-label">문의 내용</div>
        <div class="qna-question-text">${qnaItem.content}</div>
      </div>
      <div class="qna-answer-content">
        <div class="qna-answer-label">답변</div>
        <div class="qna-answer-text">
          ${
            qnaItem.answer_content
              ? qnaItem.answer_content
              : '<div class="qna-no-answer">아직 답변이 등록되지 않았습니다.</div>'
          }
        </div>
      </div>
    `;
  }

  renderPagination(totalPages, totalItems) {
    const pagination = document.getElementById("qnaPagination");
    const paginationNumbers = document.getElementById("paginationNumbers");
    const prevBtn = document.getElementById("prevPageBtn");
    const nextBtn = document.getElementById("nextPageBtn");

    if (!pagination || !paginationNumbers) return;

    // 페이지가 1개 이하면 페이지네이션 숨기기
    if (totalPages <= 1) {
      pagination.style.display = "none";
      return;
    }

    pagination.style.display = "flex";

    // 이전/다음 버튼 상태 업데이트
    if (prevBtn) {
      prevBtn.disabled = this.currentPage <= 1;
    }
    if (nextBtn) {
      nextBtn.disabled = this.currentPage >= totalPages;
    }

    // 페이지 번호 생성
    let paginationHtml = "";
    const maxVisiblePages = 5;
    let startPage = Math.max(
      1,
      this.currentPage - Math.floor(maxVisiblePages / 2)
    );
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    // 끝 페이지가 조정되면 시작 페이지도 다시 조정
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    // 첫 페이지와 ... 표시
    if (startPage > 1) {
      paginationHtml += `<button class="page-number" data-page="1">1</button>`;
      if (startPage > 2) {
        paginationHtml += `<span class="page-ellipsis">...</span>`;
      }
    }

    // 페이지 번호들
    for (let i = startPage; i <= endPage; i++) {
      const isActive = i === this.currentPage ? "active" : "";
      paginationHtml += `<button class="page-number ${isActive}" data-page="${i}">${i}</button>`;
    }

    // 마지막 페이지와 ... 표시
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        paginationHtml += `<span class="page-ellipsis">...</span>`;
      }
      paginationHtml += `<button class="page-number" data-page="${totalPages}">${totalPages}</button>`;
    }

    paginationNumbers.innerHTML = paginationHtml;

    // 페이지 번호 클릭 이벤트 추가
    const pageButtons = paginationNumbers.querySelectorAll(".page-number");
    pageButtons.forEach((button) => {
      button.addEventListener("click", (e) => {
        const page = parseInt(e.target.dataset.page);
        if (page !== this.currentPage) {
          this.currentPage = page;
          this.renderQnaList();
        }
      });
    });
  }

  showError(message) {
    const container = document.querySelector(".container");
    container.innerHTML = `
            <div class="error-state" style="text-align: center; padding: 60px 20px;">
                <h2>오류가 발생했습니다</h2>
                <p>${message}</p>
                <button onclick="history.back()" style="margin-top: 20px; padding: 10px 20px; background: #4a7c59; color: white; border: none; border-radius: 6px; cursor: pointer;">
                    이전 페이지로 돌아가기
                </button>
            </div>
        `;
  }

  // 마이페이지 관련 메서드들
  setupMypageEventListeners() {
    // 유저 버튼 클릭 이벤트
    document.querySelectorAll(".user-btn").forEach((btn) => {
      btn.addEventListener("click", () => this.handleUserButtonClick());
    });

    // 마이페이지 모달 닫기
    const mypageModal = document.getElementById("mypageModal");
    const mypageModalClose = document.getElementById("mypageModalClose");

    if (mypageModalClose) {
      mypageModalClose.onclick = () => (mypageModal.style.display = "none");
    }

    // 마이페이지 탭 이벤트
    document.querySelectorAll(".mypage-tab").forEach((tab) => {
      tab.addEventListener("click", (e) => {
        const tabName = e.target.dataset.tab;
        this.switchMypageTab(tabName);
      });
    });

    // 리뷰 작성 모달 관련 이벤트
    this.setupReviewModalEvents();
  }

  async handleUserButtonClick() {
    try {
      const response = await fetch("/api/auth/me", {
        credentials: "include",
      });
      const data = await response.json();

      if (data.loggedIn) {
        this.openMypage();
      } else {
        // 로그인되지 않은 경우 로그인 페이지로 이동
        window.location.href = "login.html";
      }
    } catch (error) {
      console.error("인증 확인 오류:", error);
      // 오류 발생 시 로그인 페이지로 이동
      window.location.href = "login.html";
    }
  }

  async openMypage() {
    const modal = document.getElementById("mypageModal");
    modal.style.display = "block";

    // 기본적으로 주문내역 탭을 활성화
    this.switchMypageTab("orders");

    // 데이터 로드
    await this.loadMypageData();
  }

  switchMypageTab(tabName) {
    // 모든 탭과 콘텐츠 비활성화
    document.querySelectorAll(".mypage-tab").forEach((tab) => {
      tab.classList.remove("active");
    });
    document.querySelectorAll("#mypageModal .tab-content").forEach((content) => {
      content.classList.remove("active");
    });

    // 선택된 탭과 콘텐츠 활성화
    document.querySelector(`[data-tab="${tabName}"]`).classList.add("active");
    document.getElementById(`${tabName}-tab`).classList.add("active");

    // 탭별 데이터 로드
    switch (tabName) {
      case "orders":
        this.loadOrderHistory();
        break;
      case "wishlist":
        this.loadWishlist();
        break;
      case "reviews":
        this.loadMyReviews();
        break;
      case "points":
        this.loadPointsHistory();
        break;
    }
  }

  async loadMypageData() {
    // 모든 마이페이지 데이터를 병렬로 로드
    await Promise.all([
      this.loadOrderHistory(),
      this.loadWishlist(),
      this.loadMyReviews(),
      this.loadPointsHistory(),
    ]);
  }

  async loadOrderHistory() {
    const ordersList = document.getElementById("ordersList");
    if (!ordersList) return;

    try {
      const response = await fetch("/api/orders/history", {
        credentials: "include",
      });
      
      // 404 에러인 경우 조용히 빈 상태 표시
      if (response.status === 404) {
        this.renderEmptyOrders();
        return;
      }
      
      const data = await response.json();

      if (data.success && data.data.length > 0) {
        this.renderOrderHistory(data.data);
      } else {
        this.renderEmptyOrders();
      }
    } catch (error) {
      // API가 없거나 오류 발생 시 빈 상태 표시 (콘솔 로그 제거)
      this.renderEmptyOrders();
    }
  }

  renderOrderHistory(orders) {
    const ordersList = document.getElementById("ordersList");
    ordersList.innerHTML = orders
      .map(
        (order) => `
        <div class="order-item">
          <div class="order-header">
            <span class="order-number">주문번호: ${order.orderNumber}</span>
            <span class="order-date">${this.formatDate(order.createdAt)}</span>
          </div>
          <div class="order-products">
            ${order.items
              .map(
                (item) => `
              <div class="order-product">
                <img src="${item.image || "📦"}" alt="${item.name}" class="order-product-image">
                <div class="order-product-info">
                  <h4>${item.name}</h4>
                  <p>수량: ${item.quantity}개</p>
                  <p class="order-product-price">${this.formatPrice(item.price * item.quantity)}</p>
                </div>
              </div>
            `
              )
              .join("")}
          </div>
          <div class="order-footer">
            <span class="order-status ${order.status}">${this.getOrderStatusText(order.status)}</span>
            <span class="order-total">총 ${this.formatPrice(order.totalAmount)}</span>
          </div>
        </div>
      `
      )
      .join("");
  }

  renderEmptyOrders() {
    const ordersList = document.getElementById("ordersList");
    ordersList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📦</div>
        <div class="empty-state-text">주문 내역이 없습니다</div>
        <div class="empty-state-subtext">첫 주문을 시작해보세요!</div>
      </div>
    `;
  }

  getOrderStatusText(status) {
    const statusMap = {
      pending: "결제 대기",
      paid: "결제 완료",
      preparing: "상품 준비중",
      shipping: "배송중",
      delivered: "배송 완료",
      cancelled: "주문 취소",
    };
    return statusMap[status] || status;
  }

  async loadWishlist() {
    const wishlistGrid = document.getElementById("wishlistGrid");
    if (!wishlistGrid) return;

    try {
      const response = await fetch("/api/wishlist", {
        credentials: "include",
      });
      
      // 404 에러인 경우 조용히 빈 상태 표시
      if (response.status === 404) {
        this.renderEmptyWishlist();
        return;
      }
      
      const data = await response.json();

      if (data.success && data.data.length > 0) {
        this.renderWishlist(data.data);
      } else {
        this.renderEmptyWishlist();
      }
    } catch (error) {
      // API가 없거나 오류 발생 시 빈 상태 표시 (콘솔 로그 제거)
      this.renderEmptyWishlist();
    }
  }

  renderWishlist(wishlist) {
    const wishlistGrid = document.getElementById("wishlistGrid");
    wishlistGrid.innerHTML = wishlist
      .map(
        (item) => `
        <div class="wishlist-item">
          <div class="wishlist-image">
            <img src="${item.image || "📦"}" alt="${item.name}">
          </div>
          <div class="wishlist-info">
            <h4>${item.name}</h4>
            <p class="wishlist-price">${this.formatPrice(item.price)}</p>
            <div class="wishlist-actions">
              <button class="btn-cart" onclick="productDetail.addWishlistToCart('${item.id}')">
                장바구니 담기
              </button>
              <button class="btn-remove" onclick="productDetail.removeFromWishlist('${item.id}')">
                삭제
              </button>
            </div>
          </div>
        </div>
      `
      )
      .join("");
  }

  renderEmptyWishlist() {
    const wishlistGrid = document.getElementById("wishlistGrid");
    wishlistGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">💝</div>
        <div class="empty-state-text">찜한 상품이 없습니다</div>
        <div class="empty-state-subtext">마음에 드는 상품을 찜해보세요!</div>
      </div>
    `;
  }

  async loadMyReviews() {
    const pendingReviews = document.getElementById("pendingReviews");
    const myReviews = document.getElementById("myReviews");
    
    if (!pendingReviews || !myReviews) return;

    try {
      // 작성 가능한 리뷰 로드
      const pendingResponse = await fetch("/api/reviews/pending", {
        credentials: "include",
      });
      
      let pendingData = { success: false, data: [] };
      if (pendingResponse.status !== 404) {
        pendingData = await pendingResponse.json();
      }

      // 작성한 리뷰 로드
      const myReviewsResponse = await fetch("/api/reviews/my", {
        credentials: "include",
      });
      
      let myReviewsData = { success: false, data: [] };
      if (myReviewsResponse.status !== 404) {
        myReviewsData = await myReviewsResponse.json();
      }

      this.renderPendingReviews(pendingData.success ? pendingData.data : []);
      this.renderMyReviews(myReviewsData.success ? myReviewsData.data : []);
    } catch (error) {
      // API가 없거나 오류 발생 시 빈 상태 표시 (콘솔 로그 제거)
      this.renderPendingReviews([]);
      this.renderMyReviews([]);
    }
  }

  renderPendingReviews(reviews) {
    const pendingReviews = document.getElementById("pendingReviews");
    
    if (reviews.length === 0) {
      pendingReviews.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">✍️</div>
          <div class="empty-state-text">작성 가능한 리뷰가 없습니다</div>
          <div class="empty-state-subtext">상품을 구매하시면 리뷰를 작성할 수 있습니다</div>
        </div>
      `;
      return;
    }

    pendingReviews.innerHTML = reviews
      .map(
        (review) => `
        <div class="pending-review-item">
          <div class="review-product-info">
            <img src="${review.productImage || "📦"}" alt="${review.productName}">
            <div class="product-details">
              <h4>${review.productName}</h4>
              <p>주문일: ${this.formatDate(review.orderDate)}</p>
            </div>
          </div>
          <button class="btn-write-review" onclick="productDetail.openReviewModal('${review.orderId}', '${review.productId}')">
            리뷰 작성
          </button>
        </div>
      `
      )
      .join("");
  }

  renderMyReviews(reviews) {
    const myReviews = document.getElementById("myReviews");
    
    if (reviews.length === 0) {
      myReviews.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <div class="empty-state-text">작성한 리뷰가 없습니다</div>
          <div class="empty-state-subtext">첫 리뷰를 작성해보세요!</div>
        </div>
      `;
      return;
    }

    myReviews.innerHTML = reviews
      .map(
        (review) => `
        <div class="my-review-item">
          <div class="review-product-info">
            <img src="${review.productImage || "📦"}" alt="${review.productName}">
            <div class="product-details">
              <h4>${review.productName}</h4>
              <div class="review-rating">
                ${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}
              </div>
              <p class="review-date">${this.formatDate(review.createdAt)}</p>
            </div>
          </div>
          <div class="review-content">
            <p>${review.content}</p>
          </div>
        </div>
      `
      )
      .join("");
  }

  async loadPointsHistory() {
    const currentPointsAmount = document.getElementById("currentPointsAmount");
    const pointsList = document.getElementById("pointsList");
    
    if (!currentPointsAmount || !pointsList) return;

    try {
      // 현재 포인트 조회
      const balanceResponse = await fetch("/api/points/balance", {
        credentials: "include",
      });
      
      if (balanceResponse.status !== 404) {
        const balanceData = await balanceResponse.json();
        if (balanceData.success) {
          currentPointsAmount.textContent = `${balanceData.balance.toLocaleString()}P`;
        } else {
          currentPointsAmount.textContent = "0P";
        }
      } else {
        currentPointsAmount.textContent = "0P";
      }

      // 포인트 내역 조회
      const historyResponse = await fetch("/api/points/history", {
        credentials: "include",
      });
      
      if (historyResponse.status !== 404) {
        const historyData = await historyResponse.json();
        if (historyData.success && historyData.data.length > 0) {
          this.renderPointsHistory(historyData.data);
        } else {
          this.renderEmptyPointsHistory();
        }
      } else {
        this.renderEmptyPointsHistory();
      }
    } catch (error) {
      // API가 없거나 오류 발생 시 기본값 표시 (콘솔 로그 제거)
      currentPointsAmount.textContent = "0P";
      this.renderEmptyPointsHistory();
    }
  }

  renderPointsHistory(history) {
    const pointsList = document.getElementById("pointsList");

    if (!history || history.length === 0) {
      pointsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">💰</div>
          <div class="empty-state-text">포인트 내역이 없습니다</div>
          <div class="empty-state-subtext">활동을 통해 포인트를 적립해보세요!</div>
        </div>
      `;
      return;
    }

    pointsList.innerHTML = history
      .map(
        (item) => `
        <div class="points-item">
          <div class="points-info">
            <div class="points-description">${item.description}</div>
            <div class="points-date">${this.formatDate(item.timestamp)}</div>
          </div>
          <div class="points-amount ${item.type === "earn" ? "earned" : "used"}">
            ${item.type === "earn" ? "+" : "-"}${item.amount.toLocaleString()}P
          </div>
        </div>
      `
      )
      .join("");
  }

  renderEmptyPointsHistory() {
    const pointsList = document.getElementById("pointsList");
    pointsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">💰</div>
        <div class="empty-state-text">포인트 내역이 없습니다</div>
        <div class="empty-state-subtext">활동을 통해 포인트를 적립해보세요!</div>
      </div>
    `;
  }

  setupReviewModalEvents() {
    const reviewModal = document.getElementById("reviewModal");
    const reviewModalClose = document.getElementById("reviewModalClose");
    const reviewCancelBtn = document.getElementById("reviewCancelBtn");
    const reviewSubmitBtn = document.getElementById("reviewSubmitBtn");
    const starRating = document.getElementById("starRating");

    // 모달 닫기
    if (reviewModalClose) {
      reviewModalClose.onclick = () => this.closeReviewModal();
    }
    if (reviewCancelBtn) {
      reviewCancelBtn.onclick = () => this.closeReviewModal();
    }

    // 별점 클릭 이벤트
    if (starRating) {
      starRating.addEventListener("click", (e) => {
        if (e.target.classList.contains("star")) {
          const rating = parseInt(e.target.dataset.rating);
          this.setStarRating(rating);
        }
      });
    }

    // 리뷰 제출
    if (reviewSubmitBtn) {
      reviewSubmitBtn.onclick = () => this.submitReview();
    }
  }

  openReviewModal(orderId, productId) {
    // 리뷰 모달 열기 로직
    const reviewModal = document.getElementById("reviewModal");
    reviewModal.style.display = "block";
    
    // 상품 정보 설정
    this.currentReviewOrderId = orderId;
    this.currentReviewProductId = productId;
    
    // 별점 초기화
    this.setStarRating(5);
    
    // 텍스트 초기화
    document.getElementById("reviewText").value = "";
  }

  closeReviewModal() {
    const reviewModal = document.getElementById("reviewModal");
    reviewModal.style.display = "none";
  }

  setStarRating(rating) {
    const stars = document.querySelectorAll("#starRating .star");
    stars.forEach((star, index) => {
      star.classList.toggle("active", index < rating);
    });
    this.currentReviewRating = rating;
  }

  async submitReview() {
    const reviewText = document.getElementById("reviewText").value.trim();
    
    if (!reviewText) {
      alert("리뷰 내용을 입력해주세요.");
      return;
    }

    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          orderId: this.currentReviewOrderId,
          productId: this.currentReviewProductId,
          rating: this.currentReviewRating,
          content: reviewText,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        alert("리뷰가 등록되었습니다.");
        this.closeReviewModal();
        this.loadMyReviews(); // 리뷰 목록 새로고침
      } else {
        alert("리뷰 등록에 실패했습니다.");
      }
    } catch (error) {
      console.error("리뷰 제출 오류:", error);
      alert("리뷰 등록 중 오류가 발생했습니다.");
    }
  }

  async addWishlistToCart(productId) {
    // 찜한 상품을 장바구니에 추가
    try {
      const response = await fetch(`/api/shop/products/${productId}`, {
        credentials: "include",
      });
      const data = await response.json();
      
      if (data.success) {
        // 장바구니에 추가 로직 (기존 addToCart와 동일)
        let cart = JSON.parse(localStorage.getItem("eatple_cart") || "[]");
        
        const existingItemIndex = cart.findIndex(item => item.id === productId);
        
        if (existingItemIndex >= 0) {
          cart[existingItemIndex].quantity += 1;
        } else {
          cart.push({
            id: data.data.id,
            name: data.data.name,
            price: data.data.price,
            originalPrice: data.data.originalPrice,
            image: data.data.image_url,
            quantity: 1,
            selected: true,
          });
        }
        
        localStorage.setItem("eatple_cart", JSON.stringify(cart));
        this.updateCartCount();
        this.showMessage("장바구니에 상품이 추가되었습니다.", "success");
      }
    } catch (error) {
      console.error("장바구니 추가 오류:", error);
      this.showMessage("장바구니 추가 중 오류가 발생했습니다.", "error");
    }
  }

  async removeFromWishlist(productId) {
    try {
      const response = await fetch(`/api/wishlist/${productId}`, {
        method: "DELETE",
        credentials: "include",
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.showMessage("찜한 상품에서 제거되었습니다.", "success");
        this.loadWishlist(); // 찜 목록 새로고침
      } else {
        this.showMessage("제거에 실패했습니다.", "error");
      }
    } catch (error) {
      console.error("찜 제거 오류:", error);
      this.showMessage("제거 중 오류가 발생했습니다.", "error");
    }
  }



  // 모바일 하단 고정 섹션 이벤트 리스너 설정
  setupMobilePurchaseBar() {
    const mobileWishlistBtn = document.getElementById("mobileWishlistBtn");
    const mobileBuyBtn = document.getElementById("mobileBuyBtn");
    const mobilePurchaseModalClose = document.getElementById("mobilePurchaseModalClose");
    const mobileDecreaseQty = document.getElementById("mobileDecreaseQty");
    const mobileIncreaseQty = document.getElementById("mobileIncreaseQty");
    const mobileQuantityInput = document.getElementById("mobileQuantityInput");
    const mobileAddToCartBtn = document.getElementById("mobileAddToCartBtn");

    if (mobileWishlistBtn) {
      mobileWishlistBtn.addEventListener("click", () => {
        this.toggleWishlist();
      });
    }

    if (mobileBuyBtn) {
      mobileBuyBtn.addEventListener("click", () => {
        this.openMobilePurchaseModal();
      });
    }

    // 모달 닫기 버튼
    if (mobilePurchaseModalClose) {
      mobilePurchaseModalClose.addEventListener("click", () => {
        this.closeMobilePurchaseModal();
      });
    }

    // 모달 외부 클릭 시 닫기
    const mobilePurchaseModal = document.getElementById("mobilePurchaseModal");
    if (mobilePurchaseModal) {
      mobilePurchaseModal.addEventListener("click", (e) => {
        if (e.target === mobilePurchaseModal) {
          this.closeMobilePurchaseModal();
        }
      });
    }

    // 모바일 수량 조절 버튼
    if (mobileDecreaseQty) {
      mobileDecreaseQty.addEventListener("click", () => {
        this.changeMobileQuantity(-1);
      });
    }

    if (mobileIncreaseQty) {
      mobileIncreaseQty.addEventListener("click", () => {
        this.changeMobileQuantity(1);
      });
    }

    // 모바일 수량 입력 필드
    if (mobileQuantityInput) {
      mobileQuantityInput.addEventListener("change", (e) => {
        this.currentQuantity = Math.max(1, Math.min(10, parseInt(e.target.value) || 1));
        this.updateMobileQuantityDisplay();
        this.updateMobileTotalPrice();
      });
    }

    // 모바일 장바구니 담기 버튼
    if (mobileAddToCartBtn) {
      mobileAddToCartBtn.addEventListener("click", () => {
        this.addToCart();
        this.closeMobilePurchaseModal();
      });
    }


  }

  // 찜하기 토글 함수
  async toggleWishlist() {
    if (!this.isLoggedIn) {
      this.showMessage("로그인이 필요합니다.", "error");
      return;
    }

    if (!this.product) return;

    try {
      const response = await fetch(`/api/wishlist/${this.product.id}`, {
        method: "POST",
        credentials: "include",
      });

      const data = await response.json();

      if (data.success) {
        const wishlistBtn = document.getElementById("mobileWishlistBtn");
        if (wishlistBtn) {
          if (data.added) {
            wishlistBtn.classList.add("active");
            this.showMessage("찜한 상품에 추가되었습니다.", "success");
          } else {
            wishlistBtn.classList.remove("active");
            this.showMessage("찜한 상품에서 제거되었습니다.", "success");
          }
        }
      } else {
        this.showMessage("찜하기 처리 중 오류가 발생했습니다.", "error");
      }
    } catch (error) {
      console.error("찜하기 토글 오류:", error);
      this.showMessage("찜하기 처리 중 오류가 발생했습니다.", "error");
    }
  }

  // 장바구니 성공 모달 이벤트 리스너 설정
  setupCartSuccessModal() {
    const continueShoppingBtn = document.getElementById("continueShoppingBtn");
    const goToCartBtn = document.getElementById("goToCartBtn");
    const cartSuccessModal = document.getElementById("cartSuccessModal");

    // 쇼핑 계속하기 버튼
    if (continueShoppingBtn) {
      continueShoppingBtn.addEventListener("click", () => {
        this.hideCartSuccessModal();
      });
    }

    // 장바구니 바로가기 버튼
    if (goToCartBtn) {
      goToCartBtn.addEventListener("click", () => {
        window.location.href = "cart.html";
      });
    }

    // 모달 외부 클릭 시 닫기
    if (cartSuccessModal) {
      cartSuccessModal.addEventListener("click", (e) => {
        if (e.target === cartSuccessModal) {
          this.hideCartSuccessModal();
        }
      });
    }
  }

  // 바로 구매 함수
  buyNow() {
    if (!this.product) return;

    // 현재 수량으로 장바구니에 추가 후 구매 페이지로 이동
    let cart = JSON.parse(localStorage.getItem("eatple_cart") || "[]");
    
    const existingItemIndex = cart.findIndex(item => item.id === this.product.id);
    
    if (existingItemIndex >= 0) {
      cart[existingItemIndex].quantity = this.currentQuantity;
    } else {
      cart.push({
        id: this.product.id,
        name: this.product.name,
        price: this.product.price,
        originalPrice: this.product.originalPrice,
        image: this.product.image_url,
        quantity: this.currentQuantity,
        selected: true,
      });
    }
    
    localStorage.setItem("eatple_cart", JSON.stringify(cart));
    this.updateCartCount();
    
    // 구매 페이지로 이동 (cart.html 또는 checkout 페이지)
    window.location.href = "cart.html";
  }

  // 장바구니 성공 모달 표시
  showCartSuccessModal() {
    const modal = document.getElementById("cartSuccessModal");
    if (modal) {
      modal.style.display = "flex";
      modal.classList.add("active");
    }
  }

  // 장바구니 성공 모달 숨기기
  hideCartSuccessModal() {
    const modal = document.getElementById("cartSuccessModal");
    if (modal) {
      modal.classList.remove("active");
      setTimeout(() => {
        modal.style.display = "none";
      }, 300);
    }
  }

  // 모바일 구매 모달 열기
  openMobilePurchaseModal() {
    const modal = document.getElementById("mobilePurchaseModal");
    if (modal) {
      modal.classList.add("active");
      this.updateMobileModalContent();
    }
  }

  // 모바일 구매 모달 닫기
  closeMobilePurchaseModal() {
    const modal = document.getElementById("mobilePurchaseModal");
    if (modal) {
      modal.classList.remove("active");
    }
  }

  // 모바일 모달 내용 업데이트
  updateMobileModalContent() {
    if (!this.product) return;

    // 제품 이미지 업데이트
    const mobileProductImage = document.getElementById("mobileProductImage");
    if (mobileProductImage) {
      const imageUrl = this.images && this.images.length > 0 ? this.images[0] : this.product.image_url;
      if (imageUrl) {
        mobileProductImage.src = imageUrl;
        mobileProductImage.style.display = "block";
      } else {
        mobileProductImage.style.display = "none";
      }
    }

    // 제품명 업데이트
    const mobileProductTitle = document.getElementById("mobileProductTitle");
    const mobileProductNameLabel = document.getElementById("mobileProductNameLabel");
    if (mobileProductTitle) {
      mobileProductTitle.textContent = this.product.name;
    }
    if (mobileProductNameLabel) {
      mobileProductNameLabel.textContent = this.product.name;
    }

    // 제품 요약 업데이트
    const mobileProductSummary = document.getElementById("mobileProductSummary");
    if (mobileProductSummary) {
      mobileProductSummary.textContent = this.product.summary || "제품 상세 정보를 확인해보세요.";
    }

    // 가격 정보 업데이트
    const mobileCurrentPriceDisplay = document.getElementById("mobileCurrentPriceDisplay");
    const mobileOriginalPriceDisplay = document.getElementById("mobileOriginalPriceDisplay");
    
    if (mobileCurrentPriceDisplay) {
      mobileCurrentPriceDisplay.textContent = this.formatPrice(this.product.price);
    }

    if (mobileOriginalPriceDisplay) {
      if (this.product.originalPrice && this.product.originalPrice > this.product.price) {
        mobileOriginalPriceDisplay.textContent = this.formatPrice(this.product.originalPrice);
        mobileOriginalPriceDisplay.style.display = "inline";
      } else {
        mobileOriginalPriceDisplay.style.display = "none";
      }
    }

    // 수량 입력 필드 업데이트
    const mobileQuantityInput = document.getElementById("mobileQuantityInput");
    if (mobileQuantityInput) {
      mobileQuantityInput.value = this.currentQuantity;
    }

    // 총 가격 업데이트
    const mobileTotalPrice = document.getElementById("mobileTotalPrice");
    if (mobileTotalPrice) {
      const totalPrice = this.product.price * this.currentQuantity;
      mobileTotalPrice.textContent = this.formatPrice(totalPrice);
    }
  }

  // 모바일 수량 변경
  changeMobileQuantity(delta) {
    this.currentQuantity = Math.max(1, Math.min(10, this.currentQuantity + delta));
    this.updateMobileQuantityDisplay();
    this.updateMobileTotalPrice();
  }

  // 모바일 수량 표시 업데이트
  updateMobileQuantityDisplay() {
    const mobileQuantityInput = document.getElementById("mobileQuantityInput");
    if (mobileQuantityInput) {
      mobileQuantityInput.value = this.currentQuantity;
    }
  }

  // 모바일 총 가격 업데이트
  updateMobileTotalPrice() {
    if (!this.product) return;

    const mobileTotalPrice = document.getElementById("mobileTotalPrice");
    if (mobileTotalPrice) {
      const totalPrice = this.product.price * this.currentQuantity;
      mobileTotalPrice.textContent = this.formatPrice(totalPrice);
    }
  }
}

// CSS 애니메이션 추가
const productDetailStyle = document.createElement("style");
productDetailStyle.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(productDetailStyle);

// 전역 변수로 ProductDetail 인스턴스 저장
let productDetail;

// 페이지 로드 시 초기화
document.addEventListener("DOMContentLoaded", () => {
  productDetail = new ProductDetail();
});

// 전역 함수들
function togglePointsHistory() {
  const pointsList = document.getElementById("pointsList");
  const arrow = document.getElementById("pointsHistoryArrow");

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
}
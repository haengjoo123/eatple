/**
 * 잇플 스토어 JavaScript - Supabase 통합 버전
 * shop.js의 기능을 기반으로 한 완전한 스토어 구현
 */

class EatpleStore {
  constructor() {
    this.userPoints = 0;
    this.selectedProduct = null;
    this.pointsToUse = 0;
    this.products = [];
    this.categories = [];
    this.currentCategory = null;
    this.featuredProducts = [];
    this.currentSlide = 0;
    this.totalSlides = 8;
    this.featuredCurrentSlide = 0;
    this.featuredSlidesPerView = 4;
    this.cart = [];

    // Hero background slideshow - 최적화된 이미지 경로
    this.heroImages = [
      "images/hero-background_01.png",
      "images/hero-background_02.png",
      "images/hero-background_03.png",
      "images/hero-background_04.png",
    ];

    // 이미지 프리로드 상태 추적
    this.heroImagesLoaded = new Set();
    this.currentHeroIndex = 0;
    this.heroSlideInterval = null;

    this.init();
  }

  async init() {
    // 히어로 슬라이드를 가장 먼저 초기화하여 퍼스트 페인트 지연 제거
    this.initHeroSlideshow();

    // 헤더 인증 관리자가 초기화될 때까지 잠시 대기
    let retryCount = 0;
    while (!window.headerAuthManager && retryCount < 10) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      retryCount++;
    }

    if (window.headerAuthManager) {
      await window.headerAuthManager.refreshAuthStatus();
    }

    await this.checkAuthStatus();
    await this.loadUserPoints();
    await this.loadCategories();
    await this.loadProducts();
    await this.loadFeaturedProducts();
    this.renderCategories();
    this.renderFeaturedProducts();
    this.renderProducts();
    await this.renderPromotions();
    this.setupEventListeners();
    this.setupRealTimeUpdates();
    this.setupHeaderScroll();
    this.updateCartCount();
  }

  async checkAuthStatus() {
    try {
      const response = await fetch("/api/auth/me", {
        credentials: "include",
      });
      const data = await response.json();

      if (!data.loggedIn) {
        console.log("비로그인 사용자 접근");
        this.userPoints = 0;
        return;
      }

      // 헤더 인증 관리자가 있으면 상태 동기화
      if (window.headerAuthManager) {
        await window.headerAuthManager.refreshAuthStatus();
      }
    } catch (error) {
      console.error("인증 확인 오류:", error);
      this.userPoints = 0;
    }
  }

  async loadUserPoints() {
    try {
      const response = await fetch("/api/points/balance", {
        credentials: "include",
      });
      const data = await response.json();

      if (data.success) {
        this.userPoints = data.balance;
        const availablePointsElement =
          document.getElementById("availablePoints");
        if (availablePointsElement) {
          availablePointsElement.textContent = this.userPoints.toLocaleString();
        }
      } else {
        console.error("포인트 조회 실패:", data.error);
        this.userPoints = 0;
        const availablePointsElement =
          document.getElementById("availablePoints");
        if (availablePointsElement) {
          availablePointsElement.textContent = "0";
        }
      }
    } catch (error) {
      console.error("포인트 조회 오류:", error);
      this.userPoints = 0;
      const availablePointsElement = document.getElementById("availablePoints");
      if (availablePointsElement) {
        availablePointsElement.textContent = "0";
      }
    }
  }

  async loadCategories() {
    try {
      const response = await fetch("/api/shop/categories", {
        credentials: "include",
      });
      const data = await response.json();

      if (data.success) {
        this.categories = data.data;
      } else {
        console.error("카테고리 조회 실패:", data.error);
        this.categories = this.getFallbackCategories();
      }
    } catch (error) {
      console.error("카테고리 조회 오류:", error);
      this.categories = this.getFallbackCategories();
    }
  }

  getFallbackCategories() {
    return [
      // 건강식품
      {
        name: "health_functional_food",
        display_name: "건강기능식품",
        icon: "💊",
        description: "건강 기능성이 인정된 식품",
        image:
          "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&h=300&fit=crop",
        products: 25,
        parent_category: "건강식품",
      },
      {
        name: "protein_food",
        display_name: "단백질 식품",
        icon: "💪",
        description: "근육 건강을 위한 단백질 식품",
        image:
          "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop",
        products: 18,
        parent_category: "건강식품",
      },
      {
        name: "healthy_snack",
        display_name: "건강 간식",
        icon: "🥜",
        description: "건강한 간식거리",
        image:
          "https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=400&h=300&fit=crop",
        products: 15,
        parent_category: "건강식품",
      },
      {
        name: "healthy_juice",
        display_name: "건강 주스",
        icon: "🥤",
        description: "영양이 풍부한 건강 주스",
        image:
          "https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=400&h=300&fit=crop",
        products: 12,
        parent_category: "건강식품",
      },
      // 간편식 / 반찬
      {
        name: "home_meal_replacement",
        display_name: "가정간편식",
        icon: "🍱",
        description: "간편하게 즐기는 가정식",
        image:
          "https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop",
        products: 22,
        parent_category: "간편식/반찬",
      },
      {
        name: "side_dish",
        display_name: "반찬",
        icon: "🥘",
        description: "맛있는 밑반찬",
        image:
          "https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=400&h=300&fit=crop",
        products: 20,
        parent_category: "간편식/반찬",
      },
      {
        name: "salad",
        display_name: "샐러드",
        icon: "🥗",
        description: "신선한 샐러드",
        image:
          "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop",
        products: 16,
        parent_category: "간편식/반찬",
      },
      // 신선식품
      {
        name: "fruit",
        display_name: "과일",
        icon: "🍎",
        description: "신선한 제철 과일",
        image:
          "https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=400&h=300&fit=crop",
        products: 30,
        parent_category: "신선식품",
      },
      {
        name: "meat",
        display_name: "정육/계란",
        icon: "🥩",
        description: "신선한 정육/계란",
        image:
          "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=400&h=300&fit=crop",
        products: 24,
        parent_category: "신선식품",
      },
      {
        name: "seafood",
        display_name: "수산/해산",
        icon: "🐟",
        description: "신선한 수산/해산",
        image:
          "https://images.unsplash.com/photo-1544943910-4c1dc44aab44?w=400&h=300&fit=crop",
        products: 18,
        parent_category: "신선식품",
      },
    ];
  }

  async loadFeaturedProducts() {
    try {
      const response = await fetch("/api/shop/products/featured", {
        credentials: "include",
      });
      const data = await response.json();

      if (data.success) {
        // 할인율 20% 이상인 상품만 필터링
        this.featuredProducts = data.data
          .map((product) => ({
            id: product.id,
            name: product.name,
            description: product.description,
            summary: product.summary,
            price: product.price,
            originalPrice: product.originalPrice || product.price,
            brand: product.brand || '기본브랜드',
            shippingFee: product.shipping_fee || 3000, // snake_case를 camelCase로 매핑
            image: product.image_url,
            category: product.category,
            status: product.status,
            discount: product.originalPrice
              ? Math.round(
                  ((product.originalPrice - product.price) /
                    product.originalPrice) *
                    100
                )
              : 0,
          }))
          .filter((product) => {
            // featured=true로 설정된 상품은 항상 포함 (서버에서 이미 필터링됨)
            // 추가로 클라이언트에서도 할인율 15% 이상 확인
            return product.discount >= 15 || product.featured === true;
          });
        console.log("특가상품 로드됨:", this.featuredProducts.length, "개");
      } else {
        console.error("특가 상품 조회 실패:", data.error);
        this.loadFallbackFeaturedProducts();
      }
    } catch (error) {
      console.error("특가 상품 조회 오류:", error);
      this.loadFallbackFeaturedProducts();
    }
  }

  loadFallbackFeaturedProducts() {
    // 관리자가 등록한 상품 중에서 할인율 20% 이상인 상품들을 특가상품으로 표시
    const adminProducts = JSON.parse(
      localStorage.getItem("adminProducts") || "[]"
    );

    if (adminProducts.length > 0) {
      // 할인율 20% 이상인 상품들만 필터링
      const discountedProducts = adminProducts
        .filter(
          (product) => {
            if (product.status !== "active") return false;
            
            // featured=true로 설정된 상품은 항상 포함
            if (product.featured === true) return true;
            
            // 할인율 15% 이상인 상품만 포함
            if (product.originalPrice && product.originalPrice > product.price) {
              const discountRate = ((product.originalPrice - product.price) / product.originalPrice) * 100;
              return discountRate >= 15;
            }
            
            return false;
          }
        )
        .map((product) => ({
          id: product.id,
          name: product.name,
          description:
            product.summary ||
            product.description?.replace(/<[^>]*>/g, "") ||
            "",
          summary: product.summary,
          price: product.price,
          originalPrice: product.originalPrice,
          image:
            product.images && product.images.length > 0
              ? product.images[0]
              : this.getDefaultEmoji(product.category),
          category: product.category,
          status: "active",
          discount: Math.round(
            ((product.originalPrice - product.price) / product.originalPrice) *
              100
          ),
        }))
        .slice(0, 8); // 최대 8개

      this.featuredProducts = discountedProducts;
      console.log("Fallback 특가상품 로드됨:", this.featuredProducts);
    } else {
      this.featuredProducts = [];
    }
  }

  async loadProducts(category = null) {
    try {
      let url = "/api/shop/products";
      if (category) {
        url += `?category=${encodeURIComponent(category)}`;
      }

      const response = await fetch(url, {
        credentials: "include",
      });
      const data = await response.json();

      if (data.success) {
        this.products = data.data.map((product) => ({
          id: product.id,
          name: product.name,
          description: product.description,
          summary: product.summary,
          price: product.price,
          originalPrice: product.originalPrice,
          brand: product.brand || null, // 브랜드 정보가 없으면 null로 설정
          shippingFee: product.shipping_fee || 3000, // snake_case를 camelCase로 매핑
          image:
            this.getProductImage(product) ||
            this.getDefaultEmoji(product.category),
          category: product.category,
          status: product.status,
          rating: product.rating || Math.floor(Math.random() * 2) + 4,
        }));
      } else {
        console.error("상품 조회 실패:", data.error);
        this.loadFallbackProducts(category);
      }
    } catch (error) {
      console.error("상품 조회 오류:", error);
      this.loadFallbackProducts(category);
    }
  }

  loadFallbackProducts(category = null) {
    console.log("Using fallback products due to API failure");

    // 관리자 페이지에서 등록한 상품 먼저 확인
    const adminProducts = JSON.parse(
      localStorage.getItem("adminProducts") || "[]"
    );

    if (adminProducts.length > 0) {
      // 관리자 상품을 스토어 형식으로 변환 (active 상태 상품만)
      const convertedProducts = adminProducts
        .filter((product) => product.status === "active") // 활성 상품만
        .map((product) => ({
          id: product.id,
          name: product.name,
          description:
            product.summary ||
            product.description?.replace(/<[^>]*>/g, "") ||
            "",
          price: product.price,
          originalPrice: product.originalPrice,
          image:
            product.images && product.images.length > 0
              ? product.images[0]
              : this.getDefaultEmoji(product.category),
          category: product.category,
          status: product.status === "active" ? "active" : "inactive",
          rating: Math.floor(Math.random() * 2) + 4,
        }));

      if (category) {
        this.products = convertedProducts.filter(
          (product) => product.category === category
        );
      } else {
        this.products = convertedProducts;
      }

      // 관리자 상품이 있으면 fallback 상품과 합치지 않고 바로 리턴
      if (this.products.length > 0) {
        console.log(`관리자 상품 ${this.products.length}개 로드됨`);
        return;
      } else {
        console.log("관리자 상품이 있지만 active 상태가 아님");
      }
    } else {
      console.log("관리자 상품이 없음");
    }

    // 폴백 데이터 사용하지 않음 - 관리자 상품이 없을 때는 빈 배열로 설정
    console.log("폴백 데이터 사용하지 않음 - 관리자 상품이 없습니다");
    this.products = [];
  }

  // 제품 이미지 URL 파싱 함수
  getProductImage(product) {
    if (!product.image_url) return null;

    try {
      // JSON 배열로 파싱 시도
      const parsedImages = JSON.parse(product.image_url);
      if (Array.isArray(parsedImages) && parsedImages.length > 0) {
        const firstImage = parsedImages[0];
        // /uploads/ 경로가 포함된 경우 그대로 반환
        if (firstImage && firstImage.includes('/uploads/')) {
          return firstImage;
        }
        // 파일명만 있는 경우 /uploads/products/ 경로 추가
        if (firstImage && !firstImage.startsWith('http') && !firstImage.startsWith('/')) {
          return `/uploads/products/${firstImage}`;
        }
        return firstImage;
      }
      return product.image_url;
    } catch (e) {
      // JSON 파싱 실패 시 단일 URL로 처리
      const imageUrl = product.image_url;
      // /uploads/ 경로가 포함된 경우 그대로 반환
      if (imageUrl && imageUrl.includes('/uploads/')) {
        return imageUrl;
      }
      // 파일명만 있는 경우 /uploads/products/ 경로 추가
      if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('/')) {
        return `/uploads/products/${imageUrl}`;
      }
      return imageUrl;
    }
  }

  getDefaultEmoji(category) {
    const emojiMap = {
      // 건강식품
      health_functional_food: "💊",
      protein_food: "💪",
      healthy_snack: "🥜",
      healthy_juice: "🥤",
      // 간편식/반찬
      home_meal_replacement: "🍱",
      side_dish: "🥘",
      salad: "🥗",
      // 신선식품
      fruit: "🍎",
      meat: "🥩",
      seafood: "🐟",
      // 기존 호환성
      supplement: "💊",
      vitamin: "🍊",
      beauty: "✨",
      health: "🌿",
      protein: "💪",
      omega: "🐟",
    };
    return emojiMap[category] || "📦";
  }

  async getPromotions() {
    try {
      const response = await fetch('/api/promotions/active');
      const data = await response.json();
      
      if (data.success) {
        return data.promotions.map(promo => ({
          theme: promo.theme,
          badge: promo.badge,
          title: promo.title,
          subtitle: promo.subtitle,
          description: promo.description,
          tag: promo.tag,
          image: promo.image_url,
          icons: promo.icons ? (Array.isArray(promo.icons) ? promo.icons : JSON.parse(promo.icons)) : null
        }));
      } else {
        console.error('프로모션 로드 실패:', data.message);
        return this.getDefaultPromotions();
      }
    } catch (error) {
      console.error('프로모션 로드 오류:', error);
      return this.getDefaultPromotions();
    }
  }

  getDefaultPromotions() {
    return [
      {
        theme: "water-theme",
        badge: "15%",
        title: "생수",
        subtitle: "최저가 도전",
        description: "15% 쿠폰 받고, 어디든 갑니다",
        image:
          "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&h=200&fit=crop",
      },
      {
        theme: "bottle-theme",
        title: "Bottle to Bottle",
        subtitle: "난 다시 태어나도, 나로 태어날래",
        description: "원더플 캠페인 시즌 6",
        tag: "플라스틱 순환 캠페인",
        icons: ["🥤", "📦", "🏠", "⭐"],
      },
      {
        theme: "travel-theme",
        title: "여행 빅세일",
        subtitle: "쿨 바캉스 타임",
        description: "항공/호텔/패키지/렌터카 ~10%",
        image:
          "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=200&fit=crop",
      },
      {
        theme: "food-theme",
        badge: "20%",
        title: "건강식품",
        subtitle: "자연의 힘",
        description: "유기농 건강식품 20% 할인",
        image:
          "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=300&h=200&fit=crop",
      },
      {
        theme: "beauty-theme",
        title: "뷰티 케어",
        subtitle: "아름다움의 시작",
        description: "프리미엄 뷰티 제품 25% 할인",
        tag: "뷰티 트렌드",
        icons: ["✨", "💄", "🌸", "💎"],
      },
      {
        theme: "fitness-theme",
        title: "피트니스",
        subtitle: "강한 몸, 건강한 삶",
        description: "운동용품 및 보조제 30% 할인",
        image:
          "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=300&h=200&fit=crop",
      },
      {
        theme: "vitamin-theme",
        badge: "18%",
        title: "비타민",
        subtitle: "필수 영양소",
        description: "종합비타민 18% 할인",
        image:
          "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&h=200&fit=crop",
      },
      {
        theme: "supplement-theme",
        title: "영양제",
        subtitle: "건강한 선택",
        description: "프리미엄 영양제 22% 할인",
        tag: "건강 관리",
        icons: ["💊", "🌿", "💪", "⭐"],
      },
    ];
  }

  // 안전한 이미지 HTML 생성 함수
  createImageHtml(imageUrl, productName, category = null) {
    const validUrl = this.extractValidImageUrl(imageUrl);

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

  // 유효한 이미지 URL 추출
  extractValidImageUrl(imageData) {
    console.log("🔍 extractValidImageUrl 호출됨:", imageData, typeof imageData);

    if (!imageData) {
      console.log("🔍 imageData가 없음");
      return null;
    }

    const imageStr = String(imageData).trim();
    console.log("🔍 imageStr:", imageStr);

    if (
      !imageStr ||
      imageStr === "[]" ||
      imageStr === "null" ||
      imageStr === "undefined"
    ) {
      console.log("🔍 imageStr이 비어있거나 null");
      return null;
    }

    // JSON 배열 형태인지 확인
    if (imageStr.startsWith("[") && imageStr.endsWith("]")) {
      console.log("🔍 JSON 배열 형태로 파싱 시도");
      try {
        const images = JSON.parse(imageStr);
        if (Array.isArray(images) && images.length > 0) {
          const firstImage = String(images[0]).trim();
          console.log("🔍 첫 번째 이미지:", firstImage);
          
          // /uploads/ 경로가 포함된 경우 그대로 반환
          if (firstImage && firstImage.includes('/uploads/')) {
            console.log("🔍 /uploads/ 경로 포함된 이미지:", firstImage);
            return firstImage;
          }
          
          // 파일명만 있는 경우 /uploads/products/ 경로 추가
          if (firstImage && !firstImage.startsWith('http') && !firstImage.startsWith('/')) {
            const fullPath = `/uploads/products/${firstImage}`;
            console.log("🔍 파일명에 경로 추가:", fullPath);
            return fullPath;
          }
          
          const isValid = this.isValidImageUrl(firstImage);
          console.log("🔍 URL 유효성:", isValid);
          return isValid ? firstImage : null;
        }
      } catch (e) {
        console.warn("JSON 파싱 실패:", imageStr, e);
      }
      return null;
    }

    // 단일 URL인 경우
    console.log("🔍 단일 URL로 처리");
    
    // /uploads/ 경로가 포함된 경우 그대로 반환
    if (imageStr && imageStr.includes('/uploads/')) {
      console.log("🔍 /uploads/ 경로 포함된 이미지:", imageStr);
      return imageStr;
    }
    
    // 파일명만 있는 경우 /uploads/products/ 경로 추가
    if (imageStr && !imageStr.startsWith('http') && !imageStr.startsWith('/')) {
      const fullPath = `/uploads/products/${imageStr}`;
      console.log("🔍 파일명에 경로 추가:", fullPath);
      return fullPath;
    }
    
    const isValid = this.isValidImageUrl(imageStr);
    console.log("🔍 단일 URL 유효성:", isValid);
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
      trimmedUrl.startsWith("data:image/") ||
      trimmedUrl.includes("/uploads/") // /uploads/ 경로 포함된 경우도 유효한 것으로 처리
    );
  }

  // HTML 이스케이프 함수
  escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // Hero Background Slideshow 초기화
  initHeroSlideshow() {
    const heroBackground = document.getElementById("heroBackground");
    if (!heroBackground) return;

    // 첫 번째 이미지를 즉시 로드하고 나머지는 지연 로드
    this.heroImages.forEach((imageSrc, index) => {
      const imageDiv = document.createElement("div");
      imageDiv.className = "hero-background-image";

      if (index === 0) {
        // 첫 번째 이미지는 즉시 로드
        imageDiv.style.backgroundImage = `url('${imageSrc}')`;
        imageDiv.classList.add("active");
        heroBackground.appendChild(imageDiv);

        // 첫 번째 이미지 로드 완료 후 나머지 이미지 프리로드
        this.preloadHeroImages(index + 1);
      } else {
        // 나머지 이미지는 나중에 로드
        imageDiv.dataset.src = imageSrc;
        heroBackground.appendChild(imageDiv);
      }
    });

    // 자동 슬라이드 시작
    this.startHeroSlideshow();
  }

  // 히어로 이미지 프리로드
  preloadHeroImages(startIndex = 1) {
    // 첫 번째 이미지 로드 후 0.3초 뒤에 나머지 이미지들을 순차적으로 프리로드
    setTimeout(() => {
      this.heroImages.slice(startIndex).forEach((imageSrc, index) => {
        // 각 이미지를 순차적으로 로드 (50ms 간격)
        setTimeout(() => {
          const img = new Image();
          img.onload = () => {
            const imageDiv = document.querySelector(
              `.hero-background-image[data-src="${imageSrc}"]`
            );
            if (imageDiv) {
              imageDiv.style.backgroundImage = `url('${imageSrc}')`;
              imageDiv.removeAttribute("data-src");
              this.heroImagesLoaded.add(imageSrc);
            }
          };
          img.onerror = () => {
            console.warn(`히어로 이미지 로드 실패: ${imageSrc}`);
            // 로드 실패 시 기본 배경 유지
            const imageDiv = document.querySelector(
              `.hero-background-image[data-src="${imageSrc}"]`
            );
            if (imageDiv) {
              imageDiv.removeAttribute("data-src");
            }
          };
          img.src = imageSrc;
        }, index * 50);
      });
    }, 300);
  }

  // Hero Slideshow 시작
  startHeroSlideshow() {
    this.heroSlideInterval = setInterval(() => {
      this.nextHeroSlide();
    }, 5000); // 5초마다 변경
  }

  // 다음 Hero 슬라이드
  nextHeroSlide() {
    const heroBackground = document.getElementById("heroBackground");
    if (!heroBackground) return;

    const imageElements = heroBackground.querySelectorAll(
      ".hero-background-image"
    );

    // 현재 활성 이미지 비활성화
    imageElements[this.currentHeroIndex].classList.remove("active");

    // 다음 인덱스 계산
    this.currentHeroIndex =
      (this.currentHeroIndex + 1) % this.heroImages.length;

    // 다음 이미지가 로드되지 않았다면 로드
    const nextImageElement = imageElements[this.currentHeroIndex];
    if (nextImageElement && nextImageElement.dataset.src) {
      nextImageElement.style.backgroundImage = `url('${nextImageElement.dataset.src}')`;
      nextImageElement.removeAttribute("data-src");
    }

    // 다음 이미지 활성화
    imageElements[this.currentHeroIndex].classList.add("active");
  }

  // Hero Slideshow 정지
  stopHeroSlideshow() {
    if (this.heroSlideInterval) {
      clearInterval(this.heroSlideInterval);
      this.heroSlideInterval = null;
    }
  }

  // Hero Slideshow 재시작
  restartHeroSlideshow() {
    this.stopHeroSlideshow();
    this.startHeroSlideshow();
  }

  setupEventListeners() {
    // 카테고리 드롭다운 호버 개선
    this.setupCategoryDropdown();

    // 상품 상세 모달 이벤트 리스너
    this.setupProductDetailModal();

    // 모달 닫기
    const modal = document.getElementById("purchaseModal");
    const closeBtn = document.getElementById("modalClose");
    const cancelBtn = document.getElementById("cancelBtn");

    if (closeBtn) closeBtn.onclick = () => (modal.style.display = "none");
    if (cancelBtn) cancelBtn.onclick = () => (modal.style.display = "none");

    window.onclick = (event) => {
      if (event.target === modal) {
        modal.style.display = "none";
      }
      // 상품 상세 모달도 추가
      const productDetailModal = document.getElementById("productDetailModal");
      if (event.target === productDetailModal) {
        productDetailModal.style.display = "none";
      }
    };

    // 포인트 입력 이벤트
    const pointsInput = document.getElementById("pointsInput");
    if (pointsInput) {
      pointsInput.addEventListener("input", () => {
        this.validatePointsInput();
        this.updatePurchaseSummary();
      });
    }

    // 최대 포인트 사용 버튼
    const maxPointsBtn = document.getElementById("maxPointsBtn");
    if (maxPointsBtn) {
      maxPointsBtn.onclick = () => {
        if (this.selectedProduct) {
          const maxPoints = Math.min(
            this.userPoints,
            this.selectedProduct.price
          );
          pointsInput.value = maxPoints;
          this.updatePurchaseSummary();
        }
      };
    }

    // 구매 확인 버튼
    const confirmBtn = document.getElementById("confirmBtn");
    if (confirmBtn) {
      confirmBtn.onclick = () => {
        this.processPurchase();
      };
    }

    // 프로모션 슬라이더
    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");

    if (prevBtn) prevBtn.addEventListener("click", () => this.previousSlide());
    if (nextBtn) nextBtn.addEventListener("click", () => this.nextSlide());

    // 검색 기능 - 기본 검색창
    const searchInput = document.querySelector(".search-input");
    const searchBtn = document.querySelector(".search-btn");

    if (searchInput) {
      searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          this.performSearch(searchInput.value);
        }
      });
    }

    if (searchBtn) {
      searchBtn.addEventListener("click", () =>
        this.performSearch(searchInput.value)
      );
    }

    // 검색 기능 - 네비게이션 검색창
    const searchInputNav = document.querySelector(".search-input-nav");
    const searchBtnNav = document.querySelector(".search-btn-nav");

    if (searchInputNav) {
      searchInputNav.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          this.performSearch(searchInputNav.value);
        }
      });

      // 두 검색창 동기화
      searchInputNav.addEventListener("input", (e) => {
        if (searchInput) {
          searchInput.value = e.target.value;
        }
      });
    }

    if (searchBtnNav) {
      searchBtnNav.addEventListener("click", () =>
        this.performSearch(searchInputNav.value)
      );
    }

    // 기본 검색창과 네비게이션 검색창 동기화
    if (searchInput && searchInputNav) {
      searchInput.addEventListener("input", (e) => {
        searchInputNav.value = e.target.value;
      });
    }

    // 카테고리 필터링 기능
    this.setupCategoryFiltering();

    // 필터 리셋 버튼
    const resetFilterBtn = document.getElementById("resetFilter");
    if (resetFilterBtn) {
      resetFilterBtn.addEventListener("click", () => this.resetFilter());
    }

    // 장바구니 버튼 이벤트
    this.setupCartEventListeners();

    // 마이페이지 관련 이벤트 리스너
    this.setupMypageEventListeners();

    // 페이지 언로드 시 슬라이드쇼 정리
    window.addEventListener("beforeunload", () => {
      this.stopHeroSlideshow();
    });

    // 윈도우 리사이즈 시 슬라이더 설정 업데이트
    window.addEventListener("resize", () => {
      this.updateSliderSettings();
      this.updateFeaturedSlider();
    });

    // 특가 상품 슬라이더 이벤트
    this.setupFeaturedSliderEvents();

    // 검색 모달 이벤트 리스너
    this.setupSearchModalEvents();
  }

  // 상품 상세 모달 이벤트 리스너 설정
  setupProductDetailModal() {
    const productDetailModal = document.getElementById("productDetailModal");
    const productDetailClose = document.getElementById("productDetailClose");
    const productDetailCancel = document.getElementById("productDetailCancel");
    const addToCartBtn = document.getElementById("addToCartBtn");
    const decreaseQty = document.getElementById("decreaseQty");
    const increaseQty = document.getElementById("increaseQty");
    const quantityInput = document.getElementById("quantityInput");

    // 모달 닫기
    if (productDetailClose) {
      productDetailClose.onclick = () =>
        (productDetailModal.style.display = "none");
    }
    if (productDetailCancel) {
      productDetailCancel.onclick = () =>
        (productDetailModal.style.display = "none");
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
      quantityInput.addEventListener("input", () => {
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
  }

  // 상품 상세 모달 열기
  openProductDetailModal(productId) {
    const product =
      this.products.find((p) => p.id === productId) ||
      this.featuredProducts.find((p) => p.id === productId);

    if (!product) {
      console.error("상품을 찾을 수 없습니다:", productId);
      return;
    }

    this.selectedProduct = product;

    // 모달 내용 업데이트
    document.getElementById("productDetailTitle").textContent = product.name;
    document.getElementById("productDetailName").textContent = product.name;
    document.getElementById("productDetailSummary").textContent =
      product.summary || "";
    document.getElementById(
      "productDetailPrice"
    ).textContent = `${product.price.toLocaleString()}원`;



    // 원가 표시
    const originalPriceElement = document.getElementById(
      "productDetailOriginalPrice"
    );
    if (product.originalPrice && product.originalPrice > product.price) {
      originalPriceElement.textContent = `${product.originalPrice.toLocaleString()}원`;
      originalPriceElement.style.display = "inline";
    } else {
      originalPriceElement.style.display = "none";
    }

    // 이미지 설정
    const imageContainer = document.getElementById(
      "productDetailImageContainer"
    );
    if (product.image) {
      // 절대 URL인 경우 그대로 사용
      if (product.image.startsWith("http")) {
        imageContainer.innerHTML = `<img src="${product.image}" alt="${product.name}">`;
      } 
      // 상대 경로인 경우 /uploads/ 경로로 처리
      else if (product.image.startsWith("/uploads/")) {
        imageContainer.innerHTML = `<img src="${product.image}" alt="${product.name}">`;
      }
      // 파일명만 있는 경우 /uploads/products/ 경로 추가
      else {
        imageContainer.innerHTML = `<img src="/uploads/products/${product.image}" alt="${product.name}">`;
      }
    } else {
      imageContainer.innerHTML = `<div class="product-image-placeholder">📦</div>`;
    }

    // 수량 초기화
    document.getElementById("quantityInput").value = 1;
    this.updateTotalPrice();

    // 모달 표시
    document.getElementById("productDetailModal").style.display = "block";
  }

  // 총 가격 업데이트
  updateTotalPrice() {
    if (!this.selectedProduct) return;

    const quantity =
      parseInt(document.getElementById("quantityInput").value) || 1;
    const totalPrice = this.selectedProduct.price * quantity;
    document.getElementById(
      "totalPrice"
    ).textContent = `${totalPrice.toLocaleString()}원`;
  }

  // 모달에서 장바구니에 추가
  addToCartFromModal() {
    if (!this.selectedProduct) return;

    const quantity =
      parseInt(document.getElementById("quantityInput").value) || 1;

    // 장바구니에 추가
    this.addToCart(this.selectedProduct.id, quantity);

    // 모달 닫기
    document.getElementById("productDetailModal").style.display = "none";
  }

  setupCategoryDropdown() {
    const categoryDropdown = document.querySelector(".category-dropdown");
    const categoryBtn = document.querySelector(".category-btn");
    const categoryMenu = document.querySelector(".category-dropdown-menu");

    if (!categoryDropdown || !categoryBtn || !categoryMenu) return;

    let hoverTimeout;

    // 드롭다운 표시
    const showDropdown = () => {
      clearTimeout(hoverTimeout);
      categoryMenu.style.display = "block";
    };

    // 드롭다운 숨기기 (지연 적용)
    const hideDropdown = () => {
      hoverTimeout = setTimeout(() => {
        categoryMenu.style.display = "none";
      }, 150); // 150ms 지연으로 호버 끊김 방지
    };

    // 버튼 호버 이벤트
    categoryBtn.addEventListener("mouseenter", showDropdown);
    categoryBtn.addEventListener("mouseleave", hideDropdown);

    // 메뉴 호버 이벤트
    categoryMenu.addEventListener("mouseenter", showDropdown);
    categoryMenu.addEventListener("mouseleave", hideDropdown);

    // 드롭다운 전체 영역 호버 이벤트
    categoryDropdown.addEventListener("mouseenter", showDropdown);
    categoryDropdown.addEventListener("mouseleave", hideDropdown);
  }

  setupHeaderScroll() {
    const headerNav = document.getElementById("headerNav");
    if (!headerNav) return;

    let ticking = false;
    let headerNavOffset = 0;
    let isScrolled = false;

    // header-nav의 초기 위치 계산 (히스테리시스 적용)
    const calculateOffset = () => {
      const headerTop = document.getElementById("headerTop");
      if (headerTop) {
        // headerTop의 높이에서 약간의 여유를 둠
        headerNavOffset = headerTop.offsetHeight - 10;
      }
    };

    const updateHeader = () => {
      const scrollY = window.scrollY;

      // 히스테리시스 적용: 스크롤 방향에 따라 다른 임계값 사용
      if (!isScrolled && scrollY > headerNavOffset + 20) {
        // 아래로 스크롤할 때는 더 많이 스크롤해야 scrolled 클래스 추가
        headerNav.classList.add("scrolled");
        isScrolled = true;
      } else if (isScrolled && scrollY < headerNavOffset - 10) {
        // 위로 스크롤할 때는 더 적게 스크롤해도 scrolled 클래스 제거
        headerNav.classList.remove("scrolled");
        isScrolled = false;
      }

      ticking = false;
    };

    // 초기 offset 계산
    calculateOffset();

    // 리사이즈 시 offset 재계산
    window.addEventListener("resize", () => {
      calculateOffset();
      // 리사이즈 후 현재 상태 재평가
      if (!ticking) {
        requestAnimationFrame(updateHeader);
        ticking = true;
      }
    });

    window.addEventListener("scroll", () => {
      if (!ticking) {
        requestAnimationFrame(updateHeader);
        ticking = true;
      }
    });

    // 초기 상태 설정
    updateHeader();
  }

  setupCategoryFiltering() {
    // 드롭다운 메뉴의 카테고리 링크에 이벤트 리스너 추가
    document.querySelectorAll('.dropdown-item[href^="#"]').forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const categoryName = link.getAttribute("href").substring(1);
        this.filterByCategory(categoryName);
      });
    });
  }

  async filterByCategory(categoryName) {
    this.currentCategory = categoryName;

    // 로딩 상태 표시
    const productsGrid = document.getElementById("productsGrid");
    productsGrid.innerHTML =
      '<div class="loading-state">상품을 불러오는 중...</div>';

    try {
      await this.loadProducts(categoryName);
      this.renderProducts();
      this.updateProductsTitle(categoryName);

      // 상품 섹션으로 스크롤
      document.getElementById("products").scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    } catch (error) {
      console.error("카테고리 필터링 오류:", error);
      productsGrid.innerHTML =
        '<div class="error-state">상품을 불러오는데 실패했습니다.</div>';
    }
  }

  async resetFilter() {
    this.currentCategory = null;

    // 로딩 상태 표시
    const productsGrid = document.getElementById("productsGrid");
    productsGrid.innerHTML =
      '<div class="loading-state">상품을 불러오는 중...</div>';

    try {
      await this.loadProducts();
      this.renderProducts();
      this.updateProductsTitle();
    } catch (error) {
      console.error("필터 리셋 오류:", error);
      productsGrid.innerHTML =
        '<div class="error-state">상품을 불러오는데 실패했습니다.</div>';
    }
  }

  updateProductsTitle(categoryName = null) {
    const titleElement = document.getElementById("products-title");
    const subtitleElement = document.getElementById("products-subtitle");
    const resetButton = document.getElementById("resetFilter");

    if (categoryName) {
      // 카테고리별 제목 매핑
      const categoryTitles = {
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

      const categoryTitle = categoryTitles[categoryName] || categoryName;
      titleElement.textContent = categoryTitle;
      subtitleElement.textContent = `${categoryTitle} 카테고리의 프리미엄 제품들을 만나보세요`;
      resetButton.style.display = "block";
    } else {
      titleElement.textContent = "전체 상품";
      subtitleElement.textContent =
        "건강한 라이프스타일을 위한 프리미엄 제품들을 만나보세요";
      resetButton.style.display = "none";
    }
  }

  scrollToProducts() {
    document.getElementById("products").scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  performSearch(searchValue = null) {
    let searchTerm;

    if (searchValue !== null) {
      searchTerm = searchValue.trim();
    } else {
      const searchInput = document.querySelector(".search-input");
      searchTerm = searchInput ? searchInput.value.trim() : "";
    }

    if (!searchTerm) {
      // 검색어가 없으면 전체 상품 표시
      this.currentCategory = null;
      this.loadProducts().then(() => this.renderProducts());
      return;
    }

    // 검색 기능 구현
    const filteredProducts = this.products.filter(
      (product) =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    this.products = filteredProducts;
    this.renderProducts();

    // 상품 섹션으로 스크롤
    this.scrollToProducts();
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

    window.onclick = (event) => {
      if (event.target === mypageModal) {
        mypageModal.style.display = "none";
      }
    };

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
    document.querySelectorAll(".tab-content").forEach((content) => {
      content.classList.remove("active");
    });

    // 선택된 탭과 콘텐츠 활성화
    document.querySelector(`[data-tab="${tabName}"]`).classList.add("active");
    document.getElementById(`${tabName}-tab`).classList.add("active");

    // 탭별 데이터 로드
    switch (tabName) {
      case "orders":
        this.loadOrders();
        break;
      case "wishlist":
        this.loadWishlist();
        break;
      case "reviews":
        this.loadReviews();
        break;
      case "points":
        this.loadPointsHistory();
        // 포인트 내역 드롭다운 초기화 (닫힌 상태)
        this.resetPointsHistoryDropdown();
        break;
    }
  }

  async loadMypageData() {
    // 모든 마이페이지 데이터를 병렬로 로드
    await Promise.all([
      this.loadOrders(),
      this.loadWishlist(),
      this.loadReviews(),
      this.loadPointsHistory(),
    ]);
  }

  async loadOrders() {
    try {
      const response = await fetch("/api/shop/orders", {
        credentials: "include",
      });
      const data = await response.json();

      if (data.success) {
        this.renderOrders(data.data);
      } else {
        this.renderOrders([]);
      }
    } catch (error) {
      console.error("주문 내역 조회 오류:", error);
      this.renderOrders([]);
    }
  }

  renderOrders(orders) {
    const ordersList = document.getElementById("ordersList");

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

    ordersList.innerHTML = orders
      .map(
        (order) => `
            <div class="order-item">
                <div class="order-header">
                    <div class="order-date">주문일: ${new Date(
                      order.created_at
                    ).toLocaleDateString("ko-KR")}</div>
                    <div class="order-status ${this.getStatusClass(
                      order.status
                    )}">${this.getStatusText(order.status)}</div>
                </div>
                <div class="order-products">
                    ${
                      order.items
                        ? order.items
                            .map(
                              (item) => `
                        <div class="order-product">
                            <div class="order-product-image">${
                              this.getDefaultEmoji(item.category) || "📦"
                            }</div>
                            <div class="order-product-info">
                                <div class="order-product-name">${
                                  item.name || "상품명 없음"
                                }</div>
                                <div class="order-product-details">수량: ${
                                  item.quantity
                                }개 | 단가: ${item.price.toLocaleString()}원</div>
                            </div>
                        </div>
                    `
                            )
                            .join("")
                        : ""
                    }
                </div>
                <div class="order-total">
                    ${
                      order.points_used > 0
                        ? `포인트 사용: ${order.points_used.toLocaleString()}P<br>`
                        : ""
                    }
                    총 결제금액: ${order.total_amount.toLocaleString()}원
                </div>
            </div>
        `
      )
      .join("");
  }

  getStatusClass(status) {
    const statusMap = {
      pending: "status-pending",
      processing: "status-processing",
      shipped: "status-shipped",
      delivered: "status-delivered",
    };
    return statusMap[status] || "status-pending";
  }

  getStatusText(status) {
    const statusMap = {
      pending: "주문 확인중",
      processing: "배송 준비중",
      shipped: "배송중",
      delivered: "배송 완료",
    };
    return statusMap[status] || "주문 확인중";
  }

  async loadWishlist() {
    try {
      const response = await fetch("/api/shop/wishlist", {
        credentials: "include",
      });
      const data = await response.json();

      if (data.success) {
        this.renderWishlist(data.data);
      } else {
        this.renderWishlist([]);
      }
    } catch (error) {
      console.error("찜한 상품 조회 오류:", error);
      this.renderWishlist([]);
    }
  }

  renderWishlist(wishlist) {
    const wishlistGrid = document.getElementById("wishlistGrid");

    if (!wishlist || wishlist.length === 0) {
      // 비어있는 경우: 그리드를 flex 중앙 정렬 상태로 전환
      if (wishlistGrid) {
        wishlistGrid.classList.add("is-empty");
      }
      wishlistGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">💝</div>
                    <div class="empty-state-text">찜한 상품이 없습니다</div>
                    <div class="empty-state-subtext">마음에 드는 상품을 찜해보세요!</div>
                </div>
            `;
      return;
    }

    // 아이템이 있는 경우: 일반 그리드 레이아웃으로 복귀
    if (wishlistGrid) {
      wishlistGrid.classList.remove("is-empty");
    }
    wishlistGrid.innerHTML = wishlist
      .map(
        (item) => `
            <div class="wishlist-item">
                <div class="wishlist-item-image">${
                  item.image_url || this.getDefaultEmoji(item.category) || "📦"
                }</div>
                <div class="wishlist-item-info">
                    <div class="wishlist-item-name">${
                      item.name || "상품명 없음"
                    }</div>
                    <div class="wishlist-item-price">${
                      item.price ? item.price.toLocaleString() : "0"
                    }원</div>
                    <div class="wishlist-actions">
                        <button class="btn-small btn-buy" onclick="eatpleStore.buyFromWishlist('${
                          item.id
                        }')">구매</button>
                        <button class="btn-small btn-remove" onclick="eatpleStore.removeFromWishlist('${
                          item.id
                        }')">삭제</button>
                    </div>
                </div>
            </div>
        `
      )
      .join("");
  }

  async removeFromWishlist(productId) {
    try {
      const response = await fetch(`/api/shop/wishlist/${productId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json();

      if (data.success) {
        this.loadWishlist(); // 목록 새로고침
      } else {
        alert("찜 삭제에 실패했습니다.");
      }
    } catch (error) {
      console.error("찜 삭제 오류:", error);
      alert("찜 삭제 중 오류가 발생했습니다.");
    }
  }

  buyFromWishlist(productId) {
    // 찜한 상품에서 바로 구매
    const product = this.products.find((p) => p.id === productId);
    if (product) {
      this.openPurchaseModal(product);
    }
  }

  async loadReviews() {
    try {
      const [pendingResponse, myReviewsResponse] = await Promise.all([
        fetch("/api/shop/reviews/pending", { credentials: "include" }),
        fetch("/api/shop/reviews/my", { credentials: "include" }),
      ]);

      const pendingData = await pendingResponse.json();
      const myReviewsData = await myReviewsResponse.json();

      this.renderPendingReviews(pendingData.success ? pendingData.data : []);
      this.renderMyReviews(myReviewsData.success ? myReviewsData.data : []);
    } catch (error) {
      console.error("리뷰 데이터 조회 오류:", error);
      this.renderPendingReviews([]);
      this.renderMyReviews([]);
    }
  }

  renderPendingReviews(pendingReviews) {
    const pendingReviewsContainer = document.getElementById("pendingReviews");

    if (!pendingReviews || pendingReviews.length === 0) {
      pendingReviewsContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">✍️</div>
                    <div class="empty-state-text">작성 가능한 리뷰가 없습니다</div>
                    <div class="empty-state-subtext">상품을 구매하시면 리뷰를 작성할 수 있습니다</div>
                </div>
            `;
      return;
    }

    pendingReviewsContainer.innerHTML = pendingReviews
      .map(
        (item) => `
            <div class="review-item">
                <div class="review-product">
                    <div class="review-product-image">${
                      this.getDefaultEmoji(item.category) || "📦"
                    }</div>
                    <div class="review-product-info">
                        <div class="review-product-name">${
                          item.product_name || "상품명 없음"
                        }</div>
                        <div class="review-product-date">배송 완료된 상품</div>
                    </div>
                </div>
                <button class="btn-primary" onclick="eatpleStore.openReviewModal('${
                  item.order_id
                }', '${item.product_id}')">
                    리뷰 작성
                </button>
            </div>
        `
      )
      .join("");
  }

  renderMyReviews(myReviews) {
    const myReviewsContainer = document.getElementById("myReviews");

    if (!myReviews || myReviews.length === 0) {
      myReviewsContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📝</div>
                    <div class="empty-state-text">작성한 리뷰가 없습니다</div>
                    <div class="empty-state-subtext">첫 리뷰를 작성해보세요!</div>
                </div>
            `;
      return;
    }

    myReviewsContainer.innerHTML = myReviews
      .map(
        (review) => `
            <div class="review-item">
                <div class="review-product">
                    <div class="review-product-image">${
                      this.getDefaultEmoji(review.category) || "📦"
                    }</div>
                    <div class="review-product-info">
                        <div class="review-product-name">${
                          review.product_name || "상품명 없음"
                        }</div>
                        <div class="review-rating">${"★".repeat(
                          review.rating
                        )}${"☆".repeat(5 - review.rating)}</div>
                        <div class="review-content">${review.content}</div>
                        <div class="review-date">작성일: ${new Date(
                          review.created_at
                        ).toLocaleDateString("ko-KR")}</div>
                    </div>
                </div>
            </div>
        `
      )
      .join("");
  }

  async loadPointsHistory() {
    try {
      const response = await fetch("/api/points/history", {
        credentials: "include",
      });
      const data = await response.json();

      if (data.success) {
        this.renderPointsHistory(data.data);
        // 현재 포인트 업데이트
        document.getElementById(
          "currentPointsAmount"
        ).textContent = `${this.userPoints.toLocaleString()}P`;
      } else {
        this.renderPointsHistory([]);
      }
    } catch (error) {
      console.error("포인트 내역 조회 오류:", error);
      this.renderPointsHistory([]);
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
                <div class="points-amount ${
                  item.type === "earn" ? "earned" : "used"
                }">
                    ${
                      item.type === "earn" ? "+" : "-"
                    }${item.amount.toLocaleString()}P
                </div>
            </div>
        `
      )
      .join("");
  }

  resetPointsHistoryDropdown() {
    const pointsList = document.getElementById("pointsList");
    const arrow = document.getElementById("pointsHistoryArrow");

    if (pointsList && arrow) {
      // 드롭다운을 닫힌 상태로 초기화
      pointsList.style.display = "none";
      pointsList.classList.remove("expanded");
      arrow.classList.remove("rotated");
      arrow.textContent = "▼";
    }
  }

  // 리뷰 작성 모달 관련 메서드들
  setupReviewModalEvents() {
    const reviewModal = document.getElementById("reviewModal");
    const reviewModalClose = document.getElementById("reviewModalClose");
    const reviewCancelBtn = document.getElementById("reviewCancelBtn");
    const reviewSubmitBtn = document.getElementById("reviewSubmitBtn");

    // 모달 닫기
    if (reviewModalClose) {
      reviewModalClose.onclick = () => (reviewModal.style.display = "none");
    }
    if (reviewCancelBtn) {
      reviewCancelBtn.onclick = () => (reviewModal.style.display = "none");
    }

    window.onclick = (event) => {
      if (event.target === reviewModal) {
        reviewModal.style.display = "none";
      }
    };

    // 별점 클릭 이벤트
    document.querySelectorAll(".star").forEach((star) => {
      star.addEventListener("click", (e) => {
        const rating = parseInt(e.target.dataset.rating);
        this.setStarRating(rating);
      });
    });

    // 리뷰 제출
    if (reviewSubmitBtn) {
      reviewSubmitBtn.onclick = () => this.submitReview();
    }
  }

  openReviewModal(orderId, productId) {
    this.currentReviewOrderId = orderId;
    this.currentReviewProductId = productId;

    // 상품 정보 표시 - 실제 상품 정보를 API에서 가져오거나 기본 정보 표시
    document.getElementById("reviewProductInfo").innerHTML = `
            <div class="review-product-image">📦</div>
            <div>
                <div class="review-product-name">구매하신 상품</div>
                <div class="review-product-description">리뷰를 작성해주세요</div>
            </div>
        `;

    // 폼 초기화
    this.setStarRating(0);
    document.getElementById("reviewText").value = "";

    // 모달 표시
    document.getElementById("reviewModal").style.display = "block";
  }

  setStarRating(rating) {
    this.currentRating = rating;
    document.querySelectorAll(".star").forEach((star, index) => {
      if (index < rating) {
        star.classList.add("active");
      } else {
        star.classList.remove("active");
      }
    });
  }

  async submitReview() {
    if (!this.currentRating || this.currentRating === 0) {
      alert("별점을 선택해주세요.");
      return;
    }

    const reviewText = document.getElementById("reviewText").value.trim();
    if (!reviewText) {
      alert("리뷰 내용을 입력해주세요.");
      return;
    }

    try {
      const response = await fetch("/api/shop/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          order_id: this.currentReviewOrderId,
          product_id: this.currentReviewProductId,
          rating: this.currentRating,
          content: reviewText,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert("리뷰가 성공적으로 등록되었습니다.");
        document.getElementById("reviewModal").style.display = "none";
        this.loadReviews(); // 리뷰 목록 새로고침
      } else {
        alert("리뷰 등록에 실패했습니다: " + data.error);
      }
    } catch (error) {
      console.error("리뷰 등록 오류:", error);
      alert("리뷰 등록 중 오류가 발생했습니다.");
    }
  }

  setupRealTimeUpdates() {
    // 관리자 페이지에서 상품 업데이트 시 실시간 반영
    window.addEventListener("adminProductsUpdated", async (event) => {
      console.log("관리자 상품 업데이트 감지, 스토어 새로고침");
      await this.loadProducts(this.currentCategory);
      await this.loadFeaturedProducts();
      this.renderProducts();
      this.renderFeaturedProducts();
    });

    // localStorage 변경 감지 (다른 탭에서 변경 시)
    window.addEventListener("storage", async (event) => {
      if (event.key === "adminProducts") {
        console.log("다른 탭에서 상품 업데이트 감지");
        await this.loadProducts(this.currentCategory);
        await this.loadFeaturedProducts();
        this.renderProducts();
        this.renderFeaturedProducts();
      }
    });

    // Poll for product updates every 2 minutes (사용자 경험 개선을 위해 주기 연장)
    setInterval(async () => {
      await this.loadProducts(this.currentCategory);
      await this.loadFeaturedProducts();
      this.renderProducts();
      this.renderFeaturedProducts();
    }, 120000);

    // Listen for visibility change to refresh when user returns to tab
    document.addEventListener("visibilitychange", async () => {
      if (!document.hidden) {
        await this.loadProducts(this.currentCategory);
        await this.loadFeaturedProducts();
        this.renderProducts();
        this.renderFeaturedProducts();
      }
    });
  }

  async renderPromotions() {
    const track = document.getElementById("promotionTrack");
    if (!track) return;

    const promotions = await this.getPromotions();

    track.innerHTML = promotions
      .map((promo) => {
        let content = `
                <div class="promotion-card ${promo.theme}">
                    <div class="promotion-content">
            `;

        if (promo.badge) {
          content += `<div class="promotion-badge">${promo.badge}</div>`;
        }

        if (promo.icons) {
          content += `
                    <div class="promotion-icons">
                        <div class="icon-group">
                            <span class="icon">${promo.icons[0]}</span>
                            <span class="icon">${promo.icons[1]}</span>
                        </div>
                        <div class="icon-group">
                            <span class="icon">${promo.icons[2]}</span>
                            <span class="icon">${promo.icons[3]}</span>
                        </div>
                    </div>
                `;
        }

        content += `
                <div class="promotion-text">
                    <h3 class="promotion-title">${promo.title}</h3>
                    <p class="promotion-subtitle">${promo.subtitle}</p>
                    <p class="promotion-description">${promo.description}</p>
            `;

        if (promo.tag) {
          content += `<p class="promotion-tag">${promo.tag}</p>`;
        }

        content += `</div>`;

        if (promo.image) {
          content += `
                    <div class="promotion-image">
                        <img src="${promo.image}" alt="${promo.title} 프로모션">
                    </div>
                `;
        }

        content += `
                    </div>
                </div>
            `;

        return content;
      })
      .join("");

    // 슬라이더 설정 업데이트
    this.updateSliderSettings();
  }

  renderCategories() {
    const categoryGrid = document.getElementById("categoryGrid");
    if (!categoryGrid) return;

    categoryGrid.innerHTML = "";

    this.categories.forEach((category) => {
      const card = document.createElement("div");
      card.className = "category-card";
      card.onclick = () =>
        (window.location.href = `category.html?category=${category.name}`);

      card.innerHTML = `
                <img src="${
                  category.image ||
                  "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&h=300&fit=crop"
                }" alt="${
        category.display_name || category.name
      }" class="category-image">
                <div class="category-info">
                    <h3 class="category-name">${
                      category.display_name || category.name
                    }</h3>
                    <p class="category-description">${
                      category.description || ""
                    }</p>
                    <small>${category.products || 0}개 상품</small>
                </div>
            `;

      categoryGrid.appendChild(card);
    });
  }

  renderFeaturedProducts() {
    const featuredGrid = document.getElementById("featuredGrid");
    if (!featuredGrid) return;

    // 전체 상품이 0개면 특가 섹션도 동일한 공백 상태 표시
    if (this.products && this.products.length === 0) {
      featuredGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📦</div>
                    <div class="empty-state-text">표시할 상품이 없습니다</div>
                    <div class="empty-state-subtext">곧 새로운 특가 상품을 준비할 예정입니다</div>
                </div>
            `;
      return;
    }

    if (!this.featuredProducts || this.featuredProducts.length === 0) {
      featuredGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🔥</div>
                    <div class="empty-state-text">특가 상품이 없습니다</div>
                    <div class="empty-state-subtext">곧 새로운 특가 상품을 준비할 예정입니다</div>
                </div>
            `;
      return;
    }

    featuredGrid.innerHTML = "";

    this.featuredProducts.forEach((product) => {
      const productCard = this.createFeaturedProductCard(product);
      featuredGrid.appendChild(productCard);
    });

    // 슬라이더 초기화
    this.featuredCurrentSlide = 0;
    this.updateFeaturedSlider();
  }

  createFeaturedProductCard(product) {
    const card = document.createElement("div");
    card.className = "product-card featured-card";
    card.style.cursor = "pointer";

    // 제품 카드 클릭 시 상세 페이지로 이동
    card.addEventListener("click", (e) => {
      // 버튼 클릭 시에는 상세 페이지로 이동하지 않음
      if (e.target.closest(".cart-add-button")) {
        return;
      }
      this.goToProductDetail(product.id);
    });

    // 할인율 계산
    const discount =
      product.originalPrice && product.originalPrice > product.price
        ? Math.round(
            ((product.originalPrice - product.price) / product.originalPrice) *
              100
          )
        : 0;

    card.innerHTML = `
            <div class="product-image-container">
                ${this.createImageHtml(
                  product.image,
                  product.name,
                  product.category
                )}
            </div>
            <div class="product-cart-section">
                <div class="product-actions">
                    <button class="cart-add-button" onclick="event.stopPropagation(); eatpleStore.openProductDetailModal('${
                      product.id
                    }')" title="상품 상세보기">
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
                <p class="product-summary">${this.escapeHtml(
                  product.summary || ""
                )}</p>
                <div class="product-meta">
                    <div class="product-price">
                        ${
                          product.originalPrice &&
                          product.originalPrice > product.price
                            ? `<span class="original-price">${product.originalPrice.toLocaleString()}원</span>`
                            : ""
                        }
                        <div class="price-row">
                            ${
                              discount > 0
                                ? `<span class="discount-rate">${discount}%</span>`
                                : ""
                            }
                            <span class="current-price">${product.price.toLocaleString()}원</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

    return card;
  }

  async loadProductImage(productId, imgElement, placeholderElement) {
    try {
      const response = await fetch(`/api/shop/products/${productId}/image`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.image_url) {
          // Base64 이미지인지 확인
          if (
            data.data.image_url.startsWith("data:image/") ||
            data.data.image_url.startsWith("http")
          ) {
            imgElement.src = data.data.image_url;
            imgElement.onload = () => {
              imgElement.style.display = "block";
              placeholderElement.style.display = "none";
            };
            imgElement.onerror = () => {
              // 이미지 로딩 실패시 플레이스홀더 유지
              console.warn(`Failed to load image for product ${productId}`);
            };
          }
        }
      }
    } catch (error) {
      console.warn(`Error loading image for product ${productId}:`, error);
    }
  }

  renderProducts() {
    const productsGrid = document.getElementById("productsGrid");

    if (this.products.length === 0) {
      productsGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📦</div>
                    <div class="empty-state-text">표시할 상품이 없습니다</div>
                    <div class="empty-state-subtext">다른 카테고리를 선택해보세요</div>
                </div>
            `;
      return;
    }

    productsGrid.innerHTML = "";

    this.products.forEach((product) => {
      const productCard = this.createProductCard(product);
      productsGrid.appendChild(productCard);
    });
  }

  createProductCard(product) {
    const card = document.createElement("div");
    card.className = "product-card";
    card.style.cursor = "pointer";

    // 제품 카드 클릭 시 상세 페이지로 이동
    card.addEventListener("click", (e) => {
      // 버튼 클릭 시에는 상세 페이지로 이동하지 않음
      if (e.target.closest(".cart-add-button")) {
        return;
      }
      this.goToProductDetail(product.id);
    });

    // 할인율 계산
    const discount =
      product.originalPrice && product.originalPrice > product.price
        ? Math.round(
            ((product.originalPrice - product.price) / product.originalPrice) *
              100
          )
        : 0;

    card.innerHTML = `
            <div class="product-image-container">
                ${this.createImageHtml(product.image, product.name)}
            </div>
            <div class="product-cart-section">
                <div class="product-actions">
                    <button class="cart-add-button" onclick="event.stopPropagation(); eatpleStore.openProductDetailModal('${
                      product.id
                    }')" title="상품 상세보기">
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
                <p class="product-summary">${this.escapeHtml(
                  product.summary || ""
                )}</p>
                <div class="product-meta">
                    <div class="product-price">
                        ${
                          product.originalPrice &&
                          product.originalPrice > product.price
                            ? `<span class="original-price">${product.originalPrice.toLocaleString()}원</span>`
                            : ""
                        }
                        <div class="price-row">
                            ${
                              discount > 0
                                ? `<span class="discount-rate">${discount}%</span>`
                                : ""
                            }
                            <span class="current-price">${product.price.toLocaleString()}원</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

    return card;
  }

  updateSliderSettings() {
    const track = document.getElementById("promotionTrack");
    if (!track) return;

    const cards = track.querySelectorAll(".promotion-card");
    const totalCards = cards.length;

    // 화면 크기에 따른 보이는 카드 수 계산
    const containerWidth = track.parentElement.offsetWidth;
    const cardWidth = 320; // 카드 너비 + 간격 (300px + 20px)
    const visibleCards = Math.floor(containerWidth / cardWidth);

    // 실제 슬라이드 가능한 개수 계산 (마지막에 빈 공간이 생기지 않도록)
    this.totalSlides = Math.max(1, totalCards - visibleCards + 1);

    // 현재 슬라이드가 범위를 벗어나면 조정
    if (this.currentSlide >= this.totalSlides) {
      this.currentSlide = this.totalSlides - 1;
    }

    // 총 슬라이드 수 업데이트
    const totalSlidesElement = document.querySelector(".total-slides");
    if (totalSlidesElement) {
      totalSlidesElement.textContent = `/ ${String(this.totalSlides).padStart(
        2,
        "0"
      )}`;
    }

    this.updateSlider();
  }

  nextSlide() {
    if (this.currentSlide < this.totalSlides - 1) {
      this.currentSlide++;
    } else {
      this.currentSlide = 0; // 마지막에서 처음으로
    }
    this.updateSlider();
  }

  previousSlide() {
    if (this.currentSlide > 0) {
      this.currentSlide--;
    } else {
      this.currentSlide = this.totalSlides - 1; // 처음에서 마지막으로
    }
    this.updateSlider();
  }

  updateSlider() {
    const track = document.getElementById("promotionTrack");
    const currentSlideElement = document.getElementById("currentSlide");

    if (track) {
      const cardWidth = 320; // 카드 너비 + 간격
      const translateX = -this.currentSlide * cardWidth;
      track.style.transform = `translateX(${translateX}px)`;
    }

    if (currentSlideElement) {
      currentSlideElement.textContent = String(this.currentSlide + 1).padStart(
        2,
        "0"
      );
    }
  }

  async openPurchaseModal(productId) {
    // Find product from all sources
    this.selectedProduct =
      this.products.find((p) => p.id === productId) ||
      this.featuredProducts.find((p) => p.id === productId);

    if (!this.selectedProduct) return;

    // Track product view
    await this.trackProductView(productId);

    const modal = document.getElementById("purchaseModal");
    const pointsInput = document.getElementById("pointsInput");
    const availablePoints = document.getElementById("availablePoints");

    // 모달 초기화
    this.hideMessages();
    document.getElementById("purchaseForm").style.display = "block";
    document.getElementById("loadingSpinner").style.display = "none";

    // 비로그인 사용자 체크
    if (this.userPoints === 0) {
      // 비로그인 사용자에게 로그인 안내
      this.showError(
        '로그인이 필요한 서비스입니다.<br><a href="login.html" style="color: #007bff; text-decoration: underline;">로그인하기</a>'
      );
      modal.style.display = "block";
      return;
    }

    // 포인트 입력 설정
    const maxUsablePoints = Math.min(
      this.userPoints,
      this.selectedProduct.price
    );
    pointsInput.max = maxUsablePoints;
    pointsInput.value = 0;
    if (availablePoints) {
      availablePoints.textContent = this.userPoints.toLocaleString();
    }

    // 구매 요약 업데이트
    this.updatePurchaseSummary();

    modal.style.display = "block";
  }

  async trackProductView(productId) {
    try {
      await fetch(`/api/shop/products/${productId}/view`, {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("상품 조회 추적 오류:", error);
    }
  }

  updatePurchaseSummary() {
    if (!this.selectedProduct) return;

    const pointsInput = document.getElementById("pointsInput");
    const pointsToUse = parseInt(pointsInput.value) || 0;
    const originalPrice = this.selectedProduct.price;
    const discount = pointsToUse;
    const finalPrice = originalPrice - discount;

    const summaryHtml = `
            <div class="summary-row">
                <span>상품명:</span>
                <span>${this.selectedProduct.name}</span>
            </div>
            <div class="summary-row">
                <span>정가:</span>
                <span>${originalPrice.toLocaleString()}원</span>
            </div>
            <div class="summary-row">
                <span>포인트 할인:</span>
                <span>-${discount.toLocaleString()}원</span>
            </div>
            <div class="summary-row total">
                <span>최종 결제금액:</span>
                <span>${finalPrice.toLocaleString()}원</span>
            </div>
        `;

    document.getElementById("purchaseSummary").innerHTML = summaryHtml;
  }

  validatePointsInput() {
    const pointsInput = document.getElementById("pointsInput");
    const value = parseInt(pointsInput.value) || 0;
    const maxUsable = Math.min(
      this.userPoints,
      this.selectedProduct?.price || 0
    );

    if (value > maxUsable) {
      pointsInput.value = maxUsable;
    } else if (value < 0) {
      pointsInput.value = 0;
    }
  }

  async processPurchase() {
    if (!this.selectedProduct) return;

    // 비로그인 사용자 체크
    if (this.userPoints === 0) {
      this.showError(
        '로그인이 필요한 서비스입니다.<br><a href="login.html" style="color: #007bff; text-decoration: underline;">로그인하기</a>'
      );
      return;
    }

    const pointsToUse =
      parseInt(document.getElementById("pointsInput").value) || 0;
    const finalPrice = this.selectedProduct.price - pointsToUse;

    // 유효성 검사
    if (pointsToUse > this.userPoints) {
      this.showError("보유 포인트가 부족합니다.");
      return;
    }

    if (pointsToUse > this.selectedProduct.price) {
      this.showError("사용할 포인트가 상품 가격을 초과할 수 없습니다.");
      return;
    }

    // 로딩 표시
    this.showLoading();

    try {
      // 포인트 사용 처리
      if (pointsToUse > 0) {
        const response = await fetch("/api/points/spend", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            points: pointsToUse,
            purpose: "purchase",
            description: `${this.selectedProduct.name} 구매 시 포인트 할인`,
          }),
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || "포인트 사용에 실패했습니다.");
        }

        // 사용자 포인트 업데이트
        this.userPoints = data.remainingBalance;
        const availablePointsElement =
          document.getElementById("availablePoints");
        if (availablePointsElement) {
          availablePointsElement.textContent = this.userPoints.toLocaleString();
        }
      }

      // 구매 완료 처리 (실제 구현에서는 결제 API 호출)
      await this.simulatePurchase(finalPrice);

      // 성공 메시지 표시
      this.showSuccess(`구매가 완료되었습니다!<br>
                ${
                  pointsToUse > 0
                    ? `포인트 할인: ${pointsToUse.toLocaleString()}원<br>`
                    : ""
                }
                최종 결제금액: ${finalPrice.toLocaleString()}원`);

      // 헤더 인증 상태 업데이트 (포인트 변경으로 인한)
      if (window.headerAuthManager) {
        await window.headerAuthManager.refreshAuthStatus();
      }

      // 상품 목록 업데이트 (할인율 재계산)
      setTimeout(() => {
        this.renderProducts();
        this.renderFeaturedProducts();
        document.getElementById("purchaseModal").style.display = "none";
      }, 3000);
    } catch (error) {
      console.error("구매 처리 오류:", error);
      this.showError(error.message || "구매 처리 중 오류가 발생했습니다.");
    } finally {
      this.hideLoading();
    }
  }

  async simulatePurchase(amount) {
    return new Promise(async (resolve) => {
      setTimeout(async () => {
        console.log(`구매 완료: ${amount}원`);

        // 구매 추적 (analytics)
        if (this.selectedProduct) {
          try {
            await this.trackProductPurchase(this.selectedProduct.id, {
              amount: amount,
              pointsUsed: this.pointsToUse,
              finalPrice: amount,
            });
          } catch (error) {
            console.error("구매 추적 실패:", error);
          }
        }

        resolve();
      }, 1500);
    });
  }

  async trackProductPurchase(productId, purchaseData = {}) {
    try {
      const response = await fetch(`/api/shop/products/${productId}/purchase`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          amount: purchaseData.amount,
          pointsUsed: purchaseData.pointsUsed,
          finalPrice: purchaseData.finalPrice,
        }),
      });

      if (!response.ok) {
        console.warn("구매 추적 실패:", response.statusText);
      }
    } catch (error) {
      console.error("구매 추적 오류:", error);
    }
  }

  showLoading() {
    document.getElementById("purchaseForm").style.display = "none";
    document.getElementById("loadingSpinner").style.display = "block";
    this.hideMessages();
  }

  hideLoading() {
    document.getElementById("purchaseForm").style.display = "block";
    document.getElementById("loadingSpinner").style.display = "none";
  }

  showError(message) {
    const errorDiv = document.getElementById("errorMessage");
    errorDiv.innerHTML = message;
    errorDiv.style.display = "block";
    document.getElementById("successMessage").style.display = "none";
  }

  showSuccess(message) {
    const successDiv = document.getElementById("successMessage");
    successDiv.innerHTML = message;
    successDiv.style.display = "block";
    document.getElementById("errorMessage").style.display = "none";
  }

  hideMessages() {
    document.getElementById("errorMessage").style.display = "none";
    document.getElementById("successMessage").style.display = "none";
  }

  async filterByCategory(category) {
    this.currentCategory = category;

    // Load filtered products
    await this.loadProducts(category);
    this.renderProducts();

    // Update category cards
    const categoryCards = document.querySelectorAll(".category-card");
    categoryCards.forEach((card) => card.classList.remove("active"));

    if (category) {
      const activeCard = Array.from(categoryCards).find(
        (card) =>
          card.querySelector(".category-name").textContent ===
          (this.categories.find((c) => c.name === category)?.display_name ||
            category)
      );
      if (activeCard) activeCard.classList.add("active");
    }

    // Scroll to products section
    this.scrollToProducts();
  }

  performSearch() {
    const searchInput = document.querySelector(".search-input");
    const query = searchInput.value.trim().toLowerCase();

    if (!query) return;

    const filteredProducts = this.products.filter(
      (product) =>
        product.name.toLowerCase().includes(query) ||
        product.description.toLowerCase().includes(query)
    );

    // 검색 결과 표시
    const grid = document.getElementById("productsGrid");
    if (grid) {
      if (filteredProducts.length > 0) {
        grid.innerHTML = "";
        filteredProducts.forEach((product) => {
          const productCard = this.createProductCard(product);
          grid.appendChild(productCard);
        });
      } else {
        grid.innerHTML = '<div class="no-results">검색 결과가 없습니다.</div>';
      }
    }

    // 상품 섹션으로 스크롤
    this.scrollToProducts();
  }

  setupCartEventListeners() {
    // 장바구니 버튼 클릭 이벤트
    const cartButtons = document.querySelectorAll(".cart-btn");
    cartButtons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.href = "cart.html";
      });
    });
  }

  // 장바구니에 상품 추가
  addToCart(productId, quantity = 1) {
    const product =
      this.products.find((p) => p.id === productId) ||
      this.featuredProducts.find((p) => p.id === productId);

    if (!product) {
      alert("상품을 찾을 수 없습니다.");
      return;
    }

    // 로컬 스토리지에서 기존 장바구니 데이터 로드
    let cartItems = [];
    try {
      const cartData = localStorage.getItem("eatple_cart");
      cartItems = cartData ? JSON.parse(cartData) : [];
    } catch (error) {
      console.error("장바구니 데이터 로드 실패:", error);
      cartItems = [];
    }

    // 이미 장바구니에 있는 상품인지 확인
    const existingItemIndex = cartItems.findIndex(
      (item) => item.id === productId
    );

    if (existingItemIndex > -1) {
      // 이미 존재하는 상품이면 수량 증가
      cartItems[existingItemIndex].quantity += quantity;
    } else {
      // 새로운 상품 추가
      cartItems.push({
        id: product.id,
        name: product.name,
        price: product.price,
        originalPrice: product.originalPrice,
        brand: product.brand || '기본브랜드', // 브랜드 정보가 없으면 기본브랜드로 설정
        shippingFee: product.shippingFee || 3000,
        image: product.image,
        selected: true,
        quantity: quantity,
      });
    }

    // 로컬 스토리지에 저장
    try {
      localStorage.setItem("eatple_cart", JSON.stringify(cartItems));

      // 장바구니 개수 업데이트
      this.updateCartCount();

      // 성공 메시지 표시
      this.showToastMessage(
        `${product.name}이(가) 장바구니에 추가되었습니다.`,
        "success"
      );
    } catch (error) {
      console.error("장바구니 저장 실패:", error);
      this.showToastMessage(
        "장바구니에 상품을 추가하는데 실패했습니다.",
        "error"
      );
    }
  }

  // 장바구니 개수 업데이트 (제품 종류 개수)
  updateCartCount() {
    try {
      const cartData = localStorage.getItem("eatple_cart");
      const cartItems = cartData ? JSON.parse(cartData) : [];

      // cart.js와 동일한 계산 방식 사용
      let productTypesCount = 0;
      if (Array.isArray(cartItems) && cartItems.length > 0) {
        const hasAllIds = cartItems.every(
          (item) => item && typeof item.id !== "undefined" && item.id !== null
        );
        if (hasAllIds) {
          productTypesCount = new Set(cartItems.map((item) => item.id)).size;
        } else {
          const uniqueKeys = new Set(
            cartItems.map(
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
      console.error("장바구니 개수 업데이트 실패:", error);
    }
  }

  scrollToProducts() {
    const productsSection = document.getElementById("products");
    if (productsSection) {
      productsSection.scrollIntoView({ behavior: "smooth" });
    }
  }

  // 토스트 메시지 표시
  showToastMessage(message, type = "success") {
    // 기존 토스트 제거
    const existingToast = document.querySelector(".toast-message");
    if (existingToast) {
      existingToast.remove();
    }

    // 토스트 엘리먼트 생성
    const toast = document.createElement("div");
    toast.className = `toast-message toast-${type}`;
    toast.textContent = message;

    // 스타일 적용
    Object.assign(toast.style, {
      position: "fixed",
      top: "20px",
      right: "20px",
      background: type === "success" ? "#4a7c59" : "#dc3545",
      color: "white",
      padding: "12px 20px",
      borderRadius: "8px",
      fontSize: "14px",
      fontWeight: "500",
      zIndex: "10000",
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
      transform: "translateX(100%)",
      transition: "transform 0.3s ease-in-out",
      maxWidth: "300px",
      wordWrap: "break-word",
    });

    // DOM에 추가
    document.body.appendChild(toast);

    // 애니메이션으로 표시
    setTimeout(() => {
      toast.style.transform = "translateX(0)";
    }, 10);

    // 3초 후 자동 제거
    setTimeout(() => {
      toast.style.transform = "translateX(100%)";
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }

  // 제품 상세 페이지로 이동
  goToProductDetail(productId) {
    window.location.href = `product-detail.html?id=${productId}`;
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

  // 특가 상품 슬라이더 이벤트 설정
  setupFeaturedSliderEvents() {
    const leftBtn = document.getElementById("featuredSliderLeft");
    const rightBtn = document.getElementById("featuredSliderRight");

    if (leftBtn) {
      leftBtn.addEventListener("click", () => this.previousFeaturedSlide());
    }

    if (rightBtn) {
      rightBtn.addEventListener("click", () => this.nextFeaturedSlide());
    }
  }

  // 특가 상품 슬라이더 이전 슬라이드
  previousFeaturedSlide() {
    if (this.featuredCurrentSlide > 0) {
      // 4개씩 뒤로 넘어가도록 수정
      this.featuredCurrentSlide = Math.max(0, this.featuredCurrentSlide - this.featuredSlidesPerView);
      this.updateFeaturedSlider();
    }
  }

  // 특가 상품 슬라이더 다음 슬라이드
  nextFeaturedSlide() {
    const maxSlides = Math.max(0, this.featuredProducts.length - this.featuredSlidesPerView);
    if (this.featuredCurrentSlide < maxSlides) {
      // 4개씩 넘어가도록 수정
      this.featuredCurrentSlide = Math.min(this.featuredCurrentSlide + this.featuredSlidesPerView, maxSlides);
      this.updateFeaturedSlider();
    }
  }

  // 특가 상품 슬라이더 업데이트
  updateFeaturedSlider() {
    const slider = document.getElementById("featuredGrid");
    const leftBtn = document.getElementById("featuredSliderLeft");
    const rightBtn = document.getElementById("featuredSliderRight");

    if (!slider) return;

    // 반응형 슬라이더 설정
    this.updateFeaturedSliderSettings();

    // 슬라이더 위치 계산 (카드 너비 + 간격)
    const cardWidth = 240; // product-card의 width
    const gap = this.getFeaturedSliderGap();
    const translateX = -(this.featuredCurrentSlide * (cardWidth + gap));
    
    slider.style.transform = `translateX(${translateX}px)`;

    // 버튼 상태 업데이트
    if (leftBtn) {
      leftBtn.disabled = this.featuredCurrentSlide === 0;
    }

    if (rightBtn) {
      const maxSlides = Math.max(0, this.featuredProducts.length - this.featuredSlidesPerView);
      rightBtn.disabled = this.featuredCurrentSlide >= maxSlides;
    }
  }

  // 특가 상품 슬라이더 설정 업데이트
  updateFeaturedSliderSettings() {
    const windowWidth = window.innerWidth;
    
    if (windowWidth <= 480) {
      // 모바일: 2개씩 보이기
      this.featuredSlidesPerView = 2;
    } else if (windowWidth <= 768) {
      // 태블릿: 3개씩 보이기
      this.featuredSlidesPerView = 3;
    } else {
      // 데스크톱: 4개씩 보이기
      this.featuredSlidesPerView = 4;
    }
  }

  // 특가 상품 슬라이더 간격 계산
  getFeaturedSliderGap() {
    const windowWidth = window.innerWidth;
    
    if (windowWidth <= 480) {
      return 10;
    } else if (windowWidth <= 768) {
      return 15;
    } else {
      return 20;
    }
  }

  // 검색 모달 이벤트 리스너 설정
  setupSearchModalEvents() {
    const searchModal = document.getElementById('searchModal');
    const searchModalClose = document.getElementById('searchModalClose');
    const searchModalInput = document.getElementById('searchModalInput');
    const searchModalBtn = document.getElementById('searchModalBtn');

    // 검색 모달 닫기
    if (searchModalClose) {
      searchModalClose.addEventListener('click', () => {
        searchModal.classList.remove('active');
      });
    }

    // 검색 모달 외부 클릭 시 닫기
    if (searchModal) {
      searchModal.addEventListener('click', (e) => {
        if (e.target === searchModal) {
          searchModal.classList.remove('active');
        }
      });
    }

    // 검색 모달에서 엔터키로 검색
    if (searchModalInput) {
      searchModalInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault(); // 기본 동작 방지
          const searchTerm = searchModalInput.value.trim();
          if (searchTerm) {
            // 검색어를 상단 검색창에도 동기화
            const topSearchInput = document.querySelector('.search-input');
            if (topSearchInput) {
              topSearchInput.value = searchTerm;
            }
            
            // 검색 실행
            this.performSearch(searchTerm);
            
            // 모달 닫기
            searchModal.classList.remove('active');
          }
        }
      });
    }

    // 검색 모달에서 검색 버튼 클릭으로 검색
    if (searchModalBtn) {
      searchModalBtn.addEventListener('click', () => {
        const searchTerm = searchModalInput.value.trim();
        if (searchTerm) {
          // 검색어를 상단 검색창에도 동기화
          const topSearchInput = document.querySelector('.search-input');
          if (topSearchInput) {
            topSearchInput.value = searchTerm;
          }
          
          // 검색 실행
          this.performSearch(searchTerm);
          
          // 모달 닫기
          searchModal.classList.remove('active');
        }
      });
    }
  }
}

// 페이지 로드 시 초기화
let eatpleStore;
document.addEventListener("DOMContentLoaded", () => {
  eatpleStore = new EatpleStore();
});

async function logout() {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });

    // 헤더 인증 관리자를 통해 로그아웃 처리
    if (window.headerAuthManager) {
      await window.headerAuthManager.handleLogout();
    } else {
      // 헤더 인증 관리자가 없는 경우 직접 처리
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("pendingProfile");
      window.location.href = "index.html";
    }
  } catch (error) {
    console.error("Logout failed:", error);
    // 오류가 발생해도 로컬 데이터는 정리
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("pendingProfile");
    window.location.href = "index.html";
  }
}

// (네비게이션 인증 전용 확인 로직 제거됨)

// 포인트 내역 드롭다운 토글 함수
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

// 전역 함수들 (HTML에서 호출되는 함수들)
function scrollToProducts() {
  if (eatpleStore) {
    eatpleStore.scrollToProducts();
  }
}

// 검색 모달 관련 전역 함수들
function openSearchModal() {
  const searchModal = document.getElementById('searchModal');
  const searchModalInput = document.getElementById('searchModalInput');
  if (searchModal) {
    searchModal.classList.add('active');
    setTimeout(() => {
      if (searchModalInput) {
        searchModalInput.focus();
      }
    }, 100);
  }
}

function closeSearchModal() {
  const searchModal = document.getElementById('searchModal');
  if (searchModal) {
    searchModal.classList.remove('active');
  }
}

function performModalSearch() {
  const searchModalInput = document.getElementById('searchModalInput');
  const searchTerm = searchModalInput ? searchModalInput.value.trim() : '';
  
  if (searchTerm && eatpleStore) {
    // 검색어를 상단 검색창에도 동기화
    const topSearchInput = document.querySelector('.search-input');
    if (topSearchInput) {
      topSearchInput.value = searchTerm;
    }
    
    // 검색 실행
    eatpleStore.performSearch(searchTerm);
    
    // 모달 닫기
    closeSearchModal();
  }
}

// 전역 함수들을 window 객체에 할당
window.openSearchModal = openSearchModal;
window.closeSearchModal = closeSearchModal;
window.performModalSearch = performModalSearch;

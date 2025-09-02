document.addEventListener("DOMContentLoaded", function () {
  // 관리자 권한 체크를 먼저 수행
  checkAdminPermission();
});

// 관리자 권한 체크 함수
async function checkAdminPermission() {
  try {
    console.log("관리자 권한 체크 시작...");

    const response = await fetch("/api/auth/check-admin", {
      credentials: "include",
    });

    console.log("응답 상태:", response.status);
    console.log("응답 헤더:", response.headers);

    if (!response.ok) {
      console.log(
        "응답이 실패했습니다. 상태:",
        response.status,
        response.statusText
      );
      const errorText = await response.text();
      console.log("에러 응답 내용:", errorText);
      alert("권한 확인에 실패했습니다. 메인 페이지로 이동합니다.");
      window.location.href = "index.html";
      return;
    }

    const responseText = await response.text();
    console.log("원본 응답 텍스트:", responseText);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error("JSON 파싱 오류:", parseError);
      console.log("파싱 실패한 응답:", responseText);
      alert("서버 응답 형식 오류가 발생했습니다.");
      window.location.href = "index.html";
      return;
    }

    console.log("서버 응답 데이터:", data);

    // success가 false이거나 isAdmin이 false인 경우
    if (!data.success || !data.isAdmin) {
      console.log(
        "관리자 권한 없음 - success:",
        data.success,
        "isAdmin:",
        data.isAdmin
      );
      alert("관리자 권한이 필요합니다. 메인 페이지로 이동합니다.");
      window.location.href = "index.html";
      return;
    }

    console.log("관리자 권한 확인됨, 페이지 초기화 시작");

    // 로딩 화면 숨기고 메인 콘텐츠 표시
    document.getElementById("authCheckLoading").style.display = "none";
    document.getElementById("mainContent").style.display = "block";

    // 관리자 권한이 확인된 경우에만 페이지 초기화
    initializeAdminPage();
  } catch (error) {
    console.error("관리자 권한 확인 중 오류:", error);
    console.error("오류 스택:", error.stack);
    alert("권한 확인 중 오류가 발생했습니다. 메인 페이지로 이동합니다.");
    window.location.href = "index.html";
  }
}

// 관리자 페이지 초기화 함수
function initializeAdminPage() {
  setupNavigation();
  fetchUsers();
  fetchStats();
  fetchProductStats();
  setupContentManagement();
  setupContactManagement();
  setupManualPosting();
}

async function fetchUsers() {
  try {
    const res = await fetch("/api/admin/users");
    const users = await res.json();
    renderUsers(users);
  } catch (e) {
    document.getElementById("adminMsg").textContent =
      "가입자 목록을 불러오지 못했습니다.";
  }
}

function renderUsers(users) {
  document.getElementById(
    "userCount"
  ).textContent = `총 회원수: ${users.length}명`;
  const tbody = document.querySelector("#usersTable tbody");
  tbody.innerHTML = "";
  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5">가입자가 없습니다.</td></tr>';
    return;
  }
  users.forEach((user) => {
    const tr = document.createElement("tr");

    // 가입일 처리 (timestamp 또는 ISO 문자열)
    let dateStr = "-";
    if (user.createdAt) {
      const date = new Date(user.createdAt);
      dateStr = isNaN(date.getTime()) ? "-" : date.toLocaleString("ko-KR");
    } else if (user.id) {
      const date = new Date(Number(user.id));
      dateStr = isNaN(date.getTime()) ? "-" : date.toLocaleString("ko-KR");
    }

    // 아이디/이메일 표시 (구글/카카오/일반 사용자)
    let displayName = "알 수 없음";
    let authTypeDisplay = "알 수 없음";

    if (user.authType === "google") {
      displayName = user.email || user.name || "Google 사용자";
      authTypeDisplay = "구글";
    } else if (user.authType === "kakao") {
      displayName = user.email || user.name || "Kakao 사용자";
      authTypeDisplay = "카카오";
    } else if (user.authType === "naver") {
      displayName = user.email || user.name || "Naver 사용자";
      authTypeDisplay = "네이버";
    } else if (user.authType === "local" || user.username) {
      // 기존 사용자 (authType이 없는 경우) 또는 일반 로그인 사용자
      displayName = user.username || "일반 사용자";
      authTypeDisplay = "일반";
    } else if (user.email && !user.username) {
      // username이 없고 email이 있으면 구글 사용자로 추정
      displayName = user.email;
      authTypeDisplay = "구글";
    }

    tr.innerHTML = `
      <td>${user.id}</td>
      <td>${displayName}</td>
      <td>${authTypeDisplay}</td>
      <td>${dateStr}</td>
      <td><button class="delete-btn" data-id="${user.id}">삭제</button></td>
    `;
    tbody.appendChild(tr);
  });
  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      const userId = this.getAttribute("data-id");
      if (confirm("정말로 이 계정을 삭제하시겠습니까?")) {
        fetch(`/api/admin/users/${userId}`, { method: "DELETE" })
          .then((res) => res.json())
          .then((result) => {
            if (result.success) {
              fetchUsers();
            } else {
              alert("삭제 실패: " + (result.error || "알 수 없는 오류"));
            }
          });
      }
    });
  });
}

async function fetchStats() {
  try {
    const res = await fetch("/api/stats/all");
    const data = await res.json();

    if (data.success && data.stats) {
      const stats = data.stats;
      document.getElementById("totalUsers").textContent = stats.totalUsers;
      document.getElementById("totalMealPlan").textContent =
        stats.serviceUsage.mealPlan;
      document.getElementById("totalRestaurant").textContent =
        stats.serviceUsage.restaurantRecommendation;
      document.getElementById("totalSupplement").textContent =
        stats.serviceUsage.supplementRecommendation;
      document.getElementById("totalIngredient").textContent =
        stats.serviceUsage.ingredientAnalysis;
    }
  } catch (e) {
    console.error("통계 로딩 실패:", e);
  }
}

// 네비게이션 설정
function setupNavigation() {
  const navButtons = document.querySelectorAll(".nav-btn");
  const sections = document.querySelectorAll(".admin-section");

  navButtons.forEach((button) => {
    button.addEventListener("click", function () {
      const targetSection = this.getAttribute("data-section");

      // 모든 네비게이션 버튼에서 active 클래스 제거
      navButtons.forEach((btn) => btn.classList.remove("active"));

      // 클릭된 버튼에 active 클래스 추가
      this.classList.add("active");

      // 모든 섹션 숨기기
      sections.forEach((section) => (section.style.display = "none"));

      // 선택된 섹션 표시
      const targetElement = document.getElementById(targetSection + "Section");
      if (targetElement) {
        targetElement.style.display = "block";
      }

      // 섹션별 특별 처리
      if (targetSection === "products") {
        refreshProductStats();
      } else if (targetSection === "users") {
        fetchUsers();
      } else if (targetSection === "nutrition") {
        fetchNutritionInfoList();
      } else if (targetSection === "contacts") {
        loadContacts();
      } else if (targetSection === "promotions") {
        loadPromotions();
      }
    });
  });
}

// 섹션 네비게이션 함수 (외부에서 호출 가능)
function navigateToSection(sectionName) {
  const targetButton = document.querySelector(
    `[data-section="${sectionName}"]`
  );
  if (targetButton) {
    targetButton.click();
  }
}

// 상품 통계 조회
async function fetchProductStats() {
  try {
    const response = await fetch("/api/admin/products/stats", {
      credentials: "include",
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        const stats = data.stats;
        document.getElementById("totalProducts").textContent =
          stats.totalProducts || 0;
        document.getElementById("activeProducts").textContent =
          stats.activeProducts || 0;
        document.getElementById("inactiveProducts").textContent =
          stats.inactiveProducts || 0;
        document.getElementById("totalCategories").textContent =
          stats.totalCategories || 0;
        document.getElementById("todayViews").textContent =
          stats.todayViews || 0;
      }
    } else {
      console.error("상품 통계 조회 실패:", response.status);
    }
  } catch (error) {
    console.error("상품 통계 로딩 실패:", error);
    // 기본값 설정
    document.getElementById("totalProducts").textContent = "0";
    document.getElementById("activeProducts").textContent = "0";
    document.getElementById("inactiveProducts").textContent = "0";
    document.getElementById("totalCategories").textContent = "0";
    document.getElementById("todayViews").textContent = "0";
  }
}

// 상품 통계 새로고침
function refreshProductStats() {
  fetchProductStats();
}

// 상품 관리 페이지 열기
function openProductManagement() {
  // 새 탭에서 상품 관리 페이지 열기
  window.open("admin-product-management.html", "_blank");
}

// 상품 등록 폼 열기
function openProductForm() {
  navigateToSection("products");
  // 프레임이 로드된 후 새 상품 폼 열기
  setTimeout(() => {
    const frame = document.getElementById("productManagementFrame");
    if (frame && frame.contentWindow) {
      try {
        frame.contentWindow.postMessage({ action: "openNewProductForm" }, "*");
      } catch (error) {
        console.log("프레임 통신 실패, 새 탭으로 열기");
        window.open("admin-product-management.html#new", "_blank");
      }
    }
  }, 500);
}

// 상품 분석 보기
function viewProductAnalytics() {
  navigateToSection("products");
  setTimeout(() => {
    const frame = document.getElementById("productManagementFrame");
    if (frame && frame.contentWindow) {
      try {
        frame.contentWindow.postMessage({ action: "showAnalytics" }, "*");
      } catch (error) {
        console.log("프레임 통신 실패, 새 탭으로 열기");
        window.open("admin-product-management.html#analytics", "_blank");
      }
    }
  }, 500);
}

// 상품 관리 프레임 로드 처리
function handleProductFrameLoad() {
  console.log("상품 관리 프레임이 로드되었습니다.");

  // 프레임과의 통신 설정
  window.addEventListener("message", function (event) {
    if (event.data && event.data.type === "productStatsUpdate") {
      // 상품 통계 업데이트
      refreshProductStats();
    }
  });
}

// 오늘 조회수 상세 보기
async function showTodayViewsDetail() {
  const modal = document.getElementById("todayViewsModal");
  const viewsList = document.getElementById("todayViewsList");

  // 모달 열기
  modal.classList.add("active");

  // 로딩 상태 표시
  viewsList.innerHTML = `
    <div class="loading-placeholder">
      <div class="spinner"></div>
      <p>조회수 데이터를 불러오는 중...</p>
    </div>
  `;

  try {
    // 오늘 조회수 상세 데이터 가져오기
    const response = await fetch("/api/admin/products/today-views-detail", {
      credentials: "include",
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        renderTodayViewsDetail(data.data);
      } else {
        showViewsError("데이터를 불러올 수 없습니다: " + data.error);
      }
    } else {
      showViewsError("서버 오류가 발생했습니다.");
    }
  } catch (error) {
    console.error("오늘 조회수 상세 로드 실패:", error);
    showViewsError("데이터를 불러오는 중 오류가 발생했습니다.");
  }
}

// 오늘 조회수 상세 데이터 렌더링
function renderTodayViewsDetail(data) {
  const { totalViews, products } = data;

  // 요약 정보 업데이트
  document.getElementById("totalTodayViews").textContent = totalViews;
  document.getElementById("viewedProductsCount").textContent = products.length;

  const viewsList = document.getElementById("todayViewsList");

  if (products.length === 0) {
    viewsList.innerHTML = `
      <div class="no-views">
        <div class="no-views-icon">📊</div>
        <h4>오늘 조회된 상품이 없습니다</h4>
        <p>상품 상세 페이지를 방문하면 조회수가 기록됩니다.</p>
      </div>
    `;
    return;
  }

  // 상품별 조회수 목록 렌더링
  const viewsHtml = products
    .map((product, index) => {
      const percentage =
        totalViews > 0
          ? ((product.todayViews / totalViews) * 100).toFixed(1)
          : 0;

      return `
      <div class="view-item">
        <div class="view-item-image">
          ${
            getValidImageUrl(product.image_url)
              ? `<img src="${getValidImageUrl(product.image_url)}" alt="${
                  product.name
                }" style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px;" onerror="this.style.display='none'; this.parentElement.innerHTML='📦';">`
              : "📦"
          }
        </div>
        <div class="view-item-info">
          <div class="view-item-name">${product.name}</div>
          <div class="view-item-category">${getCategoryDisplayName(
            product.category
          )}</div>
        </div>
        <div class="view-item-stats">
          <div class="view-count">${product.todayViews}회</div>
          <div class="view-percentage">${percentage}%</div>
        </div>
      </div>
    `;
    })
    .join("");

  viewsList.innerHTML = viewsHtml;

  // 필터링 및 정렬 이벤트 리스너 추가
  setupViewsFilters(products);
}

// 조회수 상세 필터링 및 정렬 설정
function setupViewsFilters(originalProducts) {
  const sortSelect = document.getElementById("viewsSortBy");
  const searchInput = document.getElementById("viewsSearchInput");

  function applyFilters() {
    let filteredProducts = [...originalProducts];

    // 검색 필터
    const searchTerm = searchInput.value.toLowerCase().trim();
    if (searchTerm) {
      filteredProducts = filteredProducts.filter((product) =>
        product.name.toLowerCase().includes(searchTerm)
      );
    }

    // 정렬
    const sortBy = sortSelect.value;
    switch (sortBy) {
      case "views_desc":
        filteredProducts.sort((a, b) => b.todayViews - a.todayViews);
        break;
      case "views_asc":
        filteredProducts.sort((a, b) => a.todayViews - b.todayViews);
        break;
      case "name_asc":
        filteredProducts.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    // 필터링된 결과 렌더링
    const totalViews = originalProducts.reduce(
      (sum, p) => sum + p.todayViews,
      0
    );
    renderTodayViewsDetail({ totalViews, products: filteredProducts });
  }

  // 이벤트 리스너 추가 (중복 방지를 위해 기존 리스너 제거)
  sortSelect.removeEventListener("change", applyFilters);
  searchInput.removeEventListener("input", applyFilters);

  sortSelect.addEventListener("change", applyFilters);
  searchInput.addEventListener("input", applyFilters);
}

// 카테고리 표시명 가져오기
function getCategoryDisplayName(category) {
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
    supplement: "건강보조식품",
    vitamin: "비타민",
    beauty: "뷰티",
    protein: "프로틴",
    diet: "다이어트",
    health: "건강식품",
    functional: "기능성식품",
    organic: "유기농",
  };
  return categoryNames[category] || category;
}

// 유효한 이미지 URL 추출 함수
function getValidImageUrl(imageData) {
  if (!imageData) {
    return null;
  }

  // 문자열로 변환 후 trim
  const imageStr = String(imageData).trim();

  if (
    !imageStr ||
    imageStr === "[]" ||
    imageStr === "null" ||
    imageStr === "undefined"
  ) {
    return null;
  }

  // JSON 배열 형태인지 확인 (대괄호로 시작하는 경우)
  if (imageStr.startsWith("[") && imageStr.endsWith("]")) {
    try {
      const images = JSON.parse(imageStr);
      if (Array.isArray(images) && images.length > 0) {
        const firstImage = String(images[0]).trim();
        return isValidImageUrl(firstImage) ? firstImage : null;
      }
    } catch (e) {
      console.warn("JSON 파싱 실패:", imageStr.substring(0, 100) + "...", e);
    }
    return null;
  }

  // 단일 URL인 경우
  return isValidImageUrl(imageStr) ? imageStr : null;
}

// URL 유효성 검사
function isValidImageUrl(url) {
  if (!url || typeof url !== "string") {
    return false;
  }

  const trimmedUrl = url.trim();

  // 빈 문자열이나 특수 값들 체크
  if (
    !trimmedUrl ||
    trimmedUrl === "[]" ||
    trimmedUrl === "null" ||
    trimmedUrl === "undefined"
  ) {
    return false;
  }

  // URL 형태 체크 (http, https, 상대 경로, 또는 Base64 데이터 URL)
  return (
    trimmedUrl.startsWith("http://") ||
    trimmedUrl.startsWith("https://") ||
    trimmedUrl.startsWith("/") ||
    trimmedUrl.startsWith("./") ||
    trimmedUrl.startsWith("../") ||
    trimmedUrl.startsWith("data:image/")
  );
}

// 조회수 상세 오류 표시
function showViewsError(message) {
  const viewsList = document.getElementById("todayViewsList");
  viewsList.innerHTML = `
    <div class="no-views">
      <div class="no-views-icon">⚠️</div>
      <h4>데이터 로드 실패</h4>
      <p>${message}</p>
      <button class="admin-action-btn" onclick="showTodayViewsDetail()" style="margin-top: 15px;">
        다시 시도
      </button>
    </div>
  `;
}

// 모달 닫기 이벤트 설정
document.addEventListener("DOMContentLoaded", function () {
  const modal = document.getElementById("todayViewsModal");
  const closeBtn = document.getElementById("closeTodayViewsModal");

  if (closeBtn) {
    closeBtn.addEventListener("click", function () {
      modal.classList.remove("active");
    });
  }

  // 모달 배경 클릭으로 닫기
  if (modal) {
    modal.addEventListener("click", function (e) {
      if (e.target === modal) {
        modal.classList.remove("active");
      }
    });
  }
});

// 전역 변수
let currentNutritionInfoPage = 1;
let selectedNutritionInfoIds = new Set();
let nutritionInfoData = [];

// 영양 정보 콘텐츠 관리 설정
function setupContentManagement() {
  // 검색 기능
  document.getElementById("searchBtn").addEventListener("click", function () {
    currentNutritionInfoPage = 1;
    fetchNutritionInfoList();
  });

  // 엔터키로 검색
  document
    .getElementById("searchNutritionInfo")
    .addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        currentNutritionInfoPage = 1;
        fetchNutritionInfoList();
      }
    });

  // 필터 변경 시 자동 검색
  ["filterCategory", "filterSourceType", "filterStatus"].forEach((id) => {
    document.getElementById(id).addEventListener("change", function () {
      currentNutritionInfoPage = 1;
      fetchNutritionInfoList();
    });
  });

  // 전체 선택/해제
  document
    .getElementById("selectAllCheckbox")
    .addEventListener("change", function () {
      const isChecked = this.checked;
      document
        .querySelectorAll(".nutrition-info-checkbox")
        .forEach((checkbox) => {
          checkbox.checked = isChecked;
          if (isChecked) {
            selectedNutritionInfoIds.add(checkbox.value);
          } else {
            selectedNutritionInfoIds.delete(checkbox.value);
          }
        });
      updateSelectedCount();
    });

  // 일괄 처리 버튼들
  document.getElementById("selectAll").addEventListener("click", function () {
    document.getElementById("selectAllCheckbox").checked = true;
    document
      .getElementById("selectAllCheckbox")
      .dispatchEvent(new Event("change"));
  });

  document.getElementById("deselectAll").addEventListener("click", function () {
    document.getElementById("selectAllCheckbox").checked = false;
    document
      .getElementById("selectAllCheckbox")
      .dispatchEvent(new Event("change"));
  });

  // 일괄 처리 실행
  document
    .getElementById("executeBulkAction")
    .addEventListener("click", executeBulkAction);

  // 선택된 항목 수 업데이트 감지
  document.getElementById("bulkAction").addEventListener("change", function () {
    const executeBtn = document.getElementById("executeBulkAction");
    executeBtn.disabled = !this.value || selectedNutritionInfoIds.size === 0;
  });

  // 초기 데이터 로드
  fetchNutritionInfoList();
}

// 영양 정보 목록 조회
async function fetchNutritionInfoList() {
  try {
    const searchTerm = document.getElementById("searchNutritionInfo").value;
    const category = document.getElementById("filterCategory").value;
    const sourceType = document.getElementById("filterSourceType").value;
    const status = document.getElementById("filterStatus").value;

    const params = new URLSearchParams({
      page: currentNutritionInfoPage,
      limit: 20,
      // 캐시 무효화를 위한 타임스탬프 추가
      _t: Date.now(),
    });

    if (searchTerm) params.append("search", searchTerm);
    if (category) params.append("category", category);
    if (sourceType) params.append("sourceType", sourceType);
    if (status) params.append("status", status);

    console.log(`📡 영양 정보 목록 조회 요청: ${params.toString()}`);

    const response = await fetch(`/api/nutrition-info?${params}`, {
      // 캐시 무효화를 위한 헤더 추가
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
      credentials: "include",
    });

    console.log(`📡 응답 상태: ${response.status}`);

    const data = await response.json();
    console.log(`📊 받은 데이터:`, data);

    if (data.success) {
      nutritionInfoData = data.data;
      renderNutritionInfoTable(data.data);
      renderPagination(data.pagination);
      console.log(`✅ 영양 정보 목록 렌더링 완료: ${data.data.length}개 항목`);
    } else {
      console.error("영양 정보 목록 조회 실패:", data.error);
      document.getElementById("nutritionInfoTableBody").innerHTML =
        '<tr><td colspan="7" style="padding: 20px; text-align: center; color: #ef4444;">데이터 조회 실패: ' +
        (data.error || "알 수 없는 오류") +
        "</td></tr>";
    }
  } catch (error) {
    console.error("영양 정보 목록 로딩 실패:", error);
    document.getElementById("nutritionInfoTableBody").innerHTML =
      '<tr><td colspan="7" style="padding: 20px; text-align: center; color: #ef4444;">네트워크 오류: 데이터 로딩 실패</td></tr>';
  }
}

// 영양 정보 테이블 렌더링
function renderNutritionInfoTable(data) {
  const tbody = document.getElementById("nutritionInfoTableBody");

  if (data.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="7" style="padding: 20px; text-align: center; color: #6b7280;">검색 결과가 없습니다.</td></tr>';
    return;
  }

  tbody.innerHTML = data
    .map((item) => {
      const statusColor = item.isActive ? "#10b981" : "#6b7280";
      const statusText = item.isActive ? "활성" : "비활성";
      const trustScoreColor =
        item.trustScore >= 80
          ? "#10b981"
          : item.trustScore >= 60
          ? "#f59e0b"
          : "#ef4444";

      return `
      <tr style="border-bottom: 1px solid #f3f4f6;">
        <td style="padding: 12px 8px;">
          <input type="checkbox" class="nutrition-info-checkbox" value="${
            item.id
          }" 
                 ${selectedNutritionInfoIds.has(item.id) ? "checked" : ""}>
        </td>
        <td style="padding: 12px 8px;">
          <div style="font-weight: 500; margin-bottom: 4px;">${item.title}</div>
          <div style="font-size: 0.8rem; color: #6b7280; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${item.summary}
          </div>
        </td>
        <td style="padding: 12px 8px;">
          <span style="background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem;">
            ${item.sourceType}
          </span>
        </td>
        <td style="padding: 12px 8px;">
          <span style="background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem;">
            ${item.category}
          </span>
        </td>
        <td style="padding: 12px 8px;">
          <span style="color: ${trustScoreColor}; font-weight: 600;">${
        item.trustScore
      }</span>
        </td>
        <td style="padding: 12px 8px;">
          <span style="color: ${statusColor}; font-weight: 500;">${statusText}</span>
        </td>
        <td style="padding: 12px 8px;">
          <div style="display: flex; gap: 4px;">
            <button onclick="editNutritionInfo('${item.id}')" 
                    style="padding: 4px 8px; background: #4a69bd; color: white; border: none; border-radius: 4px; font-size: 0.8rem; cursor: pointer;">
              편집
            </button>
            <button onclick="toggleNutritionInfoStatus('${
              item.id
            }', ${!item.isActive})" 
                    style="padding: 4px 8px; background: ${
                      item.isActive ? "#ef4444" : "#10b981"
                    }; color: white; border: none; border-radius: 4px; font-size: 0.8rem; cursor: pointer;">
              ${item.isActive ? "비활성" : "활성"}
            </button>
            <button onclick="deleteNutritionInfo('${item.id}')" 
                    style="padding: 4px 8px; background: #dc2626; color: white; border: none; border-radius: 4px; font-size: 0.8rem; cursor: pointer;">
              삭제
            </button>
          </div>
        </td>
      </tr>
    `;
    })
    .join("");

  // 체크박스 이벤트 리스너 추가
  document.querySelectorAll(".nutrition-info-checkbox").forEach((checkbox) => {
    checkbox.addEventListener("change", function () {
      if (this.checked) {
        selectedNutritionInfoIds.add(this.value);
      } else {
        selectedNutritionInfoIds.delete(this.value);
      }
      updateSelectedCount();
    });
  });
}

// 페이지네이션 렌더링
function renderPagination(pagination) {
  const container = document.getElementById("pagination");

  if (!pagination || pagination.totalPages <= 1) {
    container.innerHTML = "";
    return;
  }

  let html = "";

  // 이전 페이지
  if (pagination.currentPage > 1) {
    html += `<button onclick="changePage(${
      pagination.currentPage - 1
    })" class="admin-action-btn">이전</button>`;
  }

  // 페이지 번호들
  const startPage = Math.max(1, pagination.currentPage - 2);
  const endPage = Math.min(pagination.totalPages, pagination.currentPage + 2);

  for (let i = startPage; i <= endPage; i++) {
    const isActive = i === pagination.currentPage;
    html += `
      <button onclick="changePage(${i})" 
              class="admin-action-btn" 
              style="background: ${isActive ? "#27408B" : "#4a69bd"};">
        ${i}
      </button>
    `;
  }

  // 다음 페이지
  if (pagination.currentPage < pagination.totalPages) {
    html += `<button onclick="changePage(${
      pagination.currentPage + 1
    })" class="admin-action-btn">다음</button>`;
  }

  container.innerHTML = html;
}

// 페이지 변경
function changePage(page) {
  currentNutritionInfoPage = page;
  fetchNutritionInfoList();
}

// 선택된 항목 수 업데이트
function updateSelectedCount() {
  document.getElementById(
    "selectedCount"
  ).textContent = `${selectedNutritionInfoIds.size}개`;
  const executeBtn = document.getElementById("executeBulkAction");
  const bulkAction = document.getElementById("bulkAction").value;
  executeBtn.disabled = !bulkAction || selectedNutritionInfoIds.size === 0;
}

// 영양 정보 편집
function editNutritionInfo(id) {
  const item = nutritionInfoData.find((item) => item.id === id);
  if (!item) return;

  const newTitle = prompt("제목 수정:", item.title);
  if (newTitle === null) return;

  const newSummary = prompt("요약 수정:", item.summary);
  if (newSummary === null) return;

  const newTrustScore = prompt("신뢰도 점수 (0-100):", item.trustScore);
  if (newTrustScore === null) return;

  const trustScore = parseInt(newTrustScore);
  if (isNaN(trustScore) || trustScore < 0 || trustScore > 100) {
    alert("신뢰도 점수는 0-100 사이의 숫자여야 합니다.");
    return;
  }

  updateNutritionInfo(id, {
    title: newTitle.trim(),
    summary: newSummary.trim(),
    trustScore: trustScore,
  });
}

// 영양 정보 업데이트
async function updateNutritionInfo(id, updateData) {
  try {
    const response = await fetch(`/api/admin/nutrition-info/${id}/edit`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updateData),
    });

    const result = await response.json();

    if (result.success) {
      alert("영양 정보가 수정되었습니다.");
      fetchNutritionInfoList();
    } else {
      alert("수정 실패: " + (result.error || "알 수 없는 오류"));
    }
  } catch (error) {
    console.error("영양 정보 수정 오류:", error);
    alert("수정 중 오류가 발생했습니다.");
  }
}

// 영양 정보 상태 토글
async function toggleNutritionInfoStatus(id, activate) {
  try {
    const response = await fetch(`/api/admin/nutrition-info/${id}/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: activate ? "active" : "inactive",
      }),
    });

    const result = await response.json();

    if (result.success) {
      fetchNutritionInfoList();
    } else {
      alert("상태 변경 실패: " + (result.error || "알 수 없는 오류"));
    }
  } catch (error) {
    console.error("상태 변경 오류:", error);
    alert("상태 변경 중 오류가 발생했습니다.");
  }
}

// 영양 정보 삭제
async function deleteNutritionInfo(id) {
  const deleteType = confirm(
    '영양 정보를 삭제하시겠습니까?\n\n"확인"을 누르면 영구 삭제됩니다.\n"취소"를 누르면 비활성화됩니다.'
  );

  if (deleteType === null) {
    return; // 취소
  }

  try {
    console.log(`🗑️ 영양 정보 삭제 요청: ID=${id}, permanent=${deleteType}`);

    const response = await fetch(`/api/admin/nutrition-info/${id}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        permanent: deleteType, // true면 영구 삭제, false면 비활성화
      }),
      credentials: "include",
    });

    console.log(`📡 응답 상태: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ HTTP 오류 응답:`, errorText);

      if (response.status === 404) {
        alert(
          "해당 영양 정보를 찾을 수 없습니다. 이미 삭제되었거나 존재하지 않는 항목입니다."
        );
      } else if (response.status === 403) {
        alert("관리자 권한이 필요합니다.");
      } else {
        alert(`서버 오류가 발생했습니다. (${response.status})`);
      }
      return;
    }

    const result = await response.json();
    console.log(`✅ 삭제 응답:`, result);

    if (result.success) {
      const action = deleteType ? "영구 삭제" : "비활성화";
      console.log(`✅ 삭제 성공: ${action}`);

      // 즉시 UI에서 해당 항목 제거 (낙관적 업데이트)
      const deletedItemRow = document
        .querySelector(`input[value="${id}"]`)
        ?.closest("tr");
      if (deletedItemRow) {
        deletedItemRow.style.opacity = "0.5";
        deletedItemRow.style.backgroundColor = "#fee2e2";
        console.log(`🎨 삭제된 항목 UI 업데이트 완료`);
      }

      // 선택된 항목에서 제거
      selectedNutritionInfoIds.delete(id);
      updateSelectedCount();

      alert(`영양 정보가 ${action}되었습니다.`);

      // 목록 새로고침 (약간의 지연 후)
      setTimeout(() => {
        console.log(`🔄 목록 새로고침 시작...`);
        fetchNutritionInfoList();
      }, 500);
    } else {
      console.error(`❌ 삭제 실패:`, result);
      alert("삭제 실패: " + (result.error || "알 수 없는 오류"));

      // 디버그 정보가 있으면 콘솔에 출력
      if (result.debug) {
        console.log("🔍 디버그 정보:", result.debug);
      }
    }
  } catch (error) {
    console.error("영양 정보 삭제 오류:", error);
    alert("삭제 중 네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.");
  }
}

// 일괄 처리 실행
async function executeBulkAction() {
  const action = document.getElementById("bulkAction").value;
  const selectedIds = Array.from(selectedNutritionInfoIds);

  if (!action || selectedIds.length === 0) return;

  const actionNames = {
    activate: "활성화",
    deactivate: "비활성화",
    delete: "삭제",
  };

  let permanent = false;

  if (action === "delete") {
    const deleteType = confirm(
      `선택된 ${selectedIds.length}개 항목을 삭제하시겠습니까?\n\n"확인"을 누르면 영구 삭제됩니다.\n"취소"를 누르면 비활성화됩니다.`
    );

    if (deleteType === null) {
      return; // 취소
    }
    permanent = deleteType;
  } else {
    if (
      !confirm(
        `선택된 ${selectedIds.length}개 항목을 ${actionNames[action]}하시겠습니까?`
      )
    ) {
      return;
    }
  }

  try {
    const requestBody = {
      action: action,
      ids: selectedIds,
    };

    if (action === "delete") {
      requestBody.permanent = permanent;
    }

    const response = await fetch("/api/admin/nutrition-info/bulk-action", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const result = await response.json();

    if (result.success) {
      const actionText =
        action === "delete"
          ? permanent
            ? "영구 삭제"
            : "비활성화"
          : actionNames[action];

      console.log(
        `✅ 일괄 처리 성공: ${result.data.processedCount}개 항목 ${actionText}`
      );

      // 처리된 항목들을 UI에서 즉시 업데이트 (낙관적 업데이트)
      selectedIds.forEach((id) => {
        const itemRow = document
          .querySelector(`input[value="${id}"]`)
          ?.closest("tr");
        if (itemRow) {
          if (action === "delete") {
            itemRow.style.opacity = "0.5";
            itemRow.style.backgroundColor = "#fee2e2";
          } else if (action === "deactivate") {
            itemRow.style.opacity = "0.7";
            itemRow.style.backgroundColor = "#fef3c7";
          } else if (action === "activate") {
            itemRow.style.opacity = "1";
            itemRow.style.backgroundColor = "#d1fae5";
          }
        }
      });

      alert(`${result.data.processedCount}개 항목이 ${actionText}되었습니다.`);
      selectedNutritionInfoIds.clear();
      document.getElementById("selectAllCheckbox").checked = false;
      updateSelectedCount();

      // 목록 새로고침 (약간의 지연 후)
      setTimeout(() => {
        console.log(`🔄 일괄 처리 후 목록 새로고침 시작...`);
        fetchNutritionInfoList();
      }, 500);
    } else {
      console.error(`❌ 일괄 처리 실패:`, result);
      alert("일괄 처리 실패: " + (result.error || "알 수 없는 오류"));
    }
  } catch (error) {
    console.error("일괄 처리 오류:", error);
    alert("일괄 처리 중 오류가 발생했습니다.");
  }
}

window.onload = fetchUsers;
// 문의 관리 설정
function setupContactManagement() {
  // 문의 목록 로드
  loadContacts();

  // 필터 이벤트 리스너
  if (document.getElementById("statusFilter")) {
    document
      .getElementById("statusFilter")
      .addEventListener("change", applyFilters);
  }
  if (document.getElementById("categoryFilter")) {
    document
      .getElementById("categoryFilter")
      .addEventListener("change", applyFilters);
  }
  if (document.getElementById("dateFilter")) {
    document
      .getElementById("dateFilter")
      .addEventListener("change", applyFilters);
  }

  // 모달 닫기 버튼
  if (document.getElementById("closeDetailModal")) {
    document
      .getElementById("closeDetailModal")
      .addEventListener("click", closeContactDetailModal);
  }
  if (document.getElementById("cancelBtn")) {
    document
      .getElementById("cancelBtn")
      .addEventListener("click", closeContactDetailModal);
  }

  // 저장 버튼
  if (document.getElementById("saveBtn")) {
    document
      .getElementById("saveBtn")
      .addEventListener("click", saveContactUpdate);
  }

  // 모달 외부 클릭 시 닫기
  window.addEventListener("click", function (e) {
    if (e.target === document.getElementById("contactDetailModal")) {
      closeContactDetailModal();
    }
  });
}

// 문의 목록 로드
async function loadContacts() {
  try {
    console.log("문의 목록 로드 시작...");
    const response = await fetch("/api/contact/admin/list", {
      credentials: "include",
    });

    console.log("문의 목록 응답 상태:", response.status);
    const data = await response.json();
    console.log("문의 목록 응답 데이터:", data);

    if (data.success) {
      contacts = data.data || [];
      console.log("로드된 문의 수:", contacts.length);
      applyFilters();

      // 대시보드 통계 업데이트
      if (document.getElementById("pendingContacts")) {
        const pendingContacts = contacts.filter(
          (contact) => contact.status === "pending"
        ).length;
        document.getElementById("pendingContacts").textContent =
          pendingContacts;
      }
    } else {
      console.error("문의 목록 로드 실패:", data.message);
      showNoContacts("문의 내역을 불러올 수 없습니다: " + data.message);
    }
  } catch (error) {
    console.error("문의 목록 로드 오류:", error);
    showNoContacts("문의 내역을 불러오는 중 오류가 발생했습니다.");
  }
}

// 문의 없음 메시지 표시
function showNoContacts(message) {
  const tableBody = document.getElementById("contactTableBody");
  if (!tableBody) return;

  tableBody.innerHTML = `<tr><td colspan="7" class="no-contacts">${message}</td></tr>`;
}

// 전역 변수 (문의 관리용)
let contacts = [];
let currentPage = 1;
let itemsPerPage = 10;
let currentContactId = null;

// 필터 적용
function applyFilters() {
  const statusFilter = document.getElementById("statusFilter")?.value || "all";
  const categoryFilter =
    document.getElementById("categoryFilter")?.value || "all";
  const dateFilter = document.getElementById("dateFilter")?.value || "all";

  // 필터링된 문의 목록
  let filteredContacts = [...contacts];

  // 상태 필터
  if (statusFilter !== "all") {
    filteredContacts = filteredContacts.filter(
      (contact) => contact.status === statusFilter
    );
  }

  // 유형 필터
  if (categoryFilter !== "all") {
    filteredContacts = filteredContacts.filter(
      (contact) => contact.category === categoryFilter
    );
  }

  // 날짜 필터
  if (dateFilter !== "all") {
    const now = new Date();
    let startDate;

    switch (dateFilter) {
      case "today":
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case "week":
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "month":
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 30);
        break;
    }

    filteredContacts = filteredContacts.filter((contact) => {
      const contactDate = new Date(contact.createdAt);
      return contactDate >= startDate;
    });
  }

  // 페이지네이션 및 테이블 렌더링
  renderContactPagination(filteredContacts.length);
  renderContactTable(filteredContacts);
}

// 문의 테이블 렌더링
function renderContactTable(filteredContacts) {
  const tableBody = document.getElementById("contactTableBody");
  if (!tableBody) return;

  // 시작 및 종료 인덱스 계산
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filteredContacts.length);

  // 테이블 내용 초기화
  tableBody.innerHTML = "";

  // 문의가 없는 경우
  if (filteredContacts.length === 0) {
    showNoContacts("조건에 맞는 문의 내역이 없습니다.");
    return;
  }

  // 현재 페이지의 문의 목록 렌더링
  for (let i = startIndex; i < endIndex; i++) {
    const contact = filteredContacts[i];
    const row = document.createElement("tr");

    // 문의 ID (짧게 표시)
    const shortId =
      contact.id.split("_")[1]?.substring(0, 8) || contact.id.substring(0, 8);

    // 카테고리 한글 변환
    const categoryMap = {
      service: "서비스 이용",
      account: "계정 관련",
      payment: "결제 관련",
      suggestion: "기능 제안",
      bug: "오류 신고",
      other: "기타 문의",
    };

    // 상태 한글 변환
    const statusMap = {
      pending: "대기중",
      "in-progress": "처리중",
      resolved: "해결됨",
    };

    // 날짜 포맷
    const date = new Date(contact.createdAt);
    const formattedDate = `${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

    row.innerHTML = `
      <td>${shortId}</td>
      <td>${contact.subject}</td>
      <td>${categoryMap[contact.category] || contact.category}</td>
      <td>${contact.username}</td>
      <td>${formattedDate}</td>
      <td><span class="status-badge status-${contact.status}">${
      statusMap[contact.status] || contact.status
    }</span></td>
      <td><button class="action-btn view-btn" data-id="${
        contact.id
      }">보기</button></td>
    `;

    tableBody.appendChild(row);
  }

  // 상세 보기 버튼 이벤트 리스너 추가
  document.querySelectorAll(".view-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      const contactId = this.getAttribute("data-id");
      openContactDetail(contactId);
    });
  });
}

// 페이지네이션 렌더링
function renderContactPagination(totalItems) {
  const pagination = document.getElementById("contactPagination");
  if (!pagination) return;

  pagination.innerHTML = "";

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // 페이지가 1페이지만 있는 경우 페이지네이션 표시 안함
  if (totalPages <= 1) {
    return;
  }

  // 이전 페이지 버튼
  if (currentPage > 1) {
    const prevBtn = document.createElement("button");
    prevBtn.className = "pagination-btn";
    prevBtn.textContent = "이전";
    prevBtn.addEventListener("click", () => {
      currentPage--;
      applyFilters();
    });
    pagination.appendChild(prevBtn);
  }

  // 페이지 번호 버튼
  const maxPageButtons = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2));
  let endPage = Math.min(totalPages, startPage + maxPageButtons - 1);

  if (endPage - startPage + 1 < maxPageButtons) {
    startPage = Math.max(1, endPage - maxPageButtons + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    const pageBtn = document.createElement("button");
    pageBtn.className = "pagination-btn";
    if (i === currentPage) {
      pageBtn.classList.add("active");
    }
    pageBtn.textContent = i;
    pageBtn.addEventListener("click", () => {
      currentPage = i;
      applyFilters();
    });
    pagination.appendChild(pageBtn);
  }

  // 다음 페이지 버튼
  if (currentPage < totalPages) {
    const nextBtn = document.createElement("button");
    nextBtn.className = "pagination-btn";
    nextBtn.textContent = "다음";
    nextBtn.addEventListener("click", () => {
      currentPage++;
      applyFilters();
    });
    pagination.appendChild(nextBtn);
  }
}

// 문의 상세 정보 열기
async function openContactDetail(contactId) {
  try {
    const response = await fetch(`/api/contact/admin/detail/${contactId}`, {
      credentials: "include",
    });

    const data = await response.json();

    if (data.success) {
      const contact = data.data;
      currentContactId = contact.id;

      // 카테고리 한글 변환
      const categoryMap = {
        service: "서비스 이용 문의",
        account: "계정 관련 문의",
        payment: "결제 관련 문의",
        suggestion: "기능 제안",
        bug: "오류 신고",
        other: "기타 문의",
      };

      // 모달 내용 채우기
      document.getElementById("contactSubject").textContent = contact.subject;
      document.getElementById("contactCategory").textContent =
        categoryMap[contact.category] || contact.category;
      document.getElementById("contactUsername").textContent = contact.username;
      document.getElementById("contactEmail").textContent = contact.email;

      // 날짜 포맷
      const date = new Date(contact.createdAt);
      const formattedDate = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(
        date.getHours()
      ).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
      document.getElementById("contactDate").textContent = formattedDate;

      document.getElementById("contactMessage").textContent = contact.message;
      document.getElementById("contactStatus").value = contact.status;
      document.getElementById("adminComment").value =
        contact.adminComment || "";

      // 모달 표시
      document.getElementById("contactDetailModal").style.display = "block";
      document.body.style.overflow = "hidden"; // 배경 스크롤 방지
    } else {
      alert("문의 정보를 불러올 수 없습니다.");
    }
  } catch (error) {
    console.error("문의 상세 정보 로드 오류:", error);
    alert("문의 정보를 불러오는 중 오류가 발생했습니다.");
  }
}

// 문의 상세 모달 닫기
function closeContactDetailModal() {
  const modal = document.getElementById("contactDetailModal");
  if (modal) {
    modal.style.display = "none";
    document.body.style.overflow = ""; // 배경 스크롤 복원
    currentContactId = null;
  }
}

// 문의 상태 업데이트 저장
async function saveContactUpdate() {
  if (!currentContactId) return;

  const status = document.getElementById("contactStatus").value;
  const adminComment = document.getElementById("adminComment").value;

  try {
    const response = await fetch(
      `/api/contact/admin/update/${currentContactId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status, adminComment }),
        credentials: "include",
      }
    );

    const data = await response.json();

    if (data.success) {
      alert("문의 상태가 업데이트되었습니다.");
      closeContactDetailModal();
      loadContacts(); // 목록 새로고침
    } else {
      alert("문의 상태 업데이트에 실패했습니다.");
    }
  } catch (error) {
    console.error("문의 상태 업데이트 오류:", error);
    alert("문의 상태 업데이트 중 오류가 발생했습니다.");
  }
}
//===== 수동 포스팅 관리 기능 =====

// 수동 포스팅 관련 전역 변수
let currentEditingPostId = null;
window.currentEditingPostId = null;
let currentPostsPage = 1;
let availableCategories = ["diet", "supplements", "research", "trends"];
let availableTags = [];

// 새 포스팅 시작 (편집 모드 해제 후 폼 표시)
function startNewPost() {
  // 편집 모드 해제
  if (typeof currentEditingPostId !== 'undefined' && currentEditingPostId !== null) {
    console.log('새 포스팅 모드로 전환, 편집 모드 해제');
    currentEditingPostId = null;
    window.currentEditingPostId = null;
  }
  
  // 폼 초기화
  resetForm();
  
  // 포스팅 폼 표시
  showPostingForm();
}

// 수동 포스팅 관리 초기화
function setupManualPosting() {
  // 네비게이션 버튼 이벤트
  document
    .getElementById("newPostBtn")
    .addEventListener("click", startNewPost);
  document
    .getElementById("managePostsBtn")
    .addEventListener("click", showPostManagement);
  document
    .getElementById("backToFormBtn")
    .addEventListener("click", showPostingForm);

  // 폼 이벤트 리스너
  setupFormEventListeners();

  // 태그 자동완성
  setupTagAutocomplete();

  // URL 검증
  setupUrlValidation();

  // 포스팅 관리 검색/필터 이벤트
  setupPostManagementEvents();

  // 초기 데이터 로드
  loadAvailableTags();
}

// 포스팅 관리 이벤트 설정
function setupPostManagementEvents() {
  // 검색 버튼
  document.getElementById("searchPostsBtn").addEventListener("click", () => {
    currentPostsPage = 1;
    loadPostsList();
  });

  // 엔터키로 검색
  document.getElementById("searchPosts").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      currentPostsPage = 1;
      loadPostsList();
    }
  });

  // 필터 변경 시 자동 검색
  ["filterPostStatus", "filterPostCategory"].forEach((id) => {
    document.getElementById(id).addEventListener("change", () => {
      currentPostsPage = 1;
      loadPostsList();
    });
  });
}

// 폼 이벤트 리스너 설정
function setupFormEventListeners() {
  const form = document.getElementById("nutritionPostingForm");

  // 폼 제출 이벤트는 admin.html의 NutritionPostEditor에서 처리

  // 버튼 이벤트 (포스팅 관련 버튼은 admin.html의 NutritionPostEditor에서 처리)

  // 새 카테고리 입력 시 기존 카테고리 선택 해제
  document.getElementById("newCategory").addEventListener("input", function () {
    if (this.value.trim()) {
      document.getElementById("postCategory").value = "";
    }
  });

  // 카테고리 선택 시 새 카테고리 입력 해제
  document
    .getElementById("postCategory")
    .addEventListener("change", function () {
      if (this.value) {
        document.getElementById("newCategory").value = "";
      }
    });
}

// 파일 크기 포맷팅
function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// HTML 이스케이프
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// 태그 자동완성 설정
function setupTagAutocomplete() {
  const tagInput = document.getElementById("postTags");
  const suggestionsContainer = document.getElementById("tagSuggestions");
  const suggestedTagsContainer = document.getElementById("suggestedTags");

  tagInput.addEventListener("input", function () {
    const value = this.value;
    const lastTag = value.split(",").pop().trim();

    if (lastTag.length >= 2) {
      const suggestions = availableTags
        .filter(
          (tag) =>
            tag.toLowerCase().includes(lastTag.toLowerCase()) &&
            !value.includes(tag)
        )
        .slice(0, 5);

      if (suggestions.length > 0) {
        showTagSuggestions(suggestions, lastTag);
      } else {
        hideTagSuggestions();
      }
    } else {
      hideTagSuggestions();
    }
  });

  tagInput.addEventListener("blur", () => {
    setTimeout(hideTagSuggestions, 200); // 클릭 이벤트를 위한 지연
  });
}

// 태그 제안 표시
function showTagSuggestions(suggestions, currentTag) {
  const suggestionsContainer = document.getElementById("tagSuggestions");
  const suggestedTagsContainer = document.getElementById("suggestedTags");

  suggestedTagsContainer.innerHTML = suggestions
    .map(
      (tag) =>
        `<span class="tag-suggestion-item" data-tag="${tag}">${tag}</span>`
    )
    .join("");

  // 클릭 이벤트 추가
  suggestedTagsContainer
    .querySelectorAll(".tag-suggestion-item")
    .forEach((item) => {
      item.addEventListener("click", () => {
        const tag = item.dataset.tag;
        const tagInput = document.getElementById("postTags");
        const currentValue = tagInput.value;
        const tags = currentValue.split(",").map((t) => t.trim());
        tags[tags.length - 1] = tag;
        tagInput.value = tags.join(", ") + ", ";
        hideTagSuggestions();
        tagInput.focus();
      });
    });

  suggestionsContainer.style.display = "block";
}

// 태그 제안 숨기기
function hideTagSuggestions() {
  document.getElementById("tagSuggestions").style.display = "none";
}

// URL 검증 설정
function setupUrlValidation() {
  document
    .getElementById("validateUrlBtn")
    .addEventListener("click", validateSourceUrl);
}

// URL 검증 실행
async function validateSourceUrl() {
  const urlInput = document.getElementById("sourceUrl");
  const resultContainer = document.getElementById("urlValidationResult");
  const validateBtn = document.getElementById("validateUrlBtn");
  const url = urlInput.value.trim();

  if (!url) {
    showUrlValidationResult("URL을 입력해주세요.", false);
    return;
  }

  // 버튼 상태 변경
  const originalText = validateBtn.textContent;
  validateBtn.disabled = true;
  validateBtn.textContent = "검증 중...";

  try {
    // 클라이언트 측 URL 형식 검증
    const urlObj = new URL(url);

    // 프로토콜 검증 (HTTP/HTTPS만 허용)
    if (!["http:", "https:"].includes(urlObj.protocol)) {
      showUrlValidationResult("HTTP 또는 HTTPS URL만 허용됩니다.", false);
      return;
    }

    // 로컬 주소 차단
    const hostname = urlObj.hostname.toLowerCase();
    const blockedHosts = ["localhost", "127.0.0.1", "0.0.0.0", "::1"];
    const isLocalIP = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/.test(
      hostname
    );

    if (blockedHosts.includes(hostname) || isLocalIP) {
      showUrlValidationResult("로컬 주소는 허용되지 않습니다.", false);
      return;
    }

    // 서버에서 URL 접근 가능성 검증
    const response = await fetch("/api/admin/manual-posting/validate-url", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
      credentials: "include",
    });

    const data = await response.json();

    if (data.success) {
      let message = "URL이 유효합니다.";
      if (data.title) {
        message += ` (페이지 제목: ${data.title})`;
      }
      if (data.statusCode) {
        message += ` [HTTP ${data.statusCode}]`;
      }
      showUrlValidationResult(message, true);

      // 페이지 제목이 있으면 소스명으로 제안
      if (data.title && !document.getElementById("sourceName")) {
        // 소스명 필드가 있다면 자동 입력 (현재는 없지만 향후 추가 가능)
        console.log("Suggested source name:", data.title);
      }
    } else {
      showUrlValidationResult(data.error || "URL에 접근할 수 없습니다.", false);
    }
  } catch (error) {
    if (error.name === "TypeError" && error.message.includes("Invalid URL")) {
      showUrlValidationResult("올바른 URL 형식이 아닙니다.", false);
    } else {
      console.error("URL 검증 오류:", error);
      showUrlValidationResult("URL 검증 중 오류가 발생했습니다.", false);
    }
  } finally {
    // 버튼 상태 복원
    validateBtn.disabled = false;
    validateBtn.textContent = originalText;
  }
}

// URL 검증 결과 표시
function showUrlValidationResult(message, isSuccess, details = null) {
  const resultContainer = document.getElementById("urlValidationResult");
  resultContainer.className = isSuccess
    ? "url-validation-success"
    : "url-validation-error";

  let content = `<div style="display: flex; align-items: center; gap: 8px;">`;
  content += `<span style="font-size: 1.2rem;">${
    isSuccess ? "✅" : "❌"
  }</span>`;
  content += `<span>${message}</span>`;
  content += `</div>`;

  if (details) {
    content += `<div style="margin-top: 8px; font-size: 0.9rem; opacity: 0.8;">`;
    if (details.responseTime) {
      content += `응답 시간: ${details.responseTime}ms | `;
    }
    if (details.contentType) {
      content += `콘텐츠 타입: ${details.contentType} | `;
    }
    if (details.contentLength) {
      content += `크기: ${formatFileSize(details.contentLength)}`;
    }
    content += `</div>`;
  }

  resultContainer.innerHTML = content;
  resultContainer.style.display = "block";

  // 자동 숨김 (성공한 경우 5초 후, 실패한 경우 10초 후)
  setTimeout(
    () => {
      if (resultContainer.style.display === "block") {
        resultContainer.style.display = "none";
      }
    },
    isSuccess ? 5000 : 10000
  );
}

// 사용 가능한 태그 로드
async function loadAvailableTags() {
  try {
    const response = await fetch("/api/admin/manual-posting/tags", {
      credentials: "include",
    });

    const data = await response.json();

    if (data.success) {
      availableTags = data.data.map((tag) => tag.name);
    }
  } catch (error) {
    console.error("태그 로드 오류:", error);
  }
}

// 폼 제출 처리 (비활성화됨 - admin.html의 NutritionPostEditor에서 처리)
/*
async function handleFormSubmit(isDraft = false) {
  const form = document.getElementById('nutritionPostingForm');
  
  // 기본 필드 수집
  const titleEl = document.getElementById('postTitle');
  const summaryEl = document.getElementById('postSummary');
  const contentEl = document.getElementById('postContent');
  const categoryEl = document.getElementById('postCategory');
  const newCategoryEl = document.getElementById('newCategory');
  const tagsEl = document.getElementById('postTags');
  const sourceUrlEl = document.getElementById('sourceUrl');
  
  const title = titleEl ? titleEl.value.trim() : '';
  const summary = summaryEl ? summaryEl.value.trim() : '';
  const content = contentEl ? contentEl.innerHTML.trim() : '';
  const category = (categoryEl ? categoryEl.value : '') || (newCategoryEl ? newCategoryEl.value.trim() : '');
  const tags = tagsEl ? tagsEl.value.trim() : '';
  const sourceUrl = sourceUrlEl ? sourceUrlEl.value.trim() : '';
  const imageFile = document.getElementById('postImage').files[0];
  
  // 유효성 검증
  if (!title || !summary || !content || !category) {
    alert('제목, 요약, 내용, 카테고리는 필수 입력 항목입니다.');
    return;
  }
  
  // 이미지 파일 크기 및 형식 검증
  if (imageFile) {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    
    if (imageFile.size > maxSize) {
      alert('이미지 파일 크기는 5MB 이하여야 합니다.');
      return;
    }
    
    if (!allowedTypes.includes(imageFile.type)) {
      alert('지원되는 이미지 형식: JPG, PNG, GIF, WebP');
      return;
    }
  }
  
  // 제출 버튼 비활성화 및 로딩 표시
  const submitBtn = document.getElementById('publishBtn');
  const draftBtn = document.getElementById('saveDraftBtn');
  const originalSubmitText = submitBtn.textContent;
  const originalDraftText = draftBtn.textContent;
  
  submitBtn.disabled = true;
  draftBtn.disabled = true;
  
  if (isDraft) {
    draftBtn.textContent = '저장 중...';
  } else {
    submitBtn.textContent = '게시 중...';
  }
  
  try {
    let imageUrl = null;
    
    // 이미지 업로드 처리 (새 이미지가 있는 경우)
    if (imageFile) {
      const imageFormData = new FormData();
      imageFormData.append('image', imageFile);
      
      const imageResponse = await fetch('/api/admin/manual-posting/upload-image', {
        method: 'POST',
        body: imageFormData,
        credentials: 'include'
      });
      
      const imageData = await imageResponse.json();
      if (imageData.success) {
        imageUrl = imageData.data.url;
      } else {
        alert('이미지 업로드에 실패했습니다: ' + imageData.error);
        return;
      }
    }
    
    // JSON 데이터 구성
    const postData = {
      title,
      summary,
      content,
      category,
      tags,
      sourceUrl,
      isDraft
    };
    
    if (imageUrl) {
      postData.imageUrl = imageUrl;
    }
    
    const url = currentEditingPostId 
      ? `/api/admin/manual-posting/posts/${currentEditingPostId}`
      : '/api/admin/manual-posting/posts';
    
    const method = currentEditingPostId ? 'PUT' : 'POST';
    
    const response = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(postData),
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (data.success) {
      const action = currentEditingPostId ? '수정' : '작성';
      const status = isDraft ? '임시저장' : '게시';
      alert(`포스팅이 성공적으로 ${action}되어 ${status}되었습니다.`);
      
      // 폼 초기화
      resetForm();
      
      // 포스팅 관리 페이지로 이동
      showPostManagement();
    } else {
      alert(`포스팅 ${isDraft ? '임시저장' : '게시'}에 실패했습니다: ${data.error}`);
    }
  } catch (error) {
    console.error('포스팅 제출 오류:', error);
    alert('포스팅 제출 중 오류가 발생했습니다.');
  } finally {
    // 버튼 상태 복원
    submitBtn.disabled = false;
    draftBtn.disabled = false;
    submitBtn.textContent = originalSubmitText;
    draftBtn.textContent = originalDraftText;
  }
}
*/

// 폼 초기화
function resetForm() {
  document.getElementById("nutritionPostingForm").reset();
  document.getElementById("urlValidationResult").style.display = "none";
  hideTagSuggestions();
  currentEditingPostId = null;
  window.currentEditingPostId = null;
  
  // 관련 상품 필드들도 초기화
  const productFields = [
    'productName1', 'productLink1',
    'productName2', 'productLink2', 
    'productName3', 'productLink3'
  ];
  
  productFields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) {
      field.value = '';
      // iframe 링크 입력칸 스타일 초기화
      if (field.classList.contains('iframe-link-input')) {
        field.style.borderColor = '#d1d5db';
        const helpText = field.parentNode.querySelector('.iframe-link-help small');
        if (helpText) {
          helpText.textContent = '쿠팡 파트너스 iframe의 src 속성 값만 입력하세요';
          helpText.style.color = '#6b7280';
        }
      }
    }
  });
}

// 포스팅 폼 표시
function showPostingForm() {
  document.getElementById("postingFormSection").style.display = "block";
  document.getElementById("postManagementSection").style.display = "none";

  // 버튼 상태 업데이트
  document.getElementById("newPostBtn").style.background = "#4a69bd";
  document.getElementById("managePostsBtn").style.background = "#6b7280";
  
  // 새 포스팅 버튼을 클릭한 경우에만 편집 모드 해제
  // editPost에서 호출된 경우는 편집 모드를 유지
  if (typeof currentEditingPostId !== 'undefined' && currentEditingPostId !== null) {
    // 편집 모드가 설정된 상태에서 새 포스팅 버튼을 클릭한 경우에만 해제
    // 이 함수가 직접 호출된 경우(새 포스팅 버튼 클릭)에는 편집 모드를 해제하지 않음
    console.log('포스팅 폼 표시 - 편집 모드 유지:', currentEditingPostId);
  }
}

// 포스팅 관리 표시
function showPostManagement() {
  document.getElementById("postingFormSection").style.display = "none";
  document.getElementById("postManagementSection").style.display = "block";

  // 버튼 상태 업데이트
  document.getElementById("newPostBtn").style.background = "#6b7280";
  document.getElementById("managePostsBtn").style.background = "#4a69bd";

  // 포스팅 목록 로드
  loadPostsList();
}

// 포스팅 목록 로드
async function loadPostsList() {
  try {
    const searchTerm = document.getElementById("searchPosts").value;
    const status = document.getElementById("filterPostStatus").value;
    const category = document.getElementById("filterPostCategory").value;

    const params = new URLSearchParams({
      page: currentPostsPage,
      limit: 20,
    });

    if (searchTerm) params.append("search", searchTerm);
    if (status) params.append("status", status);
    if (category) params.append("category", category);

    const response = await fetch(`/api/admin/manual-posting/posts?${params}`, {
      credentials: "include",
    });

    const data = await response.json();

    if (data.success) {
      renderPostsTable(data.data.posts);
      renderPostsPagination(data.data.pagination);
    } else {
      console.error("포스팅 목록 로드 실패:", data.error);
    }
  } catch (error) {
    console.error("포스팅 목록 로드 오류:", error);
    document.getElementById("postsManagementTableBody").innerHTML =
      '<tr><td colspan="6" style="padding: 20px; text-align: center; color: #ef4444;">데이터 로딩 실패</td></tr>';
  }
}

// 포스팅 테이블 렌더링
function renderPostsTable(posts) {
  const tbody = document.getElementById("postsManagementTableBody");

  if (posts.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="6" style="padding: 20px; text-align: center; color: #6b7280;">포스팅이 없습니다.</td></tr>';
    return;
  }

  tbody.innerHTML = posts
    .map((post) => {
      const statusClass = post.is_draft
        ? "draft"
        : post.is_active
        ? "published"
        : "inactive";
      const statusText = post.is_draft
        ? "임시저장"
        : post.is_active
        ? "게시됨"
        : "비활성";
      const date = new Date(post.created_at).toLocaleDateString("ko-KR");
      const categoryName = post.categories?.name || "미분류";

      return `
      <tr>
        <td style="padding: 12px 8px;">
          <div style="font-weight: 500; color: #1f2937;">${escapeHtml(
            post.title
          )}</div>
          <div style="font-size: 0.8rem; color: #6b7280; margin-top: 2px;">${escapeHtml(
            post.summary.substring(0, 50)
          )}...</div>
        </td>
        <td style="padding: 12px 8px;">${categoryName}</td>
        <td style="padding: 12px 8px;">
          <span class="post-status-badge post-status-${statusClass}">${statusText}</span>
        </td>
        <td style="padding: 12px 8px;">${date}</td>
        <td style="padding: 12px 8px;">${post.view_count || 0}</td>
        <td style="padding: 12px 8px;">
          <button class="post-action-btn post-edit-btn" onclick="editPost('${
            post.id
          }')">편집</button>
          <button class="post-action-btn post-toggle-btn ${
            post.is_active ? "" : "inactive"
          }" 
                  onclick="togglePostStatus('${post.id}', ${post.is_active})">
            ${post.is_active ? "비활성화" : "활성화"}
          </button>
          <button class="post-action-btn post-delete-btn" onclick="deletePost('${
            post.id
          }')">삭제</button>
        </td>
      </tr>
    `;
    })
    .join("");
}

// 포스팅 페이지네이션 렌더링
function renderPostsPagination(pagination) {
  const container = document.getElementById("postsPagination");

  if (pagination.totalPages <= 1) {
    container.innerHTML = "";
    return;
  }

  let paginationHTML = "";

  // 이전 페이지
  if (pagination.currentPage > 1) {
    paginationHTML += `<button class="pagination-btn" onclick="changePostsPage(${
      pagination.currentPage - 1
    })">이전</button>`;
  }

  // 페이지 번호
  const startPage = Math.max(1, pagination.currentPage - 2);
  const endPage = Math.min(pagination.totalPages, pagination.currentPage + 2);

  for (let i = startPage; i <= endPage; i++) {
    const activeClass = i === pagination.currentPage ? "active" : "";
    paginationHTML += `<button class="pagination-btn ${activeClass}" onclick="changePostsPage(${i})">${i}</button>`;
  }

  // 다음 페이지
  if (pagination.currentPage < pagination.totalPages) {
    paginationHTML += `<button class="pagination-btn" onclick="changePostsPage(${
      pagination.currentPage + 1
    })">다음</button>`;
  }

  container.innerHTML = paginationHTML;
}

// 포스팅 페이지 변경
function changePostsPage(page) {
  currentPostsPage = page;
  loadPostsList();
}

// 포스팅 편집
async function editPost(postId) {
  try {
    const response = await fetch(`/api/admin/manual-posting/posts/${postId}`, {
      credentials: "include",
    });

    const data = await response.json();

    if (data.success) {
      const post = data.data;

      // 폼에 데이터 채우기
      document.getElementById("postTitle").value = post.title;
      document.getElementById("postSummary").value = post.summary;
      // 콘텐츠 에디터는 contenteditable 요소이므로 innerHTML로 채운다
      const contentEl = document.getElementById("postContent");
      if (contentEl) {
        contentEl.innerHTML = post.content || "";
      }
      // 카테고리 설정 - 카테고리 이름으로 설정
      const categoryName = post.categories?.name || "";
      document.getElementById("postCategory").value = categoryName;

      // 태그 처리 - post_tags 배열에서 태그 이름 추출
      const tagNames = post.post_tags?.map((pt) => pt.tags.name) || [];
      document.getElementById("postTags").value = tagNames.join(", ");

      document.getElementById("sourceUrl").value = post.source_url || "";

      // 썸네일 URL이 있으면 입력칸/미리보기 설정
      if (post.thumbnail_url) {
        const thumbUrlInput = document.getElementById("thumbnailUrl");
        if (thumbUrlInput) thumbUrlInput.value = post.thumbnail_url;
        const previewImg = document.getElementById("thumbnailPreviewImg");
        const preview = document.getElementById("thumbnailPreview");
        const uploadArea = document.getElementById("thumbnailUploadArea");
        if (previewImg && preview && uploadArea) {
          previewImg.src = post.thumbnail_url;
          preview.style.display = "block";
          uploadArea.style.display = "none";
        }
      }

      // 이미지 정보 설정
      if (post.image_url) {
        const imageInfo = document.getElementById("imageInfo");
        imageInfo.textContent = "기존 이미지";
      }

      // 관련 상품 정보 채우기 (최대 3개)
      const related = (post.related_products || post.post_related_products || [])
        .slice()
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

      const fields = [
        { nameId: "productName1", linkId: "productLink1" },
        { nameId: "productName2", linkId: "productLink2" },
        { nameId: "productName3", linkId: "productLink3" },
      ];

      for (let i = 0; i < fields.length; i++) {
        const item = related[i];
        const nameEl = document.getElementById(fields[i].nameId);
        const linkEl = document.getElementById(fields[i].linkId);
        if (nameEl) nameEl.value = item ? (item.product_name || "") : "";
        if (linkEl) linkEl.value = item ? (item.product_link || "") : "";
      }

      // 전역 변수 설정 (window 객체에도 설정)
      currentEditingPostId = postId;
      window.currentEditingPostId = postId;
      console.log('편집 모드 설정:', currentEditingPostId);

      // 포스팅 폼으로 이동
      showPostingForm();
    } else {
      alert("포스팅 정보를 불러올 수 없습니다.");
    }
  } catch (error) {
    console.error("포스팅 편집 오류:", error);
    alert("포스팅 정보를 불러오는 중 오류가 발생했습니다.");
  }
}

// 포스팅 상태 토글
async function togglePostStatus(postId, currentStatus) {
  const action = currentStatus ? "비활성화" : "활성화";

  if (!confirm(`이 포스팅을 ${action}하시겠습니까?`)) {
    return;
  }

  try {
    const response = await fetch(
      `/api/admin/manual-posting/posts/${postId}/toggle`,
      {
        method: "PUT",
        credentials: "include",
      }
    );

    const data = await response.json();

    if (data.success) {
      alert(`포스팅이 ${action}되었습니다.`);
      loadPostsList();
    } else {
      alert(`포스팅 ${action}에 실패했습니다.`);
    }
  } catch (error) {
    console.error("포스팅 상태 변경 오류:", error);
    alert("포스팅 상태 변경 중 오류가 발생했습니다.");
  }
}

// 포스팅 삭제
async function deletePost(postId) {
  if (
    !confirm(
      "이 포스팅을 완전히 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
    )
  ) {
    return;
  }

  try {
    const response = await fetch(`/api/admin/manual-posting/posts/${postId}`, {
      method: "DELETE",
      credentials: "include",
    });

    const data = await response.json();

    if (data.success) {
      alert("포스팅이 삭제되었습니다.");
      loadPostsList();
    } else {
      alert("포스팅 삭제에 실패했습니다.");
    }
  } catch (error) {
    console.error("포스팅 삭제 오류:", error);
    alert("포스팅 삭제 중 오류가 발생했습니다.");
  }
}
// 썸네일 이미지 업로드 기능 초기화
function setupThumbnailUpload() {
  const thumbnailInput = document.getElementById("nutritionThumbnail");
  const selectBtn = document.getElementById("selectThumbnailBtn");
  const uploadArea = document.getElementById("thumbnailUploadArea");
  const preview = document.getElementById("thumbnailPreview");
  const previewImg = document.getElementById("thumbnailPreviewImg");
  const removeBtn = document.getElementById("removeThumbnailBtn");
  const filenameEl = document.getElementById("thumbnailFilename");
  const filesizeEl = document.getElementById("thumbnailFilesize");
  const thumbnailUrlInput = document.getElementById("thumbnailUrl");

  // 파일 선택 버튼 클릭
  selectBtn.addEventListener("click", () => {
    thumbnailInput.click();
  });

  // 업로드 영역 클릭
  uploadArea.addEventListener("click", () => {
    if (!preview.style.display || preview.style.display === "none") {
      thumbnailInput.click();
    }
  });

  // 파일 선택 시
  thumbnailInput.addEventListener("change", handleThumbnailFileSelect);

  // 드래그 앤 드롭
  uploadArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadArea.classList.add("dragover");
  });

  uploadArea.addEventListener("dragleave", (e) => {
    e.preventDefault();
    uploadArea.classList.remove("dragover");
  });

  uploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadArea.classList.remove("dragover");

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (validateThumbnailFile(file)) {
        thumbnailInput.files = files;
        handleThumbnailFileSelect();
      }
    }
  });

  // 썸네일 제거 버튼
  removeBtn.addEventListener("click", removeThumbnail);

  // URL 입력 시 미리보기
  thumbnailUrlInput.addEventListener("input", handleThumbnailUrlInput);
  thumbnailUrlInput.addEventListener("blur", handleThumbnailUrlBlur);
}

// 썸네일 파일 선택 처리
function handleThumbnailFileSelect() {
  const thumbnailInput = document.getElementById("nutritionThumbnail");
  const file = thumbnailInput.files[0];

  if (!file) return;

  if (!validateThumbnailFile(file)) {
    thumbnailInput.value = "";
    return;
  }

  // 파일 정보 표시
  document.getElementById("thumbnailFilename").textContent = file.name;
  document.getElementById("thumbnailFilesize").textContent = formatFileSize(
    file.size
  );

  // 미리보기 생성
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById("thumbnailPreviewImg").src = e.target.result;
    showThumbnailPreview();
  };
  reader.readAsDataURL(file);

  // URL 입력 필드 비우기
  document.getElementById("thumbnailUrl").value = "";
}

// 썸네일 파일 유효성 검사
function validateThumbnailFile(file) {
  const maxSize = 5 * 1024 * 1024; // 5MB
  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];

  if (!allowedTypes.includes(file.type)) {
    alert("지원되는 이미지 형식: JPG, PNG, GIF, WebP");
    return false;
  }

  if (file.size > maxSize) {
    alert("이미지 파일 크기는 5MB 이하여야 합니다.");
    return false;
  }

  return true;
}

// 썸네일 URL 입력 처리
function handleThumbnailUrlInput() {
  const urlInput = document.getElementById("thumbnailUrl");
  const url = urlInput.value.trim();

  if (url) {
    // 파일 입력 비우기
    document.getElementById("nutritionThumbnail").value = "";
  }
}

// 썸네일 URL 입력 완료 처리
function handleThumbnailUrlBlur() {
  const urlInput = document.getElementById("thumbnailUrl");
  const url = urlInput.value.trim();

  if (url) {
    // URL 유효성 검사
    try {
      new URL(url);

      // 이미지 URL인지 확인
      if (isImageUrl(url)) {
        // 미리보기 표시
        document.getElementById("thumbnailPreviewImg").src = url;
        document.getElementById("thumbnailFilename").textContent =
          "외부 이미지 URL";
        document.getElementById("thumbnailFilesize").textContent =
          "크기 확인 불가";
        showThumbnailPreview();
      } else {
        alert("이미지 URL이 아닙니다. 이미지 파일의 직접 링크를 입력해주세요.");
        urlInput.value = "";
      }
    } catch (error) {
      alert("올바른 URL 형식이 아닙니다.");
      urlInput.value = "";
    }
  }
}

// 이미지 URL 확인
function isImageUrl(url) {
  const imageExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".bmp",
    ".svg",
  ];
  const urlLower = url.toLowerCase();
  return (
    imageExtensions.some((ext) => urlLower.includes(ext)) ||
    urlLower.includes("image") ||
    urlLower.includes("img")
  );
}

// 썸네일 미리보기 표시
function showThumbnailPreview() {
  document.getElementById("thumbnailUploadArea").style.display = "none";
  document.getElementById("thumbnailPreview").style.display = "block";
}

// 썸네일 제거
function removeThumbnail() {
  document.getElementById("nutritionThumbnail").value = "";
  document.getElementById("thumbnailUrl").value = "";
  document.getElementById("thumbnailPreview").style.display = "none";
  document.getElementById("thumbnailUploadArea").style.display = "block";
  document.getElementById("thumbnailPreviewImg").src = "";
}

// 썸네일 데이터 가져오기 (폼 제출 시 사용)
function getThumbnailData() {
  const fileInput = document.getElementById("nutritionThumbnail");
  const urlInput = document.getElementById("thumbnailUrl");

  if (fileInput.files[0]) {
    return {
      type: "file",
      data: fileInput.files[0],
    };
  } else if (urlInput.value.trim()) {
    return {
      type: "url",
      data: urlInput.value.trim(),
    };
  }

  return null;
}

// 기존 setupManualPosting 확장: 썸네일 업로드와 폼 제출 리스너까지 한 번에 설정
(function extendManualPostingSetup() {
  const original = setupManualPosting;
  setupManualPosting = function () {
    // 기본 설정 실행 (버튼 토글, 태그/URL/검색 등)
    if (typeof original === 'function') {
      original.call(this);
    }

    // 썸네일 업로드 UI 초기화
    if (document.getElementById('thumbnailUploadArea')) {
      setupThumbnailUpload();
    }

    // iframe 링크 입력 검증 설정
    setupIframeLinkValidation();

    // 폼 제출 리스너 연결(중복 방지 위해 once 형태로 연결)
    const nutritionPostingForm = document.getElementById('nutritionPostingForm');
    if (nutritionPostingForm && !nutritionPostingForm.__boundSubmit) {
      nutritionPostingForm.addEventListener('submit', handleNutritionPostingSubmit);
      nutritionPostingForm.__boundSubmit = true;
    }
  };
})();

// iframe 링크 입력 검증 설정
function setupIframeLinkValidation() {
  const iframeInputs = document.querySelectorAll('.iframe-link-input');
  
  iframeInputs.forEach(input => {
    input.addEventListener('input', function() {
      const value = this.value.trim();
      const helpText = this.parentNode.querySelector('.iframe-link-help small');
      
      if (value) {
        // iframe src 형식 검증
        if (value.includes('coupa.ng') || value.includes('iframe') || value.startsWith('http')) {
          this.style.borderColor = '#10b981';
          if (helpText) {
            helpText.textContent = '✅ 올바른 iframe 링크 형식입니다';
            helpText.style.color = '#10b981';
          }
        } else {
          this.style.borderColor = '#ef4444';
          if (helpText) {
            helpText.textContent = '⚠️ iframe src 링크를 입력해주세요 (예: https://coupa.ng/cjIiFf)';
            helpText.style.color = '#ef4444';
          }
        }
      } else {
        this.style.borderColor = '#d1d5db';
        if (helpText) {
          helpText.textContent = '쿠팡 파트너스 iframe의 src 속성 값만 입력하세요';
          helpText.style.color = '#6b7280';
        }
      }
    });
  });
}

// 영양정보 포스팅 폼 제출 처리
async function handleNutritionPostingSubmit(event) {
  event.preventDefault();
  
  const form = event.target;
  
  // iframe 링크 검증
  const iframeInputs = document.querySelectorAll('.iframe-link-input');
  let hasInvalidLink = false;
  
  iframeInputs.forEach(input => {
    const value = input.value.trim();
    if (value && !(value.includes('coupa.ng') || value.includes('iframe') || value.startsWith('http'))) {
      hasInvalidLink = true;
      input.style.borderColor = '#ef4444';
      input.focus();
    }
  });
  
  if (hasInvalidLink) {
    alert('올바른 iframe 링크 형식을 입력해주세요.\n예시: https://coupa.ng/cjIiFf');
    return;
  }
  
  // JSON 데이터로 구성
  const postData = {
    title: document.getElementById('postTitle').value,
    summary: document.getElementById('postSummary').value,
    content: document.getElementById('postContent').innerHTML,
    category: document.getElementById('postCategory').value,
    tags: document.getElementById('postTags').value,
    sourceUrl: document.getElementById('sourceUrl').value,
    thumbnailUrl: document.getElementById('thumbnailUrl').value,
    
    // 관련 상품 정보 추가
    productName1: document.getElementById('productName1').value,
    productLink1: document.getElementById('productLink1').value,
    productName2: document.getElementById('productName2').value,
    productLink2: document.getElementById('productLink2').value,
    productName3: document.getElementById('productName3').value,
    productLink3: document.getElementById('productLink3').value,
    
    // 임시저장 여부 확인
    isDraft: event.submitter && event.submitter.id === 'saveDraftBtn'
  };
  
  // 편집 모드인지 확인
  const isEditMode = currentEditingPostId && currentEditingPostId !== null;
  console.log('편집 모드 확인:', isEditMode, '편집 ID:', currentEditingPostId);
  console.log('전송할 데이터:', postData);
  
  try {
    // 편집 모드에 따라 URL과 메서드 결정
    const url = isEditMode 
      ? `/api/admin/manual-posting/posts/${currentEditingPostId}`
      : '/api/admin/manual-posting/posts';
    const method = isEditMode ? 'PUT' : 'POST';
    
    console.log('요청 URL:', url, '메서드:', method);
    
    const response = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(postData),
      credentials: 'include'
    });
    
    const result = await response.json();
    
    if (result.success) {
      const action = isEditMode ? '수정' : '작성';
      const status = postData.isDraft ? '임시저장' : '게시';
      alert(`포스팅이 성공적으로 ${action}되어 ${status}되었습니다.`);
      
      // 편집 모드였다면 편집 모드 해제
      if (isEditMode) {
        currentEditingPostId = null;
        window.currentEditingPostId = null;
        console.log('편집 모드 해제됨');
      }
      
      // 폼 초기화
      resetForm();
      
      // 포스팅 관리 페이지로 이동
      showPostManagement();
    } else {
      alert('포스팅 실패: ' + (result.error || '알 수 없는 오류'));
    }
  } catch (error) {
    console.error('포스팅 제출 오류:', error);
    alert('포스팅 중 오류가 발생했습니다.');
  }
}
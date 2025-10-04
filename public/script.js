let profileData = {};
let mealConfig = {};
let currentProfileSection = 1;

// 개발 환경에서만 로깅 활성화
const isDebug = true; // 실제 프로덕션 환경에서는 false로 설정
function log(...args) {
  if (isDebug) console.log(...args);
}

// 홈 섹션에서 식단 목표 선택
function selectMealPurpose(card, purpose) {
  log("Meal purpose selected:", purpose);
  const cards = document.querySelectorAll(".meal-type-card");
  cards.forEach((c) => c.classList.remove("selected"));
  card.classList.add("selected");
  document.getElementById("startProfileBtn").disabled = false;
  profileData.meal_purpose = purpose;
}

// 섹션 표시/숨김
function showSection(sectionId, isProfileSection = false) {
  const sections = isProfileSection
    ? document.querySelectorAll(".profile-section")
    : document.querySelectorAll(".section");
  sections.forEach((section) => section.classList.remove("active"));
  const targetSection = isProfileSection
    ? document.getElementById(`profileSection${sectionId}`)
    : document.getElementById(sectionId);
  if (targetSection) {
    targetSection.classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
    // 프로필 수정 진입 시 식단구성 하단 버튼 제거
    if (sectionId === "profile") {
      const navBtnsFixed = document.querySelector(".meal-nav-btns-fixed");
      if (navBtnsFixed) navBtnsFixed.remove();
    }
    if (isProfileSection) {
      const progressBar = document.getElementById("profileProgressBar");
      const progressPercentage = ((sectionId - 1) / 2) * 100;
      progressBar.style.width = `${progressPercentage}%`;
      document.querySelectorAll(".progress-step").forEach((step, index) => {
        step.classList.toggle("active", index + 1 <= sectionId);
      });
      currentProfileSection = sectionId;
    }
    // 식단 구성 섹션 진입 시 첫 질문 렌더링
    if (sectionId === "meal_form") {
      mealAnswers = {};
      mealStep = 0;
      // 첫 번째 질문은 애니메이션 없이 바로 표시
      setTimeout(() => {
        renderMealQuestion();
      }, 100);
    }
  } else {
    // 섹션이 없는 경우 조용히 처리 (페이지별 초기화에서 정상적인 경우)
    console.debug(`Section ${sectionId} not found on this page.`);
  }
}

function getFallbackLabel(input) {
  return input.placeholder || input.name || input.id || "알 수 없는 항목";
}

// 유효성 검사 함수
function validateSection(sectionElement) {
  let isValid = true;
  let missingFields = [];

  sectionElement.querySelectorAll("[required]").forEach((input) => {
    const value = parseFloat(input.value);
    const min = parseFloat(input.min);
    const max = parseFloat(input.max);
    const errorSpan = document.getElementById(`${input.id}-error`);

    if (!input.checkValidity() || value < min || value > max) {
      isValid = false;
      errorSpan.textContent = "정상적인 숫자를 입력하세요";
      errorSpan.classList.add("active");
      input.classList.add("invalid");
      // 라벨 텍스트 추출 (없으면 대체 텍스트)
      const label = sectionElement.querySelector(`label[for="${input.id}"]`);
      if (label) {
        missingFields.push(label.textContent.trim());
      } else {
        missingFields.push(getFallbackLabel(input));
      }
    } else {
      errorSpan.textContent = "";
      errorSpan.classList.remove("active");
      input.classList.remove("invalid");
    }
  });

  sectionElement.querySelectorAll(".option-group").forEach((group) => {
    const dataName = group.dataset.name;
    // 기본 선택 유효성 검사
    if (
      [
        "gender",
        "activity_level",
        "eating_patterns",
        "sleep_patterns",
        "meals_per_day",
        "alcohol_consumption",
        "smoking_status",
      ].includes(dataName) &&
      !group.querySelector(".option.selected")
    ) {
      isValid = false;
      group.classList.add("error");
      setTimeout(() => group.classList.remove("error"), 2000);
      // 그룹 라벨 추출 (없으면 data-name 등 대체)
      const label =
        group.querySelector(".option-group-label") ||
        group.previousElementSibling;
      if (label && label.textContent) {
        missingFields.push(label.textContent.trim());
      } else if (group.dataset && group.dataset.name) {
        missingFields.push(group.dataset.name);
      } else {
        missingFields.push("알 수 없는 그룹");
      }
    }

    // '기타' 입력 필드 유효성 검사
    if (
      ["allergies", "illnesses", "biomarkers", "supplements"].includes(dataName)
    ) {
      let toggleOptionValue;
      let hiddenInputId;
      let textInputId;

      if (dataName === "allergies") {
        toggleOptionValue = "other_allergy_toggle";
        hiddenInputId = "otherAllergyInput";
        textInputId = "other_allergies_text";
      } else if (dataName === "illnesses") {
        toggleOptionValue = "other_illness_toggle";
        hiddenInputId = "otherIllnessInput";
        textInputId = "other_illnesses_text";
      } else if (dataName === "biomarkers") {
        toggleOptionValue = "other_biomarker_toggle";
        hiddenInputId = "otherBiomarkerInput";
        textInputId = "other_biomarkers_text";
      } else if (dataName === "supplements") {
        toggleOptionValue = "other_supplement_toggle";
        hiddenInputId = "otherSupplementInput";
        textInputId = "other_supplements_text";
      }

      const toggleOption = group.querySelector(
        `[data-value="${toggleOptionValue}"]`
      );
      const hiddenInputContainer = document.getElementById(hiddenInputId);
      const textInput = document.getElementById(textInputId);

      if (
        toggleOption &&
        toggleOption.classList.contains("selected") &&
        hiddenInputContainer &&
        hiddenInputContainer.classList.contains("active") &&
        textInput &&
        !textInput.value.trim()
      ) {
        isValid = false;
        textInput.reportValidity();
        // 기타 입력 라벨 (없으면 대체)
        const label =
          group.querySelector(".option-group-label") ||
          group.previousElementSibling;
        if (label && label.textContent) {
          missingFields.push(label.textContent.trim() + " (기타 입력)");
        } else if (group.dataset && group.dataset.name) {
          missingFields.push(group.dataset.name + " (기타 입력)");
        } else {
          missingFields.push("알 수 없는 그룹 (기타 입력)");
        }
      }
    }

    // 개별 바이오마커/건강기능식품 입력 필드 유효성 검사 (새로 추가)
    group.querySelectorAll(".option.selected").forEach((option) => {
      const valueInput = option.querySelector(".value-input");
      if (
        valueInput &&
        valueInput.classList.contains("active") &&
        !valueInput.value.trim()
      ) {
        isValid = false;
        valueInput.reportValidity(); // HTML5 기본 유효성 검사 메시지 표시
        // 옵션 라벨 (없으면 대체)
        const label = option.textContent.trim();
        if (label) {
          missingFields.push(label + " (수치 입력)");
        } else {
          missingFields.push("알 수 없는 옵션 (수치 입력)");
        }
      }
    });
  });
  return { isValid, missingFields };
}

// 프로필 섹션 이동
function nextProfileSection(currentSection) {
  const currentSectionElement = document.getElementById(
    `profileSection${currentSection}`
  );
  const { isValid, missingFields } = validateSection(currentSectionElement);
  if (isValid) {
    if (currentSection < 3) {
      showSection(currentSection + 1, true);
    } else {
      document.getElementById("profileForm").submit();
    }
  } else {
    let msg = "모든 필수 항목을 올바르게 입력해주세요.";
    if (missingFields.length > 0) {
      msg += "\n\n입력되지 않은 항목: \n- " + missingFields.join("\n- ");
    }
    alert(msg);
  }
}

function prevProfileSection(currentSection) {
  if (currentSection > 1) {
    showSection(currentSection - 1, true);
  } else {
    showSection("home");
  }
}

// 프로필 데이터 저장
async function saveProfile(event) {
  event.preventDefault();
  if (currentProfileSection !== 3) return;
  const form = document.getElementById("profileForm");
  const formData = new FormData(form);

  // 각 바이오마커와 건강기능식품의 값을 수집하기 위한 객체
  const specificBiomarkers = {};
  const specificSupplements = {};

  // 바이오마커 값 수집
  document
    .querySelectorAll('#profileForm [data-name="biomarkers"] .option.selected')
    .forEach((option) => {
      const dataValue = option.dataset.value;
      if (dataValue !== "other_biomarker_toggle") {
        // '기타' 옵션은 제외
        const inputElement = option.querySelector(".value-input");
        if (inputElement && inputElement.value.trim()) {
          specificBiomarkers[dataValue] = inputElement.value.trim();
        }
      }
    });

  // 건강기능식품 값 수집
  document
    .querySelectorAll('#profileForm [data-name="supplements"] .option.selected')
    .forEach((option) => {
      const dataValue = option.dataset.value;
      if (dataValue !== "other_supplement_toggle") {
        // '기타' 옵션은 제외
        const inputElement = option.querySelector(".value-input");
        if (inputElement && inputElement.value.trim()) {
          specificSupplements[dataValue] = inputElement.value.trim();
        }
      }
    });

  // 하루 식사 횟수(숫자) 저장
  const mealsPerDay = formData.get("meals_per_day") || "";
  profileData = {
    ...profileData,
    age: formData.get("age"),
    height: formData.get("height"),
    weight: formData.get("weight"),
    meals_per_day: mealsPerDay,
    other_allergies_text: formData.get("other_allergies_text") || "",
    other_illnesses_text: formData.get("other_illnesses_text") || "",
    other_biomarkers_text: formData.get("other_biomarkers_text") || "",
    other_supplements_text: formData.get("other_supplements_text") || "",
    ...collectOptionGroupData("#profileForm"), // 기존 옵션 그룹 데이터
    specific_biomarkers: specificBiomarkers, // 개별 바이오마커 수치
    specific_supplements: specificSupplements, // 개별 건강기능식품 수치
  };
  log("Profile Data Saved:", profileData);
  // 로그인 상태 확인
  const res = await fetch("/api/auth/me", { credentials: "include" });
  const data = await res.json();
  if (data.loggedIn) {
    // 서버에 프로필 저장
    try {
      const saveRes = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(profileData),
      });

      if (saveRes.ok) {
        showSection("meal_form");
      } else {
        alert("프로필 저장에 실패했습니다. 다시 시도해주세요.");
      }
    } catch (error) {
      console.error("프로필 저장 오류:", error);
      alert("프로필 저장 중 오류가 발생했습니다.");
    }
  } else {
    showProfileSaveModal(profileData);
  }
}

function showProfileSaveModal(profileData) {
  const modal = document.getElementById("profileSaveModal");
  modal.style.display = "flex";
  
  // 모달 배경 클릭 시 닫기
  modal.onclick = function(e) {
    if (e.target === modal) {
      modal.style.display = "none";
    }
  };
  
  document.getElementById("saveAfterLoginBtn").onclick = function () {
    localStorage.setItem("pendingProfile", JSON.stringify(profileData));
    window.location.href = "login.html?afterProfileSave=1";
  };
  document.getElementById("tempSaveBtn").onclick = function () {
    localStorage.setItem("pendingProfile", JSON.stringify(profileData));
    modal.style.display = "none";
    showSection("meal_form");
  };
}

function closeProfileSaveModal() {
  const modal = document.getElementById("profileSaveModal");
  modal.style.display = "none";
}

// option-group 데이터 수집 (기존과 동일, 특정 필드 제외)
function collectOptionGroupData(containerSelector) {
  const data = {};
  document
    .querySelectorAll(`${containerSelector} .option-group`)
    .forEach((group) => {
      const dataName = group.dataset.name;
      // 'biomarkers'와 'supplements'는 개별 값으로 따로 처리하므로 여기서는 선택된 옵션 자체만 수집
      const selectedOptions = Array.from(
        group.querySelectorAll(".option.selected")
      )
        .map((option) => option.dataset.value)
        .filter(
          (value) =>
            ![
              "other_allergy_toggle",
              "other_illness_toggle",
              "other_biomarker_toggle",
              "other_supplement_toggle",
              "other_ingredients_toggle",
            ].includes(value)
        );

      // 특정 필드들 (biomarkers, supplements)은 여기서 배열로만 저장하고, 실제 값은 saveProfile에서 specific_biomarkers/supplements로 따로 저장
      if (["biomarkers", "supplements"].includes(dataName)) {
        data[dataName] = selectedOptions;
      } else {
        data[dataName] =
          selectedOptions.length === 1 && selectedOptions.length !== 0
            ? selectedOptions[0]
            : selectedOptions;
      }
    });
  return data;
}

// 식단 구성 다이나믹 질문 데이터
const mealQuestions = [
  {
    key: "meal_period",
    label: "식단 기간을 선택하세요",
    type: "single",
    options: [
      { value: "day", label: "하루" },
      { value: "week", label: "일주일" },
    ],
  },
  {
    key: "meal_times",
    label: "식사 시간을 선택하세요",
    type: "single",
    options: [
      { value: "breakfast", label: "아침" },
      { value: "lunch", label: "점심" },
      { value: "dinner", label: "저녁" },
      { value: "snacks", label: "야식" },
    ],
  },
  {
    key: "budget",
    label: "한끼 식사 예산",
    type: "single",
    options: [
      { value: "low", label: "저렴 (5000원 이하)" },
      { value: "medium", label: "중간 (5000-10000원)" },
      { value: "high", label: "높음 (10000원 이상)" },
    ],
  },
  {
    key: "kitchen_appliances",
    label: "주방 기구 (중복 선택 가능)",
    type: "multi",
    options: [
      { value: "gas_stove", label: "가스레인지" },
      { value: "microwave", label: "전자레인지" },
      { value: "air_fryer", label: "에어프라이어" },
      { value: "oven", label: "오븐" },
    ],
  },
  {
    key: "preferred_ingredients",
    label: "사용하고 싶은 음식 재료 (중복 선택 가능)",
    type: "multi",
    options: [
      { value: "egg", label: "계란" },
      { value: "tofu", label: "두부" },
      { value: "cheese", label: "치즈" },
      { value: "milk", label: "우유" },
      { value: "fish", label: "생선" },
      { value: "beef", label: "소고기" },
      { value: "pork", label: "돼지고기" },
      { value: "chicken", label: "닭고기" },
      { value: "canned_tuna", label: "캔참치" },
      { value: "carrot", label: "당근" },
      { value: "potato", label: "감자" },
      { value: "cucumber", label: "오이" },
      { value: "mushroom", label: "버섯" },
      { value: "cabbage", label: "배추" },
      { value: "kimchi", label: "김치" },
      { value: "other_ingredients_toggle", label: "직접 입력" },
    ],
    hasOtherInput: true,
  },
  {
    key: "cooking_methods",
    label: "선호 조리법 (중복 선택 가능)",
    type: "multi",
    options: [
      { value: "grilling", label: "구이" },
      { value: "frying", label: "튀김" },
      { value: "stir_frying", label: "볶음" },
      { value: "simmering", label: "조림" },
      { value: "seasoning", label: "무침" },
      { value: "steaming", label: "찜" },
      { value: "boiling", label: "삶기" },
      { value: "baking", label: "베이킹" },
    ],
  },
  {
    key: "dishes_per_meal",
    label: "식단별 메뉴 개수",
    type: "single",
    options: [
      { value: "1", label: "1개" },
      { value: "2", label: "2개" },
      { value: "3", label: "3개" },
      { value: "4", label: "4개" },
    ],
  },
  {
    key: "cuisine_style",
    label: "음식 스타일 (중복 선택 가능)",
    type: "multi",
    options: [
      { value: "korean", label: "한식" },
      { value: "chinese", label: "중식" },
      { value: "japanese", label: "일식" },
      { value: "western", label: "양식" },
    ],
  },
];

let mealAnswers = {};
let mealStep = 0;

// 현재 단계에서 표시할 질문을 가져오는 함수
function getCurrentQuestion() {
  const q = mealQuestions[mealStep];
  if (!q) return null;
  // 일주일 식단을 선택했고 현재식사시간(meal_times) 질문인 경우만 건너뛰기 (dishes_per_meal은 건너뛰지 않음)
  while (
    mealAnswers.meal_period === "week" &&
    mealQuestions[mealStep] &&
    mealQuestions[mealStep].key === "meal_times"
  ) {
    mealStep++;
    // q를 다시 할당
    if (!mealQuestions[mealStep]) return null;
  }
  return mealQuestions[mealStep];
}

function renderMealQuestion() {
  const container = document.getElementById("dynamicMealForm");
  const q = getCurrentQuestion();
  if (!q) return;

  // 컨테이너에 직접 meal-question-block 생성
  container.innerHTML = '';

  // 로그인 상태 확인
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const isLoggedIn = !!user;

  // 문항만 렌더링
  let html = `<div class="meal-question-block meal-question-slide slide-current" data-question-key="${q.key}"><div class="meal-question-label">${q.label}</div><div class="meal-options">`;
  q.options.forEach((opt) => {
    const selected = (
      q.type === "multi"
        ? (mealAnswers[q.key] || []).includes(opt.value)
        : mealAnswers[q.key] === opt.value
    )
      ? "selected"
      : "";
    
    // preferred_ingredients와 cooking_methods 질문에 대해서 작은 버튼 클래스 사용
    const buttonClass =
      q.key === "preferred_ingredients" || q.key === "cooking_methods"
        ? "meal-block-btn-small"
        : "meal-block-btn";
    
    // 비로그인 상태에서 dishes_per_meal의 3개, 4개 옵션 차단
    const isRestrictedOption = !isLoggedIn && q.key === "dishes_per_meal" && (opt.value === "3" || opt.value === "4");
    
    if (isRestrictedOption) {
      // 제한된 옵션은 비활성화 스타일로 렌더링
      html += `<div class="${buttonClass} login-restricted" data-value="${opt.value}" style="position: relative; opacity: 0.6; pointer-events: none;">
        ${opt.label}
        <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(255, 255, 255, 0.8); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 600; color: #666;">🔒</div>
      </div>`;
    } else {
      html += `<div class="${buttonClass} ${selected}" data-value="${opt.value}">${opt.label}</div>`;
    }
  });
  html += "</div>";
  if (q.hasOtherInput) {
    // 기타 입력 버튼이 선택된 경우에만 입력창 보이도록
    const showOther = (mealAnswers[q.key] || []).includes(
      "other_ingredients_toggle"
    );
    html += `<div class="meal-other-input" style="margin-top:1em;${
      showOther ? "" : "display:none;"
    }">
      <input type="text" id="other_ingredients_text" placeholder="기타 재료를 입력해주세요 (쉼표로 구분)">
    </div>`;
  }
  html += "</div>";

  container.innerHTML = html;

  // 옵션 개수에 따라 many-options 클래스 추가
  const block = container.querySelector(".meal-question-block");
  if (q.options.length >= 8) {
    block.classList.add("many-options");
  } else {
    block.classList.remove("many-options");
  }

  // 하단 고정 버튼 컨테이너 준비
  let navBtnsFixed = document.querySelector(".meal-nav-btns-fixed");
  if (!navBtnsFixed) {
    navBtnsFixed = document.createElement("div");
    navBtnsFixed.className = "meal-nav-btns-fixed";
    document.body.appendChild(navBtnsFixed);
  }
  // 버튼 렌더링
  let btnsHtml = "";
  if (mealStep > 0)
    btnsHtml += '<button type="button" class="meal-prev-btn">이전</button>';
  if (isLastQuestion()) {
    btnsHtml +=
      '<button type="button" class="meal-submit-btn">식단 생성</button>';
  } else {
    btnsHtml += '<button type="button" class="meal-next-btn">다음</button>';
  }
  navBtnsFixed.innerHTML = btnsHtml;

  // 이벤트 바인딩 (문항)
  container
    .querySelectorAll(".meal-block-btn, .meal-block-btn-small")
    .forEach((btn) => {
      btn.onclick = () => {
        // 제한된 옵션 클릭 시 토스트 메시지 표시
        if (btn.classList.contains('login-restricted')) {
          showMealPlanToast('🔑 해당 옵션은 로그인 후 이용할 수 있습니다');
          return;
        }
        
        if (q.type === "multi") {
          mealAnswers[q.key] = mealAnswers[q.key] || [];
          if (mealAnswers[q.key].includes(btn.dataset.value)) {
            mealAnswers[q.key] = mealAnswers[q.key].filter(
              (v) => v !== btn.dataset.value
            );
            btn.classList.remove("selected");
          } else {
            mealAnswers[q.key].push(btn.dataset.value);
            btn.classList.add("selected");
          }
          // 기타 입력 토글
          if (q.hasOtherInput) {
            const otherInput =
              container.querySelector(".meal-other-input");
            if (btn.dataset.value === "other_ingredients_toggle") {
              // other_ingredients_toggle 버튼을 클릭했을 때 토글
              if (mealAnswers[q.key].includes("other_ingredients_toggle")) {
                otherInput.style.display = "block";
              } else {
                otherInput.style.display = "none";
              }
            } else if (
              !mealAnswers[q.key].includes("other_ingredients_toggle")
            ) {
              otherInput.style.display = "none";
            }
          }
        } else {
          // 단일 선택의 경우 모든 버튼에서 selected 클래스 제거
          container
            .querySelectorAll(".meal-block-btn")
            .forEach((b) => b.classList.remove("selected"));
          mealAnswers[q.key] = btn.dataset.value;
          btn.classList.add("selected");
        }
        // renderMealQuestion() 호출 제거 - DOM을 다시 렌더링하지 않음
      };
    });
  if (q.hasOtherInput) {
    const otherInput = container.querySelector("#other_ingredients_text");
    if (otherInput) {
      otherInput.value = mealAnswers.other_ingredients_text || "";
      otherInput.oninput = (e) => {
        mealAnswers.other_ingredients_text = e.target.value;
      };
    }
  }

  // 이벤트 바인딩 (하단 고정 버튼)
  const prevBtn = navBtnsFixed.querySelector(".meal-prev-btn");
  if (prevBtn)
    prevBtn.onclick = () => {
      // 이전 버튼 클릭 시 오른쪽으로 슬라이드
      const currentSlide = container.querySelector(".meal-question-slide");
      currentSlide.classList.remove("slide-current");
      currentSlide.classList.add("slide-out-right");
      setTimeout(() => {
        mealStep--;
        // 이전 단계로 갈 때도 일주일 식단 선택 시 현재식사시간 질문만 건너뛰기
        while (
          mealAnswers.meal_period === "week" &&
          mealQuestions[mealStep] &&
          mealQuestions[mealStep].key === "meal_times"
        ) {
          mealStep--;
        }
        renderMealQuestion();
      }, 300);
    };

  const nextBtn = navBtnsFixed.querySelector(".meal-next-btn");
  if (nextBtn)
    nextBtn.onclick = () => {
      // 유효성 검사
      if (
        q.type === "multi" &&
        (!mealAnswers[q.key] || mealAnswers[q.key].length === 0)
      ) {
        alert("하나 이상 선택해주세요.");
        return;
      }
      if (q.type === "single" && !mealAnswers[q.key]) {
        alert("선택해주세요.");
        return;
      }
      if (
        q.hasOtherInput &&
        mealAnswers[q.key] &&
        mealAnswers[q.key].includes("other_ingredients_toggle") &&
        !mealAnswers.other_ingredients_text
      ) {
        alert("기타 재료를 입력해주세요.");
        return;
      }
      // 다음 버튼 클릭 시에는 다음 문항만 보여주고, AI 식단 생성은 하지 않는다.
      if (!isLastQuestion()) {
        const currentSlide = container.querySelector(
          ".meal-question-slide"
        );
        currentSlide.classList.remove("slide-current");
        currentSlide.classList.add("slide-out-left");
        setTimeout(() => {
          mealStep++;
          // 다음 질문이 현재식사시간이고 일주일 식단을 선택했다면 meal_times만 건너뛰기
          while (
            mealAnswers.meal_period === "week" &&
            mealQuestions[mealStep] &&
            mealQuestions[mealStep].key === "meal_times"
          ) {
            mealStep++;
          }
          renderMealQuestion();
        }, 300);
      }
    };

  const submitBtn = navBtnsFixed.querySelector(".meal-submit-btn");
  if (submitBtn)
    submitBtn.onclick = () => {
      // 유효성 검사
      if (
        q.type === "multi" &&
        (!mealAnswers[q.key] || mealAnswers[q.key].length === 0)
      ) {
        alert("하나 이상 선택해주세요.");
        return;
      }
      if (q.type === "single" && !mealAnswers[q.key]) {
        alert("선택해주세요.");
        return;
      }
      if (
        q.hasOtherInput &&
        mealAnswers[q.key] &&
        mealAnswers[q.key].includes("other_ingredients_toggle") &&
        !mealAnswers.other_ingredients_text
      ) {
        alert("기타 재료를 입력해주세요.");
        return;
      }
      submitDynamicMealForm();
    };
}

// 마지막 질문인지 확인하는 함수
function isLastQuestion() {
  // 일주일 식단을 선택한 경우 현재식사시간(meal_times) 질문만 제외한 마지막 질문
  if (mealAnswers.meal_period === "week") {
    // meal_times를 제외한 문항들의 인덱스 배열 생성
    const filteredIndexes = mealQuestions
      .map((q, idx) => ({ q, idx }))
      .filter((obj) => obj.q.key !== "meal_times")
      .map((obj) => obj.idx);
    // 현재 mealStep이 meal_times를 제외한 문항 중 마지막 인덱스와 같은지 비교
    return mealStep === filteredIndexes[filteredIndexes.length - 1];
  }
  // 하루 식단을 선택한 경우 모든 질문
  return mealStep === mealQuestions.length - 1;
}

function submitDynamicMealForm() {
  // 마지막 질문(single 타입)에서 선택값이 mealAnswers에 반드시 반영되도록 보강
  const q = getCurrentQuestion();
  if (q && q.type === "single") {
    const selectedBtn = container.querySelector(
      ".meal-block-btn.selected, .meal-block-btn-small.selected"
    );
    if (selectedBtn) {
      mealAnswers[q.key] = selectedBtn.dataset.value;
    }
  }
  // meal_period 값이 없으면, 첫 번째 질문(식단 기간)에서 선택된 값을 복사
  if (!mealAnswers.meal_period) {
    const firstQ = mealQuestions[0];
    if (firstQ && mealAnswers[firstQ.key]) {
      mealAnswers.meal_period = mealAnswers[firstQ.key];
    }
  }
  // 일주일 식단을 선택했는데 현재식사시간이 없으면 기본값 설정
  if (mealAnswers.meal_period === "week" && !mealAnswers.meal_times) {
    mealAnswers.meal_times = "lunch"; // 기본값으로 점심 설정
  }
  // 결과 화면에 진입할 때 하단 버튼 숨기기
  const navBtnsFixed = document.querySelector(".meal-nav-btns-fixed");
  if (navBtnsFixed) navBtnsFixed.style.display = "none";
  console.log("mealAnswers:", mealAnswers); // 디버깅용
  const mealConfig = {
    ...mealAnswers,
    other_ingredients_text: mealAnswers.other_ingredients_text || "",
  };
  console.log("mealConfig:", mealConfig); // 디버깅용
  generateMealPlan({ preventDefault: () => {}, dynamicMealConfig: mealConfig });
}

// 식단 구성 데이터 수집 및 API 호출
async function generateMealPlan(event) {
  if (event && typeof event.preventDefault === "function") {
    event.preventDefault();
  }
  const form = document.getElementById("mealForm");
  let formData;
  let localMealConfig; // 지역변수로 선언
  if (form && form.tagName === "FORM") {
    formData = new FormData(form);
    localMealConfig = {
      other_ingredients_text: formData.get("other_ingredients_text") || "",
      ...collectOptionGroupData("#meal_form"),
    };
  } else if (event && event.dynamicMealConfig) {
    localMealConfig = event.dynamicMealConfig;
    formData = {
      get: (key) => localMealConfig[key],
    };
  } else {
    throw new Error("폼 데이터가 없습니다.");
  }
  const period = formData.get("meal_period") || "day";
  log("Meal Config Collected:", localMealConfig, "period:", period);
  const mealPlanContent = document.getElementById("meal_plan_content");
  showSection("meal_plan");
  mealPlanContent.innerHTML = `
      <div class="multi-step-loading">
        <div class="loading-step step1 active" role="status" aria-live="polite">
          <span class="loading-icon"><span class="loading-spinner step-loading"></span><span class="loading-check" style="display:none">✔️</span></span>
          <div class="loading-step-texts">
            <div class="loading-title">건강 정보 분석 중입니다...</div>
            <div class="loading-desc">신체 정보와 식단 목표를 확인하고 있어요.</div>
          </div>
        </div>
        <div class="loading-step step2" role="status" aria-live="polite">
          <span class="loading-icon"><span class="loading-spinner step-loading" style="display:none"></span><span class="loading-check" style="display:none">✔️</span></span>
          <div class="loading-step-texts">
            <div class="loading-title">음식 선호를 반영하고 있어요...</div>
            <div class="loading-desc">기호와 알레르기 정보를 바탕으로 식재료를 선택 중입니다.</div>
          </div>
        </div>
        <div class="loading-step step3" role="status" aria-live="polite">
          <span class="loading-icon"><span class="loading-spinner step-loading" style="display:none"></span></span>
          <div class="loading-step-texts">
            <div class="loading-title">맞춤 식단 구성 중입니다...</div>
            <div class="loading-desc">균형 있는 식단을 완성하고 있어요. 잠시만 기다려주세요! 최대 3분이 소요 될 수 있습니다.</div>
          </div>
        </div>
      </div>
    `;
  // 단계별 전환 (10초씩)
  setTimeout(() => {
    const step1Spinner = document.querySelector(".step1 .loading-spinner");
    const step1Check = document.querySelector(".step1 .loading-check");
    const step1 = document.querySelector(".step1");
    const step2 = document.querySelector(".step2");
    const step2Spinner = document.querySelector(".step2 .loading-spinner");
    if (step1Spinner && step1Check && step1 && step2 && step2Spinner) {
      step1Spinner.style.display = "none";
      step1Check.style.display = "inline-block";
      step1.classList.remove("active");
      step2.classList.add("active");
      step2Spinner.style.display = "inline-block";
    }
  }, 10000);
  setTimeout(() => {
    const step2Spinner = document.querySelector(".step2 .loading-spinner");
    const step2Check = document.querySelector(".step2 .loading-check");
    const step2 = document.querySelector(".step2");
    const step3 = document.querySelector(".step3");
    const step3Spinner = document.querySelector(".step3 .loading-spinner");
    if (step2Spinner && step2Check && step2 && step3 && step3Spinner) {
      step2Spinner.style.display = "none";
      step2Check.style.display = "inline-block";
      step2.classList.remove("active");
      step3.classList.add("active");
      step3Spinner.style.display = "inline-block";
    }
  }, 20000);
  try {
    // 프롬프트 생성 함수 하나로 통일
    const promptText = generatePrompt(profileData, localMealConfig);
    const response = await sendPromptToServer(promptText);
    // 결과 렌더링은 meal_period 값에 따라 분기
    if (period === "week") {
      const weekDays = [
        "월요일",
        "화요일",
        "수요일",
        "목요일",
        "금요일",
        "토요일",
        "일요일",
      ];
      const blocks = response
        .split(/---+/)
        .map((b) => b.trim())
        .filter(Boolean);
      console.log("AI가 생성한 블록 수:", blocks.length);
      console.log(
        "각 블록 내용 미리보기:",
        blocks.map((block, i) => `블록${i + 1}: ${block.substring(0, 100)}...`)
      );

      // 블록 수 확인
      if (blocks.length < 8) {
        console.error(
          `경고: AI가 ${blocks.length}개 블록만 생성했습니다. 8개가 필요합니다.`
        );
        showToast(
          `AI가 ${blocks.length}개 블록만 생성했습니다. 일부 요일의 메뉴가 표시되지 않을 수 있습니다.`,
          "error"
        );
      }

      // 첫 블록에서 diagnosis 추출
      const firstBlockHtml = document.createElement("div");
      firstBlockHtml.innerHTML = styleMealPlanHtml(blocks[0]);
      const diagnosis = firstBlockHtml.querySelector(".diagnosis");
      const diagnosisHtml = diagnosis ? diagnosis.outerHTML : "";

      // 각 블록에서 recommendation만 추출, 요일명만 추출 (첫 번째 상태진단 블록 제외)
      const recommendations = blocks.slice(1).map((block, i) => {
        console.log(
          `블록 ${i + 2} (${weekDays[i]}) 처리 중:`,
          block.substring(0, 200) + "..."
        );
        const temp = document.createElement("div");
        temp.innerHTML = styleMealPlanHtml(block);
        const rec = temp.querySelector(".recommendation");
        console.log(`${weekDays[i]} - recommendation:`, rec ? "찾음" : "없음");
        let recommendationHtml = "";
        if (rec) {
          const menuBlocks = rec.querySelectorAll(".menu-block");
          if (menuBlocks.length > 1) {
            Array.from(menuBlocks).forEach((block, index) => {
              const sectionTitle = block.querySelector(".menu-section-title");
              if (sectionTitle) sectionTitle.textContent = `메뉴${index + 1}`;
            });
            recommendationHtml = `
                            <div class=\"menu-slider-container\">\n                    <div class=\"menu-slider-nav\">\n                        <button class=\"menu-nav-btn prev-btn\" onclick=\"navigateMenu('prev', ${i})\"><span>‹</span></button>\n                        <div class=\"menu-dots\">\n                            ${Array.from(
              menuBlocks
            )
              .map(
                (_, index) =>
                  `\n                                <span class=\"menu-dot ${
                    index === 0 ? "active" : ""
                  }\" onclick=\"goToMenu(${index}, ${i})\"></span>\n                            `
              )
              .join(
                ""
              )}\n                        </div>\n                        <button class=\"menu-nav-btn next-btn\" onclick=\"navigateMenu('next', ${i})\"><span>›</span></button>\n                    </div>\n                    <div class=\"menu-slider\">\n                        ${Array.from(
              menuBlocks
            )
              .map(
                (block, index) =>
                  `\n                            <div class=\"menu-slide ${
                    index === 0 ? "active" : ""
                  }\" data-index=\"${index}\">\n                                ${
                    block.outerHTML
                  }\n                            </div>\n                        `
              )
              .join(
                ""
              )}\n                    </div>\n                </div>\n            `;
          } else {
            recommendationHtml = rec.outerHTML;
          }
        }
        return `<div class=\"week-card\" style=\"display: ${
          i === 0 ? "flex" : "none"
        }; flex-direction: column; align-items: flex-start; min-width:320px; min-height:480px;\">\n        ${recommendationHtml}\n    </div>`;
      });

      // 요일 버튼 네비게이션 추가
      const weekNavHtml = `
              <div class="week-day-nav">
                ${weekDays
                  .map(
                    (d, i) =>
                      `<button class="week-day-btn${
                        i === 0 ? " active" : ""
                      }" role="button" aria-label="${d} 선택" tabindex="0" onclick="goToWeek(${i})">${d}</button>`
                  )
                  .join("")}
              </div>
            `;

      mealPlanContent.innerHTML = `${diagnosisHtml}
                <div class="meal-section-title">추천식단</div>
                ${weekNavHtml}
                <div class="week-slider">${recommendations.join("")}</div>`;

      // 7개 week-card가 되도록 부족한 부분 채우기
      while (recommendations.length < 7) {
        const missingDay = weekDays[recommendations.length];
        recommendations.push(`<div class="week-card" style="display: none; flex-direction: column; align-items: flex-start; min-width:320px; min-height:480px;">
                    <div class="week-day-label">${missingDay}</div>
                    <div class="recommendation">
                        <div class="menu-block">
                            <div class="menu-section-title">메뉴</div>
                            <div class="menu-name">메뉴를 생성하지 못했습니다</div>
                            <div class="nutrition-title">영양정보</div>
                            <ul class="nutrition-list">
                                <li>칼로리: -kcal</li>
                                <li>탄수화물: -g</li>
                                <li>단백질: -g</li>
                                <li>지방: -g</li>
                            </ul>
                        </div>
                    </div>
                </div>`);
      }

      // 전역 인덱스 초기화
      window.currentWeekIndex = 0;
      window.totalWeekCards = recommendations.length;

      // 저장하기 버튼 이벤트 리스너 다시 바인딩
      setTimeout(() => {
        mealPlanContent.querySelectorAll(".save-meal-btn").forEach((button) => {
          const menuBlock = button.closest(".menu-block");
          if (menuBlock && !button.hasAttribute("data-bound")) {
            button.setAttribute("data-bound", "true");
            button.onclick = function () {
              console.log("저장하기 버튼 클릭됨");
              saveMealPlan(menuBlock);
            };
          }
        });
      }, 100);
    } else {
      // 메뉴 블록 개수 확인
      const styledHtml = styleMealPlanHtml(response);
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = styledHtml;
      const menuBlocks = tempDiv.querySelectorAll(".menu-block");
      const diagnosisBlock = tempDiv.querySelector(".diagnosis");
      const mealSectionTitle = tempDiv.querySelector(".meal-section-title");

      if (menuBlocks.length > 1) {
        // 메뉴가 2개 이상인 경우 슬라이더로 구성
        // 각 menu-block의 .menu-section-title 텍스트를 '메뉴1', '메뉴2', ...로 변경
        Array.from(menuBlocks).forEach((block, index) => {
          const sectionTitle = block.querySelector(".menu-section-title");
          if (sectionTitle) sectionTitle.textContent = `메뉴${index + 1}`;
        });
        const menuSliderHtml = `
                    ${diagnosisBlock ? diagnosisBlock.outerHTML : ""}
                    ${
                      mealSectionTitle
                        ? mealSectionTitle.outerHTML
                        : '<div class="meal-section-title">추천식단</div>'
                    }
                    <div class="menu-slider-container">
                        <div class="menu-slider-nav">
                            <button class="menu-nav-btn prev-btn" onclick="navigateMenu('prev')" role="button" aria-label="이전 메뉴" tabindex="0">
                                <span>‹</span>
                            </button>
                            <div class="menu-dots">
                                ${Array.from(menuBlocks)
                                  .map(
                                    (_, index) => `
                                    <span class="menu-dot ${
                                      index === 0 ? "active" : ""
                                    }" onclick="goToMenu(${index})"></span>
                                `
                                  )
                                  .join("")}
                            </div>
                            <button class="menu-nav-btn next-btn" onclick="navigateMenu('next')" role="button" aria-label="다음 메뉴" tabindex="0">
                                <span>›</span>
                            </button>
                        </div>
                        <div class="menu-slider">
                            ${Array.from(menuBlocks)
                              .map(
                                (block, index) => `
                                <div class="menu-slide ${
                                  index === 0 ? "active" : ""
                                }" data-index="${index}">
                                    ${block.outerHTML}
                                </div>
                            `
                              )
                              .join("")}
                        </div>
                    </div>
                `;
        mealPlanContent.innerHTML = convertMarkdownBoldToHtml(menuSliderHtml);
        navigateMenu();

        // 저장하기 버튼 이벤트 리스너 다시 바인딩
        setTimeout(() => {
          mealPlanContent
            .querySelectorAll(".save-meal-btn")
            .forEach((button) => {
              const menuBlock = button.closest(".menu-block");
              if (menuBlock && !button.hasAttribute("data-bound")) {
                button.setAttribute("data-bound", "true");
                button.onclick = function () {
                  console.log("저장하기 버튼 클릭됨");
                  saveMealPlan(menuBlock);
                };
              }
            });
        }, 100);
      } else {
        // 메뉴가 1개인 경우 그대로 표시
        mealPlanContent.innerHTML = convertMarkdownBoldToHtml(styledHtml);

        // 저장하기 버튼 이벤트 리스너 다시 바인딩
        setTimeout(() => {
          mealPlanContent
            .querySelectorAll(".save-meal-btn")
            .forEach((button) => {
              const menuBlock = button.closest(".menu-block");
              if (menuBlock && !button.hasAttribute("data-bound")) {
                button.setAttribute("data-bound", "true");
                button.onclick = function () {
                  console.log("저장하기 버튼 클릭됨");
                  saveMealPlan(menuBlock);
                };
              }
            });
        }, 100);
      }
    }
  } catch (error) {
    log("Error in generateMealPlan:", error);
    mealPlanContent.innerHTML = `<div class="error">식단 생성에 실패했습니다: ${
      error.message.includes("fetch")
        ? "서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요."
        : error.message
    }</div>`;
  }
}

// 토스트 메시지 표시 함수 (meal-plan용)
function showMealPlanToast(message) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 15px 25px;
    border-radius: 10px;
    font-weight: 600;
    z-index: 10000;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  `;
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// 서버로 프롬프트 전송
async function sendPromptToServer(promptText) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 302000); // 302초 타임아웃

  try {
    const response = await fetch(
      "/api/generate-meal-plan",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptText }),
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }
    const data = await response.json();

    let mealPlanText = "";
    if (data && data.candidates && data.candidates.length > 0) {
      const candidate = data.candidates[0];
      if (
        candidate.content &&
        candidate.content.parts &&
        candidate.content.parts.length > 0
      ) {
        const part = candidate.content.parts[0];
        if (part.text) {
          mealPlanText = part.text;
        }
      }
    }

    if (mealPlanText) {
      return mealPlanText;
    } else {
      if (data && data.promptFeedback && data.promptFeedback.blockReason) {
        console.error("API call blocked:", data.promptFeedback);
        throw new Error(
          `식단 생성 요청이 거부되었습니다. 이유: ${data.promptFeedback.blockReason}`
        );
      }
      console.error("Invalid response structure from server:", data);
      throw new Error("응답 형식이 올바르지 않거나 내용이 비어있습니다.");
    }
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("요청 시간이 초과되었습니다.");
    }
    throw error;
  }
}

function generatePrompt(profile, meal) {
  const merged = { ...profile, ...meal };
  let variableSection = "[입력 변수]\n";
  Object.entries(merged).forEach(([key, value]) => {
    let displayValue = value;
    if (key === "activity_level" && value) {
      displayValue = value;
    } else if (key === "illnesses") {
      displayValue = value && value.length > 0 ? value : "none";
    } else if (key === "allergies") {
      displayValue = value && value.length > 0 ? value : "none";
    } else if (key === "biomarkers") {
      displayValue = value && value.length > 0 ? value : "none";
    } else if (key === "supplements") {
      displayValue = value && value.length > 0 ? value : "none";
    } else if (key === "meal_purpose" && value) {
      displayValue = value;
    } else if (typeof value === "object" && value !== null) {
      displayValue = Array.isArray(value)
        ? value.join(", ")
        : JSON.stringify(value);
    }
    variableSection += `- ${key}: ${displayValue}\n`;
  });

  let prompt = "";
  prompt += `${variableSection}\n`;

  // meal_period 값에 따라 프롬프트 분기
  const mealPeriod = merged.meal_period;

  if (mealPeriod === "day") {
    prompt += generateDayMealPrompt();
  } else if (mealPeriod === "week") {
    prompt += generateWeekMealPrompt();
  } else {
    // 기본값은 하루용
    prompt += generateDayMealPrompt();
  }

  return prompt;
}

// 하루용 식단 프롬프트 생성
function generateDayMealPrompt() {
  return (
    "하루 식단을 생성해주세요. 아래의 HTML 구조를 정확히 따라서 하루치 한 끼 식단만 생성하세요.\n" +
    "메뉴 개수에 맞는 menu-block을 생성하세요. 메뉴명을 한 블록에 몰아넣지 마세요.\n" +
    "하나의 menu-block에 메뉴 2개 이상 생성하지 마세요.\n" +
    "불필요한 스타일, id, 이모지, 마크다운, 표, 구분선, 주석 등은 절대 사용하지 마세요.\n" +
    "칼로리 배분에서는 일일 에너지 요구량을 기준으로 하루 식사 횟수를 고려하여 한 끼 당 칼로리를 배분하세요.\n" +
    "재료(주재료, 소스, 기타) 항목의 각 재료명 뒤에는 반드시 괄호로 수량, 무게, 단위를 표기하세요. 예: 닭가슴살(100g), 양파(1/2개)\n" +
    "\n" +
    "🎯 하루 식단 생성 가이드라인:\n" +
    "- 사용자의 건강 상태와 목표에 맞는 균형 잡힌 한 끼 식단 구성\n" +
    "- 영양소 밸런스를 고려한 메뉴 선택\n" +
    "- 실용적이고 실현 가능한 레시피 제공\n" +
    "- 개인의 식이 제한사항과 알레르기 고려\n" +
    "\n" +
    "[하루 식단용 HTML 양식]\n" +
    '<div class="diagnosis">\n' +
    "  <div>상태진단</div>\n" +
    '  <div>기초대사량(BMR) <span class="desc">생명 유지에 필요한 최소한의 에너지 소비량</span></div>\n' +
    "  <div>(여기에 값)Kcal</div>\n" +
    '  <div>일일 에너지 요구량(TEE) <span class="desc">활동정도에 따른 하루 동안 소비하는 총 에너지양</span></div>\n' +
    "  <div>(여기에 값)Kcal</div>\n" +
    "  <div>칼로리 배분</div>\n" +
    "  <div>(여기에 값)</div>\n" +
    "  <div>질병에 따른 식단 주의 사항</div>\n" +
    "  <div>(여기에 값)</div>\n" +
    "  <div>종합 진단</div>\n" +
    "  <div>(여기에 값)</div>\n" +
    "</div>\n" +
    '<div class="meal-section-title">추천식단</div>\n' +
    '<div class="recommendation">\n' +
    '  <div class="menu-block">\n' +
    '    <div class="menu-section-title">메뉴</div>\n' +
    '    <div class="menu-name">(여기에 메뉴명)</div>\n' +
    '    <div class="nutrition-title">영양정보</div>\n' +
    '    <ul class="nutrition-list">\n' +
    "      <li>칼로리: (여기에 값)kcal</li>\n" +
    "      <li>탄수화물: (여기에 값)g</li>\n" +
    "      <li>단백질: (여기에 값)g</li>\n" +
    "      <li>지방: (여기에 값)g</li>\n" +
    "    </ul>\n" +
    '    <div class="ingredient-title">재료</div>\n' +
    '    <div class="main-ingredient-title">주재료</div>\n' +
    '    <ul class="ingredient-list">\n' +
    '      <li class="ingredient-item"><span class="ingredient-name">(여기에 값)</span></li>\n' +
    "      <!-- 여러 개 반복 -->\n" +
    "    </ul>\n" +
    '    <div class="sauce-title">소스</div>\n' +
    '    <ul class="ingredient-list">\n' +
    '      <li class="ingredient-item"><span class="ingredient-name">(여기에 값)</span></li>\n' +
    "      <!-- 여러 개 반복 -->\n" +
    "    </ul>\n" +
    '    <div class="etc-title">기타</div>\n' +
    '    <ul class="ingredient-list">\n' +
    '      <li class="ingredient-item"><span class="ingredient-name">(여기에 값)</span></li>\n' +
    "      <!-- 여러 개 반복 -->\n" +
    "    </ul>\n" +
    '    <div class="recipe-title">레시피</div>\n' +
    '    <ol class="recipe-list">\n' +
    "      <li>(여기에 값)</li>\n" +
    "      <!-- 여러 개 반복 -->\n" +
    "    </ol>\n" +
    '    <div class="tip-title">추가팁</div>\n' +
    '    <ul class="tip-content">\n' +
    "      <li>(여기에 값)</li>\n" +
    "      <!-- 여러 개 반복 -->\n" +
    "    </ul>\n" +
    '    <div class="reason-title">메뉴 추천 이유</div>\n' +
    '    <ul class="reason-content">\n' +
    "      <li>(여기에 값)</li>\n" +
    "      <!-- 여러 개 반복 -->\n" +
    "    </ul>\n" +
    "  </div>\n" +
    "  <!-- 메뉴가 2개 이상이면 menu-block을 여러 개 반복 -->\n" +
    "</div>\n"
  );
}

// 일주일용 식단 프롬프트 생성
function generateWeekMealPrompt() {
  return (
    "일주일 식단을 생성해주세요. 월요일부터 일요일까지 7개의 요일별 식단 카드를 각각 생성하세요.\n" +
    "각 요일별로 완전히 다른 메뉴를 구성하고, 일주일 전체의 영양 밸런스를 고려해주세요.\n" +
    "불필요한 스타일, id, 이모지, 마크다운, 표, 구분선, 주석 등은 절대 사용하지 마세요.\n" +
    "재료(주재료, 소스, 기타) 항목의 각 재료명 뒤에는 반드시 괄호로 수량, 무게, 단위를 표기하세요. 예: 닭가슴살(100g), 양파(1/2개)\n" +
    "\n" +
    "🎯 일주일 식단 생성 가이드라인:\n" +
    "- 각 요일별로 다양한 메뉴 구성으로 식단의 다양성 확보\n" +
    "- 일주일 전체의 영양소 균형 고려\n" +
    "- 계절 식재료와 조리 난이도의 적절한 분배\n" +
    "- 주말과 평일의 특성을 고려한 메뉴 배치\n" +
    "- 식재료의 효율적 활용과 보관 고려\n" +
    "\n" +
    "[일주일 식단용 HTML 양식]\n" +
    "\n" +
    "🚨 상태진단 HTML 양식 (첫 번째 블록에만 사용):\n" +
    '<div class="diagnosis">\n' +
    "  <div>상태진단</div>\n" +
    '  <div>기초대사량(BMR) <span class="desc">생명 유지에 필요한 최소한의 에너지 소비량</span></div>\n' +
    "  <div>(여기에 값)Kcal</div>\n" +
    '  <div>일일 에너지 요구량(TEE) <span class="desc">활동정도에 따른 하루 동안 소비하는 총 에너지양</span></div>\n' +
    "  <div>(여기에 값)Kcal</div>\n" +
    "  <div>칼로리 배분</div>\n" +
    "  <div>(여기에 값)</div>\n" +
    "  <div>질병에 따른 식단 주의 사항</div>\n" +
    "  <div>(여기에 값)</div>\n" +
    "  <div>종합 진단</div>\n" +
    "  <div>(여기에 값)</div>\n" +
    "</div>\n" +
    "\n" +
    "🚨 각 요일별 추천식단 HTML 양식 (2~8번째 블록에 사용):\n" +
    '<div class="week-day-label">(요일명)</div>\n' +
    '<div class="recommendation">\n' +
    '  <div class="menu-block">\n' +
    '    <div class="menu-section-title">메뉴</div>\n' +
    '    <div class="menu-name">(여기에 메뉴명)</div>\n' +
    '    <div class="nutrition-title">영양정보</div>\n' +
    '    <ul class="nutrition-list">\n' +
    "      <li>칼로리: (여기에 값)kcal</li>\n" +
    "      <li>탄수화물: (여기에 값)g</li>\n" +
    "      <li>단백질: (여기에 값)g</li>\n" +
    "      <li>지방: (여기에 값)g</li>\n" +
    "    </ul>\n" +
    '    <div class="ingredient-title">재료</div>\n' +
    '    <div class="main-ingredient-title">주재료</div>\n' +
    '    <ul class="ingredient-list">\n' +
    '      <li class="ingredient-item"><span class="ingredient-name">(여기에 값)</span></li>\n' +
    "      <!-- 여러 개 반복 -->\n" +
    "    </ul>\n" +
    '    <div class="sauce-title">소스</div>\n' +
    '    <ul class="ingredient-list">\n' +
    '      <li class="ingredient-item"><span class="ingredient-name">(여기에 값)</span></li>\n' +
    "      <!-- 여러 개 반복 -->\n" +
    "    </ul>\n" +
    '    <div class="etc-title">기타</div>\n' +
    '    <ul class="ingredient-list">\n' +
    '      <li class="ingredient-item"><span class="ingredient-name">(여기에 값)</span></li>\n' +
    "      <!-- 여러 개 반복 -->\n" +
    "    </ul>\n" +
    '    <div class="recipe-title">레시피</div>\n' +
    '    <ol class="recipe-list">\n' +
    "      <li>(여기에 값)</li>\n" +
    "      <!-- 여러 개 반복 -->\n" +
    "    </ol>\n" +
    '    <div class="tip-title">추가팁</div>\n' +
    '    <ul class="tip-content">\n' +
    "      <li>(여기에 값)</li>\n" +
    "      <!-- 여러 개 반복 -->\n" +
    "    </ul>\n" +
    '    <div class="reason-title">메뉴 추천 이유</div>\n' +
    '    <ul class="reason-content">\n' +
    "      <li>(여기에 값)</li>\n" +
    "      <!-- 여러 개 반복 -->\n" +
    "    </ul>\n" +
    "  </div>\n" +
    "  <!-- 메뉴가 2개 이상이면 menu-block을 여러 개 반복 -->\n" +
    "</div>\n" +
    "\n" +
    "🚨🚨🚨 절대 규칙 🚨🚨🚨\n" +
    "1. 상태진단은 맨 처음에 한 번만 생성 (각 요일별로 중복 생성 금지)\n" +
    "2. 일주일 식단 요청 시 반드시 월요일~일요일까지 7개의 요일별 추천식단 생성\n" +
    "3. 각 요일별로 완전히 다른 메뉴 생성\n" +
    "4. 요청된 메뉴 개수만큼 menu-block 개별 생성 (메뉴명을 한 블록에 몰아넣기 금지)\n" +
    "5. 메뉴 3개 요청 시 → 각 요일에 menu-block 3개 생성\n" +
    "6. 메뉴 2개 요청 시 → 각 요일에 menu-block 2개 생성\n" +
    "\n" +
    "🚨🚨🚨 필수: 반드시 8개 블록을 생성하세요 🚨🚨🚨\n" +
    "블록1: 위의 상태진단 HTML 양식 사용\n" +
    "---\n" +
    "블록2: 월요일 - 위의 요일별 추천식단 HTML 양식 사용\n" +
    "---\n" +
    "블록3: 화요일 - 위의 요일별 추천식단 HTML 양식 사용\n" +
    "---\n" +
    "블록4: 수요일 - 위의 요일별 추천식단 HTML 양식 사용\n" +
    "---\n" +
    "블록5: 목요일 - 위의 요일별 추천식단 HTML 양식 사용\n" +
    "---\n" +
    "블록6: 금요일 - 위의 요일별 추천식단 HTML 양식 사용\n" +
    "---\n" +
    "블록7: 토요일 - 위의 요일별 추천식단 HTML 양식 사용\n" +
    "---\n" +
    "블록8: 일요일 - 위의 요일별 추천식단 HTML 양식 사용\n" +
    "\n" +
    "🚨🚨🚨 절대 규칙 🚨🚨🚨\n" +
    "1. 정확히 8개의 블록 생성 (상태진단 1개 + 요일별 7개)\n" +
    "2. 각 블록 사이에 반드시 '---' 구분자 입력\n" +
    "3. 상태진단은 첫 번째 블록에만 생성 (중복 금지)\n" +
    "4. 각 요일별로 완전히 다른 메뉴 생성\n" +
    "5. 메뉴 개수만큼 menu-block 개별 생성 (절대 한 블록에 여러 메뉴명 넣지 말 것)\n" +
    "6. 모든 요일(월~일)에 완전한 메뉴 정보 포함\n" +
    "7. 위에 제시된 HTML 양식을 정확히 따라서 생성\n" +
    "\n" +
    "‼️ 중요: 월요일부터 일요일까지 7개 요일을 모두 빠뜨리지 말고 위 8개 블록을 정확히 생성하세요 ‼️\n"
  );
}

// 마크다운→HTML 변환 후 주요 항목에 CSS 클래스 자동 부여 함수
function styleMealPlanHtml(html) {
  // 1. DOM 파싱
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = html;

  // 2. 섹션별 스타일 클래스 부여
  // 추천식단 전체 블록
  const rec = tempDiv.querySelector(".recommendation");
  if (rec) {
    // 메뉴별 블록 반복 처리
    tempDiv.querySelectorAll(".menu-block").forEach((menuBlock) => {
      // 저장하기 버튼 추가
      const saveButton = document.createElement("button");
      saveButton.className = "save-meal-btn";
      saveButton.innerHTML = "💾 저장";

      menuBlock.appendChild(saveButton);

      // 메뉴명
      const menuDiv = Array.from(menuBlock.querySelectorAll("div")).find(
        (div) => div.textContent.trim() === "메뉴"
      );
      if (menuDiv && menuDiv.nextElementSibling) {
        menuDiv.classList.add("menu-section-title");
        menuDiv.nextElementSibling.classList.add("menu-name");
      }
      // 영양정보
      const nutritionDiv = Array.from(menuBlock.querySelectorAll("div")).find(
        (div) => div.textContent.trim() === "영양정보"
      );
      if (
        nutritionDiv &&
        nutritionDiv.nextElementSibling &&
        nutritionDiv.nextElementSibling.tagName === "UL"
      ) {
        nutritionDiv.classList.add("nutrition-title");
        nutritionDiv.nextElementSibling.classList.add("nutrition-list");
      }
      // 재료
      const ingredientDiv = Array.from(menuBlock.querySelectorAll("div")).find(
        (div) => div.textContent.trim() === "재료"
      );
      if (ingredientDiv) ingredientDiv.classList.add("ingredient-title");
      // 주재료/소스/기타 ul에 ingredient-list 클래스, li에 ingredient-item 및 구매하기 버튼
      ["주재료", "소스", "기타"].forEach((section) => {
        const sectionDiv = Array.from(menuBlock.querySelectorAll("div")).find(
          (div) => div.textContent.trim() === section
        );
        if (
          sectionDiv &&
          sectionDiv.nextElementSibling &&
          sectionDiv.nextElementSibling.tagName === "UL"
        ) {
          sectionDiv.classList.add(
            section === "주재료"
              ? "main-ingredient-title"
              : section === "소스"
              ? "sauce-title"
              : "etc-title"
          );
          const ul = sectionDiv.nextElementSibling;
          ul.classList.add("ingredient-list");
          ul.querySelectorAll("li").forEach((li) => {
            const name = li.textContent
              .replace(/^[-\s]*/, "")
              .replace(/\s*\(.*\)$/, "")
              .trim();
            li.classList.add("ingredient-item");
            if (!li.querySelector(".buy-btn") && name) {
              const link =
                "https://www.coupang.com/np/search?component=&q=" +
                encodeURIComponent(name);
              li.innerHTML = `<span class=\"ingredient-name\">${li.textContent}</span><a class=\"buy-btn\" href=\"${link}\" target=\"_blank\">구매하기</a>`;
            }
          });
        }
      });
      // 레시피
      const recipeDiv = Array.from(menuBlock.querySelectorAll("div")).find(
        (div) => div.textContent.trim() === "레시피"
      );
      if (
        recipeDiv &&
        recipeDiv.nextElementSibling &&
        recipeDiv.nextElementSibling.tagName === "OL"
      ) {
        recipeDiv.classList.add("recipe-title");
        recipeDiv.nextElementSibling.classList.add("recipe-list");
      }
      // 추가팁/식단 추천 이유 div에 각각 클래스
      const tipDiv = Array.from(menuBlock.querySelectorAll("div")).find(
        (div) => div.textContent.trim() === "추가팁"
      );
      if (tipDiv && tipDiv.nextElementSibling) {
        tipDiv.classList.add("tip-title");
        tipDiv.nextElementSibling.classList.add("tip-content");
      }
      const reasonDiv = Array.from(menuBlock.querySelectorAll("div")).find(
        (div) => div.textContent.trim() === "식단 추천 이유"
      );
      if (reasonDiv && reasonDiv.nextElementSibling) {
        reasonDiv.classList.add("reason-title");
        reasonDiv.nextElementSibling.classList.add("reason-content");
      }
    });
  }

  // 추천식단 제목 처리
  const mealSectionTitle = tempDiv.querySelector(".meal-section-title");
  if (mealSectionTitle && mealSectionTitle.textContent.trim() === "추천식단") {
    mealSectionTitle.classList.add("meal-section-title");
  } else {
    // 추천식단 제목이 없으면 자동으로 추가
    const recommendation = tempDiv.querySelector(".recommendation");
    if (recommendation && !tempDiv.querySelector(".meal-section-title")) {
      const titleDiv = document.createElement("div");
      titleDiv.className = "meal-section-title";
      titleDiv.textContent = "추천식단";
      recommendation.parentNode.insertBefore(titleDiv, recommendation);
    }
  }

  // 상태진단 전체 블록
  const diag = tempDiv.querySelector(".diagnosis");
  if (diag) {
    diag.classList.add("status-section");
    // 상태진단 제목
    const statusTitle = Array.from(diag.querySelectorAll("div")).find(
      (div) => div.textContent.trim() === "상태진단"
    );
    if (statusTitle) statusTitle.classList.add("status-section-title");
    // 각 항목별 클래스 부여
    const bmrDiv = Array.from(diag.querySelectorAll("div")).find((div) =>
      div.textContent.trim().startsWith("기초대사량")
    );
    if (bmrDiv) bmrDiv.classList.add("bmr-title", "status-item-title");
    const teeDiv = Array.from(diag.querySelectorAll("div")).find((div) =>
      div.textContent.trim().startsWith("일일 에너지 요구량")
    );
    if (teeDiv) teeDiv.classList.add("tee-title", "status-item-title");
    const calDiv = Array.from(diag.querySelectorAll("div")).find(
      (div) => div.textContent.trim() === "칼로리 배분"
    );
    if (calDiv) calDiv.classList.add("calorie-title", "status-item-title");
    const diseaseDiv = Array.from(diag.querySelectorAll("div")).find(
      (div) => div.textContent.trim() === "질병에 따른 식단 주의 사항"
    );
    if (diseaseDiv)
      diseaseDiv.classList.add("disease-title", "status-item-title");
    const summaryDiv = Array.from(diag.querySelectorAll("div")).find(
      (div) => div.textContent.trim() === "종합 진단"
    );
    if (summaryDiv)
      summaryDiv.classList.add("summary-title", "status-item-title");
  }
  return tempDiv.innerHTML;
}

// 식단 저장 함수
async function saveMealPlan(menuBlock) {
  console.log("saveMealPlan 함수 시작");
  try {
    // 로그인 상태 확인
    console.log("로그인 상태 확인 중...");
    const authResponse = await fetch("/api/auth/me", {
      credentials: "include",
    });
    const authData = await authResponse.json();
    console.log("로그인 상태:", authData);

    if (!authData.loggedIn) {
      console.log("로그인되지 않음, 로그인 페이지로 이동");
      alert("로그인이 필요합니다. 로그인 후 다시 시도해주세요.");
      window.location.href = "login.html";
      return;
    }

    // 메뉴 정보 추출
    console.log("메뉴 정보 추출 중...");
    const menuName =
      menuBlock.querySelector(".menu-name")?.textContent || "저장된 메뉴";
    console.log("메뉴명:", menuName);

    const nutritionList = menuBlock.querySelector(".nutrition-list");
    const nutrition = {};

    if (nutritionList) {
      nutritionList.querySelectorAll("li").forEach((li) => {
        const text = li.textContent;
        if (text.includes("칼로리:")) {
          nutrition.calories = text.replace("칼로리:", "").trim();
        } else if (text.includes("탄수화물:")) {
          nutrition.carbs = text.replace("탄수화물:", "").trim();
        } else if (text.includes("단백질:")) {
          nutrition.protein = text.replace("단백질:", "").trim();
        } else if (text.includes("지방:")) {
          nutrition.fat = text.replace("지방:", "").trim();
        }
      });
    }
    console.log("영양 정보:", nutrition);

    // 저장할 데이터 준비 전에 저장 버튼 제거
    const tempMenuBlock = menuBlock.cloneNode(true);
    const saveBtn = tempMenuBlock.querySelector(".save-meal-btn");
    if (saveBtn) saveBtn.remove();
    const saveData = {
      title: menuName,
      content: tempMenuBlock.outerHTML,
      mealType: mealAnswers.meal_times || "lunch",
      nutrition: nutrition,
    };

    // 서버에 저장
    console.log("서버에 저장 요청 중...");
    const response = await fetch("/api/saved-meals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(saveData),
    });
    console.log("서버 응답 상태:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("서버 오류 응답:", errorText);
      throw new Error("저장에 실패했습니다.");
    }

    console.log("저장 성공!");

    // 저장 성공 메시지
    const saveButton = menuBlock.querySelector(".save-meal-btn");
    if (saveButton) {
      const originalText = saveButton.innerHTML;
      saveButton.innerHTML = "✅ 저장됨";
      saveButton.style.background = "#28a745";
      saveButton.disabled = true;

      setTimeout(() => {
        saveButton.innerHTML = originalText;
        saveButton.style.background = "#4a69bd";
        saveButton.disabled = false;
      }, 2000);
    }

    // 토스트 메시지 표시
    showToast("식단이 저장되었습니다!");
  } catch (error) {
    console.error("식단 저장 오류:", error);
    showToast("저장에 실패했습니다: " + error.message, "error");
  }
}

// 토스트 메시지 표시 함수
function showToast(message, type = "success") {
  // 기존 토스트 제거
  const existingToast = document.querySelector(".toast-message");
  if (existingToast) {
    existingToast.remove();
  }

  // 새 토스트 생성
  const toast = document.createElement("div");
  toast.className = `toast-message toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === "error" ? "#dc3545" : "#28a745"};
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        font-size: 14px;
        font-weight: 500;
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s ease;
    `;

  document.body.appendChild(toast);

  // 애니메이션 표시
  setTimeout(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateX(0)";
  }, 100);

  // 3초 후 자동 제거
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 300);
  }, 3000);
}

// 메뉴 슬라이더 제어 함수들
window.menuSliderState = {};

function navigateMenu(direction, weekIdx) {
  let slides, dots, prevBtn, nextBtn;
  let currentMenuIndex, totalMenus;
  if (typeof weekIdx === "number") {
    // 일주일 식단(week) 모드: 해당 week-card 내에서만 찾기
    if (!window.menuSliderState[weekIdx]) window.menuSliderState[weekIdx] = 0;
    const card = document.querySelectorAll(".week-card")[weekIdx];
    if (!card) return;
    slides = card.querySelectorAll(".menu-slide");
    dots = card.querySelectorAll(".menu-dot");
    prevBtn = card.querySelector(".menu-nav-btn.prev-btn");
    nextBtn = card.querySelector(".menu-nav-btn.next-btn");
    currentMenuIndex = window.menuSliderState[weekIdx];
  } else {
    // 하루 식단(day) 모드: 전체에서 찾기
    if (!window.menuSliderState[0]) window.menuSliderState[0] = 0;
    slides = document.querySelectorAll(".menu-slide");
    dots = document.querySelectorAll(".menu-dot");
    prevBtn = document.querySelector(".menu-nav-btn.prev-btn");
    nextBtn = document.querySelector(".menu-nav-btn.next-btn");
    currentMenuIndex = window.menuSliderState[0];
  }
  if (!slides.length) return;
  totalMenus = slides.length;
  if (direction === "next" && currentMenuIndex < totalMenus - 1) {
    currentMenuIndex++;
  } else if (direction === "prev" && currentMenuIndex > 0) {
    currentMenuIndex--;
  }
  if (typeof weekIdx === "number") {
    window.menuSliderState[weekIdx] = currentMenuIndex;
  } else {
    window.menuSliderState[0] = currentMenuIndex;
  }
  slides.forEach((slide, index) => {
    slide.classList.toggle("active", index === currentMenuIndex);
  });
  dots.forEach((dot, index) => {
    dot.classList.toggle("active", index === currentMenuIndex);
  });
  if (prevBtn) {
    prevBtn.style.visibility = currentMenuIndex === 0 ? "hidden" : "visible";
    prevBtn.style.opacity = currentMenuIndex === 0 ? "0.2" : "1";
    prevBtn.style.display = "flex";
  }
  if (nextBtn) {
    nextBtn.style.visibility =
      currentMenuIndex === totalMenus - 1 ? "hidden" : "visible";
    nextBtn.style.opacity = currentMenuIndex === totalMenus - 1 ? "0.2" : "1";
    nextBtn.style.display = "flex";
  }
}

function goToMenu(index, weekIdx) {
  let slides, dots, prevBtn, nextBtn;
  if (typeof weekIdx === "number") {
    // 일주일 식단(week) 모드: 해당 week-card 내에서만 찾기
    if (!window.menuSliderState[weekIdx]) window.menuSliderState[weekIdx] = 0;
    const card = document.querySelectorAll(".week-card")[weekIdx];
    if (!card) return;
    slides = card.querySelectorAll(".menu-slide");
    dots = card.querySelectorAll(".menu-dot");
    prevBtn = card.querySelector(".menu-nav-btn.prev-btn");
    nextBtn = card.querySelector(".menu-nav-btn.next-btn");
  } else {
    // 하루 식단(day) 모드: 전체에서 찾기
    if (!window.menuSliderState[0]) window.menuSliderState[0] = 0;
    slides = document.querySelectorAll(".menu-slide");
    dots = document.querySelectorAll(".menu-dot");
    prevBtn = document.querySelector(".menu-nav-btn.prev-btn");
    nextBtn = document.querySelector(".menu-nav-btn.next-btn");
  }
  if (index < 0 || index >= slides.length) return;
  if (typeof weekIdx === "number") {
    window.menuSliderState[weekIdx] = index;
  } else {
    window.menuSliderState[0] = index;
  }
  slides.forEach((slide, i) => {
    slide.classList.toggle("active", i === index);
  });
  dots.forEach((dot, i) => {
    dot.classList.toggle("active", i === index);
  });
  if (prevBtn) {
    prevBtn.style.visibility = index === 0 ? "hidden" : "visible";
    prevBtn.style.opacity = index === 0 ? "0.2" : "1";
    prevBtn.style.display = "flex";
  }
  if (nextBtn) {
    nextBtn.style.visibility =
      index === slides.length - 1 ? "hidden" : "visible";
    nextBtn.style.opacity = index === slides.length - 1 ? "0.2" : "1";
    nextBtn.style.display = "flex";
  }
}

// 이벤트 위임 및 키보드 접근성 지원
document.addEventListener("DOMContentLoaded", () => {
  // 마우스 휠로 가로 스크롤
  const mealTypeContainer = document.querySelector(".meal-type-selection");
  if (mealTypeContainer) {
    mealTypeContainer.addEventListener("wheel", (event) => {
      if (event.deltaY !== 0) {
        event.preventDefault();
        mealTypeContainer.scrollLeft += event.deltaY;
      }
    });
  }

  // 모든 옵션 그룹에 대한 이벤트 리스너 설정
  document.querySelectorAll(".option-group").forEach((group) => {
    // 다중 선택 가능한 옵션 그룹들
    const isMultiSelect = [
      "allergies",
      "illnesses",
      "kitchen_appliances",
      "preferred_ingredients",
      "cooking_methods",
      "biomarkers",
      "supplements",
      "cuisine_style",
    ].includes(group.dataset.name);
    group.querySelectorAll(".option").forEach((option) => {
      option.addEventListener("click", () => {
        handleOptionClick(option, isMultiSelect, group);
      });
      option.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleOptionClick(option, isMultiSelect, group);
        }
      });
    });
  });
  // 아코디언 초기화
  document.querySelectorAll(".accordion-header").forEach((header) => {
    header.addEventListener("click", () => {
      const accordion = header.closest(".accordion");
      accordion.classList.toggle("open");
    });
  });

  // 건강정보 아코디언들을 기본적으로 열린 상태로 설정
  // profileSection2 (건강정보)만 기본적으로 열린 상태로 설정
  const profileSection2 = document.getElementById("profileSection2");
  
  if (profileSection2) {
    const healthAccordions = profileSection2.querySelectorAll(".accordion");
    healthAccordions.forEach((accordion) => {
      accordion.classList.add("open");
    });
  }

  // 페이지별 초기화 - 이미 활성화된 섹션이 없을 때만 초기화
  const isMainPage = document.getElementById("home") !== null;
  const hasProfileSections =
    document.getElementById("profileSection1") !== null;
  const currentActiveSection = document.querySelector(".section.active");
  const currentActiveProfileSection = document.querySelector(
    ".profile-section.active"
  );

  // 활성화된 섹션이 없을 때만 기본 섹션으로 이동
  if (isMainPage && !currentActiveSection) {
    showSection("home");
  }

  if (hasProfileSections && !currentActiveProfileSection) {
    showSection(1, true); // 초기 프로필 섹션 1 표시
  }

  // 실시간 입력 유효성 검사
  ["age", "height", "weight"].forEach((id) => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener("input", () => {
        const errorSpan = document.getElementById(`${id}-error`);
        if (input.checkValidity()) {
          if (errorSpan) {
            errorSpan.textContent = "";
            errorSpan.classList.remove("active");
          }
          input.classList.remove("invalid");
        }
      });
    }
  });
});

function handleOptionClick(option, isMultiSelect, group) {
  const dataValue = option.dataset.value;
  const isToggleButton = dataValue.includes("_toggle");

  // '없음' 버튼 로직 (allergies, illnesses, biomarkers, supplements 그룹에 적용)
  if (
    group.dataset.name === "allergies" ||
    group.dataset.name === "illnesses" ||
    group.dataset.name === "biomarkers" ||
    group.dataset.name === "supplements"
  ) {
    if (dataValue === "none") {
      // '없음'을 선택하면 나머지 해제
      group.querySelectorAll(".option").forEach((o) => {
        if (o !== option) {
          o.classList.remove("selected");
          // 값 입력 필드가 있는 경우 비활성화
          const valueInput = o.querySelector(".value-input");
          if (valueInput) {
            valueInput.classList.remove("active");
            valueInput.value = "";
          }
        }
      });
      option.classList.toggle("selected");
      return;
    } else {
      // 다른 옵션을 선택하면 '없음' 해제
      const noneOption = group.querySelector('.option[data-value="none"]');
      if (noneOption) {
        noneOption.classList.remove("selected");
      }
    }
  }

  if (isMultiSelect) {
    option.classList.toggle("selected");
  } else {
    const isCurrentlySelected = option.classList.contains("selected");
    group
      .querySelectorAll(".option")
      .forEach((o) => o.classList.remove("selected"));
    if (!isCurrentlySelected) {
      option.classList.add("selected");
    }
  }

  // '기타' 입력 필드 토글 로직
  if (isToggleButton) {
    let inputContainerId;
    if (dataValue === "other_allergy_toggle")
      inputContainerId = "otherAllergyInput";
    else if (dataValue === "other_illness_toggle")
      inputContainerId = "otherIllnessInput";
    else if (dataValue === "other_biomarker_toggle")
      inputContainerId = "otherBiomarkerInput";
    else if (dataValue === "other_supplement_toggle")
      inputContainerId = "otherSupplementInput";
    else if (dataValue === "other_ingredients_toggle")
      inputContainerId = "otherIngredientsInput";

    if (inputContainerId) {
      const container = document.getElementById(inputContainerId);
      if (container)
        container.classList.toggle(
          "active",
          option.classList.contains("selected")
        );
    }
  }
  // 바이오마커, 건강기능식품 값 입력 필드 토글
  if (
    group.dataset.name === "biomarkers" ||
    group.dataset.name === "supplements"
  ) {
    const valueInput = option.querySelector(".value-input");
    if (valueInput) {
      valueInput.classList.toggle(
        "active",
        option.classList.contains("selected")
      );
      if (option.classList.contains("selected")) {
        valueInput.focus();
      } else {
        valueInput.value = "";
      }
    }
  }
}

function extractWeekDay(text) {
  // '월요일', '월요일 점심', '월요일(점심)' 등에서 '월요일'만 추출
  const match = text.match(/^(월|화|수|목|금|토|일)요일/);
  return match ? match[0] : text;
}

// week 슬라이드 네비게이션 함수(goToWeek) 추가
window.goToWeek = function (idx) {
  window.currentWeekIndex = idx;
  const cards = document.querySelectorAll(".week-card");
  const btns = document.querySelectorAll(".week-day-btn");

  // 요일 카드 표시/숨김 및 버튼 활성화
  cards.forEach(
    (card, i) => (card.style.display = i === idx ? "flex" : "none")
  );
  btns.forEach((btn, i) => btn.classList.toggle("active", i === idx));

  // 선택된 요일의 메뉴 슬라이더를 첫 번째 메뉴로 리셋
  const selectedCard = cards[idx];
  if (selectedCard) {
    // 모든 메뉴 슬라이드에서 active 클래스 제거
    const menuSlides = selectedCard.querySelectorAll(".menu-slide");
    menuSlides.forEach((slide) => slide.classList.remove("active"));

    // 첫 번째 메뉴 슬라이드에 active 클래스 추가
    if (menuSlides[0]) {
      menuSlides[0].classList.add("active");
    }

    // 모든 메뉴 도트에서 active 클래스 제거
    const menuDots = selectedCard.querySelectorAll(".menu-dot");
    menuDots.forEach((dot) => dot.classList.remove("active"));

    // 첫 번째 메뉴 도트에 active 클래스 추가
    if (menuDots[0]) {
      menuDots[0].classList.add("active");
    }

    // 네비게이션 버튼 상태 업데이트
    const prevBtn = selectedCard.querySelector(".menu-nav-btn.prev-btn");
    const nextBtn = selectedCard.querySelector(".menu-nav-btn.next-btn");

    if (prevBtn) {
      prevBtn.style.visibility = "hidden";
      prevBtn.style.opacity = "0.2";
    }

    if (nextBtn) {
      const totalSlides = menuSlides.length;
      if (totalSlides > 1) {
        nextBtn.style.visibility = "visible";
        nextBtn.style.opacity = "1";
      } else {
        nextBtn.style.visibility = "hidden";
        nextBtn.style.opacity = "0.2";
      }
    }

    // 메뉴 슬라이더 상태 업데이트 (전역 상태)
    if (window.menuSliderState) {
      window.menuSliderState[idx] = 0;
    }
  }
};

// 로그인 상태에 따라 마이페이지/로그아웃 버튼 표시
function updateAuthLinks() {
  fetch("/api/auth/me", { credentials: "include" })
    .then((res) => res.json())
    .then((data) => {
      const authLinks = document.querySelector(".auth-links");
      if (!authLinks) return;
      authLinks.innerHTML = "";
      if (data.loggedIn) {
        // 마이페이지 버튼
        const myPageBtn = document.createElement("a");
        myPageBtn.href = "mypage.html";
        myPageBtn.textContent = "마이페이지";
        myPageBtn.className = "nav-btn";
        myPageBtn.style.marginRight = "10px";
        authLinks.appendChild(myPageBtn);
        // 로그아웃 버튼
        const logoutBtn = document.createElement("a");
        logoutBtn.href = "#";
        logoutBtn.textContent = "로그아웃";
        logoutBtn.className = "nav-btn";
        logoutBtn.onclick = function (e) {
          e.preventDefault();
          fetch("/api/auth/logout", {
            method: "POST",
            credentials: "include",
          }).then(() => window.location.reload());
        };
        authLinks.appendChild(logoutBtn);
        // 관리자 페이지 버튼(관리자만)
        if (
          data.user &&
          (data.user.username === "admin" ||
            data.user.email === "admin@example.com")
        ) {
          const adminBtn = document.createElement("a");
          adminBtn.href = "admin.html";
          adminBtn.textContent = "관리자 페이지";
          adminBtn.style.marginLeft = "12px";
          adminBtn.style.color = "#d32f2f";
          adminBtn.style.fontWeight = "bold";
          authLinks.appendChild(adminBtn);
        }
      } else {
        // 비로그인 상태
        const loginBtn = document.createElement("a");
        loginBtn.href = "login.html";
        loginBtn.textContent = "로그인";
        loginBtn.className = "nav-btn";
        loginBtn.style.marginRight = "12px";
        
        const signupBtn = document.createElement("a");
        signupBtn.href = "signup.html";
        signupBtn.textContent = "회원가입";
        signupBtn.className = "nav-btn primary";
        // 강제로 인라인 스타일 적용
        signupBtn.style.background = "#667eea";
        signupBtn.style.color = "white";
        signupBtn.style.borderColor = "#667eea";
        signupBtn.style.boxShadow = "0 2px 4px rgba(102, 126, 234, 0.3)";
        
        // hover 효과를 위한 이벤트 리스너
        signupBtn.addEventListener('mouseenter', function() {
          this.style.background = "#764ba2";
          this.style.borderColor = "#764ba2";
          this.style.boxShadow = "0 4px 8px rgba(118, 75, 162, 0.4)";
        });
        
        signupBtn.addEventListener('mouseleave', function() {
          this.style.background = "#667eea";
          this.style.borderColor = "#667eea";
          this.style.boxShadow = "0 2px 4px rgba(102, 126, 234, 0.3)";
        });
        
        authLinks.appendChild(loginBtn);
        authLinks.appendChild(signupBtn);
      }
    });
}

document.addEventListener("DOMContentLoaded", updateAuthLinks);

// 프로필 자동 채우기 함수
async function autofillProfileForm() {
  try {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    const data = await res.json();
    if (!data.loggedIn) return;
    const profileRes = await fetch("/api/profile", { credentials: "include" });
    const profile = await profileRes.json();
    if (!profile) return;
    // 기본 정보
    Object.entries(profile).forEach(([key, value]) => {
      const input = document.querySelector(`#profileForm [name="${key}"]`);
      if (input) {
        if (input.type === "select-multiple") {
          Array.from(input.options).forEach((opt) => {
            opt.selected = (value || []).includes(opt.value);
          });
        } else {
          input.value = value;
        }
      }
    });
    // option-group (버튼식)
    document.querySelectorAll("#profileForm .option-group").forEach((group) => {
      const groupName = group.dataset.name;
      if (profile[groupName]) {
        const values = Array.isArray(profile[groupName])
          ? profile[groupName]
          : [profile[groupName]];
        group.querySelectorAll(".option").forEach((option) => {
          if (values.includes(option.dataset.value)) {
            option.classList.add("selected");
          } else {
            option.classList.remove("selected");
          }
        });
      } else {
        group
          .querySelectorAll(".option")
          .forEach((option) => option.classList.remove("selected"));
      }
    });
    // 기타 입력 필드 활성화
    if (profile.other_allergies_text) {
      const otherAllergyToggle = document.querySelector(
        '.option[data-value="other_allergy_toggle"]'
      );
      const otherAllergyInput = document.getElementById("otherAllergyInput");
      if (otherAllergyToggle && otherAllergyInput) {
        otherAllergyToggle.classList.add("selected");
        otherAllergyInput.classList.add("active");
      }
    }
    if (profile.other_illnesses_text) {
      const otherIllnessToggle = document.querySelector(
        '.option[data-value="other_illness_toggle"]'
      );
      const otherIllnessInput = document.getElementById("otherIllnessInput");
      if (otherIllnessToggle && otherIllnessInput) {
        otherIllnessToggle.classList.add("selected");
        otherIllnessInput.classList.add("active");
      }
    }
    if (profile.other_biomarkers_text) {
      const otherBiomarkerToggle = document.querySelector(
        '.option[data-value="other_biomarker_toggle"]'
      );
      const otherBiomarkerInput = document.getElementById(
        "otherBiomarkerInput"
      );
      if (otherBiomarkerToggle && otherBiomarkerInput) {
        otherBiomarkerToggle.classList.add("selected");
        otherBiomarkerInput.classList.add("active");
      }
    }
    if (profile.other_supplements_text) {
      const otherSupplementToggle = document.querySelector(
        '.option[data-value="other_supplement_toggle"]'
      );
      const otherSupplementInput = document.getElementById(
        "otherSupplementInput"
      );
      if (otherSupplementToggle && otherSupplementInput) {
        otherSupplementToggle.classList.add("selected");
        otherSupplementInput.classList.add("active");
      }
    }
    // 바이오마커/건강기능식품 값 입력 필드
    if (profile.specific_biomarkers) {
      Object.keys(profile.specific_biomarkers).forEach((key) => {
        const option = document.querySelector(
          '.option[data-value="' + key + '"]'
        );
        if (option) {
          option.classList.add("selected");
          const valueInput = option.querySelector(".value-input");
          if (valueInput) {
            valueInput.classList.add("active");
            valueInput.value = profile.specific_biomarkers[key];
          }
        }
      });
    }
    if (profile.specific_supplements) {
      Object.keys(profile.specific_supplements).forEach((key) => {
        const option = document.querySelector(
          '.option[data-value="' + key + '"]'
        );
        if (option) {
          option.classList.add("selected");
          const valueInput = option.querySelector(".value-input");
          if (valueInput) {
            valueInput.classList.add("active");
            valueInput.value = profile.specific_supplements[key];
          }
        }
      });
    }
    setTimeout(() => {
      if (typeof updateProfileProgress === "function") updateProfileProgress();
    }, 100);
  } catch (e) {
    console.error("프로필 자동 채우기 오류:", e);
  }
}

// DOMContentLoaded에서 버튼에 이벤트 바인딩
window.addEventListener("DOMContentLoaded", () => {
  const startProfileBtn = document.getElementById("startProfileBtn");
  if (startProfileBtn) {
    startProfileBtn.addEventListener("click", async () => {
      await autofillProfileForm();
    });
  }
});

document.addEventListener("DOMContentLoaded", function () {
  // ... existing code ...
  var profileCard = document.getElementById("mypageProfileCard");
  if (profileCard) {
    profileCard.addEventListener("click", function () {
      window.location.href = "profile.html";
    });
    profileCard.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        window.location.href = "profile.html";
      }
    });
  }
  // ... existing code ...
  var mypageBtn = document.getElementById("mypageBtn");
  if (mypageBtn) {
    // 로그인 상태 확인
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.loggedIn) {
          mypageBtn.style.display = "inline-block";
        }
      });
    mypageBtn.addEventListener("click", function () {
      window.location.href = "mypage.html";
    });
  }
  // ... existing code ...
});

// ... existing code ...

// ... existing code ...

// 마크다운 볼드(**텍스트**)를 <strong>텍스트</strong>로 변환하는 함수
function convertMarkdownBoldToHtml(text) {
  return text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
}

// 기능별 페이지 이동 함수
async function navigateToFeature(feature) {
  console.log("navigateToFeature 호출됨:", feature);
  
  // 인증이 필요한 기능들
  const authRequiredFeatures = ['profile', 'mini-games', 'shop'];
  
  if (authRequiredFeatures.includes(feature)) {
    try {
      const response = await fetch("/api/auth/me", { credentials: "include" });
      const data = await response.json();
      
      if (!data.loggedIn) {
        // 비로그인 상태일 때 로그인 페이지로 리다이렉트
        alert("로그인이 필요한 기능입니다. 로그인 페이지로 이동합니다.");
        window.location.href = "login.html";
        return;
      }
    } catch (error) {
      console.error("인증 확인 중 오류 발생:", error);
      alert("로그인이 필요한 기능입니다. 로그인 페이지로 이동합니다.");
      window.location.href = "login.html";
      return;
    }
  }
  
  switch (feature) {
    case "meal-plan":
      window.location.href = "meal-plan.html";
      break;
    case "supplements":
      window.location.href = "supplements.html";
      break;
    case "restaurant-recommendation":
      window.location.href = "restaurant-recommendation.html";
      break;
    case "ingredient-analyzer":
      window.location.href = "ingredient-analyzer.html";
      break;
    case "restaurants":
      // 맛집 정보 기능은 아직 구현되지 않음
      alert("맛집 정보 기능은 준비 중입니다.");
      break;
    case "profile":
      window.location.href = "profile.html";
      break;
    case "mini-games":
      alert("미니게임 기능은 준비 중입니다.");
      break;
    case "shop":
      alert("상점 기능은 준비 중입니다.");
      break;
    case "nutrition-info":
      // 영양 정보 섹션으로 스크롤
      const nutritionSection = document.getElementById("nutrition-info");
      if (nutritionSection) {
        nutritionSection.scrollIntoView({ behavior: "smooth" });
      }
      break;
    default:
      console.log("알 수 없는 기능:", feature);
  }
}

// 전역 함수로 등록 (모든 페이지에서 사용 가능하도록)
window.navigateToFeature = navigateToFeature;

// 식단 목적 카테고리 전환 함수
function switchPurposeCategory(category) {
  // 모든 탭에서 active 클래스 제거
  document.querySelectorAll(".category-tab").forEach((tab) => {
    tab.classList.remove("active");
  });

  // 클릭된 탭에 active 클래스 추가
  document
    .querySelector(`[data-category="${category}"]`)
    .classList.add("active");

  // 모든 목적 그룹 숨기기
  document.querySelectorAll(".purpose-group").forEach((group) => {
    group.classList.remove("active");
  });

  // 선택된 카테고리 그룹 보이기
  document
    .querySelector(`.purpose-group[data-category="${category}"]`)
    .classList.add("active");
}

// 모바일 하단 네비게이션 AI 기능 모달 제어 (토글, 닫기 버튼 없이)
(function () {
  var aiBtn = document.getElementById("footerNavAI");
  var aiModal = document.getElementById("aiFeatureModal");
  if (aiBtn && aiModal) {
    aiBtn.addEventListener("click", function (e) {
      e.preventDefault();
      if (aiModal.classList.contains("active")) {
        aiModal.classList.remove("active");
      } else {
        aiModal.classList.add("active");
      }
    });
    aiModal.addEventListener("click", function (e) {
      if (e.target === aiModal) {
        aiModal.classList.remove("active");
      }
    });
  }
})();

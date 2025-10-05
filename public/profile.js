document.addEventListener("DOMContentLoaded", () => {
  // 프로필 불러오기
  fetch("/api/profile")
    .then((res) => res.json())
    .then((profile) => {
      for (const key in profile) {
        const input = document.querySelector(`[name="${key}"]`);
        if (!input) continue;
        if (input.type === "select-multiple") {
          // 멀티셀렉트(배열) 처리
          Array.from(input.options).forEach((opt) => {
            opt.selected = (profile[key] || []).includes(opt.value);
          });
        } else {
          input.value = profile[key];
        }
      }

      // option-group 옵션들의 selected 클래스 설정
      document.querySelectorAll(".option-group").forEach((group) => {
        const groupName = group.dataset.name;
        if (profile[groupName]) {
          const values = Array.isArray(profile[groupName])
            ? profile[groupName]
            : [profile[groupName]];
          group.querySelectorAll(".option").forEach((option) => {
            if (values.includes(option.dataset.value)) {
              option.classList.add("selected");
            }
          });
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

      // 바이오마커 기타 입력 필드 활성화
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

      // 건강기능식품 기타 입력 필드 활성화
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

      // 바이오마커와 건강기능식품 값 입력 필드 활성화
      if (profile.specific_biomarkers) {
        Object.keys(profile.specific_biomarkers).forEach((key) => {
          const option = document.querySelector(`.option[data-value="${key}"]`);
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
          const option = document.querySelector(`.option[data-value="${key}"]`);
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

      // 프로그레스바 업데이트
      setTimeout(updateProfileProgress, 100);
      // 프로필 완성도 상태 로드
      loadProfileCompletionStatus();
    });

  // 저장
  const profileForm = document.getElementById("profileForm");
  profileForm.onsubmit = async function (e) {
    e.preventDefault();
    const profileData = collectProfileData();
    
    // 디버깅: 수집된 프로필 데이터 확인
    console.log("수집된 프로필 데이터:", profileData);
    
    // 로그인 상태 확인
    const res = await fetch("/api/auth/me", { credentials: "include" });
    const data = await res.json();
    if (data.loggedIn) {
      try {
        // 프로필 저장
        const saveRes = await fetch("/api/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(profileData),
        });

        const saveResult = await saveRes.json();
        
        // 디버깅: 서버 응답 확인
        console.log("서버 응답:", saveResult);

        if (saveResult.success) {
          // 완성도 체크 및 보상 처리
          if (saveResult.completion) {
            console.log("완성도 정보:", saveResult.completion);
            if (saveResult.completion.rewardGiven) {
              // 보상 지급 알림 표시
              showRewardNotification(saveResult.completion);
            } else {
              // 일반 저장 완료 메시지
              alert(`프로필이 저장되었습니다. (완성도: ${saveResult.completion.completionInfo?.percentage || 0}%)`);
              // 완성도 상태 업데이트
              updateCompletionDisplay(saveResult.completion.completionInfo);
            }
          } else {
            alert("프로필이 저장되었습니다.");
          }
        } else {
          alert("프로필 저장에 실패했습니다.");
        }
      } catch (error) {
        console.error("프로필 저장 오류:", error);
        alert("프로필 저장 중 오류가 발생했습니다.");
      }
    } else {
      // 비로그인: 모달 표시
      showProfileSaveModal(profileData);
    }
  };

  // 프로필 초기화 버튼 이벤트
  const resetBtn = document.getElementById("resetProfileBtn");
  if (resetBtn) {
    resetBtn.onclick = async function () {
      if (!confirm("정말로 프로필을 초기화하시겠습니까?")) return;
      const res = await fetch("/api/profile", {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        alert("프로필이 초기화되었습니다.");
        window.location.reload();
      } else {
        alert("프로필 초기화에 실패했습니다.");
      }
    };
  }

  // 탭 전환 함수
  function switchToTab(tabName) {
    // 모든 탭/섹션 비활성화
    document
      .querySelectorAll(".profile-tab")
      .forEach((t) => t.classList.remove("active"));
    document
      .querySelectorAll(".tab-section")
      .forEach((s) => s.classList.remove("active"));
    // 선택 탭/섹션 활성화
    document.querySelector(`[data-tab="${tabName}"]`).classList.add("active");
    document.getElementById("tab-" + tabName).classList.add("active");
    updateProfileProgress();
  }

  // 탭 클릭 이벤트
  document.querySelectorAll(".profile-tab").forEach((tab) => {
    tab.addEventListener("click", function () {
      switchToTab(this.dataset.tab);
    });
  });

  // 다음 버튼 클릭 이벤트
  document.querySelectorAll(".next-tab-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      const nextTab = this.dataset.nextTab;
      if (nextTab) {
        switchToTab(nextTab);
      }
    });
  });

  // 입력값 변경 시 프로그레스 바 갱신
  document
    .getElementById("profileForm")
    .addEventListener("input", updateProfileProgress);
  // 최초 로드 시 프로그레스 바 갱신
  updateProfileProgress();

  // 아코디언 열고 닫기
  document.querySelectorAll(".accordion-header").forEach((header) => {
    header.addEventListener("click", function () {
      const accordion = this.closest(".accordion");
      accordion.classList.toggle("open");
    });
  });

  // 건강정보 탭의 아코디언들을 기본적으로 열린 상태로 설정
  // 추가정보 탭은 선택사항이므로 닫힌 상태 유지
  const healthTab = document.getElementById("tab-health");
  if (healthTab) {
    const healthAccordions = healthTab.querySelectorAll(".accordion");
    healthAccordions.forEach((accordion) => {
      accordion.classList.add("open");
    });
  }

  // 단일 선택 그룹 정의
  const singleSelectGroups = [
    "gender",
    "activity_level",
    "eating_patterns",
    "sleep_patterns",
    "meals_per_day",
    "alcohol_consumption",
    "smoking_status",
  ];

  // 버튼식 옵션 선택 처리 (단일/다중 선택 분기)
  document.querySelectorAll(".option-group .option").forEach((option) => {
    option.addEventListener("click", function (e) {
      e.stopPropagation();
      const group = this.closest(".option-group");
      const groupName = group.dataset.name;
      const isSingleSelect = singleSelectGroups.includes(groupName);

      console.log(`옵션 클릭: ${groupName} - ${this.dataset.value}, 단일선택: ${isSingleSelect}`);

      // '없음' 버튼 처리
      if (this.dataset.value === "none") {
        // '없음' 선택 시 다른 옵션 해제, 본인만 선택
        group
          .querySelectorAll(".option")
          .forEach((opt) => opt.classList.remove("selected"));
        this.classList.add("selected");
        // 바이오마커/건강기능식품 그룹이면 모든 입력칸 비활성화 및 값 초기화
        if (
          group.dataset.name === "biomarkers" ||
          group.dataset.name === "supplements"
        ) {
          group.querySelectorAll(".value-input").forEach((input) => {
            input.classList.remove("active");
            input.value = "";
          });
        }
        console.log(`'없음' 선택됨: ${groupName}`);
        setTimeout(updateProfileProgress, 0);
        return;
      } else {
        // 다른 옵션 클릭 시 '없음' 해제
        const noneBtn = group.querySelector('.option[data-value="none"]');
        if (noneBtn && noneBtn.classList.contains("selected")) {
          noneBtn.classList.remove("selected");
          console.log(`'없음' 해제됨: ${groupName}`);
        }
      }

      // 기타 입력 토글
      if (this.dataset.value && this.dataset.value.endsWith("_toggle")) {
        const inputId =
          this.dataset.value === "other_allergy_toggle"
            ? "otherAllergyInput"
            : this.dataset.value === "other_illness_toggle"
            ? "otherIllnessInput"
            : this.dataset.value === "other_biomarker_toggle"
            ? "otherBiomarkerInput"
            : this.dataset.value === "other_supplement_toggle"
            ? "otherSupplementInput"
            : null;
        if (inputId) {
          const inputBox = document.getElementById(inputId);
          inputBox.classList.toggle("active");
          this.classList.toggle("selected");
          setTimeout(updateProfileProgress, 0);
        }
        return;
      }

      // 바이오마커, 건강기능식품 값 입력 필드 토글
      if (
        group.dataset.name === "biomarkers" ||
        group.dataset.name === "supplements"
      ) {
        const valueInput = this.querySelector(".value-input");
        if (valueInput) {
          // 토글될 selected 상태를 미리 계산
          const willBeSelected = !this.classList.contains("selected");
          valueInput.classList.toggle("active", willBeSelected);
          if (willBeSelected) {
            valueInput.focus();
          } else {
            valueInput.value = "";
          }
        }
      }

      // 단일 선택 그룹 처리
      if (isSingleSelect) {
        // 단일 선택: 다른 옵션 해제 후 현재 옵션 선택
        group
          .querySelectorAll(".option")
          .forEach((opt) => opt.classList.remove("selected"));
        this.classList.add("selected");
      } else {
        // 다중 선택: 토글 방식
        this.classList.toggle("selected");
      }

      setTimeout(updateProfileProgress, 0);
    });
  });

  // 완성 가이드 버튼 이벤트
  const showGuideBtn = document.getElementById("showCompletionGuide");
  const guideModal = document.getElementById("completionGuideModal");
  const closeBtn = guideModal?.querySelector(".modal-close");

  if (showGuideBtn && guideModal) {
    showGuideBtn.addEventListener("click", async () => {
      try {
        const res = await fetch("/api/profile/completion-guide", {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            populateGuideModal(data.guide);
            guideModal.style.display = "flex";
          }
        } else {
          console.error("가이드 로드 실패:", res.status, res.statusText);
          alert("완성 가이드를 불러오는데 실패했습니다.");
        }
      } catch (error) {
        console.error("가이드 로드 오류:", error);
        alert("완성 가이드를 불러오는 중 오류가 발생했습니다.");
      }
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      guideModal.style.display = "none";
    });
  }

  // 모달 배경 클릭 시 닫기
  if (guideModal) {
    guideModal.addEventListener("click", (e) => {
      if (e.target === guideModal) {
        guideModal.style.display = "none";
      }
    });
  }
});

function collectProfileData() {
  const form = document.getElementById("profileForm");
  const obj = {};

  // 폼의 모든 input, select, textarea 요소만 수집
  const formElements = form.querySelectorAll("input, select, textarea");

  formElements.forEach((element) => {
    const name = element.name;
    if (!name) return; // name이 없는 요소는 건너뛰기

    if (element.type === "select-multiple") {
      // 멀티셀렉트 처리
      const selectedValues = Array.from(element.selectedOptions).map(
        (option) => option.value
      );
      obj[name] = selectedValues;
    } else if (element.type === "checkbox") {
      // 체크박스 처리
      obj[name] = element.checked;
    } else {
      // 일반 input, select, textarea 처리
      obj[name] = element.value;
    }
  });

  // 바이오마커와 건강기능식품의 개별 값들 수집
  const specificBiomarkers = {};
  const specificSupplements = {};

  // 바이오마커 값 수집
  document
    .querySelectorAll('.option-group[data-name="biomarkers"] .option.selected')
    .forEach((option) => {
      const dataValue = option.dataset.value;
      if (dataValue !== "other_biomarker_toggle" && dataValue !== "none") {
        const inputElement = option.querySelector(".value-input");
        if (inputElement && inputElement.value.trim()) {
          specificBiomarkers[dataValue] = inputElement.value.trim();
        }
      }
    });

  // 건강기능식품 값 수집
  document
    .querySelectorAll('.option-group[data-name="supplements"] .option.selected')
    .forEach((option) => {
      const dataValue = option.dataset.value;
      if (dataValue !== "other_supplement_toggle" && dataValue !== "none") {
        const inputElement = option.querySelector(".value-input");
        if (inputElement && inputElement.value.trim()) {
          specificSupplements[dataValue] = inputElement.value.trim();
        }
      }
    });

  // 단일 선택 그룹 정의 (수집 시에도 동일한 배열 사용)
  const singleSelectGroups = [
    "gender",
    "activity_level",
    "eating_patterns",
    "sleep_patterns",
    "meals_per_day",
    "alcohol_consumption",
    "smoking_status",
  ];

  // option-group 데이터 수집
  document.querySelectorAll(".option-group").forEach((group) => {
    const dataName = group.dataset.name;
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
          ].includes(value)
      );

    if (singleSelectGroups.includes(dataName)) {
      // 단일 선택 그룹: 첫 번째 선택된 값만 저장
      obj[dataName] = selectedOptions.length > 0 ? selectedOptions[0] : null;
    } else {
      // 다중 선택 그룹: 배열로 저장
      // "없음" 버튼이 선택된 경우 ["none"]으로 저장하여 완성된 것으로 인식
      if (selectedOptions.length > 0) {
        obj[dataName] = selectedOptions;
      } else {
        // 아무것도 선택되지 않은 경우 빈 배열로 저장
        obj[dataName] = [];
      }
    }
  });

  // 개별 값들 추가
  if (Object.keys(specificBiomarkers).length > 0) {
    obj.specific_biomarkers = specificBiomarkers;
  }
  if (Object.keys(specificSupplements).length > 0) {
    obj.specific_supplements = specificSupplements;
  }

  return obj;
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
    // localStorage에 임시 저장 후 로그인 페이지로 이동
    localStorage.setItem("pendingProfile", JSON.stringify(profileData));
    window.location.href = "login.html?afterProfileSave=1";
  };
  document.getElementById("tempSaveBtn").onclick = function () {
    // localStorage에 임시 저장 후 식단 구성으로 이동
    localStorage.setItem("pendingProfile", JSON.stringify(profileData));
    modal.style.display = "none";
    window.location.href = "index.html#meal_form";
  };
}

function closeProfileSaveModal() {
  const modal = document.getElementById("profileSaveModal");
  modal.style.display = "none";
}

// 프로필 입력 프로그레스 바 계산 함수
function updateProfileProgress() {
  const form = document.getElementById("profileForm");
  let total = 0;
  let filled = 0;

  // 기본 정보 탭의 input/select 필드들
  const basicFields = form.querySelectorAll(
    "#tab-basic input, #tab-basic select"
  );
  basicFields.forEach((field) => {
    if (
      !field.name ||
      field.type === "button" ||
      field.type === "submit" ||
      field.disabled
    )
      return;
    total++;
    if (field.type === "select-multiple") {
      if (Array.from(field.selectedOptions).length > 0) filled++;
    } else if (field.type === "checkbox") {
      if (field.checked) filled++;
    } else {
      if (field.value && field.value.trim() !== "") filled++;
    }
  });

  // 음식 제한 탭의 option-group (알레르기)
  const allergyGroup = document.querySelector(
    '.option-group[data-name="allergies"]'
  );
  if (allergyGroup) {
    total++;
    const otherSelected = allergyGroup.querySelector(
      '.option.selected[data-value$="_toggle"]'
    );
    const normalSelected = allergyGroup.querySelector(
      '.option.selected:not([data-value$="_toggle"])'
    );
    if (otherSelected) {
      filled++;
    } else if (normalSelected) {
      filled++;
    }
  }

  // 건강 정보 탭의 option-group (질병)
  const illnessGroup = document.querySelector(
    '.option-group[data-name="illnesses"]'
  );
  if (illnessGroup) {
    total++;
    const otherSelected = illnessGroup.querySelector(
      '.option.selected[data-value$="_toggle"]'
    );
    const normalSelected = illnessGroup.querySelector(
      '.option.selected:not([data-value$="_toggle"])'
    );
    if (otherSelected) {
      filled++;
    } else if (normalSelected) {
      filled++;
    }
  }

  // 바이오마커 그룹 (아코디언 안에 있지만 항상 카운트)
  const biomarkerGroup = document.querySelector(
    '.option-group[data-name="biomarkers"]'
  );
  if (biomarkerGroup) {
    total++;
    const otherSelected = biomarkerGroup.querySelector(
      '.option.selected[data-value$="_toggle"]'
    );
    const normalSelected = biomarkerGroup.querySelector(
      '.option.selected:not([data-value$="_toggle"])'
    );
    if (otherSelected) {
      filled++;
    } else if (normalSelected) {
      filled++;
    }
  }

  // 건강기능식품 그룹 (아코디언 안에 있지만 항상 카운트)
  const supplementGroup = document.querySelector(
    '.option-group[data-name="supplements"]'
  );
  if (supplementGroup) {
    total++;
    const otherSelected = supplementGroup.querySelector(
      '.option.selected[data-value$="_toggle"]'
    );
    const normalSelected = supplementGroup.querySelector(
      '.option.selected:not([data-value$="_toggle"])'
    );
    if (otherSelected) {
      filled++;
    } else if (normalSelected) {
      filled++;
    }
  }

  // 기타 입력 필드들 (활성화된 경우만 카운트)
  const otherInputs = form.querySelectorAll(
    ".hidden-input-container.active input"
  );
  otherInputs.forEach((input) => {
    if (input.name && input.value && input.value.trim() !== "") {
      filled++;
    }
  });

  const percent = total === 0 ? 0 : Math.round((filled / total) * 100);
  const bar = document.querySelector(".mypage-progress-bar");
  const label = document.querySelector(".mypage-progress-bar-label");
  bar.style.width = percent + "%";
  label.textContent = percent + "%";
}

// 프로필 완성도 상태 로드
async function loadProfileCompletionStatus() {
  try {
    const res = await fetch("/api/profile/completion-status", {
      credentials: "include",
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        updateCompletionDisplay(data.completionInfo);
      }
    }
  } catch (error) {
    console.error("완성도 상태 로드 오류:", error);
  }
}

// 완성도 표시 업데이트
function updateCompletionDisplay(completionInfo) {
  if (!completionInfo) return;

  // 프로그레스 바 업데이트
  const progressBar = document.querySelector(".mypage-progress-bar");
  const progressLabel = document.querySelector(".mypage-progress-bar-label");

  if (progressBar && progressLabel) {
    progressBar.style.width = completionInfo.percentage + "%";
    progressLabel.textContent = completionInfo.percentage + "%";
  }

  // 완성도 통계 업데이트
  const completedCount = document.querySelector(".completed-count");
  const totalCount = document.querySelector(".total-count");

  if (completedCount && totalCount) {
    completedCount.textContent = completionInfo.completedFields.length;
    totalCount.textContent =
      completionInfo.completedFields.length +
      completionInfo.missingFields.length;
  }
}

// 보상 알림 표시
function showRewardNotification(completionResult) {
  const modal = document.getElementById("rewardNotificationModal");
  const pointsDisplay = document.getElementById("currentPointsDisplay");

  if (modal) {
    // 현재 포인트 표시 업데이트
    if (pointsDisplay && completionResult.pointsResult) {
      pointsDisplay.textContent = completionResult.pointsResult.totalPoints;
    }

    modal.style.display = "flex";

    // 확인 버튼 이벤트
    const confirmBtn = modal.querySelector(".reward-confirm-btn");
    if (confirmBtn) {
      confirmBtn.onclick = function () {
        modal.style.display = "none";
        // 완성도 표시 업데이트
        if (completionResult.completionInfo) {
          updateCompletionDisplay(completionResult.completionInfo);
        }
      };
    }
  }
}

// 완성 가이드 모달 관련 이벤트는 메인 DOMContentLoaded에서 처리됨

// 가이드 모달 내용 채우기
function populateGuideModal(guide) {
  const requiredList = document.getElementById("requiredFieldsList");
  const recommendedList = document.getElementById("recommendedFieldsList");

  if (requiredList) {
    requiredList.innerHTML = "";
    guide.requiredMissing.forEach((field) => {
      const li = document.createElement("li");
      li.innerHTML = `<strong>${field.label}</strong> (${field.weight}점)`;
      requiredList.appendChild(li);
    });

    if (guide.requiredMissing.length === 0) {
      const li = document.createElement("li");
      li.textContent = "모든 필수 항목이 완성되었습니다! 🎉";
      li.style.color = "#4CAF50";
      requiredList.appendChild(li);
    }
  }

  if (recommendedList) {
    recommendedList.innerHTML = "";
    guide.recommendedNext.forEach((field) => {
      const li = document.createElement("li");
      li.innerHTML = `<strong>${field.label}</strong> (${field.weight}점)`;
      recommendedList.appendChild(li);
    });

    if (guide.recommendedNext.length === 0) {
      const li = document.createElement("li");
      li.textContent = "모든 고점수 항목이 완성되었습니다!";
      li.style.color = "#4CAF50";
      recommendedList.appendChild(li);
    }
  }
}

// footer-nav-mobile AI 기능 모달 제어
document.addEventListener("DOMContentLoaded", function() {
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

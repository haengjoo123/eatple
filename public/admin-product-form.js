// 관리자 제품 등록/수정 페이지 JavaScript
class AdminProductForm {
  constructor() {
    this.products = [];
    this.currentEditingProduct = null;
    this.isEditMode = false;
    // 에디터 selection 저장용 범위
    this.savedEditorRange = null;
    // 업로드된 이미지 URL 저장
    this.uploadedImageUrls = [];

    this.init();
  }

  async init() {
    this.products = await this.loadProducts();
    this.checkEditMode();
    this.bindEvents();
    this.setupEditor();
  }

  checkEditMode() {
    // URL 파라미터에서 제품 ID 확인
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get("id");

    if (productId) {
      this.isEditMode = true;
      this.currentEditingProduct = this.products.find((p) => p.id == productId);

      if (this.currentEditingProduct) {
        this.populateForm(this.currentEditingProduct);
        document.getElementById("pageTitle").textContent = "제품 수정";
      } else {
        this.showNotification("제품을 찾을 수 없습니다.", "error");
        setTimeout(() => {
          window.location.href = "admin-product-management.html";
        }, 2000);
      }
    } else {
      document.getElementById("pageTitle").textContent = "제품 추가";
    }
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

    // 저장 버튼들
    document.getElementById("saveBtn").addEventListener("click", () => {
      this.saveProduct();
    });

    document.getElementById("saveBtnFooter").addEventListener("click", () => {
      this.saveProduct();
    });

    // 취소 버튼들
    document.getElementById("cancelBtn").addEventListener("click", () => {
      this.cancelEdit();
    });

    document.getElementById("cancelBtnFooter").addEventListener("click", () => {
      this.cancelEdit();
    });

    // 이미지 업로드
    document.getElementById("imageUploadArea").addEventListener("click", () => {
      document.getElementById("imageInput").click();
    });

    document.getElementById("imageInput").addEventListener("change", (e) => {
      this.handleImageUpload(e.target.files);
    });

    // 드래그 앤 드롭
    const uploadArea = document.getElementById("imageUploadArea");
    uploadArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      uploadArea.classList.add("dragover");
    });

    uploadArea.addEventListener("dragleave", () => {
      uploadArea.classList.remove("dragover");
    });

    uploadArea.addEventListener("drop", (e) => {
      e.preventDefault();
      uploadArea.classList.remove("dragover");
      this.handleImageUpload(e.dataTransfer.files);
    });

    // 에디터 도구 모음 - 기본 서식 명령은 selection 복원 후 실행 (허용 목록만)
    document.querySelectorAll(".editor-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const command = btn.dataset.command;
        const allowed = [
          "bold",
          "italic",
          "underline",
          "strikeThrough",
          "insertUnorderedList",
          "insertOrderedList",
          "insertHorizontalRule",
          "removeFormat",
          "undo",
          "redo",
        ];
        if (command && allowed.includes(command)) {
          this.restoreEditorSelection();
          try { document.execCommand(command, false, null); } catch (_) {}
        }
      });
    });

    // 이미지 삽입
    document.getElementById("insertImageBtn").addEventListener("click", () => {
      // 에디터에서 버튼으로 포커스가 이동되기 전에 selection 저장
      this.saveEditorSelection();
      this.openImageInsertModal();
    });

    // 표 삽입
    document.getElementById("insertTableBtn").addEventListener("click", () => {
      this.saveEditorSelection();
      this.openTableInsertModal();
    });

    // 링크 생성/제거
    const createLinkBtn = document.getElementById("createLinkBtn");
    const removeLinkBtn = document.getElementById("removeLinkBtn");
    if (createLinkBtn) {
      createLinkBtn.addEventListener("click", () => {
        this.saveEditorSelection();
        const url = prompt("링크 URL을 입력하세요", "https://");
        if (!url) return;
        this.restoreEditorSelection();
        try {
          document.execCommand("createLink", false, url);
        } catch (_) {}
      });
    }
    if (removeLinkBtn) {
      removeLinkBtn.addEventListener("click", () => {
        this.restoreEditorSelection();
        try { document.execCommand("unlink", false, null); } catch (_) {}
      });
    }

    // 이미지 정렬 버튼들
    const imgAlignHandlers = [
      ["imgAlignLeftBtn", "left"],
      ["imgAlignCenterBtn", "center"],
      ["imgAlignRightBtn", "right"],
      ["imgAlignNoneBtn", "none"],
    ];
    imgAlignHandlers.forEach(([id, align]) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener("click", () => {
        this.applyImageAlignment(align);
      });
    });

    // 텍스트 정렬 버튼은 이미지가 선택된 경우 IMG에 커스텀 정렬 적용, 아니면 기본 정렬 실행
    const textAlignConfigs = [
      ["textAlignLeftBtn", "justifyLeft", "left"],
      ["textAlignCenterBtn", "justifyCenter", "center"],
      ["textAlignRightBtn", "justifyRight", "right"],
    ];
    textAlignConfigs.forEach(([id, cmd, imgAlign]) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const editor = this.editor || document.getElementById("productDescription");
        // 먼저 selection 복원 (툴바 클릭으로 포커스 이탈 보정)
        this.restoreEditorSelection();
        const selection = window.getSelection();
        let targetImg = null;
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const node = range.startContainer.nodeType === 3 ? range.startContainer.parentElement : range.startContainer;
          if (node && node.tagName === "IMG") targetImg = node;
          else if (node) targetImg = node.closest("img");
        }
        // selection에서 IMG를 못 찾으면 마지막 클릭 이미지로 보정
        if ((!targetImg || !editor.contains(targetImg)) && this.lastClickedImage && editor.contains(this.lastClickedImage)) {
          targetImg = this.lastClickedImage;
        }

        if (targetImg && editor && editor.contains(targetImg)) {
          this.applyImageAlignment(imgAlign);
        } else {
          try { document.execCommand(cmd, false, null); } catch (_) {}
        }
      });
    });

    // 이미지 삽입 모달 이벤트
    document
      .getElementById("imageInsertClose")
      .addEventListener("click", () => {
        this.closeImageInsertModal();
      });

    document
      .getElementById("imageInsertCancel")
      .addEventListener("click", () => {
        this.closeImageInsertModal();
      });

    document
      .getElementById("imageInsertConfirm")
      .addEventListener("click", () => {
        this.insertImage();
      });

    // 표 삽입 모달 이벤트
    document
      .getElementById("tableInsertClose")
      .addEventListener("click", () => {
        this.closeTableInsertModal();
      });

    document
      .getElementById("tableInsertCancel")
      .addEventListener("click", () => {
        this.closeTableInsertModal();
      });

    document
      .getElementById("tableInsertConfirm")
      .addEventListener("click", () => {
        this.insertTable();
      });

    // 모달 외부 클릭으로 닫기
    document
      .getElementById("imageInsertModal")
      .addEventListener("click", (e) => {
        if (e.target.id === "imageInsertModal") {
          this.closeImageInsertModal();
        }
      });

    document
      .getElementById("tableInsertModal")
      .addEventListener("click", (e) => {
        if (e.target.id === "tableInsertModal") {
          this.closeTableInsertModal();
        }
      });

    // 설명 이미지 업로드
    document
      .getElementById("descriptionImageInput")
      .addEventListener("change", (e) => {
        this.handleDescriptionImageUpload(e.target.files[0]);
      });
  }

  setupEditor() {
    const editor = document.getElementById("productDescription");
    this.editor = editor;
    this.lastClickedImage = null;

    // 에디터 포커스 시 플레이스홀더 숨기기
    editor.addEventListener("focus", () => {
      // 플레이스홀더 처리는 CSS로 대체 (textContent 조작 제거)
    });

    // 에디터 블러 시 플레이스홀더 표시
    editor.addEventListener("blur", () => {
      // 플레이스홀더 처리는 CSS로 대체 (textContent 조작 제거)
      // 이미지나 다른 HTML 요소가 있을 수 있으므로 innerHTML을 건드리지 않음
    });

    // selection 저장: 키입력/마우스업/포커스 시점에 최신 selection을 저장
    const save = () => this.saveEditorSelection();
    editor.addEventListener("keyup", save);
    editor.addEventListener("mouseup", save);
    editor.addEventListener("input", save);
    editor.addEventListener("focus", save);

    // 이미지 클릭 시 명시적으로 대상 이미지 기억 + selection 저장
    editor.addEventListener("click", (e) => {
      const img = e.target && (e.target.tagName === "IMG" ? e.target : e.target.closest && e.target.closest("img"));
      if (img) {
        this.lastClickedImage = img;
        this.saveEditorSelection();
      }
    });
  }

  // 에디터 selection 저장
  saveEditorSelection() {
    try {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      if (this.editor && this.editor.contains(range.startContainer) && this.editor.contains(range.endContainer)) {
        this.savedEditorRange = range.cloneRange();
      }
    } catch (_) {}
  }

  // 에디터 selection 복원 (없거나 잘못된 경우 커서를 끝으로 이동)
  restoreEditorSelection() {
    const editor = this.editor || document.getElementById("productDescription");
    if (!editor) return;
    editor.focus();
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    const range = this.savedEditorRange;
    if (range && editor.contains(range.startContainer) && editor.contains(range.endContainer)) {
      selection.addRange(range);
    } else {
      const caret = document.createRange();
      caret.selectNodeContents(editor);
      caret.collapse(false);
      selection.addRange(caret);
    }
  }

  // execCommand 실패 대비용 수동 삽입 보조 함수
  insertHtmlIntoEditorSafely(html) {
    const editor = this.editor || document.getElementById("productDescription");
    if (!editor) return;
    
    console.log('🔍 [DEBUG] HTML 삽입 시도:', html);
    console.log('🔍 [DEBUG] 삽입 전 에디터 내용:', editor.innerHTML);
    
    // selection 복원 시도 후 execCommand 실행
    this.restoreEditorSelection();
    const before = editor.innerHTML;
    let succeeded = false;
    try {
      succeeded = document.execCommand("insertHTML", false, html);
    } catch (_) {
      succeeded = false;
    }
    
    // execCommand가 실패했거나 내용 변화가 없다면 수동 삽입
    if (!succeeded || editor.innerHTML === before) {
      console.log('🔍 [DEBUG] execCommand 실패, 수동 삽입 시도');
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const fragmentContainer = document.createElement("div");
        fragmentContainer.innerHTML = html;
        const node = fragmentContainer.firstChild;
        if (node) {
          range.insertNode(node);
          // 커서를 삽입한 노드 뒤로 이동
          range.setStartAfter(node);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
        } else {
          editor.insertAdjacentHTML("beforeend", html);
        }
      } else {
        console.log('🔍 [DEBUG] selection 없음, beforeend로 삽입');
        editor.insertAdjacentHTML("beforeend", html);
      }
    }
    
    console.log('🔍 [DEBUG] 삽입 후 에디터 내용:', editor.innerHTML);
    console.log('🔍 [DEBUG] 에디터 textContent:', editor.textContent);
    
    // 삽입 후 에디터에 포커스를 다시 주어 blur 이벤트 방지
    setTimeout(() => {
      editor.focus();
      this.saveEditorSelection();
    }, 10);
  }

  // 이미지 정렬 적용
  applyImageAlignment(align) {
    const editor = this.editor || document.getElementById("productDescription");
    if (!editor) return;

    // selection 복원 후 현재 selection 기준으로 이미지 타겟 찾기
    this.restoreEditorSelection();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      // selection이 없으면 마지막 클릭 이미지로 시도
      if (this.lastClickedImage && editor.contains(this.lastClickedImage)) {
        this.alignImageNode(this.lastClickedImage, align);
        return;
      }
      this.showNotification("이미지를 선택한 후 정렬을 적용하세요.", "warning");
      return;
    }

    let targetImg = null;
    const range = selection.getRangeAt(0);
    const node = range.startContainer.nodeType === 3 ? range.startContainer.parentElement : range.startContainer;

    // 현재 노드 또는 상위 노드에서 IMG 탐색
    if (node && node.tagName === "IMG") {
      targetImg = node;
    } else {
      targetImg = node ? node.closest("img") : null;
    }

    if (!targetImg || !editor.contains(targetImg)) {
      // 마지막 클릭 이미지로 보정
      if (this.lastClickedImage && editor.contains(this.lastClickedImage)) {
        this.alignImageNode(this.lastClickedImage, align);
        return;
      }
      this.showNotification("정렬할 이미지를 선택하거나 커서를 이미지에 두세요.", "warning");
      return;
    }

    this.alignImageNode(targetImg, align);
  }

  // 단일 IMG 노드에 정렬 클래스 적용
  alignImageNode(targetImg, align) {
    // 기존 정렬 클래스 제거
    targetImg.classList.remove("apf-img-left", "apf-img-center", "apf-img-right", "apf-img-none");

    // 인라인 스타일 간섭 최소화를 위해 정렬 관련 속성 초기화 (크기 유지)
    targetImg.style.removeProperty("float");
    targetImg.style.removeProperty("margin");
    targetImg.style.removeProperty("display");

    switch (align) {
      case "left":
        targetImg.classList.add("apf-img-left");
        break;
      case "center":
        targetImg.classList.add("apf-img-center");
        break;
      case "right":
        targetImg.classList.add("apf-img-right");
        break;
      case "none":
      default:
        targetImg.classList.add("apf-img-none");
        break;
    }
  }

  // Supabase에서 제품 데이터 로드
  async loadProducts() {
    try {
      const response = await fetch("/api/products");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.products || [];
    } catch (error) {
      console.error("제품 데이터 로드 실패:", error);
      return [];
    }
  }

  // Supabase에 제품 저장
  async saveProductToSupabase(productData) {
    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(productData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error("제품 저장 실패:", error);
      throw error;
    }
  }

  // Supabase에서 제품 업데이트
  async updateProductInSupabase(productId, productData) {
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(productData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error("제품 업데이트 실패:", error);
      throw error;
    }
  }

  populateForm(product) {
    console.log('🔍 [DEBUG] populateForm 호출됨, product:', product);
    console.log('🔍 [DEBUG] product.summary:', product.summary);
    console.log('🔍 [DEBUG] product.summary 타입:', typeof product.summary);
    
    document.getElementById("productName").value = product.name;
    document.getElementById("productCategory").value = product.category;
    document.getElementById("productPrice").value = product.price;
    document.getElementById("productOriginalPrice").value =
      product.originalPrice || "";
    
    // 브랜드명 설정
    document.getElementById("productBrand").value = product.brand || "";
    
    // 배송비 설정 (기본값 3000원)
    document.getElementById("productShippingFee").value = product.shippingFee || 3000;
    
    // 최대 판매 개수 설정
    document.getElementById("productMaxSalesQuantity").value = product.max_sales_quantity || "";
    
    const summaryElement = document.getElementById("productSummary");
    const summaryValue = product.summary || "";
    summaryElement.value = summaryValue;
    
    console.log('🔍 [DEBUG] summary 요소에 설정된 값:', summaryElement.value);
    
    document.getElementById("productDescription").innerHTML =
      product.description || "";

    // 이미지 미리보기 - image_url을 배열로 변환
    let images = [];
    if (product.image_url) {
      try {
        // JSON 배열로 저장된 경우 파싱
        const parsed = JSON.parse(product.image_url);
        if (Array.isArray(parsed)) {
          images = parsed.filter(url => url && url.trim());
        } else if (parsed && typeof parsed === 'string') {
          images = [parsed];
        }
      } catch (e) {
        // JSON 파싱 실패 시 단일 URL로 처리
        if (typeof product.image_url === 'string' && product.image_url.trim()) {
          images = [product.image_url];
        }
      }
    }
    
    console.log('🔍 [DEBUG] 로드된 이미지들:', images);
    this.displayImagePreviews(images);
  }

  clearForm() {
    document.getElementById("productForm").reset();
    document.getElementById("productDescription").innerHTML = "";
    document.getElementById("imagePreviewList").innerHTML = "";
  }

  async saveProduct() {
    const formData = this.getFormData();
    
    // 디버깅: 폼 데이터 확인
    console.log('🔍 [DEBUG] 폼 데이터:', formData);
    console.log('🔍 [DEBUG] summary 값:', formData.summary);
    console.log('🔍 [DEBUG] summary 타입:', typeof formData.summary);

    if (!this.validateForm(formData)) {
      return;
    }

    try {
      // 저장 버튼 비활성화
      const saveButtons = document.querySelectorAll("#saveBtn, #saveBtnFooter");
      saveButtons.forEach((btn) => {
        btn.disabled = true;
        btn.textContent = "저장 중...";
      });

      if (this.isEditMode && this.currentEditingProduct) {
        // 제품 수정
        const productData = {
          name: formData.name,
          summary: formData.summary,
          description: formData.description,
          price: parseInt(formData.price),
          originalPrice: formData.originalPrice ? parseInt(formData.originalPrice) : null,
          brand: formData.brand,
          shippingFee: parseInt(formData.shippingFee),
          maxSalesQuantity: formData.maxSalesQuantity,
          category: formData.category,
          status: "active",
          image_url:
            formData.images && formData.images.length > 0
              ? JSON.stringify(formData.images)
              : null,
        };

        // 디버깅: 서버로 보낼 데이터 확인
        console.log('🔍 [DEBUG] 수정 모드 - 서버로 보낼 productData:', productData);
        console.log('🔍 [DEBUG] formData.images:', formData.images);
        console.log('🔍 [DEBUG] productData.image_url:', productData.image_url);

        const result = await this.updateProductInSupabase(
          this.currentEditingProduct.id,
          productData
        );
        console.log("제품 수정 성공:", result);

        this.showNotification("제품이 성공적으로 수정되었습니다.", "success");

        // 제품 관리 페이지로 이동
        setTimeout(() => {
          window.location.href = "admin-product-management.html";
        }, 1500);
      } else {
        // 새 제품 추가
        const productData = {
          name: formData.name,
          summary: formData.summary,
          description: formData.description,
          price: parseInt(formData.price),
          originalPrice: formData.originalPrice ? parseInt(formData.originalPrice) : null,
          brand: formData.brand,
          shippingFee: parseInt(formData.shippingFee),
          maxSalesQuantity: formData.maxSalesQuantity,
          category: formData.category,
          status: "active",
          image_url:
            formData.images && formData.images.length > 0
              ? JSON.stringify(formData.images)
              : null,
        };

        // 디버깅: 서버로 보낼 데이터 확인
        console.log('🔍 [DEBUG] 추가 모드 - 서버로 보낼 productData:', productData);
        console.log('🔍 [DEBUG] formData.images:', formData.images);
        console.log('🔍 [DEBUG] productData.image_url:', productData.image_url);

        const result = await this.saveProductToSupabase(productData);
        console.log("제품 저장 성공:", result);

        this.showNotification("제품이 성공적으로 저장되었습니다.", "success");

        // 제품 관리 페이지로 이동
        setTimeout(() => {
          window.location.href = "admin-product-management.html";
        }, 1500);
      }
    } catch (error) {
      console.error("제품 저장 실패:", error);
      this.showNotification("제품 저장에 실패했습니다.", "error");
    } finally {
      // 저장 버튼 복원
      const saveButtons = document.querySelectorAll("#saveBtn, #saveBtnFooter");
      saveButtons.forEach((btn) => {
        btn.disabled = false;
        btn.textContent = "저장";
      });
    }
  }

  cancelEdit() {
    if (this.hasUnsavedChanges()) {
      if (
        confirm("저장하지 않은 변경사항이 있습니다. 정말로 나가시겠습니까?")
      ) {
        window.location.href = "admin-product-management.html";
      }
    } else {
      window.location.href = "admin-product-management.html";
    }
  }

  hasUnsavedChanges() {
    const formData = this.getFormData();

    if (this.isEditMode && this.currentEditingProduct) {
      const originalImages = this.getProductImages(this.currentEditingProduct);
      const currentImages = formData.images || [];
      
      console.log('🔍 [DEBUG] 변경사항 확인 - 원본 이미지:', originalImages);
      console.log('🔍 [DEBUG] 변경사항 확인 - 현재 이미지:', currentImages);
      
      return (
        formData.name !== this.currentEditingProduct.name ||
        formData.category !== this.currentEditingProduct.category ||
        formData.price !== this.currentEditingProduct.price ||
        formData.originalPrice !==
          (this.currentEditingProduct.originalPrice || null) ||
        formData.brand !== (this.currentEditingProduct.brand || "") ||
        formData.shippingFee !== (this.currentEditingProduct.shippingFee || 3000) ||
        formData.summary !== (this.currentEditingProduct.summary || "") ||
        formData.description !==
          (this.currentEditingProduct.description || "") ||
        JSON.stringify(currentImages.sort()) !==
          JSON.stringify(originalImages.sort())
      );
    } else {
      return (
        formData.name !== "" ||
        formData.category !== "" ||
        formData.price !== "" ||
        formData.originalPrice !== null ||
        formData.summary !== "" ||
        formData.description !== "" ||
        (formData.images && formData.images.length > 0)
      );
    }
  }

  getFormData() {
    const summaryElement = document.getElementById("productSummary");
    const summaryValue = summaryElement ? summaryElement.value.trim() : "";
    
    // 정가 입력값 처리
    const originalPriceElement = document.getElementById("productOriginalPrice");
    const originalPriceValue = originalPriceElement ? originalPriceElement.value.trim() : "";
    const originalPriceParsed = originalPriceValue && originalPriceValue !== "" ? parseInt(originalPriceValue) : null;
    
    // 브랜드명 처리
    const brandElement = document.getElementById("productBrand");
    const brandValue = brandElement ? brandElement.value.trim() : "";
    
    // 배송비 처리
    const shippingFeeElement = document.getElementById("productShippingFee");
    const shippingFeeValue = shippingFeeElement ? shippingFeeElement.value.trim() : "";
    const shippingFeeParsed = shippingFeeValue && shippingFeeValue !== "" ? parseInt(shippingFeeValue) : 3000;
    
    // 최대 판매 개수 처리
    const maxSalesQuantityElement = document.getElementById("productMaxSalesQuantity");
    const maxSalesQuantityValue = maxSalesQuantityElement ? maxSalesQuantityElement.value.trim() : "";
    const maxSalesQuantityParsed = maxSalesQuantityValue && maxSalesQuantityValue !== "" ? parseInt(maxSalesQuantityValue) : null;
    
    const currentImages = this.getCurrentImages();
    
    console.log('🔍 [DEBUG] getFormData 호출됨');
    console.log('🔍 [DEBUG] 정가 입력값:', originalPriceValue);
    console.log('🔍 [DEBUG] 정가 파싱값:', originalPriceParsed);
    console.log('🔍 [DEBUG] 브랜드명:', brandValue);
    console.log('🔍 [DEBUG] 배송비:', shippingFeeParsed);
    console.log('🔍 [DEBUG] 최대 판매 개수:', maxSalesQuantityParsed);
    console.log('🔍 [DEBUG] 현재 이미지들:', currentImages);
    
    return {
      name: document.getElementById("productName").value.trim(),
      category: document.getElementById("productCategory").value,
      price: parseInt(document.getElementById("productPrice").value) || 0,
      originalPrice: originalPriceParsed,
      brand: brandValue,
      shippingFee: shippingFeeParsed,
      maxSalesQuantity: maxSalesQuantityParsed,
      summary: summaryValue,
      description: document.getElementById("productDescription").innerHTML,
      images: currentImages,
    };
  }

  validateForm(data) {
    if (!data.name) {
      this.showNotification("제품명을 입력해주세요.", "error");
      document.getElementById("productName").focus();
      return false;
    }

    if (!data.category) {
      this.showNotification("카테고리를 선택해주세요.", "error");
      document.getElementById("productCategory").focus();
      return false;
    }

    if (!data.price || data.price <= 0) {
      this.showNotification("올바른 판매가격을 입력해주세요.", "error");
      document.getElementById("productPrice").focus();
      return false;
    }

    if (data.originalPrice && data.originalPrice <= 0) {
      this.showNotification("올바른 정가를 입력해주세요.", "error");
      document.getElementById("productOriginalPrice").focus();
      return false;
    }

    if (!data.brand) {
      this.showNotification("브랜드명을 입력해주세요.", "error");
      document.getElementById("productBrand").focus();
      return false;
    }

    if (data.shippingFee < 0) {
      this.showNotification("올바른 배송비를 입력해주세요.", "error");
      document.getElementById("productShippingFee").focus();
      return false;
    }

    return true;
  }

  getCurrentImages() {
    // 저장된 URL 배열을 반환 (base64 변환 방지)
    console.log('🔍 [DEBUG] getCurrentImages 호출됨, 현재 이미지들:', this.uploadedImageUrls);
    return this.uploadedImageUrls || [];
  }

  async handleImageUpload(files) {
    const validFiles = Array.from(files).filter(file => {
      if (!file.type.startsWith("image/")) {
        this.showNotification(`이미지 파일만 업로드 가능합니다: ${file.name}`, "error");
        return false;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        this.showNotification(`이미지 파일이 너무 큽니다. (최대 5MB): ${file.name}`, "error");
        return false;
      }
      
      return true;
    });

    if (validFiles.length === 0) return;

    // FormData로 이미지 업로드 (base64 대신 파일 직접 업로드)
    const formData = new FormData();
    validFiles.forEach(file => {
      formData.append('images', file);
    });

    try {
      this.showNotification('이미지를 업로드하는 중...', 'info');
      
      const response = await fetch('/api/upload-images', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('이미지 업로드 실패');
      }

      const result = await response.json();
      
      // 업로드된 이미지들을 미리보기에 추가
      result.imageUrls.forEach(imageUrl => {
        this.addImagePreview(imageUrl);
      });

      this.showNotification(`${validFiles.length}개 이미지가 업로드되었습니다.`, 'success');
    } catch (error) {
      console.error('이미지 업로드 오류:', error);
      this.showNotification('이미지 업로드에 실패했습니다.', 'error');
    }
  }

  // 이미지 미리보기 추가 (압축 제거됨)
  addImagePreview(imageUrl) {
    if (!imageUrl || !imageUrl.trim()) {
      console.warn('빈 이미지 URL이 전달됨:', imageUrl);
      return;
    }
    
    const previewList = document.getElementById("imagePreviewList");
    const previewItem = document.createElement("div");
    previewItem.className = "image-preview-item";
    
    // 이미지 URL을 배열에 저장
    this.uploadedImageUrls.push(imageUrl);
    console.log('🔍 [DEBUG] 이미지 URL 추가됨:', imageUrl);
    console.log('🔍 [DEBUG] 현재 uploadedImageUrls:', this.uploadedImageUrls);

    const img = document.createElement("img");
    // 절대 URL로 변환 (상대 경로인 경우)
    const absoluteUrl = imageUrl.startsWith('http') ? imageUrl : `${window.location.origin}${imageUrl}`;
    img.src = absoluteUrl;
    img.alt = "제품 이미지";
    
    // 이미지 로드 실패 시 placeholder 표시
    img.onerror = () => {
      console.warn("이미지 로드 실패:", absoluteUrl);
      img.src = this.createPlaceholderImage(150, 150, "이미지 로드 실패");
    };
    
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "image-preview-remove";
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", () => {
      this.removeImagePreview(previewItem, imageUrl);
    });

    previewItem.appendChild(img);
    previewItem.appendChild(removeBtn);
    previewList.appendChild(previewItem);
  }

  // Placeholder 이미지 생성 헬퍼 메서드
  createPlaceholderImage(width, height, text) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = width;
    canvas.height = height;

    // 배경색 설정
    ctx.fillStyle = "#f8f9fa";
    ctx.fillRect(0, 0, width, height);

    // 테두리 설정
    ctx.strokeStyle = "#e0e0e0";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, width, height);

    // 텍스트 설정
    ctx.fillStyle = "#666";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "12px Arial";
    ctx.fillText(text, width / 2, height / 2);

    return canvas.toDataURL();
  }
  
  // 이미지 미리보기 제거
  removeImagePreview(element, imageUrl) {
    // 배열에서 URL 제거
    const index = this.uploadedImageUrls.indexOf(imageUrl);
    if (index > -1) {
      this.uploadedImageUrls.splice(index, 1);
    }
    // DOM에서 제거
    element.remove();
  }





  getProductImages(product) {
    if (!product.image_url) return [];

    try {
      // JSON 배열로 저장된 경우 파싱
      const images = JSON.parse(product.image_url);
      return Array.isArray(images) ? images : [product.image_url];
    } catch (e) {
      // JSON 파싱 실패 시 단일 URL로 처리
      return [product.image_url];
    }
  }

  displayImagePreviews(images) {
    const previewList = document.getElementById("imagePreviewList");
    previewList.innerHTML = "";
    
    // 기존 URL 배열 초기화
    this.uploadedImageUrls = [];

    images.forEach((src) => {
      if (src && src.trim()) {
        this.addImagePreview(src);
      }
    });
  }

  openImageInsertModal() {
    document.getElementById("imageInsertModal").classList.add("active");
    document.getElementById("imageUrl").focus();
  }

  closeImageInsertModal() {
    document.getElementById("imageInsertModal").classList.remove("active");
    document.getElementById("imageUrl").value = "";
    document.getElementById("imageAlt").value = "";
    document.getElementById("descriptionImageInput").value = "";
  }

  openTableInsertModal() {
    document.getElementById("tableInsertModal").classList.add("active");
  }

  closeTableInsertModal() {
    document.getElementById("tableInsertModal").classList.remove("active");
  }

  insertImage() {
    const url = document.getElementById("imageUrl").value.trim();
    const alt = document.getElementById("imageAlt").value.trim();

    if (url) {
      const safeAlt = alt.replace(/"/g, '&quot;');
      const imgTag = `<img src="${url}" alt="${safeAlt}" class="apf-img-center" style="max-width: 100%; height: auto;">`;
      // 모달에서 포커스를 빼앗겼으므로 삽입 전 selection 복원 후 안전 삽입
      this.insertHtmlIntoEditorSafely(imgTag);
      this.closeImageInsertModal();
    } else {
      this.showNotification("이미지 URL을 입력해주세요.", "error");
    }
  }

  insertTable() {
    const rows = parseInt(document.getElementById("tableRows").value);
    const cols = parseInt(document.getElementById("tableCols").value);
    const hasHeader = document.getElementById("tableHeader").checked;

    let tableHTML =
      '<table border="1" style="border-collapse: collapse; width: 100%;">';

    for (let i = 0; i < rows; i++) {
      const tag = hasHeader && i === 0 ? "th" : "td";
      tableHTML += "<tr>";
      for (let j = 0; j < cols; j++) {
        tableHTML += `<${tag} style="padding: 8px; border: 1px solid #ddd;">내용</${tag}>`;
      }
      tableHTML += "</tr>";
    }

    tableHTML += "</table>";

    // 표 삽입도 동일하게 selection 복원 후 안전 삽입
    this.insertHtmlIntoEditorSafely(tableHTML);
    this.closeTableInsertModal();
  }

  handleDescriptionImageUpload(file) {
    if (!file || !file.type.startsWith("image/")) {
      this.showNotification("이미지 파일을 선택해주세요.", "error");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.showNotification("이미지 파일이 너무 큽니다. (최대 5MB)", "error");
      return;
    }

    // FormData로 이미지 업로드
    const formData = new FormData();
    formData.append('images', file);

    this.uploadAndInsertImage(formData);
  }

  // 이미지 업로드 후 에디터에 삽입
  async uploadAndInsertImage(formData) {
    try {
      this.showNotification('이미지를 업로드하는 중...', 'info');
      
      const response = await fetch('/api/upload-images', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('이미지 업로드 실패');
      }

      const result = await response.json();
      
      if (result.imageUrls && result.imageUrls.length > 0) {
        const imageUrl = result.imageUrls[0]; // 첫 번째 이미지 사용
        const imgTag = `<img src="${imageUrl}" alt="설명 이미지" class="apf-img-center" style="max-width: 100%; height: auto;">`;
        
        // selection 복원 후 안전 삽입
        this.insertHtmlIntoEditorSafely(imgTag);
        this.closeImageInsertModal();
        this.showNotification("이미지가 삽입되었습니다.", "success");
      } else {
        throw new Error('업로드된 이미지 URL을 받지 못했습니다.');
      }
    } catch (error) {
      console.error('이미지 업로드 오류:', error);
      this.showNotification('이미지 업로드에 실패했습니다.', 'error');
    }
  }

  showNotification(message, type = "info") {
    // 간단한 알림 표시
    const notification = document.createElement("div");
    notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 6px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            max-width: 300px;
            word-wrap: break-word;
        `;

    switch (type) {
      case "success":
        notification.style.background = "#28a745";
        break;
      case "error":
        notification.style.background = "#dc3545";
        break;
      case "warning":
        notification.style.background = "#ffc107";
        notification.style.color = "#212529";
        break;
      default:
        notification.style.background = "#17a2b8";
    }

    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
}

// 페이지 로드 시 초기화
document.addEventListener("DOMContentLoaded", () => {
  new AdminProductForm();
});

// 페이지 떠날 때 경고
window.addEventListener("beforeunload", (e) => {
  // 폼이 변경되었는지 확인하는 로직은 AdminProductForm 클래스 내에서 처리
});

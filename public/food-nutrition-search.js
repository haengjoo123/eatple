// [공공데이터포털] 음식 영양성분 검색 UI/로직 (CSV 전용)
(function() {
    // DOM 요소
    const input = document.getElementById('externalSearchInput');
    const searchIcon = document.getElementById('searchIcon');
    const loading = document.getElementById('externalSearchLoading');
    const errorBox = document.getElementById('externalSearchError');
    const resultsBox = document.getElementById('externalSearchResults');
    const detailBox = document.getElementById('externalNutritionDetail');
    const summarySection = document.getElementById('searchResultsSummary');
    const summaryKeyword = document.getElementById('summaryKeyword');
    const summaryCount = document.getElementById('summaryCount');

    if (!input || !searchIcon) return; // 해당 UI가 없는 경우 무시

    // 검색 이벤트 - Enter 키 또는 검색 아이콘 클릭으로 검색 가능
    input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') handleExternalSearch();
    });
    
    // 검색 아이콘 클릭 이벤트 추가
    searchIcon.addEventListener('click', function() {
        handleExternalSearch();
    });
    
    // 검색 아이콘에 커서 스타일 추가
    searchIcon.style.cursor = 'pointer';

    // 검색 함수 (CSV 검색만 사용)
    async function handleExternalSearch() {
        const keyword = input.value.trim();
        if (!keyword) {
            showError('제품명을 입력하세요.');
            return;
        }
        
        if (keyword.length < 1) {
            showError('검색어를 입력해주세요.');
            return;
        }
        
        // CSV 검색 API 사용
        const apiUrl = `/api/food-nutrition-external/search?productName=${encodeURIComponent(keyword)}&limit=1000`;
        console.log('[food-nutrition-search.js] CSV 검색 API 요청:', apiUrl);
        
        showLoading();
        try {
            const res = await fetch(apiUrl);
            
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            
            const data = await res.json();
            console.log('[food-nutrition-search.js] CSV 검색 API 응답:', data);
            
            if (!data.success) {
                showError(data.error || '검색 중 오류가 발생했습니다.');
                return;
            }
            
            if (!Array.isArray(data.data) || data.data.length === 0) {
                showError('검색 결과가 없습니다. 다른 제품명으로 시도해보세요.');
                return;
            }
            
            renderResults(data.data, ['csv'], keyword);
        } catch (err) {
            console.error('[food-nutrition-search.js] CSV 검색 API 에러:', err);
            if (err.name === 'TypeError' && err.message.includes('fetch')) {
                showError('네트워크 연결을 확인해주세요.');
            } else {
                showError('검색 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
            }
        }
    }

    // 로딩 표시
    function showLoading() {
        hideError();
        hideResults();
        if (loading) loading.style.display = 'block';
    }

    // 검색 결과 요약 표시
    function showSummary(keyword, count) {
        if (summarySection && summaryKeyword && summaryCount) {
            summaryKeyword.textContent = `"${keyword}"`;
            summaryCount.textContent = count;
            summarySection.style.display = 'block';
        }
    }

    // 검색 결과 요약 숨기기
    function hideSummary() {
        if (summarySection) {
            summarySection.style.display = 'none';
        }
    }

    // 에러 표시
    function showError(message) {
        hideLoading();
        hideResults();
        hideSummary();
        if (errorBox) {
            errorBox.textContent = message;
            errorBox.style.display = 'block';
        }
        // 에러가 표시될 때는 헤더를 다시 보이게 함
        document.body.classList.remove('has-search-results');
    }

    // 에러 숨기기
    function hideError() {
        if (errorBox) errorBox.style.display = 'none';
    }

    // 로딩 숨기기
    function hideLoading() {
        if (loading) loading.style.display = 'none';
    }

    // 결과 숨기기
    function hideResults() {
        if (resultsBox) resultsBox.style.display = 'none';
        if (detailBox) detailBox.style.display = 'none';
        hideSummary();
        // 결과가 숨겨질 때 헤더를 다시 보이게 함
        document.body.classList.remove('has-search-results');
    }

    // 검색 결과 렌더링
    function renderResults(results, sources, keyword) {
        hideLoading();
        hideError();
        
        if (!resultsBox) return;
        
        // 검색 결과가 있을 때 헤더를 숨기고 검색 섹션을 위로 올림
        document.body.classList.add('has-search-results');
        
        // 검색 결과 요약 표시
        const resultCount = results.length;
        showSummary(keyword, resultCount);
        
        let html = `
            <div class="external-search-results-list">
        `;
        
        // 결과 목록 생성
        results.forEach((item, index) => {
            const energy = item.에너지 ? `${item.에너지} kcal` : '정보 없음';
            const protein = item.단백질 ? `${item.단백질}g` : '정보 없음';
            const fat = item.지방 ? `${item.지방}g` : '정보 없음';
            const carbs = item.탄수화물 ? `${item.탄수화물}g` : '정보 없음';
            
            // 고유 ID 생성 (식품코드가 있으면 사용, 없으면 식품명+제조사명 조합)
            const uniqueId = item.식품코드 || `${item.식품명}_${item.제조사명 || 'unknown'}`.replace(/[^a-zA-Z0-9가-힣]/g, '_');
            
            // 아이템 데이터를 base64로 인코딩하여 안전하게 전달
            const encodedItemData = btoa(encodeURIComponent(JSON.stringify(item)));
            
            html += `
                <div class="external-search-result-item" data-item-id="${uniqueId}" onclick="showDetailByData('${uniqueId}', '${encodedItemData}')">
                    <div class="result-header">
                        <h4 class="food-name">${item.식품명 || '제품명 없음'}</h4>
                    </div>
                    <div class="result-basic-info">
                        <span class="info-item">칼로리: ${energy}</span>
                        <span class="info-item">탄수화물: ${carbs}</span>
                        <span class="info-item">단백질: ${protein}</span>
                        <span class="info-item">지방: ${fat}</span>
                    </div>
                    ${item.제조사명 ? `<div class="manufacturer">${item.제조사명}</div>` : ''}
                    ${item.식품중량 ? `<div class="weight">중량: ${item.식품중량}</div>` : ''}
                </div>
            `;
        });
        
        html += '</div>';
        
        resultsBox.innerHTML = html;
        resultsBox.style.display = 'block';
        
        // 전역 변수로 결과 저장 (상세정보 조회용) - 기존 호환성을 위해 유지
        window.searchResults = results;
    }

    // 상세정보 조회 및 렌더링
    async function fetchDetail(item) {
        console.log('[food-nutrition-search.js] fetchDetail 호출됨:', item);
        console.log('[food-nutrition-search.js] fetchDetail - 식품명:', item.식품명);
        console.log('[food-nutrition-search.js] fetchDetail - 제조사명:', item.제조사명);
        
        // 필수 정보 검증 (식품명만 필수)
        if (!item.식품명) {
            showError('상세 정보를 조회하기 위한 식품명이 필요합니다.');
            return;
        }
        
        showLoading();
        try {
            // CSV 상세정보 API 사용 - 더 정확한 검색을 위해 제조사명도 포함
            const params = new URLSearchParams({
                foodName: item.식품명
            });
            
            if (item.식품코드) {
                params.append('foodCode', item.식품코드);
            }
            
            // 제조사명이 있으면 추가하여 더 정확한 검색
            if (item.제조사명 && item.제조사명.trim() !== '') {
                params.append('manufacturer', item.제조사명);
            }
            
            const detailUrl = `/api/food-nutrition-external/detail?${params}`;
            console.log('[food-nutrition-search.js] CSV 상세정보 API 요청:', detailUrl);
            
            const res = await fetch(detailUrl);
            
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            
            const data = await res.json();
            console.log('[food-nutrition-search.js] CSV 상세정보 API 응답:', data);
            
            if (!data.success) {
                showError(data.error || '상세정보 조회 중 오류가 발생했습니다.');
                return;
            }
            
            // API 응답의 제조사명과 원본 아이템의 제조사명이 다른 경우 경고
            if (data.data.제조사명 && item.제조사명 && 
                data.data.제조사명 !== item.제조사명) {
                console.warn('[food-nutrition-search.js] 제조사명 불일치:', {
                    원본: item.제조사명,
                    API응답: data.data.제조사명
                });
            }
            
            renderDetail(data.data);
        } catch (err) {
            console.error('[food-nutrition-search.js] CSV 상세정보 API 에러:', err);
            showError('상세정보 조회 중 오류가 발생했습니다.');
        }
    }

    // 상세정보 렌더링
    function renderDetail(item) {
        hideLoading();
        
        if (!detailBox) return;
        
        // 상세정보 표시 시 body에 클래스 추가
        document.body.classList.add('showing-detail');
        
        // 상세정보 표시 시 검색 결과 리스트 숨기기
        if (resultsBox) resultsBox.style.display = 'none';
        
        // 쿠팡 검색어 생성 (식품명 + 제조사명)
        const searchKeyword = `${item.식품명} ${item.제조사명 || ''}`.trim();
        const coupangSearchUrl = `https://www.coupang.com/np/search?q=${encodeURIComponent(searchKeyword)}`;
        
        const nutritionData = [
            { label: '칼로리', value: item.에너지, unit: 'kcal' },
            { label: '탄수화물', value: item.탄수화물, unit: 'g' },
            { label: '단백질', value: item.단백질, unit: 'g' },
            { label: '지방', value: item.지방, unit: 'g' },
            { label: '당류', value: item.당류, unit: 'g' },
            { label: '나트륨', value: item.나트륨, unit: 'mg' },
            { label: '콜레스테롤', value: item.콜레스테롤, unit: 'mg' },
            { label: '포화지방산', value: item.포화지방산, unit: 'g' },
            { label: '트랜스지방산', value: item.트랜스지방산, unit: 'g' }
        ];
        
        let html = `
            <div class="detail-header">
                <h3>${item.식품명 || '제품명 없음'}</h3>
                <button class="btn-purchase" onclick="window.open('${coupangSearchUrl}', '_blank')">
                    <span class="purchase-icon">🛒</span>
                    구매하기
                </button>
            </div>
            <div class="detail-content">
                <div class="basic-info">
                    ${item.제조사명 ? `<div class="info-row"><span class="label">제조사:</span> <span class="value">${item.제조사명}</span></div>` : ''}
                    ${item.식품중량 ? `<div class="info-row"><span class="label">중량:</span> <span class="value">${item.식품중량}</span></div>` : ''}
                    ${item.식품코드 ? `<div class="info-row"><span class="label">식품코드:</span> <span class="value">${item.식품코드}</span></div>` : ''}
                    ${item.식품대분류명 ? `<div class="info-row"><span class="label">분류:</span> <span class="value">${item.식품대분류명}</span></div>` : ''}
                </div>
                <div class="nutrition-table">
                    <h4>영양성분 (100g 기준)</h4>
                    <table>
                        <thead>
                            <tr>
                                <th>영양성분</th>
                                <th>함량</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        nutritionData.forEach(nutrition => {
            const value = nutrition.value ? `${nutrition.value} ${nutrition.unit}` : '정보 없음';
            html += `
                <tr>
                    <td>${nutrition.label}</td>
                    <td>${value}</td>
                </tr>
            `;
        });
        
        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        detailBox.innerHTML = html;
        detailBox.style.display = 'block';
        
        // '목록으로' 버튼을 검색섹션과 헤더 사이에 추가
        addBackToListButton();
    }

    // 전역 함수로 상세정보 표시 (HTML에서 호출)
    window.showDetail = function(index) {
        if (window.searchResults && window.searchResults[index]) {
            fetchDetail(window.searchResults[index]);
        }
    };

    // 새로운 전역 함수: 아이템 데이터를 직접 받아서 상세정보 표시
    window.showDetailByData = function(itemId, itemData) {
        console.log('[food-nutrition-search.js] 상세정보 조회 시작:', itemId);
        console.log('[food-nutrition-search.js] 원본 itemData:', itemData);
        
        // 아이템 데이터가 문자열로 전달된 경우 파싱
        let parsedItemData;
        try {
            parsedItemData = typeof itemData === 'string' ? JSON.parse(decodeURIComponent(atob(itemData))) : itemData;
            console.log('[food-nutrition-search.js] 파싱된 아이템 데이터:', parsedItemData);
            console.log('[food-nutrition-search.js] 선택된 아이템 식품명:', parsedItemData.식품명);
        } catch (error) {
            console.error('[food-nutrition-search.js] 아이템 데이터 파싱 오류:', error);
            showError('상세정보 조회 중 오류가 발생했습니다.');
            return;
        }
        
        // 파싱된 데이터로 상세정보 조회
        fetchDetail(parsedItemData);
    };

    // 전역 함수로 상세정보 숨기기 (HTML에서 호출)
    window.hideDetail = function() {
        if (detailBox) detailBox.style.display = 'none';
        // 상세정보 숨김 시 body에서 클래스 제거
        document.body.classList.remove('showing-detail');
        
        // '목록으로' 버튼 제거
        const backToListButton = document.querySelector('.btn-back-to-list');
        if (backToListButton) {
            backToListButton.remove();
        }
        
        // 검색 결과 리스트 다시 표시
        if (resultsBox && window.searchResults && window.searchResults.length > 0) {
            resultsBox.style.display = 'block';
            // 검색 결과가 있을 때 헤더섹션 숨기고 검색섹션 올리기
            document.body.classList.add('has-search-results');
            console.log('[food-nutrition-search.js] 검색 결과 리스트 다시 표시됨');
        } else {
            console.log('[food-nutrition-search.js] 검색 결과 리스트 표시 실패:', {
                resultsBox: !!resultsBox,
                searchResults: !!window.searchResults,
                searchResultsLength: window.searchResults ? window.searchResults.length : 0
            });
        }
        
        // 검색 결과가 있는 경우에만 다시 표시
        if (window.searchResults && window.searchResults.length > 0) {
            console.log('[food-nutrition-search.js] 검색 결과가 있음, 다시 표시 시도');
        }
    };

    // '목록으로' 버튼을 검색섹션과 헤더 사이에 추가하는 함수
    function addBackToListButton() {
        // search-section과 external-nutrition-search-section 사이에 '목록으로' 버튼 추가
        const searchSection = document.querySelector('.search-section');
        const externalSection = document.querySelector('.external-nutrition-search-section');
        
        if (searchSection && externalSection) {
            // 기존 버튼이 있으면 제거
            const existingButton = document.querySelector('.btn-back-to-list');
            if (existingButton) {
                existingButton.remove();
            }
            
            // 새 버튼 생성
            const backToListButton = document.createElement('button');
            backToListButton.className = 'btn-back-to-list';
            backToListButton.innerHTML = '<span class="back-icon">←</span> 목록으로';
            backToListButton.onclick = window.hideDetail;
            
            // search-section 다음, external-nutrition-search-section 이전에 버튼 삽입
            searchSection.parentNode.insertBefore(backToListButton, externalSection);
        }
    }

    console.log('[food-nutrition-search.js] CSV 전용 검색 시스템 초기화 완료');
})(); 
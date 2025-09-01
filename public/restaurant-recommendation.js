// AI 식당 추천 시스템 - 단계별 네비게이션
class RestaurantRecommendation {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 5; // 5단계까지 포함 (로딩 단계 포함)
        this.map = null;
        this.marker = null;
        this.isMarkerVisible = false; // 초기에는 마커 표시 안 함
        this.selectedLocation = null;
        this.loadedProfile = null; // 서버/로컬 프로필 저장
        this.isSearching = false; // 주소 검색 중복 호출 방지 플래그
        this.isMapInitialized = false; // 지도 초기화 상태 플래그
        this.init();
    }

    init() {
        this.bindEvents();
        this.initializeMap();
        this.tryGetCurrentLocation();
        this.loadUserProfile(); // 프로필 정보 자동 로드
        this.initializePlaceholderManagement(); // placeholder 관리 초기화
    }

    bindEvents() {
        // 현재 위치 버튼
        const currentLocationBtn = document.querySelector('button[onclick="getCurrentLocation()"]');
        if (currentLocationBtn) {
            currentLocationBtn.onclick = () => this.getCurrentLocation();
        }

        // 위치 확인 버튼
        const confirmLocationBtn = document.getElementById('confirmLocationBtn');
        if (confirmLocationBtn) {
            confirmLocationBtn.onclick = () => this.confirmLocation();
        }

        // 주소 검색 기능
        const searchAddressBtn = document.getElementById('searchAddressBtn');
        const addressSearchInput = document.getElementById('addressSearch');
        
        if (searchAddressBtn) {
            searchAddressBtn.onclick = () => this.searchAddress();
        }
        
        if (addressSearchInput) {
            // 기존 이벤트 리스너 제거
            addressSearchInput.removeEventListener('keypress', this.handleAddressSearchKeypress);
            
            // 새로운 이벤트 리스너 등록
            this.handleAddressSearchKeypress = (e) => {
                if (e.key === 'Enter') {
                    this.searchAddress();
                }
            };
            addressSearchInput.addEventListener('keypress', this.handleAddressSearchKeypress);
        }

        // 네비게이션 버튼들
        const nextButtons = document.querySelectorAll('button[onclick="nextStep()"]');
        nextButtons.forEach(btn => {
            btn.onclick = () => this.nextStep();
        });

        const prevButtons = document.querySelectorAll('button[onclick="prevStep()"]');
        prevButtons.forEach(btn => {
            btn.onclick = () => this.prevStep();
        });

        // AI 추천 시작 버튼
        const recommendBtn = document.getElementById('recommendBtn');
        if (recommendBtn) {
            recommendBtn.onclick = () => this.startRecommendation();
        }

        // 다시 시작 버튼
        const restartBtn = document.querySelector('button[onclick="restartRecommendation()"]');
        if (restartBtn) {
            restartBtn.onclick = () => this.restartRecommendation();
        }

        // 옵션 그룹 클릭 이벤트
        this.bindOptionGroupEvents();
    }

    // 옵션 그룹 클릭 이벤트 바인딩
    bindOptionGroupEvents() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('option')) {
                const group = e.target.closest('.option-group');
                if (group) {
                    const groupName = group.dataset.name;
                    const isMultiSelect = ['allergies', 'illnesses', 'biomarkers', 'supplements'].includes(groupName);
                    
                    if (isMultiSelect) {
                        // 다중 선택: 토글 방식
                        e.target.classList.toggle('selected');
                    } else {
                        // 단일 선택: 다른 옵션 해제 후 현재 옵션 선택
                        group.querySelectorAll('.option').forEach(opt => opt.classList.remove('selected'));
                        e.target.classList.add('selected');
                    }
                }
            }
        });
    }

    // 카카오 지도 초기화
    initializeMap() {
        // 이미 초기화된 경우 중복 호출 방지
        if (this.isMapInitialized && this.map) {
            console.log('지도가 이미 초기화되어 있습니다.');
            return;
        }

        // API 로딩 상태 확인
        if (typeof kakao === 'undefined') {
            console.warn('카카오 지도 API가 아직 로드되지 않았습니다. 잠시 후 다시 시도합니다.');
            // 1초 후 다시 시도
            setTimeout(() => this.initializeMap(), 1000);
            return;
        }

        // kakao.maps 객체 확인
        if (typeof kakao.maps === 'undefined') {
            console.warn('카카오 지도 maps 객체가 아직 준비되지 않았습니다. 잠시 후 다시 시도합니다.');
            // 1초 후 다시 시도
            setTimeout(() => this.initializeMap(), 1000);
            return;
        }

        try {
            // 기본 중심 위치는 대한민국 중앙 부근으로 설정 (편향 방지)
            const defaultLat = 36.5;
            const defaultLng = 127.8;

            const mapContainer = document.getElementById('map');
            if (!mapContainer) {
                console.error('지도 컨테이너를 찾을 수 없습니다.');
                return;
            }

            const mapOption = {
                center: new kakao.maps.LatLng(defaultLat, defaultLng),
                level: 4, // 초기 축척을 더 확대 (지역 단위)
                draggable: true,
                scrollwheel: true,
                disableDoubleClickZoom: false,
                disableDoubleTapZoom: false,
                keyboardShortcuts: false
            };

            this.map = new kakao.maps.Map(mapContainer, mapOption);
            // 초기엔 선택을 유도하기 위해 마커를 표시하지 않음
            this.marker = null;
            this.isMarkerVisible = false;

            // 지도 클릭 이벤트 (한 번만 등록)
            if (!this.mapClickListener) {
                this.mapClickListener = kakao.maps.event.addListener(this.map, 'click', (mouseEvent) => {
                    const latlng = mouseEvent.latLng;
                    this.updateMarkerPosition(latlng);
                    this.updateLocationInfo(latlng);
                });
            }

            // 초기에는 선택한 위치를 설정하지 않음 (유저 선택/권한 허용 시에만 설정)
            this.selectedLocation = null;
            
            // 지도 컨테이너 크기 변경 감지
            const resizeObserver = new ResizeObserver(() => {
                if (this.map) {
                    this.map.relayout();
                }
            });
            resizeObserver.observe(mapContainer);
            
            // 초기화 완료 플래그 설정
            this.isMapInitialized = true;
            console.log('카카오 지도 초기화 완료');
        } catch (error) {
            console.error('카카오 지도 초기화 중 오류 발생:', error);
            this.handleMapLoadError();
        }
    }

    // 지도 로드 에러 처리
    handleMapLoadError() {
        console.error('🗺️ 카카오맵 로드 실패 - 상세 정보:');
        console.error('- 현재 도메인:', window.location.origin);
        console.error('- 프로토콜:', window.location.protocol);
        console.error('- 카카오 객체 상태:', typeof kakao);
        
        const mapContainer = document.getElementById('map');
        if (mapContainer) {
            mapContainer.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; background: #f5f5f5; border-radius: 8px;">
                    <div style="font-size: 16px; color: #666; margin-bottom: 10px;">지도를 불러올 수 없습니다</div>
                    <div style="font-size: 14px; color: #999; text-align: center;">
                        네트워크 연결을 확인하거나<br>잠시 후 다시 시도해주세요
                    </div>
                    <div style="font-size: 12px; color: #ccc; margin-top: 10px; text-align: center;">
                        도메인: ${window.location.origin}<br>
                        프로토콜: ${window.location.protocol}
                    </div>
                    <button onclick="location.reload()" style="margin-top: 15px; padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        새로고침
                    </button>
                </div>
            `;
        }
        
        // 주소 입력 필드 비활성화
        const addressInput = document.getElementById('address');
        if (addressInput) {
            addressInput.placeholder = '지도를 불러올 수 없습니다. 새로고침 후 다시 시도해주세요.';
            addressInput.disabled = true;
        }
        
        // 위치 확인 버튼 비활성화
        const confirmBtn = document.getElementById('confirmLocationBtn');
        if (confirmBtn) {
            confirmBtn.disabled = true;
        }
    }

    // 마커 위치 업데이트
    updateMarkerPosition(latlng) {
        // 최초 선택 시 마커가 없으면 생성해서 지도에 표시
        if (!this.marker) {
            this.marker = new kakao.maps.Marker({ position: latlng, map: this.map });
            this.isMarkerVisible = true;
            return;
        }
        this.marker.setPosition(latlng);
        // 마커가 아직 지도에 표시되지 않았다면 표시
        if (!this.isMarkerVisible) {
            this.marker.setMap(this.map);
            this.isMarkerVisible = true;
        }
    }

    // 위치 정보 업데이트
    updateLocationInfo(latlng) {
        const addressInput = document.getElementById('address');

        // kakao.maps.services 확인
        if (typeof kakao === 'undefined' || typeof kakao.maps === 'undefined' || typeof kakao.maps.services === 'undefined') {
            console.warn('카카오 지도 서비스가 아직 준비되지 않았습니다.');
            if (addressInput) {
                addressInput.value = `위도: ${latlng.getLat().toFixed(6)}, 경도: ${latlng.getLng().toFixed(6)}`;
            }
            this.selectedLocation = latlng;
            this.enableConfirmButton();
            return;
        }

        try {
            // 주소 정보 가져오기
            const geocoder = new kakao.maps.services.Geocoder();
            geocoder.coord2Address(latlng.getLng(), latlng.getLat(), (result, status) => {
                if (status === kakao.maps.services.Status.OK) {
                    // 도로명 주소 우선, 없으면 지번 주소 사용
                    const roadAddress = result[0].road_address ? result[0].road_address.address_name : null;
                    const jibunAddress = result[0].address.address_name;
                    const address = roadAddress || jibunAddress;
                    
                    if (addressInput) {
                        addressInput.value = address;
                    }
                } else {
                    // 주소를 가져올 수 없는 경우 좌표로 표시
                    if (addressInput) {
                        addressInput.value = `위도: ${latlng.getLat().toFixed(6)}, 경도: ${latlng.getLng().toFixed(6)}`;
                    }
                }
            });
        } catch (error) {
            console.error('주소 변환 중 오류 발생:', error);
            if (addressInput) {
                addressInput.value = `위도: ${latlng.getLat().toFixed(6)}, 경도: ${latlng.getLng().toFixed(6)}`;
            }
        }

        this.selectedLocation = latlng;
        this.enableConfirmButton();
    }

    // 위치 확인 버튼 활성화
    enableConfirmButton() {
        const confirmBtn = document.getElementById('confirmLocationBtn');
        if (confirmBtn) {
            confirmBtn.disabled = false;
        }
    }

    // 페이지 로드 시 현재 위치 자동 가져오기 (조용히)
    tryGetCurrentLocation() {
        if (!navigator.geolocation) {
            return;
        }

        const options = {
            enableHighAccuracy: true,  // 높은 정확도 활성화
            timeout: 10000,           // 10초 타임아웃
            maximumAge: 0             // 캐시된 위치 정보 사용 안함
        };
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                try {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    const accuracy = position.coords.accuracy; // 정확도 정보
                    
                    // kakao.maps 확인
                    if (typeof kakao === 'undefined' || typeof kakao.maps === 'undefined') {
                        return;
                    }
                    
                    const latlng = new kakao.maps.LatLng(lat, lng);
                    
                    // 지도가 준비된 후에만 위치 설정
                    if (this.map) {
                        // panTo 사용하여 부드러운 이동
                        this.map.panTo(latlng);
                        this.updateMarkerPosition(latlng);
                        this.updateLocationInfo(latlng);
                        
                        // 자동 위치 가져오기는 조용히 처리 (메시지 표시 안함)
                        console.log(`현재 위치를 자동으로 가져왔습니다. (정확도: ${Math.round(accuracy)}m)`);
                    }
                } catch (error) {
                    console.log('자동 위치 설정 중 오류:', error.message);
                }
            },
            (error) => {
                // 조용히 실패 (기본 위치 사용)
                console.log('현재 위치를 가져올 수 없습니다. 기본 위치를 사용합니다.');
            },
            options
        );
    }

    // 사용자 프로필 정보 로드
    async loadUserProfile() {
        try {
            const authRes = await fetch('/api/auth/me', { credentials: 'include' });
            const authData = await authRes.json();
            
            if (authData.loggedIn) {
                const profileRes = await fetch('/api/profile', { credentials: 'include' });
                const profile = await profileRes.json();
                if (profile && typeof profile === 'object' && !profile.error) {
                    this.loadedProfile = profile;
                    this.autofillProfileForm(profile);
                } else {
                    this.loadedProfile = null;
                    this.showProfileSection(1);
                    this.updateProfileProgress(1);
                }
            } else {
                const tempProfile = localStorage.getItem('pendingProfile');
                if (tempProfile) {
                    try {
                        const profile = JSON.parse(tempProfile);
                        this.loadedProfile = profile;
                        this.autofillProfileForm(profile);
                    } catch (error) {
                        this.loadedProfile = null;
                        localStorage.removeItem('pendingProfile');
                        this.showProfileSection(1);
                        this.updateProfileProgress(1);
                    }
                } else {
                    this.loadedProfile = null;
                    this.showProfileSection(1);
                    this.updateProfileProgress(1);
                }
            }
        } catch (error) {
            this.loadedProfile = null;
            this.showProfileSection(1);
            this.updateProfileProgress(1);
        }
    }

    // 프로필 정보 자동 채우기
    autofillProfileForm(profile) {
        // 기본 정보 필드 채우기
        Object.entries(profile).forEach(([key, value]) => {
            const input = document.querySelector(`#profileForm [name="${key}"]`);
            if (input) {
                if (input.type === 'select-multiple') {
                    // 멀티셀렉트(배열) 처리
                    Array.from(input.options).forEach(opt => {
                        opt.selected = (value || []).includes(opt.value);
                    });
                } else {
                    input.value = value;
                }
            }
        });
        
        // option-group 옵션들의 selected 클래스 설정
        document.querySelectorAll('#profileForm .option-group').forEach(group => {
            const groupName = group.dataset.name;
            if (profile[groupName]) {
                const values = Array.isArray(profile[groupName]) ? profile[groupName] : [profile[groupName]];
                group.querySelectorAll('.option').forEach(option => {
                    if (values.includes(option.dataset.value)) {
                        option.classList.add('selected');
                    } else {
                        option.classList.remove('selected');
                    }
                });
            } else {
                group.querySelectorAll('.option').forEach(option => option.classList.remove('selected'));
            }
        });
        
        // 기타 입력 필드 활성화
        if (profile.other_allergies_text) {
            const otherAllergyToggle = document.querySelector('.option[data-value="other_allergy_toggle"]');
            const otherAllergyInput = document.getElementById('otherAllergyInput');
            if (otherAllergyToggle && otherAllergyInput) {
                otherAllergyToggle.classList.add('selected');
                otherAllergyInput.classList.add('active');
            }
        }
        
        if (profile.other_illnesses_text) {
            const otherIllnessToggle = document.querySelector('.option[data-value="other_illness_toggle"]');
            const otherIllnessInput = document.getElementById('otherIllnessInput');
            if (otherIllnessToggle && otherIllnessInput) {
                otherIllnessToggle.classList.add('selected');
                otherIllnessInput.classList.add('active');
            }
        }
        
        if (profile.other_biomarkers_text) {
            const otherBiomarkerToggle = document.querySelector('.option[data-value="other_biomarker_toggle"]');
            const otherBiomarkerInput = document.getElementById('otherBiomarkerInput');
            if (otherBiomarkerToggle && otherBiomarkerInput) {
                otherBiomarkerToggle.classList.add('selected');
                otherBiomarkerInput.classList.add('active');
            }
        }
        
        if (profile.other_supplements_text) {
            const otherSupplementToggle = document.querySelector('.option[data-value="other_supplement_toggle"]');
            const otherSupplementInput = document.getElementById('otherSupplementInput');
            if (otherSupplementToggle && otherSupplementInput) {
                otherSupplementToggle.classList.add('selected');
                otherSupplementInput.classList.add('active');
            }
        }
        
        // 바이오마커와 건강기능식품의 개별 값들 설정
        if (profile.specific_biomarkers) {
            Object.keys(profile.specific_biomarkers).forEach(key => {
                const option = document.querySelector(`.option[data-value="${key}"]`);
                if (option) {
                    option.classList.add('selected');
                    const valueInput = option.querySelector('.value-input');
                    if (valueInput) {
                        valueInput.classList.add('active');
                        valueInput.value = profile.specific_biomarkers[key];
                    }
                }
            });
        }
        
        if (profile.specific_supplements) {
            Object.keys(profile.specific_supplements).forEach(key => {
                const option = document.querySelector(`.option[data-value="${key}"]`);
                if (option) {
                    option.classList.add('selected');
                    const valueInput = option.querySelector('.value-input');
                    if (valueInput) {
                        valueInput.classList.add('active');
                        valueInput.value = profile.specific_supplements[key];
                    }
                }
            });
        }
        
        // 프로그레스바 업데이트 및 첫 번째 섹션만 표시
        setTimeout(() => {
            this.showProfileSection(1);
            this.updateProfileProgress(1);
        }, 100);
    }

    // 현재 위치 가져오기 (사용자 버튼 클릭 시)
    getCurrentLocation() {
        if (!navigator.geolocation) {
            this.showMessage('이 브라우저에서는 위치 정보를 지원하지 않습니다.', 'error');
            return;
        }

        // kakao.maps 확인
        if (typeof kakao === 'undefined' || typeof kakao.maps === 'undefined') {
            this.showMessage('지도 서비스가 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.', 'error');
            return;
        }

        // 지도가 준비되지 않은 경우 처리
        if (!this.map) {
            this.showMessage('지도가 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.', 'error');
            return;
        }

        const options = {
            enableHighAccuracy: true,  // 높은 정확도 활성화
            timeout: 15000,           // 15초 타임아웃
            maximumAge: 0             // 캐시된 위치 정보 사용 안함
        };
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                try {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    const accuracy = position.coords.accuracy;
                    const latlng = new kakao.maps.LatLng(lat, lng);
                    
                    // panTo 사용하여 부드러운 이동
                    this.map.panTo(latlng);
                    this.updateMarkerPosition(latlng);
                    this.updateLocationInfo(latlng);
                    
                    // 정확도에 따른 메시지
                    if (accuracy <= 10) {
                        this.showMessage(`매우 정확한 위치를 가져왔습니다! (정확도: ${Math.round(accuracy)}m)`, 'success');
                    } else if (accuracy <= 50) {
                        this.showMessage(`정확한 위치를 가져왔습니다. (정확도: ${Math.round(accuracy)}m)`, 'success');
                    } else {
                        this.showMessage(`위치를 가져왔습니다. (정확도: ${Math.round(accuracy)}m)`, 'success');
                    }
                } catch (error) {
                    console.error('현재 위치 설정 중 오류 발생:', error);
                    this.showMessage('현재 위치 설정 중 오류가 발생했습니다.', 'error');
                }
            },
            (error) => {
                let errorMessage = '위치를 가져올 수 없습니다. 지도에서 직접 선택해주세요.';
                
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = '위치 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해주세요.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = '위치 정보를 사용할 수 없습니다.';
                        break;
                    case error.TIMEOUT:
                        errorMessage = '위치 정보 요청 시간이 초과되었습니다. 다시 시도해주세요.';
                        break;
                }
                
                this.showMessage(errorMessage, 'error');
            },
            options
        );
    }

    // 위치 확인 완료
    confirmLocation() {
        if (!this.selectedLocation) {
            this.showMessage('지도에서 위치를 선택해주세요.', 'error');
            return;
        }

        this.nextStep();
        this.showMessage('위치가 설정되었습니다.', 'success');
    }

    // 주소 검색 기능
    searchAddress() {
        const addressSearchInput = document.getElementById('addressSearch');
        const searchQuery = addressSearchInput.value.trim();
        
        if (!searchQuery) {
            this.showMessage('검색할 주소를 입력해주세요.', 'error');
            return;
        }

        // 중복 호출 방지를 위한 플래그
        if (this.isSearching) {
            return;
        }

        // kakao.maps.services 확인
        if (typeof kakao === 'undefined' || typeof kakao.maps === 'undefined' || typeof kakao.maps.services === 'undefined') {
            this.showMessage('지도 서비스가 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.', 'error');
            return;
        }

        // 지도가 준비되지 않은 경우 처리
        if (!this.map) {
            this.showMessage('지도가 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.', 'error');
            return;
        }

        this.isSearching = true;
        this.showMessage('주소를 검색하는 중...', 'info');
        
        try {
            // 카카오 주소 검색 API 사용
            const geocoder = new kakao.maps.services.Geocoder();
            geocoder.addressSearch(searchQuery, (result, status) => {
                this.isSearching = false; // 검색 완료
                
                if (status === kakao.maps.services.Status.OK) {
                    if (result.length > 0) {
                        const item = result[0];
                        const latlng = new kakao.maps.LatLng(item.y, item.x);
                        
                        // panTo 사용하여 부드러운 이동
                        this.map.panTo(latlng);
                        this.map.setLevel(3); // 적절한 줌 레벨
                        
                        // 마커 위치 업데이트
                        this.updateMarkerPosition(latlng);
                        this.updateLocationInfo(latlng);
                        
                        this.showMessage(`"${searchQuery}" 위치를 찾았습니다!`, 'success');
                    } else {
                        this.showMessage('검색 결과가 없습니다. 다른 주소를 입력해주세요.', 'error');
                    }
                } else {
                    this.showMessage('주소 검색에 실패했습니다. 다시 시도해주세요.', 'error');
                }
            });
        } catch (error) {
            console.error('주소 검색 중 오류 발생:', error);
            this.isSearching = false;
            this.showMessage('주소 검색 중 오류가 발생했습니다. 다시 시도해주세요.', 'error');
        }
    }

    // 다음 단계로 이동
    nextStep() {
        if (this.currentStep < this.totalSteps) {
            // 현재 단계 유효성 검사
            if (!this.validateCurrentStep()) {
                return;
            }

            this.currentStep++;
            this.showStep(this.currentStep);
            this.updateSummary();
        }
    }

    // 이전 단계로 이동
    prevStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.showStep(this.currentStep);
        }
    }

    // 현재 단계 표시
    showStep(stepNumber) {
        // 모든 단계 숨기기 (1~5단계)
        for (let i = 1; i <= 5; i++) {
            const stepContent = document.getElementById(`step${i}`);
            if (stepContent) {
                stepContent.classList.remove('active');
                // 인라인 스타일 제거
                stepContent.style.display = '';
            }
        }

        // 현재 단계만 표시
        const currentStepContent = document.getElementById(`step${stepNumber}`);
        if (currentStepContent) {
            currentStepContent.classList.add('active');
            // 인라인 스타일 제거하여 CSS 클래스가 적용되도록 함
            currentStepContent.style.display = '';
        }
        
        // 현재 단계 업데이트
        this.currentStep = stepNumber;
        
        // 4단계일 때 요약 정보 업데이트
        if (stepNumber === 4) {
            this.updateSummary();
        }
    }



    // 현재 단계 유효성 검사
    validateCurrentStep() {
        switch (this.currentStep) {
            case 1:
                if (!this.selectedLocation) {
                    this.showMessage('지도에서 위치를 선택해주세요.', 'error');
                    return false;
                }
                break;
            case 2:
                // 프로필 섹션의 유효성 검사는 별도 함수에서 처리
                if (!this.validateProfileSection()) {
                    return false;
                }
                break;
            case 3:
                // 가격대는 필수 선택
                const priceRange = document.querySelector('input[name="price_range"]:checked');
                if (!priceRange) {
                    this.showMessage('가격대를 선택해주세요.', 'error');
                    return false;
                }
                break;
        }
        return true;
    }

    // 프로필 섹션 유효성 검사
    validateProfileSection() {
        const currentProfileSection = document.querySelector('.profile-section.active');
        if (!currentProfileSection) return true;

        const sectionId = currentProfileSection.id;
        
        if (sectionId === 'profileSection1') {
            // 기본 정보 검증
            const age = document.getElementById('age').value;
            const height = document.getElementById('height').value;
            const weight = document.getElementById('weight').value;
            
            if (!age || !height || !weight) {
                this.showMessage('나이, 키, 체중을 모두 입력해주세요.', 'error');
                return false;
            }
            
            // 성별, 활동량 등 필수 선택 항목 검증
            const requiredGroups = ['gender', 'activity_level', 'eating_patterns', 'sleep_patterns', 'meals_per_day', 'alcohol_consumption', 'smoking_status'];
            for (const groupName of requiredGroups) {
                const group = document.querySelector(`[data-name="${groupName}"]`);
                if (group && !group.querySelector('.option.selected')) {
                    this.showMessage('모든 필수 항목을 선택해주세요.', 'error');
                    return false;
                }
            }
        }
        
        return true;
    }

    // 요약 정보 업데이트
    updateSummary() {
        if (this.currentStep === 4) {
            const address = document.getElementById('address').value;
            // 프로필 데이터: 로그인 시 서버, 비로그인 시 localStorage
            let profileData = this.loadedProfile;
            if (!profileData) {
                const savedProfile = localStorage.getItem('pendingProfile');
                if (savedProfile) {
                    profileData = JSON.parse(savedProfile);
                } else {
                    profileData = {};
                }
            }

            // 알레르기 한글 변환 + 기타
            let allergiesText = this.formatProfileData(profileData.allergies) || '';
            if (profileData.other_allergies_text) {
                allergiesText = allergiesText
                    ? allergiesText + ', ' + profileData.other_allergies_text
                    : profileData.other_allergies_text;
            }
            // 질병 한글 변환 + 기타
            let illnessesText = this.formatProfileData(profileData.illnesses) || '';
            if (profileData.other_illnesses_text) {
                illnessesText = illnessesText
                    ? illnessesText + ', ' + profileData.other_illnesses_text
                    : profileData.other_illnesses_text;
            }

            // 음식 카테고리
            const foodCategory = document.querySelector('input[name="food_category"]:checked')?.value;

            // 요구사항 데이터 수집
            const priceRange = document.querySelector('input[name="price_range"]:checked')?.value;
            const businessStatus = document.querySelector('input[name="business_open"]:checked')?.value;

            document.getElementById('summaryLocation').textContent = address || '위치가 선택되지 않았습니다';
            document.getElementById('summaryAllergies').textContent = allergiesText || '없음';
            document.getElementById('summaryHealth').textContent = illnessesText || '없음';
            document.getElementById('summaryPreferences').textContent = this.formatRequirements(priceRange, businessStatus);
            document.getElementById('summaryBudget').textContent = this.formatPriceRange(priceRange);
            document.getElementById('summaryCategory').textContent = foodCategory || '무관';
        }
    }

    // 선택된 옵션 값 가져오기
    getSelectedOptionValue(groupName) {
        const group = document.querySelector(`[data-name="${groupName}"]`);
        if (group) {
            const selectedOption = group.querySelector('.option.selected');
            return selectedOption ? selectedOption.dataset.value : null;
        }
        return null;
    }

    // 요구사항 포맷팅
    formatRequirements(priceRange, businessStatus) {
        const requirements = [];
        if (businessStatus) {
            requirements.push('영업 중');
        }
        return requirements.length > 0 ? requirements.join(', ') : '상관없음';
    }

    // 가격대 포맷팅
    formatPriceRange(priceRange) {
        if (!priceRange) return '상관없음';
        
        const priceMap = {
            'under_10000': '10,000원 이하',
            '10000_20000': '10,000원 ~ 20,000원',
            'over_20000': '20,000원 이상'
        };
        
        return priceMap[priceRange] || '상관없음';
    }

    // 프로필 데이터 포맷팅
    formatProfileData(data) {
        if (!data || !Array.isArray(data) || data.length === 0) return null;
        
        const dataMap = {
            // 알레르기
            'peanuts': '땅콩', 'tree_nuts': '견과류', 'milk': '우유', 'eggs': '계란',
            'fish': '생선', 'shellfish': '갑각류', 'soy': '콩', 'wheat': '밀', 'sesame': '참깨',
            // 질병
            'diabetes': '당뇨병', 'hypertension': '고혈압', 'heart_disease': '심장병',
            'kidney_disease': '신장병', 'liver_disease': '간 질환', 'osteoporosis': '골다공증',
            'anemia': '빈혈', 'thyroid_disorder': '갑상선 질환', 'gastritis': '위염', 'ibs': '과민성 대장 증후군'
        };
        
        return data.map(item => dataMap[item] || item).join(', ');
    }

    // 전화번호 포맷팅 (클릭 가능한 링크로 표시)
    formatPhoneNumber(restaurant) {
        const phone = restaurant.phone;
        
        // 모바일 환경 감지
        const isMobile = window.innerWidth <= 768;
        const isSmallMobile = window.innerWidth <= 480;
        
        const fontSize = isSmallMobile ? '13px' : isMobile ? '13px' : '13px';
        const marginBottom = isSmallMobile ? '2px' : isMobile ? '2px' : '4px';
        
        if (!phone || phone === '전화번호 없음' || phone === '정보 없음') {
            return `
                <div style="font-size:${fontSize};color:#666;margin-bottom:${marginBottom};">
                    <strong>전화:</strong> 정보 없음
                </div>
            `;
        }
        
        // 전화번호를 클릭 가능한 링크로 만들기
        const cleanPhone = phone.replace(/[^\d-+]/g, ''); // 숫자, 하이픈, + 기호만 남기기
        const telLink = `tel:${cleanPhone}`;
        
        return `
            <div style="font-size:${fontSize};color:#666;margin-bottom:${marginBottom};">
                <strong>전화:</strong> 
                <a href="${telLink}" style="color: #007bff; text-decoration: none;" 
                   onmouseover="this.style.textDecoration='underline'" 
                   onmouseout="this.style.textDecoration='none'">
                    ${phone}
                </a>
            </div>
        `;
    }

    // 영업시간 포맷팅 (드롭다운 기능 포함)
    formatOpeningHours(restaurant) {
        const googleHours = restaurant.googleOpeningHours;
        const basicHour = restaurant.openHour;
        const isOpenNow = restaurant.isOpenNow;
        
        // 모바일 환경 감지
        const isMobile = window.innerWidth <= 768;
        const isSmallMobile = window.innerWidth <= 480;
        
        const fontSize = isSmallMobile ? '13px' : isMobile ? '13px' : '13px';
        const marginBottom = isSmallMobile ? '2px' : isMobile ? '2px' : '4px';
        const buttonFontSize = isSmallMobile ? '12px' : isMobile ? '12px' : '12px';
        const buttonPadding = isSmallMobile ? '4px' : isMobile ? '4px 5px' : '4px 6px';
        
        // Google Places API에서 상세 영업시간이 있는 경우
        if (googleHours && Array.isArray(googleHours) && googleHours.length > 0) {
            const uniqueId = `hours_${Math.random().toString(36).substr(2, 9)}`;
            const firstDay = googleHours[0];
            const openStatus = isOpenNow === true ? ' <span style="color: #4CAF50;">🟢 영업중</span>' : 
                              isOpenNow === false ? ' <span style="color: #f44336;">🔴 영업종료</span>' : '';
            
            return `
                <div style="font-size:${fontSize};color:#666;margin-bottom:${marginBottom};">
                    <strong>영업시간:</strong> ${firstDay}${openStatus}
                    <button onclick="toggleOpeningHours('${uniqueId}')" 
                            style="margin-left: 6px; padding: ${buttonPadding}; font-size: ${buttonFontSize}; margin-top: 6px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 3px; cursor: pointer; color: #000;">
                        더보기 ▼
                    </button>
                    <div id="${uniqueId}" style="display: none; margin-top: 4px; padding: 6px; background: #f9f9f9; border-radius: 4px; border-left: 3px solid #007bff;">
                        ${googleHours.map(day => `<div style="margin-bottom: 2px;font-size:${fontSize};">${day}</div>`).join('')}
                    </div>
                </div>
            `;
        }
        // 기본 영업시간만 있는 경우
        else if (basicHour && basicHour !== '영업시간 정보 없음') {
            const openStatus = isOpenNow === true ? ' <span style="color: #4CAF50;">🟢 영업중</span>' : 
                              isOpenNow === false ? ' <span style="color: #f44336;">🔴 영업종료</span>' : '';
            
            return `
                <div style="font-size:${fontSize};color:#666;margin-bottom:${marginBottom};">
                    <strong>영업시간:</strong> ${basicHour}${openStatus}
                </div>
            `;
        }
        // 영업시간 정보가 없는 경우
        else {
            return `
                <div style="font-size:${fontSize};color:#666;margin-bottom:${marginBottom};">
                    <strong>영업시간:</strong> 정보 없음
                </div>
            `;
        }
    }

    // AI 추천 시작
    async startRecommendation() {
        if (!this.selectedLocation) {
            this.showMessage('위치 정보가 없습니다.', 'error');
            return;
        }
        
        const latitude = this.selectedLocation.getLat();
        const longitude = this.selectedLocation.getLng();
        
        // 새로운 요구사항 데이터 수집
        const priceRange = document.querySelector('input[name="price_range"]:checked')?.value;
        const businessOpen = document.querySelector('input[name="business_open"]:checked')?.value;
        const foodCategory = document.querySelector('input[name="food_category"]:checked')?.value;
        
        // 저장된 프로필 데이터 가져오기
        const savedProfile = localStorage.getItem('pendingProfile');
        let profileData = {};
        if (savedProfile) {
            profileData = JSON.parse(savedProfile);
        }
        
        // 로딩 시작
        this.setLoadingState(true);
        this.updateLoadingProgress('주변 식당 검색 중...', 0);
        
        // 진행 상황 업데이트를 위한 타이머 설정
        const progressTimer = setInterval(() => {
            const loading = document.getElementById('loading');
            if (loading && loading.style.display === 'none') {
                clearInterval(progressTimer);
                return;
            }
            
            // 현재 단계에 따라 메시지 업데이트
            const currentTime = Date.now();
            const elapsed = Math.floor((currentTime - startTime) / 1000);
            
            if (elapsed > 30) {
                this.updateLoadingProgress('AI 추천 분석 중...', 2);
            } else if (elapsed > 15) {
                this.updateLoadingProgress('실시간 정보 검색 중...', 1);
            } else {
                this.updateLoadingProgress('주변 식당 검색 중...', 0);
            }
        }, 3000);
        
        const startTime = Date.now();
        
        try {
            // 사용자 프로필 구성
            const userProfile = {
                age: profileData.age,
                gender: profileData.gender,
                activity_level: profileData.activity_level,
                allergies: profileData.allergies || [],
                healthStatus: profileData.illnesses || [],
                preferences: [],
                budget: priceRange === 'under_10000' ? 10000 : 
                        priceRange === '10000_20000' ? 15000 : 
                        priceRange === 'over_20000' ? 25000 : null
            };
            
            // 요구사항 구성
            const requirements = {
                priceRange: priceRange,
                businessOpen: !!businessOpen,
                foodCategory: foodCategory
            };
            
            // 통합 API 호출
            const response = await fetch('/api/restaurants/integrated', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    latitude: parseFloat(latitude),
                    longitude: parseFloat(longitude),
                    userProfile: userProfile,
                    requirements: requirements
                })
            });
            
            const result = await response.json();
            console.log('API 응답:', result);
            
            if (result.success) {
                console.log('성공 응답, displayRecommendations 호출');
                this.displayRecommendations(result);
            } else {
                console.log('실패 응답:', result.error);
                this.showMessage(result.error || '추천 중 오류가 발생했습니다.', 'error');
            }
            
            // 응답이 없거나 예상치 못한 형식인 경우 처리
            if (!result) {
                console.log('응답이 없습니다.');
                this.showMessage('서버에서 응답을 받지 못했습니다.', 'error');
            }
            
        } catch (error) {
            console.error('추천 오류:', error);
            this.showMessage('서버 연결 오류가 발생했습니다.', 'error');
        } finally {
            // 타이머 정리
            if (typeof progressTimer !== 'undefined') {
                clearInterval(progressTimer);
            }
            this.setLoadingState(false);
        }
    }

    // 로딩 상태 설정
    setLoadingState(isLoading) {
        const recommendBtn = document.getElementById('recommendBtn');
        const loading = document.getElementById('loading');
        const step4 = document.getElementById('step4');
        const step5 = document.getElementById('step5');
        const resultContainer = document.getElementById('resultContainer');
        
        if (recommendBtn) {
            recommendBtn.disabled = isLoading;
        }
        
        if (loading) {
            loading.style.display = isLoading ? 'block' : 'none';
        }
        
        // 로딩 시작할 때 5단계로 이동
        if (isLoading) {
            if (step4) step4.style.display = 'none';
            if (step5) step5.style.display = 'block';
            if (resultContainer) resultContainer.style.display = 'none';
        }
    }

    // 로딩 진행 상황 업데이트
    updateLoadingProgress(message, step) {
        const loading = document.getElementById('loading');
        if (loading) {
            const steps = [
                '🔍 주변 식당 검색 중...',
                '📊 실시간 정보 검색 중...',
                '🤖 AI 추천 분석 중...',
            ];
            
            let html = '<div class="restaurant-loading-spinner"></div>';
            steps.forEach((stepText, index) => {
                const isActive = index === step;
                const isCompleted = index < step;
                const status = isCompleted ? 'completed' : isActive ? 'active' : 'pending';
                
                html += `
                    <div class="restaurant-loading-step ${status}">
                        <span class="restaurant-step-icon">
                            ${isCompleted ? '✅' : isActive ? '🔄' : '⏳'}
                        </span>
                        <span class="restaurant-step-text">${stepText}</span>
                    </div>
                `;
            });
            
            loading.innerHTML = html;
        }
    }

    // 추천 결과 표시
    displayRecommendations(result) {
        console.log('displayRecommendations 호출됨:', result);
        
        const container = document.getElementById('recommendationResults');
        const resultContainer = document.getElementById('resultContainer');
        const step4 = document.getElementById('step4');
        const step5 = document.getElementById('step5');
        
        console.log('컨테이너 요소들:', { container, resultContainer, step4, step5 });
        
        if (!container) {
            console.error('recommendationResults 컨테이너를 찾을 수 없습니다.');
            return;
        }
        
        if (!resultContainer) {
            console.error('resultContainer를 찾을 수 없습니다.');
            return;
        }
        
        if (result.error) {
            console.log('에러 결과 표시:', result.error);
            container.innerHTML = `<div class="error">${result.error}</div>`;
            resultContainer.style.display = 'block';
            if (step4) step4.style.display = 'none';
            if (step5) step5.style.display = 'none';
            return;
        }
        
        console.log('성공 결과 표시:', result);
        
        let html = `
            <div class="recommendation-result">
                <div class="result-message">
                    <span class="result-count">${result.recommendations.length}곳</span>의 맛집을 찾았어요!
                </div>
                <div class="result-guide">
                    지도의 번호를 클릭하면 상세 정보를 볼 수 있습니다
                </div>
            </div>
        `;
        
        // 카카오 지도 섹션 추가
        html += `
            <div class="recommendation-map-section">
                <h3>🗺️ 추천 식당 위치</h3>
                <div id="recommendationMap" class="recommendation-map"></div>
            </div>
        `;
        
        // 식당 카드 슬라이더 추가
        html += `
            <div class="restaurant-slider-container">
                <h3>🍽️ 추천 식당</h3>
                <div class="restaurant-slider-indicators">
        `;
        
        // 인디케이터 추가
        result.recommendations.forEach((_, index) => {
            html += `<div class="restaurant-slider-dot ${index === 0 ? 'active' : ''}" onclick="goToRestaurantSlide(${index})"></div>`;
        });
        
        html += `
                </div>
                <div class="restaurant-slider-wrapper">
                    <button class="restaurant-slider-arrow prev" onclick="slideRestaurants('prev')">
                        <span>‹</span>
                    </button>
                    <div class="restaurant-slider">
                        <div class="restaurant-slides">
        `;
        
        result.recommendations.forEach((restaurant, index) => {
            html += this.createRestaurantCard(restaurant, index + 1);
        });
        
        html += `
                        </div>
                    </div>
                    <button class="restaurant-slider-arrow next" onclick="slideRestaurants('next')">
                        <span>›</span>
                    </button>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        resultContainer.style.display = 'block';
        if (step4) step4.style.display = 'none';
        if (step5) step5.style.display = 'none';
        
        // 지도 초기화 및 마커 표시
        this.initializeRecommendationMap(result.recommendations);
        
        // 슬라이더 초기화
        this.initializeRestaurantSlider();
        
        console.log('결과 표시 완료');
    }

    // 추천 결과용 지도 초기화
    initializeRecommendationMap(recommendations) {
        if (typeof kakao === 'undefined') {
            console.error('카카오 지도 API가 로드되지 않았습니다.');
            return;
        }

        const mapContainer = document.getElementById('recommendationMap');
        if (!mapContainer) {
            console.error('recommendationMap 컨테이너를 찾을 수 없습니다.');
            return;
        }

        // 사용자 위치 (선택된 위치)
        const userLat = this.selectedLocation.getLat();
        const userLng = this.selectedLocation.getLng();

        // 지도 초기화
        const mapOption = {
            center: new kakao.maps.LatLng(userLat, userLng),
            level: 3
        };

        const recommendationMap = new kakao.maps.Map(mapContainer, mapOption);

        // 사용자 위치 마커 (파란색)
        const userMarker = new kakao.maps.Marker({
            position: new kakao.maps.LatLng(userLat, userLng),
            map: recommendationMap
        });

        // 사용자 위치 마커 스타일 설정
        const userMarkerImage = new kakao.maps.MarkerImage(
            'data:image/svg+xml;base64,' + btoa(`
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="8" fill="#4285F4" stroke="white" stroke-width="2"/>
                    <circle cx="12" cy="12" r="3" fill="white"/>
                </svg>
            `),
            new kakao.maps.Size(24, 24)
        );
        userMarker.setImage(userMarkerImage);

        // 사용자 위치 인포윈도우 (모바일 환경 고려)
        const isMobile = window.innerWidth <= 768;
        const isSmallMobile = window.innerWidth <= 480;
        const userInfoFontSize = isSmallMobile ? '10px' : isMobile ? '11px' : '12px';
        const userInfoPadding = isSmallMobile ? '3px' : isMobile ? '4px' : '5px';
        
        const userInfoWindow = new kakao.maps.InfoWindow({
            content: `<div style="padding:${userInfoPadding};font-size:${userInfoFontSize};font-weight:bold;color:#4285F4;">내 위치</div>`
        });
        userInfoWindow.open(recommendationMap, userMarker);
        
        // 사용자 위치 마커 클릭 시 인포윈도우 토글
        kakao.maps.event.addListener(userMarker, 'click', function() {
            const isOpen = userInfoWindow.getMap() !== null;
            
            if (isOpen) {
                userInfoWindow.close();
            } else {
                userInfoWindow.open(recommendationMap, userMarker);
            }
        });

        // 추천 식당 마커들 (빨간색)
        recommendations.forEach((restaurant, index) => {
            // 식당의 좌표 정보 확인
            let restaurantLat, restaurantLng;
            
            if (restaurant.x && restaurant.y) {
                // 카카오 API에서 받은 좌표 사용
                restaurantLng = parseFloat(restaurant.x);
                restaurantLat = parseFloat(restaurant.y);
            } else if (restaurant.latitude && restaurant.longitude) {
                // 다른 형태의 좌표 정보
                restaurantLat = parseFloat(restaurant.latitude);
                restaurantLng = parseFloat(restaurant.longitude);
            } else {
                // 좌표 정보가 없으면 건너뛰기
                console.log(`식당 ${restaurant.name || restaurant.place_name}의 좌표 정보가 없습니다.`);
                return;
            }

            // 식당 마커 생성
            const restaurantMarker = new kakao.maps.Marker({
                position: new kakao.maps.LatLng(restaurantLat, restaurantLng),
                map: recommendationMap
            });

            // 식당 마커 스타일 설정 (번호 포함)
            const markerNumber = index + 1;
            const restaurantMarkerImage = new kakao.maps.MarkerImage(
                'data:image/svg+xml;base64,' + btoa(`
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="16" cy="16" r="12" fill="#EA4335" stroke="white" stroke-width="2"/>
                        <text x="16" y="20" text-anchor="middle" fill="white" font-size="12" font-weight="bold">${markerNumber}</text>
                    </svg>
                `),
                new kakao.maps.Size(32, 32)
            );
            restaurantMarker.setImage(restaurantMarkerImage);

            // 식당 정보 인포윈도우 (더 자세한 정보 포함)
            const restaurantName = restaurant.name || restaurant.place_name || '식당명 없음';
            const restaurantAddress = restaurant.road_address_name || restaurant.address || restaurant.address_name || '주소 정보 없음';
            const distance = restaurant.distance_m ? `${restaurant.distance_m}m` : '거리 정보 없음';
            // 전화번호 정보 처리
            const phoneHtml = this.formatPhoneNumber(restaurant);
            const category = restaurant.category || restaurant.category_name || '카테고리 없음';
            // 영업시간 정보 처리
            const openingHoursHtml = this.formatOpeningHours(restaurant);
            
            // 모바일 환경 감지
            const isMobile = window.innerWidth <= 768;
            const isSmallMobile = window.innerWidth <= 480;
            
            // AI 추천 메뉴 정보
            let menuInfo = '';
            if (restaurant.recommendedMenus && restaurant.recommendedMenus.length > 0) {
                const menuFontSize = isSmallMobile ? '8px' : isMobile ? '9px' : '11px';
                const menuMarginTop = isSmallMobile ? '6px' : isMobile ? '6px' : '8px';
                
                menuInfo = `<div style="margin-top:${menuMarginTop};font-size:${menuFontSize};color:#666;">`;
                menuInfo += '<strong>추천 메뉴:</strong><br>';
                restaurant.recommendedMenus.slice(0, 2).forEach(menu => {
                    if (typeof menu === 'object' && menu.name) {
                        menuInfo += `• ${menu.name}${menu.price ? ` (${menu.price})` : ''}<br>`;
                    } else {
                        menuInfo += `• ${menu}<br>`;
                    }
                });
                if (restaurant.recommendedMenus.length > 2) {
                    menuInfo += `... 외 ${restaurant.recommendedMenus.length - 2}개`;
                }
                menuInfo += '</div>';
            }
            
            // 모바일 환경에 따른 스타일 조정
            const containerStyle = isSmallMobile 
                ? 'padding:6px;min-width:180px;max-width:240px;'
                : isMobile 
                ? 'padding:8px;min-width:200px;max-width:280px;'
                : 'padding:12px;min-width:250px;max-width:300px;';
            
            const titleStyle = isSmallMobile
                ? 'font-weight:bold;color:#EA4335;margin-bottom:3px;font-size:11px;'
                : isMobile
                ? 'font-weight:bold;color:#EA4335;margin-bottom:4px;font-size:12px;'
                : 'font-weight:bold;color:#EA4335;margin-bottom:6px;font-size:14px;';
            
            const textStyle = isSmallMobile
                ? 'font-size:9px;color:#666;margin-bottom:2px;'
                : isMobile
                ? 'font-size:10px;color:#666;margin-bottom:2px;'
                : 'font-size:12px;color:#666;margin-bottom:4px;';
            
            const menuStyle = isSmallMobile
                ? 'margin-top:6px;font-size:8px;color:#666;'
                : isMobile
                ? 'margin-top:6px;font-size:9px;color:#666;'
                : 'margin-top:8px;font-size:11px;color:#666;';
            
            const reasonStyle = isSmallMobile
                ? 'margin-top:6px;font-size:8px;color:#4a69bd;font-style:italic;'
                : isMobile
                ? 'margin-top:6px;font-size:9px;color:#4a69bd;font-style:italic;'
                : 'margin-top:8px;font-size:11px;color:#4a69bd;font-style:italic;';
            
            const infoContent = `
                <div style="${containerStyle}">
                    <div style="${titleStyle}">
                        ${markerNumber}. ${restaurantName}
                    </div>
                    <div style="${textStyle}">
                        <strong>주소:</strong> ${restaurantAddress}
                    </div>
                    <div style="${textStyle}">
                        <strong>거리:</strong> ${distance}
                    </div>
                    ${phoneHtml}
                    <div style="${textStyle}">
                        <strong>카테고리:</strong> ${category}
                    </div>
                    ${openingHoursHtml}
                    ${menuInfo}
                    ${restaurant.reason ? `<div style="${reasonStyle}">💡 ${restaurant.reason}</div>` : ''}
                </div>
            `;

            const restaurantInfoWindow = new kakao.maps.InfoWindow({
                content: infoContent
            });

            // 마커 클릭 시 인포윈도우 토글 (열기/닫기)
            kakao.maps.event.addListener(restaurantMarker, 'click', function() {
                // 현재 열린 인포윈도우가 있는지 확인
                const isOpen = restaurantInfoWindow.getMap() !== null;
                
                if (isOpen) {
                    // 이미 열려있으면 닫기
                    restaurantInfoWindow.close();
                } else {
                    // 닫혀있으면 열기
                    restaurantInfoWindow.open(recommendationMap, restaurantMarker);
                }
            });
        });

        // 모든 마커가 보이도록 지도 범위 조정
        const bounds = new kakao.maps.LatLngBounds();
        bounds.extend(new kakao.maps.LatLng(userLat, userLng));
        
        recommendations.forEach(restaurant => {
            if (restaurant.x && restaurant.y) {
                bounds.extend(new kakao.maps.LatLng(parseFloat(restaurant.y), parseFloat(restaurant.x)));
            } else if (restaurant.latitude && restaurant.longitude) {
                bounds.extend(new kakao.maps.LatLng(parseFloat(restaurant.latitude), parseFloat(restaurant.longitude)));
            }
        });

        recommendationMap.setBounds(bounds);
        
        // 지도 범위 조정 후 약간의 여백 추가
        setTimeout(() => {
            const currentBounds = recommendationMap.getBounds();
            const sw = currentBounds.getSouthWest();
            const ne = currentBounds.getNorthEast();
            const latDiff = (ne.getLat() - sw.getLat()) * 0.1;
            const lngDiff = (ne.getLng() - sw.getLng()) * 0.1;
            
            const newBounds = new kakao.maps.LatLngBounds(
                new kakao.maps.LatLng(sw.getLat() - latDiff, sw.getLng() - lngDiff),
                new kakao.maps.LatLng(ne.getLat() + latDiff, ne.getLng() + lngDiff)
            );
            recommendationMap.setBounds(newBounds);
        }, 100);
    }

    // 식당 슬라이더 초기화
    initializeRestaurantSlider() {
        this.currentSlide = 0;
        this.totalSlides = document.querySelectorAll('.restaurant-slide').length;
        
        // 첫 번째 슬라이드만 표시
        this.updateSliderDisplay();
        this.updateSliderArrows();
    }

    // 슬라이더 표시 업데이트
    updateSliderDisplay() {
        const slides = document.querySelectorAll('.restaurant-slide');
        const dots = document.querySelectorAll('.restaurant-slider-dot');
        
        slides.forEach((slide, index) => {
            slide.style.display = index === this.currentSlide ? 'block' : 'none';
        });
        
        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === this.currentSlide);
        });
    }

    // 슬라이더 화살표 업데이트
    updateSliderArrows() {
        const prevArrow = document.querySelector('.restaurant-slider-arrow.prev');
        const nextArrow = document.querySelector('.restaurant-slider-arrow.next');
        
        if (prevArrow) {
            prevArrow.disabled = this.currentSlide === 0;
        }
        
        if (nextArrow) {
            nextArrow.disabled = this.currentSlide === this.totalSlides - 1;
        }
    }

    // 슬라이드 이동
    slideRestaurants(direction) {
        if (direction === 'prev' && this.currentSlide > 0) {
            this.currentSlide--;
        } else if (direction === 'next' && this.currentSlide < this.totalSlides - 1) {
            this.currentSlide++;
        }
        
        this.updateSliderDisplay();
        this.updateSliderArrows();
    }

    // 특정 슬라이드로 이동
    goToRestaurantSlide(index) {
        if (index >= 0 && index < this.totalSlides) {
            this.currentSlide = index;
            this.updateSliderDisplay();
            this.updateSliderArrows();
        }
    }

    // 식당 카드 생성
    createRestaurantCard(restaurant, index) {
        // AI 추천 메뉴가 있으면 표시
        const recommendedMenusHtml = restaurant.recommendedMenus && restaurant.recommendedMenus.length > 0 ?
            this.createRecommendedMenusSection(restaurant.recommendedMenus, restaurant) : '';
        
        // 메뉴 정보 섹션 (AI 추천 메뉴가 있으면 숨김)
        const menuHtml = restaurant.menus && restaurant.menus.length > 0 ? 
            this.createMenuSection(restaurant.menus) : 
            (restaurant.recommendedMenus && restaurant.recommendedMenus.length > 0 ? 
                '' : // AI 추천 메뉴가 있으면 메뉴 정보 섹션 숨김
                '<div class="menu-section"><p>메뉴 정보가 없습니다.</p></div>'
            );
        
        // 건강 고려사항 표시
        const healthConsiderationsHtml = restaurant.healthConsiderations ?
            `<div class="health-considerations">
                <h4>🏥 건강 고려사항</h4>
                <p>${restaurant.healthConsiderations}</p>
            </div>` : '';
        
        return `
            <div class="restaurant-slide">
                <div class="restaurant-card">
                    <div class="restaurant-header">
                        <div class="restaurant-name">
                            ${index}. ${restaurant.name || restaurant.place_name}
                        </div>
                        ${restaurant.reason ? `<div class="recommendation-reason">${this.formatRecommendationReason(restaurant.reason)}</div>` : ''}
                    </div>
                    
                    <div class="restaurant-info">
                        <div><strong>주소:</strong> ${restaurant.road_address_name || restaurant.address || restaurant.address_name || '정보 없음'}</div>
                        ${this.formatPhoneNumber(restaurant)}
                        <div><strong>구글 리뷰:</strong> ${restaurant.googleRating && restaurant.googleRating !== '정보 없음' ? `⭐ ${restaurant.googleRating}${restaurant.reviewCount ? ` (${restaurant.reviewCount}개 리뷰)` : ''}` : '정보 없음'}</div>
                        <div><strong>거리:</strong> ${restaurant.distance_m && restaurant.distance_m > 0 ? `${restaurant.distance_m}m` : '정보 없음'}</div>
                        ${restaurant.category ? `<div><strong>카테고리:</strong> ${restaurant.category}</div>` : ''}
                        ${this.formatOpeningHours(restaurant)}
                    </div>
                    
                    ${recommendedMenusHtml}
                    ${healthConsiderationsHtml}
                    ${menuHtml}
                </div>
            </div>
        `;
    }

    // AI 추천 메뉴 섹션 생성
    createRecommendedMenusSection(recommendedMenus, restaurant) {
        // 로그인 상태 확인
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        const isLoggedIn = !!user;
        
        let html = '<div class="recommended-menus-section';
        
        // 비로그인 상태면 블러 클래스 추가
        if (!isLoggedIn) {
            html += ' login-required-blur" style="position: relative;';
        } else {
            html += '"';
        }
        
        html += '><h4>🍽️ AI 추천 메뉴</h4>';
        
        recommendedMenus.forEach(menu => {
            // 메뉴가 객체인지 문자열인지 확인
            if (typeof menu === 'object' && menu.name) {
                // 객체 형태: {name: "메뉴명", price: "가격"}
                html += `
                    <div class="recommended-menu-item">
                        <span class="menu-name">${menu.name}</span>
                        ${menu.price ? `<span class="menu-price">${menu.price}</span>` : ''}
                    </div>
                `;
            } else {
                // 문자열 형태: "메뉴명" (기존 호환성)
                html += `
                    <div class="recommended-menu-item">
                        <span class="menu-name">${menu}</span>
                    </div>
                `;
            }
        });
        
        // 비로그인 상태면 오버레이 추가
        if (!isLoggedIn) {
            html += `
                <div class="login-required-overlay">
                    <div class="login-required-message">
                        <span class="lock-icon">🔑</span>
                        <span class="message-text">로그인하고 모든 기능을 이용해 보세요</span>
                    </div>
                </div>
            `;
        }
        
        html += '</div>';  // recommended-menus-section 닫기
        
        return html;
    }

    // 추천 이유 키워드 블록화 처리
    formatRecommendationReason(reason) {
        if (!reason) return '';
        
        // #으로 시작하는 키워드들을 찾아서 블록으로 변환
        const keywordRegex = /#([^#\s]+)/g;
        let keywordIndex = 0;
        const formattedReason = reason.replace(keywordRegex, (match, keyword) => {
            // 키워드별로 다른 색상 클래스 적용
            const colorClasses = ['keyword-blue', 'keyword-green', 'keyword-purple', 'keyword-orange', 'keyword-pink'];
            const colorClass = colorClasses[keywordIndex % colorClasses.length];
            keywordIndex++;
            return `<span class="recommendation-keyword ${colorClass}">#${keyword}</span>`;
        });
        
        return formattedReason;
    }

    // 메뉴 섹션 생성
    createMenuSection(menus) {
        let html = '<div class="menu-section"><h4>📋 메뉴 정보</h4>';
        
        menus.forEach(menu => {
            html += `
                <div class="menu-item">
                    <div class="menu-name">${menu.name || '메뉴명 없음'}</div>
                    ${menu.price ? `<div class="menu-price">${menu.price}원</div>` : ''}
                    ${menu.description ? `<div class="menu-desc">${menu.description}</div>` : ''}
                </div>
            `;
        });
        
        html += '</div>';
        return html;
    }

    // 메시지 표시 (토스트 스타일)
    showMessage(message, type) {
        // 중복 메시지 방지: 같은 메시지가 이미 표시 중인지 확인
        const existingToasts = document.querySelectorAll('.toast-message');
        for (let toast of existingToasts) {
            if (toast.textContent === message) {
                return; // 같은 메시지가 이미 표시 중이면 추가하지 않음
            }
        }
        
        // 토스트 컨테이너 확인 또는 생성
        let toastContainer = document.querySelector('.toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container';
            document.body.appendChild(toastContainer);
        }
        
        // 토스트 메시지 생성
        const toast = document.createElement('div');
        toast.className = `toast-message toast toast-${type}`;
        toast.textContent = message;
        
        // 토스트 컨테이너에 추가
        toastContainer.appendChild(toast);
        
        // 애니메이션을 위한 지연
        setTimeout(() => {
            toast.classList.add('show');
        }, 100);
        
        // 5초 후 제거
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 5000);
    }

    // 다시 시작
    restartRecommendation() {
        this.currentStep = 1;
        this.totalSteps = 5; // 5단계까지 포함 (로딩 단계 포함)
        this.selectedLocation = null;
        
        // 결과 숨기기
        const resultContainer = document.getElementById('resultContainer');
        if (resultContainer) {
            resultContainer.style.display = 'none';
        }
        
        // 5단계 숨기기
        const step5 = document.getElementById('step5');
        if (step5) {
            step5.style.display = 'none';
        }
        
        // 모든 단계 숨기기 (1~4단계)
        for (let i = 1; i <= 4; i++) {
            const stepContent = document.getElementById(`step${i}`);
            if (stepContent) {
                stepContent.classList.remove('active');
            }
        }
        
        // 첫 번째 단계만 표시
        const step1 = document.getElementById('step1');
        if (step1) {
            step1.classList.add('active');
        }
        
        // 위치 확인 버튼 비활성화
        const confirmBtn = document.getElementById('confirmLocationBtn');
        if (confirmBtn) {
            confirmBtn.disabled = true;
        }
        
        // 폼 데이터 초기화
        this.resetFormData();
        
        // 프로필 정보는 기존 데이터 유지 (서버에서 다시 로드)
        this.loadUserProfile();
        
        // 프로필 진행률 초기화
        this.updateProfileProgress(1);
        this.showProfileSection(1);
    }

    // 프로필 섹션 네비게이션
    nextProfileSection(currentSection) {
        if (this.validateProfileSection()) {
            const nextSection = currentSection + 1;
            if (nextSection <= 3) {
                this.showProfileSection(nextSection);
                this.updateProfileProgress(nextSection);
            } else {
                // 프로필 완료, 다음 단계로 이동
                this.nextStep();
            }
        }
    }

    prevProfileSection(currentSection) {
        const prevSection = currentSection - 1;
        if (prevSection >= 1) {
            this.showProfileSection(prevSection);
            this.updateProfileProgress(prevSection);
        } else {
            // 첫 번째 섹션에서 이전 버튼 클릭 시 이전 단계로 이동
            this.prevStep();
        }
    }

    showProfileSection(sectionNumber) {
        // 모든 프로필 섹션 숨기기
        for (let i = 1; i <= 3; i++) {
            const section = document.getElementById(`profileSection${i}`);
            if (section) {
                section.classList.remove('active');
            }
        }
        
        // 현재 섹션만 표시
        const currentSection = document.getElementById(`profileSection${sectionNumber}`);
        if (currentSection) {
            currentSection.classList.add('active');
        }
    }

    updateProfileProgress(currentSection) {
        const progressSteps = document.querySelectorAll('#step2 .progress-step');
        const progressBar = document.getElementById('profileProgressBar');
        
        // 프로그레스 스텝 업데이트 - 식단 추천과 동일한 방식
        progressSteps.forEach((step, index) => {
            step.classList.toggle('active', index + 1 <= currentSection);
        });
        
        // 프로그레스바 업데이트 - 식단 추천과 동일한 방식
        if (progressBar) {
            const progressPercentage = ((currentSection - 1) / 2) * 100;
            progressBar.style.width = `${progressPercentage}%`;
        }
    }

    // 프로필 저장
    async saveProfile(event) {
        event.preventDefault();
        
        if (this.validateProfileSection()) {
            // 프로필 데이터 수집
            const profileData = this.collectProfileData();
            
            try {
                // 로그인 상태 확인
                const authRes = await fetch('/api/auth/me', { credentials: 'include' });
                const authData = await authRes.json();
                
                if (authData.loggedIn) {
                    // 로그인 상태: 서버에 프로필 저장
                    const saveRes = await fetch('/api/profile', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify(profileData)
                    });
                    
                    if (saveRes.ok) {
                        this.showMessage('프로필이 성공적으로 저장되었습니다!', 'success');
                        // 다음 단계로 이동
                        this.nextStep();
                    } else {
                        this.showMessage('프로필 저장에 실패했습니다.', 'error');
                        return;
                    }
                } else {
                    // 비로그인 상태: 모달 표시
                    this.showProfileSaveModal(profileData);
                }
            } catch (error) {
                console.error('프로필 저장 오류:', error);
                this.showMessage('프로필 저장 중 오류가 발생했습니다.', 'error');
            }
        }
    }

    // 프로필 저장 선택 모달 표시
    showProfileSaveModal(profileData) {
        const modal = document.getElementById('profileSaveModal');
        modal.style.display = 'flex';
        
        // 모달 배경 클릭 시 닫기
        modal.onclick = function(e) {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        };
        
        // 임시저장 버튼 이벤트
        document.getElementById('tempSaveBtn').onclick = () => {
            localStorage.setItem('restaurantProfile', JSON.stringify(profileData));
            modal.style.display = 'none';
            this.showMessage('프로필이 임시 저장되었습니다.', 'success');
            
            // 다음 단계로 이동
            this.nextStep();
        };
        
        // 로그인 후 저장 버튼 이벤트
        document.getElementById('saveAfterLoginBtn').onclick = () => {
            localStorage.setItem('pendingProfile', JSON.stringify(profileData));
            modal.style.display = 'none';
            window.location.href = 'login.html?afterProfileSave=1';
        };
    }
    
    // 프로필 저장 모달 닫기 함수
    closeProfileSaveModal() {
        const modal = document.getElementById('profileSaveModal');
        modal.style.display = 'none';
    }

    // 폼 데이터 초기화
    resetFormData() {
        // 3단계 폼 데이터만 초기화 (프로필 폼은 유지)
        const priceRangeInputs = document.querySelectorAll('input[name="price_range"]');
        priceRangeInputs.forEach(input => {
            input.checked = false;
        });
        
        const foodCategoryInputs = document.querySelectorAll('input[name="food_category"]');
        foodCategoryInputs.forEach(input => {
            input.checked = false;
        });
        
        const businessOpenInput = document.querySelector('input[name="business_open"]');
        if (businessOpenInput) {
            businessOpenInput.checked = false;
        }
        
        // 프로필 폼은 리셋하지 않음 - 사용자 입력 정보 유지
    }

    // 프로필 데이터 수집
    collectProfileData() {
        const form = document.getElementById('profileForm');
        const obj = {};
        
        // 폼의 모든 input, select, textarea 요소만 수집
        const formElements = form.querySelectorAll('input, select, textarea');
        
        formElements.forEach(element => {
            const name = element.name;
            if (!name) return; // name이 없는 요소는 건너뛰기
            
            if (element.type === 'select-multiple') {
                // 멀티셀렉트 처리
                const selectedValues = Array.from(element.selectedOptions).map(option => option.value);
                obj[name] = selectedValues;
            } else if (element.type === 'checkbox') {
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
        document.querySelectorAll('.option-group[data-name="biomarkers"] .option.selected').forEach(option => {
            const dataValue = option.dataset.value;
            if (dataValue !== 'other_biomarker_toggle' && dataValue !== 'none') {
                const inputElement = option.querySelector('.value-input');
                if (inputElement && inputElement.value.trim()) {
                    specificBiomarkers[dataValue] = inputElement.value.trim();
                }
            }
        });
        
        // 건강기능식품 값 수집
        document.querySelectorAll('.option-group[data-name="supplements"] .option.selected').forEach(option => {
            const dataValue = option.dataset.value;
            if (dataValue !== 'other_supplement_toggle' && dataValue !== 'none') {
                const inputElement = option.querySelector('.value-input');
                if (inputElement && inputElement.value.trim()) {
                    specificSupplements[dataValue] = inputElement.value.trim();
                }
            }
        });
        
        // 단일 선택 그룹 정의
        const singleSelectGroups = [
            'gender', 'activity_level', 'eating_patterns', 'sleep_patterns', 
            'meals_per_day', 'alcohol_consumption', 'smoking_status'
        ];

        // option-group 데이터 수집
        document.querySelectorAll('.option-group').forEach(group => {
            const dataName = group.dataset.name;
            const selectedOptions = Array.from(group.querySelectorAll('.option.selected'))
                .map(option => option.dataset.value)
                .filter(value => !['other_allergy_toggle', 'other_illness_toggle', 'other_biomarker_toggle', 'other_supplement_toggle'].includes(value));
            
            if (singleSelectGroups.includes(dataName)) {
                // 단일 선택 그룹: 첫 번째 선택된 값만 저장
                obj[dataName] = selectedOptions.length > 0 ? selectedOptions[0] : null;
            } else {
                // 다중 선택 그룹: 배열로 저장
                obj[dataName] = selectedOptions;
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

    // placeholder 관리 초기화
    initializePlaceholderManagement() {
        this.updatePlaceholder();
        this.bindPlaceholderEvents();
    }

    // placeholder 업데이트
    updatePlaceholder() {
        const addressSearchInput = document.getElementById('addressSearch');
        if (!addressSearchInput) return;

        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        
        if (isMobile) {
            addressSearchInput.placeholder = '예: 강남구, 역삼동, 테헤란로';
        } else {
            addressSearchInput.placeholder = '주소를 입력하세요 (구/동/도로명 중 하나, 예: 강남구, 역삼동, 테헤란로)';
        }
    }

    // placeholder 이벤트 바인딩
    bindPlaceholderEvents() {
        const mediaQuery = window.matchMedia('(max-width: 768px)');
        
        // 미디어 쿼리 변화 감지
        const handleMediaChange = (e) => {
            this.updatePlaceholder();
        };

        // 이벤트 리스너 등록
        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', handleMediaChange);
        } else {
            // 구형 브라우저 지원
            mediaQuery.addListener(handleMediaChange);
        }

        // 윈도우 리사이즈 이벤트 (추가 보장)
        window.addEventListener('resize', () => {
            this.updatePlaceholder();
        });
    }
}

// 전역 함수들 (기존 코드와의 호환성을 위해)
function getCurrentLocation() {
    if (window.restaurantRecommendation) {
        window.restaurantRecommendation.getCurrentLocation();
    }
}

function confirmLocation() {
    if (window.restaurantRecommendation) {
        window.restaurantRecommendation.confirmLocation();
    }
}

function nextStep() {
    if (window.restaurantRecommendation) {
        window.restaurantRecommendation.nextStep();
    }
}

function prevStep() {
    if (window.restaurantRecommendation) {
        window.restaurantRecommendation.prevStep();
    }
}

function startRecommendation() {
    if (window.restaurantRecommendation) {
        window.restaurantRecommendation.startRecommendation();
    }
}

function restartRecommendation() {
    if (window.restaurantRecommendation) {
        window.restaurantRecommendation.restartRecommendation();
    }
}

// 영업시간 드롭다운 토글 함수
function toggleOpeningHours(uniqueId) {
    const element = document.getElementById(uniqueId);
    const button = element.previousElementSibling;
    
    if (element.style.display === 'none') {
        element.style.display = 'block';
        button.innerHTML = '접기 ▲';
    } else {
        element.style.display = 'none';
        button.innerHTML = '더보기 ▼';
    }
}

// 슬라이더 관련 전역 함수들
function slideRestaurants(direction) {
    if (window.restaurantRecommendation) {
        window.restaurantRecommendation.slideRestaurants(direction);
    }
}

function goToRestaurantSlide(index) {
    if (window.restaurantRecommendation) {
        window.restaurantRecommendation.goToRestaurantSlide(index);
    }
}

// 프로필 섹션 네비게이션 함수들
function nextRestaurantProfileSection(currentSection) {
    if (window.restaurantRecommendation) {
        window.restaurantRecommendation.nextProfileSection(currentSection);
    }
}

function prevRestaurantProfileSection(currentSection) {
    if (window.restaurantRecommendation) {
        window.restaurantRecommendation.prevProfileSection(currentSection);
    }
}

async function saveRestaurantProfile(event) {
    if (window.restaurantRecommendation) {
        await window.restaurantRecommendation.saveProfile(event);
    }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    window.restaurantRecommendation = new RestaurantRecommendation();
}); 
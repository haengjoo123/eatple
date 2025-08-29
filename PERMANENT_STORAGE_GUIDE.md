# 영구 저장소 관리 가이드

## 개요

건강기능식품 API 데이터를 영구적으로 저장하고 관리하는 시스템입니다. 이 시스템은 API 연결 없이도 데이터를 사용할 수 있도록 하며, 기존 캐시와 별도로 관리됩니다.

## 주요 기능

### 1. 영구 저장소 (Permanent Storage)
- **위치**: `data/permanent-storage/health_functional_foods_permanent.json`
- **특징**: 
  - API 연결 없이 사용 가능
  - 만료되지 않는 영구 저장
  - 13,000개 제품 데이터 저장 (약 18MB)
  - 최적화된 데이터 구조

### 2. 기존 캐시 (Cache)
- **위치**: `data/cache/food_safety_products.json`
- **특징**:
  - 24시간 TTL (Time To Live)
  - API 호출 시 자동 갱신
  - 임시 저장소

## 사용 방법

### 1. 명령줄 도구 사용

#### 상태 확인
```bash
node scripts/manage-permanent-storage.js status
```

#### 기존 캐시를 영구 저장소로 복사
```bash
node scripts/manage-permanent-storage.js copy-cache
```

#### API에서 새 데이터를 받아 영구 저장소에 저장
```bash
node scripts/manage-permanent-storage.js refresh
```

#### 영구 저장소에서 데이터 조회
```bash
node scripts/manage-permanent-storage.js load
```

#### 영구 저장소 삭제
```bash
node scripts/manage-permanent-storage.js clear-permanent
```

#### 캐시 삭제
```bash
node scripts/manage-permanent-storage.js clear-cache
```

### 2. API 엔드포인트 사용

#### 영구 저장소 상태 조회
```
GET /api/admin/nutrition-info/permanent-storage/status
```

#### 기존 캐시를 영구 저장소로 복사
```
POST /api/admin/nutrition-info/permanent-storage/copy-cache
```

#### API에서 새 데이터를 받아 영구 저장소에 저장
```
POST /api/admin/nutrition-info/permanent-storage/refresh
```

#### 영구 저장소에서 데이터 조회
```
GET /api/admin/nutrition-info/permanent-storage/data?limit=100&offset=0
```

#### 영구 저장소 삭제
```
DELETE /api/admin/nutrition-info/permanent-storage
```

#### 캐시 삭제
```
DELETE /api/admin/nutrition-info/cache
```

## 프로그래밍 방식 사용

### 1. 영구 저장소 관리자 클래스 사용

```javascript
const PermanentStorageManager = require('./utils/permanentStorageManager');

const manager = new PermanentStorageManager();

// 상태 확인
const status = manager.getPermanentStorageStatus();

// 기존 캐시를 영구 저장소로 복사
const result = manager.copyCacheToPermanentStorage();

// API에서 새 데이터를 받아 영구 저장소에 저장
const refreshResult = await manager.refreshAndSaveToPermanentStorage();

// 영구 저장소에서 데이터 조회
const data = manager.getDataFromPermanentStorage();

// 영구 저장소 삭제
const deleted = manager.clearPermanentStorage();
```

### 2. 데이터 구조

#### 영구 저장소 데이터 구조
```json
{
  "timestamp": "2025-08-29T05:37:29.105Z",
  "products": [
    {
      "PRDLST_REPORT_NO": "제품신고번호",
      "PRDT_NM": "제품명",
      "PRDLST_NM": "제품목록명",
      "BSSH_NM": "제조사명",
      "PRIMARY_FNCLTY": "주요기능",
      "PRDT_SHAP_CD_NM": "제품형태",
      "RAWMTRL_NM": "원재료명",
      "NTK_MTHD": "섭취방법",
      "IFTKN_ATNT_MATR_CN": "섭취시주의사항",
      "PRDLST_REPORT_DE": "제품신고일",
      "POG_DAYCNT": "보관일수",
      "INTAKE_HINT_MPB": "섭취시주의사항",
      "DISPOS": "폐기방법"
    }
  ],
  "count": 13000,
  "description": "영구 저장소 - API 연결 없이 사용 가능한 건강기능식품 데이터"
}
```

## 파일 구조

```
data/
├── cache/
│   └── food_safety_products.json          # 기존 캐시 (24시간 TTL)
└── permanent-storage/
    └── health_functional_foods_permanent.json  # 영구 저장소 (만료 없음)
```

## 주의사항

1. **API 키 필요**: `refresh` 명령어 사용 시 `FOOD_SAFETY_API_KEY` 환경 변수가 필요합니다.
2. **메모리 사용량**: 영구 저장소 파일은 약 18MB의 용량을 차지합니다.
3. **데이터 최적화**: 영구 저장소에는 필요한 필드만 저장되어 메모리를 절약합니다.
4. **관리자 권한**: API 엔드포인트 사용 시 관리자 권한이 필요합니다.

## 문제 해결

### 1. API 키 오류
```
식약처 API 키가 설정되지 않았습니다.
```
**해결방법**: 환경 변수 `FOOD_SAFETY_API_KEY`를 설정하거나, 기존 캐시를 복사하는 방법을 사용하세요.

### 2. 파일 권한 오류
```
영구 저장소 데이터 저장 실패: EACCES: permission denied
```
**해결방법**: `data/permanent-storage` 디렉토리의 쓰기 권한을 확인하세요.

### 3. 메모리 부족 오류
```
JavaScript heap out of memory
```
**해결방법**: Node.js 메모리 제한을 늘리거나, 데이터를 배치로 나누어 처리하세요.

## 성능 최적화

1. **데이터 압축**: JSON 파일은 공백을 제거하여 용량을 절약합니다.
2. **필드 최적화**: 불필요한 필드는 제거하여 메모리 사용량을 줄입니다.
3. **페이지네이션**: API 조회 시 페이지네이션을 지원하여 대용량 데이터 처리를 최적화합니다.
4. **병렬 처리**: API 호출 시 병렬 처리를 통해 속도를 향상시킵니다.

## 업데이트 기록

- **2025-08-29**: 영구 저장소 시스템 초기 구현
  - 기존 캐시에서 영구 저장소로 복사 기능
  - API에서 새 데이터를 받아 영구 저장소에 저장 기능
  - 영구 저장소에서 데이터 조회 기능
  - 관리 스크립트 및 API 엔드포인트 구현

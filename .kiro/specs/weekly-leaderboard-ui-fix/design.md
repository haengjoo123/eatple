# Design Document

## Overview

게임 결과 모달에서 주간 리더보드의 "이번 주 순위" 제목이 스크롤로 인해 가려지는 문제를 해결하기 위한 UI 개선 설계입니다. 현재 모달의 스크롤 구조와 높이 제한으로 인해 리더보드 섹션의 제목이 보이지 않는 문제를 CSS 수정을 통해 해결합니다.

## Architecture

### 현재 구조 분석
- **게임 결과 모달**: `.game-result-modal` - 전체 화면 오버레이
- **결과 콘텐츠**: `.result-content` - 모달 내용 컨테이너 (max-height: 90vh, overflow-y: hidden)
- **섹션 컨테이너**: `.sections-container` - 리더보드와 포인트 섹션을 포함
- **리더보드 섹션**: `.leaderboard-section` - 주간 리더보드 표시 영역
- **리더보드 디스플레이**: `.leaderboard-display` - 실제 리더보드 내용 (max-height: 300px, overflow-y: auto)

### 문제점 식별
1. `.result-content`가 `overflow-y: hidden`으로 설정되어 있어 내용이 잘림
2. `.leaderboard-display`의 `max-height: 300px`와 `overflow-y: auto`로 인해 제목이 스크롤 영역에 포함됨
3. 모바일에서 `max-height: 250px`로 더욱 제한적임

## Components and Interfaces

### 수정할 CSS 컴포넌트

#### 1. Result Content Container
```css
.result-content {
    /* 기존: overflow-y: hidden */
    overflow-y: auto; /* 변경: 스크롤 허용 */
    /* 스크롤바 스타일링 유지 */
}
```

#### 2. Leaderboard Display Structure
```css
.leaderboard-display {
    /* 기존: max-height: 300px, overflow-y: auto */
    height: auto;
    min-height: auto;
    max-height: none; /* 변경: 높이 제한 제거 */
    overflow-y: visible; /* 변경: 스크롤 제거 */
}
```

#### 3. Weekly Leaderboard Section Headers
```css
.weekly-leaderboard-section h3,
.alltime-leaderboard-section h3 {
    position: sticky; /* 추가: 스티키 헤더 */
    top: 0;
    background: white;
    z-index: 10;
    padding: 0.5rem 0;
    margin-top: 0;
}
```

#### 4. Scrollable Content Area
```css
.leaderboard-breakdown {
    max-height: 200px; /* 추가: 리더보드 목록만 스크롤 */
    overflow-y: auto;
    padding-right: 0.5rem;
}
```

## Data Models

### CSS 클래스 구조
```
.game-result-modal
├── .result-content (스크롤 가능)
    ├── .result-stats
    ├── .sections-container
    │   ├── .leaderboard-section
    │   │   └── .leaderboard-display (높이 제한 제거)
    │   │       ├── .weekly-leaderboard-section
    │   │       │   ├── h3 (스티키 헤더)
    │   │       │   └── .leaderboard-breakdown (스크롤 가능)
    │   │       └── .alltime-leaderboard-section
    │   │           ├── h3 (스티키 헤더)
    │   │           └── .leaderboard-breakdown (스크롤 가능)
    │   └── .points-section
    └── .result-actions
```

## Error Handling

### 스크롤 관련 오류 처리
1. **브라우저 호환성**: 스티키 포지셔닝이 지원되지 않는 구형 브라우저 대응
2. **터치 스크롤**: 모바일에서 부드러운 스크롤 경험 보장
3. **높이 계산**: 다양한 화면 크기에서 적절한 높이 계산

### 폴백 스타일
```css
/* 스티키 포지셔닝 미지원 브라우저 대응 */
@supports not (position: sticky) {
    .weekly-leaderboard-section h3,
    .alltime-leaderboard-section h3 {
        position: relative;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(5px);
    }
}
```

## Testing Strategy

### 테스트 시나리오

#### 1. 데스크톱 테스트
- 다양한 해상도에서 제목 가시성 확인 (1920x1080, 1366x768, 1280x720)
- 스크롤 동작 테스트
- 리더보드 데이터가 많을 때와 적을 때 모두 테스트

#### 2. 모바일 테스트
- 다양한 모바일 해상도 테스트 (iPhone, Android)
- 터치 스크롤 반응성 테스트
- 세로/가로 모드 전환 테스트

#### 3. 브라우저 호환성 테스트
- Chrome, Firefox, Safari, Edge에서 동작 확인
- 구형 브라우저에서 폴백 스타일 확인

#### 4. 접근성 테스트
- 키보드 네비게이션으로 스크롤 가능 여부
- 스크린 리더에서 제목 인식 여부
- 고대비 모드에서 가독성 확인

### 성능 고려사항
- 스티키 포지셔닝으로 인한 리페인트 최소화
- 스크롤 이벤트 최적화
- 메모리 사용량 모니터링

### 회귀 테스트
- 기존 포인트 섹션 기능 정상 동작 확인
- 게임 통계 표시 정상 동작 확인
- 모달 열기/닫기 애니메이션 정상 동작 확인
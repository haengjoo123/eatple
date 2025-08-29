# 설계 문서

## 개요

HTML5 기반 미니게임 시스템은 사용자가 재미있는 게임을 통해 포인트를 획득하고, 이를 상품 구매 시 할인에 활용할 수 있는 리워드 시스템입니다. 현재 Express.js 기반 서버와 세션 인증 시스템을 활용하여 구현됩니다.

## 아키텍처

### 시스템 구조
```
Frontend (HTML5/JavaScript)
├── 게임 선택 페이지 (mini-games.html)
├── 개별 게임 페이지들
│   ├── Snake Game (snake-game.html)
│   ├── Memory Game (memory-game.html)
│   └── Puzzle Game (puzzle-game.html)
└── 포인트 관리 UI

Backend (Express.js)
├── 게임 API 라우터 (/api/games)
├── 포인트 관리 API (/api/points)
├── 사용자 인증 미들웨어
└── 데이터 저장 (users.json)
```

### 데이터 흐름
1. 사용자가 메인 페이지에서 미니게임 카드 클릭
2. 인증 확인 후 게임 선택 페이지로 이동
3. 게임 선택 및 플레이
4. 게임 종료 시 점수를 서버로 전송
5. 서버에서 포인트 변환 및 적립
6. 사용자에게 결과 표시

## 컴포넌트 및 인터페이스

### 프론트엔드 컴포넌트

#### 1. 게임 선택 페이지 (MiniGamesPage)
- **파일**: `public/mini-games.html`, `public/mini-games.js`
- **기능**: 
  - 사용가능한 게임 목록 표시
  - 각 게임의 설명과 예상 플레이 시간 표시
  - 현재 보유 포인트 및 일일 획득 가능 포인트 표시
- **인터페이스**:
  ```javascript
  class MiniGamesPage {
    loadAvailableGames()
    displayUserPoints()
    navigateToGame(gameId)
  }
  ```

#### 2. 게임 엔진 (GameEngine)
- **파일**: `public/js/game-engine.js`
- **기능**:
  - HTML5 Canvas 기반 게임 렌더링
  - 게임 상태 관리 (시작, 진행, 종료)
  - 점수 계산 및 표시
- **인터페이스**:
  ```javascript
  class GameEngine {
    constructor(canvasId, gameConfig)
    startGame()
    updateGame()
    endGame()
    getScore()
    submitScore(score)
  }
  ```

#### 3. 개별 게임 클래스들
- **Snake Game**: 뱀 게임 로직
- **Memory Game**: 카드 매칭 게임 로직  
- **Puzzle Game**: 퍼즐 맞추기 게임 로직

#### 4. 포인트 관리자 (PointsManager)
- **파일**: `public/js/points-manager.js`
- **기능**:
  - 포인트 적립 요청
  - 포인트 사용 처리
  - 일일 한도 확인
- **인터페이스**:
  ```javascript
  class PointsManager {
    earnPoints(gameScore)
    usePoints(amount)
    getDailyLimit()
    getCurrentPoints()
  }
  ```

### 백엔드 컴포넌트

#### 1. 게임 라우터 (GameRouter)
- **파일**: `routes/games.js`
- **엔드포인트**:
  - `GET /api/games/list` - 사용가능한 게임 목록
  - `POST /api/games/submit-score` - 게임 점수 제출
  - `GET /api/games/daily-stats` - 일일 게임 통계

#### 2. 포인트 라우터 (PointsRouter)  
- **파일**: `routes/points.js`
- **엔드포인트**:
  - `GET /api/points/balance` - 현재 포인트 잔액
  - `POST /api/points/earn` - 포인트 적립
  - `POST /api/points/use` - 포인트 사용
  - `GET /api/points/history` - 포인트 사용 내역

#### 3. 포인트 서비스 (PointsService)
- **파일**: `utils/pointsService.js`
- **기능**:
  - 포인트 적립/차감 로직
  - 일일 한도 검증
  - 포인트 내역 관리

## 데이터 모델

### 사용자 데이터 확장
기존 `users.json`의 사용자 객체에 다음 필드 추가:
```javascript
{
  "id": "user_id",
  "username": "username",
  // ... 기존 필드들
  "gamePoints": {
    "totalPoints": 0,           // 총 보유 포인트
    "dailyEarned": 0,          // 오늘 획득한 포인트
    "dailyLimit": 100,         // 일일 획득 한도
    "lastEarnedDate": "2025-07-16", // 마지막 포인트 획득 날짜
    "history": [               // 포인트 사용 내역
      {
        "id": "transaction_id",
        "type": "earn|use",
        "amount": 50,
        "source": "snake-game|purchase",
        "timestamp": "2025-07-16T10:30:00Z",
        "description": "Snake Game 점수: 1250"
      }
    ]
  },
  "gameStats": {
    "gamesPlayed": 0,          // 총 게임 플레이 횟수
    "bestScores": {            // 게임별 최고 점수
      "snake-game": 1250,
      "memory-game": 800,
      "puzzle-game": 950
    },
    "lastPlayedDate": "2025-07-16"
  }
}
```

### 게임 설정 데이터
```javascript
const GAME_CONFIG = {
  "snake-game": {
    "name": "스네이크 게임",
    "description": "뱀을 조작해서 먹이를 먹고 점수를 획득하세요",
    "estimatedTime": "3-5분",
    "maxPoints": 50,           // 최대 획득 가능 포인트
    "scoreMultiplier": 0.04    // 게임점수 → 포인트 변환 비율
  },
  "memory-game": {
    "name": "기억력 게임", 
    "description": "카드를 뒤집어서 같은 그림을 찾으세요",
    "estimatedTime": "2-4분",
    "maxPoints": 40,
    "scoreMultiplier": 0.05
  },
  "puzzle-game": {
    "name": "퍼즐 게임",
    "description": "조각을 맞춰서 그림을 완성하세요", 
    "estimatedTime": "4-6분",
    "maxPoints": 60,
    "scoreMultiplier": 0.06
  }
}
```

## 오류 처리

### 클라이언트 사이드 오류 처리
1. **네트워크 오류**: 점수 제출 실패 시 재시도 옵션 제공
2. **게임 오류**: 게임 크래시 시 안전한 종료 및 메인 페이지 복귀
3. **인증 오류**: 세션 만료 시 로그인 페이지로 리다이렉트

### 서버 사이드 오류 처리
1. **데이터 검증**: 게임 점수 유효성 검사 (최대값 초과 방지)
2. **중복 요청**: 동일한 게임 세션의 중복 점수 제출 방지
3. **일일 한도**: 한도 초과 시 적절한 오류 메시지 반환

## 테스팅 전략

### 단위 테스트
- 게임 로직 테스트 (점수 계산, 게임 상태 관리)
- 포인트 서비스 테스트 (적립, 차감, 한도 검증)
- API 엔드포인트 테스트

### 통합 테스트  
- 게임 플레이부터 포인트 적립까지 전체 플로우
- 인증이 필요한 API 호출 테스트
- 일일 한도 시나리오 테스트

### 사용자 테스트
- 다양한 디바이스에서의 게임 플레이 테스트
- 네트워크 불안정 상황에서의 동작 테스트
- 사용자 경험 및 게임 밸런스 테스트

## 보안 고려사항

### 점수 조작 방지
1. **서버 사이드 검증**: 게임별 최대 점수 제한
2. **세션 검증**: 유효한 로그인 세션에서만 점수 제출 허용
3. **시간 검증**: 비현실적으로 짧은 시간의 고득점 차단
4. **중복 제출 방지**: 게임 세션 ID를 통한 중복 제출 차단

### 데이터 보호
1. **입력 검증**: 모든 사용자 입력에 대한 검증 및 새니타이징
2. **세션 보안**: 기존 Express 세션 보안 설정 활용
3. **API 레이트 리미팅**: 과도한 API 호출 방지

## 성능 최적화

### 프론트엔드 최적화
1. **게임 에셋 최적화**: 이미지 및 사운드 파일 압축
2. **Canvas 최적화**: 효율적인 렌더링 및 애니메이션
3. **메모리 관리**: 게임 종료 시 리소스 정리

### 백엔드 최적화
1. **파일 I/O 최적화**: users.json 읽기/쓰기 최적화
2. **캐싱**: 게임 설정 및 사용자 데이터 캐싱
3. **비동기 처리**: 포인트 적립 처리의 비동기화

## 확장성 고려사항

### 새로운 게임 추가
- 모듈화된 게임 구조로 새 게임 쉽게 추가 가능
- 게임 설정 파일을 통한 동적 게임 관리

### 데이터베이스 마이그레이션
- 향후 MongoDB나 PostgreSQL로 마이그레이션 고려
- 현재 JSON 구조와 호환되는 스키마 설계

### 실시간 기능
- WebSocket을 활용한 멀티플레이어 게임 확장 가능성
- 실시간 리더보드 기능 추가 가능성
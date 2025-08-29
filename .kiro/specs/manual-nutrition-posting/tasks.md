# Implementation Plan

- [x] 1. Supabase 설정 및 데이터베이스 스키마 구성

  - Supabase 프로젝트 설정 및 데이터베이스 테이블 생성
  - 기존 JSON 데이터를 Supabase로 마이그레이션하는 스크립트 작성
  - _Requirements: 7.1, 7.2_

- [x] 1.1 Supabase 데이터베이스 테이블 생성

  - nutrition_posts, categories, tags, post_tags, post_modification_history 테이블 생성
  - 기본 카테고리 데이터 삽입 및 인덱스 설정
  - _Requirements: 7.1_

- [x] 1.2 기존 데이터 마이그레이션 스크립트 구현

  - 기존 nutrition-info.json 데이터를 Supabase 테이블로 이전하는 스크립트 작성
  - 카테고리와 태그 데이터 정규화 및 관계 설정
  - _Requirements: 7.2_

- [x] 2. 자동 데이터 수집 관련 코드 및 파일 제거

  - 자동 수집 관련 JavaScript 파일들 삭제
  - server.js에서 자동 수집 관련 코드 제거
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2.1 데이터 수집 스크립트 파일들 삭제

  - collect-\*.js 파일들과 scripts 폴더의 수집 관련 파일들 삭제
  - 배치 파일들(manual-collect.bat, restart-collection.bat) 삭제
  - _Requirements: 1.1_

- [x] 2.2 자동 수집 유틸리티 클래스들 삭제

  - utils 폴더의 자동 수집 관련 파일들 삭제 (contentAggregator, dataCollectionScheduler 등)
  - API 서비스 파일들 삭제 (pubmedApiService, youtubeApiService, newsApiService 등)
  - _Requirements: 1.2_

- [x] 2.3 server.js에서 자동 수집 관련 코드 제거

  - 자동 수집 관련 import 구문들 제거
  - 스케줄러 초기화 및 실행 코드 제거
  - _Requirements: 1.3_

- [x] 2.4 관리자 페이지에서 데이터 수집 UI 요소 제거

  - admin.html에서 자동 수집 관련 버튼과 섹션 제거
  - admin.js에서 관련 JavaScript 코드 제거
  - _Requirements: 1.2_

- [x] 3. Supabase 연동 및 기본 서비스 구현

  - Supabase 클라이언트 설정 및 연결
  - 기본 CRUD 작업을 위한 서비스 클래스 구현
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 3.1 Supabase 클라이언트 설정

  - Supabase JavaScript 클라이언트 라이브러리 설치 및 설정
  - 환경 변수를 통한 Supabase URL과 API 키 관리
  - _Requirements: 2.1_

- [x] 3.2 SupabaseManualPostingService 클래스 구현

  - 포스팅 생성, 수정, 삭제 기능 구현
  - 태그 연결 및 카테고리 관리 기능 구현
  - _Requirements: 2.2, 3.1, 3.2_

- [x] 3.3 카테고리 및 태그 관리 서비스 구현

  - 카테고리 CRUD 작업 구현
  - 태그 자동 완성 및 관련 태그 추천 기능 구현
  - _Requirements: 3.1, 3.2_

- [x] 4. 관리자 포스팅 인터페이스 구현

  - 포스팅 작성 폼 UI 구현
  - 이미지 업로드 및 미리보기 기능 구현
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 4.1 관리자 포스팅 페이지 HTML 구조 구현

  - 포스팅 작성 폼 HTML 마크업 작성
  - 카테고리 선택 및 태그 입력 UI 구현
  - _Requirements: 2.1, 2.2_

- [x] 4.2 포스팅 폼 JavaScript 기능 구현

  - 폼 유효성 검증 및 실시간 미리보기 기능 구현
  - 태그 자동 완성 및 카테고리 관리 기능 구현
  - _Requirements: 2.2, 3.1, 3.2_

- [x] 4.3 이미지 업로드 및 Supabase Storage 연동

  - Supabase Storage를 활용한 이미지 업로드 기능 구현
  - 이미지 미리보기 및 크기 최적화 기능 구현
  - _Requirements: 2.3_

- [x] 4.4 원본 소스 URL 검증 기능 구현

  - URL 유효성 검증 및 접근 가능성 확인 기능 구현
  - 원본 소스 버튼 UI 및 새 탭 열기 기능 구현
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 5. 관리자 API 엔드포인트 구현

  - 포스팅 관리를 위한 REST API 엔드포인트 구현
  - 카테고리 및 태그 관리 API 구현
  - _Requirements: 2.1, 2.2, 3.1, 5.1, 5.2, 5.3_

- [x] 5.1 포스팅 CRUD API 엔드포인트 구현

  - POST /api/admin/nutrition-info/posts (포스팅 생성)
  - PUT /api/admin/nutrition-info/posts/:id (포스팅 수정)
  - DELETE /api/admin/nutrition-info/posts/:id (포스팅 삭제)
  - GET /api/admin/nutrition-info/posts (관리자 포스팅 목록)
  - _Requirements: 2.1, 2.2, 5.1, 5.2, 5.3_

- [x] 5.2 임시저장 관리 API 구현

  - POST /api/admin/nutrition-info/drafts (임시저장)
  - GET /api/admin/nutrition-info/drafts (임시저장 목록)
  - DELETE /api/admin/nutrition-info/drafts/:id (임시저장 삭제)
  - _Requirements: 2.2, 5.1_

- [x] 5.3 카테고리 및 태그 관리 API 구현

  - 카테고리 CRUD API 엔드포인트 구현
  - 태그 자동 완성 및 관련 태그 API 구현
  - _Requirements: 3.1, 3.2_

- [x] 5.4 이미지 업로드 및 URL 검증 API 구현

  - POST /api/admin/nutrition-info/upload-image (이미지 업로드)
  - POST /api/admin/nutrition-info/validate-url (URL 검증)
  - _Requirements: 2.3, 4.2_

- [x] 6. 포스팅 관리 인터페이스 구현

  - 작성한 포스팅 목록 조회 및 관리 UI 구현
  - 포스팅 상태 변경 및 편집 기능 구현
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 6.1 포스팅 목록 관리 페이지 구현

  - 관리자가 작성한 포스팅 목록 테이블 UI 구현
  - 필터링 및 검색 기능 구현
  - _Requirements: 5.1_

- [x] 6.2 포스팅 상태 관리 기능 구현

  - 게시/비게시 상태 토글 기능 구현
  - 임시저장 포스팅 관리 기능 구현
  - _Requirements: 5.2_

- [x] 6.3 포스팅 편집 및 삭제 기능 구현

  - 기존 포스팅 불러오기 및 편집 기능 구현
  - 포스팅 삭제 확인 및 실행 기능 구현
  - _Requirements: 5.3_

- [x] 7. 카테고리 및 태그 기반 추천 알고리즘 구현

  - Supabase 쿼리를 활용한 관련 정보 추천 시스템 구현
  - 태그 매칭 점수 계산 및 정렬 알고리즘 구현
  - _Requirements: 3.3, 3.4, 6.4_

- [x] 7.1 카테고리 기반 추천 기능 구현

  - 동일 카테고리 내 관련 포스팅 추천 쿼리 구현
  - 추천 결과 정렬 및 제한 로직 구현
  - _Requirements: 3.3_

- [x] 7.2 태그 기반 추천 알고리즘 구현

  - 태그 일치도 계산 및 점수 기반 정렬 알고리즘 구현
  - 관련 태그 추천 및 연관성 분석 기능 구현
  - _Requirements: 3.4_

- [x] 7.3 통합 추천 시스템 구현

  - 카테고리와 태그를 결합한 통합 추천 알고리즘 구현
  - 중복 제거 및 최종 추천 결과 생성 로직 구현
  - _Requirements: 6.4_

- [x] 8. 기존 API 엔드포인트 업데이트

  - 기존 영양 정보 조회 API를 Supabase 연동으로 수정
  - 자동/수동 데이터 통합 조회 기능 구현
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 8.1 영양 정보 목록 조회 API 업데이트

  - GET /api/nutrition-info를 Supabase 쿼리로 변경
  - 자동 수집 데이터와 수동 포스팅 데이터 통합 조회 구현
  - _Requirements: 6.1, 7.1_

- [x] 8.2 영양 정보 상세 조회 API 업데이트

  - GET /api/nutrition-info/:id를 Supabase 쿼리로 변경
  - 관련 정보 추천 기능 통합
  - _Requirements: 6.2, 6.4_

- [x] 8.3 검색 및 필터링 API 업데이트

  - POST /api/nutrition-info/search를 Supabase 전문 검색으로 변경
  - 카테고리 및 태그 기반 필터링 기능 구현
  - _Requirements: 6.3_

- [x] 8.4 메타데이터 API 업데이트

  - 카테고리 목록 API를 Supabase 쿼리로 변경
  - 태그 통계 및 관련 정보 API 구현
  - _Requirements: 6.1, 6.3_

- [x] 9. 프론트엔드 사용자 인터페이스 호환성 유지

  - 기존 영양 정보 페이지가 새로운 시스템과 호환되도록 수정
  - 사용자 경험 일관성 유지 및 추천 기능 통합
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 9.1 영양 정보 목록 페이지 호환성 수정

  - 기존 nutrition-info.html 페이지를 새로운 API와 연동
  - 필터링 및 검색 기능 호환성 확보
  - _Requirements: 6.1, 6.3_

- [x] 9.2 영양 정보 상세 페이지 호환성 수정

  - 상세 페이지에서 원본 소스 버튼 표시 기능 구현
  - 관련 정보 추천 섹션 통합
  - _Requirements: 6.2, 6.4_

- [x] 9.3 사용자 상호작용 기능 호환성 유지

  - 북마크, 좋아요 기능을 Supabase와 연동
  - 사용자 개인화 기능 유지
  - _Requirements: 6.4_

- [x] 10. 테스트 및 품질 보증


  - 새로운 시스템의 단위 테스트 및 통합 테스트 작성
  - 데이터 마이그레이션 검증 및 성능 테스트 수행
  - _Requirements: 모든 기능 요구사항_

- [x] 10.1 Supabase 연동 단위 테스트 작성

  - SupabaseManualPostingService 클래스 테스트 작성
  - 카테고리 및 태그 관리 기능 테스트 작성
  - _Requirements: 2.1, 2.2, 3.1, 3.2_

- [x] 10.2 API 엔드포인트 통합 테스트 작성

  - 새로운 관리자 API 엔드포인트 테스트 작성
  - 기존 API 호환성 테스트 작성
  - _Requirements: 모든 API 관련 요구사항_

- [x] 10.3 데이터 마이그레이션 검증 테스트

  - 기존 JSON 데이터와 Supabase 데이터 일치성 검증
  - 추천 알고리즘 정확성 테스트
  - _Requirements: 7.1, 7.2_

- [x] 10.4 프론트엔드 호환성 및 사용자 경험 테스트

  - 기존 사용자 인터페이스 호환성 테스트
  - 관리자 포스팅 워크플로우 전체 테스트
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [-] 11. 시스템 배포 및 모니터링 설정




  - Supabase 프로덕션 환경 설정
  - 성능 모니터링 및 로깅 시스템 구축
  - _Requirements: 모든 기능 요구사항_

- [x] 11.1 Supabase 프로덕션 환경 설정



  - 프로덕션 데이터베이스 설정 및 보안 구성
  - 백업 및 복구 전략 수립
  - _Requirements: 7.1, 7.2_

- [ ] 11.2 성능 모니터링 시스템 구축



  - Supabase 쿼리 성능 모니터링 설정
  - 사용자 활동 및 시스템 성능 로깅 구현
  - _Requirements: 모든 기능 요구사항_

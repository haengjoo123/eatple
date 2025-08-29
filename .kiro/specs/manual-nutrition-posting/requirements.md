# Requirements Document

## Introduction

최신영양정보 시스템을 자동 데이터 수집 방식에서 관리자가 직접 포스팅하는 수동 관리 방식으로 변경하는 시스템입니다. 기존의 자동 수집 관련 코드와 기능을 제거하고, 관리자가 직접 영양 정보를 작성하고 관리할 수 있는 포스팅 시스템을 구축합니다. 카테고리와 태그 기반의 추천 알고리즘을 통해 사용자에게 관련 정보를 제공합니다.

## Requirements

### Requirement 1

**User Story:** As a 관리자, I want 자동 데이터 수집 관련 기능을 완전히 제거하고 싶어, so that 시스템을 수동 관리 방식으로 전환할 수 있다

#### Acceptance Criteria

1. WHEN 관리자가 시스템을 확인 THEN 자동 데이터 수집 관련 모든 코드와 파일이 제거되어야 함
2. WHEN 관리자 페이지에 접근 THEN 데이터 수집 관련 UI 요소가 모두 제거되어야 함
3. WHEN 시스템이 실행됨 THEN 자동 스케줄러나 외부 API 호출이 발생하지 않아야 함
4. WHEN 데이터베이스를 확인 THEN 자동 수집된 기존 데이터는 보존되어야 함

### Requirement 2

**User Story:** As a 관리자, I want 영양 정보를 직접 작성하고 포스팅할 수 있는 페이지가 필요해, so that 수동으로 양질의 영양 정보를 제공할 수 있다

#### Acceptance Criteria

1. WHEN 관리자가 포스팅 페이지에 접근 THEN 제목, 내용, 요약을 입력할 수 있는 폼이 제공되어야 함
2. WHEN 관리자가 포스팅을 작성 THEN 이미지 업로드 기능이 제공되어야 함
3. WHEN 관리자가 포스팅을 저장 THEN 작성일시와 관리자 정보가 자동으로 기록되어야 함
4. WHEN 관리자가 포스팅을 수정 THEN 기존 내용을 불러와서 편집할 수 있어야 함

### Requirement 3

**User Story:** As a 관리자, I want 카테고리와 태그를 직접 입력하여 관리하고 싶어, so that 사용자에게 체계적인 정보 분류와 추천을 제공할 수 있다

#### Acceptance Criteria

1. WHEN 관리자가 포스팅을 작성 THEN 카테고리를 선택하거나 새로 생성할 수 있어야 함
2. WHEN 관리자가 태그를 입력 THEN 기존 태그 목록에서 선택하거나 새 태그를 생성할 수 있어야 함
3. WHEN 관리자가 카테고리/태그를 설정 THEN 관련 정보 추천 알고리즘이 이를 활용해야 함
4. WHEN 사용자가 영양 정보를 조회 THEN 카테고리와 태그 기반으로 관련 정보가 추천되어야 함

### Requirement 4

**User Story:** As a 관리자, I want 포스팅에 원본 소스 URL을 연결할 수 있는 기능이 필요해, so that 사용자가 원본 자료를 확인할 수 있도록 신뢰성을 제공할 수 있다

#### Acceptance Criteria

1. WHEN 관리자가 포스팅을 작성 THEN 원본 소스 URL을 입력할 수 있는 필드가 제공되어야 함
2. WHEN 관리자가 소스 URL을 입력 THEN URL 유효성 검증이 수행되어야 함
3. WHEN 사용자가 영양 정보를 조회 THEN "원본 소스" 버튼이 표시되어야 함
4. WHEN 사용자가 원본 소스 버튼을 클릭 THEN 새 탭에서 원본 URL이 열려야 함

### Requirement 5

**User Story:** As a 관리자, I want 작성한 포스팅을 관리할 수 있는 기능이 필요해, so that 게시/비게시, 수정, 삭제 등을 효율적으로 관리할 수 있다

#### Acceptance Criteria

1. WHEN 관리자가 관리 페이지에 접근 THEN 작성한 모든 포스팅 목록이 표시되어야 함
2. WHEN 관리자가 포스팅 상태를 변경 THEN 게시/비게시 상태를 토글할 수 있어야 함
3. WHEN 관리자가 포스팅을 선택 THEN 수정, 삭제 기능이 제공되어야 함
4. WHEN 관리자가 포스팅을 삭제 THEN 확인 메시지 후 완전히 제거되어야 함

### Requirement 6

**User Story:** As a 사용자, I want 관리자가 작성한 영양 정보를 기존과 동일한 방식으로 조회하고 싶어, so that 변경된 시스템에서도 일관된 사용자 경험을 유지할 수 있다

#### Acceptance Criteria

1. WHEN 사용자가 영양 정보 페이지에 접근 THEN 기존과 동일한 UI로 정보가 표시되어야 함
2. WHEN 사용자가 영양 정보를 검색 THEN 제목, 내용, 태그에서 검색이 수행되어야 함
3. WHEN 사용자가 카테고리를 선택 THEN 해당 카테고리의 정보만 필터링되어야 함
4. WHEN 사용자가 특정 정보를 조회 THEN 관련 정보가 태그와 카테고리 기반으로 추천되어야 함

### Requirement 7

**User Story:** As a 시스템, I want 기존 자동 수집된 데이터와 새로운 수동 포스팅 데이터를 통합 관리하고 싶어, so that 데이터 일관성을 유지하면서 새로운 시스템으로 전환할 수 있다

#### Acceptance Criteria

1. WHEN 시스템이 전환됨 THEN 기존 자동 수집 데이터는 보존되고 조회 가능해야 함
2. WHEN 새로운 수동 포스팅이 추가됨 THEN 기존 데이터와 동일한 구조로 저장되어야 함
3. WHEN 데이터를 조회 THEN 자동/수동 구분 없이 통합된 목록으로 표시되어야 함
4. WHEN 관리자가 기존 데이터를 관리 THEN 수동 포스팅과 동일한 방식으로 편집 가능해야 함
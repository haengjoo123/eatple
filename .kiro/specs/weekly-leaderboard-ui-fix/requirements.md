# Requirements Document

## Introduction

게임 결과 화면에서 주간 리더보드의 "이번 주 순위" 텍스트가 스크롤 영역에 가려져 사용자에게 보이지 않는 UI 문제를 해결하는 기능입니다. 사용자가 게임 완료 후 자신의 주간 순위를 명확하게 확인할 수 있도록 UI를 개선합니다.

## Requirements

### Requirement 1

**User Story:** 게임 플레이어로서, 게임 완료 후 주간 리더보드 정보를 명확하게 볼 수 있기를 원한다.

#### Acceptance Criteria

1. WHEN 게임 결과 모달이 표시될 때 THEN 주간 리더보드 섹션의 제목이 스크롤 없이 보여야 한다
2. WHEN 사용자가 게임 결과 화면을 볼 때 THEN "이번 주 순위" 텍스트가 항상 가시 영역에 표시되어야 한다
3. WHEN 모달 내용이 길어질 때 THEN 적절한 스크롤 영역이 제공되어야 한다

### Requirement 2

**User Story:** 모바일 사용자로서, 작은 화면에서도 주간 리더보드 정보를 쉽게 확인할 수 있기를 원한다.

#### Acceptance Criteria

1. WHEN 모바일 디바이스에서 게임 결과를 볼 때 THEN 주간 리더보드 제목이 명확하게 보여야 한다
2. WHEN 화면 크기가 작을 때 THEN 리더보드 섹션이 적절히 축소되어 표시되어야 한다
3. WHEN 터치 스크롤을 할 때 THEN 부드럽게 스크롤되어야 한다

### Requirement 3

**User Story:** 개발자로서, 리더보드 UI가 다양한 화면 크기에서 일관되게 작동하기를 원한다.

#### Acceptance Criteria

1. WHEN 다양한 해상도에서 테스트할 때 THEN 리더보드 제목이 항상 보여야 한다
2. WHEN CSS 스타일을 수정할 때 THEN 기존 기능이 손상되지 않아야 한다
3. WHEN 모달 높이가 변경될 때 THEN 스크롤 영역이 적절히 조정되어야 한다
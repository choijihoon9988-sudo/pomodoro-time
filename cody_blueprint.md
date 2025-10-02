Cody Blueprint - Project Metis (Friction-Zero OS)
Version: 20251003.4 (Forest System Init)
Project Overview
Friction-Zero OS는 사용자의 마찰을 데이터 기반으로 측정하고 분석하여 성장을 유도하는 AI 기반 성장 운영체제입니다. '성장의 숲' 시스템 도입으로 장기적인 동기부여와 성장 경험을 강화합니다.

File Structure
index.html: 메인 애플리케이션 HTML 파일

style.css: 애플리케이션의 전반적인 스타일시트

script.js: 애플리케이션의 핵심 로직을 담고 있는 자바스크립트 파일

firebase.json: Firebase 호스팅 설정 파일

icons/: 애플리케이션 상태에 따른 파비콘 이미지 폴더

sounds/: 알람 및 배경음 오디오 파일 폴더

Key Modules in script.js
FirebaseAPI: Firebase와의 모든 통신을 담당.

UI: DOM 조작 및 UI 렌더링.

Timer: 뽀모도로 타이머 로직 관리.

Logger: 세션 로그 및 마찰 데이터 기록.

Report: 일일 보고서 생성.

Stats: 통계 데이터 시각화 (Chart.js 사용).

Gamification: 레벨, 스트릭, 성장의 숲(씨앗, 새싹, 나무, 휴면 상태) 등 게임화 요소 관리.

App: 애플리케이션 전체 초기화 및 컨트롤러.

Change History
20251003.4 (Forest System Init)
Files: index.html, style.css, script.js

Change: '성장의 숲' 시스템을 도입하여 기존 동기부여 시스템을 전면 개편했습니다.

index.html: '오늘의 에너지'와 '오늘 완료한 집중' 위젯을 하나의 '성장의 숲' 위젯으로 통합했습니다. UI 용어를 '에너지'에서 '씨앗'으로 변경하고, 누적된 나무 수와 숲의 휴면 상태를 표시할 영역을 추가했습니다.

style.css: 새로운 '성장의 숲' 위젯 레이아웃과 씨앗/새싹 아이콘, 숲의 휴면 상태(그레이스케일)에 대한 스타일을 추가할 예정입니다.

script.js:

UI Module: 새로운 위젯 구조에 맞춰 DOM 캐싱 및 렌더링 함수(updateForestDisplay -> updateSeedsDisplay)를 수정할 예정입니다.

Gamification Module: 핵심 로직을 '에너지' 대신 '씨앗(목표)', '새싹(성과)' 개념으로 리팩토링할 예정입니다. '하루 마무리' 시 새싹을 영구적인 나무로 변환하여 Firestore에 저장하고, 3일 이상 비활성 시 '휴면 숲'으로 전환 및 복귀 시 '숲 깨우기'를 실행하는 로직을 구현할 예정입니다. 가변 보상(특별한 나무)을 위한 기반을 마련할 예정입니다.

Report Module: '하루 마무리'가 새싹을 나무로 변환하는 트리거 역할을 하도록 로직을 연결할 예정입니다.

20251003.3 (Audio Fix)
File: script.js

Change: 타이머 세션 종료 및 휴식 시간 알람 소리가 나지 않는 문제를 해결했습니다. Timer 모듈 내에서 주석 처리되어 있던 오디오 객체 생성(new Audio()) 및 재생(play(), pause()) 관련 코드를 모두 활성화했습니다. 이를 통해 사용자가 설정한 알람음과 휴식 배경음이 정상적으로 재생됩니다. 다른 브라우저 탭으로 이동했을 때 소리가 들리지 않는 현상은 브라우저 정책에 따른 것이며, 이를 보완하기 위한 기존의 데스크톱 알림 기능은 정상적으로 유지됩니다.

20251003.2 (Chart.js Hotfix)
File: script.js, index.html

Change: Chart.js Sankey 컨트롤러 등록 로직을 Stats 모듈이 처음 로드될 때가 아닌, render 함수가 실제 호출될 때 실행하도록 지연시켰습니다. 이는 script.js가 Sankey 라이브러리 스크립트보다 먼저 실행되어 발생하는 레이스 컨디션(race condition)을 해결하여 'sankey is not a registered controller' 오류를 수정합니다. 등록은
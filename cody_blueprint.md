# Cody Blueprint - Project Metis (Friction-Zero OS)

## Version: 20251002.6 (Final & Stable)

### Project Overview
Friction-Zero OS는 사용자의 마찰을 데이터 기반으로 측정하고 분석하여 성장을 유도하는 AI 기반 성장 운영체제입니다.

### File Structure
- `index.html`: 메인 애플리케이션 HTML 파일
- `style.css`: 애플리케이션의 전반적인 스타일시트
- `script.js`: 애플리케이션의 핵심 로직을 담고 있는 자바스크립트 파일
- `firebase.json`: Firebase 호스팅 설정 파일
- `icons/`: 애플리케이션 상태에 따른 파비콘 이미지 폴더

### Key Modules in `script.js`
- **FirebaseAPI**: Firebase와의 모든 통신을 담당.
- **UI**: DOM 조작 및 UI 렌더링.
- **Timer**: 뽀모도로 타이머 로직 관리.
- **Logger**: 세션 로그 및 마찰 데이터 기록.
- **Report**: 일일 보고서 생성.
- **Stats**: 통계 데이터 시각화 (Chart.js 사용).
- **Gamification**: 레벨, 스트릭 등 게임화 요소 관리.
- **App**: 애플리케이션 전체 초기화 및 컨트롤러.

---

### Change History

#### 20251002.6 (Final & Stable)
- **File**: `index.html`
- **Change**: Chart.js 라이브러리를 불러오는 `<script>` 태그에 `defer` 속성을 추가함. 이를 통해 스크립트 실행 순서를 명확히 하여, 간헐적으로 발생하던 "sankey is not a registered controller" 오류를 최종적으로 해결하고 안정성을 확보함.

#### 20251002.5 (Final Fix)
- **File**: `index.html`, `script.js`
- **Change**: Chart.js 라이브러리 로드 방식을 `script.js`의 `import`에서 `index.html`의 `<script>` 태그로 변경하여 "sankey is not a registered controller" 오류를 해결.

... (이전 기록 생략) ...
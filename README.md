# IDP Drone Simulator — GitHub Pages 최종 업로드용

저장소: `jeonseongkweon-cloud/idp-simulator`

## 가장 쉬운 업로드 방법
1. 이 ZIP 파일을 PC에서 **압축 해제**합니다.
2. 압축을 풀었을 때 보이는 `index.html`, `README.md`, `assets`, `data`를 모두 선택합니다.
3. GitHub의 `idp-simulator` 저장소에서 **Add file → Upload files**를 누릅니다.
4. 파일과 폴더를 한꺼번에 끌어다 놓습니다.
5. 아래쪽 **Commit changes**를 누릅니다.
6. 이미 GitHub Pages가 `main / (root)`로 설정되어 있다면 잠시 후 사이트가 갱신됩니다.

중요: `idp-simulator-final` 폴더 자체를 한 단계 더 올리지 말고,
**`index.html`이 저장소 맨 첫 화면(root)에 보여야 합니다.**

## 포함 기능
- PC 16:9 중심의 IDP 시네마틱 메인 화면
- 국제드론순찰대 로고/명칭/연락처
- LEVEL 1 공개 체험
- LEVEL 2 이상 ID 로그인 구조
- 데모 ID: `IDP2026`
- 키보드 조종:
  - W/S 전진·후진
  - A/D 좌우
  - ↑/↓ 상승·하강
  - ←/→ 회전
  - SPACE 이륙/착륙
  - R 초기화
  - P 일시정지
  - F 전체화면
- 점수/시간/고도/속도 HUD
- 1차 단계별 미션
- Web Audio 기반 시작/효과음
- Google Sheet 연동 자리 준비

## Google Sheet 회원 ID 연동
`assets/js/config.js` 파일의

`googleSheetEndpoint: ""`

부분에 추후 Google Apps Script Web App URL을 넣으면 됩니다.
현재는 데모 ID 방식으로 동작합니다.

## 연락처
- 문의: 010-4477-2772
- 홈페이지: idf.ai.kr
- 이메일: jeonseongkweon@gmail.com
- 국제문의: +82-2-822-1822

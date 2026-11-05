# 실행과 공개 정보 구분

## 기본 실행

Node.js 24.13 이상이 필요합니다. `.env.example`을 서버의 `.env`로 복사하고 키를 설정합니다.

```sh
chmod 600 .env
npm start
```

기본 바인딩은 `127.0.0.1:4188`입니다. 마이크를 쓰는 브라우저는 HTTPS 또는 localhost 같은 보안 컨텍스트에서 열어야 합니다.

## 사용자 서비스

저장소가 `$HOME/open-kiosk`에 있고 Node가 `/usr/local/bin/node`에 있는 환경의 템플릿입니다. 다른 환경에서는 본인의 경로에 맞춰 조정합니다.

```sh
mkdir -p ~/.config/systemd/user
cp scripts/open-kiosk.service ~/.config/systemd/user/open-kiosk.service
systemctl --user daemon-reload
systemctl --user enable --now open-kiosk.service
systemctl --user is-active open-kiosk.service
```

변경한 소스를 반영한 뒤 `systemctl --user restart open-kiosk.service`로 재시작합니다. 재시작은 영속 DB를 삭제하지 않습니다.

발표 노트북의 포트 포워딩 예시:

```sh
ssh -N -L 8418:127.0.0.1:4188 YOUR_SERVER_ALIAS
```

http://localhost:8418 을 엽니다. 별칭·주소·계정·SSH 설정은 각자의 비공개 연결 정보입니다. 이 저장소는 특정 연구 서버의 내부 주소·사용자명·키 경로를 포함하지 않습니다.

## Git에 포함하는 것

- `src/`, `public/`: 애플리케이션 코드와 직접 만든 정적 자산
- `tests/`, `scripts/`: 검사와 일반적인 실행 템플릿
- `docs/`, `README.md`: 기능·설계·조사·검증과 실행 문서
- `package.json`: 실행 명령과 Node 버전
- `.env.example`: 값이 비어 있는 키 항목과 일반적인 기본 설정
- `.gitignore`: 비밀·런타임 데이터 제외 규칙

## Git에 포함하지 않는 것

- `.env`, `.env.*`의 실제 값
- API 키·SSH 키·인증서·개인 계정 인증정보
- `.data/`, DB와 WAL·SHM 파일, 로그
- 실제 주문·세션·체험 계정·개인정보·음성 원본
- 특정 서버의 내부 주소와 접속 설정

기본 데이터 폴더는 소유자 권한 700, DB와 환경변수 파일은 600으로 관리합니다. `OPEN_KIOSK_DATA_DIR`로 별도 비공개 경로를 지정할 수 있습니다.

## 공개 인터넷 배포와 구분

현재 기본 구성은 서버 루프백과 SSH 터널을 통한 발표·개발 체험입니다. 외부 웹사이트에 API 키를 전달하지 않습니다. 공개 도메인으로 배포하려면 운영자가 관리하는 HTTPS 리버스 프록시·접근 정책 등을 별도로 구성하고 `OPEN_KIOSK_SECURE_COOKIES=1`을 설정해야 합니다. 일별 요청 제한은 금액 단위의 과금 상한이나 정식 서비스 운영 체계를 대체하지 않습니다.

# kimp-chart-only

김프(Kimchi Premium) 실시간 차트 시각화 서버입니다.

## 목적

SwitchOne API에서 USDT/KRW 및 USD/KRW 환율을 폴링하여 김프를 계산하고, lightweight-charts로 OHLC 캔들차트를 시각화합니다.

## 실행 방법

```bash
# 1) 의존성 설치
pnpm install

# 2) .env 파일에 DATABASE_URL + SwitchOne 자격증명 입력
cp .env.example .env

# 3) Postgres 스키마 푸시 (kimp_candle_1m 테이블 생성)
pnpm db:push

# 4) 개발 서버 기동
pnpm dev
```

## 환경변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| PORT | 서버 포트 | 3000 |
| POLLING_INTERVAL | 가격 폴링 주기 (ms) | 5000 |
| DATABASE_URL | Postgres 연결 문자열 | (필수) |
| SWITCHONE_HOST | SwitchOne API 호스트 | https://api.switchwon.com |
| SWITCHONE_CLIENT_ID | SwitchOne 클라이언트 ID | - |
| SWITCHONE_SECRET_KEY | SwitchOne 시크릿 키 | - |
| DEBUG_PAUSE_POLLER | 폴러 일시정지 (`1` 설정 시) | - |

## 엔드포인트

| 경로 | 설명 |
|------|------|
| GET /health | 헬스체크 |
| GET /candle | 차트 HTML 페이지 |
| GET /api/candles?interval=5m&limit=500 | OHLC 캔들 데이터 JSON |

### /api/candles 파라미터

- `interval`: 캔들 주기 (`1m`, `3m`, `5m`, `15m`, `30m`, `1h`, `4h`, `1d`) — 기본 `5m`
- `limit`: 반환할 캔들 수 (1~1440) — 기본 500

## 데이터 영속화 (Postgres)

1분봉(`kimp_candle_1m`)을 Postgres에 영속 저장합니다. 모든 인터벌은 1분봉을 read-time merge로 집계합니다.

- **소스 오브 트루스**: Postgres `kimp_candle_1m` 테이블
- **인메모리 상태**: 진행 중인 1분 버킷 1개만 (`currentBucket`) — 매 틱마다 갱신, 분 경계에서 DB upsert
- **재시작 영향**: 영속 데이터는 보존됨. 진행 중이던 부분 버킷은 폴러가 다음 분으로 넘어갈 때 새로 시작
- **갭 채움**: 폴러가 잠시 정지했다가 재개되면 빈 분(최대 1440분)을 마지막 종가로 채워 차트 갭 방지

## 조회 한계

`/api/candles?interval=X&limit=N` 호출 시 최대 100,000개의 1분봉을 fetch해 merge 합니다 (≈ 70일 분량). 그보다 더 긴 기간을 한 화면에 표시하려면 1시간/일 단위 별도 캔들 테이블을 추가하는 것을 권장합니다.

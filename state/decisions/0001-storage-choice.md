# ADR-0001: 저장소는 SQLite(기본) + Repository 포트, Supabase/Postgres는 P2 어댑터

## 상태: 채택 (v5)

## 맥락
백엔드 담당이 Supabase 도입을 제안. 2주 해커톤, 단일 데모 유저, 안전 중심
Human-in-the-loop MVP. 저장소는 이미 Repository 인터페이스 뒤에 있음
(ApplicationService는 구체 DB를 모름).

## 검토한 대안
| 안 | 강점 | 약점(이 프로젝트 기준) |
|---|---|---|
| A. SQLite + Repository 포트 (현행) | 설치 0, 오프라인·결정적 테스트, 인프로세스라 단일유저 최속, 데모 무네트워크 | 동시 다중유저·호스팅 지속성 약함 |
| B. Supabase (Postgres+Auth+RLS) | 실제 인증·다중유저·호스팅, RLS로 행단위 격리 | CI/테스트에 네트워크·시크릿·불안정 유입, 데모에 네트워크 실패면 추가, PostgREST 직결 시 Application Service 경계(안전 불변식) 우회 위험, 셋업 시간 = 대부분 P2 가치 |
| C. 순수 Postgres(Neon/psycopg) | 벤더 락 없음, 이식성 | 네트워크·셋업, 무료 인증 없음 |
| D. Firebase/Firestore | 실시간 | 관계·버전형 ProfileItem/스냅샷/감사 모델과 부적합, 로직이 클라이언트로 쏠림 |
| E. JSON/세션만 | 없음 | R-05 위반(세션=진실원천 금지), 새로고침 복구(REQ-7) 불가 |

## 결정
- **기본 저장소 = SQLite**, `Repository` 포트(domain/ports.py) 뒤에 둔다.
- Supabase/Postgres는 **P2(다중유저·호스팅 배포) 어댑터**로 예약. `PostgresRepository`
  참조 어댑터를 같은 포트로 제공(라이브 DB에서 계약 테스트로 검증).
- 저장소 선택은 환경변수 스위치로 두고 테스트/CI/데모는 SQLite·InMemory 유지.

## 근거
1. **성능:** 단일 유저 데모에서 인프로세스 SQLite가 네트워크 DB보다 빠르다.
   Supabase의 성능 이점은 동시 다중유저에서 나오며 MVP 시나리오가 아니다.
2. **CI/테스트 결정성:** 44개 안전 테스트가 오프라인·즉시 실행된다. 네트워크 DB는
   이 핵심 테스트에 불안정을 주입한다(plan: CI는 Fake·오프라인 재현 원칙).
3. **데모 안정성:** 라이브 발표 중 네트워크 실패 지점을 추가하지 않는다.
4. **안전 경계 보존:** 제품 불변식(미승인 누출 0·승인 스냅샷 유일 입력)은 앱 계층에서
   강제된다. Supabase의 RLS는 행 격리에 좋지만 이 불변식을 대체하지 못하며, PostgREST
   직결 패턴은 오히려 Application Service 경계를 우회시킬 수 있다.
5. **교체 비용:** 저장소가 포트 뒤에 있어 나중 전환은 어댑터 하나 추가로 끝난다.
   계약 테스트(test_repository_contract.py)가 어떤 어댑터든 동일 계약을 강제한다.

## 결과
저장소 결정을 지금 확정할 필요가 없어졌다. P2 배포/다중유저 시점에 Supabase 어댑터를
계약 테스트에 통과시키면 전환 완료. P0(Profile CRUD)를 밀어내지 않는다.

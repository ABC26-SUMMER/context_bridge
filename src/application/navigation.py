"""UI 진입 화면 결정 규칙.

프로필이 없는 사용자는 질문보다 Profile Builder를 먼저 완료한다.
Streamlit과 분리해 규칙을 단위 테스트할 수 있게 유지한다.
"""

PROFILE_SCREEN = "나의 카드"
MAIN_SCREEN = "Context Bridge 메인"
HISTORY_SCREEN = "사용 기록"
SCREEN_OPTIONS = [PROFILE_SCREEN, MAIN_SCREEN, HISTORY_SCREEN]


def resolve_screen(requested_screen: str, has_profile: bool) -> str:
    """빈 프로필이면 요청 화면과 무관하게 Profile Builder로 보낸다."""
    if not has_profile:
        return PROFILE_SCREEN
    if requested_screen not in SCREEN_OPTIONS:
        return PROFILE_SCREEN
    return requested_screen

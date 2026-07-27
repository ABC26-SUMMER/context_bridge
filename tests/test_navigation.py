from application.navigation import (
    HISTORY_SCREEN,
    MAIN_SCREEN,
    PROFILE_SCREEN,
    SCREEN_OPTIONS,
    resolve_screen,
)


def test_profile_screen_is_first_entry():
    assert SCREEN_OPTIONS[0] == PROFILE_SCREEN


def test_empty_profile_is_redirected_to_profile_builder():
    assert resolve_screen(MAIN_SCREEN, has_profile=False) == PROFILE_SCREEN
    assert resolve_screen(HISTORY_SCREEN, has_profile=False) == PROFILE_SCREEN


def test_existing_profile_keeps_requested_screen():
    assert resolve_screen(MAIN_SCREEN, has_profile=True) == MAIN_SCREEN
    assert resolve_screen(HISTORY_SCREEN, has_profile=True) == HISTORY_SCREEN


def test_unknown_screen_fails_closed_to_profile_builder():
    assert resolve_screen("알 수 없는 화면", has_profile=True) == PROFILE_SCREEN

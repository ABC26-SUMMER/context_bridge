from application.ui_state import (
    ANSWER_RESULT_KEY,
    COMPARISON_RESULT_KEY,
    COMPARE_WIDGET_KEY,
)


def test_widget_and_result_state_keys_are_distinct():
    assert len({
        COMPARE_WIDGET_KEY,
        COMPARISON_RESULT_KEY,
        ANSWER_RESULT_KEY,
    }) == 3


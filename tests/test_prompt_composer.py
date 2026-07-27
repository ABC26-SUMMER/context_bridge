from domain.composer import compose_prompt

def test_approved_value_present_in_prompt():
    prompt = compose_prompt("이번 방학에 뭘 공부할까?",
                            [{"label":"전공","value":"AISW"}])
    assert "AISW" in prompt

def test_excluded_value_absent_from_prompt():
    # REQ-1 / INV-1: 승인 스냅샷에 없는 값은 프롬프트에 존재하면 안 된다
    approved = [{"label":"전공","value":"AISW"}]
    prompt = compose_prompt("이번 방학에 뭘 공부할까?", approved)
    assert "하루 2시간" not in prompt   # 제외한 항목
    assert "무릎 관절염" not in prompt   # restricted

def test_empty_snapshot_has_no_profile_leak():
    prompt = compose_prompt("와이파이 연결법 알려줘", [])
    assert "AISW" not in prompt

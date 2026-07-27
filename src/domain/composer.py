"""Prompt Composer. 승인 스냅샷만 입력받는다 (INV-1, INV-3).
Profile Repository에 접근하지 않는다 (G2)."""

def compose_prompt(question, approved_items):
    """approved_items: [{'label':..., 'value':...}] — 승인된 항목만."""
    ctx = "\n".join(f"- {it['label']}: {it['value']}" for it in approved_items)
    block = f"\n\n[개인화 컨텍스트]\n{ctx}" if approved_items else ""
    return f"[질문]\n{question}{block}"


def compose_prompt_from_snapshot(question, snapshot):
    """승인 스냅샷만으로 프롬프트 구성 (INV-1, INV-3)."""
    approved = [{"label": it.label, "value": it.value} for it in snapshot.items]
    return compose_prompt(question, approved)

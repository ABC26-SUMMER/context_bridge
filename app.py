"""Context Bridge — Streamlit walking skeleton (3화면).
UI는 ApplicationService만 호출한다. DB/LLM 직접 접근 금지 (G2)."""
import sys, uuid, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent / "src"))
import streamlit as st
from application.bootstrap import build_service, seed_if_empty
from application.navigation import PROFILE_SCREEN, SCREEN_OPTIONS, resolve_screen
from application.ui_state import (
    ANSWER_RESULT_KEY,
    COMPARISON_RESULT_KEY,
    COMPARE_WIDGET_KEY,
)

USER = "demo-user-001"
DB = str(pathlib.Path(__file__).resolve().parent / "data" / "context_bridge.db")

@st.cache_resource
def _svc():
    svc, repo = build_service(DB)
    seed_if_empty(repo, USER)
    return svc

svc = _svc()
st.set_page_config(page_title="Context Bridge", page_icon="🧭")
st.title("🧭 Context Bridge")
st.caption("한마디만 해도, 나를 고려하는 AI — 승인한 정보만 사용합니다.")

profiles = svc.list_profiles(USER)
active_profile = svc.active_profile(USER)
profile = svc.get_profile(USER, active_profile.id)
requested_screen = st.sidebar.radio("화면", SCREEN_OPTIONS)
screen = resolve_screen(requested_screen, has_profile=bool(profile))

if not profile:
    st.info("개인화 답변을 시작하려면 먼저 나의 프로필 카드를 등록해주세요.")

# ---------------- 나의 카드 ----------------
if screen == PROFILE_SCREEN:
    st.header("🗂️ 상황 프로필")
    st.caption("상황별 프로필을 고른 뒤, 그 안의 카드를 수정하세요.")

    st.subheader("1. 사용할 프로필 선택")
    profile_by_id = {p.id: p for p in profiles}
    selected_profile_id = st.radio(
        "프로필",
        options=list(profile_by_id),
        index=list(profile_by_id).index(active_profile.id),
        format_func=lambda pid: (
            f"{profile_by_id[pid].icon} {profile_by_id[pid].name}"
            f" · 카드 {len(svc.get_profile(USER, pid))}개"
        ),
        key=f"profile_picker_{active_profile.id}",
        horizontal=True,
    )
    if selected_profile_id != active_profile.id:
        svc.select_profile(USER, selected_profile_id)
        for key in ("ask", "iid", "funnel", ANSWER_RESULT_KEY,
                    COMPARISON_RESULT_KEY):
            st.session_state.pop(key, None)
        st.rerun()

    with st.expander("➕ 새 프로필 만들기"):
        with st.form("create_profile_form", clear_on_submit=True):
            new_profile_name = st.text_input(
                "프로필 이름", placeholder="예: 취업 준비"
            )
            new_profile_description = st.text_input(
                "설명", placeholder="예: 취업과 자격증 공부에 사용하는 프로필"
            )
            if st.form_submit_button("프로필 만들기"):
                try:
                    svc.create_profile(
                        USER, new_profile_name, new_profile_description
                    )
                    st.success("새 프로필을 만들고 선택했습니다.")
                    st.rerun()
                except Exception as e:
                    st.warning(str(e))

    st.subheader(f"2. {active_profile.icon} {active_profile.name} 수정")
    if active_profile.description:
        st.caption(active_profile.description)

    with st.expander("프로필 이름·설명 수정"):
        edit_name = st.text_input(
            "이름", value=active_profile.name,
            key=f"profile_name_{active_profile.id}",
        )
        edit_description = st.text_input(
            "설명", value=active_profile.description,
            key=f"profile_desc_{active_profile.id}",
        )
        if st.button("프로필 정보 저장", key=f"profile_save_{active_profile.id}"):
            try:
                svc.update_profile(
                    USER, active_profile.id, edit_name, edit_description
                )
                st.success("프로필 정보를 저장했습니다.")
                st.rerun()
            except Exception as e:
                st.warning(str(e))

        if len(profiles) > 1:
            confirm_delete = st.checkbox(
                "이 프로필과 현재 카드들을 삭제하는 것을 확인합니다.",
                key=f"profile_delete_confirm_{active_profile.id}",
            )
            if st.button(
                "프로필 삭제",
                key=f"profile_delete_{active_profile.id}",
                disabled=not confirm_delete,
            ):
                try:
                    svc.delete_profile(USER, active_profile.id)
                    st.rerun()
                except Exception as e:
                    st.warning(str(e))
        else:
            st.caption("마지막 남은 프로필은 삭제할 수 없습니다.")

    with st.expander("➕ 카드 추가"):
        cat = st.selectbox(
            "종류", svc.categories(), key=f"add_cat_{active_profile.id}"
        )
        val = st.text_input("내용", key=f"add_val_{active_profile.id}")
        if st.button("추가") and val:
            try:
                svc.add_card(USER, cat, val, active_profile.id)
                st.success("추가했어요")
                st.rerun()
            except Exception as e:
                st.warning(str(e))

    for it in svc.get_profile(USER, active_profile.id):
        with st.container(border=True):
            c1, c2 = st.columns([4, 1])
            new_val = c1.text_input(
                it.category, value=it.value,
                key=f"v_{active_profile.id}_{it.id}",
            )
            on = c2.toggle(
                "사용", value=it.enabled,
                key=f"e_{active_profile.id}_{it.id}",
            )
            if it.sensitivity != "normal":
                tag = {"sensitive": "⚠️ 민감 정보(기본 해제)",
                       "restricted": "🔒 제한 정보(자동 사용 안 함)"}[it.sensitivity]
                st.caption(tag)
            b1, b2 = st.columns([1, 1])
            if b1.button("저장", key=f"s_{active_profile.id}_{it.id}"):
                try:
                    svc.edit_card(
                        USER, it.id, new_val, active_profile.id
                    )
                except Exception as e:
                    st.warning(str(e))
                if on != it.enabled:
                    svc.toggle_card(
                        USER, it.id, on, active_profile.id
                    )
                st.rerun()
            if b2.button("삭제", key=f"d_{active_profile.id}_{it.id}"):
                svc.delete_card(USER, it.id, active_profile.id)
                st.rerun()

elif screen == "Context Bridge 메인":
    st.header("질문하기")
    st.info(
        f"현재 프로필: {active_profile.icon} **{active_profile.name}** "
        f"· 활성 카드 {sum(1 for item in profile if item.enabled)}개"
    )
    examples = ["이번 방학에 뭘 공부하면 좋을까? 목표는 클라우드 엔지니어",
                "내일 친구 만나는데 뭐 하지? 동네에서",
                "와이파이 연결하는 법 알려줘"]
    cols = st.columns(len(examples))
    for i, ex in enumerate(examples):
        if cols[i].button(f"예시 {i+1}"):
            st.session_state["q"] = ex
    q = st.text_input("질문", key="q")

    if st.button("질문하기") and q:
        iid = str(uuid.uuid4())[:8]
        st.session_state["iid"] = iid
        st.session_state["ask"] = svc.ask(
            USER, q, iid, profile_id=active_profile.id
        )
        st.session_state.pop(ANSWER_RESULT_KEY, None)
        st.session_state.pop(COMPARISON_RESULT_KEY, None)

    ask = st.session_state.get("ask")
    if ask and ask.state == "UNSUPPORTED":
        st.warning("지원하는 질문 유형(학습 계획·외출 계획·사용법 설명)이 아닙니다. 질문을 바꿔보세요.")
    elif ask and ask.state == "AWAITING_APPROVAL":
        st.subheader("Context Preview — 사용할 정보를 확인하세요")
        st.write(f"분석된 의도: `{ask.intent}`")
        chosen = []
        for c in ask.candidates:
            label = f"**{c.category}**: {c.value}  \n_{svc.reason_text(c.reason_code)}_"
            if c.sensitivity == "sensitive":
                label += "  · ⚠️ 민감(기본 해제)"
            if st.checkbox(label, value=c.default_checked, key=f"chk_{c.item_id}"):
                chosen.append(c)
        compare = st.checkbox("일반 답변과 비교 (데모)", key=COMPARE_WIDGET_KEY)
        if st.button("이대로 답변"):
            approved_ids = [c.item_id for c in chosen]
            iid = st.session_state["iid"]
            st.session_state["funnel"] = (ask.total_cards, ask.policy_allowed,
                                          ask.question_related, len(approved_ids))
            if compare:
                st.session_state[COMPARISON_RESULT_KEY] = svc.approve_and_compare(
                    iid, approved_ids
                )
                st.session_state.pop(ANSWER_RESULT_KEY, None)
            else:
                st.session_state[ANSWER_RESULT_KEY] = svc.approve_and_generate(
                    iid, approved_ids
                )
                st.session_state.pop(COMPARISON_RESULT_KEY, None)

    cmp = st.session_state.get(COMPARISON_RESULT_KEY)
    ans = st.session_state.get(ANSWER_RESULT_KEY)
    if cmp:
        st.subheader("같은 질문, 다른 답변")
        g, pcol = st.columns(2)
        with g:
            st.markdown("**일반 AI**")
            st.write(cmp.general_answer)
        with pcol:
            st.markdown("**Context Bridge (내 상황 반영)**")
            st.write(cmp.personalized_answer)
    elif ans:
        st.subheader("당신에게 맞춘 답변")
        st.write(ans.answer)

    fn = st.session_state.get("funnel")
    if fn and (cmp or ans):
        total, allowed, related, approved = fn
        st.subheader("이 답변에 쓰인 정보 흐름")
        cols = st.columns(5)
        stages = [("전체 카드", total), ("정책 허용", allowed),
                  ("질문 관련", related), ("내가 승인", approved), ("AI 전달", approved)]
        for col, (label, n) in zip(cols, stages):
            col.metric(label, n)
        st.caption("승인한 카드 수 = AI에 전달된 카드 수. 그 외 어떤 정보도 답변에 쓰이지 않습니다.")

# ---------------- 사용 기록 ----------------
else:
    st.header("사용 기록")
    st.caption("대화 기록이 아니라 개인정보 활용 내역입니다.")
    profile_names = {p.id: f"{p.icon} {p.name}" for p in profiles}
    for row in reversed(svc.history(USER)):
        with st.expander(f"[{row['state']}] {row['question']}"):
            st.write(f"의도: `{row['intent']}`")
            st.write(
                "프로필: "
                + profile_names.get(row.get("profile_id"), "삭제된/이전 프로필")
            )
            if row.get("answer"):
                st.write(row["answer"])

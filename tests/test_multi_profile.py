import pathlib

import pytest

from application.service import ApplicationService, ProfileError
from infrastructure.memory_repository import InMemoryRepository
from llm.fakes import DefaultRelevantRanker, FakeGenerator

POLICY = str(
    pathlib.Path(__file__).resolve().parents[1] / "specs" / "context-policy.yaml"
)


def service():
    repo = InMemoryRepository()
    return ApplicationService(
        repo, DefaultRelevantRanker(), FakeGenerator(), POLICY
    ), repo


def test_create_select_update_and_delete_profile():
    svc, _ = service()
    default = svc.active_profile("u1")
    study = svc.create_profile("u1", "취업 준비", "자격증과 취업")
    assert svc.active_profile("u1").id == study.id

    svc.update_profile("u1", study.id, "클라우드 취업", "AWS와 DevOps")
    assert svc.active_profile("u1").name == "클라우드 취업"

    svc.select_profile("u1", default.id)
    assert svc.active_profile("u1").id == default.id
    svc.delete_profile("u1", study.id)
    assert [p.id for p in svc.list_profiles("u1")] == [default.id]


def test_last_profile_cannot_be_deleted():
    svc, _ = service()
    default = svc.active_profile("u1")
    with pytest.raises(ProfileError, match="마지막"):
        svc.delete_profile("u1", default.id)


def test_cards_are_isolated_between_profiles():
    svc, _ = service()
    default = svc.active_profile("u1")
    svc.add_card("u1", "career.goal", "백엔드 개발자", default.id)

    cloud = svc.create_profile("u1", "클라우드 취업")
    svc.add_card("u1", "career.goal", "클라우드 엔지니어", cloud.id)

    assert [i.value for i in svc.get_profile("u1", default.id)] == ["백엔드 개발자"]
    assert [i.value for i in svc.get_profile("u1", cloud.id)] == ["클라우드 엔지니어"]


def test_question_uses_only_selected_profile_cards():
    svc, _ = service()
    default = svc.active_profile("u1")
    svc.add_card("u1", "career.goal", "백엔드 개발자", default.id)
    cloud = svc.create_profile("u1", "클라우드 취업")
    cloud_card = svc.add_card(
        "u1", "career.goal", "클라우드 엔지니어", cloud.id
    )

    result = svc.ask(
        "u1", "방학 공부 계획, 목표는 엔지니어", "i1", cloud.id
    )
    assert result.profile_id == cloud.id
    assert {c.item_id for c in result.candidates} == {cloud_card.id}
    assert all(c.value != "백엔드 개발자" for c in result.candidates)


def test_switching_profile_after_preview_does_not_change_approval_snapshot():
    svc, repo = service()
    default = svc.active_profile("u1")
    svc.add_card("u1", "career.goal", "백엔드 개발자", default.id)
    cloud = svc.create_profile("u1", "클라우드 취업")
    cloud_card = svc.add_card(
        "u1", "career.goal", "클라우드 엔지니어", cloud.id
    )
    svc.ask("u1", "방학 공부 계획, 목표는 엔지니어", "i1", cloud.id)

    svc.select_profile("u1", default.id)
    svc.approve_and_generate("i1", [cloud_card.id])

    snapshot = repo.load_snapshot("i1")
    assert [item.value for item in snapshot.items] == ["클라우드 엔지니어"]


def test_duplicate_card_is_checked_per_profile():
    svc, _ = service()
    default = svc.active_profile("u1")
    svc.add_card("u1", "skills.current", "Python", default.id)
    other = svc.create_profile("u1", "다른 상황")
    svc.add_card("u1", "skills.current", "Python", other.id)
    assert len(svc.get_profile("u1", other.id)) == 1


def test_card_cannot_be_edited_through_another_profile():
    svc, _ = service()
    default = svc.active_profile("u1")
    card = svc.add_card("u1", "skills.current", "Python", default.id)
    other = svc.create_profile("u1", "다른 상황")

    with pytest.raises(ValueError, match="카드를 찾을 수 없습니다"):
        svc.edit_card("u1", card.id, "Java", other.id)
    assert svc.get_profile("u1", other.id) == []


def test_profile_deletion_keeps_existing_approval_snapshot():
    svc, repo = service()
    cloud = svc.create_profile("u1", "클라우드 취업")
    card = svc.add_card("u1", "career.goal", "클라우드 엔지니어", cloud.id)
    svc.ask("u1", "방학 공부 계획, 목표는 엔지니어", "i1", cloud.id)
    svc.approve_and_generate("i1", [card.id])

    svc.delete_profile("u1", cloud.id)
    snapshot = repo.load_snapshot("i1")
    assert [item.value for item in snapshot.items] == ["클라우드 엔지니어"]

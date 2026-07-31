import { describe, expect, it } from "vitest";
import {
  buildSurveyNarrative,
  surveyDefinitions,
  toggleSurveyChoice,
} from "./onboardingSurvey";

describe("온보딩 설문 구성", () => {
  it("모든 사용자 유형이 두 열에 맞는 10개 문항을 가진다", () => {
    for (const definition of Object.values(surveyDefinitions)) {
      expect(definition.fields).toHaveLength(10);
    }
  });

  it("모든 사용자 유형에서 집 기준 거주 지역을 필수로 묻는다", () => {
    for (const definition of Object.values(surveyDefinitions)) {
      const region = definition.fields.find((field) => field.id === "region");
      expect(region).toMatchObject({ required: true, category: "identity", cardTitle: "거주 지역" });
      expect(region?.label).toContain("집");
    }
  });

  it("대학생은 학교와 거주 지역을 서로 다른 정보로 받는다", () => {
    const studentFields = surveyDefinitions.university_student.fields;
    expect(studentFields.some((field) => field.id === "school")).toBe(true);
    expect(studentFields.some((field) => field.id === "region")).toBe(true);
  });

  it("직접 입력은 일반인과 고령자 1개, 대학생 2개만 사용한다", () => {
    expect(surveyDefinitions.custom.fields.filter((field) => field.type === "text")).toHaveLength(1);
    expect(surveyDefinitions.university_student.fields.filter((field) => field.type === "text")).toHaveLength(2);
    expect(surveyDefinitions.older_adult.fields.filter((field) => field.type === "text")).toHaveLength(1);
  });

  it("복수 답변이 자연스러운 이동, 시간, 관심 항목은 여러 개 고를 수 있다", () => {
    const multiFieldIds = {
      custom: ["activity", "goal", "transport", "availableTime", "recommendationStyle", "constraints"],
      university_student: ["major", "career", "experience", "studyTime", "scheduleConditions", "answerStyle"],
      older_adult: ["dailyActivities", "mobility", "transport", "answerStyle", "healthNotes"],
    } as const;

    for (const [personaType, fieldIds] of Object.entries(multiFieldIds)) {
      const fields = surveyDefinitions[personaType as keyof typeof surveyDefinitions].fields;
      for (const fieldId of fieldIds) {
        expect(fields.find((field) => field.id === fieldId)?.type).toBe("multi");
      }
    }
  });

  it("응답 거부 선택과 실제 선택을 동시에 유지하지 않는다", () => {
    expect(toggleSurveyChoice(["도보", "버스"], "답하지 않음")).toEqual(["답하지 않음"]);
    expect(toggleSurveyChoice(["특별한 조건 없음"], "예산 제한")).toEqual(["예산 제한"]);
  });

  it("정보가 아닌 응답 거부 선택은 AI용 문맥에서 제외한다", () => {
    const narrative = buildSurveyNarrative("older_adult", {
      purposes: ["생활 정보"],
      region: "수원시 영통구",
      healthNotes: ["특별한 주의 없음"],
    });
    expect(narrative).toContain("거주 지역: 수원시 영통구");
    expect(narrative).not.toContain("특별한 주의 없음");
  });
});

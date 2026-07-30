import { describe, expect, it } from "vitest";
import { toSpeechText } from "./speechText";

describe("toSpeechText", () => {
  it("쉼표, 별표, 슬래시 등 특수기호를 제거한다", () => {
    expect(toSpeechText("안녕하세요, **오늘/내일** 중 골라 주세요!"))
      .toBe("안녕하세요 오늘 내일 중 골라 주세요");
  });

  it("Markdown 링크는 주소를 읽지 않고 표시 문구만 남긴다", () => {
    expect(toSpeechText("[복지관 안내](https://example.com/guide)를 확인하세요."))
      .toBe("복지관 안내 를 확인하세요");
  });

  it("연속된 기호와 줄바꿈을 읽기 좋은 한 칸으로 정리한다", () => {
    expect(toSpeechText("1. 준비\n- 신분증\n- 카드 #필수"))
      .toBe("1 준비 신분증 카드 필수");
  });
});

import { describe, expect, it } from "vitest";
import { mergeSpeechSegments } from "./speechTranscript";

describe("mergeSpeechSegments", () => {
  it("keeps committed sentences while showing the current interim sentence", () => {
    const first = mergeSpeechSegments("", [
      { transcript: "키오스크 사용법 알려줘", isFinal: true },
      { transcript: "그리고", isFinal: false },
    ]);

    expect(first).toEqual({
      committed: "키오스크 사용법 알려줘",
      display: "키오스크 사용법 알려줘 그리고",
    });
  });

  it("appends later final sentences without replacing earlier speech", () => {
    const next = mergeSpeechSegments("키오스크 사용법 알려줘", [
      { transcript: "그리고 결제 방법도 알려줘", isFinal: true },
    ]);

    expect(next).toEqual({
      committed: "키오스크 사용법 알려줘 그리고 결제 방법도 알려줘",
      display: "키오스크 사용법 알려줘 그리고 결제 방법도 알려줘",
    });
  });
});

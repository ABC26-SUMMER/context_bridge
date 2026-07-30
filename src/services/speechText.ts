/**
 * 화면용 답변에서 음성 합성에 불필요한 Markdown과 특수기호를 제거합니다.
 * 글자와 숫자만 남기므로 쉼표, 별표, 슬래시 등을 TTS가 이름으로 읽지 않습니다.
 */
export function toSpeechText(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+|www\.\S+/gi, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

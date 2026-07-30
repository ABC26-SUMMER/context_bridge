export type SpeechSegment = {
  transcript: string;
  isFinal: boolean;
};

export function mergeSpeechSegments(committed: string, segments: SpeechSegment[]) {
  let nextCommitted = normalize(committed);
  const interim: string[] = [];

  for (const segment of segments) {
    const transcript = normalize(segment.transcript);
    if (!transcript) continue;

    if (segment.isFinal) {
      nextCommitted = joinText(nextCommitted, transcript);
    } else {
      interim.push(transcript);
    }
  }

  return {
    committed: nextCommitted,
    display: joinText(nextCommitted, interim.join(" ")),
  };
}

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function joinText(left: string, right: string) {
  return [left, right].filter(Boolean).join(" ");
}

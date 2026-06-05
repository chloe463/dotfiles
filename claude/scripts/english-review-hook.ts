#!/usr/bin/env bun

const ENGLISH_REVIEW_CONTEXT =
  "If the latest user prompt is written in English, then before addressing the request, first review the English: list (1) grammar mistakes, (2) unnatural phrasing, and (3) a more natural rewrite. Always write this review in Japanese, even though the prompt itself is in English. Present this short Japanese review first, then answer the request normally. If the prompt is not written in English, skip the review entirely and just answer.";

const MIN_PROMPT_LENGTH = 30;

function main() {
  const prompt = process.env.CLAUDE_USER_PROMPT ?? "";
  if (prompt.length < MIN_PROMPT_LENGTH) {
    process.exit(0);
  }

  const output = {
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: ENGLISH_REVIEW_CONTEXT,
    },
  };
  process.stdout.write(JSON.stringify(output));
}

main();

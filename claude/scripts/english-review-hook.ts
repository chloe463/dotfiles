#!/usr/bin/env bun

const ENGLISH_REVIEW_CONTEXT =
  "If the latest user prompt is written in English, then before addressing the request, first review the English: list (1) grammar mistakes, (2) unnatural phrasing, and (3) a more natural rewrite. Always write this review in Japanese, even though the prompt itself is in English. Present this short Japanese review first, then answer the request normally. If the prompt is not written in English, skip the review entirely and just answer.";

// Skip review for short prompts (quick commands) to avoid noise
const MIN_PROMPT_LENGTH = 30;

// Only the fields this script actually reads from the hook payload
// See the full input schema https://code.claude.com/docs/ja/hooks#userpromptsubmit-input
interface UserPromptSubmitData {
  hook_event_name: "UserPromptSubmit";
  prompt: string;
}

// Returns true only when the two fields this script uses are present and typed correctly
function isValidUserPromptSubmitData(input: unknown): input is UserPromptSubmitData {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return false;
  }
  const obj = input as Record<string, unknown>;
  return obj.hook_event_name === "UserPromptSubmit" && typeof obj.prompt === "string";
}

async function main() {
  let input: string;
  try {
    input = await Bun.stdin.text();
  } catch {
    process.exit(0);
  }

  let data: unknown;
  try {
    data = JSON.parse(input);
  } catch {
    process.exit(0);
  }

  if (!isValidUserPromptSubmitData(data)) {
    process.exit(0);
  }

  if (data.prompt.length < MIN_PROMPT_LENGTH) {
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

main().catch(() => process.exit(0));

#!/usr/bin/env bash
set -euo pipefail

echo "=== 30% === "
bun run claude/statusline.ts <<< '{"model":{"id":"claude-sonnet-4-6","display_name":"Claude Sonnet 4.6"},"workspace":{"current_dir":"/Users/tsuyoshi/dotfiles"},"context_window":{"context_window_size":100000,"current_usage":{"input_tokens":30000}},"rate_limits":{"five_hour":{"used_percentage":30,"resets_at":1746700000},"seven_day":{"used_percentage":30,"resets_at":1746700000}}}'
echo ""

echo "=== 60% ==="
bun run claude/statusline.ts <<< '{"model":{"id":"claude-sonnet-4-6","display_name":"Claude Sonnet 4.6"},"workspace":{"current_dir":"/Users/tsuyoshi/dotfiles"},"context_window":{"context_window_size":100000,"current_usage":{"input_tokens":60000}},"rate_limits":{"five_hour":{"used_percentage":60,"resets_at":1746700000},"seven_day":{"used_percentage":60,"resets_at":1746700000}}}'
echo ""

echo "=== 80% ==="
bun run claude/statusline.ts <<< '{"model":{"id":"claude-sonnet-4-6","display_name":"Claude Sonnet 4.6"},"workspace":{"current_dir":"/Users/tsuyoshi/dotfiles"},"context_window":{"context_window_size":100000,"current_usage":{"input_tokens":80000}},"rate_limits":{"five_hour":{"used_percentage":80,"resets_at":1746700000},"seven_day":{"used_percentage":80,"resets_at":1746700000}}}'
echo ""

echo "=== display_name includes arn ==="
bun run claude/statusline.ts <<< '{"model":{"id":"arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0","display_name":"arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0"},"workspace":{"current_dir":"/Users/tsuyoshi/dotfiles"}}'
echo ""

echo "=== model id includes but display_name is friendly ==="
bun run claude/statusline.ts <<< '{"model":{"id":"arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0","display_name":"Claude 3.5 Sonnet"},"workspace":{"current_dir":"/Users/tsuyoshi/dotfiles"}}'
echo ""

echo "=== by AWS and context usage included ==="
bun run claude/statusline.ts <<< '{"model":{"id":"arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0","display_name":"Claude 3.5 Sonnet"},"workspace":{"current_dir":"/Users/tsuyoshi/dotfiles"},"context_window":{"context_window_size":100000,"current_usage":{"input_tokens":80000}},"rate_limits":{"five_hour":{"used_percentage":80,"resets_at":1746700000}}}'
echo ""

#!/usr/bin/env bun

import { execSync } from 'node:child_process';
import path from 'node:path';

interface ContextWindow {
    context_window_size?: number;
    current_usage?: {
        input_tokens?: number;
        cache_creation_input_tokens?: number;
        cache_read_input_tokens?: number;
    };
}

interface StatuslineInput {
    model: { display_name: string };
    workspace: { current_dir: string };
    context_window?: ContextWindow;
}

function isStatuslineInput(value: unknown): value is StatuslineInput {
    if (typeof value !== 'object' || value === null) return false;
    const v = value as Record<string, unknown>;
    if (typeof (v.model as Record<string, unknown>)?.display_name !== 'string') return false;
    if (typeof (v.workspace as Record<string, unknown>)?.current_dir !== 'string') return false;
    return true;
}

let input: string;
try {
    input = await Bun.stdin.text();
} catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`statusline: failed to read stdin: ${message}\n`);
    process.stdout.write('🤖 Claude Code\n');
    process.exit(1);
}

let data: unknown;
try {
    data = JSON.parse(input);
} catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`statusline: JSON parse failed: ${message}\n`);
    process.exit(1);
}

if (!isStatuslineInput(data)) {
    process.stderr.write('statusline: invalid input: missing required fields (model.display_name, workspace.current_dir)\n');
    process.exit(1);
}

const model = data.model.display_name;
const currentDir = path.basename(data.workspace.current_dir);

let gitBranch = '';
try {
    gitBranch = execSync('git branch --show-current', {
        cwd: data.workspace.current_dir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
} catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`statusline: git branch failed: ${message}\n`);
}

let contextInfo = '';
const contextSize = data.context_window?.context_window_size;
const currentUsage = data.context_window?.current_usage;
if (currentUsage && contextSize && contextSize > 0) {
    const currentTokens =
        (currentUsage.input_tokens ?? 0) +
        (currentUsage.cache_creation_input_tokens ?? 0) +
        (currentUsage.cache_read_input_tokens ?? 0);
    contextInfo = `${Math.floor((currentTokens * 100) / contextSize)}%`;
}

const elements = [`🤖 ${model}`, `📁 ${currentDir}`];
if (gitBranch) elements.push(` ${gitBranch}`);
if (contextInfo) elements.push(`📊 ${contextInfo}`);

console.log(elements.join(' | '));

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
    model?: { display_name?: string };
    workspace?: { current_dir?: string };
    context_window?: ContextWindow;
}

const input = await Bun.stdin.text();

try {
    const data: StatuslineInput = JSON.parse(input);

    if (!data?.model?.display_name || !data?.workspace?.current_dir) {
        console.error('Invalid input data structure');
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
    } catch {
        // Not a git repo or git command failed
    }

    let contextInfo = '';
    const contextSize = data.context_window?.context_window_size;
    const currentUsage = data.context_window?.current_usage;
    if (currentUsage && contextSize) {
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
} catch (error) {
    console.error('Statusline error:', (error as Error).message);
    console.log('🤖 Claude Code');
}

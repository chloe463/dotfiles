#!/usr/bin/env node

import { execSync } from 'node:child_process';
import path from 'node:path';

// Read JSON from stdin
let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
    try {
        const data = JSON.parse(input);

        // Validate required fields
        if (!data?.model?.display_name || !data?.workspace?.current_dir) {
            console.error('Invalid input data structure');
            process.exit(1);
        }

        // Extract values
        const model = data.model.display_name;
        const currentDir = path.basename(data.workspace.current_dir);

        // Check for git branch
        let gitBranch = '';
        try {
            const cwd = data.workspace.current_dir;
            gitBranch = execSync('git branch --show-current', {
                cwd,
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'ignore']
            }).trim();
        } catch {
            // Not a git repo or git command failed
        }

        // Calculate context usage
        const contextSize = data.context_window?.context_window_size;
        const currentUsage = data.context_window?.current_usage;

        let contextInfo = '';
        if (currentUsage && contextSize) {
            // Calculate current tokens from current_usage fields
            const currentTokens =
                (currentUsage.input_tokens || 0) +
                (currentUsage.cache_creation_input_tokens || 0) +
                (currentUsage.cache_read_input_tokens || 0);

            const percentUsed = Math.floor((currentTokens * 100) / contextSize);
            contextInfo = `${percentUsed}%`;
        }

        const elements = [
            `🤖 ${model}`,
            `📁 ${currentDir}`,
        ];
        if (gitBranch) elements.push(` ${gitBranch}`);
        if (contextInfo) elements.push(`📊 ${contextInfo}`);

        console.log(elements.join(" | "));
    } catch (error) {
        console.error('Statusline error:', error.message);
        console.log('🤖 Claude Code'); // Fallback display
    }
});

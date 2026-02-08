#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

// Read JSON from stdin
let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
    const data = JSON.parse(input);
    
    // Extract values
    const model = data.model.display_name;
    const currentDir = path.basename(data.workspace.current_dir);
    
    // Check for git branch
    let gitBranch = '';
    try {
        const headContent = fs.readFileSync('.git/HEAD', 'utf8').trim();
        if (headContent.startsWith('ref: refs/heads/')) {
            gitBranch = headContent.replace('ref: refs/heads/', '');
        }
    } catch (e) {
        // Not a git repo or can't read HEAD
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
    if (gitBranch) elements.push(` ${gitBranch}`);
    if (contextInfo) elements.push(`📊 ${contextInfo}`);

    console.log(elements.join(" | "));

    // console.log(`🤖 ${model} 📁 ${currentDir}${gitBranch}${contextInfo}`);
});

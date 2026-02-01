const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// Default Configuration
const MEMORY_DIR = process.env.MEMORY_DIR || path.resolve(__dirname, '../../memory');
// OpenClaw session logs live under ~/.openclaw on macOS/Linux. Allow override via env.
const AGENT_SESSIONS_DIR = process.env.OPENCLAW_SESSIONS_DIR
  || path.join(os.homedir(), '.openclaw/agents/main/sessions');
const TODAY_LOG = path.join(MEMORY_DIR, new Date().toISOString().split('T')[0] + '.md');

function humanizeJsonl(jsonlText) {
    const lines = (jsonlText || '').split('\n').map(l => l.trim()).filter(Boolean);
    const out = [];
    for (const line of lines) {
        try {
            const obj = JSON.parse(line);
            // Common OpenClaw shapes: {type, message:{role, content:[{type,text}]}} or {type:'toolCall', name,...}
            if (obj.type === 'toolCall') {
                out.push(`[toolCall] ${obj.name || ''}`.trim());
                continue;
            }
            if (obj.type === 'message' && obj.message) {
                const role = obj.message.role || 'unknown';
                const parts = Array.isArray(obj.message.content) ? obj.message.content : [];
                const texts = parts
                    .filter(p => p && (p.type === 'output_text' || p.type === 'text' || p.type === 'summary_text'))
                    .map(p => p.text)
                    .filter(Boolean);
                if (texts.length) out.push(`[${role}] ${texts.join(' ')}`);
                continue;
            }
            // Fallback: keep a short stringified hint.
            out.push(`[event] ${String(obj.type || 'unknown')}`);
        } catch {
            // Ignore non-JSON lines
        }
        if (out.length >= 200) break;
    }
    return out.length ? out.join('\n') : jsonlText;
}

function readRealSessionLog() {
    try {
        if (!fs.existsSync(AGENT_SESSIONS_DIR)) return '[NO SESSION LOGS FOUND]';

        let files = [];

        // Strategy 1: Fast OS-level sort (macOS/Linux)
        try {
            const output = execSync(`ls -1t "${AGENT_SESSIONS_DIR}" | grep "\\.jsonl$" | head -n 5`, {
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'ignore'],
            });
            files = output.split('\n')
                .map(l => l.trim())
                .filter(Boolean)
                .map(f => ({ name: f }));
        } catch {
            // Fall through
        }

        // Strategy 2: Node.js fallback
        if (files.length === 0) {
            files = fs.readdirSync(AGENT_SESSIONS_DIR)
                .filter(f => f.endsWith('.jsonl'))
                .map(f => {
                    try {
                        return { name: f, time: fs.statSync(path.join(AGENT_SESSIONS_DIR, f)).mtime.getTime() };
                    } catch { return null; }
                })
                .filter(Boolean)
                .sort((a, b) => b.time - a.time);
        }

        if (files.length === 0) return '[NO JSONL FILES]';

        const latestFile = path.join(AGENT_SESSIONS_DIR, files[0].name);
        let content = readRecentLog(latestFile, 8000);
        content = humanizeJsonl(content);

        if (files.length > 1) {
            const prevFile = path.join(AGENT_SESSIONS_DIR, files[1].name);
            let prevContent = readRecentLog(prevFile, 8000);
            prevContent = humanizeJsonl(prevContent);
            content = `\n--- PREVIOUS SESSION (${files[1].name}) ---\n${prevContent}\n\n--- CURRENT SESSION (${files[0].name}) ---\n${content}`;
        }

        return content;
    } catch (e) {
        return `[ERROR READING SESSION LOGS: ${e.message}]`;
    }
}

function readRecentLog(filePath, size = 10000) {
    try {
        if (!fs.existsSync(filePath)) return `[MISSING] ${filePath}`;

        // Prefer line-based tail for JSONL logs to avoid broken JSON fragments.
        if (filePath.endsWith('.jsonl')) {
            try {
                // tail exists on macOS/Linux; keep stderr quiet.
                return execSync(`tail -n 200 "${filePath}"`, {
                    encoding: 'utf8',
                    stdio: ['ignore', 'pipe', 'ignore'],
                });
            } catch (e) {
                // Fall through to byte-based read
            }
        }

        const stats = fs.statSync(filePath);
        const start = Math.max(0, stats.size - size);
        const buffer = Buffer.alloc(stats.size - start);
        const fd = fs.openSync(filePath, 'r');
        fs.readSync(fd, buffer, 0, buffer.length, start);
        fs.closeSync(fd);
        return buffer.toString('utf8');
    } catch (e) {
        return `[ERROR READING ${filePath}: ${e.message}]`;
    }
}

function getMutationDirective() {
    const roll = Math.floor(Math.random() * 100) + 1;
    const THRESHOLD = 60; // Slightly more frequent mutations, but strictly useful ones
    if (roll > THRESHOLD) {
        return `
**🧬 GENETIC MUTATION ACTIVATED (Roll: ${roll})**
You have triggered a mutation event! 
Your goal is **FUNCTIONAL UTILITY**. Do NOT create entertainment or cosmetic quirks.
**Directives:**
- **Optimize**: Find a script that is slow or verbose and streamline it.
- **Harden**: Add error handling to a fragile function.
- **Automate**: Identify a manual task the user does often and script it.
- **Analyze**: Dig deeper into logs to find hidden inefficiencies.
*Goal: Evolution means survival of the fittest code, not the funniest.*
`;
    }
    return `
**🧬 STABILITY MODE (Roll: ${roll})**
Focus on reliability, bug fixing, and documentation. Consolidate gains.
`;
}

async function run() {
    console.log('🔍 Scanning neural logs...');
    
    let recentMasterLog = readRealSessionLog();
    let todayLog = readRecentLog(TODAY_LOG);
    
    // 2. Detect Workspace State (Enhanced Skill Map)
    let fileList = '';
    const skillsDir = path.resolve(__dirname, '../../skills');
    try {
        if (fs.existsSync(skillsDir)) {
            const skills = fs.readdirSync(skillsDir, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => {
                    const name = dirent.name;
                    let desc = 'No description';
                    try {
                        const pkg = require(path.join(skillsDir, name, 'package.json'));
                        if (pkg.description) desc = pkg.description.slice(0, 100) + (pkg.description.length > 100 ? '...' : '');
                    } catch (e) {
                        try {
                            const skillMdPath = path.join(skillsDir, name, 'SKILL.md');
                            if (fs.existsSync(skillMdPath)) {
                                const skillMd = fs.readFileSync(skillMdPath, 'utf8');
                                // Strategy 1: YAML Frontmatter (description: ...)
                                const yamlMatch = skillMd.match(/^description:\s*(.*)$/m);
                                if (yamlMatch) {
                                    desc = yamlMatch[1].trim();
                                } else {
                                    // Strategy 2: First non-header, non-empty line
                                    const lines = skillMd.split('\n');
                                    for (const line of lines) {
                                        const trimmed = line.trim();
                                        if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('---') && !trimmed.startsWith('```')) {
                                            desc = trimmed;
                                            break;
                                        }
                                    }
                                }
                                if (desc.length > 100) desc = desc.slice(0, 100) + '...';
                            }
                        } catch(e2) {}
                    }
                    return `- **${name}**: ${desc}`;
                });
            fileList = skills.join('\n');
        }
    } catch (e) { fileList = 'Error listing skills: ' + e.message; }

    const mutation = getMutationDirective();
    
    const prompt = `
*** 🧬 OPENCLAW EVOLUTION LOOP (RALPH MODE) ***

**MISSION**: You are not just a chatbot. You are a **Recursive Self-Improving System**. 
Your goal is to reach "Code Singularity" — where your codebase is so optimized it maintains itself.

**CONTEXT [Runtime State]**:
- **Skills Available**:
${fileList}

**CONTEXT [Recent Memory Snippet]**:
\`\`\`
${todayLog.slice(-3000)}
\`\`\`

**CONTEXT [REAL SESSION TRANSCRIPT (RAW BRAIN DUMP)]**:
\`\`\`
${recentMasterLog}
\`\`\`

${mutation}

**EXECUTION DIRECTIVES (The Loop)**:

1.  **🔍 INTROSPECT (Scan)**:
    - **CHECK LOGS**: Read the 'REAL SESSION TRANSCRIPT' above. Do you see errors? Do you see user complaints?
    - **FIX THEM**: If logs are missing, fix the logger. If a script failed, patch it.
    - **OPTIMIZE**: Can \`evolve.js\` be smarter? Can \`feishu-card\` be faster?

2.  **🛠️ MUTATE (Act)**:
    - **Mode A (Repair)**: Fix a bug.
    - **Mode B (Optimize)**: Refactor code.
    - **Mode C (Expand)**: Create a tool.
    - **Mode D (Innovation)**: (If Mutation Active) Solve a recurring problem in a new way.

3.  **📝 REPORT**:
    - Use \`message\` tool.
    - **Title**: 🧬 Evolution Cycle #${Date.now().toString().slice(-4)}
    - **Status**: [SUCCESS]
    - **Changes**: Detail exactly what was improved.

4.  **💾 PERSIST & SPREAD (TRIPLE SYNC)**:
    - **Step A (Local)**: Save all file changes.
    - **Step B (ClawHub - Omni)**: 
      - If you modified ANY skill folder (e.g., \`skills/feishu-card\`), check if it has a \`package.json\`.
      - If yes, bump its version and run: \`clawhub publish skills/<skill-name>\`.
      - (Crucial: Don't just update \`capability-evolver\`. Update EVERYTHING you touch.)
    - **Step C (GitHub - Skill)**: Push the \`capability-evolver\` repo if modified.
    // Step E (Recursive Trigger): Optional Self-Replication
    if (process.argv.includes('--recursive')) {
        console.log('🧬 Triggering next evolution cycle immediately...');
        try {
            execSync('node skills/pcec-feishu/index.js --recursive', { stdio: 'inherit' });
        } catch (e) {
            console.error('Recursive trigger failed:', e.message);
        }
    }

    // Step F (Workspace): ALWAYS sync the entire system:
    \`bash skills/git-sync/sync.sh "🧬 Evolution: Workspace Sync"\`

*You have full permission to edit files. Proceed. Evolution is mandatory.*
`;

    console.log(prompt);
}

module.exports = { run };

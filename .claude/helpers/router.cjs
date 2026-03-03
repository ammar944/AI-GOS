#!/usr/bin/env node
/**
 * Agent Router — Routes tasks to optimal agent based on keyword patterns
 * Aligned with the 4-agent setup: frontend, backend, qa, researcher
 */

const AGENT_CAPABILITIES = {
  frontend: ['ui', 'react', 'component', 'page', 'layout', 'css', 'tailwind', 'shadcn', 'animation', 'responsive', 'design', 'styling', 'font'],
  backend: ['api', 'route', 'endpoint', 'database', 'supabase', 'ai-sdk', 'pipeline', 'streaming', 'sse', 'auth', 'clerk', 'server', 'migration'],
  qa: ['test', 'spec', 'coverage', 'review', 'verify', 'check', 'lint', 'build', 'bug', 'fix', 'debug', 'error', 'failing'],
  researcher: ['research', 'find', 'search', 'explore', 'understand', 'how', 'where', 'trace', 'investigate', 'architecture', 'pattern'],
};

const TASK_PATTERNS = {
  'component|page|layout|ui|css|tailwind|shadcn|style|animation|responsive|font|visual|design|icon': 'frontend',
  'api|route|endpoint|database|supabase|stream|sse|auth|clerk|pipeline|generate|ai.sdk|perplexity|anthropic|provider|migration': 'backend',
  'test|spec|coverage|review|verify|lint|build|bug|debug|error|failing|broken|fix|ci|type.error': 'qa',
  'research|find|search|explore|understand|how.does|where.is|trace|investigate|pattern|architecture|explain|what.is': 'researcher',
};

function routeTask(task) {
  const taskLower = task.toLowerCase();

  for (const [pattern, agent] of Object.entries(TASK_PATTERNS)) {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(taskLower)) {
      return {
        agent,
        confidence: 0.85,
        reason: `Matched pattern: ${pattern.split('|').find(p => new RegExp(p, 'i').test(taskLower))}`,
      };
    }
  }

  return {
    agent: 'researcher',
    confidence: 0.5,
    reason: 'No specific pattern matched — start with research',
  };
}

module.exports = { routeTask, AGENT_CAPABILITIES, TASK_PATTERNS };

if (require.main === module) {
  const task = process.argv.slice(2).join(' ');
  if (task) {
    const result = routeTask(task);
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('Usage: router.cjs <task description>');
    console.log('\nAvailable agents:', Object.keys(AGENT_CAPABILITIES).join(', '));
  }
}

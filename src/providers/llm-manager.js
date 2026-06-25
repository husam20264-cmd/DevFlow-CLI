import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CONFIG_DIR = join(homedir(), '.devflow');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export class LLMProviderManager {
  constructor() {
    this.providers = new Map();
    this.currentProvider = null;
    this.config = this.loadConfig();
    this.registerBuiltinProviders();
  }

  registerBuiltinProviders() {
    this.register('openai', new OpenAIProvider());
    this.register('anthropic', new AnthropicProvider());
    this.register('ollama', new OllamaProvider());
    this.register('gemini', new GeminiProvider());
    this.register('local', new LocalProvider());
  }

  register(name, provider) {
    this.providers.set(name, provider);
  }

  async setProvider(name) {
    if (!this.providers.has(name)) {
      throw new Error(`Provider '${name}' not found. Available: ${this.listProviders().join(', ')}`);
    }
    this.currentProvider = this.providers.get(name);
    this.config.activeProvider = name;
    this.saveConfig();
    return this.currentProvider;
  }

  getProvider() {
    if (!this.currentProvider) {
      const name = this.config.activeProvider || 'ollama';
      this.currentProvider = this.providers.get(name) || this.providers.get('ollama');
    }
    return this.currentProvider;
  }

  listProviders() {
    return Array.from(this.providers.keys());
  }

  loadConfig() {
    if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
    if (!existsSync(CONFIG_FILE)) return { activeProvider: 'ollama', providers: {} };
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
  }

  saveConfig() {
    writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2));
  }

  setApiKey(provider, apiKey) {
    if (!this.config.providers) this.config.providers = {};
    this.config.providers[provider] = { apiKey };
    this.saveConfig();
  }

  getApiKey(provider) {
    return this.config.providers?.[provider]?.apiKey || process.env[`${provider.toUpperCase()}_API_KEY`];
  }

  async analyze(prompt, context = {}) {
    const provider = this.getProvider();
    return provider.analyze(prompt, context);
  }
}

class BaseProvider {
  constructor(name, config = {}) {
    this.name = name;
    this.config = config;
  }

  async analyze(prompt, context = {}) {
    throw new Error('analyze() must be implemented by provider');
  }

  formatContext(context) {
    const parts = [];
    if (context.projectStructure) parts.push(`Project Structure:\n${context.projectStructure}`);
    if (context.fileContent) parts.push(`File Content:\n${context.fileContent}`);
    if (context.relatedFiles) parts.push(`Related Files:\n${context.relatedFiles}`);
    if (context.errors) parts.push(`Errors:\n${context.errors}`);
    return parts.join('\n\n');
  }
}

class OpenAIProvider extends BaseProvider {
  constructor() {
    super('openai');
  }

  async analyze(prompt, context = {}) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not set');

    const systemPrompt = `You are an expert developer assistant. Analyze code and provide actionable steps.
Always respond in JSON format with:
{
  "plan": [{"step": number, "action": "description", "files": ["affected files"]}],
  "explanation": "clear explanation",
  "risks": ["potential risks"],
  "tests": ["suggested tests"]
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `${this.formatContext(context)}\n\nRequest: ${prompt}` }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      })
    });

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  }
}

class AnthropicProvider extends BaseProvider {
  constructor() {
    super('anthropic');
  }

  async analyze(prompt, context = {}) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

    const systemPrompt = `You are an expert developer assistant. Analyze code and provide actionable steps.
Always respond in JSON format with:
{
  "plan": [{"step": number, "action": "description", "files": ["affected files"]}],
  "explanation": "clear explanation",
  "risks": ["potential risks"],
  "tests": ["suggested tests"]
}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          { role: 'user', content: `${this.formatContext(context)}\n\nRequest: ${prompt}` }
        ]
      })
    });

    const data = await response.json();
    const content = data.content[0].text;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch[0]);
  }
}

class OllamaProvider extends BaseProvider {
  constructor() {
    super('ollama');
    this.baseUrl = 'http://localhost:11434';
  }

  async analyze(prompt, context = {}) {
    const systemPrompt = `You are an expert developer assistant. Analyze code and provide actionable steps.
Always respond in JSON format with:
{
  "plan": [{"step": number, "action": "description", "files": ["affected files"]}],
  "explanation": "clear explanation",
  "risks": ["potential risks"],
  "tests": ["suggested tests"]
}`;

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'codellama:7b',
        prompt: `${this.formatContext(context)}\n\nRequest: ${prompt}`,
        system: systemPrompt,
        format: 'json',
        stream: false
      })
    });

    const data = await response.json();
    return JSON.parse(data.response);
  }
}

class GeminiProvider extends BaseProvider {
  constructor() {
    super('gemini');
  }

  async analyze(prompt, context = {}) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    const systemPrompt = `You are an expert developer assistant. Analyze code and provide actionable steps.
Always respond in JSON format with:
{
  "plan": [{"step": number, "action": "description", "files": ["affected files"]}],
  "explanation": "clear explanation",
  "risks": ["potential risks"],
  "tests": ["suggested tests"]
}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: `${this.formatContext(context)}\n\nRequest: ${prompt}` }] }],
          generationConfig: { temperature: 0.3, responseMimeType: 'application/json' }
        })
      }
    );

    const data = await response.json();
    return JSON.parse(data.candidates[0].content.parts[0].text);
  }
}

class LocalProvider extends BaseProvider {
  constructor() {
    super('local');
    this.modelPath = null;
  }

  async analyze(prompt, context = {}) {
    // Uses llama.cpp or similar local inference
    throw new Error('Local provider requires manual setup. Use: devflow provider local --model /path/to/model');
  }
}

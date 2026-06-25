# I Built an Open-Source AI CLI Assistant for Safer Developer Workflows 🚀

As software developers, we've all faced the anxiety of applying automated changes directly to our codebase. Standard AI coding tools often act like a black box—modifying files in the background without giving you a clear view of what changed.

That’s why I built **DevFlow CLI**. It’s a privacy-aware, review-first AI assistant designed for developers who want structured implementation plans, safer code changes, and automated project checks directly from the terminal.

---

## 📹 Quick Workflow Demo

Here is how DevFlow CLI safely plans and validates code modifications:

![DevFlow CLI Workflow](https://raw.githubusercontent.com/husam20264-cmd/DevFlow-CLI/main/docs/demo.gif)

---

## 💡 Why DevFlow CLI?

1. **Review-First Design (Dry-Run by Default)**: DevFlow generates complete implementation plans and shows exactly what changes would be made *before* modifying any file on disk. Changes are only applied when you pass the `--apply` flag.
2. **Multi-LLM Support (Free & Open Source)**: Bring your own key or run fully local and offline. DevFlow integrates out of the box with:
   - **Ollama** (Local/Offline)
   - **llama.cpp** (Local/Offline)
   - **OpenAI**
   - **Anthropic (Claude)**
   - **Google Gemini**
3. **Safety Guards**: Includes built-in protection against path traversal, warning flags for hardcoded credentials/secrets, and requires explicit confirmation for sensitive commands or files (like `.env`).
4. **Pull-Request Autopilot**: Automatically generates PR titles, descriptions, and checklists based on the applied plan.

---

## 🚀 Get Started in 60 Seconds

```bash
# 1. Install globally
npm install -g devflow-cli

# 2. Set up your API key (or use local Ollama)
export OPENAI_API_KEY=your_key_here

# 3. Ask DevFlow to plan your feature safely
devflow plan "Add JWT authentication"
```

---

## 🛡️ Enterprise Support & Private Deployments

While all core features and model integrations are 100% free and open-source, we also provide **Enterprise Integrations** for engineering teams requiring:
- Internal custom model configurations
- Azure OpenAI / AWS Bedrock / Vertex AI private setups
- On-premise deployments (Docker / Kubernetes)
- Single Sign-On (SSO) and Team Permissions
- Complete Audit Logs and Custom Security Policies

Read more about [Enterprise offerings here](https://github.com/husam20264-cmd/DevFlow-CLI/blob/main/ENTERPRISE.md).

---

## 🤝 Open Source & Contributing

DevFlow CLI is MIT licensed. I would love to hear your feedback, issues, and feature requests. 

Check out the repository, leave a ⭐ if you like the project, and let's make AI-driven development safer and cleaner!

🔗 **GitHub Repository**: [https://github.com/husam20264-cmd/DevFlow-CLI](https://github.com/husam20264-cmd/DevFlow-CLI)

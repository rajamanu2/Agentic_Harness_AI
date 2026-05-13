import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUp,
  Bot,
  CheckCircle2,
  ChevronDown,
  Code2,
  Copy,
  Cpu,
  Folder,
  GitBranch,
  KeyRound,
  Loader2,
  Network,
  PanelLeft,
  Pencil,
  Plus,
  ShieldCheck,
  Sparkles,
  Workflow
} from "lucide-react";
import "./styles.css";

const BRAND_NAME = "AgenticaHarness";
const ENGINE_NAME = "AgenticaHarness";

const defaultProjects = [
  { id: "harness", name: BRAND_NAME, path: "." },
  { id: "workspace", name: "Parent Workspace", path: ".." },
  { id: "salesforce", name: "Salesforce App", path: "../salesforce" }
];

const openingMessage = {
  id: "hello",
  role: "assistant",
  text: `Message ${BRAND_NAME} and I will stay with the selected project.`
};

const heroMetrics = [
  { value: "09", label: "harness stages" },
  { value: "12", label: "context signals" },
  { value: "24/7", label: "agent runtime" }
];

const blueprintCards = [
  {
    icon: Network,
    title: "Context Map",
    body: "Turns repo, docs, tickets, logs, and memory into a grounded operating picture.",
    tone: "cyan"
  },
  {
    icon: Workflow,
    title: "Agent Flow",
    body: "Routes work through planner, implementer, verifier, and delivery loops.",
    tone: "mint"
  },
  {
    icon: ShieldCheck,
    title: "Guarded Tools",
    body: "Keeps terminal, Git, cloud, and database actions behind explicit risk gates.",
    tone: "amber"
  },
  {
    icon: Cpu,
    title: "Model Core",
    body: "Connects native, local, and helper models into one live chat surface.",
    tone: "rose"
  }
];

const pipelineStages = [
  {
    step: "01",
    title: "Intent Intake",
    body: "Capture the user goal, target project, constraints, and acceptance criteria.",
    signal: "Chat, API, ticket"
  },
  {
    step: "02",
    title: "Stack Scan",
    body: "Detect frameworks, commands, deployment markers, and verification paths.",
    signal: "Adapters"
  },
  {
    step: "03",
    title: "Context Build",
    body: "Summarize the right files and memories before any model starts work.",
    signal: "Grounded facts"
  },
  {
    step: "04",
    title: "Planner Loop",
    body: "Split work into bounded agent tasks with tools, gates, and fallback routes.",
    signal: "Work graph"
  },
  {
    step: "05",
    title: "Execute + Verify",
    body: "Run approved changes, tests, browser checks, and repair loops.",
    signal: "Evidence"
  },
  {
    step: "06",
    title: "Deliver",
    body: "Return the answer, artifact, preview, PR packet, or deployment handoff.",
    signal: "Traceable output"
  }
];

const specs = [
  ["Tool policy", "MCP, OpenAPI, CLI, browser, Git, cloud, and native tools with risk levels."],
  ["Runtime modes", "Plan-only, supervised, and lab execution paths for different confidence levels."],
  ["Model routes", "Native engine, Qwen core, helper routes, NVIDIA, AirLLM, Ollama, and custom APIs."],
  ["Verification", "Tests, builds, browser smoke checks, security checks, and human gates before delivery."]
];

const useCases = [
  "Generate and modify live app previews",
  "Plan safe Salesforce and cloud delivery",
  "Scan unfamiliar repos before coding",
  "Route a local model into private work"
];

const launchPrompts = [
  "Scan my selected project and map the harness stages.",
  "Build a live app and verify it before delivery.",
  "Connect this repo to the safest local AI model."
];

function safeId(prefix = "id") {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function defaultModelConfig() {
  return {
    provider: "agentica-native",
    providerName: `${BRAND_NAME} Native Engine`,
    apiKey: "",
    baseUrl: "",
    model: "agentica-brain"
  };
}

function hasStoredModelConfig() {
  return Boolean(localStorage.getItem("agentica.modelConfig"));
}

async function request(path, init) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request failed with ${response.status}`);
  }

  return response.json();
}

const api = {
  runs: () => request("/api/runs"),
  latestChat: (repoPath = "") => request(`/api/chats/latest${repoPath ? `?repoPath=${encodeURIComponent(repoPath)}` : ""}`),
  modelStatus: () => request("/api/model-status"),
  modelProviders: () => request("/api/model-providers"),
  mcpStatus: () => request("/api/mcp/status"),
  providerModels: (body) =>
    request("/api/provider-models", {
      method: "POST",
      body: JSON.stringify(body)
    }),
  chat: (body) =>
    request("/api/chat", {
      method: "POST",
      body: JSON.stringify(body)
    })
};

function storedModelConfig() {
  try {
    const parsed = JSON.parse(localStorage.getItem("agentica.modelConfig") || "null");
    if (parsed?.provider) {
      const isOldAgenticaHelperRoute = parsed.provider === "openai" && parsed.model === "openai-fast" && !parsed.apiKey;
      const isOldHarnessDefault = parsed.provider === "glm-standard" || parsed.model === "glm-5.1-standard";
      return isOldAgenticaHelperRoute || isOldHarnessDefault ? defaultModelConfig() : parsed;
    }
  } catch {
    // Ignore broken local storage.
  }

  return defaultModelConfig();
}

function normalizeModelConfig(current, provider) {
  const baseUrl = normalizeProviderBaseUrl(provider, current.baseUrl, current.apiKey);
  const model = current.model || provider?.defaultModel || (provider?.id === "agentica-native" ? "agentica-brain" : provider?.id === "agentica-free-helper" ? "openai-fast" : "");
  return {
    ...current,
    provider: provider?.id ?? current.provider,
    providerName: provider?.name ?? current.providerName,
    baseUrl,
    model
  };
}

function normalizeProviderBaseUrl(provider, currentBaseUrl, apiKey) {
  if (!provider) return currentBaseUrl || "";
  if (provider.id === "agentica-free-helper" && (!apiKey || /api\.openai\.com/.test(currentBaseUrl || ""))) {
    return provider.baseUrl || "";
  }
  return currentBaseUrl || provider.baseUrl || "";
}

function conversationHistory(messages) {
  return messages
    .filter((message) => message.id !== "hello" && (message.role === "user" || message.role === "assistant"))
    .slice(-12)
    .map((message) => ({
      role: message.role,
      content: String(message.text || "").slice(0, 2400)
    }));
}

function hydrateChatMessages(thread) {
  const messages = Array.isArray(thread?.messages) ? thread.messages : [];
  const restored = messages
    .filter((message) => message?.role === "user" || message?.role === "assistant")
    .map((message) => ({
      id: message.id || safeId(message.role),
      role: message.role,
      text: String(message.text || ""),
      kind: message.kind,
      liveUrl: message.liveUrl,
      projectDirectory: message.projectDirectory
    }))
    .filter((message) => message.text.trim());
  return restored.length ? restored : [openingMessage];
}

function BlueprintVisual() {
  return (
    <div className="blueprint-visual" aria-label="AgenticaHarness operating map">
      <div className="grid-plane" />
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />
      <div className="orbit orbit-three" />
      <div className="signal-node node-one" />
      <div className="signal-node node-two" />
      <div className="signal-node node-three" />
      <div className="signal-node node-four" />
      <div className="model-core">
        <span className="core-mark">
          <Bot size={32} />
        </span>
        <strong>AI Core</strong>
        <small>context -&gt; tools -&gt; verify</small>
      </div>
      <div className="visual-chip chip-one">scan</div>
      <div className="visual-chip chip-two">plan</div>
      <div className="visual-chip chip-three">deliver</div>
    </div>
  );
}

function App() {
  const [projects, setProjects] = useState(defaultProjects);
  const [activeProjectId, setActiveProjectId] = useState(defaultProjects[0].id);
  const [messages, setMessages] = useState([openingMessage]);
  const [threadId, setThreadId] = useState(null);
  const [draft, setDraft] = useState("");
  const [newProjectPath, setNewProjectPath] = useState("");
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [providers, setProviders] = useState([]);
  const [modelConfig, setModelConfig] = useState(storedModelConfig);
  const [availableModels, setAvailableModels] = useState([]);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelError, setModelError] = useState("");
  const [mcpStatus, setMcpStatus] = useState({ enabled: false, openCount: 0, totalCount: 0, servers: [] });
  const [godMode] = useState(() => {
    const stored = localStorage.getItem("agentica.godMode");
    return stored == null ? true : stored === "true";
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const endRef = useRef(null);

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) ?? projects[0],
    [activeProjectId, projects]
  );
  const activeProvider = useMemo(
    () => providers.find((provider) => provider.id === modelConfig.provider),
    [providers, modelConfig.provider]
  );
  const visibleMessages = messages.filter((message) => message.id !== "hello");
  const hasConversation = visibleMessages.length > 0;
  const modelLive = Boolean(modelConfig.provider && modelConfig.model);
  const modelLabel = modelLive
    ? (modelConfig.provider === "agentica-native" ? BRAND_NAME : modelConfig.provider === "agentica-qwen-core" ? "Qwen Core" : modelConfig.model)
    : "Model";
  const recentTurns = visibleMessages.filter((message) => message.role === "user").slice(-5).reverse();
  const taskTitle = recentTurns[0]?.text ? recentTurns[0].text.replace(/\s+/g, " ").slice(0, 64) : "New task";
  const statusLabel = busy ? "Running" : "Ready";
  const mcpServers = Array.isArray(mcpStatus.servers) ? mcpStatus.servers : [];
  const mcpOpenCount = mcpStatus.openCount ?? mcpServers.filter((server) => server.status !== "offline").length;
  const modelRoutes = Array.isArray(mcpStatus.modelRoutes) ? mcpStatus.modelRoutes : [];
  const modelReadyCount = modelRoutes.filter((route) => ["native", "online", "configured", "available"].includes(route.status)).length;
  const modelRoutePreview = [...modelRoutes]
    .sort((a, b) => {
      const priority = ["agentica-native", "ollama", "nvidia", "agentica-free-helper"];
      const left = priority.includes(a.id) ? priority.indexOf(a.id) : priority.length;
      const right = priority.includes(b.id) ? priority.indexOf(b.id) : priority.length;
      return left - right;
    })
    .slice(0, 3);

  useEffect(() => {
    Promise.all([
      api.runs(),
      api.modelStatus(),
      api.modelProviders(),
      api.mcpStatus().catch(() => ({ enabled: false, openCount: 0, totalCount: 0, servers: [] })),
      api.latestChat().catch(() => ({ thread: null }))
    ])
      .then(([runs, _status, nextProviders, nextMcpStatus, latestChat]) => {
        setProviders(nextProviders);
        setMcpStatus(nextMcpStatus);
        setModelConfig((current) => {
          const configuredQwenCore = nextProviders.find((candidate) => candidate.id === "agentica-qwen-core" && candidate.configured);
          const provider = !hasStoredModelConfig() && configuredQwenCore
            ? configuredQwenCore
            : nextProviders.find((candidate) => candidate.id === current.provider) ?? nextProviders[0];
          return normalizeModelConfig(current, provider);
        });

        const recentProjects = runs
          .map((run) => run.scan?.repoPath)
          .filter(Boolean)
          .slice(0, 5)
          .map((repoPath) => ({
            id: `recent-${repoPath}`,
            name: repoPath.split(/[\\/]/).filter(Boolean).slice(-1)[0] || repoPath,
            path: repoPath
          }));

        setProjects((current) => mergeProjects(current, recentProjects));
        if (latestChat?.thread?.messages?.length) {
          const thread = latestChat.thread;
          setThreadId(thread.id);
          setMessages(hydrateChatMessages(thread));

          if (thread.repoPath) {
            const restoredProject = {
              id: `chat-${thread.repoPath}`,
              name: thread.repoPath.split(/[\\/]/).filter(Boolean).slice(-1)[0] || "Saved Chat Project",
              path: thread.repoPath
            };
            setProjects((current) => mergeProjects([restoredProject, ...current], []));
            setActiveProjectId(restoredProject.id);
          }
        }
      })
      .catch(() => setProjects(defaultProjects));
  }, []);

  useEffect(() => {
    if (visibleMessages.length > 0 || busy) {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [visibleMessages.length, busy]);

  async function sendMessage(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    await askAgent(text);
  }

  async function askAgent(text) {
    const history = conversationHistory(messages);
    setMessages((current) => [...current, { id: safeId("message"), role: "user", text }]);
    setDraft("");
    setBusy(true);
    setError(null);

    try {
      const reply = await api.chat({
        message: text,
        threadId,
        history,
        repoPath: activeProject.path,
        modelConfig: modelConfig.provider && modelConfig.model ? modelConfig : null,
        options: { mode: godMode ? "god" : "normal", godMode, mcp: { openCount: mcpOpenCount } }
      });
      const run = reply.run;
      if (reply.threadId) setThreadId(reply.threadId);

      setMessages((current) => [
        ...current,
        {
          id: run?.id ?? safeId("reply"),
          role: "assistant",
          text: reply.text,
          kind: reply.kind,
          liveUrl: reply.liveUrl,
          projectDirectory: reply.projectDirectory
        }
      ]);

      if (run?.scan?.repoPath) {
        setProjects((current) =>
          mergeProjects(current, [
            {
              id: `run-${run.scan.repoPath}`,
              name: activeProject.name,
              path: run.scan.repoPath
            }
          ])
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Chat failed";
      setError(message);
      setMessages((current) => [
        ...current,
        {
          id: safeId("error"),
          role: "assistant",
          text: `I could not do that yet.\n\n${message}`
        }
      ]);
    } finally {
      setBusy(false);
    }
  }

  function openProjectPicker() {
    setProjectsOpen(true);
  }

  function editUserMessage(text) {
    if (busy) return;
    setDraft(text);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 0);
  }

  function addProject(event) {
    event.preventDefault();
    const projectPath = newProjectPath.trim();
    if (!projectPath) return;

    const name = projectPath.split(/[\\/]/).filter(Boolean).slice(-1)[0] || "New Project";
    const project = { id: safeId("project"), name, path: projectPath };
    setProjects((current) => mergeProjects([project, ...current], []));
    selectProject(project);
    setNewProjectPath("");
  }

  function selectProject(project) {
    setActiveProjectId(project.id);
    setMessages([openingMessage]);
    setThreadId(null);
    setProjectsOpen(false);
  }

  function updateModelConfig(patch) {
    setModelConfig((current) => {
      const next = { ...current, ...patch };
      if (patch.provider) {
        const provider = providers.find((candidate) => candidate.id === patch.provider);
        next.providerName = provider?.name ?? patch.provider;
        next.baseUrl = provider?.baseUrl ?? "";
        next.model = provider?.defaultModel ?? "";
        setAvailableModels([]);
        setModelError("");
      }
      return next;
    });
  }

  async function loadModels() {
    setModelLoading(true);
    setModelError("");
    try {
      const result = await api.providerModels(modelConfig);
      setAvailableModels(result.models || []);
      if (result.error) setModelError(result.error);
      if (!modelConfig.model && result.models?.[0]) {
        updateModelConfig({ model: result.models[0].id });
      }
    } catch (err) {
      setModelError(err instanceof Error ? err.message : "Could not load models");
      setAvailableModels([]);
    } finally {
      setModelLoading(false);
    }
  }

  async function saveModelConfig(event) {
    event.preventDefault();
    setModelLoading(true);
    setModelError("");

    const next = {
      ...normalizeModelConfig(modelConfig, activeProvider),
      providerName: activeProvider?.name ?? modelConfig.provider
    };

    if (!next.model) {
      try {
        const result = await api.providerModels(next);
        setAvailableModels(result.models || []);
        if (result.models?.[0]) {
          next.model = result.models[0].id;
        } else {
          setModelError(result.error || "No models returned by this provider.");
          return;
        }
      } catch (err) {
        setModelError(err instanceof Error ? err.message : "Could not load models");
        return;
      } finally {
        setModelLoading(false);
      }
    } else {
      setModelLoading(false);
    }

    localStorage.setItem("agentica.modelConfig", JSON.stringify(next));
    setModelConfig(next);
    if (next.provider === "agentica-free-helper" && next.apiKey) localStorage.setItem("agentica.helperKey", next.apiKey);
    setModelOpen(false);
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <button className="icon-button" aria-label="Projects" onClick={() => setProjectsOpen(true)}>
          <PanelLeft size={20} />
        </button>
        <div className="brand-lockup" aria-label={BRAND_NAME}>
          <span className="brand-mark">
            <Bot size={18} />
          </span>
          <span>
            <strong>{BRAND_NAME}</strong>
            <small>{ENGINE_NAME}</small>
          </span>
        </div>
        <nav className="site-nav" aria-label="Blueprint sections">
          <a href="#capabilities">Capabilities</a>
          <a href="#flow">Flow</a>
          <a href="#specs">Specs</a>
          <a href="#use-cases">Use cases</a>
        </nav>
        <button className="model-header" type="button" onClick={() => setModelOpen((current) => !current)}>
          <KeyRound size={16} />
          <span>{modelLabel}</span>
          <ChevronDown size={15} />
        </button>
      </header>

      {projectsOpen && <button className="drawer-scrim" aria-label="Close projects" onClick={() => setProjectsOpen(false)} />}

      <aside className={projectsOpen ? "projects-drawer open" : "projects-drawer"}>
        <div className="drawer-heading">
          <strong>Projects</strong>
          <button aria-label="Close projects" onClick={() => setProjectsOpen(false)}>
            <PanelLeft size={18} />
          </button>
        </div>

        <div className="project-list">
          {projects.map((project) => (
            <button
              key={project.id}
              className={project.id === activeProjectId ? "project active" : "project"}
              onClick={() => selectProject(project)}
            >
              <Folder size={16} />
              <span>
                <strong>{project.name}</strong>
                <small>{project.path}</small>
              </span>
            </button>
          ))}
        </div>

        <form className="project-add" onSubmit={addProject}>
          <input
            aria-label="Project path"
            placeholder="Add project path"
            value={newProjectPath}
            onChange={(event) => setNewProjectPath(event.target.value)}
          />
          <button aria-label="Add project">
            <Plus size={16} />
          </button>
        </form>
      </aside>

      {modelOpen && (
        <ModelPopover
          providers={providers}
          modelConfig={modelConfig}
          updateModelConfig={updateModelConfig}
          availableModels={availableModels}
          modelLoading={modelLoading}
          modelError={modelError}
          loadModels={loadModels}
          saveModelConfig={saveModelConfig}
        />
      )}

      <main className="blueprint-page">
        <section className="hero-section" id="top">
          <div className="hero-copy">
            <div className="eyebrow">
              <span />
              AgenticaHarness
            </div>
            <h1>The harness where AI stops guessing and starts working.</h1>
            <p>
              A scroll-mapped control surface for the {ENGINE_NAME} pipeline: context first, tools under policy,
              verification before delivery, and the live chat model waiting at the final station.
            </p>
            <div className="hero-actions">
              <a className="primary-cta" href="#ai-console">
                Launch AI
                <ArrowUp size={17} />
              </a>
              <a className="secondary-cta" href="#flow">
                Map the flow
              </a>
            </div>
            <div className="hero-metrics" aria-label="Harness metrics">
              {heroMetrics.map((metric) => (
                <span key={metric.label}>
                  <strong>{metric.value}</strong>
                  <small>{metric.label}</small>
                </span>
              ))}
            </div>
          </div>

          <BlueprintVisual />
        </section>

        <section className="capabilities-section" id="capabilities">
          <div className="section-heading">
            <span>Capabilities</span>
            <h2>Every model call sits inside a real operating harness.</h2>
          </div>
          <div className="capability-grid">
            {blueprintCards.map(({ icon: Icon, title, body, tone }) => (
              <article className={`capability-card ${tone}`} key={title}>
                <span className="card-icon">
                  <Icon size={22} />
                </span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="flow-section" id="flow">
          <div className="flow-visual" aria-hidden="true">
            <div className="flow-ring">
              <span>intake</span>
              <span>scan</span>
              <span>plan</span>
              <span>verify</span>
            </div>
            <div className="flow-core">
              <Sparkles size={30} />
              <strong>Harness Core</strong>
            </div>
          </div>
          <div className="flow-copy">
            <div className="section-heading align-left">
              <span>Scroll blueprint</span>
              <h2>From user intent to traceable delivery.</h2>
            </div>
            <div className="pipeline-list">
              {pipelineStages.map((stage) => (
                <article className="pipeline-step" key={stage.step}>
                  <span className="step-number">{stage.step}</span>
                  <div>
                    <h3>{stage.title}</h3>
                    <p>{stage.body}</p>
                  </div>
                  <small>{stage.signal}</small>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="specs-section" id="specs">
          <div className="section-heading">
            <span>Specs</span>
            <h2>Built for actual execution, not only impressive answers.</h2>
          </div>
          <div className="spec-table">
            {specs.map(([label, detail]) => (
              <div className="spec-row" key={label}>
                <strong>{label}</strong>
                <p>{detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="use-case-section" id="use-cases">
          <div className="use-case-copy">
            <div className="section-heading align-left">
              <span>Use cases</span>
              <h2>One harness for web apps, repos, local models, and delivery work.</h2>
            </div>
            <p>
              The chat model at the end is the control point. From there, the AI can scan the selected project,
              create live previews, run verification, and hand back the result with the same project context.
            </p>
          </div>
          <div className="use-case-list">
            {useCases.map((item) => (
              <div className="use-case" key={item}>
                <CheckCircle2 size={19} />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={hasConversation ? "ai-console active-chat" : "ai-console"} id="ai-console">
          <div className="console-intro">
            <div className="eyebrow">
              <span />
              final station // live model
            </div>
            <h2>Now hand it to the AI.</h2>
            <p>
              Choose the project and model, then send the instruction. The existing {ENGINE_NAME} chat API remains
              wired here, so this is where your AI starts working.
            </p>
            <div className="console-status">
              <span>
                <GitBranch size={16} />
                {activeProject.name}
              </span>
              <span>
                <KeyRound size={16} />
                {modelLive ? modelLabel : "Select model"}
              </span>
            </div>
          </div>

          <div className="console-shell">
            {!hasConversation && (
              <div className="console-empty">
                <span className="home-mark">
                  <Bot size={30} />
                </span>
                <h3>What should the harness do first?</h3>
                <div className="prompt-suggestions">
                  {launchPrompts.map((prompt) => (
                    <button type="button" key={prompt} onClick={() => setDraft(prompt)}>
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {hasConversation && (
              <section className="messages console-messages" aria-live="polite">
                {visibleMessages.map((message) => (
                  <article key={message.id} className={`message ${message.role}`}>
                    {message.role === "user" ? (
                      <>
                        <div className="bubble">
                          <MessageContent text={message.text} />
                        </div>
                        <div className="message-actions" aria-label="Message actions">
                          <button type="button" aria-label="Copy message" onClick={() => copyText(message.text)}>
                            <Copy size={18} />
                          </button>
                          <button type="button" aria-label="Edit message" onClick={() => editUserMessage(message.text)}>
                            <Pencil size={18} />
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="assistant-row">
                        <span className="assistant-avatar">
                          <Bot size={17} />
                        </span>
                        <div className="assistant-response">
                          <MessageContent text={message.text} />
                          {message.liveUrl && (
                            <GeneratedProjectActions
                              liveUrl={message.liveUrl}
                              projectDirectory={message.projectDirectory}
                              onModify={() => {
                                setDraft(`Modify this live app: ${message.liveUrl}\n`);
                                setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 0);
                              }}
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </article>
                ))}
              </section>
            )}

            {busy && (
              <article className="message assistant thinking-message">
                <div className="assistant-row">
                  <span className="assistant-avatar">
                    <Bot size={17} />
                  </span>
                  <div className="typing">
                    <Loader2 size={17} />
                    Thinking...
                  </div>
                </div>
              </article>
            )}
            <div ref={endRef} />

            {error && <div className="chat-error">{error}</div>}

            <PromptBox
              draft={draft}
              setDraft={setDraft}
              busy={busy}
              activeProject={activeProject}
              sendMessage={sendMessage}
              modelLive={modelLive}
              modelLabel={modelLabel}
              onModelClick={() => setModelOpen((current) => !current)}
              onAddClick={openProjectPicker}
              onProjectClick={openProjectPicker}
              large
            />
          </div>
        </section>
      </main>
    </div>
  );
}

function CleanApp() {
  const [projects, setProjects] = useState(defaultProjects);
  const [activeProjectId, setActiveProjectId] = useState(defaultProjects[0].id);
  const [messages, setMessages] = useState([openingMessage]);
  const [threadId, setThreadId] = useState(null);
  const [draft, setDraft] = useState("");
  const [newProjectPath, setNewProjectPath] = useState("");
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [providers, setProviders] = useState([]);
  const [modelConfig, setModelConfig] = useState(storedModelConfig);
  const [availableModels, setAvailableModels] = useState([]);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelError, setModelError] = useState("");
  const [mcpStatus, setMcpStatus] = useState({ enabled: false, openCount: 0, totalCount: 0, servers: [] });
  const [godMode] = useState(() => {
    const stored = localStorage.getItem("agentica.godMode");
    return stored == null ? true : stored === "true";
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const endRef = useRef(null);

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) ?? projects[0],
    [activeProjectId, projects]
  );
  const activeProvider = useMemo(
    () => providers.find((provider) => provider.id === modelConfig.provider),
    [providers, modelConfig.provider]
  );
  const visibleMessages = messages.filter((message) => message.id !== "hello");
  const hasConversation = visibleMessages.length > 0;
  const modelLive = Boolean(modelConfig.provider && modelConfig.model);
  const modelLabel = modelLive
    ? (modelConfig.provider === "agentica-native" ? BRAND_NAME : modelConfig.provider === "agentica-qwen-core" ? "Qwen Core" : modelConfig.model)
    : "Model";
  const recentTurns = visibleMessages.filter((message) => message.role === "user").slice(-5).reverse();
  const taskTitle = recentTurns[0]?.text ? recentTurns[0].text.replace(/\s+/g, " ").slice(0, 64) : "New task";
  const statusLabel = busy ? "Running" : "Ready";
  const mcpServers = Array.isArray(mcpStatus.servers) ? mcpStatus.servers : [];
  const mcpOpenCount = mcpStatus.openCount ?? mcpServers.filter((server) => server.status !== "offline").length;
  const modelRoutes = Array.isArray(mcpStatus.modelRoutes) ? mcpStatus.modelRoutes : [];
  const modelReadyCount = modelRoutes.filter((route) => ["native", "online", "configured", "available"].includes(route.status)).length;
  const modelRoutePreview = [...modelRoutes]
    .sort((a, b) => {
      const priority = ["agentica-native", "ollama", "nvidia", "agentica-free-helper"];
      const left = priority.includes(a.id) ? priority.indexOf(a.id) : priority.length;
      const right = priority.includes(b.id) ? priority.indexOf(b.id) : priority.length;
      return left - right;
    })
    .slice(0, 3);

  useEffect(() => {
    Promise.all([
      api.runs(),
      api.modelStatus(),
      api.modelProviders(),
      api.mcpStatus().catch(() => ({ enabled: false, openCount: 0, totalCount: 0, servers: [] })),
      api.latestChat().catch(() => ({ thread: null }))
    ])
      .then(([runs, _status, nextProviders, nextMcpStatus, latestChat]) => {
        setProviders(nextProviders);
        setMcpStatus(nextMcpStatus);
        setModelConfig((current) => {
          const configuredQwenCore = nextProviders.find((candidate) => candidate.id === "agentica-qwen-core" && candidate.configured);
          const provider = !hasStoredModelConfig() && configuredQwenCore
            ? configuredQwenCore
            : nextProviders.find((candidate) => candidate.id === current.provider) ?? nextProviders[0];
          return normalizeModelConfig(current, provider);
        });

        const recentProjects = runs
          .map((run) => run.scan?.repoPath)
          .filter(Boolean)
          .slice(0, 5)
          .map((repoPath) => ({
            id: `recent-${repoPath}`,
            name: repoPath.split(/[\\/]/).filter(Boolean).slice(-1)[0] || repoPath,
            path: repoPath
          }));

        setProjects((current) => mergeProjects(current, recentProjects));
        if (latestChat?.thread?.messages?.length) {
          const thread = latestChat.thread;
          setThreadId(thread.id);
          setMessages(hydrateChatMessages(thread));

          if (thread.repoPath) {
            const restoredProject = {
              id: `chat-${thread.repoPath}`,
              name: thread.repoPath.split(/[\\/]/).filter(Boolean).slice(-1)[0] || "Saved Chat Project",
              path: thread.repoPath
            };
            setProjects((current) => mergeProjects([restoredProject, ...current], []));
            setActiveProjectId(restoredProject.id);
          }
        }
      })
      .catch(() => setProjects(defaultProjects));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function sendMessage(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    await askAgent(text);
  }

  async function askAgent(text) {
    const history = conversationHistory(messages);
    setMessages((current) => [...current, { id: safeId("message"), role: "user", text }]);
    setDraft("");
    setBusy(true);
    setError(null);

    try {
      const reply = await api.chat({
        message: text,
        threadId,
        history,
        repoPath: activeProject.path,
        modelConfig: modelConfig.provider && modelConfig.model ? modelConfig : null,
        options: { mode: godMode ? "god" : "normal", godMode, mcp: { openCount: mcpOpenCount } }
      });
      const run = reply.run;
      if (reply.threadId) setThreadId(reply.threadId);

      setMessages((current) => [
        ...current,
        {
          id: run?.id ?? safeId("reply"),
          role: "assistant",
          text: reply.text,
          kind: reply.kind,
          liveUrl: reply.liveUrl,
          projectDirectory: reply.projectDirectory
        }
      ]);

      if (run?.scan?.repoPath) {
        setProjects((current) =>
          mergeProjects(current, [
            {
              id: `run-${run.scan.repoPath}`,
              name: activeProject.name,
              path: run.scan.repoPath
            }
          ])
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Chat failed";
      setError(message);
      setMessages((current) => [
        ...current,
        {
          id: safeId("error"),
          role: "assistant",
          text: `I could not do that yet.\n\n${message}`
        }
      ]);
    } finally {
      setBusy(false);
    }
  }

  function openProjectPicker() {
    setProjectsOpen(true);
  }

  function editUserMessage(text) {
    if (busy) return;
    setDraft(text);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 0);
  }

  function addProject(event) {
    event.preventDefault();
    const projectPath = newProjectPath.trim();
    if (!projectPath) return;

    const name = projectPath.split(/[\\/]/).filter(Boolean).slice(-1)[0] || "New Project";
    const project = { id: safeId("project"), name, path: projectPath };
    setProjects((current) => mergeProjects([project, ...current], []));
    selectProject(project);
    setNewProjectPath("");
  }

  function selectProject(project) {
    setActiveProjectId(project.id);
    setMessages([openingMessage]);
    setThreadId(null);
    setProjectsOpen(false);
  }

  function updateModelConfig(patch) {
    setModelConfig((current) => {
      const next = { ...current, ...patch };
      if (patch.provider) {
        const provider = providers.find((candidate) => candidate.id === patch.provider);
        next.providerName = provider?.name ?? patch.provider;
        next.baseUrl = provider?.baseUrl ?? "";
        next.model = provider?.defaultModel ?? "";
        setAvailableModels([]);
        setModelError("");
      }
      return next;
    });
  }

  async function loadModels() {
    setModelLoading(true);
    setModelError("");
    try {
      const result = await api.providerModels(modelConfig);
      setAvailableModels(result.models || []);
      if (result.error) setModelError(result.error);
      if (!modelConfig.model && result.models?.[0]) {
        updateModelConfig({ model: result.models[0].id });
      }
    } catch (err) {
      setModelError(err instanceof Error ? err.message : "Could not load models");
      setAvailableModels([]);
    } finally {
      setModelLoading(false);
    }
  }

  async function saveModelConfig(event) {
    event.preventDefault();
    setModelLoading(true);
    setModelError("");

    const next = {
      ...normalizeModelConfig(modelConfig, activeProvider),
      providerName: activeProvider?.name ?? modelConfig.provider
    };

    if (!next.model) {
      try {
        const result = await api.providerModels(next);
        setAvailableModels(result.models || []);
        if (result.models?.[0]) {
          next.model = result.models[0].id;
        } else {
          setModelError(result.error || "No models returned by this provider.");
          return;
        }
      } catch (err) {
        setModelError(err instanceof Error ? err.message : "Could not load models");
        return;
      } finally {
        setModelLoading(false);
      }
    } else {
      setModelLoading(false);
    }

    localStorage.setItem("agentica.modelConfig", JSON.stringify(next));
    setModelConfig(next);
    if (next.provider === "agentica-free-helper" && next.apiKey) localStorage.setItem("agentica.helperKey", next.apiKey);
    setModelOpen(false);
  }

  return (
    <div className="app-shell cosine-shell">
      <aside className="task-rail" aria-label="AgenticaHarness workspace">
        <div className="rail-brand" aria-label={BRAND_NAME}>
          <span className="brand-mark">
            <Bot size={18} />
          </span>
          <span>
            <strong>{BRAND_NAME}</strong>
            <small>agent workspace</small>
          </span>
        </div>

        <button
          className="rail-new-task"
          type="button"
          onClick={() => {
            setMessages([openingMessage]);
            setThreadId(null);
            setDraft("");
            setError(null);
          }}
        >
          <Plus size={17} />
          New task
        </button>

        <div className="rail-section">
          <span className="rail-label">Workspace</span>
          <button className="rail-item" type="button" onClick={openProjectPicker}>
            <Folder size={16} />
            <span>
              <strong>{activeProject.name}</strong>
              <small>Project</small>
            </span>
          </button>
          <button className="rail-item" type="button" onClick={() => setModelOpen((current) => !current)}>
            <KeyRound size={16} />
            <span>
              <strong>{modelLabel}</strong>
              <small>{modelLive ? "Model connected" : "Select model"}</small>
            </span>
          </button>
        </div>

        <div className="rail-section">
          <span className="rail-label">Native tools</span>
          <div className="rail-mcp-summary">
            <span className={mcpOpenCount > 0 ? "status-dot active" : "status-dot"} />
            <span>
              <strong>{mcpOpenCount} available</strong>
              <small>{mcpStatus.totalCount || mcpServers.length} discovered</small>
            </span>
          </div>
          {mcpServers.slice(0, 3).map((server) => (
            <div className="rail-mcp-server" key={server.id || server.name}>
              <span>{server.name}</span>
              <small>{server.status || server.transport}</small>
            </div>
          ))}
        </div>

        <div className="rail-section">
          <span className="rail-label">AI routes</span>
          <div className="rail-mcp-summary">
            <span className={modelReadyCount > 0 ? "status-dot active" : "status-dot"} />
            <span>
              <strong>{modelReadyCount} ready</strong>
              <small>{modelRoutes.length} routes checked</small>
            </span>
          </div>
          {modelRoutePreview.map((route) => (
            <div className="rail-mcp-server" key={route.id || route.name}>
              <span>{route.name}</span>
              <small>{route.status}</small>
            </div>
          ))}
        </div>

        <div className="rail-section rail-grow">
          <span className="rail-label">Recent tasks</span>
          {recentTurns.length ? (
            recentTurns.map((turn) => (
              <button className="rail-task" type="button" key={turn.id} onClick={() => setDraft(turn.text)}>
                <span>{turn.text.replace(/\s+/g, " ").slice(0, 72)}</span>
                <small>Use again</small>
              </button>
            ))
          ) : (
            <div className="rail-empty">No tasks yet</div>
          )}
        </div>

        <div className="rail-status">
          <span className={busy ? "status-dot active" : "status-dot"} />
          <span>
            <strong>{statusLabel}</strong>
            <small>{godMode ? "Agent mode" : "Normal mode"}</small>
          </span>
        </div>
      </aside>

      <div className="agent-workspace">
        <header className="app-header task-header">
          <button className="icon-button mobile-project-button" aria-label="Projects" onClick={() => setProjectsOpen(true)}>
            <PanelLeft size={20} />
          </button>
          <div className="task-heading">
            <span>Task</span>
            <strong>{taskTitle}</strong>
          </div>
          <div className="task-header-actions">
            <button className="project-pill" type="button" onClick={openProjectPicker}>
              <Folder size={16} />
              <span>{activeProject.name}</span>
            </button>
            <span className="task-status">
              <span className={busy ? "status-dot active" : "status-dot"} />
              {statusLabel}
            </span>
            <button className="model-header" type="button" onClick={() => setModelOpen((current) => !current)}>
              <KeyRound size={16} />
              <span>{modelLabel}</span>
              <ChevronDown size={15} />
            </button>
          </div>
        </header>

        {projectsOpen && <button className="drawer-scrim" aria-label="Close projects" onClick={() => setProjectsOpen(false)} />}

        <aside className={projectsOpen ? "projects-drawer open" : "projects-drawer"}>
          <div className="drawer-heading">
            <strong>Projects</strong>
            <button aria-label="Close projects" onClick={() => setProjectsOpen(false)}>
              <PanelLeft size={18} />
            </button>
          </div>

          <div className="project-list">
            {projects.map((project) => (
              <button
                key={project.id}
                className={project.id === activeProjectId ? "project active" : "project"}
                onClick={() => selectProject(project)}
              >
                <Folder size={16} />
                <span>
                  <strong>{project.name}</strong>
                  <small>{project.path}</small>
                </span>
              </button>
            ))}
          </div>

          <form className="project-add" onSubmit={addProject}>
            <input
              aria-label="Project path"
              placeholder="Add project path"
              value={newProjectPath}
              onChange={(event) => setNewProjectPath(event.target.value)}
            />
            <button aria-label="Add project">
              <Plus size={16} />
            </button>
          </form>
        </aside>

        {modelOpen && (
          <ModelPopover
            providers={providers}
            modelConfig={modelConfig}
            updateModelConfig={updateModelConfig}
            availableModels={availableModels}
            modelLoading={modelLoading}
            modelError={modelError}
            loadModels={loadModels}
            saveModelConfig={saveModelConfig}
          />
        )}

        {!hasConversation ? (
          <main className="home-screen agent-stage">
            <section className="home-intro agent-empty">
              <span className="home-mark">
                <Bot size={30} />
              </span>
              <h1>{BRAND_NAME}</h1>
              <p>What should AgenticaHarness work on?</p>
              <div className="runtime-badges" aria-label="AgenticaHarness runtime status">
                <span>{mcpOpenCount} native tools</span>
                <span>{modelReadyCount} AI routes</span>
              </div>
              <div className="prompt-suggestions">
                {launchPrompts.map((prompt) => (
                  <button type="button" key={prompt} onClick={() => setDraft(prompt)}>
                    {prompt}
                  </button>
                ))}
              </div>
            </section>
            <div className="agent-composer">
              <PromptBox
                draft={draft}
                setDraft={setDraft}
                busy={busy}
                activeProject={activeProject}
                sendMessage={sendMessage}
                modelLive={modelLive}
                modelLabel={modelLabel}
                onModelClick={() => setModelOpen((current) => !current)}
                onAddClick={openProjectPicker}
                onProjectClick={openProjectPicker}
                large
              />
            </div>
          </main>
        ) : (
          <main className="chat-screen agent-stage">
            <section className="messages" aria-live="polite">
              {visibleMessages.map((message) => (
                <article key={message.id} className={`message ${message.role}`}>
                  {message.role === "user" ? (
                    <>
                      <div className="bubble">
                        <MessageContent text={message.text} />
                      </div>
                      <div className="message-actions" aria-label="Message actions">
                        <button type="button" aria-label="Copy message" onClick={() => copyText(message.text)}>
                          <Copy size={18} />
                        </button>
                        <button type="button" aria-label="Edit message" onClick={() => editUserMessage(message.text)}>
                          <Pencil size={18} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="assistant-row">
                      <span className="assistant-avatar">
                        <Bot size={17} />
                      </span>
                      <div className="assistant-response">
                        <MessageContent text={message.text} />
                        {message.liveUrl && (
                          <GeneratedProjectActions
                            liveUrl={message.liveUrl}
                            projectDirectory={message.projectDirectory}
                            onModify={() => {
                              setDraft(`Modify this live app: ${message.liveUrl}\n`);
                              setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 0);
                            }}
                          />
                        )}
                      </div>
                    </div>
                  )}
                </article>
              ))}
              {busy && (
                <article className="message assistant">
                  <div className="assistant-row">
                    <span className="assistant-avatar">
                      <Bot size={17} />
                    </span>
                    <div className="typing">
                      <Loader2 size={17} />
                      Thinking...
                    </div>
                  </div>
                </article>
              )}
              <div ref={endRef} />
            </section>

            {error && <div className="chat-error">{error}</div>}

            <div className="chat-composer-wrap agent-composer">
              <PromptBox
                draft={draft}
                setDraft={setDraft}
                busy={busy}
                activeProject={activeProject}
                sendMessage={sendMessage}
                modelLive={modelLive}
                modelLabel={modelLabel}
                onModelClick={() => setModelOpen((current) => !current)}
                onAddClick={openProjectPicker}
                onProjectClick={openProjectPicker}
              />
            </div>
          </main>
        )}
      </div>
    </div>
  );
}

function GeneratedProjectActions({ liveUrl, projectDirectory, onModify }) {
  return (
    <div className="generated-actions">
      <button type="button" className="generated-primary" onClick={() => window.location.assign(liveUrl)}>
        Open preview
        <ArrowUp size={16} />
      </button>
      <button type="button" onClick={onModify}>
        Modify this
      </button>
      {projectDirectory && <span title={projectDirectory}>Project linked</span>}
    </div>
  );
}

function MessageContent({ text }) {
  return parseMessageParts(text).map((part, index) =>
    part.type === "code" ? (
      <CodeBlock key={`code-${index}`} language={part.language} code={part.value} />
    ) : (
      <TextBlock key={`text-${index}`} text={part.value} />
    )
  );
}

function TextBlock({ text }) {
  return text.split("\n").map((line, index) => <MessageLine key={`${line}-${index}`} line={line} />);
}

function MessageLine({ line }) {
  if (!line) return <p className="empty-line"> </p>;
  const heading = line.match(/^##\s+(.+)$/);
  if (heading) return <h3 className="md-heading">{renderInlineMarkdown(heading[1])}</h3>;

  const bullet = line.match(/^(\s*)-\s+(.+)$/);
  if (bullet) {
    const nested = bullet[1].length > 0;
    return (
      <p className={nested ? "md-bullet nested" : "md-bullet"}>
        <span aria-hidden="true">-</span>
        <span>{renderInlineMarkdown(bullet[2])}</span>
      </p>
    );
  }

  return <p>{renderInlineMarkdown(line)}</p>;
}

function renderInlineMarkdown(text) {
  const parts = [];
  const pattern = /(\*\*[^*]+\*\*|https?:\/\/[^\s]+|\/artifacts\/[^\s]+|\/live-projects\/[^\s]+)/g;
  let cursor = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) parts.push(text.slice(cursor, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      parts.push(<strong key={`strong-${match.index}`}>{token.slice(2, -2)}</strong>);
    } else {
      const isLocalRoute = token.startsWith("/");
      parts.push(
        <a key={`link-${match.index}`} href={token} target={isLocalRoute ? undefined : "_blank"} rel={isLocalRoute ? undefined : "noreferrer"}>
          {token}
        </a>
      );
    }
    cursor = match.index + token.length;
  }

  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts.length ? parts : text;
}

function CodeBlock({ language, code }) {
  return (
    <div className="code-card">
      <div className="code-header">
        <span>
          <Code2 size={17} />
          <strong>{language || "code"}</strong>
        </span>
        <button type="button" aria-label="Copy code" onClick={() => copyText(code)}>
          <Copy size={18} />
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function parseMessageParts(text = "") {
  const parts = [];
  const fence = /```([\w-]*)\n([\s\S]*?)```/g;
  let cursor = 0;
  let match;

  while ((match = fence.exec(text)) !== null) {
    if (match.index > cursor) {
      parts.push({ type: "text", value: text.slice(cursor, match.index) });
    }
    parts.push({ type: "code", language: match[1]?.trim(), value: match[2].trimEnd() });
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) {
    parts.push({ type: "text", value: text.slice(cursor) });
  }

  return parts.length ? parts : [{ type: "text", value: text }];
}

function copyText(value) {
  navigator.clipboard?.writeText(value).catch(() => {});
}

function ModelPopover({
  providers,
  modelConfig,
  updateModelConfig,
  availableModels,
  modelLoading,
  modelError,
  loadModels,
  saveModelConfig
}) {
  const activeProvider = providers.find((provider) => provider.id === modelConfig.provider);

  return (
    <div className="model-popover">
      <form onSubmit={saveModelConfig}>
        <div className="popover-title">
          <strong>Model</strong>
          <span>{activeProvider?.name || modelConfig.providerName || BRAND_NAME}</span>
        </div>

        <label>
          Provider
          <select value={modelConfig.provider} onChange={(event) => updateModelConfig({ provider: event.target.value })}>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Base URL
          <input
            placeholder={activeProvider?.baseUrl || "No base URL needed"}
            value={modelConfig.baseUrl || ""}
            onChange={(event) => updateModelConfig({ baseUrl: event.target.value })}
          />
        </label>

        <label>
          API Key
          <input
            placeholder={activeProvider?.needsKey ? "Required" : "Optional"}
            type="password"
            value={modelConfig.apiKey || ""}
            onChange={(event) => updateModelConfig({ apiKey: event.target.value })}
          />
        </label>

        <button className="load-models" type="button" onClick={loadModels} disabled={modelLoading}>
          {modelLoading ? <Loader2 size={16} /> : <ChevronDown size={16} />}
          {modelLoading ? "Loading" : "Load models"}
        </button>

        {availableModels.length > 0 && (
          <label>
            Model
            <select value={modelConfig.model || ""} onChange={(event) => updateModelConfig({ model: event.target.value })}>
              {availableModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label>
          Model ID
          <input
            placeholder="Enter model id"
            value={modelConfig.model || ""}
            onChange={(event) => updateModelConfig({ model: event.target.value })}
          />
        </label>

        {modelError && <div className="model-error">{modelError}</div>}
        <button className="save-model" disabled={modelLoading}>
          {modelLoading ? "Preparing" : "Use model"}
        </button>
      </form>
    </div>
  );
}

function PromptBox({
  draft,
  setDraft,
  busy,
  activeProject,
  sendMessage,
  modelLive,
  modelLabel,
  onModelClick,
  onAddClick,
  onProjectClick,
  large = false
}) {
  const canSend = Boolean(draft.trim()) && !busy;

  return (
    <form className={large ? "prompt-box large" : "prompt-box"} onSubmit={sendMessage}>
      <textarea
        aria-label="Message"
        placeholder={`Message ${BRAND_NAME}`}
        rows={1}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            sendMessage(event);
          }
        }}
      />

      <div className="composer-row">
        <div className="composer-tools">
          <button className="tool-button" type="button" aria-label="Add or switch project" title={activeProject.path} onClick={onAddClick || onProjectClick}>
            <Plus size={17} />
          </button>
          <button className="project-pill" type="button" title={activeProject.path} onClick={onProjectClick}>
            <Folder size={15} />
            <span>{activeProject.name}</span>
          </button>
          <button className={modelLive ? "model-pill live" : "model-pill"} type="button" onClick={onModelClick}>
            <KeyRound size={15} />
            <span>{modelLive ? modelLabel : "Model"}</span>
            <ChevronDown size={14} />
          </button>
        </div>
        <button className="send-button" type="submit" aria-label="Send message" disabled={!canSend}>
          {busy ? <Loader2 size={18} /> : <ArrowUp size={19} />}
        </button>
      </div>
    </form>
  );
}

function mergeProjects(baseProjects, extraProjects) {
  const seen = new Set();
  return [...baseProjects, ...extraProjects].filter((project) => {
    const key = project.path.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <CleanApp />
  </React.StrictMode>
);

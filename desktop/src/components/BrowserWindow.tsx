import { ArrowLeft, ArrowRight, Globe2, RefreshCw, Send } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";

const quickLinks = [
  { label: "Salesforce Login", url: "https://login.salesforce.com" },
  { label: "Sandbox Login", url: "https://test.salesforce.com" },
  { label: "Jira", url: "https://www.atlassian.com/software/jira" },
  { label: "GitHub PRs", url: "https://github.com/pulls" }
];

type EmbeddedWebview = HTMLElement & {
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  getURL: () => string;
  goBack: () => void;
  goForward: () => void;
  loadURL: (url: string) => Promise<void>;
  reload: () => void;
};

type BrowserWindowProps = {
  initialUrl: string;
};

function normalizeUrl(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return quickLinks[0].url;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export function BrowserWindow({ initialUrl }: BrowserWindowProps) {
  const webviewRef = useRef<EmbeddedWebview | null>(null);
  const [url, setUrl] = useState(normalizeUrl(initialUrl || quickLinks[0].url));
  const [address, setAddress] = useState(url);
  const [title, setTitle] = useState("In-App Browser");
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  function updateNavigationState() {
    const webview = webviewRef.current;

    if (!webview) {
      return;
    }

    setCanGoBack(webview.canGoBack());
    setCanGoForward(webview.canGoForward());
    const currentUrl = webview.getURL();

    if (currentUrl) {
      setAddress(currentUrl);
      setUrl(currentUrl);
    }
  }

  function navigate(nextUrl: string) {
    const normalized = normalizeUrl(nextUrl);
    setUrl(normalized);
    setAddress(normalized);
  }

  function submitUrl(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate(address);
  }

  useEffect(() => {
    const normalized = normalizeUrl(initialUrl || quickLinks[0].url);
    setUrl(normalized);
    setAddress(normalized);
  }, [initialUrl]);

  useEffect(() => {
    const webview = webviewRef.current;

    if (!webview) {
      return;
    }

    const handleNavigate = () => updateNavigationState();
    const handleTitle = (event: Event) => {
      const nextTitle = (event as Event & { title?: string }).title;
      if (nextTitle) {
        setTitle(nextTitle);
      }
    };

    webview.addEventListener("did-navigate", handleNavigate);
    webview.addEventListener("did-navigate-in-page", handleNavigate);
    webview.addEventListener("did-stop-loading", handleNavigate);
    webview.addEventListener("page-title-updated", handleTitle);

    return () => {
      webview.removeEventListener("did-navigate", handleNavigate);
      webview.removeEventListener("did-navigate-in-page", handleNavigate);
      webview.removeEventListener("did-stop-loading", handleNavigate);
      webview.removeEventListener("page-title-updated", handleTitle);
    };
  }, [url]);

  return (
    <section className="window-surface browser-window">
      <div className="browser-titlebar">
        <div>
          <p className="eyebrow">In-App Browser</p>
          <h2>{title}</h2>
        </div>
        <span>{address}</span>
      </div>

      <div className="browser-toolbar">
        <button aria-label="Back" disabled={!canGoBack} onClick={() => webviewRef.current?.goBack()}>
          <ArrowLeft size={17} />
        </button>
        <button aria-label="Forward" disabled={!canGoForward} onClick={() => webviewRef.current?.goForward()}>
          <ArrowRight size={17} />
        </button>
        <button aria-label="Refresh" onClick={() => webviewRef.current?.reload()}>
          <RefreshCw size={17} />
        </button>
        <form className="browser-address" onSubmit={submitUrl}>
          <Globe2 size={17} />
          <input
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            aria-label="Browser URL"
          />
          <button aria-label="Go" type="submit">
            <Send size={16} />
          </button>
        </form>
      </div>

      <div className="quick-link-grid">
        {quickLinks.map((link) => (
          <button key={link.label} onClick={() => navigate(link.url)}>
            {link.label}
          </button>
        ))}
      </div>

      <div className="browser-frame">
        <webview
          ref={(element) => {
            webviewRef.current = element as EmbeddedWebview | null;
          }}
          className="embedded-webview"
          partition="persist:command-center-browser"
          src={url}
        />
      </div>
    </section>
  );
}

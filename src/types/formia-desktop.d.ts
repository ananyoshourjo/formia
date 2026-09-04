interface Window {
  formiaDesktop?: {
    isDesktop: true;
    platform: string;
    inspectorPreloadUrl: string;
    selectProject: () => Promise<{ name: string; path: string; url: string | null; error?: string } | null>;
    openProject: (projectPath: string) => Promise<{ name: string; path: string; url: string | null; error?: string }>;
    getProjectServerStatus: () => Promise<{ state: "starting" | "ready" | "failed" | "stopped"; url?: string; message: string }>;
    restartProjectServer: () => Promise<{ url: string; metadata: unknown }>;
    stopProjectServer: () => Promise<void>;
    buildWithCodex: (payload: unknown) => Promise<{ jobId: string }>;
    getCodexAvailability: () => Promise<{ state: "checking" | "available" | "unavailable"; message: string }>;
    getInstalledFonts: () => Promise<string[]>;
    minimizeWindow: () => Promise<void>;
    toggleMaximizeWindow: () => Promise<boolean>;
    isWindowMaximized: () => Promise<boolean>;
    closeWindow: () => Promise<void>;
    onCodexAvailability: (callback: (status: { state: "checking" | "available" | "unavailable"; message: string }) => void) => () => void;
    onProjectServerStatus: (callback: (status: { state: "starting" | "ready" | "failed" | "stopped"; url?: string; message: string }) => void) => () => void;
    onCodexStatus: (callback: (status: { jobId: string; state: "working" | "applied" | "failed"; message: string }) => void) => () => void;
    versions: Readonly<{
      chrome: string;
      electron: string;
      node: string;
    }>;
  };
}

interface FormiaWebviewElement extends HTMLElement {
  canGoBack(): boolean;
  canGoForward(): boolean;
  goBack(): void;
  goForward(): void;
  reload(): void;
  send(channel: string, ...args: unknown[]): void;
}

interface FormiaWebviewEvent extends Event {
  channel: string;
  args: unknown[];
}

declare namespace React.JSX {
  interface IntrinsicElements {
    webview: React.DetailedHTMLProps<React.HTMLAttributes<FormiaWebviewElement>, FormiaWebviewElement> & {
      src?: string;
      preload?: string;
      partition?: string;
      allowpopups?: string;
      webpreferences?: string;
    };
  }
}

import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    localStorage.removeItem("ojix_auth_token");
    localStorage.removeItem("ojix_user");
    localStorage.removeItem("ojix_workspace_id");
    localStorage.removeItem("ojix_portal_mode");
    sessionStorage.clear();
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0f172a",
          padding: "24px",
          fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
          color: "#f8fafc"
        }}>
          <div style={{
            maxWidth: "680px",
            width: "100%",
            backgroundColor: "#1e293b",
            borderRadius: "16px",
            border: "1px solid #334155",
            padding: "36px",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "#ef4444",
                color: "#fff",
                display: "grid",
                placeItems: "center",
                fontWeight: 900,
                fontSize: "20px"
              }}>!</div>
              <div>
                <h2 style={{ margin: 0, fontSize: "20px", color: "#f8fafc" }}>Application Error Caught</h2>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#94a3b8" }}>
                  An unexpected error occurred while rendering the workspace.
                </p>
              </div>
            </div>

            <div style={{
              backgroundColor: "#0f172a",
              borderRadius: "8px",
              padding: "16px",
              border: "1px solid #1e293b",
              margin: "20px 0",
              overflow: "auto",
              maxHeight: "220px"
            }}>
              <p style={{ margin: 0, color: "#f87171", fontFamily: "monospace", fontSize: "13px", fontWeight: 700 }}>
                {this.state.error?.message || "Unknown error"}
              </p>
              {this.state.error?.stack && (
                <pre style={{ margin: "10px 0 0", color: "#cbd5e1", fontSize: "11px", whiteSpace: "pre-wrap" }}>
                  {this.state.error.stack}
                </pre>
              )}
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={this.handleReset}
                style={{
                  padding: "12px 20px",
                  borderRadius: "8px",
                  border: 0,
                  background: "#2563eb",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "14px",
                  cursor: "pointer"
                }}
              >
                Reset Session &amp; Go to Demo Home
              </button>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: "12px 20px",
                  borderRadius: "8px",
                  border: "1px solid #475569",
                  background: "transparent",
                  color: "#cbd5e1",
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: "pointer"
                }}
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

import { useState } from 'react';

const API_BASE = typeof import.meta.env.VITE_API_URL !== 'undefined' ? import.meta.env.VITE_API_URL : '';

type Endpoint = {
  method: string;
  path: string;
  name: string;
  body?: string;
};

const endpoints: Endpoint[] = [
  {
    method: 'GET',
    path: '/health',
    name: 'API Health'
  },
  {
    method: 'GET',
    path: '/readyz',
    name: 'MariaDB Spatial Readiness'
  },
  {
    method: 'GET',
    path: '/api/auth/dummy-accounts',
    name: 'Dummy Accounts'
  },
  {
    method: 'POST',
    path: '/api/auth/login',
    name: 'Login',
    body: JSON.stringify(
      {
        email: 'owner@ojix.local',
        password: 'ojix123'
      },
      null,
      2
    )
  },
  {
    method: 'GET',
    path: '/api/auth/me',
    name: 'Current User'
  },
  {
    method: 'GET',
    path: '/api/overview',
    name: 'Overview'
  },
  {
    method: 'GET',
    path: '/api/properties',
    name: 'List Properties'
  },
  {
    method: 'POST',
    path: '/api/properties',
    name: 'Create Property',
    body: JSON.stringify(
      {
        name: 'Sample Property',
        village: 'Whitefield',
        hobli: 'Kundalahalli',
        taluk: 'Bengaluru East',
        district: 'Bengaluru Urban',
        surveyNumber: '123/4',
        subdivision: 'A',
        extent: '1200 Sq Ft',
        address: 'Bengaluru, Karnataka',
        latitude: 12.9716,
        longitude: 77.5946,
        notes: 'Created from API Console'
      },
      null,
      2
    )
  }
];

export default function ApiConsole() {
  const [selected, setSelected] = useState<Endpoint>(endpoints[0]);
  const [path, setPath] = useState(endpoints[0].path);
  const [method, setMethod] = useState(endpoints[0].method);
  const [body, setBody] = useState(endpoints[0].body || '');
  const [token, setToken] = useState('');
  const [response, setResponse] = useState('');
  const [status, setStatus] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const selectEndpoint = (endpoint: Endpoint) => {
    setSelected(endpoint);
    setMethod(endpoint.method);
    setPath(endpoint.path);
    setBody(endpoint.body || '');
    setResponse('');
    setStatus(null);
    setDuration(null);
  };

  const sendRequest = async () => {
    setLoading(true);
    setResponse('');
    setStatus(null);

    const start = performance.now();

    try {
      const headers: Record<string, string> = {};

      if (body.trim()) {
        headers['Content-Type'] = 'application/json';
      }

      if (token.trim()) {
        headers['Authorization'] = `Bearer ${token.trim()}`;
      }

      const request: RequestInit = {
        method,
        headers
      };

      if (!['GET', 'HEAD'].includes(method)) {
        request.body = body.trim() || undefined;
      }

      const res = await fetch(`${API_BASE}${path}`, request);
      const elapsed = Math.round(performance.now() - start);

      setStatus(res.status);
      setDuration(elapsed);

      const contentType = res.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        const data = await res.json();
        setResponse(JSON.stringify(data, null, 2));
      } else {
        setResponse(await res.text());
      }
    } catch (error) {
      const elapsed = Math.round(performance.now() - start);

      setDuration(elapsed);
      setResponse(
        error instanceof Error
          ? error.message
          : 'Request failed'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="api-console">
      <div className="api-console-header">
        <div>
          <h1>API Console</h1>
          <p>
            Test and debug the OJIX Property Intelligence REST API.
          </p>
        </div>

        <div className="api-server">
          <span className="status-dot" />
          {API_BASE}
        </div>
      </div>

      <div className="api-console-grid">
        <aside className="api-endpoints">
          <div className="panel-title">Endpoints</div>

          {endpoints.map((endpoint) => (
            <button
              key={`${endpoint.method}-${endpoint.path}`}
              className={`endpoint-item ${
                selected.path === endpoint.path &&
                selected.method === endpoint.method
                  ? 'active'
                  : ''
              }`}
              onClick={() => selectEndpoint(endpoint)}
            >
              <span className={`method ${endpoint.method.toLowerCase()}`}>
                {endpoint.method}
              </span>

              <span>
                <strong>{endpoint.name}</strong>
                <small>{endpoint.path}</small>
              </span>
            </button>
          ))}
        </aside>

        <main className="api-workspace">
          <section className="request-panel">
            <div className="panel-title">Request</div>

            <div className="request-row">
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option>GET</option>
                <option>POST</option>
                <option>PATCH</option>
                <option>DELETE</option>
              </select>

              <input
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/api/properties"
              />

              <button
                className="send-button"
                onClick={sendRequest}
                disabled={loading}
              >
                {loading ? 'Sending...' : 'Send Request'}
              </button>
            </div>

            <label className="field-label">
              Authorization Token
            </label>

            <input
              className="token-input"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste token here (optional)"
            />

            <label className="field-label">
              Request Body
            </label>

            <textarea
              className="code-editor"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder='{"name":"Sample Property"}'
              spellCheck={false}
            />
          </section>

          <section className="response-panel">
            <div className="response-header">
              <div className="panel-title">Response</div>

              <div className="response-meta">
                {status !== null && (
                  <span className={`response-status ${
                    status >= 200 && status < 300
                      ? 'success'
                      : 'error'
                  }`}>
                    HTTP {status}
                  </span>
                )}

                {duration !== null && (
                  <span>{duration} ms</span>
                )}
              </div>
            </div>

            <pre className="response-editor">
              {response || 'Response will appear here...'}
            </pre>
          </section>
        </main>
      </div>
    </div>
  );
}

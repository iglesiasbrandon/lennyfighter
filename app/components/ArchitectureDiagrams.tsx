'use client';

import { useEffect, useRef, useState } from 'react';

declare global { interface Window { mermaid?: { initialize: (config: Record<string, unknown>) => void; render: (id: string, code: string) => Promise<{ svg: string }> } } }

const DIAGRAMS = [
  {
    title: 'High-Level Architecture',
    chart: `flowchart TB
    Browser["Browser<br/>(lennyfighter.com)"]
    CDN["Cloudflare CDN"]
    Worker["Worker<br/>(worker/index.ts)"]
    Browser -->|"HTTPS / WSS"| CDN
    CDN --> Worker
    subgraph RT["Worker Runtime"]
        Worker -->|"Static"| Assets["ASSETS"]
        Worker -->|"SSR"| Vinext["Vinext App Router"]
        Vinext --> Auth["POST /auth/session"]
        Vinext --> Stats["GET /stats"]
        Vinext --> Items["GET|POST /items"]
        Worker -->|"WS verified"| MQ["MatchmakingQueue DO<br/>Singleton"]
        Worker -->|"WS verified"| MR["MatchRoom DO<br/>Per-match"]
    end
    subgraph Storage
        KV["KV<br/>Session Tokens"]
        D1["D1 Database<br/>Stats, Players, Items"]
    end
    Worker -->|"Auth check"| KV
    Auth -->|"Create session"| KV
    Stats --> D1
    Items --> D1
    MR -->|"Record stats"| D1
    MQ -->|"Create match"| MR`,
  },
  {
    title: 'Multiplayer Match Flow',
    chart: `sequenceDiagram
    participant A as Player A
    participant W as Worker
    participant KV as KV
    participant MQ as MatchmakingQueue
    participant MR as MatchRoom
    participant D1 as D1
    participant B as Player B
    Note over A,B: Authentication
    A->>W: POST /auth/session
    W->>KV: Store token (1hr TTL)
    W-->>A: {token}
    Note over A,B: Matchmaking
    A->>W: WS connect (token)
    W->>KV: Verify
    W->>MQ: Forward
    B->>W: WS connect (token)
    W->>MQ: Forward
    MQ-->>A: match_found
    MQ-->>B: match_found
    Note over A,B: Match Setup
    A->>MR: Connect
    B->>MR: Connect
    MR-->>A: item_selection
    MR->>D1: Check balances
    MR-->>A: wager_phase
    A->>MR: propose 50 LC
    B->>MR: accept
    Note over A,B: Combat
    MR-->>A: trivia
    A->>MR: answer
    MR->>MR: Calc damage
    MR-->>A: turn_result
    MR-->>B: turn_result
    Note over A,B: Match End
    MR->>D1: Stats + LC transfer
    MR-->>A: match_end
    MR-->>B: match_end`,
  },
  {
    title: 'Durable Object Design',
    chart: `flowchart TB
    subgraph MQ["MatchmakingQueue DO — Singleton"]
        Q["Player Queue"]
        Pair["tryMatch()<br/>Level ±3, FIFO"]
        Timer["3s Alarm Retry"]
        Q --> Pair
        Timer --> Pair
    end
    subgraph MR["MatchRoom DO — Per Match"]
        State["Match State"]
        P1["Player 1 WS"]
        P2["Player 2 WS"]
        subgraph Fields["State Fields"]
            HP["HP & Turns"]
            Trivia["Trivia Engine<br/>No repeats"]
            Wager["Wager Negotiation"]
            ItemFX["Item Effects"]
        end
        subgraph Alarms["Alarm System"]
            DC["Disconnect 20s"]
            IT["Item timeout 15s"]
            WT["Wager timeout 15s"]
            CL["Cleanup 60s"]
        end
    end
    D1["D1 Database"]
    Pair -->|"Creates"| MR
    MR -->|"endMatch()"| D1`,
  },
  {
    title: 'WebSocket Authentication',
    chart: `sequenceDiagram
    participant C as Client
    participant W as Worker
    participant KV as KV
    participant DO as Durable Object
    C->>W: POST /auth/session {gamertag}
    W->>W: Generate UUID token
    W->>KV: Put token → gamertag (1hr)
    W-->>C: {token}
    C->>C: Cache in sessionStorage
    C->>W: WS upgrade ?token=xxx
    W->>KV: Get token
    KV-->>W: Verified gamertag
    W->>W: Rewrite URL
    W->>W: Strip client params
    W->>DO: Forward trusted request
    DO-->>C: WebSocket established`,
  },
  {
    title: 'Data Storage Map',
    chart: `flowchart LR
    subgraph Client["Client"]
        LS["localStorage<br/>gamertag"]
        SS["sessionStorage<br/>token, match info"]
    end
    subgraph Edge["Cloudflare Edge"]
        KV["KV<br/>session tokens<br/>TTL 1hr"]
    end
    subgraph DB["D1 Database"]
        Stats["player_stats"]
        Players["players"]
        Inv["player_items"]
    end
    subgraph DO["DO Memory"]
        Match["MatchRoom<br/>HP, turns, trivia"]
        Queue["MatchmakingQueue<br/>player queue"]
    end
    LS --> KV
    KV --> DO
    Match --> Stats`,
  },
];

function DiagramBlock({ title, chart }: { title: string; chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const rendered = useRef(false);

  useEffect(() => {
    if (!open || rendered.current || !ref.current) return;
    rendered.current = true;

    // Wait for mermaid to be loaded globally
    const tryRender = () => {
      const m = window.mermaid;
      if (!m) {
        setTimeout(tryRender, 200);
        return;
      }
      const id = 'mmd-' + Math.random().toString(36).slice(2, 8);
      m.render(id, chart).then(({ svg }: { svg: string }) => {
        if (ref.current) ref.current.innerHTML = svg;
      }).catch(() => {
        if (ref.current) {
          ref.current.innerHTML = `<pre style="color:#e0d8c8;font-size:14px;white-space:pre-wrap;">${chart}</pre>`;
        }
      });
    };
    tryRender();
  }, [open, chart]);

  return (
    <div style={{ marginBottom: '16px' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#0d1117',
          border: '2px solid #333',
          borderRadius: open ? '6px 6px 0 0' : '6px',
          padding: '12px 16px',
          cursor: 'pointer',
          color: '#ffcc00',
          fontFamily: "'VT323', monospace",
          fontSize: '22px',
          transition: 'border-color 0.15s',
        }}
      >
        <span>{title}</span>
        <span style={{
          transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s',
          fontSize: '18px',
        }}>▶</span>
      </button>
      {open && (
        <div
          ref={ref}
          style={{
            background: '#fff',
            border: '2px solid #333',
            borderTop: 'none',
            borderRadius: '0 0 6px 6px',
            padding: '16px',
            overflow: 'auto',
            minHeight: '80px',
          }}
        >
          <span style={{ color: '#888', fontFamily: "'VT323', monospace", fontSize: '18px' }}>
            Rendering diagram...
          </span>
        </div>
      )}
    </div>
  );
}

export function ArchitectureDiagrams() {
  useEffect(() => {
    // Load mermaid from CDN once
    if (window.mermaid || document.querySelector('script[data-mermaid]')) return;
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
    script.setAttribute('data-mermaid', 'true');
    script.onload = () => {
      window.mermaid?.initialize({
        startOnLoad: false,
        theme: 'default',
        themeVariables: {
          fontSize: '14px',
        },
        fontFamily: 'arial, sans-serif',
        flowchart: { htmlLabels: true, curve: 'basis' },
        sequence: { useMaxWidth: true, actorMargin: 50, width: 150 },
      });
    };
    document.head.appendChild(script);
  }, []);

  return (
    <div>
      {DIAGRAMS.map((d) => (
        <DiagramBlock key={d.title} title={d.title} chart={d.chart} />
      ))}
    </div>
  );
}

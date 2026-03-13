import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Experience } from "./components/Experience";

// ── Tab data 
const TABS = [
  {
    id: 1,
    label: "The Keystone",
    subtitle: "Origin",
    description: "The foundation stone — raw, immovable, and precise.",
  },
  {
    id: 2,
    label: "Oracle's Eye",
    subtitle: "Evolved",
    description: "Perception refined into form. A new clarity emerges.",
  },
  {
    id: 3,
    label: "The Lodestone",
    subtitle: "Aligned",
    description: "Drawn by invisible forces. Direction made manifest.",
  },
  {
    id: 4,
    label: "Resonating Bell",
    subtitle: "Resonant",
    description: "A frequency cast in form. Vibration made still.",
  },
  {
    id: 5,
    label: "Interlocking Gears",
    subtitle: "Unified",
    description: "Each tooth a purpose. Motion born from harmony.",
  },
];

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Labrada:ital,wght@0,100;0,200;1,100&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:        #f9f7f4;
    --ink:       #1a1714;
    --ink-muted: #8a8179;
    --gold:      #c9a96e;
    --gold-dim:  #e8dcc8;
    --line:      rgba(26,23,20,0.10);
  }

  html, body, #root {
    width: 100%; height: 100%;
    background: var(--bg);
    overflow: hidden;
  }

  .app-shell {
    position: relative;
    width: 100vw;
    height: 100vh;
  }

  .canvas-wrap {
    position: absolute;
    inset: 0;
  }

  /* ── Tab panel — right side overlay ── */
  .tab-panel {
    position: absolute;
    top: 50%;
    right: 52px;
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
    gap: 6px;
    z-index: 10;
    pointer-events: none;
  }

  .tab-btn {
    pointer-events: all;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    padding: 18px 24px 18px 28px;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: right;
    transition: opacity 0.3s ease;
    outline: none;
  }

  /* Disabled state during animation */
  .tab-btn:disabled {
    cursor: default;
    pointer-events: none;
  }

  .tab-btn:disabled .tab-label,
  .tab-btn:disabled .tab-subtitle,
  .tab-btn:disabled .tab-desc {
    opacity: 0.35;
  }

  /* Left accent bar */
  .tab-btn::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 2px;
    height: 0;
    background: var(--gold);
    transition: height 0.4s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .tab-btn.active::before { height: 100%; }

  .tab-btn::after {
    content: '';
    position: absolute;
    inset: 0;
    background: rgba(249,247,244,0.82);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-radius: 2px;
    opacity: 0;
    transition: opacity 0.3s ease;
    z-index: -1;
  }

  .tab-btn:hover::after,
  .tab-btn.active::after { opacity: 1; }

  .tab-subtitle {
    font-family: 'Labrada', serif;
    font-weight: 100;
    font-size: 9px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--gold);
    opacity: 0;
    transform: translateX(6px);
    transition: opacity 0.3s ease 0.05s, transform 0.3s ease 0.05s;
  }

  .tab-btn.active .tab-subtitle,
  .tab-btn:hover .tab-subtitle {
    opacity: 1;
    transform: translateX(0);
  }

  .tab-label {
    font-family: 'Cormorant Garamond', serif;
    font-weight: 300;
    font-size: 18px;
    letter-spacing: 0.02em;
    color: var(--ink-muted);
    transition: color 0.3s ease, font-size 0.3s ease;
    line-height: 1;
    white-space: nowrap;
  }

  .tab-btn.active .tab-label { color: var(--ink); font-size: 20px; }
  .tab-btn:hover:not(.active) .tab-label { color: var(--ink); }

  .tab-desc {
    font-family: 'Labrada', serif;
    font-weight: 100;
    font-size: 10px;
    letter-spacing: 0.06em;
    color: var(--ink-muted);
    max-width: 180px;
    line-height: 1.5;
    overflow: hidden;
    max-height: 0;
    opacity: 0;
    transform: translateY(-4px);
    transition: max-height 0.4s ease, opacity 0.3s ease, transform 0.3s ease;
  }

  .tab-btn.active .tab-desc {
    max-height: 40px;
    opacity: 1;
    transform: translateY(0);
    transition-delay: 0.1s;
  }

  .tab-divider {
    width: 1px;
    height: 32px;
    background: var(--line);
    align-self: flex-end;
    margin-right: 24px;
  }

  .corner-mark {
    position: absolute;
    bottom: 36px;
    right: 52px;
    font-family: 'Labrada', serif;
    font-weight: 100;
    font-size: 9px;
    letter-spacing: 0.30em;
    text-transform: uppercase;
    color: var(--ink-muted);
    opacity: 0.5;
    z-index: 10;
    pointer-events: none;
  }

  .tab-index {
    position: absolute;
    top: 14px;
    right: 10px;
    font-family: 'Labrada', serif;
    font-weight: 100;
    font-size: 8px;
    color: var(--gold);
    letter-spacing: 0.1em;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .tab-btn.active .tab-index,
  .tab-btn:hover .tab-index { opacity: 1; }
`;

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab]   = useState(1);
  const [animating, setAnimating]   = useState(false);

  // Listen for animation state from ModelViewer
  useState(() => {
    const handler = (e) => setAnimating(e.detail.busy);
    window.addEventListener("model-animation-state", handler);
    return () => window.removeEventListener("model-animation-state", handler);
  });

  const handleTabClick = (id) => {
    // if (id === activeTab || animating) return;
    if (id === activeTab) return;
    setActiveTab(id);
    window.dispatchEvent(
      new CustomEvent("model-tab-change", { detail: { index: id } })
    );
  };

  return (
    <>
      <style>{styles}</style>

      <div className="app-shell">

        <div className="canvas-wrap">
          <Canvas
            dpr={[1, 1.5]}
            shadows
            camera={{ position: [0, 0, 5], fov: 30 }}
            gl={{ powerPreference: "high-performance" }}
          >
            <color attach="background" args={["#f9f7f4"]} />
            <Experience />
          </Canvas>
        </div>

        {/* <nav className="tab-panel" aria-label="Model selector">
          {TABS.map((tab, idx) => (
            <>
              {idx > 0 && <div key={`div-${tab.id}`} className="tab-divider" />}
              <button
                key={tab.id}
                className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => handleTabClick(tab.id)}
                // disabled={animating && activeTab !== tab.id}
                aria-pressed={activeTab === tab.id}
              >
                <span className="tab-index">0{tab.id}</span>
                <span className="tab-subtitle">{tab.subtitle}</span>
                <span className="tab-label">{tab.label}</span>
                <span className="tab-desc">{tab.description}</span>
              </button>
            </>
          ))}
        </nav> */}

        <span className="corner-mark">Form · Matter</span>

      </div>
    </>
  );
}
import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Experience } from "./components/Experience";






const styles = `
 

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
  
    --ink:       #1a1714;
    --ink-muted: #8a8179;
    --gold:      #c9a96e;
    --gold-dim:  #e8dcc8;
    --line:      rgba(26,23,20,0.10);
  }

  html, body, #root {
    width: 100%; height: 100%;
    background: var(--bg);
    
  }

  
`;

// ── App 
export default function App() {
  // const [activeTab, setActiveTab]   = useState(1);
  // const [animating, setAnimating]   = useState(false);

  // // Listen for animation state from ModelViewer
  // useState(() => {
  //   const handler = (e) => setAnimating(e.detail.busy);
  //   window.addEventListener("model-animation-state", handler);
  //   return () => window.removeEventListener("model-animation-state", handler);
  // });

  // const handleTabClick = (id) => {
  //   // if (id === activeTab || animating) return;
  //   if (id === activeTab) return;
  //   setActiveTab(id);
  //   window.dispatchEvent(
  //     new CustomEvent("model-tab-change", { detail: { index: id } })
  //   );
  // };
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

      
          <Canvas
            dpr={[1, 1.5]}
            shadows
            camera={{ position: [0, 0, 5], fov: 30 }}
            gl={{ powerPreference: "high-performance" }}
          >
            {/* <color attach="background" args={["#f9f7f4"]} /> */}
            <Experience />
          </Canvas>
        {/* </div> */}

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

        {/* <span className="corner-mark">Form · Matter</span> */}

      {/* </div> */}
    </>
  );
}
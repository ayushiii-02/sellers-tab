export default function App() {

  return (
    <>
      <div className="app-shell">

        <div className="canvas-wrap">
          <Canvas
            dpr={[1, 1.5]}
            shadows
            camera={{ position: [0, 0, 5], fov: 30 }}
          >
            <color attach="background" args={["#f9f7f4"]} />
            <Experience />
          </Canvas>
        </div>

      </div>
    </>
  );
}
 
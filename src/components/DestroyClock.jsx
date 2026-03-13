// ModelViewer.jsx
//
// Supports 3 models with animated stone transitions between any pair.
//
// TAB CONTROL:
//   window event "model-tab-change" { detail: { index: 1 | 2 | 3 } }
//   Clicking while animating is ignored.

import { useState, useRef, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF, Environment } from "@react-three/drei";
import * as THREE from "three";

// ── Config 

const MODEL_PATHS = [
  "https://sellers-tab.vercel.app/The Keystone 3.glb",
  "https://sellers-tab.vercel.app/The Oracle's Eye 3.glb",
  "https://sellers-tab.vercel.app/The Lodestone Compass.glb",
  "https://sellers-tab.vercel.app/The Resonating Bell.glb",
  "https://sellers-tab.vercel.app/The Interlocking Gears.glb",
];
const MODEL_SCALE = 5.5;

const EXPLODE_DUR  = 0.95;  // slightly slower breakout
const MORPH_DUR    = 3.0;   // a touch more breathing room
const REVEALED_DUR = 1.6;   // settle feels less rushed

const EXPLODE_STAGGER_FRAC = 0.10;
const STAGGER_END          = 0.50;
const SCATTER_RADIUS       = 0.30;
const SCATTER_SCALE        = 2.2;
const ARC_HEIGHT           = 0.18;

// ── Easing ───────────────────────────────────────────────────────────────────

const ease = {
  outCubic:   (t) => 1 - (1 - t) ** 3,
  inOutCubic: (t) => t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2,
  inOutSine:  (t) => -(Math.cos(Math.PI * t) - 1) / 2,
};

// ── Seeded RNG ────────────────────────────────────────────────────────────────

function createRng(seed) {
  let s = ((seed * 1664525 + 1013904223) >>> 0);
  return () => { s = ((s * 1664525 + 1013904223) >>> 0); return s / 4294967296; };
}

function seededShuffle(arr, rng) {
  const r = [...arr];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

// ── Bezier ────────────────────────────────────────────────────────────────────

function bezierPoint(A, B, C, t) {
  const mt = 1 - t;
  return new THREE.Vector3(
    mt * mt * A.x + 2 * mt * t * C.x + t * t * B.x,
    mt * mt * A.y + 2 * mt * t * C.y + t * t * B.y,
    mt * mt * A.z + 2 * mt * t * C.z + t * t * B.z,
  );
}

function buildControlPoint(A, B, arcRng) {
  const mid    = new THREE.Vector3().addVectors(A, B).multiplyScalar(0.5);
  const outDir = mid.clone().normalize();
  const perp   = new THREE.Vector3(arcRng() - 0.5, arcRng() - 0.5, arcRng() - 0.5)
    .cross(outDir).normalize();
  const arcMag = ARC_HEIGHT * (0.6 + arcRng() * 0.8);
  return mid.clone()
    .addScaledVector(outDir, arcMag)
    .addScaledVector(perp, arcMag * 0.4);
}

// ── Parse model ───────────────────────────────────────────────────────────────

function parseModel(scene) {
  const shards = [], bodies = [];
  scene.updateWorldMatrix(true, true);
  scene.traverse((obj) => {
    if (!obj.isMesh) return;
    if (obj.name.toLowerCase().includes("cell")) {
      const box = new THREE.Box3().setFromObject(obj);
      const center = new THREE.Vector3();
      box.getCenter(center);
      shards.push({ mesh: obj, worldCenter: center });
    } else {
      bodies.push(obj);
    }
  });
  return { shards, bodies };
}

// ── Clone a shard ─────────────────────────────────────────────────────────────

function cloneShard(sourceMesh) {
  const c = sourceMesh.clone();
  c.geometry = sourceMesh.geometry;
  c.material = sourceMesh.material.clone();
  c.material.depthWrite  = true;
  c.material.transparent = false;
  c.material.opacity     = 1;
  c.material.needsUpdate = true;
  c.visible          = false;
  c.castShadow       = true;
  c.matrixAutoUpdate = true;
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  sourceMesh.matrixWorld.decompose(p, q, s);
  c.userData.baseQuat = q.clone();
  return c;
}

// ── Build shard animation data ────────────────────────────────────────────────

function buildShardData(shards1, shards2, count) {
  const posRng         = createRng(99991);
  const kickOrder      = seededShuffle([...Array(count).keys()], createRng(42));
  const morphOrder     = seededShuffle([...Array(count).keys()], createRng(88888));
  const explodeStagger = EXPLODE_DUR * EXPLODE_STAGGER_FRAC;

  const shards = Array.from({ length: count }, (_, i) => {
    const rng = createRng(i * 7919 + 3571);

    const src    = shards1[i].worldCenter.clone().multiplyScalar(MODEL_SCALE);
    const target = shards2[i].worldCenter.clone().multiplyScalar(MODEL_SCALE);

    const angle     = posRng() * Math.PI * 2;
    const elevation = (posRng() - 0.5) * Math.PI;
    const radius    = SCATTER_RADIUS * (0.6 + posRng() * 1.4);
    const scattered = src.clone().add(new THREE.Vector3(
      Math.cos(angle) * Math.cos(elevation) * radius,
      Math.sin(elevation) * radius * 0.55,
      Math.sin(angle) * Math.cos(elevation) * radius * 0.45,
    ));

    const tumbleAxis   = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize();
    const tumbleAngle  = (rng() - 0.5) * Math.PI * 1.2;
    const explodeDelay = (kickOrder.indexOf(i) / Math.max(count - 1, 1)) * explodeStagger;

    return { src, scattered, target, tumbleAxis, tumbleAngle, explodeDelay };
  });
  return { shards, morphOrder };
}

// ── Mesh helpers ──────────────────────────────────────────────────────────────

function showMeshSolid(mesh) {
  mesh.visible              = true;
  mesh.material.transparent = false;
  mesh.material.opacity     = 1;
  mesh.material.depthWrite  = true;
  mesh.material.needsUpdate = true;
}

function hideMesh(mesh) {
  mesh.visible              = false;
  mesh.material.transparent = true;
  mesh.material.opacity     = 0;
  mesh.material.depthWrite  = false;
  mesh.material.needsUpdate = true;
}

function resetShardsHidden(shards) { shards.forEach(({ mesh }) => hideMesh(mesh)); }
function resetBodiesHidden(bodies) { bodies.forEach((m) => hideMesh(m)); }
function resetBodiesSolid(bodies)  { bodies.forEach((m) => showMeshSolid(m)); }

// ── StoneField ────────────────────────────────────────────────────────────────

function StoneField({ shards1, shards2, stateRef, onAllLanded }) {
  const count    = Math.min(shards1.length, shards2.length);
  const groupRef = useRef();

  const stoneClones = useMemo(
    () => shards1.slice(0, count).map(({ mesh }) => cloneShard(mesh)),
    [shards1, count]
  );

  const model2Materials = useMemo(
    () => shards2.slice(0, count).map(({ mesh }) => mesh.material.clone()),
    [shards2, count]
  );

  const { shards: shardData, morphOrder } = useMemo(
    () => buildShardData(shards1, shards2, count),
    [shards1, shards2, count]
  );

  useEffect(() => {
    const grp = groupRef.current;
    if (!grp) return;
    stoneClones.forEach((c) => grp.add(c));
    return () => stoneClones.forEach((c) => grp?.remove(c));
  }, [stoneClones]);

  const pinnedPos = useMemo(
    () => Array.from({ length: count }, (_, i) =>
      new THREE.Vector3().copy(shardData[i]?.scattered ?? new THREE.Vector3())
    ),
    [count, shardData]
  );

  const controlPoints = useMemo(
    () => Array.from({ length: count }, () => new THREE.Vector3()),
    [count]
  );

  const tmpQuat     = useMemo(() => new THREE.Quaternion(), []);
  const capturedRef = useRef(false);
  const firedRef    = useRef(false);

  useEffect(() => {
    capturedRef.current = false;
    firedRef.current    = false;
    shardData.forEach((sd, i) => pinnedPos[i].copy(sd.scattered));
  }, [shardData, pinnedPos]);

  useFrame(() => {
    const { phase, elapsed } = stateRef.current;
    const grp = groupRef.current;
    if (!grp) return;

    // ── IDLE / REVEALED
    if (phase === "idle" || phase === "revealed") {
      stoneClones.forEach((c) => { c.visible = false; });
      capturedRef.current = false;
      firedRef.current    = false;
      return;
    }

    // ── EXPLODING
    if (phase === "exploding") {
      capturedRef.current = false;
      firedRef.current    = false;
      stoneClones.forEach((c, i) => {
        const sd      = shardData[i];
        const delayed = Math.max(0, elapsed - sd.explodeDelay);
        const e       = ease.outCubic(Math.min(delayed / (EXPLODE_DUR * 0.75), 1));

        c.visible              = true;
        c.material.transparent = false;
        c.material.opacity     = 1;
        c.material.depthWrite  = true;

        const m1Mat = shards1[i].mesh.material;
        c.material.color.copy(m1Mat.color ?? new THREE.Color(1, 1, 1));
        c.material.roughness = m1Mat.roughness ?? 0.85;
        c.material.metalness = m1Mat.metalness ?? 0.08;
        if (m1Mat.map !== undefined) c.material.map = m1Mat.map;
        c.material.needsUpdate = true;

        c.position.lerpVectors(sd.src, sd.scattered, e);
        c.scale.setScalar(MODEL_SCALE * (1 + (SCATTER_SCALE / MODEL_SCALE - 1) * e));

        tmpQuat.copy(c.userData.baseQuat ?? new THREE.Quaternion());
        tmpQuat.premultiply(
          new THREE.Quaternion().setFromAxisAngle(sd.tumbleAxis, sd.tumbleAngle * e)
        );
        c.quaternion.copy(tmpQuat);
        pinnedPos[i].copy(c.position);
      });
      return;
    }

    // ── MORPHING
    if (phase === "morphing") {
      if (!capturedRef.current) {
        shardData.forEach((sd, i) => {
          const arcRng = createRng(i * 1234 + 5678);
          controlPoints[i].copy(buildControlPoint(pinnedPos[i], sd.target, arcRng));
        });
        capturedRef.current = true;
      }

      const morphT    = Math.min(elapsed / MORPH_DUR, 1);
      let   landedAll = true;

      // Tightened stagger + window so all shards converge faster
      const SPIN_END    = 0.34;
      const FLY_START   = 0.18;
      const FLY_STAGGER = 0.18;
      const FLY_WINDOW  = 0.40;

      stoneClones.forEach((c, i) => {
        const sd         = shardData[i];
        const shard2Mesh = shards2[i]?.mesh;

        const spinT     = THREE.MathUtils.clamp(morphT / SPIN_END, 0, 1);
        const spinTE    = ease.inOutSine(spinT);
        const spinAngle = spinTE * Math.PI * 2;

        const flyOffset = (morphOrder[i] / Math.max(count - 1, 1)) * FLY_STAGGER;
        const flyStart  = FLY_START + flyOffset;
        const flyEnd    = Math.min(flyStart + FLY_WINDOW, 1.0);
        let flyT = 0;
        if (morphT >= flyStart) {
          flyT = THREE.MathUtils.clamp(
            (morphT - flyStart) / Math.max(flyEnd - flyStart, 0.001), 0, 1
          );
        }
        const flyTE  = ease.inOutSine(flyT);
        const landed = flyT >= 1;
        if (!landed) landedAll = false;

        const m1Mat    = shards1[i].mesh.material;
        const m2Mat    = model2Materials[i];
        const matBlend = ease.inOutCubic(THREE.MathUtils.clamp((spinT - 0.35) / 0.30, 0, 1));

        c.material.color.lerpColors(
          m1Mat.color ?? new THREE.Color(1, 1, 1),
          m2Mat.color ?? new THREE.Color(1, 1, 1),
          matBlend
        );
        c.material.roughness   = THREE.MathUtils.lerp(m1Mat.roughness ?? 0.85, m2Mat.roughness ?? 0.80, matBlend);
        c.material.metalness   = THREE.MathUtils.lerp(m1Mat.metalness ?? 0.08, m2Mat.metalness ?? 0.12, matBlend);
        if (m2Mat.map) c.material.map = matBlend > 0.5 ? m2Mat.map : (m1Mat.map ?? null);
        c.material.transparent = false;
        c.material.opacity     = 1;
        c.material.depthWrite  = true;
        c.material.needsUpdate = true;

        if (landed) {
          c.visible = false;
          if (shard2Mesh) showMeshSolid(shard2Mesh);
        } else {
          c.visible = true;
          if (flyT > 0) {
            c.position.copy(bezierPoint(pinnedPos[i], sd.target, controlPoints[i], flyTE));
            c.scale.setScalar(THREE.MathUtils.lerp(SCATTER_SCALE, MODEL_SCALE, ease.inOutCubic(flyTE)));

            const globalY = new THREE.Quaternion().setFromAxisAngle(
              new THREE.Vector3(0, 1, 0), spinAngle * (1 - flyTE)
            );
            tmpQuat.copy(globalY).slerp(
              c.userData.baseQuat ?? new THREE.Quaternion(),
              ease.inOutCubic(flyTE)
            );
            c.quaternion.copy(tmpQuat);

            if (shard2Mesh) {
              const FADE_IN_START = 0.60;
              if (flyT >= FADE_IN_START) {
                const fadeT   = THREE.MathUtils.clamp((flyT - FADE_IN_START) / (1 - FADE_IN_START), 0, 1);
                const opacity = ease.inOutCubic(fadeT);
                shard2Mesh.visible              = true;
                shard2Mesh.material.transparent = opacity < 0.999;
                shard2Mesh.material.opacity     = opacity;
                shard2Mesh.material.depthWrite  = true;
                shard2Mesh.material.needsUpdate = true;
              } else {
                hideMesh(shard2Mesh);
              }
            }
          } else {
            const cos = Math.cos(spinAngle), sin = Math.sin(spinAngle);
            const px = pinnedPos[i].x, pz = pinnedPos[i].z;
            c.position.set(cos * px + sin * pz, pinnedPos[i].y, -sin * px + cos * pz);
            c.scale.setScalar(SCATTER_SCALE);
            c.quaternion.copy(c.userData.baseQuat ?? new THREE.Quaternion());
            if (shard2Mesh) hideMesh(shard2Mesh);
          }
        }
      });

      if (landedAll && !firedRef.current) {
        firedRef.current = true;
        onAllLanded?.();
      }
    }
  });

  return <group ref={groupRef} />;
}

// ── ModelViewer ───────────────────────────────────────────────────────────────

export default function ModelViewer() {
  const { scene: scene1 } = useGLTF(MODEL_PATHS[0]);
  const { scene: scene2 } = useGLTF(MODEL_PATHS[1]);
  const { scene: scene3 } = useGLTF(MODEL_PATHS[2]);
  const { scene: scene4 } = useGLTF(MODEL_PATHS[3]);
  const { scene: scene5 } = useGLTF(MODEL_PATHS[4]);

  const { shards: shards1, bodies: bodies1 } = useMemo(() => parseModel(scene1), [scene1]);
  const { shards: shards2, bodies: bodies2 } = useMemo(() => parseModel(scene2), [scene2]);
  const { shards: shards3, bodies: bodies3 } = useMemo(() => parseModel(scene3), [scene3]);
  const { shards: shards4, bodies: bodies4 } = useMemo(() => parseModel(scene4), [scene4]);
  const { shards: shards5, bodies: bodies5 } = useMemo(() => parseModel(scene5), [scene5]);

  const allShards = useMemo(() => [shards1, shards2, shards3, shards4, shards5], [shards1, shards2, shards3, shards4, shards5]);
  const allBodies = useMemo(() => [bodies1, bodies2, bodies3, bodies4, bodies5], [bodies1, bodies2, bodies3, bodies4, bodies5]);

  const groupRef  = useRef();

  const animState        = useRef({ phase: "idle", elapsed: 0 });
  const lastEmittedPhase = useRef("idle");
  const { gl }           = useThree();

  const [transitionKey, setTransitionKey] = useState(0);

  const srcModelIdxRef = useRef(0);
  const dstModelIdxRef = useRef(0);
  const activeModelRef = useRef(0);

  const tilt       = useRef({ x: 0, y: 0.35 });
  const targetTilt = useRef({ x: 0, y: 0.35 });

  // ── Setup materials ───────────────────────────────────────────────────────
  useEffect(() => {
    [scene1, scene2, scene3, scene4, scene5].forEach((scene) => {
      scene.traverse((obj) => {
        if (!obj.isMesh) return;
        obj.castShadow    = true;
        obj.receiveShadow = true;
        obj.material      = obj.material.clone();
        obj.material.roughness       = 0.82;
        obj.material.metalness       = 0.10;
        obj.material.envMapIntensity = 0.50;
        obj.material.transparent     = false;
        obj.material.opacity         = 1;
        obj.material.depthWrite      = true;
        obj.material.needsUpdate     = true;
        if (obj.name.toLowerCase().includes("cell")) obj.visible = false;
      });
    });

    resetBodiesSolid(bodies1);
    resetBodiesHidden(bodies2);
    resetBodiesHidden(bodies3);
    resetBodiesHidden(bodies4);
    resetBodiesHidden(bodies5);
    resetShardsHidden(shards1);
    resetShardsHidden(shards2);
    resetShardsHidden(shards3);
    resetShardsHidden(shards4);
    resetShardsHidden(shards5);
  }, [scene1, scene2, scene3, scene4, scene5, shards1, shards2, shards3, shards4, shards5, bodies1, bodies2, bodies3, bodies4, bodies5]);

  // ── Tab event listener ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      const requested = e.detail?.index;
      const reqIdx    = (requested ?? 1) - 1;
      const st        = animState.current;

      if (reqIdx === activeModelRef.current) return;
      if (st.phase === "exploding" || st.phase === "morphing" || st.phase === "revealed") return;

      allShards.forEach((s) => resetShardsHidden(s));
      allBodies.forEach((b) => resetBodiesHidden(b));

      srcModelIdxRef.current = activeModelRef.current;
      dstModelIdxRef.current = reqIdx;
      activeModelRef.current = reqIdx;

      setTransitionKey((k) => k + 1);

      lastEmittedPhase.current = "exploding";
      window.dispatchEvent(
        new CustomEvent("model-animation-state", { detail: { busy: true, phase: "exploding" } })
      );

      st.phase   = "exploding";
      st.elapsed = 0;
    };

    window.addEventListener("model-tab-change", handler);
    return () => window.removeEventListener("model-tab-change", handler);
  }, [allShards, allBodies]);

  // ── Mouse tilt ────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = gl.domElement;
    const onMove = (e) => {
      const r = canvas.getBoundingClientRect();
      targetTilt.current.x = -((e.clientY - r.top)  / r.height * 2 - 1) * 0.18;
      targetTilt.current.y =  0.35 + ((e.clientX - r.left) / r.width * 2 - 1) * 0.22;
    };
    const onLeave = () => { targetTilt.current.x = 0; targetTilt.current.y = 0.35; };
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);
    return () => {
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseleave", onLeave);
    };
  }, [gl]);

  // ── Main render loop ──────────────────────────────────────────────────────
  useFrame((_, delta) => {
    tilt.current.x += (targetTilt.current.x - tilt.current.x) * 0.05;
    tilt.current.y += (targetTilt.current.y - tilt.current.y) * 0.05;
    if (groupRef.current) {
      groupRef.current.rotation.x = tilt.current.x;
      groupRef.current.rotation.y = tilt.current.y;
    }

    const st = animState.current;
    st.elapsed += delta;

    if (st.phase === "exploding" && st.elapsed >= EXPLODE_DUR)      { st.phase = "morphing";  st.elapsed = 0; }
    if (st.phase === "morphing"  && st.elapsed >= MORPH_DUR + 1.0)  { st.phase = "revealed";  st.elapsed = 0; }
    if (st.phase === "revealed"  && st.elapsed >= REVEALED_DUR)     { st.phase = "idle";       st.elapsed = 0; }

    if (st.phase !== lastEmittedPhase.current) {
      lastEmittedPhase.current = st.phase;
      window.dispatchEvent(new CustomEvent("model-animation-state", {
        detail: { busy: st.phase !== "idle", phase: st.phase }
      }));
    }

    const MORPH_TAIL_START = MORPH_DUR * 0.50;
    const MORPH_TAIL_SPAN  = MORPH_DUR * 0.35;
    const morphTail = st.phase === "morphing"
      ? THREE.MathUtils.clamp((st.elapsed - MORPH_TAIL_START) / MORPH_TAIL_SPAN, 0, 1)
      : (st.phase === "revealed" ? 1 : 0);

    const dstIdx    = dstModelIdxRef.current;
    const activeIdx = activeModelRef.current;
    const animating = st.phase !== "idle";

    allBodies.forEach((bodies, i) => {
      const isDst    = i === dstIdx;
      const isActive = i === activeIdx;

      const showSolid =
        (!animating && isActive) ||
        (animating && isDst && st.phase === "revealed") ||
        (animating && isDst && st.phase === "morphing" && morphTail > 0);

      if (showSolid) {
        const opacity = (st.phase === "morphing" && isDst) ? morphTail : 1;
        bodies.forEach((m) => {
          m.visible              = true;
          m.material.transparent = opacity < 0.999;
          m.material.opacity     = opacity;
          m.material.depthWrite  = true;
          m.material.needsUpdate = true;
        });
      } else {
        resetBodiesHidden(bodies);
      }
    });

    if (st.phase === "idle" || st.phase === "exploding" || st.phase === "revealed") {
      allShards.forEach((s) => resetShardsHidden(s));
    }
  });

  const srcShards = allShards[srcModelIdxRef.current] ?? shards1;
  const dstShards = allShards[dstModelIdxRef.current] ?? shards2;

  return (
    <>
      <Environment preset="studio" environmentIntensity={0.18} />
      <ambientLight intensity={0.07} />
      <directionalLight
        position={[4, 6, 5]} intensity={0.90} castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.1} shadow-camera-far={50}
        shadow-camera-left={-10} shadow-camera-right={10}
        shadow-camera-top={10}   shadow-camera-bottom={-10}
      />
      <directionalLight position={[-3, 2, 3]}  intensity={0.20} color="#8aa0cc" />
      <pointLight       position={[0, -3, 2]}   intensity={0.12} />
      <pointLight       position={[3,  1, -3]}  intensity={0.28} color="#ffe4cc" />
      <pointLight       position={[-3, 2, -2]}  intensity={0.20} color="#d4f0ff" />

      <group ref={groupRef}>

        <group scale={MODEL_SCALE}>
          {bodies1.map((mesh, i) => <primitive key={i} object={mesh} />)}
        </group>
        <group scale={MODEL_SCALE}>
          {bodies2.map((mesh, i) => <primitive key={i} object={mesh} />)}
        </group>
        <group scale={MODEL_SCALE}>
          {bodies3.map((mesh, i) => <primitive key={i} object={mesh} />)}
        </group>
        <group scale={MODEL_SCALE}>
          {bodies4.map((mesh, i) => <primitive key={i} object={mesh} />)}
        </group>
        <group scale={MODEL_SCALE}>
          {bodies5.map((mesh, i) => <primitive key={i} object={mesh} />)}
        </group>

        <primitive object={scene1} visible={false} />
        <primitive object={scene2} visible={false} />
        <primitive object={scene3} visible={false} />
        <primitive object={scene4} visible={false} />
        <primitive object={scene5} visible={false} />

        <StoneField
          key={transitionKey}
          shards1={srcShards}
          shards2={dstShards}
          stateRef={animState}
          onAllLanded={() => {}}
        />

      </group>
    </>
  );
}

MODEL_PATHS.forEach((p) => useGLTF.preload(p));
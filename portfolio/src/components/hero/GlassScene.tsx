"use client";

import { Environment, Lightformer, MeshTransmissionMaterial, Text } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { asset } from "@/lib/asset";

/** One line of the headline, measured from the DOM in CSS pixels. */
export type LineSpec = {
  text: string;
  /** Left edge, relative to the canvas. */
  x: number;
  /** Vertical centre of the line box, relative to the canvas. */
  cy: number;
  width: number;
  height: number;
};

type SceneProps = {
  lines: LineSpec[];
  fg: string;
  bg: string;
  reduced: boolean;
  introDelay: number;
  onReady: () => void;
};

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

// Shared between the scene's parts; written by window listeners.
const pointer = { x: 0, y: 0 };

/* ----------------------------------------------------------------- type */

function Line({
  spec,
  index,
  color,
  reduced,
  introDelay,
  onSynced,
}: {
  spec: LineSpec;
  index: number;
  color: string;
  reduced: boolean;
  introDelay: number;
  onSynced: () => void;
}) {
  const { size } = useThree();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const text = useRef<any>(null);
  const [natural, setNatural] = useState<number | null>(null);
  const born = useRef<number | null>(null);
  const done = useRef(reduced);

  const scale = natural ? spec.width / natural : 1;
  const localHeight = spec.height / scale;

  useFrame(({ clock }) => {
    const t = text.current;
    if (!t || !natural || done.current) return;
    born.current ??= clock.elapsedTime;
    const p = easeOutExpo(clamp01((clock.elapsedTime - born.current - introDelay - index * 0.09) / 1.2));
    const offset = (1 - p) * localHeight * 1.05;
    // Rise through a fixed window: move the glyphs down, the clip up.
    t.position.y = -offset;
    t.clipRect = [-1e5, -localHeight / 2 + offset, 1e5, localHeight / 2 + offset];
    if (p >= 1) {
      t.clipRect = null;
      t.position.y = 0;
      done.current = true;
    }
  });

  return (
    <group position={[spec.x - size.width / 2, size.height / 2 - spec.cy, 0]} scale={scale}>
      <Text
        ref={text}
        font={asset("/fonts/geist-600.woff")}
        fontSize={100}
        letterSpacing={-0.045}
        lineHeight={1}
        anchorX="left"
        anchorY="middle"
        color={color}
        visible={natural !== null}
        material-toneMapped={false}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onSync={(mesh: any) => {
          const b = mesh.textRenderInfo?.blockBounds;
          if (!b) return;
          setNatural(b[2] - b[0]);
          onSynced();
        }}
      >
        {spec.text}
      </Text>
    </group>
  );
}

/* ---------------------------------------------------------------- glass */

/** Reshapes the form in place: slow, overlapping waves pushed along each normal. */
function morph(geometry: THREE.BufferGeometry, base: Float32Array, time: number) {
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const arr = pos.array as Float32Array;
  for (let i = 0; i < arr.length; i += 3) {
    const x = base[i];
    const y = base[i + 1];
    const z = base[i + 2];
    const a = Math.sin(x * 1.9 + time * 0.42) * Math.sin(y * 2.3 + time * 0.31 + 1.7) * Math.sin(z * 1.6 - time * 0.27);
    const b = Math.sin(x * 3.7 - time * 0.36 + 0.6) * Math.sin(y * 3.1 + time * 0.22) * Math.cos(z * 3.4 + time * 0.3);
    const r = 1 + a * 0.34 + b * 0.1;
    arr[i] = x * r;
    arr[i + 1] = y * r * 1.08;
    arr[i + 2] = z * r * 0.8;
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
}

function Glass({ bg, reduced, introDelay }: { bg: string; reduced: boolean; introDelay: number }) {
  const { size } = useThree();
  const mesh = useRef<THREE.Mesh>(null);
  const born = useRef<number | null>(null);
  const portrait = size.width < size.height;
  const small = size.width < 768;

  const { geometry, base } = useMemo(() => {
    const ico = new THREE.IcosahedronGeometry(1, small ? 14 : 22);
    ico.deleteAttribute("uv");
    ico.deleteAttribute("normal");
    const merged = mergeVertices(ico);
    ico.dispose();
    return { geometry: merged, base: Float32Array.from(merged.attributes.position.array) };
  }, [small]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const background = useMemo(() => new THREE.Color(bg), [bg]);

  // Where the form rests, in pixels from the canvas centre.
  const radius = portrait ? size.width * 0.34 : Math.min(size.width * 0.19, size.height * 0.3);
  const homeX = portrait ? size.width * 0.16 : size.width * 0.17;
  const homeY = portrait ? size.height * 0.5 - size.width * 0.66 : -size.height * 0.03;

  // A still, pleasing pose for reduced-motion visitors.
  useEffect(() => {
    if (reduced && mesh.current) morph(mesh.current.geometry, base, 4.2);
  }, [reduced, base]);

  useFrame(({ clock }, delta) => {
    const m = mesh.current;
    if (!m) return;
    if (reduced) {
      m.position.set(homeX, homeY, 400);
      m.scale.setScalar(radius);
      return;
    }
    const time = clock.elapsedTime;
    born.current ??= time;
    const intro = easeOutExpo(clamp01((time - born.current - introDelay - 0.15) / 1.8));
    const scrolled = window.scrollY;
    const k = 1 - Math.exp(-delta * 3.2);

    morph(m.geometry, base, time);

    const tx = homeX + pointer.x * radius * 0.22;
    const ty = homeY + pointer.y * radius * 0.18 - scrolled * 0.38 - (1 - intro) * size.height * 0.2;
    m.position.x += (tx - m.position.x) * k;
    m.position.y += (ty - m.position.y) * k;
    m.position.z = 400;

    m.rotation.x += (pointer.y * -0.45 + scrolled * 0.0011 - m.rotation.x) * k;
    m.rotation.y += (pointer.x * 0.55 + time * 0.12 - m.rotation.y) * k;
    m.rotation.z = time * 0.05 + scrolled * 0.0006;

    m.scale.setScalar(radius * (0.35 + intro * 0.65) * (1 + (scrolled / size.height) * 0.22));
  });

  return (
    <mesh ref={mesh} geometry={geometry} scale={radius} position={[homeX, homeY, 400]}>
      <MeshTransmissionMaterial
        background={background}
        samples={small ? 4 : 8}
        resolution={small ? 384 : 768}
        transmission={1}
        thickness={0.85}
        ior={1.32}
        roughness={0.03}
        chromaticAberration={0.32}
        anisotropicBlur={0.06}
        distortion={0.18}
        distortionScale={0.45}
        temporalDistortion={reduced ? 0 : 0.06}
        clearcoat={1}
        clearcoatRoughness={0.05}
        iridescence={0.3}
        iridescenceIOR={1.28}
        iridescenceThicknessRange={[120, 520]}
        attenuationColor="#b98cff"
        attenuationDistance={radius * 9}
        color="#ffffff"
      />
    </mesh>
  );
}

/* ---------------------------------------------------------------- scene */

function Scene({ lines, fg, bg, reduced, introDelay, onReady }: SceneProps) {
  const synced = useRef(0);
  const announced = useRef(false);

  return (
    <>
      {lines.map((spec, i) => (
        <Line
          key={i}
          spec={spec}
          index={i}
          color={fg}
          reduced={reduced}
          introDelay={introDelay}
          onSynced={() => {
            synced.current += 1;
            if (!announced.current && synced.current >= lines.length) {
              announced.current = true;
              onReady();
            }
          }}
        />
      ))}
      <Glass bg={bg} reduced={reduced} introDelay={introDelay} />

      {/* A small studio, built from light cards so nothing is downloaded. */}
      <Environment resolution={256} frames={1}>
        <color attach="background" args={["#050507"]} />
        <Lightformer form="rect" intensity={5} position={[0, 4, -1]} scale={[8, 1.2, 1]} rotation-x={Math.PI / 2} />
        <Lightformer form="ring" intensity={4} color="#b98cff" position={[-5, 1, 2]} scale={3} rotation-y={Math.PI / 2} />
        <Lightformer form="rect" intensity={3} color="#b8d9ff" position={[5, -2, 1]} scale={[1, 5, 1]} rotation-y={-Math.PI / 2} />
        <Lightformer form="circle" intensity={2} position={[0, -4, 3]} scale={2.5} rotation-x={-Math.PI / 2} />
        <Lightformer form="rect" intensity={1.5} position={[0, 0, 6]} scale={[6, 0.4, 1]} />
      </Environment>
    </>
  );
}

export default function GlassScene({
  lines,
  fg,
  bg,
  reduced,
  introDelay,
  onReady,
}: SceneProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    io.observe(el);
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <div ref={wrap} className="absolute inset-0" aria-hidden>
      <Canvas
        orthographic
        flat
        dpr={[1, 1.75]}
        camera={{ position: [0, 0, 2000], near: 1, far: 6000, zoom: 1 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        frameloop={reduced ? "demand" : inView ? "always" : "never"}
      >
        <Scene lines={lines} fg={fg} bg={bg} reduced={reduced} introDelay={introDelay} onReady={onReady} />
      </Canvas>
    </div>
  );
}

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { fileUrl, Project, Scene } from "./api";

const VIEWS: Record<string, [number, number]> = {
  three_quarter_left: [35, 10],
  three_quarter_right: [-35, 10],
  front: [0, 0],
  front_top: [0, 15],
  top_down: [0, 90],
  hero: [28, 24],
};
const FINISH: Record<string, { roughness: number; clearcoat: number; sheen: number }> = {
  matte: { roughness: 0.7, clearcoat: 0, sheen: 0 },
  gloss: { roughness: 0.3, clearcoat: 0.85, sheen: 0 },
  soft_touch: { roughness: 0.85, clearcoat: 0, sheen: 0.25 },
};

type Box = { project: Project; position: [number, number] };

export default function Preview3D({ boxes, scene, view, width = 520 }: { boxes: Box[]; scene: Scene; view: string; width?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const aspect = (() => {
    const a: Record<string, number> = { "1:1": 1, "4:5": 4 / 5, "16:9": 16 / 9, A4: 210 / 297 };
    if (scene.aspect === "custom" && scene.custom_w && scene.custom_h) return scene.custom_w / scene.custom_h;
    return a[scene.aspect] || 1;
  })();
  const height = Math.round(width / aspect);

  useEffect(() => {
    const el = ref.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping; // like Blender's "Standard" view transform
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    el.innerHTML = "";
    el.appendChild(renderer.domElement);

    const s3 = new THREE.Scene();
    if (scene.background !== "transparent") s3.background = new THREE.Color(scene.background);
    const loader = new THREE.TextureLoader();
    const fin = FINISH[scene.finish] || FINISH.matte;
    const all: THREE.Vector3[] = [];

    for (const b of boxes) {
      const p = b.project;
      const box = p.measure.box!;
      const W = box.width, D = box.depth, H = box.height; // mm
      // BoxGeometry face order: +x (right), -x (left), +y (top), -y (bottom), +z, -z.
      // Our world: X right, Y up (three), Z towards the viewer = front.
      const roleFor = ["right", "left", "top", "bottom", "front", "back"];
      const mats = roleFor.map((role) => {
        const pid = p.faces?.[role];
        const m = new THREE.MeshPhysicalMaterial({
          color: pid ? 0xffffff : 0xe8e8e8,
          roughness: fin.roughness,
          clearcoat: fin.clearcoat,
          clearcoatRoughness: 0.06,
          sheen: fin.sheen,
        });
        if (pid && p.panels?.[pid]) {
          const t = loader.load(fileUrl(p.id, p.panels[pid].preview, p.created));
          t.colorSpace = THREE.SRGBColorSpace;
          t.anisotropy = 8;
          // three's top face: u=+x, v=-z (towards the back) - matches "front edge at the bottom";
          // bottom face: u=+x, v=+z (towards the front) - matches "front edge at the top".
          m.map = t;
        }
        return m;
      });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), mats);
      mesh.position.set(b.position[0], H / 2, -b.position[1]);
      mesh.castShadow = true;
      s3.add(mesh);
      for (const sx of [-1, 1]) for (const sy of [0, 1]) for (const sz of [-1, 1])
        all.push(new THREE.Vector3(b.position[0] + (sx * W) / 2, sy * H, -b.position[1] + (sz * D) / 2));
    }

    const size = Math.max(...boxes.map((b) => Math.max(b.project.measure.box!.height, b.project.measure.box!.width)));
    const center = all.reduce((a, v) => a.add(v), new THREE.Vector3()).multiplyScalar(1 / all.length);

    // lights: soft key (casts shadow), shadowless fill, ambient
    s3.add(new THREE.HemisphereLight(0xffffff, 0xffffff, 1.2));
    const camAz = (VIEWS[view] || VIEWS.three_quarter_left)[0];
    const keySide = scene.key_side === "auto" ? (camAz >= 0 ? "right" : "left") : scene.key_side;
    const kaz = ({ left: 40, right: -40, front: 0 } as Record<string, number>)[keySide] * (Math.PI / 180);
    const kel = (42 * Math.PI) / 180;
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(-Math.sin(kaz) * Math.cos(kel), Math.sin(kel), Math.cos(kaz) * Math.cos(kel)).multiplyScalar(size * 6).add(center);
    key.target.position.copy(center);
    key.castShadow = scene.shadow;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.radius = 18;
    key.shadow.blurSamples = 24;
    const sc = key.shadow.camera as THREE.OrthographicCamera;
    sc.left = sc.bottom = -size * 3;
    sc.right = sc.top = size * 3;
    sc.far = size * 20;
    s3.add(key, key.target);
    const fill = new THREE.DirectionalLight(0xffffff, 0.5);
    fill.position.set(Math.sin(kaz) * 0.5, 0.3, 1).multiplyScalar(size * 6).add(center);
    s3.add(fill);
    if (scene.shadow) {
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(size * 40, size * 40), new THREE.ShadowMaterial({ opacity: 0.22 }));
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      s3.add(ground);
    }

    // camera: level (two-point perspective) + lens shift, fitted like the Blender renderer
    let [az, el2] = VIEWS[view] || VIEWS.three_quarter_left;
    if (view === "front_top" && scene.front_top_elevation != null) el2 = scene.front_top_elevation;
    if (scene.azimuth != null && view !== "front" && view !== "top_down" && view !== "front_top") az = Math.abs(scene.azimuth) * Math.sign(az || 1);
    if (scene.elevation != null && view !== "front" && view !== "top_down" && view !== "front_top") el2 = scene.elevation;
    const azr = (az * Math.PI) / 180, elr = (el2 * Math.PI) / 180;
    const fovV = 2 * Math.atan(24 / 2 / scene.focal) * (180 / Math.PI);
    const cam = new THREE.PerspectiveCamera(fovV, aspect, 1, size * 200);
    const topDown = view === "top_down";
    const dir = topDown ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(-Math.sin(azr) * Math.cos(elr), Math.sin(elr), Math.cos(azr) * Math.cos(elr));
    const fullW = 1000, fullH = Math.round(1000 / aspect);
    let dist = size * 6;
    const fillF = scene.fill;
    let offX = 0, offY = 0;
    for (let i = 0; i < 12; i++) {
      cam.position.copy(center).addScaledVector(dir, dist);
      if (topDown) {
        cam.up.set(0, 0, -1);
        cam.lookAt(center);
      } else {
        cam.up.set(0, 1, 0);
        cam.lookAt(new THREE.Vector3(center.x, cam.position.y, center.z)); // level: no pitch
      }
      cam.clearViewOffset();
      cam.updateMatrixWorld();
      cam.updateProjectionMatrix();
      let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
      for (const v of all) {
        const p = v.clone().project(cam);
        minx = Math.min(minx, p.x); maxx = Math.max(maxx, p.x); miny = Math.min(miny, p.y); maxy = Math.max(maxy, p.y);
      }
      const need = Math.max((maxx - minx) / (2 * fillF), (maxy - miny) / (2 * fillF));
      offX = ((minx + maxx) / 2) * (fullW / 2);
      offY = -((miny + maxy) / 2) * (fullH / 2);
      dist *= need;
      if (Math.abs(need - 1) < 1e-4) break;
    }
    offX -= (scene.anchor?.[0] || 0) * (1 - fillF) * (fullW / 2);
    offY += (scene.anchor?.[1] || 0) * (1 - fillF) * (fullH / 2);
    cam.setViewOffset(fullW, fullH, offX, offY, fullW, fullH);
    cam.updateProjectionMatrix();

    renderer.render(s3, cam);
    let raf = 0;
    const loop = () => {
      renderer.render(s3, cam);
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      renderer.dispose();
    };
  }, [boxes, scene, view, width, height, aspect]);

  return <div ref={ref} className="preview3d checker" style={{ width, height }} />;
}

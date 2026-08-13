import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function BookLoader() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let width = mount.clientWidth || 180;
    let height = mount.clientHeight || 180;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0.3, 2.9, 4.4);
    camera.lookAt(0, 0, 0);

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return;
    }
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    mount.appendChild(renderer.domElement);

    // Lighting — soft key + fill, no harsh shadows
    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(2.5, 5, 3);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xccddff, 0.35);
    fill.position.set(-3, 1.5, -2);
    scene.add(fill);

    // Soft radial "contact shadow" under the book — a plane with a
    // canvas-generated radial gradient texture, faked without extra deps.
    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = 256;
    shadowCanvas.height = 256;
    const ctx = shadowCanvas.getContext("2d");
    const gradient = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
    gradient.addColorStop(0, "rgba(0,0,0,0.35)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
    const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      depthWrite: false,
    });
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 2.6),
      shadowMat
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -0.02;
    scene.add(shadowPlane);

    // Brand-matched colors: white cover, warm off-white pages, subtle gray accent
    const coverMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.35,
      metalness: 0.05,
    });
    const spineMaterial = new THREE.MeshStandardMaterial({
      color: 0xe5e7eb,
      roughness: 0.5,
    });
    const pageMaterial = new THREE.MeshStandardMaterial({
      color: 0xf5f5f0,
      roughness: 0.95,
    });

    const bookGroup = new THREE.Group();
    scene.add(bookGroup);

    const BOOK_W = 1.55;
    const BOOK_D = 2.05;

    // Back cover — static base
    const backCover = new THREE.Mesh(
      new THREE.BoxGeometry(BOOK_W, 0.035, BOOK_D),
      coverMaterial
    );
    bookGroup.add(backCover);

    // Spine
    const spine = new THREE.Mesh(
      new THREE.BoxGeometry(BOOK_W, 0.24, 0.05),
      spineMaterial
    );
    spine.position.set(0, 0.1, -BOOK_D / 2);
    bookGroup.add(spine);

    // Page stack — several thin individual sheets instead of one solid
    // block, each hinging open with a slight stagger for a fanning look.
    const PAGE_COUNT = 5;
    const pageHinges = [];
    for (let i = 0; i < PAGE_COUNT; i++) {
      const hinge = new THREE.Group();
      const yOffset = 0.03 + i * 0.028;
      hinge.position.set(0, yOffset, -BOOK_D / 2 + 0.02);
      bookGroup.add(hinge);

      const pageMesh = new THREE.Mesh(
        new THREE.BoxGeometry(BOOK_W - 0.1, 0.02, BOOK_D - 0.06),
        pageMaterial
      );
      pageMesh.position.set(0, 0, (BOOK_D - 0.06) / 2);
      hinge.add(pageMesh);

      pageHinges.push({ hinge, phase: i * 0.12, speed: 0.85 + i * 0.03 });
    }

    // Front cover — outermost hinge, opens last/widest
    const coverHinge = new THREE.Group();
    coverHinge.position.set(0, 0.03 + PAGE_COUNT * 0.028 + 0.02, -BOOK_D / 2);
    bookGroup.add(coverHinge);

    const frontCover = new THREE.Mesh(
      new THREE.BoxGeometry(BOOK_W, 0.035, BOOK_D),
      coverMaterial
    );
    frontCover.position.set(0, 0, BOOK_D / 2);
    coverHinge.add(frontCover);

    bookGroup.rotation.x = -0.32;

    let frameId;
    const clock = new THREE.Clock();

    function smoothstep(x) {
      const c = Math.min(Math.max(x, 0), 1);
      return c * c * (3 - 2 * c);
    }

    function animate() {
      frameId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      const cycle = (Math.sin(t * 0.75) + 1) / 2;
      const eased = smoothstep(cycle);
      const coverAngle = THREE.MathUtils.lerp(-0.08, -Math.PI + 0.2, eased);
      coverHinge.rotation.x = coverAngle;

      // Each page follows the cover with a slight phase/speed offset so
      // they appear to fan open in sequence rather than as one rigid block.
      pageHinges.forEach(({ hinge, phase, speed }) => {
        const pCycle = (Math.sin(t * 0.75 * speed + phase) + 1) / 2;
        const pEased = smoothstep(pCycle);
        hinge.rotation.x = THREE.MathUtils.lerp(-0.05, -Math.PI + 0.4, pEased);
      });

      bookGroup.rotation.y = Math.sin(t * 0.3) * 0.22;

      renderer.render(scene, camera);
    }
    animate();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        if (w === 0 || h === 0) continue;
        width = w;
        height = h;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      }
    });
    resizeObserver.observe(mount);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      backCover.geometry.dispose();
      spine.geometry.dispose();
      frontCover.geometry.dispose();
      shadowPlane.geometry.dispose();
      pageHinges.forEach(({ hinge }) => {
        hinge.children.forEach((child) => child.geometry?.dispose());
      });
      coverMaterial.dispose();
      spineMaterial.dispose();
      pageMaterial.dispose();
      shadowMat.dispose();
      shadowTexture.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        width: "180px",
        height: "180px",
        minWidth: "180px",
        minHeight: "180px",
      }}
    />
  );
}

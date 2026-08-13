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

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 2.6, 4.6);
    camera.lookAt(0, 0, 0);

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return; // WebGL unavailable, silently skip the 3D loader
    }
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    mount.appendChild(renderer.domElement);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(2, 5, 3);
    scene.add(dirLight);
    const fillLight = new THREE.DirectionalLight(0x88aaff, 0.3);
    fillLight.position.set(-3, 2, -2);
    scene.add(fillLight);

    // Colors chosen to stand out against a dark (gray-950) background
    const coverMaterial = new THREE.MeshStandardMaterial({
      color: 0x4f7cff, // bright blue cover
      roughness: 0.4,
      metalness: 0.15,
    });
    const spineMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a5fd9,
      roughness: 0.4,
    });
    const pageMaterial = new THREE.MeshStandardMaterial({
      color: 0xfafaf5,
      roughness: 0.9,
    });

    const bookGroup = new THREE.Group();
    scene.add(bookGroup);

    const BOOK_W = 1.6;
    const BOOK_D = 2.1;

    // Back cover — flat base, does not move
    const backCover = new THREE.Mesh(
      new THREE.BoxGeometry(BOOK_W, 0.04, BOOK_D),
      coverMaterial
    );
    bookGroup.add(backCover);

    // Spine — thin bar along the hinge edge
    const spine = new THREE.Mesh(
      new THREE.BoxGeometry(BOOK_W, 0.22, 0.06),
      spineMaterial
    );
    spine.position.set(0, 0.09, -BOOK_D / 2);
    bookGroup.add(spine);

    // Page block — sits on the back cover
    const pages = new THREE.Mesh(
      new THREE.BoxGeometry(BOOK_W - 0.08, 0.16, BOOK_D - 0.08),
      pageMaterial
    );
    pages.position.set(0, 0.1, 0);
    bookGroup.add(pages);

    // Front cover — pivots open/closed around the spine edge (back of the book)
    const hinge = new THREE.Group();
    hinge.position.set(0, 0.2, -BOOK_D / 2);
    bookGroup.add(hinge);

    const frontCover = new THREE.Mesh(
      new THREE.BoxGeometry(BOOK_W, 0.04, BOOK_D),
      coverMaterial
    );
    // Shift the mesh forward by half its depth so it hinges from its back edge
    frontCover.position.set(0, 0, BOOK_D / 2);
    hinge.add(frontCover);

    bookGroup.rotation.x = -0.35;

    let frameId;
    const clock = new THREE.Clock();

    function animate() {
      frameId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Ease between mostly-closed and mostly-open
      const cycle = (Math.sin(t * 0.9) + 1) / 2;
      const eased = cycle * cycle * (3 - 2 * cycle); // smoothstep
      hinge.rotation.x = THREE.MathUtils.lerp(-0.1, -Math.PI + 0.25, eased);

      bookGroup.rotation.y = Math.sin(t * 0.35) * 0.25;

      renderer.render(scene, camera);
    }
    animate();

    // Keep the canvas correctly sized even if the container's dimensions
    // weren't finalized at mount time (flex/animation layouts can do this).
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
      pages.geometry.dispose();
      frontCover.geometry.dispose();
      coverMaterial.dispose();
      spineMaterial.dispose();
      pageMaterial.dispose();
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

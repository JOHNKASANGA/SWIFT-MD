import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function BookLoader() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    const width = mount.clientWidth;
    const height = mount.clientHeight;

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 2.2, 4.2);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
    dirLight.position.set(2, 4, 3);
    scene.add(dirLight);

    // Book base (spine + back cover, stays flat)
    const coverMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.5,
      metalness: 0.1,
    });
    const pageMaterial = new THREE.MeshStandardMaterial({
      color: 0xe5e7eb,
      roughness: 0.8,
    });

    const bookGroup = new THREE.Group();
    scene.add(bookGroup);

    // Back cover (static, flat on "table")
    const backCoverGeo = new THREE.BoxGeometry(1.6, 0.03, 2.2);
    const backCover = new THREE.Mesh(backCoverGeo, coverMaterial);
    backCover.position.set(0, 0, 0);
    bookGroup.add(backCover);

    // Pages stack (static, sits on back cover)
    const pagesGeo = new THREE.BoxGeometry(1.5, 0.15, 2.1);
    const pages = new THREE.Mesh(pagesGeo, pageMaterial);
    pages.position.set(0, 0.09, 0);
    bookGroup.add(pages);

    // Front cover — hinges open/closed around the spine edge
    const coverPivot = new THREE.Group();
    coverPivot.position.set(0, 0.17, -1.1); // spine edge
    bookGroup.add(coverPivot);

    const frontCoverGeo = new THREE.BoxGeometry(1.6, 0.03, 2.2);
    const frontCover = new THREE.Mesh(frontCoverGeo, coverMaterial);
    frontCover.position.set(0, 0, 1.1); // offset so pivot is at the spine edge
    coverPivot.add(frontCover);

    bookGroup.rotation.x = -0.3;

    let frame;
    const clock = new THREE.Clock();

    function animate() {
      frame = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Smooth open/close loop between ~10deg and ~170deg
      const cycle = (Math.sin(t * 0.8) + 1) / 2; // 0 -> 1 -> 0
      const angle = THREE.MathUtils.lerp(-0.15, -Math.PI + 0.15, cycle);
      coverPivot.rotation.x = angle;

      bookGroup.rotation.y = Math.sin(t * 0.3) * 0.15;

      renderer.render(scene, camera);
    }
    animate();

    function handleResize() {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", handleResize);
      mount.removeChild(renderer.domElement);
      backCoverGeo.dispose();
      pagesGeo.dispose();
      frontCoverGeo.dispose();
      coverMaterial.dispose();
      pageMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} style={{ width: "180px", height: "180px" }} />;
}

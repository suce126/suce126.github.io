import * as THREE from "three";

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const root = document.documentElement;

document.getElementById("year").textContent = new Date().getFullYear();

const themeBtn = document.querySelector(".theme-toggle");
const saved = localStorage.getItem("theme");
if (saved) root.setAttribute("data-theme", saved);
themeBtn.addEventListener("click", () => {
  const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
  root.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  window.dispatchEvent(new CustomEvent("themechange", { detail: next }));
});

document.querySelectorAll(".fade-in").forEach((el, i) => {
  setTimeout(() => el.classList.add("in"), 80 + i * 90);
});

(function globe() {
  const canvas = document.getElementById("globe");
  if (!canvas) return;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  camera.position.z = 3.4;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.LinearToneMapping;
  renderer.toneMappingExposure = 1.25;

  function resize() {
    const w = canvas.clientWidth;
    renderer.setSize(w, w, false);
  }
  resize();
  window.addEventListener("resize", resize);

  const group = new THREE.Group();
  scene.add(group);

  const earthGeo = new THREE.SphereGeometry(1, 96, 64);
  earthGeo.rotateY(-Math.PI / 2);

  const earthMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
  });
  const earth = new THREE.Mesh(earthGeo, earthMat);
  group.add(earth);

  const loader = new THREE.TextureLoader();
  loader.load("earth.jpg", (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    earthMat.map = tex;
    earthMat.needsUpdate = true;
  });

  const atmosphereMat = new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      uniform vec3 uColor;
      void main() {
        float intensity = pow(0.62 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.4);
        gl_FragColor = vec4(uColor, 1.0) * intensity;
      }
    `,
    uniforms: {
      uColor: { value: new THREE.Color(0x6ab0ff) },
    },
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(1.12, 64, 48), atmosphereMat);
  scene.add(atmosphere);

  function llToVec3(lon, lat, r = 1.0) {
    const phi = ((90 - lat) * Math.PI) / 180;
    const theta = (lon * Math.PI) / 180;
    return new THREE.Vector3().setFromSphericalCoords(r, phi, theta);
  }

  const COPENHAGEN = { lat: 55.6761, lon: 12.5683 };
  const pinPos = llToVec3(COPENHAGEN.lon, COPENHAGEN.lat, 1);

  const pin = new THREE.Mesh(
    new THREE.SphereGeometry(0.012, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xff5b5b }),
  );
  pin.position.copy(pinPos.clone().multiplyScalar(1.015));
  group.add(pin);

  const pinRing = new THREE.Mesh(
    new THREE.RingGeometry(0.018, 0.026, 48),
    new THREE.MeshBasicMaterial({
      color: 0xff5b5b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    }),
  );
  pinRing.position.copy(pinPos.clone().multiplyScalar(1.02));
  pinRing.lookAt(0, 0, 0);
  group.add(pinRing);

  const lonRad = (COPENHAGEN.lon * Math.PI) / 180;
  const latRad = (COPENHAGEN.lat * Math.PI) / 180;
  group.rotation.y = -lonRad;
  group.rotation.x = latRad * 0.55;

  let isDown = false, lx = 0, ly = 0, autoRotate = true;
  let resumeTimer;

  canvas.addEventListener("pointerdown", (e) => {
    isDown = true;
    lx = e.clientX;
    ly = e.clientY;
    autoRotate = false;
    canvas.setPointerCapture(e.pointerId);
    clearTimeout(resumeTimer);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!isDown) return;
    const dx = e.clientX - lx;
    const dy = e.clientY - ly;
    group.rotation.y += dx * 0.005;
    group.rotation.x = Math.max(
      -Math.PI / 2,
      Math.min(Math.PI / 2, group.rotation.x + dy * 0.005),
    );
    lx = e.clientX;
    ly = e.clientY;
  });
  function endDrag(e) {
    if (!isDown) return;
    isDown = false;
    if (e && e.pointerId !== undefined && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
    resumeTimer = setTimeout(() => { autoRotate = true; }, 2200);
  }
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  let t = 0;
  function tick() {
    t += 0.016;
    if (autoRotate && !prefersReducedMotion) {
      group.rotation.y += 0.0014;
    }
    pinRing.scale.setScalar(1 + 0.3 * Math.sin(t * 2.2));
    pinRing.material.opacity = 0.7 - 0.3 * Math.sin(t * 2.2);
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  tick();
})();

import "./style.css";
import * as THREE from "three";
import basicTextureVertexShader from "./shaders/basicTexture/vertex.glsl";
import basicTextureFragmentShader from "./shaders/basicTexture/fragment.glsl";
import * as ENGINE from "./engine.js";

/**
 * Core objects
 */

const engine = new ENGINE.KubEngine();

class World {
  constructor(engine) {
    this.engine = engine;

    const light = new THREE.DirectionalLight(0xffffff, 2);
    light.position.set(100, 100, 100);
    light.target.position.set(0, 0, 0);
    light.castShadow = true;
    light.shadow.mapSize.width = 2048;
    light.shadow.mapSize.height = 2048;
    light.shadow.camera.near = 1.0;
    light.shadow.camera.far = 200.0;
    light.shadow.camera.left = -100.0;
    light.shadow.camera.right = 100.0;
    light.shadow.camera.top = 100.0;
    light.shadow.camera.bottom = -100.0;
    engine.scene.add(light);

    const ambientLight = new THREE.AmbientLight(0x404040);
    engine.scene.add(ambientLight);

    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    plane.castShadow = true;
    plane.receiveShadow = true;
    plane.rotation.x = -Math.PI / 2;

    engine.scene.add(plane);

    const textureShader = engine.renderManager.materialManager.addMaterial(
      "texture",
      basicTextureVertexShader,
      basicTextureFragmentShader,
      {
        unique: true,
      }
    );

    for (let i = 0; i < 40; i++) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1), textureShader);
      box.position.x = Math.randomRange(-10, 10);
      box.position.y = Math.randomRange(1, 3);
      box.position.z = Math.randomRange(-10, 10);
      engine.scene.add(box);
      box.castShadow = true;
      box.receiveShadow = true;
      box.material.shading = THREE.SmoothShading;
      this.box = box;
    }
  }

  update() {
    this.box.setRotationFromEuler(
      new THREE.Euler(0, this.engine.timeManager.time.gameTime, 0)
    );
  }
}

const world = new World(engine);
engine.world = world;

engine.startGame();

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

    const textureShader = engine.renderManager.materialManager.addMaterial(
      "texture",
      basicTextureVertexShader,
      basicTextureFragmentShader,
      {
        unique: true,
      }
    );

    const light = new THREE.DirectionalLight(0xffffff);
    light.position.set(10, 10, 10);
    light.target.position.set(0, 0, 0);
    light.castShadow = true;
    light.shadow.bias = -0.01;
    light.shadow.mapSize.width = 2 << 11;
    light.shadow.mapSize.height = 2 << 11;
    light.shadow.camera.near = 1.0;
    light.shadow.camera.far = 500.0;
    light.shadow.camera.left = 200.0;
    light.shadow.camera.right = -200.0;
    light.shadow.camera.top = 200.0;
    light.shadow.camera.bottom = -200.0;
    engine.scene.add(light);

    const ambientLight = new THREE.AmbientLight(0x404040);
    engine.scene.add(ambientLight);

    const boxG = new THREE.BoxGeometry(1, 1);
    const boxMesh = new THREE.Mesh(boxG, textureShader);
    engine.scene.add(boxMesh);
    boxMesh.castShadow = true;
    boxMesh.receiveShadow = true;
    boxMesh.material.shading = THREE.SmoothShading;
    this.box = boxMesh;
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

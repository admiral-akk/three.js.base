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

/**
 * Animation
 */
const tick = () => {
  engine.statsManager.stats.begin();
  engine.update();
  engine.composer.render();
  window.requestAnimationFrame(tick);
  engine.endLoop();
  engine.statsManager.stats.end();
};

engine.startGame();
tick();

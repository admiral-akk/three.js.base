import "./style.css";
import * as THREE from "three";
import basicTextureVertexShader from "./shaders/basicTexture/vertex.glsl";
import basicTextureFragmentShader from "./shaders/basicTexture/fragment.glsl";
import * as ENGINE from "./engine.js";

/**
 * Core objects
 */

const engine = new ENGINE.KubEngine();

class RealTimeStrategyCamera {
  constructor(engine) {
    this.camera = engine.renderManager.camera;
    this.input = engine.inputManager;

    this.cameraParams = {
      distance: 5,
      phi: Math.PI / 4,
      theta: Math.PI / 4,
    };

    this.target = new THREE.Vector3();
    this.position = new THREE.Vector3();
  }

  updateTarget() {
    const { phi } = this.cameraParams;
    const qx = new THREE.Quaternion();
    qx.setFromAxisAngle(new THREE.Vector3(0, 1, 0), phi);
    const { pressedKeys } = this.input.keyState;
    const forwardVelocity =
      (pressedKeys.has("w") ? 1 : 0) - (pressedKeys.has("s") ? 1 : 0);
    const forward = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(qx)
      .multiplyScalar(forwardVelocity);

    const strafeVelocity =
      (pressedKeys.has("a") ? 1 : 0) - (pressedKeys.has("d") ? 1 : 0);
    const left = new THREE.Vector3(-1, 0, 0)
      .applyQuaternion(qx)
      .multiplyScalar(strafeVelocity);

    if (forwardVelocity || strafeVelocity) {
      left.add(forward).normalize();
      this.target.add(left.multiplyScalar(this.cameraParams.distance / 40));
    }
  }

  updatePosition() {
    const delta = new THREE.Vector3();
    delta.subVectors(this.target, this.position).multiplyScalar(0.1);
    this.position.add(delta);
  }

  updateCameraParams() {
    const { deltaY } = this.input.mouseState.mouseWheel;
    if (deltaY) {
      this.cameraParams.distance = Math.clamp(
        this.cameraParams.distance + deltaY / 100,
        3,
        20
      );
      this.cameraParams.theta =
        (Math.PI * (this.cameraParams.distance + 20)) / 160;
    }
  }

  updateCamera() {
    const { distance, phi, theta } = this.cameraParams;
    const horizontalOffset = new THREE.Vector3(
      Math.sin(phi),
      0,
      Math.cos(phi)
    ).multiplyScalar(Math.cos(theta));
    const offset = new THREE.Vector3(0, Math.sin(theta), 0)
      .add(horizontalOffset)
      .multiplyScalar(distance)
      .add(this.position);

    this.camera.position.copy(offset);
    this.camera.lookAt(this.position);
  }

  update() {
    this.updateTarget();
    this.updatePosition();
    this.updateCameraParams();
    this.updateCamera();
  }
}

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

    this.cameraController = new RealTimeStrategyCamera(engine);

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
    this.cameraController.update();
    this.box.setRotationFromEuler(
      new THREE.Euler(0, this.engine.timeManager.time.gameTime, 0)
    );
  }
}

const world = new World(engine);
engine.world = world;

engine.startGame();

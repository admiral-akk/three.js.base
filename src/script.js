import "./style.css";
import * as THREE from "three";
import basicTextureVertexShader from "./shaders/basicTexture/vertex.glsl";
import basicTextureFragmentShader from "./shaders/basicTexture/fragment.glsl";
import * as ENGINE from "./engine.js";

/**
 * Core objects
 */

const engine = new ENGINE.KubEngine();

class FirstPersonCamera {
  constructor(camera, input, time, scene) {
    this.camera = camera;
    this.input = input;
    this.time = time;
    this.scene = scene;

    this.rotation = new THREE.Quaternion();
    this.translation = new THREE.Vector3(0, 1, 0);

    this.theta = 0;
    this.phi = 0;

    this.headbob = { time: 0, frequency: 5, height: 0.05 };
  }

  updateRotation() {
    const delta = this.input.mouseState.posDelta;
    if (delta) {
      this.phi += -4 * delta.x;
      this.theta = Math.clamp(
        this.theta - 4 * delta.y,
        -Math.PI / 3,
        Math.PI / 3
      );
    }

    const qx = new THREE.Quaternion();
    qx.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.phi);
    const qz = new THREE.Quaternion();
    qz.setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.theta);

    const q = new THREE.Quaternion();
    q.multiply(qx);
    q.multiply(qz);

    this.rotation.copy(q);
  }

  updateTranslation() {
    const qx = new THREE.Quaternion();
    qx.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.phi);
    const qz = new THREE.Quaternion();
    qz.setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.theta);
    const { pressedKeys } = this.input.keyState;
    const forwardVelocity =
      (pressedKeys.has("w") ? 1 : 0) - (pressedKeys.has("s") ? 1 : 0);
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(qx).multiplyScalar(forwardVelocity / 10);

    const strafeVelocity =
      (pressedKeys.has("a") ? 1 : 0) - (pressedKeys.has("d") ? 1 : 0);
    const left = new THREE.Vector3(-1, 0, 0);

    if (strafeVelocity != 0 || forwardVelocity != 0) {
      this.headbob.time += this.time.time.gameDeltaTime;
    }

    left.applyQuaternion(qx).multiplyScalar(strafeVelocity / 10);
    this.translation.add(forward);
    this.translation.add(left);
  }

  updateHeadbob() {
    this.camera.position.y +=
      this.headbob.height *
      Math.sin(this.headbob.frequency * 2 * Math.PI * this.headbob.time);

    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(this.rotation);

    const raycaster = new THREE.Raycaster(this.translation, forward, 0, 100);

    const intersects = raycaster.intersectObjects(this.scene.children);
    if (intersects.length) {
      this.camera.lookAt(intersects[0].point);
    }
  }

  update() {
    this.updateRotation();

    this.camera.quaternion.copy(this.rotation);
    this.updateTranslation();
    this.camera.position.copy(this.translation);
    this.updateHeadbob();
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

    this.cameraController = new FirstPersonCamera(
      engine.renderManager.camera,
      engine.inputManager,
      engine.timeManager,
      engine.scene
    );

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

import "./style.css";
import * as THREE from "three";
import basicTextureVertexShader from "./shaders/basicTexture/vertex.glsl";
import basicTextureFragmentShader from "./shaders/basicTexture/fragment.glsl";
import unitSelectVertexShader from "./shaders/unitSelect/vertex.glsl";
import unitSelectFragmentShader from "./shaders/unitSelect/fragment.glsl";
import * as ENGINE from "./engine.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

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

class SelectUnits {
  constructor(engine) {
    this.engine = engine;
    this.input = engine.inputManager;
    this.camera = engine.camera;
    this.scene = engine.scene;
    this.startClick = null;

    /**
     * Loading overlay
     */
    const unitSelectionShader = {
      uniforms: {
        tDiffuse: { value: null },
        uStartPos: { value: new THREE.Vector2() },
        uEndPos: { value: new THREE.Vector2() },
      },
      vertexShader: unitSelectVertexShader,
      fragmentShader: unitSelectFragmentShader,
    };

    this.selectPass = new ShaderPass(unitSelectionShader);
    this.selectedUnits = [];
  }

  update() {
    const { mouseState } = this.input;
    const { buttons, pos } = mouseState;
    if (buttons === 2) {
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(pos, this.camera);
      raycaster.layers.set(1);

      const intersects = raycaster.intersectObjects(this.scene.children);

      if (intersects.length) {
        this.selectedUnits.forEach((u) => {
          u.controller.target.copy(intersects[0].point);
          u.controller.target.y = 1;
        });
      }
    }
    if (buttons === 1) {
      if (!this.startClick) {
        this.startClick = new THREE.Vector2();
        this.startClick.copy(pos);
        this.engine.composer.addPass(this.selectPass);
      }
      const offsetStart = new THREE.Vector2(
        this.startClick.x,
        this.startClick.y
      )
        .addScalar(1)
        .multiplyScalar(0.5);

      const offsetEnd = new THREE.Vector2(pos.x, pos.y)
        .addScalar(1)
        .multiplyScalar(0.5);
      this.selectPass.material.uniforms.uStartPos.value = offsetStart;
      this.selectPass.material.uniforms.uEndPos.value = offsetEnd;
    } else if (this.startClick) {
      if (pos) {
        // released, find units

        const lowX = Math.min(pos.x, this.startClick.x);
        const highX = Math.max(pos.x, this.startClick.x);
        const lowY = Math.min(pos.y, this.startClick.y);
        const highY = Math.max(pos.y, this.startClick.y);

        // has to be infront of camera

        const { fov, aspect } = this.camera;
        const verticalAngle = (Math.PI * fov) / 360;
        const horizontalAngle = verticalAngle * aspect;

        const planeNormals = [
          new THREE.Vector3(0, 0, 1),
          new THREE.Vector3(-1, 0, -Math.tan(horizontalAngle * lowX)),
          new THREE.Vector3(1, 0, Math.tan(horizontalAngle * highX)),
          new THREE.Vector3(0, -1, -Math.tan(verticalAngle * lowY)),
          new THREE.Vector3(0, 1, Math.tan(verticalAngle * highY)),
        ].map((v) => v.applyQuaternion(this.camera.quaternion));

        this.selectedUnits = [];

        this.scene.traverse((obj) => {
          if (!obj.isUnit) {
            return;
          }
          const delta = new THREE.Vector3();
          delta.subVectors(obj.position, this.camera.position);
          const matches = planeNormals.filter(
            (norm) => norm.dot(delta) > 0
          ).length;
          if (matches === 0) {
            this.selectedUnits.push(obj);
          }
        });
      }
      this.startClick = null;
      this.engine.composer.removePass(this.selectPass);
    }
  }
}

class Unit {
  constructor(engine) {
    this.position = new THREE.Vector3(0, 1, 0);
    this.target = new THREE.Vector3(0, 1, 0);
    this.engine = engine;
    this.time = engine.timeManager;
    const textureShader = engine.renderManager.materialManager.addMaterial(
      "texture",
      basicTextureVertexShader,
      basicTextureFragmentShader
    );
    const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1), textureShader);
    box.position.x = 0;
    box.position.y = Math.randomRange(1, 3);
    box.position.z = 0;
    engine.scene.add(box);
    box.castShadow = true;
    box.receiveShadow = true;
    box.material.shading = THREE.SmoothShading;
    box.isUnit = true;
    box.controller = this;
    this.box = box;
    this.speed = 2;
  }

  updatePosition() {
    const offset = new THREE.Vector3();
    offset.copy(this.target).sub(this.position);
    const maxDist = this.time.time.gameDeltaTime * this.speed;
    if (offset.length() < maxDist) {
      this.position.copy(this.target);
    } else {
      offset.normalize();
      offset.multiplyScalar(maxDist);
      this.position.add(offset);
    }
  }

  updateBox() {
    this.box.position.copy(this.position);
    this.box.setRotationFromEuler(
      new THREE.Euler(0, this.engine.timeManager.time.gameTime, 0)
    );
  }

  update() {
    this.updatePosition();
    this.updateBox();
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
    plane.layers.enable(1);

    engine.scene.add(plane);

    this.units = [];
    this.select = new SelectUnits(engine);
    for (let i = 0; i < 1; i++) {
      this.units.push(new Unit(engine));
    }
  }

  update() {
    this.select.update();
    this.cameraController.update();
    this.units.forEach((u) => u.update());
  }
}

const world = new World(engine);
engine.world = world;

engine.startGame();

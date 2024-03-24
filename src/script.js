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
          u.target.copy(intersects[0].point);
          u.target.y = 1;
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

        this.selectedUnits.forEach((u) => u.selected(false));
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
            this.selectedUnits.push(obj.controller);
          }
        });
        this.selectedUnits.forEach((u) => u.selected(true));
      }
      this.startClick = null;
      this.engine.composer.removePass(this.selectPass);
    }
  }
}

class Enemy {
  constructor(engine, position) {
    this.position = position;
    this.target = position.clone();
    this.engine = engine;
    this.health = 2;
    this.time = engine.timeManager;
    const textureShader = engine.renderManager.materialManager.addMaterial(
      "texture",
      basicTextureVertexShader,
      basicTextureFragmentShader
    );

    const box = new THREE.Mesh(new THREE.SphereGeometry(1), textureShader);
    box.position.copy(this.position);
    box.position.y = 1.1;
    engine.scene.add(box);
    box.castShadow = true;
    box.receiveShadow = true;
    box.material.shading = THREE.SmoothShading;
    box.controller = this;
    this.box = box;
    this.speed = 2;
  }

  damage(total) {
    this.health -= total;
  }

  update() {}
}

class Unit {
  constructor(engine, enemies) {
    this.position = new THREE.Vector3(0, 1, 0);
    this.target = new THREE.Vector3(0, 1, 0);
    this.engine = engine;
    this.enemies = enemies;
    this.time = engine.timeManager;
    const textureShader = engine.renderManager.materialManager.addMaterial(
      "texture",
      basicTextureVertexShader,
      basicTextureFragmentShader
    );

    const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1), textureShader);
    box.position.copy(this.position);
    box.position.y = 1.1;
    engine.scene.add(box);
    box.castShadow = true;
    box.receiveShadow = true;
    box.material.shading = THREE.SmoothShading;
    box.isUnit = true;
    box.controller = this;
    this.attackData = {
      range: 4,
      period: 1,
      lastAttackTime: null,
    };
    this.box = box;
    this.speed = 2;

    const material = new THREE.LineBasicMaterial({
      color: 0x00f000,
    });

    const points = [];
    const COUNT = 64;
    for (let i = 0; i <= COUNT; i++) {
      const angle = (2 * i * Math.PI) / COUNT;
      points.push(new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle)));
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    const line = new THREE.Line(geometry, material);
    box.add(line);
    this.selectionCircle = line;
    line.visible = false;
    line.position.y = -0.4;

    this.targetCircle = new THREE.Line(geometry, material);
    this.targetCircle.scale.set(0.1, 0.1, 0.1);
    engine.scene.add(this.targetCircle);
    this.targetCircle.visible = false;

    this.attackLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3(),
      ]),
      new THREE.LineBasicMaterial({ color: "red" })
    );
    this.moveLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3(),
      ]),
      new THREE.LineBasicMaterial({ color: "green" })
    );
    engine.scene.add(this.attackLine);
    this.attackLine.visible = false;
    engine.scene.add(this.moveLine);
    this.attackLine.visible = false;
  }

  selected(isSelected) {
    this.selectionCircle.visible = isSelected;
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

  updateTargetCircle() {
    this.targetCircle.position.copy(this.target);
    this.targetCircle.position.y = 0.04;
    this.targetCircle.visible = !this.target.equals(this.position);
    this.moveLine.visible = this.targetCircle.visible;

    this.moveLine.geometry.attributes.position.setXYZ(
      0,
      this.position.x,
      this.position.y,
      this.position.z
    );

    this.moveLine.geometry.attributes.position.setXYZ(
      1,
      this.target.x,
      this.target.y,
      this.target.z
    );
    this.moveLine.geometry.attributes.position.needsUpdate = true;
  }

  tryAttack() {
    const { range, period, lastAttackTime } = this.attackData;
    const { gameTime } = this.time.time;
    let target = null;
    for (let i = 0; i < this.enemies.length; i++) {
      if (this.position.distanceTo(this.enemies[i].position) < range) {
        target = this.enemies[i];
      }
    }
    this.attackLine.visible = !!target;
    if (!target) {
      return;
    }

    this.attackLine.geometry.attributes.position.setXYZ(
      0,
      this.position.x,
      this.position.y,
      this.position.z
    );

    this.attackLine.geometry.attributes.position.setXYZ(
      1,
      target.position.x,
      target.position.y,
      target.position.z
    );
    this.attackLine.geometry.attributes.position.needsUpdate = true;

    if (lastAttackTime === null || gameTime - lastAttackTime >= period) {
      this.attackData.lastAttackTime = gameTime;
      target.damage(1);
      console.log("Attack!");
    }
  }

  update() {
    this.updatePosition();
    this.updateBox();
    this.updateTargetCircle();
    this.tryAttack();
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
    this.enemies = [];
    this.select = new SelectUnits(engine);
    for (let i = 0; i < 1; i++) {
      this.units.push(new Unit(engine, this.enemies));
    }

    this.spawnEnemies();
  }

  cleanDeath() {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (enemy.health <= 0) {
        this.engine.scene.remove(enemy.box);
        this.enemies.splice(i, 1);
      }
    }
  }

  spawnEnemies() {
    while (this.enemies.length < 2) {
      this.enemies.push(
        new Enemy(
          engine,
          new THREE.Vector3(
            Math.randomRange(-10, 10),
            1.1,
            Math.randomRange(-10, 10)
          )
        )
      );
    }
  }

  update() {
    this.select.update();
    this.cameraController.update();
    this.units.forEach((u) => u.update());
    this.cleanDeath();
    this.spawnEnemies();
  }
}

const world = new World(engine);
engine.world = world;

engine.startGame();

export class FirstPersonCamera {
  constructor(engine) {
    this.camera = engine.renderManager.camera;
    this.input = engine.inputManager;
    this.time = engine.timeManager;
    this.scene = engine.scene;

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
        this.theta + 4 * delta.y,
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

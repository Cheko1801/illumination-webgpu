import type { Mat4, Vec3 } from "./math";
import { mat4, vec3 } from "./math";

export class ArcballCamera {
  rotX = 0.2;   // pitch
  rotY = 0;     // yaw
  distance = 5;
  target: Vec3 = [0, 0, 0];
  zoomMin = 1.5;
  zoomMax = 30;

  getPosition(): Vec3 {
    const cp = Math.cos(this.rotX);
    const sp = Math.sin(this.rotX);
    const cy = Math.cos(this.rotY);
    const sy = Math.sin(this.rotY);
    return [
      this.target[0] + this.distance * cp * sy,
      this.target[1] + this.distance * sp,
      this.target[2] + this.distance * cp * cy,
    ];
  }

  getViewMatrix(): Mat4 {
    const pos = this.getPosition();
    return mat4.lookAt(pos, this.target, [0, 1, 0]);
  }

  rotate(dx: number, dy: number): void {
    this.rotY += dx * 0.008;
    this.rotX += dy * 0.008;
    const lim = Math.PI / 2 - 0.01;
    this.rotX = Math.max(-lim, Math.min(lim, this.rotX));
  }

  zoom(delta: number): void {
    this.distance *= 1 + delta * 0.001;
    this.distance = Math.max(this.zoomMin, Math.min(this.zoomMax, this.distance));
  }
}

import type { Mat4, Vec3, Quat } from "./math";
import { mat4, vec3, quat } from "./math";

/**
 * True Arcball Camera using quaternions.
 * Maps mouse drag to a virtual sphere surface, computes rotation
 * via axis-angle → quaternion. No gimbal lock, smooth everywhere.
 */
export class ArcballCamera {
  rotation: Quat = quat.identity();
  distance = 5;
  target: Vec3 = [0, 0, 0];
  zoomMin = 1.5;
  zoomMax = 30;

  // Viewport size (set from main.ts on resize)
  width = 800;
  height = 600;

  /** Map a 2D pixel coordinate to a point on a unit sphere (or clamped disk). */
  private mapToSphere(px: number, py: number): Vec3 {
    const r = Math.min(this.width, this.height) * 0.5;
    const cx = this.width * 0.5;
    const cy = this.height * 0.5;
    let x = (px - cx) / r;
    let y = -(py - cy) / r; // flip Y so up is positive
    const lenSq = x * x + y * y;
    let z: number;
    if (lenSq <= 1.0) {
      z = Math.sqrt(1.0 - lenSq);
    } else {
      const len = Math.sqrt(lenSq);
      x /= len;
      y /= len;
      z = 0;
    }
    return [x, y, z];
  }

  /** Call this with the start and end mouse positions of a drag. */
  rotate(startX: number, startY: number, endX: number, endY: number): void {
    const p0 = this.mapToSphere(startX, startY);
    const p1 = this.mapToSphere(endX, endY);

    // Rotation axis = cross product of the two sphere points
    const axis = vec3.cross(p0, p1);
    const lenAxis = Math.hypot(axis[0], axis[1], axis[2]);
    if (lenAxis < 1e-8) return; // no meaningful rotation

    // Rotation angle = angle between the two vectors
    const dot = Math.max(-1, Math.min(1, vec3.dot(p0, p1)));
    const angle = Math.acos(dot);

    const normAxis = vec3.normalize(axis);
    const delta = quat.setAxisAngle(normAxis, angle);
    this.rotation = quat.normalize(quat.multiply(delta, this.rotation));
  }

  getPosition(): Vec3 {
    // Camera is at [0, 0, distance] rotated by the inverse of the quaternion
    const rotMat = quat.toMat4(this.rotation);
    // Transform [0, 0, distance] by the rotation matrix
    const x = rotMat[0] * 0 + rotMat[4] * 0 + rotMat[8]  * this.distance + this.target[0];
    const y = rotMat[1] * 0 + rotMat[5] * 0 + rotMat[9]  * this.distance + this.target[1];
    const z = rotMat[2] * 0 + rotMat[6] * 0 + rotMat[10] * this.distance + this.target[2];
    return [x, y, z];
  }

  getViewMatrix(): Mat4 {
    const pos = this.getPosition();
    return mat4.lookAt(pos, this.target, [0, 1, 0]);
  }

  zoom(delta: number): void {
    this.distance *= 1 + delta * 0.001;
    this.distance = Math.max(this.zoomMin, Math.min(this.zoomMax, this.distance));
  }
}

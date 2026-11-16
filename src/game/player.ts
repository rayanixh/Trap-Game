import type { Input } from "../core/input";
import type { Rect } from "../core/types";
import { overlaps } from "../core/types";

const MOVE_SPEED = 320;
const ACCEL_GROUND = 2600;
const ACCEL_AIR = 1700;
const FRICTION = 2800;
const GRAVITY = 2400;
const GRAVITY_ASCEND = 1850;
const JUMP_VELOCITY = 900;
const MAX_FALL = 1350;
const COYOTE = 0.1;
const JUMP_BUFFER = 0.12;
const HITBOX_W = 32;
const HITBOX_H = 64;
const SPRITE_H = 98;

export type PlayerHooks = {
  solids: Rect[];
  onJump: () => void;
  onDied: () => void;
};

type AnimState = "idle" | "run" | "jump" | "land";

export class Player {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  w = HITBOX_W;
  h = HITBOX_H;
  hp = 3;
  maxHp = 3;
  facing = 1;
  grounded = false;
  invuln = 0;
  dead = false;
  deathTimer = 0;

  private coyote = 0;
  private buffer = 0;
  private landTimer = 0;
  private animTime = 0;
  private runDistance = 0;

  get spriteHeight(): number {
    return SPRITE_H;
  }

  rect(): Rect {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  centerX(): number {
    return this.x + this.w / 2;
  }

  bottom(): number {
    return this.y + this.h;
  }

  respawn(x: number, yFeet: number): void {
    this.x = x - this.w / 2;
    this.y = yFeet - this.h;
    this.vx = 0;
    this.vy = 0;
    this.dead = false;
    this.deathTimer = 0;
    this.invuln = 0.9;
    this.grounded = true;
    this.coyote = 0;
    this.buffer = 0;
    this.landTimer = 0;
  }

  heal(amount = 1): void {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  hurt(fromX: number): boolean {
    if (this.invuln > 0 || this.dead) return false;
    this.hp -= 1;
    this.invuln = 1.4;
    const dir = this.centerX() < fromX ? -1 : 1;
    this.vx = dir * 300;
    this.vy = -320;
    this.grounded = false;
    if (this.hp <= 0) {
      this.hp = 0;
      this.kill();
    }
    return true;
  }

  kill(): void {
    if (this.dead) return;
    this.dead = true;
    this.deathTimer = 1.15;
    this.hp = 0;
    this.vx = 0;
    this.vy = -260;
  }

  reviveFull(): void {
    this.hp = this.maxHp;
  }

  update(dt: number, input: Input, hooks: PlayerHooks): void {
    if (this.dead) {
      this.deathTimer -= dt;
      this.vy += GRAVITY * dt;
      this.y += this.vy * dt;
      if (this.deathTimer <= 0) hooks.onDied();
      return;
    }

    if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt);

    const axis = input.axis();
    if (axis !== 0) this.facing = axis;

    const accel = this.grounded ? ACCEL_GROUND : ACCEL_AIR;
    if (axis !== 0) {
      this.vx += axis * accel * dt;
      this.vx = Math.max(-MOVE_SPEED, Math.min(MOVE_SPEED, this.vx));
    } else {
      const drop = FRICTION * dt * (this.grounded ? 1 : 0.35);
      if (Math.abs(this.vx) <= drop) this.vx = 0;
      else this.vx -= Math.sign(this.vx) * drop;
    }

    // jump buffering + coyote time: presses just before landing still count
    if (input.justPressed("jump")) this.buffer = JUMP_BUFFER;
    else this.buffer = Math.max(0, this.buffer - dt);
    this.coyote = this.grounded ? COYOTE : Math.max(0, this.coyote - dt);

    if (this.buffer > 0 && this.coyote > 0) {
      this.vy = -JUMP_VELOCITY;
      this.grounded = false;
      this.coyote = 0;
      this.buffer = 0;
      this.landTimer = 0;
      hooks.onJump();
    }

    const heldJump = input.held("jump");
    let gravity = GRAVITY;
    if (this.vy < 0 && heldJump) gravity = GRAVITY_ASCEND;
    if (this.vy < 0 && !heldJump) gravity = GRAVITY * 1.5;
    this.vy = Math.min(MAX_FALL, this.vy + gravity * dt);

    this.moveX(this.vx * dt, hooks.solids);
    this.moveY(this.vy * dt, hooks.solids);
  }

  private moveX(dx: number, solids: Rect[]): void {
    if (dx === 0) return;
    this.x += dx;
    const r = this.rect();
    for (const s of solids) {
      if (!overlaps(r, s)) continue;
      if (dx > 0) this.x = s.x - this.w;
      else this.x = s.x + s.w;
      r.x = this.x;
      this.vx = 0;
    }
  }

  private moveY(dy: number, solids: Rect[]): void {
    const wasGrounded = this.grounded;
    this.grounded = false;
    this.y += dy;
    const r = this.rect();
    for (const s of solids) {
      if (!overlaps(r, s)) continue;
      if (dy > 0) {
        this.y = s.y - this.h;
        if (!wasGrounded && this.vy > 240) {
          this.landTimer = 0.19;
          this.onLandImpact = Math.min(1, this.vy / MAX_FALL);
        }
        this.vy = 0;
        this.grounded = true;
      } else if (dy < 0) {
        this.y = s.y + s.h;
        this.vy = 0;
      }
      r.y = this.y;
    }
    if (this.grounded) this.coyote = COYOTE;
  }

  /** Set by moveY, consumed by the game to spawn dust + sound. */
  onLandImpact = 0;

  consumeLandImpact(): number {
    const v = this.onLandImpact;
    this.onLandImpact = 0;
    return v;
  }

  animation(): { state: AnimState; frame: number; progress: number } {
    if (!this.grounded && this.vy < 0) {
      const t = Math.min(1, Math.max(0, -this.vy / JUMP_VELOCITY));
      return { state: "jump", frame: Math.floor((1 - t) * 3.99), progress: t };
    }
    if (!this.grounded) {
      const t = Math.min(1, Math.max(0, this.vy / 900));
      return { state: "jump", frame: 4 + Math.floor(t * 3.99), progress: t };
    }
    if (this.landTimer > 0) {
      const k = 1 - this.landTimer / 0.19;
      return { state: "land", frame: Math.min(3, Math.floor(k * 4)), progress: k };
    }
    if (Math.abs(this.vx) > 24) {
      const frame = Math.floor(this.runDistance / 22) % 8;
      return { state: "run", frame, progress: frame / 8 };
    }
    return { state: "idle", frame: Math.floor(this.animTime * 5.5) % 4, progress: 0 };
  }

  tickAnimation(dt: number): void {
    if (this.landTimer > 0) this.landTimer = Math.max(0, this.landTimer - dt);
    this.animTime += dt;
    if (this.grounded && Math.abs(this.vx) > 24) this.runDistance += Math.abs(this.vx * dt);
  }
}

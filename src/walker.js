// An ant that walks over the tabletop and the top of the food, climbing up and down its outline.
// Position: x, and h = height above the table (feet). Screen y = -h.
(function () {
  const C = AF.config;

  class Walker {
    constructor(scene, food, x, o) {
      this.scene = scene; this.food = food;
      this.x = x; this.h = food.surfaceAt(x);
      this.speed = o.speed; this.climb = o.climb;
      this.key = o.texture; this.sc = o.scale;
      this.mode = 'walk'; this.flip = false; this.rot = 0;
      this.animT = Math.random(); this.frame = 0; this.moving = false;
      this.load = 0; this.color = 0xe9b872;

      this.half = C.antLength * this.sc * 0.45; // center to head
      this.reach = 1.5 + this.half * 0.6; // how far ahead of its middle the ant feels for walls
      this.spr = scene.add.image(x, -this.h, this.key + '0').setOrigin(0.5, 0.96)
        .setScale((C.antLength / AF.ANT_TEX_W) * this.sc).setDepth(o.depth);
      this.crumb = scene.add.image(0, 0, 'crumb').setDepth(o.depth + 0.1).setVisible(false);
    }

    // Move toward world x `tx` along the skyline, at most `maxDist` of path. Returns true once standing at tx.
    step(tx, dt, maxDist) {
      const f = this.food;
      let budget = Math.min(this.speed * dt, maxDist === undefined ? Infinity : Math.max(0, maxDist));
      let guard = 12, arrived = false;
      const climbRatio = this.climb / this.speed;
      this.moving = false;
      while (budget > 0.0001 && guard-- > 0) {
        const s = f.surfaceAt(this.x);
        const dirT = Math.abs(tx - this.x) < 0.4 ? 0 : Math.sign(tx - this.x);
        const sAhead = dirT ? f.surfaceAt(this.x + dirT * this.reach) : s;
        // on a wall we are climbing, the ground under our x is lower but we hang on
        if (this.h > s + 0.01 && !(sAhead >= this.h - 0.01)) { // food eaten below us, or we walked off a ledge
          const d = Math.min(budget * climbRatio, this.h - s);
          this.h -= d; budget -= d / climbRatio; this.mode = 'down'; this.moving = true; continue;
        }
        if (this.h < s) this.h = s;
        const dx = tx - this.x;
        if (Math.abs(dx) < 0.4) { arrived = true; break; }
        const dir = Math.sign(dx);
        this.flip = dir < 0;
        const stepLen = Math.min(Math.abs(dx), budget, 1.5);
        const nx = this.x + dir * stepLen;
        const ahead = f.surfaceAt(nx + dir * (this.reach - 1.5)); // the head meets the wall, not the middle
        if (ahead > this.h + 0.01) { // wall ahead: climb it
          const d = Math.min(budget * climbRatio, ahead - this.h);
          this.h += d; budget -= d / climbRatio; this.mode = 'up'; this.moving = true; continue;
        }
        this.x = nx; budget -= stepLen; this.mode = 'walk'; this.moving = true;
      }
      if (arrived && this.mode !== 'walk' && this.h <= f.surfaceAt(this.x) + 0.01) this.mode = 'walk';
      return arrived;
    }

    // Manual control (scout). inp: {dx: -1|0|1}. Nothing moves unless a key is held; the walking key
    // follows the cake's outline, so where the way ahead only goes up or down the ant climbs that way.
    drive(inp, dt) {
      this.moving = false;
      if (inp.dx) {
        const tx = Phaser.Math.Clamp(this.x + inp.dx * 50, C.world.left, C.world.right);
        this.flip = inp.dx < 0;
        this.step(tx, dt);
        this.flip = inp.dx < 0;
      } else this.settle(dt);
    }

    // Standing still: drop if the food under us was eaten, but keep hold of a wall we are on.
    settle(dt) {
      const f = this.food, s = f.surfaceAt(this.x);
      if (this.h <= s + 0.01) { if (this.h < s) this.h = s; if (this.mode === 'down') this.mode = 'walk'; return; }
      if (f.surfaceAt(this.x + this.reach) >= this.h - 0.01 || f.surfaceAt(this.x - this.reach) >= this.h - 0.01) return; // holding a wall
      this.h = Math.max(s, this.h - this.climb * dt); this.mode = 'down'; this.moving = true;
      if (this.h <= s + 0.01) this.mode = 'walk';
    }


    render(dt) {
      let target = 0;
      if (this.mode === 'up') target = this.flip ? Math.PI / 2 : -Math.PI / 2;
      else if (this.mode === 'down') target = this.flip ? -Math.PI / 2 : Math.PI / 2;
      this.rot += (target - this.rot) * Math.min(1, dt * 16);
      if (this.moving) {
        this.animT += dt;
        if (this.animT > 0.09) { this.animT = 0; this.frame ^= 1; this.spr.setTexture(this.key + this.frame); }
      }
      this.spr.setPosition(this.x, -this.h).setRotation(this.rot).setFlipX(this.flip);

      if (this.load > 0) {
        const s = this.sc;
        const ox = (this.flip ? -1 : 1) * 5.6 * s, oy = -2.6 * s;
        const cos = Math.cos(this.rot), sin = Math.sin(this.rot);
        const frac = Math.min(1, this.load / Math.max(1, this.capacity || 1));
        this.crumb.setVisible(true).setTint(this.color)
          .setPosition(this.x + ox * cos - oy * sin, -this.h + ox * sin + oy * cos)
          .setScale(((2.2 + 2.6 * frac) * s) / 16).setRotation(this.rot);
      } else this.crumb.setVisible(false);
    }
  }

  AF.Walker = Walker;
})();

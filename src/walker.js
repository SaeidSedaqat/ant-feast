// An ant that walks over the tabletop and the top of the food, climbing up and down its outline.
// Position: x, and h = height above the table (feet). Screen y = -h.
(function () {
  const C = AF.config;

  class Walker {
    constructor(scene, food, x, o) {
      this.scene = scene; this.food = food;
      // foot: half-width of the ground the ant stands on. A long ant (the scout) bridges pits narrower than
      // its feet instead of dropping into them with its body stuck inside the cake.
      this.foot = o.foot || 0;
      this.x = x; this.h = this.S(x);
      this.speed = o.speed; this.climb = o.climb;
      this.key = o.texture; this.sc = o.scale;
      this.mode = 'walk'; this.flip = false; this.rot = 0; this.ox = 0;
      this.animT = Math.random(); this.frame = 0; this.moving = false;
      this.load = 0; this.color = 0xe9b872;

      this.half = C.antLength * this.sc * 0.45; // center to head
      this.reach = 1.5 + this.half * 0.6; // how far ahead of its middle the ant feels for walls
      this.look = Math.max(0, this.reach - this.foot); // the same feel, measured from the edge of the feet
      this.spr = scene.add.image(x, -this.h, this.key + '0').setOrigin(0.5, 0.96)
        .setScale((C.antLength / AF.ANT_TEX_W) * this.sc).setDepth(o.depth);
      this.crumb = scene.add.image(0, 0, 'crumb').setDepth(o.depth + 0.1).setVisible(false);
      const len = C.antLength * this.sc;
      this.shadow = scene.add.image(x, -this.h, 'shadow').setDepth(o.depth - 0.5).setDisplaySize(len * 1.05, len * 0.24);
    }

    // ground height under the ant's feet at x
    S(x) {
      const f = this.food, k = this.foot;
      if (!k) return f.surfaceAt(x);
      return Math.max(f.surfaceAt(x - k), f.surfaceAt(x), f.surfaceAt(x + k));
    }

    // Move toward world x `tx` along the skyline, at most `maxDist` of path. Returns true once standing at tx.
    step(tx, dt, maxDist) {
      let budget = Math.min(this.speed * dt, maxDist === undefined ? Infinity : Math.max(0, maxDist));
      let guard = 12, arrived = false;
      const climbRatio = this.climb / this.speed;
      this.moving = false;
      while (budget > 0.0001 && guard-- > 0) {
        const s = this.S(this.x);
        const dirT = Math.abs(tx - this.x) < 0.4 ? 0 : Math.sign(tx - this.x);
        const sAhead = dirT ? this.S(this.x + dirT * this.look) : s;
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
        const ahead = this.S(nx + dir * Math.max(0, this.look - 1.5)); // the head meets the wall, not the middle
        if (ahead > this.h + 0.01) { // wall ahead: climb it
          const d = Math.min(budget * climbRatio, ahead - this.h);
          this.h += d; budget -= d / climbRatio; this.mode = 'up'; this.moving = true; continue;
        }
        this.x = nx; budget -= stepLen; this.mode = 'walk'; this.moving = true;
      }
      if (arrived && this.mode !== 'walk' && this.h <= this.S(this.x) + 0.01) this.mode = 'walk';
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
      const s = this.S(this.x);
      if (this.h <= s + 0.01) { if (this.h < s) this.h = s; if (this.mode === 'down') this.mode = 'walk'; return; }
      if (this.S(this.x + this.look) >= this.h - 0.01 || this.S(this.x - this.look) >= this.h - 0.01) return; // holding a wall
      this.h = Math.max(s, this.h - this.climb * dt); this.mode = 'down'; this.moving = true;
      if (this.h <= s + 0.01) this.mode = 'walk';
    }

    // Where the drawn ant should sit so its feet touch the food: on a wall the feet go flat against the
    // wall face; standing at the lip of a ledge the feet go onto the ledge instead of over the air.
    feetOffset() {
      const f = this.food, x = this.x, h = this.h, lim = this.reach + this.foot + 2;
      const solid = (p) => f.surfaceAt(p) >= h - 0.5;
      if (this.mode === 'up' || this.mode === 'down') {
        // the belly faces the wall: ahead when climbing up, behind when climbing down
        const bd = (this.mode === 'up') === !this.flip ? 1 : -1;
        if (solid(x)) return 0;
        for (let d = 0.25; d <= lim; d += 0.25) if (solid(x + bd * d)) return bd * Math.max(0, d - 0.3);
        return 0;
      }
      if (this.S(x) >= h - 0.5 || solid(x)) return 0;
      for (let d = 0.25; d <= lim; d += 0.25) {
        if (solid(x + d)) return d + 0.3;
        if (solid(x - d)) return -d - 0.3;
      }
      return 0;
    }

    render(dt) {
      let target = 0;
      if (this.mode === 'up') target = this.flip ? Math.PI / 2 : -Math.PI / 2;
      else if (this.mode === 'down') target = this.flip ? -Math.PI / 2 : Math.PI / 2;
      this.rot += (target - this.rot) * Math.min(1, dt * 16);
      this.ox += (this.feetOffset() - this.ox) * Math.min(1, dt * 20);
      if (this.moving) {
        this.animT += dt;
        if (this.animT > 0.09) { this.animT = 0; this.frame = (this.frame + 1) % AF.ANT_FRAMES; this.spr.setTexture(this.key + this.frame); }
      }
      const px = this.x + this.ox;
      this.spr.setPosition(px, -this.h).setRotation(this.rot).setFlipX(this.flip);
      this.shadow.setPosition(px, -this.h + 0.2).setRotation(this.rot).setAlpha(this.mode === 'walk' ? 0.55 : 0.28);

      if (this.load > 0) {
        const s = this.sc;
        const ox = (this.flip ? -1 : 1) * 5.6 * s, oy = -2.6 * s;
        const cos = Math.cos(this.rot), sin = Math.sin(this.rot);
        const frac = Math.min(1, this.load / Math.max(1, this.capacity || 1));
        this.crumb.setVisible(true).setTint(this.color)
          .setPosition(px + ox * cos - oy * sin, -this.h + ox * sin + oy * cos)
          .setScale(((2.4 + 2.8 * frac) * s) / 32).setRotation(this.rot);
      } else this.crumb.setVisible(false);
    }
  }

  AF.Walker = Walker;
})();

// An ant that walks along the tabletop and food surface, climbing walls on the way.
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
      this.cling = 0; this.vy = 0; // scout only: wall direction while clinging (+1 = wall on the right)
      this.half = C.antLength * this.sc * 0.45; // center to head
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
        const sAhead = dirT ? f.surfaceAt(this.x + dirT * 1.5) : s;
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
        const ahead = f.surfaceAt(nx);
        if (ahead > this.h + 0.01) { // wall ahead: climb it
          const d = Math.min(budget * climbRatio, ahead - this.h);
          this.h += d; budget -= d / climbRatio; this.mode = 'up'; this.moving = true; continue;
        }
        this.x = nx; budget -= stepLen; this.mode = 'walk'; this.moving = true;
      }
      if (arrived && this.mode !== 'walk' && this.h <= f.surfaceAt(this.x) + 0.01) this.mode = 'walk';
      return arrived;
    }

    // Manual control (scout). inp: {dx: -1|0|1, dy: -1|0|1}. Nothing moves unless a key is held;
    // where the way ahead only goes up or down, the walking key follows it.
    drive(inp, dt) {
      const f = this.food, cell = f.cell;
      this.moving = false;
      if (this.cling) { this.driveCling(inp, dt); return; }

      // gravity
      const g = f.groundAt(this.x, this.h);
      if (this.h > g + 0.01) {
        this.vy = Math.min(this.vy + 500 * dt, 260);
        this.h = Math.max(g, this.h - this.vy * dt);
        this.mode = 'walk';
        return;
      }
      this.h = g; this.vy = 0; this.mode = 'walk';
      const face = this.flip ? -1 : 1;

      // up: grab the wall in front
      if (inp.dy > 0) {
        for (const d of inp.dx ? [inp.dx] : [face, -face]) {
          const c = f.colAt(this.x + d * (this.half + 1.5)), r = f.rowAt(this.h + 0.5);
          if (c >= 0 && f.solid(c, r)) {
            this.cling = d; this.x = f.faceX(c, d) - d * 0.3; this.mode = 'up'; this.flip = d < 0;
            return;
          }
        }
      }
      // down: go over a ledge next to us
      if (inp.dy < 0) {
        const c = f.colAt(this.x);
        if (c >= 0) {
          for (const d of inp.dx ? [inp.dx] : [face, -face]) {
            const edge = f.x0 + (d > 0 ? c + 1 : c) * cell;
            if (Math.abs(edge - this.x) <= this.half + 1.5 && f.groundAt(edge + d * 0.5, this.h) < this.h - 3.5) {
              this.cling = -d; this.x = edge + d * 0.3; this.mode = 'down'; this.flip = -d > 0;
              return;
            }
          }
        }
      }
      if (!inp.dx) return;

      const dir = inp.dx;
      this.flip = dir < 0;
      let budget = this.speed * dt, guard = 10;
      while (budget > 0.0001 && guard-- > 0) {
        const stepLen = Math.min(budget, 1.5);
        const nx = Phaser.Math.Clamp(this.x + dir * stepLen, C.world.left, C.world.right);
        if (nx === this.x) break;
        // wall in front of the head?
        const pc = f.colAt(nx + dir * this.half), pr = f.rowAt(this.h + 0.5);
        if (pc >= 0 && f.solid(pc, pr)) {
          // the only way on is up: grab the wall and keep climbing while the key is held
          this.cling = dir; this.x = f.faceX(pc, dir) - dir * 0.3; this.mode = 'up'; this.moving = true;
          return;
        }
        const ng = f.groundAt(nx, this.h + 3.5);
        if (ng < this.h - 3.5) {
          // walked off a ledge: the only way on is down, so go over the edge
          const c = f.colAt(this.x);
          if (c >= 0) {
            const edge = f.x0 + (dir > 0 ? c + 1 : c) * cell;
            this.x = edge + dir * 0.3; this.cling = -dir; this.mode = 'down'; this.flip = dir < 0 ? false : true;
            this.flip = -dir > 0; this.moving = true;
            return;
          }
        }
        this.x = nx; budget -= stepLen; this.moving = true;
        this.h = ng; // small steps (the plate rim) are walked over
      }
    }

    // Wall column the clinging ant holds.
    wallCol() { return this.food.colAt(this.x + this.cling * 1.0); }
    holds(c) {
      const f = this.food;
      return c >= 0 && (f.solid(c, f.rowAt(this.h + 0.5)) || f.solid(c, f.rowAt(this.h - 0.5)));
    }

    driveCling(inp, dt) {
      const f = this.food, d = this.cling, wc = this.wallCol();
      if (!this.holds(wc)) {
        // the wall under our feet was eaten: slide to what is left just below, else let go
        const r0 = f.rowAt(this.h - 0.5);
        for (let r = r0 - 1; r >= r0 - 2; r--) {
          if (wc >= 0 && f.solid(wc, r)) { this.h = f.topOf(r); return; }
        }
        this.letGo(); return;
      }
      // up/down keys climb; walking keys climb too: toward the wall = up, away from it = down
      const v = inp.dy || (inp.dx === d ? 1 : inp.dx === -d ? -1 : 0);
      if (v > 0) {
        this.mode = 'up'; this.flip = d < 0;
        let r = f.solid(wc, f.rowAt(this.h + 0.5)) ? f.rowAt(this.h + 0.5) : f.rowAt(this.h - 0.5);
        while (f.solid(wc, r + 1)) r++;
        const top = f.topOf(r);
        let nh = Math.min(this.h + this.climb * dt, top);
        // overhang above us?
        const ac = f.colAt(this.x - d * 2);
        if (ac >= 0 && f.solid(ac, f.rowAt(nh + this.half))) nh = Math.min(nh, this.h);
        if (nh > this.h) this.moving = true;
        this.h = nh;
        if (this.h >= top - 0.01) { // over the top
          this.cling = 0; this.mode = 'walk'; this.flip = d < 0;
          this.x = f.faceX(wc, d) + d * Math.min(this.half, f.cell - 0.5);
          this.h = top;
        }
      } else if (v < 0) {
        this.mode = 'down'; this.flip = d > 0;
        const g = f.groundAt(this.x, this.h);
        const nh = Math.max(g, this.h - this.climb * dt);
        if (nh < this.h) this.moving = true;
        this.h = nh;
        if (this.h <= g + 0.01) { // reached the floor: stand facing the wall
          this.cling = 0; this.mode = 'walk'; this.flip = d < 0;
          this.x -= d * (this.half - 0.3);
        } else if (!this.holds(wc)) this.letGo();
      }
    }

    letGo() {
      const d = this.cling;
      this.cling = 0; this.mode = 'walk'; this.vy = 0; this.flip = d < 0;
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

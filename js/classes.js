// 2D Vector, X and Y
class Vector {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    static add(a, b) {
        return new Vector(a.x + b.x, a.y + b.x);
    }
    static mul(v, s) {
        return new Vector(v.x * s, v.y * s);
    }

    normalize() {
        let len = Math.sqrt(this.x * this.x + this.y * this.y);
        if (len <= 0) return new Vector(0, 0);
        return new Vector(this.x / len, this.y / len);
    }
}

// Timer that controls cooldowns for bullets, animations, etc
class Timer {
    constructor(cool = 1, timeOff = 0, can = true) {
        this.can = can;
        this.cool = cool;
        this.time = cool + timeOff;
    }

    // Triggers the timer (Allows to tick)
    // Returns true if trigger changed
    trigger() {
        let will = this.can;
        this.can = false;
        return will;
    }

    // Ticks the timer
    // Returns true if timer completes; false if timer continues
    tick(dt = 1 / 60) {
        if (!this.can) {
            this.time -= dt;
            if (this.time <= 0) {
                this.time += this.cool;
                this.can = true;
                return true;
            }
        }
        return false;
    }
}

// The player character
class Ship extends PIXI.Sprite {
    constructor(x = 0, y = 0) {
        // Texture
        let tex = PIXI.Texture.from("images/spaceship.png");
        super(tex);
        this.anchor.set(.5, .5);
        this.zIndex = -1;

        // Transform
        this.x = x;
        this.y = y;
        this.fast = 300;
        this.slow = this.fast / 2;
        this.speed = this.fast;
        this.vel = new Vector(0, 0);

        // Hitbox
        let hitTex = PIXI.Texture.from("images/hitbox.png");
        let hitBox = new PIXI.Sprite(hitTex);
        hitBox.anchor.set(.5, .5);
        hitBox.x = x;
        hitBox.y = y;
        hitBox.zIndex = 10;
        this.hitBox = hitBox;
        this.addChild(hitBox);
        this.grazeRadius = 16;

        // Hit Invulnerability
        this.invul = new Timer(1);
        // Firing
        this.fire = new Timer(1 / 6);
        // Special
        this.special = new Timer(2);
    }

    // Handles player control input into actions
    input(dt = 1 / 60) {
        // Move =================================
        let dir = new Vector(0, 0);
        dir.x += input["ArrowRight"] ? 1 : 0;
        dir.x -= input["ArrowLeft"] ? 1 : 0;
        dir.y += input["ArrowDown"] ? 1 : 0;
        dir.y -= input["ArrowUp"] ? 1 : 0;

        let v = dir.normalize();
        v = Vector.mul(v, this.speed);
        this.vel = v;

        // Focus Mode ===========================
        let shift = input["Shift"];
        this.speed = shift ? this.slow : this.fast;
        this.alpha = shift ? 0.75 : 1;
        this.hitBox.alpha = shift ? 1.4 : 0;

        // Fire Bullets =========================
        if (shift) input["z"] = input["Z"];
        else input["Z"] = input["z"];

        if (input["z"] && input["Z"]) {
            if (this.fire.trigger())
                this.fireShot();
        }
        this.fire.tick(dt);

        // Time Slow ============================
        if (shift) input["x"] = input["X"];
        else input["X"] = input["x"];

        if (input["x"] && input["X"]) {
            if (meter >= 100 && this.special.trigger())
                this.slowTime();
        }
        if (this.special.tick(dt))
            this.resetTime();

        // Invuln ===============================
        if (this.invul.tick(dt))
            this.setInvul(false);
    }

    // Moves the ship
    move(dt = 1 / 60) {
        let newX = this.x + this.vel.x * dt;
        let newY = this.y + this.vel.y * dt;

        let w2 = this.width / 2;
        let h2 = this.height / 2;
        this.x = clamp(newX, w2, sceneWidth - w2);
        this.y = clamp(newY, h2, sceneWidth - h2);
    }

    // Fires three shots, modified by focus mode
    fireShot() {
        if (paused) return;
        let focus = input["Shift"] ? 8 : 1;

        let s = new Shot(this.x, this.y);
        shots.push(s);
        State.Game.addChild(s);

        let s1 = new Shot(this.x - 10, this.y + 5, new Vector(-1, -6 * focus));
        shots.push(s1);
        State.Game.addChild(s1);

        let s2 = new Shot(this.x + 10, this.y + 5, new Vector(1, -6 * focus));
        shots.push(s2);
        State.Game.addChild(s2);

        sfx["shot"].play();
    }

    // Slows and resets time effects
    slowTime() {
        timeMod = 0.25;
        State.Game.filters = [filter];
        meterAdd(-100);
        this.setInvul();
    }
    resetTime() {
        timeMod = 1;
        State.Game.filters = null;
    }

    getBounds() {
        return this.hitBox.getBounds();
    }
    isInvul() {
        return !this.invul.can;
    }
    setInvul(value = true) {
        this.invul.can = !value;
        this.tint = value ? 0xF99FAA : 0xffffff;
    }
}

// Base mover class, for game objects that move in a straight line
class Mover extends PIXI.Sprite {
    constructor(sprite, x = 0, y = 0, fwd = new Vector(0, 0), speed = 1) {
        super(sprite);
        this.anchor.set(.5, .5);
        this.x = x;
        this.y = y;
        this.fwd = fwd.normalize();
        this.speed = speed;
        this.isAlive = true;
    }

    move(dt = 1 / 60) {
        this.x += this.fwd.x * this.speed * dt;
        this.y += this.fwd.y * this.speed * dt;
    }

    disable() {
        this.isAlive = false;
    }
}

// Enemy, has HP, speed, direction, and can getHit and fireBullet while moving
class Enemy extends Mover {
    constructor(radius, x = 0, y = 0, hp = 3, fwd = Enemy.randomDir(), speed = getRandom(50, 100)) {
        let tex = PIXI.Texture.from("images/enemy.png");
        super(tex, x, y, fwd, speed);
        this.radius = radius;

        this.hp = hp;

        let fireCool = getRandom(1.5, 3)
        let fireTime = getRandom(-fireCool / 2, fireCool);
        this.fire = new Timer(fireCool, fireTime, false);

        this.flash = new Timer(0.2)

        this.score = 2;
    }

    move(dt = 1 / 60) {
        super.move(dt);

        if (this.fire.trigger()) {
            this.fireBullet();
        }
        this.fire.tick(dt);

        if (this.flash.tick(dt)) {
            this.blendMode = PIXI.BLEND_MODES.NORMAL;
        }
    }

    fireBullet() {
        if (paused) return;
        let b = new Bullet(8, this.x, this.y);
        bullets.push(b);
        State.Game.addChild(b);

        let b1Fwd = (new Vector(1, 2));
        let b1 = new Bullet(8, this.x, this.y, b1Fwd);
        bullets.push(b1);
        State.Game.addChild(b1);

        let b2Fwd = (new Vector(-1, 2));
        let b2 = new Bullet(8, this.x, this.y, b2Fwd);
        bullets.push(b2);
        State.Game.addChild(b2);
        sfx["bullet"].play();
    }

    reflectX() {
        this.fwd.x *= -1;
    }
    reflectY() {
        this.fwd.y *= -1;
    }

    getHit(dmg = 1) {
        this.hp -= dmg;
        if (this.hp <= 0) {
            sfx["explode"].play();
            new Explode(this.x, this.y);
            State.Game.removeChild(this);
            this.isAlive = false;
            return true;
        } else {
            this.blendMode = PIXI.BLEND_MODES.ADD;
            this.flash.trigger();
            return false;
        }
    }

    static randomDir() {
        let dir = getRandomUnitVector();
        dir.y *= 2;
        if (dir.y < 0) dir.y *= -1;
        if (dir.y == 0) dir.y = -1;
        dir.y = Math.max(0.25, dir.y);
        return dir;
    }
}
// Ring Enemy, more HP and fires a ring of 8 bullets instead of 3
class Ring extends Enemy {
    constructor(radius, x = 0, y = 0, hp = 6, fwd = Enemy.randomDir(), speed = getRandom(50, 75)) {
        super(radius, x, y, hp, fwd, speed);
        this.texture = PIXI.Texture.from("images/enemy2.png");
    }

    fireBullet() {
        if (paused) return;
        for (let i = 0; i < 8; i++) {
            let angle = i * Math.PI * 0.25;
            let fireDir = new Vector(
                Math.cos(angle),
                Math.sin(angle)
            ).normalize();

            let b = new Bullet(8, this.x, this.y, fireDir);
            bullets.push(b);
            State.Game.addChild(b);
        }
        sfx["bulletSmall"].play();
    }
}
// Boss Enemy, level scaling HP and fires two spirals of bullets, controls BG
class Boss extends Enemy {
    constructor(radius, x = 0, y = 0, hp = 50, fwd = new Vector(0, 1)) {
        super(radius, x, y, hp, fwd, 50);
        this.texture = PIXI.Texture.from("images/boss.png");
        this.score = 20;
        this.enter = true;

        this.fire = new Timer(1 / (10 * levelNum / 4), 0, false);
        this.fireAngle = 0;
        this.spin = 0.5;

        bg.speed = 2;
    }

    move(dt = 1 / 60) {
        const tau = 2 * Math.PI;
        this.fireAngle += (this.spin * tau * dt) % tau;
        super.move(dt);
        if (this.y > sceneHeight / 4 && this.enter) {
            this.enter = false;
            this.fwd = new Vector(1, 0);
            bg.speed = 0;
        }
    }

    fireBullet() {
        if (paused) return;
        let fireDir = new Vector(
            Math.cos(this.fireAngle),
            Math.sin(this.fireAngle)
        ).normalize();

        let b1 = new Bullet(8, this.x, this.y, fireDir);
        bullets.push(b1);
        State.Game.addChild(b1);

        let b2 = new Bullet(8, this.x, this.y, Vector.mul(fireDir, -1));
        bullets.push(b2);
        State.Game.addChild(b2);
        sfx["bulletSmall"].play();
    }

    getHit(dmg = 1) {
        super.getHit(dmg);
        if (!this.isAlive)
            bg.speed = 10;
    }
}

// Enemy's Bullets, can be grazed
class Bullet extends Mover {
    constructor(radius, x = 0, y = 0, fwd = new Vector(0, 1), speed = 300) {
        let tex = PIXI.Texture.from("images/bullet.png");
        super(tex, x, y, fwd, speed);
        this.radius = radius;
        this.graze = false;
        Object.seal(this);
    }
}
// Player's Shots
class Shot extends Mover {
    constructor(x = 0, y = 0, fwd = new Vector(0, -1)) {
        let tex = PIXI.Texture.from("images/shot.png");
        super(tex, x, y, fwd, 400);
        this.alpha = 0.75;
        Object.seal(this);
    }
}

// Explosion effect
class Explode extends PIXI.AnimatedSprite {
    static explodeTex;

    constructor(x = 0, y = 0) {
        super(Explode.explodeTex);
        this.anchor.set(.5, .5);
        this.x = x;
        this.y = y;
        this.animationSpeed = 1 / 7;
        this.loop = false;
        this.blendMode = PIXI.BLEND_MODES.ADD;
        this.onComplete = () => State.Game.removeChild(this);
        explodes.push(this);
        State.Game.addChild(this);
        this.play();
    }

    static loadSpriteSheet() {
        let spriteSheet = PIXI.BaseTexture.from("images/explosions.png");
        let width = 34;
        let height = 34;
        let numFrames = 7;
        let textures = [];
        for (let i = 0; i < numFrames; i++) {
            let frame = new PIXI.Texture(spriteSheet, new PIXI.Rectangle(i * width, 0, width, height));
            textures.push(frame);
        }
        return textures;
    }
}

// Scrolling tiling Background
class Background extends PIXI.TilingSprite {
    constructor() {
        let tex = PIXI.Texture.from("images/stars.png");
        super(tex);
        this.height = sceneHeight;
        this.width = sceneWidth;
        this.zIndex = -100;
        this.speed = 10;
    }

    move(dt = 1 / 60) {
        this.tilePosition.y += this.speed * dt;
    }
}
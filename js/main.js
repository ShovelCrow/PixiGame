"use strict";
const app = new PIXI.Application({
    width: 600,
    height: 600,
    backgroundColor: 0x1D1128
});
document.body.appendChild(app.view);

// Scene Constants
const sceneWidth = app.view.width;
const sceneHeight = app.view.height;

// Game State
class State {
    static Start;
    static Tutorial;
    static Game;
    static GameOver;
};

// Sound Effects & UI
let sfx = {};
let bgm;
let ui = {};

// GameObjects
let ship;
let shots = [];
let enemies = [];
let bullets = [];
let explodes = [];
let bg;

// Stats
let score = 0;
let life = 5;
let meter = 0;
let levelNum = 1;

// Canvas Modifiers
let filter;
let timeMod = 1;
let paused = true;
let lastEsc = false;

// Stored Input
let input = {
    "ArrowDown": false,
    "ArrowUp": false,
    "ArrowRight": false,
    "ArrowLeft": false,
    "Shift": false,
    "z": false,
    "x": false
};

// Switches gamestate
function switchState(state) {
    for (let s in State) {
        State[s].visible = false;
    }
    state.visible = true;
}

// Initializes the game
function init() {
    let stage = app.stage;

    State.Start = new PIXI.Container();
    stage.addChild(State.Start);
    State.Tutorial = new PIXI.Container();
    State.Tutorial.visible = false;
    stage.addChild(State.Tutorial);
    State.Game = new PIXI.Container();
    State.Game.visible = false;
    stage.addChild(State.Game);
    State.GameOver = new PIXI.Container();
    State.GameOver.visible = false;
    stage.addChild(State.GameOver);

    filter = new PIXI.filters.ColorMatrixFilter();
    filter.desaturate();

    bg = new Background();
    State.Game.addChild(bg);

    createUI();

    ship = new Ship();
    State.Game.addChild(ship);

    window.addEventListener("keydown", handleInput);
    window.addEventListener("keyup", handleInput);

    app.ticker.add(update);
}

function update() {
    // Pause
    if (input["Escape"] && !lastEsc) {
        paused = !paused;
    }
    lastEsc = input["Escape"];
    if (paused) return;

    // Set delta time
    let dt = 1 / app.ticker.FPS;
    if (dt > 1 / 12) dt = 1 / 12;

    // Move Background
    bg.move(dt);

    // Move Ship
    ship.input(dt);
    ship.move(dt);

    // Move all Movers
    for (let b of bullets) {
        b.move(dt * timeMod);
        outOfBounds(b);
    }
    for (let e of enemies) {
        e.move(dt * timeMod);
        if (e.x <= e.radius || e.x >= sceneWidth - e.radius) {
            e.reflectX();
            e.move(dt * timeMod);
        }
        outOfBounds(e, 100, 100);
    }
    for (let s of shots) {
        s.move(dt * timeMod);
        outOfBounds(s);
    }

    // Check for Collisions
    for (let b of bullets) {
        // Bullets hit Player: Player takes damage, Bullet destroyed
        if (b.isAlive && !ship.isInvul() && rectsIntersect(b, ship)) {
            sfx["hit"].play();
            State.Game.removeChild(b);
            b.isAlive = false;
            lifeSub(1);
        }
        // Player grazes Bullets: Player gets points and meter
        if (b.isAlive && !ship.isInvul() && !b.graze &&
            getDist(b.x, b.y, ship.x, ship.y) <= ship.grazeRadius + b.radius) {
            sfx["graze"].play();
            b.graze = true;
            meterAdd(10);
            scoreAdd(1);
        }
    }
    for (let e of enemies) {
        // Shots hit Enemy: Enemy takes damage, Shot destroyed
        for (let s of shots) {
            if (rectsIntersect(e, s)) {
                sfx["shotHit"].play();
                State.Game.removeChild(s);
                s.isAlive = false;
                if (e.getHit()) {
                    scoreAdd(e.score);
                    meterAdd(1);
                }
            }
        }
        // Enemy hits Player: Player takes damage, Enemy takes damage
        if (e.isAlive && !ship.isInvul() && rectsIntersect(e, ship)) {
            sfx["hit"].play();
            lifeSub(1);
            e.getHit(3);
        }
    }

    // Clean
    bullets = bullets.filter(b => b.isAlive);
    shots = shots.filter(s => s.isAlive);
    enemies = enemies.filter(e => e.isAlive);
    explodes = explodes.filter(e => e.playing);

    // Gameover
    if (life <= 0) {
        end();
        return;
    }

    // Next Level
    if (enemies.length == 0) {
        levelNum++;
        newWave();
    }
}

// Starts a new game
function startGame() {
    // Hides cursor
    app.renderer.plugins.interaction.cursorStyles.default = 'none'
    app.renderer.plugins.interaction.setCursorMode('default');

    // Reset Game
    switchState(State.Game);
    State.Game.filters = null;
    bgm.play();
    levelNum = 1;

    // Reset Player
    score = 0;
    life = 5;
    meter = 0
    scoreAdd(0);
    lifeSub(0);
    meterAdd(0);
    ship.x = 300;
    ship.y = 550;
    ship.setInvul(false);

    // Start next wave
    newWave();
}

// Creates the next wave of enemies/Boss
function newWave() {
    if (levelNum % 4 != 0) {
        createEnemies(3 + levelNum * 2);
    } else {
        createBoss(50 + levelNum * 10);
    }
    paused = false;
}

// Ends the game, cleans, and shows GameOver screen
function end() {
    // Pause game logic
    paused = true;
    bgm.stop();

    // Show cursor
    app.renderer.plugins.interaction.cursorStyles.default = 'default'
    app.renderer.plugins.interaction.setCursorMode('default');

    // Clean up
    enemies.forEach(e => State.Game.removeChild(e));
    enemies = [];
    bullets.forEach(b => State.Game.removeChild(b));
    bullets = [];
    shots.forEach(s => State.Game.removeChild(s));
    shots = [];
    explodes.forEach(e => State.Game.removeChild(e));
    explodes = [];

    // Update GameOver UI
    ui.finalScore.text = `Score: ${score}\nWave: ${levelNum}`;
    ui.finalScore.x = (sceneWidth - ui.finalScore.width) / 2;

    // Switch to GameOver state
    switchState(State.GameOver);
}

// Disables mover if it moves out of bounds
function outOfBounds(mover, bx = 0, by = 0) {
    if (mover.x <= 0 - bx || mover.x >= sceneWidth + bx ||
        mover.y <= 0 - by || mover.y >= sceneHeight + by) {
        State.Game.removeChild(mover);
        mover.disable();
    }
}

// Adds to score and updates UI
function scoreAdd(value) {
    score += value;
    let scoreString = score.toString().padStart(4, '0');
    ui.score.text = `Score: ${scoreString}`;
}
// Subtracts from life and updates UI
function lifeSub(value) {
    life -= value;
    if (value > 0)
        ship.setInvul();
    let lifeString = "";
    for (let i = 0; i < life; i++) {
        lifeString += "○";
    }
    ui.life.text = `Life: ${lifeString}`;
}
// Adds to meter and updates UI
function meterAdd(value) {
    meter = clamp(meter + value, 0, 300);
    if (meter >= 100 && meter - value < 100) {
        sfx["power"].play();
        ui.meter.style.stroke = 0x51D6FF;
    }
    if (meter < 100) {
        ui.meter.style.stroke = color4;
    }
    ui.meter.text = `Meter: ${meter}%`;
}

// Collect all state of keypresses by user
function handleInput(e) {
    input[e.key] = (e.type == "keydown");
}

// Create a number of enemies for a wave
function createEnemies(numEnemies) {
    for (let i = 0; i < numEnemies; i++) {
        let ex = Math.random() * (sceneWidth - 150) + 75;
        let ey = getRandom(0, -50);
        createEnemy(ex, ey);
    }
}

// Creates an enemy, randomly picked from base Enemy or Ring-type
function createEnemy(x, y) {
    let kind = getRandom(0, 10);
    let e;
    if (kind < levelNum / 4 && levelNum > 4) {
        e = new Ring(10, x, y);
    } else {
        e = new Enemy(10, x, y);
    }
    enemies.push(e);
    State.Game.addChild(e);
}

// Create the boss with scaled hp
function createBoss(hp) {
    let e = new Boss(40, sceneWidth / 2, -50, hp);
    enemies.push(e);
    State.Game.addChild(e);
}

// ============================================================================
// UI
// ============================================================================
const color1 = 0xA061BD; // Amethyst
const color2 = 0x8E7DBE; // Purple Mountain Majesty
const color3 = 0x5941A9; // Plump Purple
const color4 = 0x6D72C3; // Violet Blue Crayola
const color5 = 0x1D1128; // Dark Purple

// Creates all the UI
function createUI() {
    startUI();
    tutorialUI();
    gameUI();
    gameOverUI();
}

// Start Screen UI
function startUI() {
    let tutorialStyle = new PIXI.TextStyle({
        fill: color2,
        fontSize: 48,
        fontFamily: "RocknRoll One",
        lineJoin: "bevel"
    });
    let startStyle = new PIXI.TextStyle({
        fill: color3,
        fontSize: 48,
        fontFamily: "RocknRoll One",
        lineJoin: "bevel"
    });

    // Title
    let startLabel1 = new PIXI.Text("弾幕\nDanmaku");
    startLabel1.style = new PIXI.TextStyle({
        fill: 0xffffff,
        fontSize: 72,
        fontFamily: "RocknRoll One",
        lineJoin: "bevel",
        align: "center",
        stroke: color1,
        strokeThickness: 6
    });
    startLabel1.x = (sceneWidth - startLabel1.width) / 2;
    startLabel1.y = 120;
    State.Start.addChild(startLabel1);

    // How to Play
    let tutorialButton = new PIXI.Text("How to Play");
    tutorialButton.style = tutorialStyle;
    tutorialButton.x = (sceneWidth - tutorialButton.width) / 2;
    tutorialButton.y = sceneHeight - 200;
    tutorialButton.interactive = true;
    tutorialButton.buttonMode = true;
    tutorialButton.on("pointerup", () => switchState(State.Tutorial));
    tutorialButton.on("pointerover", e => e.target.style.fill = color4);
    tutorialButton.on("pointerout", e => e.currentTarget.style.fill = color2);
    State.Start.addChild(tutorialButton);

    // Play
    let startButton = new PIXI.Text("Play");
    startButton.style = startStyle;
    startButton.x = (sceneWidth - startButton.width) / 2;
    startButton.y = sceneHeight - 100;
    startButton.interactive = true;
    startButton.buttonMode = true;
    startButton.on("pointerup", startGame);
    startButton.on("pointerover", e => e.target.style.fill = color4);
    startButton.on("pointerout", e => e.currentTarget.style.fill = color3);
    State.Start.addChild(startButton);
}

// Tutorial Screen UI
function tutorialUI() {
    // Heading
    let tutorialButton = new PIXI.Text("How to Play");
    tutorialButton.style = new PIXI.TextStyle({
        fill: 0xffffff,
        fontSize: 64,
        fontFamily: "RocknRoll One",
        lineJoin: "bevel",
        align: "center",
        stroke: color1,
        strokeThickness: 6
    });;
    tutorialButton.x = (sceneWidth - tutorialButton.width) / 2;
    tutorialButton.y = 20;
    State.Tutorial.addChild(tutorialButton);

    // Blurb
    let story = new PIXI.Text(
        "Survive the endless rain of bullets\nas the last of your kind in a hopeless war."
    );
    story.style = new PIXI.TextStyle({
        fill: color4,
        fontSize: 24,
        fontFamily: "RocknRoll One",
        lineJoin: "bevel",
        fontStyle: "italic",
        align: "center"
    });
    story.x = (sceneWidth - story.width) / 2;
    story.y = (sceneHeight - story.height) / 2 - 120;
    State.Tutorial.addChild(story);

    // Tutorial
    let text = new PIXI.Text(
        "・Use the arrow keys to move.\n" +
        "・Hold the Z key to fire your weapon.\n" +
        "・Hold the Shift key to focus your fire.\n" +
        "\n" +
        "・When your meter is 100% or above,\n" +
        "　press the X key to activate Time Slow.\n" +
        "・Build meter by defeating enemies and\n" +
        "　dodging bullets."
    );
    text.style = new PIXI.TextStyle({
        fill: color1,
        fontSize: 24,
        fontFamily: "RocknRoll One",
        lineJoin: "bevel"
    });
    text.x = (sceneWidth - text.width) / 2;
    text.y = (sceneHeight - text.height) / 2 + 60;
    State.Tutorial.addChild(text);

    // Menu
    let menu = new PIXI.Text("Return");
    menu.style = new PIXI.TextStyle({
        fill: color3,
        fontSize: 48,
        fontFamily: "RocknRoll One",
        lineJoin: "bevel"
    });
    menu.x = (sceneWidth - menu.width) / 2;
    menu.y = sceneHeight - 100;
    menu.interactive = true;
    menu.buttonMode = true;
    menu.on("pointerup", () => switchState(State.Start));
    menu.on("pointerover", e => e.target.style.fill = color4);
    menu.on("pointerout", e => e.currentTarget.style.fill = color3);
    State.Tutorial.addChild(menu);
}

// Game UI
function gameUI() {
    // Score UI
    let scoreStyle = new PIXI.TextStyle({
        fill: 0xffffff,
        fontSize: 18,
        fontFamily: "RocknRoll One",
        lineJoin: "bevel",
        stroke: color1,
        strokeThickness: 4
    });
    ui.score = new PIXI.Text("Score:");
    ui.score.style = scoreStyle;
    ui.score.x = sceneWidth - 5;
    ui.score.anchor.set(1, 0);
    ui.score.y = 5;
    State.Game.addChild(ui.score);
    scoreAdd(0);

    // Life UI
    let lifeStyle = new PIXI.TextStyle({
        fill: 0xffffff,
        fontSize: 18,
        fontFamily: "RocknRoll One",
        lineJoin: "bevel",
        stroke: color4,
        strokeThickness: 4
    });
    ui.life = new PIXI.Text("Life:");
    ui.life.style = lifeStyle;
    ui.life.x = 5;
    ui.life.y = 5;
    State.Game.addChild(ui.life);
    lifeSub(0);

    // Meter UI
    let meterStyle = new PIXI.TextStyle({
        fill: 0xffffff,
        fontSize: 18,
        fontFamily: "RocknRoll One",
        lineJoin: "bevel",
        stroke: color4,
        strokeThickness: 4
    });
    ui.meter = new PIXI.Text("Meter:");
    ui.meter.style = meterStyle;
    ui.meter.x = 5;
    ui.meter.y = 26;
    State.Game.addChild(ui.meter);
    meterAdd(0);
}

// GameOver UI
function gameOverUI() {
    // Game Over
    let textStyle = new PIXI.TextStyle({
        fill: 0xFFFFFF,
        fontSize: 64,
        fontFamily: "RocknRoll One",
        lineJoin: "bevel",
        align: "center",
        stroke: color1,
        strokeThickness: 6
    });
    let buttonStyle = new PIXI.TextStyle({
        fill: color3,
        fontSize: 48,
        fontFamily: "RocknRoll One",
        lineJoin: "bevel"
    });

    let gameOverText = new PIXI.Text("Game Over");
    gameOverText.style = textStyle;
    gameOverText.x = (sceneWidth - gameOverText.width) / 2;
    gameOverText.y = sceneHeight / 2 - 160;
    State.GameOver.addChild(gameOverText);

    ui.finalScore = new PIXI.Text("Score: ");
    ui.finalScore.style = new PIXI.TextStyle({
        fill: 0xFFFFFF,
        fontSize: 32,
        fontFamily: "RocknRoll One",
        lineJoin: "bevel",
        stroke: color1,
        strokeThickness: 6,
        align: "center",
    });
    ui.finalScore.x = (sceneWidth - ui.finalScore.width) / 2;
    ui.finalScore.y = sceneHeight / 2;
    State.GameOver.addChild(ui.finalScore);

    let playAgainButton = new PIXI.Text("Return");
    playAgainButton.style = buttonStyle;
    playAgainButton.x = (sceneWidth - playAgainButton.width) / 2;
    playAgainButton.y = sceneHeight - 100;
    playAgainButton.interactive = true;
    playAgainButton.buttonMode = true;
    playAgainButton.on("pointerup", () => switchState(State.Start));
    playAgainButton.on("pointerover", e => e.target.style.fill = color4);
    playAgainButton.on("pointerout", e => e.currentTarget.style.fill = color3);
    State.GameOver.addChild(playAgainButton);
}
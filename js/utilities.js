// we use this to keep the ship on the screen
function clamp(val, min, max) {
    return val < min ? min : (val > max ? max : val);
}

// bounding box collision detection - it compares PIXI.Rectangles
function rectsIntersect(a, b) {
    var ab = a.getBounds();
    var bb = b.getBounds();
    return ab.x + ab.width > bb.x && ab.x < bb.x + bb.width && ab.y + ab.height > bb.y && ab.y < bb.y + bb.height;
}

// these 2 helpers are used by classes.js
function getRandomUnitVector() {
    let x = getRandom(-1, 1);
    let y = getRandom(-1, 1);
    let length = Math.sqrt(x * x + y * y);
    if (length == 0) { // very unlikely
        x = 1; // point right
        y = 0;
        length = 1;
    } else {
        x /= length;
        y /= length;
    }

    return new Vector(x, y);
}

function getRandom(min, max) {
    return Math.random() * (max - min) + min;
}

function getDist(v1, v2) {
    return getDist(v1.x, v1.y, v2.x, v2.y);
}
function getDist(x1, y1, x2, y2) {
    let diff = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    return Math.sqrt(Math.abs(diff));
}
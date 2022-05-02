WebFont.load({
    google: {
        families: ['RocknRoll One']
    },
    active: e => {
        console.log("font loaded!");
        // pre-load the images
        app.loader.add([
            "images/spaceship.png",     // https://opengameart.org/content/spaceships-32x32
            "images/enemy.png",         // https://opengameart.org/content/spaceships-32x32
            "images/enemy2.png",         // https://opengameart.org/content/spaceships-32x32
            "images/explosions.png",    // https://opengameart.org/content/explosion-set-1-m484-games
            "images/bullet.png",
            "images/shot.png",
            "images/hitbox.png",
            "images/stars.png"
        ]);
        app.loader.onProgress.add(e => { console.log(`progress=${e.progress}`) });

        sfx["bullet"] = new Howl({ src: ['sounds/bullet1.wav'] });
        sfx["bulletSmall"] = new Howl({ src: ['sounds/bullet2.wav'] });
        sfx["hit"] = new Howl({ src: ['sounds/hit.wav'] });
        sfx["explode"] = new Howl({ src: ['sounds/explosion.wav'], volume: 0.75 });
        sfx["shot"] = new Howl({ src: ['sounds/shot.wav'], volume: 1 });
        sfx["shotHit"] = new Howl({ src: ['sounds/shotHit.wav'], volume: 0.75 });
        sfx["graze"] = new Howl({ src: ['sounds/click.wav'], volume: 0.5 });
        sfx["power"] = new Howl({ src: ['sounds/powerUp.wav'], volume: 1.25 });

        bgm = new Howl({src:['sounds/spaceship.wav'], loop: true});     // https://opengameart.org/content/space-music

        Explode.explodeTex = Explode.loadSpriteSheet();
        
        app.loader.onComplete.add(init);
        app.loader.load();
    }
});
(() => {
    "use strict";

    // ============================================================
    // 00. PURPOSE
    // ============================================================
    // Load the original game source, replace the focused sections below,
    // then execute the adjusted game. The computer racers are deliberately
    // simple: they wander independently and react only when they actually
    // touch fruit or mud.

    const gameUrl = new URL("game.js", document.baseURI);

    // ============================================================
    // 01. SIMPLE OPPONENT STATE
    // ============================================================

    const oldOpponents = `                // Begin almost level with the player, with only enough
                // separation to keep the starting animals readable.
                d: -2 - index * 2,

                // One opponent is usually beatable at normal speed, one is
                // close, and one is quicker. Fruit and clean driving now
                // decide the race instead of the player winning by default.
                speed: 33.7 + index * 0.65 + Math.random() * 1.15,`;

    const newOpponents = `                // Start almost level, but not precisely on top of one another.
                d: -index * 1.5,

                // Opponents drift between lanes independently. They do not
                // inspect the course or deliberately seek fruit and avoid mud.
                target: index,
                x: lanes[index],
                moveTimer: 0.35 + Math.random() * 1.2,

                // They can make an occasional random jump, but it is not timed
                // to a particular obstacle.
                jump: 0,
                vy: 0,

                // Fruit and mud affect them only after an actual collision.
                boost: 0,
                slow: 0,
                fruit: 0,
                lastMud: -1,

                // Keep their ordinary pace slightly below the player's so the
                // game remains suitable for younger children.
                speed: 32.25 + index * 0.22 + Math.random() * 0.45,`;

    // ============================================================
    // 02. RANDOM COMPUTER MOVEMENT AND COLLISIONS
    // ============================================================

    const opponentUpdateStartMarker = `        // --------------------------------------------------------
        // 08B-3. Computer-controlled racers`;

    const opponentUpdateEndMarker = `        // --------------------------------------------------------
        // 08B-5. Display and finish checks`;

    const correctedOpponentUpdate = `        // --------------------------------------------------------
        // 08B-3. Player fruit and mud collisions
        // --------------------------------------------------------

        player.lastMud ??= -1;

        game.items.forEach((item) => {
            const horizontalDistance = Math.abs(lanes[item.lane] - player.x);
            if (horizontalDistance > 44 || Math.abs(item.d - player.d) > 11) return;

            if (item.kind === "fruit" && !item.used) {
                // Give the player first chance when two racers reach the same
                // fruit during the same animation frame.
                item.used = true;
                player.fruit += 1;
                player.boost = 1.2;

                beep(760);
                beep(980, 0.11, 0.06);
                message("Fruit boost! ⚡");
            } else if (item.kind === "mud" && player.jump < 18 && player.lastMud !== item.d) {
                // Puddles remain on the track and can affect every racer.
                player.lastMud = item.d;
                player.slow = 1.1;

                beep(130, 0.2);
                message("Splish splash! 💦");
            }
        });


        // --------------------------------------------------------
        // 08B-4. Computer-controlled racers
        // --------------------------------------------------------

        game.opponents.forEach((opponent, index) => {
            if (opponent.d >= finish) return;

            opponent.boost = Math.max(0, opponent.boost - dt);
            opponent.slow = Math.max(0, opponent.slow - dt);

            // Each animal makes an independent, unplanned movement decision.
            // Most decisions simply keep its current lane. Occasionally it
            // wanders left or right, and very occasionally it jumps.
            opponent.moveTimer -= dt;

            if (opponent.moveTimer <= 0) {
                const roll = Math.random();

                if (roll < 0.34) {
                    const direction = Math.random() < 0.5 ? -1 : 1;
                    opponent.target = Math.max(0, Math.min(2, opponent.target + direction));
                } else if (roll < 0.43 && opponent.jump <= 1) {
                    opponent.vy = 455;
                }

                opponent.moveTimer = 0.55 + Math.random() * 1.45 + index * 0.08;
            }

            // Slide towards the randomly selected lane.
            opponent.x += (lanes[opponent.target] - opponent.x) * Math.min(1, dt * 7.4);

            // Apply the same basic jump physics as the player.
            if (opponent.jump > 0 || opponent.vy > 0) {
                opponent.jump += opponent.vy * dt;
                opponent.vy -= 1020 * dt;

                if (opponent.jump <= 0) {
                    opponent.jump = 0;
                    opponent.vy = 0;
                }
            }

            // They do not plan around the course. Fruit and mud only matter
            // when random movement happens to put the animal on top of them.
            game.items.forEach((item) => {
                const horizontalDistance = Math.abs(lanes[item.lane] - opponent.x);
                if (horizontalDistance > 44 || Math.abs(item.d - opponent.d) > 11) return;

                if (item.kind === "fruit" && !item.used) {
                    item.used = true;
                    opponent.fruit += 1;
                    opponent.boost = 1.0;
                } else if (item.kind === "mud" && opponent.jump < 18 && opponent.lastMud !== item.d) {
                    opponent.lastMud = item.d;
                    opponent.slow = 1.2;
                }
            });

            const wobble = Math.sin(game.elapsed * 1.05 + index * 2.4) * 0.28;
            const speed = opponent.speed * (opponent.boost > 0 ? 1.22 : 1) * (opponent.slow > 0 ? 0.57 : 1);

            opponent.d += (speed + wobble) * dt;

            if (opponent.d >= finish && !opponent.finishTime) {
                opponent.finishTime = game.elapsed;
            }
        });


`;

    // ============================================================
    // 03. VISIBLE RANDOM MOVEMENT AND EFFECTS
    // ============================================================

    const drawRacersStartMarker = `    // ------------------------------------------------------------
    // 12G. All racers`;

    const drawRacersEndMarker = `    // ------------------------------------------------------------
    // 12H. Complete canvas redraw`;

    const correctedDrawRacers = `    // ------------------------------------------------------------
    // 12G. All racers
    // ------------------------------------------------------------

    function drawRacers() {
        const racers = game.opponents.map((opponent) => ({
            x: opponent.x,
            y: sy(opponent.d) - opponent.jump,
            groundY: sy(opponent.d),
            type: opponent.type,
            player: false,
            jump: opponent.jump,
            boosted: opponent.boost > 0,
            slowed: opponent.slow > 0
        }));

        racers.push({
            x: game.player.x,
            y: 420 - game.player.jump,
            groundY: 420,
            type: selected,
            player: true,
            jump: game.player.jump,
            boosted: game.player.boost > 0,
            slowed: game.player.slow > 0
        });

        racers
            .sort((a, b) => a.y - b.y)
            .forEach((racer) => {
                if (racer.y <= -90 || racer.y >= H + 90) return;

                if (!racer.player) {
                    ctx.fillStyle = "rgba(0,0,0,.16)";
                    ctx.beginPath();
                    ctx.ellipse(racer.x, racer.groundY + 34, 31, 9, 0, 0, Math.PI * 2);
                    ctx.fill();
                }

                drawRacer(racer.x, racer.y, racer.type, racer.player, racer.jump);

                if (!racer.player && (racer.boosted || racer.slowed)) {
                    ctx.font = "24px system-ui";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(racer.boosted ? "⚡" : "💦", racer.x + 35, racer.y - 35);
                }
            });
    }


`;

    // ============================================================
    // 04. TREE PERSPECTIVE
    // ============================================================

    const sceneryStartMarker = `    // ------------------------------------------------------------
    // 12C. Trees and scenery`;

    const sceneryEndMarker = `    // ------------------------------------------------------------
    // 12D. Fruit and muddy puddles`;

    const correctedScenery = `    // ------------------------------------------------------------
    // 12C. Trees and scenery
    // ------------------------------------------------------------

    function drawScenery() {
        const horizon = Math.floor(H * 0.56);
        const treeCount = 16;
        const sceneryLoop = 920;
        const camera = game?.camera || 0;

        for (let i = 0; i < treeCount; i += 1) {
            const progress = ((camera + i * sceneryLoop / treeCount) % sceneryLoop) / sceneryLoop;
            const depth = Math.pow(progress, 1.55);
            const y = horizon + 26 + depth * (H - horizon + 72);

            if (y > H + 65) continue;

            const scale = 0.3 + depth * 1.02;
            const leftSide = i % 2 === 0;
            const roadEdge = leftSide ? 245 : 715;
            const outwardDistance = 38 + depth * 128;
            const x = leftSide ? roadEdge - outwardDistance : roadEdge + outwardDistance;

            ctx.fillStyle = "rgba(35, 90, 35, " + (0.08 + depth * 0.14) + ")";
            ctx.beginPath();
            ctx.ellipse(x, y + 2, 30 * scale, 8 * scale, 0, 0, Math.PI * 2);
            ctx.fill();

            const trunkWidth = 15 * scale;
            const trunkHeight = 46 * scale;

            ctx.fillStyle = "#805b3c";
            ctx.fillRect(x - trunkWidth / 2, y - trunkHeight, trunkWidth, trunkHeight);

            const canopyY = y - trunkHeight - 8 * scale;
            const leafColour = i % 4 === 0 ? "#66c95e" : "#45ad55";

            ctx.fillStyle = leafColour;
            [
                [0, -8, 31],
                [-19, 5, 23],
                [19, 5, 23]
            ].forEach(([offsetX, offsetY, radius]) => {
                ctx.beginPath();
                ctx.arc(x + offsetX * scale, canopyY + offsetY * scale, radius * scale, 0, Math.PI * 2);
                ctx.fill();
            });
        }
    }


`;

    // ============================================================
    // 05. SOURCE REPLACEMENT AND STARTUP
    // ============================================================

    function replaceBetween(source, startMarker, endMarker, replacement, label) {
        const start = source.indexOf(startMarker);
        const end = source.indexOf(endMarker, start);

        if (start < 0 || end < 0) {
            throw new Error("The expected " + label + " section was not found.");
        }

        return source.slice(0, start) + replacement + source.slice(end);
    }

    async function loadGame() {
        const response = await fetch(gameUrl, { cache: "no-store" });
        if (!response.ok) throw new Error("Could not load game.js (" + response.status + ")");

        let source = await response.text();

        if (!source.includes(oldOpponents)) {
            throw new Error("The expected opponent state was not found.");
        }

        source = source.replace(oldOpponents, newOpponents);
        source = replaceBetween(source, opponentUpdateStartMarker, opponentUpdateEndMarker, correctedOpponentUpdate, "opponent update");
        source = replaceBetween(source, drawRacersStartMarker, drawRacersEndMarker, correctedDrawRacers, "racer drawing");
        source = replaceBetween(source, sceneryStartMarker, sceneryEndMarker, correctedScenery, "tree scenery");

        const blobUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
        const script = document.createElement("script");

        script.src = blobUrl;
        script.onload = () => URL.revokeObjectURL(blobUrl);
        script.onerror = () => {
            URL.revokeObjectURL(blobUrl);
            throw new Error("The adjusted game script could not be started.");
        };

        document.body.appendChild(script);
    }

    loadGame().catch((error) => {
        console.error("Animal Dash failed to load:", error);

        const startButton = document.getElementById("startButton");
        if (startButton) {
            startButton.disabled = true;
            startButton.textContent = "Game could not load";
        }
    });
})();

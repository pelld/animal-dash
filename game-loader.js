(() => {
    "use strict";

    // ============================================================
    // 00. PURPOSE
    // ============================================================
    // Load the original game source, apply the focused race and scenery
    // improvements below, then execute the corrected game. Keeping the
    // replacements here means the original, fully commented game remains
    // readable while the newer behaviour is kept together in one place.

    const gameUrl = new URL("game.js", document.baseURI);

    // ============================================================
    // 01. OPPONENT STATE AND BASE PACE
    // ============================================================

    const oldOpponents = `                // Begin almost level with the player, with only enough
                // separation to keep the starting animals readable.
                d: -2 - index * 2,

                // One opponent is usually beatable at normal speed, one is
                // close, and one is quicker. Fruit and clean driving now
                // decide the race instead of the player winning by default.
                speed: 33.7 + index * 0.65 + Math.random() * 1.15,`;

    const newOpponents = `                // Start on virtually the same line as the player.
                d: -index * 1.5,

                // Opponents now move between lanes rather than remaining
                // locked to their starting lane.
                target: index,
                x: lanes[index],

                // Each opponent can jump, collect fruit and be slowed by mud.
                jump: 0,
                vy: 0,
                boost: 0,
                slow: 0,
                fruit: 0,
                lastMud: -1,

                // Better racers notice hazards sooner and make more reliable
                // decisions. The three opponents deliberately have different
                // skill levels so they do not move as one identical group.
                skill: Math.min(0.94, 0.58 + index * 0.16 + Math.random() * 0.06),
                decisionTimer: Math.random() * 0.22,

                // Base pace is close to the player's. Fruit, mud and decisions
                // now create the differences during the race.
                speed: 34.25 + index * 0.38 + Math.random() * 0.45,`;

    // ============================================================
    // 02. ACTIVE COMPUTER RACERS
    // ============================================================

    const opponentUpdateStartMarker = `        // --------------------------------------------------------
        // 08B-3. Computer-controlled racers`;

    const opponentUpdateEndMarker = `        // --------------------------------------------------------
        // 08B-5. Display and finish checks`;

    const correctedOpponentUpdate = `        // --------------------------------------------------------
        // 08B-3. Computer-controlled racers
        // --------------------------------------------------------

        game.opponents.forEach((opponent, index) => {
            // Stop moving this opponent once it has finished.
            if (opponent.d >= finish) return;

            // Reduce temporary effects.
            opponent.boost = Math.max(0, opponent.boost - dt);
            opponent.slow = Math.max(0, opponent.slow - dt);

            // Slide visibly towards the chosen lane.
            opponent.x += (lanes[opponent.target] - opponent.x) * Math.min(1, dt * (7.2 + opponent.skill * 4.2));

            if (Math.abs(lanes[opponent.target] - opponent.x) < 4) {
                opponent.lane = opponent.target;
            }

            // Apply the same jumping physics used by the player.
            if (opponent.jump > 0 || opponent.vy > 0) {
                opponent.jump += opponent.vy * dt;
                opponent.vy -= 1020 * dt;

                if (opponent.jump <= 0) {
                    opponent.jump = 0;
                    opponent.vy = 0;
                }
            }

            // Look ahead at nearby fruit and puddles at intervals. Higher-skill
            // racers react more frequently and make better choices.
            opponent.decisionTimer -= dt;

            if (opponent.decisionTimer <= 0) {
                const upcoming = game.items
                    .filter((item) => item.d > opponent.d + 7 && item.d < opponent.d + 95 && (item.kind === "mud" || !item.used))
                    .sort((a, b) => a.d - b.d);

                const danger = upcoming.find((item) => item.kind === "mud" && item.lane === opponent.target);
                const fruit = upcoming.find((item) => item.kind === "fruit" && !item.used);

                if (danger) {
                    const gap = danger.d - opponent.d;
                    const safeLanes = [0, 1, 2].filter((lane) => !upcoming.some((item) => item.kind === "mud" && item.lane === lane && item.d - opponent.d < 58));

                    if (gap < 34 && opponent.jump <= 1 && Math.random() < 0.38 + opponent.skill * 0.58) {
                        // A late decision becomes a jump. Less-skilled racers
                        // sometimes mistime it and hit the puddle instead.
                        opponent.vy = 470;
                    } else if (safeLanes.length && Math.random() < 0.30 + opponent.skill * 0.68) {
                        // Prefer a safe lane which also contains nearby fruit.
                        const fruitLane = fruit && safeLanes.includes(fruit.lane) ? fruit.lane : null;
                        opponent.target = fruitLane ?? safeLanes[Math.floor(Math.random() * safeLanes.length)];
                    }
                } else if (fruit && Math.random() < 0.25 + opponent.skill * 0.70) {
                    // Chase available fruit, but not with perfect consistency.
                    opponent.target = fruit.lane;
                } else if (Math.random() < 0.08 + (1 - opponent.skill) * 0.15) {
                    // Occasional imperfect wandering keeps racers from looking
                    // mechanically fixed even when the road is clear.
                    opponent.target = Math.floor(Math.random() * lanes.length);
                }

                opponent.decisionTimer = 0.14 + (1 - opponent.skill) * 0.27 + Math.random() * 0.16;
            }

            // Fruit is collected once by whichever racer reaches it first.
            // Mud remains on the course and can affect every racer once.
            game.items.forEach((item) => {
                const horizontalDistance = Math.abs(lanes[item.lane] - opponent.x);
                if (horizontalDistance > 44 || Math.abs(item.d - opponent.d) > 11) return;

                if (item.kind === "fruit" && !item.used) {
                    item.used = true;
                    opponent.fruit += 1;
                    opponent.boost = 1.15;
                } else if (item.kind === "mud" && opponent.jump < 18 && opponent.lastMud !== item.d) {
                    opponent.lastMud = item.d;
                    opponent.slow = 1.1;
                }
            });

            const wobble = Math.sin(game.elapsed * 1.15 + index * 2.2) * 0.35;
            const speed = opponent.speed * (opponent.boost > 0 ? 1.29 : 1) * (opponent.slow > 0 ? 0.58 : 1);

            opponent.d += (speed + wobble) * dt;

            if (opponent.d >= finish && !opponent.finishTime) {
                opponent.finishTime = game.elapsed;
            }
        });


        // --------------------------------------------------------
        // 08B-4. Player fruit and mud collisions
        // --------------------------------------------------------

        player.lastMud ??= -1;

        game.items.forEach((item) => {
            // Use the player's visible x position so a collision happens only
            // after the animal has actually reached the new lane.
            const horizontalDistance = Math.abs(lanes[item.lane] - player.x);
            if (horizontalDistance > 44 || Math.abs(item.d - player.d) > 11) return;

            if (item.kind === "fruit" && !item.used) {
                item.used = true;
                player.fruit += 1;
                player.boost = 1.2;

                beep(760);
                beep(980, 0.11, 0.06);
                message("Fruit boost! ⚡");
            } else if (item.kind === "mud" && player.jump < 18 && player.lastMud !== item.d) {
                // Puddles remain on the track; each racer can hit the same one.
                player.lastMud = item.d;
                player.slow = 1.1;

                beep(130, 0.2);
                message("Splish splash! 💦");
            }
        });


`;

    // ============================================================
    // 03. VISIBLE OPPONENT MOVEMENT AND EFFECTS
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

                // Computer racers now receive a ground shadow as they jump.
                if (!racer.player) {
                    ctx.fillStyle = "rgba(0,0,0,.16)";
                    ctx.beginPath();
                    ctx.ellipse(racer.x, racer.groundY + 34, 31, 9, 0, 0, Math.PI * 2);
                    ctx.fill();
                }

                drawRacer(racer.x, racer.y, racer.type, racer.player, racer.jump);

                // A small effect makes boosts and mud impacts readable without
                // covering the animal or adding another HUD.
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
    //
    // Trees use their own perspective track rather than the road-object
    // coordinate system. Their bases always begin below the grass horizon,
    // then move outwards and grow as they approach the bottom of the screen.
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
    // 05. SOURCE REPLACEMENT HELPERS
    // ============================================================

    function replaceBlock(source, startMarker, endMarker, replacement, label) {
        const start = source.indexOf(startMarker);
        const end = source.indexOf(endMarker, start);

        if (start < 0 || end < 0) {
            throw new Error(`The expected ${label} section was not found.`);
        }

        return source.slice(0, start) + replacement + source.slice(end);
    }

    // ============================================================
    // 06. LOAD, VERIFY AND EXECUTE
    // ============================================================

    async function loadGame() {
        const response = await fetch(gameUrl, { cache: "no-store" });
        if (!response.ok) throw new Error(`Could not load game.js (${response.status})`);

        let source = await response.text();

        if (!source.includes(oldOpponents)) {
            throw new Error("The expected opponent state section was not found.");
        }

        source = source.replace(oldOpponents, newOpponents);
        source = replaceBlock(source, opponentUpdateStartMarker, opponentUpdateEndMarker, correctedOpponentUpdate, "opponent update");
        source = replaceBlock(source, drawRacersStartMarker, drawRacersEndMarker, correctedDrawRacers, "racer drawing");
        source = replaceBlock(source, sceneryStartMarker, sceneryEndMarker, correctedScenery, "tree scenery");

        const blobUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
        const script = document.createElement("script");

        script.src = blobUrl;
        script.onload = () => URL.revokeObjectURL(blobUrl);
        script.onerror = () => {
            URL.revokeObjectURL(blobUrl);
            throw new Error("The corrected game script could not be started.");
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
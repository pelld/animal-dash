(() => {
    "use strict";

    // ============================================================
    // 00. PURPOSE
    // ============================================================
    // Load the existing game source, replace the two known-broken sections,
    // then execute the corrected source. This keeps the fix isolated and
    // reviewable while preserving the rest of the original game unchanged.

    const gameUrl = new URL("game.js", document.baseURI);

    // ============================================================
    // 01. OPPONENT PACE
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

                // Aim for roughly 25–27 second finishing times. A clean run
                // with useful fruit boosts can still win, but an ordinary
                // 26-second race should now be genuinely close.
                speed: 37 + index * 0.95 + Math.random() * 0.7,`;

    // ============================================================
    // 02. TREE PERSPECTIVE
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
            // Move each tree smoothly from the horizon towards the viewer.
            const progress = ((camera + i * sceneryLoop / treeCount) % sceneryLoop) / sceneryLoop;
            const depth = Math.pow(progress, 1.55);

            // The trunk base is always on the grass, never in the sky.
            const y = horizon + 26 + depth * (H - horizon + 72);
            if (y > H + 65) continue;

            const scale = 0.3 + depth * 1.02;
            const leftSide = i % 2 === 0;
            const roadEdge = leftSide ? 245 : 715;
            const outwardDistance = 38 + depth * 128;
            const x = leftSide ? roadEdge - outwardDistance : roadEdge + outwardDistance;

            // Add a small ground shadow to make the tree feel planted.
            ctx.fillStyle = \`rgba(35, 90, 35, \${0.08 + depth * 0.14})\`;
            ctx.beginPath();
            ctx.ellipse(x, y + 2, 30 * scale, 8 * scale, 0, 0, Math.PI * 2);
            ctx.fill();

            const trunkWidth = 15 * scale;
            const trunkHeight = 46 * scale;

            // Draw the trunk upwards from its grass-level base.
            ctx.fillStyle = "#805b3c";
            ctx.fillRect(x - trunkWidth / 2, y - trunkHeight, trunkWidth, trunkHeight);

            // Build a rounded, three-part canopy whose size follows depth.
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
    // 03. LOAD, VERIFY AND EXECUTE
    // ============================================================

    async function loadGame() {
        const response = await fetch(gameUrl, { cache: "no-store" });
        if (!response.ok) throw new Error(`Could not load game.js (${response.status})`);

        let source = await response.text();

        if (!source.includes(oldOpponents)) {
            throw new Error("The expected opponent-speed section was not found.");
        }

        source = source.replace(oldOpponents, newOpponents);

        const sceneryStart = source.indexOf(sceneryStartMarker);
        const sceneryEnd = source.indexOf(sceneryEndMarker, sceneryStart);

        if (sceneryStart < 0 || sceneryEnd < 0) {
            throw new Error("The expected tree-scenery section was not found.");
        }

        source = source.slice(0, sceneryStart) + correctedScenery + source.slice(sceneryEnd);

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

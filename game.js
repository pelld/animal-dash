(() => {
    "use strict";

    // ============================================================
    // 00. GAME OVERVIEW
    // ============================================================
    //
    // This file controls:
    //
    //   1. The animal selection screen.
    //   2. Starting and running a race.
    //   3. Player movement and jumping.
    //   4. Computer-controlled racers.
    //   5. Fruit boosts and muddy puddles.
    //   6. Drawing the game onto the canvas.
    //   7. Saving preferences and best times.
    //
    // The whole game runs inside the visitor's web browser.
    // There is no server-side code or database.
    // ============================================================


    // ============================================================
    // 01. PAGE AND CANVAS REFERENCES
    // ============================================================

    // A shortcut for finding an HTML element by its ID.
    //
    // Instead of writing:
    // document.getElementById("gameCanvas")
    //
    // We can write:
    // $("gameCanvas")
    const $ = (id) => document.getElementById(id);

    // Find the canvas element defined in index.html.
    const canvas = $("gameCanvas");

    // The drawing context provides commands such as:
    // fillRect(), arc(), ellipse(), fillText() and stroke().
    const ctx = canvas.getContext("2d");

    // Store the canvas dimensions.
    const W = canvas.width;
    const H = canvas.height;


    // ============================================================
    // 02. MAIN GAME SETTINGS
    // ============================================================

    // The distance racers must travel to finish.
    //
    // This is not pixels. It is an imaginary course distance used
    // by the game. The drawing functions later convert this distance
    // into a position on the screen.
    const finish = 1000;

    // The horizontal centre of each of the three lanes.
    //
    // Lane 0 = x position 330
    // Lane 1 = x position 480
    // Lane 2 = x position 630
    const lanes = [330, 480, 630];

    // Display names for each animal.
    const names = {
        rabbit: "Ruby Rabbit",
        fox: "Freddie Fox",
        panda: "Poppy Panda",
        crocodile: "Charlie Croc"
    };

    // Emoji used to draw the animals during the race.
    const emoji = {
        rabbit: "🐰",
        fox: "🦊",
        panda: "🐼",
        crocodile: "🐊"
    };

    // Background colour used behind each animal emoji.
    const colours = {
        rabbit: "#f7dce7",
        fox: "#f59a4a",
        panda: "#e8e8ee",
        crocodile: "#78c66a"
    };


    // ============================================================
    // 03. SAVED SETTINGS AND CURRENT GAME STATE
    // ============================================================

    // localStorage remembers values in this browser.
    //
    // If no animal has previously been selected, use the rabbit.
    let selected = localStorage.getItem("animalDashAnimal") || "rabbit";

    // Sound is on unless the player has explicitly turned it off.
    let soundOn = localStorage.getItem("animalDashSound") !== "off";

    // Remember whether the party hat has been unlocked.
    let hat = localStorage.getItem("animalDashPartyHat") === "yes";

    // This will contain all information about the current race.
    //
    // It is null when no race currently exists.
    let game = null;

    // Stores the ID of the current animation frame.
    //
    // We use this to stop an old animation before starting a new race.
    let frame = 0;

    // The browser audio context used to create simple sound effects.
    let audio = null;


    // ============================================================
    // 04. GENERAL HELPER FUNCTIONS
    // ============================================================

    // ------------------------------------------------------------
    // 04A. Best-time storage
    // ------------------------------------------------------------

    // Create a different storage key for each animal.
    //
    // Examples:
    // animalDashBest_rabbit
    // animalDashBest_fox
    function bestKey() {
        return `animalDashBest_${selected}`;
    }

    // Read the selected animal's best time.
    //
    // Return 0 if no best time has yet been saved.
    function bestTime() {
        return Number(localStorage.getItem(bestKey())) || 0;
    }


    // ------------------------------------------------------------
    // 04B. Number formatting
    // ------------------------------------------------------------

    // Convert a finishing position into readable text.
    //
    // 1 becomes "1st"
    // 2 becomes "2nd"
    // 3 becomes "3rd"
    // 4 becomes "4th"
    function ordinal(n) {
        return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
    }


    // ------------------------------------------------------------
    // 04C. Delays
    // ------------------------------------------------------------

    // Pause an async function for a specified number of milliseconds.
    //
    // This is used during the 3, 2, 1 countdown.
    function wait(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }


    // ============================================================
    // 05. MENUS AND PAGE ELEMENTS
    // ============================================================

    // ------------------------------------------------------------
    // 05A. Switching between screens
    // ------------------------------------------------------------

    // Hide all three main screens, then show the requested screen.
    function show(screen) {
        [$("menuScreen"), $("gameScreen"), $("resultsScreen")].forEach((element) => element.classList.add("hidden"));
        screen.classList.remove("hidden");
    }


    // ------------------------------------------------------------
    // 05B. Updating the animal menu
    // ------------------------------------------------------------

    // Visually mark the chosen animal and update the sound button.
    function refreshMenu() {
        document.querySelectorAll(".animal-card").forEach((card) => {
            const chosen = card.dataset.animal === selected;

            card.classList.toggle("selected", chosen);
            card.setAttribute("aria-checked", String(chosen));
        });

        $("soundButton").textContent = soundOn ? "🔊" : "🔇";
    }


    // ------------------------------------------------------------
    // 05C. Temporary messages during the race
    // ------------------------------------------------------------

    // Show a message such as "Fruit boost!" for 800 milliseconds.
    function message(text) {
        const bubble = $("messageBubble");

        bubble.textContent = text;
        bubble.classList.remove("hidden");

        // Cancel an existing message timer so messages do not clash.
        clearTimeout(message.timer);

        message.timer = setTimeout(() => bubble.classList.add("hidden"), 800);
    }


    // ============================================================
    // 06. SOUND EFFECTS
    // ============================================================

    // Create a short electronic tone.
    //
    // freq     = pitch in Hertz
    // duration = length of the sound in seconds
    // delay    = how long to wait before playing it
    function beep(freq, duration = 0.09, delay = 0) {
        if (!soundOn) return;

        // Different browsers use one of these two names.
        const Audio = window.AudioContext || window.webkitAudioContext;

        // Do nothing if the browser does not support generated audio.
        if (!Audio) return;

        // Create the audio context the first time it is needed.
        audio ||= new Audio();

        // Browsers sometimes suspend audio until the user interacts.
        if (audio.state === "suspended") {
            audio.resume();
        }

        // The oscillator creates the tone.
        const oscillator = audio.createOscillator();

        // The gain controls its volume.
        const gain = audio.createGain();

        const start = audio.currentTime + delay;

        oscillator.type = "triangle";
        oscillator.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.055, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

        oscillator.connect(gain);
        gain.connect(audio.destination);

        oscillator.start(start);
        oscillator.stop(start + duration);
    }


    // ============================================================
    // 07. BUILDING A NEW RACE
    // ============================================================

    // ------------------------------------------------------------
    // 07A. Fruit and mud course
    // ------------------------------------------------------------

    // Create all fruit and muddy puddles for a race.
    function makeCourse() {
        const fruits = ["🍓", "🍌", "🍊", "🍇", "🍏"];
        const items = [];

        // Start at distance 80 and add an item every 48 course units.
        for (let distance = 80, itemNumber = 0; distance < finish - 30; distance += 48, itemNumber += 1) {
            // Every fourth item pattern contains a muddy puddle.
            const mud = itemNumber % 4 === 2;

            items.push({
                d: distance,

                // Spread the items between the three lanes.
                lane: (itemNumber * 2 + Math.floor(itemNumber / 3)) % 3,

                // Each item is either fruit or mud.
                kind: mud ? "mud" : "fruit",

                // Mud does not use this icon, but fruit does.
                icon: fruits[itemNumber % fruits.length],

                // Once collected or hit, an item is marked as used.
                used: false
            });
        }

        return items;
    }


    // ------------------------------------------------------------
    // 07B. Initial race state
    // ------------------------------------------------------------

    // Create a completely new race.
    function newGame() {
        // Use the three animals not selected by the player as opponents.
        //
        // Their order is shuffled so they do not always start in the
        // same lanes.
        const others = Object.keys(names)
            .filter((key) => key !== selected)
            .sort(() => Math.random() - 0.5);

        return {
            // The game begins with the countdown.
            phase: "countdown",

            // Exact browser time when the race begins.
            start: 0,

            // Number of seconds since the race started.
            elapsed: 0,

            // The part of the course currently visible.
            camera: 0,

            player: {
                // Current lane number.
                lane: 1,

                // Lane the player is moving towards.
                target: 1,

                // Current horizontal canvas position.
                x: lanes[1],

                // Distance travelled along the course.
                d: 0,

                // Current height above the ground.
                jump: 0,

                // Vertical jumping velocity.
                vy: 0,

                // Normal forward speed.
                speed: 34,

                // Seconds of fruit boost remaining.
                boost: 0,

                // Seconds of mud slowdown remaining.
                slow: 0,

                // Fruit collected in this race.
                fruit: 0
            },

            // Create the three computer-controlled opponents.
            opponents: others.map((type, index) => ({
                type,

                // Each opponent starts in a different lane.
                lane: index,

                // Stagger their starting positions slightly.
                d: -8 - index * 7,

                // Give each opponent a slightly different random speed.
                speed: 32.4 + Math.random() * 3.2,

                // This is recorded when the opponent finishes.
                finishTime: 0
            })),

            // Add fruit and mud to the course.
            items: makeCourse(),

            // Prevents the race from finishing more than once.
            finished: false
        };
    }


    // ============================================================
    // 08. STARTING AND RUNNING THE RACE
    // ============================================================

    // ------------------------------------------------------------
    // 08A. Countdown and animation loop
    // ------------------------------------------------------------

    async function startRace() {
        // Stop any previous animation loop.
        cancelAnimationFrame(frame);

        // Create a fresh race.
        game = newGame();

        // Display the racing screen.
        show($("gameScreen"));

        // Draw the starting state immediately.
        updateHud();
        draw();

        const countdown = $("countdown");

        countdown.classList.remove("hidden");

        // Display 3, 2 and 1.
        for (const text of ["3", "2", "1"]) {
            countdown.textContent = text;
            beep(430);
            await wait(620);
        }

        // Display GO and play a two-tone starting sound.
        countdown.textContent = "GO!";

        beep(680, 0.12);
        beep(900, 0.15, 0.1);

        // The update loop will now move the racers.
        game.phase = "racing";
        game.start = performance.now();

        await wait(450);

        countdown.classList.add("hidden");

        // Remember when the previous frame was drawn.
        let last = performance.now();

        // This function runs repeatedly, usually around 60 times per second.
        const loop = (now) => {
            // Convert milliseconds into seconds.
            //
            // Limit unusually large time gaps to 0.04 seconds so the
            // game does not suddenly jump forward after a browser pause.
            const dt = Math.min((now - last) / 1000, 0.04);

            last = now;

            // Change the game state.
            if (game && game.phase === "racing") {
                update(dt);
            }

            // Redraw the whole canvas.
            draw();

            // Ask the browser to run this function again on the next frame.
            if (game && !game.finished) {
                frame = requestAnimationFrame(loop);
            }
        };

        frame = requestAnimationFrame(loop);
    }


    // ------------------------------------------------------------
    // 08B. Updating movement and collisions
    // ------------------------------------------------------------

    // Update the race by one animation step.
    //
    // dt is the amount of time since the previous frame.
    function update(dt) {
        const player = game.player;

        // Calculate the race time.
        game.elapsed = (performance.now() - game.start) / 1000;

        // Reduce temporary boost and slowdown timers.
        player.boost = Math.max(0, player.boost - dt);
        player.slow = Math.max(0, player.slow - dt);

        // Smoothly slide the player towards the chosen lane.
        player.x += (lanes[player.target] - player.x) * Math.min(1, dt * 11);


        // --------------------------------------------------------
        // 08B-1. Jumping
        // --------------------------------------------------------

        // Continue updating a jump while the player is above the
        // ground or still has upward velocity.
        if (player.jump > 0 || player.vy > 0) {
            // Move according to the current vertical velocity.
            player.jump += player.vy * dt;

            // Gravity reduces upward velocity and eventually pulls
            // the animal down.
            player.vy -= 1020 * dt;

            // Stop exactly at ground level.
            if (player.jump <= 0) {
                player.jump = 0;
                player.vy = 0;
            }
        }


        // --------------------------------------------------------
        // 08B-2. Player forward movement
        // --------------------------------------------------------

        // Fruit makes the player 1.34 times faster.
        //
        // Mud reduces the player's speed to 0.58 of normal.
        const speed = player.speed * (player.boost > 0 ? 1.34 : 1) * (player.slow > 0 ? 0.58 : 1);

        // Move the player along the course.
        player.d += speed * dt;

        // Keep the player towards the bottom of the visible course
        // by moving the virtual camera behind them.
        game.camera = Math.max(0, player.d - 90);


        // --------------------------------------------------------
        // 08B-3. Computer-controlled racers
        // --------------------------------------------------------

        game.opponents.forEach((opponent, index) => {
            // Stop moving this opponent once it has finished.
            if (opponent.d >= finish) return;

            // Add a small changing wobble to make their speed less robotic.
            const wobble = Math.sin(game.elapsed * 1.1 + index * 2.2) * 0.9;

            opponent.d += (opponent.speed + wobble) * dt;

            // Record the time when an opponent crosses the finish.
            if (opponent.d >= finish && !opponent.finishTime) {
                opponent.finishTime = game.elapsed;
            }
        });


        // --------------------------------------------------------
        // 08B-4. Fruit and mud collisions
        // --------------------------------------------------------

        game.items.forEach((item) => {
            // Ignore:
            //
            //   - items already collected or hit;
            //   - items in another lane;
            //   - items too far away from the player.
            if (item.used || item.lane !== player.target || Math.abs(item.d - player.d) > 10) return;

            if (item.kind === "fruit") {
                item.used = true;

                player.fruit += 1;
                player.boost = 1.2;

                beep(760);
                beep(980, 0.11, 0.06);

                message("Fruit boost! ⚡");
            } else if (player.jump < 18) {
                // The player only hits the mud when not jumping high enough.
                item.used = true;

                player.slow = 1.1;

                beep(130, 0.2);

                message("Splish splash! 💦");
            }
        });


        // --------------------------------------------------------
        // 08B-5. Display and finish checks
        // --------------------------------------------------------

        updateHud();

        if (player.d >= finish) {
            finishRace();
        }
    }


    // ============================================================
    // 09. POSITION, SCORE AND RESULTS
    // ============================================================

    // ------------------------------------------------------------
    // 09A. Current race position
    // ------------------------------------------------------------

    // Count how many opponents are currently ahead of the player.
    function currentPlace() {
        return 1 + game.opponents.filter((opponent) => opponent.d > game.player.d).length;
    }


    // ------------------------------------------------------------
    // 09B. Heads-up display
    // ------------------------------------------------------------

    // Update the information shown above the canvas.
    function updateHud() {
        if (!game) return;

        $("placeValue").textContent = ordinal(currentPlace());
        $("fruitValue").textContent = game.player.fruit;

        // Convert progress into a percentage between 0 and 100.
        $("progressFill").style.width = `${Math.min(100, game.player.d / finish * 100)}%`;

        $("bestTimeValue").textContent = bestTime() ? `${bestTime().toFixed(1)}s` : "—";
    }


    // ------------------------------------------------------------
    // 09C. Finishing the race
    // ------------------------------------------------------------

    function finishRace() {
        // Do nothing if this function has already run.
        if (game.finished) return;

        game.finished = true;
        game.phase = "finished";

        const time = game.elapsed;
        const place = currentPlace();
        const oldBest = bestTime();

        // It is a new best if:
        //
        //   - there is no previous best; or
        //   - this race was faster.
        const newBest = !oldBest || time < oldBest;

        if (newBest) {
            localStorage.setItem(bestKey(), String(time));
        }

        // Unlock the party hat by finishing first or collecting six fruit.
        if (!hat && (place === 1 || game.player.fruit >= 6)) {
            hat = true;
            localStorage.setItem("animalDashPartyHat", "yes");
        }

        // Play a short victory tune.
        [523, 659, 784, 1047].forEach((note, index) => beep(note, 0.28, index * 0.11));

        // Wait briefly before showing the results.
        setTimeout(() => showResults(place, time, newBest), 450);
    }


    // ------------------------------------------------------------
    // 09D. Results screen
    // ------------------------------------------------------------

    function showResults(place, time, newBest) {
        show($("resultsScreen"));

        $("resultHeading").textContent = place === 1 ? "You won the race!" : "Brilliant racing!";

        $("resultText").textContent = `${names[selected]} zoomed over the finish line${newBest ? " with a new best time!" : "!"}`;

        $("resultPlace").textContent = ordinal(place);
        $("resultTime").textContent = `${time.toFixed(1)}s`;
        $("resultFruit").textContent = game.player.fruit;

        // Apply the selected animal's CSS class.
        $("resultAnimal").className = `result-animal ${selected}`;
        $("resultAnimal").innerHTML = "<span></span>";

        $("unlockMessage").textContent = hat
            ? "🎉 Party hat unlocked for your next race!"
            : "Collect six fruit or finish first to unlock a party hat.";

        $("unlockMessage").classList.remove("hidden");

        confetti();
    }


    // ------------------------------------------------------------
    // 09E. Confetti
    // ------------------------------------------------------------

    function confetti() {
        const box = $("resultConfetti");

        // Remove confetti from any previous result.
        box.innerHTML = "";

        // Create 45 small coloured HTML elements.
        for (let i = 0; i < 45; i += 1) {
            const bit = document.createElement("i");

            bit.style.left = `${Math.random() * 100}%`;
            bit.style.background = ["#6c63ff", "#ffd65a", "#ff83b1", "#50c878"][i % 4];
            bit.style.animationDelay = `${Math.random() * 0.7}s`;
            bit.style.setProperty("--drift", `${Math.random() * 160 - 80}px`);

            box.appendChild(bit);
        }
    }


    // ============================================================
    // 10. PLAYER CONTROLS
    // ============================================================

    // ------------------------------------------------------------
    // 10A. Changing lanes
    // ------------------------------------------------------------

    // dir will be:
    //
    // -1 to move left
    //  1 to move right
    function move(dir) {
        if (game?.phase !== "racing") return;

        // Keep the target lane between 0 and 2.
        game.player.target = Math.max(0, Math.min(2, game.player.target + dir));
    }


    // ------------------------------------------------------------
    // 10B. Jumping
    // ------------------------------------------------------------

    function jump() {
        // Only jump during a race and only when on the ground.
        if (game?.phase !== "racing" || game.player.jump > 1) return;

        // Give the animal upward velocity.
        game.player.vy = 490;

        beep(360, 0.14);
    }


    // ============================================================
    // 11. DRAWING HELPERS
    // ============================================================

    // ------------------------------------------------------------
    // 11A. Course distance to screen position
    // ------------------------------------------------------------

    // Convert a distance along the course into a vertical canvas
    // coordinate.
    //
    // As the camera moves forward, course objects move down the screen.
    function sy(distance) {
        return 420 - (distance - game.camera) * 3.2;
    }


    // ------------------------------------------------------------
    // 11B. Rounded rectangle path
    // ------------------------------------------------------------

    // Create a rounded rectangle path.
    //
    // Another command such as ctx.fill() must then colour it.
    function rounded(x, y, width, height, radius) {
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, radius);
    }


    // ============================================================
    // 12. DRAWING THE GAME
    // ============================================================

    // ------------------------------------------------------------
    // 12A. Sky, grass and clouds
    // ------------------------------------------------------------

    function drawBackground() {
        // Create one vertical gradient containing both sky and grass.
        const sky = ctx.createLinearGradient(0, 0, 0, H);

        sky.addColorStop(0, "#86dcff");
        sky.addColorStop(0.55, "#dff8ff");
        sky.addColorStop(0.56, "#8dd86f");
        sky.addColorStop(1, "#5cad55");

        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, H);

        // Draw simple looping clouds.
        ctx.fillStyle = "rgba(255,255,255,.86)";

        for (let i = 0; i < 5; i += 1) {
            // The camera value moves the clouds sideways slowly.
            const x = 80 + i * 210 - ((game?.camera || 0) * 0.7 % 210);
            const y = 80 + (i % 2) * 28;

            ctx.beginPath();
            ctx.arc(x, y, 30, 0, Math.PI * 2);
            ctx.fill();

            ctx.beginPath();
            ctx.arc(x + 34, y + 3, 22, 0, Math.PI * 2);
            ctx.fill();
        }
    }


    // ------------------------------------------------------------
    // 12B. Road
    // ------------------------------------------------------------

    function drawRoad() {
        // Main road surface.
        ctx.fillStyle = "#555b69";
        ctx.fillRect(245, 0, 470, H);

        // Dashed lines between lanes.
        ctx.strokeStyle = "rgba(255,255,255,.75)";
        ctx.lineWidth = 6;
        ctx.setLineDash([26, 25]);

        // Moving the dash offset creates the illusion of forward motion.
        ctx.lineDashOffset = (game?.camera || 0) * 3.2;

        [402, 558].forEach((x) => {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, H);
            ctx.stroke();
        });

        // Return to solid lines.
        ctx.setLineDash([]);

        // Yellow road-edge lines.
        ctx.strokeStyle = "#fff2a0";
        ctx.lineWidth = 7;

        [249, 711].forEach((x) => {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, H);
            ctx.stroke();
        });
    }


    // ------------------------------------------------------------
    // 12C. Trees and scenery
    // ------------------------------------------------------------
    //
    // THIS IS THE SECTION WE WILL CHANGE NEXT.
    //
    // At present the trees use the same course-to-screen conversion
    // as fruit and mud. They loop every 1,200 course units.
    //
    // The current calculation allows trees to appear above the
    // grass horizon, which is why they can look as though they are
    // descending from the sky.
    // ------------------------------------------------------------

    function drawScenery() {
        for (let i = 0; i < 14; i += 1) {
            // Give each tree a repeating course position.
            const distance = i * 86;

            // Loop the tree position around a course of length 1,200.
            const repeatingDistance = ((distance - (game?.camera || 0)) % 1200 + 1200) % 1200 + (game?.camera || 0);

            // Convert that course position into a screen position.
            const y = sy(repeatingDistance);

            // Do not draw trees that are far outside the canvas.
            if (y < -80 || y > H + 80) continue;

            // Alternate trees between the left and right sides.
            const x = i % 2 ? 790 + (i % 3) * 35 : 170 - (i % 3) * 35;

            // Draw the trunk.
            ctx.fillStyle = "#805b3c";
            ctx.fillRect(x - 8, y, 16, 44);

            // Draw the leaves.
            ctx.fillStyle = i % 3 ? "#45ad55" : "#66c95e";

            ctx.beginPath();
            ctx.arc(x, y - 12, 31, 0, Math.PI * 2);
            ctx.fill();
        }
    }


    // ------------------------------------------------------------
    // 12D. Fruit and muddy puddles
    // ------------------------------------------------------------

    function drawItems() {
        game.items.forEach((item) => {
            // Do not draw an item after it has been collected or hit.
            if (item.used) return;

            const y = sy(item.d);

            // Ignore items well outside the visible canvas.
            if (y < -60 || y > H + 60) return;

            const x = lanes[item.lane];

            if (item.kind === "fruit") {
                // Draw fruit using an emoji.
                ctx.font = "40px system-ui";
                ctx.textAlign = "center";
                ctx.fillText(item.icon, x, y + 12);
            } else {
                // Draw the main muddy puddle.
                ctx.fillStyle = "#6b4939";

                ctx.beginPath();
                ctx.ellipse(x, y + 8, 52, 20, 0, 0, Math.PI * 2);
                ctx.fill();

                // Add a lighter patch to the mud.
                ctx.fillStyle = "#9b7054";

                ctx.beginPath();
                ctx.ellipse(x - 10, y + 3, 20, 6, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    }


    // ------------------------------------------------------------
    // 12E. Finish line
    // ------------------------------------------------------------

    function drawFinish() {
        const y = sy(finish);

        // Do not draw the finish line until it is near the screen.
        if (y < -80 || y > H + 80) return;

        // Draw two rows of alternating black and white squares.
        for (let row = 0; row < 2; row += 1) {
            for (let column = 0; column < 20; column += 1) {
                ctx.fillStyle = (row + column) % 2 ? "#222" : "#fff";
                ctx.fillRect(245 + column * 24, y + row * 24, 24, 24);
            }
        }
    }


    // ------------------------------------------------------------
    // 12F. One animal racer
    // ------------------------------------------------------------

    function drawRacer(x, y, type, player = false, jumpHeight = 0) {
        // Save the current drawing settings.
        ctx.save();

        if (player) {
            // Draw a shadow below the player's animal.
            ctx.fillStyle = "rgba(0,0,0,.2)";

            ctx.beginPath();
            ctx.ellipse(x, y + jumpHeight + 34, 34, 10, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // Move the drawing origin to the racer's position.
        ctx.translate(x, y);

        // Draw the coloured rounded background.
        ctx.fillStyle = colours[type];

        rounded(-40, -42, 80, 84, 28);
        ctx.fill();

        // Draw the animal emoji.
        ctx.font = type === "crocodile" ? "58px system-ui" : "64px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(emoji[type], 0, 0);

        if (player) {
            // Add a white marker and star above the player's animal.
            ctx.fillStyle = "white";
            ctx.strokeStyle = "#6c63ff";
            ctx.lineWidth = 4;

            ctx.beginPath();
            ctx.arc(0, -60, 16, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = "#6c63ff";
            ctx.font = "18px system-ui";
            ctx.fillText("★", 0, -60);

            // Display the unlocked party hat.
            if (hat) {
                ctx.font = "35px system-ui";
                ctx.fillText("🥳", 0, -53);
            }
        }

        // Restore the drawing settings that existed before this racer.
        ctx.restore();
    }


    // ------------------------------------------------------------
    // 12G. All racers
    // ------------------------------------------------------------

    function drawRacers() {
        // Convert opponents into objects containing screen positions.
        const racers = game.opponents.map((opponent, index) => ({
            // Move close opponents slightly sideways so animals do not
            // sit exactly on top of one another.
            x: lanes[opponent.lane] + (Math.abs(opponent.d - game.player.d) < 18 ? (index % 2 ? 30 : -30) : 0),

            y: sy(opponent.d),
            type: opponent.type,
            player: false
        }));

        // Add the player's racer.
        racers.push({
            x: game.player.x,
            y: 420 - game.player.jump,
            type: selected,
            player: true,
            jump: game.player.jump
        });

        // Draw racers from the top of the screen downwards.
        //
        // This gives a basic sense of depth when animals overlap.
        racers
            .sort((a, b) => a.y - b.y)
            .forEach((racer) => {
                if (racer.y > -90 && racer.y < H + 90) {
                    drawRacer(racer.x, racer.y, racer.type, racer.player, racer.jump || 0);
                }
            });
    }


    // ------------------------------------------------------------
    // 12H. Complete canvas redraw
    // ------------------------------------------------------------

    // The canvas does not remember separate objects.
    //
    // On every animation frame, the game clears the canvas and draws
    // every visible part again in this order.
    function draw() {
        ctx.clearRect(0, 0, W, H);

        drawBackground();
        drawScenery();
        drawRoad();

        // The menu initially draws a background preview without an
        // active game, so stop here when game is null.
        if (!game) return;

        drawFinish();
        drawItems();
        drawRacers();
    }


    // ============================================================
    // 13. BUTTON AND KEYBOARD EVENTS
    // ============================================================

    // ------------------------------------------------------------
    // 13A. Animal selection
    // ------------------------------------------------------------

    document.querySelectorAll(".animal-card").forEach((card) => {
        card.addEventListener("click", () => {
            selected = card.dataset.animal;

            localStorage.setItem("animalDashAnimal", selected);

            refreshMenu();
            beep(620);
        });
    });


    // ------------------------------------------------------------
    // 13B. Menu and results buttons
    // ------------------------------------------------------------

    $("startButton").addEventListener("click", startRace);

    $("raceAgainButton").addEventListener("click", startRace);

    $("chooseAgainButton").addEventListener("click", () => {
        cancelAnimationFrame(frame);

        game = null;

        show($("menuScreen"));
    });


    // ------------------------------------------------------------
    // 13C. Touch controls
    // ------------------------------------------------------------

    $("leftButton").addEventListener("pointerdown", (event) => {
        event.preventDefault();
        move(-1);
    });

    $("rightButton").addEventListener("pointerdown", (event) => {
        event.preventDefault();
        move(1);
    });

    $("jumpButton").addEventListener("pointerdown", (event) => {
        event.preventDefault();
        jump();
    });


    // ------------------------------------------------------------
    // 13D. Sound button
    // ------------------------------------------------------------

    $("soundButton").addEventListener("click", () => {
        soundOn = !soundOn;

        localStorage.setItem("animalDashSound", soundOn ? "on" : "off");

        refreshMenu();

        if (soundOn) {
            beep(800);
        }
    });


    // ------------------------------------------------------------
    // 13E. Keyboard controls
    // ------------------------------------------------------------

    window.addEventListener("keydown", (event) => {
        // Prevent arrow keys and Space from scrolling the web page.
        if (["ArrowLeft", "ArrowRight", " "].includes(event.key)) {
            event.preventDefault();
        }

        // Ignore a key being held down.
        if (event.repeat) return;

        if (event.key === "ArrowLeft") {
            move(-1);
        }

        if (event.key === "ArrowRight") {
            move(1);
        }

        if (event.key === " ") {
            jump();
        }
    }, { passive: false });


    // ============================================================
    // 14. INITIAL PAGE SETUP
    // ============================================================

    // Mark the saved animal as selected and show the sound setting.
    refreshMenu();

    // Create a temporary game solely to draw a background preview
    // behind the initial menu.
    game = newGame();
    game.camera = 30;

    draw();

    // There is no active race yet.
    game = null;


    // ============================================================
    // 15. OFFLINE SUPPORT
    // ============================================================

    // Register the service worker when the game is hosted online.
    //
    // Do not attempt this when index.html is opened directly as a
    // local file because service workers require a web server.
    if ("serviceWorker" in navigator && location.protocol !== "file:") {
        window.addEventListener("load", () => {
            navigator.serviceWorker.register("./sw.js").catch(() => {
                // The game still works online even if offline support
                // cannot be registered.
            });
        });
    }
})();

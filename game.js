import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

// ==========================================================================
// ⚙️ GŁÓWNA KONFIGURACJA
// ==========================================================================
const ENABLE_BONUSES = true;

const BONUS_PLAYLISTS = {
    'pl': ["wzb0uolNv5c", "Oq69T6tT79c", "wzb0uolNv5c"],
    'en': ["_WnwvI8EKDw", "7D4K9oi7oBM", "_WnwvI8EKDw"],
    'de': ["J3i56A55aC4", "J3i56A55aC4", "J3i56A55aC4"],
    'fr': ["d8x2aQJgXb4", "d8x2aQJgXb4", "d8x2aQJgXb4"]
};

const LEVEL_CONFIG = [
    { mode: 'range', min: 1, max: 5 },
    { mode: 'range', min: 6, max: 9 },
    { mode: 'range', min: 10, max: 15 },
    { mode: 'list', numbers: [10, 20, 30, 40] },
    { mode: 'list', numbers: [2, 4, 6, 8, 10, 12] },
    { mode: 'range', min: 20, max: 30 }
];

const SCENE_SIZE = 18;
const PACMAN_SPEED = 0.15;
const SAFE_SPAWN_DISTANCE = 5.0;
const MIN_NUMBER_SPACING = 2.5;

// ==========================================================================
// 🎮 ZMIENNE GLOBALNE
// ==========================================================================

let scene, camera, renderer, font;
let pacman;
const numbersOnBoard = [];
const keys = { w: false, a: false, s: false, d: false };

// ZMIENNE YOUTUBE
let ytPlayer = null;
let isPlayerReady = false;

const gameState = {
    active: false,
    bonusActive: false,
    levelIndex: 0,
    objectives: [],
    currentObjIndex: 0,
    lives: 5,
    lang: 'pl',
    hintsEnabled: true
};

const getCurrentTarget = () => gameState.objectives[gameState.currentObjIndex];

// ==========================================================================
// 🛠️ INICJALIZACJA YOUTUBE (Metoda Wstrzykiwania)
// ==========================================================================

function loadYouTubeAPI() {
    // 1. Definiujemy funkcję callback ZANIM załadujemy skrypt
    window.onYouTubeIframeAPIReady = function() {
        console.log("✅ YouTube API załadowane. Tworzę odtwarzacz...");
        ytPlayer = new YT.Player('player', {
            height: '100%',
            width: '100%',
            videoId: 'wzb0uolNv5c', // Placeholder na start
            playerVars: {
                'autoplay': 0,
                'controls': 0,
                'rel': 0,
                'origin': window.location.origin
            },
            events: {
                'onReady': () => {
                    console.log("✅ Odtwarzacz YouTube gotowy do akcji!");
                    isPlayerReady = true;
                },
                'onError': (e) => { console.error("❌ Błąd playera:", e); }
            }
        });
    };

    // 2. Wstrzykujemy skrypt YouTube do HTML
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}


// ==========================================================================
// 🎮 INICJALIZACJA GRY (THREE.JS)
// ==========================================================================
function init() {
    // Najpierw ładujemy YouTube
    loadYouTubeAPI();

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x202025);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 14, 14);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.shadowMap.enabled = true;
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(8, 12, 8);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const floorGeometry = new THREE.PlaneGeometry(SCENE_SIZE, SCENE_SIZE);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x444444, side: THREE.DoubleSide });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const gridHelper = new THREE.GridHelper(SCENE_SIZE, SCENE_SIZE / 2, 0x000000, 0x555555);
    scene.add(gridHelper);

    const loader = new FontLoader();
    loader.load('https://threejs.org/examples/fonts/helvetiker_bold.typeface.json', (loadedFont) => {
        font = loadedFont;
    });

    window.addEventListener('keydown', (e) => {
        if(gameState.bonusActive) return;
        handleInput(e.code, true);
        if (e.code === 'KeyH') {
            gameState.hintsEnabled = !gameState.hintsEnabled;
            highlightTarget();
            showFeedback(gameState.hintsEnabled ? "HINTS: ON" : "HINTS: OFF", gameState.hintsEnabled ? '#0f0' : '#aaa');
        }
    });

    window.addEventListener('keyup', (e) => {
        handleInput(e.code, false);
    });
}

function handleInput(code, isPressed) {
    if (code === 'KeyW' || code === 'ArrowUp') keys.w = isPressed;
    if (code === 'KeyS' || code === 'ArrowDown') keys.s = isPressed;
    if (code === 'KeyA' || code === 'ArrowLeft') keys.a = isPressed;
    if (code === 'KeyD' || code === 'ArrowRight') keys.d = isPressed;
}

// --- KLASA PACMANA ---
class Pacman {
    constructor() {
        this.radius = 0.6;
        this.pivot = new THREE.Group();
        this.pivot.position.y = this.radius + 0.2;
        scene.add(this.pivot);
        this.body = new THREE.Group();
        this.pivot.add(this.body);

        const skinMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.2, metalness: 0.1 });
        const insideMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const innerGeo = new THREE.SphereGeometry(this.radius * 0.95, 32, 32);
        this.innerMesh = new THREE.Mesh(innerGeo, insideMat);
        this.body.add(this.innerMesh);

        const hemisphereGeo = new THREE.SphereGeometry(this.radius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        this.topJaw = new THREE.Group();
        this.body.add(this.topJaw);
        const topMesh = new THREE.Mesh(hemisphereGeo, skinMat);
        this.topJaw.add(topMesh);

        this.bottomJaw = new THREE.Group();
        this.body.add(this.bottomJaw);
        const bottomMesh = new THREE.Mesh(hemisphereGeo, skinMat);
        bottomMesh.rotation.x = Math.PI;
        this.bottomJaw.add(bottomMesh);

        const eyeWhiteGeo = new THREE.SphereGeometry(0.12, 16, 16);
        const eyePupilGeo = new THREE.SphereGeometry(0.05, 16, 16);
        const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const blackMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

        const createEye = (x, y, z) => {
            const eyeGroup = new THREE.Group();
            eyeGroup.position.set(x, y, z);
            const white = new THREE.Mesh(eyeWhiteGeo, whiteMat);
            eyeGroup.add(white);
            const pupil = new THREE.Mesh(eyePupilGeo, blackMat);
            pupil.position.z = 0.1;
            pupil.position.y = 0.02;
            eyeGroup.add(pupil);
            return eyeGroup;
        };

        this.leftEye = createEye(0.25, 0.35, 0.35);
        this.leftEye.lookAt(0, 0.35, 2);
        this.topJaw.add(this.leftEye);

        this.rightEye = createEye(-0.25, 0.35, 0.35);
        this.rightEye.lookAt(0, 0.35, 2);
        this.topJaw.add(this.rightEye);

        this.velocity = { x: 0, z: 0 };
        this.mouthTimer = 0;
    }

    update() {
        this.velocity.x = 0;
        this.velocity.z = 0;

        if (keys.w) this.velocity.z = -PACMAN_SPEED;
        if (keys.s) this.velocity.z = PACMAN_SPEED;
        if (keys.a) this.velocity.x = -PACMAN_SPEED;
        if (keys.d) this.velocity.x = PACMAN_SPEED;

        this.pivot.position.x += this.velocity.x;
        this.pivot.position.z += this.velocity.z;

        const boundary = SCENE_SIZE / 2 - 0.6;
        this.pivot.position.x = Math.max(-boundary, Math.min(boundary, this.pivot.position.x));
        this.pivot.position.z = Math.max(-boundary, Math.min(boundary, this.pivot.position.z));

        if (this.velocity.x !== 0 || this.velocity.z !== 0) {
            const angle = Math.atan2(this.velocity.x, this.velocity.z);
            this.body.rotation.y = angle;
            this.mouthTimer += 0.25;
            const openAmount = (Math.sin(this.mouthTimer) + 1) * 0.3;
            this.topJaw.rotation.x = -openAmount;
            this.bottomJaw.rotation.x = openAmount;
        } else {
            this.topJaw.rotation.x = -0.1;
            this.bottomJaw.rotation.x = 0.1;
        }
    }
}

// --- KLASA CYFERKI ---
class NumberObj {
    constructor(value) {
        this.value = value;
        const geometry = new TextGeometry(value.toString(), {
            font: font, size: 0.7, height: 0.2, curveSegments: 8,
        });
        geometry.center();
        this.material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        this.mesh = new THREE.Mesh(geometry, this.material);
        this.mesh.castShadow = true;
        this.mesh.position.y = 0.8;
        this.mesh.rotation.x = -Math.PI / 5;
        this.respawn();
        scene.add(this.mesh);
    }

    respawn() {
        let isValid = false;
        let attempts = 0;
        while (!isValid && attempts < 100) {
            const x = (Math.random() - 0.5) * (SCENE_SIZE - 4);
            const z = (Math.random() - 0.5) * (SCENE_SIZE - 4);
            let safe = true;
            if (pacman && pacman.pivot) {
                const dx = pacman.pivot.position.x - x;
                const dz = pacman.pivot.position.z - z;
                if (Math.sqrt(dx*dx + dz*dz) < SAFE_SPAWN_DISTANCE) safe = false;
            }
            if (safe) {
                for (const other of numbersOnBoard) {
                    if (other === this) continue;
                    const dx = other.mesh.position.x - x;
                    const dz = other.mesh.position.z - z;
                    if (Math.sqrt(dx*dx + dz*dz) < MIN_NUMBER_SPACING) {
                        safe = false;
                        break;
                    }
                }
            }
            if (safe) {
                this.mesh.position.x = x;
                this.mesh.position.z = z;
                isValid = true;
            }
            attempts++;
        }
        if (!isValid) {
            this.mesh.position.x = (Math.random() - 0.5) * (SCENE_SIZE - 2);
            this.mesh.position.z = (Math.random() - 0.5) * (SCENE_SIZE - 2);
        }
    }

    makeGreen() { this.material.color.set(0x00ff00); this.material.emissive.set(0x004400); }
    makeRed() { this.material.color.set(0xff0000); this.material.emissive.set(0x000000); }
}

// --- LOGIKA GRY ---

window.addEventListener('init-game', (e) => {
    if(!font) return;
    gameState.lang = e.detail.lang;
    gameState.lives = 5;
    gameState.levelIndex = 0;
    gameState.active = true;
    gameState.hintsEnabled = true;
    document.getElementById('overlay').style.display = 'none';
    document.getElementById('hud').style.display = 'flex';
    updateHud();
    if (!pacman) pacman = new Pacman();
    else {
        pacman.pivot.position.set(0, pacman.radius + 0.2, 0);
        pacman.pivot.rotation.set(0,0,0);
    }
    startLevel(0);
    animate();
});

function startLevel(idx) {
    gameState.levelIndex = idx;
    if (idx >= LEVEL_CONFIG.length) {
        alert("FINITO! KONIEC!");
        location.reload();
        return;
    }
    numbersOnBoard.forEach(n => scene.remove(n.mesh));
    numbersOnBoard.length = 0;
    const config = LEVEL_CONFIG[idx];
    gameState.objectives = [];
    if (config.mode === 'range') {
        for (let i = config.min; i <= config.max; i++) {
            gameState.objectives.push(i);
        }
    } else if (config.mode === 'list') {
        gameState.objectives = [...config.numbers];
    }
    gameState.currentObjIndex = 0;
    gameState.objectives.forEach(val => {
        const num = new NumberObj(val);
        numbersOnBoard.push(num);
    });
    highlightTarget();
    updateHud();
}

function highlightTarget() {
    const targetVal = getCurrentTarget();
    numbersOnBoard.forEach(n => {
        if (n.value === targetVal && gameState.hintsEnabled) n.makeGreen();
        else n.makeRed();
    });
    const targetDisp = document.getElementById('target-disp');
    if(targetDisp) targetDisp.style.color = gameState.hintsEnabled ? '#0f0' : '#fff';
}

function checkCollisions() {
    if (!gameState.active || gameState.bonusActive) return;
    for (let i = 0; i < numbersOnBoard.length; i++) {
        const numObj = numbersOnBoard[i];
        const dist = pacman.pivot.position.distanceTo(numObj.mesh.position);
        if (dist < 1.2) {
            handleCollision(numObj, i);
            break;
        }
    }
}

function handleCollision(numObj, index) {
    const targetVal = getCurrentTarget();

    if (numObj.value === targetVal) {
        playSound(numObj.value);
        scene.remove(numObj.mesh);
        numbersOnBoard.splice(index, 1);
        gameState.currentObjIndex++;

        if (gameState.currentObjIndex >= gameState.objectives.length) {

            // BONUS TRIGGER
            if (ENABLE_BONUSES) {
                triggerBonus();
            } else {
                showFeedback("POZIOM UKOŃCZONY!", "#0f0");
                setTimeout(() => startLevel(gameState.levelIndex + 1), 2000);
            }

        } else {
            highlightTarget();
        }
    }
    else {
        playSound('wrong');
        gameState.lives--;
        numObj.respawn();
        let errorMsg = "ERROR";
        const isSmall = numObj.value < 10;
        if (gameState.lang === 'pl') errorMsg = isSmall ? "ZŁA CYFRA!" : "ZŁA LICZBA!";
        else if (gameState.lang === 'en') errorMsg = "WRONG NUMBER!";
        else if (gameState.lang === 'de') errorMsg = "FALSCHE ZAHL!";
        else if (gameState.lang === 'fr') errorMsg = isSmall ? "MAUVAIS CHIFFRE!" : "MAUVAIS NUMÉRO!";
        showFeedback(errorMsg, "#f00");
        if (gameState.lives <= 0) gameOver();
    }
    updateHud();
}

// --- FUNKCJA WYZWALAJĄCA BONUS ---
function triggerBonus() {
    gameState.bonusActive = true;
    gameState.active = false;

    // 1. MECHANIZM RETRY - Czekaj jeśli player nie jest gotowy
    if (!ytPlayer || !isPlayerReady || typeof ytPlayer.loadVideoById !== 'function') {
        console.warn("YouTube Player jeszcze nie gotowy... próbuję ponownie za 0.5s");

        // Pokaż komunikat o ładowaniu
        document.getElementById('bonus-layer').style.display = 'flex';
        document.getElementById('bonus-text').innerText = "ŁADOWANIE...";

        setTimeout(triggerBonus, 500); // REKURENCJA (Spróbuj znowu)
        return;
    }

    // 2. Wybór filmu
    const langPlaylist = BONUS_PLAYLISTS[gameState.lang] || BONUS_PLAYLISTS['en'];
    const videoId = langPlaylist[gameState.levelIndex % langPlaylist.length];

    if (!videoId) {
        endBonus();
        return;
    }

    // 3. Start
    document.getElementById('bonus-layer').style.display = 'flex';
    ytPlayer.loadVideoById(videoId);

    // 4. Timer
    let timeLeft = 60;
    const bonusText = document.getElementById('bonus-text');
    bonusText.innerText = "BONUS! (60s)";

    // Czyścimy stare interwały
    if (window.bonusInterval) clearInterval(window.bonusInterval);
    if (window.bonusTimeout) clearTimeout(window.bonusTimeout);

    window.bonusInterval = setInterval(() => {
        timeLeft--;
        bonusText.innerText = `BONUS! (${timeLeft}s)`;
        if(timeLeft <= 0) clearInterval(window.bonusInterval);
    }, 1000);

    window.bonusTimeout = setTimeout(() => {
        clearInterval(window.bonusInterval);
        endBonus();
    }, 60000);
}

function endBonus() {
    if(ytPlayer && typeof ytPlayer.stopVideo === 'function') {
        try { ytPlayer.stopVideo(); } catch(e) { console.error(e); }
    }
    document.getElementById('bonus-layer').style.display = 'none';
    gameState.bonusActive = false;
    gameState.active = true;
    startLevel(gameState.levelIndex + 1);
}

// --- UTILITIES ---
function playSound(name) {
    const audio = new Audio(`assets/sounds/${gameState.lang}/${name}.mp3`);
    audio.volume = 0.8;
    audio.play().catch(e => console.warn("Audio error:", e));
}

function showFeedback(text, color = '#fff') {
    const el = document.getElementById('message-area');
    el.innerText = text;
    el.style.color = color;
    el.style.textShadow = `0 0 10px ${color}`;
    el.style.opacity = 1;
    el.style.animation = 'none';
    el.offsetHeight;
    el.style.transition = "opacity 0.5s";
    setTimeout(() => { el.style.opacity = 0; }, 1200);
}

function updateHud() {
    document.getElementById('level-disp').innerText = gameState.levelIndex + 1;
    const currentTarget = getCurrentTarget();
    document.getElementById('target-disp').innerText = currentTarget !== undefined ? currentTarget : "-";
    let hearts = "";
    for(let i=0; i<gameState.lives; i++) hearts += "❤";
    document.getElementById('lives-disp').innerText = hearts;
}

function gameOver() {
    gameState.active = false;
    alert("KONIEC GRY!");
    location.reload();
}

function animate() {
    requestAnimationFrame(animate);
    if(gameState.active && !gameState.bonusActive) {
        pacman.update();
    }
    const time = Date.now() * 0.002;
    numbersOnBoard.forEach(n => {
        n.mesh.position.y = 0.8 + Math.sin(time + n.value) * 0.15;
        n.mesh.rotation.y = Math.sin(time * 0.5 + n.value) * 0.2;
    });
    checkCollisions();
    renderer.render(scene, camera);
}

init();

// ゲーム設定
const CONFIG = {
    GRAVITY: -9.8,
    CANNON_ROTATION_SPEED: 0.02,
    CANNON_ELEVATION_SPEED: 0.02,
    BULLET_SPEED: 50,
    BULLET_LIFETIME: 5000,
    ENEMY_BASE_SPEED: 0.3,
    GAME_TIME: 60, // ゲーム時間（秒）
    ENEMY_SPAWN_INTERVAL_INITIAL: 2000, // 初期の敵の出現間隔（ミリ秒）
    ENEMY_SPAWN_INTERVAL_MIN: 500, // 最小の敵の出現間隔（ミリ秒）
    MAX_ENEMIES_INITIAL: 10, // 初期の画面上の最大敵数
    MAX_ENEMIES_FINAL: 25, // 最終的な画面上の最大敵数
    // 敵マシマシモード設定
    MASHIMASHI_SPAWN_INTERVAL_INITIAL: 600, // マシマシモードの初期出現間隔
    MASHIMASHI_SPAWN_INTERVAL_MIN: 100, // マシマシモードの最小出現間隔
    MASHIMASHI_MAX_ENEMIES_INITIAL: 30, // マシマシモードの初期最大敵数
    MASHIMASHI_MAX_ENEMIES_FINAL: 80 // マシマシモードの最終最大敵数
};

// ゲーム状態
let gameState = {
    score: 0,
    timeRemaining: 60,
    isPlaying: false,
    isPracticeMode: false,
    isMashimashiMode: false,
    enemies: [],
    bullets: [],
    enemiesDestroyed: 0,
    startTime: 0,
    lastEnemySpawn: 0,
    targets: [] // 練習モード用の的
};

// THREE.js 基本要素
let scene, camera, renderer;
let cannon, cannonBase, cannonBarrel;
let ground;
let mouse = { x: 0, y: 0 };
let keys = {};

// Cannon.js 物理世界
let world;
let cannonRotationY = 0;
let cannonElevation = 0.3;

// 初期化
function init() {
    // シーン作成
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // 空色
    scene.fog = new THREE.Fog(0x87CEEB, 50, 200);

    // カメラ作成（三人称視点）
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(0, 15, 25);
    camera.lookAt(0, 5, 0);

    // レンダラー作成
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.physicallyCorrectLights = true;
    document.getElementById('gameScreen').appendChild(renderer.domElement);

    // 物理世界の作成
    world = new CANNON.World();
    world.gravity.set(0, CONFIG.GRAVITY, 0);

    // ライト（PBR用に調整）
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xfff4e6, 2.5);
    directionalLight.position.set(50, 50, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // 半球ライト（空と地面の色）
    const hemiLight = new THREE.HemisphereLight(0x87CEEB, 0x5a8f4a, 0.5);
    scene.add(hemiLight);

    // 地面作成
    createGround();

    // 砲台作成
    createCannon();

    // イベントリスナー
    setupEventListeners();

    // ゲームループ開始
    animate();
}

// 地面作成
function createGround() {
    const groundGeometry = new THREE.PlaneGeometry(200, 200);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x5a8f4a,
        roughness: 0.9,
        metalness: 0.0,
        side: THREE.DoubleSide 
    });
    ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // グリッド（地形の視覚補助）
    const gridHelper = new THREE.GridHelper(200, 40, 0x444444, 0x888888);
    scene.add(gridHelper);
}

// 砲台作成
function createCannon() {
    // 砲台ベース（台座）
    const baseGeometry = new THREE.CylinderGeometry(2, 2.5, 1, 8);
    const baseMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x555555,
        roughness: 0.4,
        metalness: 0.8
    });
    cannonBase = new THREE.Mesh(baseGeometry, baseMaterial);
    cannonBase.position.y = 0.5;
    cannonBase.castShadow = true;
    scene.add(cannonBase);

    // 砲身（回転部分）
    const barrelGroup = new THREE.Group();
    
    const turretGeometry = new THREE.CylinderGeometry(1.5, 1.5, 0.8, 8);
    const turretMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x666666,
        roughness: 0.3,
        metalness: 0.9
    });
    const turret = new THREE.Mesh(turretGeometry, turretMaterial);
    turret.position.y = 1.4;
    turret.castShadow = true;
    barrelGroup.add(turret);

    const barrelGeometry = new THREE.CylinderGeometry(0.3, 0.3, 4, 16);
    const barrelMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x333333,
        roughness: 0.2,
        metalness: 0.95
    });
    cannonBarrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
    cannonBarrel.rotation.z = Math.PI / 2;
    cannonBarrel.position.set(2, 1.8, 0);
    cannonBarrel.castShadow = true;
    barrelGroup.add(cannonBarrel);

    cannon = barrelGroup;
    scene.add(cannon);
}

// 敵生成
function spawnEnemy() {
    const enemyGeometry = new THREE.SphereGeometry(1, 32, 32);
    const enemyMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xff0000,
        roughness: 0.3,
        metalness: 0.1,
        emissive: 0xff0000,
        emissiveIntensity: 0.3
    });
    const enemy = new THREE.Mesh(enemyGeometry, enemyMaterial);
    
    // ランダムな開始位置（高度と角度）
    const angle = Math.random() * Math.PI * 2;
    const distance = 40 + Math.random() * 30;
    const height = 10 + Math.random() * 20;
    
    enemy.position.set(
        Math.cos(angle) * distance,
        height,
        Math.sin(angle) * distance
    );
    enemy.castShadow = true;
    
    // 敵の移動パラメータ
    const enemyData = {
        mesh: enemy,
        velocity: new THREE.Vector3(
            (Math.random() - 0.5) * CONFIG.ENEMY_BASE_SPEED,
            (Math.random() - 0.5) * 0.3,
            (Math.random() - 0.5) * CONFIG.ENEMY_BASE_SPEED
        ),
        hp: 1,
        radius: 1
    };
    
    scene.add(enemy);
    gameState.enemies.push(enemyData);
}

// 練習用の的を生成
function createTargets() {
    // 既存の的をクリア
    gameState.targets.forEach(target => scene.remove(target.mesh));
    gameState.targets = [];
    
    // 複数の的を配置
    const targetPositions = [
        { x: 30, y: 10, z: 0 },
        { x: -30, y: 10, z: 0 },
        { x: 0, y: 15, z: 30 },
        { x: 0, y: 15, z: -30 },
        { x: 20, y: 12, z: 20 },
        { x: -20, y: 12, z: -20 },
        { x: 25, y: 8, z: -15 },
        { x: -25, y: 18, z: 15 }
    ];
    
    targetPositions.forEach((pos, index) => {
        // 円錐形の的
        const targetGeometry = new THREE.ConeGeometry(2, 4, 32);
        const targetMaterial = new THREE.MeshStandardMaterial({ 
            color: index % 2 === 0 ? 0xff6600 : 0xffcc00,
            roughness: 0.4,
            metalness: 0.3,
            emissive: index % 2 === 0 ? 0xff3300 : 0xff9900,
            emissiveIntensity: 0.4
        });
        const target = new THREE.Mesh(targetGeometry, targetMaterial);
        target.position.set(pos.x, pos.y, pos.z);
        target.castShadow = true;
        target.receiveShadow = true;
        scene.add(target);
        
        gameState.targets.push({
            mesh: target,
            radius: 2,
            hit: false
        });
    });
}

// 弾丸発射
function shootBullet() {
    if (!gameState.isPlaying) return;

    // 砲身の先端位置を計算（砲身の長さは4、中心位置は2なので先端まで+2）
    const barrelLength = 4;
    const barrelEnd = new THREE.Vector3(barrelLength, 0, 0);
    
    // 仰角を適用
    barrelEnd.applyAxisAngle(new THREE.Vector3(0, 0, 1), cannonElevation);
    
    // 旋回を適用
    barrelEnd.applyAxisAngle(new THREE.Vector3(0, 1, 0), cannonRotationY);
    
    // 砲塔の高さを加算
    barrelEnd.add(new THREE.Vector3(0, 1.8, 0));

    // 弾丸作成（より見やすく）
    const bulletGeometry = new THREE.SphereGeometry(1.0, 32, 32);
    const bulletMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x1a1a1a,
        roughness: 0.1,
        metalness: 0.9
    });
    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
    bullet.position.copy(barrelEnd);
    bullet.castShadow = true;
    scene.add(bullet);

    // 発射方向計算
    const direction = new THREE.Vector3(1, 0, 0);
    direction.applyAxisAngle(new THREE.Vector3(0, 0, 1), cannonElevation);
    direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), cannonRotationY);
    direction.normalize();

    // 物理ボディ作成（弾丸サイズに合わせる）
    const bulletShape = new CANNON.Sphere(1.0);
    const bulletBody = new CANNON.Body({
        mass: 1,
        shape: bulletShape,
        position: new CANNON.Vec3(barrelEnd.x, barrelEnd.y, barrelEnd.z),
        velocity: new CANNON.Vec3(
            direction.x * CONFIG.BULLET_SPEED,
            direction.y * CONFIG.BULLET_SPEED,
            direction.z * CONFIG.BULLET_SPEED
        )
    });
    world.addBody(bulletBody);

    // 弾丸データ
    const bulletData = {
        mesh: bullet,
        body: bulletBody,
        lifetime: CONFIG.BULLET_LIFETIME,
        createdAt: Date.now()
    };
    gameState.bullets.push(bulletData);

    // 発射エフェクト
    createMuzzleFlash(barrelEnd);
}

// 発射エフェクト
function createMuzzleFlash(position) {
    const flashGeometry = new THREE.SphereGeometry(0.5, 8, 8);
    const flashMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffaa00,
        transparent: true,
        opacity: 1
    });
    const flash = new THREE.Mesh(flashGeometry, flashMaterial);
    flash.position.copy(position);
    scene.add(flash);

    // フェードアウト
    let opacity = 1;
    const fadeInterval = setInterval(() => {
        opacity -= 0.1;
        flash.material.opacity = opacity;
        if (opacity <= 0) {
            scene.remove(flash);
            clearInterval(fadeInterval);
        }
    }, 30);
}

// 爆発エフェクト
function createExplosion(position) {
    const particles = [];
    for (let i = 0; i < 20; i++) {
        const particleGeometry = new THREE.SphereGeometry(0.2, 4, 4);
        const particleMaterial = new THREE.MeshBasicMaterial({ 
            color: Math.random() > 0.5 ? 0xff6600 : 0xffaa00 
        });
        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
        particle.position.copy(position);
        
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2
        );
        
        scene.add(particle);
        particles.push({ mesh: particle, velocity: velocity, life: 30 });
    }

    // パーティクルアニメーション
    const animateParticles = () => {
        particles.forEach((p, index) => {
            p.mesh.position.add(p.velocity);
            p.velocity.multiplyScalar(0.95);
            p.life--;
            p.mesh.material.opacity = p.life / 30;
            
            if (p.life <= 0) {
                scene.remove(p.mesh);
                particles.splice(index, 1);
            }
        });
        
        if (particles.length > 0) {
            requestAnimationFrame(animateParticles);
        }
    };
    animateParticles();
}

// 衝突判定
function checkCollisions() {
    gameState.bullets.forEach((bullet, bulletIndex) => {
        // 通常モード: 敵との衝突
        gameState.enemies.forEach((enemy, enemyIndex) => {
            const distance = bullet.mesh.position.distanceTo(enemy.mesh.position);
            if (distance < enemy.radius + 1.0) {
                // ヒット！
                createExplosion(enemy.mesh.position);
                
                // 敵削除
                scene.remove(enemy.mesh);
                gameState.enemies.splice(enemyIndex, 1);
                
                // 弾丸削除
                scene.remove(bullet.mesh);
                world.removeBody(bullet.body);
                gameState.bullets.splice(bulletIndex, 1);
                
                // スコア加算と撃破数カウント
                gameState.score += 100;
                gameState.enemiesDestroyed++;
                updateHUD();
            }
        });
        
        // 練習モード: 的との衝突
        if (gameState.isPracticeMode) {
            gameState.targets.forEach((target, targetIndex) => {
                if (target.hit) return; // 既に当たった的はスキップ
                
                const distance = bullet.mesh.position.distanceTo(target.mesh.position);
                if (distance < target.radius + 1.0) {
                    // ヒット！
                    createExplosion(target.mesh.position);
                    
                    // 的の色を変更（命中マーク）
                    target.mesh.material.color.setHex(0x00ff00);
                    target.mesh.material.emissive.setHex(0x00aa00);
                    target.hit = true;
                    
                    // 弾丸削除
                    scene.remove(bullet.mesh);
                    world.removeBody(bullet.body);
                    gameState.bullets.splice(bulletIndex, 1);
                    
                    // スコア加算
                    gameState.score += 50;
                    updateHUD();
                }
            });
        }
    });
}

// 敵の更新
function updateEnemies(delta) {
    gameState.enemies.forEach((enemy, index) => {
        // 移動
        enemy.mesh.position.add(enemy.velocity.clone().multiplyScalar(delta * 60));
        
        // 境界チェック（範囲外に出たら削除）
        if (Math.abs(enemy.mesh.position.x) > 100 || 
            Math.abs(enemy.mesh.position.z) > 100 ||
            enemy.mesh.position.y < 0 || 
            enemy.mesh.position.y > 50) {
            scene.remove(enemy.mesh);
            gameState.enemies.splice(index, 1);
        }
    });
}

// 弾丸の更新
function updateBullets(delta) {
    gameState.bullets.forEach((bullet, index) => {
        // 物理ボディと同期
        bullet.mesh.position.copy(bullet.body.position);
        
        // 寿命チェック
        if (Date.now() - bullet.createdAt > bullet.lifetime) {
            scene.remove(bullet.mesh);
            world.removeBody(bullet.body);
            gameState.bullets.splice(index, 1);
        }
        
        // 地面との衝突
        if (bullet.body.position.y < 0) {
            createExplosion(bullet.mesh.position);
            scene.remove(bullet.mesh);
            world.removeBody(bullet.body);
            gameState.bullets.splice(index, 1);
        }
    });
}

// 敵の自動生成（時間経過で加速）
function autoSpawnEnemies() {
    if (!gameState.isPlaying) return;
    
    const currentTime = Date.now();
    const elapsedTime = (currentTime - gameState.startTime) / 1000;
    const progress = Math.min(1, elapsedTime / CONFIG.GAME_TIME); // 0から1の進行度
    
    // マシマシモードの設定を使用
    let spawnIntervalInitial, spawnIntervalMin, maxEnemiesInitial, maxEnemiesFinal;
    
    if (gameState.isMashimashiMode) {
        spawnIntervalInitial = CONFIG.MASHIMASHI_SPAWN_INTERVAL_INITIAL;
        spawnIntervalMin = CONFIG.MASHIMASHI_SPAWN_INTERVAL_MIN;
        maxEnemiesInitial = CONFIG.MASHIMASHI_MAX_ENEMIES_INITIAL;
        maxEnemiesFinal = CONFIG.MASHIMASHI_MAX_ENEMIES_FINAL;
    } else {
        spawnIntervalInitial = CONFIG.ENEMY_SPAWN_INTERVAL_INITIAL;
        spawnIntervalMin = CONFIG.ENEMY_SPAWN_INTERVAL_MIN;
        maxEnemiesInitial = CONFIG.MAX_ENEMIES_INITIAL;
        maxEnemiesFinal = CONFIG.MAX_ENEMIES_FINAL;
    }
    
    // 時間経過で出現間隔を短縮
    const currentSpawnInterval = spawnIntervalInitial - 
        (spawnIntervalInitial - spawnIntervalMin) * progress;
    
    // 時間経過で最大敵数を増加
    const currentMaxEnemies = Math.floor(
        maxEnemiesInitial + 
        (maxEnemiesFinal - maxEnemiesInitial) * progress
    );
    
    if (currentTime - gameState.lastEnemySpawn > currentSpawnInterval && 
        gameState.enemies.length < currentMaxEnemies) {
        spawnEnemy();
        gameState.lastEnemySpawn = currentTime;
    }
}

// タイマー更新
function updateTimer() {
    if (!gameState.isPlaying) return;
    
    const currentTime = Date.now();
    const elapsedTime = (currentTime - gameState.startTime) / 1000;
    gameState.timeRemaining = Math.max(0, CONFIG.GAME_TIME - elapsedTime);
    
    if (gameState.timeRemaining <= 0) {
        gameOver();
    }
}

// HUD更新
function updateHUD() {
    document.getElementById('score').textContent = gameState.score;
    document.getElementById('wave').textContent = Math.floor(gameState.timeRemaining);
    document.getElementById('enemyCount').textContent = gameState.enemiesDestroyed;
    document.getElementById('health').textContent = gameState.enemies.length;
}

// ゲーム開始
function startGame() {
    // 既存の敵と弾丸をクリア
    if (gameState.enemies) {
        gameState.enemies.forEach(e => scene.remove(e.mesh));
    }
    if (gameState.bullets) {
        gameState.bullets.forEach(b => {
            scene.remove(b.mesh);
            world.removeBody(b.body);
        });
    }
    
    // 初期化
    gameState = {
        score: 0,
        timeRemaining: CONFIG.GAME_TIME,
        isPlaying: true,
        enemies: [],
        bullets: [],
        enemiesDestroyed: 0,
        startTime: Date.now(),
        lastEnemySpawn: Date.now()
    };
    
    updateHUD();
    
    // 画面切り替え
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('gameOverScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'block';
    
    // 初期敵を5~6体生成
    const initialEnemyCount = 5 + Math.floor(Math.random() * 2); // 5または6体
    for (let i = 0; i < initialEnemyCount; i++) {
        setTimeout(() => {
            spawnEnemy();
        }, i * 300); // 0.3秒間隔で生成
    }
}

// 敵マシマシモード開始
function startMashimashiMode() {
    // 既存の敵と弾丸をクリア
    if (gameState.enemies) {
        gameState.enemies.forEach(e => scene.remove(e.mesh));
    }
    if (gameState.bullets) {
        gameState.bullets.forEach(b => {
            scene.remove(b.mesh);
            world.removeBody(b.body);
        });
    }
    
    // 初期化
    gameState = {
        score: 0,
        timeRemaining: CONFIG.GAME_TIME,
        isPlaying: true,
        enemies: [],
        bullets: [],
        enemiesDestroyed: 0,
        startTime: Date.now(),
        lastEnemySpawn: Date.now(),
        isMashimashiMode: true  // マシマシモードフラグを有効化
    };
    
    updateHUD();
    
    // 画面切り替え
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('gameOverScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'block';
    
    // マシマシモードは初期敵を15~18体生成
    const initialEnemyCount = 15 + Math.floor(Math.random() * 4); // 15, 16, 17, または18体
    for (let i = 0; i < initialEnemyCount; i++) {
        setTimeout(() => {
            spawnEnemy();
        }, i * 200); // 0.2秒間隔で生成
    }
}

// 練習モード開始
function startPracticeMode() {
    // 既存の敵、弾丸、的をクリア
    if (gameState.enemies) {
        gameState.enemies.forEach(e => scene.remove(e.mesh));
    }
    if (gameState.bullets) {
        gameState.bullets.forEach(b => {
            scene.remove(b.mesh);
            world.removeBody(b.body);
        });
    }
    if (gameState.targets) {
        gameState.targets.forEach(t => scene.remove(t.mesh));
    }
    
    // 初期化
    gameState = {
        score: 0,
        timeRemaining: 0,
        isPlaying: true,
        isPracticeMode: true,
        enemies: [],
        bullets: [],
        enemiesDestroyed: 0,
        startTime: Date.now(),
        lastEnemySpawn: Date.now(),
        targets: []
    };
    
    updateHUD();
    
    // 画面切り替え
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('gameOverScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'block';
    
    // 的を生成
    createTargets();
}

// ゲーム/練習モードを退出
function exitGame() {
    gameState.isPlaying = false;
    gameState.isPracticeMode = false;
    
    // 敵、弾丸、的をクリア
    if (gameState.enemies) {
        gameState.enemies.forEach(e => scene.remove(e.mesh));
    }
    if (gameState.bullets) {
        gameState.bullets.forEach(b => {
            scene.remove(b.mesh);
            world.removeBody(b.body);
        });
    }
    if (gameState.targets) {
        gameState.targets.forEach(t => scene.remove(t.mesh));
    }
    
    gameState.enemies = [];
    gameState.bullets = [];
    gameState.targets = [];
    
    // スタート画面に戻る
    document.getElementById('gameScreen').style.display = 'none';
    document.getElementById('gameOverScreen').style.display = 'none';
    document.getElementById('startScreen').style.display = 'block';
}

// ゲームオーバー
function gameOver() {
    gameState.isPlaying = false;
    
    document.getElementById('finalScore').textContent = gameState.score;
    document.getElementById('finalWave').textContent = gameState.enemiesDestroyed;
    
    // 撃破数に応じたメッセージを設定
    let message = '';
    const destroyed = gameState.enemiesDestroyed;
    
    if (destroyed >= 30) {
        message = '🏆 あなたを敵には回したくないです！';
    } else if (destroyed >= 20) {
        message = '⭐ 素晴らしい腕前です！';
    } else if (destroyed >= 10) {
        message = '👍 なかなかの腕前です！';
    } else if (destroyed >= 4) {
        message = '💪 もう少し頑張りましょう！';
    } else {
        message = '📝 練習モードで腕を磨きましょう！';
    }
    
    document.getElementById('resultMessage').textContent = message;
    
    document.getElementById('gameScreen').style.display = 'none';
    document.getElementById('gameOverScreen').style.display = 'block';
}

// イベントリスナー設定
function setupEventListeners() {
    // キーボード
    document.addEventListener('keydown', (e) => {
        keys[e.key.toLowerCase()] = true;
        if (e.key === ' ' && gameState.isPlaying) {
            e.preventDefault();
            shootBullet();
        }
    });

    document.addEventListener('keyup', (e) => {
        keys[e.key.toLowerCase()] = false;
    });

    // ウィンドウリサイズ
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // ボタン
    document.getElementById('startButton').addEventListener('click', startGame);
    document.getElementById('practiceButton').addEventListener('click', startPracticeMode);
    document.getElementById('restartButton').addEventListener('click', startGame);
    document.getElementById('mashimashiButton').addEventListener('click', startMashimashiMode);
    document.getElementById('exitButton').addEventListener('click', exitGame);
}

// 砲台操作
function updateCannonControls() {
    // キーボードによる操作
    if (keys['a'] || keys['arrowleft']) cannonRotationY += CONFIG.CANNON_ROTATION_SPEED;
    if (keys['d'] || keys['arrowright']) cannonRotationY -= CONFIG.CANNON_ROTATION_SPEED;
    if (keys['w'] || keys['arrowup']) cannonElevation = Math.min(Math.PI / 3, cannonElevation + CONFIG.CANNON_ELEVATION_SPEED);
    if (keys['s'] || keys['arrowdown']) cannonElevation = Math.max(0, cannonElevation - CONFIG.CANNON_ELEVATION_SPEED);

    // 砲台の回転適用
    cannon.rotation.y = cannonRotationY;
    cannonBarrel.rotation.z = Math.PI / 2 + cannonElevation;
}

// アニメーションループ
let lastTime = Date.now();
function animate() {
    requestAnimationFrame(animate);

    const currentTime = Date.now();
    const delta = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    if (gameState.isPlaying) {
        // 物理世界の更新
        world.step(1 / 60);

        // 砲台操作
        // 砲台操作
        updateCannonControls();

        // 敵の更新
        updateEnemies(delta);

        // 弾丸の更新
        updateBullets(delta);

        // 衝突判定
        checkCollisions();

        // 練習モードでない場合のみタイマーと敵生成
        if (!gameState.isPracticeMode) {
            // タイマー更新
            updateTimer();
            
            // 敵の自動生成
            autoSpawnEnemies();
        }
        
        // HUD更新
        updateHUD();
    }

    renderer.render(scene, camera);
}

// 初期化実行
window.addEventListener('DOMContentLoaded', () => {
    init();
});

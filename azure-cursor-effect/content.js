// ============================================================
//  蔚蓝光标特效 - Content Script（右侧悬浮面板版）
// ============================================================

(function() {
    'use strict';

    // 默认配置
    const defaultConfig = {
        enabled: true,
        preventTextSelection: true,
        
        click: {
            circleMaxRadius: 22,
            circleGrowTime: 60,
            circleFadeTime: 170,
            circleColor: 'rgba(150, 235, 255, ',
            
            arcCount: 3,
            arcDegrees: 160,
            arcMaxWidth: 1.5,
            arcDrawTime: 160,
            arcShrinkTime: 240,
            arcStartTime: 15,
            arcRadiusRatio: 1.0,
            arcColor: { r: 235, g: 248, b: 255 },
            arcGlowSpread: 2.0,
            arcGlowAlpha: 0.15,
            arcCoreAlpha: 0.9,
            
            triangleCount: 4,
            triangleInitSize: 5,
            triangleShrinkTime: 430,
            triangleInitOffset: 22,
            triangleFlySpeed: 0.07,
            triangleFlyMaxDistance: 15,
            triangleBlinkFreq: 0.012,
        },
        trail: {
            pointInterval: 14,
            maxAge: 28,
            startWidth: 5,
            endWidth: 0.8,
            color: { r: 150, g: 235, b: 255 },
            opacity: 1.0,
            
            glowSpread: 3.0,
            glowAlpha: 0.2,
            
            triangleMaxInterval: 100,
            triangleMinInterval: 40,
            triangleMaxAge: 55,
            triangleInitSize: 13,
            triangleMinSizeRatio: 0.55,
            spreadSpeed: 0.85,
        }
    };

    let config = JSON.parse(JSON.stringify(defaultConfig));

    // 从 storage 读取配置
    function loadConfig() {
        try {
            chrome.storage.sync.get(['azureCursorConfig'], function(result) {
                if (result.azureCursorConfig) {
                    config = deepMerge(config, result.azureCursorConfig);
                }
                initPanel();
            });
        } catch (e) {
            initPanel();
        }
    }

    // 深度合并
    function deepMerge(target, source) {
        for (const key of Object.keys(source)) {
            if (source[key] instanceof Object && key in target) {
                Object.assign(source[key], deepMerge(target[key], source[key]));
            }
        }
        Object.assign(target || {}, source);
        return target;
    }

    // 保存配置
    function saveConfig() {
        try {
            chrome.storage.sync.set({ azureCursorConfig: config });
        } catch (e) {}
    }

    // 监听配置变化
    try {
        chrome.storage.onChanged.addListener(function(changes, namespace) {
            if (changes.azureCursorConfig) {
                config = deepMerge(JSON.parse(JSON.stringify(defaultConfig)), changes.azureCursorConfig.newValue);
                updatePanelValues();
            }
        });
    } catch (e) {}

    // ============================================================
    //  创建 Canvas
    // ============================================================
    const canvas = document.createElement('canvas');
    canvas.id = 'azure-cursor-effect-canvas';
    canvas.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 2147483646;
    `;
    document.documentElement.appendChild(canvas);

    const ctx = canvas.getContext('2d');

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // ============================================================
    //  创建右侧悬浮控制面板
    // ============================================================
    const panelContainer = document.createElement('div');
    panelContainer.id = 'azure-cursor-panel';
    panelContainer.style.cssText = `
        position: fixed;
        top: 50%;
        right: 0;
        transform: translateY(-50%);
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 13px;
    `;

    // 展开/收起按钮
    const panelToggle = document.createElement('button');
    panelToggle.id = 'azure-panel-toggle';
    panelToggle.innerHTML = '⚙️';
    panelToggle.style.cssText = `
        position: absolute;
        top: 50%;
        right: 0;
        transform: translateY(-50%);
        width: 36px;
        height: 60px;
        background: rgba(15, 30, 55, 0.9);
        border: 1px solid rgba(150, 235, 255, 0.3);
        border-right: none;
        border-radius: 8px 0 0 8px;
        color: #96ebff;
        cursor: pointer;
        backdrop-filter: blur(10px);
        transition: all 0.3s;
        font-size: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
    `;
    panelToggle.title = '蔚蓝光标特效 · 点击展开';

    // 面板内容
    const panelContent = document.createElement('div');
    panelContent.id = 'azure-panel-content';
    panelContent.style.cssText = `
        position: absolute;
        top: 50%;
        right: 36px;
        transform: translateY(-50%) translateX(100%);
        width: 280px;
        max-height: 80vh;
        overflow-y: auto;
        background: rgba(15, 30, 55, 0.95);
        border: 1px solid rgba(150, 235, 255, 0.25);
        border-right: none;
        border-radius: 12px 0 0 12px;
        padding: 16px;
        backdrop-filter: blur(15px);
        opacity: 0;
        pointer-events: none;
        transition: all 0.3s ease;
        color: #e6f1ff;
    `;

    // 面板内容 HTML
    panelContent.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid rgba(150, 235, 255, 0.2);">
            <span style="font-size: 15px; font-weight: 600; background: linear-gradient(90deg, #80dfff, #ccf5ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">蔚蓝特效</span>
            <label style="position: relative; display: inline-block; width: 38px; height: 20px; margin: 0;">
                <input type="checkbox" id="azure-enabled" style="opacity: 0; width: 0; height: 0;">
                <span id="azure-toggle-bg" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(100, 120, 150, 0.3); transition: 0.3s; border-radius: 20px;"></span>
                <span id="azure-toggle-knob" style="position: absolute; height: 14px; width: 14px; left: 3px; bottom: 3px; background-color: white; transition: 0.3s; border-radius: 50%;"></span>
            </label>
        </div>

        <div style="margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid rgba(150, 235, 255, 0.1);">
            <label style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; color: #a8b5d1; font-size: 12px; margin: 0;">
                <span>🛡️ 拖动时防止选中文字</span>
                <label style="position: relative; display: inline-block; width: 34px; height: 18px; margin: 0;">
                    <input type="checkbox" id="azure-prevent-select" style="opacity: 0; width: 0; height: 0;">
                    <span id="azure-prevent-bg" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(150, 235, 255, 0.4); transition: 0.3s; border-radius: 18px;"></span>
                    <span id="azure-prevent-knob" style="position: absolute; height: 12px; width: 12px; left: 19px; bottom: 3px; background-color: white; transition: 0.3s; border-radius: 50%;"></span>
                </label>
            </label>
        </div>

        <div class="azure-panel-section">
            <div class="azure-section-title">🔵 点击特效 · 圆</div>
            <div class="azure-control-item">
                <div class="azure-control-label">
                    <span>圆最大半径</span>
                    <span class="azure-control-value" id="val-circleRadius">22</span>
                </div>
                <input type="range" class="azure-slider" id="ctrl-circleRadius" min="10" max="60" value="22" step="1">
            </div>
            <div class="azure-control-item">
                <div class="azure-control-label">
                    <span>放大时间(ms)</span>
                    <span class="azure-control-value" id="val-circleGrow">60</span>
                </div>
                <input type="range" class="azure-slider" id="ctrl-circleGrow" min="20" max="200" value="60" step="5">
            </div>
            <div class="azure-control-item">
                <div class="azure-control-label">
                    <span>消失时间(ms)</span>
                    <span class="azure-control-value" id="val-circleFade">170</span>
                </div>
                <input type="range" class="azure-slider" id="ctrl-circleFade" min="50" max="500" value="170" step="10">
            </div>
        </div>

        <div class="azure-panel-section">
            <div class="azure-section-title">✨ 点击特效 · 弧线</div>
            <div class="azure-control-item">
                <div class="azure-control-label">
                    <span>弧线数量</span>
                    <span class="azure-control-value" id="val-arcCount">3</span>
                </div>
                <input type="range" class="azure-slider" id="ctrl-arcCount" min="1" max="8" value="3" step="1">
            </div>
            <div class="azure-control-item">
                <div class="azure-control-label">
                    <span>每段角度(°)</span>
                    <span class="azure-control-value" id="val-arcDegrees">160</span>
                </div>
                <input type="range" class="azure-slider" id="ctrl-arcDegrees" min="30" max="360" value="160" step="10">
            </div>
            <div class="azure-control-item">
                <div class="azure-control-label">
                    <span>弧线粗细</span>
                    <span class="azure-control-value" id="val-arcWidth">1.5</span>
                </div>
                <input type="range" class="azure-slider" id="ctrl-arcWidth" min="0.5" max="5" value="1.5" step="0.1">
            </div>
            <div class="azure-control-item">
                <div class="azure-control-label">
                    <span>柔光强度</span>
                    <span class="azure-control-value" id="val-arcGlow">0.15</span>
                </div>
                <input type="range" class="azure-slider" id="ctrl-arcGlow" min="0" max="0.5" value="0.15" step="0.01">
            </div>
        </div>

        <div class="azure-panel-section">
            <div class="azure-section-title">🔺 点击特效 · 三角</div>
            <div class="azure-control-item">
                <div class="azure-control-label">
                    <span>三角数量</span>
                    <span class="azure-control-value" id="val-triCount">4</span>
                </div>
                <input type="range" class="azure-slider" id="ctrl-triCount" min="1" max="12" value="4" step="1">
            </div>
            <div class="azure-control-item">
                <div class="azure-control-label">
                    <span>三角大小</span>
                    <span class="azure-control-value" id="val-triSize">5</span>
                </div>
                <input type="range" class="azure-slider" id="ctrl-triSize" min="2" max="15" value="5" step="0.5">
            </div>
            <div class="azure-control-item">
                <div class="azure-control-label">
                    <span>飞行距离</span>
                    <span class="azure-control-value" id="val-triFlyDist">15</span>
                </div>
                <input type="range" class="azure-slider" id="ctrl-triFlyDist" min="5" max="60" value="15" step="1">
            </div>
            <div class="azure-control-item">
                <div class="azure-control-label">
                    <span>闪烁频率</span>
                    <span class="azure-control-value" id="val-blinkFreq">0.012</span>
                </div>
                <input type="range" class="azure-slider" id="ctrl-blinkFreq" min="0" max="0.03" value="0.012" step="0.001">
            </div>
        </div>

        <div class="azure-panel-section">
            <div class="azure-section-title">🌊 拖尾特效 · 线</div>
            <div class="azure-control-item">
                <div class="azure-control-label">
                    <span>拖尾长度</span>
                    <span class="azure-control-value" id="val-trailAge">28</span>
                </div>
                <input type="range" class="azure-slider" id="ctrl-trailAge" min="10" max="60" value="28" step="1">
            </div>
            <div class="azure-control-item">
                <div class="azure-control-label">
                    <span>起点粗细</span>
                    <span class="azure-control-value" id="val-trailWidth">5</span>
                </div>
                <input type="range" class="azure-slider" id="ctrl-trailWidth" min="1" max="15" value="5" step="0.5">
            </div>
            <div class="azure-control-item">
                <div class="azure-control-label">
                    <span>柔光扩散</span>
                    <span class="azure-control-value" id="val-glowSpread">3.0</span>
                </div>
                <input type="range" class="azure-slider" id="ctrl-glowSpread" min="0" max="10" value="3.0" step="0.5">
            </div>
            <div class="azure-control-item">
                <div class="azure-control-label">
                    <span>柔光强度</span>
                    <span class="azure-control-value" id="val-glowAlpha">0.2</span>
                </div>
                <input type="range" class="azure-slider" id="ctrl-glowAlpha" min="0" max="0.5" value="0.2" step="0.01">
            </div>
            <div class="azure-control-item">
                <div class="azure-control-label">
                    <span>顺滑度</span>
                    <span class="azure-control-value" id="val-pointInterval">14</span>
                </div>
                <input type="range" class="azure-slider" id="ctrl-pointInterval" min="5" max="30" value="14" step="1">
            </div>
        </div>

        <div class="azure-panel-section">
            <div class="azure-section-title">🔷 拖尾特效 · 三角</div>
            <div class="azure-control-item">
                <div class="azure-control-label">
                    <span>三角最大间距</span>
                    <span class="azure-control-value" id="val-triMaxInt">100</span>
                </div>
                <input type="range" class="azure-slider" id="ctrl-triMaxInt" min="30" max="250" value="100" step="5">
            </div>
            <div class="azure-control-item">
                <div class="azure-control-label">
                    <span>三角最小间距</span>
                    <span class="azure-control-value" id="val-triMinInt">40</span>
                </div>
                <input type="range" class="azure-slider" id="ctrl-triMinInt" min="10" max="150" value="40" step="5">
            </div>
            <div class="azure-control-item">
                <div class="azure-control-label">
                    <span>三角初始大小</span>
                    <span class="azure-control-value" id="val-trailTriSize">13</span>
                </div>
                <input type="range" class="azure-slider" id="ctrl-trailTriSize" min="5" max="25" value="13" step="0.5">
            </div>
            <div class="azure-control-item">
                <div class="azure-control-label">
                    <span>发散速度</span>
                    <span class="azure-control-value" id="val-spreadSpeed">0.85</span>
                </div>
                <input type="range" class="azure-slider" id="ctrl-spreadSpeed" min="0.2" max="2" value="0.85" step="0.05">
            </div>
            <div class="azure-control-item">
                <div class="azure-control-label">
                    <span>三角存活时间</span>
                    <span class="azure-control-value" id="val-trailTriAge">55</span>
                </div>
                <input type="range" class="azure-slider" id="ctrl-trailTriAge" min="20" max="120" value="55" step="1">
            </div>
        </div>

        <button id="azure-reset-btn" style="width: 100%; padding: 8px; background: rgba(150, 235, 255, 0.1); border: 1px solid rgba(150, 235, 255, 0.3); color: #96ebff; border-radius: 6px; cursor: pointer; font-size: 12px; transition: all 0.3s; margin-top: 8px;">
            恢复默认设置
        </button>
    `;

    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
        .azure-panel-section {
            margin-bottom: 14px;
            padding-bottom: 10px;
            border-bottom: 1px solid rgba(150, 235, 255, 0.1);
        }
        .azure-panel-section:last-of-type {
            margin-bottom: 0;
            padding-bottom: 0;
            border-bottom: none;
        }
        .azure-section-title {
            color: #96ebff;
            font-weight: 600;
            margin-bottom: 10px;
            font-size: 13px;
        }
        .azure-control-item {
            margin-bottom: 8px;
        }
        .azure-control-label {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 3px;
            color: #a8b5d1;
            font-size: 11px;
        }
        .azure-control-value {
            color: #96ebff;
            font-weight: 500;
            font-family: monospace;
        }
        .azure-slider {
            width: 100%;
            height: 3px;
            -webkit-appearance: none;
            background: rgba(150, 235, 255, 0.2);
            border-radius: 2px;
            outline: none;
        }
        .azure-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 12px;
            height: 12px;
            background: #96ebff;
            border-radius: 50%;
            cursor: pointer;
            box-shadow: 0 0 6px rgba(150, 235, 255, 0.5);
        }
        .azure-slider::-moz-range-thumb {
            width: 12px;
            height: 12px;
            background: #96ebff;
            border-radius: 50%;
            cursor: pointer;
            border: none;
            box-shadow: 0 0 6px rgba(150, 235, 255, 0.5);
        }
        #azure-panel-content::-webkit-scrollbar {
            width: 4px;
        }
        #azure-panel-content::-webkit-scrollbar-track {
            background: rgba(150, 235, 255, 0.1);
        }
        #azure-panel-content::-webkit-scrollbar-thumb {
            background: rgba(150, 235, 255, 0.3);
            border-radius: 2px;
        }
        #azure-reset-btn:hover {
            background: rgba(150, 235, 255, 0.2);
        }
        #azure-panel-toggle:hover {
            background: rgba(150, 235, 255, 0.2) !important;
        }
    `;
    document.head.appendChild(style);

    panelContainer.appendChild(panelToggle);
    panelContainer.appendChild(panelContent);
    document.documentElement.appendChild(panelContainer);

    // 面板展开/收起状态
    let panelOpen = false;

    function togglePanel() {
        panelOpen = !panelOpen;
        if (panelOpen) {
            panelContent.style.transform = 'translateY(-50%) translateX(0)';
            panelContent.style.opacity = '1';
            panelContent.style.pointerEvents = 'auto';
            panelToggle.innerHTML = '✕';
            panelToggle.style.background = 'rgba(150, 235, 255, 0.2)';
        } else {
            panelContent.style.transform = 'translateY(-50%) translateX(100%)';
            panelContent.style.opacity = '0';
            panelContent.style.pointerEvents = 'none';
            panelToggle.innerHTML = '⚙️';
            panelToggle.style.background = 'rgba(15, 30, 55, 0.9)';
        }
    }

    panelToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePanel();
    });

    // 点击面板外部关闭
    document.addEventListener('click', (e) => {
        if (panelOpen && !panelContainer.contains(e.target)) {
            togglePanel();
        }
    });

    // 阻止面板内的点击冒泡
    panelContent.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // ============================================================
    //  防止文字选中
    // ============================================================
    function setPreventSelection(prevent) {
        if (prevent) {
            document.body.style.userSelect = 'none';
            document.body.style.webkitUserSelect = 'none';
            document.body.style.mozUserSelect = 'none';
        } else {
            document.body.style.userSelect = '';
            document.body.style.webkitUserSelect = '';
            document.body.style.mozUserSelect = '';
        }
    }

    // ============================================================
    //  粒子数组
    // ============================================================
    const clickEffects = [];
    const trailPoints = [];
    const trailTriangles = [];
    let isDragging = false;
    let lastX = 0, lastY = 0;
    let triangleDistanceAcc = 0;
    let nextTriangleDistance = 0;

    // ============================================================
    //  事件处理
    // ============================================================
    document.addEventListener('mousedown', (e) => {
        if (!config.enabled) return;
        if (e.button !== 0) return;
        
        if (config.preventTextSelection) {
            setPreventSelection(true);
        }
        
        createClickEffect(e.clientX, e.clientY);
        
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        triangleDistanceAcc = 0;
        nextTriangleDistance = randomTriangleInterval();
        addTrailPoint(e.clientX, e.clientY);
        addTrailTriangle(e.clientX, e.clientY, 0);
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        if (config.preventTextSelection) {
            setPreventSelection(false);
        }
    });

    document.addEventListener('mouseleave', () => {
        isDragging = false;
        if (config.preventTextSelection) {
            setPreventSelection(false);
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (!config.enabled || !isDragging) return;
        
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance >= config.trail.pointInterval) {
            const moveAngle = Math.atan2(dy, dx);
            addTrailPoint(e.clientX, e.clientY);
            
            triangleDistanceAcc += distance;
            while (triangleDistanceAcc >= nextTriangleDistance) {
                triangleDistanceAcc -= nextTriangleDistance;
                const ratio = 1 - triangleDistanceAcc / distance;
                const tx = lastX + dx * ratio;
                const ty = lastY + dy * ratio;
                addTrailTriangle(tx, ty, moveAngle);
                nextTriangleDistance = randomTriangleInterval();
            }
            
            lastX = e.clientX;
            lastY = e.clientY;
        }
    });

    // ============================================================
    //  随机三角间距
    // ============================================================
    function randomTriangleInterval() {
        const min = config.trail.triangleMinInterval;
        const max = config.trail.triangleMaxInterval;
        return min + Math.random() * (max - min);
    }

    // ============================================================
    //  点击特效
    // ============================================================
    function createClickEffect(x, y) {
        const effect = {
            x, y,
            startTime: performance.now(),
            triangles: [],
            arcStarts: []
        };

        for (let i = 0; i < config.click.arcCount; i++) {
            effect.arcStarts.push(Math.random() * Math.PI * 2);
        }

        for (let i = 0; i < config.click.triangleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            effect.triangles.push({
                flyAngle: angle,
                initSize: config.click.triangleInitSize * (0.75 + Math.random() * 0.5),
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.03,
                blinkPhase: Math.random() * Math.PI * 2
            });
        }

        clickEffects.push(effect);
    }

    function drawClickEffects(now) {
        for (let i = clickEffects.length - 1; i >= 0; i--) {
            const effect = clickEffects[i];
            const elapsed = now - effect.startTime;

            const totalDuration = config.click.triangleShrinkTime + 50;
            if (elapsed > totalDuration) {
                clickEffects.splice(i, 1);
                continue;
            }

            drawClickEffect(effect, elapsed, now);
        }
    }

    function drawClickEffect(effect, elapsed, now) {
        const { x, y, arcStarts, triangles } = effect;
        const cfg = config.click;
        const arcTotalRadians = cfg.arcDegrees * Math.PI / 180;
        const { r, g, b } = cfg.arcColor;

        // 1. 圆
        let circleRadius = 0, circleAlpha = 0;
        if (elapsed < cfg.circleGrowTime) {
            const p = elapsed / cfg.circleGrowTime;
            circleRadius = cfg.circleMaxRadius * easeOutQuad(p);
            circleAlpha = 0.5;
        } else if (elapsed < cfg.circleGrowTime + cfg.circleFadeTime) {
            const p = (elapsed - cfg.circleGrowTime) / cfg.circleFadeTime;
            circleRadius = cfg.circleMaxRadius;
            circleAlpha = 0.5 * (1 - easeInQuad(p));
        } else {
            circleRadius = cfg.circleMaxRadius;
            circleAlpha = 0;
        }

        if (circleAlpha > 0) {
            ctx.beginPath();
            ctx.arc(x, y, circleRadius, 0, Math.PI * 2);
            ctx.fillStyle = cfg.circleColor + circleAlpha + ')';
            ctx.fill();
        }

        // 2. 弧线
        const arcEndTime = cfg.arcStartTime + cfg.arcDrawTime + cfg.arcShrinkTime;
        if (elapsed >= cfg.arcStartTime && elapsed < arcEndTime) {
            const arcElapsed = elapsed - cfg.arcStartTime;
            const arcRadius = circleRadius * cfg.arcRadiusRatio;

            arcStarts.forEach((startAngle) => {
                let vs = startAngle, ve = startAngle;
                if (arcElapsed < cfg.arcDrawTime) {
                    const p = arcElapsed / cfg.arcDrawTime;
                    ve = startAngle - arcTotalRadians * easeOutQuad(p);
                } else {
                    const p = (arcElapsed - cfg.arcDrawTime) / cfg.arcShrinkTime;
                    vs = startAngle - arcTotalRadians * easeInQuad(p);
                    ve = startAngle - arcTotalRadians;
                }
                if (arcRadius > 2) {
                    drawTaperedGlowArc(x, y, arcRadius, vs, ve, true, r, g, b, cfg);
                }
            });
        }

        // 3. 三角
        if (elapsed < cfg.triangleShrinkTime) {
            const p = elapsed / cfg.triangleShrinkTime;
            const alpha = 1 - easeOutQuad(p);

            triangles.forEach((tri) => {
                tri.rotation += tri.rotationSpeed;
                const dist = cfg.triangleInitOffset + cfg.triangleFlyMaxDistance * easeOutQuad(p);
                const tx = x + Math.cos(tri.flyAngle) * dist;
                const ty = y + Math.sin(tri.flyAngle) * dist;
                const size = tri.initSize * (1 - easeInQuad(p));

                if (size > 0.5 && alpha > 0) {
                    const blink = Math.sin(now * cfg.triangleBlinkFreq + tri.blinkPhase);
                    const bp = (blink + 1) / 2;
                    const tr = Math.floor(255 - 105 * bp);
                    const tg = Math.floor(255 - 20 * bp);
                    const tb = 255;

                    ctx.save();
                    ctx.translate(tx, ty);
                    ctx.rotate(tri.rotation);
                    ctx.beginPath();
                    ctx.moveTo(0, -size);
                    ctx.lineTo(-size * 0.866, size * 0.5);
                    ctx.lineTo(size * 0.866, size * 0.5);
                    ctx.closePath();
                    ctx.fillStyle = `rgba(${tr}, ${tg}, ${tb}, ${alpha})`;
                    ctx.shadowColor = 'rgba(150, 235, 255, 0.35)';
                    ctx.shadowBlur = 3;
                    ctx.fill();
                    ctx.restore();
                }
            });
        }
    }

    // ============================================================
    //  拖尾特效（带柔光）
    // ============================================================
    function addTrailPoint(x, y) {
        trailPoints.push({ x, y, age: 0, maxAge: config.trail.maxAge });
    }

    function addTrailTriangle(x, y, moveAngle) {
        const spreadDir = Math.random() > 0.5 ? 1 : -1;
        const spreadAngle = moveAngle + spreadDir * Math.PI / 2;
        const speed = config.trail.spreadSpeed * (0.5 + Math.random() * 0.8);

        const sizeRatio = config.trail.triangleMinSizeRatio + 
            Math.random() * (1 - config.trail.triangleMinSizeRatio);
        const initSize = config.trail.triangleInitSize * sizeRatio;

        trailTriangles.push({
            x, y,
            vx: Math.cos(spreadAngle) * speed,
            vy: Math.sin(spreadAngle) * speed,
            size: initSize,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.04,
            age: 0,
            maxAge: config.trail.triangleMaxAge
        });
    }

    function drawTrailEffects() {
        const { r, g, b } = config.trail.color;

        // 更新拖尾点
        for (let i = trailPoints.length - 1; i >= 0; i--) {
            trailPoints[i].age++;
            if (trailPoints[i].age >= trailPoints[i].maxAge) {
                trailPoints.splice(i, 1);
            }
        }

        // 绘制拖尾线（带柔光）
        if (trailPoints.length >= 2) {
            // 第一层：柔光层
            for (let i = 1; i < trailPoints.length; i++) {
                const p1 = trailPoints[i - 1];
                const p2 = trailPoints[i];
                const p1p = p1.age / p1.maxAge;
                const p2p = p2.age / p2.maxAge;
                
                const glowW1 = (config.trail.startWidth + config.trail.glowSpread) * (1 - p1p) + config.trail.endWidth * p1p;
                const glowW2 = (config.trail.startWidth + config.trail.glowSpread) * (1 - p2p) + config.trail.endWidth * p2p;
                const a1 = config.trail.opacity * (1 - p1p) * config.trail.glowAlpha;
                const a2 = config.trail.opacity * (1 - p2p) * config.trail.glowAlpha;
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const len = Math.sqrt(dx * dx + dy * dy) || 1;
                const nx = -dy / len;
                const ny = dx / len;
                const v1x = p1.x + nx * glowW1 / 2, v1y = p1.y + ny * glowW1 / 2;
                const v2x = p1.x - nx * glowW1 / 2, v2y = p1.y - ny * glowW1 / 2;
                const v3x = p2.x - nx * glowW2 / 2, v3y = p2.y - ny * glowW2 / 2;
                const v4x = p2.x + nx * glowW2 / 2, v4y = p2.y + ny * glowW2 / 2;
                const grad = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
                grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${a1})`);
                grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${a2})`);
                ctx.beginPath();
                ctx.moveTo(v1x, v1y);
                ctx.lineTo(v2x, v2y);
                ctx.lineTo(v3x, v3y);
                ctx.lineTo(v4x, v4y);
                ctx.closePath();
                ctx.fillStyle = grad;
                ctx.fill();
            }
            // 第二层：核心层
            for (let i = 1; i < trailPoints.length; i++) {
                const p1 = trailPoints[i - 1];
                const p2 = trailPoints[i];
                const p1p = p1.age / p1.maxAge;
                const p2p = p2.age / p2.maxAge;
                const w1 = config.trail.startWidth * (1 - p1p) + config.trail.endWidth * p1p;
                const w2 = config.trail.startWidth * (1 - p2p) + config.trail.endWidth * p2p;
                const a1 = config.trail.opacity * (1 - p1p);
                const a2 = config.trail.opacity * (1 - p2p);
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const len = Math.sqrt(dx * dx + dy * dy) || 1;
                const nx = -dy / len;
                const ny = dx / len;
                const v1x = p1.x + nx * w1 / 2, v1y = p1.y + ny * w1 / 2;
                const v2x = p1.x - nx * w1 / 2, v2y = p1.y - ny * w1 / 2;
                const v3x = p2.x - nx * w2 / 2, v3y = p2.y - ny * w2 / 2;
                const v4x = p2.x + nx * w2 / 2, v4y = p2.y + ny * w2 / 2;
                const grad = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
                grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${a1})`);
                grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${a2})`);
                ctx.beginPath();
                ctx.moveTo(v1x, v1y);
                ctx.lineTo(v2x, v2y);
                ctx.lineTo(v3x, v3y);
                ctx.lineTo(v4x, v4y);
                ctx.closePath();
                ctx.fillStyle = grad;
                ctx.fill();
            }
        }

        // 更新并绘制三角
        for (let i = trailTriangles.length - 1; i >= 0; i--) {
            const tri = trailTriangles[i];
            tri.age++;
            tri.x += tri.vx;
            tri.y += tri.vy;
            tri.rotation += tri.rotationSpeed;
            tri.size *= 0.965;

            if (tri.age >= tri.maxAge || tri.size < 1) {
                trailTriangles.splice(i, 1);
                continue;
            }

            const p = tri.age / tri.maxAge;
            const alpha = 1 - p;
            const tr = Math.floor(255 - (255 - r) * p);
            const tg = Math.floor(255 - (255 - g) * p);
            const tb = Math.floor(255 - (255 - b) * p);

            ctx.save();
            ctx.translate(tri.x, tri.y);
            ctx.rotate(tri.rotation);
            ctx.beginPath();
            ctx.moveTo(0, -tri.size);
            ctx.lineTo(-tri.size * 0.866, tri.size * 0.5);
            ctx.lineTo(tri.size * 0.866, tri.size * 0.5);
            ctx.closePath();
            ctx.fillStyle = `rgba(${tr}, ${tg}, ${tb}, ${alpha})`;
            ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${alpha * 0.35})`;
            ctx.shadowBlur = 5;
            ctx.fill();
            ctx.restore();
        }
    }

    // ============================================================
    //  绘制两头渐细的柔光弧线
    // ============================================================
    function drawTaperedGlowArc(cx, cy, radius, startAngle, endAngle, ccw, r, g, b, cfg) {
        let totalAngle = Math.abs(endAngle - startAngle);
        if (totalAngle > Math.PI * 2) totalAngle = Math.PI * 2;
        if (totalAngle < 0.01) return;

        const segments = Math.max(6, Math.floor(totalAngle * 10));
        ctx.lineCap = 'round';

        // 柔光层
        for (let i = 0; i < segments; i++) {
            const p1 = i / segments, p2 = (i + 1) / segments;
            let a1, a2;
            if (ccw) {
                a1 = startAngle - totalAngle * p1;
                a2 = startAngle - totalAngle * p2;
            } else {
                a1 = startAngle + totalAngle * p1;
                a2 = startAngle + totalAngle * p2;
            }
            const mid = (p1 + p2) / 2;
            const w = (cfg.arcMaxWidth + cfg.arcGlowSpread) * Math.sin(mid * Math.PI);
            if (w < 0.3) continue;

            ctx.beginPath();
            ctx.arc(cx, cy, radius, a1, a2, ccw);
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${cfg.arcGlowAlpha})`;
            ctx.lineWidth = w;
            ctx.stroke();
        }

        // 核心层
        for (let i = 0; i < segments; i++) {
            const p1 = i / segments, p2 = (i + 1) / segments;
            let a1, a2;
            if (ccw) {
                a1 = startAngle - totalAngle * p1;
                a2 = startAngle - totalAngle * p2;
            } else {
                a1 = startAngle + totalAngle * p1;
                a2 = startAngle + totalAngle * p2;
            }
            const mid = (p1 + p2) / 2;
            const w = cfg.arcMaxWidth * Math.sin(mid * Math.PI);
            if (w < 0.2) continue;

            ctx.beginPath();
            ctx.arc(cx, cy, radius, a1, a2, ccw);
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${cfg.arcCoreAlpha})`;
            ctx.lineWidth = w;
            ctx.stroke();
        }
    }

    // ============================================================
    //  缓动函数
    // ============================================================
    function easeOutQuad(t) { return t * (2 - t); }
    function easeInQuad(t) { return t * t; }

    // ============================================================
    //  动画主循环
    // ============================================================
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (config.enabled) {
            const now = performance.now();
            drawClickEffects(now);
            drawTrailEffects();
        }

        requestAnimationFrame(animate);
    }
    animate();

    // ============================================================
    //  触屏兼容
    // ============================================================
    document.addEventListener('touchstart', (e) => {
        if (!config.enabled) return;
        const touch = e.touches[0];
        createClickEffect(touch.clientX, touch.clientY);
        isDragging = true;
        lastX = touch.clientX;
        lastY = touch.clientY;
        triangleDistanceAcc = 0;
        nextTriangleDistance = randomTriangleInterval();
        addTrailPoint(touch.clientX, touch.clientY);
        addTrailTriangle(touch.clientX, touch.clientY, 0);
        
        if (config.preventTextSelection) {
            setPreventSelection(true);
        }
    });

    document.addEventListener('touchmove', (e) => {
        if (!config.enabled || !isDragging) return;
        const touch = e.touches[0];
        const dx = touch.clientX - lastX;
        const dy = touch.clientY - lastY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance >= config.trail.pointInterval) {
            const angle = Math.atan2(dy, dx);
            addTrailPoint(touch.clientX, touch.clientY);
            triangleDistanceAcc += distance;
            while (triangleDistanceAcc >= nextTriangleDistance) {
                triangleDistanceAcc -= nextTriangleDistance;
                const ratio = 1 - triangleDistanceAcc / distance;
                const tx = lastX + dx * ratio;
                const ty = lastY + dy * ratio;
                addTrailTriangle(tx, ty, angle);
                nextTriangleDistance = randomTriangleInterval();
            }
            lastX = touch.clientX;
            lastY = touch.clientY;
        }
    });

    document.addEventListener('touchend', () => {
        isDragging = false;
        if (config.preventTextSelection) {
            setPreventSelection(false);
        }
    });

    // ============================================================
    //  控制面板逻辑
    // ============================================================
    const controls = [
        { id: 'circleRadius', path: 'click.circleMaxRadius', val: 'val-circleRadius' },
        { id: 'circleGrow', path: 'click.circleGrowTime', val: 'val-circleGrow' },
        { id: 'circleFade', path: 'click.circleFadeTime', val: 'val-circleFade' },
        { id: 'arcCount', path: 'click.arcCount', val: 'val-arcCount' },
        { id: 'arcDegrees', path: 'click.arcDegrees', val: 'val-arcDegrees' },
        { id: 'arcWidth', path: 'click.arcMaxWidth', val: 'val-arcWidth' },
        { id: 'arcGlow', path: 'click.arcGlowAlpha', val: 'val-arcGlow' },
        { id: 'triCount', path: 'click.triangleCount', val: 'val-triCount' },
        { id: 'triSize', path: 'click.triangleInitSize', val: 'val-triSize' },
        { id: 'triFlyDist', path: 'click.triangleFlyMaxDistance', val: 'val-triFlyDist' },
        { id: 'blinkFreq', path: 'click.triangleBlinkFreq', val: 'val-blinkFreq' },
        { id: 'trailAge', path: 'trail.maxAge', val: 'val-trailAge' },
        { id: 'trailWidth', path: 'trail.startWidth', val: 'val-trailWidth' },
        { id: 'glowSpread', path: 'trail.glowSpread', val: 'val-glowSpread' },
        { id: 'glowAlpha', path: 'trail.glowAlpha', val: 'val-glowAlpha' },
        { id: 'pointInterval', path: 'trail.pointInterval', val: 'val-pointInterval' },
        { id: 'triMaxInt', path: 'trail.triangleMaxInterval', val: 'val-triMaxInt' },
        { id: 'triMinInt', path: 'trail.triangleMinInterval', val: 'val-triMinInt' },
        { id: 'trailTriSize', path: 'trail.triangleInitSize', val: 'val-trailTriSize' },
        { id: 'spreadSpeed', path: 'trail.spreadSpeed', val: 'val-spreadSpeed' },
        { id: 'trailTriAge', path: 'trail.triangleMaxAge', val: 'val-trailTriAge' },
    ];

    function initPanel() {
        // 总开关
        const enabledToggle = document.getElementById('azure-enabled');
        const toggleBg = document.getElementById('azure-toggle-bg');
        const toggleKnob = document.getElementById('azure-toggle-knob');
        
        enabledToggle.checked = config.enabled;
        updateToggleStyle(config.enabled, toggleBg, toggleKnob, 21);
        
        enabledToggle.addEventListener('change', function() {
            config.enabled = this.checked;
            updateToggleStyle(this.checked, toggleBg, toggleKnob, 21);
            saveConfig();
        });

        // 防止选中文字开关
        const preventToggle = document.getElementById('azure-prevent-select');
        const preventBg = document.getElementById('azure-prevent-bg');
        const preventKnob = document.getElementById('azure-prevent-knob');
        
        preventToggle.checked = config.preventTextSelection;
        updateToggleStyle(config.preventTextSelection, preventBg, preventKnob, 19);
        
        preventToggle.addEventListener('change', function() {
            config.preventTextSelection = this.checked;
            updateToggleStyle(this.checked, preventBg, preventKnob, 19);
            saveConfig();
        });

        // 滑块
        controls.forEach(ctrl => {
            const input = document.getElementById('ctrl-' + ctrl.id);
            const valDisplay = document.getElementById(ctrl.val);

            const path = ctrl.path.split('.');
            let obj = config;
            for (let i = 0; i < path.length - 1; i++) {
                obj = obj[path[i]];
            }
            const value = obj[path[path.length - 1]];

            input.value = value;
            valDisplay.textContent = value;

            input.addEventListener('input', function() {
                const val = parseFloat(this.value);
                valDisplay.textContent = val;

                let obj = config;
                for (let i = 0; i < path.length - 1; i++) {
                    obj = obj[path[i]];
                }
                obj[path[path.length - 1]] = val;

                if (ctrl.id === 'circleRadius') {
                    config.click.triangleInitOffset = val;
                }

                saveConfig();
            });
        });

        // 恢复默认
        document.getElementById('azure-reset-btn').addEventListener('click', function() {
            config = JSON.parse(JSON.stringify(defaultConfig));
            initPanel();
            saveConfig();
        });
    }

    function updateToggleStyle(checked, bgEl, knobEl, leftPos) {
        if (checked) {
            knobEl.style.left = leftPos + 'px';
            bgEl.style.backgroundColor = 'rgba(150, 235, 255, 0.5)';
        } else {
            knobEl.style.left = '3px';
            bgEl.style.backgroundColor = 'rgba(100, 120, 150, 0.3)';
        }
    }

    function updatePanelValues() {
        // 更新总开关
        const enabledToggle = document.getElementById('azure-enabled');
        const toggleBg = document.getElementById('azure-toggle-bg');
        const toggleKnob = document.getElementById('azure-toggle-knob');
        enabledToggle.checked = config.enabled;
        updateToggleStyle(config.enabled, toggleBg, toggleKnob, 21);

        // 更新防止选中开关
        const preventToggle = document.getElementById('azure-prevent-select');
        const preventBg = document.getElementById('azure-prevent-bg');
        const preventKnob = document.getElementById('azure-prevent-knob');
        preventToggle.checked = config.preventTextSelection;
        updateToggleStyle(config.preventTextSelection, preventBg, preventKnob, 19);

        // 更新滑块
        controls.forEach(ctrl => {
            const input = document.getElementById('ctrl-' + ctrl.id);
            const valDisplay = document.getElementById(ctrl.val);

            const path = ctrl.path.split('.');
            let obj = config;
            for (let i = 0; i < path.length - 1; i++) {
                obj = obj[path[i]];
            }
            const value = obj[path[path.length - 1]];

            input.value = value;
            valDisplay.textContent = value;
        });
    }

    // 初始化
    loadConfig();

})();

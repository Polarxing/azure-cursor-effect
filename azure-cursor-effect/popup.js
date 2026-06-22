// ============================================================
//  蔚蓝光标特效 - Popup 控制面板
// ============================================================

// 默认配置
const defaultConfig = {
    enabled: true,
    click: {
        circleMaxRadius: 22,
        circleGrowTime: 60,
        circleFadeTime: 170,
        
        arcCount: 3,
        arcDegrees: 160,
        arcMaxWidth: 1.5,
        arcGlowAlpha: 0.15,
        
        triangleCount: 4,
        triangleInitSize: 5,
        triangleFlyMaxDistance: 15,
        triangleBlinkFreq: 0.012,
    },
    trail: {
        maxAge: 28,
        startWidth: 5,
        
        glowSpread: 3.0,
        glowAlpha: 0.2,
        
        triangleMaxInterval: 100,
        triangleMinInterval: 40,
        triangleInitSize: 13,
        spreadSpeed: 0.85,
    }
};

let currentConfig = JSON.parse(JSON.stringify(defaultConfig));

// 控件配置
const controls = [
    // 点击特效 · 圆
    { id: 'circleRadius', path: 'click.circleMaxRadius', val: 'val-circleRadius' },
    { id: 'circleGrow', path: 'click.circleGrowTime', val: 'val-circleGrow' },
    { id: 'circleFade', path: 'click.circleFadeTime', val: 'val-circleFade' },
    // 点击特效 · 弧线
    { id: 'arcCount', path: 'click.arcCount', val: 'val-arcCount' },
    { id: 'arcDegrees', path: 'click.arcDegrees', val: 'val-arcDegrees' },
    { id: 'arcWidth', path: 'click.arcMaxWidth', val: 'val-arcWidth' },
    { id: 'arcGlow', path: 'click.arcGlowAlpha', val: 'val-arcGlow' },
    // 点击特效 · 三角
    { id: 'triCount', path: 'click.triangleCount', val: 'val-triCount' },
    { id: 'triSize', path: 'click.triangleInitSize', val: 'val-triSize' },
    { id: 'triFlyDist', path: 'click.triangleFlyMaxDistance', val: 'val-triFlyDist' },
    { id: 'blinkFreq', path: 'click.triangleBlinkFreq', val: 'val-blinkFreq' },
    // 拖尾特效 · 线
    { id: 'trailAge', path: 'trail.maxAge', val: 'val-trailAge' },
    { id: 'trailWidth', path: 'trail.startWidth', val: 'val-trailWidth' },
    { id: 'glowSpread', path: 'trail.glowSpread', val: 'val-glowSpread' },
    { id: 'glowAlpha', path: 'trail.glowAlpha', val: 'val-glowAlpha' },
    // 拖尾特效 · 三角
    { id: 'triMaxInt', path: 'trail.triangleMaxInterval', val: 'val-triMaxInt' },
    { id: 'triMinInt', path: 'trail.triangleMinInterval', val: 'val-triMinInt' },
    { id: 'trailTriSize', path: 'trail.triangleInitSize', val: 'val-trailTriSize' },
    { id: 'spreadSpeed', path: 'trail.spreadSpeed', val: 'val-spreadSpeed' },
];

// 从 storage 读取配置
function loadConfig() {
    chrome.storage.sync.get(['azureCursorConfig'], function(result) {
        if (result.azureCursorConfig) {
            currentConfig = deepMerge(JSON.parse(JSON.stringify(defaultConfig)), result.azureCursorConfig);
        }
        initControls();
    });
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
    chrome.storage.sync.set({ azureCursorConfig: currentConfig }, function() {
        // 通知 content script 配置已更新
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { type: 'configUpdated', config: currentConfig }, function() {
                    // 忽略错误（某些页面可能没有 content script）
                });
            }
        });
    });
}

// 初始化控件
function initControls() {
    // 开关
    const enabledToggle = document.getElementById('enabledToggle');
    enabledToggle.checked = currentConfig.enabled;
    enabledToggle.addEventListener('change', function() {
        currentConfig.enabled = this.checked;
        saveConfig();
    });

    // 滑块
    controls.forEach(ctrl => {
        const input = document.getElementById('ctrl-' + ctrl.id);
        const valDisplay = document.getElementById(ctrl.val);

        // 从 config 读取值
        const path = ctrl.path.split('.');
        let obj = currentConfig;
        for (let i = 0; i < path.length - 1; i++) {
            obj = obj[path[i]];
        }
        const value = obj[path[path.length - 1]];

        // 设置滑块和显示值
        input.value = value;
        valDisplay.textContent = value;

        // 监听变化
        input.addEventListener('input', function() {
            const val = parseFloat(this.value);
            valDisplay.textContent = val;

            // 更新 config
            let obj = currentConfig;
            for (let i = 0; i < path.length - 1; i++) {
                obj = obj[path[i]];
            }
            obj[path[path.length - 1]] = val;

            // 同步三角初始偏移（跟随圆半径）
            if (ctrl.id === 'circleRadius') {
                currentConfig.click.triangleInitOffset = val;
            }

            saveConfig();
        });
    });

    // 恢复默认按钮
    document.getElementById('resetBtn').addEventListener('click', function() {
        currentConfig = JSON.parse(JSON.stringify(defaultConfig));
        initControls();
        saveConfig();
    });
}

// 初始化
loadConfig();

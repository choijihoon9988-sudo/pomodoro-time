/* script.js */
// ===================================================================================
// Firebase SDK v9+ (모듈러)
// ===================================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    doc,
    setDoc,
    getDoc,
    deleteDoc,
    query,
    where,
    Timestamp,
    orderBy,
    serverTimestamp,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// ✅ 수정됨: Chart.js ES 모듈을 명시적으로 임포트하여 오류 해결
import { Chart, registerables } from 'https://cdn.jsdelivr.net/npm/chart.js/dist/chart.mjs';

// Chart.js의 모든 구성 요소를 등록합니다.
Chart.register(...registerables);


// ===================================================================================
// Firebase 프로젝트 구성 정보
// ===================================================================================
const firebaseConfig = {
  apiKey: "AIzaSyCRHNKmNBtTFbCeQhhGJsoxYwmqKu1f4uo",
  authDomain: "pomodoro-os.firebaseapp.com",
  projectId: "pomodoro-os",
  storageBucket: "pomodoro-os.firebasestorage.app",
  messagingSenderId: "338185932667",
  appId: "1:338185932667:web:c5c9c46274db636d6777de"
};


/**
 * @module FirebaseAPI
 * @description Firebase SDK와의 모든 상호작용을 추상화.
 */
const FirebaseAPI = (() => {
    let app, db;

    const init = () => {
        if (!firebaseConfig.apiKey || firebaseConfig.apiKey.includes("YOUR_API_KEY")) {
            console.error("Firebase 구성 정보가 유효하지 않습니다. script.js 파일의 firebaseConfig 객체를 확인해주세요.");
            alert("서비스 연결 설정이 올바르지 않습니다. 관리자에게 문의해주세요.");
            return false;
        }
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        return true;
    };

    const getUserProfile = (userId) => getDoc(doc(db, 'users', userId));
    const createUserProfile = (userId, email) => {
        const userProfileRef = doc(db, 'users', userId);
        const batch = writeBatch(db);
        batch.set(userProfileRef, {
            email, level: 1, totalFocusMinutes: 0, streak: 0,
            lastSessionDate: null, createdAt: serverTimestamp(), badges: [], dailyGoals: {}
        });
        const settingsRef = doc(db, 'users', userId, 'settings', 'default');
        batch.set(settingsRef, {
            alarmSound: 'alarm_clock.ogg',
            enhancedRest: false,
            restSound: 'none'
        });
        return batch.commit();
    };
    const updateUserProfile = (userId, data) => setDoc(doc(db, 'users', userId), data, { merge: true });
    const getUserSettings = (userId) => getDoc(doc(db, 'users', userId, 'settings', 'default'));
    const updateUserSettings = (userId, data) => setDoc(doc(db, 'users', userId, 'settings', 'default'), data, { merge: true });
    const saveLog = (userId, logData) => addDoc(collection(db, 'users', userId, 'logs'), { ...logData, timestamp: serverTimestamp() });
    const getLogsByDateRange = async (userId, startDate, endDate) => {
        const q = query(collection(db, 'users', userId, 'logs'),
            where('timestamp', '>=', startDate), where('timestamp', '<=', endDate), orderBy('timestamp', 'asc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    };
    const addSystem = (userId, systemData) => addDoc(collection(db, 'users', userId, 'systems'), systemData);
    const getSystems = async (userId) => {
        const snapshot = await getDocs(collection(db, 'users', userId, 'systems'));
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    };
    const deleteSystem = (userId, systemId) => deleteDoc(doc(db, 'users', userId, 'systems', systemId));

    return {
        init, getUserProfile, createUserProfile, updateUserProfile,
        getUserSettings, updateUserSettings, saveLog, getLogsByDateRange, addSystem, getSystems, deleteSystem
    };
})();


/**
 * @module Notifications
 * @description 브라우저 알림 관리.
 */
const Notifications = (() => {
    let permission = 'default';
    const requestPermission = async () => {
        if (!('Notification' in window)) { permission = 'denied'; return; }
        permission = await Notification.requestPermission();
    };
    const show = (title, options) => {
        if (permission === 'granted') new Notification(title, options);
    };
    return { requestPermission, show };
})();


/**
 * @module Favicon
 * @description 파비콘 상태 관리.
 */
const Favicon = (() => {
    const faviconEl = document.getElementById('favicon');
    const icons = {
        default: 'icons/favicon-default.png', focus: 'icons/favicon-focus.png',
        rest: 'icons/favicon-rest.png', paused: 'icons/favicon-paused.png',
    };
    const set = (state) => {
        if (faviconEl) faviconEl.href = icons[state] || icons.default;
    };
    return { set };
})();


/**
 * @module UI
 * @description DOM 조작, UI 렌더링, 이벤트 리스너 담당.
 */
const UI = (() => {
    const dom = {};
    let lastFocusedElement;
    const frictionTags = ['업무 외 검색', '메신저 확인', '유튜브 시청', '불필요한 생각', '계획 부재', '기술적 문제', '주변 소음'];
    const emotionTags = ['불안감', '지루함', '호기심', '무력감', '피로감'];
    const alarmSounds = { 'alarm_clock.ogg': '클래식 알람', 'bell.ogg': '부드러운 벨', 'digital_alarm.ogg': '디지털 알람' };
    const restSounds = { 'none': '없음', 'rain.mp3': '빗소리', 'forest.mp3': '숲속 소리' };
    const CIRCLE_CIRCUMFERENCE = 339.29; // 2 * PI * 54

    const cacheDOM = () => {
        const ids = [
            'app-view', 'streak-count', 'user-level', 'start-btn', 'pause-btn', 'reset-btn', 'end-day-btn',
            'my-systems-btn', 'stats-btn', 'log-modal', 'log-form', 'log-activity', 'friction-tags', 'emotion-tags',
            'distraction-input', 'distraction-list', 'report-modal', 'report-content', 'show-system-btn',
            'system-suggestion-modal', 'system-suggestion-text', 'adopt-system-btn', 'my-systems-modal',
            'my-systems-list', 'daily-goal-input', 'set-goal-btn', 'daily-goal-container', 'forest-display',
            'alarm-sound-select', 'rest-sound-select', 'enhanced-rest-toggle', 'sound-therapy-container',
            'session-transition-modal', 'transition-icon', 'transition-title',
            'transition-message', 'transition-action-btn', 'positive-priming', 'positive-priming-text',
            'timer-mode', 'timer-clock', 'current-energy', 'total-goal', 'rest-suggestion-container',
            'rest-suggestion-text', 'reset-confirm-modal', 'cancel-reset-btn', 'confirm-reset-btn',
            'stats-modal', 'stats-period-select', 'stats-content'
        ];
        ids.forEach(id => dom[id.replace(/-(\w)/g, (_, c) => c.toUpperCase())] = document.getElementById(id));

        dom.presetBtns = document.querySelectorAll('.button--preset');
        dom.timerProgressTime = document.querySelector('.timer-progress__time');
        dom.timerProgressGoal = document.querySelector('.timer-progress__goal');
    };

    const renderTagButtons = () => {
        if (dom.frictionTags) dom.frictionTags.innerHTML = frictionTags.map(tag => `<button type="button" class="tag-group__tag" data-tag="${tag}">${tag}</button>`).join('');
        if (dom.emotionTags) dom.emotionTags.innerHTML = emotionTags.map(tag => `<button type="button" class="tag-group__tag" data-tag="${tag}">${tag}</button>`).join('');
    };

    const renderSelectOptions = () => {
        if (dom.alarmSoundSelect) dom.alarmSoundSelect.innerHTML = Object.entries(alarmSounds).map(([file, name]) => `<option value="${file}">${name}</option>`).join('');
        if (dom.restSoundSelect) dom.restSoundSelect.innerHTML = Object.entries(restSounds).map(([file, name]) => `<option value="${file}">${name}</option>`).join('');
    };

    const bindEventListeners = () => {
        dom.startBtn?.addEventListener('click', Timer.start);
        dom.pauseBtn?.addEventListener('click', Timer.pause);
        dom.resetBtn?.addEventListener('click', () => toggleModal('reset-confirm-modal', true));
        dom.confirmResetBtn?.addEventListener('click', () => { Timer.reset(); toggleModal('reset-confirm-modal', false); });
        dom.presetBtns?.forEach(btn => btn.addEventListener('click', App.handlePresetSelect));
        dom.endDayBtn?.addEventListener('click', Report.generateDailyReport);
        dom.mySystemsBtn?.addEventListener('click', Systems.showMySystems);
        dom.statsBtn?.addEventListener('click', Stats.show);
        dom.statsPeriodSelect?.addEventListener('change', Stats.handlePeriodChange);
        dom.logForm?.addEventListener('submit', Logger.handleLogSubmit);
        dom.distractionInput?.addEventListener('keydown', Logger.handleDistractionInput);
        dom.showSystemBtn?.addEventListener('click', App.handleShowSystem);
        dom.adoptSystemBtn?.addEventListener('click', Systems.adoptSystem);
        dom.mySystemsList?.addEventListener('click', Systems.handleSystemListClick);
        document.body.addEventListener('click', e => {
            if (e.target.dataset.closeModal !== undefined) e.target.closest('.modal')?.id && toggleModal(e.target.closest('.modal').id, false);
        });
        dom.logModal?.addEventListener('click', e => e.target.classList.contains('tag-group__tag') && e.target.classList.toggle('tag-group__tag--selected'));
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                const visibleModal = document.querySelector('.modal--visible');
                if (visibleModal && visibleModal.id !== 'session-transition-modal') toggleModal(visibleModal.id, false);
            }
        });
        dom.setGoalBtn?.addEventListener('click', Gamification.setDailyGoal);
        dom.alarmSoundSelect?.addEventListener('change', (e) => App.handleSoundChange('alarmSound', e.target.value));
        dom.restSoundSelect?.addEventListener('change', (e) => App.handleSoundChange('restSound', e.target.value));
        dom.enhancedRestToggle?.addEventListener('change', App.handleEnhancedRestToggle);
        dom.transitionActionBtn?.addEventListener('click', Timer.startNextSession);
    };

    const updateGamificationStats = (level, streak) => {
        if (dom.userLevel) dom.userLevel.textContent = level;
        if (dom.streakCount) dom.streakCount.textContent = streak;
    };

    const updateTimerDisplay = (timeString, mode, remaining, total) => {
        if (dom.timerClock) dom.timerClock.textContent = timeString;
        if (dom.timerMode) dom.timerMode.textContent = mode;
        document.title = `${timeString} - ${mode}`;

        const percentage = total > 0 ? (total - remaining) / total : 0;
        if(dom.timerProgressTime) {
            dom.timerProgressTime.style.strokeDashoffset = CIRCLE_CIRCUMFERENCE * (1 - percentage);
            dom.timerProgressTime.style.stroke = mode === '집중' ? 'var(--primary-color)' : 'var(--success-color)';
        }
    };

    const showRestSuggestion = (show, text = '') => {
        if (!dom.restSuggestionContainer || !dom.restSuggestionText) return;
        dom.restSuggestionContainer.classList.toggle('hidden', !show);
        dom.restSuggestionText.textContent = text;
    };

    const updateTimerControls = (state) => {
        if (!dom.startBtn || !dom.pauseBtn) return;
        dom.startBtn.textContent = state === 'paused' ? '다시 집중' : '집중 시작';
        dom.startBtn.classList.toggle('hidden', state === 'running');
        dom.pauseBtn.classList.toggle('hidden', state !== 'running');
    };

    const toggleModal = (modalId, show) => {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        if (show) {
            lastFocusedElement = document.activeElement;
            modal.classList.add('modal--visible');
            modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus();
        } else {
            modal.classList.remove('modal--visible');
            lastFocusedElement?.focus();
        }
        document.body.classList.toggle('body--modal-open', !!document.querySelector('.modal--visible'));
    };

    const updateForestDisplay = (completed, total) => {
        if (!dom.forestDisplay) return;
        let html = '';
        for (let i = 0; i < total; i++) {
            html += `<span class="session-icon ${i < completed ? 'completed' : ''}" style="color: ${i < completed ? 'var(--primary-color)' : 'var(--border-color)'}">🍅</span>`;
        }
        dom.forestDisplay.innerHTML = html || '<span style="font-size: 0.9rem; color: var(--text-light-color);">목표를 설정하고 집중을 시작하세요.</span>';
    };

    const updateGoalProgress = (current, total) => {
        if (!dom.currentEnergy || !dom.totalGoal) return;
        dom.currentEnergy.textContent = current.toFixed(1);
        dom.totalGoal.textContent = total;
        if(dom.dailyGoalInput) dom.dailyGoalInput.value = total;

        const percentage = total > 0 ? Math.min(current / total, 1) : 0;
        if (dom.timerProgressGoal) {
            dom.timerProgressGoal.style.strokeDashoffset = CIRCLE_CIRCUMFERENCE * (1 - percentage);
        }
    };

    const showSessionTransitionModal = (data) => {
        if (!dom.transitionIcon || !dom.transitionTitle || !dom.transitionMessage || !dom.transitionActionBtn) return;
        dom.transitionIcon.textContent = data.icon;
        dom.transitionTitle.textContent = data.title;
        dom.transitionMessage.textContent = data.message;
        dom.transitionActionBtn.textContent = data.buttonText;
        dom.transitionActionBtn.className = `button ${data.buttonClass}`;
        toggleModal('session-transition-modal', true);
    };

    const showPositivePriming = (message) => {
        if (!dom.positivePrimingText || !dom.positivePriming) return;
        dom.positivePrimingText.textContent = message;
        dom.positivePriming.classList.add('positive-priming--visible');
        setTimeout(() => dom.positivePriming.classList.remove('positive-priming--visible'), 1500);
    };

    const resetLogForm = () => {
        dom.logForm?.reset();
        dom.logModal?.querySelectorAll('.tag-group__tag--selected').forEach(tag => tag.classList.remove('tag-group__tag--selected'));
        if (dom.distractionList) dom.distractionList.innerHTML = '';
    };

    const renderDistractionList = (distractions) => {
        if (dom.distractionList) dom.distractionList.innerHTML = distractions.map(d => `<li>${d}</li>`).join('');
    };

    const renderReport = (reportData) => {
        if (!dom.reportContent) return;
        const { totalFocusMinutes, energy, topFrictions, insight, badges } = reportData;
        const topFrictionsHTML = topFrictions.length > 0 ? topFrictions.map(f => `<li>${f.tag} (${f.count}회)</li>`).join('') : '<li>오늘은 마찰 없이 순항하셨네요! 멋져요.</li>';
        const badgesHTML = badges?.length > 0 ? `<div class="report__stat"><p class="report__title">새로운 성장 배지</p><ul class="report__list">${badges.map(b => `<li>🏅 ${b.name}</li>`).join('')}</ul></div>` : '';

        dom.reportContent.innerHTML = `<div class="report__grid"><div class="report__stat"><p class="report__title">총 몰입 시간</p><p class="report__value">${totalFocusMinutes}분</p></div><div class="report__stat"><p class="report__title">오늘 얻은 성장 에너지</p><p class="report__value">${energy.toFixed(1)}</p></div></div>${badgesHTML}<div class="report__stat"><p class="report__title">성장을 방해한 주요 마찰</p><ul class="report__list">${topFrictionsHTML}</ul></div>${insight ? `<div class="report__insight"><p>${insight}</p></div>` : ''}`;
        if (dom.showSystemBtn) dom.showSystemBtn.classList.toggle('hidden', !reportData.topFrictionTag);
        toggleModal('report-modal', true);
    };

    const showSystemSuggestion = (suggestion) => {
        if (!dom.systemSuggestionText || !dom.adoptSystemBtn) return;
        dom.systemSuggestionText.textContent = suggestion.description;
        dom.adoptSystemBtn.dataset.suggestion = JSON.stringify(suggestion);
        toggleModal('system-suggestion-modal', true);
    };

    const lockGoalSetting = (locked) => {
        if (!dom.dailyGoalInput || !dom.setGoalBtn) return;
        dom.dailyGoalInput.disabled = locked;
        dom.setGoalBtn.classList.toggle('hidden', locked);
        if (locked) {
            const container = dom.dailyGoalContainer;
            if(container) container.title = "오늘의 목표는 하루에 한 번만 설정할 수 있어요.";
        }
    };

    const renderMySystems = (systems) => {
        if (!dom.mySystemsList) return;
        dom.mySystemsList.innerHTML = systems.length === 0 ? `<p>아직 추가된 성장 시스템이 없어요. 리포트를 통해 나만의 시스템을 만들어보세요.</p>` : systems.map(system => `<div class="system-card" data-id="${system.id}"><div class="system-card__header"><h3 class="system-card__title">${system.title}</h3><span class="system-card__tag">${system.targetFriction}</span></div><p class="system-card__description">${system.description}</p><div class="system-card__footer"><span>추가한 날짜: ${system.adoptedAt.toLocaleDateString()}</span><button class="button button--danger" data-action="delete-system">삭제</button></div></div>`).join('');
    };

    const updateActivePreset = (condition) => {
        dom.presetBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.condition === condition));
    };

    const toggleEnhancedRestUI = (enabled) => {
        if (dom.soundTherapyContainer) dom.soundTherapyContainer.classList.toggle('hidden', !enabled);
    };

    return {
        init: () => { cacheDOM(); bindEventListeners(); renderTagButtons(); renderSelectOptions(); },
        updateGamificationStats, updateTimerDisplay,
        updateTimerControls, toggleModal, resetLogForm, renderDistractionList,
        renderReport, showSystemSuggestion, renderMySystems, updateForestDisplay, updateGoalProgress,
        showSessionTransitionModal, showPositivePriming, updateActivePreset, showRestSuggestion,
        lockGoalSetting, toggleEnhancedRestUI,
        getLogFormData: () => ({
            activity: dom.logActivity.value,
            frictionTags: Array.from(dom.frictionTags.querySelectorAll('.tag-group__tag--selected')).map(t => t.dataset.tag),
            emotionTags: Array.from(dom.emotionTags.querySelectorAll('.tag-group__tag--selected')).map(t => t.dataset.tag)
        }),
        getDailyGoal: () => parseInt(dom.dailyGoalInput.value, 10),
        getStatsDOM: () => ({ content: dom.statsContent, periodSelect: dom.statsPeriodSelect }),
        setSettings: (settings) => {
            if (dom.alarmSoundSelect) dom.alarmSoundSelect.value = settings.alarmSound;
            if (dom.restSoundSelect) dom.restSoundSelect.value = settings.restSound;
            if (dom.enhancedRestToggle) dom.enhancedRestToggle.checked = settings.enhancedRest;
            toggleEnhancedRestUI(settings.enhancedRest);
        }
    };
})();


/**
 * @module Auth
 * @description 단일 사용자 모드를 위한 가상 인증 모듈.
 */
const Auth = (() => {
    const LOCAL_USER_ID = 'default-user';

    const init = async () => {
        // 앱 시작 시, 단일 사용자의 프로필이 없으면 생성합니다.
        const profileSnap = await FirebaseAPI.getUserProfile(LOCAL_USER_ID);
        if (!profileSnap.exists()) {
            await FirebaseAPI.createUserProfile(LOCAL_USER_ID, 'default-user@local.host');
        }

        // 설정 및 게임화 데이터를 로드합니다.
        const settingsSnap = await FirebaseAPI.getUserSettings(LOCAL_USER_ID);
        if (settingsSnap.exists()) {
            const settings = settingsSnap.data();
            Timer.applySettings(settings);
            UI.setSettings(settings);
        }
        await Gamification.loadProfile();
    };

    const getCurrentUser = () => ({ uid: LOCAL_USER_ID });

    return { init, getCurrentUser };
})();


/**
 * @module Timer
 * @description 뽀모도로 타이머 로직 및 상태 관리.
 */
const Timer = (() => {
    let state = { timerId: null, totalSeconds: 1500, remainingSeconds: 1500, mode: '집중', status: 'idle', logTriggered: false };
    let config = { focusDuration: 25, restDuration: 5, condition: '보통' };
    let settings = { enhancedRest: false, alarmSound: 'alarm_clock.ogg', restSound: 'none' };
    let alarmAudio, restAudio;
    const positiveMessages = ["최고의 몰입을 경험할 시간입니다.", "작은 집중이 큰 성장을 만듭니다.", "가장 중요한 일에 에너지를 쏟으세요.", "지금 이 순간의 몰입이 내일의 당신을 만듭니다."];
    const restSuggestions = { short: "가볍게 눈을 감고 1분간 명상해보세요.", long: "자리에서 일어나 간단한 스트레칭은 어떠세요?" };

    const tick = () => {
        state.remainingSeconds--;
        UI.updateTimerDisplay(formatTime(state.remainingSeconds), state.mode, state.remainingSeconds, state.totalSeconds);
        if (state.mode === '집중' && !state.logTriggered && state.remainingSeconds <= state.totalSeconds * 0.8) {
            state.logTriggered = true;
            Logger.triggerLogPopup();
        }
        if (state.remainingSeconds <= 0) completeSession();
    };

    const completeSession = () => {
        clearInterval(state.timerId);
        state.status = 'idle';
        alarmAudio?.play();
        Favicon.set('default');

        if (state.mode === '집중') {
            Gamification.updateFocusSession(config.focusDuration);
            state.mode = '휴식';
            state.totalSeconds = config.restDuration * 60;
            const suggestion = config.restDuration >= 10 ? restSuggestions.long : restSuggestions.short;
            UI.showSessionTransitionModal({ icon: '☕', title: '수고하셨어요! 잠시 숨을 고르세요', message: `${config.restDuration}분간 재충전 시간입니다.`, buttonText: '휴식 시작', buttonClass: 'button--secondary' });
            Notifications.show('수고하셨어요!', { body: `이제 ${config.restDuration}분간 휴식하며 재충전하세요.` });
            if (settings.enhancedRest) {
                 UI.showRestSuggestion(true, suggestion);
                 if (settings.restSound !== 'none') { restAudio?.play(); }
            }
        } else {
            state.mode = '집중';
            state.totalSeconds = config.focusDuration * 60;
            UI.showSessionTransitionModal({ icon: '🔥', title: '다시, 집중할 시간이에요!', message: `${config.focusDuration}분간 몰입을 시작합니다.`, buttonText: '집중 시작', buttonClass: 'button--success' });
            Notifications.show('다시 집중할 시간', { body: `이제 ${config.focusDuration}분간 다시 몰입해보세요.` });
            if (settings.enhancedRest) {
                UI.showRestSuggestion(false);
                restAudio?.pause();
            }
        }
        UI.updateTimerControls(state.status);
    };

    const startNextSession = () => {
        UI.toggleModal('session-transition-modal', false);
        state.remainingSeconds = state.totalSeconds;
        state.logTriggered = false;
        UI.updateTimerDisplay(formatTime(state.remainingSeconds), state.mode, state.remainingSeconds, state.totalSeconds);
        UI.updateTimerControls(state.status);
        start();
    };

    const formatTime = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

    const start = () => {
        if (state.status === 'running') return;
        const isNewFocus = state.mode === '집중' && state.remainingSeconds === state.totalSeconds;
        if (isNewFocus) UI.showPositivePriming(positiveMessages[Math.floor(Math.random() * positiveMessages.length)]);
        setTimeout(() => {
            state.status = 'running';
            Favicon.set(state.mode === '집중' ? 'focus' : 'rest');
            state.timerId = setInterval(tick, 1000);
            UI.updateTimerControls(state.status);
        }, isNewFocus ? 1600 : 0);
    };

    const pause = () => {
        if (state.status !== 'running') return;
        clearInterval(state.timerId);
        state.status = 'paused';
        Favicon.set('paused');
        UI.updateTimerControls(state.status);
    };

    const reset = () => {
        clearInterval(state.timerId);
        state = { ...state, status: 'idle', remainingSeconds: state.totalSeconds, logTriggered: false };
        Favicon.set('default');
        UI.updateTimerDisplay(formatTime(state.remainingSeconds), state.mode, state.remainingSeconds, state.totalSeconds);
        UI.updateTimerControls(state.status);
        UI.showRestSuggestion(false);
        restAudio?.pause();
    };

    const applySettings = (newSettings) => {
        settings = { ...settings, ...newSettings };
        // 404 오류 방지를 위해 임시 주석 처리
        // alarmAudio = new Audio(`sounds/${settings.alarmSound}`);
        // if (settings.restSound !== 'none') {
        //     restAudio = new Audio(`sounds/${settings.restSound}`);
        //     restAudio.loop = true;
        // } else {
        //     restAudio = null;
        // }
    };

    return {
        start, pause, reset, startNextSession, applySettings,
        setConfig: (focus, rest, condition) => {
            config = { focusDuration: focus, restDuration: rest, condition };
            state.mode = '집중';
            state.totalSeconds = config.focusDuration * 60;
            reset();
            UI.updateActivePreset(condition);
        },
        getCurrentSessionDuration: () => config.focusDuration,
    };
})();


/**
 * @module Logger
 * @description 마찰 로깅 및 딴생각 저장소 관리.
 */
const Logger = (() => {
    let distractions = [];
    const triggerLogPopup = () => { Timer.pause(); UI.toggleModal('log-modal', true); };
    const handleDistractionInput = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (e.target.value.trim()) {
                distractions.push(e.target.value.trim());
                UI.renderDistractionList(distractions);
                e.target.value = '';
            }
        }
    };
    const handleLogSubmit = async (e) => {
        e.preventDefault();
        const user = Auth.getCurrentUser();
        if (!user) return;
        const { activity, frictionTags, emotionTags } = UI.getLogFormData();
        if (!activity) return alert("무엇에 집중하셨는지 알려주세요.");
        try {
            await FirebaseAPI.saveLog(user.uid, { activity, frictionTags, emotionTags, distractions, sessionDuration: Timer.getCurrentSessionDuration() });
            distractions = [];
            UI.resetLogForm();
            UI.toggleModal('log-modal', false);
            Timer.start();
        } catch (error) { console.error("기록 저장 중 오류:", error); alert("기록 저장 중 오류가 발생했어요. 잠시 후 다시 시도해주세요."); }
    };
    return { triggerLogPopup, handleLogSubmit, handleDistractionInput };
})();


/**
 * @module Report
 * @description 데일리 리포트 생성.
 */
const Report = (() => {
    let currentReportData = null;
    const analyzeLogs = (logs) => {
        const totalFocusMinutes = logs.reduce((sum, log) => sum + log.sessionDuration, 0);
        const frictionCounts = logs.flatMap(log => log.frictionTags).reduce((acc, tag) => ({ ...acc, [tag]: (acc[tag] || 0) + 1 }), {});
        const topFrictions = Object.entries(frictionCounts).sort(([, a], [, b]) => b - a).slice(0, 3).map(([tag, count]) => ({ tag, count }));
        const energy = logs.reduce((sum, log) => sum + (log.sessionDuration >= 50 ? 2.5 : log.sessionDuration >= 30 ? 1.5 : 1.0), 0);
        return { totalFocusMinutes, energy, topFrictions, topFrictionTag: topFrictions[0]?.tag || null, frictionCounts };
    };
    const generateDailyReport = async () => {
        const user = Auth.getCurrentUser();
        if (!user) return;
        try {
            const today = new Date();
            const logs = await FirebaseAPI.getLogsByDateRange(user.uid, new Date(today.setHours(0, 0, 0, 0)), new Date(today.setHours(23, 59, 59, 999)));
            if (logs.length === 0) return alert("오늘의 집중 기록이 없어요. 성장을 위해 타이머를 시작해보세요.");
            const analysis = analyzeLogs(logs);
            const insight = generateInsight(analysis.frictionCounts);
            const earnedBadges = await Gamification.checkBadges(logs);
            currentReportData = { ...analysis, insight, badges: earnedBadges };
            UI.renderReport(currentReportData);
            await Gamification.updateStreak();
        } catch (error) { console.error("리포트 생성 중 오류:", error); }
    };
    const generateInsight = (counts) => {
        if (counts['업무 외 검색'] >= 2) return "성장 인사이트: [업무 외 검색]으로 몰입이 자주 끊기는 경향이 있어요.";
        if (counts['메신저 확인'] >= 3) return "성장 인사이트: [메신저 확인] 마찰이 잦군요. 집중 시간에는 알림을 잠시 꺼두는 건 어떠세요?";
        if (counts['불필요한 생각'] >= 2) return "성장 인사이트: [불필요한 생각]이 몰입을 방해하고 있어요. 집중 시작 전, 생각을 비워내는 '브레인 덤프'가 도움이 될 거예요.";
        return "특별한 패턴 없이 꾸준하게 집중하고 계시는군요. 멋져요!";
    };
    const getSystemSuggestion = (tag) => {
        const suggestions = {
            '업무 외 검색': { title: "사이트 집중 모드", description: "추천 시스템: 집중 시간에는 허용된 사이트 외의 접속을 막아주는 '사이트 차단 확장 프로그램'을 활용해보세요. 의도치 않은 시간 낭비를 막을 수 있습니다." },
            '불필요한 생각': { title: "브레인 덤프", description: "추천 시스템: 집중을 시작하기 전 2분 동안, 머릿속에 떠오르는 모든 생각을 글로 적어내보세요. 뇌를 비우고 현재 과제에 완전히 몰입하는 데 도움이 될 거예요." },
            '메신저 확인': { title: "메시지 확인 타임블록", description: "추천 시스템: 집중 시간에는 메신저를 완전히 종료하고, 휴식 시간에만 확인하는 규칙을 만들어보세요. 소통과 집중의 균형을 찾을 수 있습니다." }
        };
        return { ...(suggestions[tag] || { title: "나만의 시스템 만들기", description: `[${tag}] 마찰을 해결하기 위한 자신만의 시스템을 구축해보세요. 예를 들어, [주변 소음]이 문제라면 '노이즈 캔슬링 헤드폰 사용'을 시스템으로 만들 수 있어요.` }), targetFriction: tag };
    };
    return { generateDailyReport, getSystemSuggestion, getCurrentReportData: () => currentReportData };
})();

/**
 * @module Stats
 * @description 마찰 통계 대시보드 관리.
 */
const Stats = (() => {
    let chartInstance = null;
    const show = async () => {
        UI.toggleModal('stats-modal', true);
        await render();
    };
    const handlePeriodChange = async () => await render();
    const render = async () => {
        const user = Auth.getCurrentUser();
        if (!user) return;
        const dom = UI.getStatsDOM();
        if (!dom.content) return;
        dom.content.innerHTML = '<p>데이터를 불러오는 중입니다...</p>';

        try {
            const days = parseInt(dom.periodSelect.value, 10);
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - days);

            const logs = await FirebaseAPI.getLogsByDateRange(user.uid, startDate, endDate);

            if (logs.length === 0) {
                dom.content.innerHTML = '<p>선택된 기간의 데이터가 없습니다.</p>';
                return;
            }

            const frictionCounts = logs.flatMap(log => log.frictionTags).reduce((acc, tag) => ({ ...acc, [tag]: (acc[tag] || 0) + 1 }), {});
            const sortedFrictions = Object.entries(frictionCounts).sort(([,a],[,b]) => b - a);

            dom.content.innerHTML = `
                <div class="report__stat">
                    <p class="report__title">가장 잦았던 마찰 Top 3</p>
                    <ul class="report__list">
                        ${sortedFrictions.slice(0, 3).map(([tag, count]) => `<li>${tag} (${count}회)</li>`).join('') || '<li>기록된 마찰이 없습니다.</li>'}
                    </ul>
                </div>
                <div><canvas id="frictionChart"></canvas></div>
                <p class="stats-insight">${generateInsight(sortedFrictions[0]?.[0])}</p>
            `;

            if (chartInstance) chartInstance.destroy();
            const ctx = document.getElementById('frictionChart').getContext('2d');
            chartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: sortedFrictions.map(([tag]) => tag),
                    datasets: [{
                        label: '마찰 횟수',
                        data: sortedFrictions.map(([, count]) => count),
                        backgroundColor: 'rgba(59, 91, 219, 0.7)',
                        borderColor: 'rgba(59, 91, 219, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
                    plugins: { legend: { display: false } }
                }
            });
        } catch (error) {
            console.error("통계 렌더링 오류:", error);
            dom.content.innerHTML = '<p>통계를 불러오는 중 오류가 발생했습니다.</p>';
        }
    };
    const generateInsight = (topFriction) => {
        if (!topFriction) return "마찰 데이터가 충분히 쌓이면 더 깊이있는 분석을 제공해드릴게요.";
        return `가장 큰 마찰은 [${topFriction}]이었습니다. 이 마찰을 해결할 '나의 시스템'을 만들어보는 건 어떨까요?`;
    };
    return { show, handlePeriodChange };
})();


/**
 * @module Systems
 * @description '나의 시스템' 라이브러리 관리.
 */
const Systems = (() => {
    const showMySystems = async () => {
        const user = Auth.getCurrentUser();
        if (!user) return;
        try {
            const systems = await FirebaseAPI.getSystems(user.uid);
            UI.renderMySystems(systems.map(s => ({ ...s, adoptedAt: s.adoptedAt.toDate() })));
            UI.toggleModal('my-systems-modal', true);
        } catch (error) { console.error("시스템 로딩 중 오류:", error); }
    };
    const adoptSystem = async (e) => {
        const user = Auth.getCurrentUser();
        if (!user) return;
        const suggestion = JSON.parse(e.target.dataset.suggestion);
        try {
            await FirebaseAPI.addSystem(user.uid, { ...suggestion, adoptedAt: serverTimestamp() });
            UI.toggleModal('system-suggestion-modal', false);
            alert(`[${suggestion.title}] 시스템이 나의 성장 시스템에 추가되었어요.`);
        } catch (error) { console.error("시스템 추가 중 오류:", error); }
    };
    const handleSystemListClick = async (e) => {
        if (e.target.dataset.action !== 'delete-system') return;
        const user = Auth.getCurrentUser();
        const card = e.target.closest('.system-card');
        if (!user || !card) return;
        if (confirm("이 시스템을 정말 삭제할까요? 이 결정은 되돌릴 수 없어요.")) {
            try { await FirebaseAPI.deleteSystem(user.uid, card.dataset.id); card.remove(); }
            catch (error) { console.error("시스템 삭제 중 오류:", error); }
        }
    };
    return { showMySystems, adoptSystem, handleSystemListClick };
})();


/**
 * @module Gamification
 * @description 레벨, 스트릭, 뱃지 등 게임화 요소 관리.
 */
const Gamification = (() => {
    let profile = { level: 1, totalFocusMinutes: 0, streak: 0, lastSessionDate: null, badges: [], dailyGoals: {} };
    let dailyProgress = { energy: 0, sessions: 0, goal: 8, goalSet: false };
    const getTodayString = () => new Date().toISOString().split('T')[0];

    const loadProfile = async () => {
        const user = Auth.getCurrentUser();
        if (!user) return;
        const profileSnap = await FirebaseAPI.getUserProfile(user.uid);
        if (profileSnap.exists()) {
            profile = profileSnap.data();
            UI.updateGamificationStats(profile.level, profile.streak);
            loadDailyProgress();
        }
    };
    const loadDailyProgress = () => {
        const todayStr = getTodayString();
        const goalData = profile.dailyGoals?.[todayStr];
        dailyProgress = goalData ? { ...goalData } : { energy: 0, sessions: 0, goal: profile.dailyGoals?.defaultGoal || 8, goalSet: false };
        UI.updateForestDisplay(dailyProgress.sessions, dailyProgress.goal);
        UI.updateGoalProgress(dailyProgress.energy, dailyProgress.goal);
        UI.lockGoalSetting(dailyProgress.goalSet);
    };
    const setDailyGoal = async () => {
        if (dailyProgress.goalSet) return alert("오늘의 목표는 이미 설정되었어요.");
        const goal = UI.getDailyGoal();
        if (!goal || isNaN(goal) || goal <= 0) return alert("달성 가능한 목표를 설정해주세요.");

        dailyProgress.goal = goal;
        dailyProgress.goalSet = true;
        profile.dailyGoals.defaultGoal = goal; // 다음 날을 위한 기본값 저장

        UI.updateForestDisplay(dailyProgress.sessions, dailyProgress.goal);
        UI.updateGoalProgress(dailyProgress.energy, dailyProgress.goal);
        UI.lockGoalSetting(true);

        await saveDailyProgress();
        alert(`오늘의 성장 목표가 ${goal} 세트로 설정되었어요. 응원할게요!`);
    };
    const updateFocusSession = (duration) => {
        const energy = duration >= 50 ? 2.5 : duration >= 30 ? 1.5 : 1.0;
        dailyProgress.energy += energy;
        dailyProgress.sessions += 1;

        UI.updateForestDisplay(dailyProgress.sessions, dailyProgress.goal);
        UI.updateGoalProgress(dailyProgress.energy, dailyProgress.goal);

        if (dailyProgress.goal > 0 && dailyProgress.sessions >= dailyProgress.goal && dailyProgress.sessions - 1 < dailyProgress.goal) {
            alert("🎉 목표 달성! 꾸준함이 당신을 성장시킵니다. 정말 대단해요!");
            Notifications.show('목표 달성!', { body: '오늘의 성장 목표를 완수했어요! 축하합니다.' });
        }

        profile.totalFocusMinutes += duration;
        const newLevel = Math.floor(profile.totalFocusMinutes / 60) + 1;
        if (newLevel > profile.level) {
            profile.level = newLevel;
            alert(`✨ 레벨업! 성장 레벨 ${newLevel}을 달성했어요!`);
            Notifications.show('레벨업!', { body: `성장 레벨 ${newLevel} 달성을 축하합니다!` });
        }
        saveProfile();
        saveDailyProgress();
    };
    const updateStreak = async () => {
        const todayStr = new Date().toDateString();
        const lastDate = profile.lastSessionDate?.toDate();
        if (lastDate?.toDateString() !== todayStr) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            profile.streak = lastDate?.toDateString() === yesterday.toDateString() ? profile.streak + 1 : 1;
            profile.lastSessionDate = Timestamp.now();
            await saveProfile();
        }
    };
    const checkBadges = async (logs) => {
        const earned = [];
        const frictionCounts = logs.flatMap(log => log.frictionTags).reduce((acc, tag) => ({ ...acc, [tag]: (acc[tag] || 0) + 1 }), {});
        const badgeConditions = {
            'friction-slayer': { name: '마찰 해결사', condition: () => Object.keys(frictionCounts).length > 0 && logs.length >= 5 },
            'deep-diver': { name: '몰입의 대가', condition: () => logs.some(log => log.sessionDuration >= 50) }
        };
        for (const [id, badge] of Object.entries(badgeConditions)) {
            if (!profile.badges?.includes(id) && badge.condition()) {
                earned.push(badge);
                if (!profile.badges) profile.badges = [];
                profile.badges.push(id);
            }
        }
        if (earned.length > 0) await saveProfile();
        return earned;
    };
    const saveProfile = async () => {
        const user = Auth.getCurrentUser();
        if (!user) return;
        await FirebaseAPI.updateUserProfile(user.uid, profile);
        UI.updateGamificationStats(profile.level, profile.streak);
    };
    const saveDailyProgress = async () => {
        const user = Auth.getCurrentUser();
        if (!user) return;
        const todayStr = getTodayString();
        if (!profile.dailyGoals) profile.dailyGoals = {};
        profile.dailyGoals[todayStr] = dailyProgress;
        await FirebaseAPI.updateUserProfile(user.uid, { dailyGoals: profile.dailyGoals });
    };

    return { loadProfile, setDailyGoal, updateFocusSession, updateStreak, checkBadges };
})();


/**
 * @module App
 * @description 애플리케이션 최상위 컨트롤러.
 */
const App = (() => {
    const init = () => {
        if (!FirebaseAPI.init()) return;
        UI.init();
        Auth.init(); // 단일 사용자 모드 초기화
        Notifications.requestPermission();
        Favicon.set('default');
        Timer.setConfig(25, 5, '보통');
    };
    
    const handlePresetSelect = (e) => {
        const btn = e.target.closest('.button--preset');
        if (!btn) return;
        Timer.setConfig(
            parseInt(btn.dataset.focus, 10),
            parseInt(btn.dataset.rest, 10),
            btn.dataset.condition
        );
    };
    const handleShowSystem = () => {
        const reportData = Report.getCurrentReportData();
        if (reportData?.topFrictionTag) UI.showSystemSuggestion(Report.getSystemSuggestion(reportData.topFrictionTag));
    };
    const handleSoundChange = async (type, value) => {
        const user = Auth.getCurrentUser();
        if (!user) return;
        const settings = { [type]: value };
        Timer.applySettings(settings);
        await FirebaseAPI.updateUserSettings(user.uid, settings);
    };
    const handleEnhancedRestToggle = async (e) => {
        const user = Auth.getCurrentUser();
        if (!user) return;
        const enabled = e.target.checked;
        Timer.applySettings({ enhancedRest: enabled });
        UI.toggleEnhancedRestUI(enabled);
        await FirebaseAPI.updateUserSettings(user.uid, { enhancedRest: enabled });
    };

    return { init, handlePresetSelect, handleShowSystem, handleSoundChange, handleEnhancedRestToggle };
})();

document.addEventListener('DOMContentLoaded', App.init);
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

// Chart.js 관련 import 코드는 모두 삭제되었습니다.

// ===================================================================================
// Firebase 프로젝트 구성 정보
// ===================================================================================
const firebaseConfig = {
  apiKey: "AIzaSyCr_ntgN9h3nTO4kE2L915QKjgOXkL38vw",
  authDomain: "friction-zero-os.firebaseapp.com",
  projectId: "friction-zero-os",
  storageBucket: "friction-zero-os.firebasestorage.app",
  messagingSenderId: "819091253027",
  appId: "1:819091253027:web:40561c2ce96"
};


/**
 * @module FirebaseAPI
 * @description Firebase SDK와의 모든 상호작용을 추상화.
 */
const FirebaseAPI = (() => {
    let app, db;

    const init = () => {
        if (!firebaseConfig.apiKey || firebaseConfig.apiKey.includes("YOUR_NEW_API_KEY")) {
            console.error("Firebase 설정이 올바르지 않습니다. 관리자에게 문의하거나 설정을 다시 확인해주세요.");
            alert("서비스 연결에 문제가 발생했습니다. 잠시 후 다시 시도하거나 관리자에게 문의해주세요.");
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
            lastActiveDate: null, // streak 계산용
            createdAt: serverTimestamp(),
            badges: [],
            dailyProgressLog: {}, // 일일 진행상황 저장
            totalTrees: 0, // 총 나무 수
            forest: [] // 심은 나무 종류 저장 (가변 보상용)
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
            'my-systems-list', 'daily-goal-input', 'set-goal-btn', 'daily-goal-container', 'seeds-display',
            'alarm-sound-select', 'rest-sound-select', 'enhanced-rest-toggle', 'sound-therapy-container',
            'session-transition-modal', 'transition-icon', 'transition-title',
            'transition-message', 'transition-action-btn', 'positive-priming', 'positive-priming-text',
            'timer-mode', 'timer-clock', 'rest-suggestion-container', 'total-trees-count', 'forest-dormant-message', 'forest-widget',
            'rest-suggestion-text', 'reset-confirm-modal', 'cancel-reset-btn', 'confirm-reset-btn',
            'stats-modal', 'stats-period-select', 'stats-content', 'my-forest-visualization', 'frictionByTimeChart'
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
        dom.setGoalBtn?.addEventListener('click', Gamification.setSeedGoal);
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
            dom.timerProgressTime.style.stroke = mode === '집중 시간' ? 'var(--primary-color)' : 'var(--success-color)';
        }
    };

    const showRestSuggestion = (show, text = '') => {
        if (!dom.restSuggestionContainer || !dom.restSuggestionText) return;
        dom.restSuggestionContainer.classList.toggle('hidden', !show);
        dom.restSuggestionText.textContent = text;
    };

    const updateTimerControls = (state) => {
        if (!dom.startBtn || !dom.pauseBtn) return;
        dom.startBtn.textContent = state === 'paused' ? '집중 이어하기' : '집중하기';
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
    
    const renderSeeds = (completed, total, specialIndices = []) => {
        if (!dom.seedsDisplay) return;
        let html = '';
        for (let i = 0; i < total; i++) {
            if (i < completed) {
                const isSpecial = specialIndices.includes(i);
                html += `<span class="sprout-icon ${isSpecial ? 'special' : ''}">${isSpecial ? '✨' : '🌱'}</span>`;
            } else {
                html += `<span class="seed-icon">🌰</span>`;
            }
        }
        dom.seedsDisplay.innerHTML = html || '<span style="font-size: 0.9rem; color: var(--text-light-color);">오늘 심을 씨앗 수를 정하고 집중을 시작하세요.</span>';
        if (dom.dailyGoalInput) dom.dailyGoalInput.value = total;

        const percentage = total > 0 ? Math.min(completed / total, 1) : 0;
        if (dom.timerProgressGoal) {
            dom.timerProgressGoal.style.strokeDashoffset = CIRCLE_CIRCUMFERENCE * (1 - percentage);
        }
    };

    const renderForestSummary = (totalTrees, isDormant) => {
        if (dom.totalTreesCount) dom.totalTreesCount.textContent = totalTrees;
        if (dom.forestDormantMessage) dom.forestDormantMessage.classList.toggle('hidden', !isDormant);
        if (dom.forestWidget) dom.forestWidget.classList.toggle('dormant', isDormant);
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

    const showPositivePriming = (message, isWakeUp = false) => {
        if (!dom.positivePrimingText || !dom.positivePriming) return;
        dom.positivePrimingText.innerHTML = message; // innerHTML to allow line breaks
        dom.positivePriming.classList.add('positive-priming--visible');
        setTimeout(() => dom.positivePriming.classList.remove('positive-priming--visible'), isWakeUp ? 3000 : 1500);
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
        const { totalFocusMinutes, energy, topFrictions, insight, newTrees, specialTrees } = reportData;
        const topFrictionsHTML = topFrictions.length > 0 ? topFrictions.map(f => `<li>${f.tag} (${f.count}회)</li>`).join('') : '<li>오늘은 방해 요인 없이 순항하셨네요! 멋져요.</li>';
        const newTreesHTML = newTrees > 0 ? `<div class="report__stat"><p class="report__title">오늘 자라난 나무</p><p class="report__value">${newTrees}그루 ${specialTrees > 0 ? '(✨' + specialTrees + ')' : ''}</p></div>` : '';

        dom.reportContent.innerHTML = `<div class="report__grid">${newTreesHTML}<div class="report__stat"><p class="report__title">총 몰입 시간</p><p class="report__value">${totalFocusMinutes}분</p></div></div><div class="report__stat"><p class="report__title">주요 방해 요인</p><ul class="report__list">${topFrictionsHTML}</ul></div>${insight ? `<div class="report__insight"><p>${insight}</p></div>` : ''}`;
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
        dom.mySystemsList.innerHTML = systems.length === 0 ? `<p>아직 나만의 성장 규칙이 없네요. 리포트 분석을 통해 첫 번째 규칙을 만들어 보세요.</p>` : systems.map(system => `<div class="system-card" data-id="${system.id}"><div class="system-card__header"><h3 class="system-card__title">${system.title}</h3><span class="system-card__tag">${system.targetFriction}</span></div><p class="system-card__description">${system.description}</p><div class="system-card__footer"><span>추가한 날짜: ${system.adoptedAt.toLocaleDateString()}</span><button class="button button--danger" data-action="delete-system">삭제</button></div></div>`).join('');
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
        renderReport, showSystemSuggestion, renderMySystems, renderSeeds, renderForestSummary,
        showSessionTransitionModal, showPositivePriming, updateActivePreset, showRestSuggestion,
        lockGoalSetting, toggleEnhancedRestUI,
        getLogFormData: () => ({
            activity: dom.logActivity.value,
            frictionTags: Array.from(dom.frictionTags.querySelectorAll('.tag-group__tag--selected')).map(t => t.dataset.tag),
            emotionTags: Array.from(dom.emotionTags.querySelectorAll('.tag-group__tag--selected')).map(t => t.dataset.tag)
        }),
        getDailyGoal: () => parseInt(dom.dailyGoalInput.value, 10),
        getStatsDOM: () => ({ 
            content: dom.statsContent, 
            periodSelect: dom.statsPeriodSelect,
            myForestVisualization: dom.myForestVisualization,
            frictionByTimeChart: dom.frictionByTimeChart,
        }),
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
    let state = { timerId: null, totalSeconds: 1500, remainingSeconds: 1500, mode: '집중 시간', status: 'idle' };
    let config = { focusDuration: 25, restDuration: 5, condition: '보통' };
    let settings = { enhancedRest: false, alarmSound: 'alarm_clock.ogg', restSound: 'none' };
    let alarmAudio, restAudio;
    const positiveMessages = ["최고의 몰입을 경험할 시간이에요.", "작은 집중이 모여 큰 성장을 만들어요.", "가장 중요한 일에 에너지를 쏟아보세요.", "지금 이 순간의 몰입이 내일의 당신을 만들어요."];
    const restSuggestions = { short: "가볍게 눈을 감고 1분간 명상해 보세요.", long: "자리에서 일어나 간단한 스트레칭은 어떠세요?" };

    const tick = () => {
        state.remainingSeconds--;
        UI.updateTimerDisplay(formatTime(state.remainingSeconds), state.mode, state.remainingSeconds, state.totalSeconds);
        if (state.remainingSeconds <= 0) completeSession();
    };

    const completeSession = () => {
        clearInterval(state.timerId);
        state.status = 'idle';
        alarmAudio?.play();
        Favicon.set('default');

        if (state.mode === '집중 시간') {
            Gamification.updateFocusSession(config.focusDuration);
            Logger.triggerLogPopup(); // 세션 종료 후 로그 팝업 호출
        } else {
            // 휴식 시간 종료 후 바로 다음 집중 세션 시작
            startNextFocusSession();
        }
    };
    
    // 로그 기록 후 다음 세션을 시작하기 위한 함수
    const startNextPhase = () => {
        if(state.mode === '집중 시간') { // 이제 휴식 시간으로 전환
            state.mode = '휴식 시간';
            state.totalSeconds = config.restDuration * 60;
            const suggestion = config.restDuration >= 10 ? restSuggestions.long : restSuggestions.short;
            UI.showSessionTransitionModal({ icon: '☕', title: '정말 고생 많으셨어요! 잠시 쉬어갈 시간이에요', message: `${config.restDuration}분간 재충전하며 다음 집중을 준비해 보세요.`, buttonText: '휴식하기', buttonClass: 'button--secondary' });
            Notifications.show('고생하셨어요!', { body: `${config.restDuration}분간 휴식하며 다음 집중을 준비하세요.` });
            if (settings.enhancedRest) {
                 UI.showRestSuggestion(true, suggestion);
                 if (settings.restSound !== 'none') { restAudio?.play(); }
            }
        } else { // 휴식 끝, 집중 시간으로 전환
            startNextFocusSession();
        }
    };

    const startNextFocusSession = () => {
        state.mode = '집중 시간';
        state.totalSeconds = config.focusDuration * 60;
        UI.showSessionTransitionModal({ icon: '🔥', title: '다시 집중할 시간이에요!', message: `${config.focusDuration}분간 다시 한번 몰입해 보세요.`, buttonText: '집중하기', buttonClass: 'button--primary' });
        Notifications.show('다시 집중할 시간이에요', { body: `이제 ${config.focusDuration}분간 다시 한번 몰입해 보세요.` });
        if (settings.enhancedRest) {
            UI.showRestSuggestion(false);
            restAudio?.pause();
        }
    };
    
    const startNextSession = () => {
        UI.toggleModal('session-transition-modal', false);
        state.remainingSeconds = state.totalSeconds;
        UI.updateTimerDisplay(formatTime(state.remainingSeconds), state.mode, state.remainingSeconds, state.totalSeconds);
        UI.updateTimerControls(state.status);
        start();
    };

    const formatTime = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

    const start = () => {
        if (state.status === 'running') return;
        const isNewFocus = state.mode === '집중 시간' && state.remainingSeconds === state.totalSeconds;
        if (isNewFocus) {
            const isWakingUp = Gamification.isForestDormant();
            const message = isWakingUp 
                ? "오랜만이에요! <br> 당신의 첫 집중으로 숲이 다시 깨어납니다." 
                : positiveMessages[Math.floor(Math.random() * positiveMessages.length)];
            UI.showPositivePriming(message, isWakingUp);
        }
        
        setTimeout(() => {
            state.status = 'running';
            Favicon.set(state.mode === '집중 시간' ? 'focus' : 'rest');
            state.timerId = setInterval(tick, 1000);
            UI.updateTimerControls(state.status);
        }, isNewFocus ? (Gamification.isForestDormant() ? 3100 : 1600) : 0);
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
        state = { ...state, status: 'idle', remainingSeconds: state.totalSeconds };
        Favicon.set('default');
        UI.updateTimerDisplay(formatTime(state.remainingSeconds), state.mode, state.remainingSeconds, state.totalSeconds);
        UI.updateTimerControls(state.status);
        UI.showRestSuggestion(false);
        restAudio?.pause();
    };

    const applySettings = (newSettings) => {
        settings = { ...settings, ...newSettings };
        alarmAudio = new Audio(`sounds/${settings.alarmSound}`);
        if (settings.restSound !== 'none') {
            restAudio = new Audio(`sounds/${settings.restSound}`);
            restAudio.loop = true;
        } else {
            restAudio = null;
        }
    };

    return {
        start, pause, reset, startNextSession, applySettings, startNextPhase,
        setConfig: (focus, rest, condition) => {
            config = { focusDuration: focus, restDuration: rest, condition };
            state.mode = '집중 시간';
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
    const triggerLogPopup = () => UI.toggleModal('log-modal', true);
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
            Timer.startNextPhase(); // 로그 기록 후 다음 단계(휴식 또는 다음 세션) 시작
        } catch (error) { console.error("기록 저장 중 오류:", error); alert("기록 저장 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요."); }
    };
    return { triggerLogPopup, handleLogSubmit, handleDistractionInput };
})();


/**
 * @module Report
 * @description 데일리 리포트 생성 및 '하루 마무리' 로직 담당.
 */
const Report = (() => {
    let currentReportData = null;
    const analyzeLogs = (logs) => {
        const totalFocusMinutes = logs.reduce((sum, log) => sum + log.sessionDuration, 0);
        const frictionCounts = logs.flatMap(log => log.frictionTags).reduce((acc, tag) => ({ ...acc, [tag]: (acc[tag] || 0) + 1 }), {});
        const topFrictions = Object.entries(frictionCounts).sort(([, a], [, b]) => b - a).slice(0, 3).map(([tag, count]) => ({ tag, count }));
        const energy = logs.reduce((sum, log) => sum + (log.sessionDuration >= 50 ? 2 : 1), 0);
        return { totalFocusMinutes, energy, topFrictions, topFrictionTag: topFrictions[0]?.tag || null, frictionCounts };
    };
    const generateDailyReport = async () => {
        const user = Auth.getCurrentUser();
        if (!user) return;
        try {
            const today = new Date();
            const logs = await FirebaseAPI.getLogsByDateRange(user.uid, new Date(today.setHours(0, 0, 0, 0)), new Date(today.setHours(23, 59, 59, 999)));
            if (logs.length === 0) return alert("오늘의 집중 기록이 없네요. '하루 마무리'를 하려면 최소 1번의 집중을 완료해야 해요.");

            const { newTrees, specialTrees } = await Gamification.finalizeDailyGrowth();
            const analysis = analyzeLogs(logs);
            const insight = generateInsight(analysis.frictionCounts);

            currentReportData = { ...analysis, insight, newTrees, specialTrees };
            UI.renderReport(currentReportData);

            await Gamification.updateStreak();
            await Gamification.loadProfile(); // 프로필 및 UI 새로고침
            
        } catch (error) { console.error("리포트 생성 중 오류:", error); }
    };
    const generateInsight = (counts) => {
        if (counts['업무 외 검색'] >= 2) return "[업무 외 검색]으로 몰입이 자주 끊어지는 경향을 발견했어요.";
        if (counts['메신저 확인'] >= 3) return "[메신저 확인]이 잦은 편이네요. 집중할 땐 잠시 알림을 꺼두는 건 어떠세요?";
        if (counts['불필요한 생각'] >= 2) return "[불필요한 생각]이 몰입을 방해하고 있군요. 집중 전에 '브레인 덤프'로 생각을 비워내면 도움이 될 거예요.";
        return "특별한 방해 없이 꾸준히 집중하고 계시네요. 정말 멋져요!";
    };
    const getSystemSuggestion = (tag) => {
        const suggestions = {
            '업무 외 검색': { title: "사이트 집중 모드", description: "추천 규칙: 집중 시간에는 꼭 필요한 사이트만 열어두는 '집중 모드'를 활용해 보세요. 의도치 않은 시간 낭비를 막을 수 있어요." },
            '불필요한 생각': { title: "브레인 덤프", description: "추천 규칙: 집중 시작 전 2분간 머릿속 생각을 모두 적어내는 '브레인 덤프'를 시작해 보세요. 생각을 비우고 현재 과제에 몰입하는 데 도움이 될 거예요." },
            '메신저 확인': { title: "메시지 확인 타임블록", description: "추천 규칙: 집중 시간에는 메신저를 잠시 꺼두고, 휴식 시간에만 확인하는 규칙을 만들어 보세요. 소통과 집중의 균형을 찾을 수 있을 거예요." }
        };
        return { ...(suggestions[tag] || { title: "나만의 규칙 만들기", description: `[${tag}] 문제를 해결하기 위한 자신만의 규칙을 만들어보세요. 예를 들어, [주변 소음]이 문제라면 '노이즈 캔슬링 헤드폰 사용하기' 같은 규칙을 만들 수 있어요.` }), targetFriction: tag };
    };
 
    return { generateDailyReport, getSystemSuggestion, getCurrentReportData: () => currentReportData };
})();

/**
 * @module Stats
 * @description '성장 리포트' 대시보드 관리.
 */
const Stats = (() => {
    let frictionByTimeChartInstance = null;
    let areControllersRegistered = false; 

    const registerControllers = () => {
        if (areControllersRegistered) return;
        try {
            const { Chart, SankeyController, Flow } = window;
            if (Chart && SankeyController && Flow) {
                Chart.register(SankeyController, Flow);
                areControllersRegistered = true;
            } else {
                console.error('Chart.js 또는 Sankey 컨트롤러를 window 객체에서 찾을 수 없습니다.');
            }
        } catch (e) {
            console.error('Chart.js 컨트롤러 등록에 실패했습니다:', e);
        }
    };

    const show = async () => {
        UI.toggleModal('stats-modal', true);
        await render();
    };
    
    const handlePeriodChange = async () => await render();

    const analyzeFrictionByTimeOfDay = (logs) => {
        const timeSlots = { '오전 (6-12)': 0, '점심 (12-14)': 0, '오후 (14-18)': 0, '저녁 (18-24)': 0, '밤 (0-6)': 0 };
        logs.forEach(log => {
            if (log.frictionTags.length > 0 && log.timestamp) {
                const hour = log.timestamp.toDate().getHours();
                if (hour >= 6 && hour < 12) timeSlots['오전 (6-12)'] += log.frictionTags.length;
                else if (hour >= 12 && hour < 14) timeSlots['점심 (12-14)'] += log.frictionTags.length;
                else if (hour >= 14 && hour < 18) timeSlots['오후 (14-18)'] += log.frictionTags.length;
                else if (hour >= 18 && hour < 24) timeSlots['저녁 (18-24)'] += log.frictionTags.length;
                else timeSlots['밤 (0-6)'] += log.frictionTags.length;
            }
        });
        return timeSlots;
    };

    const renderMyForest = (forestData) => {
        const dom = UI.getStatsDOM();
        if (!dom.myForestVisualization) return;

        let forestHTML = '';
        if (!forestData || forestData.totalTrees === 0) {
            forestHTML = '<p>아직 심은 나무가 없어요. 오늘 첫 나무를 심어보세요!</p>';
        } else {
            for (let i = 0; i < forestData.totalTrees; i++) {
                // 'forest' 배열에 저장된 특별 나무 정보를 바탕으로 시각화 (향후 확장 가능)
                // 지금은 단순 개수 기반으로 일부를 특별 나무로 표시
                const isSpecial = i < forestData.specialTreesCount;
                forestHTML += `<span class="tree-icon ${isSpecial ? 'special' : ''}">${isSpecial ? '✨' : '🌳'}</span>`;
            }
        }
        dom.myForestVisualization.innerHTML = forestHTML;
    };
    
    const render = async () => {
        registerControllers(); 

        const user = Auth.getCurrentUser();
        if (!user) return;
        const dom = UI.getStatsDOM();
        if (!dom.content) return;
        dom.content.innerHTML = '<p>성장 리포트를 불러오는 중입니다...</p>';

        try {
            const days = parseInt(dom.periodSelect.value, 10);
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - days);

            const logs = await FirebaseAPI.getLogsByDateRange(user.uid, startDate, endDate);
            
            // 나의 숲 데이터 렌더링
            const forestData = Gamification.getForestData();
            renderMyForest(forestData);

            if (logs.length === 0) {
                dom.content.innerHTML += '<p>선택하신 기간의 데이터가 없습니다.</p>';
                // 숲 시각화는 유지되도록 구조 변경
                const container = document.getElementById('friction-by-time-chart-container');
                if (container) container.innerHTML = '<p>선택하신 기간의 데이터가 없습니다.</p>';
                return;
            }

            const frictionByTimeData = analyzeFrictionByTimeOfDay(logs);
            
            // 시간대별 차트 렌더링
            if (frictionByTimeChartInstance) frictionByTimeChartInstance.destroy();
            const timeCtx = dom.frictionByTimeChart?.getContext('2d');
            
            if (timeCtx) {
                frictionByTimeChartInstance = new Chart(timeCtx, {
                    type: 'line',
                    data: {
                        labels: Object.keys(frictionByTimeData),
                        datasets: [{
                            label: '시간대별 방해 요인',
                            data: Object.values(frictionByTimeData),
                            borderColor: 'rgba(59, 91, 219, 0.7)',
                            backgroundColor: 'rgba(59, 91, 219, 0.1)',
                            fill: true,
                            tension: 0.4
                        }]
                    },
                    options: { 
                        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }, 
                        plugins: { legend: { display: false } }
                    }
                });
            }

        } catch (error) {
            console.error("성장 리포트 렌더링 오류:", error);
            dom.content.innerHTML = '<p>리포트를 불러오는 중 오류가 발생했습니다.</p>';
        }
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
            alert(`'${suggestion.title}' 규칙이 추가되었어요.`);
        } catch (error) { console.error("시스템 추가 중 오류:", error); }
    };
    const handleSystemListClick = async (e) => {
        if (e.target.dataset.action !== 'delete-system') return;
        const user = Auth.getCurrentUser();
        const card = e.target.closest('.system-card');
        if (!user || !card) return;
        if (confirm("이 규칙을 정말 삭제할까요? 삭제한 규칙은 되돌릴 수 없어요.")) {
            try { await FirebaseAPI.deleteSystem(user.uid, card.dataset.id); card.remove(); }
            catch (error) { console.error("시스템 삭제 중 오류:", error); }
        }
    };
    return { showMySystems, adoptSystem, handleSystemListClick };
})();


/**
 * @module Gamification
 * @description '성장의 숲' 시스템을 포함한 모든 게임화 요소 관리
 */
const Gamification = (() => {
    let profile = { level: 1, totalFocusMinutes: 0, streak: 0, lastActiveDate: null, badges: [], totalTrees: 0, forest: [], dailyProgressLog: {}, isDormant: false };
    let dailyProgress = { seedGoal: 8, seedsCompleted: 0, goalSet: false, specialTreesToday: [] };
    let consecutiveFocusSessions = 0;
    const getTodayString = () => new Date().toISOString().split('T')[0];

    const loadProfile = async () => {
        const user = Auth.getCurrentUser();
        if (!user) return;
        const profileSnap = await FirebaseAPI.getUserProfile(user.uid);
        if (profileSnap.exists()) {
            profile = profileSnap.data();
            
            // 휴면 상태 체크
            const lastDate = profile.lastActiveDate?.toDate();
            if (lastDate) {
                const today = new Date();
                const diffTime = Math.abs(today - lastDate);
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                profile.isDormant = diffDays >= 3;
            } else {
                 profile.isDormant = false;
            }

            UI.updateGamificationStats(profile.level, profile.streak);
            UI.renderForestSummary(profile.totalTrees || 0, profile.isDormant);
            loadDailyProgress();
        }
    };

    const loadDailyProgress = () => {
        const todayStr = getTodayString();
        const progressData = profile.dailyProgressLog?.[todayStr];
        dailyProgress = progressData ? { ...progressData } : { seedGoal: 8, seedsCompleted: 0, goalSet: false, specialTreesToday: [] };
        UI.renderSeeds(dailyProgress.seedsCompleted, dailyProgress.seedGoal, dailyProgress.specialTreesToday);
        UI.lockGoalSetting(dailyProgress.goalSet);
    };

    const setSeedGoal = async () => {
        if (dailyProgress.goalSet) return alert("오늘의 목표는 이미 설정되었어요.");
        const goal = UI.getDailyGoal();
        if (!goal || isNaN(goal) || goal <= 0) return alert("1 이상의 씨앗 목표를 설정해 주세요.");

        dailyProgress.seedGoal = goal;
        dailyProgress.goalSet = true;

        UI.renderSeeds(dailyProgress.seedsCompleted, dailyProgress.seedGoal, dailyProgress.specialTreesToday);
        UI.lockGoalSetting(true);

        await saveDailyProgress();
        alert(`오늘 심을 씨앗이 ${goal}개로 설정되었어요. 응원할게요!`);
    };

    const updateFocusSession = (duration) => {
        if (profile.isDormant) {
            profile.isDormant = false;
            UI.renderForestSummary(profile.totalTrees, false);
            Notifications.show('🌳 숲이 깨어났어요!', { body: '당신의 노력으로 숲이 다시 활기를 되찾았어요!' });
        }
        
        dailyProgress.seedsCompleted++;
        consecutiveFocusSessions++;

        // 가변 보상: 3연속 집중 시 특별한 새싹
        if (consecutiveFocusSessions === 3) {
            dailyProgress.specialTreesToday.push(dailyProgress.seedsCompleted - 1);
            consecutiveFocusSessions = 0; // 카운터 리셋
        }

        UI.renderSeeds(dailyProgress.seedsCompleted, dailyProgress.seedGoal, dailyProgress.specialTreesToday);

        if (dailyProgress.seedGoal > 0 && dailyProgress.seedsCompleted >= dailyProgress.seedGoal && (dailyProgress.seedsCompleted - 1) < dailyProgress.seedGoal) {
            alert("🎉 목표 달성! 오늘의 씨앗을 모두 새싹으로 키웠네요!");
            Notifications.show('목표 달성!', { body: '오늘 심기로 한 씨앗을 모두 틔웠어요! 축하합니다.' });
        }

        profile.totalFocusMinutes += duration;
        const newLevel = Math.floor(profile.totalFocusMinutes / 60) + 1;
        if (newLevel > profile.level) {
            profile.level = newLevel;
            alert(`✨ 레벨업! ${newLevel} 레벨을 달성했어요!`);
            Notifications.show('레벨업!', { body: `${newLevel} 레벨 달성을 축하합니다!` });
            saveProfile(); // 레벨업 시 즉시 저장
        }
        saveDailyProgress();
    };

    const finalizeDailyGrowth = async () => {
        const todayStr = getTodayString();
        const progress = profile.dailyProgressLog?.[todayStr];
        if (!progress || progress.seedsCompleted === 0) {
            return { newTrees: 0, specialTrees: 0 };
        }
        
        profile.totalTrees = (profile.totalTrees || 0) + progress.seedsCompleted;
        
        const newTreesData = { date: todayStr, count: progress.seedsCompleted, specialCount: progress.specialTreesToday.length };
        if (!profile.forest) profile.forest = [];
        profile.forest.push(newTreesData);
        
        profile.lastActiveDate = Timestamp.now();
        await saveProfile();

        return { newTrees: progress.seedsCompleted, specialTrees: progress.specialTreesToday.length };
    };

    const updateStreak = async () => {
        const today = new Date().toDateString();
        const lastDate = profile.lastActiveDate?.toDate();

        if (lastDate?.toDateString() !== today) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            if (lastDate?.toDateString() === yesterday.toDateString()) {
                profile.streak = (profile.streak || 0) + 1;
            } else {
                profile.streak = 1; // 스트릭 깨지고 다시 시작
            }
            await saveProfile();
        }
    };
    
    const saveProfile = async () => {
        const user = Auth.getCurrentUser();
        if (!user) return;
        await FirebaseAPI.updateUserProfile(user.uid, {
            level: profile.level,
            totalFocusMinutes: profile.totalFocusMinutes,
            streak: profile.streak,
            lastActiveDate: profile.lastActiveDate,
            badges: profile.badges,
            totalTrees: profile.totalTrees,
            forest: profile.forest,
        });
        UI.updateGamificationStats(profile.level, profile.streak);
    };

    const saveDailyProgress = async () => {
        const user = Auth.getCurrentUser();
        if (!user) return;
        const todayStr = getTodayString();
        if (!profile.dailyProgressLog) profile.dailyProgressLog = {};
        profile.dailyProgressLog[todayStr] = dailyProgress;
        await FirebaseAPI.updateUserProfile(user.uid, { dailyProgressLog: profile.dailyProgressLog });
    };

    const getForestData = () => {
        const specialTreesCount = (profile.forest || []).reduce((sum, day) => sum + (day.specialCount || 0), 0);
        return {
            totalTrees: profile.totalTrees || 0,
            specialTreesCount: specialTreesCount
        };
    };

    return { 
        loadProfile, 
        setSeedGoal, 
        updateFocusSession, 
        updateStreak, 
        finalizeDailyGrowth,
        isForestDormant: () => profile.isDormant,
        getForestData,
    };
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


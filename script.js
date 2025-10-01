/* script.js */

// ===================================================================================
// Firebase SDK v9+ (모듈러)
// ===================================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
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


// ===================================================================================
// !!! 중요 !!!
// 아래 객체에 본인의 Firebase 프로젝트의 실제 구성 정보를 붙여넣으세요.
// 이 정보가 없으면 로그인을 포함한 모든 Firebase 기능이 작동하지 않습니다.
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
    let app, auth, db;

    const init = () => {
        if (firebaseConfig.apiKey === "YOUR_API_KEY") {
            console.error("Firebase 구성 정보가 비어있습니다. script.js 파일의 firebaseConfig 객체를 채워주세요.");
            alert("Firebase 설정이 필요합니다. F12를 눌러 콘솔을 확인해주세요.");
            return false;
        }
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        return true;
    };

    const listenAuthStateChange = (callback) => onAuthStateChanged(auth, callback);
    const signUp = (email, password) => createUserWithEmailAndPassword(auth, email, password);
    const signIn = (email, password) => signInWithEmailAndPassword(auth, email, password);
    const logOut = () => signOut(auth);
    const getUserProfile = (userId) => getDoc(doc(db, 'users', userId));
    const createUserProfile = (userId, email) => {
        const userProfileRef = doc(db, 'users', userId);
        const batch = writeBatch(db);
        batch.set(userProfileRef, {
            email, level: 1, totalFocusMinutes: 0, streak: 0,
            lastSessionDate: null, createdAt: serverTimestamp(), badges: [], dailyGoals: {}
        });
        const settingsRef = doc(db, 'users', userId, 'settings', 'default');
        batch.set(settingsRef, { alarmSound: 'alarm_clock.ogg' });
        return batch.commit();
    };
    const updateUserProfile = (userId, data) => setDoc(doc(db, 'users', userId), data, { merge: true });
    const getUserSettings = (userId) => getDoc(doc(db, 'users', userId, 'settings', 'default'));
    const updateUserSettings = (userId, data) => setDoc(doc(db, 'users', userId, 'settings', 'default'), data, { merge: true });
    const saveLog = (userId, logData) => addDoc(collection(db, 'users', userId, 'logs'), logData);
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
        init, listenAuthStateChange, signUp, signIn, logOut, getUserProfile, createUserProfile, updateUserProfile,
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
    const CIRCLE_CIRCUMFERENCE = 339.29; // 2 * PI * 54

    const cacheDOM = () => {
        const ids = [
            'auth-view', 'login-form', 'signup-form', 'app-view', 'logout-btn', 'user-email',
            'streak-count', 'user-level', 'start-btn', 'pause-btn', 'reset-btn', 'end-day-btn',
            'my-systems-btn', 'log-modal', 'log-form', 'log-activity', 'friction-tags', 'emotion-tags',
            'distraction-input', 'distraction-list', 'report-modal', 'report-content', 'show-system-btn',
            'system-suggestion-modal', 'system-suggestion-text', 'adopt-system-btn', 'my-systems-modal',
            'my-systems-list', 'daily-goal-input', 'set-goal-btn', 'forest-display',
            'alarm-sound-select', 'session-transition-modal', 'transition-icon', 'transition-title',
            'transition-message', 'transition-action-btn', 'positive-priming', 'positive-priming-text',
            'weekly-report-btn', 'timer-mode', 'timer-clock', 'current-energy', 'total-goal'
        ];
        ids.forEach(id => dom[id.replace(/-(\w)/g, (_, c) => c.toUpperCase())] = document.getElementById(id));
        
        // 클래스 기반 DOM 캐싱
        dom.loginError = dom.loginForm?.querySelector('.auth-form__error');
        dom.signupError = dom.signupForm?.querySelector('.auth-form__error');
        dom.showSignupBtn = document.getElementById('show-signup');
        dom.showLoginBtn = document.getElementById('show-login');
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
    };

    const bindEventListeners = () => {
        dom.loginForm?.addEventListener('submit', App.handleLogin);
        dom.signupForm?.addEventListener('submit', App.handleSignup);
        dom.logoutBtn?.addEventListener('click', Auth.handleSignOut);
        dom.showSignupBtn?.addEventListener('click', () => toggleAuthForm('signup'));
        dom.showLoginBtn?.addEventListener('click', () => toggleAuthForm('login'));
        dom.startBtn?.addEventListener('click', Timer.start);
        dom.pauseBtn?.addEventListener('click', Timer.pause);
        dom.resetBtn?.addEventListener('click', Timer.reset);
        dom.presetBtns?.forEach(btn => btn.addEventListener('click', App.handlePresetSelect));
        dom.endDayBtn?.addEventListener('click', Report.generateDailyReport);
        dom.mySystemsBtn?.addEventListener('click', Systems.showMySystems);
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
        dom.alarmSoundSelect?.addEventListener('change', App.handleSoundChange);
        dom.transitionActionBtn?.addEventListener('click', Timer.startNextSession);
        dom.weeklyReportBtn?.addEventListener('click', Report.generateWeeklyReport);
    };
    
    const toggleAuthForm = (formToShow) => {
        dom.loginForm?.classList.toggle('hidden', formToShow === 'signup');
        dom.signupForm?.classList.toggle('hidden', formToShow === 'login');
        dom.loginError?.classList.add('hidden');
        dom.signupError?.classList.add('hidden');
    };

    const showView = (viewName) => {
        dom.authView?.classList.toggle('hidden', viewName === 'app');
        dom.appView?.classList.toggle('hidden', viewName === 'auth');
    };

    const displayAuthError = (formType, message) => {
        const errorEl = formType === 'login' ? dom.loginError : dom.signupError;
        if (errorEl) { errorEl.textContent = message; errorEl.classList.remove('hidden'); }
    };

    const updateUserEmail = (email) => { if (dom.userEmail) dom.userEmail.textContent = email || ''; };

    const updateGamificationStats = (level, streak) => {
        if (dom.userLevel) dom.userLevel.textContent = level;
        if (dom.streakCount) dom.streakCount.textContent = streak;
    };

    const updateTimerDisplay = (timeString, mode, remaining, total) => {
        if (dom.timerClock) dom.timerClock.textContent = timeString;
        if (dom.timerMode) dom.timerMode.textContent = mode;
        document.title = `${timeString} - ${mode}`;

        // 원형 프로그레스 바 업데이트
        const percentage = total > 0 ? remaining / total : 0;
        if(dom.timerProgressTime) {
            dom.timerProgressTime.style.strokeDashoffset = CIRCLE_CIRCUMFERENCE * (1 - percentage);
            dom.timerProgressTime.style.stroke = mode === '집중' ? 'var(--primary-color)' : 'var(--success-color)';
        }
    };

    const updateTimerControls = (state) => {
        if (!dom.startBtn || !dom.pauseBtn) return;
        dom.startBtn.textContent = state === 'paused' ? '계속' : '시작';
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
        document.body.classList.toggle('body--modal-open', show);
    };

    const updateForestDisplay = (sessions) => {
        if (!dom.forestDisplay) return;
        const energyMap = { 'short': '🍅', 'medium': '🌳', 'long': '🌲' };
        dom.forestDisplay.innerHTML = sessions.map(s => `<span>${energyMap[s.type]}</span>`).join('') || '<span style="font-size: 1rem; color: var(--text-light-color);">집중을 시작하여 나무를 심으세요.</span>';
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

    const renderReport = (reportData, title = "데일리 리포트") => {
        if (!dom.reportContent) return;
        const { totalFocusMinutes, energy, topFrictions, insight, badges } = reportData;
        const topFrictionsHTML = topFrictions.length > 0 ? topFrictions.map(f => `<li>${f.tag} (${f.count}회)</li>`).join('') : '<li>기록된 마찰이 없습니다.</li>';
        const badgesHTML = badges?.length > 0 ? `<div class="report__stat"><p class="report__title">새로 획득한 뱃지</p><ul class="report__list">${badges.map(b => `<li>🏅 ${b.name}</li>`).join('')}</ul></div>` : '';
        const reportModalContent = dom.reportModal.querySelector('.modal__content');
        if (reportModalContent) reportModalContent.querySelector('h2').textContent = title;
        dom.reportContent.innerHTML = `<div class="report__grid"><div class="report__stat"><p class="report__title">총 집중 시간</p><p class="report__value">${totalFocusMinutes}분</p></div><div class="report__stat"><p class="report__title">획득한 집중 에너지</p><p class="report__value">${energy.toFixed(1)}</p></div></div>${badgesHTML}<div class="report__stat"><p class="report__title">주요 마찰 Top 3</p><ul class="report__list">${topFrictionsHTML}</ul></div>${insight ? `<div class="report__insight"><p>${insight}</p></div>` : ''}`;
        if (dom.showSystemBtn) dom.showSystemBtn.classList.toggle('hidden', !reportData.topFrictionTag);
        toggleModal('report-modal', true);
    };

    const showSystemSuggestion = (suggestion) => {
        if (!dom.systemSuggestionText || !dom.adoptSystemBtn) return;
        dom.systemSuggestionText.textContent = suggestion.description;
        dom.adoptSystemBtn.dataset.suggestion = JSON.stringify(suggestion);
        toggleModal('system-suggestion-modal', true);
    };

    const renderMySystems = (systems) => {
        if (!dom.mySystemsList) return;
        dom.mySystemsList.innerHTML = systems.length === 0 ? `<p>아직 채택한 시스템이 없습니다.</p>` : systems.map(system => `<div class="system-card" data-id="${system.id}"><div class="system-card__header"><h3 class="system-card__title">${system.title}</h3><span class="system-card__tag">${system.targetFriction}</span></div><p class="system-card__description">${system.description}</p><div class="system-card__footer"><span>채택일: ${system.adoptedAt.toLocaleDateString()}</span><button class="button button--danger" data-action="delete-system">삭제</button></div></div>`).join('');
    };

    const updateActivePreset = (condition) => {
        dom.presetBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.condition === condition);
        });
    };

    return {
        init: () => { cacheDOM(); bindEventListeners(); renderTagButtons(); renderSelectOptions(); },
        showView, displayAuthError, updateUserEmail, updateGamificationStats, updateTimerDisplay,
        updateTimerControls, toggleModal, resetLogForm, renderDistractionList,
        renderReport, showSystemSuggestion, renderMySystems, updateForestDisplay, updateGoalProgress,
        showSessionTransitionModal, showPositivePriming, updateActivePreset,
        getLogFormData: () => ({
            activity: dom.logActivity.value,
            frictionTags: Array.from(dom.frictionTags.querySelectorAll('.tag-group__tag--selected')).map(t => t.dataset.tag),
            emotionTags: Array.from(dom.emotionTags.querySelectorAll('.tag-group__tag--selected')).map(t => t.dataset.tag)
        }),
        getDailyGoal: () => parseInt(dom.dailyGoalInput.value, 10),
        setAlarmSound: (soundFile) => { if (dom.alarmSoundSelect) dom.alarmSoundSelect.value = soundFile; }
    };
})();


/**
 * @module Auth
 * @description 사용자 인증 상태 관리.
 */
const Auth = (() => {
    let currentUser = null;
    const init = () => {
        FirebaseAPI.listenAuthStateChange(async user => {
            currentUser = user;
            if (user) {
                const profileSnap = await FirebaseAPI.getUserProfile(user.uid);
                if (!profileSnap.exists()) await FirebaseAPI.createUserProfile(user.uid, user.email);
                const settingsSnap = await FirebaseAPI.getUserSettings(user.uid);
                if (settingsSnap.exists()) {
                    const { alarmSound } = settingsSnap.data();
                    Timer.setAlarmSound(alarmSound);
                    UI.setAlarmSound(alarmSound);
                }
                Gamification.loadProfile();
                UI.showView('app');
                UI.updateUserEmail(user.email);
            } else {
                UI.showView('auth');
                UI.updateUserEmail(null);
                Timer.reset();
            }
        });
    };
    const handleSignUp = async (email, password) => { try { await FirebaseAPI.signUp(email, password); } catch (error) { UI.displayAuthError('signup', App.mapAuthCodeToMessage(error.code)); } };
    const handleSignIn = async (email, password) => { try { await FirebaseAPI.signIn(email, password); } catch (error) { UI.displayAuthError('login', App.mapAuthCodeToMessage(error.code)); } };
    const handleSignOut = async () => { try { await FirebaseAPI.logOut(); } catch (error) { console.error("로그아웃 실패:", error); } };
    return { init, handleSignUp, handleSignIn, handleSignOut, getCurrentUser: () => currentUser };
})();


/**
 * @module Timer
 * @description 뽀모도로 타이머 로직 및 상태 관리.
 */
const Timer = (() => {
    let state = { timerId: null, totalSeconds: 1500, remainingSeconds: 1500, mode: '집중', status: 'idle', logTriggered: false };
    let config = { focusDuration: 25, restDuration: 5, condition: '보통' };
    let alarm = new Audio('sounds/alarm_clock.ogg');
    const positiveMessages = ["최고의 집중력을 발휘할 준비가 되었습니다.", "하나의 작은 행동이 거대한 성공을 만듭니다.", "가장 중요한 일에 에너지를 쏟아부으세요.", "지금 이 순간의 몰입이 내일의 당신을 만듭니다."];

    const tick = () => {
        state.remainingSeconds--;
        UI.updateTimerDisplay(formatTime(state.remainingSeconds), state.mode, state.remainingSeconds, state.totalSeconds);
        if (state.mode === '집중' && !state.logTriggered && state.remainingSeconds <= state.totalSeconds * 0.2) {
            state.logTriggered = true;
            Logger.triggerLogPopup();
        }
        if (state.remainingSeconds <= 0) completeSession();
    };
    
    const completeSession = () => {
        clearInterval(state.timerId);
        state.status = 'idle';
        alarm.play();
        Favicon.set('default');
        let transitionData;
        if (state.mode === '집중') {
            Gamification.updateFocusSession(config.focusDuration);
            state.mode = '휴식';
            state.totalSeconds = config.restDuration * 60;
            transitionData = { icon: '☕', title: '집중 시간 종료!', message: `${config.restDuration}분간 휴식을 시작합니다.`, buttonText: '휴식 시작', buttonClass: 'button--secondary' };
            Notifications.show('집중 시간 종료!', { body: `이제 ${config.restDuration}분간 휴식하세요.` });
        } else {
            state.mode = '집중';
            state.totalSeconds = config.focusDuration * 60;
            transitionData = { icon: '🔥', title: '휴식 종료!', message: `${config.focusDuration}분간 집중을 시작합니다.`, buttonText: '집중 시작', buttonClass: 'button--success' };
            Notifications.show('휴식 종료!', { body: `이제 ${config.focusDuration}분간 집중하세요.` });
        }
        UI.showSessionTransitionModal(transitionData);
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
    };
    
    return {
        start, pause, reset, startNextSession,
        setConfig: (focus, rest, condition) => {
            config = { focusDuration: focus, restDuration: rest, condition };
            state.mode = '집중';
            state.totalSeconds = config.focusDuration * 60;
            Gamification.resetDailyProgress();
            reset();
            UI.updateActivePreset(condition);
        },
        getCurrentSessionDuration: () => config.focusDuration,
        setAlarmSound: (soundFile) => { alarm = new Audio(`sounds/${soundFile}`); }
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
        if (!activity) return alert("수행 내용을 입력해주세요.");
        try {
            await FirebaseAPI.saveLog(user.uid, { activity, frictionTags, emotionTags, distractions, sessionDuration: Timer.getCurrentSessionDuration(), timestamp: serverTimestamp() });
            distractions = [];
            UI.resetLogForm();
            UI.toggleModal('log-modal', false);
            // 로그 저장 후 바로 휴식 시작
            Timer.startNextSession();
        } catch (error) { console.error("로그 저장 실패:", error); alert("로그 저장 중 오류가 발생했습니다."); }
    };
    return { triggerLogPopup, handleLogSubmit, handleDistractionInput };
})();


/**
 * @module Report
 * @description 데일리/위클리 리포트 생성 및 분석.
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
            if (logs.length === 0) return alert("오늘 기록된 세션이 없습니다.");
            const analysis = analyzeLogs(logs);
            const insight = generateInsight(analysis.frictionCounts);
            const earnedBadges = await Gamification.checkBadges(logs);
            currentReportData = { ...analysis, insight, badges: earnedBadges };
            UI.renderReport(currentReportData, "데일리 리포트");
            await Gamification.updateStreak();
        } catch (error) { console.error("리포트 생성 실패:", error); }
    };
    const generateWeeklyReport = async () => {
        const user = Auth.getCurrentUser();
        if (!user) return;
        try {
            const endOfWeek = new Date(new Date().setHours(23, 59, 59, 999));
            const startOfWeek = new Date(new Date().setDate(endOfWeek.getDate() - 6));
            startOfWeek.setHours(0, 0, 0, 0);
            const logs = await FirebaseAPI.getLogsByDateRange(user.uid, startOfWeek, endOfWeek);
            if (logs.length === 0) return alert("지난 7일간 기록된 세션이 없습니다.");
            const analysis = analyzeLogs(logs);
            const insight = `지난 7일간 가장 큰 마찰은 [${analysis.topFrictionTag || '없음'}] 이었습니다.`;
            currentReportData = { ...analysis, insight, badges: [] };
            UI.renderReport(currentReportData, "주간 회고 리포트");
        } catch (error) { console.error("주간 리포트 생성 실패:", error); }
    };
    const generateInsight = (counts) => {
        if (counts['업무 외 검색'] >= 2) return "패턴 분석: [업무 외 검색]으로 집중력이 자주 분산되는 경향이 있습니다.";
        if (counts['메신저 확인'] >= 3) return "패턴 분석: [메신저 확인] 마찰이 잦습니다. 집중 시간에는 알림을 꺼두는 것을 고려해보세요.";
        if (counts['불필요한 생각'] >= 2) return "패턴 분석: [불필요한 생각]이 집중을 방해하고 있습니다. 세션 시작 전 '브레인 덤프'가 도움이 될 수 있습니다.";
        return null;
    };
    const getSystemSuggestion = (tag) => {
        const suggestions = {
            '업무 외 검색': { title: "사이트 차단 시스템", description: "집중 세션 중 불필요한 사이트 접속을 막는 'BlockSite' 같은 확장 프로그램 사용을 시스템화하는 것을 추천합니다." },
            '불필요한 생각': { title: "브레인 덤프 시스템", description: "세션 시작 전 2분간 생각을 비워내는 '브레인 덤프'를 시스템화하는 것을 추천합니다." },
            '메신저 확인': { title: "메시지 타임 블록", description: "집중 시간에는 메신저를 종료하고, 특정 시간에만 확인하는 '타임 블록' 시스템을 도입하는 것을 추천합니다." }
        };
        return { ...(suggestions[tag] || { title: "맞춤형 시스템 구축", description: `[${tag}] 마찰을 해결하기 위한 자신만의 시스템을 구축해보세요.` }), targetFriction: tag };
    };
    return { generateDailyReport, generateWeeklyReport, getSystemSuggestion, getCurrentReportData: () => currentReportData };
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
        } catch (error) { console.error("시스템 로딩 실패:", error); }
    };
    const adoptSystem = async (e) => {
        const user = Auth.getCurrentUser();
        if (!user) return;
        const suggestion = JSON.parse(e.target.dataset.suggestion);
        try {
            await FirebaseAPI.addSystem(user.uid, { ...suggestion, adoptedAt: serverTimestamp() });
            UI.toggleModal('system-suggestion-modal', false);
            alert(`[${suggestion.title}] 시스템이 라이브러리에 추가되었습니다.`);
        } catch (error) { console.error("시스템 추가 실패:", error); }
    };
    const handleSystemListClick = async (e) => {
        if (e.target.dataset.action !== 'delete-system') return;
        const user = Auth.getCurrentUser();
        const card = e.target.closest('.system-card');
        if (!user || !card) return;
        if (confirm("정말로 이 시스템을 삭제하시겠습니까?")) {
            try { await FirebaseAPI.deleteSystem(user.uid, card.dataset.id); card.remove(); }
            catch (error) { console.error("시스템 삭제 실패:", error); }
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
    let dailyProgress = { energy: 0, sessions: [], goal: 8 };
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
        dailyProgress = goalData ? { ...goalData } : { energy: 0, sessions: [], goal: profile.dailyGoals?.defaultGoal || 8 };
        UI.updateForestDisplay(dailyProgress.sessions);
        UI.updateGoalProgress(dailyProgress.energy, dailyProgress.goal);
    };
    const setDailyGoal = async () => {
        const goal = UI.getDailyGoal();
        if (!goal || isNaN(goal) || goal <= 0) return alert("유효한 목표 에너지를 입력해주세요.");
        dailyProgress.goal = goal;
        profile.dailyGoals.defaultGoal = goal; // 다음 날을 위해 기본 목표 저장
        UI.updateGoalProgress(dailyProgress.energy, dailyProgress.goal);
        await saveDailyProgress();
        alert(`오늘의 목표 집중 에너지가 ${goal}로 설정되었습니다.`);
    };
    const updateFocusSession = (duration) => {
        const energy = duration >= 50 ? 2.5 : duration >= 30 ? 1.5 : 1.0;
        const type = duration >= 50 ? 'long' : duration >= 30 ? 'medium' : 'short';
        dailyProgress.energy += energy;
        dailyProgress.sessions.push({ type, duration });
        UI.updateForestDisplay(dailyProgress.sessions);
        UI.updateGoalProgress(dailyProgress.energy, dailyProgress.goal);
        if (dailyProgress.goal > 0 && dailyProgress.energy >= dailyProgress.goal && dailyProgress.energy - energy < dailyProgress.goal) {
            alert("🎉 오늘의 목표 집중 에너지를 달성했습니다! 대단해요!");
        }
        profile.totalFocusMinutes += duration;
        const newLevel = Math.floor(profile.totalFocusMinutes / 60) + 1;
        if (newLevel > profile.level) {
            profile.level = newLevel;
            alert(`축하합니다! 레벨 ${newLevel}(으)로 상승했습니다!`);
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
            'friction-slayer': { name: '마찰 극복자', condition: () => Object.keys(frictionCounts).length > 0 && logs.length >= 5 },
            'deep-diver': { name: '딥다이버', condition: () => logs.some(log => log.sessionDuration >= 50) }
        };
        for (const [id, badge] of Object.entries(badgeConditions)) {
            if (!profile.badges.includes(id) && badge.condition()) {
                earned.push(badge);
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
    const resetDailyProgress = () => { 
        dailyProgress = { energy: 0, sessions: [], goal: profile.dailyGoals?.defaultGoal || 8 };
        UI.updateForestDisplay(dailyProgress.sessions);
        UI.updateGoalProgress(dailyProgress.energy, dailyProgress.goal);
    };

    return { loadProfile, setDailyGoal, updateFocusSession, updateStreak, resetDailyProgress, checkBadges };
})();


/**
 * @module App
 * @description 애플리케이션 최상위 컨트롤러.
 */
const App = (() => {
    const init = () => {
        if (!FirebaseAPI.init()) return;
        UI.init();
        Auth.init();
        Notifications.requestPermission();
        Favicon.set('default');
        // 초기 타이머 설정
        Timer.setConfig(25, 5, '보통');
    };
    const mapAuthCodeToMessage = (code) => {
        const messages = {
            'auth/invalid-email': '유효하지 않은 이메일 형식입니다.',
            'auth/user-not-found': '사용자를 찾을 수 없습니다.',
            'auth/wrong-password': '비밀번호가 일치하지 않습니다.',
            'auth/email-already-in-use': '이미 사용 중인 이메일입니다.',
            'auth/weak-password': '비밀번호는 6자리 이상이어야 합니다.',
            'auth/invalid-credential': '이메일 또는 비밀번호가 잘못되었습니다.'
        };
        return messages[code] || '인증 중 오류가 발생했습니다: ' + code;
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
    const handleSoundChange = async (e) => {
        const user = Auth.getCurrentUser();
        if (!user) return;
        Timer.setAlarmSound(e.target.value);
        await FirebaseAPI.updateUserSettings(user.uid, { alarmSound: e.target.value });
    };
    const handleLogin = (e) => {
        e.preventDefault();
        Auth.handleSignIn(e.target.querySelector('#login-email').value, e.target.querySelector('#login-password').value);
    };
    const handleSignup = (e) => {
        e.preventDefault();
        Auth.handleSignUp(e.target.querySelector('#signup-email').value, e.target.querySelector('#signup-password').value);
    };

    return { init, mapAuthCodeToMessage, handleLogin, handleSignup, handlePresetSelect, handleShowSystem, handleSoundChange };
})();

document.addEventListener('DOMContentLoaded', App.init);

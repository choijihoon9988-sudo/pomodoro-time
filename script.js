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
    limit,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ===================================================================================
// 여기에 Firebase 구성 객체를 붙여넣으세요.
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
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
    };

    // --- Auth ---
    const listenAuthStateChange = (callback) => onAuthStateChanged(auth, callback);
    const signUp = (email, password) => createUserWithEmailAndPassword(auth, email, password);
    const signIn = (email, password) => signInWithEmailAndPassword(auth, email, password);
    const logOut = () => signOut(auth);
    
    // --- User Profile (Gamification) ---
    const getUserProfile = (userId) => getDoc(doc(db, 'users', userId));
    const createUserProfile = (userId, email) => {
        const userProfileRef = doc(db, 'users', userId);
        return setDoc(userProfileRef, {
            email,
            level: 1,
            totalFocusMinutes: 0,
            streak: 0,
            lastSessionDate: null,
            createdAt: serverTimestamp()
        });
    };
    const updateUserProfile = (userId, data) => setDoc(doc(db, 'users', userId), data, { merge: true });

    // --- Logs ---
    const saveLog = (userId, logData) => addDoc(collection(db, 'users', userId, 'logs'), logData);
    const getTodaysLogs = async (userId) => {
        const today = new Date();
        const startOfDay = new Date(today.setHours(0, 0, 0, 0));
        const endOfDay = new Date(today.setHours(23, 59, 59, 999));
        const q = query(collection(db, 'users', userId, 'logs'),
            where('timestamp', '>=', startOfDay),
            where('timestamp', '<=', endOfDay),
            orderBy('timestamp', 'asc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    };

    // --- Systems ---
    const addSystem = (userId, systemData) => addDoc(collection(db, 'users', userId, 'systems'), systemData);
    const getSystems = async (userId) => {
        const snapshot = await getDocs(collection(db, 'users', userId, 'systems'));
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    };
    const deleteSystem = (userId, systemId) => deleteDoc(doc(db, 'users', userId, 'systems', systemId));

    return {
        init, listenAuthStateChange, signUp, signIn, logOut,
        getUserProfile, createUserProfile, updateUserProfile,
        saveLog, getTodaysLogs,
        addSystem, getSystems, deleteSystem
    };
})();


/**
 * @module UI
 * @description 모든 DOM 조작, UI 렌더링, 이벤트 리스너 바인딩 담당.
 */
const UI = (() => {
    const dom = {};
    let lastFocusedElement;

    const frictionTags = ['업무 외 검색', '메신저 확인', '유튜브 시청', '불필요한 생각', '계획 부재', '기술적 문제', '주변 소음'];
    const emotionTags = ['불안감', '지루함', '호기심', '무력감', '피로감'];

    const cacheDOM = () => {
        // Auth
        dom.authView = document.getElementById('auth-view');
        dom.loginForm = document.getElementById('login-form');
        dom.signupForm = document.getElementById('signup-form');
        dom.loginError = dom.loginForm.querySelector('.auth-form__error');
        dom.signupError = dom.signupForm.querySelector('.auth-form__error');
        dom.showSignupBtn = document.getElementById('show-signup');
        dom.showLoginBtn = document.getElementById('show-login');
        
        // App Shell
        dom.appView = document.getElementById('app-view');
        dom.logoutBtn = document.getElementById('logout-btn');
        dom.userEmail = document.getElementById('user-email');
        
        // Gamification
        dom.streakCount = document.getElementById('streak-count');
        dom.userLevel = document.getElementById('user-level');

        // Main Views
        dom.conditionSelector = document.getElementById('condition-selector');
        dom.timerView = document.getElementById('timer-view');

        // Timer
        dom.timerMode = document.querySelector('.timer__mode');
        dom.timerDisplay = document.querySelector('.timer__display');
        dom.startBtn = document.getElementById('start-btn');
        dom.pauseBtn = document.getElementById('pause-btn');
        dom.resetBtn = document.getElementById('reset-btn');
        dom.presetBtns = document.querySelectorAll('.button--preset');

        // Main Actions
        dom.endDayBtn = document.getElementById('end-day-btn');
        dom.mySystemsBtn = document.getElementById('my-systems-btn');

        // Modals
        dom.logModal = document.getElementById('log-modal');
        dom.logForm = document.getElementById('log-form');
        dom.logActivity = document.getElementById('log-activity');
        dom.frictionTagsContainer = document.getElementById('friction-tags');
        dom.emotionTagsContainer = document.getElementById('emotion-tags');
        dom.distractionInput = document.getElementById('distraction-input');
        dom.distractionList = document.getElementById('distraction-list');

        dom.reportModal = document.getElementById('report-modal');
        dom.reportContent = document.getElementById('report-content');
        dom.showSystemBtn = document.getElementById('show-system-btn');

        dom.systemSuggestionModal = document.getElementById('system-suggestion-modal');
        dom.systemSuggestionText = document.getElementById('system-suggestion-text');
        dom.adoptSystemBtn = document.getElementById('adopt-system-btn');

        dom.mySystemsModal = document.getElementById('my-systems-modal');
        dom.mySystemsList = document.getElementById('my-systems-list');
    };
    
    const renderTagButtons = () => {
        dom.frictionTagsContainer.innerHTML = frictionTags.map(tag => `<button type="button" class="tag-group__tag" data-tag="${tag}">${tag}</button>`).join('');
        dom.emotionTagsContainer.innerHTML = emotionTags.map(tag => `<button type="button" class="tag-group__tag" data-tag="${tag}">${tag}</button>`).join('');
    };

    const bindEventListeners = () => {
        // Auth
        dom.loginForm.addEventListener('submit', App.handleLogin);
        dom.signupForm.addEventListener('submit', App.handleSignup);
        dom.logoutBtn.addEventListener('click', Auth.handleSignOut);
        dom.showSignupBtn.addEventListener('click', () => toggleAuthForm('signup'));
        dom.showLoginBtn.addEventListener('click', () => toggleAuthForm('login'));

        // Main Flow
        dom.conditionSelector.addEventListener('click', App.handleConditionSelect);
        dom.startBtn.addEventListener('click', Timer.start);
        dom.pauseBtn.addEventListener('click', Timer.pause);
        dom.resetBtn.addEventListener('click', Timer.reset);
        dom.presetBtns.forEach(btn => btn.addEventListener('click', App.handlePresetSelect));
        dom.endDayBtn.addEventListener('click', Report.generateDailyReport);
        dom.mySystemsBtn.addEventListener('click', Systems.showMySystems);
        
        // Modals
        dom.logForm.addEventListener('submit', Logger.handleLogSubmit);
        dom.distractionInput.addEventListener('keydown', Logger.handleDistractionInput);
        dom.showSystemBtn.addEventListener('click', App.handleShowSystem);
        dom.adoptSystemBtn.addEventListener('click', Systems.adoptSystem);
        dom.mySystemsList.addEventListener('click', Systems.handleSystemListClick);

        // Global Modal Controls
        document.body.addEventListener('click', e => {
            if (e.target.dataset.closeModal !== undefined) {
                const modal = e.target.closest('.modal');
                if (modal) toggleModal(modal.id, false);
            }
        });
        dom.logModal.addEventListener('click', e => {
            if (e.target.classList.contains('tag-group__tag')) {
                e.target.classList.toggle('tag-group__tag--selected');
            }
        });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                const visibleModal = document.querySelector('.modal--visible');
                if (visibleModal) toggleModal(visibleModal.id, false);
            }
        });
    };

    const toggleAuthForm = (formToShow) => {
        dom.loginForm.classList.toggle('hidden', formToShow === 'signup');
        dom.signupForm.classList.toggle('hidden', formToShow === 'login');
        dom.loginError.classList.add('hidden');
        dom.signupError.classList.add('hidden');
    };

    const showView = (viewName) => {
        dom.authView.classList.toggle('hidden', viewName === 'app');
        dom.appView.classList.toggle('hidden', viewName === 'auth');
    };

    const displayAuthError = (formType, message) => {
        const errorEl = formType === 'login' ? dom.loginError : dom.signupError;
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
    };

    const updateUserEmail = (email) => {
        dom.userEmail.textContent = email || '';
    };

    const updateGamificationStats = (level, streak) => {
        dom.userLevel.textContent = level;
        dom.streakCount.textContent = streak;
    };

    const updateTimerDisplay = (timeString, mode) => {
        dom.timerDisplay.textContent = timeString;
        document.title = `${timeString} - ${mode}`;
        if (mode) dom.timerMode.textContent = mode;
    };
    
    const updateTimerControls = (state) => {
        dom.startBtn.textContent = (state === 'paused') ? '계속' : '시작';
        dom.startBtn.disabled = (state === 'running');
        dom.pauseBtn.disabled = (state !== 'running');
    };

    const toggleTimerSubView = (view) => {
        dom.conditionSelector.classList.toggle('hidden', view === 'timer');
        dom.timerView.classList.toggle('hidden', view === 'condition');
    };

    const toggleModal = (modalId, show) => {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        if (show) {
            lastFocusedElement = document.activeElement;
            modal.classList.add('modal--visible');
            const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (focusable.length) focusable[0].focus();
        } else {
            modal.classList.remove('modal--visible');
            if (lastFocusedElement) lastFocusedElement.focus();
        }
        document.body.classList.toggle('body--modal-open', show);
    };

    const resetLogForm = () => {
        dom.logForm.reset();
        dom.logModal.querySelectorAll('.tag-group__tag--selected').forEach(tag => tag.classList.remove('tag-group__tag--selected'));
        dom.distractionList.innerHTML = '';
    };

    const renderDistractionList = (distractions) => {
        dom.distractionList.innerHTML = distractions.map(d => `<li>${d}</li>`).join('');
    };
    
    const renderReport = (reportData) => {
        const { totalFocusMinutes, pomodoroCount, topFrictions, insight } = reportData;
        const topFrictionsHTML = topFrictions.length > 0
            ? topFrictions.map(f => `<li>${f.tag} (${f.count}회)</li>`).join('')
            : '<li>기록된 마찰이 없습니다.</li>';

        dom.reportContent.innerHTML = `
            <div class="report__grid">
                <div class="report__stat"><p class="report__title">총 집중 시간</p><p class="report__value">${totalFocusMinutes}분</p></div>
                <div class="report__stat"><p class="report__title">완료한 뽀모도로</p><p class="report__value">${pomodoroCount}회</p></div>
            </div>
            <div class="report__stat"><p class="report__title">주요 마찰 Top 3</p><ul class="report__list">${topFrictionsHTML}</ul></div>
            ${insight ? `<div class="report__insight"><p>${insight}</p></div>` : ''}
        `;
        dom.showSystemBtn.classList.toggle('hidden', !reportData.topFrictionTag);
        toggleModal('report-modal', true);
    };

    const showSystemSuggestion = (suggestion) => {
        dom.systemSuggestionText.textContent = suggestion.description;
        dom.adoptSystemBtn.dataset.suggestion = JSON.stringify(suggestion);
        toggleModal('system-suggestion-modal', true);
    };
    
    const renderMySystems = (systems) => {
        if (systems.length === 0) {
            dom.mySystemsList.innerHTML = `<p>아직 채택한 시스템이 없습니다. 데일리 리포트를 통해 시스템을 제안받아 보세요.</p>`;
            return;
        }
        dom.mySystemsList.innerHTML = systems.map(system => `
            <div class="system-card" data-id="${system.id}">
                <div class="system-card__header">
                    <h3 class="system-card__title">${system.title}</h3>
                    <span class="system-card__tag">${system.targetFriction}</span>
                </div>
                <p class="system-card__description">${system.description}</p>
                <div class="system-card__footer">
                    <span>채택일: ${system.adoptedAt.toLocaleDateString()}</span>
                    <button class="button button--danger" data-action="delete-system">삭제</button>
                </div>
            </div>
        `).join('');
    };

    return {
        init: () => { cacheDOM(); renderTagButtons(); bindEventListeners(); },
        showView, displayAuthError, updateUserEmail, updateGamificationStats,
        updateTimerDisplay, updateTimerControls, toggleTimerSubView, toggleModal,
        resetLogForm, renderDistractionList, renderReport, showSystemSuggestion, renderMySystems,
        getLogFormData: () => {
            const activity = dom.logActivity.value;
            const selectedFrictionTags = Array.from(dom.frictionTagsContainer.querySelectorAll('.tag-group__tag--selected')).map(t => t.dataset.tag);
            const selectedEmotionTags = Array.from(dom.emotionTagsContainer.querySelectorAll('.tag-group__tag--selected')).map(t => t.dataset.tag);
            return { activity, frictionTags: selectedFrictionTags, emotionTags: selectedEmotionTags };
        }
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
            if (user) {
                currentUser = user;
                const profileSnap = await FirebaseAPI.getUserProfile(user.uid);
                if (!profileSnap.exists()) {
                    await FirebaseAPI.createUserProfile(user.uid, user.email);
                }
                Gamification.loadProfile();
                UI.showView('app');
                UI.updateUserEmail(user.email);
            } else {
                currentUser = null;
                UI.showView('auth');
                UI.updateUserEmail(null);
                UI.toggleTimerSubView('condition');
                Timer.reset();
            }
        });
    };

    const handleSignUp = async (email, password) => {
        try { await FirebaseAPI.signUp(email, password); } 
        catch (error) { UI.displayAuthError('signup', App.mapAuthCodeToMessage(error.code)); }
    };
    const handleSignIn = async (email, password) => {
        try { await FirebaseAPI.signIn(email, password); }
        catch (error) { UI.displayAuthError('login', App.mapAuthCodeToMessage(error.code)); }
    };
    const handleSignOut = async () => {
        try { await FirebaseAPI.logOut(); }
        catch (error) { console.error("로그아웃 실패:", error); alert("로그아웃 중 오류가 발생했습니다."); }
    };

    return { init, handleSignUp, handleSignIn, handleSignOut, getCurrentUser: () => currentUser };
})();


/**
 * @module Timer
 * @description 뽀모도로 타이머 로직 및 상태 관리.
 */
const Timer = (() => {
    let state = {
        timerId: null, totalSeconds: 25 * 60, remainingSeconds: 25 * 60,
        mode: '집중', status: 'idle', pomodoroCount: 0, logTriggered: false
    };
    const config = { focusDuration: 25, restDuration: 5 };
    const alarm = new Audio('https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg');

    const tick = () => {
        state.remainingSeconds--;
        UI.updateTimerDisplay(formatTime(state.remainingSeconds), state.mode);

        if (state.mode === '집중' && !state.logTriggered && state.remainingSeconds <= state.totalSeconds * 0.2) {
            state.logTriggered = true;
            Logger.triggerLogPopup();
        }
        
        if (state.remainingSeconds <= 0) completeSession();
    };

    const completeSession = () => {
        clearInterval(state.timerId);
        alarm.play();
        
        if (state.mode === '집중') {
            state.pomodoroCount++;
            state.mode = '휴식';
            state.totalSeconds = config.restDuration * 60;
            Gamification.updateFocusTime(config.focusDuration);
        } else {
            state.mode = '집중';
            state.totalSeconds = config.focusDuration * 60;
        }
        
        state.remainingSeconds = state.totalSeconds;
        state.status = 'idle';
        state.logTriggered = false;
        
        UI.updateTimerDisplay(formatTime(state.remainingSeconds), state.mode);
        UI.updateTimerControls(state.status);
        start(); // Automatically start next session
    };

    const formatTime = (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    const start = () => {
        if (state.status === 'running') return;
        state.status = 'running';
        state.timerId = setInterval(tick, 1000);
        UI.updateTimerControls(state.status);
    };
    const pause = () => {
        if (state.status !== 'running') return;
        clearInterval(state.timerId);
        state.status = 'paused';
        UI.updateTimerControls(state.status);
    };
    const reset = () => {
        clearInterval(state.timerId);
        state.status = 'idle';
        state.remainingSeconds = state.totalSeconds;
        state.logTriggered = false;
        UI.updateTimerDisplay(formatTime(state.remainingSeconds), state.mode);
        UI.updateTimerControls(state.status);
    };
    
    return {
        start, pause, reset,
        setConfig: (focus, rest) => {
            config.focusDuration = focus; config.restDuration = rest; state.mode = '집중';
            state.totalSeconds = config.focusDuration * 60; state.pomodoroCount = 0; reset();
        },
        getPomodoroCount: () => state.pomodoroCount,
        getCurrentSessionDuration: () => config.focusDuration
    };
})();


/**
 * @module Logger
 * @description 마찰 로깅 및 딴생각 저장소 관리.
 */
const Logger = (() => {
    let distractions = [];

    const triggerLogPopup = () => {
        Timer.pause();
        UI.toggleModal('log-modal', true);
    };

    const handleDistractionInput = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const input = e.target;
            if (input.value.trim()) {
                distractions.push(input.value.trim());
                UI.renderDistractionList(distractions);
                input.value = '';
            }
        }
    };
    
    const handleLogSubmit = async (e) => {
        e.preventDefault();
        const user = Auth.getCurrentUser();
        if (!user) return;
        const { activity, frictionTags, emotionTags } = UI.getLogFormData();
        if (!activity) { alert("수행 내용을 입력해주세요."); return; }

        const logData = {
            activity, frictionTags, emotionTags, distractions,
            sessionDuration: Timer.getCurrentSessionDuration(),
            timestamp: serverTimestamp()
        };

        try {
            await FirebaseAPI.saveLog(user.uid, logData);
            distractions = []; // Reset after saving
            UI.resetLogForm();
            UI.toggleModal('log-modal', false);
            Timer.start();
        } catch (error) {
            console.error("로그 저장 실패:", error); alert("로그 저장 중 오류가 발생했습니다.");
        }
    };

    return { triggerLogPopup, handleLogSubmit, handleDistractionInput };
})();


/**
 * @module Report
 * @description 데일리 리포트 생성 및 분석.
 */
const Report = (() => {
    let currentReportData = null;

    const generateDailyReport = async () => {
        const user = Auth.getCurrentUser();
        if (!user) return;
        try {
            const logs = await FirebaseAPI.getTodaysLogs(user.uid);
            if(logs.length === 0){ alert("오늘 기록된 세션이 없습니다."); return; }

            const totalFocusMinutes = logs.reduce((sum, log) => sum + log.sessionDuration, 0);
            const frictionCounts = logs.flatMap(log => log.frictionTags).reduce((acc, tag) => {
                acc[tag] = (acc[tag] || 0) + 1; return acc;
            }, {});
            const topFrictions = Object.entries(frictionCounts).sort(([, a], [, b]) => b - a).slice(0, 3).map(([tag, count]) => ({ tag, count }));
            const topFrictionTag = topFrictions.length > 0 ? topFrictions[0].tag : null;

            currentReportData = {
                totalFocusMinutes, pomodoroCount: Timer.getPomodoroCount(),
                topFrictions, topFrictionTag,
                insight: generateInsight(frictionCounts)
            };
            
            UI.renderReport(currentReportData);
            await Gamification.updateStreak(); // 하루 마감 시 스트릭 업데이트
        } catch (error) {
            console.error("리포트 생성 실패:", error); alert("리포트를 불러오는 중 오류가 발생했습니다.");
        }
    };
    
    const generateInsight = (frictionCounts) => {
        if ((frictionCounts['업무 외 검색'] || 0) >= 2) return "패턴 분석: [업무 외 검색]으로 집중력이 자주 분산되는 경향이 있습니다.";
        if ((frictionCounts['메신저 확인'] || 0) >= 3) return "패턴 분석: [메신저 확인] 마찰이 잦습니다. 집중 시간에는 알림을 꺼두는 것을 고려해보세요.";
        if ((frictionCounts['불필요한 생각'] || 0) >= 2) return "패턴 분석: [불필요한 생각]이 집중을 방해하고 있습니다. 세션 시작 전 '브레인 덤프'가 도움이 될 수 있습니다.";
        return null;
    };

    const getSystemSuggestion = (topFrictionTag) => {
        const suggestions = {
            '업무 외 검색': { title: "사이트 차단 시스템", description: "집중 세션 중 불필요한 사이트 접속을 막는 브라우저 확장 프로그램 'BlockSite' 사용을 시스템화하여 의도치 않은 정보의 바다에 빠지는 것을 막습니다." },
            '불필요한 생각': { title: "브레인 덤프 시스템", description: "세션 시작 전 2분간 머릿속 생각을 모두 비워내는 '브레인 덤프'를 시스템화합니다. 떠오르는 생각을 즉시 기록하면 현재 과제에 더 몰입할 수 있습니다." },
            '메신저 확인': { title: "메시지 타임 블록", description: "집중 시간에는 메신저 앱을 종료하고, 특정 시간(예: 매시 50분)에만 확인하는 '타임 블록' 시스템을 도입하여 소통과 집중의 균형을 맞춥니다." }
        };
        const suggestion = suggestions[topFrictionTag] || { title: "맞춤형 시스템 구축", description: `[${topFrictionTag}] 마찰을 해결하기 위한 자신만의 시스템을 구축해보세요. 예를 들어, [주변 소음]이 문제라면 노이즈 캔슬링 헤드폰 사용을 시스템화할 수 있습니다.` };
        return { ...suggestion, targetFriction: topFrictionTag };
    };

    return { generateDailyReport, getSystemSuggestion, getCurrentReportData: () => currentReportData };
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
            const formattedSystems = systems.map(s => ({...s, adoptedAt: s.adoptedAt.toDate() }));
            UI.renderMySystems(formattedSystems);
            UI.toggleModal('my-systems-modal', true);
        } catch (error) {
            console.error("시스템 로딩 실패:", error);
        }
    };

    const adoptSystem = async (e) => {
        const user = Auth.getCurrentUser();
        if (!user) return;
        const suggestion = JSON.parse(e.target.dataset.suggestion);
        const systemData = { ...suggestion, adoptedAt: serverTimestamp() };
        try {
            await FirebaseAPI.addSystem(user.uid, systemData);
            UI.toggleModal('system-suggestion-modal', false);
            alert(`[${suggestion.title}] 시스템이 라이브러리에 추가되었습니다.`);
        } catch(error) {
            console.error("시스템 추가 실패:", error);
        }
    };

    const handleSystemListClick = async (e) => {
        if (e.target.dataset.action === 'delete-system') {
            const user = Auth.getCurrentUser();
            const card = e.target.closest('.system-card');
            if (!user || !card) return;

            if (confirm("정말로 이 시스템을 삭제하시겠습니까?")) {
                try {
                    await FirebaseAPI.deleteSystem(user.uid, card.dataset.id);
                    card.remove();
                } catch (error) {
                    console.error("시스템 삭제 실패:", error);
                }
            }
        }
    };

    return { showMySystems, adoptSystem, handleSystemListClick };
})();


/**
 * @module Gamification
 * @description 레벨, 스트릭 등 게임화 요소 관리.
 */
const Gamification = (() => {
    let profile = { level: 1, totalFocusMinutes: 0, streak: 0, lastSessionDate: null };

    const loadProfile = async () => {
        const user = Auth.getCurrentUser();
        if (!user) return;
        const profileSnap = await FirebaseAPI.getUserProfile(user.uid);
        if (profileSnap.exists()) {
            profile = profileSnap.data();
            UI.updateGamificationStats(profile.level, profile.streak);
        }
    };

    const updateFocusTime = async (minutes) => {
        profile.totalFocusMinutes += minutes;
        const newLevel = Math.floor(profile.totalFocusMinutes / 60) + 1; // 60분마다 1레벨업
        if (newLevel > profile.level) {
            profile.level = newLevel;
            alert(`축하합니다! 레벨 ${newLevel}(으)로 상승했습니다!`);
        }
        await saveProfile();
    };
    
    const updateStreak = async () => {
        const today = new Date().toDateString();
        const lastDate = profile.lastSessionDate ? profile.lastSessionDate.toDate().toDateString() : null;
        
        if (lastDate !== today) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            if (lastDate === yesterday.toDateString()) {
                profile.streak++; // 연속
            } else {
                profile.streak = 1; // 리셋
            }
            profile.lastSessionDate = Timestamp.now();
            await saveProfile();
        }
    };

    const saveProfile = async () => {
        const user = Auth.getCurrentUser();
        if (!user) return;
        await FirebaseAPI.updateUserProfile(user.uid, profile);
        UI.updateGamificationStats(profile.level, profile.streak);
    };

    return { loadProfile, updateFocusTime, updateStreak };
})();


/**
 * @module App
 * @description 애플리케이션 최상위 컨트롤러.
 */
const App = (() => {
    const init = () => { FirebaseAPI.init(); UI.init(); Auth.init(); };

    const mapAuthCodeToMessage = (code) => {
        switch (code) {
            case 'auth/invalid-email': return '유효하지 않은 이메일 형식입니다.';
            case 'auth/user-not-found': case 'auth/wrong-password': return '이메일 또는 비밀번호가 일치하지 않습니다.';
            case 'auth/email-already-in-use': return '이미 사용 중인 이메일입니다.';
            case 'auth/weak-password': return '비밀번호는 6자리 이상이어야 합니다.';
            default: return '인증 중 오류가 발생했습니다.';
        }
    };

    const handleConditionSelect = (e) => {
        if (e.target.tagName !== 'BUTTON') return;
        const condition = e.target.dataset.condition;
        let focus = 25, rest = 5;
        switch (condition) {
            case '최상': focus = 50; rest = 10; break;
            case '좋음': focus = 30; rest = 5; break;
            case '나쁨': rest = 10; break;
        }
        Timer.setConfig(focus, rest);
        UI.toggleTimerSubView('timer');
    };

    const handlePresetSelect = (e) => {
        const btn = e.target.closest('.button--preset');
        if (!btn) return;
        const focus = parseInt(btn.dataset.focus, 10);
        const rest = parseInt(btn.dataset.rest, 10);
        Timer.setConfig(focus, rest);
    };
    
    const handleShowSystem = () => {
        const reportData = Report.getCurrentReportData();
        if (reportData && reportData.topFrictionTag) {
            const suggestion = Report.getSystemSuggestion(reportData.topFrictionTag);
            UI.showSystemSuggestion(suggestion);
        }
    };

    return {
        init, mapAuthCodeToMessage,
        handleLogin: (e) => { 
            e.preventDefault(); 
            const email = e.target.querySelector('#login-email').value;
            const password = e.target.querySelector('#login-password').value;
            Auth.handleSignIn(email, password); 
        },
        handleSignup: (e) => { 
            e.preventDefault(); 
            const email = e.target.querySelector('#signup-email').value;
            const password = e.target.querySelector('#signup-password').value;
            Auth.handleSignUp(email, password); 
        },
        handleConditionSelect, handlePresetSelect, handleShowSystem
    };
})();


// ===================================================================================
// 애플리케이션 진입점 (Entry Point)
// ===================================================================================
document.addEventListener('DOMContentLoaded', App.init);


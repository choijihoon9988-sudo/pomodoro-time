/* script.js */

// ===================================================================================
// Firebase SDK를 CDN에서 모듈 형태로 가져옵니다.
// 이 방식은 빌드 도구 없이 순수 JavaScript 환경에서 Firebase v9+ 모듈러 SDK를 사용하기 위함입니다.
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
    query,
    where,
    Timestamp,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ===================================================================================
// 여기에 Firebase 구성 객체를 붙여넣으세요.
// Firebase 콘솔 -> 프로젝트 설정 -> 일반 탭에서 찾을 수 있습니다.
// ===================================================================================
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};


/**
 * @module FirebaseAPI
 * @description Firebase SDK와의 모든 상호작용을 추상화하여 제공하는 모듈.
 * 인증, Firestore 데이터베이스 CRUD 작업을 담당합니다.
 */
const FirebaseAPI = (() => {
    let app, auth, db;

    /**
     * Firebase 앱을 초기화합니다.
     */
    const init = () => {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
    };

    /**
     * 사용자의 인증 상태 변경을 감지하는 리스너를 설정합니다.
     * @param {function} callback - 인증 상태가 변경될 때 호출될 콜백 함수. user 객체를 인자로 받습니다.
     */
    const listenAuthStateChange = (callback) => {
        onAuthStateChanged(auth, callback);
    };

    /**
     * 이메일과 비밀번호로 새 사용자를 생성합니다.
     * @param {string} email - 사용자 이메일
     * @param {string} password - 사용자 비밀번호
     * @returns {Promise<import("firebase/auth").UserCredential>} 성공 시 UserCredential 객체를 포함하는 Promise
     */
    const signUp = (email, password) => {
        return createUserWithEmailAndPassword(auth, email, password);
    };

    /**
     * 이메일과 비밀번호로 사용자를 로그인시킵니다.
     * @param {string} email - 사용자 이메일
     * @param {string} password - 사용자 비밀번호
     * @returns {Promise<import("firebase/auth").UserCredential>} 성공 시 UserCredential 객체를 포함하는 Promise
     */
    const signIn = (email, password) => {
        return signInWithEmailAndPassword(auth, email, password);
    };

    /**
     * 현재 사용자를 로그아웃시킵니다.
     * @returns {Promise<void>}
     */
    const logOut = () => {
        return signOut(auth);
    };
    
    /**
     * Firestore에 마찰 로그를 저장합니다.
     * @param {string} userId - 현재 사용자의 UID
     * @param {object} logData - 저장할 로그 데이터
     * @returns {Promise<import("firebase/firestore").DocumentReference>}
     */
    const saveLog = (userId, logData) => {
        const logsCollectionRef = collection(db, 'users', userId, 'logs');
        return addDoc(logsCollectionRef, logData);
    };

    /**
     * 특정 사용자의 오늘 날짜 로그를 모두 가져옵니다.
     * @param {string} userId - 현재 사용자의 UID
     * @returns {Promise<Array<object>>} 로그 데이터 배열을 포함하는 Promise
     */
    const getTodaysLogs = async (userId) => {
        const today = new Date();
        const startOfDay = new Date(today.setHours(0, 0, 0, 0));
        const endOfDay = new Date(today.setHours(23, 59, 59, 999));

        const logsCollectionRef = collection(db, 'users', userId, 'logs');
        const q = query(logsCollectionRef,
            where('timestamp', '>=', startOfDay),
            where('timestamp', '<=', endOfDay),
            orderBy('timestamp', 'asc')
        );
        
        const querySnapshot = await getDocs(q);
        const logs = []; // [오류 1 수정]
        querySnapshot.forEach((doc) => {
            logs.push({ id: doc.id,...doc.data() });
        });
        return logs;
    };

    return {
        init,
        listenAuthStateChange,
        signUp,
        signIn,
        logOut,
        saveLog,
        getTodaysLogs
    };
})();


/**
 * @module UI
 * @description 모든 DOM 조작, UI 렌더링 및 이벤트 리스너 바인딩을 담당하는 모듈.
 */
const UI = (() => {
    const dom = {};
    let lastFocusedElement;

    const frictionTags = ['업무 외 검색', '메신저 확인', '유튜브 시청', '불필요한 생각', '계획 부재', '기술적 문제', '주변 소음'];
    const emotionTags = ['불안감', '지루함', '호기심', '무력감', '피로감'];

    /**
     * 필요한 모든 DOM 요소를 캐싱합니다.
     */
    const cacheDOM = () => {
        dom.authView = document.getElementById('auth-view');
        dom.appView = document.getElementById('app-view');
        dom.loginForm = document.getElementById('login-form');
        dom.signupForm = document.getElementById('signup-form');
        dom.loginError = dom.loginForm.querySelector('.auth-form__error');
        dom.signupError = dom.signupForm.querySelector('.auth-form__error');
        dom.showSignupBtn = document.getElementById('show-signup');
        dom.showLoginBtn = document.getElementById('show-login');
        dom.logoutBtn = document.getElementById('logout-btn');
        dom.userEmail = document.getElementById('user-email');
        dom.conditionSelector = document.getElementById('condition-selector');
        dom.timerView = document.getElementById('timer-view');
        dom.timerMode = document.querySelector('.timer__mode');
        dom.timerDisplay = document.querySelector('.timer__display');
        dom.startBtn = document.getElementById('start-btn');
        dom.pauseBtn = document.getElementById('pause-btn');
        dom.resetBtn = document.getElementById('reset-btn');
        dom.presetBtns = document.querySelectorAll('.button--preset');
        dom.endDayBtn = document.getElementById('end-day-btn');
        // Modals
        dom.logModal = document.getElementById('log-modal');
        dom.logForm = document.getElementById('log-form');
        dom.logActivity = document.getElementById('log-activity');
        dom.frictionTagsContainer = document.getElementById('friction-tags');
        dom.emotionTagsContainer = document.getElementById('emotion-tags');
        dom.reportModal = document.getElementById('report-modal');
        dom.reportContent = document.getElementById('report-content');
        dom.showSystemBtn = document.getElementById('show-system-btn');
        dom.systemModal = document.getElementById('system-modal');
        dom.systemSuggestionText = document.getElementById('system-suggestion-text');
    };
    
    /**
     * 태그 버튼 그룹을 생성하여 DOM에 주입합니다.
     */
    const renderTagButtons = () => {
        dom.frictionTagsContainer.innerHTML = frictionTags.map(tag =>
            `<button type="button" class="tag-group__tag" data-tag="${tag}">${tag}</button>`
        ).join('');
        dom.emotionTagsContainer.innerHTML = emotionTags.map(tag =>
            `<button type="button" class="tag-group__tag" data-tag="${tag}">${tag}</button>`
        ).join('');
    };

    /**
     * 모든 이벤트 리스너를 바인딩합니다.
     */
    const bindEventListeners = () => {
        dom.loginForm.addEventListener('submit', App.handleLogin);
        dom.signupForm.addEventListener('submit', App.handleSignup);
        dom.logoutBtn.addEventListener('click', Auth.handleSignOut);
        dom.showSignupBtn.addEventListener('click', () => toggleAuthForm('signup'));
        dom.showLoginBtn.addEventListener('click', () => toggleAuthForm('login'));
        dom.conditionSelector.addEventListener('click', App.handleConditionSelect);
        dom.startBtn.addEventListener('click', Timer.start);
        dom.pauseBtn.addEventListener('click', Timer.pause);
        dom.resetBtn.addEventListener('click', Timer.reset);
        dom.presetBtns.forEach(btn => btn.addEventListener('click', App.handlePresetSelect));
        dom.endDayBtn.addEventListener('click', Report.generateDailyReport);
        dom.logForm.addEventListener('submit', Logger.handleLogSubmit);
        dom.showSystemBtn.addEventListener('click', App.handleShowSystem);

        // Modal close functionality
        document.body.addEventListener('click', (e) => {
            if (e.target.dataset.closeModal!== undefined) {
                const modal = e.target.closest('.modal');
                if (modal) toggleModal(modal.id, false);
            }
        });

        // Tag selection
        dom.logModal.addEventListener('click', (e) => {
            if (e.target.classList.contains('tag-group__tag')) {
                e.target.classList.toggle('tag-group__tag--selected');
            }
        });

        // Keyboard accessibility for modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const visibleModal = document.querySelector('.modal--visible');
                if (visibleModal) {
                    toggleModal(visibleModal.id, false);
                }
            }
        });
    };

    /**
     * 로그인/회원가입 폼을 전환합니다.
     * @param {'login' | 'signup'} formToShow - 보여줄 폼의 종류
     */
    const toggleAuthForm = (formToShow) => {
        if (formToShow === 'signup') {
            dom.loginForm.classList.add('hidden');
            dom.signupForm.classList.remove('hidden');
        } else {
            dom.signupForm.classList.add('hidden');
            dom.loginForm.classList.remove('hidden');
        }
        dom.loginError.classList.add('hidden');
        dom.signupError.classList.add('hidden');
    };

    /**
     * 특정 뷰(인증/메인 앱)를 보여줍니다.
     * @param {'auth' | 'app'} viewName - 보여줄 뷰의 이름
     */
    const showView = (viewName) => {
        dom.authView.classList.toggle('hidden', viewName === 'app');
        dom.appView.classList.toggle('hidden', viewName === 'auth');
    };

    /**
     * 인증 에러 메시지를 표시합니다.
     * @param {'login' | 'signup'} formType - 에러가 발생한 폼
     * @param {string} message - 표시할 에러 메시지
     */
    const displayAuthError = (formType, message) => {
        const errorEl = formType === 'login'? dom.loginError : dom.signupError;
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
    };

    /**
     * 헤더에 로그인된 사용자의 이메일을 업데이트합니다.
     * @param {string | null} email - 사용자 이메일
     */
    const updateUserEmail = (email) => {
        dom.userEmail.textContent = email || ''; // [오류 2 수정]
    };

    /**
     * 타이머 디스플레이를 업데이트합니다.
     * @param {string} timeString - "MM:SS" 형식의 시간 문자열
     * @param {string} mode - 현재 타이머 모드 ('집중' 또는 '휴식')
     */
    const updateTimerDisplay = (timeString, mode) => {
        dom.timerDisplay.textContent = timeString;
        document.title = `${timeString} - ${mode}`;
        if(mode) dom.timerMode.textContent = mode;
    };
    
    /**
     * 타이머 컨트롤 버튼의 상태를 업데이트합니다.
     * @param {string} state - 현재 타이머 상태 ('running', 'paused', 'idle')
     */
    const updateTimerControls = (state) => {
        dom.startBtn.textContent = (state === 'paused')? '계속' : '시작';
        dom.startBtn.disabled = (state === 'running');
        dom.pauseBtn.disabled = (state!== 'running');
    };

    /**
     * 컨디션 선택 화면과 타이머 화면을 전환합니다.
     * @param {'condition' | 'timer'} view - 보여줄 화면
     */
    const toggleTimerSubView = (view) => {
        dom.conditionSelector.classList.toggle('hidden', view === 'timer');
        dom.timerView.classList.toggle('hidden', view === 'condition');
    };

    /**
     * 모달의 가시성을 제어하고 접근성을 처리합니다.
     * @param {string} modalId - 제어할 모달의 ID
     * @param {boolean} show - 모달을 보여줄지 여부
     */
    const toggleModal = (modalId, show) => {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        if (show) {
            lastFocusedElement = document.activeElement;
            modal.classList.add('modal--visible');
            modal.setAttribute('aria-hidden', 'false');
            document.body.classList.add('body--modal-open');
            // Focus first focusable element in modal
            const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (focusable.length) focusable[0].focus();
        } else {
            modal.classList.remove('modal--visible');
            modal.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('body--modal-open');
            if (lastFocusedElement) lastFocusedElement.focus();
        }
    };

    /**
     * 마찰 로깅 폼을 초기화합니다.
     */
    const resetLogForm = () => {
        dom.logForm.reset();
        dom.logModal.querySelectorAll('.tag-group__tag--selected').forEach(tag => {
            tag.classList.remove('tag-group__tag--selected');
        });
    };

    /**
     * 데일리 리포트 데이터를 받아 모달에 렌더링합니다.
     * @param {object} reportData - 분석된 리포트 데이터
     */
    const renderReport = (reportData) => {
        const { totalFocusMinutes, pomodoroCount, topFrictions, insight, topFrictionTag } = reportData;
        
        const topFrictionsHTML = topFrictions.length > 0
           ? topFrictions.map(f => `<li>${f.tag} (${f.count}회)</li>`).join('')
            : '<li>기록된 마찰이 없습니다.</li>';

        dom.reportContent.innerHTML = `
            <div class="report__grid">
                <div class="report__stat">
                    <p class="report__title">총 집중 시간</p>
                    <p class="report__value">${totalFocusMinutes}분</p>
                </div>
                <div class="report__stat">
                    <p class="report__title">완료한 뽀모도로</p>
                    <p class="report__value">${pomodoroCount}회</p>
                </div>
            </div>
            <div class="report__stat">
                <p class="report__title">주요 마찰 Top 3</p>
                <ul class="report__value" style="font-size: 1rem; list-style: none; padding: 0;">${topFrictionsHTML}</ul>
            </div>
            ${insight? `<div class="report__insight"><p>${insight}</p></div>` : ''}
        `;
        
        dom.showSystemBtn.classList.toggle('hidden',!topFrictionTag);
        toggleModal('report-modal', true);
    };

    /**
     * 시스템 제안 텍스트를 설정하고 모달을 엽니다.
     * @param {string} text - 제안 내용
     */
    const showSystemSuggestion = (text) => {
        dom.systemSuggestionText.textContent = text;
        toggleModal('system-modal', true);
    };

    return {
        init: () => {
            cacheDOM();
            renderTagButtons();
            bindEventListeners();
        },
        showView,
        displayAuthError,
        updateUserEmail,
        updateTimerDisplay,
        updateTimerControls,
        toggleTimerSubView,
        toggleModal,
        resetLogForm,
        renderReport,
        showSystemSuggestion,
        getLogFormData: () => {
            const activity = dom.logActivity.value;
            // [오류 3, 4 수정]
            const selectedFrictionTags = Array.from(dom.frictionTagsContainer.querySelectorAll('.tag-group__tag--selected')).map(t => t.dataset.tag);
            const selectedEmotionTags = Array.from(dom.emotionTagsContainer.querySelectorAll('.tag-group__tag--selected')).map(t => t.dataset.tag);
            return { activity, frictionTags: selectedFrictionTags, emotionTags: selectedEmotionTags };
        }
    };
})();


/**
 * @module Auth
 * @description 사용자 인증 상태(로그인, 로그아웃, 현재 사용자)를 관리하는 모듈.
 */
const Auth = (() => {
    let currentUser = null;

    /**
     * 모듈을 초기화하고 인증 상태 리스너를 설정합니다.
     */
    const init = () => {
        FirebaseAPI.listenAuthStateChange(user => {
            currentUser = user;
            if (user) {
                UI.showView('app');
                UI.updateUserEmail(user.email);
            } else {
                UI.showView('auth');
                UI.updateUserEmail(null);
                UI.toggleTimerSubView('condition');
                Timer.reset();
            }
        });
    };

    /**
     * 회원가입을 처리합니다.
     * @param {string} email 
     * @param {string} password 
     */
    const handleSignUp = async (email, password) => {
        try {
            await FirebaseAPI.signUp(email, password);
        } catch (error) {
            UI.displayAuthError('signup', App.mapAuthCodeToMessage(error.code));
        }
    };

    /**
     * 로그인을 처리합니다.
     * @param {string} email 
     * @param {string} password 
     */
    const handleSignIn = async (email, password) => {
        try {
            await FirebaseAPI.signIn(email, password);
        } catch (error) {
            UI.displayAuthError('login', App.mapAuthCodeToMessage(error.code));
        }
    };

    /**
     * 로그아웃을 처리합니다.
     */
    const handleSignOut = async () => {
        try {
            await FirebaseAPI.logOut();
        } catch (error) {
            console.error("로그아웃 실패:", error);
            alert("로그아웃 중 오류가 발생했습니다.");
        }
    };

    return {
        init,
        handleSignUp,
        handleSignIn,
        handleSignOut,
        getCurrentUser: () => currentUser,
        isLoggedIn: () =>!!currentUser
    };
})();


/**
 * @module Timer
 * @description 뽀모도로 타이머의 핵심 로직과 상태 관리를 담당하는 모듈.
 */
const Timer = (() => {
    let state = {
        timerId: null,
        totalSeconds: 25 * 60,
        remainingSeconds: 25 * 60,
        mode: '집중', // '집중', '휴식'
        status: 'idle', // 'idle', 'running', 'paused'
        pomodoroCount: 0,
        logTriggered: false
    };
    const config = {
        focusDuration: 25,
        restDuration: 5
    };
    const alarm = new Audio('https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg');

    /**
     * 타이머를 1초마다 업데이트하는 함수.
     */
    const tick = () => {
        state.remainingSeconds--;
        UI.updateTimerDisplay(formatTime(state.remainingSeconds), state.mode);

        // 80% 경과 시점 체크
        if (state.mode === '집중' &&!state.logTriggered) {
            const eightyPercent = state.totalSeconds * 0.2; // 남은 시간이 20%일 때
            if (state.remainingSeconds <= eightyPercent) {
                state.logTriggered = true;
                Logger.triggerLogPopup();
            }
        }
        
        if (state.remainingSeconds <= 0) {
            completeSession();
        }
    };

    /**
     * 현재 세션(집중/휴식)을 완료하고 다음 세션으로 전환합니다.
     */
    const completeSession = () => {
        clearInterval(state.timerId);
        alarm.play();
        
        if (state.mode === '집중') {
            state.pomodoroCount++;
            state.mode = '휴식';
            state.totalSeconds = config.restDuration * 60;
        } else {
            state.mode = '집중';
            state.totalSeconds = config.focusDuration * 60;
        }
        
        state.remainingSeconds = state.totalSeconds;
        state.status = 'idle';
        state.logTriggered = false;
        
        UI.updateTimerDisplay(formatTime(state.remainingSeconds), state.mode);
        UI.updateTimerControls(state.status);
        
        // 자동으로 다음 세션 시작
        start();
    };

    /**
     * 초를 "MM:SS" 형식의 문자열로 변환합니다.
     * @param {number} seconds - 변환할 총 초
     * @returns {string} "MM:SS" 형식의 문자열
     */
    const formatTime = (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
    };

    /**
     * 타이머를 시작하거나 계속합니다.
     */
    const start = () => {
        if (state.status === 'running') return;
        state.status = 'running';
        state.timerId = setInterval(tick, 1000);
        UI.updateTimerControls(state.status);
    };

    /**
     * 타이머를 일시정지합니다.
     */
    const pause = () => {
        if (state.status!== 'running') return;
        clearInterval(state.timerId);
        state.status = 'paused';
        UI.updateTimerControls(state.status);
    };

    /**
     * 타이머를 현재 세션의 처음으로 리셋합니다.
     */
    const reset = () => {
        clearInterval(state.timerId);
        state.status = 'idle';
        state.remainingSeconds = state.totalSeconds;
        state.logTriggered = false;
        UI.updateTimerDisplay(formatTime(state.remainingSeconds), state.mode);
        UI.updateTimerControls(state.status);
    };

    return {
        start,
        pause,
        reset,
        setConfig: (focus, rest) => {
            config.focusDuration = focus;
            config.restDuration = rest;
            state.mode = '집중';
            state.totalSeconds = config.focusDuration * 60;
            state.pomodoroCount = 0;
            reset();
        },
        getPomodoroCount: () => state.pomodoroCount,
        getCurrentSessionDuration: () => Math.round(state.totalSeconds / 60)
    };
})();


/**
 * @module Logger
 * @description 마찰 로깅 팝업 표시 및 데이터 제출 로직을 담당하는 모듈.
 */
const Logger = (() => {
    /**
     * 타이머를 잠시 멈추고 마찰 로깅 팝업을 엽니다.
     */
    const triggerLogPopup = () => {
        Timer.pause();
        UI.toggleModal('log-modal', true);
    };

    /**
     * 마찰 로그 폼 제출을 처리합니다.
     * @param {Event} e - 폼 제출 이벤트
     */
    const handleLogSubmit = async (e) => {
        e.preventDefault();
        const user = Auth.getCurrentUser();
        if (!user) return;

        const { activity, frictionTags, emotionTags } = UI.getLogFormData();
        if (!activity) {
            alert("수행 내용을 입력해주세요.");
            return;
        }

        const logData = {
            activity,
            frictionTags,
            emotionTags,
            sessionDuration: Timer.getCurrentSessionDuration(),
            timestamp: Timestamp.now()
        };

        try {
            await FirebaseAPI.saveLog(user.uid, logData);
            UI.resetLogForm();
            UI.toggleModal('log-modal', false);
            Timer.start(); // 타이머 계속
        } catch (error) {
            console.error("로그 저장 실패:", error);
            alert("로그 저장 중 오류가 발생했습니다.");
        }
    };

    return {
        triggerLogPopup,
        handleLogSubmit
    };
})();


/**
 * @module Report
 * @description 데일리 리포트 생성 및 규칙 기반 분석을 담당하는 모듈.
 */
const Report = (() => {
    /**
     * 하루치 로그를 분석하여 리포트 데이터를 생성하고 UI에 렌더링합니다.
     */
    const generateDailyReport = async () => {
        const user = Auth.getCurrentUser();
        if (!user) return;

        try {
            const logs = await FirebaseAPI.getTodaysLogs(user.uid);
            
            const totalFocusMinutes = logs.reduce((sum, log) => {
                // 각 로그는 80% 시점에 기록되므로, 전체 세션 시간을 더함
                return sum + log.sessionDuration;
            }, 0);

            const frictionCounts = logs
               .flatMap(log => log.frictionTags)
               .reduce((acc, tag) => {
                    acc[tag] = (acc[tag] || 0) + 1; // [오류 5 수정]
                    return acc;
                }, {});

            const topFrictions = Object.entries(frictionCounts)
               .sort(([, a], [, b]) => b - a)
               .slice(0, 3)
               .map(([tag, count]) => ({ tag, count }));
            
            const topFrictionTag = topFrictions.length > 0 ? topFrictions[0].tag : null; // [오류 6 수정]

            const insight = generateInsight(frictionCounts);

            const reportData = {
                totalFocusMinutes,
                pomodoroCount: Timer.getPomodoroCount(),
                topFrictions,
                insight,
                topFrictionTag
            };
            
            UI.renderReport(reportData);

        } catch (error) {
            console.error("리포트 생성 실패:", error);
            alert("리포트를 불러오는 중 오류가 발생했습니다.");
        }
    };
    
    /**
     * 마찰 데이터를 기반으로 규칙 기반 통찰을 생성합니다.
     * @param {object} frictionCounts - 마찰 태그별 횟수
     * @returns {string | null} 분석 문구 또는 null
     */
    const generateInsight = (frictionCounts) => {
        if ((frictionCounts['업무 외 검색'] || 0) >= 3) { // [오류 7 수정]
            return "패턴 분석: [업무 외 검색]으로 인해 집중력이 자주 분산되는 경향이 발견되었습니다. 특히 특정 주제에 대한 [호기심]이 함께 발생할 때 빈도가 높을 수 있습니다.";
        }
        if ((frictionCounts['메신저 확인'] || 0) >= 4) { // [오류 7 수정]
            return "패턴 분석: [메신저 확인] 마찰이 잦습니다. 중요한 연락을 놓칠지 모른다는 [불안감]이 원인일 수 있습니다. 집중 시간에는 알림을 잠시 꺼두는 것을 고려해보세요.";
        }
        if ((frictionCounts['불필요한 생각'] || 0) >= 3) { // [오류 7 수정]
             return "패턴 분석: [불필요한 생각]이 집중을 방해하는 주요 원인으로 보입니다. 이는 [피로감]이 높을 때 더 자주 발생할 수 있습니다.";
        }
        return null;
    };

    /**
     * 가장 빈번한 마찰에 대한 해결 시스템을 제안합니다.
     * @param {string} topFrictionTag - 가장 많이 발생한 마찰 태그
     * @returns {string} 시스템 제안 문구
     */
    const getSystemSuggestion = (topFrictionTag) => {
        switch (topFrictionTag) {
            case '업무 외 검색':
                return "집중 세션 중 불필요한 사이트 접속을 막는 브라우저 확장 프로그램 'BlockSite' 사용을 시스템화하는 것을 추천합니다. 이를 통해 의도치 않은 정보의 바다에 빠지는 것을 막을 수 있습니다.";
            case '불필요한 생각':
                return "집중 세션 시작 전, 2분간 머릿속 생각을 모두 비워내는 '브레인 덤프'를 시스템화하는 것을 추천합니다. 떠오르는 생각을 즉시 기록하면 '나중에 처리할 수 있다'는 안정감을 얻어 현재 과제에 더 몰입할 수 있습니다.";
            case '메신저 확인':
                return "집중 시간에는 메신저 앱을 완전히 종료하거나, 특정 시간(예: 매시 50분)에만 확인하는 '메시지 타임 블록' 시스템을 도입하는 것을 추천합니다.";
            default:
                return "가장 큰 마찰을 해결하기 위한 자신만의 시스템을 구축해보세요. 예를 들어, [주변 소음]이 문제라면 노이즈 캔슬링 헤드폰 사용을 시스템화할 수 있습니다.";
        }
    };

    return {
        generateDailyReport,
        getSystemSuggestion
    };
})();


/**
 * @module App
 * @description 애플리케이션의 전체적인 흐름을 제어하고 모듈들을 조율하는 최상위 컨트롤러.
 */
const App = (() => {
    /**
     * Firebase 인증 에러 코드를 사용자 친화적인 메시지로 변환합니다.
     * @param {string} code - Firebase Auth 에러 코드
     * @returns {string} 사용자에게 보여줄 메시지
     */
    const mapAuthCodeToMessage = (code) => {
        switch (code) {
            case 'auth/invalid-email':
                return '유효하지 않은 이메일 형식입니다.';
            case 'auth/user-not-found':
            case 'auth/wrong-password':
                return '이메일 또는 비밀번호가 일치하지 않습니다.';
            case 'auth/email-already-in-use':
                return '이미 사용 중인 이메일입니다.';
            case 'auth/weak-password':
                return '비밀번호는 6자리 이상이어야 합니다.';
            default:
                return '인증 중 오류가 발생했습니다. 다시 시도해주세요.';
        }
    };

    /**
     * 사용자 컨디션 선택을 처리합니다.
     * @param {Event} e - 클릭 이벤트
     */
    const handleConditionSelect = (e) => {
        if (e.target.tagName!== 'BUTTON') return;
        const condition = e.target.dataset.condition;
        
        // 컨디션 기반 AI 추천 (규칙 기반)
        let focus = 25, rest = 5;
        let recommendation = `기본 설정인 ${focus}분 집중, ${rest}분 휴식으로 시작합니다.`;

        switch (condition) {
            case '최상':
                focus = 50; rest = 10;
                recommendation = `컨디션이 최상이시군요! ${focus}분 길게 집중하고 ${rest}분 휴식하는 사이클을 추천합니다.`;
                break;
            case '좋음':
                focus = 30; rest = 5;
                recommendation = `컨디션이 좋으시네요. ${focus}분 집중, ${rest}분 휴식으로 효율을 높여보세요.`;
                break;
            case '나쁨':
                rest = 10;
                recommendation = `컨디션이 좋지 않으시군요. 무리하지 마세요. ${focus}분 짧게 집중하고 ${rest}분 충분히 휴식하는 건 어떠세요?`;
                break;
        }
        
        alert(recommendation);
        Timer.setConfig(focus, rest);
        UI.toggleTimerSubView('timer');
    };

    /**
     * 프리셋 버튼 선택을 처리합니다.
     * @param {Event} e - 클릭 이벤트
     */
    const handlePresetSelect = (e) => {
        const btn = e.target.closest('.button--preset');
        if (!btn) return;
        const focus = parseInt(btn.dataset.focus, 10);
        const rest = parseInt(btn.dataset.rest, 10);
        Timer.setConfig(focus, rest);
        alert(`${focus}분 집중, ${rest}분 휴식으로 설정이 변경되었습니다.`);
    };
    
    /**
     * 리포트 모달에서 '시스템 제작' 버튼 클릭을 처리합니다.
     */
    const handleShowSystem = () => {
        const reportContent = document.getElementById('report-content');
        const topFrictionItem = reportContent.querySelector('.report__value li');
        if (topFrictionItem) {
            const topFrictionText = topFrictionItem.textContent.split(' (')[0]; // [오류 8 수정]
            const suggestion = Report.getSystemSuggestion(topFrictionText);
            UI.showSystemSuggestion(suggestion);
        }
    };

    return {
        init: () => {
            FirebaseAPI.init();
            UI.init();
            Auth.init();
        },
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
        handleConditionSelect,
        handlePresetSelect,
        handleShowSystem,
        mapAuthCodeToMessage
    };
})();


// ===================================================================================
// 애플리케이션 진입점 (Entry Point)
// DOM 콘텐츠가 모두 로드된 후 App 모듈을 초기화합니다.
// ===================================================================================
document.addEventListener('DOMContentLoaded', App.init);
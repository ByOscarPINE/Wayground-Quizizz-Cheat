// ==UserScript==
// @name         Wayground Quizizz Cheat: Show Answers & Block AntiCheat
// @description Wayground Hack injects answers into the UI and neutralizes anti-cheat telemetry; includes stealth focus protection making your activity invisible and re-enables copy, paste, and text selection.
// @namespace    http://tampermonkey.net/
// @version      1.0.2
// @author       byOscar
// @license      GPLv3
// @match        *://*.wayground.com/*
// @match        *://*.quizizz.com/*
// @icon         https://cf.quizizz.com/img/wayground/brand/favicon/favicon-32x32.ico
// @grant        GM_xmlhttpRequest
// @updateURL    https://greasyfork.org/scripts/577388/code/script.meta.js
// @downloadURL  https://greasyfork.org/scripts/577388/code/script.user.js

// ==/UserScript==

(function () {

    'use strict';

    const infractions = /^https:\/\/wayground\.com\/_gameapi\/main\/public\/v1\/games\/[a-f0-9]+\/player-infraction/;
    const rejoin = /^https:\/\/wayground\.com\/_gameapi\/main\/public\/v1\/games\/([a-f0-9]{24})\/rejoin/;
    const join = /^https:\/\/wayground\.com\/play-api\/v5\/join/;
    const soloJoin = /^https:\/\/wayground\.com\/play-api\/v4\/soloJoin/;
    const base = /^https:\/\/wayground\.com\/_gameapi\/main\/public\/v1\/students\/attempts\/([a-f0-9]{24})/;
    const checkRoom = /^https:\/\/wayground\.com\/play-api\/v5\/checkRoom/;

    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
        try {
            this._url = url;
        } catch (e) {
            console.warn("Could not capture URL in .open", e);
        }
        return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (body) {
        try {
            if (this._url && infractions.test(this._url)) {
                console.group('%c[Security] Request Blocked', 'color: red; font-weight: bold;');
                try {
                    const payload = JSON.parse(body);
                    console.log('%cBlocked data:', 'font-weight: bold;', payload);
                } catch (e) {
                    console.log('%cBlocked raw content:', 'font-weight: bold;', body, e);
                }
                console.groupEnd();
                return;
            }

            const isJoin = join.test(this._url);
            const isRejoin = rejoin.test(this._url);
            const isSoloJoin = soloJoin.test(this._url);
            const isBase = base.test(this._url);
            const isCheckRoom = checkRoom.test(this._url);

            if (this._url && (isJoin || isRejoin || isSoloJoin || isBase || isCheckRoom)) {
                this.addEventListener('load', function () {
                    function applyPatches(xhrInstance, modifiedResponse) {
                        Object.defineProperty(xhrInstance, 'responseText', {
                            get: () => modifiedResponse,
                            configurable: true
                        });
                        Object.defineProperty(xhrInstance, 'response', {
                            get: () => modifiedResponse,
                            configurable: true
                        });
                    }

                    try {
                        let quizId = null;
                        if (isCheckRoom) {
                            const data = JSON.parse(this.responseText);
                            try {
                                data.room.options.antiCheating.enabled = false;
                            } catch {
                                console.log("Error disabling anti-cheat");
                            }
                            const modifiedResponse = JSON.stringify(data);
                            applyPatches(this, modifiedResponse);
                            const id = Object.keys(data.room?.metadata?.qm)[0];
                            quizId = id.slice(0, -1) + "2";
                            fetchQuizAnswers(quizId);
                        } else if (isJoin) {
                            const data = JSON.parse(this.responseText);
                            try {
                                data.room.options.antiCheating.enabled = false;
                            } catch {
                                console.log("Error disabling anti-cheat");
                            }
                            const modifiedResponse = JSON.stringify(data);
                            applyPatches(this, modifiedResponse);
                            const id = Object.keys(data.room?.metadata?.qm)[0];
                            quizId = id.slice(0, -1) + "2";
                            fetchQuizAnswers(quizId);
                        } else if (isRejoin) {
                            const data = JSON.parse(this.responseText);
                            try {
                                data.data.room.options.antiCheating.enabled = false;
                            } catch {
                                console.log("Error disabling anti-cheat");
                            }
                            const modifiedResponse = JSON.stringify(data);
                            applyPatches(this, modifiedResponse);
                            const id = Object.keys(data.data?.room?.metadata?.qm)[0];
                            quizId = id.slice(0, -1) + "2";
                            fetchQuizAnswers(quizId);
                        } else if (isSoloJoin) {
                            const data = JSON.parse(body);
                            quizId = data.quizId;
                            fetchQuizAnswers(quizId);
                        } else if (isBase) {
                            const data = JSON.parse(this.responseText);
                            quizId = data.data?.quizInfo?.quizId;
                            fetchQuizAnswers(quizId);
                        } else {
                            console.error("Error: request type does not match any registered request");
                        }
                    } catch (e) {
                        console.error('Error in game join flow', e);
                    }
                });
            }
        } catch (e) {
            console.error("Critical error in .send interceptor:", e);
        }
        return originalSend.apply(this, arguments);
    };

    let savedQuestions = null;

    function fetchQuizAnswers(quizId) {
        const cleanRoomId = quizId.toString().trim();
        try {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://wayground.com/api/main/quiz/${cleanRoomId}`,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0'
                },
                onload: function (response) {
                    try {
                        const data = JSON.parse(response.responseText);
                        if (data.success && data.data?.quiz?.info?.questions) {
                            savedQuestions = data.data.quiz.info.questions;
                            highlightCorrectAnswers();
                            showNotification("Answers retrieved successfully");
                        }
                    } catch (e) {
                        showNotification("Failed to retrieve answers", "#af4c4c");
                        console.error('Error parsing API answers', e);
                    }
                },
                onerror: (err) => {
                    showNotification("Failed to retrieve answers", "#af4c4c");
                    console.error("GM_xmlhttpRequest failed", err);
                }
            });
        } catch (e) {
            showNotification("Failed to retrieve answers", "#af4c4c");
            console.error("Could not execute GM_xmlhttpRequest", e);
        }
    }

    function highlightCorrectAnswers() {
        try {
            if (!savedQuestions) return;
            const questionContainer = document.querySelector('[data-quesid]');
            const currentQuestionId = questionContainer?.getAttribute('data-quesid');
            if (currentQuestionId) {
                const questionData = savedQuestions.find((q) => q._id === currentQuestionId);
                if (questionData && questionData.structure.settings.hasCorrectAnswer) {
                    const rawAnswer = questionData.structure.answer;
                    if (questionData.type === 'BLANK') {
                        const correctButton = document.querySelector('.content-slot.resizeable.text-lg.font-semibold:not(.modified)');
                        if (correctButton) {
                            const immediateParent = correctButton.parentElement;
                            if (immediateParent) {
                                correctButton.classList.add('modified');
                                const answer = document.createElement('div');
                                answer.textContent = 'Possible Answer: ' + questionData.structure.options[1].text;
                                answer.style.opacity = '0.05';
                                correctButton.appendChild(answer);
                            }
                        } else {
                            const container = document.querySelector('.p-4.sm\\:p-6.h-full.rounded-md.overflow-y-auto');
                            if (container && !container.querySelector('.subtle-answer-text')) {
                                const answer = document.createElement('div');
                                answer.className = 'subtle-answer-text';
                                answer.textContent = 'Possible Answer: ' + questionData.structure.options[1].text;
                                answer.style.cssText = `
                                    margin-top: 10px;
                                    font-weight: bold;
                                    pointer-events: none;
                                `;
                                container.appendChild(answer);
                            }
                        }
                    }
                    const answerIndices = Array.isArray(rawAnswer) ? rawAnswer : [rawAnswer];
                    answerIndices.forEach(index => {
                        const correctButton = document.querySelector(`[data-cy="option-${index}"]`);
                        if (correctButton && !correctButton.querySelector('.subtle-check') && shouldShowCheck()) {
                            const checkmark = document.createElement('span');
                            checkmark.className = 'subtle-check';
                            checkmark.innerHTML = '&#10003;';
                            checkmark.style.cssText = `
                                position: absolute;
                                top: 8px;
                                right: 12px;
                                font-size: 22px;
                                font-weight: bold;
                                pointer-events: none;
                                z-index: 10;
                            `;
                            if (window.getComputedStyle(correctButton).position === 'static') {
                                correctButton.style.position = 'relative';
                            }
                            correctButton.appendChild(checkmark);
                        }
                    });
                } else if (questionData?.structure.kind === "OPEN") {
                    console.log("Open question detected: No automatic answer available.");
                }
            }
        } catch (e) {
            console.warn("Error processing question type:", e);
        }
    }

    function shouldShowCheck() {
        const checkbox = document.getElementById('toggle-checkmark');
        return checkbox ? checkbox.checked : true;
    }

    const observer = new MutationObserver(() => {
        try {
            if (savedQuestions) highlightCorrectAnswers();
        } catch (e) {
            console.error("MutationObserver error", e);
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    function injectStatusShield() {
        try {
            if (document.getElementById('script-status-shield')) return;
            const dynamicStyle = document.createElement('style');
            dynamicStyle.id = 'dynamic-script-styles';
            document.head.appendChild(dynamicStyle);
            const shield = document.createElement('div');
            shield.id = 'script-status-shield';
            shield.innerHTML = '&#128737;';
            shield.style.cssText = `
                position:fixed; bottom:15px; right:15px; z-index:10000;
                font-size:18px; color:rgba(0,255,0,0.2); cursor:pointer;
                transition: transform 0.3s; user-select:none;
            `;
            const panel = document.createElement('div');

            panel.id = 'script-config-panel';

            panel.style.cssText = `
                position:fixed; bottom:50px; right:15px; z-index:9999;
                background: rgba(15, 15, 15, 0.98);
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 12px;
                padding: 18px;
                width: 240px;
                color: #eee;
                font-family: 'Segoe UI', Tahoma, sans-serif;
                display: none;
                box-shadow: 0 10px 40px rgba(0,0,0,0.6);
                backdrop-filter: blur(10px);
            `;

            panel.innerHTML = `
                <div id="panel-title" style="font-weight:bold; font-size:13px; margin-bottom:15px; color:#00ff00; letter-spacing:1px; border-bottom:1px solid #333; padding-bottom:8px;">
                    VISUAL SETTINGS
                </div>

                <div style="margin-bottom:12px;">
                    <label style="display:block; font-size:11px; margin-bottom:5px;">
                        CheckMark Color:
                    </label>

                    <input type="color" id="shield-color" value="#ffffff"
                        style="width:100%; height:25px; border:none; background:none; cursor:pointer;">
                </div>

                <div style="margin-bottom:12px;">
                    <label style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:5px;">
                        CheckMark Opacity: <span id="opacity-val">50%</span>
                    </label>

                    <input type="range" id="shield-opacity" min="0" max="100" value="50"
                        style="width:100%; cursor:pointer;">
                </div>

                <div style="display:flex; align-items:center; justify-content:space-between; padding-top:10px; border-top:1px solid #333;">
                    <span style="font-size:11px;">Enable Checks</span>
                    <input type="checkbox" id="toggle-checkmark" checked>
                </div>
            `;

            const updateStyles = () => {

                const color = document.getElementById('shield-color').value;
                const opacity = document.getElementById('shield-opacity').value / 100;
                const isChecked = document.getElementById('toggle-checkmark').checked;
                document.getElementById('opacity-val').innerText = `${Math.round(opacity * 100)}%`;
                const r = Number.parseInt(color.slice(1, 3), 16);
                const g = Number.parseInt(color.slice(3, 5), 16);
                const b = Number.parseInt(color.slice(5, 7), 16);
                const finalOpacity = isChecked ? opacity : 0;
                dynamicStyle.innerHTML = `
                    .subtle-check {
                        color: rgba(${r}, ${g}, ${b}, ${finalOpacity}) !important;
                        transition: color 0.2s ease;
                        pointer-events: ${isChecked ? 'auto' : 'none'};
                    }
                    #toggle-checkmark:checked ~ span {
                        color: ${color};
                    }
                `;
            };
            shield.onclick = () => {
                const isHidden = panel.style.display === 'none';
                panel.style.display = isHidden ? 'block' : 'none';
                shield.style.transform = isHidden
                    ? 'scale(1.2) rotate(90deg)'
                    : 'scale(1) rotate(0deg)';
            };

            document.body.appendChild(panel);
            document.body.appendChild(shield);
            document.getElementById('shield-color').oninput = updateStyles;
            document.getElementById('shield-opacity').oninput = updateStyles;
            document.getElementById('toggle-checkmark').onchange = updateStyles;
            updateStyles();
        } catch (e) {
            console.warn("UI error", e);
        }
    }

    injectStatusShield();

    function showNotification(message, color = '#4caf50') {
        const toast = document.createElement('div');
        Object.assign(toast.style, {
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: color,
            color: 'white',
            padding: '12px 24px',
            borderRadius: '8px',
            zIndex: '9999',
            fontSize: '16px',
            fontWeight: 'bold',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            transition: 'opacity 0.5s ease',
            fontFamily: 'sans-serif'
        });

        toast.innerText = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }

    try {
        console.log("%cProtected", "color: #ff00ff; font-weight: bold;");
        const mockProperty = (obj, prop, val) => {
            try {
                Object.defineProperty(obj, prop, {
                    get: () => val,
                    configurable: true
                });
            } catch (e) {
                console.warn(`Could not mock ${prop} on`, obj, e);
            }
        };

        mockProperty(document, 'fullscreenElement', document.documentElement);
        mockProperty(document, 'visibilityState', 'visible');
        mockProperty(document, 'hidden', false);

        const style = document.createElement('style');

        style.innerHTML = `
            * {
                user-select: text !important;
                -webkit-user-select: text !important;
            }
        `;

        document.head.appendChild(style);

        const interceptEvent = (type) => {
            window.addEventListener(type, (e) => {
                try {
                    e.stopImmediatePropagation();
                } catch (e) {
                    console.error("Event interception error", e);
                }
            }, true);
        };

        ['fullscreenchange', 'blur', 'visibilitychange', 'mouseout']
            .forEach(interceptEvent);

        const originalFetch = window.fetch;

        window.fetch = async (...args) => {
            try {
                const config = args[1];
                if (
                    config?.body &&
                    (
                        config.body.includes("infraction") ||
                        config.body.includes("fullscreenExit")
                    )
                ) {
                    return new Response(
                        JSON.stringify({ success: true }),
                        { status: 200 }
                    );
                }
            } catch (e) {
                console.error("Fetch interceptor error", e);
            }
            return originalFetch(...args);
        };
    } catch (e) {
        console.error("Visibility protection error", e);
    }

})();
// ==UserScript==
// @name         Wayground Quizizz Cheat: Show Answers & Block AntiCheat
// @description  Wayground Hack injects answers into the UI and neutralizes anti-cheat telemetry; includes stealth focus protection making your activity invisible and re-enables copy, paste, and text selection; powered by AI.
// @namespace    https://github.com/ByOscarPINE
// @version      2.0.0
// @author       byOscar
// @license      GPLv3
// @match        *://*.wayground.com/*
// @match        *://*.quizizz.com/*
// @icon         https://cf.quizizz.com/img/wayground/brand/favicon/favicon-32x32.ico
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @connect      generativelanguage.googleapis.com
// @connect      api.openai.com

// @downloadURL https://update.greasyfork.org/scripts/577388/Wayground%20Quizizz%20Cheat%3A%20Show%20Answers%20%20Block%20AntiCheat.user.js
// @updateURL https://update.greasyfork.org/scripts/577388/Wayground%20Quizizz%20Cheat%3A%20Show%20Answers%20%20Block%20AntiCheat.meta.js
// ==/UserScript==

(function() {
    'use strict';
    let API_KEY = null;
    let QUIZ_DATA = null;
    let ROOM_DATA = null;
    let AI_DATA = null;
    let OK = false;
    let QUIZ_NAME = 'Waiting';
    let ANTI_CHEAT = false;
    let TYPE_QUIZ = '';
    let CLEANED_QUESTIONS = null;

    const infractions = /^https:\/\/wayground\.com\/_gameapi\/main\/public\/v1\/games\/[a-f0-9]+\/player-infraction/;
    const rejoin = /^https:\/\/wayground\.com\/_gameapi\/main\/public\/v1\/games\/([a-f0-9]{24})\/rejoin/;
    const join = /^https:\/\/wayground\.com\/play-api\/v5\/join/;
    const soloJoin = /^https:\/\/wayground\.com\/play-api\/v4\/soloJoin/;
    const base = /^https:\/\/wayground\.com\/_gameapi\/main\/public\/v1\/students\/attempts\/([a-f0-9]{24})/;
    const checkRoom = /^https:\/\/wayground\.com\/play-api\/v5\/checkRoom/;
    const checkRoomAsignmets = /^https:\/\/wayground\.com\/play-api\/v5\/checkAssignment/;

    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
        try {
            this._url = url;
        } catch (e) {
            console.warn("Could not capture request URL in XMLHttpRequest.open", e);
        }
        return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (body) {
        try {
            if (this._url && infractions.test(this._url)) {
                console.group('%c[Security] Request Blocked', 'color: red; font-weight: bold;');
                try {
                    const payload = JSON.parse(body);
                    console.log('%cBlocked payload:', 'font-weight: bold;', payload);
                } catch (e) {
                    console.log('%cBlocked raw payload:', 'font-weight: bold;', body, e);
                }
                console.groupEnd();
                return;
            }

            const isJoin = join.test(this._url);
            const isRejoin = rejoin.test(this._url);
            const isSoloJoin = soloJoin.test(this._url);
            const isBase = base.test(this._url);
            const isCheckRoom = checkRoom.test(this._url);
            const isCheckRoomAsignment = checkRoomAsignmets.test(this._url);

            if (this._url && (isJoin || isRejoin || isSoloJoin || isBase || isCheckRoom || isCheckRoomAsignment)) {
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
                        if (isJoin) {
                            const data = JSON.parse(this.responseText);
                            try {
                                data.room.options.antiCheating.enabled = false;
                                data.room.options.focusMode = false;
                                data.room.options.disableCopyPaste = false;
                                data.room.options.disableRightClick = false;
                                data.room.options.alertOnInfraction = false;
                                ANTI_CHEAT = true;
                                showNotification("Anti-cheat disabled");
                                console.log("Anti-cheat disabled");
                            } catch {
                                ANTI_CHEAT = false;
                                showNotification("Failed to disable anti-cheat", "#af4c4c");
                                console.log("Failed to disable anti-cheat");
                            }
                            const modifiedResponse = JSON.stringify(data);
                            applyPatches(this, modifiedResponse);
                            ROOM_DATA = data?.room;
                            QUIZ_NAME = data?.room?.name;
                            TYPE_QUIZ = data?.room?.type;
                            startQuizSolver(data?.room);
                        } else if (isRejoin) {
                            const data = JSON.parse(this.responseText);
                            if(data?.data?.room?.type === 'solo'){
                                fetchQuizDataId(data?.data?.room?.hash)
                                .then((_id) => {
                                    if (_id) {
                                        console.log("Quiz ID retrieved successfully:", _id);
                                        fetchQuizAnswers(_id);
                                    }
                                })
                                    .catch((error) => {
                                    console.error("Failed to get quiz ID:", error);
                                });
                            }else{
                                try {
                                    data.data.room.options.antiCheating.enabled = false;
                                    data.data.room.options.focusMode = false;
                                    data.data.room.options.disableCopyPaste = false;
                                    data.data.room.options.disableRightClick = false;
                                    data.data.room.options.alertOnInfraction = false;
                                    ANTI_CHEAT = true;
                                    showNotification("Anti-cheat disabled");
                                    console.log("Anti-cheat disabled");
                                } catch {
                                    ANTI_CHEAT = false;
                                    showNotification("Failed to disable anti-cheat", "#af4c4c");
                                    console.log("Failed to disable anti-cheat");
                                }
                                const modifiedResponse = JSON.stringify(data);
                                applyPatches(this, modifiedResponse);
                                ROOM_DATA = data?.data?.room;
                                QUIZ_NAME = data?.data?.room?.name;
                                TYPE_QUIZ = data?.data?.room?.type;
                                startQuizSolver(data?.data?.room);
                            }
                        } else if (isSoloJoin) {
                            const data = JSON.parse(body);
                            quizId = data.quizId;
                            fetchQuizAnswers(quizId);
                        } else if (isBase) {
                            const data = JSON.parse(this.responseText);
                            quizId = data.data?.quizInfo?.quizId;
                            fetchQuizAnswers(quizId);
                        } else if(isCheckRoomAsignment) {
                            const data = JSON.parse(this.responseText);
                            console.log("Assignment room response:", data);
                            try {
                                data.room.options.antiCheating.enabled = false;
                                data.room.options.focusMode = false;
                                data.room.options.reviewAndSubmit = true;
                                data.room.options.timer = false;
                                data.room.options.redemption = "yes";
                                data.room.options.studentQuizReview_2 = "yes";
                                console.log("Anti-cheat disabled");
                            const modifiedResponse = JSON.stringify(data);
                            applyPatches(this, modifiedResponse);
                            } catch {
                                console.log("Failed to disable anti-cheat");
                            }
                        } else {
                        console.error("Request type does not match any registered request.");
                        }
                    } catch (e) {
                        console.error('Error in game join flow:', e);
                    }
                });
            }
        } catch (e) {
            console.error("Critical error in .send interceptor:", e);
        }
        return originalSend.apply(this, arguments);
    };

    function fetchQuizDataId(hash) {
        const cleanRoomId = hash.toString().trim();

        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://wayground.com/_gameapi/main/public/v1/students/games/${cleanRoomId}`,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0'
                },
                onload: function (response) {
                    try {
                        const data = JSON.parse(response.responseText);

                        if (!data) {
                            reject("No data found");
                            return;
                        }
                        resolve(data?.data?.items[0]?.quizId)

                    } catch (e) {
                        showNotification("Error processing quiz API data", "#af4c4c");
                        console.error('Error processing quiz API data', e);
                        reject(e);
                    }
                },
                onerror: function (err) {
                    showNotification("GM_xmlhttpRequest failed", "#af4c4c");
                    console.error("GM_xmlhttpRequest failed", err);
                    reject(err);
                }
            });
        });
    }

    let shadow = null;

    function toLoad() {
        try {
            const mainBody = document.body;
            let html = null;

            if (mainBody) {
                html = document.documentElement;
                html.style.setProperty('--color-picked-user', '#4579f2');
                html.style.setProperty('--color-cheat', 'currentColor');
            } else {
                console.warn("Could not access the iframe");
            }

            const host = document.createElement('div');
            host.id = 'wayground-host';
            if(mainBody) { mainBody.appendChild(host); }
            shadow = host.attachShadow({ mode: 'open' });
            shadow.innerHTML = `
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@500&display=swap');
                :host {
                    --loader-size: 24px;
                    --jump-height: -30px;
                    --anim-dur: 1.4s;
                    position: fixed;
                    bottom: 10px;
                    right: 10px;
                    z-index: 99999;
                    pointer-events: none;
                }

                .menu {
                    fill: var(--icon-color);
                }

                .main {
                    --secondary-color: #292929;
                    --main-color: rgba(255, 255, 255);
                    --icon-color: #292929;
                    display: grid;
                    grid-template-columns: repeat(12, 1fr);
                    gap: 0;
                    width: 280px;
                    align-items: center;
                    justify-content: center;
                    transition: gap 0.4s ease-in-out;
                    pointer-events: none;
                    position: relative;
                }

                .text {
                    opacity: 0;
                    transition: 0.2s ease-in-out;
                    font-family: "Poppins", sans-serif;
                    font-weight: 500;
                    font-size: 16px;
                    color: var(--secondary-color);
                    margin: 0;
                }

                .subtextT {
                    transition: 0.2s ease-in-out;
                    color: var(--secondary-color);
                    margin: 0;
                    font-size: 12px;
                    opacity: 0;
                    font-family: 'Poppins', sans-serif;
                }

                .subtext {
                    transition: 0.2s ease-in-out;
                    color: var(--secondary-color);
                    margin: 0;
                    font-size: 12px;
                    opacity: 0.6;
                    font-family: 'Poppins', sans-serif;
                }

                .main_back {
                    position: absolute;
                    justify-self: center;
                    transition: 0.2s ease-in-out, 0.1s background-color ease-in-out, 0.1s background-image ease-in-out;
                }

                .cardBa {
                    display: flex;
                    background: transparent;
                    align-items: center;
                    justify-content: center;
                    width: 60px;
                    height: 60px;
                    backdrop-filter: blur(5px);
                    -webkit-backdrop-filter: blur(5px);
                    border-radius: 10px;
                    pointer-events: auto;
                }

                .card, .card-track {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 70px;
                    height: 70px;
                    border-top-left-radius: 10px;
                    border: 1px solid transparent;
                    gap: 3px;
                    will-change: transform;
                    transition: transform 0.3s cubic-bezier(0.25, 1, 0.5, 1), background-color 0.2s ease-in-out, background-color 0.2s ease, background-image 0.2s ease-in-out;
                }

                .card-track:hover {
                    background-color: var(--secondary-color);
                    box-shadow: 0px 10px 20px rgba(0, 0, 0, 0.2);
                }

                .card-track:hover .text {
                    color: var(--main-color) !important;
                }

                .card .title {
                    opacity: 0;
                    transition: 0.2s ease-in-out;
                    background: #f5e642;
                }

                .card:nth-child(1) {
                    grid-column: span 12;
                    width: 100%;
                }

                .card:nth-child(2) {
                    grid-column: span 7;
                    width: 100%;
                    flex-direction: column;
                    border-radius: 0px;
                }

                .card:nth-child(3) {
                    grid-column: span 5;
                    width: 100%;
                    flex-direction: column;
                    border-radius: 0px;
                }

                .card:nth-child(3) .shield {
                    opacity: 0;
                    transition: 0.2s ease-in-out;
                    fill: var(--secondary-color);
                }

                .card:nth-child(4) {
                    grid-column: span 6;
                    width: 100%;
                    flex-direction: column;
                    border-radius: 0px;
                }

                .card:nth-child(4) .toggleAns {
                    opacity: 0;
                    transition: 0.2s ease-in-out;
                    fill: var(--secondary-color);
                }

                .card:nth-child(5) {
                    grid-column: span 6;
                    width: 100%;
                    flex-direction: column;
                    border-radius: 0px;
                }

                .card:nth-child(5) .toggleAns {
                    opacity: 0;
                    transition: 0.2s ease-in-out;
                    fill: var(--secondary-color);
                }

                .card:nth-child(6) {
                    grid-column: span 4;
                    width: 100%;
                    border-radius: 0px;
                    border-bottom-left-radius: 10px;
                }

                .card:nth-child(6) .greasy {
                    opacity: 0;
                    transition: 0.2s ease-in-out;
                    fill: var(--secondary-color);
                }

                .card:nth-child(7) {
                    grid-column: span 4;
                    width: 100%;
                    border-radius: 0px;
                }

                .card:nth-child(7) .github {
                    opacity: 0;
                    transition: 0.2s ease-in-out;
                    fill: var(--secondary-color);
                }

                .card:nth-child(8) {
                    grid-column: span 4;
                    width: 100%;
                    border-radius: 0px;
                    border-bottom-right-radius: 10px;
                }

                .card:nth-child(8) .settings {
                    opacity: 0;
                    transition: 0.2s ease-in-out;
                    fill: var(--secondary-color);
                }


                .main:hover {
                    gap: 0.4em;
                    cursor: pointer;
                    pointer-events: auto;
                }

                .main:hover .words { opacity: 1; }
                .main:hover .text { opacity: 1; }
                .main:hover .subtextT { opacity: 0.6; }
                .main:hover .main_back { opacity: 0;display: none; }
                .main:hover .menu { opacity: 0; display: none; }
                .main:hover .card {
                    margin: 0;
                    border-radius: 10px;
                    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    background: var(--main-color);
                }

                .main:hover .card:nth-child(8) { border: transparent; }
                .main:hover .title { opacity: 1; }
                .main:hover .shield { opacity: 1; }
                .main:hover .toggleAns { opacity: 1; }
                .main:hover .greasy { opacity: 1; }
                .main:hover .github { opacity: 1; }
                .main:hover .settings { opacity: 1; }
                .card:hover {
                    transform: scale(1.02);
                }

                .card:nth-child(1):hover {
                    border-bottom: 5px solid #0a0a0a;
                    position: relative;
                    overflow: hidden;
                    display: flex;
                    align-items: center;
                    background-color: #f5e642;
                    background-image: repeating-linear-gradient(45deg, transparent 0px, transparent 8px, rgba(0, 0, 0, 0.12) 8px, rgba(0, 0, 0, 0.12) 10px);
                }

                .card:nth-child(1):hover .text { color: #292929; }
                .card:nth-child(2):hover { border-bottom: 5px solid #0a0a0a; background: #adb5bd; cursor: pointer; }
                .card:nth-child(2):hover .text { color: #292929; }
                .card:nth-child(3):hover { border-bottom: 5px solid #0a0a0a; background: #adb5bd; }
                .card:nth-child(3):hover .text { color: #292929; }
                .card:nth-child(3):hover .shield { fill: var(--secondary-color); }
                .card:nth-child(4):hover { border-bottom: 5px solid #0a0a0a; background: #adb5bd; }
                .card:nth-child(4):hover .text { color: #292929; }
                .card:nth-child(4):hover .toggleAns { fill: #292929; }
                .card:nth-child(5):hover { border-bottom: 5px solid #0a0a0a; background: #adb5bd; }
                .card:nth-child(5):hover .text { color: #292929; }
                .card:nth-child(5):hover .toggleAns { fill: #292929; }
                .card:nth-child(6):hover { border-bottom: 5px solid #0a0a0a; background-color: var(--secondary-color); }
                .card:nth-child(6):hover .greasy { fill: var(--main-color); }
                .card:nth-child(6):hover .svgIcon { transform: rotate(250deg); transition-duration: 1.5s; }
                .card:nth-child(7):hover { border-bottom: 5px solid #0a0a0a; background-color: var(--secondary-color); }
                .card:nth-child(7):hover .github { fill: var(--main-color); }
                .card:nth-child(7):hover .text { color: var(--main-color); }
                .card:nth-child(8):hover { border-bottom: 5px solid #0a0a0a; background-color: var(--secondary-color); }
                .card:nth-child(8):hover .settings { fill: var(--main-color); }
                .card:nth-child(8) > svg { animation: spin 4s linear infinite; transform-origin: center; }

                .loader-container {
                    position: relative;
                    width: var(--loader-size);
                    height: var(--loader-size);
                }

                .loader-shadow {
                    position: absolute;
                    bottom: -6px;
                    left: calc(var(--loader-size) * -0.2);
                    width: calc(var(--loader-size) * 1.4);
                    height: 4px;
                    background: rgba(0, 0, 0, 0.15);
                    border-radius: 50%;
                    animation: shadowScale var(--anim-dur) infinite;
                    transform-origin: center center;
                }

                .loader-box-wrap {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    transform-origin: bottom center;
                    animation: squash var(--anim-dur) infinite;
                }

                .loader-box {
                    width: 100%;
                    height: 100%;
                    animation: jumpRotate var(--anim-dur) infinite;
                    transform-origin: center center;
                }

                .loader-box svg {
                    width: 100%;
                    height: 100%;
                    display: block;
                }

                @keyframes squash {
                    0% { transform: scaleX(1.05) scaleY(0.95); animation-timing-function: ease-in-out; }
                    15% { transform: scaleX(0.95) scaleY(1.05); animation-timing-function: ease-out; }
                    50% { transform: scaleX(1) scaleY(1); animation-timing-function: ease-in; }
                    84.9% { transform: scaleX(0.95) scaleY(1.05); }
                    85% { transform: scaleX(1.15) scaleY(0.85); animation-timing-function: ease-in-out; }
                    100% { transform: scaleX(1.05) scaleY(0.95); }
                }

                @keyframes jumpRotate {
                    0% { transform: translateY(0) rotate(0deg); animation-timing-function: ease-in-out; }
                    15% { transform: translateY(0) rotate(0deg); animation-timing-function: ease-out; }
                    50% { transform: translateY(var(--jump-height)) rotate(45deg); animation-timing-function: ease-in; }
                    84.9% { transform: translateY(0) rotate(90deg); }
                    85% { transform: translateY(0) rotate(90deg); animation-timing-function: ease-in-out; }
                    100% { transform: translateY(0) rotate(90deg); }
                }

                @keyframes shadowScale {
                    0% { transform: scaleX(1.05); opacity: 0.15; animation-timing-function: ease-in-out; }
                    15% { transform: scaleX(0.9); opacity: 0.1; animation-timing-function: ease-out; }
                    50% { transform: scaleX(0.5); opacity: 0.05; animation-timing-function: ease-in; }
                    84.9% { transform: scaleX(0.9); opacity: 0.1; }
                    85% { transform: scaleX(1.15); opacity: 0.2; animation-timing-function: ease-in-out; }
                    100% { transform: scaleX(1.05); opacity: 0.15; }
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                #pause { display: none; }

                .words {
                    display: inline-block;
                    opacity: 0;
                    height: 1.5em;
                    overflow: hidden;
                    position: relative;
                }

                .word {
                    display: flex;
                    align-items: center;
                    height: 100%;
                    padding-left: 6px;
                    color: #956afa;
                    animation: spin_words 4s infinite ease-in-out;
                }

                @keyframes spin_words {
                    20% { transform: translateY(-102%); }
                    33% { transform: translateY(-100%); }
                    53% { transform: translateY(-202%); }
                    66% { transform: translateY(-200%); }
                    86% { transform: translateY(-302%); }
                    100% { transform: translateY(-300%); }
                }

                .switch {
                    font-size: 17px;
                    position: relative;
                    display: inline-block;
                    width: 40px;
                    height: 22px;
                    opacity: 0;
                }

                .main:hover .switch {
                    opacity: 1;
                }

                .switch input {
                    opacity: 0;
                    width: 0;
                    height: 0;
                }

                .slider {
                    position: absolute;
                    cursor: pointer;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: #fff;
                    border: 1px solid #adb5bd;
                    transition: .4s;
                    border-radius: 22px;
                }

                .slider:before {
                    position: absolute;
                    content: "";
                    height: 16px;
                    width: 16px;
                    border-radius: 50%;
                    left: 2px;
                    bottom: 2px;
                    background-color: #adb5bd;
                    transition: .4s;
                }

                input:checked + .slider {
                    background-color: #39be44;
                    border: 1px solid #39be44;
                }

                input:focus + .slider {
                    box-shadow: 0 0 1px #39be44;
                }

                input:checked + .slider:before {
                    transform: translateX(18px);
                    background-color: #fff;
                }

                .settings_menu, .terms_menu, .apikey_menu, .answers_menu {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    width: 100%;
                    min-height: 100%;
                    height: max-content;
                    background: var(--main-color);
                    border-radius: 10px;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
                    backdrop-filter: blur(5px);
                    -webkit-backdrop-filter: blur(5px);
                    filter: blur(0px);

                    opacity: 0;
                    filter: blur(10px);
                    pointer-events: none;
                    visibility: hidden;
                    max-height: 100%;
                    overflow: hidden;
                    transition: opacity 0.3s ease-in-out, filter 0.3s ease-in-out, max-height 0.6s ease-in-out, visibility 0.3s;

                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: flex-start;
                    padding: 20px;
                    box-sizing: border-box;
                    z-index: 100;
                    gap: 15px;
                }

                .settings-item {
                    border-radius: 8px; border: 1px solid rgba(150, 150, 150, 0.2);
                    padding: 10px 15px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    width: 100%;
                    box-sizing: border-box;
                }

                #close-settings, #close-terms, #close-apikey, #close-answers {
                    cursor: pointer;
                    fill: var(--secondary-color);
                    transition: transform 0.2s;
                }

                #close-settings:hover, #close-terms:hover, #close-apikey:hover, #close-answers:hover {
                    transform: scale(1.2);
                }

                .settings_menu.open, .terms_menu.open, .apikey_menu.open, .answers_menu.open {
                    opacity: 1;
                    filter: blur(0px);
                    max-height: 600px;
                    pointer-events: auto;
                    visibility: visible;
                    border-bottom: 5px solid #0a0a0a;
                    background-color: var(--main-color);
                }

                .settings_menu.open > div:first-child > .text, .terms_menu.open > div:first-child > .text, .apikey_menu.open > div:first-child > .text, .answers_menu.open > div:first-child > .text {
                    color: var(--secondary-color);
                }

                .settings_menu.open > div:first-child > #close-settings, .terms_menu.open > div:first-child > #close-terms, .apikey_menu.open > div:first-child > #close-apikey, .answers_menu.open > div:first-child > #close-answers {
                    fill: var(--secondary-color);
                }

                .settings_menu .settings-item .text, .answers_menu .settings-item .text {
                    color: var(--secondary-color) !important;
                }

                .main:has(.settings_menu.open, .terms_menu.open, .apikey_menu.open, .answers_menu.open) .card {
                    filter: blur(8px) !important;
                    pointer-events: none !important;
                    transition: filter 0.3s ease-in-out;
                }

                .menu-header {
                    width: 100%; display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;
                }

                .menu-title-wrapper {
                    display: flex; align-items: baseline; gap: 8px;
                }

                .menu-title {
                    opacity: 1; margin: 0; font-size: 18px; font-weight: bold;
                }

                .badge-version {
                    font-size: 11px; background: #4579f2; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-family: 'Poppins', sans-serif;
                }

                .settings-item-col {
                    display: flex; flex-direction: column; flex: 1; min-width: 0; padding-right: 10px;
                }

                .settings-item-title {
                    opacity: 1; font-size: 14px; color: var(--secondary-color);
                }

                .color-picker-input {
                    width: 40px; height: 22px; border: none; border-radius: 4px; cursor: pointer;
                }

                .btn-outline {
                    width: 90%; height: 40px; margin: 10px auto 0 auto; border-radius: 8px; border: 1px solid rgba(150, 150, 150, 0.2); cursor: pointer;
                }

                .btn-outline .text {
                    opacity: 1; font-size: 13px; font-weight: bold; color: var(--secondary-color); transition: color 0.2s ease;
                }

                .terms-content {
                    overflow-y: auto; max-height: 400px; font-size: 12px; color: var(--secondary-color); font-family: 'Poppins', sans-serif; text-align: left; padding-right: 5px;
                }

                #answers-list {
                scrollbar-width: none;
                -ms-overflow-style: none;
                }

                #answers-list::-webkit-scrollbar {
                display: none;
                }
            </style>

            <div class="main">
                <div class="card card-wide title">
                    <div style="display: flex; align-items: center;">
                    <p class="text">Wayground Cheat</p>
                        <div class="words">
                            <span class="word text">auto</span>
                            <span class="word text">simple</span>
                            <span class="word text">easy</span>
                            <span class="word text" aria-hidden="true">auto</span>
                        </div>
                    </div>
                </div>

                <div id="btn-answers" class="card" style="text-align: center;">
                    <p class="text" id="quiz-name-display" style="font-size: 14px;">${QUIZ_NAME}</p>
                    <p class="subtextT" id="quiz-status-display">Searching answers...</p>
                </div>

                <div id="card-anticheat" class="card">
                    <p class="text" style="margin-left: 5px; font-size: 14px;">Anti-Cheat</p>
                    <svg class="shield" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="m438-338 226-226-57-57-169 169-84-84-57 57 141 141Zm42 258q-139-35-229.5-159.5T160-516v-244l320-120 320 120v244q0 152-90.5 276.5T480-80Zm0-84q104-33 172-132t68-220v-189l-240-90-240 90v189q0 121 68 220t172 132Zm0-316Z"/></svg>
                    <p class="subtextT" id="anticheat-status-display" style="color: #39be44;">Safe</p>
                </div>

                <div id="toggleAns" class="card">
                    <p class="text" style="margin-left: 5px;">Show Answers</p>
                    <label class="switch">
                        <input type="checkbox" checked>
                        <span class="slider"></span>
                        </label>
                </div>

                <div id="btn-apikey" class="card" style="position: relative;">
                    <p class="text" style="margin-left: 5px;">Api key</p>
                    <p class="subtextT"> click for configuration</p>
                    <div id="main-ai-indicator" style="position: absolute; top: 12px; right: 15px; width: 8px; height: 8px; border-radius: 50%; background-color: gray; box-shadow: 0 0 5px gray;" title="AI is disabled"></div>
                </div>

                <a id="greasy" href="https://greasyfork.org/es/users/1600509-byoscarpine" class="card" target="_blank" rel="noopener noreferrer">
                    <svg class="greasy" height="30px" width="30px" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5.89 2.227a.28.28 0 0 1 .266.076l5.063 5.062c.54.54.509 1.652-.031 2.192l8.771 8.77c1.356 1.355-.36 3.097-1.73 1.728l-8.772-8.77c-.54.54-1.651.571-2.191.031l-5.063-5.06c-.304-.304.304-.911.608-.608l3.714 3.713L7.59 8.297 3.875 4.582c-.304-.304.304-.911.607-.607l3.715 3.714 1.067-1.066L5.549 2.91c-.228-.228.057-.626.342-.683ZM12 0C5.374 0 0 5.375 0 12s5.374 12 12 12c6.625 0 12-5.375 12-12S18.625 0 12 0Z"/>
                    </svg>
                </a>

                <a id="github" href="https://github.com/ByOscarPINE" class="card" target="_blank" rel="noopener noreferrer">
                    <svg height="30px" width="30px" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg" class="github">
                        <path d="M15,3C8.373,3,3,8.373,3,15c0,5.623,3.872,10.328,9.092,11.63C12.036,26.468,12,26.28,12,26.047v-2.051 c-0.487,0-1.303,0-1.508,0c-0.821,0-1.551-0.353-1.905-1.009c-0.393-0.729-0.461-1.844-1.435-2.526 c-0.289-0.227-0.069-0.486,0.264-0.451c0.615,0.174,1.125,0.596,1.605,1.222c0.478,0.627,0.703,0.769,1.596,0.769 c0.433,0,1.081-0.025,1.691-0.121c0.328-0.833,0.895-1.6,1.588-1.962c-3.996-0.411-5.903-2.399-5.903-5.098 c0-1.162,0.495-2.286,1.336-3.233C9.053,10.647,8.706,8.73,9.435,8c1.798,0,2.885,1.166,3.146,1.481C13.477,9.174,14.461,9,15.495,9 c1.036,0,2.024,0.174,2.922,0.483C18.675,9.17,19.763,8,21.565,8c0.732,0.731,0.381,2.656,0.102,3.594 c0.836,0.945,1.328,2.066,1.328,3.226c0,2.697-1.904,4.684-5.894,5.097C18.199,20.49,19,22.1,19,23.313v2.734 c0,0.104-0.023,0.179-0.035,0.268C23.641,24.676,27,20.236,27,15C27,8.373,21.627,3,15,3z"></path>
                    </svg>
                </a>

                <div id="config" class="card">
                    <svg class="settings" xmlns="http://www.w3.org/2000/svg" height="30px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="m370-80-16-128q-13-5-24.5-12T307-235l-119 50L78-375l103-78q-1-7-1-13.5v-27q0-6.5 1-13.5L78-585l110-190 119 50q11-8 23-15t24-12l16-128h220l16 128q13 5 24.5 12t22.5 15l119-50 110 190-103 78q1 7 1 13.5v27q0 6.5-2 13.5l103 78-110 190-118-50q-11 8-23 15t-24 12L590-80H370Zm70-80h79l14-106q31-8 57.5-23.5T639-327l99 41 39-68-86-65q5-14 7-29.5t2-31.5q0-16-2-31.5t-7-29.5l86-65-39-68-99 42q-22-23-48.5-38.5T533-694l-13-106h-79l-14 106q-31 8-57.5 23.5T321-633l-99-41-39 68 86 64q-5 15-7 30t-2 32q0 16 2 31t7 30l-86 65 39 68 99-42q22 23 48.5 38.5T427-266l13 106Zm42-180q58 0 99-41t41-99q0-58-41-99t-99-41q-59 0-99.5 41T342-480q0 58 40.5 99t99.5 41Zm-2-140Z"/></svg>
                </div>

                <div class="settings_menu">
                    <div class="menu-header">
                        <div class="menu-title-wrapper">
                            <p class="text menu-title">Settings</p>
                            <span id="script-version" class="badge-version">VERSION 1.0.0</span>
                        </div>
                        <svg id="close-settings" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>
                    </div>

                    <div id="btn-apikeyconfig" class="settings-item">
                        <div class="settings-item-col">
                            <span class="text settings-item-title">Api Key</span>
                            <span class="subtext">Enter your API key</span>
                        </div>
                    </div>

                    <div id="dark-mode" class="settings-item">
                        <div class="settings-item-col">
                            <span class="text settings-item-title">Dark Mode</span>
                            <span class="subtext">Force the dark theme.</span>
                        </div>
                        <label class="switch" style="opacity: 1;">
                            <input type="checkbox">
                            <span class="slider"></span>
                        </label>
                    </div>

                    <div class="settings-item">
                        <div class="settings-item-col">
                            <span class="text settings-item-title">Answer Color</span>
                            <span class="subtext">Choose a custom color.</span>
                        </div>
                        <input id="color-picker" class="color-picker-input" type="color" value="#4579f2">
                    </div>

                    <div id="btn-terms" class="card-track btn-outline">
                        <span class="text">Terms & Conditions</span>
                    </div>
                </div>

                <div class="terms_menu">
                    <div class="menu-header">
                        <p class="text menu-title">Terms & Conditions</p>
                        <svg id="close-terms" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>
                    </div>
                    <div class="terms-content">
                        <p><strong>1. Educational Use:</strong> This script is a proof of concept for research purposes only.</p>
                        <p><strong>2. No Warranty:</strong> It is provided "as is", without any warranty of any kind.</p>
                        <p><strong>3. Privacy:</strong> No user information is stored or transmitted to external servers. Everything works entirely locally.</p>
                        <p><strong>4. Liability:</strong> The user assumes all risks associated with the use of this script.</p>
                    </div>
                </div>

                <div class="apikey_menu">
                    <div class="menu-header">
                        <p class="text menu-title">API Key</p>
                        <svg id="close-apikey" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>
                    </div>
                    <div class="apikey-content" style="width: 100%; box-sizing: border-box; overflow-y: auto; max-height: 400px; padding-right: 5px;">
                        <div class="settings-item" style="margin-bottom: 10px;">
                            <div class="settings-item-col">
                                <span class="text settings-item-title" style="color: var(--secondary-color) !important;">Enable AI</span>
                                <span class="subtext">Turn AI assistance on/off. Note: AI can make mistakes.</span>
                            </div>
                            <label class="switch" style="opacity: 1;">
                                <input type="checkbox" id="toggle-ai-checkbox">
                                <span class="slider"></span>
                            </label>
                        </div>
                        <div class="settings-item" style="flex-direction: column; align-items: flex-start; gap: 10px; margin-bottom: 10px;">
                            <div class="settings-item-col" style="width: 100%;">
                                <span class="text settings-item-title" style="color: var(--secondary-color) !important;">API Provider</span>
                                <span class="subtext">Select your AI provider</span>
                            </div>
                            <select id="api-provider-select" style="width: 100%; padding: 8px; border-radius: 5px; border: 1px solid rgba(150, 150, 150, 0.2); background: transparent; color: var(--secondary-color); box-sizing: border-box; outline: none;">
                                <option value="gemini" style="color: #000;">Gemini (Google)</option>
                            </select>
                        </div>

                        <div class="settings-item" style="flex-direction: column; align-items: flex-start; gap: 10px; margin-bottom: 10px;">
                            <div class="settings-item-col">
                                <span class="text settings-item-title" style="color: var(--secondary-color) !important;">Api Key</span>
                                <span class="subtext">Enter your API key below:</span>
                                <span class="subtext">100% client-side storage. Your key is never shared or uploaded.</span>
                            </div>
                            <input type="text" id="apikey-input" placeholder="Your API Key" style="width: 100%; padding: 8px; border-radius: 5px; border: 1px solid rgba(150, 150, 150, 0.2); background: transparent; color: var(--secondary-color); box-sizing: border-box; outline: none;">
                        </div>

                        <div class="settings-item" style="flex-direction: row; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 15px;">
                            <button id="test-api-btn" style="padding: 8px 15px; border-radius: 5px; border: 1px solid var(--secondary-color); background: transparent; color: var(--secondary-color); cursor: pointer; font-weight: bold; transition: 0.2s;">
                                Test API
                            </button>
                            <div id="api-status" style="display: flex; align-items: center; gap: 5px;">
                                <div style="width: 10px; height: 10px; border-radius: 50%; background-color: gray;" id="api-status-dot"></div>
                                <span class="subtext" id="api-status-text" style="color: var(--secondary-color) !important;">Not tested</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="answers_menu">
                    <div class="menu-header">
                        <p class="text menu-title">Answers</p>
                        <svg id="close-answers" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>
                    </div>
                    <div style="margin-bottom: 10px; width: 100%;">
                        <input
                            type="text"
                            id="search-input"
                            placeholder="Buscar pregunta o respuesta..."
                            style="width: 100%; padding: 6px 10px; box-sizing: border-box; border: 1px solid #444; border-radius: 4px; background: var(--main-color); color: var(--secondary-color); font-size: 13px;"
                        />
                    </div>

                    <div class="answers-content" id="answers-list" style="width: 100%; box-sizing: border-box; overflow-y: auto; max-height: 400px; scrollbar-width: none; aspect-ratio: 1 / 2;">
                        <p class="subtext" style="text-align: center; ">No answers found yet.</p>
                    </div>
                </div>

                <div class="main_back">
                    <div class="cardBa">
                        <div class="loader-container">
                            <div class="loader-shadow"></div>
                            <div class="loader-box-wrap">
                                <div class="loader-box">
                                    <svg class="menu" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Z"/></svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            `;

            const searchInput = shadow.querySelector('#search-input');
            const answersList = shadow.querySelector('#answers-list');

            if (searchInput && answersList) {
                searchInput.addEventListener('input', (e) => {
                    const searchTerm = e.target.value.toLowerCase().trim();
                    const items = answersList.querySelectorAll('.answer-item');

                    items.forEach(item => {
                        const textContent = item.textContent.toLowerCase();

                        if (textContent.includes(searchTerm)) {
                            item.style.display = 'block';
                        } else {
                            item.style.display = 'none';
                        }
                    });
                });
            }

            const configBtn = shadow.querySelector('#config');
            const closeSettings = shadow.querySelector('#close-settings');
            const settingsMenu = shadow.querySelector('.settings_menu');
            const cards = shadow.querySelectorAll('.card, .card-track');
            const colorPicker = shadow.querySelector('#color-picker');
            const termsBtn = shadow.querySelector('#btn-terms');
            const closeTerms = shadow.querySelector('#close-terms');
            const termsMenu = shadow.querySelector('.terms_menu');
            const apikeyBtn = shadow.querySelector('#btn-apikey');
            const apikeyBtnconfig = shadow.querySelector('#btn-apikeyconfig');
            const closeApikey = shadow.querySelector('#close-apikey');
            const apikeyMenu = shadow.querySelector('.apikey_menu');
            const btnAnswers = shadow.querySelector('#btn-answers');
            const closeAnswers = shadow.querySelector('#close-answers');
            const answersMenu = shadow.querySelector('.answers_menu');
            const toggleMenu = (open) => settingsMenu?.classList.toggle('open', open);
            const toggleTerms = (open) => termsMenu?.classList.toggle('open', open);
            const toggleApikey = (open) => apikeyMenu?.classList.toggle('open', open);
            const toggleAnswers = (open) => answersMenu?.classList.toggle('open', open);

            let isDragging = false;
            let startX, startY;
            const dragTarget = typeof shadow !== 'undefined' && shadow.host ? shadow.host : shadow.querySelector('.main');

            if (dragTarget && (!dragTarget.style.position || dragTarget.classList.contains('main'))) {
                dragTarget.style.position = 'fixed';
                dragTarget.style.bottom = '10px';
                dragTarget.style.right = '10px';
                dragTarget.style.zIndex = '99999';
            }

            let initialRight, initialBottom;

            dragTarget?.addEventListener('mousedown', (e) => {
                if (e.target.closest('.settings_menu, .terms_menu, .apikey_menu, input, label, a')) return;

                startX = e.clientX;
                startY = e.clientY;

                const computed = window.getComputedStyle(dragTarget);
                initialRight = parseInt(computed.right) || 0;
                initialBottom = parseInt(computed.bottom) || 0;

                function onMouseMove(moveEvent) {
                    const dx = startX - moveEvent.clientX;
                    const dy = startY - moveEvent.clientY;

                    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                        isDragging = true;
                        dragTarget.style.right = (initialRight + dx) + 'px';
                        dragTarget.style.bottom = (initialBottom + dy) + 'px';
                        dragTarget.style.cursor = 'grabbing';
                    }
                }

                function onMouseUp() {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    dragTarget.style.cursor = '';
                    setTimeout(() => { isDragging = false; }, 50);
                }

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });

            dragTarget?.addEventListener('click', (e) => {
                if (isDragging) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }, true);

            configBtn?.addEventListener('click', () => {
                toggleTerms(false);
                toggleApikey(false);
                toggleAnswers(false);
                toggleMenu(true);
            });
            closeSettings?.addEventListener('click', () => toggleMenu(false));
            settingsMenu?.addEventListener('mouseleave', () => toggleMenu(false));
            termsBtn?.addEventListener('click', () => {
                toggleMenu(false);
                toggleApikey(false);
                toggleAnswers(false);
                toggleTerms(true);
            });
            closeTerms?.addEventListener('click', () => toggleTerms(false));
            termsMenu?.addEventListener('mouseleave', () => toggleTerms(false));

            apikeyBtn?.addEventListener('click', () => {
                toggleMenu(false);
                toggleTerms(false);
                toggleAnswers(false);
                toggleApikey(true);
            });
            apikeyBtnconfig?.addEventListener('click', () => {
                toggleMenu(false);
                toggleTerms(false);
                toggleAnswers(false);
                toggleApikey(true);
            });
            closeApikey?.addEventListener('click', () => toggleApikey(false));
            apikeyMenu?.addEventListener('mouseleave', () => toggleApikey(false));
            btnAnswers?.addEventListener('click', () => {
                toggleMenu(false);
                toggleTerms(false);
                toggleApikey(false);
                toggleAnswers(true);
            });
            closeAnswers?.addEventListener('click', () => toggleAnswers(false));
            answersMenu?.addEventListener('mouseleave', () => toggleAnswers(false));

            function UpdateAnsColor() {
                html.style.setProperty('--color-picked-user', `${colorPicker.value}`);
                localStorage.setItem("ansColor", colorPicker.value);
            }

            const ansColorSaved = localStorage.getItem("ansColor") || '#4579f2';
            colorPicker.value = ansColorSaved;
            UpdateAnsColor();
            colorPicker.oninput = UpdateAnsColor;

            const main = shadow.querySelector('.main');
            const menuIcon = shadow.querySelector('.menu');
            const toggleAns = shadow.querySelector('#toggleAns input[type="checkbox"]');
            const toggleAnsSub = shadow.querySelector('.subtle-answer-text');
            const toggleAnsDark = shadow.querySelector('#dark-mode input[type="checkbox"]');

            function verifyBackgroundColor() {
                const colorBackground = window.getComputedStyle(document.querySelector('.test-theme-waiting')).backgroundColor
                const rgb = colorBackground.match(/\d+/g);

                if (rgb && rgb.length >= 3) {
                    const r = parseInt(rgb[0]), g = parseInt(rgb[1]), b = parseInt(rgb[2]);
                    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
                    return brightness;
                } else {
                    console.log("Could not determine the background color.");
                }
            }

            function setTheme(isDark) {
                const props = isDark
                    ? ['#292929', '#ffffff']
                    : ['#ffffff', '#292929'];

                main.style.setProperty('--main-color', props[0]);
                main.style.setProperty('--secondary-color', props[1]);
                toggleAnsDark.checked = isDark
                const brightness = verifyBackgroundColor();
                if(brightness < 128) {
                    main.style.setProperty('--icon-color', '#ffffff');
                } else {
                    main.style.setProperty('--icon-color', '#292929');
                }
            }

            function verifyColorMode() {
                    const brightness = verifyBackgroundColor();
                    setTheme(brightness < 128);
            }

            function initThemeObserver() {
                const el = document.querySelector('.test-theme-waiting');
                if (el) return attachDirect(el);

                const finder = new MutationObserver((_, obs) => {
                    const target = document.querySelector('.test-theme-waiting');
                    if (target) {
                        obs.disconnect();
                        attachDirect(target);
                    }
                });

                finder.observe(document.body, { childList: true, subtree: true });
            }

            function attachDirect(target) {
                verifyColorMode();
                new MutationObserver(() => verifyColorMode()).observe(target, {
                    attributes: true,
                    attributeFilter: ['style', 'class']
                });
            }

            initThemeObserver();

            cards.forEach((card) => {
                card.addEventListener('mousemove', (e) => {
                    const rect = card.getBoundingClientRect();
                    const cardCenterX = rect.left + rect.width / 2;
                    const cardCenterY = rect.top + rect.height / 2;

                    const deltaX = e.clientX - cardCenterX;
                    const deltaY = e.clientY - cardCenterY;

                    const strength = 0.35;
                    const moveX = deltaX * strength;
                    const moveY = deltaY * strength;

                    card.style.transform = `translate(${moveX}px, ${moveY}px)`;
                });

                card.addEventListener('mouseleave', () => {
                    card.style.transform = '';
                });
            });

            const testApiBtn = shadow.querySelector('#test-api-btn');
            const apiStatusDot = shadow.querySelector('#api-status-dot');
            const apiStatusText = shadow.querySelector('#api-status-text');
            const mainStatusDot = shadow.querySelector('#main-ai-indicator');
            const apiProvider = shadow.querySelector('#api-provider-select');
            const apiKey = shadow.querySelector('#apikey-input');
            const toggleAiCheckbox = shadow.querySelector('#toggle-ai-checkbox');

            apiProvider.value = GM_getValue("apiProvider", "gemini");

            function changeProvider() {
                const selectedProvider = apiProvider?.value;
                apiStatusDot.style.backgroundColor = 'gray';
                mainStatusDot.style.backgroundColor = 'gray';
                apiStatusText.textContent = 'Not tested';
                switch (selectedProvider) {
                    case "gemini":
                        apiKey.value = GM_getValue("apiKeyGemini", "");
                        break;
                    case "gpt":
                        apiKey.value = GM_getValue("apiKeyGpt", "");
                        break;
                    default:
                        apiKey.value = "";
                        break;
                }
                GM_setValue("apiProvider", selectedProvider)
                API_KEY = apiKey.value;
            }

            function updateApiKey() {
                API_KEY = apiKey.value.trim();
            }

            apiProvider?.addEventListener('change', changeProvider);
            apiKey?.addEventListener('input', updateApiKey);
            changeProvider()

            async function testApi(){
                testApiBtn.textContent = 'Testing...';
                apiStatusDot.style.backgroundColor = 'orange';
                apiStatusText.textContent = 'Connecting...';
                const provider = apiProvider.value;
                OK = false;

                try {
                    if (provider === "gemini") {
                        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
                        if (res.ok) {
                            console.log("Gemini API is available.");
                            OK = true;
                            GM_setValue("apiKeyGemini", API_KEY);
                        } else {
                            console.warn("Gemini API returned an error status:", res.status);
                        }

                    } else if (provider === "gpt") {
                        const res = await fetch('https://api.openai.com/v1/models', {
                            method: 'GET',
                            headers: {
                                'Authorization': `Bearer ${API_KEY}`
                            }
                        });
                        if (res.ok) {
                            console.log("OpenAI API is available.");
                            OK = true;
                            GM_setValue("apiKeyGpt", API_KEY);
                        } else {
                            console.warn("OpenAI API returned an error status:", res.status);
                        }
                    }
                } catch (err) {
                    console.error("No response received from server:", err);
                    OK = false;
                } finally {
                    testApiBtn.textContent = 'Test API';
                    testApiBtn.disabled = false;

                    if (OK) {
                        apiStatusDot.style.backgroundColor = 'green';
                        if (typeof mainStatusDot !== 'undefined') mainStatusDot.style.backgroundColor = 'green';
                        apiStatusText.textContent = 'Connected';
                    } else {
                        apiStatusDot.style.backgroundColor = 'red';
                        if (typeof mainStatusDot !== 'undefined') mainStatusDot.style.backgroundColor = 'red';
                        apiStatusText.textContent = 'Failed';
                    }
                }
            }

            testApiBtn?.addEventListener('click', testApi);

            function toggleAiState() {
                if (!toggleAiCheckbox || !mainStatusDot) return;
                const isEnabled = toggleAiCheckbox.checked;
                GM_setValue("aiAssistance", isEnabled);
                if (isEnabled && apiKey.value) {
                    testApi();
                } else {
                    apiStatusDot.style.backgroundColor = 'gray';
                    mainStatusDot.style.backgroundColor = 'gray';
                    apiStatusText.textContent = 'Disabled';
                }
            }

            toggleAiCheckbox?.addEventListener('change', toggleAiState);
            const aiEnabledSaved = GM_getValue("aiAssistance", false);
            if (toggleAiCheckbox) toggleAiCheckbox.checked = aiEnabledSaved;
            toggleAiState();

            function toggleAnswersEn() {
                const checkmark = document.querySelector('.ans-check');
                const subtle = document.querySelector('.subtle-answer-text');
                if (toggleAns.checked) {
                    html.style.setProperty('--color-cheat', 'var(--color-picked-user)');
                    if(checkmark){
                        checkmark.style.setProperty('opacity', 1);
                    }
                    if(subtle){
                        subtle.style.setProperty('opacity', 1);
                        subtle.style.setProperty('display', 'block');
                    }
                } else {
                    html.style.setProperty('--color-cheat', 'currentColor');
                    if(checkmark){
                        checkmark.style.setProperty('opacity', 0);
                    }
                    if(subtle){
                        subtle.style.setProperty('display', 'none');
                    }
                }
                GM_setValue("ansEnabled", toggleAns.checked);
            };

            function changeColorMode() {
                setTheme(toggleAnsDark.checked);
                GM_setValue("darkMode", toggleAnsDark.checked);
            };

            toggleAns.addEventListener('change', toggleAnswersEn);
            const ansEnabled = GM_getValue("ansEnabled");
            toggleAns.checked = ansEnabled;

            toggleAnsDark.addEventListener('change', changeColorMode);
            const darkModeSaved = GM_getValue("darkMode");
            toggleAnsDark.checked = darkModeSaved;
            toggleAnswersEn();
            //changeColorMode();

            const versionBadge = shadow.querySelector('#script-version');
            if (versionBadge && typeof GM_info !== 'undefined') {
                versionBadge.textContent = "VERSION " + GM_info.script.version;
            }

        } catch (e) {
            showNotification("Error injecting the shadow DOM", "#af4c4c");
            console.error("Error injecting the shadow DOM:", e);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', toLoad);
    } else {
        toLoad();
    }

    const testApiBtn = shadow.querySelector('#test-api-btn');
    const apiStatusDot = shadow.querySelector('#api-status-dot');
    const apiStatusText = shadow.querySelector('#api-status-text');
    const mainStatusDot = shadow.querySelector('#main-ai-indicator');

    async function testApi(){
        testApiBtn.textContent = 'Testing...';
        apiStatusDot.style.backgroundColor = 'orange';
        apiStatusText.textContent = 'Connecting...';
        const provider = apiProvider.value;
        OK = false;

        try {
            if (provider === "gemini") {
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
                if (res.ok) {
                    console.log("Gemini API is available.");
                    OK = true;
                    GM_setValue("apiKeyGemini", API_KEY);
                } else {
                    console.warn("Gemini API returned an error status:", res.status);
                }

            } else if (provider === "gpt") {
                const res = await fetch('https://api.openai.com/v1/models', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${API_KEY}`
                    }
                });
                if (res.ok) {
                    console.log("OpenAI API is available.");
                    OK = true;
                    GM_setValue("apiKeyGpt", API_KEY);
                } else {
                    console.warn("OpenAI API returned an error status:", res.status);
                }
            }
        } catch (err) {
            console.error("No response received from server:", err);
            OK = false;
        } finally {
            testApiBtn.textContent = 'Test API';
            testApiBtn.disabled = false;

            if (OK) {
                apiStatusDot.style.backgroundColor = 'green';
                if (typeof mainStatusDot !== 'undefined') mainStatusDot.style.backgroundColor = 'green';
                apiStatusText.textContent = 'Connected';
            } else {
                apiStatusDot.style.backgroundColor = 'red';
                if (typeof mainStatusDot !== 'undefined') mainStatusDot.style.backgroundColor = 'red';
                apiStatusText.textContent = 'Failed';
            }
        }
    }

    const SHIELD_PATHS = {
        true: "m438-338 226-226-57-57-169 169-84-84-57 57 141 141Zm42 258q-139-35-229.5-159.5T160-516v-244l320-120 320 120v244q0 152-90.5 276.5T480-80Zm0-84q104-33 172-132t68-220v-189l-240-90-240 90v189q0 121 68 220t172 132Zm0-316Z",
        false: "M508.5-331.5Q520-343 520-360t-11.5-28.5Q497-400 480-400t-28.5 11.5Q440-377 440-360t11.5 28.5Q463-320 480-320t28.5-11.5ZM440-480h80v-200h-80v200Zm40 400q-139-35-229.5-159.5T160-516v-244l320-120 320 120v244q0 152-90.5 276.5T480-80Zm0-84q104-33 172-132t68-220v-189l-240-90-240 90v189q0 121 68 220t172 132Zm0-316Z"
    };

    function updateAntiCheatUI(isActive) {
        const card = (typeof shadow !== 'undefined' ? shadow : document).querySelector('#card-anticheat');
        if (!card) return;
        const svg = card.querySelector('.shield');
        const path = card.querySelector('.shield path');
        const statusText = card.querySelector('#anticheat-status-display');
        if (isActive) {
            svg.style.setProperty('fill', '#39be44');
            path.setAttribute('d', SHIELD_PATHS.true);
            if (statusText) {
                statusText.textContent = 'Safe';
                statusText.style.color = '#39be44';
            }
        } else {
            svg.style.setProperty('fill', '#e53935');
            path.setAttribute('d', SHIELD_PATHS.false);
            if (statusText) {
                statusText.textContent = 'Not protected';
                statusText.style.color = '#e53935';
            }
        }
    }

    function fetchQuizData(quizId) {
        const cleanRoomId = quizId.toString().trim();

        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://wayground.com/_gameapi/main/public/v1/students/games/${cleanRoomId}`,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0'
                },
                onload: function (response) {
                    try {
                        const data = JSON.parse(response.responseText);
                        const firstKey = Object.keys(data?.data?.quizzes || {})[0];

                        if (!firstKey) {
                            console.error("No quiz was found in the response.");
                            reject("No quiz found in the response");
                            return;
                        }

                        QUIZ_DATA = data.data.quizzes[firstKey];
                        resolve(QUIZ_DATA);

                    } catch (e) {
                        showNotification("Error processing quiz API data", "#af4c4c");
                        console.error('Error processing quiz API data:', e);
                        reject(e);
                    }
                },
                onerror: function (err) {
                    showNotification("GM_xmlhttpRequest failed", "#af4c4c");
                    console.error("GM_xmlhttpRequest failed", err);
                    reject(err);
                }
            });
        });
    }

    const apiProvider = shadow.querySelector('#api-provider-select').value;
    const toggleAiCheckbox = shadow.querySelector('#toggle-ai-checkbox');
    const quizName = shadow.querySelector('#quiz-name-display');
    const ansListMenu = shadow.querySelector('#answers-list');
    const quizStatusMenu = shadow.querySelector('#quiz-status-display');
    const toggleAns = shadow.querySelector('#toggleAns input[type="checkbox"]');

    async function startQuizSolver(data) {
        try {
            updateAntiCheatUI(ANTI_CHEAT)
            quizName.innerText = QUIZ_NAME;

            await fetchQuizData(data.hash || ROOM_DATA.hash);

            CLEANED_QUESTIONS = cleanQuizData(data.questions || ROOM_DATA.questions);
            const hash = await generateQuizHash(CLEANED_QUESTIONS)
            const quizId = QUIZ_DATA.id
            const quizStorage = GM_getValue(`${quizId}`, null)
            const quizHashStorage = quizStorage ? quizStorage.hash : null

            if (toggleAiCheckbox.checked && !OK) {
                await testApi();
            }

            if(quizStorage != null && hash === quizHashStorage){
                AI_DATA = quizStorage.answers
                if(TYPE_QUIZ === 'test'){
                    highlightCorrectAnswersAiTest(AI_DATA, CLEANED_QUESTIONS)
                } else {
                    highlightCorrectAnswersAI(AI_DATA, CLEANED_QUESTIONS);
                }
                const finalOutput = await formatQuizResults(AI_DATA, data.questions);
                const htmlList = Object.entries(finalOutput)
                .map(([question, answer]) => `
                    <div class="answer-item" style="margin-bottom: 12px; padding: 8px; border-bottom: 1px solid #eee;">
                        <p class="text">${question}</p>
                        <p class="subtextT">${answer}</p>
                    </div>
                `)

                .join('');
                quizStatusMenu.innerText = 'Answers available'
                quizStatusMenu.style.color = 'green'
                ansListMenu.innerHTML = htmlList || '<p>No answers available.</p>';
                showNotification("Answers retrieved from previous quiz attempt");
            } else if(toggleAiCheckbox.checked && OK){
                const aiAnswers = await processQuizAi(CLEANED_QUESTIONS);
                const finalOutput = await formatQuizResults(aiAnswers, data.questions);
                const htmlList = Object.entries(finalOutput)
                .map(([question, answer]) => `
                    <div class="answer-item" style="margin-bottom: 12px; padding: 8px; border-bottom: 1px solid #eee;">
                        <p class="text">${question}</p>
                        <p class="subtextT">${answer}</p>
                    </div>
                `)

                .join('');
                quizStatusMenu.innerText = 'Answers available'
                quizStatusMenu.style.color = 'green'
                ansListMenu.innerHTML = htmlList || '<p>No answers available.</p>';
                showNotification("Answers retrieved successfully");
                //console.log(JSON.stringify(finalOutput, null, 2));
            } else {
                quizStatusMenu.innerText = 'Error retrieving answers'
                quizStatusMenu.style.color = 'red'
                showNotification("Enable and test AI first to get answers", "#FFA500");
                console.warn("Enable and test AI first");
            }
        } catch (error) {
            showNotification("Error injecting the shadow DOM", "#af4c4c");
            console.error("Error in the quiz flow:", error);
        }
    }

    toggleAiCheckbox.addEventListener('change', () => startQuizSolver(ROOM_DATA));

    async function processQuizAi(cleanedQuestionsJson) {
        if (!QUIZ_DATA || !QUIZ_DATA.id) {
            console.error("QUIZ_DATA has not been loaded yet.");
            return;
        }

        const hash = await generateQuizHash(cleanedQuestionsJson)
        const quizId = QUIZ_DATA.id
        const quizStorage = GM_getValue(`${quizId}`, null)
        const quizHashStorage = quizStorage ? quizStorage.hash : null
        try {
            if (!apiProvider){
                console.error("No API provider selected.");
                return;
            };
            if (apiProvider === "gemini") {
                showNotification("Loading answers...", "#FFA500");
                const answers = await solveQuizWithGemini(cleanedQuestionsJson);
                AI_DATA = answers;
                if (TYPE_QUIZ === 'test') {
                    highlightCorrectAnswersAiTest(AI_DATA, cleanedQuestionsJson);
                }else {
                    highlightCorrectAnswersAI(AI_DATA, cleanedQuestionsJson);
                }
                GM_setValue(`${QUIZ_DATA.id}`, {"hash": hash, answers});
                return AI_DATA;
            } else if (apiProvider === "gpt") {
                const answers = await solveQuizWithGPT(cleanedQuestionsJson);
                AI_DATA = answers
                highlightCorrectAnswersAI(AI_DATA, cleanedQuestionsJson);
                GM_setValue(`${QUIZ_DATA.id}`, {"hash": hash, answers});
                return AI_DATA;
            }
        } catch (err) {
            showNotification("No response received from server.", "#af4c4c");
            console.error("No response received from server:", err);
        }

    }

    function cleanQuizData(rawJson) {
        const cleanedQuestionsJson = {};

        if (!rawJson || typeof rawJson !== 'object') return cleanedQuestionsJson;

        const stripAndDecodeHTML = (htmlString = '') => {
            if (!htmlString) return '';
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlString;
            return (tempDiv.textContent || tempDiv.innerText || '').trim();
        };

        try {
            for (const [qId, qData] of Object.entries(rawJson)) {
                const structure = qData?.structure || {};
                const questionType = qData?.type || structure?.kind || 'MCQ';
                const queryRaw = structure?.query?.text || '';

                const targetSettings = structure?.targets?.[0]?.settings;
                const answerLength = targetSettings?.answerLength ||
                      structure?.settings?.questionMetadata?.answerLength || 0;

                const rawOptions = structure?.options || [];
                const options = rawOptions.map(opt => ({
                    id: opt.id || opt._id,
                    text: stripAndDecodeHTML(opt.text || '')
                }));

                const itemData = {
                    type: questionType,
                    question: stripAndDecodeHTML(queryRaw),
                    options: options
                };

                if (answerLength > 0) {
                    itemData.answerLength = answerLength;
                }

                cleanedQuestionsJson[qId] = itemData;
            }
        } catch (e) {
            console.error("Error cleaning the questions JSON:", e);
        }

        return cleanedQuestionsJson;
    }

    function waitForQuestionElement(selector, attribute = null, timeoutMs = 4000) {
        return new Promise((resolve) => {
            const check = () => {
                const el = document.querySelector(selector);
                if (el && (!attribute || el.getAttribute(attribute))) {
                    return el;
                }
                return null;
            };

            const existing = check();
            if (existing) return resolve(existing);

            let timer = null;
            const observer = new MutationObserver(() => {
                const el = check();
                if (el) {
                    if (timer) clearTimeout(timer);
                    observer.disconnect();
                    resolve(el);
                }
            });

            timer = setTimeout(() => {
                observer.disconnect();
                resolve(null);
            }, timeoutMs);

            observer.observe(document.body, { childList: true, subtree: true });
        });
    }

    function waitForElement(selector, timeout = 5000) {
        return new Promise((resolve) => {
            const el = document.querySelector(selector);
            if (el) return resolve(el);

            const startTime = Date.now();
            const interval = setInterval(() => {
                const element = document.querySelector(selector);
                if (element) {
                    clearInterval(interval);
                    resolve(element);
                } else if (Date.now() - startTime > timeout) {
                    clearInterval(interval);
                    resolve(null);
                }
            }, 100);
        });
    }

    async function getCurrentQuestionId(cleanedQuestionsJson) {
        const quesIdEl = document.querySelector('[data-quesid]');
        if (quesIdEl && quesIdEl.getAttribute('data-quesid')) {
            return quesIdEl.getAttribute('data-quesid');
        }

        const questionTextEl = document.querySelector('#questionText .content-slot') ||
              document.querySelector('[data-testid="question-container-text"]');

        if (questionTextEl) {
            const domQuestionText = questionTextEl.textContent.trim();

            for (const [qId, qData] of Object.entries(cleanedQuestionsJson)) {
                if (qData.question && qData.question.includes(domQuestionText) || domQuestionText.includes(qData.question)) {
                    return qId;
                }
            }
        }

        return null;
    }

    function formatQuizResults(answersMap, questionsObject) {
        const formattedResults = {};
        const safeAnswersMap = answersMap?.answers || answersMap || {};
        const safeQuestionsObj = questionsObject || {};

        const cleanText = (html) => {
            if (!html) return "";
            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = html;
            return (tempDiv.textContent || tempDiv.innerText || "").replace(/<[^>]*>/g, "").trim();
        };

        Object.keys(safeQuestionsObj).forEach((qId) => {
            const qData = safeQuestionsObj[qId];

            const rawQuestion = qData?.question || qData?.structure?.query?.text || "";
            const questionText = cleanText(rawQuestion);

            if (!questionText) return;

            const aiAnswer = safeAnswersMap[qId];

            const rawOptions = qData?.options || qData?.structure?.options || [];
            const options = rawOptions.map(opt => ({
                id: opt.id || opt._id,
                text: cleanText(opt.text || "")
            }));

            let answerText = "Answer not founded";

            if (aiAnswer !== undefined && aiAnswer !== null) {
                if (Array.isArray(aiAnswer)) {
                    const matchedTexts = options
                    .filter(opt => aiAnswer.includes(opt.id))
                    .map(opt => opt.text);

                    answerText = matchedTexts.length > 0 ? matchedTexts.join(" | ") : "Answer not founded";
                }
                else if (options.length > 0 && options.some(opt => opt.id === aiAnswer)) {
                    const selectedOption = options.find(opt => opt.id === aiAnswer);
                    answerText = selectedOption ? selectedOption.text : aiAnswer;
                }
                else {
                    answerText = typeof aiAnswer === "string" ? cleanText(aiAnswer) : String(aiAnswer);
                }
            }

            formattedResults[questionText] = answerText;
        });

        return formattedResults;
    }

    let savedQuestions = null;

    async function highlightCorrectAnswersAiTest(aiData, cleanedQuestionsJson) {
        try {
            if (!aiData || !cleanedQuestionsJson) return;

            const quizResults = await formatQuizResults(aiData, cleanedQuestionsJson);
            const element = await waitForElement('[data-testid="read-aloud-container"]');
            const rawElement = await waitForElement('[data-highlight-block="stem"]');
            const questionElement = rawElement?.length ? rawElement[0] : rawElement;

            if (!questionElement) return;

            const normalize = (str) => (str || '')
            .replace(/[\u200B-\u200D\uFEFF]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

            const currentQuestionText = questionElement.textContent.trim();
            const cleanCurrentText = normalize(currentQuestionText);

            const matchedKey = Object.keys(quizResults).find(
                (key) => normalize(key) === cleanCurrentText
            );

            const expectedAnswerText = matchedKey ? quizResults[matchedKey] : undefined;
            if (!expectedAnswerText) return;

            const currentQuestionEntry = Object.entries(cleanedQuestionsJson).find(
                ([id, item]) => normalize(item.question) === cleanCurrentText
            );

            if (!currentQuestionEntry) return;

            const [currentQuestionId, currentQuestionData] = currentQuestionEntry;
            const questionType = currentQuestionData.type || 'MCQ';
            if (questionType === 'BLANK') {
                const container = element.querySelector('[data-testid="text-renderer"]');

                if (container && !container.querySelector('.subtle-answer-text')) {
                    const formattedAnswer = Array.isArray(expectedAnswerText) ? expectedAnswerText.join(' | ') : expectedAnswerText;

                    const answerDiv = document.createElement('div');
                    answerDiv.className = 'subtle-answer-text';
                    answerDiv.textContent = `Possible answer: ${formattedAnswer}`;
                    answerDiv.style.cssText = `
                    margin-top: 12px;
                    font-weight: bold;
                    color: var(--color-picked-user, #39be44);
                    pointer-events: none;
                    font-size: 14px;
                    opacity: ${typeof toggleAns !== 'undefined' && toggleAns?.checked ? '1' : '0'};
                `;
                    container.appendChild(answerDiv);
                }
                return;
            } else if (questionType === 'OPEN' || !currentQuestionData.options?.length) {
                const container = element.querySelector('[data-testid="text-renderer"]');

                if (container && !container.querySelector('.subtle-answer-text')) {
                    const formattedAnswer = Array.isArray(expectedAnswerText) ? expectedAnswerText.join(' | ') : expectedAnswerText;

                    const answerDiv = document.createElement('div');
                    answerDiv.className = 'subtle-answer-text';
                    answerDiv.textContent = `Possible answer: ${formattedAnswer}`;
                    answerDiv.style.cssText = `
                    margin-top: 12px;
                    font-weight: bold;
                    color: var(--color-picked-user, #39be44);
                    pointer-events: none;
                    font-size: 14px;
                    opacity: ${typeof toggleAns !== 'undefined' && toggleAns?.checked ? '1' : '0'};
                `;
                    container.appendChild(answerDiv);
                }
                return;
            }


            const rawAnswers = Array.isArray(expectedAnswerText)
            ? expectedAnswerText
            : (typeof expectedAnswerText === 'string' ? expectedAnswerText.split('|') : []);

            const targetAnswersList = rawAnswers.map(ans => normalize(ans));

            const optionButtons = document.querySelectorAll('button[data-testid^="option-trigger-"]');

            optionButtons.forEach((btn) => {
                const optionTextEl = btn.querySelector('[data-highlight-block^="option:"] p') ||
                      btn.querySelector('[data-highlight-block^="option:"]');

                if (!optionTextEl) return;

                const currentOptionText = normalize(optionTextEl.textContent);

                if (targetAnswersList.includes(currentOptionText)) {
                    if (!btn.querySelector('.ans-check')) {
                        const newCheckmark = document.createElement('span');
                        newCheckmark.className = 'ans-check';
                        newCheckmark.innerHTML = '&#10003;';
                        newCheckmark.style.cssText = `
                            position: absolute;
                            color: var(--color-picked-user, #39be44);
                            top: 8px;
                            right: 12px;
                            font-size: 22px;
                            font-weight: bold;
                            pointer-events: none;
                            z-index: 10;
                            opacity: ${typeof toggleAns !== 'undefined' && toggleAns?.checked ? '1' : '0'};
                        `;

                        const targetContainer = btn.querySelector('.rounded-assessment-lg') || btn;
                        if (window.getComputedStyle(targetContainer).position === 'static') {
                            targetContainer.style.position = 'relative';
                        }

                        targetContainer.appendChild(newCheckmark);
                    }
                }
            });

        } catch (e) {
            showNotification("Error processing AI answer", "#af4c4c");
            console.warn("Error processing AI answer:", e);
        }
    }

    async function highlightCorrectAnswersAI(aiData, cleanedQuestionsJson) {
        try {
            if (!aiData || !cleanedQuestionsJson) return;

            const containerReady = await waitForQuestionElement(
                '[data-quesid], [data-testid="question-container"], #questionText',
                null,
                4000
            );

            if (!containerReady) {
                console.warn("No active question container found.");
                return;
            }

            const currentQuestionId = await getCurrentQuestionId(cleanedQuestionsJson);
            if (!currentQuestionId) {
                console.warn("Could not link the on-screen question with the JSON.");
                return;
            }

            const questionData = cleanedQuestionsJson[currentQuestionId];
            const aiAnswer = aiData[currentQuestionId];
            if (!questionData || !aiAnswer) return;

            const questionType = questionData.type || 'MCQ';
            if (questionType === 'BLANK') {
                const container = document.querySelector('.drag-drop-text div');

                if (container && !container.querySelector('.subtle-answer-text')) {
                    const formattedAnswer = Array.isArray(aiAnswer) ? aiAnswer.join(' | ') : aiAnswer;

                    const answerDiv = document.createElement('div');
                    answerDiv.className = 'subtle-answer-text';
                    answerDiv.textContent = `Possible answer: ${formattedAnswer}`;
                    answerDiv.style.cssText = `
                        margin-top: 12px;
                        font-weight: bold;
                        color: var(--color-picked-user, #39be44);
                        pointer-events: none;
                        font-size: 14px;
                        opacity: ${typeof toggleAns !== 'undefined' && toggleAns?.checked ? '1' : '0'};
                    `;
                    container.appendChild(answerDiv);
                }
                return;
            } else if (questionType === 'OPEN' || !questionData.options?.length) {
                const container = document.querySelector('.h-full .flex .flex-col .gap-4');

                if (container && !container.querySelector('.subtle-answer-text')) {
                    const formattedAnswer = Array.isArray(aiAnswer) ? aiAnswer.join(' | ') : aiAnswer;

                    const answerDiv = document.createElement('div');
                    answerDiv.className = 'subtle-answer-text';
                    answerDiv.textContent = `Possible answer: ${formattedAnswer}`;
                    answerDiv.style.cssText = `
                        margin-top: 12px;
                        font-weight: bold;
                        color: var(--color-picked-user, #39be44);
                        pointer-events: none;
                        font-size: 14px;
                        opacity: ${typeof toggleAns !== 'undefined' && toggleAns?.checked ? '1' : '0'};
                    `;
                    container.appendChild(answerDiv);
                }
                return;
            }

            const targetIds = Array.isArray(aiAnswer) ? aiAnswer : [aiAnswer];

            const targetIndices = [];
            questionData.options.forEach((opt, index) => {
                if (targetIds.includes(opt.id) || targetIds.includes(opt._id)) {
                    targetIndices.push(index);
                }
            });

            targetIndices.forEach(index => {
                const correctButton = document.querySelector(`[data-cy="option-${index}"]`) ||
                      document.querySelector(`[data-testid="option-trigger-${index}"]`);

                if (correctButton && !correctButton.querySelector('.ans-check')) {
                    const newCheckmark = document.createElement('span');
                    newCheckmark.className = 'ans-check';
                    newCheckmark.innerHTML = '&#10003;';
                    newCheckmark.style.cssText = `
                        position: absolute;
                        color: var(--color-picked-user, #39be44);
                        top: 8px;
                        left: 12px;
                        font-size: 22px;
                        font-weight: bold;
                        pointer-events: none;
                        z-index: 10;
                        opacity: ${typeof toggleAns !== 'undefined' && toggleAns?.checked ? '1' : '0'};
                    `;

                    const targetContainer = correctButton.querySelector('.rounded-assessment-lg') || correctButton;
                    if (window.getComputedStyle(targetContainer).position === 'static') {
                        targetContainer.style.position = 'relative';
                    }

                    targetContainer.appendChild(newCheckmark);
                }
            });

        } catch (e) {
            showNotification("Error processing AI answer", "#af4c4c");
            console.warn("Error processing AI answer:", e);
        }
    }

    const observer = new MutationObserver(() => {
        try {
            if (savedQuestions) highlightCorrectAnswers();
            if (AI_DATA && (TYPE_QUIZ === 'live' || TYPE_QUIZ === 'mystic_peak' || TYPE_QUIZ === 'team')) highlightCorrectAnswersAI(AI_DATA, CLEANED_QUESTIONS);
            if (AI_DATA && TYPE_QUIZ === 'test') highlightCorrectAnswersAiTest(AI_DATA, CLEANED_QUESTIONS);
        } catch (e) {
            console.error("MutationObserver error:", e);
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    async function solveQuizWithGPT(questionsJsonObject) {
        const url = "https://api.openai.com/v1/chat/completions";

        const systemInstruction = `
            You are an expert quiz-solving assistant.
            You will receive a JSON object containing questions and their respective options.
            For each question, identify the ID of the correct option (_id or id).
            Respond ONLY in JSON format matching the structure {"answers": {"QUESTION_ID": "CORRECT_OPTION_ID"}}.
        `;

        const payload = {
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemInstruction },
                { role: "user", content: JSON.stringify(questionsJsonObject) }
            ],
            response_format: { type: "json_object" },
            temperature: 0.1
        };

        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "POST",
                url: url,
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${API_KEY}`
                },
                data: JSON.stringify(payload),
                onload: function(response) {
                    try {
                        const jsonResponse = JSON.parse(response.responseText);

                        if (jsonResponse.error) {
                            console.error("Error returned by OpenAI API:", jsonResponse.error);
                            showNotification(`Error returned by OpenAI API: ${jsonResponse.error?.message || jsonResponse.error}`, "#af4c4c");
                            reject(`OpenAI Error (${jsonResponse.error.type}): ${jsonResponse.error.message}`);
                            return;
                        }

                        if (!jsonResponse.choices || jsonResponse.choices.length === 0) {
                            showNotification("OpenAI returned no response (empty choices).", "#af4c4c");
                            console.error("Response contains no choices:", jsonResponse);
                            reject("OpenAI returned no response (empty choices).");
                            return;
                        }

                        const choice = jsonResponse.choices[0];
                        if (choice.message && choice.message.content) {
                            const parsedAnswers = JSON.parse(choice.message.content);
                            resolve(parsedAnswers.answers || parsedAnswers);
                        } else {
                            showNotification("Choice format does not contain content.", "#af4c4c");
                            console.error("Unexpected choice structure:", choice);
                            reject("Choice format does not contain content.");
                        }

                    } catch (e) {
                        showNotification("Raw response received from server.", "#af4c4c");
                        console.error("Raw response received from server:", response.responseText);
                        reject("Error parsing response: " + e.message);
                    }
                },
                onerror: function(error) {
                    showNotification("Error in solveQuizWithGPT", "#af4c4c");
                    reject(error);
                }
            });
        });
    }

    async function solveQuizWithGemini(questionsJsonObject) {

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${API_KEY}`;

        const systemInstruction = `
            You are an expert quiz-solving assistant.
            You will receive a JSON object where each question has a "type", "question", "options" array, and optionally "answerLength".

            CRITICAL RULES ACCORDING TO "type":
            1. For "MCQ":
            - Select the SINGLE correct option ID (string).
            2. For "MSQ" (Multiple Select Question):
            - Select ALL correct option IDs and return them as an ARRAY of strings (e.g., ["ID_1", "ID_2"]).
            3. For "BLANK" or "OPEN":
            - Provide a concise text answer in plain text.
            - VERY IMPORTANT: If "answerLength" is provided, your answer MUST be EXACTLY that many characters long (excluding trailing/leading spaces). For instance, for length 11, "Mitocondria" has 11 characters.

            Respond ONLY in JSON format following this exact structure:
            {
            "answers": {
                "QUESTION_ID": "SINGLE_ID_OR_TEXT_OR_ARRAY_OF_IDS"
            }
            }
        `;
        const payload = {
            contents: [{
                parts: [{ text: JSON.stringify(questionsJsonObject) }]
            }],
            systemInstruction: {
                parts: [{ text: systemInstruction }]
            },
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.1
            }
        };

        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "POST",
                url: url,
                headers: {
                    "Content-Type": "application/json"
                },
                data: JSON.stringify(payload),
                onload: function(response) {
                    try {
                        const jsonResponse = JSON.parse(response.responseText);

                        if (jsonResponse.error) {
                            console.error("Error returned by Gemini API:", jsonResponse.error);
                            showNotification(`Gemini API error (${jsonResponse.error.code}): ${jsonResponse.error.message}`, "#af4c4c");
                            reject(`Gemini API error (${jsonResponse.error.code}): ${jsonResponse.error.message}`);
                            return;
                        }

                        if (!jsonResponse.candidates || jsonResponse.candidates.length === 0) {
                            console.error("Response contains no candidates:", jsonResponse);
                            showNotification("Gemini returned no response (empty candidate).", "#af4c4c");
                            reject("Gemini returned no response (empty candidate).");
                            return;
                        }

                        const candidate = jsonResponse.candidates[0];
                        if (candidate.content && candidate.content.parts && candidate.content.parts[0]) {
                            const rawText = candidate.content.parts[0].text;
                            const parsedAnswers = JSON.parse(rawText);
                            resolve(parsedAnswers.answers || parsedAnswers);
                        } else {
                            showNotification("Candidate format does not contain text parts.", "#af4c4c");
                            console.error("Unexpected candidate structure:", candidate);
                            reject("Candidate format does not contain text parts.");
                        }

                    } catch (e) {
                        showNotification("Raw response received from server.", "#af4c4c");
                        console.error("Raw response received from server:", response.responseText);
                        reject("Error parsing response: " + e.message);
                    }
                },
                onerror: function(error) {
                    reject(error);
                }
            });
        });
    }

    try {
        console.log("%cProtection enabled", "color: #ff00ff; font-weight: bold;");
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
                    console.error("Event interception error:", e);
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
                console.error("Fetch interceptor error:", e);
            }
            return originalFetch(...args);
        };
    } catch (e) {
        console.error("Visibility protection error:", e);
    }

    function showNotification(message, color = '#4caf50') {
        let container = document.getElementById('toast-container');

        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            Object.assign(container.style, {
                position: 'fixed',
                top: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px',
                zIndex: '9999',
                pointerEvents: 'none'
            });
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        Object.assign(toast.style, {
            backgroundColor: color,
            color: 'white',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            fontFamily: 'sans-serif',
            pointerEvents: 'auto',
            opacity: '0',
            transform: 'translateY(-10px)',
            transition: 'all 0.3s ease'
        });

        toast.innerText = message;

        container.prepend(toast);

        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        });

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-10px)';

            setTimeout(() => {
                toast.remove();

                if (container.children.length === 0) {
                    container.remove();
                }
            }, 300);
        }, 3000);
    }

    async function generateQuizHash(questionsJsonObject) {
        try {
            if (!questionsJsonObject || typeof questionsJsonObject !== 'object') {
                return null;
            }

            const sortedQuestionIds = Object.keys(questionsJsonObject).sort();
            const idCanonicalString = sortedQuestionIds.join('|');
            const msgUint8 = new TextEncoder().encode(idCanonicalString);
            const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const finalHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            return finalHash;
        } catch (e) {
            showNotification("Error hashing the JSON", "#af4c4c");
            console.warn("Error hashing the JSON:", e);
        }
    }

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
                            console.log("Answers retrieved successfully.");
                            showNotification("Answers retrieved successfully.");
                        }
                    } catch (e) {
                        showNotification("Failed to retrieve answers", "#af4c4c");
                        console.error('Error parsing API answers:', e);
                    }
                },
                onerror: (err) => {
                    showNotification("Failed to retrieve answers", "#af4c4c");
                    console.error("GM_xmlhttpRequest failed", err);
                }
            });
        } catch (e) {
            showNotification("Failed to retrieve answers", "#af4c4c");
            console.error("Could not execute GM_xmlhttpRequest:", e);
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
                                    color: var(--color-picked-user, #39be44);
                                    opacity: ${typeof toggleAns !== 'undefined' && toggleAns?.checked ? '1' : '0'};
                                `;
                                container.appendChild(answer);
                            }
                        }
                    }
                    const answerIndices = Array.isArray(rawAnswer) ? rawAnswer : [rawAnswer];
                    answerIndices.forEach(index => {
                        const correctButton = document.querySelector(`[data-cy="option-${index}"]`);
                        if (correctButton && !correctButton.querySelector('.ans-check')) {
                            const newCheckmark = document.createElement('span');
                            newCheckmark.className = 'ans-check';
                            newCheckmark.innerHTML = '&#10003;';
                            newCheckmark.style.cssText = `
                                position: absolute;
                                color: var(--color-picked-user, #39be44);
                                top: 8px;
                                left: 12px;
                                font-size: 22px;
                                font-weight: bold;
                                pointer-events: none;
                                z-index: 10;
                                opacity: ${typeof toggleAns !== 'undefined' && toggleAns?.checked ? '1' : '0'};
                            `;
                            if (window.getComputedStyle(correctButton).position === 'static') {
                                correctButton.style.position = 'relative';
                            }
                            correctButton.appendChild(newCheckmark);
                        }
                    });
                } else if (questionData?.structure.kind === "OPEN") {
                    console.log("Open question detected: no automatic answer is available.");
                }
            }
        } catch (e) {
            console.warn("Error processing question type:", e);
        }
    }

})();
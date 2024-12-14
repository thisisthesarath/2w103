var sTransferNumber;
var oRingTone, oRingbackTone;
var oSipStack, oSipSessionRegister, oSipSessionCall, oSipSessionTransferCall;
var videoRemote, videoLocal, audioRemote;
var bFullScreen = false;
var oNotifICall;
var bDisableVideo = false;
var viewVideoLocal, viewVideoRemote, viewLocalScreencast; // <video> (webrtc) or <div> (webrtc4all)
var oConfigCall;
var oReadyStateTimer;
var realmm = "ipc.johnsamuel.in";
var pvalue;
var i=0;


window.onload = function () {
    window.console && window.console.info && window.console.info("location=" + window.location);

    videoLocal = document.getElementById("video_local");
    videoRemote = document.getElementById("video_remote");
    audioRemote = document.getElementById("audio_remote");


    document.onkeyup = onKeyUp;
    document.body.onkeyup = onKeyUp;

    var getPVal = function (PName) {
        var query = window.location.search.substring(1);
        var vars = query.split('&');
        for (var i = 0; i < vars.length; i++) {
            var pair = vars[i].split('=');
            if (decodeURIComponent(pair[0]) === PName) {
                return decodeURIComponent(pair[1]);
            }
        }
        return null;
    }

    var preInit = function () {
        var s_webrtc_type = getPVal("wt");
        var s_fps = getPVal("fps");
        var s_mvs = getPVal("mvs"); // maxVideoSize
        var s_mbwu = getPVal("mbwu"); // maxBandwidthUp (kbps)
        var s_mbwd = getPVal("mbwd"); // maxBandwidthUp (kbps)
        var s_za = getPVal("za"); // ZeroArtifacts
        var s_ndb = getPVal("ndb"); // NativeDebug

        if (s_webrtc_type) SIPml.setWebRtcType(s_webrtc_type);

        // initialize SIPML5
        SIPml.init(postInit);

        // set other options after initialization
        if (s_fps) SIPml.setFps(parseFloat(s_fps));
        if (s_mvs) SIPml.setMaxVideoSize(s_mvs);
        if (s_mbwu) SIPml.setMaxBandwidthUp(parseFloat(s_mbwu));
        if (s_mbwd) SIPml.setMaxBandwidthDown(parseFloat(s_mbwd));
        if (s_za) SIPml.setZeroArtifacts(s_za === "true");
        if (s_ndb == "true") SIPml.startNativeDebug();
    }

    console.log(i+1);
    
    oReadyStateTimer = setInterval(function () {
        if (document.readyState === "complete") {
            clearInterval(oReadyStateTimer);
            // initialize SIPML5
            preInit();
        }
    },
    500);
};

function postInit() {
    sipRegister();
    // check for WebRTC support
    if (!SIPml.isWebRtcSupported()) {
        // is it chrome?
        if (SIPml.getNavigatorFriendlyName() == 'chrome') {
            if (confirm("You're using an old Chrome version or WebRTC is not enabled.\nDo you want to see how to enable WebRTC?")) {
                window.location = 'http://www.webrtc.org/running-the-demos';
            }
            else {
                window.location = "index.html";
            }
            return;
        }
        else {
            if (confirm("webrtc-everywhere extension is not installed. Do you want to install it?\nIMPORTANT: You must restart your browser after the installation.")) {
                window.location = 'https://github.com/sarandogou/webrtc-everywhere';
            }
            else {
                // Must do nothing: give the user the chance to accept the extension
                // window.location = "index.html";
            }
        }
    }

    // checks for WebSocket support
    if (!SIPml.isWebSocketSupported()) {
        if (confirm('Your browser don\'t support WebSockets.\nDo you want to download a WebSocket-capable browser?')) {
            window.location = 'https://www.google.com/intl/en/chrome/browser/';
        }
        else {
            window.location = "index.html";
        }
        return;
    }

    // FIXME: displays must be per session
    viewVideoLocal = videoLocal;
    viewVideoRemote = videoRemote;

    if (!SIPml.isWebRtcSupported()) {
        if (confirm('Your browser don\'t support WebRTC.\naudio/video calls will be disabled.\nDo you want to download a WebRTC-capable browser?')) {
            window.location = 'https://www.google.com/intl/en/chrome/browser/';
        }
    }

    // btnRegister.disabled = false;
    document.body.style.cursor = 'default';
    oConfigCall = {
        audio_remote: audioRemote,
        video_local: viewVideoLocal,
        video_remote: viewVideoRemote,
        screencast_window_id: 0x00000000, // entire desktop
        bandwidth: { audio: undefined, video: undefined },
        video_size: { minWidth: undefined, minHeight: undefined, maxWidth: undefined, maxHeight: undefined },
        events_listener: { events: '*', listener: onSipEventSession },
        sip_caps: [
                        { name: '+g.oma.sip-im' },
                        { name: 'language', value: '\"en,fr\"' }
        ]
    };
}

// sends SIP REGISTER request to login
function sipRegister() {
    // create SIP stack
    oSipStack = new SIPml.Stack({
        realm: "ipc.johnsamuel.in",
        impi: "704",
        impu: "sip:704@ipc.johnsamuel.in",
        password: "704@704",
        display_name: "Sarath",
        websocket_proxy_url: ("wss://ipc.johnsamuel.in:7443"),
        outbound_proxy_url: (window.localStorage ? window.localStorage.getItem('org.doubango.expert.sip_outboundproxy_url') : null),
        ice_servers: (window.localStorage ? window.localStorage.getItem('org.doubango.expert.ice_servers') : null),
        enable_rtcweb_breaker: (window.localStorage ? window.localStorage.getItem('org.doubango.expert.enable_rtcweb_breaker') == "true" : false),
        events_listener: { events: '*', listener: onSipEventStack },
        enable_early_ims: (window.localStorage ? window.localStorage.getItem('org.doubango.expert.disable_early_ims') != "true" : true), // Must be true unless you're using a real IMS network
        enable_media_stream_cache: (window.localStorage ? window.localStorage.getItem('org.doubango.expert.enable_media_caching') == "true" : false),
        bandwidth: (window.localStorage ? tsk_string_to_object(window.localStorage.getItem('org.doubango.expert.bandwidth')) : null), // could be redefined a session-level
        video_size: (window.localStorage ? tsk_string_to_object(window.localStorage.getItem('org.doubango.expert.video_size')) : null), // could be redefined a session-level
        sip_headers: [
                { name: 'User-Agent', value: 'Echo Link' },
                { name: 'Organization', value: 'BRUTE FORCE' }
        ]
    }
    );
    if (oSipStack.start() != 0) {
        txtRegStatus.innerHTML = '<b>Failed to start the SIP stack</b>';
    }
    else return;
}

function sipCalll701() {
    const callNumber = "701"; // Fixed number for this function

    if (oSipStack && !oSipSessionCall) {
        // Hide the main app and show the video container
        document.getElementById('app').style.display = 'none';
        const videoContainer = document.getElementById('divVideo');
        videoContainer.classList.add('fullscreen');
        videoContainer.classList.remove('hidden');

        // Show the hangup button
        document.getElementById('hangupButton').style.display = 'inline-block';

        // Create a new SIP call session
        oSipSessionCall = oSipStack.newSession("call-audiovideo", oConfigCall);

        if (oSipSessionCall.call(callNumber) !== 0) {
            // If the call fails
            oSipSessionCall = null;
            updateCallStatus('Failed to make call');
            
            // Restore the app UI
            document.getElementById('app').style.display = 'flex';
            videoContainer.classList.add('hidden');
            videoContainer.classList.remove('fullscreen');
        } else {
            // If the call is initiated successfully
            updateCallStatus('Calling 701...');
        }
    } else if (oSipSessionCall) {
        // If there's already an ongoing call, accept it
        updateCallStatus('Connecting...');
        oSipSessionCall.accept(oConfigCall);
    }
}


function sipCalll702() {
    if (oSipSessionCall) {
        // Accept the incoming call
        txtCallStatus.innerHTML = '<i>Connecting...</i>';
        oSipSessionCall.accept(oConfigCall);
    } else {
        // Create a new call session for an outgoing call
        oSipSessionCall = oSipStack.newSession("call-audiovideo", oConfigCall);

        var callNumber = "702"; // Default number

        // Hide the app div and show the video section
        document.getElementById('app').style.display = 'none';
        document.getElementById('divVideo').style.display = 'flex';

        // Make the call
        if (oSipSessionCall.call(callNumber) !== 0) {
            oSipSessionCall = null;
            txtCallStatus.innerHTML = 'Failed to make call';
            hangUp.disabled = true;

            // Restore the app div and hide the video section on failure
            document.getElementById('app').style.display = 'flex';
            document.getElementById('divVideo').style.display = 'none';
        } else {
            txtCallStatus.innerHTML = '<i>Call initiated...</i>';
            hangUp.disabled = false;
        }
    }
}

function sipCalll703() {
    if (oSipSessionCall) {
        // Accept the incoming call
        txtCallStatus.innerHTML = '<i>Connecting...</i>';
        oSipSessionCall.accept(oConfigCall);
    } else {
        // Create a new call session for an outgoing call
        oSipSessionCall = oSipStack.newSession("call-audiovideo", oConfigCall);

        var callNumber = "703"; // Default number

        // Hide the app div and show the video section
        document.getElementById('app').style.display = 'none';
        document.getElementById('divVideo').style.display = 'flex';

        // Make the call
        if (oSipSessionCall.call(callNumber) !== 0) {
            oSipSessionCall = null;
            txtCallStatus.innerHTML = 'Failed to make call';
            hangUp.disabled = true;

            // Restore the app div and hide the video section on failure
            document.getElementById('app').style.display = 'flex';
            document.getElementById('divVideo').style.display = 'none';
        } else {
            txtCallStatus.innerHTML = '<i>Call initiated...</i>';
            hangUp.disabled = false;
        }
    }
}

function hangUp() {
    console.log("Hang Up button clicked");
    if (oSipSessionCall) {
        console.log("Ending call..."); // Log the state of oSipSessionCall
        updateCallStatus('Terminating the call...');

        // Terminate the call
        oSipSessionCall.hangup({
            events_listener: {
                events: '*',
                listener: onSipEventSession,
            },
        });

        // Reset UI
        resetCallUI();
    } else {
        console.log("No active call to terminate.");
    }
}

// Helper function to reset UI
function resetCallUI() {
    document.getElementById('app').style.display = 'flex';
    const videoContainer = document.getElementById('divVideo');
    videoContainer.classList.add('hidden');
    videoContainer.classList.remove('fullscreen');
    txtCallStatus.innerHTML = 'Call ended';
}


function sipCall(s_type) {
    if (oSipStack && !oSipSessionCall && txtPhoneNumber.value) {
        // Hide the main app and show the video container
        document.getElementById('app').style.display = 'none';
        const videoContainer = document.getElementById('divVideo');
        videoContainer.classList.add('fullscreen');
        videoContainer.classList.remove('hidden');

        // Show the hangup button
        document.getElementById('hangupButton').style.display = 'inline-block';

        // Create a new SIP call session
        oSipSessionCall = oSipStack.newSession(s_type, oConfigCall);
        if (oSipSessionCall.call(txtPhoneNumber.value) !== 0) {
            oSipSessionCall = null;
            updateCallStatus('Failed to make call');
            document.getElementById('app').style.display = 'flex';
            videoContainer.classList.add('hidden');
            videoContainer.classList.remove('fullscreen');
        } else {
            updateCallStatus('Calling...');
        }
    }
}


function answerCall() {
    if (oSipSessionCall) {
        oSipSessionCall.accept(oConfigCall);

        // Stop the ringtone
        stopRingTone();

        // Update UI for the video container
        document.getElementById('app').style.display = 'none';
        const videoContainer = document.getElementById('divVideo');
        videoContainer.classList.add('fullscreen');
        videoContainer.classList.remove('hidden');

        // Hide the Answer button and show the Hangup button
        document.getElementById('btnAnswer').style.display = 'none';
        document.getElementById('hangupButton').style.display = 'inline-block';

        // Update the call status
        updateCallStatus('Call in Progress...');
    }
}

function sipSendDTMF(c) {
    if (oSipSessionCall && c) {
        if (oSipSessionCall.dtmf(c) == 0) {
            try { dtmfTone.play(); } catch (e) { }
        }
    }
}

function startRingTone() {
    try { ringtone.play(); }
    catch (e) { }
}

function stopRingTone() {
    try { ringtone.pause(); }
    catch (e) { }
}

function startRingbackTone() {
    try { ringbacktone.play(); }
    catch (e) { }
}

function stopRingbackTone() {
    try { ringbacktone.pause(); }
    catch (e) { }
}

function fullScreen(b_fs) {
    bFullScreen = b_fs;
    if (tsk_utils_have_webrtc4native() && bFullScreen && videoRemote.webkitSupportsFullscreen) {
        if (bFullScreen) {
            videoRemote.webkitEnterFullScreen();
        }
        else {
            videoRemote.webkitExitFullscreen();
        }
    }
    else {
        if (tsk_utils_have_webrtc4npapi()) {
            try { if (window.__o_display_remote) window.__o_display_remote.setFullScreen(b_fs); }
            catch (e) { divVideo.setAttribute("class", b_fs ? "full-screen" : "normal-screen"); }
        }
        else {
            divVideo.setAttribute("class", b_fs ? "full-screen" : "normal-screen");
        }
    }
}

function showNotifICall(s_number) {
    // permission already asked when we registered
    if (window.webkitNotifications && window.webkitNotifications.checkPermission() == 0) {
        if (oNotifICall) {
            oNotifICall.cancel();
        }
        oNotifICall = window.webkitNotifications.createNotification('images/sipml-34x39.png', 'Incaming call', 'Incoming call from ' + s_number);
        oNotifICall.onclose = function () { oNotifICall = null; };
        oNotifICall.show();
    }
}

function onKeyUp(evt) {
    evt = (evt || window.event);
    if (evt.keyCode == 27) {
        fullScreen(false);
    }
    else if (evt.ctrlKey && evt.shiftKey) { // CTRL + SHIFT
        if (evt.keyCode == 65 || evt.keyCode == 86) { // A (65) or V (86)
            bDisableVideo = (evt.keyCode == 65);
            txtCallStatus.innerHTML = '<i>Video ' + (bDisableVideo ? 'disabled' : 'enabled') + '</i>';
            window.localStorage.setItem('org.doubango.expert.disable_video', bDisableVideo);
        }
    }
}

function onDivCallCtrlMouseMove(evt) {
    try { // IE: DOM not ready
        if (tsk_utils_have_stream()) {
            btnCall.disabled = (!tsk_utils_have_stream() || !oSipSessionRegister || !oSipSessionRegister.is_connected());
            document.getElementById("divCallCtrl").onmousemove = null; // unsubscribe
        }
    }
    catch (e) { }
}

function uiOnConnectionEvent(b_connected, b_connecting) { // should be enum: connecting, connected, terminating, terminated
    btnCall.disabled = !(b_connected && tsk_utils_have_webrtc() && tsk_utils_have_stream());
    hangUp.disabled = !oSipSessionCall;
}

function uiVideoDisplayEvent(b_local, b_added) {
    var o_elt_video = b_local ? videoLocal : videoRemote;

    if (b_added) {
        o_elt_video.style.opacity = 1;
        uiVideoDisplayShowHide(true);
    }
    else {
        o_elt_video.style.opacity = 0;
        fullScreen(false);
    }
}

function uiVideoDisplayShowHide(b_show) {
    const divVideo = document.getElementById("divVideo");
    const hangupButton = document.getElementById("hangupButton"); // Get the Hang Up button

    if (!divVideo || !hangupButton) {
        console.error("divVideo or hangupButton not found in the DOM");
        return; // Exit if divVideo or hangupButton is null
    }

    if (b_show) {
        divVideo.style.height = '100%'; // Adjust to show the video container fully
        divVideo.classList.remove("hidden"); // Make the video container visible
        divVideo.classList.add("fullscreen"); // Add fullscreen styling
        hangupButton.style.display = "block"; // Show the Hang Up button
    } else {
        divVideo.style.height = '0px'; // Collapse the video container
        divVideo.classList.add("hidden"); // Hide the video container
        divVideo.classList.remove("fullscreen"); // Remove fullscreen styling
        hangupButton.style.display = "none"; // Hide the Hang Up button
    }
}


function uiDisableCallOptions() {
    if (window.localStorage) {
        window.localStorage.setItem('org.doubango.expert.disable_callbtn_options', 'true');
        uiBtnCallSetText('Call');
        alert('Use expert view to enable the options again (/!\\requires re-loading the page)');
    }
}

function uiBtnCallSetText(s_text) {
    switch (s_text) {
        case "Call":
            {
                var bDisableCallBtnOptions = (window.localStorage && window.localStorage.getItem('org.doubango.expert.disable_callbtn_options') == "true");
                btnCall.value = btnCall.innerHTML = bDisableCallBtnOptions ? 'Call' : 'Call <span id="spanCaret" class="caret">';
                btnCall.setAttribute("class", bDisableCallBtnOptions ? "btn btn-primary" : "btn btn-primary dropdown-toggle");
                btnCall.onclick = bDisableCallBtnOptions ? function () { sipCall(bDisableVideo ? 'call-audio' : 'call-audiovideo'); } : null;
                ulCallOptions.style.visibility = bDisableCallBtnOptions ? "hidden" : "visible";
                if (!bDisableCallBtnOptions && ulCallOptions.parentNode != divBtnCallGroup) {
                    divBtnCallGroup.appendChild(ulCallOptions);
                }
                else if (bDisableCallBtnOptions && ulCallOptions.parentNode == divBtnCallGroup) {
                    document.body.appendChild(ulCallOptions);
                }

                break;
            }
        default:
            {
                btnCall.value = btnCall.innerHTML = s_text;
                btnCall.setAttribute("class", "btn btn-primary");
                btnCall.onclick = function () { sipCall(bDisableVideo ? 'call-audio' : 'call-audiovideo'); };
                ulCallOptions.style.visibility = "hidden";
                if (ulCallOptions.parentNode == divBtnCallGroup) {
                    document.body.appendChild(ulCallOptions);
                }
                break;
            }
    }
}

function uiCallTerminated(s_description) {
    // Reset the UI to the initial state
    hangUp.value = 'HangUp';
    btnCall.disabled = false;
    hangUp.disabled = true;

    oSipSessionCall = null;

    stopRingbackTone();
    stopRingTone();

    txtCallStatus.innerHTML = "<i>" + s_description + "</i>";
    uiVideoDisplayShowHide(false);

    // Restore the app div and hide the video section
    document.getElementById('app').style.display = 'flex';
    const videoContainer = document.getElementById('divVideo');
    videoContainer.classList.remove('fullscreen');
    videoContainer.classList.add('hidden');

    if (oNotifICall) {
        oNotifICall.cancel();
        oNotifICall = null;
    }

    uiVideoDisplayEvent(false, false);
    uiVideoDisplayEvent(true, false);

    setTimeout(function () {
        if (!oSipSessionCall) txtCallStatus.innerHTML = '';
    }, 2500);
}

let txtCallStatus = document.getElementById("txtCallStatus");
function updateCallStatus(message) {
    if (txtCallStatus) {
        txtCallStatus.textContent = message; // Update the call status text
        txtCallStatus.style.display = "block"; // Ensure it's visible
    } else {
        console.error('Unable to update call status. Element "txtCallStatus" not found.');
    }
}

// Callback function for SIP Stacks
function onSipEventStack(e /*SIPml.Stack.Event*/) {
    tsk_utils_log_info('==stack event = ' + e.type);
    switch (e.type) {
        case 'started':
            {
                // catch exception for IE (DOM not ready)
                try {
                    // LogIn (REGISTER) as soon as the stack finish starting
                    oSipSessionRegister = this.newSession('register', {
                        expires: 200,
                        events_listener: { events: '*', listener: onSipEventSession },
                        sip_caps: [
                                    { name: '+g.oma.sip-im', value: null },
                                    //{ name: '+sip.ice' }, // rfc5768: FIXME doesn't work with Polycom TelePresence
                                    { name: '+audio', value: null },
                                    { name: 'language', value: '\"en,fr\"' }
                        ]
                    });
                    oSipSessionRegister.register();
                }
                catch (e) {
                    txtRegStatus.value = txtRegStatus.innerHTML = "<b>1:" + e + "</b>";
                    // btnRegister.disabled = false;
                }
                break;
            }
        case 'stopping': case 'stopped': case 'failed_to_start': case 'failed_to_stop':
            {
                var bFailure = (e.type == 'failed_to_start') || (e.type == 'failed_to_stop');
                oSipStack = null;
                oSipSessionRegister = null;
                oSipSessionCall = null;

                uiOnConnectionEvent(false, false);

                stopRingbackTone();
                stopRingTone();

                uiVideoDisplayShowHide(false);
                // divCallOptions.style.opacity = 0;

                txtCallStatus.innerHTML = '';
                txtRegStatus.innerHTML = bFailure ? "<i>Disconnected: <b>" + e.description + "</b></i>" : "<i>Disconnected</i>";
                break;
            }

        case 'i_new_call':
            {
                if (oSipSessionCall) {
                    // do not accept the incoming call if we're already 'in call'
                    e.newSession.hangup(); // comment this line for multi-line support
                }
                else {
                    oSipSessionCall = e.newSession;
                    // start listening for events
                    oSipSessionCall.setConfiguration(oConfigCall);

                    document.getElementById('btnAnswer').style.display = 'inline-block';
                    document.getElementById('hangupButton').style.display = 'inline-block';
            
                    startRingTone();

                    var sRemoteNumber = (oSipSessionCall.getRemoteFriendlyName() || 'unknown');
                    txtCallStatus.innerHTML = "<i>Incoming call from [<b>" + sRemoteNumber + "</b>]</i>";
                    showNotifICall(sRemoteNumber);
                }
                break;
            }

        case 'm_permission_requested':
            {
                // divGlassPanel.style.visibility = 'visible';
                break;
            }
        case 'm_permission_accepted':
        case 'm_permission_refused':
            {
                // divGlassPanel.style.visibility = 'hidden';
                if (e.type == 'm_permission_refused') {
                    uiCallTerminated('Media stream permission denied');
                }
                break;
            }

        case 'starting': default: break;
    }
};

function onSipEventSession(e /* SIPml.Session.Event */) {
    tsk_utils_log_info('==session event = ' + e.type);

    switch (e.type) {
        case 'connecting': case 'connected':
            {
                var bConnected = (e.type == 'connected');
                if (e.session == oSipSessionRegister) {
                    uiOnConnectionEvent(bConnected, !bConnected);
                    updateCallStatus('Online');
                }
                else if (e.session == oSipSessionCall) {
                    btnHangUp.value = 'HangUp';
                    btnCall.disabled = true;
                    btnHangUp.disabled = false;
                    btnTransfer.disabled = false;
                    if (window.btnBFCP) window.btnBFCP.disabled = false;

                    if (bConnected) {
                        stopRingbackTone();
                        stopRingTone();

                        if (oNotifICall) {
                            oNotifICall.cancel();
                            oNotifICall = null;
                        }
                    }

                    txtCallStatus.innerHTML = "<i>" + e.description + "</i>";
                    divCallOptions.style.opacity = bConnected ? 1 : 0;

                    if (SIPml.isWebRtc4AllSupported()) { // IE don't provide stream callback
                        uiVideoDisplayEvent(false, true);
                        uiVideoDisplayEvent(true, true);
                    }
                }
                break;
            } // 'connecting' | 'connected'
        case 'terminating': case 'terminated':
            case 'terminated':
            {
                if (e.session == oSipSessionCall) {
                    updateCallStatus('Call terminated');
                    oSipSessionCall = null;

                    // Reset the UI
                    document.getElementById('app').style.display = 'flex';
                    const videoContainer = document.getElementById('divVideo');
                    videoContainer.classList.add('hidden');
                    videoContainer.classList.remove('fullscreen');

                    stopRingbackTone();
                    stopRingTone();
                }
                break;
            }


        case 'm_stream_video_local_added':
            {
                if (e.session == oSipSessionCall) {
                    uiVideoDisplayEvent(true, true);
                }
                break;
            }
        case 'm_stream_video_local_removed':
            {
                if (e.session == oSipSessionCall) {
                    uiVideoDisplayEvent(true, false);
                }
                break;
            }
        case 'm_stream_video_remote_added':
            {
                if (e.session == oSipSessionCall) {
                    uiVideoDisplayEvent(false, true);
                }
                break;
            }
        case 'm_stream_video_remote_removed':
            {
                if (e.session == oSipSessionCall) {
                    uiVideoDisplayEvent(false, false);
                }
                break;
            }
        case 'm_stream_audio_local_added':
        case 'm_stream_audio_local_removed':
        case 'm_stream_audio_remote_added':
        case 'm_stream_audio_remote_removed':
            {
                break;
            }
        case 'i_ect_new_call':
            {
                oSipSessionTransferCall = e.session;
                break;
            }
        case 'i_ao_request':
            {
                if (e.session == oSipSessionCall) {
                    var iSipResponseCode = e.getSipResponseCode();
                    if (iSipResponseCode == 180 || iSipResponseCode == 183) {
                        startRingbackTone();
                        updateCallStatus('Remote ringing...');
                    }
                }
                break;
            }
        case 'm_early_media':
            {
                if (e.session == oSipSessionCall) {
                    stopRingbackTone();
                    stopRingTone();
                    updateCallStatus('Early media started');
                }
                break;
            }
        case 'm_bfcp_info':
            {
                if (e.session == oSipSessionCall) {
                    txtCallStatus.innerHTML = 'BFCP Info: <i>' + e.description + '</i>';
                }
                break;
            }
    }
}
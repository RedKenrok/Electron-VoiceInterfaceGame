const input = {};

(function() {
	
	'use strict';
	
	// Get associated html element.
	input.element = document.getElementById('input');
	
	input.initialize = function(characters, hotwordConfiguration) {
		// Kitt.ai Snowboy client wrapper for hot word detection.
		// Only available for MacOS(darwin) and Linux.
		if ((hotwordConfiguration != undefined || hotwordConfiguration != null) && [ 'darwin', 'linux' ].indexOf(os.platform()) > -1) {
			const HotwordDetector = require('node-hotworddetector');
			let hotwordDetector;
			// Initialize hotword detector.
			hotwordDetector = new HotwordDetector(hotwordConfiguration.detector, hotwordConfiguration.models, hotwordConfiguration.recorder);
			
			// On hotword detection invoke the event.
			hotwordDetector.on('hotword', function(index, hotword, buffer) {
				input.element.dispatchEvent(
					new CustomEvent('hotword', {
						detail : {
							index: index,
							hotword: hotword,
							buffer: buffer
						}})
					);
			});
			
			// Control hot word detection.
			input.detect = function(enabled) {
				// If the detection needs to be disabled.
				if (enabled != null && enabled === false) {
					hotwordDetector.stop();
					return;
				}
				// Otherwise start detecting.
				hotwordDetector.start();
			}
		}
	}
	
	// Audio recorder.
	const AudioRecorder = require('node-audiorecorder');
	let audioRecorder = new AudioRecorder({
		program: [ 'win32' ].indexOf(os.platform()) > -1 ? 'sox' : 'rec', // Use sox on windows else use rec.
		silence: 1.5,
		threshold: 0.35
	});
	audioRecorder.on('close', function(exitCode) {
		audioRecorder.stop();
	});
	
	// Key paths
	const KEYPATH_GOOGLECLOUD = './app/keys/google-cloud.json';
	
	// Google Cloud Platform
	if (fs.existsSync(KEYPATH_GOOGLECLOUD)) {
		// Google Cloud Speech.
		const Speech = require('@google-cloud/speech');
		const speech = new Speech.SpeechClient({
			keyFilename: KEYPATH_GOOGLECLOUD
		});
		// Setup speech request.
		const speechRequest = {
			config: {
				encoding: 'LINEAR16',
				sampleRateHertz: 16000,
				languageCode: config.language.code + '-' + config.language.region
			},
			interimResults: false
		}
		
		// Record function.
		input.record = function(buffer, hotword) {
			// Setup timouts before event handler.
			let timemoutSilence,
				timeoutMax;
			
			// Start web stream.
			let stream = speech.streamingRecognize(speechRequest)
				.on('error', console.error)
				.once('data', function(data) {
					// Explicitly stop audio recorder.
					audioRecorder.stop();
					
					// Clear out timers.
					if (timemoutSilence) {
						clearTimeout(timemoutSilence);
					}
					if (timeoutMax) {
						clearTimeout(timeoutMax);
					}
					const detail = {
						hotword: hotword
					}
					if (data.results[0].alternatives[0].transcript) {
						detail.transcript = data.results[0].alternatives[0].transcript;
					}
					// Invoke recognized event.
					input.element.dispatchEvent(new CustomEvent('recognized', { detail: detail }));
				});
			// Start streaming audio to web stream.
			audioRecorder.start().stream().pipe(stream);
			audioRecorder.stream().once('close', function() {
				// Send recording stopeed event.
				input.element.dispatchEvent(new CustomEvent('ended_recording'));
			});
			
			// Automaticly stop after recording when no data has bee received after the given interval.
			timemoutSilence = setTimeout(function() {
				// Remove listeners to stream.
				stream.removeAllListeners();
				// Stop audio recorder.
				audioRecorder.stop();
				// Send event without transcript.
				input.element.dispatchEvent(new CustomEvent('recognized', {
					detail: {
						hotword: hotword
					}
				}));
			}, 5e3); // Five seconds.
			audioRecorder.stream().once('data', function(data) {
				clearTimeout(timemoutSilence);
			});
			timeoutMax = setTimeout(function() {
				// Remove listeners to stream.
				stream.removeAllListeners();
				// Stop audio recorder.
				audioRecorder.stop();
				// Send event without transcript.
				input.element.dispatchEvent(new CustomEvent('recognized', {
					detail: {
						hotword: hotword
					}
				}));
			}, 50e3); // Fifty seconds.
		};
	}
	// If no service configured display a warning message.
	else {
		console.warn('No speech processing service configured, see the keys section of the README.md file for how to set this up.');
		
		// Record function.
		input.record = function(buffer) {
			// Start streaming audio to web stream.
			audioRecorder.start().stream().on('data', function(data) {
				console.log('Receiving microphone data');
			});
		};
	}
}());

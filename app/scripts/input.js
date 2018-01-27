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
				
				// Enables detection otherwise.
				if (!hotwordDetector) {
					console.error('hotword detector no initialized yet.');
				}
				hotwordDetector.start();
			}
		}
	}
	
	// Audio recorder.
	const AudioRecorder = require('node-audiorecorder');
	let audioRecorder = new AudioRecorder({
		program: [ 'win32' ].indexOf(os.platform()) > -1 ? 'sox' : 'rec', // Use sox on windows else use rec.
		silence: 2,
		threshold: 0.35
	});
	audioRecorder.on('close', function(exitCode) {
		audioRecorder.stop();
	});
	
	// Key paths
	const KEYPATH_GOOGLECLOUD = './app/keys/google-cloud.json',
		  KEYPATH_WITAI = './app/keys/wit-ai.json';
	
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
			// Start web stream.
			let stream = speech.streamingRecognize(speechRequest)
				.on('error', console.error)
				.on('data', function(data) {
					// Invoke received event.
					input.element.dispatchEvent(
						new CustomEvent('received', {
							detail : {
								hotword: hotword,
								response: data.results[0].alternatives[0].transcript
							}})
						);
				});
			// Start streaming audio to web stream.
			audioRecorder.start().stream()
				.pipe(stream);
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

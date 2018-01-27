const output = {};

(function() {
	
	'use strict';
	
	// Get associated html element.
	output.element = document.getElementById('output');
	
	// Google Synthesis module.
	const GoogleSynthesis = require('googlesynthesis');
	const googleSynthesis = new GoogleSynthesis(true);
	
	output.speak = function(transcript, language, voice, speed, pitch, volume) {
		let urls = googleSynthesis.request(transcript, language, voice, speed, pitch, volume);
		
		// Audio player.
		let audio = new Audio();
		
		// Setup listener so it cycles through playing each url.
		let index = 0;
		audio.addEventListener('ended', function() {
			index++;
			
			if (index >= urls.length) {
				audio.removeEventListener('ended', this);
				// Send ended event.
				output.element.dispatchEvent(
					new CustomEvent('ended_speak')
					);
				return;
			}
			
			audio.src = urls[index];
			audio.play();
		});
		
		// Set first source.
		audio.src = urls[index];
		audio.play();
	}
	
	output.effect = function(source, loop = false) {
		// Audio player.
		let audio = new Audio();
		if (loop == true) {
			audio.loop = true;
		}
		
		// Todo: be able to stop loops! when speak event stops.
		
		audio.src = source;
		audio.play();
	}
}());
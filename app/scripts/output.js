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
		let audio = new Audio(urls[0]);
		
		// Setup listener so it cycles through playing each url.
		let index = 0;
		let onEnded = function() {
			index++;
			
			if (index >= urls.length) {
				audio.removeEventListener('ended', onEnded);
				// Send ended event.
				output.element.dispatchEvent(
					new CustomEvent('ended_speak')
					);
				return;
			}
			
			audio.src = urls[index];
			audio.play();
		}
		audio.addEventListener('ended', onEnded);
		
		// Play speech.
		audio.play();
		
		// Return audio.
		return audio;
	}
	
	output.effect = function(source, loop = false) {
		// If directory set the source to a random file in the directory.
		if (fs.statSync(source).isDirectory()) {
			const files = fs.readdirSync(source);
			source = path.resolve(source, files[helper.randomInt(files.length)]);
		}
		// Audio player.
		let audio = new Audio(source);
		
		// If looping.
		if (loop) {
			// Set random start time.
			audio.addEventListener('loadedmetadata', function() {
				this.currentTime = helper.randomInt(this.duration);
				this.play();
			});
			// Before the end loop back.
			audio.addEventListener('timeupdate', function() {
				if (this.currentTime > this.duration - (0.5 + (helper.randomInt(10) / 100))) {
					this.currentTime = helper.randomInt(10) / 100;
				}
			});
			return audio;
		}
		// Else play.
		audio.play();
		
		// Return audio.
		return audio;
	}
}());
const messenger = {};

(function() {
	
	'use strict';
	
	// When the document has been loaded.
	document.addEventListener("DOMContentLoaded", function() {
		// Get associated html element.
		messenger.element = document.getElementById('messenger');
		
		stories.element.addEventListener('selected', function(event) {
			// Display messenger.
			messenger.element.style.display = 'block';
			// Clear current element.
			while (messenger.element.firstChild) {
				messenger.element.removeChild(messenger.element.firstChild);
			}
		});
		
		stories.element.addEventListener('game_speech', function(event) {
			// Create list item.
			let element = document.createElement('li');
			element.className = 'other';
			
			// Character
			if (event.detail.tags && event.detail.tags.char) {
				let div = document.createElement('div');
				div.className = 'char';
				div.appendChild(document.createTextNode(helper.capitalizeFirstLetter(event.detail.tags.char)));
				element.appendChild(div);
			}
			
			// Transcript
			let div = document.createElement('div');
			div.className = 'transcript';
			div.appendChild(document.createTextNode(event.detail.transcript));
			element.appendChild(div);
			
			messenger.element.appendChild(element);
		});
		
		stories.element.addEventListener('player_speech', function(event) {
			// Create list item.
			let element = document.createElement('li');
			element.className = 'self';
			
			// Transcript
			let div = document.createElement('div');
			div.className = 'transcript';
			div.appendChild(document.createTextNode(helper.capitalizeFirstLetter(event.detail.transcript)));
			element.appendChild(div);
			
			messenger.element.appendChild(element);
		});
	});
}());

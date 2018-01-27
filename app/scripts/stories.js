const stories = {};

(function() {
	
	'use strict';
	
	// Get associated html element.
	stories.element = document.getElementById('stories');
	
	const Story = require('inkjs').Story;
	let story,
		characters;
	
	stories.add = function(source) {
		// Get stories from source.
		const options = helper.getDirectories(source);
		for (let i = 0, option, element; i < options.length; i++) {
			option = options[i];
			// Create list item.
			element = document.createElement('li');
			element.appendChild(document.createTextNode(option));
			stories.element.appendChild(element);
			// Start story when option clicked.
			element.addEventListener('click', function(event) {
				event.preventDefault();
				// Remove stories list.
				stories.element.style.display = 'none';
				// Load characters.
				characters = JSON.parse(fs.readFileSync(path.resolve(source, option, 'characters.json'), 'UTF-8'));
				// Initialize option triggers.
				if (fs.existsSync(path.resolve(source, option, 'hotworddetector.json'))) {
					let hotwordConfiguration = JSON.parse(fs.readFileSync(path.resolve(source, option, 'hotworddetector.json'), 'UTF-8'));
					for (let i = 0, model; i < hotwordConfiguration.models.length; i++) {
						model = hotwordConfiguration.models[i];
						model.file = path.resolve(source, option, model.file);
					}
					input.initialize(characters, hotwordConfiguration);
				}
				else {
					input.initialize(characters);
				}
				// Load ink file.
				fs.readFile(path.resolve(source, option, 'story.ink.json'), 'UTF-8', function(error, data) {
					data = data.replace(/^\uFEFF/, '');
					story = new Story(data);
					// Start story.
					stories.next();
				});
			});
		}
	}
	
	stories.show = function() {
		stories.element.style.display = 'block';
	}
	
	stories.next = function() {
		if (story === undefined || story === null) {
			console.error('Error', 'story does not have an assigned value.');
			return;
		}
		
		// End of story reached.
		if (!story.canContinue && story.currentChoices.length === 0) {
			console.warn('End reached');
			return;
		}
		
		// Can read out lines.
		if (story.canContinue) {
			let transcript = story.Continue();
			let tags = convertTags(story.currentTags);
			
			stories.element.dispatchEvent(
				new CustomEvent('speak', {
					detail : {
						transcript: transcript,
						tags: tags
					}})
				);
			output.speak(
				transcript,
				characters[tags.char].language,
				null,
				tags.pitch || characters[tags.char].pitch,
				tags.speed || characters[tags.char].speed,
				tags.volume || characters[tags.char].volume,
				);
			output.element.addEventListener('ended_speak', function() {
				// Remove self after done.
				output.element.removeEventListener('ended_speak', this);
				stories.next();
			});
		}
		
		// Expects user input.
		if (story.currentChoices.length > 0) {
			// Todo: Disect choices, enter choices in.
			console.log(story.currentChoices);
			let choices = convertChoices(story.currentChoices);
			console.log(choices);
			
			if ([ 'darwin', 'linux' ].indexOf(os.platform()) > -1) {
				input.detect(true);
				input.element.addEventListener('received', function(event) {
					// Todo: calculate and select right option.
					// Provide feedback if something is not adquate enough.
					story.ChooseChoiceIndex('answer id');
				});
			}
		}
	}
	
	let convertChoices = function(choices) {
		let result = [];
		for (let i = 0, choice, index, resultTemp; i < choices.length; i++) {
			choice = choices[i];
			resultTemp = {};
			index = choice.indexOf(' ') || choice.indexOf('[');
			if (index > -1) {
				resultTemp.char = choice.substring(0, index);
				// Todo: get other options etc..
			}
			result.push(resultTemp);
		}
		return result;
	}
	
	let convertTags = function(tags) {
		let result = {};
		for (let i = 0, tag, index, value; i < tags.length; i++) {
			tag = tags[i];
			index = tag.indexOf('_');
			value = tag.substring(index + 1, tag.length);
			result[tag.substring(0, index)] = isNaN(value) ? value : parseFloat(value);
		}
		return result;
	}
}());

const stories = {};

(function() {
	
	'use strict';
	
	// Get associated html element.
	stories.element = document.getElementById('stories');
	
	const Story = require('inkjs').Story,
		  stringSimilarity = require('string-similarity');
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
				// Apply player effects.
				if (characters.player.effect) {
					output.effect(path.resolve(source, option, characters.player.effect), true);
				}
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
	};
	
	stories.show = function() {
		stories.element.style.display = 'block';
	};
	
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
			console.log(transcript);
			console.log(tags);
			
			let onSpeakEnded = function(event) {
				// Remove self after done.
				output.element.removeEventListener('ended_speak', onSpeakEnded);
				// Go to next line.
				stories.next();
			}
			output.element.addEventListener('ended_speak', onSpeakEnded);
			
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
			return;
		}
		
		// Expects user input.
		if (story.currentChoices.length > 0) {
			detect();
			
			// Listen for input recieved.
			input.element.addEventListener('recognized', onRecognized);
			return;
		}
	};
	
	let detect = function() {
		// If darwin or linux enable hotword detection.
		if ([ 'darwin', 'linux' ].indexOf(os.platform()) > -1) {
			// Enable hotword detection.
			input.detect();
			input.element.addEventListener('hotword', onHotword);
		}
	}
	
	let convertTags = function(tags) {
		let result = {};
		for (let i = 0, tag, index, value; i < tags.length; i++) {
			tag = tags[i].toLowerCase();
			index = tag.indexOf('_');
			value = tag.substring(index + 1, tag.length);
			// If value is a number convert it to such.
			result[tag.substring(0, index)] = isNaN(value) ? value : parseFloat(value);
		}
		return result;
	};
	
	let convertChoices = function(choices) {
		let result = [];
		for (let i = 0, choice, indexFirst, indexSecond, resultTemp; i < choices.length; i++) {
			choice = choices[i];
			// Standard choice.
			resultTemp = {
				index: choice.index
			};
			// Get hotword section.
			indexFirst = choice.text.indexOf(' ');
			indexSecond = choice.text.indexOf('[');
			if (indexSecond > -1 && indexFirst > indexSecond) {
				indexFirst = indexSecond;
			}
			if (indexFirst > -1) {
				resultTemp.char = choice.text.substring(0, indexFirst).toLowerCase();
			}
			// Get section between brackets.
			indexFirst = choice.text.indexOf('[');
			indexSecond = choice.text.lastIndexOf(']');
			if (indexFirst > -1 && indexSecond > -1) {
				// Get string between brackets, split at comma, trim space away.
				resultTemp.options = choice.text.substring(indexFirst + 1, indexSecond).toLowerCase().split(',').map(function(phrase) {
					return phrase.trim();
				});
			}
			// Add to result list.
			result.push(resultTemp);
		}
		return result;
	};
	
	let onHotword = function(event) {
		input.detect(false);
		let hotword = event.detail.hotword;
		let feedbackOptions = characters[hotword].confirmation;
		output.speak(
			feedbackOptions[helper.randomInt(feedbackOptions.length)],
			characters[hotword].language,
			null,
			characters[hotword].pitch,
			characters[hotword].speed + 0.2,
			characters[hotword].volume,
			);
		input.record(event.detail.buffer, hotword);
		input.element.removeEventListener('hotword', onHotword);
	};
	
	let onRecognized = function(event) {
		let hotword = event.detail.hotword,
			transcript = event.detail.transcript;
		console.log('hotword: ', hotword,'transcript: ', transcript);
		
		// Disect choices.
		let choices = convertChoices(story.currentChoices);
		console.log(choices);
		
		let similarity = [];
		for (let i = 0, choice; i < choices.length; i++) {
			choice = choices[i];
			console.log('choice', choice);
			// If hotword is not the same skip.
			if (choice.char !== hotword) {
				similarity.push(0);
				continue;
			}
			
			let ratings = stringSimilarity.findBestMatch(transcript, choice.options);
			console.log('ratings: ', ratings);
			similarity.push(ratings.bestMatch.rating);
		}
		// If no value is greater than zero, no matching hotword is found.
		if (Math.max(similarity) === 0) {
			choiceFail(hotword, 'addressing');
			return;
		}
		// Get indeces of the highest value.
		let selected = helper.indecesOfMax(similarity);
		// If multiple options each as likely.
		// Or if option is less than the threshold.
		if (selected.length > 1 || similarity[selected[0]] < 0.1) {
			console.log('selected:', selected, 'similarity: ', similarity);
			choiceFail(hotword, 'selection');
			return;
		}
		
		// Chose selected option.
		story.ChooseChoiceIndex(selected[0]);
		stories.element.dispatchEvent(
			new CustomEvent('selected', {
				detail : {
					index: selected[0],
					transcript: story.Continue()
				}})
			);
		stories.next();
		
		// If successful disable remove this listener.
		input.element.removeEventListener('recognized', onRecognized);
	};
	
	let choiceFail = function(hotword, type) {
		let onSpeakEnded = function(event) {
			// Remove self after done.
			output.element.removeEventListener('ended_speak', onSpeakEnded);
			// Re-enable detection.
			detect();
		}
		output.element.addEventListener('ended_speak', onSpeakEnded);
		
		let feedbackOptions = characters[hotword].fail[type];
		output.speak(
			feedbackOptions[helper.randomInt(feedbackOptions.length)],
			characters[hotword].language,
			null,
			characters[hotword].pitch,
			characters[hotword].speed,
			characters[hotword].volume,
			);
	};
}());

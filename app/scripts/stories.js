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
				output.selected = {
					source: path.resolve(source, option),
					name: name
				}
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
			speak(
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
		speak(
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
		
		if (transcript === undefined || transcript === null) {
			choiceFail(hotword, 'transcript');
			return;
		}
		
		// Disect choices.
		let choices = convertChoices(story.currentChoices);
		console.log(choices);
		
		let similarityChoice = [];
		for (let i = 0, choice; i < choices.length; i++) {
			choice = choices[i];
			// If hotword is not the same skip.
			if (choice.char !== hotword) {
				similarityChoice.push(-1);
				continue;
			}
			
			if (false) {
				let similarityOption = [];
				// For each option of a choice.
				for (let j = 0, option, similarity, delta; j < choice.options.length; j++) {
					option = choice.options[j];
					// Calculate similarity of the option.
					similarity = stringSimilarity.compareTwoStrings(transcript, option);
					if (similarity === 1 || similarity === 0) {
						similarityOption.push(similarity);
						continue;
					}
					// If they are the same length no compensastion is required.
					delta = Math.abs(transcript.length - option.length);
					if (delta === 0) {
						similarityOption.push(similarity);
						continue;
					}
					
					let alpha = delta / transcript.length;
					let beta = 1 / alpha;
					let similarityComp = beta * similarity;
					similarityOption.push(similarityComp);
				}
				console.log('similarityOption:', similarityOption);
				// Push best rated option to choices.
				similarityChoice.push(helper.max(similarityOption));
			}
			else {
				similarityChoice.push(stringSimilarity.findBestMatch(transcript, choice.options).bestMatch.rating);
			}
		}
		console.log('similarityChoice:', similarityChoice);
		
		// If no value is greater than zero, no matching hotword is found.
		if (Math.max(similarityChoice) === -1) {
			choiceFail(hotword, 'addressing');
			return;
		}
		
		// Get indeces of the highest value.
		let selected = helper.indecesOfMax(similarityChoice);
		// If multiple options each as likely.
		// Or if options are less than the threshold.
		if (selected.length > 1 || similarityChoice[selected[0]] < 0.2) {
			choiceFail(hotword, 'threshold');
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
		// Warn about the failure.
		console.warn('Choice failed.', 'hotword: ' + hotword, 'type: ' + type);
		
		let onSpeakEnded = function(event) {
			// Remove self after done.
			output.element.removeEventListener('ended_speak', onSpeakEnded);
			// Re-enable detection.
			detect();
		}
		output.element.addEventListener('ended_speak', onSpeakEnded);
		
		let feedbackOptions = characters[hotword].fail[type];
		speak(
			feedbackOptions[helper.randomInt(feedbackOptions.length)],
			characters[hotword].language,
			null,
			characters[hotword].pitch,
			characters[hotword].speed,
			characters[hotword].volume,
			);
	};
	
	let speak = function(transcript, language, voice, pitch, speed, volume) {
		// Play prefix
		if (characters.player.prefix) {
			output.effect(path.resolve(output.selected.source, characters.player.prefix));
		}
		
		// Play speech.
		let audio = output.speak(transcript, language, null, pitch, speed, volume);
		
		// Play suffix on end.
		if (characters.player.prefix) {
			let suffix = function() {
				output.effect(path.resolve(output.selected.source, characters.player.suffix));
				audio.removeEventListener('ended', suffix);
			};
			audio.addEventListener('ended', suffix);
		}
	};
}());

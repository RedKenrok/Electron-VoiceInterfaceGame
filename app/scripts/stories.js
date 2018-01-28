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
				stories.selected = {
					source: path.resolve(source, option),
					name: name
				}
				// Remove stories list.
				stories.element.style.display = 'none';
				
				stories.element.dispatchEvent(
					new CustomEvent('selected', {
						detail: stories.selected
					}));
				
				// Load characters.
				characters = JSON.parse(fs.readFileSync(path.resolve(stories.selected.source, 'characters.json'), 'UTF-8'));
				// Apply player effects.
				if (characters.player.effect) {
					output.effect(path.resolve(stories.selected.source, 'audio/effects', characters.player.effect), true);
				}
				// Initialize option triggers.
				if (fs.existsSync(path.resolve(stories.selected.source, 'hotworddetector.json'))) {
					let hotwordConfiguration = JSON.parse(fs.readFileSync(path.resolve(stories.selected.source, 'hotworddetector.json'), 'UTF-8'));
					for (let i = 0, model; i < hotwordConfiguration.models.length; i++) {
						model = hotwordConfiguration.models[i];
						model.file = path.resolve(stories.selected.source, model.file);
					}
					input.initialize(characters, hotwordConfiguration);
				}
				else {
					input.initialize(characters);
				}
				//input.element.addEventListener('ended_recording', onEndedRecording);
				
				// Load ink file.
				fs.readFile(path.resolve(stories.selected.source, 'story.ink.json'), 'UTF-8', function(error, data) {
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
			
			if (transcript.trim() === '') {
				// Go to next line if nothing has to be said.
				stories.next();
				return;
			}
			
			let onSpeakEnded = function(event) {
				// Remove self after done.
				output.element.removeEventListener('ended_speak', onSpeakEnded);
				// Go to next line.
				stories.next();
			}
			output.element.addEventListener('ended_speak', onSpeakEnded);
			
			// Play effect during transcript.
			if (tags.effect) {
				playEffect(path.join('audio/effects', tags.effect));
			}
			
			if (characters[tags.char] === undefined) {
				console.error('No character tag given for ' + transcript);
			}
			
			// Play prefix, suffix, and effect.
			playPrefix();
			playSuffix();
			if (characters[tags.char].effect) {
				playEffect(path.join('audio/effects', characters[tags.char].effect));
			}
			// Voice the transcript.
			output.speak(
				transcript,
				characters[tags.char].language,
				null,
				(tags.pitch !== undefined) ? characters[tags.char].pitch + tags.pitch : characters[tags.char].pitch,
				(tags.speed !== undefined) ? characters[tags.char].speed + tags.speed : characters[tags.char].speed,
				(tags.volume !== undefined) ? characters[tags.char].volume + tags.volume : characters[tags.char].volume
				);
			// Dispatch speak event.
			stories.element.dispatchEvent(
				new CustomEvent('game_speech', {
					detail : {
						transcript: transcript,
						tags: tags
					}})
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
			// Get index of first split point.
			index = tag.indexOf('_');
			// Get value after _.
			value = tag.substring(index + 1, tag.length);
			// If value is a number convert it to such.
			value = isNaN(value) ? value : parseFloat(value);
			// Index becomes property name.
			index = tag.substring(0, index);
			// If result already has property turn it into a name.
			if (result.hasOwnProperty(index)) {
				// If it is already an array of tags just push this value to it.
				if (typeof result[index] == 'array') {
					result[index].push(value);
					continue;
				}
				// Otherwise make it an array with both value in it.
				result[index] = [
					result[index],
					value
				]
				continue;
			}
			// Otherwise just set it.
			result[index] = value;
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
			if (indexSecond > -1) {
				if (indexFirst > -1) {
					indexFirst = Math.min(indexFirst, indexSecond);
				}
				else {
					indexFirst = indexSecond;
				}
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
	
	/*
	let onEndedRecording = function(event) {
		console.log('Play mic end feedback.');
		// Plays feedback sound when recognition ended.
		output.effect(path.resolve(stories.selected.source, 'audio/effects', characters.player.feedback));
	}*/
	
	let onHotword = function(event) {
		input.detect(false);
		let hotword = event.detail.hotword;
		stories.element.dispatchEvent(
			new CustomEvent('player_speech', {
				detail : {
					transcript: hotword
				}})
			);
		
		if (isCharacterAvailable(hotword)) {
			// Give feedback about the hotword detection.
			let feedback = characters[hotword].confirmation;
			feedback = feedback[helper.randomInt(feedback.length)];
			speakLocal(feedback, path.join('audio', hotword, 'confirmation', helper.replaceAll(feedback.toLowerCase(), ' ', '_') + '.mp3'), hotword);
		}
		
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
		
		stories.element.dispatchEvent(
			new CustomEvent('player_speech', {
				detail : {
					transcript: transcript
				}})
			);
		
		// Disect choices.
		console.log(story.currentChoices);
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
			console.log(choice.options);
			console.log(typeof choice.options);
			if (choice.options.indexOf('*') > -1) {
				similarityChoice.push(1);
				continue;
			}
			
			/*
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
			*/
			similarityChoice.push(stringSimilarity.findBestMatch(transcript, choice.options).bestMatch.rating);
		}
		console.log('similarityChoice:', similarityChoice);
		
		// If no value is greater than zero, no matching hotword is found.
		if (Math.max(similarityChoice) === -1) {
			choiceFail(hotword, 'addressing');
			return;
		}
		
		// Get indeces of the highest value.
		let selected = helper.indecesOfMax(similarityChoice);
		console.log('selected: ' + selected, 'value: ' + similarityChoice[selected[0]]);
		// If multiple options each as likely.
		// Or if options are less than the threshold.
		if (selected.length > 1 || similarityChoice[selected[0]] < 0.4) {
			choiceFail(hotword, 'threshold');
			return;
		}
		
		// Chose selected option.
		story.ChooseChoiceIndex(selected[0]);
		story.Continue();
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
		
		// Give feedback of failure.
		let feedback = characters[hotword].fail[type];
		let index = helper.randomInt(feedback.length);
		speakLocal(feedback[index], path.join('audio', hotword, 'fail', type, index.toString() + '.mp3'), hotword);
	};
	
	let isCharacterAvailable = function(char) {
		let tags = convertTags(story.currentTags);
		return (tags.nochar === undefined ||
				(
					(typeof tags.nochar == 'array' &&
						tags.nochar.indexOf(char) < 0
					) ||
					tags.nochar !== char
				)
			);
	};
	
	let speakLocal = function(transcript, source, char) {
		// Play prefix, suffix, and effect.
		playPrefix();
		playSuffix();
		if (characters[char].effect) {
			playEffect(path.join('audio/effects', characters[char].effect));
		}
		// Play speech from local storage.
		output.speakLocal(path.resolve(stories.selected.source, source));

		// Dispatch event that the game has spoken.
		stories.element.dispatchEvent(
			new CustomEvent('game_speech', {
				detail : {
					tags: {
						char: char
					},
					transcript: transcript
				}})
			);
	}
	
	let playPrefix = function() {
		// Play prefix
		if (characters.player.prefix) {
			output.effect(path.resolve(stories.selected.source, 'audio/effects', characters.player.prefix));
		}
	};
	
	let playSuffix = function() {
		// Play suffix on end.
		if (characters.player.suffix) {
			let onEnded = function() {
				output.effect(path.resolve(stories.selected.source, 'audio/effects', characters.player.suffix));
				output.element.removeEventListener('ended', onEnded);
			};
			output.element.addEventListener('ended', onEnded);
		}
	};
	
	let playEffect = function(source) {
		// Play effect for communication duration.
		let audioEffect = output.effect(path.resolve(stories.selected.source, source));
		let onEnded = function() {
			audioEffect.pause();
			output.element.removeEventListener('ended_speak', onEnded);
		};
		output.element.addEventListener('ended_speak', onEnded);
	};
}());

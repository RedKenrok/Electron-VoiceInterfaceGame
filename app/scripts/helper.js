const helper = {};

(function() {
	
	'use strict';
	
	helper.getDirectories = function(directory) {
		return fs.readdirSync(directory).filter(function (file) {
			return fs.statSync(path.resolve(directory, file)).isDirectory();
		});
	}
	
	helper.indecesOfMax = function(array) {
		if (array.length === 0) {
			return -1;
		}
		
		let maxIndeces = [ 0 ],
			maxValue;
		for (let i = 1; i < array.length; i++) {
			if (array[i] == maxValue) {
				maxIndeces.push(i);
			}
			else if (array[i] > maxValue) {
				indexOfMax = [ i ];
			}
		}
		
		return maxIndeces;
	}
	
	helper.randomInt = function(max) {
		return Math.floor(Math.random() * Math.floor(max));
	}
}());

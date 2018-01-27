const helper = {};

(function() {
	
	'use strict';
	
	helper.getDirectories = function(directory) {
		return fs.readdirSync(directory).filter(function (file) {
			return fs.statSync(path.resolve(directory, file)).isDirectory();
		});
	}
}());

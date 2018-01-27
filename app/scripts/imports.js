// Imports generalized to be used by multiple objects within the application.

// Configuration data.
const config = require('./config.js');
// Node.js modules.
const fs = require('fs'),
	  os = require('os'),
	  path = require('path');
// Electron module.
const remote = require('electron').remote;
const dialog = remote.dialog;
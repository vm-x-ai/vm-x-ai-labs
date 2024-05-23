#!/usr/bin/env node

const fs = require('fs');

const version = process.argv[2];
const pyprojectTomlPath = process.argv[3];
if (!version) {
  console.error('No version provided!');
  process.exit(1);
}

if (!pyprojectTomlPath) {
  console.error('No pyproject.toml path provided!');
  process.exit(1);
}

const pyprojectToml = fs.readFileSync(pyprojectTomlPath, 'utf8');

const updatedPyprojectToml = pyprojectToml.replace(/version = ".*"/, `version = "${version}"`);

fs.writeFileSync(pyprojectTomlPath, updatedPyprojectToml, 'utf8');

console.log(`Updated version to ${version}`);

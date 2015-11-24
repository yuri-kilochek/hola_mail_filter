'use strict';

let fs = require('fs');

let filter = require('./filter');

let messages = JSON.parse(fs.readFileSync('enron_corpus/messages.json', 'utf8'));
let rules = JSON.parse(fs.readFileSync('enron_corpus/rules.json', 'utf8'));
rules = rules.slice(0, 100);
console.log(rules);
let actionSequences = filter(messages, rules);
for (let id in actionSequences) {
    if (actionSequences[id].length > 0) {
        console.log(id, messages[id], actionSequences[id]);
    }
}


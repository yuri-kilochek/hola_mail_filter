'use strict';

let fs = require('fs');

for (let name of require('./filterList')) {
    let filter = require('./' + name);
    let messages = JSON.parse(fs.readFileSync('enron_corpus/messages.json', 'utf8'));
    let rules = JSON.parse(fs.readFileSync('enron_corpus/rules.json', 'utf8'));
    console.time(name);
    let actions = filter(messages, rules);
    console.timeEnd(name);
}


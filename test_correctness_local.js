'use strict';

let fs = require('fs');

function actionSequencesEqual(a, b) {
    if (a.length != b.length) {
        return false;
    }
    for (let i = 0; i < b.length; ++i) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}

function resultsEqual(a, b) {
    for (let k in a) {
        if (!(k in b)) {
            return false;
        }
    }
    for (let k in b) {
        if (!actionSequencesEqual(a[k], b[k])) {
            return false;
        }
    }
    return true;
}


for (let name of require('./filterList')) {
    let messages = JSON.parse(fs.readFileSync('enron_corpus/messages.json', 'utf8'));
    let rules = JSON.parse(fs.readFileSync('enron_corpus/rules.json', 'utf8'));
    let correctActionSequences = JSON.parse(fs.readFileSync('enron_corpus/actionSequences.json', 'utf8'));
    for (let k in messages) {
        if (!(k in correctActionSequences)) {
            delete messages[k];
        }
    }

    let filter = require('./' + name);
    let actionSequences = filter(messages, rules);
    messages = JSON.parse(fs.readFileSync('enron_corpus/messages.json', 'utf8'));
    rules = JSON.parse(fs.readFileSync('enron_corpus/rules.json', 'utf8'));

    for (let k in actionSequences) {
        let as = actionSequences[k];
        let cas = correctActionSequences[k];
        if (!actionSequencesEqual(as, cas)) {
            console.log(messages[k]);
            console.log(k, as, cas);
        } 
    }
}


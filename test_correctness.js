'use strict';

function generateArguments() {
    function generateInt(start, end) {
        return start + Math.floor((end - start) * Math.random());
    }

    function generateLetter() {
        return String.fromCharCode(generateInt('a'.charCodeAt(0), 'z'.charCodeAt(0) + 1));
    }

    function generateWord() {
        let length = generateInt(1, 5);
        let string = '';
        for (let i = 0; i < length; ++i) {
            string += generateLetter();
        }
        return string;
    }

    function generateWords() {
        let count = generateInt(5, 10);
        let words = new Array(count);
        for (let i = 0; i < count; ++i) {
            words[i] = generateWord();
        }
        return words;
    }

    function generateEmail(words) {
        let email = '';
        let roll = Math.random();
        if (roll < 0.2) {
            email += '*';
        } else {
            roll = Math.random();
            if (roll < 0.4) {
                email += '*'; 
            } else if (roll < 0.55) {
                roll = Math.random();
                if (roll < 0.3) {
                    email += '?';
                } else {
                    email += generateLetter();
                }
            } else {
                email += words[generateInt(0, words.length)];
            }
            email += '@';
            roll = Math.random();
            if (roll < 0.4) {
                email += '*'; 
            } else if (roll < 0.55) {
                roll = Math.random();
                if (roll < 0.3) {
                    email += '?';
                } else {
                    email += generateLetter();
                }
            } else {
                email += words[generateInt(0, words.length)];
            }
        }
        return email;
    }

    function generateMessages(words) {
        let messages = {};

        for (let i = 0; i < 10; ++i) {
            messages[i] = {
                from: generateEmail(words),
                to: generateEmail(words),
            };
        }

        return messages;
    }

    function generateRules(words) {
        let rules = new Array(10);

        for (let i = 0; i < rules.length; ++i) {
            rules[i] = {
                from: generateEmail(words),
                to: generateEmail(words),
                action: generateWord(),
            };
        }

        return rules;
    }

    let words = generateWords();
    return {
        messages: generateMessages(words),
        rules: generateRules(words),
    };
}

function resultsEqual(a, b) {
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

let filter = require('./filter');
let referenceFilter = require('./referenceFilter');

function runTests(times) {
    if (times === 0) {
        return;
    }

    let args = generateArguments();
    let res = filter(args.messages, args.rules);
    referenceFilter(args, referenceRes => {
        console.log('\n\n\n---------------');
        console.log(args);
        console.log(res);
        if (!resultsEqual(res, referenceRes)) {
            console.log('\n\n\nMISMATCH!\nReference returned:\n', referenceRes);
            return;
        }
        runTests((times === undefined) ? undefined : times - 1);
    });
}

runTests();

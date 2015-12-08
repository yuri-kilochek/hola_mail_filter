'use strict';

function compilePatternsToNfa(patterns) {
    function normalizePattern(pattern) {
        while (true) {
            let newPattern = pattern.replace('*?', '?*');
            if (newPattern === pattern) {
                break;
            }
            pattern = newPattern;
        }
        while (true) {
            let newPattern = pattern.replace('**', '*');
            if (newPattern === pattern) {
                break;
            }
            pattern = newPattern;
        }
        return pattern;
    }

    let nfa = {};

    let states = [];
    function addState(state) {
        states.push(state);
        return state;
    }

    nfa.initials = [];
    for (let i = 0; i < patterns.length; ++i) {
        let pattern = patterns[i];

        let initials = [addState({
            gate: null,
            targets: [],
            finish: i,
        })];

        pattern = normalizePattern(pattern);
        for (let j = pattern.length - 1; j >= 0; --j) {
            let symbol = pattern.charAt(j);
            switch (symbol) {
              case '*':
                initials.unshift(addState({
                    gate: null,
                    targets: initials,
                    finish: null,
                }));
                break;
              case '?':
                initials = [addState({
                    gate: null,
                    targets: initials,
                    finish: null,
                })];
                break;
              default:
                initials = [addState({
                    gate: symbol,
                    targets: initials,
                    finish: null,
                })];
            }
        }

        nfa.initials.push(...initials);
    }

    if (states.length > 0) {
        let id = new Uint16Array(Math.ceil(Math.log(states.length) / Math.log(0x10000)));
        for (let state of states) {
            state.id = String.fromCharCode(...id);
            for (let i = id.length - 1; i >= 0; --i) {
                if (++id[i] !== 0) {
                    break;
                }
            }
        }
    }

    return nfa;
}

module.exports = compilePatternsToNfa;


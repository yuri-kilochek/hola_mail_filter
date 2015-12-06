'use strict';

function convertNfaToDfa(nfa) {
    let dfa = {};

    dfa.states = [];

    let getStateNoFor; {
        let noById = new Map();

        getStateNoFor = function getStateNoFor(nfaStates) {
            let id = nfaStates.map(s => s.id);
            id.sort();
            id = id.join('');

            let no = noById.get(id);
            if (no === undefined) {
                no = dfa.states.push({
                    defaultTarget: null,
                    targetFor: Object.create(null),
                    finishes: new Set(),
                    nfaStates: nfaStates,
                }) - 1;
                noById.set(id, no);
            }
            return no;
        };
    }
    
    getStateNoFor(nfa.initials);
    for (let state of dfa.states) {
        let defaultTargets = new Set();
        let targetsForSymbols = new Map();
        for (let nfaState of state.nfaStates) {
            if (nfaState.symbol === null) {
                for (let target of nfaState.targets) {
                    for (let targetsForSymbol of targetsForSymbols.values()) {
                        targetsForSymbol.add(target);
                    }
                    defaultTargets.add(target);
                }
            } else {
                let targetsForSymbol = targetsForSymbols.get(nfaState.symbol);
                if (targetsForSymbol === undefined) {
                    targetsForSymbol = new Set(defaultTargets);
                    targetsForSymbols.set(nfaState.symbol, targetsForSymbol);
                }
                for (let target of nfaState.targets) {
                    targetsForSymbol.add(target);
                }
            }

            for (let finish of nfaState.finishes) {
                state.finishes.add(finish);
            }
        }

        state.defaultTarget = getStateNoFor(Array.from(defaultTargets));
        for (let kv of targetsForSymbols) {
            let symbol = kv[0];
            let targetsForSymbol = kv[1];
            let targetForSymbol = getStateNoFor(Array.from(targetsForSymbol));
            if (targetForSymbol !== state.defaultTarget) {
                state.targetFor[symbol] = targetForSymbol;
            }
        }

        delete state.nfaStates;
    }

    return dfa;
}

function compilePatternsToNfa(patterns) {
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
            symbol: null,
            targets: [],
            finishes: [i],
        })];

        for (let j = pattern.length - 1; j >= 0; --j) {
            let symbol = pattern.charAt(j);

            switch (symbol) {
              case '*':
                initials.unshift(addState({
                    symbol: null,
                    targets: initials,
                    finishes: [],
                }));
                initials = [...initials];
                break;
              case '?':
                initials = [addState({
                    symbol: null,
                    targets: initials,
                    finishes: [],
                })];
                break;
              default:
                initials = [addState({
                    symbol: symbol,
                    targets: initials,
                    finishes: [],
                })];
            }
        }

        nfa.initials.push(...initials);
    }

    if (states.length > 0) {
        let id = new Uint16Array(Math.ceil(Math.log(states.length) / Math.log(0x10000)));
        for (let state of states) {
            state.id = String.fromCharCode(...id);
            for (let i = id.length - 1; i >= 0; ++i) {
                if (++id[i] !== 0) {
                    break;
                }
            }
        }
    }

    return nfa;
}

function dfaFilter(messages, rules) {
    let fromTransitions, toTransitionss, actionSequencess; {
        console.time('dfa');
        let fromNfa = compilePatternsToNfa(rules.map(r => r.from || '*'));
        let fromDfa = convertNfaToDfa(fromNfa);
        fromTransitions = new Array(fromDfa.states.length);
        toTransitionss = new Array(fromDfa.states.length);
        actionSequencess = new Array(fromDfa.states.length);
        for (let i = 0; i < fromDfa.states.length; ++i) {
            fromTransitions[i] = new Uint32Array(0x80 - 0x20);
            fromTransitions[i].fill(fromDfa.states[i].defaultTarget);
            for (let symbol in fromDfa.states[i].targetFor) {
                let target = fromDfa.states[i].targetFor[symbol];
                fromTransitions[i][symbol.charCodeAt(0) - 0x20] = target;
            }
            let partialRules = Array.from(fromDfa.states[i].finishes).sort().map(i => rules[i]);
            let toNfa = compilePatternsToNfa(partialRules.map(r => r.to || '*'));
            let toDfa = convertNfaToDfa(toNfa);
            toTransitionss[i] = new Array(toDfa.states.length)
            actionSequencess[i] = new Array(toDfa.states.length);
            for (let j = 0; j < toDfa.states.length; ++j) {
                toTransitionss[i][j] = new Uint32Array(0x80 - 0x20);
                toTransitionss[i][j].fill(toDfa.states[j].defaultTarget);
                for (let symbol in toDfa.states[j].targetFor) {
                    let target = toDfa.states[j].targetFor[symbol];
                    toTransitionss[i][j][symbol.charCodeAt(0) - 0x20] = target;
                }
                actionSequencess[i][j] = Array.from(toDfa.states[j].finishes).sort().map(i => partialRules[i].action);
            }
        }
        console.timeEnd('dfa');
    }

    let output = {};
    for (let id in messages) {
        let message = messages[id];

        let fromState = 0;

        let messageFrom = message.from;
        let messageFromLength = messageFrom.length;
        for (let i = 0; i < messageFromLength; ++i) {
            let symbol = messageFrom.charCodeAt(i) - 0x20;
            fromState = fromTransitions[fromState][symbol];
        }

        let toTransitions = toTransitionss[fromState];

        let toState = 0;

        let messageTo = message.to;
        let messageToLength = messageTo.length;
        for (let i = 0; i < messageToLength; ++i) {
            let symbol = messageTo.charCodeAt(i) - 0x20;
            toState = toTransitions[toState][symbol];
        }

        output[id] = actionSequencess[fromState][toState];
    }
    return output;
}

exports.dfaFilter = dfaFilter;

module.exports = dfaFilter;

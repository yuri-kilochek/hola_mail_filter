'use strict';

function convertNfaToDfa(nfa) {
    let dfa = {};

    dfa.states = [];

    let getStateNoFor; {
        let noById = new Map();

        getStateNoFor = function getStateNoFor(nfaStates) {
            let id = [];
            for (let nfaState of nfaStates) {
                id.push(nfaState.id);
            }
            id.sort();
            id = id.join('');

            let no = noById.get(id);
            if (no === undefined) {
                no = dfa.states.push({
                    targetForSymbols: Object.create(null),
                    defaultTarget: undefined,
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
        let targetsForSymbols = new Map();
        let defaultTargets = new Set();
        for (let nfaState of state.nfaStates) {
            if (nfaState.symbol !== null) {
                let targetsForSymbol = targetsForSymbols.get(nfaState.symbol);
                if (targetsForSymbol === undefined) {
                    targetsForSymbol = new Set(defaultTargets);
                    targetsForSymbols.set(nfaState.symbol, targetsForSymbol);
                }
                for (let target of nfaState.targets) {
                    targetsForSymbol.add(target);
                }
            } else {
                for (let target of nfaState.targets) {
                    for (let targetsForSymbol of targetsForSymbols.values()) {
                        targetsForSymbol.add(target);
                    }
                    defaultTargets.add(target);
                }
            }

            for (let finish of nfaState.finishes) {
                state.finishes.add(finish);
            }
        }

        for (let kv of targetsForSymbols) {
            let symbol = kv[0];
            let targetsForSymbol = kv[1];
            state.targetForSymbols[symbol] = getStateNoFor(Array.from(targetsForSymbol));
        }
        state.defaultTarget = getStateNoFor(Array.from(defaultTargets));

        delete state.nfaStates;
    }

    return dfa;
}

//function minimizeDfa(dfa) {
//    let mdfa = {};
//
//    let alphabetSize = mdfa.alphabetSize = dfa.alphabetSize;
//
//    let finality = mdfa.finality = dfa.finality;
//    
//    let distinct = new Array(dfa.states.length);
//    for (let i = 0; i < dfa.states.length; ++i) {
//        distinct[i] = new Uint8Array(i);
//    }
//
//    for (let i = 0; i < dfa.states.length; ++i) {
//        let iFinality = dfa.states[i].finality;
//        for (let j = 0; j < i; ++j) {
//            let jFinality = dfa.states[j].finality;
//            distinct[i][j] = (iFinality !== jFinality);
//        }
//    }
//
//    let newAdded = true;
//    while (newAdded) {
//        newAdded = false;
//        for (let i = 0; i < dfa.states.length; ++i) {
//            for (let j = 0; j < i; ++j) {
//                if (!distinct[i][j]) {
//                    for (let symbol = 0; symbol < alphabetSize; ++symbol) {
//                        let ii = dfa.states[i].transitions[symbol];
//                        let jj = dfa.states[j].transitions[symbol];
//                        if (distinct[ii][jj]) {
//                            distinct[i][j] = true;
//                            newAdded = true;
//                            break;
//                        }
//                    }
//                }
//            }
//        }
//    }
//    
//    let classExemplars = [];
//    let classes = new Uint32Array(dfa.states.length);
//  classes:
//    for (let i = 0; i < dfa.states.length; ++i) {
//        for (let j = 0; j < i; ++j) {
//            if (!distinct[i][j]) {
//                classes[i] = classes[j];
//                continue classes;
//            }
//        }
//        classes[i] = classExemplars.push(dfa.states[i]) - 1;
//    }
//
//    mdfa.states = new Array(classExemplars.length);
//    for (let i = 0; i < mdfa.states.length; ++i) {
//        let classExemplar = classExemplars[i];
//        mdfa.states[i] = {
//            finality: classExemplar.finality,
//            transitions: (() => {
//                let transitions = new Uint32Array(alphabetSize);
//                for (let symbol = 0; symbol < alphabetSize; ++symbol) {
//                    transitions[symbol] = classes[classExemplar.transitions[symbol]];
//                }
//                return transitions;
//            })(),
//        };
//    }
//
//    return mdfa;
//}

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
                initials = initials.slice();
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
        let fromNfa = compilePatternsToNfa(rules.map(r => r.from));
        let fromDfa = convertNfaToDfa(fromNfa);
        console.timeEnd('dfa');
        fromTransitions = new Array(fromDfa.states.length);
        toTransitionss = new Array(fromDfa.states.length);
        actionSequencess = new Array(fromDfa.states.length);
        for (let i = 0; i < fromDfa.states.length; ++i) {
            fromTransitions[i] = new Uint32Array(0x80 - 0x20);
            fromTransitions[i].fill(fromDfa.states[i].defaultTarget);
            for (let symbol in fromDfa.states[i].targetForSymbols) {
                let target = fromDfa.states[i].targetForSymbols[symbol];
                fromTransitions[i][symbol.charCodeAt(0) - 0x20] = target;
            }
            let partialRules = Array.from(fromDfa.states[i].finishes).sort().map(i => rules[i]);
            let toNfa = compilePatternsToNfa(partialRules.map(r => r.to));
            let toDfa = convertNfaToDfa(toNfa);
            toTransitionss[i] = new Array(toDfa.states.length)
            actionSequencess[i] = new Array(toDfa.states.length);
            for (let j = 0; j < toDfa.states.length; ++j) {
                toTransitionss[i][j] = new Uint32Array(0x80 - 0x20);
                toTransitionss[i][j].fill(toDfa.states[j].defaultTarget);
                for (let symbol in toDfa.states[j].targetForSymbols) {
                    let target = toDfa.states[j].targetForSymbols[symbol];
                    toTransitionss[i][j][symbol.charCodeAt(0) - 0x20] = target;
                }
                actionSequencess[i][j] = Array.from(toDfa.states[j].finishes).sort().map(i => partialRules[i].action);
            }
        }
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

function charSwitchFilter(messages, rules) {
    let filter;
    let actionSequences; {
        let nfa = compileRulesToNfa(rules);
        let dfa = convertNfaToDfa(nfa);
        //dfa = minimizeDfa(dfa);

        function isTrap(stateId) {
            let transitions = dfa.states[stateId].transitions;
            for (let symbol of dfa.symbols) {
                if (transitions[symbol] !== stateId) {
                    return false;
                }
            }
            return true;
        }

        function getMostCommonTarget(stateId) {
            let times = Object.create(null);
            let transitions = dfa.states[stateId].transitions;
            for (let symbol of dfa.symbols) {
                let target = transitions[symbol];
                times[target] = (times[target] || 0) + 1;
            }
            let mostCommonTarget = transitions['\x1F'];
            let maxTimes = times[mostCommonTarget] || 0;
            for (let target in times) {
                target |= 0;
                if (times[target] > maxTimes) {
                    mostCommonTarget = target;
                }
            }
            return mostCommonTarget;
        }

        let code = `
            'use strict';

            let output = {};
            for (let id in messages) {
                let message = messages[id];

                let signature = message.from + '\x1F' + message.to;
                let signatureLength = signature.length;

                let state = 0;
              characters:
                for (let i = 0; i < signatureLength; ++i) {
                    switch (state) {
        `;

        for (let stateId = 0; stateId < dfa.states.length; ++stateId) {
            if (isTrap(stateId)) {
                code += `
                      case ${stateId}:
                        break characters;
                `;
                continue;
            }

            let mostCommonTarget = getMostCommonTarget(stateId);

            code += `
                      case ${stateId}:
                        switch (signature[i]) {
            `;

            for (let symbol of dfa.symbols) {
                let target = dfa.states[stateId].transitions[symbol];
                if (target !== mostCommonTarget) {
                    code += `
                          case '\\x${symbol.charCodeAt(0).toString(16)}':
                            state = ${target};
                            continue characters;
                    `;
                }
            }

            code += `
                          default:
                            state = ${mostCommonTarget};
                            continue characters;
                        }    
            `;
        }

        code += `
                    }
                }
                output[id] = actionSequences[state];
            }
            return output;
        `;

        filter = new Function('messages', 'rules', 'actionSequences', code);

        actionSequences = new Array(dfa.states.length);
        for (let stateId = 0; stateId < dfa.states.length; ++stateId) {
            actionSequences[stateId] = dfa.states[stateId].finality.getActionSequence();
        }
    }

    return filter(messages, rules, actionSequences);
}

exports.charSwitchFilter = charSwitchFilter;

module.exports = dfaFilter;

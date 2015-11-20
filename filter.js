'use strict';

function convertNfaToDfa(nfa) {
    let dfa = {};

    let symbolCount = dfa.symbolCount = nfa.symbolCount;
    dfa.stateCount = 0;
    dfa.transitions = [];
    dfa.finishes = [];

    let nfaStateIdsToStateId = new Map();
    let pending = [];

    function getState(nfaStateIds) {
        let key = Array.from(nfaStateIds).sort().join(',');
        let stateId = nfaStateIdsToStateId.get(key);
        if (stateId === undefined) {
            stateId = dfa.stateCount++;
            dfa.transitions.push(new Uint32Array(symbolCount));
            dfa.finishes.push(new Set());

            nfaStateIdsToStateId.set(key, stateId);
            pending.push({
                stateId,
                nfaStateIds,
            });
        }
        return stateId;
    }
    
    getState(new Set([0]));
    while (true) {
        let stateId, nfaStateIds; {
            let box = pending.pop();
            if (box === undefined) {
                break;
            }
            stateId = box.stateId;
            nfaStateIds = box.nfaStateIds;
        }

        let finishes = dfa.finishes[stateId];
        for (let nfaStateId of nfaStateIds) {
            for (let finish of nfa.finishes[nfaStateId]) {
                finishes.add(finish);
            }
        }

        let transitions = dfa.transitions[stateId];
        for (let symbol = 0; symbol < symbolCount; ++symbol) {
            let targetNfaStateIds = new Set();
            for (let nfaStateId of nfaStateIds) {
                for (let targetNfaStateId of nfa.transitions[nfaStateId][symbol]) {
                    targetNfaStateIds.add(targetNfaStateId);
                }
            }
            transitions[symbol] = getState(targetNfaStateIds);
        }
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

    let symbolCount = nfa.symbolCount = 0x80 - 0x20;
    nfa.stateCount = 0;
    nfa.transitions = [];
    nfa.finishes = [];

    function addState() {
        let stateId = nfa.stateCount++;
        nfa.transitions.push((() => {
            let transitions = new Array(symbolCount);
            for (let i = 0; i < symbolCount; ++i) {
                transitions[i] = new Set();
            }
            return transitions;
        })());
        nfa.finishes.push(new Set());
        return stateId;
    }

    function addTransition(fromId, via, toId) {
        nfa.transitions[fromId][via].add(toId);
    }

    let initialId = addState();
    for (let patternId = 0; patternId < patterns.length; ++patternId) {
        let pattern = patterns[patternId];
        
        let tailIds = [initialId];
        for (let character of pattern) {
            if (character === '*') {
                let newId = addState();
                for (let tailId of tailIds) {
                    for (let symbol = 0; symbol < symbolCount; ++symbol) {
                        addTransition(tailId, symbol, newId);
                    }
                }
                for (let symbol = 0; symbol < symbolCount; ++symbol) {
                    addTransition(newId, symbol, newId);
                }
                tailIds.push(newId);
            } else if (character === '?') {
                let newId = addState();
                for (let tailId of tailIds) {
                    for (let symbol = 0; symbol < symbolCount; ++symbol) {
                        addTransition(tailId, symbol, newId);
                    }
                }
                tailIds = [newId];
            } else {
                let newId = addState();
                let symbol = character.charCodeAt(0) - 0x20;
                for (let tailId of tailIds) {
                    addTransition(tailId, symbol, newId);
                }
                tailIds = [newId];
            }
        }
        for (let tailId of tailIds) {
            nfa.finishes[tailId].add(patternId);
        }
    }

    return nfa;
}

function dfaFilter(messages, rules) {
    let fromTransitions, toTransitionss, actionSequencess; {
        let fromNfa = compilePatternsToNfa(rules.map(r => r.from));
        let fromDfa = convertNfaToDfa(fromNfa);
        fromTransitions = fromDfa.transitions;

        toTransitionss = new Array(fromDfa.stateCount);
        actionSequencess = new Array(fromDfa.stateCount);
        for (let i = 0; i < fromDfa.stateCount; ++i) {
            let partialRules = Array.from(fromDfa.finishes[i]).sort().map(i => rules[i]);
            let toNfa = compilePatternsToNfa(partialRules.map(r => r.to));
            let toDfa = convertNfaToDfa(toNfa);
            toTransitionss[i] = toDfa.transitions;
            let actionSequences = actionSequencess[i] = new Array(toDfa.stateCount);
            for (let j = 0; j < toDfa.stateCount; ++j) {
                actionSequences[j] = Array.from(toDfa.finishes[j]).sort().map(i => partialRules[i].action);
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

'use strict';

function convertNfaToDfa(nfa) {
    let dfa = {};

    let symbols = dfa.symbols = nfa.symbols;

    let Finality = dfa.Finality = nfa.Finality;

    dfa.states = []; {
        function expandClosure(nfaStateIdSet) {
            let stack = Object.keys(nfaStateIdSet);
            while (stack.length !== 0) {
                let nfaStateId = stack.pop();
                for (let newNfaStateId of nfa.states[nfaStateId].transitions[''] || []) {
                    if (!nfaStateIdSet[newNfaStateId]) {
                        nfaStateIdSet[newNfaStateId] = true;
                        stack.push(newNfaStateId);
                    }
                }
            }
        }
 
        let nfaStateIdSetToStateId = Object.create(null);

        let initialNfaStateIdSet = Object.create(null);
        initialNfaStateIdSet[0] = true;
        expandClosure(initialNfaStateIdSet);
        initialNfaStateIdSet = Object.keys(initialNfaStateIdSet);
        initialNfaStateIdSet.sort();

        let key = initialNfaStateIdSet.join();
        nfaStateIdSetToStateId[key] = dfa.states.push({
            nfaStateIdSet: initialNfaStateIdSet,
        }) - 1;
        for (let state of dfa.states) {
            state.finality = new Finality();
            for (let nfaStateId of state.nfaStateIdSet) {
                state.finality.assignOr(nfa.states[nfaStateId].finality);
            }

            state.transitions = Object.create(null);
            for (let symbol of symbols) {
                let targetNfaStateIdSet = Object.create(null);
                for (let nfaStateId of state.nfaStateIdSet) {
                    for (let targetNfaStateId of nfa.states[nfaStateId].transitions[symbol] || []) {
                        targetNfaStateIdSet[targetNfaStateId] = true;
                    }
                }
                expandClosure(targetNfaStateIdSet);
                targetNfaStateIdSet = Object.keys(targetNfaStateIdSet);
                targetNfaStateIdSet.sort();

                let key = targetNfaStateIdSet.join();
                let targetStateId = nfaStateIdSetToStateId[key];
                if (targetStateId === undefined) {
                    targetStateId = nfaStateIdSetToStateId[key] = dfa.states.push({
                        nfaStateIdSet: targetNfaStateIdSet,
                    }) - 1;
                }
                
                state.transitions[symbol] = targetStateId;
            }

            delete state.nfaStateIdSet;
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

function compileRulesToNfa(rules) {
    let nfa = {};

    let symbols = nfa.symbols = []; 
    for (let charCode = 0x1F; charCode < 0x80; ++charCode) {
        let symbol = String.fromCharCode(charCode);
        symbols.push(symbol);
    }

    let Finality = nfa.Finality = (() => {
        let actionSequences = Object.create(null);

        let blockCount = Math.ceil(rules.length / 32);

        class Finality {
            constructor() {
                this._blocks = new Uint32Array(blockCount);
            }

            assignOr(that) {
                if (that !== Finality.false) {
                    let thisBlocks = this._blocks;
                    let thatBlocks = that._blocks;
                    for (let i = 0; i < blockCount; ++i) {
                        thisBlocks[i] |= thatBlocks[i];
                    }
                }
                return this;
            }

            set(i) {
                this._blocks[i >>> 5] |= 1 << (i & 0x1F);
                return this;
            }

            getActionSequence() {
                let blocks = this._blocks;
                let key = blocks.join();
                let actionSequence = actionSequences[key];
                if (actionSequence === undefined) {
                    actionSequence = actionSequences[key] = [];
                    for (let i = 0; i < blockCount; ++i) {
                        let block = blocks[i];
                        if (block) {
                            let limit = Math.min(32, rules.length - i * 32);
                            for (let j = 0; j < limit; ++j) {
                                if ((block >>> j) & 1) {
                                    actionSequence.push(rules[i * 32 + j].action);
                                }
                            }
                        }
                    }
                }
                return actionSequence;
            }
        }

        Finality.false = new Finality();

        return Finality;
    })();

    nfa.states = []; {
        let preLastId = null;
        let lastId = null;
        function addState() {
            preLastId = lastId;
            lastId = nfa.states.push({
                finality: Finality.false,
                transitions: {},
            }) - 1;
        }

        function addTransition(fromId, via, toId) {
            let toIds = nfa.states[fromId].transitions[via];
            if (toIds === undefined) {
                toIds = nfa.states[fromId].transitions[via] = [];
            }
            toIds.push(toId);
        }

        addState();
        for (let i = 0; i < rules.length; ++i) {
            let rule = rules[i];

            let pattern = (rule.from || '*') + '\x1F' + (rule.to || '*');
            
            addState();
            addTransition(0, '', lastId);
            for (let symbol of pattern) {
                addState();
                if (symbol === '*') {
                    addTransition(preLastId, '', lastId);
                    for (let symbol of symbols) {
                        if (symbol !== '\x1F') {
                            addTransition(lastId, symbol, lastId);
                        }
                    }
                } else if (symbol === '?') {
                    for (let symbol of symbols) {
                        if (symbol !== '\x1F') {
                            addTransition(preLastId, symbol, lastId);
                        }
                    }
                } else {
                    addTransition(preLastId, symbol, lastId);
                }
            }
            nfa.states[lastId].finality = new Finality().set(i);
        }
    }

    return nfa;
}

function dfaFilter(messages, rules) {
    let transitions;
    let actionSequences; {
        let nfa = compileRulesToNfa(rules);
        let dfa = convertNfaToDfa(nfa);

        //dfa = minimizeDfa(dfa);

        transitions = new Array(dfa.states.length);
        actionSequences = new Array(dfa.states.length);
        for (let stateId = 0; stateId < dfa.states.length; ++stateId) {
            transitions[stateId] = dfa.states[stateId].transitions;
            actionSequences[stateId] = dfa.states[stateId].finality.getActionSequence();
        }
    }

    let output = {};
    for (let id in messages) {
        let message = messages[id];

        let signature = message.from + '\x1F' + message.to;
        let signatureLength = signature.length;

        let state = 0;
        for (let i = 0; i < signatureLength; ++i) {
            let symbol = signature[i];
            state = transitions[state][symbol];
        }
        output[id] = actionSequences[state];
    }
    return output;
}

function filter(messages, rules) {
    return dfaFilter(messages, rules);
}

filter.filter = filter;

module.exports = filter;


'use strict';

function convertNfaToDfa(nfa) {
    function expandClosure(states) {
        for (let state of states) {
            for (let newState of nfa.states[state].transitions[-1] || []) {
                states.add(newState);
            }
        }
    }

    let dfa = {};

    let alphabetSize = dfa.alphabetSize = nfa.alphabetSize;

    let finality = dfa.finality = nfa.finality;

    dfa.states = [{ nfaStates: new Set([0]) }];
    expandClosure(dfa.states[0].nfaStates);
    for (let state of dfa.states) {
        state.finality = finality.makeFalse();
        for (let nfaState of state.nfaStates) {
            finality.assignOr(state.finality, nfa.states[nfaState].finality);
        }
        for (let olderState of dfa.states) {
            if (olderState.finality === state.finality) {
                break;
            }
            if (finality.areEqual(olderState.finality, state.finality)) {
                state.finality = olderState.finality;
                break;
            }
        }

        state.transitions = new Uint32Array(alphabetSize);
      symbols:
        for (let symbol = 0; symbol < alphabetSize; ++symbol) {
            let targetNfaStates = new Set();
            for (let nfaState of state.nfaStates) {
                for (let targetNfaState of nfa.states[nfaState].transitions[symbol] || []) {
                    targetNfaStates.add(targetNfaState);
                }
            }
            expandClosure(targetNfaStates);

            function areEqualSets(as, bs) {
                for (let a of as) {
                    if (!bs.has(a)) {
                        return false;
                    }
                }
                for (let b of bs) {
                    if (!as.has(b)) {
                        return false;
                    }
                }
                return true;
            }

            for (let i = 0; i < dfa.states.length; ++i) {
                if (areEqualSets(dfa.states[i].nfaStates, targetNfaStates)) {
                    state.transitions[symbol] = i;
                    continue symbols;
                }
            }
            state.transitions[symbol] = dfa.states.push({ nfaStates: targetNfaStates }) - 1;
        }
    }
    for (let state of dfa.states) {
        delete state.nfaStates;
    }

    return dfa;
}

function minimizeDfa(dfa) {
    let mdfa = {};

    let alphabetSize = mdfa.alphabetSize = dfa.alphabetSize;

    let finality = mdfa.finality = dfa.finality;
    
    let distinct = new Array(dfa.states.length);
    for (let i = 0; i < dfa.states.length; ++i) {
        distinct[i] = new Uint8Array(i);
    }

    for (let i = 0; i < dfa.states.length; ++i) {
        let iFinality = dfa.states[i].finality;
        for (let j = 0; j < i; ++j) {
            let jFinality = dfa.states[j].finality;
            distinct[i][j] = (iFinality !== jFinality);
        }
    }

    let newAdded = true;
    while (newAdded) {
        newAdded = false;
        for (let i = 0; i < dfa.states.length; ++i) {
            for (let j = 0; j < i; ++j) {
                if (!distinct[i][j]) {
                    for (let symbol = 0; symbol < alphabetSize; ++symbol) {
                        let ii = dfa.states[i].transitions[symbol];
                        let jj = dfa.states[j].transitions[symbol];
                        if (distinct[ii][jj]) {
                            distinct[i][j] = true;
                            newAdded = true;
                            break;
                        }
                    }
                }
            }
        }
    }
    
    let classExemplars = [];
    let classes = new Uint32Array(dfa.states.length);
  classes:
    for (let i = 0; i < dfa.states.length; ++i) {
        for (let j = 0; j < i; ++j) {
            if (!distinct[i][j]) {
                classes[i] = classes[j];
                continue classes;
            }
        }
        classes[i] = classExemplars.push(dfa.states[i]) - 1;
    }

    mdfa.states = new Array(classExemplars.length);
    for (let i = 0; i < mdfa.states.length; ++i) {
        let classExemplar = classExemplars[i];
        mdfa.states[i] = {
            finality: classExemplar.finality,
            transitions: (() => {
                let transitions = new Uint32Array(alphabetSize);
                for (let symbol = 0; symbol < alphabetSize; ++symbol) {
                    transitions[symbol] = classes[classExemplar.transitions[symbol]];
                }
                return transitions;
            })(),
        };
    }

    return mdfa;
}

function compileRulesToNfa(rules) {
    let nfa = {};

    nfa.alphabetSize = 0x80 - 0x1F;

    nfa.finality = (() => {
        let finality = {};

        let blockCount = Math.ceil(rules.length / 32);

        finality.makeFalse = () => {
            return new Uint32Array(blockCount);
        };

        finality._false = finality.makeFalse();

        finality._makeTrueAt = (index) => {
            let blocks = finality.makeFalse();
            blocks[Math.floor(index / 32)] |= 1 << (index % 32);
            return blocks;
        };

        finality.assignOr = (left, right) => {
            if (right !== finality._false) {
                for (let i = 0; i < blockCount; ++i) {
                    left[i] |= right[i];
                }
            }
        };

        finality.areEqual = (left, right) => {
            for (let i = 0; i < blockCount; ++i) {
                if (left[i] !== right[i]) {
                    return false;
                }
            }
            return true;
        };

        finality._unpack = (blocks) => {
            let actions = [];
            for (let i = 0; i < blockCount; ++i) {
                let block = blocks[i];
                if (block) {
                    let limit = Math.min(32, rules.length - i * 32);
                    for (let j = 0; j < limit; ++j) {
                        if ((block >>> j) & 1) {
                            actions.push(rules[i * 32 + j].action);
                        }
                    }
                }
            }
            return actions;
        }

        return finality;
    })();

    nfa.states = [];
    function addState() {
        nfa.states.push({
            finality: nfa.finality._false,
            transitions: {},
        });
    }
    function addTransition(from, via, to) {
        let toList = nfa.states[from].transitions[via];
        if (toList === undefined) {
            toList = nfa.states[from].transitions[via] = [];
        }
        toList.push(to);
    }
    addState();
    for (let i = 0; i < rules.length; ++i) {
        let rule = rules[i];

        let pattern = ((rule.from || '*') + '\x1F' + (rule.to || '*')).split('')
            .map(c => c.charCodeAt(0) - 0x1F)
        ;
        
        addState();
        addTransition(0, -1, nfa.states.length - 1);
        for (let symbol of pattern) {
            switch (symbol) {
              case '*'.charCodeAt(0) - 0x1F:
                addState();
                addTransition(nfa.states.length - 2, -1, nfa.states.length - 1);
                for (let charCode = 0x20; charCode < 0x80; ++charCode) {
                    let symbol = charCode - 0x1F;
                    addTransition(nfa.states.length - 1, symbol, nfa.states.length - 1);
                }
                break;
              case '?'.charCodeAt(0) - 0x1F:
                addState();
                for (let charCode = 0x20; charCode < 0x80; ++charCode) {
                    let symbol = charCode - 0x1F;
                    addTransition(nfa.states.length - 2, symbol, nfa.states.length - 1);
                }
                break;
              default:
                addState();
                addTransition(nfa.states.length - 2, symbol, nfa.states.length - 1);
            }
        }
        nfa.states[nfa.states.length - 1].finality = nfa.finality._makeTrueAt(i);
    }

    return nfa;
}

function dfaFilter(messages, rules) {
    let alphabetSize;
    let transitions;
    let actionSequences;
    {
        let nfa = compileRulesToNfa(rules);
        let dfa = convertNfaToDfa(nfa);
        //dfa = minimizeDfa(dfa);

        alphabetSize = dfa.alphabetSize;
        transitions = new Array(dfa.states.length);
        actionSequences = new Array(dfa.states.length);
      states:
        for (let state = 0; state < dfa.states.length; ++state) {
            transitions[state] = dfa.states[state].transitions;
            for (let previousState = 0; previousState < state; ++previousState) {
                if (dfa.states[state].finality === dfa.states[previousState].finality) {
                    actionSequences[state] = actionSequences[previousState];
                    continue states;
                }
            }
            actionSequences[state] = dfa.finality._unpack(dfa.states[state].finality);
        }
    }

    let output = {};
    for (let id in messages) {
        let message = messages[id];

        let signature = message.from + '\x1F' + message.to;
        let signatureLength = signature.length;

        let state = 0;
        for (let i = 0; i < signatureLength; ++i) {
            let symbol = signature.charCodeAt(i) - 0x1F;
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


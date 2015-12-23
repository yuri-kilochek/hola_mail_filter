/*
 * Written by Yuri Kilochek <yuri.kilochek@gmail.com>
 * for Hola's "JS challenge Winter 2015: Mail Filtering Engine"
 * at http://hola.org/challenge_mail_filter
 */

'use strict';

function normalizePattern(pattern) {
    return pattern.replace(/\*+(?:\?+\**)*/g, symbols => {
        let normalizedSymbols = '';
        for (let symbolIndex = symbols.indexOf('?'); symbolIndex !== -1; symbolIndex = symbols.indexOf('?', symbolIndex + 1)) {
            normalizedSymbols += '?';
        }

        return normalizedSymbols + '*';
    });
}

class NfaState {
    constructor(id, finish) {
        this.id = id;
        this.finish = finish;
        this.valve = null;
        this.target = null;
        this.otherTarget = null;
    }
}

class Nfa {
    constructor(finishs, extractPattern) {
        let stateCount = 0;
        let initialStates = [];
        for (let finishCount = finishs.length, finishIndex = 0; finishIndex < finishCount; ++finishIndex) {
            let finish = finishs[finishIndex];

            let pattern = extractPattern(finish);
            pattern = normalizePattern(pattern);

            stateCount += pattern.length + 1;
            let stateId = stateCount;

            let initialState = new NfaState(--stateId, finish);
            let otherInitialState = null;
            for (let symbolIndex = pattern.length - 1; symbolIndex >= 0; --symbolIndex) {
                let symbol = pattern[symbolIndex];

                let state = new NfaState(--stateId, null);
                if (symbol === '*') {
                    state.target = state;
                    state.otherTarget = initialState;
                    otherInitialState = initialState;
                } else {
                    if (symbol !== '?') {
                        state.valve = symbol;
                    }
                
                    state.target = initialState;
                    state.otherTarget = otherInitialState;
                    otherInitialState = null;
                }

                initialState = state;
            }

            initialStates.push(initialState);
            if (otherInitialState !== null) {
                initialStates.push(otherInitialState);
            }
        }

        this.stateCount = stateCount;
        this.initialStates = initialStates;
    }
}

class NfaStateSet {
    constructor(maxStateCount) {
        this.keyBuffer = new Buffer(maxStateCount << 2);
        this.states = new Array(maxStateCount);
        this.stateCount = 0;
    }

    add(newState) {
        let states = this.states;

        let newStateIndex = this.stateCount;
        let newStateId = newState.id;
        while (newStateIndex > 0) {
            let stateIndex = newStateIndex - 1;
            let stateId = states[stateIndex].id;

            if (stateId === newStateId) {
                return;
            }

            if (stateId < newStateId) {
                break;
            }

            newStateIndex = stateIndex;
        }

        let stateIndex = this.stateCount++;
        while (stateIndex > newStateIndex) {
            let previousStateIndex = stateIndex - 1;
            states[stateIndex] = states[previousStateIndex];
            stateIndex = previousStateIndex;
        }

        states[newStateIndex] = newState;
    }

    clear() {
        this.stateCount = 0;
    }

    getKey() {
        let states = this.states, stateCount = this.stateCount;

        let keyBuffer = this.keyBuffer;
        for (let stateIndex = 0; stateIndex < stateCount; ++stateIndex) {
            keyBuffer.writeUInt32LE(states[stateIndex].id, stateIndex << 2, true);
        }

        return keyBuffer.toString('utf16le', 0, stateCount << 2);
    }

    getSorted() {
        return this.states.slice(0, this.stateCount);
    }

    getSortedFinishs() {
        let states = this.states, stateCount = this.stateCount;

        let stateFinishs = new Array(stateCount);
        for (let stateIndex = 0; stateIndex < stateCount; ++stateIndex) {
            stateFinishs[stateIndex] = states[stateIndex].finish;
        }

        return stateFinishs;
    }
}

class DfaState {
    constructor(nfaStates) {
        this.nfaStates = nfaStates;
        this.combinedFinish = null;
        this.transitions = Object.create(null);
    }

    exit(dfa, nfaStateSet) {
        let combinedFinish = this.combinedFinish;
        if (combinedFinish === null) {
            let nfaStates = this.nfaStates;
            
            nfaStateSet.clear();

            for (let nfaStateCount = nfaStates.length, nfaStateIndex = 0; nfaStateIndex < nfaStateCount; ++nfaStateIndex) {
                let nfaState = nfaStates[nfaStateIndex];

                if (nfaState.finish !== null) {
                    nfaStateSet.add(nfaState);
                }
            }

            combinedFinish = this.combinedFinish = dfa.getCombinedFinish(nfaStateSet);
        }

        return combinedFinish;
    }

    step(dfa, nfaStateSet, symbol) {
        let transitions = this.transitions;

        let targetState = transitions[symbol];
        if (targetState === undefined) {
            let nfaStates = this.nfaStates;
           
            nfaStateSet.clear();

            for (let nfaStateCount = nfaStates.length, nfaStateIndex = 0; nfaStateIndex < nfaStateCount; ++nfaStateIndex) {
                let nfaState = nfaStates[nfaStateIndex];

                let nfaStateValve = nfaState.valve;
                if (nfaStateValve === null || nfaStateValve === symbol) {
                    let nfaStateTarget = nfaState.target;
                    if (nfaStateTarget !== null) {
                        nfaStateSet.add(nfaStateTarget);
                        let nfaStateOtherTarget = nfaState.otherTarget;
                        if (nfaStateOtherTarget !== null) {
                            nfaStateSet.add(nfaStateOtherTarget);
                        }
                    }
                }
            }

            targetState = transitions[symbol] = dfa.getState(nfaStateSet);
        }

        return targetState;
    }
}

class Dfa {
    constructor(finishs, extractPattern, combineFinishs) {
        let nfa = new Nfa(finishs, extractPattern);

        this.combineFinishs = combineFinishs;

        this.combinedFinishByKey = Object.create(null);
        this.stateByKey = Object.create(null);

        this.combinedFinishBySymbols = Object.create(null);

        let nfaStates = nfa.initialStates;

        let nfaStateSet = this.nfaStateSet = new NfaStateSet(nfa.stateCount);

        for (let nfaStateCount = nfaStates.length, nfaStateIndex = 0; nfaStateIndex < nfaStateCount; ++nfaStateIndex) {
            let nfaState = nfaStates[nfaStateIndex];
            nfaStateSet.add(nfaState);
        }

        this.initialState = this.getState(nfaStateSet);
    }

    getCombinedFinish(nfaStateSet) {
        let combinedFinishByKey = this.combinedFinishByKey;

        let key = nfaStateSet.getKey();

        let combinedFinish = combinedFinishByKey[key];
        if (combinedFinish === undefined) {
            let nfaStateFinishs = nfaStateSet.getSortedFinishs();
            combinedFinish = combinedFinishByKey[key] = this.combineFinishs(nfaStateFinishs);
        }

        return combinedFinish;
    }

    getState(nfaStateSet) {
        let stateByKey = this.stateByKey;

        let key = nfaStateSet.getKey();

        let state = stateByKey[key];
        if (state === undefined) {
            let nfaStates = nfaStateSet.getSorted();
            state = stateByKey[key] = new DfaState(nfaStates);
        }

        return state;
    }

    walk(symbols) {
        let combinedFinishBySymbols = this.combinedFinishBySymbols;

        let combinedFinish = combinedFinishBySymbols[symbols];
        if (combinedFinish === undefined) {
            let nfaStateSet = this.nfaStateSet;

            let state = this.initialState;
            for (let symbolCount = symbols.length, symbolIndex = 0; symbolIndex < symbolCount; ++symbolIndex) {
                let symbol = symbols[symbolIndex];
                state = state.step(this, nfaStateSet, symbol);
            }

            combinedFinish = combinedFinishBySymbols[symbols] = state.exit(this, nfaStateSet);
        }

        return combinedFinish;
    }
}

function filter(messages, rules) {
    let dfa = new Dfa(rules, (rule => rule.from || '*'), rules => {
        return new Dfa(rules, (rule => rule.to || '*'), rules => {
            return rules.map(rule => rule.action);
        });
    });

    for (let messageId in messages) {
        let message = messages[messageId];
        messages[messageId] = dfa.walk(message.from).walk(message.to);
    }

    return messages;
}

module.exports = filter.filter = filter;


/*
 * Written by Yuri Kilochek <yuri.kilochek@gmail.com>
 * for Hola's "JS challenge Winter 2015: Mail Filtering Engine"
 * at http://hola.org/challenge_mail_filter
 *
 * 2015-12-18
 */

'use strict';

function normalizePattern(pattern) {
    return pattern.replace(/\*+(?:\?+\**)*/g, symbols => {
        let normalizedSymbols = '';
        for (let i = symbols.indexOf('?'); i !== -1; i = symbols.indexOf('?', i + 1)) {
            normalizedSymbols += '?';
        }

        return normalizedSymbols + '*';
    });
}

class NfaState {
    constructor(id) {
        this.id = id;
        this.finish = null;
        this.valveSymbol = null;
        this.targetState = null;
        this.alternativeTargetState = null;
    }
}

class Nfa {
    constructor(finishs, extractPattern) {
        let nextStateId = 0;

        this.initialStates = [];
        for (let finish of finishs) {
            let pattern = extractPattern(finish);
            pattern = normalizePattern(pattern);

            let alternativeInitialState = null;
            let initialState = new NfaState(nextStateId++);
            initialState.finish = finish;
            for (let symbolIndex = pattern.length - 1; symbolIndex >= 0; --symbolIndex) {
                let symbol = pattern[symbolIndex];

                let state = new NfaState(nextStateId++);
                state.targetState = initialState;
                if (symbol === '*') {
                    state.alternativeTargetState = state;
                    alternativeInitialState = initialState;
                } else {
                    if (symbol !== '?') {
                        state.valveSymbol = symbol;
                    }
                
                    state.alternativeTargetState = alternativeInitialState;
                    alternativeInitialState = null;
                }

                initialState = state;
            }

            this.initialStates.push(initialState);
            if (alternativeInitialState !== null) {
                this.initialStates.push(alternativeInitialState);
            }
        }
    }
}

class DfaState {
    constructor(nfaStates) {
        this.nfaStates = nfaStates;
        this.combinedFinish = null;
        this.transitions = Object.create(null);
    }

    exit(dfa) {
        let combinedFinish = this.combinedFinish;
        if (combinedFinish === null) {
            let finishNfaStates = [];
            {
                let nfaStates = this.nfaStates, nfaStateCount = nfaStates.length;
                for (let nfaStateIndex = 0; nfaStateIndex < nfaStateCount; ++nfaStateIndex) {
                    let nfaState = nfaStates[nfaStateIndex];

                    if (nfaState.finish !== null) {
                        finishNfaStates.push(nfaState);
                    }
                }
            }

            combinedFinish = this.combinedFinish = dfa.getCombinedFinish(finishNfaStates);
        }

        return combinedFinish;
    }

    step(dfa, symbol) {
        let transitions = this.transitions;

        let targetState = transitions[symbol];
        if (targetState === undefined) {
            let targetNfaStates = [];
            {
                let nfaStates = this.nfaStates, nfaStateCount = nfaStates.length;
                for (let nfaStateIndex = 0; nfaStateIndex < nfaStateCount; ++nfaStateIndex) {
                    let nfaState = nfaStates[nfaStateIndex];

                    let nfaStateValveSymbol = nfaState.valveSymbol;
                    if (nfaStateValveSymbol === null || nfaStateValveSymbol === symbol) {
                        let nfaStateTargetState = nfaState.targetState;
                        if (nfaStateTargetState !== null) {
                            targetNfaStates.push(nfaStateTargetState);
                            let nfaStateAlternativeTargetState = nfaState.alternativeTargetState;
                            if (nfaStateAlternativeTargetState !== null) {
                                targetNfaStates.push(nfaStateAlternativeTargetState);
                            }
                        }
                    }
                }
            }

            targetState = transitions[symbol] = dfa.getState(targetNfaStates);
        }

        return targetState;
    }

}

function makeNfaStateIdKey(nfaStates) {
    return nfaStates.map(s => s.id).toString();
}

class Dfa {
    constructor(finishs, extractPattern, combineFinishs) {
        let nfa = new Nfa(finishs, extractPattern);

        this.combineFinishs = combineFinishs;

        this.combinedFinishs = Object.create(null);
        this.states = Object.create(null);

        this.initialState = this.getState(nfa.initialStates);

        this.cache = Object.create(null);
    }

    getCombinedFinish(nfaStates) {
        let key = makeNfaStateIdKey(nfaStates);

        let combinedFinish = this.combinedFinishs[key];
        if (combinedFinish === undefined) {
            let finishs = nfaStates.map(s => s.finish);
            combinedFinish = this.combinedFinishs[key] = this.combineFinishs(finishs);
        }

        return combinedFinish;
    }

    getState(nfaStates) {
        let key = makeNfaStateIdKey(nfaStates);

        let state = this.states[key];
        if (state === undefined) {
            state = this.states[key] = new DfaState(nfaStates);
        }

        return state;
    }

    walk(symbols) {
        let combinedFinish = this.cache[symbols];
        if (combinedFinish === undefined) {
            let state = this.initialState;
            {
                let symbolCount = symbols.length;
                for (let symbolIndex = 0; symbolIndex < symbolCount; ++symbolIndex) {
                    let symbol = symbols[symbolIndex];

                    state = state.step(this, symbol);
                }
            }

            combinedFinish = this.cache[symbols] = state.exit(this);
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


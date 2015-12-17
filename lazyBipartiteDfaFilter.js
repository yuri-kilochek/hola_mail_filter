'use strict';

function stringifyId(i, n) {
    if (n <= 0xFFFF) {
        return String.fromCharCode(0xFFFF & i);
    }

    return String.fromCharCode(0xFFFF & i >> 16,
                               0xFFFF & i);
}


class Nfa {
    constructor(patterns) {
        patterns = patterns.map(pattern => {
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
        });

        let stateCount = patterns.length;
        for (let pattern of patterns) {
            stateCount += pattern.length;
        }

        let nextStateId = 0;

        function makeState(finish, key, targets) {
            return {
                id: stringifyId(nextStateId++, stateCount),
                finish,
                key,
                targets,
            };
        }

        this.initialStates = [];
        for (let i = 0; i < patterns.length; ++i) {
            let pattern = patterns[i];

            let initialStates = [makeState({
                id: stringifyId(i, patterns.length),
                patternIndex: i,
            }, undefined, [])];
            for (let j = pattern.length - 1; j >= 0; --j) {
                let symbol = pattern.charAt(j);

                if (symbol === '*') {
                    initialStates.push(makeState(undefined, undefined, initialStates));
                    continue;
                }

                if (symbol === '?') {
                    initialStates = [makeState(undefined, undefined, initialStates)];
                    continue;
                }

                initialStates = [makeState(undefined, symbol, initialStates)];
            }

            this.initialStates.push(...initialStates);
        }
    }
}

class DfaState {
    constructor(dfa, nfaStates) {
        this.dfa = dfa;
        this.nfaStates = nfaStates;
    }

    finalize() {
        let finish = this.finish;
        if (finish === undefined) {
            let nfaFinishes = new Set();
            for (let nfaState of this.nfaStates) {
                if (nfaState.finish !== undefined) {
                    nfaFinishes.add(nfaState.finish);
                }
            }
            finish = this.dfa.getFinish(nfaFinishes);
            this.finish = finish;
        }
        return finish;
    }

    step(symbol) {
        let targetState = this[symbol];
        if (targetState === undefined) {
            let targetNfaStates = new Set();
            for (let nfaState of this.nfaStates) {
                if (nfaState.key === undefined || nfaState.key === symbol) {
                    for (let targetNfaState of nfaState.targets) {
                        targetNfaStates.add(targetNfaState);
                    }
                }
            }
            targetState = this.dfa.getState(targetNfaStates);
            this[symbol] = targetState;
        }
        return targetState;
    }
}

class Dfa {
    constructor(patterns, constructFinish) {
        this.nfa = new Nfa(patterns);
        this.constructFinish = constructFinish;

        this.finishById = Object.create(null);
        this.stateById = Object.create(null);

        this.walkCache = Object.create(null);

        this.initialState = this.getState(this.nfa.initialStates);
    }

    getFinish(nfaFinishes) {
        nfaFinishes = Array.from(nfaFinishes);

        let finishId = nfaFinishes.map(nf => nf.id).sort().join('');

        let finish = this.finishById[finishId];
        if (finish === undefined) {
            finish = this.constructFinish(nfaFinishes.map(nf => nf.patternIndex).sort((a, b) => a - b));
            this.finishById[finishId] = finish;
        }
        return finish;
    }

    getState(nfaStates) {
        nfaStates = Array.from(nfaStates);

        let stateId = nfaStates.map(ns => ns.id).sort().join('');

        let state = this.stateById[stateId];
        if (state === undefined) {
            state = new DfaState(this, nfaStates);
            this.stateById[stateId] = state;
        }
        return state;
    }

    walk(symbols) {
        let finish = this.walkCache[symbols];
        if (finish === undefined) {
            let state = this.initialState;
            for (let symbol of symbols) {
                state = state.step(symbol);
            }
            finish = state.finalize();
            this.walkCache[symbols] = finish;
        }
        return finish;
    }
}

function filter(messages, rules) {
    let patterns = rules.map(r => r.from || '*');
    let dfa = new Dfa(patterns, is => {
        let siftedRules = is.map(i => rules[i]);
        let siftedPatterns = siftedRules.map(sr => sr.to || '*');
        return new Dfa(siftedPatterns, is => {
            return is.map(i => siftedRules[i].action);
        });
    });

    let actions = {};
    for (let id in messages) {
        let message = messages[id];
        let siftedDfa = dfa.walk(message.from);
        actions[id] = siftedDfa.walk(message.to);
    }
    return actions;
}

module.exports = filter.filter = filter;


'use strict';

let compilePatternsToNfa = require('./compilePatternsToNfa');

function lazyDfaFilter(messages, rules) {
    let nfa = compilePatternsToNfa(rules.map(r => (r.from || '*') + '\x1F' + (r.to || '*')));

    let statesById = new Map();
    function getStateForNfaStates(nfaStates) {
        nfaStates = Array.from(nfaStates);
        let id = nfaStates.map(s => s.id).sort().join('');
        let state = statesById.get(id);
        if (state === undefined) {
            state = { nfaStates };
            statesById.set(id, state);
        }
        return state;
    }

    let initial = getStateForNfaStates(nfa.initials);

    function inflateState(state) {
        let defaultNfaTargets = new Set();
        let nfaTargetsByGate = new Map();
        let nfaFinishes = new Set();
        for (let nfaState of state.nfaStates) {
            if (nfaState.gate === null) {
                for (let nfaTarget of nfaState.targets) {
                    for (let nfaTargets of nfaTargetsByGate.values()) {
                        nfaTargets.add(nfaTarget);
                    }
                    defaultNfaTargets.add(nfaTarget);
                }
            } else {
                let nfaTargets = nfaTargetsByGate.get(nfaState.gate);
                if (nfaTargets === undefined) {
                    nfaTargets = new Set(defaultNfaTargets);
                    nfaTargetsByGate.set(nfaState.gate, nfaTargets);
                }
                for (let nfaTarget of nfaState.targets) {
                    nfaTargets.add(nfaTarget);
                }
            }

            if (nfaState.finish !== null) {
                nfaFinishes.add(nfaState.finish);
            }
        }

        state.nfaStates = null;

        state.defaultTarget = getStateForNfaStates(defaultNfaTargets);
        state.targetByGate = Object.create(null);
        for (let kv of nfaTargetsByGate) {
            let gate = kv[0];
            let nfaTargets = kv[1];
            let target = getStateForNfaStates(nfaTargets);
            if (target !== state.defaultTarget) {
                state.targetByGate[gate] = target;
            }
        }

        state.isTrap = state.defaultTarget === state && Object.keys(state.targetByGate).length === 0;

        state.actions = Array.from(nfaFinishes).sort((a, b) => a - b).map(i => rules[i].action);
    }

    inflateState(initial);

    let actions = {};
    for (let id in messages) {
        let message = messages[id];
        let signature = message.from + '\x1F' + message.to;

        let state = initial;
        for (let symbol of signature) {
            state = state.targetByGate[symbol] || state.defaultTarget;
            if (state.nfaStates !== null) {
                inflateState(state);
            }
            if (state.isTrap) {
                break;
            }
        }
        actions[id] = state.actions;
    }
    return actions;
}

lazyDfaFilter.filter = lazyDfaFilter;

module.exports = lazyDfaFilter;


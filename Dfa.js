'use strict';

class DfaState {
    constructor(nfaStates) {
        this._nfaStates = nfaStates;
    }

    inflate(dfa) {
        let defaultNfaTargets = new Set();
        let nfaTargetsBySymbol = new Map();
        let nfaFinishes = new Set();
        for (let nfaState of this._nfaStates) {
            if (nfaState.symbol === undefined) {
                for (let nfaTarget of nfaState.targets) {
                    for (let nfaTargets of nfaTargetsBySymbol.values()) {
                        nfaTargets.add(nfaTarget);
                    }
                    defaultNfaTargets.add(nfaTarget);
                }
            } else {
                let nfaTargets = nfaTargetsBySymbol.get(nfaState.symbol);
                if (nfaTargets === undefined) {
                    nfaTargets = new Set(defaultNfaTargets);
                    nfaTargetsBySymbol.set(nfaState.symbol, nfaTargets);
                }
                for (let nfaTarget of nfaState.targets) {
                    nfaTargets.add(nfaTarget);
                }
            }

            if (nfaState.finish !== undefined) {
                nfaFinishes.add(nfaState.finish);
            }
        }

        this.defaultTarget = dfa.getState(defaultNfaTargets);
        this.targetBySymbol = Object.create(null);
        let targetBySymbolCount = 0;
        for (let kv of nfaTargetsBySymbol) {
            let symbol = kv[0];
            let nfaTargets = kv[1];
            let target = dfa.getState(nfaTargets);
            if (target !== this.defaultTarget) {
                this.targetBySymbol[symbol] = target;
                ++targetBySymbolCount;
            }
        }
        this.isTrap = this.defaultTarget === this && targetBySymbolCount === 0;
        this._nfaFinishes = Array.from(nfaFinishes);

        delete this._nfaStates;

        this.inflate = DfaState.nilInflate;
    }

    static nilInflate(dfa) {}

    step(symbol, dfa) {
        let target = this.targetBySymbol[symbol] || this.defaultTarget;
        target.inflate(dfa);
        return target;
    }

    finalize(dfa) {
        this.finish = dfa.getFinish(this._nfaFinishes);
        delete this._nfaFinishes;
        this.finalize = DfaState.nilFinalize;
        return this.finish;
    }

    static nilFinalize(dfa) {
        return this.finish;
    }
}

class Dfa {
    constructor(nfa) {
        this._buildFinish = nfa.combineFinishes;

        this._stateById = new Map();
        this._finishById = new Map();

        this.initial = new DfaState(nfa.initials);
        this.initial.inflate(this);

        this._cache = new Map();
    }

    getState(nfaStates) {
        nfaStates = Array.from(nfaStates);
        let id = nfaStates.map(s => s.id).sort().join('');
        let state = this._stateById.get(id);
        if (state === undefined) {
            state = new DfaState(nfaStates);
            this._stateById.set(id, state);
        }
        return state;
    }

    getFinish(nfaFinishes) {
        let id = nfaFinishes.map(f => f.id).sort().join('');
        let finish = this._finishById.get(id);
        if (finish === undefined) {
            finish = this._buildFinish(nfaFinishes.map(f => f.data));
            this._finishById.set(id, finish);
        }
        return finish;
    }

    walk(symbols) {
        let finish = this._cache.get(symbols);
        if (finish === undefined) {
            let state = this.initial;
            for (let symbol of symbols) {
                state = state.step(symbol, this);
                if (state.isTrap) {
                    break;
                }
            }
            finish = state.finalize(this);
            this._cache.set(symbols, finish);
        }
        return finish;
    }
}

module.exports = Dfa;


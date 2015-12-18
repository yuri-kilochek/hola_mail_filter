/*
 * Written by Yuri Kilochek <yuri.kilochek@gmail.com>
 * for Hola's "JS challenge Winter 2015: Mail Filtering Engine"
 * at http://hola.org/challenge_mail_filter
 */

'use strict';

function normalizePattern(pattern) {
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
}

class Nfa {
    constructor(finals, extractPattern) {
        let nextStateId = 0;

        this.final = [];
        this.gateSymbol = [];
        this.targetStateIds = [];

        this.initialStateIds = [];
        for (let n = finals.length, i = 0; i < n; ++i) {
            let final = finals[i];

            let pattern = extractPattern(final);
            pattern = normalizePattern(pattern);

            let finalStateId = nextStateId++;
            this.final[finalStateId] = final;
            this.targetStateIds[finalStateId] = [];

            let initialStateIds = [finalStateId];
            for (let j = pattern.length - 1; j >= 0; --j) {
                let symbol = pattern[j];

                let stateId = nextStateId++;
                this.targetStateIds[stateId] = initialStateIds;
                if (symbol === '*') {
                    initialStateIds.push(stateId);
                } else {
                    if (symbol !== '?') {
                        this.gateSymbol[stateId] = symbol;
                    }

                    initialStateIds = [stateId];
                }
            }

            this.initialStateIds.push(...initialStateIds);
        }
    }
}

class Dfa {
    constructor(finals, extractPattern, combineFinals) {
        this.nfa = new Nfa(finals, extractPattern);
        this.combineFinals = combineFinals;

        this.finalCache = Object.create(null);
        this.stateIdCache = Object.create(null);

        this.nextStateId = 0;

        this.nfaStateIds = [];
        this.transitions = [];
        this.final = [];

        this.initialStateId = this.getStateId(this.nfa.initialStateIds);

        this.cache = Object.create(null);
    }

    getFinal(nfaStateIds) {
        let key = nfaStateIds.toString();

        let final = this.finalCache[key];
        if (final === undefined) {
            let nfaFinals = nfaStateIds.map(nfaStateId => this.nfa.final[nfaStateId]);
            final = this.finalCache[key] = this.combineFinals(nfaFinals);
        }

        return final;
    }

    finalize(stateId) {
        let final = this.final[stateId];
        if (final === undefined) {
            let finalNfaStateIds = [];
            for (let nfaStateIds = this.nfaStateIds[stateId], n = nfaStateIds.length, i = 0; i < n; ++i) {
                let nfaStateId = nfaStateIds[i];

                if (this.nfa.final[nfaStateId] !== undefined) {
                    finalNfaStateIds.push(nfaStateId);
                }
            }

            final = this.final[stateId] = this.getFinal(finalNfaStateIds);
        }

        return final;
    }

    getStateId(nfaStateIds) {
        let key = nfaStateIds.toString();

        let stateId = this.stateIdCache[key];
        if (stateId === undefined) {
            stateId = this.stateIdCache[key] = this.nextStateId++;
            this.nfaStateIds[stateId] = nfaStateIds;
            this.transitions[stateId] = Object.create(null);
        }

        return stateId;
    }

    step(stateId, symbol) {
        let transitions = this.transitions[stateId];
        let targetStateId = transitions[symbol];
        if (targetStateId === undefined) {
            let targetNfaStateIds = [];
            for (let nfaStateIds = this.nfaStateIds[stateId], n = nfaStateIds.length, i = 0; i < n; ++i) {
                let nfaStateId = nfaStateIds[i];

                let nfaStateGateSymbol = this.nfa.gateSymbol[nfaStateId];
                if (nfaStateGateSymbol === undefined || nfaStateGateSymbol === symbol) {
                    targetNfaStateIds.push(...this.nfa.targetStateIds[nfaStateId]);
                }
            }

            targetStateId = transitions[symbol] = this.getStateId(targetNfaStateIds);
        }

        return targetStateId;
    }

    walk(symbols) {
        let final = this.cache[symbols];
        if (final === undefined) {
            let stateId = this.initialStateId;
            for (let n = symbols.length, i = 0; i < n; ++i) {
                let symbol = symbols[i];

                stateId = this.step(stateId, symbol);
            }

            final = this.cache[symbols] = this.finalize(stateId);
        }

        return final;
    }
}

function filter(messages, rules) {
    let dfa = new Dfa(rules, (rule => rule.from || '*'), rules => {
        return new Dfa(rules, (rule => rule.to || '*'), rules => {
            return rules.map(rule => rule.action);
        });
    });

    for (let id in messages) {
        let message = messages[id];
        messages[id] = dfa.walk(message.from).walk(message.to);
    }
    return messages;
}

module.exports = filter.filter = filter;


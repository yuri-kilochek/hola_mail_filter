'use strict';

let Nfa = require('./Nfa');
let Dfa = require('./Dfa');

function lazyBipartiteDfaFilter(messages, rules) {
    let fromDfa = new Dfa(new Nfa(rules.map(r => [r.from || '*', r]), rules => {
        let toDfa = new Dfa(new Nfa(rules.map(r => [r.to || '*', r]), rules => {
            let actions = rules.map(r => r.action);
            return actions;
        }));
        return toDfa;
    }));

    let actions = {};
    for (let id in messages) {
        let message = messages[id];
        let toDfa = fromDfa.walk(message.from);
        actions[id] = toDfa.walk(message.to);
    }
    return actions;
}

module.exports = lazyBipartiteDfaFilter.filter = lazyBipartiteDfaFilter;

